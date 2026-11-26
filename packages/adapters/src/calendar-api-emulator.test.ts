import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { calendarAgenda } from "./calendar-agenda.js";
import { CalendarApiEmulator } from "./calendar-api-emulator.js";
import { GoogleApiClient } from "./google-api-request.js";

const context = {
  spaceId: "s1",
  userId: "u1",
  signal: new AbortController().signal,
} as unknown as AdapterContext;
const scope = { spaceId: "s1", userId: "u1" };
const none = { findMany: async () => [] };

describe("calendar emulator behind the agenda", () => {
  it("shows all-day and other selected calendars, hides declined, cancelled and unselected", async () => {
    const calendar = new CalendarApiEmulator(["a"]);
    const timed = (dateTime: string) => ({ dateTime, timeZone: "UTC" });
    calendar.seedCalendar("a", { id: "primary", summary: "Me", selected: true });
    calendar.seedCalendar("a", { id: "team@example.test", summary: "Team", selected: true });
    calendar.seedCalendar("a", { id: "other@example.test", summary: "Other", selected: false });
    calendar.seed("a", {
      id: "sync",
      summary: "Weekly sync",
      start: timed("2026-11-02T10:00:00Z"),
      end: timed("2026-11-02T10:30:00Z"),
    });
    calendar.seed("a", {
      id: "offsite",
      summary: "Offsite",
      start: { date: "2026-11-04" },
      end: { date: "2026-11-05" },
    });
    calendar.seed("a", {
      id: "declined",
      summary: "Declined",
      start: timed("2026-11-03T10:00:00Z"),
      end: timed("2026-11-03T11:00:00Z"),
      attendees: [{ self: true, responseStatus: "declined" }],
    });
    calendar.seed("a", {
      id: "gone",
      summary: "Cancelled",
      status: "cancelled",
      start: timed("2026-11-03T12:00:00Z"),
      end: timed("2026-11-03T13:00:00Z"),
    });
    calendar.seed(
      "a",
      {
        id: "team1",
        summary: "Team lunch",
        start: timed("2026-11-05T12:00:00Z"),
        end: timed("2026-11-05T13:00:00Z"),
      },
      "team@example.test",
    );
    calendar.seed(
      "a",
      {
        id: "hidden",
        summary: "Hidden calendar event",
        start: timed("2026-11-05T14:00:00Z"),
        end: timed("2026-11-05T15:00:00Z"),
      },
      "other@example.test",
    );
    const connector = {
      proxy: async (request: Parameters<CalendarApiEmulator["handle"]>[0]) =>
        calendar.handle(request),
    } as unknown as ManagedConnectorProvider;
    const agenda = await calendarAgenda(
      {
        connectors: { managed: () => connector },
        google: new GoogleApiClient({ sleep: async () => undefined }),
        prisma: { scratchpadItem: none, inboxTodo: none, routine: none } as never,
      },
      scope,
      { from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-08T00:00:00Z") },
      {
        accounts: [{ id: "c1", connectorId: "google", accountRef: "a", label: "Founder" }],
        context,
      },
    );
    expect(agenda.errors).toEqual([]);
    expect(agenda.items.map((item) => item.title)).toEqual([
      "Weekly sync",
      "Offsite",
      "Team lunch",
    ]);
  });
});
