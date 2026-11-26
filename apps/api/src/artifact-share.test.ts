import type { ArtifactStore } from "@rakazo/adapter-kit";
import { createLogger, createTestSink, installLogger } from "@rakazo/logging";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShareStore } from "./artifact-share.js";
import { mountArtifactShare } from "./artifact-share.js";
import { mountApiRequestBodyLimits } from "./request-body-limit.js";

const TOKEN = "good-token";
const shared = {
  name: "Dashboard.html",
  mimeType: "text/html",
  spaceId: "space-1",
  userId: "user-1",
  storageKey: "key-1",
};

function setup() {
  const open = vi.fn(async (token: string) => (token === TOKEN ? shared : null));
  const store: ShareStore = { open };
  const get = vi.fn(async () => new TextEncoder().encode("<h1>hi</h1>"));
  const artifacts = { get } as unknown as ArtifactStore;
  const app = new Hono();
  mountApiRequestBodyLimits(app);
  mountArtifactShare(app, { store, artifacts });
  return { app, open, get };
}
const post = (app: Hono, token: unknown, headers: Record<string, string> = {}) =>
  app.request("/api/share/open", {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: { "content-type": "application/json", ...headers },
  });
const expectHeaders = (res: Response) => {
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("set-cookie")).toBeNull();
};

describe("public share endpoint", () => {
  afterEach(() => {
    installLogger(createLogger({ service: "rakazo-api", level: "off", sinks: [] }));
  });

  it("returns only the shared artifact, with private headers and no cookie", async () => {
    const { app, open, get } = setup();
    const res = await post(app, TOKEN);
    expect(res.status).toBe(200);
    expectHeaders(res);
    const body = await res.json();
    expect(body).toEqual({
      name: "Dashboard.html",
      mimeType: "text/html",
      contentBase64: Buffer.from("<h1>hi</h1>").toString("base64"),
    });
    expect(open).toHaveBeenCalledWith(TOKEN);
    // The blob is read in the space and for the user the share row names, nothing else.
    expect(get).toHaveBeenCalledWith(
      "key-1",
      expect.objectContaining({ spaceId: "space-1", userId: "user-1" }),
    );
  });

  it("unknown, expired and revoked tokens (all null from the store) give one identical 404", async () => {
    const { app } = setup();
    const responses = await Promise.all([
      post(app, "unknown"),
      post(app, ""),
      app.request("/api/share/open", { method: "POST", body: "not json" }),
    ]);
    const bodies = await Promise.all(responses.map((r) => r.text()));
    for (const res of responses) {
      expect(res.status).toBe(404);
      expectHeaders(res);
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it("answers 429 with the private headers when the store reports the link is over its limit", async () => {
    const { app, open, get } = setup();
    open.mockResolvedValueOnce("limited" as never);
    const res = await post(app, TOKEN);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ error: "Too many requests" });
    expectHeaders(res);
    expect(get).not.toHaveBeenCalled();
  });

  it("ignores the session cookie: the same artifact comes back with or without one", async () => {
    const { app, open } = setup();
    const withCookie = await post(app, TOKEN, { cookie: "better-auth.session_token=other-user" });
    const without = await post(app, TOKEN);
    expect(await withCookie.json()).toEqual(await without.json());
    // The store only ever sees the token.
    expect(open.mock.calls.every((call) => call.length === 1)).toBe(true);
  });

  it("a GET with the token in the URL opens nothing", async () => {
    const { app, open } = setup();
    const res = await app.request(`/api/share/open?token=${TOKEN}`);
    expect(res.status).toBe(404);
    expect(open).not.toHaveBeenCalled();
  });

  it("a storage failure is a 500 that still carries the private headers", async () => {
    const { app, get } = setup();
    get.mockRejectedValueOnce(new Error("disk"));
    const res = await post(app, TOKEN);
    expect(res.status).toBe(500);
    expectHeaders(res);
  });

  it("logs a storage failure with an operation id and never the token", async () => {
    const sink = createTestSink();
    installLogger(createLogger({ service: "rakazo-api", sinks: [sink] }));
    const { app, get } = setup();
    get.mockRejectedValueOnce(new Error("disk"));
    await post(app, TOKEN);
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      message: "shared artifact open failed",
      error: { message: "disk" },
    });
    expect(JSON.stringify(sink.events)).toContain("share.open:");
    expect(JSON.stringify(sink.events)).not.toContain(TOKEN);
  });

  it("an oversized body, a 513-character token and a non-string token are refused", async () => {
    const { app } = setup();
    const big = await app.request("/api/share/open", {
      method: "POST",
      body: JSON.stringify({ token: "x".repeat(100_000) }),
      headers: { "content-type": "application/json" },
    });
    expect(big.status).toBe(413);
    const long = await post(app, "x".repeat(513));
    const num = await post(app, 123);
    const unknown = await post(app, "unknown");
    expect(long.status).toBe(404);
    expect(num.status).toBe(404);
    expect(await long.text()).toBe(await unknown.text());
  });
});
