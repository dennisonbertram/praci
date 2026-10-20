import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { isCloudMetadataHost } from "@rakazo/contracts";
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
  defaultResolveHostname,
  isCloudMetadataAddress,
  isLinkLocalAddress,
  normalizeUrlHostname,
  type ResolveHostname,
  withPinnedDnsLookup,
} from "./network-address.js";

/**
 * Chat SDK adapter for a self-hosted BlueBubbles server (macOS bridge to
 * iMessage). Endpoints and fields were checked against the server source
 * (BlueBubblesApp/bluebubbles-server, packages/server/src/server):
 *   - api/http/api/v1/httpRoutes.ts: POST /message/text, POST /message/query,
 *     GET /message/:guid, POST|DELETE /webhook, GET /ping.
 *   - api/http/api/v1/middleware/authMiddleware.ts: the server password is
 *     read from the `guid`, `password` or `token` query parameter only.
 *   - services/webhookService: events are POSTed once as {type, data} with no
 *     signature and no retry, so this adapter authenticates webhooks with its
 *     own URL token and re-fetches each message by guid instead of trusting
 *     the body.
 *   - databases/imessage/index.ts: query `after` is epoch milliseconds
 *     compared with message.date (>=), `sort` is "ASC" | "DESC".
 */

export const BLUEBUBBLES_MAX_CHUNK = 2000;
/** A reply longer than this many chunks is cut and closed with a short note. */
export const BLUEBUBBLES_MAX_CHUNKS = 5;
export const BLUEBUBBLES_CUT_NOTE = "[Reply cut short. Ask me to continue.]";
const MIN_WEBHOOK_TOKEN_LENGTH = 32;
const POLL_LOOKBACK_MS = 10 * 60_000;
/** A message that keeps failing this long after it arrived is skipped so it cannot block the poll. */
const POISON_AGE_MS = 24 * 60 * 60_000;
const TOKEN_WARN_EVERY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const SENT_CHUNK_MEMORY = 1000;

/** Set around a send so retries of one outbox row reuse the same tempGuids. */
export const sendIdempotency = new AsyncLocalStorage<string>();

export class BlueBubblesError extends Error {
  constructor(
    message: string,
    /** True for network failures, 429 and 5xx; false for other 4xx. */
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BlueBubblesError";
  }
}

/**
 * Where the catch-up poll keeps its position. `acquire` returns undefined when
 * another replica holds the poll for this interval.
 */
export interface BlueBubblesPollState {
  acquire(leaseMs: number): Promise<{ cursorMs: number | null } | undefined>;
  advance(cursorMs: number): Promise<void>;
}

/** Single-process poll state (tests, or deployments with one API process). */
export function memoryPollState(): BlueBubblesPollState {
  let cursor: number | null = null;
  let leaseUntil = 0;
  return {
    async acquire(leaseMs) {
      if (Date.now() < leaseUntil) return undefined;
      leaseUntil = Date.now() + leaseMs;
      return { cursorMs: cursor };
    },
    async advance(cursorMs) {
      cursor = Math.max(cursor ?? 0, cursorMs);
    },
  };
}

export interface BlueBubblesThreadId {
  chatGuid: string;
}

export interface BlueBubblesHandle {
  address?: string;
  service?: string;
}

export interface BlueBubblesRawMessage {
  guid: string;
  text?: string | null;
  isFromMe?: boolean;
  dateCreated?: number | null;
  itemType?: number;
  groupActionType?: number;
  associatedMessageGuid?: string | null;
  handle?: BlueBubblesHandle | null;
  chats?: { guid?: string }[];
  attachments?: { guid?: string; mimeType?: string | null; transferName?: string | null }[];
}

export interface BlueBubblesAdapterConfig {
  serverUrl: string;
  password: string;
  /** Random secret in the webhook URL (?token=). BlueBubbles cannot sign webhooks. */
  webhookToken: string;
  fetch?: typeof globalThis.fetch;
  resolveHostname?: ResolveHostname;
  /** Catch-up poll interval; 0 disables polling (outbound-only processes). */
  pollIntervalMs?: number;
  /** Shared across replicas in production; defaults to in-process state. */
  pollState?: BlueBubblesPollState;
  maxChunkLength?: number;
  logger?: Logger;
  now?: () => number;
}

/**
 * Operator-set URL, so private LAN, loopback and tailnet hosts are fine; only
 * credentials in the URL, non-HTTP schemes and cloud metadata/link-local
 * targets are refused.
 */
export function parseBlueBubblesServerUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("BlueBubbles server URL is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BlueBubbles server URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("BlueBubbles server URL must not contain credentials");
  }
  if (url.pathname.replace(/\/+$/, "").includes("//")) {
    throw new Error("BlueBubbles server URL path must not contain //");
  }
  const host = normalizeUrlHostname(url);
  if (isCloudMetadataHost(host) || isCloudMetadataAddress(host) || isLinkLocalAddress(host)) {
    throw new Error("BlueBubbles server URL points at a blocked address");
  }
  url.search = "";
  url.hash = "";
  return url;
}

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** E.164 phone or lower-case email, so one person is one identity; anything else is not a handle. */
export function normalizeIMessageHandle(address: string): string | null {
  const value = address.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL.test(email) ? email : null;
  }
  const phone = value.replace(/[\s().-]/g, "");
  return E164.test(phone) ? phone : null;
}

/** `<service>;-;<id>` direct chat guid, or null for groups and anything malformed. */
export function parseDirectChatGuid(
  guid: string | undefined,
): { service: string; id: string } | null {
  const match = /^([A-Za-z]+);-;([^;]+)$/.exec(guid ?? "");
  return match ? { service: match[1]!, id: match[2]! } : null;
}

/** Split at paragraph, line, sentence, then space boundaries; never inside a surrogate pair. */
export function chunkIMessageText(text: string, max = BLUEBUBBLES_MAX_CHUNK): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = -1;
    for (const separator of ["\n\n", "\n", ". ", " "]) {
      const at = rest.lastIndexOf(separator, max - separator.length);
      if (at > max / 2) {
        cut = at + separator.length;
        break;
      }
    }
    if (cut < 0) {
      cut = max;
      const code = rest.charCodeAt(cut - 1);
      if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
    }
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Transport of a raw message: the service in its direct chat guid; the handle's own claim is not trusted. */
export function bluebubblesTransport(raw: unknown): string | null {
  const message = raw as BlueBubblesRawMessage | null;
  return parseDirectChatGuid(message?.chats?.[0]?.guid)?.service ?? null;
}

/**
 * Markdown to plain text. Emphasis marks come off only when they hug the text
 * they wrap and are not inside a word, so "2 * 3 * 4", "*.js and *.ts" and
 * "a*b*c" stay as written.
 */
export function toIMessagePlainText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(?<![\w*])\*{3}(?=[^\s*])(.+?)(?<=[^\s*])\*{3}(?![\w*])/g, "$1")
    .replace(/(?<![\w*])\*{2}(?=[^\s*])(.+?)(?<=[^\s*])\*{2}(?![\w*])/g, "$1")
    .replace(/(?<![\w*])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![\w*])/g, "$1")
    .replace(/(?<![\w~])~~(?=\S)(.+?)(?<=\S)~~(?![\w~])/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "\u2022 ")
    .trim();
}

function sameSecret(given: string | null, expected: string): boolean {
  if (given === null) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export class BlueBubblesAdapter implements Adapter<BlueBubblesThreadId, BlueBubblesRawMessage> {
  readonly name = "bluebubbles";
  readonly userName = "rakazo";
  readonly persistMessageHistory = true;
  private chat: ChatInstance | null = null;
  private logger: Logger;
  private readonly base: URL;
  private readonly basePath: string;
  private readonly host: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly resolveHostname: ResolveHostname;
  private readonly maxChunk: number;
  private readonly now: () => number;
  private readonly pollState: BlueBubblesPollState;
  private readonly pollLeaseMs: number;
  // ponytail: per-process memory of delivered chunks, so a retry of a
  // half-sent reply skips what already went out. Across processes a retry
  // can still repeat a chunk; a shared store is the upgrade if that bites.
  private readonly sentChunks = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private lastTokenWarn = 0;

  constructor(private readonly config: BlueBubblesAdapterConfig) {
    if (!config.password) throw new Error("BlueBubbles needs the server password");
    if (config.webhookToken.length < MIN_WEBHOOK_TOKEN_LENGTH) {
      throw new Error(
        `BlueBubbles webhook token must be at least ${MIN_WEBHOOK_TOKEN_LENGTH} characters (try: openssl rand -hex 32)`,
      );
    }
    this.base = parseBlueBubblesServerUrl(config.serverUrl);
    this.basePath = this.base.pathname.replace(/\/+$/, "");
    this.host = normalizeUrlHostname(this.base);
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.resolveHostname = config.resolveHostname ?? defaultResolveHostname;
    this.maxChunk = config.maxChunkLength ?? BLUEBUBBLES_MAX_CHUNK;
    this.logger = config.logger ?? new ConsoleLogger();
    this.now = config.now ?? Date.now;
    this.pollState = config.pollState ?? memoryPollState();
    this.pollLeaseMs = Math.max(0, (config.pollIntervalMs ?? 0) * 0.8);
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    this.logger = chat.getLogger("bluebubbles");
    const interval = this.config.pollIntervalMs ?? 0;
    if (interval > 0 && !this.pollTimer) {
      this.pollTimer = setInterval(() => {
        void this.poll().catch((error) =>
          this.logger.warn("BlueBubbles catch-up poll failed", { error: String(error) }),
        );
      }, interval);
      this.pollTimer.unref?.();
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  encodeThreadId(data: BlueBubblesThreadId): string {
    return `bluebubbles:${Buffer.from(data.chatGuid).toString("base64url")}`;
  }

  decodeThreadId(threadId: string): BlueBubblesThreadId {
    const [prefix, encoded] = threadId.split(":");
    if (prefix !== "bluebubbles" || !encoded) {
      throw new Error(`Invalid BlueBubbles thread ID: ${threadId}`);
    }
    return { chatGuid: Buffer.from(encoded, "base64url").toString() };
  }

  channelIdFromThreadId(threadId: string): string {
    return threadId;
  }

  /** Direct chat guid for an address, matching what BlueBubbles reports. */
  directThreadId(address: string): string {
    const handle = normalizeIMessageHandle(address);
    if (!handle) throw new Error("Not an iMessage address (expected +E.164 or an email)");
    return this.encodeThreadId({ chatGuid: `iMessage;-;${handle}` });
  }

  isDM(threadId: string): boolean {
    return parseDirectChatGuid(this.decodeThreadId(threadId).chatGuid) !== null;
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const token = new URL(request.url).searchParams.get("token");
    if (!sameSecret(token, this.config.webhookToken)) {
      // Sampled: a guessing client must not be able to flood the logs.
      if (this.now() - this.lastTokenWarn > TOKEN_WARN_EVERY_MS) {
        this.lastTokenWarn = this.now();
        this.logger.warn("BlueBubbles webhook token mismatch");
      }
      return new Response("Unauthorized", { status: 401 });
    }
    let event: { type?: unknown; data?: { guid?: unknown } };
    try {
      event = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
    if (event.type !== "new-message" || typeof event.data?.guid !== "string") {
      return new Response("OK", { status: 200 });
    }
    let message: BlueBubblesRawMessage;
    try {
      // The body is only a pointer; the server's own copy is the truth.
      message = await this.fetchByGuid(event.data.guid);
    } catch (error) {
      this.logger.warn("BlueBubbles message fetch failed", { error: String(error) });
      // The server never retries; the catch-up poll recovers this message.
      return new Response("Upstream unavailable", { status: 502 });
    }
    try {
      await this.ingest(message, options);
    } catch (error) {
      this.logger.warn("BlueBubbles inbound processing failed", { error: String(error) });
      // The inbound claim was released, so the next poll delivers it.
      return new Response("Inbound processing failed", { status: 500 });
    }
    return new Response("OK", { status: 200 });
  }

  /**
   * Feed messages created since the saved cursor through the normal inbound
   * path, in order. The cursor moves only past messages that were processed;
   * on a failure it stays at the last success and the next poll retries from
   * there. Only the replica holding the lease polls. Re-seeing a message is
   * safe: the inbound handler claims each provider message id durably.
   */
  async poll(): Promise<number> {
    const lease = await this.pollState.acquire(this.pollLeaseMs);
    if (!lease) return 0;
    const now = this.now();
    // Never trust a saved cursor from the future: it would hide new messages.
    let cursor = Math.min(lease.cursorMs ?? now - POLL_LOOKBACK_MS, now);
    const rows = await this.api<BlueBubblesRawMessage[]>("/message/query", {
      method: "POST",
      body: { after: cursor, limit: 100, sort: "ASC", with: ["chat", "attachment"] },
    });
    let accepted = 0;
    for (const row of rows) {
      try {
        if (await this.ingest(row)) accepted += 1;
      } catch (error) {
        if ((row.dateCreated ?? now) >= now - POISON_AGE_MS) {
          await this.pollState.advance(cursor);
          throw error;
        }
        this.logger.error("BlueBubbles skipping a message that failed for over a day", {
          error: String(error),
        });
      }
      if (typeof row.dateCreated === "number") {
        cursor = Math.min(Math.max(cursor, row.dateCreated), now);
      }
    }
    await this.pollState.advance(cursor);
    return accepted;
  }

  /** True when the message was handed to the inbound pipeline; throws when that pipeline failed. */
  private async ingest(raw: BlueBubblesRawMessage, options?: WebhookOptions): Promise<boolean> {
    const threadId = this.inboundThreadId(raw);
    if (!threadId) return false;
    if (!this.chat) throw new Error("BlueBubbles adapter is not initialized");
    try {
      await this.chat.processMessage(this, threadId, async () => this.parseMessage(raw), options);
    } catch (error) {
      // The Chat SDK remembers every message id it has seen for a few minutes
      // and would drop the retry as a duplicate; our durable claim is the
      // dedupe that matters, so forget the SDK's note of a failed attempt.
      await this.chat.getState().delete(`dedupe:${this.name}:${raw.guid}`);
      throw error;
    }
    return true;
  }

  /** Only a real, incoming, direct iMessage text or attachment from a well-formed handle qualifies. */
  private inboundThreadId(raw: BlueBubblesRawMessage): string | null {
    if (raw.isFromMe || !raw.guid) return null;
    if (raw.itemType || raw.groupActionType || raw.associatedMessageGuid) return null;
    const chatGuid = raw.chats?.[0]?.guid;
    const chat = parseDirectChatGuid(chatGuid);
    if (!chatGuid || chat?.service !== "iMessage") return null;
    const sender = normalizeIMessageHandle(raw.handle?.address ?? "");
    // The reply goes to the chat; the sender is the handle. They must agree.
    if (!sender || sender !== normalizeIMessageHandle(chat.id)) return null;
    if (!this.contentOf(raw)) return null;
    return this.encodeThreadId({ chatGuid });
  }

  private contentOf(raw: BlueBubblesRawMessage): string {
    // Attachments are named, never linked: fetching them needs the server
    // password, which must not reach a model.
    const notes = (raw.attachments ?? []).map(
      (attachment) => `[attachment: ${attachment.mimeType || "file"}]`,
    );
    return [(raw.text ?? "").replace(/\uFFFC/g, "").trim(), ...notes].filter(Boolean).join("\n");
  }

  parseMessage(raw: BlueBubblesRawMessage): Message<BlueBubblesRawMessage> {
    const chatGuid = raw.chats?.[0]?.guid ?? "";
    const text = this.contentOf(raw);
    const sender = normalizeIMessageHandle(raw.handle?.address ?? "") ?? "";
    return new Message({
      id: raw.guid,
      threadId: this.encodeThreadId({ chatGuid }),
      text,
      formatted: parseMarkdown(text),
      raw,
      author: {
        userId: sender,
        userName: sender,
        fullName: "",
        isBot: false,
        isMe: Boolean(raw.isFromMe),
      },
      metadata: { dateSent: new Date(raw.dateCreated ?? this.now()), edited: false },
      isMention: !raw.isFromMe,
      attachments: [],
    });
  }

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<BlueBubblesRawMessage>> {
    const { chatGuid } = this.decodeThreadId(threadId);
    // Plain iMessage direct chats only: never a group or an SMS chat guid.
    if (parseDirectChatGuid(chatGuid)?.service !== "iMessage") {
      throw new BlueBubblesError("BlueBubbles can only reply in direct iMessage chats", false);
    }
    let chunks = chunkIMessageText(this.renderOutbound(message), this.maxChunk);
    if (chunks.length > BLUEBUBBLES_MAX_CHUNKS) {
      chunks = [...chunks.slice(0, BLUEBUBBLES_MAX_CHUNKS), BLUEBUBBLES_CUT_NOTE];
    }
    // The key is the unique outbox row id, so reused business keys across
    // approval cycles cannot make a later, different send look like a retry.
    const key = sendIdempotency.getStore();
    const keyHash = key
      ? createHash("sha256").update(`${chatGuid}\n${key}`).digest("hex").slice(0, 24)
      : null;
    let lastGuid = "";
    let last: unknown = {};
    for (const [index, chunk] of chunks.entries()) {
      const tempGuid = `rkz-${keyHash ?? randomUUID()}-${index}`;
      if (this.sentChunks.has(tempGuid)) continue;
      last = await this.api<{ guid?: string }>("/message/text", {
        method: "POST",
        body: { chatGuid, tempGuid, message: chunk, method: "apple-script" },
      });
      this.sentChunks.add(tempGuid);
      if (this.sentChunks.size > SENT_CHUNK_MEMORY) {
        this.sentChunks.delete(this.sentChunks.values().next().value as string);
      }
      lastGuid = (last as { guid?: string }).guid ?? lastGuid;
    }
    return { id: lastGuid, threadId, raw: last as BlueBubblesRawMessage };
  }

  /** Ping plus server info, for setup checks. */
  async check(): Promise<{ privateApi: boolean }> {
    await this.api("/ping");
    const info = await this.api<{ private_api?: boolean }>("/server/info");
    return { privateApi: Boolean(info.private_api) };
  }

  async startTyping(): Promise<void> {
    // Typing indicators need the Private API (SIP off); not used.
  }

  async editMessage(): Promise<RawMessage<BlueBubblesRawMessage>> {
    throw new Error("BlueBubbles messages cannot be edited without the Private API");
  }

  async deleteMessage(): Promise<void> {
    this.logger.warn("BlueBubbles deleteMessage is not supported");
  }

  async addReaction(): Promise<void> {
    this.logger.debug("BlueBubbles reactions need the Private API; ignored");
  }

  async removeReaction(): Promise<void> {
    this.logger.debug("BlueBubbles reactions need the Private API; ignored");
  }

  async fetchMessages(): Promise<FetchResult<BlueBubblesRawMessage>> {
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

  private async fetchByGuid(guid: string): Promise<BlueBubblesRawMessage> {
    const message = await this.api<BlueBubblesRawMessage>(`/message/${encodeURIComponent(guid)}`, {
      query: { with: "chat,attachment" },
    });
    if (message?.guid !== guid)
      throw new BlueBubblesError("BlueBubbles returned another message", false);
    return message;
  }

  /** Origin plus the configured path plus the API path; anything that escapes is refused. */
  private requestUrl(path: string, query: Record<string, string> = {}): URL {
    const prefix = `${this.basePath}/api/v1`;
    const url = new URL(`${prefix}${path}`, this.base.origin);
    // Compared whole: a dot segment in a guid would normalize to a parent path.
    if (url.origin !== this.base.origin || url.pathname !== `${prefix}${path}`) {
      throw new BlueBubblesError("BlueBubbles request path escaped the API prefix", false);
    }
    url.searchParams.set("guid", this.config.password);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return url;
  }

  /** One call to the server. Errors never include the URL, which carries the password. */
  private async api<T>(
    path: string,
    init: { method?: "GET" | "POST"; query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    const url = this.requestUrl(path, init.query);
    const send = () =>
      this.fetchImpl(url, {
        method: init.method ?? "GET",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ...(init.body === undefined
          ? {}
          : { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }),
      });
    let response: Response;
    try {
      response = await this.pinned(send);
    } catch (error) {
      if (error instanceof BlueBubblesError) throw error;
      throw new BlueBubblesError(`BlueBubbles ${path} request failed`, true);
    }
    if (!response.ok) {
      throw new BlueBubblesError(
        `BlueBubbles ${path} returned ${response.status}`,
        response.status === 429 || response.status >= 500,
        response.status,
      );
    }
    const body = (await response.json().catch(() => ({}))) as { data?: T };
    return body.data as T;
  }

  /**
   * Resolve the host once, refuse metadata and link-local answers, and make the
   * connection dial exactly the addresses that were checked, so a DNS answer
   * that changes between check and connect cannot redirect the request.
   */
  private async pinned<T>(run: () => Promise<T>): Promise<T> {
    if (isIP(this.host) !== 0) return run();
    const addresses = await this.resolveHostname(this.host).catch(() => []);
    if (addresses.length === 0) {
      throw new BlueBubblesError("BlueBubbles server host did not resolve", true);
    }
    if (addresses.some((a) => isCloudMetadataAddress(a.address) || isLinkLocalAddress(a.address))) {
      throw new BlueBubblesError("BlueBubbles server URL resolves to a blocked address", false);
    }
    return withPinnedDnsLookup(this.host, addresses, run);
  }
}
