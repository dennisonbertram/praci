import { createHash } from "node:crypto";
import type { NotificationMessage } from "@rakazo/adapter-kit";
import type { NotificationEvents, PrismaClient } from "@rakazo/db";
import { createNotification, NOTIFICATION_BODY_MAX, NOTIFICATION_TITLE_MAX } from "@rakazo/db";

type Db = Pick<
  PrismaClient,
  "notification" | "notificationDelivery" | "notificationPreference" | "$transaction"
>;

const CATEGORY = {
  completion: "finish",
  failure: "finish",
  help: "help",
  takeover: "takeover",
} as const;

const KIND = {
  completion: "done",
  failure: "failed",
  help: "needs_input",
  takeover: "urgent",
} as const;

/**
 * Finish, failure, help and takeover events become `attention` notifications on the run's thread.
 * The outbox sends the phone push; the web client shows the toast or OS notification. A category
 * the user switched off creates nothing. `key` makes a repeat of the same event a no-op.
 */
export async function notifyThreadEvent(
  prisma: Db,
  events: NotificationEvents | undefined,
  run: { spaceId: string; userId: string; botId: string; threadId: string; id?: string },
  message: NotificationMessage,
  key: string,
): Promise<"created" | "off" | "duplicate"> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { spaceId_userId: { spaceId: run.spaceId, userId: run.userId } },
    select: { finish: true, help: true, takeover: true },
  });
  if (preference && preference[CATEGORY[message.kind]] === false) return "off";
  const result = await createNotification(prisma, {
    spaceId: run.spaceId,
    userId: run.userId,
    botId: run.botId,
    runId: run.id ?? null,
    surface: "thread",
    threadId: message.threadId,
    title: message.title.slice(0, NOTIFICATION_TITLE_MAX),
    body: message.body.slice(0, NOTIFICATION_BODY_MAX) || null,
    link: message.groupId ? `/app/g/${message.groupId}` : `/app/${message.botId}`,
    importance: "attention",
    kind: KIND[message.kind],
    dedupeKey: createHash("sha256").update(`${message.kind}\n${key}`).digest("hex").slice(0, 32),
    skipRateLimits: true,
  });
  if (result.status !== "created") return "duplicate";
  const { id, importance } = result.notification;
  await events?.notify(
    { spaceId: run.spaceId, userId: run.userId },
    { id, surface: "thread", importance },
  );
  return "created";
}
