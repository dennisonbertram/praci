import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  addContactIfNew,
  ContactEmailTakenError,
  deleteContact,
  listContacts,
  saveContact,
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
      email: "ADD-ONE@example.test",
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
});
