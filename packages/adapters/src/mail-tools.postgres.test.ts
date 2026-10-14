import { randomUUID } from "node:crypto";
import {
  type AdapterContext,
  type JobPublisher,
  type MailAccount,
  type MailProvider,
  MailProviderError,
  type ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { grepRows, type MailResultRow } from "@rakazo/core";
import { createDb, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type EmulatedMessage, GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import {
  deleteMailSearches,
  expireMailSearch,
  type MailToolDeps,
  mailToolFromTool,
} from "./mail-tools.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

const NO_SEARCH = { error: "No such search results" };
const base = { labels: ["INBOX"], to: "Me <me@example.test>" };

function message(id: string, date: string, extra: Partial<EmulatedMessage> = {}): EmulatedMessage {
  return {
    ...base,
    id,
    date,
    from: "Jana <jana@example.test>",
    subject: `Subject ${id}`,
    ...extra,
  };
}

function idsOf(result: unknown): string[] {
  const { matches } = result as { matches: { text: string }[] };
  return matches.map((match) => /id:([^ ]+) /.exec(match.text)?.[1] ?? "?");
}

describePostgres("mail tools (PostgreSQL + Gmail emulator)", () => {
  let db: ReturnType<typeof createDb>;
  let prisma: PrismaClient;
  const tenants: string[] = [];

  beforeAll(() => {
    db = createDb(process.env.DATABASE_URL!);
    prisma = db.prisma;
  });
  afterAll(async () => {
    if (!db) return;
    await prisma.mailSearch.deleteMany({ where: { spaceId: { in: tenants } } });
    await prisma.bot.deleteMany({ where: { spaceId: { in: tenants } } });
    await prisma.space.deleteMany({ where: { id: { in: tenants } } });
    await prisma.organization.deleteMany({ where: { id: { in: tenants } } });
    await prisma.user.deleteMany({ where: { id: { in: tenants } } });
    await prisma.$disconnect();
    await db.pool.end();
  });

  async function tenant() {
    const id = randomUUID();
    tenants.push(id);
    await prisma.user.create({
      data: { id, name: "Mail test", email: `${id}@example.test`, emailVerified: true },
    });
    await prisma.organization.create({
      data: { id, name: "Mail test", slug: id, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id, organizationId: id, name: "Mail test", isDefault: true },
    });
    const bot = await prisma.bot.create({
      data: { spaceId: id, userId: id, name: "Mail test", color: "test-color" },
    });
    return { spaceId: id, userId: id, botId: bot.id };
  }

  /** A tenant whose bot owns the given Gmail emulator mailboxes. */
  async function harness(
    boxes: Record<string, EmulatedMessage[]>,
    options: {
      sleep?: () => Promise<void>;
      wrap?: (provider: MailProvider) => MailProvider;
      deadlineMs?: number;
    } = {},
  ) {
    const scope = await tenant();
    const gmail = new GmailApiEmulator({
      now: new Date("2026-10-01T12:00:00Z"),
      mailboxes: Object.fromEntries(
        Object.entries(boxes).map(([ref, messages]) => [
          ref,
          { address: `${ref}@example.test`, messages },
        ]),
      ),
    });
    const connector = {
      proxy: async (request: { accountRef: string; url: string }) =>
        gmail.handle(request.accountRef, request.url),
    } as unknown as ManagedConnectorProvider;
    const provider = createMailProvider({
      prisma: {} as never,
      connectors: { managed: () => connector },
      sleep: options.sleep ?? (async () => undefined),
      random: () => 0,
    });
    const accounts: MailAccount[] = Object.keys(boxes).map((ref) => ({
      id: `conn-${ref}-${scope.botId}`,
      connectorId: "test",
      app: "gmail",
      accountRef: ref,
      label: ref,
      spaceId: scope.spaceId,
      userId: scope.userId,
      address: `${ref}@example.test`,
    }));
    const enqueue = vi.fn(async () => undefined);
    const jobs: JobPublisher = {
      enqueue,
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const deps: MailToolDeps = {
      mail: options.wrap ? options.wrap(provider) : provider,
      prisma,
      jobs,
      accounts: async () => accounts,
      scope,
      ...(options.deadlineMs ? { deadlineMs: options.deadlineMs } : {}),
    };
    const context = (signal = new AbortController().signal): AdapterContext => ({
      operationId: "op",
      traceId: "trace",
      spaceId: scope.spaceId,
      userId: scope.userId,
      botId: scope.botId,
      signal,
    });
    const call = (name: string, args: Record<string, unknown>, signal?: AbortSignal, as = deps) =>
      mailToolFromTool(name, as, context(signal), args) as Promise<Record<string, any>>;
    const everything = async (searchId: string) =>
      idsOf(await call("mail_grep", { searchId, maxResults: 200 }));
    return { scope, gmail, deps, call, everything, enqueue, accounts, context };
  }

  it("saves matches from two accounts oldest-first, deduplicated, with a matching summary", async () => {
    const t = await harness({
      a: [
        message("a1", "2026-03-01T00:00:00Z", { subject: "hello one" }),
        message("a2", "2026-01-01T00:00:00Z", { subject: "hello two" }),
        message("a3", "2026-02-01T00:00:00Z", { subject: "other" }),
      ],
      b: [message("b1", "2025-12-01T00:00:00Z", { subject: "hello three" })],
    });
    const result = await t.call("mail_search", { queries: ["from:jana", "hello", "from:jana"] });

    expect(result.searchId).toEqual(expect.any(String));
    // a1 and a2 match both queries but are saved once.
    expect(result.records).toBe(4);
    expect(result.accounts).toEqual(["a@example.test", "b@example.test"]);
    expect(result.dateRange).toEqual({
      oldest: "2025-12-01T00:00:00.000Z",
      newest: "2026-03-01T00:00:00.000Z",
    });
    expect(result.byYear).toEqual({ "2025": 1, "2026": 3 });
    expect(result.coverage).toBe("complete");
    expect(result.coveredBackTo).toBeUndefined();
    expect(result.perQuery).toHaveLength(4);
    expect(result.firstRecords[0]).toMatch(
      /^0001 \| 2025-12-01T00:00:00\.000Z \| acct:b@example\.test \| id:b1 /,
    );
    expect(await t.everything(result.searchId)).toEqual(["b1", "a2", "a3", "a1"]);

    const stored = await prisma.mailSearch.findUniqueOrThrow({ where: { id: result.searchId } });
    expect(stored).toMatchObject({ ...t.scope, resume: null });
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBeGreaterThan(
      23.9 * 3_600_000,
    );
    expect(t.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "mail.search.expire",
        payload: { searchId: result.searchId },
        replaceKey: `mail.search.expire:${result.searchId}`,
        availableAt: stored.expiresAt,
      }),
    );
  });

  const tied: EmulatedMessage[] = [
    message("m01", "2026-01-04T10:00:00Z"),
    message("m02", "2026-01-04T10:00:00Z"),
    message("m03", "2026-01-03T10:00:00Z"),
    message("m04", "2026-01-03T10:00:00Z"),
    message("m05", "2026-01-03T10:00:00Z"),
    message("m06", "2026-01-03T10:00:00Z"),
    message("m07", "2026-01-02T10:00:00Z"),
    message("m08", "2026-01-01T10:00:00Z"),
    message("m09", "2026-01-01T10:00:00Z"),
  ];

  it("continues a capped search with exactly the older rows, including ones sharing the cut-off day", async () => {
    const t = await harness({ a: tied });
    const whole = await t.call("mail_search", { queries: ["jana"] });
    expect(whole.coverage).toBe("complete");
    const all = await t.everything(whole.searchId);
    expect(all).toHaveLength(9);

    const first = await t.call("mail_search", { queries: ["jana"], maxMessages: 4 });
    expect(first.coverage).toBe("capped");
    expect(first.records).toBe(4);
    expect(first.perQuery[0]).toMatchObject({
      complete: false,
      hasMore: true,
      stoppedReason: "cap",
    });
    // Gmail lists newest first, so the saved rows are the newest ones.
    expect(first.coveredBackTo).toBe("2026-01-03T10:00:00.000Z");
    const stored = await prisma.mailSearch.findUniqueOrThrow({ where: { id: first.searchId } });
    expect(stored.resume).toEqual([
      expect.objectContaining({ accountId: expect.any(String), query: "jana", pageToken: "4" }),
    ]);

    const second = await t.call("mail_search", { continueFrom: first.searchId, maxMessages: 4 });
    expect(second.records).toBe(4);
    expect(second.coverage).toBe("capped");
    const third = await t.call("mail_search", { continueFrom: second.searchId, maxMessages: 4 });
    expect(third.records).toBe(1);
    expect(third.coverage).toBe("complete");

    const pieces = [
      ...(await t.everything(first.searchId)),
      ...(await t.everything(second.searchId)),
      ...(await t.everything(third.searchId)),
    ];
    expect(pieces).toHaveLength(9);
    expect([...pieces].sort()).toEqual([...all].sort());
  });

  it("splits maxMessages across accounts", async () => {
    const t = await harness({
      a: [1, 2, 3, 4].map((n) => message(`a${n}`, `2026-01-0${n}T00:00:00Z`)),
      b: [1, 2, 3, 4].map((n) => message(`b${n}`, `2026-02-0${n}T00:00:00Z`)),
    });
    const result = await t.call("mail_search", { queries: ["jana"], maxMessages: 4 });
    expect(result.records).toBe(4);
    expect(result.coverage).toBe("capped");
    const ids = await t.everything(result.searchId);
    expect(ids.filter((id) => id.startsWith("a"))).toHaveLength(2);
    expect(ids.filter((id) => id.startsWith("b"))).toHaveLength(2);
  });

  it("keeps hydrated rows when the deadline hits mid-page and fetches the rest on continueFrom", async () => {
    const abort = new AbortController();
    const t = await harness(
      { a: tied },
      {
        // The first backoff wait is where the run's deadline lands.
        sleep: async () => {
          abort.abort();
        },
      },
    );
    t.gmail.failNext(429, { urlIncludes: "/messages/", skip: 3, times: 1000 });
    const first = await t.call("mail_search", { queries: ["jana"] }, abort.signal);
    expect(first.coverage).toBe("capped");
    expect(first.records).toBeGreaterThanOrEqual(1);
    expect(first.records).toBeLessThan(9);
    expect(first.perQuery[0]).toMatchObject({ complete: false, stoppedReason: "deadline" });
    const stored = await prisma.mailSearch.findUniqueOrThrow({ where: { id: first.searchId } });
    const [entry] = stored.resume as { unhydratedIds: string[] }[];
    expect(entry?.unhydratedIds.length).toBe(9 - first.records);

    t.gmail.clearFailures();
    const rest = await t.call("mail_search", { continueFrom: first.searchId });
    expect(rest.coverage).toBe("complete");
    const pieces = [
      ...(await t.everything(first.searchId)),
      ...(await t.everything(rest.searchId)),
    ];
    expect([...pieces].sort()).toEqual(tied.map((m) => m.id).sort());
  });

  it("reports a failed account without failing the call", async () => {
    const t = await harness(
      {
        a: [message("a1", "2026-01-01T00:00:00Z")],
        b: [message("b1", "2026-01-02T00:00:00Z")],
      },
      {
        wrap: (provider) => ({
          listAccounts: provider.listAccounts.bind(provider),
          getMessage: provider.getMessage.bind(provider),
          getAttachment: provider.getAttachment.bind(provider),
          createDraft: provider.createDraft.bind(provider),
          updateDraft: provider.updateDraft.bind(provider),
          sendDraft: provider.sendDraft.bind(provider),
          deleteDraft: provider.deleteDraft.bind(provider),
          listMessages: async (account, request, context) => {
            if (account.accountRef === "b")
              throw new MailProviderError("unavailable", "Mail provider returned 500");
            return provider.listMessages(account, request, context);
          },
        }),
      },
    );
    const result = await t.call("mail_search", { queries: ["jana"] });
    expect(result.records).toBe(1);
    expect(result.coverage).toBe("capped");
    expect(result.failedAccounts).toEqual(["b@example.test"]);
    expect(result.perQuery).toContainEqual(
      expect.objectContaining({ account: "b@example.test", q: "jana", stoppedReason: "error" }),
    );
    expect(await t.everything(result.searchId)).toEqual(["a1"]);
  });

  it("records a rejected page token as an error and drops it from the next resume", async () => {
    const t = await harness({ a: tied });
    const first = await t.call("mail_search", { queries: ["jana"], maxMessages: 4 });
    await prisma.mailSearch.update({
      where: { id: first.searchId },
      data: {
        resume: [
          { accountId: t.accounts[0]?.id, query: "jana", unhydratedIds: [], pageToken: "bogus" },
        ],
      },
    });
    const second = await t.call("mail_search", { continueFrom: first.searchId });
    expect(second.records).toBe(0);
    expect(second.coverage).toBe("capped");
    expect(second.perQuery[0]).toMatchObject({ stoppedReason: "error" });
    expect(second.failedAccounts).toEqual(["a@example.test"]);
    const stored = await prisma.mailSearch.findUniqueOrThrow({ where: { id: second.searchId } });
    expect(stored.resume).toBeNull();
    expect(await t.call("mail_search", { continueFrom: second.searchId })).toEqual({
      error: "That search has nothing left to continue",
    });
  });

  it("saves nothing for an unknown account", async () => {
    const t = await harness({ a: tied });
    expect(await t.call("mail_search", { queries: ["jana"], account: "zed@example.test" })).toEqual(
      { error: "No connected mail account zed@example.test" },
    );
    expect(await prisma.mailSearch.count({ where: { spaceId: t.scope.spaceId } })).toBe(0);
  });

  it("answers 'No such search results' for any other scope, on grep and continueFrom", async () => {
    const t = await harness({ a: tied });
    const saved = await t.call("mail_search", { queries: ["jana"], maxMessages: 3 });
    const otherBot = await prisma.bot.create({
      data: { spaceId: t.scope.spaceId, userId: t.scope.userId, name: "Other", color: "c" },
    });
    const other = await tenant();
    const scopes = [
      { ...t.scope, userId: `${t.scope.userId}-other` },
      { ...t.scope, botId: otherBot.id },
      { ...t.scope, spaceId: other.spaceId },
    ];
    for (const scope of scopes) {
      const as = { ...t.deps, scope };
      const asContext: AdapterContext = {
        operationId: "op",
        traceId: "t",
        spaceId: scope.spaceId,
        userId: scope.userId,
        botId: scope.botId,
        signal: new AbortController().signal,
      };
      expect(
        await mailToolFromTool("mail_grep", as, asContext, { searchId: saved.searchId }),
      ).toEqual(NO_SEARCH);
      expect(
        await mailToolFromTool("mail_search", as, asContext, { continueFrom: saved.searchId }),
      ).toEqual(NO_SEARCH);
    }
    expect(await t.call("mail_grep", { searchId: "does-not-exist" })).toEqual(NO_SEARCH);
    expect(await t.call("mail_grep", { searchId: saved.searchId })).toMatchObject({
      totalMatches: 3,
    });
  });

  it("refuses expired results, expires them by job, and deletes one user's searches in one space", async () => {
    const t = await harness({ a: tied });
    const expired = await t.call("mail_search", { queries: ["jana"] });
    const kept = await t.call("mail_search", { queries: ["jana"] });
    await prisma.mailSearch.update({
      where: { id: expired.searchId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await t.call("mail_grep", { searchId: expired.searchId })).toEqual({
      error: "Results expired; run mail_search again.",
    });
    expect(await t.call("mail_search", { continueFrom: expired.searchId })).toEqual({
      error: "Results expired; run mail_search again.",
    });

    await expireMailSearch(prisma, expired.searchId);
    expect(await prisma.mailSearch.count({ where: { id: expired.searchId } })).toBe(0);
    expect(await prisma.mailSearchRow.count({ where: { searchId: expired.searchId } })).toBe(0);
    expect(await prisma.mailSearch.count({ where: { id: kept.searchId } })).toBe(1);

    const other = await harness({ a: tied });
    const bystander = await other.call("mail_search", { queries: ["jana"] });
    // Same user id in a different space, and a different user in this space, must survive.
    const sameUserElsewhere = await prisma.mailSearch.create({
      data: {
        spaceId: other.scope.spaceId,
        userId: t.scope.userId,
        botId: other.scope.botId,
        summary: {},
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const otherUserHere = await prisma.mailSearch.create({
      data: {
        spaceId: t.scope.spaceId,
        userId: other.scope.userId,
        botId: t.scope.botId,
        summary: {},
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(await deleteMailSearches(prisma, t.scope)).toBe(1);
    expect(await prisma.mailSearch.count({ where: { id: kept.searchId } })).toBe(0);
    expect(await prisma.mailSearchRow.count({ where: { searchId: kept.searchId } })).toBe(0);
    expect(await prisma.mailSearch.count({ where: { id: bystander.searchId } })).toBe(1);
    expect(await prisma.mailSearch.count({ where: { id: sameUserElsewhere.id } })).toBe(1);
    expect(await prisma.mailSearch.count({ where: { id: otherUserHere.id } })).toBe(1);
  });

  it("matches the pure grep through the SQL pre-filter and 500-row batches", async () => {
    const t = await harness({ a: [] });
    const rows: MailResultRow[] = Array.from({ length: 1230 }, (_, index) => {
      const line = index + 1;
      const date = new Date(Date.UTC(2015, 0, 1) + index * 3 * 86_400_000).toISOString();
      const word = ["invoice", "Jana", "school", "(a+)+$", "100% off_1", "100% offX1", "plain"][
        index % 7
      ];
      return {
        line,
        date,
        text: `${String(line).padStart(4, "0")} | ${date} | acct:a@example.test | id:x${line} | subject:${word} ${line}`,
      };
    });
    const search = await prisma.mailSearch.create({
      data: {
        ...t.scope,
        summary: {},
        expiresAt: new Date(Date.now() + 3_600_000),
        rows: { createMany: { data: rows } },
      },
    });
    const cases: Record<string, unknown>[] = [
      { patterns: ["invoice"] },
      { patterns: ["JANA", "school"], maxResults: 7, contextLines: 2 },
      { patterns: ["100% off_1"], dateFrom: "2016", dateTo: "2017-06" },
      { patterns: ["(a+)+$"] },
      { patterns: ["inv.ice", "sch[o]{2}l"], contextLines: 1 },
      { patterns: ["subject:plain"], afterLine: 600, maxResults: 200 },
      { dateFrom: "2018-06", dateTo: "2018-06-15", maxResults: 200 },
      { patterns: ["no such text"] },
      {},
    ];
    for (const options of cases) {
      const expected = grepRows(rows, { searchId: search.id, ...options });
      const actual = await t.call("mail_grep", { searchId: search.id, ...options });
      expect(actual).toEqual(expected);
    }
    // Sanity: the cases above exercise real matches, not only empty results.
    expect(
      (await t.call("mail_grep", { searchId: search.id, patterns: ["invoice"] })).totalMatches,
    ).toBe(176);
  });
  it("show_emails resolves only the caller's cached rows on accounts that are still connected", async () => {
    const mine = await harness({ a: [] });
    const other = await tenant();
    const connect = (scope: { spaceId: string; userId: string }, ref: string, status: string) =>
      prisma.connection.create({
        data: {
          spaceId: scope.spaceId,
          userId: scope.userId,
          connectorId: "composio",
          provider: "gmail",
          providerRef: ref,
          displayName: ref,
          status,
        },
      });
    const live = await connect(mine.scope, "live", "connected");
    const revoked = await connect(mine.scope, "revoked", "revoked");
    const theirs = await connect(other, "theirs", "connected");
    const cached = (
      scope: { spaceId: string; userId: string },
      connectionId: string,
      providerMessageId: string,
      subject: string,
    ) => ({
      spaceId: scope.spaceId,
      userId: scope.userId,
      connectionId,
      providerMessageId,
      threadId: providerMessageId,
      fromAddress: "sender@example.test",
      subject,
      snippet: "",
      receivedAt: new Date("2026-10-01T12:00:00Z"),
      unread: false,
      seenAt: new Date(),
    });
    await prisma.cachedMailMessage.createMany({
      data: [
        cached(mine.scope, live.id, "shared", "Mine"),
        cached(mine.scope, revoked.id, "revoked-only", "On a revoked account"),
        cached(other, theirs.id, "shared", "Theirs"),
        cached(other, theirs.id, "theirs-only", "Theirs only"),
      ],
    });
    const published: unknown[] = [];
    const deps: MailToolDeps = {
      ...mine.deps,
      // Only the live account is connected; attachment lookups fail and are skipped.
      accounts: async () => [{ ...mine.accounts[0]!, id: live.id }],
      mail: {
        getMessage: async () => {
          throw new MailProviderError("not_found", "gone");
        },
      } as unknown as MailProvider,
      publish: async (blocks) => void published.push(...blocks),
    };

    const result = await mailToolFromTool("show_emails", deps, mine.context(), {
      emails: [{ id: "shared" }, { id: "revoked-only" }, { id: "theirs-only" }],
    });

    expect(result).toEqual({ shown: 1, notFound: ["revoked-only", "theirs-only"] });
    expect(published).toHaveLength(1);
    const [block] = published as Array<{ emails: Array<{ id: string; subject: string }> }>;
    expect(block?.emails.map((email) => email.subject)).toEqual(["Mine"]);
    const row = await prisma.cachedMailMessage.findFirstOrThrow({
      where: { connectionId: live.id, providerMessageId: "shared" },
    });
    expect(block?.emails[0]?.id).toBe(row.id);
  });
});
