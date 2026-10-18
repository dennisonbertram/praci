import { describe, expect, it, vi } from "vitest";
import { activeSpaceFirst, commitSpaceRename, sidebarGroupsForSpaces } from "./space-sidebar";

function chat(id: string, name: string) {
  return {
    id,
    name,
    title: "",
    preview: "",
    pinned: false,
    sectionId: null,
    parentBotId: null,
  };
}

function space(
  id: string,
  name: string,
  options: { canRename?: boolean; canDelete?: boolean; bots?: ReturnType<typeof chat>[] } = {},
) {
  return {
    id,
    name,
    canRename: options.canRename ?? false,
    canDelete: options.canDelete ?? false,
    bots: options.bots ?? [chat(`${id}-bot`, "Chief")],
    groups: [],
    botSections: [],
  };
}

describe("sidebarGroupsForSpaces", () => {
  it("names the only space above its chats, beside its actions", () => {
    const [group] = sidebarGroupsForSpaces([space("space-1", "Personal", { canRename: true })], "");

    expect(group).toMatchObject({
      title: "Personal",
      spaceName: "Personal",
      canRenameSpace: true,
      canDeleteSpace: false,
      showLock: false,
    });
    expect(group?.bots).toHaveLength(1);
  });

  it("still names each space once there is more than one", () => {
    const groups = sidebarGroupsForSpaces(
      [
        space("space-1", "Personal", { canRename: true }),
        space("space-2", "Support", { canRename: true, canDelete: true, bots: [] }),
      ],
      "",
    );

    expect(groups.map((group) => group.title)).toEqual(["Personal", "Support"]);
    expect(groups[0]).toMatchObject({ canRenameSpace: true, canDeleteSpace: false });
    expect(groups[1]).toMatchObject({
      canRenameSpace: true,
      canDeleteSpace: true,
      emptySpaceId: "space-2",
    });
  });

  it("marks the space being shown, including an empty one, only when several are listed", () => {
    const spaces = [space("space-1", "Personal"), space("space-2", "Empty", { bots: [] })];
    expect(sidebarGroupsForSpaces(spaces, "", "space-2").map((g) => g.current)).toEqual([
      false,
      true,
    ]);
    expect(sidebarGroupsForSpaces([space("space-1", "Personal")], "", "space-1")[0]?.current).toBe(
      false,
    );
  });

  it("hides space actions while a search removes every chat from the only space", () => {
    expect(
      sidebarGroupsForSpaces([space("space-1", "Personal", { canRename: true })], "missing"),
    ).toEqual([]);
  });
});

describe("commitSpaceRename", () => {
  it("applies the saved name when the following refresh fails", async () => {
    const rename = vi.fn(async () => undefined);
    const apply = vi.fn();
    const refresh = vi.fn(async () => {
      throw new Error("list failed");
    });

    await expect(commitSpaceRename({ rename, apply, refresh })).resolves.toBeUndefined();
    expect(rename).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not apply a name when the rename itself fails", async () => {
    const apply = vi.fn();
    const refresh = vi.fn(async () => undefined);

    await expect(
      commitSpaceRename({
        rename: async () => {
          throw new Error("Space deletion is already in progress");
        },
        apply,
        refresh,
      }),
    ).rejects.toThrow("Space deletion is already in progress");
    expect(apply).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("activeSpaceFirst", () => {
  it("puts the space on screen first and keeps the others in order", () => {
    const spaces = [space("a", "Northwind"), space("b", "Empty"), space("c", "Third")];
    expect(activeSpaceFirst(spaces, "b").map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(activeSpaceFirst(spaces, undefined).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
