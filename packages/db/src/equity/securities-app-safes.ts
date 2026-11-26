import type { EquityAppSafeList, EquityConvertible } from "@rakazo/contracts";
import { EquityAppSafeAddInputSchema, EquityAppSafeListInputSchema } from "@rakazo/contracts";
import { Prisma } from "../client.js";
import { toSafe } from "../safes.js";
import { mapFundraisingSafeTerms } from "./fundraising-safe-terms.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  contains,
  EquityInputError,
  ensureLedger,
  inTransaction,
  lockEquityLedger,
  notFound,
  scopeOf,
} from "./ledger.js";
import { createEquityConvertible, getEquityConvertible } from "./securities.js";
import { createEquityStakeholder } from "./stakeholders.js";

const normalizedEmail = (email: string | null | undefined) => email?.trim().toLowerCase() || null;

/**
 * Reads the app's Fundraising SAFEs (`Safe` rows) into the cap table without copying them: the
 * rows stay owned by Fundraising and this projection is computed on each read.
 *
 * A ledger convertible that records a Fundraising SAFE carries its id in `sourceSafeId`; those
 * SAFEs are left out here, so they never show twice.
 */

/** Funded Fundraising SAFEs of the actor, newest investment first, optionally filtered by name. */
export async function listEquityAppSafes(
  prisma: EquityDb,
  actor: EquityScope,
  raw: unknown,
): Promise<EquityAppSafeList> {
  const input = EquityAppSafeListInputSchema.parse(raw);
  const linked = await prisma.equityConvertible.findMany({
    where: { ...scopeOf(actor), sourceSafeId: { not: null } },
    select: { sourceSafeId: true },
  });
  const rows = await prisma.safe.findMany({
    where: {
      ...scopeOf(actor),
      investorName: contains(input.search),
      id: { notIn: linked.map((row) => row.sourceSafeId!) },
    },
    orderBy: [{ investmentDate: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  });
  return rows
    .filter((row) => toSafe(row).status === "funded")
    .map((row) => ({
      id: row.id,
      investorName: row.investorName,
      investorEmail: row.investorEmail,
      ...mapFundraisingSafeTerms(row),
    }));
}

/**
 * Records a Fundraising SAFE in the ledger: the investor becomes a stakeholder (or an existing
 * one with the same name is used) and the SAFE a convertible linked back with `sourceSafeId`.
 */
export async function addEquityAppSafeToLedger(
  prisma: EquityDb,
  actor: EquityScope,
  raw: unknown,
): Promise<EquityConvertible> {
  const { safeId } = EquityAppSafeAddInputSchema.parse(raw);
  const scope = scopeOf(actor);
  try {
    return await inTransaction(prisma, async (tx) => {
      await ensureLedger(tx, scope);
      await lockEquityLedger(tx, scope);
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "safes"
        WHERE "id" = ${safeId} AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
        FOR UPDATE`;
      if (locked.length !== 1) throw notFound("SAFE");
      const safe = await tx.safe.findFirst({ where: { id: safeId, ...scope } });
      if (!safe) throw notFound("SAFE");
      const already = await tx.equityConvertible.findFirst({
        where: { ...scope, sourceSafeId: safe.id },
        select: { id: true },
      });
      if (already) return getEquityConvertible(tx, scope, already.id);
      if (toSafe(safe).status !== "funded")
        throw new EquityInputError("Only funded SAFEs can be added to the cap table");
      const terms = mapFundraisingSafeTerms(safe);
      const issueDate = terms.issueDate;
      if (issueDate === null)
        throw new EquityInputError(
          "A SAFE must have an investment date to be added to the cap table",
        );

      const namedHolders = await tx.equityStakeholder.findMany({
        where: {
          ...scope,
          mergedIntoId: null,
          name: { equals: safe.investorName, mode: "insensitive" },
        },
        select: { id: true, contactEmail: true },
      });
      const investorEmail = normalizedEmail(safe.investorEmail);
      let stakeholderId: string;
      if (namedHolders.length === 1) {
        const holder = namedHolders[0]!;
        const holderEmail = normalizedEmail(holder.contactEmail);
        if (investorEmail && holderEmail && investorEmail !== holderEmail)
          throw new EquityInputError("SAFE investor email conflicts with the matching stakeholder");
        stakeholderId = holder.id;
      } else if (namedHolders.length > 1) {
        const emailMatches = investorEmail
          ? namedHolders.filter((holder) => normalizedEmail(holder.contactEmail) === investorEmail)
          : [];
        if (emailMatches.length !== 1)
          throw new EquityInputError("Multiple stakeholders match this SAFE investor name");
        stakeholderId = emailMatches[0]!.id;
      } else {
        const holder = await createEquityStakeholder(tx, scope, {
          type: "organization",
          name: safe.investorName,
          ...(investorEmail ? { contactEmail: investorEmail } : {}),
        });
        stakeholderId = holder.id;
      }
      return createEquityConvertible(
        tx,
        scope,
        {
          stakeholderId,
          kind: "safe",
          ...terms,
          issueDate,
        },
        { sourceSafeId: safe.id },
      );
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.equityConvertible.findFirst({
        where: { ...scope, sourceSafeId: safeId },
        select: { id: true },
      });
      if (existing) return getEquityConvertible(prisma, scope, existing.id);
      throw new EquityInputError("A SAFE with this label or source already exists");
    }
    throw error;
  }
}
