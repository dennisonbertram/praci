import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { BREX_CARDS_CONTROLS_DEFAULTS } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: false,
};

/** A database that knows only the caller's membership; anything else fails, which is not FORBIDDEN. */
function client(role: string | null, isDeploymentOwner = false) {
  const prisma = new Proxy(
    { spaceMember: { findUnique: async () => (role === null ? null : { role }) } },
    {
      get(target, key) {
        if (key in target) return target[key as keyof typeof target];
        throw new Error(`unexpected database use: ${String(key)}`);
      },
    },
  );
  const deps = {
    prisma,
    env: {
      defaultProvider: "fake",
      defaultModel: "fake-model",
      webOrigin: "http://127.0.0.1:5173",
      screenProxySecret: "fake-test-secret",
      sandboxProvider: "fake",
    },
    dataDir: "/tmp/rakazo-router-test",
  } as unknown as RouterDeps;
  return createRouterClient(createRouter(deps), {
    context: { actor: { ...actor, isDeploymentOwner } },
  });
}

type Client = ReturnType<typeof client>;

const brexToken = { token: "fake-token" };
const ownerOnlyRoutes: Array<[string, (c: Client) => Promise<unknown>]> = [
  ["agentSecrets.list", (c) => c.agentSecrets.list()],
  ["agentSecrets.put", (c) => c.agentSecrets.put({ name: "FAKE_KEY", value: "x" })],
  ["agentSecrets.remove", (c) => c.agentSecrets.remove({ id: "secret-1" })],
  ["devin.connect", (c) => c.devin.connect({ secret: "x" })],
  ["devin.replaceKey", (c) => c.devin.replaceKey({ secret: "x" })],
  ["devin.disconnect", (c) => c.devin.disconnect()],
  ["brexCards.connect", (c) => c.brexCards.connect(brexToken)],
  ["brexCards.replaceToken", (c) => c.brexCards.replaceToken(brexToken)],
  ["brexCards.cards", (c) => c.brexCards.cards()],
  ["brexCards.overview", (c) => c.brexCards.overview()],
  ["brexCards.cardsView", (c) => c.brexCards.cardsView()],
  ["brexCards.spending", (c) => c.brexCards.spending({})],
  ["brexCards.limits", (c) => c.brexCards.limits()],
  ["brexCards.people", (c) => c.brexCards.people()],
  ["brexCards.expenses", (c) => c.brexCards.expenses()],
  ["brexCards.accounts", (c) => c.brexCards.accounts()],
  ["brexCards.trips", (c) => c.brexCards.trips()],
  ["brexCards.activity", (c) => c.brexCards.activity()],
  ["brexCards.getControls", (c) => c.brexCards.getControls()],
  ["brexCards.setControls", (c) => c.brexCards.setControls(BREX_CARDS_CONTROLS_DEFAULTS as never)],
  [
    "memory.connectProvider",
    (c) =>
      c.memory.connectProvider({
        provider: "fake",
        settings: {},
        credentials: {},
        defaultMemoryScope: "isolated",
      }),
  ],
  ["memory.setDefaultScope", (c) => c.memory.setDefaultScope({ defaultMemoryScope: "shared" })],
  ["memory.disconnectProvider", (c) => c.memory.disconnectProvider()],
];

describe.each(ownerOnlyRoutes)("%s", (_name, call) => {
  it("refuses a member", async () => {
    await expect(call(client("member"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses an admin who is not an owner", async () => {
    await expect(call(client("admin"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses someone who left the space", async () => {
    await expect(call(client(null))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a deployment owner who is only a member of the space", async () => {
    await expect(call(client("member", true))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a role list that includes owner past the owner check", async () => {
    await expect(call(client("owner,admin"))).rejects.not.toMatchObject({ code: "FORBIDDEN" });
  });
});
