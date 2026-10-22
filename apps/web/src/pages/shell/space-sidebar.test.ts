import { describe, expect, it, vi } from "vitest";
import {
  activeSpaceFirst,
  commitSpaceRename,
  sidebarGroupsForSpaces,
  spaceHoldingChat,
} from "./space-sidebar";

function chat(id: string, name: string) {
  return {
    id,
    name,
    title: "",
    preview: "",
    pinned: false,
    sectionId: null as string | null,
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

  it("heads the only space with the given label and keeps its name", () => {
    const [group] = sidebarGroupsForSpaces(
      [space("space-1", "Personal", { canRename: true })],
      "",
      undefined,
      "Personnel",
    );
    expect(group).toMatchObject({ title: "Personnel", spaceName: "Personal", relabeled: true });
  });

  it("lists the only space's chats with no heading or menu, and brings them back with a second space", () => {
    const only = [space("space-1", "Personal", { canRename: true })];
    const [solo] = sidebarGroupsForSpaces(only, "", "space-1", null);
    expect(solo).toMatchObject({ title: null, canRenameSpace: false, canDeleteSpace: false });
    expect(solo?.bots).toHaveLength(1);

    const both = sidebarGroupsForSpaces([...only, space("space-2", "Work")], "", "space-1", null);
    expect(both.map((group) => group.title)).toEqual(["Personal", "Work"]);
  });

  it("does not relabel a lone space whose name already matches the label", () => {
    const [group] = sidebarGroupsForSpaces(
      [space("space-1", "Personal")],
      "",
      undefined,
      "Personal",
    );
    expect(group).toMatchObject({ title: "Personal", spaceName: "Personal", relabeled: false });
  });

  it("keeps the Personnel heading above pinned agents, folders and the rest", () => {
    const pinned = { ...chat("b1", "Chief"), pinned: true };
    const filed = { ...chat("b2", "Ops"), sectionId: "s1" };
    const loose = chat("b3", "Helper");
    const only = {
      ...space("space-1", "Personal", { canRename: true, bots: [pinned, filed, loose] }),
      botSections: [
        { id: "s1", name: "Ops team", collapsed: true },
        { id: "s2", name: "Empty folder" },
      ],
    };
    const groups = sidebarGroupsForSpaces([only], "", undefined, "Personnel");

    expect(groups.map((g) => [g.kind, g.title])).toEqual([
      ["head", "Personnel"],
      ["pinned", "Pinned"],
      ["folder", "Ops team"],
      ["folder", "Empty folder"],
      ["root", null],
    ]);
    expect(groups[0]).toMatchObject({
      spaceName: "Personal",
      relabeled: true,
      canRenameSpace: true,
    });
    expect(groups.slice(1).every((g) => g.parentKey === groups[0]?.key)).toBe(true);
    expect(groups.map((g) => g.bots.map((item) => item.id))).toEqual([
      [],
      ["b1"],
      ["b2"],
      [],
      ["b3"],
    ]);
    expect(groups.map((g) => g.collapsed)).toEqual([false, false, true, false, false]);
  });

  it("heads a pinned-only single space with Personnel", () => {
    const only = space("space-1", "Personal", { bots: [{ ...chat("b1", "Chief"), pinned: true }] });
    const groups = sidebarGroupsForSpaces([only], "", undefined, "Personnel");
    expect(groups.map((g) => g.title)).toEqual(["Personnel", "Pinned", null]);
  });

  it("orders a folder's bots and groups by position, groups last until ordered", () => {
    const first = { ...chat("g1", "Team"), position: 0 };
    const second = { ...chat("b1", "Chief"), position: 3 };
    const unordered = { ...chat("g2", "Other"), position: null };
    const only = {
      ...space("space-1", "Personal", { bots: [second] }),
      groups: [unordered, first],
    };
    const [group] = sidebarGroupsForSpaces([only], "");
    expect(group?.bots.map((item) => item.id)).toEqual(["g1", "b1", "g2"]);
  });

  it("treats a bot in a deleted folder as unfiled and hides empty folders while searching", () => {
    const lost = { ...chat("b1", "Chief"), sectionId: "gone" };
    const only = {
      ...space("space-1", "Personal", { bots: [lost] }),
      botSections: [{ id: "s1", name: "Ops" }],
    };
    expect(sidebarGroupsForSpaces([only], "").map((g) => g.kind)).toEqual([
      "head",
      "folder",
      "root",
    ]);
    expect(sidebarGroupsForSpaces([only], "chief").map((g) => g.kind)).toEqual(["space"]);
  });

  it("still names each space once there is more than one", () => {
    const groups = sidebarGroupsForSpaces(
      [
        space("space-1", "Personal", { canRename: true }),
        space("space-2", "Support", { canRename: true, canDelete: true, bots: [] }),
      ],
      "",
      undefined,
      "Personnel",
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

describe("spaceHoldingChat", () => {
  const spaces = [
    { id: "s1", bots: [{ id: "b1" }], groups: [] },
    { id: "s2", bots: [{ id: "b2" }], groups: [{ id: "g2" }] },
  ];
  it("finds the other space that holds a bot or group, and nothing for an unknown id", () => {
    expect(spaceHoldingChat(spaces, "s1", "b2")).toBe("s2");
    expect(spaceHoldingChat(spaces, "s1", "g2")).toBe("s2");
    expect(spaceHoldingChat(spaces, "s1", "nope")).toBeNull();
  });
  it("ignores the current space, whose chats the page already checked", () => {
    expect(spaceHoldingChat(spaces, "s1", "b1")).toBeNull();
  });
});
