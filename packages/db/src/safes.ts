import type { Safe, SafeMarkInput, SafeSaveInput } from "@rakazo/contracts";
import { isActiveSafe, matchDeposit, safeStatus } from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "safe" | "contact" | "fundraiseRound" | "$transaction">;
type SyncDb = Db & Pick<PrismaClient, "financeTransaction">;
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });

/** The contact already has a Draft, Sent, Signed or Funded SAFE. */
export class SafeActiveError extends Error {
  constructor() {
    super("This investor already has a SAFE.");
    this.name = "SafeActiveError";
  }
}

/** A native SAFE needs a cap, from the open round or typed in. */
export class SafeCapRequiredError extends Error {
  constructor() {
    super("Enter a post-money cap.");
    this.name = "SafeCapRequiredError";
  }
}

/** A Mercury SAFE is a read-only cache of Mercury's record, and a Funded SAFE cannot be canceled. */
export class SafeStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeStateError";
  }
}

const iso = (date: Date | null) => date?.toISOString() ?? null;
const cents = (value: bigint | null) => (value == null ? null : Number(value));

export function toSafe(row: Prisma.SafeGetPayload<object>, now = new Date()): Safe {
  const source = row.source === "mercury" ? "mercury" : "native";
  const facts = {
    source,
    amountCents: Number(row.amountCents),
    capCents: cents(row.capCents),
    sentAt: row.sentAt,
    signedByOwnerAt: row.signedByOwnerAt,
    signedByInvestorAt: row.signedByInvestorAt,
    paidAt: row.paidAt,
    expiresAt: row.expiresAt,
    canceledAt: row.canceledAt,
  } as const;
  return {
    id: row.id,
    source,
    contactId: row.contactId,
    roundId: row.roundId,
    investorName: row.investorName,
    investorEmail: row.investorEmail,
    amountCents: facts.amountCents,
    valuationType: row.valuationType,
    capCents: facts.capCents,
    discountPercent: row.discountPercent,
    mfn: row.mfn,
    proRata: row.proRata,
    governingState: row.governingState,
    investmentDate: iso(row.investmentDate),
    expiresAt: iso(row.expiresAt),
    canceledAt: iso(row.canceledAt),
    sentAt: iso(row.sentAt),
    signedByOwnerAt: iso(row.signedByOwnerAt),
    signedByInvestorAt: iso(row.signedByInvestorAt),
    paidAt: iso(row.paidAt),
    documentUrl: row.documentUrl,
    financeTransactionId: row.financeTransactionId,
    status: safeStatus(facts, now),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every SAFE of the user, newest first. */
export async function listSafes(prisma: Pick<PrismaClient, "safe">, actor: Scope): Promise<Safe[]> {
  const rows = await prisma.safe.findMany({
    where: ownerOf(actor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map((row) => toSafe(row));
}

/**
 * Adds a native Draft: the YC post-money cap form, in the open round when there is one. Throws
 * IsolationError for a contact that is not the user's, SafeActiveError when the contact already
 * has an active SAFE, and SafeCapRequiredError when there is no cap.
 */
export async function saveSafe(db: Db, actor: Scope, input: SafeSaveInput): Promise<Safe> {
  const scope = ownerOf(actor);
  return db.$transaction(async (tx) => {
    if (input.contactId) {
      const contact = await lockContact(tx, scope, input.contactId);
      if (!contact) throw new IsolationError("Contact not found");
      const existing = await listSafesOf(tx, scope, input.contactId);
      if (existing.some((safe) => isActiveSafe(safe.status))) throw new SafeActiveError();
    }
    const round = await tx.fundraiseRound.findFirst({
      where: { ...scope, closedAt: null },
      select: { id: true, capCents: true },
    });
    const capCents = input.capCents ?? cents(round?.capCents ?? null);
    if (!capCents) throw new SafeCapRequiredError();
    const row = await tx.safe.create({
      data: {
        ...scope,
        source: "native",
        contactId: input.contactId ?? null,
        roundId: round?.id ?? null,
        investorName: input.investorName,
        investorEmail: input.investorEmail ?? null,
        amountCents: input.amountCents,
        capCents,
        proRata: input.proRata,
        governingState: input.governingState || null,
        investmentDate: input.investmentDate ? new Date(input.investmentDate) : null,
      },
    });
    return toSafe(row);
  });
}

/** Row lock on the user's contact, so overlapping requests for one investor run one at a time. */
async function lockContact(tx: Prisma.TransactionClient, scope: Scope, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM contacts
    WHERE id = ${id} AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

const listSafesOf = async (
  db: Pick<Prisma.TransactionClient, "safe">,
  scope: Scope,
  contactId: string,
) => (await db.safe.findMany({ where: { ...scope, contactId } })).map((row) => toSafe(row));

const MARK_FIELDS = {
  sent: (at: Date | null) => ({ sentAt: at }),
  signed: (at: Date | null) => ({ signedByOwnerAt: at, signedByInvestorAt: at }),
  funded: (at: Date | null) => ({ paidAt: at }),
  cancel: (at: Date | null) => ({ canceledAt: at }),
};

/**
 * Records a step on a native SAFE (`at: null` clears it, for Undo). Signed or Funded turns a
 * prospect contact into an investor; board, auditor and other contacts keep their kind, and
 * clearing the date does not turn the contact back. Throws IsolationError for another user's
 * SAFE and SafeStateError for a Mercury SAFE or a Funded SAFE being canceled.
 */
export async function markSafe(db: Db, actor: Scope, input: SafeMarkInput): Promise<Safe> {
  const scope = ownerOf(actor);
  const row = await db.safe.findFirst({ where: { id: input.id, ...scope } });
  if (!row) throw new IsolationError("SAFE not found");
  if (row.source !== "native") throw new SafeStateError("A Mercury SAFE is changed in Mercury.");
  const at = input.at ? new Date(input.at) : null;
  if (input.action === "cancel" && at && row.paidAt)
    throw new SafeStateError("A funded SAFE cannot be canceled.");
  if (input.action === "funded" && at && row.canceledAt)
    throw new SafeStateError("A canceled SAFE cannot be funded.");
  const flips = Boolean(
    at && row.contactId && (input.action === "signed" || input.action === "funded"),
  );
  await db.$transaction(async (tx) => {
    // Undoing a cancel must not leave the contact with two active SAFEs.
    if (input.action === "cancel" && !at && row.contactId) {
      await lockContact(tx, scope, row.contactId);
      const others = (await listSafesOf(tx, scope, row.contactId)).filter((s) => s.id !== row.id);
      if (others.some((safe) => isActiveSafe(safe.status))) throw new SafeActiveError();
    }
    // Cancel applies only while unpaid and funding only while not canceled, so neither races the other.
    const guard =
      input.action === "cancel" && at
        ? { paidAt: null }
        : input.action === "funded" && at
          ? { canceledAt: null }
          : {};
    const { count } = await tx.safe.updateMany({
      where: { id: row.id, ...scope, ...guard },
      data: MARK_FIELDS[input.action](at),
    });
    if (count === 0)
      throw new SafeStateError(
        input.action === "funded"
          ? "A canceled SAFE cannot be funded."
          : "A funded SAFE cannot be canceled.",
      );
    if (flips)
      await tx.contact.updateMany({
        where: { id: row.contactId as string, ...scope, kind: "prospect" },
        data: { kind: "investor" },
      });
  });
  return toSafe(await db.safe.findFirstOrThrow({ where: { id: row.id, ...scope } }));
}

/** Deletes a native SAFE. Throws IsolationError for another user's SAFE, SafeStateError for a Mercury one. */
export async function deleteSafe(db: Pick<PrismaClient, "safe">, actor: Scope, id: string) {
  const scope = ownerOf(actor);
  const row = await db.safe.findFirst({ where: { id, ...scope }, select: { source: true } });
  if (!row) throw new IsolationError("SAFE not found");
  if (row.source !== "native") throw new SafeStateError("A Mercury SAFE is changed in Mercury.");
  await db.safe.deleteMany({ where: { id, ...scope } });
}

/** One Mercury SAFE request as the sync maps it. Dates are already parsed; money is whole cents. */
export type MercurySafeInput = {
  externalId: string;
  investorName: string;
  /** Trimmed and lower-cased. */
  investorEmail: string | null;
  amountCents: number;
  valuationType: string;
  capCents: number | null;
  discountPercent: number | null;
  mfn: boolean;
  proRata: boolean;
  governingState: string | null;
  investmentDate: Date | null;
  expiresAt: Date | null;
  canceledAt: Date | null;
  signedByOwnerAt: Date | null;
  signedByInvestorAt: Date | null;
  paidAt: Date | null;
  documentUrl: string | null;
};

/**
 * Writes Mercury's SAFEs as read-only cache rows, owned by the user. A known row (by source and
 * externalId) has its Mercury fields overwritten and keeps its contact and round. A new row attaches
 * to the prospect whose email equals the investor's (case and surrounding spaces ignored), takes that
 * prospect's round and ends its Waiting for Mercury. Then each paid, unlinked SAFE gets its Finance
 * deposit when exactly one transaction fits.
 */
export const syncMercurySafes = (db: SyncDb, actor: Scope, rows: readonly MercurySafeInput[]) =>
  db.$transaction((tx) => writeMercurySafes(tx, actor, rows));

/** The writes of `syncMercurySafes`, for a caller that already holds a transaction. */
export async function writeMercurySafes(
  tx: Prisma.TransactionClient,
  actor: Scope,
  rows: readonly MercurySafeInput[],
): Promise<void> {
  const scope = ownerOf(actor);
  {
    for (const { externalId, ...fields } of rows) {
      const existing = await tx.safe.findFirst({
        where: { ...scope, source: "mercury", externalId },
        select: { id: true },
      });
      const data = {
        ...fields,
        amountCents: BigInt(fields.amountCents),
        capCents: fields.capCents == null ? null : BigInt(fields.capCents),
      };
      if (existing) {
        await tx.safe.updateMany({ where: { id: existing.id, ...scope }, data });
        continue;
      }
      const match = fields.investorEmail
        ? (
            await tx.$queryRaw<{ id: string; roundId: string | null }[]>`
              SELECT id, "roundId" FROM contacts
              WHERE "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
                AND kind = 'prospect' AND lower(btrim(email)) = ${fields.investorEmail}
              LIMIT 1`
          )[0]
        : undefined;
      await tx.safe.create({
        data: {
          ...scope,
          ...data,
          source: "mercury",
          externalId,
          contactId: match?.id ?? null,
          roundId: match?.roundId ?? null,
        },
      });
      if (match)
        await tx.contact.updateMany({
          where: { id: match.id, ...scope },
          data: { mercurySentAt: null },
        });
    }
    // A prospect whose Mercury SAFE is signed or paid is an investor, and stays one.
    const attached = await tx.safe.findMany({
      where: { ...scope, source: "mercury", contactId: { not: null } },
    });
    const signedContacts = attached.flatMap((row) => {
      const status = toSafe(row).status;
      return row.contactId && (status === "signed" || status === "funded") ? [row.contactId] : [];
    });
    if (signedContacts.length)
      await tx.contact.updateMany({
        where: { ...scope, id: { in: signedContacts }, kind: "prospect" },
        data: { kind: "investor" },
      });
    const paid = await tx.safe.findMany({
      where: { ...scope, source: "mercury", paidAt: { not: null }, financeTransactionId: null },
    });
    for (const safe of paid) {
      const candidates = await tx.financeTransaction.findMany({
        where: {
          ...scope,
          classification: "financing",
          currency: "USD",
          amountCents: safe.amountCents,
        },
        include: { safe: { select: { id: true } } },
      });
      const id = matchDeposit(
        { amountCents: Number(safe.amountCents), paidAt: safe.paidAt },
        candidates.map((c) => ({
          id: c.id,
          amountCents: Number(c.amountCents),
          currency: c.currency,
          classification: c.classification,
          postedAt: c.postedAt,
          linkedSafeId: c.safe?.id ?? null,
        })),
      );
      if (id)
        await tx.safe.updateMany({
          where: { id: safe.id, ...scope },
          data: { financeTransactionId: id },
        });
    }
  }
}

/**
 * Attaches a Mercury SAFE that has no contact to a prospect or investor of the user, taking that
 * contact's round and ending its Waiting for Mercury. Throws IsolationError for a SAFE or contact that
 * is not the user's, SafeStateError for a native SAFE, one that already has a contact, or a contact
 * of another kind.
 */
export async function assignSafe(
  db: Db,
  actor: Scope,
  id: string,
  contactId: string,
): Promise<Safe> {
  const scope = ownerOf(actor);
  await db.$transaction(async (tx) => {
    const safe = await tx.safe.findFirst({ where: { id, ...scope } });
    if (!safe) throw new IsolationError("SAFE not found");
    if (safe.source !== "mercury") throw new SafeStateError("Only a Mercury SAFE is assigned.");
    if (safe.contactId) throw new SafeStateError("This SAFE already has a contact.");
    const contact = await lockContact(tx, scope, contactId);
    if (!contact) throw new IsolationError("Contact not found");
    const full = await tx.contact.findFirstOrThrow({ where: { id: contactId, ...scope } });
    if (full.kind !== "prospect" && full.kind !== "investor")
      throw new SafeStateError("Choose a prospect or an investor.");
    const { count } = await tx.safe.updateMany({
      where: { id, ...scope, contactId: null },
      data: { contactId, roundId: full.roundId },
    });
    if (count === 0) throw new SafeStateError("This SAFE already has a contact.");
    await tx.contact.updateMany({
      where: { id: contactId, ...scope },
      data: { mercurySentAt: null },
    });
    const signed = toSafe(await tx.safe.findFirstOrThrow({ where: { id, ...scope } })).status;
    if (signed === "signed" || signed === "funded")
      await tx.contact.updateMany({
        where: { id: contactId, ...scope, kind: "prospect" },
        data: { kind: "investor" },
      });
  });
  return toSafe(await db.safe.findFirstOrThrow({ where: { id, ...scope } }));
}

/**
 * Detaches a Mercury SAFE from its contact, to fix a wrong match. The contact keeps its kind and stage,
 * so a Committed prospect's check size counts again. Throws IsolationError for another user's SAFE and
 * SafeStateError for a native one.
 */
export async function unassignSafe(db: Db, actor: Scope, id: string): Promise<Safe> {
  const scope = ownerOf(actor);
  const row = await db.safe.findFirst({ where: { id, ...scope } });
  if (!row) throw new IsolationError("SAFE not found");
  if (row.source !== "mercury") throw new SafeStateError("Only a Mercury SAFE is unassigned.");
  await db.safe.updateMany({ where: { id, ...scope }, data: { contactId: null, roundId: null } });
  return toSafe(await db.safe.findFirstOrThrow({ where: { id, ...scope } }));
}
