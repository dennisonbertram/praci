import { createHash } from "node:crypto";
import type { MeetingSource } from "@rakazo/adapter-kit";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import type { MeetingTranscriptLine, SourceMeeting } from "@rakazo/contracts";
import {
  isOmiMcpKey,
  MEETING_TRANSCRIPT_MAX_BYTES,
  MEETING_TRUNCATION_MARKER,
  OMI_CLOUD_API_BASE_URL,
  OmiCloudConversationSchema,
} from "@rakazo/contracts";
import * as z from "zod";

export interface OmiCloudMeetingSourceOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /**
   * Calls that carry transcripts (a date-window list, or a detail fallback) one run may make.
   * Omi limits them by the hour, so the sync job's chain delay and this cap set the pace.
   */
  maxTranscriptCalls?: number;
}

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;
/** Omi lists by created_at; a conversation can sit this far past the boundary. */
const LIST_OVERLAP_MS = 24 * 3_600_000;
/** Shorter conversations are background noise; they cost a digest call each. */
const MIN_DURATION_MS = 2 * 60_000;

const ListPage = z.array(OmiCloudConversationSchema);

const ms = (value: string | null | undefined) => {
  const t = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(t) ? undefined : t;
};

/**
 * MeetingSource over Omi's Developer API. There is no request throttle: Omi's limits are hourly,
 * so a 429 stops the run with Retry-After and the sync job's chain delay paces the rest.
 */
export function createOmiCloudMeetingSource(options: OmiCloudMeetingSourceOptions): MeetingSource {
  if (isOmiMcpKey(options.apiKey))
    throw new MeetingSourceError("auth", "This is an Omi MCP key, not a Developer key");
  const baseUrl = (options.baseUrl ?? OMI_CLOUD_API_BASE_URL).replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;

  async function request(path: string, query: Record<string, string>) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    let res: Response;
    try {
      res = await doFetch(url, { headers: { authorization: `Bearer ${options.apiKey}` } });
    } catch {
      throw new MeetingSourceError("unavailable", "Omi is unreachable");
    }
    if (res.status === 401 || res.status === 403)
      throw new MeetingSourceError("auth", "Omi rejected the API key");
    if (res.status === 429) {
      const seconds = Number(res.headers.get("retry-after"));
      throw new MeetingSourceError(
        "rate_limit",
        "Omi rate limit",
        Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined,
      );
    }
    if (res.status === 404) throw new MeetingSourceError("not_found", "No such conversation");
    if (res.status === 400 || res.status >= 500)
      throw new MeetingSourceError("unavailable", "Omi is unavailable");
    if (!res.ok) throw new MeetingSourceError("mapping", `Unexpected status ${res.status}`);
    try {
      return { res, body: (await res.json()) as unknown };
    } catch {
      throw new MeetingSourceError("mapping", "Omi sent a body that is not JSON");
    }
  }

  const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const result = schema.safeParse(value);
    if (!result.success) throw new MeetingSourceError("mapping", "Unexpected Omi response");
    return result.data;
  };

  /** Omi orders and filters its list by created_at; started_at only when that is missing. */
  const createdOf = (c: z.infer<typeof OmiCloudConversationSchema>) =>
    ms(c.created_at) ?? ms(c.started_at) ?? updatedOf(c);

  const updatedOf = (c: z.infer<typeof OmiCloudConversationSchema>) => {
    const t = ms(c.finished_at) ?? ms(c.started_at) ?? ms(c.created_at);
    if (t === undefined) throw new MeetingSourceError("mapping", "Unexpected Omi response");
    return t;
  };

  const actionsOf = (c: z.infer<typeof OmiCloudConversationSchema>) =>
    (c.structured?.action_items ?? [])
      .map((a) => (typeof a === "string" ? a : (a.description ?? a.text ?? "")).trim())
      .filter(Boolean);
  /** Omi sends no edit time, so an edit is found by a change in what the list already returns. */
  const versionOf = (c: z.infer<typeof OmiCloudConversationSchema>) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          c.structured?.title ?? "",
          c.structured?.overview?.trim() ?? "",
          actionsOf(c),
          c.finished_at ?? "",
        ]),
      )
      .digest("hex")
      .slice(0, 32);

  /** The conversation as a meeting. Segments, when there are any, become the transcript. */
  function toMeeting(
    c: z.infer<typeof OmiCloudConversationSchema>,
    includeTranscript: boolean,
  ): SourceMeeting {
    const updated = updatedOf(c);
    const startedAt = ms(c.started_at) ?? ms(c.created_at) ?? updated;
    const segments = (c.transcript_segments ?? []).filter((s) => s.text.trim());
    let lines: MeetingTranscriptLine[] | null = null;
    let truncated = false;
    if (includeTranscript) {
      lines = [];
      let bytes = 0;
      for (const s of segments) {
        bytes += Buffer.byteLength(s.text);
        if (bytes > MEETING_TRANSCRIPT_MAX_BYTES) {
          lines.push({ text: MEETING_TRUNCATION_MARKER.trim() });
          truncated = true;
          break;
        }
        const speaker = s.speaker || (s.is_user ? "Me" : undefined);
        lines.push({
          text: s.text,
          ...(speaker ? { speaker } : {}),
          ...(typeof s.start === "number"
            ? { at: new Date(startedAt + s.start * 1000).toISOString() }
            : {}),
        });
      }
    }
    // Omi may return no segments at all; then the overview and action items are the content.
    const overview = c.structured?.overview?.trim() ?? "";
    const actions = actionsOf(c);
    const summary =
      segments.length > 0 || actions.length === 0
        ? overview
        : [overview, actions.map((a) => `- ${a}`).join("\n")].filter(Boolean).join("\n\n");
    return {
      externalId: c.id,
      title: c.structured?.title ?? "",
      startedAt: new Date(startedAt).toISOString(),
      endedAt:
        ms(c.finished_at) === undefined ? null : new Date(ms(c.finished_at) ?? 0).toISOString(),
      attendees: [],
      organizerEmail: null,
      sourceUrl: null,
      folders: [],
      summary,
      privateNotes: "",
      transcript: lines && lines.length > 0 ? lines : null,
      ...(truncated ? { transcriptTruncated: true } : {}),
      updatedAt: new Date(updated).toISOString(),
      version: versionOf(c),
      // Nothing to read at all is noise: stored hidden, so it is not fetched again at this update.
      ...(includeTranscript && segments.length === 0 && !summary ? { deleted: true } : {}),
    };
  }

  const detailPath = (id: string) => `/v1/dev/user/conversations/${encodeURIComponent(id)}`;

  // Transcripts come in bulk from a one-day list window, as Omi's pagination guidance advises.
  // Each window ends at the conversation being read, so it is on the first page together with the
  // older ones that follow it; what a page holds is kept for the next get of the same run.
  // ponytail: each window ends at the conversation being read. If Omi ignored the time in
  // end_date, a miss falls back to the detail call: one conversation per run, slower but never stuck.
  const transcripts = new Map<string, z.infer<typeof OmiCloudConversationSchema>>();
  const createdAt = new Map<string, number>();
  let transcriptCalls = 0;

  async function fromWindow(id: string) {
    const created = createdAt.get(id);
    if (created === undefined || transcriptCalls >= (options.maxTranscriptCalls ?? Infinity))
      return undefined;
    transcriptCalls++;
    const end = created + 999;
    const { body } = await request("/v1/dev/user/conversations", {
      limit: String(PAGE_SIZE),
      include_transcript: "true",
      start_date: new Date(end - DAY_MS + 1).toISOString(),
      end_date: new Date(end).toISOString(),
      offset: "0",
    });
    // transcript_included false: the list left this one out; the detail call fills it in.
    for (const c of parse(ListPage, body))
      if (c.transcript_included !== false) transcripts.set(c.id, c);
    return transcripts.get(id);
  }

  return {
    provider: "omi_cloud",

    async list(filter) {
      const { res, body } = await request("/v1/dev/user/conversations", {
        limit: String(PAGE_SIZE),
        include_transcript: "false",
        ...(filter.cursor ? { cursor: filter.cursor } : {}),
      });
      const next = res.headers.get("x-omi-next-cursor");
      const hasMore = res.headers.get("x-omi-has-more") === "true";
      if (res.headers.get("x-omi-list-truncated") === "true" && !(hasMore && next))
        throw new MeetingSourceError("unavailable", "Omi returned a partial list");
      if (hasMore && (!next || next === filter.cursor))
        throw new MeetingSourceError("mapping", "Omi paging did not advance");
      const items = [];
      // Omi orders by created_at, newest first. The walk ends at a conversation created more than
      // a day before the boundary, so a recording uploaded late is still found.
      const boundary = (filter.updatedAfter ?? filter.createdAfter)?.getTime();
      const cutoff = boundary === undefined ? undefined : boundary - LIST_OVERLAP_MS;
      let pastBoundary = false;
      for (const c of parse(ListPage, body)) {
        const updated = updatedOf(c);
        const started = ms(c.started_at) ?? ms(c.created_at) ?? updated;
        const created = createdOf(c);
        if (cutoff !== undefined && created < cutoff) {
          pastBoundary = true;
          continue;
        }
        const finished = ms(c.finished_at);
        if (finished !== undefined && finished - started < MIN_DURATION_MS) continue;
        createdAt.set(c.id, created);
        items.push({
          externalId: c.id,
          updatedAt: new Date(updated).toISOString(),
          version: versionOf(c),
        });
      }
      return { items, ...(hasMore && next && !pastBoundary ? { nextCursor: next } : {}) };
    },

    canGet(externalId) {
      return (
        transcripts.has(externalId) || transcriptCalls < (options.maxTranscriptCalls ?? Infinity)
      );
    },

    async get(externalId, { includeTranscript }): Promise<SourceMeeting> {
      if (!includeTranscript) {
        const { body } = await request(detailPath(externalId), { include_transcript: "false" });
        return toMeeting(parse(OmiCloudConversationSchema, body), false);
      }
      const cached = transcripts.get(externalId) ?? (await fromWindow(externalId));
      if (cached) return toMeeting(cached, true);
      if (transcriptCalls >= (options.maxTranscriptCalls ?? Infinity))
        throw new MeetingSourceError("budget", "Omi transcript budget spent for this run");
      transcriptCalls++;
      const { body } = await request(detailPath(externalId), { include_transcript: "true" });
      return toMeeting(parse(OmiCloudConversationSchema, body), true);
    },
  };
}
