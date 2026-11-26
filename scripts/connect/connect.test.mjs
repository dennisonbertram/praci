import { readFileSync } from "node:fs";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoopbackPortListening, main, probeHealth, resolveWebPort } from "./connect.mjs";
import { parseConnectEnv } from "./env.mjs";

const servers = new Set();

async function startServer(handler) {
  const server = http.createServer(handler);
  servers.add(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, port: server.address().port };
}

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        }),
    ),
  );
  servers.clear();
});

function commandDependencies(port, extra = {}) {
  const stdout = vi.fn();
  const stderr = vi.fn();
  const qrEncoder = vi.fn(async (payload) => `QR:${payload}`);
  const fileOrigin = extra.env?.RAKAZO_TRUSTED_ORIGINS ?? `http://127.0.0.1:${port}`;
  const fileHost = extra.env?.RAKAZO_ALLOWED_HOSTS ?? "127.0.0.1";
  const envText =
    extra.envText ?? `RAKAZO_TRUSTED_ORIGINS=${fileOrigin}\nRAKAZO_ALLOWED_HOSTS=${fileHost}\n`;
  return {
    dependencies: {
      env: {},
      writeEnvFile: vi.fn(),
      readEnvFile: vi.fn(() => envText),
      stdout,
      stderr,
      qrEncoder,
      ...extra,
      fileEnv: parseConnectEnv(envText),
      envText,
    },
    stdout,
    stderr,
    qrEncoder,
    port,
  };
}

function connectFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

function tailscaleCommandRunner({
  status = connectFixture("status-running"),
  serveStatus = connectFixture("serve-private"),
  events = [],
} = {}) {
  return vi.fn(async (_command, args) => {
    events.push(args[0] === "serve" ? `serve-${args[1]}` : args[0]);
    if (args[0] === "version") return { code: 0, stdout: "1.0.0", stderr: "" };
    if (args[0] === "status") return { code: 0, stdout: JSON.stringify(status), stderr: "" };
    if (args[0] === "serve" && args[1] === "status") {
      return { code: 0, stdout: JSON.stringify(serveStatus), stderr: "" };
    }
    throw new Error("Unexpected command in connect fixture runner.");
  });
}

describe("connect health probe", () => {
  it("uses the API's wrapped health response and POST request", async () => {
    let requestBody = "";
    const { port } = await startServer((request, response) => {
      request.on("data", (chunk) => (requestBody += chunk));
      request.on("end", () => {
        expect(request.method).toBe("POST");
        expect(request.url).toBe("/rpc/health");
        expect(request.headers["content-type"]).toBe("application/json");
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ json: { ok: true, version: "0.1.0" } }));
      });
    });

    await expect(
      probeHealth(`http://127.0.0.1:${port}`, { timeoutMs: 1000 }),
    ).resolves.toBeUndefined();
    expect(JSON.parse(requestBody)).toEqual({ json: {} });
  });

  it("rejects the shorthand unwrapped response", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });

    await expect(probeHealth(`http://127.0.0.1:${port}`, { timeoutMs: 1000 })).rejects.toThrow(
      "json.ok: true",
    );
  });

  it("rejects redirects and invalid or oversized response bodies", async () => {
    const redirect = await startServer((_request, response) => {
      response.writeHead(302, { location: "https://my-mac.example.ts.net/rpc/health" });
      response.end();
    });
    await expect(
      probeHealth(`http://127.0.0.1:${redirect.port}`, { timeoutMs: 1000 }),
    ).rejects.toThrow("redirects are not allowed");

    const invalid = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("not json");
    });
    await expect(
      probeHealth(`http://127.0.0.1:${invalid.port}`, { timeoutMs: 1000 }),
    ).rejects.toThrow("invalid JSON");

    const oversized = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json", "content-length": "65537" });
      response.end("{}");
    });
    await expect(
      probeHealth(`http://127.0.0.1:${oversized.port}`, { timeoutMs: 1000 }),
    ).rejects.toThrow("oversized response");
  });

  it.each([
    ["403", 403, {}, "HTTP 403"],
    ["redirect", 302, { location: "/elsewhere" }, "redirects are not allowed"],
    [
      "oversized declared length",
      200,
      { "content-length": String(64 * 1024 + 1) },
      "oversized response",
    ],
  ])("aborts an unread streaming %s response", async (_name, status, headers, error) => {
    let responseClosed;
    const { port } = await startServer((_request, response) => {
      responseClosed = new Promise((resolve) => {
        response.once("close", () => resolve(!response.writableEnded));
      });
      response.writeHead(status, headers);
      response.write("streaming error body");
    });

    await expect(probeHealth(`http://127.0.0.1:${port}`, { timeoutMs: 1000 })).rejects.toThrow(
      error,
    );
    await expect(responseClosed).resolves.toBe(true);
  });

  it("bounds response-body reading by the timeout", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"json":');
      setTimeout(() => response.end('{"ok":true}}'), 150);
    });

    await expect(probeHealth(`http://127.0.0.1:${port}`, { timeoutMs: 30 })).rejects.toThrow(
      "timed out",
    );
  });
});

describe("connect command", () => {
  it("checks an actual loopback port before advertising its origin", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true, version: "0.1.0" } }));
    });
    const run = vi.fn();
    const captures = commandDependencies(port, { run });
    const result = await main(
      [
        "--method",
        "url",
        "--url",
        `http://127.0.0.1:${port}/some/path?tab=1`,
        "--web-port",
        String(port),
      ],
      captures.dependencies,
    );

    expect(result).toBe(0);
    expect(run).not.toHaveBeenCalled();
    expect(captures.stderr).not.toHaveBeenCalled();
    expect(captures.qrEncoder).toHaveBeenCalledWith(
      `rakazo://connect?server=${encodeURIComponent(`http://127.0.0.1:${port}`)}`,
    );
    expect(captures.stdout.mock.calls.flat().join("")).toBe(
      `QR:rakazo://connect?server=${encodeURIComponent(`http://127.0.0.1:${port}`)}\nhttp://127.0.0.1:${port}\n`,
    );
  });

  it.each([
    [
      "non-health JSON",
      (_request, response) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ json: { ok: false } }));
      },
    ],
    [
      "empty body",
      (_request, response) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end();
      },
    ],
    [
      "health timeout",
      (_request, response) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.write('{"json":');
        setTimeout(() => response.end('{"ok":true}}'), 150);
      },
    ],
  ])("prints no QR when the health check fails: %s", async (_name, handler) => {
    const { port } = await startServer(handler);
    const captures = commandDependencies(port);
    const args = [
      "--method",
      "url",
      "--url",
      `http://127.0.0.1:${port}`,
      "--web-port",
      String(port),
    ];
    if (_name === "health timeout") args.push("--timeout", "0.03");

    expect(await main(args, captures.dependencies)).toBe(1);
    expect(captures.qrEncoder).not.toHaveBeenCalled();
    expect(captures.stdout).not.toHaveBeenCalled();
    expect(captures.stderr).toHaveBeenCalledOnce();
  });

  it("prints available methods when the Tailscale version probe is unavailable", async () => {
    const run = vi.fn(async () => ({ code: 1, stdout: "", stderr: "private error" }));
    const captures = commandDependencies(0, { run });
    expect(await main([], captures.dependencies)).toBe(1);
    expect(run).toHaveBeenCalledWith("tailscale", ["version"], expect.any(Object));
    expect(captures.stdout).toHaveBeenCalledWith("Available methods: url, lan\n");
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it.each([
    ["lan", ["--method", "lan", "--url", "http://127.0.0.1:5173"]],
    ["tailscale", ["--method", "tailscale", "--url", "https://my-mac.example.ts.net"]],
    ["default", ["--url", "https://my-mac.example.ts.net"]],
  ])("rejects --url for the %s method without probing Tailscale", async (_method, args) => {
    const run = vi.fn();
    const captures = commandDependencies(5173, { run });

    expect(await main(args, captures.dependencies)).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith("--url can only be used with --method url.\n");
    expect(run).not.toHaveBeenCalled();
  });

  it("validates timeout before probing Tailscale for the default method", async () => {
    const run = vi.fn();
    const captures = commandDependencies(5173, { run });

    expect(await main(["--timeout", "301"], captures.dependencies)).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "--timeout must be greater than 0 and no more than 300 seconds.\n",
    );
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ["default", []],
    ["explicit", ["--method", "tailscale"]],
  ])(
    "uses Tailscale and probes health before rendering a QR for %s selection",
    async (_name, methodArgs) => {
      const events = [];
      const run = tailscaleCommandRunner({ events });
      const fetchImpl = vi.fn(async (url, options) => {
        events.push("health");
        expect(url).toBe("https://my-mac.example.ts.net/rpc/health");
        expect(options.method).toBe("POST");
        return new Response(JSON.stringify({ json: { ok: true } }), {
          headers: { "content-type": "application/json" },
        });
      });
      const captures = commandDependencies(5173, {
        checkListening: vi.fn(async () => true),
        env: {},
        envText:
          "RAKAZO_TRUSTED_ORIGINS=https://my-mac.example.ts.net\nRAKAZO_ALLOWED_HOSTS=my-mac.example.ts.net\n",
        fetchImpl,
        run,
      });
      captures.qrEncoder.mockImplementation(async (payload) => {
        events.push("qr");
        return `QR:${payload}`;
      });

      expect(await main(methodArgs, captures.dependencies)).toBe(0);
      expect(run.mock.calls.map(([, args]) => args[0])).toEqual(["version", "status", "serve"]);
      expect(events.indexOf("health")).toBeGreaterThan(events.indexOf("serve-status"));
      expect(events.indexOf("qr")).toBeGreaterThan(events.indexOf("health"));
      expect(captures.stdout.mock.calls.flat().join("")).toContain(
        "https://my-mac.example.ts.net\n",
      );
      expect(captures.stderr).not.toHaveBeenCalled();
    },
  );

  it("does not probe health or render a QR when Tailscale resolution fails", async () => {
    const run = tailscaleCommandRunner({ status: connectFixture("status-needs-login") });
    const fetchImpl = vi.fn();
    const captures = commandDependencies(5173, {
      checkListening: async () => true,
      env: {},
      fileEnv: {},
      fetchImpl,
      run,
    });

    expect(await main(["--method", "tailscale"], captures.dependencies)).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "Tailscale needs sign-in; sign in with the Tailscale app.\n",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it.each([
    [
      "unknown flag",
      ["--unknown"],
      "Unknown option. Use --method, --url, --web-port, --timeout, --yes, or --no-env-write.",
    ],
    [
      "duplicate flag",
      ["--method", "url", "--method", "lan"],
      "Each option may be provided only once.",
    ],
    ["missing flag value", ["--method"], "Missing value for --method."],
    [
      "unknown method",
      ["--method", "other"],
      "Unknown method; choose one of: url, lan, tailscale.",
    ],
    [
      "invalid web port",
      ["--method", "url", "--url", "https://server.example.com", "--web-port", "0"],
      "--web-port must be an integer between 1 and 65535.",
    ],
    [
      "invalid timeout",
      ["--method", "url", "--url", "https://server.example.com", "--timeout", "301"],
      "--timeout must be greater than 0 and no more than 300 seconds.",
    ],
  ])("rejects %s before checking the web port", async (_name, args, message) => {
    const checkListening = vi.fn();
    const captures = commandDependencies(0, { checkListening });

    expect(await main(args, captures.dependencies)).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(`${message}\n`);
    expect(checkListening).not.toHaveBeenCalled();
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("uses shell WEB_PORT before dotenv and defaults to 5173", () => {
    expect(resolveWebPort({ env: { WEB_PORT: "5200" }, fileEnv: { WEB_PORT: "5300" } })).toBe(5200);
    expect(resolveWebPort({ env: {}, fileEnv: { WEB_PORT: "5300" } })).toBe(5300);
    expect(resolveWebPort({ env: {}, fileEnv: {} })).toBe(5173);
    expect(resolveWebPort({ webPortFlag: "5400", env: { WEB_PORT: "5200" } })).toBe(5400);
  });

  it("renders the installed qrcode package as terminal output", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true, version: "0.1.0" } }));
    });
    const captures = commandDependencies(port);
    delete captures.dependencies.qrEncoder;

    expect(
      await main(
        ["--method", "url", "--url", `http://127.0.0.1:${port}`, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output).toContain("\u001b[47m");
    expect(output).toContain(`\nhttp://127.0.0.1:${port}\n`);
  });

  it("prints one LAN encryption warning only after a successful health check", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ json: { ok: true, version: "0.1.0" } }), {
          headers: { "content-type": "application/json" },
        }),
    );
    const run = vi.fn();
    const captures = commandDependencies(5173, {
      env: {
        RAKAZO_TRUSTED_ORIGINS: "http://192.168.1.20:5173",
        RAKAZO_ALLOWED_HOSTS: "192.168.1.20",
      },
      checkListening: async () => true,
      run,
      networkInterfaces: () => ({
        external: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
      }),
      fetchImpl,
    });

    expect(await main(["--method", "lan"], captures.dependencies)).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://192.168.1.20:5173/rpc/health",
      expect.objectContaining({ method: "POST" }),
    );
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output.match(/Warning: LAN connections are unencrypted\./g)).toHaveLength(1);
    expect(output).toContain("http://192.168.1.20:5173\n");
    expect(captures.stderr).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("reports ambiguous LAN addresses without a health probe or QR", async () => {
    const fetchImpl = vi.fn();
    const checkListening = vi.fn(async () => true);
    const captures = commandDependencies(5173, {
      checkListening,
      networkInterfaces: () => ({
        wlan0: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
        eth0: [{ family: "IPv4", address: "10.0.0.8", internal: false }],
      }),
      fetchImpl,
    });

    expect(await main(["--method", "lan"], captures.dependencies)).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "Multiple private IPv4 addresses are available for LAN access. Use --method url --url with a reachable server origin.\n",
    );
    expect(checkListening).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(captures.qrEncoder).not.toHaveBeenCalled();
    expect(captures.stdout).not.toHaveBeenCalled();
  });

  it("keeps the required loopback listener diagnostic and does not generate a QR", async () => {
    const captures = commandDependencies(5173, { checkListening: async () => false });
    expect(
      await main(
        ["--method", "url", "--url", "https://my-mac.example.ts.net"],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "Nothing is listening on port 5173. Start the server with `pnpm dev` first, or pass --web-port.\n",
    );
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("reports a LAN binding fix without printing a QR on failed reachability", async () => {
    const captures = commandDependencies(5173, {
      env: {
        RAKAZO_TRUSTED_ORIGINS: "http://192.168.1.20:5173",
        RAKAZO_ALLOWED_HOSTS: "192.168.1.20",
      },
      checkListening: async () => true,
      networkInterfaces: () => ({
        external: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
      }),
      fetchImpl: async () => {
        throw new Error("network detail");
      },
    });
    expect(await main(["--method", "lan"], captures.dependencies)).toBe(1);
    expect(captures.stderr.mock.calls[0][0]).toContain(
      "set RAKAZO_DEV_HOST=0.0.0.0 and restart pnpm dev.",
    );
    expect(captures.stderr.mock.calls[0][0]).not.toContain("network detail");
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("shows exact settings and writes only after interactive confirmation", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    let scratchEnv = "# synthetic scratch env\r\nWEB_ORIGIN=http://web.example.test\r\n";
    const writeEnvFile = vi.fn((_path, text) => {
      scratchEnv = text;
    });
    const confirmEnvWrite = vi.fn(async () => "y");
    const captures = commandDependencies(port, {
      env: {},
      fileEnv: {},
      envText: scratchEnv,
      envPath: "scratch/.env",
      stdin: { isTTY: true },
      confirmEnvWrite,
      writeEnvFile,
    });

    expect(
      await main(
        ["--method", "url", "--url", `${origin}/path`, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    expect(confirmEnvWrite).toHaveBeenCalledOnce();
    expect(writeEnvFile).toHaveBeenCalledOnce();
    expect(writeEnvFile).toHaveBeenCalledWith(
      "scratch/.env",
      `# synthetic scratch env\r\nWEB_ORIGIN=http://web.example.test\r\nRAKAZO_TRUSTED_ORIGINS=${origin}\r\nRAKAZO_ALLOWED_HOSTS=127.0.0.1\r\n`,
    );
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output).toContain(`RAKAZO_TRUSTED_ORIGINS=${origin}\n`);
    expect(output).toContain("RAKAZO_ALLOWED_HOSTS=127.0.0.1\n");
    expect(output).toContain("Restart `pnpm dev` so the server picks this up.\n");
    expect(output).toContain(`QR:rakazo://connect?server=${encodeURIComponent(origin)}\n`);
    expect(output).not.toContain("http://web.example.test");
    expect(captures.stderr).not.toHaveBeenCalled();
    expect(scratchEnv).toContain(`RAKAZO_TRUSTED_ORIGINS=${origin}`);
  });

  it("does not write when interactive consent is declined", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const confirmEnvWrite = vi.fn(async () => "n");
    const captures = commandDependencies(port, {
      env: {},
      envText: "",
      stdin: { isTTY: true },
      confirmEnvWrite,
    });

    expect(
      await main(
        ["--method", "url", "--url", `http://127.0.0.1:${port}`, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(confirmEnvWrite).toHaveBeenCalledOnce();
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.stderr).toHaveBeenCalledWith("No changes made.\n");
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("refuses to overwrite env edits made while consent is awaited", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const initialEnv = "# synthetic scratch env\nUNRELATED_SETTING=before\n";
    let scratchEnv = initialEnv;
    const readEnvFile = vi.fn(() => scratchEnv);
    const confirmEnvWrite = vi.fn(async () => {
      scratchEnv = "# synthetic scratch env\nUNRELATED_SETTING=edited-during-prompt\n";
      return "y";
    });
    const writeEnvFile = vi.fn((_path, text) => {
      scratchEnv = text;
    });
    const captures = commandDependencies(port, {
      env: {},
      envText: initialEnv,
      envPath: "scratch/.env",
      stdin: { isTTY: true },
      confirmEnvWrite,
      readEnvFile,
      writeEnvFile,
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(confirmEnvWrite).toHaveBeenCalledOnce();
    expect(readEnvFile).toHaveBeenCalledOnce();
    expect(readEnvFile).toHaveBeenCalledWith("scratch/.env");
    expect(writeEnvFile).not.toHaveBeenCalled();
    expect(scratchEnv).toBe("# synthetic scratch env\nUNRELATED_SETTING=edited-during-prompt\n");
    expect(captures.stderr).toHaveBeenCalledWith(
      "The .env file changed after preview; no changes were written. Run `pnpm connect` again.\n",
    );
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("gives --no-env-write priority over --yes", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const captures = commandDependencies(port, {
      env: {},
      envText: "",
      stdin: { isTTY: false },
    });

    expect(
      await main(
        [
          "--method",
          "url",
          "--url",
          `http://127.0.0.1:${port}`,
          "--web-port",
          String(port),
          "--yes",
          "--no-env-write",
        ],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.stderr).toHaveBeenCalledWith("No changes written (--no-env-write).\n");
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it.each([
    ["--no-env-write", ["--no-env-write"], { isTTY: true }],
    ["non-interactive mode", [], { isTTY: false }],
  ])("prints missing settings without writing in %s", async (_name, flags, stdin) => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const captures = commandDependencies(port, {
      env: {},
      fileEnv: {},
      envText: "# synthetic scratch env\n",
      stdin,
    });

    expect(
      await main(
        [
          "--method",
          "url",
          "--url",
          `http://127.0.0.1:${port}`,
          "--web-port",
          String(port),
          ...flags,
        ],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.stdout.mock.calls.flat().join("")).toContain(
      `RAKAZO_TRUSTED_ORIGINS=http://127.0.0.1:${port}\nRAKAZO_ALLOWED_HOSTS=127.0.0.1\n`,
    );
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("allows explicit --yes to write in a non-interactive terminal", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const captures = commandDependencies(port, {
      env: {},
      fileEnv: {},
      envText: "",
      envPath: "scratch/.env",
      stdin: { isTTY: false },
    });

    expect(
      await main(
        [
          "--method",
          "url",
          "--url",
          `http://127.0.0.1:${port}`,
          "--web-port",
          String(port),
          "--yes",
        ],
        captures.dependencies,
      ),
    ).toBe(0);
    expect(captures.dependencies.writeEnvFile).toHaveBeenCalledOnce();
    expect(captures.stdout.mock.calls.flat().join("")).toContain(
      "Restart `pnpm dev` so the server picks this up.\n",
    );
  });

  it("is silent about trust settings when the dotenv file already satisfies them", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const captures = commandDependencies(port, {
      env: {},
      envText: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=127.0.0.1\n`,
      stdin: { isTTY: false },
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    expect(captures.stdout.mock.calls.flat().join("")).toBe(
      `QR:rakazo://connect?server=${encodeURIComponent(origin)}\n${origin}\n`,
    );
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.dependencies.confirmEnvWrite).toBeUndefined();
  });

  it("prints changed assignments without inline comments and preserves comments on disk", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const envText =
      "RAKAZO_TRUSTED_ORIGINS=https://old.example.test#synthetic-comment-secret\nRAKAZO_ALLOWED_HOSTS=old.example.test#synthetic-host-comment\n";
    const captures = commandDependencies(port, {
      env: {},
      envText,
      envPath: "scratch/.env",
      stdin: { isTTY: false },
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port), "--yes"],
        captures.dependencies,
      ),
    ).toBe(0);
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output).toContain(`RAKAZO_TRUSTED_ORIGINS=https://old.example.test,${origin}\n`);
    expect(output).toContain("RAKAZO_ALLOWED_HOSTS=old.example.test,127.0.0.1\n");
    expect(output).not.toContain("synthetic-comment-secret");
    expect(output).not.toContain("synthetic-host-comment");
    expect(captures.dependencies.writeEnvFile).toHaveBeenCalledWith(
      "scratch/.env",
      `RAKAZO_TRUSTED_ORIGINS=https://old.example.test,${origin}#synthetic-comment-secret\nRAKAZO_ALLOWED_HOSTS=old.example.test,127.0.0.1#synthetic-host-comment\n`,
    );
  });

  it("writes missing file settings with shell values and prints only validated trust values", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    let scratchEnv = "# synthetic-comment-secret\nUNRELATED_TOKEN=synthetic-unrelated-secret\n";
    const writeEnvFile = vi.fn((_path, text) => {
      scratchEnv = text;
    });
    const captures = commandDependencies(port, {
      env: {
        RAKAZO_TRUSTED_ORIGINS: origin,
        RAKAZO_ALLOWED_HOSTS: "127.0.0.1",
        OIDC_CLIENT_SECRET: "synthetic-oidc-secret",
      },
      envText: scratchEnv,
      envPath: "scratch/.env",
      writeEnvFile,
      stdin: { isTTY: false },
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port), "--yes"],
        captures.dependencies,
      ),
    ).toBe(0);
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output).toContain(`RAKAZO_TRUSTED_ORIGINS=${origin}\n`);
    expect(output).toContain("RAKAZO_ALLOWED_HOSTS=127.0.0.1\n");
    expect(output).toContain(
      `Shell value (takes precedence over .env): RAKAZO_TRUSTED_ORIGINS=${origin}\n`,
    );
    expect(output).toContain(
      "Shell value (takes precedence over .env): RAKAZO_ALLOWED_HOSTS=127.0.0.1\n",
    );
    expect(output).not.toContain("synthetic-comment-secret");
    expect(output).not.toContain("synthetic-unrelated-secret");
    expect(output).not.toContain("synthetic-oidc-secret");
    expect(writeEnvFile).toHaveBeenCalledWith(
      "scratch/.env",
      `# synthetic-comment-secret\nUNRELATED_TOKEN=synthetic-unrelated-secret\nRAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=127.0.0.1\n`,
    );
    expect(scratchEnv).toContain("UNRELATED_TOKEN=synthetic-unrelated-secret");
    expect(captures.stderr).not.toHaveBeenCalled();
  });

  it("notes differing shell values without rewriting an already configured file", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const captures = commandDependencies(port, {
      env: {
        RAKAZO_TRUSTED_ORIGINS: "https://shell.example.test",
        RAKAZO_ALLOWED_HOSTS: "127.0.0.1",
      },
      envText: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=127.0.0.1\n`,
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    expect(captures.stdout.mock.calls.flat().join("")).toContain(
      "Shell value (takes precedence over .env): RAKAZO_TRUSTED_ORIGINS=https://shell.example.test\n",
    );
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.stderr).not.toHaveBeenCalled();
  });

  it("reports invalid existing origins without rewriting or exposing them", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const invalid = "https://private.example.test/path";
    const captures = commandDependencies(port, {
      env: {},
      fileEnv: {},
      envText: `RAKAZO_TRUSTED_ORIGINS=${invalid}\nRAKAZO_ALLOWED_HOSTS=old.example.test\n`,
    });

    expect(
      await main(
        ["--method", "url", "--url", `http://127.0.0.1:${port}`, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "RAKAZO_TRUSTED_ORIGINS is invalid; no .env changes were made.\n",
    );
    expect(captures.stderr.mock.calls.flat().join("")).not.toContain(invalid);
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("rejects invalid shell trust values without printing them", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const invalid = "https://user:synthetic-secret@host.example.test";
    const captures = commandDependencies(port, {
      env: {
        RAKAZO_TRUSTED_ORIGINS: invalid,
        RAKAZO_ALLOWED_HOSTS: "127.0.0.1",
      },
      envText: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=127.0.0.1\n`,
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port), "--yes"],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "RAKAZO_TRUSTED_ORIGINS is invalid in the shell; no .env changes were made.\n",
    );
    expect(captures.stderr.mock.calls.flat().join("")).not.toContain(invalid);
    expect(captures.stderr.mock.calls.flat().join("")).not.toContain("synthetic-secret");
    expect(captures.stdout.mock.calls.flat().join("")).not.toContain(invalid);
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("rejects invalid allowed hosts without printing credential-looking values", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const invalid = "user:synthetic-password@host.example.test";
    const captures = commandDependencies(port, {
      env: {},
      envText: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS=${invalid}\n`,
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port), "--yes"],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "RAKAZO_ALLOWED_HOSTS is invalid; no .env changes were made.\n",
    );
    expect(captures.stderr.mock.calls.flat().join("")).not.toContain(invalid);
    expect(captures.stdout.mock.calls.flat().join("")).not.toContain(invalid);
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
  });

  it("fails closed for multiline target syntax without printing its value", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const captures = commandDependencies(port, {
      env: {},
      envText: `RAKAZO_TRUSTED_ORIGINS=${origin}\nRAKAZO_ALLOWED_HOSTS="one.example.test,\ntwo.example.test"\n`,
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port), "--yes"],
        captures.dependencies,
      ),
    ).toBe(1);
    expect(captures.stderr).toHaveBeenCalledWith(
      "RAKAZO_ALLOWED_HOSTS uses unsupported .env syntax; no changes were made.\n",
    );
    expect(captures.stdout.mock.calls.flat().join("")).not.toContain("one.example.test");
    expect(captures.stderr.mock.calls.flat().join("")).not.toContain("one.example.test");
    expect(captures.dependencies.writeEnvFile).not.toHaveBeenCalled();
    expect(captures.qrEncoder).not.toHaveBeenCalled();
  });

  it("warns once for configured OIDC without printing secrets or URL credentials", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const captures = commandDependencies(port, {
      env: {
        RAKAZO_TRUSTED_ORIGINS: origin,
        RAKAZO_ALLOWED_HOSTS: "127.0.0.1",
        OIDC_ISSUER: "https://issuer.example.test",
        OIDC_CLIENT_ID: "synthetic-client-id",
        OIDC_CLIENT_SECRET: "synthetic-client-secret",
        BETTER_AUTH_URL:
          "https://user:synthetic-password@auth.example.test/private?token=synthetic-token",
      },
    });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output.match(/Warning: SSO returns to BETTER_AUTH_URL/g)).toHaveLength(1);
    expect(output).toContain("BETTER_AUTH_URL (https://auth.example.test)");
    expect(output).toContain("Make sure this URL is reachable from the phone.");
    expect(output).not.toContain("which this phone cannot open");
    expect(output).toContain(`${origin}/api/auth/callback/oidc`);
    expect(output).toContain(`set BETTER_AUTH_URL to ${origin}`);
    expect(output).not.toContain("synthetic-client");
    expect(output).not.toContain("synthetic-password");
    expect(output).not.toContain("synthetic-token");
    expect(output).not.toContain("/private");
  });

  it("loads OIDC and BETTER_AUTH_URL settings from dotenv text", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const envText = [
      "OIDC_ISSUER=https://issuer.example.test",
      "OIDC_CLIENT_ID=synthetic-file-client",
      "OIDC_CLIENT_SECRET=synthetic-file-secret",
      "BETTER_AUTH_URL=https://auth-from-file.example.test/private",
      "WEB_ORIGIN=https://web-fallback.example.test",
      `RAKAZO_TRUSTED_ORIGINS=${origin}`,
      "RAKAZO_ALLOWED_HOSTS=127.0.0.1",
    ].join("\n");
    const captures = commandDependencies(port, { env: {}, envText });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output.match(/Warning: SSO returns to BETTER_AUTH_URL/g)).toHaveLength(1);
    expect(output).toContain("BETTER_AUTH_URL (https://auth-from-file.example.test)");
    expect(output).toContain("Make sure this URL is reachable from the phone.");
    expect(output).not.toContain("synthetic-file-client");
    expect(output).not.toContain("synthetic-file-secret");
    expect(output).not.toContain("/private");
  });

  it.each([
    [
      "WEB_ORIGIN",
      "WEB_ORIGIN=https://web-fallback.example.test",
      "https://web-fallback.example.test",
    ],
    ["the API default", "", "http://127.0.0.1:5173"],
  ])("uses %s when BETTER_AUTH_URL is absent", async (_name, fallbackSetting, authUrl) => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const origin = `http://127.0.0.1:${port}`;
    const envText = [
      "OIDC_ISSUER=https://issuer.example.test",
      "OIDC_CLIENT_ID=synthetic-file-client",
      "OIDC_CLIENT_SECRET=synthetic-file-secret",
      fallbackSetting,
      `RAKAZO_TRUSTED_ORIGINS=${origin}`,
      "RAKAZO_ALLOWED_HOSTS=127.0.0.1",
    ]
      .filter(Boolean)
      .join("\n");
    const captures = commandDependencies(port, { env: {}, envText });

    expect(
      await main(
        ["--method", "url", "--url", origin, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    const output = captures.stdout.mock.calls.flat().join("");
    expect(output.match(/Warning: SSO returns to BETTER_AUTH_URL/g)).toHaveLength(1);
    expect(output).toContain(`BETTER_AUTH_URL (${authUrl})`);
    expect(output).toContain("Make sure this URL is reachable from the phone.");
    expect(output).not.toContain("synthetic-file-client");
    expect(output).not.toContain("synthetic-file-secret");
  });

  it("does not warn for partial OIDC settings", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ json: { ok: true } }));
    });
    const captures = commandDependencies(port, {
      env: {
        RAKAZO_TRUSTED_ORIGINS: `http://127.0.0.1:${port}`,
        RAKAZO_ALLOWED_HOSTS: "127.0.0.1",
        OIDC_ISSUER: "https://issuer.example.test",
      },
    });

    expect(
      await main(
        ["--method", "url", "--url", `http://127.0.0.1:${port}`, "--web-port", String(port)],
        captures.dependencies,
      ),
    ).toBe(0);
    expect(captures.stdout.mock.calls.flat().join("")).not.toContain("Warning: SSO returns");
  });

  it("checks that the loopback listener helper recognizes a port-0 server", async () => {
    const { port } = await startServer((_request, response) => response.end("ok"));
    expect(await isLoopbackPortListening(port)).toBe(true);
    expect(await isLoopbackPortListening(1)).toBe(false);
  });
});
