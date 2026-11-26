import { randomUUID } from "node:crypto";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type {
  AgentContextStrategy,
  AgentRuntime,
  BillingProvider,
  JobPublisher,
  ManagedConnectorProvider,
  MessagingInboundEvent,
  MessagingSurface,
  RealtimeFanout,
  SandboxProvider,
  TransactionalEmailProvider,
} from "@rakazo/adapter-kit";
import { dataRoomBlobDeleteJob } from "@rakazo/adapter-kit";
import type {
  ComposioProvider,
  ConnectorRegistry,
  DestinationEmulator,
  FinanceSyncDeps,
  MeetingSourceRegistry,
  RemoteConnectorDependencies,
} from "@rakazo/adapters";
import {
  applyMessagingOutboundStatus,
  boxAccessToken,
  ChatSdkMessagingSurface,
  CodexCatalogCache,
  ComposioConnector,
  createAgentHomeStore,
  createAppControlProvider,
  createArtifactStore,
  createBackgroundJobHandlers,
  createBlueBubblesPollState,
  createCloudAgentConnection,
  createCompanyConnectionReader,
  createCompanyDocumentReader,
  createCompanyImportEngine,
  createCompanySlackReader,
  createCompanySourceWorker,
  createCompanyTrackerReader,
  createConnectorStack,
  createDevinCallTool,
  createFinanceCallToolFor,
  createGmailPushVerifier,
  createJobReconciler,
  createMailProvider,
  createMailUnsubscriber,
  createMeetingSourceRegistry,
  createMessagingContextLoader,
  createMessagingTeamChatSender,
  createPushChannel,
  createRpcClient,
  createRunExecutor,
  createRunSandbox,
  createRunSecretWriter,
  createRuntimeExtract,
  createSafeCallToolFor,
  createSecretStore,
  createTicketChangeNotifier,
  createWebProvider,
  deleteExpiredTeachData,
  describeTeachSteps,
  destroyBot,
  EmailEmulator,
  GraphileJobPublisher,
  gmailPushConfigFromEnv,
  ImessageNotificationChannel,
  InMemoryJobQueue,
  InMemoryRealtimeFanout,
  InstalledConnectorProvider,
  IntegrationProviderSettings,
  isComposioEnabled,
  isMessagingSurfaceEnabled,
  isPipedreamEnabled,
  LlmCompanyExtractor,
  LlmDataRoomClassifier,
  McpConnector,
  McpOAuthBroker,
  MessagingSettings,
  messagingPlatformsFromEnv,
  PiAgentRuntime,
  PiOAuthLogins,
  PipedreamConnector,
  PostgresRealtimeFanout,
  parseStatement,
  pipedreamConfigFromEnv,
  piSessionsRoot,
  reconcileCloudAgents,
  reconcileComputerUpdates,
  reconcileMeetingSyncs,
  removePiUserSessions,
  resolveEnsName,
  reviewAttachment,
  runPageRefreshTick,
  runWatchProbeTick,
  ScriptedAgentRuntime,
  SmtpEmailProvider,
  SpaceMemoryProviderResolver,
  StripeBillingProvider,
  sandboxProviderOptionsFromEnv,
  stripeBillingConfigFromEnv,
  summarizePerson,
  syncCryptoHoldings,
  toTeamChatInbound,
  triageStatus,
  wakeMailConnections,
  withSecretPersistence,
} from "@rakazo/adapters";
import { createAuth, isBlockedAuthPath, loopbackTwinOrigins } from "@rakazo/auth";
import type { Actor, AuthCapabilities } from "@rakazo/contracts";
import { signupAllowlistBootUpdate, signupPolicyFromEnv } from "@rakazo/core";
import type { Pool, PrismaClient } from "@rakazo/db";
import {
  createBoardEvents,
  createDb,
  createNotificationEvents,
  createPool,
  createThreadEvents,
  describeRowSecurity,
  endSessionPushTokens,
  IsolationError,
  isDatabaseInterruption,
  PostgresAppControlStore,
  parsePositiveInteger,
  provisionMessagingIdentity,
  pushSessionExpiresAt,
  recordUsage,
  requireMembership,
  rowSecurityWarning,
  runAsSystem,
} from "@rakazo/db";
import type { Logger } from "@rakazo/logging";
import {
  createServiceLogger,
  enrichLogContext,
  getLogger,
  installLogger,
  SERVICE_NAMES,
} from "@rakazo/logging";
import { requestLogging } from "@rakazo/logging/hono";
import { MarkdownMemoryStore } from "@rakazo/memory";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { mountAccountExportDownload } from "./account-export.js";
import { upgradeBuiltInAgentInstructions } from "./agent-instruction-upgrades.js";
import { mountArtifactShare, prismaShareStore } from "./artifact-share.js";
import { createBillingService } from "./billing.js";
import { mountBillingRoutes } from "./billing-webhook.js";
import { createCompanyImportPage } from "./company-import-page.js";
import { mountContactPhoto } from "./contact-photo.js";
import { mountDataRoomRoutes } from "./data-room.js";
import { handleHttpError, withRetryAfter } from "./database-unavailable.js";
import { mountEmailImageProxy } from "./email-image-proxy.js";
import type { AppEnv } from "./env.js";
import { loadEnv } from "./env.js";
import { nativeReturnRoutes } from "./native-return.js";
import type { GtmQueueReader } from "./gtm.js";
import { healthRoutes } from "./health.js";
import { trackInFlightRequests } from "./in-flight-requests.js";
import { mountInboxAttachment } from "./inbox-attachment.js";
import { upgradeIntegrationAgentInstructions } from "./integration-agent-upgrades.js";
import {
  mountInvestorPortal,
  PORTAL_PATH,
  portalNoStore,
  prismaPortalStore,
} from "./investor-portal.js";
import { mountLocalSettings } from "./local-settings.js";
import { mountMailPushRoute } from "./mail-push.js";
import { mountRegisterLimit } from "./mcp-register-limit.js";
import { mountMcpDiscovery, mountMcpServer } from "./mcp-server.js";
import { mountMeetingCaptureRoutes } from "./meeting-captures.js";
import {
  createMessagingInboundHandler,
  teamChatSenderCanWakeMessageRoutines,
  wakeMessageRoutines,
} from "./messaging-inbound.js";
import { mountMessagingWebhookRoutes } from "./messaging-webhook.js";
import { mountOmiRoutes } from "./omi.js";
import { limitRpcBody, mountApiRequestBodyLimits } from "./request-body-limit.js";
import { mountSystemRoutes, mountTenantRoutes } from "./route-scope.js";
import { createRouter } from "./router.js";
import type { RouteAuthContext } from "./routes/context.js";
import { mountScreenTarget } from "./screen-proxy.js";
import { isDeferredReservationLost, TeamChatBridge } from "./team-chat-bridge.js";
import { ModelTeamChatEngagementJudge } from "./team-chat-judge.js";
import {
  PendingTeamChatInbound,
  prefersTeamChatSurface,
  settleWithTimeout,
  TEAM_CHAT_STARTUP_SHUTDOWN_MS,
} from "./team-chat-startup.js";
import { mountVoiceHttpRoutes } from "./voice.js";
import { mountWebhookHttpRoutes } from "./webhook.js";

/**
 * Native clients always send the app scheme, including in Expo Go, so no
 * exp:// origin is trusted: it would accept any Expo host as a redirect target.
 * The loopback entries are the Expo web dev server.
 */
export const MOBILE_AUTH_ORIGINS = [
  "rakazo://",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

// Deploys give the old API 30 seconds to stop before killing it.
const REQUEST_DRAIN_MS = 20_000;

export interface AppHandles {
  app: Hono;
  prisma: PrismaClient;
  jobs: JobPublisher;
  sandbox: SandboxProvider;
  connector: DestinationEmulator;
  composio?: ComposioProvider;
  connectors: ConnectorRegistry;
  messaging?: MessagingSurface;
  email?: TransactionalEmailProvider;
  executor: ReturnType<typeof createRunExecutor>;
  runtime: AgentRuntime;
  awaitIdle?: () => Promise<void>;
  backgroundFailures?: () => Array<{ name: string; count: number }>;
  stop: () => Promise<void>;
}

// Startup and everything it schedules (pollers, team chat, the in-memory job
// queue, retries) runs across tenants. Requests start without a context and get
// one per route: tenant for signed-in procedures, system for auth and webhooks.
export function createApp(overrides: CreateAppOverrides = {}): Promise<AppHandles> {
  return runAsSystem("api startup and background work", () => buildApp(overrides));
}

type CreateAppOverrides = Partial<AppEnv> & {
  prisma?: PrismaClient;
  realtime?: RealtimeFanout;
  sandbox?: SandboxProvider;
  composio?: ComposioProvider;
  pipedream?: ManagedConnectorProvider;
  messaging?: MessagingSurface;
  email?: TransactionalEmailProvider;
  billing?: BillingProvider;
  remoteConnectors?: RemoteConnectorDependencies;
  logger?: Logger;
  runtime?: AgentRuntime;
  contextStrategy?: AgentContextStrategy;
  /** Replaces the Mercury and Brex tool caller, so a stack with canned finance data can run offline. */
  financeCallToolFor?: FinanceSyncDeps["callToolFor"];
  /** Replaces the network for wallet balances, prices, ENS and exchange reads, so canned crypto data runs offline. */
  cryptoFetch?: typeof fetch;
  /** Replaces the real meeting providers, so the demo and tests run Granola against its emulator. */
  meetingSources?: MeetingSourceRegistry;
  /** Points the in-process Brex cards server at an emulator instead of api.brex.com. */
  brexApi?: { baseUrl?: string; fetch?: typeof fetch };
  /** Offline acceptance seams limited to GTM account and queue reads. */
  gtmQueueReader?: GtmQueueReader;
  gtmMcp?: Pick<McpConnector, "callServerTool">;
  /** Replaces the Google connector, so the demo stack reads Calendar from an emulator. */
  google?: ManagedConnectorProvider;
};

async function buildApp(overrides: CreateAppOverrides): Promise<AppHandles> {
  const {
    prisma: prismaOverride,
    realtime: realtimeOverride,
    sandbox: sandboxOverride,
    composio: composioOverride,
    pipedream: pipedreamOverride,
    messaging: messagingOverride,
    email: emailOverride,
    billing: billingOverride,
    remoteConnectors,
    logger: loggerOverride,
    runtime: runtimeOverride,
    contextStrategy,
    financeCallToolFor: financeCallToolOverride,
    cryptoFetch,
    meetingSources,
    brexApi,
    gtmQueueReader,
    gtmMcp,
    google: googleOverride,
    ...envOverrides
  } = overrides;
  const env = { ...loadEnv(process.env), ...envOverrides };
  const logger = loggerOverride ?? createServiceLogger({ service: SERVICE_NAMES.api });
  installLogger(logger);
  const created = prismaOverride
    ? { prisma: prismaOverride, pool: undefined }
    : createDb(env.databaseUrl, {
        poolMax: parsePositiveInteger(process.env.DB_POOL_MAX, 4),
        applicationName: "rakazo-api",
      });
  let { prisma } = created;
  const rowSecurity = rowSecurityWarning(await describeRowSecurity(prisma));
  if (rowSecurity) logger.warn(rowSecurity);
  const realtime =
    realtimeOverride ??
    (created.pool
      ? new PostgresRealtimeFanout({
          connectionString: env.realtimeDatabaseUrl,
          publisher: created.pool,
        })
      : new InMemoryRealtimeFanout());
  const secrets = createSecretStore(env.encryptionKey, process.env, realtime);
  await secrets.start();
  if (secrets.describe().capabilities.degraded)
    logger.warn("Secret storage degraded; encrypted credentials remain available");
  prisma = withSecretPersistence(prisma, secrets);
  const events = createThreadEvents(prisma, realtime, {
    runSecretWriter: createRunSecretWriter(secrets),
  });
  const ticketBoardEnabled = env.ticketBoardEnabled;
  const boardEvents = createBoardEvents(realtime);
  const notificationEvents = createNotificationEvents(realtime);
  const environmentSignupPolicy = signupPolicyFromEnv(env);
  // Not awaited: a slow or failed upgrade leaves agents on their old text but never delays startup.
  void upgradeBuiltInAgentInstructions(prisma).then(
    (counts) => logger.info("built-in agent instructions upgraded", counts),
    (error: unknown) =>
      logger.warn("built-in agent instruction upgrade failed", {
        reason: error instanceof Error ? error.name : "error",
      }),
  );
  void upgradeIntegrationAgentInstructions(prisma).then(
    (upgraded) => logger.info("integration agent instructions upgraded", { upgraded }),
    (error: unknown) =>
      logger.warn("integration agent instruction upgrade failed", {
        reason: error instanceof Error ? error.name : "error",
      }),
  );
  const deploymentSettings = await prisma.deploymentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      signupsEnabled: environmentSignupPolicy.enabled,
      signupAllowlist: environmentSignupPolicy.allowlist.join(","),
      signupPolicyInitialized: true,
    },
    update: {},
  });
  if (!deploymentSettings.signupPolicyInitialized) {
    // Older versions created this row with schema defaults even though auth
    // still enforced the environment policy. Copy that effective policy once
    // so upgrades preserve behavior. Later starts reapply a non-empty
    // SIGNUP_ALLOWLIST; a blank value leaves the stored list alone.
    await prisma.deploymentSettings.updateMany({
      where: { id: "default", signupPolicyInitialized: false },
      data: {
        signupsEnabled: environmentSignupPolicy.enabled,
        signupAllowlist: environmentSignupPolicy.allowlist.join(","),
        signupPolicyInitialized: true,
      },
    });
  } else {
    const signupAllowlist = signupAllowlistBootUpdate(
      deploymentSettings.signupAllowlist,
      env.signupAllowlist,
      true,
    );
    if (signupAllowlist !== null) {
      await prisma.deploymentSettings.update({
        where: { id: "default" },
        data: { signupAllowlist },
      });
      logger.info("applied SIGNUP_ALLOWLIST from the environment");
    }
  }

  const jobKind = env.wakeupDriver;
  const inMemoryJobs = jobKind === "memory" ? new InMemoryJobQueue() : undefined;
  // prismaOverride skips createDb, so there is no shared pool. The previous
  // GraphileJobPublisher(databaseUrl) path opened its own connections; keep a
  // bounded pool for that override path instead of passing undefined.
  let ownedJobPool: Pool | undefined;
  if (!inMemoryJobs && !created.pool) {
    ownedJobPool = createPool(env.databaseUrl, {
      poolMax: parsePositiveInteger(process.env.DB_POOL_MAX, 4),
      applicationName: "rakazo-api-jobs",
    });
  }
  const jobPool = created.pool ?? ownedJobPool;
  const jobs = inMemoryJobs
    ? inMemoryJobs
    : new GraphileJobPublisher(
        jobPool ??
          (() => {
            throw new Error("Graphile job publisher requires a PostgreSQL pool");
          })(),
      );
  const ticketChanges = createTicketChangeNotifier({
    boardEvents,
    jobs,
    prisma,
    ticketBoardEnabled,
  });
  const sandbox: SandboxProvider =
    sandboxOverride ??
    createRunSandbox(env.sandboxProvider, {
      ...sandboxProviderOptionsFromEnv(),
      supervisorUrl: env.sandboxSupervisorUrl,
      supervisorToken: env.sandboxSupervisorToken,
      e2bApiKey: env.e2bApiKey,
      daytonaApiKey: env.daytonaApiKey,
      daytonaApiUrl: env.daytonaApiUrl,
      daytonaTarget: env.daytonaTarget,
      boxApiKey: env.boxApiKey,
      boxApiUrl: env.boxApiUrl,
      dataDir: env.dataDir,
      prisma,
    });
  // Local desktop control: absent unless APP_CONTROL_PROVIDER is set (docs/local-desktop-control).
  const appControlStore = new PostgresAppControlStore(prisma);
  const appControl = createAppControlProvider(process.env, {
    dataDir: env.dataDir,
    store: appControlStore,
  });
  const mcpOAuth = new McpOAuthBroker(
    prisma,
    secrets,
    remoteConnectors,
    env.mcpAllowPrivateEndpoint,
  );
  const memoryProviders = new SpaceMemoryProviderResolver(prisma, secrets);
  const oauthLogins = new PiOAuthLogins();
  const artifacts = createArtifactStore(process.env, env.dataDir);
  const home = createAgentHomeStore(process.env, prisma, artifacts, env.dataDir);
  const memory = new MarkdownMemoryStore(prisma);
  const mcp = new McpConnector(
    prisma,
    secrets,
    {
      stdioEnabled: env.mcpStdioEnabled,
      allowedCommands: env.mcpStdioAllowedCommands,
      network: remoteConnectors,
      events,
      allowPrivateEndpoint: env.mcpAllowPrivateEndpoint,
      ...(brexApi ? { brexApi } : {}),
    },
    mcpOAuth,
  );
  const pipedreamConfig = pipedreamConfigFromEnv(env);
  const pipedream =
    pipedreamOverride ??
    (isPipedreamEnabled(pipedreamConfig) ? new PipedreamConnector(pipedreamConfig) : undefined);
  // This process registers the inbound sink (messaging.onInbound below),
  // so it's the one that must hold Telegram's live getUpdates connection —
  // see messagingPlatformsFromEnv's docstring for why a second poller
  // elsewhere (e.g. the worker) would actively break this.
  const messagingSettings = new MessagingSettings(prisma, secrets, {
    env,
    apiUrl: env.apiUrl,
  });
  const messagingPlatforms = messagingPlatformsFromEnv(await messagingSettings.withSaved(), {
    pollInboundMessages: true,
    bluebubblesPollState: createBlueBubblesPollState(prisma),
  });
  const messaging =
    messagingOverride ??
    (isMessagingSurfaceEnabled(messagingPlatforms, {
      deploymentModelConfigured: env.deploymentModelConfigured,
      openSignup: env.messagingOpenSignup,
    })
      ? new ChatSdkMessagingSurface(messagingPlatforms)
      : undefined);
  const localEmailEmulator =
    !emailOverride && !env.smtpUrl && env.emailEmulator
      ? new EmailEmulator((message) => {
          getLogger().info("email emulator captured message", {
            "email.subject": message.subject,
          });
        })
      : undefined;
  if (localEmailEmulator && !isLoopbackHost(env.apiHost)) {
    throw new Error("EMAIL_EMULATOR requires API_HOST to be a loopback host");
  }
  const email: TransactionalEmailProvider | undefined =
    emailOverride ??
    (env.smtpUrl
      ? new SmtpEmailProvider({ url: env.smtpUrl, from: env.emailFrom ?? "" })
      : localEmailEmulator);
  const stripeBilling = stripeBillingConfigFromEnv(env);
  const billingProvider: BillingProvider | undefined =
    billingOverride ?? (stripeBilling ? new StripeBillingProvider(stripeBilling) : undefined);
  const billing = billingProvider
    ? createBillingService({ prisma, provider: billingProvider, webOrigin: env.webOrigin })
    : undefined;
  const installed = new InstalledConnectorProvider(
    prisma,
    secrets,
    remoteConnectors,
    env.mcpAllowPrivateEndpoint,
  );
  const integrationSettings = new IntegrationProviderSettings(
    prisma,
    secrets,
    env.encryptionKey,
    {
      composio:
        composioOverride ??
        (isComposioEnabled(env.composioApiKey)
          ? new ComposioConnector(env.composioApiKey)
          : undefined),
      pipedream,
    },
    undefined,
    new URL("/integrations/google/callback", env.webOrigin).toString(),
  );
  const stack = createConnectorStack(false, composioOverride, [
    installed,
    ...integrationSettings
      .providers()
      .filter((provider) => !composioOverride || provider.describe().id !== "composio")
      .filter((provider) => !googleOverride || provider.describe().id !== "google"),
    ...(googleOverride ? [googleOverride] : []),
    mcp,
  ]);
  const connector = stack.destination;
  // One instance serves the Inbox handlers (and the mail tools that reuse it later).
  const mail = createMailProvider({ prisma, connectors: stack.connector });
  const gmailPush = gmailPushConfigFromEnv(process.env, env.webOrigin);
  await connector.start();
  integrationSettings.warmDirectories();
  const runtime =
    runtimeOverride ??
    (env.agentRuntime === "scripted"
      ? new ScriptedAgentRuntime()
      : new PiAgentRuntime({
          sessionRoot: env.piSessionRecording ? piSessionsRoot(env.dataDir) : undefined,
        }));
  const notifications = createPushChannel(
    prisma,
    (sessionId) => pushSessionExpiresAt(prisma, sessionId),
    process.env,
  );
  // Localhost needs no setting: MCP clients reach the API where it listens.
  const mcpBaseUrl = (env.publicMcpUrl ?? env.apiUrl).replace(/\/+$/, "");
  const auth = createAuth(prisma, {
    passwordAuth: env.passwordAuth,
    oidc: env.oidc,
    secret: env.authSecret,
    baseURL: env.authUrl,
    webOrigin: env.webOrigin,
    mcp: {
      issuer: mcpBaseUrl,
      resource: `${mcpBaseUrl}/mcp`,
      webOrigin: env.webOrigin,
      onNotice: (owner, notice) =>
        notificationEvents.notify(owner, {
          id: notice.id,
          surface: "mcp",
          importance: notice.importance,
        }),
    },
    signupsEnabled: env.signupsEnabled,
    signupAllowlist: env.signupAllowlist,
    email,
    onEmailError: (error) => getLogger().error("transactional email delivery failed", error),
    extraOrigins: [...MOBILE_AUTH_ORIGINS, ...env.trustedOrigins],
    beforeDeleteUser: async (userId) => {
      // First, so a provider failure aborts deletion before anything is destroyed.
      await billing?.cancelForDeletedUser(userId);
      const bots = await prisma.bot.findMany({
        where: { userId },
        select: { id: true, userId: true, spaceId: true, name: true, archivedAt: true },
      });
      await Promise.all(
        bots.map((bot) =>
          destroyBot(
            { prisma, sandbox, home, jobs, artifacts, dataDir: env.dataDir },
            bot,
            {
              operationId: `account-delete:${userId}`,
              traceId: `account-delete:${userId}`,
              spaceId: bot.spaceId,
              userId,
              botId: bot.id,
              signal: new AbortController().signal,
            },
            { deleteMemories: true },
          ),
        ),
      );
      await removePiUserSessions(env.dataDir, userId);
    },
    afterDeleteUserData: async (blobs, homes, userId) => {
      for (const { spaceId, storageKey } of blobs) {
        await jobs
          .enqueue(dataRoomBlobDeleteJob(spaceId, storageKey))
          .catch((error) => getLogger().error("data room blob cleanup", error));
      }
      for (const { spaceId, homeKey, ...deletedRow } of homes) {
        const context = {
          operationId: `account-delete-home:${homeKey}`,
          traceId: `account-delete:${userId}`,
          spaceId,
          userId,
          signal: new AbortController().signal,
        };
        await home
          .remove(homeKey, context, deletedRow)
          .catch((error) => getLogger().error("agent home cleanup", error));
      }
    },
    // The session change already happened, so a push token failure must not fail sign-out.
    afterDeleteSession: async (session) => {
      await endSessionPushTokens(prisma, session.userId, session.id).catch((error) =>
        getLogger().error("push token removal failed", error),
      );
    },
    afterReplaceSession: async (previous, session) => {
      await endSessionPushTokens(prisma, session.userId, previous.id, session.id).catch((error) =>
        getLogger().error("push token session update failed", error),
      );
    },
  });
  const oauthTokenUpgrade = auth
    .encryptStoredOAuthTokens()
    .catch((error) => getLogger().error("oauth token encryption upgrade failed", error));
  // One provider instance so emulator launches and polls share the same Map.
  const cloudAgent = createCloudAgentConnection({
    CLOUD_AGENT_PROVIDER: env.cloudAgentProvider,
    CURSOR_API_KEY: env.cursorApiKey,
    CLOUD_AGENT_SPACE_ID: env.cloudAgentSpaceId,
  });
  const shutdown = new AbortController();
  // One cache serves models.list, selection validation, and run-time model
  // resolution alike, so a list call warms the run path in this process.
  const codexCatalog = new CodexCatalogCache();
  let companyImport: ReturnType<typeof createCompanyImportEngine> | undefined;
  const executor = createRunExecutor({
    appControl,
    appControlStore,
    notificationEvents,
    contextStrategy,
    prisma,
    mcpOAuth,
    runtime,
    codexCatalog,
    sandbox,
    memory,
    memoryProviders,
    home,
    artifacts,
    connector: stack.connector,
    mcp,
    connectors: stack.connector,
    listConnectedPluginSlugs: async (userId) => {
      const provider = await integrationSettings.resolve("composio");
      if (!provider) return [];
      return provider.listConnectedExternalIds({
        userId,
        spaceId: "",
        operationId: "connections.sync",
        traceId: "connections.sync",
        signal: AbortSignal.timeout(15_000),
      });
    },
    secrets: [
      env.deploymentModelKey ?? "",
      env.composioApiKey ?? "",
      env.cursorApiKey ?? "",
      process.env.TYPESAFE_API_KEY ?? "",
    ].filter(Boolean),
    secretStore: secrets,
    secretHttp: remoteConnectors,
    mcpAllowPrivateEndpoint: env.mcpAllowPrivateEndpoint,
    mcpStdio: { stdioEnabled: env.mcpStdioEnabled, allowedCommands: env.mcpStdioAllowedCommands },
    fragmentKey: env.encryptionKey,
    deploymentModelKey: env.deploymentModelKey,
    deploymentModelConfigured: env.deploymentModelConfigured,
    dataDir: env.dataDir,
    jobs,
    events,
    onTicketChange: ticketChanges,
    ticketBoardEnabled,
    messaging: messaging ? createMessagingContextLoader(prisma, messaging) : undefined,
    web: createWebProvider(),
    cloudAgent,
    mail,
    mailWritesDisabled: env.mailWritesDisabled,
    shutdownSignal: shutdown.signal,
    companyImport: () => {
      if (!companyImport) throw new Error("Company import engine is not initialized.");
      return companyImport;
    },
  });

  const companyReader = createCompanyConnectionReader({ prisma, connectors: stack.connector, mcp });
  const documentReader = createCompanyDocumentReader(companyReader);
  const slackReader = createCompanySlackReader(companyReader);
  const trackerReader = createCompanyTrackerReader(companyReader);
  companyImport = createCompanyImportEngine({
    prisma,
    jobs,
    realtime,
    resolveModel: executor.resolveModel,
    notificationEvents,
    worker: createCompanySourceWorker({
      prisma,
      mail,
      extractor: new LlmCompanyExtractor(),
      slack: slackReader,
      tracker: trackerReader,
      documents: documentReader,
    }),
  });
  const companyImportPage = createCompanyImportPage({
    prisma,
    engine: companyImport,
    reader: companyReader,
    slack: slackReader,
    tracker: trackerReader,
    documents: documentReader,
  });
  const jobHandlers = createBackgroundJobHandlers({
    ticketBoardEnabled,
    executor,
    prisma,
    sandbox,
    home,
    jobs,
    events,
    workerId: "api",
    runtime,
    secretStore: secrets,
    memoryProviders,
    deploymentModelKey: env.deploymentModelKey,
    deploymentModelConfigured: env.deploymentModelConfigured,
    messaging,
    cloudAgent,
    devinCallTool: createDevinCallTool(prisma, mcp),
    ...(brexApi ? { brexApi } : {}),
    notificationEvents,
    financeCallToolFor: financeCallToolOverride ?? createFinanceCallToolFor(prisma, mcp),
    artifacts,
    connector: stack.connector,
    connectors: stack.connector,
    boxAccessToken: boxAccessToken(mcpOAuth),
    notificationChannels: [
      notifications,
      ...(messaging
        ? [new ImessageNotificationChannel({ prisma, jobs, appUrl: env.webOrigin })]
        : []),
    ],
    mail,
    mailWritesDisabled: env.mailWritesDisabled,
    gmailPush,
    meetingSources:
      meetingSources ?? createMeetingSourceRegistry({ mcp: { prisma, connector: mcp } }),
    companyImport,
  });
  if (inMemoryJobs) {
    await inMemoryJobs.start(jobHandlers);
  }
  const reconciler = inMemoryJobs
    ? createJobReconciler({
        prisma,
        jobs,
        events,
        notificationEvents,
        reconcileCloudAgents: () => reconcileCloudAgents({ prisma, jobs, cloudAgent }),
        reconcileComputerUpdates: () => reconcileComputerUpdates({ prisma, jobs }),
        reconcileMeetings: () => reconcileMeetingSyncs({ prisma, jobs }),
        reconcileCompanyImports: () => companyImport.recoveryJob(),
        reconcileTeachHeldValues: () => deleteExpiredTeachData(prisma),
        // Graphile mode runs watch.probe from RECURRING_JOBS in apps/worker; memory mode has no cron.
        runWatchProbes: () =>
          runWatchProbeTick({
            prisma,
            jobs,
            events,
            notificationEvents,
            connector: stack.connector,
          }),
        runPageRefreshes: () =>
          runPageRefreshTick({
            prisma,
            jobs,
            events,
            ticketBoardEnabled,
            mcp,
            secretStore: secrets,
            network: remoteConnectors,
          }),
      })
    : undefined;
  reconciler?.start();

  const router = createRouter({
    email,
    ...(brexApi ? { brexApi } : {}),
    describeTeachSteps: (input) =>
      describeTeachSteps({ prisma, runtime, resolveModel: executor.resolveModel }, input),
    reviewAttachment: (input, signal) =>
      reviewAttachment({ prisma, runtime, resolveModel: executor.resolveModel }, input, signal),
    summarizePerson: (input, signal) =>
      summarizePerson({ prisma, runtime, resolveModel: executor.resolveModel }, input, signal),
    unsubscriber: createMailUnsubscriber(),
    proposeSort: (model, input, context) =>
      new LlmDataRoomClassifier({
        runtime,
        model,
        onUsage: (usage, attribution) => recordUsage(prisma, usage, attribution),
      }).proposeSort(input, context),
    cloudAgent,
    codexCatalog,
    prisma,
    events,
    ticketChanges,
    boardEvents,
    notificationEvents,
    companyImport,
    companyImportPage,
    auth,
    jobs,
    sandbox,
    ...(appControl ? { appControl } : {}),
    memory,
    memoryProviders,
    home,
    secrets,
    oauthLogins,
    integrationSettings,
    messagingSettings,
    mcpOAuth,
    composio: stack.composio,
    connectors: stack.connector,
    remoteConnectors,
    artifacts,
    mail,
    imageProxySecret: env.authSecret,
    financeCallToolFor: financeCallToolOverride ?? createFinanceCallToolFor(prisma, mcp),
    safeCallToolFor: createSafeCallToolFor(prisma, mcp),
    mcp,
    ...(gtmQueueReader ? { gtmQueueReader } : {}),
    ...(gtmMcp ? { gtmMcp } : {}),
    // The same offline fake serves exchange reads (Coinbase, Kraken) and their prices.
    ...(cryptoFetch ? { exchangeFetch: cryptoFetch } : {}),
    ...(meetingSources ? { meetingSources } : {}),
    parseStatement: async (file, scope) => {
      // Only a PDF from an unknown bank reaches the model, and only with the consent the Inbox
      // triage model already needs. Without it the parser says no model is configured.
      const ready = (await triageStatus({ prisma, resolveModel: executor.resolveModel }, scope))
        .ready;
      const metered: AgentRuntime = {
        describe: () => runtime.describe(),
        abort: (runId) => runtime.abort(runId),
        run: (request, context) =>
          runtime.run(
            {
              ...request,
              usageOperationKind: "triage",
              onUsage: async (usage) => {
                await recordUsage(prisma, usage, {
                  ...scope,
                  operationId: request.runId,
                  operationKind: "triage",
                });
              },
            },
            context,
          ),
      };
      const operationId = `statement:${randomUUID()}`;
      return parseStatement(file, {
        ...(ready
          ? {
              extract: createRuntimeExtract(metered, ready.model, {
                operationId,
                traceId: operationId,
                ...scope,
                signal: AbortSignal.timeout(120_000),
              }),
            }
          : {}),
      });
    },
    financeCrypto: {
      sync: (scope, opts) =>
        syncCryptoHoldings(
          { prisma, secrets, ...(cryptoFetch ? { fetch: cryptoFetch } : {}) },
          scope,
          opts,
        ),
      resolveEns: (_scope, name, signal) =>
        resolveEnsName(
          createRpcClient({ signal, ...(cryptoFetch ? { fetch: cryptoFetch } : {}) }),
          name,
        ),
    },
    resolveModel: executor.resolveModel,
    dataDir: env.dataDir,
    billing,
    messaging: {
      enabled: Boolean(messaging),
      providers: messaging?.platforms().map((platform) => platform.provider) ?? [],
      openSignup: env.messagingOpenSignup,
    },
    env: {
      ticketBoardEnabled,
      agentRuntime: env.agentRuntime,
      defaultProvider: env.defaultProvider,
      defaultModel: env.defaultModel,
      teamChatJudgeProvider: env.teamChatJudgeProvider,
      teamChatJudgeModel: env.teamChatJudgeModel,
      deploymentModelConfigured: env.deploymentModelConfigured,
      deploymentModelHostCredentials: env.deploymentModelHostCredentials,
      webOrigin: env.webOrigin,
      trustedOrigins: env.trustedOrigins,
      privacyPolicyUrl: env.privacyPolicyUrl,
      screenProxySecret: env.screenProxySecret,
      sandboxProvider: env.sandboxProvider,
      gitSha: env.gitSha,
      updaterUrl: env.updaterUrl,
      updaterToken: env.updaterToken,
      imageTag: env.imageTag,
      integrationsCatalogUrl: env.integrationsCatalogUrl,
      mcpAllowPrivateEndpoint: env.mcpAllowPrivateEndpoint,
      mcpStdioEnabled: env.mcpStdioEnabled,
      mcpStdioAllowedCommands: env.mcpStdioAllowedCommands,
      mcpUrl: `${mcpBaseUrl}/mcp`,
      mailWritesDisabled: env.mailWritesDisabled,
    },
  });
  const rpc = new RPCHandler<RouteAuthContext>(router, {
    clientInterceptors: [onError((error, { path }) => logUnexpectedRpcError(error, path))],
  });
  const app = new Hono();
  app.onError(handleHttpError);
  const inFlight = trackInFlightRequests();
  app.use("*", inFlight.middleware);
  app.use("*", requestLogging(logger));
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return env.webOrigin;
        return isTrustedOrigin(origin, env) ? origin : "";
      },
      credentials: true,
    }),
  );
  // Session and account replies must never be stored by a client or an HTTP cache.
  for (const path of ["/api/auth/*", "/rpc/*"]) {
    app.use(path, async (c, next) => {
      await next();
      c.header("cache-control", "no-store");
    });
  }
  app.use(PORTAL_PATH, portalNoStore);
  // Webhooks, public links and sign-in run outside any one Space; see route-scope.ts.
  mountSystemRoutes(app);
  app.get("/api/auth/capabilities", (c) => {
    return c.json({
      sso: env.oidc
        ? { name: env.oidc.name, availability: auth.ssoAvailability() ?? "checking" }
        : null,
      passwordAuth: env.passwordAuth !== false,
      passwordReset: env.passwordAuth !== false && Boolean(email),
      resetUrl:
        env.passwordAuth !== false && email ? new URL("/reset-password", env.webOrigin).href : null,
      billing: Boolean(billing),
      passkey: env.passwordAuth !== false,
    } satisfies AuthCapabilities);
  });
  if (localEmailEmulator && env.nodeEnv === "development") {
    app.get(
      "/api/dev/emails",
      () =>
        new Response(JSON.stringify(localEmailEmulator.sent), {
          headers: { "cache-control": "no-store", "content-type": "application/json" },
        }),
    );
  }
  mountApiRequestBodyLimits(app);
  mountRegisterLimit(app, prisma);
  mountScreenTarget(app, prisma, env.screenProxySecret);
  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    const path = new URL(c.req.url).pathname.replace("/api/auth", "");
    if (isBlockedAuthPath(path)) {
      return c.json({ error: "Not available in version 1" }, 404);
    }
    return auth.handler(emptyAuthBodyAsJson(c.req.raw));
  });
  mountMcpDiscovery(app, { auth, baseUrl: mcpBaseUrl, authUrl: env.authUrl });
  mountMcpServer(app, {
    prisma,
    auth,
    baseUrl: mcpBaseUrl,
    notificationEvents,
    agents: { events, jobs },
    jwksUrl: `${env.apiUrl.replace(/\/+$/, "")}${"/api/auth"}/jwks`,
  });
  mountLocalSettings(app, { token: env.desktopStackToken, prisma, rpc });
  const requestSession = async (request: Request) => {
    // The bearer plugin turns a signed `Authorization: Bearer` into the session cookie.
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;
    const actor = await actorFromMembership(
      requireMembership(prisma, session.user.id, request.headers.get("x-rakazo-space-id")),
    );
    return actor && { actor, sessionId: session.session.id };
  };
  // One lookup per request: the Space scope below and the route itself both ask.
  const sessions = new WeakMap<Request, ReturnType<typeof requestSession>>();
  const cachedSession = (request: Request) => {
    let session = sessions.get(request);
    if (!session) {
      session = requestSession(request);
      sessions.set(request, session);
    }
    return session;
  };
  const sessionActor = async (request: Request) => (await cachedSession(request))?.actor ?? null;
  mountTenantRoutes(app, sessionActor);
  app.use("/rpc/*", async (c, next) => {
    const session = await cachedSession(c.req.raw);
    const actor = session?.actor ?? null;
    const tooLarge = await limitRpcBody(c, actor !== null);
    if (tooLarge) return tooLarge;
    if (actor) {
      enrichLogContext({ "user.id": actor.userId, "space.id": actor.spaceId });
    }
    const { matched, response } = await rpc.handle(c.req.raw, {
      prefix: "/rpc",
      context: {
        actor,
        sessionId: session?.sessionId,
        signal: c.req.raw.signal,
        requestHeaders: c.req.raw.headers,
        // Same user in the same space, so leaving the space also ends a stream.
        // A database failure rejects this check; only a missing membership is unauthorized.
        stillAuthorized: async () => {
          // Not the cached lookup: this check exists to see a sign-out that happened since.
          const current = (await requestSession(c.req.raw))?.actor ?? null;
          return Boolean(
            actor && current?.userId === actor.userId && current.spaceId === actor.spaceId,
          );
        },
      },
    });
    if (matched) return withRetryAfter(c.newResponse(response.body, response));
    await next();
  });
  const loggedActor = async (request: Request) => {
    const actor = await sessionActor(request);
    if (actor) enrichLogContext({ "user.id": actor.userId, "space.id": actor.spaceId });
    return actor;
  };
  mountEmailImageProxy(app, { secret: env.authSecret }, async (request) => sessionActor(request));
  mountInboxAttachment(app, { prisma, mail }, loggedActor);
  mountContactPhoto(app, { prisma, artifacts }, loggedActor);
  mountDataRoomRoutes(app, { prisma, artifacts, jobs }, loggedActor);
  mountOmiRoutes(app, { prisma, artifacts, jobs }, loggedActor);
  mountMeetingCaptureRoutes(app, { prisma, artifacts, jobs }, loggedActor);
  mountInvestorPortal(app, {
    store: prismaPortalStore(prisma),
    artifacts,
    isTrustedOrigin: (origin) => isTrustedOrigin(origin, env),
  });
  mountArtifactShare(app, { store: prismaShareStore(prisma), artifacts });
  mountAccountExportDownload(app, { prisma, artifacts }, loggedActor);
  mountVoiceHttpRoutes(app, { prisma, secrets, ticketBoardEnabled }, (c) => loggedActor(c.req.raw));
  mountWebhookHttpRoutes(app, { prisma, secrets, events, jobs });
  // Gmail push is off unless the deployment sets a Pub/Sub topic and service account.
  if (gmailPush) {
    mountMailPushRoute(app, {
      verify: createGmailPushVerifier(gmailPush),
      wake: (address) => wakeMailConnections({ prisma, jobs }, address),
    });
  }
  if (billing && billingProvider) {
    mountBillingRoutes(app, {
      billing,
      provider: billingProvider,
      webOrigin: env.webOrigin,
      authenticate: sessionActor,
    });
  }
  // Shared with stop so a shutdown during retry delays does not restart polling.
  let messagingStopped = false;
  let clearMessagingRetryDelay: (() => void) | undefined;
  let messagingInitTask: Promise<void> | undefined;
  let clearTeamChatRetryDelay: (() => void) | undefined;
  let teamChatInitTask: Promise<void> | undefined;
  // Messaging webhooks only exist when the surface is enabled.
  let teamChatBridge: TeamChatBridge | undefined;
  /** Constructed even before start() succeeds so stop() can cancel in-flight startup. */
  let teamChatBridgeInstance: TeamChatBridge | undefined;
  const pendingTeamChatInbound = new PendingTeamChatInbound();
  if (messaging) {
    const inboundDeps = {
      prisma,
      events,
      jobs,
      provision: (request, policyEnv) => provisionMessagingIdentity(prisma, request, policyEnv),
      openSignup: env.messagingOpenSignup,
      signupPolicy: {
        signupsEnabled: env.signupsEnabled,
        signupAllowlist: env.signupAllowlist,
      },
      typing: (threadId) => {
        // Keep conversation addresses out of trace ids — those reach logs
        // and telemetry, a different trust boundary than the database.
        const operationId = `messaging.typing:${randomUUID()}`;
        return messaging.sendTyping(threadId, {
          operationId,
          traceId: operationId,
          spaceId: "",
          userId: "",
          // Cosmetic side call: the wait is bounded so a stalled vendor
          // response never holds our callback chain (the Chat SDK adapter
          // API cannot cancel the underlying request itself).
          signal: AbortSignal.timeout(2000),
        });
      },
    } satisfies Parameters<typeof createMessagingInboundHandler>[0];
    const inbound = createMessagingInboundHandler(inboundDeps);
    const handleTeamChatInbound = async (
      bridge: TeamChatBridge,
      event: Parameters<typeof wakeMessageRoutines>[2],
    ) => {
      const mapped = toTeamChatInbound(event);
      if (!mapped) {
        await inbound(event);
        return;
      }
      const canWake = await teamChatSenderCanWakeMessageRoutines(inboundDeps, event);
      if (!canWake) {
        await bridge.receive(mapped);
        return;
      }

      // Persist a non-reconcilable row until routine routing owns or releases
      // the message, so the timer cannot start a second TeamChat run.
      const target = await bridge.receive(mapped, { queueAgent: false });
      if (!target.deferred) return;
      const leaseHeartbeat = await bridge.startDeferredReservationHeartbeat(
        target.externalMessageId,
      );
      let woken = false;
      bridge.markRoutineWakeInFlight(target.externalMessageId);
      try {
        const wakePromise = wakeMessageRoutines(inboundDeps, target, event, {
          // Must match TeamChatBridge ExternalConversation / recovery provider.
          deliveryProvider: bridge.providerId,
          externalMessageId: target.externalMessageId,
        });
        try {
          woken = await Promise.race([wakePromise, leaseHeartbeat.lost]);
        } catch (error) {
          if (isDeferredReservationLost(error)) {
            // Lease loss must not start a fallback agent beside an in-flight
            // wake: re-hold exclusive ownership while awaiting that wake, then
            // resolve from its settled result.
            let hold: { stop: () => void } | undefined;
            try {
              hold = await bridge.startDeferredReservationHeartbeat(target.externalMessageId);
            } catch {
              // Row already left deferred; wake CAS / resolve decide the winner.
            }
            try {
              try {
                woken = await wakePromise;
              } catch (wakeError) {
                const released = await bridge.resolveDeferredMessage(
                  target.externalMessageId,
                  "agent",
                  mapped.kind,
                );
                if (!released) {
                  throw new Error("Team chat deferred message ownership conflict", {
                    cause: wakeError,
                  });
                }
                await bridge.reconcileOnce();
                getLogger().error(
                  "team chat routine wake failed after deferred lease loss",
                  wakeError,
                );
                return;
              }
            } finally {
              hold?.stop();
            }
          } else {
            await bridge.resolveDeferredMessage(target.externalMessageId, "agent", mapped.kind);
            await bridge.reconcileOnce();
            throw error;
          }
        }
        const resolved = await bridge.resolveDeferredMessage(
          target.externalMessageId,
          woken ? "routine" : "agent",
          mapped.kind,
        );
        if (!resolved) {
          throw new Error("Team chat deferred message ownership conflict");
        }
        if (!woken) await bridge.reconcileOnce();
      } finally {
        bridge.clearRoutineWakeInFlight(target.externalMessageId);
        leaseHeartbeat.stop();
      }
    };
    const flushPendingTeamChatInbound = (bridge: TeamChatBridge) => {
      pendingTeamChatInbound.flush((event) => handleTeamChatInbound(bridge, event));
    };
    if (env.teamChatBotId) {
      const judge =
        env.teamChatJudgeProvider && env.teamChatJudgeModel
          ? new ModelTeamChatEngagementJudge({
              prisma,
              runtime,
              secrets,
              deploymentProvider: env.defaultProvider,
              deploymentModel: env.defaultModel,
              deploymentModelKey: env.deploymentModelKey,
              providerOverride: env.teamChatJudgeProvider,
              modelOverride: env.teamChatJudgeModel,
            })
          : new ModelTeamChatEngagementJudge({
              prisma,
              runtime,
              secrets,
              deploymentProvider: env.defaultProvider,
              deploymentModel: env.defaultModel,
              deploymentModelKey: env.deploymentModelKey,
            });
      const bridge = new TeamChatBridge({
        prisma,
        events,
        jobs,
        send: createMessagingTeamChatSender(messaging),
        providerId: "slack",
        botId: env.teamChatBotId,
        judge,
      });
      teamChatBridgeInstance = bridge;
      try {
        await bridge.start();
        teamChatBridge = bridge;
      } catch (error) {
        getLogger().error("team chat bridge failed to start; retrying", error);
        teamChatInitTask = (async () => {
          let delayMs = 2_000;
          while (!messagingStopped) {
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, delayMs);
              clearTeamChatRetryDelay = () => {
                clearTimeout(timer);
                clearTeamChatRetryDelay = undefined;
                resolve();
              };
            });
            clearTeamChatRetryDelay = undefined;
            if (messagingStopped) return;
            try {
              await bridge.start();
              if (messagingStopped) {
                await bridge.stop();
                return;
              }
              teamChatBridge = bridge;
              flushPendingTeamChatInbound(bridge);
              return;
            } catch (retryError) {
              if (
                retryError instanceof Error &&
                retryError.message === "Team chat bridge start cancelled"
              ) {
                return;
              }
              getLogger().error("team chat bridge failed to start; retrying", retryError);
              delayMs = Math.min(delayMs * 5, 30_000);
            }
          }
        })();
      }
    }
    const handleInbound = async (event: MessagingInboundEvent) => {
      if (event.type !== "message") {
        await applyMessagingOutboundStatus(prisma, event);
        return;
      }
      if (prefersTeamChatSurface(event, env.teamChatBotId)) {
        const bridge = teamChatBridge;
        if (bridge) {
          await handleTeamChatInbound(bridge, event);
          return;
        }
        // Bridge is still starting (or retrying). Do not fall through to the
        // personal-line inbound path — that bypasses externalMessage ownership
        // and can wake routines for unlinked TeamChat senders.
        if (teamChatInitTask) {
          const pending = pendingTeamChatInbound.enqueue(event);
          if (!pending) {
            throw new Error("Team chat inbound buffer is full");
          }
          await pending;
          return;
        }
        throw new Error("Team chat bridge is unavailable");
      }
      await inbound(event);
    };
    messaging.onInbound((event) => runAsSystem("messaging inbound", () => handleInbound(event)));
    mountMessagingWebhookRoutes(app, { messaging });
    // Start polling-mode adapters (e.g. Telegram with no public webhook URL
    // registered) immediately rather than waiting for the first webhook
    // POST or outbound send to lazily trigger it. This is the process that
    // owns the inbound sink registered just above, so it must be the one
    // holding the live connection — a second poller elsewhere (e.g. the
    // worker) would only fight this one for Telegram's single getUpdates
    // slot without ever seeing the messages itself.
    // Bounded retries cover transient Telegram startup failures; polling-only
    // bots otherwise stay dark until an unrelated outbound send re-inits.
    messagingInitTask = (async () => {
      const delayMs = [0, 2_000, 10_000];
      for (let attempt = 0; attempt < delayMs.length; attempt += 1) {
        if (messagingStopped) return;
        if (delayMs[attempt]! > 0) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, delayMs[attempt]);
            clearMessagingRetryDelay = () => {
              clearTimeout(timer);
              clearMessagingRetryDelay = undefined;
              resolve();
            };
          });
          clearMessagingRetryDelay = undefined;
        }
        if (messagingStopped) return;
        try {
          await messaging.initialize?.();
          return;
        } catch (error) {
          getLogger().error(
            attempt === delayMs.length - 1
              ? "messaging surface initialize failed"
              : "messaging surface initialize failed; retrying",
            error,
          );
        }
      }
    })();
  }

  app.route("/", nativeReturnRoutes());
  app.route(
    "/",
    healthRoutes(() => ({
      runtime: env.agentRuntime,
      sandbox: env.sandboxProvider,
      composio: Boolean(stack.composio),
      pipedream: Boolean(pipedream),
      messaging: Boolean(messaging),
      email: email?.describe().id ?? null,
      billing: billingProvider?.describe().id ?? null,
      jobs: jobKind,
      realtime: realtime.describe().id,
      secrets: secrets.describe(),
      degraded: secrets.describe().capabilities.degraded ?? false,
      revision: env.gitSha ?? null,
    })),
  );

  return {
    app,
    prisma,
    jobs,
    sandbox,
    connector,
    composio: stack.composio,
    connectors: stack.connector,
    messaging,
    email,
    executor,
    runtime,
    awaitIdle: inMemoryJobs ? () => inMemoryJobs.awaitIdle() : undefined,
    backgroundFailures: inMemoryJobs ? () => inMemoryJobs.failureCounts() : undefined,
    stop: async () => {
      // Handlers still running would otherwise query the pool after it ends.
      const requestsSettled = settleWithTimeout(inFlight.settled(), REQUEST_DRAIN_MS);
      // Abort in-flight continueRun boot waits before draining jobs so stop() cannot sit
      // on waitForComputerReady for the full boot-wait window during shared Postgres journeys.
      auth.disposeOidcDiscovery();
      shutdown.abort();
      oauthLogins.abortAll();
      messagingStopped = true;
      clearMessagingRetryDelay?.();
      clearTeamChatRetryDelay?.();
      pendingTeamChatInbound.reject(new Error("Team chat bridge stopped before startup"));
      // Cancel in-flight start() before awaiting the retry task so stop() cannot
      // sit on DB/reconcile work that bridge.start() is still running.
      await settleWithTimeout(
        teamChatBridgeInstance ? teamChatBridgeInstance.stop().catch(() => undefined) : undefined,
        TEAM_CHAT_STARTUP_SHUTDOWN_MS,
      );
      await messagingInitTask?.catch(() => undefined);
      await settleWithTimeout(teamChatInitTask, TEAM_CHAT_STARTUP_SHUTDOWN_MS);
      await messaging?.shutdown?.();
      await teamChatBridge?.stop();
      await reconciler?.stop();
      await oauthTokenUpgrade;
      await requestsSettled;
      await email?.drain?.();
      await jobs.close();
      await secrets.close();
      await realtime.close();
      await connector.stop();
      await mcp.close();
      await prisma.$disconnect().catch(() => undefined);
      await created.pool?.end().catch(() => undefined);
      await ownedJobPool?.end().catch(() => undefined);
      await logger.flush({ timeoutMs: 2_000 });
    },
  };
}

export function isTrustedOrigin(
  origin: string,
  env: Pick<AppEnv, "webOrigin" | "apiUrl" | "authUrl"> & { trustedOrigins?: string[] },
) {
  if (!origin) return true;
  if (origin.startsWith("rakazo://")) return true;
  const allowed = new Set(
    [
      env.webOrigin,
      env.apiUrl,
      env.authUrl,
      ...MOBILE_AUTH_ORIGINS,
      ...(env.trustedOrigins ?? []),
    ].flatMap(originVariants),
  );
  return allowed.has(origin);
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function originVariants(origin: string): string[] {
  if (!origin || origin === "rakazo://") return [];
  const variants = [origin, ...loopbackTwinOrigins(origin)];
  try {
    const url = new URL(origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      variants.push(url.origin);
    }
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      const v6 = new URL(origin);
      v6.hostname = "[::1]";
      variants.push(v6.origin);
    }
  } catch {
    return variants;
  }
  return variants;
}

/**
 * No membership is no actor, which the RPC layer answers as 401. A database
 * failure, including the deployment-settings lookup, must stay a server error
 * so a blip does not look like a rejected session.
 */
export async function actorFromMembership(membership: Promise<Actor>): Promise<Actor | null> {
  try {
    return await membership;
  } catch (error) {
    if (error instanceof IsolationError) return null;
    throw error;
  }
}

/**
 * Some clients POST auth actions with an empty body (older phone sign-out, the web deletion code);
 * Better Auth rejects that before the endpoint runs.
 */
function emptyAuthBodyAsJson(request: Request) {
  if (
    request.method !== "POST" ||
    request.headers.get("content-length") !== "0" ||
    request.headers.has("transfer-encoding")
  ) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Request(request, { headers, body: "{}" });
}

/**
 * An ORPCError is a decision the router made (BAD_REQUEST, UNAUTHORIZED, ...) and reaches the
 * caller intact. Everything else is flattened into an opaque "Internal server error", so
 * unless it is logged here the only record of what actually broke is gone.
 *
 * The cause chain matters as much as the message: undici and most SDKs report a bare
 * "fetch failed" and keep the host and errno one level down.
 */
export function logUnexpectedRpcError(error: unknown, path: readonly string[]): void {
  if (error instanceof ORPCError) return;
  const where = `rpc ${path.join("/")} failed`;
  // A database failover is the database's failure, not the procedure's: answer 503 so the
  // client retries, and log it as a warning.
  if (isDatabaseInterruption(error)) {
    getLogger().warn(`${where}: database unavailable`, { "error.message": String(error) });
    throw new ORPCError("SERVICE_UNAVAILABLE", { cause: error });
  }
  getLogger().error(where, error);
}
