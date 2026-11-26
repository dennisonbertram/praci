import { CHECK_IN_MANAGED_KIND, watchDay } from "@rakazo/core";
import type { Prisma, PrismaClient } from "@rakazo/db";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * True when the check-in routine already posted a message today (calendar day in the routine's
 * time zone). A check-in posts at most once per bot per day; a silent run posted nothing.
 */
export async function checkInPostedToday(
  db: Db,
  routine: { id: string; timezone: string },
  now: Date,
  /** The run asking, whose own messages (mid-turn updates) do not count. */
  exceptRunId?: string,
): Promise<boolean> {
  const runs = await db.run.findMany({
    where: {
      routineId: routine.id,
      ...(exceptRunId ? { id: { not: exceptRunId } } : {}),
      createdAt: { gte: new Date(now.getTime() - 48 * 3_600_000) },
    },
    select: { id: true },
  });
  if (runs.length === 0) return false;
  const messages = await db.message.findMany({
    where: { runId: { in: runs.map((run) => run.id) }, role: "bot" },
    select: { createdAt: true },
  });
  const today = watchDay(now, routine.timezone);
  return messages.some((message) => watchDay(message.createdAt, routine.timezone) === today);
}

/**
 * True when a check-in run is about to post a reply but its routine already posted today: the
 * run must end silently instead. The daily cap is also checked at wake time, but two check-in
 * runs can overlap, so the reply is the place that holds it.
 */
export async function checkInReplyIsOver(
  db: Db,
  run: { id: string; routineId: string | null },
  now: Date,
): Promise<boolean> {
  if (!run.routineId) return false;
  const routine = await db.routine.findUnique({
    where: { id: run.routineId },
    select: { id: true, timezone: true, managedKind: true },
  });
  return routine?.managedKind === CHECK_IN_MANAGED_KIND
    ? checkInPostedToday(db, routine, now, run.id)
    : false;
}
