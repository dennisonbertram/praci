import { createRouterClient } from "@orpc/server";
import { archiveBot } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { inboxAgentSpawnKey, integrationAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { completeNativeOAuth } from "./connection-oauth.js";
import { provisionConnectionAgent } from "./integration-agent.js";
import { createRouter, type RouterDeps } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("agent per connection: provisioning (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `cp-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userId = id("user");
  const otherUserId = id("other");
  const actor = (user: string): Actor => ({
    userId: user,
    spaceId,
    email: `${user}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const owner = actor(userId);
  const other = actor(otherUserId);
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const connector = {
    describe: () => ({ id: "composio" }),
    begin: async (): Promise<{ authorizationUrl?: string; state: string }> => ({
      authorizationUrl: "https://example.test/auth",
      state: "st",
    }),
    complete: async () => undefined,
    connectionReady: async () => true,
    revoke: async (..._args: unknown[]): Promise<void> => undefined,
  };
  const client = (who: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        env: { webOrigin: "http://localhost" },
        connectors: { managed: () => connector, managedProviders: () => [connector] },
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
  const lifecycle = () => ({
    prisma,
    sandbox: {} as never,
    home: {} as never,
    jobs: { cancel: async () => undefined } as never,
    dataDir: undefined,
  });
  const row = (connectionId: string) =>
    prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  const create = (
    data: Partial<{
      connectorId: string;
      provider: string;
      status: string;
      allAgents: boolean;
      userId: string;
      privateByDefault: boolean;
    }> = {},
  ) =>
    prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "notion",
        displayName: "Notion",
        status: "pending",
        privateByDefault: (data.status ?? "pending") === "pending",
        providerRef: `ref-${Math.random().toString(36).slice(2)}`,
        ...data,
      },
    });
  const access = (connectionId: string) =>
    prisma.botConnectionAccess.findMany({ where: { connectionId }, select: { botId: true } });
  const complete = (connectionId: string, who = owner) =>
    client(who).connections.complete({ connectionId });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const user of [userId, otherUserId])
      await prisma.user.create({
        data: { id: user, name: user, email: `${user}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    for (const user of [userId, otherUserId])
      await prisma.member.create({
        data: {
          id: id(`m-${user}`),
          organizationId: orgId,
          userId: user,
          role: "member",
          createdAt: new Date(),
        },
      });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.connection.deleteMany({ where: { spaceId } });
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("begin creates a private pending row without an agent and leaves a shared sibling alone", async () => {
    await createRepos(prisma).createBot(owner, {
      name: "Helper",
      title: "",
      description: "",
      instructions: "",
    });
    const sibling = await create({ status: "connected", allAgents: true, provider: "slack" });
    const begun = await client(owner).connections.begin({
      connectorId: "composio",
      provider: "slack",
      displayName: "Slack",
    });
    expect(await row(begun.connectionId)).toMatchObject({
      allAgents: false,
      agentBotId: null,
      privateByDefault: true,
    });
    expect(await access(begun.connectionId)).toEqual([]);
    expect(await row(sibling.id)).toMatchObject({ allAgents: true, agentBotId: null });
    // The abandoned pending row neither gets an agent nor denies the shared sibling.
    const effective = await client(owner).connections.effectiveAccess();
    expect(effective[sibling.id]?.shared).toBe("all");
    expect(
      await prisma.bot.count({
        where: { spaceId, spawnKey: integrationAgentSpawnKey(begun.connectionId) },
      }),
    ).toBe(0);
  });

  it("complete gives a connected app its own private agent once, and never re-privatizes", async () => {
    const pending = await create();
    const done = await complete(pending.id);
    const again = await complete(pending.id);
    const current = await row(pending.id);
    expect(done.agentBotId).toBeTruthy();
    expect(again.agentBotId).toBe(done.agentBotId);
    expect(current).toMatchObject({
      status: "connected",
      allAgents: false,
      writesEnabled: false,
      agentBotId: done.agentBotId,
    });
    expect(current.privateByDefault).toBe(true);
    expect((await access(pending.id)).map((a) => a.botId)).toEqual([done.agentBotId]);

    // The user shares it; completing again must not take the share back.
    await client(owner).connections.setAccess({
      connectionId: pending.id,
      allAgents: true,
      botIds: [],
    });
    await complete(pending.id);
    expect(await row(pending.id)).toMatchObject({ allAgents: true });
  });

  it("parallel completes of one connection yield one agent", async () => {
    const pending = await create();
    await Promise.all(Array.from({ length: 5 }, () => complete(pending.id)));
    const agentBotId = (await row(pending.id)).agentBotId;
    expect(agentBotId).toBeTruthy();
    expect(await access(pending.id)).toEqual([{ botId: agentBotId }]);
    expect(
      await prisma.bot.count({
        where: { spaceId, spawnKey: integrationAgentSpawnKey(pending.id) },
      }),
    ).toBe(1);
  });

  it("a pre-existing shared connection is unchanged through begin and setAccess", async () => {
    const legacy = await create({ status: "connected", allAgents: true, provider: "linear" });
    await client(owner).connections.begin({
      connectorId: "composio",
      provider: "linear",
      displayName: "Linear",
    });
    await client(owner).connections.setAccess({
      connectionId: legacy.id,
      allAgents: true,
      botIds: [],
    });
    expect(await row(legacy.id)).toMatchObject({
      allAgents: true,
      agentBotId: null,
      privateByDefault: false,
    });
  });

  it("Gmail links to the Inbox agent with changes on; Calendar gets its own agent", async () => {
    const gmail = await create({ connectorId: "google", provider: "gmail" });
    const calendar = await create({ connectorId: "google", provider: "googlecalendar" });
    const g = await complete(gmail.id);
    const c = await complete(calendar.id);
    expect(
      await prisma.bot.findUniqueOrThrow({ where: { id: g.agentBotId as string } }),
    ).toMatchObject({
      spawnKey: inboxAgentSpawnKey(userId),
    });
    expect(await row(gmail.id)).toMatchObject({ allAgents: false, writesEnabled: true });
    expect(
      await prisma.bot.findUniqueOrThrow({ where: { id: c.agentBotId as string } }),
    ).toMatchObject({
      spawnKey: integrationAgentSpawnKey(calendar.id),
    });
    expect(await row(calendar.id)).toMatchObject({ allAgents: false, writesEnabled: false });
  });

  it("Google replace carries the agent over and re-keys Calendar; Inbox keeps its key", async () => {
    const google = (provider: string) => {
      const state = `state-${provider}-${suffix}`;
      return { provider, state, ref: `acct-${provider}-${suffix}` };
    };
    let provisionCalls = 0;
    for (const provider of ["googlecalendar", "gmail"]) {
      const g = google(provider);
      // The replacement already has a grant for a bot the old row also has.
      const stray = await createRepos(prisma).createBot(owner, {
        name: `Stray ${provider}`,
        title: "",
        description: "",
        instructions: "",
      });
      const extra = await createRepos(prisma).createBot(owner, {
        name: `Extra ${provider}`,
        title: "",
        description: "",
        instructions: "",
      });
      const old = await create({ connectorId: "google", provider });
      await prisma.connection.update({ where: { id: old.id }, data: { providerRef: g.ref } });
      const oldDone = await complete(old.id);
      await prisma.connection.update({ where: { id: old.id }, data: { writesEnabled: true } });
      await prisma.botConnectionAccess.create({
        data: { connectionId: old.id, botId: extra.id, spaceId, userId },
      });
      const next = await create({ connectorId: "google", provider });
      await prisma.connection.update({
        where: { id: next.id },
        data: { providerRef: g.state, metadata: { replacesConnectionId: old.id } },
      });
      // A grant the pending row picked up on its own must not survive the replacement.
      await prisma.botConnectionAccess.create({
        data: { connectionId: next.id, botId: stray.id, spaceId, userId },
      });
      const google2 = {
        begin: async () => undefined,
        complete: async () => ({ connectionRef: g.ref, secretId: `secret-${provider}-${suffix}` }),
      };
      const done = await completeNativeOAuth({
        prisma,
        actor: owner,
        connector: google2 as never,
        connectorId: "google",
        state: g.state,
        code: "c",
        context: {} as never,
        lock: async () => undefined,
        provision: async () => {
          provisionCalls += 1;
        },
      });
      // A replacement that already has its agent is left to the provisioner, which does nothing.
      expect(provisionCalls).toBe(provider === "gmail" ? 2 : 1);
      expect(done.agentBotId).toBe(oldDone.agentBotId);
      expect(await row(next.id)).toMatchObject({
        allAgents: false,
        writesEnabled: true,
        agentBotId: oldDone.agentBotId,
      });
      expect((await access(next.id)).map((a) => a.botId).sort()).toEqual(
        [oldDone.agentBotId as string, extra.id].sort(),
      );
      expect(await prisma.connection.findUnique({ where: { id: old.id } })).toBeNull();
      const bot = await prisma.bot.findUniqueOrThrow({
        where: { id: oldDone.agentBotId as string },
      });
      expect(bot.spawnKey).toBe(
        provider === "gmail" ? inboxAgentSpawnKey(userId) : integrationAgentSpawnKey(next.id),
      );
    }
  });

  it("revoke archives the connection's agent but never the Inbox agent", async () => {
    const app = await create({ provider: "asana" });
    const gmail = await create({ connectorId: "google", provider: "gmail" });
    const a = await complete(app.id);
    const g = await complete(gmail.id);
    await client(owner).connections.revoke({ connectionId: app.id });
    await client(owner).connections.revoke({ connectionId: gmail.id });
    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: a.agentBotId as string } })).archivedAt,
    ).not.toBeNull();
    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: g.agentBotId as string } })).archivedAt,
    ).toBeNull();
    expect(await row(app.id)).toMatchObject({
      status: "revoked",
      agentBotId: null,
      privateByDefault: true,
    });
  });

  it("an archived agent leaves a provisioned connection private, a legacy one shared", async () => {
    const provisioned = await create({ provider: "hubspot" });
    const p = await complete(provisioned.id);
    const legacy = await create({ status: "connected", provider: "zendesk" });
    const legacyAgent = await client(owner).connections.createAgent({ connectionId: legacy.id });
    await client(owner).connections.setExclusive({ connectionId: legacy.id, exclusive: true });
    for (const botId of [p.agentBotId as string, legacyAgent.botId]) {
      const bot = await prisma.bot.findUniqueOrThrow({ where: { id: botId } });
      await archiveBot(
        {
          prisma,
          sandbox: {} as never,
          home: {} as never,
          jobs: { cancel: async () => undefined } as never,
          dataDir: undefined,
        },
        bot,
        { userId, spaceId } as never,
      );
    }
    expect(await row(provisioned.id)).toMatchObject({ agentBotId: null, allAgents: false });
    expect(await access(provisioned.id)).toEqual([]);
    expect((await client(owner).connections.effectiveAccess())[provisioned.id]?.shared).toBe(
      "none",
    );
    expect(await row(legacy.id)).toMatchObject({ agentBotId: null, allAgents: true });
  });

  it("a racing poll and a no-sign-in connect both end with the agent", async () => {
    const pending = await create({ provider: "calendly" });
    const results = await Promise.all(Array.from({ length: 5 }, () => complete(pending.id)));
    const agentBotId = (await row(pending.id)).agentBotId;
    expect(results.map((r) => r.agentBotId)).toEqual(results.map(() => agentBotId));

    const original = connector.begin;
    connector.begin = async () => ({ authorizationUrl: "", state: "" });
    try {
      const begun = await client(owner).connections.begin({
        connectorId: "composio",
        provider: "noauth",
        displayName: "No auth",
      });
      expect(await row(begun.connectionId)).toMatchObject({
        status: "connected",
        allAgents: false,
        agentBotId: expect.any(String),
        privateByDefault: true,
      });
    } finally {
      connector.begin = original;
    }
  });

  it("an archive between the agent's creation and its link still ends private and linked", async () => {
    const pending = await create({
      status: "connected",
      provider: "pipedrive",
      privateByDefault: true,
    });
    const repos = createRepos(prisma);
    let archivedOnce = false;
    await provisionConnectionAgent(
      {
        prisma,
        repos: {
          createBot: async (a: Actor, input: Parameters<typeof repos.createBot>[1]) => {
            const bot = await repos.createBot(a, input);
            if (!archivedOnce) {
              archivedOnce = true;
              await archiveBot(lifecycle(), bot, { userId, spaceId } as never);
            }
            return bot;
          },
        },
        archiveBot: async () => undefined,
      },
      owner,
      pending.id,
    );
    const current = await row(pending.id);
    expect(current).toMatchObject({ allAgents: false });
    expect(current.privateByDefault).toBe(true);
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: current.agentBotId as string } });
    expect(bot.archivedAt).toBeNull();
  });

  it("an archive right after provisioning keeps the connection private", async () => {
    const pending = await create({ provider: "box" });
    const done = await complete(pending.id);
    await archiveBot(
      lifecycle(),
      await prisma.bot.findUniqueOrThrow({ where: { id: done.agentBotId as string } }),
      { userId, spaceId } as never,
    );
    expect(await row(pending.id)).toMatchObject({ allAgents: false, agentBotId: null });
  });

  it("sharing a legacy sibling leaves a private agentless connection private, and it does not deny the sibling", async () => {
    await createRepos(prisma).createBot(owner, {
      name: "Plain helper",
      title: "",
      description: "",
      instructions: "",
    });
    for (const connectorId of ["composio", "google"]) {
      const provider = connectorId === "google" ? "googledrive" : "figma";
      const privateRow = await create({ connectorId, provider });
      const done = await complete(privateRow.id);
      await archiveBot(
        lifecycle(),
        await prisma.bot.findUniqueOrThrow({ where: { id: done.agentBotId as string } }),
        { userId, spaceId } as never,
      );
      const legacy = await create({ connectorId, provider, status: "connected", allAgents: true });
      // Native Google is pinned per account; Composio and Pipedream keep denying the whole app.
      expect((await client(owner).connections.effectiveAccess())[legacy.id]?.shared).toBe(
        connectorId === "google" ? "all" : "none",
      );
      await client(owner).connections.setAccess({
        connectionId: legacy.id,
        allAgents: false,
        botIds: [],
      });
      await client(owner).connections.setAccess({
        connectionId: legacy.id,
        allAgents: true,
        botIds: [],
      });
      expect(await row(privateRow.id)).toMatchObject({ allAgents: false });
      expect(await row(legacy.id)).toMatchObject({ allAgents: true });
    }
  });

  it("a revoked connection is clean for the next begin, which gets a fresh agent", async () => {
    const pending = await create({ provider: "airtable" });
    const first = await complete(pending.id);
    await client(owner).connections.revoke({ connectionId: pending.id });
    expect(await row(pending.id)).toMatchObject({
      status: "revoked",
      agentBotId: null,
      privateByDefault: true,
    });
    const begun = await client(owner).connections.begin({
      connectorId: "composio",
      provider: "airtable",
      displayName: "Airtable",
    });
    const second = await complete(begun.connectionId);
    expect(second.agentBotId).toBeTruthy();
    expect(second.agentBotId).not.toBe(first.agentBotId);
  });

  it("a rename does not make an old connected connection eligible for provisioning", async () => {
    const legacy = await create({ status: "connected", provider: "renamed", allAgents: true });
    await client(owner).connections.rename({ connectionId: legacy.id, displayName: "Renamed" });
    const done = await complete(legacy.id);
    expect(done.agentBotId).toBeNull();
    expect(await row(legacy.id)).toMatchObject({ allAgents: true, privateByDefault: false });
  });

  it("a crash between connected and provisioning is recovered by the next complete", async () => {
    const crashed = await create({
      status: "connected",
      provider: "crashed",
      privateByDefault: true,
    });
    const done = await complete(crashed.id);
    expect(done.agentBotId).toBeTruthy();
    expect(await row(crashed.id)).toMatchObject({
      allAgents: false,
      privateByDefault: true,
    });
  });

  it("a recoverable remote revoke failure leaves the agent, marker and grants in place", async () => {
    const pending = await create({ provider: "revokefail" });
    const done = await complete(pending.id);
    const original = connector.revoke;
    connector.revoke = async () => {
      throw new Error("provider unavailable");
    };
    try {
      await expect(
        client(owner).connections.revoke({ connectionId: pending.id }),
      ).rejects.toBeTruthy();
    } finally {
      connector.revoke = original;
    }
    expect(await row(pending.id)).toMatchObject({
      status: "connected",
      agentBotId: done.agentBotId,
      allAgents: false,
      privateByDefault: true,
    });
    expect((await access(pending.id)).map((a) => a.botId)).toEqual([done.agentBotId]);
    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: done.agentBotId as string } })).archivedAt,
    ).toBeNull();
    // A legacy sibling's share still cannot reach it.
    const legacy = await create({ status: "connected", provider: "revokefail", allAgents: true });
    await client(owner).connections.setAccess({
      connectionId: legacy.id,
      allAgents: false,
      botIds: [],
    });
    expect(await row(pending.id)).toMatchObject({ allAgents: false });
  });

  it("sharing a legacy sibling never shares a row provisioned while it was being listed", async () => {
    const legacyA = await create({ status: "connected", provider: "race", allAgents: true });
    const sibling = await create({ status: "connected", provider: "race", allAgents: true });
    const racing = createRouterClient(
      createRouter({
        prisma: new Proxy(prisma, {
          get(target, prop, receiver) {
            if (prop !== "$transaction") return Reflect.get(target, prop, receiver);
            return (fn: (tx: PrismaClient) => unknown, options?: unknown) =>
              (target.$transaction as (f: unknown, o?: unknown) => unknown)(
                (tx: PrismaClient) =>
                  fn(
                    new Proxy(tx, {
                      get(inner, key, innerReceiver) {
                        const value = Reflect.get(inner, key, innerReceiver);
                        if (key !== "connection") return value;
                        return new Proxy(value, {
                          get(model, method, modelReceiver) {
                            const original = Reflect.get(model, method, modelReceiver);
                            if (method !== "findMany") return original;
                            return async (...args: unknown[]) => {
                              const rows = await (original as (...a: unknown[]) => unknown)(
                                ...args,
                              );
                              // The sibling is provisioned after it was listed.
                              await prisma.connection.update({
                                where: { id: sibling.id },
                                data: { privateByDefault: true },
                              });
                              return rows;
                            };
                          },
                        });
                      },
                    }),
                  ),
                options,
              );
          },
        }),
        env: { webOrigin: "http://localhost" },
        connectors: { managed: () => connector, managedProviders: () => [connector] },
      } as unknown as RouterDeps),
      { context: { actor: owner } as never },
    );
    await expect(
      racing.connections.setAccess({ connectionId: legacyA.id, allAgents: false, botIds: [] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await row(sibling.id)).toMatchObject({ allAgents: true });
    expect(await row(legacyA.id)).toMatchObject({ allAgents: true });
  });

  it("revoke and relinking the same connection do not deadlock", async () => {
    for (let i = 0; i < 8; i += 1) {
      const pending = await create({ provider: `lock${i}` });
      const done = await complete(pending.id);
      const results = await Promise.allSettled([
        client(owner).connections.revoke({ connectionId: pending.id }),
        client(owner).connections.createAgent({ connectionId: pending.id }),
        client(owner).connections.setWrites({ connectionId: pending.id, enabled: true }),
      ]);
      for (const result of results)
        if (result.status === "rejected")
          expect(String((result.reason as Error).message)).not.toMatch(/deadlock/i);
      expect(done.agentBotId).toBeTruthy();
    }
  });

  it("a reused legacy shared error row stays shared after reconnecting", async () => {
    const legacy = await create({
      status: "error",
      provider: "legacyerror",
      allAgents: true,
      privateByDefault: false,
    });
    const begun = await client(owner).connections.begin({
      connectorId: "composio",
      provider: "legacyerror",
      displayName: "Legacy",
    });
    expect(begun.connectionId).toBe(legacy.id);
    const done = await complete(legacy.id);
    expect(done.agentBotId).toBeNull();
    expect(await row(legacy.id)).toMatchObject({
      status: "connected",
      allAgents: true,
      privateByDefault: false,
    });
  });

  it("a manual Create agent on a private connection behaves like provisioning, and stays private after archive", async () => {
    const crashed = await create({
      status: "connected",
      provider: "manual",
      privateByDefault: true,
    });
    await prisma.connection.update({ where: { id: crashed.id }, data: { allAgents: true } });
    const { botId } = await client(owner).connections.createAgent({ connectionId: crashed.id });
    expect(await row(crashed.id)).toMatchObject({ allAgents: false, agentBotId: botId });
    expect((await access(crashed.id)).map((a) => a.botId)).toEqual([botId]);
    await archiveBot(lifecycle(), await prisma.bot.findUniqueOrThrow({ where: { id: botId } }), {
      userId,
      spaceId,
    } as never);
    expect(await row(crashed.id)).toMatchObject({ allAgents: false, agentBotId: null });
    expect(await access(crashed.id)).toEqual([]);
  });

  it("a revoked private connection gets no grants from a legacy sibling's share", async () => {
    const pending = await create({ provider: "sharedsib" });
    await complete(pending.id);
    await client(owner).connections.revoke({ connectionId: pending.id });
    const legacy = await create({ status: "connected", provider: "sharedsib", allAgents: true });
    const helper = await createRepos(prisma).createBot(owner, {
      name: "Sibling helper",
      title: "",
      description: "",
      instructions: "",
    });
    await client(owner).connections.setAccess({
      connectionId: legacy.id,
      allAgents: false,
      botIds: [helper.id],
    });
    expect(await access(pending.id)).toEqual([]);
    expect(await row(pending.id)).toMatchObject({ allAgents: false, privateByDefault: true });
  });

  it("a Google replacement never copies a stale share over a concurrent setExclusive", async () => {
    for (let i = 0; i < 6; i += 1) {
      const provider = "googledrive";
      const ref = `race-acct-${i}-${suffix}`;
      const state = `race-state-${i}-${suffix}`;
      const old = await create({ connectorId: "google", provider, status: "connected" });
      await prisma.connection.update({ where: { id: old.id }, data: { providerRef: ref } });
      const { botId } = await client(owner).connections.createAgent({ connectionId: old.id });
      await client(owner).connections.setExclusive({ connectionId: old.id, exclusive: false });
      const next = await create({ connectorId: "google", provider });
      await prisma.connection.update({
        where: { id: next.id },
        data: { providerRef: state, metadata: { replacesConnectionId: old.id } },
      });
      const [exclusive] = await Promise.allSettled([
        client(owner).connections.setExclusive({ connectionId: old.id, exclusive: true }),
        completeNativeOAuth({
          prisma,
          actor: owner,
          connector: {
            complete: async () => ({ connectionRef: ref, secretId: `race-secret-${i}-${suffix}` }),
          } as never,
          connectorId: "google",
          state,
          code: "c",
          context: {} as never,
          lock: async () => undefined,
        }),
      ]);
      const current = await row(next.id);
      if (exclusive.status === "fulfilled") expect(current.allAgents).toBe(false);
      expect(current.agentBotId).toBe(botId);
    }
  });

  it("a Google replacement of a private connection without an agent provisions one", async () => {
    const provider = "googlecalendar";
    const ref = `noagent-acct-${suffix}`;
    const state = `noagent-state-${suffix}`;
    const old = await create({
      connectorId: "google",
      provider,
      status: "connected",
      privateByDefault: true,
    });
    await prisma.connection.update({ where: { id: old.id }, data: { providerRef: ref } });
    const next = await create({ connectorId: "google", provider });
    await prisma.connection.update({
      where: { id: next.id },
      data: { providerRef: state, metadata: { replacesConnectionId: old.id } },
    });
    const done = await completeNativeOAuth({
      prisma,
      actor: owner,
      connector: {
        complete: async () => ({ connectionRef: ref, secretId: `noagent-secret-${suffix}` }),
      } as never,
      connectorId: "google",
      state,
      code: "c",
      context: {} as never,
      lock: async () => undefined,
      provision: (connectionId) =>
        provisionConnectionAgent(
          { prisma, repos: createRepos(prisma), archiveBot: async () => undefined },
          owner,
          connectionId,
        ),
    });
    expect(done.agentBotId).toBeTruthy();
    expect(await row(next.id)).toMatchObject({ privateByDefault: true, allAgents: false });
    expect((await access(next.id)).map((a) => a.botId)).toEqual([done.agentBotId]);
  });

  it("revoke recovery does not put back an agent archived in the meantime", async () => {
    const pending = await create({ provider: "archivedmid" });
    const done = await complete(pending.id);
    const original = connector.revoke;
    connector.revoke = async () => {
      await archiveBot(
        lifecycle(),
        await prisma.bot.findUniqueOrThrow({ where: { id: done.agentBotId as string } }),
        { userId, spaceId } as never,
      );
      throw new Error("provider unavailable");
    };
    try {
      await expect(
        client(owner).connections.revoke({ connectionId: pending.id }),
      ).rejects.toBeTruthy();
    } finally {
      connector.revoke = original;
    }
    expect(await row(pending.id)).toMatchObject({
      status: "connected",
      agentBotId: null,
      allAgents: false,
      privateByDefault: true,
    });
    expect(await access(pending.id)).toEqual([]);
  });

  it("does not provision for another owner's connection", async () => {
    const mine = await create({ provider: "intercom" });
    await expect(complete(mine.id, other)).rejects.toBeTruthy();
    expect(await row(mine.id)).toMatchObject({ status: "pending", agentBotId: null });
  });
});
