import { createHash } from "node:crypto";
import type { NotificationMessage } from "@rakazo/adapter-kit";
import type { CreateNotificationInput, NotificationEvents, Prisma, PrismaClient } from "@rakazo/db";
import {
  createNotification,
  createNotificationInTransaction,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
} from "@rakazo/db";

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
  prisma: Db | Prisma.TransactionClient,
  events: NotificationEvents | undefined,
  run: { spaceId: string; userId: string; botId: string; threadId: string; id?: string },
  message: NotificationMessage,
  key: string,
): Promise<"created" | "off" | "duplicate"> {
  const { status, publish } = await writeThreadNotification(prisma, events, run, message, key);
  await publish?.();
  return status;
}

/**
 * The notification `notifyThreadEvent` stores, without publishing it. A caller that writes inside its
 * own transaction keeps the returned publish thunk and runs it after the commit, so subscribers never
 * hear about a row that is not yet theirs to read.
 */
export async function writeThreadNotification(
  prisma: Db | Prisma.TransactionClient,
  events: NotificationEvents | undefined,
  run: { spaceId: string; userId: string; botId: string; threadId: string; id?: string },
  message: NotificationMessage,
  key: string,
): Promise<{ status: "created" | "off" | "duplicate"; publish: (() => Promise<void>) | null }> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { spaceId_userId: { spaceId: run.spaceId, userId: run.userId } },
    select: { finish: true, help: true, takeover: true },
  });
  if (preference && preference[CATEGORY[message.kind]] === false) {
    return { status: "off", publish: null };
  }
  const input: CreateNotificationInput = {
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
  };
  const result =
    "$transaction" in prisma
      ? await createNotification(prisma, input)
      : await createNotificationInTransaction(prisma, input);
  if (result.status !== "created") return { status: "duplicate", publish: null };
  const { id, importance } = result.notification;
  return {
    status: "created",
    publish: async () => {
      await events?.notify(
        { spaceId: run.spaceId, userId: run.userId },
        { id, surface: "thread", importance },
      );
    },
  };
}
