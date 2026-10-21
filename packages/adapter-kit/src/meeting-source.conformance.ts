import type { SourceMeeting } from "@rakazo/contracts";
import { MEETING_TRANSCRIPT_MAX_BYTES } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import type { MeetingSource } from "./interfaces.js";
import { MeetingSourceError } from "./types.js";

/** An invented meeting; the suite seeds the source under test with these. */
export const conformanceMeeting = (n: number, over: Partial<SourceMeeting> = {}): SourceMeeting => {
  const day = String(n).padStart(2, "0");
  return {
    externalId: `m-${day}`,
    title: `Meeting ${day}`,
    startedAt: `2026-01-${day}T10:00:00.000Z`,
    endedAt: `2026-01-${day}T10:30:00.000Z`,
    attendees: [{ name: "Ada Example", email: "ada@example.test" }],
    organizerEmail: "ada@example.test",
    sourceUrl: null,
    folders: [],
    summary: `Summary ${day}`,
    privateNotes: "",
    transcript: [{ speaker: "Ada", text: `Line ${day}` }],
    updatedAt: `2026-01-${day}T12:00:00.000Z`,
    ...over,
  };
};

/**
 * Behaviour every MeetingSource must have. The factory builds a source that holds exactly the
 * given meetings, with a page size of 2 (paging is checked with 5 meetings).
 */
export function runMeetingSourceConformance(
  name: string,
  factory: (
    meetings: SourceMeeting[],
    options: { pageSize: number },
  ) => MeetingSource | Promise<MeetingSource>,
) {
  describe(`MeetingSource conformance: ${name}`, () => {
    // Out of order on purpose; m-03 was created early but updated last.
    const seed = [
      conformanceMeeting(4),
      conformanceMeeting(1),
      conformanceMeeting(3, { updatedAt: "2026-02-01T00:00:00.000Z" }),
      conformanceMeeting(5, { transcript: null }),
      conformanceMeeting(2),
    ];
    const make = () => factory(seed, { pageSize: 2 });
    const listAll = async (
      source: MeetingSource,
      filter: Parameters<MeetingSource["list"]>[0] = {},
    ) => {
      const items: Awaited<ReturnType<MeetingSource["list"]>>["items"] = [];
      let cursor = filter.cursor;
      for (let page = 0; page < 20; page++) {
        const result = await source.list({ ...filter, cursor });
        items.push(...result.items);
        if (!result.nextCursor) return { items, pages: page + 1 };
        cursor = result.nextCursor;
      }
      throw new Error("list never ended");
    };

    it("lists oldest update first and pages by cursor without repeats", async () => {
      const { items, pages } = await listAll(await make());
      expect(items.map((i) => i.externalId)).toEqual(["m-01", "m-02", "m-04", "m-05", "m-03"]);
      expect(pages).toBe(3);
    });

    it("lists only meetings updated after a given time", async () => {
      const { items } = await listAll(await make(), {
        updatedAfter: new Date("2026-01-04T12:00:00.000Z"),
      });
      expect(items.map((i) => i.externalId)).toEqual(["m-05", "m-03"]);
    });

    it("lists only meetings created after a given time", async () => {
      const { items } = await listAll(await make(), {
        createdAfter: new Date("2026-01-04T00:00:00.000Z"),
      });
      expect(items.map((i) => i.externalId).sort()).toEqual(["m-04", "m-05"]);
    });

    it("returns a meeting without its transcript unless asked", async () => {
      const source = await make();
      expect((await source.get("m-01", { includeTranscript: false })).transcript).toBeNull();
      const full = await source.get("m-01", { includeTranscript: true });
      expect(full).toMatchObject({
        externalId: "m-01",
        title: "Meeting 01",
        summary: "Summary 01",
      });
      expect(full.transcript).toEqual([{ speaker: "Ada", text: "Line 01" }]);
    });

    it("returns a null transcript when the meeting has none", async () => {
      const meeting = await (await make()).get("m-05", { includeTranscript: true });
      expect(meeting.transcript).toBeNull();
    });

    it("cuts a too-large transcript below the cap and says so", async () => {
      const line = { speaker: "Ada", text: "x".repeat(100_000) };
      const big = conformanceMeeting(6, {
        transcript: Array.from(
          { length: Math.ceil(MEETING_TRANSCRIPT_MAX_BYTES / 100_000) + 2 },
          () => line,
        ),
      });
      const source = await factory([big], { pageSize: 2 });
      const meeting = await source.get("m-06", { includeTranscript: true });
      const bytes = (meeting.transcript ?? []).reduce((n, l) => n + Buffer.byteLength(l.text), 0);
      expect(meeting.transcriptTruncated).toBe(true);
      expect(bytes).toBeLessThanOrEqual(MEETING_TRANSCRIPT_MAX_BYTES + 100);
    });

    it("throws a typed not_found error for an unknown meeting", async () => {
      const error = await (await make()).get("nope", { includeTranscript: false }).catch((e) => e);
      expect(error).toBeInstanceOf(MeetingSourceError);
      expect((error as MeetingSourceError).kind).toBe("not_found");
    });
  });
}
