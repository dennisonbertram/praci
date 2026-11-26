import { z } from "zod";
import type {
  BackgroundJob,
  BackgroundJobHandlers,
  BackgroundJobName,
  BackgroundJobPayloads,
} from "./types.js";

const dataRoomStepPayload = z.object({
  spaceId: z.string().min(1),
  userId: z.string().min(1),
  itemId: z.string().min(1),
});

const payloadSchemas = {
  "run.continue": z.object({ runId: z.string().min(1) }),
  "routine.wakeup": z.object({
    routineId: z.string().min(1),
    scheduledFor: z.string().datetime({ offset: true }),
  }),
  "routine.retry": z.object({ runId: z.string().min(1) }),
  "computer.update": z.object({ updateId: z.string().min(1) }),
  "computer.sleep": z.object({ computerId: z.string().min(1) }),
  "computer.control-expire": z.object({
    computerId: z.string().min(1),
    leaseId: z.string().min(1),
  }),
  "skill.teaching-expire": z.object({ skillId: z.string().min(1) }),
  "history.compact": z.object({ threadId: z.string().min(1) }),
  "goal.check": z.object({ goalId: z.string().min(1), runId: z.string().min(1) }),
  "messaging.deliver": z.object({ runId: z.string().min(1).optional() }),
  "notifications.deliver": z.object({}),
  "notifications.retention": z.object({}),
  "messaging.retention": z.object({}),
  "account.export": z.object({ exportId: z.string().min(1) }),
  "account.export.cleanup": z.object({}),
  "cloud_agent.poll": z.object({ agentId: z.string().min(1) }),
  "mail.search.expire": z.object({ searchId: z.string().min(1) }),
  "mail.reply.batch": z.object({
    effectId: z.string().min(1),
    spaceId: z.string().min(1),
    userId: z.string().min(1),
  }),
  "pipeline.import": z.object({
    importId: z.string().min(1),
    spaceId: z.string().min(1),
    userId: z.string().min(1),
  }),
  "pipeline.auto_status": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
  }),
  "pipeline.auto_status.sweep": z.object({}),
  "inbox.triage": z.object({ userId: z.string().min(1), spaceId: z.string().min(1) }),
  "mail.sync": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
  }),
  "contacts.photos": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
  }),
  "mail.attachments": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
    messageId: z.string().min(1),
  }),
  "audit.intake": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
    messageId: z.string().min(1),
  }),
  "mail.watch.renew": z.object({}),
  "mail.sync.sweep": z.object({}),
  "devin.refresh": z.object({ serverId: z.string().min(1).optional() }),
  "meetings.sync": z
    .object({
      spaceId: z.string().min(1),
      userId: z.string().min(1),
      provider: z.string().min(1),
      connectionId: z.string().min(1).optional(),
      mcpServerId: z.string().min(1).optional(),
    })
    .refine((p) => (p.connectionId === undefined) !== (p.mcpServerId === undefined), {
      message: "A meetings sync names exactly one source",
    }),
  "meetings.digest": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    meetingId: z.string().min(1),
    /** Set on the last job of a batch: when it ends, the rest of the backlog is queued. */
    continue: z.boolean().optional(),
  }),
  "meetings.followup": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    meetingId: z.string().min(1),
    /** How many times a busy agent thread has already pushed this follow-up back. */
    retry: z.number().int().min(0).optional(),
  }),
  "company.import.run": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    runId: z.string().min(1),
  }),
  "company.import.unit": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    runId: z.string().min(1),
    unitId: z.string().min(1),
  }),
  "company.import.recover": z.object({}),
  "company.refresh.tick": z.object({}),
  "watch.probe": z.object({}),
  "pages.refresh.tick": z.object({}),
  "pages.snapshots.retention": z.object({}),
  "finance.sync": z.object({ userId: z.string().min(1), spaceId: z.string().min(1) }),
  "meetings.capture_transcribe": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    chunkId: z.string().min(1),
  }),
  "meetings.capture_finalize": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    captureId: z.string().min(1),
  }),
  "meetings.capture_sweep": z.object({}),
  "omi.assemble": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
  }),
  "omi.transcribe": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    itemId: z.string().min(1),
  }),
  "omi.sort": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    itemId: z.string().min(1),
  }),
  "dataroom.blob.delete": z.object({ spaceId: z.string().min(1), storageKey: z.string().min(1) }),
  "dataroom.ingest": dataRoomStepPayload,
  "dataroom.classify": dataRoomStepPayload,
  "dataroom.index": dataRoomStepPayload,
  "dataroom.thumbnail": dataRoomStepPayload,
  "dataroom.zip.unpack": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    storageKey: z.string().min(1),
    size: z.number().int().nonnegative(),
    entries: z.number().int().positive(),
    importId: z.string().min(1),
    name: z.string().min(1),
    source: z.enum(["upload", "scan", "gmail", "drive", "box", "chat", "omi", "meeting"]),
    folderId: z.string().min(1).nullable(),
    sourceConnectionId: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    sourceUrl: z.string().min(1).optional(),
  }),
  "dataroom.drive.import": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
    folderId: z.string().min(1).nullable(),
    importId: z.string().min(1).optional(),
    folders: z
      .array(
        z.object({ name: z.string().min(1).max(255), parent: z.number().int().min(0).nullable() }),
      )
      .max(500),
    files: z
      .array(
        z.object({ id: z.string().min(1).max(200), folder: z.number().int().min(0).nullable() }),
      )
      .max(500),
  }),
  "dataroom.drive.file": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
    externalId: z.string().min(1),
    folderId: z.string().min(1).nullable(),
    importId: z.string().min(1).optional(),
  }),
  "dataroom.box.import": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
    folderId: z.string().min(1).nullable(),
    importId: z.string().min(1).optional(),
    folders: z
      .array(
        z.object({ name: z.string().min(1).max(255), parent: z.number().int().min(0).nullable() }),
      )
      .max(500),
    files: z
      .array(
        z.object({ id: z.string().min(1).max(200), folder: z.number().int().min(0).nullable() }),
      )
      .max(500),
  }),
  "dataroom.box.file": z.object({
    spaceId: z.string().min(1),
    userId: z.string().min(1),
    connectionId: z.string().min(1),
    externalId: z.string().min(1),
    folderId: z.string().min(1).nullable(),
    importId: z.string().min(1).optional(),
  }),
} satisfies { [Name in BackgroundJobName]: z.ZodType<BackgroundJobPayloads[Name]> };

export function parseBackgroundJob(name: string, payload: unknown): BackgroundJob {
  if (!(name in payloadSchemas)) throw new Error(`Unknown background job: ${name}`);
  const typedName = name as BackgroundJobName;
  const parsed = payloadSchemas[typedName].parse(payload);
  return { name: typedName, payload: parsed } as BackgroundJob;
}

export async function dispatchBackgroundJob(
  handlers: BackgroundJobHandlers,
  name: string,
  payload: unknown,
): Promise<void> {
  const job = parseBackgroundJob(name, payload);
  const handler = handlers[job.name] as (payload: typeof job.payload) => Promise<void>;
  await handler(job.payload);
}

export function runJobKey(runId: string): string {
  return `run:${runId}`;
}

export function routineJobKey(routineId: string): string {
  return `routine:${routineId}`;
}

export function computerSleepJobKey(computerId: string): string {
  return `computer.sleep:${computerId}`;
}

export function computerControlExpireJobKey(computerId: string, leaseId?: string): string {
  return leaseId
    ? `computer.control-expire:${computerId}:${leaseId}`
    : `computer.control-expire:${computerId}`;
}

export function skillTeachingExpireJobKey(skillId: string): string {
  return `skill.teaching-expire:${skillId}`;
}

/** One build per export row; a retry replaces the queued job. */
export function accountExportJob(exportId: string): BackgroundJob {
  return {
    name: "account.export",
    payload: { exportId },
    replaceKey: `account.export:${exportId}`,
    maxAttempts: 1,
  };
}

/**
 * Jobs a user is waiting on (an agent run, its reply) run before due bulk work such as imports and
 * mailbox sweeps, so one tenant's backlog does not delay another's chat.
 */
const INTERACTIVE_PRIORITY = -1;

export function runContinueJob(runId: string): BackgroundJob {
  return {
    name: "run.continue",
    payload: { runId },
    replaceKey: runJobKey(runId),
    priority: INTERACTIVE_PRIORITY,
  };
}

/** One tick of the page-watch probe; the cron runs it every minute, this queues one on demand. */
export function watchProbeJob(): BackgroundJob {
  return { name: "watch.probe", payload: {}, replaceKey: "watch.probe" };
}

export function routineWakeupJob(routineId: string, scheduledFor: Date): BackgroundJob {
  return {
    name: "routine.wakeup",
    payload: { routineId, scheduledFor: scheduledFor.toISOString() },
    availableAt: scheduledFor,
    replaceKey: routineJobKey(routineId),
  };
}

/** Keyed to the failed run, so a repeated enqueue keeps a single retry. */
export function routineRetryJob(runId: string, availableAt: Date): BackgroundJob {
  return {
    name: "routine.retry",
    payload: { runId },
    availableAt,
    replaceKey: `routine.retry:${runId}`,
  };
}

export function computerSleepJob(computerId: string, availableAt: Date): BackgroundJob {
  return {
    name: "computer.sleep",
    payload: { computerId },
    availableAt,
    replaceKey: computerSleepJobKey(computerId),
  };
}

export function computerControlExpireJob(
  computerId: string,
  leaseId: string,
  availableAt: Date,
): BackgroundJob {
  return {
    name: "computer.control-expire",
    payload: { computerId, leaseId },
    availableAt,
    replaceKey: computerControlExpireJobKey(computerId, leaseId),
  };
}

export function skillTeachingExpireJob(skillId: string, availableAt: Date): BackgroundJob {
  return {
    name: "skill.teaching-expire",
    payload: { skillId },
    availableAt,
    replaceKey: skillTeachingExpireJobKey(skillId),
  };
}

export function historyCompactJobKey(threadId: string): string {
  return `history.compact:${threadId}`;
}

/**
 * Each attempt runs a summarizer completion that can take up to the summarizer
 * timeout, so the job queue's default attempt count turns one permanently
 * failing thread into hours of paid retries. A few tries ride out transient
 * provider errors without storming.
 */
export const HISTORY_COMPACT_MAX_ATTEMPTS = 4;

export function messagingDeliverJob(runId?: string, availableAt?: Date): BackgroundJob {
  return {
    name: "messaging.deliver",
    payload: runId ? { runId } : {},
    replaceKey: `messaging.deliver:${runId ?? "drain"}`,
    priority: INTERACTIVE_PRIORITY,
    ...(availableAt ? { availableAt } : {}),
  };
}

export function historyCompactJob(threadId: string): BackgroundJob {
  return {
    name: "history.compact",
    payload: { threadId },
    replaceKey: historyCompactJobKey(threadId),
    maxAttempts: HISTORY_COMPACT_MAX_ATTEMPTS,
  };
}

/** One queued check per goal: a newer run's end replaces an older queued check. */
export function goalCheckJob(goalId: string, runId: string): BackgroundJob {
  return {
    name: "goal.check",
    payload: { goalId, runId },
    replaceKey: `goal:${goalId}`,
  };
}

export function cloudAgentPollJobKey(agentId: string): string {
  return `cloud_agent.poll:${agentId}`;
}

export function cloudAgentPollJob(
  payload: BackgroundJobPayloads["cloud_agent.poll"],
  availableAt?: Date,
): BackgroundJob {
  return {
    name: "cloud_agent.poll",
    payload,
    replaceKey: cloudAgentPollJobKey(payload.agentId),
    ...(availableAt ? { availableAt } : {}),
  };
}

export function mailSearchExpireJobKey(searchId: string): string {
  return `mail.search.expire:${searchId}`;
}

export function mailSearchExpireJob(searchId: string, availableAt: Date): BackgroundJob {
  return {
    name: "mail.search.expire",
    payload: { searchId },
    availableAt,
    replaceKey: mailSearchExpireJobKey(searchId),
  };
}

export function mailReplyBatchJobKey(effectId: string): string {
  return `mail.reply.batch:${effectId}`;
}

/**
 * Sends one batch's approved rows in order. Claims are per row, so a second job for the same batch
 * (a retry while one still runs, or recovery after a worker died) can never send a row twice.
 */
export function mailReplyBatchJob(
  payload: BackgroundJobPayloads["mail.reply.batch"],
): BackgroundJob {
  return {
    name: "mail.reply.batch",
    payload,
    replaceKey: mailReplyBatchJobKey(payload.effectId),
  };
}

/** Applies one import's queued rows. Rows take turns, so a second job for the import changes nothing. */
export function pipelineImportJob(
  payload: BackgroundJobPayloads["pipeline.import"],
): BackgroundJob {
  return {
    name: "pipeline.import",
    payload,
    replaceKey: `pipeline.import:${payload.importId}`,
  };
}

export function pipelineAutoStatusJobKey(scope: { spaceId: string; userId: string }): string {
  return `pipeline.auto_status:${scope.spaceId}:${scope.userId}`;
}

/** One queued auto-status run per user: the key replaces a queued job so the latest run wins. */
export function pipelineAutoStatusJob(scope: { spaceId: string; userId: string }): BackgroundJob {
  return {
    name: "pipeline.auto_status",
    payload: scope,
    replaceKey: pipelineAutoStatusJobKey(scope),
    maxAttempts: 2,
  };
}

export function inboxTriageJobKey(userId: string, spaceId: string): string {
  return `inbox.triage:${spaceId}:${userId}`;
}

/**
 * The job key merges repeated enqueues for one user into a single queued job. It does not stop
 * a job from being queued while another is running (graphile detaches the key from a running
 * job), so `runInboxTriage` takes its own per-user lock.
 */
export function inboxTriageJob(userId: string, spaceId: string, availableAt?: Date): BackgroundJob {
  return {
    name: "inbox.triage",
    payload: { userId, spaceId },
    ...(availableAt ? { availableAt } : {}),
    replaceKey: inboxTriageJobKey(userId, spaceId),
    // Each attempt can make up to five paid model calls.
    maxAttempts: 3,
  };
}

export function mailSyncJobKey(connectionId: string): string {
  return `mail.sync:${connectionId}`;
}

/**
 * One queued sync per connection: the key replaces a queued job, so the latest request wins and
 * runs now. A running job loses its key and a second one queues; the sync's claim and 60-second
 * throttle make that second one a no-op.
 */
export function mailSyncJob(
  scope: BackgroundJobPayloads["mail.sync"],
  availableAt?: Date,
): BackgroundJob {
  return {
    name: "mail.sync",
    payload: scope,
    replaceKey: mailSyncJobKey(scope.connectionId),
    maxAttempts: 3,
    ...(availableAt ? { availableAt } : {}),
  };
}

/** One queued job per connection; the handler skips a connection fetched within the day. */
export function contactPhotosJob(scope: {
  spaceId: string;
  userId: string;
  connectionId: string;
}): BackgroundJob {
  return {
    name: "contacts.photos",
    payload: scope,
    replaceKey: `contacts.photos:${scope.connectionId}`,
    maxAttempts: 3,
  };
}

/** One queued job per message: a re-sync that stores the message again replaces it. */
export function mailAttachmentsJob(
  scope: { spaceId: string; userId: string; connectionId: string },
  messageId: string,
): BackgroundJob {
  return {
    name: "mail.attachments",
    payload: { ...scope, messageId },
    replaceKey: `mail.attachments:${scope.connectionId}:${messageId}`,
    maxAttempts: 5,
  };
}

/** One queued job per message: a re-sync that stores the message again replaces it. */
export function auditIntakeJob(
  scope: { spaceId: string; userId: string; connectionId: string },
  messageId: string,
): BackgroundJob {
  return {
    name: "audit.intake",
    payload: { ...scope, messageId },
    replaceKey: `audit.intake:${scope.connectionId}:${messageId}`,
    maxAttempts: 5,
  };
}

/** One queued sync per source: a repeat replaces it, and the sync's own claim keeps one running. */
export function meetingsSyncJob(
  payload: BackgroundJobPayloads["meetings.sync"],
  availableAt?: Date,
): BackgroundJob {
  return {
    name: "meetings.sync",
    payload,
    replaceKey: `meetings.sync:${payload.connectionId ?? payload.mcpServerId}`,
    maxAttempts: 3,
    ...(availableAt ? { availableAt } : {}),
  };
}

/** One queued digest per meeting. */
export function meetingsDigestJob(
  payload: BackgroundJobPayloads["meetings.digest"],
  availableAt?: Date,
): BackgroundJob {
  return {
    name: "meetings.digest",
    payload,
    replaceKey: `meetings.digest:${payload.meetingId}`,
    maxAttempts: 3,
    ...(availableAt ? { availableAt } : {}),
  };
}

/** One queued follow-up per meeting. */
export function meetingsFollowupJob(
  payload: BackgroundJobPayloads["meetings.followup"],
): BackgroundJob {
  return {
    name: "meetings.followup",
    payload,
    replaceKey: `meetings.followup:${payload.meetingId}`,
    maxAttempts: 3,
  };
}

/** Runs the follow-up again later, because an agent's thread was busy. Its own key leaves the running job alone. */
export function meetingsFollowupRetryJob(
  payload: BackgroundJobPayloads["meetings.followup"],
  availableAt: Date,
): BackgroundJob {
  return {
    name: "meetings.followup",
    payload,
    replaceKey: `meetings.followup:${payload.meetingId}:retry`,
    availableAt,
    maxAttempts: 3,
  };
}

/** One queued transcription per chunk. */
export function meetingsCaptureTranscribeJob(
  payload: BackgroundJobPayloads["meetings.capture_transcribe"],
): BackgroundJob {
  return {
    name: "meetings.capture_transcribe",
    payload,
    replaceKey: `meetings.capture_transcribe:${payload.chunkId}`,
    maxAttempts: 3,
  };
}

/** One queued finalize per capture. */
export function meetingsCaptureFinalizeJob(
  payload: BackgroundJobPayloads["meetings.capture_finalize"],
): BackgroundJob {
  return {
    name: "meetings.capture_finalize",
    payload,
    replaceKey: `meetings.capture_finalize:${payload.captureId}`,
    maxAttempts: 3,
  };
}

/** One queued assembly per pendant connection; a repeat replaces it. */
export function omiAssembleJob(payload: BackgroundJobPayloads["omi.assemble"]): BackgroundJob {
  return {
    name: "omi.assemble",
    payload,
    replaceKey: `omi.assemble:${payload.connectionId}`,
    maxAttempts: 3,
  };
}

/** One queued transcription per recording; a repeat replaces it. */
export function omiTranscribeJob(payload: BackgroundJobPayloads["omi.transcribe"]): BackgroundJob {
  return {
    name: "omi.transcribe",
    payload,
    replaceKey: `omi.transcribe:${payload.itemId}`,
    maxAttempts: 3,
  };
}

/** One queued sort per recording; a repeat replaces it. */
export function omiSortJob(payload: BackgroundJobPayloads["omi.sort"]): BackgroundJob {
  return {
    name: "omi.sort",
    payload,
    replaceKey: `omi.sort:${payload.itemId}`,
    maxAttempts: 3,
  };
}

export function financeSyncJobKey(userId: string, spaceId: string): string {
  return `finance.sync:${spaceId}:${userId}`;
}

/** The job key merges repeated enqueues for one user into one queued job; `syncFinanceForUser` takes its own claim for the running one. */
export function financeSyncJob(userId: string, spaceId: string, availableAt?: Date): BackgroundJob {
  return {
    name: "finance.sync",
    payload: { userId, spaceId },
    ...(availableAt ? { availableAt } : {}),
    replaceKey: financeSyncJobKey(userId, spaceId),
    maxAttempts: 3,
  };
}

/** One cleanup per blob: a double enqueue replaces the first job instead of adding a second. */
export function dataRoomBlobDeleteJob(
  spaceId: string,
  storageKey: string,
  availableAt?: Date,
): BackgroundJob {
  return {
    ...(availableAt ? { availableAt } : {}),
    name: "dataroom.blob.delete",
    payload: { spaceId, storageKey },
    replaceKey: `dataroom.blob.delete:${spaceId}:${storageKey}`,
  };
}

/** Attempts a Data room step gets; the item is marked failed when the last one fails. */
export const DATA_ROOM_JOB_ATTEMPTS = 3;

/** One queued job per item and step: a double enqueue replaces the first. */
export function dataRoomStepJob(
  name: "dataroom.ingest" | "dataroom.classify" | "dataroom.index" | "dataroom.thumbnail",
  scope: { spaceId: string; userId: string },
  itemId: string,
): BackgroundJob {
  return {
    name,
    payload: { spaceId: scope.spaceId, userId: scope.userId, itemId },
    replaceKey: `${name}:${itemId}`,
    maxAttempts: DATA_ROOM_JOB_ATTEMPTS,
  };
}

/** One unpack per stored zip: queueing it again replaces the first. */
export function dataRoomZipUnpackJob(
  payload: BackgroundJobPayloads["dataroom.zip.unpack"],
): BackgroundJob {
  return {
    name: "dataroom.zip.unpack",
    payload,
    replaceKey: `dataroom.zip.unpack:${payload.spaceId}:${payload.storageKey}`,
    maxAttempts: DATA_ROOM_JOB_ATTEMPTS,
  };
}

/** One queued job per Drive file and connection: queueing an import again replaces the first. */
export function dataRoomDriveFileJob(
  scope: { spaceId: string; userId: string },
  connectionId: string,
  externalId: string,
  folderId: string | null,
  importId?: string,
): BackgroundJob {
  return {
    name: "dataroom.drive.file",
    payload: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      connectionId,
      externalId,
      folderId,
      ...(importId ? { importId } : {}),
    },
    replaceKey: `dataroom.drive.file:${scope.spaceId}:${scope.userId}:${connectionId}:${externalId}`,
    maxAttempts: DATA_ROOM_JOB_ATTEMPTS,
  };
}

/** A planned Drive folder import, held in the queue until its folders and file jobs are written. */
export function dataRoomDriveImportJob(
  payload: BackgroundJobPayloads["dataroom.drive.import"],
): BackgroundJob {
  return { name: "dataroom.drive.import", payload, maxAttempts: DATA_ROOM_JOB_ATTEMPTS };
}

/** One queued job per Box file and connection: queueing an import again replaces the first. */
export function dataRoomBoxFileJob(
  scope: { spaceId: string; userId: string },
  connectionId: string,
  externalId: string,
  folderId: string | null,
  importId?: string,
): BackgroundJob {
  return {
    name: "dataroom.box.file",
    payload: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      connectionId,
      externalId,
      folderId,
      ...(importId ? { importId } : {}),
    },
    replaceKey: `dataroom.box.file:${scope.spaceId}:${scope.userId}:${connectionId}:${externalId}`,
    maxAttempts: DATA_ROOM_JOB_ATTEMPTS,
  };
}

/** A planned Box folder import, held in the queue until its folders and file jobs are written. */
export function dataRoomBoxImportJob(
  payload: BackgroundJobPayloads["dataroom.box.import"],
): BackgroundJob {
  return { name: "dataroom.box.import", payload, maxAttempts: DATA_ROOM_JOB_ATTEMPTS };
}
