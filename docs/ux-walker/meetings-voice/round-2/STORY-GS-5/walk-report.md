# STORY-GS-5: The key stops working (needs_reconnect) (round 2)

**Result: PASS**

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **2 Open the Granola card after a revoked key.** Card keeps '● Synced 42 meetings' and Disconnect, adds an empty editable key field, the red line 'Granola rejected this key', a dimmed Connect and the 'Granola agent' link. No relative time is shown although the plan says the time shows when a sync is late or failed. Screenshot: `screenshots/key-reconnect.png`

- **3 Reconnect action.** No 'Reconnect' button: the field plus Connect is the action, as the plan says (same connection and agent are reused). Screenshot: `screenshots/key-reconnect.png`

- **4 Paste the new key and Connect.** Verified live: typing hides the error line and enables Connect; pressing it runs Connecting, Syncing, Synced. Screenshot: `screenshots/key-reconnect-edited.png`

- **5-6 Sync resumes.** 'Synced 42 meetings' returns; the agent link stays. Screenshot: `screenshots/key-connected.png`

- **1 Agent answers with stale data.** Plan defines it as text: the skill adds 'last synced {date}' only when the connection is needs_reconnect (granola.md Tool output). Not a drawn surface.

- **Mobile Needs reconnect on iPhone.** Status group with Disconnect, a second group with the empty field and dimmed Connect, red line below. Matches the web card. Screenshot: `screenshots/mob-key-reconnect.png`

- **390 390 px spot-check.** Rejected card fits without overflow (reconnect variant uses the same card). Screenshot: `screenshots/m390-key-rejected.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 3 steps (open page, paste, Connect) = Ideal 3. Hesitation: the green dot and 'Synced 42 meetings' still read as healthy next to a red error, and the Integrations tile state in needs_reconnect is not drawn, so a user looking at the tile sees nothing wrong.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-GS-5-01 | fixed | needs_reconnect keeps the status line and Disconnect and shows an editable field (key-reconnect.png), as plan Surfaces describes. |
| F-GS-5-02 | fixed | Agent side: the skill adds 'last synced {date}' when the connection is needs_reconnect (granola.md Tool output). The missing notification remains; see F2-GS-5-02. |
| F-GS-5-03 | fixed | Plan: pasting a new key updates the same connection and reuses the same agent; the field plus Connect is the replace action. |
| F-GS-5-04 | fixed | Field is editable in both rejected and reconnect states (verified). |
| F-GS-5-05 | fixed | No explanatory sentence is rendered under the card. |

## New findings (round 2)

- **F2-GS-5-01** (medium, mockup): In needs_reconnect the status row stays a green dot with 'Synced 42 meetings' and no time, although the plan says the relative time shows when the sync is late or failed. Fix: Draw the relative time and a non-green dot in the reconnect state, web and mobile.
- **F2-GS-5-02** (medium, plan): The Integrations tile in needs_reconnect is not drawn. The tile shows one status line (best connected route), so it may keep showing 'Synced 42 meetings' while the key is dead. The plan defines no in-app notice for needs_reconnect either. Fix: Decide and draw the tile for needs_reconnect; record 'no notification' as a decision if intended.
