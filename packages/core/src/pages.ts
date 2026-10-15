import type { PageChart } from "@rakazo/contracts";
import { PAGE_CHART_FENCE, PageChartSchema } from "@rakazo/contracts";

export type PageSegment =
  | { kind: "markdown"; text: string }
  | { kind: "chart"; chart: PageChart }
  | { kind: "invalid_chart"; raw: string; error: string };

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

/**
 * Split a page into Markdown runs and chart fences, in document order. An unclosed chart
 * fence is reported as invalid rather than swallowing the rest of the page.
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
