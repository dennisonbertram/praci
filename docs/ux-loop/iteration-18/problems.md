P0: 0, P1: 1, P2: 14, P3: 5

# Iteration 18 problems: fix clusters

Sources: R1-R3 (verify pass-17 clusters C1-C24), J1-J3 (journeys; J3 at 375 px), FLOW, V1-V3 (visual), all on the mock demo stack (web 5381). Iterations 1-17, docs/ux-flow and docs/ux-visual were read. Findings were deduplicated, checked against code where cheap, and clustered by root cause. A cluster that reopens an earlier one says so in its Reopens line. Rank: P0, then severity x reach / effort.

Owner decisions respected and not re-raised: tour stays nine stops with a fixed card (J1-05, V2-05 dropped); the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Legal row actions Ask agent / Done / Dismiss (V2-07 dropped); approval toasts persist; Settings in five sections with Memory's fixed height; Mercury is the only SAFE record; Investors and Fundraising judged for P0/P1 plus reopened clusters only.

Environment caveats: about ten walkers shared one demo account and the host load average was 55-215, so cold-load durations are upper bounds and are not filed as defects (missing controls and retries are). Shared-account side effects (extra bots, 'J3 walker', changing badge counts, a 'Reconnect needed' space, approvals created by other walkers) are not findings. Touch targets were measured with real coarse emulation by R1 and V1 only; J3-05, V2 and V3 touch sizes are unverified.

Severity calls: one P1 (C1: a payment approval that has been opened but not answered never returns as a toast, confirmed against code and the API). Lowered from reported: V3-01 Activity peephole P1 to P2 in C6 (toast, chat row and phone drawer still show approvals); J2-02 Investors dash P1 to P2 in C4 (self-corrects on the next visit, seen under heavy load, not reproduced by R1). Rejected as walker framing: J2-01 and R2-01 'may be another walker', disproved by the API check (seenAt set 2 s after creation on all four pending approvals).

## Pass-17 cluster verification (R1-R3)
- Met: C1 Undo vs toast (R1), C3 Cash note visible (R1; but see C3 here, the unit is wrong), C6 failed count vs dot (R1), C7 Settings switches and sign-up (R1), C8 tour reload (R1), C10 bot panel scrim (R1), C12 Draft reply (R2), C13 chart markers (R2), C14 Cleanup empty (R2), C15 Auto-sort (R2), C18 GTM, C19 Routines on an existing bot, C20 space name (R2), C22 timings (R3), C24 (R3), Storybook smoke 1779/1779 (R3).
- Not met (reopened here): C2 Investors first visit (C4, unverified by R1), C4 Legal columns (C2), C5 Data room columns (C5), C9 Needs reply share (C8), C11 approval trace (C1), C16 sidebar short screens (C6), C21 Integrations actions row (C10), C22 bots/list count (C16), C23 composer tab stops and Escape (C17), C19 on a new bot (C13).
- Not exercised: C17 stuck Reading text (needs a stuck worker), C13 44 px chart targets, real Mercury connect.

## Fix clusters, ranked

### C1 [P1] An unanswered payment or mail approval does not come back as a toast after the chat is left or the page reloads
- Rank: 1. Effort: S. Reopens: iteration-17 C11.
- Finding ids (found by): J2-01 (J2), R2-01 (R2), R2-10 (R2), J3-04 (J3)
- Root cause: syncApprovalToasts keeps only approvals with no seenAt, but opening the approval chat sets seenAt within seconds (the server list deliberately returns pending approvals 'seen or not: viewing a card is not answering it'). So every pending approval the user has glanced at is filtered out client-side, and no toast returns after navigating away or reloading. The server and client disagree about what 'seen' means.
- Verification: J2 (confirmed through the API) and R2 (partial, another walker may have marked it seen). Code CONFIRMED: notification-delivery.ts:41-43 filters !n.seenAt; apps/api/src/runs.ts:146-150 comment says seen or not. This reopens pass-17 C11, whose toast-restore criterion did not hold. R2-10 observed once.
- Files to change:
  - apps/web/src/lib/notification-delivery.ts:41-43 (drop the !n.seenAt condition for pending approvals, or replace it with a separate 'dismissed with X' flag)
  - apps/web/src/lib/approval-toasts.ts:80-110 (markApprovalChatOpen: re-enqueue when the chat closes with the approval pending)
  - apps/web/src/pages/shell/transcript.tsx or the agent panel (when an email-agent run ends with an approval pending and no text, show the approval card in the panel, R2-10)
  - apps/web/src/components/AppToaster.tsx (toast title/body names the recipient and the request, J3-04)
  - test: syncApprovalToasts with a pending approval that has seenAt set
- Reach: Anyone who asks an agent to pay or send mail and then browses elsewhere or reloads. Four pending approvals in the demo all had seenAt set, so none would ever be restored. Core journey (STORY-APP-385/386). Unanswered money approvals are easy to lose.
- Acceptance criteria:
  - Ask the Mercury agent for a payment, leave the chat without answering, reload, wait 15 s: the approval toast is visible again.
  - Answering (Send/Approve or Deny) or dismissing with X removes the toast and it does not return after reload.
  - An approval pending for an agent that finished with 'Done, N tools' and no text shows its card in the panel as well as the toast.
  - The toast text names the recipient or amount and the request.
- Needs product decision: true. When the user closes an approval toast with X (not answered), should it come back after a reload? Recommended: no for X, yes for merely opening or leaving the chat.
- Depends on: none. Conflicts (shared files): C6 (Shell.tsx sidebar), C7 (approval card)

### C2 [P2] Legal: contract names, term and renewal text still cut off; the 'N documents not yet checked' row is a bordered notice with no action
- Rank: 2. Effort: S. Reopens: iteration-17 C4.
- Finding ids (found by): R1-18-01 (R1), J2-06 (J2), V2-01 (V2), FLOW-01 (FLOW), V2-08 (V2)
- Root cause: The colgroup was changed (28/19/16/17/8/12 percent) but still gives Value (8%) and Next deadline (12%) a slice and cuts Contract, Term and Renewal (7 truncated cells at 1440, 21 by J2's count). Removing the second scan button in pass 17 left the unchecked-documents row as a bordered box with one child, so it looks clickable and does nothing; the file it counts is not named and may be one of the unreadable-PDF failures that 'Scan now' cannot clear.
- Verification: OBSERVED by 5 walkers. Code CONFIRMED: LegalContracts.tsx:163-168 fixed percent colgroup with table-fixed; Legal.tsx:303-312 single-child justify-between container. That the counted file is a failed PDF is SUSPECTED (FLOW did not run a scan).
- Files to change:
  - apps/web/src/pages/legal/LegalContracts.tsx:162-169 (size Value and Next deadline to content with auto widths; give Contract, Term and Renewal the rest; shorten the Term format to 'Dec 2025 - Dec 2026' or let two cells wrap to two lines)
  - apps/web/src/pages/Legal.tsx:300-314 (make the row a link to the Data room filtered to unchecked or failed files, or move the count into the header meta line)
  - test: Legal contracts table at 1440 has no truncated Renewal
- Reach: Everyone who opens Legal; five walkers hit the truncation. The cut text is the notice period a founder needs. Reopens a criterion that failed in pass 16 and pass 17.
- Acceptance criteria:
  - At 1440 no contract name, Term or Renewal text is cut ('Auto-renews, 30 days notice' fully readable) while Value and Next deadline are sized to content.
  - The unchecked-documents line either links to the Data room list of those files or is plain text in the header meta; it has no button-like border without an action.
  - Legal still shows exactly one scan button.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C3 [P2] Finance Cash card says '5 bank accounts - 1 not counted', but the 1 is a non-USD transaction, so Maya looks for a sixth account
- Rank: 3. Effort: S. Reopens: iteration-17 C3.
- Finding ids (found by): J1-02 (J1), R1-18-05 (R1), FLOW-03 (FLOW)
- Root cause: Pass 17 made the note visible but the number comes from excludedNonUsdCount(txns), a count of transactions, and is printed directly after the bank-account count. The Accounts page lists five accounts, all counted, so there is nothing to find. Cash itself is correct ($1,633,221 matches the Accounts sum).
- Verification: Code CONFIRMED: apps/api/src/finance.ts:547 excludedNonUsdCount(txns) counts transactions; Finance.tsx:545 appends it to the cash subtitle. J1 OBSERVED; R1 passed the pass-17 wording criterion but raised R1-18-05 on the same confusion.
- Files to change:
  - apps/web/src/pages/Finance.tsx:545 (say '1 non-USD transaction not counted' and attach it to the sync line, not the Cash subtitle)
  - apps/web/src/pages/Finance.tsx:441-447 (same wording in the sr-only text and tooltip)
  - apps/web/src/pages/Finance.tsx (Out so far this month strip: label 'Out Oct 1-22, month not over' so it does not look like a second burn figure, FLOW-03)
- Reach: Everyone with a non-USD transaction who reads runway; the Cash tile is the first number on the first Finance screen.
- Acceptance criteria:
  - The Cash subtitle contains no 'not counted' count that is a different unit from the account count.
  - A non-USD transaction note names the unit ('transaction') and is visible without hover.
  - The month-to-date strip says it is a partial month.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C4 [P2] Investors can still show 'Equity raised' as a dash on the first visit while Fundraising lists a funded SAFE
- Rank: 4. Effort: S. Reopens: iteration-17 C2.
- Finding ids (found by): J2-02 (J2), J2-14 (J2)
- Root cause: safesList now waits for the throttled Mercury sync (PAGE_SYNC_MS 20 s, fundraising.ts:70-74), but Investors.tsx:766-775 reads safes and capTable in parallel and shows a dash when equityRaisedUsd is null with no loading state. A cold sync longer than the wait, or a slow first request, leaves the dash until a later visit. R1 could not run the fresh-user path (Mercury connect popup stuck on Loading), so the failure is not reproduced on the merged code.
- Verification: J2 OBSERVED on the merged code (host load average 55-215). Cause SUSPECTED (cold sync longer than the wait). R1 could not verify. J2-14 (unlinked contact) is P3 and folded in as a note only.
- Files to change:
  - apps/web/src/pages/Investors.tsx:161-162 and 759-775 (show a loading state, not a dash, until the first safes.list resolves; refetch once when the sync reports finished)
  - apps/api/src/fundraising.ts:70-74 (if the sync outlives the wait, return a 'syncing' flag the page can use)
  - test: Investors summary with safes still loading shows no dash
- Reach: Every founder with Mercury connected who opens Investors before Fundraising. Investors was judged for P0/P1 only; this is a reopen of a pass-17 cluster, so it is allowed. Rated P2 because it self-corrects on the next visit and only appeared under heavy load.
- Acceptance criteria:
  - On a fresh session the Equity raised tile shows a loading state until the first SAFE list answers, then the same figure Fundraising shows.
  - Mercury down or slow never leaves a permanent dash without an error or retry.
  - Two loads inside the throttle window start one sync.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C5 [P2] Data room list: Type and Parties still truncate, a failed file shows no visible Try again, and one failure is stated three times; the sidebar failed count lags
- Rank: 5. Effort: M. Reopens: iteration-17 C5, C6.
- Finding ids (found by): R1-18-02 (R1), V3-02 (V3), V3-10 (V3), J2-03 (J2), J2-09 (J2)
- Root cause: Columns() keeps fixed widths (Type w-24, Status w-20 for a mostly empty column), so Type 'Investor docu...' and Parties cut at 1440 while Status holds 80 px. For a failed file the visible controls are the red reason, a 'Failed' pill and Type 'Unreadable' (three statements), the only visible action in grid view is Delete, and 'Try again' sits in the hover-only menu. The sidebar failed count comes from a separate data source that is not refreshed after upload, retry or delete.
- Verification: R1, V3, J2 OBSERVED. Code CONFIRMED for the fixed columns (ItemRows.tsx:206-212). The count-lag cause (J2-03) is not traced. The 40 px row criterion from pass 17 cannot hold because rows carry a folder-path subtitle (56 px); drop that criterion.
- Files to change:
  - apps/web/src/components/data-room/ItemRows.tsx:200-213 (widen Type to fit 'Investor document'; move the Failed pill into the Name cell or drop the Status column when no row has a status; give Parties the freed width)
  - apps/web/src/components/data-room/ItemRows.tsx and the grid card (visible 'Try again' on failed rows and cards; Delete only in the menu; show Type 'Unreadable' only when not failed)
  - apps/web/src/components/sidebar-glance.tsx and the Shell data source for the failed count (refetch after upload, retry, delete)
  - apps/web/src/components/data-room/PreviewActions.tsx or Preview (close the preview after Delete instead of jumping to the next failed file)
- Reach: Everyone who uploads to the Data room; failed files are reached from the red badge, so the badge count and the row action are the whole recovery path.
- Acceptance criteria:
  - At 1440 Type and Parties are not cut for the seeded rows; the empty Status column takes no width.
  - A failed row and a failed grid card show one failure statement and a visible 'Try again'; Delete is in the menu.
  - After uploading a failing file and after deleting one, the sidebar count equals the number of Failed rows without a reload.
  - Deleting a file from the preview closes the preview.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C9 (PreviewActions.tsx), C20 (PreviewActions.tsx)

### C6 [P2] Sidebar on short screens: Activity 'Needs you' list is a 76 px peephole, and a waiting approval is hidden in a collapsed group
- Rank: 6. Effort: S. Reopens: iteration-17 C16.
- Finding ids (found by): V3-01 (V3), R2-02 (R2), FLOW-04 (FLOW), J2-11 (J2), V1-12 (V1)
- Root cause: ActivityList.tsx:179 caps the block at max-h-[40%] of a small parent (76 px of 393 px content at 1440x900 with the Pages block open), so one of four approvals shows and the next is cut in half; the 'Page agents' group is collapsed and its 'Needs your answer' child is under the bottom fade with no badge on the group. At 800 px high only 4 chat rows fit; at 720 px three, with no '+N more' cue. The pass-17 criteria (6 rows at 800, +N more cue) were not met.
- Verification: OBSERVED by V3 (clientH 76, scrollH 393), R2, FLOW, J2. Code CONFIRMED: ActivityList.tsx:179 `max-h-[45vh] lg:max-h-[40%] short:lg:max-h-none`. This reopens pass-17 C16.
- Files to change:
  - apps/web/src/pages/ActivityList.tsx:179,209 (show every 'Needs you' row, or at least three, before the cap; add '+N more')
  - apps/web/src/pages/Shell.tsx sidebar (collapse the Pages block when Activity is open or on short screens; badge the collapsed Page agents group when a child needs an answer; cap chats per space with 'Show N more')
  - apps/web/src/pages/shell/ mobile drawer: let the tour card sit below the list (V1-12, optional)
  - test: sidebar with 4 pending approvals shows 4 rows
- Reach: Every desktop user on a laptop screen with pending approvals; V3 measured the same peephole at 1920x1080. Rated P2 (V3 said P1) because the toast, the chat row and the phone drawer still show the approvals.
- Acceptance criteria:
  - With Activity open at 1440x900 and 4 approvals waiting, all 4 'Needs you' rows are visible without an inner scroll.
  - At 1280x800 the chat list shows at least 6 rows or a '+N more' line; at 720 high a '+N more' cue is present.
  - A child needing an answer puts a visible badge on its collapsed group.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C1 (approval badge), Shell.tsx (shared)

### C7 [P2] Mail approval card does not show which account will send; a send can fail with only an 'Open Inbox agent' link
- Rank: 7. Effort: M.
- Finding ids (found by): V2-04 (V2)
- Root cause: After Send the originating chat said the email 'was not sent because a mail account must be chosen'. The card never showed a From account or a chooser, so the failure was predictable, and the failure message gives no control to fix it. The pass-16 'acct:' strings were removed deliberately, so the choice must live on the card, not in text.
- Verification: V2 OBSERVED once on a shared demo account; the failure string was not located in code in this pass (SUSPECTED in the send tool). Compatible with the pass-16 plain-words decision.
- Files to change:
  - apps/web/src/components/MailApprovalCard.tsx (From line; chooser when more than one mail account)
  - failure message for the send tool (name the missing choice, offer the chooser inline)
- Reach: Anyone with two or more connected mailboxes who approves a mail send; money-adjacent core journey.
- Acceptance criteria:
  - The approval card names the sending account.
  - With two accounts, the person can pick the account before Send.
  - If a send still cannot proceed, the chat message has a button that fixes it, not only a link.
- Needs product decision: true. Should the approval card let the person choose the sending account when more than one is connected (recommended), or should the agent always ask in chat first?
- Depends on: none. Conflicts (shared files): C1 (approval toasts)

### C8 [P2] First mail sort: 86% of mail lands in Needs reply, the mail list re-groups and rows jump after about 20 s, and blank bars sit beside the consent card
- Rank: 8. Effort: M. Reopens: iteration-17 C9.
- Finding ids (found by): R1-18-03 (R1), J3-01 (J3), R1-18-06 (R1), J1-06 (J1)
- Root cause: The demo triage puts 19 of 22 sorted mails (86%) in Needs reply (criterion: under 40%). While sorting, the list shows an interim Today/Earlier list that is tappable, then re-groups into To do plus Needs reply, so a tap can land on a different mail (J3-01). Before consent the page shows five blank skeleton bars for over 10 s. Chief's first answer arrives as two messages about 20 s apart.
- Verification: R1 and J3 OBSERVED. Classifier cause SUSPECTED: the demo model is scripted (iteration-17 J1-05/J1-06 notes); a real-model run is needed to call the threshold a product defect. Row jump seen by J3 at 375.
- Files to change:
  - apps/api inbox triage prompt/threshold and demo fixture (Needs reply only for mail that asks the user something)
  - apps/web/src/pages/Inbox.tsx (keep rows non-interactive or hold the list until the sort result arrives; no blank skeleton bars before consent, show the mail rows instead)
  - agent first-answer wording (say that mail is being sorted and a reply follows)
- Reach: Every new user's first Inbox visit. Time to groups (15-20 s) and the wait note (5 s) now meet the pass-17 criteria.
- Acceptance criteria:
  - Under 40% of a 28-mail mailbox lands in Needs reply on the demo.
  - During sorting no row moves under the pointer; taps open the mail that was tapped.
  - Before consent the list shows mail rows or nothing, not blank bars.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C14 (Inbox.tsx)

### C9 [P2] Slow loads leave dead ends: mail dialog and agent chat with no toolbar or header, no retry; invisible skeletons shift Settings; Data room preview shows a bare skeleton
- Rank: 9. Effort: M.
- Finding ids (found by): J1-01 (J1), V2-02 (V2), V1-01 (V1), J3-02 (J3), V3-11 (V3), V2-09 (V2), V1-07 (V1), J2-13 (J2)
- Root cause: Several first frames render without the navigation or action controls they could take from data already on screen: the mail dialog shows a blank body with no Reply/Archive for over 10 s and no retry (InboxMessageDialog.tsx:277-293, skeleton aria-hidden and faint); a chat opened by URL shows no menu button until the thread loads; the Settings Privacy 'AI data sharing' skeleton is invisible on the card colour and the next card jumps 60 px (AiDataSharing.tsx:346-347); the Data room preview shows a grey skeleton while file.url is empty (PreviewActions.tsx:98-104); Legal and bot Skills skeletons do not match the loaded shape. All were seen while host load average was 55-215, so duration is an upper bound.
- Verification: Each OBSERVED once by one walker under load; V3-11 and J3-02 timing is SUSPECTED to be the unbundled dev server and should be re-measured on a production build before acting on duration. Code CONFIRMED for the mail dialog skeleton and the preview skeleton lines.
- Files to change:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx:277-293 (show Reply/Archive/Ask agent from the list row immediately; 'Still loading... Try again' after about 5 s)
  - apps/web/src/pages/shell chat header (render menu button and title while the thread loads)
  - apps/web/src/components/AiDataSharing.tsx:346-347 (visible skeleton with the final height of the switch and link rows)
  - apps/web/src/components/data-room/PreviewActions.tsx:98-104 (show the phone Open/Download fallback and a 'Still opening' line instead of an endless skeleton)
  - apps/web/src/pages/shell/BotSkillsSection.tsx and Legal skeleton (final-height placeholder; one line 'No skills yet' for the empty Skills box)
- Reach: Anyone on a slow connection or a loaded server, on the three most used surfaces (mail, chats, Data room). Duration is environment-dependent and is not claimed as a defect; the missing controls and retry are.
- Acceptance criteria:
  - Opening a mail whose body has not loaded shows Reply and Archive within one frame and a retry line by 5 s.
  - A chat opened by URL shows its header and menu button while loading.
  - Settings > Privacy: no layout shift greater than 8 px when the switches load.
  - The Data room PDF preview on a phone shows Open and Download at once.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C5 (PreviewActions.tsx)

### C10 [P2] Integrations: connected cards still differ (menu only on Blockscout and Coinbase), name buttons are 24 px on touch, letter tiles and a repeated 'Connected' pill look unfinished
- Rank: 10. Effort: S. Reopens: iteration-17 C21.
- Finding ids (found by): R3-01 (R3), V1-02 (V1), R3-02 (R3), V1-03 (V1), V1-04 (V1)
- Root cause: TileMenu exists only in FinanceSection.tsx (Blockscout, Alchemy, exchanges), so Gmail, Carta, Mercury and Brex have no actions menu. The card name buttons are 24 px tall under a coarse pointer (owner decision is 44 px). Several apps use a grey letter tile (Carta, Treg, Devin, Granola, Wispr Flow, iMessage), and every card under 'CONNECTED' also carries a green 'Connected' pill.
- Verification: R3 and V1 OBSERVED (V1 with real coarse emulation). Code CONFIRMED: TileMenu used only at FinanceSection.tsx:122,167,242. Reopens the pass-17 C21 criterion 'same actions row'.
- Files to change:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (same actions row on every connected card; name target at least 44 px under pointer: coarse; drop the Connected pill inside the Connected section)
  - apps/web/src/components/integrations/FinanceSection.tsx:46,122,167,242 (move TileMenu into the shared tile)
  - apps/web/src/components/integrations/AppLogo.tsx (vendor a Carta mark; one neutral glyph for remaining letter fallbacks)
- Reach: Everyone who opens Integrations (account menu and sidebar footer); touch users for the target size.
- Acceptance criteria:
  - Every connected card has the same actions menu or none does.
  - Card name targets measure at least 44 px high with pointer: coarse.
  - Connected cards show a status pill only when the state is not Connected.
  - Carta shows a logo, not a letter.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C11 [P2] Legal agent tells Maya email is not connected when Gmail is connected; Ask agent from Deadlines shows no sent message or thinking cue
- Rank: 11. Effort: M.
- Finding ids (found by): J2-04 (J2), J2-05 (J2)
- Root cause: The Legal agent answered a notice question with 'I can't send the notice ... because email isn't connected. Open Integrations' while Integrations shows Gmail connected: its tool set has no send tool and its prompt blames the connection. Ask agent opens the panel on the old conversation; the sent question was not visible for 4 s and appeared by about 10 s, with no sending cue.
- Verification: J2 OBSERVED; agent text cause UNVERIFIED (J2 did not open the prompt); the scripted demo model may produce the wording. Panel delay observed once.
- Files to change:
  - Legal agent prompt/tool set (apps/api legal agent definition: say it cannot send mail and point to the Inbox agent, or hand off through the approval card)
  - apps/web/src/pages/Legal.tsx Ask agent handler and panel mount (show the sent message at once, scrolled into view, with the thinking row)
- Reach: Everyone who asks the Legal agent about a deadline notice (Legal journeys STORY-LEG-011/016).
- Acceptance criteria:
  - The Legal agent never says email is not connected when Gmail is connected.
  - After Ask agent, the question appears in the panel within 1 s with the usual thinking row.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C12 [P2] Mercury page: after 'Allow changes', 'Let other agents use Mercury directly' is also on and nothing says approvals still apply to every agent
- Rank: 12. Effort: S.
- Finding ids (found by): J2-15 (J2)
- Root cause: Turning on Allow changes also leaves the second switch on and shows a 13-row Used-by list. The page does not say whether another agent that is switched on can move money without the approval card. Behavior was not verified.
- Verification: OBSERVED defaults by J2; behavior UNVERIFIED. Treat as security-sensitive and verify in code before changing copy.
- Files to change:
  - apps/web/src/components/integrations (Mercury detail page; one line: every change still asks first, or default the second switch off after enabling changes)
  - apps/api approval enforcement for tools used by other agents (confirm every write asks; add a test if not)
- Reach: Anyone connecting Mercury with writes on. Money safety copy, not a visual issue.
- Acceptance criteria:
  - The Mercury page states in one line that approvals apply to every agent.
  - A payment requested through another agent raises the same approval card (verified by test).
- Needs product decision: true. After Allow changes is turned on, should 'Let other agents use Mercury directly' stay on by default or start off? Recommended: start off until the person turns it on.
- Depends on: none. Conflicts (shared files): none

### C13 [P2] Bot settings panel and Routines: lone 'computer' label over an empty panel, remove button covers the day select, run history shows prompt text
- Rank: 13. Effort: S. Reopens: iteration-17 C19.
- Finding ids (found by): J2-07 (J2), J2-08 (J2), J2-12 (J2), V1-08 (V1), V1-09 (V1), V1-10 (V1), J2-10 (J2)
- Root cause: The empty Routines panel for a new bot still renders a label "<bot>'s computer" with nothing under it (chronic since iteration 11). In the routine schedule row the remove x sits on top of the day-of-week select chevron. Run history shows the internal prompt ('For the user's test run of the ...') instead of the routine name or result. Smaller items: sticky 'Chief settings' header cuts text with no separator, 'Turn off a tool' select reads like a button, mixed row heights in the Create menu, suggestion chips sit outside the composer column.
- Verification: OBSERVED by J2 and V1; routine-row component locations not traced.
- Files to change:
  - apps/web/src/pages Routines panel computer section (hide the label when there is no computer content)
  - routine schedule row component (move remove outside the select or reserve its width)
  - routine run history row (show the routine name or first line of the result)
  - apps/web/src/pages/shell/bot-panel.tsx:800 and sticky header (border when scrolled; placeholder 'Choose a tool')
  - apps/web/src/pages/shell/bot-picker.tsx:60-100 (one row height); chat empty-state suggestions align with the composer
- Reach: Anyone creating a bot or routine. R2 passed the pass-17 C19 criteria on an existing bot, J2 found the label on a new one, so the condition is 'no computer content'.
- Acceptance criteria:
  - A new bot's empty Routines panel has no heading with nothing under it.
  - In the schedule row the remove control does not overlap the select chevron.
  - Run history rows show the routine name or result text.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C14 [P2] Chat message toolbar is clipped by the settings panel; reply composer has two formatting controls; small Inbox alignment and count mismatches
- Rank: 14. Effort: S.
- Finding ids (found by): V2-03 (V2), J1-07 (J1), V2-11 (V2), V2-14 (V2), J1-03 (J1), V2-16 (V2), R2-03 (R2), R2-04 (R2), R1-18-07 (R1)
- Root cause: In a chat with the settings panel open, a wide Mail card plus its side toolbar run into the panel edge and the More button is cut off. Smaller items: the reply composer opens with the toolbar shown and a second 'Formatting options' button beside Send; 'Show 15 more' starts 11 px right of group headings; Legal and Finance headers at 375 start at x=25/46 while content starts at 16/30; Unread filter says 12 results while the badge says 11 (one is Archived); a sidebar chat preview begins with an unlabeled flag glyph; Investors says 'No draft made, see Ask' while Ask is hidden, and the Drafting button is disabled instead of opening the panel; sign-up with a taken email marks Password red too.
- Verification: All OBSERVED once; V2-03 measured at x about 960-1055 with last button clipped. Sub-items are P3, the cluster is P2 because of V2-03. Investors items are lowest priority (page owned by another session).
- Files to change:
  - apps/web/src/pages/shell/transcript.tsx message row (place the toolbar under the card when the column is narrow)
  - apps/web/src/components/inbox composer (hide the toolbar until the T button is pressed)
  - Inbox 'Show more' padding; SpaceName padding; Finance period tab container
  - Inbox Unread filter strip (count or label archived mail)
  - Investors action items row (copy 'see the Investors agent chat'; keep Drafting enabled and open the panel)
  - sign-up form (mark only the field named in the error)
- Reach: Most users meet at least one of these; none blocks a journey except the clipped More button (P2).
- Acceptance criteria:
  - With the settings panel open, the More button of the newest Mail card is fully visible.
  - The reply composer has one formatting control.
  - 'Show N more' text aligns with the group heading text edge.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C8 (Inbox.tsx), C4 (Investors.tsx)

### C15 [P2] Finance charts and headers: Burn 'Where it went' uses seven near-identical grays; overlapping rings; unlabeled Financing ring; summary card leaves an empty band
- Rank: 15. Effort: M. Reopens: iteration-17 C13.
- Finding ids (found by): V2-06 (V2), R2-05 (R2), R2-06 (R2), V2-12 (V2), V2-15 (V2), J1-04 (J1)
- Root cause: The Burn page stacked bar and its legend squares are seven similar grays, so segments cannot be matched to rows, and the same data is drawn twice (stacked bar plus row bars). Smaller: Out and Revenue rings end 8 px apart at Oct*, the Quarter view draws an unlabeled Financing ring, the Accounts/Burn header card is 170 px wide with an empty band, row bars disappear when amounts are hidden, and the Runway page shifts 8 px when Count crypto is on and drops the '1 unpriced' caveat.
- Verification: OBSERVED by V2, R2, J1. Color-only encoding judged against the repo's dataviz and token rules; tokens are monochrome by design, so the fix is labels or one encoding rather than new colors.
- Files to change:
  - apps/web/src/pages/finance Burn breakdown component (keep one encoding with the label next to the mark)
  - Finance chart and Burn detail chart (offset or merge the Oct* markers; label the Financing ring in Quarter view)
  - Finance sub-page header (put the figure in the header row)
  - apps/web/src/pages/finance/FinanceRunway.tsx (reserve the crypto dropdown height; repeat '1 unpriced')
- Reach: Anyone who opens Finance sub-pages; the breakdown is where burn is explained to a board.
- Acceptance criteria:
  - Each Burn breakdown row can be matched to its segment without reading text.
  - No two markers overlap at the current month.
  - Toggling Count crypto moves nothing by more than 1 px.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C16 [P3] Cold load still calls bots/list about 2.5 times (AppToaster reads it per notification); Fundraising and Artifacts never go idle
- Rank: 16. Effort: S. Reopens: iteration-17 C22.
- Finding ids (found by): R3-05 (R3), R2-09 (R2)
- Root cause: AppToaster's avatarFor calls rpc.bots.list() for every notification toast (AppToaster.tsx:57), on top of the sidebar and integrations reads. Fundraising and Artifacts keep polling so network-idle never settles.
- Verification: Request counts OBSERVED by R3; AppToaster.tsx:57 CONFIRMED; the other two call sites are SUSPECTED. Not filed as slowness because host load was 55-215.
- Files to change:
  - apps/web/src/components/AppToaster.tsx:57 (read bots from the shared bootstrap/sidebar data)
  - apps/web/src/components/integrations/useIntegrations.ts:111
  - Fundraising and Artifacts polling (back off or stop when hidden)
- Reach: Every cold load; cost is requests, not visible delay.
- Acceptance criteria:
  - Cold load of /app/gtm and /app/artifacts makes at most 2 bots/list calls (counting StrictMode as one).
  - Fundraising idles within 5 s on a quiet account.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C17 [P3] Keyboard: composer is 27 Tab stops from the header; full-screen PDF preview needs two Escapes; focus lands on the wrong element after the palette and contact dialog close
- Rank: 17. Effort: S. Reopens: iteration-17 C23.
- Finding ids (found by): R3-03 (R3), R3-04 (R3), V3-07 (V3), V3-14 (V3), V1-13 (V1), V2-17 (V2)
- Root cause: Each message adds a 'More' button as a tab stop and there is no skip-to-composer; the full-screen preview iframe takes focus so the first Escape is ignored and initial focus is on 'Open in new tab'; closing Cmd+K on a phone by tapping outside puts focus on 'Skip to content'; closing the contact edit dialog by mouse then Escape focuses 'Add contact'; focus rings on chips are 1 px translucent; the Create menu stays open after a keyboard selection.
- Verification: R3 OBSERVED (27 Tab presses, down from 59; Escape twice reproduced twice); others observed once.
- Files to change:
  - apps/web/src/pages/Shell.tsx message action buttons (roving tabindex or skip-to-composer)
  - apps/web/src/components/data-room/PreviewActions.tsx full-screen dialog (focus Close first, Escape on first press)
  - apps/web/src/pages/shell/command-palette.tsx close handler; Contacts row; shared Button focus style; bot-picker.tsx
- Reach: Keyboard and screen-reader users.
- Acceptance criteria:
  - The composer is at most 10 Tab presses from the header on a 30-message chat.
  - One Escape closes the full-screen preview.
  - Closing the palette returns focus to a sensible element, not Skip to content.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C18 [P3] Command palette: 48 px rows push Chats below the fold, bracket-shaped selection, 'No matches' beside a Search mail action, GTM listed twice
- Rank: 18. Effort: S.
- Finding ids (found by): V3-04 (V3), V3-05 (V3), V3-06 (V3), R2-08 (R2)
- Root cause: Result rows are 48 px for a one-line label, so 8 of 11 Pages fit before Chats; the selected marker is a curved 2 px border; 'No matches' sits above a highlighted 'Search mail for ...' row; 'gtm' returns the GTM page and the GTM agent bot.
- Verification: V3 and R2 OBSERVED. Hiding the GTM bot row is an owner call (pass-16 C5 added GTM to Cmd+K deliberately).
- Files to change:
  - apps/web/src/pages/shell/command-palette.tsx (about 36 px rows for single-line results; background selection; wording)
- Reach: Everyone who uses Cmd+K.
- Acceptance criteria:
  - All 11 Pages fit in the first view at 900 px high.
  - No 'No matches' line while a search action is shown.
- Needs product decision: true. Should the 'GTM agent' bot row be hidden from Cmd+K because the GTM page already opens it?
- Depends on: none. Conflicts (shared files): none

### C19 [P3] Settings, Models and copy polish: Memory has no card, three disclosure markers, no selected provider, 'tokens' wording, display choices in General
- Rank: 19. Effort: S.
- Finding ids (found by): R1-18-04 (R1), V1-11 (V1), V1-05 (V1), V1-06 (V1), V1-14 (V1), FLOW-05 (FLOW)
- Root cause: Settings Memory is bare text while General, Privacy and Models are carded; Models mixes a chevron, the native triangle and a right chevron, and no provider row is selected; Usage says '33,071 tokens of AI text'; General holds Theme, Sidebar density and Avatars ahead of 'Chat display'.
- Verification: OBSERVED. The Memory fixed height is an earlier owner decision (not re-raised); only the missing card is. FLOW-05 moves display choices and touches the 'five sections' decision lightly: implement only if the owner agrees.
- Files to change:
  - apps/web/src/pages/MemorySettingsOverlay.tsx:192 (wrap in the shared card)
  - apps/web/src/pages/ModelSettingsOverlay.tsx:1585 (shared chevron disclosure; mark the active provider)
  - apps/web/src/pages/AccountSettingsOverlay.tsx:402 (drop 'tokens')
- Reach: Everyone who opens Settings; none blocks a task.
- Acceptance criteria:
  - Memory content is in the same card as the other sections.
  - Models uses one disclosure marker and marks the active provider.
  - Usage shows no unexplained unit.
- Needs product decision: true. Move Sidebar density and Avatars under the 'Chat display' row so General opens with Theme, Language, Notifications?
- Depends on: none. Conflicts (shared files): none

### C20 [P3] Artifacts, Legal graph, Investors list and Contacts visual density
- Rank: 20. Effort: M.
- Finding ids (found by): V3-12 (V3), V3-13 (V3), V2-13 (V2), V2-10 (V2), FLOW-02 (FLOW), J3-03 (J3), V3-09 (V3), V3-08 (V3)
- Root cause: Artifacts cards are about 150 px tall for one line of text and rows change from 41 to 110 px between list and split views; at 1920 the list leaves a 1300 px gap between Name and Type; the Legal graph has crossing edges. Investors, Fundraising and Contacts hold three investor lists with three 'add' buttons (FLOW-02); an unlinked SAFE contact shows a dash (J2-14). Phone Data room hides view toggles and moves Filters in Stats; the PDF fallback duplicates Open and Download.
- Verification: OBSERVED once each. FLOW-02 (seed the pipeline from Contacts) is a product change and recorded here only.
- Files to change:
  - apps/web/src/pages/Artifacts.tsx (shared row height, content max-width about 1100 px, keep the toggle)
  - Legal graph layout (sort the contract column by company)
  - apps/web/src/components/data-room/PreviewActions.tsx PdfPhoneFallback (drop either the header icons or the body buttons)
  - apps/web/src/components/data-room/FilterBar.tsx:432-452 (Filters in one place)
- Reach: Occasional; Investors/Fundraising items are lowest priority per owner limit.
- Acceptance criteria:
  - Artifact list row height is the same in list and split views.
  - The phone PDF fallback shows Open and Download once.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C9, C5 (PreviewActions.tsx)

## Deferred items (not in a cluster)
- J1-05 tour starts while a Gmail connect is mid-action (P3): matches the decided rule (tour starts once one app is connected); dropped.
- V2-05 tour card covers the lower sidebar at 900 px high: fixed card spot is an owner decision; only the side effect recorded.
- V2-07 Legal Deadlines three buttons per row: decided (Ask agent / Done / Dismiss).
- J3-05 account-menu, 404 and Finance 'Accounts' link measure 32 px under injected CSS: unverified because Tailwind pointer-coarse variants were not emulated; re-test with real touch.
- J2-16 insurance Dec 1 vs Dec 2: demo seed data.
- J2-14 unlinked SAFE contact and FLOW-02 three investor lists: Investors/Fundraising are limited to P0/P1; noted in C20.
- R3 C21 Done-focus-on-card: BLOCKED (needs a real Connect flow); Carta tile is in C10.
- R3-C24 Loading card theme tokens: met by code (InboxMessageDialog.tsx:603), not seen on screen.
- V3-11 deep-link load of 9-10 s: suspected dev-server artefact; re-measure on a production build (in C9).
- J1-06 first answer in two messages: folded into C8; check on a real model.

## BLOCKED stories
- STORY-APP-001/319/309 model step and Connect your apps (demo has a model and configured apps); STORY-CAP-017/106 Carta connect; Gmail/Calendar/Brex/Box/Slack/Notion OAuth; STORY-FIN-022 bank reconnect; Mercury connect popup (stayed on Loading, blocks the fresh-user Investors check).
- STORY-INB-109 steps 3-18 (no spam, Cleanup empty, Digest bulk archive left untouched on shared data); STORY-DRM-019/020/021/109/121 (imports, diligence request, zip, large files).
- Pass-17 C17 stuck Reading text; C13 44 px chart targets (no pointer: coarse in some tools); 83-character bot name (would create a bot on shared demo); phone widths for Legal, Investors, GTM; light theme; keyboard-only full runs.

## Counts by severity

- Clusters: P0 0, P1 1, P2 14, P3 5 (20 clusters).
- Raw findings (before dedupe): R1 7, R2 10, R3 5, J1 7, J2 16, J3 5, FLOW 5, V1 14, V2 17, V3 14: 100 findings; 3 reported P1 (J2-01, J2-02, V3-01), 0 P0. After checking: 1 P1 cluster.
