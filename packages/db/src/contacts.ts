import type { Contact, ContactKind, ContactSaveInput } from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "./client.js";
import { isUniqueViolation } from "./prisma-errors.js";
import { IsolationError } from "./scope.js";

export class ContactEmailTakenError extends Error {
  constructor() {
    super("Another contact already has this email.");
    this.name = "ContactEmailTakenError";
  }
}

type Scope = { spaceId: string; userId: string };
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });
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
  actor: Scope,
  filter: { kind?: ContactKind; text?: string } = {},
): Promise<Contact[]> {
  const scope = ownerOf(actor);
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
 * Updates the contact with `id`, keeping omitted fields; without `id`, creates one.
 * Throws IsolationError for an `id` that is not the user's.
 */
async function writeContact(prisma: Db, actor: Scope, input: ContactSaveInput): Promise<Contact> {
  const scope = ownerOf(actor);
  const { id, ...fields } = input;
  if (!id) return toContact(await prisma.contact.create({ data: { ...scope, ...fields } }));
  const { count } = await prisma.contact.updateMany({ where: { id, ...scope }, data: fields });
  if (count === 0) throw new IsolationError("Contact not found");
  return toContact(await prisma.contact.findUniqueOrThrow({ where: { id } }));
}

export async function deleteContact(prisma: Db, actor: Scope, id: string): Promise<void> {
  const scope = ownerOf(actor);
  const { count } = await prisma.contact.deleteMany({ where: { id, ...scope } });
  if (count === 0) throw new IsolationError("Contact not found");
}

/** Creates a new contact. Throws ContactEmailTakenError when the email already belongs to one. */
export const addContact = (prisma: Db, actor: Scope, input: Omit<ContactSaveInput, "id">) =>
  prisma.contact
    .create({ data: { ...ownerOf(actor), ...input } })
    .then(toContact)
    .catch((error: unknown) => {
      throw isUniqueViolation(error) ? new ContactEmailTakenError() : error;
    });

/** Creates or updates a contact. Throws ContactEmailTakenError when another contact has the email. */
export const saveContact = (prisma: Db, actor: Scope, input: ContactSaveInput) =>
  writeContact(prisma, actor, input).catch((error: unknown) => {
    throw isUniqueViolation(error) ? new ContactEmailTakenError() : error;
  });
