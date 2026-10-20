import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { postSafeWebForm } from "./web-ssrf.js";

const publicResolver = async () => [{ address: "203.0.113.10", family: 4 as const }];
const BODY = "List-Unsubscribe=One-Click";

type Call = { url: string; init: RequestInit };
const recorder = (respond: (call: Call) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetch };
};
const post = (url: string, fetch: typeof globalThis.fetch, extra = {}) =>
  postSafeWebForm(url, BODY, { fetch, resolveHostname: publicResolver, ...extra });

describe("postSafeWebForm", () => {
  it("posts the exact form body with no cookies, credentials or authorization", async () => {
    const { calls, fetch } = recorder(() => new Response("ok", { status: 200 }));
    await post("https://lists.example.test/u/1", fetch);
    expect(calls).toHaveLength(1);
    const { init } = calls[0] as Call;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(BODY);
    expect(init.redirect).toBe("manual");
    expect(init.credentials).toBe("omit");
    const headers = Object.fromEntries(
      Object.entries(init.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]),
    );
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
  });

  it("treats any redirect as a failure and never follows it", async () => {
    for (const location of ["https://lists.example.test/done", "http://127.0.0.1/x"]) {
      const { calls, fetch } = recorder(
        () => new Response(null, { status: 302, headers: { location } }),
      );
      await expect(post("https://lists.example.test/u/1", fetch)).rejects.toThrow(/redirect/i);
      expect(calls).toHaveLength(1);
    }
  });

  it("refuses a host that resolves privately before any request", async () => {
    const { calls, fetch } = recorder(() => new Response("ok"));
    await expect(
      post("https://lists.example.test/u/1", fetch, {
        resolveHostname: async () => [{ address: "10.1.2.3", family: 4 as const }],
      }),
    ).rejects.toThrow(/private/i);
    expect(calls).toHaveLength(0);
  });

  it.each([
    "https://lists.example.test:8443/u",
    "http://lists.example.test/u",
    "https://user:pass@lists.example.test/u",
    "https://localhost/u",
    "https://127.0.0.1/u",
    "mailto:u@example.test",
  ])("refuses %s", async (url) => {
    const { calls, fetch } = recorder(() => new Response("ok"));
    await expect(post(url, fetch)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("succeeds on a 2xx and ignores the rest of a long answer", async () => {
    const { fetch } = recorder(() => new Response("x".repeat(200_000), { status: 200 }));
    await expect(post("https://lists.example.test/u/1", fetch)).resolves.toBeUndefined();
  });

  it("rejects a non-2xx answer", async () => {
    const { fetch } = recorder(() => new Response("no", { status: 500 }));
    await expect(post("https://lists.example.test/u/1", fetch)).rejects.toThrow(/500/);
  });

  it("aborts a hanging answer at the timeout", async () => {
    const hanging = new ReadableStream<Uint8Array>({ start() {} });
    const { fetch } = recorder(() => new Response(hanging, { status: 200 }));
    const started = Date.now();
    await expect(
      post("https://lists.example.test/u/1", fetch, { timeoutMs: 40, destroy: vi.fn() }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("never connects when the host rebinds to loopback", async () => {
    let connections = 0;
    const listener = createServer((_request, response) => response.end("reached"));
    listener.on("connection", () => {
      connections += 1;
    });
    await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const { port } = listener.address() as AddressInfo;
    let resolutions = 0;
    try {
      // allowedPorts is 443, so use the lower-level option to reach the connect path.
      await expect(
        postSafeWebForm(`https://rebind.test:${port}/`, BODY, {
          allowedPorts: [port],
          resolveHostname: async () => {
            resolutions += 1;
            return resolutions === 1
              ? [{ address: "203.0.113.10", family: 4 as const }]
              : [{ address: "127.0.0.1", family: 4 as const }];
          },
        }),
      ).rejects.toThrow();
      expect(connections).toBe(0);
    } finally {
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  });
});
