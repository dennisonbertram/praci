/**
 * The sidebar's lists for one space: pinned items, then each folder in order, then the unfiled
 * rest. An item whose folder no longer exists counts as unfiled. Folders are kept even when empty.
 */
export function sidebarSections<T extends Placement, S extends { id: string }>(
  items: readonly T[],
  sections: readonly S[],
): { pinned: T[]; folders: Array<{ section: S; items: T[] }>; root: T[] } {
  const known = new Set(sections.map((section) => section.id));
  const placed = items.map((item) =>
    item.sectionId && !known.has(item.sectionId) ? { ...item, sectionId: null } : item,
  );
  return {
    pinned: placed.filter((item) => item.pinned),
    folders: sections.map((section) => ({ section, items: sidebarContainer(placed, section.id) })),
    root: sidebarContainer(placed, null),
  };
}

export function reorderBotTo<T extends { id: string }>(
  bots: readonly T[],
  sourceId: string,
  targetId: string,
): readonly T[] {
  const sourceIndex = bots.findIndex((bot) => bot.id === sourceId);
  const targetIndex = bots.findIndex((bot) => bot.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return bots;
  const reordered = [...bots];
  const [source] = reordered.splice(sourceIndex, 1);
  if (!source) return bots;
  reordered.splice(targetIndex, 0, source);
  return reordered;
}

export type RosterParentable = {
  id: string;
  parentBotId?: string | null;
};

export type NestedRosterRow<T> = {
  item: T;
  depth: number;
  hasChildren: boolean;
  /** Parent this row renders under, or null for a root; siblings share it. */
  parentId: string | null;
};

/**
 * Nest roster items by parentBotId within one section/list, then flatten for
 * rendering. Parents missing from the list (other section, filtered out) stay
 * roots. Collapsed parents hide all descendants.
 */
export function nestRosterByParent<T extends RosterParentable>(
  items: readonly T[],
  collapsedIds: ReadonlySet<string> = new Set(),
): NestedRosterRow<T>[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const children = new Map<string, T[]>();
  const roots: T[] = [];

  for (const item of items) {
    const parentId = item.parentBotId ?? null;
    if (parentId && byId.has(parentId) && parentId !== item.id) {
      const siblings = children.get(parentId) ?? [];
      siblings.push(item);
      children.set(parentId, siblings);
    } else {
      roots.push(item);
    }
  }

  const rows: NestedRosterRow<T>[] = [];
  const visited = new Set<string>();
  const markHidden = (item: T) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    for (const child of children.get(item.id) ?? []) markHidden(child);
  };
  const visit = (
    item: T,
    depth: number,
    parentId: string | null,
    ancestors: ReadonlySet<string>,
  ) => {
    if (ancestors.has(item.id) || visited.has(item.id)) return;
    visited.add(item.id);
    const kids = children.get(item.id) ?? [];
    rows.push({ item, depth, hasChildren: kids.length > 0, parentId });
    if (kids.length === 0) return;
    if (collapsedIds.has(item.id)) {
      for (const child of kids) markHidden(child);
      return;
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(item.id);
    for (const child of kids) visit(child, depth + 1, item.id, nextAncestors);
  };

  for (const root of roots) visit(root, 0, null, new Set());
  // Cycles leave no natural root; surface remaining items in source order.
  for (const item of items) {
    if (!visited.has(item.id)) visit(item, 0, null, new Set());
  }
  return rows;
}

/** An item the sidebar can place: a bot or a group, in a folder (sectionId) or at the root. */
type Placement = {
  sectionId: string | null;
  /** Null until ordered by hand; null items follow the positioned ones in list order. */
  position?: number | null;
  pinned: boolean;
};

export type SidebarPlaced = Placement & { kind: "bot" | "group"; id: string };

type ItemRef = { kind: "bot" | "group"; id: string };

/**
 * One folder's items (or the root's) in display order. Pass bots then groups in the order the
 * lists load; ties keep that order, so nothing moves until the user orders something by hand.
 * Pinned items show in their own list and are left out.
 */
export function sidebarContainer<T extends Placement>(
  items: readonly T[],
  sectionId: string | null,
): T[] {
  const at = (item: T) => item.position ?? Number.POSITIVE_INFINITY;
  return items
    .filter((item) => item.sectionId === sectionId && !item.pinned)
    .sort((a, b) => (at(a) === at(b) ? 0 : at(a) < at(b) ? -1 : 1));
}

/**
 * Where every item of the destination ends up after moving `item` into `folderId` before
 * `beforeItem` (or last): dense positions 0..n-1. Null when the item or the anchor is not found.
 */
export function planSidebarMove<T extends SidebarPlaced>(
  items: readonly T[],
  move: { item: ItemRef; folderId: string | null; beforeItem?: ItemRef | null },
): Array<{ item: T; sectionId: string | null; position: number }> | null {
  const same = (a: ItemRef) => (b: ItemRef) => a.kind === b.kind && a.id === b.id;
  const moving = items.find(same(move.item));
  if (!moving) return null;
  const others = sidebarContainer(items, move.folderId).filter((item) => item !== moving);
  const before = move.beforeItem;
  const index = before ? others.findIndex(same(before)) : others.length;
  if (index < 0) return null;
  others.splice(index, 0, moving);
  return others.map((item, position) => ({ item, sectionId: move.folderId, position }));
}
