# STORY-MX-1: Ask one agent across Granola and Flow meetings (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 1: one Granola agent and one Wispr Flow agent (two rows, not three). Step 3: provider is shown only as the chip's hover title (plan Reading).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Sidebar lists 'Wispr Flow agent' and 'Granola agent'. w-d-flow-meetings-tile.png
- 2-3 Ask the Wispr Flow agent: 'Searched meetings' chip, two answers with chips 'Security sync, 14 Oct' (title Wispr Flow) and 'Vendor call, 16 Oct' (title Granola), both 32 px tall. w-d-flow-meetings-agent.png
- 4 'Only calls recorded in Flow' is a phrase, not a control (plan). No UI to walk.
- Granola agent frame: chips carry no title attribute. g-d-agent-answer.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: chips wrap with the text and stay 32 px tall, no overflow. w-m-flow-meetings-agent.png

## Flow Log

Ideal 3 actions: open an agent, ask once, read a cited answer. Actual 3. Both agents answer all meetings (plan: an agent name is not a scope); the mockup shows a Flow agent citing a Granola meeting.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-MX-1-01 | still-open | Flow chips now carry title attributes (Wispr Flow / Granola); touch users still cannot hover, and the Granola mockup's chips have no title (see new finding). |
| F2-MX-1-02 | still-open | Two agents with vendor-sounding names that both answer everything; nothing in the UI says so. Plan accepts ('agent name is not a scope'). Low. |

## New findings (round 3)

- **F3-MX-1-01** (low, mockup): Granola mockup citation chips have no title attribute, while the Flow mockup chips do. The plan says every meeting-source agent sees all meetings, so the Granola agent can cite a Flow call and its chip needs the provider title too. Fix: Add title="Granola" / title="Wispr Flow" to the chips in docs/granola/mockup.html agent and citation frames.
