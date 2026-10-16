import type { Contact, ContactKind, ContactSaveInput } from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "contact">;

export const toContact = (row: Prisma.ContactGetPayload<object>): Contact => ({
  id: row.id,
  name: row.name,
  email: row.email,
  organization: row.organization,
  kind: row.kind as ContactKind,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** The user's contacts by name, optionally one kind and/or text found in name, email or organization. */
export async function listContacts(
  prisma: Db,
  scope: Scope,
  filter: { kind?: ContactKind; text?: string } = {},
): Promise<Contact[]> {
  const text = filter.text?.trim();
  const contains = (field: "name" | "email" | "organization") => ({
    [field]: { contains: text, mode: "insensitive" as const },
  });
  const rows = await prisma.contact.findMany({
    where: {
      ...scope,
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(text ? { OR: [contains("name"), contains("email"), contains("organization")] } : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return rows.map(toContact);
}

/**
 * Creates a contact, or updates one: by `id`, else the user's contact with the same email.
 * Omitted fields are kept on update. Throws IsolationError for an `id` that is not the user's.
 */
export async function saveContact(
  prisma: Db,
  scope: Scope,
  input: ContactSaveInput,
): Promise<Contact> {
  const { id, ...fields } = input;
  if (id) {
    const { count } = await prisma.contact.updateMany({ where: { id, ...scope }, data: fields });
    if (count === 0) throw new IsolationError("Contact not found");
    return toContact(await prisma.contact.findUniqueOrThrow({ where: { id } }));
  }
  if (!input.email)
    return toContact(await prisma.contact.create({ data: { ...scope, ...fields } }));
  return toContact(
    await prisma.contact.upsert({
      where: { spaceId_userId_email: { ...scope, email: input.email } },
      create: { ...scope, ...fields },
      update: fields,
    }),
  );
}

export async function deleteContact(prisma: Db, scope: Scope, id: string): Promise<void> {
  const { count } = await prisma.contact.deleteMany({ where: { id, ...scope } });
  if (count === 0) throw new IsolationError("Contact not found");
}
