# STORY-076 flow critique: month-end handoff across computer, artifact, page, list and routine

Target: the planned native SwiftUI iPhone app (epic #427, phases P7 #419 and P8 #420). No code exists, so this judges the catalog story against the design boards.

Evidence read: `docs/ios-native/ux/catalog.md` (STORY-076), `docs/design-system/ios/README.md`, and these board screenshots: PG-A-Computer, PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine, PG-A-Rules. The screenshots show the outer display (466x678) only. The laptop pose that the story uses (626x890) is described in PG-A-Rules text, but no board draws it. I did not open boards live.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Steps as designed vs Ideal path | 22 vs 22. The Ideal path is the same list, so it measures nothing. Against the simpler version in section 3 it is 22 vs 14. |
| Steps that change nothing on screen (reads and checks) | 6 (steps 10, 14, 19, 20, 22 and the read in step 9). These are the user's job, not friction. |
| Optional steps inside the happy path | 3: step 7 (thank-you message), step 11 (compare v5), step 15 (ask a question). They are alternates and should not count toward the ideal. |
| Forced extra steps | 4: step 6 (second confirm after Release), step 8 (Close), and steps 12 plus 18 (Back to thread, then Home, to reach the routine). |
| Needless decisions | 1: after Release the user must answer "Skip / I'm done". The user just finished the task, so "I'm done" is the answer nearly every time. |
| Re-entry of known data | None. No typing is required to finish the journey. |
| Dead ends | Routine (step 21 to 22): the last screen opens the routine's thread, and the story ends by locking the phone. The routine does not say which run the conversation belongs to (catalog gap, see STORY-075). Computer: leaving while holding control has no rule (catalog gap). |
| Screens with no board | Handoff prompt "Skip / I'm done" (named in the PG-A-Rules Computer card, not drawn). The pre-control Computer state with "Take control" (PG-A-Computer shows only the "You have control" state). The thread composer on the bottom half of the Computer laptop pose. Every laptop-pose screen. Transitions between a laptop-pose screen and Routine or Artifacts (the catalog marks them NO BOARD). The Thread and Home screens that steps 1, 8, 12 and 18 pass through are not in this story's Design source; I did not judge them. |
| Same data on several screens | Runway figures and the "Cash fell in the last 30 days, mostly from two vendor payments" sentence appear on the Artifact (PG-A-Artifact) and the Agent page (PG-A-AgentPage). The routine's prompt also names them. The catalog lists four screens with no deep link between them. |

## 2. Take-away pass per screen

**Computer (PG-A-Computer).** Visible: side strip with Close, keyboard and fit buttons, Release at the bottom; Team/Private picker; "You have control" pill; the remote screen; a seven-key bar (Esc, Tab, Ctrl, four arrows).
- Removable while the user holds control: the Team/Private picker. Switching the machine mid-control is rare and risks losing the lease. Show it only before taking control.
- Removable: "You have control" pill if the key bar and the Release button already change state. Keep it only if the key bar is hidden at times. This is a judgment call, not a defect.
- One prominent action: Release (ink fill, bottom left). Correct for this state. The board does not show the state before control, where "Take control" must be the prominent action (PG-A-Rules says so).
- Fact stated twice: control state appears in the pill and in the Release button. Minor.

**Artifact (PG-A-Artifact).** Visible: title capsule "Runway summary"; card titled "Runway summary" with "Updated today by Finance agent"; Cash and Runway tiles; sentence; two vendor rows; version pill "v5 of 5"; Back, Share, Versions, More.
- Fact stated twice: the title appears in the capsule and again as the card heading. Drop the card heading or the capsule text.
- Removable: the Versions button in the side strip, because the bottom version pill already steps through versions. The two controls do the same job.
- Prominent action: PG-A-Rules says Share is the prominent action, but the board draws Share in a plain capsule with no tint or fill, so nothing is dominant. Fix the board or the rule. For a verification journey the real next action is "go on", not Share; None may be the right answer (the Artifacts rule card already says "None" for the list).
- The board shows "v5 of 5" while the story says v6. The board should match the story's data.

**Agent page (PG-A-AgentPage).** Visible: "Finance agent" capsule; title; three tiles (Cash, Burn, Runway); chart; paragraph; two bullets; Back and checklist buttons; Open chat button.
- Fact stated twice: the paragraph says "the runway is [N] mo", which the Runway tile already shows. Remove that clause.
- The paragraph "Cash fell in the last 30 days, mostly from two vendor payments" repeats the Artifact card. It is the same document content on two screens, not a drawing flaw.
- Prominent action: Open chat (ink circle, bottom left). Matches PG-A-Rules. Right for asking a question (step 15). The next step in this story is List, which is a small glass button; that is acceptable because it is a sibling switch.
- The board shows the Runway tile touching the right margin with the third tile narrower than the others. Tile widths are not equal.

**Agent list (PG-A-AgentList).** Visible: "Close checklist" capsule; five rows; "Add item" field with ink plus button; Back, Page and chat buttons; More.
- Nothing removable that a step uses. The "Add item" field is permanent; the rule card says to keep it, since adding is the list's one prominent action.
- Prominent action: Add item. This does not match the story's goal (tick two rows), but ticking is a row tap, not a button, so one dominant control is still right.
- One tap from Page: the side strip has Page and Chat icons, so steps 13 to 16 need no trip through the thread. Good.

**Routine (PG-A-Routine).** Visible: "Weekly runway summary" capsule; schedule card (cadence, "Finance agent - Last ran today, 8:00 AM", "Next run Mon, Oct 26"); PROMPT label and card; Back; Open conversation button.
- Fact stated twice: the capsule names the routine and the card says "Every Monday at 8:00 AM". These are different facts, so nothing to remove.
- The PROMPT label above a card is the only label; the card is self-explanatory, but the label separates it from the schedule card. Keep.
- Prominent action: Open conversation. It matches PG-A-Rules, but the journey's purpose is to confirm schedule and leave, so the screen is correctly passive; the button is acceptable.
- The prompt card repeats "Update the Runway summary page", which is the only link from the routine to the page, and it is plain text, not a link (catalog gap).

## 3. Simpler version

Goal: keep the same five screens and the same user control, remove forced steps and add the missing links.

1. Home: tap the Finance agent "needs you" item. Thread opens.
2. Tap the computer block. Computer opens.
3. Tap "Take control".
4. Tap the portal's Download button.
5. Tap "I'm done". While a handoff request is pending, the Release button is labeled "I'm done" and releases control in the same tap. A "Skip" action stays as a secondary text button for the other answer. The Computer screen then closes to the thread. (Removes old steps 5, 6 and 8: the extra confirm and Close.)
6. Tap the "Runway summary v6" chip in the thread. Artifact opens.
7. Read the preview. (Versions stay available from the version pill; comparing v5 is an optional alternate.)
8. Back to the thread.
9. Tap "Page". Agent page opens.
10. Read the three tiles.
11. Tap the checklist icon in the side strip. "Close checklist" opens directly. (This already exists on PG-A-AgentPage.)
12. Tick the two rows.
13. Tap More on the list and choose "Routines" (new control, no board) so the routine opens without going Back to the thread and Home. If no routine menu is added, the old Home route stays and the count is 15.
14. Read "Every Monday at 8:00 AM" and "Next run Mon, Oct 26". Done. The prompt card read (old step 20) is not needed to confirm timing.

Result: 14 steps, 22 to 14. Removed: the Skip/I'm done double step, Close, the Back-then-Home detour (replaced by one menu), the optional message, version compare, question, and prompt-card read. Nothing needed to finish the task is hidden, and the user keeps control of release and ticking.

Smaller changes on screens:
- Artifact: remove the card heading that repeats the capsule title; remove the side-strip Versions button or the bottom version pill; fix the board to show v6.
- Agent page: delete "At the current burn the runway is [N] mo." from the paragraph.
- Computer: hide the Team/Private picker while holding control.

## 4. Beauty check against the iOS design rules

- **Computer (PG-A-Computer).** Glass only on the floating layer: side-strip buttons, the Team/Private capsule, the status pill and the key bar. The remote screen and the individual keys are solid. One prominent action: Release, ink fill. Glass groups: side strip has two capsules, the top has two capsules, the key bar is a third group beside the side strip, so the count is at the limit of three per region. The Team/Private picker and the pill sit at slightly different left insets (about 86 px) than the other boards (about 76 to 80 px).
- **Artifact (PG-A-Artifact).** Content card is a solid fill; glass is only the capsule, strip and version pill. Corners look concentric. Fails the one tinted prominent action rule: Share has no tint or fill, so the board does not show a prominent action although PG-A-Rules says there is one.
- **Agent page (PG-A-AgentPage).** Tiles, chart and text are content on the page background; glass is the strip, capsule and chat button. One ink prominent action (Open chat). The orange chart line is the agent's identity color, consistent with the rules. Tile widths are uneven (the Runway tile is narrower).
- **Agent list (PG-A-AgentList).** Rows are plain with dividers and muted, struck-through done items; the Add item field is a floating glass pill with an ink plus. Matches the rule card. Spacing is consistent with the page board (about 80 px left inset).
- **Routine (PG-A-Routine).** Two solid cards, glass limited to the capsule, back button and chat button. One ink action. Clean.
- Type and spacing: titles use the same 28 pt style on Page, glass-capsule titles on the others, as the rules prescribe. Left insets differ by up to about 10 px between boards (Computer 86, Artifact 76, others 80); these are pixel readings of the screenshots and should be measured in the canvas before treating as defects.

## 5. Verdict: convoluted

Each screen on its own is close to minimal; the problems are in the transitions. Under the calibration table the journey has 3+ forced extra steps (the second release confirm, Close, and the Back-then-Home route to the routine), a forced detour to reach the routine, and the same Runway content on the artifact and the page. A fix of one menu entry and one merged release control cuts the journey from 22 to 14 steps. Steps without a board (handoff prompt, pre-control Computer, every laptop-pose screen, laptop-to-full-height transitions) are findings for P8 (#420), not a reason to change the verdict.
