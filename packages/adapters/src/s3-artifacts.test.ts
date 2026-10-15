import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import {
  ArtifactNotFoundError,
  createArtifactStore,
  S3ArtifactStore,
  s3ArtifactConfigFromEnv,
} from "./s3-artifacts.js";

interface Seen {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  body: Buffer;
}

const SECRET = "fake-secret-key-value";
let server: Server;
let endpoint: string;
let seen: Seen[];
let objects: Map<string, Buffer>;
let forced: number | null;

beforeEach(async () => {
  seen = [];
  objects = new Map();
  forced = null;
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const path = req.url ?? "";
    seen.push({ method: req.method ?? "", path, headers: req.headers, body });
    if (forced) {
      res.statusCode = forced;
      res.end(`<Error><Code>AccessDenied</Code><Message>${SECRET}</Message></Error>`);
      return;
    }
    if (req.method === "PUT") {
      objects.set(path, body);
      res.end();
    } else if (req.method === "GET") {
      const found = objects.get(path);
      res.statusCode = found ? 200 : 404;
      res.end(found);
    } else {
      objects.delete(path);
      res.statusCode = 204;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => new Promise((resolve) => server.close(resolve)));

const config = () => ({
  endpoint,
  bucket: "bkt",
  region: "us-east-1",
  accessKeyId: "AKFAKE",
  secretAccessKey: SECRET,
  forcePathStyle: true,
  prefix: "",
});
const ctx = (spaceId: string) => ({ spaceId }) as never;
const bytes = new TextEncoder().encode("hello");
const artifact = { name: "a.txt", mimeType: "text/plain", bytes };

describe("S3ArtifactStore", () => {
  it("signs a PUT to the space-scoped key and returns the SHA-256", async () => {
    const store = new S3ArtifactStore({ ...config(), prefix: "rk" });
    const { id, hash } = await store.put(artifact, ctx("space-a"));
    expect(hash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(seen[0]?.method).toBe("PUT");
    expect(seen[0]?.path).toBe(`/bkt/rk/artifacts/space-a/${id}`);
    expect(seen[0]?.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(seen[0]?.body.toString()).toBe("hello");
    expect(new TextDecoder().decode(await store.get(id, ctx("space-a")))).toBe("hello");
  });

  it("isolates spaces", async () => {
    const store = new S3ArtifactStore(config());
    const a = await store.put(artifact, ctx("space-a"));
    const b = await store.put(artifact, ctx("space-b"));
    expect(seen[0]?.path).not.toBe(seen[1]?.path);
    await expect(store.get(a.id, ctx("space-b"))).rejects.toBeInstanceOf(ArtifactNotFoundError);
    await store.remove(a.id, ctx("space-b"));
    expect(await store.get(a.id, ctx("space-a"))).toHaveLength(5);
    await store.remove(b.id, ctx("space-b"));
  });

  it("rejects traversal in space ids and artifact ids", async () => {
    const store = new S3ArtifactStore(config());
    await expect(store.get("../x", ctx("space-a"))).rejects.toThrow("Invalid artifact id");
    await expect(store.get("a/b", ctx("space-a"))).rejects.toThrow("Invalid artifact id");
    await expect(store.put(artifact, ctx(".."))).rejects.toThrow("Invalid space id");
    await expect(store.put(artifact, ctx("a/b"))).rejects.toThrow("Invalid space id");
    expect(seen).toHaveLength(0);
  });

  it("throws not-found on get and succeeds on removing a missing object", async () => {
    const store = new S3ArtifactStore(config());
    await expect(store.get("missing", ctx("space-a"))).rejects.toBeInstanceOf(
      ArtifactNotFoundError,
    );
    await expect(store.remove("missing", ctx("space-a"))).resolves.toBeUndefined();
  });

  it("reports errors without credentials, URLs, or response bodies", async () => {
    const store = new S3ArtifactStore(config());
    forced = 403;
    const error = await store.put(artifact, ctx("space-a")).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toBe("S3 put failed with status 403 (AccessDenied)");
    for (const secret of [SECRET, "AKFAKE", "127.0.0.1", "space-a"]) {
      expect(message).not.toContain(secret);
    }
  });

  it("builds path-style and virtual-host URLs", () => {
    const base = { ...config(), endpoint: "https://s3.example.test", prefix: "p" };
    const path = new S3ArtifactStore({ ...base, forcePathStyle: true });
    const virtual = new S3ArtifactStore({ ...base, forcePathStyle: false });
    expect(path.url("p/artifacts/s/i")).toBe("https://s3.example.test/bkt/p/artifacts/s/i");
    expect(virtual.url("p/artifacts/s/i")).toBe("https://bkt.s3.example.test/p/artifacts/s/i");
  });
});

describe("s3ArtifactConfigFromEnv", () => {
  const full = {
    RAKAZO_S3_ENDPOINT: "https://s3.example.test",
    RAKAZO_S3_BUCKET: "bkt",
    RAKAZO_S3_ACCESS_KEY_ID: "id",
    RAKAZO_S3_SECRET_ACCESS_KEY: "secret",
  };

  it("parses a full config with defaults", () => {
    expect(
      s3ArtifactConfigFromEnv({
        ...full,
        RAKAZO_S3_FORCE_PATH_STYLE: "true",
        RAKAZO_S3_PREFIX: "/a/",
      }),
    ).toEqual({
      endpoint: "https://s3.example.test",
      bucket: "bkt",
      region: "us-east-1",
      accessKeyId: "id",
      secretAccessKey: "secret",
      forcePathStyle: true,
      prefix: "a",
    });
  });

  it("returns null when absent and picks the local store", () => {
    expect(s3ArtifactConfigFromEnv({})).toBeNull();
    expect(createArtifactStore({}, "/tmp/x")).toBeInstanceOf(LocalArtifactStore);
    expect(createArtifactStore(full, "/tmp/x")).toBeInstanceOf(S3ArtifactStore);
  });

  it("names the missing variable on partial config without leaking values", () => {
    const { RAKAZO_S3_BUCKET: _, ...partial } = full;
    expect(() => s3ArtifactConfigFromEnv(partial)).toThrow(
      "RAKAZO_S3_BUCKET is required when object storage is configured",
    );
    expect(() => s3ArtifactConfigFromEnv(partial)).not.toThrow(/secret/);
  });
});
