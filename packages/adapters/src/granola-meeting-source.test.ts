import { MeetingSourceError } from "@rakazo/adapter-kit";
import {
  conformanceMeeting,
  runMeetingSourceConformance,
} from "@rakazo/adapter-kit/meeting-source.conformance";
import type { SourceMeeting } from "@rakazo/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { GranolaApiEmulator } from "./granola-api-emulator.js";
import { createGranolaMeetingSource } from "./granola-meeting-source.js";

const KEY = "grn_test_key_1234567890";
const open: GranolaApiEmulator[] = [];

async function setup(meetings: SourceMeeting[], pageSize = 30) {
  const emulator = new GranolaApiEmulator({ meetings, apiKey: KEY, maxPageSize: pageSize });
  open.push(emulator);
  const baseUrl = await emulator.start();
  const sleeps: number[] = [];
  let clock = 0;
  const source = createGranolaMeetingSource({
    apiKey: KEY,
    baseUrl,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
  });
  return { emulator, source, sleeps, baseUrl };
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((e) => e.stop()));
});

runMeetingSourceConformance("granola adapter + emulator", async (meetings, { pageSize }) => {
  const { source } = await setup(meetings, pageSize);
  return source;
});

describe("granola adapter", () => {
  const old = conformanceMeeting(1, { updatedAt: "2026-03-01T00:00:00.000Z" });
  const recent = conformanceMeeting(9);

  it("an old meeting edited after the checkpoint is returned by updated_after and missed by created_after", async () => {
    const { source } = await setup([old, recent]);
    const checkpoint = new Date("2026-02-01T00:00:00.000Z");
    const incremental = await source.list({ updatedAfter: checkpoint });
    const backfill = await source.list({ createdAfter: checkpoint });
    expect(incremental.items.map((i) => i.externalId)).toEqual(["m-01"]);
    expect(backfill.items.map((i) => i.externalId)).toEqual([]);
  });

  it("sends page_size=30 and the filter, and the key only in the Authorization header", async () => {
    const { emulator, source } = await setup([old]);
    await source.list({ updatedAfter: new Date("2026-02-01T00:00:00.000Z") });
    const [req] = emulator.requests;
    expect(req?.query).toContain("page_size=30");
    expect(req?.query).toContain("updated_after=2026-02-01T00%3A00%3A00.000Z");
    expect(req?.query).not.toContain(KEY);
    expect(req?.authorization).toBe(`Bearer ${KEY}`);
  });

  it("maps calendar event, attendees, folders, notes and speakers", async () => {
    const { source } = await setup([
      conformanceMeeting(2, {
        folders: ["Board"],
        privateNotes: "my notes",
        transcript: [{ speaker: "Ada", text: "Hello", at: "2026-01-02T10:01:00.000Z" }],
        sourceUrl: "https://notes.example.test/d/2",
      }),
    ]);
    expect(await source.get("m-02", { includeTranscript: true })).toMatchObject({
      endedAt: "2026-01-02T10:30:00.000Z",
      organizerEmail: "ada@example.test",
      folders: ["Board"],
      privateNotes: "my notes",
      sourceUrl: "https://notes.example.test/d/2",
      attendees: [{ name: "Ada Example", email: "ada@example.test" }],
      transcript: [{ speaker: "Ada", text: "Hello", at: "2026-01-02T10:01:00.000Z" }],
    });
  });

  it("never reports deletions", async () => {
    const { source } = await setup([conformanceMeeting(3, { deleted: true })]);
    const page = await source.list({});
    expect(page.items[0]).not.toHaveProperty("deleted");
    expect(await source.get("m-03", { includeTranscript: false })).not.toHaveProperty("deleted");
  });

  it("backs off on 429, respecting Retry-After, then succeeds", async () => {
    const { emulator, source, sleeps } = await setup([old]);
    emulator.rateLimitNext = 2;
    const page = await source.list({});
    expect(page.items).toHaveLength(1);
    expect(sleeps.filter((s) => s >= 1000)).toEqual([1000, 1000]);
  });

  it("gives up with a rate_limit error after bounded retries", async () => {
    const { emulator, source } = await setup([old]);
    emulator.rateLimitNext = 100;
    const error = await source.list({}).catch((e) => e);
    expect(error).toBeInstanceOf(MeetingSourceError);
    expect(error.kind).toBe("rate_limit");
    expect(emulator.requests.length).toBe(5);
  });

  it("spaces requests at least 250 ms apart", async () => {
    const { source, sleeps } = await setup([old]);
    await source.list({});
    await source.list({});
    expect(sleeps).toEqual([250]);
  });

  it("joins the paged transcript after a 413", async () => {
    const lines = Array.from({ length: 250 }, (_, i) => ({ speaker: "Ada", text: `L${i}` }));
    const { emulator, source } = await setup([conformanceMeeting(4, { transcript: lines })]);
    emulator.tooLarge.add("m-04");
    const meeting = await source.get("m-04", { includeTranscript: true });
    expect(meeting.transcript?.map((l) => l.text)).toEqual(lines.map((l) => l.text));
    expect(emulator.requests.filter((r) => r.path.endsWith("/transcript"))).toHaveLength(3);
  });

  it("a response with an unknown shape writes no meeting", async () => {
    const { emulator, source } = await setup([conformanceMeeting(5)]);
    emulator.brokenShape.add("m-05");
    const error = await source.get("m-05", { includeTranscript: true }).catch((e) => e);
    expect(error).toBeInstanceOf(MeetingSourceError);
    expect(error.kind).toBe("mapping");
  });

  it("types auth failures and keeps the key out of every error", async () => {
    const { baseUrl } = await setup([old]);
    const wrongKey = "grn_wrong_key_abcdef";
    const source = createGranolaMeetingSource({ apiKey: wrongKey, baseUrl });
    for (const call of [
      () => source.list({}),
      () => source.get("m-01", { includeTranscript: false }),
    ]) {
      const error = await call().catch((e) => e);
      expect(error.kind).toBe("auth");
      expect(`${error.message} ${error.stack}`).not.toContain(wrongKey);
    }
  });

  it("types network failure as unavailable without leaking the key", async () => {
    const source = createGranolaMeetingSource({ apiKey: KEY, baseUrl: "http://127.0.0.1:1/v1" });
    const error = await source.list({}).catch((e) => e);
    expect(error.kind).toBe("unavailable");
    expect(error.message).not.toContain(KEY);
  });
});
