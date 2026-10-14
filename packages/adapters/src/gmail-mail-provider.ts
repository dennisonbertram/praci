import {
  type AdapterContext,
  ConnectorProxyError,
  type ConnectorProxyRequest,
  type ConnectorProxyResponse,
  type MailAccount,
  type MailAddress,
  type MailAttachment,
  type MailChanges,
  type MailDraftInput,
  type MailDraftRef,
  type MailLabel,
  type MailLabelChange,
  type MailListRequest,
  type MailMessage,
  type MailMessagePage,
  type MailMessageSummary,
  type MailProvider,
  MailProviderError,
  type MailSent,
  type ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { JSDOM } from "jsdom";
import { asRecord } from "./connector-http.js";
import { buildRawMessage } from "./mail-compose.js";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_PAGE_SIZE = 500;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
// A longer Retry-After is not slept through (it would hold the caller); the error carries it instead.
const MAX_RETRY_AFTER_MS = 30_000;
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
const HISTORY_TYPES = ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"];
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
          id: typeof part.partId === "string" ? part.partId : "",
          filename: part.filename,
          mimeType,
          size: typeof body?.size === "number" ? body.size : 0,
          // A picture the body embeds, unless the sender marked it as an attachment.
          inline:
            Boolean(contentId) &&
            !/^\s*attachment/i.test(headerOf(part, "content-disposition") ?? ""),
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
    const replyTo = parseAddressList(
      headerOf(asRecord(asRecord(data)?.payload) ?? {}, "reply-to") ?? "",
    );
    return {
      ...summary,
      replyTo,
      text,
      ...(html === undefined ? {} : { html }),
      truncated,
      attachments,
    };
  }

  async getAttachment(
    account: MailAccount,
    messageId: string,
    attachmentId: string,
    maxBytes: number,
    context: AdapterContext,
  ): Promise<MailAttachment> {
    assertScope(account, context);
    const message = await this.request(
      account,
      context,
      `${GMAIL}/messages/${encodeURIComponent(messageId)}?format=full`,
    );
    const part = findNamedPart(asRecord(message)?.payload, attachmentId);
    const body = asRecord(part?.body);
    if (!part || !body) throw new MailProviderError("not_found", "Attachment not found");
    const tooLarge = () => new MailProviderError("too_large", "Attachment is too large");
    if (typeof body.size === "number" && body.size > maxBytes) throw tooLarge();
    const data =
      typeof body.data === "string"
        ? body.data
        : typeof body.attachmentId === "string"
          ? asRecord(
              await this.request(
                account,
                context,
                `${GMAIL}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(body.attachmentId)}`,
              ),
            )?.data
          : undefined;
    if (typeof data !== "string") throw new MailProviderError("not_found", "Attachment not found");
    const bytes = Buffer.from(data, "base64url");
    if (bytes.length > maxBytes) throw tooLarge();
    return {
      filename: part.filename as string,
      mimeType: typeof part.mimeType === "string" ? part.mimeType.toLowerCase() : "",
      size: bytes.length,
      bytes,
    };
  }

  async listLabels(account: MailAccount, context: AdapterContext): Promise<MailLabel[]> {
    assertScope(account, context);
    const labels = asRecord(await this.request(account, context, `${GMAIL}/labels`))?.labels;
    return (Array.isArray(labels) ? labels : []).flatMap((entry: unknown): MailLabel[] => {
      const label = asRecord(entry);
      if (typeof label?.id !== "string" || typeof label.name !== "string") return [];
      return [
        { id: label.id, name: label.name, type: label.type === "system" ? "system" : "user" },
      ];
    });
  }

  async modifyMessage(
    account: MailAccount,
    messageId: string,
    change: MailLabelChange,
    context: AdapterContext,
  ): Promise<{ labelIds: string[] }> {
    assertScope(account, context);
    const data = asRecord(
      await this.request(
        account,
        context,
        `${GMAIL}/messages/${encodeURIComponent(messageId)}/modify`,
        {
          method: "POST",
          body: {
            addLabelIds: change.addLabelIds ?? [],
            removeLabelIds: change.removeLabelIds ?? [],
          },
        },
      ),
    );
    if (!Array.isArray(data?.labelIds))
      throw new MailProviderError("unavailable", "Unexpected mail response");
    return {
      labelIds: data.labelIds.filter((id: unknown): id is string => typeof id === "string"),
    };
  }

  async getCursor(account: MailAccount, context: AdapterContext): Promise<string> {
    assertScope(account, context);
    const id = asRecord(await this.request(account, context, `${GMAIL}/profile`))?.historyId;
    if ((typeof id !== "string" && typeof id !== "number") || !String(id))
      throw new MailProviderError("unavailable", "Unexpected mail response");
    return String(id);
  }

  async listChanges(
    account: MailAccount,
    cursor: string,
    context: AdapterContext,
  ): Promise<MailChanges | null> {
    assertScope(account, context);
    if (!/^\d+$/.test(cursor)) return null;
    const changed = new Set<string>();
    const deleted = new Set<string>();
    let latest = cursor;
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ startHistoryId: cursor, maxResults: "500" });
      for (const type of HISTORY_TYPES) params.append("historyTypes", type);
      if (pageToken) params.set("pageToken", pageToken);
      let page: Record<string, unknown> | undefined;
      try {
        page = asRecord(await this.request(account, context, `${GMAIL}/history?${params}`));
      } catch (error) {
        // Gmail answers 404 once it has dropped history that old.
        if (error instanceof MailProviderError && error.kind === "not_found") return null;
        throw error;
      }
      for (const record of Array.isArray(page?.history) ? page.history : []) {
        const entry = asRecord(record);
        for (const [key, into] of [
          ["messagesAdded", changed],
          ["labelsAdded", changed],
          ["labelsRemoved", changed],
          ["messagesDeleted", deleted],
        ] as const) {
          for (const item of Array.isArray(entry?.[key]) ? (entry[key] as unknown[]) : []) {
            const id = asRecord(asRecord(item)?.message)?.id;
            if (typeof id === "string" && id) into.add(id);
          }
        }
      }
      if (typeof page?.historyId === "string" && page.historyId) latest = page.historyId;
      pageToken = typeof page?.nextPageToken === "string" ? page.nextPageToken : undefined;
    } while (pageToken);
    for (const id of deleted) changed.delete(id);
    return { cursor: latest, changedIds: [...changed], deletedIds: [...deleted] };
  }

  async createDraft(
    account: MailAccount,
    draft: MailDraftInput,
    context: AdapterContext,
  ): Promise<MailDraftRef> {
    assertScope(account, context);
    const message = await this.draftMessage(account, draft, context);
    const data = await this.request(account, context, `${GMAIL}/drafts`, {
      method: "POST",
      body: { message },
    });
    return parseDraft(data);
  }

  async updateDraft(
    account: MailAccount,
    draftId: string,
    draft: MailDraftInput,
    context: AdapterContext,
  ): Promise<MailDraftRef> {
    assertScope(account, context);
    const message = await this.draftMessage(account, draft, context);
    const data = await this.request(
      account,
      context,
      `${GMAIL}/drafts/${encodeURIComponent(draftId)}`,
      {
        method: "PUT",
        body: { message },
      },
    );
    return parseDraft(data);
  }

  async sendDraft(
    account: MailAccount,
    draftId: string,
    context: AdapterContext,
  ): Promise<MailSent> {
    assertScope(account, context);
    try {
      const sent = asRecord(
        await this.request(account, context, `${GMAIL}/drafts/send`, {
          method: "POST",
          body: { id: draftId },
        }),
      );
      // A 2xx means Gmail sent it, so an unexpected body must not look like a failure.
      return {
        messageId: typeof sent?.id === "string" ? sent.id : "",
        threadId: typeof sent?.threadId === "string" ? sent.threadId : "",
      };
    } catch (error) {
      // Timeouts, dropped connections and provider 5xx leave it unclear whether the mail went out.
      if (error instanceof MailProviderError && error.kind === "unavailable")
        throw new MailProviderError(
          "unknown",
          "It is not known whether the message was sent",
          undefined,
          error.detail,
        );
      throw error;
    }
  }

  async deleteDraft(account: MailAccount, draftId: string, context: AdapterContext): Promise<void> {
    assertScope(account, context);
    await this.request(account, context, `${GMAIL}/drafts/${encodeURIComponent(draftId)}`, {
      method: "DELETE",
    });
  }

  /**
   * The `message` of a Gmail draft: the raw RFC 2822 text and, for a reply, the original's thread
   * with In-Reply-To and the original's References followed by its own Message-ID.
   */
  private async draftMessage(
    account: MailAccount,
    draft: MailDraftInput,
    context: AdapterContext,
  ): Promise<{ raw: string; threadId?: string }> {
    let threadId: string | undefined;
    let inReplyTo: string | undefined;
    let references: string | undefined;
    if (draft.inReplyTo) {
      const original = asRecord(
        await this.request(
          account,
          context,
          `${GMAIL}/messages/${encodeURIComponent(draft.inReplyTo)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
        ),
      );
      threadId = typeof original?.threadId === "string" ? original.threadId : undefined;
      const payload = asRecord(original?.payload) ?? {};
      const ids = (value: string | undefined) =>
        (value ?? "").split(/\s+/).filter((id) => /^<[^<>\s@]+@[^<>\s@]+>$/.test(id));
      const [own] = ids(headerOf(payload, "message-id"));
      inReplyTo = own;
      references =
        [...ids(headerOf(payload, "references")), ...(own ? [own] : [])].join(" ") || undefined;
    }
    const raw = buildRawMessage(
      {
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject,
        text: draft.text,
        ...(draft.html ? { html: draft.html } : {}),
        ...(draft.attachments ? { attachments: draft.attachments } : {}),
        ...(inReplyTo ? { inReplyTo } : {}),
        ...(references ? { references } : {}),
      },
      { draft: true },
    );
    return {
      raw: Buffer.from(raw, "utf8").toString("base64url"),
      ...(threadId ? { threadId } : {}),
    };
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

  /**
   * One authenticated call with per-account concurrency, retry and status mapping. Retried: 429, a
   * 403 rate-limit reason, and (not for POST) 408, 5xx and transient transport errors; up to
   * MAX_ATTEMPTS, backing off exponentially with jitter or for the server's Retry-After, and failing
   * at once when that is over MAX_RETRY_AFTER_MS.
   *
   * A POST (sendDraft, createDraft) is never repeated after an unclear failure (5xx, timeout,
   * dropped connection): the request may have reached Google, so a repeat could send twice. A rate
   * limit proves Google did nothing, so it is retried for every method.
   */
  private async request(
    account: MailAccount,
    context: AdapterContext,
    url: string,
    init: { method?: ConnectorProxyRequest["method"]; body?: unknown } = {},
  ): Promise<unknown> {
    const method = init.method ?? "GET";
    const repeatable = method !== "POST";
    const connector = this.deps.connectors.managed(account.connectorId);
    const proxy = connector?.proxy?.bind(connector);
    if (!proxy) throw new MailProviderError("unavailable", "This mail connection cannot be read");
    for (let attempt = 1; ; attempt++) {
      if (context.signal.aborted)
        throw new MailProviderError("unavailable", "Mail request aborted");
      let failure: { error: MailProviderError; retry: boolean; retryAfterMs?: number };
      try {
        const response = await this.limit(account.id, () =>
          proxy(
            {
              app: account.app,
              accountRef: account.accountRef,
              method,
              url,
              ...(init.body === undefined ? {} : { body: init.body }),
            },
            context,
          ),
        );
        const error = mapStatus(response, method);
        if (!error) return response.data;
        failure = {
          error,
          retryAfterMs: response.retryAfterMs,
          retry:
            error.kind === "rate_limited" ||
            (repeatable && (response.status >= 500 || response.status === 408)),
        };
      } catch (cause) {
        // Only the connector's sanitized error is kept: other transport errors can carry credentials.
        failure = context.signal.aborted
          ? { error: new MailProviderError("unavailable", "Mail request aborted"), retry: false }
          : {
              error: new MailProviderError(
                "unavailable",
                "Mail request failed",
                undefined,
                describeProxyError(cause),
              ),
              retry: repeatable && cause instanceof ConnectorProxyError && cause.transient,
            };
      }
      if (!failure.retry || attempt >= MAX_ATTEMPTS || context.signal.aborted) throw failure.error;
      const wait = failure.retryAfterMs ?? BASE_DELAY_MS * 2 ** (attempt - 1) + this.random() * 250;
      if (wait > MAX_RETRY_AFTER_MS) throw failure.error;
      await this.sleep(wait, context.signal);
      if (context.signal.aborted) throw failure.error;
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

/** Log text for a failed proxy call: the sanitized connector error, or only the class of any other. */
function describeProxyError(cause: unknown): string {
  if (!(cause instanceof ConnectorProxyError))
    return cause instanceof Error ? cause.name : "unknown";
  const status = cause.status === undefined ? "" : ` status=${cause.status}`;
  return `${cause.code ?? cause.name}${status}: ${cause.message.slice(0, 300)}`;
}

/** The single place HTTP statuses become typed errors. Returns undefined for 2xx. */
function mapStatus(
  response: ConnectorProxyResponse,
  method: ConnectorProxyRequest["method"],
): MailProviderError | undefined {
  const { status } = response;
  if (status >= 200 && status < 300) return undefined;
  const errors = asRecord(asRecord(response.data)?.error)?.errors;
  const reasons = (Array.isArray(errors) ? errors : []).flatMap((entry: unknown) => {
    const reason = asRecord(entry)?.reason;
    return typeof reason === "string" ? [reason] : [];
  });
  if (status === 401 || (status === 403 && reasons.some((r) => AUTH_REASONS.has(r))))
    return new MailProviderError("auth", "The mail account needs to be reconnected");
  const exhausted = asRecord(asRecord(response.data)?.error)?.status === "RESOURCE_EXHAUSTED";
  if (status === 429 || (status === 403 && (exhausted || reasons.some((r) => RATE_REASONS.has(r)))))
    return new MailProviderError("rate_limited", "Mail rate limit reached", response.retryAfterMs);
  if (status === 404) return new MailProviderError("not_found", "Message not found");
  // For a write, Gmail refusing the message means nothing was saved or sent.
  if (method !== "GET" && (status === 400 || status === 413 || status === 422))
    return new MailProviderError("invalid", "Gmail did not accept the message");
  return new MailProviderError("unavailable", `Mail provider returned ${status}`);
}

function parseDraft(data: unknown): MailDraftRef {
  const draft = asRecord(data);
  const id = draft?.id;
  const threadId = asRecord(draft?.message)?.threadId;
  if (typeof id !== "string" || !id)
    throw new MailProviderError("unavailable", "Unexpected mail response");
  return { draftId: id, threadId: typeof threadId === "string" ? threadId : "" };
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
export function decodeEncodedWords(text: string): string {
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

/** The part with this `partId` that has a filename. */
function findNamedPart(value: unknown, partId: string): Record<string, unknown> | undefined {
  const part = asRecord(value);
  if (!part) return undefined;
  if (part.partId === partId && typeof part.filename === "string" && part.filename) return part;
  if (!Array.isArray(part.parts)) return undefined;
  for (const child of part.parts) {
    const found = findNamedPart(child, partId);
    if (found) return found;
  }
  return undefined;
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
