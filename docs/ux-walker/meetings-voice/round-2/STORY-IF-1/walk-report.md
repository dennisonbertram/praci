# STORY-IF-1: Meeting-only founder finds her follow-ups in the Inbox (round 2)

**Result: PASS**

Outdated or changed by the plan: Step 2-3: the 'No mail connected' page no longer takes the whole page when a meeting source exists; the To do card sits above 'Connect mail' (FX-14, plan S5).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1-3 Open Inbox with no mail account.** Inbox shows the To do card first (three items with 'From: {title}, {date}' and due labels) and, below it, 'Connect Gmail to read, sort and answer your mail here.' with 'Connect mail'. No search bar or tabs. Geometry clean. Screenshot: `screenshots/inbox-todos.png`

- **4 Row has no link.** Meeting rows are plain text with no sender, as the plan decides (no meetings page). Screenshot: `screenshots/inbox-todos.png`

- **5 Tick an item.** Verified live: tick fades the row and it leaves; the card keeps the other two. Checkbox hit area is 32 px (label.hit). Screenshot: `screenshots/inbox-todos.png`

- **6 Reload keeps it gone.** Plan S5: completion is stored; not testable in static HTML.

- **Mobile iPhone Inbox, With to-dos.** 'TO DO' group with three rows and a '2 more' row, then the 'Connect mail' row. 24 px circles inside 44 pt rows. Screenshot: `screenshots/mob-inbox-todos.png`

- **390 390 px spot-check (web).** Card and Connect-mail card stack; no overflow. Screenshot: `screenshots/m390-inbox.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 2 steps (open Inbox, tick) vs Ideal 3. Duplicated content: 'Connect Gmail...' card stays below the to-dos for a user who may never connect mail. No hesitation on finding the to-dos now that the card is first.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-IF-1-01 | fixed | To do card above 'Connect mail' (inbox-todos.png); full 'No mail connected' page only when no meeting source (plan S5). |
| F-IF-1-02 | obsolete | Plan Deliberate choices: the '{title}, {date}' line is not tappable. Open in Granola is reachable from the chat citation popover. |
| F-IF-1-03 | obsolete | Plan Deliberate choices: the sidebar Inbox badge stays mail-only. Residual noted as F2-IF-1-02. |
| F-IF-1-04 | fixed | Mobile frame draws the '2 more' collapse (mob-inbox-todos.png). Persistence on reload is a plan matter (S5). |
| F-IF-1-05 | fixed | Tick fades the row out (verified). |
| F-IF-1-06 | fixed | Web checkbox label is 32 px; mobile target is the row (but see F2-IF-1-01). |

## New findings (round 2)

- **F2-IF-1-01** (medium, mockup): Mobile mockup completes a to-do when the user taps anywhere on the row; the mockup comment says the whole row is the 44 pt target. The plan says a meeting row has no tap action and only the checkbox acts. Fix: Change the mockup script and comment to match the plan, or change the plan.
- **F2-IF-1-02** (low, plan): Nothing signals that new meeting to-dos arrived (badge stays mail-only by decision). A meeting-only founder has to open Inbox on her own. Fix: Keep as decided; revisit with usage data.
- **F2-IF-1-03** (low, plan): A meeting-only user sees 'Connect Gmail to read, sort and answer your mail here.' permanently under the to-dos. Fix: Optional: allow dismissing; otherwise accept as the plan's FX-14.
