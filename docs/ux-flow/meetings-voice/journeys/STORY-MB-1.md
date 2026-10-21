# STORY-MB-1: Paste a Granola API key from the phone

Critic session: uxf-mb1. Verdict: **convoluted as the code stands today, acceptable as planned if the plan adds a mobile entry point (see section 3).**

Evidence: story in `docs/ux-paths/meetings-voice/catalog.md` (STORY-MB-1), `docs/plans/granola.md` (Surfaces, S6), the mockup screen `docs/granola/mockup.html#screen-mobile`, and the mobile code in `apps/mobile/app/(settings)/integrations.tsx`, `integration-setup.tsx`, `account.tsx`, plus `packages/core/src/featured-connectors.ts`. Screenshots: `STORY-MB-1-screens/mobile-empty.png`, `mobile-rejected.png`, `mobile-connected.png` (all opened and inspected). The feature is not built, so every "planned" step is from the plan and mockup, not observed behavior.

## Should this journey exist on mobile at all?

Short answer: yes, but only as a very small field, and only if it can be reached without a new screen. A deep link to web is the worse option.

- Measured: the only existing handoff to web, "Open web app" in `integration-setup.tsx` (lines 158 to 181), opens a URL in the phone browser. The phone browser is a separate session from the app, so the user would sign in to the web app again before reaching the card. That is at least as many steps as pasting in the app, plus a second sign-in.
- Measured: the story's precondition is that the key sits in a password manager on the phone. Pasting from a password manager into a native secure field is the shortest possible way to move a secret. The server then syncs; the phone does nothing further.
- Suspected: most users create the key in the Granola desktop app, so they are at a laptop when the key exists. Those users would use the web card (S6 on web). The phone journey matters only for someone who created the key earlier and is away from the laptop, which is a minority. This argues for low investment, not for removal.
- Not worth a separate flow: "Signed in with Granola" (the MCP tile). It cannot be added on mobile and does not need to be (see Take-away pass).

## 1. Friction scorecard

Ideal path in the story: 4 steps (Settings, Integrations; open Granola tile; paste key; tap Connect).

| Measure | Today (measured from code) | As planned (plan + mockup) | Ideal |
|---|---|---|---|
| Steps to a working sync | Not possible. The only Granola path is Advanced, Add MCP server, which takes a bearer token or none and does not start the sync (catalog story, steps 4). | At least 6, because the plan does not say how the user reaches the Granola page (see below) | 4 |
| Taps/inputs before the field is visible | n/a | Settings (1), Integrations (2), then an unspecified way to Granola (3 and 4: search or scroll, then open) | 3 |
| Decisions | Which button to press on a generic tile ("Add" starts browser OAuth, wrong for a key) | None once the field is visible; Connect is the only action | 0 |
| Confirmations | 0 | 0 (Disconnect has none drawn; it deletes a stored secret but keeps meetings, so no dialog is defensible) | 0 |
| Re-entry | Key must be re-pasted after a rejection; mockup keeps the pasted key in the field (good) | Same | Same |
| Dead ends | "Add" on a generic tile leads to "Connection pending", "Finish connecting in the browser, then refresh this page." (measured, `connect()` polls 45 times, 2 seconds each, about 90 seconds) | After "Connect" succeeds the user sees "Synced 42 meetings, 3 minutes ago" and no onward action | One onward action: the bot or Inbox |
| Hesitations | Tile shows "Add"; user cannot tell it is the wrong flow | "Live questions / Signed in with Granola" group is above the key group; a user wonders whether they must do it first | One field, one button |

Where the extra planned steps come from (measured):

1. `integrations.tsx` shows five featured tiles only: Gmail, Google Calendar, Google Drive, Slack, Notion (`FEATURED_CONNECTOR_IDS`, `featured-connectors.ts`). Granola is a web-only tile defined in `apps/web/src/lib/integrations.ts`. So the mobile user must search "Granola" or scroll the catalog. The plan names no tile.
2. In `renderCatalogTile`, a tile is pressable to open its detail only when connected (`if (connected)`). An unconnected tile has only an "Add" button. A key field placed "in the detail" would therefore be unreachable before the first connection. That is a structural problem for the plan, not a copy problem.
3. The mockup draws a full "Granola" page with a back link and a large title. Mobile today has an in-page detail view (`renderDetail`, a Back link inside the same screen), not a pushed route.

## 2. Take-away pass per screen

Screen: mobile Granola page, empty state (`mobile-empty.png`).

| Element | Verdict | Reason |
|---|---|---|
| "Live questions" header + "Signed in with Granola / Connected" row | Remove from mobile | Not a task on this screen. Mobile cannot add or change the MCP tile, so the row is a status the user cannot act on. The catalog already notes that mobile has nothing to read it from. Showing it would need a second data source for no user action. Heuristics 8 and 12. |
| "Sync" section header | Remove | One group on the page remains; the field's own placeholder says what it is. |
| "Granola API key" field | Keep | The core input. Needs `textContentType`/password-manager friendly secure field; trim whitespace (the voice screen already does `apiKey.trim()`). |
| "Connect" row | Keep as the one primary action | Only action on the screen. |
| Large "Granola" title and back chevron | Keep | Native navigation, no extra words. |
| "Granola rejected this key" | Keep | Needed state. Heuristic 5 asks for a next action; see Clarity issues. |
| "Synced 42 meetings, 3 minutes ago" | Keep | The success evidence. |
| "Disconnect" (red) | Keep, in connected state only | Destructive, so red is right. |

Mockup state check: empty and rejected states show Connect always; the connected state replaces the field with the status and Disconnect, which is correct progressive disclosure (the field vanishes once it is no longer needed).

Count of visible words in the empty state after the take-away pass: "Granola", "Granola API key", "Connect" (3 strings, down from 7 in the mockup). This meets the AGENTS.md rule that visible words are UI.

## 3. The simpler version

Ideal steps, as planned after changes:

1. Settings, Integrations (2 taps, exists today).
2. Tap the "Granola" tile (it is on the first screen without searching).
3. Paste the key into the secure field (password manager autofill).
4. Tap "Connect". The row becomes "Synced {n} meetings, {relative time}" and "Disconnect".

Four steps, equal to the story's ideal. Concrete plan changes:

- `docs/plans/granola.md`, section "Surfaces" (mobile bullet, line 149), and issue S6: state that the mobile Granola entry is a tile on the integrations screen that is visible without searching, and that it opens the key field directly. Today the plan says only "a field and status row on `integrations.tsx`", and that leaves the entry point open.
- S6 (Owns list, `integrations.tsx`): handle the unconnected-tile problem. The key row must be reachable before any connection exists. Cheapest: for the `granola-api` item, the tile's trailing control is an inline secure field plus "Connect" in the same row group (no detail page), and the generic "Add" button is not shown. This avoids both a new route and the dead-end "Add" path.
- S6, same section: the mobile card shows only the key group. Drop the "Live questions / Signed in with Granola" group from the mockup's mobile screen (`docs/granola/mockup.html`, `#screen-mobile`) and the "Sync" header.
- S6: say the field trims whitespace, and that the key never leaves the device except in the `meetings.connect` request (the plan already keeps it out of output).
- Do not add a deep link or "Open on web" for tiles. It costs a second sign-in (measured above) and a second copy of the instructions.
- Confirm in S6 whether `granola-api` appears in `connections/catalog`. The catalog story flags this as a gap. If it does, the generic "Add" button (browser OAuth) shows on it today; the tile must suppress it. If it does not, the tile must come from a fixed entry like the web's `integrations.ts`. Both choices need a named decision in the plan.

## 4. Clarity issues

- Measured: "Granola rejected this key" says what happened but not what to do next. A user on a plan without API access (see STORY-MB-2) cannot fix it by re-pasting. Suspected: users will retry the same key. Suggested cost: zero new words if the rejected state also shows nothing else, but the plan must decide whether a Pro-plan hint appears; AGENTS.md requires that to be argued in the PR.
- Measured: in the mockup the connected state says "Synced 42 meetings, 3 minutes ago" with no onward action. The user's next action is to ask the Granola agent or open Inbox. Dead end by heuristic 5, but the plan deliberately has no meetings screen, so the cheapest fix is none on mobile (the bot appears in the bot list, which is the onward path). Mark as accepted, not a defect.
- Suspected, not measured: there is no "Connecting" copy in the plan, though the mockup draws one on the web card ("Verifying"). On mobile the button should show a spinner, not a word. Use the existing `NativeActionButton` loading state rather than new copy.
- Relative time localizes through mobile `i18n`; the plan's strings are not yet in the locale files (catalog edge case). Not a simplification issue but a release blocker for non-English locales.

## Summary

- Steps: planned 6 or more (entry point unspecified, key field unreachable on unconnected tiles); ideal 4; today not achievable on mobile.
- Verdict: convoluted today, acceptable as planned, minimal with the plan changes in section 3.
- No simplification found for the paste-and-connect interaction itself; the field plus one button is already the minimum.
