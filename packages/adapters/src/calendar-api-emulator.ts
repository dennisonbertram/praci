import type { ConnectorProxyRequest, ConnectorProxyResponse } from "@rakazo/adapter-kit";

const PREFIX = "/calendar/v3/calendars/";

type Event = Record<string, unknown> & { id: string };

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
  private readonly events = new Map<string, Map<string, Event>>();
  private readonly deleted = new Set<string>();
  private nextId = 1;

  constructor(private readonly accountRefs: string[]) {}

  seed(accountRef: string, event: Event): void {
    this.store(accountRef).set(event.id, event);
  }

  all(accountRef: string): Event[] {
    return [...this.store(accountRef).values()];
  }

  handle(request: Pick<ConnectorProxyRequest, "accountRef" | "method" | "url" | "body">) {
    const { accountRef, method, url, body } = request;
    this.requests.push({ accountRef, method, url, body });
    if (!this.accountRefs.includes(accountRef))
      return fail(401, "authError", "Invalid credentials");
    const parsed = new URL(url);
    if (parsed.origin !== "https://www.googleapis.com" || !parsed.pathname.startsWith(PREFIX))
      return fail(404, "notFound", "Not found");
    const match = /^([^/]+)\/events(?:\/([^/]+))?$/.exec(parsed.pathname.slice(PREFIX.length));
    if (!match) return fail(404, "notFound", "Not found");
    const id = match[2] ? decodeURIComponent(match[2]) : undefined;
    const store = this.store(accountRef);
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
    const start = (event: Event) =>
      String((event.start as Record<string, unknown> | undefined)?.dateTime ?? "");
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

  private store(accountRef: string): Map<string, Event> {
    const existing = this.events.get(accountRef);
    if (existing) return existing;
    const created = new Map<string, Event>();
    this.events.set(accountRef, created);
    return created;
  }
}
