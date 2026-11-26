import type { PrismaClient } from "@rakazo/db";
import { builtinAgentTools } from "./builtin-tools.js";
import { contactToolFromTool } from "./contact-tools.js";
import type { DataRoomToolDeps } from "./data-room-tools.js";
import { dataRoomToolFromTool } from "./data-room-tools.js";
import { financeToolFromTool } from "./finance-tools.js";
import { fundraisingToolFromTool } from "./fundraising-tools.js";
import type { McpAgentDeps } from "./mcp-agent-tools.js";
import {
  AGENT_RUN_STATUS_DESCRIPTOR,
  AGENT_SEND_DESCRIPTOR,
  agentRunState,
  agentSend,
  THREAD_READ_DESCRIPTOR,
  threadRead,
} from "./mcp-agent-tools.js";
import { meetingToolFromTool } from "./meeting-tools.js";
import {
  addScratchpadItemFromTool,
  completeScratchpadItemFromTool,
  listScratchpadItemsFromTool,
  updateScratchpadItemFromTool,
} from "./scratchpad-tools.js";

type Scope = { spaceId: string; userId: string };

/**
 * The one list of bot tools an outside MCP client may call, and the free-text fields of each
 * result. Those fields are written by people or third parties, so they are returned inside
 * `untrusted_text`. A tool joins the list only if it works from stored data, with no run,
 * connector or model behind it. Read tools are listed first, write tools after them.
 *
 * Left out on purpose: `meetings_search` and `meetings_get` (not in the plan's v1 list).
 */
export const MCP_READ_TOOLS = {
  contacts_list: ["name", "organization", "notes"],
  finance_overview: ["text"],
  finance_breakdown: ["name"],
  finance_transactions: ["vendor"],
  finance_recurring: [],
  finance_crypto: ["name", "symbol", "asset"],
  cap_table_read: [],
  // With `prospect`: list details (label, value), the last call note, group, people and referrer.
  fundraising_read: [
    "name",
    "organization",
    "nextStep",
    "label",
    "value",
    "note",
    "group",
    "referredBy",
  ],
  search_data_room: ["name", "snippet"],
  // One string holding the title, attendees and summary (already inside <meeting_notes>).
  meetings_list: ["meeting"],
  scratchpad_list: ["title", "notes", "target", "waitingOn", "proof", "resolvedReason"],
  // Not a bot tool: reads the messages of one of the member's agent threads.
  thread_read: ["text"],
  // Not a bot tool: the state of one of the member's agent runs, and its reply once finished.
  agent_run_status: ["reply"],
} as const satisfies Record<string, readonly string[]>;

/** Read tools that `builtinAgentTools` does not mark `readOnly`, each with the reason it is safe. */
export const MCP_READ_EXCEPTIONS: Record<string, string> = {
  scratchpad_list:
    "Bots call it for their own list, so it is not marked readOnly. The handler only reads, and the dispatcher checks that the bot is the member's.",
};

/** Bot tools that change data. Hidden from read-only connections; each call follows the space's approval rules. */
export const MCP_WRITE_TOOLS = {
  contacts_add: ["name", "organization", "notes"],
  contacts_save: ["name", "organization", "notes"],
  scratchpad_add: ["title", "notes", "waitingOn"],
  scratchpad_update: ["title", "notes", "waitingOn"],
  scratchpad_complete: ["title", "notes", "waitingOn"],
  // Not a bot tool: starts a run of one of the member's agents (trigger `mcp`, unattended and tainted).
  agent_send: ["reply"],
} as const satisfies Record<string, readonly string[]>;

/** Arguments of the bot schema that an outside client may not set (gated categories, proofs, hand-offs). */
const MCP_DROPPED_ARGS: Record<string, readonly string[]> = {
  scratchpad_add: ["category", "channel", "forAgent", "scheduledFor", "target", "items"],
  scratchpad_update: ["category", "channel", "scheduledFor", "target", "proof", "itemIds"],
  scratchpad_complete: ["proof"],
};

export type McpReadToolName = keyof typeof MCP_READ_TOOLS;

export type McpWriteToolName = keyof typeof MCP_WRITE_TOOLS;

export const isMcpReadTool = (name: string): name is McpReadToolName =>
  Object.hasOwn(MCP_READ_TOOLS, name);

export const isMcpWriteTool = (name: string): name is McpWriteToolName =>
  Object.hasOwn(MCP_WRITE_TOOLS, name);

type Schema = { type: "object"; [key: string]: unknown };

/** The bot schema, minus what an outside client may not set, plus the `botId` of scratchpad tools. */
function mcpSchema(name: string, schema: Schema): Schema {
  if (!name.startsWith("scratchpad_")) return schema;
  const dropped = MCP_DROPPED_ARGS[name] ?? [];
  const properties = { ...(schema.properties as Record<string, unknown>) };
  for (const key of dropped) delete properties[key];
  return {
    ...schema,
    properties: {
      botId: { type: "string", description: "The id of an agent from agents_list." },
      ...properties,
    },
    // The bot tools leave these optional for their list forms, which outside clients do not get.
    required: [
      "botId",
      ...(name === "scratchpad_add" ? ["title"] : name === "scratchpad_update" ? ["itemId"] : []),
      ...((schema.required as string[] | undefined) ?? []),
    ],
  };
}

const describeTools = (isListed: (name: string) => boolean) =>
  builtinAgentTools
    .filter((tool) => isListed(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: mcpSchema(tool.name, tool.inputSchema as Schema),
    }));

/** Name, description and JSON Schema of every read tool, taken from the bot definitions. */
export const mcpReadToolDescriptors = () => [
  ...describeTools(isMcpReadTool),
  THREAD_READ_DESCRIPTOR,
  AGENT_RUN_STATUS_DESCRIPTOR,
];

/** The same for the write tools. */
export const mcpWriteToolDescriptors = () => [
  ...describeTools(isMcpWriteTool),
  AGENT_SEND_DESCRIPTOR,
];

/** Moves the listed text fields of every object in `value` under an `untrusted_text` key. */
export function wrapUntrustedText(value: unknown, fields: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => wrapUntrustedText(item, fields));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  const untrusted: Record<string, string> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (fields.includes(key) && typeof inner === "string") untrusted[key] = inner;
    else out[key] = wrapUntrustedText(inner, fields);
  }
  return Object.keys(untrusted).length ? { ...out, untrusted_text: untrusted } : out;
}

const KEYWORD_ONLY = async () => ({
  model: null,
  embedder: null,
  embeddingModel: null,
  recipients: [],
  consentKey: "",
  allowed: false,
});

/**
 * Meeting notes are gated by per-model AI data consent. An outside client has no model in that
 * list: the member connecting it (an active connection, checked on every call) is the consent for
 * that connection, so the handler is told the answer is yes.
 */
const CONNECTION_IS_CONSENT = async () => true;

/** The member's own active agent, or null. A client cannot name another member's or Space's bot. */
export function ownBot(
  prisma: PrismaClient,
  scope: Scope,
  botId: unknown,
): Promise<{ id: string } | null> | null {
  if (typeof botId !== "string" || !botId) return null;
  return prisma.bot.findFirst({
    where: { id: botId, spaceId: scope.spaceId, userId: scope.userId, archivedAt: null },
    select: { id: true },
  });
}

const str = (value: unknown) => (value !== undefined && value !== null ? String(value) : undefined);

/** Runs a read tool through the handler the bots use, for the member and Space of the connection. */
export async function callMcpReadTool(
  name: McpReadToolName,
  deps: { prisma: PrismaClient; scope: Scope },
  args: Record<string, unknown>,
): Promise<unknown> {
  const { prisma, scope } = deps;
  let result: Record<string, unknown>;
  if (name === "contacts_list" || name === "cap_table_read") {
    result = await contactToolFromTool(name, { prisma, scope }, args);
  } else if (name === "fundraising_read") {
    result = await fundraisingToolFromTool(name, { prisma, scope }, args);
  } else if (name === "meetings_list") {
    result = await meetingToolFromTool(
      name,
      { prisma, scope, consentAllowed: CONNECTION_IS_CONSENT },
      args,
    );
  } else if (name === "thread_read") {
    result = await threadRead(prisma, scope, args);
  } else if (name === "agent_run_status") {
    if (typeof args.runId !== "string" || !args.runId) return { error: "runId is required" };
    const state = await agentRunState(prisma, scope, args.runId);
    if (!state) return { error: "Run not found" };
    result = state;
  } else if (name === "scratchpad_list") {
    const bot = await ownBot(prisma, scope, args.botId);
    if (!bot) return { error: "Agent not found" };
    result = await listScratchpadItemsFromTool(
      { prisma },
      { ...scope, botId: bot.id, includeDone: args.includeDone === true },
    );
  } else if (name === "search_data_room") {
    // Search only reads the Data room. Keyword search needs no model, mail or Drive account.
    result = await dataRoomToolFromTool(
      name,
      { prisma, scope, resolveAi: KEYWORD_ONLY } as unknown as DataRoomToolDeps,
      {} as Parameters<typeof dataRoomToolFromTool>[2],
      args,
    );
  } else {
    result = await financeToolFromTool(name, { prisma, scope }, args);
  }
  return wrapUntrustedText(result, MCP_READ_TOOLS[name]);
}

/**
 * Runs a write tool through the handler the bots use. The caller has already applied the
 * connection's scopes and the space's approval rules; this only makes the change.
 */
export async function callMcpWriteTool(
  name: McpWriteToolName,
  deps: {
    prisma: PrismaClient;
    scope: Scope;
    /** Needed by agent_send. `key` makes a repeated send of the same action idempotent. */
    agents?: McpAgentDeps;
    connectionId?: string;
    key?: string;
    /** Wait for the agent's reply (a direct call), or return as soon as the run has started. */
    wait?: boolean;
  },
  args: Record<string, unknown>,
): Promise<unknown> {
  const { prisma, scope } = deps;
  let result: Record<string, unknown>;
  if (name === "agent_send") {
    result = await agentSend(prisma, deps.agents, scope, deps.connectionId ?? "", args, {
      wait: deps.wait !== false,
      key: deps.key,
    });
  } else if (name === "contacts_add" || name === "contacts_save") {
    result = await contactToolFromTool(name, { prisma, scope }, args);
  } else {
    const bot = await ownBot(prisma, scope, args.botId);
    if (!bot) return { error: "Agent not found" };
    const own = { ...scope, botId: bot.id };
    if (name === "scratchpad_add") {
      result = await addScratchpadItemFromTool(
        { prisma },
        {
          ...own,
          title: String(args.title ?? ""),
          status: str(args.status),
          notes: str(args.notes),
          dueAt: str(args.dueAt),
          waitingOn: str(args.waitingOn),
        },
      );
    } else if (name === "scratchpad_update") {
      result = await updateScratchpadItemFromTool(
        { prisma },
        {
          ...own,
          itemId: String(args.itemId ?? ""),
          title: str(args.title),
          status: str(args.status),
          notes: str(args.notes),
          dueAt: args.dueAt === null ? null : str(args.dueAt),
          waitingOn: str(args.waitingOn),
        },
      );
    } else {
      result = await completeScratchpadItemFromTool(
        { prisma },
        { ...own, itemId: String(args.itemId ?? ""), reason: str(args.reason) },
      );
    }
  }
  return wrapUntrustedText(result, MCP_WRITE_TOOLS[name]);
}
