# STORY-IF-8: Connected Granola, no commitments yet (round 2)

**Result: PASS**

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Open Inbox, first sync running.** To do card with the one word 'Syncing', then the 'Connect mail' card. Screenshot: `screenshots/inbox-syncing.png`

- **1b Open Inbox, synced, no commitments.** To do card with 'No follow-ups from meetings yet' above 'Connect mail'. This is the one line the ideal path asks for. Screenshot: `screenshots/inbox-empty.png`

- **3 Compare with the Granola card.** 'Synced 42 meetings' on the card; the same word 'Syncing' appears while running on both surfaces. Screenshot: `screenshots/key-connected.png`

- **Mobile iPhone empty and syncing.** 'TO DO' group with 'No follow-ups from meetings yet', 'Connect mail' row below. Screenshot: `screenshots/mob-inbox-empty.png`

- **390 390 px spot-check.** Card fits. Screenshot: `screenshots/m390-inbox.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 1 step = Ideal 1. 'Syncing' and 'No follow-ups from meetings yet' use the existing card shape, so no new chrome is added.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-IF-8-01 | fixed | Empty state draws the To do card with the empty line above 'Connect mail' (inbox-empty.png). |
| F-IF-8-02 | obsolete | 'Syncing' now separates the running case. Plan S5 says 'Digest failed', 'no identity match' and 'no commitments' look the same by choice. |
| F-IF-8-04 | fixed | Empty card plus Connect-mail card fill the pane (inbox-empty.png). |

## New findings (round 2)

- **F2-IF-8-01** (low, plan): MCP-only users see an Inbox identical to 'no meeting source' (plan S5: MCP tile alone is not a meeting source). Nothing says the API key feeds the Inbox. Same decision as F2-GS-4-02. Fix: See F2-GS-4-02.
