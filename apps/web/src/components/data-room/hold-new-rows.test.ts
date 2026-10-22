import { describe, expect, it } from "vitest";
import { holdNewRows } from "./hold-new-rows";

const row = (id: string) => ({ item: { id } });

describe("holdNewRows", () => {
  it("holds new files above the open row so it stays put, and shows ones below it", () => {
    const rows = [row("new1"), row("new2"), row("a"), row("open"), row("b"), row("later")];
    const result = holdNewRows(rows, new Set(["a", "open", "b"]), "open");
    expect(result.rows.map((r) => r.item.id)).toEqual(["a", "open", "b", "later"]);
    expect(result.held).toBe(2);
  });

  it("holds nothing when the open row is not in the list", () => {
    const rows = [row("x")];
    expect(holdNewRows(rows, new Set(), "gone")).toEqual({ rows, held: 0 });
  });
});
