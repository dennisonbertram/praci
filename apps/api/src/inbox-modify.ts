import { ORPCError } from "@orpc/server";
import type { MailLabelChange } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import { logMailAction } from "@rakazo/adapters";
import type {
  Actor,
  InboxBulkInput,
  InboxBulkResult,
  InboxMarkReadInput,
  InboxMoveInput,
  InboxMoveOutput,
  MailActionKind,
} from "@rakazo/contracts";
import type { Prisma } from "@rakazo/db";
import type { InboxDeps } from "./inbox.js";
import { mailContext, notFound, providerFailure } from "./inbox.js";
import { flagReconnect } from "./inbox-compose.js";
import { removeFiltersOfSender } from "./inbox-sender-rules.js";

export type ModifyDeps = InboxDeps & { mailWritesDisabled?: boolean };

interface Change {
  operation: string;
  /** The label change sent to the provider for each message. */
  label: MailLabelChange;
  /** What the cache row says afterwards. */
  cache: {
    unread?: boolean;
    inInbox?: boolean;
    isSpam?: boolean;
    pile?: null;
    notSpamAt?: Date | null;
  };
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
    // Deleted in Gmail since the last sync: nothing to change there. The cache still records the
    // change, so a bulk run does not meet the same row again, and the next sync prunes it.
    if (!(error instanceof MailProviderError && error.kind === "not_found")) {
      if (error instanceof MailProviderError && error.kind === "auth")
        await flagReconnect(deps, account.id);
      providerFailure(error, change.operation, account.id);
    }
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

interface BulkRow {
  id: string;
  connectionId: string;
  threadId: string;
  fromAddress: string;
  inInbox: boolean;
  pile: string | null;
  isSpam: boolean;
}

/**
 * Runs `apply` on many of the caller's cached messages, one outcome per id. A failure on one id never
 * stops the others. `skip` names why a known row is left out. Each id goes through the single-thread
 * procedure, so scope, permission, reconnect flagging and the cache update are the same as for one click.
 * ponytail: that is one account lookup and one Gmail call per id (at most 50, four at a time);
 * switch to a single batchModify per account if Gmail rate limits show up.
 */
async function bulk(
  deps: ModifyDeps,
  actor: Actor,
  messageIds: string[],
  skip: (row: BulkRow) => BulkOutcome | null,
  apply: (messageId: string) => Promise<unknown>,
  signal?: AbortSignal,
): Promise<{ result: InboxBulkResult; rows: Map<string, BulkRow> }> {
  if (deps.mailWritesDisabled)
    throw new ORPCError("BAD_REQUEST", { message: "Changing mail is turned off." });
  const ids = [...new Set(messageIds)];
  const found = await deps.prisma.cachedMailMessage.findMany({
    where: { id: { in: ids }, spaceId: actor.spaceId, userId: actor.userId },
    select: {
      id: true,
      connectionId: true,
      threadId: true,
      fromAddress: true,
      inInbox: true,
      pile: true,
      isSpam: true,
    },
  });
  const known = new Map(found.map((row) => [row.id, row]));
  const outcomes = new Map<string, BulkOutcome>();
  const queue: string[] = [];
  for (const id of ids) {
    const row = known.get(id);
    const left = row ? skip(row) : "not_found";
    if (left) outcomes.set(id, left);
    else queue.push(id);
  }
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined && !signal?.aborted; id = queue.shift()) {
      try {
        await apply(id);
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
    rows: known,
    result: {
      done: ids.filter((id) => outcomes.get(id) === "done"),
      // An id left in the queue by an aborted request is reported as unavailable.
      failed: ids.flatMap((id) => {
        const outcome = outcomes.get(id) ?? "unavailable";
        return outcome === "done" ? [] : [{ messageId: id, reason: outcome }];
      }),
    },
  };
}

/** The client leaves spam out of a group archive; this keeps a forged call from archiving it. */
const archiveSkip = (input: InboxBulkInput) => (row: BulkRow) =>
  !input.allowSpam && (row.isSpam || row.pile === "spam") ? ("spam" as const) : null;

export const inboxArchiveMany = async (
  deps: ModifyDeps,
  actor: Actor,
  input: InboxBulkInput,
  signal?: AbortSignal,
) =>
  (
    await bulk(
      deps,
      actor,
      input.messageIds,
      archiveSkip(input),
      (messageId) => inboxArchive(deps, actor, { messageId }, signal),
      signal,
    )
  ).result;

export const inboxUnarchiveMany = async (
  deps: ModifyDeps,
  actor: Actor,
  input: InboxBulkInput,
  signal?: AbortSignal,
) =>
  (
    await bulk(
      deps,
      actor,
      input.messageIds,
      () => null,
      (messageId) => inboxUnarchive(deps, actor, { messageId }, signal),
      signal,
    )
  ).result;

/**
 * Spam and trash are label changes the user asks for by clicking; the agent's `mail_modify` still
 * refuses both. Each puts the whole conversation in or out of the spam or trash label, as Gmail does.
 */
const MOVES: Record<InboxMoveInput["op"], Omit<Change, "thread"> & { kind: MailActionKind }> = {
  spam: {
    kind: "spam",
    operation: "inbox.spam",
    label: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] },
    cache: { inInbox: false, isSpam: true, notSpamAt: null },
    pending: { inInbox: true },
  },
  notSpam: {
    kind: "not_spam",
    operation: "inbox.notSpam",
    label: { addLabelIds: ["INBOX"], removeLabelIds: ["SPAM"] },
    // The pile is cleared too, so the row leaves the Spam pile at once; the next sync recomputes it.
    // A getter, so the time is the click's, not the module's. The model's spam verdict no longer applies to this message.
    get cache() {
      return { inInbox: true, isSpam: false, pile: null, notSpamAt: new Date() };
    },
    pending: { OR: [{ isSpam: true }, { pile: "spam" }] },
  },
  // Sync drops the row once Gmail reports it in the trash.
  trash: {
    kind: "trash",
    operation: "inbox.trash",
    label: { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] },
    cache: { inInbox: false },
    pending: { inInbox: true },
  },
};

/** Archives, or marks as spam, the threads of these cached messages for a sender cleanup page. */
export async function inboxCleanupMove(
  deps: ModifyDeps,
  actor: Actor,
  op: "archive" | "spam",
  messageIds: string[],
  signal?: AbortSignal,
) {
  return bulk(
    deps,
    actor,
    messageIds,
    () => null,
    (messageId) =>
      op === "archive"
        ? inboxArchive(deps, actor, { messageId }, signal)
        : modify(deps, actor, messageId, { ...MOVES.spam, thread: true }, signal),
    signal,
  );
}

/** Spam and trash apply to inbox mail; not spam to mail that is spam. Anything else is reported not_found. */
export async function inboxMoveMany(
  deps: ModifyDeps,
  actor: Actor,
  input: InboxMoveInput,
  signal?: AbortSignal,
): Promise<InboxMoveOutput> {
  const move = MOVES[input.op];
  const { result, rows } = await bulk(
    deps,
    actor,
    input.messageIds,
    (row) =>
      (input.op === "notSpam" ? row.isSpam || row.pile === "spam" : row.inInbox)
        ? null
        : "not_found",
    (messageId) => modify(deps, actor, messageId, { ...move, thread: true }, signal),
    signal,
  );
  const batchId = crypto.randomUUID();
  if (input.op === "notSpam") {
    // Mail the rules (not Gmail) called spam would be put back by the next sync, so the user's
    // decision is kept as an "important" mark on the sender, which the pile rules respect.
    const senders = new Set<string>();
    for (const id of result.done) {
      const row = rows.get(id) as BulkRow;
      if (!row.isSpam) senders.add(row.fromAddress.trim().toLowerCase());
    }
    for (const senderAddress of senders) {
      if (!senderAddress) continue;
      const key = { spaceId: actor.spaceId, userId: actor.userId, senderAddress };
      await deps.prisma.inboxSenderFeedback.upsert({
        where: { spaceId_userId_senderAddress: key },
        create: { ...key, mark: "important" },
        update: { mark: "important" },
      });
      // Best effort: the mail is already moved, and a filter that stays is listed in Cleanup.
      await removeFiltersOfSender(deps, actor, senderAddress, "inbox.notSpam", signal);
    }
  }
  const byConnection = new Map<string, BulkRow[]>();
  for (const id of result.done) {
    const row = rows.get(id) as BulkRow;
    byConnection.set(row.connectionId, [...(byConnection.get(row.connectionId) ?? []), row]);
  }
  for (const [connectionId, done] of byConnection)
    await logMailAction(
      deps.prisma,
      { spaceId: actor.spaceId, userId: actor.userId, connectionId },
      {
        batchId,
        kind: move.kind,
        source: "user",
        reason: "selection",
        senders: [...new Set(done.map((row) => row.fromAddress.toLowerCase()))],
        threadIds: [...new Set(done.map((row) => row.threadId))],
      },
    );
  return { ...result, batchId };
}
