# STORY-MX-5: Flow summary-only meetings (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 3: plan says 'no transcript' is literal tool output, not UI copy (wispr-flow.md S5; granola.md Reading). The summary-only case has no UI by plan.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1-2 Ask the Flow agent: answers cite chips. w-d-flow-meetings-agent.png
- Citation popover for a Flow meeting: attendees ('Priya Natarajan, you') and a red 'Delete' only, no 'Open in' link. w-d-flow-meetings-cite.png
- Delete confirmation for a Flow meeting. w-d-flow-meetings-confirm.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: popover not visible (F3-MX-5-01). w-m-flow-meetings-cite.png

## Flow Log

Ideal 2 actions: ask, read answer. Actual 2. Whether a given meeting had a transcript is told in the agent's text only.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-MX-5-01 | still-open | A to-do from a summary-only meeting looks like any other; plan adds no UI. Low. |
| F2-MX-5-02 | fixed | Flow citation popover (Delete only, no link) is drawn (w-d-flow-meetings-cite.png). |

## New findings (round 3)

- **F3-MX-5-01** (low, mockup): At 390 px the Flow citation popover is not visible (same clipping as the Granola popover), so the Flow Delete entry point cannot be seen at phone width. Fix: Position the popover inside the frame at narrow widths.
