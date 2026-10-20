# Topic: Connect a managed app

Code read: `apps/web/src/pages/PluginsOverlay.tsx` (`connect()`, `renderCatalogActions`, `renderDetail`), `apps/web/src/lib/plugin-connect.ts`, `apps/web/src/pages/GoogleOAuthCallback.tsx`, `apps/web/src/pages/Inbox.tsx`, `apps/web/src/pages/Shell.tsx` (`onConnectMail`), `connections.*` in `apps/api/src/router.ts`, `packages/adapters/src/{composio,pipedream}-connector.ts`.

Key facts from the code (used below):
- `connect()` calls `connections.begin` (display name = app name, or "{name} 2", "{name} 3" for later accounts), then `window.open(authorizationUrl, "rakazo-plugin-connect", "noopener,noreferrer")`, then polls `connections.complete({connectionId})` up to 45 times, 2 s apart (about 90 s). On success: tile flips to "Added", `onboarding.appConnected` is sent (errors ignored), the list refreshes, and the tools list reloads. No toast.
- The return value of `window.open` is never checked, so a blocked popup produces no message; the button just stays "Adding…" until the timeout.
- Composio: `authorize()` returns a redirect URL, with `callbackUrl` = `{webOrigin}/app`. If there is no redirect URL it waits up to 20 s for the account and returns `authorizationUrl: null`. Pipedream: a Connect link on a Pipedream domain with `?app={slug}` and success and error redirects both set to `{webOrigin}/app`. Pipedream's `noAuth` is always `false`; Composio's is `toolkit.isNoAuth`.
- `begin` with no `authorizationUrl` marks the row `connected` at once. The overlay skips the poll only when `item.noAuth` is true and there is no URL. If no URL arrives for an app not flagged noAuth, it polls and the first `complete` finds it connected.
- Errors: any thrown error shows `errorText(err, "Could not connect")` in red above the grid. Timeout shows "Connection to {name} is still pending. You can close this and check again." in the same red style. Closing the overlay aborts the poll silently.
- `GoogleOAuthCallback.tsx` is only for native Google (`/integrations/google/callback`). Composio and Pipedream return to `/app` in the popup.
- Closing the popup cannot be detected. Nothing in the overlay notices.
- Native Google is not configured locally (no GOOGLE_* vars), so Gmail and Calendar come from Composio or Pipedream. `preferNativeGmail` only swaps in native Gmail when native Google is available.
- Walker limit: the Add click, the "Adding…" state, and the popup opening (URL on the provider's domain) are reachable. Signing in with Google, Slack or Notion inside the popup is **[REAL THIRD-PARTY SIGN-IN]** and cannot be completed by a walker.

---

## STORY-008: Connect Slack from the featured grid
**Old ID**: STORY-200 + folded-in STORY-100
**Type**: medium
**Topic**: Connect a managed app
**Persona**: Priya, a product manager who just signed up and wants her bot to read a Slack channel for her.
**Goal**: Slack shows "Added" and she can see it works.
**Preconditions**: Signed in; Composio or Pipedream configured on the server; Slack has no existing account; the browser allows popups from the app.
**Ideal path**: 3 — click "Integrations", click "Add" on Slack, finish sign-in in the popup.
**Alternate paths**: Search "slack" in "Search apps" and click "Add" on the catalog tile (the featured grid is hidden while a query is typed); this is more steps and can show a Composio and a Pipedream Slack tile side by side.
### Steps
1. Click "Integrations" at the bottom of the sidebar → the overlay opens, shows "Loading integrations…", then the featured grid (Gmail, Google Calendar, Google Drive, Slack, Notion). Priya wonders what "Integrations" will do for her; nothing explains it.
2. Click "Add" on the Slack tile → the button becomes "Adding…" and is disabled; a popup opens to the provider's sign-in page. She half-expects the tile itself to change, and the word "Adding…" does not tell her to look at the popup.
3. **[REAL THIRD-PARTY SIGN-IN]** Pick a Slack workspace and click Allow in the popup → the provider redirects the popup to `{app}/app`; the popup page loads the app. (The popup is not closed by the code; Priya may be unsure whether to close it.)
4. Wait up to 2 s on the overlay → the poll sees `connected`; the button reads "Added" and is enabled. No message appears. Priya checks that the tile changed, then clicks "Added".
5. Click "Added" → the detail view opens: Slack name, "Uninstall", the "Accounts" card with one row labeled "Slack", "Add another", and a tools card.
### Variations
- Pipedream instead of Composio: same labels; the popup is a Pipedream Connect page with the app preselected.
- Slack is listed twice (one per provider): Priya must guess which to pick.
### Edge Cases
- Priya clicks "Add", then clicks outside the popup and the popup hides behind the main window: the button stays "Adding…" with no hint where the popup went.
- She clicks the tile body while "Adding…" (not the button): behavior depends on `renderCatalogTile`; the button itself is disabled.

---

## STORY-009: Popup blocked, so "Adding…" never finishes
**Old ID**: STORY-201
**Type**: short
**Topic**: Connect a managed app
**Persona**: Marcus, a designer on Safari with strict popup blocking, trying to connect Notion.
**Goal**: Understand why Notion is not connecting and get it connected.
**Preconditions**: Browser blocks `window.open` that is not treated as user-initiated (the call happens after an awaited `connections.begin`, so some browsers will block it); Notion not connected.
**Ideal path**: 3 — click "Add", allow popups, click "Add" again.
**Alternate paths**: Desktop (Electron) build: popup handling is the shell's; no browser prompt appears. Not verified here.
### Steps
1. Click "Integrations" → overlay opens with the featured grid.
2. Click "Add" on Notion → "Adding…"; the browser quietly blocks the popup (maybe a small icon in the address bar). Nothing in the overlay changes. Marcus thinks the app is just slow.
3. Wait about 10 to 20 s → still "Adding…". He wonders whether to click again; the button is disabled.
4. Wait up to ~90 s → red text: "Connection to Notion is still pending. You can close this and check again." The tile goes back to "Add" if the connection is not yet `connected`. (The text blames a pending state, not a blocked popup.)
5. Allow popups for the site in the browser, then click "Add" on Notion again → a new `begin` call; the popup opens this time. Continue as STORY-008 from step 3. **[REAL THIRD-PARTY SIGN-IN]** for the sign-in part.
### Variations
- Marcus leaves the overlay during the wait: the poll aborts silently and the pending row is left on the server (see STORY-013).
### Edge Cases
- `window.open` returning `null` is never checked, so there is no immediate error; the only feedback is the 90 s timeout.
- On the retry the server's `pickReusableConnection` returns nothing while a `pending` row exists, so a second pending row is created (a stale "Notion" pending row can sit next to the new one).

---

## STORY-010: Connect Gmail from the Inbox "Connect mail" prompt
**Old ID**: STORY-202 + folded-in STORY-101
**Type**: medium
**Topic**: Connect a managed app
**Persona**: Dana, a founder who opens Inbox for the first time and sees an empty page with one button.
**Goal**: See her Gmail messages in Inbox.
**Preconditions**: Signed in; no connected Gmail account; Composio or Pipedream configured; native Google not configured.
**Ideal path**: 4 — click "Connect mail", click "Add" on Gmail, finish sign-in, close the overlay.
**Alternate paths**: Sidebar "Integrations" then "Add" on the Gmail tile in the featured grid (same connect code, but the search box starts empty and Gmail is in the featured grid); Inbox is not told about the change until she reopens or refreshes it (not verified).
### Steps
1. Click "Inbox" in the sidebar → the page loads. With no accounts, the page shows a single "Connect mail" button. Dana does not know whether this uses her Google password or a connector.
2. Click "Connect mail" → the Integrations overlay opens with "Search apps" prefilled with "gmail" (`pluginsQuery = "gmail"`). Because a query is present, the featured grid is hidden and she sees search results instead; the Inbox is paused (`paused={pluginsOpen}`).
3. Find the Gmail result and click "Add" → "Adding…" and a popup opens to Composio or Pipedream's Google sign-in. There may be several Gmail tiles from different providers; she does not know which is the right one.
4. **[REAL THIRD-PARTY SIGN-IN]** Choose her Google account and approve the Gmail permissions → the popup lands on `{app}/app`.
5. Return to the overlay and wait up to 2 s → the Gmail tile says "Added". No confirmation is shown.
6. Close the overlay (the overlay's close control) → she returns to Inbox. Whether it now lists mail depends on the Inbox reload after un-pausing; the code read does not show an explicit refresh on connect (not verified). She wonders whether to reload.
### Variations
- She types something else in "Search apps" and then clears it: the featured grid returns, and she can find Gmail there too.
- Native Google configured (production): `preferNativeGmail` swaps in the native Gmail tile and the connect goes through the system browser on desktop or `/integrations/google/callback` on the web (see STORY-016).
### Edge Cases
- Connected Gmail through Composio then switching to native later may show a second account (`Gmail 2`).
- If the user connects but the Gmail tile search also lists "Google Calendar" or "Google Drive" results (name match on "gmail" only, so likely not).

---

## STORY-011: Provider error on "Add"
**Old ID**: STORY-203
**Type**: short
**Topic**: Connect a managed app
**Persona**: Tom, an engineer on a fresh self-hosted deployment where the Composio API key is wrong.
**Goal**: Find out why Gmail will not add.
**Preconditions**: Composio key invalid or revoked; catalog still loads from cache or the other provider.
**Ideal path**: 2 — click "Add", read the error.
**Alternate paths**: `/integrations/setup` (deployment owner only, unlinked) to fix the key.
### Steps
1. Open "Integrations" → featured grid appears.
2. Click "Add" on Gmail → "Adding…" for a moment, then `connections.begin` fails. A red line above the grid shows the error text, or "Could not connect" if the error has no message. The tile returns to "Add". Tom reads the message but it may be a raw provider message (sanitized by `sanitizeComposioError`).
3. Click "Add" again → the same error; he does not know it is a server credential problem and not something he did.
### Variations
- A non-owner user sees the same error but cannot reach the setup page (unlinked); there is no "ask your admin" hint.
- Pipedream: "Pipedream did not return a secure HTTPS connect URL" can appear if the Connect link is not HTTPS.
### Edge Cases
- If a connection row was created before `connector.begin` threw, the row is left pending or cleaned up; the handler handles the race, but a user-visible pending ghost is possible (not observed).
- The red error stays until the next action; it does not time out.

---

## STORY-012: The 90-second wait: user signs in late or closes the popup
**Old ID**: STORY-204
**Type**: medium
**Topic**: Connect a managed app
**Persona**: Aisha, an operations lead who opens the Slack popup, gets pulled into a meeting, then comes back.
**Goal**: Finish connecting Slack.
**Preconditions**: Slack not connected; popups allowed.
**Ideal path**: 4 — Add, sign in, wait out the timeout message, click "Add" again or check the tile.
**Alternate paths**: Reopen the overlay: `refresh()` shows pending rows as active accounts, so the tile may already read "Added" only if a row is `connected`.
### Steps
1. Click "Add" on Slack → "Adding…" and a popup opens. She starts reading the Slack consent screen.
2. **[REAL THIRD-PARTY SIGN-IN]** She steps away for two minutes without approving → nothing happens; the overlay shows "Adding…" and the button is disabled for about 90 s.
3. After about 90 s → red text: "Connection to Slack is still pending. You can close this and check again." The overlay refreshes the list. She returns, sees the message, and thinks it means the connection was made and is just slow.
4. She returns to the popup, approves Slack → the provider redirects to `/app`. The overlay is no longer polling, so nothing updates.
5. She clicks "Add" again (the tile still reads "Add" if no row was `connected`) or closes and reopens "Integrations" → a reopened overlay calls `connections.catalog`, which reconciles pending rows against live connected accounts, so Slack should show "Added". This is the path the message hints at as "check again".
### Variations
- She closes the popup instead of approving: the app cannot detect it; the same 90 s wait and the same message follow.
- She closes the overlay during the wait: the poll aborts silently, with no message.
### Edge Cases
- At 90 s `refresh()` runs: a pending row is listed by `activeAccounts` (pending counts), so the detail view could show an account row that is not really connected (the discovery notes that pending looks connected).
- Clicking "Add" while a poll is running is impossible (disabled), but clicking "Add" on a different tile aborts the first poll silently.

---

## STORY-026 [folded-in, was STORY-205]: Detail view, tools, and adding a second account
**Folded into**: STORY-026 (see catalog.md). Original steps kept here for reference.
**Type**: medium
**Topic**: Connect a managed app
**Persona**: Leo, a consultant with a work and a personal Gmail address.
**Goal**: Have both Gmail accounts connected and know what the bot can now do.
**Preconditions**: One Gmail account already connected (tile reads "Added").
**Ideal path**: 4 — click "Added", click "Add another", sign in with the second account, rename it.
**Alternate paths**: Search "gmail" in "Search apps" and click the "Added" button on the result tile (goes to the same detail view). There is no "Add" on a connected tile, so "Add another" in the detail view is the only code route to a second account.
### Steps
1. Click "Integrations" then "Added" on the Gmail tile → detail view: Back button (aria-label "Back"), "Gmail", "Uninstall". He notices "Uninstall" sits right next to the title with no explanation of whether it removes both accounts later.
2. Read the "Accounts" card → one row with an input (aria-label "Account label") showing "Gmail" and a "Remove" button, then "Add another". The tools card shows "Loading tools…" then "# tools" (singular "# tool" for one), a collapsible list of names only. He cannot tell what each tool does.
3. Click "Add another" → the button becomes "Adding…"; `begin` is called with display name "Gmail 2"; a popup opens.
4. **[REAL THIRD-PARTY SIGN-IN]** Sign in with the personal Google account in the popup. If the browser is already signed in to the work account, Google may reuse it without asking; Leo has to pick "Use another account". This is outside the app.
5. Wait → the Accounts card lists two rows, "Gmail" and "Gmail 2", both with "Remove". The tools list reloads.
6. Click into the "Gmail 2" input, type "Personal Gmail", press Enter → the field blurs and `renameAccount` saves it. No confirmation text. If rename fails: "Could not rename connection".
### Variations
- Pipedream: a second authorization lands as a separate Pipedream account; the account id is resolved during revoke.
- Composio: the same Google login again may return the same account (provider-specific; not verified).
### Edge Cases
- Display names come from `nextAccountLabel(item.name, existing.length)` counting only connected rows, so a pending row can lead to two rows both named "Gmail 2".
- "Back" returns to the grid; the tile still says "Added".
- If tools fail to load, the list says "No tools available." and does not say it failed.

---

## STORY-013: Leaving mid-connect and finding a half-added app
**Old ID**: STORY-206
**Type**: medium
**Topic**: Connect a managed app
**Persona**: Hana, who clicks "Add" on Google Calendar, then changes her mind and closes the overlay.
**Goal**: Reopen Integrations later and know whether Calendar is connected.
**Preconditions**: Google Calendar not connected; popup opened but sign-in not completed.
**Ideal path**: 3 — close the overlay, reopen "Integrations", look at the tile.
**Alternate paths**: none found for clearing a stuck pending row: the detail view lists pending as an account, and "Remove" or "Uninstall" revokes it.
### Steps
1. Click "Add" on Google Calendar → "Adding…" and the popup opens.
2. Close the popup without signing in → nothing in the overlay changes.
3. Close the Integrations overlay → the unmount aborts the poll; there is no message, and the server row stays `pending`.
4. Click "Integrations" again → the catalog and list reload. The tile reads "Add" unless a `connected` row exists. Hana sees "Add" and clicks it. A second pending row may be created.
5. If she opens a tile whose only row is pending, `activeAccounts` includes pending rows, so the Accounts card can show a "Google Calendar" row with "Remove". She is told nothing about its state. She clicks "Remove" → `revoke` runs; the row goes away or the error "Could not revoke connection" is shown.
### Variations
- Same flow on Slack or Notion.
### Edge Cases
- The Accounts card gives no status label, so a pending account looks the same as a connected one.
- Whether the tile reads "Added" with only a pending row depends on `item.connected` from the catalog (true only if the provider reports a live account) and not on pending rows.

---

## STORY-014: noAuth app connects without a popup
**Old ID**: STORY-207
**Type**: short
**Topic**: Connect a managed app
**Persona**: Jonas, who searches the catalog for a utility app that needs no sign-in (for example a weather or web-search style toolkit).
**Goal**: Add the app and see it as "Added".
**Preconditions**: Composio configured; the catalog has a toolkit flagged `noAuth` (Composio `isNoAuth`). Pipedream items are never noAuth. Which toolkit qualifies is not known from the code; a walker should search the catalog for one.
**Ideal path**: 2 — click "Add", see "Added".
**Alternate paths**: none found.
### Steps
1. Type the app name into "Search apps" → catalog results replace the featured grid.
2. Click "Add" → "Adding…" briefly; `begin` returns no `authorizationUrl` and the row is already `connected`; no popup opens. The tile flips to "Added" without any visible event. Jonas wonders whether anything happened, since no sign-in occurred.
3. Click "Added" → the detail view shows the single account row and the tools list.
### Variations
- Composio returns no redirect URL but the app is not flagged noAuth (for instance, an account is already authorized upstream): the overlay still polls, and the first `complete` returns `connected`, so the result looks the same but takes up to 2 s.
- Composio may wait up to 20 s inside `begin` for the account, so "Adding…" can last longer with no popup.
### Edge Cases
- If the toolkit returns the noAuth error, `begin` returns `state = provider` and no URL; the row is marked connected.
- Because no popup opens, there is nothing to block or close.

---

## STORY-015: Choosing between duplicate Composio and Pipedream tiles for Notion
**Old ID**: STORY-208 + folded-in STORY-102
**Type**: long
**Topic**: Connect a managed app
**Persona**: Elena, a careful operations manager who wants Notion connected for the team's weekly bot report and does not want to authorize the wrong thing.
**Goal**: Connect one Notion account, confirm it, and know what her bot can do with it.
**Preconditions**: Both COMPOSIO_API_KEY and PIPEDREAM_* are set locally, so the merged catalog may list Notion twice (once per provider); the active agent is selected.
**Ideal path**: 6 — open, search "notion", pick one tile, sign in, open detail, read tools.
**Alternate paths**: Featured grid "Add" on the Notion tile (one tile, which provider backs it is not shown); native Google is not relevant to Notion.
### Steps
1. Click "Integrations" → featured grid with Notion visible. She wonders what "Integrations" gives her and whether it is safe.
2. Type "notion" into "Search apps" → featured grid hides; catalog tiles appear, possibly two Notion tiles (different providers) with identical names and logos. She cannot see which provider each belongs to and hesitates.
3. Click "Add" on the first Notion tile → "Adding…"; a popup opens to Composio's or Pipedream's OAuth flow.
4. **[REAL THIRD-PARTY SIGN-IN]** Sign in to Notion and choose which pages to share → the popup lands on `{app}/app`.
5. Back in the overlay, within 2 s → the tile reads "Added". Elena checks that no success message appeared and trusts the label.
6. Click "Added" → detail view: Accounts ("Notion"), "Add another", tools card "# tools" with names such as the provider's page and database tools. She reads names only.
7. Click "Back" → the grid; the other Notion tile (other provider) still says "Add". She leaves it alone, unsure if it will create a duplicate.
8. Close the overlay → the active agent now has Notion tools via `onboarding.appConnected`; the overlay does not say which agents can use it.
### Variations
- She clicks "Add" on the second Notion tile as well: a second connection through the other provider is created; nothing warns her.
- She clicks "Uninstall" from detail by mistake: all accounts for that tile are removed with no confirmation.
### Edge Cases
- Whether a connection made through one provider marks the other provider's tile as "Added" is not shown in the code read.
- The `appConnected` call swallows failures, so the agent may not be told even though the tile says "Added".

---

## STORY-016: Native Google path on web and desktop (when configured)
**Old ID**: STORY-209
**Type**: long
**Topic**: Connect a managed app
**Persona**: Ravi, an admin on a production deployment with Google credentials configured, connecting Gmail on both the web app and the desktop app.
**Goal**: Connect Gmail with the native Google connector on each surface.
**Preconditions**: GOOGLE_* variables set on the server (not true locally); a walker on the local dev setup cannot reach this path.
**Ideal path**: 5 — Add, system browser or popup sign-in, callback completes, tile reads "Added".
**Alternate paths**: Composio or Pipedream Gmail tile on the same deployment (same overlay, different connector).
### Steps
1. Web: click "Integrations" then "Add" on Gmail → `preferNativeGmail` selects the native Google tile; `begin` uses redirect URL `{webOrigin}/app`; the overlay opens a popup named `rakazo-plugin-connect`. Rows show "Adding…".
2. **[REAL THIRD-PARTY SIGN-IN]** Approve in Google → the popup lands on `/integrations/google/callback?code=…&state=…`; it shows "Connecting…", calls `connections.complete({state, code})`.
3. The popup shows "Connected" and "You can close this window." and closes itself (`window.close()`); the overlay's poll sees `connected` and shows "Added".
4. Failure variation: Ravi denies access → the popup shows "OAuth connection failed" with the provider's description or "OAuth authorization was cancelled." and "You can close this window."; the overlay keeps polling until 90 s, then shows the pending message.
5. Desktop: the same "Add" uses `redirect: "desktop"`; the system browser opens (Google refuses embedded browsers). **[REAL THIRD-PARTY SIGN-IN]** The shell catches the code on loopback, the window calls `connections.complete({state, code})`, and the tile reads "Added" with no popup window.
### Variations
- Opening `/integrations/google/callback` directly in a normal tab (not the popup): on success it navigates to `/app`; on error it shows "Return to Praci".
- Missing `code` or `state` in the URL: "OAuth connection failed" with "OAuth authorization was cancelled."
### Edge Cases
- `completeNativeOAuth` rejects the state if it does not match the user and space; the error shows in the popup, not the overlay.
- The desktop path aborts silently if the user closes the overlay (controller aborted).
