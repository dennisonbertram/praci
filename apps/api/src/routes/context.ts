import type { Implementer, ImplementerInternalWithMiddlewares } from "@orpc/server";
import { implement, ORPCError } from "@orpc/server";
import type {
  AgentHomeStore,
  ArtifactStore,
  JobPublisher,
  MailProvider,
  MailUnsubscriber,
  MemoryStore,
  SandboxProvider,
  SecretStore,
  TransactionalEmailProvider,
} from "@rakazo/adapter-kit";
import type {
  CloudAgentConnection,
  CodexLiveCatalog,
  ComposioProvider,
  ConnectorRegistry,
  DevinCallTool,
  FaviconResolver,
  FinanceSyncDeps,
  IntegrationProviderSettings,
  McpConnector,
  McpOAuthBroker,
  MeetingSourceRegistry,
  MemoryProviderResolver,
  MessagingSettings,
  PiOAuthLogins,
  RemoteConnectorDependencies,
  TicketChangeNotifier,
  TriageReadinessDeps,
} from "@rakazo/adapters";
import type { Auth } from "@rakazo/auth";
import type { Actor } from "@rakazo/contracts";
import { appContract } from "@rakazo/contracts";
import type { BoardEvents, NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import type { BillingService } from "../billing.js";
import type { createDataRoomService } from "../data-room.js";
import type { FinanceCryptoDeps } from "../finance.js";
import type { ParseStatement } from "../finance-statements.js";

export interface RouterDeps {
  /** Transactional email for portal links; absent when the deployment has none. */
  email?: TransactionalEmailProvider;
  /** Sends one-click unsubscribe POSTs; without it a one-click sender degrades to its link. */
  unsubscriber?: MailUnsubscriber;
  /** The model call behind Data room auto-sort; without it only duplicate folders are merged. */
  proposeSort?: Parameters<typeof createDataRoomService>[0]["proposeSort"];
  cloudAgent?: CloudAgentConnection | null;
  prisma: PrismaClient;
  events: ThreadEvents;
  boardEvents: BoardEvents;
  notificationEvents: NotificationEvents;
  ticketChanges: TicketChangeNotifier;
  auth: Auth;
  jobs: JobPublisher;
  sandbox: SandboxProvider;
  memory: MemoryStore;
  memoryProviders: MemoryProviderResolver;
  home: AgentHomeStore;
  secrets: SecretStore;
  oauthLogins: PiOAuthLogins;
  /** Live Codex catalog seam; defaults to the shared per-process cache. */
  codexCatalog?: CodexLiveCatalog;
  /** Site icons for links; defaults to the per-process cache that fetches them. */
  favicons?: FaviconResolver;
  /**
   * Detached refresh for a stored credential whose bearer expired — the live
   * catalog path calls it instead of refreshing inline. Defaults to the
   * runtime's locked `kickModelCredentialRefresh`; injectable for tests so a
   * catalog read never reaches the real OAuth refresh endpoint.
   */
  refreshExpiredModelCredential?: (
    scope: { userId: string; spaceId: string },
    secretId: string,
    provider: string,
  ) => void;
  integrationSettings?: IntegrationProviderSettings;
  messagingSettings?: MessagingSettings;
  composio?: ComposioProvider;
  mcpOAuth?: McpOAuthBroker;
  /** Replaces the network for Box calls; tests point it at the Box emulator. */
  boxFetch?: typeof fetch;
  /** Builds the read-tool caller for finance servers (refresh, receipts); unset where finance sync is off. */
  financeCallToolFor?: FinanceSyncDeps["callToolFor"];
  /** Reruns a pin's saved read-only tool call on refresh; unset where MCP is off. */
  mcp?: Pick<McpConnector, "callServerTool" | "listServerTools">;
  /** Replaces the read-only Devin caller built from `mcp`; tests pass a fake. */
  devinCallTool?: DevinCallTool;
  /** Meeting providers for the Granola key check; the demo and tests point Granola at the emulator. */
  meetingSources?: MeetingSourceRegistry;
  /** Reads an uploaded bank statement; wired in app.ts. */
  parseStatement?: ParseStatement;
  financeCrypto?: FinanceCryptoDeps;
  /** Replaces the network for Coinbase and Kraken reads (offline stacks). */
  exchangeFetch?: typeof fetch;
  connectors: ConnectorRegistry;
  remoteConnectors?: RemoteConnectorDependencies;
  artifacts: ArtifactStore;
  /** Provider-neutral mail access; the Inbox handlers read and sync through it. */
  mail: MailProvider;
  /** Signs email image links; the deployment auth secret. */
  imageProxySecret?: string;
  /** The executor's model resolver; the Inbox `enabled` flag asks the same question as the triage job. */
  resolveModel?: TriageReadinessDeps["resolveModel"];
  dataDir: string;
  /** Present when the external messaging surface is enabled. */
  messaging?: { enabled: boolean; providers: string[]; openSignup: boolean };
  /** Present only when the deployment bills; self-hosted installs leave it unset. */
  billing?: BillingService;
  env: {
    ticketBoardEnabled?: boolean;
    agentRuntime: string;
    teamChatJudgeProvider?: string;
    teamChatJudgeModel?: string;
    defaultProvider: string;
    defaultModel: string;
    deploymentModelConfigured?: boolean;
    deploymentModelHostCredentials?: boolean;
    webOrigin: string;
    privacyPolicyUrl?: string;
    screenProxySecret: string;
    sandboxProvider: string;
    gitSha?: string;
    updaterUrl?: string;
    updaterToken?: string;
    imageTag?: string;
    integrationsCatalogUrl?: string;
    mcpAllowPrivateEndpoint?: boolean;
    mailWritesDisabled?: boolean;
  };
}

type RouteAuthContext = {
  actor: Actor | null;
  /** The signed-in session, so a push token ends with the session that registered it. */
  sessionId?: string;
  signal?: AbortSignal;
  /** Re-runs the request's auth so a long-lived stream notices sign-out and revocation. */
  stillAuthorized?: () => Promise<boolean>;
};
type AuthenticatedRouteContext = Omit<RouteAuthContext, "actor"> & { actor: Actor };
type RouteOs = Implementer<typeof appContract, RouteAuthContext, RouteAuthContext>;
type RouteAuthed = ImplementerInternalWithMiddlewares<
  typeof appContract,
  RouteAuthContext,
  AuthenticatedRouteContext
>;
type RouteContextParts = {
  os: RouteOs;
  authed: RouteAuthed;
};

function createRouteContextParts(): RouteContextParts {
  const os = implement(appContract).$context<{
    actor: Actor | null;
    /** The signed-in session, so a push token ends with the session that registered it. */
    sessionId?: string;
    signal?: AbortSignal;
    /** Re-runs the request's auth so a long-lived stream notices sign-out and revocation. */
    stillAuthorized?: () => Promise<boolean>;
  }>();
  const authed = os.use(async ({ context, next }) => {
    if (!context.actor) throw new ORPCError("UNAUTHORIZED");
    return next({ context: { ...context, actor: context.actor } });
  });

  return { os, authed };
}

type RouteContextBuilder = {
  deps: RouterDeps;
} & ReturnType<typeof createRouteContextParts>;

export function createRouteContext(deps: RouterDeps): RouteContextBuilder {
  const { os, authed } = createRouteContextParts();
  return { deps, os, authed };
}

export type RouteContext = ReturnType<typeof createRouteContext>;
