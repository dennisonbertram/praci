import type { Implementer, ImplementerInternalWithMiddlewares } from "@orpc/server";
import { implement, ORPCError } from "@orpc/server";
import type {
  AgentHomeStore,
  AppControlProvider,
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
  CompanyImportEngine,
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
  reviewAttachment,
  SafeSyncDeps,
  summarizePerson,
  TicketChangeNotifier,
  TriageReadinessDeps,
} from "@rakazo/adapters";
import type { Auth } from "@rakazo/auth";
import type { Actor } from "@rakazo/contracts";
import { appContract } from "@rakazo/contracts";
import type { BoardEvents, NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import {
  ComputerLimitError,
  IsolationError,
  runAsTenant,
  SpaceDeletionInProgressError,
} from "@rakazo/db";
import type { BillingService } from "../billing.js";
import type { CompanyImportPage } from "../company-import-page.js";
import type { createDataRoomService } from "../data-room.js";
import type { FinanceCryptoDeps } from "../finance.js";
import type { ParseStatement } from "../finance-statements.js";
import type { GtmQueueReader } from "../gtm.js";
import { requireSpaceOwner } from "../space-owner.js";
import type { createTaughtSkillsService } from "../taught-skills.js";

export interface RouterDeps {
  /** Transactional email for portal links; absent when the deployment has none. */
  email?: TransactionalEmailProvider;
  /** Sends one-click unsubscribe POSTs; without it a one-click sender degrades to its link. */
  unsubscriber?: MailUnsubscriber;
  /** The model call behind Data room auto-sort; without it only duplicate folders are merged. */
  proposeSort?: Parameters<typeof createDataRoomService>[0]["proposeSort"];
  /** Rewrites a recording's coordinate steps as plain steps with the bot's model; absent keeps coordinates. */
  describeTeachSteps?: Parameters<typeof createTaughtSkillsService>[0]["describeSteps"];
  /** One model turn of the attachment review chat; without it the review reports unavailable. */
  reviewAttachment?: (
    input: Parameters<typeof reviewAttachment>[1],
    signal?: AbortSignal,
  ) => ReturnType<typeof reviewAttachment>;
  /** One model turn that briefs the user on a person; without it the summary reports unavailable. */
  summarizePerson?: (
    input: Parameters<typeof summarizePerson>[1],
    signal?: AbortSignal,
  ) => ReturnType<typeof summarizePerson>;
  cloudAgent?: CloudAgentConnection | null;
  prisma: PrismaClient;
  events: ThreadEvents;
  boardEvents: BoardEvents;
  notificationEvents: NotificationEvents;
  companyImport: CompanyImportEngine;
  companyImportPage?: CompanyImportPage;
  ticketChanges: TicketChangeNotifier;
  auth: Auth;
  jobs: JobPublisher;
  sandbox: SandboxProvider;
  /** Local desktop control; absent unless APP_CONTROL_PROVIDER is set. */
  appControl?: AppControlProvider;
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
  /** Builds the Mercury SAFE read-tool caller for Fundraising; unset where MCP is off. */
  safeCallToolFor?: SafeSyncDeps["callToolFor"];
  /** Reruns a pin's saved read-only tool call on refresh; unset where MCP is off. */
  mcp?: Pick<McpConnector, "callServerTool" | "listServerTools">;
  /** Replaces the app-owned Zernio queue reader for offline tests and the local demo. */
  gtmQueueReader?: GtmQueueReader;
  /** Replaces only the GTM overview's read-only account caller in offline acceptance. */
  gtmMcp?: Pick<McpConnector, "callServerTool">;
  /** Replaces the read-only Devin caller built from `mcp`; tests pass a fake. */
  devinCallTool?: DevinCallTool;
  /** Where the Brex token check reaches Brex; the demo and tests point it at an emulator. */
  brexApi?: { baseUrl?: string; fetch?: typeof fetch };
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
    trustedOrigins: string[];
    privacyPolicyUrl?: string;
    screenProxySecret: string;
    sandboxProvider: string;
    gitSha?: string;
    updaterUrl?: string;
    updaterToken?: string;
    imageTag?: string;
    integrationsCatalogUrl?: string;
    mcpAllowPrivateEndpoint?: boolean;
    /** Where outside AI clients reach this server's `/mcp`; shown with a new token. */
    mcpUrl?: string;
    mcpStdioEnabled?: boolean;
    mcpStdioAllowedCommands?: readonly string[];
    mailWritesDisabled?: boolean;
  };
}

export type RouteAuthContext = {
  actor: Actor | null;
  /** The signed-in session, so a push token ends with the session that registered it. */
  sessionId?: string;
  signal?: AbortSignal;
  /** The request's headers, for the origin the client reached the server through. */
  requestHeaders?: Headers;
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

/**
 * A record outside the caller's Space or user is not found, exactly like a
 * missing one, so no handler and no client can tell the two apart.
 */
export function asNotFound(error: unknown): never {
  if (error instanceof IsolationError) {
    throw new ORPCError("NOT_FOUND", { message: error.message });
  }
  throw error;
}

/** Surface a Space deletion race or the computer limit as a client error instead of a 500. */
function mapSpaceLifecycleError(error: unknown): unknown {
  if (error instanceof SpaceDeletionInProgressError) {
    return new ORPCError("CONFLICT", { message: error.message });
  }
  if (error instanceof ComputerLimitError) {
    return new ORPCError("BAD_REQUEST", { message: error.message });
  }
  return error;
}

/**
 * Runs an authenticated procedure with row-level security scoped to the actor's
 * Space. A streamed result is read after the procedure returns, so each step of
 * its iterator re-enters the same scope — and a rejection it raises there is
 * answered the same way as one raised before the stream opened.
 */
export async function asTenant<T extends { output: unknown }>(
  actor: Actor,
  next: () => T | PromiseLike<T>,
): Promise<T> {
  const result = await runAsTenant(actor, next);
  const output = result.output;
  if (!output || typeof output !== "object" || !(Symbol.asyncIterator in output)) return result;
  const iterator = output as AsyncIterator<unknown> & AsyncIterable<unknown>;
  const scoped: AsyncIterableIterator<unknown> = {
    next: (...args) => runAsTenant(actor, () => iterator.next(...args)).catch(asNotFound),
    return: (value) =>
      runAsTenant(actor, () => iterator.return?.(value) ?? { done: true as const, value }).catch(
        asNotFound,
      ),
    throw: (error) =>
      runAsTenant(actor, () =>
        iterator.throw ? iterator.throw(error) : Promise.reject(error),
      ).catch(asNotFound),
    [Symbol.asyncIterator]() {
      return scoped;
    },
  };
  return { ...result, output: scoped };
}

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
    const actor = context.actor;
    if (!actor) throw new ORPCError("UNAUTHORIZED");
    try {
      return await asTenant(actor, () => next({ context: { ...context, actor } }));
    } catch (error) {
      if (error instanceof IsolationError) asNotFound(error);
      throw mapSpaceLifecycleError(error);
    }
  });

  return { os, authed };
}

type RouteContextBuilder = {
  deps: RouterDeps;
  ownerOnly: RouteAuthed;
} & ReturnType<typeof createRouteContextParts>;

export function createRouteContext(deps: RouterDeps): RouteContextBuilder {
  const { os, authed } = createRouteContextParts();
  /** Procedures only the Space's owner may call; a member or former member gets FORBIDDEN. */
  const ownerOnly: RouteAuthed = authed.use(async ({ context, next }) => {
    await requireSpaceOwner(deps.prisma, context.actor);
    return next({ context });
  });
  return { deps, os, authed, ownerOnly };
}

export type RouteContext = ReturnType<typeof createRouteContext>;
