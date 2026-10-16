# Bot conversation, approvals and citations: user journeys

> Walked against the mockup before the fixes in this change; findings are kept as the record of what was fixed. See the Status column in the consolidated findings of catalog.md.

Walked in headless Chromium (Playwright) against `docs/project-management/mockup.html` at 1360x860, and at 390x844 for story 08. States were set through "Mockup states". Console errors across all walks: none. Screenshots are in a local scratch folder (not committed) (02 citation drawer, 04 proposal and status card, 10 read-only approval, 14 mobile citation).

Facts about the mockup that apply to every story (observed, not guessed):
- "Ask bot" opens a panel that already contains a fixed five-message conversation (what is blocked, break down the launch announcement, "Signup API is done", "Onboarding emails will slip a week", "Weekly report"). The panel scrolls from the top; the thread is 1644 px tall in a 746 px viewport.
- The composer ("Ask about this project") is a plain div, not an input. Nothing can be typed.
- Every card button only shows a toast. No card changes state after a click, and no board or task data changes.

## BOT-CONVERSATION-APPROVALS-01: Ask what is blocked and check a claim
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup  **Goal**: Get an answer to "what is blocked this week?" and verify one claim by opening the task behind it.
**Preconditions**: Default mockup state (all four sources connected, Board view).
**README stories**: S16, S27, S28
**Ideal path**: 3 steps. "Ask bot", read the answer, tap a citation chip.
**Alternate paths**: The board already shows a red "Blocked" marker on cards, so Mara can scan the Backlog and Todo columns without the bot (see Finding 3).

### Steps
1. Open Projects, click "Ask bot" → The right panel opens (380 px), the "Ask bot" button disappears, the header reads "Project bot".
2. Read the top of the thread: "What is blocked this week?" then "3 blocked tasks" with three lines, each with chips (#145 #142, #151 #145, ENG-47 Page). Mara thinks: "Three? The board has more red Blocked tags than that."
3. Click the chip "#142" in the first line → The task drawer "Signup API" opens: "GitHub issue #142 · acme/web", "Synced 2 min ago", "Open in GitHub", Blocked by "PL-1 Scope brief Done".
4. Press Escape → Drawer closes, bot panel is still open at the same place.

### Walk result
1. OK: panel opened, `#askBot` hidden afterwards.
2. CONFUSING: the answer says 3 blocked tasks, but the board shows seven cards with "Blocked" (Security review, Press kit, Go/no-go review, Billing integration, Load testing, Onboarding emails, Docs site). Screenshot 02 shows the board behind the drawer.
3. OK for the click. CONFUSING for layout: the drawer is 440 px wide and the panel 380 px, so the drawer completely covers the panel (element at a panel point is `.db`). The conversation vanishes while the task is open. The scrim looks like it leaves the panel alone but the drawer sits on top of it.
4. OK: Escape closes only the drawer.

### Variations / Edge cases
- The chip "Page" (Notion, Docs site) has no id; its meaning shows only in the hover title "Docs site". A keyboard or touch user gets no label.
- Chip order: the first chip in each line is the subject task and the second is the blocker, but nothing says so ("#145 #142" reads as two equal items).

## BOT-CONVERSATION-APPROVALS-02: Approve the bot closing a GitHub issue
**Type**: short  **Persona**: Diego, solo developer who tracks work in GitHub  **Goal**: Let the bot mark #142 Signup API as Done in GitHub.
**Preconditions**: Default state. GitHub connected "Read and write".
**README stories**: S23
**Ideal path**: 2 steps. Open the panel, click "Approve" on the "Change status" card.
**Alternate paths**: Drag the "Signup API" card to the Done column. That is the user's own action, it writes straight to GitHub with no approval and shows the toast "#142 moved to Done and written to GitHub". It is shorter and does not need the bot.

### Steps
1. Click "Ask bot" and scroll to the message "Signup API is done" → A card "Change status" appears: Task "#142 Signup API", Target "GitHub", Status "In progress" struck through, then "Done". Buttons "Approve" and "Reject".
2. Click "Approve" → Toast "Status written to GitHub".
3. Diego thinks: "Did it work?" He clicks "Approve" again to be sure, then closes the panel and looks for Signup API in the Done column.

### Walk result
1. OK: card content matches S23 (task, target, old and new status). CONFUSING: the card has no title naming the action's consequence for a person who joined the thread late ("Signup API is done" is a user message that nothing in the panel lets Diego type).
2. OK for the toast, but MISSING: no approved state. The card still shows live "Approve" and "Reject" after the click.
3. MISSING: clicking "Approve" a second time works and shows the same toast, so a double approval is possible. The #142 card on the board stays in "In progress" (the mockup does not move it). Mockup-only gap, but the shipped card needs an "Approved" or "Done in GitHub" state.

### Variations / Edge cases
- "Reject" shows the toast "Rejected" and leaves the card as is.
- "Always allow this kind" (README S23) is absent.
- If GitHub is unchecked under "Connected", the status card for #142 still appears (observed). The shipped bot should not offer a card for a disconnected source.

## BOT-CONVERSATION-APPROVALS-03: Create tasks from a planning request, keep only some
**Type**: medium  **Persona**: Priya, founder planning a product launch  **Goal**: Turn the bot's breakdown of the launch announcement into native tasks, without the video task.
**Preconditions**: Default state. Native source connected.
**README stories**: S17, S23
**Ideal path**: 4 steps. Open the panel, untick one row, click "Accept selected", check the board.
**Alternate paths**: "Accept all" creates all four at once. No other path (the "New task" control does not exist, see S1/S27 gap).

### Steps
1. Click "Ask bot" → Panel opens. The second message "Break down the launch announcement" is below the first answer.
2. Read the card "Create 4 tasks in Product launch": four ticked rows, "Draft announcement 2 pts, No blockers", "Prepare demo video 3 pts, Blocked by Draft announcement", "Schedule social posts 2 pts, Blocked by Draft announcement", "Brief support team 1 pt, No blockers". Priya thinks: "I do not need a demo video yet."
3. Untick "Prepare demo video" → Row unchecks. "Schedule social posts" still says "Blocked by Draft announcement", which is fine. If she had unticked "Draft announcement", the two dependents would point at a task that will not exist.
4. Click "Accept selected" → Toast "Selected tasks created".
5. Click "Edit" first (she wants to change an estimate) → nothing happens.
6. Close the panel and look for "Draft announcement" on the Board → Not there.

### Walk result
1. OK.
2. OK: card title names the destination as S17 requires. The mockup has no hint that this is a proposal the bot will only apply after approval (S23 says approval is the gate), which is acceptable because the buttons say "Accept".
3. OK for the checkbox. MISSING: no rule or warning for untick of a task that others depend on.
4. CONFUSING: the toast does not say how many tasks ("Selected tasks created"; "Accept all" says "4 native tasks created"). The card stays unchanged with live buttons, so she can click again and create duplicates.
5. MISSING: "Edit" is a no-op (no toast, no form). Priya cannot change the 2 pts figure.
6. MISSING: the board still has 14 cards and no "Draft announcement" (mockup gap; the toast is the only evidence).

### Variations / Edge cases
- Untick all four, click "Accept selected": no guard, same toast.
- For a tracker-only project README says the card becomes a suggestion with "Open in <source>". The mockup always shows the native version, so that variant cannot be walked.

## BOT-CONVERSATION-APPROVALS-04: The bot cannot edit Linear; follow its due-date suggestion
**Type**: medium  **Persona**: Sam, product manager who keeps the roadmap in Linear  **Goal**: Act on "Onboarding emails will slip a week" without Rakazo changing Linear on its own.
**Preconditions**: Default state. Linear connected.
**README stories**: S19 (later, partly), S23, S18
**Ideal path**: 3 steps. Read the suggestion, click "Open in Linear", change the date in Linear.
**Alternate paths**: Open ENG-42 from the board, the drawer has its own "Suggestion" card with the same action (due date to Nov 3) and the same "Open in Linear" button.

### Steps
1. Click "Ask bot" and scroll to "Onboarding emails will slip a week" → Card "Suggestion": "Move due date from Oct 27 to Nov 3" with chip "ENG-42", buttons "Open in Linear" and "Dismiss".
2. Click the chip "ENG-42" → Drawer "Onboarding emails": Linear issue ENG-42 · Growth, Dates "Oct 16 to Oct 27", Blocked by ENG-31, plus its own "Suggestion" card "Move due date to Nov 3 / Blocker is still in progress".
3. Close the drawer, click "Open in Linear" → Nothing visible happens (the mockup link does nothing; in the product it would open Linear).
4. Click "Dismiss" → Toast "Dismissed". The card stays in the thread.

### Walk result
1. CONFUSING: the panel card has no reason line, only the move, while the drawer version adds "Blocker is still in progress".
2. OK: dates and suggestion are consistent with the card (Oct 27 to Nov 3).
3. OK for a mockup (external link). Real design: the card does not say that the change is made in Linear and that Rakazo picks it up on the next sync. Sam may think the click already changed the date.
4. MISSING: dismissed card is not removed or greyed. Dismissing the bot card does not dismiss the drawer's duplicate Suggestion, and the other way round.

### Variations / Edge cases
- Two places show the same suggestion (panel card and drawer card) with independent Dismiss buttons.
- Notion task suggestion: drawer shows "Open in Notion". Same flow.

## BOT-CONVERSATION-APPROVALS-05: Save the weekly report
**Type**: medium  **Persona**: Lena, founder who sends a Friday update to investors  **Goal**: Get the weekly summary and keep it.
**Preconditions**: Default state.
**README stories**: S20, S16
**Ideal path**: 3 steps. Open the panel, scroll to the report, "Save to thread".
**Alternate paths**: none found. There is no button to generate a report on demand; the report is already in the thread.

### Steps
1. Click "Ask bot", scroll to the end of the thread (about 1600 px) → A card "Weekly report · Oct 12 to 16" with sections Done, In progress, Blocked, At risk.
2. Read "Done": Scope brief (PL-1), Pricing model (Page). Lena thinks: "Which page?"
3. Read "Blocked": Billing integration (#145), Security review (ENG-47). Then recall the first answer in the same panel said three blocked tasks including Load testing.
4. Click a chip to verify, for example ENG-47 → Drawer opens over the panel.
5. Close it and click "Save to thread" → Toast "Saved to thread".

### Walk result
1. CONFUSING: Lena asked for nothing, she scrolls to find the report. A real thread would open at the newest message.
2. CONFUSING: chip "Page" is used for every Notion task (Pricing model, Docs site), so the two cannot be told apart.
3. CONTRADICTS-PLAN: the report lists 2 blocked tasks, the "what is blocked" answer lists 3 (Load testing #151 is missing in the report). Both come from the same data in the real product.
4. OK, the chip works (drawer covers the panel).
5. OK for the toast. MISSING: no visible saved state; the button stays, can be saved twice. README says the report is saved as a message in the thread, so the card should then appear as a message.

### Variations / Edge cases
- "At risk" repeats the Security review line already under "Blocked", with a different reason.
- The report is hardcoded to "Oct 12 to 16" (the mockup's current week).

## BOT-CONVERSATION-APPROVALS-06: Accept or dismiss a bot suggestion in the task drawer
**Type**: short  **Persona**: Noor, ops manager triaging the backlog  **Goal**: Give "Partner outreach list" an assignee, then check a tracker task's suggestion.
**Preconditions**: Default state, Board view.
**README stories**: S18, S23, S30
**Ideal path**: 2 steps. Open the card, click "Accept".
**Alternate paths**: Drawer does not offer an assignee control, so this card is the only route in the mockup.

### Steps
1. Click the card "Partner outreach list" (PL-16, unassigned) → Drawer: "Native task · Product launch", "Saved in Rakazo", Assignee "Unassigned", and a "Suggestion" card: "Assign to Cy Novak / Lowest open load this week", "Accept", "Dismiss".
2. Click "Accept" → Toast "Sent for approval".
3. Noor thinks: "Approval by whom? I am the user." She looks at the Assignee row: still "Unassigned".
4. Click "Dismiss" → Toast "Dismissed"; the Suggestion card stays.
5. Close, open "Billing integration" (#145, tracker) → Suggestion "Move due date to Nov 17 / Blocker is still in progress", buttons "Open in GitHub" and "Dismiss".

### Walk result
1. OK: reason text is visible, as README S18 asks.
2. CONTRADICTS-PLAN: README S23 says a native change by the bot goes through an approval card naming the project and the change. Here "Accept" only says "Sent for approval" and there is no card anywhere in the panel.
3. CONFUSING: the user's own Accept is described as needing approval. README says the user's own edits need none.
4. MISSING: nothing changes after Dismiss.
5. OK: matches S23 and S18 (tracker task opens the source).

### Variations / Edge cases
- Send "Partner outreach list" to "Project bot" (Send to bot menu): Assignee becomes "Project bot · working on it", but the Suggestion "Assign to Cy Novak" is still shown (observed). CONFUSING: it proposes a human assignee for a task the bot now owns.
- "Open thread" for Project bot reopens the generic five-message conversation, not a task thread (known, S30).
- Suggestions appear on any task with an open blocker, including Docs site, which looks unrelated to "assign".

## BOT-CONVERSATION-APPROVALS-07: Read-only tracker and a status-change card
**Type**: medium  **Persona**: Owen, cautious CTO who connected GitHub read-only  **Goal**: Be sure Rakazo cannot change GitHub.
**Preconditions**: Mockup states: "Read-only" ticked.
**README stories**: S24, S23
**Ideal path**: 3 steps. Look for the read-only signal, open the bot, confirm no write is offered.
**Alternate paths**: Drag a GitHub card (drag is disabled with only a cursor change).

### Steps
1. Tick "Read-only" in Mockup states → "Read-only" badge with lock appears in the header.
2. Try dragging "Signup API" → The card does not move, no message explains why.
3. Click "Ask bot", scroll to "Signup API is done" → The "Change status" card with "Approve" and "Reject" is still there.
4. Owen thinks: "I said read-only. Why is the bot offering to write?" He does not click Approve.

### Walk result
1. OK: badge present (screenshot 10).
2. MISSING: README S24 wants an explanation in the tooltip. Cursor changes only.
3. CONTRADICTS-PLAN: S24 says a read-only connection also removes the bot's status change. The card is shown and Approve is clickable, with the toast "Status written to GitHub" if clicked.
4. This is the high-trust failure: the UI says both read-only and "will write".

### Variations / Edge cases
- The badge is global, but native tasks stay writable. The mockup does not show which sources are read-only.

## BOT-CONVERSATION-APPROVALS-08: Check a citation on a phone
**Type**: short  **Persona**: Jun, designer reading updates on the train  **Goal**: Tap a citation in the bot answer to see the task.
**Preconditions**: Viewport 390x844, default state.
**README stories**: S16 (mobile is later, but the mockup defines the narrow layout)
**Ideal path**: 3 steps. Tap "Ask bot", tap a chip, read the task.
**Alternate paths**: none found.

### Steps
1. Tap "Ask bot" → The panel fills the screen. The "Mockup states" control is hidden.
2. Tap the chip "#145" → Expect the Billing integration drawer.
3. Jun sees the panel unchanged, thinks the tap failed, and taps again.
4. Close the panel with the X → Now the drawer is visible behind it.

### Walk result
1. OK: panel is 390x844 full screen (screenshot 13).
2. CONFUSING: the drawer does open, but its z-index (20) is below the full-screen panel (22), so it opens behind the panel (screenshot 14 shows only the panel).
3. CONFUSING: no feedback at all.
4. OK: Escape and the scrim also close the hidden drawer, but a user cannot know it is there.

### Variations / Edge cases
- Chips are 11 px text with small hit areas; the chips on one row wrap but stay tappable.
- The "Approve" and "Accept all" buttons are 12 px high-density controls, small for touch.

## BOT-CONVERSATION-APPROVALS-09: Friday wrap-up with the bot, start to finish
**Type**: long  **Persona**: Mara, eng lead at a 12-person startup, 20 minutes before the Friday update  **Goal**: Review what is blocked, create the tasks for next week, close #142, deal with the slip, and save the report.
**Preconditions**: Default state, desktop.
**README stories**: S16, S17, S18, S20, S23, S27
**Ideal path**: 14 steps. Each action is one click in the panel and no step needs the board.
**Alternate paths**: Closing #142 by dragging its card is one step shorter (see story 02). The report has no other route.

### Steps
1. Click "Ask bot" → Panel opens with "What is blocked this week?" and the "3 blocked tasks" answer.
2. Click chip "#145" → Drawer for Billing integration opens and covers the panel.
3. Read its "Suggestion" card ("Move due date to Nov 17 / Blocker is still in progress", "Open in GitHub", "Dismiss") → Mara thinks: "Fine, later."
4. Press Escape → Back to the panel.
5. Scroll to "Create 4 tasks in Product launch" → Four ticked rows.
6. Untick "Brief support team", click "Accept selected" → Toast "Selected tasks created". She thinks: "Did that create three?"
7. Scroll to "Change status" and click "Approve" → Toast "Status written to GitHub". She expects the card to change.
8. Scroll to "Move due date from Oct 27 to Nov 3" (ENG-42), click "Open in Linear" → Nothing in the mockup. She clicks "Dismiss" → Toast "Dismissed".
9. Scroll to "Weekly report · Oct 12 to 16" → Done, In progress, Blocked, At risk.
10. Notice "Blocked" has two lines while the first answer said three → she looks for Load testing (#151) in the report, does not find it, and opens "ENG-47" → Drawer.
11. Press Escape.
12. Click "Save to thread" → Toast "Saved to thread".
13. Click the composer "Ask about this project" and try to type a follow-up ("what slipped?") → Nothing.
14. Click the X in the panel header → Panel closes, "Ask bot" returns. Board unchanged: #142 is still in "In progress", no new tasks exist.

### Walk result
1. OK.
2. OK, but CONFUSING: drawer hides the panel (story 01).
3. OK: reason line present.
4. OK.
5. CONFUSING: she scrolls past a fixed conversation she did not write; older messages first.
6. CONFUSING: toast has no count; card stays live.
7. MISSING: no approved state; a second click is accepted.
8. OK for the mockup link; CONFUSING because the dismissed card remains.
9. OK content; position forces scrolling 1600 px.
10. CONTRADICTS-PLAN: blocked list differs between answer and report (story 05).
11. OK.
12. MISSING: no visible saved state.
13. MISSING: composer is inert, so a follow-up question cannot be asked (S16 needs it).
14. CONFUSING: after about 8 actions the board shows none of them.

### Variations / Edge cases
- Do the same on the Timeline view: the panel and drawer behave the same, and no timeline preview of "slips a week" appears (S19, later).
- Do it with "Notion: no relation" ticked: the board hides Blocked markers and arrows, but the bot still says "Security review waits on Docs site" (Notion task).

## Findings

Ranked. "Mockup-only" means a shortcut that is fine in a mockup. "Ships" means a design problem that would reach users if the product copied the mockup.

1. **High, ships (story 07).** Read-only connection still shows the "Change status" approval card with a working "Approve". Contradicts README S24. Fix: when a source is read-only (or disconnected), the bot never creates status-change cards for its tasks and instead shows a suggestion with "Open in <source>". Also show the drawer tooltip for disabled drag.
2. **High, ships (story 08).** On narrow screens the task drawer (z-index 20) opens behind the full-screen bot panel (22), so tapping a citation chip appears to do nothing. Fix: raise the drawer above the panel, or close the panel while the drawer is open and return to the thread on close.
3. **High, ships (stories 01, 05, 09).** The bot's "3 blocked tasks" does not match the board (seven cards tagged "Blocked") nor the weekly report (two blocked tasks). A user will stop trusting the bot. Fix: derive all three from one rule ("has a blocker that is not Done"), and show a count the board can reproduce. Mockup-only for the hardcoded numbers, but the product must use a single definition.
4. **Med, ships (stories 02, 03, 04, 05, 06, 09).** Action cards have no resolved state. After "Approve", "Accept all", "Accept selected", "Dismiss" or "Save to thread" the same buttons remain, so users can approve or create twice. Fix: replace the buttons with a one-line result ("Done in GitHub", "3 tasks created", "Dismissed") and disable the card.
5. **Med, ships (story 06).** Drawer "Accept" on a native task says "Sent for approval" with no approval card, contradicting S23 (native bot writes go through a card). Fix: either show the card in the panel and link to it, or make "Accept" apply the change and say so.
6. **Med, ships (stories 01, 05).** Citation chip "Page" is used for every Notion task, so two Notion lines in one answer are not distinguishable, and the chip gives no label without hover. Fix: show a short title or the Notion page name in the chip (S28 asks for a source icon and id; Notion has no id).
7. **Med, ships (stories 01, 04, 05).** Opening a citation hides the whole conversation behind the drawer (440 px over a 380 px panel). Fix: make the drawer narrower than the viewport minus the panel, or open task detail inside the panel.
8. **Med, ships (stories 04, 06).** Duplicated suggestion in two places (panel card and drawer card) with independent Dismiss. Fix: one suggestion record; dismissing in either place clears both.
9. **Med, mockup-only (stories 03, 09).** "Edit" does nothing and the composer is inert, so the bot features cannot be tried with real input. Fix for the mockup: a short toast ("Not in the mockup") or hide the button. The real product needs both.
10. **Med, ships (story 06).** A task sent to Project bot ("working on it") still shows the suggestion "Assign to Cy Novak". Fix: hide the assignee suggestion when a bot is the assignee.
11. **Low, ships (story 04).** "Open in Linear" does not say that the change is made in Linear and appears after the next sync. Fix: one line under the button or the confirmation toast "Opened in Linear. Rakazo updates on next sync."
12. **Low, ships (story 03).** Unticking a task that other rows depend on gives no warning, and "Accept selected" with nothing ticked is allowed. Fix: disable "Accept selected" at zero ticked and note dropped blockers.
13. **Low, mockup-only (stories 01, 05, 09).** The thread opens at the oldest message, so the report needs about 1600 px of scrolling. A real thread opens at the latest message.
14. **Low, mockup-only (story 02).** Status card stays for a disconnected GitHub source, and no change reaches the board. Fine for a mockup, but the board and card should agree in the real product.
