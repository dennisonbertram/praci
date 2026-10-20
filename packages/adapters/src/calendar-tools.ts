import { createHash } from "node:crypto";
import type {
  AdapterContext,
  ConnectorTool,
  ManagedConnectorProvider,
  ToolProgress,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { asRecord } from "./connector-http.js";
import {
  GoogleApiClient,
  GoogleApiError,
  isGoogleAuthFailure,
  withRetryProgress,
} from "./google-api-request.js";

export const CALENDAR_TOOL_NAMES = new Set([
  "calendar_list_events",
  "calendar_get_event",
  "calendar_create_event",
  "calendar_update_event",
  "calendar_delete_event",
]);

export const CALENDAR_APP = "googlecalendar";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const DEFAULT_WINDOW_MS = 7 * 24 * 3_600_000;
const DEFAULT_MAX_RESULTS = 50;
const MAX_RESULTS = 250;
const MAX_DESCRIPTION_CHARS = 1000;

export interface CalendarAccount {
  /** Connection row id. */
  id: string;
  connectorId: string;
  accountRef: string;
  /** The connection name, e.g. "Google Calendar 2". */
  label: string;
}

export type CalendarToolDeps = {
  /** Connected Calendar accounts of the bot owner. Memoized per run by the caller. */
  accounts: () => Promise<CalendarAccount[]>;
  connectors: { managed(id: string): ManagedConnectorProvider | undefined };
  google?: GoogleApiClient;
  /** Called right before each provider write, with nothing awaited between. Text refuses it. */
  beforeWrite?: (account: CalendarAccount) => Promise<string | null>;
  /** Stable per tool call, from the run; calendar_create_event derives the event id from it. */
  idempotencyKey?: string;
  now?: () => Date;
  /** One line of what the tool is doing, for the owner's activity view. */
  progress?: (progress: ToolProgress) => void;
};

const SEND_UPDATES = { type: "string", enum: ["all", "externalOnly", "none"] } as const;
const eventFields = {
  account: {
    type: "string",
    description: "Name of the connected calendar account. Required with more than one account.",
  },
  calendarId: { type: "string", description: 'Default "primary".' },
  summary: { type: "string", description: "Title." },
  start: {
    type: "object",
    description: 'Timed: {dateTime: RFC3339, timeZone?: IANA name}. All-day: {date: "YYYY-MM-DD"}.',
  },
  end: { type: "object", description: "Same shape as start. An all-day end date is exclusive." },
  description: { type: "string" },
  location: { type: "string" },
  attendees: { type: "array", items: { type: "string" }, description: "Email addresses." },
  sendUpdates: {
    ...SEND_UPDATES,
    description: 'Who gets email about the change. Default "none".',
  },
  addMeet: { type: "boolean", description: "Add a Google Meet link." },
};

export const calendarToolDefinitions: ConnectorTool[] = [
  {
    name: "calendar_list_events",
    description:
      "List events in the user's Google Calendar, in start order. Defaults to the next 7 days on the primary calendar.",
    inputSchema: {
      type: "object",
      properties: {
        account: eventFields.account,
        calendarId: eventFields.calendarId,
        timeMin: { type: "string", description: "RFC3339 start of the window. Default now." },
        timeMax: { type: "string", description: "RFC3339 end of the window. Default 7 days out." },
        query: { type: "string", description: "Free-text search." },
        maxResults: { type: "integer", description: "Default 50, at most 250." },
      },
    },
    readOnly: true,
  },
  {
    name: "calendar_get_event",
    description: "Get one event from the user's Google Calendar.",
    inputSchema: {
      type: "object",
      properties: {
        account: eventFields.account,
        calendarId: eventFields.calendarId,
        eventId: { type: "string" },
      },
      required: ["eventId"],
    },
    readOnly: true,
  },
  {
    name: "calendar_create_event",
    description:
      "Create an event in the user's Google Calendar. Needs the user's approval. If the result says the outcome is unclear, do not create it again; tell the user to check their calendar.",
    inputSchema: {
      type: "object",
      properties: {
        account: eventFields.account,
        calendarId: eventFields.calendarId,
        summary: eventFields.summary,
        start: eventFields.start,
        end: eventFields.end,
        description: eventFields.description,
        location: eventFields.location,
        attendees: eventFields.attendees,
        sendUpdates: eventFields.sendUpdates,
        addMeet: eventFields.addMeet,
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "calendar_update_event",
    description:
      "Change an event in the user's Google Calendar. Only the fields you pass change; attendees, if passed, replaces the whole list. Needs the user's approval.",
    inputSchema: {
      type: "object",
      properties: { ...eventFields, eventId: { type: "string" } },
      required: ["eventId"],
    },
  },
  {
    name: "calendar_delete_event",
    description: "Delete an event from the user's Google Calendar. Needs the user's approval.",
    inputSchema: {
      type: "object",
      properties: {
        account: eventFields.account,
        calendarId: eventFields.calendarId,
        eventId: { type: "string" },
        sendUpdates: eventFields.sendUpdates,
      },
      required: ["eventId"],
    },
  },
];

/** Connected native Google Calendar accounts of one user in one space. */
export async function listCalendarAccounts(
  prisma: Pick<PrismaClient, "connection">,
  scope: { spaceId: string; userId: string },
): Promise<CalendarAccount[]> {
  const rows = await prisma.connection.findMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      connectorId: "google",
      provider: CALENDAR_APP,
      status: "connected",
      providerRef: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.flatMap((row) =>
    row.providerRef
      ? [
          {
            id: row.id,
            connectorId: row.connectorId,
            accountRef: row.providerRef,
            label: row.displayName,
          },
        ]
      : [],
  );
}

/** Drop the calendar tools when the run may not use them. */
export function selectCalendarTools(
  tools: ConnectorTool[],
  calendarEnabled: boolean,
): ConnectorTool[] {
  return calendarEnabled ? tools : tools.filter((tool) => !CALENDAR_TOOL_NAMES.has(tool.name));
}

class CalendarToolError extends Error {}

const defaultGoogle = new GoogleApiClient();

export async function calendarToolFromTool(
  name: string,
  deps: CalendarToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    context = withRetryProgress(context, deps.progress, "Google Calendar");
    const account = await resolveAccount(deps, args);
    const calendarId = text(args.calendarId) || "primary";
    const base = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
    const call = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) =>
      request(deps, account, context, method, url, body);

    if (name === "calendar_list_events") {
      const now = (deps.now ?? (() => new Date()))();
      const max = Math.min(
        Math.max(Math.trunc(Number(args.maxResults)) || DEFAULT_MAX_RESULTS, 1),
        MAX_RESULTS,
      );
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: text(args.timeMin) || now.toISOString(),
        timeMax: text(args.timeMax) || new Date(now.getTime() + DEFAULT_WINDOW_MS).toISOString(),
        maxResults: String(max),
      });
      if (text(args.query)) params.set("q", text(args.query));
      const day = (iso: string) =>
        new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
      deps.progress?.({
        text: `Searching calendar: ${text(args.query) ? `"${text(args.query).slice(0, 60)}" · ` : ""}${day(params.get("timeMin") ?? "")} to ${day(params.get("timeMax") ?? "")}`,
      });
      const data = asRecord(await call("GET", `${base}?${params}`));
      const items = Array.isArray(data?.items) ? data.items : [];
      deps.progress?.({
        text:
          items.length === 0
            ? "No events"
            : `Found ${items.length} ${items.length === 1 ? "event" : "events"}`,
        summary: `Searched calendar · ${items.length === 0 ? "none found" : `${items.length} found`}`,
      });
      return { events: items.map(compactEvent) };
    }
    if (name === "calendar_create_event") {
      const body = eventBody(args, true);
      if (!body.summary || !body.start || !body.end)
        throw new CalendarToolError("summary, start and end are required");
      // A replayed call carries the same key, so Google answers 409 instead of creating twice.
      const id = deps.idempotencyKey
        ? `rk${createHash("sha256").update(deps.idempotencyKey).digest("hex").slice(0, 40)}`
        : undefined;
      try {
        const created = await call(
          "POST",
          `${base}?${updates(args, args.addMeet === true)}`,
          id ? { ...body, id } : body,
        );
        return { event: compactEvent(created) };
      } catch (error) {
        if (id && error instanceof GoogleApiError && error.response?.status === 409)
          return { event: { id }, alreadyCreated: true };
        throw error;
      }
    }
    const eventId = text(args.eventId);
    if (!eventId) throw new CalendarToolError("eventId is required");
    const eventUrl = `${base}/${encodeURIComponent(eventId)}`;
    if (name === "calendar_get_event") return { event: compactEvent(await call("GET", eventUrl)) };
    if (name === "calendar_delete_event") {
      try {
        await call("DELETE", `${eventUrl}?${updates(args)}`);
      } catch (error) {
        // 410: already deleted.
        if (!(error instanceof GoogleApiError && error.response?.status === 410)) throw error;
      }
      return { deleted: true };
    }
    if (name === "calendar_update_event") {
      const updated = await call(
        "PATCH",
        `${eventUrl}?${updates(args, args.addMeet === true)}`,
        eventBody(args, false),
      );
      return { event: compactEvent(updated) };
    }
    return { error: `Unknown calendar tool ${name}` };
  } catch (error) {
    return { error: errorText(error) };
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function updates(args: Record<string, unknown>, meet = false): string {
  const sendUpdates = ["all", "externalOnly", "none"].includes(args.sendUpdates as string)
    ? (args.sendUpdates as string)
    : "none";
  const params = new URLSearchParams({ sendUpdates });
  if (meet) params.set("conferenceDataVersion", "1");
  return params.toString();
}

function eventBody(args: Record<string, unknown>, creating: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of ["summary", "description", "location"] as const)
    if (typeof args[key] === "string") body[key] = args[key];
  for (const key of ["start", "end"] as const) {
    const value = asRecord(args[key]);
    if (value) body[key] = value;
  }
  if (Array.isArray(args.attendees))
    body.attendees = args.attendees
      .filter((email): email is string => typeof email === "string" && email.includes("@"))
      .map((email) => ({ email: email.trim() }));
  if (args.addMeet === true)
    body.conferenceData = {
      createRequest: {
        requestId: `rkz-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  if (!creating && Object.keys(body).length === 0)
    throw new CalendarToolError("Pass at least one field to change");
  return body;
}

function compactEvent(raw: unknown): Record<string, unknown> {
  const event = asRecord(raw) ?? {};
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const description = typeof event.description === "string" ? event.description : undefined;
  return {
    id: event.id,
    summary: event.summary,
    start: event.start,
    end: event.end,
    location: event.location,
    attendees: attendees.map((entry) => {
      const attendee = asRecord(entry);
      return { email: attendee?.email, responseStatus: attendee?.responseStatus };
    }),
    organizer: asRecord(event.organizer)?.email,
    htmlLink: event.htmlLink,
    status: event.status,
    ...(description ? { description: description.slice(0, MAX_DESCRIPTION_CHARS) } : {}),
  };
}

async function resolveAccount(
  deps: CalendarToolDeps,
  args: Record<string, unknown>,
): Promise<CalendarAccount> {
  const accounts = await deps.accounts();
  const names = accounts.map((entry) => entry.label).join(", ");
  const wanted = text(args.account).toLowerCase();
  if (wanted) {
    const account = accounts.find((entry) => entry.label.toLowerCase() === wanted);
    if (!account)
      throw new CalendarToolError(
        `No connected calendar account ${wanted.slice(0, 200)}. Available: ${names}`,
      );
    return account;
  }
  if (accounts.length > 1)
    throw new CalendarToolError(
      `Pass account when more than one calendar account is connected. Available: ${names}`,
    );
  if (!accounts[0]) throw new CalendarToolError("No connected calendar account");
  return accounts[0];
}

async function request(
  deps: CalendarToolDeps,
  account: CalendarAccount,
  context: AdapterContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<unknown> {
  const connector = deps.connectors.managed(account.connectorId);
  if (!connector?.proxy) throw new CalendarToolError("This calendar connection cannot be used");
  try {
    if (method !== "GET") {
      const denial = await deps.beforeWrite?.(account);
      if (denial) throw new CalendarToolError(denial);
    }
    const response = await (deps.google ?? defaultGoogle).request({
      connector,
      account: {
        connectorId: account.connectorId,
        providerRef: account.accountRef,
        app: CALENDAR_APP,
      },
      method,
      url,
      ...(body === undefined ? {} : { body }),
      // Retries inside the client ask again before each attempt.
      context: {
        ...context,
        beforeWrite: async () => {
          const denial = await deps.beforeWrite?.(account);
          if (denial) throw new CalendarToolError(denial);
        },
      },
    });
    return response.data;
  } catch (error) {
    // Google may have created the event; a model retry would get a new id and duplicate it.
    const status = error instanceof GoogleApiError ? error.response?.status : undefined;
    if (method === "POST" && status !== undefined && (status === 408 || status >= 500))
      throw new CalendarToolError(UNCLEAR_OUTCOME);
    throw error;
  }
}

const UNCLEAR_OUTCOME =
  "The request may not have reached Google Calendar and the outcome is unclear. Do not retry; tell the user to check their calendar.";

function errorText(error: unknown): string {
  if (error instanceof CalendarToolError) return error.message;
  if (!(error instanceof GoogleApiError)) return "Calendar tool failed";
  const response = error.response;
  if (response) {
    if (isGoogleAuthFailure(response))
      return "Google Calendar access expired or was removed. Ask the user to reconnect Google Calendar.";
    if (response.status === 404) return "Event or calendar not found";
    if (response.status === 429 || response.status === 403)
      return "Google Calendar is limiting requests or denied this one. Try again later.";
    if (response.status === 400) {
      const message = asRecord(asRecord(response.data)?.error)?.message;
      return `Google Calendar rejected the request${typeof message === "string" ? `: ${message.slice(0, 200)}` : ""}`;
    }
    return `Google Calendar returned an error (${response.status})`;
  }
  return error.kind === "aborted" ? "Calendar request aborted" : UNCLEAR_OUTCOME;
}
