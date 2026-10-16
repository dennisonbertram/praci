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
