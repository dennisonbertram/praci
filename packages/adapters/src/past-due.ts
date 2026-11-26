import { watchDay } from "@rakazo/core";
import type { NotificationEvents, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { notifyThreadEvent } from "./run-notification.js";

/**
 * One attention notification per bot per day for open items past their dueAt, whether or not the
 * bot checks in. The dedupe key is bot + the owner's local day, so later sweeps are no-ops.
 */
export async function notifyPastDueItems(deps: {
  prisma: PrismaClient;
  notificationEvents?: NotificationEvents;
  now: Date;
}): Promise<number> {
  const where = {
    status: { in: ["open", "parked"] },
    dueAt: { lt: deps.now },
    bot: { archivedAt: null },
  };
  // Grouped in the database so a bot with thousands of overdue items cannot hide another bot.
  const counts = await deps.prisma.scratchpadItem.groupBy({
    by: ["spaceId", "userId", "botId"],
    where,
    _count: { _all: true },
  });
  const bots = counts.length
    ? await deps.prisma.bot.findMany({
        where: { id: { in: counts.map((c) => c.botId) } },
        select: { id: true, name: true, thread: { select: { id: true, groupId: true } } },
      })
    : [];
  const botById = new Map(bots.map((bot) => [bot.id, bot]));
  const users = counts.length
    ? await deps.prisma.user.findMany({
        where: { id: { in: [...new Set(counts.map((c) => c.userId))] } },
        select: { id: true, timezone: true },
      })
    : [];
  const zones = new Map(users.map((user) => [user.id, user.timezone ?? "UTC"]));

  let sent = 0;
  for (const group of counts) {
    const bot = botById.get(group.botId);
    const thread = bot?.thread;
    if (!bot || !thread) continue;
    const first = await deps.prisma.scratchpadItem.findFirst({
      where: { ...where, spaceId: group.spaceId, userId: group.userId, botId: group.botId },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      select: { title: true },
    });
    const count = group._count._all;
    const day = watchDay(deps.now, zones.get(group.userId) ?? "UTC");
    const title =
      count === 1 ? `${bot.name}: 1 item is past due` : `${bot.name}: ${count} items are past due`;
    try {
      const result = await notifyThreadEvent(
        deps.prisma,
        deps.notificationEvents,
        { spaceId: group.spaceId, userId: group.userId, botId: group.botId, threadId: thread.id },
        {
          kind: "help",
          title,
          body: first?.title ?? "",
          botId: group.botId,
          threadId: thread.id,
          ...(thread.groupId ? { groupId: thread.groupId } : {}),
        },
        `past-due:${group.botId}:${day}`,
      );
      if (result === "created") sent += 1;
    } catch (error) {
      getLogger().error("past-due notification", error);
    }
  }
  return sent;
}
