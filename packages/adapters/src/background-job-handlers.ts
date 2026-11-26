import type {
  AgentHomeStore,
  AgentRuntime,
  ArtifactStore,
  BackgroundJobHandlers,
  ConnectorProvider,
  JobPublisher,
  MailProvider,
  MessagingSurface,
  NotificationChannel,
  SandboxProvider,
  SecretStore,
} from "@rakazo/adapter-kit";
import { messagingDeliverJob } from "@rakazo/adapter-kit";
import type { NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import {
  deleteExpiredMessagingTransport,
  deleteExpiredNotifications,
  runAsSystem,
  runAsTenant,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { cleanupAccountExports, runAccountExport } from "./account-export.js";
import { runAuditIntake } from "./audit-intake.js";
import type { BoxFilesDeps } from "./box-files.js";
import type { CloudAgentConnection } from "./cloud-agent-factory.js";
import { pollCloudAgent } from "./cloud-agent-poll.js";
import type { CompanyImportEngine } from "./company-import-engine.js";
import { expireComputerControl } from "./computer-control.js";
import { scheduleComputerSleep, sleepComputerIfIdle } from "./computer-idle.js";
import { performComputerUpdate } from "./computer-update.js";
import { runContactPhotosJob } from "./contact-photos-job.js";
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
import { runGoalCheck } from "./goal-check.js";
import { GoogleContactPhotoSource } from "./google-contact-photos.js";
import { compactHistory } from "./history-compaction.js";
import { createInboxClassifierProvider } from "./inbox-classifier-factory.js";
import { runInboxTriage, triageReadiness } from "./inbox-triage.js";
import { runMailAttachmentFiling } from "./mail-attachment-filing.js";
import { runMailReplyBatch } from "./mail-reply-batch.js";
import { runMailSyncJob, sweepMailSyncs } from "./mail-sync-job.js";
import { expireMailSearch } from "./mail-tools.js";
import type { McpConnector } from "./mcp-connector.js";
import { runCaptureFinalize, runCaptureSweep, runCaptureTranscribe } from "./meeting-capture.js";
import { runMeetingDigest } from "./meeting-digest.js";
import { runFollowupSweep, runMeetingFollowup } from "./meeting-followup.js";
import { createMeetingSourceRegistry } from "./meeting-source-registry.js";
import type { MeetingSourceRegistry } from "./meeting-sync-job.js";
import { runMeetingSyncJob } from "./meeting-sync-job.js";
import type { MemoryProviderResolver } from "./memory-provider-factory.js";
import { deliverMessagingOutbound, mirrorMessagingOutbound } from "./messaging-delivery.js";
import { deliverDueNotifications } from "./notification-outbox.js";
import { runOmiAssemble } from "./omi-assemble.js";
import { runOmiSort } from "./omi-sort.js";
import { runOmiTranscribe } from "./omi-transcribe.js";
import { runPageRefreshTick, runPageSnapshotRetention } from "./page-source-tick.js";
import { renderPdfPages } from "./pdf-render.js";
import { runPipelineAutoStatus, sweepPipelineAutoStatus } from "./pipeline-auto-status.js";
import { runPipelineImport } from "./pipeline-import-tools.js";
import { syncCryptoHoldings } from "./rpc-crypto-sync.js";
import { describeTeachSteps } from "./teach-steps.js";
import { expireTaughtSkillTeaching } from "./teaching-session.js";
import { renderThumbnail } from "./thumbnail-render.js";
import { runWatchProbeTick } from "./watch-probe.js";

type Tenant = { spaceId: string; userId: string };

/**
 * A job that acts for one run, routine, computer, skill, thread or cloud agent
 * runs as that row's tenant, so row-level security keeps it, and every tool it runs, in
 * the owner's Space even where a query forgets to filter. The owner comes from one
 * narrow system read; when the row is gone there is nothing left to act on.
 */
function asOwner<Key, P extends Key>(
  owner: (payload: Key) => Promise<Tenant | null>,
  handler: (payload: P) => Promise<void>,
): (payload: P) => Promise<void> {
  return async (payload) => {
    const tenant = await runAsSystem("find the tenant a background job acts for", () =>
      owner(payload),
    );
    if (tenant) await runAsTenant(tenant, () => handler(payload));
  };
}

/** A job whose payload names the Space and user it acts for runs as that tenant. */
function asPayloadTenant<P extends Tenant, R = void>(
  handler: (payload: P) => Promise<R> | R,
): (payload: P) => Promise<R> {
  return (payload) =>
    runAsTenant({ spaceId: payload.spaceId, userId: payload.userId }, async () => handler(payload));
}

const OWNER = { spaceId: true, userId: true } as const;

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
  /** Needed for connected-app watches; without it they pause. */
  connector?: ConnectorProvider;
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
  companyImport?: CompanyImportEngine;
  /** From the deployment; board_tickets is only a page source where the ticket board is on. */
  ticketBoardEnabled?: boolean;
  /** Needed for mcp page sources; without it they record an error. */
  mcp?: Pick<McpConnector, "callServerTool" | "listServerTools">;
}): BackgroundJobHandlers {
  const messagingDeps = deps.messaging
    ? { prisma: deps.prisma, messaging: deps.messaging, events: deps.events, jobs: deps.jobs }
    : undefined;
  // The outbox holds every Space's pending sends, so draining it is cross-tenant.
  const drainMessaging = async () => {
    if (!messagingDeps) return;
    await runAsSystem("drain the messaging outbox across Spaces", () =>
      deliverMessagingOutbound(
        messagingDeps,
        {},
        {
          operationId: "messaging.deliver:drain",
          traceId: "messaging.deliver:drain",
          spaceId: "",
          userId: "",
          signal: new AbortController().signal,
        },
      ),
    );
  };
  const run = ({ runId }: { runId: string }) =>
    deps.prisma.run.findUnique({ where: { id: runId }, select: OWNER });
  const routine = ({ routineId }: { routineId: string }) =>
    deps.prisma.routine.findUnique({ where: { id: routineId }, select: OWNER });
  const computer = ({ computerId }: { computerId: string }) =>
    deps.prisma.computer.findUnique({ where: { id: computerId }, select: OWNER });
  const thread = ({ threadId }: { threadId: string }) =>
    deps.prisma.thread.findUnique({ where: { id: threadId }, select: OWNER });
  const goal = ({ goalId }: { goalId: string }) =>
    deps.prisma.threadGoal.findUnique({ where: { id: goalId }, select: OWNER });
  const skill = ({ skillId }: { skillId: string }) =>
    deps.prisma.taughtSkill.findUnique({ where: { id: skillId }, select: OWNER });
  const cloudAgent = ({ agentId }: { agentId: string }) =>
    deps.prisma.cloudAgent.findUnique({ where: { id: agentId }, select: OWNER });
  const mailSearch = ({ searchId }: { searchId: string }) =>
    deps.prisma.mailSearch.findUnique({ where: { id: searchId }, select: OWNER });
  const updatedComputer = async ({ updateId }: { updateId: string }) =>
    (
      await deps.prisma.computerUpdate.findUnique({
        where: { id: updateId },
        select: { computer: { select: OWNER } },
      })
    )?.computer ?? null;

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

  const meetingSources =
    deps.meetingSources ??
    createMeetingSourceRegistry(
      deps.mcp ? { mcp: { prisma: deps.prisma, connector: deps.mcp } } : {},
    );

  return {
    "run.continue": asOwner(run, async (payload) => {
      await deps.executor.continueRun(payload.runId, deps.workerId);
      // Automatic messaging mirror: once the run's bot messages are durable,
      // copy them into the outbox. Never let mirror failures fail the run.
      if (messagingDeps) {
        await mirrorMessagingOutbound(messagingDeps, payload.runId);
        await deps.jobs.enqueue(messagingDeliverJob()).catch(async (error) => {
          getLogger().error("messaging.deliver enqueue error", error);
          await drainMessaging();
        });
      }
    }),
    "messaging.deliver": async ({ runId }) => {
      if (runId && messagingDeps) {
        await asOwner(run, () => mirrorMessagingOutbound(messagingDeps, runId))({ runId });
      }
      await drainMessaging();
    },
    "routine.wakeup": asOwner(routine, async (payload) => {
      await deps.executor.wakeRoutine(payload.routineId, payload.scheduledFor);
    }),
    "routine.retry": asOwner(run, async (payload) => {
      await deps.executor.retryRoutineRun(payload.runId);
    }),
    "computer.update": asOwner(updatedComputer, async ({ updateId }) => {
      await performComputerUpdate(deps, updateId);
    }),
    "computer.sleep": asOwner(computer, async (payload) => {
      await sleepComputerIfIdle(deps, payload.computerId);
    }),
    "computer.control-expire": asOwner(computer, async (payload) => {
      if (await expireComputerControl(deps, payload.computerId, payload.leaseId)) {
        scheduleComputerSleep(deps.jobs, payload.computerId);
      }
    }),
    "skill.teaching-expire": asOwner(skill, async (payload) => {
      await expireTaughtSkillTeaching(
        {
          ...deps,
          secrets: deps.secretStore,
          describeSteps: (input) =>
            describeTeachSteps(
              {
                prisma: deps.prisma,
                runtime: deps.runtime,
                resolveModel: deps.executor.resolveModel,
              },
              input,
            ),
        },
        payload.skillId,
      );
    }),
    // Outbox, retention and renewal sweeps cover every Space and run as system.
    "notifications.deliver": async () => {
      await deliverDueNotifications({
        prisma: deps.prisma,
        channels: deps.notificationChannels ?? [],
      });
    },
    "notifications.retention": async () => {
      await deleteExpiredNotifications(deps.prisma);
    },
    // An export gathers the user's rows from every Space they belong to, so it runs as system.
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
    "mail.search.expire": asOwner(mailSearch, async (payload) => {
      await expireMailSearch(deps.prisma, payload.searchId);
    }),
    "mail.reply.batch": asPayloadTenant((payload) => {
      const { mail } = deps;
      if (!mail) throw new Error("Mail is not configured");
      return runMailReplyBatch(
        {
          prisma: deps.prisma,
          mail,
          jobs: deps.jobs,
          events: deps.events,
          mailWritesDisabled: deps.mailWritesDisabled,
        },
        payload,
      );
    }),
    "pipeline.import": asPayloadTenant((payload) =>
      runPipelineImport({ prisma: deps.prisma, jobs: deps.jobs, events: deps.events }, payload),
    ),
    "pipeline.auto_status": asPayloadTenant(async (payload) => {
      await runPipelineAutoStatus(
        {
          prisma: deps.prisma,
          ...(deps.connectors ? { connectors: deps.connectors } : {}),
        },
        payload,
      );
    }),
    "pipeline.auto_status.sweep": async () => {
      await sweepPipelineAutoStatus({ prisma: deps.prisma, jobs: deps.jobs });
    },
    "mail.sync": asPayloadTenant((payload) => {
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
    }),
    "meetings.sync": asPayloadTenant((payload) =>
      runMeetingSyncJob(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          secrets: deps.secretStore,
          registry: meetingSources,
        },
        payload,
      ),
    ),
    "meetings.digest": asPayloadTenant((payload) =>
      runMeetingDigest(
        {
          prisma: deps.prisma,
          runtime: deps.runtime,
          jobs: deps.jobs,
          resolveModel: deps.executor.resolveModel,
        },
        payload,
      ),
    ),
    "meetings.followup": asPayloadTenant(async (payload) => {
      if (!deps.artifacts) throw new Error("Artifact store is not configured");
      await runMeetingFollowup(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          artifacts: deps.artifacts,
          resolveModel: deps.executor.resolveModel,
        },
        payload,
      );
    }),
    "mail.attachments": asPayloadTenant(async (payload) => {
      const { mail, artifacts } = deps;
      if (!mail || !artifacts) throw new Error("Mail attachment filing is not configured");
      await runMailAttachmentFiling(
        { prisma: deps.prisma, jobs: deps.jobs, mail, artifacts },
        payload,
      );
    }),
    "contacts.photos": asPayloadTenant(async (payload) => {
      // Without the Google connector or the blob store there is nothing to fetch with or into.
      if (!deps.artifacts || !deps.connectors) return;
      await runContactPhotosJob(
        {
          prisma: deps.prisma,
          artifacts: deps.artifacts,
          source: new GoogleContactPhotoSource({ connectors: deps.connectors }),
        },
        payload,
      );
    }),
    "mail.sync.sweep": async () => {
      await sweepMailSyncs({ prisma: deps.prisma, jobs: deps.jobs });
    },
    "audit.intake": asPayloadTenant(async (payload) => {
      const { mail, artifacts } = deps;
      if (!mail || !artifacts) throw new Error("Audit intake is not configured");
      await runAuditIntake({ prisma: deps.prisma, jobs: deps.jobs, mail, artifacts }, payload);
    }),
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
    "inbox.triage": asPayloadTenant(async (payload) => {
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
    }),
    "meetings.capture_transcribe": asPayloadTenant((payload) => {
      if (!deps.artifacts) throw new Error("Artifact store is not configured");
      return runCaptureTranscribe(
        {
          prisma: deps.prisma,
          artifacts: deps.artifacts,
          secrets: deps.secretStore,
          jobs: deps.jobs,
        },
        payload,
      );
    }),
    "meetings.capture_finalize": asPayloadTenant((payload) =>
      runCaptureFinalize(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          ...(deps.artifacts ? { artifacts: deps.artifacts } : {}),
        },
        payload,
      ),
    ),
    "meetings.capture_sweep": async () => {
      await runCaptureSweep({ prisma: deps.prisma, jobs: deps.jobs });
      await runFollowupSweep({ prisma: deps.prisma, jobs: deps.jobs });
    },
    "omi.assemble": asPayloadTenant(async (payload) => {
      if (!deps.artifacts) throw new Error("Artifact store is not configured");
      await runOmiAssemble(
        { prisma: deps.prisma, jobs: deps.jobs, artifacts: deps.artifacts },
        payload,
      );
    }),
    "omi.transcribe": asPayloadTenant((payload) => {
      if (!deps.artifacts) throw new Error("Artifact store is not configured");
      return runOmiTranscribe(
        {
          prisma: deps.prisma,
          artifacts: deps.artifacts,
          secrets: deps.secretStore,
          jobs: deps.jobs,
        },
        payload,
      );
    }),
    "omi.sort": asPayloadTenant((payload) =>
      runOmiSort({ ...dataRoomDeps(), runtime: deps.runtime }, payload),
    ),
    "dataroom.blob.delete": async (payload) =>
      runAsTenant({ spaceId: payload.spaceId, userId: "" }, async () => {
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
      }),
    "dataroom.ingest": asPayloadTenant((payload) => runDataRoomIngest(dataRoomDeps(), payload)),
    "dataroom.classify": asPayloadTenant((payload) => runDataRoomClassify(dataRoomDeps(), payload)),
    "dataroom.index": asPayloadTenant((payload) => runDataRoomIndex(dataRoomDeps(), payload)),
    "dataroom.thumbnail": asPayloadTenant((payload) =>
      runDataRoomThumbnail(dataRoomDeps(), payload),
    ),
    "dataroom.zip.unpack": asPayloadTenant(async (payload) => {
      if (!deps.artifacts) throw new Error("Zip import is not configured");
      await runDataRoomZipUnpack(
        { prisma: deps.prisma, jobs: deps.jobs, artifacts: deps.artifacts },
        payload,
        AbortSignal.timeout(DATA_ROOM_STREAM_TIMEOUT_MS),
      );
    }),
    "dataroom.drive.import": asPayloadTenant((payload) =>
      runDriveImport({ prisma: deps.prisma, jobs: deps.jobs }, payload),
    ),
    "dataroom.drive.file": asPayloadTenant(async (payload) => {
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
    }),
    "dataroom.box.import": asPayloadTenant((payload) =>
      runBoxImport({ prisma: deps.prisma, jobs: deps.jobs }, payload),
    ),
    "dataroom.box.file": asPayloadTenant(async (payload) => {
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
    }),
    "finance.sync": asPayloadTenant(async (payload) => {
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
    }),
    "cloud_agent.poll": asOwner(cloudAgent, async (payload) => {
      await pollCloudAgent(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          events: deps.events,
          cloudAgent: deps.cloudAgent,
        },
        payload,
      );
    }),
    "company.import.run": asPayloadTenant(async (payload) => {
      if (!deps.companyImport) throw new Error("Company import engine is not configured");
      await deps.companyImport.runJob(payload);
    }),
    "company.import.unit": asPayloadTenant(async (payload) => {
      if (!deps.companyImport) throw new Error("Company import engine is not configured");
      await deps.companyImport.unitJob(payload);
    }),
    "company.import.recover": async () => {
      if (!deps.companyImport) throw new Error("Company import engine is not configured");
      await deps.companyImport.recoveryJob();
    },
    "company.refresh.tick": async () => {
      if (!deps.companyImport) throw new Error("Company import engine is not configured");
      await deps.companyImport.refreshTick();
    },
    "watch.probe": async () => {
      await runWatchProbeTick({
        prisma: deps.prisma,
        jobs: deps.jobs,
        connector: deps.connector,
        events: deps.events,
        notificationEvents: deps.notificationEvents,
      });
    },
    "pages.refresh.tick": async () => {
      await runPageRefreshTick({
        prisma: deps.prisma,
        events: deps.events,
        jobs: deps.jobs,
        ticketBoardEnabled: deps.ticketBoardEnabled,
        mcp: deps.mcp,
        secretStore: deps.secretStore,
      });
    },
    "pages.snapshots.retention": async () => {
      await runPageSnapshotRetention(deps.prisma);
    },
    "goal.check": asOwner(goal, async (payload) => {
      await runGoalCheck(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          events: deps.events,
          notificationEvents: deps.notificationEvents,
          runtime: deps.runtime,
          ...(deps.executor.resolveModel ? { resolveModel: deps.executor.resolveModel } : {}),
        },
        payload,
      );
    }),
    "history.compact": asOwner(thread, async (payload) => {
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
    }),
  };
}
