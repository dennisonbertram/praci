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
    proxy: async (request: { accountRef: string; url: string }) =>
      gmail.handle(request.accountRef, request.url),
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

  it("keeps the mail tools only when mail is enabled", () => {
    expect(selectMailTools(tools, true).map((tool) => tool.name)).toEqual([
      "web_search",
      "mail_search",
      "mail_grep",
      "mail_get",
    ]);
    expect(selectMailTools(tools, false).map((tool) => tool.name)).toEqual(["web_search"]);
    expect([...MAIL_TOOL_NAMES].sort()).toEqual(["mail_get", "mail_grep", "mail_search"]);
  });
});

describe("mailToolsAllowed", () => {
  const owner = {
    hasProvider: true,
    groupId: null,
    runUserId: "user-1",
    botUserId: "user-1",
    messagingChannelRun: false,
  };

  it("allows the bot owner in a direct thread", () => {
    expect(mailToolsAllowed(owner)).toBe(true);
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
    { ...base, id: "m1", date: "2026-01-05T10:00:00Z", subject: "Friday", text: quoted },
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
