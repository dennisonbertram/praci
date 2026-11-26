import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AccessError, createLanAccessMethod, createUrlAccessMethod, run } from "./access.mjs";
import { createTailscaleAccessMethod } from "./tailscale.mjs";

const context = { webPort: 5173, timeoutMs: 1000, run: vi.fn() };

async function expectChildExit(pid) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("The terminated child process is still alive.");
}

describe("url access method", () => {
  it("implements the AccessMethod contract and returns only the URL origin", async () => {
    const method = createUrlAccessMethod("https://my-mac.example.ts.net/some/path?tab=1#top");
    expect(method.id).toBe("url");
    await expect(method.resolve(context)).resolves.toEqual({
      url: "https://my-mac.example.ts.net",
    });
    expect(context.run).not.toHaveBeenCalled();
  });

  it.each([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
    "http://rakazo.local:5173",
    "http://10.0.0.8:5173",
    "http://172.31.0.1:5173",
    "http://192.168.1.20:5173",
    "http://100.100.1.2:5173",
    "https://[fd00::1]:5173",
  ])("accepts %s", async (value) => {
    await expect(createUrlAccessMethod(value).resolve(context)).resolves.toHaveProperty("url");
  });

  it.each([
    "http://example.com",
    "http://127.0.0.2",
    "http://127.1",
    "http://[fd00::1]:5173",
    "ftp://example.com",
  ])("throws only AccessError for rejected URL %s", async (value) => {
    await expect(createUrlAccessMethod(value).resolve(context)).rejects.toBeInstanceOf(AccessError);
  });

  it("rejects a noncanonical numeric host that normalizes to a public address", async () => {
    const value = "http://010.0.0.1:5173";
    expect(new URL(value).hostname).toBe("8.0.0.1");
    await expect(createUrlAccessMethod(value).resolve(context)).rejects.toBeInstanceOf(AccessError);
  });

  it("drops credentials from an accepted origin", async () => {
    await expect(
      createUrlAccessMethod("https://user:password@my-mac.example.ts.net/path").resolve(context),
    ).resolves.toEqual({ url: "https://my-mac.example.ts.net" });
  });
});

describe("LAN access method", () => {
  it("selects the sole external RFC1918 IPv4 address, skipping internal, public, and IPv6", async () => {
    const networkInterfaces = vi.fn(() => ({
      loopback: [
        { family: "IPv4", address: "127.0.0.1", internal: true },
        { family: "IPv4", address: "192.168.1.50", internal: true },
      ],
      external: [
        { family: "IPv4", address: "100.100.1.2", internal: false },
        { family: "IPv4", address: "203.0.113.8", internal: false },
        { family: "IPv6", address: "fd00::1", internal: false },
        { family: 4, address: "192.168.1.20", internal: false },
      ],
    }));
    const method = createLanAccessMethod({ networkInterfaces });

    expect(method.id).toBe("lan");
    await expect(method.resolve(context)).resolves.toEqual({ url: "http://192.168.1.20:5173" });
    expect(networkInterfaces).toHaveBeenCalledOnce();
    expect(context.run).not.toHaveBeenCalled();
  });

  it("skips a Docker bridge before a Wi-Fi address", async () => {
    const method = createLanAccessMethod({
      networkInterfaces: () => ({
        docker0: [{ family: "IPv4", address: "172.17.0.1", internal: false }],
        wlan0: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
      }),
    });

    await expect(method.resolve(context)).resolves.toEqual({ url: "http://192.168.1.20:5173" });
  });

  it("does not choose addresses from Docker bridges or veth links alone", async () => {
    const method = createLanAccessMethod({
      networkInterfaces: () => ({
        docker0: [{ family: "IPv4", address: "172.17.0.1", internal: false }],
        docker12: [{ family: "IPv4", address: "172.18.0.1", internal: false }],
        "br-0123456789ab": [{ family: "IPv4", address: "172.19.0.1", internal: false }],
        vethabcd: [{ family: "IPv4", address: "10.0.0.8", internal: false }],
      }),
    });

    await expect(method.resolve(context)).rejects.toMatchObject({
      name: "AccessError",
      message:
        "No private IPv4 address is available for LAN access. Use --method url --url with a reachable server origin.",
    });
  });

  it("does not exclude generic bridge names", async () => {
    const method = createLanAccessMethod({
      networkInterfaces: () => ({
        br0: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
      }),
    });

    await expect(method.resolve(context)).resolves.toEqual({ url: "http://192.168.1.20:5173" });
  });

  it("rejects multiple distinct private IPv4 addresses with an explicit URL fallback", async () => {
    const method = createLanAccessMethod({
      networkInterfaces: () => ({
        wlan0: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
        eth0: [{ family: "IPv4", address: "10.0.0.8", internal: false }],
      }),
    });

    await expect(method.resolve(context)).rejects.toMatchObject({
      name: "AccessError",
      message:
        "Multiple private IPv4 addresses are available for LAN access. Use --method url --url with a reachable server origin.",
    });
  });

  it("deduplicates an address reported on multiple interfaces", async () => {
    const method = createLanAccessMethod({
      networkInterfaces: () => ({
        wlan0: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
        eth0: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
      }),
    });

    await expect(method.resolve(context)).resolves.toEqual({ url: "http://192.168.1.20:5173" });
  });

  it("throws AccessError when no private address is available", async () => {
    const method = createLanAccessMethod({
      networkInterfaces: () => ({
        external: [{ family: "IPv4", address: "203.0.113.8", internal: false }],
      }),
    });
    await expect(method.resolve(context)).rejects.toMatchObject({
      name: "AccessError",
      message:
        "No private IPv4 address is available for LAN access. Use --method url --url with a reachable server origin.",
    });
  });

  it("converts network interface failures to AccessError", async () => {
    const method = createLanAccessMethod({
      networkInterfaces: () => {
        throw new Error("private implementation detail");
      },
    });
    await expect(method.resolve(context)).rejects.toBeInstanceOf(AccessError);
    await expect(method.resolve(context)).rejects.not.toThrow("private implementation detail");
  });
});

function tailscaleFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

function tailscaleRunner(statusName) {
  return vi.fn(async (_command, args) => {
    if (args[0] === "version") return { code: 0, stdout: "1.0.0", stderr: "" };
    if (args[0] === "status") {
      return { code: 0, stdout: JSON.stringify(tailscaleFixture(statusName)), stderr: "" };
    }
    if (args[0] === "serve" && args[1] === "status") {
      return { code: 0, stdout: JSON.stringify(tailscaleFixture("serve-private")), stderr: "" };
    }
    throw new Error("Unexpected command in conformance runner.");
  });
}

const accessMethodConformanceCases = [
  {
    id: "url",
    createSuccess: () => createUrlAccessMethod("https://my-mac.example.ts.net/path"),
    createFailure: () => createUrlAccessMethod("ftp://example.com"),
    successRunner: () => vi.fn(),
    failureRunner: () => vi.fn(),
  },
  {
    id: "lan",
    createSuccess: () =>
      createLanAccessMethod({
        networkInterfaces: () => ({
          external: [{ family: "IPv4", address: "192.168.1.20", internal: false }],
        }),
      }),
    createFailure: () => createLanAccessMethod({ networkInterfaces: () => ({}) }),
    successRunner: () => vi.fn(),
    failureRunner: () => vi.fn(),
  },
  {
    id: "tailscale",
    createSuccess: () => createTailscaleAccessMethod(),
    createFailure: () => createTailscaleAccessMethod(),
    successRunner: () => tailscaleRunner("status-running"),
    failureRunner: () => tailscaleRunner("status-needs-login"),
  },
];

describe("shared access method conformance", () => {
  it.each(accessMethodConformanceCases)(
    "$id returns an origin or AccessError without forbidden commands",
    async (testCase) => {
      const successRun = testCase.successRunner();
      const success = await testCase.createSuccess().resolve({
        webPort: 5173,
        timeoutMs: 1000,
        run: successRun,
      });
      expect(success).toEqual({ url: new URL(success.url).origin });

      const failureRun = testCase.failureRunner();
      await expect(
        testCase.createFailure().resolve({ webPort: 5173, timeoutMs: 1000, run: failureRun }),
      ).rejects.toBeInstanceOf(AccessError);

      for (const [command, args] of [...successRun.mock.calls, ...failureRun.mock.calls]) {
        expect(command).toBe("tailscale");
        expect(args[0]).not.toMatch(/^(funnel|up|login|cert)$/i);
      }
    },
  );
});

describe("injected command runner", () => {
  it("accepts argument arrays without invoking a shell", async () => {
    await expect(run(process.execPath, ["-e", "process.stdout.write('ready')"])).resolves.toEqual({
      code: 0,
      stdout: "ready",
      stderr: "",
    });
  });

  it("closes child stdin so a process waiting for EOF can finish", async () => {
    await expect(
      run(process.execPath, [
        "-e",
        "process.stdin.resume(); process.stdin.once('end', () => process.stdout.write('stdin closed'))",
      ]),
    ).resolves.toEqual({ code: 0, stdout: "stdin closed", stderr: "" });
  });

  it("rejects when execFile exceeds the supplied timeout", async () => {
    await expect(
      run(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], { timeoutMs: 20 }),
    ).rejects.toBeTruthy();
  });

  it("kills a child that ignores SIGTERM after the command timeout", async () => {
    let output = "";
    await expect(
      run(
        process.execPath,
        [
          "-e",
          "process.on('SIGTERM', () => {}); process.stdout.write('ready:' + process.pid); setInterval(() => {}, 1000)",
        ],
        {
          timeoutMs: 1000,
          onOutput: (_stream, chunk) => {
            output += chunk;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "ETIMEDOUT" });

    const childPid = Number(/ready:(\d+)/.exec(output)?.[1]);
    expect(Number.isInteger(childPid)).toBe(true);
    await expectChildExit(childPid);
  });

  it("kills a child when an injected abort signal fires", async () => {
    const controller = new AbortController();
    let output = "";
    const pending = run(
      process.execPath,
      [
        "-e",
        "process.on('SIGTERM', () => {}); process.stdout.write('ready:' + process.pid); setInterval(() => {}, 1000)",
      ],
      {
        timeoutMs: 1000,
        signal: controller.signal,
        onOutput: (_stream, chunk) => {
          output += chunk;
          if (output.includes("ready:")) controller.abort();
        },
      },
    );

    await expect(pending).rejects.toMatchObject({ name: "AbortError", code: "ABORT_ERR" });
    const childPid = Number(/ready:(\d+)/.exec(output)?.[1]);
    expect(Number.isInteger(childPid)).toBe(true);
    await expectChildExit(childPid);
  });
});
