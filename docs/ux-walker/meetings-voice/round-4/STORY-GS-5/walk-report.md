# STORY-GS-5: The key stops working (needs_reconnect) (round 4)

**Result: PASS**

Walked: Granola mockup, integrations tile and api-key screen (Reconnect needed, Reconnect key rejected). Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Step 1 and edge case "no in-app notification": plan states the tile status is the only notice; not a gap.

## Steps

- Step 2: Integrations tile reads "Reconnect needed" with the warning dot instead of "Synced N meetings". (g-d-integrations-reconnect.png)
- Step 3: Reconnect, key rejected frame: status row "Reconnect needed" with Disconnect, editable field, key link, Connect, consent sentence. The red line appears only in this frame (after a failed Connect). The passive frame has no red line. (g-d-api-key-reconnectbad.png, g-d-api-key-reconnect.png)
- Step 4-5: Syncing then Connected frames: status returns to "Syncing" then "Synced N meetings"; same agent. (g-d-api-key-syncing.png, g-d-api-key-connected.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-api-key-reconnectbad.png: fits at 390, no overflow.

## Flow Log

Actual 3 steps (open page, paste, Connect) matches ideal 3.

## Round-3 findings

The round-3 findings file for this story had no findings.

## New findings (round 4)

None.
