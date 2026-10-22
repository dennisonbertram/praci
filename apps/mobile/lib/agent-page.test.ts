import { describe, expect, it } from "vitest";
import { pageBlocks } from "./agent-page";

const chart = (name: string) =>
  `\`\`\`chart\n${JSON.stringify({ name, spec: {}, data: [] })}\n\`\`\``;

describe("pageBlocks", () => {
  it("aligns SVGs with valid charts only and flags invalid or unmatched ones", () => {
    const content = ["# Hi", chart("a"), "```chart\nnot json\n```", chart("b"), chart("c")].join(
      "\n",
    );
    const blocks = pageBlocks(content, ["<svg a/>", "<svg b/>"]);
    expect(blocks.map((b) => b.kind)).toEqual([
      "markdown",
      "chart",
      "chart_error",
      "chart",
      "chart_error",
    ]);
    expect(blocks[1]).toMatchObject({ name: "a", svg: "<svg a/>" });
    expect(blocks[3]).toMatchObject({ name: "b", svg: "<svg b/>" });
  });

  it("skips valid and invalid GTM blocks without shifting chart SVGs", () => {
    const validGtm = '```gtm-plan\n{"group":"done"}\n```';
    const invalidGtm = "```gtm-unknown\n{}\n```";
    const blocks = pageBlocks([chart("a"), validGtm, invalidGtm, chart("b")].join("\n"), [
      "<svg a/>",
      "<svg b/>",
    ]);
    expect(blocks).toEqual([
      { kind: "chart", name: "a", svg: "<svg a/>" },
      { kind: "chart", name: "b", svg: "<svg b/>" },
    ]);
  });
});
