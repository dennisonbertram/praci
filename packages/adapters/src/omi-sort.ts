import type {
  AdapterContext,
  AgentRuntime,
  ArtifactStore,
  JobPublisher,
} from "@rakazo/adapter-kit";
import { dataRoomBlobDeleteJob, meetingsDigestJob } from "@rakazo/adapter-kit";
import type { Actor, OmiSegmentDto } from "@rakazo/contracts";
import { OMI_CLOUD_PROVIDER } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  createDataRoomRepos,
  deleteMeetingsWithTodos,
  findRecordedElsewhere,
  IsolationError,
  lockMeetingOwner,
  recordUsage,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import {
  createFileDataRoomItem,
  dataRoomBlobContext,
  dataRoomSafeName,
} from "./data-room-files.js";
import type { DataRoomAi } from "./data-room-models.js";
import { LlmDataRoomClassifier } from "./llm-data-room-classifier.js";
import { oggSeconds } from "./omi-segments.js";
import type { OmiKind, OmiStretch } from "./omi-sort-split.js";
import { fallbackStretch, normalizeStretches, parseOmiTranscript } from "./omi-sort-split.js";

export interface OmiSortDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
  runtime: AgentRuntime;
  resolveAi: (scope: { userId: string; spaceId: string }) => Promise<DataRoomAi>;
}

/** Failed model calls after which the recording is sorted without the model. */
const MAX_FAILURES = 3;
const NOTE_BLOB_DELAY_MS = 60_000;

const actorOf = (p: { spaceId: string; userId: string }): Actor => ({
  ...p,
  email: "",
  isDeploymentOwner: false,
});
const meetingKey = (audioItemId: string, start: number) => `${audioItemId}:${start}`;
const noteKey = (audioItemId: string, start: number) => `omi-note:${audioItemId}:${start}`;

type Lines = ReturnType<typeof parseOmiTranscript>;
const rangeText = (lines: Lines, start: number, end: number) =>
  lines
    .filter((l) => l.at >= start && l.at < end)
    .map((l) => l.text)
    .join("\n\n");

interface Recording {
  id: string;
  name: string;
  connectionId: string;
  startedAt: Date;
  lines: Lines;
  /** The wearer, who is in every recording; lets the digest match their commitments. */
  attendee: { name: string; email: string };
}

/** Files the note's text in Omi/Notes; a repeat returns the item already filed. */
async function ensureNote(
  deps: Pick<OmiSortDeps, "prisma" | "artifacts" | "jobs">,
  actor: Actor,
  rec: Recording,
  s: OmiStretch,
): Promise<string> {
  const filing = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  const folderId = await filing.folderAt(actor, null, ["Omi", "Notes"], [], "agent");
  const { item } = await filing.storeAndFile(actor, {
    content: { bytes: new TextEncoder().encode(rangeText(rec.lines, s.start, s.end)) },
    name: dataRoomSafeName(s.title, "Note"),
    mimeType: "text/markdown",
    folderId,
    source: "omi",
    sourceConnectionId: rec.connectionId,
    externalId: noteKey(rec.id, s.start),
    sourceUpdatedAt: new Date(),
  });
  return (item as { id: string }).id;
}

/** Removes note items (rows now, blobs by queued job) that no segment points to any more. */
async function dropNotes(
  deps: Pick<OmiSortDeps, "prisma" | "jobs">,
  actor: Actor,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const owner = { spaceId: actor.spaceId, userId: actor.userId, id: { in: ids } };
  const items = await deps.prisma.dataRoomItem.findMany({
    where: owner,
    select: { storageKey: true, thumbnailKey: true },
  });
  await dropBlobs(
    deps,
    actor,
    items.flatMap((i) => [i.storageKey, i.thumbnailKey]),
  );
  await deps.prisma.dataRoomItem.deleteMany({ where: owner });
}

/** Queues blob deletes, a minute out so a retried sort can still find them. */
async function dropBlobs(
  deps: Pick<OmiSortDeps, "jobs">,
  actor: Actor,
  keys: (string | null)[],
): Promise<void> {
  for (const key of keys) {
    if (!key) continue;
    const at = new Date(Date.now() + NOTE_BLOB_DELAY_MS);
    await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, key, at));
  }
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Recordings of one connection are one meeting when the next starts this soon after the last ends. */
const JOIN_GAP_MS = 120_000;
/** The widest span of a recording (the assembler's cap is an hour), to bound the neighbour lookup. */
const NEIGHBOUR_WINDOW_MS = 2 * 3_600_000;

type OmiLinkedSegment = {
  start: number;
  end: number;
  kind: string;
  meetingId: string | null;
  audioItemId: string;
  audioItem: { sourceUpdatedAt: Date | null; createdAt: Date };
};
const recordedAt = (s: OmiLinkedSegment) => s.audioItem.sourceUpdatedAt ?? s.audioItem.createdAt;

/** The one meeting content comes from: its linked segments, in time order. None left: it goes. */
async function rebuildOmiMeeting(tx: Tx, actor: Actor, meetingId: string): Promise<string[]> {
  const owner = { spaceId: actor.spaceId, userId: actor.userId };
  const linked = await tx.omiSegment.findMany({
    where: { ...owner, meetingId },
    include: {
      audioItem: {
        select: { sourceUpdatedAt: true, createdAt: true, text: { select: { text: true } } },
      },
    },
  });
  if (linked.length === 0) return deleteMeetingsWithTodos(tx, actor, [meetingId]);
  const parts = linked
    .map((l) => {
      const at = recordedAt(l).getTime();
      const lines = parseOmiTranscript(l.audioItem.text?.text ?? "");
      return {
        from: at + l.start * 1000,
        to: at + l.end * 1000,
        text: rangeText(lines, l.start, l.end),
      };
    })
    .sort((x, y) => x.from - y.from);
  await tx.meeting.update({
    where: { id: meetingId },
    data: {
      startedAt: new Date(parts[0]?.from ?? 0),
      endedAt: new Date(Math.max(...parts.map((p) => p.to))),
      transcript: parts
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n\n"),
      transcriptIndexed: true,
      sourceUpdatedAt: new Date(),
    },
  });
  return [];
}

/** Rebuilds each meeting once, adds the blob keys of those that went, and returns those that remain. */
async function rebuildAll(
  tx: Tx,
  actor: Actor,
  ids: Iterable<string>,
  recordingKeys: string[],
): Promise<string[]> {
  const unique = [...new Set(ids)];
  for (const id of unique) recordingKeys.push(...(await rebuildOmiMeeting(tx, actor, id)));
  const left = await tx.meeting.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId, id: { in: unique } },
    select: { id: true },
  });
  return left.map((m) => m.id);
}

/**
 * The neighbouring recording's meeting stretch that this one continues: `edge` "before" looks for
 * a recording that ended within the join gap before `at`, "after" for one that started within it
 * after `at`. `null` when there is no such recording or its stretch there is not a meeting; a
 * `meetingId` of null means the stretch was skipped or deleted by the user, which joins it too.
 */
async function adjacentMeeting(
  tx: Tx,
  actor: Actor,
  rec: Recording,
  edge: "before" | "after",
  at: number,
): Promise<{ meetingId: string | null } | null> {
  const from = edge === "before" ? at - NEIGHBOUR_WINDOW_MS : at;
  const to = edge === "before" ? at : at + JOIN_GAP_MS;
  const rows: OmiLinkedSegment[] = await tx.omiSegment.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      connectionId: rec.connectionId,
      audioItemId: { not: rec.id },
      audioItem: { sourceUpdatedAt: { gte: new Date(from), lte: new Date(to) } },
    },
    include: { audioItem: { select: { sourceUpdatedAt: true, createdAt: true } } },
  });
  let best: { meetingId: string | null; kind: string; gap: number } | null = null;
  for (const row of rows) {
    const bounds = rows.filter((r) => r.audioItemId === row.audioItemId);
    const edgeRow =
      edge === "before"
        ? bounds.reduce((a, b) => (b.end > a.end ? b : a))
        : bounds.reduce((a, b) => (b.start < a.start ? b : a));
    if (edgeRow !== row) continue;
    const gap =
      edge === "before"
        ? at - (recordedAt(row).getTime() + row.end * 1000)
        : recordedAt(row).getTime() + row.start * 1000 - at;
    if (gap < 0 || gap > JOIN_GAP_MS || (best && best.gap <= gap)) continue;
    best = { meetingId: row.meetingId, kind: row.kind, gap };
  }
  return best?.kind === "meeting" ? { meetingId: best.meetingId } : null;
}

/**
 * Finds or creates the meeting of a stretch; null when the user deleted it for good. A stretch at
 * the start or end of its recording continues the neighbouring recording's meeting when the
 * cut between them is within the join gap. The caller rebuilds every meeting it touches.
 */
async function upsertOmiMeeting(
  tx: Tx,
  actor: Actor,
  rec: Recording,
  s: OmiStretch,
  honorTombstone: boolean,
  edges: { first: boolean; last: boolean },
  joined: Set<string>,
): Promise<string | null> {
  const startAt = rec.startedAt.getTime() + s.start * 1000;
  const endAt = rec.startedAt.getTime() + s.end * 1000;
  // One lock for the joins of this owner, so two recordings sorting at once make one meeting.
  await lockMeetingOwner(tx, actor);
  const before = edges.first ? await adjacentMeeting(tx, actor, rec, "before", startAt) : null;
  // A skipped or deleted stretch before this one keeps this one out too, unless the user asked.
  const id =
    before?.meetingId ??
    (before && honorTombstone ? null : await ownMeeting(tx, actor, rec, s, honorTombstone));
  // The next recording was sorted first: its meeting is part of this one now, not a second meeting.
  const after = id && edges.last ? await adjacentMeeting(tx, actor, rec, "after", endAt) : null;
  if (id && after?.meetingId && after.meetingId !== id) {
    await tx.omiSegment.updateMany({
      where: { spaceId: actor.spaceId, userId: actor.userId, meetingId: after.meetingId },
      data: { meetingId: id },
    });
    joined.add(after.meetingId);
  }
  return id;
}

/** The meeting row keyed by the stretch; null when the user deleted it or another source has it. */
async function ownMeeting(
  tx: Tx,
  actor: Actor,
  rec: Recording,
  s: OmiStretch,
  honorTombstone: boolean,
): Promise<string | null> {
  const key = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    provider: "omi",
    externalId: meetingKey(rec.id, s.start),
  };
  const tombstone = { spaceId_userId_provider_externalId: key };
  if (honorTombstone) {
    if (await tx.meetingTombstone.findUnique({ where: tombstone })) return null;
  } else await tx.meetingTombstone.deleteMany({ where: key });
  const startedAt = new Date(rec.startedAt.getTime() + s.start * 1000);
  const endedAt = new Date(rec.startedAt.getTime() + s.end * 1000);
  // The copy stored first wins: the agent sort skips a stretch Omi cloud already has. The user's
  // own move still makes it.
  if (
    honorTombstone &&
    !(await tx.meeting.findUnique({ where: tombstone, select: { id: true } })) &&
    (await findRecordedElsewhere(tx, actor, { startedAt, endedAt }, [OMI_CLOUD_PROVIDER]))
  )
    return null;
  const data = {
    connectionId: rec.connectionId,
    title: s.title,
    startedAt,
    endedAt,
    transcript: rangeText(rec.lines, s.start, s.end),
    transcriptIndexed: true,
    sourceUpdatedAt: new Date(),
  };
  const { id } = await tx.meeting.upsert({
    where: tombstone,
    create: { ...key, ...data, attendees: [rec.attendee], summary: "" },
    update: { ...data, attendees: [rec.attendee] },
    select: { id: true },
  });
  return id;
}

const queueDigest = (deps: Pick<OmiSortDeps, "jobs">, actor: Actor, meetingId: string) =>
  deps.jobs.enqueue({
    ...meetingsDigestJob({ spaceId: actor.spaceId, userId: actor.userId, meetingId }),
    keepExisting: true,
  });

async function loadRecording(prisma: PrismaClient, actor: Actor, itemId: string) {
  const item = await prisma.dataRoomItem.findFirst({
    where: {
      id: itemId,
      spaceId: actor.spaceId,
      userId: actor.userId,
      source: "omi",
      sourceConnectionId: { not: null },
      storageKey: { not: null },
    },
    select: {
      name: true,
      storageKey: true,
      sourceConnectionId: true,
      sourceUpdatedAt: true,
      createdAt: true,
      text: { select: { text: true } },
    },
  });
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true, email: true },
  });
  if (!item?.storageKey || !item.sourceConnectionId || !item.text || !user) return null;
  const rec: Recording = {
    id: itemId,
    name: item.name,
    connectionId: item.sourceConnectionId,
    startedAt: item.sourceUpdatedAt ?? item.createdAt,
    lines: parseOmiTranscript(item.text.text),
    attendee: { name: user.name, email: user.email },
  };
  return { rec, text: item.text.text, storageKey: item.storageKey };
}

/**
 * The `omi.sort` job. One tool-less model call splits the transcript into stretches (meeting, note,
 * trash); without AI-data consent, a model, or after three failed calls the recording is one note.
 * The result replaces earlier agent-made segments of the recording but never a stretch the user
 * moved. Never logs transcript text.
 */
export async function runOmiSort(
  deps: OmiSortDeps,
  payload: { spaceId: string; userId: string; itemId: string },
): Promise<void> {
  const { prisma } = deps;
  const actor = actorOf(payload);
  const loaded = await loadRecording(prisma, actor, payload.itemId);
  if (!loaded) return;
  const { rec } = loaded;
  const duration = Math.max(
    1,
    oggSeconds(await deps.artifacts.get(loaded.storageKey, dataRoomBlobContext(actor, "omi.sort"))),
  );

  let stretches: OmiStretch[];
  if (rec.lines.length === 0) {
    stretches = [{ ...fallbackStretch(rec.name, duration)[0], kind: "trash" } as OmiStretch];
  } else {
    const ai = await deps.resolveAi(actor);
    stretches = fallbackStretch(rec.name, duration);
    if (ai.model && ai.allowed) {
      const operationId = `omi.sort:${rec.id}`;
      const context: AdapterContext = {
        operationId,
        traceId: operationId,
        ...actor,
        signal: AbortSignal.timeout(120_000),
      };
      try {
        const split = await new LlmDataRoomClassifier({
          runtime: deps.runtime,
          model: ai.model,
          onUsage: (usage, attribution) => recordUsage(prisma, usage, attribution),
        }).splitRecording({ name: rec.name, duration, transcript: loaded.text }, context);
        stretches = normalizeStretches(split.segments, duration, rec.name);
      } catch (error) {
        getLogger().warn("omi sort model call failed", {
          reason: error instanceof Error ? error.name : "error",
        });
        const owned = { id: rec.id, spaceId: actor.spaceId, userId: actor.userId };
        await prisma.dataRoomItem.updateMany({
          where: owned,
          data: { failures: { increment: 1 } },
        });
        const failed = await prisma.dataRoomItem.findFirst({
          where: owned,
          select: { failures: true },
        });
        if ((failed?.failures ?? 0) < MAX_FAILURES) throw new Error("Sorting failed");
      }
    }
  }
  // A stretch with no words has nothing to keep.
  stretches = stretches.map((s) =>
    s.kind !== "trash" && rec.lines.length > 0 && !rangeText(rec.lines, s.start, s.end)
      ? { ...s, kind: "trash" }
      : s,
  );
  await applyStretches(deps, actor, rec, stretches);
  await prisma.dataRoomItem.updateMany({
    where: { id: rec.id, spaceId: actor.spaceId, userId: actor.userId },
    data: { failures: 0 },
  });
}

async function applyStretches(
  deps: OmiSortDeps,
  actor: Actor,
  rec: Recording,
  stretches: OmiStretch[],
): Promise<void> {
  const { prisma } = deps;
  const owner = { spaceId: actor.spaceId, userId: actor.userId, audioItemId: rec.id };
  const kept = await prisma.omiSegment.findMany({ where: { ...owner, sortedBy: "user" } });
  const fresh = stretches.filter((s) => !kept.some((u) => s.start < u.end && u.start < s.end));
  // Notes are filed first and by a fixed external id, so a retry finds them again.
  const notes = new Map<number, string>();
  for (const s of fresh)
    if (s.kind === "note") notes.set(s.start, await ensureNote(deps, actor, rec, s));

  const queued: string[] = [];
  const recordingKeys: string[] = [];
  const staleNotes = await prisma.$transaction(async (tx) => {
    const old = await tx.omiSegment.findMany({ where: { ...owner, sortedBy: "agent" } });
    await tx.omiSegment.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    const rows: { s: OmiStretch; meetingId: string | null }[] = [];
    const meetingIds = new Set<string>();
    const touched = new Set<string>();
    const end = Math.max(...stretches.map((x) => x.end));
    for (const s of fresh) {
      const edges = { first: s.start === 0, last: s.end === end };
      const meetingId =
        s.kind === "meeting"
          ? await upsertOmiMeeting(tx, actor, rec, s, true, edges, touched)
          : null;
      if (meetingId) meetingIds.add(meetingId);
      rows.push({ s, meetingId });
    }
    // Meetings from the earlier sort that this one no longer makes, and those it absorbed.
    for (const o of old) if (o.meetingId && !meetingIds.has(o.meetingId)) touched.add(o.meetingId);
    await tx.omiSegment.createMany({
      data: rows.map(({ s, meetingId }) => ({
        ...owner,
        connectionId: rec.connectionId,
        start: s.start,
        end: s.end,
        kind: s.kind,
        title: s.title,
        meetingId,
        noteItemId: notes.get(s.start) ?? null,
        sortedBy: "agent",
      })),
    });
    queued.push(...(await rebuildAll(tx, actor, [...meetingIds, ...touched], recordingKeys)));
    const keep = new Set(notes.values());
    return old.flatMap((o) => (o.noteItemId && !keep.has(o.noteItemId) ? [o.noteItemId] : []));
  });
  await dropNotes(deps, actor, staleNotes);
  await dropBlobs(deps, actor, recordingKeys);
  for (const id of queued) await queueDigest(deps, actor, id);
}

/** Moves one stretch to another kind, as the user's choice: the old output goes, the new one is made. */
export async function moveOmiSegment(
  deps: Pick<OmiSortDeps, "prisma" | "artifacts" | "jobs">,
  actor: Actor,
  input: { segmentId: string; kind: OmiKind },
): Promise<OmiSegmentDto> {
  const { prisma } = deps;
  const segment = await prisma.omiSegment.findFirst({
    where: { id: input.segmentId, spaceId: actor.spaceId, userId: actor.userId },
  });
  if (!segment) throw new IsolationError();
  const loaded = await loadRecording(prisma, actor, segment.audioItemId);
  if (!loaded) throw new IsolationError();
  const { rec } = loaded;
  const s: OmiStretch = {
    start: segment.start,
    end: segment.end,
    kind: input.kind,
    title: segment.title,
  };
  let noteItemId: string | null = null;
  if (input.kind === "note" && segment.kind !== "note")
    noteItemId = await ensureNote(deps, actor, rec, s);
  else if (input.kind === "note") noteItemId = segment.noteItemId;

  const recordingKeys: string[] = [];
  const { updated, queued } = await prisma.$transaction(async (tx) => {
    const touched = new Set<string>();
    const all = await tx.omiSegment.findMany({
      where: { spaceId: actor.spaceId, userId: actor.userId, audioItemId: rec.id },
      select: { start: true, end: true },
    });
    const edges = {
      first: segment.start === Math.min(...all.map((x) => x.start)),
      last: segment.end === Math.max(...all.map((x) => x.end)),
    };
    const meetingId =
      input.kind === "meeting"
        ? await upsertOmiMeeting(tx, actor, rec, s, false, edges, touched)
        : null;
    if (segment.meetingId) touched.add(segment.meetingId);
    const updated = await tx.omiSegment.update({
      where: { id: segment.id },
      data: { kind: input.kind, meetingId, noteItemId, sortedBy: "user" },
    });
    const queued = await rebuildAll(
      tx,
      actor,
      [...touched, ...(meetingId ? [meetingId] : [])],
      recordingKeys,
    );
    return { updated, queued };
  });
  if (segment.noteItemId && segment.noteItemId !== noteItemId) {
    await dropNotes(deps, actor, [segment.noteItemId]);
  }
  await dropBlobs(deps, actor, recordingKeys);
  for (const id of queued) await queueDigest(deps, actor, id);
  return segmentDto(updated, rec.startedAt);
}

type SegmentRow = {
  id: string;
  audioItemId: string;
  kind: string;
  title: string;
  start: number;
  end: number;
  sortedBy: string;
  meetingId: string | null;
  noteItemId: string | null;
};

const segmentDto = (row: SegmentRow, recordingStart: Date): OmiSegmentDto => ({
  id: row.id,
  audioItemId: row.audioItemId,
  kind: row.kind as OmiKind,
  title: row.title,
  startedAt: new Date(recordingStart.getTime() + row.start * 1000).toISOString(),
  endedAt: new Date(recordingStart.getTime() + row.end * 1000).toISOString(),
  sortedBy: row.sortedBy as "agent" | "user",
  meetingId: row.meetingId,
  noteItemId: row.noteItemId,
});

/**
 * Deletes what a recording made and returns the blob keys of its notes. A meeting that other
 * recordings still share is rebuilt without it, so the meeting stays with a hole; one nothing else
 * uses goes with its to-dos.
 */
export async function deleteOmiRecordingOutputs(
  deps: Pick<OmiSortDeps, "prisma" | "jobs">,
  actor: Actor,
  audioItemId: string,
): Promise<string[]> {
  const owner = { spaceId: actor.spaceId, userId: actor.userId };
  const segments = await deps.prisma.omiSegment.findMany({
    where: { ...owner, audioItemId },
    select: { meetingId: true, noteItemId: true },
  });
  const noteIds = segments.flatMap((s) => (s.noteItemId ? [s.noteItemId] : []));
  const notes = await deps.prisma.dataRoomItem.findMany({
    where: { ...owner, id: { in: noteIds } },
    select: { storageKey: true, thumbnailKey: true },
  });
  const recordingKeys: string[] = [];
  const left = await deps.prisma.$transaction(async (tx) => {
    await lockMeetingOwner(tx, actor);
    await tx.omiSegment.deleteMany({ where: { ...owner, audioItemId } });
    const kept = await rebuildAll(
      tx,
      actor,
      segments.flatMap((s) => (s.meetingId ? [s.meetingId] : [])),
      recordingKeys,
    );
    await tx.dataRoomItem.deleteMany({ where: { ...owner, id: { in: noteIds } } });
    return kept;
  });
  for (const id of left) await queueDigest(deps, actor, id);
  return [
    ...notes.flatMap((n) => [n.storageKey, n.thumbnailKey].filter((k): k is string => !!k)),
    ...recordingKeys,
  ];
}

/** The caller's segments, newest recording first; `date` (UTC, YYYY-MM-DD) limits to that day. */
export async function listOmiSegments(
  prisma: PrismaClient,
  actor: Actor,
  input: { date?: string },
): Promise<OmiSegmentDto[]> {
  const day = input.date ? new Date(`${input.date}T00:00:00Z`) : null;
  const rows = await prisma.omiSegment.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      ...(day
        ? { audioItem: { sourceUpdatedAt: { gte: day, lt: new Date(day.getTime() + 86_400_000) } } }
        : {}),
    },
    include: { audioItem: { select: { sourceUpdatedAt: true, createdAt: true } } },
    orderBy: [{ audioItem: { sourceUpdatedAt: "desc" } }, { start: "desc" }],
    take: 500,
  });
  return rows.map((r) => segmentDto(r, r.audioItem.sourceUpdatedAt ?? r.audioItem.createdAt));
}
