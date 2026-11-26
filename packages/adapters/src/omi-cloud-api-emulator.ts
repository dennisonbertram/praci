import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { OmiCloudSegment } from "@rakazo/contracts";

const createdOf = (c: { createdAt?: string; finishedAt: string }) => c.createdAt ?? c.finishedAt;

export interface OmiEmulatorConversation {
  id: string;
  title: string;
  overview: string;
  actionItems?: string[];
  startedAt: string;
  finishedAt: string;
  /** When Omi stored it (a late upload is created long after it started). Default: finishedAt. */
  createdAt?: string;
  segments: OmiCloudSegment[];
}

const seg = (text: string, start: number, speaker = "SPEAKER_0", is_user = false) => ({
  text,
  speaker,
  is_user,
  start,
  end: start + 5,
});

const HOUR = 3_600_000;
const iso = (base: Date, hoursAgo: number, minutes = 0) =>
  new Date(base.getTime() - hoursAgo * HOUR + minutes * 60_000).toISOString();

/**
 * Invented conversations, dated back from `now`: one with segments, one with only an
 * overview and action items, one under two minutes and one with nothing to read. The demo uses the current time so they fall inside the import window.
 */
export const omiEmulatorConversations = (now = new Date()): OmiEmulatorConversation[] => [
  {
    id: "omi-conv-4",
    title: "Roadmap sync",
    overview: "Agreed the Q3 roadmap order.",
    startedAt: iso(now, 9),
    finishedAt: iso(now, 9, 20),
    segments: [
      seg("Let's start with the roadmap.", 0, "SPEAKER_0", true),
      seg("Sounds good.", 6, "SPEAKER_1"),
    ],
  },
  {
    id: "omi-conv-3",
    title: "Quick hello",
    overview: "A short greeting.",
    startedAt: iso(now, 36),
    finishedAt: iso(now, 36, 0.75),
    segments: [],
  },
  {
    id: "omi-conv-2",
    title: "Silent recording",
    overview: "",
    startedAt: iso(now, 63),
    finishedAt: iso(now, 63, 10),
    segments: [],
  },
  {
    id: "omi-conv-1",
    title: "Hiring debrief",
    overview: "Decided to extend an offer.",
    actionItems: ["Send the offer letter", "Tell the other candidates"],
    startedAt: iso(now, 86),
    finishedAt: iso(now, 86, 30),
    // Like most real conversations seen so far: an overview and no segments.
    segments: [],
  },
];

export interface OmiCloudApiEmulatorOptions {
  conversations?: OmiEmulatorConversation[];
  apiKey?: string;
  /** 0 picks a free port. */
  port?: number;
  /** Upper bound on `limit`, so small values exercise cursor paging. */
  maxPageSize?: number;
}

/**
 * Offline stand-in for the Omi Developer API endpoints the sync uses: conversations list (cursor
 * paging through `x-omi-next-cursor` and `x-omi-has-more`), conversation detail with
 * `include_transcript`, and an empty memories list. Encodes what the S0 probe saw. Newest created first, as Omi orders and filters.
 */
export class OmiCloudApiEmulator {
  readonly apiKey: string;
  /** Respond 429 (with Retry-After) to this many next API calls. */
  rateLimitNext = 0;
  retryAfterSeconds = 7;
  /** Answer every call 401, as for a revoked key. */
  rejectAll = false;
  /** Answer every call 503. */
  down = false;
  /** Conversations whose list entry has no transcript even when asked for one (detail has it). */
  readonly listWithoutTranscript = new Set<string>();
  readonly requests: Array<{ path: string; query: string; authorization: string | null }> = [];
  private server: ReturnType<typeof createServer> | undefined;
  private readonly conversations: OmiEmulatorConversation[];
  private readonly maxPageSize: number;
  private readonly port: number;

  constructor(options: OmiCloudApiEmulatorOptions = {}) {
    this.apiKey = options.apiKey ?? "omi_dev_emulator_key";
    this.maxPageSize = options.maxPageSize ?? 25;
    this.port = options.port ?? 0;
    this.conversations = [...(options.conversations ?? omiEmulatorConversations())].sort(
      (a, b) => Date.parse(createdOf(b)) - Date.parse(createdOf(a)) || b.id.localeCompare(a.id),
    );
  }

  conversationIds() {
    return this.conversations.map((c) => c.id);
  }

  /** Starts listening on 127.0.0.1 and returns the base URL (no path). */
  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://emulator.test");
      const [status, body, headers] = this.handle(url, req.headers.authorization ?? null);
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => this.server?.listen(this.port, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }

  private shape(c: OmiEmulatorConversation, withTranscript: boolean) {
    return {
      id: c.id,
      created_at: createdOf(c),
      started_at: c.startedAt,
      finished_at: c.finishedAt,
      structured: {
        title: c.title,
        overview: c.overview,
        action_items: (c.actionItems ?? []).map((description) => ({
          description,
          completed: false,
        })),
        emoji: "",
        category: "other",
      },
      language: "en",
      source: "omi",
      transcript_segments: withTranscript ? c.segments : null,
      transcript_included: withTranscript,
    };
  }

  private handle(
    url: URL,
    authorization: string | null,
  ): [number, unknown, Record<string, string>?] {
    this.requests.push({ path: url.pathname, query: url.search, authorization });
    if (this.rejectAll || authorization !== `Bearer ${this.apiKey}`)
      return [401, { detail: "Invalid API key" }];
    if (this.down) return [503, { detail: "unavailable" }];
    if (this.rateLimitNext > 0) {
      this.rateLimitNext -= 1;
      return [429, { detail: "rate limited" }, { "retry-after": String(this.retryAfterSeconds) }];
    }
    const q = url.searchParams;
    if (url.pathname === "/v1/dev/user/memories") return [200, []];
    if (url.pathname === "/v1/dev/user/conversations") {
      const limit = q.has("limit") ? Number(q.get("limit")) : 25;
      if (!Number.isInteger(limit) || limit < 1) return [400, { detail: "bad limit" }];
      const size = Math.min(limit, this.maxPageSize);
      const withTranscript = q.get("include_transcript") === "true";
      const from = q.has("start_date") ? Date.parse(q.get("start_date") ?? "") : undefined;
      const to = q.has("end_date") ? Date.parse(q.get("end_date") ?? "") : undefined;
      if (Number.isNaN(from) || Number.isNaN(to)) return [400, { detail: "bad date" }];
      const inWindow = this.conversations.filter(
        (c) =>
          (from === undefined || Date.parse(createdOf(c)) >= from) &&
          (to === undefined || Date.parse(createdOf(c)) <= to),
      );
      // Transcripts and date windows page by offset; the plain list pages by cursor.
      const byOffset = withTranscript || from !== undefined || q.has("offset");
      const decoded = q.has("cursor")
        ? Buffer.from(q.get("cursor") ?? "", "base64url").toString()
        : "0";
      const start = byOffset
        ? Number(q.get("offset") ?? "0")
        : /^\d+$/.test(decoded)
          ? Number(decoded)
          : -1;
      if (!Number.isInteger(start) || start < 0) return [400, { detail: "invalid cursor" }];
      const next = start + size;
      const more = next < inWindow.length;
      return [
        200,
        inWindow
          .slice(start, next)
          .map((c) => this.shape(c, withTranscript && !this.listWithoutTranscript.has(c.id))),
        {
          "x-omi-has-more": String(more),
          "x-omi-effective-limit": String(size),
          ...(more
            ? byOffset
              ? { "x-omi-next-offset": String(next) }
              : { "x-omi-next-cursor": Buffer.from(String(next)).toString("base64url") }
            : {}),
        },
      ];
    }
    const match = /^\/v1\/dev\/user\/conversations\/([^/]+)$/.exec(url.pathname);
    const found =
      match && this.conversations.find((c) => c.id === decodeURIComponent(match[1] ?? ""));
    if (!found) return [404, { detail: "Not found" }];
    return [200, this.shape(found, q.get("include_transcript") === "true")];
  }
}
