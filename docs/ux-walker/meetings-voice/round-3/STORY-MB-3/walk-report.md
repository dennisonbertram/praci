# STORY-MB-3: Meeting-only user opens the Inbox on the phone

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/granola/mockup.html#screen-mobile, second phone (Inbox: Syncing, Empty, With to-dos)

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- Steps 1 to 5 describe today's code (zero accounts shows only "Connect mail"). The plan (granola.md S5) puts the To do group above the "Connect mail" row with no consent prompt; that is what was walked.
- The catalog note that the mockup says there is no to-do component is outdated; the mockup comment now says TodoCard exists.

## Steps

- Step 1 [pass]: Inbox opens with a "To do" group above a "Connect mail" row; three to-dos plus "2 more" (inbox-todos.png).
- Step 2 [pass]: Row text and date taps do nothing (3 rows before and after); only the 44x44 checkbox acts.
- Step 3 [pass]: Ticking a row removes it at once (inbox-after-tick.png).
- Step 4 [pass]: Empty: "No follow-ups from meetings yet" (inbox-empty.png). Syncing state shows a spinner row (inbox-syncing.png).
- Step 5 [pass]: "2 more" expands the extra two rows.

## Geometry audit
Phone measurements: to-do rows 62 to 85 pt (two-line titles), checkbox hit areas 44x44, secondary text 14 pt (about 5:1), amber "Today" rgb(217,164,65) on rgb(28,28,30). No overflow.

## 390x844 spot-check
Fits 390x844 with no horizontal scroll (same frame width).

## Flow Log
Ideal 2 (open Inbox, tick). Actual 2. The list is already there. Hesitation: the "Connect mail" row stays under the list for a user who does not want mail (plan decision).

## Round-2 findings
- F-MB-3-1 (high): fixed. To do group is drawn above Connect mail (inbox-todos.png).
- F-MB-3-2 (medium): fixed. Layout drawn.
- F-MB-3-3 (medium): fixed. Empty state wording drawn.
- F-MB-3-4 (low): fixed. Detail line has no "From:" prefix.
- F-MB-3-5 (low): obsolete. Superseded by the plan layout.
- F-MB-3-6 (low): still-open. Date labels: "Fri" grey, "Today" amber, third row none; no rule for when a date shows or turns amber is stated in the plan.
- F2-MB-3-1 (medium): fixed. Verified in the browser: clicking the row text or the date leaves all 3 rows; only the checkbox removes one (matches the plan: only the checkbox acts).
- F2-MB-3-2 (low): still-open. The consent-off state is not drawn on the Inbox phone frame; only the Integrations "AI data sharing off" row exists.

## New findings
- F3-MB-3-1 (low, plan): Ticking a to-do removes the row immediately with no undo and no brief completed state. iOS Reminders-style lists show the check first and offer undo; an accidental tap on the 44 pt circle loses the row from view. Fix: Optional: keep the checked circle for about a second before removing, or add shake-to-undo. Not required for the plan.
