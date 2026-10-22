P0: 0, P1: 1, P2: 16, P3: 7

# Iteration 17 problems: fix clusters

Sources: R1-R3 (verify pass-16 clusters C1-C21), J1-J3 (journeys, J3 at 375 px with touch emulation), FLOW, V1-V3 (visual), all on the mock demo stack (web 5381). Iterations 1-16, docs/ux-flow and docs/ux-visual were read. Findings were deduplicated, checked against code where cheap, and clustered by root cause. A cluster that reopens a pass-16 cluster says so in its Reopens line. Rank: P0, then severity x reach / effort.

Owner decisions respected and not re-raised: tour stays nine stops with a fixed card and starts once one app is connected (J1-04 dropped); the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Legal row actions Ask agent / Done / Dismiss (V2-04 dropped); approval toasts persist; Settings in five sections; Mercury is the only SAFE record (J2-11 dropped); Investors judged for P0/P1 only except where a pass-16 cluster reopened; no cache for Integrations.

Environment caveats: about ten walkers shared the demo and the host load average was 22-49, so cold-load times are not filed as defects (only request counts). Only J3 had real touch emulation (R3 emulated it at 390 px). Light theme was not checked by V1.

Severity calls: one P1. C1 is a dead end: the only Undo for an archive is covered on a phone, and the cover is persistent. Lowered from reported P1: V1-01 bot panel overlay (a close button exists, the overlay is intentional below xl) to P2 in C10; V1-02 Settings reopening after Escape (seen once, not reproduced, R2 and R3 passed the Escape check) to Deferred; R1-01 tour reload (P1 by R1, P2 by R3; rare per user) to P2 in C8.

## Pass-16 cluster verification (R1-R3)

- Met: C4 Inbox dialog and send (R1, R3), C8 touch and keyboard (R3; R1 could not emulate coarse), C11 Settings Escape and load (R2, R3), C14 delegate approval button (R3), C15 Settings hierarchy (R2, R3), C16 desktop sidebar (R2, R3), C20 Integrations first frame (R2, R3), Storybook smoke 1764/1764 (R3).
- Not met (reopened): C3 Legal table (here C4), C5 GTM (C18), C6 Data room list (C5), C7 tour reload (C8), C9 Finance chart (C13), C10 Routines icon (C19), C12 first sort (C9), C18 Fundraising space name (C20), C19 request counts (C22), C2 Draft reply outcome (C12).
- Contradicted: C13 phone PDF preview. R3 saw an empty grey box at 390 px; R2 and J3 saw the document icon with Open and Download. Code has the fallback (PreviewActions.tsx:105-125, PdfPhoneFallback and max-sm:hidden), so R3's emulated window probably did not match max-sm. Not clustered; see Deferred.
- Not exercised: C1 failed-send card (cannot force on the demo; code strings gone: acct: removed), C14 payment, C17 no-recipient path, C21 agent wording.

## Fix clusters, ranked

### C1 [P1] Inbox Undo notice is hidden under a persistent approval toast on a phone
- Rank: 1. Effort: S.
- Finding ids (found by): J3-01 (J3), V3-11 (V3)
- Root cause: Inbox renders its own fixed notice (bottom-4, z-100, centered) outside the shared toast stack. A persistent approval toast (bottom, does not expire by design) is drawn over it, so the only chance to undo an archive is invisible. Toast bodies also clip mid-sentence on a phone.
- Verification: OBSERVED by J3 (DOM: notice at y 760-796 under the approval stack). Code CONFIRMED: Inbox.tsx:2036-2041 fixed bottom-4 z-100 div separate from AppToaster. V3-11 truncation observed once.
- Files to change:
  - apps/web/src/pages/Inbox.tsx:2033-2041 (render the undo notice through the shared toast stack, or stack it above approval toasts)
  - apps/web/src/components/AppToaster.tsx and packages/ui-web NotificationToaster (one stack order; allow 3-4 lines of body on a phone)
  - test: Inbox notice and approval toast do not overlap
- Reach: Anyone on a phone (or a narrow window) with a pending agent approval who archives mail: the approval toast is persistent, so the overlap lasts until it is answered. Archive is the most frequent Inbox action.
- Acceptance criteria:
  - With an approval toast pending at 375x812, after Archive the Undo notice is fully visible (its rectangle does not intersect the approval toast) and tapping Undo restores the mail.
  - A toast body of 3 lines is shown in full on a phone (no ellipsis mid-sentence).
  - Desktop placement is unchanged.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C11 (AppToaster)

### C2 [P2] Investors shows Equity raised '-' on first visit until the Finance or Fundraising page has run the Mercury SAFE sync
- Rank: 2. Effort: S.
- Finding ids (found by): J2-03 (J2)
- Root cause: The throttled Mercury SAFE sync is called only from fundraisingOverview (fundraising.ts:62-67). The Investors/cap table read does not call it, so a founder who opens Investors first sees no SAFEs and '-' even though Mercury has funded SAFEs.
- Verification: OBSERVED by J2 (20-investors.png vs 71-inv-bottom.png). Code CONFIRMED that only fundraisingOverview syncs; the Investors handler was not opened line by line (SUSPECTED as the only gap).
- Files to change:
  - apps/api/src/fundraising.ts:41-67 (export the throttled syncQuietly call for reuse)
  - apps/api Investors/cap table overview handler (call the same throttled sync with PAGE_SYNC_MS before reading)
  - test: Investors overview triggers the sync once per throttle window
- Reach: Every founder with Mercury connected who opens Investors before Finance or Fundraising. The figure is the first number an investor conversation uses.
- Acceptance criteria:
  - On a fresh session, the first Investors load shows Equity raised and the SAFE list that Fundraising shows (within the page sync wait).
  - Two loads inside the throttle window start one sync.
  - Mercury being down does not block the Investors page.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C12, C20 (Investors/Fundraising pages)

### C3 [P2] Finance hides that a non-USD account is left out of Cash and runway
- Rank: 3. Effort: S.
- Finding ids (found by): J1-01 (J1), V2-08 (V2)
- Root cause: The note '1 non-USD not counted' is rendered sr-only plus a hover tooltip, so a sighted founder quoting runway to a board cannot see that cash is understated. FinanceSpend shows the same fact visibly.
- Verification: OBSERVED by J1 (DOM check). Code CONFIRMED: Finance.tsx:441-447 sr-only span and tooltip only.
- Files to change:
  - apps/web/src/pages/Finance.tsx:441-447 (show '1 account not counted' as visible text beside the sync status or under Cash)
  - apps/web/src/pages/finance Accounts list (sort by balance, largest first; V2-08 P3)
- Reach: Anyone with a non-USD bank account who reads runway on Finance (the board-meeting journey STORY-FIN-001/006).
- Acceptance criteria:
  - When excludedNonUsdCount > 0 the Finance first screen shows the words 'not counted' without hover.
  - Accounts are ordered by balance, descending.
  - With zero excluded accounts nothing new is shown.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C4 [P2] Legal: contract names and renewal terms still truncate (fixed percentage columns), two buttons run the same scan, Undo row leaves a gap
- Rank: 4. Effort: S. Reopens: iteration-16 C3.
- Finding ids (found by): R3-17-04 (R3), V2-03 (V2), FLOW-01 (FLOW), J2-12 (J2)
- Root cause: Fixed column widths 26/17/19/16/9/13 give Contract and Renewal the same share as Value and Deadline, so the cells that carry meaning cut ('Auto-renews, 30 days ...'). The header 'Scan now' and the banner 'Check now' both call scan(). After Done the Undo line takes a full-height row.
- Verification: OBSERVED by 4 walkers. Code CONFIRMED: colgroup widths unchanged at LegalContracts.tsx:163-168; both buttons call scan() (Legal.tsx:318, :354). Deadlines button weight (V2-04) dropped: Ask agent/Done/Dismiss is an owner decision.
- Files to change:
  - apps/web/src/pages/legal/LegalContracts.tsx:162-169 (size Term, Value, Deadline to content; give the rest to Contract, Parties, Renewal)
  - apps/web/src/pages/Legal.tsx:313-322 (remove the 'Check now' button; keep the count text; header Scan now stays)
  - apps/web/src/pages/legal/LegalDeadlines.tsx (collapse the Undo row to a compact inline notice)
- Reach: Everyone who opens Legal (5 walkers). Reopens the pass-16 C3 truncation criterion; R1 saw 34 characters, R3 about 30, so the margin is thin.
- Acceptance criteria:
  - At 1440 no contract name or renewal text is cut while Term, Value or Deadline has more than 60 px free; 'Auto-renews, 30 days notice' is readable.
  - Legal shows exactly one scan button.
  - After Done the Undo notice is at most 40 px high.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C5 [P2] Data room list: Type and Status are fixed columns, so names wrap and Parties truncate; slack goes to Name at 1920
- Rank: 5. Effort: S. Reopens: iteration-16 C6.
- Finding ids (found by): V3-01 (V3), V3-02 (V3), R1-04 (R1), R3-17-11 (R3)
- Root cause: Type is a fixed w-40 and Status a w-20 column that is empty on nearly every row; Name takes all slack at 1920 while Parties stops at 288 px. Names wrap to two lines (57 px rows) and Parties cut.
- Verification: OBSERVED by 4 walkers. Code CONFIRMED widths in ItemRows.tsx (w-40/w-20 reported by V3).
- Files to change:
  - apps/web/src/components/data-room/ItemRows.tsx:206-213 (Type about 112 px; show the Failed pill inside the Name cell or hide Status unless a row failed; Parties takes a flexible share of slack, Name capped)
  - ItemRows.test.tsx column assertions
- Reach: Everyone with a Data room (4 walkers). Reopens pass-16 C6 (Parties still cut; Type fixed).
- Acceptance criteria:
  - At 1440 and 1920, 'Northwind Robotics, Acme Vent...' style party lists show without ellipsis when Name is wider than 400 px.
  - A name of 40 characters is on one line at 1440 (row 40 px).
  - A failed row keeps its pill and reason.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C24 (ItemRows.tsx)

### C6 [P2] A new-item dot replaces the Data room failed count in the sidebar
- Rank: 6. Effort: XS.
- Finding ids (found by): FLOW-03 (FLOW)
- Root cause: glanceBadge returns the 'new' dot whenever unseen > 0 and only then falls through to the value, so the red failed count (the only way to the failed files, an owner decision) disappears while anything new is unseen, and the accessible name becomes 'new'.
- Verification: OBSERVED by FLOW (red '1' on some screens, white dot on others). Code CONFIRMED sidebar-glance.tsx:27 branch order.
- Files to change:
  - apps/web/src/components/sidebar-glance.tsx:25-37 (when failure is true and value is set, return the value first)
  - sidebar-glance test
- Reach: Anyone with an unreadable Data room file while uploads or imports add new items.
- Acceptance criteria:
  - With one failed file and unseen > 0 the row shows the red count and its accessible label names failures.
  - With no failure the dot still shows for unseen items.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C7 [P2] Settings switches on a phone have a 32x18 tap target inside a 44 px row; panes start at different x
- Rank: 7. Effort: S.
- Finding ids (found by): J3-02 (J3), J3-03 (J3), V1-08 (V1), V1-07 (V1)
- Root cause: Only the switch (32x18) and a 20 px label are tappable; the min-h-11 row is not the control. Models and Memory use different horizontal padding (x 32-33) than General and Privacy (x 22), and Sign-up shifts 52 px when errors appear.
- Verification: OBSERVED by J3 under real touch emulation. Code paths cited by J3, not opened here.
- Files to change:
  - apps/web/src/components/ApprovalRulesSettings.tsx:108-125
  - apps/web/src/pages/AccountSettingsOverlay.tsx:255-291
  - apps/web/src/components/NotificationSettings.tsx:64
  - apps/web/src/pages/SettingsOverlay.tsx (same padding and first-card y for every pane; card for Memory)
  - sign-up form (reserve error line height)
- Reach: Every phone user who changes a privacy or approval switch. 44 px on coarse pointers is an owner decision.
- Acceptance criteria:
  - With pointer: coarse each Settings switch row is tappable over at least 44x44 px (tap on the label toggles it).
  - All four panes start at the same x and the first card at the same y (+-2 px).
  - Sign-up Create account moves by at most 4 px when errors show.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C8 [P2] First-run tour restarts at step 1 (with a different stop count) after a reload
- Rank: 8. Effort: S. Reopens: iteration-16 C7.
- Finding ids (found by): R1-01 (R1), R3-17-03 (R3)
- Root cause: Steps are kept in sessionStorage, but TourPopover restores only once, on the first non-null 'present' list (restored.current), and present drops steps whose anchor is not yet on screen. On reload the sidebar anchors are not all mounted, so the list has 4 stops, the saved id is not found and the step resets.
- Verification: OBSERVED by R1 and R3 (4/9 to 1/4). Code location CONFIRMED; the 'anchors not mounted' cause is SUSPECTED.
- Files to change:
  - apps/web/src/components/tour/TourPopover.tsx:117-135 (restore against the full ordered stop list, or retry restoring until the saved id is present)
  - apps/web/src/pages/Shell.tsx tourOpen (~2790): keep the tour mounted until anchors settle
  - TourPopover test: reload at step 4 restores step 4 of 9
- Reach: A new user who reloads or is bounced mid-tour (session expiry, dev reload). Rare per user but it hits every new account once. Reopens pass-16 C7 reload criterion; the start-after-one-app part is met.
- Acceptance criteria:
  - Reload at step 4/9 shows step 4/9.
  - The stop count after reload equals the count before.
  - Skip and Done still clear the saved step.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C16, C19, C22 (Shell.tsx)

### C9 [P2] First mail sort for a new user is slow and the note comes late; most mail lands in Needs reply
- Rank: 9. Effort: M. Reopens: iteration-16 C12.
- Finding ids (found by): R2-01 (R2), R2-02 (R2), R3-17-02 (R3), J1-06 (J1)
- Root cause: Triage appears to start late after consent and the 'taking longer' note appears at about 77 s instead of 15 s; the demo classifier sends about 68% of mails to Needs reply. A skeleton 'Reading your mail...' shows beside the consent card before consent. Cause not traced; the model is scripted on the demo.
- Verification: OBSERVED by R2, R3. Cause SUSPECTED; a real-model run is needed to call the classifier a defect.
- Files to change:
  - apps/api inbox triage job start (start on the Allow click; log time to first result)
  - apps/api triage prompt/threshold (Needs reply only for mail that asks something of the user)
  - apps/web/src/pages/Inbox.tsx (show the wait note at 15 s; no 'Reading your mail...' skeleton before consent)
- Reach: Every new user's first Inbox visit. Reopens pass-16 C12; R2 and R3 each failed it (56 s, 122 s).
- Acceptance criteria:
  - After Allow, sorted groups or a visible wait note appear within 15 s.
  - Under 40% of a 28-mail mailbox lands in Needs reply on the demo.
  - No skeleton text before consent.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C20, C24 (Inbox.tsx)

### C10 [P2] Bot settings panel overlays the chat below 1280 px and hides the Send button
- Rank: 10. Effort: S.
- Finding ids (found by): V1-01 (V1)
- Root cause: ResizableSidePanel is absolute with a 384 px width below the xl breakpoint and relative only from xl, so at 768-1180 px it lies on top of the chat with no scrim; text is cut and the composer Send is covered.
- Verification: OBSERVED by V1 (Send right edge 985, panel left 640 at 1024). Code CONFIRMED: absolute ... xl:relative.
- Files to change:
  - apps/web/src/pages/ResizableSidePanel.tsx:84 (below xl add a scrim and focus trap, or reserve space so the composer stays visible)
- Reach: Anyone on a laptop window under 1280 px or a tablet who opens a bot's settings panel. Closing is possible, so no dead end: lowered from V1's P1.
- Acceptance criteria:
  - At 1024 and 768 with the panel open, either the Send button is visible or the chat is dimmed with a scrim and Escape closes the panel.
  - At 1280 and above the layout is unchanged.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C11 [P2] A money or mail approval left unanswered has no trace after leaving the chat; Mercury agent has no direct entry
- Rank: 11. Effort: M.
- Finding ids (found by): J2-05 (J2), J2-06 (J2), J3-06 (J3)
- Root cause: Opening the approval chat dismisses its toast (markApprovalChatOpen), and nothing re-raises it when the user navigates away unanswered; the 'Needs your answer' row sits in the collapsed Page agents group. The Mercury agent is reached only through a link in the 'Used by' list. After a hand-off, two 'Open Inbox agent' controls show at once on a phone.
- Verification: OBSERVED by J2 and J3. Cause for J2-05 SUSPECTED from markApprovalChatOpen at approval-toasts.ts:80-82.
- Files to change:
  - apps/web/src/lib/approval-toasts.ts:80-110 (re-enqueue the toast when the chat closes with the approval still pending, or badge the Page agents group)
  - apps/web/src/pages/Shell.tsx sidebar Page agents group (badge when a child needs an answer)
  - integration detail page Agent section (Open Mercury agent button next to Allow changes)
  - apps/web/src/pages/shell/transcript.tsx (keep the pinned Open agent button, drop the inline duplicate)
- Reach: Anyone who asks an agent to pay or send mail and then browses elsewhere. Core journey; approval toasts persisting is an owner decision and stays.
- Acceptance criteria:
  - Leave a chat with a pending approval: a toast or a visible badge on the collapsed Page agents group appears within 2 s.
  - The Integration page has one button that opens the Mercury agent.
  - Only one 'Open Inbox agent' control shows on a phone.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1, C16, C22 (Shell.tsx, AppToaster)

### C12 [P2] Investors 'Draft reply' is idle for about 9 s, then shows no outcome on the row
- Rank: 12. Effort: S. Reopens: iteration-16 C2.
- Finding ids (found by): R1-02 (R1), R3-17-09 (R3)
- Root cause: The row does not enter Drafting synchronously on click, so repeat clicks look dead; when the draft ends the row returns to 'Draft reply' with the outcome only in the Ask panel.
- Verification: OBSERVED by R1 (9 s idle, no response in 24 s) and R3 (no outcome on the row).
- Files to change:
  - apps/web/src/pages/Investors.tsx:1162 (set Drafting before the rpc; open the existing panel on a repeat click)
  - apps/web/src/components/investors/ActionItems.tsx:78-126 (row result: 'Draft ready' or the agent's one-line reason)
- Reach: Founders answering an audit or investor request (STORY-CAP-019). Reopens pass-16 C2 outcome criterion. Investors is judged only for P0/P1 under Pass 9, but this is the same cluster as the pass-16 P1.
- Acceptance criteria:
  - The row shows Drafting within 300 ms of the click.
  - A second click while running opens the panel and does not start another draft.
  - After completion the row shows 'Draft ready' or a reason.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C2

### C13 [P2] Finance burn chart: Year and Quarter views are nearly empty and the current month is two dots
- Rank: 13. Effort: M. Reopens: iteration-16 C9.
- Finding ids (found by): R1-05 (R1), R3-17-05 (R3), R3-17-06 (R3), FLOW-05 (FLOW), V2-07 (V2)
- Root cause: With one year of data the Year view is one column with two unconnected dots; Quarter Q4* draws two markers 111 px apart; month bar links are 35 px wide on a phone; the Financing label touches its marker.
- Verification: OBSERVED by 5 walkers. Code location charts.tsx not opened line by line.
- Files to change:
  - apps/web/src/components/finance/charts.tsx (single mark for a partial period; show trailing periods or bars for a single period; 44 px bar links with coarse pointer; offset the annotation 6-8 px)
  - apps/web/src/pages/finance/FinanceBurn.tsx:110
  - charts.layout.test.tsx
- Reach: Every Finance visit (5 walkers across 4 passes). Reopens pass-16 C9.
- Acceptance criteria:
  - Year view with one year of data shows at least the months or a clear single-period bar, never two unlabeled dots.
  - No two markers are within 8 px of each other at 1440 and 375.
  - With coarse pointer each month control is at least 44 px wide.
  - Layout test fails on overlapping markers.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C14 [P2] Cleanup says 'Nothing to clean up' while Newsletters and Digest list senders
- Rank: 14. Effort: S.
- Finding ids (found by): J1-02 (J1)
- Root cause: Cleanup and Newsletters/Digest use different sender rules (suspected: a message-count threshold or contacts filter), and the empty state does not say why.
- Verification: OBSERVED by J1; rule SUSPECTED, not located.
- Files to change:
  - Cleanup page and server sender query (apps/web Cleanup component, apps/api inbox cleanup)
- Reach: Monday inbox reset journey (STORY-INB-109 step 10). Seen by one walker; the iteration-16 'empty Cleanup is compact' judgment concerned layout, not this contradiction.
- Acceptance criteria:
  - When Newsletters has senders and Cleanup is empty, the empty state names the rule ('Senders need N or more messages') or Cleanup lists those senders.
  - No page says there is nothing to clean while another offers 'Archive all N messages'.
- Needs product decision: true. Should Cleanup list newsletter senders too, or only explain why it is empty? Recommended: explain the rule in one line.
- Depends on: none. Conflicts (shared files): none

### C15 [P2] Data room Auto-sort: all 33 moves pre-checked, and it creates a second 'Cap table' folder
- Rank: 15. Effort: M.
- Finding ids (found by): J2-01 (J2), J2-02 (J2)
- Root cause: The proposal checks every move (including files already well placed) behind one Apply button, and the server proposal does not reuse an existing same-named folder.
- Verification: OBSERVED by J2 (08-autosort2.png, 80-dr-final.png). Server code not opened.
- Files to change:
  - apps/web/src/components/data-room Sort files dialog (check only unfiled items by default; others optional)
  - apps/api data room sort proposal (reuse an existing folder with the same name)
- Reach: Anyone preparing a Data room for a raise (STORY-DRM-109/018) who runs Auto-sort. Undo exists.
- Acceptance criteria:
  - Default-checked moves are only items outside a suitable folder.
  - The proposal never creates a folder whose name already exists under another parent without saying so.
  - Apply shows the number of checked changes.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C16 [P2] Sidebar on short screens: pinned Pages block squeezes the chat list and Activity hides groups with no cue
- Rank: 16. Effort: S.
- Finding ids (found by): V1-04 (V1), V3-03 (V3), R2-08 (R2), V1-11 (V1), V2-10 (V2)
- Root cause: The Pages block is pinned (about 400 px) and the chat list scrolls in 284 px at 800 px high; the Activity block is capped at max-h 40% of a small parent (76 px), so 'Working' and 'finished runs' are hidden under an inner scroller with no fade or count. Long bot names wrap the row; the scroll fade draws a band over the last row.
- Verification: OBSERVED by V1, V3, R2. Activity code CONFIRMED (lg:max-h-[40%] at ActivityList.tsx:179).
- Files to change:
  - apps/web/src/pages/ActivityList.tsx:179,209 (min one row per group or a '+N more' cue)
  - apps/web/src/pages/Shell.tsx sidebar (let the whole sidebar scroll under 800 px high; clamp row title to one line; sidebar Search not autofocused)
  - apps/web/src/styles.css:65 .rk-scroll-fade-y (mask, only when scrolled)
- Reach: All desktop users on laptops 800 px or lower. R2/R3 measured Activity at 17-33% on 900 px screens (pass-16 limit met there), so this is the short-screen case.
- Acceptance criteria:
  - At 1280x720 the Activity block shows each non-empty group header, or a '+N more' line.
  - The chat list has at least 6 visible rows at 800 px high.
  - An 83-character bot name keeps a one-row sidebar title.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C8, C11, C19, C22 (Shell.tsx)

### C17 [P2] A file stuck in 'Reading text' for ten minutes ends untagged with no reason or retry, and makes agents hedge
- Rank: 17. Effort: M.
- Finding ids (found by): J2-04 (J2)
- Root cause: No read timeout or terminal state: after about 10 minutes the strip vanished and the file stayed 'Not tagged'; the Data room and Legal agents qualified every answer because one file was pending.
- Verification: OBSERVED once by J2; the 3-minute retry from pass 10 is expected to cover it, so the cause is SUSPECTED, not traced.
- Files to change:
  - apps/api data room processing worker (time out a read, mark failed with reason and Try again)
  - agent tool text that reports 'one file is still indexing' (only qualify when relevant to the question)
- Reach: Anyone who uploads a PDF the reader cannot finish. Seen once; lowered from nothing because the demo is loaded.
- Acceptance criteria:
  - A read stuck over 3 minutes becomes a failed row with a reason and Try again.
  - Agents answer without the indexing caveat when the question does not depend on the pending file.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C18 [P3] GTM page: empty 'Written by' box, no table inset and the same 'Not connected' repeated seven times; GTM appears twice in Cmd+K
- Rank: 18. Effort: S. Reopens: iteration-16 C5.
- Finding ids (found by): R1-03 (R1), R3-17-08 (R3), FLOW-04 (FLOW), FLOW-02 (FLOW)
- Root cause: The caption box renders when content is whitespace-only; Channels rows each repeat the status of the Connect card above; the palette lists a bot in both Bots and Chats.
- Verification: OBSERVED by 4 walkers. Code: Gtm.tsx hides only when empty, so whitespace content is SUSPECTED.
- Files to change:
  - apps/web/src/pages/Gtm.tsx:216-223 (trim content before the empty check)
  - apps/web/src/pages/gtm/GtmChannels.tsx:11-51 (collapse rows with one shared status; cell inset like Contacts)
  - Cmd+K sections in Shell.tsx (list a bot once)
- Reach: Everyone who opens GTM (3 walkers). Reopens pass-16 C5 (empty box, inset).
- Acceptance criteria:
  - No empty caption box.
  - Before Zernio is connected the four X/LinkedIn/Threads/Bluesky rows read as one line.
  - Cmd+K 'gtm' shows the agent once.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C16, C22 (Shell.tsx)

### C19 [P3] Routines: monitor icon returns in the editor, panel label says 'Computer', month schedule does not name the day
- Rank: 19. Effort: S. Reopens: iteration-16 C10.
- Finding ids (found by): R3-17-10 (R3), R1-06 (R1), J2-08 (J2), J2-09 (J2), V1-12 (V1)
- Root cause: The header icon is a clock in the list but a monitor in the editor; the button label is 'Computer and routines'; the picker label 'Every month at 9:00 AM' hides the day; the tooltip 'Save the routine first' overlaps the close button; sidebar Activity and header Routines share the history/clock look.
- Verification: OBSERVED by 5 walkers.
- Files to change:
  - apps/web/src/pages/Shell.tsx header toolbar (one icon and label for the Routines-only panel)
  - apps/web/src/pages/RoutineSchedule.tsx (label 'Every month on the 1st'; tooltip below the button)
- Reach: Anyone who opens Routines. Reopens pass-16 C10 (icon, heading).
- Acceptance criteria:
  - Same icon and name in list and editor.
  - The monthly picker names the day.
  - Tooltip does not cover Close.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C8, C16, C22 (Shell.tsx)

### C20 [P3] Space name in page headers: missing on Fundraising, on the right on Inbox; Contacts table narrower than its header
- Rank: 20. Effort: S. Reopens: iteration-16 C18.
- Finding ids (found by): R2-04 (R2), R3-17-13 (R3), FLOW-06 (FLOW), V3-07 (V3)
- Root cause: Each page places the space name by hand; PageHeader does not own it. Contacts caps its table at max-w-4xl.
- Verification: OBSERVED by 4 walkers.
- Files to change:
  - apps/web/src/components/PageHeader.tsx (one place for the space name)
  - apps/web/src/pages/Inbox.tsx:1357-1360
  - apps/web/src/pages/Fundraising*.tsx
  - apps/web/src/pages/Contacts.tsx:186
- Reach: Multi-space users on those four pages. Reopens pass-16 C18 (Fundraising).
- Acceptance criteria:
  - Fundraising, Inbox, Contacts, Artifacts, Investors, Finance, Legal show the space name in the same place.
  - Contacts table right edge matches the header gutter.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C2, C9

### C21 [P3] Integrations: Carta letter tile, no overflow menu on most connected cards, focus lost after Connect, bare skeleton for 10 s
- Rank: 21. Effort: S. Reopens: iteration-16 C20.
- Finding ids (found by): R2-05 (R2), R3-17-12 (R3), V1-09 (V1), V1-10 (V1), R2-09 (R2)
- Root cause: Per-card anatomy differs (menu only on some, 'Used by' row missing on Coinbase); the connected dialog returns focus to the account button; the grid shows skeleton cards with no words.
- Verification: OBSERVED by 4 walkers.
- Files to change:
  - apps/web/src/pages/Integrations.tsx connected card and dialog
  - Integrations tile component (Carta logo)
- Reach: Anyone opening Integrations. Reopens pass-16 C20 (letter tile).
- Acceptance criteria:
  - Every connected card has the same actions row.
  - After Done, focus lands on the new card.
  - A grid still loading after 2 s says 'Loading integrations...'.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C22 [P3] Cold load: duplicate bots/list, routines/list and bootstrap calls; slow first frames say nothing
- Rank: 22. Effort: M. Reopens: iteration-16 C19.
- Finding ids (found by): R2-03 (R2), R3-17-07 (R3), R1-07 (R1), FLOW-07 (FLOW), V3-10 (V3)
- Root cause: Shell, sidebar and pages each own their query, so one cold load issues 5-6 bots/list, 14 routines/list and 3 bootstrap calls. Long 'Opening Praci...' stalls were seen with host load average 22-49, so latency is not filed as a defect.
- Verification: Counts OBSERVED by R2, R3; latency SUSPECTED load.
- Files to change:
  - apps/web/src/pages/Shell.tsx and sidebar data hooks (one shared query per key)
  - apps/web/src/pages/Gtm.tsx / Shell.tsx:3385 (page agent created on open)
- Reach: All users; counts are real, absolute time is environmental. Reopens pass-16 C19 (still 5-6 and 14, limit 2 and 2).
- Acceptance criteria:
  - One cold load makes at most 2 bots/list and 2 routines/list calls.
  - Re-measure /app/gtm and /app/artifacts on an idle stack; if over 3 s, open a separate item.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C8, C11, C16, C18, C19 (Shell.tsx)

### C23 [P3] Keyboard and screen-reader gaps: composer is tab stop 59, preview Escape needs two presses, unread dot has no name
- Rank: 23. Effort: S.
- Finding ids (found by): V1-05 (V1), V2-02 (V2), V2-06 (V2), J3-07 (J3)
- Root cause: Per-message toolbars add tab stops (commit 84ad4ab claims one stop per message, so V1's count may be stale or a different list); PDF iframe takes focus so the first Escape does not reach the dialog; the phone reason dot has no accessible name.
- Verification: V1-05 conflicts with commit 84ad4ab; re-count before work (SUSPECTED stale). Others OBSERVED once.
- Files to change:
  - apps/web/src/pages/shell message toolbar (roving tabindex or skip-to-composer)
  - apps/web/src/components/inbox preview dialog (initial focus on Close)
  - apps/web/src/components/inbox InboxRow.tsx (name for the dot; keep unread dot beside the touch checkbox)
- Reach: Keyboard and screen-reader users; V1-05 is the broadest.
- Acceptance criteria:
  - From the header, the composer is reachable in at most 10 Tab presses on a 30-message chat.
  - One Escape closes the PDF preview.
  - The reason dot has an accessible name.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C24 [P3] Small visual and copy fixes (Inbox dialog flash, To do card jump, Data room preview/grid/palette, wording, rounding)
- Rank: 24. Effort: S.
- Finding ids (found by): V2-01 (V2), R2-06 (R2), J1-03 (J1), J3-04 (J3), J3-05 (J3), V3-04 (V3), V3-05 (V3), V3-06 (V3), V3-09 (V3), V3-12 (V3), V1-03 (V1), J2-10 (J2), V2-05 (V2), V2-09 (V2)
- Root cause: Independent polish items: white loading card on dark theme; To do card shrinks when 'Show more' is expanded; Data room preview Source baseline, grid titles clamp, stats tooltip, upload scroll jump, failed file not marked in search, palette selection bracket; 'What do you want me on first?'; Finance 1% vs agent 0.5%; Finance subscriptions sub-line indent.
- Verification: OBSERVED. V2-01 code CONFIRMED (bg-white at InboxMessageDialog.tsx:603); V1-03 CONFIRMED at onboarding.ts:157.
- Files to change:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx:603 (bg-white to card/muted tokens)
  - apps/web/src/components/inbox/TodoCard.tsx, InboxRow.tsx:163
  - apps/api/src/onboarding.ts:157 (and locale strings) 'What should I work on first?'
  - data-room Preview/ItemRows grid and DataRoomStats.tsx
  - packages/ui-web command.tsx:151
  - finance formatting vs agent prompt
- Reach: Cosmetic; each small. V1-03 is user-facing copy so the PR must quote it.
- Acceptance criteria:
  - Loading card uses theme tokens on dark theme.
  - 'Show more' does not shrink the To do card.
  - First-run question reads 'What should I work on first?'.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C5, C9

## Deferred items (not in a cluster)
- V1-02 Settings dialog reopened after close (P1 by V1): seen once, not reproduced in 4 tries; R2 and R3 verified Escape closes Memory in one press. Watch only.
- R3-17-01 phone PDF preview empty (P2 by R3): contradicted by R2, J3 and PreviewActions.tsx fallback; re-test at a real 390 px window before filing.
- J2-07 routine run returns a figures summary, not a draft (P2): scripted demo model, skill injection unverified; needs a real-model run.
- J2-13 insurance term Dec 2 vs deadline Dec 1: demo seed data.
- J2-11 no path from a Data room SAFE to the investor: decided (Mercury is the only SAFE record).
- J1-04 tour starts while Calendar card is open: matches the pass-16 decision.
- J1-05 digest cards show subject plus snippet, J1-06 long Important pile: scripted model artefacts, check on a real model.
- J1-07 catalog stories APP-001/002/319 are stale (docs/ux-paths/catalog.md): docs update, no UI change.
- V1-06 user bubbles use the bot's identity colour: design decision for the owner.
- FLOW-08 several money and cap table agents overlap (Carta, Investors, Finance, Mercury): owner decision on roster; recorded only.
- V3-08 phone Data room view toggles under Filters: tied to the pass-16 deferred parity decision (V3-10).
- V2-04 Legal Deadlines three buttons: decided in pass 16.
- R1-08, V1-touch, V2-touch, V3-touch: tooling could not emulate pointer: coarse; not product findings.

## BLOCKED stories
- STORY-APP-319 model step and Connect your apps page (demo has a model and configured apps); STORY-CAP-106 Carta connect; Gmail/Calendar/Brex/Box/Slack/Notion OAuth; Box import.
- STORY-DRM-103/104/105 zip failures and DRM-109 large zip, video and password zip; STORY-DRM-121 (needs Gmail import and Box).
- Pass-16 C1 failed-send card and Open in composer; C14, C17 payment no-recipient path; C21 agent wording (scripted model).
- C3 scan-adds-a-row checks (scan needs AI consent); Cleanup and Digest bulk actions (shared demo state); Spam tab.
- Phone width for Legal, Investors, GTM; light theme; real device touch targets.

## Counts by severity
- Clusters: P0 0, P1 1, P2 16, P3 7 (24 clusters).
- Raw findings (before dedupe): R1 8 (1 P1), R2 9, R3 13, J1 7, J2 13, J3 7 (1 P1), FLOW 8, V1 12 (2 P1), V2 10, V3 12: 99 findings, 4 reported P1, 0 P0. After checking: 1 P1 cluster.
