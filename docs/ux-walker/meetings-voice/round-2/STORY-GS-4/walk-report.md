# STORY-GS-4: Free or Pro user pastes a key, is rejected, falls back to MCP (round 2)

**Result: FAIL**

Outdated or changed by the plan: Steps 1 and 4 changed: the plan shows the 'Business plan' hint on the key field label and keeps the MCP controls first on the page (Surfaces, Page order).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Integrations, Granola detail.** Detail page draws only the key card. The plan says the existing MCP controls come first and the key card below (Surfaces, Page order); no MCP row, button or sign-in text is drawn above or below the card. Screenshot: `screenshots/int-detail.png`

- **2-3 Paste a random token, Connect, rejection.** Rejection line is the same single line. The label already says 'Business plan', which tells the free user the key is not for them (R1 F-01 fixed). Screenshot: `screenshots/key-rejected.png`

- **5 Press the MCP sign-in control.** No frame draws an MCP sign-in control. The 'Sign-in only' state in screen 1 (int-mcp.png) shows the tile already 'Connected' with the Granola agent in the sidebar, but nothing shows how the user got there. Journey breaks at step 5 inside the mockup.

- **6-7 After sign-in, ask the agent.** The connected state and an agent answer are drawn, but the answer screen is the stored-meetings run (chips with titles), not a live-MCP answer. Screenshot: `screenshots/int-mcp.png`, `screenshots/agent-answer.png`

- **8 'What did I promise last week?' gives no to-do.** For an MCP-only user the plan says the Inbox shows 'No mail connected' (MCP tile is not a meeting source). That Inbox state (screen 4) is not drawn for this user and nothing tells him that to-dos need the key. Screenshot: `screenshots/inbox-empty.png`

- **390 390 px spot-check.** Fits; the key link wraps (low). Screenshot: `screenshots/m390-int-detail.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Ideal 2 steps (see key needs Business, connect through MCP). Actual in the mockup: the user can see 'Business plan' but has no drawn route to MCP, so the second step cannot be taken. Hesitation point: the detail page for a user without a key is a lone key field; a free user would conclude Granola cannot be connected.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-GS-4-01 | fixed | 'Business plan' hint sits on the field label (int-detail.png) and is the plan's decided explanation. |
| F-GS-4-02 | still-open | The mockup now draws a first-time 'Not connected' tile and a 'Sign-in only' connected state, but no MCP sign-in control on the detail page. See F2-GS-4-01. |
| F-GS-4-03 | obsolete | 'Live questions' and 'Sync' groups no longer exist; the open point is now the missing MCP row (F2-GS-4-01). |
| F-GS-4-04 | fixed | Tile has one status line and no 'Add key' button (int-new.png, int-key.png). |

## New findings (round 2)

- **F2-GS-4-01** (high, mockup): The detail page of a user who is not connected draws only the key card. The plan's page order (MCP controls first, key card below) and the free-plan fallback (the MCP tile keeps working for free and Pro users) cannot be followed in the mockup: there is no MCP sign-in control and no 'Connect' for the MCP route. Fix: Draw the existing MCP sign-in row above the key card in the 'Detail page' state, plus the 'Sign-in only' detail page with the key card empty below it.
- **F2-GS-4-02** (low, plan): An MCP-only user never learns that Inbox to-dos need the API key. The plan is silent by choice (copy minimal), so a free-to-Business upgrader is the only person who finds out. Fix: Record the decision in granola.md; do not add copy unless wanted.
