import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SecretStore } from "@rakazo/adapter-kit";
import type {
  BotPage,
  HttpSourceCall,
  McpSourceCall,
  PageBlocksData,
  PageChart,
  PageData,
  PageHtmlData,
  PageHtmlSourceData,
  PageLiveBlock,
  PageMetricBlock,
  PageSource,
  PageSourceKind,
  PageSourceSchedule,
  PageTableBlock,
  PraciSourceCall,
} from "@rakazo/contracts";
import {
  disabledBuiltinToolSet,
  HttpSourceCallSchema,
  isGtmAgentSpawnKey,
  McpSourceCallSchema,
  PAGE_HTML_DATA_MAX_BYTES,
  PAGE_HTML_HISTORY_MAX,
  PAGE_SOURCE_VALUE_MAX_BYTES,
  PAGE_SOURCES_MAX_PER_PAGE,
  PageSourceNameSchema,
  PageSourceSchedule as PageSourceScheduleSchema,
} from "@rakazo/contracts";
import { htmlPageDeclaration, splitPage } from "@rakazo/core";
import type { NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import { isUniqueViolation, PAGE_SOURCE_LEASE_MINUTES } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { builtinAgentTools } from "./builtin-tools.js";
import { capTableToolsAllowed, contactToolFromTool, contactToolsAllowed } from "./contact-tools.js";
import { unwrapToolResult } from "./finance-call-tool.js";
import {
  FINANCE_TOOL_NAMES,
  financeToolFromTool,
  financeToolsAllowed,
  hasFinanceSource,
} from "./finance-tools.js";
import { fundraisingToolFromTool, fundraisingToolsAllowed } from "./fundraising-tools.js";
import type { McpConnector } from "./mcp-connector.js";
import { checkMcpReadSource, mcpSourceContext } from "./mcp-read-source.js";
import type { OutsideSourceCall } from "./page-source-approval.js";
import {
  PAGE_SOURCE_REQUEST_LINE_MAX,
  pageSourceApprovalBlock,
  pageSourceCallHash,
  pageSourceRequestLine,
  postPageSourceApproval,
} from "./page-source-approval.js";
import {
  checkHttpSourceCall,
  errorChain,
  HttpSourceError,
  httpSourceRefusal,
  runHttpSource,
} from "./page-source-http.js";
import type { PageDeps, PageToolScope } from "./pages.js";
import { announcePageData, findPageByTitle, getBotPage, renderPageChartSvg } from "./pages.js";
import { formatPinValue, jsonPointerGet } from "./pin-values.js";
import { PRACI_SOURCE_TOOLS } from "./praci-source-tools.js";
import type { RemoteTransportDependencies } from "./remote-mcp.js";
import { listBoardTickets } from "./ticket-tools.js";

export { PRACI_SOURCE_TOOLS };

const REFRESH_TIMEOUT_MS = 15_000;
/** "Refresh now" skips a source refreshed within this long, so repeated clicks do nothing extra. */
const REFRESH_DEBOUNCE_MS = 60_000;
const PREVIEW_CHARS = 4_000;
const HISTORY_POINTS = 500;
const CHART_MAX_ROWS = 5_000;

/** A source that fails this many times in a row is paused. */
export const PAGE_SOURCE_PAUSE_AFTER = 5;
/** Active and pending sources per space, checked when a source is created. */
export const PAGE_SOURCES_MAX_PER_SPACE = 100;
const BACKOFF_CAP_MS = 6 * 3_600_000;
const JITTER = 0.05;

export const SCHEDULE_MS: Record<PageSourceSchedule, number> = {
  "15m": 15 * 60_000,
  "1h": 3_600_000,
  "6h": 6 * 3_600_000,
  "1d": 86_400_000,
  "1w": 7 * 86_400_000,
};

export interface PageSourceDeps extends PageDeps {
  events: PageDeps["events"] & Partial<Pick<ThreadEvents, "notify">>;
  /** From the deployment; board_tickets is only a source where the ticket board is on. */
  ticketBoardEnabled?: boolean;
  /** Needed for mcp sources: lists a server's tools and calls the approved one. */
  mcp?: Pick<McpConnector, "listServerTools"> & Partial<Pick<McpConnector, "callServerTool">>;
  /** Needed for http sources that use a saved key. */
  secretStore?: SecretStore;
  /** The network http sources use (test seam and deployment override); defaults to the safe fetch. */
  network?: RemoteTransportDependencies;
  /** Lets the "needs approval" notification reach open clients at once. */
  notificationEvents?: NotificationEvents;
  /** Test seam. */
  timeoutMs?: number;
  now?: () => Date;
  /** Test seam for the schedule jitter; 0 to 1. */
  random?: () => number;
}

/** The next normal run: the schedule's interval plus up to 5% jitter so sources do not fire together. */
export function nextScheduledRefresh(
  now: Date,
  schedule: string,
  random: () => number = Math.random,
): Date {
  const interval = SCHEDULE_MS[schedule as PageSourceSchedule];
  return new Date(now.getTime() + interval * (1 + JITTER * random()));
}

/** After the nth failure in a row: double each time up to 6 hours, never sooner than the normal interval. */
function backoffRefresh(now: Date, schedule: string, failures: number): Date {
  const interval = SCHEDULE_MS[schedule as PageSourceSchedule];
  return new Date(
    now.getTime() + Math.max(interval, Math.min(interval * 2 ** failures, BACKOFF_CAP_MS)),
  );
}

/** A source could not run. The message is short and written for the owner or the model. */
export class PageSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PageSourceError";
  }
}

type SourceRow = {
  id: string;
  spaceId: string;
  userId: string;
  botId: string;
  pageId: string;
  name: string;
  kind: string;
  call: unknown;
  schedule: string;
  status: string;
  failures: number;
  lastRefreshAt: Date | null;
  lastError: string | null;
};

export function toPageSource(row: SourceRow, serverName?: string): PageSource {
  return {
    id: row.id,
    pageId: row.pageId,
    name: row.name,
    kind: row.kind as PageSourceKind,
    call: row.call as PageSource["call"],
    ...(serverName ? { serverName } : {}),
    schedule: row.schedule as PageSourceSchedule,
    status: row.status as PageSource["status"],
    lastRefreshAt: row.lastRefreshAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

type SourceBot = {
  id: string;
  spaceId: string;
  userId: string;
  spawnKey: string | null;
  audience: string;
  archivedAt: Date | null;
  disabledBuiltinTools: string[];
};

const isPraciTool = (tool: string): tool is (typeof PRACI_SOURCE_TOOLS)[number] =>
  (PRACI_SOURCE_TOOLS as readonly string[]).includes(tool);

/**
 * Null when this bot may use the tool as a page source; otherwise why not. A source runs like an
 * owner-started routine of the bot: the same agent gates a run applies, never wider.
 */
export async function praciSourceRefusal(
  deps: Pick<PageSourceDeps, "prisma" | "ticketBoardEnabled">,
  bot: SourceBot,
  tool: string,
): Promise<string | null> {
  if (!isPraciTool(tool)) {
    return `"${tool}" cannot be a page source. Use one of: ${PRACI_SOURCE_TOOLS.join(", ")}.`;
  }
  // Read at call time, so a tool that later stops being read-only stops working as a source.
  if (builtinAgentTools.find((candidate) => candidate.name === tool)?.readOnly !== true) {
    return `${tool} is not a read-only tool.`;
  }
  const botRefusal = sourceBotRefusal(bot);
  if (botRefusal) return botRefusal;
  if (disabledBuiltinToolSet(bot.disabledBuiltinTools).has(tool)) {
    return `${tool} is switched off for this bot.`;
  }
  const gate = {
    hasProvider: true,
    groupId: null,
    runUserId: bot.userId,
    botUserId: bot.userId,
    messagingChannelRun: false,
    trigger: "routine",
    botSpawnKey: bot.spawnKey,
  };
  const scope = { spaceId: bot.spaceId, userId: bot.userId };
  const unavailable = `This bot does not have ${tool}.`;
  if (FINANCE_TOOL_NAMES.has(tool)) {
    if (!financeToolsAllowed(gate)) return unavailable;
    return (await hasFinanceSource(deps.prisma, scope)) ? null : "No finance source is connected.";
  }
  if (tool === "cap_table_read") return capTableToolsAllowed(gate) ? null : unavailable;
  if (tool === "fundraising_read") return fundraisingToolsAllowed(gate) ? null : unavailable;
  if (tool === "contacts_list") return contactToolsAllowed(gate) ? null : unavailable;
  if (tool === "board_tickets") return deps.ticketBoardEnabled ? null : unavailable;
  return unavailable;
}

/**
 * Run an allowlisted read tool for a source. Scope comes from the bot, never from `args`.
 * Throws PageSourceError when the bot may not use the tool or the tool reports an error.
 */
export async function runPraciSourceTool(
  deps: Pick<PageSourceDeps, "prisma" | "ticketBoardEnabled">,
  input: { spaceId: string; userId: string; bot: SourceBot },
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { bot } = input;
  if (bot.spaceId !== input.spaceId || bot.userId !== input.userId) {
    throw new PageSourceError("This bot does not belong to this page's owner.");
  }
  const refusal = await praciSourceRefusal(deps, bot, tool);
  if (refusal) throw new PageSourceError(refusal);
  const scope = { spaceId: bot.spaceId, userId: bot.userId };
  const { prisma } = deps;
  let result: Record<string, unknown>;
  if (FINANCE_TOOL_NAMES.has(tool)) {
    result = await financeToolFromTool(tool, { prisma, scope }, args);
  } else if (tool === "cap_table_read" || tool === "contacts_list") {
    result = await contactToolFromTool(tool, { prisma, scope, botId: bot.id }, args);
  } else if (tool === "fundraising_read") {
    result = await fundraisingToolFromTool(tool, { prisma, scope }, args);
  } else {
    result = (await listBoardTickets(
      { prisma, ticketBoardEnabled: deps.ticketBoardEnabled },
      {
        spaceId: scope.spaceId,
        status: args.status !== undefined ? String(args.status) : undefined,
        assigneeBotId: args.ownerBotId !== undefined ? String(args.ownerBotId) : undefined,
        cursor: args.cursor !== undefined ? String(args.cursor) : undefined,
      },
    )) as Record<string, unknown>;
  }
  if (typeof result.error === "string") throw new PageSourceError(result.error.slice(0, 200));
  return result;
}

const botColumns = {
  id: true,
  spaceId: true,
  userId: true,
  spawnKey: true,
  audience: true,
  archivedAt: true,
  disabledBuiltinTools: true,
} as const;

/** Why this bot may not keep any saved source, or null. */
function sourceBotRefusal(bot: SourceBot): string | null {
  if (bot.archivedAt) return "This bot is archived.";
  if (bot.audience === "external" || isGtmAgentSpawnKey(bot.spawnKey)) {
    return "This bot cannot save page sources.";
  }
  return null;
}

/**
 * The source's call as stored now, only if the owner approved exactly it: status active and the
 * stored hash matching the call's hash. Read from the database on every use.
 */
async function readApprovedCall<T extends OutsideSourceCall>(
  deps: Pick<PageSourceDeps, "prisma">,
  source: Pick<SourceRow, "id" | "spaceId" | "userId" | "botId">,
  kind: "mcp" | "http",
  parse: (value: unknown) => T | null,
): Promise<T> {
  const row = await deps.prisma.pageSource.findFirst({
    where: {
      id: source.id,
      spaceId: source.spaceId,
      userId: source.userId,
      botId: source.botId,
      kind,
    },
    select: { status: true, call: true, approvedCallHash: true },
  });
  const call = row ? parse(row.call) : null;
  if (!row || !call) throw new PageSourceError("The source is not available.");
  if (row.status !== "active") throw new PageSourceError(`The source is ${row.status}.`);
  if (row.approvedCallHash !== pageSourceCallHash(kind, call)) {
    throw new PageSourceError("The owner has not approved this request.");
  }
  return call;
}

/**
 * Run an approved http source's one GET. The owner approved this exact call (hash), no Block rule
 * covers the site, a key is still saved for the URL's origin, and the approval is read again as
 * the last step before the request goes out.
 */
async function runApprovedHttpSource(
  deps: PageSourceDeps,
  source: Pick<SourceRow, "id" | "spaceId" | "userId" | "botId">,
  bot: SourceBot,
): Promise<unknown> {
  const refusal = sourceBotRefusal(bot);
  if (refusal) throw new PageSourceError(refusal);
  const scope = { spaceId: source.spaceId, botId: source.botId, userId: source.userId };
  const approvedCall = () =>
    readApprovedCall(deps, source, "http", (value) => {
      const parsed = HttpSourceCallSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    });
  const call = await approvedCall();
  const unsafe = checkHttpSourceCall(call);
  if (typeof unsafe === "string") throw new PageSourceError(unsafe);
  // Checked now for a clear message, and again as the last step before the request.
  const refused = async () => {
    const reason = await httpSourceRefusal(deps.prisma, scope, call);
    if (reason) throw new PageSourceError(reason);
  };
  await refused();
  try {
    return await runHttpSource(deps, scope, call, async () => {
      await refused();
      const again = await approvedCall();
      if (pageSourceCallHash("http", again) !== pageSourceCallHash("http", call)) {
        throw new PageSourceError("The request changed.");
      }
    });
  } catch (error) {
    if (error instanceof HttpSourceError) {
      throw new PageSourceError(error.message, { cause: error.cause ?? error });
    }
    throw error;
  }
}

/**
 * Run an approved mcp source's one read-only tool call. Three things must hold, each read from the
 * database or the server now: the owner approved this exact call (status active and the stored
 * hash matches the call's hash), the shared read-only rule passes, and both still hold right
 * before the call. Anything else records an error and calls nothing.
 */
async function runMcpSource(
  deps: PageSourceDeps,
  source: Pick<SourceRow, "id" | "spaceId" | "userId" | "botId">,
  bot: SourceBot,
): Promise<unknown> {
  const callServerTool = deps.mcp?.callServerTool?.bind(deps.mcp);
  if (!callServerTool) throw new PageSourceError("MCP is not available.");
  const refusal = sourceBotRefusal(bot);
  if (refusal) throw new PageSourceError(refusal);
  const scope = { spaceId: source.spaceId, botId: source.botId, userId: source.userId };
  const approvedCall = () =>
    readApprovedCall(deps, source, "mcp", (value) => {
      const parsed = McpSourceCallSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    });
  const check = async (call: { serverId: string; tool: string }) => {
    try {
      return await checkMcpReadSource(deps, scope, call, "page-source");
    } catch (error) {
      throw new PageSourceError(
        (error instanceof Error ? error.message : String(error)).slice(0, 200),
      );
    }
  };
  const call = await approvedCall();
  const server = await check(call);
  const context = mcpSourceContext(scope, "page-source");
  const result: CallToolResult = await callServerTool(server, context, call.tool, call.args, {
    // The session setup awaits; look at the approval and the tool's status again right before the call.
    // The tool check lists the server's tools (an await), so the approval is read after it: the
    // last await before the call is the one that proves this exact call is still approved.
    beforeCall: async () => {
      await check(call);
      const again = await approvedCall();
      if (pageSourceCallHash("mcp", again) !== pageSourceCallHash("mcp", call)) {
        throw new PageSourceError("The request changed.");
      }
    },
  });
  try {
    return unwrapToolResult(result);
  } catch (error) {
    throw new PageSourceError(
      error instanceof Error ? error.message.slice(0, 200) : "Tool failed.",
    );
  }
}

export type RefreshOutcome =
  | { ok: true; value: unknown }
  /** `paused` is set only for the call that paused the source (its fifth failure in a row). */
  | { ok: false; error: string; paused?: true };

/** Never resolves later than `ms`; the timer is always cleared. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new PageSourceError(`The source took longer than ${Math.round(ms / 1000)} seconds.`),
        ),
      ms,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rerun one source now. Success stores a snapshot and clears the error; failure keeps the
 * snapshots, records a short error and counts the failure. Announces page.data either way.
 * Only active sources run.
 */
export async function refreshPageSource(
  deps: PageSourceDeps,
  source: SourceRow,
): Promise<RefreshOutcome> {
  if (source.status !== "active") return { ok: false, error: `The source is ${source.status}.` };
  const now = deps.now?.() ?? new Date();
  let outcome: RefreshOutcome;
  try {
    const bot = await deps.prisma.bot.findFirst({
      where: { id: source.botId, spaceId: source.spaceId, userId: source.userId },
      select: botColumns,
    });
    if (!bot) throw new PageSourceError("The bot is gone.");
    const value =
      source.kind === "mcp" || source.kind === "http"
        ? await withTimeout(
            source.kind === "mcp"
              ? runMcpSource(deps, source, bot)
              : runApprovedHttpSource(deps, source, bot),
            deps.timeoutMs ?? REFRESH_TIMEOUT_MS,
          )
        : await withTimeout(
            runPraciSourceTool(
              deps,
              { spaceId: source.spaceId, userId: source.userId, bot },
              (source.call as PraciSourceCall).tool,
              (source.call as PraciSourceCall).args ?? {},
            ),
            deps.timeoutMs ?? REFRESH_TIMEOUT_MS,
          );
    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json ?? "");
    if (json === undefined) throw new PageSourceError("The tool returned nothing.");
    if (bytes > PAGE_SOURCE_VALUE_MAX_BYTES) {
      throw new PageSourceError("The result is larger than 1 MB. Narrow the tool's arguments.");
    }
    const stored = JSON.parse(json) as object;
    const saved = await deps.prisma.$transaction(async (tx) => {
      const data = {
        lastRefreshAt: now,
        lastError: null,
        failures: 0,
        leaseUntil: null,
        nextRefreshAt: nextScheduledRefresh(now, source.schedule, deps.random),
      };
      let updated = await tx.pageSource.updateMany({
        where: {
          id: source.id,
          spaceId: source.spaceId,
          status: "active",
          schedule: source.schedule,
        },
        data,
      });
      if (updated.count === 0) {
        const current = await tx.pageSource.findFirst({
          where: { id: source.id, spaceId: source.spaceId },
          select: { schedule: true, status: true },
        });
        if (current?.status === "active") {
          // No schedule filter here: the lease and refresh state must be written either way.
          updated = await tx.pageSource.updateMany({
            where: { id: source.id, spaceId: source.spaceId, status: "active" },
            data: {
              ...data,
              nextRefreshAt: nextScheduledRefresh(now, current.schedule, deps.random),
            },
          });
        }
      }
      if (updated.count === 0) {
        const current = await tx.pageSource.findFirst({
          where: { id: source.id, spaceId: source.spaceId },
          select: { status: true },
        });
        await tx.pageSource.updateMany({
          where: { id: source.id, spaceId: source.spaceId },
          data: { leaseUntil: null },
        });
        return { active: false, status: current?.status ?? source.status };
      }
      await tx.pageSourceSnapshot.create({
        data: {
          spaceId: source.spaceId,
          sourceId: source.id,
          fetchedAt: now,
          value: stored,
          bytes,
        },
      });
      return { active: true as const };
    });
    outcome = saved.active
      ? { ok: true, value: stored }
      : { ok: false, error: `The source is ${saved.status}.` };
  } catch (error) {
    const message =
      error instanceof PageSourceError ? error.message : "The source could not be refreshed.";
    // The owner sees fixed text; the log keeps the underlying error chain (never a response body).
    getLogger().warn("page source refresh failed", {
      sourceId: source.id,
      kind: source.kind,
      shown: message,
      cause: errorChain(error),
    });
    const failures = source.failures + 1;
    const pause = failures >= PAGE_SOURCE_PAUSE_AFTER;
    // Only an active source is touched, so the call that pauses it is the only one that reports it.
    const data = (schedule: string) => ({
      lastError: message,
      failures,
      nextRefreshAt: backoffRefresh(now, schedule, failures),
      ...(pause ? { status: "paused" } : {}),
    });
    const updated = await deps.prisma.$transaction(async (tx) => {
      let saved = await tx.pageSource.updateMany({
        where: {
          id: source.id,
          spaceId: source.spaceId,
          status: "active",
          schedule: source.schedule,
        },
        data: data(source.schedule),
      });
      if (saved.count === 0) {
        const current = await tx.pageSource.findFirst({
          where: { id: source.id, spaceId: source.spaceId, status: "active" },
          select: { schedule: true },
        });
        if (current) {
          saved = await tx.pageSource.updateMany({
            where: {
              id: source.id,
              spaceId: source.spaceId,
              status: "active",
              schedule: current.schedule,
            },
            data: data(current.schedule),
          });
        }
      }
      await tx.pageSource.updateMany({
        where: { id: source.id, spaceId: source.spaceId },
        data: { leaseUntil: null },
      });
      return saved;
    });
    outcome = {
      ok: false,
      error: message,
      ...(pause && updated.count === 1 ? { paused: true } : {}),
    };
  }
  await announcePageData(deps, source);
  return outcome;
}

/**
 * Rerun the page's active sources, skipping any refreshed in the last minute (state is in the
 * database). `paused` is true when this call paused a source, so the caller can tell the bot.
 */
export async function refreshPageSources(
  deps: PageSourceDeps,
  scope: { spaceId: string; botId: string; pageId: string },
): Promise<{ paused: boolean }> {
  let paused = false;
  const now = deps.now?.() ?? new Date();
  const rows = await deps.prisma.pageSource.findMany({
    where: { ...scope, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  const due = rows.filter(
    (row) =>
      !row.lastRefreshAt || now.getTime() - row.lastRefreshAt.getTime() >= REFRESH_DEBOUNCE_MS,
  );
  for (const row of due) {
    // Each claim checks the lease and the debounce against the row as it is now: an earlier
    // source may have taken seconds, and a scheduled run may have finished this one meanwhile.
    const claimAt = deps.now?.() ?? new Date();
    const claimed = await deps.prisma.pageSource.updateMany({
      where: {
        id: row.id,
        spaceId: row.spaceId,
        status: "active",
        AND: [
          { OR: [{ leaseUntil: null }, { leaseUntil: { lt: claimAt } }] },
          {
            OR: [
              { lastRefreshAt: null },
              { lastRefreshAt: { lte: new Date(claimAt.getTime() - REFRESH_DEBOUNCE_MS) } },
            ],
          },
        ],
      },
      data: { leaseUntil: new Date(claimAt.getTime() + PAGE_SOURCE_LEASE_MINUTES * 60_000) },
    });
    if (claimed.count !== 1) continue;
    // Run with the row as claimed, so a failure counts from the current failure total.
    const fresh = await deps.prisma.pageSource.findFirst({
      where: { id: row.id, spaceId: row.spaceId },
    });
    if (!fresh) continue;
    const outcome = await refreshPageSource(deps, fresh);
    if (!outcome.ok && outcome.paused) paused = true;
  }
  return { paused };
}

export async function listPageSources(
  prisma: PrismaClient,
  scope: { spaceId: string; botId: string; pageId: string },
): Promise<PageSource[]> {
  const rows = await prisma.pageSource.findMany({
    where: scope,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const serverIds = rows.flatMap((row) => {
    const id = row.kind === "mcp" ? (row.call as { serverId?: unknown }).serverId : undefined;
    return typeof id === "string" ? [id] : [];
  });
  const servers = serverIds.length
    ? await prisma.mcpServer.findMany({
        where: { id: { in: serverIds }, spaceId: scope.spaceId },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(servers.map((server) => [server.id, server.name]));
  return rows.map((row) =>
    toPageSource(
      row,
      row.kind === "http"
        ? httpHost((row.call as { url?: string }).url)
        : names.get((row.call as { serverId?: string }).serverId ?? ""),
    ),
  );
}

const httpHost = (url: string | undefined) => {
  try {
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
};

/** Delete a source of this bot's page (its snapshots go with it). False when it is not this bot's. */
export async function removePageSource(
  deps: PageDeps,
  scope: { spaceId: string; botId: string },
  where: { id?: string; pageId?: string; name?: string },
): Promise<boolean> {
  const rows = await deps.prisma.pageSource.findMany({
    where: {
      ...scope,
      ...(where.id ? { id: where.id } : {}),
      ...(where.pageId ? { pageId: where.pageId } : {}),
    },
  });
  const wanted = where.name?.toLowerCase();
  const row = rows.find(
    (candidate) => wanted === undefined || candidate.name.toLowerCase() === wanted,
  );
  if (!row) return false;
  const removed = await deps.prisma.pageSource.deleteMany({ where: { id: row.id, ...scope } });
  if (removed.count === 0) return false;
  await announcePageData(deps, row);
  return true;
}

/** Owner changes to one source of this bot. Null when it is not this bot's. */
export async function updatePageSourceByOwner(
  deps: PageSourceDeps,
  scope: { spaceId: string; botId: string },
  sourceId: string,
  change: { schedule: PageSourceSchedule } | { action: "pause" | "resume" },
): Promise<PageSource | null> {
  const where = { id: sourceId, ...scope };
  const row = await deps.prisma.pageSource.findFirst({ where });
  if (!row) return null;
  const now = deps.now?.() ?? new Date();
  let data: Record<string, unknown> | null = null;
  if ("schedule" in change) {
    data = {
      schedule: change.schedule,
      ...(row.status === "active"
        ? { nextRefreshAt: nextScheduledRefresh(now, change.schedule, deps.random) }
        : {}),
    };
  } else if (change.action === "pause" && row.status === "active") {
    data = { status: "paused" };
  } else if (change.action === "resume" && row.status === "paused") {
    data = { status: "active", failures: 0, nextRefreshAt: now };
  }
  if (!data) return toPageSource(row);
  const saved = await deps.prisma.pageSource.update({ where: { id: row.id }, data });
  await announcePageData(deps, row);
  return toPageSource(saved);
}

// ---- Resolving live blocks ----

type SnapshotRow = { value: unknown; fetchedAt: Date };

function rowsAt(value: unknown, path: string): unknown[] | null {
  try {
    const found = jsonPointerGet(value, path);
    return Array.isArray(found) ? found : null;
  } catch {
    return null;
  }
}

function metricText(value: unknown, block: PageMetricBlock): string | null {
  try {
    return formatPinValue(jsonPointerGet(value, block.path), block.format);
  } catch {
    return null;
  }
}

function tableRows(value: unknown, block: PageTableBlock): unknown[] | null {
  const rows = rowsAt(value, block.path);
  if (!rows) return null;
  const objects = rows
    .slice(0, block.limit)
    .map((row) =>
      row !== null && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : { value: row },
    );
  const keys = block.columns?.map((column) => column.key) ?? Object.keys(objects[0] ?? {});
  return objects.map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? null])));
}

function historyRows(snapshots: SnapshotRow[], path: string): { at: string; value: number }[] {
  const points: { at: string; value: number }[] = [];
  for (const snapshot of snapshots) {
    try {
      const raw = jsonPointerGet(snapshot.value, path);
      const number = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
      if (typeof number === "number" && Number.isFinite(number)) {
        points.push({ at: snapshot.fetchedAt.toISOString(), value: number });
      }
    } catch {
      // A snapshot without the path adds no point.
    }
  }
  return points;
}

type LiveRequest =
  | { kind: "metric"; block: PageMetricBlock }
  | { kind: "table"; block: PageTableBlock }
  | { kind: "chart"; chart: PageChart };

const liveRequests = (content: string): LiveRequest[] =>
  splitPage(content).flatMap((segment): LiveRequest[] => {
    if (segment.kind === "metric") return [{ kind: "metric", block: segment.block }];
    if (segment.kind === "table") return [{ kind: "table", block: segment.block }];
    if (segment.kind === "chart" && segment.chart.source !== undefined) {
      return [{ kind: "chart", chart: segment.chart }];
    }
    return [];
  });

const sourceNameOf = (request: LiveRequest) =>
  request.kind === "chart" ? (request.chart.source ?? "") : request.block.source;

/**
 * Live data for a page: one block per metric, table and sourced chart, in document order.
 * Reads stored snapshots only; it never runs a source.
 */
export async function resolvePageData(
  deps: Pick<PageDeps, "prisma">,
  scope: { spaceId: string },
  page: Pick<BotPage, "id" | "botId" | "content" | "revision"> & { kind?: string },
): Promise<PageData> {
  if (page.kind === "html") return resolveHtmlPageData(deps, scope, page);
  return resolveBlocksPageData(deps, scope, page);
}

const HTML_ENTRY_OVERHEAD_BYTES = 40;

/**
 * Data for an HTML page: the sources it names in its praci-sources meta tag and nothing else.
 * A declared name with no source on this page is "missing". Values were redacted when stored.
 * The payload stays under PAGE_HTML_DATA_MAX_BYTES: latest values are placed first, then history
 * newest first across sources, so the oldest history is what gets dropped.
 */
export async function resolveHtmlPageData(
  deps: Pick<PageDeps, "prisma">,
  scope: { spaceId: string },
  page: Pick<BotPage, "id" | "botId" | "content" | "revision">,
): Promise<PageHtmlData> {
  const declaration = htmlPageDeclaration(page.content);
  const rows = declaration.sources.length
    ? await deps.prisma.pageSource.findMany({
        where: { pageId: page.id, botId: page.botId, spaceId: scope.spaceId },
      })
    : [];
  const byName = new Map(rows.map((source) => [source.name.toLowerCase(), source]));
  const wantsHistory = new Set(declaration.history.map((name) => name.toLowerCase()));
  const sources: Record<string, PageHtmlSourceData> = {};
  let budget = PAGE_HTML_DATA_MAX_BYTES;
  const latestIds: { name: string; id: string }[] = [];
  const historyCandidates: { name: string; id: string; at: Date; bytes: number }[] = [];
  for (const name of declaration.sources) {
    const source = byName.get(name.toLowerCase());
    if (!source) {
      sources[name] = { status: "missing", fetchedAt: null };
      continue;
    }
    const metas = await deps.prisma.pageSourceSnapshot.findMany({
      where: { sourceId: source.id, spaceId: scope.spaceId },
      orderBy: { fetchedAt: "desc" },
      take: wantsHistory.has(name.toLowerCase()) ? PAGE_HTML_HISTORY_MAX : 1,
      select: { id: true, fetchedAt: true, bytes: true },
    });
    const latest = metas[0];
    const error = source.lastError ?? undefined;
    const status: PageHtmlSourceData["status"] =
      source.status !== "active"
        ? (source.status as PageHtmlSourceData["status"])
        : !latest
          ? error
            ? "failed"
            : "empty"
          : error
            ? "failed"
            : "ok";
    sources[name] = {
      status,
      fetchedAt: latest?.fetchedAt.toISOString() ?? null,
      ...(error ? { error } : {}),
    };
    // A source the owner has not approved shows no data.
    if (!latest || source.status === "pending" || source.status === "denied") continue;
    const cost = latest.bytes + HTML_ENTRY_OVERHEAD_BYTES;
    if (cost > budget) {
      sources[name] = {
        status: "failed",
        fetchedAt: latest.fetchedAt.toISOString(),
        error: "Too large to show.",
      };
      continue;
    }
    budget -= cost;
    latestIds.push({ name, id: latest.id });
    if (wantsHistory.has(name.toLowerCase()))
      for (const meta of metas)
        historyCandidates.push({ name, id: meta.id, at: meta.fetchedAt, bytes: meta.bytes });
  }
  historyCandidates.sort((a, b) => b.at.getTime() - a.at.getTime());
  const chosen: typeof historyCandidates = [];
  for (const candidate of historyCandidates) {
    const cost = candidate.bytes + HTML_ENTRY_OVERHEAD_BYTES;
    if (cost > budget) continue;
    budget -= cost;
    chosen.push(candidate);
  }
  const ids = [
    ...new Set([...latestIds.map((entry) => entry.id), ...chosen.map((entry) => entry.id)]),
  ];
  const values = new Map(
    ids.length
      ? (
          await deps.prisma.pageSourceSnapshot.findMany({
            where: { id: { in: ids }, spaceId: scope.spaceId },
            select: { id: true, value: true },
          })
        ).map((row) => [row.id, row.value])
      : [],
  );
  for (const { name, id } of latestIds) {
    const target = sources[name];
    if (target && values.has(id)) target.value = values.get(id);
  }
  for (const candidate of chosen) {
    const target = sources[candidate.name];
    if (!target || !values.has(candidate.id)) continue;
    if (!target.history) target.history = [];
    target.history.push({
      at: candidate.at.toISOString(),
      value: values.get(candidate.id),
    });
  }
  // A history source whose entries were all dropped still says it has history, so a page can tell.
  for (const name of declaration.history) {
    const target =
      sources[declaration.sources.find((n) => n.toLowerCase() === name.toLowerCase()) ?? name];
    if (target && target.status !== "missing") target.history ??= [];
  }
  return { kind: "html", pageId: page.id, revision: page.revision, sources };
}

export async function resolveBlocksPageData(
  deps: Pick<PageDeps, "prisma">,
  scope: { spaceId: string },
  page: Pick<BotPage, "id" | "botId" | "content" | "revision">,
): Promise<PageBlocksData> {
  const requests = liveRequests(page.content);
  const sources = requests.length
    ? await deps.prisma.pageSource.findMany({
        where: { pageId: page.id, botId: page.botId, spaceId: scope.spaceId },
      })
    : [];
  const byName = new Map(sources.map((source) => [source.name.toLowerCase(), source]));
  const snapshotCache = new Map<string, Promise<SnapshotRow[]>>();
  // Newest first; history charts take up to 500, everything else uses the first.
  const snapshotsOf = (sourceId: string, take: number) => {
    const key = `${sourceId}:${take}`;
    let cached = snapshotCache.get(key);
    if (!cached) {
      cached = deps.prisma.pageSourceSnapshot.findMany({
        where: { sourceId, spaceId: scope.spaceId },
        orderBy: { fetchedAt: "desc" },
        take,
        select: { value: true, fetchedAt: true },
      });
      snapshotCache.set(key, cached);
    }
    return cached;
  };

  const blocks: PageLiveBlock[] = [];
  for (const request of requests) {
    const source = byName.get(sourceNameOf(request).toLowerCase());
    if (!source) {
      blocks.push({ status: "missing", fetchedAt: null });
      continue;
    }
    const history = request.kind === "chart" && request.chart.over === "history";
    const snapshots = await snapshotsOf(source.id, history ? HISTORY_POINTS : 1);
    const latest = snapshots[0];
    const error = source.lastError ?? undefined;
    const base: PageLiveBlock["status"] =
      source.status !== "active"
        ? (source.status as PageLiveBlock["status"])
        : !latest
          ? error
            ? "failed"
            : "empty"
          : error
            ? "failed"
            : "ok";
    if (!latest) {
      blocks.push({ status: base, fetchedAt: null, ...(error ? { error } : {}) });
      continue;
    }
    let shown: { text?: string; rows?: unknown[] } | null = null;
    if (request.kind === "metric") {
      const text = metricText(latest.value, request.block);
      shown = text === null ? null : { text };
    } else if (request.kind === "table") {
      const rows = tableRows(latest.value, request.block);
      shown = rows ? { rows } : null;
    } else if (history) {
      const rows = historyRows([...snapshots].reverse(), request.chart.path ?? "");
      shown = rows.length ? { rows } : null;
    } else {
      const rows = rowsAt(latest.value, request.chart.path ?? "");
      shown = rows ? { rows: rows.slice(0, CHART_MAX_ROWS) } : null;
    }
    blocks.push({
      status: shown ? base : base === "ok" ? "empty" : base,
      fetchedAt: latest.fetchedAt.toISOString(),
      ...(error ? { error } : {}),
      ...(shown ?? {}),
    });
  }
  return { pageId: page.id, revision: page.revision, blocks };
}

/**
 * Server-rendered SVG for each chart fence in document order. A sourced chart plots its resolved
 * rows; without any, it falls back to its own `data`.
 */
export async function pageChartSvgs(
  deps: Pick<PageDeps, "prisma">,
  scope: { spaceId: string },
  page: Pick<BotPage, "id" | "botId" | "content" | "revision">,
): Promise<string[]> {
  const data = await resolveBlocksPageData(deps, scope, page);
  const live = data.blocks;
  let next = 0;
  const svgs: Promise<string>[] = [];
  for (const segment of splitPage(page.content)) {
    if (segment.kind === "metric" || segment.kind === "table") {
      next++;
    } else if (segment.kind === "chart") {
      const block = segment.chart.source !== undefined ? live[next++] : undefined;
      svgs.push(renderPageChartSvg(segment.chart, block?.rows?.length ? block.rows : undefined));
    }
  }
  return Promise.all(svgs);
}

// ---- Bot tools ----

const NO_PAGE = "This bot has no page yet. Call page_create to add one.";

/** Run a page_source_* built-in tool. Scope comes from the run's bot, never from model input. */
export async function pageSourceToolFromTool(
  name: "page_source_list" | "page_source_set" | "page_source_remove",
  deps: PageSourceDeps,
  scope: PageToolScope,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { prisma } = deps;
  const wantedTitle = typeof args.page === "string" ? args.page.trim() : "";
  let pageId: string | undefined;
  if (wantedTitle) {
    const found = await findPageByTitle(prisma, scope, wantedTitle);
    if (!found) return { error: `There is no page titled "${wantedTitle}". Call page_list.` };
    pageId = found.id;
  }
  const page = await getBotPage(prisma, { spaceId: scope.spaceId, botId: scope.botId, pageId });
  if (!page) return { error: NO_PAGE };
  const pageScope = { spaceId: scope.spaceId, botId: scope.botId, pageId: page.id };
  if (name === "page_source_list") {
    return { page: page.title, sources: await listPageSources(prisma, pageScope) };
  }
  const sourceName = PageSourceNameSchema.safeParse(args.name);
  if (!sourceName.success) {
    return { error: `Source name: ${sourceName.error.issues[0]?.message}` };
  }
  if (name === "page_source_remove") {
    const removed = await removePageSource(deps, pageScope, {
      pageId: page.id,
      name: sourceName.data,
    });
    return removed ? { ok: true } : { error: `There is no source named "${sourceName.data}".` };
  }

  // page_source_set
  if (
    args.kind !== undefined &&
    args.kind !== "praci" &&
    args.kind !== "mcp" &&
    args.kind !== "http"
  ) {
    return { error: 'kind must be "praci", "mcp" or "http".' };
  }
  const kind: "praci" | "mcp" | "http" =
    args.kind === "mcp" || args.kind === "http" ? args.kind : "praci";
  // An mcp or http source is the owner's to approve; a praci source starts active.
  const outside = kind !== "praci";
  const tool = String(args.tool ?? "");
  if (
    args.args !== undefined &&
    (typeof args.args !== "object" || args.args === null || Array.isArray(args.args))
  ) {
    return { error: "args must be an object." };
  }
  const schedule = PageSourceScheduleSchema.safeParse(args.schedule ?? "1h");
  if (!schedule.success) return { error: "schedule must be one of 15m, 1h, 6h, 1d, 1w." };
  const bot = await prisma.bot.findFirst({
    where: { id: scope.botId, spaceId: scope.spaceId, userId: scope.userId },
    select: { ...botColumns, name: true },
  });
  if (!bot) return { error: "This bot is not available." };
  let call: PraciSourceCall | McpSourceCall | HttpSourceCall;
  let serverName: string | undefined;
  if (kind === "mcp") {
    const refusal = sourceBotRefusal(bot);
    if (refusal) return { error: refusal };
    const wanted = String(args.server ?? "")
      .trim()
      .toLowerCase();
    const assigned = await prisma.botMcpServer.findMany({
      where: {
        botId: scope.botId,
        spaceId: scope.spaceId,
        userId: scope.userId,
        server: { enabled: true, spaceId: scope.spaceId, userId: scope.userId },
      },
      select: { server: { select: { id: true, name: true, slug: true } } },
    });
    const server = assigned
      .map((row) => row.server)
      .find(
        (candidate) =>
          wanted !== "" &&
          [candidate.id, candidate.slug, candidate.name].some(
            (value) => value.toLowerCase() === wanted,
          ),
      );
    if (!server) return { error: "server must be the name of an MCP server assigned to this bot." };
    try {
      await checkMcpReadSource(
        deps,
        { spaceId: scope.spaceId, botId: scope.botId, userId: scope.userId },
        { serverId: server.id, tool },
        "page-source",
      );
    } catch (error) {
      return { error: (error instanceof Error ? error.message : String(error)).slice(0, 200) };
    }
    call = { serverId: server.id, tool, args: (args.args as Record<string, unknown>) ?? {} };
    // The card shows the whole request that Allow authorizes, so a request too long to show is refused.
    if (pageSourceRequestLine(call).length > PAGE_SOURCE_REQUEST_LINE_MAX) {
      return {
        error: "The request is too long to show the owner; use fewer or shorter arguments.",
      };
    }
    serverName = server.name;
  } else if (kind === "http") {
    const refusal = sourceBotRefusal(bot);
    if (refusal) return { error: refusal };
    const checked = checkHttpSourceCall({
      url: args.url,
      ...(args.secret !== undefined ? { secret: args.secret } : {}),
      ...(args.accept !== undefined ? { accept: args.accept } : {}),
    });
    if (typeof checked === "string") return { error: checked };
    const blocked = await httpSourceRefusal(
      prisma,
      { spaceId: scope.spaceId, botId: scope.botId, userId: scope.userId },
      checked,
    );
    if (blocked) return { error: blocked };
    call = checked;
    if (pageSourceRequestLine(call).length > PAGE_SOURCE_REQUEST_LINE_MAX) {
      return { error: "The URL is too long to show the owner; use a shorter one." };
    }
    serverName = new URL(checked.url).hostname;
  } else {
    const refusal = await praciSourceRefusal(deps, bot, tool);
    if (refusal) return { error: refusal };
    call = { tool, args: (args.args as Record<string, unknown>) ?? {} };
  }
  const now = deps.now?.() ?? new Date();
  const callHash = outside ? pageSourceCallHash(kind, call as OutsideSourceCall) : null;
  const common = {
    kind,
    call: JSON.parse(JSON.stringify(call)),
    schedule: schedule.data,
    status: outside ? "pending" : "active",
    approvedCallHash: null as string | null,
    failures: 0,
    lastError: null,
    leaseUntil: null,
    nextRefreshAt: outside ? null : nextScheduledRefresh(now, schedule.data, deps.random),
  };
  let saved: SourceRow;
  // An mcp source whose call is new or changed needs a card; the same call only changes its schedule.
  let needsCard = false;
  try {
    saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.pageSource.findMany({ where: pageScope });
      const same = existing.find((row) => row.name.toLowerCase() === sourceName.data.toLowerCase());
      if (!same && existing.length >= PAGE_SOURCES_MAX_PER_PAGE) {
        throw new PageSourceError(`This page already has ${PAGE_SOURCES_MAX_PER_PAGE} sources.`);
      }
      if (!same) {
        const inSpace = await tx.pageSource.count({
          where: { spaceId: scope.spaceId, status: { in: ["active", "pending"] } },
        });
        if (inSpace >= PAGE_SOURCES_MAX_PER_SPACE) {
          throw new PageSourceError(
            `This space already has ${PAGE_SOURCES_MAX_PER_SPACE} active sources. Remove one first.`,
          );
        }
        needsCard = outside;
        return tx.pageSource.create({
          data: { ...pageScope, userId: scope.userId, name: sourceName.data, ...common },
        });
      }
      const sameCall =
        outside &&
        same.kind === kind &&
        pageSourceCallHash(kind, same.call as OutsideSourceCall) === callHash;
      if (sameCall) {
        // Approval is for the call, not the schedule: keep the status. A paused approved source
        // resumes; a denied one stays denied until the call changes.
        const approved = same.approvedCallHash === callHash;
        const resume = same.status === "paused" && approved;
        // Conditional on the row as read: a concurrent change of call, status or approval loses.
        const updated = await tx.pageSource.updateMany({
          where: { id: same.id, ...pageScope, updatedAt: same.updatedAt },
          data: {
            name: sourceName.data,
            schedule: schedule.data,
            ...(resume
              ? {
                  status: "active",
                  failures: 0,
                  lastError: null,
                  leaseUntil: null,
                  nextRefreshAt: now,
                }
              : same.status === "active"
                ? { nextRefreshAt: nextScheduledRefresh(now, schedule.data, deps.random) }
                : {}),
          },
        });
        if (updated.count !== 1) throw new PageSourceError("The source changed; read it again.");
        return tx.pageSource.findFirstOrThrow({ where: { id: same.id, ...pageScope } });
      }
      // A different call means different data: the old snapshots no longer describe the source.
      await tx.pageSourceSnapshot.deleteMany({
        where: { sourceId: same.id, spaceId: scope.spaceId },
      });
      needsCard = outside;
      return tx.pageSource.update({
        where: { id: same.id },
        data: { name: sourceName.data, ...common },
      });
    });
  } catch (error) {
    if (error instanceof PageSourceError) return { error: error.message };
    if (isUniqueViolation(error))
      return { error: "A source with that name was just created. Try again." };
    throw error;
  }
  if (outside) {
    if (needsCard) {
      const run = await prisma.run.findFirst({
        where: { id: scope.runId, spaceId: scope.spaceId, botId: scope.botId },
        select: { id: true, spaceId: true, userId: true, botId: true, threadId: true },
      });
      if (!run) return { error: "Could not ask the owner. Try again." };
      await postPageSourceApproval(
        deps,
        run,
        bot.name,
        pageSourceApprovalBlock({
          sourceId: saved.id,
          callHash: callHash as string,
          serverName: serverName as string,
          schedule: schedule.data,
          pageTitle: page.title,
          call: call as OutsideSourceCall,
        }),
      );
      await announcePageData(deps, saved);
    }
    const fresh = await prisma.pageSource.findFirst({
      where: { id: saved.id, spaceId: scope.spaceId },
    });
    const row = fresh ?? saved;
    if (row.status === "pending") {
      return {
        source: toPageSource(row, serverName),
        status: "pending",
        note: "Waiting for the owner's approval",
      };
    }
    if (row.status === "denied") {
      return {
        source: toPageSource(row, serverName),
        status: "denied",
        note: "The owner declined this request. Change the request to ask again.",
      };
    }
    // Approved earlier and unchanged: run it once now like any source.
    const outcome = await refreshPageSource(deps, row);
    const after = await prisma.pageSource.findFirst({
      where: { id: saved.id, spaceId: scope.spaceId },
    });
    return {
      source: toPageSource(after ?? row, serverName),
      preview: outcome.ok
        ? JSON.stringify(outcome.value).slice(0, PREVIEW_CHARS)
        : `Error: ${outcome.error}`,
    };
  }
  const outcome = await refreshPageSource(deps, saved);
  const fresh = await prisma.pageSource.findFirst({
    where: { id: saved.id, spaceId: scope.spaceId },
  });
  const preview = outcome.ok
    ? JSON.stringify(outcome.value).slice(0, PREVIEW_CHARS)
    : `Error: ${outcome.error}`;
  return { source: toPageSource(fresh ?? saved), preview };
}
