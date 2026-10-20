import { ORPCError } from "@orpc/server";
import type { MailLabelChange } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type {
  Actor,
  MailAction,
  MailActionKind,
  MailActionsListOutput,
  MailActionUndoOutput,
} from "@rakazo/contracts";
import { MailActionKindSchema } from "@rakazo/contracts";
import type { Prisma } from "@rakazo/db";
import { mailContext, notFound } from "./inbox.js";
import { flagReconnect } from "./inbox-compose.js";
import type { ModifyDeps } from "./inbox-modify.js";

const LIST_LIMIT = 20;
const UNDO_CONCURRENCY = 4;

/** What undoing each kind changes in the provider and in the cache. */
const INVERSE: Record<
  MailActionKind,
  { label: MailLabelChange; cache: { inInbox: boolean; isSpam?: boolean } }
> = {
  archive: { label: { addLabelIds: ["INBOX"] }, cache: { inInbox: true } },
  skip_inbox: { label: { addLabelIds: ["INBOX"] }, cache: { inInbox: true } },
  unsubscribe: { label: { addLabelIds: ["INBOX"] }, cache: { inInbox: true } },
  trash: {
    label: { addLabelIds: ["INBOX"], removeLabelIds: ["TRASH"] },
    cache: { inInbox: true },
  },
  spam: {
    label: { addLabelIds: ["INBOX"], removeLabelIds: ["SPAM"] },
    cache: { inInbox: true, isSpam: false },
  },
  not_spam: {
    label: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] },
    cache: { inInbox: false, isSpam: true },
  },
};

/** The user's latest bulk actions, newest first, one entry per click (an action on several accounts is one). */
export async function inboxActionsList(
  deps: Pick<ModifyDeps, "prisma">,
  actor: Actor,
): Promise<MailActionsListOutput> {
  const rows = await deps.prisma.mailActionLog.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT * 4,
  });
  const batches = new Map<string, typeof rows>();
  for (const row of rows) batches.set(row.batchId, [...(batches.get(row.batchId) ?? []), row]);
  const actions = [...batches.values()].slice(0, LIST_LIMIT).flatMap((members): MailAction[] => {
    const first = members[0];
    const kind = MailActionKindSchema.safeParse(first?.kind);
    if (!first || !kind.success) return [];
    const senders = [...new Set(members.flatMap((row) => row.senderAddresses))];
    return [
      {
        batchId: first.batchId,
        kind: kind.data,
        source: first.source === "auto" ? "auto" : "user",
        createdAt: first.createdAt.toISOString(),
        undone: members.every((row) => row.undoneAt !== null),
        threadCount: members.reduce((sum, row) => sum + row.threadIds.length, 0),
        senders: senders.slice(0, 5),
        senderCount: senders.length,
      },
    ];
  });
  return { actions };
}

/**
 * Puts the mail of one logged action back, working from the thread ids it stored, so it still works
 * after sync pruned the cache rows. An action on several accounts is undone on all of them. A row is
 * marked undone only when every thread was restored; after a partial failure it can be undone again.
 * Undoing a user's skip inbox also forgets the sender's decision.
 */
export async function inboxActionsUndo(
  deps: ModifyDeps,
  actor: Actor,
  input: { batchId: string },
  signal?: AbortSignal,
): Promise<MailActionUndoOutput> {
  if (deps.mailWritesDisabled)
    throw new ORPCError("BAD_REQUEST", { message: "Changing mail is turned off." });
  const { prisma } = deps;
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const rows = await prisma.mailActionLog.findMany({
    where: { ...scope, batchId: input.batchId, undoneAt: null },
  });
  if (rows.length === 0) throw notFound();
  const context = mailContext(actor, "inbox.actions.undo", signal);
  const accounts = await deps.mail.listAccounts(scope, context);

  let restored = 0;
  let failed = 0;
  for (const row of rows) {
    const kind = MailActionKindSchema.safeParse(row.kind);
    const account = accounts.find((a) => a.id === row.connectionId);
    if (!kind.success || !account) {
      failed += row.threadIds.length;
      continue;
    }
    const inverse = INVERSE[kind.data];
    const queue = [...row.threadIds];
    const restoredThreads: string[] = [];
    let failures = 0;
    let stopped = false;
    const worker = async () => {
      for (let threadId = queue.shift(); threadId !== undefined; threadId = queue.shift()) {
        if (stopped || signal?.aborted) {
          failures += 1;
          continue;
        }
        try {
          await deps.mail.modifyThread(account, threadId, inverse.label, context);
          restoredThreads.push(threadId);
        } catch (error) {
          // Deleted in Gmail since: nothing to put back.
          if (error instanceof MailProviderError && error.kind === "not_found") continue;
          failures += 1;
          if (error instanceof MailProviderError && ["auth", "rate_limited"].includes(error.kind)) {
            stopped = true;
            if (error.kind === "auth") await flagReconnect(deps, account.id);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(UNDO_CONCURRENCY, queue.length) }, worker));
    restored += restoredThreads.length;
    failed += failures;

    if (restoredThreads.length > 0) {
      const where: Prisma.CachedMailMessageWhereInput = {
        ...scope,
        connectionId: row.connectionId,
        threadId: { in: restoredThreads },
      };
      await prisma.cachedMailMessage.updateMany({ where, data: inverse.cache });
    }
    if (failures > 0) continue;
    await prisma.mailActionLog.update({ where: { id: row.id }, data: { undoneAt: new Date() } });
    const decisions = {
      ...scope,
      connectionId: row.connectionId,
      senderAddress: { in: row.senderAddresses },
    };
    if (kind.data === "skip_inbox" && row.source === "user")
      await prisma.mailSenderDecision.deleteMany({ where: decisions });
    else if (kind.data === "unsubscribe")
      await prisma.mailSenderDecision.updateMany({ where: decisions, data: { skipInboxAt: null } });
  }
  return { restored, failed };
}
