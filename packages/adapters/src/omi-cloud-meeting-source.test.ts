import { MeetingSourceError } from "@rakazo/adapter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { createMeetingSourceRegistry } from "./meeting-source-registry.js";
import { CHAIN_DELAY_MS } from "./meeting-sync-job.js";
import { OmiCloudApiEmulator, omiEmulatorConversations } from "./omi-cloud-api-emulator.js";
import { createOmiCloudMeetingSource } from "./omi-cloud-meeting-source.js";

const KEY = "omi_dev_test_key";
const open: OmiCloudApiEmulator[] = [];

async function setupBase(options: ConstructorParameters<typeof OmiCloudApiEmulator>[0] = {}) {
  const emulator = new OmiCloudApiEmulator({ apiKey: KEY, ...options });
  open.push(emulator);
  return { emulator, baseUrl: await emulator.start() };
}

async function setup(options: ConstructorParameters<typeof OmiCloudApiEmulator>[0] = {}) {
  const emulator = new OmiCloudApiEmulator({
    apiKey: KEY,
    conversations: omiEmulatorConversations(new Date("2026-02-05T00:00:00.000Z")),
    ...options,
  });
  open.push(emulator);
  const baseUrl = await emulator.start();
  return { emulator, source: createOmiCloudMeetingSource({ apiKey: KEY, baseUrl }) };
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((e) => e.stop()));
});

describe("omi cloud source", () => {
  it("pages with the cursor headers and drops conversations under two minutes", async () => {
    const { emulator, source } = await setup({ maxPageSize: 2 });
    const first = await source.list({});
    expect(first.items.map((i) => i.externalId)).toEqual(["omi-conv-4"]);
    expect(first.nextCursor).toBeTruthy();
    const second = await source.list({ cursor: first.nextCursor });
    expect(second.items.map((i) => i.externalId)).toEqual(["omi-conv-2", "omi-conv-1"]);
    expect(second.nextCursor).toBeUndefined();
    const [req] = emulator.requests;
    expect(req?.query).toContain("include_transcript=false");
    expect(req?.authorization).toBe(`Bearer ${KEY}`);
    expect(emulator.requests[1]?.query).toContain("cursor=");
  });

  it("stops paging at the createdAfter boundary", async () => {
    const { emulator, source } = await setup({ maxPageSize: 1 });
    // Newest first: conv-4 (Feb 4), conv-3 (Feb 3, too short), conv-2 (Feb 2), conv-1 (Feb 1).
    // The walk ends at a start more than 24 hours before this: before Feb 2 00:00.
    const after = new Date("2026-02-03T00:00:00.000Z");
    let page = await source.list({ createdAfter: after });
    const ids = page.items.map((i) => i.externalId);
    while (page.nextCursor) {
      page = await source.list({ createdAfter: after, cursor: page.nextCursor });
      ids.push(...page.items.map((i) => i.externalId));
    }
    expect(ids).toEqual(["omi-conv-4", "omi-conv-2"]);
    // Four pages: the last is the boundary page (conv-1); nothing is requested after it.
    expect(emulator.requests).toHaveLength(4);
  });

  it("finds a recording uploaded late: it is ordered, cut off and windowed by created_at", async () => {
    const conv = (id: string, start: string, end: string, createdAt: string) => ({
      id,
      title: id,
      overview: "Something was said.",
      startedAt: start,
      finishedAt: end,
      createdAt,
      segments: [{ text: `Words in ${id}` }],
    });
    const { emulator, baseUrl } = await setupBase({
      conversations: [
        conv(
          "fresh",
          "2026-02-05T09:00:00.000Z",
          "2026-02-05T09:30:00.000Z",
          "2026-02-05T09:30:00.000Z",
        ),
        // Started three days ago, uploaded just now.
        conv(
          "late",
          "2026-02-02T09:00:00.000Z",
          "2026-02-02T09:30:00.000Z",
          "2026-02-05T08:00:00.000Z",
        ),
        conv(
          "old",
          "2026-01-20T09:00:00.000Z",
          "2026-01-20T09:30:00.000Z",
          "2026-01-20T09:30:00.000Z",
        ),
      ],
    });
    const source = createOmiCloudMeetingSource({ apiKey: KEY, baseUrl, maxTranscriptCalls: 2 });
    const page = await source.list({ updatedAfter: new Date("2026-02-05T00:00:00.000Z") });
    expect(page.items.map((i) => i.externalId)).toEqual(["fresh", "late"]);
    expect(page.nextCursor).toBeUndefined();
    // Its window ends at its created time (Feb 5 08:00), where Omi filters it.
    await source.get("late", { includeTranscript: true });
    expect(emulator.requests.at(-1)?.query).toContain("end_date=2026-02-05T08%3A00%3A00.999Z");
  });

  it("stops a run before a detail fallback that would spend more than the budget", async () => {
    const conv = (id: string, hour: number) => ({
      id,
      title: id,
      overview: "Something was said.",
      startedAt: `2026-02-05T0${hour}:00:00.000Z`,
      finishedAt: `2026-02-05T0${hour}:30:00.000Z`,
      segments: [{ text: `Words in ${id}` }],
    });
    const { emulator, baseUrl } = await setupBase({
      conversations: [conv("x1", 1), conv("x2", 2)],
    });
    emulator.listWithoutTranscript.add("x1");
    emulator.listWithoutTranscript.add("x2");
    const source = createOmiCloudMeetingSource({ apiKey: KEY, baseUrl, maxTranscriptCalls: 1 });
    await source.list({});
    // The window call spends the one call, and the list left x2 without a transcript.
    await expect(source.get("x2", { includeTranscript: true })).rejects.toMatchObject({
      kind: "budget",
    });
    expect(
      emulator.requests.filter((r) => r.query.includes("include_transcript=true")),
    ).toHaveLength(1);
    expect(source.canGet?.("x1")).toBe(false);
  });

  it("gives a conversation a new version when its overview changes, and the same one when not", async () => {
    const base = {
      id: "c",
      title: "T",
      overview: "First.",
      startedAt: "2026-02-05T09:00:00.000Z",
      finishedAt: "2026-02-05T09:30:00.000Z",
      segments: [],
    };
    const versionOf = async (overview: string) => {
      const { source } = await setup({ conversations: [{ ...base, overview }] });
      const [item] = (await source.list({})).items;
      const detail = await source.get("c", { includeTranscript: true });
      expect(detail.version).toBe(item?.version);
      return item?.version;
    };
    const first = await versionOf("First.");
    expect(await versionOf("First.")).toBe(first);
    expect(await versionOf("Edited.")).not.toBe(first);
  });

  describe("transcripts through date windows", () => {
    const conv = (id: string, start: string) => ({
      id,
      title: id,
      overview: `Overview of ${id}`,
      startedAt: start,
      finishedAt: new Date(Date.parse(start) + 20 * 60_000).toISOString(),
      segments: [{ text: `Words in ${id}`, speaker: "SPEAKER_0", start: 0 }],
    });
    const days = [
      conv("a1", "2026-02-05T09:00:00.000Z"),
      conv("a2", "2026-02-05T11:00:00.000Z"),
      conv("a3", "2026-02-05T13:00:00.000Z"),
      conv("b1", "2026-02-04T09:00:00.000Z"),
      conv("b2", "2026-02-04T11:00:00.000Z"),
      conv("c1", "2026-02-03T09:00:00.000Z"),
    ];
    const windowed = (emulator: OmiCloudApiEmulator) =>
      emulator.requests.filter(
        (r) =>
          r.path === "/v1/dev/user/conversations" && r.query.includes("include_transcript=true"),
      );
    const detail = (emulator: OmiCloudApiEmulator) =>
      emulator.requests.filter((r) => /conversations\/[^/]+$/.test(r.path));

    it("reads one list call per day for all its conversations, with no detail calls", async () => {
      const { emulator, baseUrl } = await setupBase({ conversations: days });
      const source = createOmiCloudMeetingSource({ apiKey: KEY, baseUrl, maxTranscriptCalls: 2 });
      const { items } = await source.list({});
      const got = [];
      for (const item of items) {
        if (source.canGet?.(item.externalId) === false) break;
        got.push((await source.get(item.externalId, { includeTranscript: true })).externalId);
      }
      // Days Feb 5 and Feb 4 (2 calls); Feb 3 waits for the next run.
      expect(got).toEqual(["a3", "a2", "a1", "b2", "b1"]);
      expect(windowed(emulator)).toHaveLength(2);
      expect(detail(emulator)).toHaveLength(0);
      expect(windowed(emulator)[0]?.query).toContain("end_date=2026-02-05T13%3A20%3A00.999Z");
      expect(source.canGet?.("c1")).toBe(false);
    });

    it("imports a day of 60 conversations without stalling", async () => {
      const day = Date.parse("2026-02-05T00:00:00.000Z");
      const many = Array.from({ length: 60 }, (_, i) =>
        conv(`m${i}`, new Date(day + (i + 1) * 10 * 60_000).toISOString()),
      );
      const { baseUrl } = await setupBase({ conversations: many });
      const stored = new Set<string>();
      // One job run: walk the list, skip what is stored, stop when the budget is spent.
      for (let run = 0; run < 3; run++) {
        const source = createOmiCloudMeetingSource({ apiKey: KEY, baseUrl, maxTranscriptCalls: 2 });
        let cursor: string | undefined;
        walk: do {
          const page = await source.list({ cursor });
          for (const item of page.items) {
            if (stored.has(item.externalId)) continue;
            if (source.canGet?.(item.externalId) === false) break walk;
            try {
              await source.get(item.externalId, { includeTranscript: true });
            } catch (e) {
              if (e instanceof MeetingSourceError && e.kind === "budget") break walk;
              throw e;
            }
            stored.add(item.externalId);
          }
          cursor = page.nextCursor;
        } while (cursor);
      }
      expect(stored.size).toBe(60);
    });

    it("falls back to the detail call when the list leaves a transcript out", async () => {
      const { emulator, baseUrl } = await setupBase({ conversations: days });
      emulator.listWithoutTranscript.add("c1");
      const source = createOmiCloudMeetingSource({ apiKey: KEY, baseUrl, maxTranscriptCalls: 2 });
      await source.list({});
      const m = await source.get("c1", { includeTranscript: true });
      expect(m.transcript?.[0]?.text).toBe("Words in c1");
      expect(windowed(emulator)).toHaveLength(1);
      expect(detail(emulator)).toHaveLength(1);
      // Both calls spent the budget.
      expect(source.canGet?.("b1")).toBe(false);
    });
  });

  it("uses the segments when they exist, with the overview as the summary", async () => {
    const { emulator, source } = await setup();
    const m = await source.get("omi-conv-4", { includeTranscript: true });
    expect(emulator.requests.at(-1)?.query).toContain("include_transcript=true");
    expect(m).toMatchObject({
      title: "Roadmap sync",
      summary: "Agreed the Q3 roadmap order.",
      startedAt: "2026-02-04T15:00:00.000Z",
      endedAt: "2026-02-04T15:20:00.000Z",
      attendees: [],
    });
    expect(m.transcript).toEqual([
      {
        text: "Let's start with the roadmap.",
        speaker: "SPEAKER_0",
        at: "2026-02-04T15:00:00.000Z",
      },
      { text: "Sounds good.", speaker: "SPEAKER_1", at: "2026-02-04T15:00:06.000Z" },
    ]);
  });

  it("builds the content from the overview and action items when there are no segments", async () => {
    const { source } = await setup();
    const m = await source.get("omi-conv-1", { includeTranscript: true });
    expect(m.deleted).toBeUndefined();
    expect(m.transcript).toBeNull();
    expect(m.summary).toBe(
      "Decided to extend an offer.\n\n- Send the offer letter\n- Tell the other candidates",
    );
  });

  it("hides a conversation with neither segments nor an overview", async () => {
    const { source } = await setup();
    expect((await source.get("omi-conv-2", { includeTranscript: true })).deleted).toBe(true);
  });

  it("maps 429 to rate_limit with Retry-After in milliseconds", async () => {
    const { emulator, source } = await setup();
    emulator.rateLimitNext = 1;
    emulator.retryAfterSeconds = 42;
    await expect(source.list({})).rejects.toMatchObject({
      kind: "rate_limit",
      retryAfterMs: 42_000,
    });
  });

  it("maps 5xx and network errors to unavailable, and a bad cursor too", async () => {
    const { emulator, source } = await setup();
    await expect(source.list({ cursor: "!!" })).rejects.toMatchObject({ kind: "unavailable" });
    emulator.down = true;
    await expect(source.list({})).rejects.toMatchObject({ kind: "unavailable" });
    const gone = createOmiCloudMeetingSource({ apiKey: KEY, baseUrl: "http://127.0.0.1:1" });
    await expect(gone.list({})).rejects.toBeInstanceOf(MeetingSourceError);
    await expect(gone.list({})).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("rejects a mapping with no usable time", async () => {
    const source = createOmiCloudMeetingSource({
      apiKey: KEY,
      baseUrl: "http://omi.test",
      fetch: (async () =>
        new Response(JSON.stringify([{ id: "x", extra: 1 }]), { status: 200 })) as typeof fetch,
    });
    await expect(source.list({})).rejects.toMatchObject({ kind: "mapping" });
  });

  it("tolerates missing optional fields and unknown extras", async () => {
    const source = createOmiCloudMeetingSource({
      apiKey: KEY,
      baseUrl: "http://omi.test",
      fetch: (async () =>
        new Response(
          JSON.stringify({
            id: "x",
            started_at: "2026-02-01T10:00:00Z",
            unknown: { a: 1 },
            transcript_segments: [{ text: "hi", is_user: true, extra: 1 }],
            structured: { action_items: ["a string item"] },
          }),
          { status: 200 },
        )) as typeof fetch,
    });
    const m = await source.get("x", { includeTranscript: true });
    expect(m.title).toBe("");
    expect(m.endedAt).toBeNull();
    expect(m.transcript).toEqual([{ text: "hi", speaker: "Me" }]);
  });
});

describe("omi cloud keys", () => {
  it("throws auth for an omi_mcp_ key before any request", () => {
    let called = false;
    const fetcher = (async () => {
      called = true;
      return new Response("[]");
    }) as typeof fetch;
    expect(() => createOmiCloudMeetingSource({ apiKey: "omi_mcp_abc", fetch: fetcher })).toThrow(
      MeetingSourceError,
    );
    expect(called).toBe(false);
  });

  it("maps 401 and 403 to auth", async () => {
    const { emulator, source } = await setup();
    emulator.rejectAll = true;
    await expect(source.list({})).rejects.toMatchObject({ kind: "auth" });
    const forbidden = createOmiCloudMeetingSource({
      apiKey: KEY,
      baseUrl: "http://omi.test",
      fetch: (async () => new Response("{}", { status: 403 })) as typeof fetch,
    });
    await expect(forbidden.list({})).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("meeting source registry chain delay", () => {
  it("is slower for Omi than the default that other providers use", () => {
    const registry = createMeetingSourceRegistry();
    expect(registry.omi_cloud?.chainDelayMs).toBe(6 * 60_000);
    expect(registry.omi_cloud?.connectorId).toBe("omi-cloud");
    expect(registry.granola?.chainDelayMs).toBeUndefined();
    expect(CHAIN_DELAY_MS).toBe(1_000);
  });
});
