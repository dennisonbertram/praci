import type {
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  MailAccount,
  MailProvider,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import {
  createMailProvider,
  GMAIL_FILTER_LIMIT,
  type GmailMailProviderDeps,
} from "./gmail-mail-provider.js";
import { GMAIL_SETTINGS_BASIC } from "./google-connector.js";
import { parseRawMime } from "./mime-parse.js";

const PREFIX = "/gmail/v1/users/me/";
const DAY_MS = 86_400_000;
const HISTORY_START = 1000;
const DEFAULT_NOW = new Date("2026-10-01T12:00:00Z");
/** What a mailbox is granted by default: the connect flow's scopes, without gmail.settings.basic. */
const DEFAULT_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
];
export const FILTER_LIMIT = GMAIL_FILTER_LIMIT;
const SYSTEM_LABELS = [
  "INBOX",
  "SENT",
  "DRAFT",
  "UNREAD",
  "STARRED",
  "IMPORTANT",
  "TRASH",
  "SPAM",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
];
const LABELS = [
  ...SYSTEM_LABELS.map((id) => ({ id, name: id, type: "system" })),
  { id: "Label_1", name: "Receipts", type: "user" },
];

export interface EmulatedMessage {
  id: string;
  threadId?: string;
  /** ISO 8601. */
  date: string;
  labels: string[];
  /** Raw header values, so tests can supply quoted names and encoded words. */
  from: string;
  to: string;
  cc?: string;
  subject: string;
  /** Message-ID header; defaults to `<id@mail.example.test>`. */
  messageId?: string;
  /** Reply-To header, as written in the message. */
  replyTo?: string;
  /** In-Reply-To and References headers, as written in the message. */
  inReplyTo?: string;
  references?: string;
  /** Extra headers appended as written (List-Unsubscribe, Authentication-Results, ...); a name may repeat. */
  headers?: Array<{ name: string; value: string }>;
  /** Raw snippet; may contain HTML entities as Gmail returns them. */
  snippet?: string;
  text?: string;
  html?: string;
  charset?: "utf-8" | "iso-8859-1";
  /** `data` (standard base64) makes the bytes downloadable and sets `size` to their length. */
  attachments?: Array<{ filename: string; mimeType: string; size: number; data?: string }>;
  /** Inline parts referenced as `cid:<contentId>`; `data` is standard base64 and is served as an attachment. */
  inlineImages?: Array<{ contentId: string; mimeType: string; data: string }>;
}

export interface GmailSeed {
  /** The moment the default mailboxes are dated against. */
  now?: Date;
  /** Replaces the default mailboxes. Keyed by the connector account reference. */
  mailboxes?: Record<string, { address: string; messages: EmulatedMessage[] }>;
  /** Dates sent messages. Defaults to the system clock. */
  clock?: () => Date;
}

interface Header {
  name: string;
  value: string;
}
interface Part {
  /** Position in the payload tree, "" for the root, "0", "1", "0.1" below it, as Gmail numbers them. */
  partId?: string;
  mimeType: string;
  filename: string;
  headers: Header[];
  body: { size: number; data?: string; attachmentId?: string };
  parts?: Part[];
}
interface Stored {
  id: string;
  threadId: string;
  internalDate: number;
  labelIds: string[];
  snippet: string;
  headers: Header[];
  payload: Part;
  /** attachmentId to base64url bytes, for parts the payload only references. */
  files: Map<string, string>;
}
/** One entry of the mailbox change log that `users.history.list` serves. */
interface HistoryEvent {
  id: number;
  type: "messageAdded" | "messageDeleted" | "labelAdded" | "labelRemoved";
  messageId: string;
  threadId: string;
  /** The message's labels for an add; the labels that changed for a label event. */
  labelIds: string[];
}
interface Mailbox {
  address: string;
  messages: Stored[];
  drafts: Map<string, EmulatedDraft>;
  /** Id of the latest change; what `profile` reports and `history.list` starts after. */
  historyId: number;
  /** History before this id has expired: a `startHistoryId` below it is a 404, as in Gmail. */
  historyFloor: number;
  history: HistoryEvent[];
  /** The active `users.watch` subscription, if any. */
  watch?: EmulatedWatch;
  /** OAuth scopes the account's token holds; `settings/filters` needs gmail.settings.basic. */
  scopes: Set<string>;
  filters: EmulatedFilter[];
}
/** A Gmail filter as `users.settings.filters` stores it. */
export interface EmulatedFilter {
  id: string;
  criteria: Record<string, unknown>;
  action: { addLabelIds?: string[]; removeLabelIds?: string[]; forward?: string };
}
/** What `users.watch` stored: the Pub/Sub topic, the labels it covers and when it lapses. */
export interface EmulatedWatch {
  topicName: string;
  labelIds: string[];
  /** Epoch milliseconds, as Gmail returns it. */
  expiration: number;
}
/** A draft or sent message as the emulator holds it: the base64url-decoded RFC 2822 text. */
export interface EmulatedDraft {
  id: string;
  threadId: string;
  raw: string;
}
interface Failure {
  status: number;
  times: number;
  skip: number;
  reason?: string;
  retryAfter?: number;
  urlIncludes?: string;
}

type Matcher = (message: Stored) => boolean;

class QueryError extends Error {}

/** Deterministic, in-memory stand-in for the Gmail REST endpoints the mail provider uses. */
export class GmailApiEmulator {
  readonly requests: Array<{ accountRef: string; url: string; method: string }> = [];
  private readonly mailboxes = new Map<string, Mailbox>();
  private readonly sent = new Map<string, EmulatedDraft[]>();
  private failure: Failure | undefined;
  private sequence = 0;
  private readonly clock: () => Date;

  constructor(seed: GmailSeed = {}) {
    this.clock = seed.clock ?? (() => new Date());
    const mailboxes = seed.mailboxes ?? defaultMailboxes(seed.now ?? DEFAULT_NOW);
    for (const [accountRef, mailbox] of Object.entries(mailboxes)) {
      this.mailboxes.set(accountRef, {
        address: mailbox.address,
        messages: mailbox.messages.map(store).sort(newestFirst),
        drafts: new Map(),
        historyId: HISTORY_START,
        historyFloor: HISTORY_START,
        history: [],
        scopes: new Set(DEFAULT_SCOPES),
        filters: [],
      });
    }
  }

  /** The mailbox address for an account reference, for building connection rows. */
  addressOf(accountRef: string): string | undefined {
    return this.mailboxes.get(accountRef)?.address;
  }

  accountRefs(): string[] {
    return [...this.mailboxes.keys()];
  }

  /** Serves `accountRef` from the mailbox seeded under `seededRef`, for refs minted after the seed. */
  alias(accountRef: string, seededRef: string): void {
    const mailbox = this.mailboxes.get(seededRef);
    if (!mailbox) throw new Error(`No seeded mailbox ${seededRef}`);
    this.mailboxes.set(accountRef, mailbox);
  }

  /**
   * Serves `accountRef` from its own copy of `seed`'s messages, drafts and sent mail, so nothing
   * done in one account shows in another. `seededRef` supplies the address.
   */
  isolate(accountRef: string, seededRef: string, seed: { messages: EmulatedMessage[] }): void {
    const shared = this.mailboxes.get(seededRef);
    if (!shared) throw new Error(`No seeded mailbox ${seededRef}`);
    this.mailboxes.set(accountRef, {
      address: shared.address,
      messages: seed.messages.map(store).sort(newestFirst),
      drafts: new Map(),
      historyId: HISTORY_START,
      historyFloor: HISTORY_START,
      history: [],
      scopes: new Set(DEFAULT_SCOPES),
      filters: [],
    });
  }

  /** Gives the account's token one more OAuth scope, as a reconnect that asked for it would. */
  grantScope(accountRef: string, scope: string): void {
    this.mailbox(accountRef).scopes.add(scope);
  }

  /** The scopes the account's token holds. */
  scopesOf(accountRef: string): string[] {
    return [...this.mailbox(accountRef).scopes];
  }

  /** The mailbox's Gmail filters, oldest first. */
  filtersOf(accountRef: string): EmulatedFilter[] {
    return [...(this.mailboxes.get(accountRef)?.filters ?? [])];
  }

  /** Adds a filter the user made in Gmail itself. */
  addFilter(accountRef: string, filter: Omit<EmulatedFilter, "id">): EmulatedFilter {
    const added = { id: `filter-${++this.sequence}`, ...filter };
    this.mailbox(accountRef).filters.push(added);
    return added;
  }

  /** Fills the mailbox with unrelated filters until it holds `count`. */
  fillFilters(accountRef: string, count: number): void {
    const { filters } = this.mailbox(accountRef);
    while (filters.length < count)
      this.addFilter(accountRef, {
        criteria: { from: `filler-${filters.length}@filters.example.test` },
        action: { removeLabelIds: ["INBOX"] },
      });
  }

  /** Delivers a message, as if it arrived from outside. It lands in the change log. */
  addMessage(accountRef: string, message: EmulatedMessage): void {
    const mailbox = this.mailbox(accountRef);
    const stored = store(message);
    mailbox.messages.push(stored);
    mailbox.messages.sort(newestFirst);
    record(mailbox, "messageAdded", stored, stored.labelIds);
  }

  /** Permanently deletes a message, as if the user emptied the trash. */
  deleteMessage(accountRef: string, id: string): void {
    const mailbox = this.mailbox(accountRef);
    const stored = mailbox.messages.find((m) => m.id === id);
    if (!stored) throw new Error(`No message ${id}`);
    mailbox.messages = mailbox.messages.filter((m) => m !== stored);
    record(mailbox, "messageDeleted", stored, []);
  }

  /** Forgets the change log, so every cursor taken so far gets a 404 from `history.list`. */
  expireHistory(accountRef: string): void {
    const mailbox = this.mailbox(accountRef);
    mailbox.historyFloor = ++mailbox.historyId;
    mailbox.history = [];
  }

  private mailbox(accountRef: string): Mailbox {
    const mailbox = this.mailboxes.get(accountRef);
    if (!mailbox) throw new Error(`No seeded mailbox ${accountRef}`);
    return mailbox;
  }

  /** Fail the next `times` matching requests, after letting `skip` matching ones through. */
  failNext(
    status: number,
    options: {
      times?: number;
      reason?: string;
      /** Seconds, as the Retry-After header carries them. */
      retryAfter?: number;
      /** Only requests whose URL contains this text count. */
      urlIncludes?: string;
      skip?: number;
    } = {},
  ): void {
    this.failure = { ...options, status, times: options.times ?? 1, skip: options.skip ?? 0 };
  }

  clearFailures(): void {
    this.failure = undefined;
  }

  /** The active push watch of the mailbox, if any. */
  watchOf(accountRef: string): EmulatedWatch | undefined {
    return this.mailboxes.get(accountRef)?.watch;
  }

  /** Drafts not yet sent, oldest first. */
  draftsOf(accountRef: string): EmulatedDraft[] {
    return [...(this.mailboxes.get(accountRef)?.drafts.values() ?? [])];
  }

  /** Messages sent through `drafts/send`, oldest first. Sharing a mailbox through `alias` shares them. */
  sentOf(accountRef: string): EmulatedDraft[] {
    return this.sent.get(this.keyOf(accountRef)) ?? [];
  }

  /** Everything written so far, for the e2e harness to serve to a browser test. */
  snapshot(): Record<string, { address: string; drafts: EmulatedDraft[]; sent: EmulatedDraft[] }> {
    return Object.fromEntries(
      [...this.mailboxes].map(([ref, mailbox]) => [
        ref,
        { address: mailbox.address, drafts: this.draftsOf(ref), sent: this.sentOf(ref) },
      ]),
    );
  }

  private keyOf(accountRef: string): string {
    const mailbox = this.mailboxes.get(accountRef);
    return [...this.mailboxes].find(([, other]) => other === mailbox)?.[0] ?? accountRef;
  }

  handle(
    accountRef: string,
    url: string,
    method: ConnectorProxyRequest["method"] = "GET",
    body?: unknown,
  ): ConnectorProxyResponse {
    this.requests.push({ accountRef, url, method });
    const failed = this.takeFailure(url);
    if (failed) return failed;
    const mailbox = this.mailboxes.get(accountRef);
    if (!mailbox) return fail(401, "authError", "Invalid credentials");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return fail(400, "invalidArgument", "Invalid URL");
    }
    if (parsed.origin !== "https://gmail.googleapis.com" || !parsed.pathname.startsWith(PREFIX))
      return fail(404, "notFound", "Not found");
    const path = parsed.pathname.slice(PREFIX.length);
    if (path === "drafts" || path === "drafts/send" || path.startsWith("drafts/"))
      return this.drafts(accountRef, mailbox, path, method, body);
    const modify = /^messages\/([^/]+)\/modify$/.exec(path);
    if (modify) return modifyMessage(mailbox, decodeURIComponent(modify[1]!), method, body);
    const threadModify = /^threads\/([^/]+)\/modify$/.exec(path);
    if (threadModify)
      return modifyThread(mailbox, decodeURIComponent(threadModify[1]!), method, body);
    if (path === "watch" || path === "stop") return this.watch(mailbox, path, method, body);
    if (path === "settings/filters" || path.startsWith("settings/filters/"))
      return this.filters(mailbox, path.slice("settings/filters".length), method, body);
    if (method !== "GET") return fail(405, "methodNotAllowed", "Method not allowed");
    if (path === "labels") return { status: 200, data: { labels: LABELS } };
    if (path === "profile")
      return {
        status: 200,
        data: {
          emailAddress: mailbox.address,
          historyId: String(mailbox.historyId),
          messagesTotal: mailbox.messages.length,
          threadsTotal: new Set(mailbox.messages.map((m) => m.threadId)).size,
        },
      };
    if (path === "history") return historyList(mailbox, parsed.searchParams);
    if (path === "messages") return list(mailbox, parsed.searchParams, this.clock().getTime());
    const id = /^messages\/([^/]+)$/.exec(path)?.[1];
    if (id) return get(mailbox, decodeURIComponent(id), parsed.searchParams);
    const file = /^messages\/([^/]+)\/attachments\/([^/]+)$/.exec(path);
    if (file)
      return attachment(mailbox, decodeURIComponent(file[1]!), decodeURIComponent(file[2]!));
    return fail(404, "notFound", "Not found");
  }

  /**
   * `users.settings.filters` create, list, get and delete (Gmail has no update). Needs
   * gmail.settings.basic. At FILTER_LIMIT a create is refused with 400 failedPrecondition: Google
   * does not document that error, so this shape is an assumption.
   */
  private filters(
    mailbox: Mailbox,
    rest: string,
    method: ConnectorProxyRequest["method"],
    body: unknown,
  ): ConnectorProxyResponse {
    if (!mailbox.scopes.has(GMAIL_SETTINGS_BASIC))
      return fail(
        403,
        "insufficientPermissions",
        "Request had insufficient authentication scopes.",
      );
    if (rest === "") {
      if (method === "GET")
        return {
          status: 200,
          data: mailbox.filters.length ? { filter: mailbox.filters } : {},
        };
      if (method !== "POST") return fail(405, "methodNotAllowed", "Method not allowed");
      const { criteria, action } = (body ?? {}) as Record<string, unknown>;
      const from = (criteria as { from?: unknown } | undefined)?.from;
      if (typeof from !== "string" || !from.includes("@") || typeof action !== "object" || !action)
        return fail(400, "invalidArgument", "Invalid filter");
      if (mailbox.filters.length >= FILTER_LIMIT)
        return fail(400, "failedPrecondition", "Filter limit reached");
      const filter = {
        id: `filter-${++this.sequence}`,
        criteria: criteria as Record<string, unknown>,
        action: action as EmulatedFilter["action"],
      };
      mailbox.filters.push(filter);
      return { status: 200, data: filter };
    }
    const id = decodeURIComponent(rest.slice(1));
    const filter = mailbox.filters.find((f) => f.id === id);
    if (!rest.startsWith("/") || !filter)
      return fail(404, "notFound", "Requested entity was not found.");
    if (method === "GET") return { status: 200, data: filter };
    if (method !== "DELETE") return fail(405, "methodNotAllowed", "Method not allowed");
    mailbox.filters = mailbox.filters.filter((f) => f !== filter);
    return { status: 204, data: undefined };
  }

  /** `users.watch` and `users.stop`. A watch lasts seven days; watching again renews it. */
  private watch(
    mailbox: Mailbox,
    path: "watch" | "stop",
    method: ConnectorProxyRequest["method"],
    body: unknown,
  ): ConnectorProxyResponse {
    if (method !== "POST") return fail(405, "methodNotAllowed", "Method not allowed");
    if (path === "stop") {
      mailbox.watch = undefined;
      return { status: 204, data: undefined };
    }
    const request = (body ?? {}) as Record<string, unknown>;
    if (
      typeof request.topicName !== "string" ||
      !/^projects\/[^/]+\/topics\/[^/]+$/.test(request.topicName)
    )
      return fail(400, "invalidArgument", "Invalid topicName");
    const labelIds = Array.isArray(request.labelIds)
      ? request.labelIds.filter((l): l is string => typeof l === "string")
      : [];
    if (
      request.labelFilterBehavior !== undefined &&
      request.labelFilterBehavior !== "include" &&
      request.labelFilterBehavior !== "exclude"
    )
      return fail(400, "invalidArgument", "Invalid labelFilterBehavior");
    mailbox.watch = {
      topicName: request.topicName,
      labelIds,
      expiration: this.clock().getTime() + 7 * DAY_MS,
    };
    return {
      status: 200,
      data: { historyId: String(mailbox.historyId), expiration: String(mailbox.watch.expiration) },
    };
  }

  private drafts(
    accountRef: string,
    mailbox: Mailbox,
    path: string,
    method: ConnectorProxyRequest["method"],
    body: unknown,
  ): ConnectorProxyResponse {
    const message = (body as { message?: { raw?: unknown; threadId?: unknown } } | undefined)
      ?.message;
    const read = (): { raw: string; threadId: string } | ConnectorProxyResponse => {
      if (typeof message?.raw !== "string" || !message.raw)
        return fail(400, "invalidArgument", "Invalid message");
      const raw = Buffer.from(message.raw, "base64url").toString("utf8");
      if (!/^[A-Za-z-]+:/.test(raw)) return fail(400, "invalidArgument", "Invalid message");
      const threadId = typeof message.threadId === "string" ? message.threadId : undefined;
      if (threadId && !this.threadExists(mailbox, accountRef, threadId))
        return fail(404, "notFound", "Requested entity was not found.");
      return { raw, threadId: threadId ?? `t-sent-${++this.sequence}` };
    };
    const resource = (draft: EmulatedDraft) => ({
      id: draft.id,
      message: { id: `m-${draft.id}`, threadId: draft.threadId, labelIds: ["DRAFT"] },
    });
    if (path === "drafts" && method === "POST") {
      const parsed = read();
      if ("status" in parsed) return parsed;
      const draft = { id: `draft-${++this.sequence}`, ...parsed };
      mailbox.drafts.set(draft.id, draft);
      return { status: 200, data: resource(draft) };
    }
    if (path === "drafts/send" && method === "POST") {
      const id = (body as { id?: unknown } | undefined)?.id;
      const draft = typeof id === "string" ? mailbox.drafts.get(id) : undefined;
      if (!draft) return fail(404, "notFound", "Requested entity was not found.");
      mailbox.drafts.delete(draft.id);
      const sentId = `sent-${++this.sequence}`;
      const key = this.keyOf(accountRef);
      this.sent.set(key, [...(this.sent.get(key) ?? []), { ...draft, id: sentId }]);
      const stored = storeSent(sentId, draft, mailbox.address, this.clock());
      mailbox.messages.push(stored);
      mailbox.messages.sort(newestFirst);
      record(mailbox, "messageAdded", stored, stored.labelIds);
      return { status: 200, data: { id: sentId, threadId: draft.threadId, labelIds: ["SENT"] } };
    }
    const id = /^drafts\/([^/]+)$/.exec(path)?.[1];
    if (!id) return fail(404, "notFound", "Not found");
    const current = mailbox.drafts.get(decodeURIComponent(id));
    if (!current) return fail(404, "notFound", "Requested entity was not found.");
    if (method === "PUT") {
      const parsed = read();
      if ("status" in parsed) return parsed;
      const draft = { id: current.id, ...parsed };
      mailbox.drafts.set(draft.id, draft);
      return { status: 200, data: resource(draft) };
    }
    if (method === "DELETE") {
      mailbox.drafts.delete(current.id);
      return { status: 204, data: undefined };
    }
    return fail(405, "methodNotAllowed", "Method not allowed");
  }

  private threadExists(mailbox: Mailbox, accountRef: string, threadId: string): boolean {
    return (
      mailbox.messages.some((m) => m.threadId === threadId) ||
      this.draftsOf(accountRef).some((d) => d.threadId === threadId)
    );
  }

  private takeFailure(url: string): ConnectorProxyResponse | undefined {
    const failure = this.failure;
    if (!failure || (failure.urlIncludes && !url.includes(failure.urlIncludes))) return undefined;
    if (failure.skip > 0) {
      failure.skip -= 1;
      return undefined;
    }
    if (--failure.times <= 0) this.failure = undefined;
    const defaultReason = failure.status === 429 ? "rateLimitExceeded" : "backendError";
    return {
      ...fail(failure.status, failure.reason ?? defaultReason, "Emulated failure"),
      ...(failure.retryAfter === undefined ? {} : { retryAfterMs: failure.retryAfter * 1000 }),
    };
  }
}

function fail(status: number, reason: string, message: string): ConnectorProxyResponse {
  return {
    status,
    data: { error: { code: status, message, errors: [{ reason, domain: "global", message }] } },
  };
}

function newestFirst(a: Stored, b: Stored): number {
  return b.internalDate - a.internalDate || a.id.localeCompare(b.id);
}

function list(mailbox: Mailbox, params: URLSearchParams, now: number): ConnectorProxyResponse {
  const rawSize = params.get("maxResults") ?? "100";
  const size = /^\d+$/.test(rawSize) ? Number(rawSize) : 0;
  if (size < 1 || size > 500) return fail(400, "invalidArgument", "maxResults must be 1 to 500");
  const token = params.get("pageToken");
  const offset = token === null ? 0 : /^\d+$/.test(token) ? Number(token) : -1;
  if (offset < 0 || offset > mailbox.messages.length)
    return fail(400, "invalidArgument", "Invalid pageToken");
  let matches: Matcher;
  try {
    matches = parseQuery(params.get("q") ?? "", now);
  } catch (error) {
    if (error instanceof QueryError) return fail(400, "invalidArgument", error.message);
    throw error;
  }
  const all = mailbox.messages.filter(matches);
  const page = all.slice(offset, offset + size);
  return {
    status: 200,
    data: {
      ...(page.length ? { messages: page.map((m) => ({ id: m.id, threadId: m.threadId })) } : {}),
      ...(offset + size < all.length ? { nextPageToken: String(offset + size) } : {}),
      resultSizeEstimate: all.length,
    },
  };
}

/** Parses a modify body; every label id must exist. */
function labelChange(body: unknown): { add: string[]; remove: string[] } | undefined {
  const { addLabelIds = [], removeLabelIds = [] } = (body ?? {}) as Record<string, unknown>;
  const known = new Set(LABELS.map((label) => label.id));
  const valid = (ids: unknown): ids is string[] =>
    Array.isArray(ids) && ids.every((label) => typeof label === "string" && known.has(label));
  return valid(addLabelIds) && valid(removeLabelIds)
    ? { add: addLabelIds, remove: removeLabelIds }
    : undefined;
}

/** Removes, then adds, and records what actually changed. */
function applyLabels(
  mailbox: Mailbox,
  message: Stored,
  { add, remove }: { add: string[]; remove: string[] },
): void {
  const before = message.labelIds;
  message.labelIds = [...new Set([...before.filter((l) => !remove.includes(l)), ...add])];
  const removed = before.filter((l) => !message.labelIds.includes(l));
  const added = message.labelIds.filter((l) => !before.includes(l));
  if (removed.length) record(mailbox, "labelRemoved", message, removed);
  if (added.length) record(mailbox, "labelAdded", message, added);
}

/** users.messages.modify: removes, then adds; every label id must exist. */
function modifyMessage(
  mailbox: Mailbox,
  id: string,
  method: ConnectorProxyRequest["method"],
  body: unknown,
): ConnectorProxyResponse {
  if (method !== "POST") return fail(405, "methodNotAllowed", "Method not allowed");
  const message = mailbox.messages.find((m) => m.id === id);
  if (!message) return fail(404, "notFound", "Requested entity was not found.");
  const change = labelChange(body);
  if (!change) return fail(400, "invalidArgument", "Invalid label");
  applyLabels(mailbox, message, change);
  return {
    status: 200,
    data: { id: message.id, threadId: message.threadId, labelIds: message.labelIds },
  };
}

/** users.threads.modify: the same change on every message of the thread. */
function modifyThread(
  mailbox: Mailbox,
  id: string,
  method: ConnectorProxyRequest["method"],
  body: unknown,
): ConnectorProxyResponse {
  if (method !== "POST") return fail(405, "methodNotAllowed", "Method not allowed");
  const members = mailbox.messages.filter((m) => m.threadId === id);
  if (members.length === 0) return fail(404, "notFound", "Requested entity was not found.");
  const change = labelChange(body);
  if (!change) return fail(400, "invalidArgument", "Invalid label");
  for (const message of members) applyLabels(mailbox, message, change);
  return { status: 200, data: { id, messages: members.map((m) => ({ id: m.id, threadId: id })) } };
}

function record(
  mailbox: Mailbox,
  type: HistoryEvent["type"],
  message: Stored,
  labelIds: string[],
): void {
  mailbox.history.push({
    id: ++mailbox.historyId,
    type,
    messageId: message.id,
    threadId: message.threadId,
    labelIds: [...labelIds],
  });
}

const HISTORY_TYPES = ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"];

/** users.history.list: events after `startHistoryId` as Gmail's typed record arrays, paged. */
function historyList(mailbox: Mailbox, params: URLSearchParams): ConnectorProxyResponse {
  const start = params.get("startHistoryId");
  if (start === null || !/^\d+$/.test(start))
    return fail(400, "invalidArgument", "startHistoryId is required");
  const types = params.getAll("historyTypes");
  if (types.some((type) => !HISTORY_TYPES.includes(type)))
    return fail(400, "invalidArgument", "Invalid historyTypes");
  const rawSize = params.get("maxResults") ?? "100";
  const size = /^\d+$/.test(rawSize) ? Number(rawSize) : 0;
  if (size < 1 || size > 500) return fail(400, "invalidArgument", "maxResults must be 1 to 500");
  const token = params.get("pageToken");
  const offset = token === null ? 0 : /^\d+$/.test(token) ? Number(token) : -1;
  if (offset < 0) return fail(400, "invalidArgument", "Invalid pageToken");
  if (Number(start) < mailbox.historyFloor || Number(start) > mailbox.historyId)
    return fail(404, "notFound", "Requested entity was not found.");
  const events = mailbox.history.filter(
    (event) => event.id > Number(start) && (!types.length || types.includes(event.type)),
  );
  const page = events.slice(offset, offset + size).map((event) => {
    const message = { id: event.messageId, threadId: event.threadId, labelIds: event.labelIds };
    return {
      id: String(event.id),
      messages: [{ id: event.messageId, threadId: event.threadId }],
      ...(event.type === "messageAdded" ? { messagesAdded: [{ message }] } : {}),
      ...(event.type === "messageDeleted" ? { messagesDeleted: [{ message }] } : {}),
      ...(event.type === "labelAdded"
        ? { labelsAdded: [{ message, labelIds: event.labelIds }] }
        : {}),
      ...(event.type === "labelRemoved"
        ? { labelsRemoved: [{ message, labelIds: event.labelIds }] }
        : {}),
    };
  });
  return {
    status: 200,
    data: {
      ...(page.length ? { history: page } : {}),
      ...(offset + size < events.length ? { nextPageToken: String(offset + size) } : {}),
      historyId: String(mailbox.historyId),
    },
  };
}

function attachment(mailbox: Mailbox, id: string, attachmentId: string): ConnectorProxyResponse {
  const data = mailbox.messages.find((m) => m.id === id)?.files.get(attachmentId);
  if (data === undefined) return fail(404, "notFound", "Requested entity was not found.");
  return { status: 200, data: { size: Buffer.from(data, "base64url").length, data } };
}

function get(mailbox: Mailbox, id: string, params: URLSearchParams): ConnectorProxyResponse {
  const message = mailbox.messages.find((m) => m.id === id);
  if (!message) return fail(404, "notFound", "Requested entity was not found.");
  const format = params.get("format") ?? "full";
  if (format !== "full" && format !== "metadata")
    return fail(400, "invalidArgument", "Unsupported format");
  const wanted = params.getAll("metadataHeaders").map((name) => name.toLowerCase());
  const payload =
    format === "full"
      ? message.payload
      : {
          mimeType: message.payload.mimeType,
          headers: message.headers.filter(
            (h) => !wanted.length || wanted.includes(h.name.toLowerCase()),
          ),
          body: { size: 0 },
        };
  return {
    status: 200,
    data: {
      id: message.id,
      threadId: message.threadId,
      labelIds: message.labelIds,
      snippet: message.snippet,
      internalDate: String(message.internalDate),
      payload,
    },
  };
}

// Query subset: after:, before:, newer_than:, older_than:, from:, to:, subject:,
// in:inbox|sent|anywhere, label:inbox|sent, is:unread|starred|important,
// has:attachment, category:primary|social|promotions|updates|forums, bare words, OR, parentheses.
// Anything else is a 400, so a test cannot pass because a filter was silently ignored.

function parseQuery(query: string, now: number): Matcher {
  const tokens = query.match(/\(|\)|[a-z_]+:"[^"]*"|"[^"]*"|[^\s()]+/gi) ?? [];
  let position = 0;
  const parseOr = (): Matcher => {
    const branches = [parseAnd()];
    while (tokens[position] === "OR") {
      position += 1;
      branches.push(parseAnd());
    }
    return (m) => branches.some((branch) => branch(m));
  };
  const parseAnd = (): Matcher => {
    const terms: Matcher[] = [];
    while (position < tokens.length && tokens[position] !== ")" && tokens[position] !== "OR")
      terms.push(parseAtom());
    return (m) => terms.every((term) => term(m));
  };
  const parseAtom = (): Matcher => {
    const token = tokens[position++] as string;
    if (token !== "(") return parseTerm(token, now);
    const inner = parseOr();
    if (tokens[position++] !== ")") throw new QueryError("Unbalanced parentheses");
    return inner;
  };
  const result = parseOr();
  if (position < tokens.length) throw new QueryError("Unbalanced parentheses");
  return result;
}

function parseTerm(token: string, now: number): Matcher {
  const operator = token.startsWith('"') ? null : /^([a-z_]+):(.*)$/i.exec(token);
  if (!operator) {
    const word = token.replace(/^"|"$/g, "").toLowerCase();
    return (m) =>
      [header(m, "subject"), m.snippet, header(m, "from")].some((text) =>
        text.toLowerCase().includes(word),
      );
  }
  const name = (operator[1] as string).toLowerCase();
  const value = (operator[2] as string).replace(/^"|"$/g, "");
  const contains = (field: string) => (m: Stored) =>
    header(m, field).toLowerCase().includes(value.toLowerCase());
  switch (name) {
    case "subject":
    case "to":
      return contains(name);
    case "newer_than":
    case "older_than": {
      const span = /^(\d+)([dmy])$/i.exec(value);
      if (!span) throw new QueryError(`Invalid value for ${name}:`);
      const days =
        Number(span[1]) * { d: 1, m: 30, y: 365 }[(span[2] as string).toLowerCase() as "d"];
      const at = now - days * 86_400_000;
      return name === "newer_than" ? (m) => m.internalDate >= at : (m) => m.internalDate < at;
    }
    case "after":
    case "before": {
      const date = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);
      const at = date
        ? Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]))
        : Number.NaN;
      if (Number.isNaN(at)) throw new QueryError(`Invalid date for ${name}:`);
      return name === "after" ? (m) => m.internalDate >= at : (m) => m.internalDate < at;
    }
    case "from":
      return contains("from");
    case "in":
    case "label": {
      if (name === "in" && value.toLowerCase() === "anywhere") return () => true;
      const label = { inbox: "INBOX", sent: "SENT" }[value.toLowerCase()];
      if (!label) throw new QueryError(`Unsupported in: value ${value}`);
      return (m) => m.labelIds.includes(label);
    }
    case "is": {
      const label = { unread: "UNREAD", starred: "STARRED", important: "IMPORTANT" }[
        value.toLowerCase()
      ];
      if (!label) throw new QueryError(`Unsupported is: value ${value}`);
      return (m) => m.labelIds.includes(label);
    }
    case "has":
      if (value.toLowerCase() !== "attachment")
        throw new QueryError(`Unsupported has: value ${value}`);
      return (m) => hasAttachment(m.payload);
    case "category": {
      const category = value.toLowerCase();
      if (category === "primary")
        return (m) => m.labelIds.includes("INBOX") && !m.labelIds.some(isCategoryLabel);
      if (!["social", "promotions", "updates", "forums"].includes(category))
        throw new QueryError(`Unsupported category: value ${value}`);
      return (m) => m.labelIds.includes(`CATEGORY_${category.toUpperCase()}`);
    }
    default:
      throw new QueryError(`Unsupported operator ${name}:`);
  }
}

const isCategoryLabel = (label: string) => label.startsWith("CATEGORY_");

function hasAttachment(part: Part): boolean {
  return Boolean(part.filename) || (part.parts ?? []).some(hasAttachment);
}

function header(message: Stored, name: string): string {
  return message.headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
}

// Builds the MIME payload Gmail returns for format=full.

function store(source: EmulatedMessage): Stored {
  const charset = source.charset ?? "utf-8";
  const bodyPart = (mimeType: string, content: string): Part => {
    const bytes = Buffer.from(content, charset === "iso-8859-1" ? "latin1" : "utf8");
    return {
      mimeType,
      filename: "",
      headers: [{ name: "Content-Type", value: `${mimeType}; charset="${charset}"` }],
      body: { size: bytes.length, data: bytes.toString("base64url") },
    };
  };
  const text =
    source.text ?? (source.html === undefined ? (source.snippet ?? source.subject) : undefined);
  const bodies = [
    ...(text === undefined ? [] : [bodyPart("text/plain", text)]),
    ...(source.html === undefined ? [] : [bodyPart("text/html", source.html)]),
  ];
  const container = (mimeType: string, parts: Part[]): Part => ({
    mimeType,
    filename: "",
    headers: [{ name: "Content-Type", value: mimeType }],
    body: { size: 0 },
    parts,
  });
  let payload =
    bodies.length === 1 ? (bodies[0] as Part) : container("multipart/alternative", bodies);
  const files = new Map<string, string>();
  const inlineParts = (source.inlineImages ?? []).map((image, index): Part => {
    const attachmentId = `att-${source.id}-inline-${index}`;
    const bytes = Buffer.from(image.data, "base64");
    files.set(attachmentId, bytes.toString("base64url"));
    return {
      mimeType: image.mimeType,
      filename: `inline-${index}`,
      headers: [
        { name: "Content-Type", value: image.mimeType },
        { name: "Content-ID", value: `<${image.contentId}>` },
        { name: "Content-Disposition", value: "inline" },
      ],
      body: { size: bytes.length, attachmentId },
    };
  });
  if (source.attachments?.length || inlineParts.length) {
    payload = container("multipart/mixed", [
      payload,
      ...inlineParts,
      ...(source.attachments ?? []).map((a, index): Part => {
        const attachmentId = `att-${source.id}-file-${index}`;
        const bytes = a.data === undefined ? undefined : Buffer.from(a.data, "base64");
        if (bytes) files.set(attachmentId, bytes.toString("base64url"));
        return {
          mimeType: a.mimeType,
          filename: a.filename,
          headers: [{ name: "Content-Type", value: a.mimeType }],
          body: { size: bytes?.length ?? a.size, attachmentId },
        };
      }),
    ]);
  }
  numberParts(payload, "");
  const date = new Date(source.date);
  const headers: Header[] = [
    { name: "From", value: source.from },
    { name: "To", value: source.to },
    ...(source.cc ? [{ name: "Cc", value: source.cc }] : []),
    ...(source.replyTo ? [{ name: "Reply-To", value: source.replyTo }] : []),
    { name: "Subject", value: source.subject },
    { name: "Date", value: date.toUTCString() },
    { name: "Message-ID", value: source.messageId ?? `<${source.id}@mail.example.test>` },
    ...(source.inReplyTo ? [{ name: "In-Reply-To", value: source.inReplyTo }] : []),
    ...(source.references ? [{ name: "References", value: source.references }] : []),
    ...(source.headers ?? []),
  ];
  return {
    id: source.id,
    threadId: source.threadId ?? source.id,
    internalDate: date.getTime(),
    labelIds: source.labels,
    snippet: source.snippet ?? (text ?? "").slice(0, 100),
    headers,
    payload: { ...payload, headers: [...headers, ...payload.headers] },
    files,
  };
}

/** A message the mailbox owner sent, built from the raw text of a draft. */
function storeSent(id: string, draft: EmulatedDraft, address: string, at: Date): Stored {
  const mime = parseRawMime(draft.raw);
  const header = (name: string) => mime.header(name);
  return store({
    id,
    threadId: draft.threadId,
    date: at.toISOString(),
    labels: ["SENT"],
    from: address,
    to: header("To") ?? "",
    ...(header("Cc") ? { cc: header("Cc") } : {}),
    subject: header("Subject") ?? "",
    messageId: `<${id}@mail.example.test>`,
    ...(header("In-Reply-To") ? { inReplyTo: header("In-Reply-To") } : {}),
    ...(header("References") ? { references: header("References") } : {}),
    ...(mime.text === undefined ? {} : { text: mime.text }),
    ...(mime.html === undefined ? {} : { html: mime.html }),
  });
}

function numberParts(part: Part, id: string): void {
  part.partId = id;
  for (const [index, child] of (part.parts ?? []).entries())
    numberParts(child, id ? `${id}.${index}` : String(index));
}

// Default seed: two mailboxes dated relative to `now`.

function defaultMailboxes(now: Date): NonNullable<GmailSeed["mailboxes"]> {
  const ago = (days: number, hour = 9) =>
    new Date(now.getTime() - days * DAY_MS + (hour - 12) * 3_600_000).toISOString();
  const alice = "Alice Example <alice@example.test>";
  const priya = "Priya Shah <priya@example.test>";
  const messages: EmulatedMessage[] = [
    {
      id: "a-01",
      threadId: "t-contract",
      date: ago(6),
      labels: ["INBOX"],
      from: priya,
      to: alice,
      subject: "Contract renewal",
      text: "Can you confirm the renewal terms by Friday?",
    },
    {
      id: "a-02",
      threadId: "t-contract",
      date: ago(5),
      labels: ["SENT"],
      from: alice,
      to: priya,
      subject: "Re: Contract renewal",
      inReplyTo: "<a-01@mail.example.test>",
      references: "<a-01@mail.example.test>",
      text: "Confirmed. The terms look fine.",
    },
    {
      id: "a-03",
      threadId: "t-invoice",
      date: ago(2),
      labels: ["INBOX", "UNREAD"],
      from: "Billing <billing@example.test>",
      to: alice,
      subject: "Invoice 1042 due Friday",
      text: "Invoice 1042 for 480 is due this Friday.",
    },
    {
      id: "a-04",
      date: ago(3),
      labels: ["INBOX"],
      from: "News <news@example.test>",
      to: alice,
      subject: "Weekly newsletter",
      text: "Five things worth reading this week.",
    },
    {
      id: "a-05",
      date: ago(8),
      labels: ["INBOX"],
      from: priya,
      to: alice,
      cc: "Dev <dev@example.test>",
      subject: "Team offsite plans",
      text: "Offsite is on the 14th.",
      html: "<p>Offsite is on the <b>14th</b>.</p>",
    },
    {
      id: "a-06",
      date: ago(9),
      labels: ["INBOX"],
      from: "Shop <shop@example.test>",
      to: alice,
      subject: "Your receipt",
      html: "<html><body><p>Thanks for your order.</p><p>Total: 24.00</p></body></html>",
      snippet: "Thanks for your order. Total: 24.00",
    },
    {
      id: "a-07",
      date: ago(11),
      labels: ["INBOX"],
      from: "Lea <lea@example.test>",
      to: alice,
      subject: "Resume",
      text: "Voilà mon résumé, très cordialement.",
      charset: "iso-8859-1",
    },
    {
      id: "a-08",
      date: ago(12),
      labels: ["INBOX"],
      from: "Sam <sam@example.test>",
      to: alice,
      subject: "Q3 report",
      text: "The report is attached.",
      attachments: [{ filename: "q3-report.pdf", mimeType: "application/pdf", size: 20_480 }],
    },
    {
      id: "a-09",
      date: ago(13),
      labels: ["SENT"],
      from: alice,
      to: "Bob <bob@example.test>",
      subject: "Lunch Thursday?",
      text: "Are you free for lunch on Thursday?",
    },
  ];
  for (let i = 0; i < 12; i++) {
    const sent = i % 3 === 1;
    messages.push({
      id: `a-${10 + i}`,
      date: ago(40 + i * 100),
      labels: [sent ? "SENT" : "INBOX"],
      from: sent ? alice : "Archive <archive@example.test>",
      to: sent ? "Archive <archive@example.test>" : alice,
      subject: `Archive topic ${i + 1}`,
      text: `Older message number ${i + 1}.`,
    });
  }
  const bob = "Bob Example <bob@example.test>";
  const bobMessages: EmulatedMessage[] = Array.from({ length: 9 }, (_, i) => ({
    id: `b-${String(i + 1).padStart(2, "0")}`,
    date: ago(1 + i * 45),
    labels: i % 4 === 3 ? ["SENT"] : i === 0 ? ["INBOX", "UNREAD"] : ["INBOX"],
    from: i % 4 === 3 ? bob : "Carol <carol@example.test>",
    to: i % 4 === 3 ? "Carol <carol@example.test>" : bob,
    subject: `Bob topic ${i + 1}`,
    text: `Message ${i + 1} for Bob.`,
  }));
  return {
    "acct-a": { address: "alice@example.test", messages },
    "acct-b": { address: "bob@example.test", messages: bobMessages },
  };
}

export interface MailEmulator {
  /** A real `GmailMailProvider` whose connector proxy answers from `gmail`. */
  provider: MailProvider;
  gmail: GmailApiEmulator;
  /** The seeded accounts, all owned by one emulated user. */
  accounts: MailAccount[];
}

export function createMailEmulator(
  options: {
    now?: Date;
    /** Accounts are connected through the app's own Google login, the only route that can hold filters. */
    native?: boolean;
  } & Pick<GmailMailProviderDeps, "sleep" | "random"> = {},
): MailEmulator {
  const gmail = new GmailApiEmulator({ now: options.now });
  const owner = { spaceId: "space-emulator", userId: "user-emulator" };
  const accounts: MailAccount[] = gmail.accountRefs().map((accountRef) => ({
    id: `conn-${accountRef}`,
    connectorId: options.native ? "google" : "emulator",
    app: "gmail",
    accountRef,
    label: `Mailbox ${accountRef}`,
    ...owner,
    address: gmail.addressOf(accountRef) ?? null,
  }));
  const rows = accounts.map((account) => ({
    id: account.id,
    connectorId: account.connectorId,
    provider: account.app,
    providerRef: account.accountRef,
    displayName: account.label,
    status: "connected",
    spaceId: account.spaceId,
    userId: account.userId,
    mailAddress: account.address,
  }));
  // Stands in for the Connection table so the production listAccounts runs.
  const prisma = {
    connection: {
      findMany: async ({ where }: { where: { spaceId: string; userId: string } }) =>
        rows
          .filter((row) => row.spaceId === where.spaceId && row.userId === where.userId)
          .map(({ mailAddress, ...row }) => ({
            ...row,
            // Read on every call, so a scope granted later shows in listAccounts.
            metadata: {
              mailAddress,
              ...(options.native ? { scope: gmail.scopesOf(row.providerRef).join(" ") } : {}),
            },
          })),
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as Pick<PrismaClient, "connection">;
  const connector = {
    proxy: async (request) =>
      gmail.handle(request.accountRef, request.url, request.method, request.body),
  } as Pick<ManagedConnectorProvider, "proxy">;
  const provider = createMailProvider({
    prisma,
    connectors: { managed: () => connector as ManagedConnectorProvider },
    sleep: options.sleep,
    random: options.random,
  });
  return { provider, gmail, accounts };
}
