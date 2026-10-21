# Walk report: STORY-IF-1

Result: FAIL
Session: uxw-granola. Mockups opened via file:// in dark mode at 1280x900 (desktop) and 390x844 (spot-check).
Findings by severity: {'high': 1, 'medium': 4, 'low': 1}. By kind: plan 4, mockup 2.

## Steps

1. Inbox opens (step-1-empty.png): the mockup shows the To do card only; the real 'No mail connected' empty state is not drawn (F-1). Geometry: clean.
2. 'No mail connected / Connect mail': not drawn (F-1).
3. Meeting items (step-3-todos.png): To do card with three items, 'From: {meeting}, {date}', due labels (Fri, Today in warning colour). Matches the plan's To do card. No sender line (F-2). Geometry: clean.
4. No link from the 'From:' line: matches the plan; no surface for opening the meeting (F-2).
5. Tick: checkbox fills, strike-through, no fade (F-5; screenshots are in STORY-GS-1/screenshots/step-10.png equivalent).
6. Reload persistence: not drawn (F-4).
Mobile 390x844 spot-check (mobile-390-todos.png): card fits, no overflow, no '{n} more' (F-4). Pass on layout.
Geometry results: Geometry audit: pageOverflowX 0, no overflow spills, no wrapped controls; only unevenRows hit is the mockup's own state-pill switcher (not product UI).
Flow Log: actual 3 steps in the mockup (open, read, tick) vs ideal 3; in the plan the real path has 4-5 because of the 'No mail connected' page above the card (F-1). Hesitation at step 3 (reads 'Connect Gmail' prompt). Duplicated information: none on this surface; 'what I promised' also appears in the agent answer without a checkbox.

## Findings

- F-IF-1-01 [high, plan, JF-1] Steps 2-4: journey breaks, the mockup draws only the To do card; today's Inbox for a user with no mail account is the 'No mail connected / Connect mail' page, and the plan does not say where the card sits relative to it. Maya's actual first view is not drawn.
- F-IF-1-02 [medium, plan, JF-21] Step 4: the 'From: Pricing review, 12 Oct' line is plain text with no sender and no link; Maya cannot open the source meeting. The mockup draws the same plain line.
- F-IF-1-03 [medium, plan, JF-22] Nothing signals new meeting to-dos: sidebar Inbox badge counts mail only, and the mockup sidebar shows no count.
- F-IF-1-04 [medium, plan, NEW] Step 6 (reload, ticked item stays gone) and the phone-width '{n} more' collapse are not drawn; the 390 px spot-check shows all three items expanded with no '{n} more' button.
- F-IF-1-05 [low, mockup] Ticking a to-do strikes it through but never fades the row out, although the note beneath says it fades out of the list; step 5 of the story (row leaves after about 1.5 s) cannot be seen.
- F-IF-1-06 [medium, mockup] Checkbox is 16x16 px, below the 32 px minimum; on the 390 px spot-check it is the only tap target for the row.
