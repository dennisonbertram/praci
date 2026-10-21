P0: 0, P1: 7, P2: 19, P3: 3

# Iteration 4 problems: fix clusters

Sources: R2 and R3 (verify pass-3 clusters C11-C28), J2 (raise and operate), FLOW, V1-V3. R1, J1 and J3 did not run: the demo stack and Docker were down when they started, so they produced no findings (see BLOCKED). Earlier files (`docs/ux-flow/report.md`, `docs/ux-visual/problems.md`, iteration 1, 2 and 3 problems) were read; items already decided or fixed are not raised again.

Owner decisions: no iteration file records an owner answer. Decided by merged work and not raised: Hide amounts in the account menu, Settings in five sections, the page is called Apps, consent asked once per area (FLOW-03's 'ask once overall' was dropped), 44 px on coarse pointers, Finance overview under 1300 px (V2-04 not raised), palette is the one search surface, Page agents collapsed row. Still open and raised again: tour length (C11), Devin page visibility (C8), New bot flow (C24), Data room multi-select scope (C23).

Verification against the code (checkout 6f27035a3): confirmed cron.ts:100 (`* * 1`), McpDetail.tsx writes switch only with an agent, Shell.tsx:2071 Devin ungated while Task board is gated, SettingsOverlay.tsx:207 fixed height for Models only, Finance.tsx:947 and FinanceSpend.tsx:321 differing labels, Finance.tsx:616 toneClass on any period, pi-runtime.ts:110/628/638, the Shell.tsx header DOM order, approval-ask.ts:288 fallback, ApprovalRulesSettings presets, AskCard.tsx:109 focus call, Welcome.tsx mark classes. Corrected: R3 cited AccountSettingsOverlay.tsx:252 for the dialog sizing; the sizing is in SettingsOverlay.tsx. V3-01's proposed fix (add an ILIKE leg) was adjusted because a name/metadata chunk already exists (ordinal -1) and the likely gap is failed files never indexed. J2-01's fake tools do serve getRecipient/getAccount, so the miss is on the route match, not the fixture. Not verified (marked suspected): V1-01 with a physical keyboard, J2-01 exact miss, V3-01 cause, R3-10 cause, perf timings on a busy dev stack.

## Clusters (ranked; ids are labels, rank gives the order)

### C1 Finance shows two different figures for one vendor, and a 3-day partial week reads as a red 1261% spending jump (P1, rank 1, score 6.0)
- Root cause: Finance.tsx:947 labels the subscriptions column 'Usual per month' (usual charge, or the last 3 months for usage-based vendors, with the window only in a hover title) while FinanceSpend.tsx:321 shows 'Average per month' over the last 6 full months (metrics.ts). Same vendor, two numbers, no window on the list label. Separately Finance.tsx:605-619 colours changePct with toneClass for any period, including a partial 3-day window against another 3-day window. Verified in code: both labels and the toneClass call exist as described.
- Findings: R3-01, V2-05, V2-16
- Found by: R3, V2
- Evidence: observed by 2 walkers (R3, V2); labels and toneClass call verified in code
- Reach: Every founder who opens Finance; money figures
- Files:
  - apps/web/src/pages/Finance.tsx:947 (column label names its window, or use the same metric as the vendor page)
  - apps/web/src/pages/finance/FinanceSpend.tsx:321 (tile label/sub)
  - packages/core/src/finance/metrics.ts (one shared monthly-figure function if the metric is unified)
  - apps/web/src/pages/Finance.tsx:605-619 (hide change % when the current period is partial and under 7 days; neutral tone below 10%)
  - apps/web/src/pages/Finance.tsx subscriptions table (show the 3-month change under the vendor name below @md instead of dropping it)
  - apps/web/src/pages/Finance.test.tsx and a metrics test
- Acceptance:
  - For every vendor in the demo the list figure and the vendor page figure are equal, or both labels name different windows in words (for example 'Last 3 months' and 'Last 6 months').
  - Week view with a partial current period shows no percentage (or a neutral one); no red arrow for a change under 10%.
  - At 375 px a vendor up 35% still shows the change, under the vendor name.
  - Unit test asserts the list and detail figure for Globex Cloud use one function.
- Needs product decision: no
- Dependencies/conflicts: Finance.tsx is also changed by C22 (layout); merge C1 first, then C22. FinanceSpend.tsx shared with C22.
- Pass: reopens it3 C23 (one vendor shows two figures: criteria not met); effort S

### C2 Red 'tools finished, but the model did not write a final answer' banner contradicts a visible reply, blames the user, never clears, and the sidebar still says 'Waiting for the computer' (P1, rank 2, score 4.0)
- Root cause: MISSING_TOOL_FINAL_RESPONSE_ERROR (pi-runtime.ts:110, thrown at 628 and 638) is stored as a failed-run error even when a delegate agent's message is already in the thread (Chief to Finance hand-off). The composer error bar (apps/web/src/pages/shell/composer-error.tsx, dismiss button 13 px) has no Retry and does not clear on the next successful run. The sidebar status comes from run-phase.ts:9 ('Waiting for the computer') and is not cleared when the run is Done. Part of the trigger may be the demo's placeholder key; the banner staying after a visible answer is the app's behaviour. Verified in code: message text and its two throw sites.
- Findings: V2-01, R2-06, R3-12, J2-05, FLOW-10, J2-12
- Found by: V2, R2, R3, J2, FLOW
- Evidence: observed by 5 walkers (V2, R2, R3, J2, FLOW); code verified
- Reach: Everyone who asks Chief a question that is delegated; seen in Chief, Investor Relations, Legal and as 'Chief failed' toasts on pages where nothing was sent
- Files:
  - packages/adapters/src/pi-runtime.ts:110,628,638 (message text: 'Chief could not finish. Try again.'; do not raise when the run delegated and a later reply exists)
  - apps/web/src/pages/shell/composer-error.tsx (Retry button, 24 px dismiss, clear on next successful run)
  - apps/web/src/lib/run-phase.ts:9 and roster-status.ts (clear status when the run ends; 'Working' instead of 'Waiting for the computer')
  - apps/web/src/pages/Shell.tsx (sidebar preview takes the last message, not the user's question)
  - apps/web/src/pages/shell/composer-error.test.tsx, apps/web/src/lib/roster-status.test.ts, pi-runtime-tool-dispatch.test.ts (update message)
- Acceptance:
  - After a Chief to Finance hand-off that returns the figure, no red banner is shown and the sidebar preview shows the Finance reply.
  - When a run really ends without a reply, the bar reads 'Chief could not finish. Try again.' with a Retry button and a dismiss target of at least 24 px.
  - The banner clears on the next successful run.
  - A bot row never shows 'Waiting for the computer' after its run is Done.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx also touched by C3, C8, C17, C25, C28; keep this change to the status/preview lines. Locale .po files update with pnpm lingui extract.
- Pass: partly reopens it3 C13 (Chief and routine results lag) and it3 C26; effort M

### C3 Keyboard Tab cannot leave the sidebar header; Settings close and the sidebar resize edge also break focus (P1, rank 3, score 4.0)
- Root cause: The header (Shell.tsx:4084-4106) renders the 'Hide sidebar' button, the mobile 'Close menu' button and then the Create Popover trigger. Walker V1 saw Tab cycle Activity, Hide sidebar, a Base UI focus-guard span (tabindex 0, x=-1), Hide sidebar, without ever reaching Create, the Pages list, bots, Apps or the user menu (16 presses, reproduced twice by CDP key events). Not yet confirmed with a physical keyboard. Verified in code: the DOM order matches, the guard itself is not visible in the source. A second 'Hide sidebar' button exists on the 8 px drag edge (Shell.tsx:5198) and Settings close returns focus to the wrong control.
- Findings: V1-01, V1-17, V1-18
- Found by: V1
- Evidence: observed (CDP key events, 2 reproductions); suspected cause not confirmed by a physical keyboard
- Reach: All keyboard and switch-access users; every page
- Files:
  - apps/web/src/pages/Shell.tsx:4084-4106 (stop the closed Create popover from adding a tab stop; check how ui-web Popover renders its focus guards)
  - packages/ui-web (popover primitive, only if the guard comes from the vendored component)
  - apps/web/src/pages/Shell.tsx:5198 (name the edge 'Resize sidebar', tabIndex -1)
  - apps/web/src/pages/SettingsOverlay.tsx (restore focus to the user-menu trigger on close)
  - new Playwright/Vitest Tab-order test through the header
- Acceptance:
  - From Search, pressing Tab 6 times reaches Create, then the first page row, without repeating Hide sidebar.
  - Shift+Tab and Tab traverse the same set of controls.
  - After Escape closes Settings, document.activeElement is the user-menu trigger.
  - Only one control named 'Hide sidebar' exists in the accessibility tree.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx header region; SettingsOverlay.tsx also in C10. Do C3 before C28 (sidebar polish) because both edit the header.
- Pass: new in it4 (it3 V1-20 / it2 a11y items did not cover the tab order); effort S

### C4 'Every week' routine has no day picker and silently means Monday (P1, rank 4, score 4.0)
- Root cause: cron.ts:100 maps freq 'Every week' to `${minute} ${hour} * * 1`. RoutineSchedule.tsx offers no weekday control, and a routine named 'Friday investor note' runs on Monday with no warning. Verified in code: the Monday-only cron string.
- Findings: J2-03
- Found by: J2
- Evidence: observed by 1 walker; code verified
- Reach: Anyone scheduling a weekly bot task
- Files:
  - packages/core/src/cron.ts:100 and presetFromCron (add a weekday to the preset; round-trip from the stored cron)
  - apps/web/src/pages/RoutineSchedule.tsx:19 (day select shown for 'Every week'; control label 'Every Monday')
  - packages/core/src/cron.test.ts
- Acceptance:
  - Choosing 'Every week' shows a weekday select defaulting to Monday; choosing Friday stores `m h * * 5`.
  - Reopening the routine shows the saved weekday, and existing Monday routines read 'Every Monday'.
  - cron test covers all 7 days and the round trip.
- Needs product decision: no
- Dependencies/conflicts: None. Small, isolated.
- Pass: new in it4; effort S

### C5 Money approval card shows raw ids ('recipient_mock_acme', 'chk-1111') instead of names (P1, rank 5, score 2.7)
- Root cause: approval-ask.ts:288-290 falls back to the raw recipientId and accountId when moneyNames is empty. resolveMoneyNames reads names through readApprovalName (executor.ts:3586-3621), which needs a sibling getRecipient/getAccount tool on the same MCP resource and a deps.connector; any miss returns undefined and the card shows ids. The demo fake (finance-fake-tools.ts:135-146) does serve getRecipient/getAccount, so the lookup is failing somewhere on the route match (candidate.route.resourceId or the tainted-thread shortcut at executor.ts:3617). The exact miss is suspected, not traced.
- Findings: J2-01
- Found by: J2
- Evidence: observed by 1 walker; fallback path verified in code; cause suspected
- Reach: Anyone approving a payment (Mercury, Brex)
- Files:
  - packages/adapters/src/executor.ts:3586-3621 (reproduce first; fall back to the recipient/account list the agent already read in the same turn)
  - packages/adapters/src/approval-ask.ts:288-290
  - packages/adapters/src/finance-fake-tools.ts (only if the demo route lacks the tools)
  - packages/adapters/src/approval-ask.test.ts and an executor test: card text contains the recipient and account names
- Acceptance:
  - In the demo stack the approval card reads 'Send $1,200.00 to Acme (Mock) from MOCK Checking ..1111?' (names, not ids).
  - If a name lookup fails, the card says 'a recipient' with the amount, never a raw id, and Details still shows the ids.
  - Executor test covers lookup success, lookup failure and a tainted thread.
- Needs product decision: no
- Dependencies/conflicts: executor.ts is large and shared; no other cluster edits it.
- Pass: reopens it3 C5 (money approval card still raw ids); effort M

### C6 Mercury 'Allow changes' switch is hidden until an agent exists; Chief refuses a payment with no next step (P1, rank 6, score 2.7)
- Root cause: McpDetail.tsx:246-290 shows the writes switch only inside IntegrationAgentSection, which renders when `hasAgent && server.agentBotId && !keyRoute`. Before the user clicks 'Create agent' the page shows only Reconnect, Disconnect, Create agent and Rename. When Chief is asked to pay it answers 'no payment workflow connected here' with no link. The switch also stays off for about 4 s after its dialog closes. Verified in code: the render condition.
- Findings: J2-02, J2-10
- Found by: J2
- Evidence: observed by 1 walker; render condition verified in code
- Reach: Founders who want an agent to pay a bill
- Files:
  - apps/web/src/components/integrations/McpDetail.tsx:246-290 (a 'Let agents pay bills' row before an agent exists, or create the agent on first enable)
  - apps/web/src/components/integrations/McpDetail.tsx (switch shows on or pending immediately after the dialog confirms)
  - Chief refusal text for write-off integrations: link to the integration page (apps/api tool-result text or prompt that produces it, locate by grepping 'payment workflow')
  - apps/web/src/components/integrations/McpDetail.test.tsx
- Acceptance:
  - On a connected Mercury page with no agent, a visible control enables changes; no 'Create agent' click is required first.
  - After confirming the dialog the switch reads on (or 'Turning on') within 300 ms.
  - Asking Chief to pay when changes are off yields a reply with a link to the Mercury page.
- Needs product decision: no
- Dependencies/conflicts: McpDetail.tsx only; independent of C5 but both are part of the pay-a-bill story, test them together.
- Pass: reopens it3 C5 (Mercury writes-off dead end); effort M

### C7 Data room search cannot find a file by name when the file could not be read (P1, rank 7, score 2.7)
- Root cause: Search (packages/db/src/data-room.ts:889 area, keywordBest at ~838) joins data_room_chunks only. A name and metadata chunk (ordinal -1) is written by the index job (data-room-jobs tests at lines 380-395), so a file whose read failed (here 'MOCK Signed NDA - Bolt Freight.pdf', 'This file isn't a readable PDF') most likely never reaches indexing and has no chunk. Searching 'Bolt' or 'Signed NDA' returns other files, while the placeholder and the preview copy promise name search. Cause is suspected, not traced.
- Findings: V3-01, V3-13
- Found by: V3
- Evidence: observed by 1 walker; search structure verified in code; cause suspected
- Reach: Anyone searching the Data room for a document that failed to read; includes the story 'Bolt Freight is waiting on the NDA'
- Files:
  - packages/adapters/src/data-room-jobs.ts (write the name chunk when the read fails) or packages/db/src/data-room.ts (name match as a second search leg)
  - apps/web/src/components/data-room/FilterBar.tsx:278 (placeholder only if the behaviour stays name-only for unread files)
  - apps/web/src/components/data-room/ untagged message (V3-13: short 'Not tagged' with an action, remove the false sentence)
  - packages/db/src/data-room.postgres.test.ts: failed file found by name
- Acceptance:
  - Searching 'Bolt' and 'Signed NDA' in the demo returns 'MOCK Signed NDA - Bolt Freight.pdf'.
  - A test seeds a failed item with no text and finds it by a word in its name.
  - The untagged-file text is at most six words and contains no claim the search cannot meet.
- Needs product decision: no
- Dependencies/conflicts: Data room components are also edited by C23 and C26 (different files except FilterBar.tsx: coordinate with C26).
- Pass: new in it4; effort M

### C8 Devin is a top-level page for every founder and is empty until connected (P2, rank 8, score 6.0)
- Root cause: Shell.tsx:2071-2075 adds the Devin page to appPages unconditionally, while Task board a few lines below is gated on bootstrapMe.ticketBoardEnabled (Shell.tsx:2085). Unconnected, the page is one sentence and a button, with no Ask, so it is a fifth door to connecting an app. Verified in code. The Devin page plan (memory: S1-S5 merged) intended a real page; whether it should hide before connection is the open question.
- Findings: FLOW-02
- Found by: FLOW
- Evidence: observed; gating difference verified in code
- Reach: Every founder who does not use Devin (page list, Cmd+K, page options)
- Files:
  - apps/web/src/pages/Shell.tsx:2071-2075 (gate on a connected Devin key like Task board)
  - Command palette and Page options use the same appPages list (no second change)
  - apps/web/src/pages/Shell.test or sidebar test for the page list
- Acceptance:
  - A user with no Devin connection sees no Devin row in the sidebar, Cmd+K or Page options; the Apps page still offers a Devin card.
  - After connecting, the row appears without reload.
- Needs product decision: yes. Hide the Devin page until Devin is connected (recommended; the Apps card is the way in), or keep it always visible?
- Dependencies/conflicts: Shell.tsx only; one-line list change. Touches appPages used by C17.
- Pass: new in it4 (it3 never questioned Devin); effort XS

### C9 Inbox thread header has six equal buttons; Undo disappears before 'Sent'; Digest and Cleanup rough edges (P2, rank 9, score 3.0)
- Root cause: InboxMessageDialog.tsx renders Reply, Reply all, Forward, Archive, Mark unread and Ask agent as equal outline buttons. After Send, Undo is shown for about 6 s while 'Sending...' lasts about 7.5 s, so Undo vanishes 1.5 s before 'Sent'. The Cleanup empty state names its rule but does not point to Newsletters (8 mails, 'Archive all 8' in Digest). Digest 'Open' buttons are 22 px high; whether 'Archive all N' offers Undo is not confirmed.
- Findings: R2-03, R2-05, R2-07, V2-18, V2-15
- Found by: R2, V2
- Evidence: observed by 2 walkers; V2-18 suspected
- Reach: Everyone who reads and replies to mail
- Files:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx (Reply the only filled button; Forward, Mark unread, Ask agent in a menu)
  - apps/web/src/pages/Inbox.tsx send path / toast (keep Undo until status reads Sent)
  - apps/web/src/components/inbox/InboxCleanup.tsx (empty state links to Newsletters digest)
  - apps/web/src/components/inbox/InboxDigest.tsx (Open button to 28 px; confirm Archive all shows Undo)
  - tests and stories for the three components (pnpm design-system)
- Acceptance:
  - Thread header has one filled Reply and at most two other visible actions at 1440 and 375.
  - Undo stays visible until the status reads Sent.
  - Cleanup empty state contains a link to Newsletters when it holds mail.
  - Archive all N shows an Undo toast.
- Needs product decision: no
- Dependencies/conflicts: InboxMessageDialog.tsx and Inbox.tsx also in C12 (Inbox.tsx). Do C12 and C9 in one branch if one implementer; otherwise C12 first.
- Pass: reopens it3 C17 and C16 (criteria partly unmet); effort S

### C11 First-run tour is still nine stops; its copy says agents ask before they send or pay while the switches show off (P2, rank 10, score 3.0)
- Root cause: FirstRunTour.tsx:24-63 defines nine stops, five of which repeat a visible sidebar label; it3 C11 asked the owner whether to cut to three and no answer is recorded. The tour's closing text says 'Agents ask before they send, pay or change anything' but on a new account the three Action confirmations switches (ApprovalRulesSettings.tsx:130 presets) and AI data sharing read off. Payments did ask in the demo ('asked for your approval first because it is a payment'), so the copy may be true and the Settings state misleading; not verified. At 375 one Escape closes the tour and the drawer together; popovers have no pointer and step 7 covers the first question.
- Findings: FLOW-01, R2-01, V1-03, V1-04, V1-05, R2-11
- Found by: FLOW, R2, V1
- Evidence: observed by 4 walkers; code locations verified, approval default unverified
- Reach: Every new user
- Files:
  - apps/web/src/components/tour/FirstRunTour.tsx:24-97 (stops; copy)
  - apps/web/src/components/tour/TourPopover.tsx (Escape stops propagation; pointer; placement)
  - apps/web/src/components/ApprovalRulesSettings.tsx:130 (state vs real server default; align display or copy)
  - FirstRunTour.test.tsx (assert step count)
- Acceptance:
  - Step count equals the decision (3 if cut) and a test asserts it.
  - The tour copy about asking first matches what Settings shows for a new account.
  - At 375 the first Escape ends the tour and leaves the drawer open.
- Needs product decision: yes. Cut the tour to three stops (Chief, Pages, Apps) ending in the composer (recommended; asked in iteration 1, 2 and 3), or record 'keep nine' as final? And for the approval line: default the email and purchase confirmations on, or reword the tour line?
- Dependencies/conflicts: FirstRunTour.tsx only; independent of other clusters.
- Pass: reopens it3 C11 (decision still open); effort S

### C10 Settings dialog changes height and position per section, General is long, small a11y and copy defects (P2, rank 11, score 2.0)
- Root cause: SettingsOverlay.tsx:207-208 fixes the height only for section === 'models' (h-[min(760px,...)]), so the dialog is 327-820 px tall, re-centres, and the nav list jumps (the General row sits at y=73/155/103/320/282). Walker R3 cited AccountSettingsOverlay.tsx:252-270 for this; that file is the General section, the sizing is in SettingsOverlay.tsx (verified). General holds a Password form that is always open plus Export, Usage and Delete cards (1409 px in a 743 px pane). The Usage line reads '21 tasks done by your bots - - tokens' with a bare dash. aria-modal is set but #root is not inert. 'Add email attachments to the Data room' is still a Privacy switch (AutoFileEmailSetting.tsx, used only by AccountSettingsOverlay.tsx), and the Data room Email import dialog has no such control. Memory's empty state reads as a content row.
- Findings: V1-02, R3-05, V1-11, R2-09, R3-03, FLOW-08, V1-19
- Found by: V1, R3, R2, FLOW
- Evidence: observed by 3 walkers (V1, R3, R2, FLOW); sizing line verified in code
- Reach: Everyone who opens Settings
- Files:
  - apps/web/src/pages/SettingsOverlay.tsx:207-208 (same fixed height for every section, content pane scrolls, top pinned)
  - apps/web/src/pages/AccountSettingsOverlay.tsx (Password behind a 'Change password' row; Export, Password, Delete under one Account card; hide '- tokens' when unknown)
  - apps/web/src/pages/AccountSettingsOverlay.tsx and the data-room Email import dialog (move AutoFileEmailSetting.tsx there)
  - apps/web/src/pages/MemorySettingsOverlay.tsx (muted empty state, hide download when empty)
  - Settings dialog (set inert on #root while open)
  - SettingsOverlay.test.tsx, AccountSettingsOverlay.test.tsx and stories
- Acceptance:
  - The Models nav item stays at the same y position in General, Privacy, Models, Voice and Memory at 1440x900.
  - General fits in one pane height without the Password form open by default.
  - With Settings open, #root is inert.
  - The email-attachments switch is in the Data room Email import dialog and not in Settings.
- Needs product decision: no
- Dependencies/conflicts: SettingsOverlay.tsx also in C3 (focus on close) and C14; the Data room dialog file is not touched by C7/C23/C26 unless they edit the same Email dialog.
- Pass: reopens it3 C20 (Settings density: criteria partly unmet) and C19; effort M

### C12 Inbox: two tab rows, a consent card and a To-do card push the first mail to 290 px (538 px on a phone); badge and Needs reply counts differ; Digest control is a lone icon (P2, rank 12, score 2.0)
- Root cause: Inbox.tsx renders the header, pile tabs (Important, Updates, Newsletters), account tabs (All, Founder mail, Sales mail), a 60 px consent card and then 'Today'. The first sender sits at y~290 at 1440 (was 200) and y~538 at 375 (limit 400). The sidebar badge counts 13 while Needs reply shows 19. The Digest toggle (Inbox.tsx:1240-1264) is a newspaper icon about 1,000 px from the tabs it belongs to. Counts and layout observed; Inbox.tsx line numbers from V2.
- Findings: FLOW-04, V2-03, R2-02, R2-04, V2-08
- Found by: FLOW, V2, R2
- Evidence: observed by 3 walkers (FLOW, V2, R2)
- Reach: Every daily Inbox user
- Files:
  - apps/web/src/pages/Inbox.tsx (account choice into the Filter menu or an account chip when there are two accounts; consent as a one-line banner; To-do card one line on phones)
  - apps/web/src/pages/Inbox.tsx:1240-1264 (labelled List/Digest segmented control next to the pile tabs)
  - apps/web/src/pages/Shell.tsx badge source (one definition of the number, or label it 'unread')
  - Inbox.test.tsx and stories
- Acceptance:
  - First mail row starts at or above y=220 at 1440x900 and above y=400 at 375x812 with the consent card shown.
  - Only one tab row is visible with one connected account; with two, the account choice is a chip or menu.
  - The sidebar badge and the Needs reply tab show the same number, or the badge says 'unread'.
  - 'Digest' is a labelled control next to the tabs.
- Needs product decision: no
- Dependencies/conflicts: Inbox.tsx also in C9; consent wording in C13. Do after C9 or in the same branch. Shell.tsx badge line conflicts lightly with C2.
- Pass: reopens it3 C17 (sorting state, counts, mobile first screen: criteria unmet); effort M

### C13 Legal: a message to the Legal agent sends while consent is missing and then asks for Allow a second time; the held message is not re-sent (P2, rank 13, score 2.0)
- Root cause: Legal.tsx shows 'Let Praci read your contracts / Allow' above the table while the agent composer stays enabled; a message then fails with a second Allow in the panel (Shell.tsx panel error). After the page's Allow, the panel keeps 'needs your permission' and the held message is sent twice when resent. Observed by J2; whether the table showing data while consent is off is seed data was not established. Ask-once-per-area is an earlier decision and stays: this cluster does not merge areas.
- Findings: J2-06, J2-05, FLOW-03
- Found by: J2, FLOW
- Evidence: observed by 1 walker (J2); FLOW-03's wider four-prompt claim dropped as already decided (consent asked once per area)
- Reach: Anyone using the Legal agent before granting consent
- Files:
  - apps/web/src/pages/Legal.tsx (consent card)
  - apps/web/src/pages/Shell.tsx (clear the panel permission error when consent changes; re-send the held message once after Allow)
  - apps/web/src/components/legal/ConsentPrompt.tsx
  - Legal.test.tsx
- Acceptance:
  - With consent missing the composer is disabled with the single Allow, or the panel Allow is the only one shown.
  - After Allow, the panel error clears and the held message runs exactly once.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx panel-error lines also in C2 (composer-error.tsx is separate); Legal.tsx also in C16.
- Pass: reopens it3 C9 (consent shown twice); effort S

### C14 Settings > Models: sign-in, Replace key field and two buttons all open while connected; active model stated three times (P2, rank 14, score 2.0)
- Root cause: ModelSettingsOverlay.tsx:1029-1127 renders, for a connected provider, 'Disconnect', 'Sign in with OpenRouter', the Replace API key field and both Test and Replace buttons, plus an 'ACTIVE MODEL' line that repeats the dropdown and 'Connected'. At 375 the provider list is its own scroll box inside the scrolling dialog.
- Findings: R3-04, FLOW-09, V1-20
- Found by: R3, FLOW, V1
- Evidence: observed by 3 walkers (R3, FLOW, V1)
- Reach: Anyone changing a model or key
- Files:
  - apps/web/src/pages/ModelSettingsOverlay.tsx:1029-1127 (one 'Replace key' fold and Disconnect while connected; remove the ACTIVE MODEL line)
  - ModelSettingsOverlay.tsx (provider list grows with the page below 640 px)
  - ModelSettingsOverlay.test.tsx
- Acceptance:
  - A connected provider shows 'Connected', Replace key and Disconnect; the field and sign-in appear only after Replace key.
  - The model name appears once in the pane.
  - At 375 the provider list has no inner scroll.
- Needs product decision: no
- Dependencies/conflicts: ModelSettingsOverlay.tsx only; nav-jump fix is in C10.
- Pass: reopens it3 C20 (duplicate credential actions); effort S

### C16 Legal deadlines: no action on a row, three rows with the same title, Active chip on every contract (P2, rank 15, score 2.0)
- Root cause: Legal.tsx deadlines list offers only Done and Dismiss. 'Send non-renewal notice' (due in 11 days) has no way to draft the notice or ask the agent; 'Pay Cascade Robotics onboarding fee' has no link to Finance. Titles repeat ('Renews automatically' x3, 'Send non-renewal notice' x4) with the contract only on the second line. The 'Active' chip repeats on all 10 contract rows; the Overdue KPI (1) is red but the table shows no marker; 54 px gap under the tabs.
- Findings: J2-09, V2-13
- Found by: J2, V2
- Evidence: observed by 2 walkers (J2, V2)
- Reach: Anyone managing contracts
- Files:
  - apps/web/src/pages/Legal.tsx (row action 'Ask agent to draft'; contract name in the title; status chip only when not Active; Overdue KPI links to the overdue row; remove the 54 px gap)
  - Legal.test.tsx and stories
- Acceptance:
  - Each deadline row has a visible 'Ask agent' action that opens the Legal agent with the row as context.
  - No two rows share an identical first line.
  - The contracts table shows no chip for Active.
- Needs product decision: no
- Dependencies/conflicts: Legal.tsx also in C13; do C13 first.
- Pass: new in it4; effort S

### C17 Command palette ranks agents first for unrelated queries and gives no match reason; sidebar search repeats a 'Message' label (P2, rank 16, score 2.0)
- Root cause: Shell.tsx palette search returns Chief first for 'pilot' (no match in its snippet) and the Data room agent first for 'bolt'; matched text is not highlighted; the same artifact is 'MOCK Customer Pipeline.csv' in the palette and 'MOCK Customer Pipeline' on the Artifacts page. The empty palette shows 7 of 20 entries with no scroll cue or key hint. Sidebar search rows each carry a 'Message' label (8 times).
- Findings: V3-07, V3-08, R2-10
- Found by: V3, R2
- Evidence: observed by 2 walkers (V3, R2)
- Reach: Every Cmd+K user
- Files:
  - apps/web/src/pages/Shell.tsx (palette: rank by name match first, agents only on a name hit, highlight the match; one display name for artifacts; bottom fade and key-hint footer)
  - apps/web/src/pages/Shell.tsx sidebar search rows (drop the repeated label)
  - palette tests
- Acceptance:
  - 'pilot' and 'bolt' return a result whose name or text contains the query first.
  - Matched text is highlighted.
  - Artifact names are identical in the palette and on the Artifacts page.
  - A key-hint footer and a bottom fade show when the list scrolls.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx palette region; also C2, C3, C8, C28.
- Pass: reopens it3 C18 in part (search quality); effort S

### C18 Missing or slow loading states: blank chat panel for ~20 s, Apps detail blank for 4-6 s, repeated spaces.list calls (P2, rank 17, score 2.0)
- Root cause: The Investor Relations thread panel showed no skeleton or spinner until threads/get returned (about 25 s on a busy demo stack; the missing indicator is real, the duration is inflated). Direct navigation to an Apps detail page is blank for 4-6 s (J2). Boot shows a composer-pill skeleton instead of a page header (V3). /rpc/spaces/list was called 10 times in 307 s of light use (limit under 10) and notifications, unseenCounts and routines/list 13 times each. Finance Accounts showed grey skeletons for more than 15 s once (not reproduced). Dev-server timings: measure on an idle build before tuning.
- Findings: V2-02, J2-10, V3-18, R2-08, V2-09, V2-10, R3-14
- Found by: V2, J2, V3, R2, R3
- Evidence: observed by 5 walkers (V2, J2, V3, R2, R3); duration claims need an idle re-measure
- Reach: Every user on a slow connection or cold load; reach 3 for the chat panel
- Files:
  - apps/web/src/pages/shell chat thread loader (locate by grepping threads.get; render a message skeleton and a disabled composer with a reason)
  - apps/web/src/components/integrations/McpDetail.tsx (skeleton)
  - apps/web/src/App.tsx / ShellSkeleton.tsx:27 (page header skeleton)
  - apps/web/src/pages/Shell.tsx spaces.list caller (share one cached result, poll at 30 s)
  - apps/web/src/pages/finance (fetch accounts at the Finance shell)
- Acceptance:
  - Opening any chat thread shows message skeleton rows within 100 ms.
  - Apps detail shows a skeleton, not an empty page.
  - spaces.list is called at most 4 times in 5 minutes of idle use.
  - Measured on a production build; timings are recorded in the PR.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx again (spaces.list); see C2, C17.
- Pass: reopens it3 C15 (cold load and bootstrap); effort M

### C19 Answering a chat question drops focus to the page body; approval card and hand-off lines are inconsistent (P2, rank 18, score 2.0)
- Root cause: AskCard.tsx:109 focuses [data-composer-input] after onAnswer resolves, but R3 saw document.activeElement = BODY about 4 s later after the Chief onboarding question; the composer (composer.tsx:956) is probably disabled or re-mounted while the run starts, so the focus call hits nothing (suspected, not traced). The approval card body ('From Mercury checking.') is monospace unlike other cards. Each hand-off shows two near-identical lines ('Messaged Finance agent', 'Message from Finance agent').
- Findings: R3-10, V2-14
- Found by: R3, V2
- Evidence: observed once (R3-10), observed (V2-14)
- Reach: Keyboard users, and everyone answering Chief's first question
- Files:
  - apps/web/src/components/AskCard.tsx:109 (focus after the run state settles)
  - apps/web/src/pages/shell/composer.tsx:956 (keep enabled, or expose a ready callback)
  - approval card component under apps/web/src/components (body font)
  - hand-off tool card (collapse the pair into one expandable row)
  - AskCard tests
- Acceptance:
  - After answering an Ask card, document.activeElement is the composer 5 s later.
  - Approval card text uses the body font.
  - A hand-off shows one row.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx not touched; independent.
- Pass: reopens it3 C26 (chat thread and approval cards); effort S

### C15 Cap table: header scrolls away, donut card eats the page, SAFEs are invisible on the page, contact row misaligned (P2, rank 19, score 1.3)
- Root cause: CapTable.tsx:498 makes the whole body one scroller (clientH 900, scrollH 1028), so the header and Add contact scroll out. The donut card is about 240 px for two legend rows and the table starts at y~590 (FLOW measured ~480; the two walkers differ, re-measure). The All tab and donut show Common 84% and Option pool 16% only: four SAFEs ($350,000) appear on the Investors tab with no caps and nothing says they are excluded. Casey Advisor's row is indented 8 px and its third line is truncated; the agent panel opens by default at a third of the width and compresses the table. Table header cells sit 8 px left of body text (also Contacts).
- Findings: V3-02, V3-03, J2-08, FLOW-12, V3-04
- Found by: V3, J2, FLOW
- Evidence: observed by 3 walkers (V3, J2, FLOW); line 498 per V3, not re-read
- Reach: Founders raising money
- Files:
  - apps/web/src/pages/CapTable.tsx:498 (fixed header outside the scroller; compact donut beside the tiles)
  - apps/web/src/pages/CapTable.tsx (SAFE row or note under the donut linking to Investors; contact row same cell structure)
  - apps/web/src/components/cap-table/OwnershipDonut.tsx
  - apps/web/src/pages/Contacts.tsx (header/body padding)
  - CapTable.test.tsx and stories
- Acceptance:
  - At 1440x900 the header and Add contact stay visible while the table scrolls, and at least 9 holder rows show with the agent panel closed.
  - A one-line note 'SAFEs (4, $350,000) are not included until they convert' links to the Investors tab.
  - The agent panel is closed on first open.
  - Header cell text and body cell text start at the same x.
- Needs product decision: no
- Dependencies/conflicts: CapTable.tsx and Contacts.tsx (header padding) overlap C21 on Contacts.tsx; split the padding fix to one of them.
- Pass: reopens it3 C8 (donut card pushes the table down); effort M

### C20 Apps page: connected cards differ in footer, 375 page is 3374 px tall, status line missing on popular cards, Coinbase button wraps at 1280 (P2, rank 20, score 1.3)
- Root cause: IntegrationsHome.tsx gives Gmail, Carta, Mercury and Brex a 'Used by' footer, Coinbase a 'Replace key' button and Blockscout a '...' menu. At 375 one card per row is 107-120 px tall with Connect on a second line (3374 px page). Seven cards share one neutral glyph. Popular cards omit 'Not connected', so card heights differ. FinanceSection.tsx:251-257 lets 'Open Finance' wrap next to 'Replace key' at 1280. The sidebar Apps pill shows Gmail, Calendar and Drive logos for a user with nothing connected.
- Findings: R3-06, R3-07, V1-07, V1-08, V1-09, V1-14
- Found by: R3, V1
- Evidence: observed by 3 walkers (R3, V1); 375 height measured
- Reach: Everyone who connects an app
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (one footer: status, primary action, one overflow menu holding Replace key; Connect on the title row below 640 px; same status line on every card)
  - apps/web/src/components/integrations/FinanceSection.tsx:251-257 (whitespace-nowrap)
  - apps/web/src/pages/Shell.tsx (Apps pill: logos only for connected apps)
  - shared page header component used on Apps, Artifacts, Contacts (see C21)
- Acceptance:
  - Every connected card has the same footer structure.
  - At 375 a card is at most 72 px tall and the page at most 2200 px.
  - No button wraps at 1280.
  - The Apps pill shows no logos for a new user.
- Needs product decision: no
- Dependencies/conflicts: IntegrationsHome.tsx only; the shared header overlaps C21; Shell.tsx pill line overlaps C28.
- Pass: reopens it3 C21 (Apps page: letters, grid, header); effort M

### C21 Artifacts and Contacts: no Ask button, sizes in bytes, row heights, pages lack a shared header, misaligned card footer (P2, rank 21, score 1.3)
- Root cause: Contacts.tsx and Artifacts.tsx have no Ask button although Finance and Data room do; it3 C22 took the default 'add Ask to Contacts for Chief' and it is not there. Artifacts list shows '229 bytes' (Artifacts.tsx:590, format-bytes.ts), rows are 56 px for one line (Contacts rows 37 px), the Size column is left aligned. Card footer text edges differ (664/640 vs 688) and the type label repeats the icon. Apps, Artifacts and Contacts do not share one header component. The demo seed gives customers and the advisor Kind 'Other'.
- Findings: R3-08, V3-05, V3-06, R3-09, R3-07
- Found by: R3, V3
- Evidence: observed by 3 walkers (R3, V3)
- Reach: Everyone who uses Contacts and Artifacts
- Files:
  - apps/web/src/pages/Contacts.tsx and Artifacts.tsx (Ask for Chief, shared header)
  - apps/web/src/pages/Artifacts.tsx:590 and apps/web/src/lib/format-bytes.ts (drop Size or humanise and right-align; row height ~40 px)
  - Artifacts card footer alignment
  - packages/testkit/src/cli/demo/data.ts (contact kinds)
- Acceptance:
  - Contacts and Artifacts each have an Ask button that opens Chief.
  - No size reads 'bytes'.
  - Apps, Artifacts and Contacts render the same header component.
  - Demo customers show Kind Customer.
- Needs product decision: no
- Dependencies/conflicts: Contacts.tsx overlaps C15 (header padding) and C20 (shared header).
- Pass: reopens it3 C22; effort M

### C22 Finance overview layout: lone KPI tile with the Ask panel open, 10-11 px text, inconsistent sub-page headers, stretched cards (P2, rank 22, score 1.3)
- Root cause: Finance.tsx:508-516 lays 5 KPI tiles out 2+2+1 when the Ask panel is open at 1280 (3+2 otherwise); the lone tile is Treasury yield. Chips use text-[10px] (Finance.tsx:874,978; FinanceAccounts.tsx:87) and Legal graph labels 11 px. Accounts, Burn and Runway use a back chip, Category a text breadcrumb, and the workspace name is truncated with room to spare. 'By account' (3 rows) sits in a 474 px card and Breakdown in Week view in a 340 px card. The overview is 1277 px tall, which meets the it3 target (under 1300) and is not raised.
- Findings: R3-02, V2-06, V2-11, V2-12, V2-04
- Found by: R3, V2
- Evidence: observed by 2 walkers (R3, V2)
- Reach: Finance page users
- Files:
  - apps/web/src/pages/Finance.tsx:508-516 (container-width grid so 5 tiles go 3+2 or 5-up)
  - Finance.tsx:874,978 and finance/FinanceAccounts.tsx:87 (chips 11-12 px)
  - apps/web/src/pages/finance/*.tsx headers (one pattern)
  - FinanceBurn.tsx / Finance.tsx grid (items-start)
- Acceptance:
  - With the Ask panel open at 1280 no KPI row has a single tile.
  - No text below 11 px in Finance.
  - All Finance sub-pages use one back control and do not truncate the workspace name with free space.
- Needs product decision: no
- Dependencies/conflicts: Finance.tsx and FinanceSpend.tsx overlap C1; do C1 first.
- Pass: reopens it3 C23 (overview length, sub-page headers); effort M

### C24 Bot settings panel: raw SKILL.md YAML to create a skill, footer in three styles, 'computer' box above Routines, bot created on first click (P2, rank 23, score 1.3)
- Root cause: BotSkillsSection.tsx opens a raw SKILL.md box whose YAML placeholder vanishes on typing; typing name: and description: without --- lines enables Save, then fails with 'This file needs a name and description at the top, between two --- lines' (agent-skill.ts). The Skills block loads empty then collapses, so Advanced/Export/Clear conversation jump 13 px. The footer mixes a grey row, a white link and a red link. Shell.tsx:5735 reads "Investor notes's computer screen" (double s) and the black box sits above Routines. 'New bot' creates a bot at once and opens a panel asking for definition twice (panel fields and the bot's own first question); backing out leaves 'New Bot' behind.
- Findings: J2-04, J2-11, V1-10, FLOW-06
- Found by: J2, V1, FLOW
- Evidence: observed by 2 walkers (J2, V1) and FLOW
- Reach: Anyone creating a bot or skill
- Files:
  - apps/web/src/pages/shell/BotSkillsSection.tsx:471 and packages/core/src/agent-skill.ts (Name and Description fields that build the front matter, or a prefilled template as real text)
  - apps/web/src/pages/shell/bot-panel.tsx:693 (footer as one list; reserve the Skills row height; header height equals chat header)
  - apps/web/src/pages/Shell.tsx:5735 (possessive; Routines above the computer box until used)
  - new-bot flow (see decision)
- Acceptance:
  - Creating a skill needs Name, Description and Instructions fields; no hand-typed --- lines.
  - Opening the panel does not shift the footer by more than 2 px.
  - Panel title reads 'Investor notes' computer'.
  - Routines is above the computer screen for a new bot.
- Needs product decision: yes. For 'New bot': keep creating it on the first click but open the panel with only Name focused and the other fields folded until the bot has replied once (recommended), or delete a never-used bot when its panel closes?
- Dependencies/conflicts: BotSkillsSection.tsx; Shell.tsx:5735 line shared with C2/C17 (separate lines).
- Pass: reopens it3 C16 (Skills jump and footer, partly); effort M

### C25 Touch targets under 44 px on phones in the shell, Inbox, Finance, Data room preview and bot panel (P2, rank 24, score 1.2)
- Root cause: Measured at 375: sidebar header icons 32x32, row actions and message actions 28x28, Settings close 28x28, Apps Connect 73x28 and chips 26 px, bot panel Export and Clear conversation 28 px, Inbox hamburger 32x32, Cleanup/Filter 36x28, Compose 28x28, pile and account tabs 25 px, Data room preview icons about 24 px. Settings nav already uses pointer-coarse:min-h-11, so the pattern exists.
- Findings: V1-06, V2-07, V3-12
- Found by: V1, V2, V3
- Evidence: observed by 3 walkers with getBoundingClientRect
- Reach: All phone-width web users (the native iOS app is the primary touch surface, so strictness is limited to the shipped web layout)
- Files:
  - packages/ui-web (icon button, tabs and chip sizes with pointer-coarse:min-h-11 pointer-coarse:min-w-11)
  - apps/web/src/pages/Shell.tsx:4070-4106
  - apps/web/src/pages/shell/bot-panel.tsx:693
  - apps/web/src/components/data-room preview panel
  - component stories
- Acceptance:
  - No visible button, tab or chip on Shell, Inbox, Apps, Settings, bot panel and the Data room preview is under 44 px in either dimension on a coarse pointer at 375.
  - Desktop sizes are unchanged.
- Needs product decision: no
- Dependencies/conflicts: Edits packages/ui-web shared primitives and Shell.tsx header (conflicts with C3); do after C3.
- Pass: reopens it3 C3 (touch targets, 33 controls); effort L

### C23 Data room agent answers list files as plain text; no multi-select, bulk download or send for a diligence request (P2, rank 25, score 0.8)
- Root cause: The Data room row menu has Send to agent, Move, Rename and Delete only; there is no selection, bulk download or share. An agent answer listing the matching files shows plain names, not links. A seed-round request takes about 11 steps (story DRM-019 FAIL, ideal 6). Observed on the demo; the multi-select part is a feature, not a bug.
- Findings: J2-07
- Found by: J2
- Evidence: observed by 1 walker
- Reach: Founders preparing a raise or diligence
- Files:
  - Chat message rendering (file names in agent replies open the Data room preview; locate the markdown/link renderer under apps/web/src/components)
  - apps/web/src/components/data-room/ list (row checkboxes with Download and Send to agent)
  - DataRoom.tsx selection state; stories and tests
- Acceptance:
  - File names in an agent answer open the preview.
  - Selecting 3 rows offers Download and Send to agent for all three.
  - DRM-019 completes in 6 steps or fewer.
- Needs product decision: yes. Build only the first part (file names in replies open the preview) now, or also add multi-select with bulk Download/Send (recommended: both, as the diligence request needs them)?
- Dependencies/conflicts: DataRoom.tsx and data-room/ list also in C26; sequence after C26.
- Pass: new in it4; effort L

### C26 Data room list: processing strip repeats the failure, grid hides the reason, phone toolbar takes five rows, preview and Auto-sort rough edges (P2, rank 26, score 0.8)
- Root cause: ProcessingStrip.tsx:57 is workspace-wide, so it shows 'Reading MOCK Board Minutes' inside another folder and in search results, stacks a second chrome row in folders, and its '1 couldn't be read' is an 18 px button that does not filter. The same failed file is reported three times (banner, row, sidebar badge). The grid card shows only 'Failed'/'Try again' (no reason or folder) and a blank white thumbnail at 375. At 375 the toolbar takes five rows (first document at y=310) and Add files is an unlabeled '+'. The mobile preview sheet cuts off metadata. Stats: 'Sources' card with one row is as tall as 'Types'; bars have no tooltip. Name column is about 850 px at 1920. Folder tree has aria-expanded null. Auto-sort plan flashes a flat list of 50 'No change' rows and then 'Apply 0 changes' with no hint (AutoSortDialog.tsx:117-130, 286-293).
- Findings: V3-09, FLOW-05, V3-10, V3-11, V3-14, V3-15, V3-17, J2-13, R3-13, V3-12
- Found by: V3, FLOW, R3, J2
- Evidence: observed by 3 walkers (V3, FLOW, R3, J2)
- Reach: Everyone who uses the Data room, mostly raise preparation
- Files:
  - apps/web/src/components/data-room/ProcessingStrip.tsx:57 (single line; '1 couldn't be read' applies the Failed filter; drop the count from the banner)
  - data-room grid card (reason, folder, type icon when no thumbnail)
  - apps/web/src/components/data-room/FilterBar.tsx (one 'Filters' button with a count; labeled Add files)
  - preview panel (metadata fit)
  - DataRoomStats.tsx:264 (hide single-source card; bar tooltip)
  - FolderTree.tsx (aria-expanded)
  - AutoSortDialog.tsx:117-130,286-293
  - DataRoom.tsx (close the preview when the agent panel opens)
- Acceptance:
  - A failed file produces one visible failure signal in the list view (the row) and the sidebar badge.
  - At 375 the first document starts above y=220.
  - The grid card shows the failure reason.
  - Auto-sort shows one view and an instruction when nothing is ticked.
- Needs product decision: no
- Dependencies/conflicts: FilterBar.tsx also in C7; DataRoom.tsx also in C23.
- Pass: reopens it3 C6 and C27 (Data room layout, Auto-sort); effort L

### C27 Landing logo mark is almost invisible; sign-in touch targets small (P3, rank 27, score 2.0)
- Root cause: Welcome.tsx:13-17 builds the mark from bg-accent and bg-card, which nearly vanishes on the dark page while the sign-in page shows the same mark clearly. 'Show password' is 32x32 and overlaps the input, 'Forgot password?' is 118x32, and the sign-up hint is 12 px.
- Findings: V1-12, V1-13
- Found by: V1
- Evidence: observed; Welcome.tsx classes verified in code
- Reach: Every new visitor
- Files:
  - apps/web/src/pages/Welcome.tsx:13-17
  - sign-in and sign-up pages (44 px eye button and forgot link on touch)
- Acceptance:
  - The landing mark has at least 3:1 contrast against the page background.
  - Eye button and Forgot password are at least 44 px on touch.
- Needs product decision: no
- Dependencies/conflicts: None.
- Pass: reopens it3 C24 in part; effort XS

### C28 Sidebar polish: Create menu lists chats, Page options menu hides rows, Page agents auto-expands, empty spaces look like warnings, Activity persists on phones (P3, rank 28, score 1.0)
- Root cause: Create (+) lists 'New bot', every existing chat, 'New group' and 'New space' with no descriptions; the tour calls the button 'create an agent or a group chat'. The Page options menu opens over the page rows and its checkmarks have no label. Opening Inbox auto-expands 'Page agents', adding a clipped Inbox agent row. Space headers with no bots (seed data: Reconnect needed, Empty space, Mail needs reconnect, Mail rate-limited) look like warnings. The Activity panel state persists after reload and fills the 375 drawer; times use two formats. At 1440x900 the workspace list shows about 365 px.
- Findings: FLOW-07, V1-15, V1-16, FLOW-11, V1-21, V3-16, V2-17
- Found by: FLOW, V1, V3, V2
- Evidence: observed by 4 walkers; seed-related parts suspected
- Reach: Every user, low impact each
- Files:
  - apps/web/src/pages/Shell.tsx (Create menu: New bot, New group, New space with a one-line hint; drop existing chats)
  - Shell.tsx Page options menu (anchor right of the sidebar, 'Show in sidebar' label)
  - Shell.tsx (do not auto-expand Page agents on navigation; hide bot-less space headers)
  - Shell.tsx mobile drawer (reset Activity to closed; one time format)
- Acceptance:
  - Create menu has three entries.
  - Opening Inbox leaves the Page agents row collapsed.
  - The 375 drawer opens with Activity closed.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx header and sidebar: after C3 and C2.
- Pass: reopens it3 FLOW-08 (+ picker); effort S

### C29 Demo seed and onboarding copy leftovers (P3, rank 29, score 1.0)
- Root cause: Demo contacts have Kind 'Other' (R3-09). Chief says Mercury checking $412,420.55 while runway cash is $1,633,220.65 with no 'all accounts' note (R2-12). Finance Upcoming lists Placeholder Legal LLP on Oct 31 while the Chief approval asks to pay on Oct 30 (J2-14). The 'Run my company' onboarding option leads to Gmail and Calendar cards only (R3-11).
- Findings: R3-09, R2-12, J2-14, R3-11
- Found by: R3, R2, J2
- Evidence: observed; seed vs product cause suspected
- Reach: Demo and first-run only
- Files:
  - packages/testkit/src/cli/demo/data.ts (contact kinds, upcoming bill date)
  - Finance agent reply text ('all accounts')
  - onboarding reply copy for the 'Run my company' option
- Acceptance:
  - Demo kinds and dates match; the onboarding option connects what it promises or is reworded.
- Needs product decision: no
- Dependencies/conflicts: packages/testkit only, plus one copy string.
- Pass: new in it4; effort XS

## Deferred items
- V2-09 Finance Accounts 15 s skeleton: not reproduced; folded into C18 as a measure-first line.
- J2-10 agent answers taking 55-100 s (Data room, Chief to Finance, routine test run): depends on the demo model and a busy stack; no code change until measured on a production build.
- FLOW-10 second part (give Chief a Finance read tool so a runway question needs no second agent): it3 C13 asked the owner and no answer is recorded; C2 fixes the banner only. Question: should Chief read the Finance summary itself (recommended) or keep delegating?
- FLOW-02 and R3-14 timing items need an idle re-measure.
- Pass-1 deferred items (UXV-5 tablet shell, UXV-6 integration detail structure, UXV-8 Gmail writes, UXV-10, UXV-11, UXV-12) were not re-walked and stay deferred.
- J2-09's 'closed/history view on Deadlines' was not seen; not raised.

## BLOCKED or not walkable (need data, a running stack or a real account)
- R1 (verification of pass-3 clusters C1-C10 and the rest): the demo stack on 5381/3308 was not running, OrbStack was stopped and the worktree had no node_modules. No verdicts. Clusters C1-C10 of iteration 3 (Activity height, Pages list, AI consent, toasts, touch targets, mail agents, money card, Data room narrow, cold load, chat card) were only spot-checked incidentally by V1, V2, V3, FLOW and J2; mail-agent access (it3 C4), Data room polling (it3 C7) and Legal banner order (it3 C10) were not checked at all.
- J1 (first-run, Monday on laptop, inbox morning, runway before a board meeting: STORY-APP-144, 145, 319, STORY-INB-022, 109, STORY-FIN-019, 036): not walked, stack down.
- J3 (phone-width sweep: sign-in, drawer, Inbox triage, Finance, Data room, agent approval, Settings): not walked, stack down. Phone findings in this file come from V1-V3 and R2 only.
- Needs data or real accounts: STORY-DRM-018 empty-room start, STORY-CAP-017 Carta connect, CAP-018 Gmail draft, STORY-FIN-022 (NW-RECONNECT fixture), C13 routine Done timing and Gmail-agent line, C14 three-toast stack and phone failure toast, C16 contact exclusion and tab-stop count, C17 sorting state and progress count, C19 Voice notice alignment, C20 Usage and Updates sections, C22 'Value (USD)' label, C25 create menu and bot-row flag, C26 scroll-to-pending, thinking timer, draft-skill Approve/Discard and attachment preview, C27 auth-error path (mock model succeeds), C11 Connect-card ordering, Light theme, 200% zoom, any real OAuth Connect button.

## Counts by severity
- Clusters: 29 (P0 0, P1 7, P2 19, P3 3)
- Raw findings: R1 1 (process), J1 0, J3 0, R2 12, R3 14, J2 14, FLOW 12, V1 21, V2 18, V3 18 = 110. Every finding id maps to one cluster except those listed as deferred or dropped (R1-01 is a process note; V2-04 and part of FLOW-03 were dropped as already decided; V2-09, V2-10, R3-14 are folded into C18 as measure-first).
- Clusters needing a product decision: C8, C11, C24, C23
- Clusters that reopen an earlier cluster whose criteria were not met: C1, C2, C5, C6, C9, C11, C10, C12, C13, C14, C17, C18, C19, C15, C20, C21, C22, C24, C25, C26, C27, C28
- P0: none. No finding blocks or misleads to the point of data loss or a wrong payment; the nearest are C1 (two vendor figures) and C5 (raw ids on a money card), rated P1.
