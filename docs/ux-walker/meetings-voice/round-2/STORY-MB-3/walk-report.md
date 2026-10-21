# STORY-MB-3: Meeting-only user opens Inbox on the phone (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. Inbox with To do group above "Connect mail" (screenshots/steps-syncing-empty-todos.png). The old step 1-2 (only Connect mail) is outdated: FX-14.
2. Syncing, Empty ("No follow-ups from meetings yet"), With to-dos (3 rows plus "2 more").
3. Ticking: tapping the row text removed the row at once (3 to 2 rows); no strike-through, no undo.
4. Consent off on mobile and the tap-to-see-source are not drawn (plan says no tap action).

## Geometry
Run on docs/granola/mockup.html#screen-mobile with the phone frame measured directly (390 x 780 pt frame). Rows 44-63 pt, body 17 px, section header/footer 13 px, large title 34 px, glass back 40 pt. No overflow or spill.

## Native iOS check (mobile frame)
Grouped list, 17 pt titles, 15 px secondary, 24 pt circles inside rows of 62-85 pt, centered "2 more" link, chevron on Connect mail: native. No swipe action or undo toast drawn.

## Flow log
2 steps to the list and 1 to complete, equals ideal. Hesitation: Connect mail remains below even for a meeting-only user.

## Round-1 findings
- F-MB-3-1 (high): **fixed**. To do sits above Connect mail; plan S5 specifies the mobile gate (inbox.tsx:102, :458, !list.enabled).
- F-MB-3-2 (medium): **fixed**. Comment corrected, TodoCard is reused.
- F-MB-3-3 (medium): **fixed**. Row leaves at once as the code does. Undo still absent (N1).
- F-MB-3-4 (low): **fixed**. Whole row is the target; rows are 62-85 pt.
- F-MB-3-5 (low): **obsolete**. Plan decision: source line is not tappable.
- F-MB-3-6 (low): **still-open**. Due dates Fri / Today (amber) / none still have no stated rule.

## New findings
- F2-MB-3-1 [plan, medium] Plan says a meeting row "has no tap action, only the checkbox acts", but the mockup completes the to-do when tapping anywhere on the row (verified). With no undo, an accidental tap on a row (scrolling, reading) completes it.
- F2-MB-3-2 [plan, low] Consent-off state is not drawn on mobile; plan defers the component choice to S5.
