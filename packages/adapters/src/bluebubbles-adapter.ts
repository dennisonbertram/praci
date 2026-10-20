import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
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
  type ResolveHostname,
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
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isCloudMetadataHost(host) || isCloudMetadataAddress(host) || isLinkLocalAddress(host)) {
    throw new Error("BlueBubbles server URL points at a blocked address");
  }
  url.search = "";
  url.hash = "";
  return url;
}

/** E.164-style phones and lower-case emails, so one person is one identity. */
export function normalizeIMessageHandle(address: string): string {
  const value = address.trim();
  if (value.includes("@")) return value.toLowerCase();
  const digits = value.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `+${digits.slice(1).replace(/\+/g, "")}` : digits;
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

/** Transport of a raw message: the chat guid's service prefix, else the handle's service. */
export function bluebubblesTransport(raw: unknown): string | null {
  const message = raw as BlueBubblesRawMessage | null;
  const fromChat = message?.chats?.[0]?.guid?.split(";", 1)[0];
  return fromChat || message?.handle?.service || null;
}

function plainText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
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
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly resolveHostname: ResolveHostname;
  private readonly maxChunk: number;
  private readonly now: () => number;
  // ponytail: per-process memory of delivered chunks, so a retry of a
  // half-sent reply skips what already went out. Across processes a retry
  // can still repeat a chunk; a shared store is the upgrade if that bites.
  private readonly sentChunks = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  // ponytail: in-memory poll cursor with a 10 minute lookback on restart.
  // Replays are harmless (client nonce dedupes); persist it if the lookback
  // ever has to be longer than that.
  private cursor: number;

  constructor(private readonly config: BlueBubblesAdapterConfig) {
    if (!config.password || !config.webhookToken) {
      throw new Error("BlueBubbles needs a server password and a webhook token");
    }
    this.base = parseBlueBubblesServerUrl(config.serverUrl);
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.resolveHostname = config.resolveHostname ?? defaultResolveHostname;
    this.maxChunk = config.maxChunkLength ?? BLUEBUBBLES_MAX_CHUNK;
    this.logger = config.logger ?? new ConsoleLogger();
    this.now = config.now ?? Date.now;
    this.cursor = this.now() - 10 * 60_000;
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
    return this.encodeThreadId({ chatGuid: `iMessage;-;${normalizeIMessageHandle(address)}` });
  }

  isDM(threadId: string): boolean {
    return this.decodeThreadId(threadId).chatGuid.includes(";-;");
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const token = new URL(request.url).searchParams.get("token");
    if (!sameSecret(token, this.config.webhookToken)) {
      this.logger.warn("BlueBubbles webhook token mismatch");
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
    try {
      // The body is only a pointer; the server's own copy is the truth.
      const message = await this.fetchByGuid(event.data.guid);
      this.ingest(message, options);
    } catch (error) {
      this.logger.warn("BlueBubbles message fetch failed", { error: String(error) });
      // The server never retries; the catch-up poll recovers this message.
      return new Response("Upstream unavailable", { status: 502 });
    }
    return new Response("OK", { status: 200 });
  }

  /** Feed messages created since the cursor through the normal inbound path. */
  async poll(): Promise<number> {
    const rows = await this.api<BlueBubblesRawMessage[]>("/message/query", {
      method: "POST",
      body: { after: this.cursor, limit: 100, sort: "ASC", with: ["chat", "attachment"] },
    });
    let accepted = 0;
    for (const row of rows) {
      if (this.ingest(row)) accepted += 1;
      if (typeof row.dateCreated === "number") this.cursor = Math.max(this.cursor, row.dateCreated);
    }
    return accepted;
  }

  private ingest(raw: BlueBubblesRawMessage, options?: WebhookOptions): boolean {
    const threadId = this.inboundThreadId(raw);
    if (!threadId || !this.chat) return false;
    void this.chat.processMessage(this, threadId, async () => this.parseMessage(raw), options);
    return true;
  }

  /** Only a real, incoming, direct iMessage text or attachment qualifies. */
  private inboundThreadId(raw: BlueBubblesRawMessage): string | null {
    if (raw.isFromMe || !raw.guid) return null;
    if (raw.itemType || raw.groupActionType || raw.associatedMessageGuid) return null;
    const chatGuid = raw.chats?.[0]?.guid;
    if (!chatGuid?.includes(";-;")) return null;
    if (bluebubblesTransport(raw) !== "iMessage") return null;
    if (!raw.handle?.address) return null;
    if (!this.contentOf(raw)) return null;
    return this.encodeThreadId({ chatGuid });
  }

  private contentOf(raw: BlueBubblesRawMessage): string {
    // Attachments are named, never linked: fetching them needs the server
    // password, which must not reach a model.
    const notes = (raw.attachments ?? []).map(
      (attachment) => `[attachment: ${attachment.mimeType || "file"}]`,
    );
    return [(raw.text ?? "").replace(/￼/g, "").trim(), ...notes].filter(Boolean).join("\n");
  }

  parseMessage(raw: BlueBubblesRawMessage): Message<BlueBubblesRawMessage> {
    const chatGuid = raw.chats?.[0]?.guid ?? "";
    const text = this.contentOf(raw);
    const sender = normalizeIMessageHandle(raw.handle?.address ?? "");
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
    const chunks = chunkIMessageText(this.renderOutbound(message), this.maxChunk);
    const key = sendIdempotency.getStore();
    const keyHash = key ? createHash("sha256").update(key).digest("hex").slice(0, 24) : null;
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
    return plainText(stringifyMarkdown(content));
  }

  private renderOutbound(message: AdapterPostableMessage): string {
    if (typeof message === "string") return plainText(message);
    if ("markdown" in message && typeof message.markdown === "string") {
      return plainText(message.markdown);
    }
    if ("raw" in message && typeof message.raw === "string") return plainText(message.raw);
    if ("ast" in message && message.ast) return plainText(stringifyMarkdown(message.ast));
    return "";
  }

  private fetchByGuid(guid: string): Promise<BlueBubblesRawMessage> {
    return this.api<BlueBubblesRawMessage>(`/message/${encodeURIComponent(guid)}`, {
      query: { with: "chat,attachment" },
    });
  }

  /** One call to the server. Errors never include the URL, which carries the password. */
  private async api<T>(
    path: string,
    init: { method?: "GET" | "POST"; query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    await this.assertResolvable();
    const url = new URL(`${this.base.pathname.replace(/\/$/, "")}/api/v1${path}`, this.base);
    url.searchParams.set("guid", this.config.password);
    for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: init.method ?? "GET",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ...(init.body === undefined
          ? {}
          : { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }),
      });
    } catch {
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

  // ponytail: resolves before each call but does not pin the connection, so a
  // DNS rebind between check and connect is not covered. Fine for an
  // operator-set env URL; pin the lookup if the URL ever becomes user input.
  private async assertResolvable(): Promise<void> {
    const host = this.base.hostname.replace(/^\[|\]$/g, "");
    if (/^[\d.]+$/.test(host) || host.includes(":")) return;
    const addresses = await this.resolveHostname(host).catch(() => []);
    if (addresses.some((a) => isCloudMetadataAddress(a.address) || isLinkLocalAddress(a.address))) {
      throw new BlueBubblesError("BlueBubbles server URL resolves to a blocked address", false);
    }
  }
}
