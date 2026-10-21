# STORY-MX-7: A transcript tries to take over the agent, seen from Hannah's side (round 3)

**Result: PASS**

Outdated or changed by the plan: Plan: no warning UI; the protection is the S4 tool allowlist and the skill quoting instruction-like text (Reading).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1-2 Ask for the vendor call summary: chips 'Searched meetings' and 'Read Vendor call, 16 Oct', a plain summary with chip 'Vendor call, 16 Oct'. The injected line is not drawn and no flag is shown (by plan). g-d-agent-inject.png
- 4-6 To-do rows are plain text, no links and no path to the meeting. g-d-inbox-todos.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: the agent frame fits. g-m-agent-inject.png

## Flow Log

Ideal 2 actions: ask, read a normal summary. Actual 2. No hesitation in the drawn path.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| none | | |

## New findings (round 3)

None.
