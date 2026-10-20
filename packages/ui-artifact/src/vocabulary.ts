import * as z from "zod";

/** Hard limits for one UI artifact. The tool, the parser and both renderers share them. */
export const UI_LIMITS = {
  /** Characters of generated source. */
  sourceChars: 60_000,
  /** Layout levels (card, stack, grid) inside one another. */
  depth: 3,
  /** All blocks in the artifact, layout blocks included. */
  blocks: 200,
  /** Characters in a label, title, badge, column name or table cell. */
  shortChars: 200,
  /** Characters in a paragraph or list item. */
  textChars: 2000,
  tableRows: 200,
  tableColumns: 12,
  listItems: 100,
  chartPoints: 60,
  chartSeries: 6,
  layoutChildren: 40,
} as const;

const short = z.string().max(UI_LIMITS.shortChars);
const long = z.string().max(UI_LIMITS.textChars);
const cell = z.union([short, z.number(), z.null()]);

export const BADGE_TONES = ["default", "success", "warning", "destructive"] as const;
export const GRID_COLUMNS = [2, 3, 4] as const;
export const CHART_KINDS = ["line", "bar"] as const;

export const chartSeriesSchema = z.object({
  name: short.describe("Series name"),
  values: z.array(z.number()).max(UI_LIMITS.chartPoints).describe("One number per label"),
});

/**
 * Every block type. Property order is the order of OpenUI Lang positional arguments, and optional
 * properties come last. `child` is the schema of a layout block's children.
 */
export function blockShapes(child: z.ZodType) {
  const children = z.array(child).max(UI_LIMITS.layoutChildren);
  return {
    heading: z.object({
      type: z.literal("heading"),
      text: short,
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    }),
    text: z.object({ type: z.literal("text"), text: long, muted: z.boolean().optional() }),
    metric: z.object({
      type: z.literal("metric"),
      label: short,
      value: short.describe('Formatted value, for example "$12,400" or "38%"'),
      delta: short.optional().describe('Change, for example "+4.2%" or "-3 vs last week"'),
    }),
    table: z
      .object({
        type: z.literal("table"),
        columns: z.array(short).min(1).max(UI_LIMITS.tableColumns),
        rows: z
          .array(z.array(cell).max(UI_LIMITS.tableColumns))
          .max(UI_LIMITS.tableRows)
          .describe("Each row has at most as many cells as there are columns"),
      })
      .refine((t) => t.rows.every((row) => row.length <= t.columns.length), {
        message: "A table row has more cells than the table has columns",
      }),
    list: z.object({
      type: z.literal("list"),
      items: z.array(long).min(1).max(UI_LIMITS.listItems),
      ordered: z.boolean().optional(),
    }),
    badge: z.object({
      type: z.literal("badge"),
      text: short,
      tone: z.enum(BADGE_TONES).optional(),
    }),
    divider: z.object({ type: z.literal("divider") }),
    chart: z
      .object({
        type: z.literal("chart"),
        kind: z.enum(CHART_KINDS),
        labels: z.array(short).min(1).max(UI_LIMITS.chartPoints),
        series: z.array(chartSeriesSchema).min(1).max(UI_LIMITS.chartSeries),
        money: z
          .boolean()
          .optional()
          .describe("True when the values are money, so the chart hides with Hide money"),
      })
      .refine((c) => c.series.every((s) => s.values.length === c.labels.length), {
        message: "Every series needs one value per label",
      }),
    card: z.object({ type: z.literal("card"), children, title: short.optional() }),
    stack: z.object({ type: z.literal("stack"), children }),
    grid: z.object({
      type: z.literal("grid"),
      children,
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    }),
  };
}

export type UiBlockType = keyof ReturnType<typeof blockShapes>;
export const LAYOUT_TYPES = ["card", "stack", "grid"] as const;

type Leaf =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "text"; text: string; muted?: boolean }
  | { type: "metric"; label: string; value: string; delta?: string }
  | { type: "table"; columns: string[]; rows: (string | number | null)[][] }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "badge"; text: string; tone?: (typeof BADGE_TONES)[number] }
  | { type: "divider" }
  | {
      type: "chart";
      kind: (typeof CHART_KINDS)[number];
      labels: string[];
      series: { name: string; values: number[] }[];
      money?: boolean;
    };

export type UiBlock =
  | Leaf
  | { type: "card"; children: UiBlock[]; title?: string }
  | { type: "stack"; children: UiBlock[] }
  | { type: "grid"; children: UiBlock[]; columns?: 2 | 3 | 4 };

const block: z.ZodType<UiBlock> = z.lazy((): z.ZodType<UiBlock> => {
  const leaves = blockShapes(z.never());
  const layouts = blockShapes(block);
  return z.discriminatedUnion("type", [
    leaves.heading,
    leaves.text,
    leaves.metric,
    leaves.table,
    leaves.list,
    leaves.badge,
    leaves.divider,
    leaves.chart,
    layouts.card,
    layouts.stack,
    layouts.grid,
  ]) as unknown as z.ZodType<UiBlock>;
});

/** The strict input of the create_ui_artifact tool. */
export const uiArtifactInputSchema = z.object({
  title: z.string().trim().min(1).max(120).describe("Short title, also the artifact name"),
  description: z.string().max(280).optional().describe("One line saying what this shows"),
  blocks: z.array(block).min(1).max(UI_LIMITS.layoutChildren),
});

export type UiArtifactInput = z.infer<typeof uiArtifactInputSchema>;

/** Blocks plus the number of blocks inside them. */
export function countBlocks(blocks: readonly UiBlock[]): number {
  let n = 0;
  for (const block of blocks) {
    n += 1;
    if ("children" in block) n += countBlocks(block.children);
  }
  return n;
}

/** Layout levels in the deepest branch; 0 when there are no layout blocks. */
export function layoutDepth(blocks: readonly UiBlock[]): number {
  let deepest = 0;
  for (const b of blocks)
    if ("children" in b) deepest = Math.max(deepest, 1 + layoutDepth(b.children));
  return deepest;
}
