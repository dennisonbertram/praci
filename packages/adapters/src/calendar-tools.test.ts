import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { toolRequiresApproval } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { builtinAgentTools } from "./builtin-tools.js";
import { CalendarApiEmulator } from "./calendar-api-emulator.js";
import {
  CALENDAR_TOOL_NAMES,
  type CalendarAccount,
  calendarToolFromTool,
  listCalendarAccounts,
} from "./calendar-tools.js";
import { READ_ONLY_AGENT_TOOLS, selectBuiltinToolsForRun } from "./executor.js";
import { GoogleApiClient } from "./google-api-request.js";

const context = {
  spaceId: "s1",
  userId: "u1",
  signal: new AbortController().signal,
} as unknown as AdapterContext;

const accounts: CalendarAccount[] = [
  { id: "c1", connectorId: "google", accountRef: "a", label: "alice@example.test" },
];

function setup(list = accounts, idempotencyKey?: string) {
  const calendar = new CalendarApiEmulator(["a", "b"]);
  const connector = {
    proxy: async (request: Parameters<CalendarApiEmulator["handle"]>[0]) =>
      calendar.handle(request),
  } as unknown as ManagedConnectorProvider;
  const run = (name: string, args: Record<string, unknown> = {}) =>
    calendarToolFromTool(
      name,
      {
        accounts: async () => list,
        connectors: { managed: () => connector },
        google: new GoogleApiClient({ sleep: async () => undefined }),
        now: () => new Date("2026-10-01T12:00:00Z"),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
      context,
      args,
    );
  return { calendar, run };
}

const timed = (dateTime: string) => ({ dateTime, timeZone: "UTC" });

describe("calendar tools", () => {
  it("lists, gets, creates, updates and deletes events", async () => {
    const { calendar, run } = setup();
    calendar.seed("a", {
      id: "e1",
      summary: "Standup",
      start: timed("2026-10-02T09:00:00Z"),
      end: timed("2026-10-02T09:15:00Z"),
      description: "x".repeat(5000),
    });
    calendar.seed("a", {
      id: "far",
      summary: "Later",
      start: timed("2026-12-02T09:00:00Z"),
      end: timed("2026-12-02T09:15:00Z"),
    });
    const listed = (await run("calendar_list_events")) as {
      events: Array<{ id: string; description: string }>;
    };
    expect(listed.events.map((e) => e.id)).toEqual(["e1"]);
    expect(listed.events[0]?.description).toHaveLength(1000);
    expect(await run("calendar_get_event", { eventId: "e1" })).toMatchObject({
      event: { id: "e1", summary: "Standup" },
    });

    const created = (await run("calendar_create_event", {
      summary: "Lunch",
      start: timed("2026-10-03T12:00:00Z"),
      end: timed("2026-10-03T13:00:00Z"),
      attendees: ["bob@example.test"],
      sendUpdates: "all",
      addMeet: true,
    })) as { event: { id: string } };
    const call = calendar.requests.at(-1);
    expect(call?.url).toContain("sendUpdates=all");
    expect(call?.url).toContain("conferenceDataVersion=1");
    expect(calendar.all("a").find((e) => e.id === created.event.id)?.attendees).toEqual([
      { email: "bob@example.test" },
    ]);

    await run("calendar_update_event", { eventId: created.event.id, summary: "Brunch" });
    expect(calendar.requests.at(-1)?.url).toContain("sendUpdates=none");
    expect(calendar.all("a").find((e) => e.id === created.event.id)).toMatchObject({
      summary: "Brunch",
      attendees: [{ email: "bob@example.test" }],
    });
    expect(await run("calendar_delete_event", { eventId: created.event.id })).toEqual({
      deleted: true,
    });
    // A repeated delete is still a success.
    expect(await run("calendar_delete_event", { eventId: created.event.id })).toEqual({
      deleted: true,
    });
  });

  it("does not duplicate a replayed create", async () => {
    const { calendar, run } = setup(accounts, "effect-1");
    const args = {
      summary: "Once",
      start: timed("2026-10-03T12:00:00Z"),
      end: timed("2026-10-03T13:00:00Z"),
    };
    await run("calendar_create_event", args);
    const again = await run("calendar_create_event", args);
    expect(again).toMatchObject({ alreadyCreated: true });
    expect(calendar.all("a")).toHaveLength(1);
  });

  it.each([408, 500, 503])(
    "says a create answered %i may have been applied and must not be retried",
    async (status) => {
      let posts = 0;
      const connector = {
        proxy: async () => {
          posts++;
          return { status, data: {} };
        },
      } as unknown as ManagedConnectorProvider;
      const result = (await calendarToolFromTool(
        "calendar_create_event",
        {
          accounts: async () => accounts,
          connectors: { managed: () => connector },
          google: new GoogleApiClient({ sleep: async () => undefined }),
          now: () => new Date("2026-10-01T12:00:00Z"),
        },
        context,
        { summary: "x", start: timed("2026-10-03T12:00:00Z"), end: timed("2026-10-03T13:00:00Z") },
      )) as { error: string };
      expect(posts).toBe(1);
      expect(result.error).toMatch(/Do not retry/);
    },
  );

  it("rejects a client event id outside base32hex", async () => {
    const { calendar } = setup();
    expect(
      calendar.handle({
        accountRef: "a",
        method: "POST",
        url: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        body: { id: "rkz1" },
      }).status,
    ).toBe(400);
  });

  it("resolves the account by connection name and requires it when there are several", async () => {
    const two = [
      ...accounts,
      { id: "c2", connectorId: "google", accountRef: "b", label: "Bob@example.test" },
    ];
    const { calendar, run } = setup(two);
    expect(await run("calendar_list_events")).toEqual({
      error:
        "Pass account when more than one calendar account is connected. Available: alice@example.test, Bob@example.test",
    });
    await run("calendar_list_events", { account: "bob@EXAMPLE.test" });
    expect(calendar.requests.at(-1)?.accountRef).toBe("b");
    expect(await run("calendar_list_events", { account: "x@y.z" })).toEqual({
      error: "No connected calendar account x@y.z. Available: alice@example.test, Bob@example.test",
    });
  });

  it("returns a reconnect error on 401 and plain errors otherwise", async () => {
    const { run } = setup([
      { id: "c", connectorId: "google", accountRef: "gone", label: "g@example.test" },
    ]);
    const result = (await run("calendar_list_events")) as { error: string };
    expect(result.error).toContain("reconnect");
    expect(await run("calendar_get_event", { eventId: "nope" })).toHaveProperty("error");
    expect(await run("calendar_get_event", {})).toEqual({ error: "eventId is required" });
  });

  it("finds only the connected googlecalendar rows of this user", async () => {
    const seen: unknown[] = [];
    const prisma = {
      connection: {
        findMany: async (args: unknown) => {
          seen.push(args);
          return [
            { id: "c1", connectorId: "google", providerRef: "a", displayName: "a@example.test" },
          ];
        },
      },
    };
    expect(
      await listCalendarAccounts(prisma as never, { spaceId: "s1", userId: "u1" }),
    ).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      where: {
        spaceId: "s1",
        userId: "u1",
        connectorId: "google",
        provider: "googlecalendar",
        status: "connected",
      },
    });
  });

  it("offers the tools only when enabled, with writes gated by approval", () => {
    const names = (calendarEnabled: boolean) =>
      selectBuiltinToolsForRun({
        graphicalToolsAllowed: false,
        pageBrowserAllowed: false,
        groupId: null,
        trigger: "message",
        semanticMemoryEnabled: false,
        messagingChannelRun: false,
        calendarEnabled,
      }).map((tool) => tool.name);
    expect(names(false).filter((n) => CALENDAR_TOOL_NAMES.has(n))).toEqual([]);
    expect(
      names(true)
        .filter((n) => CALENDAR_TOOL_NAMES.has(n))
        .sort(),
    ).toEqual([...CALENDAR_TOOL_NAMES].sort());
    expect(builtinAgentTools.filter((t) => CALENDAR_TOOL_NAMES.has(t.name))).toHaveLength(5);
    for (const name of [
      "calendar_create_event",
      "calendar_update_event",
      "calendar_delete_event",
    ]) {
      expect(toolRequiresApproval(name, false)).toBe(true);
      expect(READ_ONLY_AGENT_TOOLS.has(name)).toBe(false);
    }
    for (const name of ["calendar_list_events", "calendar_get_event"]) {
      expect(toolRequiresApproval(name, false)).toBe(false);
      expect(READ_ONLY_AGENT_TOOLS.has(name)).toBe(true);
    }
  });
});
