import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AdvancedIMessage, Message as PhotonMessage } from "@photon-ai/advanced-imessage";
import {
  ConnectionError,
  createHttpClient,
  IMessageError,
  RateLimitError,
} from "@photon-ai/advanced-imessage";
import type {
  AdapterContext,
  IMessageConversation,
  IMessageHistory,
  IMessageHistoryMessage,
} from "@rakazo/adapter-kit";
import type {
  Adapter,
  AdapterPostableMessage,
  ChatInstance,
  FetchResult,
  Logger,
  RawMessage,
  ThreadInfo,
  WebhookOptions,
} from "chat";
import { ConsoleLogger, Message, parseMarkdown, stringifyMarkdown } from "chat";
import {
  BLUEBUBBLES_CUT_NOTE,
  BLUEBUBBLES_MAX_CHUNK,
  BLUEBUBBLES_MAX_CHUNKS,
  chunkIMessageText,
  clipHistoryText,
  HISTORY_TEXT_CHARS,
  normalizeIMessageHandle,
  parseDirectChatGuid,
  sendIdempotency,
  toIMessagePlainText,
} from "./bluebubbles-adapter.js";

/**
 * Chat SDK adapter for Photon's hosted iMessage line (Spectrum Cloud).
 *
 * Inbound: Spectrum POSTs a signed `messages` event. Signature scheme (from
 * photon.codes/docs/webhooks/verifying-signatures): `X-Spectrum-Signature` is
 * `v0=` + hex HMAC-SHA256 of `v0:<X-Spectrum-Timestamp>:<raw body>`, valid for
 * five minutes. Delivery is at-least-once (6 attempts), so replays are
 * expected; the inbound handler claims each message id durably.
 *
 * Outbound: `@photon-ai/advanced-imessage`'s fetch (HTTP) client, with a
 * bearer token minted from the project id and secret
 * (POST /projects/{id}/imessage/tokens, Basic auth). The Chat SDK adapter
 * `chat-adapter-imessage` was not used: it pulls spectrum-ts (about 110 MB,
 * a native better-sqlite3 build) and drops webhook processing failures, which
 * would stop Photon from retrying.
 */

export const PHOTON_CLOUD_URL = "https://spectrum.photon.codes";
/** Host of the shared iMessage proxy that spectrum-ts connects to for shared lines. */
export const PHOTON_DEFAULT_ADDRESS = "imessage.spectrum.photon.codes";
const SIGNATURE_WINDOW_SEC = 5 * 60;
const MIN_WEBHOOK_SECRET_LENGTH = 32;
const REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_REFRESH_FRACTION = 0.8;
const SENT_CHUNK_MEMORY = 1000;
/** Photon has no chat list: conversations come from the newest messages, this many pages of 100. */
const HISTORY_PAGES = 5;
const HISTORY_PAGE_SIZE = 100;
const HISTORY_SNIPPET_CHARS = 120;
/** gRPC status codes the SDK reports: INTERNAL, UNAVAILABLE, DEADLINE_EXCEEDED. */
const RETRYABLE_GRPC_CODES = new Set([4, 13, 14]);

export class PhotonError extends Error {
  constructor(
    message: string,
    /** True for network failures, rate limits and server errors; false for the rest. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PhotonError";
  }
}

export interface PhotonAdapterConfig {
  projectId: string;
  projectSecret: string;
  /** Signing secret shown once when the webhook is registered. */
  webhookSecret: string;
  /** Override of the Spectrum Cloud REST origin. */
  cloudUrl?: string;
  /** Override of the iMessage HTTP address (`host[:port]` or a full http(s) URL). */
  address?: string;
  fetch?: typeof globalThis.fetch;
  logger?: Logger;
  now?: () => number;
}

interface PhotonThreadId {
  chatGuid: string;
}

type PhotonSpace = { id?: string; platform?: string; type?: string; phone?: string };

/** The parts of a Spectrum `messages` delivery this adapter reads. */
export interface PhotonRawMessage {
  event?: string;
  space?: PhotonSpace;
  message?: {
    space?: PhotonSpace;
    id?: string;
    platform?: string;
    direction?: string;
    timestamp?: string;
    service?: string;
    sender?: { id?: string; platform?: string; service?: string };
    content?: { type?: string; text?: string; mimeType?: string };
  };
}

/** Transport of a delivery; only iMessage may wake an agent. */
export function photonTransport(raw: unknown): string | null {
  return isIMessage(raw as PhotonRawMessage) ? "iMessage" : null;
}

function isIMessage(raw: PhotonRawMessage | null | undefined): boolean {
  const message = raw?.message;
  if (message?.platform?.toLowerCase() !== "imessage") return false;
  // Photon's SMS/RCS fallback must not wake an agent. The payload is not
  // documented to say which service carried a message, so refuse it when
  // either field is present and is not iMessage.
  for (const service of [message.service, message.sender?.service]) {
    if (service !== undefined && service.toLowerCase() !== "imessage") return false;
  }
  return true;
}

function sameSignature(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Why a delivery is refused, or null when the signature and timestamp are good. */
export function verifySpectrumSignature(input: {
  secret: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  nowSec: number;
}): { status: number; reason: string } | null {
  if (!input.signature || !input.timestamp) {
    return { status: 400, reason: "missing signature headers" };
  }
  const age = Math.abs(input.nowSec - Number(input.timestamp));
  if (!Number.isFinite(age) || age > SIGNATURE_WINDOW_SEC) {
    return { status: 400, reason: "stale or invalid timestamp" };
  }
  const expected = `v0=${createHmac("sha256", input.secret)
    .update(`v0:${input.timestamp}:${input.rawBody}`)
    .digest("hex")}`;
  return sameSignature(input.signature, expected) ? null : { status: 401, reason: "bad signature" };
}

type TokenGrant =
  | { type: "shared"; token: string; expiresIn: number }
  | {
      type: "dedicated";
      auth: Record<string, string>;
      numbers: Record<string, string>;
      expiresIn: number;
    };

export class PhotonAdapter implements Adapter<PhotonThreadId, PhotonRawMessage>, IMessageHistory {
  readonly name = "photon";
  readonly userName = "rakazo";
  readonly persistMessageHistory = true;
  private chat: ChatInstance | null = null;
  private logger: Logger;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly now: () => number;
  private grant: { value: TokenGrant; refreshAtMs: number } | undefined;
  private granting: Promise<TokenGrant> | undefined;
  private client: AdvancedIMessage | undefined;
  // ponytail: per-process memory of delivered chunks, so a retry of a
  // half-sent reply skips what already went out. The vendor also dedupes on
  // clientMessageId, so a retry from another process is still safe.
  private readonly sentChunks = new Set<string>();

  constructor(private readonly config: PhotonAdapterConfig) {
    if (!config.projectId || !config.projectSecret) {
      throw new Error("Photon needs the project id and secret");
    }
    if (config.webhookSecret.length < MIN_WEBHOOK_SECRET_LENGTH) {
      throw new Error(
        `Photon webhook signing secret must be at least ${MIN_WEBHOOK_SECRET_LENGTH} characters (Photon issues 64)`,
      );
    }
    if (config.address) {
      try {
        const url = new URL(
          /^https?:\/\//.test(config.address) ? config.address : `https://${config.address}`,
        );
        if (url.username || url.password) throw new Error("credentials");
      } catch {
        throw new Error(
          "Photon iMessage address must be host[:port] or an http(s) URL without credentials",
        );
      }
    }
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.now = config.now ?? Date.now;
    this.logger = config.logger ?? new ConsoleLogger();
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    this.logger = chat.getLogger("photon");
  }

  encodeThreadId(data: PhotonThreadId): string {
    return `photon:${Buffer.from(data.chatGuid).toString("base64url")}`;
  }

  decodeThreadId(threadId: string): PhotonThreadId {
    const [prefix, encoded] = threadId.split(":");
    if (prefix !== "photon" || !encoded) throw new Error(`Invalid Photon thread ID: ${threadId}`);
    return { chatGuid: Buffer.from(encoded, "base64url").toString() };
  }

  channelIdFromThreadId(threadId: string): string {
    return threadId;
  }

  /** Direct chat guid for an address (`any;-;<address>`, the shape Photon reports). */
  directThreadId(address: string): string {
    const handle = normalizeIMessageHandle(address);
    if (!handle) throw new Error("Not an iMessage address (expected +E.164 or an email)");
    return this.encodeThreadId({ chatGuid: `any;-;${handle}` });
  }

  isDM(threadId: string): boolean {
    return parseDirectChatGuid(this.decodeThreadId(threadId).chatGuid) !== null;
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const rawBody = await request.text();
    const refusal = verifySpectrumSignature({
      secret: this.config.webhookSecret,
      signature: request.headers.get("x-spectrum-signature"),
      timestamp: request.headers.get("x-spectrum-timestamp"),
      rawBody,
      nowSec: Math.floor(this.now() / 1000),
    });
    if (refusal) {
      this.logger.warn("Rejected Photon webhook delivery", { reason: refusal.reason });
      return new Response(refusal.reason, { status: refusal.status });
    }
    let payload: PhotonRawMessage;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
    const threadId = this.inboundThreadId(payload);
    // Ignored deliveries still get a 200 so Photon does not retry them.
    if (!threadId) return new Response("OK", { status: 200 });
    if (!this.chat) return new Response("Photon adapter is not initialized", { status: 500 });
    const chat = this.chat;
    const dedupeKey = `dedupe:${this.name}:${payload.message?.id}`;
    // The Chat SDK remembers each message id for a few minutes and would drop
    // Photon's retry of a delivery whose processing failed. Our durable claim
    // is the dedupe that matters, so forget the SDK's note of a failed attempt.
    const waitUntil = (task: Promise<unknown>) => {
      const guarded = task.catch(async (error) => {
        await chat
          .getState()
          .delete(dedupeKey)
          .catch(() => undefined);
        throw error;
      });
      if (options?.waitUntil) options.waitUntil(guarded);
      else guarded.catch(() => undefined);
    };
    try {
      await chat.processMessage(this, threadId, async () => this.parseMessage(payload), {
        ...options,
        waitUntil,
      });
    } catch (error) {
      await chat
        .getState()
        .delete(dedupeKey)
        .catch(() => undefined);
      this.logger.warn("Photon inbound processing failed", { error: String(error) });
      return new Response("Inbound processing failed", { status: 500 });
    }
    return new Response("OK", { status: 200 });
  }

  /** Only a real, incoming, direct iMessage text or attachment from a well-formed handle qualifies. */
  private inboundThreadId(payload: PhotonRawMessage): string | null {
    if (payload.event !== "messages") return null;
    const message = payload.message;
    if (!message?.id || message.direction === "outbound") return null;
    if (!isIMessage(payload)) return null;
    const space = message.space ?? payload.space;
    if (space?.type !== "dm") return null;
    const chat = parseDirectChatGuid(space.id);
    const sender = normalizeIMessageHandle(message.sender?.id ?? "");
    // The reply goes to the chat; the sender is the handle. They must agree.
    if (!chat || !sender || sender !== normalizeIMessageHandle(chat.id)) return null;
    if (!this.contentOf(payload)) return null;
    return this.encodeThreadId({ chatGuid: `any;-;${sender}` });
  }

  private contentOf(payload: PhotonRawMessage): string {
    const content = payload.message?.content;
    if (content?.type === "text") return (content.text ?? "").replace(/￼/g, "").trim();
    // Attachment bytes are not in the payload; only the kind is passed on.
    if (content?.type === "attachment") return `[attachment: ${content.mimeType || "file"}]`;
    return "";
  }

  parseMessage(raw: PhotonRawMessage): Message<PhotonRawMessage> {
    const sender = normalizeIMessageHandle(raw.message?.sender?.id ?? "") ?? "";
    const text = this.contentOf(raw);
    const sent = raw.message?.timestamp ? new Date(raw.message.timestamp) : new Date(this.now());
    return new Message({
      id: raw.message?.id ?? "",
      threadId: this.encodeThreadId({ chatGuid: `any;-;${sender}` }),
      text,
      formatted: parseMarkdown(text),
      raw,
      author: { userId: sender, userName: sender, fullName: "", isBot: false, isMe: false },
      metadata: {
        dateSent: Number.isNaN(sent.getTime()) ? new Date(this.now()) : sent,
        edited: false,
      },
      isMention: true,
      attachments: [],
    });
  }

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<PhotonRawMessage>> {
    const { chatGuid } = this.decodeThreadId(threadId);
    if (!parseDirectChatGuid(chatGuid)) {
      throw new PhotonError("Photon can only reply in direct chats", false);
    }
    let chunks = chunkIMessageText(this.renderOutbound(message), BLUEBUBBLES_MAX_CHUNK);
    if (chunks.length === 0) throw new PhotonError("Photon has nothing to send", false);
    if (chunks.length > BLUEBUBBLES_MAX_CHUNKS) {
      chunks = [...chunks.slice(0, BLUEBUBBLES_MAX_CHUNKS), BLUEBUBBLES_CUT_NOTE];
    }
    // The key is the unique outbox row id, so a retry of one row reuses the
    // same client message ids and the vendor drops what it already sent.
    const key = sendIdempotency.getStore();
    const keyHash = key
      ? createHash("sha256").update(`${chatGuid}\n${key}`).digest("hex").slice(0, 24)
      : null;
    const im = await this.imessage();
    let lastId = "";
    for (const [index, chunk] of chunks.entries()) {
      const clientMessageId = `rkz-${keyHash ?? randomUUID()}-${index}`;
      if (this.sentChunks.has(clientMessageId)) continue;
      try {
        const sent = await im.messages.sendText(chatGuid, chunk, { clientMessageId });
        lastId = sent.guid || lastId;
      } catch (error) {
        throw toPhotonError(error);
      }
      this.sentChunks.add(clientMessageId);
      if (this.sentChunks.size > SENT_CHUNK_MEMORY) {
        this.sentChunks.delete(this.sentChunks.values().next().value as string);
      }
    }
    return { id: lastId, threadId, raw: {} };
  }

  async startTyping(threadId: string): Promise<void> {
    const im = await this.imessage();
    await im.chats.setTyping(this.decodeThreadId(threadId).chatGuid, true).catch((error) => {
      throw toPhotonError(error);
    });
  }

  async editMessage(): Promise<RawMessage<PhotonRawMessage>> {
    throw new Error("Photon messages are not edited");
  }

  async deleteMessage(): Promise<void> {
    this.logger.warn("Photon deleteMessage is not supported");
  }

  async addReaction(): Promise<void> {
    this.logger.debug("Photon reactions are not used; ignored");
  }

  async removeReaction(): Promise<void> {
    this.logger.debug("Photon reactions are not used; ignored");
  }

  async fetchMessages(): Promise<FetchResult<PhotonRawMessage>> {
    return { messages: [] };
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    return {
      id: threadId,
      channelId: this.channelIdFromThreadId(threadId),
      isDM: this.isDM(threadId),
      metadata: { ...this.decodeThreadId(threadId) },
    };
  }

  renderFormatted(content: Parameters<Adapter["renderFormatted"]>[0]): string {
    return toIMessagePlainText(stringifyMarkdown(content));
  }

  private renderOutbound(message: AdapterPostableMessage): string {
    if (typeof message === "string") return toIMessagePlainText(message);
    if ("markdown" in message && typeof message.markdown === "string") {
      return toIMessagePlainText(message.markdown);
    }
    if ("raw" in message && typeof message.raw === "string") {
      return toIMessagePlainText(message.raw);
    }
    if ("ast" in message && message.ast) {
      return toIMessagePlainText(stringifyMarkdown(message.ast));
    }
    return "";
  }

  async listConversations(
    options: { limit: number },
    _context: AdapterContext,
  ): Promise<IMessageConversation[]> {
    const im = await this.imessage();
    const newest = new Map<string, IMessageConversation>();
    let pageToken: string | undefined;
    for (let page = 0; page < HISTORY_PAGES; page += 1) {
      const result = await im.messages
        .listRecent({ pageSize: HISTORY_PAGE_SIZE, ...(pageToken ? { pageToken } : {}) })
        .catch((error) => {
          throw toPhotonError(error);
        });
      for (const message of result.messages) {
        const entry = this.historyEntry(message);
        const handle = parseDirectChatGuid(message.chatGuids[0])?.id;
        const chatGuid = message.chatGuids[0];
        if (!entry || !chatGuid || !handle) continue;
        const known = newest.get(chatGuid);
        if (known && known.lastMessageAt >= entry.at) continue;
        newest.set(chatGuid, {
          threadId: this.encodeThreadId({ chatGuid }),
          handle: normalizeIMessageHandle(handle) ?? handle,
          lastMessageAt: entry.at,
          snippet: clipHistoryText(entry.text.replaceAll(/\s+/g, " "), HISTORY_SNIPPET_CHARS),
        });
      }
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    return [...newest.values()]
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .slice(0, options.limit);
  }

  async readConversation(
    threadId: string,
    options: { limit: number; cursor?: string },
    _context: AdapterContext,
  ): Promise<{ handle: string; messages: IMessageHistoryMessage[]; nextCursor?: string }> {
    const { chatGuid } = this.decodeThreadId(threadId);
    const direct = parseDirectChatGuid(chatGuid);
    const handle = normalizeIMessageHandle(direct?.id ?? "");
    if (!handle) {
      throw new PhotonError("Photon history is limited to direct chats", false);
    }
    const im = await this.imessage();
    const result = await im.messages
      .listInChat(chatGuid, {
        pageSize: Math.min(options.limit, HISTORY_PAGE_SIZE),
        ...(options.cursor ? { pageToken: options.cursor } : {}),
      })
      .catch((error) => {
        throw toPhotonError(error);
      });
    const messages = result.messages
      .flatMap((message) => this.historyEntry(message) ?? [])
      .sort((a, b) => a.at.localeCompare(b.at));
    return {
      handle,
      messages,
      ...(result.nextPageToken ? { nextCursor: result.nextPageToken } : {}),
    };
  }

  /** A real iMessage text or attachment, or null for reactions, system events and SMS/RCS. */
  private historyEntry(message: PhotonMessage): (IMessageHistoryMessage & { id: string }) | null {
    const service = message.sender?.service;
    if (service === "SMS" || service === "RCS") return null;
    if (message.reaction || message.isSystemMessage || message.itemType !== "normal") return null;
    const notes = message.content.attachments.map(
      (attachment) => `[attachment: ${attachment.mimeType || "file"}]`,
    );
    const text = [(message.content.text ?? "").replace(/\uFFFC/g, "").trim(), ...notes]
      .filter(Boolean)
      .join("\n");
    if (!text) return null;
    return {
      id: message.guid,
      direction: message.isFromMe ? "outbound" : "inbound",
      at: message.dateCreated.toISOString(),
      text: clipHistoryText(text, HISTORY_TEXT_CHARS),
    };
  }

  /** Setup check: mint a line token, which fails on bad project credentials. */
  async check(): Promise<void> {
    await this.mintTokens();
  }

  /** One HTTP client for the process; it asks for a fresh token on every call. */
  private async imessage(): Promise<AdvancedIMessage> {
    if (this.client) return this.client;
    const grant = await this.tokens();
    // ponytail: a dedicated project with several lines sends through the
    // first one; route by the delivery's `space.phone` if that is needed.
    const instance = grant.type === "dedicated" ? Object.keys(grant.auth).sort()[0] : undefined;
    this.client = createHttpClient({
      address: this.config.address ?? PHOTON_DEFAULT_ADDRESS,
      timeout: REQUEST_TIMEOUT_MS,
      ...(instance ? { server: instance } : {}),
      token: async () => {
        const current = await this.tokens();
        if (current.type === "shared") return current.token;
        return current.auth[instance ?? ""] ?? Object.values(current.auth)[0] ?? "";
      },
    });
    return this.client;
  }

  /** The project's current token grant, renewed at 80% of its lifetime. */
  private tokens(): Promise<TokenGrant> {
    if (this.grant && this.now() < this.grant.refreshAtMs) return Promise.resolve(this.grant.value);
    this.granting ??= this.mintTokens().finally(() => {
      this.granting = undefined;
    });
    return this.granting;
  }

  private async mintTokens(): Promise<TokenGrant> {
    const { projectId, projectSecret } = this.config;
    const basic = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.config.cloudUrl ?? PHOTON_CLOUD_URL}/projects/${encodeURIComponent(projectId)}/imessage/tokens`,
        {
          method: "POST",
          headers: { authorization: `Basic ${basic}` },
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      throw new PhotonError("Photon token request failed", true);
    }
    if (!response.ok) {
      throw new PhotonError(
        `Photon token request returned ${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    }
    const body = (await response.json().catch(() => null)) as {
      succeed?: boolean;
      data?: TokenGrant;
    } | null;
    if (!body?.succeed || !body.data)
      throw new PhotonError("Photon token response was invalid", false);
    this.grant = {
      value: body.data,
      refreshAtMs: this.now() + body.data.expiresIn * 1000 * TOKEN_REFRESH_FRACTION,
    };
    return body.data;
  }
}

/** Retryable: connection trouble, rate limits and server errors. Everything else is permanent. */
function toPhotonError(error: unknown): PhotonError {
  if (error instanceof PhotonError) return error;
  if (error instanceof IMessageError) {
    const retryable =
      error.retryable ||
      error instanceof ConnectionError ||
      error instanceof RateLimitError ||
      RETRYABLE_GRPC_CODES.has(error.grpcCode);
    return new PhotonError(`Photon send failed (${error.code})`, retryable);
  }
  return new PhotonError("Photon send failed", true);
}
