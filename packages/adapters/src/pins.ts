import { isDeepStrictEqual } from "node:util";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AdapterContext, JobPublisher } from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import type {
  BotPins,
  PageAuthor,
  PinFormat,
  PinList,
  PinSource,
  PinStat,
} from "@rakazo/contracts";
import { BotPinsSchema, PinListSchema } from "@rakazo/contracts";
import { connectorToolRequiresApproval } from "@rakazo/core";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { isUniqueViolation, Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { unwrapToolResult } from "./finance-call-tool.js";
import type { McpConnector } from "./mcp-connector.js";
import { assignmentAllowsTool } from "./mcp-connector.js";

export const PIN_SOURCE_TIMEOUT_MS = 15_000;
const REFRESH_PROMPT = "Update your pinned numbers.";

export interface PinsDeps {
  prisma: PrismaClient;
  events: Pick<ThreadEvents, "append">;
  /** Lists a server's tools so a source can be checked against the tool's annotations. */
  mcp?: Pick<McpConnector, "listServerTools">;
}

export interface PinsRefreshDeps extends PinsDeps {
  events: Pick<ThreadEvents, "append" | "sendUserMessage">;
  jobs: Pick<JobPublisher, "enqueue">;
  mcp?: Pick<McpConnector, "callServerTool" | "listServerTools">;
}

export interface PinsScope {
  spaceId: string;
  botId: string;
  /** The bot's owner; the caller has already checked the bot belongs to this space and user. */
  userId: string;
}

export interface PinsSaveInput {
  /** Only the sections given are replaced. */
  stats?: PinStat[];
  list?: PinList | null;
  /** 0 creates the pins. */
  baseRevision: number;
  updatedBy: PageAuthor;
  refreshedAt?: Date;
  sourceRunId?: string;
}

export type PinsSaveResult =
  | { ok: true; pins: BotPins }
  | { ok: false; reason: "conflict"; pins: BotPins | null };

/** The pins are not valid. The message is written for the model or user to act on. */
export class PinsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PinsValidationError";
  }
}

/** Value at an RFC 6901 JSON Pointer ("" is the whole document). Throws when it is absent. */
export function jsonPointerGet(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  if (!pointer.startsWith("/")) throw new Error(`Path "${pointer}" must start with "/"`);
  let current = doc;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key) ||
      (Array.isArray(current) && !/^(0|[1-9]\d*)$/.test(key))
    ) {
      throw new Error(`Nothing at "${pointer}" in the result`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Display text for a value; stays within the 40 characters a stat allows. */
export function formatPinValue(value: unknown, format: PinFormat): string {
  if (format === "text") {
    return (typeof value === "string" ? value : JSON.stringify(value)).slice(0, 40);
  }
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error("The value is not a number");
  if (format === "percent") return `${n.toFixed(1)}%`;
  if (format === "number") return new Intl.NumberFormat("en-US").format(n);
  const digits = Math.abs(n) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

type PinsRow = {
  botId: string;
  stats: unknown;
  list: unknown;
  revision: number;
  updatedBy: string;
  updatedAt: Date;
  refreshedAt: Date | null;
};

function toBotPins(row: PinsRow): BotPins {
  return {
    botId: row.botId,
    stats: row.stats as PinStat[],
    list: row.list as PinList | null,
    revision: row.revision,
    updatedBy: row.updatedBy === "user" ? "user" : "bot",
    updatedAt: row.updatedAt.toISOString(),
    refreshedAt: row.refreshedAt?.toISOString() ?? null,
  };
}

export async function getBotPins(
  prisma: PrismaClient,
  scope: { spaceId: string; botId: string },
): Promise<BotPins | null> {
  const row = await prisma.botPins.findFirst({
    where: { botId: scope.botId, spaceId: scope.spaceId },
  });
  return row ? toBotPins(row) : null;
}

/** MCP tools often use camelCase (getAccounts); the approval name check expects snake_case. */
function toolNameIsReadOnly(tool: string): boolean {
  return !connectorToolRequiresApproval(tool.replace(/([a-z0-9])([A-Z])/g, "$1_$2"));
}

function pinContext(scope: PinsScope): AdapterContext {
  return {
    operationId: `pins:${scope.botId}`,
    traceId: `pins:${scope.botId}`,
    spaceId: scope.spaceId,
    userId: scope.userId,
    botId: scope.botId,
    signal: AbortSignal.timeout(PIN_SOURCE_TIMEOUT_MS),
  };
}

/**
 * Looks up the source's server and checks the call is safe to rerun without a model. The server
 * must be enabled and belong to the bot's space and owner, the bot must still be assigned to it,
 * and the assignment must allow the tool (the rule a bot run uses). The server must list the tool.
 * A tool is read-only only when no annotation declares a write (readOnlyHint false, destructiveHint
 * true) and its name reads as a get/list/search/read, the same rule that exempts a run from approval.
 */
async function checkSource(deps: PinsDeps, scope: PinsScope, source: PinSource) {
  const { prisma } = deps;
  const assignment = await prisma.botMcpServer.findFirst({
    where: {
      botId: scope.botId,
      serverId: source.serverId,
      spaceId: scope.spaceId,
      userId: scope.userId,
      server: { enabled: true, spaceId: scope.spaceId, userId: scope.userId },
    },
    include: { server: true, bot: { select: { spawnKey: true, spaceId: true, userId: true } } },
  });
  if (!assignment) throw new Error(`MCP tool ${source.tool} is not assigned to this bot`);
  if (!deps.mcp) throw new Error("MCP is not available");
  const tools = await deps.mcp.listServerTools(assignment.server, pinContext(scope));
  const meta = tools.find((tool) => tool.name === source.tool);
  // The gate needs the tool's annotations (an integration agent's reads) and the bot's owner.
  if (!assignmentAllowsTool(assignment, source.tool, meta?.annotations)) {
    throw new Error(`MCP tool ${source.tool} is not assigned to this bot`);
  }
  if (!meta) throw new Error(`Tool ${source.tool} is not offered by the server`);
  const hints = meta.annotations;
  // Never rerun what a bot run would need approval for: the name rule applies whatever the server claims.
  const readOnly =
    hints?.readOnlyHint !== false &&
    hints?.destructiveHint !== true &&
    toolNameIsReadOnly(source.tool);
  if (!readOnly) {
    throw new Error(`Tool ${source.tool} is not read-only, so it cannot be a pin source`);
  }
  return assignment.server;
}

async function validateInput(
  deps: PinsDeps,
  scope: PinsScope,
  input: PinsSaveInput,
  checkSources: boolean,
) {
  if (input.stats !== undefined) {
    const parsed = BotPinsSchema.shape.stats.safeParse(input.stats);
    if (!parsed.success) throw new PinsValidationError(zodMessage("stats", parsed.error));
    const ids = new Set(input.stats.map((stat) => stat.id));
    if (ids.size !== input.stats.length) throw new PinsValidationError("Stat ids must be unique.");
    for (const stat of input.stats) {
      if (!stat.source || !checkSources) continue;
      await checkSource(deps, scope, stat.source).catch((error) => {
        throw new PinsValidationError(`Stat "${stat.id}": ${(error as Error).message}`);
      });
    }
  }
  if (input.list) {
    const parsed = PinListSchema.safeParse(input.list);
    if (!parsed.success) throw new PinsValidationError(zodMessage("list", parsed.error));
    if (new Set(input.list.items.map((item) => item.id)).size !== input.list.items.length) {
      throw new PinsValidationError("List item ids must be unique.");
    }
  }
}

function zodMessage(
  section: string,
  error: { issues: { path: PropertyKey[]; message: string }[] },
) {
  const issue = error.issues[0];
  return `Invalid ${section}${issue ? ` at ${[section, ...issue.path].join(".")}: ${issue.message}` : ""}`;
}

/**
 * Validate and save a bot's pins, then announce it on the bot's thread. A stale baseRevision
 * writes nothing and returns the current pins. Shared by the pins RPC, refresh and the pins tools.
 */
export function saveBotPins(
  deps: PinsDeps,
  scope: PinsScope,
  input: PinsSaveInput,
): Promise<PinsSaveResult> {
  return savePins(deps, scope, input, true);
}

/** Refresh passes false: its stats come from the stored row, and a source that went bad must still get its error marker. */
async function savePins(
  deps: PinsDeps,
  scope: PinsScope,
  input: PinsSaveInput,
  checkSources: boolean,
): Promise<PinsSaveResult> {
  const { prisma } = deps;
  await validateInput(deps, scope, input, checkSources);
  const where = { spaceId: scope.spaceId, botId: scope.botId };
  let saved: PinsRow | null;
  try {
    saved = await prisma.$transaction(async (tx) => {
      const current = await tx.botPins.findFirst({ where });
      if ((current?.revision ?? 0) !== input.baseRevision) return null;
      const revision = input.baseRevision + 1;
      const data = {
        ...(input.stats !== undefined && { stats: input.stats as Prisma.InputJsonValue }),
        ...(input.list !== undefined && {
          list: input.list === null ? Prisma.DbNull : (input.list as Prisma.InputJsonValue),
        }),
        ...(input.stats !== undefined && input.refreshedAt && { refreshedAt: input.refreshedAt }),
        revision,
        updatedBy: input.updatedBy,
      };
      if (current) {
        // The revision in the where clause makes a concurrent save lose instead of overwrite.
        const claimed = await tx.botPins.updateMany({
          where: { id: current.id, revision: current.revision },
          data,
        });
        if (claimed.count === 0) return null;
        return await tx.botPins.findUniqueOrThrow({ where: { id: current.id } });
      }
      return await tx.botPins.create({
        data: { ...where, userId: scope.userId, ...data, stats: data.stats ?? [] },
      });
    });
  } catch (error) {
    // Two creates raced on the unique botId.
    if (!isUniqueViolation(error)) throw error;
    saved = null;
  }
  if (!saved) return { ok: false, reason: "conflict", pins: await getBotPins(prisma, where) };
  const thread = await prisma.thread.findFirst({ where, select: { id: true } });
  if (thread) {
    // The saved pins are the source of truth; a missed event only delays a client refresh.
    await deps.events
      .append({
        spaceId: scope.spaceId,
        threadId: thread.id,
        botId: scope.botId,
        type: "pins.updated",
        runId: input.sourceRunId,
        payload: { revision: saved.revision, updatedBy: input.updatedBy },
      })
      .catch((error) => {
        getLogger().warn("pins.updated append failed", {
          error: error instanceof Error ? error.message : String(error),
          botId: scope.botId,
        });
      });
  }
  return { ok: true, pins: toBotPins(saved) };
}

export interface PinsToolScope extends PinsScope {
  runId: string;
}

/** Run a pins_* built-in tool. Scope comes from the run's bot, never from model input. */
export async function pinsToolFromTool(
  name: "pins_read" | "pins_write",
  deps: PinsDeps,
  scope: PinsToolScope,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await getBotPins(deps.prisma, scope);
  if (name === "pins_read") {
    return {
      stats: current?.stats ?? [],
      list: current?.list ?? null,
      revision: current?.revision ?? 0,
      refreshedAt: current?.refreshedAt ?? null,
    };
  }
  const baseRevision = Number(args.baseRevision);
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    return { error: "baseRevision must be the revision from pins_read (0 for new pins)." };
  }
  if (args.stats === undefined && args.list === undefined) {
    return { error: "Give stats, list, or both." };
  }
  try {
    const result = await saveBotPins(
      deps,
      { spaceId: scope.spaceId, botId: scope.botId, userId: scope.userId },
      {
        ...(args.stats !== undefined && { stats: args.stats as PinStat[] }),
        ...(args.list !== undefined && { list: args.list as PinList | null }),
        baseRevision,
        updatedBy: "bot",
        refreshedAt: new Date(),
        sourceRunId: scope.runId,
      },
    );
    if (result.ok) return { ok: true, revision: result.pins.revision };
    return {
      error:
        "The pins changed since you read them. Nothing was saved; reapply your change to the current pins.",
      stats: result.pins?.stats ?? [],
      list: result.pins?.list ?? null,
      revision: result.pins?.revision ?? 0,
    };
  } catch (error) {
    if (error instanceof PinsValidationError) return { error: error.message };
    throw error;
  }
}

type StatOutcome = { value: string; error?: undefined } | { error: string };

async function readSource(
  deps: PinsRefreshDeps,
  scope: PinsScope,
  source: PinSource,
): Promise<StatOutcome> {
  try {
    const server = await checkSource(deps, scope, source);
    if (!deps.mcp) throw new Error("MCP is not available");
    const context = pinContext(scope);
    const { signal } = context;
    const timedOut = new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(new Error("Timed out")), { once: true }),
    );
    const result: CallToolResult = await Promise.race([
      deps.mcp.callServerTool(server, context, source.tool, source.args),
      timedOut,
    ]);
    return {
      value: formatPinValue(jsonPointerGet(unwrapToolResult(result), source.path), source.format),
    };
  } catch (error) {
    return { error: (error instanceof Error ? error.message : String(error)).slice(0, 200) };
  }
}

/**
 * Rerun every sourced stat in parallel (no model), keeping the old value and setting `error` for
 * one that fails. If some stat has no source, ask the bot to update its numbers: that message
 * starts a run, or steers the one already running. Returns null when the bot has no pins.
 */
export async function refreshBotPins(
  deps: PinsRefreshDeps,
  scope: PinsScope,
): Promise<{ pins: BotPins; botRun: boolean } | null> {
  let pins = await getBotPins(deps.prisma, scope);
  if (!pins) return null;
  const outcomes = new Map<string, { source: PinSource; outcome: StatOutcome }>(
    await Promise.all(
      pins.stats.flatMap((stat) => {
        const { source } = stat;
        return source
          ? [
              readSource(deps, scope, source).then(
                (outcome): [string, { source: PinSource; outcome: StatOutcome }] => [
                  stat.id,
                  { source, outcome },
                ],
              ),
            ]
          : [];
      }),
    ),
  );
  if (outcomes.size > 0) {
    // Apply onto the latest stats; a user list save in the meantime only bumps the revision.
    for (let attempt = 0; attempt < 3 && pins; attempt += 1) {
      const stats = pins.stats.map((stat): PinStat => {
        const called = outcomes.get(stat.id);
        // A stat whose source changed since the call keeps what it has.
        if (!called || !isDeepStrictEqual(stat.source, called.source)) return stat;
        const { outcome } = called;
        const { error: _cleared, ...rest } = stat;
        return outcome.error === undefined
          ? { ...rest, value: outcome.value }
          : { ...rest, error: outcome.error };
      });
      const saved = await savePins(
        deps,
        scope,
        { stats, baseRevision: pins.revision, updatedBy: "bot", refreshedAt: new Date() },
        false,
      );
      pins = saved.pins;
      if (saved.ok || !pins) break;
    }
    if (!pins) return null;
  }
  const botRun = pins.stats.some((stat) => !stat.source);
  if (botRun) {
    const thread = await deps.prisma.thread.findFirst({
      where: { botId: scope.botId, spaceId: scope.spaceId },
      select: { id: true },
    });
    if (thread) {
      const sent = await deps.events.sendUserMessage({
        spaceId: scope.spaceId,
        threadId: thread.id,
        botId: scope.botId,
        userId: scope.userId,
        blocks: [{ kind: "text", text: REFRESH_PROMPT }],
        prompt: REFRESH_PROMPT,
        trigger: "user",
      });
      if (sent.taskId && sent.runId) {
        await deps.jobs.enqueue(runContinueJob(sent.runId)).catch((error) => {
          getLogger().error("pins refresh enqueue", error);
        });
      }
    }
    return { pins, botRun: thread !== null };
  }
  return { pins, botRun: false };
}
