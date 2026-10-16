// Opens every story from a built Storybook and fails on render errors.
// Usage: node .storybook/smoke.mjs [storybook-static] [file-path-filter]
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { insideRoot } from "./safe-path.mjs";

const root = resolve(process.argv[2] ?? "storybook-static");
const filter = process.argv[3];
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer((req, res) => {
  const path = insideRoot(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!path) return res.writeHead(403).end();
  const file = existsSync(path) && statSync(path).isDirectory() ? join(path, "index.html") : path;
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const entries = Object.values(
  JSON.parse(readFileSync(join(root, "index.json"), "utf8")).entries,
).filter((e) => e.type === "story" && (!filter || e.importPath.includes(filter)));
const browser = await chromium.launch();
const failures = [];
for (const entry of entries) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  await page.goto(`${base}/iframe.html?id=${entry.id}&viewMode=story`);
  await page.waitForTimeout(400);
  const empty = await page.evaluate(
    () => !document.querySelector("#storybook-root")?.innerHTML.trim(),
  );
  const shown = await page.evaluate(() => document.body.classList.contains("sb-show-errordisplay"));
  if (errors.length || empty || shown)
    failures.push({
      id: entry.id,
      file: entry.importPath,
      errors: errors.slice(0, 3),
      empty,
      shown,
    });
  await page.close();
}
await browser.close();
server.close();
console.log(`${entries.length - failures.length}/${entries.length} stories rendered cleanly`);
for (const f of failures) console.log(JSON.stringify(f));
process.exit(failures.length ? 1 : 0);
