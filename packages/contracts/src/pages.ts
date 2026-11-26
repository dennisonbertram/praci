import * as z from "zod";
import { ChartDataSchema, ChartSpecSchema, refineChartRows } from "./chart.js";
import { Id } from "./ids.js";

/**
 * A bot's page: one Markdown document per bot that the bot writes with tools and the user
 * edits in place. Charts are fenced ```chart blocks whose body is a PageChart JSON object.
 */
export const BOT_PAGE_MAX_CHARS = 200_000;
export const BOT_PAGE_MAX_CHARTS = 20;
export const BOT_PAGE_MAX_PAGES = 20;
export const BOT_PAGE_TITLE_MAX = 60;
export const PAGE_CHART_FENCE = "chart";

/**
 * Snapshot charts carry their rows. A chart with a `source` reads its rows from that page source
 * instead (see page-sources.ts); `data` stays as the fallback and the save-time render check.
 */
export const PageChartSchema = z.object({
  name: z.string().min(1).max(200),
  /** Declarative Observable Plot spec; validated with the same PlotSpec rules as render_plot. */
  spec: ChartSpecSchema,
  data: ChartDataSchema,
  /** A page source name (PageSourceNameSchema rules are checked when the page is saved). */
  source: z.string().min(1).max(40).optional(),
  /** JSON Pointer into the source's result. latest: the array there. history: the number there, one row {at, value} per snapshot. */
  path: z.string().max(300).optional(),
  over: z.enum(["latest", "history"]).optional(),
});
/**
 * PageChartSchema plus the combined row limit (rows embedded in the spec count too). Use it
 * when a page is written; reads keep the lenient schema so stored pages over the limit still load.
 */
export const PageChartInputSchema = PageChartSchema.superRefine(refineChartRows);
export type PageChart = z.infer<typeof PageChartSchema>;

export const PageAuthor = z.enum(["bot", "user"]);
export type PageAuthor = z.infer<typeof PageAuthor>;

/** blocks: Markdown with live blocks. html: one sandboxed HTML document. Fixed when the page is created. */
export const PageKind = z.enum(["blocks", "html"]);
export type PageKind = z.infer<typeof PageKind>;

export const BotPageTitleSchema = z.string().trim().min(1).max(BOT_PAGE_TITLE_MAX);

export const BotPageSchema = z.object({
  id: Id,
  botId: Id,
  title: BotPageTitleSchema,
  content: z.string().max(BOT_PAGE_MAX_CHARS),
  kind: PageKind.default("blocks"),
  /** Increments on every save; writes must name the revision they were based on. */
  revision: z.number().int().positive(),
  updatedBy: PageAuthor,
  updatedAt: z.string(),
  /** Server-rendered SVG per chart fence, in document order. Only when requested (mobile). */
  chartSvgs: z.array(z.string()).optional(),
});
export type BotPage = z.infer<typeof BotPageSchema>;

/** Without pageId, the bot's first page (oldest) is meant. */
export const BotPageGetInputSchema = z.object({
  botId: Id,
  pageId: Id.optional(),
  chartSvgs: z.boolean().optional(),
});

export const BotPageSaveInputSchema = z.object({
  botId: Id,
  pageId: Id.optional(),
  content: z.string().max(BOT_PAGE_MAX_CHARS),
  /** 0 creates the page. */
  baseRevision: z.number().int().nonnegative(),
});

/** A stale baseRevision returns the current page so the client can reload instead of overwriting. */
export const BotPageSaveOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), page: BotPageSchema }),
  z.object({ ok: z.literal(false), reason: z.literal("conflict"), page: BotPageSchema }),
]);
export type BotPageSaveOutput = z.infer<typeof BotPageSaveOutputSchema>;

export const BotPageSummarySchema = z.object({
  id: Id,
  title: BotPageTitleSchema,
  kind: PageKind.default("blocks"),
  revision: z.number().int().positive(),
  updatedAt: z.string(),
});
export type BotPageSummary = z.infer<typeof BotPageSummarySchema>;

export const BotPageListInputSchema = z.object({ botId: Id });
export const BotPageCreateInputSchema = z.object({
  botId: Id,
  title: BotPageTitleSchema,
  kind: PageKind.optional(),
});
export const BotPageRenameInputSchema = z.object({
  botId: Id,
  pageId: Id,
  title: BotPageTitleSchema,
});
export const BotPageRemoveInputSchema = z.object({ botId: Id, pageId: Id });
