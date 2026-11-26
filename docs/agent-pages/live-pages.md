# Live pages: agent-built pages with data that refreshes on a schedule

Status: plan only, no product code. File references were read at `origin/main` (3c0ebfbca). Mockup: `docs/agent-pages/live-pages-mockup.html`. Format follows `docs/omi/README.md` and `docs/brex-cards/README.md`. This extends [the agent page](README.md) and [pins](pins.md).

## Decisions

The owner already decided: both page formats (structured blocks by default, bot-written HTML when blocks cannot do it); three source kinds (read-only connector/MCP calls, read-only API requests through a saved key that stays on the server, Praci's own data); refresh on a schedule with no model run, stored history, and a failed refresh that keeps the last value and shows the error; several named pages per bot, any of which the owner can add to the sidebar.

All eight decisions below were answered by the owner on 2026-10-30: each recommendation was accepted as written, and the plan follows it.

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Which block format do pages use? **Decided (2026-10-30): the recommendation.** | **A.** Extend the Markdown page (`BotPage`, ```` ```chart ```` fences). **B.** Move pages to the UI-artifact vocabulary (`packages/ui-artifact`). | **A.** The Markdown page already has revisions, conflict-checked writes, a web editor, server-rendered chart SVG for mobile, a working live-block precedent (GTM fences) and two marked seams for live rows. The UI-artifact vocabulary has no sources, no revisions and a weaker chart (line/bar, 60 points). It stays what it is today: one-off dashboards attached to chat. |
| D2 | Where does a source live? **Decided (2026-10-30): the recommendation.** | **A.** Its own row (`PageSource`), referenced from blocks by name. **B.** Inline in each fence's JSON. | **A.** The scheduler needs a row to claim, the approval needs a stable thing to approve, history needs a key, and several blocks can share one call. A fence holds only `"source": "cash"` plus how to show it. |
| D3 | Which sources need the owner's approval? **Decided (2026-10-30): the recommendation.** | **A.** MCP and API sources need an approval card on create and on any change to what they call; Praci-data sources need none. **B.** Every source needs a card. **C.** Normal approval rules decide. | **A.** A Praci-data source reads only what the bot can already read in a run, under the same gates. An MCP or API source makes outside calls on a timer forever, which is exactly what "unattended bots can't silently add API calls" rules out. Allow rules never skip this card (same as the unattended rule today). |
| D4 | What does an API source call through? **Decided (2026-10-30): the recommendation.** | **A.** A bot secret (`secret_request`'s store), GET only, origin pinned to the secret's saved origin; keyless GET allowed for public URLs. **B.** Installed API connections (`CapabilityInstall`, declared operations). **C.** Both. | **A.** Bot secrets are what a bot can obtain on its own (through the `request_secret` card), `requestWithBotSecret` already pins the origin, injects the key server-side, redacts echoes and runs without a model. Installed connections need the owner to declare operations by hand; add them later only if asked. |
| D5 | How fine is the schedule? **Decided (2026-10-30): the recommendation.** | **A.** Fixed choices: 15 min, hourly, 6 hours, daily (time of day), weekly. **B.** Cron strings like Routines. | **A.** Easy to show and to budget. 15 minutes is the floor. |
| D6 | How long is history kept? **Decided (2026-10-30): the recommendation.** | **A.** 400 days, at most 2,000 snapshots per source, oldest pruned first. **B.** Keep forever. **C.** 90 days. | **A.** A year of hourly data does not fit in 2,000 rows, so hourly sources keep ~83 days of full history; a later downsample can keep one per day if charts need longer. |
| D7 | How is a page shared? **Decided (2026-10-30): the recommendation.** | **A.** Snapshot link through the existing `ArtifactShare` (view-only, 30 days, frozen numbers, no sources). **B.** A live public link. **C.** No sharing in v1. | **A**, as the last slice. It reuses the audited public route and never exposes a source or key. A live link needs a public data path and is left for later. |
| D8 | What about the page each bot has today? **Decided (2026-10-30): the recommendation.** | **A.** It becomes that bot's first named page, titled with the bot's name. **B.** Keep it separate. | **A.** One model, one set of tools. |

## Summary

A bot gets tools to create several named pages and to save read-only data sources. Page blocks (numbers, tables, charts) name a source instead of carrying rows. A worker job refreshes due sources on their own schedule without a model, stores each result as a snapshot, and the page reads the newest snapshot (or the history, for trend charts). A new or changed outside source waits for the owner's approval. When a source keeps failing, the page keeps its last value and the bot gets one message so it can fix the source. When blocks cannot express a design, the bot writes an HTML page that runs in the existing locked-down frame and receives the same server-fetched data by `postMessage`.

## User story

1. I ask the Finance agent for a cash page. It creates "Cash" with three numbers, a 12-week cash chart and a vendor table, all reading from `finance_overview` and `finance_transactions`. No card appears, because these are Praci's own data.
2. I ask it to add revenue from our billing API. It asks for a key (the existing secret card), then saves a source `GET https://api.example.com/v1/revenue?period=week`, hourly. A card asks me to allow it; the chart shows "Waiting for approval" until I do.
3. Overnight the billing API times out. The revenue number keeps yesterday's value with a warning dot and the error. After five failures in a row the source pauses and the agent gets one message; it finds the API moved to `/v2`, proposes the changed source, and I approve the new card.
4. I add "Cash" to my sidebar and open it on my phone.

## What exists today (verified)

- **Page.** `BotPage` is one Markdown page per bot (`botId @unique`, no title) with `BotPageRevision` history (`packages/db/prisma/schema.prisma:1640-1659`, `:1681-1694`). Tools `page_read`, `page_write`, `page_edit` (`packages/adapters/src/builtin-tools.ts:525-556`); writes are revision-checked and capped at 200,000 chars, 20 charts, 5,000 rows per chart (`packages/adapters/src/pages.ts:60-97`, `packages/contracts/src/pages.ts:9-11`, `packages/contracts/src/chart.ts:3`). RPCs `pages.get`/`pages.save` keyed by `botId` (`packages/contracts/src/rpc.ts:887-890`, `apps/api/src/router.ts:4308-4345`). Page writes need no approval and are unattended-safe (`packages/core/src/action-approval.ts:98-102`).
- **Charts.** A ```` ```chart ```` fence holds `{name, spec, data}` with static rows (`packages/contracts/src/pages.ts:14-19`), parsed by `parsePageChart`/`splitPage` (`packages/core/src/pages.ts:26-36`, `:80-151`). The contract types `spec` as `z.record(z.any())` (`packages/contracts/src/chart.ts:6`); the real check is rendering at save time, which allowlists mark and transform names (`packages/core/src/plot/plot-spec.ts:51-121`, `:217-256`) but spreads other top-level options into `Plot.plot` unchecked (`:315-354`). Rows are read in one place per surface, both marked as the seam for live data: `usePageChartRows` (`apps/web/src/pages/shell/page-chart-extension.ts:6-9`) and `renderChart` (`packages/adapters/src/pages.ts:46-49`).
- **Live blocks already exist** for the GTM agent: `gtm-plan`, `gtm-channels`, `gtm-metric` fences store only a query and render live data, max 12 per page, only on GTM pages (`packages/contracts/src/gtm.ts:73-97`, `packages/core/src/pages.ts:181-240`). This plan follows the same shape.
- **Surfaces.** Web: Tiptap panel beside the chat, charts delete-only (`apps/web/src/pages/shell/bot-page-panel.tsx`). Expo: read-only, server-rendered chart SVG via `pages/get` with `chartSvgs: true`, GTM blocks dropped (`apps/mobile/app/agent-page.tsx:68`, `:113-116`; `apps/mobile/lib/agent-page.ts:17`). Native iOS: `apps/ios/Sources/Praci/AgentPages/AgentPageScreen.swift`.
- **Pins.** `BotPins` stores up to six formatted numbers in JSON, no history (`schema.prisma:1661-1679`). A pin `source` is `{serverId, tool, args, path, format}` on an MCP server; `pins.refresh` reruns it with no model (`packages/adapters/src/pins.ts:394-475`). The read-only check `checkSource` (`pins.ts:167-223`) runs on write, on refresh and again right before the call: the bot must still have the server and tool, the tool must be in a fresh listing, and it must not be marked `readOnlyHint: false` or `destructiveHint: true` and must have a read-like name (`packages/core/src/action-approval.ts:130-134`, `:191-196`); integration-agent tools use `isReadTool` (`packages/contracts/src/integration-agent.ts:320-331`). **There is no schedule**: the only caller is the refresh button's RPC (`apps/api/src/router.ts:4372-4382`).
- **Outbound safety.** `fetchSafeWebBytes`/`fetchSafeWebText` (`packages/adapters/src/web-ssrf.ts:50-141`) allow only http(s), block private and metadata addresses, re-check DNS at connect (rebinding), re-check every redirect, 15 s and 5 MB limits. Site matching is `urlSite`/`hostSite` (registrable domain) in `packages/core/src/egress.ts:11-43`; `site` is one of four approval rule kinds (`packages/contracts/src/domain.ts:949`), matched exactly (`packages/core/src/action-approval.ts:572-593`).
- **Saved keys.** `requestWithBotSecret` (`packages/adapters/src/bot-secrets.ts:544-640`) takes `{userId, spaceId, botId}`, refuses any URL whose origin differs from the secret's saved origin (`:566-570`), adds the key server-side, redacts echoes, 30 s and 1 MB limits, safe fetch. GET/HEAD through it is the one keyed call unattended runs may make (`action-approval.ts:270-273`).
- **Scheduling.** graphile-worker with `RECURRING_JOBS` (`packages/adapters/src/wakeup.ts:119-133`). Routines always start a model run (`packages/adapters/src/executor.ts:1288`), so they are not the refresh path. The model to copy is the watch probe: a minute cron `watch.probe` calls `claimDueWatchChecks`, which claims due rows with `FOR UPDATE ... SKIP LOCKED` and a 10-minute lease (`packages/db/src/routine-watch.ts:55-86`), with backoff and auto-pause after five errors (`docs/routines-and-watches.md`).
- **RLS.** Each table gets `<table>_tenant` and `<table>_system` policies (example `packages/db/prisma/migrations/20261231000024_omi_uploads/migration.sql:34-38`) and an entry in `ROW_SECURITY_MODELS` (`packages/db/src/row-security.ts:98`); `row-security.postgres.test.ts:787-818` fails otherwise. Jobs start as system and narrow with `asPayloadTenant`/`asOwner` (`packages/adapters/src/background-job-handlers.ts:84-102`).
- **Retention template.** `deleteExpiredMessagingTransport` deletes in batches of 1,000 from a daily cron (`packages/db/src/messaging-retention.ts:14-35`, `wakeup.ts:124`).
- **Sandboxed HTML.** `SandboxedHtmlViewer` loads `/html-viewer.html` in an `allow-scripts` iframe (opaque origin), which places the document in a nested frame under `default-src 'none'` (no `connect-src`, so no network) and blocks navigation and forms (`apps/web/src/components/SandboxedHtmlViewer.tsx:5-18`, `:171-218`; `apps/web/public/html-viewer.html`). Today the only messages are the initial document and email height; there is no data channel. Expo uses `SandboxedHtmlPreview` with the same CSP (`packages/core/src/artifact-sandbox.ts:24`).
- **Sidebar.** `SidebarPage` stores only a `templateKey`, unique per (space, user, template) (`schema.prisma:3333-3347`); both templates are unavailable today (`packages/contracts/src/sidebar-pages.ts:4-19`). It cannot point at a bot page yet.
- **Sharing.** `ArtifactShare` is a view-only public link to one exact artifact version, token hash only, 30 days, rate-limited, served by `POST /api/share/open` (`schema.prisma:1829-1848`, `apps/api/src/artifact-share.ts:37-77`).

## Design

### Pages

`BotPage` drops `botId @unique`, gains `title` (1–60 chars) and `kind` (`blocks` | `html`), and is addressed by `id`. A bot has at most 20 pages. The existing row becomes the first page (D8) in the migration. RPCs become `pages.list({botId})`, `pages.get({pageId, chartSvgs?})`, `pages.save({pageId, …})`, `pages.create`, `pages.rename`, `pages.delete` (owner only); every handler authorizes through `repos.getBot(actor, page.botId)` as today. Tools: `page_list`; `page_read`, `page_write`, `page_edit` take an optional `page` (title or id, default the first page); `page_create {title, kind}`; `page_delete` (asks). The web panel gets a page switcher; mobile lists a bot's pages.

### Blocks

Blocks stay fenced JSON in Markdown. Three live fences, all validated by `splitPage` like the GTM fences, at most 20 per page:

- `metric` `{"label": "Cash", "source": "cash", "path": "/balance", "format": "usd", "compare"?: "previous" | "7d" | "30d"}`; `format` reuses pins' `number | usd | percent | text`.
- `table` `{"name": "Largest vendors", "source": "spend", "path": "/vendors", "columns"?: [{"key", "label", "format"?}], "limit"?: 1..200}`.
- `chart` keeps `{name, spec, data}` and gains optional `"source"`, `"path"` and `"over": "latest" | "history"`. With `latest`, the rows are the array at `path` in the newest snapshot. With `history`, the rows are one `{at, value}` per stored snapshot, where `value` is the number at `path`; this is how "cash over 12 weeks" works without the source returning history. `data` stays as the snapshot fallback and the save-time render check runs against it.

A block whose source is missing, pending, paused or failing renders its last good value with a status, never invented data. Hardening that ships with S2: reject unknown top-level Plot options in `buildPlotParts` (allowlist the `PlotSpec` keys at `plot-spec.ts:22-48`), since rows are now fed from outside data.

### Sources

New table `page_sources`: `id, spaceId, userId (bot owner), botId, pageId, name (1–40, unique per page), kind (praci | mcp | http), call Json, schedule, status (pending | active | paused | denied), nextRefreshAt, leaseUntil, failures, lastError, lastRefreshAt, approvedCallHash, createdAt, updatedAt`. A source belongs to one page; deleting the page deletes its sources and snapshots.

`call` by kind:

- `praci` `{tool, args}`: a built-in tool with `readOnly: true` from an allowlist of data reads. Built in S2: `finance_overview`, `finance_breakdown`, `finance_transactions`, `finance_recurring`, `cap_table_read`, `fundraising_read`, `contacts_list`, `board_tickets` (`packages/adapters/src/praci-source-tools.ts`). The refresh calls the tool's handler directly as the bot owner and applies the same agent gates an owner-started routine run would (for example, finance tools only for the Finance, Carta and Investors agents). Left out because they need a run's model consent, provider tokens or return untrusted text: `meetings_list`, `search_data_room`, `inbox_overview`, `calendar_agenda`.
- `mcp` `{serverId, tool, args}`: identical to `PinSource` minus display fields, checked by `checkSource` from `pins.ts` (moved to a shared module so pins and pages use one rule).
- `http` `{url, secret?, accept: "json" | "csv"}`: GET only, no body, no custom headers. With `secret`, the call goes through `requestWithBotSecret` (origin pinned). Without one, through `fetchSafeWebBytes`. Either way the source is refused when a `block` rule matches its site or URL, and the response must be JSON or CSV, at most 1 MB.

Results go through the same redaction as tool results before they are stored.

**Approval (D3).** `page_source_set {page, name, kind, call, schedule}` saves a `praci` source as `active`. An `mcp` or `http` source is saved as `pending` with a pending approval in the owner's Activity and an approval card in the bot thread showing the exact request, the key name, the schedule and the page. The run is not paused: an unattended run continues and the block shows "Waiting for approval". Allow approves this exact `call` (stored as `approvedCallHash`); any later change to `call` returns the source to `pending`. Changing only the schedule or name does not need a new approval. Allow rules and Auto Review never skip this card. "Not now" sets `denied`; the bot sees it on its next `page_source_list`.

**Read-only rule, enforced three times** (save, every refresh, right before the call), like pins: `praci` tool still `readOnly` and in the allowlist and gates pass; `mcp` passes `checkSource`; `http` method is GET, origin matches the secret, no block rule, approval hash matches.

### Refresh scheduler

A minute cron `pages.refresh.tick` (added to `RECURRING_JOBS`; in single-process mode the job reconciler runs it, like `watch.probe`) claims up to 50 due rows with `FOR UPDATE SKIP LOCKED` and sets `leaseUntil = now + 10 min`, copying `claimDueWatchChecks`. Only `active` sources are claimed. Each claimed source runs under `runAsTenant({spaceId, userId})`, with a 15 s timeout and at most 4 calls per space at once. On success it writes a snapshot, clears `failures` and `lastError`, sets `nextRefreshAt` from the schedule (with up to 5% jitter so many sources do not fire on the same second), and emits `page.data` on the bot's thread so open pages update. On failure it keeps the last snapshot, sets `lastError`, increments `failures` and backs off (2×, capped at 6 hours). At five failures in a row the source becomes `paused` and the bot's thread gets one message in fixed words ("A source on one of your pages stopped working. Call page_source_list to see which one and why."), with no source name, page title or error in it, because those can be bot- or server-written and the message is owner-trusted. It starts an ordinary run (unattended, so any changed outside source still needs approval). No state lives in process memory; any worker can claim any row.

Budget: at most 100 active or pending sources per space, checked when a source is created (`page_source_set` refuses the 101st), and 2,000 refreshes per space per UTC day. The day's count is the space's snapshots since UTC midnight (index `(spaceId, fetchedAt)`), read before each scheduled run, so every worker sees the same number; failures store no snapshot and are bounded by backoff and the pause after five, so they are not counted. Concurrent workers can overshoot by at most one tick's claims. Over the budget, a source is not run and its `nextRefreshAt` moves to the next UTC midnight (the failure count is untouched). "Refresh now" snapshots count toward the day but are never blocked by it. The owner can change a source's schedule, pause it or resume it from the Sources sheet; resuming resets the failure count and refreshes on the next tick, and the bot resumes a paused source by saving it again with `page_source_set`. "Refresh now" on a page enqueues an immediate run for that page's sources (rate-limited to once a minute per page).

### History

Table `page_source_snapshots`: `id, spaceId, sourceId, fetchedAt, ok, value Json, bytes`. Only successful refreshes store `value` (≤1 MB); failures are recorded on the source, not as snapshots. A `history` chart reads the value at `path` from up to the last 500 snapshots. Retention (D6): a daily cron `pages.snapshots.retention` deletes rows older than 400 days and rows beyond the newest 2,000 per source, in batches of 1,000 like `messaging-retention.ts`. Page revisions are not pruned today either; that stays out of scope.

### Row-level security

`page_sources` and `page_source_snapshots` each carry `spaceId` and get the standard `_tenant` and `_system` policies in their migration and entries in `ROW_SECURITY_MODELS`; the existing ownership test covers them. Reads also filter by the bot owner (`userId`), because a page is private to its bot's owner like the bot itself. The scheduler starts as system only to claim rows and runs each refresh as the owning tenant.

### HTML pages

`bot_pages.kind` (`blocks` by default, or `html`) is set when the page is created and never changes. An HTML page declares the sources it reads with `<meta name="praci-sources" content="Name A, Name B">` (at most 20) and the ones it wants history for with `<meta name="praci-history" content="Name A">`; only the first 20,000 characters are read, and tags inside comments, scripts, styles and templates count for nothing. `pages.data` returns an HTML page `{kind: "html", sources}` holding only those names (a declared name with no source on the page is `missing`), newest 500 history entries, under 1 MB with the oldest history dropped first.

A page with `kind: html` stores one HTML document (≤200,000 chars) instead of Markdown. It renders in `SandboxedHtmlViewer` (web and Electron) and `SandboxedHtmlPreview` (Expo), unchanged in their sandbox and CSP: no network, no same-origin, no navigation.

The data bridge only pushes. After load and on every `page.data` event, the app fetches `pages.data({pageId})` (the newest snapshot per source on this page, plus history for sources an HTML page declares with `<meta name="praci-history" content="cash,revenue">`), then posts `{type: "praci-data", sources: {name: {value, fetchedAt, error?, history?}}}` to the shell, which forwards it into the nested frame. The page script reads it with `addEventListener("message", …)`. The shell accepts this message only from its parent and still ignores everything the nested frame sends except the existing email height message, so the HTML cannot ask for anything: it gets the data of its own page's sources and nothing else. On Expo the same object is dispatched with `injectJavaScript`. Mobile native iOS shows HTML pages in a `WKWebView` with the same CSP and injection.

Security limits. A bot-written HTML page receives the values of the sources it declares. The page cannot use normal requests: fetch, images, forms and navigation are all blocked. In a web browser, its script could still send those values out by encoding them into a domain name lookup (a DNS prefetch hint or WebRTC), which no browser setting reliably stops. The viewer turns DNS prefetch off, but that is a hint to the browser, not a guarantee. On desktop, DNS prefetch is off and WebRTC is restricted to proxied UDP. Blocks pages have no such path. If you need a hard guarantee, use a blocks page.

Native iOS in the plan: blocks are native SwiftUI (numbers, rows, `Charts` from the snapshot or the server-rendered SVG), so a native slice is listed separately and follows the iOS native epic's process.

### Sidebar

`SidebarPage` gains a nullable `pageId` (and `templateKey` becomes nullable), with a check that exactly one is set and a unique index on `(spaceId, userId, pageId)`. "Add page" lists the user's bot pages grouped by bot; the row shows the page title with the bot's avatar and opens the page full-width. Deleting a page removes its sidebar rows. Mobile shows the same list in its sidebar section.

### Sharing (D7)

"Share" on a page renders it once on the server into a self-contained HTML snapshot (blocks become static HTML and inline SVG; an HTML page gets its current data inlined as a script constant instead of the bridge), stores it as an artifact version and creates an `ArtifactShare`. The shared copy never contains a source definition, URL or key, and does not update.

### Minimal UI

Visible copy added by this plan: page titles; "Waiting for approval"; a source's error and "Retry"; the Sources list labels (schedule names, "Refresh now", "Pause", "Remove"); the approval card fields; "Share a snapshot". Everything else (what a source is, which kind) shows only in the Sources sheet when opened.

## Slices (one PR each)

| Slice | Scope | Depends on |
|---|---|---|
| **S1 Named pages** | Migration (drop `botId` unique, `title`, `kind`, move the existing page to first page), `pages.list/create/rename/delete`, page id on `get/save`, tool changes (`page_list`, `page_create`, `page`), web page switcher, Expo and iOS page lists. Tests: two pages per bot, conflict check per page, existing page migrates, authorization by bot owner. | — |
| **S2 Sources and live blocks (Praci data)** | `page_sources`, `page_source_snapshots`, RLS migrations and model list, `runReadTool`, `page_source_set/list/remove` tools, `metric`/`table` fences and chart `source/path/over`, `pages.data` RPC, on-view render from the newest snapshot, "Refresh now", Sources sheet, Plot option allowlist. Tests: fence validation, gates refused for a non-finance bot, scope from the bot owner only, missing-source fallback. | S1 |
| **S3 Scheduler, history, retention** | `pages.refresh.tick` claim with lease, schedules and jitter, backoff, auto-pause and the one thread message, per-space budget, `page.data` events, history charts, retention cron. Tests with a fake clock: two workers never refresh the same row, a dead worker's lease expires, failure keeps the last value, pause after five, retention keeps the newest 2,000. | S2 |
| **S4 MCP sources and source approval** | Shared `checkSource`, `mcp` kind, pending state, approval card and Activity entry, `approvedCallHash`, re-approval on call change, denial. Tests: Allow rules and Auto Review do not skip the card; a tool that loses read-only status stops refreshing. | S2 |
| **S5 API sources** | `http` kind via `requestWithBotSecret` or `fetchSafeWebBytes`, GET only, JSON/CSV parsing, size limits, block-rule check. Tests: origin mismatch refused, redirect to a private address refused, secret echo redacted from the snapshot, POST impossible to express. | S4 |
| **S6 Sidebar** | `SidebarPage.pageId`, add/remove bot pages on web and Expo, full-width page route. | S1 |
| **S7 HTML pages and data bridge** | `kind: html` save validation, `pages.data` push through the shell, Expo injection, failure states. Tests: messages from the nested frame are ignored, the frame receives only its page's sources, no network under the CSP (browser test). | S2 |
| **S8 Native iOS** | SwiftUI rendering of live blocks and HTML pages, following the iOS native epic. | S2, S7 |
| **S9 Snapshot sharing** | Server render to static HTML, artifact version, `ArtifactShare`. Test: the shared bytes contain no source URL, secret name or call. | S2 |

Hand test for every slice: `DEMO_SLOT=<n> pnpm demo:up`, never the live stack. The demo has mock finance data and emulated Carta and finance MCP servers (`packages/testkit/src/cli/demo.ts:414-421`), enough for S2–S4. S5 needs a public test API; anything tried only against a local fake is said so in the PR.

## Not built

- Live public links, editing a source's call by hand in the UI, write or POST sources, cron strings, sources shared across pages, downsampled long-term history, charts in the pins strip, pruning page revisions.

## Risks and unknowns

- Built-in read tools may depend on run context; S2 finds out and limits the allowlist to what works.
- Snapshots of mail or meeting data persist outside the source systems for up to 400 days; deleting a bot, page or source deletes them, and the owner may want a shorter limit for those tools (TBD).
- Many hourly sources across many spaces add steady worker load; the per-space budget and jitter bound it, but no load test exists yet.
