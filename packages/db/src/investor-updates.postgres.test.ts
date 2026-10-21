import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  attemptKey,
  claimInvestorUpdateRetry,
  claimInvestorUpdateSend,
  deleteInvestorUpdate,
  duplicateInvestorUpdate,
  finishInvestorUpdateSend,
  getInvestorUpdate,
  InvestorUpdateLockedError,
  listInvestorUpdates,
  markInvestorUpdateDelivered,
  recordInvestorAttempt,
  SENDING_STALE_MS,
  saveInvestorUpdate,
} from "./investor-updates.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("investor updates (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `iu-org-${suffix}`;
  const mine = { spaceId: `iu-space-a-${suffix}`, userId: `iu-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `iu-user-b-${suffix}` };
  const otherSpace = { spaceId: `iu-space-b-${suffix}`, userId: mine.userId };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let connectionId: string;
  const contact: Record<string, string> = {};

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [mine.userId, sameSpace.userId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "IU Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({
        id,
        organizationId,
        name: "Acme Test Co",
      })),
    });
    const connection = await prisma.connection.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        provider: "gmail",
        displayName: "me@example.test",
        status: "connected",
      },
    });
    connectionId = connection.id;
    const make = async (key: string, kind: string, email: string | null, owner = mine) => {
      const row = await prisma.contact.create({ data: { ...owner, name: key, kind, email } });
      contact[key] = row.id;
    };
    await make("Ann", "investor", "ann@example.test");
    await make("Bob", "investor", "bob@example.test");
    await make("NoEmail", "investor", null);
    await make("Board", "board", "board@example.test");
    await make("Theirs", "investor", "theirs@example.test", sameSpace);
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, sameSpace.userId] } } });
    await close();
  });

  const setComposeState = (clientId: string, state: string) =>
    prisma.composeSend.upsert({
      where: { spaceId_userId_clientId: { ...mine, clientId } },
      create: { ...mine, connectionId, clientId, state },
      update: { state },
    });

  it("adds a draft with the audience's contacts that have an email, the default subject and the previous month", async () => {
    const update = await saveInvestorUpdate(
      prisma,
      mine,
      { audience: "investors" },
      new Date("2026-11-03T10:00:00Z"),
    );
    expect(update).toMatchObject({
      audience: "investors",
      status: "draft",
      period: "2026-10",
      subject: "Acme Test Co · 2026-10 update",
      body: "",
      deliveries: [],
    });
    expect(update.recipientContactIds.sort()).toEqual([contact.Ann, contact.Bob].sort());
    const board = await saveInvestorUpdate(prisma, mine, { audience: "board" });
    expect(board.recipientContactIds).toEqual([contact.Board]);
  });

  it("lists a sent update ahead of a newer draft", async () => {
    const older = await saveInvestorUpdate(prisma, mine, { audience: "investors" });
    const newer = await saveInvestorUpdate(prisma, mine, { audience: "investors" });
    await prisma.investorUpdate.update({
      where: { id: older.id },
      data: { status: "sent", sentAt: new Date(Date.now() + 60_000) },
    });
    const ids = (await listInvestorUpdates(prisma, mine)).map((u) => u.id);
    expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
  });

  it("keeps updates scoped to the space and user and refuses another user's contacts", async () => {
    const update = await saveInvestorUpdate(prisma, mine, {
      audience: "investors",
      recipientContactIds: [contact.Ann!, contact.Theirs!, contact.Board!],
    });
    // A contact of another user, or of the wrong kind, is dropped.
    expect(update.recipientContactIds).toEqual([contact.Ann]);
    for (const other of [sameSpace, otherSpace]) {
      expect((await listInvestorUpdates(prisma, other)).map((u) => u.id)).not.toContain(update.id);
      await expect(getInvestorUpdate(prisma, other, update.id)).rejects.toBeInstanceOf(
        IsolationError,
      );
      await expect(
        saveInvestorUpdate(prisma, other, { id: update.id, body: "x" }),
      ).rejects.toThrow();
      await expect(deleteInvestorUpdate(prisma, other, update.id)).rejects.toBeInstanceOf(
        IsolationError,
      );
    }
    expect(await getInvestorUpdate(prisma, mine, update.id)).toMatchObject({ id: update.id });
  });

  it("claims a send once, records attempts and reads the outcome from the compose rows", async () => {
    const draft = await saveInvestorUpdate(prisma, mine, {
      audience: "investors",
      body: "Hello",
      recipientContactIds: [contact.Ann!, contact.Bob!],
      fromConnectionId: connectionId,
    });
    expect(await claimInvestorUpdateSend(prisma, mine, draft.id)).not.toBeNull();
    // The second Send finds it already claimed.
    expect(await claimInvestorUpdateSend(prisma, mine, draft.id)).toBeNull();
    await expect(
      saveInvestorUpdate(prisma, mine, { id: draft.id, body: "changed" }),
    ).rejects.toBeInstanceOf(InvestorUpdateLockedError);

    const annN = await recordInvestorAttempt(prisma, mine, draft.id, contact.Ann!);
    expect(annN).toBe(1);
    await setComposeState(attemptKey(draft.id, contact.Ann!, annN), "sent");
    const bobN = await recordInvestorAttempt(prisma, mine, draft.id, contact.Bob!);
    await setComposeState(attemptKey(draft.id, contact.Bob!, bobN), "failed");
    await finishInvestorUpdateSend(prisma, mine, draft.id);

    const done = await getInvestorUpdate(prisma, mine, draft.id);
    expect(done.status).toBe("partly_sent");
    expect(done.sentAt).not.toBeNull();
    expect(done.deliveries).toEqual([
      { contactId: contact.Ann, name: "Ann", state: "sent" },
      { contactId: contact.Bob, name: "Bob", state: "failed" },
    ]);
    // A sent update cannot be deleted from under a running send, but can once finished.
    // Retry sends to the failed recipient only, as attempt 2 with its own compose key.
    const retry = await claimInvestorUpdateRetry(prisma, mine, draft.id, {});
    expect(retry?.contactIds).toEqual([contact.Bob]);
    expect(await recordInvestorAttempt(prisma, mine, draft.id, contact.Bob!)).toBe(2);
    await setComposeState(attemptKey(draft.id, contact.Bob!, 2), "sent");
    await finishInvestorUpdateSend(prisma, mine, draft.id);
    expect((await getInvestorUpdate(prisma, mine, draft.id)).status).toBe("sent");
  });

  it("shows a stale sending update as Partly sent and an attempt with no result as Unknown", async () => {
    const draft = await saveInvestorUpdate(prisma, mine, {
      audience: "investors",
      recipientContactIds: [contact.Ann!, contact.Bob!],
    });
    await claimInvestorUpdateSend(prisma, mine, draft.id);
    const n = await recordInvestorAttempt(prisma, mine, draft.id, contact.Ann!);
    const soon = new Date(Date.now() + 60_000);
    const late = new Date(Date.now() + SENDING_STALE_MS + 60_000);
    expect((await getInvestorUpdate(prisma, mine, draft.id, soon)).status).toBe("sending");
    const stale = await getInvestorUpdate(prisma, mine, draft.id, late);
    expect(stale.status).toBe("partly_sent");
    // Ann was attempted with no result; Bob was never attempted.
    expect(stale.deliveries).toEqual([
      { contactId: contact.Ann, name: "Ann", state: "unknown" },
      { contactId: contact.Bob, name: "Bob", state: "failed" },
    ]);
    // Unknown is not retried unless confirmed; a failed one is.
    const plain = await claimInvestorUpdateRetry(prisma, mine, draft.id, {}, late);
    expect(plain?.contactIds).toEqual([contact.Bob]);
    await prisma.investorUpdate.update({ where: { id: draft.id }, data: { status: "sending" } });
    await prisma.investorUpdate.updateMany({
      where: { id: draft.id },
      data: { updatedAt: new Date(Date.now() - SENDING_STALE_MS - 1000) },
    });
    // Mark delivered records the Unknown recipient as Sent.
    const marked = await markInvestorUpdateDelivered(prisma, mine, draft.id, [contact.Ann!]);
    expect(marked.deliveries.find((d) => d.contactId === contact.Ann)?.state).toBe("sent");
    expect(n).toBe(1);
  });

  it("duplicates into a new draft and deletes drafts but not a running send", async () => {
    const source = await saveInvestorUpdate(prisma, mine, {
      audience: "board",
      body: "Board note",
    });
    const copy = await duplicateInvestorUpdate(prisma, mine, source.id);
    expect(copy).toMatchObject({ audience: "board", body: "Board note", status: "draft" });
    expect(copy.id).not.toBe(source.id);
    await claimInvestorUpdateSend(prisma, mine, source.id);
    await expect(deleteInvestorUpdate(prisma, mine, source.id)).rejects.toBeInstanceOf(
      InvestorUpdateLockedError,
    );
    await deleteInvestorUpdate(prisma, mine, copy.id);
    await expect(getInvestorUpdate(prisma, mine, copy.id)).rejects.toBeInstanceOf(IsolationError);
  });
});
