import { describe, expect, it } from "vitest";
import {
  nestRosterByParent,
  planSidebarMove,
  reorderBotTo,
  sidebarContainer,
  sidebarSections,
} from "./bot-sections.js";

const sections = [
  { id: "work", name: "Work" },
  { id: "home", name: "Home" },
];

describe("sidebarSections", () => {
  it("lists pinned items, then each folder in order, then the unfiled rest", () => {
    const { pinned, folders, root } = sidebarSections(
      [
        { id: "pinned", pinned: true, sectionId: "home" },
        { id: "work", pinned: false, sectionId: "work" },
        { id: "home", pinned: false, sectionId: "home" },
        { id: "loose", pinned: false, sectionId: null },
      ],
      sections,
    );
    expect(pinned.map((bot) => bot.id)).toEqual(["pinned"]);
    expect(folders.map(({ section, items }) => [section.id, items.map((bot) => bot.id)])).toEqual([
      ["work", ["work"]],
      ["home", ["home"]],
    ]);
    expect(root.map((bot) => bot.id)).toEqual(["loose"]);
  });

  it("treats items pointing at an unavailable folder as unfiled", () => {
    const { root } = sidebarSections(
      [{ id: "orphan", pinned: false, sectionId: "missing" }],
      sections,
    );
    expect(root.map((bot) => bot.id)).toEqual(["orphan"]);
  });
});

describe("reorderBotTo", () => {
  const bots = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("moves a bot to the target bot's position in either direction", () => {
    expect(reorderBotTo(bots, "a", "c").map((bot) => bot.id)).toEqual(["b", "c", "a"]);
    expect(reorderBotTo(bots, "c", "a").map((bot) => bot.id)).toEqual(["c", "a", "b"]);
  });

  it("leaves the list alone when either bot is missing or unchanged", () => {
    expect(reorderBotTo(bots, "a", "missing")).toBe(bots);
    expect(reorderBotTo(bots, "a", "a")).toBe(bots);
  });
});

describe("nestRosterByParent", () => {
  it("nests children under parents that appear in the same list", () => {
    const rows = nestRosterByParent([
      { id: "chief", parentBotId: null },
      { id: "lead", parentBotId: "chief" },
      { id: "helper", parentBotId: "lead" },
      { id: "peer", parentBotId: null },
    ]);
    expect(rows.map((row) => [row.item.id, row.depth, row.hasChildren])).toEqual([
      ["chief", 0, true],
      ["lead", 1, true],
      ["helper", 2, false],
      ["peer", 0, false],
    ]);
    expect(rows.map((row) => row.parentId)).toEqual([null, "chief", "lead", null]);
  });

  it("keeps orphans as roots when the parent is not in the list", () => {
    const rows = nestRosterByParent([{ id: "helper", parentBotId: "missing" }]);
    expect(rows).toEqual([
      {
        item: { id: "helper", parentBotId: "missing" },
        depth: 0,
        hasChildren: false,
        parentId: null,
      },
    ]);
  });

  it("hides all descendants when a parent is collapsed", () => {
    const rows = nestRosterByParent(
      [
        { id: "chief", parentBotId: null },
        { id: "lead", parentBotId: "chief" },
        { id: "helper", parentBotId: "lead" },
      ],
      new Set(["chief"]),
    );
    expect(rows.map((row) => row.item.id)).toEqual(["chief"]);
    expect(rows[0]?.hasChildren).toBe(true);
  });

  it("preserves sibling order from the source list", () => {
    const rows = nestRosterByParent([
      { id: "chief", parentBotId: null },
      { id: "beta", parentBotId: "chief" },
      { id: "alpha", parentBotId: "chief" },
    ]);
    expect(rows.map((row) => row.item.id)).toEqual(["chief", "beta", "alpha"]);
  });

  it("breaks parent cycles without dropping the items", () => {
    const rows = nestRosterByParent([
      { id: "a", parentBotId: "b" },
      { id: "b", parentBotId: "a" },
    ]);
    expect(rows.map((row) => row.item.id).sort()).toEqual(["a", "b"]);
  });
});

describe("planSidebarMove", () => {
  const item = (
    kind: "bot" | "group",
    id: string,
    sectionId: string | null,
    position: number | null,
    pinned = false,
  ) => ({ kind, id, sectionId, position, pinned });
  const items = [
    item("bot", "a", null, 0),
    item("bot", "b", null, 0),
    item("bot", "p", null, 0, true),
    item("group", "g", null, null),
    item("bot", "in", "f", 0),
  ];

  it("keeps bots first, then groups, until something is ordered by hand", () => {
    expect(sidebarContainer(items, null).map((i) => i.id)).toEqual(["a", "b", "g"]);
  });

  it("moves before an anchor and numbers the whole destination", () => {
    const plan = planSidebarMove(items, {
      item: { kind: "group", id: "g" },
      folderId: null,
      beforeItem: { kind: "bot", id: "a" },
    });
    expect(plan?.map((p) => [p.item.id, p.position])).toEqual([
      ["g", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("appends to another folder and rejects unknown items or anchors", () => {
    const plan = planSidebarMove(items, { item: { kind: "bot", id: "a" }, folderId: "f" });
    expect(plan?.map((p) => [p.item.id, p.sectionId, p.position])).toEqual([
      ["in", "f", 0],
      ["a", "f", 1],
    ]);
    expect(planSidebarMove(items, { item: { kind: "bot", id: "zz" }, folderId: null })).toBeNull();
    expect(
      planSidebarMove(items, {
        item: { kind: "bot", id: "a" },
        folderId: "f",
        beforeItem: { kind: "bot", id: "b" },
      }),
    ).toBeNull();
  });
});
