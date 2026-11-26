import type {
  Contact,
  ContactStage,
  PipelineAutoChange,
  PipelineCallOutcome,
  PipelineDetail,
  PipelineInterest,
  PipelineStatus,
} from "@rakazo/contracts";
import { PipelineStatusSchema } from "@rakazo/contracts";
import { isoFromDay, todayDay } from "./day-input";

/** One row of the Fundraising pipeline: a record, named by its primary person or by the record. */
export type PipelineRow = {
  /** The contact's id, or the record's id for a record with no person yet: what the RPCs take. */
  id: string;
  contact: Contact;
  name: string;
  people: { id: string; name: string }[];
  status: PipelineStatus;
  interest: PipelineInterest | null;
  referredBy: { id: string; name: string } | null;
  amountCents: number | null;
  details: PipelineDetail[];
  lastCall: { outcome: PipelineCallOutcome; at: string; note: string | null } | null;
  /** Latest mail or meeting contact the auto-status job found; nothing when it found none. */
  lastContactAt: string | null;
  /** The newest automatic change that is not undone; the row sheet offers to undo it. */
  lastAuto: PipelineAutoChange | null;
  nextStep: string | null;
  nextCallAt: string | null;
  nextCallHasTime: boolean;
  group: string | null;
  /** Send SAFE opened Mercury and no SAFE has attached yet. */
  waitingSince: string | null;
};

/** A prospect with no record yet reads as the first status of its stage. */
const STATUS_OF_STAGE: Record<ContactStage, PipelineStatus> = {
  target: "not_reached",
  intro: "intro_requested",
  meeting: "meeting_booked",
  diligence: "diligence",
  committed: "committed",
  passed: "passed",
};

export const toPipelineRow = (contact: Contact): PipelineRow => {
  const record = contact.pipelineRecord;
  return {
    id: contact.id,
    contact,
    name: record?.name ?? contact.name,
    people: record?.people ?? [],
    status: record?.status ?? STATUS_OF_STAGE[contact.stage ?? "target"],
    interest: record?.interest ?? null,
    referredBy: record?.referredBy ?? null,
    amountCents: contact.checkSizeCents ?? null,
    details: record?.details ?? [],
    lastCall: record?.lastCall ?? null,
    lastContactAt: record?.lastContactAt ?? null,
    lastAuto: record?.lastAuto ?? null,
    nextStep: contact.nextStep ?? null,
    nextCallAt: record?.nextCallAt ?? null,
    nextCallHasTime: record?.nextCallHasTime ?? false,
    group: record?.group ?? null,
    waitingSince: contact.mercurySentAt ?? null,
  };
};

export const STATUS_ORDER = PipelineStatusSchema.options;
export const INTEREST_ORDER = ["in", "maybe", "out"] as const satisfies PipelineInterest[];

/** The day (YYYY-MM-DD) of a next call: a date alone is that date, a time is read in the viewer's zone. */
export const callDay = (row: Pick<PipelineRow, "nextCallAt" | "nextCallHasTime">) => {
  if (!row.nextCallAt) return null;
  return row.nextCallHasTime ? todayDay(new Date(row.nextCallAt)) : row.nextCallAt.slice(0, 10);
};

const DAY_MS = 86_400_000;
/** Whole days from `today` to a YYYY-MM-DD day; negative in the past. */
export const daysFrom = (day: string, today: string) =>
  Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

/** The ISO value a next call is saved as: noon UTC for a date alone, the instant for a date and time. */
export const callIso = (day: string, time: string | null) =>
  time ? new Date(`${day}T${time}`).toISOString() : isoFromDay(day);

export type CallBand = "overdue" | "today" | "week" | "later" | "none";
export const nextBand = (row: PipelineRow, today = todayDay()): CallBand => {
  const day = callDay(row);
  if (!day) return "none";
  const away = daysFrom(day, today);
  return away < 0 ? "overdue" : away === 0 ? "today" : away <= 7 ? "week" : "later";
};
export const isDue = (row: PipelineRow, today = todayDay()) =>
  ["overdue", "today"].includes(nextBand(row, today));

export const lastBand = (row: PipelineRow, today = todayDay()) =>
  !row.lastCall
    ? "never"
    : daysFrom(todayDay(new Date(row.lastCall.at)), today) >= -7
      ? "week"
      : "older";

export const amountBand = (cents: number | null) =>
  cents == null ? "none" : cents < 10_000_000 ? "low" : cents <= 50_000_000 ? "mid" : "high";

export const detailsBand = (row: PipelineRow) =>
  row.details.length === 0
    ? "none"
    : row.details.some((d) => d.source === "agent")
      ? "researched"
      : "list";

export type SortField =
  | "name"
  | "status"
  | "interest"
  | "lastCall"
  | "lastContact"
  | "nextStep"
  | "nextCall"
  | "referredBy"
  | "amount"
  | "details";
export const SORT_FIELDS = [
  "name",
  "status",
  "interest",
  "lastCall",
  "lastContact",
  "nextStep",
  "nextCall",
  "referredBy",
  "amount",
  "details",
] as const satisfies SortField[];

/** The value a column sorts on; null sorts last. Ties break on the list's own order. */
export const sortValue = (field: SortField, row: PipelineRow): string | number | null => {
  switch (field) {
    case "name":
      return row.name;
    case "status":
      return STATUS_ORDER.indexOf(row.status);
    case "interest": {
      const at = row.interest ? INTEREST_ORDER.indexOf(row.interest) : -1;
      return at < 0 ? null : at;
    }
    case "lastCall":
      return row.lastCall?.at ?? null;
    case "lastContact":
      return row.lastContactAt;
    case "nextStep":
      return row.nextStep;
    case "nextCall":
      return row.nextCallAt
        ? `${callDay(row)}T${row.nextCallHasTime ? new Date(row.nextCallAt).toTimeString().slice(0, 5) : "00:00"}`
        : null;
    case "referredBy":
      return row.referredBy?.name ?? null;
    case "amount":
      return row.amountCents;
    case "details":
      return row.details.map((d) => d.value).join(" ") || null;
  }
};

export type Filters = Partial<
  Record<
    "status" | "interest" | "last" | "step" | "next" | "by" | "amount" | "details" | "wave" | "due",
    string
  >
>;

/** Search, every filter and Due now. Passed rows stay out unless the Status filter asks for one. */
export function filterRows(
  rows: readonly PipelineRow[],
  filters: Filters,
  search: string,
  today = todayDay(),
): PipelineRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filters.status ? row.status === filters.status : row.status !== "passed") &&
      (filters.due !== "1" || isDue(row, today)) &&
      (!filters.interest ||
        (filters.interest === "none" ? !row.interest : row.interest === filters.interest)) &&
      (!filters.by ||
        (filters.by === "none" ? !row.referredBy : row.referredBy?.id === filters.by)) &&
      (!filters.amount || amountBand(row.amountCents) === filters.amount) &&
      (!filters.details || detailsBand(row) === filters.details) &&
      (!filters.last || lastBand(row, today) === filters.last) &&
      (!filters.step || (filters.step === "yes") === Boolean(row.nextStep)) &&
      (!filters.next || nextBand(row, today) === filters.next) &&
      (!filters.wave || row.group === filters.wave) &&
      (!needle ||
        `${row.name} ${row.people.map((p) => p.name).join(" ")}`.toLowerCase().includes(needle)),
  );
}

/** The next `count` working days (no Saturday or Sunday) after `now`, as YYYY-MM-DD in the viewer's zone. */
export function nextWorkingDays(now: Date, count: number): string[] {
  const days: string[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(todayDay(cursor));
  }
  return days;
}

/** The day a week after `now`, as YYYY-MM-DD in the viewer's zone. */
export function inAWeek(now: Date): string {
  return todayDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
}

/** What the founder chose to do with the next call after a call: keep the old date, or set a day (null clears it). */
export type LogCallResult = {
  outcome: PipelineCallOutcome;
  note: string;
  next: "keep" | { day: string | null };
};

export type NextCallValue = { day: string; time: string | null } | null;

/** Every edit a row offers; the page turns each into one RPC. */
export type RowEdits = {
  status: (row: PipelineRow, status: PipelineStatus) => void;
  interest: (row: PipelineRow, value: PipelineInterest | null) => void;
  nextStep: (row: PipelineRow, text: string) => void;
  /** A save that rejects on failure, so the editor can try the same value again. */
  nextCall: (row: PipelineRow, next: NextCallValue) => unknown;
  amount: (row: PipelineRow, text: string) => void;
  referrer: (row: PipelineRow, contactId: string | null) => void;
  createReferrer: (row: PipelineRow, name: string) => void;
  log: (row: PipelineRow, result: LogCallResult) => void;
  /** Undoes the row's `lastAuto` change (its eventId), when it has one. */
  undoAuto: (row: PipelineRow) => void;
};
