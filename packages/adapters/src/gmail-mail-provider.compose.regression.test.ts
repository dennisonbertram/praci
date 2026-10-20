import type {
  AdapterContext,
  ConnectorProxyRequest,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { parseRawMime } from "./mime-parse.js";

const owner = { spaceId: "space-1", userId: "user-1" };
const account: MailAccount = {
  id: "conn-1",
  connectorId: "emulator",
  app: "gmail",
  accountRef: "box",
  label: "Box",
  ...owner,
  address: "me@example.test",
};
const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  signal: new AbortController().signal,
  ...owner,
};
const draft = {
  to: [{ address: "priya@example.test" }],
  cc: [],
  bcc: [],
  subject: "Hello",
  text: "Hi",
};

function setup(messages: object[] = []) {
  const gmail = new GmailApiEmulator({
    mailboxes: {
      box: {
        address: "me@example.test",
        messages: messages as never,
      },
    },
  });
  const sleeps: number[] = [];
  const calls: ConnectorProxyRequest[] = [];
  const connector = {
    proxy: async (request: ConnectorProxyRequest) => {
      calls.push(request);
      return gmail.handle(request.accountRef, request.url, request.method, request.body);
    },
  } as unknown as ManagedConnectorProvider;
  const provider = createMailProvider({
    prisma: {
      connection: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
    } as unknown as Pick<PrismaClient, "connection">,
    connectors: { managed: () => connector },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0,
  });
  return { gmail, provider, calls, sleeps };
}

const original = (extra: Record<string, unknown> = {}) => ({
  id: "m-1",
  threadId: "t-1",
  date: "2026-10-01T10:00:00.000Z",
  labels: ["INBOX"],
  from: "Priya <priya@example.test>",
  to: "me@example.test",
  subject: "Plans",
  text: "Hello",
  ...extra,
});

const kindOf = async (run: Promise<unknown>) => {
  try {
    await run;
  } catch (error) {
    if (error instanceof MailProviderError) return error.kind;
    throw error;
  }
  return "ok";
};

describe("GmailMailProvider drafts regressions", () => {
  it("still threads a reply by thread id when the original's Message-ID is not a usable id", async () => {
    const { provider, gmail } = setup([
      original({ messageId: "<no-at-sign>", references: "garbage" }),
    ]);
    const created = await provider.createDraft(account, { ...draft, inReplyTo: "m-1" }, context);
    expect(created.threadId).toBe("t-1");
    const mime = parseRawMime(gmail.draftsOf("box")[0]?.raw ?? "");
    expect(mime.header("In-Reply-To")).toBeUndefined();
    expect(mime.header("References")).toBeUndefined();
  });

  it("keeps the original's References in order and adds its own id last", async () => {
    const { provider, gmail } = setup([
      original({ references: "<r1@x.test> <r2@x.test>", messageId: "<m1@x.test>" }),
    ]);
    await provider.createDraft(account, { ...draft, inReplyTo: "m-1" }, context);
    const mime = parseRawMime(gmail.draftsOf("box")[0]?.raw ?? "");
    expect(mime.header("In-Reply-To")).toBe("<m1@x.test>");
    expect(mime.header("References")).toBe("<r1@x.test> <r2@x.test> <m1@x.test>");
  });

  it("gives up on a send after the rate limit keeps answering, reporting that nothing was sent", async () => {
    const { provider, gmail, sleeps } = setup();
    const created = await provider.createDraft(account, draft, context);
    gmail.failNext(429, { urlIncludes: "drafts/send", times: 10 });
    expect(await kindOf(provider.sendDraft(account, created.draftId, context))).toBe(
      "rate_limited",
    );
    expect(sleeps).toHaveLength(2);
    expect(gmail.sentOf("box")).toHaveLength(0);
    expect(gmail.draftsOf("box")).toHaveLength(1);
  });

  it("treats a forbidden answer on a send as unclear, because it cannot prove nothing was sent", async () => {
    const { provider, gmail } = setup();
    const created = await provider.createDraft(account, draft, context);
    gmail.failNext(403, { urlIncludes: "drafts/send", reason: "forbidden" });
    expect(await kindOf(provider.sendDraft(account, created.draftId, context))).toBe("unknown");
  });

  it("does not let a failed read of the original leave a half-made draft", async () => {
    const { provider, gmail } = setup([original()]);
    gmail.failNext(404, { urlIncludes: "/messages/" });
    expect(
      await kindOf(provider.createDraft(account, { ...draft, inReplyTo: "m-1" }, context)),
    ).toBe("not_found");
    expect(gmail.draftsOf("box")).toHaveLength(0);
  });

  it("reads the Reply-To header of an opened message, and none when it is absent", async () => {
    const { provider } = setup([
      original({ replyTo: "Team <team@example.test>" }),
      original({ id: "m-2", threadId: "t-2" }),
    ]);
    expect((await provider.getMessage(account, "m-1", context)).replyTo).toEqual([
      { name: "Team", address: "team@example.test" },
    ]);
    expect((await provider.getMessage(account, "m-2", context)).replyTo).toEqual([]);
  });

  it("refuses to write through a connector that cannot proxy", async () => {
    const provider = createMailProvider({
      prisma: {
        connection: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
      } as unknown as Pick<PrismaClient, "connection">,
      connectors: { managed: () => ({}) as ManagedConnectorProvider },
    });
    expect(await kindOf(provider.createDraft(account, draft, context))).toBe("unavailable");
  });
});
