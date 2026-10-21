import * as z from "zod";
import { IsoDate } from "./ids.js";

/** Byte cap on transcript text a tool returns to a model; longer text is cut with a marker. */
export const MEETING_TRANSCRIPT_TOOL_MAX_BYTES = 64 * 1024;
/** Byte cap on transcript text a source returns, so one meeting cannot fill the store. */
export const MEETING_TRANSCRIPT_MAX_BYTES = 2 * 1024 * 1024;
/** Marker appended where transcript text was cut. */
export const MEETING_TRUNCATION_MARKER = "\n[transcript truncated]";

export const MeetingAttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
});
export type MeetingAttendee = z.infer<typeof MeetingAttendeeSchema>;

export const MeetingTranscriptLineSchema = z.object({
  /** Speaker name or label; absent when the provider does not attribute lines. */
  speaker: z.string().optional(),
  text: z.string(),
  at: IsoDate.optional(),
});
export type MeetingTranscriptLine = z.infer<typeof MeetingTranscriptLineSchema>;

/** One meeting as any provider reports it. Vendor names and payloads never appear here. */
export const SourceMeetingSchema = z.object({
  externalId: z.string().min(1),
  title: z.string(),
  startedAt: IsoDate,
  endedAt: IsoDate.nullable(),
  attendees: z.array(MeetingAttendeeSchema),
  organizerEmail: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  folders: z.array(z.string()),
  summary: z.string(),
  privateNotes: z.string(),
  /** Null when the provider has no transcript or it was not requested. */
  transcript: z.array(MeetingTranscriptLineSchema).nullable(),
  /** True when the transcript was cut to MEETING_TRANSCRIPT_MAX_BYTES. */
  transcriptTruncated: z.boolean().optional(),
  updatedAt: IsoDate,
  deleted: z.boolean().optional(),
});
export type SourceMeeting = z.infer<typeof SourceMeetingSchema>;

/** Speaker-prefixed text lines, as stored in Meeting.transcript. */
export function formatMeetingTranscript(lines: readonly MeetingTranscriptLine[]): string {
  return lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n");
}

/** The Granola API-key route for the key card; never carries the key. Null until a key was pasted. */
export const MeetingsStatusSchema = z
  .object({
    connectionId: z.string(),
    /** `needs_reconnect`: Granola rejected the stored key during a sync. */
    status: z.enum(["connected", "needs_reconnect", "disconnected"]),
    /** Null until the first sync has finished ("Syncing"). */
    syncedThrough: IsoDate.nullable(),
    lastSyncedAt: IsoDate.nullable(),
    /** Stored meetings of this user, whatever route synced them. */
    syncedCount: z.number().int().nonnegative(),
    /** The user's model has no AI-data consent, so the agent cannot read meetings. */
    consentOff: z.boolean(),
    agentBotId: z.string().nullable(),
  })
  .nullable();
export type MeetingsStatus = z.infer<typeof MeetingsStatusSchema>;

export const MeetingConnectInputSchema = z.object({ apiKey: z.string().max(512) });

/** One stored meeting in the plain list: title and date only. */
export const StoredMeetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  startedAt: IsoDate,
});
export type StoredMeeting = z.infer<typeof StoredMeetingSchema>;
