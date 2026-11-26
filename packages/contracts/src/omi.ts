import { z } from "zod";
import { Id } from "./ids.js";

/** Connection.connectorId for an Omi pendant; the connection's provider is "omi" too. */
export const OMI_CONNECTOR_ID = "omi";

/** A pendant upload is one request of at most this many bytes (about two minutes of audio). */
export const OMI_UPLOAD_MAX_BYTES = 1024 * 1024;

const Short = z.string().trim().min(1).max(100);

export const OmiConnectInputSchema = z.object({
  model: Short,
  firmware: Short,
  hardware: Short,
  /** An origin-scoped random id of the browser that paired the pendant, not a hardware address. */
  deviceId: Short,
});
export type OmiConnectInput = z.infer<typeof OmiConnectInputSchema>;

export const OmiStatusSchema = z
  .object({
    connectionId: Id,
    /** Uploads received and not yet turned into recordings. */
    pendingUploads: z.number().int(),
    recordings: z.number().int(),
    /** Recordings whose transcription failed after the retry limit. */
    notTranscribed: z.number().int().nonnegative(),
    /** The Omi agent, once provisioned. */
    agentBotId: Id.nullable(),
  })
  .nullable();
export type OmiStatus = z.infer<typeof OmiStatusSchema>;

export const OmiDisconnectInputSchema = z.object({ deleteRecordings: z.boolean() });

const OmiKind = z.enum(["meeting", "note", "trash"]);

export const OmiSegmentSchema = z.object({
  id: Id,
  audioItemId: Id,
  kind: OmiKind,
  title: z.string(),
  /** Wall-clock times of the stretch. */
  startedAt: z.string(),
  endedAt: z.string(),
  sortedBy: z.enum(["agent", "user"]),
  meetingId: Id.nullable(),
  noteItemId: Id.nullable(),
});
export type OmiSegmentDto = z.infer<typeof OmiSegmentSchema>;

export const OmiSegmentsListInputSchema = z.object({
  /** A UTC day, YYYY-MM-DD. Omit for the newest stretches. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Without `date`: only stretches from the last this-many days. Omit for the newest stretches. */
  days: z.number().int().min(1).max(31).optional(),
});
export const OmiSegmentMoveInputSchema = z.object({ segmentId: Id, kind: OmiKind });

/** Omi's Developer API; keys look like `omi_dev_...`. */
export const OMI_CLOUD_API_BASE_URL = "https://api.omi.me";

/** Connection.connectorId for an Omi Developer API key; the meeting provider is `omi_cloud`. */
export const OMI_CLOUD_CONNECTOR_ID = "omi-cloud";
export const OMI_CLOUD_PROVIDER = "omi_cloud";

/** Omi MCP keys do not work on the REST API. */
export const isOmiMcpKey = (key: string) => key.startsWith("omi_mcp_");

/** One transcript segment of an Omi conversation. Extra fields are allowed. */
export const OmiCloudSegmentSchema = z.object({
  text: z.string(),
  speaker: z.string().nullish(),
  is_user: z.boolean().nullish(),
  /** Seconds from the start of the conversation. */
  start: z.number().nullish(),
  end: z.number().nullish(),
});
export type OmiCloudSegment = z.infer<typeof OmiCloudSegmentSchema>;

/** One conversation from `GET /v1/dev/user/conversations`. Extra fields are allowed. */
export const OmiCloudConversationSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().nullish(),
  started_at: z.string().nullish(),
  finished_at: z.string().nullish(),
  structured: z
    .object({
      title: z.string().nullish(),
      overview: z.string().nullish(),
      /** Strings or objects with a description; read leniently. */
      action_items: z
        .array(
          z.union([
            z.string(),
            z.object({ description: z.string().nullish(), text: z.string().nullish() }),
          ]),
        )
        .nullish(),
    })
    .nullish(),
  transcript_segments: z.array(OmiCloudSegmentSchema).nullish(),
  transcript_included: z.boolean().nullish(),
});
export type OmiCloudConversation = z.infer<typeof OmiCloudConversationSchema>;

export const OmiCloudConnectInputSchema = z.object({ apiKey: z.string().max(512) });
export type OmiCloudConnectInput = z.infer<typeof OmiCloudConnectInputSchema>;

/** The Developer key route; null until a key was pasted. Never carries the key. */
export const OmiCloudStatusSchema = z
  .object({
    connectionId: Id,
    /** `needs_reconnect`: Omi rejected the stored key during a sync. */
    status: z.enum(["connected", "needs_reconnect", "disconnected"]),
    /** Null until the first full sync has finished. */
    syncedThrough: z.string().nullable(),
    /** Set only when the last sync failed or is late. */
    lastSyncedAt: z.string().nullable(),
    /** Stored meetings synced from the cloud. */
    syncedCount: z.number().int().nonnegative(),
    agentBotId: Id.nullable(),
  })
  .nullable();
export type OmiCloudStatus = z.infer<typeof OmiCloudStatusSchema>;
