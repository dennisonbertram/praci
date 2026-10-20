import { describe, expect, it } from "vitest";
import type { SidebarLayout } from "./drop-target";
import { folderDragId, itemDragId, ROOT_END_ID, resolveDrop } from "./drop-target";

const bot = (id: string) => ({ kind: "bot" as const, id });
const group = (id: string) => ({ kind: "group" as const, id });
const layout: SidebarLayout = {
  folders: ["f1", "f2"],
  containers: {
    f1: [bot("a"), bot("b"), bot("c")],
    f2: [group("g")],
    root: [bot("r1"), bot("r2")],
  },
};
const drop = (active: string, over: string) => resolveDrop(active, over, layout);

describe("resolveDrop", () => {
  it("puts a row dragged down after the row it is over, and up before it", () => {
    expect(drop(itemDragId(bot("a")), itemDragId(bot("b")))).toEqual({
      type: "item",
      item: bot("a"),
      folderId: "f1",
      beforeItem: bot("c"),
    });
    expect(drop(itemDragId(bot("c")), itemDragId(bot("a")))).toEqual({
      type: "item",
      item: bot("c"),
      folderId: "f1",
      beforeItem: bot("a"),
    });
    expect(drop(itemDragId(bot("a")), itemDragId(bot("c")))).toMatchObject({ beforeItem: null });
  });

  it("moves a row from another list before the row it is over", () => {
    expect(drop(itemDragId(group("g")), itemDragId(bot("r2")))).toEqual({
      type: "item",
      item: group("g"),
      folderId: null,
      beforeItem: bot("r2"),
    });
  });

  it("drops onto a folder header into that folder, last, unless it is already there", () => {
    expect(drop(itemDragId(bot("r1")), folderDragId("f2"))).toEqual({
      type: "item",
      item: bot("r1"),
      folderId: "f2",
      beforeItem: null,
    });
    expect(drop(itemDragId(bot("a")), folderDragId("f1"))).toBeNull();
  });

  it("moves a row out of a folder to the end of the root", () => {
    expect(drop(itemDragId(bot("a")), ROOT_END_ID)).toEqual({
      type: "item",
      item: bot("a"),
      folderId: null,
      beforeItem: null,
    });
    expect(drop(itemDragId(bot("r2")), ROOT_END_ID)).toBeNull();
  });

  it("reorders folders, and treats a row inside a folder as that folder", () => {
    expect(drop(folderDragId("f1"), folderDragId("f2"))).toEqual({
      type: "folder",
      folderId: "f1",
      beforeFolderId: null,
    });
    expect(drop(folderDragId("f2"), itemDragId(bot("a")))).toEqual({
      type: "folder",
      folderId: "f2",
      beforeFolderId: "f1",
    });
    expect(drop(folderDragId("f1"), itemDragId(bot("r1")))).toBeNull();
    expect(drop(folderDragId("f1"), ROOT_END_ID)).toBeNull();
  });

  it("ignores a drop on itself or an unknown target", () => {
    expect(drop(itemDragId(bot("a")), itemDragId(bot("a")))).toBeNull();
    expect(drop(itemDragId(bot("a")), "nonsense")).toBeNull();
  });
});
