P0: 0, P1: 1, P2: 9, P3: 12

# Iteration 13 problems: fix clusters

Sources: R1-R3 (verify pass-12 clusters C1-C26), J1-J3 (journeys; J3 at 375 px with touch emulation), FLOW, V1-V3, all on the mock demo stack (web 5381). Findings were deduplicated and clustered by root cause; 'found by' lists the walkers who saw the same defect. Iterations 1-12 problems, docs/ux-flow and docs/ux-visual were checked; a pass-12 cluster whose criteria are not met appears as a new cluster with a 'Reopens' line. Rank: P0 first, then severity x reach / effort.

Owner decisions respected and not re-raised: tour stays nine stops; the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Legal row actions Ask agent / Done / Dismiss; approval toasts persist, bottom-right; Settings in five sections with Memory under Advanced; no model step in onboarding on the demo; Carta-only agent for cap table; one SAFE list for Investors and Fundraising; Hide amounts hides money in app UI only.

Environment caveats: the demo was shared by about ten walkers, so counts, 'New Bot' rows, toasts and load times changed under everyone; the dev server serves unbundled modules, so load-time findings are deferred. No walker could use a coarse pointer except J3 and V1, so touch targets are only checked there (no failures). Storybook smoke was BLOCKED (worktree has no node_modules).

Pass-12 clusters met on this pass (no new cluster): C3 One SAFE list, C4 Chief to-do count, C6 Finance phone, C7 Legal Contracts, C11 Data room selection, C13 Draft reply, C15 Privacy vs behaviour, C19 Legal copy, C21 Activity, C25 Labels and menus, chat consent decision; C9, C10, C12, C16, C18, C20, C22, C23, C24, C26 are partly met and only their residuals are filed.

Severity calls: one P1. R1-01 and J2-01 are one defect seen on two users; a payment approval that the bot calls a failed run is the only item where a human could act wrongly on a core journey (retry creates a second request). R1-03 is P2, not P1: only code evidence, no live failure. V1-04 and V1-06 (reported P2) are P3: copy and control consistency with nothing misleading. V2-02 (reported P2) is P3: only a constant balance triggers it. V2-05 (P2 perf, one 15 s wait on the dev server) and V1-01 (P2 perf) are deferred. No P0: no money moved wrongly and no data was lost.

## Fix clusters, ranked

### C1 [P1] A bot that delegates a payment shows 'could not finish' and 'Last run failed' while the approval is live in the other agent; Chief answers with a placeholder relay
- Rank: 1. Effort: L. Reopens: Pass-12 C1 (criteria 3, 4, 5 not met; 1-2 unverified).
- Finding ids (found by): R1-01, R1-02, J2-01, J1-03. Found by: R1-01 (R1, J2-01 (same symptom, seen by J2)); R1-02 (R1, J1-03 (Chief shows only the delegation sentence on the scripted model))
- Root cause: The originating bot's run ends with tool work and no final text after it messages the Mercury agent. threadRunError suppresses the failure banner only when this thread has a waiting_input run (user-error.ts:~190), but the approval lives in the Mercury agent's thread, so the originating thread sees a failed run. The stale 'Last run failed' line then stays after the approval is denied. The same relay path posts an interim 'I've asked the Inbox agent...' message and a second bubble with the answer, or only the placeholder (Chief).
- Verification: Observed by R1 and J2 on separate users (P1 in both). Cause partly traced: packages/core/src/user-error.ts threadRunError checks snapshot.activeRuns of the same thread only; run end without final text at packages/adapters/src/pi-runtime.ts:626 is per J2, not re-read. Relay replacement in executor.ts suspected, not traced. J1-03 is on the scripted demo model and unverified with a real model.
- Files:
  - packages/core/src/user-error.ts (threadRunError: treat a run that handed work to another agent whose approval is pending as waiting; clear the banner once the delegate answers or denies)
  - packages/adapters/src/executor.ts and packages/adapters/src/pi-runtime.ts:~626 (mark the originating run as waiting on the delegate; expire the delegate's approval if the run really fails and say nothing was sent; replace the interim relay message with the final one)
  - packages/adapters/src/executor-approval-replay.test.ts (regressions below)
  - apps/web chat composer error/Retry (hide Retry while the delegate is pending)
- Reach: Anyone who lets a bot move money through the Mercury agent; Chief users on any delegated question.
- Acceptance criteria:
  - Ask a bot to pay $300: while the Mercury approval card is live, the bot's composer says 'Waiting for approval', no red 'could not finish', no Retry; the same after reload.
  - Deny the card: the bot's thread shows the answer and no 'Last run failed' line.
  - If the originating run truly fails after an approval exists, that approval reads 'No longer active' and the error says nothing was sent.
  - A delegated request produces one outcome message in the requester's thread (the interim relay line is replaced by the final answer; the sidebar preview shows the final text).
  - Regression test in executor-approval-replay.test.ts and one in user-error tests for the cross-thread waiting case.
- Needs product decision: false
- Depends on: none
- Conflicts with: C20 only if both edit apps/web roster-status/composer labels

### C2 [P2] Open in composer after a failed send still needs a connection id, so the way forward is missing
- Rank: 2. Effort: S. Reopens: Pass-12 C2.
- Finding ids (found by): R1-03. Found by: R1-03 (R1)
- Root cause: MailApprovalCard.tsx:~479 renders 'Open in composer' only when onOpenComposer and mail.connectionId are both set, and EmailAgentPanel.tsx passes neither. A failed send in the email agent panel therefore has no recovery button. Not reproduced live (needs a failing send).
- Verification: Suspected: gating condition read in code at MailApprovalCard.tsx:479-481; EmailAgentPanel.tsx has no reference to onOpenComposer. Severity P2 here (was P1 in pass 12) because the effect was not seen on screen.
- Files:
  - apps/web/src/components/MailApprovalCard.tsx (show the button for every failed send; fall back to the thread's account when connectionId is missing)
  - apps/web/src/components/inbox/EmailAgentPanel.tsx (pass onOpenComposer)
  - apps/web/src/components/MailApprovalCard.test.tsx
- Reach: Anyone whose agent-drafted reply fails to send.
- Acceptance criteria:
  - A failed send in the email agent panel shows 'Open in composer'; clicking it opens the composer with the draft and the right account.
  - Unit test: failed outcome without connectionId still renders the button.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C4 [P2] First-run tour opens while the second connect card is unanswered; on a phone the first stop focuses Search and raises the keyboard
- Rank: 3. Effort: S.
- Finding ids (found by): J1-01, J3-02. Found by: J1-01 (J1); J3-02 (J3)
- Root cause: Shell.tsx:~2745 connectCardsWaiting holds the tour only until one app is connected, so connecting Gmail starts nine popovers while the Google Calendar card is still open (J1-01). Separately, on first phone sign-in the drawer opens with focus in Search (tour step 1 targets Search), which on a real phone raises the keyboard and the callout covers the Inbox and Finance rows (J3-02, keyboard part suspected).
- Verification: J1-01 observed, cause read in code (Shell.tsx:2744-2755: tourOpen requires !connectCardsWaiting, defined by connectCardsOpen). J3-02 ring and overlap observed; keyboard effect suspected. Severity P2 (reported P2 by both).
- Files:
  - apps/web/src/pages/Shell.tsx (tourOpen / connectCardsWaiting: hold until every connect card is connected or dismissed, or until the first question is sent)
  - apps/web/src/components/tour/FirstRunTour.tsx and the drawer-open effect (do not focus Search on touch when the tour starts)
  - apps/web/src/components/tour/*.test.tsx
- Reach: Every new user who connects an app from Chief's cards; every first sign-in on a phone.
- Acceptance criteria:
  - After connecting Gmail with the Calendar card still open, no tour popover appears; it starts once all connect cards are done or dismissed.
  - At 375 px with touch emulation, the first tour step leaves document.activeElement outside any text input.
- Needs product decision: false
- Depends on: none
- Conflicts with: C11 (same tour files; do C4 first or in one branch)

### C5 [P2] Routines panel still shows an empty 'Chief's computer' heading and blank area; header icon is a monitor
- Rank: 4. Effort: S. Reopens: Pass-12 C17.
- Finding ids (found by): R1-04, R2-13-01, V1-05. Found by: R1-04 (R1, R2-13-01, V1-05 (also in pass 12 as C17))
- Root cause: Shell.tsx:3872-3878 noComputerScreen is true only for computer states running, stopped or none. The demo computer is in another state, so the heading at ~6180 and an empty box render. The header button keeps the Monitor icon (~5788) and reads 'Computer and routines'.
- Verification: Verified in code: the noComputerScreen condition lists three states only. Seen on screen by R1, R2 and V1 (three walkers). Which state the demo computer is in was not read.
- Files:
  - apps/web/src/pages/Shell.tsx (noComputerScreen: true whenever there is no embedded screen, no error, not open; Routines button icon: clock/repeat, label 'Routines')
  - apps/web/src/pages/Shell.test.tsx
- Reach: Every user who opens Routines on a bot whose computer is not running.
- Acceptance criteria:
  - Routines panel in any computer state without a screen shows no 'computer' heading and no blank block; at 1440 the panel has no dead band over 100 px.
  - Header button shows a clock or repeat icon, not a monitor, when it opens Routines only.
  - Unit test covering a computer in a non-listed state.
- Needs product decision: false
- Depends on: none
- Conflicts with: C20 if it edits Shell.tsx header labels

### C6 [P2] Settings > Models: 'In use' on OpenRouter beside 'OpenAI: GPT-6 Luna', a flash of the advanced layout, two names for one idea
- Rank: 5. Effort: M. Reopens: Pass-12 C14.
- Finding ids (found by): R1-05, R2-13-02, V1-02, V1-03. Found by: R1-05 (R1, R2-13-02, V1-03a); V1-02 (V1); V1-03 (V1 (b: Use my own model then Use your own key))
- Root cause: The model label comes from the catalog entry for the default provider and model (ModelSettingsOverlay.tsx:375-379, label 'OpenAI: GPT-6 Luna'), while 'In use' comes from defaultProvider (openrouter) at :305-316. They describe one route with two names. Also the embedded view paints the full advanced layout while `me` loads (:1650 simple is false) and 'Use my own model' opens a panel with a second disclosure 'Use your own key'. On a phone the 'Your bots use ...' line shows above and below the list (:1276-1281, min-[1040px]:hidden only hides one).
- Verification: Seen by R1, R2, V1 (three walkers; reported on the demo where the system model goes through OpenRouter). Code lines read. The flash is observed once at 0.2-0.6 s polling.
- Files:
  - apps/web/src/pages/ModelSettingsOverlay.tsx (derive 'In use' and the label from one value, e.g. 'GPT-6 Luna via OpenRouter'; show 'In use' only for a connected provider, 'Included' for the system model; render nothing or one skeleton line while `me` loads; open the key form directly after 'Use my own model'; one copy of the 'Your bots use' line on a phone)
  - apps/web/src/pages/ModelSettingsOverlay.test.tsx
- Reach: Anyone who opens Settings > Models.
- Acceptance criteria:
  - With the system model, no provider row says 'In use' unless it is connected, and the text names the model once.
  - Opening Models shows no intermediate advanced layout; at 375 px the 'Your bots use' line appears once.
  - 'Use my own model' opens the key form in one step.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C7 [P2] Finance: Breakdown card stretches to the height of the Upcoming + Subscriptions column, and recurring vendors appear in two cards
- Rank: 6. Effort: S. Reopens: Pass-12 C23 (residual).
- Finding ids (found by): V2-01, FLOW-04. Found by: V2-01 (V2, R3-13-02, FLOW-04 (first half)); FLOW-04 (FLOW (second half: recurring duplicated))
- Root cause: Finance.tsx:682 uses `grid gap-3 @3xl:grid-cols-2` without items-start, so Breakdown stretches to the right column: 290-480 px of empty card at 1440 and 330 px at 1920. Upcoming rows tagged 'recurring' repeat the vendors listed under Subscriptions.
- Verification: Observed by V2, R3 and FLOW (three walkers). Grid class read at Finance.tsx:682; the exact child that stretches was not traced further.
- Files:
  - apps/web/src/pages/Finance.tsx (self-start / items-start on the Breakdown card, or move Subscriptions under both columns)
  - apps/web/src/pages/Finance.tsx upcoming row (drop the 'recurring' chip where Subscriptions lists the same vendor)
- Reach: All Finance users on a desktop.
- Acceptance criteria:
  - At 1440 and 1920 the Breakdown card height is within 40 px of its last row.
  - A recurring vendor is listed once as a charge (Upcoming) and once as a subscription only if the two cards show different information.
- Needs product decision: false
- Depends on: none
- Conflicts with: C12 (same file)

### C8 [P2] Slow actions give no immediate feedback: routine Test run, Legal Done, Inbox send
- Rank: 7. Effort: M.
- Finding ids (found by): J2-02, J2-03, J1-05. Found by: J2-02 (J2); J2-03 (J2); J1-05 (J1)
- Root cause: J2-02: after Test run the button stays 'Test run' and Run history says 'No runs yet' for about 20 s, so a second click is easy (the `running` prop at RoutineEditor.tsx:334,430 does not turn true on click). J2-03: Legal Done greys out and nothing else changes for about 10 s before the row leaves (possibly load on the shared stack). J1-05: after the Undo window the send pill reads 'Sending...' about 6 s with no way to cancel (emulator).
- Verification: Observed once each, on a shared, loaded stack. J2-02 cause read in code (running prop not set on click); J2-03 and J1-05 not traced and may partly be load. Severity P2 for Test run (double run), P3 for the other two.
- Files:
  - apps/web/src/pages/RoutineEditor.tsx and its parent (set running true on click until the run row reports done)
  - apps/web/src/pages/legal/LegalDeadlines.tsx (remove row optimistically with Undo, or show a spinner on the button)
  - apps/web inbox send pill (show Sent when the provider accepts)
- Reach: Routine authors; Legal users.
- Acceptance criteria:
  - After clicking Test run the button reads 'Running...' and is disabled within 300 ms and Run history shows a Running row.
  - Done removes the row (or shows a spinner) within 300 ms.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C9 [P2] Approval toast is clipped on a phone and covers page content beside a docked agent panel
- Rank: 8. Effort: S. Reopens: Pass-12 C9 (residual).
- Finding ids (found by): J3-01, R3-13-04. Found by: J3-01 (J3); R3-13-04 (R3 (pass-12 C9 residual))
- Root cause: J3-01: the toast wrapper is 118 px tall while its button content is 156 px, so the last body line is cut at the card edge (stale height measurement, suspected). R3-13-04: the persistent toast covers the Breakdown rows beside the open Finance agent panel. Toast position (persistent, bottom-right) is decided, so only the clipping and the offset against a docked panel are in scope.
- Verification: J3-01 observed with DOM sizes (343x118 vs 341x156); cause suspected in packages/ui-web/src/components/ui/notification-toaster.tsx (~220-316), not traced. R3-13-04 seen once.
- Files:
  - packages/ui-web/src/components/ui/notification-toaster.tsx (ResizeObserver on the toast button so the front height follows its content)
  - apps/web/src/pages/Shell.tsx toast host offset when a right panel is docked
- Reach: Anyone with an approval toast on a phone.
- Acceptance criteria:
  - At 375 px every line of a 4-line approval toast is visible (wrapper height >= content height).
  - With a docked right panel at 1440 the toast does not overlap the panel or the page content columns.
- Needs product decision: false
- Depends on: none
- Conflicts with: C11 none

### C10 [P2] Data room: clicking a folder with the preview pane open can leave the list unfiltered
- Rank: 9. Effort: S.
- Finding ids (found by): V3-01. Found by: V3-01 (V3)
- Root cause: With the preview open, clicking the Contracts folder changed breadcrumb and URL but the list kept showing all items, even after 3 s; reload fixed it. Two later folder clicks worked. Cause not found; suspected stale query while the preview is open.
- Verification: Observed once, not reproduced. Severity P2 (wrong list shown, no data loss) pending a repro; implementer should write the failing test first.
- Files:
  - apps/web/src/pages/DataRoom.tsx (refetch or derive the list from the folder param regardless of preview state)
  - apps/web/src/pages/DataRoom.test.tsx
- Reach: Data room users who preview a file and then change folder.
- Acceptance criteria:
  - Open a file preview, click a different folder: the list shows only that folder's items within 1 s, 10 of 10 tries.
  - Regression test for folder change with the preview open.
- Needs product decision: false
- Depends on: none
- Conflicts with: C13 (same page)

### C3 [P2] Investors: 'Equity raised' counts a SAFE that is only Sent, 'New update' can be clicked several times, empty cards look like stuck loaders, first visit can show a dash
- Rank: 10. Effort: M. Reopens: Pass-12 C3 (SAFE list is one; this is a remaining definition question).
- Finding ids (found by): J2-note-raised, J2-note-newupdate, J2-note-ghost, R1-09. Found by: J2-note-raised (J2 notes for the Investors owner); J2-note-newupdate (J2 notes); J2-note-ghost (J2 notes, V3 notes (UpdateRowPlaceholder)); R1-09 (R1)
- Root cause: Three small causes on one page. (1) packages/core/src/safes.ts countedSafes counts sent, signed and funded SAFEs, so Equity raised $300,000 includes Harbor Angels $50,000 (Sent) while Fundraising lists it as Sent and only Quill $250,000 as Funded. (2) startUpdate in Investors.tsx has no in-flight guard, so three clicks created three drafts (J2). (3) UpdateRowPlaceholder renders two grey ghost rows with no words when the list is empty. (4) R1 saw a dash for Equity raised on the first visit once (not reproduced).
- Verification: Observed on screen (J2, V3, R1). Code: safes.ts countedSafes comment says sent, signed or funded count by design; startUpdate at Investors.tsx:~683 has no pending state; UpdateRowPlaceholder used at Investors.tsx:412-413. R1-09 not reproduced. Another session owns the Investors/Fundraising pages; coordinate before editing.
- Files:
  - packages/core/src/safes.ts and apps/web/src/pages/Investors.tsx Summary (label or definition of 'Equity raised')
  - apps/web/src/pages/Investors.tsx (disable New update while the save runs; replace UpdateRowPlaceholder with one line when empty; retry the SAFE request once before showing a dash)
  - apps/web/src/pages/Investors.test.tsx
- Reach: Founders quoting raised capital to a board; anyone who double-clicks New update.
- Acceptance criteria:
  - The headline figure matches the owner's chosen definition and Fundraising's statuses (no Sent SAFE counted as raised, or the label says 'committed').
  - Three quick clicks on New update create exactly one draft.
  - An empty Updates card shows a short sentence, not grey bars.
  - First visit never shows a dash for a successful SAFE list.
- Needs product decision: true (Should 'Equity raised' count only Funded SAFEs (Sent and Signed shown separately as 'committed'), or keep counting Sent, Signed and Funded under a clearer label?)
- Depends on: none
- Conflicts with: Another session owns Investors.tsx; avoid editing at the same time

### C11 [P3] First-run tour card sits far from the item it explains
- Rank: 11. Effort: M. Reopens: Pass-12 C20 (residual).
- Finding ids (found by): FLOW-01, V1-08, J1-02, R1-08, R2-13-03. Found by: FLOW-01 (FLOW, V1-08, J1-02); R1-08 (R1, R2-13-03 (overlap with content))
- Root cause: TourPopover.tsx:171-186 pins the card to the foot of the sidebar column on desktop so Next stays put; for Search, +, Inbox, Finance and Legal the ring is 500-700 px away (card also covers chat text at stops 3-9 and the approval Send/Discard at stop 9). On phone the card sits next to the target. Deliberate trade-off, repeated by five walkers.
- Verification: Observed by five walkers; the placement is deliberate per code comment. Pass-12 C20 made it docked bottom-left (verified in R2); this is the residual. Tour length (nine stops) is decided and not touched.
- Files:
  - apps/web/src/components/tour/TourPopover.tsx
  - apps/web/src/components/tour/FirstRunTour.tsx
- Reach: Every new user on a desktop.
- Acceptance criteria:
  - Each card names its target in its first words, or a connector line links the card to the ring.
  - At no stop does the card hide a chat message, the Data room names or an approval card's Send/Discard.
- Needs product decision: true (Keep the fixed spot where Next never moves and add the target name or a connector, or place the card beside the ring on desktop (Next then moves)?)
- Depends on: C4
- Conflicts with: C4 (same tour files)

### C12 [P3] Finance charts and figures: flat balance chart, floating Financing marker, cents in Yield, burn versus spent labels, tiny links
- Rank: 12. Effort: M.
- Finding ids (found by): V2-02, V2-03, V2-10, J1-06, V2-09. Found by: V2-02 (V2); V2-03 (V2, R3 (Financing marker beside the top gridline)); V2-10 (V2); J1-06 (J1); V2-09 (V2)
- Root cause: Separate small defects in finance components: a constant balance draws on the x axis with 140 px of empty chart (charts.tsx ~40); the $250k Financing marker floats above the $150k gridline (charts.tsx ~379); the Yield table prints cents while all else is whole dollars; 'Monthly burn $67,621 (3-mo avg)' sits beside '$20,484 Spent so far this month'; 'Show all N' and 'Burn' links are 16 px high.
- Verification: All observed once on desktop; V2-09 measured at fine pointer (the 44 px touch rule is decided, this is the 24 px desktop minimum). V2-02 could be P2; kept P3 because only an unchanging balance triggers it.
- Files:
  - apps/web/src/components/finance/charts.tsx
  - apps/web/src/pages/finance/FinanceAccounts.tsx (whole-dollar formatter)
  - apps/web/src/pages/Finance.tsx and apps/web/src/components/finance/ui.tsx (labels; py-1 on links)
- Reach: Finance users.
- Acceptance criteria:
  - A flat balance line sits mid-chart or collapses to one line of text.
  - The Financing marker lies on the plotted axis.
  - Yield amounts use the shared whole-dollar format.
  - Second figure reads 'Out so far this month'; 'burn' names only the average.
  - Show all and Burn links are at least 24 px high.
- Needs product decision: false
- Depends on: C7
- Conflicts with: C7 (same files)

### C13 [P3] Data room and Contacts tables: Status column appears and disappears, bare dashes, wide empty bands at 1920, small details
- Rank: 13. Effort: M. Reopens: Pass-12 C10, C18, C23 (residuals).
- Finding ids (found by): R2-13-04, R2-13-05, V3-03, R1-07, R1-06, V3-04. Found by: V3-03 (V3, R1-07 (conflicts with R3 on Contacts)); R2-13-04 (R2); R2-13-05 (R2); R1-06 (R1); V3-04 (V3)
- Root cause: Table layout details. Entering a folder drops the Status column so Type and Added shift by 80 px (ItemRows.tsx showStatus); failed rows show a bare dash in Type and Parties; at 1920 Name takes about 700 px with Type far right and Status empty except one row (R1 saw 350-430 px bands in Contacts and Data room, R3 found Contacts filling the page, so the report conflicts); phone first-row top is 166 px (target under 160); Stats bars have almost no labels.
- Verification: Each observed once. R1-07 versus R3 C23 PASS conflict on Contacts at 1920; the implementer measures first.
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx
  - apps/web/src/pages/DataRoom.tsx (header padding, Name width, stats labels)
  - apps/web/src/pages/Contacts.tsx
- Reach: Data room and Contacts users.
- Acceptance criteria:
  - Status column stays in every folder view or is absent everywhere; header columns do not move on folder entry.
  - Failed rows show no bare dash.
  - At 1920 the gap between Name text and Type is under 250 px.
  - At 375 the first file row top is under 160 px.
  - Stats bars show a value on hover.
- Needs product decision: false
- Depends on: none
- Conflicts with: C10 (DataRoom.tsx)

### C14 [P3] Legal polish: Scan result shifts the tabs, empty Status column, 11 px graph labels, long phone cards, plain empty state
- Rank: 14. Effort: M. Reopens: Pass-12 C19 (residual).
- Finding ids (found by): R2-13-06, V2-04, V2-07, V2-08, FLOW-07. Found by: R2-13-06 (R2); V2-04 (V2); V2-07 (V2); V2-08 (V2); FLOW-07 (FLOW)
- Root cause: Scan now result line appears above the tabs and moves them down 32 px (Legal.tsx); Status column reserves 75 px while 10 of 11 rows are empty (Legal.test.tsx:898 hides it only if all rows are active); Graph text is 11 px; on a phone each contract is a 185 px card of five rows including empty ones; fresh Legal is plain text while Inbox and Finance use a titled empty state.
- Verification: All observed once.
- Files:
  - apps/web/src/pages/Legal.tsx
  - apps/web/src/pages/legal/* (contracts table, mobile list, graph)
  - shared empty-state component used by Inbox and Finance
- Reach: Legal users.
- Acceptance criteria:
  - Tabs keep their y position before, during and after Scan now.
  - Status column shows only when two or more rows have a non-default status.
  - Graph node labels are 12 px or more.
  - Phone cards omit empty rows.
  - Legal with no contracts shows a titled empty state like Inbox.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C15 [P3] Inbox polish: unread count changes on expand, row focus ring, dialog jump and sizes, hover actions, compose draft copy
- Rank: 15. Effort: M.
- Finding ids (found by): J1-04, V2-11, V2-12, V2-13, J2-04. Found by: J1-04 (J1); V2-11 (V2); V2-12 (V2); V2-13 (V2); J2-04 (J2)
- Root cause: Needs reply header counts unread among visible rows (4) and then 7 after Show more while the sidebar says 13; focused rows get the browser default outline, not the 3 px ring; opening the agent panel moves the thread dialog 190 px left; a 3-row CSV opens a 750 px dialog; hover actions are 2 for unsorted and 4 for sorted rows; closing a compose with only attachments says 'Your text is saved as a draft'.
- Verification: All observed once. Focus ring part is in C19, not here.
- Files:
  - apps/web/src/pages/Inbox.tsx (group header count)
  - apps/web/src/components/inbox/InboxMessageDialog.tsx and attachment preview dialog
  - apps/web/src/components/inbox/InboxRow.tsx
  - Inbox compose close dialog
- Reach: Inbox users.
- Acceptance criteria:
  - Group header count is stable when expanded.
  - Thread dialog keeps x when the agent panel opens.
  - Attachment preview height fits content with a minimum.
  - Compose close with empty body does not mention saving text.
- Needs product decision: false
- Depends on: none
- Conflicts with: C19 (InboxRow.tsx)

### C16 [P3] Integrations cards: letter tiles, 'Ready', two Gmail descriptions, an intro sentence, a Mercury agent name before the agent exists
- Rank: 16. Effort: S. Reopens: Pass-12 C24 (residual).
- Finding ids (found by): R1-10, V1-12, V1-13, V1-14, J2-05, V1-21. Found by: R1-10 (R1, R3-13-03, V1-11); V1-12 (V1); V1-13 (V1); V1-14 (V1); J2-05 (J2); V1-21 (V1 (dev server, repeat of pass 12))
- Root cause: Carta, Treg, Devin, Granola, Wispr Flow and both iMessage entries use letter tiles (iMessage tiles are identical); Connected cards differ in menu and 'Used by'; Blockscout 'Ready' says nothing; Gmail has two descriptions ('Read, search and draft email' versus 'Search, read, draft, and send email.'); a one-sentence intro repeats the Connect buttons; the Mercury Agent card shows an unlinked title before the agent exists; logo tiles blank for 1-3 s on dev.
- Verification: Observed; logo timing is dev-only suspected.
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (:627 intro, tile fallback, card slots)
  - apps/web/src/components/integrations/FinanceSection.tsx:118-126
  - apps/web/src/components/integrations/IntegrationAgentSection.tsx:73-79
  - packages/core/src/app-directory.ts (one description string)
- Reach: Everyone who opens Integrations.
- Acceptance criteria:
  - No Connected card uses a letter tile where a logo exists; the two iMessage entries differ.
  - Gmail has one description in both places.
  - No intro sentence; no 'Ready' label.
  - Agent card before creation reads 'Created when you allow changes'.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C17 [P3] Bot panel, Settings and first-run cards: same choice built two ways, unlabeled switches, scroll jump, widths
- Rank: 17. Effort: M. Reopens: Pass-12 C26 (residual).
- Finding ids (found by): V1-04, V1-06, V1-07, V1-15, V1-18, V1-19, V1-23. Found by: V1-06 (V1 (reported P2; P3 here)); V1-04 (V1 (reported P2; P3 here)); V1-07 (V1); V1-15 (V1); V1-18 (V1); V1-19 (V1); V1-23 (V1)
- Root cause: Audience is a segmented pair, Workspace two stacked buttons (bot-panel.tsx:85-105); 'More settings' has no chevron; Advanced scrolls the panel 300 px; 'Export' reads as a label and the header has no divider when scrolled; switch plus label is laid out two ways; 'GPT-6 Luna' and 'Documents' switches have no sub-label (AiDataSharing.tsx); in the Chief first-run thread the divider, question card and connect cards are 900, 640 and 407 px wide.
- Verification: All observed once by V1, several are repeats of pass-12 findings that were rated P3 there.
- Files:
  - apps/web/src/pages/shell/bot-panel.tsx
  - apps/web/src/components/AiDataSharing.tsx
  - chat card components (max width)
- Reach: Bot and Settings users.
- Acceptance criteria:
  - Workspace uses the same segmented control as Audience.
  - Opening Advanced does not scroll Name out of view unless needed.
  - Every AI switch has a one-line sub-label.
  - Cards in the Chief thread share one max width.
- Needs product decision: false
- Depends on: none
- Conflicts with: C11 none

### C18 [P3] Auth pages: pink hover on the primary button, centered heading missing on phone, redundant placeholders
- Rank: 18. Effort: S. Reopens: Pass-12 C26 (hover).
- Finding ids (found by): V1-09, V1-17, V1-24. Found by: V1-09 (V1 (repeat of pass-12 V1-12)); V1-17 (V1); V1-24 (V1)
- Root cause: Primary buttons use hover:bg-primary/80, which turns cream into a pinkish grey that reads as disabled (button.tsx; also after a failed submit); Reset password heading is left-aligned at 375 px (Auth.tsx:535 lacks text-center); placeholders repeat the visible labels (Auth.tsx:245,270,299).
- Verification: Observed; hover colour is global, so confirm no other screen depends on it.
- Files:
  - packages/ui-web/src/components/ui/button.tsx
  - apps/web/src/pages/Auth.tsx
- Reach: Every sign-in; hover affects all primary buttons.
- Acceptance criteria:
  - Hover on a primary button keeps full opacity and does not look disabled.
  - Reset heading is centered at 375 px.
  - Name and email fields have no placeholder that repeats the label.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C19 [P3] Keyboard focus and small targets: focus lost after sign-in error, four Tab stops per message, weak row focus ring, double ring on Contacts, Escape ignored in Data room preview, 16-18 px controls
- Rank: 19. Effort: M. Reopens: Pass-12 C12 (residual).
- Finding ids (found by): V1-16, V1-20, V2-06, V3-06, V3-02, V3-05. Found by: V1-16 (V1); V1-20 (V1); V2-06 (V2); V3-06 (V3); V3-02 (V3); V3-05 (V3)
- Root cause: After a failed sign-in activeElement is BODY (Auth.tsx); every chat message adds four Tab stops (React, Reply, Remember, More); a focused Inbox row shows a 1 px browser outline (InboxRow.tsx); closing Edit contact leaves two nested rings; Escape does not close the desktop Data room preview pane; Select all (18 px), 'Show all N' and 'Burn' are under 24 px at a fine pointer.
- Verification: All observed. Touch-target criteria could not be measured by R1, R2, V2 and V3 (no coarse-pointer emulation); only J3 and V1 measured with emulation and found no 44 px failures, so none is filed.
- Files:
  - apps/web/src/pages/Auth.tsx
  - apps/web/src/pages/Shell.tsx roster rows and message toolbar
  - apps/web/src/components/inbox/InboxRow.tsx
  - apps/web/src/pages/Contacts.tsx
  - apps/web/src/components/data-room/ preview pane and select-all
- Reach: Keyboard users.
- Acceptance criteria:
  - After a failed sign-in focus is on the email field.
  - Tab from the composer area reaches the next message group in one press per message.
  - A focused Inbox row shows the standard ring.
  - Escape closes the Data room preview.
  - Select all checkbox has a 24 px hit area.
- Needs product decision: false
- Depends on: none
- Conflicts with: C15 (InboxRow.tsx), C13 (Data room)

### C20 [P3] Same idea, two labels: waiting state, 'Needs reply' versus 'Needs attention', two cap-table bots, account names quoted by agents
- Rank: 20. Effort: S. Reopens: Pass-12 C21 (residual).
- Finding ids (found by): R3-13-01, FLOW-05, FLOW-06, V2-14. Found by: R3-13-01 (R3); FLOW-05 (FLOW); FLOW-06 (FLOW); V2-14 (V2 (likely model paraphrase))
- Root cause: roster-status.ts:14 needsAnswerLabel is used for every waiting_input row, while Activity says 'Needs approval' only when needsApproval is set and the composer says 'Waiting for approval'; Inbox group 'Needs reply' and row chip 'Needs attention' are two words for 'you must act'; Cmd+K lists 'Carta agent' and 'Investors agent' with near-identical descriptions; an agent reply names 'Mercury checking' while Finance lists 'MOCK Checking'.
- Verification: R3-13-01 verified by reading roster-status.ts:14 and the sidebar/composer difference. Others observed once. The Carta-only agent decision stays.
- Files:
  - apps/web/src/lib/roster-status.ts
  - apps/web/src/components/ (Activity list, composer status text)
  - apps/web/src/components/inbox/InboxRow.tsx and apps/web/src/pages/Inbox.tsx
  - palette bot descriptions
  - Finance tool output names
- Reach: Anyone using Activity, Inbox or Cmd+K.
- Acceptance criteria:
  - A pending consent or approval reads the same in the sidebar row, Activity and the composer.
  - One word for 'you must act' in Inbox.
  - Carta and Investors agents have role sentences that differ by data source.
- Needs product decision: false
- Depends on: none
- Conflicts with: C1 only if both edit composer status text

### C21 [P3] Long text on a phone: cut email subject, email broken at the hyphen, truncated emails without title
- Rank: 21. Effort: S.
- Finding ids (found by): J3-03, J3-04, V3-07. Found by: J3-03 (J3); J3-04 (J3); V3-07 (V3)
- Root cause: InboxMessageDialog clamps the subject at two lines with no way to read the rest; Settings > Account breaks 'mock-founder@...' at the hyphen; Contacts truncates long emails at 375 px with no title attribute.
- Verification: Observed once each.
- Files:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx
  - Settings account block
  - apps/web/src/pages/Contacts.tsx
- Reach: Phone users.
- Acceptance criteria:
  - Subject shows up to three lines or expands on tap.
  - The email sits on its own line without a hyphen break.
  - Truncated emails carry the full value in title.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C22 [P3] Menu and toggle consistency: three menu row heights, solid white Activity icon, identical Artifact timestamps
- Rank: 22. Effort: S.
- Finding ids (found by): V1-10, V3-08, V3-09. Found by: V1-10 (V1); V3-08 (V3); V3-09 (V3)
- Root cause: Pages menu rows are 28 px, account menu 32-34 px, Create menu 36-43 px; the open Activity toggle becomes the brightest element in the sidebar; Artifact cards show an identical '6m ago' on all ten.
- Verification: Observed once each.
- Files:
  - apps/web/src/pages/Shell.tsx menus (DropdownMenuItem)
  - apps/web sidebar Activity toggle
  - Artifacts grid card
- Reach: Everyone, minor.
- Acceptance criteria:
  - All three menus use one row height.
  - Activity open uses the muted selected style.
  - Artifact cards carry no identical filler.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

## Deferred items (not in a cluster)
- Load time on a shared dev stack, not reproduced: V1-01 (Settings 5-8 s on first open), V1-22 and R3-13-05 ('Still opening' for 6-12 s), V2-05 (Legal to Data room preview is a grey box for 15 s; adding 'Loading preview' text and a failure state is cheap if it repeats on a production build). Re-measure on an idle production build.
- J2-06 deadline note says 'December 1' while the term ends December 2: seed text, not product.
- FLOW-02 (fold the Models tab into Privacy and approvals) conflicts with the decided five-section Settings; owner question: still fold Models into Privacy and approvals, given C6 already shrinks the tab to one line?
- FLOW-03 (fold Chat display into Appearance, drop Avatars, move 'Load web images' next to AI sharing): judgment call; owner question: should display options and the image privacy switch be regrouped?
- FLOW-08 (Gmail, Calendar and Drive as one Google sign-in): suspected and OAuth is BLOCKED; owner question: can one Google consent cover all three, and should Chief show one 'Connect Google' card?
- R1 pass-12 C5 (Inbox reshuffle): one swap after first paint and a row moved between two loads 25 s apart on a shared stack; not attributable to the product. Re-check on a quiet stack.
- Pass-12 C8 Routine from /skill (BLOCKED, needs model-driven creation), C22 stale answer after bank connect (BLOCKED), C12 touch targets for R1/R2 (no coarse pointer), C16 attachment mark (no demo mail with attachments), C18 import notice, C15 off-state behaviour: not verified this pass.
- Catalog drift for the story catalog (not product): STORY-DRM-019 (bulk download and Email exist), STORY-APP-353 (skill form replaces SKILL.md text area), STORY-APP-172 (Routines opens from header, 'Create a routine', skill picker, Saved, Next run), STORY-APP-385/386 (card says 'Send $1,200.00' / 'Deny', one sentence). STORY-APP-210 has no way to attach a Data room file to an investor update; the Data room Email action covers it, so not filed.
- Investors Updates/Pipeline ghost bars: filed in C3 because three walkers saw them; page owned by another session.

## BLOCKED stories
- STORY-APP-309 / STORY-APP-319 model step and 'Connect your apps' (demo has a default model; Gmail/Calendar OAuth not attempted).
- STORY-APP-301 to 316 (model step, non-owner path): not reachable on the demo.
- STORY-CAP-017 connect step, STORY-FIN-019 connect step, STORY-FIN-020 crypto, Carta/Mercury/Brex/Box OAuth.
- Storybook smoke (no node_modules in the worktree; build in the main checkout was refused).
- Not walked: file upload via OS chooser, Deny path at phone, Fundraising/Investors/Legal/Contacts on a phone, Cleanup with data, held 'Share with {name}?' card, secret request card, Hide amounts on at phone.

## Counts by severity
- Clusters: 22 (P0 0, P1 1, P2 9, P3 12)
- Distinct finding ids in clusters: 84
- Needs a product decision: C3, C11
- P1: C1
- P2: C2, C4, C5, C6, C7, C8, C9, C10, C3
