import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { IsolationError } from "./scope.js";

/** Duplicate folder name, non-empty folder delete, or a move that would create a cycle. */
export class DataRoomConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataRoomConflictError";
  }
}

export type DataRoomItemRecord = Prisma.DataRoomItemGetPayload<object>;
export type DataRoomFolderRecord = Prisma.DataRoomFolderGetPayload<object>;

export interface DataRoomFilters {
  folderId?: string | null;
  docType?: string;
  /** Item lists this party. */
  party?: string;
  tag?: string;
  docDateFrom?: Date;
  docDateTo?: Date;
  status?: string;
  source?: string;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
/** Chunks each search leg fetches before grouping by item. */
const OVER_FETCH = 100;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// V1: each item is visible only to the person who added or connected it. Shared or per-agent
// visibility (V2) is added here, once, for every function below.
function eligibleWhere(actor: Actor, filters: DataRoomFilters = {}): Prisma.DataRoomItemWhereInput {
  return {
    spaceId: actor.spaceId,
    userId: actor.userId,
    ...(filters.folderId !== undefined ? { folderId: filters.folderId } : {}),
    ...(filters.docType ? { docType: filters.docType } : {}),
    ...(filters.party ? { parties: { has: filters.party } } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.docDateFrom || filters.docDateTo
      ? { docDate: { gte: filters.docDateFrom, lte: filters.docDateTo } }
      : {}),
  };
}

/** The same condition as eligibleWhere, for raw SQL over `data_room_items AS i`. */
function eligibleSql(actor: Actor, filters: DataRoomFilters = {}): Prisma.Sql {
  const parts = [
    Prisma.sql`i."spaceId" = ${actor.spaceId}`,
    Prisma.sql`i."userId" = ${actor.userId}`,
  ];
  if (filters.folderId !== undefined) {
    parts.push(
      filters.folderId === null
        ? Prisma.sql`i."folderId" IS NULL`
        : Prisma.sql`i."folderId" = ${filters.folderId}`,
    );
  }
  if (filters.docType) parts.push(Prisma.sql`i."docType" = ${filters.docType}`);
  if (filters.party) parts.push(Prisma.sql`${filters.party} = ANY(i."parties")`);
  if (filters.tag) parts.push(Prisma.sql`${filters.tag} = ANY(i."tags")`);
  if (filters.status) parts.push(Prisma.sql`i."status" = ${filters.status}`);
  if (filters.source) parts.push(Prisma.sql`i."source" = ${filters.source}`);
  if (filters.docDateFrom) parts.push(Prisma.sql`i."docDate" >= ${filters.docDateFrom}`);
  if (filters.docDateTo) parts.push(Prisma.sql`i."docDate" <= ${filters.docDateTo}`);
  return Prisma.join(parts, " AND ");
}

export function createDataRoomRepos(prisma: PrismaClient) {
  async function requireFolder(actor: Actor, id: string): Promise<DataRoomFolderRecord> {
    const folder = await prisma.dataRoomFolder.findFirst({
      where: { id, spaceId: actor.spaceId, userId: actor.userId },
    });
    if (!folder) throw new IsolationError();
    return folder;
  }

  async function requireItem(actor: Actor, id: string): Promise<DataRoomItemRecord> {
    const item = await prisma.dataRoomItem.findFirst({ where: { id, ...eligibleWhere(actor) } });
    if (!item) throw new IsolationError();
    return item;
  }

  async function folderWrite<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DataRoomConflictError("A folder with that name already exists here");
      }
      throw error;
    }
  }

  return {
    listFolders: (actor: Actor) =>
      prisma.dataRoomFolder.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),

    async createFolder(
      actor: Actor,
      input: { name: string; parentId?: string | null; createdBy?: "user" | "agent" },
    ) {
      if (input.parentId) await requireFolder(actor, input.parentId);
      return folderWrite(() =>
        prisma.dataRoomFolder.create({
          data: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            parentId: input.parentId ?? null,
            name: input.name,
            createdBy: input.createdBy ?? "user",
          },
        }),
      );
    },

    async renameFolder(actor: Actor, id: string, name: string) {
      await requireFolder(actor, id);
      return folderWrite(() => prisma.dataRoomFolder.update({ where: { id }, data: { name } }));
    },

    async moveFolder(actor: Actor, id: string, parentId: string | null) {
      await requireFolder(actor, id);
      if (parentId) {
        await requireFolder(actor, parentId);
        // The new parent must not be the folder itself or one of its descendants.
        const cycle = await prisma.$queryRaw<{ id: string }[]>`
          WITH RECURSIVE sub AS (
            SELECT id FROM data_room_folders WHERE id = ${id} AND "spaceId" = ${actor.spaceId}
              AND "userId" = ${actor.userId}
            UNION ALL
            SELECT f.id FROM data_room_folders f JOIN sub ON f."parentId" = sub.id
            WHERE f."spaceId" = ${actor.spaceId}
          ) SELECT id FROM sub WHERE id = ${parentId}`;
        if (cycle.length) throw new DataRoomConflictError("A folder cannot move into itself");
      }
      return folderWrite(() => prisma.dataRoomFolder.update({ where: { id }, data: { parentId } }));
    },

    /** Refuses when the folder still holds folders or items; the caller moves or deletes them first. */
    async deleteFolder(actor: Actor, id: string) {
      await requireFolder(actor, id);
      const [items, children] = await Promise.all([
        prisma.dataRoomItem.count({ where: eligibleWhere(actor, { folderId: id }) }),
        prisma.dataRoomFolder.count({
          where: { spaceId: actor.spaceId, userId: actor.userId, parentId: id },
        }),
      ]);
      if (items || children) throw new DataRoomConflictError("Folder is not empty");
      await prisma.dataRoomFolder.deleteMany({
        where: { id, spaceId: actor.spaceId, userId: actor.userId },
      });
    },

    /** Uploads dedupe on sha256 per space: an existing upload is returned with created=false. */
    async createItem(
      actor: Actor,
      input: {
        source: "upload" | "drive" | "gmail" | "chat" | "finance";
        sha256: string;
        name: string;
        mimeType: string;
        size: number;
        storageKey?: string | null;
        folderId?: string | null;
        sourceConnectionId?: string | null;
        externalId?: string | null;
        sourceUrl?: string | null;
        sourceUpdatedAt?: Date | null;
        docType?: string | null;
        docDate?: Date | null;
        parties?: string[];
        tags?: string[];
      },
    ): Promise<{ item: DataRoomItemRecord; created: boolean }> {
      const findExisting = () =>
        prisma.dataRoomItem.findFirst({
          where: { ...eligibleWhere(actor), source: "upload", sha256: input.sha256 },
        });
      if (input.source === "upload") {
        const existing = await findExisting();
        if (existing) return { item: existing, created: false };
      }
      if (input.folderId) await requireFolder(actor, input.folderId);
      if (input.sourceConnectionId) {
        const connection = await prisma.connection.findFirst({
          where: { id: input.sourceConnectionId, spaceId: actor.spaceId, userId: actor.userId },
          select: { id: true },
        });
        if (!connection) throw new IsolationError();
      }
      try {
        const item = await prisma.dataRoomItem.create({
          data: { ...input, spaceId: actor.spaceId, userId: actor.userId },
        });
        return { item, created: true };
      } catch (error) {
        if (input.source === "upload" && isUniqueViolation(error)) {
          const existing = await findExisting();
          if (existing) return { item: existing, created: false };
        }
        throw error;
      }
    },

    getItem: (actor: Actor, id: string) => requireItem(actor, id),

    listItems: (actor: Actor, filters: DataRoomFilters, page: { limit?: number } = {}) =>
      prisma.dataRoomItem.findMany({
        where: eligibleWhere(actor, filters),
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: Math.min(Math.max(page.limit ?? 100, 1), 500),
      }),

    async updateItem(
      actor: Actor,
      id: string,
      patch: Partial<
        Pick<
          DataRoomItemRecord,
          | "name"
          | "status"
          | "error"
          | "docType"
          | "docDate"
          | "parties"
          | "amountCents"
          | "currency"
          | "tags"
          | "summary"
        >
      >,
    ) {
      await requireItem(actor, id);
      return prisma.dataRoomItem.update({ where: { id }, data: patch });
    },

    async moveItem(actor: Actor, id: string, folderId: string | null) {
      await requireItem(actor, id);
      if (folderId) await requireFolder(actor, folderId);
      return prisma.dataRoomItem.update({ where: { id }, data: { folderId } });
    },

    /** Deletes the item and (by cascade) its chunks. The caller deletes the blob at storageKey. */
    async deleteItem(actor: Actor, id: string): Promise<{ storageKey: string | null }> {
      const item = await requireItem(actor, id);
      await prisma.dataRoomItem.deleteMany({
        where: { id, spaceId: actor.spaceId, userId: actor.userId },
      });
      return { storageKey: item.storageKey };
    },

    /**
     * Makes the item's chunks equal `chunks`. A chunk is left alone (keeping its embedding) when its
     * contentHash is unchanged and, if `embeddingModel` is given, the stored embedding model equals
     * it. Otherwise the chunk is rewritten and loses its embedding so it is embedded again.
     */
    async replaceChunks(
      actor: Actor,
      itemId: string,
      chunks: { ordinal: number; text: string; contentHash: string }[],
      options: { embeddingModel?: string } = {},
    ) {
      await requireItem(actor, itemId);
      const model = options.embeddingModel ?? null;
      return prisma.$transaction(async (tx) => {
        const keep = chunks.map((chunk) => chunk.ordinal);
        const removed = await tx.dataRoomChunk.deleteMany({
          where: { itemId, spaceId: actor.spaceId, userId: actor.userId, ordinal: { notIn: keep } },
        });
        let written = 0;
        for (const chunk of chunks) {
          written += await tx.$executeRaw`
            INSERT INTO data_room_chunks (id, "spaceId", "userId", "itemId", ordinal, text, "contentHash")
            VALUES (${randomUUID()}, ${actor.spaceId}, ${actor.userId}, ${itemId}, ${chunk.ordinal},
              ${chunk.text}, ${chunk.contentHash})
            ON CONFLICT ("itemId", ordinal) DO UPDATE
              SET text = EXCLUDED.text, "contentHash" = EXCLUDED."contentHash",
                  embedding = NULL, "embeddingModel" = NULL
              WHERE data_room_chunks."contentHash" IS DISTINCT FROM EXCLUDED."contentHash"
                OR (${model}::text IS NOT NULL
                    AND data_room_chunks."embeddingModel" IS DISTINCT FROM ${model}::text)`;
        }
        return { written, skipped: chunks.length - written, removed: removed.count };
      });
    },

    /**
     * Keyword leg: websearch_to_tsquery over chunks of eligible items, best chunk per item.
     * A vector leg can be added as a second CTE of the same shape and fused before the final select.
     */
    async searchKeyword(
      actor: Actor,
      input: { query: string; filters?: DataRoomFilters; limit?: number },
    ) {
      const query = input.query.trim();
      if (!query) return [];
      const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
      const rows = await prisma.$queryRaw<
        { itemId: string; ordinal: number; rank: number; snippet: string }[]
      >`
        WITH q AS (SELECT websearch_to_tsquery('english', ${query}) AS tsq),
        keyword AS (
          SELECT c."itemId", c.ordinal, c.text, ts_rank_cd(c.tsv, q.tsq) AS rank
          FROM data_room_chunks c
          JOIN data_room_items i ON i.id = c."itemId", q
          WHERE c."spaceId" = ${actor.spaceId} AND c."userId" = ${actor.userId}
            AND ${eligibleSql(actor, input.filters)}
            AND c.tsv @@ q.tsq
          ORDER BY rank DESC
          LIMIT ${OVER_FETCH}
        ),
        best AS (
          SELECT DISTINCT ON ("itemId") "itemId", ordinal, text, rank
          FROM keyword ORDER BY "itemId", rank DESC, ordinal
        )
        SELECT b."itemId", b.ordinal, b.rank,
          ts_headline('english', b.text, q.tsq, 'StartSel=<b>, StopSel=</b>, MaxFragments=1') AS snippet
        FROM best b, q
        ORDER BY b.rank DESC, b."itemId"
        LIMIT ${limit}`;
      if (!rows.length) return [];
      const items = await prisma.dataRoomItem.findMany({
        where: { id: { in: rows.map((row) => row.itemId) }, ...eligibleWhere(actor) },
      });
      const byId = new Map(items.map((item) => [item.id, item]));
      return rows.flatMap((row) => {
        const item = byId.get(row.itemId);
        return item ? [{ item, ordinal: row.ordinal, snippet: row.snippet, score: row.rank }] : [];
      });
    },
  };
}
