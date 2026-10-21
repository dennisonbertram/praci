# STORY-GS-3: MCP tile first, then the key (one Granola agent) (round 4)

**Result: PASS**

Walked: Granola mockup, integrations and api-key screens (Both connected, Sign-in only). Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Step 5: the plan labels the rows with the existing route words; the mockup uses shorter labels (see new finding). Steps 2-3: no UI surface for "attach to the existing agent"; the plan says nothing is created.

## Steps

- Step 1: Sign-in only: compact row "Sign-in - Connected" with its own Disconnect above the key card (empty field, key link, Connect). (g-d-api-key-mcp.png)
- Step 2-3: Both connected: one "Granola agent" link on the key card, one agent in the sidebar BOTS list. (g-d-api-key-both.png)
- Step 4: Agent answer with citation (same frame as GS-1). (g-d-agent-answer.png)
- Step 5: Both connected: two rows, "Sign-in - Connected" and "API key - Synced 42 meetings", each with its own Disconnect. The Integrations tile shows "Synced 42 meetings". (g-d-api-key-both.png, g-d-integrations-both.png)
- Step 6: No delete affordance for the agent, as the plan says. (-)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-api-key-both.png: both cards stack, no overflow.

## Flow Log

Actual 3 actions equals ideal 3. No choice between routes is shown to the user.

## Round-3 findings

| Round-3 id | Status | Evidence |
|---|---|---|
| F3-GS-3-01 | fixed | The "Both connected" frame now exists on the integrations list and on the detail page (g-d-api-key-both.png); each row has its own label and Disconnect. |

## New findings (round 4)

- F4-GS-3-01 (low, mockup): The Both connected rows read "Sign-in" and "API key". The plan (Surfaces, Page order) says each row is labelled with its existing route words, "via MCP" and "Granola API key".
