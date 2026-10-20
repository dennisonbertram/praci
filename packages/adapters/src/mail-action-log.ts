import type { MailActionKind } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

/** Log rows older than this are deleted whenever the same user logs a new action. */
const KEEP_DAYS = 30;

export interface MailActionScope {
  spaceId: string;
  userId: string;
  connectionId: string;
}

export interface MailActionInput {
  /** Rows with the same account and batchId merge, so a cleanup that runs in pages is one action. */
  batchId: string;
  kind: MailActionKind;
  source: "user" | "auto";
  reason: "cleanup" | "selection" | "skip_inbox";
  senders: string[];
  /** Provider thread ids that changed; undo works from these. */
  threadIds: string[];
}

/** Records bulk mail actions so they can be listed and undone. Appends to the batch if it exists. */
export async function logMailAction(
  prisma: Pick<PrismaClient, "$executeRaw" | "mailActionLog">,
  scope: MailActionScope,
  input: MailActionInput,
): Promise<void> {
  const { spaceId, userId, connectionId } = scope;
  if (input.threadIds.length === 0) return;
  await prisma.$executeRaw`
    INSERT INTO mail_action_logs (id, "spaceId", "userId", "connectionId", "batchId", kind, source,
      reason, "senderAddresses", "threadIds")
    VALUES (gen_random_uuid()::text, ${spaceId}, ${userId}, ${connectionId}, ${input.batchId},
      ${input.kind}, ${input.source}, ${input.reason}, ${input.senders}::text[], ${input.threadIds}::text[])
    ON CONFLICT ("connectionId", "batchId") DO UPDATE SET
      "senderAddresses" = ARRAY(SELECT DISTINCT unnest(mail_action_logs."senderAddresses" || EXCLUDED."senderAddresses")),
      "threadIds" = ARRAY(SELECT DISTINCT unnest(mail_action_logs."threadIds" || EXCLUDED."threadIds"))`;
  await prisma.mailActionLog.deleteMany({
    where: { spaceId, userId, createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } },
  });
}
