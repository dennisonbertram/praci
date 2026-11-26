import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createTailscaleAccessMethod } from "./tailscale.mjs";

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

function fakeRunner({
  status = fixture("status-running"),
  serveStatuses = [fixture("serve-empty"), fixture("serve-private")],
  version = { code: 0, stdout: "1.0.0\n", stderr: "" },
  statusResult,
  serveStatusResult,
  serveResult = { code: 0, stdout: "", stderr: "" },
  serveCommand,
} = {}) {
  const calls = [];
  let serveStatusIndex = 0;
  const run = vi.fn(async (command, args, options) => {
    calls.push({ command, args });
    if (args[0] === "version") return version;
    if (args[0] === "status") {
      if (statusResult) return statusResult;
      return { code: 0, stdout: JSON.stringify(status), stderr: "" };
    }
    if (args[0] === "serve" && args[1] === "status") {
      if (serveStatusResult) return serveStatusResult;
      const index = Math.min(serveStatusIndex, serveStatuses.length - 1);
      serveStatusIndex += 1;
      return { code: 0, stdout: JSON.stringify(serveStatuses[index]), stderr: "" };
    }
    if (args[0] === "serve" && args[1] === "--bg") {
      return serveCommand ? serveCommand(options) : serveResult;
    }
    throw new Error("Unexpected command in fixture runner.");
  });
  return { calls, run };
}

function context(run, timeoutMs = 1000) {
  return { webPort: 5173, timeoutMs, run };
}

const loginError = "Tailscale needs sign-in; sign in with the Tailscale app.";
const stoppedError = "Tailscale is stopped; start it from the Tailscale app.";
const statusError = "Could not read Tailscale status; verify the Tailscale connection.";
const serveStatusError =
  "Could not read Tailscale Serve status; verify the Tailscale configuration.";
const serveConfigureError = "Could not configure Tailscale Serve; check Tailscale Serve status.";
const httpsError =
  "HTTPS certificates are unavailable for this machine; enable them in the Tailscale admin console DNS settings.";
const portConflict =
  "Tailscale Serve already uses HTTPS port 443; change that Serve configuration.";

describe("Tailscale access method", () => {
  it("bounds the default-selection presence probe and aborts a stuck command", async () => {
    let aborted = false;
    const run = vi.fn((_command, _args, options) => {
      options.signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise(() => {});
    });

    await expect(createTailscaleAccessMethod().isAvailable(context(run, 20))).resolves.toBe(false);
    expect(aborted).toBe(true);
  });

  it("publishes the validated machine origin after configuring private HTTPS Serve", async () => {
    const { calls, run } = fakeRunner();

    await expect(createTailscaleAccessMethod().resolve(context(run))).resolves.toEqual({
      url: "https://my-mac.example.ts.net",
    });
    expect(calls.map(({ args }) => args)).toEqual([
      ["version"],
      ["status", "--json"],
      ["serve", "status", "--json"],
      ["serve", "--bg", "--https=443", "http://127.0.0.1:5173"],
      ["serve", "status", "--json"],
    ]);
    expect(
      calls.every(
        ({ command, args }) =>
          command === "tailscale" && !/^(funnel|up|login|cert)$/i.test(args[0]),
      ),
    ).toBe(true);
  });

  it.each([{}, null])("accepts an empty Serve configuration: %s", async (emptyConfig) => {
    const { calls, run } = fakeRunner({ serveStatuses: [emptyConfig, fixture("serve-private")] });

    await expect(createTailscaleAccessMethod().resolve(context(run))).resolves.toEqual({
      url: "https://my-mac.example.ts.net",
    });
    expect(calls.some(({ args }) => args[0] === "serve" && args[1] === "--bg")).toBe(true);
  });

  it("does not mutate an identical private Serve configuration", async () => {
    const { calls, run } = fakeRunner({ serveStatuses: [fixture("serve-private")] });

    await expect(createTailscaleAccessMethod().resolve(context(run))).resolves.toEqual({
      url: "https://my-mac.example.ts.net",
    });
    expect(calls.map(({ args }) => args)).toEqual([
      ["version"],
      ["status", "--json"],
      ["serve", "status", "--json"],
    ]);
  });

  it("is idempotent when the access method is resolved repeatedly", async () => {
    const { calls, run } = fakeRunner();
    const method = createTailscaleAccessMethod();

    await expect(method.resolve(context(run))).resolves.toEqual({
      url: "https://my-mac.example.ts.net",
    });
    await expect(method.resolve(context(run))).resolves.toEqual({
      url: "https://my-mac.example.ts.net",
    });
    expect(calls.filter(({ args }) => args[0] === "serve" && args[1] === "--bg")).toHaveLength(1);
  });

  it("does not return an origin when the resulting Serve config cannot be verified", async () => {
    const { calls, run } = fakeRunner({
      serveStatuses: [fixture("serve-empty"), fixture("serve-empty")],
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: "Could not verify the Tailscale Serve configuration; check Tailscale Serve status.",
    });
    expect(calls.some(({ args }) => args[0] === "serve" && args[1] === "--bg")).toBe(true);
  });

  it.each([
    ["missing CLI", null, "Tailscale CLI was not found; install the Tailscale app."],
    ["login required", fixture("status-needs-login"), loginError],
    ["stopped", fixture("status-stopped"), stoppedError],
    [
      "MagicDNS disabled",
      fixture("status-magicdns-disabled"),
      "MagicDNS is disabled; enable it in the Tailscale admin console DNS settings.",
    ],
    ["HTTPS certificates absent", fixture("status-no-certificates"), httpsError],
    ["missing DNS field", fixture("status-missing-dns"), statusError],
    [
      "certificate does not cover the machine",
      {
        ...fixture("status-running"),
        CertDomains: ["other.example.ts.net"],
      },
      httpsError,
    ],
    [
      "parent certificate domain does not match the machine",
      {
        ...fixture("status-running"),
        CertDomains: ["example.ts.net"],
      },
      httpsError,
    ],
    [
      "missing MagicDNS status",
      {
        ...fixture("status-running"),
        CurrentTailnet: {},
      },
      statusError,
    ],
    [
      "missing certificate domains",
      { ...fixture("status-running"), CertDomains: undefined },
      statusError,
    ],
    ["malformed status JSON", "not JSON", statusError],
  ])("reports %s without exposing command output", async (_name, status, expectedMessage) => {
    const missingCli = _name === "missing CLI";
    const run = vi.fn(async (_command, args) => {
      if (args[0] === "version" && missingCli) {
        throw Object.assign(new Error("private executable path"), { code: "ENOENT" });
      }
      if (args[0] === "version") return { code: 0, stdout: "1.0.0", stderr: "" };
      return {
        code: 0,
        stdout: typeof status === "string" ? status : JSON.stringify(status),
        stderr: "private stderr detail",
      };
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: expectedMessage,
    });
    expect(run.mock.calls.some(([, args]) => args[0] === "serve")).toBe(false);
  });

  it.each([
    "https://my-mac.example.ts.net",
    "my-mac.example.ts.net/path",
    "my-mac.example.ts.net?query=value",
    "my-mac.example.ts.net#fragment",
    "my-mac.example.ts.net@other.example.ts.net",
  ])("rejects a DNS name containing URL syntax: %s", async (dnsName) => {
    const { run } = fakeRunner({
      status: {
        ...fixture("status-running"),
        Self: { DNSName: dnsName },
      },
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: statusError,
    });
    expect(run.mock.calls.some(([, args]) => args[0] === "serve")).toBe(false);
  });

  it.each([
    ["public endpoint", fixture("serve-public")],
    ["conflicting port or handler", fixture("serve-conflict")],
    ["foreground configuration", fixture("serve-foreground")],
    ["unrecognized config field", { Unknown: true }],
    ["malformed port config", { TCP: { 443: "https" } }],
    ["missing handler map", { Web: { "my-mac.example.ts.net:443": {} } }],
    ["null handler map", { Web: { "my-mac.example.ts.net:443": { Handlers: null } } }],
    ["null foreground config", { Foreground: { "synthetic-session": null } }],
    [
      "additional handler on the HTTPS endpoint",
      {
        ...fixture("serve-private"),
        Web: {
          "my-mac.example.ts.net:443": {
            Handlers: {
              "/": { Proxy: "http://127.0.0.1:5173" },
              "/other": { Proxy: "http://127.0.0.1:3000" },
            },
          },
        },
      },
    ],
    [
      "extra field on the endpoint handler",
      {
        ...fixture("serve-private"),
        Web: {
          "my-mac.example.ts.net:443": {
            Handlers: { "/": { Proxy: "http://127.0.0.1:5173", Text: "other" } },
          },
        },
      },
    ],
    ["unsupported Services configuration", { Services: { "svc:example": {} } }],
  ])("refuses %s without changing Serve", async (_name, serveStatus) => {
    const { calls, run } = fakeRunner({ serveStatuses: [serveStatus] });
    const malformedServeConfig = [
      "unrecognized config field",
      "malformed port config",
      "missing handler map",
      "null handler map",
      "null foreground config",
    ].includes(_name);
    const expected =
      _name === "public endpoint"
        ? "Tailscale Serve has public access enabled for this endpoint; disable public access before retrying."
        : _name === "unsupported Services configuration"
          ? "Tailscale Service configuration is present; choose another access method."
          : malformedServeConfig
            ? serveStatusError
            : portConflict;

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: expected,
    });
    expect(calls.some(({ args }) => args[0] === "serve" && args[1] === "--bg")).toBe(false);
  });

  it("refuses public access enabled in a foreground config", async () => {
    const { calls, run } = fakeRunner({
      serveStatuses: [
        {
          Foreground: {
            "synthetic-session": {
              AllowFunnel: { "my-mac.example.ts.net:443": true },
            },
          },
        },
      ],
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message:
        "Tailscale Serve has public access enabled for this endpoint; disable public access before retrying.",
    });
    expect(calls.some(({ args }) => args[0] === "serve" && args[1] === "--bg")).toBe(false);
  });

  it.each(["stdout", "stderr"])(
    "retains a safe admin link printed on %s when Serve times out",
    async (stream) => {
      let aborted = false;
      const { run } = fakeRunner({
        serveStatuses: [fixture("serve-empty")],
        serveCommand: (options) => {
          options.onOutput(stream, "Enable Serve: https://login.tailscale.com/admin/serve\n");
          options.signal.addEventListener("abort", () => {
            aborted = true;
          });
          return new Promise(() => {});
        },
      });

      await expect(createTailscaleAccessMethod().resolve(context(run, 20))).rejects.toMatchObject({
        name: "AccessError",
        message:
          "Tailscale Serve is not enabled; enable Serve in the Tailscale admin console: https://login.tailscale.com/admin/serve",
      });
      expect(aborted).toBe(true);
    },
  );

  it("finds a safe login link split across output chunks before a timeout", async () => {
    const { run } = fakeRunner({
      serveStatuses: [fixture("serve-empty")],
      serveCommand: (options) => {
        options.onOutput("stdout", "Enable Serve: https://login.tailscale.com/admin/");
        options.onOutput("stdout", `serve\n${"x".repeat(9000)}`);
        return new Promise(() => {});
      },
    });

    await expect(createTailscaleAccessMethod().resolve(context(run, 20))).rejects.toMatchObject({
      name: "AccessError",
      message:
        "Tailscale Serve is not enabled; enable Serve in the Tailscale admin console: https://login.tailscale.com/admin/serve",
    });
  });

  it("uses the admin-console action when a timed-out Serve command prints no link", async () => {
    const { run } = fakeRunner({
      serveStatuses: [fixture("serve-empty")],
      serveCommand: () => new Promise(() => {}),
    });

    await expect(createTailscaleAccessMethod().resolve(context(run, 20))).rejects.toMatchObject({
      name: "AccessError",
      message: "Tailscale Serve is not enabled; enable Serve in the Tailscale admin console.",
    });
  });

  it.each(["stdout", "stderr"])(
    "uses a safe buffered approval link from %s even when Serve exits nonzero",
    async (stream) => {
      const link = "https://login.tailscale.com/admin/serve";
      let outputHook;
      const { run } = fakeRunner({
        serveStatuses: [fixture("serve-empty")],
        serveCommand: (options) => {
          outputHook = vi.fn(options.onOutput);
          return {
            code: 1,
            stdout: stream === "stdout" ? `Enable Serve: ${link}` : "",
            stderr: stream === "stderr" ? `Enable Serve: ${link}` : "private permission error",
          };
        },
      });

      await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
        name: "AccessError",
        message: `Tailscale Serve is not enabled; enable Serve in the Tailscale admin console: ${link}`,
      });
      expect(outputHook).not.toHaveBeenCalled();
    },
  );

  it("hides raw permission errors when Serve configuration fails", async () => {
    const { run } = fakeRunner({
      serveStatuses: [fixture("serve-empty")],
      serveResult: { code: 1, stdout: "", stderr: "permission denied: private path" },
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: serveConfigureError,
    });
  });

  it.each([
    ["untrusted host", "https://example.com/admin/serve"],
    ["host suffix", "https://login.tailscale.com.example.com/admin/serve"],
    ["userinfo", "https://user@login.tailscale.com/admin/serve"],
    ["empty userinfo", "https://@login.tailscale.com/admin/serve"],
    ["nonstandard port", "https://login.tailscale.com:444/admin/serve"],
    ["terminal control", `https://login.tailscale.com/admin/serve${String.fromCharCode(27)}[31m`],
  ])("does not print an unsafe approval link with %s", async (_case, unsafeLink) => {
    const { run } = fakeRunner({
      serveStatuses: [fixture("serve-empty")],
      serveCommand: (options) => {
        options.onOutput("stderr", `Enable Serve: ${unsafeLink}\n`);
        return { code: 1, stdout: "", stderr: "private command output" };
      },
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: serveConfigureError,
    });
  });

  it("returns only AccessError when an injected command fails", async () => {
    const run = vi.fn(async () => {
      throw new Error("private command stderr and path");
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: "Tailscale CLI could not be verified; check the Tailscale installation.",
    });
  });

  it("returns an actionable AccessError when the version command fails", async () => {
    const { calls, run } = fakeRunner({
      version: { code: 1, stdout: "", stderr: "private output" },
    });

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: "Tailscale CLI could not be verified; check the Tailscale installation.",
    });
    expect(calls).toHaveLength(1);
  });

  it.each([
    [
      "status command failure",
      { statusResult: { code: 1, stdout: "", stderr: "private output" } },
      statusError,
    ],
    [
      "Serve status command failure",
      { serveStatusResult: { code: 1, stdout: "", stderr: "private output" } },
      serveStatusError,
    ],
    ["malformed Serve status JSON", { serveStatuses: ["not JSON"] }, serveStatusError],
    [
      "malformed certificate domains",
      { status: { ...fixture("status-running"), CertDomains: [null] } },
      statusError,
    ],
  ])("returns a generic AccessError for %s", async (_name, runnerOptions, expectedMessage) => {
    const { run } = fakeRunner(runnerOptions);

    await expect(createTailscaleAccessMethod().resolve(context(run))).rejects.toMatchObject({
      name: "AccessError",
      message: expectedMessage,
    });
  });
});
