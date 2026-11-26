import type { AdapterContext, MemoryCommitRequest } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarkdownMemoryStore } from "./index.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("memory commits (PostgreSQL)", () => {
  const context: AdapterContext = {
    operationId: "memory-commit-test",
    traceId: "memory-commit-test",
    spaceId: "memory-commit-space",
    userId: "memory-commit-user",
    signal: new AbortController().signal,
  };
  // A second tenant, used by the fading tests.
  const otherContext: AdapterContext = {
    ...context,
    spaceId: "memory-fade-other-space",
    userId: "memory-fade-other-user",
  };
  let prisma: PrismaClient;
  let store: MarkdownMemoryStore;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    store = new MarkdownMemoryStore(prisma);
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.organization.create({
      data: {
        id: context.spaceId,
        name: "Memory Test Organization",
        slug: context.spaceId,
        createdAt: new Date(),
        spaces: {
          create: {
            id: context.spaceId,
            name: "Memory Test Space",
            bots: {
              create: {
                id: "memory-commit-bot",
                userId: context.userId,
                name: "Memory Test Bot",
                color: "ink",
              },
            },
          },
        },
      },
    });
  });

  beforeAll(async () => {
    await prisma.organization.create({
      data: {
        id: otherContext.spaceId,
        name: "Memory Fade Other Organization",
        slug: otherContext.spaceId,
        createdAt: new Date(),
        spaces: { create: { id: otherContext.spaceId, name: "Memory Fade Other Space" } },
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.organization.deleteMany({
        where: { id: { in: [context.spaceId, otherContext.spaceId] } },
      });
    } finally {
      await close();
    }
  });

  function request(path: string, content: string): MemoryCommitRequest {
    return {
      scope: "user",
      path,
      content,
      sourceRunId: `run-${content}`,
      sourceThreadId: `thread-${content}`,
    };
  }

  async function document(path: string) {
    return prisma.memoryDocument.findFirstOrThrow({
      where: { spaceId: context.spaceId, path },
      include: { revisions: { orderBy: { revision: "asc" } } },
    });
  }

  it.each(["user", "bot"] as const)(
    "retries overlapping %s saves with fresh revisions and matching history",
    async (scope) => {
      const path = `concurrent-${scope}.md`;
      const write = (content: string): MemoryCommitRequest => ({
        ...request(path, content),
        scope,
        botId: scope === "bot" ? "memory-commit-bot" : undefined,
      });
      const initial = await store.commit(write("initial"), context);
      let reads = 0;
      let release!: () => void;
      const bothRead = new Promise<void>((resolve) => {
        release = resolve;
      });
      const concurrentStore = new MarkdownMemoryStore(
        prisma.$extends({
          query: {
            memoryDocument: {
              async findFirst({ args, query }) {
                const result = await query(args);
                reads += 1;
                // Both first attempts see revision 1 before either can write.
                if (reads === 2) release();
                if (reads <= 2) await bothRead;
                return result;
              },
            },
          },
        }) as PrismaClient,
      );

      const results = await Promise.allSettled([
        concurrentStore.commit(write("first"), context),
        concurrentStore.commit(write("second"), context),
      ]);

      expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
      expect(reads).toBe(3);
      const saved = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      expect(saved.map((result) => result.revision).sort()).toEqual([2, 3]);
      const current = await document(path);
      expect(current.revision).toBe(3);
      expect(current.content).toBe(saved.find((result) => result.revision === 3)!.content);
      expect(current.revisions).toHaveLength(3);
      for (const result of [initial, ...saved]) {
        expect(
          current.revisions.find((revision) => revision.revision === result.revision),
        ).toMatchObject({
          documentId: result.id,
          revision: result.revision,
          content: result.content,
          sourceRunId: `run-${result.content}`,
          sourceThreadId: `thread-${result.content}`,
        });
      }
    },
  );

  it.each([false, true])(
    "rolls back a rejected history insert and permits a caller retry (existing: %s)",
    async (existing) => {
      const path = `rejected-${existing}.md`;
      if (existing) await store.commit(request(path, "initial"), context);
      const before = await prisma.memoryDocument.findMany({
        where: { spaceId: context.spaceId, path },
        include: { revisions: true },
      });
      let inserts = 0;
      const rejectingStore = new MarkdownMemoryStore(
        prisma.$extends({
          query: {
            memoryRevision: {
              async create({ args, query }) {
                inserts += 1;
                // Make PostgreSQL reject the history row after the document write.
                return query({
                  ...args,
                  data: {
                    ...args.data,
                    document: undefined,
                    documentId: "missing-memory-document",
                  },
                });
              },
            },
          },
        }) as PrismaClient,
      );

      await expect(rejectingStore.commit(request(path, "rejected"), context)).rejects.toMatchObject(
        {
          code: "P2003",
        },
      );
      expect(inserts).toBe(1);
      expect(
        await prisma.memoryDocument.findMany({
          where: { spaceId: context.spaceId, path },
          include: { revisions: true },
        }),
      ).toEqual(before);

      const retried = await store.commit(request(path, "rejected"), context);
      expect(retried.revision).toBe(existing ? 2 : 1);
      const current = await document(path);
      expect(current.revisions).toHaveLength(retried.revision);
      expect(current.revisions.at(-1)).toMatchObject({
        revision: retried.revision,
        content: retried.content,
      });
    },
  );

  it("bounds conflict retries, preserves only committed saves, and allows a later retry", async () => {
    const path = "exhausted.md";
    await store.commit(request(path, "initial"), context);
    let attempts = 0;
    const conflictingStore = new MarkdownMemoryStore(
      prisma.$extends({
        query: {
          memoryDocument: {
            async findFirst({ args, query }) {
              const result = await query(args);
              attempts += 1;
              // Invalidate every attempted snapshot with a separate committed save.
              await store.commit(request(path, `winner-${attempts}`), context);
              return result;
            },
          },
        },
      }) as PrismaClient,
    );

    await expect(conflictingStore.commit(request(path, "rejected"), context)).rejects.toMatchObject(
      {
        code: "P2034",
      },
    );
    expect(attempts).toBe(3);
    const current = await document(path);
    expect(current).toMatchObject({ revision: 4, content: "winner-3" });
    expect(current.revisions.map(({ revision, content }) => ({ revision, content }))).toEqual([
      { revision: 1, content: "initial" },
      { revision: 2, content: "winner-1" },
      { revision: 3, content: "winner-2" },
      { revision: 4, content: "winner-3" },
    ]);

    const retried = await store.commit(request(path, "rejected"), context);
    expect(retried.revision).toBe(5);
    const afterRetry = await document(path);
    expect(afterRetry).toMatchObject({ revision: 5, content: "rejected" });
    expect(afterRetry.revisions).toHaveLength(5);
    expect(afterRetry.revisions.at(-1)).toMatchObject({ revision: 5, content: "rejected" });
  });

  async function save(c: AdapterContext, path: string, kind?: "task" | "preference") {
    return store.commit({ scope: "user", path, content: `note about ${path}`, kind }, c);
  }

  it("stores the kind, reads it back, and updates it only when given", async () => {
    await save(context, "kind.md", "task");
    await store.commit({ scope: "user", path: "kind.md", content: "again" }, context);
    const snap = await store.read({ scope: "user", path: "kind.md" }, context);
    expect(snap.documents[0]).toMatchObject({ kind: "task", useCount: 0, pinned: false });
  });

  it("finds a weak memory by explicit search, ranked below a strong one", async () => {
    const weak = await save(context, "search-weak.md", "task");
    await save(context, "search-strong.md", "preference");
    await prisma.memoryDocument.update({
      where: { id: weak.id },
      data: { updatedAt: new Date(Date.now() - 400 * 86_400_000) },
    });
    const found = await store.search({ query: "note about search-", scope: "user" }, context);
    expect(found.map((r) => r.path)).toEqual(["search-strong.md", "search-weak.md"]);
    expect(found[0]!.score).toBeGreaterThan(found[1]!.score);
  });

  it("records use only inside the caller's space and user", async () => {
    const a = await save(context, "use.md");
    const b = await save(otherContext, "use.md");
    await store.recordUse([a.id, b.id], context);
    const rowA = await prisma.memoryDocument.findUniqueOrThrow({ where: { id: a.id } });
    const rowB = await prisma.memoryDocument.findUniqueOrThrow({ where: { id: b.id } });
    expect(rowA.useCount).toBe(1);
    expect(rowA.lastUsedAt).not.toBeNull();
    expect(rowB.useCount).toBe(0);
    expect(rowB.lastUsedAt).toBeNull();
  });

  it("pins a memory the owner edited by hand", async () => {
    await save(context, "owner.md", "task");
    await store.commit(
      { scope: "user", path: "owner.md", content: "context", byOwner: true },
      context,
    );
    const snap = await store.read({ scope: "user", path: "owner.md" }, context);
    expect(snap.documents[0]!.pinned).toBe(true);
  });

  it("exports bot and user memory for scope all and imports it back into each scope", async () => {
    await store.commit(
      {
        scope: "bot",
        botId: "memory-commit-bot",
        path: "roundtrip-bot.md",
        content: "bot only",
      },
      context,
    );
    await store.commit({ scope: "user", path: "roundtrip-user.md", content: "shared" }, context);

    const files = [];
    for await (const file of store.exportMarkdown({ scope: "all" }, context)) files.push(file);
    const roundtrip = files.filter((file) => file.path.includes("roundtrip-"));
    expect(roundtrip.map((file) => file.path).sort()).toEqual([
      "bot/memory-commit-bot/roundtrip-bot.md",
      "user/roundtrip-user.md",
    ]);

    await prisma.memoryDocument.deleteMany({
      where: { spaceId: context.spaceId, path: { startsWith: "roundtrip-" } },
    });
    await store.importMarkdown(
      (async function* () {
        for (const file of roundtrip) yield file;
      })(),
      context,
    );

    const restoredBot = await prisma.memoryDocument.findFirstOrThrow({
      where: { spaceId: context.spaceId, userId: context.userId, path: "roundtrip-bot.md" },
    });
    expect(restoredBot).toMatchObject({
      scope: "bot",
      botId: "memory-commit-bot",
      content: "bot only",
    });
    const restoredUser = await prisma.memoryDocument.findFirstOrThrow({
      where: { spaceId: context.spaceId, userId: context.userId, path: "roundtrip-user.md" },
    });
    expect(restoredUser).toMatchObject({ scope: "user", botId: null, content: "shared" });
  });

  it("imports legacy files verbatim as user memory, even paths that look scoped", async () => {
    await store.importMarkdown(
      (async function* () {
        yield {
          path: "bot/memory-commit-bot/legacy.md",
          content: new TextEncoder().encode("looks scoped"),
        };
        yield {
          path: "user/legacy.md",
          content: new TextEncoder().encode("looks prefixed"),
        };
      })(),
      context,
    );

    const rows = await prisma.memoryDocument.findMany({
      where: {
        spaceId: context.spaceId,
        userId: context.userId,
        path: { in: ["bot/memory-commit-bot/legacy.md", "user/legacy.md"] },
      },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatchObject({ scope: "user", botId: null });
    expect(rows.find((row) => row.path === "bot/memory-commit-bot/legacy.md")!.content).toBe(
      "looks scoped",
    );
  });

  it("refuses to import scoped bot memory for a bot the caller does not own", async () => {
    await expect(
      store.importMarkdown(
        (async function* () {
          yield {
            path: "bot/memory-commit-bot/foreign.md",
            memory: { version: 1, scope: "bot", botId: "memory-commit-bot" } as const,
            content: new TextEncoder().encode("foreign"),
          };
        })(),
        otherContext,
      ),
    ).rejects.toThrow("memory-commit-bot");
    expect(
      await prisma.memoryDocument.count({
        where: { spaceId: otherContext.spaceId, path: "foreign.md" },
      }),
    ).toBe(0);
  });
});
