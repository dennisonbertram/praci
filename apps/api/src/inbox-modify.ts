import { ORPCError } from "@orpc/server";
import type { MailLabelChange } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { Actor, InboxBulkInput, InboxBulkResult, InboxMarkReadInput } from "@rakazo/contracts";
import type { Prisma } from "@rakazo/db";
import type { InboxDeps } from "./inbox.js";
import { mailContext, notFound, providerFailure } from "./inbox.js";
import { flagReconnect } from "./inbox-compose.js";

export type ModifyDeps = InboxDeps & { mailWritesDisabled?: boolean };

interface Change {
  operation: string;
  /** The label change sent to the provider for each message. */
  label: MailLabelChange;
  /** What the cache row says afterwards. */
  cache: { unread?: boolean; inInbox?: boolean };
  /** Messages of the thread that still need the change; the rest are skipped. */
  pending: Prisma.CachedMailMessageWhereInput;
  /** Change the whole thread, not just the message the row stands for. */
  thread: boolean;
}

/**
 * Applies a label change to the caller's own cached message (and, for a thread-wide change, to the
 * thread's other cached messages), then records it in the cache so the Inbox shows it without a sync.
 * An account connected without permission to change mail gets the reconnect notice.
 */
async function modify(
  deps: ModifyDeps,
  actor: Actor,
  messageId: string,
  change: Change,
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  if (deps.mailWritesDisabled)
    throw new ORPCError("BAD_REQUEST", { message: "Changing mail is turned off." });
  const context = mailContext(actor, change.operation, signal);
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const row = await deps.prisma.cachedMailMessage.findFirst({
    where: { id: messageId, ...scope },
    select: { id: true, connectionId: true, threadId: true, providerMessageId: true },
  });
  if (!row) throw notFound();
  // The account comes from the actor's own connections, never from client input.
  const accounts = await deps.mail.listAccounts(scope, context);
  const account = accounts.find((a) => a.id === row.connectionId);
  if (!account) throw notFound();

  try {
    if (change.thread)
      // One call reaches every message of the thread, including ones that were never cached.
      await deps.mail.modifyThread(account, row.threadId, change.label, context);
    else await deps.mail.modifyMessage(account, row.providerMessageId, change.label, context);
  } catch (error) {
    // Deleted in Gmail since the last sync: nothing left to change, and the next sync prunes it.
    if (error instanceof MailProviderError && error.kind === "not_found") return { ok: true };
    if (error instanceof MailProviderError && error.kind === "auth")
      await flagReconnect(deps, account.id);
    providerFailure(error, change.operation, account.id);
  }
  await deps.prisma.cachedMailMessage.updateMany({
    where: {
      ...scope,
      connectionId: row.connectionId,
      ...(change.thread ? { threadId: row.threadId } : { id: row.id }),
      ...change.pending,
    },
    data: change.cache,
  });
  return { ok: true };
}

/** Marking read covers every unread message of the thread, so the row and the unread count agree. */
export function inboxMarkRead(
  deps: ModifyDeps,
  actor: Actor,
  input: InboxMarkReadInput,
  signal?: AbortSignal,
) {
  return input.read
    ? modify(
        deps,
        actor,
        input.messageId,
        {
          operation: "inbox.markRead",
          label: { removeLabelIds: ["UNREAD"] },
          cache: { unread: false },
          pending: { unread: true },
          thread: true,
        },
        signal,
      )
    : modify(
        deps,
        actor,
        input.messageId,
        {
          operation: "inbox.markUnread",
          label: { addLabelIds: ["UNREAD"] },
          cache: { unread: true },
          pending: {},
          thread: false,
        },
        signal,
      );
}

/** Archiving removes INBOX from every inbox message of the thread, as Gmail's own Archive does. */
export function inboxArchive(
  deps: ModifyDeps,
  actor: Actor,
  input: { messageId: string },
  signal?: AbortSignal,
) {
  return modify(
    deps,
    actor,
    input.messageId,
    {
      operation: "inbox.archive",
      label: { removeLabelIds: ["INBOX"] },
      cache: { inInbox: false },
      pending: { inInbox: true },
      thread: true,
    },
    signal,
  );
}

/** Undo for archive: puts INBOX back on every message of the thread that left it. */
export function inboxUnarchive(
  deps: ModifyDeps,
  actor: Actor,
  input: { messageId: string },
  signal?: AbortSignal,
) {
  return modify(
    deps,
    actor,
    input.messageId,
    {
      operation: "inbox.unarchive",
      label: { addLabelIds: ["INBOX"] },
      cache: { inInbox: true },
      pending: { inInbox: false },
      thread: true,
    },
    signal,
  );
}

const BULK_CONCURRENCY = 4;
type BulkOutcome = "done" | InboxBulkResult["failed"][number]["reason"];

/**
 * Archives or unarchives many of the caller's threads, one outcome per id. A failure on one id never
 * stops the others. Each id goes through the single-thread procedure, so scope, permission, reconnect
 * flagging and the cache update are the same as for one click.
 * ponytail: that is one account lookup and one Gmail call per id (at most 50, four at a time);
 * switch to a single batchModify per account if Gmail rate limits show up.
 */
async function bulk(
  op: "archive" | "unarchive",
  deps: ModifyDeps,
  actor: Actor,
  input: InboxBulkInput,
  signal?: AbortSignal,
): Promise<InboxBulkResult> {
  if (deps.mailWritesDisabled)
    throw new ORPCError("BAD_REQUEST", { message: "Changing mail is turned off." });
  const ids = [...new Set(input.messageIds)];
  const rows = await deps.prisma.cachedMailMessage.findMany({
    where: { id: { in: ids }, spaceId: actor.spaceId, userId: actor.userId },
    select: { id: true, pile: true, isSpam: true },
  });
  const known = new Map(rows.map((row) => [row.id, row]));
  const outcomes = new Map<string, BulkOutcome>();
  const queue: string[] = [];
  for (const id of ids) {
    const row = known.get(id);
    if (!row) outcomes.set(id, "not_found");
    // The client leaves spam out of a group archive; this keeps a forged call from archiving it.
    else if (op === "archive" && !input.allowSpam && (row.isSpam || row.pile === "spam"))
      outcomes.set(id, "spam");
    else queue.push(id);
  }
  const change = op === "archive" ? inboxArchive : inboxUnarchive;
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined && !signal?.aborted; id = queue.shift()) {
      try {
        await change(deps, actor, { messageId: id }, signal);
        outcomes.set(id, "done");
      } catch (error) {
        if (!(error instanceof ORPCError)) throw error;
        outcomes.set(
          id,
          error.code === "NOT_FOUND"
            ? "not_found"
            : error.code === "PRECONDITION_FAILED"
              ? "reconnect"
              : "unavailable",
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, queue.length) }, worker));
  return {
    done: ids.filter((id) => outcomes.get(id) === "done"),
    // An id left in the queue by an aborted request is reported as unavailable.
    failed: ids.flatMap((id) => {
      const outcome = outcomes.get(id) ?? "unavailable";
      return outcome === "done" ? [] : [{ messageId: id, reason: outcome }];
    }),
  };
}

export const inboxArchiveMany = (
  deps: ModifyDeps,
  actor: Actor,
  input: InboxBulkInput,
  signal?: AbortSignal,
) => bulk("archive", deps, actor, input, signal);

export const inboxUnarchiveMany = (
  deps: ModifyDeps,
  actor: Actor,
  input: InboxBulkInput,
  signal?: AbortSignal,
) => bulk("unarchive", deps, actor, input, signal);
