import * as z from "zod";
import { Id, IsoDate } from "./ids.js";

export const CALENDAR_AGENDA_MAX_DAYS = 93;

export const CalendarItemKindSchema = z.enum(["event", "todo", "check_back", "routine"]);
export type CalendarItemKind = z.infer<typeof CalendarItemKindSchema>;

/** A Google event, a bot or inbox to-do, a one-shot check-back, or a run of a repeating routine. */
export const CalendarItemSchema = z.object({
  id: z.string(),
  kind: CalendarItemKindSchema,
  title: z.string(),
  /** An all-day item starts at midnight UTC of its date. */
  start: IsoDate,
  end: IsoDate.nullable(),
  allDay: z.boolean(),
  /** The bot that owns a to-do, check-back or routine; null for a Google event or an inbox to-do. */
  botId: Id.nullable(),
  botName: z.string().nullable(),
  /** The Google account an event comes from. */
  account: z.string().nullable(),
  /** Where the event opens in Google Calendar. */
  href: z.string().nullable(),
  /** A video call link for the event, https only. */
  joinUrl: z.string().nullable().optional(),
  /** Who is going, by display name (at most 5). Only the apps' agenda call asks for these; the bot tool never gets them. */
  attendees: z.array(z.string()).optional(),
  /** How many people the event lists in all, so "+N more" can be shown past the named five. */
  attendeeCount: z.number().int().optional(),
  /** The cached mail message an inbox to-do came from, when it still exists. The Inbox opens it with `?mail=`. */
  mailId: z.string().nullable().optional(),
});
export type CalendarItem = z.infer<typeof CalendarItemSchema>;

export const CalendarAgendaInputSchema = z
  .object({
    from: IsoDate,
    to: IsoDate,
    /** "local" is the bots' items only and never waits for Google; "google" is the events only. Default both. */
    sources: z.enum(["all", "local", "google"]).optional(),
  })
  .refine(({ from, to }) => Date.parse(to) > Date.parse(from), { message: "to must be after from" })
  .refine(
    ({ from, to }) => Date.parse(to) - Date.parse(from) <= CALENDAR_AGENDA_MAX_DAYS * 86_400_000,
    { message: `The range is at most ${CALENDAR_AGENDA_MAX_DAYS} days` },
  );

export const CalendarAgendaSchema = z.object({
  items: z.array(CalendarItemSchema),
  /** Google accounts that could not be read; their events are missing from items. */
  errors: z.array(
    z.object({ account: z.string(), message: z.string(), reconnect: z.boolean().optional() }),
  ),
  /** Whether a Google Calendar account is connected. */
  googleConnected: z.boolean(),
});
export type CalendarAgenda = z.infer<typeof CalendarAgendaSchema>;
