import { WAITING_ON_SELF } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";

type Db = Pick<PrismaClient, "scratchpadItem">;

export type WaitingOnYouItem = {
  id: string;
  botId: string;
  botName: string;
  title: string;
  status: string;
  waitingOn: string | null;
  dueAt: Date | null;
};

/**
 * The user's open or parked scratchpad items, across their bots in this space, that wait on the
 * user or are past due. Same past-due rule as the daily notification (`notifyPastDueItems`).
 */
export async function listWaitingOnYouItems(
  prisma: Db,
  scope: { spaceId: string; userId: string },
  now = new Date(),
  limit = 50,
): Promise<WaitingOnYouItem[]> {
  const rows = await prisma.scratchpadItem.findMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      status: { in: ["open", "parked"] },
      bot: { archivedAt: null },
      OR: [
        { dueAt: { lt: now } },
        ...WAITING_ON_SELF.flatMap((word) => [
          { waitingOn: { equals: word, mode: "insensitive" as const } },
          { waitingOn: { startsWith: `${word} `, mode: "insensitive" as const } },
        ]),
      ],
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      botId: true,
      title: true,
      status: true,
      waitingOn: true,
      dueAt: true,
      bot: { select: { name: true } },
    },
  });
  return rows.map(({ bot, ...row }) => ({ ...row, botName: bot.name }));
}
