import { spawn } from "node:child_process";
import { accessSync, chmodSync, constants, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { assertHostCommandsAllowed, killProcessTree } from "../desktop-sandbox.js";

export interface AgentDesktopRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AgentDesktopRunner {
  (
    argv: string[],
    options: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<AgentDesktopRunResult>;
  /** Stop host-side helpers left by a finished run. Best effort. */
  reset?: () => Promise<void>;
}

/** The agent-desktop binary is known to be absent (not just unreachable or failing). */
export class AgentDesktopNotInstalledError extends Error {
  constructor() {
    super("agent-desktop is not installed.");
    this.name = "AgentDesktopNotInstalledError";
  }
}

const MAX_STDOUT_BYTES = 2 * 1024 * 1024;
const MAX_STDERR_CHARS = 64 * 1024;
const BINARY_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];

function findBinary(env: NodeJS.ProcessEnv): string | undefined {
  const dirs = [...(env.PATH ?? "").split(path.delimiter), ...BINARY_DIRS].filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, "agent-desktop");
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Not in this directory.
    }
  }
  return undefined;
}

/**
 * Runs agent-desktop on this machine with no shell and a minimal environment. Only for
 * a process on the owner's Mac (development, tests, the desktop app).
 */
export function spawnAgentDesktopRunner(opts: {
  /** Private directory for agent-desktop state and temp files (created with mode 0700). */
  privateDir: string;
  binary?: string;
  env?: NodeJS.ProcessEnv;
}): AgentDesktopRunner {
  const source = opts.env ?? process.env;
  assertHostCommandsAllowed(source);
  // The command host listens on a unix socket under TMPDIR, so keep that path short.
  // ponytail: /tmp is POSIX only; macOS is the first platform.
  const tmpDir = mkdtempSync("/tmp/praci-ac-");
  const env = {
    PATH: source.PATH ?? "",
    HOME: source.HOME ?? "",
    TMPDIR: tmpDir,
    AGENT_DESKTOP_HOME: opts.privateDir,
  };
  const runner: AgentDesktopRunner = (argv, { timeoutMs, signal }) =>
    new Promise((resolve, reject) => {
      const binary = opts.binary ?? findBinary(source);
      if (!binary) return reject(new AgentDesktopNotInstalledError());
      mkdirSync(opts.privateDir, { recursive: true, mode: 0o700 });
      chmodSync(opts.privateDir, 0o700);
      const child = spawn(binary, argv, {
        env,
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      let bytes = 0;
      let stderr = "";
      let settled = false;
      const finish = (error: Error | undefined, exitCode = 0) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        if (error) {
          killProcessTree(child.pid);
          reject(error);
        } else {
          resolve({ exitCode, stdout: Buffer.concat(chunks).toString("utf8"), stderr });
        }
      };
      const abort = () => finish(new Error("agent-desktop was aborted."));
      const timer = setTimeout(
        () => finish(new Error(`agent-desktop timed out after ${timeoutMs} ms.`)),
        timeoutMs,
      );
      signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_STDOUT_BYTES) {
          return finish(new Error("agent-desktop output was too large."));
        }
        chunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (stderr.length < MAX_STDERR_CHARS) stderr += chunk.toString("utf8");
      });
      child.on("error", () => finish(new Error("agent-desktop could not be started.")));
      child.on("close", (code) => finish(undefined, code ?? 1));
      if (signal?.aborted) abort();
    });
  // A new TMPDIR makes the old command host's socket unreachable.
  runner.reset = async () => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  };
  return runner;
}

/**
 * Posts argv to the desktop app's loopback bridge. Wire contract (shared with
 * apps/desktop): POST {url}/v1/agent-desktop {argv, timeoutMs} -> 200 {exitCode, stdout,
 * stderr}; POST {url}/v1/reset ends the run's helpers. Bearer token on both.
 */
export function bridgeAgentDesktopRunner(opts: {
  url: string;
  token: string;
  fetch?: typeof fetch;
}): AgentDesktopRunner {
  const base = opts.url.replace(/\/+$/, "");
  const doFetch = opts.fetch ?? fetch;
  const post = async (route: string, body: unknown, timeoutMs: number, signal?: AbortSignal) => {
    const timeout = AbortSignal.timeout(timeoutMs + 5_000);
    let response: Response;
    try {
      response = await doFetch(`${base}${route}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      throw new Error("The app control bridge is unreachable.");
    }
    if (response.status !== 200) {
      throw new Error(`The app control bridge returned HTTP ${response.status}.`);
    }
    return response;
  };
  const runner: AgentDesktopRunner = async (argv, { timeoutMs, signal }) => {
    const response = await post("/v1/agent-desktop", { argv, timeoutMs }, timeoutMs, signal);
    const body: unknown = await response.json().catch(() => undefined);
    const result = body as Partial<AgentDesktopRunResult> | null | undefined;
    // The desktop bridge answers exit 127 with this stderr when the binary is missing.
    if (result?.exitCode === 127 && result.stderr?.includes("agent-desktop not found")) {
      throw new AgentDesktopNotInstalledError();
    }
    if (
      typeof result?.exitCode !== "number" ||
      typeof result.stdout !== "string" ||
      typeof result.stderr !== "string"
    ) {
      throw new Error("The app control bridge returned an unreadable response.");
    }
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  };
  runner.reset = async () => {
    await post("/v1/reset", undefined, 5_000);
  };
  return runner;
}
