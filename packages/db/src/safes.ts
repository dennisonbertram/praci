import type { Safe, SafeMarkInput, SafeSaveInput } from "@rakazo/contracts";
import { isActiveSafe, matchDeposit, safeStatus } from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import type { PipelineDb } from "./pipeline-records.js";
import { FUNDRAISING_PIPELINE, recordOfContact, savePipelineRecord } from "./pipeline-records.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = PipelineDb & Pick<PrismaClient, "safe" | "$transaction">;
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
 * IsolationError for a contact that is not the user's, SafeActiveError when its record already has
 * an active SAFE in that round, and SafeCapRequiredError when there is no cap.
 */
export async function saveSafe(db: Db, actor: Scope, input: SafeSaveInput): Promise<Safe> {
  const scope = ownerOf(actor);
  return db.$transaction(async (tx) => {
    const round = await tx.fundraiseRound.findFirst({
      where: { ...scope, closedAt: null },
      select: { id: true, capCents: true },
    });
    if (input.contactId) {
      const contact = await lockContact(tx, scope, input.contactId);
      if (!contact) throw new IsolationError("Contact not found");
      if (await hasActiveSafe(tx, scope, input.contactId, round?.id ?? null))
        throw new SafeActiveError();
    }
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

/**
 * Row lock on the user's contact, then its record, so overlapping requests for one investor or for
 * two people of one firm run one at a time.
 */
async function lockContact(tx: Prisma.TransactionClient, scope: Scope, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM contacts
    WHERE id = ${id} AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
    FOR UPDATE`;
  await tx.$queryRaw`
    SELECT r.id FROM pipeline_records r
    JOIN pipeline_record_people p ON p."recordId" = r.id
    WHERE p."contactId" = ${id} AND p."spaceId" = ${scope.spaceId} AND p."userId" = ${scope.userId}
      AND p.pipeline = ${FUNDRAISING_PIPELINE}
    FOR UPDATE OF r`;
  return rows[0] ?? null;
}

type SafeDates = {
  [K in "investmentDate" | "signedByOwnerAt" | "signedByInvestorAt" | "paidAt"]:
    | Date
    | string
    | null;
};

/** The earliest date a SAFE itself names: when it really began, whenever a sync first saw it. */
const earliestDate = (safe: SafeDates): number | null => {
  const dates = [safe.investmentDate, safe.signedByOwnerAt, safe.signedByInvestorAt, safe.paidAt];
  const known = dates.flatMap((date) => (date ? [new Date(date).getTime()] : []));
  return known.length > 0 ? Math.min(...known) : null;
};
const DAY_MS = 86_400_000;
/** Mercury's dates can be plain days, so a window opens at the start of its first day. */
const dayOf = (date: Date) => Math.floor(date.getTime() / DAY_MS) * DAY_MS;

/**
 * Whether a Mercury SAFE's own dates fall within a round. One naming no date yet is taken as new.
 * ponytail: a round entered here after its first SAFE was signed leaves that SAFE outside; Assign
 * cannot override it, so add an owner's choice if that turns up.
 */
const fitsRound = (safe: SafeDates, round: { createdAt: Date; closedAt: Date | null }) => {
  const start = earliestDate(safe);
  if (start === null) return true;
  return (
    start >= dayOf(round.createdAt) && (!round.closedAt || start < dayOf(round.closedAt) + DAY_MS)
  );
};

/**
 * Whether a SAFE belongs to a record's round: `round`, or any round when there is none (null). A SAFE
 * with no round belongs only when it began after the record, and a dated Mercury one only when it did
 * not begin before the round either, so an old SAFE never stands in for a current commitment.
 */
export const safeInRecordRound = (
  safe: Pick<Safe, "source" | "roundId" | "createdAt"> & SafeDates,
  recordCreatedAt: Date,
  round: { id: string; createdAt: Date } | null,
) => {
  if (safe.roundId) return !round || safe.roundId === round.id;
  const start = safe.source === "mercury" ? earliestDate(safe) : null;
  if (start === null) return new Date(safe.createdAt).getTime() >= recordCreatedAt.getTime();
  return start >= dayOf(recordCreatedAt) && (!round || start >= dayOf(round.createdAt));
};

/**
 * Whether the contact's record has an active SAFE in this round, through any of its people. A contact
 * on no record has one when any of its own SAFEs is active, in any round.
 */
export async function hasActiveSafe(
  db: Pick<Prisma.TransactionClient, "safe" | "pipelineRecordPerson" | "fundraiseRound">,
  scope: Scope,
  contactId: string,
  roundId: string | null,
  exceptSafeId?: string,
): Promise<boolean> {
  const own = await db.pipelineRecordPerson.findFirst({
    where: { ...scope, pipeline: FUNDRAISING_PIPELINE, contactId },
    select: { recordId: true, record: { select: { createdAt: true } } },
  });
  const people = own
    ? await db.pipelineRecordPerson.findMany({
        where: { ...scope, recordId: own.recordId },
        select: { contactId: true },
      })
    : [{ contactId }];
  const rows = await db.safe.findMany({
    where: { ...scope, contactId: { in: people.map((person) => person.contactId) } },
  });
  const round =
    own && roundId
      ? await db.fundraiseRound.findFirst({
          where: { id: roundId, ...scope },
          select: { id: true, createdAt: true },
        })
      : null;
  return rows
    .filter((row) => row.id !== exceptSafeId)
    .map((row) => toSafe(row))
    .some(
      (safe) =>
        isActiveSafe(safe.status) &&
        safeInRecordRound(safe, own?.record.createdAt ?? new Date(0), round),
    );
}

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
    // Undoing a cancel must not leave the record with two active SAFEs in one round.
    if (input.action === "cancel" && !at && row.contactId) {
      await lockContact(tx, scope, row.contactId);
      if (await hasActiveSafe(tx, scope, row.contactId, row.roundId, row.id))
        throw new SafeActiveError();
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
 * to the person on a fundraising record whose email equals the investor's (case and surrounding spaces
 * ignored), takes that record's round when its dates fall within it, and ends its Waiting for Mercury. Then each paid, unlinked SAFE gets its Finance
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
            await tx.$queryRaw<
              {
                id: string;
                recordId: string | null;
                roundId: string | null;
                roundCreatedAt: Date | null;
                roundClosedAt: Date | null;
              }[]
            >`
              SELECT c.id, r.id AS "recordId", r."roundId",
                f."createdAt" AS "roundCreatedAt", f."closedAt" AS "roundClosedAt"
              FROM contacts c
              LEFT JOIN pipeline_record_people p
                ON p."contactId" = c.id AND p.pipeline = ${FUNDRAISING_PIPELINE}
              LEFT JOIN pipeline_records r ON r.id = p."recordId"
              LEFT JOIN fundraise_rounds f ON f.id = r."roundId"
              WHERE c."spaceId" = ${scope.spaceId} AND c."userId" = ${scope.userId}
                AND (r.id IS NOT NULL OR c.kind = 'prospect')
                AND lower(btrim(c.email)) = ${fields.investorEmail}
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
          roundId:
            match?.roundId &&
            match.roundCreatedAt &&
            fitsRound(fields, { createdAt: match.roundCreatedAt, closedAt: match.roundClosedAt })
              ? match.roundId
              : null,
        },
      });
      if (match?.recordId)
        await savePipelineRecord(tx, scope, match.recordId, { waitingSince: null });
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
 * Attaches a Mercury SAFE that has no contact to a prospect, an investor or anyone else on a
 * fundraising record of the user, taking that record's round when its dates fall within it, and ending its Waiting for Mercury. Throws
 * IsolationError for a SAFE or contact that is not the user's, SafeStateError for a native SAFE, one
 * that already has a contact, or a contact of another kind on no record.
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
    const record = await recordOfContact(tx, scope, contactId);
    if (!record && full.kind !== "prospect" && full.kind !== "investor")
      throw new SafeStateError("Choose a prospect or an investor.");
    // An investor who signed before records existed has no record; the round stays on the contact.
    const roundId = record ? record.roundId : full.roundId;
    const round = roundId
      ? await tx.fundraiseRound.findFirst({ where: { id: roundId, ...scope } })
      : null;
    const { count } = await tx.safe.updateMany({
      where: { id, ...scope, contactId: null },
      data: { contactId, roundId: round && fitsRound(safe, round) ? round.id : null },
    });
    if (count === 0) throw new SafeStateError("This SAFE already has a contact.");
    if (record) await savePipelineRecord(tx, scope, record.id, { waitingSince: null });
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
