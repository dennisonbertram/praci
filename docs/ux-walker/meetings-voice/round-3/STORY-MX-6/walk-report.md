# STORY-MX-6: Flow S5 stops after the allowlist pin (round 3)

**Result: PASS**

Outdated or changed by the plan: Plan wispr-flow.md S5: if S5 stops after pinning, the Flow agent keeps only live MCP tools, the PR lists removed tools, no 'synced' status is shown for Flow and there is no user-facing copy. Judged against that.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Tile frame: 'Wispr Flow / Meeting notes / Connected' next to Granola with the same text. w-d-flow-meetings-tile.png
- 5 No Flow sync status line is drawn, which matches the plan ('no synced status is shown for Flow'). w-d-flow-meetings-tile.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

## Flow Log

Ideal 2 actions; with S5 stopped only live MCP answers work. The mockup shows the connected tile only.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-MX-6-01 | fixed | Plan states the stopped-S5 outcome (live MCP only, no synced status, PR lists removed tools). The mockup draws no sync claim for Flow. |
| F2-MX-6-02 | still-open | Flow and Granola tiles still show the identical subtitle 'Meeting notes' and 'Connected' badge although only one has a sync status. Low. |

## New findings (round 3)

None.
