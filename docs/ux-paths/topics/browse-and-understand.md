# Topic: First-time browse and understand

Code read: `apps/web/src/pages/PluginsOverlay.tsx`, `pages/Shell.tsx` (sidebar button ~3574, Inbox hook ~3823, overlay mount ~4676), `pages/Inbox.tsx` (~584), `components/integrations/IntegrationSetup.tsx`, `McpServerRow.tsx`, `lib/mcp-connect.ts`, `lib/plugin-connect.ts`, `packages/core/src/featured-connectors.ts`, `preferNativeGmail` in `packages/contracts/src/domain.ts`. Statements about the 390px layout are derived from the Tailwind classes, not observed in a browser.

Information shown on more than one surface (noted once here, referenced in stories): the connected state is the word "Added" in the featured grid, in the catalog grid and (as the only entry point to the detail view) on the same tile; the same Gmail/Slack tile can appear in both the featured grid and, while searching, the catalog grid; the "Search apps" label/placeholder is used in the overlay search box and again in the inline "Add MCP server" panel (where it searches integrations.sh, not the app catalog); "Add MCP server" is both a heading of the inline panel and an Advanced button; MCP servers are reachable from "Browse MCP servers", Advanced "Add MCP server", and Advanced "Manage MCP servers".

## STORY-008 [folded-in, was STORY-100]: Scan the featured apps and pick one
**Folded into**: STORY-008 (see catalog.md). Original steps kept here for reference.
**Type**: medium
**Topic**: First-time browse and understand
**Persona**: Maya, a solo founder who just created her first Rakazo agent and wants it to read her Slack and Notion
**Goal**: Find out which apps she can connect and choose Slack or Notion
**Preconditions**: Signed in, one agent exists, nothing connected, server has a Composio or Pipedream catalog configured and the catalog has loaded
**Ideal path**: 3 — open Integrations, read the featured grid, press Add on the chosen tile
**Alternate paths**: Type the app name in "Search apps" and press Add on the result (STORY-015/001); on the Inbox, "Connect mail" opens the same overlay pre-searched for "gmail" (STORY-010)
### Steps
1. Click "Integrations" (grid icon, bottom of the sidebar) → `setPluginsQuery("")` and a modal dialog titled "Integrations" opens, 1080px wide, with a close button labelled "Close integrations", a "Search apps" box, a "Browse MCP servers" button, and (while `loading`) the text "Loading integrations…".
2. Wait for the load → the featured grid shows five tiles in fixed order: Gmail, Google Calendar, Google Drive, Slack, Notion. Each tile is a logo (or letter) + name + a round "Add" button. Below it come the rest of the catalog tiles (the featured five are filtered out of this list), then a collapsed "Advanced" row. Maya is thinking: "What do these actually do? Will it read everything in my Slack?" Nothing on the tiles or the dialog answers that.
3. Maya hesitates because a tile has no description, category or permission summary, and "Integrations" has no subtitle. She decides from the brand name alone and clicks "Add" on Slack → button turns to "Adding…" and is disabled; a popup opens to the provider (see the connect topic for the rest).
### Variations
- Maya scrolls the page-length catalog instead of using featured (STORY-002).
- Maya clicks the logo or name of an unconnected tile: nothing happens, only connected tiles are clickable (they open the detail view), so she may think the tile is broken.
- A tile that is already connected shows "Added" instead of "Add"; the word never says "Connected".
### Edge Cases
- The featured order is hard-coded; it does not reflect what the user already uses.
- If the provider returns Slack under a different name, `matchFeaturedConnectorId` accepts aliases (e.g. "slackbot"); the tile always shows the fixed label "Slack" even though the underlying item name may differ.
- The "Search apps" box sits outside the scrolling list (`#integration-list`), so it stays visible while the grid scrolls.

## STORY-010 [folded-in, was STORY-101]: Arrive from the Inbox "Connect mail" button
**Folded into**: STORY-010 (see catalog.md). Original steps kept here for reference.
**Type**: medium
**Topic**: First-time browse and understand
**Persona**: Dev, a freelance designer who opened Inbox because a friend said it triages email, and has never opened Integrations
**Goal**: Connect his Gmail account so the Inbox fills
**Preconditions**: Signed in, Inbox view open (`inboxMode`), `data` loaded and `accounts.length === 0`, no mail connection
**Ideal path**: 2 — press "Connect mail", press Add on Gmail
**Alternate paths**: Sidebar "Integrations" then clear to featured and press Add on Gmail (STORY-008); sidebar "Integrations" then type "gmail" (STORY-015)
### Steps
1. In the Inbox empty state, click "Connect mail" (a single centered button with no other text) → `onConnectMail` sets the overlay query to "gmail" and opens the same "Integrations" dialog. The "Search apps" box already contains "gmail".
2. Dev looks at the result → because the query is non-empty, `showFeatured` is false: the featured grid is hidden and only catalog matches appear in a two-column grid. Every item whose name, slug or connector id contains "gmail" is listed, which may include several Gmail tiles from different providers and extras such as other Gmail-related apps. Dev is thinking: "I clicked Connect mail and now I'm in a general app store. Which one is mine?"
3. Dev picks the first "Gmail" and clicks "Add" → "Adding…", popup, then "Added" when the poll sees a connected row (up to 90 s). He has to return to the Inbox himself: the overlay does not close and there is no success message. He closes the dialog with "Close integrations" to get back to the Inbox; the Inbox receives `paused={pluginsOpen}` while the overlay is open, and whether it reloads mail on close was not checked.
### Variations
- Native Google configured and usable: `preferNativeGmail` leaves one Gmail (connector "google") and hides managed Gmail unless one is already connected.
- Desktop without a usable bridge: the "google" connector is hidden and the managed Gmail stays.
- Dev clears the search box: the query becomes empty and the featured grid appears, so the page jumps from a short result list to the full browse layout.
### Edge Cases
- Inbox copy ("Connect mail") and the overlay verb ("Add") differ; Dev has to infer that "Add" on Gmail is the connect action.
- Closing the dialog before the connection finishes aborts the poll (`connectionAttempt.current?.abort()`), so a half-finished sign-in is silently dropped.
- Reopening the sidebar "Integrations" later resets the query to "" (sidebar handler calls `setPluginsQuery("")`), so the "gmail" prefill never leaks.

## STORY-015 [folded-in, was STORY-102]: Search "gmail" and see two apps with the same name
**Folded into**: STORY-015 (see catalog.md). Original steps kept here for reference.
**Type**: long
**Topic**: First-time browse and understand
**Persona**: Priya, an operations lead at a small agency who is careful about which service holds her mail credentials
**Goal**: Decide which of two identical-looking "Gmail" tiles to add
**Preconditions**: Server has both Composio and Pipedream configured (the local dev `.env` has both); native Google not configured; Gmail not connected
**Ideal path**: 4 — open Integrations, type "gmail", compare tiles, press Add on one
**Alternate paths**: Same via Inbox "Connect mail" (STORY-010); clear the box and use the featured Gmail tile, which silently uses the first catalog match (`resolveFeaturedCatalogItem` returns the first item whose slug or name matches)
### Steps
1. Click "Integrations" → dialog opens with the featured grid.
2. Click "Search apps" and type "gmail" → `filterConnectionCatalogItems` matches name, slug or connector id (case-insensitive substring); `visibleCount` resets to 60; featured grid disappears. Results show two tiles both named "Gmail" with the same logo (one with `connectorId` composio, one pipedream). Priya is thinking: "Why are there two? Is one the old one? Which is safer?" The tile shows only logo, name and "Add"; the provider name is never rendered.
3. She looks for any difference → there is none in the UI: no provider badge, no tooltip, no description. The only difference is internal (`connectorId`). Tiles are ordered by catalog order.
4. She guesses and clicks "Add" on the first → only that tile shows "Adding…". Later the second Gmail still reads "Add", and she may add it too, creating a duplicate connection with the label "Gmail" (account labels are named `nextAccountLabel`: "Gmail", "Gmail 2" only within the same connector and slug).
### Variations
- With native Google also available, `preferNativeGmail` removes both managed Gmail tiles and only one "Gmail" remains (unless a managed one is already connected, in which case that stays too and she again sees two).
- Slack or Notion can duplicate the same way when both providers carry them; the featured grid shows only the first, the second becomes visible only through search.
- With no search, the non-featured catalog list excludes any item whose slug or name matches a featured alias, so the duplicate is hidden from the plain browse view and is discoverable only by searching.
### Edge Cases
- After connecting one Gmail, the other Gmail tile remains "Add"; nothing warns that one Gmail is already connected.
- The connected tile's test id `connection-tile-gmail` can collide only in the featured case; the code suppresses ids in the catalog grid while featured is shown.
- Searching "mail" also matches names like "Mailchimp" and "Gmail"; the user cannot tell which is the Google mail.

## STORY-001: Search finds nothing, or uses a name the catalog does not
**Old ID**: STORY-103
**Type**: short
**Topic**: First-time browse and understand
**Persona**: Tomás, a bookkeeper who wants to connect "QuickBooks" and "gcal"
**Goal**: Learn whether an app is available and recover from a no-result search
**Preconditions**: Catalog loaded with items; QuickBooks not in the catalog
**Ideal path**: 3 — type the name, read the empty message, clear the box or look at Advanced
**Alternate paths**: Advanced → "Search by domain" (only if the server has a catalog feed); "Browse MCP servers" → "Search integrations.sh" (searches the public MCP catalog); "Add MCP server" in Advanced with a URL he already has
### Steps
1. Type "quickbooks" in "Search apps" → featured hidden; catalog list empty.
2. Read the result → `No apps match your search.` appears as plain text with no button. Advanced is still shown below it, collapsed. Tomás is thinking: "So QuickBooks isn't supported? Or did I spell it wrong?" The message does not suggest "Search by domain" or "Browse MCP servers".
3. Clear the box → the featured grid returns.
### Variations
- Typing "gcal": the featured alias list knows "gcal", but `filterConnectionCatalogItems` only checks name, slug and connector id, so searching "gcal" shows no results even though Google Calendar is featured. Typing "google calendar" matches the name; "google_calendar" matches a slug only if the slug uses underscores.
- Typing only spaces: `query.trim()` is empty, so the featured grid stays.
- Catalog empty and query typed: message `No managed app catalog is configured on this deployment.` is shown instead (see STORY-006).
### Edge Cases
- Search is client-side substring on the already loaded catalog; there is no debounce and no loading state.
- The two messages "No apps match your search." and "No results" (Search by domain) are different strings for similar situations.

## STORY-002: Keep browsing the long catalog with "Show more"
**Old ID**: STORY-104
**Type**: medium
**Topic**: First-time browse and understand
**Persona**: Lena, a curious researcher who wants to see everything before choosing
**Goal**: Scan beyond the first 60 apps and decide whether the catalog has her tools
**Preconditions**: Catalog contains hundreds or thousands of apps (merged Composio + Pipedream)
**Ideal path**: 3 — open, scroll, press "Show more" until satisfied
**Alternate paths**: Use search instead (STORY-001); none for an alphabetical or category browse
### Steps
1. Open "Integrations" and scroll past the featured grid → the catalog grid shows the first 60 non-featured items in catalog order, two columns; no alphabetical headings, no counts, no categories.
2. Reach the end of the 60 → a centered "Show more" button appears (only when `rendered.length < visible.length`).
3. Click "Show more" → 60 more tiles are appended and the page stays at the same scroll position; the button remains until the list is exhausted, then disappears with no "end of list" text. Lena is thinking: "How many are there? Is it sorted?" There is no total.
### Variations
- Typing a new query resets `visibleCount` to 60; clearing the query does not restore a previous scroll position.
- Very large catalogs make "Advanced" many scrolls away; she may not notice it exists.
### Edge Cases
- Duplicates from two providers appear here too but are not marked; connected apps are not sorted to the top, so she can't see at a glance what she has already added.
- Connected MCP servers are shown above the grid (two-column `McpServerRow`s), but connected managed apps are only identifiable by the "Added" button in a grid of "Add" buttons.

## STORY-003: Logos missing or broken
**Old ID**: STORY-105
**Type**: short
**Topic**: First-time browse and understand
**Persona**: Ravi, a designer who notices visual inconsistencies
**Goal**: Recognise apps even when some logos are absent
**Preconditions**: Some catalog items have `logo: null`; some have a URL that fails to load (blocked CDN, offline)
**Ideal path**: 1 — open the overlay and read the tiles
**Alternate paths**: none found
### Steps
1. Open "Integrations" → items with `logo: null` render a rounded 36px square with the first letter of the name (`label[0]`), for example "S" for Slack.
2. Look at items whose logo URL fails → the `<img>` has `alt=""` and no `onError` handler, so a blank 36px `bg-accent` square shows with no letter. Ravi is thinking: "Is this one broken or just icon-less?" The name beside it still identifies the app.
### Variations
- Featured tile whose catalog item is missing uses the letter avatar (same look as a null logo) plus the line "Not in the plugin catalog".
- The detail view (connected only) uses the same logo-or-letter rule.
### Edge Cases
- A name starting with a non-letter or emoji gives a symbol as the avatar; a name that is an empty string would give `undefined` text.
- Letter avatars of several apps look identical except for the letter, so a catalog of unlogoed items is hard to scan.
- Screen readers get nothing from the logo (`alt=""`) which is fine because the name is adjacent.

## STORY-004: Open Advanced and try to understand it
**Old ID**: STORY-106
**Type**: medium
**Topic**: First-time browse and understand
**Persona**: Jordan, an engineer who wants to attach an internal API but doesn't know the vocabulary
**Goal**: Work out whether Advanced is the right place for his internal tool
**Preconditions**: Overlay open; Jordan has an MCP server URL or an OpenAPI file URL
**Ideal path**: 3 — expand Advanced, choose the matching "Add …" button, fill the form
**Alternate paths**: "Browse MCP servers" (top of the overlay) opens the inline panel headed "Add MCP server" with "Search apps" + "Search integrations.sh" and "Add server URL" + "Connect"; Advanced → "Manage MCP servers" opens the "MCP servers" overlay (STORY in the MCP topic)
### Steps
1. Scroll to the end of the list and click "Advanced" (a muted text row with a "›" that rotates when open; it is a `<details>`) → a block expands. If the server has a catalog feed, a "Search by domain" card (placeholder "github.com", button "Search") comes first.
2. Read the row of buttons: "Add MCP server", "Add OpenAPI", "Add GraphQL", "Add Executor", "Add Treg". Jordan is thinking: "What is Executor? What is Treg? Do I need those?" None is explained. Below them the "Tool sources" heading and the text "No MCP or API tool sources installed yet." (or the installed list with "Remove" buttons).
3. Click "Add MCP server" → a card "Add remote MCP server" appears with "Display name", a URL field (placeholder `https://example.com/mcp`), an auth select ("No authentication", "Bearer token", "API key header"), a "Credential" field when auth is not none, the note "Credentials are encrypted and never sent to the model.", and "Verify and add" / "Cancel".
### Variations
- Click "Add Treg" → card "Connect Treg", URL pre-filled internally to `https://treg.to/mcp/` and not shown, only "Treg token".
- Click "Add Executor" → "Connect Executor" with URL placeholder and "Executor token".
- Click "Add OpenAPI" → "Import OpenAPI JSON"; "Add GraphQL" → "Add GraphQL endpoint".
- Closing the Advanced section clears and hides the form and any typed credential (`onToggle`).
### Edge Cases
- Three entries to MCP: "Browse MCP servers" (top), Advanced "Add MCP server", Advanced "Manage MCP servers"; they lead to different screens with similar names, and the inline panel's heading is also "Add MCP server".
- "Manage MCP servers" is hidden when `onOpenMcp` is not provided.
- "Search by domain" "Add" and "Manual" buttons: "Manual" is disabled with title "Manual setup required".
- Advanced is not visible when a managed app detail is open.

## STORY-005: Browse on a 390px phone-width window
**Old ID**: STORY-107
**Type**: medium
**Topic**: First-time browse and understand
**Persona**: Aisha, who opens the web app on her phone browser while commuting
**Goal**: Read tile names and press Add on a narrow screen
**Preconditions**: Viewport 390px wide; catalog loaded
**Ideal path**: 3 — open, scan, press Add
**Alternate paths**: none found (the same overlay on every width)
### Steps
1. Open "Integrations" → the dialog is `w-[1080px] max-w-[calc(100%-2rem)]`, so about 358px wide, with `px-8` padding on the search area and list, leaving roughly 294px of content.
2. Look at the featured grid → it is a fixed `grid-cols-2`, so each tile is about 143px wide, minus tile padding and 36px logo, 12px gaps and an "Add" button; by the class arithmetic only about 10–20px remain for the name, so names like "Google Calendar" truncate to a few characters (truncate is set). Aisha is thinking: "Which of these is Google Drive and which is Calendar?" This is computed from classes, not observed.
3. Press "Added"/"Adding…" (wider than "Add") → the name space shrinks further. Aisha taps the small round button (size "sm").
### Variations
- Connected MCP servers above the grid are also two-column; long names and subtitles ("OAuth expired", host names) truncate.
- Advanced buttons are `flex-wrap`, so they stack in lines and remain usable.
- "Search by domain" input and button share one row (`flex gap-2`) and fit.
### Edge Cases
- Dialog height `h-[760px] max-h-[calc(100%-2rem)]` fits; the list scrolls inside.
- The detail view's header (Back, logo, name, "Uninstall") can crowd the name.
- The recommended fix to check by walking: single column at small widths. This is a hypothesis to confirm in a browser.

## STORY-006: First open with a slow, failed or empty catalog
**Old ID**: STORY-108
**Type**: short
**Topic**: First-time browse and understand
**Persona**: Sam, a self-hoster who just deployed Rakazo without provider credentials
**Goal**: Understand why there are no apps to connect
**Preconditions**: No Composio/Pipedream/Google configured, or the catalog request is slow or failing
**Ideal path**: 2 — open Integrations, read the message
**Alternate paths**: `/integrations/setup` (deep link, not linked from the overlay) is where an owner configures providers; "Browse MCP servers" or Advanced still work without a managed catalog
### Steps
1. Open "Integrations" → while loading, "Loading integrations…" is shown, and the featured grid renders all five tiles as disabled placeholders with the line "Not in the plugin catalog", because with an empty catalog `item` is undefined and the tile falls into the placeholder branch. Sam is thinking: "None of these exist?" This flash disappears when the catalog arrives.
2. After load with an empty catalog → the featured area shows "Configure a plugin catalog on the server to connect apps." Searching shows "No managed app catalog is configured on this deployment." The instruction speaks to a server admin, but the viewer is a regular user, and there is no link to the setup page.
### Variations
- Load failure: `Could not load integrations` in red above the grid.
- Catalog loaded but lacks a featured app: only that tile reads "Not in the plugin catalog" (the third term for the same thing: "apps", "integrations", "plugin").
### Edge Cases
- Optional catalog-feed failure is swallowed (`optionalCatalogFeedProbe`), so "Search by domain" just disappears.
- "Browse MCP servers" and MCP rows still work with an empty managed catalog, so Sam can still add a remote server.

## STORY-007: Decide what connecting will do for my agents
**Old ID**: STORY-109
**Type**: long
**Topic**: First-time browse and understand
**Persona**: Elena, a head of finance who will only connect tools if she understands what the agent can do with them
**Goal**: Learn what an app lets her agents do before she grants access
**Preconditions**: Nothing connected yet; she is willing to connect one app to find out
**Ideal path**: 5 — open, choose Notion, press Add and finish sign-in, click Added, read tools
**Alternate paths**: "Browse MCP servers" → "Search integrations.sh" shows names and endpoints for public MCP servers without connecting; Advanced "Search by domain" (when enabled) shows a description for each result; none shows the tool list before connecting
### Steps
1. Open "Integrations" and look at the featured tiles → names only, no description. Elena is thinking: "What does Add do, and what can the agent touch?" No intro text exists on the screen.
2. Click "Browse MCP servers" hoping for an explanation → the inline panel appears with the heading "Add MCP server", a "Search apps" box and a "Search integrations.sh" button, then "Add server URL". "MCP" and "integrations.sh" are not explained. She closes it by clicking the same button again.
3. She decides to try Notion and clicks "Add" → "Adding…" until the poll sees "connected" (checked every 2 s for about 90 s); a popup opens to the provider. If the popup is blocked there is no message and the button stays "Adding…" until the timeout text `Connection to Notion is still pending. You can close this and check again.`
4. After sign-in the tile turns to "Added" (no success message). She clicks the "Added" button → a detail view with Back, "Uninstall", an "Accounts" card (editable "Account label", "Remove", "Add another") and a tools card.
5. Read the tools card → header "# tools" with a chevron (expanded by default), then a plain list of humanized tool names (underscores to spaces, first letter capitalised, e.g. "Create page") with no descriptions or read/write marking. "Loading tools…" or "No tools available." appear in the other states, and a load error also shows "No tools available." Elena can now see capabilities, but only after connecting; the tool descriptions exist in the data (`ConnectionTool.description`) but are not rendered.
### Variations
- She never opens the detail and does not know that "Added" is clickable.
- She checks which agents will have access: the overlay does not show it. For MCP servers, access is per agent in the "MCP servers" overlay ("Agents:" chips), reachable from Advanced → "Manage MCP servers".
- She wants to undo: "Uninstall" in the detail revokes every account with no confirmation, while removing an MCP server asks `Remove {name}?` and "Bots lose access to its tools."
### Edge Cases
- Connecting before understanding is the only way to see what an app does, which is the main hesitation point for cautious users.
- "Added" suggests installing something to Rakazo, not granting access to her Notion account; the reassuring text "Credentials are encrypted and never sent to the model." is only inside Advanced forms.
- The overlay passes `activeBotId` for `onboarding.appConnected`, so an app connects from the context of the current agent, but the UI never says which agent that is.
