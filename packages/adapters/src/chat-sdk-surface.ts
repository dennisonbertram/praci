import { AsyncLocalStorage } from "node:async_hooks";
import { createMemoryState } from "@chat-adapter/state-memory";
import type {
  AdapterContext,
  AdapterDescriptor,
  IMessageHistory,
  MessagingCapabilities,
  MessagingInboundEvent,
  MessagingInboundMessage,
  MessagingOutboundStatus,
  MessagingPlatformDescriptor,
  MessagingSendRequest,
  MessagingSendResult,
  MessagingSurface,
} from "@rakazo/adapter-kit";
import type { Adapter, Message, Root, Thread } from "chat";
import { Chat, paragraph, root, text } from "chat";
import { sendIdempotency } from "./bluebubbles-adapter.js";

/**
 * Per-webhook drain of Chat SDK waitUntil work, plus the Chat dedupe keys of
 * messages the inbound sink failed on.
 */
const webhookDrain = new AsyncLocalStorage<{
  pending: Promise<unknown>[];
  failedKeys: string[];
  markdownChars: number;
}>();

/**
 * Markdown parsing is superlinear on hostile text (unmatched emphasis, deep
 * quotes), so past this many characters in one webhook the text stays literal.
 */
export const INBOUND_MARKDOWN_MAX_CHARS = 8_000;

/** Bound the adapter's inbound text-to-markdown parsing per webhook; sends are untouched. */
export function boundInboundMarkdown(adapter: Adapter): void {
  const converter = (adapter as unknown as { formatConverter: { toAst(value: string): Root } })
    .formatConverter;
  const toAst = converter.toAst.bind(converter);
  converter.toAst = (value) => {
    const drain = webhookDrain.getStore();
    if (!drain) return toAst(value);
    drain.markdownChars += value.length;
    if (drain.markdownChars <= INBOUND_MARKDOWN_MAX_CHARS) {
      try {
        return toAst(value);
      } catch {
        // Deep nesting overflows the parser's stack.
      }
    }
    return root([paragraph([text(value)])]);
  };
}

/** Inbound webhook bodies larger than this are rejected before parsing. */
export const MESSAGING_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

/**
 * One messaging platform mounted on the surface. The Chat SDK adapter owns
 * webhook verification, payload translation, and platform API calls; the
 * extra hooks cover the few per-platform facts the SDK does not surface.
 */
export interface MessagingPlatform {
  provider: string;
  capabilities: MessagingCapabilities;
  adapter: Adapter;
  /** Deterministic 1:1 thread id for platforms without openDM (sendblue). */
  directThreadId?: (address: string) => string;
  /** Delivery-status events the Chat SDK drops (sendblue is_outbound posts, WhatsApp statuses). */
  peekStatuses?: (payload: unknown) => MessagingOutboundStatus[];
  /**
   * State keys the adapter writes to drop vendor redeliveries of a webhook
   * (Slack's per-event marker). Cleared when the inbound sink fails so the
   * vendor's retry is processed instead of acknowledged and dropped.
   */
  redeliveryKeys?: (payload: unknown) => string[];
  /** Send errors that retrying cannot fix (unknown channel, blocked bot, revoked token). */
  isPermanentSendError?: (error: unknown) => boolean;
  /** Group roster addresses from the raw inbound payload, excluding our line. */
  participants?: (raw: unknown) => string[];
  /** Read access to the line's conversations; only the iMessage providers offer it. */
  history?: IMessageHistory;
  /** Group display name from the raw inbound payload. */
  channelName?: (raw: unknown) => string | null;
  /** User-facing transport carried by the raw message when it differs from the provider. */
  transport?: (raw: unknown) => string | null;
  /**
   * Optional team-room enrichment (workspace id, mention/ambient kind, bot
   * sender, reply thread) derived from the raw platform payload.
   */
  enrichTeamRoom?: (
    raw: unknown,
    base: MessagingInboundMessage,
  ) => Partial<MessagingInboundMessage>;
}

/**
 * MessagingSurface over the Chat SDK (github.com/vercel/chat): one bot
 * presence across every mounted platform. Orchestration stays upstream —
 * this class only translates between Chat SDK events/calls and the
 * provider-neutral contract.
 */
export class ChatSdkMessagingSurface implements MessagingSurface {
  private readonly chat: Chat<Record<string, Adapter>>;
  private readonly byProvider = new Map<string, MessagingPlatform>();
  private sink: ((event: MessagingInboundEvent) => Promise<void>) | undefined;
  private initialized: Promise<void> | undefined;

  constructor(platforms: MessagingPlatform[], options: { userName?: string } = {}) {
    if (platforms.length === 0) throw new Error("ChatSdkMessagingSurface needs >=1 platform");
    for (const platform of platforms) this.byProvider.set(platform.provider, platform);
    this.chat = new Chat({
      userName: options.userName ?? "rakazo",
      adapters: Object.fromEntries(platforms.map((p) => [p.provider, p.adapter])),
      state: createMemoryState(),
      // The SDK default ("drop") takes a per-conversation lock and discards
      // any message that arrives while it is held — and the LockError is
      // swallowed into waitUntil, so the webhook still ACKs 200 and the
      // vendor never retries. Two texts in quick succession would lose the
      // second. Each inbound message already runs inside its own webhook's
      // waitUntil task, so process them independently and let the per-message
      // client nonce downstream handle replay.
      concurrency: "concurrent",
    });
    const deliver = async (thread: Thread, message: Message) => {
      const event = this.toInbound(thread, message);
      if (!event) return;
      try {
        await this.sink?.(event);
      } catch (error) {
        // processMessage hands waitUntil a swallowed promise, so track sink
        // failures here and turn them into HTTP 5xx after the drain.
        webhookDrain.getStore()?.failedKeys.push(chatDedupeKey(thread.adapter, message.id));
        throw error;
      }
    };
    // Priority routing makes these disjoint: DMs, then @-mentions in
    // unsubscribed threads, then the catch-all pattern for everything else.
    // Subscribed threads skip the catch-all and only fire onSubscribedMessage
    // (chat SDK docs / dispatchToHandlersWithSignal); register deliver there too.
    this.chat.onDirectMessage(deliver);
    this.chat.onNewMention(deliver);
    this.chat.onSubscribedMessage(deliver);
    this.chat.onNewMessage(/(?:)/, deliver);
  }

  describe(): AdapterDescriptor<{ providers: string[] }> {
    return {
      id: "chat-sdk",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { providers: [...this.byProvider.keys()] },
    };
  }

  platforms(): MessagingPlatformDescriptor[] {
    return [...this.byProvider.values()].map((platform) => ({
      provider: platform.provider,
      capabilities: platform.capabilities,
    }));
  }

  history(provider: string): IMessageHistory | undefined {
    return this.byProvider.get(provider)?.history;
  }

  onInbound(sink: (event: MessagingInboundEvent) => Promise<void>): void {
    this.sink = sink;
  }

  handleWebhook(provider: string, request: Request): Promise<Response> | null {
    const platform = this.byProvider.get(provider);
    if (!platform) return null;
    return this.dispatchWebhook(platform, request);
  }

  async sendToThread(
    request: MessagingSendRequest,
    _context: AdapterContext,
  ): Promise<MessagingSendResult> {
    await this.ensureInitialized();
    // The adapter derives per-chunk send ids from the outbox key, so a retry of
    // a half-sent reply does not repeat the chunks that already went out.
    const post = () => this.chat.thread(request.threadId).post(request.body);
    const platform = this.byProvider.get(providerOfThreadId(request.threadId));
    try {
      const sent = await (request.idempotencyKey
        ? sendIdempotency.run(request.idempotencyKey, post)
        : post());
      const handle = "id" in sent && typeof sent.id === "string" ? sent.id : "";
      return { handle };
    } catch (error) {
      throw platform ? sendError(platform, error) : error;
    }
  }

  async openDirectThread(
    provider: string,
    address: string,
    _context: AdapterContext,
  ): Promise<string> {
    const platform = this.byProvider.get(provider);
    if (!platform) throw new Error(`Unknown messaging provider: ${provider}`);
    if (platform.directThreadId) return platform.directThreadId(address);
    await this.ensureInitialized();
    if (!platform.adapter.openDM) {
      throw new Error(`${provider} cannot open direct conversations`);
    }
    try {
      return await platform.adapter.openDM(address);
    } catch (error) {
      throw sendError(platform, error);
    }
  }

  async sendTyping(threadId: string, context: AdapterContext): Promise<void> {
    const platform = this.byProvider.get(providerOfThreadId(threadId));
    if (!platform?.capabilities.typing) return;
    await this.ensureInitialized();
    // The Chat SDK adapter API takes no abort signal, so the underlying
    // request cannot be cancelled — but the caller's wait is still bounded.
    await raceWithSignal(platform.adapter.startTyping(threadId), context.signal);
  }

  /**
   * Proactively start the underlying Chat SDK instance. Webhook handling
   * and outbound sends already trigger this lazily (see ensureInitialized
   * below), but a polling-mode adapter (Telegram in "auto" mode with no
   * public webhook URL registered) needs its pull loop running before the
   * first inbound message can ever arrive, so long-running hosts call this
   * explicitly at startup instead of waiting on the first send.
   */
  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Stop Telegram getUpdates before exit. Chat.shutdown() only calls
   * adapter.disconnect(), which Telegram does not implement.
   */
  async shutdown(): Promise<void> {
    const pending = this.initialized;
    this.initialized = undefined;
    if (pending) await pending.catch(() => undefined);
    await this.stopPollingAdapters();
    const chat = this.chat as { shutdown?: () => Promise<void> };
    await chat.shutdown?.().catch(() => undefined);
  }

  private ensureInitialized(): Promise<void> {
    // Webhook handling initializes lazily inside the Chat SDK; proactive
    // sends from job runners need the explicit call. Chat keeps a rejected
    // initPromise until shutdown(), so clear that before allowing a retry.
    if (!this.initialized) {
      this.initialized = this.chat.initialize().catch(async (error) => {
        try {
          // Telegram may already be polling if Promise.all failed on another
          // adapter after Telegram's initialize started getUpdates.
          await this.stopPollingAdapters();
          await (this.chat as { shutdown?: () => Promise<void> }).shutdown?.();
        } catch {
          // Best-effort reset of Chat's cached init failure.
        } finally {
          this.initialized = undefined;
        }
        throw error;
      });
    }
    return this.initialized;
  }

  private async stopPollingAdapters(): Promise<void> {
    for (const platform of this.byProvider.values()) {
      const adapter = platform.adapter as { stopPolling?: () => Promise<void> };
      await adapter.stopPolling?.().catch(() => undefined);
    }
  }

  private async dispatchWebhook(platform: MessagingPlatform, request: Request): Promise<Response> {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MESSAGING_WEBHOOK_MAX_BODY_BYTES) {
      return new Response("Payload too large", { status: 413 });
    }
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? await readBoundedText(request, MESSAGING_WEBHOOK_MAX_BODY_BYTES) : "";
    if (body === null) {
      return new Response("Payload too large", { status: 413 });
    }
    const forwarded = hasBody
      ? new Request(request.url, { method: request.method, headers: request.headers, body })
      : request;
    // Real Chat SDK adapters fire processMessage without awaiting it; they
    // only register the work via waitUntil. Drain that work before ACKing so
    // a vendor 200 cannot race ahead of provision/enqueue, and surface sink
    // failures as 5xx so the vendor retries.
    const drain = {
      pending: [] as Promise<unknown>[],
      failedKeys: [] as string[],
      markdownChars: 0,
    };
    const response = await webhookDrain.run(drain, async () => {
      const adapterResponse = await this.chat.webhooks[platform.provider]!(forwarded, {
        waitUntil: (task) => {
          drain.pending.push(task);
        },
      });
      await Promise.all(drain.pending);
      return adapterResponse;
    });
    const payload = parseJson(body);
    if (drain.failedKeys.length > 0) {
      // Chat marks a message seen before our handler runs (and Slack marks the
      // event delivered), so the vendor's retry would be acknowledged and
      // dropped. Forget the failed deliveries; the sink's per-message client
      // nonce still dedupes anything that partly succeeded.
      const state = this.chat.getState();
      const keys = [...drain.failedKeys, ...(platform.redeliveryKeys?.(payload) ?? [])];
      await Promise.all(keys.map((key) => state.delete(key)));
      return new Response("Inbound processing failed", { status: 500 });
    }
    // Status peeking runs only after the adapter verified and accepted the
    // request — a forged webhook must not be able to flip outbox rows.
    if (platform.peekStatuses && response.status < 300) {
      for (const status of platform.peekStatuses(payload)) await this.sink?.(status);
    }
    return response;
  }

  private toInbound(thread: Thread, message: Message): MessagingInboundMessage | null {
    if (message.author.isMe || message.author.isSystem) return null;
    const provider = providerOfThreadId(thread.id);
    const platform = this.byProvider.get(provider);
    if (!platform) return null;
    const isDirect = thread.isDM;
    if (!isDirect && !platform.capabilities.groups) return null;
    const fromLabel = message.author.fullName || message.author.userName || null;
    const transport = platform.transport?.(message.raw) ?? null;
    const base: MessagingInboundMessage = {
      type: "message",
      provider,
      ...(transport ? { transport } : {}),
      handle: message.id,
      threadId: thread.id,
      isDirect,
      from: message.author.userId,
      fromLabel: fromLabel === message.author.userId ? null : fromLabel,
      channelName: isDirect ? null : (platform.channelName?.(message.raw) ?? null),
      participants: isDirect ? [] : (platform.participants?.(message.raw) ?? []),
      content: message.text ?? "",
      mediaUrl: message.attachments.find((attachment) => attachment.url)?.url ?? null,
    };
    const enrichment = platform.enrichTeamRoom?.(message.raw, base) ?? {};
    return { ...base, ...enrichment };
  }
}

export function providerOfThreadId(threadId: string): string {
  return threadId.split(":", 1)[0] ?? "";
}

function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    promise.catch(() => undefined);
    return Promise.reject(signal.reason ?? new Error("Aborted"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      // The abandoned branch must not surface as an unhandled rejection.
      promise.catch(() => undefined);
      reject(signal.reason ?? new Error("Aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * Read the body incrementally so an unauthenticated chunked request (no
 * trustworthy Content-Length) is cut off at the cap instead of being
 * buffered whole. Returns null once the cap is exceeded.
 */
async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/** The key Chat.routeIncomingMessage marks a message seen under (chat@4.40). */
function chatDedupeKey(adapter: Adapter, messageId: string): string {
  return `dedupe:${adapter.name}:${messageId}`;
}

/**
 * A failed platform send, classified for the outbox: give up when
 * `permanent`, otherwise retry no sooner than `retryAfterMs` when set.
 */
export class MessagingSendError extends Error {
  override readonly name = "MessagingSendError";
  readonly permanent: boolean;
  readonly retryAfterMs: number | null;
  /** The iMessage adapters mark a send that may have gone out; callers still read it here. */
  readonly retryable?: boolean;

  constructor(cause: unknown, options: { permanent: boolean; retryAfterMs: number | null }) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.permanent = options.permanent;
    this.retryAfterMs = options.retryAfterMs;
    const retryable = (cause as { retryable?: unknown } | null)?.retryable;
    if (typeof retryable === "boolean") this.retryable = retryable;
  }
}

function sendError(platform: MessagingPlatform, error: unknown): MessagingSendError {
  // Chat SDK AdapterRateLimitError and Slack's rate-limited error both carry seconds.
  const seconds = (error as { retryAfter?: unknown } | null)?.retryAfter;
  return new MessagingSendError(error, {
    permanent: platform.isPermanentSendError?.(error) ?? false,
    retryAfterMs: typeof seconds === "number" && seconds > 0 ? seconds * 1000 : null,
  });
}
