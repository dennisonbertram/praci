import { describe, expect, it } from "vitest";
import { MAX_CHART_DATA_ROWS } from "./chart.js";
import { MessageBlock } from "./events.js";
import { PageChartInputSchema, PageChartSchema } from "./pages.js";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i }));
const chart = (data: unknown[], markData: unknown[]) => ({
  name: "Burn",
  spec: { marks: [{ type: "line", data: markData }] },
  data,
});

describe("page chart row limit", () => {
  it("accepts a chart within the combined limit", () => {
    expect(PageChartInputSchema.safeParse(chart(rows(10), rows(10))).success).toBe(true);
  });

  it("rejects rows embedded in spec.marks[].data that push past the limit on input", () => {
    const over = chart(rows(10), rows(MAX_CHART_DATA_ROWS));
    expect(PageChartInputSchema.safeParse(over).success).toBe(false);
  });

  it("still loads a stored chart over the limit through the read schema", () => {
    const over = chart(rows(10), rows(MAX_CHART_DATA_ROWS));
    expect(PageChartSchema.safeParse(over).success).toBe(true);
  });

  it("keeps the message chart block limit", () => {
    const block = { kind: "chart", ...chart(rows(10), rows(MAX_CHART_DATA_ROWS)) };
    expect(MessageBlock.safeParse(block).success).toBe(false);
    expect(MessageBlock.safeParse({ ...block, spec: {}, data: rows(10) }).success).toBe(true);
  });
});
