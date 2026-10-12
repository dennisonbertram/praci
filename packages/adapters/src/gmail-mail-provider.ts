import {
  type AdapterContext,
  type ConnectorProxyResponse,
  type MailAccount,
  type MailAddress,
  type MailListRequest,
  type MailMessage,
  type MailMessagePage,
  type MailMessageSummary,
  type MailProvider,
  MailProviderError,
  type ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { JSDOM } from "jsdom";
import { asRecord } from "./connector-http.js";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_PAGE_SIZE = 500;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 60_000;
// Measured through the Composio proxy (about 290 ms per get): 4 in flight hydrates 11 messages/s,
// 12 gives about 30/s and more adds nothing. 30 gets/s is 150 of Gmail's 250 quota units/s per user.
const CONCURRENCY = 12;
const MAX_TEXT = 40_000;
const MAX_HTML = 200_000;
// Inline `cid:` images are embedded as data: URLs, so each image and the total are capped.
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_INLINE_IMAGES = 10;
const MAX_INLINE_IMAGE_BYTES = 1_048_576;
const MAX_INLINE_TOTAL_BYTES = 4_194_304;
const METADATA_QUERY = ["From", "To", "Cc", "Subject", "Date"]
  .map((name) => `metadataHeaders=${name}`)
  .join("&");
const AUTH_REASONS = new Set(["authError", "insufficientPermissions"]);
const RATE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

export type MailSleep = (ms: number, signal: AbortSignal) => Promise<void>;

export interface GmailMailProviderDeps {
  /**
   * `connection` serves `listAccounts`. `cachedMailMessage` turns on the Postgres metadata cache
   * in `listMessages`; without it (the emulator) every listed id is fetched.
   */
  prisma?: Pick<PrismaClient, "connection"> & Partial<Pick<PrismaClient, "cachedMailMessage">>;
  connectors: { managed(id: string): ManagedConnectorProvider | undefined };
  /** Backoff wait; resolves early when the signal aborts. Injected by tests. */
  sleep?: MailSleep;
  random?: () => number;
}

const defaultSleep: MailSleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });

/** True for a connected Gmail connection that has a remote account id, whichever connector made it. */
export function isMailConnection(row: {
  status: string;
  providerRef: string | null;
  provider: string;
}): boolean {
  return (
    row.status === "connected" &&
    Boolean(row.providerRef) &&
    row.provider.trim().toLowerCase() === "gmail"
  );
}

/** Gmail implementation of `MailProvider`, written once on top of `ManagedConnectorProvider.proxy`. */
export class GmailMailProvider implements MailProvider {
  private readonly slots = new Map<string, { active: number; queue: Array<() => void> }>();
  private readonly sleep: MailSleep;
  private readonly random: () => number;

  constructor(private readonly deps: GmailMailProviderDeps) {
    this.sleep = deps.sleep ?? defaultSleep;
    this.random = deps.random ?? Math.random;
  }

  async listAccounts(
    scope: { spaceId: string; userId: string },
    context: AdapterContext,
  ): Promise<MailAccount[]> {
    if (scope.spaceId !== context.spaceId || scope.userId !== context.userId)
      throw new MailProviderError("auth", "Mail is not available for this user");
    const prisma = this.deps.prisma;
    if (!prisma) throw new Error("GmailMailProvider needs prisma to list accounts");
    const rows = await prisma.connection.findMany({
      where: { spaceId: scope.spaceId, userId: scope.userId, status: "connected" },
      orderBy: { createdAt: "asc" },
    });
    return Promise.all(
      rows.filter(isMailConnection).map(async (row) => {
        const metadata = asRecord(row.metadata) ?? {};
        const known = metadata.mailAddress;
        const account: MailAccount = {
          id: row.id,
          connectorId: row.connectorId,
          app: row.provider,
          accountRef: row.providerRef as string,
          label: row.displayName,
          spaceId: row.spaceId,
          userId: row.userId,
          address: typeof known === "string" && known ? known : null,
        };
        if (account.address) return account;
        try {
          const profile = asRecord(await this.request(account, context, `${GMAIL}/profile`));
          const address = profile?.emailAddress;
          if (typeof address !== "string" || !address) return account;
          account.address = address;
          await prisma.connection
            .updateMany({
              where: { id: row.id, spaceId: row.spaceId, userId: row.userId },
              data: { metadata: { ...metadata, mailAddress: address } as Record<string, string> },
            })
            .catch(() => undefined);
        } catch {
          // The address is optional; the next call tries again.
        }
        return account;
      }),
    );
  }

  async listMessages(
    account: MailAccount,
    request: MailListRequest,
    context: AdapterContext,
  ): Promise<MailMessagePage> {
    assertScope(account, context);
    const { pageSize } = request;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
      throw new RangeError(`pageSize must be an integer from 1 to ${MAX_PAGE_SIZE}`);

    let ids = request.ids;
    let nextPageToken: string | undefined;
    let resultSizeEstimate: number | undefined;
    if (!ids) {
      const params = new URLSearchParams({ maxResults: String(pageSize) });
      const q = buildQuery(request);
      if (q) params.set("q", q);
      if (request.pageToken) params.set("pageToken", request.pageToken);
      const listed = asRecord(await this.request(account, context, `${GMAIL}/messages?${params}`));
      ids = (Array.isArray(listed?.messages) ? listed.messages : []).flatMap((entry: unknown) => {
        const id = asRecord(entry)?.id;
        return typeof id === "string" && id ? [id] : [];
      });
      if (typeof listed?.nextPageToken === "string") nextPageToken = listed.nextPageToken;
      if (typeof listed?.resultSizeEstimate === "number")
        resultSizeEstimate = listed.resultSizeEstimate;
    }

    const wanted = ids;
    const results: Array<MailMessageSummary | undefined> = [];
    const done = new Set<number>();
    const cached = request.useCache === false ? new Map() : await this.readCache(account, wanted);
    wanted.forEach((id, index) => {
      const hit = cached.get(id);
      if (!hit) return;
      results[index] = hit;
      done.add(index);
    });
    let next = 0;
    let stopped = false;
    const worker = async () => {
      while (!stopped && next < wanted.length) {
        const index = next++;
        if (done.has(index)) continue;
        try {
          const data = await this.request(
            account,
            context,
            `${GMAIL}/messages/${encodeURIComponent(wanted[index] as string)}?format=metadata&${METADATA_QUERY}`,
          );
          results[index] = parseSummary(data);
          done.add(index);
        } catch (error) {
          if (error instanceof MailProviderError && error.kind === "not_found") {
            // Deleted between list and get: drop it and carry on.
            done.add(index);
            continue;
          }
          stopped = true;
          // Out of retries or out of time: report what is left instead of failing the page.
          const partial =
            error instanceof MailProviderError &&
            (error.kind === "rate_limited" || (error.kind !== "auth" && context.signal.aborted));
          if (!partial) throw error;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, worker));

    const unhydratedIds = wanted.filter((_, index) => !done.has(index));
    if (request.useCache !== false) {
      await this.writeCache(
        account,
        results.filter(
          (m, index): m is MailMessageSummary => Boolean(m) && !cached.has(wanted[index] as string),
        ),
      );
    }
    return {
      messages: results.filter((m): m is MailMessageSummary => Boolean(m)),
      ...(nextPageToken ? { nextPageToken } : {}),
      ...(resultSizeEstimate === undefined ? {} : { resultSizeEstimate }),
      ...(unhydratedIds.length ? { unhydratedIds } : {}),
    };
  }

  /** Metadata for the ids a search already hydrated. A cache failure never fails the search. */
  private async readCache(
    account: MailAccount,
    ids: string[],
  ): Promise<Map<string, MailMessageSummary>> {
    const cache = this.deps.prisma?.cachedMailMessage;
    const hits = new Map<string, MailMessageSummary>();
    if (!cache || ids.length === 0) return hits;
    try {
      const rows = await cache.findMany({
        where: {
          connectionId: account.id,
          spaceId: account.spaceId,
          userId: account.userId,
          providerMessageId: { in: ids },
        },
      });
      for (const row of rows) {
        hits.set(row.providerMessageId, {
          id: row.providerMessageId,
          threadId: row.threadId,
          date: row.receivedAt.toISOString(),
          from: row.fromAddress
            ? { ...(row.fromName ? { name: row.fromName } : {}), address: row.fromAddress }
            : null,
          to: row.toAddresses.map((address) => ({ address })),
          cc: row.ccAddresses.map((address) => ({ address })),
          subject: row.subject,
          snippet: row.snippet,
          unread: row.unread,
          labelIds: [
            ...(row.inInbox ? ["INBOX"] : []),
            ...(row.fromSelf ? ["SENT"] : []),
            ...(row.unread ? ["UNREAD"] : []),
          ],
        });
      }
    } catch {
      // Fall back to fetching every id.
    }
    return hits;
  }

  /** Inserts newly hydrated metadata as search-only rows; sync state is never touched. */
  private async writeCache(account: MailAccount, messages: MailMessageSummary[]): Promise<void> {
    const cache = this.deps.prisma?.cachedMailMessage;
    if (!cache || messages.length === 0) return;
    const seenAt = new Date();
    try {
      await cache.createMany({
        skipDuplicates: true,
        data: messages.map((m) => ({
          spaceId: account.spaceId,
          userId: account.userId,
          connectionId: account.id,
          providerMessageId: m.id,
          threadId: m.threadId,
          fromName: m.from?.name ?? null,
          fromAddress: m.from?.address ?? "",
          toAddresses: m.to.map((a) => a.address),
          ccAddresses: m.cc.map((a) => a.address),
          subject: m.subject.slice(0, 500),
          snippet: m.snippet.slice(0, 500),
          receivedAt: new Date(m.date),
          unread: m.unread,
          inInbox: false,
          seenAt,
        })),
      });
    } catch {
      // The cache is an optimization.
    }
  }

  async getMessage(
    account: MailAccount,
    id: string,
    context: AdapterContext,
  ): Promise<MailMessage> {
    assertScope(account, context);
    const data = await this.request(
      account,
      context,
      `${GMAIL}/messages/${encodeURIComponent(id)}?format=full`,
    );
    const summary = parseSummary(data);
    if (!summary) throw new MailProviderError("unavailable", "Unexpected mail response");

    let plain: string | undefined;
    let html: string | undefined;
    const attachments: MailMessage["attachments"] = [];
    const inline: InlineImage[] = [];
    const visit = (value: unknown) => {
      const part = asRecord(value);
      if (!part) return;
      const body = asRecord(part.body);
      const mimeType = typeof part.mimeType === "string" ? part.mimeType.toLowerCase() : "";
      const contentId = headerOf(part, "content-id")?.trim().replace(/^<|>$/g, "");
      if (contentId && INLINE_TYPES.has(mimeType)) {
        inline.push({
          contentId: contentId.toLowerCase(),
          mimeType,
          size: typeof body?.size === "number" ? body.size : 0,
          ...(typeof body?.data === "string" ? { data: body.data } : {}),
          ...(typeof body?.attachmentId === "string" ? { attachmentId: body.attachmentId } : {}),
        });
      }
      if (typeof part.filename === "string" && part.filename) {
        attachments.push({
          filename: part.filename,
          mimeType,
          size: typeof body?.size === "number" ? body.size : 0,
        });
        return;
      }
      if (typeof body?.data === "string") {
        const text = () =>
          decodeBytes(Buffer.from(body.data as string, "base64url"), charsetOf(part));
        if (mimeType === "text/plain") plain ??= text();
        else if (mimeType === "text/html") html ??= text();
      }
      if (Array.isArray(part.parts)) part.parts.forEach(visit);
    };
    visit(asRecord(data)?.payload);

    let text = plain ?? (html === undefined ? "" : htmlToText(html));
    let truncated = false;
    if (text.length > MAX_TEXT) {
      text = text.slice(0, MAX_TEXT);
      truncated = true;
    }
    if (html !== undefined && html.length > MAX_HTML) {
      html = html.slice(0, MAX_HTML);
      truncated = true;
    }
    if (html !== undefined && inline.length)
      html = await this.embedInlineImages(account, id, context, html, inline);
    return { ...summary, text, ...(html === undefined ? {} : { html }), truncated, attachments };
  }

  /**
   * Replaces `cid:` references with data: URLs, using only parts of this message. An image that is
   * too large or fails to load keeps its `cid:` reference, which the viewer shows as a broken image.
   */
  private async embedInlineImages(
    account: MailAccount,
    messageId: string,
    context: AdapterContext,
    html: string,
    inline: InlineImage[],
  ): Promise<string> {
    const parts = new Map<string, InlineImage>();
    for (const image of inline) if (!parts.has(image.contentId)) parts.set(image.contentId, image);
    const cidOf = (reference: string) => {
      try {
        return decodeURIComponent(reference).toLowerCase();
      } catch {
        return reference.toLowerCase();
      }
    };
    const referenced = new Set([...html.matchAll(CID_REFERENCE)].map((m) => cidOf(m[1] as string)));
    const urls = new Map<string, string>();
    let budget = MAX_INLINE_TOTAL_BYTES;
    for (const cid of referenced) {
      const part = parts.get(cid);
      if (!part || urls.size >= MAX_INLINE_IMAGES || part.size > MAX_INLINE_IMAGE_BYTES) continue;
      try {
        const data =
          part.data ??
          asRecord(
            part.attachmentId
              ? await this.request(
                  account,
                  context,
                  `${GMAIL}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.attachmentId)}`,
                )
              : undefined,
          )?.data;
        if (typeof data !== "string") continue;
        const bytes = Buffer.from(data, "base64url");
        if (bytes.length > MAX_INLINE_IMAGE_BYTES || bytes.length > budget) continue;
        budget -= bytes.length;
        urls.set(cid, `data:${part.mimeType};base64,${bytes.toString("base64")}`);
      } catch {
        // The message is still readable without the picture.
      }
    }
    return urls.size
      ? html.replace(CID_REFERENCE, (all, ref: string) => urls.get(cidOf(ref)) ?? all)
      : html;
  }

  /** One authenticated GET with per-account concurrency, retry and status mapping. */
  private async request(
    account: MailAccount,
    context: AdapterContext,
    url: string,
  ): Promise<unknown> {
    const connector = this.deps.connectors.managed(account.connectorId);
    const proxy = connector?.proxy?.bind(connector);
    if (!proxy) throw new MailProviderError("unavailable", "This mail connection cannot be read");
    for (let attempt = 1; ; attempt++) {
      if (context.signal.aborted)
        throw new MailProviderError("unavailable", "Mail request aborted");
      const response = await this.limit(account.id, async () => {
        try {
          return await proxy(
            { app: account.app, accountRef: account.accountRef, method: "GET", url },
            context,
          );
        } catch {
          // Transport errors can carry credentials, so the original text is dropped.
          throw new MailProviderError("unavailable", "Mail request failed");
        }
      });
      const error = mapStatus(response);
      if (!error) return response.data;
      if (error.kind !== "rate_limited" || attempt >= MAX_ATTEMPTS || context.signal.aborted)
        throw error;
      const backoff = BASE_DELAY_MS * 2 ** (attempt - 1) + this.random() * 250;
      await this.sleep(Math.min(error.retryAfterMs ?? backoff, MAX_DELAY_MS), context.signal);
      if (context.signal.aborted) throw error;
    }
  }

  // ponytail: per-process limiter; move to a Postgres-backed limit per connection if 429s become common.
  private async limit<T>(key: string, run: () => Promise<T>): Promise<T> {
    let slot = this.slots.get(key);
    if (!slot) {
      slot = { active: 0, queue: [] };
      this.slots.set(key, slot);
    }
    const mine = slot;
    if (mine.active >= CONCURRENCY) await new Promise<void>((resolve) => mine.queue.push(resolve));
    else mine.active++;
    try {
      return await run();
    } finally {
      const waiting = mine.queue.shift();
      if (waiting) waiting();
      else if (--mine.active === 0) this.slots.delete(key);
    }
  }
}

interface InlineImage {
  contentId: string;
  mimeType: string;
  size: number;
  data?: string;
  attachmentId?: string;
}

const CID_REFERENCE = /\bcid:([^"'\s)>]+)/gi;

export function createMailProvider(
  deps: GmailMailProviderDeps & { prisma: NonNullable<GmailMailProviderDeps["prisma"]> },
): MailProvider {
  return new GmailMailProvider(deps);
}

function assertScope(account: MailAccount, context: AdapterContext): void {
  if (account.spaceId !== context.spaceId || account.userId !== context.userId)
    throw new MailProviderError("auth", "Mail is not available for this user");
}

function buildQuery(request: MailListRequest): string {
  const gmailDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
      throw new RangeError("Dates must be YYYY-MM-DD");
    return value.replaceAll("-", "/");
  };
  const query = request.query.trim();
  return [
    query ? `(${query})` : "",
    request.after ? `after:${gmailDate(request.after)}` : "",
    request.before ? `before:${gmailDate(request.before)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The single place HTTP statuses become typed errors. Returns undefined for 2xx. */
function mapStatus(response: ConnectorProxyResponse): MailProviderError | undefined {
  const { status } = response;
  if (status >= 200 && status < 300) return undefined;
  const errors = asRecord(asRecord(response.data)?.error)?.errors;
  const reasons = (Array.isArray(errors) ? errors : []).flatMap((entry: unknown) => {
    const reason = asRecord(entry)?.reason;
    return typeof reason === "string" ? [reason] : [];
  });
  if (status === 401 || (status === 403 && reasons.some((r) => AUTH_REASONS.has(r))))
    return new MailProviderError("auth", "The mail account needs to be reconnected");
  if (status === 429 || (status === 403 && reasons.some((r) => RATE_REASONS.has(r))))
    return new MailProviderError("rate_limited", "Mail rate limit reached", response.retryAfterMs);
  if (status === 404) return new MailProviderError("not_found", "Message not found");
  return new MailProviderError("unavailable", `Mail provider returned ${status}`);
}

function parseSummary(data: unknown): MailMessageSummary | undefined {
  const message = asRecord(data);
  if (!message) return undefined;
  const { id, threadId } = message;
  const millis = Number(message.internalDate);
  if (typeof id !== "string" || typeof threadId !== "string" || !Number.isFinite(millis))
    return undefined;
  const rawHeaders = asRecord(message.payload)?.headers;
  const headers = new Map<string, string>();
  for (const entry of Array.isArray(rawHeaders) ? rawHeaders : []) {
    const header = asRecord(entry);
    if (typeof header?.name === "string" && typeof header.value === "string")
      headers.set(header.name.toLowerCase(), header.value);
  }
  const labelIds = (Array.isArray(message.labelIds) ? message.labelIds : []).filter(
    (label: unknown): label is string => typeof label === "string",
  );
  return {
    id,
    threadId,
    date: new Date(millis).toISOString(),
    from: parseAddressList(headers.get("from") ?? "")[0] ?? null,
    to: parseAddressList(headers.get("to") ?? ""),
    cc: parseAddressList(headers.get("cc") ?? ""),
    subject: decodeEncodedWords(headers.get("subject") ?? ""),
    snippet: decodeEntities(typeof message.snippet === "string" ? message.snippet : ""),
    unread: labelIds.includes("UNREAD"),
    labelIds,
  };
}

/** Parses an address header: bare, `Name <a@b>` and quoted names that contain commas. */
export function parseAddressList(value: string): MailAddress[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let angle = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i] as string;
    if (char === "\\" && quoted) {
      current += char + (value[++i] ?? "");
      continue;
    }
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "<") angle = true;
    else if (!quoted && char === ">") angle = false;
    if (char === "," && !quoted && !angle) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);

  const unquote = (text: string) => {
    const trimmed = text.trim();
    return trimmed.length > 1 && trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1).replace(/\\(.)/g, "$1")
      : trimmed;
  };
  return parts.flatMap((part) => {
    const match = /^([\s\S]*?)<([^<>]*)>\s*$/.exec(part);
    const address = (match ? (match[2] as string) : unquote(part)).trim();
    if (!address.includes("@")) return [];
    const name = match ? decodeEncodedWords(unquote(match[1] as string)) : "";
    return [name ? { name, address } : { address }];
  });
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code =
        entity[1]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** RFC 2047 encoded words (`=?utf-8?B?...?=`), which Gmail leaves in raw header values. */
function decodeEncodedWords(text: string): string {
  return text
    .replace(/(\?=)\s+(?==\?)/g, "$1")
    .replace(
      /=\?([^?\s]+)\?([bq])\?([^?]*)\?=/gi,
      (_match, charset: string, kind: string, body: string) => {
        const bytes =
          kind.toLowerCase() === "b"
            ? Buffer.from(body, "base64")
            : Buffer.from(
                body
                  .replace(/_/g, " ")
                  .replace(/=([0-9a-f]{2})/gi, (_hex, h: string) =>
                    String.fromCharCode(Number.parseInt(h, 16)),
                  ),
                "latin1",
              );
        return decodeBytes(bytes, charset);
      },
    );
}

function decodeBytes(bytes: Uint8Array, charset: string | undefined): string {
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    // Unknown charset label.
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function headerOf(part: Record<string, unknown>, name: string): string | undefined {
  for (const entry of Array.isArray(part.headers) ? part.headers : []) {
    const header = asRecord(entry);
    if (typeof header?.name === "string" && header.name.toLowerCase() === name)
      return String(header.value);
  }
  return undefined;
}

function charsetOf(part: Record<string, unknown>): string | undefined {
  const contentType = headerOf(part, "content-type");
  return contentType === undefined ? undefined : /charset="?([^";\s]+)/i.exec(contentType)?.[1];
}

function htmlToText(html: string): string {
  const fragment = JSDOM.fragment(
    html.replace(/<\/(p|div|tr|li|h[1-6]|table)>|<br\s*\/?>/gi, "$&\n"),
  );
  for (const node of fragment.querySelectorAll("style,script,head,title")) node.remove();
  return (fragment.textContent ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
