import type {
  HexMeeting,
  HexMeetingShow,
  HexResult,
  LocalMeetingsStatus,
  RakazoDesktopHex,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { syncHex, toSourceMeeting } from "./sync";

const NOW = Date.parse("2026-11-01T12:00:00.000Z");
const DAY = 86_400_000;

const meeting = (id: string, extra: Partial<HexMeeting> = {}): HexMeeting => ({
  id,
  title: `Call ${id}`,
  timestamp_ms: NOW - 3_600_000,
  duration_ms: 600_000,
  application: "Zoom",
  status: "complete",
  in_progress: false,
  transcript_source: "final",
  ...extra,
});
const show = (m: HexMeeting, extra: Partial<HexMeetingShow> = {}): HexMeetingShow => ({
  version: 1,
  meeting: m,
  notes: null,
  entries: [
    { source: "system", start_ms: 5_000, end_ms: 9_000, text: "Sounds good." },
    { source: "microphone", start_ms: 0, end_ms: 4_000, text: "I'll send the deck." },
  ],
  ...extra,
});

describe("toSourceMeeting", () => {
  it("maps a finished call: times, You/Them lines in order, folder, Hex's summary", () => {
    const m = meeting("1-1");
    const mapped = toSourceMeeting(
      show(m, {
        notes: { title: "Pricing review", summary: "Agreed on a quote.", generated_at_ms: NOW },
      }),
    );
    expect(mapped).toMatchObject({
      externalId: "1-1",
      title: "Pricing review",
      startedAt: new Date(m.timestamp_ms).toISOString(),
      endedAt: new Date(m.timestamp_ms + 600_000).toISOString(),
      attendees: [],
      organizerEmail: null,
      sourceUrl: null,
      folders: ["Zoom"],
      summary: "Agreed on a quote.",
      privateNotes: "",
      updatedAt: new Date(NOW).toISOString(),
      transcript: [
        { speaker: "You", text: "I'll send the deck." },
        { speaker: "Them", text: "Sounds good." },
      ],
    });
  });

  it("falls back to the Hex title, no summary, no folder, and the call's end as the update time", () => {
    const m = meeting("1-2", { application: null });
    const mapped = toSourceMeeting(show(m));
    expect(mapped).toMatchObject({
      title: "Call 1-2",
      summary: "",
      folders: [],
      updatedAt: new Date(m.timestamp_ms + 600_000).toISOString(),
    });
  });

  it("imports finished calls and interrupted calls with a rolling transcript only", () => {
    const kept = [
      meeting("1-3"),
      meeting("1-4", { status: "interrupted", transcript_source: "rolling" }),
    ];
    const skipped = [
      meeting("1-5", { status: "starting" }),
      meeting("1-6", { status: "recording", in_progress: true }),
      meeting("1-7", { status: "transcribing" }),
      meeting("1-8", { status: "failed" }),
      meeting("1-9", { transcript_source: "missing" }),
      meeting("1-10", { status: "interrupted", transcript_source: "final" }),
      meeting("1-11", { in_progress: true }),
    ];
    expect(kept.map((m) => toSourceMeeting(show(m)) !== null)).toEqual([true, true]);
    expect(skipped.map((m) => toSourceMeeting(show(m)))).toEqual(skipped.map(() => null));
  });
});

type Fixture = {
  status: LocalMeetingsStatus;
  list?: HexResult<{ version: 1; meetings: HexMeeting[]; truncated: boolean }>;
  shows?: Record<string, HexResult<HexMeetingShow>>;
};
function setup({ status, list, shows = {} }: Fixture) {
  const hex: RakazoDesktopHex = {
    available: vi.fn(async () => true),
    list: vi.fn(
      async (): Promise<NonNullable<Fixture["list"]>> =>
        list ?? { state: "ok", value: { version: 1, meetings: [], truncated: false } },
    ),
    show: vi.fn(async (id: string) => shows[id] ?? { state: "failed" as const }),
  };
  const importLocal = vi.fn(async (input: { meetings: unknown[] }) => ({
    created: input.meetings.length,
    updated: 0,
    skipped: 0,
  }));
  const deps = { hex, status: async () => status, importLocal, now: () => NOW };
  return { hex, importLocal, deps };
}
const connected = (syncedThrough: string | null): LocalMeetingsStatus => ({
  connectionId: "conn_1",
  status: "connected",
  syncedThrough,
  lastSyncedAt: null,
  count: 0,
});

describe("syncHex", () => {
  it("does nothing until the user connected Hex", async () => {
    for (const status of [
      null,
      { ...connected(null), status: "disconnected" as const },
    ] as LocalMeetingsStatus[]) {
      const { hex, importLocal, deps } = setup({ status });
      expect(await syncHex(deps)).toBe("off");
      expect(hex.list).not.toHaveBeenCalled();
      expect(importLocal).not.toHaveBeenCalled();
    }
  });

  it("reads back 90 days the first time and from just before the last sync after that", async () => {
    const first = setup({ status: connected(null) });
    await syncHex(first.deps);
    expect(first.hex.list).toHaveBeenCalledWith(NOW - 90 * DAY);
    const later = setup({ status: connected(new Date(NOW - 2 * DAY).toISOString()) });
    await syncHex(later.deps);
    expect(later.hex.list).toHaveBeenCalledWith(NOW - 2 * DAY - 5 * 60_000);
  });

  it("shows each call, skips the ones that are not finished, and pushes ten at a time", async () => {
    const calls = Array.from({ length: 12 }, (_, i) => meeting(`2-${i}`));
    const unfinished = meeting("2-x", { status: "recording", in_progress: true });
    const { hex, importLocal, deps } = setup({
      status: connected(null),
      list: {
        state: "ok",
        value: { version: 1, meetings: [...calls, unfinished], truncated: false },
      },
      shows: Object.fromEntries(calls.map((m) => [m.id, { state: "ok" as const, value: show(m) }])),
    });
    expect(await syncHex(deps)).toBe("ok");
    expect(hex.show).toHaveBeenCalledTimes(12);
    expect(hex.show).not.toHaveBeenCalledWith("2-x");
    expect(importLocal.mock.calls.map(([input]) => input.meetings.length)).toEqual([10, 2]);
    expect(importLocal.mock.calls[0]?.[0]).toMatchObject({ connectionId: "conn_1" });
  });

  it("still tells the server it synced when Hex has nothing new", async () => {
    const { importLocal, deps } = setup({ status: connected(null) });
    expect(await syncHex(deps)).toBe("ok");
    expect(importLocal).toHaveBeenCalledWith({ connectionId: "conn_1", meetings: [] });
  });

  it("reports Hex states without pushing anything", async () => {
    for (const state of ["not_found", "update", "failed"] as const) {
      const { importLocal, deps } = setup({ status: connected(null), list: { state } });
      expect(await syncHex(deps)).toBe(state);
      expect(importLocal).not.toHaveBeenCalled();
    }
    const m = meeting("3-1");
    const stale = setup({
      status: connected(null),
      list: { state: "ok", value: { version: 1, meetings: [m], truncated: false } },
      shows: { "3-1": { state: "update" } },
    });
    expect(await syncHex(stale.deps)).toBe("update");
  });

  it("pushes the calls it could read when one call fails, and reports failed", async () => {
    const good = meeting("4-1");
    const bad = meeting("4-2");
    const { importLocal, deps } = setup({
      status: connected(null),
      list: { state: "ok", value: { version: 1, meetings: [good, bad], truncated: false } },
      shows: { "4-1": { state: "ok", value: show(good) } },
    });
    expect(await syncHex(deps)).toBe("failed");
    expect(importLocal.mock.calls[0]?.[0].meetings).toHaveLength(1);
  });

  it("reports failed when the upload fails, so the next pass retries", async () => {
    const m = meeting("5-1");
    const { deps } = setup({
      status: connected(null),
      list: { state: "ok", value: { version: 1, meetings: [m], truncated: false } },
      shows: { "5-1": { state: "ok", value: show(m) } },
    });
    expect(
      await syncHex({ ...deps, importLocal: async () => Promise.reject(new Error("offline")) }),
    ).toBe("failed");
  });

  it("does not push calls that started after one still being transcribed", async () => {
    const early = meeting("6-1", { timestamp_ms: NOW - 5 * 3_600_000 });
    const pending = meeting("6-2", { timestamp_ms: NOW - 4 * 3_600_000, status: "transcribing" });
    const later = meeting("6-3", { timestamp_ms: NOW - 3 * 3_600_000 });
    const { importLocal, deps } = setup({
      status: connected(null),
      list: {
        state: "ok",
        value: { version: 1, meetings: [early, pending, later], truncated: false },
      },
      shows: Object.fromEntries(
        [early, later].map((m) => [m.id, { state: "ok" as const, value: show(m) }]),
      ),
    });
    await syncHex(deps);
    expect(
      importLocal.mock.calls[0]?.[0].meetings.map((m) => (m as { externalId: string }).externalId),
    ).toEqual(["6-1"]);
  });

  it("does not push calls that started after one it could not read", async () => {
    const bad = meeting("7-1", { timestamp_ms: NOW - 4 * 3_600_000 });
    const good = meeting("7-2", { timestamp_ms: NOW - 3 * 3_600_000 });
    const { importLocal, deps } = setup({
      status: connected(null),
      list: { state: "ok", value: { version: 1, meetings: [bad, good], truncated: false } },
      shows: { "7-2": { state: "ok", value: show(good) } },
    });
    expect(await syncHex(deps)).toBe("failed");
    expect(importLocal.mock.calls[0]?.[0].meetings).toEqual([]);
  });

  it("stops holding for a call that has been stuck for more than a day", async () => {
    const stuck = meeting("8-1", { timestamp_ms: NOW - 3 * DAY, status: "transcribing" });
    const good = meeting("8-2");
    const { importLocal, deps } = setup({
      status: connected(null),
      list: { state: "ok", value: { version: 1, meetings: [stuck, good], truncated: false } },
      shows: { "8-2": { state: "ok", value: show(good) } },
    });
    await syncHex(deps);
    expect(importLocal.mock.calls[0]?.[0].meetings).toHaveLength(1);
  });
});
