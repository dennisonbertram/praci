import { createRouterClient } from "@orpc/server";
import { EncryptedSecretStore } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { GTM_WORK_ROUTINE_NAME, gtmAgentSpawnKey, ZERNIO_MCP_ENDPOINT } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("GTM overview and queue (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `gtm-view-${name}-${suffix}`;
  const organizationId = id("org");
  const spaceA = id("space-a");
  const spaceB = id("space-b");
  const aliceId = id("alice");
  const bobId = id("bob");
  const oauthId = id("oauth");
  const charlieId = id("charlie");
  const alice: Actor = {
    spaceId: spaceA,
    userId: aliceId,
    email: "alice@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: bobId, email: "bob@example.test" };
  const oauthActor: Actor = { ...alice, userId: oauthId, email: "oauth@example.test" };
  const elsewhere: Actor = { ...alice, spaceId: spaceB };
  const disconnected: Actor = {
    ...alice,
    userId: charlieId,
    email: "charlie@example.test",
  };
  const queueReader = vi.fn(async () => ({
    status: "ready" as const,
    complete: true,
    posts: [],
  }));
  const mcpResultByServer = new Map<string, unknown>();
  const callServerTool = vi.fn(
    async (server: { id: string }, _context: unknown, toolName: string) => {
      if (toolName !== "accounts_list") throw new Error("Unexpected tool");
      return mcpResultByServer.get(server.id);
    },
  );
  const secrets = new EncryptedSecretStore("synthetic-test-encryption-key");
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const client = (actor: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        secrets,
        env: { webOrigin: "http://localhost", mailWritesDisabled: false },
        mcp: { callServerTool } as never,
        gtmQueueReader: queueReader,
      } as unknown as RouterDeps),
      { context: { actor } },
    );

  async function createBot(actor: Actor) {
    return prisma.bot.create({
      data: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        name: "GTM agent",
        color: "#F2622A",
        spawnKey: gtmAgentSpawnKey(actor.userId),
      },
    });
  }

  async function createZernioServer(actor: Actor, botId: string, slug: string) {
    return prisma.mcpServer.create({
      data: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        slug,
        name: "Zernio",
        transport: "streamable_http",
        endpoint: ZERNIO_MCP_ENDPOINT,
        agentBotId: botId,
        agentExclusive: true,
        writesEnabled: false,
      },
    });
  }

  async function addApiKey(actor: Actor, serverId: string) {
    const secretId = id(`secret-${serverId}`);
    const stored = await secrets.put(
      JSON.stringify({ secret: "synthetic-zernio-api-key" }),
      {
        operationId: "test",
        traceId: "test",
        spaceId: actor.spaceId,
        userId: actor.userId,
        signal: new AbortController().signal,
      },
      { recordId: secretId },
    );
    await prisma.secret.create({
      data: {
        id: secretId,
        userId: actor.userId,
        spaceId: actor.spaceId,
        kind: "mcp",
        ciphertext: stored.ciphertext,
      },
    });
    await prisma.mcpServer.update({
      where: { id: serverId },
      data: { secretId },
    });
  }

  async function createRoutine(actor: Actor, botId: string, nextRunAt: Date) {
    return prisma.routine.create({
      data: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        botId,
        name: GTM_WORK_ROUTINE_NAME,
        prompt: "Work the plan",
        crons: ["0 * * * *"],
        timezone: "UTC",
        active: true,
        notify: false,
        nextRunAt,
      },
    });
  }

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob, oauthActor, disconnected].map((actor) => ({
        id: actor.userId,
        name: actor.userId,
        email: `${actor.userId}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: organizationId,
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((spaceId) => ({
        id: spaceId,
        organizationId,
        name: spaceId,
      })),
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({
      where: { id: { in: [aliceId, bobId, oauthId, charlieId] } },
    });
    await close();
    await secrets.close();
  });

  it("returns an empty disconnected state without creating a bot or making provider calls", async () => {
    queueReader.mockClear();
    callServerTool.mockClear();
    await expect(
      client(disconnected).gtm.queue({
        from: "2030-01-01T00:00:00Z",
        to: "2030-01-02T00:00:00Z",
      }),
    ).resolves.toEqual({ status: "not_connected", complete: false, posts: [] });
    expect(queueReader).not.toHaveBeenCalled();
    expect(callServerTool).not.toHaveBeenCalled();
    expect(
      await prisma.bot.count({
        where: { spaceId: disconnected.spaceId, userId: disconnected.userId },
      }),
    ).toBe(0);
  });

  it("rejects caller-controlled server and MCP tool inputs", async () => {
    const from = "2030-01-01T00:00:00Z";
    const to = "2030-01-02T00:00:00Z";
    await expect(
      client(disconnected).gtm.queue({ from, to, serverId: "other-tenant-server" } as never),
    ).rejects.toThrow();
    await expect(
      client(disconnected).gtm.queue({ from, to, toolName: "posts_list" } as never),
    ).rejects.toThrow();
    expect(queueReader).not.toHaveBeenCalled();
    expect(callServerTool).not.toHaveBeenCalled();
  });

  it("separates OAuth-only, configured-key, malformed-account, and ambiguous-server states", async () => {
    const bot = await createBot(oauthActor);
    const server = await createZernioServer(oauthActor, bot.id, "zernio-oauth");
    mcpResultByServer.set(server.id, {
      content: [
        { type: "text", text: "Found 1 connected account(s):\n\n- twitter: @acme (ID: tw-1)" },
      ],
    });
    const queueInput = {
      from: "2030-01-01T00:00:00Z",
      to: "2030-01-02T00:00:00Z",
    };

    await expect(client(oauthActor).gtm.queue(queueInput)).resolves.toEqual({
      status: "api_key_required",
      complete: false,
      posts: [],
    });
    expect(queueReader).not.toHaveBeenCalled();

    await addApiKey(oauthActor, server.id);
    await expect(client(oauthActor).gtm.queue(queueInput)).resolves.toEqual({
      status: "ready",
      complete: true,
      posts: [],
    });
    expect(queueReader).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "synthetic-zernio-api-key",
        ...queueInput,
      }),
    );

    const malformed = await client(oauthActor).gtm.overview();
    expect(malformed.channels.find((channel) => channel.channel === "x")).toMatchObject({
      status: "connected",
      accounts: [{ id: "tw-1", platform: "twitter", label: "@acme" }],
    });
    mcpResultByServer.set(server.id, {
      content: [{ type: "text", text: "private provider diagnostic" }],
    });
    const unavailable = await client(oauthActor).gtm.overview();
    expect(unavailable.zernioLinked).toBe(true);
    expect(unavailable.channels.find((channel) => channel.channel === "x")).toMatchObject({
      status: "unavailable",
      accounts: [],
    });
    expect(JSON.stringify(unavailable)).not.toContain("private provider diagnostic");

    const second = await createZernioServer(oauthActor, bot.id, "zernio-oauth-ambiguous");
    mcpResultByServer.set(second.id, {
      content: [
        { type: "text", text: "No accounts connected. Connect accounts at https://zernio.com" },
      ],
    });
    await expect(client(oauthActor).gtm.queue(queueInput)).resolves.toEqual({
      status: "unavailable",
      complete: false,
      posts: [],
    });
    expect(callServerTool.mock.calls.map((call) => call[2])).toEqual([
      "accounts_list",
      "accounts_list",
    ]);
  });

  it("isolates overview groups, Gmail, routine, server, and durable directory history", async () => {
    callServerTool.mockClear();
    const aliceBot = await createBot(alice);
    const aliceOtherBot = await prisma.bot.create({
      data: {
        spaceId: alice.spaceId,
        userId: alice.userId,
        name: "Unrelated bot",
        color: "#3EC5A8",
      },
    });
    const bobBot = await createBot(bob);
    const elsewhereBot = await createBot(elsewhere);
    const aliceServer = await createZernioServer(alice, aliceBot.id, "zernio-overview-alice");
    const bobServer = await createZernioServer(bob, bobBot.id, "zernio-overview-bob");
    await addApiKey(bob, bobServer.id);
    const elsewhereServer = await createZernioServer(
      elsewhere,
      elsewhereBot.id,
      "zernio-overview-elsewhere",
    );
    for (const [server, handle] of [
      [aliceServer, "@alice"],
      [bobServer, "@bob"],
      [elsewhereServer, "@elsewhere"],
    ] as const) {
      mcpResultByServer.set(server.id, {
        content: [
          {
            type: "text",
            text: `Found 1 connected account(s):\n\n- twitter: ${handle} (ID: ${server.id})`,
          },
        ],
      });
    }
    queueReader.mockClear();
    const queueWindow = { from: "2030-01-01T00:00:00Z", to: "2030-01-02T00:00:00Z" };
    await expect(client(alice).gtm.queue(queueWindow)).resolves.toEqual({
      status: "api_key_required",
      complete: false,
      posts: [],
    });
    expect(queueReader).not.toHaveBeenCalled();
    await expect(client(alice).gtm.overview()).resolves.toMatchObject({
      postingCapability: "api_key_required",
    });
    const aliceRunAt = new Date(Date.now() + 60_000);
    await createRoutine(alice, aliceBot.id, aliceRunAt);
    await createRoutine(bob, bobBot.id, new Date(Date.now() + 120_000));
    await createRoutine(elsewhere, elsewhereBot.id, new Date(Date.now() + 180_000));
    await prisma.scratchpadItem.createMany({
      data: [
        {
          id: id("goal-alice"),
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          title: "Alice goal",
          status: "open",
          notes: "goal notes",
          category: "goal",
        },
        {
          id: id("needs-alice"),
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          title: "Founder review",
          status: "parked",
          notes: "review this",
          category: "public_post",
          channel: "x",
          proof: "uncertain stamp",
        },
        {
          id: id("needs-other-bot"),
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceOtherBot.id,
          title: "Other bot private",
          status: "parked",
          notes: "",
          category: "outbound_email",
          channel: "email",
        },
        {
          id: id("draft-alice"),
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          title: "Draft only",
          status: "open",
          notes: "draft notes",
          category: "draft",
          channel: "reddit",
        },
        {
          id: id("done-alice"),
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          title: "Published",
          status: "done",
          notes: "proof stays",
          category: "public_post",
          channel: "x",
          proof: "https://example.test/published",
        },
        {
          id: id("in-progress-alice"),
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          title: "Research",
          status: "open",
          notes: "research notes",
          category: "research",
        },
        {
          id: id("other-owner"),
          spaceId: bob.spaceId,
          userId: bob.userId,
          botId: bobBot.id,
          title: "Bob private",
          status: "parked",
          notes: "",
          category: "public_post",
          channel: "linkedin",
        },
        {
          id: id("other-space"),
          spaceId: elsewhere.spaceId,
          userId: elsewhere.userId,
          botId: elsewhereBot.id,
          title: "Elsewhere private",
          status: "parked",
          notes: "",
          category: "public_post",
          channel: "x",
        },
      ],
    });
    await prisma.connection.createMany({
      data: [
        {
          id: id("gmail-alice"),
          spaceId: alice.spaceId,
          userId: alice.userId,
          connectorId: "composio",
          provider: "gmail",
          displayName: "Alice Gmail",
          status: "connected",
          providerRef: "synthetic-alice-gmail",
          metadata: { mailAddress: "alice@example.test" },
        },
        {
          id: id("gmail-bob"),
          spaceId: bob.spaceId,
          userId: bob.userId,
          connectorId: "composio",
          provider: "gmail",
          displayName: "Bob Gmail",
          status: "connected",
          providerRef: "synthetic-bob-gmail",
          metadata: { mailAddress: "bob@example.test" },
        },
      ],
    });
    const approvedAt = (offset: number) => new Date(Date.now() + offset);
    await prisma.scratchpadApproval.createMany({
      data: [
        ...["founder-a", "founder-b", "founder-b", "removed-item"].map((itemId) => ({
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          itemId,
          category: "create_account",
          channel: "directory",
          approvedBy: "user",
          approvedAt: approvedAt(-60 * 60_000),
        })),
        {
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          itemId: "old-founder",
          category: "create_account",
          channel: "directory",
          approvedBy: "user",
          approvedAt: approvedAt(-25 * 60 * 60_000),
        },
        ...["policy-a", "policy-b"].map((itemId) => ({
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          itemId,
          category: "create_account",
          channel: "directory",
          approvedBy: "policy",
          approvedAt: approvedAt(-2 * 60 * 60_000),
        })),
        {
          spaceId: alice.spaceId,
          userId: alice.userId,
          botId: aliceBot.id,
          itemId: "wrong-category",
          category: "public_post",
          channel: "x",
          approvedBy: "user",
          approvedAt: approvedAt(-60 * 60_000),
        },
        {
          spaceId: bob.spaceId,
          userId: bob.userId,
          botId: bobBot.id,
          itemId: "bob-approval",
          category: "create_account",
          channel: "directory",
          approvedBy: "policy",
          approvedAt: approvedAt(-60 * 60_000),
        },
      ],
    });

    const overview = await client(alice).gtm.overview();
    const glance = await client(alice).notifications.glance();
    expect(glance.gtmNeedsYou).toBe(1);
    expect(overview.goal?.title).toBe("Alice goal");
    expect(overview.groups.needs_you.map((item) => item.title)).toEqual(["Founder review"]);
    expect(overview.groups.in_progress.map((item) => item.title)).toEqual(["Research"]);
    expect(overview.groups.drafts.map((item) => item.title)).toEqual(["Draft only"]);
    expect(overview.groups.done.map((item) => item.title)).toEqual(["Published"]);
    expect(overview.counts).toEqual({ needs_you: 1, in_progress: 1, drafts: 1, done: 1 });
    expect(overview.groups.needs_you[0]).toMatchObject({ proof: "uncertain stamp" });
    expect(overview.channels.find((channel) => channel.channel === "x")).toMatchObject({
      accounts: [{ id: aliceServer.id, label: "@alice", platform: "twitter" }],
    });
    expect(overview.gmailAccounts).toEqual([
      {
        connectionId: id("gmail-alice"),
        label: "Alice Gmail",
        address: "alice@example.test",
        senderRules: "unsupported",
      },
    ]);
    expect(overview.nextRunAt).toBe(aliceRunAt.toISOString());
    expect(overview.directoryPolicy).toEqual({
      founderApprovals: 3,
      autoOpenings: 2,
      approvalsBeforeAuto: 3,
      dailyCap: 5,
    });
    expect(JSON.stringify(overview)).not.toContain("Bob private");
    expect(JSON.stringify(overview)).not.toContain("Elsewhere private");
    expect(JSON.stringify(overview)).not.toContain("@bob");
    expect(JSON.stringify(overview)).not.toContain("@elsewhere");
    expect(callServerTool.mock.calls.map((call) => call[0].id)).toEqual([
      aliceServer.id,
      aliceServer.id,
    ]);
    expect(callServerTool.mock.calls.map((call) => call[2])).toEqual([
      "accounts_list",
      "accounts_list",
    ]);
  });
});
