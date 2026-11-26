import type {
  EquityStakeholder,
  EquityStakeholderBulkResult,
  EquityStakeholderDetail,
} from "@rakazo/contracts";
import {
  EquityStakeholderBulkCreateInputSchema,
  EquityStakeholderBulkUpdateInputSchema,
  EquityStakeholderMergeInputSchema,
  EquityStakeholderTerminateInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  EquityConflictError,
  EquityInputError,
  ensureLedger,
  fromDate,
  inTransaction,
  lockEquityLedger,
  lockEquityStakeholders,
  notFound,
  recordTransaction,
  scopeOf,
  toDate,
} from "./ledger.js";
import { terminateEquityOptionGrantsOf } from "./options-termination.js";
import {
  createEquityStakeholder,
  currentProperties,
  getEquityStakeholder,
  toStakeholder,
  updateEquityStakeholder,
} from "./stakeholders.js";

const summary = ({ properties: _properties, ...row }: EquityStakeholderDetail): EquityStakeholder =>
  row;

/** Runs every row in one transaction; the first bad row fails the batch and names its number. */
async function eachRow<T>(rows: T[], run: (row: T) => Promise<EquityStakeholderDetail>) {
  const items: EquityStakeholder[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      items.push(summary(await run(row)));
    } catch (cause) {
      if (cause instanceof EquityInputError || cause instanceof EquityConflictError) {
        const Kind = cause.constructor as new (message: string) => Error;
        throw new Kind(`Row ${index + 1}: ${cause.message}`);
      }
      throw cause;
    }
  }
  return { items };
}

export async function bulkCreateEquityStakeholders(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderBulkCreateInputSchema>,
): Promise<EquityStakeholderBulkResult> {
  const { rows } = EquityStakeholderBulkCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    return eachRow(rows, (row) => createEquityStakeholder(tx, scope, row));
  });
}

export async function bulkUpdateEquityStakeholders(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderBulkUpdateInputSchema>,
): Promise<EquityStakeholderBulkResult> {
  const { rows } = EquityStakeholderBulkUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, (tx) =>
    eachRow(rows, (row) => updateEquityStakeholder(tx, scope, row)),
  );
}

const MERGE_REFUSED =
  "Cannot merge stakeholders with accepted securities that have different portfolio emails.";

type HolderRow = { id: string; parentId: string | null };

/**
 * Children of the merged holder move to the survivor. If the survivor sits under the merged
 * holder (directly or deeper), that one child of the merged holder would become its own
 * ancestor, so it takes the merged holder's parent instead.
 */
async function moveChildren(
  tx: Prisma.TransactionClient,
  scope: EquityScope,
  into: HolderRow,
  from: HolderRow,
) {
  let branch: string | null = null;
  const seen = new Set<string>();
  for (let cursor: HolderRow | null = into; cursor?.parentId && !seen.has(cursor.id); ) {
    seen.add(cursor.id);
    if (cursor.parentId === from.id) {
      branch = cursor.id;
      break;
    }
    cursor = await tx.equityStakeholder.findFirst({
      where: { id: cursor.parentId, ...scope },
      select: { id: true, parentId: true },
    });
  }
  await tx.equityStakeholder.updateMany({
    where: { parentId: from.id, ...scope, ...(branch ? { id: { not: branch } } : {}) },
    data: { parentId: into.id },
  });
  if (branch)
    await tx.equityStakeholder.update({ where: { id: branch }, data: { parentId: from.parentId } });
}

export async function mergeEquityStakeholders(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderMergeInputSchema>,
): Promise<EquityStakeholderDetail> {
  const { intoId, fromId } = EquityStakeholderMergeInputSchema.parse(raw);
  if (intoId === fromId) throw new EquityInputError("Choose two different stakeholders");
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    // Ledger first, then both holders in sorted id order, so opposite merges queue up and the
    // second one sees the first one's mergedIntoId.
    await lockEquityLedger(tx, scope);
    await lockEquityStakeholders(tx, scope, [intoId, fromId]);
    const [into, from] = await Promise.all(
      [intoId, fromId].map((id) => tx.equityStakeholder.findFirst({ where: { id, ...scope } })),
    );
    if (!into || !from) throw notFound("Stakeholder");
    if (into.mergedIntoId || from.mergedIntoId)
      throw new EquityInputError("This stakeholder is already merged");
    if (
      into.portfolioEmailLockedAt &&
      from.portfolioEmailLockedAt &&
      into.portfolioEmail !== from.portfolioEmail
    )
      throw new EquityConflictError(MERGE_REFUSED);
    const effectiveDate = fromDate(new Date());
    const where = { stakeholderId: fromId, ...scope };
    const before = { stakeholderId: fromId };
    const after = { stakeholderId: intoId };
    const [certificates, convertibles, grants, warrants] = await Promise.all([
      tx.equityCertificate.findMany({ where, select: { id: true } }),
      tx.equityConvertible.findMany({ where, select: { id: true } }),
      tx.equityOptionGrant.findMany({ where, select: { id: true } }),
      tx.equityWarrant.findMany({ where, select: { id: true } }),
    ]);
    const note = `Merged ${from.name} into ${into.name}`;
    for (const { id } of certificates)
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate,
        certificateId: id,
        before,
        after,
        note,
      });
    for (const { id } of convertibles)
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate,
        convertibleId: id,
        before,
        after,
        note,
      });
    for (const { id } of grants)
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate,
        optionGrantId: id,
        before,
        after,
        note,
      });
    for (const { id } of warrants)
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate,
        warrantId: id,
        before,
        after,
        note,
      });
    await tx.equityCertificate.updateMany({ where, data: { stakeholderId: intoId } });
    await tx.equityConvertible.updateMany({ where, data: { stakeholderId: intoId } });
    await tx.equityOptionGrant.updateMany({ where, data: { stakeholderId: intoId } });
    await tx.equityWarrant.updateMany({ where, data: { stakeholderId: intoId } });
    await moveChildren(tx, scope, into, from);
    // Documents follow the survivor. An access grant is one per holder: the survivor keeps its
    // own, and the merged holder's is dropped only when the survivor already has one.
    await tx.equityDocumentLink.updateMany({ where, data: { stakeholderId: intoId } });
    const survivorGrant = await tx.equityAccessGrant.findFirst({
      where: { stakeholderId: intoId, ...scope },
      select: { id: true },
    });
    if (survivorGrant) await tx.equityAccessGrant.deleteMany({ where });
    else await tx.equityAccessGrant.updateMany({ where, data: { stakeholderId: intoId } });
    // Dated properties move only for kinds the survivor has no history of: its own values stay
    // current, and a merged holder's older or newer date cannot override them.
    const kept = await tx.equityStakeholderProperty.findMany({
      where: { stakeholderId: intoId, ...scope },
      select: { kind: true },
      distinct: ["kind"],
    });
    await tx.equityStakeholderProperty.updateMany({
      where: { ...where, kind: { notIn: kept.map((row) => row.kind) } },
      data: { stakeholderId: intoId },
    });
    // The contact link is unique per ledger: release it from the merged holder first.
    const contactId = into.contactId ?? from.contactId;
    if (from.contactId)
      await tx.equityStakeholder.update({ where: { id: fromId }, data: { contactId: null } });
    await tx.equityStakeholder.update({
      where: { id: intoId },
      data: {
        contactId,
        contactEmail: into.contactEmail ?? from.contactEmail,
        portfolioEmail: into.portfolioEmail ?? from.portfolioEmail,
        portfolioEmailLockedAt: into.portfolioEmailLockedAt ?? from.portfolioEmailLockedAt,
        otherEmails: [...new Set([...into.otherEmails, ...from.otherEmails])],
        employeeId: into.employeeId ?? from.employeeId,
        taxId: into.taxId ?? from.taxId,
      },
    });
    await tx.equityStakeholder.update({ where: { id: fromId }, data: { mergedIntoId: intoId } });
  });
  return getEquityStakeholder(prisma, scope, intoId);
}

const EX: Record<string, string> = {
  advisor: "ex_advisor",
  board_member: "ex_board_member",
  consultant: "ex_consultant",
  founder: "ex_founder",
  international_employee: "ex_international_employee",
};

/** The ex- relationship a terminated holder moves to. */
export const exRelationship = (relationship: string) => EX[relationship] ?? "ex_employee";

export async function terminateEquityStakeholders(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityStakeholderTerminateInputSchema>,
): Promise<EquityStakeholderBulkResult> {
  const { ids, terminationDate } = EquityStakeholderTerminateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    const rows = await tx.equityStakeholder.findMany({ where: { id: { in: ids }, ...scope } });
    if (rows.length !== new Set(ids).size) throw notFound("Stakeholder");
    const items: EquityStakeholder[] = [];
    for (const row of rows) {
      if (row.terminatedAt || row.mergedIntoId)
        throw new EquityInputError(`${row.name} is already terminated or merged`);
      if (
        !row.relationship ||
        row.relationship === "investor" ||
        row.relationship.startsWith("ex_")
      )
        throw new EquityInputError(`${row.name} has no working relationship to terminate`);
      await tx.equityStakeholderProperty.create({
        data: {
          ...scope,
          stakeholderId: row.id,
          kind: "relationship",
          effectiveDate: toDate(terminationDate),
          value: exRelationship(row.relationship),
        },
      });
      const all = await tx.equityStakeholderProperty.findMany({
        where: { stakeholderId: row.id, ...scope },
      });
      const updated = await tx.equityStakeholder.update({
        where: { id: row.id },
        data: {
          terminatedAt: toDate(terminationDate),
          ...currentProperties(
            all.map((p) => ({
              kind: p.kind,
              effectiveDate: fromDate(p.effectiveDate),
              value: p.value,
            })),
          ),
        },
      });
      await terminateEquityOptionGrantsOf(tx, scope, row.id, terminationDate);
      items.push(toStakeholder(updated));
    }
    return { items };
  });
}

/** Deletes a custom property definition and drops its value from every stakeholder. */
export async function deleteEquityCustomProperty(
  prisma: EquityDb,
  actor: EquityScope,
  raw: { id: string },
): Promise<{ id: string }> {
  const { id } = raw;
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    const property = await tx.equityCustomProperty.findFirst({ where: { id, ...scope } });
    if (!property) throw notFound("Custom property");
    const holders = await tx.equityStakeholder.findMany({
      where: { ...scope, customValues: { path: [id], not: Prisma.AnyNull } },
      select: { id: true, customValues: true },
    });
    for (const holder of holders) {
      const { [id]: _removed, ...rest } = holder.customValues as Record<string, string>;
      await tx.equityStakeholder.update({ where: { id: holder.id }, data: { customValues: rest } });
    }
    await tx.equityCustomProperty.delete({ where: { id: property.id } });
  });
  return { id };
}
