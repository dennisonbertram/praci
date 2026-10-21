import type {
  CompanyImportWorkerContext,
  MailMessagePage,
  MailProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { companySourceScope, createCompanySourceWorker } from "./company-import-sources.js";

const actor = { spaceId: "source-test-space", userId: "source-test-user" };
const context = (): CompanyImportWorkerContext => ({
  actor,
  signal: AbortSignal.timeout(10_000),
  executeModelCall: vi.fn(),
});

function summary(
  id: string,
  extra: Partial<MailMessagePage["messages"][number]> = {},
): MailMessagePage["messages"][number] {
  return {
    id,
    threadId: `thread-${id}`,
    date: "2026-01-04T12:00:00.000Z",
    from: { address: "sender@example.test" },
    to: [{ address: "owner@example.test" }],
    cc: [],
    subject: `Subject ${id}`,
    snippet: `Snippet ${id}`,
    unread: false,
    labelIds: ["INBOX"],
    ...extra,
  };
}

function prisma(overrides: Record<string, unknown> = {}) {
  return {
    dataRoomItem: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
    companyEvidence: { findMany: vi.fn(async () => []) },
    connection: {
      findFirst: vi.fn(async () => ({
        id: "connection-1",
        connectorId: "emulator",
        provider: "gmail",
        providerRef: "mailbox-1",
        displayName: "Test mailbox",
        spaceId: actor.spaceId,
        userId: actor.userId,
      })),
    },
    dataRoomItemText: { findFirst: vi.fn(async () => null) },
    cachedMailMessage: { findFirst: vi.fn(async () => null) },
    mailSenderDecision: { findFirst: vi.fn(async () => null) },
    inboxSenderFeedback: { findFirst: vi.fn(async () => null) },
    ...overrides,
  } as unknown as PrismaClient;
}

describe("company source worker", () => {
  it("captures the Gmail default window once and preserves explicit scopes", () => {
    expect(companySourceScope("gmail", {}, new Date("2026-03-31T23:59:00Z"))).toEqual({
      after: "2023-03-31",
    });
    expect(
      companySourceScope(
        "gmail",
        { after: "2020-01-02", before: "2021-01-02" },
        new Date("2026-03-31"),
      ),
    ).toEqual({ after: "2020-01-02", before: "2021-01-02" });
    expect(companySourceScope("gmail", { allTime: true }, new Date("2026-03-31"))).toEqual({
      allTime: true,
    });
  });

  it("scopes data-room discovery to the owner and de-duplicates selected IDs", async () => {
    const findMany = vi.fn(async () => [{ id: "item-1" }]);
    const worker = createCompanySourceWorker({
      prisma: prisma({ dataRoomItem: { findMany, findFirst: vi.fn() } }),
      extractor: {} as never,
    });
    const page = await worker.discover(
      {
        source: {
          id: "source-1",
          sourceKind: "data_room",
          connectionId: "connection-1",
          scope: { itemIds: ["item-1", "item-1"], folderIds: ["folder-1", "folder-1"] },
        },
        cursor: null,
        maxUnits: 10,
      },
      context(),
    );
    expect(page.units).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              spaceId: actor.spaceId,
              userId: actor.userId,
              sourceConnectionId: "connection-1",
              id: { in: ["item-1"] },
              folderId: { in: ["folder-1"] },
            },
          ],
        },
      }),
    );
  });

  it("scopes data-room text reads to the selected space and owner", async () => {
    const itemFindFirst = vi.fn(async () => ({
      id: "item-1",
      name: "brief.txt",
      docType: null,
      docDate: null,
      parties: [],
      summary: null,
      sourceUrl: null,
      status: "ready",
    }));
    const textFindFirst = vi.fn(async () => ({ text: "Scoped source text." }));
    const relevant = vi.fn(async () => false);
    const worker = createCompanySourceWorker({
      prisma: prisma({
        dataRoomItem: { findMany: vi.fn(), findFirst: itemFindFirst },
        dataRoomItemText: { findFirst: textFindFirst },
      }),
      extractor: { relevant, extract: vi.fn() },
    });

    await worker.read(
      {
        source: {
          id: "source-1",
          sourceKind: "data_room",
          connectionId: null,
          scope: { itemIds: ["item-1"] },
        },
        unitKey: "data_room:item-1",
        cursor: { itemId: "item-1" },
        maxBytes: 1_000,
      },
      context(),
    );

    expect(textFindFirst).toHaveBeenCalledWith({
      where: {
        itemId: "item-1",
        spaceId: actor.spaceId,
        userId: actor.userId,
      },
      select: { text: true },
    });
    expect(relevant).toHaveBeenCalledWith(
      { title: "brief.txt", text: expect.stringContaining("Scoped source text.") },
      expect.anything(),
    );
  });

  it("continues a partially hydrated Gmail page using only IDs and page tokens", async () => {
    const listMessages = vi
      .fn<MailProvider["listMessages"]>()
      .mockResolvedValueOnce({
        messages: [summary("m-1")],
        unhydratedIds: ["m-2"],
        nextPageToken: "page-2",
      })
      .mockResolvedValueOnce({ messages: [summary("m-2")] })
      .mockResolvedValueOnce({ messages: [] });
    const worker = createCompanySourceWorker({
      prisma: prisma(),
      mail: { listMessages, getMessage: vi.fn() } as unknown as MailProvider,
      extractor: {} as never,
    });
    const source = {
      id: "source-1",
      sourceKind: "gmail",
      connectionId: "connection-1",
      scope: { after: "2023-01-01", labelIds: ["INBOX"] },
    };
    const first = await worker.discover({ source, cursor: null, maxUnits: 10 }, context());
    expect(first.units).toHaveLength(1);
    expect(first.nextCursor).toEqual({ pendingIds: ["m-2"], nextPageToken: "page-2" });
    const second = await worker.discover(
      { source, cursor: first.nextCursor, maxUnits: 10 },
      context(),
    );
    expect(second.units).toHaveLength(1);
    expect(second.done).toBe(false);
    const third = await worker.discover(
      { source, cursor: second.nextCursor, maxUnits: 10 },
      context(),
    );
    expect(third.units).toHaveLength(0);
    expect(third.done).toBe(true);
    expect(listMessages.mock.calls.map(([, request]) => request)).toEqual([
      expect.objectContaining({
        query: "after:1672531199",
        labelIds: ["INBOX"],
        useCache: false,
      }),
      expect.objectContaining({ ids: ["m-2"], useCache: false }),
      expect.objectContaining({ pageToken: "page-2", useCache: false }),
    ]);
  });

  it("looks up only the selected connected Gmail account without enumerating accounts", async () => {
    const findFirst = vi.fn(async () => ({
      id: "connection-1",
      connectorId: "emulator",
      provider: "gmail",
      providerRef: "mailbox-1",
      displayName: "Test mailbox",
      spaceId: actor.spaceId,
      userId: actor.userId,
    }));
    const listAccounts = vi.fn();
    const listMessages = vi.fn(async () => ({ messages: [] }));
    const worker = createCompanySourceWorker({
      prisma: prisma({ connection: { findFirst } }),
      mail: {
        listAccounts,
        listMessages,
        getMessage: vi.fn(),
      } as unknown as MailProvider,
      extractor: {} as never,
    });

    await worker.discover(
      {
        source: {
          id: "source-1",
          sourceKind: "gmail",
          connectionId: "connection-1",
          scope: { allTime: true, labelIds: ["INBOX"] },
        },
        cursor: null,
        maxUnits: 10,
      },
      context(),
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "connection-1",
        spaceId: actor.spaceId,
        userId: actor.userId,
        status: "connected",
      },
      select: {
        id: true,
        connectorId: true,
        provider: true,
        providerRef: true,
        displayName: true,
        spaceId: true,
        userId: true,
      },
    });
    expect(listAccounts).not.toHaveBeenCalled();
    expect(listMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "connection-1",
        accountRef: "mailbox-1",
        address: null,
      }),
      expect.objectContaining({ labelIds: ["INBOX"], useCache: false }),
      expect.anything(),
    );
  });

  it("skips newsletter, bulk, notification, spam, and sender-noise before model access", async () => {
    const cases = [
      { category: "newsletter" },
      { category: "bulk" },
      { category: "notification" },
      { category: "spam" },
      { labels: ["SPAM"] },
      { labels: ["CATEGORY_UPDATES"] },
      { signals: { bulk: true } },
      { signals: { autoSubmitted: true } },
      { skipSender: true },
    ] as const;
    for (const input of cases) {
      const relevant = vi.fn(async () => true);
      const getMessage = vi.fn();
      const worker = createCompanySourceWorker({
        prisma: prisma({
          cachedMailMessage: {
            findFirst: vi.fn(async () =>
              "category" in input ? { category: input.category, pile: null } : null,
            ),
          },
          mailSenderDecision: {
            findFirst: vi.fn(async () =>
              "skipSender" in input && input.skipSender ? { id: "rule" } : null,
            ),
          },
        }),
        mail: {
          listMessages: vi.fn(async () => ({
            messages: [
              summary("noise", {
                labelIds: "labels" in input ? [...input.labels] : ["INBOX"],
                signals: {
                  listUnsubscribe: [],
                  oneClick: false,
                  listId: null,
                  bulk: "signals" in input && "bulk" in input.signals,
                  autoSubmitted: "signals" in input && "autoSubmitted" in input.signals,
                  auth: { dkim: null, spf: null, dmarc: null },
                  dkimCoversUnsubscribe: false,
                  categories: {
                    spam: false,
                    promotions: false,
                    social: false,
                    updates: false,
                    forums: false,
                    important: false,
                  },
                },
              }),
            ],
          })),
          getMessage,
        } as unknown as MailProvider,
        extractor: { relevant, extract: vi.fn() },
      });
      await worker.read(
        {
          source: {
            id: "source-1",
            sourceKind: "gmail",
            connectionId: "connection-1",
            scope: { allTime: true },
          },
          unitKey: "gmail:noise",
          cursor: { itemId: "noise" },
          maxBytes: 10_000,
        },
        context(),
      );
      expect(getMessage).not.toHaveBeenCalled();
      expect(relevant).not.toHaveBeenCalled();
    }
  });
});
