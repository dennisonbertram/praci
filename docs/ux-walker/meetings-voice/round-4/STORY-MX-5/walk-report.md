# STORY-MX-5: Flow summary-only meetings (round 4)

**Result: PASS**

Walked: Flow mockup flow-meetings (Agent answer, Citation, Delete, Inbox). Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: The summary-only case is not drawn; the plan says it is tool output ("no transcript"), with no UI copy. Steps 1-3 are therefore plan-only.

## Steps

- Step 1-2: Agent answer frame with Flow citations. (w-d-flow-meetings-agent.png)
- Step extra: Flow citation popover: attendees and Delete, no source link row. Delete confirmation frame. (w-d-flow-meetings-cite.png, w-d-flow-meetings-confirm.png)
- Step extra: Inbox frame for Flow-derived to-dos. (w-d-flow-meetings-inbox.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** w-m-flow-meetings-cite.png: bottom sheet, Delete 44 px; it covers the rest of the answer, as a sheet should.

## Flow Log

Actual 1-2 steps; the "no transcript" reply is text only.

## Round-3 findings

| Round-3 id | Status | Evidence |
|---|---|---|
| F3-MX-5-01 | fixed | At 390 px the Flow popover is now a bottom sheet within the frame (w-m-flow-meetings-cite.png). |

## New findings (round 4)

- F4-MX-5-01 (low, mockup): The citation popover repeats the title and date in bold ("Pricing review, 12 Oct" in the Granola popover, "Security sync, 14 Oct" in the Flow popover). The plan says the popover shows attendees, the source link and Delete, and that "title and date repeat the chip and are not shown again". Same defect as F4-GS-7-01.
