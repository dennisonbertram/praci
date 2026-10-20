import type {
  AdapterContext,
  ConnectorProxyRequest,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { type EmulatedMessage, GmailApiEmulator } from "./gmail-api-emulator.js";
import { GmailMailProvider } from "./gmail-mail-provider.js";

const account: MailAccount = {
  id: "conn-1",
  connectorId: "test",
  app: "gmail",
  accountRef: "acct",
  label: "Test",
  spaceId: "space-1",
  userId: "user-1",
  address: "me@example.test",
};
const context: AdapterContext = {
  operationId: "op",
  traceId: "op",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};

const newsletter: EmulatedMessage = {
  id: "n1",
  date: "2026-10-01T10:00:00Z",
  labels: ["INBOX", "CATEGORY_PROMOTIONS"],
  from: "News <news@news.example.test>",
  to: "me@example.test",
  subject: "Weekly",
  headers: [
    {
      name: "List-Unsubscribe",
      value: "<https://news.example.test/u/abc>, <mailto:u@news.example.test>",
    },
    { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    { name: "List-Id", value: "Weekly <weekly.news.example.test>" },
    { name: "Precedence", value: "bulk" },
    {
      name: "Authentication-Results",
      value: "mx.google.com; dkim=pass header.i=@news.example.test; spf=pass; dmarc=pass",
    },
    { name: "DKIM-Signature", value: "v=1; d=other.example.test; h=from; b=1" },
    {
      name: "DKIM-Signature",
      value: "v=1; d=news.example.test; h=from:list-unsubscribe:list-unsubscribe-post; b=2",
    },
  ],
};
const spam: EmulatedMessage = {
  id: "s1",
  date: "2026-10-01T09:00:00Z",
  labels: ["SPAM"],
  from: "Prize <win@prize.example.test>",
  to: "me@example.test",
  subject: "You won",
};

function setup(cache?: {
  findMany: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
}) {
  const gmail = new GmailApiEmulator({
    mailboxes: { acct: { address: "me@example.test", messages: [newsletter, spam] } },
  });
  const requests: string[] = [];
  const connector = {
    proxy: async (request: ConnectorProxyRequest) => {
      requests.push(request.url);
      return gmail.handle(request.accountRef, request.url);
    },
  } as unknown as ManagedConnectorProvider;
  const provider = new GmailMailProvider({
    ...(cache ? { prisma: { connection: {}, cachedMailMessage: cache } as never } : {}),
    connectors: { managed: () => connector },
  });
  return { provider, requests };
}

describe("GmailMailProvider signals", () => {
  it("requests every signal header in metadataHeaders and returns parsed signals", async () => {
    const { provider, requests } = setup();
    const page = await provider.listMessages(
      account,
      { query: "", pageSize: 10, ids: ["n1"], useCache: false },
      context,
    );
    const url = requests.find((r) => r.includes("/messages/n1")) as string;
    for (const name of [
      "List-Unsubscribe",
      "List-Unsubscribe-Post",
      "List-Id",
      "Precedence",
      "Auto-Submitted",
      "Authentication-Results",
      "DKIM-Signature",
    ])
      expect(url).toContain(`metadataHeaders=${name}`);
    expect(page.messages[0]?.signals).toEqual({
      listUnsubscribe: ["https://news.example.test/u/abc", "mailto:u@news.example.test"],
      oneClick: true,
      listId: "Weekly <weekly.news.example.test>",
      bulk: true,
      autoSubmitted: false,
      auth: { dkim: "pass", spf: "pass", dmarc: "pass" },
      // Only the second DKIM-Signature covers both headers, so the repeated header must survive.
      dkimCoversUnsubscribe: true,
      categories: {
        spam: false,
        promotions: true,
        social: false,
        updates: false,
        forums: false,
        important: false,
      },
    });
  });

  it("sets categories.spam for a SPAM-labelled message", async () => {
    const { provider } = setup();
    const page = await provider.listMessages(
      account,
      { query: "", pageSize: 10, ids: ["s1"], useCache: false },
      context,
    );
    expect(page.messages[0]?.signals?.categories.spam).toBe(true);
    expect(page.messages[0]?.signals?.listUnsubscribe).toEqual([]);
  });

  it("getMessage returns the same signals", async () => {
    const { provider } = setup();
    const page = await provider.listMessages(
      account,
      { query: "", pageSize: 10, ids: ["n1"], useCache: false },
      context,
    );
    const opened = await provider.getMessage(account, "n1", context);
    expect(opened.signals).toEqual(page.messages[0]?.signals);
  });

  it("a cached search hit has no signals and carries SPAM in labelIds when isSpam", async () => {
    const cache = {
      findMany: vi.fn().mockResolvedValue([
        {
          providerMessageId: "s1",
          threadId: "s1",
          receivedAt: new Date("2026-10-01T09:00:00Z"),
          fromName: null,
          fromAddress: "win@prize.example.test",
          toAddresses: ["me@example.test"],
          ccAddresses: [],
          subject: "You won",
          snippet: "",
          unread: false,
          inInbox: false,
          fromSelf: false,
          isSpam: true,
        },
      ]),
      createMany: vi.fn(),
    };
    const { provider } = setup(cache);
    const page = await provider.listMessages(
      account,
      { query: "", pageSize: 10, ids: ["s1"] },
      context,
    );
    expect(page.messages[0]?.labelIds).toEqual(["SPAM"]);
    expect(page.messages[0]?.signals).toBeUndefined();
  });

  it("writes signals and the spam flag with a search-only row", async () => {
    const cache = { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() };
    const { provider } = setup(cache);
    await provider.listMessages(account, { query: "", pageSize: 10, ids: ["s1"] }, context);
    const row = cache.createMany.mock.calls[0]?.[0].data[0];
    expect(row).toMatchObject({
      providerMessageId: "s1",
      inInbox: false,
      isSpam: true,
      signalsVersion: 1,
    });
    expect(row.signals.categories.spam).toBe(true);
  });
});
