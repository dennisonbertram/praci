import type { AdapterContext } from "@rakazo/adapter-kit";
import type { CalendarAgenda, CalendarItem } from "@rakazo/contracts";
import { isOneShotRoutineCrons, nextRoutineRunDateAcross } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import type { CalendarAccount, CalendarToolDeps } from "./calendar-tools.js";
import { CALENDAR_API, errorText, request } from "./calendar-tools.js";
import { asRecord } from "./connector-http.js";
import { GoogleApiError, isGoogleAuthFailure } from "./google-api-request.js";
import { OPEN_SCRATCHPAD_STATUSES } from "./scratchpad-tools.js";

const MAX_PER_QUERY = 250;
/** How many attendee names an event's item carries; the rest is the count. */
const MAX_ATTENDEE_NAMES = 5;

// dueOn is a date-only column (midnight UTC), so a mid-day start must still include today.
function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
const OPEN_BOT = { archivedAt: null };
/** How long one Google account gets before it is reported as failed. */
export const ACCOUNT_TIMEOUT_MS = 8000;
const CALENDAR_LIST_PAGES = 4;
const EVENT_PAGES = 4;
/** A routine that runs again within this long shows only its first run. */
const SUB_DAILY_MS = 6 * 3_600_000;
const MAX_OCCURRENCES_PER_ROUTINE = 100;
const MAX_ROUTINE_ITEMS = 500;

export type CalendarAgendaDeps = Pick<CalendarToolDeps, "connectors" | "google"> & {
  prisma: Pick<PrismaClient, "scratchpadItem" | "inboxTodo" | "routine">;
};

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * The user's Google events (every account, every selected calendar), open to-dos with a due time,
 * one-shot check-backs and each run of every repeating routine in the window, in start order. The API page
 * and the bot tool both call this. `accounts` is null when Google is off for this caller.
 *
 * A repeating routine shows every run in the range, up to 100 per routine and 500 routine items
 * overall. One that runs again within 6 hours shows only its first run, like page watches (every
 * few minutes) and the managed check-in routine, which are left out because they would bury
 * everything else.
 */
export async function calendarAgenda(
  deps: CalendarAgendaDeps,
  scope: { spaceId: string; userId: string },
  range: { from: Date; to: Date },
  google: { accounts: CalendarAccount[]; context: AdapterContext } | null,
  options: {
    sources?: "all" | "local" | "google";
    accountTimeoutMs?: number;
    /** Include who is attending each event. The apps ask for it; the bot tool does not, so other people's names never reach a provider. */
    attendees?: boolean;
  } = {},
): Promise<CalendarAgenda> {
  const errors: CalendarAgenda["errors"] = [];
  const accounts = google?.accounts ?? [];
  const sources = options.sources ?? "all";
  const timeoutMs = options.accountTimeoutMs ?? ACCOUNT_TIMEOUT_MS;
  const none = <T>() => Promise.resolve([] as T[]);
  const [events, todos, inboxTodos, routines] = await Promise.all([
    Promise.all(
      (sources === "local" ? [] : accounts).map(async (account) => {
        const result = await withTimeout(
          timeoutMs,
          google!.context,
          (context) => accountEvents(deps, account, context, range, options.attendees === true),
          account.label,
        ).catch((error: unknown) => ({
          items: [] as CalendarItem[],
          failed: error instanceof TimeoutError ? error.message : errorText(error),
          ...(error instanceof GoogleApiError &&
          error.response &&
          isGoogleAuthFailure(error.response)
            ? { reconnect: true }
            : {}),
        }));
        if (result.failed)
          errors.push({
            account: account.label,
            message: result.failed,
            ...("reconnect" in result && result.reconnect ? { reconnect: true } : {}),
          });
        return result.items;
      }),
    ),
    sources === "google"
      ? none<never>()
      : deps.prisma.scratchpadItem.findMany({
          where: {
            ...scope,
            status: { in: OPEN_SCRATCHPAD_STATUSES },
            dueAt: { gte: range.from, lt: range.to },
            bot: OPEN_BOT,
          },
          select: {
            id: true,
            title: true,
            dueAt: true,
            botId: true,
            bot: { select: { name: true } },
          },
          orderBy: { dueAt: "asc" },
          take: MAX_PER_QUERY,
        }),
    sources === "google"
      ? none<never>()
      : deps.prisma.inboxTodo.findMany({
          where: {
            ...scope,
            doneAt: null,
            dueOn: { gte: utcMidnight(range.from), lt: range.to },
          },
          select: { id: true, text: true, dueOn: true, messageId: true },
          orderBy: { dueOn: "asc" },
          take: MAX_PER_QUERY,
        }),
    sources === "google"
      ? none<never>()
      : deps.prisma.routine.findMany({
          where: {
            ...scope,
            active: true,
            managedKind: null,
            watch: { equals: Prisma.DbNull },
            nextRunAt: { not: null, lt: range.to },
            bot: OPEN_BOT,
          },
          select: {
            id: true,
            name: true,
            crons: true,
            timezone: true,
            nextRunAt: true,
            botId: true,
            bot: { select: { name: true } },
          },
          orderBy: { nextRunAt: "asc" },
          take: MAX_PER_QUERY,
        }),
  ]);
  const local = (
    item: Pick<CalendarItem, "id" | "kind" | "title" | "allDay" | "botId" | "botName" | "mailId">,
    start: Date,
  ): CalendarItem => ({
    ...item,
    start: start.toISOString(),
    end: null,
    account: null,
    href: null,
  });
  const items: CalendarItem[] = [
    ...events.flat(),
    ...todos.flatMap((row) =>
      row.dueAt
        ? [
            local(
              {
                id: `todo:${row.id}`,
                kind: "todo",
                title: row.title,
                allDay: false,
                botId: row.botId,
                botName: row.bot.name,
              },
              row.dueAt,
            ),
          ]
        : [],
    ),
    ...inboxTodos.flatMap((row) =>
      row.dueOn
        ? [
            local(
              {
                id: `inbox-todo:${row.id}`,
                kind: "todo",
                title: row.text,
                allDay: true,
                botId: null,
                botName: null,
                mailId: row.messageId,
              },
              row.dueOn,
            ),
          ]
        : [],
    ),
    ...routineItems(routines, range, local),
  ].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return { items, errors, googleConnected: accounts.length > 0 };
}

type RoutineRow = {
  id: string;
  name: string;
  crons: string[];
  timezone: string | null;
  nextRunAt: Date | null;
  botId: string;
  bot: { name: string };
};

function routineItems(
  rows: RoutineRow[],
  range: { from: Date; to: Date },
  local: (
    item: Pick<CalendarItem, "id" | "kind" | "title" | "allDay" | "botId" | "botName" | "mailId">,
    start: Date,
  ) => CalendarItem,
): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const row of rows) {
    if (!row.nextRunAt) continue;
    const base = {
      title: row.name,
      allDay: false,
      botId: row.botId,
      botName: row.bot.name,
    };
    if (isOneShotRoutineCrons(row.crons)) {
      if (row.nextRunAt >= range.from)
        items.push(local({ ...base, id: `routine:${row.id}`, kind: "check_back" }, row.nextRunAt));
      continue;
    }
    const tz = row.timezone ?? undefined;
    const next = (after: Date) =>
      nextRoutineRunDateAcross(row.crons, row.nextRunAt as Date, after, tz);
    const second = next(row.nextRunAt);
    if (second && second.getTime() - row.nextRunAt.getTime() < SUB_DAILY_MS) {
      if (row.nextRunAt >= range.from && row.nextRunAt < range.to)
        items.push(
          local(
            { ...base, id: `routine:${row.id}:${row.nextRunAt.toISOString()}`, kind: "routine" },
            row.nextRunAt,
          ),
        );
      continue;
    }
    // Start at the first run in the range, so runs before it do not use up the per-routine cap.
    let at: Date | null =
      row.nextRunAt >= range.from ? row.nextRunAt : next(new Date(range.from.getTime() - 1));
    for (let n = 0; at && at < range.to && n < MAX_OCCURRENCES_PER_ROUTINE; n++) {
      items.push(
        local({ ...base, id: `routine:${row.id}:${at.toISOString()}`, kind: "routine" }, at),
      );
      at = next(at);
    }
  }
  // Cut by time, so a busy agenda loses its end rather than whole routines.
  items.sort((x, y) => x.start.localeCompare(y.start) || x.id.localeCompare(y.id));
  return items.slice(0, MAX_ROUTINE_ITEMS);
}

class TimeoutError extends Error {}

/** Runs `work` with a context whose signal also aborts after `ms`; a work that ignores the signal is still cut off. */
async function withTimeout<T>(
  ms: number,
  context: AdapterContext,
  work: (context: AdapterContext) => Promise<T>,
  label: string,
): Promise<T> {
  const timeout = AbortSignal.timeout(ms);
  const timedOut = new Promise<never>((_, reject) =>
    timeout.addEventListener("abort", () => reject(new TimeoutError(`Couldn't load ${label}`)), {
      once: true,
    }),
  );
  return Promise.race([
    work({ ...context, signal: AbortSignal.any([context.signal, timeout]) }),
    timedOut,
  ]);
}

/** Events of every selected calendar of one account. A failed calendar marks the account as failed but keeps the others. */
async function accountEvents(
  deps: Pick<CalendarToolDeps, "connectors" | "google">,
  account: CalendarAccount,
  context: AdapterContext,
  range: { from: Date; to: Date },
  attendees: boolean,
): Promise<{ items: CalendarItem[]; failed?: string }> {
  const get = (url: string) => request(deps, account, context, "GET", url);
  const calendars: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < CALENDAR_LIST_PAGES; page++) {
    const listed = asRecord(
      await get(
        `${CALENDAR_API}/users/me/calendarList?minAccessRole=reader&maxResults=250${
          pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
        }`,
      ),
    );
    for (const entry of Array.isArray(listed?.items) ? listed.items : []) {
      const record = asRecord(entry);
      if (record && record.selected === true && !record.deleted && str(record.id))
        calendars.push(record);
    }
    pageToken = str(listed?.nextPageToken);
    if (!pageToken) break;
  }
  const items: CalendarItem[] = [];
  let failed: string | undefined;
  await Promise.all(
    calendars.map(async (calendar) => {
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: range.from.toISOString(),
        timeMax: range.to.toISOString(),
        maxResults: String(MAX_PER_QUERY),
      });
      try {
        for (let page = 0; page < EVENT_PAGES; page++) {
          const data = asRecord(
            await get(
              `${CALENDAR_API}/calendars/${encodeURIComponent(str(calendar.id)!)}/events?${params}`,
            ),
          );
          for (const raw of Array.isArray(data?.items) ? data.items : []) {
            const item = eventItem(raw, account, str(calendar.id)!, attendees);
            if (item) items.push(item);
          }
          const token = str(data?.nextPageToken);
          if (!token) break;
          params.set("pageToken", token);
        }
      } catch (error) {
        failed ??= errorText(error);
      }
    }),
  );
  return { items, ...(failed ? { failed } : {}) };
}

function eventItem(
  raw: unknown,
  account: CalendarAccount,
  calendarId: string,
  withAttendees: boolean,
): CalendarItem | null {
  const event = asRecord(raw);
  const id = str(event?.id);
  if (!event || !id || event.status === "cancelled") return null;
  const attendees = Array.isArray(event.attendees) ? event.attendees.map(asRecord) : [];
  if (attendees.some((a) => a?.self === true && a.responseStatus === "declined")) return null;
  const when = (value: unknown) => {
    const point = asRecord(value);
    const dateTime = str(point?.dateTime);
    const date = str(point?.date);
    const iso = dateTime ?? (date ? `${date}T00:00:00.000Z` : undefined);
    const time = iso ? new Date(iso) : undefined;
    return time && !Number.isNaN(time.getTime())
      ? { iso: time.toISOString(), allDay: !dateTime }
      : null;
  };
  const start = when(event.start);
  if (!start) return null;
  const end = when(event.end);
  const videoUri = Array.isArray(asRecord(event.conferenceData)?.entryPoints)
    ? (asRecord(event.conferenceData)!.entryPoints as unknown[])
        .map(asRecord)
        .find((point) => point?.entryPointType === "video" && str(point.uri))
    : undefined;
  const candidateJoinUrl = str(event.hangoutLink) ?? str(videoUri?.uri);
  let joinUrl: string | null = null;
  if (candidateJoinUrl) {
    try {
      if (new URL(candidateJoinUrl).protocol === "https:") joinUrl = candidateJoinUrl;
    } catch {
      // Ignore malformed provider links.
    }
  }
  // The viewer is not a guest and a room is not a person, so neither is named.
  const guests = attendees.filter((a) => a?.self !== true && a?.resource !== true);
  const names = guests
    .map((a) => str(a?.displayName)?.trim() || str(a?.email)?.split("@")[0])
    .filter((name): name is string => Boolean(name));
  return {
    id: `event:${account.id}:${calendarId}:${id}`,
    kind: "event",
    title: str(event.summary)?.trim() || "(No title)",
    start: start.iso,
    end: end?.iso ?? null,
    allDay: start.allDay,
    botId: null,
    botName: null,
    account: account.label,
    href: str(event.htmlLink) ?? null,
    joinUrl,
    ...(withAttendees
      ? { attendees: names.slice(0, MAX_ATTENDEE_NAMES), attendeeCount: guests.length }
      : {}),
  };
}
