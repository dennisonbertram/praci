import * as z from "zod";

export const MAX_CHART_DATA_ROWS = 5_000;

/** z.any keeps the inferred type JSON-assignable for persistence. */
export const ChartSpecSchema = z.record(z.string(), z.any());
export const ChartDataSchema = z.array(z.any()).max(MAX_CHART_DATA_ROWS);

function embeddedChartRowCount(spec: Record<string, unknown>): number {
  const specData = Array.isArray(spec.data) ? spec.data.length : 0;
  const markData = Array.isArray(spec.marks)
    ? spec.marks.reduce((total, mark) => {
        if (!mark || typeof mark !== "object" || !Array.isArray(mark.data)) return total;
        return total + mark.data.length;
      }, 0)
    : 0;
  return specData + markData;
}

/** Rejects a chart whose top-level rows plus rows embedded in its spec exceed the limit. */
export function refineChartRows(
  chart: { spec: Record<string, unknown>; data: unknown[] },
  ctx: z.RefinementCtx,
): void {
  if (chart.data.length + embeddedChartRowCount(chart.spec) <= MAX_CHART_DATA_ROWS) return;
  ctx.addIssue({
    code: "custom",
    message: `Chart data exceeds the ${MAX_CHART_DATA_ROWS.toLocaleString("en-US")}-row limit`,
  });
}
