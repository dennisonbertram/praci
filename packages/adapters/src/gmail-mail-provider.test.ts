import {
  type AdapterContext,
  type ConnectorProxyRequest,
  type ConnectorProxyResponse,
  type MailAccount,
  MailProviderError,
  type ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import {
  createMailEmulator,
  type EmulatedMessage,
  GmailApiEmulator,
} from "./gmail-api-emulator.js";
import {
  createMailProvider,
  GmailMailProvider,
  isMailConnection,
  parseAddressList,
} from "./gmail-mail-provider.js";
import { assertMailConformance } from "./testing/mail-conformance.js";

const NOW = new Date("2026-10-01T12:00:00Z");
const base: Omit<EmulatedMessage, "id" | "date"> = {
  labels: ["INBOX"],
  from: "Ann <ann@example.test>",
  to: "me@example.test",
  subject: "Hello",
};

function context(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    operationId: "op",
    traceId: "trace",
    spaceId: "space-1",
    userId: "user-1",
    signal: new AbortController().signal,
    ...overrides,
  };
}
function account(overrides: Partial<MailAccount> = {}): MailAccount {
  return {
    id: "conn-1",
    connectorId: "test",
    app: "gmail",
    accountRef: "x",
    label: "Test",
    spaceId: "space-1",
    userId: "user-1",
    address: "me@example.test",
    ...overrides,
  };
}
type Proxy = (request: ConnectorProxyRequest) => Promise<ConnectorProxyResponse>;
function connectors(proxy: Proxy | undefined): {
  managed(id: string): ManagedConnectorProvider | undefined;
} {
  return {
    managed: () => (proxy ? ({ proxy } as unknown as ManagedConnectorProvider) : undefined),
  };
}
function over(
  gmail: GmailApiEmulator,
  extra: { sleep?: (ms: number, s: AbortSignal) => Promise<void> } = {},
) {
  const sleeps: number[] = [];
  const provider = new GmailMailProvider({
    connectors: connectors(async (r) => gmail.handle(r.accountRef, r.url)),
    sleep: extra.sleep ?? (async (ms) => void sleeps.push(ms)),
    random: () => 0,
  });
  return { provider, sleeps };
}
function box(messages: EmulatedMessage[]) {
  return new GmailApiEmulator({
    now: NOW,
    mailboxes: { x: { address: "me@example.test", messages } },
  });
}
function msg(id: string, extra: Partial<EmulatedMessage> = {}, day = 1): EmulatedMessage {
  return { ...base, id, date: `2026-09-${String(day).padStart(2, "0")}T10:00:00Z`, ...extra };
}
const rejection = async (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("GmailMailProvider with the emulator", () => {
  it("passes the shared mail conformance suite", async () => {
    const emulator = createMailEmulator({ now: NOW, sleep: async () => {}, random: () => 0 });
    await assertMailConformance(emulator.provider, emulator);
  });

  it("lists accounts through createMailProvider scope and rejects a foreign scope", async () => {
    const emulator = createMailEmulator({ now: NOW });
    const [first] = emulator.accounts as [MailAccount];
    const ctx = context({ spaceId: first.spaceId, userId: first.userId });
    const accounts = await emulator.provider.listAccounts(
      { spaceId: first.spaceId, userId: first.userId },
      ctx,
    );
    expect(accounts.map((a) => a.accountRef)).toEqual(["acct-a", "acct-b"]);
    expect(accounts[0]?.address).toBe("alice@example.test");
    await expect(
      emulator.provider.listAccounts({ spaceId: first.spaceId, userId: "someone-else" }, ctx),
    ).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("listMessages", () => {
  it("gives auth before any request when the account belongs to another user or space", async () => {
    const gmail = box([msg("m1")]);
    const { provider } = over(gmail);
    for (const owner of [{ userId: "user-2" }, { spaceId: "space-2" }]) {
      const error = await rejection(
        provider.listMessages(account(owner), { query: "", pageSize: 10 }, context()),
      );
      expect(error).toBeInstanceOf(MailProviderError);
      expect(error).toMatchObject({ kind: "auth" });
      expect(await rejection(provider.getMessage(account(owner), "m1", context()))).toMatchObject({
        kind: "auth",
      });
    }
    expect(gmail.requests).toHaveLength(0);
  });

  it("rejects page sizes outside 1..500 without sending a request", async () => {
    const gmail = box([msg("m1")]);
    const { provider } = over(gmail);
    for (const pageSize of [0, 501, 1.5, Number.NaN]) {
      await expect(
        provider.listMessages(account(), { query: "", pageSize }, context()),
      ).rejects.toBeInstanceOf(RangeError);
    }
    expect(gmail.requests).toHaveLength(0);
    await expect(
      provider.listMessages(account(), { query: "", pageSize: 500 }, context()),
    ).resolves.toBeDefined();
  });

  it("pages with nextPageToken, keeps list order and ends without a token", async () => {
    const gmail = box([1, 2, 3, 4, 5].map((n) => msg(`m${n}`, {}, n)));
    const { provider } = over(gmail);
    const first = await provider.listMessages(account(), { query: "", pageSize: 2 }, context());
    expect(first.messages.map((m) => m.id)).toEqual(["m5", "m4"]);
    expect(first.messages[0]?.date).toBe("2026-09-05T10:00:00.000Z");
    expect(first.nextPageToken).toEqual(expect.any(String));
    const second = await provider.listMessages(
      account(),
      { query: "", pageSize: 2, pageToken: first.nextPageToken },
      context(),
    );
    const third = await provider.listMessages(
      account(),
      { query: "", pageSize: 2, pageToken: second.nextPageToken },
      context(),
    );
    expect([...second.messages, ...third.messages].map((m) => m.id)).toEqual(["m3", "m2", "m1"]);
    expect(third.nextPageToken).toBeUndefined();
    expect(third.unhydratedIds ?? []).toEqual([]);
  });

  it("builds the query: parenthesised OR groups plus after and before dates", async () => {
    const gmail = box([msg("m1")]);
    const { provider } = over(gmail);
    await provider.listMessages(
      account(),
      { query: "a OR b", after: "2026-01-05", before: "2026-02-01", pageSize: 7 },
      context(),
    );
    await provider.listMessages(
      account(),
      { query: "  ", after: "2026-01-05", pageSize: 7 },
      context(),
    );
    const lists = gmail.requests
      .map((r) => new URL(r.url))
      .filter((u) => u.pathname.endsWith("/messages"));
    expect(lists[0]?.searchParams.get("q")).toBe("(a OR b) after:2026/01/05 before:2026/02/01");
    expect(lists[0]?.searchParams.get("maxResults")).toBe("7");
    expect(lists[1]?.searchParams.get("q")).toBe("after:2026/01/05");
    await expect(
      provider.listMessages(account(), { query: "", after: "yesterday", pageSize: 7 }, context()),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it("requests only the metadata headers it needs for each message", async () => {
    const gmail = box([msg("m1")]);
    const { provider } = over(gmail);
    await provider.listMessages(account(), { query: "", pageSize: 5 }, context());
    const get = gmail.requests.map((r) => new URL(r.url)).find((u) => u.pathname.endsWith("/m1"));
    expect(get?.searchParams.get("format")).toBe("metadata");
    expect(get?.searchParams.getAll("metadataHeaders")).toEqual([
      "From",
      "To",
      "Cc",
      "Subject",
      "Date",
    ]);
  });

  it("parses addresses, decoded snippets, unread state and encoded subjects", async () => {
    const gmail = box([
      msg("m1", {
        labels: ["INBOX", "UNREAD"],
        from: '"Doe, Jane" <jane@example.test>',
        to: 'a@example.test, "Smith, Bob" <bob@example.test>',
        cc: "carol@example.test",
        subject: "=?UTF-8?B?Q2Fmw6k=?= menu =?UTF-8?Q?=E2=9C=93?=",
        snippet: "It&#39;s &amp; &quot;ok&quot; &lt;3 &#x41;",
      }),
    ]);
    const { provider } = over(gmail);
    const [m] = (await provider.listMessages(account(), { query: "", pageSize: 5 }, context()))
      .messages;
    expect(m?.from).toEqual({ name: "Doe, Jane", address: "jane@example.test" });
    expect(m?.to).toEqual([
      { address: "a@example.test" },
      { name: "Smith, Bob", address: "bob@example.test" },
    ]);
    expect(m?.cc).toEqual([{ address: "carol@example.test" }]);
    expect(m?.subject).toBe("Café menu ✓");
    expect(m?.snippet).toBe('It\'s & "ok" <3 A');
    expect(m?.unread).toBe(true);
    expect(m?.labelIds).toEqual(["INBOX", "UNREAD"]);
  });

  it("keeps at most 4 requests in flight per account, independently per account", async () => {
    const inflight = new Map<string, number>();
    const peak = new Map<string, number>();
    let total = 0;
    let totalPeak = 0;
    const proxy: Proxy = async ({ url, accountRef }) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/messages")) {
        return {
          status: 200,
          data: {
            messages: Array.from({ length: 12 }, (_, i) => ({
              id: `${accountRef}${i}`,
              threadId: "t",
            })),
          },
        };
      }
      const key = accountRef;
      inflight.set(key, (inflight.get(key) ?? 0) + 1);
      total += 1;
      peak.set(key, Math.max(peak.get(key) ?? 0, inflight.get(key) ?? 0));
      totalPeak = Math.max(totalPeak, total);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inflight.set(key, (inflight.get(key) ?? 1) - 1);
      total -= 1;
      return {
        status: 200,
        data: {
          id: u.pathname.split("/").pop(),
          threadId: "t",
          internalDate: "1700000000000",
          payload: { headers: [] },
        },
      };
    };
    const provider = new GmailMailProvider({ connectors: connectors(proxy) });
    const [a, b] = await Promise.all([
      provider.listMessages(
        account({ id: "c-a", accountRef: "A" }),
        { query: "", pageSize: 12 },
        context(),
      ),
      provider.listMessages(
        account({ id: "c-b", accountRef: "B" }),
        { query: "", pageSize: 12 },
        context(),
      ),
    ]);
    expect(a.messages).toHaveLength(12);
    expect(b.messages).toHaveLength(12);
    expect(peak.get("A")).toBe(4);
    expect(peak.get("B")).toBe(4);
    expect(totalPeak).toBe(8);
  });

  it("skips malformed messages and drops a message deleted between list and get", async () => {
    const proxy: Proxy = async ({ url }) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/messages")) {
        return {
          status: 200,
          data: {
            messages: ["ok1", "bad", "gone", "ok2", { nope: true }].map((id) =>
              typeof id === "string" ? { id, threadId: "t" } : id,
            ),
          },
        };
      }
      const id = u.pathname.split("/").pop();
      if (id === "gone") return { status: 404, data: {} };
      if (id === "bad") return { status: 200, data: { id: "bad", internalDate: "not-a-number" } };
      return {
        status: 200,
        data: { id, threadId: "t", internalDate: "1700000000000", payload: { headers: [] } },
      };
    };
    const provider = new GmailMailProvider({ connectors: connectors(proxy) });
    const page = await provider.listMessages(account(), { query: "", pageSize: 10 }, context());
    expect(page.messages.map((m) => m.id)).toEqual(["ok1", "ok2"]);
    expect(page.unhydratedIds ?? []).toEqual([]);
  });
});

describe("retries and status mapping", () => {
  it("retries 429 with exponential backoff and honors Retry-After", async () => {
    const gmail = box([msg("m1")]);
    const { provider, sleeps } = over(gmail);
    gmail.failNext(429, { times: 2 });
    await provider.listMessages(account(), { query: "", pageSize: 5 }, context());
    expect(sleeps).toEqual([500, 1000]);

    sleeps.length = 0;
    gmail.failNext(429, { times: 2, retryAfter: 2 });
    await provider.listMessages(account(), { query: "", pageSize: 5 }, context());
    expect(sleeps).toEqual([2000, 2000]);
  });

  it("retries a 403 rate-limit reason but maps other 403 reasons to auth immediately", async () => {
    const gmail = box([msg("m1")]);
    const { provider, sleeps } = over(gmail);
    gmail.failNext(403, { reason: "userRateLimitExceeded" });
    await provider.listMessages(account(), { query: "", pageSize: 5 }, context());
    expect(sleeps).toHaveLength(1);

    for (const reason of ["insufficientPermissions", "authError"]) {
      gmail.requests.length = 0;
      gmail.failNext(403, { reason });
      expect(
        await rejection(provider.listMessages(account(), { query: "", pageSize: 5 }, context())),
      ).toMatchObject({ kind: "auth" });
      expect(gmail.requests).toHaveLength(1);
    }
  });

  it("gives rate_limited with the retry delay after 3 attempts", async () => {
    const gmail = box([msg("m1")]);
    const { provider } = over(gmail);
    gmail.failNext(429, { times: 10, retryAfter: 4 });
    const error = await rejection(
      provider.listMessages(account(), { query: "", pageSize: 5 }, context()),
    );
    expect(error).toMatchObject({ kind: "rate_limited", retryAfterMs: 4000 });
    expect(gmail.requests).toHaveLength(3);
  });

  it("stops retrying when the caller aborts", async () => {
    const gmail = box([msg("m1")]);
    const controller = new AbortController();
    const { provider } = over(gmail, { sleep: async () => controller.abort() });
    gmail.failNext(429, { times: 10 });
    const error = await rejection(
      provider.listMessages(
        account(),
        { query: "", pageSize: 5 },
        context({ signal: controller.signal }),
      ),
    );
    expect(error).toMatchObject({ kind: "rate_limited" });
    expect(gmail.requests).toHaveLength(1);
  });

  it("maps 401 to auth, 404 on get to not_found, 500 to unavailable and transport errors to unavailable", async () => {
    const gmail = box([msg("m1")]);
    const { provider } = over(gmail);
    gmail.failNext(401);
    expect(
      await rejection(provider.listMessages(account(), { query: "", pageSize: 5 }, context())),
    ).toMatchObject({ kind: "auth" });
    expect(await rejection(provider.getMessage(account(), "missing", context()))).toMatchObject({
      kind: "not_found",
    });
    gmail.failNext(500);
    expect(
      await rejection(provider.listMessages(account(), { query: "", pageSize: 5 }, context())),
    ).toMatchObject({ kind: "unavailable" });

    const leaky = new GmailMailProvider({
      connectors: connectors(async () => {
        throw new Error("connect failed for token sk-secret-token");
      }),
    });
    const error = (await rejection(
      leaky.listMessages(account(), { query: "", pageSize: 5 }, context()),
    )) as MailProviderError;
    expect(error).toMatchObject({ kind: "unavailable" });
    expect(error.message).not.toContain("sk-secret-token");
  });

  it("gives unavailable when the connector cannot proxy", async () => {
    const provider = new GmailMailProvider({ connectors: connectors(undefined) });
    expect(
      await rejection(provider.listMessages(account(), { query: "", pageSize: 5 }, context())),
    ).toMatchObject({ kind: "unavailable" });
  });
});

describe("partial pages", () => {
  it("returns hydrated messages, the rest as unhydratedIds and the list token, then resumes by ids", async () => {
    const gmail = box([1, 2, 3, 4, 5, 6, 7, 8].map((n) => msg(`m${n}`, {}, n)));
    const { provider } = over(gmail);
    gmail.failNext(429, { times: 100, urlIncludes: "/messages/", skip: 2 });
    const page = await provider.listMessages(account(), { query: "", pageSize: 6 }, context());
    expect(page.messages.map((m) => m.id)).toEqual(["m8", "m7"]);
    expect(page.unhydratedIds).toEqual(["m6", "m5", "m4", "m3"]);
    expect(page.nextPageToken).toEqual(expect.any(String));

    gmail.clearFailures();
    gmail.requests.length = 0;
    const resumed = await provider.listMessages(
      account(),
      { query: "ignored", pageSize: 6, ids: page.unhydratedIds },
      context(),
    );
    expect(resumed.messages.map((m) => m.id)).toEqual(["m6", "m5", "m4", "m3"]);
    expect(resumed.unhydratedIds ?? []).toEqual([]);
    expect(gmail.requests.every((r) => new URL(r.url).pathname.includes("/messages/"))).toBe(true);
    expect(gmail.requests).toHaveLength(4);
  });

  it("returns what it has when the signal aborts during hydration", async () => {
    const controller = new AbortController();
    const gmail = box([1, 2, 3, 4, 5, 6].map((n) => msg(`m${n}`, {}, n)));
    const proxy: Proxy = async ({ accountRef, url }) => {
      const response = gmail.handle(accountRef, url);
      if (new URL(url).pathname.endsWith("/m6")) controller.abort();
      return response;
    };
    const provider = new GmailMailProvider({ connectors: connectors(proxy) });
    const page = await provider.listMessages(
      account(),
      { query: "", pageSize: 6 },
      context({ signal: controller.signal }),
    );
    expect(page.messages.map((m) => m.id)).toContain("m6");
    expect(page.messages.length + (page.unhydratedIds ?? []).length).toBe(6);
    expect((page.unhydratedIds ?? []).length).toBeGreaterThan(0);
  });

  it("throws auth during hydration instead of returning a partial page", async () => {
    const gmail = box([msg("m1"), msg("m2", {}, 2)]);
    const { provider } = over(gmail);
    gmail.failNext(401, { urlIncludes: "/messages/" });
    expect(
      await rejection(provider.listMessages(account(), { query: "", pageSize: 5 }, context())),
    ).toMatchObject({ kind: "auth" });
  });
});

describe("getMessage", () => {
  const html =
    "<html><head><style>p{color:red}</style></head><body><p>Hi there</p><p>Second</p><script>alert(1)</script></body></html>";

  it("prefers text/plain and keeps the raw html and attachment list", async () => {
    const gmail = box([
      msg("m1", {
        text: "Plain body",
        html: "<p>Html body</p>",
        attachments: [{ filename: "report.pdf", mimeType: "application/pdf", size: 1234 }],
      }),
    ]);
    const { provider } = over(gmail);
    const full = await provider.getMessage(account(), "m1", context());
    expect(full.text).toBe("Plain body");
    expect(full.html).toBe("<p>Html body</p>");
    expect(full.truncated).toBe(false);
    expect(full.attachments).toEqual([
      { filename: "report.pdf", mimeType: "application/pdf", size: 1234 },
    ]);
    expect(full.subject).toBe("Hello");
  });

  it("reduces an html-only body to text without style or script content", async () => {
    const gmail = box([msg("m1", { html })]);
    const { provider } = over(gmail);
    const full = await provider.getMessage(account(), "m1", context());
    expect(full.text).toContain("Hi there");
    expect(full.text).toContain("Second");
    expect(full.text).not.toContain("color:red");
    expect(full.text).not.toContain("alert");
    expect(full.text).not.toMatch(/Hi thereSecond/);
    expect(full.html).toBe(html);
  });

  it("decodes the part charset", async () => {
    const gmail = box([msg("m1", { text: "café crème", charset: "iso-8859-1" })]);
    const { provider } = over(gmail);
    expect((await provider.getMessage(account(), "m1", context())).text).toBe("café crème");
  });

  it("truncates long text at 40,000 characters and flags it", async () => {
    const gmail = box([msg("m1", { text: "x".repeat(50_000) })]);
    const { provider } = over(gmail);
    const full = await provider.getMessage(account(), "m1", context());
    expect(full.text).toHaveLength(40_000);
    expect(full.truncated).toBe(true);
  });

  it("truncates html at 200,000 characters and flags it", async () => {
    const gmail = box([msg("m1", { text: "short", html: `<p>${"y".repeat(250_000)}</p>` })]);
    const { provider } = over(gmail);
    const full = await provider.getMessage(account(), "m1", context());
    expect(full.html).toHaveLength(200_000);
    expect(full.truncated).toBe(true);
  });
});

describe("parseAddressList", () => {
  it("handles bare, named, quoted and comma-containing values", () => {
    expect(parseAddressList("a@example.test")).toEqual([{ address: "a@example.test" }]);
    expect(parseAddressList("Ann <ann@example.test>")).toEqual([
      { name: "Ann", address: "ann@example.test" },
    ]);
    expect(parseAddressList('"Doe, Jane" <jane@example.test>, b@example.test')).toEqual([
      { name: "Doe, Jane", address: "jane@example.test" },
      { address: "b@example.test" },
    ]);
    expect(parseAddressList('"He said \\"hi\\"" <h@example.test>')).toEqual([
      { name: 'He said "hi"', address: "h@example.test" },
    ]);
    expect(parseAddressList("")).toEqual([]);
    expect(parseAddressList("undisclosed-recipients:;")).toEqual([]);
  });
});

describe("isMailConnection and listAccounts", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: "c1",
    connectorId: "composio",
    provider: "GMAIL",
    displayName: "Work",
    status: "connected",
    providerRef: "ca_1",
    spaceId: "space-1",
    userId: "user-1",
    metadata: {},
    ...over,
  });

  it("accepts only connected gmail rows that have a providerRef", () => {
    expect(isMailConnection(row())).toBe(true);
    expect(isMailConnection(row({ provider: " gmail " }))).toBe(true);
    expect(isMailConnection(row({ status: "pending" }))).toBe(false);
    expect(isMailConnection(row({ status: "revoked" }))).toBe(false);
    expect(isMailConnection(row({ providerRef: null }))).toBe(false);
    expect(isMailConnection(row({ provider: "GITHUB" }))).toBe(false);
  });

  it("keeps gmail rows from every connector and caches a looked-up address", async () => {
    const rows = [
      row({ id: "c1", connectorId: "composio", metadata: { mailAddress: "known@example.test" } }),
      row({ id: "c2", connectorId: "pipedream", provider: "gmail", providerRef: "apn_1" }),
      row({ id: "c3", connectorId: "google", provider: "gmail", providerRef: "sub-1" }),
      row({ id: "c4", provider: "GITHUB" }),
      row({ id: "c5", status: "pending" }),
    ];
    const findMany = vi.fn(async () => rows);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const requests: ConnectorProxyRequest[] = [];
    const provider = createMailProvider({
      prisma: { connection: { findMany, updateMany } } as never,
      connectors: connectors(async (r) => {
        requests.push(r);
        return { status: 200, data: { emailAddress: `${r.accountRef}@example.test` } };
      }),
    });
    const accounts = await provider.listAccounts(
      { spaceId: "space-1", userId: "user-1" },
      context(),
    );
    expect(accounts.map((a) => [a.id, a.connectorId, a.address])).toEqual([
      ["c1", "composio", "known@example.test"],
      ["c2", "pipedream", "apn_1@example.test"],
      ["c3", "google", "sub-1@example.test"],
    ]);
    expect(accounts[1]).toMatchObject({
      app: "gmail",
      accountRef: "apn_1",
      label: "Work",
      spaceId: "space-1",
      userId: "user-1",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ spaceId: "space-1", userId: "user-1" }),
      }),
    );
    expect(requests.map((r) => r.url)).toEqual([
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    ]);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "c2", spaceId: "space-1", userId: "user-1" }),
        data: { metadata: { mailAddress: "apn_1@example.test" } },
      }),
    );
  });

  it("gives address null, and writes nothing, when the profile lookup fails", async () => {
    const updateMany = vi.fn();
    const provider = createMailProvider({
      prisma: { connection: { findMany: async () => [row()], updateMany } } as never,
      connectors: connectors(async () => ({ status: 401, data: {} })),
    });
    const [only] = await provider.listAccounts({ spaceId: "space-1", userId: "user-1" }, context());
    expect(only?.address).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
