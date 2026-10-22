import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { syncSafesForUser } from "./safe-sync.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const request = (id: string) => ({
  id,
  documentUrl: null,
  expiresAt: "2099-01-01T00:00:00Z",
  includesMostFavoredNationClause: false,
  includesProRataRightsLetter: false,
  investmentAmount: 25_000,
  investmentDate: "2026-10-01",
  valuationType: "PostMoney",
  investor: {
    signatoryName: "Ada Example",
    signatoryEmail: "ada@example.test",
    legalEntityName: "",
  },
  valuationCap: 10_000_000,
});

describePostgres("safe sync (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `ss-org-${suffix}`;
  const spaceId = `ss-space-${suffix}`;
  const userId = `ss-user-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let answer: unknown = [request("a"), { id: "broken" }];
  const callTool = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const sync = (opts: { force?: boolean } = {}) =>
    syncSafesForUser({ prisma, callToolFor: async () => callTool }, { spaceId, userId }, opts);
  const rows = () => prisma.safe.findMany({ where: { spaceId, userId, source: "mercury" } });
  const state = () =>
    prisma.safeSyncState.findUniqueOrThrow({ where: { spaceId_userId: { spaceId, userId } } });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Safe Sync", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("does nothing without a Mercury server", async () => {
    expect(await sync()).toBe("not_connected");
    expect(callTool).not.toHaveBeenCalled();
  });

  it("writes readable rows, counts the unreadable one, then throttles until forced", async () => {
    await prisma.mcpServer.create({
      data: {
        spaceId,
        userId,
        slug: "mercury",
        name: "Mercury",
        transport: "http",
        endpoint: "https://mcp.mercury.com/mcp",
      },
    });
    expect(await sync()).toBe("synced");
    expect(await rows()).toHaveLength(1);
    expect((await state()).unreadable).toBe(1);
    expect(await sync()).toBe("skipped");
    expect(callTool).toHaveBeenCalledTimes(1);
    answer = [request("a"), request("b")];
    expect(await sync({ force: true })).toBe("synced");
    expect(await rows()).toHaveLength(2);
    expect((await state()).unreadable).toBe(0);
  });

  it("records a failed read on the state and writes nothing", async () => {
    answer = new Error("Authorization expired");
    expect(await sync({ force: true })).toBe("failed");
    const failed = await state();
    expect(failed).toMatchObject({ lastError: "Sign-in expired", needsReconnect: true });
    expect(await rows()).toHaveLength(2);
  });
});
