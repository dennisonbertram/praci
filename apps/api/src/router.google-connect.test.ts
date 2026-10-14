import { RPCHandler } from "@orpc/server/fetch";
import type { ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { type Actor, GOOGLE_DESKTOP_REDIRECT_URI } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

type Row = Record<string, unknown>;
const STATE = "s".repeat(43);
const owner: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (want && typeof want === "object" && "not" in want)
      return row[key] !== (want as { not: unknown }).not;
    if (want && typeof want === "object" && "in" in want)
      return (want as { in: unknown[] }).in.includes(row[key]);
    return row[key] === want;
  });
}

function pendingGoogleRow(overrides: Row = {}): Row {
  return {
    id: "conn-1",
    spaceId: "space-1",
    userId: "user-1",
    connectorId: "google",
    provider: "gmail",
    displayName: "Gmail",
    status: "pending",
    providerRef: STATE,
    secretId: null,
    metadata: { state: STATE },
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

function harness(rows: Row[], connector: Partial<ManagedConnectorProvider>) {
  const deletedSecrets: string[] = [];
  const table = {
    findFirst: vi.fn(
      async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null,
    ),
    findMany: vi.fn(async ({ where }: { where: Row }) => rows.filter((r) => matches(r, where))),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error("missing row");
      return Object.assign(row, data);
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    }),
  };
  const client = {
    connection: table,
    secret: {
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        deletedSecrets.push(where.id);
        return { count: 1 };
      }),
    },
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: vi.fn(async () => []),
  };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => fn(client)),
  };
  const deps = {
    prisma: prisma as unknown as PrismaClient,
    connectors: { managed: vi.fn(() => connector as ManagedConnectorProvider) },
    env: {
      defaultProvider: "fake",
      defaultModel: "fake-model",
      webOrigin: "http://127.0.0.1:5173",
      screenProxySecret: "fake-test-secret",
      sandboxProvider: "fake",
    },
    dataDir: "/tmp/rakazo-router-test",
  } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function complete(input: Record<string, unknown>, actor: Actor = owner) {
    const { response } = await handler.handle(
      new Request("http://127.0.0.1/rpc/connections/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    const text = await response!.text();
    return { status: response!.status, body: text };
  }
  return { rows, complete, deletedSecrets };
}

const stranger: Actor = { ...owner, userId: "user-2" };

describe("connections.complete with { state, code }", () => {
  it("connects the pending row owned by the caller using the account id and secret from the connector", async () => {
    const complete = vi.fn(async () => ({ connectionRef: "google-sub-1", secretId: "secret-1" }));
    const h = harness([pendingGoogleRow()], {
      complete,
      connectionReady: vi.fn(async () => false),
    });
    const result = await h.complete({ state: STATE, code: "auth-code" });
    expect(result.status).toBe(200);
    expect(complete).toHaveBeenCalledWith(
      { state: STATE, code: "auth-code" },
      expect.objectContaining({ spaceId: "space-1", userId: "user-1" }),
    );
    expect(h.rows[0]).toMatchObject({
      status: "connected",
      providerRef: "google-sub-1",
      secretId: "secret-1",
      metadata: {},
    });
    expect(JSON.parse(result.body).json).toMatchObject({ id: "conn-1", status: "connected" });
    expect(result.body).not.toContain(STATE);
  });

  it("finishes with the redirect recorded when the sign-in began", async () => {
    const complete = vi.fn(async () => ({ connectionRef: "google-sub-1", secretId: "secret-1" }));
    const h = harness(
      [pendingGoogleRow({ metadata: { state: STATE, redirectUrl: GOOGLE_DESKTOP_REDIRECT_URI } })],
      { complete, connectionReady: vi.fn(async () => false) },
    );
    expect((await h.complete({ state: STATE, code: "auth-code" })).status).toBe(200);
    expect(complete).toHaveBeenCalledWith(
      { state: STATE, code: "auth-code", redirectUrl: GOOGLE_DESKTOP_REDIRECT_URI },
      expect.anything(),
    );
  });

  it("does not let another user's session finish someone else's pending connection", async () => {
    const complete = vi.fn();
    const h = harness([pendingGoogleRow()], { complete });
    const result = await h.complete({ state: STATE, code: "auth-code" }, stranger);
    expect(result.status).toBe(404);
    expect(complete).not.toHaveBeenCalled();
    expect(h.rows[0]).toMatchObject({ status: "pending", providerRef: STATE });
  });

  it("cannot be replayed once the row is connected", async () => {
    const complete = vi.fn(async () => ({ connectionRef: "google-sub-1", secretId: "secret-1" }));
    const h = harness([pendingGoogleRow()], { complete });
    expect((await h.complete({ state: STATE, code: "auth-code" })).status).toBe(200);
    expect((await h.complete({ state: STATE, code: "auth-code" })).status).toBe(404);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("only accepts state for the native Google connector", async () => {
    const complete = vi.fn();
    const h = harness([pendingGoogleRow({ connectorId: "composio" })], { complete });
    expect((await h.complete({ state: STATE, code: "auth-code" })).status).toBe(404);
    expect(complete).not.toHaveBeenCalled();
  });

  it("answers CONFLICT and deletes the new secret when the Google account is already connected", async () => {
    const complete = vi.fn(async () => ({ connectionRef: "google-sub-1", secretId: "secret-new" }));
    const h = harness(
      [
        pendingGoogleRow(),
        pendingGoogleRow({
          id: "conn-0",
          status: "connected",
          providerRef: "google-sub-1",
          secretId: "secret-old",
        }),
      ],
      { complete },
    );
    const result = await h.complete({ state: STATE, code: "auth-code" });
    expect(result.status).toBe(409);
    expect(result.body).toContain("This Google account is already connected.");
    expect(h.deletedSecrets).toEqual(["secret-new"]);
    expect(h.rows.find((r) => r.id === "conn-1")).toMatchObject({
      status: "pending",
      providerRef: STATE,
    });
    expect(h.rows.find((r) => r.id === "conn-0")).toMatchObject({ secretId: "secret-old" });
  });

  it("deletes the new secret and connects nothing when the row was revoked during the exchange", async () => {
    const rows = [pendingGoogleRow()];
    const complete = vi.fn(async () => {
      (rows[0] as Row).status = "revoked";
      return { connectionRef: "google-sub-1", secretId: "secret-new" };
    });
    const h = harness(rows, { complete });
    const result = await h.complete({ state: STATE, code: "auth-code" });
    expect(result.status).toBe(404);
    expect(h.deletedSecrets).toEqual(["secret-new"]);
    expect(rows[0]).toMatchObject({ status: "revoked" });
  });

  it("reports a failed code exchange as a bad request and leaves the row pending", async () => {
    const complete = vi.fn(async () => {
      throw new Error("Google rejected the authorization code");
    });
    const h = harness([pendingGoogleRow()], { complete });
    const result = await h.complete({ state: STATE, code: "auth-code" });
    expect(result.status).toBe(400);
    expect(result.body).toContain("Google rejected the authorization code");
    expect(h.rows[0]).toMatchObject({ status: "pending", providerRef: STATE });
  });

  it("requires exactly one of connectionId and state, and a code with state", async () => {
    const complete = vi.fn();
    const h = harness([pendingGoogleRow()], { complete });
    expect((await h.complete({})).status).toBe(400);
    expect((await h.complete({ connectionId: "conn-1", state: STATE, code: "c" })).status).toBe(
      400,
    );
    expect((await h.complete({ state: STATE })).status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("connections.complete with { connectionId } polling", () => {
  it("leaves a pending Google row pending without contacting Google", async () => {
    const complete = vi.fn();
    const connectionReady = vi.fn(async () => false);
    const h = harness([pendingGoogleRow()], { complete, connectionReady });
    const result = await h.complete({ connectionId: "conn-1" });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).json).toMatchObject({ id: "conn-1", status: "pending" });
    expect(complete).not.toHaveBeenCalled();
    expect(h.rows[0]).toMatchObject({ status: "pending", providerRef: STATE });
  });
});

function beginHarness(connectorId = "google") {
  const begin = vi.fn(async (_request: { provider: string; redirectUrl: string }) => ({
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=fake",
    state: STATE,
  }));
  const resolve = vi.fn(async () => ({ begin }) as unknown as ManagedConnectorProvider);
  const rows: Row[] = [];
  const created = pendingGoogleRow({ providerRef: null, metadata: {}, connectorId });
  const updateMany = vi.fn(async ({ data }: { data: Row }) => {
    Object.assign(created, data);
    rows.push(created);
    return { count: 1 };
  });
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    connection: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => created),
      updateMany,
    },
  };
  const deps = {
    prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) },
    integrationSettings: { resolve },
    connectors: { managed: vi.fn(() => undefined) },
    env: {
      defaultProvider: "fake",
      defaultModel: "fake-model",
      webOrigin: "http://127.0.0.1:5173",
      screenProxySecret: "fake-test-secret",
      sandboxProvider: "fake",
    },
    dataDir: "/tmp/rakazo-router-test",
  } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function post(input: Record<string, unknown>) {
    const { response } = await handler.handle(
      new Request("http://127.0.0.1/rpc/connections/begin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { provider: "gmail", displayName: "Gmail", ...input } }),
      }),
      { prefix: "/rpc", context: { actor: owner } },
    );
    return response!;
  }
  return { begin, resolve, rows, post };
}

describe("connections.begin for the native Google connector", () => {
  it("resolves the connector from Integration setup and stores the state on the pending row", async () => {
    const h = beginHarness();
    const response = await h.post({ connectorId: "google" });
    expect(response.status).toBe(200);
    expect(h.resolve).toHaveBeenCalledWith("google");
    expect(h.begin.mock.calls[0]![0].redirectUrl).toBe("http://127.0.0.1:5173/app");
    expect(h.rows[0]).toMatchObject({
      status: "pending",
      providerRef: STATE,
      metadata: { state: STATE },
    });
    await expect(response.json()).resolves.toMatchObject({
      json: {
        connectionId: "conn-1",
        authorizationUrl: expect.stringContaining("accounts.google.com"),
      },
    });
  });

  it("asks for the desktop loopback redirect and records it on the pending row", async () => {
    const h = beginHarness();
    const response = await h.post({ connectorId: "google", redirect: "desktop" });
    expect(response.status).toBe(200);
    expect(h.begin.mock.calls[0]![0].redirectUrl).toBe(GOOGLE_DESKTOP_REDIRECT_URI);
    expect(h.rows[0]).toMatchObject({
      metadata: { state: STATE, redirectUrl: GOOGLE_DESKTOP_REDIRECT_URI },
    });
  });

  it("refuses the desktop redirect for other connectors", async () => {
    const h = beginHarness("composio");
    const response = await h.post({ connectorId: "composio", redirect: "desktop" });
    expect(response.status).toBe(400);
    expect(h.begin).not.toHaveBeenCalled();
  });
});
