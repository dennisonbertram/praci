import type { AdapterContext, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { GMAIL_SETTINGS_BASIC } from "./google-connector.js";

/**
 * Whether a connected mail account can have Gmail filters made for it. Only the account's own Google
 * login can (`connectorId` "google"), and only after it was granted gmail.settings.basic, which the
 * connection's metadata records. Connections made before the scope was stored read as needing it.
 */
export function senderRulesState(
  connectorId: string,
  metadata: Record<string, unknown> | null | undefined,
): "ready" | "needs_permission" | "unsupported" {
  if (connectorId !== "google") return "unsupported";
  const scope = metadata?.scope;
  return typeof scope === "string" && scope.split(" ").includes(GMAIL_SETTINGS_BASIC)
    ? "ready"
    : "needs_permission";
}

/** Where a skipped sender's Gmail filter stands. Null in the database: Rakazo-side only. */
export type SenderRuleStatus = "active" | "pending" | "full" | "failed";

export interface SenderRuleDeps {
  prisma: PrismaClient;
  mail: MailProvider;
  /** MAIL_WRITES_DISABLED: no filter is created or deleted. */
  writesDisabled?: boolean;
}

/** Decisions the sync job gives a filter per run, so one sync cannot spend the account's quota. */
const PENDING_PER_RUN = 20;

const rejected = (error: unknown) => (error instanceof MailProviderError ? error.kind : "error");

/**
 * Makes the Gmail filter for a sender the user chose to skip, and records the outcome on the
 * decision. Returns the new status, or null when nothing applies: no skip decision, a route that
 * cannot hold filters, a sender marked important (Gmail would archive mail Rakazo keeps), or writes
 * switched off. Without the permission the status is `pending` until the account is reconnected.
 * A rule call that fails with `auth` means that permission is missing, so it never marks the
 * account as needing a reconnect.
 */
export async function ensureSenderRule(
  deps: SenderRuleDeps,
  account: MailAccount,
  context: AdapterContext,
  address: string,
): Promise<SenderRuleStatus | null> {
  if (deps.writesDisabled) return null;
  const { prisma, mail } = deps;
  const { spaceId, userId } = account;
  if (spaceId !== context.spaceId || userId !== context.userId) return null;
  const scope = { spaceId, userId, connectionId: account.id };
  const decision = await prisma.mailSenderDecision.findFirst({
    where: { ...scope, senderAddress: address, skipInboxAt: { not: null } },
  });
  if (!decision) return null;
  const store = (data: { ruleId?: string | null; ruleStatus: SenderRuleStatus | null }) =>
    prisma.mailSenderDecision.updateMany({
      where: { id: decision.id, ...scope, ruleId: null },
      data,
    });
  if (decision.ruleId) return "active";
  if (account.senderRules !== "ready" && account.senderRules !== "needs_permission") return null;
  const important = await prisma.inboxSenderFeedback.findFirst({
    where: { spaceId, userId, senderAddress: address, mark: "important" },
    select: { id: true },
  });
  if (important) {
    if (decision.ruleStatus === "pending") await store({ ruleStatus: null });
    return null;
  }
  if (account.senderRules === "needs_permission") {
    await store({ ruleStatus: "pending" });
    return "pending";
  }
  if (!mail.createSenderRule) return null;

  try {
    const made = await mail.createSenderRule(account, { from: address, skipInbox: true }, context);
    if (!made) return null;
    // A concurrent call may have stored its filter first. Delete ours so there is only one.
    const stored = await store({ ruleId: made.created ? made.ruleId : null, ruleStatus: "active" });
    if (stored.count === 0 && made.created)
      await mail.deleteSenderRule?.(account, made.ruleId, context).catch(() => undefined);
    return "active";
  } catch (error) {
    getLogger().warn("sender rule failed", { connectionId: account.id, reason: rejected(error) });
    const kind = error instanceof MailProviderError ? error.kind : undefined;
    const ruleStatus: SenderRuleStatus =
      kind === "limit" ? "full" : kind === "auth" ? "pending" : "failed";
    await store({ ruleStatus });
    return ruleStatus;
  }
}

/**
 * Deletes the Gmail filters of these decisions and clears them from the rows. A filter that is
 * already gone counts as removed, and so does one Rakazo can no longer manage (`auth`: the
 * permission was withdrawn). Any other failure counts in `failed`, so the caller can keep the
 * decision and let the user retry. Decisions without a `ruleId` need nothing.
 */
export async function removeSenderRules(
  deps: SenderRuleDeps,
  account: MailAccount | undefined,
  context: AdapterContext,
  decisions: Array<{ id: string; ruleId: string | null }>,
): Promise<{ failed: number }> {
  const withRule = decisions.flatMap((d) => (d.ruleId ? [{ id: d.id, ruleId: d.ruleId }] : []));
  if (withRule.length === 0) return { failed: 0 };
  if (deps.writesDisabled) return { failed: withRule.length };
  const { prisma, mail } = deps;
  if (!account || !mail.deleteSenderRule) return { failed: 0 };
  const removed: string[] = [];
  let failed = 0;
  for (const { id, ruleId } of withRule) {
    try {
      await mail.deleteSenderRule(account, ruleId, context);
      removed.push(id);
    } catch (error) {
      if (error instanceof MailProviderError && error.kind === "auth") removed.push(id);
      else {
        failed += 1;
        getLogger().warn("sender rule delete failed", {
          connectionId: account.id,
          reason: rejected(error),
        });
      }
    }
  }
  if (removed.length > 0)
    await prisma.mailSenderDecision.updateMany({
      where: {
        id: { in: removed },
        spaceId: account.spaceId,
        userId: account.userId,
        connectionId: account.id,
      },
      data: { ruleId: null, ruleStatus: null },
    });
  return { failed };
}

/**
 * Makes the filters that were waiting for permission, once the account has it. Runs after a sync,
 * at most 20 decisions a run. Stops at the first sender that still cannot get one (quota full or
 * permission withdrawn), because the rest would fail the same way. Returns how many it made.
 */
export async function applyPendingSenderRules(
  deps: SenderRuleDeps,
  account: MailAccount,
  context: AdapterContext,
): Promise<number> {
  if (deps.writesDisabled || account.senderRules !== "ready") return 0;
  const waiting = await deps.prisma.mailSenderDecision.findMany({
    where: {
      spaceId: account.spaceId,
      userId: account.userId,
      connectionId: account.id,
      ruleStatus: "pending",
      ruleId: null,
      skipInboxAt: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: PENDING_PER_RUN,
  });
  let made = 0;
  for (const decision of waiting) {
    if (context.signal.aborted) break;
    const status = await ensureSenderRule(deps, account, context, decision.senderAddress);
    if (status === "active") made += 1;
    else if (status === "full" || status === "pending") break;
  }
  return made;
}
