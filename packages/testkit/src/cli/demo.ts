import { execFileSync, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { loadOrCreateCredentials } from "./demo/credentials.js";
import { demoFinance, demoMailboxes } from "./demo/data.js";
import {
  assertDemoContainer,
  assertStateSlot,
  type ContainerInfo,
  childEnv,
  DEMO_LABEL,
  SLOT_LABEL,
  slotConfig,
  stateDir,
} from "./demo/safety.js";
import { seedDemo } from "./demo/seed.js";

/**
 * `pnpm demo:up` / `pnpm demo:down`: an isolated, mock-data Rakazo stack for UX testers.
 * The API runs in this repo's e2e wiring (every emulator, canned Mercury and Brex tools), on
 * its own Postgres container and ports, and one demo account is seeded. `serve` is the API
 * process `up` starts; it is not meant to be run by hand.
 */

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const CREDENTIALS = path.join(ROOT, ".demo-credentials.local");
const {
  slot: SLOT,
  container: CONTAINER,
  pgPort: PG_PORT,
  apiPort: API_PORT,
  webPort: WEB_PORT,
} = slotConfig(process.env.DEMO_SLOT);
const DIR = stateDir(ROOT, SLOT);
const STATE = path.join(DIR, "state.json");
const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const DATABASE_URL = `postgres://rakazo_demo:rakazo_demo@127.0.0.1:${PG_PORT}/rakazo_demo`;
const MODEL_KEYS = ["OPENROUTER_API_KEY", "ANTHROPIC_API_KEY"];

interface State {
  slot: number;
  pids: number[];
  containerId?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function healthy(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2_000) })).ok;
  } catch {
    return false;
  }
}

async function waitFor(what: string, check: () => Promise<boolean>, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${what}. Logs are in ${DIR}`);
}

function docker(...args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Model-provider keys come from this process's environment or the dev checkout's .env; never written anywhere. */
function modelEnv(): NodeJS.ProcessEnv {
  const found: Record<string, string> = {};
  const devEnv = path.join(homedir(), "develop/rakazo/.env");
  const lines = existsSync(devEnv) ? readFileSync(devEnv, "utf8").split("\n") : [];
  for (const key of MODEL_KEYS) {
    const fromFile = lines.find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1);
    const value = process.env[key] || fromFile?.trim().replace(/^["']|["']$/g, "");
    if (value) found[key] = value;
  }
  if (!found.OPENROUTER_API_KEY && found.ANTHROPIC_API_KEY) found.PI_DEFAULT_PROVIDER = "anthropic";
  return { ...found, AGENT_RUNTIME: Object.keys(found).length ? "pi" : "scripted" };
}

/** The environment the demo API and its seeding run with. Throwaway values for a local stack. */
function stackEnv(): NodeJS.ProcessEnv {
  return childEnv(process.env, {
    NODE_ENV: "development",
    DEMO_SLOT: String(SLOT),
    DATABASE_URL,
    REALTIME_DATABASE_URL: DATABASE_URL,
    WAKEUP_DRIVER: "memory",
    SANDBOX_PROVIDER: "fake",
    TICKET_BOARD_ENABLED: "true",
    CLOUD_AGENT_PROVIDER: "emulator",
    COMPOSIO_API_KEY: "",
    BETTER_AUTH_SECRET: "demo-secret-demo-secret-32chars!!",
    ENCRYPTION_KEY: "demo-encryption-key-demo-encryption-key",
    SANDBOX_SUPERVISOR_TOKEN: "demo-supervisor-token-demo-32chars",
    SCREEN_PROXY_SECRET: "demo-screen-proxy-secret-demo-32chars",
    BETTER_AUTH_URL: WEB_ORIGIN,
    WEB_ORIGIN,
    API_PORT: String(API_PORT),
    API_URL,
    API_PROXY_TARGET: API_URL,
    WEB_PORT: String(WEB_PORT),
    DATA_DIR: path.join(DIR, "data"),
    SIGNUPS_ENABLED: "true",
    SIGNUP_ALLOWLIST: "",
    VITE_DEFAULT_UI_LOCALE: "en",
    ...modelEnv(),
  });
}

function start(name: string, script: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const log = openSync(path.join(DIR, `${name}.log`), "a");
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  closeSync(log);
  return child.pid as number;
}

function ours(pid: number): boolean {
  try {
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).includes(
      ROOT,
    );
  } catch {
    return false;
  }
}

/** Removes the demo's container; refuses one that lacks the demo label or is not the recorded one. */
function removeContainer(recordedId?: string) {
  let info: ContainerInfo | null = null;
  try {
    const [id, labels] = JSON.parse(
      docker("inspect", "-f", "[{{json .Id}},{{json .Config.Labels}}]", CONTAINER),
    );
    info = { id, labels };
  } catch {}
  assertDemoContainer(info, recordedId, SLOT);
  if (info) docker("rm", "-f", "-v", info.id);
}

async function down() {
  const state: State | null = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
  assertStateSlot(state, SLOT);
  for (const pid of state?.pids ?? []) {
    if (!ours(pid)) continue;
    try {
      process.kill(-pid, "SIGTERM");
    } catch {}
  }
  await sleep(1_500);
  for (const pid of state?.pids ?? []) {
    if (!ours(pid)) continue;
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
  }
  removeContainer(state?.containerId);
  // Slot 0's directory also holds the other slots' `slot-N/` directories; leave those alone.
  for (const entry of existsSync(DIR) ? readdirSync(DIR) : [])
    if (SLOT !== 0 || !entry.startsWith("slot-"))
      rmSync(path.join(DIR, entry), { recursive: true, force: true });
  if (SLOT !== 0 || !existsSync(DIR) || readdirSync(DIR).length === 0)
    rmSync(DIR, { recursive: true, force: true });
  console.log("Demo stack stopped; its database and local files are removed.");
}

function printInfo(email: string) {
  console.log(`
Mock demo stack is running (slot ${SLOT}). Every record in it is invented and labeled MOCK.
  Web:          ${WEB_ORIGIN}
  API:          ${API_URL}
  Postgres:     127.0.0.1:${PG_PORT} (${CONTAINER})
  Sign in as:   ${email}
  Login file:   ${CREDENTIALS}
  Logs:         ${DIR}/api.log, ${DIR}/web.log
Stop and delete it with: ${SLOT ? `DEMO_SLOT=${SLOT} ` : ""}pnpm demo:down`);
}

async function up() {
  if (existsSync(STATE)) {
    if ((await healthy(`${API_URL}/health`)) && (await healthy(WEB_ORIGIN))) {
      printInfo(readFileSync(CREDENTIALS, "utf8").match(/^email=(.*)$/m)?.[1] ?? "");
      return;
    }
    await down();
  }
  for (const port of [PG_PORT, API_PORT, WEB_PORT]) {
    if (await portInUse(port))
      throw new Error(`Port ${port} is already in use; the demo needs it free.`);
  }
  mkdirSync(DIR, { recursive: true });
  const env = stackEnv();
  const pids: number[] = [];
  try {
    removeContainer();
    const containerId = docker(
      "run",
      "-d",
      "--name",
      CONTAINER,
      "--label",
      `${DEMO_LABEL}=1`,
      "--label",
      `${SLOT_LABEL}=${SLOT}`,
      "-p",
      `127.0.0.1:${PG_PORT}:5432`,
      "-e",
      "POSTGRES_USER=rakazo_demo",
      "-e",
      "POSTGRES_PASSWORD=rakazo_demo",
      "-e",
      "POSTGRES_DB=rakazo_demo",
      "pgvector/pgvector:pg16-trixie",
    ).trim();
    writeFileSync(STATE, JSON.stringify({ slot: SLOT, pids, containerId } satisfies State));
    await waitFor("Postgres", async () => {
      try {
        docker(
          "exec",
          CONTAINER,
          "psql",
          "-h",
          "127.0.0.1",
          "-U",
          "rakazo_demo",
          "-d",
          "rakazo_demo",
          "-tAc",
          "select 1",
        );
        return true;
      } catch {
        return false;
      }
    });
    const run = (command: string, args: string[], cwd = ROOT) =>
      execFileSync(command, args, { cwd, env, stdio: "inherit" });
    run("pnpm", ["--filter", "@rakazo/db", "generate"]);
    run("pnpm", ["--filter", "@rakazo/db", "exec", "prisma", "migrate", "deploy"]);

    const require = createRequire(import.meta.url);
    pids.push(
      start(
        "api",
        require.resolve("tsx/cli"),
        [path.join(ROOT, "packages/testkit/src/cli/demo.ts"), "serve"],
        ROOT,
        env,
      ),
    );
    writeFileSync(STATE, JSON.stringify({ slot: SLOT, pids, containerId } satisfies State));
    await waitFor("the API", () => healthy(`${API_URL}/health`));

    const webDir = path.join(ROOT, "apps/web");
    const vite = path.join(webDir, "node_modules/vite/bin/vite.js");
    pids.push(start("web", vite, [], webDir, env));
    writeFileSync(STATE, JSON.stringify({ slot: SLOT, pids, containerId } satisfies State));
    await waitFor("the web app", () => healthy(WEB_ORIGIN));

    const { email, password } = loadOrCreateCredentials(CREDENTIALS);
    const done = await seedDemo({
      apiUrl: API_URL,
      webOrigin: WEB_ORIGIN,
      databaseUrl: DATABASE_URL,
      encryptionKey: env.ENCRYPTION_KEY as string,
      email,
      password,
    });
    console.log(`Seeded: ${done.join("; ")}`);
    console.log(
      `Agent runtime: ${env.AGENT_RUNTIME === "pi" ? "pi with a model key from your environment" : "scripted (no model key found)"}`,
    );
    printInfo(email);
  } catch (error) {
    await down();
    throw error;
  }
}

async function serve() {
  const { serve: listen } = await import("@hono/node-server");
  const { createEmulatedApp } = await import("./emulated-app.js");
  const { createE2eComposio } = await import("./e2e-mail.js");
  const { handles } = await createEmulatedApp(process.env.DATABASE_URL as string, {
    composio: createE2eComposio(demoMailboxes),
    financeCallToolFor: demoFinance().callToolFor,
  });
  const server = listen({ fetch: handles.app.fetch, port: API_PORT, hostname: "127.0.0.1" });
  const stop = () => void handles.stop().finally(() => server.close(() => process.exit(0)));
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

const command = process.argv[2];
const main = { up, down, serve }[command as "up" | "down" | "serve"];
if (!main) throw new Error("Usage: demo.ts up | down");
await main();
