# STORY-GS-7: Disconnect keeps the data (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 5 (delete) is now partly defined: per-meeting Delete in the citation popover for the user who connected (plan, S6, Decisions 'Deletion'). Step 3: the card now says 'Rakazo keeps your meetings and to-dos.'

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Before: card with status, Disconnect, agent link. g-d-disconnect-before.png
- 2 After: key card shows 'Rakazo keeps your meetings and to-dos.' above the empty key field, with the Granola agent link retained. g-d-disconnect-after.png, g-d-api-key-disconnected.png
- 3 The agent chat still answers from stored meetings with a citation chip. g-d-disconnect-after.png (Agent chat)
- 4 Inbox still lists the to-do and it can be completed. g-d-disconnect-after.png (Inbox)
- 5 Delete: citation popover with 'Delete', then confirmation 'Delete "Pricing review"?' with body 'Removes this meeting and its to-dos from Rakazo. Your note in Granola is not changed.' and Cancel / Delete. g-d-citation-open.png, g-d-citation-confirm.png
- 6 Pasting a new key later restores sync (Disconnected frame has an empty field and Connect). g-d-api-key-disconnected.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: Open popover not visible (new finding F3-GS-7-01); confirmation dialog fits. g-m-citation-open.png, g-m-citation-confirm.png

## Flow Log

Ideal 2 actions: open the page, press Disconnect, with a line about stored data. Actual 2 and the line is there. To get meetings removed Ethan needs one chat question per meeting plus Delete.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-GS-7-01 | fixed | After Disconnect the card says 'Rakazo keeps your meetings and to-dos.' (g-d-disconnect-after.png). |
| F2-GS-7-02 | still-open | Delete exists per meeting via a citation only (drawn); no way to remove all stored meetings. Plan Decisions: per-meeting delete only, everything else kept permanently. Medium, accepted by decision; revisit if bulk erase is requested. |
| F2-GS-7-03 | fixed | Disconnected key card draws the sentence in both the Disconnect screen and the api-key frame (g-d-api-key-disconnected.png). |

## New findings (round 3)

- **F3-GS-7-01** (low, mockup): At 390 px the citation 'Open' popover (the only place Delete is reached) is not visible in the mockup: it renders below the frame and is clipped, so the Delete entry point cannot be seen at phone width. The confirmation dialog is fine. Fix: Anchor the popover inside the frame at narrow widths (position it under the chip with max-width, or let the frame grow).
