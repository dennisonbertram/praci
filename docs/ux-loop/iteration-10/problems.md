P0: 1, P1: 6, P2: 10, P3: 9

# Iteration 10 problems: fix clusters

Sources: R1-R3 (verify pass-9 clusters C1-C31), J1-J3 (journeys), FLOW, V1-V3, on the mock demo stack (web 5381, checkout e9f20fed9). Read: docs/ux-flow/report.md, docs/ux-visual/problems.md, iteration 1-9 problems.md. Claims were checked against the code where cheap; each cluster says observed or suspected.

Owner decisions respected and not raised: tour stays nine stops; Devin hidden until connected; the page is called Integrations and keeps its sidebar and account-menu rows; consent asked once per area; 44 px on coarse pointers; Hide amounts is a stable checkbox row in the account menu; Settings in five sections with Memory under Advanced; palette is the one search surface; Legal row actions Ask agent / Done / Dismiss; approval toasts persist until dismissed; no model step in onboarding on the demo; Personal and New space hidden for a solo account.

Environment: shared mock founder account and a busy stack; other walkers changed chat state, consent and bot settings during the walks. Load times are not evidence.

## Pass-9 clusters verified (R1-R3)
Met: C2 (status card), C3 (Chief and Mercury, two of three states), C9 (phone row actions), C10 (single-space heading), C11 (drawer Search), C12 (Data room on phone, zoom unverified), C13 (bot panel, one strip left), C15 (Mercury page), C18 (free text with open ask), C21 (Finance header and runway), C23 (Storybook 1705/1705), C24 (Settings nav), C25 (Integrations chips), C27 (focus styles), C31 (rail mode). Met with one open item: C1 (toasts; routing, reload and placement items below), C26 (tour placement only).
Not met or partly met and reopened: C1 -> C2/C8, C4 -> C4 (new), C5 -> C9, C6 -> C18, C7 -> C10, C8 -> C11, C12 -> C22, C13 -> C19, C14 -> C15, C16 -> C6, C17 -> C14, C19 -> C12, C20 -> C13, C24 -> C20, C25 -> C21, C26 -> C23, C28 -> C26, C29 -> C22, C30 -> C13. C22 (payment button) is BLOCKED (no payment card on the demo); code confirmed.

## Clusters (ranked: P0, then P1, then severity x reach / effort)

### C1 A money approval may resolve without a click, and one payment request can leave two live approval cards (P0, rank 1, effort M)
- Root cause: Suspected, not reproduced. A payment raised by a peer run (Chief messages the Mercury agent) is paused in packages/adapters/src/executor.ts near 3990-4010 (pauseRunForInput, then notifyRun). On run resume the approval is re-issued instead of reusing the pending card, which produced a second live card for one $300 request; and in one walk a $1,200 card read Approved with no click, after Chief relayed the user's 'Yes, pay ...' text. If relayed text counts as approval, that is a money-safety bug. P0 stays only until a clean single-user repro either confirms or clears it; if it clears, J2-03 alone keeps the cluster at P1.
- Findings: J2-04, J2-03
- Found by: J2-04 [J2]; J2-03 [J2]
- Verification: Suspected. Not seen by any other walker (R1 and J3 approved a $1,200 card by clicking and saw normal behaviour). Code read: the pause path exists at executor.ts:3990-4010; the re-issue and relay handling were not traced. packages/adapters/src/executor-approval-replay.test.ts already exists and is the place for a failing test.
- Files:
  - packages/adapters/src/executor.ts (approval pause and resume near 3990-4010; reuse the pending card on resume, mark superseded cards unusable, a denial of a stale card must not rewrite an approved outcome)
  - packages/adapters/src/executor-approval-replay.test.ts (failing regression first: relayed 'Yes, pay' text does not resolve a money card; resume does not create a second live card)
  - apps/api approval resolution path (only an authenticated click or approve call resolves a money card; locate with grep for the ask-resolve route)
- Reach: Anyone who lets an agent pay a bill. Wrong result is a duplicate or unapproved payment.
- Acceptance criteria:
  - Failing test first: a Chief-relayed user message never resolves a payment approval card; only the card's Send does.
  - One payment request produces exactly one live card across a page reload and a run resume; an older card reads 'No longer active' and cannot be pressed.
  - Denying a superseded card does not change the recorded outcome of the approved one, and the agent's final message matches the real outcome.
  - Repro walk with one user on a clean thread: ask Chief to pay $300 to a known recipient, navigate away mid-run, return: one card, one decision, one result message.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: none

### C2 The approval toast opens or clears the wrong chat, vanishes after a reload, and the next card slides under the pointer (P1, rank 2, effort S)
- Root cause: apps/web/src/lib/approval-toasts.ts keys each toast by toast.href (one chat id, line 70-72). notifyRun in packages/adapters/src/executor.ts:4004 passes the peer run's thread, so a Mercury approval raised for Chief links to Chief, where no card exists; opening the Mercury chat never matches that key, so the toast stays. The same string compare misses per-email chats (email agent panel). The map lives in memory, so a reload shows no toast for a live card. After an approval is answered the next card renders in the same screen position with live buttons.
- Findings: J2-02, J2-11, J2-10, J3-03, R1-08
- Found by: J2-02 [J2]; J2-11 [J2]; J2-10 [J2]; J3-03 [J3]; R1-08 [R1]
- Verification: J2-02 and J3-03 observed. Code confirmed: approval-toasts.ts:70 keys by toast.href and dismissApprovalToasts(chat) compares that string only; executor.ts:4004 passes threadId of the run that holds the pause. R1 saw the toast still present 3 s after answering (partly met). J2-11 and J2-10 observed once each, cause read from code only (in-memory pending map).
- Files:
  - packages/adapters/src/executor.ts (notifyRun near 4004: pass the bot and thread that hold the card)
  - apps/web/src/lib/approval-toasts.ts (match the open chat by bot and thread, including per-email chats; rebuild pending toasts from unanswered approvals on load)
  - apps/web/src/components/AppToaster.tsx
  - approval card component (disable Send and Deny for about 1 s after a new card replaces one in place)
  - apps/web/src/lib/approval-toasts.test.ts
- Reach: Everyone who approves anything from a bot other than the one they are talking to; most money approvals.
- Acceptance criteria:
  - A toast raised for a peer run opens the chat that holds the card in one tap.
  - Opening that chat, or answering the card in a second tab, removes the toast within 2 s.
  - Opening an email agent chat removes the toast for that email's card.
  - Reload with a pending approval shows one toast again.
  - A card that appears where a decided card was has disabled buttons for 1 s.
- Needs product decision: false
- Depends on: none
- Conflicts with: C8 (same approval-toasts.ts and AppToaster.tsx; do C2 first, then C8)
- Reopens: iteration 9 C1 (removal within 2 s was only partly met)

### C3 Settings says AI is allowed while Inbox, Legal and agents say it is not, and the agents link to Integrations for the fix (P1, rank 3, effort S)
- Root cause: The Allow AI models switch counts only recipients with use === 'model' (apps/web/src/components/AiDataSharing.tsx:119) and reads on when those are allowed. Inbox asks for the recipient in triageBlocked (Inbox.tsx:951-955) and Legal and agents check their own recipient, so a recipient outside that filter is blocked yet invisible in Settings. Separately the agent hand-off text at packages/adapters/src/executor.ts:8358-8370 ends every failure with [Open Integrations], which cannot fix a missing AI consent.
- Findings: FLOW-01, J2-05
- Found by: FLOW-01 [FLOW]; J2-05 [J2]
- Verification: Observed on screen by FLOW (switch on, Inbox card, Legal banner, Investors agent all 'not allowed') and by J2 (Investors agent 'Open Integrations' while Gmail shows Connected). Code confirmed for the filter at AiDataSharing.tsx:119 and the generic link at executor.ts:8358 and :8370. The recipient mismatch is suspected; it may come from demo seed data, but the on-screen contradiction is real.
- Files:
  - apps/web/src/components/AiDataSharing.tsx (derive the switch from the same recipient list Inbox, Legal and agents check)
  - apps/web/src/pages/Inbox.tsx:949-955 and apps/web/src/pages/Legal.tsx (read the same state)
  - packages/adapters/src/executor.ts:8358-8370 (consent failures link to Settings > Privacy and approvals; unknown-recipient failures get no Integrations link)
  - apps/web/src/components/AiDataSharing.test.tsx
- Reach: Every new user who connects mail or documents; consent is the gate to Inbox sorting, Legal, Data room and agent answers.
- Acceptance criteria:
  - With the switch on, no consent card appears on Inbox, Legal or Data room, and no agent answers 'not permitted'.
  - If any area is blocked the switch reads off and the blocked message links to that switch.
  - No agent reply for a consent or unknown-recipient failure ends in 'Open Integrations'.
  - Unit test: a recipient with any use that blocks Inbox also turns the switch off.
- Needs product decision: false
- Depends on: none
- Conflicts with: C6 (Legal consent and banner use the same state; do C3 first)
- Reopens: none

### C4 First Inbox sort shows only grey bars for minutes, and a revisit shows 'First sync' on a synced mailbox (P1, rank 4, effort S)
- Root cause: While the first sort runs, Inbox.tsx:664 hides every row (sortingRows) and the page waits for two full poll cycles (TRIAGE_MAX_POLLS then one auto-retry, lines 475-486) before it shows the stall notice. 'sorting' only clears when a pending-to-done change is seen (:551-553), so a mailbox where the last poll lands after the change stays in skeletons until a reload. The same loading branch drops the previous rows on a space switch and prints 'First sync can take a minute' for a synced account.
- Findings: J1-02, V2-01, J1-07, FLOW-04
- Found by: J1-02 [J1]; V2-01 [V2]; J1-07 [J1]; FLOW-04 [FLOW]
- Verification: Observed by J1 (14 mails, over 105 s, reload showed the sorted list at once) and V2 (over 3 min, several reloads). A 1-mail mailbox sorted in 9 s. Code confirmed at Inbox.tsx:475-486, :551-553, :664. FLOW-04 observed once on a loaded shared stack; load may be a cause, so it ships with this cluster as the lower-confidence part.
- Files:
  - apps/web/src/pages/Inbox.tsx (after about 15 s of sorting, show the unsorted rows with a 'Sorting...' line; clear sorting when polling stops and re-read the list once; keep cached rows on a space revisit; show 'First sync' only for an account that has never synced)
  - apps/web/src/pages/Inbox.test.tsx
- Reach: Every user's first morning (STORY-INB-022) and every large mailbox.
- Acceptance criteria:
  - On a 14-mail mailbox rows are readable within 15 s of pressing Allow, or a Retry notice shows by then.
  - After the last poll the list is re-read once; no skeleton remains once triage is done.
  - Switching space and back shows the last rows at once with no 'First sync' sentence.
  - Test: sorting stuck at triagePending=true past the limit shows rows, not skeletons.
- Needs product decision: true (The first sort hides all rows on purpose, so the To do card does not push them down (Inbox.tsx:663). Is showing unsorted rows after 15 s acceptable, or should the page keep hiding them? Recommend showing them dimmed.)
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C4 (stalled-sort retry could not be tested then)

### C5 The Connect Gmail dialog resets to its first question after Connect, and Inbox 'Connect mail' takes five steps (P1, rank 5, effort S)
- Root cause: Suspected. AppDetail.tsx:325 renders ConnectAppDialog while adding and confirmFirst are true. When the connection list refreshes after sign-in, the dialog is remounted and ConnectAppDialog.tsx:69 starts again in the 'confirm' phase because confirmFirst is still true. It never reaches 'Gmail connected' and the next=/app/inbox redirect never runs. Pressing Connect again would start a second sign-in. The ?connect=1 route (AppDetail.tsx:187-197) also opens that dialog behind a 'not connected' page, so the same connection takes five steps from Inbox against one click in Chief's card.
- Findings: J1-01, J1-09
- Found by: J1-01 [J1]; J1-09 [J1]
- Verification: J1-01 observed twice (dialog text sampled every 1.2 s). Headless run used the emulator's instant sign-in, so behaviour with a real Google pop-up is unverified. Code lines read: AppDetail.tsx:325 passes confirmFirst; ConnectAppDialog.tsx:69 sets the initial phase from it.
- Files:
  - apps/web/src/components/integrations/AppDetail.tsx (clear confirmFirst when Connect is pressed; keep the dialog mounted across the connections refresh; run the next= redirect from the success path)
  - apps/web/src/components/integrations/ConnectAppDialog.tsx
  - apps/web/src/components/integrations/ConnectAppDialog.test.tsx
  - Inbox empty state Connect mail (start the same inline connect as Chief's card)
- Reach: Everyone who connects mail from the empty Inbox (the first-morning path).
- Acceptance criteria:
  - After Connect the dialog never shows the first question again; it advances to the agent choice or 'Gmail connected'.
  - With ?next=/app/inbox the page returns to Inbox after success.
  - Test: a connections refresh while the dialog is open does not reset its phase.
  - Connect mail from an empty Inbox completes in two steps (button, sign-in).
- Needs product decision: false
- Depends on: none
- Conflicts with: C21 (AppDetail.tsx)
- Reopens: none

### C6 Legal keeps a red 'Last scan failed: needs your permission' banner with no action, asks for consent before any document exists, and the phone tabs overlap (P1, rank 6, effort S)
- Root cause: Legal.tsx:272-290 shows any failed lastRun and gives an action only for a rejected key; the consent failure text (packages/contracts/src/legal.ts:25) has no Allow button, no retry, and stays after consent is granted, while the header reads 'Last scan 3h ago. Scans daily.' and Scan now stays enabled. The consent card at Legal.tsx:240-265 shows for a user with zero documents. The tab list (Contracts N, Deadlines N, Graph) is inline-flex with no wrap, so counts overlap at 390 px. The contracts table gives Parties a narrow column while Term and Renewal are mostly dashes or truncated.
- Findings: V2-02, FLOW-02, J2-08, FLOW-03, V2-03, R2-10-04, J2-06, V2-06, R2-10-05
- Found by: V2-02 [V2]; FLOW-02 [FLOW]; J2-08 [J2]; FLOW-03 [FLOW]; V2-03 [V2]; R2-10-04 [R2]; J2-06 [J2]; V2-06 [V2]; R2-10-05 [R2]
- Verification: Banner observed by three walkers and read in Legal.tsx:272-290 and contracts/legal.ts:25. Phone tab overlap observed at 390 (V2-03, P1 downgraded to P2 inside this cluster since the labels stay readable; the cluster is P1 because of the banner). Truncation observed by R2, J2, V2; Parties and Term widths measured (203 and 182). V2-07 (three buttons per deadline row) dropped: Ask agent / Done / Dismiss is an owner decision.
- Files:
  - apps/web/src/pages/Legal.tsx (hide a failed run whose error is the consent message when consent exists; otherwise put Allow in the banner and disable Scan now; show consent and tabs only once the Data room has a document, else the Data room empty-state pattern; show 'Scanning, N of M'; make the tab list scroll or drop counts under 400 px; style the 'not yet checked' link)
  - apps/web/src/pages/legal/LegalContracts.tsx (drop the company itself from Parties, give Parties more width, let Term and Renewal wrap)
  - apps/web/src/pages/Legal.test.tsx
- Reach: Every Legal visit: first week (STORY-LEG-001) and the daily check.
- Acceptance criteria:
  - With consent granted, no 'needs your permission' banner shows and Scan now is enabled.
  - Without consent the banner has an Allow button and Scan now is disabled.
  - A user with no documents sees one sentence and 'Add files' instead of a consent card and an empty table.
  - At 390 px no tab label overlaps another and nothing passes the gutter.
  - In the contracts table at 1440 the counterparty is visible and Term and Renewal show their full text or wrap.
- Needs product decision: false
- Depends on: C3 (shared consent state)
- Conflicts with: none
- Reopens: iteration 9 C16 (Parties clipped, link style, first visit) and C33

### C7 Legal 'Scan now' replaced reviewed contract values and removed deadlines without a message (P1, rank 7, effort M)
- Root cause: Suspected. LEGAL_SCAN_PROMPT (apps/api/src/legal-agent.ts:21) tells the agent to re-record every document, and the legal_upsert tools overwrite fields with whatever the model extracts. With placeholder PDFs the model returned less, so Term dates went empty, Office Lease value $90,000 became $9,000, and 13 deadlines became 4 (non-renewal notices and auto-renewal rows vanished). Only hand-added deadlines survived.
- Findings: J2-01
- Found by: J2-01 [J2]
- Verification: Observed by J2 once with before and after screenshots. Cause is a hypothesis; the demo uses blank placeholder PDFs, so it may be a demo artifact. Code read: legal-agent.ts:21 prompt. The upsert tools were not traced.
- Files:
  - apps/api/src/legal-agent.ts (prompt: update only changed documents)
  - legal_upsert tool implementations in apps/api or packages/adapters (never replace a field a person has seen with an empty or lower-confidence value; never delete open derived deadlines on re-scan)
  - Legal page (show 'N changed' with Undo after a scan)
  - regression test for upsert merge
- Reach: Anyone who presses Scan now on Legal after reviewing contracts.
- Acceptance criteria:
  - Failing test first: re-scanning a document whose extraction returns empty term and value keeps the stored values.
  - A re-scan never deletes an open deadline derived from a document that still exists.
  - After a scan the page states how many rows changed and offers Undo.
- Needs product decision: true (Should a re-scan ever overwrite a field the founder has edited or reviewed? Recommend no: edited fields are locked and the scan only fills blanks.)
- Depends on: none
- Conflicts with: C6 (Legal.tsx header)
- Reopens: none

### C8 The approval toast still covers the composer, menus, drawer and row actions (P2, rank 8, effort S)
- Root cause: The viewport is fixed bottom-right (desktop) or above the composer line (phone) at z-[110] (packages/ui-web/src/components/ui/notification-toaster.tsx:301), above menus and dialogs, and nothing reserves space for it. It covers the email agent panel input (desktop), the Draft a reply chip, Log out in the account menu, Settings, Data room preview and palette (phone), the open navigation drawer's last rows, and row actions on Fundraising and Settings. The toast element is aria-hidden when stacked and its time label never ticks.
- Findings: J1-03, J3-01, J3-02, J2-09, R1-06, R1-07, J3-08, R1-08
- Found by: J1-03 [J1]; J3-01 [J3]; J3-02 [J3]; J2-09 [J2]; R1-06 [R1]; R1-07 [R1]; J3-08 [J3]; R1-08 [R1]
- Verification: Overlap observed by J1 (elementFromPoint at the input returns the toast), J3, R1, J2. Position and z-index confirmed at notification-toaster.tsx:301. J3-02 was filed P1: a person can dismiss or answer the toast, so P2. J3-08 (aria-hidden) is suspected from DOM only; no screen reader run. R1-07 and R1-08 are P3 inside the cluster.
- Files:
  - packages/ui-web/src/components/ui/notification-toaster.tsx (hide or lower while a menu, dialog or the drawer is open; do not set aria-hidden on the front toast; tick the relative time)
  - apps/web/src/components/AppToaster.tsx
  - chat and email agent panels (reserve bottom space for the toast stack, or place the chip row above it)
  - packages/ui-web/src/components/ui/notification-toaster.test.tsx and .stories.tsx
- Reach: Everyone with a pending approval, on every page; worst on phones.
- Acceptance criteria:
  - At 375 touch and 1440 the toast covers no part of the composer, a suggestion chip, Log out, a dialog's content, or the drawer rows (bounding-box check on Inbox email agent, account menu, Settings, Data room preview).
  - The toast's Dismiss button and group button are in the accessibility tree.
  - The time label updates at least every minute.
- Needs product decision: false
- Depends on: C2
- Conflicts with: none
- Reopens: iteration 9 C1 (position criterion met for headers only)

### C9 Turning Activity on leaves about 2.5 chat rows, and the Activity panel shows 1 of 3 entries (P2, rank 9, effort S)
- Root cause: Activity (ActivityList.tsx:133, lg:max-h-[max(14vh,7.5rem)]) is capped at about 85 px of scroll area, so one 'Needs you' row shows and the rest hide with no cue, while the same runs also appear in the chat list below. The eight Pages rows (42 px pitch) plus Activity and the space heading leave 2.5 chat rows at 1440x900 against the target of 5. The roster scroller ends in a fade that cuts a section header in half. A small green flag glyph appears next to Chief's time while it works.
- Findings: R1-01, V3-01, V1-03, R3-10-09
- Found by: R1-01 [R1]; V3-01 [V3]; V1-03 [V1]; R3-10-09 [R3]
- Verification: Observed by R1 (2.5 rows), V3 (clientH 85 / scrollH 205) and V1 (354 px roster box, header cut by the gradient). Cap class confirmed at ActivityList.tsx:133. R3-10-09 is suspected (seen only while Chief was working).
- Files:
  - apps/web/src/pages/ActivityList.tsx:133 (let the panel fit its 'Needs you' rows, add a count or fade cue)
  - apps/web/src/pages/Shell.tsx (Pages and Activity height split near 4347-4391; snap the roster fade to a row boundary; accessible name for the working indicator)
  - apps/web/src/pages/Shell.stories.tsx
- Reach: Every user with Activity open (the default for anyone with a running agent).
- Acceptance criteria:
  - At 1440x900 with Activity open at least 5 chat rows are visible and all 'Needs you' entries show.
  - The bottom of the roster scroller ends on a row boundary, never through a heading.
  - A 'Needs you' run is not listed twice on screen (decided in iteration 2 C2; verify).
- Needs product decision: false
- Depends on: none
- Conflicts with: C18 (ActivityList.tsx heading text)
- Reopens: iteration 9 C5 and V1-09/V1-14 of iteration 9

### C10 SAFEs differ between Investors, the conversion block and Fundraising, and 'Equity raised' is a bare dash (P2, rank 10, effort M)
- Root cause: The Investors cap table lists four Carta holders ($350,000) while the 'SAFEs, if converted' block on the same page and Fundraising list two other holders ($300,000), so two sources feed the page. 'Equity raised' shows a dash when SAFEs exist but no priced round.
- Findings: R1-03
- Found by: R1-03 [R1]
- Verification: Observed by R1 with screenshots. FLOW saw the same SAFE rows in the cap table and the dash. Rated P1 by R1; kept P2 because FLOW and V3 found no P0/P1 on Investors and Fundraising and the demo data may mix Carta and Mercury sources. Owner said another session owns Investors and Fundraising: this cluster is input for that session, as in iteration 9.
- Files:
  - apps/web/src/pages/Investors.tsx and apps/web/src/pages/Fundraising.tsx (build both from one SAFE list)
  - Equity raised tile (show 'SAFEs $X' when no priced round)
- Reach: Every founder preparing a raise.
- Acceptance criteria:
  - One SAFE list: Investors, the conversion block and Fundraising show the same holders and total.
  - Equity raised shows the SAFE total when SAFEs exist.
- Needs product decision: true (When Carta and Mercury both report SAFEs, which wins? Recommend Mercury as the only SAFE record (per the fundraising plan memory) and show Carta holders only as cap table rows.)
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C7

### C11 Empty Investors and Fundraising show static grey bars, several add options at once, and 'Draft reply' gives no sign of work (P2, rank 11, effort M)
- Root cause: Placeholders.tsx:39 renders ghost rows for empty data on Investors (Updates), Fundraising (Round, Pipeline, SAFEs) and for a user with SAFEs but no round, so they look like a loader that never ends. Investors also offers Connect Carta, Use a Google Sheet, Type it in, Add contact and New update together. The Draft reply action disables but keeps its label and shows no spinner for about 20 s.
- Findings: R1-04, R1-05
- Found by: R1-04 [R1, FLOW, J2]; R1-05 [R1]
- Verification: Observed by R1; FLOW and J2 saw the same grey rows as P2 notes. Draft reply wait observed once (script output). R1-04 and R1-05 filed P1; P2 here because Maya can still reach the buttons and the owning session scopes P0/P1 only.
- Files:
  - apps/web/src/pages/Investors.tsx
  - apps/web/src/pages/Fundraising.tsx
  - apps/web/src/components/Placeholders.tsx (one sentence and one primary action instead of ghost rows)
  - action-item button near Investors.tsx:630 ('Drafting...' with a spinner)
- Reach: Every new founder on Investors and Fundraising; every Draft reply.
- Acceptance criteria:
  - A fresh user sees no grey placeholder bars on Investors or Fundraising; each empty section is one sentence and one button.
  - Investors first view offers one primary add path, others behind 'More'.
  - Draft reply shows 'Drafting...' with a spinner while the draft runs.
- Needs product decision: false
- Depends on: none
- Conflicts with: C10 (same two pages)
- Reopens: iteration 9 C8

### C12 With Hide amounts on, Finance shows '$•••' and no visible way back; the space name still truncates on sub-pages (P2, rank 12, effort S)
- Root cause: Hide amounts is per user (verified working), but Finance.tsx has no state indicator in its header, and the space picker on the Runway page and the Accounts, Burn, Spend and Crypto sub-pages truncates to 'Northwi...' with free room. Smaller layout items: Breakdown and Upcoming cards end at different heights, the period bar is a full-width card with about 700 px empty, the phone period card is 340 px tall, the crypto chart ends in a drop that may be an unpriced asset, and the Run-out stat card pads 14 px left and 8.6 px right.
- Findings: R2-10-03, R3-10-06, V2-08, V2-09, V2-10, V2-11, V2-16, V2-17, J1-11
- Found by: R2-10-03 [R2]; R3-10-06 [R3]; V2-08 [V2]; V2-09 [V2]; V2-10 [V2]; V2-11 [V2]; V2-16 [V2]; V2-17 [V2]; J1-11 [J1]
- Verification: R2-10-03 observed. Truncation observed by R3 and V2. Others are P3 observations. V2-17 (blank page once) was not reproduced and is likely dev-server reload: noted, not acted on.
- Files:
  - apps/web/src/pages/Finance.tsx (small 'Amounts hidden - Show' control in the header when hidden; space picker takes available width; equal-height card pair; shrink period bar to content)
  - apps/web/src/pages/finance/FinanceCrypto.tsx (mark the last partial point; normal caption spacing)
  - Runway stat card padding
- Reach: Anyone who turns on Hide amounts (shared screens, investors calls) and every Finance sub-page.
- Acceptance criteria:
  - When amounts are hidden a visible control in the Finance header turns them back on in one click.
  - The space name is not truncated when the header has free width at 1440 and 390.
  - Run-out card padding is equal left and right.
- Needs product decision: true (The owner fixed Hide amounts as a stable checkbox row in the account menu. May Finance also show a small 'Amounts hidden - Show' control when it is on? Recommend yes, shown only while hidden.)
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C19 and C21

### C13 Inbox email dialog jumps when the agent panel opens, row checkboxes are 16 px on touch, and rows take two tab stops (P2, rank 13, effort S)
- Root cause: Opening Ask agent widens the message dialog from about 770 to 1155 px and re-centres it, so the text moves 190 px left; the toggle shows no pressed state and the panel's first item repeats the email. On coarse pointers the row checkbox is 16 px (InboxRow.tsx:361) against the owner's 44 px rule. Each row has a row button and a select control, so the fifth row takes about 10 Tabs. Smaller items: icon buttons 36x28 vs Ask 69x32, search highlights only the first term, the approval card header repeats the To address, and the phone To do card pushes the first mail to y=508.
- Findings: J1-12, V2-04, V2-05, R2-10-07, R2-10-08, R2-10-09, V2-15, J3-06, J1-10, V2-12
- Found by: J1-12 [J1]; V2-04 [V2]; V2-05 [V2]; R2-10-07 [R2]; R2-10-08 [R2]; R2-10-09 [R2]; V2-15 [V2]; J3-06 [J3]; J1-10 [J1]; V2-12 [V2]
- Verification: Measured or observed by two walkers each for the dialog jump (770 to 1155) and the empty Cleanup state; V2-05 and R2-10-07 measured under coarse pointer / Tab walk. Cleanup empty text is acceptable per V2 and R3; J1-10 only asks it to say why senders do not qualify (P3).
- Files:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx (keep the message column fixed; panel grows to the right; Ask agent pressed state)
  - apps/web/src/components/inbox/InboxRow.tsx:361 (44 px hit area on coarse pointers; one tab stop per row)
  - apps/web/src/pages/Inbox.tsx (toolbar heights, highlight every term, To do card collapse on phones)
  - apps/web/src/components/inbox/InboxCleanup.tsx (say what qualifies)
- Reach: Every Inbox user.
- Acceptance criteria:
  - Opening Ask agent keeps the email text within 8 px of its previous x position.
  - Under pointer: coarse every row checkbox has a hit area of at least 44 px.
  - The fifth row is reached in 5 Tabs.
  - Search highlights every query term.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C20 (tab stops) and C30

### C14 Chat shows an internal tool name ('Legal upsert node'), duplicate answer text, and a pill over the last bubble (P2, rank 14, effort S)
- Root cause: The tool-row label mapping in apps/web/src/pages/shell/transcript.tsx has no phrase for legal_upsert_* tools, so the raw name shows while a Legal run works. An answered ask card shows 'Answered: <text>' and the same text as a user bubble. A routine test run posts two near-identical agent messages. The '1 new message' pill sits over the last bubble, and chat action buttons focus with an ink ring at 50% alpha while links use full ink.
- Findings: R2-10-06, R2-10-12, J2-16, R1-09, R3-10-08, J3-04
- Found by: R2-10-06 [R2]; R2-10-12 [R2]; J2-16 [J2]; R1-09 [R1]; R3-10-08 [R3]; J3-04 [J3]
- Verification: R2-10-06, R2-10-12, J2-16, R1-09 observed. J3-04 (two Draft a reply bubbles) not reproduced and J1 saw it only with a scripted click: suspected, include only a once-sent guard on the chip. Tool label seen on 'Legal upsert node' only; other tool rows were collapsed.
- Files:
  - apps/web/src/pages/shell/transcript.tsx (verb phrase per tool, such as 'Updating the contract list'; keep the new-message pill above the composer chip)
  - ask card submit path (show the typed answer once)
  - routine test run message (post one)
  - chat message action button focus style (same ring as links)
  - email agent suggestion chip (disable after first send)
- Reach: Everyone who reads agent work in chat.
- Acceptance criteria:
  - No tool row shows an identifier with underscores or a camel-case tool name.
  - A typed answer to an ask card appears once.
  - The new-message pill overlaps no bubble text.
  - Chat action buttons and links use the same focus ring colour.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C17 and C27

### C15 Routines still sit behind a 'Computer and routines' button over a black box, and the routine form has no skill picker (P2, rank 15, effort S)
- Root cause: The monitor button and its panel keep the title 'Computer and routines' (Shell.tsx:5729) and 'Computer is on' with a preview that is black until frames arrive. The routine form (Name, Instruction, schedule) offers no way to choose one of the bot's skills.
- Findings: R2-10-01, R2-10-02, J2-15
- Found by: R2-10-01 [R2]; R2-10-02 [R2]; J2-15 [J2]
- Verification: Title confirmed at Shell.tsx:5729. The black box was seen by R2 and J2; R2 notes the demo fake sandbox may cause it, the title is real. R2-10-02 observed.
- Files:
  - apps/web/src/pages/Shell.tsx:5729 and the panel header (title 'Routines' when no computer is in use; hide the preview until the first frame)
  - routine form in Shell.tsx (skill picker listing the bot's skills)
- Reach: Anyone who sets up a recurring bot task.
- Acceptance criteria:
  - A bot with no computer in use shows 'Routines' as button label and panel title and no black preview.
  - The routine form lists the bot's skills for selection.
- Needs product decision: false
- Depends on: none
- Conflicts with: C19 (Shell.tsx panel region)
- Reopens: iteration 9 C14

### C16 Data room files sit on 'Reading' with no explanation or action, while search already finds their text (P2, rank 16, effort S)
- Root cause: Status text in components/data-room/ItemRows.tsx does not leave 'Reading' when text exists or after a threshold: 'MOCK Board Minutes - October.pdf' stays on Reading / 'Taking longer than usual' although a search returns its extracted text, and V3 saw rows at Reading for 4, 5 and 6 minutes with no Retry. After Auto-sort moves, three files went back to Reading.
- Findings: J1-06, V3-03, J2-14
- Found by: J1-06 [J1]; V3-03 [V3]; J2-14 [J2]
- Verification: Observed by three walkers, but the demo seeds this file and has no model key (iteration 9 deferred the seed issue). Fix is worthwhile only if the status contradicts stored text in real use; verify with a real extraction before shipping the move re-read part.
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx (Marker and status text: ready as soon as text is stored; after a threshold show 'Taking longer than usual' with Retry)
  - data room move handler (skip re-reading on folder moves)
  - demo seed (seed the board minutes file Ready)
- Reach: Anyone who uploads documents.
- Acceptance criteria:
  - A file whose text is stored never reads 'Reading'.
  - A row in Reading for over 3 minutes shows 'Taking longer than usual' and a Retry button.
  - Moving a file between folders does not reset its status.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 deferred J2-10 and R3-9-05

### C17 Every chat message on a phone carries a permanent row of 3-4 icon buttons (P2, rank 17, effort S)
- Root cause: MessageHoverMetadata.tsx uses a [@media(hover:none)]:static fallback, so on touch the React, Reply, Remember and More row shows under every message (about 44-50 px each; three rows are 17% of the screen on Chief).
- Findings: V1-02, V2-18
- Found by: V1-02 [V1]; V2-18 [V2]
- Verification: Observed by two inspectors. V1 notes it is probably intentional, so it is a density decision for the owner.
- Files:
  - apps/web/src/components/MessageHoverMetadata.tsx (show one '...' per message, or reveal the row for the tapped message)
- Reach: Every chat on a phone.
- Acceptance criteria:
  - On touch, an untapped message shows at most one control; tapping reveals the rest; each control stays 44 px.
- Needs product decision: true (Should message actions on a phone collapse to one '...' button or appear on tap? Recommend a single '...' button.)
- Depends on: none
- Conflicts with: none
- Reopens: none

### C18 One waiting state has three names: 'Needs you', 'Needs your answer' and 'Needs approval' (P3, rank 18, effort XS)
- Root cause: roster-status.ts:15 defines 'Needs your answer', but ActivityList.tsx:173 still titles the section 'Needs you' and transcript.tsx:1831 compares block.state against 'Needs you'. The sidebar row says 'Needs your answer' while the chat card says 'Mail Needs approval'. An Inbox agent holding an approval shows 'Waiting for the model...' (demo has no model; unverified in real use).
- Findings: R1-02, FLOW-05, V2-14
- Found by: R1-02 [R1]; FLOW-05 [FLOW]; V2-14 [V2]
- Verification: R1-02 confirmed in code (ActivityList.tsx:173, transcript.tsx:1831). FLOW-05 observed. V2-14 suspected.
- Files:
  - apps/web/src/lib/roster-status.ts (one label; 'Needs approval' for held actions, 'Needs your answer' for questions)
  - apps/web/src/pages/ActivityList.tsx:173
  - apps/web/src/pages/shell/transcript.tsx:1831
- Reach: Every user with a waiting agent.
- Acceptance criteria:
  - grep for the string 'Needs you' as a label returns nothing.
  - Sidebar, Activity and chat card show the same phrase for the same state.
- Needs product decision: false
- Depends on: none
- Conflicts with: C9 (ActivityList.tsx)
- Reopens: iteration 9 C6

### C19 Bot settings panel: a 17 px strip above the sticky header, unexplained External wording, 'Disabled tools' as free text (P3, rank 19, effort XS)
- Root cause: The scroller has py-[17px] and the sticky header uses top-0 with -mt-[17px] and pt-[17px] (Shell.tsx:5965-5967), so scrolled content shows in a band above the title. The External line does not say sharing asks first. 'Disabled tools' asks Maya to type internal tool names (bot-panel.tsx:809).
- Findings: V1-01, R2-10-10, R2-10-11, V1-15
- Found by: V1-01 [V1]; R2-10-10 [R2]; R2-10-11 [R2]; V1-15 [V1]
- Verification: Header strip observed by two walkers; class names confirmed at Shell.tsx:5965-5967. Copy items observed.
- Files:
  - apps/web/src/pages/Shell.tsx:5965-5967 (top-[-17px] or no scroller top padding)
  - apps/web/src/pages/shell/bot-panel.tsx (External sentence; pick list for disabled tools, or hide under a developer setting)
- Reach: Anyone who opens bot settings.
- Acceptance criteria:
  - When the panel is scrolled no content shows above the title.
  - Disabled tools is a pick list, or absent from the default view.
- Needs product decision: false
- Depends on: none
- Conflicts with: C15 (Shell.tsx)
- Reopens: iteration 9 C13

### C20 Settings: Models says two different providers, Usage text is wrong for the system model, cosmetic cards sit apart (P3, rank 20, effort S)
- Root cause: Models says 'Your bots use OpenAI: GPT-6 Luna.' then, after 'Use my own model', 'Your bots already use OpenRouter.' with Backup models 'Connect a provider to add backups.' (ModelSettingsOverlay.tsx:1545, ModelBackupsSettings.tsx:260). Usage says 'Model spend uses your provider keys' for a user on the system model. Theme, Sidebar density, Avatars and Chat display are four cards of one kind, and 'Comfortable / Compact' has no heading of its own. Nested nav pill widths differ, and the right column ends 140 px above the left.
- Findings: V1-07, R3-10-05, FLOW-06, V1-08, V1-10, V1-09
- Found by: V1-07 [V1]; R3-10-05 [R3]; FLOW-06 [FLOW]; V1-08 [V1]; V1-10 [V1]; V1-09 [V1]
- Verification: V1-07 and R3-10-05 observed (also iteration 9 V1-12). FLOW-06's proposal to promote Memory to the nav is dropped: Memory under Advanced is an owner decision. V1-09 switch is 32x18 but its row is 44 px, hit target unverified.
- Files:
  - apps/web/src/pages/ModelSettingsOverlay.tsx:1545
  - apps/web/src/pages/ModelBackupsSettings.tsx:260
  - apps/web/src/pages/AccountSettingsOverlay.tsx and SettingsOverlay.tsx (merge cosmetic cards into Appearance; hide the provider-key sentence on the system model; label Theme and Sidebar density; full-width nested nav pill)
  - apps/web/src/components/NotificationSettings.tsx:66 (confirm the label toggles on tap)
- Reach: Everyone who opens Settings.
- Acceptance criteria:
  - Models names the system model the same way before and after 'Use my own model'.
  - Backup models is disabled with a clear line when one provider is connected.
  - The Usage card shows the provider-key sentence only for a user with their own key.
  - Settings keeps five sections with Memory under Advanced.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C24

### C21 Integrations: connected cards differ in menu and button edges, the Gmail row shows no mailbox, a vendor name is shown (P3, rank 21, effort S)
- Root cause: Only key-based connections have a '...' menu (IntegrationsHome.tsx). On a phone the 'Open Inbox / Investors / Finance' buttons are content-wide with different left edges. The Gmail page Accounts row reads 'Connected 10/22/2026' with no address, 'Tools 0 / No tools available' and 'via Composio'; the demo emulator may not return an address. The Chat section has no filter chip, Carta uses a letter tile, and 'Disconnect sign-in' wraps in the Mercury menu.
- Findings: V1-13, V1-14, R3-10-07, J1-05, R2-10-13
- Found by: V1-13 [V1]; V1-14 [V1]; R3-10-07 [R3]; J1-05 [J1]; R2-10-13 [R2]
- Verification: Observed. J1-05 address part unverified with a real account. 'via Composio' conflicts with the repo rule that vendor names live only in adapters.
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx
  - apps/web/src/components/integrations/AppDetail.tsx (account email as row title; hide vendor chip and zero-tool list; widen menu)
- Reach: Anyone who manages connected apps.
- Acceptance criteria:
  - Every Connected card has the same '...' menu.
  - Action buttons share one left edge at 375.
  - The Accounts row shows the account address when the provider returns one.
  - No vendor name appears on a connected app page.
- Needs product decision: false
- Depends on: none
- Conflicts with: C5 (AppDetail.tsx)
- Reopens: iteration 9 C25

### C22 Data room toolbar uses three or four rows at small widths; share gives no recipient or record (P3, rank 22, effort S)
- Root cause: At 1024x768 the toolbar takes four rows (218 px) and on a phone the list/grid toggle sits on its own row (FilterBar.tsx, DataRoom.tsx). The share action's toast says 'Shared SAFE-Acme-signed.pdf' without the recipient, the preview has no 'Shared with N' line, the dialog lists contacts by name with 'Email them a link' ticked, and Auto-sort shows 'Select all' twice. Menu item 'Share with investors' wraps, grid previews run under the '...' button.
- Findings: V3-02, J3-07, V3-08, R3-10-01, R3-10-02, R3-10-03, J2-13, J2-17, R2-10-14, V3-04
- Found by: V3-02 [V3]; J3-07 [J3]; V3-08 [V3]; R3-10-01 [R3]; R3-10-02 [R3]; R3-10-03 [R3, J2]; J2-13 [J2, R3]; J2-17 [J2]; R2-10-14 [R2]; V3-04 [V3]
- Verification: All observed. Auto-sort double Select all seen by R3 and J2. V3-04 keyboard hint is suspected and deliberate in code (ItemRows.tsx:96-125). V3-02 is P2 only at 1024 wide.
- Files:
  - apps/web/src/components/data-room/FilterBar.tsx and apps/web/src/pages/DataRoom.tsx (Sort with the filter chips; toggles on the folder row)
  - apps/web/src/components/data-room/ItemDialogs.tsx (toast names the recipient; 'Shared with N' in the preview; email unticked by default)
  - apps/web/src/components/data-room/AutoSortDialog.tsx (one Select all)
  - apps/web/src/components/data-room/ItemMenu.tsx (shorten 'Share with investors')
- Reach: Data room users on narrow windows and anyone sharing a file.
- Acceptance criteria:
  - At 1024x768 the toolbar takes at most two rows.
  - The share toast names the recipient and the preview shows 'Shared with N'.
  - Auto-sort shows one Select all.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C12 and C29

### C23 First-run tour: popover far from its target, covers Search at stops 7-9, and never starts for a user who stays in Chief (P3, rank 23, effort S)
- Root cause: TourPopover.tsx pins the popover to the bottom of the sidebar for stops 1-6 (up to about 670 px from the ring) and the top for stops 7-9, covering Search and the Pages header, and Back/Skip move between stops. The tour waits while Chief's app cards are open (Shell.tsx:2713-2722), so a new user who stays in the Connect cards only reaches it from Account > Take the tour.
- Findings: R3-10-04, V1-04, J1-08, V1-05
- Found by: R3-10-04 [R3]; V1-04 [V1]; J1-08 [J1]; V1-05 [V1]
- Verification: Observed by four walkers; wait condition read at Shell.tsx:2713-2722 (by design). Nine stops stays (owner decision).
- Files:
  - apps/web/src/components/tour/TourPopover.tsx (place beside the ringed row; fixed Back/Skip/Next slots; keep stops 7-9 off Search)
  - apps/web/src/components/tour/FirstRunTour.tsx
  - apps/web/src/pages/Shell.tsx:2713-2722 (start when the cards are answered or skipped)
- Reach: Every new user.
- Acceptance criteria:
  - Each popover sits within 120 px of its ring and covers no sidebar header.
  - Skip tour and Next keep the same x position on every stop.
  - A new user who connects Gmail in Chief sees the tour start without opening another page.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 9 C26

### C24 Chief links the long way for a missing bank, and the first reply repeats the sidebar (P3, rank 24, effort XS)
- Root cause: Without a bank, the runway answer ends 'Connect one under Integrations first' (NOT_CONNECTED_GUIDANCE, executor.ts near 8370) while Finance has a one-click Add account. The onboarding reply (apps/api/src/onboarding.ts, asserted in onboarding.test.ts:157) is four sentences linking Finance, Investors and Data room above two cards that already say what they do. The Connect cards are 407 px under a 640 px bubble, and the sign-up form uses the browser's native 'Please fill out this field' bubble.
- Findings: J1-04, V1-06, V1-11, V1-12
- Found by: J1-04 [J1]; V1-06 [V1]; V1-11 [V1]; V1-12 [V1]
- Verification: Observed. J1-04 may reflect the scripted demo model: unverified with a real model.
- Files:
  - packages/adapters/src/executor.ts (Open Finance for cash and runway questions with no bank)
  - apps/api/src/onboarding.ts and onboarding.test.ts (one sentence plus the cards)
  - apps/web/src/components/tour/connect-cards.ts
  - sign-up form (noValidate with the same inline red message)
- Reach: Every new user.
- Acceptance criteria:
  - A runway question with no bank links Open Finance.
  - The onboarding reply is one sentence before the cards.
  - An empty sign-up field shows the app's inline red message.
- Needs product decision: false
- Depends on: none
- Conflicts with: C3 (executor.ts lines 8358-8370)
- Reopens: none

### C25 Command palette selects 'Search mail for' before a direct match, and long titles hide the match on a phone (P3, rank 25, effort XS)
- Root cause: Typing a contact or document name selects 'Search mail for ...' first, so Enter leaves the palette; long document titles truncate at the end and cut the highlighted match.
- Findings: V3-05, V3-06
- Found by: V3-05 [V3]; V3-06 [V3]
- Verification: Observed.
- Files:
  - apps/web/src/pages/shell/command-palette.tsx (select the best direct match first; 'Search mail for' last; truncate in the middle)
- Reach: Everyone who uses Cmd+K.
- Acceptance criteria:
  - Typing an exact contact name and pressing Enter opens that contact.
  - The highlighted match stays visible on a 375 px palette.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: none

### C26 Opening a page quietly adds its page agent to the sidebar (P3, rank 26, effort S)
- Root cause: Suspected: the Shell page-agent hook creates and lists a page's agent on first visit. A fresh user's sidebar gained 'Page agents 1' after Data room and 2 after Investors and Legal, though Inbox and Finance added none.
- Findings: FLOW-07
- Found by: FLOW-07 [FLOW]
- Verification: Observed on screen; cause suspected from code. Collapsed count already fixed in iteration 9 C28.
- Files:
  - Shell page-agent hook in apps/web/src/pages/Shell.tsx (list the agent after Ask is used or it has posted)
- Reach: Every new user while exploring pages.
- Acceptance criteria:
  - A fresh user who only opens pages sees no 'Page agents' group until a page agent has been used.
- Needs product decision: false
- Depends on: none
- Conflicts with: C9 (Shell.tsx sidebar)
- Reopens: iteration 9 C28

## Deferred items (not in a cluster)
- Load and cold-start times (R2-10-15, V3-09, V2-17): 'Opening Praci...' for 5-14 s on direct loads of /app/legal and /app/artifacts and one blank Finance crypto load, all on a shared dev stack. Re-measure on an idle production build before filing.
- R1-10 and V2-14 (second half): 'Waiting for the model...' or 'Working...' for 10+ minutes on Finance and Legal agents. The demo has no model key; demo-only until seen with a real model.
- J2-12 and J3 note: 'This agent could not finish. Try again.' seen once each, recovered; not reproduced, other walkers shared the thread.
- V3-07 Contacts open an Edit form with no read view or related items: feature request, needs design (product decision: should a contact page show related mail, documents and chats?).
- V2-13 Artifacts header has a bottom divider the other pages lack: P3, one class; fold into the next Artifacts change.
- V2-07 three buttons per Legal deadline row: dropped, owner decision (Ask agent / Done / Dismiss).
- J2-07 no Undo on Legal Done and Dismiss: dropped as wrong, Undo exists (apps/web/src/pages/legal/LegalDeadlines.tsx:15 keeps it 30 s). Same drop as iteration 9 J2-04.
- FLOW-06 Memory as a top-level settings entry: dropped, owner decision (Memory under Advanced).
- V2-12 and J1-10 Cleanup empty state: acceptable per V2/R3; only the 'why' sentence is carried in C13.
- V1 'Reconnect needed' fixture space reloads the app (FLOW): demo fixture, not judged.
- Catalog drift: STORY-APP-309/319 describe a Connect-your-apps page that no longer exists; STORY-APP-209 expects 8 months (demo gives 24.6); STORY-DRM Share and Mercury page wording changed. Update the catalog, not the app.

## BLOCKED stories
- STORY-APP-309 model sign-in with false start (demo has a default model); real OAuth Connect for Gmail, Calendar, Carta, Mercury reconnect, Brex, Devin.
- STORY-CAP-017 first visit connect Carta (already connected); STORY-FIN-022 month-end with reconnect (no reconnect state); STORY-APP-388 payment end to end beyond the cards seen.
- Payment button label 'Send $300.00' (no payment card in the demo; code confirmed at AskCard.tsx:66-68); burn-bar 44 px target (R3 touch emulation not coarse); Mercury connected without an agent state.
- Held 'Share with {name}?' cards, secret request card and Provide secret dialog; fresh 'can now read' Allow state; Data room toast probe.
- Phone-only stories STORY-APP-144, STORY-INB-040, STORY-APP-213 (J1 budget); real finger scrolling on Finance; real iOS keyboard over the palette; VoiceOver on the toast (C8).

## Counts by severity
- Clusters: 26 (P0 1, P1 6, P2 10, P3 9)
- Distinct finding ids in clusters: 111
- Clusters needing a product decision: C4, C7, C10, C12, C17
- P0: C1 (suspected unapproved payment; needs a clean repro, falls to P1 if it clears).
- P1: C2 (approval toast routing), C3 (consent contradiction), C4 (first sort hang), C5 (Connect dialog reset), C6 (Legal banner), C7 (Legal re-scan overwrite, suspected).
