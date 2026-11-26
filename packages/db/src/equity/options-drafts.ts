import type {
  EquityIssueDraftSetResult,
  EquityOptionGrantCreateInputSchema,
} from "@rakazo/contracts";
import { EquityIssueDraftSetInputSchema } from "@rakazo/contracts";
import type * as z from "zod";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  EquityConflictError,
  EquityInputError,
  inTransaction,
  lockEquityDraftSets,
  lockEquityLedger,
  notFound,
  scopeOf,
} from "./ledger.js";
import { createEquityOptionGrant, getEquityOptionGrant } from "./options.js";

type DraftItem = z.input<typeof EquityOptionGrantCreateInputSchema>;

function draftItems(value: unknown): DraftItem[] {
  return Array.isArray(value) ? (value as DraftItem[]) : [];
}

/**
 * "Draft options": issues every grant of an "option_grant" draft set in one transaction, then
 * marks the set issued. Any failing item rolls the whole set back and leaves it a draft.
 */
export async function issueEquityOptionDraftSet(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityIssueDraftSetInputSchema>,
): Promise<EquityIssueDraftSetResult> {
  const input = EquityIssueDraftSetInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const grantIds = await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityDraftSets(tx, scope, [input.id]);
    const set = await tx.equityDraftSet.findFirst({ where: { id: input.id, ...scope } });
    if (!set) throw notFound("Draft set");
    if (set.revision !== input.expectedRevision)
      throw new EquityConflictError("Draft set revision is stale");
    if (set.securityKind !== "option_grant")
      throw new EquityConflictError("Only a draft set of option grants can be issued");
    const items = draftItems(set.items);
    if (set.status === "issued") {
      if (set.issuedIds.length === 0 || set.issuedIds.length !== items.length)
        throw new EquityConflictError("This issued draft set cannot be replayed safely");
      return set.issuedIds;
    }
    if (set.status !== "draft") throw new EquityConflictError("Only a draft set can be issued");
    if (!items.length) throw new EquityInputError("The draft set has no items to issue");
    const ids: string[] = [];
    for (const item of items) {
      const grant = await createEquityOptionGrant(tx, scope, item);
      ids.push(grant.id);
    }
    const updated = await tx.equityDraftSet.updateMany({
      where: { id: set.id, ...scope, status: "draft", revision: input.expectedRevision },
      data: { status: "issued", issuedAt: new Date(), issuedIds: ids },
    });
    if (updated.count !== 1) throw new EquityConflictError("Draft set revision is stale");
    return ids;
  });
  const grants = await Promise.all(grantIds.map((id) => getEquityOptionGrant(prisma, scope, id)));
  return { draftSetId: input.id, grants };
}
