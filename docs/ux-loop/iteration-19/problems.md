P0: 0, P1: 2, P2: 11, P3: 9

# Iteration 19 problems: fix clusters

Sources: R1-R3 (verify pass-18 clusters C1-C20), J1-J3 (journeys; J3 at 375 px with real touch emulation), FLOW, V1-V3 (visual), all on the mock demo stack (web 5381). Iterations 1-18, docs/ux-flow and docs/ux-visual were consulted for decisions. A cluster that reopens an earlier one says so in its Reopens line. Rank: P0, then severity, then smaller effort first.

Owner decisions respected and not re-raised: nine-stop tour with a fixed card (J1-02 timing recorded only); the page is called Integrations; consent asked once; 44 px on coarse pointers; Legal Deadline row actions Ask agent / Done / Dismiss (V2-05 dropped); approval toasts persist; five Settings sections with Memory fixed height; Investors and Fundraising judged for P0/P1 only; Cmd+K lists pages (decided).

Environment caveats: about ten walkers shared one demo account and host load was 55-85, so cold-load stalls (R3-07, V3-14) are not filed. Shared-account leftovers (extra bots, folders, approvals, Mercury Allow changes now ON, J2 Payments bot) are not findings.

Severity calls: two P1. C1 (an approved money request is followed by text saying it still waits for approval). C2 (Legal scan silently dismissed notice deadlines and rewrote values; observed once, cause not verified, kept P1 because the loss is silent and affects deadlines with real cost). Lowered: V2-03 Finance phone header P1 to P2 (figures stay readable; C5); J2-04 Investors agent contradicting the page P1 to P2 and deferred (Investors is limited to P0/P1 by the owner); R3-01 bots/list calls P2 to P3 (no visible effect).

## Pass-18 cluster verification (R1-R3)
- Met: C1 approval toast restore (mail variant; Mercury variant not run), C2 Legal truncation (the unchecked line is reopened in C3), C3 Finance cash note, C5 Data room list, C11 Legal agent wording, C12 Mercury second switch, C14 toolbar and composer, C18 Command palette, Storybook smoke 1789/1789 (R3).
- Not met (reopened): C6 sidebar (now C10), C8 first mail sort (C13), C10 Integrations (C19), C13 Routines caption (C16), C15 Finance charts (C14), C16 bots/list (C17), C17 keyboard (C18), C19 Settings (C20), C20 Artifacts and phone PDF (C21, C4).
- Partly or unverified: C4 Investors equity dash (fresh session not run), C7 mail approval account picker (demo has one account), C9 slow loads (mail error state lacks Reply/Archive, C15).

## Fix clusters, ranked

### C1 [P1] After Approve on a money request, the agent and the requesting bot still say 'waiting for your approval', so Maya cannot tell if money moved
- Rank: 1. Effort: S.
- Finding ids (found by): J2-02 (J2), R1-08 (R1)
- Root cause: The card already reads 'Approved here. Waiting for Mercury' (AskCard.tsx:46), but the requestSendMoney tool result gives the model no final state, so the model tells the user to approve again, and the requesting bot repeats a 'waiting for approval in the Mercury agent chat' bar. After a Deny the model also says 'the user denied' in the third person.
- Verification: OBSERVED by J2 in pay-09 to pay-11 and R1-08 in c1-pay4. AskCard.tsx:46 CONFIRMED to carry the right card text; the contradictory sentences come from model text and tool-result wording (SUSPECTED, tool result not read). The scripted demo model may differ from a real one, so check with the real tool result string.
- Files to change:
  - packages/adapters/src/finance-fake-tools.ts and the real Mercury tool result text for requestSendMoney (return 'Sent to the bank, awaiting processing; no further approval is needed')
  - apps/api integration agent instructions: after an approved payment, say it is sent and do not ask again; after Deny, address the user as 'you'
  - apps/web/src/pages/Shell.tsx:4318 ('Open <agent>' bar in delegated chats: hide once the approval is answered)
  - Mercury agent read-only message (R1-08): link to the Mercury page 'Allow changes' switch, not Open Integrations
  - test: tool result string after approve and after deny
- Reach: Anyone who pays a bill through an agent (STORY-APP-385/386); money journey where an ambiguous state invites a double click.
- Acceptance criteria:
  - After Approve, neither the Mercury chat nor the requesting bot's reply contains 'waiting for your approval' or offers another approval.
  - After Deny the reply says 'you denied' (second person) and offers no retry text that implies approval is pending.
  - The 'Open <agent>' bar disappears once the card is answered.
  - With writes off the agent message points to the Allow changes switch on the Mercury page.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C6, C7, C10, C16 (Shell.tsx)

### C2 [P1] A Legal 'Scan now' silently dismissed four notice deadlines and rewrote contract values, with no change summary and no way to see dismissed rows
- Rank: 2. Effort: M.
- Finding ids (found by): J2-01 (J2)
- Root cause: The scan reruns the Legal agent over every document; re-analysis re-derives deadlines and contracts and dismisses derived rows it no longer finds (testkit legal-tools test shows derived open deadlines are dismissed on reclassify). Nothing limits a scan to add and update, nothing reports what changed, and Show done lists only done rows, so dismissed rows cannot be reached or restored.
- Verification: OBSERVED by one walker on a shared stack (cause not verified; another walker could also have scanned). Code: LEGAL_SCAN_PROMPT does not itself dismiss; dismissal comes from the agent's tools and instructions (SUSPECTED). Kept at P1 because silent loss of notice deadlines is a core Legal failure, but a reviewer should first reproduce it on an idle stack.
- Files to change:
  - apps/api/src/legal-agent.ts:28 (LEGAL_SCAN_PROMPT: add 'never dismiss or lower a value without a document date that contradicts it; list every change')
  - apps/api legal tools (legal_upsert_deadline / dismiss path): record a scan change log
  - apps/web/src/pages/Legal.tsx (a 'Scan changed N items' line with Undo; list Dismissed rows under Show done with Restore)
  - test: a scan over unchanged documents leaves deadline count and contract values unchanged
- Reach: Every Legal user who runs or waits for the daily scan; losing a non-renewal notice date has a real cost (Nov 2, Nov 10, Dec 5 in the demo).
- Acceptance criteria:
  - Scan now twice on unchanged documents leaves 9 deadlines and the same contract values.
  - After a scan that changes anything, the page shows 'Scan changed N items' with Undo.
  - Show done also lists dismissed rows with a Restore action.
  - A scan never dismisses a deadline that has a document date unless the date changed.
- Needs product decision: true. May a scan ever dismiss a deadline on its own? Recommended: no. A scan adds and updates only, and proposes removals as a list for Maya to confirm.
- Depends on: none. Conflicts (shared files): C3 (Legal.tsx), C22 (legal-agent.ts)

### C3 [P2] Legal: the 'N documents not yet checked' line is still plain text with no action, repeats 'Reading 0 of 32', and the Term column wraps on every row
- Rank: 3. Effort: S. Reopens: iteration-18 C2.
- Finding ids (found by): J2-08 (J2), FLOW-01 (FLOW), R1-06 (R1), V2-10 (V2), V2-04 (V2), R1-07 (R1)
- Root cause: Legal.tsx:301-315 renders the unchecked count as a bare <p>; the pass-18 criterion allowed that, but four walkers call it a dead end (the one unchecked file may be the failed NDA, so a scan cannot clear it). The Term column is too narrow for 'Dec 2, 2025 - Dec 2, 2026', so all 10 rows are 57 px.
- Verification: OBSERVED by J2, R1, V2; FLOW suspects the file is the failed NDA (not confirmed). Code CONFIRMED: Legal.tsx:301-315 is a plain <p>. V2-05 (three buttons per Deadline row) dropped: decided.
- Files to change:
  - apps/web/src/pages/Legal.tsx:301-315 (turn into a 'Check now' button; hide while scanning; if the unchecked file is the failed one, link to the Data room failed filter)
  - apps/web/src/pages/LegalContracts.tsx:162-169 (Term/Renewal whitespace-nowrap or 'Dec 2025 - Dec 2026')
  - test: unchecked line renders a button when count > 0
- Reach: Every Legal visitor with unchecked documents; a repeat of pass-18 C2.
- Acceptance criteria:
  - The unchecked line is a button or link; pressing it starts the scan or opens the unchecked/failed files.
  - During a scan the line is hidden or shows one progress statement.
  - Contract rows are single-line (about 36-40 px) at 1440 wide.
- Needs product decision: false
- Depends on: C2 should land first (same page). Conflicts (shared files): C2 (Legal.tsx)

### C4 [P2] Data room preview: Open and Download shown twice, Enter closes the preview, a failed file offers 'Try again' for an unreadable PDF and has no action in the pane
- Rank: 4. Effort: S. Reopens: iteration-18 C20 (phone PDF) and C9.
- Finding ids (found by): R1-04 (R1), R3-03 (R3), J3-02 (J3), V3-10 (V3), V3-01 (V3), FLOW-07 (FLOW), J2-10 (J2), V3-11 (V3)
- Root cause: The preview header and the body both render Open/Download (PreviewActions.tsx, PdfPhoneFallback). ItemRows.tsx:128-130 makes Enter and Space call onToggle, which closes an already open preview. The not-readable error (data-room-jobs.ts:362) is shown with Try again, which cannot fix a non-PDF; the pane has Delete only and the Type cell is blank.
- Verification: OBSERVED by R1, R3, J3, V3, J2, FLOW (duplicate buttons on 4 walkers). Code CONFIRMED: ItemRows.tsx:128-130 calls onToggle on Enter/Space.
- Files to change:
  - apps/web/src/components/data-room/PreviewActions.tsx (one pair of Open/Download per width)
  - apps/web/src/components/data-room/Preview.tsx (failed pane: say what to do, offer Replace file)
  - apps/web/src/components/data-room/ItemRows.tsx:128-130 (Enter/Space open, Escape closes)
  - apps/web/src/components/data-room/ItemMenu.tsx:51 and packages/adapters/src/data-room-jobs.ts:362 (Try again only for retryable errors; Replace file otherwise)
  - ItemRows type cell: 'Not read' for failed files
  - test: Enter on an open row keeps the preview
- Reach: Anyone previewing Data room files, every phone user, keyboard users.
- Acceptance criteria:
  - Phone and desktop preview each show Open and Download exactly once.
  - ArrowDown then Enter leaves the preview open; Escape closes it.
  - A not-readable PDF offers Replace file and Delete, not Try again; Try again stays for timeouts.
  - The failed file's Type cell reads 'Not read'.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C11, C12 (components/data-room/)

### C5 [P2] Finance on a phone: the 128 px sticky header truncates the company and sync text and wraps the non-USD note to three lines; 'Out so far this month, not over' is odd
- Rank: 5. Effort: S. Reopens: iteration-18 C3 (partly).
- Finding ids (found by): J3-01 (J3), V2-03 (V2), J2-15 (J2), V2-11 (V2)
- Root cause: Finance.tsx:396-470 keeps the title, company menu, source link, sync time and nonUsdNote in a sticky wrapper (line 412) that does not shrink on phones; the note starts with a stray bullet (line 440). Line 382 uses 'not over'. The same row wraps and truncates beside the Ask panel at desktop width.
- Verification: OBSERVED by J3 (touch emulation), V2, J2. Code CONFIRMED: Finance.tsx:440 renders `<span> · {nonUsdNote}</span>`.
- Files to change:
  - apps/web/src/pages/Finance.tsx:382,396-470 (status row: dot plus 'synced just now' on phones, note only when non-zero and not sticky; plain 'Spent so far this month')
  - test: Finance header at 375 px has one status line
- Reach: Every phone user of Finance (core money page) and desktop with the Ask panel open. Rated P2: the figures remain readable, V2 rated P1.
- Acceptance criteria:
  - At 375 px the header is at most 72 px high and not sticky below the title.
  - No text in the status row is cut off by an ellipsis.
  - The strip reads 'Spent so far this month'.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C14 (Finance.tsx)

### C6 [P2] Approval toast covers the chat's 'Open agent' bar and 'Jump to latest' when a right panel is open; Activity and toast name the same approval differently
- Rank: 6. Effort: S.
- Finding ids (found by): J2-05 (J2), V2-08 (V2), V3-06 (V3)
- Root cause: The toast stack is fixed to the viewport corner (Shell.tsx approval toast container) and the delegated chat's full-width bar (Shell.tsx:4318-4322) is wider than the composer, so with a panel open they overlap and 'Jump to latest' is not clickable. roster-status.ts:15 labels approvals 'Needs your answer' while the toast says 'needs approval'.
- Verification: OBSERVED by J2, V2, V3.
- Files to change:
  - apps/web/src/pages/Shell.tsx:4318-4326 (align bar to composer width; hide once answered)
  - apps/web/src/pages/Shell.tsx toast container (anchor to the chat column)
  - apps/web/src/lib/roster-status.ts:15 ('Needs approval' for approvals)
- Reach: Anyone with a pending approval and a side panel open.
- Acceptance criteria:
  - With the routine panel open, Jump to latest and the Open agent bar are clickable while a toast shows.
  - The bar width matches the composer.
  - Activity says 'Needs approval' for approvals.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1, C7, C10, C16 (Shell.tsx)

### C7 [P2] Phone drawer: choosing Bot settings leaves the drawer open over the panel; the tour card is wider than the drawer
- Rank: 7. Effort: S.
- Finding ids (found by): V1-01 (V1), V1-10 (V1)
- Root cause: Shell.tsx:6804 (BotContextMenu onEdit) does not call setMobileSidebarOpen(false) as the other handlers at ~4703-4837 do. The tour card is 343 px wide against a 316 px drawer.
- Verification: OBSERVED by V1; code line given by V1, not re-read.
- Files to change:
  - apps/web/src/pages/Shell.tsx:6804 (close the drawer in onEdit, Routines, Duplicate)
  - tour card width clamp on phones
- Reach: Phone users opening bot settings.
- Acceptance criteria:
  - On a 375 px screen Bot settings shows the panel immediately with the drawer closed.
  - Tour card stays inside the drawer width.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1, C6, C10, C16 (Shell.tsx)

### C8 [P2] GTM first view shows channel policy tables and empty sections before a goal exists
- Rank: 8. Effort: S.
- Finding ids (found by): FLOW-03 (FLOW), FLOW-04 (FLOW)
- Root cause: Gtm.tsx shows the Connect Zernio banner, a Channels table repeating the same fact, approval counters, and empty 'Needs you 0' and 'In progress 0' sections; 'Up to date' appears three times (Gtm.tsx:107, 242, 281) and the Email destination breaks mid-word.
- Verification: OBSERVED by FLOW from a screenshot; code line numbers from FLOW.
- Files to change:
  - apps/web/src/pages/Gtm.tsx (goal card and one Connect row until a goal exists; drop empty sections; wrap destination at commas)
- Reach: Every first-time GTM user.
- Acceptance criteria:
  - With no goal the page shows only the goal card and the Connect Zernio row.
  - 'Up to date' appears at most once.
  - Email destinations wrap at commas.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C9 [P2] Bot settings show Notifications on while Browser notifications are off in Settings
- Rank: 9. Effort: S.
- Finding ids (found by): FLOW-02 (FLOW)
- Root cause: bot-panel.tsx:520-540 shows the per-bot switch regardless of account delivery; nothing tells the user the account switch is off.
- Verification: OBSERVED display; non-delivery SUSPECTED (no bot run triggered).
- Files to change:
  - apps/web/src/pages/shell/bot-panel.tsx:520-540
- Reach: Every bot owner.
- Acceptance criteria:
  - With browser notifications off, the bot row shows 'Off in Settings' or is hidden, or turning it on offers one-tap enable.
- Needs product decision: true. Hide the per-bot switch until delivery is on, or show 'Off in Settings' beside it? Recommended: show 'Off in Settings' with a link.
- Depends on: none. Conflicts (shared files): C16 (bot panel)

### C10 [P2] Sidebar on short screens: no '+N more' cue, Activity squeezes chats to about one row, the last group is cut under the fade
- Rank: 10. Effort: M. Reopens: iteration-18 C6.
- Finding ids (found by): R1-01 (R1), FLOW-05 (FLOW), V3-05 (V3), V1-05 (V1), V1-06 (V1), J3-03 (J3)
- Root cause: The bots scroller (Shell.tsx:~4900) only fades at the bottom. At 1280x800 it shows 4 chats plus a cut fifth, at 720 high three, with Activity open none. The Activity block takes about 40% of the sidebar (ActivityList.tsx), and there is no count of hidden rows or fully opaque fade, so a half row looks like a rendering bug. The pass-18 criteria (6 rows at 800 high, '+N more' cue) were not met.
- Verification: OBSERVED by R1, FLOW, V3, V1, J3. Code not re-read (ActivityList.tsx max-height class not found by grep; file located at apps/web/src/pages/ActivityList.tsx).
- Files to change:
  - apps/web/src/pages/Shell.tsx:~4900 (sidebar scroller: '+N more' row when clipped; snap or opaque 12 px fade; cap chats per space with 'Show N more'; reserve a slot for the unread dot beside the row menu)
  - apps/web/src/pages/ActivityList.tsx (cap Activity at about 3 rows with inner scroll, or collapse the Pages block while Activity is open)
  - phone drawer: start Pages collapsed when there are many chats (J3-03)
  - test: sidebar at 800 px high shows 6 chat rows or a '+N more' row
- Reach: Every desktop user on a laptop screen; the main navigation.
- Acceptance criteria:
  - At 1280x800 with Activity closed the list shows 6 chat rows or a '+N more' row.
  - At 720 high a '+N more' cue is present.
  - With Activity open at 1440x900 at least 3 chat rows stay visible.
  - No row is half-hidden by the fade at rest.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1, C6, C7, C16 (Shell.tsx)

### C11 [P2] Data room filter bar: the view switch is hidden on phones, the Filters button jumps between views, and the failed badge opens Stats
- Rank: 11. Effort: M.
- Finding ids (found by): V3-02 (V3), V3-03 (V3), V3-04 (V3), J2-06 (J2)
- Root cause: FilterBar.tsx:265-330 puts the List/Grid/Stats switch only inside the phone Filters panel, moves the Filters button per view, removes search and Sort in Stats so pills move 332 px, and leaves the panel open. DataRoom.tsx opens the remembered Stats view when the sidebar 'N files failed' badge is clicked.
- Verification: OBSERVED by V3 and J2.
- Files to change:
  - apps/web/src/components/data-room/FilterBar.tsx:265-330
  - apps/web/src/pages/DataRoom.tsx (failed badge handler: force List view)
  - test: FilterBar keeps pill position across views; badge opens List
- Reach: Phone Data room users and anyone using the failed-files badge.
- Acceptance criteria:
  - On a phone the List/Grid/Stats switch is visible without opening Filters, or the button says 'Filters and view'.
  - The Filters button and pills keep the same x position in all three views at 1440.
  - Clicking '2 files failed' always shows the files list with the Failed filter.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C4, C12 (components/data-room/)

### C12 [P2] Data room imports: the 'Processing' and 'Imported' strips stay for minutes, files stay 'Not tagged yet' with no reason, video can be imported
- Rank: 12. Effort: M.
- Finding ids (found by): J2-03 (J2), J2-09 (J2), J2-11 (J2)
- Root cause: The processing strip has no timeout, and Preview.tsx 'Not tagged yet.' gives no reason or action (for example AI sharing off, or an unreadable type). The email import picker does not mark unsearchable types, so a 12.6 MB mp4 is imported. The empty folder name error blames slashes.
- Verification: OBSERVED by J2 only; cause of the stuck strip not traced (SUSPECTED a stuck job on the shared stack).
- Files to change:
  - apps/web/src/components/data-room/ImportActivity.tsx (end the strip when jobs end)
  - apps/web/src/components/data-room/Preview.tsx ('Not tagged yet' with a reason and one button)
  - apps/web/src/components/data-room/ImportFromEmail.tsx (mark 'Won't be searchable')
  - apps/web/src/components/data-room/ItemDialogs.tsx:114 ('Enter a folder name' for empty)
- Reach: Founders importing diligence files (STORY-DRM-121).
- Acceptance criteria:
  - The strip ends within one job cycle after all files are processed or failed.
  - An untagged file states why and offers one action.
  - Video files in the picker carry a 'Won't be searchable' note.
  - Empty folder name error does not mention slashes.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C4, C11 (components/data-room/)

### C13 [P2] Inbox: the first sort still files 73% of mail under Needs reply, and the list re-groups and jumps about 150 px when sorting finishes
- Rank: 13. Effort: M. Reopens: iteration-18 C8.
- Finding ids (found by): R1-02 (R1), V2-01 (V2), J1-01 (J1)
- Root cause: The mock classifier puts 24 of 33 mails in Needs reply (criterion under 40%). Inbox.tsx:1668 and :1743 render the unsorted list under 'Sorting your mail...', then replace it with the To do box and groups, so every row moves.
- Verification: OBSERVED by R1, V2, J1. R1-02 cause (classifier vs seed text) NOT traced; may be demo seed data. Sort-during-load needs a fresh mailbox (BLOCKED for R1).
- Files to change:
  - apps/web/src/pages/Inbox.tsx:1668,1743 (flat dimmed list or reserved To do height until sorted; first-sync line that updates as mail arrives)
  - inbox sort classifier in apps/api (Needs reply only for a direct question or deadline)
  - test: needs-reply share on the demo mailbox under 40%
- Reach: Every founder on the first morning (STORY-INB-022).
- Acceptance criteria:
  - Rows do not move more than 8 px when sorting finishes.
  - On the demo mailbox Needs reply holds under 40% of mail.
  - First sync shows a changing count or line, not a static skeleton.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C15 (Inbox.tsx)

### C14 [P3] Finance charts and runway page: unlabeled Quarter ring, empty band beside the Burn summary card, mismatched card headers, Runway page lacks a basis caption
- Rank: 14. Effort: S. Reopens: iteration-18 C15.
- Finding ids (found by): R2-19-02 (R2), R2-19-03 (R2), V2-12 (V2), V2-02 (V2), J1-03 (J1)
- Root cause: Month view labels the Financing ring, Quarter/Year do not. The Burn sub-page summary card is 170 px wide with nothing beside it. Breakdown and Upcoming headers differ in height (pill taller). The Runway page omits the sublabels shown on Finance cards. The main column scrolls to 1274 px at 900 high (design choice, listed only).
- Verification: OBSERVED by R2, V2, J1.
- Files to change:
  - apps/web/src/pages/Finance.tsx (card headers fixed height)
  - finance chart component (Quarter and Year Financing label)
  - Burn page header (put the figure in the header row)
  - Runway page cards (reuse sublabels '3-mo avg, after revenue')
- Reach: Finance visitors; polish. V2-02 downgraded to P3: scrolling the main column is normal.
- Acceptance criteria:
  - Quarter and Year views label the Financing ring.
  - The Burn summary has no empty band at 1440.
  - Breakdown and Upcoming titles share one baseline.
  - Runway cards show the basis caption.
- Needs product decision: false
- Depends on: C5 first (Finance.tsx header). Conflicts (shared files): C5 (Finance.tsx)

### C15 [P3] Inbox polish: mail error state has no Reply or Archive, hover toolbar covers the subject, button heights differ, phone sender name breaks, CSV preview
- Rank: 15. Effort: S.
- Finding ids (found by): R1-05 (R1), V2-15 (V2), V2-13 (V2), V2-06 (V2), V2-07 (V2), V2-09 (V2), J1-04 (J1)
- Root cause: Small unrelated fixes in Inbox.tsx and InboxMessageDialog.tsx: error branch omits Reply/Archive (InboxMessageDialog.tsx:455); hover actions have no fade; header buttons are 32 and 28 px; sender line puts the address inline at 375; CSV preview is fixed 360 px and cells cut at phone width; Cleanup is an icon-only checklist glyph.
- Verification: OBSERVED; J1-04 whether first-time users miss Cleanup is SUSPECTED.
- Files to change:
  - apps/web/src/components/InboxMessageDialog.tsx:455
  - apps/web/src/pages/Inbox.tsx (header buttons, hover toolbar, sender line, Cleanup glyph)
  - attachment sheet preview component
- Reach: Inbox users; polish.
- Acceptance criteria:
  - Error state shows Reply and Archive.
  - Header buttons share one height.
  - Subject is not cut by hover actions.
  - CSV cells wrap at 375 px.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C13 (Inbox.tsx)

### C16 [P3] Routines panel still shows '<bot>'s computer' over an empty area
- Rank: 16. Effort: S. Reopens: iteration-18 C13.
- Finding ids (found by): R2-19-01 (R2), R3-02 (R3), J2-12 (J2)
- Root cause: Shell.tsx:6443-6447 always renders the caption under the computer pane even when there is no computer content. Four walkers saw it.
- Verification: OBSERVED by 3 walkers; code CONFIRMED at Shell.tsx:6446.
- Files to change:
  - apps/web/src/pages/Shell.tsx:6443-6447
  - test: no caption when there is no computer state
- Reach: Every new bot; repeat of pass-18 C13. Rated P3 (cosmetic) though R3 said P2.
- Acceptance criteria:
  - The caption renders only when a computer preview or state exists.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1, C6, C7, C10 (Shell.tsx)

### C17 [P3] Cold load still calls bots/list 5 times; AppToaster calls it per notification
- Rank: 17. Effort: S. Reopens: iteration-18 C16.
- Finding ids (found by): R2-19-04 (R2), R3-01 (R3)
- Root cause: AppToaster.tsx:67 calls rpc.bots.list for each notification (avatarFor), and useIntegrations.ts:111 reads it again.
- Verification: Code CONFIRMED: AppToaster.tsx:67 `(await rpc.bots.list()).find(...)`. Count inflated by StrictMode in dev.
- Files to change:
  - apps/web/src/components/AppToaster.tsx:67 (read bots from shared sidebar data)
  - apps/web/src/hooks/useIntegrations.ts:111
- Reach: Every cold load with pending approvals; perf only. Rated P3: no visible effect.
- Acceptance criteria:
  - Cold load of /app/gtm and /app/artifacts makes at most 2 bots/list calls.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C18 [P3] Keyboard: the composer is 17 Tab stops from the chat header (each message has a More button)
- Rank: 18. Effort: S. Reopens: iteration-18 C17.
- Finding ids (found by): R2-19-05 (R2), R3-04 (R3)
- Root cause: transcript.tsx renders a tab-stop button per message; no skip link or roving tabindex.
- Verification: OBSERVED by 2 walkers.
- Files to change:
  - apps/web/src/pages/shell/transcript.tsx
- Reach: Keyboard and screen-reader users.
- Acceptance criteria:
  - On a 14-message chat the composer is at most 10 Tab stops from the header.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C19 [P3] Integrations: letter tiles (Carta C, iMessage P/M, T, D, G, W), uneven Used-by row, inline vs own-row Connect, header without a divider
- Rank: 19. Effort: S. Reopens: iteration-18 C10.
- Finding ids (found by): R1-03 (R1), R1-09 (R1), V1-08 (V1), V1-07 (V1), V1-04 (V1)
- Root cause: The logo map has no entries for several providers and falls back to the first letter; the cards differ per type; the page title does not use PAGE_HEADER_ROW.
- Verification: OBSERVED.
- Files to change:
  - apps/web/src/pages/Integrations.tsx
  - apps/web/src/components/integrations/ (logo table and card component)
- Reach: Every visitor of Integrations; polish.
- Acceptance criteria:
  - No card shows an unrelated letter tile.
  - Connect sits in the same place on every phone card.
  - Title row uses PAGE_HEADER_ROW with a bottom border.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C20 [P3] Settings and Memory polish: bare 'Nothing remembered yet', uneven section tops, tall right column, panel header style
- Rank: 20. Effort: S. Reopens: iteration-18 C19.
- Finding ids (found by): R2-19-06 (R2), R3-05 (R3), V1-02 (V1), V1-03 (V1), V1-11 (V1)
- Root cause: MemorySettingsOverlay.tsx:~192 puts the empty state outside the card; SettingsOverlay.tsx uses different top padding per section; Chat display makes the General column taller; bot panel title uses 13 px muted at y=31 vs chat header y=27.
- Verification: OBSERVED.
- Files to change:
  - apps/web/src/pages/MemorySettingsOverlay.tsx
  - apps/web/src/pages/SettingsOverlay.tsx
  - bot-panel header
- Reach: Settings users; polish.
- Acceptance criteria:
  - Memory empty state is inside the card.
  - Section tops share one offset.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C9 (bot panel header)

### C21 [P3] Artifacts: list/grid toggle disappears in split view, grid cards 150 px tall for one line, list edge off the page gutter
- Rank: 21. Effort: S. Reopens: iteration-18 C20.
- Finding ids (found by): R2-19-07 (R2), R3-06 (R3), V2-14 (V2), V3-07 (V3), V3-08 (V3)
- Root cause: Artifacts.tsx hides the toggle when an item is open; grid card padding and type word waste height; the list wrapper uses a different gutter than the header.
- Verification: OBSERVED.
- Files to change:
  - apps/web/src/pages/Artifacts.tsx:829 and list wrapper
- Reach: Artifact users; polish.
- Acceptance criteria:
  - Toggle stays visible in split view.
  - Grid cards are at most 100 px tall.
  - Rules and header share one right gutter.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C22 [P3] Agent hand-offs and chat polish: Legal draft cannot go to the Inbox agent, routine results look like replies, quote text is low contrast
- Rank: 22. Effort: S.
- Finding ids (found by): J2-07 (J2), J2-13 (J2), J2-14 (J2)
- Root cause: The Legal agent cannot message the Inbox agent, so Maya copies the draft; routine results land in the thread unlabeled; blockquote text is mid-grey.
- Verification: OBSERVED by J2.
- Files to change:
  - apps/api/src/legal-agent.ts (message_bot to Inbox, or a 'Send to Inbox agent' action)
  - apps/web/src/pages/shell/transcript.tsx (label routine results)
  - markdown blockquote style
- Reach: Legal and routine users; polish.
- Acceptance criteria:
  - A drafted notice has a one-tap hand-off to the Inbox agent.
  - Routine results carry 'From routine: <name>'.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C2 (legal-agent.ts)

## Deferred items (not in a cluster)
- J2-04 Investors agent says it has no verified ownership while the page shows SAFEs at cap (reported P1): Investors is limited to P0/P1 and a wrong refusal is not harmful; re-raise if reproduced with a real model. Likely fix: give the Investors agent the page's SAFE-at-cap read.
- V2-05 three Deadline buttons: decided.
- J1-02 tour starts only after Connect: matches the decided rule; recorded only.
- FLOW-06 three investor lists and FLOW-08 fixture text ($350,000 vs $300,000 SAFEs): Investors/Fundraising limit; fixture only.
- C4 Investors equity dash (V3 passed, R1 partly): no new defect; fresh-session path still unverified.
- V1-12 Stop/Try again 26x18 px at 1440 (touch rule applies on coarse pointers), V1-13 Settings has no URL, V1-14 landing shows bare 'Loading...' for 1 s, V3-09 grid card meta band, V3-12 Contacts phone email hidden, V3-13 Cmd+K matches inside words: P3 polish, no cluster; pick up if an implementer has spare time.
- R3-07, V3-14, J1-01 cold-load stalls of 8-12 s: shared host load; not reproduced.
- R2-19-08 no Mail card in demo chats: demo seed gap; add a seeded Mail card so C14/pass-18 C14 can be verified.
- Touch targets: only J3 had real coarse emulation (all 44 px or more); R1, R3, V1-V3 could not emulate it.

## BLOCKED stories
- STORY-APP-309/319 model and Connect your apps (demo has a model, new users are non-owners); STORY-CAP-106 Carta connect and duplicate-contact steps (Carta already connected); STORY-FIN-022 bank reconnect and pins (Mercury connected).
- STORY-INB-109 Spam, unsubscribe, History; STORY-INB-022 suspicious sender, attachment filing; sort-during-load and pre-consent bars need a fresh unsorted mailbox (pass-18 C8).
- STORY-DRM-121 cap table Documents step; chat-drafted skill approval; Mercury payment toast restore (writes off by default); multi-account mail sender picker; onboarding model step.
- Phone widths for Legal, Investors, GTM, Fundraising; keyboard-only full runs; light theme.

## Counts by severity

- Clusters: P0 0, P1 2, P2 11, P3 9 (22 clusters).
- Raw findings (before dedupe): R1 9, R2 8 (plus verdicts), R3 7, J1 4, J2 15, J3 3, FLOW 8, V1 14, V2 15, V3 14: 97 findings; 4 reported P1 (J2-01, J2-02, J2-04, V2-03), 0 P0. After checking: 2 P1 clusters.
