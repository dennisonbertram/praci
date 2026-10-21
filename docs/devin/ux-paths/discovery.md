# Devin page: discovery for the UX-path catalog

Scope: one planned feature, a read-only Devin page. Nothing here is built yet. The approved direction is `docs/devin/mockup.html`. Rakazo does not launch, reply to, or stop Devin sessions. The page shows what Devin is working on, and the docked Devin agent answers questions with read-only Devin MCP tools. Only the Devin agent talks to Devin. A session that needs the user still produces a normal Rakazo notification (confirmed by the requester).

Evidence labels: "Code" means read in this repo. "Mockup" means shown in `docs/devin/mockup.html`. "Research" means from the field check of Devin's MCP server on 2026-10-20 (not re-run here). "Unverified" means nobody has observed it.

## Application Type

Rakazo is one product on three surfaces: a web app (React, react-router), an Electron desktop shell that hosts the web UI, and an Expo mobile app. The Devin page is a sidebar "page" in the web app, like Legal and Cap table. It is a read-only list with a docked agent chat, not a new workflow engine.

## Tech Stack

- Web: React, react-router, Lingui (`t` macro), `@rakazo/ui-web` (shadcn on Base UI), Storybook for every component (`*.stories.tsx`, `pnpm design-system`). Page shell and sidebar: `apps/web/src/pages/Shell.tsx`.
- API: oRPC router `apps/api/src/router.ts`, namespaces declared in `packages/contracts/src/rpc.ts`, Postgres via Prisma.
- Devin access: generic MCP connection (`McpServer` row, key stored as a bearer-token secret), a Devin preset in `packages/contracts/src/integration-agent.ts` (`INTEGRATION_PRESETS.devin`, `requiresAgent: true`), and an "integration agent" bot created by `ensureIntegrationAgent` in `apps/api/src/integration-agent.ts`.
- Notifications: `packages/adapters/src/notify-user.ts` (`defaultNotificationSurface`), sidebar counts via `apps/web/src/lib/use-sidebar-glance.ts`.
- Desktop: Electron main process in `apps/desktop/src`, loads the web app. Mobile: Expo Router in `apps/mobile/app`.

## User Roles

Rakazo has no role system specific to Devin. Roles below are derived from how the connection is stored.

| Role | What they can do today | What they would see on the Devin page |
|---|---|---|
| Connector (the user who pastes the Devin key) | Creates the `McpServer` row, owns the Devin agent bot, can toggle writes for that server | Their own page, built from their own key |
| Other member of the same space | Code: `McpServer` rows are scoped to space and user (`scope(actor, id)` in `apps/api/src/integration-agent.ts`), and the bot is per user (`spawnKey integration-agent:<serverId>`). So a second member has no Devin connection and no Devin agent unless they connect their own | Not connected state, until they paste their own key |
| Member of two spaces | Connection and page are per space (the Legal page reloads on a space switch, `Shell.tsx` ~5131) | A different connection state per space |

Open (see Open questions): the Devin key is org-scoped, so every member who connects sees the same org's sessions, including sessions other people started in Slack or Linear. Research found no user names, only an opaque `user_id`, so the page cannot say whose session it is.

## Feature Map

### Exists today

- Devin tile in Integrations (`apps/web/src/lib/integrations.ts` ~143: `apiKey: true`, no logo, letter fallback). Subtitle "Coding sessions and repo docs" (`IntegrationsHome.tsx` 377).
- API-key connect dialog (`CustomConnectionDialog.tsx`, api-key mode; hint "An org-scoped Devin service-user key (starts with cog_)." at `IntegrationsHome.tsx` 443). Tests cover success, the bot step being skipped for Devin, and a rejected key ("Could not connect to Devin. Check the API key and try again.").
- Key check at connect time: `mcp.servers.create` (`router.ts` ~4864-4890) lists the server's tools fresh. If that fails it deletes the server and secret and returns the error, so a rejected key leaves nothing behind. On success it calls `ensureIntegrationAgent`, which creates the "Devin agent" bot ("Your Devin account"), links it with `allowAllTools`, makes the server exclusive to it, and sets `writesEnabled: false`.
- Connection card statuses: connected, reconnect, failed, connecting (`IntegrationsHome.tsx` ~115-160; badge tones in `components/integrations/parts.tsx`). A connected Carta card shows an "Open Cap table" link (`IntegrationsHome.tsx` ~124); Devin has no such link.
- Tool gating (`packages/contracts/src/devin.ts`): reads `devin_session_search`, `devin_session_events`, `devin_session_gather`, `ask_question`, `read_wiki_*`, `list_available_repos`, `devin_list_integrations`. Forced writes (a card on every call): `devin_session_create`, `devin_session_interact`, and three manage tools.
- Page-agent pattern for Legal and Cap table: route, `useMatch`, bot lookup by spawn key, docked `ResizableSidePanel`, sidebar link with glance badge, "hide page" menu, search entry, per-surface notifications (see Navigation Structure).
- Generic notification path: `createNotification` with a `surface` key; unseen counts drive the sidebar dot.
- Mobile can already render an agent-authored page for any bot: `apps/mobile/app/agent-page.tsx` (shows `BotPage` blocks, opened from `thread.tsx` ~1047) and `agent-list.tsx`. This is a generic page, not a Legal-style screen.

### Planned (mockup)

- A "Devin" link in the sidebar Pages group, between Data room and Artifacts, with a dot when sessions need the user (mockup: "2 need you").
- Page header: title "Devin", meta "Updated 1m ago", an "Open Devin" icon button (external link), and an "Ask" button that opens the docked agent.
- Four tiles: Needs you, Working, PRs open, ACUs this week.
- One table of sessions: Session (title, plus the question text under it for needs-you rows), Status badge (Needs you, Working, Finished, Error, Suspended), Pull request (`acme/api#212 open`, `merged`), From (Slack, Linear, Web, API), ACUs, Updated.
- Docked "Devin agent" panel with an example thread ("What is Devin stuck on?") where the agent searches sessions, reads messages, and answers with "Open in Devin" links.
- "Not connected" state: header with a single "Connect Devin" button.
- Connection dialog: the existing one, retitled "Connect Devin", one API key field. The mockup omits an org ID, which matches the code (no org ID is stored).
- A normal Rakazo notification when a session needs the user (not drawn in the mockup).

## Navigation Structure

Entry points, with what exists:

1. Sidebar Pages group: add a `devin` entry to the `pages` list and a `SidebarPageLink` (`Shell.tsx` ~3955-4070, test id pattern `sidebar-legal`). Users can hide it through the group's "..." menu (`hiddenPages`, `Shell.tsx` ~1906). Open question: should it be hidden or absent when Devin is not connected (Cap table shows regardless).
2. Search and command palette: add to `appPages` (`Shell.tsx` ~1945); the label match is "Devin", and a keywords string is available (Cap table uses one). Palette hotkey is `isCommandPaletteHotkey` in `shell/command-palette`.
3. Notification: the notification `link` and `surface` need a `devin` entry in `defaultNotificationSurface` (`notify-user.ts`), `surfaceOfPath` (`use-sidebar-glance.ts` regex is a closed list), `PAGE_AGENT_COLOR` (`contracts/agent-colors.ts`) and `contracts/sidebar-folders.ts` (per the codebase research). Without these, a Devin notification surfaces as a plain "thread" notification and never lights the sidebar dot.
4. Integrations: the connected Devin card should get an "Open Devin" link like Carta's "Open Cap table" (`IntegrationsHome.tsx` ~124), and the connect flow could land on the page. Today the Devin tile only opens the key dialog and the detail page `/app/integrations/mcp/<id>`.
5. Devin agent chat: today the agent exists as a normal bot after connecting. Whether it opens inside the docked panel on the page or as a full-screen thread follows the Cap table pattern (panel header button "Open full screen"; Carta has a full-screen variant with a way back to the page).
6. Mobile: no entry point is planned. See Surfaces.

Route: new `/app/devin` (Legal uses `useMatch("/app/legal")`, `App.tsx` ~218 for cap-table). `pageMode` and the `active` bot ternary in `Shell.tsx` ~914-962 each need a Devin branch; there is no generic agent-page framework.

## Data Entities

- `McpServer` (Devin, per space and user): `endpoint`, `secretId`, `enabled`, `writesEnabled`, `agentBotId`, `agentExclusive`. Code has no org ID field.
- Devin agent `Bot`: spawn key `integration-agent:<mcpServerId>`, name "Devin agent". Per server, not per user-global. A page that finds its agent by spawn key needs a Devin helper like `findLegalAgent` (`lib/legal-agent`).
- Devin session (read from MCP, not stored in Rakazo). Fields from the search tool (Research): `id`, `title`, `status` / `status_detail`, `created_at`, `updated_at` (unix seconds), `tags`, opaque `user_id`, `origin` (webapp, slack, teams, api, linear, jira, automation, cli, desktop, code_scan, other), PRs as `url[state]` list, `acus_consumed`, `playbook_id`. No repo field (only inferable from PR URLs), no user name, no status filter, paging up to 100 with a cursor.
- Needs-you question text: not a field. It needs `devin_session_interact` get_messages (source, created_at, event_id, truncated body), which `devin.ts` lines 32-34 classify as a forced write today.
- Derived page values: Needs you, Working, PRs open, ACUs this week are counts and sums computed from the session list. "This week" needs a definition (see Open questions).
- Existing, not reused: `CloudAgent` Prisma rows and the `cloud_agent` block (`schema.prisma` ~771, `CloudAgentCard.tsx`). Those track launches Rakazo made (Cursor only, env-configured). With launch out of scope, the Devin page does not need them.
- Notification: `Notification` with `surface`, `link`, `dedupeKey` (24h dedupe per research). A "needs you" notification needs a stable dedupe key, probably per session and per question.

## Integrations

- Devin MCP at `https://mcp.devin.ai/mcp` with an org-scoped service-user key as bearer token. No sign-in flow.
- Devin REST v3 is not used and would need an org ID (research); the mockup and current code use MCP only.
- Rakazo connection settings stay generic (AGENTS.md: no provider-specific env vars). The Devin preset already follows that.
- Notification delivery uses the existing notification path (push, toast), so mobile gets Devin alerts without any mobile UI work, subject to where the link opens (see Surfaces).
- Polling or event source for needs-you detection is not decided (see Open questions). The cloud-agent poller (`cloud-agent-poll.ts`) is a Cursor-specific, single-provider design and is not a drop-in.

## State transitions

Connection (page-level):

1. Not connected: no Devin `McpServer` row for this user and space. Page shows the header with "Connect Devin".
2. Connecting: dialog submitted; API lists tools fresh. On failure the row and secret are deleted, the dialog shows "Could not connect to Devin. Check the API key and try again." and the page stays in state 1.
3. Connected: row exists, agent bot created, tools list works. Page shows the table.
4. Key rejected or revoked later: the card status becomes reconnect or failed (`mcpStatus(server)`, StatusBadge). Today a Devin card in that state has a reconnect button on the Integrations tile. The page has no designed state for it.
5. Agent bot missing: `ensureIntegrationAgent` is idempotent and the server stays if agent creation fails for non-requiresAgent services, but for Devin a failure at connect deletes the server. The remaining case is an archived or deleted agent (`agentBotId` is cleared with `onDelete: SetNull`). The Legal and Carta pages handle this with a "Create agent" and "Try again" panel (`Shell.tsx` ~3066-3100). Devin needs the same repair path.

Session list (page-level): loading (first fetch), empty (connected, no sessions), populated, refreshing (stale data with "Updated Nm ago"), error (fetch failed, previous data may be shown), partial (more than one page of results).

Row status mapping (Unverified): the mockup uses Needs you, Working, Finished, Error, Suspended. Devin's `status` and `status_detail` values were not captured in the field check beyond "sleep/finish" for the summary. How `waiting_for_user` and `suspended` map from `status_detail` is not confirmed.

Needs-you: row appears (Working to Needs you) -> sidebar dot and notification fire -> user opens the session in Devin or asks the agent -> status leaves Needs you (answered in Devin) -> dot clears. Rakazo cannot answer on the user's behalf.

## Error, empty and loading states needed

- Not connected (page): header only, "Connect Devin" (in mockup). Check: the dialog text in the mockup says "An org-scoped Devin service-user key (starts with cog_)." which matches existing copy.
- Connect dialog: empty field (Connect disabled), wrong key (inline error from API), network failure, success then page opens.
- Loading: first load skeleton (Legal uses `Skeleton`); refresh without layout jump.
- Empty: connected but no sessions. Not in the mockup. Needs a one-line state; any extra explainer is subject to the AGENTS.md copy rule.
- Fetch error: `ErrorNotice` pattern from `components/finance/ui`; keep stale rows visible if present.
- Rate limit / slow response from Devin: unknown behavior. `devin_session_gather` blocks up to 590s and must not be used for page loads (Research).
- Key rejected or revoked after connecting: row states plus a reconnect action. Include the case where the key is valid but lacks session-read permission (Unverified).
- Agent missing or failed to create: panel with Create/Try again.
- No model configured: page agents show "Add a model" instead of suggestions (`pageAgentNeedsModel`, `Shell.tsx` ~3105). The Devin agent needs the same.
- Question text unavailable: needs-you row without a subtitle (message read failed, gated, or empty).
- Truncated or over-100 session list.
- Session with no title, no PR, or origin "other".
- Dark theme and long titles (mockup has both toggles; table uses fixed column widths).

## Surfaces

- Web (>= 1280px): sidebar 316px, main, docked panel (default 384px, min 320, user-resizable, `rakazo:right-panel-width`). Mockup is drawn for this.
- Web 1024-1279px: the panel does not dock; `ResizableSidePanel.tsx` uses `xl:relative`, below that it is an absolute overlay (`max-w-[384px] shadow-xl`) over the page. The Ask button is the way to open it; Legal passes `onAskAgent` only when the panel is closed. The 6-column table and 4 KPI tiles need a narrow variant (Legal switches to one `<li>` per row inside an `@container`; the reference notes this at narrow container widths).
- Web < 1024px: the sidebar is a drawer; the page is full width; the agent panel overlays. Table must collapse to a list.
- Electron: hosts the same web UI. Differences to check: external links ("Open in Devin", PR links) must open in the system browser (`apps/desktop/src/app-opener.ts` exists for this); there is no desktop-specific page. The desktop Playwright suite steals focus on macOS, so desktop verification is CI-only per AGENTS.md.
- Mobile (Expo): no Legal or Cap table screen exists (`docs/mobile-parity/inventory.md` row 321: Legal page MISSING; the parity README says Cap table and Legal are web-only). Mobile has a generic `agent-page.tsx` that renders blocks a bot publishes (opened from a thread), and push notifications reach the phone. AGENTS.md says core workflows must cover every applicable surface "or degrade safely for an explicit reason". Monitoring Devin is plausibly a phone use case ("is Devin stuck?"), so the catalog should state the intended mobile behavior explicitly: notification opens the Devin agent thread, or a native list, or nothing.

## Open questions

These block a good UX. Each one needs a decision before stories can be treated as final.

1. Reading the question text needs a gate change. `devin_session_interact` is a forced write in `packages/contracts/src/devin.ts` (lines 32-34), so every `get` / `get_messages` call would show an approval card in the agent chat, and a page that fetches questions in the background would be blocked. Options: split get/get_messages into a read path (message, sleep, terminate, archive, set_tags stay writes), or show the page without question text. This affects the "Needs you" row subtitle in the mockup, so the mockup depends on it.
2. Which pieces does the page fetch directly versus the agent? The page needs a Rakazo API call that runs `devin_session_search` as the connector. No such RPC exists (no Devin namespace in `rpc.ts`). Decide whether the page reads through the agent's server connection or a new endpoint, and how it is authorized (space and user scoped).
3. Whose sessions? The org key returns org-wide sessions. Research shows `user_id` is opaque, so "From" in the mockup is the origin (Slack, Linear, Web), not a person. Decide whether the page shows all org sessions, filters by something, or shows a visible scope label. This is a privacy question for multi-member orgs where only some members connect.
4. Does every space member connect separately? Code says yes (per user). If an owner connects and a teammate opens the page, they see the Not connected state. Decide whether to offer a "shared connection" or leave it per user (affects notifications: only the connector gets "needs you").
5. Who is notified? The connector only (the notification recipient is the run's user), or all members? Also: how does Rakazo detect a new needs-you without polling every user's key forever? No poller design exists. Cadence also decides how current "Updated 1m ago" is.
6. Definitions for the tiles. "Working" and "Needs you" depend on the unverified status mapping. "PRs open" counts PRs from the visible page only if the list is paged. "ACUs this week" needs a window (rolling 7 days or calendar week), a timezone, and a rule for sessions that started earlier. The search tool has no status filter, so these are computed client-side or server-side over up to 100 rows per page.
7. Row link target. The mockup links the session title and "Open in Devin". The `url` field is only returned by `get` (gated). Without it the link must be built from the session id (`id` has no `devin-` prefix) and an app host that has not been checked. Confirm the URL shape before design locks the link.
8. Header "Open Devin" icon button: where does it go (app.devin.ai home, or the org)? Not defined in code or research.
9. Is the Devin agent opened by default (Cap table auto-creates the Carta agent and opens its panel; Legal opens on Ask)? The mockup shows it open with a conversation. Decide default open or closed, and what the empty-thread intro and suggested questions say.
10. Where does the page go when the agent bot was archived but the server is still connected? Needs the repair path in Error states above.
11. Mobile intent (see Surfaces). A decision is needed, or an explicit "web only for now" note, per AGENTS.md.
12. Copy: AGENTS.md requires that any new visible word be justified in the PR. Candidate strings in the mockup that need that check: "Needs you", "Working", "Finished", "Error", "Suspended", "PRs open", "ACUs this week", "From", "Updated 1m ago", "Connect Devin", "Open Devin". "ACUs" is Devin jargon that a founder may not know.
13. Sidebar visibility when not connected and whether "Devin" should appear in the page-visibility menu by default.
14. Unverified: exact text format of the MCP tool outputs (all return a single text string; fields are omitted when empty), and what `get_messages` returns. Parsing is a risk until observed (Research).

## Recommended Story Topics

1. **Connect and first visit**: Integrations tile or sidebar link, key dialog, rejected key, first page load, agent created, plus the Not connected and empty-list states.
2. **Monitoring sessions and needs-you**: reading the table and tiles, status mapping, PR links, which rows need attention, stale data and refresh.
3. **Asking the Devin agent**: the docked panel (Ask button, suggestions, "what is Devin stuck on?"), read-only tool steps, the approval card when the gate asks, and no-model and missing-agent states.
4. **Notifications and re-entry**: a needs-you notification, the sidebar dot, opening the page from the notification, search or palette, and clearing the dot.
5. **Errors, permissions and surfaces**: key revoked or lacking access, fetch failure, org-wide visibility and other members, narrow widths under 1280px, Electron links, and the mobile decision.
