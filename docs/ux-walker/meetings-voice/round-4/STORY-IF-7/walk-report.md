# STORY-IF-7: A to-do cites a meeting the user later deleted in Granola (round 4)

**Result: PASS**

Walked: Granola mockup, citation and inbox screens. The catalog says not mocked, but Delete is drawn. Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Steps 1-3 and 5 are plan behaviour with no extra UI. Step 4 is drawn.

## Steps

- Step 1: Inbox still lists the to-do with its meeting title and date. (g-d-inbox-todos.png)
- Step 4: Citation popover Delete, then the confirmation dialog "Delete ..." with Delete and Cancel. (g-d-citation-open.png, g-d-citation-confirm.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-citation-confirm.png: dialog fits at 390.

## Flow Log

Actual 3 actions (ask, open chip, Delete) are possible. Disconnect keeping data is explained by the card sentence (GS-7).

## Round-3 findings

The round-3 findings file for this story had no findings.

## New findings (round 4)

- F4-IF-7-01 (low, mockup): The citation popover repeats the title and date in bold ("Pricing review, 12 Oct" in the Granola popover, "Security sync, 14 Oct" in the Flow popover). The plan says the popover shows attendees, the source link and Delete, and that "title and date repeat the chip and are not shown again". Same defect as F4-GS-7-01.
