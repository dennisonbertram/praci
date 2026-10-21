# STORY-MX-6: Flow S5 stops after the allowlist pin (round 2)

**Result: PASS**

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Integrations with Flow connected.** Tiles 'Wispr Flow / Meeting notes / Connected' and 'Granola / Meeting notes / Connected' side by side. No sync line for Flow, as FX-47 decides. Screenshot: `screenshots/flow-tile.png`

- **2-5 S5 stopped case.** Plan S5 now says: Flow agent keeps only live MCP tools, the PR lists tools the pin removed, no synced status, no user-facing copy. The drawn agent and Inbox frames would not exist in that case; the mockup comment says so.

- **390 390 px spot-check.** n/a for tile; agent and Inbox fit. Screenshot: `screenshots/m390-flow-inbox.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Plan-defined silence: the user cannot tell whether Flow meetings are synced. Actual 2 steps = Ideal 2 (ask the Flow agent; works through live MCP calls).

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-MX-6-1 | still-open | Plan keeps 'no user-facing copy' for the stop case. The tile reads 'Connected' either way. Reduced to medium because the stop case is conditional and Flow shows no sync claim; see F2-MX-6-01. |
| F-MX-6-2 | still-open | Both tiles read 'Meeting notes'. Low, see F2-MX-6-02. |

## New findings (round 2)

- **F2-MX-6-01** (medium, plan): If S5 stops after pinning, a user who asks the Flow agent a cross-meeting question gets live-MCP answers only; the Granola agent cannot see Flow calls and nothing says why. The plan decides on silence. Fix: Add one sentence to the Flow preset instructions for the stopped case.
- **F2-MX-6-02** (low, mockup): Flow and Granola tiles show the same subtitle 'Meeting notes' and the same 'Connected' badge although one syncs and one may not. Fix: Optional.
