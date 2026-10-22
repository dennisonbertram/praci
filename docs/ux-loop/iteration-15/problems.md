P0: 0, P1: 2, P2: 15, P3: 8

# Iteration 15 problems: fix clusters

Sources: R1-R3 (verify pass-14 clusters), J1-J3 (journeys, J3 at phone width with coarse-pointer measurement), FLOW, V1-V3 (visual), all on the mock demo stack (web 5381). Iterations 1-14, docs/ux-flow and docs/ux-visual were read. Findings were deduplicated (each id keeps its walker in 'found by'), checked against code where cheap, and clustered by root cause. A pass-14 cluster whose criteria are not met appears with a 'Reopens' line. Rank: P0, then severity x reach / effort. The empty file alk-R1.md in the folder is a stray and was ignored.

Owner decisions respected and not re-raised: tour stays nine stops with a fixed card (the phone card breaking this is C7); the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Legal row actions Ask agent / Done / Dismiss; approval toasts persist, bottom-right; Settings in five sections with Memory under Advanced; Carta-only agent for the cap table; Mercury is the only SAFE record; Hide amounts hides money in app UI only; Needs reply newest first; first sort shows unsorted rows dimmed after 15 s.

Environment caveats: the demo is shared by about ten walkers, so counts, Hide amounts state and load times changed under everyone. No walker except J3 could set a coarse pointer; touch targets are judged from J3 only. Perf findings measured under load are P3 or deferred. OAuth steps were BLOCKED.

Severity calls: P1 is limited to two items. C1: money shown in clear next to a masked sentence, confirmed in code. C2: a human cannot read the mail they are asking about, confirmed in code, and this reopens passes 11 and 14. Lowered from reported P1: V2-02 Activity (seen once at 1920, R1 saw it work at 1440) to P2 in C12; J2-01 investor update figure (the founder reviews the draft before sending) to P2 in C16. Reported P2, now P3: V1-05, V1-06 (cosmetic), V3-03 and V1-10 (load average above 100), J2-04. No P0: no money moved wrongly and no data was lost on a verified path (C13 deadline loss was seen on the mock model only).

## Pass-14 cluster verification (R1-R3)

- Met: C1 Cmd+K masking, C5 drawer/Activity/Page agents, C6 palette ranking, C7 bot settings, C8 Data room layout (except the sidebar row, C3 here), C10 Legal scan feedback (new defects in C13), C15 menu rows, C21, C22, C23, Storybook smoke 1736/1736.
- Not met (reopened): C2 Inbox To do (C4), C3 delegated payment (C14, unverified live), C4 toasts (C15 and unverified with a docked panel), C11 tour on phone (C7), C12 Integrations first paint (C8), C16 mail dialog (C2), C17 Advanced name (C23), C19 Finance charts (C10), C24 cached content (C8).
- Not run: C13 denied payment (code shows 'Replaced by a newer request' and 'Expired' in AskCard.tsx:42-43), C14 smoke fix confirmed by R3, C20 coarse-pointer parts, C9 focused mode.

## Fix clusters, ranked

### C1 [P1] Hide amounts: the result card under a chat reply shows cash and burn in clear while the sentence above it is masked
- Rank: 1. Effort: XS.
- Finding ids (found by): V1-01 (V1), R3-04 (R3)
- Root cause: The transcript's 'card' block renders each line value as a bare <span>{line.v}</span> and does not pass it through maskCurrencyWhenHidden, which the text blocks of the same file use (transcript.tsx:1549, 1561).
- Verification: CONFIRMED in code: transcript.tsx:1759 renders {line.v} unmasked; text blocks at :1549 and :1561 use the mask. Observed by V1 (DOM text node '$1,633,221' raw) and R3 (bubble '$•••', card clear).
- Files:
  - apps/web/src/pages/shell/transcript.tsx:1756-1759 (wrap line.v with maskCurrencyWhenHidden; the component already calls useHideAmounts at :1378)
  - any other tool-result card renderer under apps/web/src/components/ai or pages/shell that prints a money value (grep for card values and result lines)
  - apps/web/src/pages/shell/transcript.test.tsx (regression)
- Reach: Anyone with Hide amounts on who asks Chief about cash, burn or runway: the masked sentence and the clear figures sit in one reply, which defeats the setting on a board call or screen share.
- Acceptance criteria:
  - With Hide amounts on, a reply with a Cash/Burn result card shows no digit-grouped dollar amount anywhere in the bubble or the card; turning the switch off shows the figures again without reload.
  - A unit test that renders a card block with value '$1,633,221' fails when the mask call is removed.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C2 [P1] Ask agent in an email below 1568 px covers the right half of the mail, so the body is cut mid-sentence and the dialog's previous/next/close are hidden; sender address splits at the hyphen on phone
- Rank: 2. Effort: S.
- Reopens: Iteration 14 C16 (dialog jump, address split), iteration 11 C12 (panel covers half the email)
- Finding ids (found by): V2-01 (V2), R2-15-02 (R2), R2-15-04 (R2), J3-06 (J3), V2-12 (V2)
- Root cause: Below 1568 px the agent panel is absolutely positioned over the 768 px dialog (InboxMessageDialog.tsx:624) and the mail column keeps its full 736 px width, so text runs under the panel. Pass 14 C16 fixed the dialog 'jumping' by overlaying the panel; nothing reserves space for it. Phone header: addresses use break-words so they split at hyphens (:386,406,410) and the date shares the sender row.
- Verification: CONFIRMED in code: line 624 'absolute inset-y-0 end-0 ... min-[1568px]:relative'; the comment at :141-146 says the panel 'overlays the email's right side' below 1568 px. Observed by V2 (12-ask-agent.png) and R2 (mail-1440-b.png).
- Files:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx:142-147 and :342 (when agentBot is open below 1568 px give the mail pane padding-end equal to the panel width, or widen the dialog to about 1150 px from 1280 px; keep the left edge where the 768 px dialog has it)
  - apps/web/src/components/inbox/InboxMessageDialog.tsx:386,406,410 (whitespace-nowrap per address, overflow-wrap:anywhere only as fallback; date on its own line under 640 px)
  - apps/web/src/components/inbox/InboxMessageDialog.test.tsx or an e2e at 1440 (regression)
- Reach: Everyone who presses Ask agent on a mail on a laptop-size screen (1280-1567 px), which is most desktop users; phone users see the split address on every mail.
- Acceptance criteria:
  - At 1440x900 with Ask agent open, every line of the mail body is fully readable (no text under the panel) and previous/next/close stay clickable.
  - Opening Ask agent does not move the dialog's left edge or the first line of the mail text by more than 0 px (pass-14 C16 criterion kept).
  - At 375 the sender and recipient addresses never break at a hyphen; the date is on its own line.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C3 [P2] Data room sidebar row opens pre-filtered to 'Status: Failed' with only the failed files
- Rank: 3. Effort: XS.
- Reopens: Iteration 14 C8 (badge opens failed list: kept, row behavior changed)
- Finding ids (found by): FLOW-02 (FLOW), J3-01 (J3)
- Root cause: SidebarPageLink for the Data room navigates to /app/data-room?status=failed whenever any file failed (Shell.tsx:4653-4659), so the whole row, not just the red badge, opens the failed view. Pass 14 C8 asked that the badge open the failed list; it did not ask for the row to do so.
- Verification: CONFIRMED in code: Shell.tsx:4657-4659 sends the row to ?status=failed. Observed by FLOW, J3 (4 steps against 3).
- Files:
  - apps/web/src/pages/Shell.tsx:4653-4659 (row navigates to /app/data-room; the badge gets its own click target to ?status=failed, with stopPropagation and the existing aria-label '# file failed')
  - apps/web/src/pages/shell/ (SidebarPageLink and glanceBadge: allow a badge-level onClick)
  - apps/web/e2e or Shell test for the sidebar row (regression)
- Reach: Every user with at least one failed file who wants to browse the Data room (raise journey) sees only failed rows and may not notice the 'Filters 1' chip.
- Acceptance criteria:
  - With one failed file, clicking the Data room row opens /app/data-room with no filter and all files listed.
  - Clicking the red badge opens /app/data-room?status=failed with the removable 'Status: Failed' chip (pass-14 C8 criterion kept).
  - The badge is a separate control with the 44 px coarse-pointer hit area and a label.
- Needs product decision: true (Should the Data room row always open all files and only the red badge open the failed view (recommend yes)? Keep a 'Replace/Retry' action on failed rows for a later pass.)
- Depends on: none
- Conflicts with: C6, C12, C20, C21 (Shell.tsx; land C3 first, it is a few lines)

### C4 [P2] Inbox: the 'To do' card still repeats threads that are visible Needs reply rows, and a replied mail keeps its 'Action' tag and old date
- Rank: 4. Effort: S.
- Reopens: Iteration 14 C2 (criterion 1 and 'replied mail keeps tag' not met)
- Finding ids (found by): R1-15-01 (R1), R1-15-02 (R1), R1-15-03 (R1), J1-02 (J1)
- Root cause: repeatsRow hides a to-do only when it is undated and its English text starts with reply/respond/answer (Inbox.tsx:1068-1076), so dated to-dos from a visible Needs reply thread still repeat, and the row carries no 'To do' mark. A sent reply does not re-triage the thread, so InboxRow keeps the attention tag (InboxRow.tsx:238).
- Verification: CONFIRMED in code for the first part: Inbox.tsx:1068-1074 requires !todo.dueOn and a reply-prefix regex. Second part observed by R1 (two reloads); cause suspected.
- Files:
  - apps/web/src/pages/Inbox.tsx:1066-1080 (match on messageId/threadId alone; show the due date as a mark on the row)
  - apps/web/src/components/inbox/InboxRow.tsx:238 (clear the attention tag when the newest message in the thread is the user's own, or re-triage on send)
  - apps/web/src/pages/Inbox.tsx send/undo toast (replace 'Sending...' with 'Sent' when the send completes; keep cached body while the thread refetches)
  - apps/web/src/pages/Inbox.test.tsx (regression)
- Reach: Daily Inbox users: the first screen shows the same task twice and an already-answered mail still looks urgent.
- Acceptance criteria:
  - No To do item shares a thread with a visible Needs reply row, dated or not.
  - After Send, the thread's row shows no 'Action/Urgent/Important' tag within one refresh and the date matches the latest message.
  - After the undo window ends the toast reads 'Sent' (or disappears) instead of staying on 'Sending...'.
- Needs product decision: false
- Depends on: none
- Conflicts with: C18 (Inbox.tsx)

### C5 [P2] Data room: the row checkbox has an 18 px tap area on touch; a near miss opens the preview
- Rank: 5. Effort: XS.
- Finding ids (found by): J3-02 (J3)
- Root cause: On coarse pointers the 44 px slot is an aria-hidden spacer span and the Checkbox itself is size-4.5 (18 px) positioned over the icon (ItemRows.tsx:336-350), so only 18 px is tappable. The Inbox row makes its 44 px wrapper the hit area.
- Verification: CONFIRMED in code: aria-hidden spacer 'size-11' plus Checkbox 'pointer-coarse:size-4.5'. Measured 18x18 by J3 with CDP touch emulation.
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx:336-350 (make the 44 px wrapper the label/hit area of the checkbox, as InboxRow does)
  - apps/web/src/components/data-room/ItemRows.test.tsx (regression)
- Reach: Anyone selecting files on a phone or tablet; owner rule: 44 px targets on coarse pointers.
- Acceptance criteria:
  - With a coarse pointer every Data room row 'Select ...' control has a hit area of at least 44x44 px; tapping the slot toggles selection and never opens the preview.
  - Fine-pointer layout is unchanged (24 px hit area from pass-14 C8).
- Needs product decision: false
- Depends on: none
- Conflicts with: C9 (ItemRows.tsx)

### C6 [P2] Settings: safety switches show OFF while rules load, and Settings from the account menu did nothing on a Chief thread
- Rank: 6. Effort: S.
- Finding ids (found by): V1-09 (V1), R2-15-08 (R2)
- Root cause: The Privacy and approvals section renders default (false) values until the rules call returns (about 2 s), so 'Ask before sending external email' and 'Ask before purchases' show OFF then flip ON. Separately an effect closes Settings on every pathname change (Shell.tsx:859), which can race with the account menu's navigation on the Chief thread route (suspected).
- Verification: R2-15-08 SUSPECTED (reproduction not reliable; effect at Shell.tsx:859 exists). V1-09 observed with before/after screenshots.
- Files:
  - apps/web/src/components/ (Privacy and approvals settings section: skeleton or disabled switches until the server value is known)
  - apps/web/src/pages/Shell.tsx:859 and :3558 openSettings (do not reset settingsOpen for a pathname change that opened it; reproduce on /app/:botId first)
  - settings test for the loading state (regression)
- Reach: Every user who opens Settings (the loading state is seen on each open); the open failure was seen by one walker, 3 of 3 tries on the Chief thread, 0 of N on Finance.
- Acceptance criteria:
  - While rules load, no safety switch shows a value; they appear disabled or as skeletons and never flip after render.
  - Account menu > Settings opens the dialog on the Chief thread route, on Finance and on an agent chat, in 5 of 5 tries.
- Needs product decision: false
- Depends on: none
- Conflicts with: C3, C12, C20, C21 (Shell.tsx)

### C7 [P2] Phone tour card jumps from the foot to the top of the screen from stop 5, so Next moves
- Rank: 7. Effort: S.
- Reopens: Iteration 14 C11 (phone card position criterion not met)
- Finding ids (found by): R2-15-01 (R2), V1-02 (V1), V1-03 (V1)
- Root cause: Phone placement of the tour card depends on the target's position and flips to the top for upper targets, so the card does not keep one spot. The owner decision is a fixed card at one spot with Next in the same place; desktop meets it, phone does not (stops 1-4 at the drawer foot, 5-9 or 8-9 at the top, Next y=756 to 78 to 116).
- Verification: Observed by R2 (ph-grid.png) and V1 (tour375-2/8/9.png); walkers differ on the stop where it flips (5 vs 8), so check the placement logic first. Not located in code yet.
- Files:
  - apps/web/src/components/tour/TourPopover.tsx (phone placement: pin to the drawer foot at every stop)
  - apps/web/src/components/tour/ (scroll the highlighted drawer row into view above the card; inset the highlight ring for rows touching the viewport edge)
  - tour test at 375 px (regression)
- Reach: Every new phone user taking the tour (nine stops).
- Acceptance criteria:
  - At 375x812 the Next button has the same y (within 2 px) on all nine stops.
  - The highlighted row is visible above the card at every stop; no stop covers Search, Create or the drawer Close button.
  - On desktop step 9 the highlight ring is not cut by the viewport edge.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C8 [P2] Integrations: first paint shows skeleton rows with no search or chips, dark-theme logos are black on a dark tile, and revisits show skeletons again
- Rank: 8. Effort: S.
- Reopens: Iteration 14 C12 (blank tiles on first paint) and C24 (cached content on revisit)
- Finding ids (found by): R2-15-03 (R2), R3-01 (R3), V1-08 (V1)
- Root cause: IntegrationsHome renders its toolbar only after data arrives (IntegrationsHome.tsx:626-668) and re-queries without cached data on revisit; popular-service SVGs in public/logos/simple are single-colour black and not inverted in dark mode; some apps fall back to letter tiles.
- Verification: Observed by R2 (int-early.png), R3 (6 nodes, 480 ms, dev build) and V1. Logo colour issue not checked in code.
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx:626-668 (render search and chips at once; grid skeleton only)
  - apps/web/src/pages/Integrations*.tsx (use cached list while revalidating)
  - apps/web/public/logos/simple/*.svg and the logo tile component (invert or tint monochrome logos in dark mode; one placeholder style for missing logos)
  - Integrations story and e2e screenshot (regression)
- Reach: All users on the Integrations page, the door to connecting every app; the blank-looking tiles are on first view.
- Acceptance criteria:
  - The search box and filter chips are visible in the first frame, before data loads.
  - Google Calendar, Drive, Slack, Notion, GitHub, Linear and Airtable logos are visible in dark and light themes (contrast at least 3:1 against the tile).
  - Returning to Integrations within a session shows the list in the first frame (0 skeleton nodes).
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C9 [P2] Data room list: Name column is squeezed to about 280 px by fixed empty columns, phone header takes 30% of the screen, failed rows triple-signal, auto-sort and text preview polish
- Rank: 9. Effort: M.
- Reopens: Iteration 14 C8 and C9 (layout/auto-sort polish)
- Finding ids (found by): V3-01 (V3), V3-02 (V3), V3-05 (V3), V3-10 (V3), R1-15-07 (R1), J2-11 (J2), J3-07 (J3)
- Root cause: ItemRows' colgroup gives Type 144, Added 96, Parties 192 and Status 80 px fixed widths so the unspecified Name column gets the remainder (ItemRows.tsx:205-212); the phone toolbar stack (DataRoom.tsx:669-760) shows consent, search, filters and view toggles above the first row; tiles and stats use p-3 instead of the page gutter.
- Verification: V3-01 and V3-02 read from code and measured from screenshots; others observed. J3-07 may be mock-data behaviour (suspected).
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx:205-212 (Name at least 40% of list width; Status inside the name cell or narrower; em dash for empty Parties)
  - apps/web/src/components/data-room/ItemRows.tsx:448 and DataRoomStats.tsx (use the page horizontal gutter)
  - apps/web/src/pages/DataRoom.tsx:669-760 and FilterBar.tsx (move view toggles into the Filters sheet; one-line consent card on phones)
  - apps/web/src/components/data-room/ItemRows.tsx failed row (drop either the pill or the message in the list; 56 px row rhythm)
  - apps/web/src/components/data-room/AutoSortDialog.tsx:179-183 (title matches scope; skip one-file sub-folder proposals)
  - apps/web/src/components/data-room/ preview dialog (show text for text/plain files)
- Reach: All Data room users (raise journey); wrapped names and five-line snippets at 1440, 5 visible rows on a phone.
- Acceptance criteria:
  - At 1440 the Name column is at least 340 px and 'MOCK Term Sheet Draft - Quill Capital.pdf' fits on one line.
  - At 375 with filters closed the first file row top is under 160 px (pass-14 C8 criterion kept) and the three view toggles are not in the main bar.
  - Banner, filter bar, list rows, tiles and stats end at the same right edge (within 1 px).
  - A failed row is no taller than 64 px and shows one failure signal.
  - A one-change auto-sort plan is not titled 'Sort every file in the Data room'.
- Needs product decision: false
- Depends on: none
- Conflicts with: C5 (ItemRows.tsx)

### C10 [P2] Finance burn chart draws the partial month as two stacked dots that read as an '8'; quarter and year charts start empty; Hide amounts leaves '..%' strings
- Rank: 10. Effort: M.
- Reopens: Iteration 14 C19 (partial month drawn for one series, zero months)
- Finding ids (found by): FLOW-05 (FLOW), J1-04 (J1), J2-08 (J2), V2-03 (V2), R2-15-06 (R2), V2-08 (V2), V2-09 (V2), V2-10 (V2), V2-14 (V2)
- Root cause: The partial month (Oct*) draws Out and Revenue markers for one column detached from the line, with the Financing callout floating 110 px above; Quarter starts at Q1 '25 with flat zero quarters and Year uses a half-width scale with clipped y labels (charts.tsx). finance-format.ts:134-150 masks change percentages as '..%'.
- Verification: Observed by four walkers (FLOW, J1, J2, V2); code not opened for the chart marker. V2-08 'may be intended'.
- Files:
  - apps/web/src/components/finance/charts.tsx (partial month: dashed segment or one labelled dot with hover tooltip; Quarter/Year start at the first non-zero period, full-width scale, room for y labels; anchor the Financing marker on its month)
  - apps/web/src/pages/Finance.tsx (phone header: sync text wraps, Hide amounts keeps its label; one range control component and default across Overview and Accounts)
  - apps/web/src/lib/finance-format.ts:134-150 (omit the percentage while hidden)
  - Finance chart stories (regression)
- Reach: Every Finance user (four walkers independently saw the '8'); board-prep journey.
- Acceptance criteria:
  - The Oct* column shows no pair of overlapping markers: the partial month is one connected, labelled point.
  - Quarter chart starts at the first period with data; Year chart uses the full width and no y label is clipped.
  - With Hide amounts on no text of the form '..%' or '...%' appears on the Finance page.
  - Overview and Accounts use the same range control and default.
- Needs product decision: true (While Hide amounts is on, should change percentages be omitted (recommend yes, since the decision says only money is hidden but a percentage of a hidden amount reveals it), or masked as now?)
- Depends on: none
- Conflicts with: none

### C11 [P2] Legal contracts table rows are misaligned and tall at 1440; phone cards repeat five labels; done deadlines cannot be reopened
- Rank: 11. Effort: S.
- Finding ids (found by): V2-04 (V2), V2-06 (V2), R3-02 (R3)
- Root cause: LegalContracts.tsx uses fixed percentage columns with whitespace-normal cells and a top-aligned first cell next to centered cells (V2-04); the phone card list repeats five labels per contract (V2-06); done deadlines show only the short-lived Undo toast (R3-02).
- Verification: V2-04 and V2-06 observed with measurements; code not re-opened. Pass-14 C22 (Legal polish) was verified PASS by R3.
- Files:
  - apps/web/src/pages/legal/LegalContracts.tsx:195-250 (one vertical alignment, widths so Renewal fits one line, rows near 40 px) and :170-188 (phone cards: parties under title, term and renewal on one line, omit Value while hidden)
  - apps/web/src/pages/Legal.tsx (~line 475, Reopen button on done rows)
  - Legal tests (regression)
- Reach: All Legal users; 9 of 10 contracts fit at 900 px, under 4 on a phone.
- Acceptance criteria:
  - At 1440 all cells in a row share one baseline (within 1 px) and rows are at most 48 px for single-line content.
  - On a phone at least 5 contracts fit on one screen without repeated labels; with Hide amounts on no '...' Value line is shown.
  - A done deadline in 'Show done' has a Reopen button that moves it back to open.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C12 [P2] Activity: opening it does nothing visible when the list is scrolled, shows 1 of 3 items, repeats bot rows and disagrees with them
- Rank: 12. Effort: S.
- Reopens: Iteration 14 C5 (Activity pushes the bot list)
- Finding ids (found by): V2-02 (V2), V3-04 (V3), R1-15-08 (R1), V3-12 (V3)
- Root cause: ActivityList sits inside the scrolling sidebar list with max-h-40 (ActivityList.tsx:167, container Shell.tsx:4702), so it opens above the visible area when the list is scrolled and caps at 160 px; its items are also shown in the bot list below with a different time window; first load takes two awaited runs.list calls (ActivityList.tsx:56-76); the filter popover is a native select with a heavy ring.
- Verification: Cap and container CONFIRMED in code (ActivityList.tsx:167). Scroll-position failure observed once (suspected).
- Files:
  - apps/web/src/pages/ActivityList.tsx:167 and :56-76 (scroll the list to top on open; show a count; render the first result as it arrives)
  - apps/web/src/pages/Shell.tsx:4702 (hide bot rows already listed in Activity, or one 'needs answer' source for both)
  - apps/web/src/pages/ActivityList.tsx filter (use the shared menu component)
- Reach: Users with several bots needing answers; severity lowered from the reported P1: R1 verified Activity at 1440 (C5 PASS) and V2 saw the invisible open once, at 1920 with the list scrolled 139 px.
- Acceptance criteria:
  - Pressing Activity with the sidebar list scrolled down shows the panel in view.
  - The panel shows every waiting item or a '3 need you' count.
  - A bot appears as 'Needs your answer' in one place at a time, and both views agree.
  - The first run result renders within 1 s of arriving.
- Needs product decision: true (Should Activity replace the bot list rows it already shows (recommend: hide those rows from the list while Activity is open), or become an overlay that does not move the list?)
- Depends on: none
- Conflicts with: C3, C6, C20, C21 (Shell.tsx)

### C13 [P2] Legal scan: re-scan overwrote deadlines and values and added non-contracts; 'Reading 35 of 35' stays for 2 minutes; the 'not yet checked' banner leads to a dead end
- Rank: 13. Effort: M.
- Reopens: Iteration 14 C10 (scan feedback met; correctness regressions new)
- Finding ids (found by): R1-15-04 (R1), R1-15-05 (R1), J2-03 (J2)
- Root cause: The scan merge replaces existing fields with the new extraction even when it returns none (deadlines 8 to 4, next-deadline blank, values changed, handbook listed as a contract); progress counts documents opened, not finished, with no 'Saving' phase; the banner's Review link opens a Data room filter without a way to run the check.
- Verification: R1-15-05 observed (before/after screenshots) but not traced in code; J2-03 observed; R1-15-04 may be demo-model speed (suspected).
- Files:
  - apps/api (Legal scan merge: keep existing deadlines and values the user did not edit when a re-scan returns none; do not add non-contract documents as contracts)
  - apps/web/src/pages/Legal.tsx (progress count for finished documents plus a 'Saving results' phase; banner action 'Check now' or the action on the filter chip)
  - packages/ Legal scan tests (regression with a scripted model that returns nothing)
- Reach: Every Legal user who re-scans; loss of deadlines is the worst case in the app's legal journey. The mock model may be nondeterministic (suspected), but the merge rule is a product rule.
- Acceptance criteria:
  - A re-scan whose extraction returns no deadline leaves existing deadlines unchanged (count before equals count after).
  - Handbooks and offer letters are not listed as contracts.
  - The progress line advances as documents finish; a distinct 'Saving results' phase shows while the final write runs.
  - The banner offers an action that runs the check, and the count shows only documents Legal can use.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C14 [P2] A bot asking Mercury to pay is told to 'authorize it directly' without a pointer, and no approval card exists to verify the pass-14 waiting label
- Rank: 14. Effort: M.
- Reopens: Iteration 14 C3 (not verifiable live)
- Finding ids (found by): R1-15-06 (R1)
- Root cause: When another bot delegates a payment the Mercury agent refuses with 'requires you to authorize the $N payment directly first' and creates no card (executor.ts around :2998); the follow-up links to Integrations, where nothing can be authorized. Pass-14 C3 criteria (waiting label, tail link, outcome line) could not be seen live.
- Verification: Observed (refusals at $300 and $277); card flow UNVERIFIED live, code only.
- Files:
  - apps/api/src/executor.ts (~:2998 bot-originated payment handling: link to the Mercury agent chat, 'Approve it there'; drop the Integrations link)
  - apps/web/src/pages/Shell.tsx:4185 (waitingForApprovalLabel already used when delegatePending)
  - api test with a scripted delegated payment (regression)
- Reach: Users who let a bot (for example Cash watcher) pay bills; the refusal blocks the flow and does not say where to go.
- Acceptance criteria:
  - The bot's reply names the Mercury agent chat and links to it; no Integrations link for this case.
  - A live delegated request produces an approval card or a documented refusal; the composer shows 'Waiting for approval' while pending (needs a live check).
  - Typing the same payment in the Mercury chat still creates the Send/Deny card ($55 case).
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C15 [P2] Approval toast repeats the text of the docked page-agent chat
- Rank: 15. Effort: XS.
- Reopens: Iteration 12/14 C4 (toasts clear when the chat is open)
- Finding ids (found by): J2-02 (J2)
- Root cause: AppToaster decides an agent's chat is open from the route /app/:botId only (AppToaster.tsx:75-77, 98-102), so a bot shown in the docked panel counts as closed and its 'needs an answer' toast still appears.
- Verification: CONFIRMED in code: only useMatch('/app/:botId') feeds resultShownInOpenChat. Observed by J2.
- Files:
  - apps/web/src/components/AppToaster.tsx:75-77 and :98-102 (also treat the bot shown in the docked panel as open)
  - AppToaster test (regression)
- Reach: Anyone using page agents (Legal, Finance, Inbox) in the docked panel.
- Acceptance criteria:
  - With the Legal agent open in the docked panel, its 'needs an answer' notification is skipped (not shown as a toast).
  - A different bot's notification still shows.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C16 [P2] Investor update draft quotes $350,000 raised; the Investors page shows $250,000
- Rank: 16. Effort: S.
- Finding ids (found by): J2-01 (J2)
- Root cause: Two sources of truth: the Investors page computes raised money from non-SAFE holders plus Funded SAFEs (Investors.tsx:150-175, core cap-table.ts:68), while cap_table_read returns the stored snapshot amountRaisedUsd (350,000 in the demo seed, packages/testkit data.ts:1475). The agent therefore writes a number the founder cannot find on the page.
- Verification: CONFIRMED in code and data: seed amountRaisedUsd 350000; page ignores it. Agent output observed by J2.
- Files:
  - packages/core/src/cap-table.ts (one shared function for raised money)
  - apps/web/src/pages/Investors.tsx:150-175 (use the shared function)
  - packages/adapters/src/builtin-tools.ts cap_table_read (return the same computed figure; drop or relabel the stored amountRaisedUsd)
  - packages/testkit/src/cli/demo/data.ts:1475 (seed consistent with the page)
  - test that page and tool agree on a snapshot with Funded and Sent SAFEs
- Reach: Investor-facing updates drafted by the Investors agent; the founder reviews before sending, so the harm is a wrong figure that may be missed. Reported P1, rated P2: not sent automatically.
- Acceptance criteria:
  - For any snapshot, the Investors page 'Equity raised' and the figure returned by cap_table_read are equal.
  - A drafted update contains only amounts that appear on the Investors page.
  - Sent and Signed SAFEs are never counted as raised (decision kept).
- Needs product decision: true (When Carta supplies an amount raised, should the page show Carta's figure (and the agent the same) or the computed Funded total (recommend computed, labelled with its source)?)
- Depends on: none
- Conflicts with: none

### C17 [P2] Investors cap table and Fundraising round/pipeline stay as grey skeleton bars when there is no data
- Rank: 17. Effort: S.
- Reopens: Iteration 14 deferred J1-06, V3-09
- Finding ids (found by): J1-05 (J1), FLOW-07 (FLOW)
- Root cause: The loading branch never ends for a null snapshot or empty list: Investors renders skeleton rows while cap is not loaded or the SAFE list is empty (Investors.tsx:416, 914-922) and Fundraising renders three 36 px skeletons while overview is null (Fundraising.tsx:228-233). Reported in pass 14 (J1-06, V3-09) and deferred as another session's page; it is now seen by three walkers.
- Verification: Observed (J1 screenshots 31-32; FLOW p-Fundraising.png; J2 unreported). Code read at the lines given. Coordinate with the Investors/Fundraising owner.
- Files:
  - apps/web/src/pages/Investors.tsx:416, 914-922 (quiet empty line instead of loading bars when the call returned null/[])
  - apps/web/src/pages/Fundraising.tsx:228-233 (same; skeleton only while the request is in flight)
  - page tests with null and empty responses (regression)
- Reach: New users and any space with no cap table: the first Investors/Fundraising view looks like endless loading.
- Acceptance criteria:
  - With snapshot null and no SAFEs the page shows an empty line or the connect buttons, with no skeleton once the response arrived (under 1 s).
  - While the request is in flight a skeleton shows, and an error shows Try again.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C18 [P3] Inbox first sort and send feedback: skeleton rows are 36 px against 57 px real rows, the filter has two 'Important' controls, the sort wait is long on the demo
- Rank: 18. Effort: S.
- Reopens: Iteration 10 C-sorting (15 s decision)
- Finding ids (found by): FLOW-01 (FLOW), J1-01 (J1), V2-05 (V2), V2-07 (V2)
- Root cause: Skeleton rows use h-9 (Inbox.tsx:1627, 1673) while real rows are 57 px, so the list jumps; the Filter menu repeats 'Important' next to the Important tab. The 15 s dim and 60 s 'longer than usual' states exist in code (Inbox.tsx:761, 601, 1712-1722, 1783); the 1-minute wait is the scripted demo model (suspected).
- Verification: Code present for the timers (not a code defect; demo speed suspected). Re-measure on an idle production build before changing timers.
- Files:
  - apps/web/src/pages/Inbox.tsx:1627 and :1673 (real row height; reserve the status line height)
  - apps/web/src/pages/Inbox.tsx filter menu (rename or remove the second 'Important')
- Reach: Every first sort; cosmetic jump only.
- Acceptance criteria:
  - Skeleton row height equals real row height (within 2 px); the list does not move when 'Sorting your mail...' appears.
  - No two controls share the name 'Important'.
- Needs product decision: false
- Depends on: none
- Conflicts with: C4 (Inbox.tsx)

### C19 [P3] Cold load and refetch: 'Opening Praci...' for 9-19 s under load, 16 routines/list and 5 bots/list calls per load
- Rank: 19. Effort: M.
- Finding ids (found by): V2-13 (V2), V1-10 (V1), V3-03 (V3)
- Root cause: The sidebar fetches routines per bot (16 calls) and bots 5 times on one load; the shell skeleton has no page skeleton (ShellSkeleton.tsx:27). Slow loads were measured with load average above 100 on a dev server (suspected environment).
- Verification: Call counts observed by V2 (network log); slow seconds suspected load. Re-measure on a production build.
- Files:
  - apps/web (sidebar routines query: one call for all bots)
  - apps/web/src/components/ShellSkeleton.tsx:27 (page header and list skeleton)
  - bots/list de-duplication in the shell data layer
- Reach: Every load; most visible on slow networks.
- Acceptance criteria:
  - One page load issues at most one routines/list and one bots/list request.
  - A page header and skeleton show within 2 s while data loads.
- Needs product decision: false
- Depends on: none
- Conflicts with: C12 (sidebar data in Shell.tsx)

### C20 [P3] Phone and touch polish: page rows are buttons not links, sticky hover on touch, inconsistent tool tally, space name spacing, first-run divider width
- Rank: 20. Effort: S.
- Finding ids (found by): J3-03 (J3), J3-04 (J3), J3-05 (J3), V3-08 (V3), R2-15-07 (R2)
- Root cause: Sidebar page rows are <button>s (J3-03); Inbox row hover/focus styles apply on touch and the '...' button covers the time (J3-04); the chat summary counts tools differently while working and when done (J3-05); PageHeader shows the space name with different gaps per page (V3-08); the NEW divider is 900 px against 640 px cards (R2-15-07).
- Verification: Observed; J3-03 by DOM query. Components not all located.
- Files:
  - apps/web/src/pages/Shell.tsx (~4640-4700, render page rows as router links)
  - apps/web/src/components/inbox/ InboxRow hover styles under (hover: hover) and hide the time while the actions button shows
  - chat tool-summary component (single tally)
  - apps/web/src/components/PageHeader.tsx (hide the space name on phones everywhere or one gap)
  - first-run chat divider (cap at card width)
- Reach: Phone users; keyboard and screen-reader users for the link semantics.
- Acceptance criteria:
  - Each page row is an <a href> and can be opened in a new tab.
  - On touch, a tapped Inbox row has no sticky hover look and the time is not covered.
  - Working and Done show the same tool count.
  - The space name has one treatment on Contacts, Investors, Data room and Artifacts at 375.
- Needs product decision: false
- Depends on: none
- Conflicts with: C3, C6, C12, C21 (Shell.tsx)

### C21 [P3] Command palette, shell focus and sidebar consistency: empty-state copy, key caps, search autofocus ring, Page agents open state, second space
- Rank: 21. Effort: S.
- Finding ids (found by): V3-09 (V3), V1-14 (V1), V2-11 (V2), FLOW-04 (FLOW), FLOW-03 (FLOW)
- Root cause: Palette empty state names three sources although chats are searched too (V3-09); footer shows Enter as an icon and Esc as bare text (V1-14); sidebar search autofocuses with a thick ring on every load (V2-11); Page agents opens or closes per page (FLOW-04); 'Open' on a non-main space creates a second Chief with the first-question card (FLOW-03).
- Verification: Observed; FLOW-03 came from an accidental click on a demo-seeded 'Reconnect needed' space (V1-14 deferred earlier), so its behavior may be by design.
- Files:
  - apps/web/src/pages/shell/command-palette.tsx (empty copy 'No matches'; key caps for Enter and Esc; Cancel on phones)
  - apps/web/src/pages/Shell.tsx (do not autofocus search on load, or use the quiet ring; remember the Page agents group state; do not auto-create Chief on 'Open' of a space)
- Reach: All users; low harm.
- Acceptance criteria:
  - Palette empty state does not list sources; Enter and Esc use the same key-cap style.
  - Loading any page does not put a focus ring on Search.
  - Page agents group keeps one open/closed state across pages.
- Needs product decision: true (Should opening another space create a Chief (and its first-question card) automatically, or only on first use of that space's chat?)
- Depends on: none
- Conflicts with: C3, C6, C12, C20 (Shell.tsx)

### C22 [P3] Accessibility basics: textarea has role=combobox, no <main> landmark on auth pages, muted bot-panel text fails contrast
- Rank: 22. Effort: XS.
- Finding ids (found by): V1-11 (V1), V1-12 (V1)
- Root cause: Composer textarea carries role=combobox (not allowed on textarea); sign-in and sign-up have no <main>; the bot panel notifications description uses a low-contrast muted colour.
- Verification: Observed by axe in V1; not rechecked in code.
- Files:
  - composer textarea (valid role or aria-haspopup)
  - auth page layout (wrap in <main>; text-balance on the h1)
  - apps/web/src/pages/shell/bot-panel.tsx (raise muted description colour)
- Reach: Screen-reader users on the two most-visited screens.
- Acceptance criteria:
  - axe reports no aria-allowed-role, landmark-one-main or color-contrast on sign-in, sign-up and the bot panel.
- Needs product decision: false
- Depends on: none
- Conflicts with: C23 (bot-panel.tsx)

### C23 [P3] Settings and bot-panel hierarchy: General account card, Models section, sticky panel header, Advanced groups, two things named Advanced
- Rank: 23. Effort: S.
- Reopens: Iteration 14 C17 (two things named Advanced)
- Finding ids (found by): V1-04 (V1), V1-05 (V1), V1-06 (V1), V1-07 (V1), R2-15-05 (R2)
- Root cause: Account card labels are semibold like card titles and 'Account' sits inline; Models is two lines with no card; the bot panel header has no background so content collides with the title when scrolled; Advanced groups look like top-level sections; Models disclosure is named 'Advanced' like the nav item.
- Verification: Observed with screenshots; files located from walker notes.
- Files:
  - apps/web General settings account card (card title above, row labels at body weight)
  - apps/web/src/components/ settings Models section (wrap in the same card; rename the disclosure 'Model options')
  - apps/web/src/pages/shell/bot-panel.tsx (header background and border when scrolled; indent or separate the Advanced group)
- Reach: All users who open Settings or the bot panel; cosmetic. V1-05 and V1-06 were reported P2 and are P3: nothing is misleading or blocked.
- Acceptance criteria:
  - Account card title is above the rows; row labels are lighter than titles.
  - Scrolled bot panel content never overlaps the header title.
  - Only one control in Settings is named 'Advanced'.
- Needs product decision: false
- Depends on: none
- Conflicts with: C21 (bot-panel/Shell area), C22 (bot-panel.tsx)

### C24 [P3] Routines, Mercury and agent-chat copy: routine run row shows the delegated prompt, monitor icon for Routines, flyout offset, 'Created when you allow changes' title, blank Mercury chat, From line
- Rank: 24. Effort: S.
- Finding ids (found by): J2-05 (J2), J2-06 (J2), J2-07 (J2), J2-04 (J2), J2-10 (J2), J1-03 (J1)
- Root cause: RoutineRunHistory shows the delegated message instead of the routine name; the Routines icon is a monitor and the panel is headed 'Cash watcher's computer'; the schedule flyout opens 17 px above its row; McpDetail.tsx:337-339 titles the agent card as an instruction; the Mercury agent's first chat has no suggested questions; the reply From line shows 'Gmail <address>'.
- Verification: Observed; McpDetail lines from walker notes.
- Files:
  - apps/web/src/pages/RoutineRunHistory.tsx (routine name; a 'ran' line at the top of the reply)
  - apps/web/src/pages/Shell.tsx Bot computer panel (calendar/clock icon; drop empty computer heading)
  - apps/web/src/pages/RoutineSchedule.tsx (align flyout)
  - apps/web/src/components/integrations/McpDetail.tsx:337-339 (title 'Mercury agent')
  - agent chat empty state (two or three read questions)
  - compose From line (display name and address)
- Reach: Users who create routines or enable Mercury; low harm.
- Acceptance criteria:
  - The Test run row shows the routine name.
  - The Mercury card before allowing changes is titled 'Mercury agent' and states what turning the switch on creates.
  - A new Mercury agent chat offers at least two suggested read questions.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C25 [P3] Contacts and Investors tables: columns spread at 1920, duplicate empty-state button
- Rank: 25. Effort: XS.
- Finding ids (found by): V3-07 (V3), R3-03 (R3)
- Root cause: The Contacts table divides 1550 px equally between four columns; the empty state shows 'Add contact' in the header and in the body (Contacts.tsx:120).
- Verification: Observed with screenshots.
- Files:
  - apps/web/src/pages/Contacts.tsx (cap table width near 1200 px or fixed widths; hide the header button while the list is empty)
- Reach: Large-monitor users and first-time Contacts users.
- Acceptance criteria:
  - At 1920 Name and Email are no more than 300 px apart.
  - An empty Contacts page shows one 'Add contact' button.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

## Deferred items (not in a cluster)
- J1-06 no tour stop for Investors, Fundraising, Contacts or Artifacts: nine stops is an owner decision; recorded only.
- FLOW-06 Google Calendar and Drive are separate Connect buttons: OAuth BLOCKED, fourth pass open. Owner question: can one Google consent cover Gmail, Calendar and Drive, and should Chief show one 'Connect Google' card?
- J2-09 insurance deadline text and term disagree by one day: demo seed data.
- J2-12 investor update draft takes about 50 s with no progress: scripted model; stream the draft into the body if it repeats with a real model.
- R1-15-09 Cmd+K document snippet 'Cash 1633221 dollars' is not masked: seeded text without '$' or grouping; optional mask for 'N dollars'.
- V1-13 and V3-11 eight font sizes and off-scale spacing: layout-audit polish with large diff and no user-visible defect; do as a separate token cleanup.
- V1-10 'Opening Praci...' on one cold load at 375 and V3-03: merged into C19 as suspected load; re-measure on an idle production build.
- FLOW-01 and J1-01 90 s first sort: scripted demo model; timers exist in code (C18).
- J1-03 'Maya Chen (Mock)' header name: demo data (the From line part is in C24).
- Not verified live: pass-14 C3 card flow, C4 toast with docked panel, C9 focused mode and stuck-file pill, C13 denied path, C1 mail rows for Cmd+K masking.

## BLOCKED stories
- STORY-APP-309 / 307 model step and 'Connect your apps' (demo has a default model; OAuth).
- STORY-CAP-106 Carta connect, STORY-FIN-019/020 connect and crypto, Gmail/Calendar/Brex/Box/Slack/Notion OAuth.
- STORY-INB-024 term-sheet day, STORY-LEG-001 first week on Legal, STORY-FIN-022 reconnect (not seeded or out of budget; SKIPPED rather than blocked).
- STORY-DRM-109 large zip, video and protected zip steps (synthetic small files used).
- Touch-target checks for R1, R2, V2, V3 (no coarse pointer); only J3 and V1 measured them.
- Phone width for Fundraising and Investors; voice; native iOS; first-run sign-up at 1920.

## Counts by severity
- Clusters: 25 (P0 0, P1 2, P2 15, P3 8)
- Distinct finding ids in clusters: 85
- Needs a product decision: C3, C10, C12, C16, C21
- P1: C1, C2
- P2: C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17
- P3: C18, C19, C20, C21, C22, C23, C24, C25
