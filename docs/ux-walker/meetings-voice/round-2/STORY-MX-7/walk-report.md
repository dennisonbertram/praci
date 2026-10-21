# STORY-MX-7: A transcript tries to take over the agent, seen from Hannah's side (round 2)

**Result: PASS**

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1-2 Ask for the vendor call summary.** 'Summarise my vendor call from Friday', tool chips 'Searched meetings' and 'Read Vendor call, 16 Oct', a plain summary with chip 'Vendor call, 16 Oct'. No warning UI by plan decision; the injected line is not drawn. Screenshot: `screenshots/agent-inject.png`

- **3 Reply follows the injected line.** Plan: skill quotes instruction-like text as what a speaker said; run has no write, fetch or send tools (S4 allowlist).

- **4-6 Injected to-do.** To-do rows are plain text with no link and no path to the meeting; plan decision. Regression test for 'wire $5,000' is in S5. Screenshot: `screenshots/inbox-todos.png`

- **390 390 px spot-check.** Agent frame with the vendor run fits at 390 px (bottom of image). Screenshot: `screenshots/m390-key-rejected.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 2 steps = Ideal 2. Residual risk (model answers in words that follow the injected line) is accepted by the plan: 'answers cite the meeting, and a human reads them'.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-MX-7-1 | obsolete | Plan decides 'no warning UI' and adds the skill sentence about quoting instruction-like text. |
| F-MX-7-2 | obsolete | Plan decides plain-text to-dos with no meeting link; S5 has a regression test for an instruction-like commitment. |
| F-MX-7-3 | fixed | Sample injection string is no longer rendered (agent-inject.png). |

## New findings (round 2)

None.
