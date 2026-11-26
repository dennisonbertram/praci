import type { AdapterContext } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { personCalendarMeetings } from "./calendar-person.js";

const context = {
  operationId: "op",
  traceId: "op",
  spaceId: "s",
  userId: "u",
  signal: new AbortController().signal,
} as AdapterContext;
const accounts = [
  { id: "a", connectorId: "google", accountRef: "ref-a", label: "Work" },
  { id: "b", connectorId: "google", accountRef: "ref-b", label: "Personal" },
];

describe("personCalendarMeetings", () => {
  const deps = (google: unknown) => ({
    connectors: { managed: () => ({ proxy: async () => ({}) }) as never },
    google: google as never,
  });
  const event = (summary: string, dateTime: string) => ({
    summary,
    start: { dateTime },
    attendees: [{ email: "kevin@acme.example.test" }],
  });
  const urlOf = (mock: { mock: { calls: unknown[][] } }, call: number) =>
    ((mock.mock.calls[call] ?? [])[0] as { url: string }).url;

  it("keeps events that list the address and skips a failing account", async () => {
    const google = {
      request: vi.fn(async ({ account }: { account: { providerRef: string } }) => {
        if (account.providerRef === "ref-b") throw new Error("down");
        return {
          status: 200,
          data: {
            items: [
              {
                summary: "Intro call",
                start: { dateTime: "2026-01-02T10:00:00Z" },
                attendees: [{ email: "Kevin@Acme.example.test" }],
                htmlLink: "https://cal.example.test/1",
              },
              { summary: "Other", start: { dateTime: "2026-01-03T10:00:00Z" }, attendees: [] },
              {
                summary: "Cancelled",
                status: "cancelled",
                start: { dateTime: "2026-01-04T10:00:00Z" },
                attendees: [{ email: "kevin@acme.example.test" }],
              },
            ],
          },
        };
      }),
    };
    const meetings = await personCalendarMeetings(
      {
        connectors: { managed: () => ({ proxy: async () => ({}) }) as never },
        google: google as never,
      },
      accounts,
      context,
      "kevin@acme.example.test",
    );
    expect(meetings).toEqual([
      {
        title: "Intro call",
        start: "2026-01-02T10:00:00.000Z",
        href: "https://cal.example.test/1",
      },
    ]);
    expect(urlOf(google.request, 0)).toContain("q=kevin%40acme.example.test");
  });

  it("follows nextPageToken so a later meeting is not lost", async () => {
    const google = {
      request: vi.fn(async ({ url }: { url: string }) => ({
        status: 200,
        data: url.includes("pageToken=p2")
          ? { items: [event("Future", "2026-03-01T10:00:00Z")] }
          : { items: [event("Past", "2026-01-01T10:00:00Z")], nextPageToken: "p2" },
      })),
    };
    const meetings = await personCalendarMeetings(
      deps(google),
      accounts.slice(0, 1),
      context,
      "kevin@acme.example.test",
    );
    expect(meetings.map((meeting) => meeting.title)).toEqual(["Past", "Future"]);
    expect(google.request).toHaveBeenCalledTimes(2);
    expect(urlOf(google.request, 0)).toContain("maxResults=250");
    expect(urlOf(google.request, 1)).toContain("pageToken=p2");
    expect(urlOf(google.request, 1)).toContain("maxResults=250");
  });

  it("reads at most four pages per account", async () => {
    const google = {
      request: vi.fn(async () => ({
        status: 200,
        data: { items: [event("Daily", "2026-01-01T10:00:00Z")], nextPageToken: "more" },
      })),
    };
    await personCalendarMeetings(deps(google), accounts, context, "kevin@acme.example.test");
    expect(google.request).toHaveBeenCalledTimes(8);
  });
});
