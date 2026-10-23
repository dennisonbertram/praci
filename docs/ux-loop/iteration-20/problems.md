P0: 0, P1: 2, P2: 13, P3: 14

# Iteration 20 problems: fix clusters

Sources: R1-R3 (verify pass-19 clusters), J1-J3 (journeys; J3 at 375 px), FLOW, V1-V3 (visual), all on the mock demo stack (web 5381). Iterations 1-19, docs/ux-flow/report.md and docs/ux-visual/problems.md were read for decisions. A cluster that reopens an earlier one names it in Reopens. Rank: P0, then severity, then reach divided by effort.

Owner decisions respected and not re-raised: nine-stop tour (J1-08 recorded only); the page is called Integrations; consent asked once; 44 px targets on coarse pointers only (no touch finding made without emulation); approval toasts persist; Legal Deadline row actions; Investors judged for P0/P1 only (C14 asks whether to lift that for one agent answer); a scan never dismisses (pass-19 decision); existing mail keeps its sort.

Severity calls: P1 only for C1 (money approval wording, second failing pass) and C2 (Data room agent tells a founder that present documents are missing). Lowered: V3-01 Activity finished list P1 to P2 (secondary surface); V2-01 Inbox first sort P1 to P2 (status line is shown, real-model time unmeasured); J2-02 Investors agent P1 to P2 (page is right; Investors limit). Environment: the shared demo stack restarted and reseeded during every walk, so cold-load stalls (R1-20-10, R2-20-07) and shared-account leftovers are not filed.

## Pass-19 cluster verification (R1-R3)
- Met: C4 Data room preview, C7 phone Bot settings, C9 bot notifications caption, C11 Data room filter bar and failed badge, C14 charts labelling (except Year label), C17 bots/list (by code), C18 tab stops (6, limit 10), C19 Integrations, C20 Settings and Memory, C21 Artifacts (toggle, 72 px cards, gutters), Legal scan stability and the unchecked-line button (C2, C3 part).
- Not met, reopened here: C1 (as C1), C2 Show done dismissed rows (C4), C3 contract row height (C18), C5 Finance phone header (C5), C6 Activity wording (C7), C10 sidebar (C6, C7), C12 untagged file reason (C8), C16 routines caption (C16), C22 Legal hand-off and routine label (C12, C24).
- Blocked or skipped: C13 Inbox first sort (needs a fresh mailbox; carried as C11), C15 Inbox polish (needs error states).

## Fix clusters, ranked

### C1 [P1] Money approval: the requesting bot still says 'waiting for your approval' after Approve, and a second identical card appears after the first Deny
- Rank: 1. Effort: S. Reopens: iteration-19 C1.
- Finding ids (found by): R1-20-01 (R1), R1-20-02 (R1), R1-20-08 (R1), J2 praise: Mercury chat itself is right
- Root cause: The Mercury chat now reports the bank result, but the requesting bot (Chief) is given the paused tool result 'Waiting for approval.' and never receives the final result, so it repeats that sentence after the user approved. After a Deny the tool result gives the model no instruction not to retry, so a second card is issued. With writes off, the tool reply does not carry the Allow changes link, so the model improvises.
- Verification: OBSERVED by R1 (c1-chief-after.png, c1-denied.png, c1-writesoff.png); J2 saw the Mercury side correct. CONFIRMED in code: packages/adapters/src/approval-effect.ts:329 returns 'Waiting for approval.' with terminate:true. The scripted demo model may add to it (SUSPECTED); the retry-after-deny and writes-off wording are not traced.
- Files to change:
  - packages/adapters/src/approval-effect.ts:325-331 (approvalPausedToolResult text) and the path that delivers the delegate's final result to the requesting bot
  - apps/api/src/integration-agent.ts:27 (instructions) and the deny tool result: 'The user denied this; do not call it again unless asked'
  - writes-off tool reply in apps/api/src/integration-agent.ts: include the Allow changes link text
  - test: tool result string after approve, after deny, and with writes off
- Reach: Anyone who pays or changes a bank record through an agent (STORY-APP-385/386); a second pass failed on the same criterion, and an ambiguous money state invites a double click.
- Acceptance criteria:
  - After Approve in the Mercury chat, the requesting bot's next message does not contain 'waiting for your approval' (it states the bank's reported state).
  - After Deny the reply says 'you denied' and no second card appears without a new owner request (decided in pass 14).
  - With writes off the reply names the Allow changes switch on the Mercury page.
  - The 'Open <agent>' bar is gone once the card is answered (already met).
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C7 (Shell.tsx delegated bar, only if touched)

### C2 [P1] Data room agent lists documents as 'likely missing' that are in the room
- Rank: 2. Effort: M.
- Finding ids (found by): J2-01 (J2)
- Root cause: Asked what a seed round still needs, the agent searched by keyword, reported 'Searches did not surface' for the cap table, pitch deck, customer contracts and people records, and listed them as gaps while the room holds Pitch Deck v1/v2, two Pilot Agreements, a Cap Table Summary and HR files. It judges absence from search misses rather than from the room's file list.
- Verification: OBSERVED by J2 (12-askans.png vs 02-dr.png). Cause SUSPECTED (prompt and search tools in apps/api/src/data-room-agent.ts); not traced to a line.
- Files to change:
  - apps/api/src/data-room-agent.ts (instructions: list the room by type and folder first, mark each checklist item present or missing from that list; never call a file missing from a search miss alone)
  - data room agent tools in the same file if there is no list-by-type tool
  - test: agent over a fixture room that holds a pitch deck reports it present
- Reach: Every founder preparing diligence (STORY-DRM-019); a wrong 'missing' list sends the founder to recreate documents.
- Acceptance criteria:
  - On the demo room the answer to the seed-round question marks Pitch Deck, Pilot Agreements, Cap Table Summary and HR files as present.
  - Only checklist items with no matching file are listed as missing, each with the folder searched.
  - A deterministic test covers one present and one missing item.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C8, C13 only if tools live in data-room.ts

### C3 [P2] Storybook smoke fails on 3 of 1800 stories
- Rank: 3. Effort: S.
- Finding ids (found by): R3-20-04 (R3)
- Root cause: Three stories break the smoke run: Preview 'UnreadableFile' requests a file URL that 404s in the static build, PreviewActions 'PdfOnPhone' embeds a fake blob: URL in an iframe, and GtmBlock 'Empty' renders null so the smoke check sees nothing. Two come from the pass-19 Data room preview work.
- Verification: OBSERVED by R3 (sb-smoke.log, run from the main checkout). Story files CONFIRMED to exist.
- Files to change:
  - apps/web/src/components/data-room/Preview.stories.tsx (UnreadableFile: stub the file request)
  - apps/web/src/components/data-room/PreviewActions.stories.tsx (PdfOnPhone: data URI or no iframe)
  - apps/web/src/components/gtm/GtmBlock.stories.tsx (Empty: wrap in withVisibleRoot from src/stories/decorators.tsx)
- Reach: CI design-system gate and every developer who runs the smoke check.
- Acceptance criteria:
  - node .storybook/smoke.mjs reports 1800/1800 clean.
  - pnpm design-system:check passes.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C4 [P2] Legal page: a manually dismissed deadline cannot be found or restored, the scan result does not say which rows changed, and a failed refresh leaves 'Scanning...' on
- Rank: 4. Effort: S. Reopens: iteration-19 C2.
- Finding ids (found by): R1-20-07 (R1), J2-04 (J2), R3-20-05 (R3)
- Root cause: Legal.tsx DoneDeadlines lists only done rows (rpc.legal.doneDeadlines), so Show done says 'No deadlines marked done' after a Dismiss and the only way back is the inline Undo that disappears. The scan summary line counts changes without naming them. When a refresh fails during a scan the button keeps the Scanning state.
- Verification: OBSERVED R1 (c2-showdone.png), J2 (34-scan.png), R3 (11-legal-reply2.png, during an outage). Legal.tsx:513-520 CONFIRMED to show the empty text from doneDeadlines. Pass-19 C2 acceptance 'Show done also lists dismissed rows with Restore' is therefore still unmet.
- Files to change:
  - packages/contracts/src/legal.ts and apps/api/src/router.ts (doneDeadlines: return done and dismissed rows with a status)
  - apps/web/src/pages/Legal.tsx:513-560 (DoneDeadlines: show dismissed rows with Restore) and :173 (scan summary names the changed rows or marks them 'Updated')
  - apps/web/src/pages/Legal.tsx scan state: clear Scanning when the refresh fails
  - test: dismissed deadline appears under Show done with Restore
- Reach: Every Legal user; a dismissed notice deadline has a real cost if it cannot be found again.
- Acceptance criteria:
  - After Dismiss, Show done lists the row with a Restore action that reopens it.
  - After a scan that changes anything, the line names the changed rows (or they carry 'Updated' until opened).
  - A failed refresh clears the Scanning state and offers Try again.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C12 (legal agent), C18 (LegalContracts.tsx, different file)

### C5 [P2] Finance on a phone: status row is cut off with ellipses and the non-USD note wraps to 3 lines; on desktop the Breakdown card stretches with Upcoming
- Rank: 5. Effort: S. Reopens: iteration-19 C5.
- Finding ids (found by): R1-20-06 (R1), J3-01 (J3), V2-02 (V2), V2-03 (V2)
- Root cause: Finance.tsx puts company name, source, sync time and the non-USD note in one flex row beside the refresh icon, so at 375 px every part truncates (about 108 px tall; limit was 72). The grid row holding Breakdown and Upcoming stretches items, so expanding Upcoming leaves a 400 px empty band under Breakdown.
- Verification: OBSERVED by R1, J3 (touch-less), V2 (m-fin.png, fin-upcoming.png). Finance.tsx:396-470 header CONFIRMED to contain nonUsdNote in the status row (:400-412). Reopens the unmet pass-19 C5 criteria.
- Files to change:
  - apps/web/src/pages/Finance.tsx:396-470 (phone: sync time on one line under the title; move the non-USD note to its own row or the sync popover; drop the leading bullet)
  - apps/web/src/pages/Finance.tsx grid of Breakdown and Upcoming (items-start)
  - test: Finance header at 375 px has one status line
- Reach: Every phone user of the core money page; desktop users who expand Upcoming.
- Acceptance criteria:
  - At 375 px the header is at most 72 px and no status text ends in an ellipsis.
  - The non-USD note never wraps beyond one line.
  - Expanding Upcoming leaves Breakdown at its natural height.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C10 and C15 (Finance.tsx; land C5 first)

### C6 [P2] Sidebar list: rows are cut in half by the fade at rest and a bare space header is sliced mid-letter
- Rank: 6. Effort: M. Reopens: iteration-19 C10.
- Finding ids (found by): R1-20-03 (R1), R2-20-05 (R2), J1-04 (J1), J2-11 (J2), V1-03 (V1), V2-04 (V2), V3-16 (V3)
- Root cause: The sidebar scroller (rk-scroll rk-scroll-fade-y with snap-proximity) has a fixed available height, but nothing ends it on a whole row or hides a group header that would be clipped, so at 1280x720 and 1440x900 a Finance helper row or the RECONNECT NEEDED header is half visible above the '+N more' bar. Seen by seven walkers in three passes.
- Verification: OBSERVED by seven walkers (c10-720.png, c8-gtm.png, botmenu-1440.png). Scroller class string CONFIRMED at apps/web/src/pages/Shell.tsx:4930-4932 (fade plus proximity snap, no row-multiple cap). Part of the multi-space cases come from demo seed spaces; the clipping applies to any user with two spaces.
- Files to change:
  - apps/web/src/pages/Shell.tsx:4930 (scroller: cap height to whole rows or move the fade above the '+N more' row; do not render a space header unless its first row fits)
  - fold empty spaces into the '+N more' line
  - test: at 1280x720 and 1440x900 no row or header is clipped at rest (geometry check)
- Reach: Every desktop user with more than a handful of chats; third pass in a row (pass-18 C6, pass-19 C10).
- Acceptance criteria:
  - At 1280x720, 1280x800 and 1440x900 with Activity closed, no chat row or space header is partly hidden at scrollTop 0.
  - A '+N more' cue is present whenever rows are hidden.
  - Empty spaces do not render a bare header.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C7, C29 (Shell.tsx)

### C7 [P2] Activity panel: 'Show N finished runs' appears to do nothing, the list opens scrolled with the header cut, Pages disappear, and approvals read 'Needs your answer'
- Rank: 7. Effort: M. Reopens: iteration-19 C6, C10.
- Finding ids (found by): V3-01 (V3), V3-13 (V3), R1-20-03 (R1, Activity part), R1-20-04 (R1)
- Root cause: ActivityList renders the finished list inside a flex-1 overflow-y-auto box (ActivityList.tsx:216) that sits in the sidebar scroller; it ends up 171 px tall with the new 'Finished' heading under the fold while 230 px below stays empty, so the click seems to remove the link and show nothing. Opening Activity keeps the previous scrollTop. Activity replaces the Pages list with no way back except Search. roster-status.ts:15 labels both asks and approvals 'Needs your answer', while the toast says 'needs approval'.
- Verification: OBSERVED by V3 (act-finished2/3.png) and R1 (c10-activity4.png, Activity label). ActivityList.tsx:216 and roster-status.ts:15 CONFIRMED. V1/V2 praise the 'Needs your answer' wording for asks, so only the approval case changes. Rated P2: Activity is secondary, not a core journey.
- Files to change:
  - apps/web/src/pages/Shell.tsx:4931-4937 (give ActivityList the remaining height; reset scrollTop to 0 on open; keep or add a way back to Pages)
  - apps/web/src/pages/ActivityList.tsx:216 (scroll the finished heading into view when expanded)
  - apps/web/src/lib/roster-status.ts:15 plus the status source: distinguish an approval from a question and label it 'Needs approval' (update roster-status.test.ts and PageAgentsRow.test.tsx)
  - test: expanding finished runs shows the 'Finished' heading in view
- Reach: Anyone who opens Activity; approval wording reaches everyone with a pending approval.
- Acceptance criteria:
  - Pressing 'Show N finished runs' shows the Finished heading and rows without scrolling.
  - Opening Activity starts at the top with no half-hidden header.
  - Pages remain reachable from the Activity view (or a visible way back).
  - An approval item reads 'Needs approval' in Activity; a question reads 'Needs your answer'.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C6, C29, C1 (Shell.tsx)

### C8 [P2] Data room processing: the strip says 'Processing' while reading waits for consent or is stuck, an untagged file gives no reason, and rows jump while a preview is open
- Rank: 8. Effort: M. Reopens: iteration-19 C12.
- Finding ids (found by): J2-06 (J2), V3-02 (V3), R2-20-01 (R2), V3-07 (V3)
- Root cause: ProcessingStrip shows 'Processing 1 file' with a progress bar regardless of whether the AI consent card above is unanswered or a job has stalled; there is no 'taking longer than usual' state. Preview.tsx:236 shows only 'Not tagged yet.' with no cause or action. New rows are inserted above the selected row, moving it 205 px while it is being read.
- Verification: OBSERVED by J2, V3, R2 (c12-preview.png). Preview.tsx:236 CONFIRMED. The stuck file may be a demo seed (SUSPECTED); the consent link is SUSPECTED, not confirmed.
- Files to change:
  - apps/web/src/components/data-room/ProcessingStrip.tsx:56-75 ('Waiting for permission to read' with Allow when consent is missing; 'Taking longer than usual' with Try again after about 60 s)
  - apps/web/src/components/data-room/Preview.tsx:234-237 (reason plus one action: Tag now, or Allow)
  - apps/web/src/components/data-room/use-data-room-list.ts and pages/DataRoom.tsx (keep the selected row anchored, or hold new rows behind a '3 new files' pill while a preview is open)
  - test: strip text when consent is off
- Reach: Everyone importing or uploading files (STORY-DRM-018/121); repeat of pass-19 C12.
- Acceptance criteria:
  - With consent off the strip does not say 'Processing'.
  - A job older than about 60 s shows 'Taking longer than usual' and Try again.
  - An untagged file states why and offers one action.
  - The selected row moves no more than 8 px when new files arrive.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C13 (components/data-room/)

### C9 [P2] Light theme: muted sidebar text and the new-chat '+' icon fall below contrast minimums
- Rank: 9. Effort: S.
- Finding ids (found by): V1-02 (V1)
- Root cause: Light-theme muted-foreground (rgb 108,108,112) on the sidebar surface (rgb 236,236,233) measures 4.42:1 at 12-13 px, the unread count 4.08:1, and the '+' icon 2.62:1 (needs 3:1). Dark theme passes.
- Verification: OBSERVED by V1 with canvas-resolved colors (the script's own contrast rows were false positives and are not used). Token values not re-read.
- Files to change:
  - packages/ui-tokens (TypeScript source of light muted-foreground / sidebar tokens; regenerate tokens.css)
  - the sidebar new-chat '+' icon uses foreground colour (apps/web/src/pages/Shell.tsx)
- Reach: Every light-theme user, on the main navigation.
- Acceptance criteria:
  - All sidebar text and counts are at least 4.5:1 in light theme; the '+' icon at least 3:1.
  - Dark theme unchanged.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C10 [P2] Mercury shows three different states: Finance 'syncing' (green), Fundraising 'just now', Integrations 'Needs reconnect' buried in the Finance group
- Rank: 10. Effort: M.
- Finding ids (found by): FLOW-01 (FLOW)
- Root cause: Each page derives the status itself. Finance.tsx:399/:490 read needs_reconnect but the header kept the green sync line; FinanceSection.tsx renders the badge only inside the Finance group, below the fold, while the Connected group at the top holds only Brex.
- Verification: OBSERVED by FLOW (p-Finance.png, p-Fund.png, integ.png). The split may be mock seed (needs_reconnect while data is still served): SUSPECTED. A real lapsed login could still show it, so the single-status rule is worth enforcing.
- Files to change:
  - apps/web/src/pages/Finance.tsx:399,490 (show 'Reconnect Mercury' in the header when a connection lapses)
  - apps/web/src/pages/Fundraising header (same single status)
  - apps/web/src/components/integrations/FinanceSection.tsx:383-410 and the Integrations list ordering (lapsed connections first)
  - test: a needs_reconnect connection never shows a green sync line
- Reach: Finance and Fundraising users whose bank login lapses (STORY-FIN-022).
- Acceptance criteria:
  - A needs_reconnect connection is shown the same way on Finance, Fundraising and Integrations.
  - On Integrations a lapsed connection sits first, above Connected.
- Needs product decision: false
- Depends on: C5 first (Finance.tsx). Conflicts (shared files): C5, C15

### C11 [P2] Inbox first sort: 35 s to a minute of grey bars with no mail readable, and Needs reply holds most of the demo mail
- Rank: 11. Effort: M. Reopens: iteration-19 C13.
- Finding ids (found by): V2-01 (V2), J1-01 (J1), J1-02 (J1), R2 C13 BLOCKED (R2)
- Root cause: Inbox.tsx:769-776 deliberately shows no rows during the first sort (comment: rows would regroup) and only shows them when 'stalled', after 6 polls of 5 s plus one restart (TRIAGE_POLL_MS, TRIAGE_MAX_POLLS at :124-125), so the demo model leaves the page empty for 35-60 s even though mail is already in the account. The Pass-10 rule said dim unsorted rows after 15 s. Needs reply holds 22-24 of about 30 mails on the demo.
- Verification: OBSERVED by V2 and J1 (J1 measured 25-35 s, V2 over 35 s). Code CONFIRMED at Inbox.tsx:769-776 and :124-125. Rated P2, not P1: a status line is shown and the real-model time is unmeasured. Needs-reply share is demo-model behaviour; existing mail keeps its sort by owner decision, so the under-40% check applies only to new mail.
- Files to change:
  - apps/web/src/pages/Inbox.tsx:769-776 (sortingRows) and :124-125 (after about 15 s show the unsorted rows dimmed under the 'Sorting your mail...' line)
  - inbox triage classifier in apps/api (Needs reply only for a direct question or deadline) if the share is a prompt issue
  - test: after 15 s of first sort the rows render dimmed
- Reach: Every new founder on the first morning (STORY-INB-022/025).
- Acceptance criteria:
  - After about 15 s of the first sort, readable dimmed rows appear.
  - Rows move no more than 8 px when sorting finishes.
  - New mail on a fresh mailbox: Needs reply is under 40% (verify with a real or scripted fresh sort).
- Needs product decision: true. After about 15 s of the first sort, may Praci show unsorted rows dimmed (the Pass-10 rule), accepting that rows regroup when sorting ends, or keep the grey bars and make the wait text more specific? Recommended: show dimmed rows.
- Depends on: none. Conflicts (shared files): C23 (Inbox.tsx)

### C12 [P2] Legal agent: notice date one day later than the policy text, a superseded lease keeps its notice deadline, and a drafted notice cannot go to the Inbox agent
- Rank: 12. Effort: M. Reopens: iteration-19 C22, C2.
- Finding ids (found by): J2-03 (J2), J2-05 (J2), R3-20-02 (R3)
- Root cause: Notice dates are derived from the term end (Dec 2) rather than the stored renewal date (Dec 1), so the policy note and the deadline disagree by a day, and the agent itself pointed it out. A new contract for the same landlord and property produces a new deadline but no removal proposal for the old one. legal-agent.ts has no message_bot tool, so the Legal agent says it cannot hand a draft to the Inbox agent.
- Verification: OBSERVED by J2 (31-deadlines.png, 82-deadlines2.png) and R3 (13-legal-handoff.png). Absence of message_bot / 'From routine' CONFIRMED by grep. The one-day gap may be demo seed data (SUSPECTED).
- Files to change:
  - apps/api/src/legal-agent.ts (notice date from one stored renewal date; scan prompt: when a new contract names the same landlord and property, propose removing the older notice deadline for the user to keep or dismiss; add message_bot to the Inbox agent or a hand-off action)
  - packages/testkit/src/cli/demo/data.ts (insurance policy dates agree)
  - test: notice date equals renewal date minus notice days; superseded deadline gets a removal proposal
- Reach: Legal users with renewals (STORY-LEG-017); a notice a day late means an auto-renewal.
- Acceptance criteria:
  - A deadline's notice date and its note show the same date.
  - Uploading a renewal for the same lease produces a removal proposal for the old notice deadline.
  - A drafted notice can be handed to the Inbox agent in one tap.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C4 (Legal.tsx, different file)

### C13 [P2] Data room: stats and search affordances do not look clickable, failed rows lack Replace in the menu, search results waste width
- Rank: 13. Effort: M.
- Finding ids (found by): V3-03 (V3), V3-04 (V3), V3-05 (V3), V3-06 (V3), V3-11 (V3), V3-14 (V3), V3-09 (V3), V3-10 (V3)
- Root cause: Stats tiles and rows are buttons with default cursor, no hover, and 'Failed 1' uncoloured. In a folder, 'No results' hides the useful next step ('Search all items') in a small label strip. With snippets the Name column is about 300 px so rows are 150 px tall. A failed row's menu offers Try again, Send to agent, Share, Move, Rename, Delete but no Replace file (the preview pane has it, R1 confirmed). The Stats view keeps filter chips but drops search, leaving a gap. Auto-sort button vs 'Sort files' dialog title.
- Verification: OBSERVED by V3 (dr-stats-1440.png, dr-search-1440.png, dr-failed-menu.png). ItemMenu.tsx:47-54 CONFIRMED to lead with Try again when canRetry. Cursor and widths from V3 DOM reads.
- Files to change:
  - apps/web/src/components/data-room/DataRoomStats.tsx:68,103-105,135-138 (pointer cursor, hover, destructive colour for Failed > 0)
  - apps/web/src/pages/DataRoom.tsx:841-852,878-905 ('Search all items' as a button in the empty state)
  - apps/web/src/components/data-room/ItemRows.tsx and ItemMenu.tsx (failed row: Replace file, hide Send to agent; Name column about 55% while searching)
  - apps/web/src/components/data-room/FilterBar.tsx (Stats keeps search or left-aligns chips)
  - apps/web/src/components/data-room/AutoSortDialog.tsx:179 (title 'Auto-sort')
- Reach: Data room users; stats and search are secondary paths, so P2.
- Acceptance criteria:
  - Stats tiles show a pointer and hover state; Failed is red when above zero.
  - A folder search with no results offers 'Search all items' as a button.
  - A failed row's menu offers Replace file and not Send to agent.
  - While searching, Name takes about 55% of the table.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C8 (components/data-room/)

### C14 [P2] Investors Ask agent says it cannot determine ownership while the Investors page shows it
- Rank: 14. Effort: M. Reopens: iteration-19 deferred J2-04.
- Finding ids (found by): J2-02 (J2)
- Root cause: The Investors agent asks Carta for a calculation and reports 'no ownership figures' instead of reading the saved cap table the page uses (Maya 40.0%, River 30.0%, SAFE 2.1%). Raised in pass-19 as J2-04 and deferred; seen again, so no longer a one-off. The mock Carta emulator may contribute (SUSPECTED).
- Verification: OBSERVED by J2 (22-capask.png), second pass in a row. Not traced in code. J2 rated P1; set to P2 because the page itself is right and Investors is judged for P0/P1 only by owner decision, so this is filed as an agent-accuracy item and should be dropped if the owner prefers.
- Files to change:
  - Investors agent / Carta agent hand-off in apps/api (read the saved cap table snapshot and SAFE-at-cap rows directly)
  - test: ownership question answered from the snapshot
- Reach: Founders asking ownership after a SAFE (STORY-CAP-017).
- Acceptance criteria:
  - The agent answers 'how much do founders own after the Quill SAFE' with the page's figures.
- Needs product decision: true. Investors is limited to P0/P1 by your earlier decision. Fix this agent answer now (recommended, small) or keep deferring it?
- Depends on: none. Conflicts (shared files): none

### C15 [P2] Finance charts: the partial month reads as burn collapsing, Year label overlaps a bar, Runway cards differ, Rent title repeats the period
- Rank: 15. Effort: S. Reopens: iteration-19 C14.
- Finding ids (found by): J1-03 (J1), R2-20-03 (R2), R2-20-04 (R2), V2-06 (V2)
- Root cause: The current partial month ('Oct*') is drawn as a dashed line dropping from about $75k to $20k; the '* So far' note is tiny. In Year view the 'Financing, 2026 $250,000' label sits on the Out bar. Only Monthly burn has a caption on the Runway page. The Rent page repeats 'Oct 1 - 22' and its chart omits the current month.
- Verification: OBSERVED by J1, R2, V2. Chart code not opened; finance chart component and Runway cards named by R2/J1 (SUSPECTED locations).
- Files to change:
  - finance chart component in apps/web/src/pages/Finance.tsx or components/finance (partial month as hatched bar or marker without the connecting line; Financing label above the plot)
  - Runway page cards (same sublabels on all four)
  - apps/web/src/pages/finance/FinanceSpend.tsx (period title once; include current month as a partial bar)
- Reach: Finance visitors; the burn chart is part of the runway journey.
- Acceptance criteria:
  - The partial month does not draw a falling line.
  - Year view label does not overlap a bar.
  - All four Runway cards carry a sublabel.
- Needs product decision: false
- Depends on: C5 first (Finance.tsx). Conflicts (shared files): C5, C10

### C16 [P3] Routines panel still shows '<bot>'s computer' over an empty area (fifth pass)
- Rank: 16. Effort: S. Reopens: iteration-19 C16.
- Finding ids (found by): R2-20-02 (R2), J2-08 (J2)
- Root cause: Shell.tsx renders the caption under the computer pane even when the bot has no computer content (about :6443 and :6502).
- Verification: OBSERVED by R2 and J2; the pass-19 acceptance ('caption only when a computer preview or state exists') is unmet. Exact line SUSPECTED (reports differ: ~6443 and 6502), re-grep before editing.
- Files to change:
  - apps/web/src/pages/Shell.tsx (computer caption near the routines panel)
  - test: no caption when there is no computer state
- Reach: Every new bot's Routines panel.
- Acceptance criteria:
  - The caption and heading render only when a computer preview or state exists.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1, C6, C7, C29 (Shell.tsx)

### C17 [P3] Bot settings and routine editor: Notifications switch looks on while it is off, Enter does not save the name, Save reappears after Test run, skill list is unordered, Workspace control wraps
- Rank: 17. Effort: S.
- Finding ids (found by): R1-20-11 (R1), V1-06 (V1), J2-07 (J2), J2-09 (J2), J2-10 (J2), V1-11 (V1)
- Root cause: bot-panel.tsx:545 draws the switch on beside 'Off in Settings'; the name input commits on blur only; the routine editor's dirty check treats Test run as an edit; the skill picker mixes custom and 11 built-in skills; the Workspace segmented control wraps to two lines and uses a second word for Space.
- Verification: OBSERVED by two or more walkers each. Code lines from reports, not re-read.
- Files to change:
  - apps/web/src/pages/shell/bot-panel.tsx:545 (disabled switch while browser notifications are off), :100 (segment labels 'Shared' / 'Only this bot', heading wording)
  - bot settings name input (commit on Enter) and routine editor dirty state / skill select (group 'Yours' and 'Built-in')
- Reach: Bot owners; polish.
- Acceptance criteria:
  - Switch is drawn disabled while 'Off in Settings'.
  - Enter saves the name.
  - Save stays 'Saved' after Test run.
  - Workspace control is one line.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C16 (Shell.tsx), C19

### C18 [P3] Legal contract rows still 57 px: Contract, Renewal and Parties wrap
- Rank: 18. Effort: S. Reopens: iteration-19 C3.
- Finding ids (found by): R1-20-05 (R1)
- Root cause: Term no longer wraps but the Contract name, 'Auto-renews, 30 days notice' and Parties cells wrap, so 8 of 10 rows are 57 px at 1440 (criterion 36-40 px).
- Verification: OBSERVED by R1 (row heights listed). Rated P3: cosmetic, the table fits one screen (V2).
- Files to change:
  - apps/web/src/pages/LegalContracts.tsx:162-169 (short Renewal text or nowrap, truncating Parties cell)
- Reach: Legal visitors.
- Acceptance criteria:
  - Contract rows are at most 44 px at 1440 wide.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C4 (Legal.tsx, different file)

### C19 [P3] Settings polish: Chat display leaves an empty right column, Memory opens on an advanced disclosure, phone sheet padding, notification description indent, 'Usage: 0 tasks', Advanced group not a real button
- Rank: 19. Effort: S.
- Finding ids (found by): V1-05 (V1), V1-13 (V1), V1-15 (V1), J3-04 (J3), FLOW-06 (FLOW), R2-20-06 (R2)
- Root cause: SettingsOverlay.tsx keeps a two-column General layout that goes uneven when Chat display opens; MemorySettingsOverlay.tsx:226 places the 'Outside memory service' disclosure above the list; the phone sheet leaves 309 px of 375; NotificationSettings.tsx:64-80 starts the description at the switch edge; the Usage card shows '0 tasks done by your bots' beside active bots; the Advanced group header was not reachable by script.
- Verification: OBSERVED (R2 a11y finding SUSPECTED: scripted click failed, a mouse click worked).
- Files to change:
  - apps/web/src/pages/SettingsOverlay.tsx (layout, phone padding 16 px, Advanced header as a button with aria-expanded, hide Usage card at zero)
  - apps/web/src/pages/MemorySettingsOverlay.tsx:226
  - apps/web/src/components/NotificationSettings.tsx:64-80
- Reach: Settings users; polish.
- Acceptance criteria:
  - Phone cards are at least 343 px wide.
  - Memory shows remembered items before the disclosure.
  - Usage card hidden at zero.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C17

### C20 [P3] Chat and page headers use different heights (55 px vs 69 px band) and only Integrations draws a divider
- Rank: 20. Effort: M.
- Finding ids (found by): V1-14 (V1)
- Root cause: Each page header sets its own band; the chat header centres the title at y=27, all ten pages at y=40, so the title moves 13 px when switching.
- Verification: OBSERVED by V1 on all ten pages.
- Files to change:
  - apps/web/src/pages/Shell.tsx chat header and each page header (one PAGE_HEADER_ROW height token; divider everywhere or nowhere)
- Reach: Everyone, subtly.
- Acceptance criteria:
  - Chat and page titles share one y position.
  - Divider is consistent.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C6, C7 (Shell.tsx)

### C21 [P3] Integrations detail polish: back link is below the phone tap size, restated switch copy, numeric date, one-item menu
- Rank: 21. Effort: S.
- Finding ids (found by): V1-01 (V1), V1-07 (V1), V1-08 (V1), V1-09 (V1)
- Root cause: The back link in AppDetail.tsx:370-374 has no rk-tap class so the coarse-pointer rule in styles.css:88-112 does not enlarge it (same class string in McpDetail.tsx, GranolaPage.tsx, StoredMeetingsList.tsx). AppDetail.tsx:110 formats the date with toLocaleDateString() with no options. IntegrationAgentSection.tsx:102,:128 explain each switch in a sentence. The card '...' menu has only 'Manage'.
- Verification: V1-01 and V1-08 CONFIRMED in code. Touch size itself not measured with coarse emulation (nobody could); the code gap is real.
- Files to change:
  - apps/web/src/components/integrations/AppDetail.tsx:372 (rk-tap), McpDetail.tsx:67, GranolaPage.tsx:33, StoredMeetingsList.tsx:52
  - AppDetail.tsx:110 (shared short-date helper)
  - IntegrationAgentSection.tsx:102,128 (one short hint per switch)
  - components/integrations/parts.tsx:98 (remove one-item menu)
- Reach: Integrations users; polish.
- Acceptance criteria:
  - Back links carry rk-tap.
  - Dates read 'Oct 22, 2026'.
  - One hint per switch.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C22 [P3] Toast poller runs while signed out, and the persistent approval toast covers phone sheets that have no composer
- Rank: 22. Effort: S.
- Finding ids (found by): V1-16 (V1), V1-10 (V1)
- Root cause: AppToaster is mounted before auth is known and calls notifications/pendingApprovals and subscribe (401 each). On a phone, the bot settings sheet and Integrations detail have no composer, so the bottom toast covers content.
- Verification: V1-16 OBSERVED in network log; AppToaster.tsx:53 CONFIRMED to call pendingApprovals. V1-10 OBSERVED.
- Files to change:
  - apps/web/src/components/AppToaster.tsx:53 (mount poller only with a session)
  - AppToaster phone placement when a full-height sheet is open (top dock or pill)
- Reach: Signed-out visitors (console noise); phone users with a pending approval.
- Acceptance criteria:
  - No 401 requests on / and /signin.
  - On a phone with a sheet open the toast does not cover its content.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C23 [P3] Inbox and mail cards: Send shows no 'Sending...' or reason when disabled, AI consent 'Not now' is not remembered, small targets, reply side effects unexplained
- Rank: 23. Effort: S.
- Finding ids (found by): V2-05 (V2), J3-03 (J3), FLOW-03 (FLOW), V2-07 (V2), J1-05 (J1), J1-06 (J1)
- Root cause: Mail approval card keeps 'Send' at half opacity with no label change or reason; Inbox's Not now is React state only (Inbox.tsx:336,1071) while Legal and Data room remember it (AiDataSharing.tsx:86-135); To do checkboxes are 16 px and hover tools 12 px; after Reply the Archive button vanishes without saying the thread moved; the Undo vanishes then 'Sending...' lingers.
- Verification: FLOW-03 CONFIRMED in code. Others OBSERVED once each (V2-05 SUSPECTED, seen on another walker's thread).
- Files to change:
  - apps/web/src/components/EmailCards.tsx / MailApprovalCard.tsx:357 ('Sending...' label, 'Choose an account to send' hint)
  - apps/web/src/pages/Inbox.tsx:336,1071 (reuse AiDataSharing dismissal), To do checkbox hit area 24 px
  - InboxMessageDialog.tsx and outbox.ts (toast says 'Sent. Moved out of Needs reply')
- Reach: Inbox users; polish.
- Acceptance criteria:
  - Disabled Send says why; in-flight Send reads 'Sending...'.
  - Not now on the Inbox card lasts as long as on Legal.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C11 (Inbox.tsx)

### C24 [P3] Chat transcript copy: routine results look like replies, ask card forgets the chosen answer, AI-off preview in the sidebar is a long error
- Rank: 24. Effort: S. Reopens: iteration-19 C22.
- Finding ids (found by): R3-20-03 (R3), J3-02 (J3), FLOW-04 (FLOW)
- Root cause: No 'From routine' label exists anywhere in apps/web, apps/api or packages/adapters (CONFIRMED by grep), the answered AskCard collapses to 'Answered', and the sidebar preview shows the whole 'Could not complete the delegated request: Chat is off...' text.
- Verification: R3-20-03 CONFIRMED by grep (not seen live). Others OBSERVED.
- Files to change:
  - apps/web/src/pages/shell/transcript.tsx ('From routine: <name>')
  - apps/web/src/components/AskCard.tsx (show the chosen answer)
  - sidebar preview mapping for the AI-off error ('Waiting for AI to be allowed')
- Reach: Routine and bot users; polish.
- Acceptance criteria:
  - Routine messages carry 'From routine: <name>'.
  - The answered card shows the answer.
  - The AI-off preview fits one short line.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1, C7 (Shell.tsx)

### C25 [P3] First-run tour: step 1 card is 650 px from its target, and the phone card height changes between stops
- Rank: 25. Effort: S.
- Finding ids (found by): J1-07 (J1), V1-04 (V1)
- Root cause: Step 1 reads 'Search finds any page, chat or email.' without the item name used by later stops; the phone card height changes (38 px shift) and the ring on the account row touches it at stop 9.
- Verification: OBSERVED. J1-08 (8 Next clicks) recorded only: the nine-stop tour is an owner decision.
- Files to change:
  - apps/web/src/components/tour/FirstRunTour.tsx (prefix 'Search:', fixed min-height on phones)
- Reach: Every new user.
- Acceptance criteria:
  - Step 1 names the Search box.
  - Drawer rows do not move between stops.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C26 [P3] GTM page: the agent panel is open by default, and an empty 'Written by GTM agent' card flashes on load
- Rank: 26. Effort: S.
- Finding ids (found by): FLOW-05 (FLOW), R1-20-09 (R1)
- Root cause: GTM opens with its panel docked while every other page opens full width, and the goal has both an Edit link and a chip in the panel. The 'Written by' section renders before data loads.
- Verification: OBSERVED (p-GTM.png, c8-gtm.png).
- Files to change:
  - apps/web/src/pages/Gtm.tsx (render the section only with data; panel default)
- Reach: GTM users.
- Acceptance criteria:
  - No empty card on first load.
  - GTM opens like other pages, or the owner keeps the panel.
- Needs product decision: true. Should GTM open with its agent panel closed like other pages (recommended), or stay open because the agent is the main way to set a goal?
- Depends on: none. Conflicts (shared files): none

### C27 [P3] Artifacts: delete dialog shows the file name with .md, grid titles truncate
- Rank: 27. Effort: S.
- Finding ids (found by): R3-20-01 (R3), V3-08 (V3)
- Root cause: The delete dialog title uses the file name, rows use a display name; the grid shares title width with the v2 badge.
- Verification: OBSERVED.
- Files to change:
  - apps/web/src/pages/Artifacts.tsx (dialog title display name; badge beside date; two-line titles)
- Reach: Artifacts users.
- Acceptance criteria:
  - Dialog and list show the same name.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C28 [P3] Cmd+K: Documents have no 'See all', mixed highlight styles, key caps are plain text, no scroll cue on phone
- Rank: 28. Effort: S.
- Finding ids (found by): V3-12 (V3)
- Root cause: Four small gaps in the palette results and footer.
- Verification: OBSERVED.
- Files to change:
  - apps/web/src/components/ (command palette)
- Reach: Cmd+K users.
- Acceptance criteria:
  - Documents has 'See all N documents'.
  - One highlight style.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C29 [P3] Sidebar spaces: clicking the empty 'Reconnect needed' space header creates a Chief chat, and the Create menu offers 'New space' to a one-space user
- Rank: 29. Effort: S.
- Finding ids (found by): FLOW-02 (FLOW), J3-05 (J3)
- Root cause: The header is a demo seed space (DEMO_FINANCE_RECONNECT_SPACE in packages/testkit/src/cli/demo/data.ts), and opening an empty space auto-creates a chat. The Pass-8 decision hides 'New space' until a second space or member exists; J3 found it in the Create menu.
- Verification: FLOW-02: header string traced to the seed, behaviour for a real empty space SUSPECTED. J3-05: SUSPECTED conflict with decision (may cover only the list).
- Files to change:
  - apps/web/src/pages/Shell.tsx (space header click: open without creating a chat until the user writes)
  - apps/web/src/components/SidebarPages.tsx (Create menu)
- Reach: Multi-space users.
- Acceptance criteria:
  - Clicking a space header never creates data.
  - 'New space' follows the Pass-8 rule.
- Needs product decision: true. Does the Pass-8 rule (hide New space until a second space or member exists) also cover the Create menu? And should opening an empty space create a chat?
- Depends on: none. Conflicts (shared files): C6, C7, C16 (Shell.tsx)

## Deferred items (not in a cluster)
- J1-08 nine-stop tour costs 8 Next clicks: owner decision, recorded only.
- R1-20-10, R2-20-07 cold load 'Still opening' for 8-20 s: stack under load or restarting; re-measure on an idle stack.
- J3-06 focus ring around the Inbox header during the tour: seen once, not reproduced.
- V1-12 Forgot password spacing, V3-15 Investors Action items ring clipped (Investors limit), V3-09/V3-10 are inside C13 as low priority.
- J1 first-run 'Connect your apps' and model steps are not shown on the demo server (BLOCKED, not defects).
- Touch-target sizes: no walker could emulate pointer: coarse; C21 is filed from code only.

## BLOCKED stories
- STORY-APP-309/319 model step and Connect your apps (demo has a default model); STORY-APP-209 and FIN-022 Mercury sign-in and reconnect chip; STORY-CAP-017/106 Carta connect (already connected).
- STORY-INB-022 sort-during-load on a fresh mailbox, INB-040 phone Monday, attachment filing to Data room; STORY-DRM-018 drag and drop and 60 MB video refusal; STORY-APP-132/133 Artifacts empty/error state and chat file card.
- C15 Inbox error states, a live routine run (From routine label), chat blockquote contrast, Legal time passing over a quarter, real-model checks of C1 and C11.

## Counts by severity
- Clusters: P0 0, P1 2, P2 13, P3 14 (29 total).
- Raw findings: R1 11, R2 7, R3 5, J1 8, J2 11, J3 6, FLOW 6, V1 16, V2 7, V3 16 = 93, grouped into 29 clusters; the rest are deferred above.
