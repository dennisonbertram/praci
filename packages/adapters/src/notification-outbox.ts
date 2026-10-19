import type { NotificationChannel } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

export const OUTBOX_MAX_ATTEMPTS = 5;
/** A claimed delivery that is never finished (worker died) becomes due again after this long. */
const CLAIM_LEASE_MS = 2 * 60 * 1000;
const BACKOFF_BASE_MS = 60 * 1000;
const BATCH = 25;

type Db = Pick<
  PrismaClient,
  "notification" | "notificationDelivery" | "notificationEndpoint" | "$queryRaw"
>;

/** 1 minute after the first failure, then 2, 4, 8. */
export const outboxBackoffMs = (attempts: number) => BACKOFF_BASE_MS * 2 ** (attempts - 1);

/**
 * Sends due pending deliveries. Each is claimed with FOR UPDATE SKIP LOCKED and leased by pushing
 * its next attempt out, so two workers never send the same one and a crash retries it later. A
 * delivery whose notification was already shown or seen is skipped: the user was present.
 */
export async function deliverDueNotifications(deps: {
  prisma: Db;
  channels: NotificationChannel[];
  now?: Date;
  signal?: AbortSignal;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = deps.now ?? new Date();
  const lease = new Date(now.getTime() + CLAIM_LEASE_MS);
  const claimed = await deps.prisma.$queryRaw<
    { id: string; notificationId: string; channel: string; attempts: number }[]
  >`
    UPDATE "notification_deliveries" SET "attempts" = "attempts" + 1, "nextAttemptAt" = ${lease}
    WHERE "id" IN (
      SELECT "id" FROM "notification_deliveries"
      WHERE "status" = 'pending' AND "nextAttemptAt" <= ${now}
      ORDER BY "nextAttemptAt" LIMIT ${BATCH} FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "notificationId", "channel", "attempts"`;
  const totals = { sent: 0, failed: 0, skipped: 0 };
  for (const delivery of claimed) {
    const outcome = await deliverOne(deps, delivery, now);
    totals[outcome] += 1;
  }
  return totals;
}

async function deliverOne(
  deps: { prisma: Db; channels: NotificationChannel[]; signal?: AbortSignal },
  delivery: { id: string; notificationId: string; channel: string; attempts: number },
  now: Date,
): Promise<"sent" | "failed" | "skipped"> {
  const finish = async (status: "sent" | "failed" | "skipped", lastError?: string) => {
    await deps.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status, lastError: lastError ?? null },
    });
    return status;
  };
  const notification = await deps.prisma.notification.findUnique({
    where: { id: delivery.notificationId },
  });
  if (!notification || notification.shownAt || notification.seenAt) return finish("skipped");
  const channel = deps.channels.find((c) => c.channel === delivery.channel);
  if (!channel) return finish("failed", `No ${delivery.channel} channel is configured.`);
  const endpoints = await deps.prisma.notificationEndpoint.findMany({
    where: {
      userId: notification.userId,
      channel: delivery.channel,
      OR: [{ spaceId: null }, { spaceId: notification.spaceId }],
    },
    select: { id: true, address: true, sessionId: true },
  });
  const context = {
    operationId: `notification.deliver:${delivery.id}`,
    traceId: `notification.deliver:${delivery.id}`,
    spaceId: notification.spaceId,
    userId: notification.userId,
    signal: deps.signal ?? new AbortController().signal,
  };
  let sent = 0;
  let error: unknown;
  for (const endpoint of endpoints) {
    try {
      const result = await channel.send(notification, endpoint, context);
      if (result === "sent") sent += 1;
      else await deps.prisma.notificationEndpoint.deleteMany({ where: { id: endpoint.id } });
    } catch (e) {
      error = e;
    }
  }
  // Once any device took it, a retry would show it twice on that device.
  if (sent > 0) return finish("sent");
  if (error === undefined) return finish("skipped");
  const message = error instanceof Error ? error.message : String(error);
  getLogger().error("notification delivery failed", error);
  if (delivery.attempts >= OUTBOX_MAX_ATTEMPTS) return finish("failed", message.slice(0, 500));
  await deps.prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      lastError: message.slice(0, 500),
      nextAttemptAt: new Date(now.getTime() + outboxBackoffMs(delivery.attempts)),
    },
  });
  return "failed";
}
