import type {
  AdapterContext,
  ConnectorTool,
  JobPublisher,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { type EmulatedMessage, GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import {
  MAIL_TOOL_NAMES,
  type MailToolDeps,
  mailToolFromTool,
  mailToolsAllowed,
  selectMailTools,
} from "./mail-tools.js";

const scope = { spaceId: "space-1", userId: "user-1", botId: "bot-1" };

function account(ref: string, address: string): MailAccount {
  return {
    id: `conn-${ref}`,
    connectorId: "test",
    app: "gmail",
    accountRef: ref,
    label: ref,
    spaceId: scope.spaceId,
    userId: scope.userId,
    address,
  };
}

function context(): AdapterContext {
  return {
    operationId: "op",
    traceId: "trace",
    ...scope,
    signal: new AbortController().signal,
  };
}

function setup(
  boxes: Record<string, EmulatedMessage[]>,
  options: { prisma?: unknown } = {},
): { deps: MailToolDeps; gmail: GmailApiEmulator } {
  const mailboxes = Object.fromEntries(
    Object.entries(boxes).map(([ref, messages]) => [
      ref,
      { address: `${ref}@example.test`, messages },
    ]),
  );
  const gmail = new GmailApiEmulator({ now: new Date("2026-10-01T12:00:00Z"), mailboxes });
  const connector = {
    proxy: async (request: {
      accountRef: string;
      url: string;
      method: "GET" | "POST" | "PUT" | "DELETE";
      body?: unknown;
    }) => gmail.handle(request.accountRef, request.url, request.method, request.body),
  } as unknown as ManagedConnectorProvider;
  const mail = createMailProvider({
    prisma: {} as never,
    connectors: { managed: () => connector },
    sleep: async () => undefined,
    random: () => 0,
  });
  const accounts = Object.keys(boxes).map((ref) => account(ref, `${ref}@example.test`));
  const jobs: JobPublisher = {
    enqueue: vi.fn(async () => undefined),
    cancel: async () => undefined,
    close: async () => undefined,
  };
  // The prisma stub throws on any use, so a test that passes proves nothing was saved.
  const prisma = (options.prisma ??
    new Proxy(
      {},
      {
        get() {
          throw new Error("database must not be used");
        },
      },
    )) as PrismaClient;
  return { deps: { mail, prisma, jobs, accounts: async () => accounts, scope }, gmail };
}

const base = {
  labels: ["INBOX"],
  from: "Jana <jana@example.test>",
  to: "Me <me@example.test>",
};

describe("selectMailTools", () => {
  const tools = ["web_search", "mail_search", "mail_grep", "mail_get"].map((name) => ({
    name,
  })) as ConnectorTool[];

  it("drops inbox_overview with the other mail tools when mail is not enabled", () => {
    const withOverview = [{ name: "web_search" }, { name: "inbox_overview" }] as ConnectorTool[];
    expect(selectMailTools(withOverview, false).map((tool) => tool.name)).toEqual(["web_search"]);
    expect(selectMailTools(withOverview, true)).toHaveLength(2);
  });

  it("keeps the mail tools only when mail is enabled", () => {
    expect(selectMailTools(tools, true).map((tool) => tool.name)).toEqual([
      "web_search",
      "mail_search",
      "mail_grep",
      "mail_get",
    ]);
    expect(selectMailTools(tools, false).map((tool) => tool.name)).toEqual(["web_search"]);
    expect([...MAIL_TOOL_NAMES].sort()).toEqual([
      "inbox_overview",
      "mail_draft",
      "mail_get",
      "mail_grep",
      "mail_modify",
      "mail_search",
      "mail_send",
      "show_emails",
    ]);
  });
});

describe("mailToolsAllowed", () => {
  const owner = {
    hasProvider: true,
    groupId: null,
    runUserId: "user-1",
    botUserId: "user-1",
    messagingChannelRun: false,
    trigger: "user",
  };

  it("allows the bot owner in a direct thread", () => {
    expect(mailToolsAllowed(owner)).toBe(true);
  });

  it.each(["user", "follow_up", "routine"])("allows an owner-started %s run", (trigger) => {
    expect(mailToolsAllowed({ ...owner, trigger })).toBe(true);
  });

  it("refuses a bot_message run, which another agent (even from another account) started", () => {
    expect(mailToolsAllowed({ ...owner, trigger: "bot_message" })).toBe(false);
  });

  it.each([
    ["no mail provider is configured", { hasProvider: false }],
    ["the thread is a group", { groupId: "group-1" }],
    ["someone other than the bot owner started the run", { runUserId: "user-2" }],
    ["the run answers a messaging channel", { messagingChannelRun: true }],
  ])("refuses when %s", (_label, change) => {
    expect(mailToolsAllowed({ ...owner, ...change })).toBe(false);
  });
});

describe("mail_search arguments", () => {
  it("requires exactly one of queries and continueFrom", async () => {
    const { deps } = setup({ a: [] });
    const ctx = context();
    expect(await mailToolFromTool("mail_search", deps, ctx, {})).toEqual({
      error: "Pass queries or continueFrom",
    });
    expect(
      await mailToolFromTool("mail_search", deps, ctx, { queries: ["x"], continueFrom: "s1" }),
    ).toEqual({ error: "Pass queries or continueFrom" });
  });

  it("rejects an unknown account before anything is saved", async () => {
    const { deps } = setup({
      a: [{ ...base, id: "m1", date: "2026-01-01T00:00:00Z", subject: "Hi" }],
    });
    expect(
      await mailToolFromTool("mail_search", deps, context(), {
        queries: ["hi"],
        account: "nobody@example.test",
      }),
    ).toEqual({ error: "No connected mail account nobody@example.test" });
  });
});

describe("mail_get", () => {
  const quoted = [
    "Thanks, see you Friday.",
    "",
    "On Mon, 5 Jan 2026 at 10:00, Jana <jana@example.test> wrote:",
    "> Are we still on for Friday?",
  ].join("\n");
  const messages: EmulatedMessage[] = [
    {
      ...base,
      id: "m1",
      date: "2026-01-05T10:00:00Z",
      subject: "Friday",
      text: quoted,
      cc: "Lee <lee@example.test>",
    },
    {
      ...base,
      id: "m2",
      date: "2026-01-06T10:00:00Z",
      subject: "Long",
      text: `${"x".repeat(200)}   \n\n`,
    },
  ];

  it("returns the header block and strips the quoted reply", async () => {
    const { deps } = setup({ a: messages });
    const result = (await mailToolFromTool("mail_get", deps, context(), { id: "m1" })) as {
      text: string;
    };
    expect(result.text).toContain("Message ID: m1\n");
    expect(result.text).toContain("Subject: Friday\n");
    expect(result.text).toContain("From: Jana <jana@example.test>\n");
    // A reply all can keep everyone the message was copied to.
    expect(result.text).toContain("Cc: Lee <lee@example.test>\n");
    expect(result.text).toContain("Body:\nThanks, see you Friday.");
    expect(result.text).not.toContain("Are we still on for Friday");
  });

  it("cuts the body to maxChars, clamped to its limits", async () => {
    const { deps } = setup({ a: messages });
    const body = async (maxChars: number) => {
      const result = (await mailToolFromTool("mail_get", deps, context(), {
        id: "m2",
        maxChars,
      })) as { text: string };
      return result.text.split("Body:\n")[1] ?? "";
    };
    expect(await body(120)).toHaveLength(120);
    expect(await body(5)).toHaveLength(100);
    expect(await body(1_000_000)).toHaveLength(200);
  });

  it("requires an account when two are connected and finds the message in the named one", async () => {
    const { deps } = setup({
      a: messages,
      b: [{ ...base, id: "m3", date: "2026-02-01T00:00:00Z", subject: "Other", text: "Hello b" }],
    });
    expect(await mailToolFromTool("mail_get", deps, context(), { id: "m3" })).toEqual({
      error:
        "Pass account (the address from the row's acct: field) when more than one mail account is connected",
    });
    const result = (await mailToolFromTool("mail_get", deps, context(), {
      id: "m3",
      account: "B@example.test",
    })) as { text: string };
    expect(result.text).toContain("Hello b");
    expect(
      await mailToolFromTool("mail_get", deps, context(), { id: "m3", account: "c@example.test" }),
    ).toEqual({ error: "No connected mail account c@example.test" });
  });

  it("reports a missing message as an error object", async () => {
    const { deps } = setup({ a: messages });
    expect(await mailToolFromTool("mail_get", deps, context(), { id: "nope" })).toEqual({
      error: "Message not found",
    });
  });
});

describe("show_emails", () => {
  const messages: EmulatedMessage[] = [
    { ...base, id: "m1", date: "2026-10-01T10:00:00Z", subject: "Plain", text: "Hello" },
    {
      ...base,
      id: "m2",
      date: "2026-10-02T10:00:00Z",
      subject: "With files",
      text: "See attached",
      attachments: [
        { filename: "a.pdf", mimeType: "application/pdf", size: 10 },
        { filename: "b.pdf", mimeType: "application/pdf", size: 20 },
      ],
    },
  ];
  const cached = (id: string, extra: Record<string, unknown> = {}) => ({
    id: `row-${id}`,
    connectionId: "conn-a",
    providerMessageId: id,
    fromName: "Jana",
    fromAddress: "jana@example.test",
    subject: `Cached ${id}`,
    snippet: `snippet ${id}`,
    receivedAt: new Date("2026-10-02T10:00:00Z"),
    priority: null,
    dueOn: null,
    ...extra,
  });
  function withRows(rows: Array<ReturnType<typeof cached>>) {
    const findMany = vi.fn(async () => rows);
    const publish = vi.fn(async () => undefined);
    const { deps } = setup({ a: messages }, { prisma: { cachedMailMessage: { findMany } } });
    return { deps: { ...deps, publish }, findMany, publish };
  }

  it("publishes an emails block built from the owner's cached rows, with attachment counts", async () => {
    const { deps, findMany, publish } = withRows([cached("m1"), cached("m2")]);
    const result = await mailToolFromTool("show_emails", deps, context(), {
      emails: [
        { id: "m1", urgency: "today" },
        { id: "m2", urgency: "later" },
      ],
    });
    expect(result).toEqual({ shown: 2 });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith([
      {
        kind: "emails",
        emails: [
          {
            id: "row-m1",
            urgency: "today",
            from: "Jana",
            subject: "Cached m1",
            snippet: "snippet m1",
            receivedAt: "2026-10-02T10:00:00.000Z",
            attachments: 0,
          },
          {
            id: "row-m2",
            urgency: "later",
            from: "Jana",
            subject: "Cached m2",
            snippet: "snippet m2",
            receivedAt: "2026-10-02T10:00:00.000Z",
            attachments: 2,
          },
        ],
      },
    ]);
    // Only this user's rows in this space, on accounts the user still has connected.
    expect(findMany).toHaveBeenCalledWith({
      where: {
        spaceId: scope.spaceId,
        userId: scope.userId,
        connectionId: { in: ["conn-a"] },
        providerMessageId: { in: ["m1", "m2"] },
      },
    });
  });

  it("falls back to the triage urgency, then Later, when the model gives none", async () => {
    const { deps, publish } = withRows([cached("m1", { priority: "critical" }), cached("m2")]);
    await mailToolFromTool("show_emails", deps, context(), {
      emails: [{ id: "m1" }, { id: "m2", urgency: "not-a-real-urgency" }],
    });
    const [[blocks]] = publish.mock.calls as unknown as [
      [Array<{ emails: Array<{ urgency: string }> }>],
    ];
    expect(blocks?.[0]?.emails.map((email) => email.urgency)).toEqual(["today", "later"]);
  });

  it("reports ids it cannot show and publishes nothing when none resolve", async () => {
    const { deps, publish } = withRows([cached("m1")]);
    expect(
      await mailToolFromTool("show_emails", deps, context(), {
        emails: [{ id: "m1" }, { id: "gone" }],
      }),
    ).toEqual({ shown: 1, notFound: ["gone"] });
    publish.mockClear();
    const none = withRows([]);
    const result = await mailToolFromTool("show_emails", none.deps, context(), {
      emails: [{ id: "gone" }],
    });
    expect(result).toEqual({
      error: "None of those messages are in the synced mail. Run mail_search first.",
    });
    expect(none.publish).not.toHaveBeenCalled();
  });

  it("keeps the card when the attachment lookup fails", async () => {
    const { deps, publish } = withRows([cached("m3")]);
    await mailToolFromTool("show_emails", deps, context(), { emails: [{ id: "m3" }] });
    const [[blocks]] = publish.mock.calls as unknown as [
      [Array<{ emails: Array<Record<string, unknown>> }>],
    ];
    expect(blocks?.[0]?.emails[0]).not.toHaveProperty("attachments");
  });

  it("limits a call to the card maximum and requires a list of ids", async () => {
    const { deps, findMany } = withRows([]);
    expect(await mailToolFromTool("show_emails", deps, context(), {})).toEqual({
      error: "emails is required",
    });
    await mailToolFromTool("show_emails", deps, context(), {
      emails: Array.from({ length: 50 }, (_, i) => ({ id: `m${i}` })),
    });
    const where = (
      findMany.mock.calls[0] as unknown as [{ where: { providerMessageId: { in: string[] } } }]
    )[0].where;
    expect(where.providerMessageId.in).toHaveLength(20);
  });
});

describe("mail write tools", () => {
  const inbox: EmulatedMessage[] = [
    {
      ...base,
      id: "m1",
      threadId: "t1",
      labels: ["INBOX", "UNREAD"],
      date: "2026-10-01T10:00:00Z",
      subject: "One",
    },
    {
      ...base,
      id: "m2",
      threadId: "t1",
      labels: ["INBOX", "UNREAD"],
      date: "2026-10-02T10:00:00Z",
      subject: "Two",
    },
    {
      ...base,
      id: "m3",
      threadId: "t2",
      labels: ["INBOX", "UNREAD"],
      date: "2026-10-03T10:00:00Z",
      subject: "Other",
    },
  ];
  type Row = {
    id: string;
    spaceId: string;
    userId: string;
    connectionId: string;
    providerMessageId: string;
    threadId: string;
    unread: boolean;
    inInbox: boolean;
  };

  /** A cache holding the three messages above; the stub answers only the queries the tools make. */
  function withCache(options: { writesDisabled?: boolean; extra?: EmulatedMessage[] } = {}) {
    const rows: Row[] = inbox.map((m) => ({
      id: `row-${m.id}`,
      spaceId: scope.spaceId,
      userId: scope.userId,
      connectionId: "conn-a",
      providerMessageId: m.id,
      threadId: m.threadId as string,
      unread: true,
      inInbox: true,
    }));
    const matches = (row: Row, where: Partial<Row>) =>
      Object.entries(where).every(([key, value]) => row[key as keyof Row] === value);
    const prisma = {
      cachedMailMessage: {
        findFirst: async ({ where }: { where: Partial<Row> }) =>
          rows.find((r) => matches(r, where)) ?? null,
        findMany: async ({ where }: { where: Partial<Row> }) =>
          rows.filter((r) => matches(r, where)),
        updateMany: async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
          for (const row of rows) if (matches(row, where)) Object.assign(row, data);
          return { count: 0 };
        },
      },
    };
    const { deps, gmail } = setup({ a: [...inbox, ...(options.extra ?? [])] }, { prisma });
    return { deps: { ...deps, writesDisabled: options.writesDisabled }, gmail, rows };
  }
  const labelsOf = async (deps: MailToolDeps, id: string) =>
    (await deps.mail.getMessage((await deps.accounts())[0] as MailAccount, id, context())).labelIds;
  const run = (deps: MailToolDeps, name: string, args: Record<string, unknown>) =>
    mailToolFromTool(name, deps, context(), args);

  it("saves a draft, never sends it, and replaces it when given its id", async () => {
    const { deps, gmail } = withCache();
    const created = (await run(deps, "mail_draft", {
      to: ["Jana <jana@example.test>"],
      subject: "Friday",
      body: "See you then.",
      replyToId: "m1",
    })) as { draftId: string };
    expect(created.draftId).toBeTruthy();
    expect(gmail.draftsOf("a")).toHaveLength(1);
    expect(gmail.draftsOf("a")[0]?.raw).toContain("Subject: Friday");

    await run(deps, "mail_draft", {
      draftId: created.draftId,
      to: ["jana@example.test"],
      subject: "Saturday",
      body: "Changed.",
    });
    expect(gmail.draftsOf("a")).toHaveLength(1);
    expect(gmail.draftsOf("a")[0]?.raw).toContain("Subject: Saturday");
    expect(gmail.sentOf("a")).toHaveLength(0);
  });

  it("reports a bad recipient or a missing draft instead of saving", async () => {
    const { deps, gmail } = withCache();
    const bad = { to: ["not an address"], subject: "x", body: "y" };
    expect(await run(deps, "mail_draft", bad)).toHaveProperty("error");
    const gone = { draftId: "gone", to: [], subject: "x", body: "y" };
    expect(await run(deps, "mail_draft", gone)).toHaveProperty("error");
    expect(gmail.draftsOf("a")).toHaveLength(0);
  });

  it("marks a conversation read and archives it, in Gmail and in the cache", async () => {
    const { deps, rows } = withCache();
    expect(await run(deps, "mail_modify", { id: "m1", read: true, archive: true })).toEqual({
      ok: true,
      messages: 2,
    });
    for (const id of ["m1", "m2"]) expect(await labelsOf(deps, id)).toEqual([]);
    expect(await labelsOf(deps, "m3")).toEqual(["INBOX", "UNREAD"]);
    expect(rows.map((r) => [r.unread, r.inInbox])).toEqual([
      [false, false],
      [false, false],
      [true, true],
    ]);
  });

  it("also changes older messages of the conversation that are not cached", async () => {
    const older = {
      ...base,
      id: "m0",
      threadId: "t1",
      labels: ["INBOX", "UNREAD"],
      date: "2026-09-01T10:00:00Z",
      subject: "Older",
    };
    const { deps } = withCache({ extra: [older] });
    await run(deps, "mail_modify", { id: "m1", read: true, archive: true });
    expect(await labelsOf(deps, "m0")).toEqual([]);
  });

  it("marks one message unread and resolves a label name to its id", async () => {
    const { deps, rows } = withCache();
    await run(deps, "mail_modify", { id: "m1", read: true });
    await run(deps, "mail_modify", { id: "m2", read: false, addLabels: ["receipts"] });
    expect((await labelsOf(deps, "m2")).sort()).toEqual(["INBOX", "Label_1", "UNREAD"]);
    expect(await labelsOf(deps, "m1")).toEqual(["INBOX"]);
    expect(rows.map((r) => r.unread)).toEqual([false, true, true]);
  });

  it("refuses unknown labels and labels that delete or send", async () => {
    const { deps } = withCache();
    for (const label of ["Nope", "TRASH", "SPAM", "DRAFT", "SENT"]) {
      expect(await run(deps, "mail_modify", { id: "m1", addLabels: [label] })).toHaveProperty(
        "error",
      );
    }
    expect(await run(deps, "mail_modify", { id: "m1" })).toHaveProperty("error");
    expect(await labelsOf(deps, "m1")).toEqual(["INBOX", "UNREAD"]);
  });

  it("changes nothing when mail writes are turned off", async () => {
    const { deps, gmail, rows } = withCache({ writesDisabled: true });
    const off = { error: "Changing mail is turned off." };
    const draft = { to: ["jana@example.test"], subject: "x", body: "y" };
    expect(await run(deps, "mail_draft", draft)).toEqual(off);
    expect(await run(deps, "mail_modify", { id: "m1", read: true })).toEqual(off);
    expect(gmail.draftsOf("a")).toHaveLength(0);
    expect(await labelsOf(deps, "m1")).toEqual(["INBOX", "UNREAD"]);
    expect(rows.every((r) => r.unread)).toBe(true);
  });

  /** An in-memory ComposeSend table with the calls mail_send makes. */
  function withSends(options: { writesDisabled?: boolean } = {}) {
    type Send = {
      id: string;
      clientId: string;
      connectionId: string;
      draftId: string | null;
      state: string;
    };
    const sends: Send[] = [];
    const sync: unknown[] = [];
    const resyncs: unknown[] = [];
    const prisma = {
      composeSend: {
        upsert: async ({ create }: { create: { clientId: string; connectionId: string } }) => {
          let row = sends.find((r) => r.clientId === create.clientId);
          if (!row) {
            row = { id: `s${sends.length}`, draftId: null, state: "draft", ...create };
            sends.push(row);
          }
          return { ...row };
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; state: { in: string[] } };
          data: Partial<Send>;
        }) => {
          const row = sends.find((r) => r.id === where.id && where.state.in.includes(r.state));
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Send> }) =>
          Object.assign(sends.find((r) => r.id === where.id) as Send, data),
      },
      mailSyncState: {
        upsert: async (arg: unknown) => sync.push(arg),
        updateMany: async (arg: unknown) => {
          resyncs.push(arg);
          return { count: 1 };
        },
      },
    };
    const { deps, gmail } = setup({ a: inbox }, { prisma });
    return {
      deps: { ...deps, writesDisabled: options.writesDisabled, idempotencyKey: "call-1" },
      gmail,
      sends,
      sync,
      resyncs,
    };
  }
  const message = { to: ["Jana <jana@example.test>"], subject: "Friday", body: "See you then." };

  it("sends a new message and a saved draft", async () => {
    const { deps, gmail } = withSends();
    expect(await run(deps, "mail_send", message)).toMatchObject({ ok: true, subject: "Friday" });
    expect(gmail.sentOf("a")).toHaveLength(1);
    expect(gmail.sentOf("a")[0]?.raw).toContain("Subject: Friday");

    const { draftId } = (await run(deps, "mail_draft", { ...message, subject: "Draft" })) as {
      draftId: string;
    };
    const second = { ...deps, idempotencyKey: "call-2" };
    expect(await run(second, "mail_send", { draftId })).toMatchObject({ ok: true });
    expect(gmail.sentOf("a")).toHaveLength(2);
    expect(gmail.draftsOf("a")).toHaveLength(0);
  });

  it("syncs the account again after a send, skipping the throttle, so the Inbox shows the reply", async () => {
    const { deps, resyncs } = withSends();
    expect(await run(deps, "mail_send", message)).toMatchObject({ ok: true });
    expect(resyncs).toEqual([{ where: { connectionId: "conn-a" }, data: { lastSyncedAt: null } }]);
  });

  it("sends once when the same tool call runs twice", async () => {
    const { deps, gmail } = withSends();
    await run(deps, "mail_send", message);
    expect(await run(deps, "mail_send", message)).toEqual({ ok: true, alreadySent: true });
    expect(gmail.sentOf("a")).toHaveLength(1);
  });

  it("never repeats a send whose outcome is unclear", async () => {
    const { deps, gmail, sends } = withSends();
    gmail.failNext(500, { urlIncludes: "drafts/send", times: 5 });
    const first = await run(deps, "mail_send", message);
    expect(first).toHaveProperty("error", expect.stringContaining("Sent"));
    expect(sends[0]?.state).toBe("unknown");
    gmail.clearFailures();
    expect(await run(deps, "mail_send", message)).toHaveProperty("error");
    expect(gmail.sentOf("a")).toHaveLength(0);
  });

  it("flags a reconnect when Gmail refuses the account", async () => {
    const { deps, gmail, sends, sync } = withSends();
    gmail.failNext(401, { urlIncludes: "drafts" });
    expect(await run(deps, "mail_send", message)).toHaveProperty(
      "error",
      expect.stringContaining("reconnected"),
    );
    expect(sends[0]?.state).toBe("failed");
    expect(sync).toHaveLength(1);
    expect(sync[0]).toMatchObject({
      create: { lastErrorKind: "auth" },
      update: { lastErrorKind: "auth" },
    });
  });

  it("rejects a bad recipient before any state changes, and sends nothing when writes are off", async () => {
    const { deps, gmail, sends } = withSends();
    expect(await run(deps, "mail_send", { ...message, to: ["nope"] })).toHaveProperty("error");
    expect(await run(deps, "mail_send", { ...message, to: [] })).toHaveProperty("error");
    expect(sends).toHaveLength(0);
    const off = withSends({ writesDisabled: true });
    expect(await run(off.deps, "mail_send", message)).toEqual({
      error: "Changing mail is turned off.",
    });
    expect(off.gmail.sentOf("a")).toHaveLength(0);
    expect(gmail.sentOf("a")).toHaveLength(0);
  });
});
