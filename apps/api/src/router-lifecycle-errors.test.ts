import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { ComputerLimitError, SpaceDeletionInProgressError } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  devinAgent: vi.fn(),
  devinConnect: vi.fn(),
  brexCardsConnect: vi.fn(),
  financeAgent: vi.fn(),
  financeConnect: vi.fn(),
  ensureSourceAgent: vi.fn(),
  ensureIntegrationAgent: vi.fn(),
  ensureConnectedAppAgent: vi.fn(),
  legalOverview: vi.fn(),
}));

vi.mock("./devin.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./devin.js")>()),
  devinAgent: mocks.devinAgent,
  devinConnect: mocks.devinConnect,
}));
vi.mock("./brex-cards.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./brex-cards.js")>()),
  brexCardsConnect: mocks.brexCardsConnect,
}));
vi.mock("./finance.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./finance.js")>()),
  financeAgent: mocks.financeAgent,
  financeConnect: mocks.financeConnect,
}));
vi.mock("./source-agent.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./source-agent.js")>()),
  ensureSourceAgent: mocks.ensureSourceAgent,
}));
vi.mock("./integration-agent.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integration-agent.js")>()),
  ensureIntegrationAgent: mocks.ensureIntegrationAgent,
  ensureConnectedAppAgent: mocks.ensureConnectedAppAgent,
}));
vi.mock("./legal.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./legal.js")>()),
  legalOverview: mocks.legalOverview,
}));

import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};

function client() {
  const deps = {
    prisma: { spaceMember: { findUnique: async () => ({ role: "owner" }) } },
    env: {
      defaultProvider: "fake",
      defaultModel: "fake-model",
      webOrigin: "http://127.0.0.1:5173",
      screenProxySecret: "fake-test-secret",
      sandboxProvider: "fake",
    },
    dataDir: "/tmp/rakazo-router-test",
  } as unknown as RouterDeps;
  return createRouterClient(createRouter(deps), { context: { actor } });
}

type Client = ReturnType<typeof client>;

/** Routes that create or reach an agent: a Space deletion or the computer limit must not be a 500. */
const routes: Array<{
  name: string;
  mock: keyof typeof mocks;
  call: (c: Client) => Promise<unknown>;
}> = [
  { name: "legal.overview", mock: "legalOverview", call: (c) => c.legal.overview() },
  { name: "devin.agent", mock: "devinAgent", call: (c) => c.devin.agent() },
  {
    name: "devin.connect",
    mock: "devinConnect",
    call: (c) => c.devin.connect({ secret: "fake-key" }),
  },
  {
    name: "brexCards.connect",
    mock: "brexCardsConnect",
    call: (c) => c.brexCards.connect({ token: "fake-token" }),
  },
  { name: "finance.agent", mock: "financeAgent", call: (c) => c.finance.agent() },
  {
    name: "finance.connect",
    mock: "financeConnect",
    call: (c) =>
      c.finance.connect({ provider: "mercury", redirectUri: "http://127.0.0.1:5173/cb" }),
  },
  {
    name: "capabilities.createAgent",
    mock: "ensureSourceAgent",
    call: (c) => c.capabilities.createAgent({ id: "source-1" }),
  },
  {
    name: "integrationAgents.create",
    mock: "ensureIntegrationAgent",
    call: (c) => c.integrationAgents.create({ serverId: "server-1" }),
  },
  {
    name: "connections.createAgent",
    mock: "ensureConnectedAppAgent",
    call: (c) => c.connections.createAgent({ connectionId: "connection-1" }),
  },
];

describe.each(routes)("$name lifecycle errors", ({ mock, call }) => {
  beforeEach(() => vi.resetAllMocks());

  it("answers a space being deleted as a conflict", async () => {
    mocks[mock].mockRejectedValue(new SpaceDeletionInProgressError());
    await expect(call(client())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("answers the computer limit as a bad request", async () => {
    mocks[mock].mockRejectedValue(new ComputerLimitError(1));
    await expect(call(client())).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("passes other errors through unchanged", async () => {
    mocks[mock].mockRejectedValue(new Error("database unavailable"));
    await expect(call(client())).rejects.toThrow("database unavailable");
  });
});
