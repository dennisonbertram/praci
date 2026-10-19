import { randomUUID } from "node:crypto";
import type { Actor, AutoSortOperation } from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "./client.js";
import { eligibleWhere, lockFolderTree } from "./data-room.js";

type Tx = Prisma.TransactionClient;
type Change = { kind: string; targetId: string; before: object; after: object };

export interface AutoSortApplied {
  batchId: string;
  /** Items whose name or folder path changed, including those under a re-parented folder. */
  itemIds: string[];
  skipped: { key: string; reason: string }[];
}

const TX = { timeout: 60_000, maxWait: 10_000 } as const;

/**
 * Applies a reviewed tidy-up and records every step under one batch id so `undo` can reverse it.
 * Each operation is checked against the current rows first; one that no longer matches is skipped.
 * Nothing here deletes an item. A folder is deleted only after a merge emptied it.
 */
export function createDataRoomAutoSortRepos(prisma: PrismaClient) {
  const folderWhere = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });

  async function descendantIds(tx: Tx, actor: Actor, rootId: string): Promise<Set<string>> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE sub AS (
        SELECT id FROM data_room_folders WHERE id = ${rootId} AND "spaceId" = ${actor.spaceId}
          AND "userId" = ${actor.userId}
        UNION
        SELECT f.id FROM data_room_folders f JOIN sub ON f."parentId" = sub.id
        WHERE f."spaceId" = ${actor.spaceId} AND f."userId" = ${actor.userId}
      ) SELECT id FROM sub`;
    return new Set(rows.map((row) => row.id));
  }

  /** Items in the folders and everything under them: their path changed when a folder moved. */
  async function itemsUnder(tx: Tx, actor: Actor, folderIds: string[]): Promise<string[]> {
    if (!folderIds.length) return [];
    const rows = await tx.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE sub AS (
        SELECT id FROM data_room_folders WHERE id = ANY(${folderIds}::text[])
          AND "spaceId" = ${actor.spaceId} AND "userId" = ${actor.userId}
        UNION
        SELECT f.id FROM data_room_folders f JOIN sub ON f."parentId" = sub.id
        WHERE f."spaceId" = ${actor.spaceId} AND f."userId" = ${actor.userId}
      ) SELECT i.id FROM data_room_items i WHERE i."folderId" IN (SELECT id FROM sub)
        AND i."spaceId" = ${actor.spaceId} AND i."userId" = ${actor.userId}`;
    return rows.map((row) => row.id);
  }

  return {
    async apply(
      actor: Actor,
      operations: AutoSortOperation[],
      by: "user" | "agent" = "user",
    ): Promise<AutoSortApplied> {
      const batchId = randomUUID();
      const changes: Change[] = [];
      const itemIds = new Set<string>();
      const movedFolderIds: string[] = [];
      const skipped: AutoSortApplied["skipped"] = [];
      /** Folders a merge removed, and where their contents went. */
      const redirect = new Map<string, string>();
      const resolve = (id: string | null): string | null => {
        let current = id;
        while (current !== null && redirect.has(current)) current = redirect.get(current) ?? null;
        return current;
      };

      async function mergeInto(tx: Tx, fromId: string, intoId: string) {
        const children = await tx.dataRoomFolder.findMany({
          where: { ...folderWhere(actor), parentId: fromId },
        });
        for (const child of children) {
          const twin = await tx.dataRoomFolder.findFirst({
            where: { ...folderWhere(actor), parentId: intoId, name: child.name },
          });
          if (twin) {
            await mergeInto(tx, child.id, twin.id);
          } else {
            await tx.dataRoomFolder.update({ where: { id: child.id }, data: { parentId: intoId } });
            changes.push({
              kind: "move_folder",
              targetId: child.id,
              before: { parentId: fromId },
              after: { parentId: intoId },
            });
            movedFolderIds.push(child.id);
          }
        }
        const items = await tx.dataRoomItem.findMany({
          where: { ...eligibleWhere(actor), folderId: fromId },
          select: { id: true },
        });
        for (const { id } of items) {
          await tx.dataRoomItem.update({ where: { id }, data: { folderId: intoId } });
          changes.push({
            kind: "move_item",
            targetId: id,
            before: { folderId: fromId },
            after: { folderId: intoId },
          });
          itemIds.add(id);
        }
        // Not owner-filtered, like deleteFolder: a row of any owner would be cascaded or orphaned.
        const [left, kids] = await Promise.all([
          tx.dataRoomItem.count({ where: { folderId: fromId } }),
          tx.dataRoomFolder.count({ where: { parentId: fromId } }),
        ]);
        if (left || kids) return;
        const folder = await tx.dataRoomFolder.findFirstOrThrow({
          where: { id: fromId, ...folderWhere(actor) },
        });
        await tx.dataRoomFolder.delete({ where: { id: fromId } });
        changes.push({
          kind: "delete_folder",
          targetId: fromId,
          before: { name: folder.name, parentId: folder.parentId, createdBy: folder.createdBy },
          after: {},
        });
        redirect.set(fromId, intoId);
      }

      async function ensurePath(tx: Tx, path: string[]): Promise<string> {
        let parentId: string | null = null;
        for (const name of path) {
          const found: { id: string } | null = await tx.dataRoomFolder.findFirst({
            where: { ...folderWhere(actor), parentId, name },
            select: { id: true },
          });
          if (found) {
            parentId = found.id;
            continue;
          }
          const created: { id: string } = await tx.dataRoomFolder.create({
            data: { ...folderWhere(actor), parentId, name, createdBy: by },
          });
          changes.push({
            kind: "create_folder",
            targetId: created.id,
            before: {},
            after: { name, parentId },
          });
          parentId = created.id;
        }
        return parentId as string;
      }

      await prisma.$transaction(async (tx) => {
        await lockFolderTree(tx, actor);
        const skip = (key: string, reason: string) => skipped.push({ key, reason });

        for (const op of operations) {
          if (op.type !== "merge_folder") continue;
          const [from, into] = await Promise.all([
            tx.dataRoomFolder.findFirst({ where: { id: op.folderId, ...folderWhere(actor) } }),
            tx.dataRoomFolder.findFirst({ where: { id: op.intoFolderId, ...folderWhere(actor) } }),
          ]);
          if (!from || !into || from.id === into.id) {
            skip(op.key, "A folder changed since the plan was made.");
          } else if ((await descendantIds(tx, actor, from.id)).has(into.id)) {
            skip(op.key, "A folder cannot merge into its own sub-folder.");
          } else {
            await mergeInto(tx, from.id, into.id);
          }
        }

        for (const op of operations) {
          if (op.type !== "move_item") continue;
          const item = await tx.dataRoomItem.findFirst({
            where: { id: op.itemId, ...eligibleWhere(actor) },
            select: { folderId: true },
          });
          if (
            !item ||
            (item.folderId !== op.fromFolderId && item.folderId !== resolve(op.fromFolderId))
          ) {
            skip(op.key, "The item changed since the plan was made.");
            continue;
          }
          const toId = await ensurePath(tx, op.toPath);
          if (toId === item.folderId) continue;
          await tx.dataRoomItem.update({ where: { id: op.itemId }, data: { folderId: toId } });
          changes.push({
            kind: "move_item",
            targetId: op.itemId,
            before: { folderId: item.folderId },
            after: { folderId: toId },
          });
          itemIds.add(op.itemId);
        }

        for (const op of operations) {
          if (op.type !== "rename_item") continue;
          const { count } = await tx.dataRoomItem.updateMany({
            where: { id: op.itemId, ...eligibleWhere(actor), name: op.fromName },
            data: { name: op.toName },
          });
          if (!count) {
            skip(op.key, "The item changed since the plan was made.");
            continue;
          }
          changes.push({
            kind: "rename_item",
            targetId: op.itemId,
            before: { name: op.fromName },
            after: { name: op.toName },
          });
          itemIds.add(op.itemId);
        }

        for (const id of await itemsUnder(tx, actor, movedFolderIds)) itemIds.add(id);
        if (changes.length) {
          await tx.dataRoomChange.createMany({
            data: changes.map((change, seq) => ({
              ...folderWhere(actor),
              batchId,
              seq,
              actor: by,
              kind: change.kind,
              targetId: change.targetId,
              before: change.before,
              after: change.after,
            })),
          });
        }
      }, TX);

      return { batchId, itemIds: [...itemIds], skipped };
    },

    /** Reverses a batch newest change first. A change whose rows moved on since is left as it is. */
    async undo(actor: Actor, batchId: string) {
      const itemIds = new Set<string>();
      const movedFolderIds: string[] = [];
      let restored = 0;
      let skipped = 0;
      await prisma.$transaction(async (tx) => {
        await lockFolderTree(tx, actor);
        const rows = await tx.dataRoomChange.findMany({
          where: { ...folderWhere(actor), batchId, undoneAt: null },
          orderBy: { seq: "desc" },
        });
        const done: string[] = [];
        for (const row of rows) {
          const before = row.before as {
            folderId?: string | null;
            name?: string;
            parentId?: string | null;
            createdBy?: string;
          };
          const after = row.after as typeof before;
          const folderExists = async (id: string | null | undefined) =>
            !id ||
            Boolean(
              await tx.dataRoomFolder.findFirst({
                where: { id, ...folderWhere(actor) },
                select: { id: true },
              }),
            );
          const taken = (parentId: string | null, name: string) =>
            tx.dataRoomFolder.findFirst({
              where: { ...folderWhere(actor), parentId, name },
              select: { id: true },
            });
          let ok = false;
          if (row.kind === "move_item") {
            ok =
              (await folderExists(before.folderId)) &&
              (
                await tx.dataRoomItem.updateMany({
                  where: {
                    id: row.targetId,
                    ...eligibleWhere(actor),
                    folderId: after.folderId ?? null,
                  },
                  data: { folderId: before.folderId ?? null },
                })
              ).count === 1;
            if (ok) itemIds.add(row.targetId);
          } else if (row.kind === "rename_item") {
            ok =
              (
                await tx.dataRoomItem.updateMany({
                  where: { id: row.targetId, ...eligibleWhere(actor), name: after.name },
                  data: { name: before.name },
                })
              ).count === 1;
            if (ok) itemIds.add(row.targetId);
          } else if (row.kind === "move_folder") {
            const folder = await tx.dataRoomFolder.findFirst({
              where: { id: row.targetId, ...folderWhere(actor) },
            });
            ok =
              folder?.parentId === (after.parentId ?? null) &&
              (await folderExists(before.parentId)) &&
              !(await taken(before.parentId ?? null, folder.name)) &&
              // The old parent may have ended up under this folder since: that would be a loop.
              !(
                before.parentId &&
                (await descendantIds(tx, actor, row.targetId)).has(before.parentId)
              );
            if (ok) {
              await tx.dataRoomFolder.update({
                where: { id: row.targetId },
                data: { parentId: before.parentId ?? null },
              });
              movedFolderIds.push(row.targetId);
            }
          } else if (row.kind === "delete_folder") {
            const name = before.name as string;
            ok =
              (await folderExists(before.parentId)) &&
              !(await taken(before.parentId ?? null, name));
            if (ok) {
              await tx.dataRoomFolder.create({
                data: {
                  id: row.targetId,
                  ...folderWhere(actor),
                  parentId: before.parentId ?? null,
                  name,
                  createdBy: before.createdBy ?? "agent",
                },
              });
            }
          } else if (row.kind === "create_folder") {
            const [items, kids] = await Promise.all([
              tx.dataRoomItem.count({ where: { folderId: row.targetId } }),
              tx.dataRoomFolder.count({ where: { parentId: row.targetId } }),
            ]);
            const { count } =
              items || kids
                ? { count: 0 }
                : await tx.dataRoomFolder.deleteMany({
                    where: { id: row.targetId, ...folderWhere(actor) },
                  });
            ok = count === 1;
          }
          if (ok) {
            restored += 1;
            done.push(row.id);
          } else {
            skipped += 1;
          }
        }
        for (const id of await itemsUnder(tx, actor, movedFolderIds)) itemIds.add(id);
        await tx.dataRoomChange.updateMany({
          where: { id: { in: done } },
          data: { undoneAt: new Date() },
        });
      }, TX);
      return { restored, skipped, itemIds: [...itemIds] };
    },
  };
}
