import type { Server } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** A tiny in-memory S3 with multipart uploads, aborts and ranged reads, for store tests. */
export async function startFakeS3() {
  const objects = new Map<string, Buffer>();
  const uploads = new Map<string, { key: string; parts: Map<number, Buffer> }>();
  const seen: string[] = [];
  let nextUpload = 0;
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url ?? "/", "http://x");
    const q = url.searchParams;
    seen.push(`${req.method} ${url.pathname}${url.search ? "?" : ""}${[...q.keys()].join("&")}`);
    const upload = q.get("uploadId") ? uploads.get(q.get("uploadId") as string) : undefined;
    if (req.method === "POST" && q.has("uploads")) {
      const id = `u${++nextUpload}`;
      uploads.set(id, { key: url.pathname, parts: new Map() });
      res.end(
        `<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`,
      );
    } else if (req.method === "PUT" && q.has("partNumber")) {
      if (!upload) {
        res.statusCode = 404;
        res.end("<Error><Code>NoSuchUpload</Code></Error>");
        return;
      }
      upload.parts.set(Number(q.get("partNumber")), body);
      res.setHeader("etag", `"part${q.get("partNumber")}"`);
      res.end();
    } else if (req.method === "POST" && upload) {
      objects.set(
        url.pathname,
        Buffer.concat(
          [...upload.parts.keys()].sort((a, b) => a - b).map((n) => upload.parts.get(n) as Buffer),
        ),
      );
      uploads.delete(q.get("uploadId") as string);
      res.end("<CompleteMultipartUploadResult/>");
    } else if (req.method === "DELETE" && q.has("uploadId")) {
      uploads.delete(q.get("uploadId") as string);
      res.statusCode = 204;
      res.end();
    } else if (req.method === "PUT") {
      objects.set(url.pathname, body);
      res.end();
    } else if (req.method === "GET") {
      const found = objects.get(url.pathname);
      if (!found) {
        res.statusCode = 404;
        res.end("<Error><Code>NoSuchKey</Code></Error>");
        return;
      }
      const range = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ""));
      if (range) {
        res.statusCode = 206;
        res.end(found.subarray(Number(range[1]), Number(range[2]) + 1));
      } else {
        res.end(found);
      }
    } else {
      objects.delete(url.pathname);
      res.statusCode = 204;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    objects,
    uploads,
    seen,
    config: {
      endpoint,
      bucket: "rakazo",
      region: "us-east-1",
      accessKeyId: "access-key-1",
      secretAccessKey: "secret-key-1",
      forcePathStyle: true,
      prefix: "",
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
