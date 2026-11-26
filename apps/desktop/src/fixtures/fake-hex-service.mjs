// Fake `hex service --embedded` for device-speech tests. Speaks the @kitlangton/hex API 2 embedded
// handshake: one JSON "ready" line on stdout, then bearer-authenticated loopback HTTP. Exits when
// stdin ends. FAKE_HEX_MODE: ok | hang | hangprepare | crash | download. FAKE_HEX_PID_FILE records each pid;
// FAKE_HEX_CRASH_MARKER makes crash mode crash only the first time (the marker file is created).
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const TOKEN = "FAKE-TOKEN-xyz";
const mode = process.env.FAKE_HEX_MODE ?? "ok";

if (process.env.FAKE_HEX_PID_FILE)
  appendFileSync(process.env.FAKE_HEX_PID_FILE, `${process.pid}\n`);

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`)
    return json(res, 401, { code: "unauthorized" });
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "POST" && /^\/models\/[a-z0-9_]+\/prepare$/.test(url.pathname)) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    if (mode === "hangprepare") return res.write(": waiting\n\n");
    const events = [
      ...(mode === "download"
        ? [
            { type: "downloading", downloadedBytes: 50, totalBytes: 100 },
            { type: "downloading", downloadedBytes: 100, totalBytes: 100 },
          ]
        : []),
      { type: "verifying" },
      { type: "loading" },
      { type: "ok" },
    ];
    for (const event of events) res.write(`data: ${JSON.stringify(event)}\n\n`);
    return res.end();
  }
  if (req.method === "POST" && url.pathname === "/transcriptions") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (mode === "hang") return;
      const marker = process.env.FAKE_HEX_CRASH_MARKER;
      if (mode === "crash" && (!marker || !existsSync(marker))) {
        if (marker) writeFileSync(marker, "crashed");
        process.exit(1);
      }
      const bytes = Buffer.concat(chunks).length;
      json(res, 200, { transcript: `heard ${bytes} bytes`, durationMs: 1000 });
    });
    return;
  }
  json(res, 404, { code: "not_found" });
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  process.stdout.write(
    `${JSON.stringify({ type: "ready", apiVersion: "2", url: `http://127.0.0.1:${port}`, token: TOKEN, pid: process.pid })}\n`,
  );
});
process.stdin.on("end", () => process.exit(0));
process.stdin.resume();
