import { createHash, randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { dataRoomBlobDeleteJob } from "@rakazo/adapter-kit";
import type {
  Actor,
  DataRoomApiFolder,
  DataRoomApiItem,
  DataRoomApiUploadResponse,
} from "@rakazo/contracts";
import { DATA_ROOM_UPLOAD_MAX_BYTES, DataRoomApiName } from "@rakazo/contracts";
import type {
  DataRoomFilters,
  DataRoomFolderRecord,
  DataRoomItemRecord,
  DataRoomSort,
} from "@rakazo/db";
import {
  createDataRoomRepos,
  DataRoomConflictError,
  IsolationError,
  type PrismaClient,
} from "@rakazo/db";
import type { Hono } from "hono";
import { cancelBody } from "./http-body.js";
import { contentDisposition, downloadType } from "./inbox-attachment.js";

export interface DataRoomDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
  /** Injectable so tests can use a small cap. */
  maxUploadBytes?: number;
}

export const folderDto = (folder: DataRoomFolderRecord): DataRoomApiFolder => ({
  id: folder.id,
  name: folder.name,
  parentId: folder.parentId,
  createdAt: folder.createdAt.toISOString(),
});

/** The storage key stays on the server. */
export const itemDto = (item: DataRoomItemRecord): DataRoomApiItem => ({
  id: item.id,
  name: item.name,
  mimeType: item.mimeType,
  size: item.size,
  folderId: item.folderId,
  source: item.source,
  status: item.status,
  error: item.error,
  facets: {
    docType: item.docType,
    docDate: item.docDate?.toISOString() ?? null,
    parties: item.parties,
    amountCents: item.amountCents === null ? null : Number(item.amountCents),
    currency: item.currency,
    tags: item.tags,
    summary: item.summary,
  },
  createdAt: item.createdAt.toISOString(),
});

/** A record the actor cannot see is "not found"; a folder name clash or cycle is a conflict. */
export async function dataRoomCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof IsolationError) throw new ORPCError("NOT_FOUND");
    if (error instanceof DataRoomConflictError) {
      throw new ORPCError("CONFLICT", { message: error.message });
    }
    throw error;
  }
}

function blobContext(actor: Actor, operation: string) {
  const operationId = `${operation}:${randomUUID()}`;
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: new AbortController().signal,
  };
}

const toFilters = (input: {
  folderId?: string | null;
  docDateFrom?: string;
  docDateTo?: string;
  [key: string]: unknown;
}): DataRoomFilters => {
  const { docDateFrom, docDateTo, ...rest } = input;
  return {
    ...(rest as DataRoomFilters),
    ...(docDateFrom ? { docDateFrom: new Date(docDateFrom) } : {}),
    ...(docDateTo ? { docDateTo: new Date(docDateTo) } : {}),
  };
};

const sortKey = (item: DataRoomApiItem, field: DataRoomSort["field"]) =>
  ({
    date: item.facets.docDate,
    name: item.name,
    type: item.facets.docType,
    createdAt: item.createdAt,
  })[field];

/** Orders an already bounded set of search hits like the item list: nulls last, ties by id. */
function sortHits<T extends { item: DataRoomApiItem }>(hits: T[], sort: DataRoomSort): T[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...hits].sort((a, b) => {
    const x = sortKey(a.item, sort.field);
    const y = sortKey(b.item, sort.field);
    if (x === y) return a.item.id < b.item.id ? -1 : 1;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x < y ? -1 : 1) * sign;
  });
}

/** Procedure bodies for `dataRoom.*`; the router adds the Actor. */
export function createDataRoomService(deps: DataRoomDeps) {
  const repo = createDataRoomRepos(deps.prisma);
  return {
    folders: async (actor: Actor) => (await repo.listFolders(actor)).map(folderDto),
    createFolder: (actor: Actor, input: { name: string; parentId?: string | null }) =>
      dataRoomCall(async () => folderDto(await repo.createFolder(actor, input))),
    renameFolder: (actor: Actor, input: { id: string; name: string }) =>
      dataRoomCall(async () => folderDto(await repo.renameFolder(actor, input.id, input.name))),
    moveFolder: (actor: Actor, input: { id: string; parentId: string | null }) =>
      dataRoomCall(async () => folderDto(await repo.moveFolder(actor, input.id, input.parentId))),
    deleteFolder: (actor: Actor, id: string) =>
      dataRoomCall(async () => {
        await repo.deleteFolder(actor, id);
        return { ok: true as const };
      }),

    items: (
      actor: Actor,
      input: { limit: number; cursor?: string; sort: DataRoomSort } & Parameters<
        typeof toFilters
      >[0],
    ) =>
      dataRoomCall(async () => {
        const { limit, cursor, sort, ...filters } = input;
        const page = await repo.listItemsPage(actor, toFilters(filters), { sort, limit, cursor });
        return { items: page.items.map(itemDto), nextCursor: page.nextCursor };
      }),
    item: (actor: Actor, id: string) =>
      dataRoomCall(async () => itemDto(await repo.getItem(actor, id))),
    renameItem: (actor: Actor, input: { id: string; name: string }) =>
      dataRoomCall(async () =>
        itemDto(await repo.updateItem(actor, input.id, { name: input.name })),
      ),
    moveItem: (actor: Actor, input: { id: string; folderId: string | null }) =>
      dataRoomCall(async () => itemDto(await repo.moveItem(actor, input.id, input.folderId))),
    deleteItem: (actor: Actor, id: string) =>
      dataRoomCall(async () => {
        const { storageKey } = await repo.deleteItem(actor, id);
        if (storageKey) await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, storageKey));
        return { ok: true as const };
      }),
    search: (
      actor: Actor,
      input: {
        query: string;
        limit: number;
        filters?: Parameters<typeof toFilters>[0];
        sort?: DataRoomSort;
      },
    ) =>
      dataRoomCall(async () => {
        const hits = (
          await repo.searchKeyword(actor, {
            query: input.query,
            limit: input.limit,
            filters: input.filters && toFilters(input.filters),
          })
        ).map((hit) => ({ ...hit, item: itemDto(hit.item) }));
        return input.sort ? sortHits(hits, input.sort) : hits;
      }),
  };
}

const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

/**
 * Reads the body into one buffer, hashing as it goes, and gives up (cancelling the body) the moment
 * it holds more than `max` bytes. Never holds more than `max` bytes plus one chunk.
 */
async function readCapped(request: Request, max: number) {
  const declared = request.headers.get("content-length");
  if (declared !== null && !request.headers.has("transfer-encoding") && Number(declared) > max) {
    cancelBody(request.body);
    return null;
  }
  const hash = createHash("sha256");
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
          cancelBody(reader);
          return null;
        }
        hash.update(value);
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  return { bytes: Buffer.concat(chunks), sha256: hash.digest("hex") };
}

/** Session-authenticated raw routes: streamed upload and forced-download of the stored bytes. */
export function mountDataRoomRoutes(
  app: Hono,
  deps: DataRoomDeps,
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  const repo = createDataRoomRepos(deps.prisma);
  const max = deps.maxUploadBytes ?? DATA_ROOM_UPLOAD_MAX_BYTES;

  app.post("/api/data-room/upload", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const reject = (message: string, status: 400 | 404 | 413) => {
      cancelBody(c.req.raw.body);
      return c.json({ error: message }, status);
    };

    const name = DataRoomApiName.safeParse(c.req.query("name"));
    if (!name.success) return reject("Invalid file name", 400);
    const folderId = c.req.query("folderId") || null;
    if (
      folderId &&
      !(await deps.prisma.dataRoomFolder.findFirst({
        where: { id: folderId, spaceId: actor.spaceId, userId: actor.userId },
        select: { id: true },
      }))
    ) {
      return reject("Folder not found", 404);
    }
    const mimeType = (c.req.header("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
    const type = mimeType && MIME.test(mimeType) ? mimeType : "application/octet-stream";

    const body = await readCapped(c.req.raw, max);
    if (!body) return c.json({ error: "File is too large." }, 413);

    const respond = (item: DataRoomItemRecord, duplicate: boolean) =>
      c.json(
        { item: itemDto(item), duplicate } satisfies DataRoomApiUploadResponse,
        duplicate ? 200 : 201,
      );

    const existing = await deps.prisma.dataRoomItem.findFirst({
      where: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        source: "upload",
        sha256: body.sha256,
      },
    });
    if (existing) return respond(existing, true);

    const stored = await deps.artifacts.put(
      { name: name.data, mimeType: type, bytes: body.bytes },
      blobContext(actor, "data-room.upload"),
    );
    const { item, created } = await dataRoomCall(() =>
      repo.createItem(actor, {
        source: "upload",
        sha256: body.sha256,
        name: name.data,
        mimeType: type,
        size: body.bytes.byteLength,
        storageKey: stored.id,
        folderId,
      }),
    ).catch(async (error: unknown) => {
      await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, stored.id));
      throw error;
    });
    // Lost a race with a concurrent identical upload: drop the blob this request stored.
    if (!created) await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, stored.id));
    return respond(item, !created);
  });

  app.get("/api/data-room/items/:id/content", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const item = await repo.getItem(actor, c.req.param("id")).catch((error: unknown) => {
      if (error instanceof IsolationError) return null;
      throw error;
    });
    if (!item?.storageKey) return c.json({ error: "Not found" }, 404);
    const bytes = await deps.artifacts.get(
      item.storageKey,
      blobContext(actor, "data-room.download"),
    );
    // Documents are untrusted: always a download, never active content on the API origin.
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": downloadType(item.mimeType),
        "content-length": String(bytes.byteLength),
        "content-disposition": contentDisposition(item.name),
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
        "cache-control": "private, no-store",
      },
    });
  });
}
