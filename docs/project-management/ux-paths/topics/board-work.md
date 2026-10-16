# Board work: user journeys

> Walked against the mockup before the fixes in this change; findings are kept as the record of what was fixed. See the Status column in the consolidated findings of catalog.md.

Scope: the Kanban board on the Projects page (cards, source ids, Blocked marker, drag to change status, Group by assignee with bot lanes, person/bot filter, WIP limit, read-only lock, task drawer from a card). All names and data are invented. The mockup's "today" is Oct 16.

Walked in headless Chromium (Playwright) against `docs/project-management/mockup.html` at 1360x860, plus one story at 390x844. States were set from the "Mockup states" menu. No console errors or page errors in any run. Screenshots are in a local scratch folder (not committed) (01-board, 04-group, 05-filter-ada-group, 07-readonly, 09-crosslane, 11-mobile-board, 14-suggestion, 15-thread, 17-long-after-move, among others).

Seed board for reference (Product launch, Oct 16): Backlog 5, Todo 3, In progress 3 / 2 (over limit), In review 1, Done 2. Blocked cards: Security review, Press kit, Go/no-go review, Billing integration, Load testing, Onboarding emails, Docs site.

Walk result legend: OK, MISSING (README requires it, mockup has no UI), CONFUSING, CONTRADICTS-PLAN.

---

## BOARD-WORK-01: Read a card and find out why it is Blocked
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup, opening Projects for the first time this week
**Goal**: Understand what a card says and which task blocks "Load testing".
**Preconditions**: Default mockup state (all four sources connected, board view).
**README stories**: S8, S28
**Ideal path**: 2 steps (hover the Blocked marker, read the tooltip). Hover is the cheapest way to see the blocker name.
**Alternate paths**: Click the card, read "Blocked by" in the drawer (3 steps, also shows blocker status). Timeline view shows the dependency arrow (not walked here).

### Steps
1. Open "Projects" in the left nav, look at the Board. → Five columns Backlog, Todo, In progress, In review, Done with counts. Mara is thinking: "What are these little icons next to the numbers?"
2. Read the "Load testing" card in Todo. → Title, `#151` with a GitHub icon, `backend` tag, red `Blocked`, avatar "D", "Due Nov 20".
3. Hover the red "Blocked" marker. → Tooltip "Blocked by Billing integration". Mara is thinking: "Is that the whole list? Is it blocked right now or just has a dependency?"
4. Click the card. → Task drawer opens with "BLOCKED BY" listing `#145 Billing integration Todo`.

### Walk result
1. OK: board renders with counts (`Backlog 5`, `Todo 3`, ...), no console errors.
2. OK for GitHub and Linear (icon + id). CONFUSING: Notion cards (Pricing model, Docs site, Press kit, Post-launch survey) show only a page icon and no id, and native cards show `PL-n` with no icon, so the id column looks inconsistent (matches S28 but needs a legend). The source icons have no label other than a hover title.
3. OK but weak: the blocker list is a native `title` tooltip, so it does not work on touch or with the keyboard, and shows names only, not status. Verified: `Blocked by Billing integration`.
4. OK: drawer lists `#145 Billing integration Todo`. The drawer then shows a "Suggestion" whose reason reads "Blocker is still in progress" while the blocker is in Todo (CONFUSING copy).

### Variations / Edge cases
- A card with two blockers (Go/no-go review) shows "Blocked by Load testing, Support runbook" in one comma list.
- Moving the blocker to Done removes the marker from its dependents (walked in BOARD-WORK-04).
- Turning on "Notion: no relation" removes the Blocked marker on any card with a Notion blocker or dependent without saying so (the board silently under-reports blocking).

---

## BOARD-WORK-02: Drag a native card to In progress
**Type**: short  **Persona**: Teo, solo founder using Rakazo with no tracker
**Goal**: Mark "Support runbook" (PL-12) as started.
**Preconditions**: Default mockup state.
**README stories**: S9, S11
**Ideal path**: 1 drag. Nothing shorter exists.
**Alternate paths**: none found (the drawer Status field is plain text, see BOARD-WORK-03).

### Steps
1. Press and drag "Support runbook" from Todo toward In progress. → Card dims, target column gets a dashed outline.
2. Drop it in the "In progress" column. → Card appears there; toast "PL-12 moved to In progress". Teo is thinking: "The header turned amber. Did I do something wrong?"
3. Look at the "In progress" header. → "4 / 2" with a warning icon.
4. Hover the header. → Tooltip "Over the limit of 2".

### Walk result
1. OK: native HTML5 drag works in Chromium; `.drag` opacity applied.
2. OK: toast "PL-12 moved to In progress", no "written to" suffix for native tasks (correct per mockup).
3. CONFUSING: Teo never set a limit and the board has no control to set or change one ("No UI to set limits"). The number "4 / 2" has no explanation until hover. CONTRADICTS-PLAN: README Decision 11 and S11 mark WIP limits "later", yet the mockup shows one by default.
4. OK: tooltip text verified (`title="Over the limit of 2"`). Not available on touch or keyboard.

### Variations / Edge cases
- Dropping on a column the card is already in re-renders with no toast.
- Dropping onto another card (not the empty cell area) works because the card sits inside the cell.
- Reload resets all moves (mockup has no persistence; fine for a mockup).

---

## BOARD-WORK-03: Open a card from the keyboard and try to change its status
**Type**: short  **Persona**: Ines, power user who avoids the mouse
**Goal**: Move "Billing integration" to In review without dragging.
**Preconditions**: Default mockup state.
**README stories**: S27, S9
**Ideal path**: 3 steps (Tab to the card, Enter, change Status in the drawer). The mockup cannot do the last step.
**Alternate paths**: none found.

### Steps
1. Tab to the "Billing integration" card. → Visible focus ring. Ines is thinking: "Is this card a button? How do I move it?"
2. Press Enter. → Task drawer slides in with the title, "Send to bot", the source row "GitHub issue #145 · acme/web", "Synced 2 min ago", "Open in GitHub".
3. Look for a way to change Status. → The Status row shows "Todo" as text.
4. Press Escape. → Drawer closes.

### Walk result
1. OK: cards have `tabindex=0` and a focus-visible outline. CONFUSING for screen readers: the card has no `role` or accessible name beyond its text.
2. OK: Enter opens the drawer; verified fields Status, Owner, Assignee, Dates, Label, Estimate.
3. MISSING: the drawer has no select, input or editable control (0 found). S27 says edits go "through the same write path as drag-and-drop", and S9 offers no other way to change status. A keyboard-only or touch user has no way to change status at all. Real design problem, see Findings.
4. OK: Escape closes. CONFUSING: focus is not returned to the card (activeElement is `BODY`), so Ines must Tab from the top again.

### Variations / Edge cases
- Clicking the scrim also closes the drawer.
- There is no keyboard equivalent to drag (no "Move to" menu on a card).

---

## BOARD-WORK-04: Move a GitHub card to Done and see what it unblocks
**Type**: medium  **Persona**: Dev, backend engineer on a 12-person team
**Goal**: Close "Signup API" (#142) and confirm the work waiting on it is now free.
**Preconditions**: Default mockup state, Read and write access.
**README stories**: S9, S8, S23, S28
**Ideal path**: 2 steps (drag, read the toast). The unblocked check is passive.
**Alternate paths**: Ask the bot "Signup API is done" and approve the "Change status" card in the panel (Ask bot, scroll to Change status, Approve; 4+ steps). This is the bot path; the user's own drag needs no approval per README.

### Steps
1. Find "Signup API" in In progress: `#142`, `backend`, avatar D, "Due Oct 26". → Visible. Dev is thinking: "It is a GitHub issue. Will this change the issue itself?"
2. Drag it to Done. → Card moves; toast "#142 moved to Done and written to GitHub".
3. Look at the "In progress" header. → "2 / 2", amber tint gone.
4. Scan for "Blocked" markers. → "Billing integration" and "Docs site" lose their red marker (blocker finished). "Load testing" is still Blocked (by Billing integration).
5. Hover the "Blocked" marker on Load testing. → "Blocked by Billing integration" (changed from before).
6. Try moving "Load testing" straight to Done (it is still blocked). → Moves with toast "#151 moved to Done and written to GitHub". Dev is thinking: "Nothing warned me that its blocker is still open."

### Walk result
1. OK: id and icon visible. CONFUSING: nothing on the card says the move will write to GitHub until after the drop.
2. OK, verified toast text. The toast stays about 2 seconds, which is the only confirmation. MISSING (S9): no failure path (card returning plus inline error) and no pending state, so a slow GitHub write looks identical to a native one.
3. OK: header re-evaluates to `2 / 2` and no `over` class.
4. OK: derived marker updates (before: 7 blocked cards; after: `Security review, Press kit, Go/no-go review, Load testing, Onboarding emails`). Moving the blocker did not change the dependents' status, which is correct.
5. OK.
6. MISSING: no check or warning when a blocked card is moved to In progress or Done. Not required by README, but a reviewer would expect at least the existing red marker to say it conflicts with the new column.

### Variations / Edge cases
- Notion card: "Docs site moved to In review and written to Notion".
- Linear card: "ENG-31 moved to Done and written to Linear".
- The same toast text is used with and without the bot: "written to" never says who wrote it.
- "Sync error" state does not change drag behavior (no organic trigger, mockup-only).

---

## BOARD-WORK-05: Find what the bots are working on with Group by assignee
**Type**: medium  **Persona**: Nadia, ops lead who delegates drafts to Writer and Research
**Goal**: See each person's and each bot's load, then check where "Landing page design" went.
**Preconditions**: Default mockup state.
**README stories**: S10, S30, S29
**Ideal path**: 2 steps (click "Group by assignee", scroll to the bot lanes).
**Alternate paths**: "Filter by person or bot" set to Research (1 step) shows only Research's cards but without lane context.

### Steps
1. Click "Group by assignee" in the header. → Button turns black; the board splits into lanes.
2. Read the lane headings. → "Ada Park 2", "Bo Reyes 3", "Cy Novak 2", "Di Okafor 2", "Eli Brandt 1", then "Research 1", "Writer 2", then "Unassigned 1". Nadia is thinking: "Good, bots come after people."
3. Look for "Landing page design" (ENG-31). → It is in the Research lane, not Cy Novak's (Cy is its Linear assignee). Nadia is thinking: "Why is Cy not on this one?"
4. Open the card and read the Assignee row. → "Research · working on it" with an "Open thread" button.
5. Drag "Landing page design" from the Research lane into the Writer lane's Done cell. → Toast "ENG-31 moved to Done and written to Linear". The card stays in the Research lane, in Done.
6. Click "Group by assignee" again. → Back to the flat board.

### Walk result
1. OK: toggle works and shows `aria-pressed`. Header counts (In review 3, Done 1) do not change with grouping. (Counts are per column, OK.)
2. OK: lane order verified. Empty lanes are omitted. The lane count badge is small (`.sub`) but legible.
3. CONFUSING: the card shows avatar "R" only; nothing says Cy is still the Linear assignee (S30: "the tracker's assignee is unchanged"). A user who knew Cy owned the design will think it was reassigned in Linear.
4. OK: Assignee row verified ("Research · working on it", "Open thread"). CONFUSING: Owner is Ada Park, who is not visible anywhere on the card.
5. CONFUSING: a cross-lane drop silently changes status only; a lane drop does not reassign. Standard swimlane boards reassign on cross-lane drops, so the card jumping back to its old lane looks like a bug.
6. OK.

### Variations / Edge cases
- The "Unassigned" lane disappears once its only card is sent to a bot.
- With 8 lanes the page is long and the column headers scroll away (headers are not sticky); at 860px height the lower lanes are below the fold.
- The "Mockup states" button overlaps the lower lanes (mockup-only).

---

## BOARD-WORK-06: Filter to one person or bot and read the result
**Type**: medium  **Persona**: Omar, team lead reviewing Ada's and Cy's load
**Goal**: See only Ada's work, then Cy's, then the Research bot's.
**Preconditions**: Default mockup state, Group by assignee off.
**README stories**: S10, S29
**Ideal path**: 1 step per person (pick from "Filter by person or bot").
**Alternate paths**: Group by assignee shows everyone at once (1 step), but no filtering.

### Steps
1. Open "Filter by person or bot" (shows "Everyone"). → Options grouped People (Ada Park, Bo Reyes, Cy Novak, Di Okafor, Eli Brandt) and Bots (Project bot, Research, Writer).
2. Choose "Ada Park". → Board narrows to cards she owns or is assigned: Docs site, Scope brief, Pricing model, Press kit, Post-launch survey, Partner outreach list, Landing page design, Onboarding emails. Omar is thinking: "Ada is only assigned to two of these. Why do I see Pricing model with Bo's avatar?"
3. Check the "In progress" header. → "1 / 2", no tint.
4. Choose "Cy Novak". → Onboarding emails and Support runbook (both In progress) appear; "In progress 2 / 2".
5. Notice Landing page design is missing. → It is assigned to Cy in Linear, but its bot assignee is Research, so it is excluded.
6. Choose "Research". → One card, Landing page design, with In review 1, all other columns 0.
7. Choose "Project bot". → Board shows five empty columns with 0 and no message.
8. Choose "Everyone". → Full board returns.

### Walk result
1. OK: grouped select verified.
2. CONFUSING: the filter matches owner OR assignee, with no label saying so. CONTRADICTS-PLAN: README S29 says the board can "filter by owner" as a distinct filter; the mockup has one mixed filter (`fOk` matches owner or assignee). Verified: with Ada selected, Bo's card "Pricing model" shows because Ada owns it.
3. CONFUSING: WIP counts follow the filter, so Ada's "1 / 2" hides that the whole column is "3 / 2". A WIP limit is a column property, so a filter should not make the warning disappear. The seed board's "3 / 2" is replaced by "1 / 2" with no hint.
4. OK: verified counts.
5. CONFUSING: a bot-assigned card is hidden from the human assignee's filter, with no indicator. Cy's load looks lighter than it is.
6. OK.
7. MISSING: no empty state or "No tasks" text; just empty columns. The mockup notes that empty columns have no text.
8. OK.

### Variations / Edge cases
- Group by assignee combined with a person filter still shows lanes for other people (Ada filter shows Bo's lane because Ada owns Pricing model), which defeats the point of grouping.
- The filter does not persist across reload (mockup).
- Label and project filters named in S10 do not exist (MISSING, listed in discovery).

---

## BOARD-WORK-07: Connect read-only and try to move a card
**Type**: medium  **Persona**: Kit, cautious engineer who wants Rakazo to never touch the tracker
**Goal**: Confirm that tracker cards cannot be moved while native cards still can.
**Preconditions**: Mockup states menu: "Read-only" checked (equivalent of connecting with Access "Read only").
**README stories**: S24, S9, S23
**Ideal path**: 2 steps (read the badge, try a drag and read the reason).
**Alternate paths**: none found.

### Steps
1. Open "Mockup states" and check "Read-only". → A "Read-only" badge with a lock appears next to the filter.
2. Drag "Billing integration" (GitHub) to Done. → Nothing moves; no toast, no message. Kit is thinking: "Is the board broken or is this the lock?"
3. Hover the card. → Cursor is a pointer, not a grab hand. No tooltip.
4. Drag native "Support runbook" to Done. → Moves; toast "PL-12 moved to Done".
5. Click "Billing integration". → Drawer opens as normal, with "Open in GitHub" and a Status row that is text.
6. Click "Ask bot". → Panel opens and still shows the "Change status" approval card for GitHub #142 with "Approve" and "Reject".

### Walk result
1. OK: badge verified ("Read-only"). The badge says nothing about which source is read-only (one lock for all).
2. CONTRADICTS-PLAN: S24 says "Drag and drop is disabled with an explanation in the tooltip"; the mockup disables drag silently. Verified: `draggable` false on all non-native cards, card stays in Todo, the previous toast is still on screen from an earlier action (no new message).
3. CONFUSING: the cursor change is the only signal and there is no tooltip (the mockup's own state list says "no tooltip explanation").
4. OK: native tasks remain draggable, which matches the plan's "native is not read-only". CONFUSING: with a mix of draggable and non-draggable cards on one board and no marker, users cannot tell which will move.
5. OK.
6. CONTRADICTS-PLAN: S24 says a read-only connection also removes the bot's status change; the mockup still shows the approval card.

### Variations / Edge cases
- A read-only Linear plus read-write GitHub is not representable (one global switch).
- Group by assignee in read-only works unchanged; cross-lane drops are blocked for tracker cards.

---

## BOARD-WORK-08: Clear the WIP overload before standup (long)
**Type**: long  **Persona**: Priya, eng manager at a 12-person startup, 10 minutes before standup
**Goal**: Get "In progress" back under its limit of 2, make sure nothing blocked is being worked on, and hand the unassigned task to a bot.
**Preconditions**: Default mockup state.
**README stories**: S8, S9, S10, S11, S27, S28, S29, S30, S23
**Ideal path**: 6 (see the amber header, hover for the limit, open the blocked card to confirm it is blocked, drag it back to Todo, check the header, send the unassigned task to a bot). Group by assignee is optional.
**Alternate paths**: Ask the bot "What is blocked this week?" (Ask bot, read "3 blocked tasks"); that answer is canned and omits Docs site.

### Steps
1. Open "Projects" and read the board header row. → "In progress" has an amber tint, warning icon and "3 / 2".
2. Hover the "In progress" header. → Tooltip "Over the limit of 2". Priya is thinking: "Who is overloaded?"
3. Click "Group by assignee". → Lanes by person, then Research, Writer, Unassigned.
4. Find the In progress cards: "Docs site" (Ada), "Onboarding emails" (Cy), "Signup API" (Di). → Each in its person's lane. Priya is thinking: "Docs site has a red Blocked marker. Why is it in progress?"
5. Hover the Blocked marker on "Docs site". → "Blocked by Signup API".
6. Click "Docs site". → Drawer: "Notion page · Launch tasks", "Synced 12 min ago", "Open in Notion", Owner Ada Park, Assignee Ada Park, Status In progress, "BLOCKED BY #142 Signup API In progress".
7. Click the "Signup API" chip in the drawer. → Drawer switches to Signup API (GitHub issue #142).
8. Press Escape. → Drawer closes.
9. Drag "Docs site" from In progress to Todo inside Ada Park's lane. → Toast "Docs site moved to Todo and written to Notion".
10. Look at the "In progress" header. → "2 / 2", tint gone. Todo now shows 4.
11. Find "Partner outreach list" in the Unassigned lane. → `PL-16`, `growth`, avatar "?", "No date".
12. Click it. → Drawer shows Assignee "Unassigned", Dates "Unscheduled", Estimate "None", and a "Suggestion: Assign to Cy Novak, Lowest open load this week" with "Accept" and "Dismiss".
13. Click "Accept". → Toast "Sent for approval". Priya is thinking: "Where is the approval? Did it assign?"
14. Look at the Assignee row. → Still "Unassigned".
15. Click "Send to bot" in the drawer header. → Menu: Project bot, Research, Writer.
16. Choose "Writer". → Toast "Sent to Writer"; Assignee becomes "Writer · working on it" with "Open thread".
17. Press Escape. → Drawer closes; the card moves to the Writer lane (Writer now 3), the Unassigned lane disappears.
18. Click the card, then "Open thread". → Drawer closes, the bot panel opens with a thread titled "Writer": the task as a message and a "Working on it" card with "Open in" absent (native task).
19. Click the panel's close button. → Panel closes, board returns to full width.
20. Click "Group by assignee" again. → Flat board.

### Walk result
1. OK: verified `In progress3 / 2 [OVER]`.
2. OK: tooltip verified. Native `title`, delayed, not on touch.
3. OK.
4. OK: Docs site, Onboarding emails and Signup API sit in Ada, Cy and Di lanes. CONFUSING: In group mode the column headers are at the top of the page and scroll away, so the amber "In progress" header from step 1 is not visible while Priya moves cards in lower lanes.
5. OK: verified.
6. OK. CONFUSING: Notion cards have no id in the drawer chips (the Notion blocker shows "Page" or blank), though Signup API shows `#142`.
7. OK: blocker chip navigates to the blocker's drawer (verified title "Signup API"). There is no "back" to the previous task.
8. OK. CONFUSING: focus is lost to `BODY`, not returned to the card.
9. OK: toast verified ("Docs site moved to Todo and written to Notion"). MISSING: no undo, and Priya has just written to Notion with a single gesture. README says the user's drag writes immediately, so this is plan-consistent, but there is no undo toast action.
10. OK: verified `Todo4`, `In progress2 / 2`. The 3 / 2 to 2 / 2 transition is the only feedback that the limit is satisfied; it is not stated.
11. OK.
12. OK: suggestion present. CONFUSING: the reason line for tasks with an assignee and an open blocker reads "Blocker is still in progress" even when the blocker is in Todo (seen on Load testing).
13. CONFUSING / CONTRADICTS-PLAN: README S23 says bot writes to native tasks go through an approval card that names the project and what changes. Here "Accept" shows a toast "Sent for approval" and no approval card exists on the board or in the panel.
14. CONFUSING: verified the Assignee stays "Unassigned" and the card still shows "?", so Accept does nothing visible.
15. OK.
16. OK: row verified (`Research · working on it` seen for Research; Writer equivalent). Status stays Backlog while the row says "working on it" (CONFUSING).
17. OK: lanes after: Ada 2, Bo 3, Cy 2, Di 2, Eli 1, Research 1, Writer 3.
18. OK for Research and Writer. CONFUSING: the panel opens and the board shrinks to 684px of a 990px grid, so the Done column needs horizontal scroll.
19. OK.
20. OK.

### Variations / Edge cases
- If Priya picks Project bot in step 16, "Open thread" opens the generic Project bot conversation, not a task thread (S30 mismatch, from discovery).
- Dragging "Signup API" to Done instead of moving Docs site would also clear the limit and unblock Docs site, a faster route that Priya may not think of.
- Moving to "Backlog" instead of Todo has the same effect on the limit.
- With a person filter on in step 3, the header count changes and the amber tint can disappear (BOARD-WORK-06).

---

## BOARD-WORK-09: Triage on a phone
**Type**: medium  **Persona**: Sol, designer checking the board from a phone between meetings (390px width)
**Goal**: See what is blocked and move "Press kit" to Todo.
**Preconditions**: Browser width 390px (README says mobile screens are not in v1; this walks the web UI at phone width, since the mockup has a 900px breakpoint).
**README stories**: S8, S9
**Ideal path**: 3 steps (scroll sideways to the column, open the card, change status). Step 3 does not exist.
**Alternate paths**: none found.

### Steps
1. Open the Projects page. → Header stacks over three rows: project menu + Board/Timeline, Sources + "Everyone" filter, "Group by assignee" + "Ask bot". Left nav hidden.
2. Look at the board. → Backlog and a slice of Todo are visible; the rest is off-screen. Sol is thinking: "Is there more to the right?"
3. Scroll the board sideways. → Remaining columns appear; "In progress 3 / 2" is visible only after scrolling.
4. Tap "Press kit". → The drawer opens full width.
5. Look for a way to change status. → Status is text.
6. Touch-drag "Press kit" to Todo. → Nothing moves.

### Walk result
1. OK: no page-level horizontal overflow (`scrollWidth` 390 = `clientWidth` 390). The header takes 120px of a 844px screen.
2. CONFUSING: the board scrolls inside its own container (990px content, 358px visible), with no scroll cue or snap; the "Todo 3" count is cut off by the edge.
3. OK: horizontal scroll works.
4. OK: drawer width 390 (full width), readable.
5. MISSING: no status control (see BOARD-WORK-03).
6. MISSING: HTML5 drag and drop does not fire for touch in mobile browsers, so S9 "drag a card" has no mobile path. Not tested with real touch hardware; this follows from the mockup using `dragstart` events (not pointer events as on the Timeline).

### Variations / Edge cases
- Group by assignee at 390px multiplies the horizontal scroll per lane and is very long (see 13-mobile-group.png).
- README says mobile screens are not in v1; a responsive web board still needs a non-drag way to change status.

---

## Findings

Ranked. "Mockup-only" means fine for a mockup; "ships" means it would reach users unless the design changes.

1. **High, BOARD-WORK-03 / 09 / 08. No way to change status without dragging (ships).** The drawer Status is text and cards have no "Move to" menu, so keyboard-only users, screen-reader users and anyone on a phone cannot do the main board action. S27 says edits go through the same write path as drag. Fix: make Status in the drawer a select that uses the same write as drag, and add a "Move to" item to the card (right-click or "..." menu).
2. **High, BOARD-WORK-07. Read-only drag lock is silent and contradicts S24 (ships).** S24 requires an explanation in the tooltip; the mockup shows none, and the bot's "Change status" approval card is still shown. Fix: on a locked card, set a tooltip such as "GitHub is connected read-only" (with an accessible description) and hide the Change status card when the target source is read-only.
3. **Med, BOARD-WORK-06. The person/bot filter mixes owner and assignee and hides bot-assigned cards from the human's filter (ships).** README S29 wants an owner filter; users cannot tell why Bo's card appears under Ada, or why ENG-31 is missing for Cy. Fix: separate "Owner" and "Assignee" modes (or show a small "Owner: Ada" label on filtered cards), and show a chip or count for tasks delegated to a bot under Cy's filter.
4. **Med, BOARD-WORK-06 / 08. A filter changes the WIP count and can hide an over-limit column (ships).** Under Ada's filter, "In progress" reads "1 / 2" with no tint. Fix: compute the WIP count over all visible-by-source cards, not the person filter, or show "1 of 3 / 2" when filtered. The tooltip text "Over the limit of 2" works only with the true count.
5. **Med, BOARD-WORK-08. "Accept" on the drawer suggestion for a native task shows "Sent for approval" with no approval card and no change (mockup-only shortcut, but the plan gap is real).** S23 requires an approval card naming the project and the change. Fix: Accept should open or scroll to the bot panel approval card, or apply the change and say "Assigned to Cy Novak".
6. **Med, BOARD-WORK-05. A cross-lane drop silently changes status only (ships).** Users expect a swimlane drop to reassign. Fix: either disable drops outside the card's own lane (highlight only the card's lane) or make a cross-lane drop reassign, with a toast naming the new assignee (and for tracker cards, say that Rakazo stores the bot assignment only).
7. **Med, BOARD-WORK-08. WIP limit exists with no way to set it and is a "later" feature in the README (CONTRADICTS-PLAN).** A fresh native project with no limit would not show it. Fix: keep the state in the mockup but mark it as later, or add a small "Set limit" in the column header menu, hidden until used.
8. **Med, BOARD-WORK-01 / 06. Blocked and WIP explanations rely on native `title` tooltips (ships).** They do not work on touch or keyboard focus. Fix: make "Blocked" a focusable control that shows the blocker names (a popover) and put the limit text in the column header's accessible name.
9. **Med, BOARD-WORK-04. No warning when a blocked card is moved to In progress or Done, and no undo after a write to a tracker (ships).** Fix: keep the move (README says it never blocks) but add an "Undo" action to the toast and a toast suffix such as "still blocked by Billing integration".
10. **Med, BOARD-WORK-09. Phone board is a sideways scroll of 990px with no cue and no touch drag (ships if mobile web is used; mobile is out of v1).** Fix: at narrow widths show one column at a time with a column picker, plus the status control from Finding 1.
11. **Low, BOARD-WORK-03 / 08. Focus is lost when the drawer closes (ships).** Return focus to the card that opened it. Also give cards a `role` and an accessible name that includes status, source id and Blocked.
12. **Low, BOARD-WORK-08. Column headers scroll away in Group by assignee (ships).** With 8 lanes the amber header is off-screen. Fix: make the header row sticky.
13. **Low, BOARD-WORK-05. Bot-assigned card hides the tracker assignee and the Owner (S30 gap, ships).** Fix: show a small second avatar or a tooltip "Cy Novak in Linear" on the card, or at least in the drawer Assignee row.
14. **Low, BOARD-WORK-01. Drawer suggestion reason "Blocker is still in progress" shows when the blocker is in Todo or Backlog (mockup-only copy).** Fix: reason text should use the blocker's actual status.
15. **Low, BOARD-WORK-06. Filter to a bot with no cards (Project bot) shows five empty columns with no message (mockup-only, but needed before shipping).** Fix: one line "No tasks" in the first column.
16. **Low, BOARD-WORK-08. Sending a task to a bot leaves its status at Backlog while the drawer says "working on it" (ships).** Fix: either leave it and show "Backlog" clearly, or have the bot move the task to In progress through its approval card.
17. **Low, BOARD-WORK-01. Source icons carry no text label; Notion cards have no id; native cards have no icon (S28, ships).** Fix: add a one-time legend in the Sources dropdown, which already has the icons and names.
18. **Low, mockup-only. The "Mockup states" panel overlaps lower lanes; page state resets on reload; there is no board persistence.** No fix needed.
