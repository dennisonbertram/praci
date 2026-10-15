import { createHash, randomUUID } from "node:crypto";
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
  return config ? new S3ArtifactStore(config) : new LocalArtifactStore(dataDir);
}

function segment(value: string, label: string) {
  if (!value || value === ".." || value === "." || value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

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
    if (this.config.forcePathStyle) {
      return `${base.origin}${base.pathname.replace(/\/+$/, "")}/${this.config.bucket}/${path}`;
    }
    return `${base.protocol}//${this.config.bucket}.${base.host}/${path}`;
  }

  key(id: string, context: AdapterContext) {
    const parts = ["artifacts", segment(context.spaceId, "space id"), segment(id, "artifact id")];
    return (this.config.prefix ? [this.config.prefix, ...parts] : parts).join("/");
  }

  private async send(method: "PUT" | "GET" | "DELETE", key: string, body?: Uint8Array) {
    try {
      return await this.client.fetch(this.url(key), { method, body: body as BodyInit | undefined });
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
    const response = await this.send("PUT", this.key(id, context), artifact.bytes);
    if (!response.ok) await this.fail("put", response);
    return { id, hash: createHash("sha256").update(artifact.bytes).digest("hex") };
  }

  async get(id: string, context: AdapterContext) {
    const response = await this.send("GET", this.key(id, context));
    if (response.status === 404) throw new ArtifactNotFoundError(id);
    if (!response.ok) await this.fail("get", response);
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(id: string, context: AdapterContext) {
    const response = await this.send("DELETE", this.key(id, context));
    if (!response.ok && response.status !== 404) await this.fail("remove", response);
  }
}
