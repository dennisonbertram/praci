import type { InboxMoveInput, InboxMoveOutput, MailRow } from "@rakazo/contracts";
import { bulkInChunks } from "@rakazo/core";

/** Spam and trash are for inbox mail; Not spam for mail the Spam pile shows. */
export type MailMoveOp = "spam" | "notSpam" | "trash";

/** Which moves one mail offers, in menu order. The row and the open message share this rule. */
export function availableMoves(row: Pick<MailRow, "inInbox" | "pile">): MailMoveOp[] {
  return [
    ...(row.inInbox && row.pile !== "spam" ? (["spam"] as const) : []),
    ...(row.inInbox ? (["trash"] as const) : []),
    ...(row.pile === "spam" ? (["notSpam"] as const) : []),
  ];
}

/**
 * Reports spam, clears the spam flag or trashes many messages in slices the API accepts. Every
 * slice's batch id is pushed to `batchIds` as it returns, so Undo still has the finished slices when
 * a later one throws.
 */
export function moveInChunks(
  op: InboxMoveInput["op"],
  messageIds: string[],
  call: (input: InboxMoveInput) => Promise<InboxMoveOutput>,
  batchIds: string[],
) {
  return bulkInChunks(messageIds, async (slice) => {
    const out = await call({ op, messageIds: slice });
    batchIds.push(out.batchId);
    return out;
  });
}
