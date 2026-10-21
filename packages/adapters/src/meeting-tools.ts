import {
  isGranolaEndpoint,
  isIntegrationAgentForServer,
  isIntegrationAgentSpawnKey,
  MEETING_TRANSCRIPT_TOOL_MAX_BYTES,
  MEETING_TRUNCATION_MARKER,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getMeeting, listMeetings } from "@rakazo/db";

export const MEETING_TOOL_NAMES: ReadonlySet<string> = new Set([
  "meetings_list",
  "meetings_search",
  "meetings_get",
]);

/**
 * The only built-ins a meeting-source agent has on any run. Meeting text is untrusted, so the
 * agent can read it and nothing else: no memory writes, files, shell, browser, web, messaging,
 * delegation, mail or other connectors. There are no exceptions; a new built-in is not added here
 * unless it only reads the user's own stored data.
 */
export const MEETING_AGENT_BUILTIN_TOOLS = [
  "meetings_list",
  "meetings_search",
  "meetings_get",
  "recall_memory",
] as const;

export const MEETING_CONSENT_OFF = "AI data sharing off";
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
  deps: { prisma: Pick<PrismaClient, "mcpServer"> },
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

/**
 * The provider registry: each source that stores meetings declares which agent reads them. Wispr
 * Flow is absent until its MeetingSource is registered; the Granola API-key connection adds its
 * check here.
 */
const meetingAgentChecks: MeetingAgentCheck[] = [granolaMcpAgent];
export function registerMeetingSourceAgentCheck(check: MeetingAgentCheck) {
  meetingAgentChecks.push(check);
}

/** The one place that says whether a bot is a meeting-source agent. */
export async function isMeetingSourceAgent(
  bot: AgentBot,
  deps: { prisma: Pick<PrismaClient, "mcpServer"> },
): Promise<boolean> {
  for (const check of meetingAgentChecks) if (await check(bot, deps)) return true;
  return false;
}
