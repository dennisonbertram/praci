import type {
  AdapterContext,
  ConnectorTool,
  JobPublisher,
  MailAccount,
  MailAddress,
  MailDraftInput,
  MailLabelChange,
  MailMessageSummary,
  MailProvider,
  ToolProgress,
} from "@rakazo/adapter-kit";
import { MailProviderError, mailSearchExpireJob } from "@rakazo/adapter-kit";
import type { EmailCard, MessageBlock } from "@rakazo/contracts";
import { EmailUrgency, MAX_EMAIL_CARDS } from "@rakazo/contracts";
import type { MailQueryOutcome, MailResultRow } from "@rakazo/core";
import {
  clampInt,
  createGrepScan,
  isLiteralOnly,
  normalizePatterns,
  resultRow,
  stripQuotedReply,
  summarizeResults,
  triageUrgency,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { withRetryProgress } from "./google-api-request.js";
import { inboxOverview } from "./inbox-overview.js";
import { buildRawMessage, parseRecipients } from "./mail-compose.js";
import { syncAfterSend } from "./mail-sync-job.js";

export const MAIL_TOOL_NAMES = new Set([
  "mail_search",
  "mail_grep",
  "mail_get",
  "show_emails",
  "inbox_overview",
  "mail_draft",
  "mail_modify",
  "mail_send",
]);

const SEARCH_TTL_MS = 24 * 3_600_000;
const EXPIRED_BACKSTOP_MS = 3_600_000;
const DEFAULT_DEADLINE_MS = 60_000;
const PAGE_SIZE = 500;
const GREP_BATCH = 500;
const MAX_QUERIES = 20;
const DEFAULT_MAX_MESSAGES = 1000;
const MAX_MESSAGES = 5000;
const MAX_BODY_CHARS = 40_000;
const DEFAULT_BODY_CHARS = 12_000;
const MIN_BODY_CHARS = 100;
const MAX_DATE_PREFIX = 40;

const NO_SEARCH = { error: "No such search results" };
const EXPIRED = { error: "Results expired; run mail_search again." };

export type MailToolDeps = {
  mail: MailProvider;
  prisma: PrismaClient;
  jobs: JobPublisher;
  /** Connected accounts of the bot owner. Memoized per run by the caller. */
  accounts: () => Promise<MailAccount[]>;
  /** From the run, never from model input. */
  scope: { spaceId: string; userId: string; botId: string };
  /** Puts blocks in the run's thread. Without it show_emails is unavailable. */
  publish?: (blocks: MessageBlock[]) => Promise<unknown>;
  /**
   * Called with the account right before each provider write, with nothing awaited between the
   * call and the write. A returned text refuses the write.
   */
  beforeWrite?: (account: MailAccount) => Promise<string | null>;
  /** MAIL_WRITES_DISABLED: the write tools change nothing. */
  writesDisabled?: boolean;
  /** Stable per tool call, from the run; mail_send keys its send record on it so a replay never sends twice. */
  idempotencyKey?: string;
  deadlineMs?: number;
  /** How long the inbox overview waits for the queued sync; defaults to 8 seconds. */
  syncWaitMs?: number;
  now?: () => Date;
  /** One line of what the tool is doing, for the owner's activity view. Never part of the result. */
  progress?: (progress: ToolProgress) => void;
};

const SUBJECT_LIMIT = 60;
const QUERY_LIMIT = 120;

const clip = (text: string, limit: number) => {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function readableDate(value: string, now: Date): string {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !month) return value;
  const year = Number(match[1]) === now.getUTCFullYear() ? "" : ` ${match[1]}`;
  return `${month} ${Number(match[3])}${year}`;
}

const DURATION_UNITS: Record<string, string> = { d: "day", m: "month", y: "year" };

/** A Gmail query in words: `from:kevin after:2026/10/01 "pick a time"` becomes `from kevin · after Oct 1 · "pick a time"`. */
export function describeMailQuery(query: string, now = new Date()): string {
  const parts: string[] = [];
  const words: string[] = [];
  const token = /(-?)(\w+):("[^"]*"|\S+)|"[^"]*"|\S+/g;
  for (const match of query.matchAll(token)) {
    const [whole, negate, key, raw] = match;
    if (!key || raw === undefined) {
      if (whole.startsWith('"')) parts.push(whole);
      else if (!["OR", "AND"].includes(whole)) words.push(whole);
      continue;
    }
    const value = raw.replaceAll('"', "");
    const lower = key.toLowerCase();
    let text: string;
    if (lower === "after" || lower === "before") text = `${lower} ${readableDate(value, now)}`;
    else if (lower === "newer_than" || lower === "older_than") {
      const unit = DURATION_UNITS[value.slice(-1)];
      const count = Number(value.slice(0, -1));
      const span = unit && count > 0 ? `${count} ${unit}${count > 1 ? "s" : ""}` : value;
      text = lower === "newer_than" ? `last ${span}` : `older than ${span}`;
    } else if (lower === "is") text = value;
    else if (lower === "has") text = `has ${value}`;
    else text = `${lower} ${value}`;
    parts.push(negate ? `not ${text}` : text);
  }
  if (words.length > 0) parts.push(`"${words.join(" ")}"`);
  return parts.join(" · ");
}

const found = (count: number) =>
  count === 0 ? "No matches" : `Found ${count} ${count === 1 ? "message" : "messages"}`;

/** Why a provider call failed, in words for the owner. */
function failureReason(error: unknown): string {
  if (!(error instanceof MailProviderError)) return "Gmail did not answer";
  if (error.kind === "rate_limited") return "Gmail is limiting requests";
  if (error.kind === "auth") return "Gmail needs to be reconnected";
  return "Gmail did not answer";
}

class WriteDenied extends Error {}

/** The context for a provider write: its retries ask again before each attempt. */
const writeContext = (
  deps: MailToolDeps,
  account: MailAccount,
  context: AdapterContext,
): AdapterContext => ({ ...context, beforeWrite: () => allowWrite(deps, account) });

async function allowWrite(deps: MailToolDeps, account: MailAccount) {
  const denial = await deps.beforeWrite?.(account);
  if (denial) throw new WriteDenied(denial);
}

/** A query that stopped early, with what is needed to carry on where it left off. */
type ResumeEntry = {
  accountId: string;
  query: string;
  unhydratedIds: string[];
  pageToken?: string;
};

/**
 * Runs the owner is behind: a direct message, a follow-up, their own routine, or one of their own taught skills or call wrap-ups. A bot_message run
 * (another agent asked, possibly from another account through an agent connection) is created under
 * the recipient owner's id but not started by them.
 */
export const OWNER_INITIATED_TRIGGERS = new Set([
  "user",
  "follow_up",
  "routine",
  "skill",
  "call_end",
]);

/** Owner only: the bot's owner started the run, in a direct thread, outside a messaging channel. */
export function mailToolsAllowed(options: {
  hasProvider: boolean;
  groupId: string | null;
  runUserId: string;
  botUserId: string;
  messagingChannelRun: boolean;
  /** The run trigger; bot_message runs are not owner-initiated. */
  trigger: string;
  /** An owner agent (Inbox, Calendar, Drive) answering a bot of the same owner with its own tools. */
  ownerAgentPeer?: boolean;
}): boolean {
  return (
    (OWNER_INITIATED_TRIGGERS.has(options.trigger) ||
      (options.trigger === "bot_message" && options.ownerAgentPeer === true)) &&
    options.hasProvider &&
    !options.groupId &&
    options.runUserId === options.botUserId &&
    !options.messagingChannelRun
  );
}

/** Drop the mail tools when the run may not use them. */
export function selectMailTools(tools: ConnectorTool[], mailEnabled: boolean): ConnectorTool[] {
  return mailEnabled ? tools : tools.filter((tool) => !MAIL_TOOL_NAMES.has(tool.name));
}

export async function mailToolFromTool(
  name: string,
  deps: MailToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    context = withRetryProgress(context, deps.progress, "Gmail");
    if (name === "mail_search") return await mailSearch(deps, context, args);
    if (name === "mail_grep") return await mailGrep(deps, args);
    if (name === "mail_get") return await mailGet(deps, context, args);
    if (name === "show_emails") return await showEmails(deps, context, args);
    if (name === "inbox_overview") return await inboxOverview(deps, context);
    if (name === "mail_draft") return await mailDraft(deps, context, args);
    if (name === "mail_modify") return await mailModify(deps, context, args);
    if (name === "mail_send") return await mailSend(deps, context, args);
    return { error: `Unknown mail tool ${name}` };
  } catch (error) {
    if (error instanceof WriteDenied) return { error: error.message };
    deps.progress?.({ text: `Failed: ${failureReason(error)}`, failed: true });
    // Provider errors carry sanitized text; anything else is not shown to the model.
    return { error: error instanceof MailProviderError ? error.message : "Mail tool failed" };
  }
}

/** Deletes every saved search of one user in one space. Rows cascade. */
export async function deleteMailSearches(
  prisma: PrismaClient,
  scope: { spaceId: string; userId: string },
): Promise<number> {
  const { count } = await prisma.mailSearch.deleteMany({
    where: { spaceId: scope.spaceId, userId: scope.userId },
  });
  return count;
}

/** Handler for the `mail.search.expire` job. */
export async function expireMailSearch(prisma: PrismaClient, searchId: string): Promise<void> {
  await prisma.mailSearch.deleteMany({ where: { id: searchId } });
}

function addressText(address: MailAddress | null | undefined): string {
  if (!address) return "";
  return address.name ? `${address.name} <${address.address}>` : address.address;
}

export function accountName(account: MailAccount): string {
  return account.address ?? account.label;
}

/** By address; else by the account's name as the user calls it ("Sales" for "Sales mail"), if only one fits. */
export function findAccount(accounts: MailAccount[], wanted: string): MailAccount | undefined {
  const lower = wanted.trim().toLowerCase();
  const byAddress = accounts.find((account) => account.address?.toLowerCase() === lower);
  if (byAddress || !lower) return byAddress;
  const named = accounts.filter((account) => account.label?.toLowerCase().startsWith(lower));
  return named.length === 1 ? named[0] : undefined;
}

function noAccount(wanted: string) {
  return { error: `No connected mail account ${wanted.trim().slice(0, 200)}` };
}

async function findOwnedSearch(deps: MailToolDeps, id: unknown) {
  if (typeof id !== "string" || !id) return null;
  return deps.prisma.mailSearch.findFirst({
    where: { id, spaceId: deps.scope.spaceId, userId: deps.scope.userId, botId: deps.scope.botId },
  });
}

const currentTime = (deps: MailToolDeps) => (deps.now ?? (() => new Date()))();

// --- mail_search ---

function parseResume(value: unknown): ResumeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { accountId, query, unhydratedIds, pageToken } = entry as Record<string, unknown>;
    if (typeof accountId !== "string" || typeof query !== "string") return [];
    return [
      {
        accountId,
        query,
        unhydratedIds: Array.isArray(unhydratedIds)
          ? unhydratedIds.filter((id): id is string => typeof id === "string")
          : [],
        ...(typeof pageToken === "string" && pageToken ? { pageToken } : {}),
      },
    ];
  });
}

type Task = { account: MailAccount; query: string; start?: ResumeEntry };

async function mailSearch(
  deps: MailToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  const hasQueries = args.queries !== undefined && args.queries !== null;
  const hasContinue = typeof args.continueFrom === "string" && args.continueFrom !== "";
  if (hasQueries === hasContinue) return { error: "Pass queries or continueFrom" };

  const accounts = await deps.accounts();
  let tasks: Task[];
  if (hasContinue) {
    const previous = await findOwnedSearch(deps, args.continueFrom);
    if (!previous) return NO_SEARCH;
    if (previous.expiresAt <= currentTime(deps)) return EXPIRED;
    const entries = parseResume(previous.resume);
    if (entries.length === 0) return { error: "That search has nothing left to continue" };
    // A revoked account is no longer listed, so its entries are dropped.
    tasks = entries.flatMap((entry) => {
      const account = accounts.find((candidate) => candidate.id === entry.accountId);
      return account ? [{ account, query: entry.query, start: entry }] : [];
    });
    if (tasks.length === 0) return { error: "No connected mail account for that search" };
  } else {
    const queries = [
      ...new Set(
        (Array.isArray(args.queries) ? args.queries : [])
          .filter((query): query is string => typeof query === "string")
          .map((query) => query.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_QUERIES);
    if (queries.length === 0) return { error: "Pass queries or continueFrom" };
    let chosen = accounts;
    if (typeof args.account === "string" && args.account.trim()) {
      const account = findAccount(accounts, args.account);
      if (!account) return noAccount(args.account);
      chosen = [account];
    }
    if (chosen.length === 0) return { error: "No connected mail account" };
    tasks = chosen.flatMap((account) => queries.map((query) => ({ account, query })));
  }

  const involved = [...new Map(tasks.map((task) => [task.account.id, task.account])).values()];
  const maxMessages = clampInt(args.maxMessages, 1, MAX_MESSAGES, DEFAULT_MAX_MESSAGES);
  const share = Math.ceil(maxMessages / involved.length);
  const signal = AbortSignal.any([
    context.signal,
    AbortSignal.timeout(deps.deadlineMs ?? DEFAULT_DEADLINE_MS),
  ]);
  const searchContext: AdapterContext = { ...context, signal };

  const saved: Array<{ account: MailAccount; message: MailMessageSummary }> = [];
  const outcomes: MailQueryOutcome[] = [];
  const resume: ResumeEntry[] = [];
  const failed = new Set<string>();
  // Queries of one account run one after another and share its budget; accounts run together.
  await Promise.all(
    involved.map(async (account) => {
      const seen = new Set<string>();
      let left = share;
      for (const task of tasks.filter((candidate) => candidate.account.id === account.id)) {
        const before = seen.size;
        deps.progress?.({
          text: clip(
            `Searching mail: ${describeMailQuery(task.query, currentTime(deps)) || task.query}`,
            QUERY_LIMIT,
          ),
        });
        const result = await runTask(
          deps.mail,
          searchContext,
          task,
          deps.progress,
          () => left,
          (message) => {
            if (seen.has(message.id)) return false;
            seen.add(message.id);
            saved.push({ account, message });
            left -= 1;
            return true;
          },
        );
        outcomes.push(result.outcome);
        if (result.outcome.stoppedReason === "error") {
          failed.add(accountName(account));
          deps.progress?.({
            text: `Could not finish this search: ${result.reason ?? "Gmail did not answer"}`,
            failed: true,
          });
        } else if (tasks.length > 1) {
          deps.progress?.({ text: found(seen.size - before) });
        }
        if (result.resume) resume.push(result.resume);
      }
    }),
  );

  saved.sort(
    (a, b) =>
      a.message.date.localeCompare(b.message.date) ||
      a.account.id.localeCompare(b.account.id) ||
      a.message.id.localeCompare(b.message.id),
  );
  const rows = saved.map(({ account, message }, index) =>
    resultRow(
      {
        account: accountName(account),
        id: message.id,
        threadId: message.threadId,
        date: message.date,
        from: addressText(message.from),
        to: message.to.map(addressText).join(", "),
        subject: message.subject,
        snippet: message.snippet,
      },
      index + 1,
    ),
  );
  deps.progress?.({
    text: tasks.length > 1 ? `${found(rows.length)} in total` : found(rows.length),
    summary: `Searched mail · ${rows.length === 0 ? "none found" : `${rows.length} found`}${failed.size > 0 ? " · incomplete" : ""}`,
  });
  const summary = summarizeResults({
    rows,
    accounts: involved.map(accountName),
    queries: outcomes,
    failedAccounts: [...failed],
  });

  const createdAt = currentTime(deps);
  const expiresAt = new Date(createdAt.getTime() + SEARCH_TTL_MS);
  const search = await deps.prisma.mailSearch.create({
    data: {
      ...deps.scope,
      summary: summary as unknown as Prisma.InputJsonValue,
      resume: resume.length ? (resume as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      createdAt,
      expiresAt,
      rows: { createMany: { data: rows } },
    },
    select: { id: true },
  });
  // A lost job is covered by the backstop below on a later search.
  await deps.jobs.enqueue(mailSearchExpireJob(search.id, expiresAt)).catch(() => undefined);
  await deps.prisma.mailSearch
    .deleteMany({
      where: { expiresAt: { lt: new Date(createdAt.getTime() - EXPIRED_BACKSTOP_MS) } },
    })
    .catch(() => undefined);
  return { searchId: search.id, ...summary };
}

/**
 * Pages one (account, query) until it ends, the account's budget is used, or the signal aborts.
 * `save` returns true when the message was new.
 */
async function runTask(
  mail: MailProvider,
  context: AdapterContext,
  task: Task,
  progress: MailToolDeps["progress"],
  budget: () => number,
  save: (message: MailMessageSummary) => boolean,
): Promise<{ outcome: MailQueryOutcome; resume?: ResumeEntry; reason?: string }> {
  const { account, query } = task;
  let ids = task.start?.unhydratedIds ?? [];
  let token = task.start?.pageToken;
  // A fresh query, or a resumed one that still has a page to list.
  let more = !task.start || Boolean(token);
  // True until a list call that used the stored token has succeeded.
  let storedTokenUntried = Boolean(token);
  let oldest: string | null = null;
  let page = 0;
  let reason: string | undefined;

  const stop = (stoppedReason: "cap" | "deadline" | "error", keep = true) => {
    const next: ResumeEntry | undefined =
      keep && (ids.length > 0 || more)
        ? {
            accountId: account.id,
            query,
            unhydratedIds: ids,
            ...(token ? { pageToken: token } : {}),
          }
        : undefined;
    return {
      outcome: {
        account: accountName(account),
        q: query,
        complete: false,
        hasMore: Boolean(next),
        stoppedReason,
        oldest,
      },
      ...(next ? { resume: next } : {}),
      ...(reason ? { reason } : {}),
    };
  };

  while (ids.length > 0 || more) {
    const room = budget();
    if (room <= 0) return stop("cap");
    if (context.signal.aborted) return stop("deadline");

    const fromIds = ids.length > 0;
    page += 1;
    if (page > 1) progress?.({ text: `Looking at more results (page ${page})` });
    try {
      const listed = fromIds
        ? await mail.listMessages(
            account,
            { query, pageSize: PAGE_SIZE, ids: ids.slice(0, room) },
            context,
          )
        : await mail.listMessages(
            account,
            { query, pageSize: Math.min(PAGE_SIZE, room), ...(token ? { pageToken: token } : {}) },
            context,
          );
      for (const message of listed.messages) {
        if (save(message) && (oldest === null || message.date < oldest)) oldest = message.date;
      }
      const leftover = fromIds ? ids.slice(room) : [];
      ids = [...(listed.unhydratedIds ?? []), ...leftover];
      if (!fromIds) {
        storedTokenUntried = false;
        token = listed.nextPageToken;
        more = Boolean(token);
      }
      if (listed.unhydratedIds?.length) return stop(context.signal.aborted ? "deadline" : "error");
    } catch (error) {
      reason = failureReason(error);
      if (context.signal.aborted) return stop("deadline");
      // A stored token the provider rejects would be rejected again, so it is not offered twice.
      return stop("error", !(storedTokenUntried && !fromIds));
    }
  }
  return {
    outcome: { account: accountName(account), q: query, complete: true, hasMore: false, oldest },
  };
}

// --- mail_grep ---

async function readBatch(
  prisma: PrismaClient,
  options: {
    searchId: string;
    after: number;
    dateFrom?: string;
    dateTo?: string;
    like?: string[];
  },
): Promise<MailResultRow[]> {
  const conditions = [
    Prisma.sql`"searchId" = ${options.searchId}`,
    Prisma.sql`"line" > ${options.after}`,
  ];
  // COLLATE "C" keeps these comparisons in the same order as JavaScript's.
  if (options.dateFrom) conditions.push(Prisma.sql`"date" COLLATE "C" >= ${options.dateFrom}`);
  if (options.dateTo) {
    conditions.push(
      Prisma.sql`left("date", ${options.dateTo.length}::int) COLLATE "C" <= ${options.dateTo}`,
    );
  }
  if (options.like) {
    conditions.push(Prisma.sql`"text" ILIKE ANY (ARRAY[${Prisma.join(options.like)}])`);
  }
  return prisma.$queryRaw<MailResultRow[]>(
    Prisma.sql`SELECT "line", "date", "text" FROM "mail_search_rows" WHERE ${Prisma.join(conditions, " AND ")} ORDER BY "line" LIMIT ${GREP_BATCH}`,
  );
}

function datePrefix(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim().slice(0, MAX_DATE_PREFIX) : "";
  return text || undefined;
}

async function mailGrep(deps: MailToolDeps, args: Record<string, unknown>) {
  const search = await findOwnedSearch(deps, args.searchId);
  if (!search) return NO_SEARCH;
  if (search.expiresAt <= currentTime(deps)) return EXPIRED;

  const patterns = Array.isArray(args.patterns) ? args.patterns : undefined;
  const dateFrom = datePrefix(args.dateFrom);
  const dateTo = datePrefix(args.dateTo);
  const afterLine = clampInt(args.afterLine, 0, Number.MAX_SAFE_INTEGER, 0);
  const scan = createGrepScan({
    searchId: search.id,
    patterns,
    dateFrom,
    dateTo,
    maxResults: args.maxResults,
    contextLines: args.contextLines,
    afterLine,
  });
  // ILIKE only narrows what is read; the exact match still runs in the scan.
  const like = isLiteralOnly(patterns)
    ? normalizePatterns(patterns).map((pattern) => `%${pattern.replace(/[\\%_]/g, "\\$&")}%`)
    : undefined;

  let after = afterLine;
  for (;;) {
    const batch = await readBatch(deps.prisma, {
      searchId: search.id,
      after,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(like ? { like } : {}),
    });
    scan.add(batch);
    const last = batch[batch.length - 1];
    if (!last || batch.length < GREP_BATCH) break;
    after = last.line;
  }

  // The pre-filter removed non-matching neighbours, so context rows are read by line number.
  const wanted = new Set<number>();
  for (const line of scan.matchedLines()) {
    for (let near = line - scan.contextLines; near <= line + scan.contextLines; near++) {
      if (near > 0) wanted.add(near);
    }
  }
  const context =
    scan.contextLines > 0
      ? await deps.prisma.mailSearchRow.findMany({
          where: { searchId: search.id, line: { in: [...wanted] } },
          select: { line: true, date: true, text: true },
        })
      : [];
  return scan.finish(context);
}

// --- mail_get ---

/**
 * With several accounts and none named: the one account whose synced mail holds the message the
 * call replies to (`replyToId`) or changes (`id`). A reply goes out from the address it came to.
 */
export async function inferMailAccount(
  prisma: PrismaClient,
  owner: { spaceId: string; userId: string },
  accounts: MailAccount[],
  args: Record<string, unknown>,
): Promise<MailAccount | undefined> {
  if (typeof args.account === "string" && args.account.trim()) return undefined;
  if (accounts.length === 1) return accounts[0];
  const ref = [args.replyToId, args.id].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  if (!ref || accounts.length === 0) return undefined;
  const rows = await prisma.cachedMailMessage.findMany({
    where: {
      ...owner,
      providerMessageId: ref.trim(),
      connectionId: { in: accounts.map((account) => account.id) },
    },
    select: { connectionId: true },
  });
  const ids = new Set(rows.map((row) => row.connectionId));
  return ids.size === 1 ? accounts.find((account) => ids.has(account.id)) : undefined;
}

/** The account named by `args.account`, the only connected one, or the one the message is in. */
async function resolveAccount(
  deps: MailToolDeps,
  args: Record<string, unknown>,
): Promise<{ account: MailAccount } | { error: string }> {
  const accounts = await deps.accounts();
  if (typeof args.account === "string" && args.account.trim()) {
    const account = findAccount(accounts, args.account);
    return account ? { account } : noAccount(args.account);
  }
  const owner = { spaceId: deps.scope.spaceId, userId: deps.scope.userId };
  const inferred = await inferMailAccount(deps.prisma, owner, accounts, args);
  if (inferred) return { account: inferred };
  if (accounts.length > 1) {
    return {
      error:
        "Pass account (the address from the row's acct: field) when more than one mail account is connected",
    };
  }
  return accounts[0] ? { account: accounts[0] } : { error: "No connected mail account" };
}

async function mailGet(deps: MailToolDeps, context: AdapterContext, args: Record<string, unknown>) {
  const id = typeof args.id === "string" ? args.id.trim() : "";
  if (!id) return { error: "id is required" };
  const picked = await resolveAccount(deps, args);
  if ("error" in picked) return picked;
  const { account } = picked;

  let message: Awaited<ReturnType<MailProvider["getMessage"]>>;
  try {
    message = await deps.mail.getMessage(account, id, context);
  } catch (error) {
    if (error instanceof MailProviderError && error.kind === "not_found") {
      deps.progress?.({ text: "Failed: that message was not found", failed: true });
      return { error: "Message not found" };
    }
    throw error;
  }
  deps.progress?.({
    text: clip(
      `Reading "${clip(message.subject || "(no subject)", SUBJECT_LIMIT)}" from ${message.from?.address ?? "unknown sender"}`,
      QUERY_LIMIT,
    ),
    summary: "Read an email",
  });
  const maxChars = clampInt(args.maxChars, MIN_BODY_CHARS, MAX_BODY_CHARS, DEFAULT_BODY_CHARS);
  const body = stripQuotedReply(message.text).trimEnd().slice(0, maxChars);
  // Inline pictures the body shows itself are not files to offer.
  const files = message.attachments.filter((part) => !part.inline && part.id);
  const attachments = files.length
    ? [
        "Attachments (id | filename | type | bytes):",
        ...files.map((part) => `${part.id} | ${part.filename} | ${part.mimeType} | ${part.size}`),
      ]
    : [];
  return {
    text: [
      `Message ID: ${message.id}`,
      `Thread ID: ${message.threadId}`,
      `From: ${addressText(message.from)}`,
      `To: ${message.to.map(addressText).join(", ")}`,
      // A reply all needs the Cc list too.
      ...(message.cc.length ? [`Cc: ${message.cc.map(addressText).join(", ")}`] : []),
      `Subject: ${message.subject}`,
      `Date: ${message.date}`,
      "Body:",
      body,
      ...attachments,
    ].join("\n"),
  };
}

// --- show_emails ---

const CARD_NOT_FOUND = {
  error: "None of those messages are in the synced mail. Run mail_search first.",
};

/**
 * Publishes the cited messages as one `emails` block. Ids resolve only to the owner's cached rows
 * on accounts still connected; the card carries the cached row id the Inbox opens.
 */
async function showEmails(
  deps: MailToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  if (!deps.publish) return { error: "Cards are unavailable" };
  const requested = new Map<string, EmailUrgency | undefined>();
  for (const entry of Array.isArray(args.emails) ? args.emails : []) {
    if (requested.size >= MAX_EMAIL_CARDS) break;
    const { id, urgency } = (entry ?? {}) as Record<string, unknown>;
    if (typeof id === "string" && id.trim() && !requested.has(id.trim())) {
      requested.set(id.trim(), EmailUrgency.safeParse(urgency).data);
    }
  }
  if (requested.size === 0) return { error: "emails is required" };

  const accounts = await deps.accounts();
  const rows = await deps.prisma.cachedMailMessage.findMany({
    where: {
      spaceId: deps.scope.spaceId,
      userId: deps.scope.userId,
      connectionId: { in: accounts.map((account) => account.id) },
      providerMessageId: { in: [...requested.keys()] },
    },
  });
  const found = new Map(rows.map((row) => [row.providerMessageId, row]));
  const now = currentTime(deps);
  // ponytail: up to 20 getMessage calls in parallel for attachment counts; the provider retries
  // rate limits. Cache the count at sync time if this is slow.
  const emails = await Promise.all(
    [...requested].flatMap(([providerId, urgency]) => {
      const row = found.get(providerId);
      if (!row) return [];
      return [
        (async (): Promise<EmailCard> => {
          const account = accounts.find((candidate) => candidate.id === row.connectionId);
          const attachments = await deps.mail
            .getMessage(account as MailAccount, providerId, context)
            .then((message) => message.attachments.length)
            .catch(() => undefined);
          return {
            id: row.id,
            urgency: urgency ?? triageUrgency(row, now),
            from: row.fromName || row.fromAddress,
            subject: row.subject,
            snippet: row.snippet,
            receivedAt: row.receivedAt.toISOString(),
            ...(attachments === undefined ? {} : { attachments }),
          };
        })(),
      ];
    }),
  );
  if (emails.length === 0) return CARD_NOT_FOUND;
  await deps.publish([{ kind: "emails", emails }]);
  const notFound = [...requested.keys()].filter((id) => !found.has(id));
  return {
    shown: emails.length,
    ...(notFound.length ? { notFound } : {}),
    // Models tended to list every card again as text below them.
    note: "The user now sees these emails as cards with sender, subject and date. Do not list them again; answer in a sentence or two.",
  };
}

// --- mail_draft, mail_modify, mail_send ---
// All change the user's mail, so the executor asks for approval first.

const WRITES_OFF = { error: "Changing mail is turned off." };
/** Labels that would delete, report or fake-send a message. */
const FIXED_LABELS = new Set(["TRASH", "SPAM", "DRAFT", "SENT"]);

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Saves a new draft, or replaces the one named by `draftId`. The user, or mail_send, sends it. */
async function mailDraft(
  deps: MailToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  if (deps.writesDisabled) return WRITES_OFF;
  const picked = await resolveAccount(deps, args);
  if ("error" in picked) return picked;
  const { account } = picked;
  const replyTo = typeof args.replyToId === "string" ? args.replyToId.trim() : "";
  const draft: MailDraftInput = {
    to: parseRecipients(strings(args.to).join(", ")),
    cc: parseRecipients(strings(args.cc).join(", ")),
    bcc: parseRecipients(strings(args.bcc).join(", ")),
    subject: typeof args.subject === "string" ? args.subject : "",
    text: typeof args.body === "string" ? args.body : "",
    ...(replyTo ? { inReplyTo: replyTo } : {}),
  };
  const draftId = typeof args.draftId === "string" ? args.draftId.trim() : "";
  await allowWrite(deps, account);
  const saved = draftId
    ? await deps.mail.updateDraft(account, draftId, draft, writeContext(deps, account, context))
    : await deps.mail.createDraft(account, draft, writeContext(deps, account, context));
  return {
    ok: true,
    draftId: saved.draftId,
    account: accountName(account),
    to: draft.to.map(addressText),
    subject: draft.subject,
  };
}

/** Changes labels on a message, and on its conversation unless the change is marking it unread. */
async function mailModify(
  deps: MailToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  if (deps.writesDisabled) return WRITES_OFF;
  const id = typeof args.id === "string" ? args.id.trim() : "";
  if (!id) return { error: "id is required" };
  const picked = await resolveAccount(deps, args);
  if ("error" in picked) return picked;
  const { account } = picked;

  const add: string[] = [];
  const remove: string[] = [];
  const named = [
    { names: strings(args.addLabels), into: add },
    { names: strings(args.removeLabels), into: remove },
  ];
  if (named.some(({ names }) => names.length)) {
    const known = await deps.mail.listLabels(account, context);
    for (const { names, into } of named) {
      for (const name of names) {
        const label = known.find(
          (candidate) =>
            candidate.id === name || candidate.name.toLowerCase() === name.toLowerCase(),
        );
        if (!label) return { error: `No such label ${name.slice(0, 100)}` };
        if (FIXED_LABELS.has(label.id)) return { error: `${label.id} cannot be changed here` };
        into.push(label.id);
      }
    }
  }
  if (typeof args.read === "boolean") (args.read ? remove : add).push("UNREAD");
  if (typeof args.archive === "boolean") (args.archive ? remove : add).push("INBOX");
  if (add.length + remove.length === 0) return { error: "Nothing to change" };
  const change: MailLabelChange = { addLabelIds: add, removeLabelIds: remove };

  // What the Inbox shows is kept in step without waiting for a sync.
  const flag = (label: string) =>
    add.includes(label) ? true : remove.includes(label) ? false : undefined;
  const unread = flag("UNREAD");
  const inInbox = flag("INBOX");
  const data = {
    ...(unread === undefined ? {} : { unread }),
    ...(inInbox === undefined ? {} : { inInbox }),
  };

  const owner = { spaceId: deps.scope.spaceId, userId: deps.scope.userId };
  const cache = deps.prisma.cachedMailMessage;
  const row = await cache.findFirst({
    where: { ...owner, connectionId: account.id, providerMessageId: id },
    select: { id: true, threadId: true },
  });
  const wholeThread = !add.includes("UNREAD");
  const update = (where: Record<string, unknown>) =>
    Object.keys(data).length ? cache.updateMany({ where: { ...owner, ...where }, data }) : null;

  try {
    if (wholeThread) {
      // One provider call reaches every message of the conversation, cached or not.
      const threadId = row?.threadId ?? (await deps.mail.getMessage(account, id, context)).threadId;
      await allowWrite(deps, account);
      await deps.mail.modifyThread(account, threadId, change, writeContext(deps, account, context));
      const cached = await cache.findMany({
        where: { ...owner, connectionId: account.id, threadId },
        select: { id: true },
      });
      await update({ connectionId: account.id, threadId });
      return { ok: true, messages: Math.max(cached.length, 1) };
    }
    await allowWrite(deps, account);
    await deps.mail.modifyMessage(account, id, change, writeContext(deps, account, context));
    if (row) await update({ id: row.id });
    return { ok: true, messages: 1 };
  } catch (error) {
    // Deleted since the last sync: nothing left to change.
    if (error instanceof MailProviderError && error.kind === "not_found")
      return { error: "Message not found" };
    throw error;
  }
}

const CHECK_SENT = "Check the Sent folder before trying again.";

/**
 * Sends a saved draft (`draftId`) or a new message. The send record is keyed on the tool call, so a
 * replayed call reports the earlier outcome instead of sending again. A send whose outcome is unclear
 * is never repeated. Same record and states as the Inbox composer's send (`ComposeSend`).
 */
async function mailSend(
  deps: MailToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  if (deps.writesDisabled) return WRITES_OFF;
  if (!deps.idempotencyKey) return { error: "Mail could not be sent from here." };
  const picked = await resolveAccount(deps, args);
  if ("error" in picked) return picked;
  const { account } = picked;
  const replyTo = typeof args.replyToId === "string" ? args.replyToId.trim() : "";
  const draft: MailDraftInput = {
    to: parseRecipients(strings(args.to).join(", ")),
    cc: parseRecipients(strings(args.cc).join(", ")),
    bcc: parseRecipients(strings(args.bcc).join(", ")),
    subject: typeof args.subject === "string" ? args.subject : "",
    text: typeof args.body === "string" ? args.body : "",
  };
  const given = typeof args.draftId === "string" ? args.draftId.trim() : "";
  // A new message is checked before any state changes; a saved draft was checked when it was saved.
  if (!given) buildRawMessage(draft);
  if (replyTo) draft.inReplyTo = replyTo;

  const owner = { spaceId: deps.scope.spaceId, userId: deps.scope.userId };
  const table = deps.prisma.composeSend;
  const row = await table.upsert({
    where: { spaceId_userId_clientId: { ...owner, clientId: `agent:${deps.idempotencyKey}` } },
    create: { ...owner, clientId: `agent:${deps.idempotencyKey}`, connectionId: account.id },
    update: {},
    select: { id: true, connectionId: true, draftId: true, state: true },
  });
  const claim = await table.updateMany({
    where: { id: row.id, state: { in: ["draft", "failed"] } },
    data: { state: "pending" },
  });
  if (claim.count === 0) {
    return row.state === "sent"
      ? { ok: true, alreadySent: true }
      : { error: `An earlier send of this message may or may not have gone out. ${CHECK_SENT}` };
  }

  const record = (data: { state: string; providerMessageId?: string | null }) =>
    table.update({ where: { id: row.id }, data }).catch(() => undefined);
  let sending = false;
  try {
    let draftId = given || row.draftId;
    if (!draftId) {
      await allowWrite(deps, account);
      draftId = (await deps.mail.createDraft(account, draft, writeContext(deps, account, context)))
        .draftId;
    }
    await table.update({ where: { id: row.id }, data: { draftId } });
    await allowWrite(deps, account);
    sending = true;
    const sent = await deps.mail.sendDraft(account, draftId, writeContext(deps, account, context));
    sending = false;
    await record({ state: "sent", providerMessageId: sent.messageId || null });
    // So the Inbox shows the reply in its conversation, and the thread leaves Needs reply.
    await syncAfterSend({ prisma: deps.prisma, jobs: deps.jobs }, account, {
      ...context,
      spaceId: deps.scope.spaceId,
      userId: deps.scope.userId,
    });
    return {
      ok: true,
      account: accountName(account),
      to: draft.to.map(addressText),
      subject: draft.subject,
      note: "The email was sent. Tell the user it was sent; do not offer it again.",
    };
  } catch (error) {
    // Refused before the request left: nothing was sent, even on a retry after a rate limit.
    if (error instanceof WriteDenied) sending = false;
    if (sending && !(error instanceof MailProviderError && error.kind !== "unknown")) {
      await record({ state: "unknown" });
      return { error: `The send may or may not have gone out. ${CHECK_SENT}` };
    }
    await record({ state: "failed" });
    if (error instanceof MailProviderError && error.kind === "auth") {
      const now = new Date();
      await deps.prisma.mailSyncState
        .upsert({
          where: { connectionId: account.id },
          create: {
            connectionId: account.id,
            lastErrorAt: now,
            needsReconnect: true,
            lastErrorKind: "auth",
          },
          update: { lastErrorAt: now, needsReconnect: true, lastErrorKind: "auth" },
        })
        .catch(() => undefined);
      return { error: "Mail needs to be reconnected in Rakazo before it can send." };
    }
    throw error;
  }
}
