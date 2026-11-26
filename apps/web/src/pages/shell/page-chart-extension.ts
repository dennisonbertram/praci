import type { PageChart } from "@rakazo/contracts";
import { PAGE_CHART_FENCE } from "@rakazo/contracts";
import { historyChartRows, pageChartFence, parsePageChart } from "@rakazo/core";
import { Node } from "@tiptap/react";
import { useMemo } from "react";
import { chartKey, usePageLive } from "./page-live";

/** The one place chart rows are read: live rows for a chart with a source, else its snapshot. */
export function usePageChartRows(chart: PageChart): unknown[] {
  const { blocks } = usePageLive();
  const rows = (chart.source && blocks.get(chartKey(chart))?.rows) || chart.data;
  // Memoised: ChartCanvasPlot re-plots whenever the rows identity changes.
  return useMemo(
    () => (chart.over === "history" ? historyChartRows(rows) : rows),
    [chart.over, rows],
  );
}

const FENCE = new RegExp(
  `^\`\`\`${PAGE_CHART_FENCE}[ \\t]*\\n([\\s\\S]*?)\\n\`\`\`[ \\t]*(?:\\n|$)`,
);

/**
 * A ```chart fence as an atom block. A fence that does not parse becomes a plain code block,
 * so nothing is lost. Charts can be deleted, not edited.
 */
export const PageChartNode = Node.create({
  name: "pageChart",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      chart: {
        default: null,
        parseHTML: (element) => {
          const result = parsePageChart(element.getAttribute("data-page-chart") ?? "");
          return "chart" in result ? result.chart : null;
        },
        renderHTML: (attributes) => ({ "data-page-chart": JSON.stringify(attributes.chart) }),
      },
    };
  },
  parseHTML() {
    // A chart that does not parse is dropped rather than pasted as a null chart.
    return [
      {
        tag: "div[data-page-chart]",
        getAttrs: (element) =>
          "chart" in parsePageChart(element.getAttribute("data-page-chart") ?? "") ? null : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes];
  },
  markdownTokenizer: {
    name: "pageChart",
    level: "block",
    start: (src: string) => src.indexOf(`\`\`\`${PAGE_CHART_FENCE}`),
    tokenize: (src: string, _tokens: unknown, lexer: unknown) => {
      // Fences nested in quotes or list items stay code blocks, like the server reads them.
      if ((lexer as { state?: { top?: boolean } }).state?.top === false) return undefined;
      const match = FENCE.exec(src);
      return match ? { type: "pageChart", raw: match[0], text: match[1] ?? "" } : undefined;
    },
  },
  parseMarkdown: (token) => {
    const raw = String(token.text ?? "");
    const result = parsePageChart(raw);
    if ("chart" in result) return { type: "pageChart", attrs: { chart: result.chart } };
    return {
      type: "codeBlock",
      attrs: { language: PAGE_CHART_FENCE },
      content: raw ? [{ type: "text", text: raw }] : [],
    };
  },
  renderMarkdown: (node) => pageChartFence(node.attrs?.chart as PageChart),
});
