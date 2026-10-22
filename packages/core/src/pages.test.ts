import type { GtmPageBlock } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  gtmPageContentError,
  pageChartFence,
  pageGtmFence,
  parsePageGtm,
  splitPage,
} from "./pages.js";

const chart = {
  name: "Burn",
  spec: { marks: [{ type: "lineY", x: "month", y: "usd" }] },
  data: [{ month: "2026-01", usd: 1 }],
};

const gtmBlocks: GtmPageBlock[] = [
  {
    type: "gtm-plan",
    query: { group: "in_progress", channel: ["x"], category: ["draft"], limit: 7 },
  },
  { type: "gtm-channels", query: {} },
  { type: "gtm-metric", query: { label: "Launches", count: "needs_you", channel: "linkedin" } },
];

describe("splitPage", () => {
  it("splits markdown and chart fences in order and round-trips the fence", () => {
    const page = `# Weekly\n\nUp a bit.\n\n${pageChartFence(chart)}\n\nNotes after.`;
    expect(splitPage(page)).toEqual([
      { kind: "markdown", text: "# Weekly\n\nUp a bit.\n" },
      { kind: "chart", chart },
      { kind: "markdown", text: "\nNotes after." },
    ]);
  });

  it("reports bad JSON and unclosed fences without dropping other content", () => {
    expect(splitPage("```chart\n{nope\n```")).toEqual([
      { kind: "invalid_chart", raw: "{nope", error: "Chart block is not valid JSON." },
    ]);
    const unclosed = splitPage("Intro\n```chart\n{}");
    expect(unclosed[0]).toEqual({ kind: "markdown", text: "Intro" });
    expect(unclosed[1]?.kind).toBe("invalid_chart");
  });

  it("leaves other code fences as markdown", () => {
    expect(splitPage("```ts\nconst a = 1;\n```")).toEqual([
      { kind: "markdown", text: "```ts\nconst a = 1;\n```" },
    ]);
  });

  it("keeps a chart example inside a longer or tilde fence as markdown", () => {
    const example = '```chart\n{"name":"x","spec":{},"data":[]}\n```';
    for (const page of [
      `\`\`\`\`md\n${example}\n\`\`\`\``,
      `~~~\n${example}\n~~~`,
      `> ${example.split("\n").join("\n> ")}`,
    ]) {
      expect(splitPage(page)).toEqual([{ kind: "markdown", text: page }]);
    }
  });

  it("still finds a real chart after a longer fence closes", () => {
    const page = `\`\`\`\`md\nexample\n\`\`\`\`\n\n${pageChartFence(chart)}`;
    expect(splitPage(page).map((s) => s.kind)).toEqual(["markdown", "chart"]);
  });

  it("round-trips strict GTM page block fences", () => {
    for (const block of gtmBlocks) {
      expect(parsePageGtm(block.type, JSON.stringify(block.query))).toEqual({ block });
      expect(splitPage(pageGtmFence(block))).toEqual([{ kind: "gtm", block }]);
    }
  });

  it("reports unknown, malformed, and unclosed GTM fences", () => {
    expect(parsePageGtm("gtm-unknown", "{}")).toMatchObject({ error: expect.any(String) });
    expect(parsePageGtm("gtm-plan", "{")).toMatchObject({ error: expect.any(String) });
    expect(parsePageGtm("gtm-plan", '{"group":"needs_you"}')).toMatchObject({
      error: expect.any(String),
    });
    expect(splitPage("```gtm-unknown\n{}\n```")[0]?.kind).toBe("invalid_gtm");
    expect(splitPage("```gtm-plan extra\n{}\n```")[0]?.kind).toBe("invalid_gtm");
    const unclosed = splitPage('Intro\n```gtm-plan\n{"group":"done"}');
    expect(unclosed[0]).toEqual({ kind: "markdown", text: "Intro" });
    expect(unclosed[1]?.kind).toBe("invalid_gtm");
  });
});

describe("gtmPageContentError", () => {
  it.each([
    "[inline](https://example.test)",
    "![inline](https://example.test/image.png)",
    "[reference][site]\n\n[site]: https://example.test",
    "![reference][site]\n\n[site]: https://example.test/image.png",
    "https://example.test",
    "<https://example.test>",
    "[site]: https://example.test",
    "<div>raw HTML</div>",
    "- [ ] incomplete",
    "- [x] complete",
  ])("rejects unsafe GTM Markdown: %s", (content) => {
    expect(gtmPageContentError(content, true)).toEqual(expect.any(String));
  });

  it("allows links as code literals and ordinary Markdown links for other pages", () => {
    const literal = [
      "`[inline](https://example.test)`",
      "```text",
      "[fenced](https://example.test)",
      "```",
    ].join("\n");
    expect(gtmPageContentError(literal, true)).toBeNull();
    expect(gtmPageContentError("[normal](https://example.test)", false)).toBeNull();
  });

  it("allows standard GTM fences on GTM pages only", () => {
    const standard = '```gtm-plan\n{"group":"done"}\n```';
    expect(gtmPageContentError(standard, false)).toEqual(expect.any(String));
    expect(gtmPageContentError(standard, true)).toBeNull();
  });

  it.each([
    '~~~gtm-plan\n{"group":"done"}\n~~~',
    '````gtm-plan\n{"group":"done"}\n````',
    '> ```gtm-plan\n> {"group":"done"}\n> ```',
  ])("rejects unsupported GTM fences on non-GTM and GTM pages", (content) => {
    expect(gtmPageContentError(content, false)).toEqual(expect.any(String));
    expect(gtmPageContentError(content, true)).toEqual(expect.any(String));
  });
});
