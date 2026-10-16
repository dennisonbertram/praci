# Delegate to bots and ownership: user journeys

> Walked against the mockup before the fixes in this change; findings are kept as the record of what was fixed. See the Status column in the consolidated findings of catalog.md.

Walked in headless Chromium against `mockup.html` (1360x860, and 390x844 for story 08). Console errors across all walks: none. Screenshots are in a local scratch folder (not committed) (s1-after, s1-thread, s2-thread, s3-thread, s5-group-after, s5-filter-writer, s7-ro, s8-timeline-research, m3-sent, m4-thread). The walk script is `walk.js` in the same folder.

Seed facts used below: ENG-31 "Landing page design" (Linear, Owner Ada Park, tracker assignee Cy Novak) is already with Research; "Press kit" (Notion) and "Post-launch survey" (Notion, unscheduled) are already with Writer; "Partner outreach list" PL-16 (native) is unassigned; #151 "Load testing" (GitHub) and PL-12 "Support runbook" (native) have human assignees.

---

## DELEGATE-TO-BOTS-OWNERSHIP-01: Hand an unassigned task to Research
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup, has a native task nobody picked up  **Goal**: Give "Partner outreach list" to the Research bot and confirm it is being worked on  
**Preconditions**: Default mockup state, Board view, bot panel closed  
**README stories**: S30, S29, S8  
**Ideal path**: 4 steps. Card, Send to bot, Research, done; the drawer confirms in place.  
**Alternate paths**: Timeline Unscheduled chip "Partner outreach list" opens the same drawer (same Send to bot). Nav rows "Research" and "Writer" are inert, so there is no path from the left nav.

### Steps
1. Click the card "Partner outreach list" (Backlog column) → drawer opens: Owner "Ada Park", Assignee "? Unassigned". Mara thinks: "Nobody has it; can I just give it to a bot?"
2. Click "Send to bot" → menu lists "Project bot", "Research", "Writer", each with an avatar. She hesitates: which bot does what? Nothing in the menu says.
3. Click "Research" → toast "Sent to Research"; Assignee row becomes "R Research · working on it" with an "Open thread" button; Owner stays "Ada Park".
4. Press Escape or the X → board card now shows the blue R avatar and "No date".

### Walk result
1. OK: drawer showed `Owner A Ada Park Assignee ? Unassigned`.
2. CONFUSING: menu is three bare names; no role or one-line capability, and no marker for a current bot.
3. OK for the row. CONTRADICTS-PLAN / CONFUSING: the drawer still shows the "Suggestion: Assign to Cy Novak" card right under "Research · working on it" (screenshot s1-after). Accepting would assign a human to a task a bot is working on.
4. OK: card avatar title is "Research", column unchanged (Backlog).

### Variations / Edge cases
- Send to a task that already has a bot (ENG-31): replaces the bot silently; see story 05.
- The toast disappears after about 2 seconds; the drawer row is the only lasting confirmation.
- Mara leaves the drawer open and sends to a second bot: no confirmation that the first thread is abandoned.

---

## DELEGATE-TO-BOTS-OWNERSHIP-02: Check on what Writer is doing with the Press kit
**Type**: short  **Persona**: Ravi, founder, wants to see how far Writer got  **Goal**: Open the Writer thread for "Press kit"  
**Preconditions**: Default state, Board view  
**README stories**: S30  
**Ideal path**: 3 steps. Card, Open thread, read.  
**Alternate paths**: Timeline row label "Press kit" or its W avatar then Open thread (same drawer). The nav row "Writer" does nothing, so it is not an alternate. Filter by "Writer" finds the card quickly but is not a thread path.

### Steps
1. Click the card "Press kit" (purple W avatar) → drawer: Owner "Ada Park", Assignee "W Writer · working on it", button "Open thread".
2. Click "Open thread" → drawer closes, right panel opens headed "W Writer". The thread shows "Press kit" as a user message and a card "Working on it" with a "Page" citation chip and "Open in Notion".
3. Ravi looks for progress, a draft, or a result → there is none. He closes with the X.

### Walk result
1. OK: drawer text `Assignee W Writer · working on it Open thread`.
2. OK: thread text `Press kit Working on it Press kit Page Open in Notion`. The "Page" label is the Notion no-id chip.
3. MISSING: no progress, no output, no reply from Writer, no way to send a follow-up (composer "Ask about this project" is static and is not in the Writer thread context). "Working on it" never becomes done.

### Variations / Edge cases
- "Ask bot" is hidden while the panel is open, so to get to the Project bot from the Writer thread Ravi must close and reopen the panel.
- The Writer thread says "Open in Notion" but the Notion chip shows "Page" with no id; users with several Notion pages cannot tell which.

---

## DELEGATE-TO-BOTS-OWNERSHIP-03: Send a GitHub task to the Project bot and follow the thread
**Type**: medium  **Persona**: Joon, developer, wants the Project bot to take #151 Load testing  **Goal**: Delegate a tracker task to the Project bot and see its own thread  
**Preconditions**: Default state; Joon is not read-only  
**README stories**: S30, S23, S28  
**Ideal path**: 5 steps (card, Send to bot, Project bot, Open thread, read).  
**Alternate paths**: "Ask bot" in the header and typing a request: not possible, the composer is inert.

### Steps
1. Click the card "Load testing" (GitHub #151, Assignee D, Owner Bo Reyes) → drawer opens with "Open in GitHub".
2. Click "Send to bot" → "Project bot".
3. Toast "Sent to Project bot"; Assignee row "P Project bot · working on it". Joon thinks: "Did this change the GitHub assignee?" Nothing says it did not.
4. Click "Open thread" → panel opens "P Project bot". Joon expects a thread about #151.
5. He reads the thread.

### Walk result
1. OK: drawer shows source row "GitHub issue #151 · acme/web", Owner "Bo Reyes".
2. OK: menu opens with three bots.
3. OK for row; CONFUSING: no sign that GitHub's assignee (Di Okafor) is unchanged (README S30 says the tracker assignee stays; card hides it).
4. OK: panel opens.
5. CONTRADICTS-PLAN: the panel shows the generic canned conversation ("What is blocked this week?", "3 blocked tasks", "Create 4 tasks in Product launch", ...), not a thread about #151 (screenshot s3-thread). README S30: "starts a thread with that bot containing the task and its source link". Only Research and Writer get a task thread.

### Variations / Edge cases
- Because Project bot is also the general assistant, a delegated task would mix with the project chat; the real design needs a rule (separate thread per task, as for Research/Writer).
- The #151 card now shows a P avatar; in the timeline the bar gets a P avatar after the bar end.

---

## DELEGATE-TO-BOTS-OWNERSHIP-04: Who is accountable vs who is doing it
**Type**: medium  **Persona**: Priya, ops lead, reviews her team's load before a Monday check-in  **Goal**: Tell the Owner (accountable) from the Assignee (working) for bot-held tasks, and filter each way  
**Preconditions**: Default state, Board view  
**README stories**: S29, S30, S10  
**Ideal path**: 6 steps. There is no separate Owner filter, so this is the shortest route that surfaces both.  
**Alternate paths**: "Group by assignee" shows assignees only (bot lanes) and does not show owners.

### Steps
1. Click "Press kit" → drawer shows Owner "Ada Park" above Assignee "Writer · working on it". Priya understands: Ada answers for it, Writer does it.
2. Close the drawer (Escape).
3. Open the select "Filter by person or bot" → groups "People" (Ada Park ... Eli Brandt) and "Bots" (Project bot, Research, Writer).
4. Pick "Ada Park" → board shows 8 cards, including bot-held ones (Press kit, Post-launch survey, Landing page design).
5. Pick "Cy Novak" → only "Onboarding emails". Priya expected ENG-31 "Landing page design" too (Cy is its Linear assignee).
6. Pick "Writer" → "Press kit", "Post-launch survey".

### Walk result
1. OK: Owner is above Assignee with avatars, matching S29.
2. OK: Escape closes the drawer.
3. OK: select and optgroups exist.
4. CONFUSING: the filter matches owner or assignee, so Ada's list mixes tasks she owns with tasks she is doing; the card shows only the assignee. A reader cannot tell why a card with a W avatar appears under Ada. S29 asks for an owner filter.
5. CONFUSING: ENG-31 is hidden from Cy because the bot holds it (`fOk` ignores a person's assignee when a bot is set). Cy's real Linear assignment disappears from his own view.
6. OK: the bot filter matches only bot-held tasks.

### Variations / Edge cases
- Owner is never visible on cards or in the timeline, only in the drawer.
- Owner and Assignee are plain text, not editable; there is no way to change owner.

---

## DELEGATE-TO-BOTS-OWNERSHIP-05: Take a task back from a bot
**Type**: medium  **Persona**: Tomas, PM, sent the wrong task to Research and wants it back  **Goal**: Undo a bot assignment (or hand it to a person)  
**Preconditions**: Default state; ENG-31 "Landing page design" is already with Research  
**README stories**: S30  
**Ideal path**: 4 steps if an "Unassign" item existed in the "Send to bot" menu. Today: none found.  
**Alternate paths**: none found. The "Suggestion" card cannot do it, and the Assignee row is text.

### Steps
1. Click "Landing page design" → Assignee "Research · working on it", Owner "Ada Park".
2. Tomas looks for "Unassign" or a person dropdown on the Assignee row → none.
3. Click "Send to bot" → menu shows only the three bots.
4. Click "Writer" → Assignee becomes Writer; toast "Sent to Writer". Click Send to bot, Writer again → toast "Sent to Writer" again, no change.

### Walk result
1. OK: drawer shows the bot row.
2. MISSING: drawer buttons are `Send to bot | Project bot | Research | Writer | Open in Linear | Open thread | blockers` only. Assignee is not editable.
3. MISSING: no "Unassign", "Cancel", or "Assign to <person>" entry; the current bot is not marked.
4. CONFUSING: only a swap to another bot is possible; re-sending to the same bot reports success with no change. The tracker's own assignee (Cy Novak) is never shown again, so Tomas cannot tell who the task goes back to.

### Variations / Edge cases
- Dragging a card between columns does not change the bot (status only).
- No "done" state: a bot task never leaves "working on it".

---

## DELEGATE-TO-BOTS-OWNERSHIP-06: Delegating in a read-only connection
**Type**: medium  **Persona**: Hana, cautious CTO, connected GitHub as "Read only"  **Goal**: Understand what she can and cannot do with bots when the tracker is read-only  
**Preconditions**: Mockup states menu: toggle "Read-only" on  
**README stories**: S24, S30, S23  
**Ideal path**: 6 steps.  
**Alternate paths**: Connect flow "Access: Read only" sets the same mode (needs the "Connect source" state).

### Steps
1. Open "Mockup states", tick "Read-only" → header badge "Read-only" with a lock.
2. Try to drag "Signup API" (#142) to another column → the card does not move (draggable is off); no tooltip explains it.
3. Click "Signup API" → drawer opens; click "Send to bot", then "Research".
4. Toast "Sent to Research"; Assignee row "Research · working on it". Hana thinks: "I said read only; did it write to GitHub?"
5. Click "Open thread" → thread shows "Signup API", "Working on it", "Open in GitHub".
6. Close, click "Ask bot" → the Project bot thread still shows the "Change status" card for #142 with "Approve" and "Reject".

### Walk result
1. OK: badge text `Read-only`.
2. CONFUSING: GitHub card `draggable` is null, native cards remain true. No explanation (README S24 requires a tooltip).
3. OK: Send to bot works and is not blocked.
4. OK in behaviour (bot assignment is Rakazo-side per S30), but MISSING reassurance. This is a fine design if the row says it stays in Rakazo; today it does not.
5. OK: thread text `Signup API Working on it Signup API #142 Open in GitHub`.
6. CONTRADICTS-PLAN: `Change status ... Approve` is shown (count 1 each) in read-only mode; S24 removes the bot's status change.

### Variations / Edge cases
- A bot working a read-only task can never write status back; the thread would need to say so.
- Hover over the lock badge: nothing.

---

## DELEGATE-TO-BOTS-OWNERSHIP-07: Plan the week by lane and timeline, delegating as you go
**Type**: long  **Persona**: Lena, project manager at a 30-person agency, planning the launch  **Goal**: See who (human or bot) holds what on Board and Timeline, hand off the support runbook, and verify the effect in every view  
**Preconditions**: Default state, 1360x860, nothing connected-off  
**README stories**: S10, S12, S29, S30, S28  
**Ideal path**: 14 steps. Delegation is only possible via the drawer; views update immediately.  
**Alternate paths**: "Filter by person or bot" can replace "Group by assignee" for one bot's tasks.

### Steps
1. Click "Group by assignee" → lanes: Ada Park 2, Bo Reyes 3, Cy Novak 2, Di Okafor 2, Eli Brandt 1, Research 1, Writer 2, Unassigned 1 (bots after people, with avatars).
2. Scan the Writer lane → "Press kit", "Post-launch survey". Lena thinks: "Writer already has two; fine."
3. Click the card "Support runbook" (PL-12, native, assignee C) → drawer.
4. Click "Send to bot", choose "Writer" → toast "Sent to Writer".
5. Click the scrim → board returns.
6. Check lanes → Cy Novak 1, Writer 3; the card moved lane. 
7. Pick "Writer" in "Filter by person or bot" → "Press kit", "Post-launch survey", "Support runbook" (group lanes with only the Writer lane).
8. Click "Timeline" → rows: "Press kit" with a W avatar in the label and at the end of the bar; "Post-launch survey" in the Unscheduled lane as a chip with a W avatar.
9. Reset the filter to "Everyone". Click the row label "Support runbook" → drawer opens.
10. Click "Send to bot" → "Research" → toast "Sent to Research"; the row now shows an R avatar and an R at the bar end.
11. Click the scrim. Click the chip "Post-launch survey" → drawer: Assignee "Writer · working on it", Dates "Unscheduled".
12. Click "Open thread" → panel opens on Writer's thread.
13. Click the X, then "Ask bot" → Project bot thread.
14. Click the citation chip "ENG-31" or "#145" → task drawer opens on top of the panel; Owner/Assignee visible.
15. Press Escape, then "Board", then "Group by assignee" off → back to the board with bot avatars on cards.

### Walk result
1. OK: lane text `A Ada Park 2 | B Bo Reyes 3 | C Cy Novak 2 | D Di Okafor 2 | E Eli Brandt 1 | R Research 1 | W Writer 2 | ? Unassigned 1`.
2. OK: Writer lane has the 2 seed tasks.
3. OK: drawer opens.
4. OK: toast shown.
5. OK: scrim click closes.
6. OK: lanes become `C Cy Novak 1` and `W Writer 3`. CONFUSING: Eli's lane has 1 only because "Post-launch survey" (Eli's) is in Writer's lane; nothing tells Lena that Eli's task is hidden behind a bot.
7. OK: Writer filter returns Press kit and Post-launch survey (Support runbook once sent).
8. OK: screenshot s8-timeline-writer shows the W avatar on the row, the bar end and the chip. CONFUSING: the avatar appears twice per row (label right and bar end); redundant.
9. OK: row labels are clickable (`.tl-l[data-open]`).
10. OK: row avatar count 1, bar-end avatars 3 after the send (screenshot s8-timeline-research). Note a bot avatar at a bar end overlaps nothing but sits where the dependency arrow leaves the bar for "Press kit".
11. OK: drawer text `Assignee W Writer · working on it ... Dates Unscheduled`.
12. OK: opens the Writer thread.
13. CONFUSING: "Ask bot" is hidden while any thread is open, so the user must close the panel first; no way to switch between Project bot, Research and Writer threads inside the panel (nav bot rows are inert).
14. Not exercised in this walk; discovery.md records that citation chips open the drawer over the open panel.
15. Not exercised; board and group toggles were exercised in steps 1 to 7. No console errors in any walk.

### Variations / Edge cases
- Send a task that is blocked: the "Blocked" marker remains; a bot works on a blocked task and nothing warns.
- Over the WIP limit of "In progress" 3 / 2: bots do not count differently; no signal.
- Dragging the bar of a bot-held task moves dates with no "ask the bot first" step.

---

## DELEGATE-TO-BOTS-OWNERSHIP-08: Delegate from a phone-width screen
**Type**: short  **Persona**: Sam, designer, triaging on a narrow window  **Goal**: Send a task to Writer and open its thread at 390 px  
**Preconditions**: 390x844 viewport, default state  
**README stories**: S30  
**Ideal path**: 4 steps.  
**Alternate paths**: none found.

### Steps
1. Tap "Partner outreach list" → drawer fills the screen.
2. Tap "Send to bot", choose "Writer" → toast "Sent to Writer"; row "Writer · working on it" with "Open thread" wrapping to two lines.
3. Tap "Open thread" → full-screen "Writer" panel, task as user message, "Working on it" card with "PL-16".
4. Tap the X → back to the board.

### Walk result
1. OK: screenshot m1-drawer.
2. CONFUSING (minor): "Open thread" wraps and "working on it" wraps (screenshot m3-sent); the drawer's "Suggestion: Assign to Cy Novak" remains below.
3. OK: panel is full screen (screenshot m4-thread); the toast overlaps the composer.
4. OK: `#closeBot` is visible and works.

### Variations / Edge cases
- The left nav is hidden under 900 px, so there is no bot row to fall back to.

---

## Findings

Ranked. "Mockup-only" means fine for a mockup; "ships" means a real design problem that would reach users.

1. **High, 05 (ships).** There is no way to undo or change a bot assignment other than swapping bots. No "Unassign", no "Assign to <person>", the current bot is not marked, and the tracker's real assignee is never shown again. Fix: add "Unassign" (and a person picker) to the "Send to bot" menu, mark the current bot, and show "Linear assignee: Cy Novak" under the bot row so the fallback is visible.
2. **High, 03 (ships).** "Open thread" for the Project bot opens the generic canned conversation instead of a task thread, contradicting S30. Fix: give every send its own task thread for all three bots (including Project bot), or say in the README that Project bot assignment opens the shared panel and show the task as a pinned message there.
3. **High, 06 (ships, README contradiction).** In read-only mode the Project bot panel still shows the "Change status" approval card with Approve/Reject for #142 (S24). Also no tooltip on locked drag. Fix: in read-only, drop the card and render it as a "Suggestion" with "Open in GitHub"; add the lock-drag tooltip.
4. **Med, 01 (ships).** The drawer's "Suggestion: Assign to Cy Novak" still shows beside "Research · working on it" because the card keys off `t.a`, which is empty or stale when a bot holds the task. Fix: suppress assignee suggestions when a bot is assigned (mockup bug that would become a logic bug).
5. **Med, 02 and 03 (ships).** "Working on it" never progresses: no progress, result, finished state, or follow-up input in the thread. Fix: show a thread with a status line ("Working", "Needs you", "Done") and a reply composer; clear "working on it" when done.
6. **Med, 04 (ships).** "Filter by person or bot" merges owner and assignee, hides Cy's ENG-31 when a bot holds it, and Ada's list mixes owned and assigned tasks. Fix: two controls (Owner, Assignee) as S29 asks, or label matches ("Owner" / "Assignee") on cards; show Owner on cards or on hover.
7. **Med, 07 (ships).** Bot avatars are duplicated in the timeline (row label and bar end) and the bar-end avatar sits on the dependency arrow exit. Fix: keep one avatar (row label), drop the bar-end copy.
8. **Med, 07 (ships).** "Ask bot" is hidden while a thread is open and there is no switcher among Project bot, Research and Writer threads; the left nav bot rows look clickable but do nothing. Fix: add a bot switcher in the panel header, or wire the nav rows to open their bot's latest thread.
9. **Low, 01 (ships).** The "Send to bot" menu lists bots with no role or capability line. Fix: one short subtitle per bot only if it can be revealed on hover (README copy rule); otherwise accept.
10. **Low, 03 and 06 (ships).** Nothing says the tracker's assignee is unchanged when a bot is assigned (S30). Fix: show the tracker assignee on the bot row after hover or in a tooltip.
11. **Low, 05 (mockup-only).** Re-sending to the same bot toasts "Sent to Writer" with no change. Fix in the real product: disable the current bot's menu item.
12. **Low, 08 (mockup-only).** At 390 px "Open thread" and "working on it" wrap and the toast overlaps the composer. Fix: stack the Assignee value and the button on separate lines.
13. **Low, 02 (mockup-only).** Notion tasks show "Page" in the thread's citation chip instead of a name; two Notion tasks look identical. Already in discovery mismatch 13.
