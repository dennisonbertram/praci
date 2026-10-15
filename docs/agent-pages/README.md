# Agent pages

Each bot can keep one page: a persistent document it writes and the user edits in place.
The page mixes rich text with Observable Plot charts. It is where a bot's ongoing work
lands (a weekly summary, a burn dashboard, a hiring tracker), instead of scrolling away
in chat.

## Decisions

1. **One page per bot.** More pages can come later; nothing in v1 needs a page id.
2. **Markdown is the stored format.** Models write Markdown reliably; it diffs, exports,
   and renders on mobile without an editor. Tiptap reads and writes it on web through
   `@tiptap/markdown`.
3. **Charts are fenced blocks.** A ` ```chart ` fence holds a `PageChart` JSON object
   (`name`, `spec`, `data`). The spec is the same JSON-only, allowlisted `PlotSpec` that
   `render_plot` uses. There is no HTML or script anywhere in a page.
4. **Writes are revision-checked.** Every write names the revision it was based on. A
   stale write fails and returns the current page, so neither the bot nor the user
   silently overwrites the other.
5. **Snapshot data first, live data next.** v1 charts embed their rows; Routines refresh
   them on a schedule. Live charts are the planned fast follow (see below), and v1 is
   shaped so they slot in without a format change.
6. **Mobile is read-only in v1.** It renders the Markdown natively and charts as
   server-rendered SVG. Editing needs Tiptap in a WebView and is deferred.

## Contract

`packages/contracts/src/pages.ts`:

- `BotPageSchema` — `{ botId, content, revision, updatedBy: "bot" | "user", updatedAt, chartSvgs? }`
- `PageChartSchema` — `{ name, spec, data }`
- Limits: `BOT_PAGE_MAX_CHARS` (200,000), `BOT_PAGE_MAX_CHARTS` (20), chart rows capped by
  `MAX_CHART_DATA_ROWS`.
- RPC `pages.get({ botId, chartSvgs? }) → BotPage | null`
- RPC `pages.save({ botId, content, baseRevision }) → { ok: true, page } | { ok: false, reason: "conflict", page }`
  (`baseRevision: 0` creates the page)
- Thread event `page.updated` with payload `{ revision, updatedBy }`, emitted on every save.

## Pieces

### Backend (db, api, adapters)

- Prisma `BotPage` (`spaceId`, `botId` unique, `userId`, `content`, `revision`,
  `updatedBy`) and `BotPageRevision` (`pageId`, `revision`, `content`, `updatedBy`,
  `sourceRunId?`), following `MemoryDocument` / `MemoryRevision`. One migration.
- One shared server function validates and saves a page: size and chart-count limits,
  every chart fence parses as `PageChart` and passes PlotSpec validation, revision check,
  revision row, `page.updated` event. Both the RPC and the bot tools call it.
- RPC handlers authorize by space membership and bot ownership.
- Built-in tools, available to every bot:
  - `page_read` → content and revision.
  - `page_write { content, baseRevision }` → replace the page.
  - `page_edit { old_string, new_string, baseRevision }` → exact, unique replacement.
  Scope comes from the run's bot, never from model input. Validation errors are returned
  to the model so it can fix the page.
- `chartSvgs` is rendered with `renderPlotSpecToSvg` only when requested.
- A short skill note tells bots when a page helps (durable, revisited output) and how to
  write chart fences.

### Web and Electron

- A "Page" panel in the bot view (`Shell.tsx` `panel` state). The control appears only
  once the bot has a page.
- Tiptap editor: StarterKit + `@tiptap/markdown` + a `chart` node that renders through
  the existing `ChartCanvas`. Charts can be deleted but not hand-edited.
- Debounced save with `baseRevision`. On `page.updated`, reload if there are no unsaved
  edits; otherwise offer one reload action. On a save conflict, do the same.

### Mobile

- A header item on the bot thread opens a page screen when the bot has a page.
- Markdown through the existing renderer; chart fences through `SvgXml` with
  `chartSvgs` from `pages.get`.

## Fast follow: live charts

Add an optional `source` to `PageChart`: a read-only built-in tool name plus arguments
(for example `finance_overview`). A new `pages.chartData({ botId, revision, index })`
RPC runs that tool scoped to the bot's owner and returns rows; `data` stays as the
last snapshot and the fallback. To keep that change small, v1 code must:

- read chart rows through one function on each surface (web hook, server SVG renderer),
  so swapping in live rows is a single change;
- keep chart fence parsing in one shared function (`splitPage` / `parsePageChart` in
  `packages/core/src/pages.ts`) used by the API, tools, and renderers.

Only tools marked `readOnly` may be sources, and the same owner and scope checks that
apply to the bot's runs apply to chart refreshes.

## Not in v1

- Bot-authored HTML or JavaScript pages.
- Several pages per bot.
- Editing on mobile.
- Hand-editing chart specs in the editor.
