import { ORPCError } from "@orpc/server";
import type { Actor, AutoApproval } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { listAutoApprovals, recordUndoneApproval } from "@rakazo/db";

/** The tools' own undo paths: the inbox action log for mail, restore for an archived agent. */
export type AutoApprovalUndoDeps = {
  prisma: PrismaClient;
  undoMail: (actor: Actor, batchId: string) => Promise<{ failed: number }>;
  restoreBot: (actor: Actor, botId: string) => Promise<void>;
};

const notFound = () => new ORPCError("NOT_FOUND", { message: "Approval not found" });

function stringArg(request: unknown, key: string) {
  if (!request || typeof request !== "object") return null;
  const value = (request as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

/** The caller's automatic approvals in their space, newest first, each with whether Undo works. */
export async function listAutoApprovalRows(
  prisma: PrismaClient,
  actor: Actor,
): Promise<AutoApproval[]> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const rows = await listAutoApprovals(prisma, scope);
  if (rows.length === 0) return [];
  const effectIds = rows.flatMap((row) => (row.effectId ? [row.effectId] : []));
  const [undone, effects, logs, bots] = await Promise.all([
    prisma.approvalDecision.findMany({
      where: { ...scope, decision: "undone", effectId: { in: effectIds } },
      select: { effectId: true },
    }),
    prisma.externalEffect.findMany({
      where: { id: { in: effectIds }, spaceId: actor.spaceId },
      select: { id: true, request: true },
    }),
    prisma.mailActionLog.findMany({
      where: { ...scope, effectId: { in: effectIds } },
      select: { effectId: true, undoneAt: true, connectionId: true, threadIds: true },
    }),
    prisma.bot.findMany({
      where: { spaceId: actor.spaceId, id: { in: [...new Set(rows.map((row) => row.botId))] } },
      select: { id: true, name: true, archivedAt: true },
    }),
  ]);
  const undoneIds = new Set(undone.map((row) => row.effectId));
  const requestOf = new Map(effects.map((effect) => [effect.id, effect.request]));
  const logOf = new Map(logs.map((log) => [log.effectId, log]));
  const threads = logs.flatMap((log) =>
    log.threadIds[0] ? [{ connectionId: log.connectionId, threadId: log.threadIds[0] }] : [],
  );
  const subjects = threads.length
    ? await prisma.cachedMailMessage.findMany({
        where: { ...scope, OR: threads },
        select: { connectionId: true, threadId: true, subject: true },
      })
    : [];
  const subjectOf = new Map(
    subjects.map((row) => [`${row.connectionId}:${row.threadId}`, row.subject]),
  );
  const extraBotIds = effects.flatMap((effect) => {
    const botId = stringArg(effect.request, "botId");
    return botId && !bots.some((bot) => bot.id === botId) ? [botId] : [];
  });
  const targetBots = extraBotIds.length
    ? await prisma.bot.findMany({
        where: { spaceId: actor.spaceId, id: { in: extraBotIds } },
        select: { id: true, name: true, archivedAt: true },
      })
    : [];
  const botOf = new Map([...bots, ...targetBots].map((bot) => [bot.id, bot]));

  return rows.map((row) => {
    const request = row.effectId ? requestOf.get(row.effectId) : undefined;
    const log = row.effectId ? logOf.get(row.effectId) : undefined;
    const isUndone = row.effectId ? undoneIds.has(row.effectId) : false;
    let target: string | null = null;
    let undoable = false;
    if (row.tool === "mail_modify" && log) {
      target = subjectOf.get(`${log.connectionId}:${log.threadIds[0]}`) ?? null;
      undoable = !log.undoneAt;
    } else if (row.tool === "archive_bot") {
      const bot = botOf.get(stringArg(request, "botId") ?? "");
      target = bot?.name ?? null;
      undoable = Boolean(bot?.archivedAt);
    } else {
      target = stringArg(request, "path") ?? stringArg(request, "title");
    }
    return {
      id: row.id,
      tool: row.tool,
      botName: botOf.get(row.botId)?.name ?? "",
      target,
      at: row.createdAt.toISOString(),
      undoable: undoable && !isUndone,
      undone: isUndone,
    };
  });
}

/**
 * Reverts one automatic approval through the tool's own undo, then records `undone` so that
 * target's precedent resets. Only the caller's own rows in their space can be found.
 */
export async function undoAutoApproval(
  deps: AutoApprovalUndoDeps,
  actor: Actor,
  id: string,
): Promise<{ ok: true }> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const row = await deps.prisma.approvalDecision.findFirst({
    where: { ...scope, id, decision: "auto_approved" },
  });
  if (!row?.effectId) throw notFound();
  const effectId = row.effectId;
  if (row.tool === "mail_modify") {
    const log = await deps.prisma.mailActionLog.findFirst({
      where: { ...scope, effectId, undoneAt: null },
      select: { batchId: true },
    });
    if (!log) throw notFound();
    // The inbox undo records `undone` itself once every thread is back.
    const result = await deps.undoMail(actor, log.batchId);
    if (result.failed > 0)
      throw new ORPCError("BAD_REQUEST", { message: "Some mail could not be put back." });
    return { ok: true };
  }
  if (row.tool === "archive_bot") {
    const effect = await deps.prisma.externalEffect.findFirst({
      where: { id: effectId, spaceId: actor.spaceId },
      select: { request: true },
    });
    const botId = stringArg(effect?.request, "botId");
    if (!botId) throw notFound();
    const undone = await deps.prisma.approvalDecision.findFirst({
      where: { ...scope, effectId, decision: "undone" },
      select: { id: true },
    });
    if (undone) throw notFound();
    await deps.restoreBot(actor, botId);
    await recordUndoneApproval(deps.prisma, { ...scope, effectId });
    return { ok: true };
  }
  throw new ORPCError("BAD_REQUEST", { message: "This action cannot be undone here." });
}
