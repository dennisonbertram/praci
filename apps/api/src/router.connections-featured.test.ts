import { RPCHandler } from "@orpc/server/fetch";
import type { ConnectorCatalogItem } from "@rakazo/adapter-kit";
import type { Actor, ConnectionCatalogItem } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "test-space",
  userId: "test-user",
  email: "user@example.test",
  isDeploymentOwner: false,
};
const item = (slug: string, connectorId = "composio"): ConnectorCatalogItem => ({
  connectorId,
  slug,
  name: slug,
  logo: null,
  noAuth: false,
  connected: false,
});
const directory = [
  item("gmail"),
  item("gmail", "google"),
  item("slack"),
  item("notion"),
  item("googledrive"),
  item("googlecalendar"),
  ...Array.from({ length: 1594 }, (_, i) => item(`other-${i}`)),
];

function harness(accountDelayMs = 0) {
  const accountState = vi.fn(async () => {
    if (accountDelayMs) await new Promise((resolve) => setTimeout(resolve, accountDelayMs));
  });
  const catalog = vi.fn(async () => {
    await accountState();
    return directory;
  });
  const catalogDirectory = vi.fn(async () =>
    directory.map(({ connected: _connected, ...metadata }) => metadata),
  );
  const prisma = { connection: { findMany: vi.fn(async () => []) } };
  const deps = {
    prisma,
    connectors: { managedProviders: () => [{ catalog, catalogDirectory }] },
    env: {
      defaultProvider: "fake",
      defaultModel: "fake-model",
      webOrigin: "http://127.0.0.1:5187",
      screenProxySecret: "fake-test-secret",
      sandboxProvider: "fake",
    },
  } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function call(method: string, authenticated = true) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/connections/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
      }),
      { prefix: "/rpc", context: { actor: authenticated ? actor : null } },
    );
    return {
      status: response!.status,
      items: (await response!.json()).json as ConnectionCatalogItem[],
    };
  }
  return { call, catalog, catalogDirectory, accountState, prisma };
}

describe("connections.featured", () => {
  it("returns only featured metadata without provider account state or connection queries", async () => {
    const h = harness();
    const result = await h.call("featured");
    expect(result.status).toBe(200);
    expect(result.items.map((app) => [app.connectorId, app.slug])).toEqual(
      directory.slice(0, 6).map((app) => [app.connectorId, app.slug]),
    );
    expect(result.items.every((app) => app.connected === false)).toBe(true);
    expect(result.items[0]?.category).toBe("email_calendar");
    expect(h.catalogDirectory).toHaveBeenCalledOnce();
    expect(h.catalog).not.toHaveBeenCalled();
    expect(h.accountState).not.toHaveBeenCalled();
    expect(h.prisma.connection.findMany).not.toHaveBeenCalled();
  });

  it("requires authentication before reading the directory", async () => {
    const h = harness();
    expect((await h.call("featured", false)).status).toBe(401);
    expect(h.catalogDirectory).not.toHaveBeenCalled();
  });

  it("keeps the full catalog and account state for Integrations", async () => {
    const h = harness();
    expect((await h.call("catalog")).items).toHaveLength(1600);
    expect(h.catalog).toHaveBeenCalledOnce();
    expect(h.accountState).toHaveBeenCalledOnce();
  });

  it("measures mock full versus featured RPC with 1600 apps and 250ms account delay", async () => {
    const h = harness(250);
    const before = performance.now();
    expect((await h.call("catalog")).items).toHaveLength(1600);
    const fullMs = performance.now() - before;
    h.accountState.mockClear();
    const after = performance.now();
    expect((await h.call("featured")).items).toHaveLength(6);
    const featuredMs = performance.now() - after;
    expect(h.accountState).not.toHaveBeenCalled();
    // biome-ignore lint/suspicious/noConsole: Keep synthetic timing output available for manual inspection.
    console.info(
      `Synthetic RPC timing (1600 apps, 250ms injected account delay): full=${fullMs.toFixed(1)}ms featured=${featuredMs.toFixed(1)}ms`,
    );
  });
});
