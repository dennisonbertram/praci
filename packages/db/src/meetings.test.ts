import type { SourceMeeting } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { findRecordedElsewhere, upsertMeeting } from "./meetings.js";

const NUL = "\u0000";
const scope = { spaceId: "space-1", userId: "user-1" };

const meeting: SourceMeeting = {
  externalId: "ext-1",
  title: `Plan${NUL}ning`,
  startedAt: "2026-01-01T10:00:00.000Z",
  endedAt: "2026-01-01T11:00:00.000Z",
  attendees: [{ name: `Ada${NUL} L`, email: `ADA${NUL}@Example.com` }],
  organizerEmail: `org${NUL}@example.com`,
  sourceUrl: `https://example.com/${NUL}m`,
  folders: [`Fold${NUL}er`],
  summary: `Sum${NUL}mary`,
  privateNotes: `No${NUL}tes`,
  transcript: [{ speaker: `Sp${NUL}eaker`, text: `He${NUL}llo` }],
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function hasNul(value: unknown): boolean {
  if (typeof value === "string") return value.includes(NUL);
  if (Array.isArray(value)) return value.some(hasNul);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.values(value).some(hasNul);
  }
  return false;
}

function fakeClient(existing: { id: string } | null) {
  const written: { create?: unknown; update?: unknown } = {};
  const reject = (data: unknown) => {
    if (hasNul(data)) throw Object.assign(new Error("invalid byte sequence"), { code: "22021" });
  };
  const tx = {
    $executeRaw: async () => 1,
    meetingTombstone: { findUnique: async () => null },
    meeting: {
      findUnique: async () => existing,
      create: async ({ data }: { data: unknown }) => {
        reject(data);
        written.create = data;
      },
      updateMany: async ({ data }: { data: unknown }) => {
        reject(data);
        written.update = data;
        return { count: 1 };
      },
    },
  };
  const client = { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
  return { client: client as unknown as PrismaClient, written };
}

describe("upsertMeeting NUL characters", () => {
  it("creates a meeting whose text contains NUL", async () => {
    const { client, written } = fakeClient(null);
    await expect(
      upsertMeeting(client, scope, { connectionId: "c1" }, "hex", meeting),
    ).resolves.toBe("created");
    const data = written.create as Record<string, unknown>;
    expect(hasNul(data)).toBe(false);
    expect(data).toMatchObject({
      title: "Planning",
      summary: "Summary",
      privateNotes: "Notes",
      organizerEmail: "org@example.com",
      sourceUrl: "https://example.com/m",
      folders: ["Folder"],
      attendees: [{ name: "Ada L", email: "ada@example.com" }],
      transcript: "Speaker: Hello",
    });
  });

  it("updates a meeting whose text contains NUL", async () => {
    const { client, written } = fakeClient({ id: "m1" });
    await expect(
      upsertMeeting(client, scope, { connectionId: "c1" }, "hex", meeting),
    ).resolves.toBe("updated");
    const data = written.update as Record<string, unknown>;
    expect(hasNul(data)).toBe(false);
    expect(data).toMatchObject({ title: "Planning", transcript: "Speaker: Hello" });
  });
});

describe("findRecordedElsewhere", () => {
  const at = (hhmm: string) => new Date(`2026-01-01T${hhmm}:00.000Z`);
  const stored = (...spans: [string, string][]) =>
    ({
      $executeRaw: async () => 0,
      meeting: {
        // Mirrors the query's overlap filter so the fake returns what Postgres would.
        findMany: async ({
          where,
        }: {
          where: { startedAt: { lt: Date }; endedAt: { gt: Date } };
        }) =>
          spans
            .map(([s, e]) => ({ startedAt: at(s), endedAt: at(e) }))
            .filter((m) => m.startedAt < where.startedAt.lt && m.endedAt > where.endedAt.gt),
      },
    }) as never;
  const check = (tx: never, start: string, end: string) =>
    findRecordedElsewhere(tx, scope, { startedAt: at(start), endedAt: at(end) }, ["omi_cloud"]);

  it("does not skip a long meeting because of one short fragment inside it", async () => {
    expect(await check(stored(["10:20", "10:25"]), "10:00", "11:00")).toBe(false);
  });

  it("skips when several stored fragments together cover half of the new meeting", async () => {
    const fragments: [string, string][] = [];
    for (let m = 0; m < 60; m += 5) {
      const f = (n: number) => `10:${String(n).padStart(2, "0")}`;
      fragments.push([f(m), m + 5 === 60 ? "11:00" : f(m + 5)]);
    }
    expect(await check(stored(...fragments), "10:00", "11:00")).toBe(true);
  });

  it("does not count overlapping stored copies twice", async () => {
    expect(await check(stored(["10:00", "10:20"], ["10:05", "10:25"]), "10:00", "11:00")).toBe(
      false,
    );
  });

  it("skips an exact re-import and a copy of the same length", async () => {
    expect(await check(stored(["10:00", "11:00"]), "10:00", "11:00")).toBe(true);
    expect(await check(stored(["10:03", "11:05"]), "10:00", "11:00")).toBe(true);
  });

  it("skips a short new meeting inside a stored long one", async () => {
    expect(await check(stored(["10:00", "11:00"]), "10:20", "10:25")).toBe(true);
  });
});
