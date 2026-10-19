import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("notifications.glance (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `gl-org-${suffix}`;
  const spaceA = `gl-space-a-${suffix}`;
  const spaceB = `gl-space-b-${suffix}`;
  const alice: Actor = {
    spaceId: spaceA,
    userId: `gl-alice-${suffix}`,
    email: "a@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: `gl-bob-${suffix}`, email: "b@example.test" };
  const aliceElsewhere: Actor = { ...alice, spaceId: spaceB };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const glance = (actor: Actor) =>
    createRouterClient(createRouter({ prisma } as unknown as RouterDeps), {
      context: { actor },
    }).notifications.glance();
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob].map((a) => ({
        id: a.userId,
        name: a.userId,
        email: `${a.userId}@x.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Glance Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((id) => ({ id, organizationId, name: id })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice.userId, bob.userId] } } });
    await close();
  });

  it("is empty for a caller with nothing to show", async () => {
    expect(await glance(alice)).toEqual({
      financeRunwayMonths: null,
      legalDueSoon: 0,
      dataRoomWaiting: 0,
      urgentBotIds: [],
    });
  });

  it("counts only the caller's own legal deadlines due within a week", async () => {
    const row = (who: Actor, title: string, dueDate: Date, status = "open") => ({
      spaceId: who.spaceId,
      userId: who.userId,
      title,
      dueDate,
      kind: "renewal",
      status,
    });
    await prisma.legalDeadline.createMany({
      data: [
        row(alice, "overdue", day(-3)),
        row(alice, "soon", day(5)),
        row(alice, "later", day(30)),
        row(alice, "done", day(2), "done"),
        row(bob, "bob soon", day(2)),
        row(aliceElsewhere, "other space", day(2)),
      ],
    });
    expect((await glance(alice)).legalDueSoon).toBe(2);
    expect((await glance(bob)).legalDueSoon).toBe(1);
    expect((await glance(aliceElsewhere)).legalDueSoon).toBe(1);
  });

  it("counts failed data room items for the caller only", async () => {
    const item = (who: Actor, status: string, n: number) => ({
      spaceId: who.spaceId,
      userId: who.userId,
      source: "upload",
      sha256: `${suffix}-${who.userId}-${n}`,
      name: `file-${n}`,
      mimeType: "application/pdf",
      size: 1,
      status,
    });
    await prisma.dataRoomItem.createMany({
      data: [item(alice, "failed", 1), item(alice, "ready", 2), item(bob, "failed", 3)],
    });
    expect((await glance(alice)).dataRoomWaiting).toBe(1);
    expect((await glance(bob)).dataRoomWaiting).toBe(1);
    expect((await glance(aliceElsewhere)).dataRoomWaiting).toBe(0);
  });

  it("lists agents with an unseen attention notification, for the caller only", async () => {
    const row = (who: Actor, botId: string, extra: object, key: string) => ({
      spaceId: who.spaceId,
      userId: who.userId,
      botId,
      surface: "thread",
      title: "t",
      dedupeKey: key,
      ...extra,
    });
    await prisma.notification.createMany({
      data: [
        row(alice, "bot-urgent", { importance: "attention" }, "1"),
        row(alice, "bot-urgent", { importance: "attention" }, "2"),
        row(alice, "bot-info", { importance: "info" }, "3"),
        row(alice, "bot-seen", { importance: "attention", seenAt: new Date() }, "4"),
        row(bob, "bot-bob", { importance: "attention" }, "5"),
      ],
    });
    expect((await glance(alice)).urgentBotIds).toEqual(["bot-urgent"]);
    expect((await glance(bob)).urgentBotIds).toEqual(["bot-bob"]);
    expect((await glance(aliceElsewhere)).urgentBotIds).toEqual([]);
  });

  it("reports runway from the three full months before this one, reading only those rows", async () => {
    await prisma.financeAccount.create({
      data: {
        spaceId: alice.spaceId,
        userId: alice.userId,
        provider: "mercury",
        externalId: `acct-${suffix}`,
        name: "Checking",
        kind: "checking",
        balanceCents: 1_200_000n,
        currency: "USD",
      },
    });
    const now = new Date();
    const monthDay = (monthsAgo: number) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 15));
    const tx = (key: string, postedAt: Date, cents: bigint) => ({
      spaceId: alice.spaceId,
      userId: alice.userId,
      provider: "mercury",
      externalId: `tx-${suffix}-${key}`,
      accountExternalId: `acct-${suffix}`,
      postedAt,
      amountCents: cents,
      currency: "USD",
      counterparty: "Vendor",
      vendorKey: "vendor",
      status: "sent",
      kind: "other",
      classification: "spend",
    });
    await prisma.financeTransaction.createMany({
      data: [
        // 1,000.00 a month for the three full months before this one: burn 1,000.00.
        tx("m1", monthDay(1), -100_000n),
        tx("m2", monthDay(2), -100_000n),
        tx("m3", monthDay(3), -100_000n),
        // Outside the window: this month and everything older.
        tx("now", now, -900_000n),
        ...Array.from({ length: 30 }, (_, n) => tx(`old${n}`, monthDay(4 + n), -900_000n)),
      ],
    });
    const spy = vi.spyOn(prisma.financeTransaction, "findMany");
    const months = (await glance(alice)).financeRunwayMonths;
    const read = await spy.mock.results[0]?.value;
    spy.mockRestore();
    // 12,000.00 of cash at 1,000.00 a month.
    expect(months).toBe(12);
    expect(read).toHaveLength(3);
    expect((await glance(bob)).financeRunwayMonths).toBeNull();
  });
});
