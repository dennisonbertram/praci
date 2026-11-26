import type { AdapterContext, JobPublisher } from "@rakazo/adapter-kit";
import { pipelineAutoStatusJob } from "@rakazo/adapter-kit";
import type { PipelineStatus } from "@rakazo/contracts";
import { PipelineStatusSchema } from "@rakazo/contracts";
import { zonedDateTime } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { applyPipelineAutoChange, FUNDRAISING_PIPELINE, undoneAutoChanges } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { CalendarAccount, CalendarToolDeps } from "./calendar-tools.js";
import { CALENDAR_API, listCalendarAccounts, request } from "./calendar-tools.js";
import { asRecord } from "./connector-http.js";
import { isMailConnection } from "./gmail-mail-provider.js";

type Scope = { spaceId: string; userId: string };

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

// ponytail: only the 90-day mail cache is seen; searching Gmail live per prospect is the upgrade path.
const MAIL_WINDOW_MS = 90 * 86_400_000;
const CALENDAR_BACK_MS = 30 * 86_400_000;
const CALENDAR_FORWARD_MS = 90 * 86_400_000;
const EVENT_PAGES = 4;
/** Mail and past meetings older than this still set Last contact but never move a status: many prospects are old relationships. */
const STATUS_EVIDENCE_MS = 30 * 86_400_000;
const SWEEP_BATCH = 500;
const JOB_TIMEOUT_MS = 5 * 60_000;

/** The record fields the decision reads; exactly what the guarded write is checked against. */
export interface AutoStatusRecord {
  status: string;
  nextCallAt: Date | null;
  nextCallHasTime: boolean;
  lastContactAt: Date | null;
}

/** What mail and calendar showed for one record; each part optional. */
export interface AutoStatusEvidence {
  /** The latest message the user sent to one of the record's people. */
  sent: { at: Date; id: string; subject: string } | null;
  /** The latest message received from one of the record's people. */
  receivedAt: Date | null;
  /** The latest past event that lists one of the record's people. */
  pastEvent: { at: Date; id: string; title: string } | null;
  /** The earliest event that has not ended, including one that is currently in progress. */
  statusEvent: { at: Date; hasTime: boolean; id: string; title: string } | null;
  /** The earliest future event that lists one of the record's people. */
  futureEvent: { at: Date; hasTime: boolean; id: string; title: string } | null;
}

/** Values a change set before the user undid it; the job never sets them again. */
export interface AutoStatusUndone {
  statuses: ReadonlySet<string>;
  /** The undone `set.nextCallAt` instants, as ISO strings. */
  nextCalls: ReadonlySet<string>;
}

export interface AutoStatusPlan {
  status: PipelineStatus | null;
  nextCall: { at: Date; hasTime: boolean } | null;
  /** A newer last contact than the record's, or null. Written without an event. */
  lastContactAt: Date | null;
  /** What the change came from; set whenever status or nextCall is. */
  evidence: {
    actor: "auto:mail" | "auto:calendar";
    summary: string;
    at: Date;
    id: string;
  } | null;
}

const STATUS_ORDER = PipelineStatusSchema.options;
const rankOf = (status: string): number => STATUS_ORDER.indexOf(status as PipelineStatus);
const clip = (text: string): string => text.slice(0, 200);

/**
 * The change the evidence calls for. A status only moves forward and never past diligence: a past
 * meeting means Met, else a future one Meeting booked, else a sent email Reached out. A future
 * meeting also fills an empty, past or date-only next call, never a timed future one. A value the
 * user undid is never set again.
 */
export function decideAutoUpdate(
  now: Date,
  record: AutoStatusRecord,
  evidence: AutoStatusEvidence,
  undone: AutoStatusUndone,
): AutoStatusPlan {
  const plan: AutoStatusPlan = {
    status: null,
    nextCall: null,
    lastContactAt: null,
    evidence: null,
  };
  const current = rankOf(record.status);
  const movable = current >= 0 && current < rankOf("diligence");
  const recent = (at: Date) => now.getTime() - at.getTime() <= STATUS_EVIDENCE_MS;
  if (movable) {
    if (evidence.pastEvent && recent(evidence.pastEvent.at) && rankOf("met") > current) {
      plan.status = "met";
      plan.evidence = {
        actor: "auto:calendar",
        summary: clip(evidence.pastEvent.title),
        at: evidence.pastEvent.at,
        id: evidence.pastEvent.id,
      };
    } else if (
      (evidence.statusEvent ?? evidence.futureEvent) &&
      rankOf("meeting_booked") > current
    ) {
      plan.status = "meeting_booked";
      const event = evidence.statusEvent ?? evidence.futureEvent;
      if (!event) throw new Error("Calendar status event disappeared during planning.");
      plan.evidence = {
        actor: "auto:calendar",
        summary: clip(event.title),
        at: event.at,
        id: event.id,
      };
    } else if (evidence.sent && recent(evidence.sent.at) && rankOf("reached_out") > current) {
      plan.status = "reached_out";
      plan.evidence = {
        actor: "auto:mail",
        summary: clip(evidence.sent.subject),
        at: evidence.sent.at,
        id: evidence.sent.id,
      };
    }
    if (plan.status && undone.statuses.has(plan.status)) {
      plan.status = null;
      plan.evidence = null;
    }
  }
  if (evidence.futureEvent) {
    const replaceable =
      !record.nextCallAt || record.nextCallAt.getTime() <= now.getTime() || !record.nextCallHasTime;
    // Already holding this event's time: nothing to write (an all-day one would otherwise repeat every run).
    const held =
      record.nextCallAt?.getTime() === evidence.futureEvent.at.getTime() &&
      record.nextCallHasTime === evidence.futureEvent.hasTime;
    if (replaceable && !held && !undone.nextCalls.has(evidence.futureEvent.at.toISOString())) {
      plan.nextCall = { at: evidence.futureEvent.at, hasTime: evidence.futureEvent.hasTime };
      plan.evidence ??= {
        actor: "auto:calendar",
        summary: clip(evidence.futureEvent.title),
        at: evidence.futureEvent.at,
        id: evidence.futureEvent.id,
      };
    }
  }
  const contact = [evidence.sent?.at, evidence.receivedAt, evidence.pastEvent?.at]
    .filter((at): at is Date => at instanceof Date)
    .reduce((latest, at) => (at > latest ? at : latest), new Date(0));
  if (contact.getTime() > 0 && (!record.lastContactAt || contact > record.lastContactAt)) {
    plan.lastContactAt = contact;
  }
  return plan;
}

/** One live Calendar event reduced to what matching needs: id, title, start and guest emails. */
export interface AutoCalendarEvent {
  id: string;
  title: string;
  /** The event's actual start instant; all-day starts use the event's local time zone. */
  startsAt: Date;
  /** The calendar date/time retained for storage in pipeline next-call fields. */
  at: Date;
  hasTime: boolean;
  /** When the event turns past: `at` for a timed event, the end of its day for an all-day one. */
  endsAt: Date;
  emails: Set<string>;
}

/** Separates an active meeting used for status from a strictly future call date. */
export function selectCalendarEvidenceEvents(
  events: readonly AutoCalendarEvent[],
  emails: ReadonlySet<string>,
  now: Date,
): {
  pastEvent: AutoCalendarEvent | null;
  statusEvent: AutoCalendarEvent | null;
  futureEvent: AutoCalendarEvent | null;
} {
  const matches = (event: AutoCalendarEvent) =>
    [...event.emails].some((email) => emails.has(email));
  const ended = (event: AutoCalendarEvent) => event.endsAt.getTime() <= now.getTime();
  const latest = (candidates: readonly AutoCalendarEvent[]) =>
    candidates.reduce<AutoCalendarEvent | null>(
      (chosen, event) => (!chosen || event.at > chosen.at ? event : chosen),
      null,
    );
  const earliest = (candidates: readonly AutoCalendarEvent[]) =>
    candidates.reduce<AutoCalendarEvent | null>(
      (chosen, event) => (!chosen || event.at < chosen.at ? event : chosen),
      null,
    );
  const related = events.filter(matches);
  return {
    pastEvent: latest(related.filter(ended)),
    statusEvent: earliest(related.filter((event) => !ended(event))),
    futureEvent: earliest(
      related.filter((event) => !ended(event) && event.startsAt.getTime() > now.getTime()),
    ),
  };
}

/** The YYYY-MM-DD after `date`, which the caller already parsed as a real calendar date. */
const dayAfter = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * A usable event or null: cancelled events, events with no usable start and events the user
 * declined are out. `emails` holds every attendee and organizer address that is not the user's own.
 */
export function usableAutoEvent(raw: unknown, own: ReadonlySet<string>): AutoCalendarEvent | null {
  const event = asRecord(raw);
  if (!event || event.status === "cancelled") return null;
  const id = str(event.id);
  if (!id) return null;
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const declined = attendees.some((attendee) => {
    const entry = asRecord(attendee);
    if (entry?.responseStatus !== "declined") return false;
    const email = str(entry.email)?.toLowerCase();
    return entry.self === true || (email !== undefined && own.has(email));
  });
  if (declined) return null;
  const start = asRecord(event.start);
  const dateTime = str(start?.dateTime);
  const date = str(start?.date);
  const at = dateTime ? new Date(dateTime) : date ? new Date(`${date}T00:00:00Z`) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const end = asRecord(event.end);
  const startTimeZone = str(start?.timeZone) ?? str(end?.timeZone);
  const startsAt = date ? (zonedDateTime(date, startTimeZone) ?? at) : at;
  // An all-day event ends at its exclusive end.date — tomorrow when the API sent none — at
  // midnight in the time zone the event carries; a missing or unusable zone stays UTC.
  let endsAt = at;
  if (!dateTime && date) {
    const endDate = str(end?.date);
    const timeZone = str(end?.timeZone) ?? str(start?.timeZone);
    endsAt =
      (endDate && endDate > date ? zonedDateTime(endDate, timeZone) : null) ??
      zonedDateTime(dayAfter(date), timeZone) ??
      new Date(at.getTime() + 86_400_000);
  }
  const emails = new Set<string>();
  for (const person of [...attendees, event.organizer]) {
    // A guest who declined was not met.
    if (asRecord(person)?.responseStatus === "declined") continue;
    const email = str(asRecord(person)?.email)?.toLowerCase();
    if (email && !own.has(email)) emails.add(email);
  }
  return {
    id,
    title: str(event.summary)?.trim() || "(No title)",
    startsAt,
    at,
    hasTime: dateTime !== undefined,
    endsAt,
    emails,
  };
}

export interface PipelineAutoStatusDeps {
  prisma: PrismaClient;
  /** Managed-connector registry the Calendar calls go through; without it the run is mail-only. */
  connectors?: CalendarToolDeps["connectors"];
  google?: CalendarToolDeps["google"];
  signal?: AbortSignal;
  now?: () => Date;
}

/**
 * One user's pass: reads the open records' mail and calendar evidence and applies the decided
 * changes record by record, each guarded on the values read so a record the user touched meanwhile
 * is left alone. Never fails on one bad record or calendar account.
 */
export async function runPipelineAutoStatus(
  deps: PipelineAutoStatusDeps,
  payload: Scope,
): Promise<{ records: number; changed: number }> {
  const scope = { spaceId: payload.spaceId, userId: payload.userId };
  const { prisma } = deps;
  const now = deps.now?.() ?? new Date();

  const rows = await prisma.pipelineRecord.findMany({
    where: {
      ...scope,
      pipeline: FUNDRAISING_PIPELINE,
      status: { notIn: ["committed", "passed", "diligence"] },
    },
    select: {
      id: true,
      status: true,
      nextCallAt: true,
      nextCallHasTime: true,
      lastContactAt: true,
      people: { select: { contact: { select: { email: true } } } },
    },
  });
  const records = rows
    .map((row) => ({
      id: row.id,
      status: row.status,
      nextCallAt: row.nextCallAt,
      nextCallHasTime: row.nextCallHasTime,
      lastContactAt: row.lastContactAt,
      emails: [
        ...new Set(
          row.people
            .map((person) => person.contact.email?.toLowerCase())
            .filter((email): email is string => Boolean(email)),
        ),
      ],
    }))
    .filter((record) => record.emails.length > 0);
  if (records.length === 0) return { records: 0, changed: 0 };
  const allEmails = [...new Set(records.flatMap((record) => record.emails))];

  const since = new Date(now.getTime() - MAIL_WINDOW_MS);
  const [sentRows, receivedRows, connections, autoEvents] = await Promise.all([
    // The latest sent message naming each address, in to or cc.
    prisma.$queryRaw<{ email: string; id: string; subject: string | null; receivedAt: Date }[]>`
      SELECT DISTINCT ON (lower(a)) lower(a) AS "email", m."id", m."subject", m."receivedAt"
      FROM "mail_messages" m, unnest(m."toAddresses" || m."ccAddresses") AS a
      WHERE m."spaceId" = ${scope.spaceId} AND m."userId" = ${scope.userId}
        AND m."fromSelf" AND NOT m."isSpam" AND m."receivedAt" >= ${since}
        AND lower(a) = ANY(${allEmails}::text[])
      ORDER BY lower(a), m."receivedAt" DESC`,
    // The latest message received from each address.
    prisma.$queryRaw<{ email: string; at: Date }[]>`
      SELECT lower(m."fromAddress") AS "email", MAX(m."receivedAt") AS "at"
      FROM "mail_messages" m
      WHERE m."spaceId" = ${scope.spaceId} AND m."userId" = ${scope.userId}
        AND NOT m."fromSelf" AND NOT m."isSpam" AND m."receivedAt" >= ${since}
        AND lower(m."fromAddress") = ANY(${allEmails}::text[])
      GROUP BY lower(m."fromAddress")`,
    // The user's connected accounts, for their own addresses.
    prisma.connection.findMany({
      where: { ...scope, status: "connected", providerRef: { not: null } },
      select: { status: true, provider: true, providerRef: true, metadata: true },
    }),
    // Only the changes the user undid matter below; read those, not the whole auto history.
    prisma.$queryRaw<{ recordId: string; payload: unknown }[]>`
      SELECT "recordId", "payload"
      FROM "pipeline_events"
      WHERE "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId} AND "kind" = 'auto'
        AND "payload" ->> 'undoneAt' IS NOT NULL`,
  ]);

  const own = new Set<string>();
  for (const row of connections) {
    if (isMailConnection(row)) {
      const address = str(asRecord(row.metadata)?.mailAddress);
      if (address) own.add(address.toLowerCase());
    }
    // A connected account's id is an address when it looks like one (Gmail and Calendar use it so).
    if (row.providerRef?.includes("@")) own.add(row.providerRef.toLowerCase());
  }

  // Every connected Google Calendar account's primary calendar, [now - 30d, now + 90d]. An
  // account that errors is skipped; none at all leaves the run mail-only.
  let events: AutoCalendarEvent[] = [];
  if (deps.connectors) {
    const accounts = await listCalendarAccounts(prisma, scope);
    if (accounts.length > 0) {
      const operationId = `pipeline.auto_status:${scope.userId}`;
      const context: AdapterContext = {
        operationId,
        traceId: operationId,
        spaceId: scope.spaceId,
        userId: scope.userId,
        signal: deps.signal ?? AbortSignal.timeout(JOB_TIMEOUT_MS),
      };
      const window = {
        since: new Date(now.getTime() - CALENDAR_BACK_MS),
        until: new Date(now.getTime() + CALENDAR_FORWARD_MS),
      };
      const calendarDeps = { connectors: deps.connectors, google: deps.google };
      const lists = await Promise.all(
        accounts.map(async (account) => {
          try {
            return await accountEvents(calendarDeps, account, context, window);
          } catch (error) {
            getLogger().warn("pipeline auto-status calendar account skipped", {
              account: account.label,
              error,
            });
            return [] as unknown[];
          }
        }),
      );
      events = lists
        .flat()
        .map((raw) => usableAutoEvent(raw, own))
        .filter((event): event is AutoCalendarEvent => event !== null);
    }
  }

  const sent = new Map(
    sentRows.map((row) => [
      row.email,
      { at: row.receivedAt, id: row.id, subject: row.subject ?? "" },
    ]),
  );
  const received = new Map(receivedRows.map((row) => [row.email, row.at]));
  const undone = undoneAutoChanges(autoEvents);
  const nothingUndone: AutoStatusUndone = { statuses: new Set(), nextCalls: new Set() };

  let changed = 0;
  for (const record of records) {
    const calendarEvidence = selectCalendarEvidenceEvents(events, new Set(record.emails), now);
    const sentMail = record.emails
      .map((email) => sent.get(email))
      .filter((mail): mail is { at: Date; id: string; subject: string } => Boolean(mail))
      .reduce<{ at: Date; id: string; subject: string } | null>(
        (latest, mail) => (!latest || mail.at > latest.at ? mail : latest),
        null,
      );
    const receivedAt = record.emails
      .map((email) => received.get(email))
      .filter((at): at is Date => Boolean(at))
      .reduce<Date | null>((latest, at) => (!latest || at > latest ? at : latest), null);
    const plan = decideAutoUpdate(
      now,
      record,
      { sent: sentMail, receivedAt, ...calendarEvidence },
      undone.get(record.id) ?? nothingUndone,
    );
    if (!plan.status && !plan.nextCall && !plan.lastContactAt) continue;
    try {
      const { applied } = await applyPipelineAutoChange(prisma, scope, {
        recordId: record.id,
        before: {
          status: record.status,
          nextCallAt: record.nextCallAt,
          nextCallHasTime: record.nextCallHasTime,
        },
        ...(plan.status ? { status: plan.status } : {}),
        ...(plan.nextCall ? { nextCall: plan.nextCall } : {}),
        ...(plan.lastContactAt ? { lastContactAt: plan.lastContactAt } : {}),
        ...(plan.evidence ? { evidence: plan.evidence } : {}),
      });
      if (applied) changed += 1;
    } catch (error) {
      getLogger().warn("pipeline auto-status record skipped", { recordId: record.id, error });
    }
  }
  return { records: records.length, changed };
}

/** The events of one account's primary calendar inside the window; all pages, up to EVENT_PAGES. */
async function accountEvents(
  deps: Pick<CalendarToolDeps, "connectors" | "google">,
  account: CalendarAccount,
  context: AdapterContext,
  window: { since: Date; until: Date },
): Promise<unknown[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: window.since.toISOString(),
    timeMax: window.until.toISOString(),
    maxResults: "250",
  });
  const items: unknown[] = [];
  for (let page = 0; page < EVENT_PAGES; page++) {
    const data = asRecord(
      await request(
        deps,
        account,
        context,
        "GET",
        `${CALENDAR_API}/calendars/primary/events?${params}`,
      ),
    );
    if (Array.isArray(data?.items)) items.push(...data.items);
    const token = str(data?.nextPageToken);
    if (!token) break;
    params.set("pageToken", token);
  }
  return items;
}

/**
 * Recurring job: queues `pipeline.auto_status` once per user that has an open record, one bounded
 * query across owners. The job's replaceKey makes a repeat harmless. Returns how many were queued.
 */
export async function sweepPipelineAutoStatus(deps: {
  prisma: PrismaClient;
  jobs: Pick<JobPublisher, "enqueue">;
}): Promise<number> {
  const users = await deps.prisma.$queryRaw<{ spaceId: string; userId: string }[]>`
    SELECT DISTINCT "spaceId", "userId" FROM "pipeline_records"
    WHERE "pipeline" = ${FUNDRAISING_PIPELINE} AND "status" NOT IN ('committed', 'passed')
    LIMIT ${SWEEP_BATCH}`;
  for (const scope of users) {
    await deps.jobs.enqueue(pipelineAutoStatusJob(scope));
  }
  return users.length;
}
