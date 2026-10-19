import { describe, expect, it } from "vitest";
import { AutoSortOperationSchema, AutoSortProposalSchema } from "./data-room-autosort.js";

describe("auto-sort names", () => {
  const bad = ["a\u0000b", "a\nb", "a‮b", "a⁦b", "a\u007fb"];
  it.each(bad)("rejects %j in a folder name and in a new file name", (name) => {
    expect(
      AutoSortProposalSchema.safeParse({ items: [{ id: "i", folderPath: [name] }] }).success,
    ).toBe(false);
    expect(
      AutoSortOperationSchema.safeParse({
        type: "rename_item",
        key: "k",
        itemId: "i",
        fromName: "a",
        toName: name,
      }).success,
    ).toBe(false);
  });
  it("accepts an ordinary name", () => {
    expect(
      AutoSortProposalSchema.safeParse({ items: [{ id: "i", folderPath: ["Cap table"] }] }).success,
    ).toBe(true);
  });
});
