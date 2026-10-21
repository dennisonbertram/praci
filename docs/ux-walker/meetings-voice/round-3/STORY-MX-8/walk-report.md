# STORY-MX-8: Mixed-source meeting-only user: first week (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 4: plan puts the To do card above 'Connect mail' for a meeting-only user. Step 5 detail is '{title}, {date}', no provider (plan Deliberate choices). Step 2: Flow shows as a provider row/agent, no sync status.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Granola key connected: 'Synced 42 meetings'. g-d-api-key-connected.png
- 2 Flow tile connected next to Granola; sidebar has two agents. w-d-flow-meetings-tile.png
- 3 Ask an agent: cited answer. w-d-flow-meetings-agent.png
- 4-5 Flow Inbox frame: To do card with a Flow-sourced and a Granola-sourced to-do ('Security sync, 14 Oct', 'Pricing review, 12 Oct') then 'Connect Gmail...' with 'Connect mail'. w-d-flow-meetings-inbox.png
- 6 Tick: same checkbox behaviour as IF-1.

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: Inbox frame fits. w-m-flow-meetings-inbox.png

## Flow Log

Ideal 6 steps, actual 6. The to-dos do not show their provider, by plan.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-MX-8-01 | fixed | Flow Inbox frame now shows the To do card above 'Connect Gmail...' and 'Connect mail', like the Granola frames (w-d-flow-meetings-inbox.png). |

## New findings (round 3)

None.
