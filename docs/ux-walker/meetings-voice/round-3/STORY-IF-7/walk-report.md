# STORY-IF-7: A to-do cites a meeting the user later deleted in Granola (round 3)

**Result: PASS**

Outdated or changed by the plan: Steps 4-5: per-meeting Delete exists (plan S6, Decisions 'Deletion'); Disconnect still keeps data. The deleted-in-Granola copy stays by design (plan Sync, Deletions).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Inbox shows the to-do with detail '{title}, {date}'. g-d-inbox-todos.png
- 3 Ask the agent about the meeting: answer with a citation chip. g-d-agent-answer.png
- 4 Open the chip: popover with attendees ('Dana Reyes, you'), 'Open in Granola' link and a red 'Delete' button. g-d-citation-open.png
- 4 Press Delete: confirmation 'Delete "Pricing review"?', 'Removes this meeting and its to-dos from Rakazo. Your note in Granola is not changed.' g-d-citation-confirm.png
- 5 Disconnect keeps the data (see GS-7).

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: Open popover not visible (see F3-GS-7-01).

## Flow Log

Ideal 2 actions. Actual 4 (ask the agent, open the chip, Delete, confirm); the plan chose this path. Hannah must know the meeting title to ask.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-IF-7-01 | still-open | 'Open in Granola' may point at a note deleted in Granola; the plan has no text for it (only 'source link when one exists'). Low. |

## New findings (round 3)

None.
