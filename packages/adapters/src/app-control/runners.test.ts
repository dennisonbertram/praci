import { chmodSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentDesktopAppControl } from "./agent-desktop.js";
import { createAppControlProvider } from "./factory.js";
import { FakeAppControl, InMemoryAppControlStore } from "./fake.js";
import {
  AgentDesktopNotInstalledError,
  bridgeAgentDesktopRunner,
  spawnAgentDesktopRunner,
} from "./runners.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tmp() {
  const dir = mkdtempSync(path.join(tmpdir(), "app-control-"));
  dirs.push(dir);
  return dir;
}

/** A tiny script standing in for the binary. The first argument picks its behavior. */
function fakeBinary() {
  const dir = tmp();
  const file = path.join(dir, "agent-desktop");
  writeFileSync(
    file,
    `#!/usr/bin/env node
const [mode, pidFile] = process.argv.slice(2);
if (mode === "env") process.stdout.write(JSON.stringify({ tmp: process.env.TMPDIR, home: process.env.AGENT_DESKTOP_HOME, env: Object.keys(process.env).sort(), argv: process.argv.slice(2) }));
if (mode === "big") process.stdout.write("x".repeat(3 * 1024 * 1024));
if (mode === "sleep") { require("node:fs").writeFileSync(pidFile, String(process.pid)); setInterval(() => {}, 1000); }
if (mode === "exit3") process.exit(3);
`,
  );
  chmodSync(file, 0o755);
  return file;
}
const opts = () => ({
  privateDir: path.join(tmp(), "ad"),
  binary: fakeBinary(),
  env: { ...process.env, NODE_ENV: "test" },
});

describe("spawnAgentDesktopRunner", () => {
  it("runs the binary with a minimal environment in a private directory", async () => {
    const o = opts();
    const result = await spawnAgentDesktopRunner(o)(["env", "list-apps"], { timeoutMs: 5000 });
    const seen = JSON.parse(result.stdout) as { env: string[] };
    dirs.push(JSON.parse(result.stdout).tmp);
    // macOS adds this one to every process.
    expect(seen.env.filter((name) => name !== "__CF_USER_TEXT_ENCODING")).toEqual([
      "AGENT_DESKTOP_HOME",
      "HOME",
      "PATH",
      "TMPDIR",
    ]);
    expect(statSync(o.privateDir).mode & 0o777).toBe(0o700);
    const tmpDir = seen.env.length ? (JSON.parse(result.stdout).tmp as string) : "";
    expect(tmpDir).toMatch(/^\/tmp\/praci-ac-/);
    expect(tmpDir.length).toBeLessThan(40);
    expect(statSync(tmpDir).mode & 0o777).toBe(0o700);
    expect(result.exitCode).toBe(0);
  });

  it("reset replaces the short TMPDIR so an old socket path is gone", async () => {
    const o = opts();
    const run = spawnAgentDesktopRunner(o);
    const first = JSON.parse((await run(["env"], { timeoutMs: 5000 })).stdout);
    dirs.push(first.tmp);
    writeFileSync(path.join(first.tmp, "host.sock"), "");
    await run.reset?.();
    const second = JSON.parse((await run(["env"], { timeoutMs: 5000 })).stdout);
    expect(second.tmp).toBe(first.tmp);
    expect(existsSync(path.join(first.tmp, "host.sock"))).toBe(false);
    expect(statSync(second.tmp).mode & 0o777).toBe(0o700);
    expect(second.home).toBe(o.privateDir);
    rmSync(first.tmp, { recursive: true, force: true });
  });

  it("returns a failing exit code instead of throwing", async () => {
    const result = await spawnAgentDesktopRunner(opts())(["exit3"], { timeoutMs: 5000 });
    expect(result.exitCode).toBe(3);
  });

  it("kills the process on timeout", async () => {
    const pidFile = path.join(tmp(), "pid");
    const run = spawnAgentDesktopRunner(opts());
    await expect(run(["sleep", pidFile], { timeoutMs: 600 })).rejects.toThrow(/timed out/);
    const pid = Number(await import("node:fs").then((fs) => fs.readFileSync(pidFile, "utf8")));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it("rejects output over the cap", async () => {
    await expect(spawnAgentDesktopRunner(opts())(["big"], { timeoutMs: 10_000 })).rejects.toThrow(
      /too large/,
    );
  });

  it("reports a missing binary", async () => {
    const run = spawnAgentDesktopRunner({
      privateDir: path.join(tmp(), "ad"),
      env: { PATH: tmp(), NODE_ENV: "test" },
    });
    // Only fails when the usual install directories do not have it either.
    await run(["list-apps"], { timeoutMs: 1000 }).catch((error: Error) =>
      expect(error.message).toMatch(/not installed|could not be started|unreadable/),
    );
  });

  it("throws the typed not-installed error when no binary is found", async () => {
    const run = spawnAgentDesktopRunner({
      privateDir: path.join(tmp(), "ad"),
      binary: undefined,
      env: { PATH: tmp(), NODE_ENV: "test" },
    });
    const result = await run(["list-apps"], { timeoutMs: 1000 }).catch((error: unknown) => error);
    // Skip when a real install exists in the usual directories.
    if (result instanceof Error) expect(result).toBeInstanceOf(AgentDesktopNotInstalledError);
  });

  it("refuses to run outside development, tests and the desktop app", () => {
    expect(() =>
      spawnAgentDesktopRunner({ privateDir: tmp(), env: { NODE_ENV: "production" } }),
    ).toThrow(/local development/);
  });
});

const bearer = (r: { init: RequestInit } | undefined) =>
  (r?.init.headers as Record<string, string> | undefined)?.Authorization;

describe("bridgeAgentDesktopRunner", () => {
  const TOKEN = "tok-secret-123";
  function bridge(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return respond(url, init);
    }) as unknown as typeof fetch;
    return {
      requests,
      runner: bridgeAgentDesktopRunner({ url: "http://host:1234/", token: TOKEN, fetch: fetcher }),
    };
  }

  it("throws the typed not-installed error for the bridge's exit 127", async () => {
    const b = bridge(() =>
      Response.json({ exitCode: 127, stdout: "", stderr: "agent-desktop not found" }),
    );
    await expect(b.runner(["status"], { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      AgentDesktopNotInstalledError,
    );
    const other = bridge(() => Response.json({ exitCode: 127, stdout: "", stderr: "other" }));
    await expect(other.runner(["status"], { timeoutMs: 1000 })).resolves.toMatchObject({
      exitCode: 127,
    });
  });

  it("posts argv with the bearer token and returns the result", async () => {
    const b = bridge(() => Response.json({ exitCode: 0, stdout: "{}", stderr: "" }));
    expect(await b.runner(["list-apps"], { timeoutMs: 1000 })).toEqual({
      exitCode: 0,
      stdout: "{}",
      stderr: "",
    });
    const [request] = b.requests;
    expect(request?.url).toBe("http://host:1234/v1/agent-desktop");
    expect(request?.init.method).toBe("POST");
    expect(bearer(request)).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(request?.init.body as string)).toEqual({
      argv: ["list-apps"],
      timeoutMs: 1000,
    });
  });

  it("fails on non-200, malformed bodies and network errors without leaking the token", async () => {
    const cases = [
      () => new Response(`denied ${TOKEN}`, { status: 401 }),
      () => new Response("boom", { status: 500 }),
      () => new Response("not json", { status: 200 }),
      () => Response.json({ exitCode: "0", stdout: 1 }),
      () => {
        throw new Error(`connect failed with ${TOKEN}`);
      },
    ];
    for (const respond of cases) {
      const error = await bridge(respond)
        .runner(["status"], { timeoutMs: 1000 })
        .then(
          () => undefined,
          (e: Error) => e,
        );
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).not.toContain(TOKEN);
    }
  });

  it("resets through POST /v1/reset and errors on failure", async () => {
    const b = bridge(() => new Response(null, { status: 200 }));
    await b.runner.reset?.();
    expect(b.requests[0]?.url).toBe("http://host:1234/v1/reset");
    expect(bearer(b.requests[0])).toBe(`Bearer ${TOKEN}`);
    await expect(
      bridge(() => new Response(null, { status: 403 })).runner.reset?.(),
    ).rejects.toThrow(/403/);
  });

  it("lets the provider end a run even when reset fails", async () => {
    const b = bridge(() => new Response(null, { status: 500 }));
    const provider = new AgentDesktopAppControl({
      runner: b.runner,
      store: new InMemoryAppControlStore(),
    });
    const scope = { spaceId: "s", userId: "u", botId: "b", runId: "r" };
    await expect(
      provider.endRun(scope, {
        operationId: "o",
        traceId: "t",
        spaceId: "s",
        userId: "u",
        signal: new AbortController().signal,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("createAppControlProvider", () => {
  const store = new InMemoryAppControlStore();
  const dataDir = "/data";

  it("is off unless APP_CONTROL_PROVIDER is agent-desktop or fake", () => {
    expect(createAppControlProvider({}, { dataDir, store })).toBeUndefined();
    expect(
      createAppControlProvider({ APP_CONTROL_PROVIDER: "other" }, { dataDir, store }),
    ).toBeUndefined();
    expect(
      createAppControlProvider({ APP_CONTROL_PROVIDER: "fake" }, { dataDir, store }),
    ).toBeInstanceOf(FakeAppControl);
  });

  it("uses the bridge when configured and local spawn otherwise", () => {
    const bridged = createAppControlProvider(
      {
        APP_CONTROL_PROVIDER: "agent-desktop",
        APP_CONTROL_BRIDGE_URL: "http://h:1",
        APP_CONTROL_BRIDGE_TOKEN: "t",
        NODE_ENV: "production",
      },
      { dataDir, store },
    );
    expect(bridged).toBeInstanceOf(AgentDesktopAppControl);
    expect(() =>
      createAppControlProvider(
        { APP_CONTROL_PROVIDER: "agent-desktop", NODE_ENV: "production" },
        { dataDir, store },
      ),
    ).toThrow(/local development/);
    expect(
      createAppControlProvider(
        { APP_CONTROL_PROVIDER: "agent-desktop", NODE_ENV: "test" },
        { dataDir: tmp(), store },
      ),
    ).toBeInstanceOf(AgentDesktopAppControl);
  });
});
