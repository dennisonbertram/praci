import type {
  HexMeeting,
  HexMeetingShow,
  LocalMeetingsImportOutput,
  LocalMeetingsStatus,
  RakazoDesktopHex,
  SourceMeeting,
} from "@rakazo/contracts";
import { LOCAL_IMPORT_MAX_MEETINGS } from "@rakazo/contracts";

/** Hex keeps meetings 24 hours by default, so the first pass reads back further than it usually finds. */
const BACKFILL_MS = 90 * 86_400_000;
/** A pass starts this long before the last one ended, so a note Hex wrote late is seen. */
const OVERLAP_MS = 5 * 60_000;
/** A call still unfinished or unreadable holds back later calls for this long, then is given up on. */
const HOLD_MS = 24 * 3_600_000;

/** `off`: not connected. The rest are what the Hex tile says. */
export type HexOutcome = "idle" | "off" | "ok" | "not_found" | "update" | "failed";

/** Finished calls, and interrupted ones whose transcript was written while recording. */
const importable = ({ meeting }: { meeting: HexMeeting }) =>
  !meeting.in_progress &&
  ((meeting.status === "complete" && meeting.transcript_source !== "missing") ||
    (meeting.status === "interrupted" && meeting.transcript_source === "rolling"));

/**
 * One Hex call as a source meeting, or null when it is not ready to import. Who was there is not
 * sent: Hex does not know, and the server sets the user as the only attendee.
 */
export function toSourceMeeting(source: HexMeetingShow): SourceMeeting | null {
  if (!importable(source)) return null;
  const { meeting, notes, entries } = source;
  const endedAt = meeting.timestamp_ms + meeting.duration_ms;
  return {
    externalId: meeting.id,
    title: notes?.title || meeting.title,
    startedAt: new Date(meeting.timestamp_ms).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    attendees: [],
    organizerEmail: null,
    sourceUrl: null,
    folders: meeting.application ? [meeting.application] : [],
    summary: notes?.summary ?? "",
    privateNotes: "",
    transcript: [...entries]
      .sort((a, b) => a.start_ms - b.start_ms)
      .map((entry) => ({
        speaker: entry.source === "microphone" ? "You" : "Them",
        text: entry.text,
      })),
    updatedAt: new Date(Math.max(endedAt, notes?.generated_at_ms ?? 0)).toISOString(),
  };
}

export interface HexSyncDeps {
  hex: RakazoDesktopHex;
  status: () => Promise<LocalMeetingsStatus>;
  importLocal: (input: {
    connectionId: string;
    meetings: SourceMeeting[];
  }) => Promise<LocalMeetingsImportOutput>;
  now?: () => number;
}

/** One pass: read Hex's recent calls and push them. Nothing is lost on failure; Hex still has them. */
export async function syncHex(deps: HexSyncDeps): Promise<HexOutcome> {
  const status = await deps.status();
  if (status?.status !== "connected") return "off";
  const now = (deps.now ?? Date.now)();
  const since = status.syncedThrough
    ? Date.parse(status.syncedThrough) - OVERLAP_MS
    : now - BACKFILL_MS;
  const list = await deps.hex.list(since);
  if (list.state !== "ok") return list.state;

  let outcome: HexOutcome = "ok";
  const found: SourceMeeting[] = [];
  // The server moves its read position to the newest call pushed, so nothing may be pushed that
  // started after a call this pass could not finish reading: that call would never be listed again.
  let holdAt = Number.POSITIVE_INFINITY;
  const hold = (startedAt: number) => {
    if (startedAt > now - HOLD_MS) holdAt = Math.min(holdAt, startedAt);
  };
  for (const item of list.value.meetings) {
    // Calls still recording or being transcribed are read again on a later pass.
    if (!importable({ meeting: item })) {
      if (item.in_progress || item.status === "transcribing") hold(item.timestamp_ms);
      continue;
    }
    const shown = await deps.hex.show(item.id);
    if (shown.state !== "ok") {
      // A contract change stops the pass; a read failure skips that call and says so.
      if (shown.state === "update") return "update";
      outcome = shown.state === "not_found" ? "not_found" : "failed";
      hold(item.timestamp_ms);
      continue;
    }
    const mapped = toSourceMeeting(shown.value);
    if (mapped) found.push(mapped);
  }
  const meetings = found.filter((m) => Date.parse(m.startedAt) <= holdAt);

  try {
    // An empty push still records that a pass ran.
    for (let i = 0; i === 0 || i < meetings.length; i += LOCAL_IMPORT_MAX_MEETINGS) {
      await deps.importLocal({
        connectionId: status.connectionId,
        meetings: meetings.slice(i, i + LOCAL_IMPORT_MAX_MEETINGS),
      });
    }
  } catch {
    return "failed";
  }
  return outcome;
}
