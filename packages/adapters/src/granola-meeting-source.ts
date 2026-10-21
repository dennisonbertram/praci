import type { MeetingSource } from "@rakazo/adapter-kit";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import type { MeetingTranscriptLine, SourceMeeting } from "@rakazo/contracts";
import {
  GRANOLA_API_BASE_URL,
  MEETING_TRANSCRIPT_MAX_BYTES,
  MEETING_TRUNCATION_MARKER,
} from "@rakazo/contracts";
import * as z from "zod";

export interface GranolaMeetingSourceOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Milliseconds clock and sleep, replaceable in tests. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Granola allows 5 requests a second sustained; stay under it. */
const MIN_GAP_MS = 250;
const MAX_RETRIES = 4;
const PAGE_SIZE = 30;

const User = z.object({ name: z.string().nullable().optional(), email: z.string() });
const Summary = z.object({
  id: z.string().min(1),
  updated_at: z.string(),
});
const ListPage = z.object({
  notes: z.array(Summary),
  hasMore: z.boolean(),
  cursor: z.string().nullable(),
});
const Speaker = z.object({
  source: z.string(),
  attribution: z.enum(["me", "them"]).optional(),
  diarization_label: z.string().optional(),
  name: z.string().optional(),
});
const TranscriptItem = z.object({
  speaker: Speaker,
  text: z.string(),
  start_time: z.string().optional(),
});
const Note = z.object({
  id: z.string().min(1),
  title: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  web_url: z.string(),
  calendar_event: z
    .object({
      organiser: z.string().nullable(),
      scheduled_start_time: z.string().nullable(),
      scheduled_end_time: z.string().nullable(),
    })
    .nullable(),
  attendees: z.array(User),
  folder_membership: z.array(z.object({ name: z.string() })),
  summary_text: z.string().nullable().optional(),
  summary_markdown: z.string().nullable().optional(),
  private_notes_text: z.string().nullable().optional(),
  private_notes_markdown: z.string().nullable().optional(),
  transcript: z.array(TranscriptItem).nullable().optional(),
});
const TranscriptPage = z.object({
  transcript: z.array(TranscriptItem),
  hasMore: z.boolean(),
  cursor: z.string().nullable(),
});

const speakerLabel = (s: z.infer<typeof Speaker>) =>
  s.name ??
  s.diarization_label ??
  (s.attribution === "me" ? "Me" : s.attribution === "them" ? "Them" : undefined);

function mapLines(items: z.infer<typeof TranscriptItem>[]) {
  const lines: MeetingTranscriptLine[] = items.map((i) => {
    const speaker = speakerLabel(i.speaker);
    return {
      text: i.text,
      ...(speaker ? { speaker } : {}),
      ...(i.start_time && !Number.isNaN(Date.parse(i.start_time)) ? { at: i.start_time } : {}),
    };
  });
  // Whole lines up to the cap, then a marker line.
  const kept: MeetingTranscriptLine[] = [];
  let bytes = 0;
  for (const line of lines) {
    bytes += Buffer.byteLength(line.text);
    if (bytes > MEETING_TRANSCRIPT_MAX_BYTES) {
      kept.push({ text: MEETING_TRUNCATION_MARKER.trim() });
      return { lines: kept, truncated: true };
    }
    kept.push(line);
  }
  return { lines: kept, truncated: false };
}

/**
 * MeetingSource over Granola's public API. The API offers no call that identifies the key's user
 * (note owners are not necessarily the key holder), so there is no accountId here.
 */
export function createGranolaMeetingSource(options: GranolaMeetingSourceOptions): MeetingSource {
  const baseUrl = (options.baseUrl ?? GRANOLA_API_BASE_URL).replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let nextSlot = 0;

  /** One GET, throttled; retries 429 with backoff. Returns parsed JSON or a status-only result. */
  async function request(path: string, query: Record<string, string>) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(0, nextSlot - now());
      nextSlot = Math.max(nextSlot, now()) + MIN_GAP_MS;
      if (wait > 0) await sleep(wait);
      let res: Response;
      try {
        res = await doFetch(url, { headers: { authorization: `Bearer ${options.apiKey}` } });
      } catch {
        throw new MeetingSourceError("unavailable", "Granola is unreachable");
      }
      if (res.status === 429) {
        const header = Number(res.headers.get("retry-after"));
        const delay = Number.isFinite(header) && header > 0 ? header * 1000 : 1000 * 2 ** attempt;
        if (attempt >= MAX_RETRIES)
          throw new MeetingSourceError("rate_limit", "Granola rate limit", delay);
        nextSlot = Math.max(nextSlot, now() + delay);
        continue;
      }
      if (res.status === 401 || res.status === 403)
        throw new MeetingSourceError("auth", "Granola rejected the API key");
      if (res.status === 404) throw new MeetingSourceError("not_found", "No such meeting");
      if (res.status >= 500) throw new MeetingSourceError("unavailable", "Granola is unavailable");
      if (res.status === 413) return { status: 413 as const };
      if (!res.ok) throw new MeetingSourceError("mapping", `Unexpected status ${res.status}`);
      try {
        return { status: 200 as const, body: (await res.json()) as unknown };
      } catch {
        throw new MeetingSourceError("mapping", "Granola sent a body that is not JSON");
      }
    }
  }

  const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const result = schema.safeParse(value);
    if (!result.success) throw new MeetingSourceError("mapping", "Unexpected Granola response");
    return result.data;
  };
  const ok = (r: Awaited<ReturnType<typeof request>>) => {
    if (r.status !== 200) throw new MeetingSourceError("mapping", "Unexpected status 413");
    return r.body;
  };

  async function pagedTranscript(id: string) {
    const items: z.infer<typeof TranscriptItem>[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 1000; page++) {
      const body = parse(
        TranscriptPage,
        ok(
          await request(`/notes/${encodeURIComponent(id)}/transcript`, {
            page_size: "100",
            ...(cursor ? { cursor } : {}),
          }),
        ),
      );
      items.push(...body.transcript);
      if (!body.hasMore || !body.cursor) return items;
      cursor = body.cursor;
    }
    throw new MeetingSourceError("mapping", "Transcript paging did not end");
  }

  return {
    provider: "granola",

    async list(filter) {
      const query: Record<string, string> = { page_size: String(PAGE_SIZE) };
      if (filter.cursor) query.cursor = filter.cursor;
      if (filter.updatedAfter) query.updated_after = filter.updatedAfter.toISOString();
      else if (filter.createdAfter) query.created_after = filter.createdAfter.toISOString();
      const page = parse(ListPage, ok(await request("/notes", query)));
      for (const n of page.notes)
        if (Number.isNaN(Date.parse(n.updated_at)))
          throw new MeetingSourceError("mapping", "Unexpected Granola response");
      return {
        items: page.notes.map((n) => ({
          externalId: n.id,
          updatedAt: new Date(n.updated_at).toISOString(),
        })),
        ...(page.hasMore && page.cursor ? { nextCursor: page.cursor } : {}),
      };
    },

    async get(externalId, { includeTranscript }): Promise<SourceMeeting> {
      const path = `/notes/${encodeURIComponent(externalId)}`;
      const first = await request(path, includeTranscript ? { include: "transcript" } : {});
      let items: z.infer<typeof TranscriptItem>[] | null;
      let note: z.infer<typeof Note>;
      if (first.status === 413) {
        const [bare, paged] = [
          parse(Note, ok(await request(path, {}))),
          await pagedTranscript(externalId),
        ];
        note = bare;
        items = paged;
      } else {
        note = parse(Note, first.body);
        items = includeTranscript ? (note.transcript ?? null) : null;
      }
      const startedAt = note.calendar_event?.scheduled_start_time ?? note.created_at;
      const endedAt = note.calendar_event?.scheduled_end_time ?? null;
      for (const d of [startedAt, endedAt, note.updated_at])
        if (d !== null && Number.isNaN(Date.parse(d)))
          throw new MeetingSourceError("mapping", "Unexpected Granola response");
      const transcript = items ? mapLines(items) : undefined;
      return {
        externalId: note.id,
        title: note.title ?? "",
        startedAt: new Date(startedAt).toISOString(),
        endedAt: endedAt ? new Date(endedAt).toISOString() : null,
        attendees: note.attendees.map((a) => ({
          ...(a.name ? { name: a.name } : {}),
          email: a.email,
        })),
        organizerEmail: note.calendar_event?.organiser ?? null,
        sourceUrl: note.web_url,
        folders: note.folder_membership.map((f) => f.name),
        summary: note.summary_markdown ?? note.summary_text ?? "",
        privateNotes: note.private_notes_markdown ?? note.private_notes_text ?? "",
        transcript: transcript ? transcript.lines : null,
        ...(transcript?.truncated ? { transcriptTruncated: true } : {}),
        updatedAt: new Date(note.updated_at).toISOString(),
      };
    },
  };
}
