# STORY-IF-1: Meeting-only founder finds her follow-ups in the Inbox (round 3)

**Result: PASS**

Outdated or changed by the plan: Steps 2-3: plan puts the To do card above 'Connect mail' for a meeting-only user and shows 'No mail connected' only without a source (S5 Zero-account layout). Step 4: row detail is 'Pricing review, 12 Oct' with no 'From:'.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1-3 With to-dos frame: To do card first, then 'Connect Gmail to read, sort and answer your mail here.' with 'Connect mail'. g-d-inbox-todos.png
- 3 Syncing frame: card shows 'Syncing' with shimmer. g-d-inbox-syncing.png
- 4 Rows are plain text, no sender, no link; Fri / Today due labels right-aligned. g-d-inbox-todos.png
- 5 Tick: web checkbox target 32x32, the row fades out. Mobile: only the 44x44 checkbox button acts, tapping the row text does nothing (verified: count stayed 3 after row tap, 2 after tapping the checkbox). g-d-mobile1-todos.png, g-d-mobile1-ticked.png
- Mobile: first three rows then '2 more' and a 'Connect mail' row. g-d-mobile1-todos.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: Inbox card fits, no overflow. g-m-inbox-todos.png

## Flow Log

Ideal 3 actions: open Inbox, see the card, tick. Actual 3. No extra setup step stands in the way.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-IF-1-01 | fixed | Mobile: row tap does nothing, only the 44x44 checkbox button completes (live click test). |
| F2-IF-1-02 | still-open | Inbox badge stays mail-only by plan decision (Deliberate choices). Low, accepted. |
| F2-IF-1-03 | still-open | 'Connect Gmail...' card still sits under the to-dos for a meeting-only user (plan keeps it below the card). Low, accepted. |

## New findings (round 3)

None.
