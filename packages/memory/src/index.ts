import type {
  AdapterContext,
  MemoryCommitRequest,
  MemoryExportRequest,
  MemoryReadRequest,
  MemoryRevision,
  MemorySearchRequest,
  MemorySearchResult,
  MemorySnapshot,
  MemoryStore,
  PortableFile,
  PortableMemory,
} from "@rakazo/adapter-kit";
import { MEMORY_REVISION_CONFLICT_ERROR, memoryStrength } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { Prisma, withTransactionRetry } from "@rakazo/db";

export class MarkdownMemoryStore implements MemoryStore {
  constructor(private readonly prisma: PrismaClient) {}

  describe() {
    return {
      id: "markdown",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { search: true, revisions: true, markdownPortable: true },
    };
  }

  async read(request: MemoryReadRequest, context: AdapterContext): Promise<MemorySnapshot> {
    const documents = await this.prisma.memoryDocument.findMany({
      where: {
        spaceId: context.spaceId,
        userId: context.userId,
        scope: request.scope,
        ...(request.botId ? { botId: request.botId } : {}),
        ...(request.path ? { path: request.path } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
    });
    return {
      documents: documents.map((doc) => ({
        id: doc.id,
        path: doc.path,
        content: doc.content,
        revision: doc.revision,
        updatedAt: doc.updatedAt.toISOString(),
        kind: doc.kind,
        useCount: doc.useCount,
        lastUsedAt: doc.lastUsedAt?.toISOString(),
        pinned: doc.pinned,
      })),
    };
  }

  async recordUse(documentIds: string[], context: AdapterContext): Promise<void> {
    if (documentIds.length === 0) return;
    await this.prisma.memoryDocument.updateMany({
      where: { id: { in: documentIds }, spaceId: context.spaceId, userId: context.userId },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  async search(
    request: MemorySearchRequest,
    context: AdapterContext,
  ): Promise<MemorySearchResult[]> {
    const documents = await this.prisma.memoryDocument.findMany({
      where: {
        spaceId: context.spaceId,
        userId: context.userId,
        scope: request.scope === "all" ? { in: ["bot", "user"] } : request.scope,
        ...(request.botId ? { botId: request.botId } : {}),
      },
    });
    const q = request.query.toLowerCase();
    // Search never hides a faded memory; it only ranks it lower (match is 1, so score = strength).
    const now = new Date();
    return documents
      .filter((doc) => doc.content.toLowerCase().includes(q) || doc.path.toLowerCase().includes(q))
      .map((doc) => ({
        path: doc.path,
        snippet: snippet(doc.content, q),
        score: memoryStrength(doc, now),
      }))
      .sort((a, b) => b.score - a.score);
  }

  async commit(request: MemoryCommitRequest, context: AdapterContext): Promise<MemoryRevision> {
    // A save replaces the current content and appends its history atomically.
    // Conflicts retry the whole transaction so revision numbers use fresh state.
    return withTransactionRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.memoryDocument.findFirst({
            where: {
              spaceId: context.spaceId,
              userId: context.userId,
              scope: request.scope,
              botId: request.botId ?? null,
              path: request.path,
            },
          });
          if (request.expectedRevision !== undefined) {
            const live = existing?.revision ?? 0;
            if (live !== request.expectedRevision) throw new Error(MEMORY_REVISION_CONFLICT_ERROR);
          }
          const doc = existing
            ? await tx.memoryDocument.update({
                where: { id: existing.id },
                data: {
                  content: request.content,
                  revision: existing.revision + 1,
                  ...(request.kind ? { kind: request.kind } : {}),
                  ...(request.byOwner ? { pinned: true } : {}),
                },
              })
            : await tx.memoryDocument.create({
                data: {
                  spaceId: context.spaceId,
                  userId: context.userId,
                  botId: request.botId,
                  scope: request.scope,
                  path: request.path,
                  content: request.content,
                  ...(request.kind ? { kind: request.kind } : {}),
                  ...(request.byOwner ? { pinned: true } : {}),
                },
              });
          await tx.memoryRevision.create({
            data: {
              documentId: doc.id,
              revision: doc.revision,
              content: request.content,
              sourceRunId: request.sourceRunId,
              sourceThreadId: request.sourceThreadId,
            },
          });
          return { id: doc.id, path: doc.path, revision: doc.revision, content: doc.content };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async *exportMarkdown(
    request: MemoryExportRequest,
    context: AdapterContext,
  ): AsyncIterable<PortableFile> {
    // "all" means bot and user memory, as in search; a bot id narrows the bot side only,
    // since user memory is shared by every bot the caller owns.
    const scopes: ReadonlyArray<"bot" | "user"> =
      request.scope === "all" ? ["bot", "user"] : [request.scope];
    for (const scope of scopes) {
      const documents = await this.prisma.memoryDocument.findMany({
        where: {
          spaceId: context.spaceId,
          userId: context.userId,
          scope,
          ...(request.botId && (scope === "bot" || request.scope !== "all")
            ? { botId: request.botId }
            : {}),
        },
        orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
      });
      for (const doc of documents) {
        const path = scope === "bot" ? `bot/${doc.botId ?? ""}/${doc.path}` : `user/${doc.path}`;
        const memory: PortableMemory =
          scope === "bot"
            ? { version: 1, scope, botId: doc.botId ?? undefined }
            : { version: 1, scope };
        yield { path, memory, content: new TextEncoder().encode(doc.content) };
      }
    }
  }

  async importMarkdown(
    files: AsyncIterable<PortableFile>,
    context: AdapterContext,
    options?: { botId?: string },
  ): Promise<MemoryRevision> {
    const pending: Array<{
      scope: "bot" | "user";
      botId?: string;
      path: string;
      content: string;
    }> = [];
    for await (const file of files) {
      const target = importedTarget(file);
      pending.push({
        scope: target.scope,
        botId: target.scope === "bot" ? (options?.botId ?? target.botId) : undefined,
        path: target.path,
        content: new TextDecoder().decode(file.content),
      });
    }
    // The remap can collapse distinct source bots onto one destination. Legacy files have
    // already been kept verbatim as user paths, so checking these resolved keys also catches
    // duplicates without reinterpreting their filenames.
    const destinations = new Set<string>();
    for (const doc of pending) {
      if (doc.scope === "bot" && !doc.botId) {
        throw new Error("Bot-scoped memory import requires a bot ID");
      }
      const destination = JSON.stringify([doc.scope, doc.botId ?? null, doc.path]);
      if (destinations.has(destination)) {
        throw new Error("Memory import contains a duplicate destination");
      }
      destinations.add(destination);
    }
    // A bot memory row is only ever written for a bot the caller owns: attaching one to
    // another user's bot id would collide with that owner's documents or fail its key.
    const botIds = [...new Set(pending.flatMap((doc) => (doc.botId ? [doc.botId] : [])))];
    if (botIds.length > 0) {
      const owned = await this.prisma.bot.findMany({
        where: { id: { in: botIds }, spaceId: context.spaceId, userId: context.userId },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map((bot) => bot.id));
      const foreign = botIds.filter((id) => !ownedIds.has(id));
      if (foreign.length > 0) {
        throw new Error(`Cannot import memory for a bot that is not yours: ${foreign.join(", ")}`);
      }
    }
    let last: MemoryRevision | undefined;
    for (const doc of pending) {
      last = await this.commit(
        { scope: doc.scope, botId: doc.botId, path: doc.path, content: doc.content },
        context,
      );
    }
    if (!last) throw new Error("No memory files to import");
    return last;
  }
}

/**
 * Where a portable file lands on import. Only files carrying `memory` metadata — what
 * exportMarkdown emits — restore a declared scope or shed the `bot/<botId>/`/`user/`
 * prefixes. Every other file is a legacy or foreign export and lands verbatim as a user
 * document, so a file merely named `user/x` or `bot/y/z` is never renamed or rescoped.
 */
function importedTarget(file: PortableFile): {
  scope: "bot" | "user";
  botId?: string;
  path: string;
} {
  const memory = file.memory;
  if (!memory) return { scope: "user", path: file.path };
  if (memory.version !== 1) {
    throw new Error(`Unsupported memory export version: ${String(memory.version)}`);
  }
  if (memory.scope !== "bot" && memory.scope !== "user") {
    throw new Error(`Unsupported memory export scope: ${String(memory.scope)}`);
  }
  const prefix = memory.scope === "bot" ? `bot/${memory.botId ?? ""}/` : "user/";
  if (!file.path.startsWith(prefix) || file.path.length === prefix.length) {
    throw new Error(`Memory file path does not match its declared scope: ${file.path}`);
  }
  return { scope: memory.scope, botId: memory.botId, path: file.path.slice(prefix.length) };
}

function snippet(content: string, q: string): string {
  const idx = content.toLowerCase().indexOf(q);
  if (idx < 0) return content.slice(0, 140);
  return content.slice(Math.max(0, idx - 40), idx + q.length + 80);
}
