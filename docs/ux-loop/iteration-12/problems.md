P0: 0, P1: 4, P2: 13, P3: 9

# Iteration 12 problems: fix clusters

Sources: R1-R3 (verify pass-11 clusters C1-C34), J1-J3 (journeys; J3 at phone width with touch emulation), FLOW, V1-V3, on the mock demo stack (web 5381). Findings were deduplicated and clustered by root cause; 'found by' is the id prefix of each finding. Earlier problems.md files (iterations 1-11) and docs/ux-flow, docs/ux-visual were checked; a pass-11 cluster whose criteria are not met is shown as a new cluster with a 'Reopens' line.

Owner decisions respected and not re-raised: tour stays nine stops; the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Legal row actions Ask agent / Done / Dismiss (V2-14 dropped); approval toasts persist, bottom-right; Settings in five sections with Memory under Advanced; no model step in onboarding on the demo.

Environment caveats: the demo stack was shared by up to ten walkers, so counts, duplicate cards, 'New Bot' rows and load times changed under every walker. Perf findings are deferred. Pass-11 clusters met (no new cluster): C2 Legal Undo, C6 approval toast, C7 Legal Scan now, C8 consent cards, C9 approval card at 375, C12 Inbox dialog, C15 Settings General, C17 sign-up errors, C18 palette, C22 Data room phone and Stats, C25 Finance vendor and Burn, C31 Legal Deadlines rows; Storybook smoke 1721/1721.

Severity calls: no P0 (no money moved wrongly, no data lost). J3-02 (reported P1) is P2: overlap on a phone, page still usable. V1-02 (reported P1) is P2 with a decision: nobody saw data go where the user blocked it. J2-01 and R1-01 are one P1 because R1 reproduced the stale-card problem with a single user.

## Fix clusters, ranked

### C1 [P1] A delegated payment can leave two live approval cards, a denied card that comes back to life, and a run that shows 'could not finish' while it is only waiting
- Rank: 1. Effort: L. Reopens: iteration 11 C1 (single-user repro now exists, stays P1).
- Finding ids (found by): R1-01 (R1), R1-03 (R1), R1-08 (R1), J2-01 (J2)
- Root cause: Observed by one user (R1) on a fresh thread: a long request made the bot message the Mercury agent twice, giving two cards. After the newer card was denied, the older card showed live Send/Deny again (also after reload) and its Send produced 'Submitted' in the same thread that said 'you denied'. J2 saw the same family on the other side: the delegate run ended with no final answer after an approval was created, the card became 'No longer active', the composer said 'could not finish', and Retry added a second identical user bubble. Common cause: the card's lifecycle is derived on the client ('a newer live card exists') instead of being stored, and a run that pauses on approval or fails after creating one has no server-side state saying so.
- Verification: Observed (R1-01 on one user, J2-01 on one user). Cause suspected. Code: pauseForAsk/resume in packages/adapters/src/executor.ts; superseded state is computed in apps/web/src/components/AskCard.tsx; MISSING_TOOL_FINAL_RESPONSE_ERROR at packages/contracts/src/domain.ts:1152. Not traced further.
- Files:
  - packages/adapters/src/executor.ts (pauseForAsk, resume, relay: mark older pending approvals superseded when a newer one is created; reject approving a superseded or denied card; replace the interim relay message with the final one)
  - packages/adapters/src/executor-approval-replay.test.ts (regressions: second request supersedes the first; denied card cannot be approved; failed run after an approval expires it)
  - apps/web/src/components/AskCard.tsx (read the stored state)
  - apps/web chat run-status banner (show 'waiting for approval' for a run paused on an approval, not 'could not finish')
  - Retry handler in the chat composer (do not add a second user bubble)
- Reach: Anyone who lets a bot move money. Contradictory payment outcomes in one thread.
- Acceptance criteria:
  - One user, clean thread: one payment request leads to exactly one live card even when the bot messages the Mercury agent twice; the older card reads 'No longer active' and has no buttons, also after reload.
  - Deny the newer card: the older card stays inactive and cannot be approved; the thread never shows both 'denied' and 'Submitted' for one request.
  - A run paused on an approval shows 'Waiting for approval', not 'This agent could not finish', after a reload.
  - If a delegate run fails after creating an approval, that approval is expired and the error says nothing was sent; Retry does not add a second identical user bubble.
  - One outcome message per delegated request (interim relay message replaced by the final one).
- Needs product decision: false
- Depends on: none
- Conflicts with: C4 (executor relay wording) only if C4 touches executor.ts

### C2 [P1] Failed Send on a drafted reply gives no way forward and the agent blames the original message
- Rank: 2. Effort: S.
- Finding ids (found by): J3-01 (J3)
- Root cause: Observed on a phone (J3). The Mail card shows 'Open in composer' after a failed send only when both onOpenComposer and mail.connectionId exist (MailApprovalCard.tsx:477). In the per-email agent panel one is missing, so after 'Message not found' the user has no next step. The agent's follow-up also says the original message was not found, which describes a different failure than a failed send.
- Verification: Observed on the demo; the 'Message not found' trigger may be mock Gmail data (unverified). The missing recovery button is confirmed in code at apps/web/src/components/MailApprovalCard.tsx:477.
- Files:
  - apps/web/src/components/MailApprovalCard.tsx (always show Open in composer on failed; fall back to the thread's account when connectionId is missing)
  - the email agent panel that renders MailApprovalCard (pass onOpenComposer and the thread account)
  - email agent failure wording in apps/api/src/inbox-agent.ts (say the send failed, not that the original is missing)
  - apps/web/src/components/MailApprovalCard.test.tsx
- Reach: Everyone who sends a reply through the agent; a failed send is a dead end.
- Acceptance criteria:
  - Failed send in the email agent panel shows the error plus an enabled 'Open in composer' that opens the draft with To/Subject/Body filled.
  - With connectionId missing, the button still appears and uses the thread's account.
  - The agent's follow-up text says the send failed and the draft is kept; it does not say the message was not found.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C3 [P1] Investors and Fundraising show different SAFE lists and totals; Equity raised is a dash
- Rank: 3. Effort: M. Reopens: iteration 11 C14.
- Finding ids (found by): R2-12-05 (R2), J2-06 (J2)
- Root cause: Observed (R2): Investors lists 4 SAFEs ($350k), Fundraising 2 ($300k), Equity raised '-'. Same money, two totals. J2 also saw the same $50,000 SAFE under two names (investor entity versus person). The two pages read different queries.
- Verification: Observed in the UI. Code candidates: apps/api/src/fundraising.ts, apps/api/src/investor-portal.ts, packages/adapters/src/safe-sync.ts, apps/web/src/pages/Investors.tsx. Not traced. Pages are partly owned by the redesign session, so coordinate before editing.
- Files:
  - apps/api/src/fundraising.ts and the Investors SAFE query (one shared SAFE list function)
  - apps/web/src/pages/Investors.tsx (cap section, conversion block display name)
  - apps/web/src/components/investors/Placeholders.tsx (Equity raised tile)
  - regression test in apps/api for table count equals Fundraising count equals Equity raised
- Reach: Anyone preparing a raise or board update; wrong totals.
- Acceptance criteria:
  - Investors table, conversion block, Fundraising and Equity raised read one SAFE list and show the same count and total.
  - Equity raised shows the SAFE total, not a dash, when SAFEs exist.
  - One display name per SAFE in table and conversion block.
- Needs product decision: true. Which record is the source of truth for SAFEs when manual Investors rows, Mercury and Carta disagree? (Project memory says Mercury is the only SAFE record.)
- Depends on: none
- Conflicts with: redesign session owning Investors/Fundraising pages

### C4 [P1] Chief says '0 open to-dos' while the Inbox To do card lists 5
- Rank: 4. Effort: S. Reopens: iteration 11 C3 (counts part), C4 (link).
- Finding ids (found by): R1-02 (R1), R1-07 (R1)
- Root cause: Observed (R1): the count Chief reports comes from a different source than the Inbox To do card ('17 need a reply' matches). Also on a user denial the reply ends with an 'Open Integrations' link that has no purpose.
- Verification: Observed. Count tool not located; start in apps/api/src/inbox-agent.ts and the Chief tools that return mailbox counts, then compare with the query the To do card uses.
- Files:
  - apps/api/src/inbox-agent.ts (or the Chief count tool; use the To do card's source)
  - apps/api/src/integration-agent.ts / finance-agent.ts (drop the Integrations link on a user-denied outcome)
  - regression test: count equals To do card length
- Reach: Anyone asking Chief for a morning summary; a wrong number is read as fact.
- Acceptance criteria:
  - Chief's open to-do count equals the number of items on the Inbox To do card for the same mailbox.
  - A denied-by-user reply has no 'Open Integrations' link.
- Needs product decision: false
- Depends on: none
- Conflicts with: C1 if both edit packages/adapters/src/executor.ts

### C5 [P2] Inbox list reshuffles under the finger while late sorting arrives
- Rank: 5. Effort: M.
- Finding ids (found by): J3-03 (J3), V2-04 (V2)
- Root cause: Observed (J3 on a phone, V2 on desktop). Roughly 20-40 s after load rows move: Needs reply grew from 6 to 9 rows, Other mail vanished, the unread count changed, the status line height changed, and rows left Important one at a time. Rows are re-grouped as each classification lands.
- Verification: Observed. Late classification is suspected; apps/web/src/pages/Inbox.tsx (group build near 1759-1795, sorting status line).
- Files:
  - apps/web/src/pages/Inbox.tsx (hold the visible grouping while sorting; apply the new grouping once, on completion, or on next pull or tap)
  - fixed-height sorting status line
- Reach: Every first-run user and any returning user whose mail arrives while sorting.
- Acceptance criteria:
  - While sorting, a row does not move more than once; the status line has a fixed height.
  - Sorted grouping appears in one swap, without a tap landing on a different row.
- Needs product decision: false
- Depends on: none
- Conflicts with: C16 (same file)

### C6 [P2] Finance on a phone: company switcher clipped or overlapping the Ask button, and the sync chip is cut
- Rank: 6. Effort: S. Reopens: iteration 11 C26 (phone).
- Finding ids (found by): V2-03 (V2), J3-02 (J3), J3-09 (J3)
- Root cause: Observed at 375 px: on Accounts the company switcher's right edge is at 389 px (V2); on a vendor detail (back header) the 'Northwind Robotics' label runs under Ask by 62 px (J3); the sync status truncates to 'Mercury, Brex . synced ju...' (J3). The CompanyMenu wrapper has max-sm:min-w-0 flex-1 in the non-back header, but the trigger inside keeps shrink-0 and the back header row does not give it room.
- Verification: Observed. Code: apps/web/src/components/finance/ui.tsx:113 (shrink-0 trigger) and ui.tsx:380-409 (CompanyMenu in the back-header row). The J3 walker rated J3-02 P1; downgraded to P2 because the page stays usable, Ask is still reachable by tab.
- Files:
  - apps/web/src/components/finance/ui.tsx (back-header row: company gets min-w-0 flex-1 and truncates; remove shrink-0 on the trigger)
  - Finance header status text (drop 'Mercury, Brex' on phone)
  - apps/web/src/components/finance/ui.test.tsx or a story at 375 px
- Reach: Finance on phones.
- Acceptance criteria:
  - At 375 px on Accounts and a vendor detail: no element extends past the viewport and the company label never overlaps Ask (geometry audit overflowSpills = 0).
  - The sync chip shows 'synced just now' without truncation.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C7 [P2] Legal Contracts: Renewal still cut, own company listed first in Parties, only the title cell is clickable
- Rank: 7. Effort: S. Reopens: iteration 11 C10 (residual).
- Finding ids (found by): R1-06 (R1), J2-03 (J2), J2-04 (J2), V2-05 (V2), V2-07 (V2)
- Root cause: Observed by four walkers. The Renewal cell uses truncate while Contract and Parties wrap, and Status keeps width when empty; withoutSelf drops only an exact name match so 'Northwind Robotics (Mock)' stays first and hides the counterparty; only the title cell opens the PDF and the row hover suggests the whole row does, with no way back to Legal except the browser.
- Verification: Confirmed in code: apps/web/src/pages/legal/LegalContracts.tsx:98-102 (withoutSelf exact match) and :218 (truncate on the Renewal cell).
- Files:
  - apps/web/src/pages/legal/LegalContracts.tsx (Renewal cell wraps to two lines; normalized self match; row opens the contract)
  - apps/web/src/pages/legal/LegalContracts.test.tsx
  - contract open target (add a 'Back to Legal' crumb)
- Reach: Anyone using Legal.
- Acceptance criteria:
  - Renewal text 'Auto-renews, 30 days notice' is fully visible at 1440 (wraps, no ellipsis).
  - A company name with '(Mock)' or 'Inc.' suffix is filtered from Parties; the counterparty is first.
  - Clicking anywhere on a contract row opens it; the opened view has a way back to Legal.
- Needs product decision: false
- Depends on: none
- Conflicts with: C19 (same page)

### C8 [P2] Routine created from '/skill ...' keeps '@skill Use the skill ...' in the instruction and leaves 'Add a skill' empty
- Rank: 8. Effort: S. Reopens: iteration 11 C5 (forced skill part).
- Finding ids (found by): R1-04 (R1), R1-05 (R1), J2-07 (J2)
- Root cause: Observed (R1): the forced skill is written into the instruction text instead of the routine's skill field. Also the run history shows 'Done / View chat' and not the result, and the user's own skill is listed last after 11 built-ins.
- Verification: Observed. Suspected location packages/adapters/src/schedule-tools.ts; apps/web/src/pages/RoutineEditor.tsx skill select.
- Files:
  - packages/adapters/src/schedule-tools.ts (save skill on the routine, strip the @skill prefix)
  - apps/web/src/pages/RoutineEditor.tsx (user skills first; first line of result under a history entry)
  - adapters test
- Reach: Anyone creating routines by slash command.
- Acceptance criteria:
  - A routine created from '/investor-update every Friday at 4pm' shows the skill in 'Add a skill' and a plain instruction.
  - The user's own skills are listed first.
  - History entry shows the first line of the result.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C9 [P2] Toasts sit over the open right-hand panel and over list rows
- Rank: 9. Effort: S.
- Finding ids (found by): FLOW-02 (FLOW), V3-14 (V3), J2-10 (J2)
- Root cause: Observed (FLOW, V3, J2). The persistent approval toast covers the lower half of the bot panel and hides the instructions field of the New skill form; on phone non-chat pages the reserved bottom offset covers a list row; upload toasts sit over the last Data room rows. The decision (toasts persist, bottom-right) stays; only the position changes.
- Verification: Observed. Toast host in apps/web/src/pages/Shell.tsx (suspected, not traced).
- Files:
  - toast host and its offset in the shell
  - upload toast (auto-dismiss completed uploads after about 8 s)
- Reach: Anyone with an approval pending while editing a bot.
- Acceptance criteria:
  - With a right panel open the toast stack is left of the panel; no panel field is covered at 1440.
  - On a phone page without a composer, the toast uses no composer offset.
  - Completed upload toasts disappear after about 8 s.
- Needs product decision: false
- Depends on: none
- Conflicts with: C1 none; Shell.tsx hotspot with C17

### C10 [P2] Data room on a phone: three-row header (about 235 px) and a row checkbox drawn over the file icon
- Rank: 10. Effort: M. Reopens: iteration 11 C22 (phone).
- Finding ids (found by): J3-05 (J3), J3-06 (J3), V3-01 (V3), V3-07 (V3)
- Root cause: Observed. Title, subtitle, search, folder button, view toggles, 'All items' path row and the import notice take 235 px of 812 (V3), 195 px in J3; the path row repeats the folder button; on Stats the empty search row remains. On touch the always-visible 18 px checkbox is drawn translucent over the type icon so it reads as a bordered icon.
- Verification: Observed. apps/web/src/pages/DataRoom.tsx:791 (PathBar) and toolbar; apps/web/src/components/data-room/ItemRows.tsx:331-345.
- Files:
  - apps/web/src/pages/DataRoom.tsx (hide the root path row on phones; move the view toggle into Filters; collapse the empty search row on Stats)
  - apps/web/src/components/data-room/ItemRows.tsx (opaque checkbox with a clear empty box on touch)
  - data-room stories at 375 px
- Reach: Data room users on phones.
- Acceptance criteria:
  - At 375 px the first file row starts within 160 px of the top.
  - The root path row is hidden; it appears inside a folder.
  - On touch the checkbox is a distinct empty box; hit area stays 44 px.
- Needs product decision: false
- Depends on: none
- Conflicts with: C11, C18 (same files)

### C11 [P2] Data room: Select all covers only the 50 loaded rows, a finished file with no type has no status, the selection bar shifts the table
- Rank: 11. Effort: M.
- Finding ids (found by): V3-04 (V3), J2-02 (J2), V3-06 (V3)
- Root cause: Observed. 'Select all' says '50 selected' while the room holds 69; the bar inserts a 41 px row; one finished file stays Type '-' with no reason (seed artifact possible); opening a folder moves the column header 9 px and removes the Status column.
- Verification: Observed. apps/web/src/pages/DataRoom.tsx near the Load more button (about line 891), PathBar.tsx, ItemRows.tsx (showStatus).
- Files:
  - apps/web/src/pages/DataRoom.tsx (50 of 69 selected, Select all 69; bar overlays)
  - apps/web/src/components/data-room/ItemRows.tsx (status text 'Not tagged' / 'Couldn't read' for a finished untyped file; stable column set)
  - apps/web/src/components/data-room/PathBar.tsx (fixed height)
- Reach: Anyone bulk-downloading or emailing from the Data room.
- Acceptance criteria:
  - After Select all the bar says how many of the total are selected and offers Select all N.
  - The bar does not move the table.
  - Every finished file shows a type or a reason.
  - Entering a folder does not move the column header.
- Needs product decision: false
- Depends on: none
- Conflicts with: C10, C18

### C12 [P2] Accessible names, touch targets, contrast and focus
- Rank: 12. Effort: M.
- Finding ids (found by): J1-01 (J1), J3-08 (J3), J3-04 (J3), V2-08 (V2), V3-13 (V3), V1-06 (V1), J3-07 (J3), V3-10 (V3), V1-22 (V1)
- Root cause: Observed. Gmail and Calendar cards both have a button named only 'Connect' (J1); every Inbox row '...' is named 'More' (J3); the To do checkbox is 20x20 on touch, next to a title button (J3, breaks the owner rule of 44 px on coarse pointers); the Finance sync chip's accessible name does not start with its visible text (V2); the Resize handles show no focus ring (V3); the sidebar Search placeholder is 3.0:1 (V1); the drawer opens with focus in the Search field (J3, V3); page rows in the sidebar are not tab stops (V1, judged a valid roving pattern, only a hint is missing).
- Verification: Confirmed in code for J1-01 (apps/web/src/pages/shell/message-cards.tsx:259-266 button has no aria-label) and J3-08 (components/inbox/InboxRow.tsx:439 aria-label={t`More`}). Others observed.
- Files:
  - apps/web/src/pages/shell/message-cards.tsx (aria-label Connect {name})
  - apps/web/src/components/inbox/InboxRow.tsx (More actions for {sender})
  - Inbox To do card checkbox (44 px target as in ItemRows.tsx:331-345)
  - apps/web/src/pages/Shell.tsx (placeholder colour, drawer initial focus to the close button on touch)
  - DataRoom.tsx folders separator and sidebar resize button (focus style)
  - Finance sync link accessible name
- Reach: Screen reader and touch users on every page.
- Acceptance criteria:
  - Connect buttons are named 'Connect Gmail' and 'Connect Google Calendar'.
  - Row menu buttons are named per sender.
  - To do checkbox measures 44 px under pointer: coarse.
  - Search placeholder at least 4.5:1.
  - Opening the phone drawer does not focus Search.
  - Resize handles show a focus ring.
- Needs product decision: false
- Depends on: none
- Conflicts with: C17, C9 (Shell.tsx)

### C13 [P2] Draft reply on Investors Action items only dims; no 'Drafting' indicator
- Rank: 13. Effort: S. Reopens: iteration 11 C13 (indicator part).
- Finding ids (found by): R2-12-03 (R2)
- Root cause: Observed (R2): disabled=true at 1.2 s, label unchanged, no spinner.
- Verification: Observed. apps/web/src/components/investors/ActionItems.tsx:73.
- Files:
  - apps/web/src/components/investors/ActionItems.tsx
  - its story
- Reach: Anyone drafting investor replies.
- Acceptance criteria:
  - While audit.drafting the button shows a spinner and 'Drafting...'.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C14 [P2] Settings > Models: OpenRouter shows 'In use' while text says 'Your bots use OpenAI'; on a phone the current model sits below the provider list
- Rank: 14. Effort: S. Reopens: iteration 11 C16.
- Finding ids (found by): R2-12-06 (R2), V1-03 (V1), V1-04 (V1)
- Root cause: Observed (R2, V1). The code comment says the provider in use may rely on the server's credentials, so any provider in inUseProviderIds shows 'In use'; the demo fixture may mark the wrong one. Phone order puts the six-row list first.
- Verification: Observed; may be a demo fixture. apps/web/src/pages/ModelSettingsOverlay.tsx:299-304 and :789-792.
- Files:
  - apps/web/src/pages/ModelSettingsOverlay.tsx (In use only on the active model's provider; system model says 'Included'; current-model line first on phones)
- Reach: Anyone changing models.
- Acceptance criteria:
  - 'In use' appears on exactly one provider, the one of the active model.
  - At 375 px the current-model line is above the provider list.
- Needs product decision: false
- Depends on: none
- Conflicts with: C25 (settings files)

### C15 [P2] Privacy switches show 'Allow AI models' off while Chief answers
- Rank: 15. Effort: S.
- Finding ids (found by): V1-02 (V1)
- Root cause: Observed (V1): for a fresh user Allow AI models, GPT-6 Luna and Documents are all off, yet Chief answered, so message text reached a model. Probably the system model is exempt from the switch on the demo; the screen does not say so.
- Verification: Observed switch states; the exemption is suspected. apps/web/src/components/AiDataSharing.tsx and the chat consent check, not traced. P1 not supported: no walker saw data go to a model the user chose to block; the question is what the switch means.
- Files:
  - apps/web/src/components/AiDataSharing.tsx (label or state for the system model)
  - chat consent check (only if the switch is meant to gate chat)
- Reach: Every new user reading the Privacy page.
- Acceptance criteria:
  - The Privacy page matches behavior: either chat is blocked until consent, or the system model row says it is included.
- Needs product decision: true. Is chat with the built-in system model meant to be gated by 'Allow AI models'? If not, how should the screen say so?
- Depends on: none
- Conflicts with: none

### C16 [P2] Inbox Important: 17 'Needs reply' rows push today's mail down; Updates has no day headings; no attachment mark
- Rank: 16. Effort: S.
- Finding ids (found by): FLOW-01 (FLOW), R3-12-02 (R3), V2-13 (V2)
- Root cause: Observed. The group Needs reply lists 17 messages back to Oct 10, and the two newest mails sit in 'Other mail today' with a 'Needs attention' chip after them (FLOW); Updates has no day groups while Important does (R3); a row with an attachment shows '(PDF attached)' only in the subject (V2).
- Verification: Observed. apps/web/src/pages/Inbox.tsx:1759-1795 (groups) and components/inbox/InboxRow.tsx:227 (label).
- Files:
  - apps/web/src/pages/Inbox.tsx (cap Needs reply, or order by recency; same day grouping on every pile)
  - apps/web/src/components/inbox/InboxRow.tsx (paperclip)
- Reach: Daily inbox users.
- Acceptance criteria:
  - The first screen at 1440x900 shows today's mail needing action.
  - Every pile uses the same grouping headings.
  - Rows with attachments carry a paperclip.
- Needs product decision: true. Show at most five 'Needs reply' rows with 'Show N more', or keep all and sort by recency?
- Depends on: none
- Conflicts with: C5 (Inbox.tsx)

### C17 [P2] Routines panel: empty '<bot>'s computer' heading and a blank box, hidden 'Open', monitor icon
- Rank: 17. Effort: S. Reopens: iteration 11 C29.
- Finding ids (found by): R3-12-01 (R3), J2-08 (J2), V1-05 (V1)
- Root cause: Observed by three walkers. The panel title was fixed, but a computer section remains for a bot without a computer session: a heading above a blank 343x214 box whose only control (Open) is hover-only. The Routines button uses a monitor icon.
- Verification: Observed. apps/web/src/pages/Shell.tsx around 6100-6170 and the button near 5762.
- Files:
  - apps/web/src/pages/Shell.tsx (render the computer section only while a session exists; clock icon)
- Reach: Anyone opening Routines on a bot.
- Acceptance criteria:
  - With no computer session the panel shows no computer heading and no blank box.
  - Routines button uses a clock or repeat icon.
- Needs product decision: false
- Depends on: none
- Conflicts with: C9, C12 (Shell.tsx)

### C18 [P3] Data room text: bare dash for a missing type, '2 files' with one name, Failed card not clickable, counts
- Rank: 18. Effort: S. Reopens: iteration 11 C23 (label part).
- Finding ids (found by): J3-10 (J3), V3-12 (V3), V3-03 (V3), V3-05 (V3), R3-12-05 (R3)
- Root cause: Observed. Rows with no type show '- . Added Oct 22, 2026'; the import notice says 'Imported 2 files' plus one file name; the Failed stat is plain text; Stats says Failed 2 while two rows were visible only partly (unconfirmed, parallel walkers).
- Verification: Observed. ItemRows.tsx meta line, data-room/format.ts:76, DataRoomStats.tsx.
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx
  - apps/web/src/components/data-room/format.ts
  - apps/web/src/components/data-room/DataRoomStats.tsx
- Reach: Data room users.
- Acceptance criteria:
  - No dash or leading dot when type is empty.
  - Notice names every file or shows the count with a View link.
  - Failed card is a button that filters to failed files.
- Needs product decision: false
- Depends on: none
- Conflicts with: C10, C11

### C19 [P3] Legal dates and deadline copy: raw ISO dates, repeated derivation note, no result after Scan now
- Rank: 19. Effort: S.
- Finding ids (found by): J1-03 (J1), R1-09 (R1), V2-06 (V2), J2-05 (J2)
- Root cause: Observed. Notice rows say 'Renews automatically on 2026-12-10' while the row date reads 'Nov 10, 2026' (code: packages/adapters/src/legal-tools.ts:412); the sidebar preview shows 'Overdue 2026-10-17'; every derived row repeats 'Derived from the expiration date and the notice period.'; Scan now showed no result when nothing was new (suspected).
- Verification: Confirmed in code for the ISO date (legal-tools.ts:412). Others observed. The V2-14 action chrome is not filed (owner decision: Ask agent / Done / Dismiss).
- Files:
  - packages/adapters/src/legal-tools.ts:412 (format like the due date)
  - Legal agent notification text (apps/api/src/legal*.ts)
  - apps/web/src/pages/Legal.tsx (derivation note once per list; result line after Scan now)
- Reach: Legal users.
- Acceptance criteria:
  - No ISO dates in any Legal text.
  - The derivation note appears once.
  - Scan now always ends with a one-line result.
- Needs product decision: false
- Depends on: none
- Conflicts with: C7

### C20 [P3] First-run tour popover covers content and changes layout per stop
- Rank: 20. Effort: S. Reopens: iteration 11 C20 (residual).
- Finding ids (found by): FLOW-06 (FLOW), J1-06 (J1), R2-12-10 (R2), V1-16 (V1)
- Root cause: Observed. Stop 1 covers the 'Inbox' heading; stops 3, 5 and 7 cover the start of Chief's greeting; desktop Next y varies from 107 to 815; stop 9 swaps Skip for 'Ask Chief'; the popover has no arrow.
- Verification: Observed. apps/web/src/components/tour/TourPopover.tsx and FirstRunTour.tsx. Nine stops stays (owner decision).
- Files:
  - apps/web/src/components/tour/TourPopover.tsx
  - apps/web/src/components/tour/FirstRunTour.tsx
- Reach: Every new user.
- Acceptance criteria:
  - Popover never covers the page title or the first line of the chat at any stop.
  - Skip keeps its slot at stop 9; Ask Chief is in the body.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C21 [P3] Activity panel: heading and row label differ, list cut mid-row, status crowds the snippet
- Rank: 21. Effort: S. Reopens: iteration 11 C11 (residual).
- Finding ids (found by): R2-12-01 (R2), R2-12-02 (R2), V3-09 (V3), FLOW-03 (FLOW)
- Root cause: Observed. 'Needs you' heading over 'Needs your answer' (ActivityList.tsx:189); the list is cut mid-row; the label crowds the question snippet; an approval is called 'needs approval' in the toast and 'Needs your answer' in Activity (roster-status.ts:12-16).
- Verification: Confirmed in code for the heading text. Others observed.
- Files:
  - apps/web/src/pages/ActivityList.tsx
  - apps/web/src/lib/roster-status.ts
- Reach: Anyone using Activity.
- Acceptance criteria:
  - One label per state; 'Needs approval' for held approvals.
  - List ends on a whole row.
  - Status on its own line.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C22 [P3] Chief and agent answers: stale answer after bank connect, card plus repeated prose, UTC time, overlapping first-ask choices
- Rank: 22. Effort: S.
- Finding ids (found by): J1-04 (J1), J1-05 (J1), J2-09 (J2), FLOW-07 (FLOW)
- Root cause: Observed. After Mercury connects, Chief's 'no bank connected' answer stays last (J1); the Finance agent shows a card and a paragraph with unrounded cents (J1); the agent says '08:41 UTC' for an Eastern user (J2); first-ask choices B and D differ by one app (FLOW).
- Verification: Observed. apps/api/src/onboarding.ts:44-68, Finance agent response composition.
- Files:
  - apps/api/src/onboarding.ts
  - Finance agent prompt/response (apps/api finance tool card)
- Reach: First-week users.
- Acceptance criteria:
  - After the first bank connects, Chief posts one line with the runway.
  - Card or prose, not both, same rounding as the page.
  - Times in the user's zone.
- Needs product decision: true. Merge first-ask choices 'Day-to-day work' and 'A bit of everything' into one?
- Depends on: none
- Conflicts with: none

### C23 [P3] Wide tables and dead bands: Contacts, Data room at 1920, Subscriptions, empty tiles
- Rank: 23. Effort: S. Reopens: iteration 11 C26, C34 (residual).
- Finding ids (found by): V3-02 (V3), V3-08 (V3), V2-02 (V2), R3-12-03 (R3), V2-01 (V2), V2-10 (V2)
- Root cause: Observed. Contacts capped at 896 px leaves 650 px empty at 1920; Data room columns spread 500 px apart at 1920; the Subscriptions table is left-aligned in a 1070 px card (380 px empty); 'Card balance owed' is a tile holding a dash.
- Verification: Observed. Contacts.tsx:170, ItemRows.tsx, Finance.tsx, FinanceAccounts.tsx:320.
- Files:
  - apps/web/src/pages/Contacts.tsx
  - apps/web/src/components/data-room/ItemRows.tsx
  - apps/web/src/pages/Finance.tsx
  - apps/web/src/pages/finance/FinanceAccounts.tsx
- Reach: Wide-screen users.
- Acceptance criteria:
  - No empty band wider than 200 px at 1920 on these pages.
  - Card balance tile hidden unless a balance exists.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C24 [P3] Integrations cards: two button styles and letter tiles
- Rank: 24. Effort: S. Reopens: iteration 11 C19 (residual).
- Finding ids (found by): R2-12-08 (R2), R2-12-09 (R2), V1-11 (V1)
- Root cause: Observed. Blockscout and Coinbase keep a '...' slot so their buttons stop 32 px short; Carta, Treg, Devin, Granola and Wispr Flow show letter tiles; gutters differ (28 px left, 56 px right).
- Verification: Observed. apps/web/src/components/integrations/IntegrationsHome.tsx.
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx
  - logo assets
- Reach: Integrations page.
- Acceptance criteria:
  - All Connected cards share one button layout.
  - Equal gutters.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C25 [P3] Labels, menus and palette copy
- Rank: 25. Effort: S.
- Finding ids (found by): V1-19 (V1), FLOW-04 (FLOW), FLOW-05 (FLOW), FLOW-08 (FLOW), FLOW-09 (FLOW), R2-12-07 (R2), V1-09 (V1)
- Root cause: Observed. 'Unassigned' folder name; Clear conversation in both row menu and panel footer; Add skill asks for a method first; Settings 'Notifications' card holds one 'Browser notifications' switch; palette snippets show raw [text](url) (command-palette.tsx:31) and chat matches have no reason; four menus use four row heights.
- Verification: Confirmed in code for FLOW-09 (plainSnippet strips ** __ and backticks only). Others observed.
- Files:
  - apps/web/src/pages/BotContextMenu.tsx:114,152
  - apps/web/src/pages/shell/bot-panel.tsx:844
  - apps/web/src/pages/shell/BotSkillsSection.tsx:326-345
  - apps/web/src/components/NotificationSettings.tsx:58,79
  - apps/web/src/pages/shell/command-palette.tsx:31
- Reach: Daily users.
- Acceptance criteria:
  - 'No folder'.
  - Clear conversation in one place.
  - Add skill opens New skill.
  - Palette snippet shows link text only.
- Needs product decision: false
- Depends on: none
- Conflicts with: C14 (settings)

### C26 [P3] Visual polish: buttons, switches, cards, bubbles
- Rank: 26. Effort: M.
- Finding ids (found by): V1-12 (V1), V1-13 (V1), V1-14 (V1), V1-15 (V1), V1-17 (V1), V1-10 (V1), V1-20 (V1), V1-23 (V1), V1-21 (V1), V1-18 (V1), V1-08 (V1), V2-12 (V2), V2-09 (V2)
- Root cause: Observed. Primary hover looks disabled on dark; composer placeholder cut without ellipsis; Settings cards 293 of 375 px; switch rows laid out three ways; three card widths in the first-run thread; Models/Memory bare text; Memory not indented; panel header 4 px low; blank Gmail logos after reload; folder move changes Chief's time; four message icons under the first card at 375 px (suspected); a 'Messaged X' pill after every message; Financing marker not on its gridline (R3 saw it inside the plot).
- Verification: Observed. packages/ui-web/src/components/ui/button.tsx:14 and others.
- Files:
  - packages/ui-web/src/components/ui/button.tsx
  - apps/web/src/pages/Shell.tsx composer placeholder
  - Settings dialog body padding
  - chat card components
- Reach: Everyone, small effect.
- Acceptance criteria:
  - Hover keeps full opacity.
  - Placeholder ends in an ellipsis.
  - Settings cards use the full width minus one gutter.
- Needs product decision: false
- Depends on: none
- Conflicts with: C12, C14

## Deferred items (not in a cluster)
- Load time on a shared stack, not reproduced: V1-01 (Settings took 12-40 s to open once, lazy chunk on the dev server; add a loading state only if it repeats on a production build), J1-02 (Newsletters 30 s), R3-12-04 (Updates 12 s), V2-11 (Finance sub-pages 10-25 s), V3-11 (Data room 'Still opening'). Re-measure on an idle production build.
- R2-12-04 Empty Round and Pipeline ghost bars: page owned by the redesign session, recorded only.
- V2-14 Legal row actions repeat on every row: owner decision (Ask agent / Done / Dismiss).
- V2-06 second half (group far-future expiry rows under 'Later'): not filed, judgment call; repeated note is in C19.
- V1-22 sidebar roving tabindex is a valid pattern; only a hint is suggested in C12.
- J1-03 second half: seeded Insurance row says 'December 1' above 'December 2' is seed text, not product.
- Touch targets by R2, R3, FLOW, V1, V2, V3: agent-browser cannot set pointer: coarse, so these were not measured; only J3 measured (C12).
- V2-09 versus R3 C25: V2 saw the Financing marker off its gridline, R3 saw it inside the plot; kept as P3 suspected in C26.

## BLOCKED stories
- STORY-APP-309 / STORY-APP-319 model step and 'Connect your apps' (demo has a model; real provider sign-in unverified).
- STORY-INB-022 steps 4-14: sorting never finishes for a fresh user on the demo (no model). Pass-11 C3 'still sorting' state and C27 new-mailbox timer also unverifiable.
- Pass-11 C28 runtime answers (needs a fresh user without a bank), C24 upload stall state, C8 on a clean user with mailbox and model, C6 with Chief as requester, C7 reviewed-value protection.
- Real OAuth: Gmail/Calendar/Slack Connect, Carta connect (STORY-CAP-017/106 first step), Box/email import.
- Not walked: password zip, 600 MB video, 1.2 GB zip; skill drafted by the agent and approved (APP-363 steps 3-9); 'Allow changes in Mercury' dialog; held 'Share with {name}?' card; STORY-APP-024 and 213 (skipped); J3 Models/Memory tabs and phone tour (time).

## Counts by severity
- Clusters: 26 (P0 0, P1 4, P2 13, P3 9)
- Distinct finding ids in clusters: 102
- Needs a product decision: C3, C15, C16, C22
- P1: C1, C2, C3, C4
