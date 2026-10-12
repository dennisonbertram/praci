import type {
  AdapterContext,
  ConnectorProxyRequest,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { GmailMailProvider } from "./gmail-mail-provider.js";

const account: MailAccount = {
  id: "conn-1",
  connectorId: "test",
  app: "gmail",
  accountRef: "acct",
  label: "Test",
  spaceId: "space-1",
  userId: "user-1",
  address: null,
};
const context: AdapterContext = {
  operationId: "op",
  traceId: "op",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};

function setup(cache: {
  findMany: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
}) {
  const gmail = new GmailApiEmulator({
    mailboxes: {
      acct: {
        address: "me@example.test",
        messages: [
          {
            id: "m1",
            date: "2026-10-01T10:00:00Z",
            labels: ["INBOX"],
            from: "A <a@example.test>",
            to: "me@example.test",
            subject: "One",
          },
          {
            id: "m2",
            date: "2026-10-01T09:00:00Z",
            labels: ["INBOX"],
            from: "B <b@example.test>",
            to: "me@example.test",
            subject: "Two",
          },
        ],
      },
    },
  });
  const connector = {
    proxy: async (request: ConnectorProxyRequest) => gmail.handle(request.accountRef, request.url),
  } as unknown as ManagedConnectorProvider;
  const provider = new GmailMailProvider({
    prisma: { connection: {}, cachedMailMessage: cache } as never,
    connectors: { managed: () => connector },
  });
  return { gmail, provider };
}

describe("GmailMailProvider metadata cache", () => {
  it("looks ids up only within the account's connection, space and user", async () => {
    const cache = { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() };
    const { provider } = setup(cache);

    await provider.listMessages(account, { query: "", pageSize: 10 }, context);

    expect(cache.findMany.mock.calls[0]?.[0].where).toMatchObject({
      connectionId: "conn-1",
      spaceId: "space-1",
      userId: "user-1",
      providerMessageId: { in: ["m1", "m2"] },
    });
  });

  it("stores newly hydrated messages as search-only rows owned by the account", async () => {
    const cache = { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() };
    const { provider } = setup(cache);

    await provider.listMessages(account, { query: "", pageSize: 10 }, context);

    const call = cache.createMany.mock.calls[0]?.[0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toHaveLength(2);
    expect(call.data[0]).toMatchObject({
      spaceId: "space-1",
      userId: "user-1",
      connectionId: "conn-1",
      providerMessageId: "m1",
      inInbox: false,
    });
  });

  it("still returns the search results when the cache cannot be read or written", async () => {
    const cache = {
      findMany: vi.fn().mockRejectedValue(new Error("db down")),
      createMany: vi.fn().mockRejectedValue(new Error("db down")),
    };
    const { provider, gmail } = setup(cache);

    const page = await provider.listMessages(account, { query: "", pageSize: 10 }, context);

    expect(page.messages.map((m) => m.subject)).toEqual(["One", "Two"]);
    expect(gmail.requests.filter((r) => /messages\/m\d/.test(r.url))).toHaveLength(2);
  });

  it("does not touch the cache when useCache is false", async () => {
    const cache = { findMany: vi.fn(), createMany: vi.fn() };
    const { provider } = setup(cache);

    await provider.listMessages(account, { query: "", pageSize: 10, useCache: false }, context);

    expect(cache.findMany).not.toHaveBeenCalled();
    expect(cache.createMany).not.toHaveBeenCalled();
  });
});
