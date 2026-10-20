import type { MailSignals } from "@rakazo/contracts";
import { MAIL_SIGNALS_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyPileRules } from "./mail-piles.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const quiet: MailSignals = {
  listUnsubscribe: [],
  oneClick: false,
  listId: null,
  bulk: false,
  autoSubmitted: false,
  auth: { dkim: "pass", spf: "pass", dmarc: "pass" },
  dkimCoversUnsubscribe: false,
  categories: {
    spam: false,
    promotions: false,
    social: false,
    updates: false,
    forums: false,
    important: false,
  },
};
const forged: MailSignals = { ...quiet, auth: { dkim: "fail", spf: "pass", dmarc: "fail" } };

describePostgres("learned sender decisions (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `learn-user-${suffix}`;
  const otherUserId = `learn-other-${suffix}`;
  const organizationId = `learn-org-${suffix}`;
  const spaceId = `learn-space-${suffix}`;
  const otherSpaceId = `learn-space2-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let counter = 0;

  async function connect(owner = { spaceId, userId }) {
    return prisma.connection.create({
      data: {
        ...owner,
        connectorId: "emulator",
        provider: "gmail",
        displayName: "learn",
        status: "connected",
        providerRef: `learn-${++counter}-${suffix}`,
        metadata: { mailAddress: "me@example.test" },
      },
    });
  }
  /** A fresh connection with a stats row for `sender`, so a decision can be stored. */
  async function setup(sender: string, stat: Record<string, unknown> = {}) {
    const connection = await connect();
    await prisma.mailSenderStat.create({
      data: {
        spaceId,
        userId,
        connectionId: connection.id,
        senderAddress: sender,
        priorContact: false,
        ...stat,
      },
    });
    return connection;
  }
  const mail = (
    connection: { id: string; spaceId: string; userId: string },
    sender: string,
    extra: Partial<{
      category: string | null;
      signals: MailSignals;
      receivedAt: Date;
      inInbox: boolean;
      notSpamAt: Date;
    }> = {},
  ) =>
    prisma.cachedMailMessage.create({
      data: {
        spaceId: connection.spaceId,
        userId: connection.userId,
        connectionId: connection.id,
        providerMessageId: `m-${++counter}`,
        threadId: `t-${counter}`,
        fromAddress: sender,
        subject: "Field notes for October",
        snippet: "",
        receivedAt: extra.receivedAt ?? daysAgo(0.5),
        unread: true,
        inInbox: extra.inInbox ?? true,
        category: extra.category === undefined ? "newsletter" : extra.category,
        notSpamAt: extra.notSpamAt ?? null,
        seenAt: new Date(),
        signals: extra.signals ?? quiet,
        signalsVersion: MAIL_SIGNALS_VERSION,
      },
    });
  const learnedOf = (connectionId: string, sender: string) =>
    prisma.mailSenderStat.findFirstOrThrow({
      where: { connectionId, senderAddress: sender },
      select: {
        learnedPile: true,
        learnedCount: true,
        learnedAt: true,
        learnedForgottenAt: true,
      },
    });
  const apply = (connection: { id: string; spaceId: string; userId: string }) =>
    prisma.$transaction((tx) =>
      applyPileRules(
        tx,
        { spaceId: connection.spaceId, userId: connection.userId, connectionId: connection.id },
        daysAgo(14),
      ),
    );
  const rowsOf = (connectionId: string) =>
    prisma.cachedMailMessage.findMany({
      where: { connectionId },
      select: { rulePile: true, ruleReasons: true, pile: true },
    });

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
      data: { id: organizationId, name: "Learn Org", slug: organizationId, createdAt: new Date() },
    });
    for (const id of [spaceId, otherSpaceId])
      await prisma.space.create({
        data: { id, organizationId, name: id, isDefault: id === spaceId },
      });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  const SENDER = "notes@notes.example.test";

  it("learns a pile from three agreeing verdicts and applies it to later quiet mail", async () => {
    const connection = await setup(SENDER);
    for (let i = 0; i < 3; i++) await mail(connection, SENDER);
    await apply(connection);

    const learned = await learnedOf(connection.id, SENDER);
    expect(learned).toMatchObject({ learnedPile: "newsletters", learnedCount: 3 });
    expect(learned.learnedAt).not.toBeNull();

    await mail(connection, SENDER, { category: null });
    await apply(connection);
    const rows = await rowsOf(connection.id);
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.rulePile === "newsletters")).toHaveLength(4);
    expect(rows.every((r) => r.ruleReasons.join() === "learned_sender")).toBe(true);
    expect(rows.every((r) => r.pile === "newsletters")).toBe(true);
  });

  it("does not learn from two verdicts", async () => {
    const connection = await setup(SENDER);
    for (let i = 0; i < 2; i++) await mail(connection, SENDER);
    await apply(connection);
    expect((await learnedOf(connection.id, SENDER)).learnedPile).toBeNull();
  });

  it("does not learn from a conflicting verdict or from failed authentication", async () => {
    const conflict = await setup(SENDER);
    for (const category of ["newsletter", "newsletter", "newsletter", "receipt"])
      await mail(conflict, SENDER, { category });
    await apply(conflict);
    expect((await learnedOf(conflict.id, SENDER)).learnedPile).toBeNull();

    const spoofed = await setup(SENDER);
    for (let i = 0; i < 2; i++) await mail(spoofed, SENDER);
    await mail(spoofed, SENDER, { signals: forged });
    await apply(spoofed);
    expect((await learnedOf(spoofed.id, SENDER)).learnedPile).toBeNull();
  });

  it("clears an existing decision on a conflicting verdict, a mark, Not spam, prior contact or a spoof", async () => {
    const stored = { learnedPile: "newsletters", learnedCount: 3, learnedAt: daysAgo(1) };
    const cleared = { learnedPile: null, learnedCount: 0, learnedAt: null };

    const conflict = await setup(SENDER, stored);
    await mail(conflict, SENDER, { category: "action" });
    await apply(conflict);
    expect(await learnedOf(conflict.id, SENDER)).toMatchObject(cleared);

    const notSpam = await setup(SENDER, stored);
    await mail(notSpam, SENDER, { notSpamAt: new Date() });
    await apply(notSpam);
    expect(await learnedOf(notSpam.id, SENDER)).toMatchObject(cleared);

    const contacted = await setup(SENDER, { ...stored, priorContact: true });
    await mail(contacted, SENDER);
    await apply(contacted);
    expect(await learnedOf(contacted.id, SENDER)).toMatchObject(cleared);

    const marked = await setup(SENDER, stored);
    await mail(marked, SENDER);
    await prisma.inboxSenderFeedback.create({
      data: { spaceId, userId, senderAddress: SENDER, mark: "noise" },
    });
    await apply(marked);
    expect(await learnedOf(marked.id, SENDER)).toMatchObject(cleared);
    await prisma.inboxSenderFeedback.deleteMany({ where: { spaceId, userId } });

    // The sender's quiet mail with failed authentication: the decision stays but is not applied.
    const spoofed = await setup(SENDER, stored);
    await mail(spoofed, SENDER, { signals: forged, category: null });
    await apply(spoofed);
    expect((await learnedOf(spoofed.id, SENDER)).learnedPile).toBe("newsletters");
    expect((await rowsOf(spoofed.id))[0]).toMatchObject({ rulePile: null, pile: null });
  });

  it("keeps the decision when all of the sender's mail has left the inbox", async () => {
    const connection = await setup(SENDER, {
      learnedPile: "newsletters",
      learnedCount: 3,
      learnedAt: daysAgo(1),
    });
    await mail(connection, SENDER, { inInbox: false });
    await mail(connection, "other@notes.example.test");
    await apply(connection);
    expect(await learnedOf(connection.id, SENDER)).toMatchObject({
      learnedPile: "newsletters",
      learnedCount: 3,
    });
  });

  it("does not relearn from old mail after the user forgot, but does after three new verdicts", async () => {
    const connection = await setup(SENDER, { learnedForgottenAt: daysAgo(1) });
    for (let i = 0; i < 3; i++) await mail(connection, SENDER, { receivedAt: daysAgo(2) });
    await apply(connection);
    expect((await learnedOf(connection.id, SENDER)).learnedPile).toBeNull();

    for (let i = 0; i < 3; i++) await mail(connection, SENDER, { receivedAt: daysAgo(0.5) });
    await apply(connection);
    expect(await learnedOf(connection.id, SENDER)).toMatchObject({
      learnedPile: "newsletters",
      learnedCount: 3,
    });
  });

  it("applies a decision only to its own connection and user", async () => {
    const a = await setup(SENDER, {
      learnedPile: "newsletters",
      learnedCount: 3,
      learnedAt: daysAgo(1),
    });
    const b = await setup(SENDER);
    const stranger = await connect({ spaceId: otherSpaceId, userId: otherUserId });
    await prisma.mailSenderStat.create({
      data: {
        spaceId: otherSpaceId,
        userId: otherUserId,
        connectionId: stranger.id,
        senderAddress: SENDER,
        priorContact: false,
      },
    });
    for (const connection of [a, b, stranger]) await mail(connection, SENDER, { category: null });
    for (const connection of [a, b, stranger]) await apply(connection);

    expect((await rowsOf(a.id))[0]?.rulePile).toBe("newsletters");
    expect((await rowsOf(b.id))[0]?.rulePile).toBeNull();
    expect((await rowsOf(stranger.id))[0]?.rulePile).toBeNull();
    expect((await learnedOf(b.id, SENDER)).learnedPile).toBeNull();
    expect((await learnedOf(stranger.id, SENDER)).learnedPile).toBeNull();
  });
});
