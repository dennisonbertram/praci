# STORY-GS-2: Invalid key on a Business plan (round 4)

**Result: PASS**

Walked: Granola mockup, api-key screen, 1280x900 and 390x844. Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: None.

## Steps

- Step 1: Entering state: the field is masked dots (password type, autocomplete off, verified by script). (g-d-api-key-entering.png)
- Step 2: Connecting: button reads "Connecting…" and is disabled. (g-d-api-key-verifying.png)
- Step 3-4: Key rejected: red border and one line "Granola rejected this key"; key link still beside the label; Connect dimmed; no connection or agent in the sidebar. (g-d-api-key-rejected.png)
- Step 5: Live: editing the field clears the red border, aria-invalid and the error line together and Connect becomes enabled. (g-d-api-key-rejected.png)
- Step extra: Offline state shows the separate "Could not reach Granola" line. (g-d-api-key-offline.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-api-key-rejected.png: reflows to one column, no overflow.

## Flow Log

Actual 3 steps (paste, Connect, read the line) matches the ideal. The one line covers every cause by plan decision.

## Round-3 findings

The round-3 findings file for this story had no findings.

## New findings (round 4)

None.
