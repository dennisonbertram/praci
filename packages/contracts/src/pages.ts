import * as z from "zod";
import { MAX_CHART_DATA_ROWS } from "./events.js";
import { Id } from "./ids.js";

/**
 * A bot's page: one Markdown document per bot that the bot writes with tools and the user
 * edits in place. Charts are fenced ```chart blocks whose body is a PageChart JSON object.
 */
export const BOT_PAGE_MAX_CHARS = 200_000;
export const BOT_PAGE_MAX_CHARTS = 20;
export const PAGE_CHART_FENCE = "chart";

/** Snapshot charts carry their rows. Live charts (a later `source` field) will resolve them on view. */
export const PageChartSchema = z.object({
  name: z.string().min(1).max(200),
  /** Declarative Observable Plot spec; validated with the same PlotSpec rules as render_plot. */
  spec: z.record(z.string(), z.any()),
  data: z.array(z.any()).max(MAX_CHART_DATA_ROWS),
});
export type PageChart = z.infer<typeof PageChartSchema>;

export const PageAuthor = z.enum(["bot", "user"]);
export type PageAuthor = z.infer<typeof PageAuthor>;

export const BotPageSchema = z.object({
  botId: Id,
  content: z.string().max(BOT_PAGE_MAX_CHARS),
  /** Increments on every save; writes must name the revision they were based on. */
  revision: z.number().int().positive(),
  updatedBy: PageAuthor,
  updatedAt: z.string(),
  /** Server-rendered SVG per chart fence, in document order. Only when requested (mobile). */
  chartSvgs: z.array(z.string()).optional(),
});
export type BotPage = z.infer<typeof BotPageSchema>;

export const BotPageGetInputSchema = z.object({ botId: Id, chartSvgs: z.boolean().optional() });

export const BotPageSaveInputSchema = z.object({
  botId: Id,
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
