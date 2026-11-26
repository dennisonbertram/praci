import { z } from "zod";
import { IsoDate } from "./ids.js";
import { SourceMeetingSchema } from "./meetings.js";

/** Connection.connectorId for Hex (a local meeting recorder); the connection's provider is "hex" too. */
export const HEX_CONNECTOR_ID = "hex";

/** One `meetings.importLocal` call carries at most this many meetings. */
export const LOCAL_IMPORT_MAX_MEETINGS = 10;

/** Hex's `meetings list|show --json` version 1 contract. Unknown fields are ignored. */
export const HexMeetingSchema = z.object({
  id: z.string().regex(/^[0-9]+-[0-9]+$/),
  title: z.string(),
  timestamp_ms: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative(),
  application: z.string().nullable(),
  status: z.enum(["starting", "recording", "transcribing", "complete", "interrupted", "failed"]),
  in_progress: z.boolean(),
  transcript_source: z.string(),
});
export type HexMeeting = z.infer<typeof HexMeetingSchema>;

export const HexMeetingListSchema = z.object({
  version: z.literal(1),
  meetings: z.array(HexMeetingSchema),
  truncated: z.boolean(),
});
export type HexMeetingList = z.infer<typeof HexMeetingListSchema>;

export const HexMeetingShowSchema = z.object({
  version: z.literal(1),
  meeting: HexMeetingSchema,
  notes: z
    .object({
      title: z.string(),
      summary: z.string(),
      generated_at_ms: z.number().int(),
    })
    .nullable(),
  entries: z.array(
    z.object({
      source: z.enum(["microphone", "system"]),
      start_ms: z.number().int(),
      end_ms: z.number().int(),
      text: z.string(),
    }),
  ),
});
export type HexMeetingShow = z.infer<typeof HexMeetingShowSchema>;

/**
 * What the desktop bridge answers. `not_found`: no Hex at the two known paths. `update`: Hex speaks
 * another contract version. `failed`: it ran but could not be read (exit code, timeout, bad output).
 */
export type HexResult<T> =
  | { state: "ok"; value: T }
  | { state: "not_found" }
  | { state: "update" }
  | { state: "failed" };

export const LocalMeetingsImportInputSchema = z.object({
  connectionId: z.string().min(1),
  meetings: z.array(SourceMeetingSchema).max(LOCAL_IMPORT_MAX_MEETINGS),
});
export const LocalMeetingsImportOutputSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
});
export type LocalMeetingsImportOutput = z.infer<typeof LocalMeetingsImportOutputSchema>;

export const LocalMeetingsConnectInputSchema = z.object({
  source: z.literal("hex"),
});
export const LocalMeetingsDisconnectInputSchema = z.object({
  connectionId: z.string().min(1),
  deleteMeetings: z.boolean(),
});

/** The Hex tile; null before the user connected Hex. */
export const LocalMeetingsStatusSchema = z
  .object({
    connectionId: z.string(),
    status: z.enum(["connected", "disconnected"]),
    syncedThrough: IsoDate.nullable(),
    lastSyncedAt: IsoDate.nullable(),
    /** Stored meetings imported from this source. */
    count: z.number().int().nonnegative(),
  })
  .nullable();
export type LocalMeetingsStatus = z.infer<typeof LocalMeetingsStatusSchema>;
