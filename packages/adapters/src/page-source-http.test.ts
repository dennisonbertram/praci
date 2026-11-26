import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cards: { id: string; blocks: unknown[]; runId: string; botId: string }[] = [];
vi.mock("@rakazo/db", async (original) => ({
  ...(await original<typeof import("@rakazo/db")>()),
  createThreadMessageInTransaction: vi.fn(
    async (_tx: unknown, input: { blocks: unknown[]; runId: string; botId: string }) => {
      const card = { id: `m${cards.length + 1}`, ...input };
      cards.push(card);
      return card;
    },
  ),
  appendEventInTransaction: vi.fn(async () => ({ seq: 1 })),
}));
vi.mock("./run-notification.js", () => ({ notifyThreadEvent: vi.fn(async () => "created") }));

const { answerPageSourceApproval, pageSourceCallHash } = await import("./page-source-approval.js");
const { parseCsv } = await import("./page-source-http.js");
const { pageSourceToolFromTool, refreshPageSource, listPageSources } = await import(
  "./page-sources.js"
);

type Row = Record<string, any>;

/** Equality on the plain fields of a where clause; nested relation filters are ignored. */
const matches = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([key, want]) =>
    want === null || typeof want !== "object" || want instanceof Date
      ? want instanceof Date
        ? row[key]?.getTime?.() === want.getTime()
        : row[key] === want
      : "in" in want
        ? want.in.includes(row[key])
        : true,
  );

const SECRET = "test-only-secret-value";
const publicResolver = async () => [{ address: "203.0.113.10", family: 4 as const }];
const { EncryptedSecretStore } = await import("./secrets.js");
const secretStore = new EncryptedSecretStore("test-only-encryption-key");
const URL_OK = "https://api.example.com/v1/revenue?period=week";

async function world(
  opts: { rules?: Row[]; secretOrigin?: string; noSecret?: boolean; secretValue?: string } = {},
) {
  let nextId = 1;
  const sources: Row[] = [];
  const snapshots: Row[] = [];
  const bots: Row[] = [
    {
      id: "bot",
      spaceId: "sp",
      userId: "owner",
      name: "Finance helper",
      spawnKey: null,
      audience: "internal",
      archivedAt: null,
      disabledBuiltinTools: [],
    },
  ];
  const encrypted = await secretStore.put(
    opts.secretValue ?? SECRET,
    {
      userId: "owner",
      spaceId: "sp",
      botId: "bot",
      operationId: "t",
      traceId: "t",
      signal: new AbortController().signal,
    },
    { recordId: "secret-1" },
  );
  const secretRow = {
    userId: "owner",
    spaceId: "sp",
    botId: "bot",
    name: "billing",
    origin: opts.secretOrigin ?? "https://api.example.com",
    auth: { type: "bearer" },
    ...encrypted,
  };
  const prisma: Row = {
    bot: {
      findFirst: vi.fn(async ({ where }: Row) => bots.find((b) => matches(b, where)) ?? null),
    },
    botPage: {
      findFirst: vi.fn(async () => ({
        id: "page",
        botId: "bot",
        title: "Revenue",
        content: "",
        revision: 1,
        updatedBy: "bot",
        updatedAt: new Date(),
      })),
      findMany: vi.fn(async () => []),
    },
    actionApprovalRule: { findMany: vi.fn(async () => opts.rules ?? []) },
    botSecret: {
      findFirst: vi.fn(async ({ where }: Row) =>
        !opts.noSecret && matches(secretRow, where) ? secretRow : null,
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    run: {
      findFirst: vi.fn(async () => ({
        id: "run",
        spaceId: "sp",
        userId: "owner",
        botId: "bot",
        threadId: "t",
      })),
    },
    thread: { findFirst: vi.fn(async () => ({ id: "t" })) },
    message: {
      findFirst: vi.fn(async ({ where }: Row) => {
        const card = cards.find((c) => c.id === where.id);
        return card && where.threadId === "t" && where.runId === card.runId
          ? { id: card.id, botId: card.botId, blocks: card.blocks }
          : null;
      }),
      update: vi.fn(async ({ where, data }: Row) => {
        const card = cards.find((c) => c.id === where.id)!;
        card.blocks = data.blocks;
        return card;
      }),
    },
    pageSource: {
      findMany: vi.fn(async ({ where }: Row) => sources.filter((s) => matches(s, where))),
      findFirst: vi.fn(async ({ where }: Row) => sources.find((s) => matches(s, where)) ?? null),
      findFirstOrThrow: vi.fn(async ({ where }: Row) => sources.find((s) => matches(s, where))!),
      count: vi.fn(async () => sources.length),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: `src${nextId++}`, lastRefreshAt: null, updatedAt: new Date(), ...data };
        sources.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = sources.find((s) => s.id === where.id)!;
        Object.assign(row, data, { updatedAt: new Date(Date.now() + 1) });
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const hits = sources.filter((s) => matches(s, where));
        for (const row of hits) Object.assign(row, data, { updatedAt: new Date(Date.now() + 1) });
        return { count: hits.length };
      }),
    },
    pageSourceSnapshot: {
      create: vi.fn(async ({ data }: Row) => snapshots.push(data)),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ revenue: 5 }),
  );
  const resolveHostname = vi.fn(publicResolver);
  const deps = {
    prisma: prisma as unknown as PrismaClient,
    events: { append: vi.fn(async () => ({}) as never), notify: vi.fn(async () => undefined) },
    secretStore,
    network: { fetch: fetch as never, resolveHostname },
  };
  const scope = { spaceId: "sp", botId: "bot", userId: "owner", runId: "run" };
  const set = (args: Row) => pageSourceToolFromTool("page_source_set", deps, scope, args);
  const httpArgs = (over: Row = {}) => ({
    name: "Revenue",
    kind: "http",
    url: URL_OK,
    schedule: "1h",
    ...over,
  });
  const answer = (answerText: string, messageId = "m1") =>
    answerPageSourceApproval(
      deps,
      { spaceId: "sp", userId: "owner", threadId: "t" },
      { runId: "run", messageId, answer: answerText },
    );
  const refresh = () => refreshPageSource(deps, sources[0] as never);
  /** Save, approve and return the active row. */
  const approved = async (over: Row = {}) => {
    await set(httpArgs(over));
    await answer("allow");
  };
  return {
    prisma,
    sources,
    snapshots,
    deps,
    set,
    httpArgs,
    answer,
    fetch,
    refresh,
    approved,
    resolveHostname,
  };
}

beforeEach(() => {
  cards.length = 0;
});

describe("page_source_set for an http source", () => {
  it("saves it pending, posts the card, and fetches nothing", async () => {
    const w = await world();
    const result = await w.set(w.httpArgs());
    expect(result).toMatchObject({ status: "pending", note: "Waiting for the owner's approval" });
    expect(w.sources[0]).toMatchObject({
      kind: "http",
      status: "pending",
      approvedCallHash: null,
      call: { url: URL_OK, accept: "json" },
    });
    expect(w.fetch).not.toHaveBeenCalled();
    expect(cards[0]?.blocks[0]).toMatchObject({
      kind: "ask",
      text: "Read api.example.com every hour?",
      detail: `Request: GET ${URL_OK}\nPage: Revenue`,
      pageSource: { sourceId: "src1", callHash: pageSourceCallHash("http", w.sources[0]!.call) },
    });
  });

  it("shows the key name, never its value, when a secret is set", async () => {
    const w = await world();
    await w.set(w.httpArgs({ secret: "billing" }));
    const block = cards[0]?.blocks[0] as { detail: string };
    expect(block.detail).toBe(`Request: GET ${URL_OK}\nKey: billing\nPage: Revenue`);
    expect(JSON.stringify(cards)).not.toContain(SECRET);
    expect(w.sources[0]?.call).toEqual({ url: URL_OK, secret: "billing", accept: "json" });
  });

  it.each([
    ["credentials", { url: "https://user:pw@api.example.com/x" }, /credentials/],
    ["a non-http scheme", { url: "ftp://api.example.com/x" }, /absolute http/],
    ["a private IP literal", { url: "http://10.0.0.1/x" }, /private or internal/],
    ["localhost", { url: "http://localhost:3000/x" }, /private or internal/],
    ["a metadata host", { url: "http://169.254.169.254/latest" }, /private or internal/],
    ["a fragment", { url: "https://api.example.com/x#frag" }, /fragment/],
    [
      "a too long URL",
      { url: `https://api.example.com/${"a".repeat(1000)}` },
      /Too big|at most|characters|absolute/i,
    ],
    ["a bad accept", { accept: "xml" }, /./],
    ["a bad secret name", { secret: "Bad Name" }, /./],
    ["no url", { url: undefined }, /./],
  ])("refuses %s and saves nothing", async (_label, over, message) => {
    const w = await world();
    const result = (await w.set(w.httpArgs(over))) as { error: string };
    expect(result.error).toMatch(message);
    expect(w.sources).toHaveLength(0);
    expect(cards).toHaveLength(0);
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("refuses a missing secret", async () => {
    const w = await world({ noSecret: true });
    const result = (await w.set(w.httpArgs({ secret: "billing" }))) as { error: string };
    expect(result.error).toMatch(/no saved key/);
    expect(w.sources).toHaveLength(0);
  });

  it("refuses a secret saved for another origin", async () => {
    const w = await world({ secretOrigin: "https://other.example.org" });
    const result = (await w.set(w.httpArgs({ secret: "billing" }))) as { error: string };
    expect(result.error).toMatch(/different site/);
    expect(w.sources).toHaveLength(0);
    // The scheme and port count too.
    const http = await world();
    expect(
      (
        (await http.set(http.httpArgs({ url: "http://api.example.com/x", secret: "billing" }))) as {
          error: string;
        }
      ).error,
    ).toMatch(/different site/);
  });

  it("refuses when a block rule covers the site, also for a tool-wide block", async () => {
    for (const rule of [
      { effect: "block", matchKind: "site", matchValue: "example.com", botId: null },
      { effect: "block", matchKind: "tool", matchValue: "web_fetch", botId: null },
    ]) {
      const w = await world({ rules: [rule] });
      const result = (await w.set(w.httpArgs())) as { error: string };
      expect(result.error).toMatch(/Block rule/);
      expect(w.sources).toHaveLength(0);
    }
  });

  it("refuses a request line longer than the card limit", async () => {
    const w = await world();
    const url = `https://api.example.com/${"a".repeat(480)}`;
    const result = (await w.set(w.httpArgs({ url }))) as { error: string };
    expect(result.error).toMatch(/too long/);
    expect(w.sources).toHaveLength(0);
  });

  it("an always-allow site rule does not skip the card or fetch", async () => {
    const w = await world({
      rules: [
        { effect: "always_allow", matchKind: "site", matchValue: "example.com", botId: null },
      ],
    });
    await w.set(w.httpArgs());
    expect(w.sources[0]?.status).toBe("pending");
    expect(cards).toHaveLength(1);
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("keeps approval when only the schedule changes, and asks again when the call changes", async () => {
    const w = await world();
    await w.approved();
    await w.set(w.httpArgs({ schedule: "1d" }));
    expect(w.sources[0]).toMatchObject({ status: "active", schedule: "1d" });
    expect(cards).toHaveLength(1);
    await w.set(w.httpArgs({ url: "https://api.example.com/v1/revenue?period=month" }));
    expect(w.sources[0]).toMatchObject({ status: "pending", approvedCallHash: null });
    expect(cards).toHaveLength(2);
    await w.set(
      w.httpArgs({ url: "https://api.example.com/v1/revenue?period=month", accept: "csv" }),
    );
    expect(cards).toHaveLength(3);
  });

  it("a denied call stays denied until the call changes", async () => {
    const w = await world();
    await w.set(w.httpArgs());
    expect(await w.answer("deny")).toBe("denied");
    const again = await w.set(w.httpArgs());
    expect(again).toMatchObject({ status: "denied" });
    expect(cards).toHaveLength(1);
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("hashes ignore nothing that matters", () => {
    const base = { url: URL_OK, accept: "json" as const };
    const hash = pageSourceCallHash("http", base);
    expect(hash).toBe(pageSourceCallHash("http", { accept: "json", url: URL_OK }));
    expect(hash).not.toBe(pageSourceCallHash("http", { ...base, secret: "billing" }));
    expect(hash).not.toBe(pageSourceCallHash("http", { ...base, accept: "csv" }));
  });

  it("a stale card cannot approve a newer call", async () => {
    const w = await world();
    await w.set(w.httpArgs());
    await w.set(w.httpArgs({ url: "https://api.example.com/other" }));
    expect(await w.answer("allow", "m1")).toBeNull();
    expect(w.sources[0]).toMatchObject({ status: "pending", approvedCallHash: null });
    expect(await w.answer("allow", "m2")).toMatchObject({ status: "active" });
  });
});

describe("refreshing an http source", () => {
  it("never fetches a pending source", async () => {
    const w = await world();
    await w.set(w.httpArgs());
    expect(await w.refresh()).toMatchObject({ ok: false });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("fetches an approved source once, with GET, no body and no cookies", async () => {
    const w = await world();
    await w.approved();
    const outcome = await w.refresh();
    expect(outcome).toEqual({ ok: true, value: { revenue: 5 } });
    expect(w.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = w.fetch.mock.calls[0]!;
    expect(url).toBe(URL_OK);
    expect(init).toMatchObject({ method: "GET", redirect: "manual" });
    expect(init?.body).toBeUndefined();
    expect(init?.credentials).toBeUndefined();
    const headers = new Headers(init?.headers);
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("authorization")).toBeNull();
    expect(w.snapshots).toHaveLength(1);
  });

  it("blocks a tampered call whose hash was not approved", async () => {
    const w = await world();
    await w.approved();
    w.sources[0]!.call = { ...w.sources[0]!.call, url: "https://api.example.com/other" };
    expect(await w.refresh()).toMatchObject({
      ok: false,
      error: expect.stringContaining("not approved"),
    });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("refuses at refresh when a block rule now covers the site", async () => {
    const rules: Row[] = [];
    const w = await world({ rules });
    await w.approved();
    rules.push({ effect: "block", matchKind: "site", matchValue: "example.com", botId: null });
    expect(await w.refresh()).toMatchObject({
      ok: false,
      error: expect.stringContaining("Block rule"),
    });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("does not send when the approval changes during the last checks", async () => {
    const w = await world();
    await w.approved();
    (w.prisma.actionApprovalRule.findMany as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => {
        w.sources[0]!.status = "denied";
        return [];
      },
    );
    expect(await w.refresh()).toMatchObject({ ok: false });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("treats a redirect as a failure and does not follow it", async () => {
    const w = await world();
    await w.approved();
    w.fetch.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://evil.example.net/" } }),
    );
    expect(await w.refresh()).toMatchObject({
      ok: false,
      error: "The API redirected; update the source URL.",
    });
    expect(w.fetch).toHaveBeenCalledTimes(1);
    expect(w.snapshots).toHaveLength(0);
  });

  it("fails when the address resolves privately after DNS", async () => {
    const w = await world();
    await w.approved();
    w.resolveHostname.mockResolvedValue([{ address: "10.0.0.1", family: 4 as const }]);
    expect(await w.refresh()).toMatchObject({
      ok: false,
      error: "The URL targets a private or internal host.",
    });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("stores a short status line for a non-2xx and never the body", async () => {
    const w = await world();
    await w.approved();
    w.fetch.mockResolvedValue(new Response("internal stack trace token=abc", { status: 503 }));
    const outcome = await w.refresh();
    expect(outcome).toEqual({ ok: false, error: "The API returned 503." });
    expect(w.sources[0]?.lastError).toBe("The API returned 503.");
  });

  it("logs the underlying error at warn while the owner sees fixed text", async () => {
    const { getLogger } = await import("@rakazo/logging");
    const warn = vi.spyOn(getLogger(), "warn").mockImplementation(() => undefined);
    try {
      const w = await world();
      await w.approved();
      w.fetch.mockRejectedValue(new TypeError("fetch failed", { cause: new Error("ECONNRESET") }));
      expect(await w.refresh()).toEqual({ ok: false, error: "The request failed." });
      expect(warn).toHaveBeenCalledWith(
        "page source refresh failed",
        expect.objectContaining({ cause: expect.stringContaining("ECONNRESET") }),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("refuses a body over 1 MB", async () => {
    const w = await world();
    await w.approved();
    w.fetch.mockResolvedValue(new Response("x".repeat(1_000_001)));
    expect(await w.refresh()).toEqual({ ok: false, error: "The response is larger than 1 MB." });
  });

  it("refuses a response that is not JSON", async () => {
    const w = await world();
    await w.approved();
    w.fetch.mockResolvedValue(new Response("<html>nope</html>"));
    expect(await w.refresh()).toEqual({ ok: false, error: "The response is not JSON." });
  });

  it("parses CSV into row objects", async () => {
    const w = await world();
    await w.approved({ accept: "csv" });
    w.fetch.mockResolvedValue(new Response('name,amount\r\n"Smith, J",12.5\r\nAcme,7\r\n'));
    expect(await w.refresh()).toEqual({
      ok: true,
      value: [
        { name: "Smith, J", amount: 12.5 },
        { name: "Acme", amount: 7 },
      ],
    });
    expect(new Headers(w.fetch.mock.calls[0]![1]?.headers).get("accept")).toBe("text/csv");
  });

  it("lists the host for the dialog", async () => {
    const w = await world();
    await w.set(w.httpArgs());
    const [source] = await listPageSources(w.deps.prisma, {
      spaceId: "sp",
      botId: "bot",
      pageId: "page",
    });
    expect(source).toMatchObject({
      kind: "http",
      serverName: "api.example.com",
      status: "pending",
    });
  });
});

describe("refreshing an http source with a saved key", () => {
  it("sends the key server-side with GET and redacts an echo from the snapshot", async () => {
    const w = await world();
    await w.approved({ secret: "billing" });
    w.fetch.mockImplementation(async (_url, init) => {
      expect(init?.method).toBe("GET");
      expect(init?.body).toBeUndefined();
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
      return Response.json({ revenue: 5, echo: SECRET, nested: [`Bearer ${SECRET}`] });
    });
    const outcome = await w.refresh();
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(w.snapshots)).not.toContain(SECRET);
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
    expect(w.snapshots[0]?.value).toMatchObject({ revenue: 5 });
  });

  it("fails on a redirect without following it", async () => {
    const w = await world();
    await w.approved({ secret: "billing" });
    w.fetch.mockResolvedValue(
      new Response(null, { status: 301, headers: { location: "https://evil.example.net/" } }),
    );
    expect(await w.refresh()).toEqual({
      ok: false,
      error: "The API redirected; update the source URL.",
    });
    expect(w.fetch).toHaveBeenCalledTimes(1);
  });

  it("a non-2xx error carries the status only, without body or key", async () => {
    const w = await world();
    await w.approved({ secret: "billing" });
    w.fetch.mockResolvedValue(new Response(`bad key ${SECRET}`, { status: 401 }));
    expect(await w.refresh()).toEqual({ ok: false, error: "The API returned 401." });
  });

  it("refuses at refresh if the secret was saved for another origin since", async () => {
    const w = await world();
    await w.approved({ secret: "billing" });
    const row = await w.prisma.botSecret.findFirst({ where: { name: "billing" } });
    row.origin = "https://other.example.org";
    expect(await w.refresh()).toMatchObject({
      ok: false,
      error: expect.stringContaining("different site"),
    });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("refuses a deleted secret at refresh", async () => {
    const w = await world();
    await w.approved({ secret: "billing" });
    (w.prisma.botSecret.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await w.refresh()).toMatchObject({
      ok: false,
      error: expect.stringContaining("no saved key"),
    });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("a tampered hash blocks the keyed refresh", async () => {
    const w = await world();
    await w.approved({ secret: "billing" });
    w.sources[0]!.call = { ...w.sources[0]!.call, secret: undefined };
    expect(await w.refresh()).toMatchObject({
      ok: false,
      error: expect.stringContaining("not approved"),
    });
    expect(w.fetch).not.toHaveBeenCalled();
  });
});

describe("review fixes", () => {
  const QUOTED = 'ab"cd12345';

  it("does not restore a key that CSV quote-escaping hid from the redaction", async () => {
    const w = await world({ secretValue: QUOTED });
    await w.approved({ secret: "billing", accept: "csv" });
    w.fetch.mockResolvedValue(new Response('name,note\r\nx,"ab""cd12345"\r\n'));
    const outcome = await w.refresh();
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain("cd12345");
    expect(JSON.stringify(w.snapshots)).not.toContain("cd12345");
  });

  it("does not restore a key that a JSON unicode escape hid from the redaction", async () => {
    const w = await world({ secretValue: QUOTED });
    await w.approved({ secret: "billing" });
    w.fetch.mockResolvedValue(new Response('{"note":"ab\\u0022cd12345","k":1}'));
    const outcome = await w.refresh();
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(w.snapshots)).not.toContain("cd12345");
    expect(JSON.stringify(outcome)).not.toContain("cd12345");
  });

  it("does not send when the approval is revoked while the host resolves", async () => {
    for (const secret of [undefined, "billing"]) {
      cards.length = 0;
      const w = await world();
      await w.approved(secret ? { secret } : {});
      w.resolveHostname.mockImplementation(async () => {
        w.sources[0]!.status = "denied";
        return [{ address: "203.0.113.10", family: 4 as const }];
      });
      expect(await w.refresh()).toMatchObject({ ok: false });
      expect(w.fetch).not.toHaveBeenCalled();
    }
  });

  it("resolves the host once and sends to the addresses it checked", async () => {
    for (const secret of [undefined, "billing"]) {
      cards.length = 0;
      const w = await world();
      await w.approved(secret ? { secret } : {});
      // A second answer would be a private address: DNS rebinding between check and send.
      w.resolveHostname
        .mockResolvedValueOnce([{ address: "203.0.113.10", family: 4 as const }])
        .mockResolvedValue([{ address: "10.0.0.1", family: 4 as const }]);
      expect(await w.refresh()).toEqual({ ok: true, value: { revenue: 5 } });
      expect(w.resolveHostname).toHaveBeenCalledTimes(1);
      expect(w.fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("stops a CSV whose long headers would make a huge result, without building it", () => {
    const header = Array.from(
      { length: 50 },
      (_, i) => `${String(i).padStart(3, "0")}${"h".repeat(190)}`,
    ).join(",");
    const rows = `${",".repeat(49)}\n`.repeat(5000);
    const build = vi.spyOn(Object, "fromEntries");
    try {
      expect(() => parseCsv(`${header}\n${rows}`)).toThrow("The CSV is larger than 1 MB.");
      expect(build.mock.calls.length).toBeLessThan(300);
    } finally {
      build.mockRestore();
    }
    expect(() => parseCsv(`${"h".repeat(201)}\n1\n`)).toThrow(/header/);
  });
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF, a BOM and blank lines", () => {
    const text = '﻿a,b,c\r\n1,"he said ""hi""","line1\nline2"\r\n\r\nx,,007\r\n';
    expect(parseCsv(text)).toEqual([
      { a: 1, b: 'he said "hi"', c: "line1\nline2" },
      { a: "x", b: "", c: "007" },
    ]);
  });

  it("handles a last row with no newline and short rows", () => {
    expect(parseCsv("a,b\n1,2\n3")).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: "" },
    ]);
  });

  it("enforces the row and column limits and rejects an unclosed quote", () => {
    const header = Array.from({ length: 51 }, (_, i) => `c${i}`).join(",");
    expect(() => parseCsv(`${header}\n`)).toThrow(/50 columns/);
    const rows = Array.from({ length: 5001 }, (_, i) => String(i)).join("\n");
    expect(() => parseCsv(`n\n${rows}\n`)).toThrow(/5000 rows/);
    expect(parseCsv(`n\n${Array.from({ length: 5000 }, (_, i) => i).join("\n")}`)).toHaveLength(
      5000,
    );
    expect(() => parseCsv('a\n"open')).toThrow(/quote/);
    expect(() => parseCsv("")).toThrow(/empty/);
  });
});
