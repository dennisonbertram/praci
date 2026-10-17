import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  brexExpense,
  fakeBrex,
  fakeMercury,
  MERCURY_CHECKING,
  mercuryAccountsResponse,
  mercuryRow,
} from "./finance-fake-tools.js";
import type { FinanceCallTool } from "./finance-sync.js";
import { syncFinanceForUser } from "./finance-sync.js";

// The real classification rules belong to @rakazo/core; this keeps the test about sync.
vi.mock("@rakazo/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/core")>()),
  classify: (raw: { counterparty: string }, ctx: { brexConnected: boolean }) =>
    raw.counterparty === "Brex" && ctx.brexConnected ? "card_payment" : "spend",
}));

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("finance sync (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `fin-org-${suffix}`;
  const spaceId = `fin-space-${suffix}`;
  const userId = `fin-user-${suffix}`;
  const otherUserId = `fin-other-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  let mercury = fakeMercury({ txns: {} });
  let brex = fakeBrex({ expenses: [] });
  /** Replaces what the next Mercury connection does, for failure cases. */
  let mercuryOnce: (() => Promise<FinanceCallTool>) | null = null;
  const callToolFor = vi.fn(async (server: { provider: string }): Promise<FinanceCallTool> => {
    if (server.provider !== "mercury") return brex.callTool;
    const override = mercuryOnce;
    mercuryOnce = null;
    return override ? override() : mercury.callTool;
  });
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const sync = (opts: { force?: boolean; user?: string } = {}) =>
    syncFinanceForUser({ prisma, callToolFor }, { spaceId, userId: opts.user ?? userId }, opts);

  const addServer = (owner: string, provider: "mercury" | "brex") =>
    prisma.mcpServer.create({
      data: {
        spaceId,
        userId: owner,
        slug: `${provider}-${randomUUID().slice(0, 6)}`,
        name: provider,
        transport: "streamable-http",
        endpoint:
          provider === "mercury" ? "https://mcp.mercury.com/mcp" : "https://api.brex.com/mcp",
      },
    });
  const txns = (owner = userId) =>
    prisma.financeTransaction.findMany({
      where: { spaceId, userId: owner },
      orderBy: { externalId: "asc" },
    });
  const state = (serverId: string) =>
    prisma.financeSyncState.findUniqueOrThrow({ where: { mcpServerId: serverId } });
  const expireThrottle = (serverId: string) =>
    prisma.$executeRaw`UPDATE finance_sync_states SET "lastSyncedAt" = now() - interval '20 minutes' WHERE "mcpServerId" = ${serverId}`;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [userId, otherUserId])
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Finance Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("backfills 13 months, then throttles, then re-reads from 10 days before the last sync", async () => {
    const server = await addServer(userId, "mercury");
    mercury = fakeMercury({
      txns: {
        [MERCURY_CHECKING]: [
          mercuryRow("m-pending", { status: "pending", amount: -20, counterpartyName: "Brex" }),
          mercuryRow("m-ghost", { status: "pending", date: yesterday }),
          mercuryRow("m-old", { date: "2026-02-01T00:00:00.000000Z" }),
        ],
      },
    });
    const postedStarts = () =>
      mercury.calls.filter((c) => c.args.postedStart).map((c) => String(c.args.postedStart));

    expect(await sync()).toEqual({ mercury: "synced" });
    expect((await txns()).map((t) => t.externalId)).toEqual(["m-ghost", "m-old", "m-pending"]);
    const first = postedStarts().at(-1) as string;
    const monthsBack = (Date.now() - Date.parse(first)) / (30.44 * 86_400_000);
    expect(monthsBack).toBeGreaterThan(12.5);
    expect(monthsBack).toBeLessThan(13.5);
    expect((await state(server.id)).lastSyncedAt).not.toBeNull();
    expect(await prisma.financeAccount.count({ where: { spaceId, userId } })).toBe(3);
    expect(await prisma.financeTreasuryYield.count({ where: { spaceId, userId } })).toBe(1);

    const calls = mercury.calls.length;
    expect(await sync()).toEqual({ mercury: "skipped" });
    expect(mercury.calls).toHaveLength(calls);

    await expireThrottle(server.id);
    expect(await sync()).toEqual({ mercury: "synced" });
    const second = postedStarts().at(-1) as string;
    const gapDays = (Date.now() - Date.parse(second)) / 86_400_000;
    // At least 10 days before the last sync. The still-pending m-pending row widens the window, never past 60 days.
    expect(gapDays).toBeGreaterThan(10);
    expect(gapDays).toBeLessThan(61);
  });

  it("updates a pending charge when it posts and drops one that disappeared", async () => {
    mercury = fakeMercury({
      txns: {
        [MERCURY_CHECKING]: [
          mercuryRow("m-pending", {
            status: "sent",
            amount: -21.5,
            counterpartyName: "Brex",
            date: yesterday,
          }),
          mercuryRow("m-old", { date: "2026-02-01T00:00:00.000000Z" }),
        ],
      },
    });
    expect(await sync({ force: true })).toEqual({ mercury: "synced" });
    const rows = await txns();
    expect(rows.map((r) => r.externalId)).toEqual(["m-old", "m-pending"]);
    expect(rows.find((r) => r.externalId === "m-pending")).toMatchObject({
      status: "posted",
      amountCents: -2150n,
      accountExternalId: MERCURY_CHECKING,
      classification: "spend",
    });
  });

  it("reclassifies every row when Brex is connected, and stores Brex bills and receipts", async () => {
    await addServer(userId, "brex");
    brex = fakeBrex({
      expenses: [
        brexExpense("e-1", {
          receipt_count: 1,
          receipts: [{ id: "r", download_uri: "https://files.example.test/r.pdf" }],
        }),
      ],
      bills: [
        {
          id: "b-1",
          status: "APPROVED",
          due_at: "2026-10-30T00:00:00.000Z",
          vendor: { name: "Initech" },
          amount: { value: "99.00", currency: "USD" },
        },
      ],
    });
    expect(await sync({ force: true })).toEqual({ mercury: "synced", brex: "synced" });
    const rows = await txns();
    // The Mercury "Brex" payment was stored before Brex was connected and is not re-read.
    expect(rows.find((r) => r.externalId === "m-pending")?.classification).toBe("card_payment");
    expect(rows.find((r) => r.externalId === "e-1")).toMatchObject({
      provider: "brex",
      hasReceipt: true,
      purchasedAt: new Date("2026-09-10T12:00:00.000Z"),
    });
    expect(await prisma.financeBill.findMany({ where: { spaceId, userId } })).toHaveLength(1);

    brex = fakeBrex({ expenses: [], bills: [] });
    await sync({ force: true });
    expect(await prisma.financeBill.count({ where: { spaceId, userId } })).toBe(0);
  });

  it("writes nothing when another sync took over the claim", async () => {
    const owner = otherUserId;
    const server = await addServer(owner, "mercury");
    mercury = fakeMercury({ txns: { [MERCURY_CHECKING]: [mercuryRow("x-1")] } });
    mercuryOnce = async () => {
      await prisma.$executeRaw`UPDATE finance_sync_states SET "claimToken" = 'someone-else' WHERE "mcpServerId" = ${server.id}`;
      return mercury.callTool;
    };
    expect(await sync({ user: owner })).toEqual({ mercury: "skipped" });
    expect(await txns(owner)).toHaveLength(0);
    expect((await state(server.id)).claimToken).toBe("someone-else");
  });

  it("records a short error, keeps the last good rows and backs off for a minute", async () => {
    const [server] = await prisma.mcpServer.findMany({
      where: { spaceId, userId, endpoint: { contains: "mercury" } },
    });
    await expireThrottle((server as { id: string }).id);
    mercuryOnce = async () => async () => ({ accounts: [{ id: 5 }] });
    expect(await sync()).toEqual({ mercury: "failed", brex: "skipped" });
    const failed = await state((server as { id: string }).id);
    expect(failed).toMatchObject({
      lastError: expect.stringContaining("getAccounts"),
      needsReconnect: false,
      claimToken: null,
    });
    expect((await txns()).length).toBeGreaterThan(0);

    // Within a minute of the failure a normal sync does not retry; a forced one does.
    expect(await sync()).toMatchObject({ mercury: "skipped" });
    mercury = fakeMercury({ txns: { [MERCURY_CHECKING]: [mercuryRow("m-old")] } });
    expect(await sync({ force: true })).toMatchObject({ mercury: "synced" });
    expect(await state((server as { id: string }).id)).toMatchObject({
      lastError: null,
      lastErrorAt: null,
    });
  });

  it("asks the user to reconnect when authorization expired", async () => {
    const [server] = await prisma.mcpServer.findMany({
      where: { spaceId, userId, endpoint: { contains: "mercury" } },
    });
    mercuryOnce = async () => {
      throw new Error("MCP authorization expired. Reconnect this server in MCP settings.");
    };
    await sync({ force: true });
    expect(await state((server as { id: string }).id)).toMatchObject({
      needsReconnect: true,
      lastError: "Sign-in expired",
    });
  });

  it("does not count a Brex server that never synced as connected", async () => {
    const owner = `fin-brex-${suffix}`;
    await prisma.user.create({
      data: { id: owner, name: owner, email: `${owner}@rakazo.test`, emailVerified: false },
    });
    await addServer(owner, "mercury");
    await addServer(owner, "brex");
    mercury = fakeMercury({
      txns: {
        [MERCURY_CHECKING]: [mercuryRow("m-unlinked", { amount: -20, counterpartyName: "Brex" })],
      },
    });
    const brexFails = async () => {
      throw new Error("MCP authorization expired. Reconnect this server in MCP settings.");
    };
    // Both servers are created in the same millisecond, so their sync order is not fixed.
    // Route by provider instead of by call order.
    const byProvider = async (server: { provider: string }) =>
      server.provider === "brex" ? brexFails : mercury.callTool;
    callToolFor.mockImplementationOnce(byProvider);
    callToolFor.mockImplementationOnce(byProvider);
    expect(await sync({ user: owner })).toEqual({ mercury: "synced", brex: "failed" });
    const rows = await txns(owner);
    expect(rows.find((r) => r.externalId === "m-unlinked")?.classification).toBe("spend");
    await prisma.user.delete({ where: { id: owner } });
  });

  it("re-reads a charge that stayed pending past 10 days so it can settle", async () => {
    const owner = `fin-pend-${suffix}`;
    await prisma.user.create({
      data: { id: owner, name: owner, email: `${owner}@rakazo.test`, emailVerified: false },
    });
    const server = await addServer(owner, "brex");
    const purchased = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const expense = (payment_status: string) =>
      brexExpense("e-slow", { payment_status, purchased_at: purchased, posted_at: null });
    brex = fakeBrex({ expenses: [expense("PROCESSING")] });
    expect(await sync({ user: owner })).toEqual({ brex: "synced" });
    expect((await txns(owner))[0]?.status).toBe("pending");

    brex = fakeBrex({ expenses: [expense("CLEARED")] });
    await expireThrottle(server.id);
    expect(await sync({ user: owner })).toEqual({ brex: "synced" });
    expect((await txns(owner))[0]?.status).toBe("posted");
    await prisma.user.delete({ where: { id: owner } });
  });

  it("drops an account that is missing from a fresh snapshot", async () => {
    const owner = `fin-acct-${suffix}`;
    await prisma.user.create({
      data: { id: owner, name: owner, email: `${owner}@rakazo.test`, emailVerified: false },
    });
    const server = await addServer(owner, "mercury");
    mercury = fakeMercury({ txns: {} });
    await sync({ user: owner });
    const accounts = () => prisma.financeAccount.count({ where: { spaceId, userId: owner } });
    expect(await accounts()).toBe(3);

    const [checking] = (mercuryAccountsResponse().accounts as unknown[]).slice(0, 1);
    mercury = fakeMercury({ txns: {}, accounts: { accounts: [checking] } });
    await expireThrottle(server.id);
    await sync({ user: owner });
    expect(await accounts()).toBe(2);
    await prisma.user.delete({ where: { id: owner } });
  });

  it("deletes the rows with the server and never touches another user", async () => {
    expect(await prisma.financeAccount.count({ where: { spaceId, userId: otherUserId } })).toBe(0);
    await prisma.mcpServer.deleteMany({ where: { spaceId, userId } });
    expect(await txns()).toHaveLength(0);
    expect(await prisma.financeAccount.count({ where: { spaceId, userId } })).toBe(0);
    expect(await prisma.financeSyncState.count({ where: { spaceId, userId } })).toBe(0);
  });
});
