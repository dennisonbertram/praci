import type { Safe, SafeMarkInput, SafeSaveInput } from "@rakazo/contracts";
import { isActiveSafe, safeStatus } from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "safe" | "contact" | "fundraiseRound" | "$transaction">;
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
  if (input.contactId) {
    const contact = await db.contact.findFirst({
      where: { id: input.contactId, ...scope },
      select: { id: true },
    });
    if (!contact) throw new IsolationError("Contact not found");
    const existing = await listSafesOf(db, scope, contact.id);
    if (existing.some((safe) => isActiveSafe(safe.status))) throw new SafeActiveError();
  }
  const round = await db.fundraiseRound.findFirst({
    where: { ...scope, closedAt: null },
    select: { id: true, capCents: true },
  });
  const capCents = input.capCents ?? cents(round?.capCents ?? null);
  if (!capCents) throw new SafeCapRequiredError();
  const row = await db.safe.create({
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
}

const listSafesOf = async (db: Pick<PrismaClient, "safe">, scope: Scope, contactId: string) =>
  (await db.safe.findMany({ where: { ...scope, contactId } })).map((row) => toSafe(row));

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
  // Undoing a cancel must not leave the contact with two active SAFEs.
  if (input.action === "cancel" && !at && row.contactId) {
    const others = (await listSafesOf(db, scope, row.contactId)).filter((s) => s.id !== row.id);
    if (others.some((safe) => isActiveSafe(safe.status))) throw new SafeActiveError();
  }
  const flips = Boolean(
    at && row.contactId && (input.action === "signed" || input.action === "funded"),
  );
  await db.$transaction(async (tx) => {
    // A cancel applies only while unpaid, so it cannot race a funding request.
    const { count } = await tx.safe.updateMany({
      where: { id: row.id, ...scope, ...(input.action === "cancel" && at ? { paidAt: null } : {}) },
      data: MARK_FIELDS[input.action](at),
    });
    if (count === 0) throw new SafeStateError("A funded SAFE cannot be canceled.");
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
