import { ORPCError } from "@orpc/server";
import type { MailLabelChange } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { Actor, InboxMarkReadInput } from "@rakazo/contracts";
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
    select: { id: true, connectionId: true, threadId: true },
  });
  if (!row) throw notFound();
  // The account comes from the actor's own connections, never from client input.
  const accounts = await deps.mail.listAccounts(scope, context);
  const account = accounts.find((a) => a.id === row.connectionId);
  if (!account) throw notFound();

  const targets = await deps.prisma.cachedMailMessage.findMany({
    where: {
      ...scope,
      connectionId: row.connectionId,
      ...(change.thread ? { threadId: row.threadId } : { id: row.id }),
      ...change.pending,
    },
    select: { id: true, providerMessageId: true },
  });
  for (const target of targets) {
    try {
      await deps.mail.modifyMessage(account, target.providerMessageId, change.label, context);
    } catch (error) {
      // Deleted in Gmail since the last sync: nothing left to change, and the next sync prunes it.
      if (error instanceof MailProviderError && error.kind === "not_found") continue;
      if (error instanceof MailProviderError && error.kind === "auth")
        await flagReconnect(deps, account.id);
      providerFailure(error, change.operation, account.id);
    }
    await deps.prisma.cachedMailMessage.updateMany({
      where: { id: target.id, ...scope },
      data: change.cache,
    });
  }
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
