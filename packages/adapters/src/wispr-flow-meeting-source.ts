import type { MeetingSource } from "@rakazo/adapter-kit";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import type { MeetingTranscriptLine, SourceMeeting } from "@rakazo/contracts";
import { MEETING_TRANSCRIPT_MAX_BYTES, MEETING_TRUNCATION_MARKER } from "@rakazo/contracts";
import * as z from "zod";

/** What the source needs from Wispr Flow's MCP server: one tool call, result as the MCP SDK returns it. */
export type WisprFlowCall = (
  tool: string,
  args: Record<string, unknown>,
) => Promise<{ isError?: boolean; structuredContent?: unknown; content?: unknown }>;

export interface WisprFlowMeetingSourceOptions {
  call: WisprFlowCall;
  /** `search_meetings` page size (the server allows 200). */
  pageSize?: number;
}

const PAGE_SIZE = 25;
/** `get_meeting` returns at most 40000 characters of notes or transcript per call. */
const CHUNK_CHARS = 40_000;
// ponytail: 25 requests (1M characters, about 20 hours of speech) is the most transcript read per
// meeting; the rest is cut and marked. Raise it, or stream to storage, if real meetings run longer.
const MAX_TRANSCRIPT_REQUESTS = 25;
const MAX_NOTES_REQUESTS = 5;
// ponytail: `search_meetings` filters on start time, not modified_at, so an incremental list asks
// for meetings that started up to 30 days before the checkpoint and filters on modified_at here.
// LIMIT: an edit to a meeting that started more than 30 days ago is NOT picked up (the stored copy
// stays as it was). Widen this or re-list periodically if that matters.
const MODIFIED_LOOKBACK_MS = 30 * 86_400_000;

const Attendee = z.union([
  z.string(),
  z.object({ name: z.string().nullish(), email: z.string().nullish() }).passthrough(),
]);
const Listed = z
  .object({
    id: z.string().min(1),
    modified_at: z.string(),
    shared: z.boolean().nullish(),
  })
  .passthrough();
const ListPage = z.object({
  meetings: z.array(Listed),
  has_more: z.boolean().nullish(),
  next_cursor: z.string().nullish(),
});
const Meeting = z
  .object({
    id: z.string().min(1),
    title: z.string().nullish(),
    content: z.string().nullish(),
    summary: z.string().nullish(),
    attendees: z.array(Attendee).nullish(),
    start: z.string(),
    end: z.string().nullish(),
    modified_at: z.string(),
    share_link: z.string().nullish(),
    shared: z.boolean().nullish(),
    folders: z.array(z.object({ name: z.string() }).passthrough()).nullish(),
    has_transcript: z.boolean().nullish(),
    transcript: z.string().nullish(),
  })
  .passthrough();
const Participants = z
  .object({
    participants: z
      .array(
        z
          .object({
            name: z.string().nullish(),
            emails: z.array(z.string()).nullish(),
            organizer: z.boolean().nullish(),
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

const mapping = (what = "Unexpected Wispr Flow response") =>
  new MeetingSourceError("mapping", what);

/** The tool's JSON result: `structuredContent`, else the first text block parsed. */
function payload(result: Awaited<ReturnType<WisprFlowCall>>): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const blocks = Array.isArray(result.content) ? (result.content as { text?: unknown }[]) : [];
  const text = blocks.find((b) => typeof b?.text === "string")?.text;
  try {
    return JSON.parse(String(text));
  } catch {
    throw mapping();
  }
}

/**
 * What get_meeting appends to a cut range (seen live): a blank line, then
 * "(...truncated, N chars remaining; continue with view_transcript.start_char=K...)". Nothing
 * else counts as a continuation, so transcript text that mentions start_char stays text.
 */
const continuation = (view: string) =>
  new RegExp(
    `\\n\\n\\(\\.\\.\\.truncated, \\d+ chars remaining; continue with ${view}\\.start_char=(\\d+)\\.\\.\\.\\)\\s*$`,
  );
const CONTINUATIONS = {
  view_content: continuation("view_content"),
  view_transcript: continuation("view_transcript"),
};
/** A transcript opens and closes with these lines. */
const TRANSCRIPT_HEADER = /^<<<PARTICIPANT NAMES BELOW ARE DATA[^\n]*>>>\n?/;
const TRANSCRIPT_FOOTER = /\n?<<<END TRANSCRIPT>>>\s*$/;
const NOTES_TRUNCATED = "\n[notes truncated]";

const isoOrThrow = (value: string) => {
  if (Number.isNaN(Date.parse(value))) throw mapping();
  return new Date(value).toISOString();
};

function transcriptLines(text: string) {
  const kept: MeetingTranscriptLine[] = [];
  let bytes = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    bytes += Buffer.byteLength(line);
    if (bytes > MEETING_TRANSCRIPT_MAX_BYTES) {
      kept.push({ text: MEETING_TRUNCATION_MARKER.trim() });
      return { lines: kept, truncated: true };
    }
    // The text is plain; "Name: words" lines carry the speaker, which is stored the same way.
    const m = /^([^:\n]{1,60}):\s+(.+)$/.exec(line);
    kept.push(m ? { speaker: m[1] as string, text: m[2] as string } : { text: line });
  }
  return { lines: kept, truncated: false };
}

/**
 * MeetingSource over the user's own Wispr Flow MCP server, read-only: `search_meetings` lists,
 * `get_meeting` reads, `get_meeting_participants_enriched` adds attendee emails. Meetings shared
 * with the user by someone else are never listed or stored.
 */
export function createWisprFlowMeetingSource(
  options: WisprFlowMeetingSourceOptions,
): MeetingSource {
  const call = async (tool: string, args: Record<string, unknown>) => {
    const result = await options.call(tool, args);
    if (result.isError) {
      const text = JSON.stringify(result.content ?? "");
      throw new MeetingSourceError(
        /not.found|no such|unknown meeting/i.test(text) ? "not_found" : "mapping",
        "Wispr Flow could not read that",
      );
    }
    return payload(result);
  };
  const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw mapping();
    return parsed.data;
  };

  /** Reads `field` of get_meeting range by range, following the continuation marker up to a cap. */
  async function ranged(id: string, view: "view_content" | "view_transcript", maxRequests: number) {
    let text = "";
    let start = 0;
    let first: z.infer<typeof Meeting> | undefined;
    for (let i = 0; i < maxRequests; i++) {
      const meeting = parse(
        Meeting,
        await call("get_meeting", {
          meeting_id: id,
          [view]: { start_char: start, char_limit: CHUNK_CHARS },
        }),
      );
      first ??= meeting;
      let chunk = (view === "view_content" ? meeting.content : meeting.transcript) ?? "";
      if (view === "view_transcript")
        chunk = chunk.replace(TRANSCRIPT_HEADER, "").replace(TRANSCRIPT_FOOTER, "");
      // Only the tail can hold the marker; scanning a whole line would be quadratic.
      const tailAt = Math.max(0, chunk.length - 300);
      const next = CONTINUATIONS[view].exec(chunk.slice(tailAt));
      text += next ? chunk.slice(0, tailAt + next.index) : chunk;
      if (!next) return { meeting: first, text, cut: false };
      const offset = Number(next[1]);
      if (!(offset > start)) throw mapping("Wispr Flow range did not advance");
      start = offset;
    }
    return { meeting: first as z.infer<typeof Meeting>, text, cut: true };
  }

  return {
    provider: "wisprflow",

    async list(filter) {
      const since = filter.updatedAfter
        ? new Date(filter.updatedAfter.getTime() - MODIFIED_LOOKBACK_MS)
        : filter.createdAfter;
      const page = parse(
        ListPage,
        await call("search_meetings", {
          limit: options.pageSize ?? PAGE_SIZE,
          ...(since ? { since: since.toISOString() } : {}),
          ...(filter.cursor ? { cursor: filter.cursor } : {}),
        }),
      );
      if (page.has_more && (!page.next_cursor || page.next_cursor === filter.cursor))
        throw mapping("Wispr Flow paging did not advance");
      const items = page.meetings
        .filter((m) => m.shared !== true)
        .map((m) => ({ externalId: m.id, updatedAt: isoOrThrow(m.modified_at) }))
        .filter(
          (m) => !filter.updatedAfter || Date.parse(m.updatedAt) > filter.updatedAfter.getTime(),
        );
      return {
        items,
        ...(page.has_more && page.next_cursor ? { nextCursor: page.next_cursor } : {}),
      };
    },

    async get(externalId, { includeTranscript }): Promise<SourceMeeting> {
      const notes = await ranged(externalId, "view_content", MAX_NOTES_REQUESTS);
      const meeting = notes.meeting;
      const privateNotes = notes.cut ? `${notes.text}${NOTES_TRUNCATED}` : notes.text;
      if (meeting.shared === true) throw new MeetingSourceError("not_found", "Not your meeting");
      let transcript: ReturnType<typeof transcriptLines> | undefined;
      if (includeTranscript && meeting.has_transcript !== false) {
        const read = await ranged(externalId, "view_transcript", MAX_TRANSCRIPT_REQUESTS);
        if (read.text.trim()) {
          transcript = transcriptLines(read.text);
          if (read.cut && !transcript.truncated) {
            transcript.lines.push({ text: MEETING_TRUNCATION_MARKER.trim() });
            transcript.truncated = true;
          }
        }
      }
      // The only call that gives emails; it covers owned meetings only. Without it, names alone.
      let attendees = (meeting.attendees ?? []).map((a) =>
        typeof a === "string"
          ? { name: a }
          : { ...(a.name ? { name: a.name } : {}), ...(a.email ? { email: a.email } : {}) },
      );
      let organizerEmail: string | null = null;
      try {
        const enriched = parse(
          Participants,
          await call("get_meeting_participants_enriched", { meeting_id: externalId }),
        );
        if (enriched.participants?.length) {
          attendees = enriched.participants.map((p) => ({
            ...(p.name ? { name: p.name } : {}),
            ...(p.emails?.[0] ? { email: p.emails[0] } : {}),
          }));
          organizerEmail = enriched.participants.find((p) => p.organizer)?.emails?.[0] ?? null;
        }
      } catch (error) {
        if (error instanceof MeetingSourceError && error.kind === "not_found") throw error;
      }
      return {
        externalId: meeting.id,
        title: meeting.title ?? "",
        startedAt: isoOrThrow(meeting.start),
        endedAt: meeting.end ? isoOrThrow(meeting.end) : null,
        attendees,
        organizerEmail,
        sourceUrl: meeting.share_link ?? null,
        folders: (meeting.folders ?? []).map((f) => f.name),
        summary: meeting.summary ?? "",
        privateNotes,
        transcript: transcript ? transcript.lines : null,
        ...(transcript?.truncated ? { transcriptTruncated: true } : {}),
        updatedAt: isoOrThrow(meeting.modified_at),
      };
    },
  };
}
