# STORY-GS-4: Free or Pro user pastes a key, is rejected, falls back to MCP (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 1 and the edge case 'key card above MCP': the plan orders MCP controls first and the key card below (Surfaces, Page order). Step 4: the free-plan hint is the muted 'Business plan' after the field label.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Detail page: 'Sign in with Granola' card first, then 'Granola API key - Business plan' card. g-d-integrations-detail.png
- 2-3 Paste a token and Connect: 'Granola rejected this key'. g-d-api-key-rejected.png
- 4 The user sees 'Business plan' next to the label and the MCP sign-in directly above, so the free-plan fallback is visible without leaving the page.
- 5-6 Sign in via the MCP card: frame 'Sign-in only' shows 'Connected' with Disconnect and a Granola agent in the sidebar. g-d-api-key-mcp.png
- 7-8 Ask the agent: live MCP answers are not drawn separately (agent frame is shared). g-d-agent-answer.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: both cards stack, no overflow. g-m-api-key-rejected.png

## Flow Log

Ideal 2 actions: see that the key path needs Business, connect through MCP. Actual 2 (the MCP card is the first thing on the page). No friction found.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-GS-4-01 | fixed | Detail page shows the MCP sign-in card above the key card in every state (g-d-integrations-detail.png, g-d-api-key-rejected.png). |
| F2-GS-4-02 | still-open | Nothing tells an MCP-only user that Inbox to-dos need the key. The plan stays silent by choice (copy minimal, plan Not built / Inbox rule: MCP tile alone is not a meeting source). Low. |

## New findings (round 3)

None.
