# STORY-GS-7: Disconnect keeps the data (round 4)

**Result: PASS**

Walked: Granola mockup, disconnect, api-key, citation, inbox screens. Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Step 5 uses the citation popover Delete (plan, Surfaces). Inbox "Source disconnected" has no separate frame: the plan says a to-do from a disconnected source looks like any other, and the Disconnect After frame shows the to-do.

## Steps

- Step 1-2: Before: connected card with Disconnect. After: key field empty, "Rakazo keeps your meetings and to-dos." above it, Connect, consent sentence, agent link kept; no confirmation dialog. (g-d-disconnect-before.png, g-d-disconnect-after.png, g-d-api-key-disconnected.png)
- Step 3: Agent chat still answers with a citation in the After frame. (g-d-disconnect-after.png)
- Step 4: The Inbox frame shows the open to-do after disconnect. (g-d-disconnect-after.png, g-d-inbox-todos.png)
- Step 5: Citation closed, open (attendees, "Open in Granola", Delete), and the Delete confirmation. (g-d-citation-closed.png, g-d-citation-open.png, g-d-citation-confirm.png)
- Step 6: No frame; same connection and agent reused per plan. (-)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-citation-open.png: bottom sheet with title, attendees, link and Delete, 44 px targets.

## Flow Log

Actual 2 steps (open page, Disconnect) matches ideal 2; the sentence answers the data question.

## Round-3 findings

| Round-3 id | Status | Evidence |
|---|---|---|
| F3-GS-7-01 | fixed | At 390 px the popover now renders as a bottom sheet inside the frame with Delete visible (g-m-citation-open.png). |

## New findings (round 4)

- F4-GS-7-01 (low, mockup): The citation popover repeats the title and date in bold ("Pricing review, 12 Oct" in the Granola popover, "Security sync, 14 Oct" in the Flow popover). The plan says the popover shows attendees, the source link and Delete, and that "title and date repeat the chip and are not shown again".
