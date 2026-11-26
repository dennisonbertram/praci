// @vitest-environment jsdom

import type { PageLiveBlock } from "@rakazo/contracts";
import { Editor } from "@tiptap/react";
import { expect, it } from "vitest";
import { PAGE_EXTENSIONS } from "./page-extensions";
import { cellValue, chartKey, formatCell, liveKey, mapLiveBlocks, tableColumns } from "./page-live";

const metric = { label: "Burn", source: "cash", path: "/burn", format: "usd" as const };
const table = { name: "Vendors", source: "spend", path: "/vendors", limit: 50 };
const staticChart = { name: "Static", spec: {}, data: [{ a: 1 }] };
const liveChart = {
  name: "Cash",
  spec: {},
  data: [],
  source: "cash",
  path: "/cash",
  over: "history" as const,
};
const fence = (kind: string, value: unknown) => `\`\`\`${kind}\n${JSON.stringify(value)}\n\`\`\``;

const page = [
  "# Cash",
  fence("chart", staticChart),
  fence("metric", metric),
  "```metric\n{not json\n```",
  fence("chart", liveChart),
  fence("table", table),
].join("\n\n");

const block = (text: string): PageLiveBlock => ({ status: "ok", fetchedAt: null, text });

function parse(content: string) {
  const editor = new Editor({ extensions: PAGE_EXTENSIONS, content, contentType: "markdown" });
  return editor;
}

it("round-trips metric and table fences as atoms and keeps invalid ones as code", () => {
  const editor = parse(page);
  const types = editor.getJSON().content?.map((node) => node.type);
  expect(types).toEqual([
    "heading",
    "pageChart",
    "pageMetric",
    "codeBlock",
    "pageChart",
    "pageTable",
  ]);
  expect(editor.getMarkdown()).toContain(fence("metric", metric));
  expect(editor.getMarkdown()).toContain("```metric\n{not json\n```");
  expect(editor.getMarkdown()).toContain(fence("table", table));
  editor.destroy();
});

it("pairs live blocks with live nodes in document order, skipping static charts and invalid fences", () => {
  const editor = parse(page);
  const doc = editor.markdown?.parse(page);
  if (!doc) throw new Error("no markdown manager");
  const blocks = [block("$86K"), block("chart"), block("table")];
  const mapped = mapLiveBlocks(doc, blocks);
  expect(mapped.size).toBe(3);
  expect(mapped.get(liveKey("pageMetric", metric))?.text).toBe("$86K");
  expect(mapped.get(chartKey(liveChart))?.text).toBe("chart");
  expect(mapped.get(liveKey("pageTable", table))?.text).toBe("table");
  expect(mapped.has(chartKey(staticChart))).toBe(false);
  editor.destroy();
});

it("formats cells like the server and falls back to the first row's keys", () => {
  expect(formatCell(86000.4, "usd")).toBe("$86,000");
  expect(formatCell("12.34", "usd")).toBe("$12.34");
  expect(formatCell(12.34, "percent")).toBe("12.3%");
  expect(formatCell("n/a", "usd")).toBe("n/a");
  expect(formatCell(null)).toBe("");
  expect(tableColumns(undefined, [{ name: "A", total: 1 }]).map((c) => c.key)).toEqual([
    "name",
    "total",
  ]);
  expect(cellValue(7, "value")).toBe(7);
});
