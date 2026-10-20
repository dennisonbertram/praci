import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import {
  ArtifactNotFoundError,
  createArtifactStore,
  LocalFallbackArtifactStore,
  S3ArtifactStore,
} from "./s3-artifacts.js";

const ctx = { spaceId: "space-1", signal: new AbortController().signal } as never;
const dirs: string[] = [];
const servers: Server[] = [];
async function tmp() {
  const dir = await mkdtemp(path.join(tmpdir(), "rakazo-fallback-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

/** A tiny in-memory S3: objects by path, multipart parts by upload id. */
async function fakeS3() {
  const objects = new Map<string, Buffer>();
  const uploads = new Map<string, Map<number, Buffer>>();
  const seen: string[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url ?? "/", "http://x");
    seen.push(
      `${req.method} ${url.pathname}${url.search ? "?" : ""}${[...url.searchParams.keys()].join("&")}`,
    );
    if (req.method === "POST" && url.searchParams.has("uploads")) {
      uploads.set("u1", new Map());
      res.end(
        "<InitiateMultipartUploadResult><UploadId>u1</UploadId></InitiateMultipartUploadResult>",
      );
    } else if (req.method === "PUT" && url.searchParams.has("partNumber")) {
      uploads
        .get(url.searchParams.get("uploadId")!)!
        .set(Number(url.searchParams.get("partNumber")), body);
      res.setHeader("etag", `"part${url.searchParams.get("partNumber")}"`);
      res.end();
    } else if (req.method === "POST" && url.searchParams.has("uploadId")) {
      const parts = uploads.get(url.searchParams.get("uploadId")!)!;
      objects.set(
        url.pathname,
        Buffer.concat([...parts.keys()].sort((a, b) => a - b).map((n) => parts.get(n)!)),
      );
      res.end("<CompleteMultipartUploadResult/>");
    } else if (req.method === "PUT") {
      objects.set(url.pathname, body);
      res.end();
    } else if (req.method === "GET") {
      const found = objects.get(url.pathname);
      res.statusCode = found ? 200 : 404;
      res.end(found);
    } else {
      objects.delete(url.pathname);
      res.statusCode = 204;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  servers.push(server);
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const config = {
    endpoint,
    bucket: "rakazo",
    region: "us-east-1",
    accessKeyId: "access-key-1",
    secretAccessKey: "secret-key-1",
    forcePathStyle: true,
    prefix: "",
  };
  return { objects, seen, store: new S3ArtifactStore(config), config };
}

describe("artifacts written before object storage was enabled", () => {
  it("are still read from the local directory, while new files go to S3", async () => {
    const dataDir = await tmp();
    const s3 = await fakeS3();
    const legacy = new LocalArtifactStore(dataDir);
    const old = await legacy.put(
      { name: "old.txt", mimeType: "text/plain", bytes: new TextEncoder().encode("legacy bytes") },
      ctx,
    );
    const store = createArtifactStore(
      {
        RAKAZO_S3_ENDPOINT: s3.config.endpoint,
        RAKAZO_S3_BUCKET: "rakazo",
        RAKAZO_S3_ACCESS_KEY_ID: "access-key-1",
        RAKAZO_S3_SECRET_ACCESS_KEY: "secret-key-1",
        RAKAZO_S3_FORCE_PATH_STYLE: "true",
      },
      dataDir,
    );
    expect(store).toBeInstanceOf(LocalFallbackArtifactStore);
    expect(new TextDecoder().decode(await store.get(old.id, ctx))).toBe("legacy bytes");

    const fresh = await store.put(
      { name: "new.txt", mimeType: "text/plain", bytes: new TextEncoder().encode("new bytes") },
      ctx,
    );
    expect(s3.objects.size).toBe(1);
    expect(new TextDecoder().decode(await store.get(fresh.id, ctx))).toBe("new bytes");
    await expect(store.get("missing-everywhere", ctx)).rejects.toBeInstanceOf(
      ArtifactNotFoundError,
    );

    await store.remove(old.id, ctx);
    await expect(legacy.get(old.id, ctx)).rejects.toThrow();
  });

  it("reads a legacy file into a local file as well", async () => {
    const dataDir = await tmp();
    const s3 = await fakeS3();
    const legacy = new LocalArtifactStore(dataDir);
    const old = await legacy.put(
      { name: "old.txt", mimeType: "text/plain", bytes: new TextEncoder().encode("legacy bytes") },
      ctx,
    );
    const store = new LocalFallbackArtifactStore(s3.store, legacy);
    const target = path.join(await tmp(), "out");
    await store.getFile(old.id, target, ctx);
    expect(await readFile(target, "utf8")).toBe("legacy bytes");
  });
});

describe("S3 file upload", () => {
  it("sends a small file in one request and a large file as multipart parts", async () => {
    const s3 = await fakeS3();
    const dir = await tmp();
    const small = path.join(dir, "small");
    await writeFile(small, "tiny");
    const smallStored = await s3.store.putFile({ path: small, name: "s", mimeType: "x/y" }, ctx);
    expect(smallStored.hash).toHaveLength(64);

    const big = path.join(dir, "big");
    const bytes = Buffer.alloc(8 * 1024 * 1024 * 2 + 123, 7);
    await writeFile(big, bytes);
    const bigStored = await s3.store.putFile({ path: big, name: "b", mimeType: "x/y" }, ctx);
    expect(s3.seen.filter((line) => line.includes("partNumber")).length).toBe(3);
    const back = path.join(dir, "back");
    await s3.store.getFile(bigStored.id, back, ctx);
    expect((await readFile(back)).equals(bytes)).toBe(true);
  });
});
