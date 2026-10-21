# STORY-IF-8: Connected Granola, no commitments yet (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 1-2: 'No mail connected' is replaced by the To do card above 'Connect mail' when a source is connected (plan S5). Step 4 copy is defined: 'No follow-ups from meetings yet'.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Syncing frame: 'To do' card with the word 'Syncing' (shimmer). g-d-inbox-syncing.png
- 1 Empty frame: card with the heading and 'No follow-ups from meetings yet', then the 'Connect Gmail...' card. g-d-inbox-empty.png
- 3 Granola card shows 'Synced 42 meetings' (connected frame), consistent with the empty card. g-d-api-key-connected.png
- Mobile: same card with a native activity row and the empty line. g-d-mobile1-syncing.png, g-d-mobile1-empty.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: fits. g-m-inbox-empty.png

## Flow Log

Ideal 1 action: open Inbox and read one line. Actual 1.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-IF-8-01 | still-open | An MCP-only user sees an Inbox with no meeting source and nothing says the API key feeds it (plan: MCP tile alone is not a meeting source). Low, accepted with GS-4 F2-GS-4-02. |

## New findings (round 3)

None.
