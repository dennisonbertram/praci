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
 * Sends due pending deliveries, one claim at a time. A claim (FOR UPDATE SKIP LOCKED) bumps
 * `attempts` and pushes `nextAttemptAt` out by the lease; `attempts` is the lease token. Every
 * later write is compare-and-set on it, so a worker whose lease ran out (another worker reclaimed
 * the delivery) writes nothing, and its send is aborted shortly before the lease ends. A delivery
 * whose notification was already shown or seen is skipped: the user was present.
 */
export async function deliverDueNotifications(deps: {
  prisma: Db;
  channels: NotificationChannel[];
  now?: Date;
  signal?: AbortSignal;
  leaseMs?: number;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = deps.now ?? new Date();
  const leaseMs = deps.leaseMs ?? CLAIM_LEASE_MS;
  const totals = { sent: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < BATCH; i += 1) {
    const lease = new Date(now.getTime() + leaseMs);
    const [claimed] = await deps.prisma.$queryRaw<
      { id: string; notificationId: string; channel: string; attempts: number }[]
    >`
      UPDATE "notification_deliveries" SET "attempts" = "attempts" + 1, "nextAttemptAt" = ${lease}
      WHERE "id" = (
        SELECT "id" FROM "notification_deliveries"
        WHERE "status" = 'pending' AND "nextAttemptAt" <= ${now}
        ORDER BY "nextAttemptAt" LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "notificationId", "channel", "attempts"`;
    if (!claimed) break;
    const outcome = await deliverOne(deps, claimed, now, leaseMs);
    if (outcome) totals[outcome] += 1;
  }
  return totals;
}

async function deliverOne(
  deps: { prisma: Db; channels: NotificationChannel[]; signal?: AbortSignal },
  delivery: { id: string; notificationId: string; channel: string; attempts: number },
  now: Date,
  leaseMs: number,
): Promise<"sent" | "failed" | "skipped" | null> {
  /** Writes only while this worker still holds the lease; null means it was lost. */
  const update = async (data: {
    status?: "sent" | "failed" | "skipped";
    lastError?: string | null;
    nextAttemptAt?: Date;
  }) => {
    const { count } = await deps.prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, status: "pending", attempts: delivery.attempts },
      data,
    });
    return count === 1;
  };
  const finish = async (status: "sent" | "failed" | "skipped", lastError?: string) =>
    (await update({ status, lastError: lastError ?? null })) ? status : null;
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
  const abort = AbortSignal.timeout(Math.floor(leaseMs * 0.75));
  const context = {
    operationId: `notification.deliver:${delivery.id}`,
    traceId: `notification.deliver:${delivery.id}`,
    spaceId: notification.spaceId,
    userId: notification.userId,
    signal: deps.signal ? AbortSignal.any([deps.signal, abort]) : abort,
  };
  let sent = 0;
  let error: unknown;
  for (const endpoint of endpoints) {
    // Stop if the lease is gone: another worker owns this delivery now.
    const owned = await deps.prisma.notificationDelivery.count({
      where: { id: delivery.id, status: "pending", attempts: delivery.attempts },
    });
    if (owned === 0) return null;
    try {
      const result = await channel.send(notification, endpoint, context);
      if (result === "sent") sent += 1;
      else {
        // Only if the row is still the one the channel judged dead.
        await deps.prisma.notificationEndpoint.deleteMany({
          where: { id: endpoint.id, address: endpoint.address, sessionId: endpoint.sessionId },
        });
      }
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
  const retried = await update({
    lastError: message.slice(0, 500),
    nextAttemptAt: new Date(now.getTime() + outboxBackoffMs(delivery.attempts)),
  });
  return retried ? "failed" : null;
}
