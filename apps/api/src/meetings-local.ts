import { ORPCError } from "@orpc/server";
import { queueMeetingDigests } from "@rakazo/adapters";
import type {
  Actor,
  LocalMeetingsImportOutput,
  LocalMeetingsStatus,
  SourceMeeting,
} from "@rakazo/contracts";
import {
  HEX_CONNECTOR_ID,
  MEETING_TRANSCRIPT_MAX_BYTES,
  MEETING_TRUNCATION_MARKER,
} from "@rakazo/contracts";
import {
  deleteMeeting,
  getMeetingSyncState,
  IsolationError,
  isDuplicateSpan,
  upsertMeeting,
  upsertMeetingSyncState,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { provisionConnectionAgent } from "./integration-agent.js";
import type { MeetingsDeps } from "./meetings.js";

/**
 * Meetings a desktop app reads from the user's own computer (Hex today) and pushes here. The API
 * never reaches into the computer; it checks who is pushing and what they push.
 */

const owner = (actor: Actor) => ({
  spaceId: actor.spaceId,
  userId: actor.userId,
});
const SOURCE = "hex";

const findConnection = (deps: MeetingsDeps, actor: Actor, connected: boolean) =>
  deps.router.prisma.connection.findFirst({
    where: {
      ...owner(actor),
      connectorId: HEX_CONNECTOR_ID,
      ...(connected ? { status: "connected" } : { status: { not: "revoked" } }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

/** One Hex connection per user and space; a second connect turns the first back on. */
export async function connectLocal(
  deps: MeetingsDeps,
  actor: Actor,
): Promise<{ connectionId: string }> {
  const connection = await deps.router.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hex-connect'), hashtext(${`${actor.spaceId}:${actor.userId}`}))`;
    const existing = await tx.connection.findFirst({
      where: {
        ...owner(actor),
        connectorId: HEX_CONNECTOR_ID,
        status: { not: "revoked" },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (existing) {
      return tx.connection.update({
        where: { id: existing.id },
        data: { status: "connected" },
      });
    }
    return tx.connection.create({
      data: {
        ...owner(actor),
        connectorId: HEX_CONNECTOR_ID,
        provider: SOURCE,
        displayName: "Hex",
        status: "connected",
        // No account and no secret. Private to its own agent, as every connected app.
        allAgents: false,
        privateByDefault: true,
      },
    });
  });
  // Best-effort: Create agent repairs a failed provision.
  await provisionConnectionAgent(deps.agent, actor, connection.id);
  return { connectionId: connection.id };
}

export async function localStatus(deps: MeetingsDeps, actor: Actor): Promise<LocalMeetingsStatus> {
  const connection = await findConnection(deps, actor, false);
  if (!connection) return null;
  const { prisma } = deps.router;
  const [state, count] = await Promise.all([
    getMeetingSyncState(prisma, owner(actor), { connectionId: connection.id }),
    prisma.meeting.count({
      where: { ...owner(actor), provider: SOURCE, deletedAt: null },
    }),
  ]);
  return {
    connectionId: connection.id,
    status: connection.status === "connected" ? "connected" : "disconnected",
    syncedThrough: state?.syncedThrough?.toISOString() ?? null,
    lastSyncedAt: state?.lastSyncedAt?.toISOString() ?? null,
    count,
  };
}

/** The transcript as the user's own: "You" becomes their name, everyone else is "Them". */
function ownLines(meeting: SourceMeeting, name: string): SourceMeeting["transcript"] {
  if (!meeting.transcript) return null;
  const lines: NonNullable<SourceMeeting["transcript"]> = [];
  let bytes = 0;
  for (const line of meeting.transcript) {
    const speaker = line.speaker === "You" ? name : "Them";
    bytes += Buffer.byteLength(speaker) + Buffer.byteLength(line.text) + 2;
    if (bytes > MEETING_TRANSCRIPT_MAX_BYTES) {
      lines.push({ text: MEETING_TRUNCATION_MARKER.trim() });
      break;
    }
    lines.push({ speaker, text: line.text });
  }
  return lines;
}

/** True when a Praci recording of this user overlaps the call by at least half of the shorter one. */
async function recordedInPraci(deps: MeetingsDeps, actor: Actor, meeting: SourceMeeting) {
  const start = Date.parse(meeting.startedAt);
  const end = Date.parse(meeting.endedAt ?? meeting.startedAt);
  const rows = await deps.router.prisma.meeting.findMany({
    where: {
      ...owner(actor),
      provider: "praci",
      deletedAt: null,
      startedAt: { lt: new Date(end) },
      endedAt: { gt: new Date(start) },
    },
    select: { startedAt: true, endedAt: true },
  });
  return rows.some((row) =>
    isDuplicateSpan(
      { start, end },
      { start: row.startedAt.getTime(), end: (row.endedAt as Date).getTime() },
    ),
  );
}

export async function importLocal(
  deps: MeetingsDeps,
  actor: Actor,
  input: { connectionId: string; meetings: SourceMeeting[] },
): Promise<LocalMeetingsImportOutput> {
  const { prisma } = deps.router;
  const connection = await prisma.connection.findFirst({
    where: {
      id: input.connectionId,
      ...owner(actor),
      connectorId: HEX_CONNECTOR_ID,
      status: "connected",
    },
    select: { id: true },
  });
  if (!connection) throw new ORPCError("NOT_FOUND", { message: "Hex connection not found" });
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true, email: true, emailVerified: true },
  });
  if (!user) throw new ORPCError("NOT_FOUND", { message: "Hex connection not found" });
  const me = {
    name: user.name,
    ...(user.emailVerified ? { email: user.email } : {}),
  };

  const result = { created: 0, updated: 0, skipped: 0 };
  let newest: number | null = null;
  for (const raw of input.meetings) {
    const stored = await prisma.meeting.findFirst({
      where: { ...owner(actor), provider: SOURCE, externalId: raw.externalId },
      select: { id: true },
    });
    if (!stored && (await recordedInPraci(deps, actor, raw))) {
      // Stored first elsewhere wins; the tombstone keeps this copy from being offered again.
      await prisma.meetingTombstone.upsert({
        where: {
          spaceId_userId_provider_externalId: {
            ...owner(actor),
            provider: SOURCE,
            externalId: raw.externalId,
          },
        },
        create: {
          ...owner(actor),
          provider: SOURCE,
          externalId: raw.externalId,
        },
        update: {},
      });
      result.skipped++;
      continue;
    }
    // Only the call itself comes from the computer; who was there does not.
    const meeting: SourceMeeting = {
      externalId: raw.externalId,
      title: raw.title.slice(0, 500),
      startedAt: raw.startedAt,
      endedAt: raw.endedAt,
      attendees: [me],
      organizerEmail: null,
      sourceUrl: null,
      folders: raw.folders.slice(0, 5).map((folder) => folder.slice(0, 100)),
      summary: raw.summary.slice(0, 20_000),
      privateNotes: "",
      transcript: ownLines(raw, user.name),
      updatedAt: raw.updatedAt,
    };
    const outcome = await upsertMeeting(
      prisma,
      owner(actor),
      { connectionId: connection.id },
      SOURCE,
      meeting,
    );
    if (outcome === "created" || outcome === "updated") {
      result[outcome]++;
      newest = Math.max(newest ?? 0, Date.parse(meeting.startedAt));
    } else {
      result.skipped++;
    }
  }

  const state = await getMeetingSyncState(prisma, owner(actor), {
    connectionId: connection.id,
  });
  const through = Math.max(newest ?? 0, state?.syncedThrough?.getTime() ?? 0);
  await upsertMeetingSyncState(prisma, owner(actor), { connectionId: connection.id }, SOURCE, {
    lastSyncedAt: new Date(),
    ...(through ? { syncedThrough: new Date(through) } : {}),
  });
  if (result.created > 0) {
    await queueMeetingDigests({ prisma, jobs: deps.router.jobs }, owner(actor)).catch((error) =>
      getLogger().error("meetings.importLocal: digests not queued", error),
    );
  }
  return result;
}

export async function disconnectLocal(
  deps: MeetingsDeps,
  actor: Actor,
  input: { connectionId: string; deleteMeetings: boolean },
): Promise<{ ok: true }> {
  const { prisma } = deps.router;
  const connection = await prisma.connection.findFirst({
    where: {
      id: input.connectionId,
      ...owner(actor),
      connectorId: HEX_CONNECTOR_ID,
      status: { not: "revoked" },
    },
    select: { id: true },
  });
  if (!connection) return { ok: true };
  await prisma.connection.update({
    where: { id: connection.id },
    data: { status: "disconnected" },
  });
  if (input.deleteMeetings) {
    // Each delete also removes the meeting's to-dos and leaves a tombstone, as when the user deletes one.
    const rows = await prisma.meeting.findMany({
      where: { ...owner(actor), provider: SOURCE },
      select: { id: true },
    });
    for (const row of rows) {
      try {
        await deleteMeeting(prisma, owner(actor), row.id);
      } catch (error) {
        // The rows came from a scoped query, so this only means the meeting is already gone
        // (a double submit, or deleted in another tab).
        if (!(error instanceof IsolationError)) throw error;
      }
    }
  }
  return { ok: true };
}
