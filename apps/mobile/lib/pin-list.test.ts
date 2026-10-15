import type { PinList } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import type { PinOp } from "./pin-list";
import { addItem, deleteItem, editItem, rebasePins, toggleItem } from "./pin-list";

const list = (): PinList => ({
  title: "Todo",
  items: [
    { id: "a", text: "one", done: false },
    { id: "b", text: "two", done: true },
  ],
});

describe("pin list editing", () => {
  it("toggles one item", () => {
    expect(toggleItem(list(), "a").items.map((i) => i.done)).toEqual([true, true]);
  });
  it("edits text, trimmed, and ignores blank text", () => {
    expect(editItem(list(), "b", "  new ").items[1]?.text).toBe("new");
    expect(editItem(list(), "b", "   ")).toEqual(list());
  });
  it("deletes an item", () => {
    expect(deleteItem(list(), "a").items.map((i) => i.id)).toEqual(["b"]);
  });
  it("adds an open item at the end and ignores blank text", () => {
    expect(addItem(list(), "c", " three ").items[2]).toEqual({
      id: "c",
      text: "three",
      done: false,
    });
    expect(addItem(list(), "c", " ")).toEqual(list());
  });
  it("does not add past the item limit", () => {
    const full: PinList = {
      title: "Todo",
      items: Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, text: "x", done: false })),
    };
    expect(addItem(full, "z", "y").items).toHaveLength(50);
  });
});

describe("rebasePins", () => {
  const server = (): PinList => ({
    title: "Todo",
    items: [
      { id: "a", text: "one", done: true },
      { id: "b", text: "two", done: false },
    ],
  });

  it("reapplies a later queued edit onto the server list after an earlier conflict", () => {
    const queued: PinOp[] = [(l) => toggleItem(l, "b")];
    expect(rebasePins(server(), queued).items.map((i) => i.done)).toEqual([true, true]);
  });
  it("skips operations on an item the server deleted", () => {
    const gone = deleteItem(server(), "b");
    const queued: PinOp[] = [(l) => toggleItem(l, "b"), (l) => editItem(l, "b", "x")];
    expect(rebasePins(gone, queued)).toEqual(gone);
  });
});
