import type { ConnectorProxyRequest, ConnectorProxyResponse } from "@rakazo/adapter-kit";

const PREFIX = "/calendar/v3/calendars/";
const CALENDAR_LIST = "/calendar/v3/users/me/calendarList";

type Event = Record<string, unknown> & { id: string };
type CalendarEntry = { id: string; summary: string; selected?: boolean; accessRole?: string };

function reply(status: number, data: unknown = {}): ConnectorProxyResponse {
  return { status, data };
}

function fail(status: number, reason: string, message: string): ConnectorProxyResponse {
  return reply(status, { error: { code: status, message, errors: [{ reason, message }] } });
}

/** Offline stand-in for the Calendar v3 events API, one event store per account ref. */
export class CalendarApiEmulator {
  readonly requests: Array<{ accountRef: string; method: string; url: string; body?: unknown }> =
    [];
  /** Events by `accountRef`, then calendar id. */
  private readonly events = new Map<string, Map<string, Map<string, Event>>>();
  private readonly calendars = new Map<string, CalendarEntry[]>();
  private readonly deleted = new Set<string>();
  private nextId = 1;

  constructor(private readonly accountRefs: string[]) {}

  seed(accountRef: string, event: Event, calendarId = "primary"): void {
    this.store(accountRef, calendarId).set(event.id, event);
  }

  /** Adds a calendar to the account's calendar list. Without any, the list is one selected "primary". */
  seedCalendar(accountRef: string, calendar: CalendarEntry): void {
    this.calendars.set(accountRef, [...(this.calendars.get(accountRef) ?? []), calendar]);
  }

  all(accountRef: string, calendarId = "primary"): Event[] {
    return [...this.store(accountRef, calendarId).values()];
  }

  handle(request: Pick<ConnectorProxyRequest, "accountRef" | "method" | "url" | "body">) {
    const { accountRef, method, url, body } = request;
    this.requests.push({ accountRef, method, url, body });
    if (!this.accountRefs.includes(accountRef))
      return fail(401, "authError", "Invalid credentials");
    const parsed = new URL(url);
    if (parsed.origin === "https://www.googleapis.com" && parsed.pathname === CALENDAR_LIST) {
      if (method !== "GET") return fail(405, "invalid", "Method not allowed");
      const entries = this.calendars.get(accountRef) ?? [
        { id: "primary", summary: accountRef, selected: true },
      ];
      return reply(200, {
        items: entries.map((entry) => ({ accessRole: "owner", selected: false, ...entry })),
      });
    }
    if (parsed.origin !== "https://www.googleapis.com" || !parsed.pathname.startsWith(PREFIX))
      return fail(404, "notFound", "Not found");
    const match = /^([^/]+)\/events(?:\/([^/]+))?$/.exec(parsed.pathname.slice(PREFIX.length));
    if (!match) return fail(404, "notFound", "Not found");
    const id = match[2] ? decodeURIComponent(match[2]) : undefined;
    const store = this.store(accountRef, decodeURIComponent(match[1]!));
    const input = (body ?? {}) as Record<string, unknown>;
    if (!id) {
      if (method === "GET") return this.list(store, parsed.searchParams);
      if (method !== "POST") return fail(405, "invalid", "Method not allowed");
      const eventId =
        typeof input.id === "string" ? input.id : `evt${String(this.nextId++).padStart(4, "0")}`;
      // Google accepts client ids of 5-1024 base32hex characters (a-v, 0-9).
      if (!/^[a-v0-9]{5,1024}$/.test(eventId))
        return fail(400, "invalid", "Invalid resource id value.");
      if (store.has(eventId) || this.deleted.has(`${accountRef}:${eventId}`))
        return fail(409, "duplicate", "The requested identifier already exists.");
      const event: Event = {
        ...input,
        id: eventId,
        status: "confirmed",
        htmlLink: `https://calendar.example.test/event/${eventId}`,
        organizer: { email: "owner@example.test" },
      };
      store.set(eventId, event);
      return reply(200, event);
    }
    const event = store.get(id);
    if (method === "DELETE") {
      if (!event)
        return this.deleted.has(`${accountRef}:${id}`)
          ? fail(410, "deleted", "Resource has been deleted")
          : fail(404, "notFound", "Not Found");
      store.delete(id);
      this.deleted.add(`${accountRef}:${id}`);
      return reply(204, "");
    }
    if (!event) return fail(404, "notFound", "Not Found");
    if (method === "PATCH") Object.assign(event, input, { id });
    return reply(200, event);
  }

  private list(store: Map<string, Event>, params: URLSearchParams) {
    const q = params.get("q")?.toLowerCase();
    const min = params.get("timeMin") ?? "";
    const max = params.get("timeMax") ?? "";
    const max_results = Number(params.get("maxResults") ?? 250);
    // All-day events carry `start.date` (YYYY-MM-DD); compare it as midnight UTC.
    const start = (event: Event) => {
      const point = event.start as Record<string, unknown> | undefined;
      return String(point?.dateTime ?? (point?.date ? `${point.date}T00:00:00Z` : ""));
    };
    const items = [...store.values()]
      .filter((event) => start(event) >= min && start(event) < max)
      .filter(
        (event) =>
          !q ||
          String(event.summary ?? "")
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => start(a).localeCompare(start(b)))
      .slice(0, max_results);
    return reply(200, { items });
  }

  private store(accountRef: string, calendarId: string): Map<string, Event> {
    const calendars = this.events.get(accountRef) ?? new Map<string, Map<string, Event>>();
    this.events.set(accountRef, calendars);
    const existing = calendars.get(calendarId);
    if (existing) return existing;
    const created = new Map<string, Event>();
    calendars.set(calendarId, created);
    return created;
  }
}
