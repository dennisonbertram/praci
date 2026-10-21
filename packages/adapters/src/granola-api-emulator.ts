import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { SourceMeeting } from "@rakazo/contracts";

export interface GranolaApiEmulatorOptions {
  meetings: SourceMeeting[];
  /** The one key the emulator accepts. */
  apiKey?: string;
  /** 0 picks a free port. */
  port?: number;
  /** Upper bound on page_size, so small values exercise paging. Docs: 30. */
  maxPageSize?: number;
  /** Items per page of the paged transcript endpoint. Docs: up to 100. */
  transcriptPageSize?: number;
}

const noteId = (externalId: string) => externalId;

/**
 * Offline stand-in for the Granola public API endpoints the Meetings sync uses: list notes, get
 * note (with `include=transcript`, 413 TRANSCRIPT_TOO_LARGE) and the paged transcript. It encodes
 * only what docs.granola.ai states. A meeting's startedAt serves as created_at and as the
 * calendar event start.
 */
export class GranolaApiEmulator {
  readonly apiKey: string;
  /** Respond 429 (with Retry-After: 1) to this many next API calls. */
  rateLimitNext = 0;
  /** Notes whose inline transcript is "too large": get-note answers 413. */
  readonly tooLarge = new Set<string>();
  /** Notes whose get-note body has an unknown shape. */
  readonly brokenShape = new Set<string>();
  readonly requests: Array<{ path: string; query: string; authorization: string | null }> = [];
  private server: ReturnType<typeof createServer> | undefined;
  private readonly meetings: SourceMeeting[];
  private readonly maxPageSize: number;
  private readonly transcriptPageSize: number;
  private readonly port: number;

  constructor(options: GranolaApiEmulatorOptions) {
    this.apiKey = options.apiKey ?? "grn_emulator_key";
    this.maxPageSize = options.maxPageSize ?? 30;
    this.transcriptPageSize = options.transcriptPageSize ?? 100;
    this.port = options.port ?? 0;
    this.meetings = [...options.meetings].sort(
      (a, b) =>
        Date.parse(a.updatedAt) - Date.parse(b.updatedAt) ||
        a.externalId.localeCompare(b.externalId),
    );
  }

  /** Starts listening on 127.0.0.1 and returns the base URL (ends in /v1). */
  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://emulator.test");
      const [status, body, headers] = this.handle(
        url,
        req.headers.authorization ?? null,
        req.method ?? "GET",
      );
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => this.server?.listen(this.port, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/v1`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }

  private summary(m: SourceMeeting) {
    return {
      id: noteId(m.externalId),
      object: "note",
      title: m.title,
      owner: { name: "Owner Example", email: "owner@example.test" },
      created_at: m.startedAt,
      updated_at: m.updatedAt,
      deleted_at: null,
    };
  }

  private note(m: SourceMeeting, transcript: unknown) {
    return {
      ...this.summary(m),
      web_url: m.sourceUrl ?? `https://notes.example.test/d/${m.externalId}`,
      calendar_event: {
        event_title: m.title,
        invitees: m.attendees.flatMap((a) => (a.email ? [{ email: a.email }] : [])),
        organiser: m.organizerEmail,
        calendar_event_id: `evt_${m.externalId}`,
        scheduled_start_time: m.startedAt,
        scheduled_end_time: m.endedAt,
      },
      attendees: m.attendees.map((a) => ({ name: a.name ?? null, email: a.email ?? "" })),
      folder_membership: m.folders.map((name, i) => ({
        id: `fol_${String(i).padStart(14, "0")}`,
        object: "folder",
        name,
        parent_folder_id: null,
      })),
      space_membership: [],
      summary_text: m.summary,
      summary_markdown: m.summary,
      private_notes_text: m.privateNotes || null,
      private_notes_markdown: m.privateNotes || null,
      transcript,
    };
  }

  private items(m: SourceMeeting) {
    return (m.transcript ?? []).map((line) => ({
      speaker: { source: "microphone", ...(line.speaker ? { name: line.speaker } : {}) },
      text: line.text,
      // Docs list the times as always present; fixtures without a time leave them out.
      ...(line.at ? { start_time: line.at, end_time: line.at } : {}),
    }));
  }

  private handle(
    url: URL,
    authorization: string | null,
    method: string,
  ): [number, unknown, Record<string, string>?] {
    this.requests.push({ path: url.pathname, query: url.search, authorization });
    if (authorization !== `Bearer ${this.apiKey}`) return [401, { error: "unauthorized" }];
    if (this.rateLimitNext > 0) {
      this.rateLimitNext -= 1;
      return [429, { error: "too_many_requests" }, { "retry-after": "1" }];
    }
    if (method !== "GET") return [404, { error: "not_found" }];
    const q = url.searchParams;
    if (url.pathname === "/v1/notes") return this.list(q);
    const match = /^\/v1\/notes\/([^/]+)(\/transcript)?$/.exec(url.pathname);
    const meeting = match && this.meetings.find((m) => m.externalId === match[1]);
    if (!match || !meeting) return [404, { error: "not_found" }];
    if (match[2]) return this.transcriptPage(meeting, q);
    if (this.brokenShape.has(meeting.externalId)) return [200, { id: meeting.externalId, nope: 1 }];
    if (q.get("include") !== "transcript") return [200, this.note(meeting, null)];
    if (this.tooLarge.has(meeting.externalId))
      return [413, { error: { code: "TRANSCRIPT_TOO_LARGE" } }];
    return [200, this.note(meeting, meeting.transcript ? this.items(meeting) : null)];
  }

  private list(q: URLSearchParams): [number, unknown] {
    const date = (name: string) => {
      const raw = q.get(name);
      return raw === null ? undefined : Date.parse(raw);
    };
    const [before, after, updated] = [
      date("created_before"),
      date("created_after"),
      date("updated_after"),
    ];
    if ([before, after, updated].some((d) => Number.isNaN(d))) return [400, { error: "bad_date" }];
    const size = q.has("page_size") ? Number(q.get("page_size")) : 10;
    const start = q.has("cursor") ? Number(Buffer.from(q.get("cursor") ?? "", "base64url")) : 0;
    if (!Number.isInteger(size) || size < 1 || size > 30) return [400, { error: "bad_page_size" }];
    if (!Number.isInteger(start) || start < 0) return [400, { error: "bad_cursor" }];
    const matching = this.meetings.filter(
      (m) =>
        (before === undefined || Date.parse(m.startedAt) < before) &&
        (after === undefined || Date.parse(m.startedAt) > after) &&
        (updated === undefined || Date.parse(m.updatedAt) > updated),
    );
    const take = Math.min(size, this.maxPageSize);
    const next = start + take;
    return [
      200,
      {
        notes: matching.slice(start, next).map((m) => this.summary(m)),
        hasMore: next < matching.length,
        cursor: next < matching.length ? Buffer.from(String(next)).toString("base64url") : null,
      },
    ];
  }

  private transcriptPage(m: SourceMeeting, q: URLSearchParams): [number, unknown] {
    const start = q.has("cursor") ? Number(Buffer.from(q.get("cursor") ?? "", "base64url")) : 0;
    if (!Number.isInteger(start) || start < 0) return [400, { error: "bad_cursor" }];
    const all = this.items(m);
    const next = start + this.transcriptPageSize;
    return [
      200,
      {
        transcript: all.slice(start, next),
        hasMore: next < all.length,
        cursor: next < all.length ? Buffer.from(String(next)).toString("base64url") : null,
      },
    ];
  }
}
