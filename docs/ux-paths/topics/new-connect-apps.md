# Topic: The "Connect apps" sidebar pill

Code read: `apps/web/src/components/ConnectAppsButton.tsx` and its test, `apps/web/src/pages/Shell.tsx` (renders it at the bottom of the sidebar, `onClick` closes the mobile sidebar and goes to `/app/integrations`), `connections.featured` in `apps/api/src/router.ts` and `packages/contracts/src/rpc.ts`, `popularApps` in `apps/web/src/lib/integrations.ts`, `packages/core/src/featured-connectors.ts`, `apps/web/src/components/integrations/IntegrationsHome.tsx` and `AppLogo.tsx`.

Key facts from the code (used below):
- The sidebar row has two looks, both with `data-testid="sidebar-integrations"`. The **pill** reads "Connect apps" and shows up to three overlapping app logos on its right. The **plain row** has a grid icon and reads "Integrations". Neither has a tooltip.
- The pill shows only when the load finished, at least one featured app is unconnected, and the Integrations page is not open. In every other case (loading, request failed, all featured apps connected, on the Integrations page) the plain row shows. While loading, the plain row shows first, then turns into the pill. A failed request is swallowed: no error text anywhere.
- Featured apps are Gmail, Google Calendar, Google Drive, Slack, Notion (`FEATURED_CONNECTOR_IDS`). The pill calls `connections.featured` (the featured subset only, so it does not wait for the full catalog) and `connections.list` together; both must succeed.
- An app leaves the pill only when this space has a row with status `connected` for it. A `pending` or `error` row does not remove it. A connected row that needs reconnecting also counts as connected and does remove it (not tested; the code filters on `status === "connected"` only).
- The pill is reloaded on mount and each time the Integrations page closes (the `active` flag flips back to false). It does not reload while Integrations is open and does not poll.
- The pill and the plain row open the same page. At most three logos show, in catalog order, one per featured app id (aliases such as `slackbot` collapse into Slack).
- The Integrations page itself shows a "Popular" grid (same `popularApps` list, featured first), "Find an app" search, a category filter, and connected apps with their status. Logos on the pill and the page come from the same catalog item.
- Demo stack: the seed connects Gmail twice (accounts "Founder mail (Mock)" and "Sales mail (Mock)") in the main company space and connects nothing else through Connections (`seed.ts`, "Inbox" step). The Composio emulator catalog is in order Gmail, Google Calendar, Google Drive, Slack, GitHub, Notion (`composio-emulator.ts`; slugs `GMAIL`, `GOOGLECALENDAR`, `GOOGLEDRIVE`, `SLACK`, `GITHUB`, `NOTION`). So in the main demo space Gmail is connected and the pill should show Google Calendar, Google Drive, Slack (three logos). In the empty demo space (`MOCK DEMO DATA` empty space, nothing connected) it should show Gmail, Google Calendar, Google Drive. Logos come from `cdn.simpleicons.org`; a walk with no internet shows the first letter of each app in the logo tile instead (UNVERIFIED which the walker sees).
- Information shown on more than one surface: (1) which featured apps are unconnected: the pill logos, the "Popular" grid, and the app status on the Integrations page; (2) connected status: the Integrations page and the Inbox ("Open Inbox" link on a connected Gmail card); (3) the destination "Integrations": the sidebar row (both looks) and the command-style page search entry "Integrations" in `Shell.tsx` (`searchPages`).

---

## STORY-NA-1: First visit, nothing featured connected
**Type**: short
**Topic**: Connect apps pill
**Persona**: Dana, a founder of a four-person logistics startup who has just created her company space and has not connected anything.
**Goal**: Notice from the sidebar that she can connect apps, without hunting for a settings page.
**Preconditions**: Demo stack up; sign in and switch to the empty demo space (no connections). Composio emulator catalog configured, so `connections.featured` returns Gmail, Google Calendar, Google Drive, Slack, Notion, GitHub-filtered to the five featured apps.
**Ideal path**: 1 — the pill is already visible; she only has to read it.
**Alternate paths**: The page search entry "Integrations" and a direct visit to `/app/integrations` reach the same page, but neither is a prompt.
### Steps
1. Open `/app` and look at the bottom of the sidebar, above the user menu → a rounded pill labeled "Connect apps" with three overlapping logos (Gmail, Google Calendar, Google Drive) on its right. For a moment after load the row may read "Integrations" with a grid icon, then change to the pill.
2. Hover the pill → the background becomes the sidebar hover color. No tooltip names the three apps.
3. Read the logos → Dana sees three logos but not their names; the pill gives no label for them. UNVERIFIED whether the logos are recognizable at the small size (`size-5`).
### Variations
- Space with Gmail connected (main demo space): logos are Google Calendar, Google Drive, Slack.
- Narrow browser or phone width: the sidebar opens as a drawer; the pill sits at the bottom of the drawer.
- Dark mode: logos from Simple Icons are requested as black and inverted, so they should stay visible on the pill.
### Edge Cases
- No internet for the logo CDN: each logo tile falls back to the app's first letter (G, G, G for the three Google apps, which cannot be told apart).
- Slow connection: the plain "Integrations" row shows first; Dana may click it before the pill appears (see STORY-NA-5).

---

## STORY-NA-2: Click the pill to reach Integrations
**Type**: short
**Topic**: Connect apps pill
**Persona**: Marcus, an operations lead who wants his bot to read Slack.
**Goal**: Land on the page where he can connect Slack.
**Preconditions**: Main demo space (Gmail connected, so the pill shows Google Calendar, Google Drive, Slack). Open on a bot chat.
**Ideal path**: 2 — click the pill, then click "Connect" on Slack (the page lists Slack under "Popular").
**Alternate paths**: The "Integrations" entry in the page search; the URL `/app/integrations`. No other button in the sidebar leads to Integrations.
### Steps
1. Click "Connect apps" → the app goes to `/app/integrations`; on a phone the drawer closes first. The page heading reads "Integrations".
2. Look at the sidebar bottom → the pill is gone, replaced by a highlighted row labeled "Integrations" with a grid icon (the current page).
3. Scroll the "Popular" grid → Slack shows with a "Connect" button (its accessible name is "Connect Slack"). Featured apps are listed first.
### Variations
- Click the pill from a different page (Inbox, Finance, Data room): same result; the previous page is left without a warning.
- Use browser Back from Integrations → the previous page returns; the pill reappears after the reload described in STORY-NA-4.
### Edge Cases
- Double click: the second click lands on the plain row and navigates to the same URL again; nothing visible changes.
- The three logos on the pill (Calendar, Drive, Slack) are not a selection: clicking a single logo does not open that app's setup. Marcus must find Slack again on the page. UNVERIFIED how obvious this is.

---

## STORY-NA-3: The plain "Integrations" row on its own page
**Type**: short
**Topic**: Connect apps pill
**Persona**: Priya, a product manager who has connected all five featured apps and now opens Integrations to check them.
**Goal**: Reach and recognize the Integrations page when there is nothing left to promote.
**Preconditions**: A space where Gmail, Google Calendar, Google Drive, Slack and Notion are all connected. The demo does not seed this; connect them first (the sign-in step in the popup is a real third-party step the mock may not complete, so this story is most reliable if the walker uses a space where earlier walks already connected them, otherwise mark the story NOT WALKABLE on the mock stack). Alternative on the demo: on the main space only Gmail is connected, so the plain row shows only while the Integrations page is open.
**Ideal path**: 1 — click the plain row.
**Alternate paths**: Page search "Integrations"; URL `/app/integrations`.
### Steps
1. Look at the bottom of the sidebar → the plain row "Integrations" with a grid icon, no pill, no logos.
2. Click "Integrations" → the page opens; the row gets a highlighted background and `aria-current="page"`.
3. Read the page → the heading "Integrations", the connected apps with their status, the "Popular" grid with remaining apps, "Find an app" search, "Add custom connection".
### Variations
- Demo main space with the page open: the row is plain and highlighted even though three featured apps are unconnected (the pill hides while the page is active so it does not point to the page already open).
- Click the row while already on the page: nothing changes.
### Edge Cases
- Keyboard: Tab to the row and press Enter; it is a real button, so it works.
- Screen reader: the pill's accessible name is "Connect apps" (the logos are `aria-hidden`); the plain row's name is "Integrations". The same destination has two names depending on state.

---

## STORY-NA-4: The pill updates after connecting an app
**Type**: medium
**Topic**: Connect apps pill
**Persona**: Hana, the founder of a design studio, connecting Slack and then checking the sidebar.
**Goal**: See the pill drop Slack once it is connected, and still see it if the sign-in did not finish.
**Preconditions**: Main demo space (pill shows Google Calendar, Google Drive, Slack). The sign-in popup for Slack is a real third-party step ([REAL THIRD-PARTY SIGN-IN]); on the mock stack, begin the connection and leave it unfinished to get the pending state. Completing it needs the Composio emulator to mark the account connected.
**Ideal path**: 4 — open Integrations (pill), click "Connect" on Slack, finish sign-in, go to another page and look at the sidebar.
**Alternate paths**: Connect from the Inbox or another page that links to Integrations; the pill reload rule is the same (it reloads whenever Integrations is left).
### Steps
1. Click "Connect apps" → the Integrations page opens; the sidebar row is now plain "Integrations".
2. Click "Connect" on Slack → a sign-in popup opens; the Slack tile shows "Waiting for you to finish signing in." while the connection is pending.
3. Leave the sign-in unfinished, then click another page in the sidebar (for example Inbox) → the sidebar row goes back to the pill and still shows Slack among the logos, because a pending connection does not count as connected.
4. Open Integrations again, click "Try again" on the Slack row, finish sign-in → the tile shows Connected.
5. Click a different page in the sidebar → the pill reloads; Slack's logo is gone and the next unconnected featured app (Notion) takes its place, so it shows Google Calendar, Google Drive, Notion.
### Variations
- The sign-in fails (the tile shows the error text, or "Sign-in did not finish."): the app stays in the pill, with "Try again" on the page.
- Connect all remaining featured apps one by one: the pill loses logos until none are left, then the row turns plain "Integrations".
- Connect a second Gmail account while Gmail is already connected: no change to the pill.
### Edge Cases
- While the Integrations page is open the pill does not reload, so there is no live change in the sidebar; the change shows only after leaving the page.
- Returning from Integrations: the row may show the old pill (old logos) for a moment before the new list arrives, because the previous list stays in state until the new request finishes. UNVERIFIED whether this flash is visible.
- A Gmail account that is connected but needs reconnecting counts as connected, so Gmail leaves the pill even though mail does not work. The Inbox and the Integrations "Reconnect" button carry that state instead.

---

## STORY-NA-5: Slow catalog and failed request fall back to the plain row
**Type**: medium
**Topic**: Connect apps pill
**Persona**: Tomas, a founder on hotel Wi-Fi who opens the app and clicks as soon as the sidebar appears.
**Goal**: Reach Integrations even when the app list is slow or the request fails, without seeing a broken sidebar.
**Preconditions**: Demo stack. For the slow case, throttle the network in the browser (the pill requests `connections.featured`, not the full catalog, so a slow full catalog alone should not delay it). For the failed case, block the two requests (`connections.featured` and `connections.list`) in the browser tools, or stop the API after the page loads and reload the sidebar by leaving and re-entering a page.
**Ideal path**: 1 — click the row that is there, whichever look it has.
**Alternate paths**: Page search "Integrations"; URL `/app/integrations`.
### Steps
1. Reload `/app` with throttled network → the bottom of the sidebar shows the plain "Integrations" row with a grid icon while the requests are in flight.
2. Wait → once both requests finish, the row changes to the "Connect apps" pill with logos. The pill does not wait for the full app catalog (the page's heavier request).
3. Reload again with `connections.featured` blocked (or failing) → the row stays the plain "Integrations" row. No error, no retry button, no message.
4. Click "Integrations" → the page opens as usual; if the full catalog request also fails, the page shows "Could not load the app list. Reload to try again."
### Variations
- Only `connections.list` fails: the pill also stays hidden (both requests are awaited together), even though the featured list loaded.
- Request recovers: the row stays plain until the next time the Integrations page is left or the app reloads; there is no automatic retry.
### Edge Cases
- Tomas clicks the plain row during loading: he reaches the page; when he leaves it, the pill appears if the requests then succeed.
- The same failure message ("Could not load the app list...") appears on the Integrations page, but the sidebar row itself says nothing, so the failure is only visible on the page.
- A server with no app catalog set up: `connections.featured` returns an empty list, so the plain row shows, and the page explains "App connections aren't set up on this server yet." (UNVERIFIED on the demo, which has an emulator catalog.)

---

## STORY-NA-6: One logo per app, including the Slack alias
**Type**: short
**Topic**: Connect apps pill
**Persona**: Leo, a chief of staff who sees the pill and expects three different apps.
**Goal**: The pill shows each featured app once, with the right logo, even if the catalog lists an app twice.
**Preconditions**: The unit test uses a catalog with `slack` and `slackbot`; the demo catalog has only `SLACK`. To walk the alias case on the demo stack, the catalog must list a second Slack-like entry, which the emulator does not; mark that variation NOT WALKABLE and rely on the unit test (`ConnectAppsButton.test.tsx`, "shows one logo when Slack and its alias are both unconnected"). The walkable part is to check that the demo pill has three different logos.
**Ideal path**: 1 — look at the pill.
**Alternate paths**: The "Popular" grid on Integrations lists the same apps; there, check that Slack has a single tile.
### Steps
1. Open the main demo space and look at the pill → three logos: Google Calendar, Google Drive, Slack, each once.
2. Open Integrations and find Slack in "Popular" → one Slack tile with "Connect".
3. Compare → the pill's Slack logo and the tile's logo are the same image.
### Variations
- Catalog lists `slack` and `slackbot` (both unconnected): one Slack logo in the pill, not two. The alias list also maps `gmail`, `googlemail`, `gcal`, `gdrive`, `notion.so` to their app.
- Slack connected: neither `slack` nor `slackbot` appears in the pill.
- Native Google available (desktop app with Google set up): the native Gmail replaces the Composio Gmail in the list; if native Gmail is connected, Gmail does not appear at all.
### Edge Cases
- An app outside the five featured apps (GitHub, Figma) never appears on the pill, even when unconnected and listed first in the catalog.
- Fewer than three featured apps left: the pill shows one or two logos.
- A logo fails to load: that tile falls back to the app's first letter, but the other logos are unaffected.
