import type { PageChart, PageLiveBlock } from "@rakazo/contracts";
import { createContext, useContext } from "react";

/** Lets every live block on the open page read its data without prop drilling through the editor. */
export type PageLive = {
  /** False until the first load, so blocks shimmer instead of flashing "No data yet". */
  loaded: boolean;
  refreshing: boolean;
  blocks: ReadonlyMap<string, PageLiveBlock>;
  refresh: () => void;
  /** Opens where a pending source is approved; set only on the full-width page. */
  onReview?: () => void;
};

export const PageLiveContext = createContext<PageLive>({
  loaded: true,
  refreshing: false,
  blocks: new Map(),
  refresh: () => undefined,
});
export const usePageLive = () => useContext(PageLiveContext);

type JsonNode = { type?: string; attrs?: Record<string, unknown>; content?: JsonNode[] };

/** Identifies a live node by what it shows, so data survives local deletes without index bookkeeping. */
export const liveKey = (type: string, value: unknown): string => `${type}:${JSON.stringify(value)}`;

export const chartKey = (chart: PageChart) => liveKey("pageChart", chart);

function liveKeyOf(node: JsonNode): string | null {
  if (node.type === "pageMetric" || node.type === "pageTable")
    return liveKey(node.type, node.attrs?.block);
  const chart = node.attrs?.chart as PageChart | undefined;
  return node.type === "pageChart" && chart?.source ? chartKey(chart) : null;
}

/**
 * Pairs the i-th live node of a saved document with blocks[i] (the order `pages.data` uses:
 * metric and table fences and charts with a source; static charts are skipped).
 */
export function mapLiveBlocks(doc: JsonNode, blocks: PageLiveBlock[]): Map<string, PageLiveBlock> {
  const result = new Map<string, PageLiveBlock>();
  let index = 0;
  const walk = (node: JsonNode) => {
    const key = liveKeyOf(node);
    if (key) {
      const block = blocks[index++];
      if (block) result.set(key, block);
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return result;
}

export { cellValue, formatCell, tableColumns } from "@rakazo/core";
