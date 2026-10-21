# STORY-MX-1: Ask one agent across Granola and Flow meetings (round 4)

**Result: PASS**

Walked: Granola mockup agent and Flow mockup flow-meetings (Agent answer). Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Provider is shown only as the chip hover title (plan, Reading), so steps 3 and 5 are decided.

## Steps

- Step 1: Sidebar BOTS lists "Wispr Flow agent" and "Granola agent". (w-d-flow-meetings-agent.png)
- Step 2-3: Flow agent answer cites two meetings, each with a chip: "Security sync, 14 Oct" (title Wispr Flow) and "Vendor call, 16 Oct" (title Granola). (w-d-flow-meetings-agent.png)
- Step 3: Granola agent answer with one chip titled Granola. (g-d-agent-answer.png)
- Step 4-5: Provider filter and duplicate comparison are chat phrases; no UI. (-)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** w-m-flow-meetings-agent.png: no overflow.

## Flow Log

Actual 2 steps (open an agent, ask) matches ideal 3.

## Round-3 findings

| Round-3 id | Status | Evidence |
|---|---|---|
| F3-MX-1-01 | fixed | All Granola mockup chips now carry title="Granola" (checked in the HTML and in the agent and citation frames). |

## New findings (round 4)

None.
