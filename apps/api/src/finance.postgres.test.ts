import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import {
  CRYPTO_MCP_ENDPOINT,
  CRYPTO_READ_TOOLS,
  FINANCE_MCP_ENDPOINTS,
  FINANCE_READ_TOOLS,
  financeAgentSpawnKey,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFinanceAgent } from "./finance-agent.js";
import { createRouter, type RouterDeps } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("finance procedures (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `finance-api-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userA = id("user-a");
  const userB = id("user-b");
  const actor = (userId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor(userA);
  const b = actor(userB);
  const webOrigin = "https://app.example.com";
  const redirectUri = `${webOrigin}/mcp/oauth/callback`;

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let repos: ReturnType<typeof createRepos>;
  const enqueued: unknown[] = [];
  let secretCount = 0;

  const client = (who: Actor | null) =>
    createRouterClient(
      createRouter({
        prisma,
        env: { webOrigin },
        jobs: { enqueue: async (job: unknown) => void enqueued.push(job) },
        // Inline-style fake: the ciphertext is unique per write and nothing leaves the process.
        secrets: {
          put: async (plain: string) => ({
            id: `sec-${++secretCount}-${suffix}`,
            ciphertext: `ct-${secretCount}-${plain.length}-${suffix}`,
          }),
          delete: async () => undefined,
        },
        financeCrypto: {
          sync: async () => ({ ok: true, outcome: "synced", failedChains: [] }),
          resolveEns: async () => `0x${"cd".repeat(20)}`,
        },
        // Nobody can sign in to a vendor here; a stored login is simulated by the status below.
        mcpOAuth: {
          statusFor: async () => "connected",
          begin: async (input: { serverId: string }) => ({
            status: "authorization_required",
            sessionId: `session-${input.serverId}`,
            authorizationUrl: "https://auth.example.com/authorize",
          }),
        },
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );

  const server = (userId: string, slug: string, endpoint: string) =>
    prisma.mcpServer.create({
      data: { spaceId, userId, slug, name: slug, transport: "streamable_http", endpoint },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    repos = createRepos(prisma);
    for (const userId of [userA, userB]) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    for (const userId of [userA, userB]) {
      await prisma.member.create({
        data: {
          id: id(`member-${userId}`),
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.mcpServer.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("rejects a caller who is not signed in", async () => {
    await expect(client(null).finance.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(client(null).finance.agent()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  describe("connect and the Finance agent", () => {
    it("creates one server per provider and starts OAuth on it", async () => {
      const first = await client(a).finance.connect({ provider: "mercury", redirectUri });
      const again = await client(a).finance.connect({ provider: "mercury", redirectUri });
      const brex = await client(a).finance.connect({ provider: "brex", redirectUri });

      expect(first).toMatchObject({
        status: "authorization_required",
        sessionId: expect.any(String),
      });
      expect(again.serverId).toBe(first.serverId);
      expect(brex.serverId).not.toBe(first.serverId);
      const rows = await prisma.mcpServer.findMany({ where: { spaceId, userId: userA } });
      expect(rows.map((r) => r.endpoint).sort()).toEqual(
        [FINANCE_MCP_ENDPOINTS.brex, FINANCE_MCP_ENDPOINTS.mercury].sort(),
      );
    });

    it("refuses a redirect that is not the app's callback", async () => {
      await expect(
        client(a).finance.connect({
          provider: "mercury",
          redirectUri: "https://evil.example.com/cb",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("creates one agent however often it is asked, with only the read tools", async () => {
      const bots = await Promise.all(
        Array.from({ length: 5 }, () => ensureFinanceAgent({ prisma, repos }, a)),
      );
      const viaRouter = await client(a).finance.agent();

      expect(new Set([...bots, viaRouter].map((bot) => bot.id)).size).toBe(1);
      expect(viaRouter).toMatchObject({
        name: "Finance agent",
        spawnKey: financeAgentSpawnKey(userA),
      });
      const assignments = await prisma.botMcpServer.findMany({
        where: { botId: viaRouter.id },
        include: { server: true },
      });
      expect(assignments).toHaveLength(2);
      for (const row of assignments) {
        const provider = row.server.endpoint === FINANCE_MCP_ENDPOINTS.mercury ? "mercury" : "brex";
        expect(row).toMatchObject({ spaceId, userId: userA, allowAllTools: false });
        expect(row.allowedTools).toEqual([...FINANCE_READ_TOOLS[provider]]);
      }
    });

    it("narrows an assignment someone widened", async () => {
      const bot = await client(a).finance.agent();
      await prisma.botMcpServer.updateMany({
        where: { botId: bot.id },
        data: { allowAllTools: true, allowedTools: ["requestSendMoney"] },
      });

      await client(a).finance.agent();

      const rows = await prisma.botMcpServer.findMany({ where: { botId: bot.id } });
      expect(rows.every((r) => !r.allowAllTools)).toBe(true);
      expect(rows.flatMap((r) => r.allowedTools as string[])).not.toContain("requestSendMoney");
    });

    it("gives each user their own agent and refuses a client-supplied finance spawn key", async () => {
      const mine = await client(a).finance.agent();
      const theirs = await client(b).finance.agent();
      expect(theirs.id).not.toBe(mine.id);
      expect(await prisma.botMcpServer.count({ where: { botId: theirs.id } })).toBe(0);

      const input = {
        name: "Squatter",
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: true,
        computerMode: "team" as const,
      };
      await expect(
        client(a).bots.create({ ...input, spawnKey: financeAgentSpawnKey(userB) }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("data", () => {
    let serverA: string;
    let serverB: string;
    let accountB: string;
    let txnB: string;

    beforeAll(async () => {
      serverA = (
        await prisma.mcpServer.findFirstOrThrow({
          where: { userId: userA, endpoint: FINANCE_MCP_ENDPOINTS.mercury },
        })
      ).id;
      serverB = (await server(userB, "finance-mercury", FINANCE_MCP_ENDPOINTS.mercury)).id;
      const base = { spaceId, provider: "mercury", currency: "USD" };
      await prisma.financeAccount.createMany({
        data: [
          {
            ...base,
            userId: userA,
            mcpServerId: serverA,
            externalId: "a-checking",
            name: "Checking",
            lastFour: "1111",
            kind: "checking",
            balanceCents: 1_000_000n,
          },
          {
            ...base,
            userId: userB,
            mcpServerId: serverB,
            externalId: "b-checking",
            name: "Checking",
            lastFour: "2222",
            kind: "checking",
            balanceCents: 777_000_000n,
          },
        ],
      });
      accountB = (await prisma.financeAccount.findFirstOrThrow({ where: { userId: userB } })).id;
      const day = (offset: number) => new Date(Date.now() - offset * 86_400_000);
      const txn = (
        userId: string,
        mcpServerId: string,
        accountExternalId: string,
        n: number,
        over = {},
      ) => ({
        ...base,
        userId,
        mcpServerId,
        accountExternalId,
        externalId: `${accountExternalId}-t${n}`,
        postedAt: day(n),
        amountCents: -10_000n,
        counterparty: "Acme Inc.",
        vendorKey: "acme",
        category: "Software",
        status: "posted",
        kind: "other",
        classification: "spend",
        ...over,
      });
      await prisma.financeTransaction.createMany({
        data: [
          ...[3, 33, 63].map((n) => txn(userA, serverA, "a-checking", n)),
          ...[3, 33, 63].map((n) =>
            txn(userB, serverB, "b-checking", n, {
              vendorKey: "secretco",
              counterparty: "Secret Co",
              category: "Legal",
            }),
          ),
        ],
      });
      txnB = (await prisma.financeTransaction.findFirstOrThrow({ where: { userId: userB } })).id;
    });

    it("shows a user only their own accounts, spend and vendors", async () => {
      const overview = await client(a).finance.overview();
      expect(overview.cash.cashCents).toBe(1_000_000);
      expect(overview.agent).not.toBeNull();
      expect(overview.sources.map((s) => [s.provider, s.status])).toEqual([
        ["mercury", "ok"],
        ["brex", "ok"],
      ]);
      // Never synced, so a background sync was queued for this user and space only.
      expect(enqueued).toContainEqual(
        expect.objectContaining({ payload: { userId: userA, spaceId } }),
      );
      const accounts = await client(a).finance.accounts();
      expect(accounts.cash.map((x) => x.name)).toEqual(["Checking"]);
      expect(accounts.totalCashCents).toBe(1_000_000);
      expect(overview.breakdown.vendor.map((v) => v.key)).not.toContain("secretco");
    });

    it("answers NOT_FOUND for another user's ids and keys", async () => {
      const c = client(a);
      await expect(c.finance.account({ id: accountB })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(c.finance.transaction({ id: txnB })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(c.finance.receiptUrl({ transactionId: txnB })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(c.finance.vendor({ key: "secretco" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(c.finance.category({ slug: "legal" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("builds the detail pages from the user's own rows", async () => {
      const c = client(a);
      const vendor = await c.finance.vendor({ key: "acme" });
      expect(vendor).toMatchObject({ key: "acme", name: "Acme Inc.", monthly: expect.any(Array) });
      expect(vendor.charges.length).toBeGreaterThan(0);
      expect((await c.finance.category({ slug: "software" })).label).toBe("Software");
      const [row] = (await c.finance.accounts()).cash;
      const detail = await c.finance.account({ id: row?.id as string });
      expect(detail.transactions.length).toBe(3);
      expect(await c.finance.burn()).toHaveProperty("monthlyCents");
      expect(await c.finance.runway()).toHaveProperty("runway");
      expect((await c.finance.spend({ period: "quarter" })).transactions.length).toBeGreaterThan(0);
    });
  });

  describe("crypto", () => {
    const address = `0x${"ab".repeat(20)}`;

    it("adds, scopes, updates, removes wallets and cascades holdings", async () => {
      const wallet = await client(a).finance.walletAdd({ addressOrEns: address, type: "personal" });
      await expect(
        client(a).finance.walletAdd({ addressOrEns: address, type: "safe" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const ens = await client(a).finance.walletAdd({ addressOrEns: "me.eth", type: "personal" });
      expect(ens).toMatchObject({ address: `0x${"cd".repeat(20)}`, ensName: "me.eth" });

      await prisma.financeCryptoHolding.create({
        data: {
          spaceId,
          userId: userA,
          walletId: wallet.id,
          chainId: 1,
          tokenAddress: "",
          symbol: "ETH",
          name: "Ether",
          decimals: 18,
          rawBalance: "1000000000000000000",
          usdPrice: "2000",
          usdValueCents: 200_000n,
          syncedAt: new Date(),
        },
      });
      const crypto = await client(a).finance.crypto();
      expect(crypto.holdings).toEqual([
        expect.objectContaining({ tokenAddress: null, usdValueCents: 200_000 }),
      ]);
      expect(crypto.summary.totalCents).toBe(200_000);
      expect(await client(b).finance.wallets()).toEqual([]);

      await expect(
        client(b).finance.walletUpdate({ id: wallet.id, label: "x" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(client(b).finance.walletRemove({ id: wallet.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await client(a).finance.walletUpdate({ id: wallet.id, label: "Main" })).toMatchObject({
        label: "Main",
      });
      await client(a).finance.walletRemove({ id: wallet.id });
      expect(await prisma.financeCryptoHolding.count({ where: { walletId: wallet.id } })).toBe(0);
    });

    it("connects Blockscout once, stores the key encrypted, and gives the agent only crypto read tools", async () => {
      const agent = await client(a).finance.agent();
      const first = await client(a).finance.cryptoConnect({});
      expect(first.hasApiKey).toBe(false);
      const keyed = await client(a).finance.cryptoConnect({ apiKey: "pro-key-xyz" });
      expect(keyed).toEqual({ serverId: first.serverId, hasApiKey: true });
      const row = await prisma.mcpServer.findFirstOrThrow({ where: { id: first.serverId } });
      expect(row.secretId).not.toBeNull();
      expect(JSON.stringify(row)).not.toContain("pro-key-xyz");
      expect(JSON.stringify(await client(a).finance.crypto())).not.toContain("pro-key-xyz");
      expect(await client(a).finance.crypto()).toMatchObject({ connected: true, hasApiKey: true });
      const assigned = await prisma.botMcpServer.findFirstOrThrow({
        where: { botId: agent.id, serverId: first.serverId },
      });
      expect(assigned.allowedTools).toEqual([...CRYPTO_READ_TOOLS]);
      expect(
        await prisma.mcpServer.count({
          where: { spaceId, userId: userA, endpoint: CRYPTO_MCP_ENDPOINT },
        }),
      ).toBe(1);
    });
  });
});
