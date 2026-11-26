import type { UiBlock } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { blocksToAgentHistoryText } from "./attachments.js";
import { uiBlockText } from "./ui-block-text.js";

describe("uiBlockText", () => {
  it("writes a Markdown table and escapes pipes", () => {
    const text = uiBlockText({
      type: "table",
      title: "Spend",
      columns: [{ label: "Name" }, { label: "Total", align: "right" }],
      rows: [["a|b", 12.5]],
    });
    expect(text).toBe("**Spend**\n\n| Name | Total |\n| --- | ---: |\n| a\\|b | 12.5 |");
  });

  it("covers the other variants", () => {
    const text = (block: UiBlock) => uiBlockText(block);
    expect(text({ type: "sections", sections: [{ heading: "H", body: "body" }] })).toBe(
      "**H**\nbody",
    );
    expect(text({ type: "summary", title: "T", items: [{ label: "a", value: "b" }] })).toBe(
      "**T**\n- a: b",
    );
    expect(text({ type: "stats", stats: [{ label: "Rev", value: "$1", hint: "up" }] })).toBe(
      "- Rev: $1 (up)",
    );
    expect(
      text({
        type: "cards",
        cards: [{ title: "T", badge: "New", subtitle: "s", body: "b", href: "/x" }],
      }),
    ).toBe("- **T** [New] s\n  b\n  /x");
    expect(text({ type: "callout", tone: "danger", body: "a\nb" })).toBe("> **Problem**\n> a\n> b");
  });

  it("is what history shows for a ui block", () => {
    const blocks = [
      {
        kind: "ui" as const,
        block: { type: "callout" as const, tone: "info" as const, title: "Hi", body: "there" },
      },
    ];
    expect(blocksToAgentHistoryText(blocks)).toBe("> **Hi**\n> there");
  });
});
