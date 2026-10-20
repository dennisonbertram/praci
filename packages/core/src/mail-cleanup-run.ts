import type {
  CleanupArchiveInput,
  CleanupArchiveOutput,
  CleanupKind,
  CleanupSender,
  UnsubscribeInput,
  UnsubscribeOutput,
} from "@rakazo/contracts";

/** The two server calls a cleanup makes; web and mobile pass their rpc client. */
export interface CleanupApi {
  archive(input: CleanupArchiveInput): Promise<CleanupArchiveOutput>;
  unsubscribe(input: UnsubscribeInput): Promise<UnsubscribeOutput>;
}

export type CleanupFailure =
  | { sender: CleanupSender; reason: "archive" }
  | { sender: CleanupSender; reason: "unsubscribe"; openUrl?: string }
  | { sender: CleanupSender; reason: "refused" | "disabled" | "unavailable" }
  | { sender: CleanupSender; reason: "error"; message: string };

export interface CleanupRunResult {
  /** The action-log batches the run wrote, for Undo. */
  batchIds: string[];
  /** Conversations changed. */
  done: number;
  failed: CleanupFailure[];
  /** Unsubscribe links for the user to open; a click opens them, since a popup after a request is blocked. */
  openLinks: Array<{ sender: CleanupSender; url: string }>;
  /** Senders whose unsubscribe email waits for the user's OK. */
  confirm: Array<{ sender: CleanupSender; mailTo: string }>;
}

/** A cleanup of one sender is at most this many pages of 50 conversations. */
const MAX_PAGES = 200;

/**
 * Applies one choice to each sender in turn. Unsubscribe goes first and the sender's mail is
 * archived only after a step that took effect; mailto senders wait for `confirmMailto`. The archive
 * pages through the sender's conversations with the batch id the server returned, and stops at the
 * first page that changes nothing. One sender's failure never stops the others.
 */
export async function runCleanup(
  kind: CleanupKind,
  senders: CleanupSender[],
  api: CleanupApi,
  options: { confirmMailto?: boolean } = {},
): Promise<CleanupRunResult> {
  const result: CleanupRunResult = {
    batchIds: [],
    done: 0,
    failed: [],
    openLinks: [],
    confirm: [],
  };
  for (const sender of senders) {
    const target = { connectionId: sender.connectionId, address: sender.address };
    try {
      if (kind === "unsubscribe") {
        const step = await api.unsubscribe({
          ...target,
          ...(options.confirmMailto ? { confirmMailto: true } : {}),
        });
        if (step.status === "needs_confirmation") {
          result.confirm.push({ sender, mailTo: step.mailTo ?? sender.address });
          continue;
        }
        if (step.status === "failed") {
          result.failed.push({ sender, reason: "unsubscribe", openUrl: step.openUrl });
          continue;
        }
        if (
          step.status === "refused" ||
          step.status === "disabled" ||
          step.status === "unavailable"
        ) {
          result.failed.push({ sender, reason: step.status });
          continue;
        }
        if (step.status === "opened" && step.openUrl)
          result.openLinks.push({ sender, url: step.openUrl });
      }
      let batchId: string | undefined;
      let last: CleanupArchiveOutput | undefined;
      let changed = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        last = await api.archive({ kind, ...target, ...(batchId ? { batchId } : {}) });
        batchId = last.batchId;
        result.done += last.done;
        changed += last.done;
        if (last.remaining === 0 || last.done === 0) break;
      }
      // A batch that changed nothing wrote no log row, so there is nothing to undo.
      if (batchId && changed > 0) result.batchIds.push(batchId);
      if (last && last.remaining > 0) result.failed.push({ sender, reason: "archive" });
    } catch (error) {
      result.failed.push({
        sender,
        reason: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  }
  return result;
}
