# STORY-GS-6: The agent is removed and recreated (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 1-2 are backend (plan, Agent provisioning). The mobile has no repair surface by plan decision (Surfaces, Mobile).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Connected card, agent present: status, Disconnect, 'Granola agent' link. g-d-api-key-connected.png
- 4-5 Agent removed frame: status '● Synced 42 meetings', Disconnect and a 'Create agent' button in place of the agent link; sidebar has no bots. g-d-api-key-noagent.png
- 6 The agent frame returns the answer from stored meetings. g-d-agent-answer.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

## Flow Log

Ideal 2 actions: open the page, press Create agent. Actual 2. The sync line stays green while the agent is missing, which the plan defines (sync does not depend on an agent).

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-GS-6-01 | fixed | 'Agent removed' state drawn with 'Create agent' (g-d-api-key-noagent.png). |

## New findings (round 3)

None.
