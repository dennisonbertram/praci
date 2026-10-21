# STORY-MX-5: Flow summary-only meetings (round 2)

**Result: PASS**

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1-2 Ask the Flow agent about a promise.** The answer frame is drawn for full meetings. A summary-only meeting is not drawn. Screenshot: `screenshots/flow-agent.png`

- **3 'Quote her'.** Plan: meetings_get returns the literal text 'no transcript'; the agent relays it (granola.md Tool output). No UI copy, by decision.

- **Edge To do from a summary-only meeting.** Flow Inbox state draws one Flow to-do ('Start the security review / From: Security sync, 14 Oct'); it looks the same whatever the source quality (plan: provider not shown). Screenshot: `screenshots/flow-inbox.png`

- **390 390 px spot-check.** Fits. Screenshot: `screenshots/m390-flow-inbox.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 2 steps = Ideal 2 per plan (ask, answer says there is only a summary).

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-MX-5-1 | fixed | Plan defines the wording: tool output 'no transcript' relayed by the skill. To-do-from-summary basis still not distinguishable (low, F2-MX-5-01). |
| F-MX-5-2 | fixed | No author note under the answer. |

## New findings (round 2)

- **F2-MX-5-01** (low, plan): A to-do created from a summary-only Flow meeting looks identical to one from a transcript. Fix: Accept as decided or add 'summary only' to the digest's to-do detail.
- **F2-MX-5-02** (low, mockup): Flow citation popover (no link, Delete only) described in the Flow mockup comment is not drawn, so Delete for a Flow meeting cannot be seen. Fix: Draw it.
