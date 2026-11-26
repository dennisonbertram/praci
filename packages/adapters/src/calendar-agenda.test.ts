import { ONCE_ROUTINE_CRON } from "@rakazo/core";
import { describe, expect, it, vi } from "vitest";
import { calendarAgenda } from "./calendar-agenda.js";
import { GoogleApiError } from "./google-api-request.js";

const scope = { spaceId: "space-1", userId: "user-1" };
const range = {
  from: new Date("2026-11-01T00:00:00Z"),
  to: new Date("2026-11-08T00:00:00Z"),
};
const context = {
  operationId: "op",
  traceId: "op",
  ...scope,
  signal: new AbortController().signal,
};
const accountA = {
  id: "a",
  connectorId: "google",
  accountRef: "ref-a",
  label: "Work",
};
const accountB = {
  id: "b",
  connectorId: "google",
  accountRef: "ref-b",
  label: "Personal",
};

function setup(google: (url: string, ref: string) => unknown, extraRoutines: unknown[] = []) {
  const prisma = {
    scratchpadItem: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "s1",
          title: "Send deck",
          dueAt: new Date("2026-11-03T10:00:00Z"),
          botId: "bot-1",
          bot: { name: "Chief" },
        },
      ]),
    },
    inboxTodo: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "i1",
          text: "Sign form",
          dueOn: new Date("2026-11-02T00:00:00Z"),
          messageId: "m1",
        },
      ]),
    },
    routine: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "r1",
          name: "Look at pricing",
          crons: [ONCE_ROUTINE_CRON],
          nextRunAt: new Date("2026-11-04T09:00:00Z"),
          botId: "bot-1",
          bot: { name: "Chief" },
        },
        {
          id: "r2",
          name: "Weekly digest",
          crons: ["0 9 * * 1"],
          nextRunAt: new Date("2026-11-02T09:00:00Z"),
          botId: "bot-2",
          bot: { name: "Scout" },
        },
        ...extraRoutines,
      ]),
    },
  };
  const request = vi.fn(
    async ({ account, url }: { account: { providerRef: string }; url: string }) => ({
      status: 200,
      data: google(url, account.providerRef),
    }),
  );
  const connectors = { managed: () => ({ proxy: vi.fn() }) } as never;
  return {
    prisma,
    deps: { prisma: prisma as never, connectors, google: { request } as never },
    request,
  };
}

const calendars = {
  items: [
    { id: "primary", selected: true },
    { id: "hidden", selected: false },
  ],
};

describe("calendarAgenda", () => {
  it("marks an account that requires Google reauthorization", async () => {
    const { deps, request } = setup(() => ({}));
    request.mockRejectedValue(new GoogleApiError("response", { status: 401, data: {} }));
    const result = await calendarAgenda(
      deps,
      scope,
      range,
      { accounts: [accountA], context },
      { sources: "google" },
    );
    expect(result.errors).toEqual([
      {
        account: "Work",
        message:
          "Google Calendar access expired or was removed. Ask the user to reconnect Google Calendar.",
        reconnect: true,
      },
    ]);
  });

  it("maps only secure video conference links from Google events", async () => {
    const { deps } = setup((url) =>
      url.includes("calendarList")
        ? calendars
        : {
            items: [
              {
                id: "hangout",
                start: { dateTime: "2026-11-02T08:00:00Z" },
                hangoutLink: "https://meet.google.com/abc",
              },
              {
                id: "conference",
                start: { dateTime: "2026-11-02T09:00:00Z" },
                conferenceData: {
                  entryPoints: [
                    { entryPointType: "phone", uri: "tel:+15555555555" },
                    { entryPointType: "video", uri: "https://meet.example/room" },
                    { entryPointType: "video", uri: "https://meet.example/second" },
                  ],
                },
              },
              {
                id: "insecure",
                start: { dateTime: "2026-11-02T10:00:00Z" },
                hangoutLink: "http://meet.example/room",
              },
            ],
          },
    );
    const result = await calendarAgenda(
      deps,
      scope,
      range,
      { accounts: [accountA], context },
      { sources: "google" },
    );
    expect(result.items.map((item) => item.joinUrl ?? null)).toEqual([
      "https://meet.google.com/abc",
      "https://meet.example/room",
      null,
    ]);
  });

  it("merges events, to-dos, check-backs and routines in start order", async () => {
    const { deps } = setup((url) =>
      url.includes("calendarList")
        ? calendars
        : {
            items: [
              {
                id: "e1",
                summary: "Standup",
                start: { dateTime: "2026-11-02T08:00:00-05:00" },
                end: { dateTime: "2026-11-02T08:15:00-05:00" },
                htmlLink: "https://calendar.google.com/e1",
              },
              {
                id: "e2",
                summary: "Holiday",
                start: { date: "2026-11-05" },
                end: { date: "2026-11-06" },
              },
              { id: "e3", status: "cancelled", start: { date: "2026-11-05" } },
              {
                id: "e4",
                summary: "Declined",
                start: { date: "2026-11-05" },
                attendees: [{ self: true, responseStatus: "declined" }],
              },
            ],
          },
    );
    const result = await calendarAgenda(deps, scope, range, {
      accounts: [accountA],
      context,
    });
    expect(result.errors).toEqual([]);
    expect(result.googleConnected).toBe(true);
    expect(result.items.map((i) => [i.kind, i.title, i.allDay])).toEqual([
      ["todo", "Sign form", true],
      ["routine", "Weekly digest", false],
      ["event", "Standup", false],
      ["todo", "Send deck", false],
      ["check_back", "Look at pricing", false],
      ["event", "Holiday", true],
    ]);
    const standup = result.items.find((i) => i.title === "Standup");
    expect(standup).toMatchObject({
      start: "2026-11-02T13:00:00.000Z",
      href: "https://calendar.google.com/e1",
      account: "Work",
      botId: null,
    });
    expect(result.items.find((i) => i.title === "Sign form")?.mailId).toBe("m1");
    expect(result.items.find((i) => i.title === "Send deck")).toMatchObject({
      botId: "bot-1",
      botName: "Chief",
    });
  });

  const guestsEvent = () =>
    setup((url) =>
      url.includes("calendarList")
        ? calendars
        : {
            items: [
              {
                id: "e1",
                summary: "Review",
                start: { dateTime: "2026-11-02T08:00:00Z" },
                attendees: [
                  { displayName: "Ana", email: "ana@example.test" },
                  { email: "ben@example.test" },
                  { displayName: "Cy", email: "cy@example.test" },
                  { displayName: "Dan", email: "dan@example.test" },
                  { displayName: "Eli", email: "eli@example.test" },
                  { displayName: "Fay", email: "fay@example.test" },
                  { self: true, displayName: "Me", email: "me@example.test" },
                  { resource: true, displayName: "Room 4", email: "room@example.test" },
                ],
              },
            ],
          },
    );

  it("names up to five attendees when the apps' agenda asks for them", async () => {
    const { deps } = guestsEvent();
    const result = await calendarAgenda(
      deps,
      scope,
      range,
      { accounts: [accountA], context },
      {
        sources: "google",
        attendees: true,
      },
    );
    expect(result.items[0]).toMatchObject({
      attendees: ["Ana", "ben", "Cy", "Dan", "Eli"],
      attendeeCount: 6,
    });
  });

  it("keeps attendees out of the bot tool's agenda", async () => {
    const { deps } = guestsEvent();
    // executor.ts calls calendarAgenda without the attendees option, so the
    // calendar_agenda tool never carries other people's names to a provider.
    const result = await calendarAgenda(deps, scope, range, { accounts: [accountA], context });
    expect(result.items[0]).not.toHaveProperty("attendees");
    expect(result.items[0]).not.toHaveProperty("attendeeCount");
  });

  it("reads only selected calendars", async () => {
    const { deps, request } = setup((url) =>
      url.includes("calendarList") ? calendars : { items: [] },
    );
    await calendarAgenda(deps, scope, range, { accounts: [accountA], context });
    const urls = request.mock.calls.map(([call]) => call.url);
    expect(urls.some((u) => u.includes("/calendars/primary/events"))).toBe(true);
    expect(urls.some((u) => u.includes("hidden"))).toBe(false);
  });

  it("keeps the other account's events when one account fails", async () => {
    const { deps } = setup((url, ref) => {
      if (ref === "ref-a") throw new Error("boom");
      return url.includes("calendarList")
        ? calendars
        : {
            items: [
              {
                id: "p1",
                summary: "Dentist",
                start: { dateTime: "2026-11-06T15:00:00Z" },
              },
            ],
          };
    });
    const result = await calendarAgenda(deps, scope, range, {
      accounts: [accountA, accountB],
      context,
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.account).toBe("Work");
    expect(result.items.some((i) => i.title === "Dentist")).toBe(true);
    expect(result.items.some((i) => i.title === "Send deck")).toBe(true);
  });

  it("still returns bot items with no Google account", async () => {
    const { deps } = setup(() => ({}));
    const result = await calendarAgenda(deps, scope, range, null);
    expect(result.googleConnected).toBe(false);
    expect(result.items.map((i) => i.kind)).not.toContain("event");
    expect(result.items).toHaveLength(4);
  });

  it("scopes every query to the space and user, in range, skipping watches", async () => {
    const { deps, prisma } = setup(() => ({}));
    await calendarAgenda(deps, scope, range, null);
    expect(prisma.scratchpadItem.findMany.mock.calls[0]?.[0].where).toMatchObject({
      ...scope,
      status: { in: ["open", "parked"] },
      dueAt: { gte: range.from, lt: range.to },
    });
    expect(prisma.inboxTodo.findMany.mock.calls[0]?.[0].where).toMatchObject({
      ...scope,
      doneAt: null,
    });
    expect(prisma.routine.findMany.mock.calls[0]?.[0].where).toMatchObject({
      ...scope,
      active: true,
      managedKind: null,
      nextRunAt: { not: null, lt: range.to },
    });
    expect(prisma.routine.findMany.mock.calls[0]?.[0].where.watch).toBeDefined();
  });

  it("keeps to-dos due today when the range starts mid-day", async () => {
    const { deps, prisma } = setup(() => ({}));
    const midDay = { from: new Date("2026-11-01T15:00:00Z"), to: range.to };
    await calendarAgenda(deps, scope, midDay, null);
    expect(prisma.inboxTodo.findMany.mock.calls[0]?.[0].where.dueOn).toEqual({
      gte: new Date("2026-11-01T00:00:00Z"),
      lt: midDay.to,
    });
  });

  it("returns the local items without waiting for a hanging Google account, then reports it", async () => {
    const { deps, request } = setup(() => ({}));
    request.mockImplementation(() => new Promise(() => {}));
    const google = { accounts: [accountA], context };
    const local = await calendarAgenda(deps, scope, range, google, {
      sources: "local",
    });
    expect(request).not.toHaveBeenCalled();
    expect(local.items).toHaveLength(4);
    expect(local.googleConnected).toBe(true);
    const remote = await calendarAgenda(deps, scope, range, google, {
      sources: "google",
      accountTimeoutMs: 20,
    });
    expect(remote.items).toEqual([]);
    expect(remote.errors).toEqual([{ account: "Work", message: "Couldn't load Work" }]);
  });

  it("follows calendarList pages", async () => {
    const { deps, request } = setup((url) =>
      url.includes("calendarList")
        ? url.includes("pageToken=p2")
          ? { items: [{ id: "second", selected: true }] }
          : { items: [{ id: "primary", selected: true }], nextPageToken: "p2" }
        : { items: [] },
    );
    await calendarAgenda(deps, scope, range, { accounts: [accountA], context });
    const urls = request.mock.calls.map(([call]) => call.url);
    expect(urls.some((u) => u.includes("/calendars/second/events"))).toBe(true);
  });

  const routineRow = (over: Record<string, unknown>) => ({
    id: "r9",
    name: "Briefing",
    crons: ["0 8 * * 1-5"],
    timezone: "America/New_York",
    nextRunAt: new Date("2026-11-02T13:00:00Z"),
    botId: "bot-1",
    bot: { name: "Chief" },
    ...over,
  });
  const run = async (row: unknown) => {
    const { deps, prisma } = setup(() => ({}), [row]);
    prisma.routine.findMany.mockResolvedValue([row]);
    const result = await calendarAgenda(deps, scope, range, null);
    return result.items.filter((i) => i.id.startsWith("routine:"));
  };

  it("lists every weekday run of a repeating routine with distinct ids", async () => {
    const items = await run(routineRow({}));
    expect(items).toHaveLength(5);
    expect(new Set(items.map((i) => i.id)).size).toBe(5);
    expect(items[0]).toMatchObject({
      id: "routine:r9:2026-11-02T13:00:00.000Z",
      kind: "routine",
    });
  });

  it("keeps a routine whose stored next run is before the range", async () => {
    const items = await run(routineRow({ nextRunAt: new Date("2026-10-30T12:00:00Z") }));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.start >= range.from.toISOString())).toBe(true);
  });

  it("shows a sub-daily routine once", async () => {
    expect(await run(routineRow({ crons: ["0 * * * *"] }))).toHaveLength(1);
  });

  it("leaves a check-back as one item with a plain id", async () => {
    const items = await run(routineRow({ crons: [ONCE_ROUTINE_CRON] }));
    expect(items.map((i) => [i.id, i.kind])).toEqual([["routine:r9", "check_back"]]);
  });

  const runRows = async (rows: unknown[], within: { from: Date; to: Date }) => {
    const { deps, prisma } = setup(() => ({}), rows);
    prisma.routine.findMany.mockResolvedValue(rows);
    const result = await calendarAgenda(deps, scope, within, null);
    return result.items.filter((i) => i.id.startsWith("routine:"));
  };

  it("still lists a routine's runs in a range months after its next run", async () => {
    const items = await runRows([routineRow({})], {
      from: new Date("2027-04-05T00:00:00Z"),
      to: new Date("2027-04-12T00:00:00Z"),
    });
    expect(items).toHaveLength(5);
    expect(items[0]?.id).toBe("routine:r9:2027-04-05T12:00:00.000Z");
  });

  it("does not show a sub-daily routine in a range after its first run", async () => {
    const items = await runRows(
      [routineRow({ crons: ["0 * * * *"], nextRunAt: new Date("2026-10-30T12:00:00Z") })],
      range,
    );
    expect(items).toHaveLength(0);
  });

  it("cuts routine items by time, not by whole routines", async () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      routineRow({
        id: `r${i + 1}`,
        crons: ["0 9 * * *"],
        timezone: "UTC",
        nextRunAt: new Date("2026-11-01T09:00:00Z"),
      }),
    );
    const items = await runRows(rows, {
      from: new Date("2026-11-01T00:00:00Z"),
      to: new Date("2027-02-02T00:00:00Z"),
    });
    expect(items).toHaveLength(500);
    const firstDay = items.filter((i) => i.start.startsWith("2026-11-01"));
    expect(new Set(firstDay.map((i) => i.id.split(":")[1])).size).toBe(7);
  });

  it("follows event pages", async () => {
    const { deps, request } = setup((url) =>
      url.includes("calendarList")
        ? calendars
        : url.includes("pageToken=e2")
          ? {
              items: [
                {
                  id: "late",
                  summary: "Late",
                  start: { dateTime: "2026-11-06T15:00:00Z" },
                },
              ],
            }
          : { items: [], nextPageToken: "e2" },
    );
    const result = await calendarAgenda(deps, scope, range, {
      accounts: [accountA],
      context,
    });
    expect(result.items.some((i) => i.title === "Late")).toBe(true);
    expect(request.mock.calls.length).toBeGreaterThan(2);
  });
});
