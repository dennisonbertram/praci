# STORY-MX-8: Mixed-source meeting-only user: first week (round 2)

**Result: PASS**

Outdated or changed by the plan: Step 7: Disconnect keeps data and the agent keeps answering (plan Surfaces). Step 2 uses the existing Flow tile.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Granola key, Connect.** As GS-1: Connecting, Syncing, 'Synced 42 meetings', agent link. Screenshot: `screenshots/key-connected.png`

- **2 Flow tile connected.** Tile 'Connected', 'Wispr Flow agent' in the sidebar. Screenshot: `screenshots/flow-tile.png`

- **3 Ask about last week.** Cited answers in both agents. Screenshot: `screenshots/agent-answer.png`, `screenshots/flow-agent.png`

- **4-5 Inbox, no mail.** To do card above 'Connect mail'; first item from a meeting. Flow Inbox state (flow-inbox.png) draws the To do card alone with no 'Connect mail' card (inconsistent with the Granola frame). Screenshot: `screenshots/inbox-todos.png`

- **6 Complete one.** Tick fades the row (verified). Screenshot: `screenshots/inbox-todos.png`

- **7 Disconnect Granola.** Frames show the card, the agent answer and the to-do after Disconnect. Screenshot: `screenshots/disc-after.png`

- **390 390 px spot-check.** Fits. Screenshot: `screenshots/m390-inbox.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 6 steps vs Ideal 6. Hesitation at step 4: the permanent 'Connect Gmail' card for a user without mail (F2-IF-1-03).

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-MX-8-1 | fixed | To do card above 'Connect mail' (inbox-todos.png). |
| F-MX-8-2 | fixed | Consent off draws the existing prompt (inbox-consent.png); wording is a separate finding F2-IF-5-01. |
| F-MX-8-3 | fixed | 'Syncing' state drawn on the card and the Inbox. |
| F-MX-8-4 | obsolete | Plan: replacing a healthy key = Disconnect (data kept) then Connect; a dead key is replaced in place (needs_reconnect). |
| F-MX-8-5 | fixed | Plan dedupes per (userId, normalized text), so one promise from two sources gives one row; provider not shown by decision. |
| F-MX-8-6 | fixed | No author notes rendered. |

## New findings (round 2)

- **F2-MX-8-01** (low, mockup): The Flow mockup's Inbox state shows the To do card without the 'Connect mail' card, unlike the Granola Inbox frames for the same meeting-only user. Fix: Add the Connect mail card or note the user has mail.
