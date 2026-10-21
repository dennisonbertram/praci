# STORY-MB-3: Meeting-only user opens the Inbox on the phone

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/granola/mockup.html#screen-mobile (Inbox frame: Syncing, Empty, With to-dos)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- Step 5 (ask the Granola agent in chat): not mocked; chat is existing UI.
- Edge case on the mockup comment about a missing mobile to-do component is a story note, not a mockup issue.

## Steps

- Step 1 [pass]: Inbox: large title, a "To do" group with three rows and a "2 more" row, then a "Connect mail" row with a chevron below (step-todos.png).
- Step 2 [pass]: Rows show title, "Pricing review, 12 Oct" style detail, and a trailing due label (Fri grey, Today amber).
- Step 3 [pass]: Tapping the 44x44 circle removes the row at once (decided RX-14, no undo); I ticked all five (the "2 more" row reveals the last two): the group then reads "No follow-ups from meetings yet" (step-allticked.png). TX-12 applied.
- Step 4 [pass]: No account picker is drawn, so there is nothing to switch.
- Step 5 [note]: agent chat not mocked.
- Syncing [pass]: "Syncing" with an activity indicator in the To do group (step-syncing.png). Empty [pass] (step-empty.png).

## Geometry audit
geometry-audit.js per state at 1280x900 and 390x844: pageOverflowX 0, no overflow spills. Flagged wrappedControls are the 44 pt glass back glyph and the one-word Connect action (tall native button, not a wrapped label). Measured on the phone: back 44x44, action button 48 pt, rows 52 to 63 pt, check/to-do hit areas 44x44, subtitle and footer 13 to 14 px.

## 390x844 spot-check
390x844: Inbox fits in the frame, rows wrap, no horizontal scroll (mobile-check-390.png, taken in the Typing state of the paired frame).

## Flow Log
Ideal 2 (open Inbox, tap the checkbox). Actual 2. Native check: grouped rows, 44 pt hit areas, trailing date, chevron row for the next action all follow the Reminders/Settings pattern.

## Round-3 findings
- F3-MB-3-1 (low): obsolete. Undo for a tick is rejected as decided (RX-14); a tick is reversible through the agent.
- F-MB-3-6 (low): still-open. No stated rule for when a date shows or turns amber. Unchanged, low.
- F2-MB-3-2 (low): still-open. The consent-off state is still not drawn on the Inbox frame (only the Integrations row has it). Plan: stored to-dos stay visible (TX-6). Low.

## New findings
- None.
