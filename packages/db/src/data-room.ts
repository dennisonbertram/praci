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

/** A pipeline write was refused because the item changed since the step claimed it. */
export class DataRoomStaleError extends Error {
  constructor() {
    super("The item changed since this step started");
    this.name = "DataRoomStaleError";
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
const searchChanged = () => new DataRoomConflictError("Search changed; start again");
/** Items each search leg keeps before fusion, and the reciprocal rank fusion constant. */
/** How long a claimed step may run before another may take the item over. */
export const DATA_ROOM_LEASE_MS = 10 * 60_000;
const LEG_SQL = Prisma.raw("100");
const RRF_SQL = Prisma.raw("60");
const DEFAULT_LIMIT = 10;
/** Highlight markers in search snippets. replaceChunks strips them from stored text. */
const HIGHLIGHT_START = "\u0001";
const HIGHLIGHT_STOP = "\u0002";
const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_STOP}, MaxFragments=1`;
const stripMarkers = (text: string) =>
  text.replaceAll(HIGHLIGHT_START, "").replaceAll(HIGHLIGHT_STOP, "");

export interface DataRoomSearchResult {
  item: DataRoomItemRecord;
  ordinal: number;
  /**
   * Plain text. U+0001 and U+0002 mark the start and end of each highlight. The text is untrusted
   * document content: the UI must render it as text, never as HTML.
   */
  snippet: string;
  score: number;
}

const DATE_SORTS = new Set<DataRoomSortField>(["date", "createdAt"]);

function encodeCursor(value: Date | string | number | null, id: string, mode?: string) {
  const v = value instanceof Date ? value.toISOString() : value;
  return Buffer.from(JSON.stringify(mode === undefined ? [v, id] : [v, id, mode])).toString(
    "base64url",
  );
}

function decodeCursor(
  cursor: string,
  field: DataRoomSortField | "relevance",
): { value: Date | string | number | null; id: string; mode?: string } {
  try {
    const [v, id, mode] = JSON.parse(Buffer.from(cursor, "base64url").toString()) as [
      string | number | null,
      string,
      string | undefined,
    ];
    const kind = field === "relevance" ? "number" : "string";
    if (typeof id !== "string" || (v !== null && typeof v !== kind)) throw new Error();
    if (field === "relevance" && v === null) throw new Error();
    const value =
      typeof v === "string" && field !== "relevance" && DATE_SORTS.has(field) ? new Date(v) : v;
    if (value instanceof Date && Number.isNaN(value.getTime())) throw new Error();
    return { value, id, mode };
  } catch {
    throw new DataRoomConflictError("Invalid cursor");
  }
}

/**
 * ORDER BY and keyset condition for a sort: nulls last in both directions, ties by id ascending.
 * `column` and `idColumn` are SQL expressions for the sort value and the item id.
 */
function keysetSql(
  sort: DataRoomSort,
  cursor: string | undefined,
  column: Prisma.Sql,
  idColumn: Prisma.Sql,
  expectedMode?: string,
) {
  const nullable = SORT_NULLABLE[sort.field];
  const after = Prisma.raw(sort.direction === "asc" ? ">" : "<");
  const direction = Prisma.raw(sort.direction === "asc" ? "ASC" : "DESC");
  let where: Prisma.Sql | undefined;
  if (cursor) {
    const { value, id, mode } = decodeCursor(cursor, sort.field);
    if (expectedMode !== undefined && mode !== expectedMode) throw searchChanged();
    where =
      value === null
        ? Prisma.sql`(${column} IS NULL AND ${idColumn} > ${id})`
        : Prisma.sql`(${column} ${after} ${value} OR (${column} = ${value} AND ${idColumn} > ${id})${
            nullable ? Prisma.sql` OR ${column} IS NULL` : Prisma.empty
          })`;
  }
  const order = nullable
    ? Prisma.sql`${column} ${direction} NULLS LAST, ${idColumn} ASC`
    : Prisma.sql`${column} ${direction}, ${idColumn} ASC`;
  return { where, order };
}

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

export type DataRoomSortField = "date" | "name" | "type" | "createdAt";
export interface DataRoomSort {
  field: DataRoomSortField;
  direction: "asc" | "desc";
}
const SORT_COLUMN = {
  date: "docDate",
  name: "name",
  type: "docType",
  createdAt: "createdAt",
} as const;
/** docDate and docType may be null; those rows sort after the others in both directions. */
const SORT_NULLABLE = { date: true, name: false, type: true, createdAt: false } as const;

/** Where `getItem`-style lookups, lists and search all start, so visibility is defined once. */
export function createDataRoomRepos(prisma: PrismaClient) {
  async function requireFolder(
    actor: Actor,
    id: string,
    db: Pick<PrismaClient, "dataRoomFolder"> = prisma,
  ): Promise<DataRoomFolderRecord> {
    const folder = await db.dataRoomFolder.findFirst({
      where: { id, spaceId: actor.spaceId, userId: actor.userId },
    });
    if (!folder) throw new IsolationError();
    return folder;
  }

  async function requireItem(
    actor: Actor,
    id: string,
    db: Pick<PrismaClient, "dataRoomItem"> = prisma,
  ): Promise<DataRoomItemRecord> {
    const item = await db.dataRoomItem.findFirst({ where: { id, ...eligibleWhere(actor) } });
    if (!item) throw new IsolationError();
    return item;
  }

  /**
   * Runs `fn` in a transaction holding one lock per (space, user) folder tree, so folder creates,
   * moves and deletes serialize. Without it, two moves could each pass the cycle check and then
   * form a cycle, and a child could be added while its parent is being deleted.
   */
  function inFolderLock<T>(
    actor: Actor,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`data-room-folders:${actor.spaceId}:${actor.userId}`}, 0))`;
      return fn(tx);
    });
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
      return folderWrite(() =>
        inFolderLock(actor, async (tx) => {
          if (input.parentId) await requireFolder(actor, input.parentId, tx);
          return tx.dataRoomFolder.create({
            data: {
              spaceId: actor.spaceId,
              userId: actor.userId,
              parentId: input.parentId ?? null,
              name: input.name,
              createdBy: input.createdBy ?? "user",
            },
          });
        }),
      );
    },

    async renameFolder(actor: Actor, id: string, name: string) {
      return folderWrite(async () => {
        const { count } = await prisma.dataRoomFolder.updateMany({
          where: { id, spaceId: actor.spaceId, userId: actor.userId },
          data: { name },
        });
        if (!count) throw new IsolationError();
        return requireFolder(actor, id);
      });
    },

    async moveFolder(actor: Actor, id: string, parentId: string | null) {
      return folderWrite(() =>
        inFolderLock(actor, async (tx) => {
          if (parentId) {
            await requireFolder(actor, parentId, tx);
            // The new parent must not be the folder itself or one of its descendants. UNION (not
            // UNION ALL) stops the walk on any pre-existing cycle.
            const cycle = await tx.$queryRaw<{ id: string }[]>`
              WITH RECURSIVE sub AS (
                SELECT id FROM data_room_folders WHERE id = ${id} AND "spaceId" = ${actor.spaceId}
                  AND "userId" = ${actor.userId}
                UNION
                SELECT f.id FROM data_room_folders f JOIN sub ON f."parentId" = sub.id
                WHERE f."spaceId" = ${actor.spaceId} AND f."userId" = ${actor.userId}
              ) SELECT id FROM sub WHERE id = ${parentId}`;
            if (cycle.length) throw new DataRoomConflictError("A folder cannot move into itself");
          }
          const { count } = await tx.dataRoomFolder.updateMany({
            where: { id, spaceId: actor.spaceId, userId: actor.userId },
            data: { parentId },
          });
          if (!count) throw new IsolationError();
          return requireFolder(actor, id, tx);
        }),
      );
    },

    /** Refuses when the folder still holds folders or items; the caller moves or deletes them first. */
    async deleteFolder(actor: Actor, id: string) {
      await inFolderLock(actor, async (tx) => {
        await requireFolder(actor, id, tx);
        // Deliberately not owner-filtered: a row of any owner would be cascaded or orphaned.
        const [items, children] = await Promise.all([
          tx.dataRoomItem.count({ where: { folderId: id } }),
          tx.dataRoomFolder.count({ where: { parentId: id } }),
        ]);
        if (items || children) throw new DataRoomConflictError("Folder is not empty");
        await tx.dataRoomFolder.deleteMany({
          where: { id, spaceId: actor.spaceId, userId: actor.userId },
        });
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
      if (input.sourceConnectionId) {
        const connection = await prisma.connection.findFirst({
          where: { id: input.sourceConnectionId, spaceId: actor.spaceId, userId: actor.userId },
          select: { id: true },
        });
        if (!connection) throw new IsolationError();
      }
      try {
        const item = await inFolderLock(actor, async (tx) => {
          if (input.folderId) await requireFolder(actor, input.folderId, tx);
          return tx.dataRoomItem.create({
            data: { ...input, spaceId: actor.spaceId, userId: actor.userId },
          });
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

    /**
     * One page ordered in SQL by `sort`, ties broken by id ascending, with a keyset cursor that
     * stays correct under every sort. The cursor is opaque and only valid with the same sort.
     */
    async listItemsPage(
      actor: Actor,
      filters: DataRoomFilters,
      options: { sort?: DataRoomSort; limit?: number; cursor?: string } = {},
    ): Promise<{ items: DataRoomItemRecord[]; nextCursor: string | null }> {
      const sort = options.sort ?? { field: "createdAt", direction: "desc" };
      const limit = Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_LIMIT), 1), 100);
      const column = Prisma.raw(`i."${SORT_COLUMN[sort.field]}"`);
      const keyset = keysetSql(sort, options.cursor, column, Prisma.raw("i.id"));
      const parts = [eligibleSql(actor, filters), ...(keyset.where ? [keyset.where] : [])];
      const order = keyset.order;
      const rows = await prisma.$queryRaw<{ id: string; sortValue: Date | string | null }[]>`
        SELECT i.id, ${column} AS "sortValue" FROM data_room_items i
        WHERE ${Prisma.join(parts, " AND ")}
        ORDER BY ${order}
        LIMIT ${limit + 1}`;
      const pageRows = rows.slice(0, limit);
      const records = await prisma.dataRoomItem.findMany({
        where: { id: { in: pageRows.map((row) => row.id) }, ...eligibleWhere(actor) },
      });
      const byId = new Map(records.map((record) => [record.id, record]));
      const last = pageRows.at(-1);
      return {
        items: pageRows.flatMap((row) => byId.get(row.id) ?? []),
        nextCursor: rows.length > limit && last ? encodeCursor(last.sortValue, last.id) : null,
      };
    },

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
      const { count } = await prisma.dataRoomItem.updateMany({
        where: { id, ...eligibleWhere(actor) },
        data: patch,
      });
      if (!count) throw new IsolationError();
      return requireItem(actor, id);
    },

    async moveItem(actor: Actor, id: string, folderId: string | null) {
      return inFolderLock(actor, async (tx) => {
        if (folderId) await requireFolder(actor, folderId, tx);
        const { count } = await tx.dataRoomItem.updateMany({
          where: { id, ...eligibleWhere(actor) },
          data: { folderId },
        });
        if (!count) throw new IsolationError();
        return requireItem(actor, id, tx);
      });
    },

    /** Deletes the item and (by cascade) its chunks. The caller deletes the blob at storageKey. */
    async deleteItem(actor: Actor, id: string): Promise<{ storageKey: string | null }> {
      const item = await requireItem(actor, id);
      const { count } = await prisma.dataRoomItem.deleteMany({
        where: { id, ...eligibleWhere(actor) },
      });
      if (!count) throw new IsolationError();
      return { storageKey: item.storageKey };
    },

    /**
     * Makes the item's chunks equal `chunks`. A chunk is left alone (keeping its embedding) when its
     * contentHash is unchanged and, if `embeddingModel` is given, the stored embedding model equals
     * it. Otherwise the chunk is rewritten and loses its embedding so it is embedded again. With
     * `revision`, throws DataRoomStaleError (writing nothing) unless the item still has it.
     */
    async replaceChunks(
      actor: Actor,
      itemId: string,
      chunks: { ordinal: number; text: string; contentHash: string }[],
      options: { embeddingModel?: string; revision?: number } = {},
    ) {
      const model = options.embeddingModel ?? null;
      return prisma.$transaction(async (tx) => {
        // Lock the item so concurrent replacements run one after the other, each seeing a whole set.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM data_room_items
          WHERE id = ${itemId} AND "spaceId" = ${actor.spaceId} AND "userId" = ${actor.userId}
          FOR UPDATE`;
        if (!locked.length) throw new IsolationError();
        if (options.revision !== undefined) {
          // The row is locked above, so a stale step cannot write after this check.
          const live = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM data_room_items WHERE id = ${itemId} AND "spaceId" = ${actor.spaceId}
              AND "userId" = ${actor.userId} AND revision = ${options.revision} FOR UPDATE`;
          if (!live.length) throw new DataRoomStaleError();
        }
        const keep = chunks.map((chunk) => chunk.ordinal);
        const removed = await tx.dataRoomChunk.deleteMany({
          where: { itemId, spaceId: actor.spaceId, userId: actor.userId, ordinal: { notIn: keep } },
        });
        let written = 0;
        for (const chunk of chunks) {
          written += await tx.$executeRaw`
            INSERT INTO data_room_chunks (id, "spaceId", "userId", "itemId", ordinal, text, "contentHash")
            VALUES (${randomUUID()}, ${actor.spaceId}, ${actor.userId}, ${itemId}, ${chunk.ordinal},
              ${stripMarkers(chunk.text)}, ${chunk.contentHash})
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
     * Search, one page. Matching items are ordered in SQL, best chunk per item, then cut to the
     * limit: by relevance (keyset on score desc, item id) or by `sort` (same rules as
     * listItemsPage). The cursor is only valid with the same query, filters and sort.
     *
     * Without `vector` this is keyword search over every matching chunk. With one (and the
     * `embeddingModel` that produced it) a second leg ranks the owner's chunks embedded by that
     * same model by exact cosine distance. Each leg keeps its best 100 items; they are fused by
     * reciprocal rank fusion (k = 60) and the score is the fused score.
     * ponytail: scans every eligible chunk of one owner; add a vector/top-N stage if that grows.
     */
    async searchPage(
      actor: Actor,
      input: {
        query: string;
        vector?: number[];
        embeddingModel?: string;
        filters?: DataRoomFilters;
        sort?: DataRoomSort;
        limit?: number;
        cursor?: string;
      },
    ): Promise<{ results: DataRoomSearchResult[]; nextCursor: string | null }> {
      const query = input.query.trim();
      if (!query) return { results: [], nextCursor: null };
      const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
      const idColumn = Prisma.raw(`r."itemId"`);
      const vectorLiteral =
        input.vector && input.embeddingModel && input.vector.every(Number.isFinite)
          ? `[${input.vector.join(",")}]`
          : null;
      // A cursor only continues the search that made it: scores differ between the two modes.
      const mode = vectorLiteral ? `hybrid:${input.embeddingModel}` : "keyword";
      let where: Prisma.Sql | undefined;
      let order: Prisma.Sql;
      if (input.sort) {
        ({ where, order } = keysetSql(
          input.sort,
          input.cursor,
          Prisma.raw(`r."${SORT_COLUMN[input.sort.field]}"`),
          idColumn,
          mode,
        ));
      } else {
        if (input.cursor) {
          const { value, id, mode: cursorMode } = decodeCursor(input.cursor, "relevance");
          if (cursorMode !== mode) throw searchChanged();
          where = Prisma.sql`(r.rank < ${value} OR (r.rank = ${value} AND r."itemId" > ${id}))`;
        }
        order = Prisma.sql`r.rank DESC, r."itemId" ASC`;
      }
      const eligible = eligibleSql(actor, input.filters);
      const keywordBest = Prisma.sql`
        SELECT DISTINCT ON (c."itemId") c."itemId", c.ordinal, c.text,
          ts_rank_cd(c.tsv, q.tsq)::float8 AS rank
        FROM data_room_chunks c
        JOIN data_room_items i ON i.id = c."itemId", q
        WHERE c."spaceId" = ${actor.spaceId} AND c."userId" = ${actor.userId}
          AND ${eligible}
          AND c.tsv @@ q.tsq
        ORDER BY c."itemId", rank DESC, c.ordinal`;
      const best = vectorLiteral
        ? Prisma.sql`
          kw AS (
            SELECT b.*, row_number() OVER (ORDER BY b.rank DESC, b."itemId") AS pos
            FROM (${keywordBest}) b
            ORDER BY pos LIMIT ${LEG_SQL}
          ),
          vec AS (
            SELECT d.*, row_number() OVER (ORDER BY d.dist, d."itemId") AS pos
            FROM (
              SELECT DISTINCT ON (c."itemId") c."itemId", c.ordinal, c.text,
                (c.embedding <=> ${vectorLiteral}::vector)::float8 AS dist
              FROM data_room_chunks c
              JOIN data_room_items i ON i.id = c."itemId"
              WHERE c."spaceId" = ${actor.spaceId} AND c."userId" = ${actor.userId}
                AND ${eligible}
                AND c.embedding IS NOT NULL AND c."embeddingModel" = ${input.embeddingModel}
              ORDER BY c."itemId", dist, c.ordinal
            ) d
            ORDER BY pos LIMIT ${LEG_SQL}
          ),
          best AS (
            SELECT COALESCE(k."itemId", v."itemId") AS "itemId",
              COALESCE(k.ordinal, v.ordinal) AS ordinal, COALESCE(k.text, v.text) AS text,
              (COALESCE(1.0 / (${RRF_SQL} + k.pos), 0) + COALESCE(1.0 / (${RRF_SQL} + v.pos), 0))::float8
                AS rank
            FROM kw k FULL JOIN vec v ON k."itemId" = v."itemId"
          )`
        : Prisma.sql`best AS (${keywordBest})`;
      const rows = await prisma.$queryRaw<
        {
          itemId: string;
          ordinal: number;
          rank: number;
          snippet: string;
          sortValue: Date | string | number | null;
        }[]
      >`
        WITH q AS (SELECT websearch_to_tsquery('english', ${query}) AS tsq),
        ${best},
        r AS (
          SELECT b.*, i."docDate", i."name", i."docType", i."createdAt"
          FROM best b JOIN data_room_items i ON i.id = b."itemId"
        ),
        page AS (
          SELECT r.* FROM r
          ${where ? Prisma.sql`WHERE ${where}` : Prisma.empty}
          ORDER BY ${order}
          LIMIT ${limit + 1}
        )
        SELECT r."itemId", r.ordinal, r.rank,
          ts_headline('english', r.text, q.tsq, ${HEADLINE_OPTIONS}::text) AS snippet,
          ${input.sort ? Prisma.raw(`r."${SORT_COLUMN[input.sort.field]}"`) : Prisma.sql`r.rank`} AS "sortValue"
        FROM page r, q
        ORDER BY ${order}`;
      const pageRows = rows.slice(0, limit);
      const items = await prisma.dataRoomItem.findMany({
        where: { id: { in: pageRows.map((row) => row.itemId) }, ...eligibleWhere(actor) },
      });
      const byId = new Map(items.map((item) => [item.id, item]));
      const last = pageRows.at(-1);
      return {
        results: pageRows.flatMap((row) => {
          const item = byId.get(row.itemId);
          return item
            ? [{ item, ordinal: row.ordinal, snippet: row.snippet, score: row.rank }]
            : [];
        }),
        nextCursor:
          rows.length > limit && last
            ? encodeCursor(input.sort ? last.sortValue : last.rank, last.itemId, mode)
            : null,
      };
    },

    // --- Pipeline writes. Each takes the revision the step read and writes only if it still holds.

    /** The item, or null when it is gone or not the actor's. Jobs use this instead of throwing. */
    findItem: (actor: Actor, id: string) =>
      prisma.dataRoomItem.findFirst({ where: { id, ...eligibleWhere(actor) } }),

    async getItemText(actor: Actor, id: string): Promise<string | null> {
      const row = await prisma.dataRoomItemText.findFirst({
        where: { itemId: id, spaceId: actor.spaceId, userId: actor.userId },
        select: { text: true },
      });
      return row?.text ?? null;
    },

    /**
     * Applies `data` and bumps the revision when the item still has `revision`. Returns false when
     * it was changed or deleted since, in which case nothing is written.
     */
    async stepWrite(
      actor: Actor,
      id: string,
      revision: number,
      data: Partial<Pick<DataRoomItemRecord, "status" | "error" | "failures">>,
    ): Promise<boolean> {
      const { count } = await prisma.dataRoomItem.updateMany({
        where: { id, ...eligibleWhere(actor), revision },
        data: { ...data, leaseUntil: null, revision: { increment: 1 } },
      });
      return count === 1;
    },

    /**
     * Claims the item for a step in one statement: it must be in one of the `runnable` statuses
     * and not leased. The claim sets `active`, bumps the revision and holds the lease for
     * `DATA_ROOM_LEASE_MS`. Returns the claimed item, or null when it is gone, in another state,
     * or held by a running step. Every later write of the step passes the returned revision.
     */
    async claimStep(
      actor: Actor,
      id: string,
      runnable: readonly string[],
      active: string,
    ): Promise<DataRoomItemRecord | null> {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE data_room_items SET status = ${active}, revision = revision + 1,
          "leaseUntil" = now() + (${DATA_ROOM_LEASE_MS}::int * interval '1 millisecond'),
          "updatedAt" = now()
        WHERE id = ${id} AND "spaceId" = ${actor.spaceId} AND "userId" = ${actor.userId}
          AND status = ANY(${[...runnable]}::text[])
          AND ("leaseUntil" IS NULL OR "leaseUntil" < now())
        RETURNING id`;
      return rows.length
        ? prisma.dataRoomItem.findFirst({ where: { id, ...eligibleWhere(actor) } })
        : null;
    },

    /** Saves the extracted text and moves the item on to classification. */
    async finishExtraction(actor: Actor, id: string, revision: number, text: string) {
      return prisma.$transaction(async (tx) => {
        const { count } = await tx.dataRoomItem.updateMany({
          where: { id, ...eligibleWhere(actor), revision },
          data: {
            status: "classifying",
            error: null,
            failures: 0,
            leaseUntil: null,
            revision: { increment: 1 },
          },
        });
        if (count !== 1) return false;
        await tx.dataRoomItemText.upsert({
          where: { itemId: id },
          create: { itemId: id, spaceId: actor.spaceId, userId: actor.userId, text },
          update: { text },
        });
        return true;
      });
    },

    /**
     * Writes the facets and moves the item on to indexing. `folderPath` files an item that sits in
     * no folder: each missing folder on the path is created (`createdBy: "agent"`) under the folder
     * lock. An item already in a folder stays there.
     */
    async finishClassification(
      actor: Actor,
      id: string,
      revision: number,
      result: {
        facets: Partial<
          Pick<
            DataRoomItemRecord,
            "docType" | "docDate" | "parties" | "amountCents" | "currency" | "tags" | "summary"
          >
        >;
        folderPath?: string[];
      },
    ) {
      return inFolderLock(actor, async (tx) => {
        const { count } = await tx.dataRoomItem.updateMany({
          where: { id, ...eligibleWhere(actor), revision },
          data: {
            ...result.facets,
            classifiedAt: new Date(),
            status: "indexing",
            error: null,
            failures: 0,
            leaseUntil: null,
            revision: { increment: 1 },
          },
        });
        if (count !== 1) return false;
        const item = await tx.dataRoomItem.findFirst({
          where: { id, ...eligibleWhere(actor) },
          select: { folderId: true },
        });
        if (item?.folderId === null && result.folderPath?.length) {
          let parentId: string | null = null;
          for (const name of result.folderPath) {
            const existing: { id: string } | null = await tx.dataRoomFolder.findFirst({
              where: { spaceId: actor.spaceId, userId: actor.userId, parentId, name },
              select: { id: true },
            });
            parentId =
              existing?.id ??
              (
                await tx.dataRoomFolder.create({
                  data: {
                    spaceId: actor.spaceId,
                    userId: actor.userId,
                    parentId,
                    name,
                    createdBy: "agent",
                  },
                })
              ).id;
          }
          await tx.dataRoomItem.updateMany({
            where: { id, ...eligibleWhere(actor), folderId: null },
            data: { folderId: parentId },
          });
        }
        return true;
      });
    },

    /**
     * Starts a stuck upload over: a `pending` or `failed` item goes back to `pending` with its
     * failure count cleared. Returns false for any other status.
     */
    async restartItem(actor: Actor, id: string): Promise<boolean> {
      const { count } = await prisma.dataRoomItem.updateMany({
        where: { id, ...eligibleWhere(actor), status: { in: ["pending", "failed"] } },
        data: { status: "pending", error: null, failures: 0, revision: { increment: 1 } },
      });
      return count === 1;
    },

    /** Chunks of the item that have no embedding yet, in order. */
    async unembeddedChunks(actor: Actor, itemId: string) {
      return prisma.$queryRaw<{ ordinal: number; text: string; contentHash: string }[]>`
        SELECT ordinal, text, "contentHash" FROM data_room_chunks
        WHERE "itemId" = ${itemId} AND "spaceId" = ${actor.spaceId} AND "userId" = ${actor.userId}
          AND embedding IS NULL
        ORDER BY ordinal`;
    },

    /** Stores vectors for chunks whose text is still the text that was embedded, only while the item still has `revision`. */
    async saveEmbeddings(
      actor: Actor,
      itemId: string,
      model: string,
      embeddings: { ordinal: number; contentHash: string; vector: number[] }[],
      revision: number,
    ) {
      for (const e of embeddings) {
        await prisma.$executeRaw`
          UPDATE data_room_chunks c SET embedding = ${`[${e.vector.join(",")}]`}::vector,
            "embeddingModel" = ${model}
          FROM data_room_items i
          WHERE i.id = c."itemId" AND i.revision = ${revision}
            AND c."itemId" = ${itemId} AND c."spaceId" = ${actor.spaceId}
            AND c."userId" = ${actor.userId}
            AND c.ordinal = ${e.ordinal} AND c."contentHash" = ${e.contentHash}`;
      }
    },

    /**
     * Sends ready items back to a pipeline step and returns their ids. "ingest": image items with
     * no text (vision was skipped). "classify": items whose
     * classification was skipped. "index": items with a chunk that has no embedding, or (when
     * `embeddingModel` is given) one embedded by another model.
     */
    async requeueReady(
      actor: Actor,
      step: "ingest" | "classify" | "index",
      embeddingModel?: string,
    ): Promise<string[]> {
      const rows =
        step === "ingest"
          ? await prisma.$queryRaw<{ id: string }[]>`
              SELECT i.id FROM data_room_items i
              WHERE ${eligibleSql(actor, { status: "ready" })} AND i."mimeType" LIKE 'image/%'
                AND EXISTS (SELECT 1 FROM data_room_item_texts t WHERE t."itemId" = i.id
                  AND t.text = '')`
          : step === "classify"
            ? await prisma.$queryRaw<{ id: string }[]>`
              SELECT i.id FROM data_room_items i
              WHERE ${eligibleSql(actor, { status: "ready" })} AND i."classifiedAt" IS NULL
                AND EXISTS (SELECT 1 FROM data_room_item_texts t WHERE t."itemId" = i.id
                  AND t.text <> '')`
            : await prisma.$queryRaw<{ id: string }[]>`
              SELECT i.id FROM data_room_items i
              WHERE ${eligibleSql(actor, { status: "ready" })}
                AND EXISTS (SELECT 1 FROM data_room_chunks c WHERE c."itemId" = i.id
                  AND (c.embedding IS NULL
                    OR (${embeddingModel ?? null}::text IS NOT NULL
                      AND c."embeddingModel" IS DISTINCT FROM ${embeddingModel ?? null}::text)))`;
      if (!rows.length) return [];
      // Only the rows this statement moved: an item that left `ready` in between is not returned.
      const moved = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE data_room_items SET status = ${{ ingest: "pending", classify: "classifying", index: "indexing" }[step]},
          failures = 0, revision = revision + 1, "updatedAt" = now()
        WHERE id = ANY(${rows.map((r) => r.id)}::text[]) AND "spaceId" = ${actor.spaceId}
          AND "userId" = ${actor.userId} AND status = 'ready'
        RETURNING id`;
      return moved.map((r) => r.id);
    },

    /** Ready items among `ids` go back to indexing (their name or folder changed). Returns the moved ids. */
    async reindexItems(actor: Actor, ids: string[]): Promise<string[]> {
      if (!ids.length) return [];
      const moved = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE data_room_items SET status = 'indexing', failures = 0, revision = revision + 1,
          "updatedAt" = now()
        WHERE id = ANY(${ids}::text[]) AND "spaceId" = ${actor.spaceId}
          AND "userId" = ${actor.userId} AND status = 'ready'
        RETURNING id`;
      return moved.map((r) => r.id);
    },

    /**
     * Moves up to `limit` ready items in the folder and all its subfolders back to indexing and
     * returns their ids. Call again until fewer than `limit` come back.
     */
    async reindexFolder(actor: Actor, folderId: string, limit: number): Promise<string[]> {
      const moved = await prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE sub AS (
          SELECT id FROM data_room_folders WHERE id = ${folderId} AND "spaceId" = ${actor.spaceId}
            AND "userId" = ${actor.userId}
          UNION
          SELECT f.id FROM data_room_folders f JOIN sub ON f."parentId" = sub.id
          WHERE f."spaceId" = ${actor.spaceId} AND f."userId" = ${actor.userId}
        )
        UPDATE data_room_items SET status = 'indexing', failures = 0, revision = revision + 1,
          "updatedAt" = now()
        WHERE id IN (
          SELECT i.id FROM data_room_items i
          WHERE i."spaceId" = ${actor.spaceId} AND i."userId" = ${actor.userId}
            AND i.status = 'ready' AND i."folderId" IN (SELECT id FROM sub)
          LIMIT ${limit})
        RETURNING id`;
      return moved.map((r) => r.id);
    },

    /** The best matches without paging. */
    async searchKeyword(
      actor: Actor,
      input: {
        query: string;
        vector?: number[];
        embeddingModel?: string;
        filters?: DataRoomFilters;
        limit?: number;
      },
    ): Promise<DataRoomSearchResult[]> {
      return (await this.searchPage(actor, input)).results;
    },
  };
}
