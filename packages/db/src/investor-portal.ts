import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });
type Db = Pick<
  PrismaClient,
  | "$transaction"
  | "contact"
  | "dataRoomItem"
  | "investorPortalToken"
  | "investorShare"
  | "investorUpdate"
  | "portalSession"
  | "space"
>;
type Tx = Prisma.TransactionClient;

/** Each link lasts 90 days from the day it was issued; each session 30 days from its creation. */
export const PORTAL_TOKEN_TTL_MS = 90 * 24 * 60 * 60_000;
export const PORTAL_SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

/** Who a portal request acts for: one investor contact, resolved from the session cookie. */
export type PortalPrincipal = Scope & { contactId: string };

/** Raised when a link is requested for a contact whose portal access was revoked. */
export class PortalBlockedError extends Error {
  constructor() {
    super("Portal access was revoked for this contact.");
    this.name = "PortalBlockedError";
  }
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");

type Locked = { kind: string; portalBlockedAt: Date | null; email: string | null };

/** Locks the contact row, so mint, exchange, revoke, unblock and an email change run one at a time. */
async function lockContact(tx: Tx, scope: Scope, contactId: string): Promise<Locked | null> {
  const rows = await tx.$queryRaw<Locked[]>`
    SELECT "kind", "portalBlockedAt", "email" FROM "contacts"
    WHERE "id" = ${contactId} AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

/** Ends every link and session of a contact. The contact row must be locked by the caller. */
export async function endPortalAccess(tx: Tx, contactId: string): Promise<void> {
  await tx.investorPortalToken.deleteMany({ where: { contactId } });
  await tx.portalSession.deleteMany({ where: { contactId } });
}

/**
 * Mints a link token for an investor contact; only its hash is stored. `email` is the address the
 * contact has at that moment, read under the same lock, so a link is only ever sent to the address
 * that was current when it was minted. A contact can hold several live tokens; expired ones go here.
 */
export async function mintPortalTokenFor(
  prisma: Db,
  actor: Scope,
  contactId: string,
  now = new Date(),
): Promise<{ token: string; email: string | null }> {
  const scope = ownerOf(actor);
  return prisma.$transaction(async (tx) => {
    const contact = await lockContact(tx, scope, contactId);
    if (contact?.kind !== "investor") throw new IsolationError("Contact not found");
    if (contact.portalBlockedAt) throw new PortalBlockedError();
    await tx.investorPortalToken.deleteMany({ where: { contactId, expiresAt: { lte: now } } });
    const token = randomToken();
    await tx.investorPortalToken.create({
      data: {
        ...scope,
        contactId,
        tokenHash: sha256(token),
        expiresAt: new Date(now.getTime() + PORTAL_TOKEN_TTL_MS),
      },
    });
    await tx.contact.update({ where: { id: contactId }, data: { portalLinkSentAt: now } });
    return { token, email: contact.email };
  });
}

export async function mintPortalToken(
  prisma: Db,
  actor: Scope,
  contactId: string,
  now = new Date(),
): Promise<string> {
  return (await mintPortalTokenFor(prisma, actor, contactId, now)).token;
}

/**
 * The Open button: checks the link under the contact lock, then starts a session. Null for an
 * unknown, expired or revoked link and for a blocked contact.
 */
export async function exchangePortalToken(
  prisma: Db,
  token: string,
  now = new Date(),
): Promise<{ session: string; principal: PortalPrincipal } | null> {
  const tokenHash = sha256(token);
  const found = await prisma.investorPortalToken.findUnique({ where: { tokenHash } });
  if (!found || found.expiresAt <= now) return null;
  const principal = { spaceId: found.spaceId, userId: found.userId, contactId: found.contactId };
  return prisma.$transaction(async (tx) => {
    const contact = await lockContact(tx, principal, principal.contactId);
    if (contact?.kind !== "investor" || contact.portalBlockedAt) return null;
    // Revoke and an email change delete the token under the same lock, so this sees it gone.
    const still = await tx.investorPortalToken.findUnique({ where: { tokenHash } });
    if (!still || still.expiresAt <= now) return null;
    const session = randomToken();
    await tx.portalSession.create({
      data: {
        ...ownerOf(principal),
        contactId: principal.contactId,
        tokenHash: sha256(session),
        expiresAt: new Date(now.getTime() + PORTAL_SESSION_TTL_MS),
      },
    });
    await tx.contact.update({
      where: { id: principal.contactId },
      data: { portalLastSeenAt: now },
    });
    return { session, principal };
  });
}

/** The principal for a session cookie, or null when it is unknown, expired, or its contact is blocked. */
export async function resolvePortalSession(
  prisma: Db,
  session: string,
  now = new Date(),
): Promise<PortalPrincipal | null> {
  const row = await prisma.portalSession.findUnique({
    where: { tokenHash: sha256(session) },
    include: { contact: { select: { kind: true, portalBlockedAt: true } } },
  });
  if (!row || row.expiresAt <= now) return null;
  if (row.contact.kind !== "investor" || row.contact.portalBlockedAt) return null;
  return { spaceId: row.spaceId, userId: row.userId, contactId: row.contactId };
}

export async function endPortalSession(prisma: Db, session: string): Promise<void> {
  await prisma.portalSession.deleteMany({ where: { tokenHash: sha256(session) } });
}

/** Revoke: every link and session ends and the contact is blocked until Unblock. */
export async function revokePortal(
  prisma: Db,
  actor: Scope,
  contactId: string,
  now = new Date(),
): Promise<void> {
  const scope = ownerOf(actor);
  await prisma.$transaction(async (tx) => {
    if (!(await lockContact(tx, scope, contactId))) throw new IsolationError("Contact not found");
    await endPortalAccess(tx, contactId);
    await tx.contact.update({ where: { id: contactId }, data: { portalBlockedAt: now } });
  });
}

/** Unblock clears the block and restores nothing: a new link has to be sent. */
export async function unblockPortal(prisma: Db, actor: Scope, contactId: string): Promise<void> {
  const scope = ownerOf(actor);
  await prisma.$transaction(async (tx) => {
    if (!(await lockContact(tx, scope, contactId))) throw new IsolationError("Contact not found");
    await endPortalAccess(tx, contactId);
    // No link is outstanding any more; the column then reads "Unblocked" until one goes out.
    await tx.contact.update({
      where: { id: contactId },
      data: { portalBlockedAt: null, portalLinkSentAt: null },
    });
  });
}

/** The contact's identity for the portal, when it may still use it. */
async function activeContact(prisma: Db, principal: PortalPrincipal) {
  return prisma.contact.findFirst({
    where: {
      id: principal.contactId,
      ...ownerOf(principal),
      kind: "investor",
      portalBlockedAt: null,
    },
    select: { id: true, name: true },
  });
}

/** The company and contact names the portal home shows. */
export async function portalIdentity(prisma: Db, principal: PortalPrincipal) {
  const contact = await activeContact(prisma, principal);
  if (!contact) return null;
  const space = await prisma.space.findUnique({
    where: { id: principal.spaceId },
    select: { name: true },
  });
  return { company: space?.name ?? "", name: contact.name };
}

/** Every sent or posted investors update of the contact's owner, newest first. */
export async function listPortalUpdates(prisma: Db, principal: PortalPrincipal) {
  if (!(await activeContact(prisma, principal))) return [];
  const rows = await prisma.investorUpdate.findMany({
    where: { ...ownerOf(principal), audience: "investors", status: { in: ["sent", "posted"] } },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, subject: true, body: true, sentAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    sentAt: row.sentAt?.toISOString() ?? null,
  }));
}

const sharedWhere = (principal: PortalPrincipal) => ({
  contactId: principal.contactId,
  ...ownerOf(principal),
  dataRoomItem: { ...ownerOf(principal), storageKey: { not: null } },
});

/** The Data room documents shared with this contact. */
export async function listPortalDocuments(prisma: Db, principal: PortalPrincipal) {
  if (!(await activeContact(prisma, principal))) return [];
  const rows = await prisma.investorShare.findMany({
    where: sharedWhere(principal),
    include: { dataRoomItem: { select: { id: true, name: true, size: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.dataRoomItem.id,
    name: row.dataRoomItem.name,
    size: Number(row.dataRoomItem.size),
  }));
}

/** A shared document's storage details; null unless this contact has a share row for it. */
export async function getSharedDocument(prisma: Db, principal: PortalPrincipal, itemId: string) {
  if (!(await activeContact(prisma, principal))) return null;
  const row = await prisma.investorShare.findFirst({
    where: { ...sharedWhere(principal), dataRoomItemId: itemId },
    include: {
      dataRoomItem: { select: { name: true, mimeType: true, size: true, storageKey: true } },
    },
  });
  const item = row?.dataRoomItem;
  if (!item?.storageKey) return null;
  return {
    name: item.name,
    mimeType: item.mimeType,
    size: Number(item.size),
    storageKey: item.storageKey,
  };
}

/** Shares a Data room document with investor contacts and returns the ones newly given it. */
export async function shareDocument(
  prisma: Db,
  actor: Scope,
  itemId: string,
  contactIds: readonly string[],
): Promise<string[]> {
  const scope = ownerOf(actor);
  const item = await prisma.dataRoomItem.findFirst({
    where: { id: itemId, ...scope, storageKey: { not: null } },
    select: { id: true },
  });
  if (!item) throw new IsolationError("Document not found");
  // The contacts are locked while the shares are written, so a kind change that removes shares
  // cannot be undone by a share that was checked just before it.
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "contacts"
      WHERE "id" = ANY(${[...contactIds]}) AND "spaceId" = ${scope.spaceId}
        AND "userId" = ${scope.userId} AND "kind" = 'investor'
      ORDER BY "id" FOR UPDATE`;
    const wanted = locked.map((c) => c.id);
    const existing = await tx.investorShare.findMany({
      where: { dataRoomItemId: itemId, ...scope, contactId: { in: wanted } },
      select: { contactId: true },
    });
    const had = new Set(existing.map((s) => s.contactId));
    const added = wanted.filter((id) => !had.has(id));
    await tx.investorShare.createMany({
      data: added.map((contactId) => ({ ...scope, contactId, dataRoomItemId: itemId })),
      skipDuplicates: true,
    });
    return added;
  });
}

export async function unshareDocument(
  prisma: Db,
  actor: Scope,
  itemId: string,
  contactId: string,
): Promise<void> {
  await prisma.investorShare.deleteMany({
    where: { dataRoomItemId: itemId, contactId, ...ownerOf(actor) },
  });
}

/** The investor contacts a document is shared with. */
export async function listShareContactIds(
  prisma: Db,
  actor: Scope,
  itemId: string,
): Promise<string[]> {
  const rows = await prisma.investorShare.findMany({
    where: { dataRoomItemId: itemId, ...ownerOf(actor) },
    select: { contactId: true },
  });
  return rows.map((r) => r.contactId);
}

/** Who a Post to portal notice goes to: investor contacts with an email who are not revoked. */
export function portalNoticeRecipients(prisma: Pick<PrismaClient, "contact">, actor: Scope) {
  return prisma.contact.findMany({
    where: { ...ownerOf(actor), kind: "investor", email: { not: null }, portalBlockedAt: null },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  }) as Promise<{ id: string; name: string; email: string }[]>;
}
