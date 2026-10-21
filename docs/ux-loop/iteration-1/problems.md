# Iteration 1 problem register

Sources: walkers W1-W6 (`walk-W*.md`), flow critique (`flow.md`), visual inspectors V1-V3 (`visual-V1.md`, `visual-V2.md`, `visual-V3.md`, `visual-V3-run2.md`, ids V3B-*). `walk-W6.md` is the only W6 file; `alk-W6.md` is empty and was ignored. Prior decisions in `docs/ux-flow/report.md` and `docs/ux-visual/problems.md` were not re-opened; where a finding extends an item there (UXV-1, UXV-4, UXV-7, thread view, Noise/Junk wording) the cluster says so.

Evidence labels: observed = seen or measured by a walker; verified in code = I read the cited lines this pass; suspected = inferred. The demo stack was shared and under load (load average about 21 during W6), so loading-time findings are marked unverified.

## Verification notes (claims checked against code)

- Sidebar scroll (C1): confirmed. `Shell.tsx:1739-1743` scrolls `[data-sidebar-current]`, which `Shell.tsx:4180` sets on the whole space group.
- Search and Cmd+K missing Legal (C2): confirmed. `appPages` has no `legal`, and `searchPages` does not use `hiddenPages`.
- Approval card (C3): confirmed. `describeApprovalAction` hand-writes 8 tools and falls back to `pickScopeLabel`, which yields the bare amount.
- Routine time zone (C4): confirmed at `Shell.tsx:5526` and `:5624`.
- Models false empty state (C17): confirmed. The else branch at `ModelSettingsOverlay.tsx:1288-1292` has no loading check.
- Data room polling (C5): confirmed that the 3 s poll dispatches a reload while any file is processing. The slow zero-hit search is not explained.
- Donut legend (C11): the string-equality match at `OwnershipDonut.tsx:103` is confirmed; the demo class names were not re-read.
- DROPPED/DOWNGRADED: W3-04 (Compose does nothing). `Inbox.tsx:1177-1179` sets `disabled={accounts.length === 0}`, so it is disabled, not a dead click; kept only as a minor tooltip item in C25. W6-03 (consent not enforced for chat): `executor.ts:1970` and `:2187-2242` do enforce consent for Legal and mail reads, and plain chat reads neither, so this is probably by design; moved to a question in C16.
- Not verified in code (kept as suspected): C8 root cause, C9 query, C13, C14, C15, C38.

## Clusters (ranked: P1 first by severity x reach / effort, then P2)

No P0 findings were reported. Raw findings: about 233 (P1 32, P2 103, P3 98) before deduplication; 39 clusters cover the P1 and P2 findings plus the P3 items that share their files.

### C1 Sidebar loads scrolled past the Pages list (P1)
- Root cause: An effect scrolls [data-sidebar-current] into view on the first bootstrap, not only after a space switch. The attribute sits on the whole 700-900 px space group (Shell.tsx:4180), so scrollIntoView({block:'nearest'}) aligns the group's top edge and pushes Pages out of view. Verified in code: effect at Shell.tsx:1739-1743 runs when bootstrapMe.spaceId first becomes set.
- Findings: V1-01, V2-01, V3-18, V3B-18, W5-01, W6-01, W1-16, FLOW-11 (part)
- Found by: V1, V2, V3, V3B, W1, W5, W6, FLOW
- Evidence: observed + cause verified in code
- Reach: Every page load for any user with more than about 8 chats, all viewports incl. the 375 px drawer
- Files:
  - apps/web/src/pages/Shell.tsx:1739-1743 (scroll effect)
  - apps/web/src/pages/Shell.tsx:4180 (move data-sidebar-current to the space header row)
- Acceptance:
  - After a full load of /app/finance, /app/contacts and /app/inbox with 14+ chats, the sidebar list scrollTop is 0 and the Pages rows are inside the viewport (measured with getBoundingClientRect, y >= 0).
  - Switching space still brings that space's header into view.
  - Unit or Storybook test: the scroll target is the header row, not the group.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx also touched by C2, C4, C37, C33, C38; land C1 first (3-line change).

### C2 Search and Cmd+K omit Legal and ignore hidden pages (P1)
- Root cause: appPages (Shell.tsx:1948-1962) has no Legal entry and includes Integrations and Settings; searchPages (1969) never filters by hiddenPages (1910). Verified in code. The palette default list shows only bots, and sidebar search is a third mail search.
- Findings: FLOW-01, W1-01, W6-05, V3-17, V3B-16, FLOW-02
- Found by: FLOW, W1, W6, V3, V3B
- Evidence: observed + verified in code
- Reach: Every user who types a page name; every Cmd+K open
- Files:
  - apps/web/src/pages/Shell.tsx:1948-1980 (appPages, searchPages)
  - apps/web/src/pages/shell/command-palette*.tsx (default Pages group; add documents)
  - apps/web/src/pages/SpaceSearch.tsx:148 ('Search mail for' row)
- Acceptance:
  - Typing 'legal' in sidebar search and Cmd+K lists the Legal page (keywords: contracts, NDA, deadlines).
  - A page hidden in Page options does not appear in sidebar search or Cmd+K.
  - Empty Cmd+K shows a Pages group above Bots (Pages visible without typing).
  - 'Search mail for ...' row shown only when the query is not a page name (or after Enter).
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx lines differ from C1; merge after C1.

### C3 Approval card for money and MCP tools shows raw ids and no currency (P1)
- Root cause: describeApprovalAction (approval-ask.ts:235-275) hand-writes titles only for 8 tools; every other tool gets 'Service: humanized name -> pickScopeLabel(args)', which picked the bare amount '1200'. The detail block prints raw JSON (accountId, recipientId, tool: mcp__...). executor.ts:3417 builds the title. Verified in code. Extends UXV-1 / issue #151 (not new, but this is the money case).
- Findings: W2-03, W6-04, V2-02, W2-15, W2-22
- Found by: W2, W6, V2
- Evidence: observed + cause verified in code
- Reach: Every approval of an integration write; highest-risk surface (payments)
- Files:
  - packages/adapters/src/approval-ask.ts:235-300 (describeApprovalAction, formatApprovalDetail, HAND_WRITTEN_TOOLS)
  - packages/adapters/src/executor.ts:3417
  - apps/web/src/components/AskCard.tsx (Details disclosure for raw JSON)
  - apps/web/src/components/integrations/IntegrationAgentSection.tsx (WritesSwitch dialog copy)
- Acceptance:
  - A Mercury request-send-money approval reads 'Send $1,200.00 to <recipient name> from <account name>' with currency symbol; no 'mcp__', camelCase id or raw account/recipient id in title or card body.
  - Raw arguments are behind a 'Details' disclosure.
  - Allow-changes dialog says money can move.
  - Unit test over describeApprovalAction for a money tool, an MCP tool, a connector tool and a built-in tool.
  - A denied or waiting tool step does not show a duration.
- Needs product decision: no
- Dependencies/conflicts: Overlaps UXV-1/UXV-4 (AskCard.tsx, approval-ask.ts); coordinate with whoever owns #150/#151.

### C4 New routine and routine editor ignore the account time zone (P1)
- Root cause: Shell.tsx:5526 and :5624 pass localTimezone() (browser zone) for new routines while the Settings card uses bootstrapMe.timezone (:6131). Verified in code. Existing routine zone is shown but not changeable (W2-02).
- Findings: W2-01, W2-02
- Found by: W2
- Evidence: observed + verified in code
- Reach: Every routine created by a user whose account zone differs from the browser
- Files:
  - apps/web/src/pages/Shell.tsx:5526, :5624 (use bootstrapMe?.timezone ?? localTimezone())
  - apps/web/src/pages/RoutineEditor.tsx (zone label becomes a control or 'Runs in {zone}' with change link)
- Acceptance:
  - With the account zone set to Los Angeles, 'Create Routine' shows Pacific time and the saved routine stores America/Los_Angeles.
  - Existing routine zone can be changed in the editor or the label states that it is fixed.
  - Unit test for the default-zone selection.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx (same file as C1/C2); C31 edits RoutineEditor.tsx.

### C5 Data room: polling re-requests the list and a zero-hit search never shows its empty state (P1)
- Root cause: use-data-room-processing.ts:44-48 dispatches DATA_ROOM_CHANGED every POLL_MS while any file is 'processing'; each tick reloads the list/search. DataRoom.tsx:670 shows the skeleton when list.loading && rows.length === 0, so a slow search is re-requested before it returns and the empty state never renders. A file stuck in Reading polls forever (16 requests per 10 s idle). Polling code verified; the 8-13 s server time for a zero-hit search is observed but its cause is unknown.
- Findings: V3-01, V3-02, W4-17, W4-21, V3B-08
- Found by: V3, W4, V3B
- Evidence: observed + polling verified in code
- Reach: Every Data room user while any file is processing; all searches
- Files:
  - apps/web/src/components/data-room/use-data-room-processing.ts:36-60
  - apps/web/src/pages/DataRoom.tsx:660-700
  - server search RPC (find why a zero-hit query takes 8-13 s)
  - reading job timeout (mark Reading jobs failed after a limit)
- Acceptance:
  - A search with no hits shows 'No results' with a Clear search action within 2 s on the demo stack.
  - While a request is in flight, a poll tick does not start another list or search request; idle request rate with one stuck file is under 1 per 10 s (measured via network log).
  - A Reading job older than a set limit becomes Failed.
- Needs product decision: no
- Dependencies/conflicts: DataRoom.tsx also in C6, C7, C30; sequence C5 then C6, C7.

### C6 Data room failed files are not reachable or actionable (P1)
- Root cause: ProcessingStrip.tsx:55 and DataRoomStats.tsx render 'N couldn't be read' / 'Failed N' as plain text; the failed row can sit at row 100+ (5 Load more clicks). The failed-file preview renders the browser PDF error above the app's own message (Preview.tsx:218-223). Grid failed tiles have no Try again. The Imported and Processing strips stack and persist.
- Findings: W4-01, V3B-02, V3-05, W4-05, V3-08, W4-06, W4-07, W4-14, W4-22, V3-10 (Failed link), V3B-07
- Found by: W4, V3, V3B
- Evidence: observed
- Reach: Anyone importing a zip or email attachments (the main Data room path)
- Files:
  - apps/web/src/components/data-room/ProcessingStrip.tsx (failed count becomes a button -> Status: Failed filter; nowrap counts; merge with import row)
  - apps/web/src/components/data-room/ImportActivity.tsx (show only on affected folder, auto-dismiss, latest batch)
  - apps/web/src/components/data-room/DataRoomStats.tsx (Failed row filter)
  - apps/web/src/components/data-room/Preview.tsx:218-235 (no FileViewer for failed items; fit PDF width)
  - grid tile component (Try again on failed tiles)
  - apps/web/src/pages/DataRoom.tsx (Status filter)
- Acceptance:
  - Clicking 'N couldn't be read' lists only the failed files in one click.
  - Failed item preview shows heading, reason and Try again above the fold; no browser PDF error frame.
  - Retry sets the row to Reading immediately.
  - At most one status strip above the list; counts do not wrap at 375 or with the preview open.
  - Playwright/Storybook story for each: failed strip, failed preview, failed grid tile.
- Needs product decision: no
- Dependencies/conflicts: DataRoom.tsx, Preview.tsx shared with C5, C7, C30.

### C7 Data room list and preview truncate names and waste space (P1)
- Root cause: Name column has no minimum width, so with the preview open or in search mode names cut to about 15 characters and different files look identical; each row repeats the folder path; no max width at 1920; grid shows document date while sorting by Added; first paint omits toolbar slots (layout shift); path bar appears only inside a folder.
- Findings: W4-02, V3-04, V3-06, V3B-01, V3B-17, W4-20, V3-03, V3-09, V3-07, V3B-03, V3B-04 (part), V3B-05, V3-12
- Found by: W4, V3, V3B
- Evidence: observed
- Reach: Every Data room view with the preview open, search, or 1920/375 px
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx (name column min width, hide path line when folder selected, grid date follows sort :614)
  - apps/web/src/pages/DataRoom.tsx:636-700 (toolbar slot reservation, skeleton matches view, path bar height)
  - mobile: one Filters button instead of two chip rows
- Acceptance:
  - With preview open, two files named 'MOCK Pilot Agreement - Bolt Freight' and '... Halcyon Logistics' are distinguishable in the list (name wraps to 2 lines or other columns drop first).
  - Header and path bar do not move rows when data loads (CLS 0 for the toolbar).
  - At 375 px the first file row starts above y=400.
  - List width is capped near 1200 px at 1920.
- Needs product decision: no
- Dependencies/conflicts: Same files as C5, C6, C30; land after C5/C6.

### C8 Newsletter badge and Newsletters pile disagree (P1)
- Root cause: resolvePile (packages/core/src/mail-piles.ts:58-66) lets the header-rule pile win over the model category, so mail the model labels 'newsletter' stays in Updates (Gmail Updates tab) while the row badge still says Newsletter and the Newsletters tab says 'No mail'. Lines 177-187 acknowledge Gmail files many newsletters under Updates. Code path read; the demo seed behaviour is observed, so the cause is plausible, not reproduced in a test.
- Findings: W3-01, V2-03
- Found by: W3, V2
- Evidence: observed; cause suspected
- Reach: Every Inbox user with newsletters (core triage surface)
- Files:
  - packages/core/src/mail-piles.ts:58-66, 171-189
  - apps/web/src/pages/Inbox.tsx:142, 1198, 1427 (hideNewsletter)
  - apps/web/src/components/inbox/InboxRow.tsx:152-165
- Acceptance:
  - No row shows a 'Newsletter' badge outside the Newsletters pile, or every row with that badge appears in the Newsletters pile (pick one rule; unit test over resolvePile).
  - A pile tab count equals the number of rows listed under it.
  - Digest toggle does something visible or is hidden when the pile is empty.
- Needs product decision: yes. When the free header rule says Updates and the model says newsletter, which pile should the mail live in?
- Dependencies/conflicts: Inbox.tsx is shared with C25, C9; stored pile values may need a backfill.

### C9 Inbox Cleanup starts as a 23-row hand-sort with all actions disabled (P1)
- Root cause: Cleanup lists every sender (colleagues, lawyer, investors) with nothing preselected and three disabled buttons; no select-all; no reason for disabled Unsubscribe; Spam hidden in a More menu; undone history entries keep a disabled Undo. Query in apps/api/src/inbox-cleanup.ts not changed since catalog; not verified line by line.
- Findings: W3-03, V2-12, W3-13, W3-10 (checkbox hit area, name truncation)
- Found by: W3, V2
- Evidence: observed
- Reach: Every user's first Cleanup pass
- Files:
  - apps/api/src/inbox-cleanup.ts (sender stats: bulk senders only, e.g. 3+ mails and no reply from the user)
  - apps/web/src/components/inbox/InboxCleanup.tsx
  - apps/web/src/components/inbox/CleanupActionBar.tsx
  - apps/web/src/components/inbox/CleanupSenderRow.tsx
  - apps/web/src/components/inbox/CleanupHistory.tsx
- Acceptance:
  - With the demo mailbox, Cleanup lists no sender the user has written to, or shows 'Nothing to clean up'.
  - Action bar is hidden until a sender is selected; Select all exists; disabled buttons give a reason.
  - Undone history entries show 'Undone'.
  - At 390 px the sender name truncates after the address and the checkbox hit area is at least 44 px.
- Needs product decision: yes. Should Cleanup list only bulk-looking senders (3+ mails, no replies from you) or every sender?
- Dependencies/conflicts: Inbox.tsx shared with C8/C25.

### C10 Integrations: false 'No apps match', shared switch copy, hidden connected apps (P1)
- Root cause: IntegrationsHome.tsx:697-700 shows the empty message without counting first-party Chat tiles (verified path); the 'Share with all agents' switch (IntegrationAgentSection.tsx:90-98) has no hint and 'Used by' shows fewer agents; the 'Docs & files' chip hides the Connected section; sections use different column counts.
- Findings: W2-04, W2-05, W2-21, W2-12
- Found by: W2
- Evidence: observed
- Reach: Every Integrations visit that searches or filters; every agent integration page
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx:690-710 and grid classes
  - apps/web/src/components/integrations/IntegrationAgentSection.tsx:90-98
- Acceptance:
  - Searching 'imessage' shows the iMessage tiles and no 'No apps match.' text.
  - With a chip active, matching connected apps stay visible.
  - The second switch reads 'Let other agents use <App> directly' with a one-line hint of what off does.
  - All sections use one column count at 1440.
- Needs product decision: no
- Dependencies/conflicts: IntegrationsHome.tsx shared with C22, C23.

### C11 Cap table: donut legend does nothing and the page shows the wrong layout while loading (P1)
- Root cause: OwnershipDonut.tsx:97-114 matches holders to a slice by h.security === slice.name, which fails when the class name differs ('Common (Mock)' vs 'Common'); the Options slice test is by substring. Legend rows are focusable but not buttons. CapTable renders the 'Carta off' layout while the connection check is pending (20 s at 375). Code line verified; skeleton cause suspected.
- Findings: W5-02, W5-03, V3B-11, W5-10
- Found by: W5, V3B
- Evidence: observed; cause partly verified
- Reach: Every Carta-connected cap table user; first load of Cap table
- Files:
  - apps/web/src/components/cap-table/OwnershipDonut.tsx:97-114 (match by class id or normalised name; legend rows as buttons named 'Show X breakdown')
  - apps/web/src/pages/CapTable.tsx (skeleton for the summary area while connection and snapshot load)
  - apps/web/src/demo/fixture.json (consistent class names)
- Acceptance:
  - Clicking each legend row opens its holder breakdown (Playwright test with mismatched class names).
  - Until the connection check completes the summary area shows a skeleton, never the contacts-only layout.
  - Sort direction button is named as an action.
- Needs product decision: no
- Dependencies/conflicts: CapTable.tsx shared with C27 and C28.

### C12 Demo seed numbers contradict the Finance page (P1)
- Root cause: Chief's seeded chat and the 'Q3 Board Deck' artifact say $412,000 / 8.9 months / $46,000 burn; Finance shows $1,633,221 / 24.2 months / $67,621. The Finance agent also quotes Oct 24, 2028 where the Runway page shows Oct 25, 2028. Demo data only, but every walker and demo viewer reads it as a product bug.
- Findings: FLOW-18, W2-23, W5-14, W6-29, V2-04
- Found by: FLOW, W2, W5, W6, V2
- Evidence: observed
- Reach: Demo stack and every demo walkthrough
- Files:
  - apps/web/src/demo/fixture.json (chat replies and artifact text)
  - Finance agent date rounding (run-out date)
- Acceptance:
  - grep of the fixture finds only one runway/cash/burn set, matching the Finance page.
  - Finance agent reply and Runway page quote the same run-out date.
- Needs product decision: no
- Dependencies/conflicts: None.

### C13 Chief answers 'I can't determine the runway' after Gmail and Mercury are connected (P1)
- Root cause: Fresh user connected Gmail and Mercury, Finance showed 24.6 months, but 'When do we run out of money?' to Chief got 'I don't have your current cash balance'. Only a Gmail agent appeared on connect. Cause not found: either Chief lacks finance read tools or the Mercury agent is not created or linked. Not verified in code.
- Findings: W6-02
- Found by: W6
- Evidence: observed; cause unknown
- Reach: The headline first-day journey (APP-209) for every new founder
- Files:
  - packages/adapters/src/executor.ts and builtin-tools.ts (Chief tool set / delegation)
  - apps/api integration connect path that creates the integration agent
- Acceptance:
  - After connecting Mercury, asking Chief the runway question returns the Finance page's cash and runway figures (or hands off to the Finance agent) in the same session.
  - Regression test in the walker story APP-209 step 14.
- Needs product decision: no
- Dependencies/conflicts: Investigate first; blocks reliable re-test of C12.

### C14 Inbox agent and 'Ask agent' on a thread cannot see the mail the page shows (P1)
- Root cause: 'Ask agent' creates the chat with an 'Email thread' card but the reply asks the user to paste the email; the Inbox agent says it cannot verify 'Needs reply' while the page shows 13, and names mail not in the Inbox. Walker notes the demo model is a stub, so real-model behaviour is unverified. Not checked in code.
- Findings: W3-06, W3-07
- Found by: W3
- Evidence: observed; may be demo-model artifact
- Reach: Everyone who uses the Inbox agent (3 doors)
- Files:
  - apps/api/src/inbox-thread-agent.ts (does the thread block reach the model)
  - packages/adapters/src/builtin-tools.ts (Inbox agent tools vs the cached list in apps/api/src/inbox.ts)
  - demo Gmail emulator seed
- Acceptance:
  - A trace of the model request for 'Ask agent' contains the thread text (unit test over the initial message).
  - Inbox agent 'What needs my reply today?' returns the same threads as the page's Needs reply group on the demo.
- Needs product decision: no
- Dependencies/conflicts: Investigate first; blocks C25 verification via agent.

### C15 A bot URL from another space shows 'Page not found' (P1)
- Root cause: Shell.tsx:659-662 and :6358 render NotFoundPage when markMissing is set for the path; the bot lookup is limited to the selected space, so pasted or bookmarked links across spaces fail with a false message. Code path read; not reproduced in a test.
- Findings: W6-06
- Found by: W6
- Evidence: observed; cause suspected
- Reach: Anyone with more than one space who shares or bookmarks links
- Files:
  - apps/web/src/pages/Shell.tsx:655-665, :6358
  - bot lookup across the user's spaces, then switch space
- Acceptance:
  - Opening /app/<bot of another space> switches to that space and opens the bot; not-found shows only when no space has it.
  - Test: two spaces, bot in the second, navigation from the first.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx shared with C1, C2, C4.

### C16 AI data sharing consent is asked in up to four places in four wordings (P1)
- Root cause: Inbox card, Data room, Legal banner, chat consent card and Settings each use their own copy and store their own answer. The Inbox card names OpenRouter and the model id; the Legal banner names 'Muse Spark 1.2'; Settings shows two switches both labelled 'OpenRouter'. Consent enforcement exists for mail reads and Legal (executor.ts:1970, 2187-2242), so W6-03 ('Chief still answered when consent was off') is probably by design for plain chat, not a bug; that claim is downgraded to a question.
- Findings: FLOW-10, V2-05b, V1-10, W6-03 (downgraded)
- Found by: FLOW, V2, V1, W6
- Evidence: observed (Inbox, Legal, Settings); others suspected
- Reach: Every new user connecting mail, files or contracts
- Files:
  - apps/web/src/components/AiDataSharing.tsx:86
  - apps/web/src/components/AskCard.tsx (consent variant)
  - apps/web/src/pages/Legal.tsx (banner)
  - apps/web/src/pages/Inbox.tsx (consent card)
  - apps/web/src/pages/AccountSettingsOverlay.tsx (switch labels by model display name)
- Acceptance:
  - One shared consent component and one sentence, with no vendor or model id in the main line.
  - Settings switches are named by plain model name.
  - Inbox consent card no longer pushes the first email down more than one line.
- Needs product decision: yes. Ask once at first connection with per-area switches in Settings, or keep each page asking separately? Should plain chat (no mail, files or contracts) also be blocked when sharing is off?
- Dependencies/conflicts: AccountSettingsOverlay.tsx shared with C18; Legal.tsx with C39.

### C17 Settings > Models: false 'No providers found' while loading, misplaced Data room checkbox (P2)
- Root cause: ModelSettingsOverlay.tsx:1272-1292 shows 'No providers found.' whenever filteredGroups is empty, including during catalog load (verified in code). The 'Add email attachments to the Data room' checkbox sits at :1721 inside Models. 73 providers are listed flat.
- Findings: W1-08, V1-08, FLOW-04, W3-11, W6-14
- Found by: W1, V1, FLOW, W3, W6
- Evidence: observed + verified in code
- Reach: Everyone opening Settings > Models
- Files:
  - apps/web/src/pages/ModelSettingsOverlay.tsx:1272-1292, :1721
  - apps/web/src/components/ModelSettings.tsx
  - move the checkbox to the Data room page (import menu or a settings row)
- Acceptance:
  - Empty-provider text renders only after the catalog has loaded and returned zero; a skeleton shows meanwhile.
  - The attachment checkbox is not in Models.
  - Common providers (5-6) are shown first with a 'More' control.
- Needs product decision: no
- Dependencies/conflicts: None.

### C18 Settings > General: 11 cards, async Password card shifts content, small inconsistencies (P2)
- Root cause: Password card appears after an async flag and pushes all cards down about 340 px; General holds 11 cards in 1664-1700 px; Time zone is split from Language; control heights differ (36 vs 32 px); Export has no pending text and no way to request a new export; Avatars show no selected state; Appearance/density use two segmented styles; Updates and Usage are nearly empty tabs.
- Findings: W1-09, V1-09, FLOW-09, W6-23, W2-19, W1-10, V1-11, V1-12, V1-13, W1-11, W2-08, FLOW-08, W2-20, W6-22 (unblock hint)
- Found by: W1, V1, FLOW, W6, W2
- Evidence: observed
- Reach: Every user who opens Settings
- Files:
  - apps/web/src/pages/AccountSettingsOverlay.tsx (order, grouping, reserve Password space, h-9 on both selects :788)
  - apps/web/src/components/DataExport.tsx:51-92
  - apps/web/src/components/NotificationSettings.tsx:57-80
  - apps/web/src/pages/Shell.tsx:4863-4876 (Usage menu item)
- Acceptance:
  - No content shifts after the pane opens (CLS 0 on General).
  - Rare actions (Password, Delete account) are last; Time zone sits with Language under one heading.
  - Request export shows 'Preparing...' immediately and a failed state; a ready export offers 'Request new export'.
  - Both selects are 36 px high.
- Needs product decision: yes. Split General into General and 'Privacy and approvals' (AI data sharing, Action confirmations, Notifications)? Drop the Usage menu item or the Usage tab?
- Dependencies/conflicts: AccountSettingsOverlay.tsx shared with C16; Shell.tsx shared with C1.

### C19 Skills and Memory lists show slugs, empty rows and nested scrollers (P2)
- Root cause: Bot settings lists 13-15 built-in skills by id inside a 288 px scroller within a scrolling panel; custom skills append at the bottom without highlight; Memory shows 'Nothing remembered yet' as a row above real items and once per bot; stored text shows internal paths; raw YAML for New skill; jargon error for bad SKILL.md.
- Findings: W6-12, W6-13, V1-16, V1-14, W2-07, W2-10, W2-17, W2-18, V1-17, W2-09
- Found by: W2, W6, V1
- Evidence: observed
- Reach: Everyone who opens bot settings or Settings > Memory
- Files:
  - apps/web/src/pages/KnowledgeSection.tsx:222, 259-262
  - apps/web/src/pages/shell/BotSkillsSection.tsx:407 (human names, custom first, highlight new)
  - apps/web/src/pages/shell/bot-panel.tsx (Advanced section: disabled tools field)
- Acceptance:
  - No skill is listed by its slug anywhere in Settings; the title matches the '/' picker.
  - Memory shows no 'Nothing remembered yet' row when real items exist, and hides empty bots.
  - A new skill is highlighted and scrolled into view; built-ins collapsed behind 'Built-in skills (N)'.
  - Bot panel scrolls once (no nested scroller).
- Needs product decision: no
- Dependencies/conflicts: None.

### C20 First-run tour covers content, has 9 stops and a wrong sentence (P2)
- Root cause: Step 1 popover sits on choice C of the first-run card (and the ring wraps the whole chat list); no pointer arrow; step 9 covers the Connect apps pill and mentions 'backups' that do not exist; at 375 no spotlight and the drawer auto-focuses Search; tour and first question compete. Tour copy repeats sidebar labels.
- Findings: W1-02, W1-03, W1-04, W1-05, V1-18, V1-19, V1-20, V1-02, W6-18, FLOW-13, FLOW-12
- Found by: W1, V1, W6, FLOW
- Evidence: observed (steps/overlap); code-read (length)
- Reach: Every new user, once
- Files:
  - apps/web/src/components/tour/FirstRunTour.tsx:21-66
  - apps/web/src/components/tour/TourPopover.tsx
  - apps/web/src/pages/Shell.tsx:705 (do not auto-focus search on touch)
- Acceptance:
  - No popover overlaps its target or the first-run question card (geometry check at 1440 and 375).
  - The tour starts only after the first question is answered.
  - No step names a feature that does not exist.
  - Opening the mobile drawer does not focus the search field.
- Needs product decision: yes. Cut the tour to 3-4 stops that end on a sample question in the composer, or keep nine stops and only fix placement?
- Dependencies/conflicts: Shell.tsx:705 shared with C1.

### C21 First-run Connect your apps and model step repeat themselves (P2)
- Root cause: Chief posts three bubbles that all say connect/authorize; at 375 card text is cut off; onboarding 'Connect a model' duplicates Settings > Models (provider, Advanced, Thinking); 'Loading...' for a new space has no progress text.
- Findings: V1-21, FLOW-03, W6-28
- Found by: V1, FLOW, W6
- Evidence: observed (apps step); code-read (model step)
- Reach: Every new owner on a server with no default model
- Files:
  - apps/web/src/components/onboarding/ConnectAppsStep.tsx
  - apps/web/src/pages/Onboarding.tsx:592-1085
  - apps/web/src/pages/Onboarding.tsx (loading text after 2 s)
- Acceptance:
  - One sentence above the app cards; card text wraps at 375; link targets at least 24 px high.
  - Model step shows two sign-in buttons and 'Use an API key instead' only; Thinking and Advanced live in Settings.
  - Space creation shows 'Setting up Chief...' after 2 s.
- Needs product decision: yes. Remove Thinking and Advanced from onboarding (Settings only)?
- Dependencies/conflicts: Onboarding.tsx unrelated to other clusters.

### C22 Integrations naming, vendor labels and jargon (P2)
- Root cause: One concept is called 'Connect apps', 'Integrations', 'Apps', 'Authorize' and 'Connect'; cards show 'via Composio'; 'MCP server URL' text; Hide Integrations vs Server integrations; Gmail row has no address; disconnect copy plural for one account.
- Findings: FLOW-05, V1-05, V1-06, V1-07, FLOW-15, W6-25
- Found by: FLOW, V1, W6
- Evidence: observed
- Reach: Every user; every connect decision
- Files:
  - apps/web/src/components/ConnectAppsButton.tsx
  - apps/web/src/components/integrations/parts.tsx:138
  - apps/web/src/components/integrations/IntegrationsHome.tsx:793
  - apps/web/src/components/integrations/AppDetail.tsx
  - apps/web/src/pages/AccountSettingsOverlay.tsx:261-270 (Server integrations)
- Acceptance:
  - One name for the place and one verb are used in sidebar row, page title, onboarding and buttons (grep over locale files).
  - No card shows a vendor name.
  - 'MCP' does not appear in the default view.
- Needs product decision: yes. Which single name: 'Apps' or 'Integrations'?
- Dependencies/conflicts: IntegrationsHome.tsx shared with C10, C23.

### C23 App logos are letter placeholders and loaded from a third-party CDN (P2)
- Root cause: AppLogo.tsx:10 and integrations.ts:100 load icons from cdn.simpleicons.org; with no network the fallback is an identical grey 'G' tile for Gmail, Drive, Calendar and GitHub; sidebar pill shows 'G G G'; the page leaks connected apps to a CDN, against 'no hosted vendor required'.
- Findings: W2-11, V1-04, W6-19, W3-15, V3-15 (sidebar G tile)
- Found by: W2, V1, W3, W6
- Evidence: observed (request and tiles)
- Reach: Integrations page, first-run cards, sidebar pill, bot avatars
- Files:
  - apps/web/src/components/integrations/AppLogo.tsx:10
  - apps/web/src/lib/integrations.ts:100
  - bundled icon assets for featured apps; distinct fallback per app
- Acceptance:
  - Network log of /app/integrations shows no request to a third-party icon host.
  - No two featured apps render the same fallback tile.
- Needs product decision: no
- Dependencies/conflicts: AppLogo.tsx only; IntegrationsHome.tsx untouched.

### C24 Integration setup forms: iMessage, Box, Elio voice, setup page (P2)
- Root cause: iMessage Test is disabled until Save with no reason, 'restart the server' shown to hosted users, bare 'Input validation failed'; Box dialog focuses the read-only callback URL; 'Call Elio' opens Voice settings with no explanation and the same icon as dictation; /integrations/setup has no shell and left-aligned column; reconnect copy.
- Findings: W2-06, W2-13, W2-16, W6-15
- Found by: W2, W6
- Evidence: observed
- Reach: Users setting up messaging, Box or voice
- Files:
  - apps/web/src/components/integrations/IMessageSection.tsx:249-258
  - packages/contracts/src/messaging-setup.ts:16
  - Box connect dialog
  - Voice settings tab + Elio entry in apps/web/src/pages/Shell.tsx
  - apps/web/src/pages/IntegrationSetup.tsx
- Acceptance:
  - Test connection is enabled once fields are filled or a reason is shown; errors name the failing field.
  - Box dialog autofocuses Client ID.
  - Call Elio with no provider shows 'Connect a voice provider to call Elio'.
  - /integrations/setup renders inside the shell.
- Needs product decision: no
- Dependencies/conflicts: None.

### C25 Inbox page chrome: header scrolls away, To do card is tall, controls stay in error states (P2)
- Root cause: The whole main pane scrolls so tabs vanish after 700 px; the To do card shows 5 items (about 300 px) on desktop but 2 on mobile; Pile tabs, Cleanup, Filter and Ask stay on screen when mail did not load; Filter menu repeats pile tabs; Unread filter badges every row; checked items disappear with no Undo; opening the agent panel wraps the header; Hide amounts eye on a page without amounts; 'Mark noise'; consent card pushes rows.
- Findings: V2-08, V2-09, W3-08, W3-17, W3-02, W3-14, W3-05, FLOW-17, V2-17, W3-04 (downgraded)
- Found by: V2, W3, FLOW
- Evidence: observed
- Reach: Every Inbox visit
- Files:
  - apps/web/src/pages/Inbox.tsx (header/tab stickiness, filter menu, error-state controls, :1177 Compose)
  - apps/web/src/components/inbox/TodoCard.tsx:25-34
  - apps/web/src/components/inbox/InboxRow.tsx
- Acceptance:
  - Header and pile tabs stay visible while scrolling the list (sticky).
  - To do card shows at most 2 items plus '+N more' at all widths; ticked items stay struck through until reload.
  - In the reconnect, rate-limit and no-mail states only the relevant action shows.
  - Compose has a tooltip or reason when disabled (the code disables it at Inbox.tsx:1177; the walker saw no response).
- Needs product decision: no
- Dependencies/conflicts: Inbox.tsx shared with C8, C9.

### C26 Attachment preview: 'Too large to preview' wastes 700 px and focuses the wrong button (P2)
- Root cause: MailAttachments.tsx:200 renders one grey line in a 700 px panel with Add to Data room focused first (Enter files the document instead of downloading); embedded browser PDF viewer shows a second toolbar and a raw id as title; narrow menu wraps; file names lose the extension.
- Findings: W3-09, V2-06, V2-19
- Found by: W3, V2
- Evidence: observed
- Reach: Anyone opening a large or unsupported attachment
- Files:
  - apps/web/src/components/inbox/MailAttachments.tsx:200
- Acceptance:
  - Too-large state shows file name, size and a primary Download focused by default.
  - PDF preview hides the nested toolbar and shows a readable title.
  - Middle-truncated names keep the extension.
- Needs product decision: no
- Dependencies/conflicts: None.

### C27 Cap table layout: header wraps, donut card is 390 px tall, table starts below the fold (P2)
- Root cause: Five header controls force the company name to truncate and 'Updated 25m ago' to wrap; summary and donut (about 520 px) remain above the tabs on every tab so only 3 rows show after filtering; rows are 56 px; Import/Add files duplicate the Data room; Cap table without Carta repeats the Contacts page.
- Findings: W5-05, W5-08, W5-11, W5-13, V3-11, V3-12, V3-13, V3B-09, V3B-10, V3B-12, FLOW-07, W6-08
- Found by: W5, V3, V3B, FLOW, W6
- Evidence: observed
- Reach: Every Cap table visit; narrow screens and agent panel open
- Files:
  - apps/web/src/pages/CapTable.tsx (header, :496, :688-700)
  - apps/web/src/components/cap-table/OwnershipDonut.tsx (fixed legend height)
- Acceptance:
  - At 1440 with the agent panel open the company name is untruncated and 'Updated' is on one line.
  - After choosing a tab or searching, at least 6 table rows are visible at 1440x900.
  - Table header is sticky; rows at most 44 px.
  - Cap table header has no Import or Add files.
- Needs product decision: yes. Remove Import and Add files from the Cap table header (use Data room only)? Without Carta, should Cap table show only a Connect Carta prompt?
- Dependencies/conflicts: CapTable.tsx shared with C11, C28; land C11 first.

### C28 Contacts: no feedback on add or delete, wrong default kind, truncated mobile table (P2)
- Root cause: Contacts passes onDeleted={load} only, so add and delete show nothing, while Cap table shows Saved/Deleted with Undo for the same records; Add contact defaults Kind to Other on Contacts but Investor on Cap table; the button is 24-26 px vs 32 px; at 375 Email and Organization disappear.
- Findings: W5-06, W5-07, V3-14, V3B-13, V3B-14
- Found by: W5, V3, V3B
- Evidence: observed
- Reach: Every Contacts user
- Files:
  - apps/web/src/pages/Contacts.tsx
  - apps/web/src/pages/CapTable.tsx (shared saved/deleted notice component)
- Acceptance:
  - Add shows 'Saved X' with row highlight; delete shows 'Deleted X' with Undo (same notice as Cap table).
  - Add contact uses the same size and default kind on both pages.
  - At 375 the organisation appears under the name.
- Needs product decision: no
- Dependencies/conflicts: CapTable.tsx shared with C11, C27.

### C29 Finance: long overview, wide tables, two bases for the same change figure (P2)
- Root cause: Overview is 1693 px tall; Subscriptions columns are 600-1000 px apart at 1440-1920 with 12 of 13 rows '+/-0%'; same vendor shows +21% (3 months) and +35% (Sep vs Jun); Burn page has a lone narrow card and a 474 px card with 3 rows; vendor table cramped at 375; chart label clipped; two burn numbers close together; 'overlaps' tag unexplained.
- Findings: V2-07, V2-10, V2-11, V2-13, V2-14, V2-15, V2-16, FLOW-19, W5-04
- Found by: V2, FLOW, W5
- Evidence: observed (W5-04 perf not isolated)
- Reach: Every Finance visit
- Files:
  - apps/web/src/pages/Finance.tsx (:949 overlaps tag, subscriptions table, burn view, category view)
  - subscription change calculation
- Acceptance:
  - Same vendor shows the same percent and window label on both pages.
  - Subscriptions table has a max width; zero-change rows show nothing.
  - No clipped chart label at 375; empty Receipt column hidden.
  - 'Spent so far this month' is the label of the month-to-date strip.
- Needs product decision: no
- Dependencies/conflicts: Finance.tsx only (plus components/finance/ui.tsx).

### C30 Data room Auto-sort, toolbar duplication and copy (P2)
- Root cause: Auto-sort takes about 45 s showing only a timer, then lists 89 moves including already-filed documents; toast says 'Sorted 89' and undo says 'Undid 99'; header has seven controls; Import and Add files are two doors; root folder has three names; zip errors give no next step; bad ?item= is silent; dates use UTC not local day; Send-to-agent menu lists Legal below the fold; Hide amounts eye on Data room.
- Findings: W4-03, W4-04, FLOW-16, W4-11, W4-12, W4-15, W4-16, W4-18, W4-19, V3B-19, V3-10 (sources card), V3B-06
- Found by: W4, FLOW, V3, V3B
- Evidence: observed
- Reach: Data room users during a raise
- Files:
  - apps/web/src/components/data-room/AutoSortDialog.tsx
  - apps/web/src/components/data-room/upload-toasts.ts:248-257 and DataRoom.tsx:765
  - apps/web/src/components/data-room/ItemDialogs.tsx:296, Preview.tsx:264 (one root name)
  - apps/web/src/lib/format.ts dateText
  - apps/web/src/components/data-room/ItemMenu.tsx
- Acceptance:
  - Sort and Undo toasts report the same count.
  - Auto-sort review groups moves by destination with 'Apply N moves' and defaults to loose items.
  - The root folder is 'All items' in tree, Move dialog and Folder field.
  - Date shown is the viewer's local day.
- Needs product decision: no
- Dependencies/conflicts: DataRoom.tsx shared with C5, C6, C7.

### C31 Routine editor: trigger menu covers the form, greyed items, repeated schedule text (P2)
- Root cause: The 'Choose when it runs' menu opens over the Name field; 5 of 7 trigger items are disabled with no reason; the schedule card repeats 'Weekdays at 8:00 AM' beside the selects; Save gives no 'Saved'; Activity panel has no title.
- Findings: W6-11, W6-26, W6-27
- Found by: W6
- Evidence: observed
- Reach: Anyone creating a routine
- Files:
  - apps/web/src/pages/RoutineEditor.tsx
  - apps/web/src/pages/RoutineSchedule.tsx
  - apps/web/src/pages/ActivityList.tsx
- Acceptance:
  - Trigger menu opens downward without covering typed input; unavailable providers are hidden.
  - Summary text hidden while selects are shown; Save flashes 'Saved'.
  - Activity panel has the heading 'Activity'.
- Needs product decision: no
- Dependencies/conflicts: RoutineEditor.tsx also used by C4 (small).

### C32 Approval rules: two buttons that look like actions, not switches (P2)
- Root cause: 'Ask before sending external email' and 'Ask before purchases' are plain buttons with no state; a click adds a rule row at the bottom and a second click does nothing.
- Findings: W6-16
- Found by: W6
- Evidence: observed
- Reach: Anyone setting approval rules
- Files:
  - apps/web/src/components/ApprovalRulesSettings.tsx:113
- Acceptance:
  - Both options are switches with on/off state that match the rule list; toggling off removes the rule.
- Needs product decision: no
- Dependencies/conflicts: Related to FLOW-09 in C18.

### C33 Toasts cover content and persist (P2)
- Root cause: Upload and agent toasts overlap each other and the preview pane; a mobile toast sits mid-screen with no dismiss; 'Chief finished' toast covers the reply and composer for the chat being viewed; '+2' stack covers the Routines panel.
- Findings: W4-09, V1-31, W6-20
- Found by: W4, V1, W6
- Evidence: observed
- Reach: All pages while anything runs
- Files:
  - toast host in apps/web/src/pages/Shell.tsx
  - apps/web/src/components/data-room/upload-toasts.ts
- Acceptance:
  - One toast stack with spacing; no toast over the composer.
  - No 'finished' toast for the chat in view.
  - Every toast has a dismiss control and expires.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx shared.

### C34 Touch targets under 44 px on phones (P2)
- Root cause: Small controls across pages: checkboxes 16 px, Details/Dismiss 24 px, switches 32x18, text links 18-21 px, header icons 28-36 px. Extends deferred issue UXV-7 (design-system button sizes on coarse pointers).
- Findings: V1-15, V1-24, V2-18, V3-07, V3B-04, W3-10, W4-08, V3-03
- Found by: V1, V2, V3, V3B, W3, W4
- Evidence: observed (measured)
- Reach: All phone-width users
- Files:
  - packages/ui-web button, switch, checkbox size tokens (pointer-coarse)
  - ProcessingStrip.tsx:89
  - CleanupSenderRow.tsx
  - AccountSettingsOverlay.tsx tab nav
- Acceptance:
  - On coarse pointers every interactive element measured by the geometry audit has a hit area of at least 44 px on the pages in this iteration.
  - Settings tabs on 375 scroll in one row.
- Needs product decision: no
- Dependencies/conflicts: Shared packages/ui-web; land after page clusters or as the first shared change.

### C35 Artifacts page: 11 bot chips, duplicated type, generic icons (P2)
- Root cause: Filter panel lists 15 bots (3 rows) though artifacts come from one; stays open above the viewer; title carries the extension and an MD badge; one generic icon; 'All time' is a native select.
- Findings: W6-09, V3-15, V3B-15, V2-21
- Found by: W6, V3, V3B, V2
- Evidence: observed
- Reach: Artifacts visitors
- Files:
  - apps/web/src/pages/Artifacts.tsx
- Acceptance:
  - Only bots that own artifacts are offered, in one dropdown.
  - Panel collapses when an item opens.
  - Type appears once per card.
- Needs product decision: no
- Dependencies/conflicts: None.

### C36 Hide amounts: six entry points and menu naming (P2)
- Root cause: The same toggle is an eye icon in five page headers (including pages with no amounts) plus a user-menu item; user menu has Usage duplicated in Settings, no divider before Log out, buttons without menu roles; two destinations called 'Settings'.
- Findings: FLOW-06, V2-17 (eye), V3B-19, V1-27, V1-28
- Found by: FLOW, V2, V3B, V1
- Evidence: observed
- Reach: Every page header
- Files:
  - apps/web/src/components/HideAmountsToggle.tsx and usages in Inbox.tsx:58, CapTable.tsx:48, DataRoom.tsx:51, Legal.tsx:15, components/finance/ui.tsx:51, Shell.tsx:148
  - account menu and bot menu in Shell.tsx
- Acceptance:
  - Hide amounts has one entry point.
  - Bot menu item is 'Bot settings'.
  - Account menu items have menuitem roles and a divider before Log out.
- Needs product decision: yes. Keep Hide amounts only in the account menu, or one eye in the sidebar footer?
- Dependencies/conflicts: Touches headers also edited by C25, C27, C30, C39.

### C37 Sidebar bugs: silent rename failure, Auto-group moves Chief, unnamed counts, rail loses markers (P2)
- Root cause: Renaming a folder to an existing name silently reverts; Auto-group files Chief into 'Agents'; Legal and Data room counts have no accessible name; the collapsed rail drops unseen markers; hidden pages flash for 1 s before account settings load; avatar and row sizes differ; two tab stops per chat; space headings 3.2:1.
- Findings: W1-12, W1-14, W1-06, W6-10, W1-07, W1-13, W1-15, V1-30, W6-17, V1-29
- Found by: W1, W6, V1
- Evidence: observed (W6-17 estimated)
- Reach: Every sidebar user
- Files:
  - apps/web/src/pages/Shell.tsx (folder rename, auto-group, page row value aria-label, rail icons, hiddenPages default)
  - SidebarPageLink.tsx
- Acceptance:
  - Duplicate folder name shows an inline error.
  - Auto-group never moves Chief.
  - Every sidebar count has an aria-label; rail icons show an unseen dot.
  - No flash of hidden pages after load.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx, after C1/C2/C4/C15.

### C38 Space and page bootstrap shows blank or long loading with no timeout (P2)
- Root cause: 'Opening your Space...' lasted 7-26 s on contended runs; switching to an empty space was black for 3 s; first search showed Searching for 25 s; skeleton header height differs from the real header; text says 'Space' while the sidebar says the company name. All timings were taken with a load average near 21 and other walkers active, so the slowness is unverified.
- Findings: W3-12, W2-14, V2-20, V1-26, W6-07, FLOW-20
- Found by: W3, W2, V2, V1, W6, FLOW
- Evidence: observed once each; cause unverified
- Reach: Cold loads
- Files:
  - apps/web/src/components/ShellSkeleton.tsx:8
  - bootstrap path in apps/web/src/pages/Shell.tsx
- Acceptance:
  - After 8 s the loading screen shows 'Still opening...' and a Retry button.
  - Skeleton header height matches the loaded header.
  - Re-measure cold load on an idle stack and record the number.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx.

### C39 Legal page: consent state stated three times, mobile order, graph padding (P2)
- Root cause: Header says daily scans wait, a line under the disabled Scan now button repeats it, and the banner repeats it a third time (a scan 7 h ago contradicts it); on mobile banner plus four tiles fill the first screen; graph has 170 px empty bands.
- Findings: V2-05a, V2-05c, W5-09, V2-22
- Found by: V2, W5
- Evidence: observed
- Reach: Legal visitors
- Files:
  - apps/web/src/pages/Legal.tsx:136-141
- Acceptance:
  - Consent state appears once (banner); contracts visible at 375 px above y=500 or tiles collapse to one row.
- Needs product decision: no
- Dependencies/conflicts: Legal.tsx also in C16 and C36.

## Deferred items (not in a cluster)

- FLOW-11 Fold integration agents into one 'Agents' folder and pin Pages: product decision; C1 removes most of the pain.
- FLOW-14 Run location, notifications and time zone set in several places: suspected, desktop parts not visible in a browser.
- FLOW-17 Inbox stacks three rows of chrome: partly covered by C25; the account-menu proposal needs a decision.
- W1-11 / W2-08 covered by C18. W1-04 tour drops hidden-page step: acceptable as is.
- W2-18, W2-09 skill/URL import error wording: P3, fold into C19 if time.
- W3-16 Catalog drift (INB-018 copy, Rename space, Task board in user menu, Memory list now exists): edit `docs/ux-paths/catalog.md`, no code.
- W5-12 SAFE investors show a dash in Ownership: known by design.
- W6-21 Wrong reason for unsupported .docx attachment; W6-22 locale strings and aria-labels left in English; W6-24 Log out lands on /sign-in not Welcome (decide, update story or code).
- V1-22 Landing tagline orphan 'cash,'; V1-23 mascot eyes dark on dark; V1-25 sign-in error shifts form by 24 px; V1-29 sidebar rows 50 px (partly in C37).
- V3-16 Sidebar search results narrow and 'Message' label; V3-12 / V3B-12 mobile header wrapping (C27 covers Cap table).
- W3-14 and W3-13 visual remainder, V2-20 and W5-04 perf (C38 needs idle-stack re-measure).
- Already deferred by earlier registers and still open: UXV-5 tablet shell (unmerged `ux-visual/shell`), UXV-8 Gmail write switch, UXV-9 thinking timer, UXV-10 computer panel empty, UXV-11 reconnect retry, UXV-12 integrations polish. Findings: none new seen this pass.
- Known and not re-raised: thread view, row attachment markers, To do / Needs reply overlap, Noise/Junk wording (`docs/ux-flow/report.md`).

## BLOCKED and SKIPPED stories (need a different setup)

- W1 BLOCKED: APP-301-306, 308-310 (deployment has a default model, real OAuth), 312-315, 319 (apps step is owner-only, real OAuth), 332-337, 340-342 (need Electron/Docker), 345-347 (fresh user has no Gmail). SKIPPED: 325, 326, 329, 331, 339, 344, 349, 350.
- W2 BLOCKED: APP-355 (no outbound network), 361 (no memory provider), 366-370 (real OAuth/keys), 373 (needs member account), 376, 383 (Mercury agent already exists), 392, 396-399 (no scripted voice runtime). SKIPPED: 357, 358, 362-364, 381, 389, 391, 393-395.
- W3 BLOCKED (demo state): INB-101, 102, 105, 111, 113, 115, 120, 121, 025; SKIPPED: 108 (native), 110 (operator setting), 117. Need a seeded mailbox with a Newsletters pile, 3+ mails per sender, unsubscribe headers and multi-attachment mail.
- W4 BLOCKED: DRM-001 (room not empty), 009 (consent card), 020, 021, 039, 040, 042-044 (real Gmail/Drive/Box), 110; SKIPPED: 027, 028, 036, 109, 121.
- W5 BLOCKED: CAP-101 (Carta off), 106 (real Carta sign-in), 107 (second user); SKIPPED: LEG-029, CAP-005/010/015-017/029/031 (mutate shared data or need agent runs).
- W6 BLOCKED: APP-111 popup cases, 137, 138 (desktop), 190 (messaging off).
- Never walked in a browser: native mobile (Expo/iOS), Electron desktop, real Gmail Pub/Sub push, real OAuth consent screens. A single-user mock stack with an idle machine is needed for the performance findings.

## Counts

- Raw findings (before dedupe): about 233. P0 0, P1 32, P2 103, P3 98 (counts parsed from the severity column of each file; V3 and V3B ids are counted separately).
- Clusters: 39. By severity (max of member findings): P1 16, P2 23.
- Clusters needing a product decision: 9 (C8, C9, C16, C18, C20, C21, C22, C27, C36).
- Clusters resting on a suspected cause that needs investigation first: C8, C13, C14, C15.
- Dropped or downgraded: W3-04, W6-03.
