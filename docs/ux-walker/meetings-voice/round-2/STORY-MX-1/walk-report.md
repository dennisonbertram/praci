# STORY-MX-1: Ask one agent across Granola and Flow meetings (round 2)

**Result: PASS**

Outdated or changed by the plan: Step 1: there is one Granola agent (D2), so the sidebar lists 'Wispr Flow agent' and 'Granola agent'; either answers any meeting question (plan S5 Flow).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Pick an agent from the bot list.** Sidebar lists 'Wispr Flow agent' and 'Granola agent' (BOTS). Both read all meetings per plan; the names still suggest a vendor scope. Screenshot: `screenshots/flow-agent.png`

- **2-3 Ask, read cited answer.** 'Which meetings covered the security review?' gives two sentences, each with a chip: 'Security sync, 14 Oct' (a Flow meeting) and 'Vendor call, 16 Oct' (a Granola meeting). The chips do not show the provider. Screenshot: `screenshots/flow-agent.png`

- **4-5 Provider filter, same-call comparison.** Plan: skill has one sentence each for the provider filter, comparing providers in one call and the 90-day window (granola.md Tool output). No UI.

- **390 390 px spot-check.** Chips wrap with the text; no overflow. Screenshot: `screenshots/m390-flow-agent.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 3 steps = Ideal 3 (open agent, ask, read). Hesitation: which of two agents to open; mitigated by plan text 'an agent name is not a scope'. Provider is only a hover title per plan, but the mockup carries no title attribute.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-MX-1-1 | obsolete | Plan decision: provider is shown only as the chip's hover title (granola.md Tool output). Residual drawn gap in F2-MX-1-01. |
| F-MX-1-2 | still-open | Two agents still appear in the sidebar. Plan says either answers; no UI says so. Low, see F2-MX-1-02. |
| F-MX-1-3 | fixed | Plan now specifies the chat sentences for provider filter, comparison and window. |
| F-MX-1-4 | fixed | No author notes are visible in the Granola or Flow agent frames. |

## New findings (round 2)

- **F2-MX-1-01** (low, mockup): The Flow mockup comment says the provider is the chip's hover title, but the chips have no title attribute; touch users cannot hover at all. The chip popover for a Flow meeting (no 'Open in' row, Delete only) is described in a comment and not drawn. Fix: Add title attributes and draw the Flow popover state.
- **F2-MX-1-02** (low, plan): The sidebar lists two agents whose names suggest a vendor each, but both answer all meetings. Nothing in the UI says so; the user may pick the 'wrong' one or distrust an answer that mixes providers. Fix: Optional: record that the agent description (existing agent card) says 'Answers from all your meetings'. No new chrome unless wanted.
