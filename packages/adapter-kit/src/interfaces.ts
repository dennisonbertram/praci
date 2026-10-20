import type { DataRoomClassification, DataRoomQueryPlan } from "@rakazo/contracts";
import type {
  AdapterContext,
  AdapterDescriptor,
  AgentRunRequest,
  AgentRuntimeCapabilities,
  AgentRuntimeEvent,
  ArtifactPut,
  AutoReviewCapabilities,
  AutoReviewRequest,
  AutoReviewResult,
  BackgroundJob,
  BackgroundJobHandlers,
  BillingCheckoutRequest,
  BillingPrice,
  BillingSubscriptionSnapshot,
  BrowserActRequest,
  BrowserActResult,
  BrowserCapabilities,
  BrowserNavigateRequest,
  BrowserNavigateResult,
  BrowserSnapshotRequest,
  BrowserSnapshotResult,
  CloudAgentCapabilities,
  CloudAgentHandle,
  CloudAgentLaunchRequest,
  CloudAgentReplyRequest,
  CloudAgentSnapshot,
  CommandRequest,
  ComputerActionRequest,
  ComputerActionResult,
  ComputerFileEntry,
  ComputerInput,
  ComputerObservation,
  ComputerRef,
  ConnectorCall,
  ConnectorCapabilities,
  ConnectorCatalogItem,
  ConnectorEvent,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  ConnectorTool,
  ControlLeaseRef,
  InboxClassifierCapabilities,
  InboxClassifierMessage,
  InboxClassifyResult,
  MailAccount,
  MailAttachment,
  MailChanges,
  MailDraftInput,
  MailDraftRef,
  MailLabel,
  MailLabelChange,
  MailListRequest,
  MailMessage,
  MailMessagePage,
  MailSent,
  MemoryCapabilities,
  MemoryCommitRequest,
  MemoryExportRequest,
  MemoryReadRequest,
  MemoryRevision,
  MemorySearchRequest,
  MemorySearchResult,
  MemorySnapshot,
  MessagingInboundEvent,
  MessagingPlatformDescriptor,
  MessagingSendRequest,
  MessagingSendResult,
  NotificationEndpointRef,
  NotificationEnvelope,
  NotificationMessage,
  NotificationSendResult,
  PageBrowserCommand,
  PageBrowserResult,
  PortableFile,
  ProcessEvent,
  SandboxCapabilities,
  ScreenRequest,
  ScreenSession,
  SecretChangeListener,
  SecretContext,
  SecretPutOptions,
  SecretRecord,
  SemanticMemoryCapabilities,
  SemanticMemoryForgetRequest,
  SemanticMemoryPurgeHistoryRequest,
  SemanticMemoryRecallRequest,
  SemanticMemoryResponse,
  SemanticMemoryResult,
  SemanticMemorySaveRequest,
  SnapshotRef,
  SpeechClip,
  TerminalRequest,
  TransactionalEmail,
  VoiceCapabilities,
  VoiceInfo,
  VoiceSynthesizeRequest,
  VoiceTranscribeRequest,
  VoiceVerifyResult,
  WebFetchCapabilities,
  WebFetchRequest,
  WebFetchResult,
  WebSearchCapabilities,
  WebSearchHit,
  WebSearchRequest,
} from "./types.js";

export interface SandboxProvider {
  describe(): AdapterDescriptor<SandboxCapabilities>;
  /** Optional live browser on the same leased screen as observe/act. */
  pageBrowser?(
    computer: ComputerRef,
    request: PageBrowserCommand,
    context: AdapterContext,
  ): Promise<PageBrowserResult>;
  /** Allocate or reconnect the computer, returning its reference before fallible setup. */
  provision(
    request: {
      botId: string;
      homePath: string;
      providerRef?: string;
      providerKind?: ComputerRef["kind"];
    },
    context: AdapterContext,
  ): Promise<ComputerRef>;
  /** Read-only probe: true only when this exact reference is already running. */
  isRunning?(computer: ComputerRef, context: AdapterContext): Promise<boolean>;
  /** Perform idempotent provider setup after the lifecycle has captured the reference. */
  prepare(computer: ComputerRef, context: AdapterContext): Promise<void>;
  execute(
    computer: ComputerRef,
    request: CommandRequest,
    context: AdapterContext,
  ): AsyncIterable<ProcessEvent>;
  inspectBackgroundWork?(
    computer: ComputerRef,
    markerId: string,
    context: AdapterContext,
  ): Promise<"active" | "idle" | "unknown">;
  connectScreen(
    computer: ComputerRef,
    request: ScreenRequest,
    context: AdapterContext,
  ): Promise<ScreenSession>;
  /** Open a user shell bound to the current control lease; it closes when control is released. */
  connectTerminal?(
    computer: ComputerRef,
    request: TerminalRequest,
    context: AdapterContext,
  ): Promise<{ url: string }>;
  setScreenControl?(
    computer: ComputerRef,
    interactive: boolean,
    context: AdapterContext,
    controlToken?: string,
  ): Promise<void>;
  sendInput(
    computer: ComputerRef,
    input: ComputerInput,
    lease: ControlLeaseRef,
    context: AdapterContext,
  ): Promise<void>;
  observe(computer: ComputerRef, context: AdapterContext): Promise<ComputerObservation>;
  act(
    computer: ComputerRef,
    request: ComputerActionRequest,
    context: AdapterContext,
  ): Promise<ComputerActionResult>;
  listFiles(
    computer: ComputerRef,
    path: string,
    context: AdapterContext,
  ): Promise<ComputerFileEntry[]>;
  readFile(
    computer: ComputerRef,
    path: string,
    context: AdapterContext,
    options?: { maxBytes?: number },
  ): Promise<Uint8Array>;
  writeFile(computer: ComputerRef, file: PortableFile, context: AdapterContext): Promise<void>;
  exportWorkspace(computer: ComputerRef, context: AdapterContext): AsyncIterable<PortableFile>;
  importWorkspace(
    computer: ComputerRef,
    files: AsyncIterable<PortableFile>,
    context: AdapterContext,
  ): Promise<void>;
  snapshot(computer: ComputerRef, context: AdapterContext): Promise<SnapshotRef>;
  keepAlive?(computer: ComputerRef): Promise<void>;
  /** Drop a single-screen graphical claim for this bot so another Team bot can use the display. */
  releaseScreen?(computer: ComputerRef, context: AdapterContext): Promise<void>;
  stop(computer: ComputerRef, context: AdapterContext): Promise<void>;
  destroy(computer: ComputerRef, context: AdapterContext): Promise<void>;
}

export interface ConnectorProvider {
  describe(): AdapterDescriptor<ConnectorCapabilities>;
  /** `only` limits discovery to those connector ids when the provider is a registry of several. */
  discoverTools(context: AdapterContext, only?: readonly string[]): Promise<ConnectorTool[]>;
  /** Resolve a lazy catalog call to its authoritative authorized tool before approval. */
  resolveCall?(
    call: ConnectorCall,
    context: AdapterContext,
  ): Promise<{ call: ConnectorCall; tool: ConnectorTool } | undefined>;
  execute(call: ConnectorCall, context: AdapterContext): AsyncIterable<ConnectorEvent>;
}

export interface ConnectionAuthProvider {
  describe(): AdapterDescriptor<{ oauth: boolean }>;
  begin(
    request: { provider: string; redirectUrl: string },
    context: AdapterContext,
  ): Promise<{ authorizationUrl: string | null; state: string }>;
  complete(
    /** `provider` is the pending Connection's provider, for connectors whose providers need different grants. */
    request: { state: string; code?: string; redirectUrl?: string; provider?: string },
    context: AdapterContext,
  ): Promise<{ connectionRef: string; secretId?: string }>;
  /** `provider` is the Connection's provider, for connectors that hold several apps per account. */
  revoke(
    connectionRef: string,
    context: AdapterContext,
    options?: { provider?: string },
  ): Promise<void>;
}

/** A connector that also owns an end-user app catalog and connection lifecycle. */
export interface ManagedConnectorProvider
  extends ConnectorProvider,
    Omit<ConnectionAuthProvider, "describe"> {
  catalog(context: AdapterContext, query?: string): Promise<ConnectorCatalogItem[]>;
  /** Actor-independent directory metadata only; never reads per-account connection state. */
  catalogDirectory?(): Promise<Omit<ConnectorCatalogItem, "connected">[]>;
  listConnectedExternalIds(context: AdapterContext): Promise<string[]>;
  connectionReady(context: AdapterContext, externalId: string): Promise<boolean>;
  warmDirectory?(): Promise<void>;
  /** Authenticated call to the app's API as one connected account. Status codes are returned, not thrown. */
  proxy?(request: ConnectorProxyRequest, context: AdapterContext): Promise<ConnectorProxyResponse>;
}

/** Read access to a user's mailboxes, whichever connector authenticated them. */
export interface MailProvider {
  listAccounts(
    scope: { spaceId: string; userId: string },
    context: AdapterContext,
  ): Promise<MailAccount[]>;
  listMessages(
    account: MailAccount,
    request: MailListRequest,
    context: AdapterContext,
  ): Promise<MailMessagePage>;
  getMessage(account: MailAccount, id: string, context: AdapterContext): Promise<MailMessage>;
  /**
   * One attachment of one message, named by `MailMessage.attachments[].id`. Throws `too_large`,
   * before fetching the bytes when the size is known, when it exceeds `maxBytes`.
   */
  getAttachment(
    account: MailAccount,
    messageId: string,
    attachmentId: string,
    maxBytes: number,
    context: AdapterContext,
  ): Promise<MailAttachment>;
  /** The mailbox's labels, system ones first. */
  listLabels(account: MailAccount, context: AdapterContext): Promise<MailLabel[]>;
  /**
   * Adds and removes labels on one message and returns its labels afterwards. Mark read removes
   * `UNREAD`, mark unread adds it, archive removes `INBOX`. Throws `auth` when the account was
   * connected without permission to change mail, which the UI reports as "reconnect".
   */
  modifyMessage(
    account: MailAccount,
    messageId: string,
    change: MailLabelChange,
    context: AdapterContext,
  ): Promise<{ labelIds: string[] }>;
  /**
   * Applies one label change to every message of a conversation in a single call, including
   * messages the caller never listed. Errors are those of `modifyMessage`; an unknown thread is
   * `not_found`.
   */
  modifyThread(
    account: MailAccount,
    threadId: string,
    change: MailLabelChange,
    context: AdapterContext,
  ): Promise<void>;
  /**
   * A cursor for the mailbox as it is now. Take it before listing mail, so changes that arrive
   * during the list are replayed by the next `listChanges`.
   */
  getCursor(account: MailAccount, context: AdapterContext): Promise<string>;
  /**
   * Changes since `cursor`. Returns null when the provider no longer keeps history that far back
   * (or does not recognize the cursor), so the caller must list the mailbox again.
   */
  listChanges(
    account: MailAccount,
    cursor: string,
    context: AdapterContext,
  ): Promise<MailChanges | null>;
  /** Saves a new draft. Never retried after an unclear failure, so it cannot leave two drafts. */
  createDraft(
    account: MailAccount,
    draft: MailDraftInput,
    context: AdapterContext,
  ): Promise<MailDraftRef>;
  updateDraft(
    account: MailAccount,
    draftId: string,
    draft: MailDraftInput,
    context: AdapterContext,
  ): Promise<MailDraftRef>;
  /**
   * Sends a saved draft. Never retried after an unclear failure: throws `unknown` when the send
   * may have happened, `invalid` or `auth` when it certainly did not.
   */
  sendDraft(account: MailAccount, draftId: string, context: AdapterContext): Promise<MailSent>;
  deleteDraft(account: MailAccount, draftId: string, context: AdapterContext): Promise<void>;
}

export interface MemoryStore {
  describe(): AdapterDescriptor<MemoryCapabilities>;
  read(request: MemoryReadRequest, context: AdapterContext): Promise<MemorySnapshot>;
  search(request: MemorySearchRequest, context: AdapterContext): Promise<MemorySearchResult[]>;
  commit(request: MemoryCommitRequest, context: AdapterContext): Promise<MemoryRevision>;
  exportMarkdown(
    request: MemoryExportRequest,
    context: AdapterContext,
  ): AsyncIterable<PortableFile>;
  importMarkdown(
    files: AsyncIterable<PortableFile>,
    context: AdapterContext,
  ): Promise<MemoryRevision>;
}

/** Optional semantic memory. Durable Markdown memory remains owned by MemoryStore. */
export interface SemanticMemoryProvider {
  describe(): AdapterDescriptor<SemanticMemoryCapabilities>;
  recall(
    request: SemanticMemoryRecallRequest,
    context: AdapterContext,
  ): Promise<SemanticMemoryResponse<SemanticMemoryResult[]>>;
  save(
    request: SemanticMemorySaveRequest,
    context: AdapterContext,
  ): Promise<SemanticMemoryResponse>;
  purgeHistory(
    request: SemanticMemoryPurgeHistoryRequest,
    context: AdapterContext,
  ): Promise<SemanticMemoryResponse>;
  /** Optional durable forget. Providers without a forget verb omit this. */
  forget?(
    request: SemanticMemoryForgetRequest,
    context: AdapterContext,
  ): Promise<SemanticMemoryResponse<{ id: string; expired: boolean; reason: string | null }>>;
}

export interface AgentRuntime {
  describe(): AdapterDescriptor<AgentRuntimeCapabilities>;
  run(
    request: AgentRunRequest,
    context?: Partial<AdapterContext>,
  ): AsyncIterable<AgentRuntimeEvent>;
  abort(runId: string): Promise<void>;
}

export interface ModelProvider {
  describe(): AdapterDescriptor<{ catalog: boolean; byok: boolean }>;
  listModels(): Promise<Array<{ provider: string; id: string; label: string; billing: string }>>;
}

export interface JobPublisher {
  enqueue(job: BackgroundJob): Promise<void>;
  cancel(key: string): Promise<void>;
  close(): Promise<void>;
}

export interface JobWorkerHost {
  start(handlers: BackgroundJobHandlers): Promise<void>;
  stop(): Promise<void>;
}

export interface AgentHomeStore {
  describe(): AdapterDescriptor<{ revisions: boolean }>;
  checkout(botId: string, dest: string, context: AdapterContext): Promise<string>;
  /** `expectedRevision`, when given, makes the save fail if the stored revision has moved on. */
  commit(
    botId: string,
    src: string,
    context: AdapterContext,
    expectedRevision?: string,
  ): Promise<string>;
  restore(botId: string, revision: string, dest: string, context: AdapterContext): Promise<void>;
  /**
   * Paths are relative to `directory`; a missing or linked directory exports nothing.
   * `skipHidden` leaves out hidden entries at the top of the directory, also behind links.
   */
  exportHome(
    botId: string,
    context: AdapterContext,
    options?: { directory?: string; skipHidden?: boolean },
  ): AsyncIterable<PortableFile>;
  readFile(
    botId: string,
    path: string,
    context: AdapterContext,
    options?: { maxBytes?: number },
  ): Promise<string>;
  writeFile(botId: string, path: string, content: string, context: AdapterContext): Promise<void>;
  list(
    botId: string,
    path: string,
    context: AdapterContext,
  ): Promise<Array<{ path: string; kind: "file" | "dir"; size: number }>>;
  /**
   * Deletes the whole home, including every stored snapshot. Does nothing when the Computer is not
   * found for the caller's space, unless the caller already deleted the Computer row and passes
   * the snapshot ids that row held.
   */
  remove(
    botId: string,
    context: AdapterContext,
    deletedRow?: { homeSnapshotId: string | null; homePreviousSnapshotId: string | null },
  ): Promise<void>;
  /**
   * Deletes `parent/name` inside the home and persists the change. A linked parent is refused;
   * a linked final entry is unlinked. Missing entries are not an error.
   */
  removeEntry(botId: string, parent: string, name: string, context: AdapterContext): Promise<void>;
  /**
   * Present when a sandbox on this host (Docker) may use the home as its live working directory.
   * While that directory exists it is the newest copy of the home. A newer stored revision
   * replaces it only when `unmounted` confirms no container is using it; the store calls it only
   * when it has something to replace.
   */
  liveDirectory?(
    botId: string,
    context: AdapterContext,
    options?: { unmounted?: () => Promise<boolean> },
  ): Promise<string>;
  /** Records the live directory's current contents as a new revision. */
  revise?(botId: string, context: AdapterContext): Promise<string>;
}

export interface ArtifactStore {
  describe(): AdapterDescriptor<{ stream: boolean }>;
  put(artifact: ArtifactPut, context: AdapterContext): Promise<{ id: string; hash: string }>;
  get(id: string, context: AdapterContext): Promise<Uint8Array>;
  remove(id: string, context: AdapterContext): Promise<void>;
  /** Stores a local file without reading it whole into memory. */
  putFile?(
    file: { path: string; name: string; mimeType: string },
    context: AdapterContext,
  ): Promise<{ id: string; hash: string }>;
  /** Writes an object to a new local file without holding it whole in memory. */
  getFile?(id: string, destination: string, context: AdapterContext): Promise<void>;
}

export interface SecretStore {
  describe(): AdapterDescriptor<{ rotate: boolean; degraded?: boolean }>;
  put(
    plaintext: string,
    context: AdapterContext,
    options?: SecretPutOptions,
  ): Promise<SecretRecord>;
  load(ref: string, context: SecretContext): Promise<string>;
  /** Inline encrypted refs have no remote resource; removal is owned by persistence. */
  delete(ref: string, context: SecretContext): Promise<void>;
  redact(value: string): string;
  onChange(listener: SecretChangeListener): () => void;
  start(): Promise<void>;
  close(): Promise<void>;
}

export interface RealtimeFanout {
  describe(): AdapterDescriptor<{ distributed: boolean; push: boolean }>;
  publish(topic: string, payload: string): Promise<void>;
  subscribe(topic: string, onMessage: (payload: string) => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

/**
 * One external way to reach a user (phone push now; Slack, email later). Resolves "sent" or
 * "endpointGone"; throws on any failure the outbox should retry. `envelope.id` is the idempotency
 * key: a channel must not show the same id twice to one endpoint when the vendor allows it.
 */
export interface NotificationChannel {
  /** The `NotificationDelivery.channel` and `NotificationEndpoint.channel` value, e.g. "push". */
  readonly channel: string;
  describe(): AdapterDescriptor<{ push: boolean; email: boolean }>;
  send(
    envelope: NotificationEnvelope,
    endpoint: NotificationEndpointRef,
    context: AdapterContext,
  ): Promise<NotificationSendResult>;
}

/** Outbound account and security email. Product code owns content; adapters own delivery. */
export interface TransactionalEmailProvider {
  describe(): AdapterDescriptor<{ transactional: boolean }>;
  send(message: TransactionalEmail): Promise<void>;
  /** Wait for accepted in-flight deliveries before a graceful shutdown completes. */
  drain?(): Promise<void>;
}

/**
 * Seat-based subscription billing. Product code owns access rules; adapters own the
 * vendor API. Sync is pull-based: webhooks only say which customer changed.
 */
export interface BillingProvider {
  describe(): AdapterDescriptor<{ trials: boolean; portal: boolean }>;
  getPrice(): Promise<BillingPrice>;
  createCustomer(input: { email: string; organizationId: string }): Promise<{ customerId: string }>;
  createCheckout(input: BillingCheckoutRequest): Promise<{ url: string }>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Current subscription for the customer, preferring one that grants access. */
  getCustomerSubscription(customerId: string): Promise<BillingSubscriptionSnapshot | null>;
  updateSeats(subscriptionItemId: string, seats: number): Promise<void>;
  cancelCustomerSubscriptions(customerId: string): Promise<void>;
  /** Verifies the signature. `null` means the request is not authentic. */
  parseWebhook(rawBody: string, headers: Headers): { customerId: string } | "ignored" | null;
}

export interface ExecutionRunner {
  describe(): AdapterDescriptor<{ cloud: boolean; selfHosted: boolean; desktop: boolean }>;
  dispatch(runId: string, target: "cloud" | "self-hosted" | "desktop"): Promise<void>;
}

export interface VoiceProvider {
  describe(): AdapterDescriptor<VoiceCapabilities>;
  verify(apiKey: string, context: AdapterContext): Promise<VoiceVerifyResult>;
  listVoices(apiKey: string, context: AdapterContext): Promise<VoiceInfo[]>;
  synthesize(request: VoiceSynthesizeRequest, context: AdapterContext): Promise<SpeechClip>;
  transcribe?(request: VoiceTranscribeRequest, context: AdapterContext): Promise<{ text: string }>;
}

/**
 * Deployment-wide external chat surface: one bot presence across messaging
 * platforms (iMessage/SMS, Slack, WhatsApp, …). Conversations are addressed
 * by opaque provider-prefixed thread ids ("sendblue:…", "slack:C1:…"), so
 * orchestration never sees platform wire formats. Webhook verification and
 * payload translation live behind handleWebhook, per platform.
 */
export interface MessagingSurface {
  describe(): AdapterDescriptor<{ providers: string[] }>;
  /** Enabled platforms and what each supports. */
  platforms(): MessagingPlatformDescriptor[];
  /**
   * Verify and process one platform webhook request. Parsed events reach the
   * sink registered via onInbound before the returned response resolves.
   * Returns null for a provider this surface does not host.
   */
  handleWebhook(provider: string, request: Request): Promise<Response> | null;
  /** Register the single downstream consumer of inbound events. */
  onInbound(sink: (event: MessagingInboundEvent) => Promise<void>): void;
  sendToThread(
    request: MessagingSendRequest,
    context: AdapterContext,
  ): Promise<MessagingSendResult>;
  /** Resolve (or create) the 1:1 thread for a provider address. */
  openDirectThread(provider: string, address: string, context: AdapterContext): Promise<string>;
  /**
   * Best-effort "…" typing bubbles for 1:1 chats. Cosmetic: never gates
   * message delivery, and silently no-ops on platforms without support.
   */
  sendTyping(threadId: string, context: AdapterContext): Promise<void>;
  /**
   * Start the surface eagerly instead of waiting for the first inbound
   * webhook or outbound send to touch it. Needed for adapters that pull
   * updates themselves (e.g. Telegram in "auto"/"polling" mode, used when
   * no public webhook URL is reachable): without an explicit call here,
   * nothing kicks off that pull loop until something else happens to
   * initialize the adapter first.
   */
  initialize?(): Promise<void>;
  /**
   * Release long-lived inbound resources (Telegram getUpdates polling) so a
   * replacement process can claim them. No-op when the surface never started.
   */
  shutdown?(): Promise<void>;
}

/**
 * Provider-neutral web search. Builtin `web_search` routes here so backends
 * (keyless HTTP, model-native search, future paid APIs) can be swapped without
 * changing tool names or the executor.
 */
export interface WebSearchProvider {
  describe(): AdapterDescriptor<WebSearchCapabilities>;
  search(request: WebSearchRequest, context: AdapterContext): Promise<WebSearchHit[]>;
}

/**
 * Provider-neutral page fetch. Builtin `web_fetch` routes here. Read-only:
 * no JS execution, no headless browser.
 */
export interface WebFetchProvider {
  describe(): AdapterDescriptor<WebFetchCapabilities>;
  fetch(request: WebFetchRequest, context: AdapterContext): Promise<WebFetchResult>;
}

/** Convenience when one adapter owns both search and fetch. */
export interface WebProvider extends WebSearchProvider, WebFetchProvider {
  describe(): AdapterDescriptor<WebSearchCapabilities & WebFetchCapabilities>;
}

/**
 * Provider-neutral page browser on the bot computer. Builtin browser_* tools
 * route here so backends (in-process page session, CDP against the computer's
 * Chrome, future adapters) can swap without changing tool names. Not a second
 * hosted browser product. Prefer this for web pages; use computer_act when the
 * page tool cannot operate or the task needs the desktop itself.
 */
export interface BrowserProvider {
  describe(): AdapterDescriptor<BrowserCapabilities>;
  navigate(
    computer: ComputerRef,
    request: BrowserNavigateRequest,
    context: AdapterContext,
  ): Promise<BrowserNavigateResult>;
  snapshot(
    computer: ComputerRef,
    request: BrowserSnapshotRequest,
    context: AdapterContext,
  ): Promise<BrowserSnapshotResult>;
  act(
    computer: ComputerRef,
    request: BrowserActRequest,
    context: AdapterContext,
  ): Promise<BrowserActResult>;
}

/**
 * Provider-neutral remote cloud coding agents (clone a repo on a vendor VM,
 * open a PR). Not the bot computer — shell/sandbox stays separate. Core runs
 * with none configured; tools are injected only when a provider is present.
 */
export interface CloudAgentProvider {
  describe(): AdapterDescriptor<CloudAgentCapabilities>;
  launch(request: CloudAgentLaunchRequest, context: AdapterContext): Promise<CloudAgentHandle>;
  get(id: string, context: AdapterContext, runId?: string): Promise<CloudAgentSnapshot>;
  reply(
    id: string,
    request: CloudAgentReplyRequest,
    context: AdapterContext,
  ): Promise<CloudAgentHandle>;
  cancel(id: string, context: AdapterContext, runId?: string): Promise<CloudAgentSnapshot>;
}

/**
 * Provider-neutral "is this tool call safe to auto-allow?" check. First used by
 * Auto Review; swap vendors without changing approval UX (pass → run, ask → card).
 * Core runs with none configured and falls back to the LLM adapter.
 */
export interface AutoReviewProvider {
  describe(): AdapterDescriptor<AutoReviewCapabilities>;
  review(request: AutoReviewRequest, context: AdapterContext): Promise<AutoReviewResult>;
}

/**
 * Provider-neutral first-pass mail classifier. The LLM triage path is the default adapter; an
 * optional vendor adapter labels messages faster and leaves the rest to the LLM. A message the
 * adapter cannot label confidently is omitted from the result, and vendor failures are not thrown.
 */
export interface InboxClassifierProvider {
  describe(): AdapterDescriptor<InboxClassifierCapabilities>;
  classify(
    messages: InboxClassifierMessage[],
    context: AdapterContext,
  ): Promise<InboxClassifyResult>;
}

/** Fixed vector size for the data room's vector column; every Embedder must return this size. */
export const DATA_ROOM_EMBEDDING_DIMENSIONS = 1024;

/**
 * Provider-neutral text embedder. `vectors[i]` belongs to `texts[i]`. Implementations split large
 * inputs into batches of at most `maxBatch`, return vectors of `dimensions` numbers, and do not
 * retry (the job queue does).
 */
export interface Embedder {
  describe(): AdapterDescriptor<{ dimensions: number; maxBatch: number }>;
  embed(texts: string[], context: AdapterContext): Promise<{ model: string; vectors: number[][] }>;
}

/** The configured model does not produce the required vector size, or rejects the request shape. */
export class EmbedderMisconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbedderMisconfiguredError";
  }
}

// --- Data room classifier ---

/**
 * Provider-neutral document classifier for the data room. Throws on unusable model output; the
 * job queue owns retries.
 */
export interface DataRoomClassifier {
  describe(): AdapterDescriptor<Record<string, never>>;
  classify(
    input: {
      name: string;
      mimeType: string;
      text: string;
      folders: string[][];
      /** Party names already in use, so the same party is named the same way. */
      parties?: string[];
    },
    context: AdapterContext,
  ): Promise<DataRoomClassification>;
  planQuery(
    input: { question: string; today: string },
    context: AdapterContext,
  ): Promise<DataRoomQueryPlan>;
}
