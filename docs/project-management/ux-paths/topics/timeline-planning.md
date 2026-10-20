# Timeline planning: user journeys

> Walked against the mockup before the fixes in this change; findings are kept as the record of what was fixed. See the Status column in the consolidated findings of catalog.md.

Scope: the Timeline view of the Projects mockup (`mockup.html`). Every story was walked in headless Chromium (Playwright) at 1360x860, story 09 also at 390 wide. Console errors across all walks: none. Screenshots are in a local scratch folder (not committed) (`a-default.png`, `b-drag-preview.png`, `b-after.png`, `g-norel.png`, `h-conflict.png`, `i-unsched.png`, `j-filter.png`, `l-mobile.png`).

Mockup facts used below (seed, "today" is Oct 16): one day is 14px; bars drag in whole days; the toast is the only confirmation; ids shown on bars are the source ids (Notion bars have no id, so they are blank).

---

## TIMELINE-PLANNING-01: Spot what is late on first look
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup, opens Projects on Monday  **Goal**: Find out which task is scheduled wrong and why.
**Preconditions**: Default mockup state, Product launch project, Timeline tab not yet selected.
**README stories**: S12, S14
**Ideal path**: 3 (click Timeline, hover the red warning, click the row label to see the blocker). Reasoning: nothing else is needed to understand the problem.
**Alternate paths**: Board view shows a "Blocked" marker on the same card, but not the date clash. Bot panel "What is blocked this week?" (not walked here, see bot topic).

### Steps
1. Click "Timeline" in the Board/Timeline switch → Phase groups Plan, Build, Launch prep, Launch appear, with a red "Today" pill and line, bars, arrows, two diamonds, and an "Unscheduled" lane.
2. Look for trouble. Mara thinks: "Which of these red things is the problem?" Her eye goes to a red dashed arrow and a small warning triangle at the start of the "Security review" bar, repeated as a triangle in the row label. → She hovers the triangle on the bar.
3. Hover the triangle → Tooltip "Starts before Docs site ends".
4. Click the row label "Security review" → Task drawer opens: Linear issue ENG-47, Dates "Nov 7 to Nov 16", "Blocked by" shows "Docs site, In progress", plus a "Suggestion" card "Move due date to Nov 23".

### Walk result
1. OK. Tab switches, no console errors; Today line at Oct 16 (`a-default.png`).
2. OK. Triangle and row-label triangle both render (`a-default.png`). CONFUSING: the legend entry "Starts before blocker ends" is visually separate from the bars; only one conflict exists so it is easy to find, but with many it would be a wall of red.
3. OK. Title is `Starts before Docs site ends`. CONFUSING: the tooltip is hover-only; the triangle is not focusable and clicking it does nothing (walked: click opens no drawer).
4. OK for the drawer. CONTRADICTS-PLAN (mild): the suggestion says move the due date later by a week; the timeline fix is to move the start later. Also clicking the triangle or the arrow is a dead click; only the bar or row label opens the drawer.

### Variations / Edge cases
- Clicking a phase header ("Build") does nothing. Fine, but no collapse either.
- Keyboard: tab to a bar and press Enter does nothing (walked), so keyboard users cannot open a task from the timeline. Row labels open the drawer by click only.

---

## TIMELINE-PLANNING-02: Check the Unscheduled lane and try to date a task
**Type**: short  **Persona**: Teo, product manager at a 30-person SaaS company  **Goal**: Give "Partner outreach list" a date so it shows on the timeline.
**Preconditions**: Default state, Timeline tab.
**README stories**: S12, S27
**Ideal path**: 3 (scroll to lane, click chip, set dates in drawer). Reasoning: dating a task needs one field edit.
**Alternate paths**: Drag the chip onto the grid (a natural guess, not supported). Board card "No date" opens the same drawer.

### Steps
1. In Timeline, scroll to the bottom → "Unscheduled" lane with two chips: "Post-launch survey" (Writer avatar, Notion icon) and "Partner outreach list PL-16" (? avatar).
2. Teo thinks: "I'll drag this chip onto the week I want." → Drag the "Partner outreach list" chip onto the grid.
3. Nothing moves. He clicks the chip → Task drawer opens: Dates "Unscheduled", Estimate "None", Assignee "Unassigned", Suggestion "Assign to Cy Novak" with "Accept" and "Dismiss".
4. He looks for a date field in the drawer → Dates is plain text.

### Walk result
1. OK. Two chips render (`i-unsched.png`). CONFUSING: the lane label column is empty beside the chips; the lane header reads only "Unscheduled".
2. MISSING. Chip drag does nothing (count stayed at 2).
3. OK for opening the drawer. Suggestion card is about assignee, not dates.
4. MISSING. There is no way to set start or end. README S12 says undated tasks "sit in an Unscheduled lane" but gives no path out of it; S27 drawer fields are read-only in the mockup.

### Variations / Edge cases
- Chips of Notion tasks (Post-launch survey) show no id, Native/GitHub chips do. Inconsistent (S28).
- "Accept" on the assign suggestion only toasts "Sent for approval" (mockup shortcut).

---

## TIMELINE-PLANNING-03: Fix a schedule conflict by dragging
**Type**: medium  **Persona**: Mara, eng lead at a 12-person startup  **Goal**: Make "Security review" start after "Docs site" ends, without opening it.
**Preconditions**: Default state, Timeline tab. Security review is a Linear task, read and write connection.
**README stories**: S13, S14
**Ideal path**: 1 drag. Reasoning: one pointer gesture, ending the conflict, is the minimum.
**Alternate paths**: Drawer suggestion "Open in Linear" to change the date in Linear (leaves Praci). "Shift dependents" from the conflict marker is README S15 (later), not in mockup.

### Steps
1. Open Timeline; identify the "Security review" bar (ENG-47) with a warning triangle at its left edge → Warning visible.
2. Press and hold the ENG-47 bar and move right → Bar follows the pointer in whole days. A dark tooltip near the pointer says "0 dependents move · +3d" at 3 days.
3. Mara thinks: "Is +3 enough? How do I know where Docs site ends?" She aims for the left edge to be right of the Docs site bar's right end (Nov 9).
4. Release → Bar settles; toast "ENG-47 moved +3d and written to Linear". The warning triangle in the bar and row label disappears and the red dashed arrow turns grey.
5. She wonders whether it really saved. → Clicks the bar to open the drawer: Dates read "Nov 10 to Nov 19".

### Walk result
1. OK (`a-default.png`).
2. OK. Tooltip text matches the README preview idea, but it shows only a day offset, no new start/end dates and no hint that the conflict will clear (observed tooltip `0 dependents move · +3d`).
3. CONFUSING. Nothing lines the bar up with the blocker's end; no snap, no guide.
4. OK, conflict count went from 1 to 0 and the toast named the source (observed after +3d). CONTRADICTS-PLAN: README S13 says a preview, then save, and a failed write reverts the bar. The mockup writes on release with no save step and no failure path. Also the toast has no Undo.
5. OK. Dates update. (Note: a pure click, not drag, opens the drawer, so Mara can mis-click a 3px wobble into a drawer, and a 4px wobble into a reschedule.)

### Variations / Edge cases
- Dragging +2d leaves the conflict (start Nov 9 < Docs site end Nov 9?). Docs site ends day 35 and Security starts day 33: +2 gives day 35, which clears the conflict exactly; +1 does not. No on-screen cue tells the user which.
- Drag a Notion task ("Docs site") instead: tooltip "1 dependent moves · +5d", toast "Docs site moved +5d and written to Notion", but the conflict on Security review remains and gets worse (walked). The user pushed the blocker later, which is the wrong direction.

---

## TIMELINE-PLANNING-04: Slip a blocker and see what it breaks
**Type**: medium  **Persona**: Di, backend developer on the Signup API  **Goal**: Move "Signup API" a week later because of a delayed dependency and know who is affected.
**Preconditions**: Default state, Timeline tab.
**README stories**: S13, S14, S15
**Ideal path**: 2 (drag bar, review the list of affected tasks and confirm). Reasoning: the plan promises a preview listing dependents and a save step.
**Alternate paths**: Edit the date in GitHub (not available in mockup drawer). Bot re-plan (S19, later).

### Steps
1. Open Timeline, locate "Signup API" (#142, black = critical path) in the Build group.
2. Drag the #142 bar right by 7 days → Tooltip "7 dependents move · +7d". Dashed outlines appear around #145, Docs site, ENG-47, #151, PL-13 and the diamonds.
3. Di thinks: "Seven move? Good, they will shift with it." → Releases the bar.
4. Bar lands at Oct 19 to Nov 2; toast "#142 moved +7d and written to GitHub".
5. Di looks at the result and sees nothing else moved. Billing integration and Docs site now show warning triangles and red dashed arrows; Security review is still red.
6. He wants the others to follow → looks for a "Shift dependents" control and clicks the triangle.

### Walk result
1. OK.
2. OK visually (`b-drag-preview.png`). The count 7 is every transitive dependent, including ones that would not need to move.
3. CONFUSING. The tooltip says "dependents move" but they will not. Observed: after release only #142 changed.
4. CONTRADICTS-PLAN. README S13: "a preview lists dependents that would move" before saving. The mockup writes to GitHub with the preview only as a transient tooltip.
5. OK for the red markers (`b-after.png`): conflicts went from 1 to 3 (`Starts before #142 ends` twice). CONFUSING: the critical path stays drawn through the now-broken chain, and no message says "you created 2 conflicts".
6. MISSING. The triangle is a non-clickable icon, so S15 "Shift dependents" has no hint, even as a later feature.

### Variations / Edge cases
- Drag a Done task (Scope brief PL-1) +3d: tooltip "11 dependents move", release gives 2 new conflicts, no warning that the task is Done (walked).
- Drag earlier (Support runbook -5d): tooltip "2 dependents move · -5d" although moving earlier cannot force dependents to move.
- Read-only tracker: a GitHub bar does not drag; a click opens the drawer; no tooltip says why (walked).

---

## TIMELINE-PLANNING-05: Read the critical path and move a milestone
**Type**: medium  **Persona**: Priya, operations lead who owns the launch date  **Goal**: Understand which tasks decide the Launch day date, and see what happens if "Beta ready" moves.
**Preconditions**: Default state, Timeline tab.
**README stories**: S12, S14
**Ideal path**: 3 (read legend, trace heavy line, drag diamond). Reasoning: legend plus one gesture.
**Alternate paths**: Ask the bot (not in this topic).

### Steps
1. Open Timeline; look at the legend under the chart: "Critical path", "Task", "Starts before blocker ends", "Today".
2. Trace the heavy black bars and arrows: #142 Signup API, #145 Billing integration, #151 Load testing, PL-13 Go/no-go review, then the black diamond "Launch day". Priya thinks: "Good, that is the chain that decides launch."
3. Notice "Beta ready" diamond is grey and sits beside #145's end, with an arrow from #145.
4. Drag "Beta ready" 10 days right → Tooltip "0 dependents move · +10d".
5. Release → Toast "PL-8 moved +10d" (no "written to", it is native).
6. Click "Launch day" diamond → Drawer opens: Native task, Dates show the single date Nov 24 (day 50).

### Walk result
1. OK. CONFUSING: no explanation of what "critical" means; legend order puts "Task" between, and the swatches differ only in thickness/colour (`a-default.png`).
2. OK. Black marks match the hardcoded `c` flag. Not computed (known plan gap, S14): moving tasks never changes which are black. Verified: after the +7d drag in story 04 the black chain is unchanged.
3. CONFUSING. Arrows into the diamonds route awkwardly, with the arrowhead and diamond overlapping (see Launch day in `a-default.png`).
4. OK. Milestone drags like a bar.
5. OK. But Beta ready sat after #145 (Nov 10); +10d puts it on Nov 20 with no conflict shown, since nothing depends on it.
6. OK. Click without drag opens the drawer.

### Variations / Edge cases
- Dragging Launch day earlier than PL-13's end creates a conflict marker on the diamond only after release.
- Milestone has no "Estimate"; drawer shows "None". Fine.

---

## TIMELINE-PLANNING-06: Notion has no dependency relation
**Type**: medium  **Persona**: Jonas, founder who tracks marketing work in Notion  **Goal**: Understand why Notion tasks have no arrows, and ask Praci to add a relation.
**Preconditions**: "Mockup states" menu: check "Notion: no relation". Timeline tab.
**README stories**: S4, S12, S14
**Ideal path**: 2 (read the note row, click "Add relation"). Reasoning: the note row is the control.
**Alternate paths**: Notion property mapping at connect time ("Blocked by", optional), which only exists in the connect form.

### Steps
1. Open Timeline with the mock toggle on → A banner row above the chart: warning icon, "Notion has no dependency relation", button "Add relation".
2. Look at the chart. Jonas thinks: "Where did my arrows go?" → "Docs site" (and Pricing model, Press kit) bars have no arrows in or out. The red conflict on Security review is gone.
3. Click "Add relation" → Toast "Sent for approval".
4. He waits for an approval card → None appears. Click the "Security review" row label; the drawer's "Blocked by" still lists "Docs site, In progress".

### Walk result
1. OK (`g-norel.png`). CONFUSING: the note does not say what Add relation does, to which database, or what will be written.
2. OK. Arrows involving Notion tasks vanish (13 arrows down to 9, conflicts 0).
3. CONTRADICTS-PLAN. README S4 says "Add relation" is a write needing approval; the mockup shows only a toast, no approval card.
4. CONTRADICTS-PLAN. Drawer for the Linear task still lists the Notion blocker while the chart hides the dependency; the board and bot answer still use it (discovery item 19). The Notion tasks' own drawers say "No relation property".

### Variations / Edge cases
- Notion bars have no label on them (no id); with no arrows the bars are nearly anonymous (`g-norel.png`). Row labels still carry the name.
- After "Add relation" the banner stays, with no pending state.

---

## TIMELINE-PLANNING-07: Resolve an "Update conflict" on a due date
**Type**: medium  **Persona**: Sam, delivery manager moving dates in a standup  **Goal**: Resolve a stale-write clash on "Billing integration" and see the correct date.
**Preconditions**: "Mockup states": check "Conflict". Timeline tab. Billing integration is GitHub #145, bar shows Oct 26 to Nov 10.
**README stories**: S26, S13
**Ideal path**: 1 (pick one button). Reasoning: the modal already has both values.
**Alternate paths**: none found. The modal cannot be reached any other way in the mockup.

### Steps
1. Mock toggle "Conflict" on → A modal "Update conflict" opens over the timeline: "#145 Billing integration · Due date", two boxes "Yours: Nov 13" and "GitHub, 4 min ago: Nov 6", buttons "Keep mine" and "Use GitHub".
2. Sam thinks: "Which of these did I just change? The bar says Nov 10, not either of these." He reads the boxes.
3. He tries Escape, then clicks outside the modal → Nothing closes.
4. Click "Keep mine" → Toast "Kept your value"; modal closes.
5. He checks the bar for #145 → Still Oct 26 to Nov 10.

### Walk result
1. OK (`h-conflict.png`). The modal does appear on both Board and Timeline.
2. CONFUSING. Neither value matches the bar (Nov 10), and it is "Due date" while the timeline shows start and end.
3. CONFUSING. Escape and scrim click do nothing (walked); only the two buttons close it. No "Cancel / decide later".
4. OK. Toast matches the choice.
5. MISSING. The chart does not change after either "Keep mine" or "Use GitHub" (the second walked separately: toast "Used GitHub value", bar still Nov 10). The user cannot see the outcome.

### Variations / Edge cases
- "Keep mine" overwrites GitHub; the button does not say so. Suggested label "Keep my date (Nov 13)".
- In production the modal should follow a drag (story 03/04), not a toggle; the trigger is mockup-only.

---

## TIMELINE-PLANNING-08: Weekly plan review across sources (long)
**Type**: long  **Persona**: Mara, eng lead at a 12-person startup, preparing a Friday launch review  **Goal**: Review the whole schedule, fix the one real conflict, and check only her own team's work.
**Preconditions**: Default state, 1360 wide.
**README stories**: S10, S12, S13, S14, S24
**Ideal path**: 9. Reasoning: open timeline, find conflict, drag to fix, filter, restore.
**Alternate paths**: Board with Group by assignee for load (other topic).

### Steps
1. Click "Timeline" → full chart shows.
2. Scroll the chart sideways → The task-name column stays fixed while weeks scroll; the week header stays at top.
3. Read the legend → Four entries.
4. Hover the triangle on "Security review" → "Starts before Docs site ends".
5. Click the "Docs site" row label → Drawer: Notion page, "Synced 12 min ago", Dates Oct 26 to Nov 9, "Blocked by" #142 Signup API.
6. Click the "#142" blocker chip → The drawer swaps to Signup API (GitHub issue #142).
7. Press Escape → Drawer closes.
8. Drag the ENG-47 bar +3 days → Tooltip "0 dependents move · +3d".
9. Release → Toast "ENG-47 moved +3d and written to Linear"; conflict gone.
10. Open "Filter by person or bot" and pick "Di Okafor" → Only Build/Launch prep rows with Di remain (Signup API, Load testing); arrows disappear.
11. Mara thinks: "Where did the dependency lines go?" She looks at the Launch day milestone → It is not visible.
12. Reset the filter to "Everyone" → Full chart returns.
13. Open "Sources" and uncheck Notion → Docs site, Pricing model, Press kit rows disappear; arrows into them disappear.
14. Look for the conflict marker she fixed earlier, then drag Signup API +7d → tooltip "7 dependents move", release gives toast "#142 moved +7d and written to GitHub".
15. She hovers the new triangle on "Billing integration" → "Starts before #142 ends".
16. She wants to undo → No Undo in toast; drag #142 back -7d → Toast "#142 moved -7d and written to GitHub".
17. Re-check "Notion" in Sources → Rows return.

### Walk result
1. OK.
2. OK. Observed horizontal scroll (1082px wide chart in a 1062px viewport, label column sticky).
3. OK. CONFUSING: "Critical path" meaning not explained.
4. OK.
5. OK. (Notion tasks appearing as blockers elsewhere show a "Page" chip with no id, S28.)
6. OK. Drawer navigation works but there is no back button.
7. OK.
8. OK.
9. OK (see story 03 for save/undo gaps).
10. CONFUSING. With a person filter, blockers owned by others vanish and so do their arrows (`j-filter.png`: 0 arrows, 0 conflicts), so the conflict warning is lost.
11. CONFUSING. Milestones owned by others disappear; the Launch day diamond cannot be seen under a filter.
12. OK.
13. CONFUSING. Hiding Notion hides the Security review conflict marker silently (observed 0 conflicts), so a hidden-source schedule problem disappears. No indicator such as "1 hidden blocker".
14. CONTRADICTS-PLAN. Tooltip says dependents move; they do not (story 04).
15. OK for the marker (one new conflict with Notion hidden, not walked as a hover). MISSING: no summary count of conflicts.
16. MISSING. No Undo; the only recovery is re-dragging by hand, which writes to GitHub twice.
17. OK.

### Variations / Edge cases
- Read-only GitHub connection: step 14's drag does nothing, click opens the drawer, no explanation.
- At 390 width the same journey needs horizontal scrolling for every step (see story 09).

---

## TIMELINE-PLANNING-09: Check the schedule on a phone
**Type**: short  **Persona**: Lena, designer checking dates on the train  **Goal**: See when "Launch day" is.
**Preconditions**: 390x800 viewport, default state.
**README stories**: S12
**Ideal path**: 2 (open Timeline, scroll right to Launch day). Reasoning: the date is at the far right.
**Alternate paths**: Tap the "Launch day" row label to see the date in the drawer (faster than scrolling).

### Steps
1. Tap "Timeline" → Header controls wrap onto several rows; "Ask bot" sits on its own row.
2. Look at the chart → Label column (about 215px wide) leaves about 175px for bars.
3. Swipe the chart sideways → It scrolls inside its box to see later weeks.
4. Tap "Launch day" row label → Drawer shows the date.

### Walk result
1. OK but tall: the controls wrap onto several rows (`l-mobile.png`).
2. CONFUSING. At 390 wide only 2 weeks of bars show; the Today pill is clipped.
3. OK. Chart scrollWidth 1082 vs clientWidth 356; no page-level horizontal scroll (390 = 390). Bars use `touch-action: pan-y`, so a horizontal finger drag reschedules instead of scrolling when it starts on a bar.
4. OK. Not walked: touch drag precision at 14px per day.

### Variations / Edge cases
- Dragging at this width is risky: a swipe that begins on a bar moves it and writes to the tracker.

---

## Findings

Ranked. "Real" means it would ship from the README as written; "Mockup only" is a shortcut.

1. **High, TIMELINE-PLANNING-04, 08. Real design problem.** The drag tooltip says "N dependents move" but dependents do not move; releasing writes to the tracker immediately and creates new red conflicts. README S13 promises a preview listing the dependents and a save step. Fix: show a list of the tasks that would move with their new dates plus "Save" and "Cancel", or drop the word "move" and say "N tasks depend on this".
2. **High, TIMELINE-PLANNING-04. Real.** The count is every transitive dependent, even when moving earlier or when there is slack (e.g. "2 dependents move · -5d" for a task moved earlier). Fix: count only tasks whose start would be before the new end.
3. **High, TIMELINE-PLANNING-02. Real.** Nothing can date an Unscheduled task: chip drag does nothing and the drawer date is text. Fix: allow dragging the chip onto the grid (writes dates) and a Dates control in the drawer.
4. **High, TIMELINE-PLANNING-07. Real.** After "Keep mine" or "Use GitHub" the chart is unchanged, and neither value matches the bar. Fix: show the date in the modal as the task's start/end, apply the choice to the bar on close, and tie the modal to a drag.
5. **Med, TIMELINE-PLANNING-03, 08. Real.** No Undo and no failure path (S13 says failures revert the bar). A mis-drag writes to GitHub or Linear and the only way back is dragging again. Fix: toast "Undo" and a visible revert on write failure.
6. **Med, TIMELINE-PLANNING-04. Real.** The conflict marker is a dead icon (hover tooltip only); clicking it does nothing and gives no hint of S15 "Shift dependents". Fix: make it focusable and open the preview, with a disabled "Shift dependents" labelled "Later".
7. **Med, TIMELINE-PLANNING-08. Real.** The person filter and the Sources filter silently hide blockers, arrows, conflicts and milestones. Fix: show "1 hidden blocker" on a bar whose blocker is filtered, and never hide a milestone.
8. **Med, TIMELINE-PLANNING-06. Real.** "Add relation" only toasts "Sent for approval" (S4 requires an approval card), the note does not say what will be written, and the drawer of a Linear task still lists a Notion blocker while arrows are hidden. Fix: approval card and consistent dependency source.
9. **Med, TIMELINE-PLANNING-01, 08. Real.** Bars and chips are not keyboard-operable (Enter on a bar does nothing; conflict triangle not focusable). Fix: make bars buttons with Enter to open and arrow keys to move one day.
10. **Med, TIMELINE-PLANNING-03. Real.** A 4px wobble on press reschedules and 3px opens a drawer; no snapping or guide to the blocker's end. Fix: snap to the blocker end, show new start/end in the tooltip, and show "Conflict resolved" or "Still starts before X ends" while dragging.
11. **Med, TIMELINE-PLANNING-05. Real (known).** Critical path is hardcoded; after a reschedule it does not change. Fix: compute it in core (S14) and recompute after save.
12. **Low, TIMELINE-PLANNING-02, 06, 08. Real.** Notion bars and chips have no label or id ("Page" in chips), so the timeline shows anonymous bars (`g-norel.png`). Fix: show the title on the bar when no id exists.
13. **Low, TIMELINE-PLANNING-07. Real.** The modal ignores Escape and scrim click and has no Cancel. Fix: add "Decide later" and Esc handling.
14. **Low, TIMELINE-PLANNING-09. Real.** Phone width shows two weeks, the Today pill is clipped, and a swipe that starts on a bar reschedules it. Fix: view-only on narrow screens or require a long press to drag.
15. **Low, TIMELINE-PLANNING-04. Real.** Dragging a Done task is allowed and creates conflicts. Fix: lock Done bars or ask.
16. **Low, TIMELINE-PLANNING-01. Real.** Drawer suggestion "Move due date to Nov 23" pushes the end later when the real fix is starting later; with a conflict present the suggestion should say so.
17. **Low, TIMELINE-PLANNING-05. Real.** Arrows into milestones overlap the diamond (`a-default.png` at Launch day), and the legend never defines "critical".
18. **Mockup only, fine:** the Conflict modal is triggered by a toggle; one conflict only; drawer fields read-only; "Docs refresh" shows the same tasks; no zoom (S12) and no edge-resize (S13) are absent from the mockup but are v1 in the README, so they should be added before this is treated as the v1 design.
