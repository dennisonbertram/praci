import type { Actor, BotSection, MoveSidebarItemInput, SidebarSnapshot } from "@rakazo/contracts";
import { autoGroupFolderName } from "@rakazo/contracts";
import type { SidebarPlaced } from "@rakazo/core";
import { planSidebarMove, sidebarContainer } from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import { isUniqueViolation } from "./prisma-errors.js";
import { BotSectionNameConflictError, IsolationError } from "./scope.js";

type Tx = Prisma.TransactionClient;
type Scope = Pick<Actor, "spaceId" | "userId">;

export function toBotSection(section: {
  id: string;
  name: string;
  position: number;
  collapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): BotSection {
  return {
    id: section.id,
    name: section.name,
    position: section.position,
    collapsed: section.collapsed,
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
  };
}

type Row = SidebarPlaced & {
  spawnKey: string | null;
  parentBotId: string | null;
  /** Last-activity time; sidebar writes pass it back so Prisma's @updatedAt does not bump it. */
  updatedAt: Date;
};

async function loadRows(tx: Tx, actor: Scope): Promise<Row[]> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId, archivedAt: null };
  const [bots, groups] = await Promise.all([
    tx.bot.findMany({
      where: scope,
      select: {
        id: true,
        sectionId: true,
        position: true,
        pinned: true,
        spawnKey: true,
        parentBotId: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    tx.chatGroup.findMany({
      where: scope,
      select: { id: true, sectionId: true, position: true, pinned: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return [
    ...bots.map((bot) => ({
      kind: "bot" as const,
      id: bot.id,
      sectionId: bot.sectionId,
      position: bot.position,
      pinned: bot.pinned,
      spawnKey: bot.spawnKey,
      parentBotId: bot.parentBotId,
      updatedAt: bot.updatedAt,
    })),
    ...groups.map((group) => ({
      kind: "group" as const,
      id: group.id,
      sectionId: group.sectionId,
      position: group.position,
      pinned: group.pinned,
      spawnKey: null,
      parentBotId: null,
      updatedAt: group.updatedAt,
    })),
  ];
}

/** Writes sectionId and a dense position for every row whose values changed. */
async function write(
  tx: Tx,
  actor: Scope,
  changes: Array<{ row: Row; sectionId: string | null; position: number }>,
) {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  await Promise.all(
    changes
      .filter(
        ({ row, sectionId, position }) => row.sectionId !== sectionId || row.position !== position,
      )
      .map(({ row, sectionId, position }) =>
        row.kind === "bot"
          ? tx.bot.updateMany({
              where: { id: row.id, ...scope },
              data: { sectionId, position, updatedAt: row.updatedAt },
            })
          : tx.chatGroup.updateMany({
              where: { id: row.id, ...scope },
              data: { sectionId, position, updatedAt: row.updatedAt },
            }),
      ),
  );
}

async function requireFolder(tx: Tx, actor: Scope, id: string) {
  const folder = await tx.botSection.findFirst({
    where: { id, spaceId: actor.spaceId, userId: actor.userId },
  });
  if (!folder) throw new IsolationError();
  return folder;
}

export async function addSidebarFolder(prisma: PrismaClient, actor: Scope, name: string) {
  const aggregate = await prisma.botSection.aggregate({
    where: { spaceId: actor.spaceId, userId: actor.userId },
    _max: { position: true },
  });
  try {
    return toBotSection(
      await prisma.botSection.create({
        data: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          name,
          position: (aggregate._max.position ?? -1) + 1,
        },
      }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new BotSectionNameConflictError();
    throw error;
  }
}

/** Deletes the folder only; its items go to the end of the root list in their folder order. */
export async function removeSidebarFolder(prisma: PrismaClient, actor: Scope, folderId: string) {
  await prisma.$transaction(async (tx) => {
    await requireFolder(tx, actor, folderId);
    const rows = await loadRows(tx, actor);
    const moved = sidebarContainer(rows, folderId);
    const root = sidebarContainer(rows, null);
    // Pinned items in the folder fall to the root through the foreign key (onDelete: SetNull).
    await tx.botSection.delete({ where: { id: folderId } });
    await write(
      tx,
      actor,
      [...root, ...moved].map((row, position) => ({ row, sectionId: null, position })),
    );
  });
}

export async function setSidebarFolderCollapsed(
  prisma: PrismaClient,
  actor: Scope,
  folderId: string,
  collapsed: boolean,
) {
  const { count } = await prisma.botSection.updateMany({
    where: { id: folderId, spaceId: actor.spaceId, userId: actor.userId },
    data: { collapsed },
  });
  if (count !== 1) throw new IsolationError();
  return toBotSection(await prisma.botSection.findUniqueOrThrow({ where: { id: folderId } }));
}

export async function moveSidebarItem(
  prisma: PrismaClient,
  actor: Scope,
  input: MoveSidebarItemInput,
) {
  await prisma.$transaction(async (tx) => {
    if (input.folderId) await requireFolder(tx, actor, input.folderId);
    const rows = await loadRows(tx, actor);
    const plan = planSidebarMove(rows, input);
    if (!plan) throw new IsolationError();
    await write(
      tx,
      actor,
      plan.map(({ item, ...placement }) => ({ row: item, ...placement })),
    );
  });
}

export async function moveSidebarFolder(
  prisma: PrismaClient,
  actor: Scope,
  folderId: string,
  beforeFolderId?: string | null,
) {
  await prisma.$transaction(async (tx) => {
    const folders = await tx.botSection.findMany({
      where: { spaceId: actor.spaceId, userId: actor.userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, position: true },
    });
    const moving = folders.find((folder) => folder.id === folderId);
    if (!moving) throw new IsolationError();
    const others = folders.filter((folder) => folder !== moving);
    const at = beforeFolderId
      ? others.findIndex((folder) => folder.id === beforeFolderId)
      : others.length;
    if (at < 0) throw new IsolationError();
    others.splice(at, 0, moving);
    await Promise.all(
      others.map((folder, position) =>
        folder.position === position
          ? undefined
          : tx.botSection.update({ where: { id: folder.id }, data: { position } }),
      ),
    );
  });
}

/**
 * Files every unfiled, unpinned item into Workspace / Apps / Agents / Groups, creating a folder
 * only when one by that name does not exist. Nothing is deleted. The snapshot restores it.
 */
export async function autoGroupSidebar(
  prisma: PrismaClient,
  actor: Scope,
): Promise<SidebarSnapshot> {
  return prisma.$transaction(async (tx) => {
    const rows = await loadRows(tx, actor);
    const nameOf = new Map<Row, string>();
    for (const row of sidebarContainer(rows, null)) {
      const name = autoGroupFolderName(row);
      if (name) nameOf.set(row, name);
    }
    const unfiled = [...nameOf.keys()];
    // A child follows its parent when the parent is moving too, so the tree stays together.
    for (const row of unfiled) {
      const parent = row.parentBotId
        ? unfiled.find((candidate) => candidate.kind === "bot" && candidate.id === row.parentBotId)
        : undefined;
      if (parent) nameOf.set(row, nameOf.get(parent)!);
    }
    const scope = { spaceId: actor.spaceId, userId: actor.userId };
    const folders = new Map(
      (await tx.botSection.findMany({ where: scope })).map((folder) => [folder.name, folder.id]),
    );
    const createdFolderIds: string[] = [];
    let nextPosition =
      (await tx.botSection.aggregate({ where: scope, _max: { position: true } }))._max.position ??
      -1;
    const snapshot: SidebarSnapshot["placements"] = [];
    for (const name of new Set(nameOf.values())) {
      let folderId = folders.get(name);
      if (!folderId) {
        folderId = (
          await tx.botSection.create({ data: { ...scope, name, position: ++nextPosition } })
        ).id;
        createdFolderIds.push(folderId);
      }
      const incoming = unfiled.filter((row) => nameOf.get(row) === name);
      const ordered = [...sidebarContainer(rows, folderId), ...incoming];
      for (const row of ordered) {
        const position = ordered.indexOf(row);
        if (row.sectionId !== folderId || row.position !== position) {
          snapshot.push({
            item: { kind: row.kind, id: row.id },
            folderId: row.sectionId,
            position: row.position ?? null,
          });
        }
      }
      await write(
        tx,
        actor,
        ordered.map((row, position) => ({ row, sectionId: folderId, position })),
      );
    }
    return { placements: snapshot, createdFolderIds };
  });
}

/** Puts items back where a snapshot says; folders the auto-group created go if now empty. */
export async function restoreSidebar(
  prisma: PrismaClient,
  actor: Scope,
  snapshot: SidebarSnapshot,
) {
  await prisma.$transaction(async (tx) => {
    const scope = { spaceId: actor.spaceId, userId: actor.userId };
    const folderIds = [
      ...new Set(snapshot.placements.flatMap(({ folderId }) => (folderId ? [folderId] : []))),
    ];
    if (folderIds.length > 0) {
      const owned = await tx.botSection.count({ where: { id: { in: folderIds }, ...scope } });
      if (owned !== folderIds.length) throw new IsolationError();
    }
    const ids = (kind: "bot" | "group") => ({
      where: {
        id: {
          in: snapshot.placements.filter(({ item }) => item.kind === kind).map((p) => p.item.id),
        },
        ...scope,
      },
      select: { id: true, updatedAt: true },
    });
    const [bots, groups] = await Promise.all([
      tx.bot.findMany(ids("bot")),
      tx.chatGroup.findMany(ids("group")),
    ]);
    const updatedAt = new Map([
      ...bots.map((row) => [`bot:${row.id}`, row.updatedAt] as const),
      ...groups.map((row) => [`group:${row.id}`, row.updatedAt] as const),
    ]);
    for (const { item, folderId, position } of snapshot.placements) {
      const kept = updatedAt.get(`${item.kind}:${item.id}`);
      if (!kept) throw new IsolationError();
      const { count } =
        item.kind === "bot"
          ? await tx.bot.updateMany({
              where: { id: item.id, ...scope },
              data: {
                sectionId: folderId,
                ...(position === null ? {} : { position }),
                updatedAt: kept,
              },
            })
          : await tx.chatGroup.updateMany({
              where: { id: item.id, ...scope },
              data: { sectionId: folderId, position, updatedAt: kept },
            });
      if (count !== 1) throw new IsolationError();
    }
    await tx.botSection.deleteMany({
      where: {
        id: { in: snapshot.createdFolderIds },
        ...scope,
        bots: { none: {} },
        groups: { none: {} },
      },
    });
  });
}
