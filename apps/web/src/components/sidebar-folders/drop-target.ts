import type { SidebarItemRef } from "@rakazo/contracts";

/** What the sidebar shows right now, in order; the drag handlers resolve drops against it. */
export type SidebarLayout = {
  /** Folder ids in display order. */
  folders: readonly string[];
  /** Visible items per container, in order: a folder id, or `root`. */
  containers: Readonly<Record<string, readonly SidebarItemRef[]>>;
};

export const ROOT_CONTAINER = "root";
/** The empty strip after the last row; dropping there moves an item to the end of the root. */
export const ROOT_END_ID = "root-end";

export const itemDragId = (item: SidebarItemRef) => `${item.kind}:${item.id}`;
export const folderDragId = (folderId: string) => `folder:${folderId}`;
export const parseItemDragId = (id: string): SidebarItemRef | null => {
  const [kind, ...rest] = id.split(":");
  return (kind === "bot" || kind === "group") && rest.length > 0
    ? { kind, id: rest.join(":") }
    : null;
};
const parseFolderDragId = (id: string) => (id.startsWith("folder:") ? id.slice(7) : null);

export type DropResult =
  | {
      type: "item";
      item: SidebarItemRef;
      folderId: string | null;
      beforeItem: SidebarItemRef | null;
    }
  | { type: "folder"; folderId: string; beforeFolderId: string | null };

const same = (a: SidebarItemRef, b: SidebarItemRef) => a.kind === b.kind && a.id === b.id;

function containerOf(layout: SidebarLayout, item: SidebarItemRef): string | null {
  for (const [container, items] of Object.entries(layout.containers)) {
    if (items.some((candidate) => same(candidate, item))) return container;
  }
  return null;
}

/**
 * Turns a drag of `activeId` that ended over `overId` into the move to send, or null when the drop
 * changes nothing. A folder header takes the item into that folder (last); a row puts the item
 * before it when it comes from elsewhere, and in its place when it is in the same list.
 */
export function resolveDrop(
  activeId: string,
  overId: string,
  layout: SidebarLayout,
): DropResult | null {
  if (activeId === overId) return null;
  const activeFolder = parseFolderDragId(activeId);
  if (activeFolder) {
    // A folder only moves among folders; a row inside a folder stands for that folder.
    const overItem = parseItemDragId(overId);
    const overFolder =
      parseFolderDragId(overId) ?? (overItem ? containerOf(layout, overItem) : null);
    if (!overFolder || overFolder === ROOT_CONTAINER || overFolder === activeFolder) return null;
    const from = layout.folders.indexOf(activeFolder);
    const to = layout.folders.indexOf(overFolder);
    if (from < 0 || to < 0) return null;
    const beforeFolderId = from < to ? (layout.folders[to + 1] ?? null) : overFolder;
    return { type: "folder", folderId: activeFolder, beforeFolderId };
  }

  const item = parseItemDragId(activeId);
  if (!item) return null;
  const source = containerOf(layout, item);
  const overFolder = parseFolderDragId(overId);
  if (overFolder) {
    if (overFolder === source) return null;
    return { type: "item", item, folderId: overFolder, beforeItem: null };
  }
  if (overId === ROOT_END_ID) {
    const root = layout.containers[ROOT_CONTAINER] ?? [];
    if (source === ROOT_CONTAINER && root.length > 0 && same(root[root.length - 1]!, item)) {
      return null;
    }
    return { type: "item", item, folderId: null, beforeItem: null };
  }
  const over = parseItemDragId(overId);
  if (!over) return null;
  const target = containerOf(layout, over);
  if (!target) return null;
  const folderId = target === ROOT_CONTAINER ? null : target;
  const list = layout.containers[target] ?? [];
  if (source !== target) return { type: "item", item, folderId, beforeItem: over };
  const from = list.findIndex((candidate) => same(candidate, item));
  const to = list.findIndex((candidate) => same(candidate, over));
  if (from < 0 || to < 0) return null;
  // Dragging down lands after the row it is over; dragging up lands before it.
  const beforeItem = from < to ? (list[to + 1] ?? null) : over;
  return { type: "item", item, folderId, beforeItem };
}
