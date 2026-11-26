import type { ApprovalActionType, ApprovalChoice, PermissionLevel } from "@rakazo/contracts";
import { buildApprovalTable, CHOICE_TO_EFFECT } from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import { isUniqueViolation } from "./prisma-errors.js";

export type ApprovalRuleEffect = "always_allow" | "require_approval" | "block";
export type ApprovalRuleKind = "tool" | "connector" | "category" | "site";

type Db = PrismaClient | Prisma.TransactionClient;
type Scope = { spaceId: string; userId: string; botId?: string | null; routineId?: string | null };
type Target = Scope & { matchKind: ApprovalRuleKind; matchValue: string };

/** Rules saved before the table used these names for two of its action types. */
const LEGACY_ALIASES: Partial<Record<ApprovalActionType, string>> = {
  send_email: "email",
  spend_money: "purchase",
};

const targetWhere = (target: Target, matchValues: string[]) => ({
  spaceId: target.spaceId,
  createdByUserId: target.userId,
  botId: target.botId ?? null,
  routineId: target.routineId ?? null,
  matchKind: target.matchKind,
  OR: matchValues.map((value) => ({ matchValue: { equals: value, mode: "insensitive" as const } })),
});

/**
 * Replaces any rule for the same space, user, bot and match, whatever its effect, in one
 * transaction. The unique index `action_approval_rules_target_key` backs this: a concurrent
 * writer that loses the race retries once and then wins by replacing.
 */
export async function setApprovalRule(db: Db, input: Target & { effect: ApprovalRuleEffect }) {
  const replace = async (tx: Prisma.TransactionClient) => {
    await tx.actionApprovalRule.deleteMany({ where: targetWhere(input, [input.matchValue]) });
    return tx.actionApprovalRule.create({
      data: {
        spaceId: input.spaceId,
        createdByUserId: input.userId,
        botId: input.botId ?? null,
        routineId: input.routineId ?? null,
        effect: input.effect,
        matchKind: input.matchKind,
        matchValue: input.matchValue,
      },
    });
  };
  // Inside a caller's transaction the caller owns atomicity and retries.
  const run = () => ("$transaction" in db ? db.$transaction(replace) : replace(db));
  try {
    return await run();
  } catch (error) {
    if (!isUniqueViolation(error) || !("$transaction" in db)) throw error;
    return run();
  }
}

/** Removes the rule for a target. Used by "Same as all bots" and by resetting a space row. */
export async function clearApprovalRule(prisma: Db, target: Target): Promise<void> {
  await prisma.actionApprovalRule.deleteMany({ where: targetWhere(target, [target.matchValue]) });
}

/** Space-wide rules, plus the bot's own rules when `botId` is given. Other bots' rules never appear. */
export function listApprovalRules(prisma: Db, scope: Scope) {
  return prisma.actionApprovalRule.findMany({
    where: {
      spaceId: scope.spaceId,
      createdByUserId: scope.userId,
      routineId: null,
      OR: scope.botId ? [{ botId: null }, { botId: scope.botId }] : [{ botId: null }],
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Tools the owner chose "Always for this routine" for. Only that routine's runs read them. */
export async function listRoutineToolAllows(
  prisma: Db,
  scope: { spaceId: string; userId: string; routineId: string },
): Promise<Set<string>> {
  const rows = await prisma.actionApprovalRule.findMany({
    where: {
      spaceId: scope.spaceId,
      createdByUserId: scope.userId,
      routineId: scope.routineId,
      matchKind: "tool",
      effect: "always_allow",
    },
    select: { matchValue: true },
  });
  return new Set(rows.map((row) => row.matchValue));
}

/** Sets one row of the approvals table; `null` clears the bot override or resets the space row. */
export async function setActionTypeChoice(
  prisma: PrismaClient,
  input: Scope & { actionType: ApprovalActionType; choice: ApprovalChoice | null },
): Promise<void> {
  const base = { ...input, matchKind: "category" as const, matchValue: input.actionType };
  const alias = LEGACY_ALIASES[input.actionType];
  if (alias) await clearApprovalRule(prisma, { ...base, matchValue: alias });
  if (input.choice === null) return clearApprovalRule(prisma, base);
  await setApprovalRule(prisma, { ...base, effect: CHOICE_TO_EFFECT[input.choice] });
}

/**
 * The space's stored permission level, read fresh so a change applies to the next call or write.
 * `null` in the row follows the deployment default; the callers resolve through
 * `resolvePermissionLevel`, which also owns the fail-closed answer for a failed read.
 */
export function loadSpacePermissionLevel(prisma: Db, scope: { spaceId: string; userId: string }) {
  return prisma.actionAutoReviewPreference.findUnique({
    where: { spaceId_userId: { spaceId: scope.spaceId, userId: scope.userId } },
    select: { permissionLevel: true },
  });
}

/**
 * The approvals table for the space, and for one bot's overrides when `botId` is given, as the
 * gate decides at `level`.
 */
export async function approvalTable(prisma: PrismaClient, scope: Scope, level?: PermissionLevel) {
  const rules = await listApprovalRules(prisma, scope);
  return buildApprovalTable(
    rules.map((rule) => ({
      effect: rule.effect as ApprovalRuleEffect,
      matchKind: rule.matchKind as ApprovalRuleKind,
      matchValue: rule.matchValue,
      botId: rule.botId,
    })),
    scope.botId ?? undefined,
    level,
  );
}
