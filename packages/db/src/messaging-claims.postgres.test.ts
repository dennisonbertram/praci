import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  acquirePollLease,
  advancePollCursor,
  claimInboundMessage,
  messagingInboundKey,
  releaseInboundMessage,
} from "./messaging-claims.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("messaging claims and poll lease (PostgreSQL)", () => {
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const run = randomUUID().slice(0, 8);

  beforeAll(() => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
  });
  afterAll(async () => {
    await prisma.messagingInboundClaim.deleteMany({ where: { key: { contains: run } } });
    await prisma.messagingPollCursor.deleteMany({ where: { provider: { contains: run } } });
    await close();
  });

  it("lets exactly one of many concurrent callers claim a message", async () => {
    const key = messagingInboundKey("bluebubbles", `guid-${run}`);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimInboundMessage(prisma, key)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await claimInboundMessage(prisma, key)).toBe(false);
  });

  it("lets a released claim be taken again", async () => {
    const key = messagingInboundKey("bluebubbles", `released-${run}`);
    expect(await claimInboundMessage(prisma, key)).toBe(true);
    await releaseInboundMessage(prisma, key);
    expect(await claimInboundMessage(prisma, key)).toBe(true);
  });

  it("gives the poll lease to one replica at a time and expires it", async () => {
    const provider = `bb-${run}`;
    const now = new Date("2026-01-01T00:00:00.000Z");
    const [a, b] = await Promise.all([
      acquirePollLease(prisma, provider, 50_000, now),
      acquirePollLease(prisma, provider, 50_000, now),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect([a, b].find(Boolean)?.cursorMs).toBeNull();
    const later = new Date(now.getTime() + 51_000);
    expect(await acquirePollLease(prisma, provider, 50_000, later)).toEqual({ cursorMs: null });
  });

  it("only moves the cursor forward", async () => {
    const provider = `bb-cursor-${run}`;
    await acquirePollLease(prisma, provider, 0);
    await advancePollCursor(prisma, provider, 2_000);
    await advancePollCursor(prisma, provider, 1_000);
    const lease = await acquirePollLease(prisma, provider, 1000, new Date(Date.now() + 10));
    expect(lease).toEqual({ cursorMs: 2_000 });
  });
});
