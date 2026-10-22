P0: 0, P1: 0, P2: 11, P3: 15

# Iteration 21 problems: fix clusters

Sources: R1-R3 (verify pass-20 clusters C1-C29), J1-J3 (journeys; J3 at 375 px with real touch emulation), FLOW, V1-V3 (visual), all on the mock demo stack (web 5381). Iterations 1-20, docs/ux-flow/report.md and docs/ux-visual/problems.md were read for decisions. A cluster that reopens an earlier one names it in Reopens. Rank: P0, then severity, then reach divided by effort.

Owner decisions respected and not re-raised: nine-stop tour with a fixed card at one spot (R1-21-05 card far from Search, R3-21-07, V1-05, V2-11 dead band and covered rows are dropped); the page is called Integrations; consent asked once; 44 px targets on coarse pointers only; approval toasts persist (only their overlap is filed); Legal Deadline row actions stay (V2-07 dropped); a scan never dismisses; existing mail keeps its sort; Mercury is the only SAFE record; Investors judged for P0/P1 plus reopened clusters; Breakdown and Upcoming keep their natural heights (V2-04 dropped); Memory under Advanced; New space hidden for one-space users.

Severity calls: no P0 or P1. Lowered from the walker rating: V2-01 Legal table P1 to P2 (the same dates are on the Deadlines tab; the table scrolls sideways), J1-01 Activity P1 to P2 (secondary surface, one tap to recover), J3-02 phone settings panel P1 to P2 (needs the panel open first; X clears it), J1-03 first-question answer P1 to P2 (seen once, demo model, cause not traced). Environment: the demo was shared by ten walkers, so cold-load durations (V1-01, V2-10, J2-06, FLOW-07) are filed only for the missing skeleton, retry and misleading copy, not for speed. Mock-model behaviour (R3-21-06, J1-06, J2-05 duration, J2-08 time) is not filed as an app defect.

## Pass-20 cluster verification (R1-R3)
- Met: C1 money approval (J2 walked the full payment: plain dialog, 'Send $1,200.00', 'Approved here. Waiting for Mercury', no success claim), C2 Data room agent (present documents listed as present; the 'folder searched' note is missing, minor), C3 Storybook (1802/1802 clean), C4 Legal Restore (Show closed lists Dismissed rows, Restore works), C9 light contrast, C12 notice dates agree (data), C14 Investors agent, C17 bot settings, C18 contract row height 40 px, C19 Settings, C20 title alignment, C22 signed-out poller, C26 GTM, C29 Create menu and no chat created.
- Not met, reopened here: C6 sidebar empty space header (now C11), C7 Activity opening at the top (now C3), C13 failed-file Replace (now C4), C15 Financing label (now C2), C16 Routines caption (now C18), C20 chat header border (now C19), C21 one-item menu (now C13), C23 'Sent. Moved out of Needs reply' (now C20), C27 grid card height (now C12), C28 Cmd+K key caps and Artifacts See all (now C14), C5 syncing status (now C7), C8 untagged reason (now C9), C18 table width (now C1).
- Blocked or skipped: C10 Mercury state (no lapsed connection), C11 Inbox first sort (no fresh mailbox), C24 'From routine' (no routine message), C25 phone tour stability, touch sizes for C21 and C23 (J3 measured 44 px on the phone pages it covered; the R walkers could not emulate pointer: coarse).

## Fix clusters, ranked

### C1 [P2] Legal Contracts table is wider than its container, so Next deadline is cut off at 1440 and 1280
- Rank: 1. Effort: S. Reopens: iteration-18 C2, iteration-20 C18.
- Finding ids (found by): R1-21-07, R2-21-05, FLOW-06, J1-07, J2-02, V2-01 (R1, R2, FLOW, J1, J2, V2 (six walkers))
- Root cause: LegalContracts.tsx switches from the card list to the table at container width @4xl (896 px), but the table needs about 1120-1150 px (cells capped at max-w-72 and max-w-56, nowrap Value and Next deadline). Between 896 and about 1150 px the table overflows sideways with no cue and the last column is clipped ('Nov 1, 202'). Pass-20 C18 fixed row height by truncating cells, which kept the width.
- Verification: OBSERVED by six walkers, measured scrollWidth 1120-1150 vs clientWidth 1068-1124. CONFIRMED in code: list is '@4xl:hidden' and table is 'hidden @4xl:table' (LegalContracts.tsx:125,158) and cell caps at :190-200. The needed table width is from walker measurements (not recomputed).
- Files to change:
  - apps/web/src/pages/legal/LegalContracts.tsx (move the table breakpoint to the width the table needs, about @6xl, or let Contract and Parties shrink with truncate and a title so the table fits 1068 px)
  - apps/web/src/pages/legal/LegalContracts.test.tsx or a Storybook story at 1068 and 1124 px container widths
- Reach: Every Legal user on a laptop; the Next deadline is the column the page exists for. Third pass on the same table.
- Acceptance criteria:
  - At 1440x900 with the sidebar open and at 1280x800, the table's scrollWidth is at most its clientWidth (no sideways scroll) and 'Next deadline' dates are fully readable.
  - Rows stay 40 px high (pass-20 C18) and no contract name is truncated without a title attribute.
  - At 1920 the table is unchanged; below the breakpoint the card list shows.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C8 (Legal, different file)

### C2 [P2] Burn chart: the 'Financing' label is cut in half at the top of the plot (Month, Year, phone)
- Rank: 2. Effort: S. Reopens: iteration-19 C15, iteration-20 C15.
- Finding ids (found by): J1-02, J3-01, R1-21-08, R2-21-03, V2-02 (J1, J3, R1, R2, V2 (five walkers))
- Root cause: In charts.tsx the label rows are tracked in 'rowEnd', declared in the component body (line 416) but mutated inside the Chart render callback (line 739). If the callback runs more than once for one component render (dev double render, or Chart calling children again after measuring width), the second pass sees the first pass's end position and puts the one label on row 1 (y = top - 12 - 14 = 2 with top 28), above the SVG edge. J1 measured the label at y=2 with only one label.
- Verification: OBSERVED by five walkers on desktop and phone. CONFIRMED in code: rowEnd is outside the callback (charts.tsx:416) and written at :739; label y at :746. That the callback runs twice is SUSPECTED (it fits J1's y=2 exactly); the fix does not depend on it.
- Files to change:
  - apps/web/src/components/finance/charts.tsx:416 (create rowEnd inside the (width) => callback, or compute label rows in a pure pass before rendering)
  - apps/web/src/components/finance/charts.tsx:417 (top: reserve room for a second row only when two labels collide)
  - test: render the chart twice with one off-scale financing point and assert the label y >= 8
- Reach: Anyone with a financing event in the Burn chart (every funded founder); visible on the first Finance screen.
- Acceptance criteria:
  - With one off-scale Financing point the label's text top is at least 2 px inside the SVG in Month, Quarter and Year views, desktop and 375 px.
  - Two colliding labels still stack on two rows, both fully visible.
  - The label position is the same after a hover re-render.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C7 and C24 (Finance pages, different files)

### C3 [P2] Sidebar scroller: opening Activity or expanding Page agents leaves what you opened out of view
- Rank: 3. Effort: M. Reopens: iteration-20 C7, iteration-20 C6.
- Finding ids (found by): J1-01, R1-21-03, FLOW-01, V3-07 (J1, R1, FLOW, V3)
- Root cause: The sidebar list (Shell.tsx:4949) uses lg:snap-y snap-proximity with snap targets only on roster rows. Shell.tsx:1012-1016 already scrolls to top when Activity opens, but the Activity data arrives afterwards and inserts content above the rows, so the list shifts (scroll anchoring or re-snap) to about scrollTop 217 and the Activity heading and first run sit above the fold. Expanding 'Page agents' adds rows below the fold and nothing scrolls them in (the '+N more' button only scrolls 80% of the list height, Shell.tsx:5761-5766). Activity also hides the Pages list with no labelled way back (V3-07, pass-20 criterion).
- Verification: OBSERVED by four walkers (J1 reloaded and script-clicked to rule out its own scroll). Pass-20 reset code CONFIRMED at Shell.tsx:1012-1016, so the remaining cause is SUSPECTED to be scroll anchoring or snap after the data loads; confirm in the browser by setting overflow-anchor:none.
- Files to change:
  - apps/web/src/pages/Shell.tsx:4949 (scroller: overflow-anchor-none; mark the Activity block as a snap target; scroll to top again when its data first renders)
  - apps/web/src/pages/Shell.tsx:5761 and apps/web/src/components/PageAgentsRow.tsx (on expand, scrollIntoView({block:'nearest'}) the group header so its rows show)
  - apps/web/src/pages/Shell.tsx Activity mode (a labelled 'Back to chats' row, or keep the Pages block reachable)
  - test: geometry check that the Activity heading is inside the list viewport 1 s after opening
- Reach: Everyone who taps the bell (Monday journey STORY-APP-024/145) or opens Page agents; fourth pass for Activity.
- Acceptance criteria:
  - After tapping Activity (also after a reload), the 'Needs you' or 'Working' block heading is fully visible with the list at scrollTop 0, measured 1 s later.
  - Expanding 'Page agents' shows at least its first row inside the list without clicking '+N more'.
  - Activity has a visible labelled way back to the Pages and chats list.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C11 (Shell.tsx sidebar), C5 (Shell.tsx panel code), C14 (Shell.tsx palette)

### C4 [P2] Data room: a failed (unreadable) file's menu has no Replace file, and the Stats and phone toolbars leave gaps
- Rank: 4. Effort: S. Reopens: iteration-20 C13.
- Finding ids (found by): R1-21-01, R2-21-02, R2-21-07, V3-10, V3-09, V3-08 (R1, R2 (menu); R2, V3 (layout))
- Root cause: ItemMenu.tsx shows Replace file only inside the canRetry branch (lines 55-65). For an unreadable file, canRetryItem is false (format.ts:104-110), so the menu falls to Send to agent and never offers the one action that helps. Layout: the Stats view keeps filter chips mid-row where the search box was; the phone Stats toolbar puts Filters alone on a row; the folder tree does not scroll the selected folder fully into view; at 1920 the Name column takes most of the row.
- Verification: CONFIRMED in code (ItemMenu.tsx:55-72; format.ts:104-110) and OBSERVED by R1 and R2 on 'MOCK Signed NDA - Bolt Freight.pdf'. Layout items are single observations by R2 and V3 (V3 and R2 disagree on whether the Stats gap is a problem, so it is low priority).
- Files to change:
  - apps/web/src/components/data-room/ItemMenu.tsx:47-72 (show Replace file for every failed file; show Try again only when canRetry; omit Send to agent for a file with no readable text)
  - apps/web/src/components/data-room/FilterBar.tsx (left-align chips in Stats)
  - apps/web/src/components/data-room/ (folder tree: scrollIntoView block nearest on selection)
  - apps/web/src/pages/DataRoom.tsx phone toolbar (Filters beside the folder picker); optionally cap the Name column above 1600 px
  - test: ItemMenu for an unreadable file lists Replace file and not Send to agent
- Reach: Anyone who uploads a scanned or broken PDF (STORY-DRM-018); the preview pane has Replace but the row menu does not.
- Acceptance criteria:
  - The row menu of an unreadable file contains Replace file and does not contain Send to agent or Try again.
  - A retryable failed file still shows Try again first.
  - In Stats the chips are left-aligned; on 375 px Filters shares a row with the folder picker.
  - Selecting a nested folder leaves its row fully visible above the New folder footer.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C9 (components/data-room/)

### C5 [P2] Phone: switching chats (including from an approval toast) keeps the bot settings panel full screen over the chat
- Rank: 5. Effort: S.
- Finding ids (found by): J3-02, J3-03 (J3)
- Root cause: Shell.tsx:3899-3905 deliberately carries the 'settings', 'computer' and 'group-settings' panel to the next chat. The comment at :3908 says that below the docked breakpoint the panel would overlay the chat, but that rule is applied only to the saved-panel restore, not to the carry. On a phone the carried panel covers the whole screen, so tapping the 'Inbox agent needs approval' toast lands on a chat whose approval card is hidden.
- Verification: OBSERVED by J3 with touch emulation (o2.png, p2-approval.png). CONFIRMED in code: the carry branch at Shell.tsx:3899-3905 has no wideScreen() check while the restore branch at :3908-3909 has one. Rated P2, not the walker's P1: it needs the settings panel open first and one tap on X clears it.
- Files to change:
  - apps/web/src/pages/Shell.tsx:3899-3905 (when !wideScreen(), do not carry settings/computer/group-settings to another chat; close the panel)
  - apps/web/src/lib/approval-toasts.ts or the toast click handler (open the destination chat with no panel)
  - test: on a narrow viewport, switching chats from settings closes the panel
- Reach: Phone users who open a bot's settings and then follow a toast or the drawer to another chat, which can hide a pending money or mail approval.
- Acceptance criteria:
  - At 375 px, tapping an approval toast while a settings panel is open shows the approval card, not the panel.
  - At 1440 the settings panel still carries between chats.
  - New bot on a phone still opens its Settings first (pass-decided naming step).
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C3 and C11 (Shell.tsx, different ranges)

### C6 [P2] Integrations: the same app logo sits on a dark tile or a white tile depending on its connection state
- Rank: 6. Effort: S.
- Finding ids (found by): V1-02, V1-03 (V1)
- Root cause: AppLogo.tsx chooses the tile by logo URL, not by app: marks served from Simple Icons (mono) get 'bg-muted' with 'dark:invert', other marks get 'bg-white'. Gmail changes tile between not connected (white) and connected (dark, white mark). V1-03 (an empty dark tile for about 4 s once) is suspected to come from decoding="async" on the dark tile.
- Verification: OBSERVED by V1 in two states. CONFIRMED in code: AppLogo.tsx:73 (mono), :81 (tile class), :89 (dark:invert). V1-03 seen once, not reproduced.
- Files to change:
  - apps/web/src/components/integrations/AppLogo.tsx:73-89 (one tile treatment for every bundled mark, regardless of state)
  - apps/web/src/components/integrations/AppLogo.stories.tsx (connected and not connected story for a mono and a colour mark)
- Reach: Every visit to Integrations; the page is the entry for connecting Gmail, Mercury and others.
- Acceptance criteria:
  - Gmail has the same tile background and mark colours in the Popular and Connected sections.
  - No tile changes style when its connection state changes (story for both states).
  - A tile never shows an empty box before its mark has decoded (placeholder or no async decode for bundled marks).
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C13 (components/integrations/)

### C7 [P2] Finance header: no 'Connecting' state after Add account, and the status line truncates when the agent panel is open or while syncing on a phone
- Rank: 7. Effort: M. Reopens: iteration-20 C5.
- Finding ids (found by): J1-04, J1-08, V2-05, J1-11, J1-12 (J1, V2)
- Root cause: Finance.tsx puts company name, sync source, sync time and the non-USD note in one row. With the agent panel docked, or on a phone while 'syncing...' shows, each part truncates ('Mercury, Brex - synced jus...', '1 non-USD transaction not co...') and the summary line leaves '22' alone on a line. After choosing Mercury in Add account the dialog closes and the page shows 'No accounts yet' for several seconds with no pending state, so the person may add it again.
- Verification: OBSERVED: J1 (screens 21-mercury, 38-finance-ask), V2 (m-finance.png). R1 found the phone header fine once synced, so the failure is limited to the syncing state and the narrow desktop. Code not traced beyond Finance.tsx header (pass-20 C5 location).
- Files to change:
  - apps/web/src/pages/Finance.tsx header (wrap the status row to two lines or collapse source, time and non-USD note to one chip when narrow; keep date ranges together with a non-breaking space)
  - apps/web/src/pages/Finance.tsx and the Add account dialog (keep a 'Connecting Mercury...' state until the account list returns)
  - Add account dialog: drop the duplicate X or Cancel (J1-12, optional)
  - test: header at 375 px while syncing; Finance with the agent panel docked
- Reach: Every Finance user: first connection (STORY-APP-209) and anyone with the agent panel open.
- Acceptance criteria:
  - After picking a bank, the page shows a pending state ('Connecting...') and never 'No accounts yet' while the connection is being created.
  - With the agent panel open at 1440, no status text ends in an ellipsis; the non-USD note is readable or behind a tooltip chip.
  - At 375 px while syncing, the header is at most 72 px and the period summary does not strand a single number.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C2 and C24 (Finance, different files)

### C8 [P2] Legal Deadlines: a flagged older row does not name the row that replaced it, and the scan shows a stale 'Last scan' while running
- Rank: 8. Effort: S. Reopens: iteration-20 C12.
- Finding ids (found by): J2-03, J2-05, J2-07 (J2)
- Root cause: After a scan, the four seeded 'Send non-renewal notice' rows and the scanner's 'Renewal notice deadline' rows show the same date side by side. The older rows say the last scan thinks this no longer applies, with Keep, but not which row replaced them, so the founder has to compare dates to know which one to Dismiss. The header keeps 'Last scan 3h ago' during a 6-7 minute scan, and the persistent approval toast covers the lowest rows' Done button.
- Verification: OBSERVED by J2 (41-deadlines, 43-check3). Row text in LegalDeadlines.tsx and the legal-tools naming are SUSPECTED, not opened. Mock model timing: the scan duration is from the demo model, so only the stale text is filed. Pass-19/20 decision respected: a scan only proposes.
- Files to change:
  - apps/web/src/pages/legal/LegalDeadlines.tsx (flag line: 'Replaced by: <title> (same date)' with Dismiss as the primary action and Keep secondary)
  - apps/web/src/pages/Legal.tsx (hide 'Last scan <time>' while a scan runs; show elapsed time)
  - test: flagged row names its replacement
- Reach: Anyone who runs Check now on a library with existing notice deadlines (STORY-LEG-001/007).
- Acceptance criteria:
  - A deadline flagged as superseded names the replacing deadline and its date.
  - During a scan the header shows elapsed time, not the previous scan's age.
  - Done and Dismiss are never added automatically.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1 (Legal, different file), C21 (toast bottom padding)

### C9 [P2] Data room processing: the strip can stay on 'Reading text' for ten minutes, the consent card shows twice in a preview, and an untagged file gives no reason
- Rank: 9. Effort: M. Reopens: iteration-20 C8.
- Finding ids (found by): J2-01, V3-01, R1-21-04, J2-11 (J2, V3, R1)
- Root cause: The processing strip (DataRoom.tsx, ProcessingStrip.tsx) stayed on 'Reading text 1' after the server's stale sweep (packages/db/src/data-room.ts:335-348) had marked the file 'Reading took too long.'; a reload showed the failed row, so the client does not re-read the list when the count changes or stops polling. AiDataSharing.tsx renders the same 'Let Praci read your documents' card in the page banner and in the preview panel. The untagged-file note is hidden until classification finished (deliberate in commit 4b8f68de3), so a file that stays untagged shows nothing. The upload auto-file rule and the Auto-sort proposal disagree on the folder for a SAFE (Legal/Contracts vs Fundraising/SAFEs).
- Verification: OBSERVED: J2 (strip stuck, reload fixed), V3 (preview), R1 (untagged preview). Stale sweep line CONFIRMED at data-room.ts:347. Client polling cause SUSPECTED, not traced. R1-21-04 may be the intended behaviour; filed as 'show a reason once classification is done'.
- Files to change:
  - apps/web/src/pages/DataRoom.tsx and apps/web/src/components/data-room/ProcessingStrip.tsx (poll dataRoom.processing until 0, refresh the list when a file turns failed)
  - apps/web/src/components/AiDataSharing.tsx and apps/web/src/components/data-room/Preview.tsx (do not render the consent card in the preview while the page banner shows it)
  - apps/web/src/components/data-room/Preview.tsx:234-237 (untagged and classified: reason plus one action)
  - upload auto-filing in packages/db or apps/api data room (use the Auto-sort folder rule), optional
  - test: strip clears when the server marks the file failed
- Reach: Anyone importing documents for diligence (STORY-DRM-018/121).
- Acceptance criteria:
  - After the server marks a stuck file failed, the strip disappears or shows the failed state within 15 s without a reload.
  - Before consent, one 'Let Praci read your documents' card is visible on screen with a preview open.
  - A file that stays untagged after classification states why and offers one action.
  - A SAFE uploaded and then Auto-sorted does not move twice (same folder).
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C4 (components/data-room/)

### C10 [P2] First run: the first question gets 'I don't see any open tracked tasks' before the first mail sort finishes, and the second message says 'Maya's Gmail'
- Rank: 10. Effort: M.
- Finding ids (found by): J1-03 (J1)
- Root cause: Maya's first question (from the tour's last stop) was answered while her mail was still unsorted, so Chief saw no tasks and said it cannot recommend a first action. A minute later the Inbox showed a To do list with items. A second message referred to the user in the third person. Cause is not traced: either the demo's scripted model, or Chief is not told the first sort is running.
- Verification: OBSERVED once by J1 (10-reply2.png, 12-inbox-sorted.png). SUSPECTED: Chief's prompt or tools in apps/api/src/onboarding.ts and the Inbox hand-off; the model is the demo's, so a real-model check is needed first. Rated P2 (not the walker's P1) until a real model reproduces it.
- Files to change:
  - apps/api/src/onboarding.ts and the Chief instructions (when mail sorting is in progress, say so and point to the Inbox; use second person)
  - test: Chief reply while sorting is pending names the sort
- Reach: Every new founder who asks the tour's first question right after connecting Gmail.
- Acceptance criteria:
  - With a first sort running, the first answer says mail is still being sorted and where the result will appear (no 'I can't recommend').
  - The reply uses 'you', not the founder's name.
  - Checked with a real model or the scripted demo model both before and after.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C11 [P2] Sidebar: an empty space still draws a bare header, and clicking it replaces the current space with 'Select a bot'
- Rank: 11. Effort: M. Reopens: iteration-20 C6, iteration-20 C29.
- Finding ids (found by): R1-21-02, R1-21-10, V1-04 (R1, V1)
- Root cause: Pass-20 C6 asked that empty spaces not render a bare header; the sidebar still draws 'RECONNECT NEEDED' (and several such headers on the shared demo) with no rows. Clicking it makes that space active: Inbox then reads 'No mail connected', the main pane says 'Select a bot' with one New bot button, and the other space's chats sit below with the same header style, so they look nested.
- Verification: OBSERVED by R1 and V1. FLOW confirmed the space is seeded demo data (packages/testkit/src/cli/demo/data.ts:35), but any user with an empty second space would see the same. Shell.tsx space-group render not re-read.
- Files to change:
  - apps/web/src/pages/Shell.tsx (space groups: do not render a header for a non-active space with no rows; fold into the '+N more' line or the space switcher)
  - apps/web/src/pages/Shell.tsx empty main pane (title 'No bots yet')
  - more space between space groups than inside a group
  - test: a space with no chats renders no header unless it is active
- Reach: Anyone with a second space (invited member or New space).
- Acceptance criteria:
  - A space with no bots shows no header in the sidebar unless it is the active space.
  - The empty pane is titled 'No bots yet', not 'Select a bot'.
  - Space groups are visibly separated from rows inside a group.
- Needs product decision: true. Should an empty space appear in the sidebar at all, or only in the space switcher (recommended), so the founder cannot land in an empty space by clicking a header?
- Depends on: none. Conflicts (shared files): C3 (Shell.tsx sidebar), C5 (Shell.tsx)

### C12 [P3] Artifacts grid: the card for a versioned artifact is 92 px tall while the others are 72 px
- Rank: 12. Effort: S. Reopens: iteration-20 C27.
- Finding ids (found by): R3-21-03, J1-09, V2-06, V3-04 (R3, J1, V2, V3 (four walkers))
- Root cause: Artifacts.tsx puts the 'v2' badge on its own footer row (about :850-858) in the grid, adding a line; the list view already puts it on the title row (:616).
- Verification: CONFIRMED in code (Artifacts.tsx:616 vs :855) and measured 72 vs 92 px by three walkers.
- Files to change:
  - apps/web/src/pages/Artifacts.tsx:850-858 (badge beside the date or title, or reserve the row for all cards)
  - apps/web/src/pages/Artifacts.stories.tsx
- Reach: Everyone with a versioned artifact; one-line fix.
- Acceptance criteria:
  - All grid cards measure the same height at 1440 and 375 px, with and without a version badge.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C13 [P3] Integrations cards show a '...' menu whose only item is 'Manage'
- Rank: 13. Effort: S. Reopens: iteration-20 C21.
- Finding ids (found by): R3-21-01 (R3)
- Root cause: The card menu component in components/integrations/parts.tsx always renders the trigger and appends 'Manage' (lines about 80-105) even when it has no other items. The whole card already opens the detail page.
- Verification: OBSERVED by R3 on Mercury, Brex, Blockscout and Coinbase; menu code CONFIRMED to append Manage unconditionally.
- Files to change:
  - apps/web/src/components/integrations/parts.tsx (render the menu only when children exist)
  - stories for a card with and without extra actions
- Reach: Every visit to Integrations.
- Acceptance criteria:
  - No card shows a '...' button whose only item is Manage; cards with extra actions keep the menu.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C6 (components/integrations/)

### C14 [P3] Cmd+K: key hints are plain text, Artifacts has no 'See all', highlighting differs per row, and page agents repeat the pages
- Rank: 14. Effort: M. Reopens: iteration-20 C28, iteration-15 C21.
- Finding ids (found by): R1-21-06, R3-21-04, R3-21-05, FLOW-04 (R1, R3, FLOW)
- Root cause: The palette footer prints 'Move / Open / Close' as plain words (asked for key caps in pass-15 and pass-20); the Documents group got 'See all in Data room' but Artifacts shows 5 of 10 with none; match highlighting applies to contact descriptions but not bot descriptions; a chat snippet shows 'MOCK Q3 Board Deck.md' (suspected seed text). With an empty query the palette lists six page agents with Cmd+1..9 beside the pages they belong to.
- Verification: OBSERVED by three walkers. Palette code is in apps/web/src/pages/shell/command-palette.tsx (not re-read). The .md snippet is SUSPECTED seed text.
- Files to change:
  - apps/web/src/pages/shell/command-palette.tsx (kbd caps in the footer; 'See all' row for Artifacts; one highlight helper for every row; hide page agents from the empty-query list but keep them searchable)
  - apps/web/src/pages/Shell.tsx palette entries (~:580-605)
  - command-palette stories and tests
- Reach: Every Cmd+K user; low severity.
- Acceptance criteria:
  - Footer hints render Enter, Esc and arrows as key caps in light and dark.
  - Artifacts shows 'See all' when more results exist.
  - Matched text is highlighted the same way in every row type.
- Needs product decision: true. Should page agents be hidden from the empty-query palette (reached from their page's Ask button) and only appear when searched? Recommended: yes; pass-16 decided GTM appears once, nothing yet on the others.
- Depends on: none. Conflicts (shared files): C3 (Shell.tsx)

### C15 [P3] Plain wording: 'Waiting for the computer', 'New group' next to 'New space', and a repeated 'Model' card title
- Rank: 15. Effort: S.
- Finding ids (found by): V2-12, FLOW-05, V1-10 (V2, FLOW, V1)
- Root cause: run-phase.ts:9 labels the first run phase 'Waiting for the computer' and the sidebar status shows it; 'computer' is internal. 'New group' and 'New space' in the Create menu do not say which is a chat with several bots and which is a workspace. The Settings Models page has one card titled 'Model' under the page title 'Models'.
- Verification: CONFIRMED text at run-phase.ts:9 (and runPhaseWaitingOn 'the computer' at :26). Menu and Settings copy OBSERVED by FLOW and V1.
- Files to change:
  - apps/web/src/lib/run-phase.ts:9,26 (use 'Starting up' and update run-phase tests)
  - Create menu label in apps/web/src/pages/Shell.tsx ('New group chat')
  - Settings Models section (drop or rename the 'Model' card title)
  - locale catalogs via the repo's extract step
- Reach: Every user sees the run status; the other two are occasional.
- Acceptance criteria:
  - No sidebar status or tooltip says 'the computer' for a starting run.
  - Create menu reads New bot, New group chat, New space.
  - Models page has no card title that repeats the page title.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C3, C11 (Shell.tsx, small ranges)

### C16 [P3] Settings has no URL: /app/settings shows 'Page not found'
- Rank: 16. Effort: S.
- Finding ids (found by): FLOW-02 (FLOW)
- Root cause: Settings is a dialog without a route, but Cmd+K lists it as a page (pass-16 decision) and the account menu opens it. A reload on the dialog, a shared link or a typed URL hits the not-found page in App.tsx.
- Verification: OBSERVED by FLOW (set.png). The not-found handling is in apps/web/src/App.tsx (not re-read); no route for settings was found by grep of App.tsx.
- Files to change:
  - apps/web/src/App.tsx (route /app/settings that opens the Settings dialog over the last page)
  - App.test.tsx
- Reach: Anyone who reloads, bookmarks or shares the settings address.
- Acceptance criteria:
  - Opening /app/settings loads the app and shows the Settings dialog; closing it returns to the Chief chat.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C17 [P3] Cold loads: 'Opening Praci...' text instead of a skeleton, no timeout or retry on a hung load, and 'First sync can take a minute' while a list is simply loading
- Rank: 17. Effort: M.
- Finding ids (found by): V1-01, V2-10, J2-06, FLOW-07 (V1, V2, J2, FLOW)
- Root cause: Boot shows plain text before the shell appears. Inbox.tsx:1706 shows 'First sync can take a minute' when slowSync and no syncedAt, which is also true while the list query has not answered. One load stayed in skeleton for more than 45 s with no error or retry (cause unknown). Durations were measured on a shared dev stack under load and are NOT filed as defects.
- Verification: Copy condition CONFIRMED at Inbox.tsx:1706. Durations are environment-dependent (iteration-20 rule). The hung load (J2-06) was seen once, suspected a missing request timeout.
- Files to change:
  - apps/web boot gate (shell skeleton instead of the text)
  - apps/web/src/pages/Inbox.tsx:1706 (show 'First sync...' only when the account has never synced, not while data is undefined)
  - skeleton views: a visible Try again after about 20 s (J2-06)
- Reach: Everyone on a slow connection; no confirmed failure.
- Acceptance criteria:
  - A cold load shows shell skeleton rows, not bare text.
  - A signed-in person with mail never sees 'First sync can take a minute' during a normal list load.
  - A skeleton that lasts more than about 20 s shows a Try again control.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C20 (Inbox.tsx)

### C18 [P3] Routines panel shows '<bot>'s computer' over an empty area (sixth pass)
- Rank: 18. Effort: S. Reopens: iteration-20 C16.
- Finding ids (found by): R2-21-01, J2-10 (R2, J2)
- Root cause: The caption at Shell.tsx:6520-6528 is gated by showsComputerCaption (kind not desktop, state running, hasScreen, no error). On the mock demo the computer reports running with a screen URL that renders nothing, so the caption shows over blank space. The gate checks that a URL exists, not that the screen drew.
- Verification: OBSERVED by R2 and J2. Gate CONFIRMED at Shell.tsx:7616-7633. Whether a real computer draws a blank is SUSPECTED not to happen; if only the demo does, close this as a demo artifact after checking.
- Files to change:
  - apps/web/src/pages/Shell.tsx:6518-6528 and 7616-7633 (show the caption only after the preview frame has loaded)
  - stories for showsComputerCaption
- Reach: Every new bot's Routines panel on the demo; unknown on production.
- Acceptance criteria:
  - The caption is absent until the screen preview has loaded an image or frame.
  - With a failed preview, no caption shows.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C5, C3 (Shell.tsx)

### C19 [P3] Chat header draws a bottom border but page headers do not
- Rank: 19. Effort: S. Reopens: iteration-20 C20.
- Finding ids (found by): R2-21-06 (R2)
- Root cause: Pass-20 aligned title heights (y=28) and removed Integrations' divider, but the chat header (56 px band) still has a bottom border while Inbox, Finance and Legal have none, and Artifacts has a line only under its toolbar.
- Verification: OBSERVED by R2; R1 and R3 confirmed title alignment only. Header code in Shell.tsx not re-read.
- Files to change:
  - apps/web/src/pages/Shell.tsx chat header
  - page header wrapper used by pages
- Reach: Every page; cosmetic.
- Acceptance criteria:
  - Chat and page headers follow one border rule at 1440 and 375 px.
- Needs product decision: true. Border on every header or on none? Recommended: none, as on the pages.
- Depends on: none. Conflicts (shared files): C3 (Shell.tsx)

### C20 [P3] Inbox: no message when a sent reply leaves Needs reply, the To do card repeats the Needs reply rows, and 'Show N more' is not styled as a control
- Rank: 20. Effort: S. Reopens: iteration-20 C23.
- Finding ids (found by): R3-21-02, FLOW-03, V2-14, J1-06 (R3, FLOW, V2, J1)
- Root cause: After Send, the 'Sending...' pill stays and the row then jumps to 'Other mail today' with no text (pass-20 C23 asked for 'Sent. Moved out of Needs reply'; grep finds no such string). The To do card above the list and the 'To do - Today' chip on the first row state the same task within 250 px. 'Show 15 more' and '2 more' are plain grey text starting 10 px left of the row edge. Needs reply holds 22 of 27 mails on the demo model (suspected model behaviour).
- Verification: OBSERVED by R3, FLOW, V2, J1. Missing string CONFIRMED by R3 grep. Needs reply share is demo-model behaviour and is not a defect here.
- Files to change:
  - apps/web/src/components/InboxMessageDialog.tsx and apps/web/src/lib/outbox.ts (confirmation text on completion)
  - apps/web/src/pages/Inbox.tsx (leave a task out of the To do card when its row shows the chip, or collapse the card to one line; ghost button style and aligned left edge for the 'N more' controls)
- Reach: Every daily inbox user.
- Acceptance criteria:
  - After a reply from Needs reply sends, a visible 'Sent. Moved out of Needs reply' line appears.
  - The same task is not written twice within the first screen.
  - 'Show N more' is a button with a focus ring aligned with the row edge.
- Needs product decision: true. Should the To do card drop tasks that already carry a chip on a Needs reply row, or collapse to one line (recommended: collapse)? The ux-flow report had called this a product call.
- Depends on: none. Conflicts (shared files): C17 (Inbox.tsx)

### C21 [P3] The persistent approval toast covers the controls under it and does not look clickable
- Rank: 21. Effort: S.
- Finding ids (found by): J2-07, V1-08, V2-13 (J2, V1, V2)
- Root cause: Approval toasts persist (owner decision, kept). The toast stack sits over the lowest Legal rows' Done/Ask buttons and the lower part of an open settings panel on a phone. The toast body is one large button but only the X looks like a control.
- Verification: OBSERVED by three walkers. Toast code in packages/ui-web/src/components/ui/notification-toaster.tsx and apps/web/src/components/AppToaster.tsx (not re-read).
- Files to change:
  - packages/ui-web/src/components/ui/notification-toaster.tsx and apps/web/src/components/AppToaster.tsx (a 'Review' chevron or text; bottom padding on page scrollers equal to the toast height while one shows)
  - AppToaster.stories.tsx
- Reach: Anyone with a pending approval while browsing.
- Acceptance criteria:
  - With a toast showing, the last row's actions on Legal Deadlines and the end of a settings panel can be scrolled clear of it.
  - The toast shows a visible 'Review' affordance.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C22 [P3] Keyboard focus: after Cmd+K navigation focus lands on a page button, and chat chips use a different focus ring
- Rank: 22. Effort: S.
- Finding ids (found by): J1-10, V1-11 (J1, V1)
- Root cause: After opening Investors from the palette, document.activeElement is 'Add contact' with a heavy ring, so a second Enter opens the dialog. Inline 'Messaged ... agent' chips use the browser default ring while links and the composer use two other rings.
- Verification: OBSERVED by J1 (activeElement) and V1 (computed outlines). Components not located.
- Files to change:
  - apps/web/src/pages/Shell.tsx palette navigation (focus the main region)
  - chat message chip component (shared focus-visible ring class)
- Reach: Keyboard and screen reader users.
- Acceptance criteria:
  - After Cmd+K navigation, activeElement is the page heading or main region.
  - Chips, links and composer controls share one focus ring style.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C3, C14 (Shell.tsx/palette)

### C23 [P3] Routines: run history shows the model's rewritten message and a short time, and the schedule submenu opens detached over the chat
- Rank: 23. Effort: S.
- Finding ids (found by): J2-08, J2-09 (J2)
- Root cause: RoutineRunHistory.tsx titles a run with the bot's rewritten message ('Please run the cash check now for the user's local prese...') and shows '5.8s' for a run that waited about 40 s on a delegate. The 'On a schedule' submenu in RoutineEditor.tsx opens to the left over the chat, overlapping the panel border.
- Verification: OBSERVED once by J2 (73-run2.png, 69-sched.png). Files named from the walker, not opened.
- Files to change:
  - apps/web/src/pages/RoutineRunHistory.tsx (title = routine name; elapsed includes delegated work)
  - apps/web/src/pages/RoutineEditor.tsx (submenu below or inline)
- Reach: Routine users.
- Acceptance criteria:
  - Run history rows are titled with the routine name and show total elapsed time.
  - The schedule options open inside the panel.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C24 [P3] Finance sub-pages: Rent chart omits the current month, and Accounts uses a different range control and default
- Rank: 24. Effort: S. Reopens: iteration-20 C15.
- Finding ids (found by): R2-21-04, V2-08 (R2, V2)
- Root cause: The Rent chart covers Apr-Sep while the card says Oct 1-22 $7,500, so the open month is missing (FinanceSpend.tsx). The Accounts page draws the Week/Month/Quarter/Year control unframed, defaults to Year (overview: Month), and its 'Total cash' card is 170 px wide.
- Verification: OBSERVED by R2 and V2; files named from R2/V2.
- Files to change:
  - apps/web/src/pages/finance/FinanceSpend.tsx (include the current month as a partial bar)
  - apps/web/src/pages/finance/ accounts page (shared range control and default)
- Reach: Finance users who drill in; cosmetic.
- Acceptance criteria:
  - The Rent chart includes the current month as a partial bar.
  - Accounts uses the overview's range control and default.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C2, C7 (Finance)

### C25 [P3] A signed SAFE in the Data room has no stated next step toward the cap table
- Rank: 25. Effort: S.
- Finding ids (found by): J2-04 (J2)
- Root cause: The Investors agent honestly answers that the SAFE 'has not been added' and tells the founder to turn on 'Allow changes in Carta'. The founder is not told that SAFEs are recorded in Mercury (owner decision), so the Carta advice sends them the wrong way.
- Verification: OBSERVED by J2 (32-invagent.png). Agent instructions are in apps/api (Carta/Investors agent), not opened. Investors limited to P0/P1 by earlier decision; this is agent copy.
- Files to change:
  - Investors agent instructions in apps/api (where SAFEs are recorded; do not suggest Carta writes for SAFEs)
  - SAFE preview in apps/web/src/components/data-room/Preview.tsx (optional link)
- Reach: Founders preparing a seed round.
- Acceptance criteria:
  - Asked to add a signed SAFE, the agent names the correct place and does not suggest Allow changes in Carta.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C26 [P3] Investors 'Equity raised' shows a bare dash for several seconds before the figure appears
- Rank: 26. Effort: S. Reopens: iteration-18 C4.
- Finding ids (found by): V3-02 (V3)
- Root cause: Investors.tsx:169-190 shows a skeleton while 'loading' (safes not yet loaded), yet V3 saw '--' for 4-17 s on the shared stack. Either the cap table finished and safesLoaded flipped before the SAFE list settled, or equityRaisedUsd returned null for a moment.
- Verification: OBSERVED once under load by V3. Skeleton code CONFIRMED; the cause is SUSPECTED. Investors is limited to P0/P1 by decision, so this is filed P3 as a reopened cluster.
- Files to change:
  - apps/web/src/pages/Investors.tsx:169-190 (keep the skeleton until the SAFE query has settled)
- Reach: Investors page first visit.
- Acceptance criteria:
  - The Equity raised tile shows a skeleton, never a dash, until the SAFE list has answered or failed.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

## Deferred items (not in a cluster)
- R1-21-05, R3-21-07, V1-05, V2-11 tour card position, height and covered rows: owner decision (fixed card spot, nine stops).
- V2-07 Legal Deadline row actions repeated: owner decision. V2-04 Breakdown/Upcoming heights: pass-20 chose natural heights. V2-03 Finance content below the fold: panel scroll is allowed.
- J1-05 reply send takes about 12 s: the code undo window is 5 s (outbox.ts UNDO_SEND_MS); the remainder is the Gmail emulator or the app, not measured. Re-time against the emulator before filing.
- J1-06 Needs reply holds 22 of 27 fresh mails, J2-05 6-7 minute Legal scan, R3-21-06 repeated agent question: demo-model behaviour, not app defects.
- J1-11 Brex card bill under Upcoming without Brex connected (suspected derived data), J1-12 X and Cancel both in the Add account dialog (dialog pattern; optional line inside C7).
- V1-03 empty Gmail tile for 4 s: seen once; kept as an acceptance line in C6.
- V1-06 landing CTA pair 18 px off centre, V1-07 sign-in and reset form spacing, V1-09 Description textarea resize grip: low-value polish, no cluster; pick up with the next auth or bot-settings change.
- V2-09 phone approval card header truncates the recipient, V3-05 phone Data room preview has no page thumbnail, V3-06 Invested column all dashes, V2-14 'Show 15 more' (in C20): low priority, V3-05 and V3-06 need a product look first.
- J3-03 New bot opens Settings full screen on a phone: pass-decided naming step, recorded only (acceptance line in C5).
- V3-03 Data room upload input: test targeting note for walkers, not a defect.
- R1-21-04 untagged-file reason may be the intended pass-20 behaviour (commit 4b8f68de3); only the 'state a reason after classification' part is in C9.

## BLOCKED stories
- STORY-APP-309/319 model step and Connect your apps (demo has a default model and an owner); STORY-APP-209 real Mercury sign-in and FIN-022 reconnect chip; STORY-CAP-017/106 Carta connect (already connected, real host needed).
- STORY-INB-022 sort-during-load on a fresh mailbox (R2 and R3: the demo Inbox shows no sort prompt); INB-040 phone Monday; Inbox 'Not now' memory; attachment filing to the Data room.
- STORY-DRM-109 big files, zips, duplicates and protected zip; STORY-DRM-018 drag and drop and the 60 MB video refusal.
- STORY-APP-363 chat-drafted skill (needs a real model); STORY-APP-212/214 and FIN long stories; live Legal removal proposal and Inbox hand-off (C12 of pass 20); 'From routine' label (no routine message in the demo).
- Touch-target sizes outside J3's phone pages: R1, R2, R3, V1, V2, V3 browsers did not report pointer: coarse.
- Real-model checks of the Chief first-question answer (C10) and Legal agent behaviour.

## Counts by severity
- Clusters: P0 0, P1 0, P2 11, P3 15 (26 total).
- Raw findings: R1 10, R2 7, R3 7, J1 12, J2 11, J3 3, FLOW 7, V1 11, V2 14, V3 10 = 92. Walkers rated four findings P1 (V2-01, J1-01, J1-03, J3-02). After clustering and the calls above: 0 P1, 11 P2 clusters, 15 P3 clusters; the remaining findings are deferred above.
- Needs an owner decision: C11, C14, C19, C20.
