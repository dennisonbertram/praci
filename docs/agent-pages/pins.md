# Agent pins: numbers strip and sidebar list

Agent pages (README.md) give each bot a document, but you have to open it to see it.
Pins put a bot's most important state in its chat view itself:

- **Numbers strip:** up to six top-line numbers above the chat, such as "Higgsfield spend
  this month" or "Sales vs goal". A refresh button updates them.
- **Sidebar list:** one list beside the chat, for example a to-do list.

Both are optional and appear only once the bot writes them.

## Decisions

1. **Pins are separate from the page.** They have their own row and revision, so a refresh
   never conflicts with page edits.
2. **Refresh works two ways.** A number can carry a saved read-only MCP tool call
   (`source`). Refresh reruns that call with no model. If any number has no source, refresh
   also sends the bot a visible message asking it to update its numbers, and the bot
   rewrites them with `pins_write`. A failed source keeps the old value and sets `error`.
3. **The user and the bot both fully edit the list.** The user can add, rename, tick and
   delete items. Saves are revision-checked like pages: a stale save returns the current
   pins, and the client reloads. The stats are the bot's; the user doesn't edit them.
4. **Mobile:** the numbers are a horizontal strip under the header, and the list opens from
   a header button as a native form sheet.

## Contract (`packages/contracts/src/pins.ts`)

- Limits: `BOT_PINS_MAX_STATS` = 6, `BOT_PINS_MAX_ITEMS` = 50.
- `PinSource`: `{ serverId, tool, args, path, format }`.
  - `path` is a JSON Pointer into the tool's parsed result.
  - `format` is one of `number`, `usd`, `percent` or `text`.
- `PinStat`: `{ id, label ≤40, value ≤40, detail? ≤80, source?, error? }`.
- `PinItem`: `{ id, text ≤300, done }`.
- `PinList`: `{ title ≤60, items }`.
- `BotPins`: `{ botId, stats, list | null, revision, updatedBy: "bot"|"user", updatedAt, refreshedAt | null }`.
- RPC:
  - `pins.get({ botId }) → BotPins | null`
  - `pins.save({ botId, list, baseRevision }) → { ok: true, pins } | { ok: false, reason: "conflict", pins }`.
    The user saves only the list; `baseRevision: 0` creates the pins.
  - `pins.refresh({ botId }) → { pins, botRun }`
- Thread event `pins.updated` carries `{ revision, updatedBy }` and is emitted on every save and refresh.
- Built-in tools `pins_read` (read-only) and `pins_write { stats?, list?, baseRevision }`.
  `pins_write` replaces only the sections it is given.

The full draft of the zod file is at the end of this document.

## Pieces

### Backend

- Prisma `BotPins` (`spaceId`, `botId` unique, `userId`, `stats` Json, `list` Json?,
  `revision`, `updatedBy`, `refreshedAt`) in one migration, cascading with the bot and space.
- One `saveBotPins` in `packages/adapters/src/pins.ts`, shared by the RPC and the tools. It:
  - validates the pins;
  - checks the revision;
  - emits `pins.updated` on the bot's thread.

  It follows `saveBotPage` and `pageToolFromTool` in `pages.ts`.
- Validating a source:
  - The server must belong to the bot's space and owner, the bot must still be assigned to
    it, and the assignment's tool allowlist must allow the tool.
  - The server must list the tool, no annotation may declare a write (`readOnlyHint: false`
    or `destructiveHint: true`), and `connectorToolRequiresApproval` must return false for
    its name. Refresh never runs a tool a bot run would need approval for.
  - These checks run both on write and again on refresh.
- Refresh:
  - Each sourced stat is called through `McpConnector.callServerTool`, following
    `finance-call-tool.ts`, with a short timeout. The calls run in parallel.
  - The value at `path` is formatted.
  - If any stat lacks a source, refresh calls `events.sendUserMessage` with "Update your
    pinned numbers." and returns `botRun: true`. An active run is steered instead.
- Handlers authorize with `repos.getBot(context.actor, botId)`, like `pages.*`.
- The tools are dispatched in `executor.ts` next to `page_*`. Their scope comes from the
  run's bot, never from model input.
- A short system-prompt clause says when pins help: numbers the user checks often, and an
  ongoing list.

### Web and Electron (`Shell.tsx`)

- The numbers strip is the first child of the thread view, and only shows when there are stats.
  - Each stat shows its label, value and detail.
  - When a stat has an `error`, it shows a warning tooltip.
  - A refresh icon button sits at the end of the strip and spins while the refresh runs.
- The list is a fixed-width column to the right of the transcript at `lg` and wider.
  - Below `lg`, a header button opens it in `ResizableSidePanel` instead.
  - Item text is edited inline. There is a checkbox, an "Add item" row, and delete on hover.
  - Saves happen with `baseRevision`.
- On `pins.updated`, the client reloads unless an edit is in progress.

### Mobile

- `thread.tsx` shows a horizontal `ScrollView` strip above the `FlatList`, with a refresh button.
- A header item opens a new `agent-list` route that uses `presentation: "formSheet"`.
  - The route lists the items with native switches or checkmarks.
  - Items can be added, edited and deleted.

## Tests

- Postgres tests for `saveBotPins` cover:
  - a revision conflict;
  - a source pointing at another space's server, which is rejected;
  - a non-read-only tool, which is rejected;
  - a refresh with a failing source, which keeps the old value and sets `error`.
- Unit tests cover JSON Pointer extraction and value formatting.
- A web E2E test seeds pins through `pins/save` and the tool path, then checks that the strip and the list render, that ticking an item saves, and the narrow-width panel.

## Not in v1

- More than one list, or more than six numbers.
- Charts in the strip. Charts stay on the page.
- Built-in (non-MCP) tools as sources.

## Contract draft

```ts
import * as z from "zod";
import { Id } from "./ids.js";
import { PageAuthor } from "./pages.js";

export const BOT_PINS_MAX_STATS = 6;
export const BOT_PINS_MAX_ITEMS = 50;

export const PinFormat = z.enum(["number", "usd", "percent", "text"]);

export const PinSourceSchema = z.object({
  serverId: Id,
  tool: z.string().min(1).max(200),
  args: z.record(z.string(), z.any()),
  path: z.string().max(300),
  format: PinFormat,
});

export const PinStatSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  value: z.string().max(40),
  detail: z.string().max(80).optional(),
  source: PinSourceSchema.optional(),
  error: z.string().max(200).optional(),
});

export const PinItemSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(300),
  done: z.boolean(),
});

export const PinListSchema = z.object({
  title: z.string().min(1).max(60),
  items: z.array(PinItemSchema).max(BOT_PINS_MAX_ITEMS),
});

export const BotPinsSchema = z.object({
  botId: Id,
  stats: z.array(PinStatSchema).max(BOT_PINS_MAX_STATS),
  list: PinListSchema.nullable(),
  revision: z.number().int().positive(),
  updatedBy: PageAuthor,
  updatedAt: z.string(),
  refreshedAt: z.string().nullable(),
});

export const BotPinsSaveInputSchema = z.object({
  botId: Id,
  list: PinListSchema.nullable(),
  baseRevision: z.number().int().nonnegative(),
});

export const BotPinsSaveOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), pins: BotPinsSchema }),
  z.object({ ok: z.literal(false), reason: z.literal("conflict"), pins: BotPinsSchema }),
]);

export const BotPinsRefreshOutputSchema = z.object({ pins: BotPinsSchema, botRun: z.boolean() });
```
