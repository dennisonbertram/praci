import { describe, expect, it } from "vitest";
import { pageChartFence, splitPage } from "./pages.js";

const chart = {
  name: "Burn",
  spec: { marks: [{ type: "lineY", x: "month", y: "usd" }] },
  data: [{ month: "2026-01", usd: 1 }],
};

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
});
