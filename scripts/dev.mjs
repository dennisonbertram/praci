#!/usr/bin/env node
// `pnpm dev`: start the API, worker, web app, and sandbox supervisor for this checkout.
//
// Ports come from WEB_PORT, API_PORT and SUPERVISOR_PORT, in the shell or `.env`, exactly as
// configured. Only when none of them is set does this pick the first free block of ports, so
// a second checkout can run beside the first. The database is never touched here: it is
// whatever `.env` (or the shell) says, as before. Extra arguments go to turbo unchanged.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dotenv = createRequire(path.join(root, "packages/db/package.json"))("dotenv");

const DEFAULT_PORTS = { web: 5173, api: 3100, supervisor: 7091 };
const PORT_STEP = 10;
const SERVICES = ["@rakazo/api", "@rakazo/worker", "@rakazo/web", "@rakazo/sandbox-supervisor"];

const fileEnv = existsSync(path.join(root, ".env"))
  ? dotenv.parse(readFileSync(path.join(root, ".env")))
  : {};
const setting = (name) => process.env[name] ?? fileEnv[name];

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function chooseFreePorts() {
  for (let block = 0; block < 50; block += 1) {
    const ports = Object.fromEntries(
      Object.entries(DEFAULT_PORTS).map(([name, port]) => [name, port + block * PORT_STEP]),
    );
    if ((await Promise.all(Object.values(ports).map(portFree))).every(Boolean)) return ports;
  }
  throw new Error("No free port block found near the defaults. Set WEB_PORT and API_PORT in .env.");
}

const env = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" };

if (!["WEB_PORT", "API_PORT", "SUPERVISOR_PORT"].some(setting)) {
  const { web, api, supervisor } = await chooseFreePorts();
  const webUrl = `http://127.0.0.1:${web}`;
  const apiUrl = `http://127.0.0.1:${api}`;
  Object.assign(env, {
    WEB_PORT: String(web),
    WEB_ORIGIN: webUrl,
    BETTER_AUTH_URL: webUrl,
    API_PORT: String(api),
    API_URL: apiUrl,
    API_PROXY_TARGET: apiUrl,
    SUPERVISOR_PORT: String(supervisor),
    SANDBOX_SUPERVISOR_URL: `http://127.0.0.1:${supervisor}`,
  });
  process.stdout.write(`[dev] Open ${webUrl}\n`);
}

const turbo = spawn(
  "pnpm",
  ["exec", "turbo", "dev", ...SERVICES.map((name) => `--filter=${name}`), ...process.argv.slice(2)],
  { cwd: root, env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => turbo.kill(signal));
turbo.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
