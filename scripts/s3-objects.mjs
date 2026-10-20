#!/usr/bin/env node
// Backs up and restores every object under the configured S3 settings (RAKAZO_S3_*), with no
// dependencies beyond Node. Usage: s3-objects.mjs backup|restore <backup-dir> [--dotenv <path>]
//
// backup writes <backup-dir>/objects/<key> and <backup-dir>/objects.manifest.json (key, size, etag).
// restore PUTs every manifest key back and verifies the bucket afterwards. It never deletes.
// With no object storage configured, backup writes nothing and exits 0; restore does the same
// only when the backup has no manifest. Credentials are never printed or written to the manifest.
// ponytail: single-PUT restore caps an object at 5 GiB; add multipart if larger objects appear.
import { createHash, createHmac } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const [mode, backupDir, ...rest] = process.argv.slice(2);
if (!["backup", "restore"].includes(mode) || !backupDir) {
  console.error("usage: s3-objects.mjs backup|restore <backup-dir> [--dotenv <path>]");
  process.exit(2);
}
const fail = (message) => {
  console.error(`s3-objects: ${message}`);
  process.exit(1);
};

// Settings: the environment wins; --dotenv only fills RAKAZO_S3_* names that are unset.
const env = { ...process.env };
const envFile = rest[rest.indexOf("--dotenv") + 1];
if (rest.includes("--dotenv") && envFile && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = /^\s*(?:export\s+)?(RAKAZO_(?:BACKUP_)?S3_[A-Z_]+)=(.*)$/.exec(line);
    if (match && !env[match[1]]) env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}
const value = (name) => env[name]?.trim() ?? "";
if (!Object.keys(env).some((name) => name.startsWith("RAKAZO_S3_") && value(name))) {
  if (mode === "restore" && existsSync(path.join(backupDir, "objects.manifest.json"))) {
    fail("this backup contains objects but no object storage is configured");
  }
  console.log("No object storage configured; skipping objects");
  process.exit(0);
}
for (const name of [
  "RAKAZO_S3_ENDPOINT",
  "RAKAZO_S3_BUCKET",
  "RAKAZO_S3_ACCESS_KEY_ID",
  "RAKAZO_S3_SECRET_ACCESS_KEY",
]) {
  if (!value(name)) fail(`${name} is required when object storage is configured`);
}
// The bundled store is not published on the host; RAKAZO_BACKUP_S3_ENDPOINT reaches it from here.
const endpoint = new URL(value("RAKAZO_BACKUP_S3_ENDPOINT") || value("RAKAZO_S3_ENDPOINT"));
const bucket = value("RAKAZO_S3_BUCKET");
const region = value("RAKAZO_S3_REGION") || "us-east-1";
const accessKeyId = value("RAKAZO_S3_ACCESS_KEY_ID");
const secretAccessKey = value("RAKAZO_S3_SECRET_ACCESS_KEY");
const pathStyle =
  /^(1|true|yes)$/i.test(value("RAKAZO_S3_FORCE_PATH_STYLE")) || bucket.includes(".");
const prefix = value("RAKAZO_S3_PREFIX").replace(/^\/+|\/+$/g, "");

const enc = (s) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

/** Signed S3 request (SigV4, unsigned payload); resolves with the response stream. */
function send(method, key, query = {}, body = null, length = 0) {
  const root = endpoint.pathname.replace(/\/+$/, "");
  const objectPath = key ? `/${key.split("/").map(enc).join("/")}` : "/";
  const host = pathStyle ? endpoint.host : `${bucket}.${endpoint.host}`;
  const uri = pathStyle ? `${root}/${bucket}${key ? objectPath : ""}` : `${root}${objectPath}`;
  const qs = Object.keys(query)
    .sort()
    .map((k) => `${enc(k)}=${enc(query[k])}`)
    .join("&");
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const headers = { host, "x-amz-content-sha256": "UNSIGNED-PAYLOAD", "x-amz-date": amzDate };
  const names = Object.keys(headers).sort();
  const canonical = [
    method,
    uri,
    qs,
    names.map((n) => `${n}:${headers[n]}\n`).join(""),
    names.join(";"),
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonical).digest("hex"),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), "s3"),
    "aws4_request",
  );
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${createHmac("sha256", signingKey).update(toSign).digest("hex")}`;
  if (body) headers["content-length"] = String(length);
  return new Promise((resolve, reject) => {
    const client = endpoint.protocol === "https:" ? https : http;
    const request = client.request(
      {
        method,
        host: endpoint.hostname,
        port: endpoint.port || undefined,
        path: qs ? `${uri}?${qs}` : uri,
        headers,
      },
      resolve,
    );
    // Transport errors can carry the URL or headers; report none of them.
    request.on("error", () => reject(new Error("request failed")));
    if (Buffer.isBuffer(body)) request.end(body);
    else if (body) pipeline(body, request).catch(() => request.destroy());
    else request.end();
  });
}

async function text(response) {
  let data = "";
  for await (const chunk of response) data += chunk;
  return data;
}

async function check(op, response) {
  if (response.statusCode >= 200 && response.statusCode < 300) return response;
  const code = /<Code>([A-Za-z]+)<\/Code>/.exec(await text(response))?.[1];
  throw new Error(`${op} failed with status ${response.statusCode}${code ? ` (${code})` : ""}`);
}

const unxml = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Lists keys with size and etag, a page at a time. */
async function list() {
  const out = [];
  let token = "";
  do {
    const query = {
      "list-type": "2",
      ...(prefix ? { prefix: `${prefix}/` } : {}),
      ...(token ? { "continuation-token": token } : {}),
    };
    const xml = await text(await check("list", await send("GET", "", query)));
    for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
      const tag = (name) =>
        unxml(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? "");
      out.push({ key: tag("Key"), size: Number(tag("Size")), etag: tag("ETag").replace(/"/g, "") });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? unxml(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "")
      : "";
  } while (token);
  return out;
}

/** Local path for a key; a trailing slash marks an empty folder object. */
function local(key) {
  const parts = key.split("/");
  if (
    !key ||
    key.startsWith("/") ||
    parts.some((p, i) => p === ".." || p === "." || (!p && i < parts.length - 1))
  ) {
    throw new Error("an object key cannot be stored as a file");
  }
  return path.join(backupDir, "objects", ...parts);
}

async function backup() {
  const entries = await list();
  const dir = path.join(backupDir, "objects");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  let bytes = 0;
  for (const entry of entries) {
    const file = local(entry.key);
    if (entry.key.endsWith("/")) {
      await mkdir(file, { recursive: true });
      continue;
    }
    await mkdir(path.dirname(file), { recursive: true });
    const response = await check("get", await send("GET", entry.key));
    const md5 = createHash("md5");
    let written = 0;
    response.on("data", (chunk) => {
      md5.update(chunk);
      written += chunk.length;
    });
    await pipeline(response, createWriteStream(file));
    if (written !== entry.size) throw new Error(`object size mismatch for ${entry.key}`);
    // A plain etag is the MD5 of the body; multipart etags (with a dash) cannot be compared.
    if (/^[0-9a-f]{32}$/.test(entry.etag) && md5.digest("hex") !== entry.etag) {
      throw new Error(`object checksum mismatch for ${entry.key}`);
    }
    bytes += written;
  }
  // Verify what is on disk against the manifest before declaring success.
  for (const entry of entries) {
    const info = await stat(local(entry.key));
    if (entry.key.endsWith("/") ? !info.isDirectory() : info.size !== entry.size) {
      throw new Error(`written file does not match the manifest for ${entry.key}`);
    }
  }
  await writeFile(
    path.join(backupDir, "objects.manifest.json"),
    `${JSON.stringify({ count: entries.length, bytes, objects: entries }, null, 1)}\n`,
    { mode: 0o600 },
  );
  console.log(`Backed up ${entries.length} objects (${bytes} bytes)`);
}

async function restore() {
  const manifestFile = path.join(backupDir, "objects.manifest.json");
  if (!existsSync(manifestFile)) {
    console.log("No objects in this backup; skipping objects");
    return;
  }
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  if (manifest.count !== manifest.objects.length)
    throw new Error("manifest count does not match its entries");
  for (const entry of manifest.objects) {
    const file = local(entry.key);
    const folder = entry.key.endsWith("/");
    const size = folder ? 0 : (await stat(file)).size;
    if (size !== entry.size)
      throw new Error(`backup file does not match the manifest for ${entry.key}`);
    await check(
      "put",
      await send("PUT", entry.key, {}, folder ? Buffer.alloc(0) : createReadStream(file), size),
    );
  }
  const found = new Map((await list()).map((o) => [o.key, o]));
  for (const entry of manifest.objects) {
    const now = found.get(entry.key);
    if (!now || now.size !== entry.size)
      throw new Error(`restored object is missing or wrong size: ${entry.key}`);
  }
  console.log(`Restored ${manifest.count} objects`);
}

try {
  await (mode === "backup" ? backup() : restore());
} catch (error) {
  fail(error instanceof Error ? error.message : "failed");
}
