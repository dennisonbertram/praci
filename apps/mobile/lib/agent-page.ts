import { splitPage } from "@rakazo/core";

export type PageBlock =
  | { kind: "markdown"; text: string }
  | { kind: "chart"; name: string; svg: string }
  | { kind: "chart_error" };

/**
 * Pair each valid chart segment with the Nth server-rendered SVG. Invalid fences, and charts
 * the server returned no SVG for, become an error line instead of a chart.
 */
export function pageBlocks(content: string, chartSvgs: string[] = []): PageBlock[] {
  let chartIndex = 0;
  return splitPage(content).flatMap((segment): PageBlock[] => {
    if (segment.kind === "markdown") return [segment];
    if (segment.kind === "invalid_chart") return [{ kind: "chart_error" }];
    if (segment.kind === "gtm" || segment.kind === "invalid_gtm") return [];
    const svg = chartSvgs[chartIndex++];
    return [svg ? { kind: "chart", name: segment.chart.name, svg } : { kind: "chart_error" }];
  });
}
