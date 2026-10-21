# STORY-GS-3: MCP tile first, then the key (two Granola agents) (round 3)

**Result: OUTDATED**

Outdated or changed by the plan: Decision 'One agent': a user has one Granola agent and the key attaches to it (plan, Agent provisioning). Steps 3 to 6 (two agents, which one to ask, delete the extra) no longer exist. The remaining steps are walked as 'Sign-in only' then key.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 'Sign-in only' frame: the Integrations tile shows 'Granola / Connected', the sidebar has one 'Granola agent'. g-d-integrations-mcp.png
- 1 The detail page shows the MCP card as 'Connected' with Disconnect above the key card with an empty field and Connect. g-d-api-key-mcp.png
- 2 After Connect the tile reads 'Synced 42 meetings' and the sidebar still has one 'Granola agent' (the 'Key connected' frame). g-d-integrations-key.png
- The detail page for both routes connected is not drawn (MCP card with Disconnect above a key card with its own Disconnect).

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

## Flow Log

Ideal 3 actions: paste, Connect, keep asking the same agent. The mockup supports that with a single agent row throughout.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| none | | |

## New findings (round 3)

- **F3-GS-3-01** (medium, mockup): The detail page with both routes connected is not drawn. It would carry two Disconnect buttons (MCP card, key card) with different effects: the MCP one signs out of Granola, the key one stops sync and keeps stored meetings. Nothing tells them apart. Fix: Draw a 'Both connected' frame and label the buttons or the cards so the effects are distinguishable (for example the key card's sentence 'Rakazo keeps your meetings and to-dos.' appears only after its Disconnect).
