import { MailSignalsSchema } from "@rakazo/contracts";
import { authPassed, NO_REPLY_STOP_AT } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { protectedSenders } from "./mail-protected-senders.js";

type Scope = { spaceId: string; userId: string };

/**
 * The user says one message needs no reply. It counts toward its sender once, and only when it is
 * a message Needs reply shows: the user has not answered and has not already said so. Archiving
 * never calls this, because an archive can mean "answered somewhere else". Returns the sender when
 * (its name, else its address) when this was the correction that stops Needs reply for it, so the
 * caller can offer Undo. `dismissed` tells the caller whether the message was dismissed, so a
 * path that only sometimes dismisses (finishing a to-do) can offer Undo just for that case.
 */
export async function dismissReply(
  prisma: PrismaClient,
  scope: Scope,
  messageId: string,
): Promise<{ stopped: string | null; dismissed: boolean }> {
  const shown = {
    id: messageId,
    ...scope,
    fromSelf: false,
    needsReply: true,
    alreadyHandled: false,
    replyDismissedAt: null,
    connection: { status: "connected" as const },
  };
  const message = await prisma.cachedMailMessage.findFirst({
    where: shown,
    select: {
      connectionId: true,
      threadId: true,
      receivedAt: true,
      fromAddress: true,
      fromName: true,
      signals: true,
    },
  });
  if (!message) return { stopped: null, dismissed: false };
  const answered = await prisma.cachedMailMessage.findFirst({
    where: {
      ...scope,
      connectionId: message.connectionId,
      threadId: message.threadId,
      fromSelf: true,
      receivedAt: { gt: message.receivedAt },
    },
    select: { id: true },
  });
  if (answered) return { stopped: null, dismissed: false };

  const address = message.fromAddress.trim().toLowerCase();
  // Anyone can write another person's address in From. A message that did not authenticate is
  // dismissed on its own, but cannot count toward a sender-wide stop.
  const parsed = MailSignalsSchema.safeParse(message.signals);
  const authenticated = parsed.success && authPassed(parsed.data);
  const count = await prisma.$transaction(async (tx) => {
    // The guarded update is the once-per-message check: a second call finds nothing to change.
    const { count: changed } = await tx.cachedMailMessage.updateMany({
      where: shown,
      data: { replyDismissedAt: new Date(), needsReply: false },
    });
    if (changed === 0 || !authenticated) return null;
    const [row] = await tx.$queryRaw<Array<{ noReplyCount: number }>>`
      UPDATE mail_sender_stats SET "noReplyCount" = "noReplyCount" + 1, "noReplyAt" = now()
      WHERE "connectionId" = ${message.connectionId} AND "senderAddress" = ${address}
        AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
      RETURNING "noReplyCount"`;
    return row?.noReplyCount ?? null;
  });
  if (count !== NO_REPLY_STOP_AT) return { stopped: null, dismissed: true };
  // A protected sender is never stopped, so there is nothing to announce.
  return {
    stopped: (await protectedSenders(prisma, scope, [address])).has(address)
      ? null
      : message.fromName?.trim() || address,
    dismissed: true,
  };
}

/**
 * Undo for one "No reply needed" dismissal: the message goes back to Needs reply and the sender's
 * count goes back by one, but only when this message's dismissal counted toward it — an
 * unauthenticated sender never counted, so its undo leaves the count alone. The guarded update
 * makes a second Undo on the same message a no-op.
 */
export async function undoReplyDismissal(
  prisma: PrismaClient,
  scope: Scope,
  messageId: string,
): Promise<void> {
  const message = await prisma.cachedMailMessage.findFirst({
    where: { id: messageId, ...scope, replyDismissedAt: { not: null } },
    select: { connectionId: true, fromAddress: true, signals: true },
  });
  if (!message) return;
  // The same test `dismissReply` used to count: only an authenticated dismissal counted.
  const parsed = MailSignalsSchema.safeParse(message.signals);
  const counted = parsed.success && authPassed(parsed.data);
  await prisma.$transaction(async (tx) => {
    const { count: changed } = await tx.cachedMailMessage.updateMany({
      where: { id: messageId, ...scope, replyDismissedAt: { not: null } },
      data: { replyDismissedAt: null, needsReply: true },
    });
    if (changed === 0 || !counted) return;
    await tx.$executeRaw`
      UPDATE mail_sender_stats SET "noReplyCount" = GREATEST("noReplyCount" - 1, 0)
      WHERE "connectionId" = ${message.connectionId} AND "senderAddress" = ${message.fromAddress
        .trim()
        .toLowerCase()}
        AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}`;
  });
}
