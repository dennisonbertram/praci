import type { EquityDb, EquityScope } from "./ledger.js";
import { scopeOf, toJson } from "./ledger.js";

export type EquityAuditEvent = {
  kind: string;
  subjectType: string;
  subjectId: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Appends one audit row. Call it in the same interactive transaction as the change it records;
 * a trigger makes the table append-only. Securities changes go to recordTransaction instead.
 */
export async function recordEquityAudit(
  tx: EquityDb,
  actor: EquityScope,
  event: EquityAuditEvent,
): Promise<void> {
  await tx.equityAuditEvent.create({
    data: {
      ...scopeOf(actor),
      kind: event.kind,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      actorUserId: actor.userId,
      before: toJson(event.before),
      after: toJson(event.after),
    },
  });
}
