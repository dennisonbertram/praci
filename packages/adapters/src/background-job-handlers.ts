import type {
  AgentHomeStore,
  AgentRuntime,
  ArtifactStore,
  BackgroundJobHandlers,
  JobPublisher,
  MailProvider,
  MessagingSurface,
  NotificationChannel,
  SandboxProvider,
  SecretStore,
} from "@rakazo/adapter-kit";
import { messagingDeliverJob } from "@rakazo/adapter-kit";
import type { NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import { deleteExpiredMessagingTransport, deleteExpiredNotifications } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { cleanupAccountExports, runAccountExport } from "./account-export.js";
import { runAuditIntake } from "./audit-intake.js";
import type { BoxFilesDeps } from "./box-files.js";
import type { CloudAgentConnection } from "./cloud-agent-factory.js";
import { pollCloudAgent } from "./cloud-agent-poll.js";
import { expireComputerControl } from "./computer-control.js";
import { scheduleComputerSleep, sleepComputerIfIdle } from "./computer-idle.js";
import { performComputerUpdate } from "./computer-update.js";
import { runBoxFileImport, runBoxImport } from "./data-room-box-import.js";
import { runDriveFileImport, runDriveImport } from "./data-room-drive-import.js";
import { DATA_ROOM_STREAM_TIMEOUT_MS } from "./data-room-files.js";
import type { DataRoomJobDeps } from "./data-room-jobs.js";
import {
  runDataRoomClassify,
  runDataRoomIndex,
  runDataRoomIngest,
  runDataRoomThumbnail,
} from "./data-room-jobs.js";
import { resolveDataRoomAi } from "./data-room-models.js";
import { runDataRoomZipUnpack } from "./data-room-zip-import.js";
import type { DevinCallTool } from "./devin-call-tool.js";
import { runDevinRefreshJob } from "./devin-refresh.js";
import type { DriveFilesDeps } from "./drive-files.js";
import { syncExchanges } from "./exchange-sync.js";
import type { createRunExecutor } from "./executor.js";
import type { FinanceSyncDeps } from "./finance-sync.js";
import { syncFinanceForUser } from "./finance-sync.js";
import type { GmailPushConfig } from "./gmail-push.js";
import { ensureMailWatch, runMailWatchRenewal } from "./gmail-push.js";
import { compactHistory } from "./history-compaction.js";
import { createInboxClassifierProvider } from "./inbox-classifier-factory.js";
import { runInboxTriage, triageReadiness } from "./inbox-triage.js";
import { runMailAttachmentFiling } from "./mail-attachment-filing.js";
import { runMailSyncJob } from "./mail-sync-job.js";
import { expireMailSearch } from "./mail-tools.js";
import { runMeetingDigest } from "./meeting-digest.js";
import { createMeetingSourceRegistry } from "./meeting-source-registry.js";
import type { MeetingSourceRegistry } from "./meeting-sync-job.js";
import { runMeetingSyncJob } from "./meeting-sync-job.js";
import type { MemoryProviderResolver } from "./memory-provider-factory.js";
import { deliverMessagingOutbound, mirrorMessagingOutbound } from "./messaging-delivery.js";
import { deliverDueNotifications } from "./notification-outbox.js";
import { renderPdfPages } from "./pdf-render.js";
import { syncCryptoHoldings } from "./rpc-crypto-sync.js";
import { expireTaughtSkillTeaching } from "./teaching-session.js";
import { renderThumbnail } from "./thumbnail-render.js";

export function createBackgroundJobHandlers(deps: {
  executor: ReturnType<typeof createRunExecutor>;
  prisma: PrismaClient;
  sandbox: SandboxProvider;
  home: AgentHomeStore;
  jobs: JobPublisher;
  events: ThreadEvents;
  workerId: string;
  runtime: AgentRuntime;
  secretStore: SecretStore;
  memoryProviders: MemoryProviderResolver;
  deploymentModelKey?: string;
  deploymentModelConfigured?: boolean;
  messaging?: MessagingSurface;
  cloudAgent?: CloudAgentConnection | null;
  /** Read-tool caller for the user's Mercury and Brex servers; see `createFinanceCallToolFor`. */
  financeCallToolFor?: FinanceSyncDeps["callToolFor"];
  /** Read-only Devin caller; without it `devin.refresh` does nothing. Every process that runs jobs must pass it. */
  devinCallTool?: DevinCallTool;
  /** Live signal for a new Devin alert; the alert is stored without it. */
  notificationEvents?: NotificationEvents;
  /** Deletes the blobs of removed Data room items and reads them for ingest. */
  artifacts?: ArtifactStore;
  /** Needed only to import Google Drive folders. */
  connectors?: DriveFilesDeps["connectors"];
  /** Needed to import Box folders: every process that runs jobs must pass it, or queued Box files fail. */
  boxAccessToken?: BoxFilesDeps["accessToken"];
  /** External notification channels the outbox can send through; none means none are sent. */
  notificationChannels?: NotificationChannel[];
  /** Mail provider the `mail.sync` job syncs through: every process that runs jobs must pass it, or queued syncs fail. */
  mail?: MailProvider;
  /** MAIL_WRITES_DISABLED: the `mail.sync` job then archives nothing for skip-inbox senders. */
  mailWritesDisabled?: boolean;
  /** Provider to MeetingSource for `meetings.sync`; omitted means the real providers. The demo and tests pass emulator-backed entries. */
  meetingSources?: MeetingSourceRegistry;
  /** Gmail push settings; absent means polling only, and the watch renewal job does nothing. */
  gmailPush?: GmailPushConfig;
}): BackgroundJobHandlers {
  const deliverMessaging = async (runId?: string) => {
    if (!deps.messaging) return;
    await deliverMessagingOutbound(
      { prisma: deps.prisma, messaging: deps.messaging, events: deps.events, jobs: deps.jobs },
      { runId },
      {
        operationId: `messaging.deliver:${runId ?? "drain"}`,
        traceId: `messaging.deliver:${runId ?? "drain"}`,
        spaceId: "",
        userId: "",
        signal: new AbortController().signal,
      },
    );
  };

  const dataRoomDeps = (): DataRoomJobDeps => {
    if (!deps.artifacts) throw new Error("Artifact store is not configured");
    return {
      prisma: deps.prisma,
      jobs: deps.jobs,
      artifacts: deps.artifacts,
      runtime: deps.runtime,
      renderPdfPages,
      renderThumbnail,
      resolveAi: (scope) =>
        resolveDataRoomAi({ prisma: deps.prisma, resolveModel: deps.executor.resolveModel }, scope),
    };
  };

  const meetingSources = deps.meetingSources ?? createMeetingSourceRegistry();

  return {
    "run.continue": async (payload) => {
      await deps.executor.continueRun(payload.runId, deps.workerId);
      // Automatic messaging mirror: once the run's bot messages are durable,
      // copy them into the outbox. Never let mirror failures fail the run.
      if (deps.messaging) {
        await mirrorMessagingOutbound(
          { prisma: deps.prisma, messaging: deps.messaging, events: deps.events, jobs: deps.jobs },
          payload.runId,
        );
        await deps.jobs.enqueue(messagingDeliverJob()).catch(async (error) => {
          getLogger().error("messaging.deliver enqueue error", error);
          await deliverMessaging();
        });
      }
    },
    "messaging.deliver": async (payload) => {
      await deliverMessaging(payload.runId);
    },
    "routine.wakeup": async (payload) => {
      await deps.executor.wakeRoutine(payload.routineId, payload.scheduledFor);
    },
    "computer.update": async ({ updateId }) => {
      await performComputerUpdate(deps, updateId);
    },
    "computer.sleep": async (payload) => {
      await sleepComputerIfIdle(deps, payload.computerId);
    },
    "computer.control-expire": async (payload) => {
      if (await expireComputerControl(deps, payload.computerId, payload.leaseId)) {
        scheduleComputerSleep(deps.jobs, payload.computerId);
      }
    },
    "skill.teaching-expire": async (payload) => {
      await expireTaughtSkillTeaching(deps, payload.skillId);
    },
    "notifications.deliver": async () => {
      await deliverDueNotifications({
        prisma: deps.prisma,
        channels: deps.notificationChannels ?? [],
      });
    },
    "notifications.retention": async () => {
      await deleteExpiredNotifications(deps.prisma);
    },
    "account.export": async (payload) => {
      if (!deps.artifacts) throw new Error("Data export is not configured");
      await runAccountExport({ prisma: deps.prisma, artifacts: deps.artifacts }, payload.exportId);
    },
    "account.export.cleanup": async () => {
      if (!deps.artifacts) throw new Error("Data export is not configured");
      await cleanupAccountExports({ prisma: deps.prisma, artifacts: deps.artifacts });
    },
    "messaging.retention": async () => {
      await deleteExpiredMessagingTransport(deps.prisma);
    },
    "mail.search.expire": async (payload) => {
      await expireMailSearch(deps.prisma, payload.searchId);
    },
    "mail.sync": (payload) => {
      const { mail } = deps;
      if (!mail) throw new Error("Mail sync is not configured");
      return runMailSyncJob(
        {
          prisma: deps.prisma,
          mail,
          jobs: deps.jobs,
          mailWritesDisabled: deps.mailWritesDisabled,
          digestReady: async (scope) =>
            (await triageReadiness(
              { prisma: deps.prisma, resolveModel: deps.executor.resolveModel },
              scope,
            )) !== null,
          ...(deps.gmailPush
            ? {
                afterSync: (account, context) =>
                  ensureMailWatch(
                    { prisma: deps.prisma, mail },
                    deps.gmailPush as GmailPushConfig,
                    account,
                    context,
                  ),
              }
            : {}),
        },
        payload,
      );
    },
    "meetings.sync": (payload) =>
      runMeetingSyncJob(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          secrets: deps.secretStore,
          registry: meetingSources,
        },
        payload,
      ),
    "meetings.digest": (payload) =>
      runMeetingDigest(
        {
          prisma: deps.prisma,
          runtime: deps.runtime,
          jobs: deps.jobs,
          resolveModel: deps.executor.resolveModel,
        },
        payload,
      ),
    "mail.attachments": async (payload) => {
      const { mail, artifacts } = deps;
      if (!mail || !artifacts) throw new Error("Mail attachment filing is not configured");
      await runMailAttachmentFiling(
        { prisma: deps.prisma, jobs: deps.jobs, mail, artifacts },
        payload,
      );
    },
    "audit.intake": async (payload) => {
      const { mail, artifacts } = deps;
      if (!mail || !artifacts) throw new Error("Audit intake is not configured");
      await runAuditIntake({ prisma: deps.prisma, jobs: deps.jobs, mail, artifacts }, payload);
    },
    "mail.watch.renew": async () => {
      if (!deps.gmailPush) return;
      if (!deps.mail) throw new Error("Mail sync is not configured");
      await runMailWatchRenewal({ prisma: deps.prisma, mail: deps.mail, push: deps.gmailPush });
    },
    "devin.refresh": async (payload) => {
      if (!deps.devinCallTool) return;
      await runDevinRefreshJob(
        {
          prisma: deps.prisma,
          callTool: deps.devinCallTool,
          notificationEvents: deps.notificationEvents,
        },
        payload,
      );
    },
    "inbox.triage": async (payload) => {
      await runInboxTriage(
        {
          prisma: deps.prisma,
          runtime: deps.runtime,
          jobs: deps.jobs,
          resolveModel: deps.executor.resolveModel,
          classifier: createInboxClassifierProvider(),
        },
        payload,
      );
    },
    "dataroom.blob.delete": async (payload) => {
      if (!deps.artifacts) throw new Error("Artifact store is not configured");
      // The job is queued before the row is deleted. While the row is still there, fail so the
      // queue retries with backoff; the job ends visibly failed if the delete never happened.
      // ponytail: a long row delete outlasting every retry leaks the blob; use a transactional
      // outbox if that ever matters.
      const live = await deps.prisma.dataRoomItem.findFirst({
        where: {
          spaceId: payload.spaceId,
          OR: [{ storageKey: payload.storageKey }, { thumbnailKey: payload.storageKey }],
        },
        select: { id: true },
      });
      if (live) throw new Error("Data room item still references this blob");
      const operationId = `dataroom.blob.delete:${payload.storageKey}`;
      await deps.artifacts.remove(payload.storageKey, {
        operationId,
        traceId: operationId,
        spaceId: payload.spaceId,
        userId: "",
        signal: new AbortController().signal,
      });
    },
    "dataroom.ingest": (payload) => runDataRoomIngest(dataRoomDeps(), payload),
    "dataroom.classify": (payload) => runDataRoomClassify(dataRoomDeps(), payload),
    "dataroom.index": (payload) => runDataRoomIndex(dataRoomDeps(), payload),
    "dataroom.thumbnail": (payload) => runDataRoomThumbnail(dataRoomDeps(), payload),
    "dataroom.zip.unpack": async (payload) => {
      if (!deps.artifacts) throw new Error("Zip import is not configured");
      await runDataRoomZipUnpack(
        { prisma: deps.prisma, jobs: deps.jobs, artifacts: deps.artifacts },
        payload,
        AbortSignal.timeout(DATA_ROOM_STREAM_TIMEOUT_MS),
      );
    },
    "dataroom.drive.import": (payload) =>
      runDriveImport({ prisma: deps.prisma, jobs: deps.jobs }, payload),
    "dataroom.drive.file": async (payload) => {
      if (!deps.artifacts || !deps.connectors) throw new Error("Drive import is not configured");
      await runDriveFileImport(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          artifacts: deps.artifacts,
          connectors: deps.connectors,
        },
        payload,
        AbortSignal.timeout(DATA_ROOM_STREAM_TIMEOUT_MS),
      );
    },
    "dataroom.box.import": (payload) =>
      runBoxImport({ prisma: deps.prisma, jobs: deps.jobs }, payload),
    "dataroom.box.file": async (payload) => {
      if (!deps.artifacts || !deps.boxAccessToken) throw new Error("Box import is not configured");
      await runBoxFileImport(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          artifacts: deps.artifacts,
          box: { accessToken: deps.boxAccessToken },
        },
        payload,
        AbortSignal.timeout(DATA_ROOM_STREAM_TIMEOUT_MS),
      );
    },
    "finance.sync": async (payload) => {
      if (!deps.financeCallToolFor) throw new Error("Finance sync is not configured");
      await syncFinanceForUser(
        { prisma: deps.prisma, callToolFor: deps.financeCallToolFor },
        { spaceId: payload.spaceId, userId: payload.userId },
      );
      // Wallets ride the same periodic job; with no wallets this is a no-op.
      await syncCryptoHoldings(
        { prisma: deps.prisma, secrets: deps.secretStore },
        { spaceId: payload.spaceId, userId: payload.userId },
      );
      // Exchange API-key connections ride the same job; with none this is a no-op.
      await syncExchanges(
        { prisma: deps.prisma, secrets: deps.secretStore },
        { spaceId: payload.spaceId, userId: payload.userId },
      );
    },
    "cloud_agent.poll": async (payload) => {
      await pollCloudAgent(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          events: deps.events,
          cloudAgent: deps.cloudAgent,
        },
        payload,
      );
    },
    "history.compact": async (payload) => {
      // Retrieval policies use stored context without paid message-count compaction.
      // Skip legacy backlog work after a policy change.
      if (deps.executor.contextStrategy && deps.executor.contextStrategy !== "current") return;
      await compactHistory(
        {
          prisma: deps.prisma,
          runtime: deps.runtime,
          jobs: deps.jobs,
          memoryProviders: deps.memoryProviders,
          deploymentModelKey: deps.deploymentModelKey,
          deploymentModelConfigured: deps.deploymentModelConfigured,
          ...(deps.executor.resolveModel ? { resolveModel: deps.executor.resolveModel } : {}),
        },
        payload.threadId,
      );
    },
  };
}
