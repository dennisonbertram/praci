import * as z from "zod";
import { BotSecretName } from "./bot-secrets.js";
import { Id } from "./ids.js";
import { PinFormat } from "./pins.js";

/**
 * Live pages: a page's saved read-only data sources and the live blocks that read them.
 * A source is a saved call that the server reruns without a model; each success is stored as a
 * snapshot. Blocks name a source and say which part of its result to show. See
 * docs/agent-pages/live-pages.md.
 */
export const PAGE_SOURCES_MAX_PER_PAGE = 20;
/** Live fences (metric, table) plus charts with a source, per page. */
export const PAGE_LIVE_BLOCKS_MAX = 20;
/** A stored result larger than this is refused, and the refresh fails. */
export const PAGE_SOURCE_VALUE_MAX_BYTES = 1_000_000;
export const PAGE_TABLE_MAX_ROWS = 200;
export const PAGE_METRIC_FENCE = "metric";
export const PAGE_TABLE_FENCE = "table";
export const PAGE_LIVE_FENCES = [PAGE_METRIC_FENCE, PAGE_TABLE_FENCE] as const;

/** An "mcp" or "http" source needs the owner's approval before it runs. */
export const PageSourceKind = z.enum(["praci", "mcp", "http"]);
export type PageSourceKind = z.infer<typeof PageSourceKind>;

export const PageSourceSchedule = z.enum(["15m", "1h", "6h", "1d", "1w"]);
export type PageSourceSchedule = z.infer<typeof PageSourceSchedule>;

/** pending and denied apply to outside (mcp) sources, which wait for the owner's approval; Praci sources start active. */
export const PageSourceStatus = z.enum(["pending", "active", "paused", "denied"]);
export type PageSourceStatus = z.infer<typeof PageSourceStatus>;

/** Unique per page. Blocks refer to a source by this name. */
export const PageSourceNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, "Use letters, digits, spaces, - or _.");

/** RFC 6901 JSON Pointer into a source's result; "" is the whole result. */
export const JsonPointerSchema = z
  .string()
  .max(300)
  .regex(/^(\/.*)?$/, 'A path is "" or starts with "/".');

/** A read-only built-in tool, run as the bot's owner with the same checks as a bot run. */
export const PraciSourceCallSchema = z.strictObject({
  tool: z.string().min(1).max(100),
  args: z.record(z.string(), z.unknown()),
});
export type PraciSourceCall = z.infer<typeof PraciSourceCallSchema>;

/** One read-only tool on one of the bot's MCP servers, rerun with these exact arguments. */
export const McpSourceCallSchema = z.strictObject({
  serverId: Id,
  tool: z.string().min(1).max(200),
  args: z.record(z.string(), z.unknown()),
});
export type McpSourceCall = z.infer<typeof McpSourceCallSchema>;

export const HTTP_SOURCE_URL_MAX = 1_000;

/** One GET of a JSON or CSV API, optionally with a saved key. Never a body, method or header. */
export const HttpSourceCallSchema = z.strictObject({
  url: z
    .string()
    .max(HTTP_SOURCE_URL_MAX)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === "https:" || url.protocol === "http:") &&
          !url.username &&
          !url.password &&
          !value.includes("#")
        );
      } catch {
        return false;
      }
    }, "Use an absolute http(s) URL without credentials or a fragment."),
  secret: BotSecretName.optional(),
  accept: z.enum(["json", "csv"]).default("json"),
});
export type HttpSourceCall = z.infer<typeof HttpSourceCallSchema>;

export const PageSourceSchema = z.object({
  id: Id,
  pageId: Id,
  name: PageSourceNameSchema,
  kind: PageSourceKind,
  call: z.union([PraciSourceCallSchema, McpSourceCallSchema, HttpSourceCallSchema]),
  /** An mcp source: the server's name, for display. */
  serverName: z.string().optional(),
  schedule: PageSourceSchedule,
  status: PageSourceStatus,
  lastRefreshAt: z.string().nullable(),
  /** Set while the latest refresh failed; the last good snapshot is still shown. */
  lastError: z.string().nullable(),
});
export type PageSource = z.infer<typeof PageSourceSchema>;

/** ```metric fence: one number or short text from a source. */
export const PageMetricBlockSchema = z.strictObject({
  label: z.string().trim().min(1).max(40),
  source: PageSourceNameSchema,
  path: JsonPointerSchema.default(""),
  format: PinFormat.default("number"),
});
export type PageMetricBlock = z.infer<typeof PageMetricBlockSchema>;

export const PageTableColumnSchema = z.strictObject({
  key: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(40),
  format: PinFormat.optional(),
});

/** ```table fence: rows from an array in a source. Without columns, the first row's keys are used. */
export const PageTableBlockSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  source: PageSourceNameSchema,
  path: JsonPointerSchema.default(""),
  columns: z.array(PageTableColumnSchema).min(1).max(12).optional(),
  limit: z.number().int().min(1).max(PAGE_TABLE_MAX_ROWS).default(50),
});
export type PageTableBlock = z.infer<typeof PageTableBlockSchema>;

/**
 * What a live block shows. ok: fresh data. failed: the latest refresh failed; rows or text are
 * from the last good snapshot when one exists. pending/paused/denied: the source's status.
 * missing: no source with that name on this page. empty: the source has not produced data yet,
 * or the path does not point at a value of the right shape.
 */
export const PageLiveStatus = z.enum([
  "ok",
  "failed",
  "pending",
  "paused",
  "denied",
  "missing",
  "empty",
]);
export type PageLiveStatus = z.infer<typeof PageLiveStatus>;

export const PageLiveBlockSchema = z.object({
  status: PageLiveStatus,
  /** When the shown data was fetched. */
  fetchedAt: z.string().nullable(),
  error: z.string().optional(),
  /** metric: the formatted value. */
  text: z.string().optional(),
  /** table: the rows to show (already limited). chart: the rows the spec plots. */
  rows: z.array(z.unknown()).optional(),
});
export type PageLiveBlock = z.infer<typeof PageLiveBlockSchema>;

/**
 * Live data for one page revision. `blocks` follows document order of live segments: every
 * metric and table fence and every chart that has a `source`. Static charts are not included.
 */
export const PageBlocksDataSchema = z.object({
  pageId: Id,
  revision: z.number().int().positive(),
  blocks: z.array(PageLiveBlockSchema),
});
export type PageBlocksData = z.infer<typeof PageBlocksDataSchema>;

/** Largest `pages.data` payload for an HTML page; the oldest history goes first. */
export const PAGE_HTML_DATA_MAX_BYTES = 1_000_000;
export const PAGE_HTML_HISTORY_MAX = 500;

/** One source as an HTML page receives it. `value` is the newest snapshot (already redacted when stored). */
export const PageHtmlSourceDataSchema = z.object({
  status: PageLiveStatus,
  fetchedAt: z.string().nullable(),
  error: z.string().optional(),
  value: z.unknown().optional(),
  /** Newest first; only for sources the page lists in praci-history. */
  history: z.array(z.object({ at: z.string(), value: z.unknown() })).optional(),
});
export type PageHtmlSourceData = z.infer<typeof PageHtmlSourceDataSchema>;

/** An HTML page gets only the sources it declares in `<meta name="praci-sources">`, keyed by the declared name. */
export const PageHtmlDataSchema = z.object({
  kind: z.literal("html"),
  pageId: Id,
  revision: z.number().int().positive(),
  sources: z.record(z.string(), PageHtmlSourceDataSchema),
});
export type PageHtmlData = z.infer<typeof PageHtmlDataSchema>;

/** Blocks pages keep their original shape (no `kind`); HTML pages carry `kind: "html"`. */
export const PageDataSchema = z.union([PageHtmlDataSchema, PageBlocksDataSchema]);
export type PageData = z.infer<typeof PageDataSchema>;

export const PageDataInputSchema = z.object({ botId: Id, pageId: Id.optional() });
/** Reruns every active source on the page now (at most once a minute per page). */
export const PageRefreshInputSchema = PageDataInputSchema;
export const PageShareInputSchema = z.object({ botId: Id, pageId: Id.optional() });
/** A view-only link to a frozen copy of the page. artifactId names the copy for Stop sharing. */
export const PageShareOutputSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
  artifactId: Id,
});
export const PageSourcesListInputSchema = PageDataInputSchema;
export const PageSourceRemoveInputSchema = z.object({ botId: Id, sourceId: Id });
export const PageSourceScheduleInputSchema = z.object({
  botId: Id,
  sourceId: Id,
  schedule: PageSourceSchedule,
});
