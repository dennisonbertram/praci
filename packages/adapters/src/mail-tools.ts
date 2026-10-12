import type {
  AdapterContext,
  ConnectorTool,
  JobPublisher,
  MailAccount,
  MailAddress,
  MailMessageSummary,
  MailProvider,
} from "@rakazo/adapter-kit";
import { MailProviderError, mailSearchExpireJob } from "@rakazo/adapter-kit";
import {
  clampInt,
  createGrepScan,
  isLiteralOnly,
  type MailQueryOutcome,
  type MailResultRow,
  normalizePatterns,
  resultRow,
  stripQuotedReply,
  summarizeResults,
} from "@rakazo/core";
import { Prisma, type PrismaClient } from "@rakazo/db";

export const MAIL_TOOL_NAMES = new Set(["mail_search", "mail_grep", "mail_get"]);

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
  deadlineMs?: number;
  now?: () => Date;
};

/** A query that stopped early, with what is needed to carry on where it left off. */
type ResumeEntry = {
  accountId: string;
  query: string;
  unhydratedIds: string[];
  pageToken?: string;
};

/** Owner only: the bot's owner started the run, in a direct thread, outside a messaging channel. */
export function mailToolsAllowed(options: {
  hasProvider: boolean;
  groupId: string | null;
  runUserId: string;
  botUserId: string;
  messagingChannelRun: boolean;
}): boolean {
  return (
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
    if (name === "mail_search") return await mailSearch(deps, context, args);
    if (name === "mail_grep") return await mailGrep(deps, args);
    if (name === "mail_get") return await mailGet(deps, context, args);
    return { error: `Unknown mail tool ${name}` };
  } catch (error) {
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

function accountName(account: MailAccount): string {
  return account.address ?? account.label;
}

function findAccount(accounts: MailAccount[], wanted: string): MailAccount | undefined {
  const lower = wanted.trim().toLowerCase();
  return accounts.find((account) => account.address?.toLowerCase() === lower);
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
        const result = await runTask(
          deps.mail,
          searchContext,
          task,
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
        if (result.outcome.stoppedReason === "error") failed.add(accountName(account));
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
  budget: () => number,
  save: (message: MailMessageSummary) => boolean,
): Promise<{ outcome: MailQueryOutcome; resume?: ResumeEntry }> {
  const { account, query } = task;
  let ids = task.start?.unhydratedIds ?? [];
  let token = task.start?.pageToken;
  // A fresh query, or a resumed one that still has a page to list.
  let more = !task.start || Boolean(token);
  // True until a list call that used the stored token has succeeded.
  let storedTokenUntried = Boolean(token);
  let oldest: string | null = null;

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
    };
  };

  while (ids.length > 0 || more) {
    const room = budget();
    if (room <= 0) return stop("cap");
    if (context.signal.aborted) return stop("deadline");

    const fromIds = ids.length > 0;
    try {
      const page = fromIds
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
      for (const message of page.messages) {
        if (save(message) && (oldest === null || message.date < oldest)) oldest = message.date;
      }
      const leftover = fromIds ? ids.slice(room) : [];
      ids = [...(page.unhydratedIds ?? []), ...leftover];
      if (!fromIds) {
        storedTokenUntried = false;
        token = page.nextPageToken;
        more = Boolean(token);
      }
      if (page.unhydratedIds?.length) return stop(context.signal.aborted ? "deadline" : "error");
    } catch {
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

async function mailGet(deps: MailToolDeps, context: AdapterContext, args: Record<string, unknown>) {
  const id = typeof args.id === "string" ? args.id.trim() : "";
  if (!id) return { error: "id is required" };
  const accounts = await deps.accounts();
  let account: MailAccount | undefined;
  if (typeof args.account === "string" && args.account.trim()) {
    account = findAccount(accounts, args.account);
    if (!account) return noAccount(args.account);
  } else if (accounts.length > 1) {
    return {
      error:
        "Pass account (the address from the row's acct: field) when more than one mail account is connected",
    };
  } else {
    account = accounts[0];
  }
  if (!account) return { error: "No connected mail account" };

  let message: Awaited<ReturnType<MailProvider["getMessage"]>>;
  try {
    message = await deps.mail.getMessage(account, id, context);
  } catch (error) {
    if (error instanceof MailProviderError && error.kind === "not_found") {
      return { error: "Message not found" };
    }
    throw error;
  }
  const maxChars = clampInt(args.maxChars, MIN_BODY_CHARS, MAX_BODY_CHARS, DEFAULT_BODY_CHARS);
  const body = stripQuotedReply(message.text).trimEnd().slice(0, maxChars);
  return {
    text: [
      `Message ID: ${message.id}`,
      `Thread ID: ${message.threadId}`,
      `From: ${addressText(message.from)}`,
      `To: ${message.to.map(addressText).join(", ")}`,
      `Subject: ${message.subject}`,
      `Date: ${message.date}`,
      "Body:",
      body,
    ].join("\n"),
  };
}
