import type { MeetingSourceError } from "@rakazo/adapter-kit";
import {
  conformanceMeeting,
  runMeetingSourceConformance,
} from "@rakazo/adapter-kit/meeting-source.conformance";
import { describe, expect, it } from "vitest";
import { createFakeWisprFlow } from "./wispr-flow-fake.js";
import { createWisprFlowMeetingSource } from "./wispr-flow-meeting-source.js";

runMeetingSourceConformance("wispr flow adapter + fake MCP server", (meetings, { pageSize }) => {
  const { call } = createFakeWisprFlow(meetings);
  return createWisprFlowMeetingSource({ call, pageSize });
});

describe("wispr flow meeting source", () => {
  it("maps notes, summary, times, link and attendee emails", async () => {
    const m = conformanceMeeting(1, { privateNotes: "# Notes\nPlan the launch" });
    const { call, calls } = createFakeWisprFlow([m]);
    const got = await createWisprFlowMeetingSource({ call }).get("m-01", {
      includeTranscript: true,
    });
    expect(got).toMatchObject({
      externalId: "m-01",
      title: "Meeting 01",
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      summary: "Summary 01",
      privateNotes: "# Notes\nPlan the launch",
      attendees: [{ name: "Ada Example", email: "ada@example.test" }],
      organizerEmail: "ada@example.test",
      sourceUrl: "https://flow.example.test/notes/m-01",
      updatedAt: m.updatedAt,
    });
    expect(calls.map((c) => c.tool)).toContain("get_meeting_participants_enriched");
  });

  it("follows the continuation line to read a long transcript in full", async () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ speaker: "Ada", text: `Line ${i}` }));
    const { call, calls } = createFakeWisprFlow([conformanceMeeting(1, { transcript: lines })], {
      chunk: 100,
    });
    const got = await createWisprFlowMeetingSource({ call }).get("m-01", {
      includeTranscript: true,
    });
    expect(got.transcript).toEqual(lines);
    expect(got.transcriptTruncated).toBeUndefined();
    expect(calls.filter((c) => c.args.view_transcript).length).toBeGreaterThan(2);
  });

  it("stops at the request cap and marks the transcript as cut", async () => {
    const lines = Array.from({ length: 5000 }, (_, i) => ({ speaker: "Ada", text: `Line ${i}` }));
    const { call, calls } = createFakeWisprFlow([conformanceMeeting(1, { transcript: lines })], {
      chunk: 100,
    });
    const got = await createWisprFlowMeetingSource({ call }).get("m-01", {
      includeTranscript: true,
    });
    expect(got.transcriptTruncated).toBe(true);
    expect(got.transcript?.at(-1)?.text).toBe("[transcript truncated]");
    expect(calls.filter((c) => c.args.view_transcript)).toHaveLength(25);
  });

  it("keeps transcript text that mentions start_char as text", async () => {
    const lines = [
      { speaker: "Ada", text: "set view_transcript.start_char=0 to begin" },
      { speaker: "Ada", text: "continue with view_transcript.start_char=999" },
    ];
    const { call, calls } = createFakeWisprFlow([conformanceMeeting(1, { transcript: lines })]);
    const got = await createWisprFlowMeetingSource({ call }).get("m-01", {
      includeTranscript: true,
    });
    expect(got.transcript).toEqual(lines);
    expect(calls.filter((c) => c.args.view_transcript)).toHaveLength(1);
  });

  it("marks notes cut by the request cap", async () => {
    const { call } = createFakeWisprFlow(
      [conformanceMeeting(1, { privateNotes: "n".repeat(900) })],
      {
        chunk: 100,
      },
    );
    const got = await createWisprFlowMeetingSource({ call }).get("m-01", {
      includeTranscript: false,
    });
    expect(got.privateNotes.endsWith("\n[notes truncated]")).toBe(true);
    expect(got.privateNotes.length).toBeLessThan(600);
  });

  it("never lists or reads a meeting shared by someone else", async () => {
    const { call } = createFakeWisprFlow([conformanceMeeting(1), conformanceMeeting(2)], {
      sharedIds: ["m-02"],
    });
    const source = createWisprFlowMeetingSource({ call });
    expect((await source.list({})).items.map((i) => i.externalId)).toEqual(["m-01"]);
    const error = await source.get("m-02", { includeTranscript: true }).catch((e) => e);
    expect((error as MeetingSourceError).kind).toBe("not_found");
  });

  it("stores a summary-only meeting and falls back to names when emails are unavailable", async () => {
    const m = conformanceMeeting(1, { transcript: null, privateNotes: "" });
    const { call } = createFakeWisprFlow([m], { sharedIds: [] });
    const wrapped = (async (tool, args) =>
      tool === "get_meeting_participants_enriched"
        ? { isError: true, content: [{ type: "text", text: "unsupported" }] }
        : call(tool, args)) as typeof call;
    const got = await createWisprFlowMeetingSource({ call: wrapped }).get("m-01", {
      includeTranscript: true,
    });
    expect(got.transcript).toBeNull();
    expect(got.summary).toBe("Summary 01");
    expect(got.attendees).toEqual([{ name: "Ada Example" }]);
  });

  it("looks back before the checkpoint because the server filters on start time", async () => {
    const { call, calls } = createFakeWisprFlow([conformanceMeeting(1)]);
    await createWisprFlowMeetingSource({ call }).list({
      updatedAfter: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(Date.parse(String(calls[0]?.args.since))).toBeLessThan(Date.parse("2026-03-01"));
  });
});
