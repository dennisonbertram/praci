import type { InboxMoveInput, InboxMoveOutput } from "@rakazo/contracts";
import { bulkInChunks } from "@rakazo/core";

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
