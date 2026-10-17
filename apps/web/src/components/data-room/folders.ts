import { plural, t } from "@lingui/core/macro";
import type { DataRoomApiFolder } from "@rakazo/contracts";

export type FolderNode = { folder: DataRoomApiFolder; depth: number; path: string };

/** The folders in tree order (children under their parent, by name), each with its "A / B" path. */
export function folderNodes(folders: DataRoomApiFolder[]): FolderNode[] {
  const byParent = new Map<string | null, DataRoomApiFolder[]>();
  const ids = new Set(folders.map((folder) => folder.id));
  for (const folder of folders) {
    // A folder whose parent is missing is shown at the top level.
    const parent = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), folder]);
  }
  const nodes: FolderNode[] = [];
  const walk = (parent: string | null, depth: number, prefix: string) => {
    const children = (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of children) {
      const path = prefix ? `${prefix} / ${folder.name}` : folder.name;
      nodes.push({ folder, depth, path });
      walk(folder.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return nodes;
}

/**
 * What a folder holds right inside it: "2 folders, 3 items", "3 items", or "Empty". Sub-folders
 * count too, so a parent that only holds folders never reads as empty.
 */
export function folderContents(folder: DataRoomApiFolder, all: DataRoomApiFolder[]): string {
  const folders = all.filter((other) => other.parentId === folder.id).length;
  const items = folder.itemCount ?? 0;
  const parts = [
    folders ? plural(folders, { one: "# folder", other: "# folders" }) : "",
    items ? plural(items, { one: "# item", other: "# items" }) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : t`Empty`;
}
