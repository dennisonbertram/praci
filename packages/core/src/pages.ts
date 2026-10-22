import type { GtmPageBlock, PageChart } from "@rakazo/contracts";
import {
  GTM_PAGE_FENCES,
  GTM_PAGE_MAX_BLOCKS,
  GtmChannelsBlockSchema,
  GtmMetricBlockSchema,
  GtmPageBlockSchema,
  GtmPlanBlockSchema,
  PAGE_CHART_FENCE,
  PageChartSchema,
} from "@rakazo/contracts";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

export type PageSegment =
  | { kind: "markdown"; text: string }
  | { kind: "chart"; chart: PageChart }
  | { kind: "invalid_chart"; raw: string; error: string }
  | { kind: "gtm"; block: GtmPageBlock }
  | { kind: "invalid_gtm"; raw: string; error: string };

/** Parse one chart fence body. Returns an error message instead of throwing. */
export function parsePageChart(raw: string): { chart: PageChart } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Chart block is not valid JSON." };
  }
  const parsed = PageChartSchema.safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid chart block." };
  return { chart: parsed.data };
}

const FENCE_OPEN = new RegExp(`^\`\`\`${PAGE_CHART_FENCE}[ \\t]*$`);
const FENCE_CLOSE = /^`{3,}[ \t]*$/;
const CODE_FENCE_OPEN = /^(`{3,}|~{3,})/;
const GTM_FENCE_CANDIDATE = /^```(gtm(?:-[^\s`]*)?)(.*)$/;

function parseGtmPageQuery(
  fence: GtmPageBlock["type"],
  raw: string,
  schema: typeof GtmPlanBlockSchema | typeof GtmChannelsBlockSchema | typeof GtmMetricBlockSchema,
): { block: GtmPageBlock } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "GTM block is not valid JSON." };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid GTM block." };
  return { block: GtmPageBlockSchema.parse({ type: fence, query: parsed.data }) };
}

/** Parse one GTM page fence body. Returns an error message instead of throwing. */
export function parsePageGtm(
  fence: string,
  raw: string,
): { block: GtmPageBlock } | { error: string } {
  switch (fence) {
    case "gtm-plan":
      return parseGtmPageQuery(fence, raw, GtmPlanBlockSchema);
    case "gtm-channels":
      return parseGtmPageQuery(fence, raw, GtmChannelsBlockSchema);
    case "gtm-metric":
      return parseGtmPageQuery(fence, raw, GtmMetricBlockSchema);
    default:
      return { error: `Unknown GTM page block fence "${fence}".` };
  }
}

/**
 * Split a page into Markdown runs and chart/GTM fences, in document order. An unclosed fence
 * is reported as invalid rather than swallowing the rest of the page.
 */
export function splitPage(content: string): PageSegment[] {
  const segments: PageSegment[] = [];
  const lines = content.split("\n");
  let text: string[] = [];
  const flushText = () => {
    if (text.some((line) => line.trim()))
      segments.push({ kind: "markdown", text: text.join("\n") });
    text = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const gtmFence = GTM_FENCE_CANDIDATE.exec(line);
    if (gtmFence) {
      flushText();
      const fence = gtmFence[1] ?? "";
      const end = lines.findIndex((candidate, j) => j > i && FENCE_CLOSE.test(candidate));
      const raw = lines.slice(i + 1, end === -1 ? undefined : end).join("\n");
      let result: { block: GtmPageBlock } | { error: string };
      if (end === -1) {
        result = { error: "GTM block is missing its closing ```." };
      } else if (gtmFence[2]?.trim()) {
        result = { error: "GTM block fence must not include additional info." };
      } else if (!GTM_PAGE_FENCES.includes(fence as (typeof GTM_PAGE_FENCES)[number])) {
        result = { error: `Unknown GTM page block fence "${fence}".` };
      } else {
        result = parsePageGtm(fence, raw);
      }
      segments.push(
        "block" in result
          ? { kind: "gtm", block: result.block }
          : { kind: "invalid_gtm", raw, error: result.error },
      );
      if (end === -1) return segments;
      i = end;
      continue;
    }
    if (!FENCE_OPEN.test(line)) {
      text.push(line);
      const open = CODE_FENCE_OPEN.exec(line)?.[1];
      if (open) {
        // Another code fence: its lines are plain Markdown until a matching closer.
        const closer = new RegExp(`^${open[0]}{${open.length},}[ \\t]*$`);
        while (++i < lines.length) {
          text.push(lines[i] ?? "");
          if (closer.test(lines[i] ?? "")) break;
        }
      }
      continue;
    }
    const end = lines.findIndex((candidate, j) => j > i && FENCE_CLOSE.test(candidate));
    flushText();
    if (end === -1) {
      const raw = lines.slice(i + 1).join("\n");
      segments.push({
        kind: "invalid_chart",
        raw,
        error: "Chart block is missing its closing ```.",
      });
      return segments;
    }
    const raw = lines.slice(i + 1, end).join("\n");
    const result = parsePageChart(raw);
    segments.push(
      "chart" in result
        ? { kind: "chart", chart: result.chart }
        : { kind: "invalid_chart", raw, error: result.error },
    );
    i = end;
  }
  flushText();
  return segments;
}

/** Serialize a chart back into a fence, matching what splitPage reads. */
export function pageChartFence(chart: PageChart): string {
  return `\`\`\`${PAGE_CHART_FENCE}\n${JSON.stringify(chart)}\n\`\`\``;
}

/** Serialize a strictly validated GTM block into its standard page fence. */
export function pageGtmFence(block: GtmPageBlock): string {
  const checked = GtmPageBlockSchema.parse(block);
  return `\`\`\`${checked.type}\n${JSON.stringify(checked.query)}\n\`\`\``;
}

type MarkdownNode = {
  type?: string;
  lang?: string | null;
  checked?: boolean | null;
  children?: MarkdownNode[];
};

const pageMarkdownParser = unified().use(remarkParse).use(remarkGfm);

/** Validate Markdown restrictions and GTM fences before saving a page. */
export function gtmPageContentError(content: string, gtmPage: boolean): string | null {
  const tree = pageMarkdownParser.parse(content) as unknown as MarkdownNode;
  let gtmCodeNodeCount = 0;
  let markdownError: string | null = null;
  const visit = (node: MarkdownNode) => {
    if (node.type === "code" && node.lang?.startsWith("gtm-")) gtmCodeNodeCount++;
    if (gtmPage && !markdownError) {
      if (
        node.type === "link" ||
        node.type === "image" ||
        node.type === "linkReference" ||
        node.type === "imageReference" ||
        node.type === "definition"
      ) {
        markdownError = "GTM pages cannot contain links or images.";
      } else if (node.type === "html") {
        markdownError = "GTM pages cannot contain raw HTML.";
      } else if (node.type === "listItem" && typeof node.checked === "boolean") {
        markdownError = "GTM pages cannot contain task lists.";
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  const segments = splitPage(content);
  const gtmSegments = segments.filter(
    (segment) => segment.kind === "gtm" || segment.kind === "invalid_gtm",
  );

  if (!gtmPage) {
    if (gtmCodeNodeCount > 0 || gtmSegments.length > 0)
      return "GTM page blocks are only allowed on GTM pages.";
    return null;
  }
  if (markdownError) return markdownError;
  if (gtmCodeNodeCount !== gtmSegments.length)
    return "GTM blocks must use standard top-level triple-backtick fences.";
  if (gtmSegments.length > GTM_PAGE_MAX_BLOCKS)
    return `The page has ${gtmSegments.length} GTM blocks; the limit is ${GTM_PAGE_MAX_BLOCKS}.`;
  for (const segment of gtmSegments) {
    if (segment.kind === "invalid_gtm") return `Invalid GTM block: ${segment.error}`;
  }
  return null;
}
