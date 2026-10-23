import {
  isCartaAgentSpawnKey,
  isCompanyAgentSpawnKey,
  isCompanyImporterSpawnKey,
  isDataRoomAgentSpawnKey,
  isFinanceAgentSpawnKey,
  isInboxAgentSpawnKey,
  isInvestorsAgentSpawnKey,
  isLegalAgentSpawnKey,
} from "@rakazo/contracts";
import type { NotificationEvents, PrismaClient } from "@rakazo/db";
import { createNotification, NotificationValidationError } from "@rakazo/db";

/** The sidebar page the agent owns, else its chat. */
export function defaultNotificationSurface(spawnKey: string | null | undefined): string {
  if (isInboxAgentSpawnKey(spawnKey)) return "inbox";
  if (isFinanceAgentSpawnKey(spawnKey)) return "finance";
  if (isLegalAgentSpawnKey(spawnKey)) return "legal";
  if (isCartaAgentSpawnKey(spawnKey) || isInvestorsAgentSpawnKey(spawnKey)) return "investors";
  if (isDataRoomAgentSpawnKey(spawnKey)) return "data-room";
  if (isCompanyAgentSpawnKey(spawnKey) || isCompanyImporterSpawnKey(spawnKey)) return "company";
  return "thread";
}

type NotifyRun = {
  id: string;
  spaceId: string;
  userId: string;
  threadId: string;
  routineId: string | null;
};

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * The `notify_user` tool. The recipient is always the run's own space and user; the model only
 * picks the content. A routine with notify off still stores the notification (the sidebar dot),
 * but as `info`, so it never toasts or reaches a phone.
 */
export async function runNotifyUser(
  prisma: Pick<PrismaClient, "notification" | "notificationDelivery" | "routine" | "$transaction">,
  events: NotificationEvents | undefined,
  run: NotifyRun,
  bot: { id: string; spawnKey: string | null },
  args: Record<string, unknown>,
): Promise<{ ok: true; note: string } | { error: string }> {
  const routine = run.routineId
    ? await prisma.routine.findUnique({ where: { id: run.routineId }, select: { notify: true } })
    : null;
  const requested = args.importance === "attention" ? "attention" : "info";
  const importance = routine && !routine.notify ? "info" : requested;
  const surface = text(args.surface)?.trim() || defaultNotificationSurface(bot.spawnKey);
  try {
    const result = await createNotification(prisma, {
      spaceId: run.spaceId,
      userId: run.userId,
      botId: bot.id,
      routineId: run.routineId,
      runId: run.id,
      surface,
      threadId: surface === "thread" ? run.threadId : null,
      title: text(args.title) ?? "",
      body: text(args.body),
      link: text(args.link) || null,
      importance,
      kind: importance === "attention" ? "urgent" : "new",
      dedupeKey: text(args.dedupeKey) || undefined,
    });
    if (result.status === "created") {
      const { id, importance: stored } = result.notification;
      await events?.notify(
        { spaceId: run.spaceId, userId: run.userId },
        { id, surface, importance: stored },
      );
      return { ok: true, note: "Notification sent." };
    }
    if (result.status === "deduped") {
      return { ok: true, note: "Already notified recently; nothing sent." };
    }
    return { error: "Rate limited, do not retry." };
  } catch (error) {
    if (error instanceof NotificationValidationError) return { error: error.message };
    throw error;
  }
}
