import type { AdapterContext, PortableMemory } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { MarkdownMemoryStore } from "./index.js";

const context: AdapterContext = {
  operationId: "read-memory",
  traceId: "read-memory",
  spaceId: "workspace-1",
  userId: "user-1",
  signal: new AbortController().signal,
};

function memoryRow(overrides: Record<string, unknown>) {
  return {
    id: "memory-1",
    path: "facts.md",
    content: "A fact",
    revision: 1,
    updatedAt: new Date("2026-08-16T10:00:00.000Z"),
    kind: "fact",
    useCount: 0,
    lastUsedAt: null,
    pinned: false,
    scope: "user",
    botId: null,
    ...overrides,
  };
}

/** A prisma stub whose $transaction runs the callback against an in-memory commit log. */
function commitRecordingPrisma(ownedBotIds: string[] = []) {
  const commits: Array<Record<string, unknown>> = [];
  const tx = {
    memoryDocument: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        commits.push(data);
        return { id: `doc-${commits.length}`, path: data.path, revision: 1, content: data.content };
      }),
    },
    memoryRevision: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
  };
  const prisma = {
    $transaction: (fn: (t: typeof tx) => unknown) => Promise.resolve(fn(tx)),
    bot: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        ownedBotIds.filter((id) => where.id.in.includes(id)).map((id) => ({ id })),
      ),
    },
  };
  return { prisma, commits };
}

async function* filesOf(
  entries: Array<{ path: string; content: string; memory?: PortableMemory }>,
) {
  for (const entry of entries) {
    yield {
      path: entry.path,
      content: new TextEncoder().encode(entry.content),
      ...(entry.memory ? { memory: entry.memory } : {}),
    };
  }
}

const scopedUser: PortableMemory = { version: 1, scope: "user" };
const scopedBot = (botId: string): PortableMemory => ({ version: 1, scope: "bot", botId });

describe("memory store contract shape", () => {
  it("declares markdown portability", () => {
    const store = new MarkdownMemoryStore({} as never);
    expect(store.describe().capabilities.markdownPortable).toBe(true);
  });

  it("reads the most recently updated documents first", async () => {
    const updatedAt = new Date("2026-08-16T10:00:00.000Z");
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { id: "memory-1", path: "facts.md", content: "A fact", revision: 3, updatedAt },
      ]);
    const store = new MarkdownMemoryStore({ memoryDocument: { findMany } } as never);

    await expect(store.read({ scope: "bot", botId: "bot-1" }, context)).resolves.toEqual({
      documents: [
        {
          id: "memory-1",
          path: "facts.md",
          content: "A fact",
          revision: 3,
          updatedAt: updatedAt.toISOString(),
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        spaceId: "workspace-1",
        userId: "user-1",
        scope: "bot",
        botId: "bot-1",
      },
      orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
    });
  });
});

describe("markdown memory export", () => {
  it("exports bot and user memory when scope is all", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([memoryRow({ scope: "bot", botId: "bot-1", path: "persona.md" })])
      .mockResolvedValueOnce([memoryRow({ id: "memory-2", path: "shared.md" })]);
    const store = new MarkdownMemoryStore({ memoryDocument: { findMany } } as never);

    const exported = [];
    for await (const file of store.exportMarkdown({ scope: "all" }, context)) exported.push(file);

    expect(exported).toEqual([
      {
        path: "bot/bot-1/persona.md",
        memory: scopedBot("bot-1"),
        content: new TextEncoder().encode("A fact"),
      },
      {
        path: "user/shared.md",
        memory: scopedUser,
        content: new TextEncoder().encode("A fact"),
      },
    ]);
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: { spaceId: "workspace-1", userId: "user-1", scope: "bot" },
      orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: { spaceId: "workspace-1", userId: "user-1", scope: "user" },
      orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
    });
  });

  it("limits only the bot side when scope is all and a bot is named", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const store = new MarkdownMemoryStore({ memoryDocument: { findMany } } as never);

    for await (const _ of store.exportMarkdown({ scope: "all", botId: "bot-1" }, context)) void _;

    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: { spaceId: "workspace-1", userId: "user-1", scope: "bot", botId: "bot-1" },
      orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: { spaceId: "workspace-1", userId: "user-1", scope: "user" },
      orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
    });
  });

  it("keeps the scope prefix from colliding with a document named like one", async () => {
    const findMany = vi.fn().mockResolvedValue([memoryRow({ path: "bot/bot-9/notes.md" })]);
    const store = new MarkdownMemoryStore({ memoryDocument: { findMany } } as never);

    const exported = [];
    for await (const file of store.exportMarkdown({ scope: "user" }, context)) exported.push(file);

    expect(exported.map((file) => file.path)).toEqual(["user/bot/bot-9/notes.md"]);
    expect(exported[0]!.memory).toEqual(scopedUser);
  });
});

describe("markdown memory import", () => {
  it("restores each exported document into its own scope and bot", async () => {
    const { prisma, commits } = commitRecordingPrisma(["bot-1"]);
    const store = new MarkdownMemoryStore(prisma as never);

    await store.importMarkdown(
      filesOf([
        { path: "bot/bot-1/persona.md", content: "bot notes", memory: scopedBot("bot-1") },
        { path: "user/shared.md", content: "shared notes", memory: scopedUser },
      ]),
      context,
    );

    expect(commits).toEqual([
      expect.objectContaining({
        spaceId: "workspace-1",
        userId: "user-1",
        scope: "bot",
        botId: "bot-1",
        path: "persona.md",
        content: "bot notes",
      }),
      expect.objectContaining({
        spaceId: "workspace-1",
        userId: "user-1",
        scope: "user",
        path: "shared.md",
        content: "shared notes",
      }),
    ]);
  });

  it("imports every legacy file verbatim as user memory, even paths that look scoped", async () => {
    const { prisma, commits } = commitRecordingPrisma();
    const store = new MarkdownMemoryStore(prisma as never);

    await store.importMarkdown(
      filesOf([
        { path: "facts.md", content: "old export" },
        { path: "user/notes.md", content: "looks prefixed" },
        { path: "bot/bot-9/persona.md", content: "looks scoped" },
      ]),
      context,
    );

    expect(commits).toEqual([
      expect.objectContaining({ scope: "user", path: "facts.md", content: "old export" }),
      expect.objectContaining({ scope: "user", path: "user/notes.md", content: "looks prefixed" }),
      expect.objectContaining({
        scope: "user",
        botId: undefined,
        path: "bot/bot-9/persona.md",
        content: "looks scoped",
      }),
    ]);
  });

  it("restores a document whose own path starts with a scope prefix", async () => {
    const findMany = vi.fn().mockResolvedValue([memoryRow({ path: "bot/bot-9/notes.md" })]);
    const exported = [];
    for await (const file of new MarkdownMemoryStore({
      memoryDocument: { findMany },
    } as never).exportMarkdown({ scope: "user" }, context))
      exported.push(file);

    const { prisma, commits } = commitRecordingPrisma();
    await new MarkdownMemoryStore(prisma as never).importMarkdown(
      (async function* () {
        for (const file of exported) yield file;
      })(),
      context,
    );

    expect(commits).toEqual([
      expect.objectContaining({ scope: "user", path: "bot/bot-9/notes.md" }),
    ]);
  });

  it("refuses scoped bot memory for a bot the caller does not own", async () => {
    const { prisma, commits } = commitRecordingPrisma([]);
    const store = new MarkdownMemoryStore(prisma as never);

    await expect(
      store.importMarkdown(
        filesOf([{ path: "bot/bot-9/persona.md", content: "x", memory: scopedBot("bot-9") }]),
        context,
      ),
    ).rejects.toThrow("bot-9");
    expect(prisma.bot.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["bot-9"] }, spaceId: "workspace-1", userId: "user-1" },
      select: { id: true },
    });
    expect(commits).toEqual([]);
  });

  it("refuses bot-scoped memory without a destination owner before committing", async () => {
    const { prisma, commits } = commitRecordingPrisma();
    const store = new MarkdownMemoryStore(prisma as never);

    await expect(
      store.importMarkdown(
        filesOf([
          { path: "bot//notes.md", content: "ownerless", memory: { version: 1, scope: "bot" } },
        ]),
        context,
      ),
    ).rejects.toThrow("bot ID");

    expect(prisma.bot.findMany).not.toHaveBeenCalled();
    expect(commits).toEqual([]);
  });

  it("rejects a scoped file whose path does not match its metadata", async () => {
    const { prisma, commits } = commitRecordingPrisma(["bot-1"]);
    const store = new MarkdownMemoryStore(prisma as never);

    await expect(
      store.importMarkdown(
        filesOf([
          { path: "bot/bot-2/persona.md", content: "x", memory: scopedBot("bot-1") },
          { path: "notes.md", content: "y", memory: scopedUser },
        ]),
        context,
      ),
    ).rejects.toThrow("declared scope");
    expect(commits).toEqual([]);
  });

  it("rejects a memory export from an unknown format version", async () => {
    const { prisma, commits } = commitRecordingPrisma();
    const store = new MarkdownMemoryStore(prisma as never);

    await expect(
      store.importMarkdown(
        filesOf([
          { path: "user/notes.md", content: "x", memory: { version: 2 as never, scope: "user" } },
        ]),
        context,
      ),
    ).rejects.toThrow("version");
    expect(commits).toEqual([]);
  });

  it("remaps imported bot memory onto the bot the caller names", async () => {
    const { prisma, commits } = commitRecordingPrisma(["bot-2"]);
    const store = new MarkdownMemoryStore(prisma as never);

    await store.importMarkdown(
      filesOf([{ path: "bot/bot-1/persona.md", content: "bot notes", memory: scopedBot("bot-1") }]),
      context,
      { botId: "bot-2" },
    );

    expect(commits).toEqual([
      expect.objectContaining({ scope: "bot", botId: "bot-2", path: "persona.md" }),
    ]);
  });

  it("rejects duplicate destinations after bot remapping before committing any file", async () => {
    const { prisma, commits } = commitRecordingPrisma(["bot-2"]);
    const store = new MarkdownMemoryStore(prisma as never);

    await expect(
      store.importMarkdown(
        filesOf([
          { path: "bot/bot-1/notes.md", content: "first", memory: scopedBot("bot-1") },
          { path: "bot/bot-3/notes.md", content: "second", memory: scopedBot("bot-3") },
        ]),
        context,
        { botId: "bot-2" },
      ),
    ).rejects.toThrow("duplicate destination");

    expect(commits).toEqual([]);
  });
});
