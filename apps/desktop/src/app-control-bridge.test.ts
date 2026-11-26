import { chmodSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppControlBridge } from "./app-control-bridge.js";
import { isDeniedAppValue, refuseArgv, startAppControlBridge } from "./app-control-bridge.js";

let dir: string;
let bridge: AppControlBridge | undefined;
let killed: string[];

function fakeBinary(body: string) {
  const file = path.join(dir, "agent-desktop");
  writeFileSync(file, `#!${process.execPath}\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

const ECHO = `console.log(JSON.stringify({ argv: process.argv.slice(2), env: process.env }));`;

async function start(binary: string | null) {
  bridge = await startAppControlBridge({
    userDataDir: dir,
    findBinary: () => binary,
    killHosts: (tmp) => {
      killed.push(tmp);
    },
  });
  return bridge;
}

function call(
  b: AppControlBridge,
  route: string,
  body: unknown,
  opts: { token?: string | null; method?: string } = {},
) {
  const token = opts.token === undefined ? b.token : opts.token;
  return fetch(`http://127.0.0.1:${b.port}${route}`, {
    method: opts.method ?? "POST",
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    body: opts.method === "GET" ? undefined : JSON.stringify(body),
  });
}

const run = (b: AppControlBridge, argv: string[], timeoutMs = 5000) =>
  call(b, "/v1/agent-desktop", { argv, timeoutMs });

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "bridge-test-"));
  killed = [];
});

afterEach(async () => {
  await bridge?.close();
  bridge = undefined;
  rmSync(dir, { recursive: true, force: true });
});

describe("refuseArgv", () => {
  it.each([
    [["snapshot", "--app", "Calculator"]],
    [["list-apps"]],
    [["list-windows", "--app", "Calculator"]],
    [["launch", "Calculator", "--headed"]],
    [["press", "return", "--app", "Calculator"]],
    [["click", "@s1:e2", "--surface", "sheet"]],
    [["permissions"]],
    [["get", "@s1:e2", "--property", "value"]],
    [["snapshot", "--app", "Calculator", "--session", "r0123456789abcdef01234567"]],
    [["type", "@s1:e2", "--", "--force"]],
    [["type", "@s1:e2", "--", "--app", "Terminal"]],
  ])("allows %j", (argv) => expect(refuseArgv(argv)).toBeNull());

  it.each([
    [["screenshot", "--app", "Calculator"]],
    [["snapshot", "-i"]],
    [["get", "@s1:e2"]],
    [["get", "@s1:e2", "--property", "bounds"]],
    [["snapshot", "--app", "Calculator", "--session", "abc"]],
    [["snapshot", "--", "--app", "Terminal"]],
    [["snapshot", "--app", "Calculator", "--force"]],
    [["list-windows"]],
    [["list-surfaces"]],
    [["clipboard-get"]],
    [["mouse-click"]],
    [["batch"]],
    [["session", "start"]],
    [["close-app", "Calculator"]],
    [["permissions", "--guide"]],
    [["permissions", "--request"]],
    [["click", "@s1:e2", "--force"]],
    [["snapshot", "--app", "Calculator", "--screenshot", "/tmp/x.html"]],
    [["snapshot", "--debug"]],
    [["snapshot", "--trace", "/tmp/t"]],
    [["snapshot", "--trace-strict"]],
    [["click", "--xy", "1,2"]],
    [["snapshot", "-v"]],
    [["launch", "Calculator", "--env", "A=B"]],
    [["snapshot", "--app", "Terminal"]],
    [["snapshot", "--app", "com.apple.systempreferences"]],
    [["snapshot", "--app", "Praci"]],
    [["snapshot", "--app=Terminal"]],
    [["launch", "Terminal"]],
    [["launch", "--headed"]],
    [["snapshot", "--surface", "desktop"]],
    [["press", "cmd+c", "--app", "Calculator"]],
    [["press", "f13", "--app", "Calculator"]],
    [["press", "return"]],
    [["snapshot", "--app", "Term\u2066inal"]],
    [["snapshot", "--app", "Term\u200binal"]],
    [["snapshot", "--app", "Term\u202einal"]],
    [["launch", "Term\u2066inal"]],
    [["launch", "Term\u200binal"]],
    [["launch", "Term\u202einal"]],
    [["snapshot", "--app", " Calculator"]],
    [["click", "@s1:e1", "--window-id", "1\u200b2"]],
  ])("refuses %j", (argv) => expect(refuseArgv(argv)).not.toBeNull());

  it("checks one value against the denylist as both id and name", () => {
    expect(isDeniedAppValue("Calculator")).toBe(false);
    expect(isDeniedAppValue("com.apple.calculator")).toBe(false);
    expect(isDeniedAppValue("Terminal")).toBe(true);
    expect(isDeniedAppValue("")).toBe(true);
  });
});

describe("bridge server", () => {
  it("binds to loopback only", async () => {
    const b = await start(fakeBinary(ECHO));
    const res = await call(b, "/v1/reset", {});
    expect(res.status).toBe(200);
    const server = (await import("node:net")).createConnection({ port: b.port, host: "127.0.0.1" });
    await new Promise((resolve) => server.once("connect", resolve));
    expect(server.remoteAddress).toBe("127.0.0.1");
    server.destroy();
  });

  it("rejects missing and wrong tokens, other routes and methods", async () => {
    const b = await start(fakeBinary(ECHO));
    expect((await call(b, "/v1/agent-desktop", {}, { token: null })).status).toBe(401);
    expect(
      (await call(b, "/v1/agent-desktop", {}, { token: "x".repeat(b.token.length) })).status,
    ).toBe(401);
    expect((await call(b, "/v1/agent-desktop", {}, { token: "short" })).status).toBe(401);
    expect((await call(b, "/v1/other", {})).status).toBe(404);
    expect((await call(b, "/v1/agent-desktop", {}, { method: "GET" })).status).toBe(405);
    expect(b.token.length).toBeGreaterThanOrEqual(43);
  });

  it("refuses a disallowed command without spawning", async () => {
    const b = await start(
      fakeBinary(`require("fs").writeFileSync(${JSON.stringify(path.join(dir, "ran"))}, "1");`),
    );
    const res = await run(b, ["clipboard-get"]);
    expect(res.status).toBe(400);
    await expect(
      import("node:fs").then((fs) => fs.existsSync(path.join(dir, "ran"))),
    ).resolves.toBe(false);
  });

  it("rejects malformed bodies and oversized bodies", async () => {
    const b = await start(fakeBinary(ECHO));
    expect((await call(b, "/v1/agent-desktop", { argv: "snapshot", timeoutMs: 1000 })).status).toBe(
      400,
    );
    expect((await call(b, "/v1/agent-desktop", { argv: ["list-apps"] })).status).toBe(400);
    const big = await call(b, "/v1/agent-desktop", {
      argv: ["type", "x".repeat(70_000)],
      timeoutMs: 1000,
    });
    expect(big.status).toBe(413);
  });

  it("spawns with the private TMPDIR and AGENT_DESKTOP_HOME and no other env", async () => {
    process.env.PRACI_TEST_SECRET = "hunter2";
    try {
      const b = await start(fakeBinary(ECHO));
      const res = await run(b, ["list-apps", "--app", "Calculator"]);
      expect(res.status).toBe(200);
      const envelope = (await res.json()) as { exitCode: number; stdout: string };
      expect(envelope.exitCode).toBe(0);
      const seen = JSON.parse(envelope.stdout) as { argv: string[]; env: Record<string, string> };
      expect(seen.argv).toEqual(["list-apps", "--app", "Calculator"]);
      expect(seen.env.PRACI_TEST_SECRET).toBeUndefined();
      expect(seen.env.TMPDIR).toContain("praci-ac-");
      expect(statSync(seen.env.TMPDIR as string).mode & 0o777).toBe(0o700);
      expect(seen.env.AGENT_DESKTOP_HOME).toBe(path.join(dir, "app-control", "home"));
      expect(statSync(seen.env.AGENT_DESKTOP_HOME as string).mode & 0o777).toBe(0o700);
    } finally {
      delete process.env.PRACI_TEST_SECRET;
    }
  });

  it("reports an unavailable binary as exit 127", async () => {
    const b = await start(null);
    const res = await run(b, ["list-apps"]);
    expect(await res.json()).toEqual({
      exitCode: 127,
      stdout: "",
      stderr: "agent-desktop not found",
    });
  });

  it("kills a command that exceeds its timeout", async () => {
    const b = await start(fakeBinary("setInterval(() => {}, 1000);"));
    const res = await run(b, ["list-apps"], 200);
    expect((await res.json()) as { exitCode: number }).toMatchObject({ exitCode: 124 });
  });

  it("caps captured output", async () => {
    const b = await start(fakeBinary(`process.stdout.write("a".repeat(3 * 1024 * 1024));`));
    const envelope = (await (await run(b, ["list-apps"])).json()) as { stdout: string };
    expect(envelope.stdout.length).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(envelope.stdout.length).toBeGreaterThan(0);
  });

  it("reset stops the command hosts for its TMPDIR and recreates the directory", async () => {
    const b = await start(fakeBinary(ECHO));
    const env = JSON.parse(
      ((await (await run(b, ["list-apps"])).json()) as { stdout: string }).stdout,
    ).env as Record<string, string>;
    writeFileSync(path.join(env.TMPDIR as string, "old.sock"), "");
    const res = await call(b, "/v1/reset", {});
    expect(await res.json()).toEqual({ ok: true });
    expect(killed).toEqual([env.TMPDIR]);
    expect(statSync(env.TMPDIR as string).mode & 0o777).toBe(0o700);
    expect(() => statSync(path.join(env.TMPDIR as string, "old.sock"))).toThrow();
  });

  it("runs the reset path and waits for it before answering a timeout", async () => {
    const b = await start(fakeBinary("setInterval(() => {}, 1000);"));
    const res = await run(b, ["list-apps"], 200);
    expect((await res.json()) as { exitCode: number }).toMatchObject({ exitCode: 124 });
    expect(killed).toHaveLength(1);
  });

  it("reset kills an active request and finishes before spawning a later one", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const marker = path.join(dir, "marker");
    bridge = await startAppControlBridge({
      userDataDir: dir,
      findBinary: () =>
        fakeBinary(
          `const fs = require("fs");
         if (process.argv[2] === "list-windows") fs.writeFileSync(${JSON.stringify(marker)}, "1");
         else setInterval(() => {}, 1000);`,
        ),
      killHosts: async (tmp) => {
        killed.push(tmp);
        await gate;
      },
    });
    const b = bridge;
    const hanging = run(b, ["list-apps"], 30_000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const reset = call(b, "/v1/reset", {});
    await new Promise((resolve) => setTimeout(resolve, 300));
    // The hanging request was killed; reset is now blocked on killing hosts.
    expect(((await (await hanging).json()) as { exitCode: number }).exitCode).not.toBe(0);
    const later = run(b, ["list-windows", "--app", "Calculator"]);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(existsSync(marker)).toBe(false);
    release();
    expect(((await (await later).json()) as { exitCode: number }).exitCode).toBe(0);
    expect(existsSync(marker)).toBe(true);
    expect((await reset).status).toBe(200);
  });
});
