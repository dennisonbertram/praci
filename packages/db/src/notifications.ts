import { createHash } from "node:crypto";
import type { Notification, PrismaClient } from "./client.js";

type Scope = { spaceId: string; userId: string };
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });
type Db = Pick<PrismaClient, "notification" | "notificationDelivery" | "$transaction">;

export const NOTIFICATION_TITLE_MAX = 80;
export const NOTIFICATION_BODY_MAX = 200;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DELIVERY_DELAY_MS = 30_000;
const NOTIFICATION_RETENTION_MS = 30 * DEDUPE_WINDOW_MS;
const DELIVERY_RETENTION_MS = 7 * DEDUPE_WINDOW_MS;
/** Per agent and user, counted in Postgres. Guesses; tune from data. */
export const NOTIFICATION_LIMITS = { perHour: 5, perDay: 20, attentionPerHour: 2 } as const;

export class NotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationValidationError";
  }
}

export type CreateNotificationInput = Scope & {
  botId?: string | null;
  routineId?: string | null;
  runId?: string | null;
  surface: string;
  threadId?: string | null;
  title: string;
  body?: string | null;
  link?: string | null;
  importance?: "info" | "attention";
  dedupeKey?: string;
  /** Platform events (run finished, help, takeover) are not agent chatter: skip the per-agent rate limits. */
  skipRateLimits?: boolean;
  /** For tests; defaults to the current time. */
  now?: Date;
};

export type CreateNotificationResult =
  | { status: "created"; notification: Notification }
  | { status: "deduped"; notification: Notification }
  | { status: "rateLimited" };

/** An in-app path: starts with one slash, no scheme, no host, no whitespace or backslash. */
export function isInAppPath(link: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(link);
}

const defaultDedupeKey = (surface: string, title: string) =>
  createHash("sha256").update(`${surface}\n${title}`).digest("hex").slice(0, 32);

function validate(input: CreateNotificationInput) {
  const title = input.title.trim();
  const body = input.body?.trim() || null;
  if (!input.surface.trim() || input.surface.length > 64) {
    throw new NotificationValidationError("Notification surface is required (64 characters max).");
  }
  if (!title || title.length > NOTIFICATION_TITLE_MAX) {
    throw new NotificationValidationError(
      `Notification title must be 1 to ${NOTIFICATION_TITLE_MAX} characters.`,
    );
  }
  if (body && body.length > NOTIFICATION_BODY_MAX) {
    throw new NotificationValidationError(
      `Notification body must be at most ${NOTIFICATION_BODY_MAX} characters.`,
    );
  }
  if (input.link && !isInAppPath(input.link)) {
    throw new NotificationValidationError("Notification link must be an in-app path.");
  }
  if (input.dedupeKey !== undefined && (!input.dedupeKey || input.dedupeKey.length > 200)) {
    throw new NotificationValidationError("Notification dedupe key must be 1 to 200 characters.");
  }
  return { title, body };
}

/**
 * Stores a notification unless the same key was used in the last 24 hours or the agent is over its
 * limits. One advisory lock per (space, user, agent) serializes concurrent calls, so the dedupe
 * check and the rate counts cannot be raced. `attention` also queues one delivery per external
 * channel the user has an endpoint for and has not switched off; `info` never leaves the app.
 */
export async function createNotification(
  prisma: Db,
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  const { title, body } = validate(input);
  const scope = ownerOf(input);
  const botId = input.botId ?? null;
  const now = input.now ?? new Date();
  const importance = input.importance ?? "info";
  const dedupeKey = input.dedupeKey ?? defaultDedupeKey(input.surface, title);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`notification:${scope.spaceId}:${scope.userId}:${botId ?? ""}`}, 0))`;
    const duplicate = await tx.notification.findFirst({
      where: {
        ...scope,
        botId,
        dedupeKey,
        createdAt: { gt: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (duplicate) return { status: "deduped", notification: duplicate };

    const since = (ms: number) => ({ gt: new Date(now.getTime() - ms) });
    const [hour, day, attentionHour] = await Promise.all([
      tx.notification.count({ where: { ...scope, botId, createdAt: since(HOUR_MS) } }),
      tx.notification.count({ where: { ...scope, botId, createdAt: since(DEDUPE_WINDOW_MS) } }),
      importance === "attention"
        ? tx.notification.count({
            where: { ...scope, botId, importance, createdAt: since(HOUR_MS) },
          })
        : 0,
    ]);
    if (
      !input.skipRateLimits &&
      (hour >= NOTIFICATION_LIMITS.perHour ||
        day >= NOTIFICATION_LIMITS.perDay ||
        attentionHour >= NOTIFICATION_LIMITS.attentionPerHour)
    ) {
      return { status: "rateLimited" };
    }

    const notification = await tx.notification.create({
      data: {
        ...scope,
        botId,
        routineId: input.routineId ?? null,
        runId: input.runId ?? null,
        surface: input.surface,
        threadId: input.threadId ?? null,
        title,
        body,
        link: input.link ?? null,
        importance,
        dedupeKey,
        createdAt: now,
      },
    });
    if (importance === "attention") {
      const channels = await externalChannels(tx, scope);
      if (channels.length > 0) {
        await tx.notificationDelivery.createMany({
          data: channels.map((channel) => ({
            notificationId: notification.id,
            channel,
            nextAttemptAt: new Date(now.getTime() + DELIVERY_DELAY_MS),
          })),
        });
      }
    }
    return { status: "created", notification };
  });
}

/** Channels the user has an endpoint for (account-wide or in this space) and has not disabled. */
async function externalChannels(
  tx: Pick<PrismaClient, "notificationEndpoint" | "notificationPreference">,
  { spaceId, userId }: Scope,
): Promise<string[]> {
  const [endpoints, preference] = await Promise.all([
    tx.notificationEndpoint.findMany({
      where: { userId, OR: [{ spaceId: null }, { spaceId }] },
      distinct: ["channel"],
      select: { channel: true },
    }),
    tx.notificationPreference.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
      select: { channels: true },
    }),
  ]);
  const switches = (preference?.channels ?? {}) as Record<string, unknown>;
  return endpoints.map((e) => e.channel).filter((channel) => switches[channel] !== false);
}

export const NOTIFICATION_PAGE_SIZE = 100;

/** Opaque position after a notification: its creation time and id. */
export const encodeNotificationCursor = (n: Pick<Notification, "createdAt" | "id">) =>
  `${n.createdAt.toISOString()}|${n.id}`;

function decodeNotificationCursor(cursor: string): { createdAt: Date; id: string } {
  const [time, ...rest] = cursor.split("|");
  const createdAt = new Date(time ?? "");
  const id = rest.join("|");
  if (Number.isNaN(createdAt.getTime()) || !id) {
    throw new NotificationValidationError("Invalid notification cursor.");
  }
  return { createdAt, id };
}

/**
 * One page of the user's notifications, oldest first, after `cursor` (or after `since` when there
 * is no cursor). `nextCursor` is set while more remain; pass it back to continue, so a client
 * that was offline can catch up completely. Ties on creation time are ordered by id.
 */
export async function listNotifications(
  prisma: Pick<PrismaClient, "notification">,
  actor: Scope & { since?: Date; cursor?: string; limit?: number },
): Promise<{ items: Notification[]; nextCursor: string | null }> {
  const limit = Math.min(actor.limit ?? NOTIFICATION_PAGE_SIZE, NOTIFICATION_PAGE_SIZE);
  const after = actor.cursor ? decodeNotificationCursor(actor.cursor) : undefined;
  const rows = await prisma.notification.findMany({
    where: {
      ...ownerOf(actor),
      ...(after
        ? {
            OR: [
              { createdAt: { gt: after.createdAt } },
              { createdAt: after.createdAt, id: { gt: after.id } },
            ],
          }
        : actor.since
          ? { createdAt: { gt: actor.since } }
          : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  });
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? encodeNotificationCursor(last) : null };
}

/** Marks the surface's unseen notifications seen, returning how many changed. */
export async function markSeen(
  prisma: Pick<PrismaClient, "notification">,
  actor: Scope & { surface: string },
  now = new Date(),
): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { ...ownerOf(actor), surface: actor.surface, seenAt: null },
    data: { seenAt: now },
  });
  return count;
}

/** Records that a client showed the notification as a toast. False when it is not the user's. */
export async function markShown(
  prisma: Pick<PrismaClient, "notification">,
  actor: Scope,
  id: string,
  now = new Date(),
): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({
    where: { ...ownerOf(actor), id },
    data: { shownAt: now },
  });
  return count > 0;
}

/** Unseen notification count per surface. */
export async function unseenCounts(
  prisma: Pick<PrismaClient, "notification">,
  actor: Scope,
): Promise<Record<string, number>> {
  const rows = await prisma.notification.groupBy({
    by: ["surface"],
    where: { ...ownerOf(actor), seenAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.surface, row._count._all]));
}

/** Deletes notifications older than 30 days and deliveries older than 7 days. */
export async function deleteExpiredNotifications(
  prisma: Pick<PrismaClient, "notification" | "notificationDelivery">,
  now = new Date(),
): Promise<{ notifications: number; deliveries: number }> {
  const deliveries = await prisma.notificationDelivery.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - DELIVERY_RETENTION_MS) } },
  });
  const notifications = await prisma.notification.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_RETENTION_MS) } },
  });
  return { notifications: notifications.count, deliveries: deliveries.count };
}
