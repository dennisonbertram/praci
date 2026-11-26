import { describe, expect, it } from "vitest";
import { MessageBlock } from "./events.js";
import { UiBlockSchema } from "./ui-block.js";

const table = {
  type: "table",
  columns: [{ label: "A" }, { label: "B", align: "right" }],
  rows: [["x", 1]],
};

describe("UiBlockSchema", () => {
  it("accepts every variant", () => {
    for (const block of [
      table,
      { type: "sections", sections: [{ heading: "H", body: "**b**" }] },
      { type: "summary", items: [{ label: "a", value: "b" }] },
      { type: "stats", stats: [{ label: "a", value: "1", hint: "+2%" }] },
      {
        type: "cards",
        cards: [
          { title: "t", href: "https://example.com/x" },
          { title: "u", href: "/app/mail" },
        ],
      },
      { type: "callout", tone: "warning", body: "careful" },
    ])
      expect(UiBlockSchema.safeParse(block).success, JSON.stringify(block)).toBe(true);
  });

  it("rejects ragged rows, unsafe links, unknown tones and oversize tables", () => {
    const bad = [
      { ...table, rows: [["only one"]] },
      { ...table, rows: Array.from({ length: 51 }, () => ["x", 1]) },
      { ...table, columns: Array.from({ length: 9 }, () => ({ label: "c" })), rows: [] },
      { type: "cards", cards: [{ title: "t", href: "javascript:alert(1)" }] },
      { type: "cards", cards: [{ title: "t", href: "//evil.example" }] },
      { type: "callout", tone: "loud", body: "x" },
      { type: "stats", stats: Array.from({ length: 7 }, () => ({ label: "a", value: "1" })) },
      { type: "html", html: "<script>" },
    ];
    for (const block of bad)
      expect(UiBlockSchema.safeParse(block).success, JSON.stringify(block)).toBe(false);
  });

  it("is a message block kind", () => {
    expect(MessageBlock.safeParse({ kind: "ui", block: table }).success).toBe(true);
  });
});
