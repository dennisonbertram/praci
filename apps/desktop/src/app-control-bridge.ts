import type { ChildProcess } from "node:child_process";
import { execFileSync, spawn as nodeSpawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { APP_CONTROL_KEYS, isDeniedApp } from "@rakazo/contracts";

/**
 * Loopback bridge that lets the managed local stack run `agent-desktop` on this Mac
 * (docs/local-desktop-control). The API adapter calls it over HTTP with a per-launch
 * bearer token; the bridge re-checks every command before spawning anything.
 */

const MAX_BODY_BYTES = 64 * 1024;
const MAX_ARGV = 64;
const MAX_ARG_CHARS = 8192;
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const MIN_TIMEOUT_MS = 1;
const MAX_TIMEOUT_MS = 60_000;

const ALLOWED_COMMANDS = new Set([
  "snapshot",
  "get",
  "list-apps",
  "list-windows",
  "list-surfaces",
  "launch",
  "click",
  "type",
  "set-value",
  "clear",
  "select",
  "toggle",
  "check",
  "uncheck",
  "expand",
  "collapse",
  "scroll",
  "scroll-to",
  "focus",
  "press",
  "status",
  "permissions",
  "version",
]);

// Escape hatches: forced shortcuts, files written by the tool, tracing, raw coordinates,
// launching an app with arguments/environment/working directory.
const REFUSED_FLAGS = [
  "--force",
  "--screenshot",
  "--trace",
  "--trace-strict",
  "--debug",
  "--verbose",
  "--xy",
  "--arg",
  "--env",
  "--cwd",
  "--cdp",
  "--agent-id",
];

const ALLOWED_SURFACES = new Set(["window", "focused", "sheet", "popover", "alert", "menu"]);
const ALLOWED_PROPERTIES = new Set(["title", "text", "value", "role", "states"]);
const SESSION_ID = /^r[0-9a-f]{24}$/;
const KEYS: readonly string[] = APP_CONTROL_KEYS;
// agent-desktop strips Unicode bidi/format characters when matching app names, so a value
// holding any of them could resolve to a denied app while passing a raw-string check.
const HIDDEN_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

/** Same lists as the API adapter. The bridge only has one string, so it is both id and name. */
export function isDeniedAppValue(value: string): boolean {
  return isDeniedApp({ id: value, name: value });
}

function appValueRefusal(value: string): string | null {
  if (HIDDEN_CHARS.test(value) || value !== value.trim()) return "app not allowed";
  return isDeniedAppValue(value) ? "app not allowed" : null;
}

/** Returns why the command is refused, or null when it may run. */
export function refuseArgv(argv: string[]): string | null {
  const [command] = argv;
  if (command === undefined || !ALLOWED_COMMANDS.has(command)) return "command not allowed";
  if (command === "permissions" && argv.length !== 1) return "permissions takes no flags";
  // Everything after the first "--" is data (typed text, names): it is not scanned for flags.
  const dashes = argv.indexOf("--");
  const flags = dashes === -1 ? argv : argv.slice(0, dashes);
  let hasApp = false;
  let property: string | null = null;
  for (let i = 1; i < flags.length; i += 1) {
    const arg = flags[i] as string;
    if (arg === "-v" || REFUSED_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`))) {
      return "flag not allowed";
    }
    if (/^--(app|surface|session|window-id|property)=/.test(arg)) return "use a separate value";
    if (["--app", "--surface", "--session", "--window-id", "--property"].includes(arg)) {
      const value = flags[i + 1];
      if (value === undefined) return "missing value";
      if (arg === "--surface" && !ALLOWED_SURFACES.has(value)) return "surface not allowed";
      if (arg === "--session" && !SESSION_ID.test(value)) return "session not allowed";
      if (arg === "--property") {
        if (!ALLOWED_PROPERTIES.has(value)) return "property not allowed";
        property = value;
      }
      if (arg === "--window-id" && (HIDDEN_CHARS.test(value) || value !== value.trim())) {
        return "window not allowed";
      }
      if (arg === "--app") {
        hasApp = true;
        const refusal = appValueRefusal(value);
        if (refusal !== null) return refusal;
      }
      i += 1;
    }
  }
  if (command === "launch") {
    const target = argv[1];
    if (target === undefined || target.startsWith("-")) return "app not allowed";
    const refusal = appValueRefusal(target);
    if (refusal !== null) return refusal;
  }
  if (command === "get" && property === null) return "get needs a property";
  // Without --app these read whichever app is focused, which may be a denied one.
  if (["snapshot", "list-windows", "list-surfaces"].includes(command) && !hasApp) {
    return "needs an app";
  }
  if (command === "press") {
    const combo = argv[1];
    if (combo === undefined || !KEYS.includes(combo)) return "key not allowed";
    if (!hasApp) return "press needs an app";
  }
  return null;
}

/** Directories where a user-installed CLI usually lives when the app was started from Finder. */
function candidateBinDirs(env: NodeJS.ProcessEnv): string[] {
  const dirs = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  dirs.push("/opt/homebrew/bin", "/usr/local/bin", path.join(homedir(), ".local", "bin"));
  const nvm = path.join(homedir(), ".nvm", "versions", "node");
  try {
    for (const version of readdirSync(nvm)) dirs.push(path.join(nvm, version, "bin"));
  } catch {
    // no nvm
  }
  return dirs;
}

export function findAgentDesktop(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const dir of candidateBinDirs(env)) {
    const file = path.join(dir, "agent-desktop");
    if (existsSync(file)) return file;
  }
  return null;
}

/**
 * Stops the command-host processes that use this TMPDIR. The CLI starts one host per
 * TMPDIR and detaches it (parent pid 1, 15 idle minutes), so killing the CLI child does
 * not stop it. Each host's environment carries AGENT_DESKTOP_INTERNAL_HOST_SOCKET=<TMPDIR>/...,
 * which `ps eww` shows for processes of the same user.
 */
export function killCommandHosts(tmpDir: string): void {
  let out: string;
  try {
    out = execFileSync("ps", ["eww", "-axo", "pid=,command="], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return;
  }
  const marker = `AGENT_DESKTOP_INTERNAL_HOST_SOCKET=${tmpDir}${path.sep}`;
  for (const line of out.split("\n")) {
    if (!line.includes(marker)) continue;
    const pid = Number.parseInt(line.trim().split(/\s+/, 1)[0] ?? "", 10);
    if (Number.isInteger(pid) && pid > 1) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  }
}

export interface AppControlBridgeOptions {
  userDataDir: string;
  /** Reuse these so a relaunched app serves the address running containers already hold. */
  port?: number;
  token?: string;
  spawn?: typeof nodeSpawn;
  findBinary?: () => string | null;
  killHosts?: (tmpDir: string) => void | Promise<void>;
  /** Where the private TMPDIR is created; defaults to /tmp (short path, see below). */
  tmpRoot?: string;
}

export interface AppControlBridge {
  port: number;
  token: string;
  close(): Promise<void>;
}

interface Envelope {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function tokenMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from((header ?? "").replace(/^Bearer /, ""));
  const wanted = Buffer.from(token);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function startAppControlBridge(
  options: AppControlBridgeOptions,
): Promise<AppControlBridge> {
  const spawn = options.spawn ?? nodeSpawn;
  const findBinary = options.findBinary ?? (() => findAgentDesktop());
  const killHosts = options.killHosts ?? killCommandHosts;
  const token = options.token ?? randomBytes(32).toString("base64url");
  // ponytail: a short /tmp path on purpose. The command host's unix socket path
  // (<TMPDIR>/agent-desktop-host-501/<16 hex>.sock) must stay under ~104 bytes; userData
  // ("Application Support") and the macOS per-user temp dir both exceed that.
  const tmpDir = mkdtempSync(path.join(options.tmpRoot ?? "/tmp", "praci-ac-"));
  const homeDir = path.join(options.userDataDir, "app-control", "home");
  mkdirSync(homeDir, { recursive: true, mode: 0o700 });

  const active = new Map<ChildProcess, Promise<void>>();
  let resetting: Promise<void> | null = null;

  const killGroup = (child: ChildProcess) => {
    try {
      if (child.pid) process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  };

  /**
   * Kills every running command, then the command hosts, then recreates the TMPDIR.
   * New requests wait for it (see run), so nothing spawns against a half-reset directory.
   */
  const reset = (): Promise<void> => {
    resetting ??= (async () => {
      for (const child of active.keys()) killGroup(child);
      await Promise.all(active.values());
      await killHosts(tmpDir);
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { mode: 0o700 });
    })().finally(() => {
      resetting = null;
    });
    return resetting;
  };

  const run = async (argv: string[], timeoutMs: number): Promise<Envelope> => {
    while (resetting) await resetting.catch(() => undefined);
    return new Promise((resolve) => {
      const binary = findBinary();
      if (binary === null) {
        resolve({ exitCode: 127, stdout: "", stderr: "agent-desktop not found" });
        return;
      }
      const env = {
        PATH: [
          path.dirname(binary),
          "/opt/homebrew/bin",
          "/usr/local/bin",
          "/usr/bin",
          "/bin",
        ].join(path.delimiter),
        HOME: homedir(),
        TMPDIR: tmpDir,
        AGENT_DESKTOP_HOME: homeDir,
      };
      const child = spawn(binary, argv, {
        shell: false,
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const exited = new Promise<void>((done) => {
        child.once("close", () => done());
        child.once("error", () => done());
      });
      active.set(child, exited);
      void exited.then(() => active.delete(child));
      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let settled = false;
      let timedOut = false;
      const finish = (envelope: Envelope) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(envelope);
      };
      const timer = setTimeout(() => {
        timedOut = true;
        killGroup(child);
        // Killing the client does not stop agent-desktop's command host, which could still
        // act on the request, so answer only after the hosts are gone too.
        void reset()
          .catch(() => undefined)
          .then(() => finish({ exitCode: 124, stdout: "", stderr: "timed out" }));
      }, timeoutMs);
      child.stdout?.on("data", (chunk: Buffer) => {
        if (stdout.length < MAX_STDOUT_BYTES) stdout = Buffer.concat([stdout, chunk]);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < MAX_STDERR_BYTES) stderr = Buffer.concat([stderr, chunk]);
      });
      child.on("error", () =>
        finish({ exitCode: 127, stdout: "", stderr: "agent-desktop not found" }),
      );
      child.on("close", (code) => {
        if (timedOut) return;
        finish({
          exitCode: code ?? 1,
          stdout: stdout.subarray(0, MAX_STDOUT_BYTES).toString("utf8"),
          stderr: stderr.subarray(0, MAX_STDERR_BYTES).toString("utf8"),
        });
      });
    });
  };

  const server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST") return send(405, { error: "method not allowed" });
    if (!tokenMatches(req.headers.authorization, token))
      return send(401, { error: "unauthorized" });
    const route = req.url;
    if (route !== "/v1/agent-desktop" && route !== "/v1/reset")
      return send(404, { error: "not found" });

    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) tooBig = true;
      else chunks.push(chunk);
    });
    req.on("end", async () => {
      if (tooBig) return send(413, { error: "body too large" });
      if (route === "/v1/reset") {
        await reset();
        return send(200, { ok: true });
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return send(400, { error: "invalid json" });
      }
      const { argv, timeoutMs } = (body ?? {}) as { argv?: unknown; timeoutMs?: unknown };
      if (
        !Array.isArray(argv) ||
        argv.length === 0 ||
        argv.length > MAX_ARGV ||
        !argv.every((a) => typeof a === "string" && a.length <= MAX_ARG_CHARS) ||
        typeof timeoutMs !== "number" ||
        !Number.isFinite(timeoutMs)
      ) {
        return send(400, { error: "invalid request" });
      }
      const refusal = refuseArgv(argv as string[]);
      if (refusal !== null) return send(400, { error: refusal });
      const clamped = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(timeoutMs)));
      send(200, await run(argv as string[], clamped));
    });
  });

  const listen = (port: number) =>
    new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
  // A saved port that is taken falls back to a new one; the caller saves whatever bound.
  await listen(options.port ?? 0).catch(() => (options.port ? listen(0) : Promise.reject()));
  const { port } = server.address() as AddressInfo;

  return {
    port,
    token,
    close: async () => {
      for (const child of active.keys()) killGroup(child);
      void killHosts(tmpDir);
      rmSync(tmpDir, { recursive: true, force: true });
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
