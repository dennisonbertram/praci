import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AdapterContext, ArtifactPut, ArtifactStore } from "@rakazo/adapter-kit";
import { AwsClient } from "aws4fetch";
import { LocalArtifactStore } from "./artifacts.js";

export interface S3ArtifactConfig {
  endpoint: string;
  bucket: string;
  /** us-east-1 is accepted by AWS S3, R2 (as an alias of auto) and MinIO (its default); `auto` is not accepted by AWS or MinIO. */
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  prefix: string;
}

export class ArtifactNotFoundError extends Error {
  constructor(id: string) {
    super(`Artifact ${id} was not found`);
    this.name = "ArtifactNotFoundError";
  }
}

const REQUIRED = [
  ["RAKAZO_S3_ENDPOINT", "endpoint"],
  ["RAKAZO_S3_BUCKET", "bucket"],
  ["RAKAZO_S3_ACCESS_KEY_ID", "accessKeyId"],
  ["RAKAZO_S3_SECRET_ACCESS_KEY", "secretAccessKey"],
] as const;

/** Plain http is allowed only where traffic stays on the machine or private network. */
function isLocalHost(host: string) {
  if (host === "localhost" || host === "[::1]") return true;
  if (/^[a-z0-9_-]+$/i.test(host) && !/^\d+$/.test(host)) return true; // single label, e.g. a Docker service
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return /^\[f[cd][0-9a-f]{2}:/i.test(host);
}

/** Returns null when no S3 variable is set; throws naming the missing variable on partial config. */
export function s3ArtifactConfigFromEnv(
  env: Record<string, string | undefined>,
): S3ArtifactConfig | null {
  const value = (name: string) => env[name]?.trim() ?? "";
  if (!Object.keys(env).some((name) => name.startsWith("RAKAZO_S3_") && value(name))) return null;
  const missing = REQUIRED.find(([name]) => !value(name));
  if (missing) {
    throw new Error(`${missing[0]} is required when object storage is configured`);
  }
  const invalid = (name: string): never => {
    throw new Error(`${name} is invalid`);
  };
  const check = (name: string, ok: boolean) => {
    if (!ok) invalid(name);
  };
  const endpoint = value("RAKAZO_S3_ENDPOINT");
  check(
    "RAKAZO_S3_ENDPOINT",
    URL.canParse(endpoint) && /^https?:$/.test(new URL(endpoint).protocol),
  );
  if (new URL(endpoint).protocol === "http:" && !isLocalHost(new URL(endpoint).hostname)) {
    throw new Error("RAKAZO_S3_ENDPOINT must use https");
  }
  const bucket = value("RAKAZO_S3_BUCKET");
  check("RAKAZO_S3_BUCKET", /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket));
  const region = value("RAKAZO_S3_REGION") || "us-east-1";
  check("RAKAZO_S3_REGION", /^[a-z0-9-]+$/.test(region));
  for (const name of ["RAKAZO_S3_ACCESS_KEY_ID", "RAKAZO_S3_SECRET_ACCESS_KEY"]) {
    check(name, /^[\x21-\x7e]+$/.test(value(name)));
  }
  const prefix = value("RAKAZO_S3_PREFIX").replace(/^\/+|\/+$/g, "");
  check(
    "RAKAZO_S3_PREFIX",
    !prefix || prefix.split("/").every((part) => part && part !== "." && part !== ".."),
  );
  return {
    endpoint,
    bucket,
    region,
    accessKeyId: value("RAKAZO_S3_ACCESS_KEY_ID"),
    secretAccessKey: value("RAKAZO_S3_SECRET_ACCESS_KEY"),
    forcePathStyle: /^(1|true|yes)$/i.test(value("RAKAZO_S3_FORCE_PATH_STYLE")),
    prefix,
  };
}

/** The S3 store when RAKAZO_S3_* is configured, otherwise the single-process local store. */
export function createArtifactStore(
  env: Record<string, string | undefined>,
  dataDir: string,
): ArtifactStore {
  const config = s3ArtifactConfigFromEnv(env);
  // Files written before object storage was enabled stay readable from the local directory.
  return config
    ? new LocalFallbackArtifactStore(new S3ArtifactStore(config), new LocalArtifactStore(dataDir))
    : new LocalArtifactStore(dataDir);
}

/** Reads fall back to the local store when the primary does not have the object. Writes go to the primary. */
export class LocalFallbackArtifactStore implements ArtifactStore {
  constructor(
    private readonly primary: ArtifactStore,
    private readonly legacy: ArtifactStore,
  ) {}

  describe() {
    return this.primary.describe();
  }

  put(artifact: ArtifactPut, context: AdapterContext) {
    return this.primary.put(artifact, context);
  }

  putFile(file: { path: string; name: string; mimeType: string }, context: AdapterContext) {
    return this.primary.putFile
      ? this.primary.putFile(file, context)
      : readFile(file.path).then((bytes) => this.primary.put({ ...file, bytes }, context));
  }

  putStream(
    body: AsyncIterable<Uint8Array>,
    file: { name: string; mimeType: string },
    context: AdapterContext,
  ) {
    return this.primary.putStream(body, file, context);
  }

  async getStream(id: string, context: AdapterContext, range?: { start: number; end: number }) {
    try {
      return await this.primary.getStream(id, context, range);
    } catch (error) {
      if (!(error instanceof ArtifactNotFoundError)) throw error;
      return this.legacy.getStream(id, context, range).catch((legacyError: unknown) => {
        if ((legacyError as NodeJS.ErrnoException)?.code === "ENOENT") throw error;
        throw legacyError;
      });
    }
  }

  async get(id: string, context: AdapterContext) {
    try {
      return await this.primary.get(id, context);
    } catch (error) {
      if (!(error instanceof ArtifactNotFoundError)) throw error;
      return this.legacy.get(id, context).catch((legacyError: unknown) => {
        if ((legacyError as NodeJS.ErrnoException)?.code === "ENOENT") throw error;
        throw legacyError;
      });
    }
  }

  async getFile(id: string, destination: string, context: AdapterContext) {
    try {
      return await (this.primary.getFile
        ? this.primary.getFile(id, destination, context)
        : writeFile(destination, await this.primary.get(id, context), { flag: "wx" }));
    } catch (error) {
      if (!(error instanceof ArtifactNotFoundError)) throw error;
      await rm(destination, { force: true });
      return this.legacy.getFile!(id, destination, context).catch((legacyError: unknown) => {
        if ((legacyError as NodeJS.ErrnoException)?.code === "ENOENT") throw error;
        throw legacyError;
      });
    }
  }

  async remove(id: string, context: AdapterContext) {
    await this.primary.remove(id, context);
    await this.legacy.remove(id, context);
  }
}

function segment(value: string, label: string) {
  if (!value || value === ".." || value === "." || value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

const PART_BYTES = 8 * 1024 * 1024;

export class S3ArtifactStore implements ArtifactStore {
  private readonly client: AwsClient;

  constructor(private readonly config: S3ArtifactConfig) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: config.region,
      retries: 3,
    });
  }

  describe() {
    return {
      id: "s3-artifacts",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { stream: false },
    };
  }

  /** Object URL for a key, path-style (`host/bucket/key`) or virtual-host (`bucket.host/key`). */
  url(key: string) {
    const base = new URL(this.config.endpoint);
    const path = key.split("/").map(encodeURIComponent).join("/");
    const root = base.pathname.replace(/\/+$/, "");
    // A dotted bucket name cannot match a wildcard TLS certificate, so it always uses path-style.
    if (this.config.forcePathStyle || this.config.bucket.includes(".")) {
      return `${base.origin}${root}/${this.config.bucket}/${path}`;
    }
    return `${base.protocol}//${this.config.bucket}.${base.host}${root}/${path}`;
  }

  key(id: string, context: AdapterContext) {
    const parts = ["artifacts", segment(context.spaceId, "space id"), segment(id, "artifact id")];
    return (this.config.prefix ? [this.config.prefix, ...parts] : parts).join("/");
  }

  private async send(
    method: "PUT" | "GET" | "DELETE" | "POST",
    key: string,
    context: AdapterContext,
    body?: Uint8Array,
    query?: string,
    headers?: Record<string, string>,
  ) {
    try {
      return await this.client.fetch(`${this.url(key)}${query ? `?${query}` : ""}`, {
        method,
        body: body as BodyInit | undefined,
        headers,
        signal: context.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      // Signing and transport errors can carry the key id, signature or URL; report none of them.
      throw new Error("S3 request failed");
    }
  }

  private async fail(op: string, response: Response): Promise<never> {
    // Only the status and S3's error code are reported; never the URL, headers or body.
    const code = /<Code>([A-Za-z]+)<\/Code>/.exec(await response.text().catch(() => ""))?.[1];
    throw new Error(`S3 ${op} failed with status ${response.status}${code ? ` (${code})` : ""}`);
  }

  async put(artifact: ArtifactPut, context: AdapterContext) {
    const id = randomUUID();
    const response = await this.send("PUT", this.key(id, context), context, artifact.bytes);
    if (!response.ok) await this.fail("put", response);
    return { id, hash: createHash("sha256").update(artifact.bytes).digest("hex") };
  }

  /**
   * Single PUT up to one part; larger streams use multipart, so memory stays at one part plus one
   * chunk. The first part is held until a second one exists, which keeps small objects in one PUT.
   * ponytail: 10,000 parts of 8 MiB cap an object near 78 GiB; raise the part size stepwise if
   * larger objects are ever needed.
   */
  async putStream(
    body: AsyncIterable<Uint8Array>,
    _file: { name: string; mimeType: string },
    context: AdapterContext,
  ) {
    const id = randomUUID();
    const key = this.key(id, context);
    const hash = createHash("sha256");
    let size = 0;
    let held: Uint8Array[] = [];
    let heldBytes = 0;
    let upload: { query: string; etags: string[] } | null = null;

    const sendPart = async () => {
      if (!upload) {
        const started = await this.send("POST", key, context, undefined, "uploads");
        if (!started.ok) await this.fail("put", started);
        const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await started.text())?.[1];
        if (!uploadId) throw new Error("S3 put failed: no upload id");
        upload = { query: `uploadId=${encodeURIComponent(uploadId)}`, etags: [] };
      }
      const current: { query: string; etags: string[] } = upload;
      const number = current.etags.length + 1;
      if (number > 10_000) throw new Error("S3 put failed: object is too large");
      const part = await this.send(
        "PUT",
        key,
        context,
        Buffer.concat(held),
        `partNumber=${number}&${current.query}`,
      );
      if (!part.ok) await this.fail("put", part);
      const etag = part.headers.get("etag");
      if (!etag) throw new Error("S3 put failed: no part etag");
      current.etags.push(etag);
      held = [];
      heldBytes = 0;
    };

    try {
      for await (const chunk of body) {
        context.signal?.throwIfAborted();
        hash.update(chunk);
        size += chunk.byteLength;
        for (let rest = chunk; rest.byteLength > 0; ) {
          if (heldBytes === PART_BYTES) await sendPart();
          const piece = rest.subarray(0, PART_BYTES - heldBytes);
          held.push(piece);
          heldBytes += piece.byteLength;
          rest = rest.subarray(piece.byteLength);
        }
      }
      context.signal?.throwIfAborted();
      if (!upload) {
        const response = await this.send("PUT", key, context, Buffer.concat(held));
        if (!response.ok) await this.fail("put", response);
      } else {
        await sendPart();
        const { query, etags } = upload as { query: string; etags: string[] };
        const xml = `<CompleteMultipartUpload>${etags
          .map(
            (etag, index) =>
              `<Part><PartNumber>${index + 1}</PartNumber><ETag>${etag}</ETag></Part>`,
          )
          .join("")}</CompleteMultipartUpload>`;
        const done = await this.send("POST", key, context, new TextEncoder().encode(xml), query);
        if (!done.ok || /<Error>/.test(await done.clone().text())) await this.fail("put", done);
      }
    } catch (error) {
      if (upload) {
        // The run's own signal may be the reason for failing; cleanup must not depend on it.
        const cleanup = { ...context, signal: AbortSignal.timeout(30_000) };
        const { query } = upload as { query: string };
        await this.send("DELETE", key, cleanup, undefined, query).catch(() => undefined);
      }
      throw error;
    }
    return { id, hash: hash.digest("hex"), size };
  }

  putFile(file: { path: string; name: string; mimeType: string }, context: AdapterContext) {
    return this.putStream(createReadStream(file.path), file, context);
  }

  async getStream(id: string, context: AdapterContext, range?: { start: number; end: number }) {
    if (range && range.end <= range.start) {
      return new ReadableStream<Uint8Array>({ start: (controller) => controller.close() });
    }
    const response = await this.send(
      "GET",
      this.key(id, context),
      context,
      undefined,
      undefined,
      range ? { range: `bytes=${range.start}-${range.end - 1}` } : undefined,
    );
    if (response.status === 404) throw new ArtifactNotFoundError(id);
    if (!response.ok || !response.body || (range && response.status !== 206)) {
      await this.fail("get", response);
    }
    return response.body as ReadableStream<Uint8Array>;
  }

  async getFile(id: string, destination: string, context: AdapterContext) {
    const response = await this.send("GET", this.key(id, context), context);
    if (response.status === 404) throw new ArtifactNotFoundError(id);
    if (!response.ok || !response.body) await this.fail("get", response);
    await pipeline(
      Readable.fromWeb(response.body as never),
      createWriteStream(destination, { flags: "wx", mode: 0o600 }),
    );
  }

  async get(id: string, context: AdapterContext) {
    const response = await this.send("GET", this.key(id, context), context);
    if (response.status === 404) throw new ArtifactNotFoundError(id);
    if (!response.ok) await this.fail("get", response);
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(id: string, context: AdapterContext) {
    const response = await this.send("DELETE", this.key(id, context), context);
    if (!response.ok && response.status !== 404) await this.fail("remove", response);
  }
}
