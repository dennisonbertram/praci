import type { AdapterContext, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { firewallDraftIsFree } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { parseRecipients } from "./mail-compose.js";
import { accountName, findAccount, inferMailAccount } from "./mail-tools.js";

type GrantRow = {
  id: string;
  allAgents: boolean;
  botAccess: { botId: string; supportLabel?: string | null }[];
};

/** What a firewalled agent's mail call needs from its run. */
export type FirewallMailDeps = {
  prisma: PrismaClient;
  mail: Pick<MailProvider, "getMessage" | "listLabels">;
  context: AdapterContext;
  owner: { spaceId: string; userId: string };
  botId: string;
  /** Accounts this run can see (already limited to connections granted to the agent). */
  accounts: MailAccount[];
  /**
   * The connection rows exactly as stored (with `allAgents`). `botAccess` holds the effective
   * grantor's rows: the agent's own, or the Inbox agent's for a mail-thread agent.
   */
  rows: GrantRow[];
};

export type FirewallMailDecision =
  | { free: true; args: Record<string, unknown>; labelIds: Record<string, string> }
  | { free: false };

const ASK: FirewallMailDecision = { free: false };

type Scope = "unresolved" | { labelId?: string; label?: string };

/**
 * The support scope of each visible account, from the effective grant (never matched on this
 * agent's id, so a mail-thread agent reads the Inbox agent's grant). An account whose grant is
 * missing, or whose label does not exist on the mailbox, is "unresolved" and fails closed.
 */
type ScopeDeps = Pick<FirewallMailDeps, "mail" | "context" | "accounts" | "rows">;

async function scopes(deps: ScopeDeps): Promise<Map<string, Scope>> {
  const result = new Map<string, Scope>();
  for (const account of deps.accounts) {
    const grant = deps.rows.find((row) => row.id === account.id)?.botAccess[0];
    if (!grant) result.set(account.id, "unresolved");
    else if (!grant.supportLabel) result.set(account.id, {});
    else {
      try {
        const wanted = grant.supportLabel.toLowerCase();
        const labels = await deps.mail.listLabels(account, deps.context);
        const found = labels.find((label) => label.name.toLowerCase() === wanted);
        result.set(
          account.id,
          found ? { labelId: found.id, label: grant.supportLabel } : "unresolved",
        );
      } catch {
        result.set(account.id, "unresolved");
      }
    }
  }
  return result;
}

async function messageHasLabel(
  deps: Pick<FirewallMailDeps, "mail" | "context">,
  account: MailAccount,
  id: string,
  labelId: string,
): Promise<boolean> {
  try {
    return (await deps.mail.getMessage(account, id, deps.context)).labelIds.includes(labelId);
  } catch {
    return false;
  }
}

async function accountFor(
  deps: Pick<FirewallMailDeps, "prisma" | "owner" | "accounts">,
  args: Record<string, unknown>,
) {
  if (typeof args.account === "string" && args.account.trim()) {
    return findAccount(deps.accounts, args.account);
  }
  return inferMailAccount(deps.prisma, deps.owner, deps.accounts, args);
}

/** The searchId's results were all filtered by the account's current support label. */
async function searchStaysInScope(
  deps: FirewallMailDeps,
  scope: Map<string, Scope>,
  searchId: unknown,
): Promise<boolean> {
  if (typeof searchId !== "string" || !searchId) return true;
  const search = await deps.prisma.mailSearch.findFirst({
    where: { id: searchId, ...deps.owner, botId: deps.botId },
    select: { summary: true },
  });
  if (!search) return true;
  const summary = search.summary as {
    perQuery?: { account?: unknown }[];
    scopedLabels?: Record<string, string>;
  } | null;
  return (summary?.perQuery ?? []).every((entry) => {
    const account = deps.accounts.find((a) => accountName(a) === entry.account);
    // An account the agent can no longer use fails closed.
    if (!account) return false;
    const own = scope.get(account.id);
    if (own === "unresolved") return false;
    return !own?.labelId || summary?.scopedLabels?.[accountName(account)] === own.labelId;
  });
}

/**
 * The support scope, per call. An account whose grant names a label may be read only inside that
 * label. A search is filtered by the provider's label id (never by query text, which a model can
 * close and escape), and `mail_search` drops any message that lacks the label. A message must
 * carry the label; anything that cannot be shown to stay inside it asks.
 */
export async function firewallMailReadDecision(
  name: string,
  args: Record<string, unknown>,
  deps: FirewallMailDeps,
): Promise<FirewallMailDecision> {
  const scope = await scopes(deps);
  const labelIds: Record<string, string> = {};
  for (const [id, entry] of scope)
    if (entry !== "unresolved" && entry.labelId) labelIds[id] = entry.labelId;
  const free = (next = args): FirewallMailDecision => ({ free: true, args: next, labelIds });
  const unresolved = (account?: MailAccount) =>
    account ? scope.get(account.id) === "unresolved" : [...scope.values()].includes("unresolved");
  if (name === "inbox_overview") {
    return Object.keys(labelIds).length > 0 || unresolved() ? ASK : free();
  }
  if (name === "mail_grep") {
    return (await searchStaysInScope(deps, scope, args.searchId)) ? free() : ASK;
  }
  if (name === "mail_search") {
    if (typeof args.continueFrom === "string" && args.continueFrom) {
      return (await searchStaysInScope(deps, scope, args.continueFrom)) ? free() : ASK;
    }
    const targets =
      typeof args.account === "string" && args.account.trim()
        ? [await accountFor(deps, args)]
        : deps.accounts;
    if (targets.some((account) => !account)) return free();
    return targets.some((account) => unresolved(account)) ? ASK : free();
  }
  if (name === "mail_get") {
    const account = await accountFor(deps, args);
    if (!account) return free();
    if (unresolved(account)) return ASK;
    const labelId = labelIds[account.id];
    if (!labelId) return free();
    return typeof args.id === "string" && (await messageHasLabel(deps, account, args.id, labelId))
      ? free()
      : ASK;
  }
  if (name === "show_emails") {
    const ids = (Array.isArray(args.emails) ? args.emails : [])
      .map((email) => (email as { id?: unknown } | null)?.id)
      .filter((id): id is string => typeof id === "string");
    const cached = await deps.prisma.cachedMailMessage.findMany({
      where: {
        ...deps.owner,
        providerMessageId: { in: ids },
        connectionId: { in: deps.accounts.map((account) => account.id) },
      },
      select: { providerMessageId: true, connectionId: true },
    });
    for (const id of ids) {
      const row = cached.find((entry) => entry.providerMessageId === id);
      const account = deps.accounts.find((a) => a.id === row?.connectionId);
      if (!account || unresolved(account)) return ASK;
      const labelId = labelIds[account.id];
      if (labelId && !(await messageHasLabel(deps, account, id, labelId))) return ASK;
    }
    return free();
  }
  return free();
}

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Every address in the fields, split by the parser the draft handler uses. Throws on a bad entry. */
const addressesOf = (value: unknown) =>
  parseRecipients(strings(value).join(", ")).map((entry) => entry.address);

/** Everyone who took part in a thread, from its synced messages. */
export const threadParticipants = (
  messages: { fromAddress: string | null; toAddresses: string[]; ccAddresses: string[] }[],
) =>
  messages.flatMap((m) => [
    ...(m.fromAddress ? [m.fromAddress] : []),
    ...(m.toAddresses ?? []),
    ...(m.ccAddresses ?? []),
  ]);

/**
 * A draft is free when everyone it goes to already took part in the thread it answers and it has
 * no link. The thread is read from synced mail; a reply to a message that is not synced asks.
 */
export async function firewallDraftIsWithinThread(
  args: Record<string, unknown>,
  deps: Pick<FirewallMailDeps, "prisma" | "owner" | "accounts" | "mail" | "context" | "rows">,
): Promise<boolean> {
  const replyTo = typeof args.replyToId === "string" ? args.replyToId.trim() : "";
  // Changing a saved draft could change one the owner already approved.
  if (!replyTo || (typeof args.draftId === "string" && args.draftId.trim())) return false;
  const account = await accountFor(deps, args).catch(() => undefined);
  if (!account) return false;
  // A labelled grant frees only a reply to a message already inside the label.
  const scope = (await scopes(deps)).get(account.id);
  if (scope === undefined || scope === "unresolved") return false;
  if (scope.labelId && !(await messageHasLabel(deps, account, replyTo, scope.labelId)))
    return false;
  const row = await deps.prisma.cachedMailMessage.findFirst({
    where: { ...deps.owner, providerMessageId: replyTo, connectionId: account.id },
    select: { threadId: true, connectionId: true },
  });
  if (!row) return false;
  const messages = await deps.prisma.cachedMailMessage.findMany({
    where: { ...deps.owner, connectionId: row.connectionId, threadId: row.threadId },
    select: { fromAddress: true, toAddresses: true, ccAddresses: true },
  });
  try {
    return firewallDraftIsFree({
      to: addressesOf(args.to),
      cc: addressesOf(args.cc),
      bcc: addressesOf(args.bcc),
      body: typeof args.body === "string" ? args.body : "",
      participants: threadParticipants(messages),
    });
  } catch {
    return false;
  }
}

/**
 * mail_modify is free only on a connection this agent's effective grantor alone holds (never one
 * shared with all agents), on a message already inside the support label, and never when it adds or
 * removes the support label itself.
 */
export async function firewallModifyIsFree(
  args: Record<string, unknown>,
  deps: FirewallMailDeps,
): Promise<boolean> {
  const account = await accountFor(deps, args);
  const row = deps.rows.find((candidate) => candidate.id === account?.id);
  const grant = row?.botAccess[0];
  if (!account || !row || !grant || row.allAgents) return false;
  const others = await deps.prisma.botConnectionAccess.count({
    where: { connectionId: row.id, botId: { not: grant.botId } },
  });
  if (others > 0) return false;
  const scope = (await scopes(deps)).get(account.id);
  if (scope === undefined || scope === "unresolved") return false;
  if (!scope.labelId) return true;
  // Archiving removes INBOX and marking read removes UNREAD, which matters when the support
  // label is one of those system labels.
  const named = [
    ...strings(args.addLabels),
    ...strings(args.removeLabels),
    ...(typeof args.archive === "boolean" ? ["INBOX"] : []),
    ...(typeof args.read === "boolean" ? ["UNREAD"] : []),
  ].map((l) => l.trim().toLowerCase());
  if (named.includes(scope.label!.toLowerCase()) || named.includes(scope.labelId.toLowerCase())) {
    return false;
  }
  if (typeof args.id !== "string") return false;
  // The change applies to the whole conversation, so every message of it must be in scope. The
  // conversation is read from synced mail; one that is not synced asks.
  const known = await deps.prisma.cachedMailMessage.findFirst({
    where: { ...deps.owner, providerMessageId: args.id, connectionId: account.id },
    select: { threadId: true, connectionId: true },
  });
  if (!known) return false;
  const thread = await deps.prisma.cachedMailMessage.findMany({
    where: { ...deps.owner, connectionId: known.connectionId, threadId: known.threadId },
    select: { providerMessageId: true },
  });
  const ids = new Set([
    args.id,
    ...thread.map((row) => row.providerMessageId).filter((id): id is string => Boolean(id)),
  ]);
  for (const id of ids) {
    if (!(await messageHasLabel(deps, account, id, scope.labelId))) return false;
  }
  return true;
}
