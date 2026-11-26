import type {
  Contact,
  ContactDetail,
  ContactKind,
  ContactLinked,
  ContactSaveInput,
} from "@rakazo/contracts";
import { CONTACT_DETAIL_LIMIT } from "@rakazo/contracts";
import { isActiveSafe } from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import { endPortalAccess } from "./investor-portal.js";
import { likeLiteral } from "./like-literal.js";
import { listMeetings } from "./meetings.js";
import type { PipelineDb } from "./pipeline-records.js";
import {
  ensureRecord,
  FUNDRAISING_PIPELINE,
  joinRecord,
  pipelineFields,
  promoteNextPerson,
  recordOfContact,
  savePipelineRecord,
} from "./pipeline-records.js";
import { isUniqueViolation } from "./prisma-errors.js";
import { safeInRecordRound, toSafe } from "./safes.js";
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
type Db = Pick<PrismaClient, "contact" | "fundraiseRound" | "safe">;
type WriteDb = Db & PipelineDb & Pick<PrismaClient, "$transaction">;

/** What `toContact` reads besides the contact: its agent and its fundraising record. */
export const contactInclude = {
  bot: { select: { id: true, name: true } },
  pipelinePeople: { where: { pipeline: FUNDRAISING_PIPELINE }, select: { record: true } },
} as const;

export const toContact = (
  row: Prisma.ContactGetPayload<{ include: typeof contactInclude }>,
): Contact => ({
  id: row.id,
  name: row.name,
  email: row.email,
  organization: row.organization,
  kind: row.kind as ContactKind,
  notes: row.notes,
  ...pipelineFields(row.pipelinePeople[0]?.record ?? null),
  portalLinkSentAt: row.portalLinkSentAt?.toISOString() ?? null,
  portalLastSeenAt: row.portalLastSeenAt?.toISOString() ?? null,
  portalBlockedAt: row.portalBlockedAt?.toISOString() ?? null,
  addedBy: row.bot,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** The user's contacts by name, optionally one kind and/or text found in name, email, organization or notes. */
export async function listContacts(
  prisma: Db,
  actor: Scope,
  filter: { kind?: ContactKind; text?: string } = {},
): Promise<Contact[]> {
  const scope = ownerOf(actor);
  const text = filter.text?.trim();
  const escapedText = text ? likeLiteral(text) : undefined;
  const contains = (field: "name" | "email" | "organization" | "notes") => ({
    [field]: { contains: escapedText, mode: "insensitive" as const },
  });
  const rows = await prisma.contact.findMany({
    where: {
      ...scope,
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(text
        ? { OR: [contains("name"), contains("email"), contains("organization"), contains("notes")] }
        : {}),
    },
    include: contactInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return rows.map(toContact);
}

export const contactPhotoPath = (email: string) =>
  `/api/contacts/photo?email=${encodeURIComponent(email)}`;

/** Adds `photoUrl` to the contacts whose email has a stored photo of this user's. */
export async function withContactPhotos<T extends Contact>(
  prisma: Pick<PrismaClient, "contactPhoto">,
  actor: Scope,
  contacts: T[],
): Promise<T[]> {
  const emails = [...new Set(contacts.flatMap((c) => (c.email ? [c.email.toLowerCase()] : [])))];
  if (emails.length === 0) return contacts;
  const rows = await prisma.contactPhoto.findMany({
    where: { ...ownerOf(actor), email: { in: emails } },
    select: { email: true },
  });
  const have = new Set(rows.map((row) => row.email));
  return contacts.map((c) =>
    c.email && have.has(c.email.toLowerCase())
      ? { ...c, photoUrl: contactPhotoPath(c.email.toLowerCase()) }
      : c,
  );
}

/**
 * Updates the contact with `id`, keeping omitted fields; without `id`, creates one. Pipeline fields
 * go to the contact's record through `savePipelineRecord`. A contact left as kind prospect always
 * has a record; one whose kind leaves prospect leaves the pipeline, and an empty record goes with it.
 * Throws IsolationError for an `id` that is not the user's.
 */
async function writeContact(
  prisma: WriteDb,
  actor: Scope,
  input: ContactSaveInput,
  botId?: string | null,
): Promise<Contact> {
  const scope = ownerOf(actor);
  const {
    id,
    roundId: keepRound,
    pipelineRecordId,
    stage,
    checkSizeCents,
    nextStep,
    ...fields
  } = input;
  const changes = {
    ...(stage === undefined ? {} : { stage }),
    ...(checkSizeCents === undefined ? {} : { amountCents: checkSizeCents }),
    ...(nextStep === undefined ? {} : { nextStep }),
  };
  let keptRound: { roundId: string } | undefined;
  if (keepRound && stage === "committed") {
    const own = await prisma.fundraiseRound.findFirst({
      where: { id: keepRound, ...scope },
      select: { id: true },
    });
    if (!own) throw new IsolationError("Round not found");
    keptRound = { roundId: own.id };
  }
  // The contact row is locked first, so portal exchanges and link mints queue behind a change of
  // email or kind and cannot leave a session that outlives it.
  return prisma.$transaction(async (tx) => {
    let contactId: string;
    if (!id) {
      contactId = (await tx.contact.create({ data: { ...scope, ...fields }, select: { id: true } }))
        .id;
      if (pipelineRecordId) await joinRecord(tx, scope, pipelineRecordId, contactId);
    } else {
      contactId = id;
      const [before] = await tx.$queryRaw<{ email: string | null; kind: string }[]>`
        SELECT "email", "kind" FROM "contacts"
        WHERE "id" = ${id} AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
        FOR UPDATE`;
      if (!before) throw new IsolationError("Contact not found");
      // The editing bot is recorded with the change, so a Firewall agent's edit stays untrusted text.
      await tx.contact.update({
        where: { id },
        data: botId ? { ...fields, lastEditedByBotId: botId } : fields,
      });
      const emailChanged = fields.email !== undefined && fields.email !== before.email;
      const leftInvestors =
        before.kind === "investor" && fields.kind !== undefined && fields.kind !== "investor";
      if (emailChanged || leftInvestors) {
        await endPortalAccess(tx, id);
        await tx.contact.update({
          where: { id },
          data: { portalLinkSentAt: null, portalLastSeenAt: null },
        });
      }
      if (leftInvestors) await tx.investorShare.deleteMany({ where: { contactId: id } });
      if (before.kind === "prospect" && fields.kind && fields.kind !== "prospect")
        await leavePipeline(tx, scope, id);
    }
    const row = await tx.contact.findUniqueOrThrow({ where: { id: contactId } });
    const record =
      row.kind === "prospect"
        ? await ensureRecord(tx, scope, row)
        : await recordOfContact(tx, scope, contactId);
    if (record && (Object.keys(changes).length > 0 || keptRound))
      await savePipelineRecord(tx, scope, record.id, { ...changes, ...keptRound });
    return toContact(
      await tx.contact.findUniqueOrThrow({ where: { id: contactId }, include: contactInclude }),
    );
  });
}

/**
 * Takes a contact off its record; a record left with nobody is removed with it. In a firm with other
 * people, one holding the round's active SAFE stays linked, since that SAFE is the firm's commitment
 * and unlinking it would count the firm twice.
 */
async function leavePipeline(
  db: PipelineDb & Pick<PrismaClient, "safe">,
  scope: Scope,
  contactId: string,
) {
  const record = await recordOfContact(db, scope, contactId);
  if (!record) return;
  const others = await db.pipelineRecordPerson.count({
    where: { recordId: record.id, contactId: { not: contactId } },
  });
  if (others > 0) {
    const open = await db.fundraiseRound.findFirst({
      where: { ...scope, closedAt: null },
      select: { id: true, createdAt: true },
    });
    const safes = await db.safe.findMany({ where: { ...scope, contactId } });
    const holds = safes
      .map((safe) => toSafe(safe))
      .some((safe) => isActiveSafe(safe.status) && safeInRecordRound(safe, record.createdAt, open));
    if (holds) return;
  }
  await db.pipelineRecordPerson.deleteMany({ where: { ...scope, contactId } });
  await promoteNextPerson(db, record.id);
  if ((await db.pipelineRecordPerson.count({ where: { recordId: record.id } })) === 0)
    await db.pipelineRecord.deleteMany({ where: { id: record.id, ...scope } });
}

/** One of the user's contacts; IsolationError when it is not theirs. */
export async function getContact(prisma: Db, actor: Scope, id: string): Promise<Contact> {
  const row = await prisma.contact.findFirst({
    where: { id, ...ownerOf(actor) },
    include: contactInclude,
  });
  if (!row) throw new IsolationError("Contact not found");
  return toContact(row);
}

/**
 * The contact and what is stored against it. Mail and meetings match the contact's email address
 * (sender or recipient; attendee); documents (shared from the Data room) and SAFEs match its id.
 * Every query is scoped to the user's space and user; IsolationError when the contact is not theirs.
 */
export async function contactDetail(
  prisma: PrismaClient,
  actor: Scope,
  id: string,
): Promise<ContactDetail> {
  const scope = ownerOf(actor);
  const contact = await getContact(prisma, scope, id);
  const email = contact.email?.toLowerCase();
  const limit = CONTACT_DETAIL_LIMIT;
  const [messageIds, meetings, shares, safes] = await Promise.all([
    email
      ? prisma.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM (
            SELECT DISTINCT ON ("threadId") "id", "receivedAt" FROM "mail_messages"
            WHERE "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId} AND NOT "isSpam"
              AND (lower("fromAddress") = ${email}
                OR EXISTS (SELECT 1 FROM unnest("toAddresses" || "ccAddresses") AS a WHERE lower(a) = ${email}))
            ORDER BY "threadId", "receivedAt" DESC
          ) AS newest ORDER BY "receivedAt" DESC LIMIT ${limit}`
      : [],
    email ? listMeetings(prisma, scope, { attendeeEmail: email, limit }) : [],
    prisma.investorShare.findMany({
      where: { ...scope, contactId: id },
      select: { dataRoomItem: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.safe.findMany({
      where: { ...scope, contactId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);
  const messages = await prisma.cachedMailMessage.findMany({
    where: { ...scope, id: { in: messageIds.map((row) => row.id) } },
  });
  const byId = new Map(messages.map((message) => [message.id, message]));
  return {
    contact,
    mail: messageIds.flatMap(({ id: messageId }) => {
      const m = byId.get(messageId);
      return m
        ? [
            {
              id: m.id,
              subject: m.subject,
              from: m.fromName || m.fromAddress,
              snippet: m.snippet,
              receivedAt: m.receivedAt.toISOString(),
            },
          ]
        : [];
    }),
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      startedAt: m.startedAt.toISOString(),
    })),
    documents: shares.map((share) => share.dataRoomItem),
    safes: safes.map((row) => {
      const safe = toSafe(row);
      return { id: safe.id, amountCents: safe.amountCents, status: safe.status };
    }),
  };
}

/** What deleting the contact removes besides its own fields; later slices add their links here. */
export async function linkedContact(
  prisma: Pick<PrismaClient, "contact">,
  actor: Scope,
  id: string,
): Promise<ContactLinked> {
  const row = await prisma.contact.findFirst({
    where: { id, ...ownerOf(actor) },
    select: {
      portalBlockedAt: true,
      _count: { select: { portalTokens: true, portalSessions: true, safes: true } },
      shares: { select: { dataRoomItem: { select: { name: true } } } },
    },
  });
  if (!row) throw new IsolationError("Contact not found");
  return {
    // A revoked investor counts: deleting the contact also removes the record of the block.
    portal: row._count.portalTokens + row._count.portalSessions > 0 || row.portalBlockedAt != null,
    documents: row.shares.map((share) => share.dataRoomItem.name).sort(),
    safes: row._count.safes,
  };
}

export async function deleteContact(prisma: WriteDb, actor: Scope, id: string): Promise<void> {
  const scope = ownerOf(actor);
  // A detached Mercury SAFE counts in no round (the foreign key clears contactId only).
  const count = await prisma.$transaction(async (tx) => {
    const record = await recordOfContact(tx, scope, id);
    // The record stays. A native SAFE of its round goes on counting by itself, so the commitment
    // leaves the round rather than count twice; a Mercury SAFE counts nowhere once detached.
    const safes = await tx.safe.findMany({ where: { ...scope, contactId: id, source: "native" } });
    if (
      record?.roundId &&
      safes
        .map((safe) => toSafe(safe))
        .some((safe) => isActiveSafe(safe.status) && safe.roundId === record.roundId)
    )
      await savePipelineRecord(tx, scope, record.id, { roundId: null });
    await tx.safe.updateMany({
      where: { ...scope, contactId: id, source: "mercury" },
      data: { roundId: null },
    });
    const { count: deleted } = await tx.contact.deleteMany({ where: { id, ...scope } });
    if (record) {
      await promoteNextPerson(tx, record.id);
      // With nobody left there is no one for Mercury's SAFE to attach to.
      if ((await tx.pipelineRecordPerson.count({ where: { recordId: record.id } })) === 0)
        await savePipelineRecord(tx, scope, record.id, { waitingSince: null });
    }
    return deleted;
  });
  if (count === 0) throw new IsolationError("Contact not found");
}

/**
 * Who counts as the same contact, unscoped: the email (the schema lowercases it, so it matches
 * exactly) or, without one, the same name and organization, case-insensitive.
 */
export function contactMatchWhere({
  name,
  email,
  organization,
}: {
  name: string;
  email?: string | null;
  organization?: string | null;
}) {
  if (email) return { email };
  // Prisma turns an insensitive equals into ILIKE, so escape its wildcards.
  const insensitive = (value: string) => ({
    equals: value.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive" as const,
  });
  return {
    name: insensitive(name),
    organization: organization ? insensitive(organization) : null,
  };
}

/**
 * Saves a contact without ever changing an existing one: a contact with the same email
 * or, without an email, the same name and organization (case-insensitive) is returned as is.
 * Safe for unattended callers. `botId` is the agent adding it, set by the caller, never from model input.
 */
export async function addContactIfNew(
  prisma: WriteDb,
  actor: Scope,
  input: Omit<ContactSaveInput, "id">,
  botId: string | null = null,
): Promise<{ contact: Contact; created: boolean }> {
  const scope = ownerOf(actor);
  const name = input.name.trim();
  const organization = input.organization?.trim() || null;
  const where = { ...scope, ...contactMatchWhere({ name, email: input.email, organization }) };
  const existing = await prisma.contact.findFirst({
    where,
    orderBy: { id: "asc" },
    include: contactInclude,
  });
  if (existing) return { contact: toContact(existing), created: false };
  // ponytail: only email is unique, so concurrent no-email adds can both insert a duplicate row;
  // upgrade to a unique index on lower(name) plus organization, or an advisory lock.
  // Saved as is, so this route never carries pipeline fields.
  const {
    stage: _s,
    checkSizeCents: _c,
    nextStep: _n,
    roundId: _r,
    pipelineRecordId: _p,
    ...fields
  } = input;
  const data = { ...scope, ...fields, name, organization, botId };
  try {
    if (input.kind !== "prospect") {
      const row = await prisma.contact.create({ data, include: contactInclude });
      return { contact: toContact(row), created: true };
    }
    // A prospect always has a record, whichever route saved it.
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({ data });
      await ensureRecord(tx, scope, created);
      return tx.contact.findUniqueOrThrow({
        where: { id: created.id },
        include: contactInclude,
      });
    });
    return { contact: toContact(row), created: true };
  } catch (error) {
    // A concurrent run saved the same email first.
    if (isUniqueViolation(error) && input.email) {
      const row = await prisma.contact.findFirst({
        where: { ...scope, email: input.email },
        include: contactInclude,
      });
      if (row) return { contact: toContact(row), created: false };
    }
    throw error;
  }
}

/** Creates or updates a contact. Throws ContactEmailTakenError when another contact has the email. */
export const saveContact = (
  prisma: WriteDb,
  actor: Scope,
  input: ContactSaveInput,
  botId?: string | null,
) =>
  writeContact(prisma, actor, input, botId).catch((error: unknown) => {
    throw isUniqueViolation(error) ? new ContactEmailTakenError() : error;
  });
