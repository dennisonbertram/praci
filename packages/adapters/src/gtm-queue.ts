import type { GtmQueueInput, GtmQueueOutput } from "@rakazo/contracts";
import { GtmQueueInputSchema } from "@rakazo/contracts";
import * as z from "zod";
import { combineSignals } from "./connector-safety.js";
import { secureFetch } from "./mcp-transport.js";
import type { RemoteTransportDependencies } from "./remote-mcp.js";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_ACCOUNTS = 1_000;
const API_URL = new URL("https://zernio.com/api/v1/posts");
const ProviderStatusSchema = z.string().min(1).max(100);
const IsoDateTimeSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)));

type QueuePost = GtmQueueOutput["posts"][number];
type QueueResult = Pick<GtmQueueOutput, "status" | "complete" | "posts">;
type ConnectedAccount = { id: string; platform: string; label: string };

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function normalizedPost(value: unknown): { id: string; post: QueuePost | null } | null {
  const post = record(value);
  const status = ProviderStatusSchema.safeParse(post?.status);
  if (
    !post ||
    typeof post._id !== "string" ||
    !post._id.trim() ||
    post._id.length > 200 ||
    !status.success
  ) {
    return null;
  }
  if (post.content !== undefined && post.content !== null && typeof post.content !== "string")
    return null;
  const content = (post.content as string | null | undefined) ?? "";
  if (content.length > 20_000) return null;
  if (post.scheduledFor === undefined || post.scheduledFor === null) {
    return status.data === "scheduled" ? null : { id: post._id, post: null };
  }
  const scheduled = IsoDateTimeSchema.safeParse(post.scheduledFor);
  if (!scheduled.success || !Number.isFinite(Date.parse(scheduled.data))) return null;
  if (!Array.isArray(post.platforms) || post.platforms.length > 50) return null;
  const platforms: QueuePost["platforms"] = [];
  for (const value of post.platforms) {
    const target = record(value);
    const targetStatus = ProviderStatusSchema.safeParse(target?.status);
    if (
      !target ||
      typeof target.platform !== "string" ||
      !target.platform.trim() ||
      target.platform.length > 100 ||
      !targetStatus.success
    ) {
      return null;
    }
    let accountId: string | undefined;
    if (typeof target.accountId === "string") {
      accountId = target.accountId;
    } else {
      const account = record(target.accountId);
      if (!account || typeof account._id !== "string") return null;
      if (Object.hasOwn(account, "platform") && account.platform !== target.platform) return null;
      accountId = account._id;
    }
    if (!accountId.trim() || accountId.length > 200) return null;
    const normalizedTarget: QueuePost["platforms"][number] = {
      platform: target.platform,
      accountId,
      status: targetStatus.data,
    };
    if (targetStatus.data === "published" && validUrl(target.platformPostUrl)) {
      normalizedTarget.platformPostUrl = target.platformPostUrl;
    }
    platforms.push(normalizedTarget);
  }
  return {
    id: post._id,
    post: {
      id: post._id,
      content,
      status: status.data,
      scheduledFor: new Date(scheduled.data).toISOString(),
      platforms,
    },
  };
}

function parsePage(value: unknown, expectedPage: number) {
  const root = record(value);
  const pagination = record(root?.pagination);
  if (
    !root ||
    !Array.isArray(root.posts) ||
    !pagination ||
    !Number.isSafeInteger(pagination.page) ||
    pagination.page !== expectedPage ||
    pagination.limit !== PAGE_SIZE ||
    !Number.isSafeInteger(pagination.total) ||
    (pagination.total as number) < 0 ||
    !Number.isSafeInteger(pagination.pages) ||
    (pagination.pages as number) < 0
  ) {
    return null;
  }
  const total = pagination.total as number;
  const pages = pagination.pages as number;
  if (root.posts.length > PAGE_SIZE) return null;
  if (
    total === 0 &&
    expectedPage === 1 &&
    root.posts.length === 0 &&
    (pages === 0 || pages === 1)
  ) {
    return { posts: root.posts as unknown[], total, pages };
  }
  if (total === 0 || pages !== Math.ceil(total / PAGE_SIZE) || expectedPage > pages) return null;
  const expectedCount = Math.min(PAGE_SIZE, total - (expectedPage - 1) * PAGE_SIZE);
  if (expectedCount < 0 || root.posts.length !== expectedCount) return null;
  return { posts: root.posts as unknown[], total, pages };
}

async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

const unavailable = (posts: QueuePost[] = []): QueueResult => ({
  status: "unavailable",
  complete: false,
  posts,
});

export function createZernioQueueAdapter(network: RemoteTransportDependencies = {}) {
  return {
    async listPosts(
      input: GtmQueueInput & { apiKey: string; signal?: AbortSignal },
    ): Promise<QueueResult> {
      const window = GtmQueueInputSchema.safeParse({ from: input.from, to: input.to });
      if (!window.success || !input.apiKey.trim()) return unavailable();
      const from = Date.parse(window.data.from);
      const to = Date.parse(window.data.to);
      const url = new URL(API_URL);
      url.search = new URLSearchParams({
        fromDate: window.data.from,
        toDate: window.data.to,
        sortBy: "scheduled-asc",
        limit: String(PAGE_SIZE),
        page: "1",
        fields: "content,status,scheduledFor,platforms",
      }).toString();
      const fetch = secureFetch(
        API_URL,
        { allowedHosts: ["zernio.com"] },
        { headers: { authorization: `Bearer ${input.apiKey}` } },
        network,
      );
      const signal = combineSignals(input.signal, AbortSignal.timeout(15_000));
      const posts: QueuePost[] = [];
      const seenIds = new Set<string>();
      let firstTotal: number | undefined;
      let firstPages: number | undefined;
      try {
        for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
          url.searchParams.set("page", String(pageNumber));
          const response = await fetch(url, {
            method: "GET",
            redirect: "manual",
            headers: { accept: "application/json" },
            signal,
          });
          if ((response.status >= 300 && response.status < 400) || !response.ok)
            return unavailable(posts);
          const text = await boundedText(response);
          let body: unknown;
          try {
            body = JSON.parse(text);
          } catch {
            return unavailable(posts);
          }
          const parsed = parsePage(body, pageNumber);
          if (
            !parsed ||
            (firstTotal !== undefined && parsed.total !== firstTotal) ||
            (firstPages !== undefined && parsed.pages !== firstPages)
          ) {
            return unavailable(posts);
          }
          firstTotal ??= parsed.total;
          firstPages ??= parsed.pages;
          const pagePosts: QueuePost[] = [];
          const pageIds = new Set<string>();
          for (const rawPost of parsed.posts) {
            const normalized = normalizedPost(rawPost);
            if (!normalized || seenIds.has(normalized.id) || pageIds.has(normalized.id)) {
              return unavailable(posts);
            }
            pageIds.add(normalized.id);
            if (
              normalized.post &&
              Date.parse(normalized.post.scheduledFor) >= from &&
              Date.parse(normalized.post.scheduledFor) < to
            ) {
              pagePosts.push(normalized.post);
            }
          }
          for (const id of pageIds) seenIds.add(id);
          posts.push(...pagePosts);
          if (parsed.pages === 0 || pageNumber >= parsed.pages) {
            return { status: "ready", complete: true, posts };
          }
        }
        return { status: "ready", complete: false, posts };
      } catch {
        return unavailable(posts);
      } finally {
        await fetch.close().catch(() => undefined);
      }
    },
  };
}

function parseAccountsText(value: string): ConnectedAccount[] | null {
  if (new TextEncoder().encode(value).byteLength > MAX_RESPONSE_BYTES) return null;
  const text = value.replace(/\n$/, "");
  if (text === "No accounts connected. Connect accounts at https://zernio.com") return [];
  const header = /^Found (0|[1-9]\d*) connected account\(s\):\n\n([\s\S]+)$/.exec(text);
  if (!header) return null;
  const count = Number(header[1]);
  const lines = header[2]!.split("\n");
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_ACCOUNTS || lines.length !== count)
    return null;
  const ids = new Set<string>();
  const accounts: ConnectedAccount[] = [];
  for (const line of lines) {
    const account =
      /^- ([a-z0-9][a-z0-9_-]{0,99}): ([^\r\n]+) \(ID: ([A-Za-z0-9_-]{1,200})\)$/.exec(line);
    const label = account?.[2]?.trim();
    const id = account?.[3];
    if (!account || !label || label.length > 300 || label.includes("(ID:") || !id || ids.has(id))
      return null;
    ids.add(id);
    accounts.push({ platform: account[1]!, label, id });
  }
  return accounts;
}

function stringResult(value: unknown): string | null {
  const wrapped = record(value);
  if (!wrapped || typeof wrapped.result !== "string") return null;
  return wrapped.result;
}

export function parseZernioAccountsListResult(value: unknown): ConnectedAccount[] | null {
  const result = record(value);
  if (!result || result.isError === true) return null;
  if (Object.hasOwn(result, "structuredContent")) {
    const text = stringResult(result.structuredContent);
    return text === null ? null : parseAccountsText(text);
  }
  if (!Array.isArray(result.content) || result.content.length !== 1) return null;
  const content = record(result.content[0]);
  if (content?.type !== "text" || typeof content.text !== "string") return null;
  if (new TextEncoder().encode(content.text).byteLength > MAX_RESPONSE_BYTES) return null;
  let text: unknown = content.text;
  try {
    text = JSON.parse(content.text);
  } catch {
    // The formatter is also returned as raw text by older MCP clients.
  }
  if (typeof text === "string") return parseAccountsText(text);
  const wrapped = stringResult(text);
  return wrapped === null ? null : parseAccountsText(wrapped);
}
