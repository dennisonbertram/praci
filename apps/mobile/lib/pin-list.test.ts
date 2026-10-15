import type { PinList } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { addItem, deleteItem, editItem, toggleItem } from "./pin-list";

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
