# STORY-GS-4: Free or Pro user pastes a key, is rejected, falls back to MCP (round 4)

**Result: PASS**

Walked: Granola mockup, integrations detail and api-key screens. Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Step 8 and the catalog edge case about "Business plan" matches the plan: the label sits after the key field label; the tile has no plan label.

## Steps

- Step 1: Detail page with neither route connected: "Sign in with Granola" is the main block, key card below with "Business plan" after the label. (g-d-integrations-detail.png)
- Step 2-4: Key rejected frame: one line "Granola rejected this key". (g-d-api-key-rejected.png)
- Step 5-6: Sign-in only frame: "Sign-in - Connected", agent in sidebar, key card still empty. (g-d-integrations-mcp.png)
- Step 7-8: Chat answers are not specific to this story (agent frame, see GS-1). (-)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-integrations-detail.png: one column, no overflow.

## Flow Log

Actual 2 steps (see the label, use the sign-in) matches ideal 2. The key field never blocks the MCP path.

## Round-3 findings

The round-3 findings file for this story had no findings.

## New findings (round 4)

None.
