import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Runs scripts/s3-objects.mjs against an in-memory stand-in for an S3 endpoint:
// just enough of ListObjectsV2, GET, and PUT for the real backup and restore
// script to run with fake credentials and no network or containers.
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const script = path.join(repoRoot, "scripts/s3-objects.mjs");
const bucket = "test-bucket";
const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise((resolve) => server.close(resolve));
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function fakeS3(objects: Map<string, Buffer>) {
  const server = createServer((request, response) => {
    const [rawPath, rawQuery = ""] = (request.url ?? "/").split("?", 2);
    // Keep the HTTP request target as sent. WHATWG URL normalizes literal dot
    // segments before the fixture sees them, unlike an S3 request target.
    const key = rawPath.slice(`/${bucket}/`.length).split("/").map(decodeURIComponent).join("/");
    if (request.method === "GET" && new URLSearchParams(rawQuery).get("list-type") === "2") {
      const entries = [...objects.entries()]
        .map(
          ([k, body]) =>
            `<Contents><Key>${xmlEscape(k)}</Key><Size>${body.length}</Size>` +
            `<ETag>"${createHash("md5").update(body).digest("hex")}"</ETag></Contents>`,
        )
        .join("");
      response.end(
        `<ListBucketResult>${entries}<IsTruncated>false</IsTruncated></ListBucketResult>`,
      );
      return;
    }
    if (request.method === "PUT") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        objects.set(key, Buffer.concat(chunks));
        response.end();
      });
      return;
    }
    const body = objects.get(key);
    if (request.method === "GET" && body) {
      response.end(body);
      return;
    }
    response.statusCode = 404;
    response.end("<Error><Code>NoSuchKey</Code></Error>");
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    objects,
    env: {
      RAKAZO_S3_ENDPOINT: `http://127.0.0.1:${port}`,
      RAKAZO_S3_BUCKET: bucket,
      RAKAZO_S3_ACCESS_KEY_ID: "fake-access-key",
      RAKAZO_S3_SECRET_ACCESS_KEY: "fake-secret-key",
      RAKAZO_S3_FORCE_PATH_STYLE: "true",
    },
  };
}

function run(mode: "backup" | "restore", dir: string, env: Record<string, string>) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, [script, mode, dir], { env });
      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => child.kill("SIGKILL"), 20_000);
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (status) => {
        clearTimeout(timeout);
        resolve({ status, stdout, stderr });
      });
    },
  );
}

function backupDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rakazo-s3-objects-"));
  temporaryDirectories.push(dir);
  return dir;
}

describe("s3-objects key-to-file mapping", () => {
  it("round trips ordinary keys with interior empty segments", async () => {
    const objects = new Map<string, Buffer>([
      ["deep//empty", Buffer.from("interior empty segment")],
      ["plain/a b.txt", Buffer.from("plain name")],
      ["folder/", Buffer.alloc(0)],
      ["payload/", Buffer.from("trailing slash object data")],
    ]);
    const s3 = await fakeS3(objects);
    const dir = backupDir();
    const backed = await run("backup", dir, s3.env);
    expect(backed.status, backed.stderr).toBe(0);

    const stored = path.join(dir, "objects");
    const fileFor = (key: string) =>
      path.join(stored, `${createHash("sha256").update(key, "utf8").digest("hex")}.object`);
    expect(readFileSync(fileFor("deep//empty"), "utf8")).toBe("interior empty segment");
    expect(readFileSync(fileFor("plain/a b.txt"), "utf8")).toBe("plain name");
    expect(readFileSync(fileFor("folder/"), "utf8")).toBe("");
    const manifest = JSON.parse(readFileSync(path.join(dir, "objects.manifest.json"), "utf8"));
    expect(manifest.objects.map((o: { key: string }) => o.key).sort()).toEqual(
      [...objects.keys()].sort(),
    );

    const expected = new Map(objects);
    objects.clear();
    const restored = await run("restore", dir, s3.env);
    expect(restored.status, restored.stderr).toBe(0);
    for (const [key, body] of expected) {
      expect(objects.get(key)?.equals(body), key).toBe(true);
    }
  });

  it("preserves literal dot segments using the raw signed HTTP request path", async () => {
    const objects = new Map<string, Buffer>([
      ["dots/../climb", Buffer.from("dot-dot segment")],
      ["dots/./here", Buffer.from("dot segment")],
      ["/leading", Buffer.from("leading slash")],
    ]);
    const s3 = await fakeS3(objects);
    const dir = backupDir();
    const backed = await run("backup", dir, s3.env);
    expect(backed.status, backed.stderr).toBe(0);
    const expected = new Map(objects);
    objects.clear();
    const restored = await run("restore", dir, s3.env);
    expect(restored.status, restored.stderr).toBe(0);
    for (const [key, body] of expected) expect(objects.get(key)?.equals(body), key).toBe(true);
  });

  it("stores NUL-containing keys without using them as filesystem paths", async () => {
    const s3 = await fakeS3(new Map([["a\0b", Buffer.from("nul byte")]]));
    const dir = backupDir();
    const result = await run("backup", dir, s3.env);
    expect(result.status, result.stderr).toBe(0);
    const filename = `${createHash("sha256").update("a\0b", "utf8").digest("hex")}.object`;
    expect(readFileSync(path.join(dir, "objects", filename), "utf8")).toBe("nul byte");
  });

  it("keeps keys with formerly colliding paths in distinct backup files", async () => {
    const s3 = await fakeS3(
      new Map([
        ["a//b", Buffer.from("encoded empty segment")],
        ["a/%2F/b", Buffer.from("literal segment")],
      ]),
    );
    const dir = backupDir();
    const result = await run("backup", dir, s3.env);
    expect(result.status, result.stderr).toBe(0);
    const first = `${createHash("sha256").update("a//b", "utf8").digest("hex")}.object`;
    const second = `${createHash("sha256").update("a/%2F/b", "utf8").digest("hex")}.object`;
    expect(readFileSync(path.join(dir, "objects", first), "utf8")).toBe("encoded empty segment");
    expect(readFileSync(path.join(dir, "objects", second), "utf8")).toBe("literal segment");
  });

  it("reads old key-shaped backups and rejects traversal in their manifests", async () => {
    const objects = new Map<string, Buffer>();
    const s3 = await fakeS3(objects);
    const dir = backupDir();
    const stored = path.join(dir, "objects", "plain");
    mkdirSync(stored, { recursive: true });
    writeFileSync(path.join(stored, "old.txt"), "legacy backup");
    writeFileSync(
      path.join(dir, "objects.manifest.json"),
      JSON.stringify({
        count: 1,
        bytes: 13,
        objects: [{ key: "plain/old.txt", size: 13, etag: "" }],
      }),
    );
    const restored = await run("restore", dir, s3.env);
    expect(restored.status, restored.stderr).toBe(0);
    expect(objects.get("plain/old.txt")?.toString()).toBe("legacy backup");

    writeFileSync(
      path.join(dir, "objects.manifest.json"),
      JSON.stringify({ count: 1, bytes: 1, objects: [{ key: "../outside", size: 1, etag: "" }] }),
    );
    const rejected = await run("restore", dir, s3.env);
    expect(rejected.status).not.toBe(0);
    expect(existsSync(path.join(dir, "outside"))).toBe(false);
  });

  it("restores legacy directory markers as empty objects despite directory size", async () => {
    const objects = new Map<string, Buffer>();
    const s3 = await fakeS3(objects);
    const dir = backupDir();
    const marker = path.join(dir, "objects", "folder");
    mkdirSync(path.join(marker, "child"), { recursive: true });
    writeFileSync(path.join(marker, "child", "object.txt"), "legacy child object");
    writeFileSync(
      path.join(dir, "objects.manifest.json"),
      JSON.stringify({ count: 1, bytes: 0, objects: [{ key: "folder/", size: 0, etag: "" }] }),
    );
    const restored = await run("restore", dir, s3.env);
    expect(restored.status, restored.stderr).toBe(0);
    expect(objects.get("folder/")).toEqual(Buffer.alloc(0));
  });
});
