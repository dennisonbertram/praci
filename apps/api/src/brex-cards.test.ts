import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import {
  BREX_AGENT_MODEL,
  BREX_CARDS_CONTROLS_DEFAULTS,
  BREX_CARDS_MCP_ENDPOINT,
  FINANCE_MCP_ENDPOINTS,
  integrationAgentSpawnKey,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { BrexCardsDeps } from "./brex-cards.js";
import {
  brexCardsCards,
  brexCardsConnect,
  brexCardsGetControls,
  brexCardsReplaceToken,
  brexCardsSetControls,
} from "./brex-cards.js";
import {
  brexCardsAccounts,
  brexCardsActivity,
  brexCardsExpenses,
  brexCardsLimits,
  brexCardsOverview,
  brexCardsPeople,
  brexCardsSpending,
  brexCardsTrips,
  brexCardsView,
} from "./brex-cards-read-model.js";
import { ensureIntegrationAgent } from "./integration-agent.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const owner = { userId: "owner", spaceId: "space", email: "o@example.test" } as Actor;
const roles: Record<string, string> = { owner: "owner", member: "member", former: "member" };

const TOKEN = "bxt_unit_test_token_9f3a";
const NEW_TOKEN = "bxt_unit_test_token_new_77c1";

type Row = Record<string, unknown> & { id?: string };

/** The few tables the Brex cards code touches, in memory. */
function fakeDb(seed: { bot?: Row; server?: Row; connection?: Row; effects?: Row[] } = {}) {
  const state = {
    servers: seed.server ? [seed.server] : ([] as Row[]),
    secrets: [] as Row[],
    connections: seed.connection ? [seed.connection] : ([] as Row[]),
    bots: seed.bot ? [seed.bot] : ([] as Row[]),
    effects: seed.effects ?? ([] as Row[]),
  };
  let n = 0;
  const spaceMember = {
    findUnique: vi.fn(async ({ where }: { where: { spaceId_userId: { userId: string } } }) => {
      const role = roles[where.spaceId_userId.userId];
      return role ? { role } : null;
    }),
  };
  const brexCardsConnection = {
    findUnique: vi.fn(async ({ where }: { where: { spaceId?: string; serverId?: string } }) => {
      const found = state.connections.find(
        (c) => c.spaceId === where.spaceId || c.serverId === where.serverId,
      );
      if (!found) return null;
      return { ...found, server: state.servers.find((s) => s.id === found.serverId) };
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      state.connections.push({ ...BREX_CARDS_CONTROLS_DEFAULTS, ...data });
      return data;
    }),
    update: vi.fn(async ({ where, data }: { where: { serverId: string }; data: Row }) => {
      const row = state.connections.find((c) => c.serverId === where.serverId);
      Object.assign(row as Row, data);
      return row;
    }),
  };
  const mcpServer = {
    create: vi.fn(async ({ data }: { data: Row }) => {
      const row = { id: `srv-${++n}`, revision: 1, writesEnabled: false, ...data };
      state.servers.push(row);
      return row;
    }),
    findFirst: vi.fn(
      async ({ where }: { where: Row }) =>
        state.servers.find(
          (s) => s.id === where.id && (!where.userId || s.userId === where.userId),
        ) ?? null,
    ),
    findFirstOrThrow: vi.fn(
      async ({ where }: { where: Row }) => state.servers.find((s) => s.id === where.id) as Row,
    ),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = state.servers.find((s) => s.id === where.id && s.userId === where.userId);
      if (row) Object.assign(row, data);
      return { count: row ? 1 : 0 };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
      const row = state.servers.find((s) => s.id === where.id) as Row;
      for (const [key, value] of Object.entries(data)) {
        row[key] =
          value && typeof value === "object" && "increment" in value
            ? (row[key] as number) + (value as { increment: number }).increment
            : value;
      }
      return row;
    }),
    deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
      state.servers = state.servers.filter((s) => s.id !== where.id);
      state.connections = state.connections.filter((c) => c.serverId !== where.id);
      return { count: 1 };
    }),
  };
  const secret = {
    findFirst: vi.fn(async () => null),
    count: vi.fn(
      async ({ where }: { where: { ciphertext: string } }) =>
        state.secrets.filter((row) => row.ciphertext === where.ciphertext).length,
    ),
    create: vi.fn(async ({ data }: { data: Row }) => {
      state.secrets.push(data);
      return data;
    }),
    deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
      state.secrets = state.secrets.filter((s) => s.id !== where.id);
      return { count: 1 };
    }),
  };
  const bot = {
    findFirst: vi.fn(
      async ({ where }: { where: Row }) =>
        state.bots.find(
          (b) =>
            (where.id === undefined || b.id === where.id) &&
            (!where.spawnKey || b.spawnKey === where.spawnKey) &&
            (!where.userId || !b.userId || b.userId === where.userId),
        ) ?? null,
    ),
    // Honors the `modelId: null` condition the way the database does.
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = state.bots.find((b) => b.id === where.id);
      if (!row || ("modelId" in where && row.modelId !== where.modelId)) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
  };
  const prisma = {
    spaceMember,
    brexCardsConnection,
    mcpServer,
    secret,
    botSecret: { count: vi.fn(async () => 0) },
    integrationProviderConfig: { count: vi.fn(async () => 0) },
    bot,
    externalEffect: {
      findMany: vi.fn(async ({ where }: { where?: Row } = {}) => {
        const botId = (where?.run as Row | undefined)?.botId;
        return state.effects.filter(
          (effect) =>
            (!where?.spaceId || effect.spaceId === where.spaceId) &&
            (!botId || (effect.runBotId ?? "bot-1") === botId),
        );
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 0),
  };
  return { state, prisma };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

/** Brex as the token check sees it. `fail` maps a path to a status or an error. */
function fakeBrex(fail: Record<string, number | "network"> = {}) {
  const calls: Array<{ path: string; authorization: string | null }> = [];
  const fetchFn = vi.fn(async (url: URL | string, init?: RequestInit) => {
    const u = new URL(String(url));
    const path = `${u.pathname}${u.search}`;
    calls.push({ path, authorization: new Headers(init?.headers).get("authorization") });
    const failure = fail[u.pathname];
    if (failure === "network") throw new TypeError("fetch failed");
    if (failure) return json({ error: "no" }, failure);
    if (u.pathname === "/v2/users/me")
      return json({ id: "usr_1", first_name: "Ada", last_name: "Example" });
    if (u.pathname === "/v2/cards") return json({ items: [], next_cursor: null });
    if (u.pathname === "/v2/company") return json({ id: "cmp_77", legal_name: "Example Co" });
    return json({}, 404);
  });
  return { calls, brexApi: { baseUrl: "http://brex.test", fetch: fetchFn as typeof fetch } };
}

function deps(
  db: ReturnType<typeof fakeDb>,
  brex = fakeBrex(),
  overrides: Partial<BrexCardsDeps> = {},
) {
  const secrets = {
    delete: vi.fn(async () => undefined),
    put: vi.fn(async (plaintext: string) => ({
      id: `sec-${db.state.secrets.length + 1}`,
      ciphertext: plaintext,
    })),
  };
  const callServerTool = vi.fn();
  const provisionAgent = vi.fn(async (_actor: Actor, serverId: string) => {
    const existing = db.state.bots[0];
    if (existing) return existing as never;
    const created = { id: "bot-new", spawnKey: integrationAgentSpawnKey(serverId), modelId: null };
    db.state.bots.push(created);
    return created as never;
  });
  const archiveBot = vi.fn(async () => undefined);
  return {
    brex,
    secrets,
    callServerTool,
    provisionAgent,
    archiveBot,
    deps: {
      prisma: db.prisma,
      secrets,
      mcp: { callServerTool },
      brexApi: brex.brexApi,
      provisionAgent,
      archiveBot,
      ...overrides,
    } as unknown as BrexCardsDeps,
  };
}

const connectedDb = (botExtra: Row = {}, rowOwner = "owner") =>
  fakeDb({
    server: {
      id: "srv-existing",
      spaceId: "space",
      userId: rowOwner,
      endpoint: BREX_CARDS_MCP_ENDPOINT,
      secretId: "sec-old",
      revision: 3,
      writesEnabled: false,
      agentBotId: "bot-1",
      slug: "brex-cards",
      name: "Brex cards",
      description: "",
      transport: "streamable_http",
      command: null,
      args: [],
      env: {},
      headers: {},
      enabled: true,
      agentExclusive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    connection: {
      serverId: "srv-existing",
      spaceId: "space",
      brexAccountId: "cmp_77",
      ...BREX_CARDS_CONTROLS_DEFAULTS,
    },
    bot: {
      id: "bot-1",
      spaceId: "space",
      userId: "owner",
      archivedAt: null,
      spawnKey: "integration-agent:srv-existing",
      modelId: null,
      ...botExtra,
    },
  });

describe("brexCardsConnect", () => {
  it("refuses a second connect in the space as a conflict, without calling Brex", async () => {
    const db = connectedDb();
    const t = deps(db);
    await expect(brexCardsConnect(t.deps, owner, TOKEN)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(t.brex.calls).toEqual([]);
  });

  it.each([
    [{ "/v2/users/me": 401 }, "Brex rejected this token"],
    [
      { "/v2/cards": 403 },
      "Brex refused this token. It may be missing a permission or have expired.",
    ],
    [{ "/v2/company": 401 }, "Brex rejected this token"],
    [{ "/v2/users/me": 500 }, "Could not reach Brex"],
    [{ "/v2/cards": "network" as const }, "Could not reach Brex"],
    [{ "/v2/company": 429 }, "Could not reach Brex"],
  ])("a failed token check %j stores nothing and says exactly %s", async (fail, message) => {
    const db = fakeDb();
    const t = deps(db, fakeBrex(fail));
    const error = await brexCardsConnect(t.deps, owner, TOKEN).catch((e: unknown) => e);
    expect(error).toMatchObject({ message });
    expect(String((error as Error).message)).not.toContain(TOKEN);
    expect(t.secrets.put).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(db.state).toMatchObject({ servers: [], secrets: [], connections: [] });
    expect(t.provisionAgent).not.toHaveBeenCalled();
  });

  it("checks the three Brex endpoints with the token, then stores an exclusive, read-only server with the company id", async () => {
    const db = fakeDb();
    const t = deps(db);
    const result = await brexCardsConnect(t.deps, owner, TOKEN);

    expect(t.brex.calls).toEqual([
      { path: "/v2/users/me", authorization: `Bearer ${TOKEN}` },
      { path: "/v2/cards?limit=1", authorization: `Bearer ${TOKEN}` },
      { path: "/v2/company", authorization: `Bearer ${TOKEN}` },
    ]);
    expect(JSON.parse(db.state.secrets[0]?.ciphertext as string)).toMatchObject({ secret: TOKEN });
    expect(db.state.servers[0]).toMatchObject({
      spaceId: "space",
      userId: "owner",
      slug: "brex-cards",
      name: "Brex cards",
      endpoint: BREX_CARDS_MCP_ENDPOINT,
      transport: "streamable_http",
      secretId: db.state.secrets[0]?.id,
      agentExclusive: true,
      writesEnabled: false,
    });
    expect(db.state.connections[0]).toMatchObject({
      serverId: db.state.servers[0]?.id,
      spaceId: "space",
      createdByUserId: "owner",
      brexAccountId: "cmp_77",
    });
    expect(t.provisionAgent).toHaveBeenCalledWith(owner, db.state.servers[0]?.id);
    expect(result).toEqual({ serverId: db.state.servers[0]?.id, agentBotId: "bot-new" });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it("pins the model only on an agent whose model is empty", async () => {
    const empty = fakeDb({
      bot: { id: "bot-1", spawnKey: "integration-agent:fin", modelId: null },
    });
    await brexCardsConnect(deps(empty).deps, owner, TOKEN);
    expect(empty.state.bots[0]).toMatchObject({
      modelProvider: BREX_AGENT_MODEL.provider,
      modelId: BREX_AGENT_MODEL.id,
      thinkingLevel: BREX_AGENT_MODEL.thinkingLevel,
    });

    const chosen = fakeDb({
      bot: { id: "bot-1", spawnKey: "integration-agent:fin", modelId: "my-own-model" },
    });
    await brexCardsConnect(deps(chosen).deps, owner, TOKEN);
    expect(chosen.state.bots[0]).toMatchObject({ modelId: "my-own-model" });
    expect(chosen.state.bots[0]).not.toHaveProperty("modelProvider");
  });

  it("removes the secret, server and state row when provisioning fails, and says why", async () => {
    const db = fakeDb();
    const t = deps(db, fakeBrex(), {
      provisionAgent: vi.fn(async () => {
        throw new Error("agent exploded");
      }),
    });
    await expect(brexCardsConnect(t.deps, owner, TOKEN)).rejects.toThrow("agent exploded");
    expect(db.state).toMatchObject({ servers: [], secrets: [], connections: [] });
  });

  it("archives the agent it created on failure, but never a shared finance agent", async () => {
    const own = fakeDb({
      bot: { id: "bot-own", spawnKey: "integration-agent:srv-1", modelId: null },
    });
    const ownDeps = deps(own);
    own.prisma.bot.updateMany.mockRejectedValueOnce(new Error("pin failed"));
    await expect(brexCardsConnect(ownDeps.deps, owner, TOKEN)).rejects.toThrow("pin failed");
    expect(ownDeps.archiveBot).toHaveBeenCalledWith(owner, "bot-own");

    const shared = fakeDb({
      bot: { id: "bot-fin", spawnKey: "integration-agent:fin", modelId: null },
    });
    const sharedDeps = deps(shared);
    shared.prisma.bot.updateMany.mockRejectedValueOnce(new Error("pin failed"));
    await expect(brexCardsConnect(sharedDeps.deps, owner, TOKEN)).rejects.toThrow("pin failed");
    expect(sharedDeps.archiveBot).not.toHaveBeenCalled();
    expect(shared.state.servers).toEqual([]);
  });
});

describe("brexCardsReplaceToken", () => {
  it("is not found when the space has no Brex cards connection", async () => {
    const t = deps(fakeDb());
    await expect(brexCardsReplaceToken(t.deps, owner, NEW_TOKEN)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("keeps the old secret and changes nothing when Brex rejects the new token", async () => {
    const db = connectedDb();
    const t = deps(db, fakeBrex({ "/v2/users/me": 401 }));
    await expect(brexCardsReplaceToken(t.deps, owner, NEW_TOKEN)).rejects.toMatchObject({
      message: "Brex rejected this token",
    });
    expect(t.secrets.put).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(db.state.servers[0]).toMatchObject({ secretId: "sec-old", revision: 3 });
  });

  it("swaps the secret and bumps the revision, keeping controls and the model", async () => {
    const db = connectedDb({ modelId: "my-own-model" });
    db.state.secrets.push({ id: "sec-old", ciphertext: "old" });
    db.state.connections[0] = { ...db.state.connections[0], maxCardsPerDay: 2 };
    const t = deps(db);
    await brexCardsReplaceToken(t.deps, owner, NEW_TOKEN);

    expect(db.state.servers[0]).toMatchObject({ revision: 4, secretId: "sec-2" });
    expect(db.state.secrets.map((s) => s.id)).toEqual(["sec-2"]);
    expect(JSON.parse(db.state.secrets[0]?.ciphertext as string)).toMatchObject({
      secret: NEW_TOKEN,
    });
    expect(db.state.connections[0]).toMatchObject({ maxCardsPerDay: 2, brexAccountId: "cmp_77" });
    expect(db.state.bots[0]).toMatchObject({ modelId: "my-own-model" });
  });
});

describe("brexCardsCards", () => {
  const BODY = {
    cards: [
      {
        id: "card_1",
        name: "Ads",
        lastFour: "4242",
        status: "ACTIVE",
        ownerUserId: "usr_1",
        limitCents: 50_000,
        currency: "USD",
        duration: "MONTHLY",
      },
    ],
  };

  it("calls only list_cards and returns the rows with the agent and the write switch", async () => {
    const db = connectedDb();
    const t = deps(db);
    t.callServerTool.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(BODY) }] });
    const list = await brexCardsCards(t.deps, owner);

    expect(t.callServerTool).toHaveBeenCalledTimes(1);
    const [server, context, tool, args] = t.callServerTool.mock.calls[0] ?? [];
    expect(server).toMatchObject({ id: "srv-existing" });
    expect(context).toMatchObject({ spaceId: "space", userId: "owner" });
    expect([tool, args]).toEqual(["list_cards", {}]);
    expect(list).toEqual({
      serverId: "srv-existing",
      agentBotId: "bot-1",
      writesEnabled: false,
      cards: [
        {
          cardId: "card_1",
          name: "Ads",
          lastFour: "4242",
          ownerUserId: "usr_1",
          status: "ACTIVE",
          limitCents: 50_000,
          currency: "USD",
          duration: "MONTHLY",
        },
      ],
    });
  });

  it("reports a failed tool call as an error, not an empty list", async () => {
    const t = deps(connectedDb());
    t.callServerTool.mockResolvedValue({
      isError: true,
      content: [{ type: "text", text: "Brex rejected the token or its scope" }],
    });
    await expect(brexCardsCards(t.deps, owner)).rejects.toThrow("Brex rejected the token");
  });
});

describe("brexCards rejected token", () => {
  it("maps the server's token-rejected code to a typed error", async () => {
    const t = deps(connectedDb());
    t.callServerTool.mockResolvedValue({
      isError: true,
      content: [
        { type: "text", text: "BREX_TOKEN_REJECTED: Brex rejected the token or its scope." },
      ],
    });
    await expect(brexCardsCards(t.deps, owner)).rejects.toMatchObject({
      code: "BREX_TOKEN_REJECTED",
    });
    await expect(brexCardsOverview(t.deps, owner)).rejects.toMatchObject({
      code: "BREX_TOKEN_REJECTED",
    });
  });

  it("keeps every other failed call a BAD_GATEWAY", async () => {
    const t = deps(connectedDb());
    t.callServerTool.mockResolvedValue({
      isError: true,
      content: [{ type: "text", text: "Brex is unavailable right now." }],
    });
    await expect(brexCardsCards(t.deps, owner)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });
});

describe("brexCards controls", () => {
  it("returns the stored controls to the owner", async () => {
    const t = deps(connectedDb());
    await expect(brexCardsGetControls(t.deps, owner)).resolves.toEqual(
      BREX_CARDS_CONTROLS_DEFAULTS,
    );
  });

  it("stores valid controls and returns them", async () => {
    const db = connectedDb();
    const next = {
      ...BREX_CARDS_CONTROLS_DEFAULTS,
      maxCardsPerDay: 2,
      allowedDurations: ["MONTHLY"],
    };
    const t = deps(db);
    await expect(brexCardsSetControls(t.deps, owner, next as never)).resolves.toEqual(next);
    expect(db.state.connections[0]).toMatchObject({
      maxCardsPerDay: 2,
      allowedDurations: ["MONTHLY"],
    });
  });

  it("rejects invalid controls and changes nothing", async () => {
    const db = connectedDb();
    const t = deps(db);
    const bad = { ...BREX_CARDS_CONTROLS_DEFAULTS, maxCardsPerDay: 0 };
    await expect(brexCardsSetControls(t.deps, owner, bad as never)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.prisma.brexCardsConnection.update).not.toHaveBeenCalled();
  });
});

describe("token ownership and the Brex account", () => {
  it("refuses a replacement token from another Brex company and changes nothing", async () => {
    const db = connectedDb();
    db.state.connections[0] = { ...db.state.connections[0], brexAccountId: "cmp_other" };
    const t = deps(db);
    await expect(brexCardsReplaceToken(t.deps, owner, NEW_TOKEN)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "This token is for a different Brex account. Disconnect Brex cards and connect again.",
    });
    expect(t.secrets.put).not.toHaveBeenCalled();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(db.state.servers[0]).toMatchObject({ secretId: "sec-old", revision: 3 });
    expect(db.state.connections[0]).toMatchObject({ brexAccountId: "cmp_other" });
  });

  const SOMEONE_ELSE = "Brex cards were connected by someone else. Disconnect and connect again.";
  it.each([
    [
      "replaceToken",
      (t: ReturnType<typeof deps>) => brexCardsReplaceToken(t.deps, owner, NEW_TOKEN),
    ],
    ["cards", (t: ReturnType<typeof deps>) => brexCardsCards(t.deps, owner)],
    ["getControls", (t: ReturnType<typeof deps>) => brexCardsGetControls(t.deps, owner)],
    [
      "setControls",
      (t: ReturnType<typeof deps>) =>
        brexCardsSetControls(t.deps, owner, BREX_CARDS_CONTROLS_DEFAULTS as never),
    ],
  ])("%s refuses the current owner when someone else connected the server", async (_name, call) => {
    const db = connectedDb({}, "former");
    const t = deps(db);
    t.callServerTool.mockResolvedValue({ content: [{ type: "text", text: '{"cards":[]}' }] });
    await expect(call(t)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: SOMEONE_ELSE,
    });
    expect(t.callServerTool).not.toHaveBeenCalled();
    expect(t.brex.calls).toEqual([]);
    expect(t.secrets.put).not.toHaveBeenCalled();
    expect(db.prisma.brexCardsConnection.update).not.toHaveBeenCalled();
  });
});

describe("the stored secret when the transaction fails", () => {
  it("connect deletes the secret it stored, and keeps it on success", async () => {
    const failing = fakeDb();
    failing.prisma.$transaction.mockRejectedValueOnce(new Error("tx failed"));
    const t = deps(failing);
    await expect(brexCardsConnect(t.deps, owner, TOKEN)).rejects.toThrow("tx failed");
    expect(t.secrets.delete).toHaveBeenCalledTimes(1);
    expect(String(t.secrets.delete.mock.calls[0]?.[0])).toContain(TOKEN);

    const ok = deps(fakeDb());
    await brexCardsConnect(ok.deps, owner, TOKEN);
    expect(ok.secrets.delete).not.toHaveBeenCalled();
  });

  it("replace token deletes the new secret and keeps the old one", async () => {
    const db = connectedDb();
    db.state.secrets.push({ id: "sec-old", ciphertext: "old" });
    db.prisma.$transaction.mockRejectedValueOnce(new Error("tx failed"));
    const t = deps(db);
    await expect(brexCardsReplaceToken(t.deps, owner, NEW_TOKEN)).rejects.toThrow("tx failed");
    expect(t.secrets.delete).toHaveBeenCalledTimes(1);
    expect(String(t.secrets.delete.mock.calls[0]?.[0])).toContain(NEW_TOKEN);
    expect(db.state.servers[0]).toMatchObject({ secretId: "sec-old", revision: 3 });
  });
});

describe("the Brex agent", () => {
  const financeServer = {
    id: "fin",
    spaceId: "space",
    userId: "owner",
    endpoint: FINANCE_MCP_ENDPOINTS.brex,
    agentBotId: "bot-fin",
  };
  const financeBot = {
    id: "bot-fin",
    spaceId: "space",
    userId: "owner",
    spawnKey: "integration-agent:fin",
    archivedAt: null,
    instructions: "You work with the user's Brex account through its tools.",
  };

  function reuseSetup(
    servers = [financeServer],
    bots: Array<Record<string, unknown>> = [financeBot],
  ) {
    const cardsServer = {
      id: "cards",
      spaceId: "space",
      userId: "owner",
      endpoint: BREX_CARDS_MCP_ENDPOINT,
      name: "Brex cards",
      agentBotId: null,
    };
    const tx = {
      bot: { updateMany: vi.fn(async () => ({ count: 1 })) },
      botMcpServer: { upsert: vi.fn() },
      mcpServer: {
        findFirst: vi.fn(async () => cardsServer),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirstOrThrow: vi.fn(async () => cardsServer),
      },
    };
    const prisma = {
      mcpServer: {
        findFirst: vi.fn(async () => cardsServer),
        findMany: vi.fn(async () => servers),
      },
      bot: {
        findFirst: vi.fn(
          async ({ where }: { where: { id?: string; spawnKey?: string } }) =>
            bots.find(
              (b) => b.id === where.id || (where.spawnKey && b.spawnKey === where.spawnKey),
            ) ?? null,
        ),
      },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    const createBot = vi.fn(
      async (_actor: Actor, input: { spawnKey: string }) =>
        bots.find((b) => b.spawnKey === input.spawnKey) ?? {
          id: "bot-new",
          spaceId: "space",
          userId: "owner",
          spawnKey: input.spawnKey,
          archivedAt: null,
          instructions: (input as { instructions?: string }).instructions ?? "",
        },
    );
    const replaceBotInstructions = vi.fn();
    const archiveBot = vi.fn();
    return {
      prisma,
      tx,
      createBot,
      replaceBotInstructions,
      archiveBot,
      run: () =>
        ensureIntegrationAgent(
          { prisma, repos: { createBot, replaceBotInstructions }, archiveBot } as never,
          owner,
          "cards",
        ),
    };
  }

  it("attaches the cards server to the owner's existing Brex finance agent and adds the cards guidance", async () => {
    const t = reuseSetup();
    const { bot } = await t.run();
    expect(bot.id).toBe("bot-fin");
    expect(t.createBot.mock.calls[0]?.[1]).toMatchObject({ spawnKey: "integration-agent:fin" });
    expect(t.tx.botMcpServer.upsert).toHaveBeenCalled();
    const change = t.replaceBotInstructions.mock.calls[0]?.[2] as { from: string; to: string };
    expect(change.from).toBe(financeBot.instructions);
    expect(change.to.startsWith(financeBot.instructions)).toBe(true);
    expect(change.to).toContain("virtual vendor cards and spend limits");
    expect(t.archiveBot).not.toHaveBeenCalled();
  });

  it("creates a Brex agent with the cards guidance when the owner has none", async () => {
    const t = reuseSetup([], []);
    await t.run();
    const input = t.createBot.mock.calls[0]?.[1] as {
      spawnKey: string;
      name: string;
      instructions: string;
    };
    expect(input.spawnKey).toBe(integrationAgentSpawnKey("cards"));
    expect(input.name).toBe("Brex agent");
    expect(input.instructions).toContain("virtual vendor cards and spend limits");
    expect(t.replaceBotInstructions).not.toHaveBeenCalled();
  });

  it("does not reuse an agent that belongs to a server that is not Brex", async () => {
    const other = { ...financeServer, endpoint: "https://mcp.mercury.com/mcp" };
    const t = reuseSetup([other]);
    await t.run();
    expect(t.createBot.mock.calls[0]?.[1]).toMatchObject({
      spawnKey: integrationAgentSpawnKey("cards"),
    });
  });
});

describe("generic MCP routes on the Brex cards server", () => {
  /** A router over the same fake tables, so the real handlers run. */
  function routed(who: Actor, db = connectedDb()) {
    const prisma = Object.assign(db.prisma, {
      devinConnectionState: { findUnique: vi.fn(async () => null) },
    });
    const secrets = { put: vi.fn(), load: vi.fn() };
    const router = createRouter({
      prisma,
      env: {},
      secrets,
      sandbox: {},
      home: {},
      jobs: {},
    } as unknown as RouterDeps);
    return {
      client: createRouterClient(router, { context: { actor: who } as never }),
      db,
      secrets,
    };
  }
  const bearer = (client: ReturnType<typeof routed>["client"]) => client;

  it("refuses a replacement credential and points to Replace token, changing nothing", async () => {
    const { client, db, secrets } = routed(owner);
    await expect(
      bearer(client).mcp.servers.update({ id: "srv-existing", secret: "not-a-valid-token" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Replace token"),
    });
    expect(secrets.put).not.toHaveBeenCalled();
    expect(db.prisma.mcpServer.update).not.toHaveBeenCalled();
    expect(db.state.servers[0]).toMatchObject({ secretId: "sec-old", revision: 3 });
  });

  it("refuses the credential update for a former space owner who still owns the row", async () => {
    const former = { ...owner, userId: "former" } as Actor;
    const db = connectedDb();
    db.state.servers[0] = { ...db.state.servers[0], userId: "former" };
    const { client } = routed(former, db);
    await expect(
      client.mcp.servers.update({ id: "srv-existing", secret: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects exclusive: false through the generic exclusivity RPC", async () => {
    const { client, db } = routed(owner);
    await expect(
      client.integrationAgents.setExclusive({ serverId: "srv-existing", exclusive: false }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.state.servers[0]).not.toMatchObject({ agentExclusive: false });
  });

  it("refuses the write switch and exclusivity to a former space owner who still owns the row", async () => {
    const former = { ...owner, userId: "former" } as Actor;
    const db = connectedDb();
    db.state.servers[0] = { ...db.state.servers[0], userId: "former", agentExclusive: true };
    db.state.bots[0] = { ...db.state.bots[0], userId: "former" };
    const { client } = routed(former, db);
    await expect(
      client.mcp.servers.setWrites({ id: "srv-existing", enabled: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.integrationAgents.setExclusive({ serverId: "srv-existing", exclusive: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.state.servers[0]).toMatchObject({ writesEnabled: false });
  });
  it("after an ownership transfer, the new owner may turn writes off but not on, and the former owner may do neither", async () => {
    const former = { ...owner, userId: "former" } as Actor;
    const db = connectedDb({}, "former");
    db.state.servers[0] = { ...db.state.servers[0], writesEnabled: true };
    db.state.bots[0] = { ...db.state.bots[0], userId: "former" };
    const current = routed(owner, db).client;
    await expect(
      current.mcp.servers.setWrites({ id: "srv-existing", enabled: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      routed(former, db).client.mcp.servers.setWrites({ id: "srv-existing", enabled: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.state.servers[0]).toMatchObject({ writesEnabled: true });
    await current.mcp.servers.setWrites({ id: "srv-existing", enabled: false });
    expect(db.state.servers[0]).toMatchObject({ writesEnabled: false });
  });
});

describe("brex cards read model", () => {
  const NOW = new Date("2025-03-15T12:00:00Z");
  const CARDS = [
    {
      id: "card_figma",
      name: "Figma",
      lastFour: "4242",
      status: "ACTIVE",
      ownerUserId: "usr_ada",
      type: "VIRTUAL",
      limitCents: 50_000,
      currency: "USD",
      duration: "MONTHLY",
    },
    {
      id: "card_ads",
      name: "Ad spend",
      lastFour: "5555",
      status: "ACTIVE",
      ownerUserId: "usr_ben",
      type: "VIRTUAL",
      limitCents: 100_000,
      currency: "USD",
      duration: "ONE_TIME",
    },
    {
      id: "card_locked",
      name: "Locked travel",
      lastFour: "3333",
      status: "LOCKED",
      ownerUserId: "usr_ben",
      type: "PHYSICAL",
      limitCents: 80_000,
      currency: "USD",
      duration: "QUARTERLY",
    },
    {
      id: "card_ended",
      name: "Old ads",
      lastFour: "4444",
      status: "TERMINATED",
      ownerUserId: "usr_cy",
      type: "VIRTUAL",
      limitCents: 25_000,
      currency: "USD",
      duration: "ONE_TIME",
    },
    {
      id: "card_yearly",
      name: "Yearly cloud",
      lastFour: "6666",
      status: "ACTIVE",
      ownerUserId: "usr_cy",
      type: "VIRTUAL",
      limitCents: 250_000,
      currency: "USD",
      duration: "YEARLY",
    },
  ];
  const USERS = [
    { id: "usr_ada", name: "Ada Example", email: "ada@example.test", status: "ACTIVE" },
    { id: "usr_ben", name: "Ben Example", email: "ben@example.test", status: "ACTIVE" },
    { id: "usr_cy", name: "Cy Example", email: "cy@example.test", status: "ACTIVE" },
  ];
  const LIMITS = [
    {
      id: "sl_software",
      name: "Software",
      status: "ACTIVE",
      period: "PER_MONTH",
      currentPeriodBalance: { amountSpentCents: 8_500, currency: "USD" },
      baseLimitCents: 10_000,
      currency: "USD",
      memberUserIds: ["usr_ada"],
    },
  ];
  const EXPENSES = [
    {
      id: "exp_figma",
      memo: null,
      status: "SUBMITTED",
      paymentStatus: "CLEARED",
      purchasedAt: "2025-03-10T12:00:00Z",
      amountCents: 1_200,
      currency: "USD",
      userId: "usr_ada",
      merchant: "Figma",
      merchantMcc: "5734",
      category: "RECURRING_SOFTWARE_AND_SAAS",
      expenseType: "CARD",
      receipts: [],
      complianceStatus: "DUE",
    },
    {
      id: "exp_travel",
      memo: "Client dinner",
      status: "APPROVED",
      paymentStatus: "CLEARED",
      purchasedAt: "2025-03-12T12:00:00Z",
      amountCents: 5_000,
      currency: "USD",
      userId: "usr_ben",
      merchant: "Example Travel",
      merchantMcc: "7011",
      category: "LODGING",
      expenseType: "CARD",
      receipts: [{ id: "rcpt_1" }],
      complianceStatus: "DUE",
    },
  ];
  const TRANSACTIONS = [
    {
      id: "txn_feb_figma",
      cardId: "card_figma",
      description: "Figma",
      amountCents: 800,
      currency: "USD",
      postedAt: "2025-02-10T12:00:00Z",
      type: "PURCHASE",
      merchant: "Figma",
      mcc: "5734",
      expenseId: "exp_figma",
    },
    {
      id: "txn_mar_figma",
      cardId: "card_figma",
      description: "Figma",
      amountCents: 1_200,
      currency: "USD",
      postedAt: "2025-03-10T12:00:00Z",
      type: "PURCHASE",
      merchant: "Figma",
      mcc: "5734",
      expenseId: "exp_figma",
    },
    {
      id: "txn_mar_ads",
      cardId: "card_ads",
      description: "Example Ads",
      amountCents: 2_400,
      currency: "USD",
      postedAt: "2025-03-11T12:00:00Z",
      type: "PURCHASE",
      merchant: "Example Ads",
      mcc: "7311",
      expenseId: null,
    },
    {
      id: "txn_mar_travel",
      cardId: "card_locked",
      description: "Example Travel",
      amountCents: 5_000,
      currency: "USD",
      postedAt: "2025-03-12T12:00:00Z",
      type: "PURCHASE",
      merchant: "Example Travel",
      mcc: "7011",
      expenseId: "exp_travel",
    },
    {
      id: "txn_mar_unknown",
      cardId: "card_yearly",
      description: "Unknown",
      amountCents: 1_000,
      currency: "USD",
      postedAt: "2025-03-13T12:00:00Z",
      type: "PURCHASE",
      merchant: null,
      mcc: "9999",
      expenseId: null,
    },
    {
      id: "txn_mar_figma_ads",
      cardId: "card_ads",
      description: "Figma",
      amountCents: 300,
      currency: "USD",
      postedAt: "2025-03-14T12:00:00Z",
      type: "PURCHASE",
      merchant: "Figma",
      mcc: "5734",
      expenseId: null,
    },
  ];
  const READS: Record<string, unknown> = {
    list_cards: { cards: CARDS },
    list_users: { users: USERS },
    list_spend_limits: { spendLimits: LIMITS },
    list_card_transactions: { transactions: TRANSACTIONS, incomplete: false },
    list_expenses: { expenses: EXPENSES, incomplete: false },
    list_cash_accounts: {
      accounts: [
        {
          id: "cash_1",
          name: "Operating",
          status: "ACTIVE",
          currentBalanceCents: 100_000,
          availableBalanceCents: 90_000,
          currency: "USD",
          primary: true,
        },
      ],
    },
    list_reimbursements: {
      reimbursements: [
        {
          id: "exp_reimb_1",
          memo: "Taxi",
          status: "APPROVED",
          paymentStatus: "CLEARED",
          purchasedAt: "2025-03-09T12:00:00Z",
          amountCents: 4_200,
          currency: "USD",
          userId: "usr_ada",
          merchant: "Taxi Example",
          merchantMcc: "4121",
          category: "OTHER_TRAVEL_EXPENSES",
          expenseType: "REIMBURSEMENT",
          receipts: [],
          complianceStatus: "DUE",
        },
      ],
      incomplete: false,
    },
    list_trips: {
      trips: [
        {
          id: "trip_1",
          name: "Example offsite",
          status: "UPCOMING",
          bookerUserId: "usr_ada",
          startsAt: "2025-04-01T09:00:00Z",
          endsAt: "2025-04-03T17:00:00Z",
        },
      ],
    },
    list_statements: {
      statements: [
        {
          id: "stmt_card_1",
          startDate: "2025-02-01",
          endDate: "2025-02-28",
          startBalanceCents: 10_000,
          endBalanceCents: 12_000,
        },
      ],
    },
  };
  const text = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
  const mockReads = (t: ReturnType<typeof deps>, overrides: Record<string, unknown> = {}) => {
    t.callServerTool.mockImplementation(async (_server: unknown, _context: unknown, tool: string) =>
      text({ ...(READS[tool] as object), ...(overrides[tool] as object | undefined) }),
    );
  };
  const readDeps = (db = connectedDb(), overrides: Record<string, unknown> = {}) => {
    const t = deps(db, fakeBrex(), { now: () => NOW });
    mockReads(t, overrides);
    return t;
  };

  it.each([
    ["overview", (t: ReturnType<typeof deps>) => brexCardsOverview(t.deps, owner)],
    ["cardsView", (t: ReturnType<typeof deps>) => brexCardsView(t.deps, owner)],
    ["spending", (t: ReturnType<typeof deps>) => brexCardsSpending(t.deps, owner, {})],
    ["limits", (t: ReturnType<typeof deps>) => brexCardsLimits(t.deps, owner)],
    ["people", (t: ReturnType<typeof deps>) => brexCardsPeople(t.deps, owner)],
    ["expenses", (t: ReturnType<typeof deps>) => brexCardsExpenses(t.deps, owner)],
    ["accounts", (t: ReturnType<typeof deps>) => brexCardsAccounts(t.deps, owner)],
    ["trips", (t: ReturnType<typeof deps>) => brexCardsTrips(t.deps, owner)],
    ["activity", (t: ReturnType<typeof deps>) => brexCardsActivity(t.deps, owner)],
  ])("%s refuses a new owner using the previous owner's connection", async (_name, call) => {
    const t = readDeps(connectedDb({}, "former"));
    await expect(call(t)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(t.callServerTool).not.toHaveBeenCalled();
  });

  it("builds overview totals, sankey flows, card counts, near-limit and vendors from the shared reads", async () => {
    const t = readDeps();
    const result = await brexCardsOverview(t.deps, owner);

    expect(result.partial).toBe(false);
    expect(result.cash).toEqual({ totalCents: 100_000, availableCents: 90_000, accountCount: 1 });
    expect(result.cards).toEqual({ active: 4, locked: 1, terminated: 1 });
    expect(result.cardSpend.monthToDateCents).toBe(9_900);
    expect(result.cardSpend.previousMonthToDateCents).toBe(800);
    expect(result.cardSpend.sparkline).toHaveLength(90);
    expect(result.cardSpend.sparkline.reduce((sum, point) => sum + point.cents, 0)).toBe(10_700);
    expect(result.sankey.totalCents).toBe(10_700);
    expect(result.sankey.categories.reduce((sum, category) => sum + category.cents, 0)).toBe(
      result.sankey.totalCents,
    );
    for (const category of result.sankey.categories) {
      expect(category.merchants.reduce((sum, merchant) => sum + merchant.cents, 0)).toBe(
        category.cents,
      );
      expect(category.partial).toBe(false);
    }
    expect(
      result.sankey.categories.find((category) => category.bucket === "software"),
    ).toMatchObject({
      cents: 2_300,
      merchants: [{ merchant: "Figma", cents: 2_300, count: 3, partial: false }],
    });
    expect(result.topVendors[0]).toMatchObject({ merchant: "Example Travel", cents: 5_000 });
    expect(result.nearLimit).toMatchObject({ partial: false, count: 1 });
    expect(result.nearLimit.items[0]).toMatchObject({ kind: "spend_limit", percent: 85 });
    expect(t.callServerTool.mock.calls.map((call) => call[2])).toEqual([
      "list_cards",
      "list_users",
      "list_spend_limits",
      "list_card_transactions",
      "list_expenses",
      "list_cash_accounts",
    ]);
  });

  it("marks every transaction-derived aggregate partial when the capped reads are incomplete", async () => {
    const t = readDeps(connectedDb(), {
      list_card_transactions: { incomplete: true },
      list_expenses: { incomplete: true },
    });
    const overview = await brexCardsOverview(t.deps, owner);
    expect(overview.partial).toBe(true);
    expect(overview.cardSpend.partial).toBe(true);
    expect(overview.nearLimit.partial).toBe(true);
    expect(overview.sankey.partial).toBe(true);
    expect(overview.sankey.categories.every((category) => category.partial)).toBe(true);
    expect(overview.topVendors.every((vendor) => vendor.partial)).toBe(true);

    const cards = await brexCardsView(t.deps, owner);
    expect(cards.partial).toBe(true);
    expect(cards.cards.every((card) => card.partial)).toBe(true);

    const spending = await brexCardsSpending(t.deps, owner, {});
    expect(spending.partial).toBe(true);
    expect(spending.categories.every((category) => category.partial)).toBe(true);
    expect(spending.sankey.partial).toBe(true);
  });

  it("shows usage for monthly and quarterly cards only and excludes terminated cards from active counts", async () => {
    const t = readDeps();
    const result = await brexCardsView(t.deps, owner);
    const byId = new Map(result.cards.map((card) => [card.cardId, card]));

    expect(byId.get("card_figma")?.usage).toMatchObject({ usedCents: 1_200, limitCents: 50_000 });
    expect(byId.get("card_locked")?.usage).toMatchObject({ usedCents: 5_000, limitCents: 80_000 });
    expect(byId.get("card_ads")?.usage).toBeNull();
    expect(byId.get("card_yearly")?.usage).toBeNull();
    expect(byId.get("card_yearly")?.series).toHaveLength(90);

    const people = await brexCardsPeople(t.deps, owner);
    const cy = people.people.find((person) => person.userId === "usr_cy");
    expect(cy).toMatchObject({ activeCardCount: 1, terminatedCardCount: 1 });
  });

  it("counts the first days of a 92-day quarter toward quarterly card usage", async () => {
    const t = deps(connectedDb(), fakeBrex(), { now: () => new Date("2025-09-30T12:00:00Z") });
    mockReads(t, {
      list_card_transactions: {
        transactions: [
          {
            id: "txn_quarter_start",
            cardId: "card_locked",
            description: "Example Travel",
            amountCents: 1_000,
            currency: "USD",
            postedAt: "2025-07-01",
            type: "PURCHASE",
            merchant: "Example Travel",
            mcc: "7011",
            expenseId: null,
          },
        ],
      },
    });

    const result = await brexCardsView(t.deps, owner);
    expect(result.cards.find((card) => card.cardId === "card_locked")?.usage).toMatchObject({
      usedCents: 1_000,
      limitCents: 80_000,
    });
    expect(t.callServerTool).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "list_card_transactions",
      { postedAtStart: "2025-07-01" },
    );
  });

  it("filters spending by merchant and category and finds duplicate subscriptions across cards", async () => {
    const t = readDeps();
    const result = await brexCardsSpending(t.deps, owner, {
      merchant: "figma",
      category: "software",
    });

    expect(result.partial).toBe(false);
    expect(result.transactions.map((transaction) => transaction.id)).toEqual([
      "txn_mar_figma_ads",
      "txn_mar_figma",
      "txn_feb_figma",
    ]);
    expect(result.totalCents).toBe(2_300);
    expect(result.categories).toHaveLength(1);
    expect(result.duplicates).toEqual([
      expect.objectContaining({
        merchant: "Figma",
        month: "2025-03",
        cardIds: ["card_figma", "card_ads"],
        cents: 1_500,
        count: 2,
      }),
    ]);
  });

  it("rejects spending ranges outside the shared 90-day window", async () => {
    const t = readDeps();
    await expect(brexCardsSpending(t.deps, owner, { from: "2024-01-01" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(brexCardsSpending(t.deps, owner, { from: "2025-03-20" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("returns expenses, reimbursements, accounts, trips and statements from their fixed read tools", async () => {
    const t = readDeps();
    const expenses = await brexCardsExpenses(t.deps, owner);
    expect(expenses.expenses.find((expense) => expense.expenseId === "exp_figma")).toMatchObject({
      bucket: "software",
      missingReceipt: true,
      missingMemo: true,
      cardId: "card_figma",
    });
    expect(expenses.reimbursements[0]).toMatchObject({
      expenseId: "exp_reimb_1",
      bucket: "travel",
      missingReceipt: true,
    });
    expect(expenses.expenses.find((expense) => expense.expenseId === "exp_travel")).toMatchObject({
      missingReceipt: false,
      missingMemo: false,
    });

    const accounts = await brexCardsAccounts(t.deps, owner);
    expect(accounts.accounts[0]).toMatchObject({
      cashAccountId: "cash_1",
      currentBalanceCents: 100_000,
    });
    expect(accounts.statements[0]).toMatchObject({
      statementId: "stmt_card_1",
      accountKind: "card",
    });

    const trips = await brexCardsTrips(t.deps, owner);
    expect(trips.trips[0]).toMatchObject({ tripId: "trip_1", bookerName: "Ada Example" });

    const tools = t.callServerTool.mock.calls.map((call) => call[2]);
    expect(tools).toEqual(
      expect.arrayContaining([
        "list_expenses",
        "list_reimbursements",
        "list_cash_accounts",
        "list_statements",
        "list_trips",
      ]),
    );
  });

  it("lists only this space's approved Brex write effects for the connected server", async () => {
    const marker = "__rakazoCatalogTool";
    const db = connectedDb();
    db.state.effects.push(
      {
        id: "eff_direct",
        spaceId: "space",
        status: "approved",
        createdAt: new Date("2025-03-14T10:00:00Z"),
        request: [
          marker,
          "direct",
          {
            route: {
              connectorId: "mcp",
              resourceId: "srv-existing",
              toolName: "lock_card",
              resourceRevision: 3,
            },
            args: { cardName: "Figma" },
          },
        ],
      },
      {
        id: "eff_catalog",
        spaceId: "space",
        status: "executed",
        createdAt: new Date("2025-03-13T10:00:00Z"),
        request: [
          marker,
          "connectors_execute_tool",
          { id: "srv-existing:update_card", arguments: { cardName: "Ad spend" } },
        ],
      },
      {
        id: "eff_other_space",
        spaceId: "other-space",
        status: "approved",
        createdAt: new Date("2025-03-15T10:00:00Z"),
        request: [
          marker,
          "direct",
          {
            route: { connectorId: "mcp", resourceId: "srv-existing", toolName: "lock_card" },
            args: { cardName: "Figma" },
          },
        ],
      },
      {
        id: "eff_other_server",
        spaceId: "space",
        status: "approved",
        createdAt: new Date("2025-03-15T11:00:00Z"),
        request: [
          marker,
          "direct",
          {
            route: { connectorId: "mcp", resourceId: "srv-other", toolName: "lock_card" },
            args: { cardName: "Figma" },
          },
        ],
      },
      {
        id: "eff_other_bot",
        spaceId: "space",
        runBotId: "bot-other",
        status: "approved",
        createdAt: new Date("2025-03-15T13:00:00Z"),
        request: [
          marker,
          "direct",
          {
            route: { connectorId: "mcp", resourceId: "srv-existing", toolName: "lock_card" },
            args: { cardName: "Figma" },
          },
        ],
      },
      {
        id: "eff_read",
        spaceId: "space",
        status: "approved",
        createdAt: new Date("2025-03-15T12:00:00Z"),
        request: [
          marker,
          "direct",
          {
            route: { connectorId: "mcp", resourceId: "srv-existing", toolName: "list_cards" },
            args: {},
          },
        ],
      },
    );
    const t = readDeps(db);
    const result = await brexCardsActivity(t.deps, owner);

    expect(result.activities.map((activity) => activity.effectId)).toEqual([
      "eff_direct",
      "eff_catalog",
    ]);
    expect(result.activities[0]).toMatchObject({ action: "lock_card", target: "Figma" });
    expect(result.activities[1]).toMatchObject({ action: "update_card", target: "Ad spend" });
    expect(t.callServerTool).not.toHaveBeenCalled();
  });
});
