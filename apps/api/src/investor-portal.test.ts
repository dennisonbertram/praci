import type { ArtifactStore } from "@rakazo/adapter-kit";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { PortalStore } from "./investor-portal.js";
import { mountInvestorPortal, PORTAL_PATH, portalNoStore } from "./investor-portal.js";
import { mountApiRequestBodyLimits } from "./request-body-limit.js";

const principal = { spaceId: "space-1", userId: "user-1", contactId: "contact-1" };
const WEB = "https://app.example.test";
const TOKEN = "secret-link-token";

function setup() {
  const store: PortalStore = {
    exchange: vi.fn(async (token: string) =>
      token === TOKEN ? { session: "session-value", principal } : null,
    ),
    resolve: vi.fn(async (session: string) => (session === "session-value" ? principal : null)),
    end: vi.fn(async () => undefined),
    identity: vi.fn(async () => ({ company: "Acme", name: "Ann" })),
    updates: vi.fn(async () => [{ id: "u1", subject: "Q1", body: "Hi", sentAt: null }]),
    documents: vi.fn(async () => [{ id: "d1", name: "deck.pdf", size: 4 }]),
    document: vi.fn(async (_p, id: string) =>
      id === "d1"
        ? { name: "deck.pdf", mimeType: "application/pdf", size: 4, storageKey: "key-1" }
        : null,
    ),
  };
  const getStream = vi.fn(async () => new Response("data").body as ReadableStream<Uint8Array>);
  const artifacts = { getStream } as unknown as ArtifactStore;
  const app = new Hono();
  // The same no-store middleware app.ts applies, and the body limit it mounts.
  app.use(PORTAL_PATH, portalNoStore);
  mountApiRequestBodyLimits(app);
  mountInvestorPortal(app, {
    store,
    artifacts,
    isTrustedOrigin: (origin) => origin === WEB,
  });
  return { app, store, getStream };
}

const post = (app: Hono, path: string, init: RequestInit = {}) =>
  app.request(path, { method: "POST", ...init });
const json = (body: unknown, headers: Record<string, string> = {}) => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json", ...headers },
});
const cookie = { cookie: "rakazo_portal=session-value" };

describe("open", () => {
  it("a GET opens nothing and sets no cookie: the token never travels in a request line", async () => {
    const { app, store } = setup();
    const res = await app.request(`/api/portal/open?token=${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(store.exchange).not.toHaveBeenCalled();
  });

  it("a POST with the token sets the session cookie with its flags", async () => {
    const { app, store } = setup();
    const res = await post(app, "/api/portal/open", json({ token: TOKEN }));
    expect(res.status).toBe(200);
    expect(store.exchange).toHaveBeenCalledWith(TOKEN);
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toContain("rakazo_portal=session-value");
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Secure");
    expect(set).toContain("SameSite=Lax");
    expect(set).toContain("Path=/api/portal");
    expect(set).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    // The cookie holds the session value, not the link token or the contact.
    expect(set).not.toContain(TOKEN);
    expect(set).not.toContain(principal.contactId);
    expect(await res.text()).not.toContain(TOKEN);
  });

  it("answers 401 with no cookie for a link that no longer works", async () => {
    const { app } = setup();
    const res = await post(app, "/api/portal/open", json({ token: "expired" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a malformed body", async () => {
    const { app, store } = setup();
    const res = await post(app, "/api/portal/open", json({ nope: true }));
    expect(res.status).toBe(400);
    expect(store.exchange).not.toHaveBeenCalled();
  });

  it("refuses a POST from a foreign Origin, and allows the web origin and none", async () => {
    const { app, store } = setup();
    const foreign = await post(
      app,
      "/api/portal/open",
      json({ token: TOKEN }, { origin: "https://evil.example.test" }),
    );
    expect(foreign.status).toBe(403);
    expect(store.exchange).not.toHaveBeenCalled();
    expect(
      (await post(app, "/api/portal/open", json({ token: TOKEN }, { origin: WEB }))).status,
    ).toBe(200);
    expect((await post(app, "/api/portal/open", json({ token: TOKEN }))).status).toBe(200);
  });

  it("refuses an oversized body before reading it", async () => {
    const { app, store } = setup();
    const res = await post(app, "/api/portal/open", json({ token: "x".repeat(70_000) }));
    expect(res.status).toBe(413);
    expect(store.exchange).not.toHaveBeenCalled();
  });
});

describe("session routes", () => {
  it("answers 401 without a cookie, with a wrong one, and for a session that was ended", async () => {
    const { app, store } = setup();
    for (const path of ["me", "updates", "documents", "documents/d1/content"]) {
      expect((await app.request(`/api/portal/${path}`)).status).toBe(401);
      expect(
        (await app.request(`/api/portal/${path}`, { headers: { cookie: "rakazo_portal=guess" } }))
          .status,
      ).toBe(401);
    }
    expect(store.identity).not.toHaveBeenCalled();
    expect(store.document).not.toHaveBeenCalled();
  });

  it("returns the company, the updates and the shared documents for the session's contact only", async () => {
    const { app, store } = setup();
    const me = await app.request("/api/portal/me", { headers: cookie });
    expect(await me.json()).toEqual({ company: "Acme", name: "Ann" });
    const updates = await app.request("/api/portal/updates", { headers: cookie });
    expect((await updates.json()) as unknown[]).toHaveLength(1);
    const documents = await app.request("/api/portal/documents", { headers: cookie });
    expect(await documents.json()).toEqual([{ id: "d1", name: "deck.pdf", size: 4 }]);
    expect(store.updates).toHaveBeenCalledWith(principal);
    expect(store.documents).toHaveBeenCalledWith(principal);
  });

  it("every portal response is private, no-store", async () => {
    const { app } = setup();
    const responses = await Promise.all([
      app.request("/api/portal/me"),
      app.request("/api/portal/me", { headers: cookie }),
      app.request("/api/portal/updates", { headers: cookie }),
      app.request("/api/portal/documents/d1/content", { headers: cookie }),
      app.request("/api/portal/documents/other/content", { headers: cookie }),
      app.request("/api/portal/open"),
      post(app, "/api/portal/open", json({ token: TOKEN })),
      post(app, "/api/portal/open", json({ token: "bad" })),
      post(app, "/api/portal/sign-out", { headers: cookie }),
    ]);
    for (const res of responses) expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("streams a shared document as a download", async () => {
    const { app, getStream } = setup();
    const res = await app.request("/api/portal/documents/d1/content", { headers: cookie });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("data");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(getStream).toHaveBeenCalledWith(
      "key-1",
      expect.objectContaining({ spaceId: "space-1", userId: "user-1" }),
    );
  });

  it("refuses an unshared item and never reaches artifact storage for it", async () => {
    const { app, getStream } = setup();
    const res = await app.request("/api/portal/documents/not-shared/content", { headers: cookie });
    expect(res.status).toBe(404);
    expect(getStream).not.toHaveBeenCalled();
  });

  it("signs out: ends the session and clears the cookie, from the web origin only", async () => {
    const { app, store } = setup();
    const foreign = await post(app, "/api/portal/sign-out", {
      headers: { ...cookie, origin: "https://evil.example.test" },
    });
    expect(foreign.status).toBe(403);
    expect(store.end).not.toHaveBeenCalled();
    const res = await post(app, "/api/portal/sign-out", { headers: cookie });
    expect(res.status).toBe(200);
    expect(store.end).toHaveBeenCalledWith("session-value");
    expect(res.headers.get("set-cookie")).toMatch(/rakazo_portal=;/);
    expect(res.headers.get("set-cookie")).toContain("Path=/api/portal");
  });
});
