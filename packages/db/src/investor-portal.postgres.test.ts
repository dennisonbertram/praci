import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { linkedContact, saveContact } from "./contacts.js";
import {
  exchangePortalToken,
  getSharedDocument,
  listPortalDocuments,
  listPortalUpdates,
  mintPortalToken,
  PORTAL_SESSION_TTL_MS,
  PORTAL_TOKEN_TTL_MS,
  portalNoticeRecipients,
  resolvePortalSession,
  revokePortal,
  shareDocument,
  shareDocuments,
  unblockPortal,
  unshareDocument,
} from "./investor-portal.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("investor portal (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `ip-org-${suffix}`;
  const mine = { spaceId: `ip-space-a-${suffix}`, userId: `ip-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `ip-user-b-${suffix}` };
  const otherSpace = { spaceId: `ip-space-b-${suffix}`, userId: mine.userId };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const now = new Date("2026-03-01T12:00:00Z");

  const contact = (who: typeof mine, name: string, extra: Record<string, unknown> = {}) =>
    prisma.contact.create({
      data: {
        ...who,
        name,
        email: `${name.toLowerCase()}-${who.userId}@example.test`,
        kind: "investor",
        ...extra,
      },
    });
  const item = (who: typeof mine, name: string) =>
    prisma.dataRoomItem.create({
      data: {
        ...who,
        source: "upload",
        sha256: `${name}-${suffix}`,
        name,
        mimeType: "application/pdf",
        size: 10,
        status: "ready",
        storageKey: `key-${name}-${suffix}`,
      },
    });
  const update = (who: typeof mine, data: Record<string, unknown>) =>
    prisma.investorUpdate.create({
      data: { ...who, audience: "investors", subject: "Q1", period: "2026-Q1", ...data },
    });
  const open = async (id: string, at = now) => {
    const token = await mintPortalToken(prisma, mine, id, at);
    const opened = await exchangePortalToken(prisma, token, at);
    if (!opened) throw new Error("exchange refused");
    return { token, ...opened };
  };

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
      data: { id: organizationId, name: "Portal Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({
        id,
        organizationId,
        name: `Company ${id}`,
      })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, sameSpace.userId] } } });
    await close();
  });

  it("stores only hashes and gives a session value that is not a contact id", async () => {
    const a = await contact(mine, "Hash");
    const { token, session } = await open(a.id);
    const tokens = await prisma.investorPortalToken.findMany({ where: { contactId: a.id } });
    const sessions = await prisma.portalSession.findMany({ where: { contactId: a.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens[0]?.tokenHash).not.toBe(token);
    expect(sessions[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session).not.toBe(a.id);
    expect(session).not.toBe(token);
    expect(session).not.toContain(a.id);
    expect(tokens[0]?.expiresAt.getTime()).toBe(now.getTime() + PORTAL_TOKEN_TTL_MS);
    expect(sessions[0]?.expiresAt.getTime()).toBe(now.getTime() + PORTAL_SESSION_TTL_MS);
    const row = await prisma.contact.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.portalLinkSentAt).toEqual(now);
    expect(row.portalLastSeenAt).toEqual(now);
  });

  it("creates no user or membership rows", async () => {
    const before = await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.spaceMember.count(),
    ]);
    const a = await contact(mine, "NoAccount");
    await open(a.id);
    expect(
      await Promise.all([prisma.user.count(), prisma.session.count(), prisma.spaceMember.count()]),
    ).toEqual(before);
  });

  it("refuses an expired token, an unknown token and a non-investor", async () => {
    const a = await contact(mine, "Expired");
    const token = await mintPortalToken(prisma, mine, a.id, now);
    const late = new Date(now.getTime() + PORTAL_TOKEN_TTL_MS + 1);
    expect(await exchangePortalToken(prisma, token, late)).toBeNull();
    expect(await exchangePortalToken(prisma, "not-a-token", now)).toBeNull();
    const board = await contact(mine, "Board", { kind: "board" });
    await expect(mintPortalToken(prisma, mine, board.id, now)).rejects.toThrow(IsolationError);
    const theirs = await contact(sameSpace, "Theirs");
    await expect(mintPortalToken(prisma, mine, theirs.id, now)).rejects.toThrow(IsolationError);
  });

  it("a second send mints a second working token and the first still works", async () => {
    const a = await contact(mine, "TwoLinks");
    const first = await mintPortalToken(prisma, mine, a.id, now);
    const second = await mintPortalToken(prisma, mine, a.id, new Date(now.getTime() + 1000));
    expect(second).not.toBe(first);
    expect(await exchangePortalToken(prisma, first, now)).not.toBeNull();
    expect(await exchangePortalToken(prisma, second, now)).not.toBeNull();
  });

  it("deletes only this contact's expired sessions when a link is opened", async () => {
    const a = await contact(mine, "SessionSweep");
    const other = await contact(otherSpace, "SessionSweepOther");
    const row = (who: typeof mine, contactId: string, name: string, expiresAt: Date) =>
      prisma.portalSession.create({
        data: { ...who, contactId, tokenHash: `${name}-${suffix}`, expiresAt },
      });
    const expired = await row(mine, a.id, "expired-a", new Date(now.getTime() - 1000));
    const live = await row(mine, a.id, "live-a", new Date(now.getTime() + 60_000));
    const foreign = await row(otherSpace, other.id, "expired-b", new Date(now.getTime() - 1000));
    const { session } = await open(a.id);
    const ids = (await prisma.portalSession.findMany({ where: { contactId: a.id } })).map(
      (r) => r.id,
    );
    expect(ids).toHaveLength(2);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(expired.id);
    expect(await resolvePortalSession(prisma, session, now)).not.toBeNull();
    expect(await prisma.portalSession.findUnique({ where: { id: foreign.id } })).not.toBeNull();
  });

  it("deletes expired tokens on the next mint", async () => {
    const a = await contact(mine, "Sweep");
    const old = await mintPortalToken(prisma, mine, a.id, now);
    await mintPortalToken(prisma, mine, a.id, new Date(now.getTime() + PORTAL_TOKEN_TTL_MS + 1));
    expect(await exchangePortalToken(prisma, old, now)).toBeNull();
    expect(await prisma.investorPortalToken.count({ where: { contactId: a.id } })).toBe(1);
  });

  it("expires a session", async () => {
    const a = await contact(mine, "SessionExpiry");
    const { session } = await open(a.id);
    expect(await resolvePortalSession(prisma, session, now)).not.toBeNull();
    const late = new Date(now.getTime() + PORTAL_SESSION_TTL_MS + 1);
    expect(await resolvePortalSession(prisma, session, late)).toBeNull();
  });

  it("revoke deletes every token and session, ends a live session and blocks", async () => {
    const a = await contact(mine, "Revoked");
    const first = await open(a.id);
    const spare = await mintPortalToken(prisma, mine, a.id, now);
    await revokePortal(prisma, mine, a.id, now);
    expect(await prisma.investorPortalToken.count({ where: { contactId: a.id } })).toBe(0);
    expect(await prisma.portalSession.count({ where: { contactId: a.id } })).toBe(0);
    const row = await prisma.contact.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.portalBlockedAt).toEqual(now);
    expect(await resolvePortalSession(prisma, first.session, now)).toBeNull();
    expect(await exchangePortalToken(prisma, spare, now)).toBeNull();
    await expect(mintPortalToken(prisma, mine, a.id, now)).rejects.toThrow();
    expect(await listPortalUpdates(prisma, first.principal)).toEqual([]);
  });

  it("unblock does not revive an old cookie or link, and a new link works", async () => {
    const a = await contact(mine, "Unblocked");
    const first = await open(a.id);
    await revokePortal(prisma, mine, a.id, now);
    await unblockPortal(prisma, mine, a.id);
    const row = await prisma.contact.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.portalBlockedAt).toBeNull();
    expect(row.portalLinkSentAt).toBeNull();
    expect(await resolvePortalSession(prisma, first.session, now)).toBeNull();
    expect(await exchangePortalToken(prisma, first.token, now)).toBeNull();
    expect((await open(a.id)).session).toBeTruthy();
  });

  it("refuses a blocked contact everywhere", async () => {
    const a = await contact(mine, "Blocked", { portalBlockedAt: now });
    await expect(mintPortalToken(prisma, mine, a.id, now)).rejects.toThrow();
    const share = await item(mine, "blocked.pdf");
    await prisma.investorShare.create({
      data: { ...mine, contactId: a.id, dataRoomItemId: share.id },
    });
    const principal = { ...mine, contactId: a.id };
    expect(await listPortalUpdates(prisma, principal)).toEqual([]);
    expect(await listPortalDocuments(prisma, principal)).toEqual([]);
    expect(await getSharedDocument(prisma, principal, share.id)).toBeNull();
  });

  it("lists sent and posted investor updates only, including ones before the contact existed", async () => {
    const space = { spaceId: `ip-vis-${suffix}`, userId: mine.userId };
    await prisma.space.create({ data: { id: space.spaceId, organizationId, name: "Vis Co" } });
    await update(space, { subject: "Sent", status: "sent", sentAt: new Date("2026-01-10") });
    await update(space, { subject: "Posted", status: "posted", sentAt: new Date("2026-02-10") });
    await update(space, { subject: "Draft", status: "draft" });
    await update(space, { subject: "Sending", status: "sending" });
    await update(space, {
      subject: "Board",
      audience: "board",
      status: "sent",
      sentAt: new Date("2026-02-01"),
    });
    await update(otherSpace, { subject: "Elsewhere", status: "sent", sentAt: new Date() });
    await update(sameSpace, { subject: "Other owner", status: "sent", sentAt: new Date() });
    // The contact is added after every update above.
    const late = await contact(space, "Late");
    const token = await mintPortalToken(prisma, space, late.id, now);
    const opened = await exchangePortalToken(prisma, token, now);
    const listed = await listPortalUpdates(prisma, opened!.principal);
    expect(listed.map((u) => u.subject)).toEqual(["Posted", "Sent"]);
  });

  it("never lists another contact's shares, another space's or another owner's", async () => {
    const a = await contact(mine, "ShareA");
    const b = await contact(mine, "ShareB");
    const doc = await item(mine, "a-only.pdf");
    const bDoc = await item(mine, "b-only.pdf");
    expect(await shareDocument(prisma, mine, doc.id, [a.id])).toEqual([a.id]);
    expect(await shareDocument(prisma, mine, doc.id, [a.id])).toEqual([]);
    await shareDocument(prisma, mine, bDoc.id, [b.id]);
    const pa = { ...mine, contactId: a.id };
    const pb = { ...mine, contactId: b.id };
    expect((await listPortalDocuments(prisma, pa)).map((d) => d.name)).toEqual(["a-only.pdf"]);
    expect((await listPortalDocuments(prisma, pb)).map((d) => d.name)).toEqual(["b-only.pdf"]);
    expect(await getSharedDocument(prisma, pa, bDoc.id)).toBeNull();
    expect((await getSharedDocument(prisma, pa, doc.id))?.storageKey).toBe(
      `key-a-only.pdf-${suffix}`,
    );

    // Another owner in the same space cannot share, or be shared, my item or contact.
    const theirs = await contact(sameSpace, "TheirContact");
    const theirItem = await item(sameSpace, "theirs.pdf");
    await expect(shareDocument(prisma, mine, theirItem.id, [a.id])).rejects.toThrow(IsolationError);
    expect(await shareDocument(prisma, mine, doc.id, [theirs.id])).toEqual([]);
    // A forged share row for a contact of another owner is still never listed.
    await prisma.investorShare.create({
      data: { ...sameSpace, contactId: theirs.id, dataRoomItemId: theirItem.id },
    });
    expect(await listPortalDocuments(prisma, { ...mine, contactId: theirs.id })).toEqual([]);
    const outsideSpace = await item(otherSpace, "elsewhere.pdf");
    await expect(shareDocument(prisma, mine, outsideSpace.id, [a.id])).rejects.toThrow(
      IsolationError,
    );

    await unshareDocument(prisma, mine, doc.id, a.id);
    expect(await listPortalDocuments(prisma, pa)).toEqual([]);
  });

  it("a batch shares each shareable file at once and reports the ones it refuses", async () => {
    const a = await contact(mine, "BatchA");
    const b = await contact(mine, "BatchB");
    const kept = await item(mine, "kept.pdf");
    const deck = await item(mine, "deck.pdf");
    const note = await prisma.dataRoomItem.create({
      data: {
        ...mine,
        source: "meeting",
        sha256: `note-${suffix}`,
        name: "notes.md",
        mimeType: "text/markdown",
        size: 5,
        status: "ready",
        storageKey: `key-note-${suffix}`,
      },
    });
    const theirs = await item(sameSpace, "foreign.pdf");
    const first = await shareDocuments(
      prisma,
      mine,
      [kept.id, deck.id, note.id, theirs.id],
      [a.id, b.id],
    );
    // Every asked-for file is reported in request order; the meeting note and the other owner's
    // file are refused without stopping the rest.
    expect(first.items).toEqual([
      { itemId: kept.id, shared: true },
      { itemId: deck.id, shared: true },
      { itemId: note.id, shared: false },
      { itemId: theirs.id, shared: false },
    ]);
    expect(first.added.get(a.id)).toEqual(["kept.pdf", "deck.pdf"]);
    expect(first.added.get(b.id)).toEqual(["kept.pdf", "deck.pdf"]);
    const pa = { ...mine, contactId: a.id };
    expect((await listPortalDocuments(prisma, pa)).map((d) => d.name).sort()).toEqual([
      "deck.pdf",
      "kept.pdf",
    ]);
    expect(await getSharedDocument(prisma, pa, note.id)).toBeNull();
    expect(await prisma.investorShare.count({ where: { dataRoomItemId: theirs.id } })).toBe(0);

    // An investor who already has every listed file gains nothing, so no email goes out.
    const again = await shareDocuments(prisma, mine, [kept.id, deck.id], [a.id]);
    expect(again.items.every((i) => i.shared)).toBe(true);
    expect(again.added.size).toBe(0);
    // A contact of another owner gains nothing from a batch either.
    const outside = await contact(sameSpace, "Outside");
    const none = await shareDocuments(prisma, mine, [kept.id], [outside.id]);
    expect(none.added.size).toBe(0);
    expect(none.items).toEqual([{ itemId: kept.id, shared: true }]);

    // The single-file form keeps refusing what a batch only reports: meeting notes and
    // another owner's items.
    await expect(shareDocument(prisma, mine, note.id, [a.id])).rejects.toThrow(IsolationError);
    await expect(shareDocument(prisma, mine, theirs.id, [a.id])).rejects.toThrow(IsolationError);
  });

  it("an email change through contacts.save ends sessions and tokens", async () => {
    const a = await contact(mine, "EmailChange");
    const live = await open(a.id);
    await saveContact(prisma, mine, { id: a.id, name: a.name, email: "new-address@example.test" });
    expect(await resolvePortalSession(prisma, live.session, now)).toBeNull();
    expect(await exchangePortalToken(prisma, live.token, now)).toBeNull();
    const row = await prisma.contact.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.portalLinkSentAt).toBeNull();
    expect(row.portalLastSeenAt).toBeNull();
    // Saving without changing the address keeps access.
    const kept = await open(a.id);
    await saveContact(prisma, mine, {
      id: a.id,
      name: "Renamed",
      email: "new-address@example.test",
    });
    expect(await resolvePortalSession(prisma, kept.session, now)).not.toBeNull();
  });

  it("a kind change away from investor ends tokens, sessions and shares", async () => {
    const a = await contact(mine, "KindChange");
    const live = await open(a.id);
    const doc = await item(mine, "kind.pdf");
    await shareDocument(prisma, mine, doc.id, [a.id]);
    await saveContact(prisma, mine, { id: a.id, name: a.name, kind: "advisor" });
    expect(await resolvePortalSession(prisma, live.session, now)).toBeNull();
    expect(await exchangePortalToken(prisma, live.token, now)).toBeNull();
    expect(await prisma.investorShare.count({ where: { contactId: a.id } })).toBe(0);
  });

  it("an exchange racing Revoke never leaves a live session, even after Unblock", async () => {
    for (let round = 0; round < 8; round += 1) {
      const a = await contact(mine, `RaceRevoke${round}`);
      const token = await mintPortalToken(prisma, mine, a.id, now);
      await Promise.all([
        exchangePortalToken(prisma, token, now),
        revokePortal(prisma, mine, a.id, now),
      ]);
      expect(await prisma.portalSession.count({ where: { contactId: a.id } })).toBe(0);
      await unblockPortal(prisma, mine, a.id);
      expect(await prisma.portalSession.count({ where: { contactId: a.id } })).toBe(0);
    }
  });

  it("an exchange racing an email change never leaves a live session", async () => {
    for (let round = 0; round < 8; round += 1) {
      const a = await contact(mine, `RaceEmail${round}`);
      const token = await mintPortalToken(prisma, mine, a.id, now);
      await Promise.all([
        exchangePortalToken(prisma, token, now),
        saveContact(prisma, mine, { id: a.id, name: a.name, email: `moved${round}@example.test` }),
      ]);
      expect(await prisma.portalSession.count({ where: { contactId: a.id } })).toBe(0);
    }
  });

  it("notices go to unrevoked investors with an email, and to nobody else", async () => {
    const space = { spaceId: `ip-notice-${suffix}`, userId: mine.userId };
    await prisma.space.create({ data: { id: space.spaceId, organizationId, name: "Notice Co" } });
    const ok = await contact(space, "Ok");
    await contact(space, "NoEmail", { email: null });
    await contact(space, "Revoked", { portalBlockedAt: now });
    await contact(space, "Board", { kind: "board" });
    await contact(space, "Auditor", { kind: "auditor" });
    await contact(space, "Prospect", { kind: "prospect" });
    await contact(sameSpace, "OtherOwner");
    const got = await portalNoticeRecipients(prisma, space);
    expect(got.map((c) => c.id)).toEqual([ok.id]);
  });

  it("contacts.linked names tokens and shares", async () => {
    const plain = await contact(mine, "Plain");
    expect(await linkedContact(prisma, mine, plain.id)).toEqual({
      portal: false,
      documents: [],
      safes: 0,
    });
    const a = await contact(mine, "Linked");
    await mintPortalToken(prisma, mine, a.id, now);
    const doc = await item(mine, "linked.pdf");
    await shareDocument(prisma, mine, doc.id, [a.id]);
    expect(await linkedContact(prisma, mine, a.id)).toEqual({
      portal: true,
      documents: ["linked.pdf"],
      safes: 0,
    });
    // A revoked investor has no live link, but deleting the contact drops the block record.
    const barred = await contact(mine, "Barred");
    await prisma.contact.update({ where: { id: barred.id }, data: { portalBlockedAt: now } });
    expect((await linkedContact(prisma, mine, barred.id)).portal).toBe(true);
    // A SAFE linked to the contact counts too.
    const funded = await contact(mine, "Funded");
    await prisma.safe.create({
      data: { ...mine, contactId: funded.id, investorName: "Funded", amountCents: 1n },
    });
    expect((await linkedContact(prisma, mine, funded.id)).safes).toBe(1);
    await expect(linkedContact(prisma, sameSpace, a.id)).rejects.toThrow(IsolationError);
  });
});
