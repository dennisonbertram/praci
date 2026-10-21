# Walk report: STORY-MB-3

Verdict: FAIL (static iPhone-frame mockup, judged against native iOS conventions; 390px spot-check not applicable).

Findings: 6 total. Severity {'high': 1, 'medium': 2, 'low': 3}. Kind {'plan': 2, 'mockup': 4}.

## Steps

### Step 1
Inbox, Empty state: large title Inbox, 'TO DO' header, one row 'No follow-ups from meetings yet' in muted text. Geometry audit: clean. No Connect mail control, no consent card, no pile picker, no tab bar. Row copy is clear.
Screenshot: screenshots/step-1.png

### Step 2
With to-dos: three rows with 24 px circles, title, 'From: meeting, date' subtitle and a trailing due label (Fri, Today in amber, none). Tapped the first circle: it fills with a check and the title is struck through but the row stays in the list. Rows 62-85 px tall, text wraps cleanly at two lines.
Screenshot: screenshots/step-2.png

## Flow Log

Ideal 2 steps (open Inbox, tap checkbox). Mockup matches the ideal: 2 steps. The mockup omits what the real screen does for a meeting-only user: the story shows 'Connect mail' as the only control. Duplicated info: none. Hesitation: the amber 'Today' and gray 'Fri' labels have no stated rule; the third row has no label.

## Findings

- F-MB-3-1 [high, plan, JF-1] Mockup shows the To do list alone; the real mobile Inbox returns early and shows only Connect mail when there are no accounts, and clears to-dos when enabled is false. The plan has no layout for where the list sits relative to Connect mail or consent.
- F-MB-3-2 [medium, mockup, JF-31] PLAN-GAP comment says the mobile Inbox has no to-do component; TodoCard exists in the mobile app.
- F-MB-3-3 [medium, mockup, NEW] Ticked row stays with strikethrough; the story says the mobile row leaves at once (optimistic). No undo drawn.
- F-MB-3-4 [low, mockup, NEW] Visible checkbox circle is 24 px; row is 62-85 px so the whole row can be the target, but the mockup only makes the circle pressable.
- F-MB-3-5 [low, plan, JF-21] Tapping a to-do title to see its meeting does nothing; source shown only as text.
- F-MB-3-6 [low, mockup, NEW] 'Fri' gray, 'Today' amber, third row none; no rule given for when a date appears or turns amber.
