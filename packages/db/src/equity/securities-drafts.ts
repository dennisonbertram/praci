import type { EquityDraftSetIssueResult, EquityDraftSetReview } from "@rakazo/contracts";
import {
  EquityCertificateCreateInputSchema,
  EquityConvertibleCreateInputSchema,
  EquityDraftSetIssueInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertPostgresBigInt,
  EquityConflictError,
  EquityInputError,
  fromBig,
  inTransaction,
  lockEquityDraftSets,
  lockEquityLedger,
  scopeOf,
  toBig,
} from "./ledger.js";
import { getEquityDraftSet } from "./rounds.js";
import {
  assertEquityCertificateCapacity,
  createEquityCertificate,
  createEquityConvertible,
} from "./securities.js";

async function exists(
  prisma: EquityDb,
  actor: EquityScope,
  model: "equityStakeholder" | "equityShareClass" | "equityConvertibleBlock",
  id: string | null | undefined,
) {
  if (!id) return true;
  const delegate = prisma[model] as unknown as {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  return (
    (await delegate.findFirst({ where: { id, ...scopeOf(actor) }, select: { id: true } })) !== null
  );
}

/** Checks every item of a draft set against the caller's ledger, without writing. */
export async function reviewEquityDraftSet(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityDraftSetIssueInputSchema>,
): Promise<EquityDraftSetReview> {
  const { id, expectedRevision } = EquityDraftSetIssueInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    const set = await getEquityDraftSet(tx, scope, id);
    if (set.revision !== expectedRevision)
      throw new EquityConflictError("Draft set revision is stale");
    let totalShares = 0n;
    let totalPrincipalCents = 0n;
    const items: { index: number; problems: string[] }[] = [];
    const planned = new Map<string, Map<string, { quantity: bigint; indexes: number[] }>>();
    for (const [index, item] of set.items.entries()) {
      const problems: string[] = [];
      if (set.securityKind === "option_grant") problems.push("Option grants are issued from Plans");
      else if (set.securityKind === "certificate") {
        const parsed = EquityCertificateCreateInputSchema.safeParse(item);
        if (!parsed.success) problems.push("Incomplete");
        else {
          totalShares = assertPostgresBigInt(totalShares + toBig(parsed.data.quantity));
          if (!(await exists(tx, scope, "equityStakeholder", parsed.data.stakeholderId)))
            problems.push("Unknown stakeholder");
          const classExists = await exists(tx, scope, "equityShareClass", parsed.data.shareClassId);
          if (!classExists) problems.push("Unknown share class");
          if (parsed.data.planId) {
            const plan = await tx.equityPlan.findFirst({
              where: { id: parsed.data.planId, ...scope },
              select: { shareClassId: true },
            });
            if (!plan) problems.push("Unknown plan");
            else if (plan.shareClassId !== parsed.data.shareClassId)
              problems.push("Plan share class mismatch");
          }
          if (classExists) {
            let byDate = planned.get(parsed.data.shareClassId);
            if (!byDate) {
              byDate = new Map();
              planned.set(parsed.data.shareClassId, byDate);
            }
            const bucket = byDate.get(parsed.data.issueDate) ?? { quantity: 0n, indexes: [] };
            bucket.quantity += toBig(parsed.data.quantity);
            bucket.indexes.push(index);
            byDate.set(parsed.data.issueDate, bucket);
          }
        }
      } else {
        const parsed = EquityConvertibleCreateInputSchema.safeParse(item);
        if (!parsed.success) problems.push("Incomplete");
        else {
          totalPrincipalCents = assertPostgresBigInt(
            totalPrincipalCents + toBig(parsed.data.principalCents),
          );
          if (!(await exists(tx, scope, "equityStakeholder", parsed.data.stakeholderId)))
            problems.push("Unknown stakeholder");
          if (!(await exists(tx, scope, "equityConvertibleBlock", parsed.data.blockId)))
            problems.push("Unknown terms");
        }
      }
      items.push({ index, problems });
    }
    for (const [shareClassId, dates] of planned) {
      let cumulative = 0n;
      const plannedIndexes: number[] = [];
      for (const [effectiveDate, bucket] of [...dates].sort(([a], [b]) => a.localeCompare(b))) {
        cumulative = assertPostgresBigInt(cumulative + bucket.quantity);
        plannedIndexes.push(...bucket.indexes);
        try {
          await assertEquityCertificateCapacity(
            tx,
            scope,
            shareClassId,
            cumulative,
            undefined,
            effectiveDate,
          );
        } catch (error) {
          if (!(error instanceof EquityInputError)) throw error;
          for (const index of plannedIndexes) {
            const row = items.find((item) => item.index === index);
            if (row && !row.problems.includes("Exceeds authorized shares"))
              row.problems.push("Exceeds authorized shares");
          }
        }
      }
    }
    return {
      setId: set.id,
      revision: set.revision,
      items,
      totalShares: fromBig(totalShares),
      totalPrincipalCents: fromBig(totalPrincipalCents),
      ready:
        set.status === "draft" &&
        set.items.length > 0 &&
        items.every((row) => row.problems.length === 0),
    };
  });
}

/**
 * Issues every security of a draft set in one transaction (each create records its own issue
 * transaction), then marks the set issued. A set issues once; any failure issues nothing.
 */
export async function issueEquityDraftSet(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityDraftSetIssueInputSchema>,
): Promise<EquityDraftSetIssueResult> {
  const { id, expectedRevision } = EquityDraftSetIssueInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityDraftSets(tx, scope, [id]);
    const set = await getEquityDraftSet(tx, scope, id);
    if (set.revision !== expectedRevision)
      throw new EquityConflictError("Draft set revision is stale");
    if (set.securityKind === "option_grant")
      throw new EquityConflictError("Option grants are issued from Plans");
    if (set.status === "issued") {
      if (set.issuedIds.length === 0 || set.issuedIds.length !== set.items.length)
        throw new EquityConflictError("This issued draft set cannot be replayed safely");
      return { set, issuedIds: set.issuedIds };
    }
    if (set.status !== "draft") throw new EquityConflictError("Only a draft set can be issued");
    const review = await reviewEquityDraftSet(tx, scope, { id, expectedRevision });
    if (set.items.length === 0) throw new EquityInputError("The draft set is empty");
    const problem = review.items.find((row) => row.problems.length > 0);
    if (problem)
      throw new EquityInputError(`Item ${problem.index + 1}: ${problem.problems.join(", ")}`);
    const issueOrder = set.items.map((item, index) => ({
      item,
      index,
      issueDate:
        set.securityKind === "certificate"
          ? EquityCertificateCreateInputSchema.parse(item).issueDate
          : "",
    }));
    if (set.securityKind === "certificate")
      issueOrder.sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.index - b.index);
    const issuedIds = new Array<string>(set.items.length);
    for (const { item, index } of issueOrder) {
      const created =
        set.securityKind === "certificate"
          ? await createEquityCertificate(
              tx,
              scope,
              item as z.input<typeof EquityCertificateCreateInputSchema>,
            )
          : await createEquityConvertible(
              tx,
              scope,
              item as z.input<typeof EquityConvertibleCreateInputSchema>,
            );
      issuedIds[index] = created.id;
    }
    const updated = await tx.equityDraftSet.updateMany({
      where: { id, ...scope, status: "draft", revision: expectedRevision },
      data: { status: "issued", issuedAt: new Date(), issuedIds },
    });
    if (updated.count !== 1) throw new EquityConflictError("Draft set revision is stale");
    return { set: await getEquityDraftSet(tx, scope, id), issuedIds };
  });
}
