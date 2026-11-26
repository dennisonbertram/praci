import type {
  ApprovalDecisionKind,
  ArgsShape,
  ClassificationTier,
  PastDecision,
} from "@rakazo/core/node/action-classifier";
import { PRECEDENT_WINDOW_DAYS, UNDO_PAUSE_DAYS } from "@rakazo/core/node/action-classifier";
import type { Prisma, PrismaClient } from "./client.js";

type Db = PrismaClient | Prisma.TransactionClient;
/** Whose decisions count: one user's, for one agent, in one space. Never shared across them. */
export type ApprovalDecisionScope = { spaceId: string; userId: string; botId: string };

/** Precedent belongs to a space owner: in a shared space, a member's runs never use it. */
export async function isSpaceOwner(db: Db, scope: { spaceId: string; userId: string }) {
  const member = await db.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: scope.spaceId, userId: scope.userId } },
    select: { role: true },
  });
  return member?.role === "owner";
}

/** Rows older than this are deleted by pruneApprovalDecisions. */
export const APPROVAL_DECISION_RETENTION_DAYS = 180;
/** A bound on the precedent query: far more than the threshold needs. */
const HISTORY_LIMIT = 200;

export type ApprovalDecisionInput = ApprovalDecisionScope & {
  tool: string;
  targetKey: string;
  decision: ApprovalDecisionKind;
  basis: string;
  decidedByUserId: string | null;
  cleanRun: boolean;
  tier: ClassificationTier;
  argsShape: ArgsShape;
  version: number;
  routineId?: string | null;
  runId?: string | null;
  effectId?: string | null;
  externalActionId?: string | null;
  connectorKind?: string | null;
  actionType?: string | null;
};

export async function recordApprovalDecision(db: Db, input: ApprovalDecisionInput) {
  const { argsShape, ...rest } = input;
  return db.approvalDecision.create({
    data: { ...rest, argsKeys: argsShape.keys, argsSize: argsShape.size },
  });
}

/** The past decisions classifyAction reads for this scope, tool and target, newest first. */
export async function listPastDecisions(
  db: Db,
  scope: ApprovalDecisionScope & { tool: string; targetKey: string },
  now = new Date(),
): Promise<PastDecision[]> {
  const rows = await db.approvalDecision.findMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      botId: scope.botId,
      tool: scope.tool,
      targetKey: scope.targetKey,
      createdAt: { gte: new Date(now.getTime() - PRECEDENT_WINDOW_DAYS * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      decision: true,
      decidedByUserId: true,
      cleanRun: true,
      argsKeys: true,
      argsSize: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    decision: row.decision as ApprovalDecisionKind,
    decidedByUserId: row.decidedByUserId,
    cleanRun: row.cleanRun,
    argsShape: { keys: row.argsKeys, size: row.argsSize },
    createdAt: row.createdAt,
  }));
}

/** Automatic approvals for one user in a space, newest first, for the "Approved automatically" list. */
export async function listAutoApprovals(
  db: Db,
  scope: { spaceId: string; userId: string },
  limit = 50,
) {
  return db.approvalDecision.findMany({
    where: { spaceId: scope.spaceId, userId: scope.userId, decision: "auto_approved" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function pruneApprovalDecisions(db: Db, now = new Date()) {
  const before = new Date(now.getTime() - APPROVAL_DECISION_RETENTION_DAYS * 86_400_000);
  return (await db.approvalDecision.deleteMany({ where: { createdAt: { lt: before } } })).count;
}

/**
 * Records a person's answer to an approval card. The classification stored when the card was
 * shown (an `auto_asked` row for the effect) supplies the target and whether the run was clean;
 * without one the answer is kept but never counts as precedent.
 */
export async function recordAnsweredApproval(
  db: Db,
  input: ApprovalDecisionScope & {
    effectId: string;
    tool: string;
    decision: "approved" | "denied";
    decidedByUserId: string;
    runId?: string | null;
    routineId?: string | null;
  },
) {
  const asked = await db.approvalDecision.findFirst({
    where: {
      spaceId: input.spaceId,
      userId: input.userId,
      botId: input.botId,
      effectId: input.effectId,
      decision: "auto_asked",
    },
    orderBy: { createdAt: "desc" },
  });
  return recordApprovalDecision(db, {
    spaceId: input.spaceId,
    userId: input.userId,
    botId: input.botId,
    effectId: input.effectId,
    runId: input.runId ?? null,
    routineId: input.routineId ?? null,
    tool: input.tool,
    targetKey: asked?.targetKey ?? `${input.tool}:unclassified`,
    decision: input.decision,
    basis: "person",
    decidedByUserId: input.decidedByUserId,
    cleanRun: asked?.cleanRun ?? false,
    tier: (asked?.tier as ClassificationTier | undefined) ?? "irreversible",
    argsShape: { keys: asked?.argsKeys ?? [], size: asked?.argsSize ?? 0 },
    version: asked?.version ?? 0,
    connectorKind: asked?.connectorKind ?? null,
    actionType: asked?.actionType ?? null,
  });
}

/**
 * Records an Undo of an approved or automatically approved call, found by its effect. It resets
 * that target's precedent and pauses the tool's (UNDO_PAUSE_DAYS). Nothing is written for an
 * effect the log never saw.
 */
export async function recordUndoneApproval(
  db: Db,
  input: { spaceId: string; userId: string; effectId: string },
) {
  const decided = await db.approvalDecision.findFirst({
    where: {
      spaceId: input.spaceId,
      userId: input.userId,
      effectId: input.effectId,
      decision: { in: ["approved", "auto_approved"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!decided) return null;
  return recordApprovalDecision(db, {
    spaceId: decided.spaceId,
    userId: decided.userId,
    botId: decided.botId,
    effectId: decided.effectId,
    runId: decided.runId,
    routineId: decided.routineId,
    tool: decided.tool,
    targetKey: decided.targetKey,
    decision: "undone",
    basis: "person",
    decidedByUserId: input.userId,
    cleanRun: decided.cleanRun,
    tier: decided.tier as ClassificationTier,
    argsShape: { keys: decided.argsKeys, size: decided.argsSize },
    version: decided.version,
    connectorKind: decided.connectorKind,
    actionType: decided.actionType,
  });
}

/** The latest Undo of a tool on any target in this scope, inside the pause window. */
export async function lastToolUndo(
  db: Db,
  scope: ApprovalDecisionScope & { tool: string },
  now = new Date(),
): Promise<Date | null> {
  const row = await db.approvalDecision.findFirst({
    where: {
      ...scope,
      decision: "undone",
      createdAt: { gte: new Date(now.getTime() - UNDO_PAUSE_DAYS * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
