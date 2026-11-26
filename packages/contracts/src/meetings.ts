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
  /** A content version for a source whose update time does not change on an edit; compared for equality. */
  version: z.string().optional(),
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

/** One stored meeting in the plain list: title, date and source. */
export const StoredMeetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  startedAt: IsoDate,
  endedAt: IsoDate.nullable(),
  provider: z.string(),
});
export type StoredMeeting = z.infer<typeof StoredMeetingSchema>;

/** Stored meetings come 100 at a time, newest first; `nextCursor` is null on the last page. */
export const STORED_MEETINGS_PAGE_SIZE = 100;
export const StoredMeetingsPageSchema = z.object({
  items: z.array(StoredMeetingSchema),
  nextCursor: z.string().nullable(),
});
export type StoredMeetingsPage = z.infer<typeof StoredMeetingsPageSchema>;

const MEETING_SOURCE_NAMES: Record<string, string> = {
  granola: "Granola",
  omi: "Omi",
  omi_cloud: "Omi cloud",
  hex: "Hex",
  praci: "Praci",
  wisprflow: "Wispr Flow",
};
/** The provider ids the Source filter offers. */
export const MEETING_SOURCES = Object.keys(MEETING_SOURCE_NAMES);
/** The source's display name; a provider this app does not know shows as its own id. */
export const meetingSourceName = (provider: string) => MEETING_SOURCE_NAMES[provider] ?? provider;

/** One stored meeting for its page: what the digest found, the user's to-dos from it, and the transcript. */
export const StoredMeetingDetailSchema = StoredMeetingSchema.extend({
  summary: z.string(),
  decisions: z.array(z.string()),
  followUps: z.array(z.string()),
  todos: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** YYYY-MM-DD */
      dueOn: z.string().nullable(),
      doneAt: IsoDate.nullable(),
    }),
  ),
  transcript: z.string().nullable(),
  /** True when part of a recording could not be transcribed. */
  partial: z.boolean(),
  /** True when "Merge with previous" applies: the previous meeting is from the same source and ended within 30 minutes before this one began. */
  canMergeWithPrevious: z.boolean().optional(),
  /** True while the meeting's digest is still to come, so the page keeps looking. */
  summarizing: z.boolean(),
  /** Commitments from the digest that belong to other people; the user's own are in `todos`. */
  actionItems: z.array(
    z.object({ owner: z.string(), text: z.string(), /** YYYY-MM-DD */ due: z.string().nullable() }),
  ),
});
export type StoredMeetingDetail = z.infer<typeof StoredMeetingDetailSchema>;

/** The most audio one chunk upload may carry. */
export const MEETING_CAPTURE_CHUNK_MAX_BYTES = 4 * 1024 * 1024;
/** The longest text one device chunk may carry. */
export const MEETING_CAPTURE_TEXT_MAX_CHARS = 20_000;

export const MeetingRecordingPolicySchema = z.enum(["remind", "confirm", "off"]);
export type MeetingRecordingPolicy = z.infer<typeof MeetingRecordingPolicySchema>;

export const MeetingCaptureTrackSchema = z.enum(["microphone", "system"]);
export type MeetingCaptureTrack = z.infer<typeof MeetingCaptureTrackSchema>;

const CaptureId = z.string().min(1).max(100);
const ChunkPosition = {
  track: MeetingCaptureTrackSchema,
  seq: z.number().int().min(0).max(1_000_000),
  startMs: z.number().int().min(0).max(86_400_000),
  endMs: z.number().int().min(0).max(86_400_000),
};

export const MeetingCaptureStartInputSchema = z.object({
  /** Chosen by the client for this recording; starting twice with it returns the same capture. */
  clientId: z.string().min(1).max(100),
  title: z.string().max(500).optional(),
  engine: z.enum(["device", "server"]),
  tracks: z.array(MeetingCaptureTrackSchema).min(1).max(2),
  /** Required when the space's policy is "confirm". */
  consentConfirmed: z.boolean().optional(),
});
export const MeetingCaptureStartOutputSchema = z.object({ captureId: CaptureId });

export const MeetingCaptureAppendTextInputSchema = z.object({
  captureId: CaptureId,
  ...ChunkPosition,
  text: z.string().max(MEETING_CAPTURE_TEXT_MAX_CHARS),
});

export const MeetingCaptureFinishInputSchema = z.object({
  captureId: CaptureId,
  endedAt: IsoDate,
  /** Pieces the server refused for good; any marks the meeting partial. */
  lostChunks: z.number().int().min(0).max(1_000_000).optional(),
});

/** The caller's capture that is recording or waiting to be stored; null when there is none. */
export const MeetingCaptureActiveSchema = z
  .object({
    captureId: CaptureId,
    title: z.string().nullable(),
    engine: z.enum(["device", "server"]),
    tracks: z.array(MeetingCaptureTrackSchema),
    status: z.enum(["recording", "finishing"]),
    startedAt: IsoDate,
  })
  .nullable();
export type MeetingCaptureActive = z.infer<typeof MeetingCaptureActiveSchema>;
