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

function mailProvider(overrides: Record<string, unknown> = {}): MailProvider {
  return {
    getCursor: vi.fn(async () => "baseline"),
    listChanges: vi.fn(async () => null),
    listMessages: vi.fn(async () => ({ messages: [] })),
    getMessage: vi.fn(async () => {
      throw new Error("Unexpected message hydration");
    }),
    ...overrides,
  } as unknown as MailProvider;
}

function prisma(overrides: Record<string, unknown> = {}) {
  return {
    dataRoomItem: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
    companySourceBlock: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
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
      companySourceScope("gmail", { before: "2020-01-02" }, new Date("2026-03-31T23:59:00Z")),
    ).toEqual({ before: "2020-01-02" });
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

  it("uses bounded Gmail history deltas and exposes manual-only provider reasons", async () => {
    const source = {
      id: "gmail-refresh",
      sourceKind: "gmail",
      connectionId: "connection-1",
      scope: { allTime: true, labelIds: ["INBOX"] },
    };
    const mail = mailProvider({
      getCursor: vi.fn(async () => "baseline"),
      listChanges: vi.fn(async () => ({
        cursor: "next",
        changedIds: ["new-message", "changed-message"],
        deletedIds: ["deleted-message"],
      })),
      listMessages: vi.fn(async (_account: unknown, { ids }: { ids?: string[] }) => ({
        messages: (ids ?? []).map((id) => summary(id)),
      })),
      getMessage: vi.fn(async (_account: unknown, id: string) => ({
        id,
        threadId: `thread-${id}`,
        subject: `Subject ${id}`,
        from: { address: "sender@example.test" },
        text: "A relevant update.",
        truncated: false,
      })),
    });
    const extract = vi.fn(async () => ({
      extraction: { entities: [], edges: [], events: [] },
      model: { provider: "synthetic", model: "refresh-test" },
    }));
    const worker = createCompanySourceWorker({
      prisma: prisma(),
      mail,
      extractor: {
        relevant: vi.fn(async () => true),
        extract,
      },
    });
    const begin = await worker.beginRefresh?.(
      { source, mode: "full", checkpoint: null },
      context(),
    );
    expect(begin?.baselineCheckpoint).toBe("baseline");
    const page = await worker.discover(
      {
        source,
        cursor: null,
        maxUnits: 1,
        refresh: { checkpoint: { cursor: "baseline" } },
      },
      context(),
    );

    expect(page.units).toEqual([
      { unitKey: expect.stringContaining("gmail:"), cursor: { itemId: "new-message" } },
    ]);
    expect(page.nextCursor).toEqual({
      refreshIds: ["new-message", "changed-message"],
      refreshOffset: 1,
      refreshCursor: "next",
    });
    expect(page.proposedCheckpoint).toEqual({ kind: "gmail_history", cursor: "next" });
    expect(mail.listMessages).not.toHaveBeenCalled();
    const read = await worker.read(
      {
        source,
        unitKey: "gmail:changed",
        cursor: { itemId: "changed-message" },
        maxBytes: 10_000,
      },
      context(),
    );
    expect(mail.listMessages).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ids: ["changed-message"], useCache: false }),
      expect.anything(),
    );
    expect(mail.getMessage).toHaveBeenCalledWith(
      expect.anything(),
      "changed-message",
      expect.anything(),
    );
    expect(extract).toHaveBeenCalledWith(
      expect.objectContaining({ text: "A relevant update." }),
      expect.anything(),
    );
    expect(read.extractions).toHaveLength(1);

    expect(
      worker.refreshCapability?.({
        id: "notion",
        sourceKind: "notion",
        connectionId: "notion-connection",
        scope: {},
      }),
    ).toEqual({
      kind: "manual_only",
      reason:
        "notion_search_non_exhaustive_and_not_immediately_indexed_no_reliable_nested_change_feed",
    });
    for (const sourceKind of ["slack", "github", "linear", "mcp", "composio"]) {
      expect(
        worker.refreshCapability?.({
          id: sourceKind,
          sourceKind,
          connectionId: "connection-1",
          scope: {},
        }).kind,
      ).toBe("manual_only");
    }
  });

  it("rejects an oversized Gmail refresh cursor before returning units", async () => {
    const changedIds = Array.from(
      { length: 2_000 },
      (_, index) => `${String(index).padStart(4, "0")}-${"x".repeat(295)}`,
    );
    const worker = createCompanySourceWorker({
      prisma: prisma(),
      mail: mailProvider({
        listChanges: vi.fn(async () => ({
          cursor: "oversized-next",
          changedIds,
          deletedIds: [],
        })),
      }),
      extractor: { relevant: vi.fn(), extract: vi.fn() },
    });
    await expect(
      worker.discover(
        {
          source: {
            id: "gmail-refresh",
            sourceKind: "gmail",
            connectionId: "connection-1",
            scope: { allTime: true },
          },
          cursor: null,
          maxUnits: 1,
          refresh: { checkpoint: { cursor: "baseline" } },
        },
        context(),
      ),
    ).rejects.toMatchObject({ code: "refresh_change_limit_exceeded" });
  });

  it("does not replace an expired Gmail history cursor with a full scan", async () => {
    const worker = createCompanySourceWorker({
      prisma: prisma(),
      mail: mailProvider({
        getCursor: vi.fn(async () => "baseline"),
        listChanges: vi.fn(async () => null),
      }),
      extractor: { relevant: vi.fn(), extract: vi.fn() },
    });
    await expect(
      worker.discover(
        {
          source: {
            id: "gmail-refresh",
            sourceKind: "gmail",
            connectionId: "connection-1",
            scope: { allTime: true },
          },
          cursor: null,
          maxUnits: 10,
          refresh: { checkpoint: { cursor: "expired" } },
        },
        context(),
      ),
    ).rejects.toMatchObject({ code: "gmail_history_expired" });
  });

  it("rechecks Gmail source blocks before provider access", async () => {
    const mail = mailProvider({ getCursor: vi.fn(async () => "baseline") });
    const worker = createCompanySourceWorker({
      prisma: prisma({
        companySourceBlock: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => ({ id: "blocked-source" })),
        },
      }),
      mail,
      extractor: { relevant: vi.fn(), extract: vi.fn() },
    });
    await expect(
      worker.beginRefresh?.(
        {
          source: {
            id: "gmail-refresh",
            sourceKind: "gmail",
            connectionId: "connection-1",
            scope: { allTime: true },
          },
          mode: "full",
          checkpoint: null,
        },
        context(),
      ),
    ).rejects.toMatchObject({ code: "source_access_revoked" });
    expect(mail.getCursor).not.toHaveBeenCalled();
  });

  it("discovers Data Room changes within one privacy-scoped fixed cutoff", async () => {
    const base = { kind: "data_room_updated_at", updatedAt: "2026-01-01T00:00:00.000Z" };
    const runCutoff = { kind: "data_room_updated_at", updatedAt: "2026-01-03T00:00:00.000Z" };
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: "changed-a", updatedAt: new Date("2026-01-02T00:00:00Z") }])
      .mockResolvedValueOnce([]);
    const worker = createCompanySourceWorker({
      prisma: prisma({ dataRoomItem: { findMany, findFirst: vi.fn(async () => null) } }),
      extractor: { relevant: vi.fn(), extract: vi.fn() },
    });
    const source = { id: "data-room", sourceKind: "data_room", connectionId: null, scope: {} };
    const begin = await worker.beginRefresh?.(
      { source, mode: "full", checkpoint: null },
      context(),
    );
    expect(begin?.baselineCheckpoint).toMatchObject({ kind: "data_room_updated_at" });
    const first = await worker.discover(
      { source, cursor: null, maxUnits: 1, refresh: { checkpoint: base, runCutoff } },
      context(),
    );
    expect(first.units).toEqual([
      { unitKey: expect.stringContaining("data_room:"), cursor: { itemId: "changed-a" } },
    ]);
    expect(first.nextCursor).toEqual({
      afterUpdatedAt: "2026-01-02T00:00:00.000Z",
      afterId: "changed-a",
    });
    expect(first.proposedCheckpoint).toEqual(runCutoff);
    const query = findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      where: {
        AND: expect.arrayContaining([
          expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
          { updatedAt: { gte: new Date(base.updatedAt), lte: new Date(runCutoff.updatedAt) } },
        ]),
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: 1,
      select: { id: true, updatedAt: true },
    });
    await worker.discover(
      {
        source,
        cursor: first.nextCursor,
        maxUnits: 1,
        refresh: { checkpoint: base, runCutoff },
      },
      context(),
    );
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        AND: expect.arrayContaining([
          {
            OR: [
              { updatedAt: { gt: new Date("2026-01-02T00:00:00.000Z") } },
              { updatedAt: new Date("2026-01-02T00:00:00.000Z"), id: { gt: "changed-a" } },
            ],
          },
        ]),
      },
    });
  });

  it("routes tracker documents through the shared bounded extraction and evidence-reuse path", async () => {
    const source = {
      id: "github-source",
      sourceKind: "github",
      connectionId: "github-connection",
      scope: { reader: "github", allTime: true },
    };
    const tracker = {
      discover: vi.fn(async () => ({
        units: [{ unitKey: "github:issue:1", cursor: { kind: "repository", id: 1 } }],
        nextCursor: null,
        done: true,
      })),
      read: vi.fn(async () => ({
        document: {
          id: "github:issue:1",
          title: "Issue 1",
          text: "The Orion project starts on 2026-01-02.",
          snippet: "The Orion project starts on 2026-01-02.",
          sourceUrl: "https://github.example.test/issues/1",
        },
        nextCursor: { kind: "repository", id: 1, page: 2 },
        done: false,
        cooldownMs: 60_000,
      })),
    };
    const findEvidence = vi.fn(async () => []);
    const relevant = vi.fn(async () => true);
    const extract = vi.fn(async () => ({
      extraction: { entities: [], edges: [], events: [] },
      model: { provider: "scripted", model: "tracker-test" },
    }));
    const worker = createCompanySourceWorker({
      prisma: prisma({ companyEvidence: { findMany: findEvidence } }),
      extractor: { relevant, extract },
      tracker: tracker as never,
    });
    const workerContext = context();

    const discovered = await worker.discover({ source, cursor: null, maxUnits: 1 }, workerContext);
    const read = await worker.read(
      { source, unitKey: "github:issue:1", cursor: { kind: "repository", id: 1 }, maxBytes: 1000 },
      workerContext,
    );

    expect(discovered.units).toEqual([
      { unitKey: "github:issue:1", cursor: { kind: "repository", id: 1 } },
    ]);
    expect(tracker.discover).toHaveBeenCalledWith(
      source,
      null,
      1,
      expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
    );
    expect(tracker.read).toHaveBeenCalledWith(
      source,
      { kind: "repository", id: 1 },
      expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
    );
    expect(findEvidence).toHaveBeenCalledWith({
      where: {
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        sourceKind: "github",
        connectionId: "github-connection",
        mcpServerId: null,
        sourceItemId: "github:issue:1",
        contentHash: expect.any(String),
      },
      select: { id: true },
    });
    expect(relevant).toHaveBeenCalledWith(
      {
        title: "Issue 1",
        text: "The Orion project starts on 2026-01-02.",
      },
      expect.anything(),
    );
    expect(extract).toHaveBeenCalledWith(
      {
        id: "github:issue:1",
        title: "Issue 1",
        text: "The Orion project starts on 2026-01-02.",
        snippet: "The Orion project starts on 2026-01-02.",
        sourceUrl: "https://github.example.test/issues/1",
      },
      expect.anything(),
    );
    expect(read).toMatchObject({
      items: [
        {
          sourceItemId: "github:issue:1",
          content: "Issue 1\nThe Orion project starts on 2026-01-02.",
        },
      ],
      extractions: [
        {
          sourceItemId: "github:issue:1",
          sourceUrl: "https://github.example.test/issues/1",
          model: { provider: "scripted", model: "tracker-test" },
        },
      ],
      nextCursor: { kind: "repository", id: 1, page: 2 },
      done: false,
      cooldownMs: 60_000,
    });
  });

  it("routes Notion and generic document sources through the shared pipeline", async () => {
    const source = {
      id: "notion-source",
      sourceKind: "notion",
      connectionId: "notion-connection",
      scope: { reader: "notion", allTime: true },
    };
    const documents = {
      discover: vi.fn(async () => ({
        units: [{ unitKey: "notion:page", cursor: { pageId: "page" } }],
        nextCursor: null,
        done: true,
      })),
      read: vi.fn(async () => ({
        document: {
          id: "notion:page",
          title: "Launch",
          text: "Launch date 2026-01-02",
          snippet: "Launch date 2026-01-02",
          sourceUrl: "https://www.notion.so/page",
        },
        nextCursor: null,
        done: true,
      })),
    };
    const extract = vi.fn(async () => ({
      extraction: { entities: [], edges: [], events: [] },
      model: { provider: "scripted", model: "document-test" },
    }));
    const worker = createCompanySourceWorker({
      prisma: prisma(),
      extractor: { relevant: vi.fn(async () => true), extract },
      documents: documents as never,
    });
    const workerContext = context();
    await worker.discover({ source, cursor: null, maxUnits: 1 }, workerContext);
    await worker.read(
      { source, unitKey: "notion:page", cursor: { pageId: "page" }, maxBytes: 1000 },
      workerContext,
    );
    expect(documents.discover).toHaveBeenCalled();
    expect(documents.read).toHaveBeenCalled();
    expect(extract).toHaveBeenCalledWith(
      expect.objectContaining({ id: "notion:page", title: "Launch" }),
      expect.anything(),
    );
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
              sourceConnection: {
                spaceId: actor.spaceId,
                userId: actor.userId,
                status: "connected",
                allAgents: true,
                privateByDefault: false,
              },
              id: { in: ["item-1"] },
              folderId: { in: ["folder-1"] },
              folder: { spaceId: actor.spaceId, userId: actor.userId },
            },
          ],
        },
      }),
    );
  });

  it("blocks explicit and source-wide Data Room sources before discovery or reads", async () => {
    const cases = [
      {
        connectionId: "connection-1",
        blocks: [{ connectionId: "connection-1", mcpServerId: null }],
      },
      {
        connectionId: null,
        blocks: [{ connectionId: null, mcpServerId: null }],
      },
    ] as const;

    for (const blockedSource of cases) {
      const itemFindMany = vi.fn();
      const itemFindFirst = vi.fn();
      const textFindFirst = vi.fn();
      const relevant = vi.fn();
      const extract = vi.fn();
      const executeModelCall = vi.fn();
      const sourceBlockFindMany = vi.fn(async () => [...blockedSource.blocks]);
      const worker = createCompanySourceWorker({
        prisma: prisma({
          dataRoomItem: { findMany: itemFindMany, findFirst: itemFindFirst },
          dataRoomItemText: { findFirst: textFindFirst },
          companySourceBlock: { findMany: sourceBlockFindMany },
        }),
        extractor: { relevant, extract },
      });
      const workerContext = { ...context(), executeModelCall };
      const source = {
        id: "source-1",
        sourceKind: "data_room" as const,
        connectionId: blockedSource.connectionId,
        scope: {},
      };

      await expect(
        worker.discover({ source, cursor: null, maxUnits: 10 }, workerContext),
      ).rejects.toMatchObject({ code: "source_access_revoked" });
      await expect(
        worker.read(
          {
            source,
            unitKey: "data_room:item-1",
            cursor: { itemId: "item-1" },
            maxBytes: 1_000,
          },
          workerContext,
        ),
      ).rejects.toMatchObject({ code: "source_access_revoked" });

      expect(sourceBlockFindMany).toHaveBeenCalledWith({
        where: {
          spaceId: actor.spaceId,
          ownerUserId: actor.userId,
          sourceKind: "data_room",
        },
        select: { connectionId: true, mcpServerId: true },
      });
      expect(itemFindMany).not.toHaveBeenCalled();
      expect(itemFindFirst).not.toHaveBeenCalled();
      expect(textFindFirst).not.toHaveBeenCalled();
      expect(relevant).not.toHaveBeenCalled();
      expect(extract).not.toHaveBeenCalled();
      expect(executeModelCall).not.toHaveBeenCalled();
    }
  });

  it("excludes blocked connections from aggregate Data Room discovery", async () => {
    const itemFindMany = vi.fn(async () => []);
    const sourceBlockFindMany = vi.fn(async () => [
      { connectionId: "blocked-connection", mcpServerId: null },
      { connectionId: null, mcpServerId: "mcp-server" },
    ]);
    const worker = createCompanySourceWorker({
      prisma: prisma({
        dataRoomItem: { findMany: itemFindMany, findFirst: vi.fn() },
        companySourceBlock: { findMany: sourceBlockFindMany },
      }),
      extractor: {} as never,
    });

    await worker.discover(
      {
        source: {
          id: "source-1",
          sourceKind: "data_room",
          connectionId: null,
          scope: {},
        },
        cursor: null,
        maxUnits: 10,
      },
      context(),
    );

    expect(sourceBlockFindMany).toHaveBeenCalledWith({
      where: {
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        sourceKind: "data_room",
      },
      select: { connectionId: true, mcpServerId: true },
    });
    expect(itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              OR: [
                { sourceConnectionId: null },
                {
                  sourceConnection: expect.objectContaining({
                    id: { notIn: ["blocked-connection"] },
                  }),
                },
              ],
            }),
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

  it("bounds oversized multibyte data-room text and records a truncation cursor", async () => {
    const text = "界界界";
    const itemFindFirst = vi.fn(async () => ({
      id: "item-1",
      name: "brief",
      docType: null,
      docDate: null,
      parties: [],
      summary: null,
      sourceUrl: null,
      status: "ready",
    }));
    const textFindFirst = vi.fn(async () => ({ text }));
    const relevant = vi.fn(async () => true);
    const extract = vi.fn(async (document: { title: string; text: string }) => ({
      extraction: {
        entities: [
          {
            ref: "subject",
            entity: {
              kind: "person" as const,
              displayName: "Subject",
              attrs: {},
              confidence: 0.9,
            },
            quote: document.text,
          },
        ],
        edges: [],
        events: [],
      },
      model: { provider: "scripted", model: "bounded" },
    }));
    const worker = createCompanySourceWorker({
      prisma: prisma({
        dataRoomItem: { findMany: vi.fn(), findFirst: itemFindFirst },
        dataRoomItemText: { findFirst: textFindFirst },
      }),
      extractor: { relevant, extract },
    });

    const page = await worker.read(
      {
        source: {
          id: "source-1",
          sourceKind: "data_room",
          connectionId: null,
          scope: { itemIds: ["item-1"] },
        },
        unitKey: "data_room:item-1",
        cursor: { itemId: "item-1" },
        maxBytes: 10,
      },
      context(),
    );

    expect(page.items[0]).toMatchObject({
      content: "brief\n界",
      contentHash: expect.any(String),
    });
    expect(Buffer.byteLength(page.items[0]!.content)).toBeLessThanOrEqual(10);
    expect(page.nextCursor).toEqual({ itemId: "item-1", truncated: true });
    expect(extract).toHaveBeenCalledWith(
      { id: "item-1", title: "brief", text: "界", snippet: "界", sourceUrl: null },
      expect.anything(),
    );
  });

  it("screens and extracts only a bounded Data Room text prefix", async () => {
    const itemFindFirst = vi.fn(async () => ({
      id: "item-1",
      name: "brief",
      docType: null,
      docDate: null,
      parties: [],
      summary: "Summary contains excluded-secret-phrase.",
      sourceUrl: null,
      status: "ready",
    }));
    const textFindFirst = vi.fn(async () => ({
      text: `${"a".repeat(1_500)} excluded-secret-phrase`,
    }));
    const relevant = vi.fn(async (_document: { title: string; text: string }) => true);
    const extract = vi.fn(
      async (_document: {
        id: string;
        title: string;
        text: string;
        snippet: string;
        sourceUrl: string | null;
      }) => ({
        extraction: { entities: [], edges: [], events: [] },
        model: { provider: "scripted", model: "bounded" },
      }),
    );
    const worker = createCompanySourceWorker({
      prisma: prisma({
        dataRoomItem: { findMany: vi.fn(), findFirst: itemFindFirst },
        dataRoomItemText: { findFirst: textFindFirst },
      }),
      extractor: { relevant, extract },
    });

    await worker.read(
      {
        source: { id: "source-1", sourceKind: "data_room", connectionId: null, scope: {} },
        unitKey: "data_room:item-1",
        cursor: { itemId: "item-1" },
        maxBytes: 40,
      },
      context(),
    );

    expect(relevant.mock.calls[0]?.[0].text).not.toContain("excluded-secret-phrase");
    expect(extract.mock.calls[0]?.[0]?.snippet).not.toContain("excluded-secret-phrase");
    expect(extract.mock.calls[0]?.[0]?.text).not.toContain("excluded-secret-phrase");
  });

  it.each([
    {
      cached: { id: "cached_message-1", category: null, pile: null },
      sourceUrl: "/app/inbox?mail=cached_message-1",
    },
    { cached: null, sourceUrl: null },
  ])(
    "uses cached-mail provenance only when available ($sourceUrl)",
    async ({ cached, sourceUrl }) => {
      const relevant = vi.fn(async () => true);
      const extract = vi.fn(async () => ({
        extraction: { entities: [], edges: [], events: [] },
        model: { provider: "scripted", model: "provenance" },
      }));
      const worker = createCompanySourceWorker({
        prisma: prisma({
          cachedMailMessage: { findFirst: vi.fn(async () => cached) },
        }),
        mail: mailProvider({
          listMessages: vi.fn(async () => ({ messages: [summary("m-1")] })),
          getMessage: vi.fn(async () => ({
            subject: "Northwind",
            text: "Synthetic message text.",
            html: null,
            threadId: "thread-m-1",
          })),
        }),
        extractor: { relevant, extract },
      });

      await worker.read(
        {
          source: {
            id: "source-1",
            sourceKind: "gmail",
            connectionId: "connection-1",
            scope: { allTime: true },
          },
          unitKey: "gmail:m-1",
          cursor: { itemId: "m-1" },
          maxBytes: 1_000,
        },
        context(),
      );

      expect(extract).toHaveBeenCalledWith(
        expect.objectContaining({ sourceUrl }),
        expect.anything(),
      );
    },
  );

  it("marks reused and irrelevant truncated documents as complete with a cursor marker", async () => {
    const itemFindFirst = vi.fn(async () => ({
      id: "item-1",
      name: "brief",
      docType: null,
      docDate: null,
      parties: [],
      summary: null,
      sourceUrl: null,
      status: "ready",
    }));
    const textFindFirst = vi.fn(async () => ({ text: "source text" }));
    const evidenceFindMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: "evidence-1" }])
      .mockResolvedValueOnce([]);
    const relevant = vi.fn(async () => false);
    const worker = createCompanySourceWorker({
      prisma: prisma({
        dataRoomItem: { findMany: vi.fn(), findFirst: itemFindFirst },
        dataRoomItemText: { findFirst: textFindFirst },
        companyEvidence: { findMany: evidenceFindMany },
      }),
      extractor: { relevant, extract: vi.fn() },
    });
    const input = {
      source: {
        id: "source-1",
        sourceKind: "data_room" as const,
        connectionId: null,
        scope: { itemIds: ["item-1"] },
      },
      unitKey: "data_room:item-1",
      cursor: { itemId: "item-1" },
      maxBytes: 10,
    };

    const reused = await worker.read(input, context());
    const irrelevant = await worker.read({ ...input, cursor: reused.nextCursor }, context());

    expect(reused.nextCursor).toEqual({ itemId: "item-1", truncated: true });
    expect(reused.reusedEvidenceIds).toEqual(["evidence-1"]);
    expect(irrelevant.nextCursor).toEqual({ itemId: "item-1", truncated: true });
    expect(irrelevant.extractions).toBeUndefined();
    expect(relevant).toHaveBeenCalledTimes(1);
  });

  it("extracts usable Gmail plain text when the provider flags HTML truncation", async () => {
    const relevant = vi.fn(async () => true);
    const extract = vi.fn(async (document: { title: string; text: string }) => ({
      extraction: {
        entities: [
          {
            ref: "subject",
            entity: {
              kind: "person" as const,
              displayName: "Subject",
              attrs: {},
              confidence: 0.9,
            },
            quote: document.text,
          },
        ],
        edges: [],
        events: [],
      },
      model: { provider: "scripted", model: "gmail-truncated" },
    }));
    const worker = createCompanySourceWorker({
      prisma: prisma({
        companyEvidence: { findMany: vi.fn(async () => []) },
      }),
      mail: mailProvider({
        listMessages: vi.fn(async () => ({ messages: [summary("m-1")] })),
        getMessage: vi.fn(async () => ({
          subject: "Northwind",
          text: "Usable plain text.",
          html: "<div>truncated",
          threadId: "thread-m-1",
          truncated: true,
        })),
      }),
      extractor: { relevant, extract },
    });

    const page = await worker.read(
      {
        source: {
          id: "source-1",
          sourceKind: "gmail",
          connectionId: "connection-1",
          scope: { allTime: true },
        },
        unitKey: "gmail:m-1",
        cursor: { itemId: "m-1" },
        maxBytes: 1_000,
      },
      context(),
    );

    expect(page.nextCursor).toEqual({ itemId: "m-1", truncated: true });
    expect(page.items[0]!.content).toBe("Northwind\nUsable plain text.");
    expect(extract).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Northwind", text: "Usable plain text." }),
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
      mail: mailProvider({ listMessages, getMessage: vi.fn() }),
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
      mail: mailProvider({
        listAccounts,
        listMessages,
        getMessage: vi.fn(),
      }),
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
        allAgents: true,
        privateByDefault: false,
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
        mail: mailProvider({
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
        }),
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
