# STORY-GS-6: The agent is removed and recreated (round 4)

**Result: PASS**

Walked: Granola mockup, api-key screen "Agent removed" (now drawn; the catalog still says not mocked). Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Story is no longer "not mocked": the plan and mockup draw "Create agent". Step 2 (message_bot finds no agent) has no UI by design.

## Steps

- Step 3-4: Agent removed frame: status stays "Synced 42 meetings", the agent link is replaced by a "Create agent" button, and the sidebar BOTS list has no Granola agent. (g-d-api-key-noagent.png)
- Step 5-6: No frame draws the "Creating agent" label or the navigation to the new agent; the connected frame shows the end state with the agent restored. (g-d-api-key-connected.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-api-key-noagent.png: no overflow.

## Flow Log

Actual 2 steps (open page, Create agent) matches ideal 2. The in-progress label is plan text only; acceptable.

## Round-3 findings

The round-3 findings file for this story had no findings.

## New findings (round 4)

None.
