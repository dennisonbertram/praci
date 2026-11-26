import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  addContactIfNew,
  ContactEmailTakenError,
  contactDetail,
  deleteContact,
  listContacts,
  saveContact,
  withContactPhotos,
} from "./contacts.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("contacts (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `contacts-org-${suffix}`;
  const mine = { spaceId: `contacts-space-a-${suffix}`, userId: `contacts-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `contacts-user-b-${suffix}` };
  const otherSpace = { spaceId: `contacts-space-b-${suffix}`, userId: mine.userId };
  let prisma: PrismaClient;
  let close: () => Promise<void>;

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
      data: {
        id: organizationId,
        name: "Contacts Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({ id, organizationId, name: id })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, sameSpace.userId] } } });
    await close();
  });

  it("addContactIfNew creates once and never changes an existing contact", async () => {
    const first = await addContactIfNew(prisma, mine, {
      name: "Add One",
      email: "add-one@example.test",
      kind: "vendor",
    });
    expect(first.created).toBe(true);
    const again = await addContactIfNew(prisma, mine, {
      name: "Renamed",
      email: "add-one@example.test",
      kind: "other",
      notes: "new note",
    });
    expect(again.created).toBe(false);
    expect(again.contact).toEqual(first.contact);
    const byName = await addContactIfNew(prisma, mine, {
      name: "No Email",
      organization: "Acme Corp",
    });
    const sameName = await addContactIfNew(prisma, mine, {
      name: "no email",
      organization: "ACME CORP",
    });
    const otherOrg = await addContactIfNew(prisma, mine, {
      name: "No Email",
      organization: "Other Co",
    });
    expect(sameName.created).toBe(false);
    expect(sameName.contact.id).toBe(byName.contact.id);
    expect(otherOrg.created).toBe(true);
    const other = await addContactIfNew(prisma, sameSpace, {
      name: "Mine",
      email: "add-one@example.test",
    });
    expect(other.created).toBe(true);
    for (const [owner, id] of [
      [mine, first.contact.id],
      [mine, byName.contact.id],
      [mine, otherOrg.contact.id],
      [sameSpace, other.contact.id],
    ] as const)
      await deleteContact(prisma, owner, id);
  });

  it("treats LIKE metacharacters literally in contact searches", async () => {
    const literal = await saveContact(prisma, mine, { name: "a_c" });
    const wildcard = await saveContact(prisma, mine, { name: "abc" });
    try {
      expect((await listContacts(prisma, mine, { text: "a_c" })).map((row) => row.id)).toEqual([
        literal.id,
      ]);
    } finally {
      await deleteContact(prisma, mine, literal.id);
      await deleteContact(prisma, mine, wildcard.id);
    }
  });

  it("records the agent that added a contact, finds notes, and forgets the agent when it is deleted", async () => {
    const bot = await prisma.bot.create({
      data: { spaceId: mine.spaceId, userId: mine.userId, name: "Chief", color: "#000000" },
    });
    const added = await addContactIfNew(
      prisma,
      mine,
      { name: "Agent Found", notes: "outside counsel for the lease" },
      bot.id,
    );
    expect(added.contact.addedBy).toEqual({ id: bot.id, name: "Chief" });
    const byHand = await saveContact(prisma, mine, { name: "By Hand" });
    expect(byHand.addedBy).toBeNull();
    // An update keeps the agent.
    const edited = await saveContact(prisma, mine, { id: added.contact.id, name: "Agent Found 2" });
    expect(edited.addedBy).toEqual({ id: bot.id, name: "Chief" });
    // Text search covers notes.
    expect((await listContacts(prisma, mine, { text: "LEASE" })).map((c) => c.id)).toEqual([
      added.contact.id,
    ]);
    // Another user in the same space never sees it.
    expect(await listContacts(prisma, sameSpace, { text: "lease" })).toEqual([]);
    await prisma.bot.delete({ where: { id: bot.id } });
    const [after] = await listContacts(prisma, mine, { text: "lease" });
    expect(after?.addedBy).toBeNull();
    await deleteContact(prisma, mine, added.contact.id);
    await deleteContact(prisma, mine, byHand.id);
  });

  it("addContactIfNew matches an email exactly and an empty organization as none", async () => {
    const dotted = await addContactIfNew(prisma, mine, {
      name: "Dot",
      email: "al.ice@example.test",
    });
    const underscore = await addContactIfNew(prisma, mine, {
      name: "Under",
      email: "al_ice@example.test",
    });
    expect(underscore.created).toBe(true);
    const first = await addContactIfNew(prisma, mine, { name: "Blank Org", organization: "" });
    const again = await addContactIfNew(prisma, mine, { name: "Blank Org", organization: "" });
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.contact.id).toBe(first.contact.id);
    for (const row of [dotted, underscore, first])
      await deleteContact(prisma, mine, row.contact.id);
  });

  it("refuses to create a contact whose email another contact has, and leaves it unchanged", async () => {
    const first = await saveContact(prisma, mine, {
      name: "Ada Fund",
      email: "ada@example.test",
      organization: "Example Capital",
    });
    expect(first.kind).toBe("investor");
    await expect(
      saveContact(prisma, mine, { name: "Ada Lovelace", email: "ada@example.test", kind: "other" }),
    ).rejects.toBeInstanceOf(ContactEmailTakenError);
    expect(await listContacts(prisma, mine)).toEqual([first]);
    // Updating by id keeps omitted fields and changes the given ones.
    const again = await saveContact(prisma, mine, {
      id: first.id,
      name: "Ada Lovelace",
      notes: "Lead",
    });
    expect(again).toMatchObject({
      name: "Ada Lovelace",
      organization: "Example Capital",
      notes: "Lead",
    });
  });

  it("clears notes and organization given null, and keeps them when omitted", async () => {
    const saved = await saveContact(prisma, sameSpace, {
      name: "Clear Me",
      organization: "Org",
      notes: "keep?",
    });
    const kept = await saveContact(prisma, sameSpace, { id: saved.id, name: "Clear Me" });
    expect(kept).toMatchObject({ organization: "Org", notes: "keep?" });
    const cleared = await saveContact(prisma, sameSpace, {
      id: saved.id,
      name: "Clear Me",
      organization: null,
      notes: null,
    });
    expect(cleared).toMatchObject({ organization: null, notes: null });
    await deleteContact(prisma, sameSpace, saved.id);
  });

  it("ignores extra actor fields such as email", async () => {
    const actor = { ...sameSpace, email: "someone@example.test", isDeploymentOwner: true };
    const saved = await saveContact(prisma, actor, {
      name: "Actor Contact",
      email: "a@example.test",
    });
    expect((await listContacts(prisma, actor)).map((c) => c.id)).toEqual([saved.id]);
    await deleteContact(prisma, actor, saved.id);
    expect(await listContacts(prisma, actor)).toEqual([]);
  });

  it("allows several contacts without an email and updates by id", async () => {
    const a = await saveContact(prisma, mine, { name: "Zed Auditor", kind: "auditor" });
    await saveContact(prisma, mine, { name: "Bea Other", kind: "other" });
    const renamed = await saveContact(prisma, mine, { id: a.id, name: "Zed Audits", email: null });
    expect(renamed.id).toBe(a.id);
    expect((await listContacts(prisma, mine)).map((c) => c.name)).toEqual([
      "Ada Lovelace",
      "Bea Other",
      "Zed Audits",
    ]);
  });

  it("rejects changing an email to one another contact has", async () => {
    const [bea] = await listContacts(prisma, mine, { kind: "other" });
    await expect(
      saveContact(prisma, mine, { id: bea!.id, name: "Bea Other", email: "ada@example.test" }),
    ).rejects.toBeInstanceOf(ContactEmailTakenError);
  });

  it("filters by kind and text", async () => {
    expect((await listContacts(prisma, mine, { kind: "auditor" })).map((c) => c.name)).toEqual([
      "Zed Audits",
    ]);
    expect(
      (await listContacts(prisma, mine, { text: "EXAMPLE capital" })).map((c) => c.name),
    ).toEqual(["Ada Lovelace"]);
  });

  it("keeps contacts private to the user and space", async () => {
    const [mineRow] = await listContacts(prisma, mine, { kind: "investor" });
    expect(await listContacts(prisma, sameSpace)).toEqual([]);
    expect(await listContacts(prisma, otherSpace)).toEqual([]);
    for (const other of [sameSpace, otherSpace]) {
      await expect(
        saveContact(prisma, other, { id: mineRow!.id, name: "Hijack" }),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(deleteContact(prisma, other, mineRow!.id)).rejects.toBeInstanceOf(
        IsolationError,
      );
    }
    // The same email is a separate contact for another user.
    const theirs = await saveContact(prisma, sameSpace, {
      name: "Mine now",
      email: "ada@example.test",
    });
    expect(theirs.id).not.toBe(mineRow!.id);
    expect((await listContacts(prisma, mine, { kind: "investor" }))[0]!.name).toBe("Ada Lovelace");
  });

  it("deletes only the user's own contact", async () => {
    const [ada] = await listContacts(prisma, mine, { kind: "investor" });
    await deleteContact(prisma, mine, ada!.id);
    expect((await listContacts(prisma, mine)).map((c) => c.name)).toEqual([
      "Bea Other",
      "Zed Audits",
    ]);
    await expect(deleteContact(prisma, mine, ada!.id)).rejects.toBeInstanceOf(IsolationError);
    expect(await listContacts(prisma, sameSpace)).toHaveLength(1);
  });

  it("keeps a restored commitment in its own round and refuses another user's round", async () => {
    const base = { name: "Round Keeper", kind: "prospect" as const, stage: "committed" as const };
    const mk = (u: typeof mine, name: string, closed: boolean) =>
      prisma.fundraiseRound.create({
        data: { ...u, name, targetCents: 1n, capCents: 1n, closedAt: closed ? new Date() : null },
      });
    const closedRound = await mk(mine, "A", true);
    const openRound = await mk(mine, "B", false);
    const foreign = await mk(sameSpace, "C", false);
    const restored = await saveContact(prisma, mine, { ...base, roundId: closedRound.id });
    expect(restored.roundId).toBe(closedRound.id);
    const fresh = await saveContact(prisma, mine, { ...base, name: "Fresh" });
    expect(fresh.roundId).toBe(openRound.id);
    await expect(
      saveContact(prisma, mine, { ...base, name: "Thief", roundId: foreign.id }),
    ).rejects.toBeInstanceOf(IsolationError);
  });

  it("contactDetail joins mail, meetings, documents and SAFEs by stored keys within the owner", async () => {
    const contact = await saveContact(prisma, mine, {
      name: "Detail Person",
      email: "Detail@Example.test",
    });
    const stranger = await saveContact(prisma, mine, { name: "Stranger", email: "s@example.test" });
    const conn = (who: typeof mine) =>
      prisma.connection.create({
        data: { ...who, provider: "gmail", displayName: "mail", status: "active" },
      });
    const connection = await conn(mine);
    const otherSpaceConnection = await conn(otherSpace);
    const mail = (
      who: typeof mine,
      connectionId: string,
      id: string,
      threadId: string,
      at: number,
      fields: { fromAddress: string; toAddresses?: string[]; ccAddresses?: string[] },
    ) =>
      prisma.cachedMailMessage.create({
        data: {
          ...who,
          connectionId,
          providerMessageId: id,
          threadId,
          toAddresses: [],
          ccAddresses: [],
          subject: id,
          snippet: "",
          receivedAt: new Date(at),
          unread: false,
          seenAt: new Date(at),
          ...fields,
        },
      });
    await mail(mine, connection.id, "old", "t1", 1000, { fromAddress: "detail@example.test" });
    await mail(mine, connection.id, "new", "t1", 3000, {
      fromAddress: "me@example.test",
      toAddresses: ["DETAIL@example.test"],
    });
    await mail(mine, connection.id, "cc", "t2", 2000, {
      fromAddress: "z@example.test",
      ccAddresses: ["detail@example.test"],
    });
    await mail(mine, connection.id, "unrelated", "t3", 4000, { fromAddress: "z@example.test" });
    await mail(otherSpace, otherSpaceConnection.id, "foreign", "t4", 5000, {
      fromAddress: "detail@example.test",
    });
    const meeting = (who: typeof mine, externalId: string, attendees: object[]) =>
      prisma.meeting.create({
        data: {
          ...who,
          provider: "granola",
          externalId,
          title: externalId,
          startedAt: new Date(1000),
          sourceUpdatedAt: new Date(1000),
          attendees,
        },
      });
    await meeting(mine, "with-contact", [{ email: "detail@example.test" }]);
    await meeting(mine, "without", [{ email: "x@example.test" }]);
    await meeting(otherSpace, "foreign", [{ email: "detail@example.test" }]);
    const item = (who: typeof mine, name: string) =>
      prisma.dataRoomItem.create({
        data: {
          ...who,
          source: "upload",
          sha256: `${name}-${suffix}`,
          name,
          mimeType: "application/pdf",
          size: 1,
          status: "ready",
        },
      });
    const shared = await item(mine, "shared.pdf");
    await item(mine, "unshared.pdf");
    await prisma.investorShare.create({
      data: { ...mine, contactId: contact.id, dataRoomItemId: shared.id },
    });
    await prisma.safe.create({
      data: { ...mine, contactId: contact.id, investorName: "Detail Person", amountCents: 5000n },
    });

    const detail = await contactDetail(prisma, mine, contact.id);
    expect(detail.contact.id).toBe(contact.id);
    expect(detail.mail.map((m) => m.subject)).toEqual(["new", "cc"]);
    expect(detail.meetings.map((m) => m.title)).toEqual(["with-contact"]);
    expect(detail.documents.map((d) => d.name)).toEqual(["shared.pdf"]);
    expect(detail.safes.map((safe) => safe.amountCents)).toEqual([5000]);
    const empty = await contactDetail(prisma, mine, stranger.id);
    expect([empty.mail, empty.meetings, empty.documents, empty.safes]).toEqual([[], [], [], []]);

    for (const who of [sameSpace, otherSpace])
      await expect(contactDetail(prisma, who, contact.id)).rejects.toBeInstanceOf(IsolationError);
    await expect(contactDetail(prisma, mine, "missing")).rejects.toBeInstanceOf(IsolationError);
  });

  it("adds photoUrl only to this user's contacts that have a stored photo", async () => {
    const withPhoto = await saveContact(prisma, mine, { name: "Pic", email: "Pic@Example.test" });
    const without = await saveContact(prisma, mine, { name: "NoPic", email: "nopic@example.test" });
    const photo = {
      storageKey: "k",
      source: "google",
      contentType: "image/png",
      contentHash: "h",
      fetchedAt: new Date(),
    };
    await prisma.contactPhoto.createMany({
      data: [
        { ...mine, email: "pic@example.test", ...photo },
        // Another user's photo for the same address must not show for this user.
        { ...sameSpace, email: "nopic@example.test", ...photo },
      ],
    });
    const [a, b] = await withContactPhotos(prisma, mine, [withPhoto, without]);
    expect(a?.photoUrl).toBe("/api/contacts/photo?email=pic%40example.test");
    expect(b?.photoUrl).toBeUndefined();
  });
});
