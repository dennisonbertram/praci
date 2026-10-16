import * as z from "zod";
import { Id } from "./ids.js";
import { PageAuthor } from "./pages.js";

/**
 * A bot's pins: a strip of top-line numbers above its chat and one list beside it. The bot
 * writes both with tools; the user edits the list. Separate from the page so refreshing a
 * number never conflicts with page edits.
 */
export const BOT_PINS_MAX_STATS = 6;
export const BOT_PINS_MAX_ITEMS = 50;
export const BOT_PINS_ITEM_TEXT_MAX = 60;

export const PinFormat = z.enum(["number", "usd", "percent", "text"]);
export type PinFormat = z.infer<typeof PinFormat>;

/**
 * A saved read-only MCP tool call that produces a number without a model. `path` is a JSON
 * Pointer (RFC 6901) into the tool's parsed result, e.g. "/accounts/0/balance".
 */
export const PinSourceSchema = z.object({
  serverId: Id,
  tool: z.string().min(1).max(200),
  args: z.record(z.string(), z.any()),
  path: z.string().max(300),
  format: PinFormat,
});
export type PinSource = z.infer<typeof PinSourceSchema>;

export const PinStatSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  value: z.string().max(40),
  /** A short qualifier such as "of $50,000 goal". */
  detail: z.string().max(80).optional(),
  /** Without a source, refresh asks the bot to rerun. */
  source: PinSourceSchema.optional(),
  /** Set when the last source refresh failed; the value is the previous one. */
  error: z.string().max(200).optional(),
});
export type PinStat = z.infer<typeof PinStatSchema>;

export const PinItemSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(BOT_PINS_ITEM_TEXT_MAX),
  done: z.boolean(),
});
export type PinItem = z.infer<typeof PinItemSchema>;

export const PinListSchema = z.object({
  title: z.string().min(1).max(60),
  items: z.array(PinItemSchema).max(BOT_PINS_MAX_ITEMS),
});
export type PinList = z.infer<typeof PinListSchema>;

export const BotPinsSchema = z.object({
  botId: Id,
  stats: z.array(PinStatSchema).max(BOT_PINS_MAX_STATS),
  list: PinListSchema.nullable(),
  /** Increments on every save; writes must name the revision they were based on. */
  revision: z.number().int().positive(),
  updatedBy: PageAuthor,
  updatedAt: z.string(),
  /** When the numbers were last refreshed (by source or by the bot). */
  refreshedAt: z.string().nullable(),
});
export type BotPins = z.infer<typeof BotPinsSchema>;

export const BotPinsGetInputSchema = z.object({ botId: Id });

/** The user edits only the list. Stats are the bot's. */
export const BotPinsSaveInputSchema = z.object({
  botId: Id,
  list: PinListSchema.nullable(),
  /** 0 creates the pins. */
  baseRevision: z.number().int().nonnegative(),
});

export const BotPinsSaveOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), pins: BotPinsSchema }),
  z.object({ ok: z.literal(false), reason: z.literal("conflict"), pins: BotPinsSchema }),
]);
export type BotPinsSaveOutput = z.infer<typeof BotPinsSaveOutputSchema>;

export const BotPinsRefreshInputSchema = z.object({ botId: Id });

/** `botRun` is true when some numbers had no source and the bot was asked to rerun. */
export const BotPinsRefreshOutputSchema = z.object({
  pins: BotPinsSchema,
  botRun: z.boolean(),
});
export type BotPinsRefreshOutput = z.infer<typeof BotPinsRefreshOutputSchema>;
