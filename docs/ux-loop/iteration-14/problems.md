P0: 0, P1: 1, P2: 12, P3: 11

# Iteration 14 problems: fix clusters

Sources: R1-R3 (verify pass-13 clusters), J1-J3 (journeys), FLOW, V1-V3, on the mock demo stack (web 5381). Findings were deduplicated and clustered by root cause; 'found by' lists who saw each. Iterations 1-13, docs/ux-flow and docs/ux-visual were read. A pass-13 cluster whose criteria are not met appears with a 'Reopens' line. Rank: P0, then severity x reach / effort.

Owner decisions respected and not re-raised: tour stays nine stops with a fixed card; the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Legal row actions Ask agent / Done / Dismiss; approval toasts persist, bottom-right; Settings in five sections with Memory under Advanced; no model step in onboarding on the demo; Carta-only agent for the cap table; one SAFE list (Mercury is the only SAFE record, so J2-10 is not filed); Hide amounts hides money in app UI only.

Environment caveats: the demo is shared by about ten walkers and the host load average was above 100, so counts, 'New Bot' rows, toasts and load times changed under everyone. No walker except J3 could set a coarse pointer, so touch targets are only judged from J3. OAuth steps were BLOCKED.

Severity calls: one P1 (C1): amounts are shown in clear in the one surface that ignores Hide amounts, checked in code. J2-01, J2-02 and V2-09 were reported P1 and are P2 in C3: R1 confirmed the red error and Retry are gone, the toast and sidebar still lead to the card, and nothing can be sent twice. V1-01 was reported P1 and is P2: the clip does not change the meaning. J2-03 (suspected card revival) is not rated until re-tested on a single-user stack. J1-04, V2-02 and others reported P2 were lowered or deferred as stated below. No P0: no money moved wrongly and no data was lost.

## Fix clusters, ranked

### C1 [P1] Hide amounts does not mask the Cmd+K result snippets, so runway and burn figures show in clear on a board call
- Rank: 1. Effort: XS.
- Finding ids (found by): J1-01 (J1). All ids: J1-01
- Root cause: The palette builds each chat result's detail from plainSnippet(hit.snippet) and never passes it through maskCurrencyWhenHidden, which every other surface uses (Chief thread, Finance, Inbox rows).
- Verification: Confirmed in code: Shell.tsx:583 passes plainSnippet(hit.snippet) unmasked; maskCurrencyWhenHidden exists in lib/hide-amounts-preference.ts:68. Screenshot evidence from J1 (39-cmdk.png vs 37-chief-hidden.png).
- Files:
  - apps/web/src/pages/Shell.tsx:583 (wrap the snippet with maskCurrencyWhenHidden)
  - apps/web/src/pages/shell/command-palette.tsx (any other place a snippet or title is rendered; re-render when the switch flips via useHideAmounts)
  - apps/web/src/pages/shell/command-palette.test.tsx or Shell palette test (regression)
- Reach: Anyone who turns on Hide amounts and then searches; worst case is a screen share or board call.
- Acceptance criteria:
  - With Hide amounts on, Cmd+K 'runway' shows no digit-grouped dollar amount in any result row or snippet; turning it off shows the original text again.
  - Document, mail and artifact result rows are checked the same way (a snippet containing '$1,620,000' renders masked).
  - A unit test fails when the mask call is removed.
- Needs product decision: false
- Depends on: none
- Conflicts with: C6 (same palette code in Shell.tsx)

### C2 [P2] Inbox 'To do' card repeats the first Needs reply rows; a replied mail keeps its 'Needs attention' tag; Needs reply is not in time order and unlabelled; two words for 'you must act'
- Rank: 2. Effort: M. Reopens: Iteration-11 FLOW-02 (To do repeats rows); iteration-13 C20 (Needs reply vs Needs attention).
- Finding ids (found by): FLOW-01 (FLOW); J1-02 (J1); V2-08 (V2); FLOW-02 (FLOW, R2 (as R2-14-06)); R2-14-06 (R2). All ids: FLOW-01, J1-02, V2-08, FLOW-02, R2-14-06
- Root cause: The To do card renders from tasks independently of the grouped rows, so the same action shows twice within 200 px (matched by text, not source thread). The row badge comes from stale triage state, and the Needs reply sort and the chip wording were never settled with the owner.
- Verification: FLOW-01 observed (reopens iteration-11 FLOW-02 that iteration 12 recorded as closed); J1-02 observed, cause suspected (InboxRow.tsx:231 builds the label from row.needsReply, so a stale flag is plausible, not traced); V2-08 observed, cause suspected. FLOW-02 is the third time this wording appears (iteration-13 FLOW-05, C20 residual).
- Files:
  - apps/web/src/pages/Inbox.tsx (To do card: skip tasks whose source thread is a visible Needs reply row; pile sort)
  - apps/web/src/components/inbox/InboxRow.tsx:231 (badge label and clear it when the newest message is the user's own reply)
  - apps/web/src/components/inbox/InboxRow.test.tsx and an Inbox page test
- Reach: Every Inbox user daily.
- Acceptance criteria:
  - No To do item has the same source thread as a visible Needs reply row (matched by thread id); the row shows a small 'To do' mark instead.
  - After sending a reply, the thread's row carries no attention tag.
  - The Needs reply order is either newest first or the group says how it is ordered.
  - One phrase is used for 'you must act' in group, chip and toast (see decision).
- Needs product decision: true (Which single phrase means 'you must act' in the Inbox (recommend 'Needs reply' for mail that wants an answer and the reason text, for example 'Deadline', for the rest), and should the Needs reply pile sort newest first (recommend yes) rather than by urgency?)
- Depends on: none
- Conflicts with: none

### C3 [P2] A bot that delegates a payment still gives no pointer to the approval in its own thread, shows the wrong preview and label, and never reports the result after approval
- Rank: 3. Effort: L. Reopens: Pass-13 C1 (criteria 1 and 4).
- Finding ids (found by): J2-01 (J2, V2 (as V2-09)); J2-02 (J2); R1-14-01 (R1); R1-14-03 (R1); J2-03 (J2). All ids: J2-01, J2-02, V2-09, R1-14-01, R1-14-03, J2-03
- Root cause: The approval card lives only in the Mercury agent's thread. The requester's thread ends at 'Messaged Mercury agent', its composer shows needsAnswerLabel() ('Needs your answer') although nothing can be answered there, the sidebar preview uses a tool label or text that is not in the thread, and the delegate's final outcome is not posted back after Maya approves, so the bot keeps saying 'waiting for your approval'. Pass-13 C1 fixed the red error and Retry (R1 confirmed) but not these criteria.
- Verification: Pass-13 C1 criteria 1-3 mostly met per R1 (no red error, no Retry, no Last run failed). Not met: composer text (Shell.tsx:4172 uses needsAnswerLabel, confirmed), preview (R1-14-01 observed), J2-01/J2-02 observed by J2 on a separate user. Severity lowered from P1: no wrong action is possible now, the persistent toast and sidebar lead to the card, and nothing is sent twice. J2-03 is suspected with concurrent walkers; re-test before trusting.
- Files:
  - apps/web/src/pages/Shell.tsx:2533 and :4172 (delegatePending: composer placeholder 'Waiting for approval' while the delegate waits)
  - packages/core/src/roster-status.ts or apps/web roster-status helper (shared waiting label for the sidebar row)
  - apps/web sidebar row preview source (use the last visible message, not tool labels)
  - packages/adapters/src/executor.ts (post approved/denied/sent outcome to the requesting bot; drop 'No request link was provided' from user text)
  - apps/web/src/components/AskCard.tsx (J2-03 re-test; superseded card must stay terminal)
  - tests next to each: executor-approval-replay.test.ts, roster-status test
- Reach: Anyone who lets a bot pay through the Mercury agent.
- Acceptance criteria:
  - While the Mercury card is live, the requester's composer says 'Waiting for approval' and the sidebar row says the same; its thread tail links to the card.
  - The sidebar preview equals the last visible message in the thread (denied and answered cases).
  - After Maya approves, the requesting bot's thread shows one outcome line (sent or failed) within one run, with no 'request link' wording.
  - J2-03: on a single-user stack a card shown 'No longer active' never becomes live again.
- Needs product decision: false
- Depends on: none
- Conflicts with: C4 (Shell.tsx toast code); C1 (Shell.tsx)

### C4 [P2] Toasts and upload cards sit on top of the content they relate to
- Rank: 4. Effort: S. Reopens: Pass-13 C9.
- Finding ids (found by): V2-07 (V2, R1 (as R1-14-02)); J2-04 (J2, V3 (as V3-04)). All ids: V2-07, R1-14-02, J2-04, V3-04
- Root cause: The approval toast stack is anchored in the chat column and 12 px past it beside a docked panel, and the Data room upload stack is fixed bottom-centre (sm:left-1/2) over the file list; the two stacks use different corners.
- Verification: R1-14-02 and V2-07 observed with screenshots; DropZone.tsx:144 read: 'sm:left-1/2 sm:-translate-x-1/2' confirmed. Reopens pass-13 C9 (phone clipping fixed, docked-panel overlap not).
- Files:
  - packages/ui-web notification-toaster.tsx and the toast offset in apps/web/src/pages/Shell.tsx (anchor to the viewport bottom-right when a panel is docked, reserve space under the last message)
  - apps/web/src/components/data-room/DropZone.tsx:144 (move the upload stack to the same bottom-right corner or a strip under the toolbar)
- Reach: Anyone with an approval toast and an open agent panel; every Data room upload.
- Acceptance criteria:
  - At 1440 with the bot settings panel open, the approval toast covers none of the last chat bubble and does not extend past the chat column.
  - Upload progress and 'Sorted N items / Undo' do not cover the file name column.
  - Approval toasts stay persistent and bottom-right (owner decision).
- Needs product decision: false
- Depends on: none
- Conflicts with: C3 (Shell.tsx)

### C5 [P2] Phone sidebar drawer reopens scrolled down, Activity pushes the bot list down 330 px, and Page agents expands itself
- Rank: 5. Effort: M.
- Finding ids (found by): J3-01 (J3); V3-02 (V3); FLOW-07 (FLOW). All ids: J3-01, V3-02, FLOW-07
- Root cause: The drawer's scroll container keeps its scroll offset while closed; the Activity section is an inline block that grows the sidebar scroll height from 711 to 1245 px; opening a page auto-expands Page agents with the current page's agent not first.
- Verification: J3-01 and V3-02 observed with measurements; FLOW-07 observed. Cause for J3-01 read from the report, drawer code not traced (suspected).
- Files:
  - apps/web/src/pages/Shell.tsx (mobile drawer scroll container near :4298-4323: scrollTop = 0 on open; Page agents auto-expand)
  - apps/web/src/pages/ActivityList.tsx (cap the section height about 220 px with its own scroll, or open from the clock button)
- Reach: Phone users every time they open the menu; desktop users who open Activity.
- Acceptance criteria:
  - Open the drawer after viewing a chat deep in the list: Pages (Inbox, Finance, Data room) are visible without scrolling.
  - With Activity open at 1440x900, at least three bot rows stay visible and the sidebar scroll height grows by at most 240 px.
  - Opening a page does not push 'Reconnect needed' and 'Archived' out of view, or lists only that page's agent first.
- Needs product decision: false
- Depends on: none
- Conflicts with: C11 (tour, only if the drawer is touched)

### C6 [P2] Cmd+K ranks body-only document hits above an exact artifact title and shows the query lower-cased
- Rank: 6. Effort: S.
- Finding ids (found by): V3-01 (V3); V3-12 (V3). All ids: V3-01, V3-12
- Root cause: Ranking is per group (command-palette.tsx:72-76) and groups render in a fixed order, so five body-only 'Monthly Investor Update' documents come before the artifact titled 'MOCK Hiring Plan - Q4'. The mail row prints a lower-cased query.
- Verification: V3-01 observed with the DOM order; ranking code read at command-palette.tsx:60-79. V3-12: query lower-casing cause suspected (not found in the Shell.tsx:2338 line itself).
- Files:
  - apps/web/src/pages/shell/command-palette.tsx:72-76 and :201 (cap body-only hits at 2-3 rows or lift a group whose best hit is a title match)
  - apps/web/src/pages/Shell.tsx:2338 (show the raw query; add an Esc hint to the footer)
- Reach: Everyone who uses search.
- Acceptance criteria:
  - Typing the exact title 'Hiring Plan' puts the artifact with that title in the first three rows.
  - 'Search mail for' shows the text as typed.
  - Footer shows 'Esc Close'.
- Needs product decision: false
- Depends on: none
- Conflicts with: C1 (palette in Shell.tsx)

### C7 [P2] Bot settings: the Workspace choice 'Shared with your other bots' is clipped, Advanced scrolls the panel and cuts the Name label
- Rank: 7. Effort: XS. Reopens: Pass-13 C17.
- Finding ids (found by): V1-01 (V1, R2 (as R2-14-01)); R2-14-09 (R2); V1-02 (V1). All ids: V1-01, R2-14-01, R2-14-09, V1-02
- Root cause: The segmented control label needs 174 px in a 166 px button with nowrap and clip; the Advanced section scrolls the panel unconditionally. Pass-13 C17 did not fix it.
- Verification: Confirmed in code: bot-panel.tsx:100 holds the long label; measured 174 vs 166 by V1. Reported P1 by V1 and P2 by R2; P2 because the meaning survives the clip.
- Files:
  - apps/web/src/pages/shell/bot-panel.tsx:96-104 (shorten to 'Shared' or allow wrapping; scroll to the opened section only when below the fold; one switch layout)
  - apps/web/src/pages/shell/bot-panel.test.tsx
- Reach: Anyone who opens Advanced in bot settings.
- Acceptance criteria:
  - Both Workspace labels are fully readable at the 1440 panel width (scrollWidth <= clientWidth).
  - Opening Advanced leaves the Name label fully visible.
  - Notifications and 'Read replies aloud' put the switch on the same side.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C8 [P2] Data room layout: table capped at 896 px at 1920, phone toolbar eats 22-32% of the screen, failed badge opens an unfiltered list
- Rank: 8. Effort: M.
- Finding ids (found by): V3-03 (V3, R2 (as R2-14-07)); J3-04 (J3); R2-14-12 (R2); V3-06 (V3); V3-07 (V3); R2-14-04 (R2). All ids: V3-03, R2-14-07, J3-04, R2-14-12, V3-06, V3-07, R2-14-04
- Root cause: ItemRows.tsx:543 caps the table at max-w-4xl while the toolbar spans the pane, so Name gets 292 px and wraps; Contacts.tsx:171 has the same cap. On phones the sticky toolbar stack is 180-260 px tall and the 'N files failed' badge has no Failed filter to open.
- Verification: V3-03 confirmed in code (max-w-4xl at ItemRows.tsx:543 and Contacts.tsx:171); the rest observed with measurements.
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx:543 (drop max-w-4xl; header checkbox 24 px hit area, grid card height and menu disc)
  - apps/web/src/pages/Contacts.tsx:171 (larger cap so the right edge matches Add contact)
  - apps/web/src/pages/DataRoom.tsx (phone: sticky search only; Failed filter; one 'Clear all' in no-results)
- Reach: Data room users on large monitors and on phones.
- Acceptance criteria:
  - At 1920 the table right edge matches the toolbar right edge and the long file name stays on one line.
  - At 375 with filters closed the toolbar is under 120 px tall and the first file row top is under 160 px.
  - The failed-files badge opens the list filtered to failed files.
  - No-results with search and filter shows one 'Clear all'.
  - Select all checkbox hit area is 24 px on a fine pointer.
- Needs product decision: false
- Depends on: none
- Conflicts with: C9 (ItemRows.tsx, DataRoom.tsx)

### C9 [P2] Data room Auto-sort proposes all 36 files, and a stuck read looks different from a failed one
- Rank: 9. Effort: M.
- Finding ids (found by): J2-05 (J2); J2-06 (J2); V3-05 (V3). All ids: J2-05, J2-06, V3-05
- Root cause: Auto-sort is scoped to every file with nothing pre-selected, so the files Maya just added are lost among already-filed ones. The processing strip says 'Reading ...' for minutes and the timed-out row has no Failed pill like the other failed rows. The import strip says 'Imported 4 files' but lists three.
- Verification: J2-05, J2-06 observed; V3-05 observed. Strip lifetime and file ranking not traced.
- Files:
  - apps/web/src/components/data-room/AutoSortDialog.tsx (default to unfiled or recent files, proposal preselected, 'Show all')
  - apps/web/src/components/data-room/ProcessingStrip.tsx and ItemRows.tsx status cell (same Failed pill; 'Still reading' after 60 s)
  - Data room import strip component (list all names or '+N more'; expire after the next visit)
- Reach: Anyone filing a batch of documents.
- Acceptance criteria:
  - Auto-sort opens with only unfiled or newly added files, all selected, and a control to show the rest.
  - A row that timed out shows the same Failed pill as an unreadable file.
  - The strip shows every imported name or '+N more' and disappears after the next visit.
- Needs product decision: false
- Depends on: none
- Conflicts with: C8 (ItemRows.tsx)

### C10 [P2] Legal: the 'not yet checked' notice counts the wrong documents, never falls after a scan, and Scan now gives no feedback
- Rank: 10. Effort: M.
- Finding ids (found by): J2-07 (J2, R2 (as R2-14-11)); J2-08 (J2); V2-06 (V2, J1 (as J1-03)). All ids: J2-07, J2-08, R2-14-11, V2-06, J1-03
- Root cause: The unchecked-documents count includes HR letters and investor updates and is not recomputed after a scan; the notice is a bare underlined link; Scan now shows 'Scanning...' for over a minute with no progress or result line.
- Verification: Link style confirmed (Legal.tsx:372 underline text-foreground). Counting and scan status observed by three walkers on a shared stack (others add files), cause not traced. The empty-state half of J1-03 is closed (FLOW and R2 saw 'No contracts yet').
- Files:
  - apps/web/src/pages/Legal.tsx:372-380 (count only contract-like documents; recount after scan; style as a notice row with an explicit action)
  - Legal scan status in packages (progress 'n of N' and a Finished line)
  - apps/web/src/pages/Legal.test.tsx
- Reach: Every Legal user.
- Acceptance criteria:
  - After Scan now completes, the count is recomputed and drops by the number scanned.
  - While scanning, the page shows 'Reading n of N' or equivalent; when done it shows 'Finished' and the new 'Last scan' time.
  - The notice is a row with a 'Review' button, not a stray link.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C11 [P2] Tour: on a phone the card covers the drawer rows below the target; on desktop it covers the last chat bubble
- Rank: 11. Effort: S. Reopens: Pass-13 C11.
- Finding ids (found by): V1-04 (V1); R2-14-02 (R2). All ids: V1-04, R2-14-02
- Root cause: TourPopover.tsx places the card beside the target on a phone (top/bottom from the ring) so it hides rows and jumps each stop; on desktop the fixed card sits at the sidebar's right edge above the composer, over the left of the last chat bubble.
- Verification: Phone placement confirmed in code (the 'ring ? targetAbove' branch at TourPopover.tsx:176-182). Desktop overlap observed at all 9 stops. Reopens pass-13 C11 residual.
- Files:
  - apps/web/src/components/tour/TourPopover.tsx:171-190 (phone: pin to the foot of the drawer; desktop: keep it inside x < sidebar right + 8 or reserve chat padding)
- Reach: Everyone taking the tour on a phone; desktop users with a long Chief thread.
- Acceptance criteria:
  - At 375, stops 3 and 4 hide none of the drawer rows after the target and the card stays at one spot.
  - On desktop no chat bubble text is hidden at any of the nine stops.
  - Nine stops, fixed card position and Next not moving (owner decisions) are unchanged.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C12 [P2] Integrations: 'Connected' chip missing on phone cards, blank tiles on first paint, Mercury description is not a role sentence
- Rank: 12. Effort: XS. Reopens: Pass-13 C16 (letter tiles, Mercury name).
- Finding ids (found by): V1-03 (V1); FLOW-08 (FLOW); R2-14-13 (R2); R2-14-10 (R2). All ids: V1-03, FLOW-08, R2-14-13, R2-14-10
- Root cause: The status chip is hidden at narrow widths, so connected state shows only as 'Open Finance'; first paint shows six blank cards without search or filters; the Mercury agent seed description is 'Your Mercury account'.
- Verification: V1-03 observed against the desktop screenshot; file for the hidden chip is suspected (IntegrationsHome.tsx cited by R2, not opened). Letter tiles remain for services without a logo; confirm none exist before treating as a defect.
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (keep status chip at 375; render search and chips before cards load; letter tiles)
  - agent description seed for Mercury ('Reads your Mercury balances and transactions.')
  - V1-03 iMessage subtitle 'Through a Photon project'
- Reach: Phone users on Integrations; everyone on first open.
- Acceptance criteria:
  - At 375 every connected card shows 'Connected'.
  - The search box and chips render at first paint; only the grid shows skeletons.
  - The Mercury agent description is a role sentence.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C13 [P2] After a denied payment, asking again for the same amount returns 'you denied this earlier' with no new card; an unknown recipient gives no next step; superseded and expired look alike
- Rank: 13. Effort: S.
- Finding ids (found by): R1-14-04 (R1); V2-10 (V2); V2-11 (V2). All ids: R1-14-04, V2-10, V2-11
- Root cause: The Mercury agent dedupes an identical request after a denial. A card whose request was replaced reads only 'No longer active' in its body (AskCard.tsx:264) though the status line at :42 already knows superseded versus expired. The 'add the recipient at the bank first' message has no link.
- Verification: R1-14-04 observed on one request (dedupe cause suspected, not traced); AskCard.tsx:264 confirmed to use one generic string.
- Files:
  - packages/adapters (Mercury payment idempotency)
  - apps/web/src/components/AskCard.tsx:42 and :264
  - Mercury agent failure copy (link to recipients)
- Reach: Anyone who changes their mind after denying a payment.
- Acceptance criteria:
  - Asking again for the same amount after a Deny creates a new card (or shows an 'Ask again' action).
  - A card in the body says 'Replaced by a newer request' or 'Expired', matching its state.
  - The unknown-recipient message links to where recipients are added.
- Needs product decision: true (After a payment request is denied, should asking for the identical payment again create a new approval? Recommend yes, because the owner explicitly asked again; the old denied card stays in history.)
- Depends on: C3 for the same adapters files
- Conflicts with: C3 (adapters), AskCard.tsx

### C14 [P3] Storybook smoke fails on two AppConnect stories
- Rank: 14. Effort: XS.
- Finding ids (found by): R3-02 (R3). All ids: R3-02
- Root cause: The stories look for a button named /^Connect$/ but the card's button is labelled 'Connect Sample Mail' (message-cards.tsx:263 aria-label).
- Verification: Confirmed in code: story queries /^Connect$/ at :139 and :150; aria-label `Connect ${block.name}` at message-cards.tsx:263. Smoke failure reproduced by R3.
- Files:
  - apps/web/src/pages/shell/message-cards.stories.tsx:139 and :150 (use /^Connect Sample Mail$/)
- Reach: CI and design-system gate only.
- Acceptance criteria:
  - node .storybook/smoke.mjs renders 1730 of 1730 stories.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C15 [P3] Menu row heights still differ (Pages 28 px, Account and Create 32 px)
- Rank: 15. Effort: XS. Reopens: Pass-13 C22.
- Finding ids (found by): R3-03 (R3). All ids: R3-03
- Root cause: Pages 'Show in sidebar' checkbox items are not given the h-8 used by the other menus. Reopens pass-13 C22 criterion 1.
- Verification: Measured 28 vs 32 by R3.
- Files:
  - apps/web/src/pages/Shell.tsx (Pages menu DropdownMenuCheckboxItem class)
- Reach: Everyone, minor.
- Acceptance criteria:
  - Account, Create and Pages menus all measure 32 px per row.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C16 [P3] Inbox mail dialog: address split at the hyphen, dialog jumps when Ask agent opens, body indented 16 px, hover actions reflow the snippet
- Rank: 16. Effort: S. Reopens: Pass-13 C21 and C15.
- Finding ids (found by): R3-01 (R3); R2-14-03 (R2); V2-16 (V2); V2-12 (V2). All ids: R3-01, R2-14-03, V2-16, V2-12
- Root cause: The 'to' line uses break-words, which breaks at a hyphen; the dialog grows from the centre when the agent panel opens; the body wrapper adds p-4 beyond the header edge; hover actions shrink the snippet.
- Verification: R3-01 confirmed in code (break-words sm:truncate at :381). Others observed.
- Files:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx:361,381,385 (whitespace-nowrap on each address)
  - same file (anchor the left edge when the panel opens; body indent)
  - apps/web/src/components/inbox/InboxRow.tsx (overlay hover actions)
- Reach: Inbox users.
- Acceptance criteria:
  - No recipient address breaks inside the address at 375.
  - Opening Ask agent keeps the email text x position within 8 px.
  - Body text aligns with the header edge.
- Needs product decision: false
- Depends on: none
- Conflicts with: C2 (InboxRow.tsx)

### C17 [P3] Settings and Models copy: 'Included' contradicts 'Praci does not pay', two things named Advanced, mixed selected styles, Models tab is one sentence
- Rank: 17. Effort: S.
- Finding ids (found by): V1-08 (V1, R1 (as R1-14-06)); V1-06 (V1); V1-07 (V1, FLOW (as FLOW-03)); V1-12 (V1). All ids: V1-08, R1-14-06, V1-06, V1-07, V1-12, FLOW-03
- Root cause: The own-key form line shows while OpenRouter is 'Included'; the in-page 'Advanced' disclosure shares a name with the Memory group; selected styles differ by control; the Models tab holds one sentence.
- Verification: V1-08 and R1-14-06 observed. FLOW-03 (fold Models) is a repeat of an unanswered iteration-13 question.
- Files:
  - apps/web/src/components/settings/ModelSettingsOverlay.tsx and Models section
  - Settings privacy section ('Per model and documents')
  - Settings general section
- Reach: Settings users.
- Acceptance criteria:
  - The 'does not pay' line appears only after a key is connected.
  - No two controls in Settings are both named 'Advanced'.
  - Theme, Density and Avatars share one selected style.
- Needs product decision: true (Keep the Models tab as one sentence plus 'Use my own model' (recommend yes, five sections are decided), or fold it into Privacy and approvals, and regroup Chat display with Appearance?)
- Depends on: none
- Conflicts with: none

### C18 [P3] First-run and tour copy: two options promise the same things, consent card is three lines, chosen row looks disabled, connect cards narrower than the rest, Integrations repeated
- Rank: 18. Effort: S.
- Finding ids (found by): FLOW-05 (FLOW); FLOW-06 (FLOW); V1-09 (V1); V1-10 (V1); R2-14-05 (R2). All ids: FLOW-05, FLOW-06, V1-09, V1-10, R2-14-05
- Root cause: Copy and widths were written per card; no shared max width.
- Verification: All observed.
- Files:
  - first-question card component (B copy, chosen row contrast)
  - chat AI consent card (one sentence plus two buttons)
  - apps/web/src/components/tour/FirstRunTour.tsx (step 8 text)
  - connect-cards (640 max width)
- Reach: Every new user.
- Acceptance criteria:
  - Option B names what is different from A.
  - The consent card is one sentence and two buttons.
  - Divider, welcome, question and connect cards share one width.
  - Tour step 8 does not repeat the name.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C19 [P3] Finance charts and layout: empty column under Breakdown, partial month drawn for one series, zero months, uneven ticks, 11 px text
- Rank: 19. Effort: M. Reopens: Pass-13 C7 and C12 residuals.
- Finding ids (found by): V2-01 (V2, R1 (as R1-14-07)); V2-21 (V2, R2 (as R2-14-14)); V2-14 (V2, J1 (as J1-07, Last charge wrap)); V2-02 (V2); V2-03 (V2); V2-17 (V2); R2-14-08 (R2). All ids: V2-01, R1-14-07, V2-02, V2-03, V2-14, V2-17, V2-21, R2-14-14, R2-14-08, J1-07
- Root cause: Grid places Breakdown beside a tall right column (Finance.tsx:682); the chart code draws Oct* for Revenue only and clamps the Financing marker; the overview starts at Nov '25 while Burn starts Mar '26.
- Verification: V2-01 observed and grid read at Finance.tsx:682; R1 passed pass-13 C7 for the card height, so this is a different gap (P3, visual).
- Files:
  - apps/web/src/pages/Finance.tsx:682 (two flex columns)
  - apps/web/src/components/finance/charts.tsx (partial month, range start, ticks, financing marker)
  - apps/web/src/components/finance/ui.tsx
- Reach: Finance users.
- Acceptance criteria:
  - Left column has no gap larger than 80 px below Breakdown at 1440 and 1920.
  - Both charts start at the first non-zero month.
  - Out line and area end on the same month.
  - Secondary text is 12 px and 'Last charge' stays on one line.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C20 [P3] Small targets, sidebar keyboard order, unlabeled dot and chart bars
- Rank: 20. Effort: S.
- Finding ids (found by): V1-05 (V1); J1-08 (J1); J3-02 (J3); V2-15 (V2); V2-13 (V2); V3-08 (V3); J2-11 (J2). All ids: V1-05, J1-08, J3-02, V2-15, V2-13, V3-08, J2-11
- Root cause: Page rows have tabindex -1 (arrow keys only), the Data room unseen dot has no label, vendor link and several links are under 24 px, bar chart has no per-bar label, the Legal badge says 'due soon' for an overdue count.
- Verification: J3-02 and J2-11 confirmed in code (Finance.tsx:995 no rk-tap; Shell.tsx:4555 'due soon'). V1-05 observed.
- Files:
  - apps/web/src/components/SidebarPageLink.tsx (keep first page row at tabindex 0 or add a role and label)
  - apps/web/src/pages/Shell.tsx:4552-4558 (Legal badge label to match what is counted)
  - apps/web/src/pages/Finance.tsx:999 (add rk-tap as in components/finance/ui.tsx:732)
  - Inbox To do checkbox, chat stall links, stats bars aria-label
- Reach: Keyboard and touch users.
- Acceptance criteria:
  - Tab reaches the first page row.
  - Unseen dot has an accessible name.
  - Vendor link is at least 44 px on a coarse pointer.
  - Legal badge label matches the number shown.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C21 [P3] Contacts and Artifacts polish: bare empty state, phone rows drop the organization, ambiguous 'Added' filter
- Rank: 21. Effort: S.
- Finding ids (found by): FLOW-04 (FLOW); V3-10 (V3); V3-11 (V3). All ids: FLOW-04, V3-10, V3-11
- Root cause: Contacts empty state is text only, not the shared icon-title-action pattern; phone columns keep a truncated email; Artifacts filter has no 'Any time'.
- Verification: Observed.
- Files:
  - apps/web/src/pages/Contacts.tsx
  - apps/web/src/pages/Artifacts.tsx
- Reach: Contacts and Artifacts users.
- Acceptance criteria:
  - Contacts with no rows shows icon, title and one sentence with Add contact.
  - At 375 the second line shows the organization.
  - The Artifacts date filter lists 'Any time' and shows it by default.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C22 [P3] Legal table, graph and deadline polish: blank Status cells, graph needs sideways scroll, no history of done items, ragged phone buttons
- Rank: 22. Effort: M.
- Finding ids (found by): V2-04 (V2); V2-05 (V2); J2-09 (J2); V2-18 (V2). All ids: V2-04, V2-05, J2-09, V2-18
- Root cause: Status renders only for Draft or Unknown; the graph does not fit its panel; Done items vanish; deadline rows size the date by content.
- Verification: Observed. J2-09 matches an older catalog gap (S-LEG-06) and is a feature, so P3.
- Files:
  - apps/web/src/pages/Legal.tsx
  - apps/web/src/components/legal/LegalGraph.tsx:178
  - deadline row layout
- Reach: Legal users.
- Acceptance criteria:
  - Status shows 'Active' or the column hides when all rows are active.
  - Graph fits the panel without a sideways-scroll hint.
  - A Done filter lists handled deadlines.
  - Phone buttons share one x.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C23 [P3] Layout polish: wrapped or misaligned controls
- Rank: 23. Effort: S.
- Finding ids (found by): J2-12 (J2); J2-13 (J2); J2-14 (J2); J3-03 (J3); V1-11 (V1). All ids: J2-12, J2-13, J2-14, J3-03, V1-11
- Root cause: Individual widths: Carta menu 128 px, routine schedule 'at' wraps at 360 px, Cleanup shows two leading nav controls, sign-up form jumps on error, routine instruction placeholder.
- Verification: Observed.
- Files:
  - Investors header dropdown
  - RoutineSchedule.tsx
  - RoutineEditor.tsx
  - Inbox Cleanup header
  - sign-up page
- Reach: Minor.
- Acceptance criteria:
  - Each listed control renders on one line or aligned at its stated width.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C24 [P3] Cached content is replaced by skeletons on revisit
- Rank: 24. Effort: S.
- Finding ids (found by): J1-09 (J1). All ids: J1-09
- Root cause: Chief thread and Integrations show skeletons while revalidating.
- Verification: Observed once on a dev stack under load; re-measure on a production build.
- Files:
  - thread loader in apps/web/src/pages/Shell.tsx
- Reach: Everyone, brief.
- Acceptance criteria:
  - Returning to a just-viewed Chief thread shows its messages immediately.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

## Deferred items (not in a cluster)
- J1-04 first Inbox sync shows skeletons for about 70 s then 'Sorting' 30 s: emulator and dev server under load, SUSPECTED; re-measure on an idle production build.
- J3-05 'Draft a reply' took 59 s: scripted demo model, not representative.
- R3-04 deep link showed 'Opening Praci...' over 10 s at load average 113: environment; the 'Try again' fallback worked.
- J1-05 tour opens on the next page after the first card is answered: matches the behaviour recorded in iteration 13 (tour held while connect cards are pending); catalog should state the trigger. Not a defect.
- J1-06 and V3-09 Investors skeleton bars, Action items outline and phone truncation: page owned by another session; no P0/P1.
- FLOW-09 one Google sign-in for Gmail, Calendar and Drive: OAuth BLOCKED, third iteration open. Owner question: can one Google consent cover all three, and should Chief show one 'Connect Google' card?
- R1-14-05 blank 'Chief's computer' box: demo fixture uses a fake:// screen URL.
- V1-14, V2-20 sidebar space named 'Reconnect needed' and empty section header: demo seed data.
- V1-13 phone message actions without a gap: device emulation without touch, not confirmed.
- V2-19 white Page artifact in the dark app: isolated preview by design.
- J2-15 three bots named 'New Bot': accepted, rename prompt works.
- J2-10 filed SAFE does not appear in Investors: consistent with the owner decision (Mercury is the only SAFE record); a pointer line could be added later.
- Catalog drift (not product): STORY-APP-024 says Artifacts is in the user menu, it is a sidebar row; STORY-APP-309 and 307 model step not reachable on the demo.
- Not verifiable this pass: pass-13 C1 criterion 3 (a failed run expires the card), C2 live failing send, C4 phone focus and OAuth, C19 touch and Contacts double ring, C15 CSV preview, C13 Contacts at 1920.

## BLOCKED stories
- STORY-APP-309 / 307 model step and 'Connect your apps' (demo has a default model; OAuth).
- STORY-CAP-017 Carta connect, STORY-FIN-019/020 connect and crypto, Gmail/Calendar/Brex/Box OAuth.
- STORY-INB-109 Spam tab, 340 unread, six preselected Cleanup senders (not seeded); STORY-APP-211 Carta agent and Legal deadline Done on a fresh user (no data).
- STORY-FIN-022 reconnect (no fixture); Draft agent skills from chat (scripted model cannot be steered).
- Touch targets for R1, R2, V1, V2, V3 (no coarse pointer); phone width for Fundraising and Investors, 1.2 GB upload, held Share card, secret request card, voice, native iOS.
- Pass-13 clusters C23-C31 do not exist in iteration-13 clusters.json (22 clusters), so R3 could verify only C21 and C22.

## Counts by severity
- Clusters: 24 (P0 0, P1 1, P2 12, P3 11)
- Distinct finding ids in clusters: 96
- Needs a product decision: C2, C13, C17
- P1: C1
- P2: C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13
- P3: C14, C15, C16, C17, C18, C19, C20, C21, C22, C23, C24
