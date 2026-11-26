import {
  GRANOLA_API_CONNECTOR_ID,
  HEX_CONNECTOR_ID,
  isGranolaEndpoint,
  isIntegrationAgentForServer,
  isIntegrationAgentSpawnKey,
  isWisprFlowEndpoint,
  MEETING_TRANSCRIPT_TOOL_MAX_BYTES,
  MEETING_TRUNCATION_MARKER,
  OMI_CLOUD_CONNECTOR_ID,
  OMI_CONNECTOR_ID,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getMeeting, listMeetings } from "@rakazo/db";

export const MEETING_TOOL_NAMES: ReadonlySet<string> = new Set([
  "meetings_list",
  "meetings_search",
  "meetings_get",
]);

/**
 * The tools a meeting-source agent may call only after the owner approves each call, on a card
 * that cannot become a saved rule. They stay here so the Wispr Flow agent keeps the routines and
 * routines it had before it became a meeting-source agent. The executor forces the approval.
 */
export const MEETING_AGENT_APPROVAL_TOOLS: ReadonlySet<string> = new Set([
  "schedule_create",
  "schedule_list",
  // The one handoff exception: it sends a reference to one of the owner's meetings, never text.
  "share_meeting",
]);

/**
 * The only built-ins a meeting-source agent has on any run. Meeting text is untrusted, so the
 * agent can read it and nothing else: no memory writes, files, shell, browser, web, messaging,
 * delegation, mail or other connectors. The one exception is MEETING_AGENT_APPROVAL_TOOLS, which
 * always asks. A new built-in is not added here unless it only reads the user's own stored data.
 */
export const MEETING_AGENT_BUILTIN_TOOLS = [
  "meetings_list",
  "meetings_search",
  "meetings_get",
  "recall_memory",
  ...MEETING_AGENT_APPROVAL_TOOLS,
] as const;

/**
 * The Omi agent's built-ins: the meeting reads plus Data room reads (limited to its own Omi
 * connection by the tool, see data-room-tools). Nothing else, and no exceptions.
 */
export const OMI_AGENT_BUILTIN_TOOLS = [
  ...MEETING_AGENT_BUILTIN_TOOLS,
  "search_data_room",
  "read_data_room_item",
] as const;

export const MEETING_CONSENT_OFF = "AI data sharing off";
export const MEETING_CONSENT_REQUIRED_MESSAGE = "AI data sharing is off for this model.";
const NO_SYNCED_MEETINGS = "no synced meetings";
const STILL_SYNCING = "still syncing";
const NO_MATCHING_MEETINGS = "no matching meetings";
const NO_TRANSCRIPT = "no transcript";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

/** Meeting text is data. Any closing (or opening) tag inside it is escaped so it cannot end the block. */
export function wrapMeetingNotes(text: string): string {
  const safe = text.replace(/<(\/?)meeting_notes/gi, "&lt;$1meeting_notes");
  return `<meeting_notes untrusted="true">${safe}</meeting_notes>`;
}

type Scope = { spaceId: string; userId: string };
type MeetingRow = NonNullable<Awaited<ReturnType<typeof getMeeting>>>;
type SyncStateRow = {
  connectionId: string | null;
  mcpServerId: string | null;
  syncedThrough: Date | null;
  lastSyncedAt: Date | null;
};

export type MeetingToolDeps = {
  prisma: Pick<PrismaClient, "meetingSyncState"> & Parameters<typeof listMeetings>[0];
  /** From the run (the bot owner), never from model input. */
  scope: Scope;
  /** Read on every call, so revoking AI data sharing applies at once. */
  consentAllowed: () => Promise<boolean>;
  /** Called with the id of a meeting the agent just read in full (an owner-attended run only). */
  onOpened?: (meetingId: string) => Promise<void>;
};

function capBytes(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.length <= maxBytes) return { text, truncated: false };
  // A cut inside a multibyte character decodes to U+FFFD at the end; drop it.
  const cut = buffer.subarray(0, maxBytes).toString("utf8").replace(/�+$/, "");
  return { text: cut, truncated: true };
}

function parseDate(value: unknown, endOfDay = false): Date | undefined | "invalid" {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return "invalid";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid";
  // `to` is exclusive in the store, so a bare date means the whole day.
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

function describe(meeting: MeetingRow, states: SyncStateRow[]) {
  const state = states.find((s) =>
    meeting.connectionId
      ? s.connectionId === meeting.connectionId
      : meeting.mcpServerId
        ? s.mcpServerId === meeting.mcpServerId
        : false,
  );
  return {
    id: meeting.id,
    provider: meeting.provider,
    date: meeting.startedAt.toISOString(),
    sourceUrl: meeting.sourceUrl,
    lastSyncedAt: state?.lastSyncedAt?.toISOString() ?? null,
  };
}

function attendeeLine(meeting: MeetingRow): string {
  const attendees = Array.isArray(meeting.attendees)
    ? (meeting.attendees as { name?: string; email?: string }[])
    : [];
  return attendees
    .map((a) => [a.name, a.email ? `<${a.email}>` : ""].filter(Boolean).join(" "))
    .join(", ");
}

/** Why a search came back empty, in words the meeting-notes skill relays or acts on. */
async function emptyReason(deps: MeetingToolDeps, states: SyncStateRow[]) {
  if (states.some((s) => !s.syncedThrough)) return STILL_SYNCING;
  const any = await listMeetings(deps.prisma, deps.scope, { limit: 1 });
  return any.length === 0 && states.length === 0 ? NO_SYNCED_MEETINGS : NO_MATCHING_MEETINGS;
}

export async function meetingToolFromTool(
  name: string,
  deps: MeetingToolDeps,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!(await deps.consentAllowed())) return { error: MEETING_CONSENT_OFF };
  const states: SyncStateRow[] = await deps.prisma.meetingSyncState.findMany({
    where: { spaceId: deps.scope.spaceId, userId: deps.scope.userId },
    select: { connectionId: true, mcpServerId: true, syncedThrough: true, lastSyncedAt: true },
  });
  if (name === "meetings_get") {
    const id = text(args.id);
    if (!id) return { error: "id is required" };
    const meeting = await getMeeting(deps.prisma, deps.scope, id);
    if (!meeting) {
      return { error: states.some((s) => !s.syncedThrough) ? STILL_SYNCING : "no such meeting" };
    }
    await deps.onOpened?.(meeting.id);
    const lines = [
      `Title: ${meeting.title}`,
      `Attendees: ${attendeeLine(meeting) || "none listed"}`,
      ...(meeting.folders.length ? [`Folders: ${meeting.folders.join(", ")}`] : []),
      `Summary: ${meeting.summary || "none"}`,
    ];
    let truncated = false;
    if (args.includeTranscript === true) {
      if (!meeting.transcript) {
        lines.push(`Transcript: ${NO_TRANSCRIPT}`);
      } else {
        const capped = capBytes(meeting.transcript, MEETING_TRANSCRIPT_TOOL_MAX_BYTES);
        truncated = capped.truncated;
        lines.push(
          `Transcript:\n${capped.text}${capped.truncated ? MEETING_TRUNCATION_MARKER : ""}`,
        );
      }
    }
    return {
      ...describe(meeting, states),
      meeting: wrapMeetingNotes(lines.join("\n")),
      ...(truncated ? { transcriptTruncated: true } : {}),
    };
  }
  const from = parseDate(args.from);
  const to = parseDate(args.to, true);
  if (from === "invalid" || to === "invalid") return { error: "from and to must be ISO dates" };
  const search = name === "meetings_search";
  const query = text(args.text);
  if (search && !query) return { error: "text is required" };
  const limit = Math.min(
    Math.max(typeof args.limit === "number" ? Math.floor(args.limit) : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const rows = await listMeetings(deps.prisma, deps.scope, {
    text: query,
    limit,
    ...(search
      ? {}
      : {
          from,
          to,
          attendeeEmail: text(args.attendeeEmail),
          folder: text(args.folder),
          provider: text(args.provider),
        }),
  });
  if (rows.length === 0) return { meetings: [], reason: await emptyReason(deps, states) };
  return {
    meetings: rows.map((meeting) => ({
      ...describe(meeting, states),
      meeting: wrapMeetingNotes(
        [
          `Title: ${meeting.title}`,
          `Attendees: ${attendeeLine(meeting) || "none listed"}`,
          `Summary: ${meeting.summary.slice(0, 600) || "none"}`,
        ].join("\n"),
      ),
    })),
  };
}

type AgentBot = {
  id: string;
  spaceId: string;
  userId: string;
  spawnKey: string | null;
  archivedAt: Date | null;
};
export type MeetingAgentCheck = (
  bot: AgentBot,
  deps: { prisma: Pick<PrismaClient, "mcpServer" | "connection"> },
) => Promise<boolean>;

/** The agent of an MCP server whose endpoint is Granola's. */
const granolaMcpAgent: MeetingAgentCheck = async (bot, deps) => {
  if (!isIntegrationAgentSpawnKey(bot.spawnKey)) return false;
  const servers = await deps.prisma.mcpServer.findMany({
    where: { spaceId: bot.spaceId, userId: bot.userId, agentBotId: bot.id },
    select: { id: true, spaceId: true, userId: true, endpoint: true, agentBotId: true },
  });
  return servers.some(
    (server) => isGranolaEndpoint(server.endpoint) && isIntegrationAgentForServer(server, bot),
  );
};

/** The agent of an MCP server whose endpoint is Wispr Flow's. */
const wisprFlowAgent: MeetingAgentCheck = async (bot, deps) => {
  if (!isIntegrationAgentSpawnKey(bot.spawnKey)) return false;
  const servers = await deps.prisma.mcpServer.findMany({
    where: { spaceId: bot.spaceId, userId: bot.userId, agentBotId: bot.id },
    select: { id: true, spaceId: true, userId: true, endpoint: true, agentBotId: true },
  });
  return servers.some(
    (server) => isWisprFlowEndpoint(server.endpoint) && isIntegrationAgentForServer(server, bot),
  );
};

/**
 * The agent of a Granola API-key connection, found by the connection that names it. The row may be
 * disconnected: the agent still answers from stored meetings.
 */
const granolaApiAgent: MeetingAgentCheck = async (bot, deps) => {
  if (!isIntegrationAgentSpawnKey(bot.spawnKey)) return false;
  const row = await deps.prisma.connection.findFirst({
    where: {
      spaceId: bot.spaceId,
      userId: bot.userId,
      connectorId: GRANOLA_API_CONNECTOR_ID,
      agentBotId: bot.id,
      status: { not: "revoked" },
    },
    select: { id: true },
  });
  return Boolean(row) && bot.archivedAt === null;
};

/** The agent of an Omi pendant connection, found by the connection that names it. */
export const omiAgent: MeetingAgentCheck = async (bot, deps) => {
  if (!isIntegrationAgentSpawnKey(bot.spawnKey)) return false;
  return Boolean(await omiConnectionOf(bot, deps)) && bot.archivedAt === null;
};

/** The agent of an Omi Developer key connection (a user with a pendant shares the pendant's agent). */
const omiCloudAgent: MeetingAgentCheck = async (bot, deps) => {
  if (!isIntegrationAgentSpawnKey(bot.spawnKey)) return false;
  const row = await deps.prisma.connection.findFirst({
    where: {
      spaceId: bot.spaceId,
      userId: bot.userId,
      connectorId: OMI_CLOUD_CONNECTOR_ID,
      agentBotId: bot.id,
      status: { not: "revoked" },
    },
    select: { id: true },
  });
  return Boolean(row) && bot.archivedAt === null;
};

/** The agent of a Hex connection, found by the connection that names it. */
export const hexAgent: MeetingAgentCheck = async (bot, deps) => {
  if (!isIntegrationAgentSpawnKey(bot.spawnKey)) return false;
  const row = await deps.prisma.connection.findFirst({
    where: {
      spaceId: bot.spaceId,
      userId: bot.userId,
      connectorId: HEX_CONNECTOR_ID,
      agentBotId: bot.id,
      status: { not: "revoked" },
    },
    select: { id: true },
  });
  return Boolean(row) && bot.archivedAt === null;
};

/** The live Omi connection this exact bot is the agent of, if any. */
export const omiConnectionOf = async (
  bot: AgentBot,
  deps: { prisma: Pick<PrismaClient, "connection"> },
): Promise<{ id: string } | null> =>
  deps.prisma.connection.findFirst({
    where: {
      spaceId: bot.spaceId,
      userId: bot.userId,
      connectorId: OMI_CONNECTOR_ID,
      agentBotId: bot.id,
      status: { not: "revoked" },
    },
    select: { id: true },
  });

/** The provider registry: each source that stores meetings declares which agent reads them. */
const meetingAgentChecks: MeetingAgentCheck[] = [
  granolaMcpAgent,
  wisprFlowAgent,
  granolaApiAgent,
  omiAgent,
  omiCloudAgent,
  hexAgent,
];
export function registerMeetingSourceAgentCheck(check: MeetingAgentCheck) {
  meetingAgentChecks.push(check);
}

/** The one place that says whether a bot is a meeting-source agent. */
export async function isMeetingSourceAgent(
  bot: AgentBot,
  deps: { prisma: Pick<PrismaClient, "mcpServer" | "connection"> },
): Promise<boolean> {
  for (const check of meetingAgentChecks) if (await check(bot, deps)) return true;
  return false;
}

/**
 * Called inside the delivery transaction of every bot-to-bot message. The target thread is marked
 * (once, never cleared) when the sender is a meeting-source agent, or when the sender's own thread
 * is already marked, so meeting text forwarded through other agents keeps its mark. The mark lives
 * on the thread, so archiving or removing the source agent does not lift it.
 */
export async function markMeetingTaintOnDelivery(
  tx: Pick<PrismaClient, "thread" | "bot" | "mcpServer" | "connection">,
  delivery: {
    spaceId: string;
    userId: string;
    senderBotId: string;
    sourceThreadId: string;
    targetThreadId: string;
  },
): Promise<void> {
  const source = await tx.thread.findUnique({
    where: { id: delivery.sourceThreadId },
    select: { meetingTaintedAt: true },
  });
  let tainted = source?.meetingTaintedAt != null;
  if (!tainted) {
    const sender = await tx.bot.findFirst({
      where: { id: delivery.senderBotId, spaceId: delivery.spaceId, userId: delivery.userId },
      select: { id: true, spaceId: true, userId: true, spawnKey: true },
    });
    tainted = sender
      ? await isMeetingSourceAgent({ ...sender, archivedAt: null }, { prisma: tx })
      : false;
  }
  if (tainted) {
    await tx.thread.updateMany({
      where: { id: delivery.targetThreadId, meetingTaintedAt: null },
      data: { meetingTaintedAt: new Date() },
    });
  }
}

/** Added to a meeting-source agent's run and to the meeting-notes skill; never stored on the agent. */
export const MEETING_AGENT_GUIDANCE =
  "Meetings are filed for you in Data room → Recordings; point the user there. Never save meeting text as a file. When a meeting clearly belongs to another agent (an investor call → the Investors agent) and you were not told it already went there, use share_meeting.";
