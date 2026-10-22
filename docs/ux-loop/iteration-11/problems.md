P0: 0, P1: 6, P2: 21, P3: 7

# Iteration 11 problems: fix clusters

Sources: R1-R3 (verify pass-10 clusters C1-C26), J1-J3 (journeys, J3 at phone width), FLOW, V1-V3, on the mock demo stack (web 5381, API 3308). Read: docs/ux-flow/report.md, docs/ux-visual/problems.md, iteration 1-10 problems.md. Findings were deduplicated across walkers (the 'Found by' prefixes show who saw each one). Claims were checked against code where cheap; each cluster says observed or suspected.

Owner decisions respected and not raised: tour stays nine stops; Devin hidden until connected; the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Hide amounts is a stable checkbox row in the account menu; Settings in five sections with Memory under Advanced; the palette is the one search surface; Legal row actions Ask agent / Done / Dismiss (so V2-03 is dropped); approval toasts persist until dismissed; no model step in onboarding on the demo; Personal and New space hidden for a solo account.

Environment caveats: the mock founder account was shared by up to nine walkers at once, so Chief, Mercury and Investors threads, consent and bot settings changed under every walker. Load times on a shared dev stack are not evidence. Commit d865d7484 (one live approval card per payment request) merged 25 minutes before the walks; it is not known whether the running API had restarted onto it.

Severity calls: no P0. R1-01 (duplicate payment cards) was reported P0 but all three sightings are on one shared Mercury thread where walkers each asked for the same $1,250 payment, no money moved, and no card resolved without a click, so it is P1 until one user reproduces it. V3-01 (Activity window) and V3-02 (Stats chart on phone) were reported P1 and are P2: opt-in and secondary views. R1-05 and R1-09 were reported P1: R1-05 is P2 (seen once, J1 saw the expected states) and R1-09 is deferred (load time, not reproduced). J2-01 (no Undo on Legal Done) is P1: confirmed in code and it contradicts the iteration-9 and iteration-10 claim that Undo exists.

## Pass-10 clusters verified (R1-R3)
Met (iteration-10 ids): C5 Connect Gmail (2 clicks), C14 chat wording, C17 phone message actions (44x44), C19 bot settings panel, C22 Data room toolbar and share, C24 Chief and onboarding links (leftovers in new C28), C25 palette (leftovers in new C18), C26 page agents hidden for new users, Storybook smoke 1714/1714, C12 Hide amounts control.
Met in part and reopened (old -> new ids): C1 -> C1/C4, C2 -> C6, C3 -> C8, C4 -> C27, C6/C7 -> C7 and C10, C9 -> C11, C10 -> C14, C11 -> C13, C12 -> C26, C13 -> C12, C15 -> C29, C16 -> C21, C18 -> C11, C20 -> C16, C21 -> C19, C23 -> C20. C8 (toast placement) was met apart from covering part of one chat bubble at 1440 (no cluster; the toast does not cover the composer).
Items fixed since iteration 10 (FLOW): Legal for a fresh user is one sentence and Add files; new users' sidebar shows only Chief; Settings General is shorter; the Investors agent links to Settings; Privacy is one master switch with Advanced.

## Fix clusters, ranked

### C1 [P1] One payment request can still leave two approval cards, and the agent then reports an outcome that matches neither
- Rank: 1. Effort: M. Reopens: iteration 10 C1 (was P0, falls to P1 as that cluster specified)
- Finding ids (found by): R1-01 (R1), J2-03 (J2)
- Root cause: Suspected. Three walkers (R1, J2, V2) saw two identical $1,250 cards for one request, one Approved and one Denied, and an agent message 'not submitted: denied' next to an Approved card. All walked the same shared Mercury thread at the same time and may each have asked for the payment, so two legitimate requests are possible. Commit d865d7484 ('Keep one live approval card per payment request when a run resumes') merged at 02:34, shortly before the walks, and it is not known whether the running API had it loaded. P0 is not supported: no walker saw money move or a card resolve without a click this iteration (the iteration-10 'relayed Yes resolves a card' concern was not seen again). Stays P1 until a single-user repro.
- Verification: Suspected. Code: the pause path is packages/adapters/src/executor.ts:3980-4010 (pauseForAsk). 'No longer active' wording exists in apps/web/src/components/AskCard.tsx and apps/mobile/app/thread.tsx, so the superseded-card state exists. Not reproduced by one user. First step is to restart the API and worker from current main, then repeat with one user.
- Files:
  - packages/adapters/src/executor.ts (pauseForAsk, resume; only if the repro still shows two live cards)
  - packages/adapters/src/executor-approval-replay.test.ts (regression: resume reuses the pending card; denying a superseded card does not rewrite an approved outcome)
  - apps/web/e2e/approval-resume.spec.ts (already covers resume; extend if needed)
- Reach: Anyone who lets an agent pay a bill. A wrong or contradictory result is about money.
- Acceptance criteria:
  - Repro with one user on a clean thread after restarting API and worker from main: ask for one payment, reload mid-run, press Send once: exactly one live card, any older card reads 'No longer active' and cannot be pressed.
  - Final agent message names the outcome of the approved card only.
  - If the repro stays clean, close the cluster as 'two walkers, two requests' and say so in the PR.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C2 [P1] Legal Done and Dismiss show no Undo line: the line is rendered inside the list that the refetch just removed the row from
- Rank: 2. Effort: S. Reopens: iteration 9 J2-04 and iteration 10 J2-07 (wrongly dropped)
- Finding ids (found by): J2-01 (J2)
- Root cause: Confirmed in code. LegalDeadlines.tsx close() calls onChanged() (overview.reload) after setting undo. The server returns only open deadlines (apps/api/src/legal.ts:51, status open), so after the reload `deadlines` no longer contains the closed row and the undo slot, which is rendered inside deadlines.map (line 151-162), never appears. J2 saw no Undo at 0 s, 1 s and in 3 screenshots. A mis-tap on Done cannot be reversed.
- Verification: Observed by J2 (3 rows) and confirmed in code: apps/web/src/pages/legal/LegalDeadlines.tsx:62-70 (reload after close), :151-162 (undo rendered only for rows still in `deadlines`), apps/api/src/legal.ts:51 (open only). Iteration 9 J2-04 and iteration 10 J2-07 were dropped as 'Undo exists, 30 s'; that claim was true only before the refetch was added.
- Files:
  - apps/web/src/pages/legal/LegalDeadlines.tsx (render the undo line from the `undo` state at the closed row's position, not from the refetched list; or keep closed rows in local state until the timer ends)
  - apps/web/src/pages/legal/LegalDeadlines.stories.tsx (story with a parent that drops the row on onChanged)
  - a unit test with a parent that removes the row after onChanged
- Reach: Every Legal user who closes a deadline.
- Acceptance criteria:
  - Failing test first: parent removes the deadline on onChanged; the 'Marked ... done. Undo' line is still shown.
  - Undo restores the row in its place within 30 s; after 30 s the line disappears.
  - Row height does not jump when the line replaces the row.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C3 [P1] Chief's first answer states counts while the mailbox is still being sorted, and says one thing in two bubbles
- Rank: 3. Effort: M. Reopens: none
- Finding ids (found by): J1-02 (J1), J1-03 (J1)
- Root cause: Chief delegates to the Inbox agent and relays its answer even when the sort has not finished, so a new user is told, in bold, that no emails need a reply and there are no open to-dos. Two minutes later Inbox shows 9 and 5. Not located in code; suspected in the delegation prompt or relay.
- Verification: Observed by J1 on the demo (a11-reply2.png vs b06-retry.png). The cause was not traced; sorting state is available to the web page (Inbox.tsx:295-300), so the agent side needs the same signal.
- Files:
  - apps/api/src/inbox-agent.ts or the Inbox tools in packages/adapters (find where counts are read; grep triage status)
  - Chief delegation prompt / relay (apps/api/src/chief*.ts or executor relay)
  - packages/adapters/src/executor.ts only if the two-bubble duplicate comes from the relay
- Reach: Every new user whose first question is asked during the first sort (the recommended first-run path).
- Acceptance criteria:
  - While the first sort is running, the answer says Praci is still sorting the mail and gives no counts.
  - After the sort the same question gives counts that match Inbox.
  - A delegated reply produces one bubble, not two that say the same thing.
- Needs product decision: false
- Depends on: none
- Conflicts with: C27 (Inbox sort state)

### C4 [P1] Money requests through Chief give instructions that are wrong or contradict each other
- Rank: 4. Effort: M. Reopens: iteration 10 C1 (wording part)
- Finding ids (found by): J2-02 (J2), V2-10 (V2), R1-10 (R1)
- Root cause: The agent text for a failed or pending payment is partly fixed wording, not the tool's real reason. J2: Chief says 'Turn on Allow changes for Mercury under Integrations' while that switch is already on and the real problem is a missing recipient; the Mercury agent then ends with 'Open Settings', which cannot add a recipient. V2: Chief posts an interim 'asked Mercury to pay $300 ... no confirmation yet' and then 'Mercury did not submit ... a different payment ($1,250) is pending', so Maya cannot tell whether anything is pending.
- Verification: Observed by J2, V2, R1. Fixed wording is at apps/api/src/finance-agent.ts:14-15 and apps/api/src/integration-agent.ts:27; the 'Open Settings' link near packages/adapters/src/executor.ts ~8358 (R1 reading, not re-verified).
- Files:
  - apps/api/src/finance-agent.ts:14-15 and apps/api/src/integration-agent.ts:27 (report the tool's actual reason; drop the fixed 'turn on Allow changes' sentence unless the switch is off)
  - packages/adapters/src/executor.ts near the no-recipient reply (link to Contacts, not Settings)
  - Chief relay prompt (one outcome message per request; replace the interim message when the final one arrives)
- Reach: Anyone paying a bill through Chief.
- Acceptance criteria:
  - A missing recipient is reported as a missing recipient with a link to Contacts (or no link); 'Allow changes' is named only when it is off.
  - Chief posts one outcome per payment request: requested, not submitted (with reason) or approved.
  - Chief tells the user to ask the Mercury agent when Chief itself lacks access.
- Needs product decision: false
- Depends on: none
- Conflicts with: C1 (executor.ts)

### C5 [P1] Routine 'Test run' does not do the work, and a skill forced when creating the routine is not saved on it
- Rank: 5. Effort: M. Reopens: none (new in iteration 11)
- Finding ids (found by): J2-05 (J2), J2-06 (J2), J2-13 (J2)
- Root cause: Suspected. J2: Test run on a new routine answered 'already active with those instructions' and the history says Done, but no investor note was drafted. The stored routine prompt begins with the schedule sentence ('Every Monday at 9:00 AM ... draft and post'), so a test run reads it as a scheduling request. The routine was created from a message that forced /weekly-investor-note, but the editor's 'Add a skill' is empty, so the forced skill is not stored.
- Verification: Observed by J2 (b13, b14, b12, b8); cause suspected from the saved prompt text. The J2-13 approval summary (raw 'repeats: / next run: / prompt:' lines) is the same schedule tool.
- Files:
  - packages/adapters/src/schedule-tools.ts (store only the task as the routine prompt; save the forced skill; build the approval summary)
  - routine run path for Test run (a flag that means 'do the work now'; locate with grep for the Test run handler in apps/api)
  - apps/web routine editor only if the skill list needs the stored skill shown
- Reach: Anyone who sets up a recurring task (investor update, weekly digest).
- Acceptance criteria:
  - Failing test first: a routine saved from 'Every Monday at 9 draft X' stores 'draft X' as its prompt and the schedule separately.
  - Test run produces the actual output in the chat and the history entry shows it.
  - A routine created with a forced skill shows that skill in 'Add a skill'.
  - The approval card leads with 'Every Monday at 9:00 AM, posts here'; the prompt sits under Details.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C6 [P1] An approval raised by Chief for the Mercury agent gives no toast, also after a reload
- Rank: 6. Effort: M. Reopens: iteration 10 C2
- Finding ids (found by): R1-02 (R1)
- Root cause: Observed. The approval toast list is built from run notifications in the current page session and only for the bot that raised them, so an approval held by the Mercury agent on a request from Chief is not announced, and a live card does not rebuild its toast after a reload. R1 saw neither a toast for the Chief-raised payment nor one after reload.
- Verification: Observed by R1 (16-pay8.png, 20-finance-toast.png). Code: apps/web/src/lib/approval-toasts.ts (toasts keyed per run; the file is the sync point at line ~70). The 'Legal agent needs an answer' toast works, so the mechanism exists.
- Files:
  - apps/web/src/lib/approval-toasts.ts (rebuild toasts from unanswered approvals on load; carry the holding bot and thread)
  - apps/web notifyRun consumer in Shell.tsx only if it passes the wrong bot
  - apps/web/src/lib/approval-toasts.test.ts
- Reach: Anyone with a payment or share waiting on a click in another chat.
- Acceptance criteria:
  - Failing test first: with a live unanswered approval on load, one toast exists and opens that chat.
  - A Chief-raised payment held by the Mercury agent raises a toast that opens the Mercury chat.
  - Answering the card clears the toast.
- Needs product decision: false
- Depends on: none
- Conflicts with: C9 (approval card)

### C7 [P2] Legal 'Scan now' is enabled without consent and reports nothing about the rows it changed
- Rank: 7. Effort: S. Reopens: iteration 10 C6 and C7 (partly met)
- Finding ids (found by): R1-03 (R1), R1-04 (R1)
- Root cause: Confirmed in code: Legal.tsx:210 `scanDisabled = running`, so the button works while needsConsent is true. After a scan a Draft contract row appeared with no 'N rows changed' sentence and no Undo.
- Verification: R1-04 confirmed at apps/web/src/pages/Legal.tsx:210. R1-03 observed (07-scan-done.png); scan() near Legal.tsx:178.
- Files:
  - apps/web/src/pages/Legal.tsx (scanDisabled includes needsConsent; show the consent card's Allow in the banner; after a scan show 'N rows changed' with Undo or a link to the changed rows)
  - apps/web/src/pages/Legal.test.tsx or a story covering the disabled state
- Reach: Legal users before consent and after every re-scan.
- Acceptance criteria:
  - Failing test first: with needsConsent true the Scan now button is disabled and the banner offers Allow.
  - After a scan that adds or changes rows, one line states how many; reviewed contract values are never overwritten silently.
  - If no row changed the line says so.
- Needs product decision: false
- Depends on: none
- Conflicts with: C8 (consent), C10 (Legal.tsx)

### C8 [P2] Consent cards stay on screen after consent is on, and Legal and Data room use two different prompt components
- Rank: 8. Effort: M. Reopens: iteration 10 C3
- Finding ids (found by): FLOW-01 (FLOW), FLOW-03 (FLOW), R1-08 (R1)
- Root cause: Consent state is read once per page and cached, so a card remains until the next full load (FLOW-01; likely a second session granted it). Legal and Data room render the same decision as two components with different buttons: Data room has Allow and Not now, Legal only Allow (confirmed at legal/ConsentPrompt.tsx:21 and data-room/ConsentPrompt.tsx:85). R1-08 saw Inbox sort and Legal scan while Settings read off, possibly changed by another walker.
- Verification: FLOW-03 confirmed in code (two components, onDismiss only on Data room). FLOW-01 and R1-08 are shared-account observations; the stale-cache cause is suspected.
- Files:
  - apps/web/src/components/legal/ConsentPrompt.tsx and apps/web/src/components/data-room/ConsentPrompt.tsx (one shared component and one set of buttons)
  - apps/web/src/components/AiDataSharing.tsx (refetch on focus / page open)
  - apps/web/src/pages/Inbox.tsx triageBlocked gate (read the same status as the Settings switch)
  - Storybook stories for the shared card
- Reach: Everyone who gives consent in more than one place or tab.
- Acceptance criteria:
  - Failing test first: after consent is granted elsewhere, window focus removes the card without a reload.
  - Legal and Data room show the same card with the same buttons.
  - On a clean user the Settings switch, Inbox, Legal and Data room agree.
- Needs product decision: true. Should the shared consent card offer 'Not now' on both Legal and Data room, or on neither? (Owner decision from earlier iterations: one Allow per area covers it; the Not now button is the open part.)
- Depends on: none
- Conflicts with: C7 (Legal.tsx), C21-C24 (Data room)

### C9 [P2] Approval card: the instruction text is clipped on a phone, 'Approved' hides that money has not moved, and denied cards stay open
- Rank: 9. Effort: S. Reopens: none
- Finding ids (found by): J3-01 (J3), J2-04 (J2), J2-12 (J2), V2-15 (V2)
- Root cause: Confirmed J3-01 in code: AskCard.tsx:209 `max-h-72 overflow-auto` with no fade or scrollbar cue, so a long routine prompt is cut mid-sentence and a user can approve without reading it. The other findings are card states: 'Approved' is shown when the provider still needs its own approval (J2-04), a denied card keeps Details open while an approved one collapses (J2-12), and two cards for similar requests carry no time (V2-15).
- Verification: J3-01 confirmed at apps/web/src/components/AskCard.tsx:209. Others observed.
- Files:
  - apps/web/src/components/AskCard.tsx (remove the max height on phones or add a fade and 'Show all'; label 'Approved here. Waiting for Mercury' when the provider needs its own approval; collapse denied like approved; request time in the footer)
  - apps/web/src/components/AskCard.stories.tsx
- Reach: Every approval, most of all on a phone.
- Acceptance criteria:
  - At 375 px the whole instruction can be read without a nested scroll, or a visible 'Show all' reveals it.
  - A payment approved here but pending at Mercury reads 'Approved here. Waiting for Mercury'.
  - Approved and denied cards collapse the same way and show the time of the request.
- Needs product decision: false
- Depends on: none
- Conflicts with: C6 (approval toast), C1

### C10 [P2] Legal Contracts table cuts the contract name while other columns have spare space, and rows have uneven heights
- Rank: 10. Effort: S. Reopens: iteration 10 C6 (partly)
- Finding ids (found by): J1-05 (J1), J2-08 (J2), V2-01 (V2), V2-02 (V2)
- Root cause: Column widths give Contract 227 px and Parties/Value spare room, Status (76 px) is empty on 9 of 11 rows, and Term and Renewal wrap to two lines, so rows are 57 px or 37 px. Four walkers saw it; iteration 10 fixed counterparty and Term wrapping at the code level but the table still wraps at 1440.
- Verification: Observed by J1, J2 and V2 (legal-1440.png: header widths Contract 227, Parties 205, Status 76, Term 173, Renewal 151).
- Files:
  - apps/web/src/pages/legal/LegalContracts.tsx (flexible name column, nowrap dates, status as a badge after the name or hide the column when empty, one row height)
  - apps/web/src/pages/legal/LegalContracts.stories.tsx
- Reach: Every Legal user.
- Acceptance criteria:
  - At 1440 px the longest mock contract name is shown in full or on two lines; no name is cut at a character that tells two contracts apart.
  - Every row has the same height.
  - Status column absent when no row has a status.
- Needs product decision: false
- Depends on: none
- Conflicts with: C7 (Legal.tsx)

### C11 [P2] Activity panel leaves an 85 px window for the list and its filter fills the whole window
- Rank: 11. Effort: S. Reopens: iteration 10 C9 and C18
- Finding ids (found by): V3-01 (V3), R1-06 (R1), R2-11-04 (R2)
- Root cause: Confirmed in code: ActivityList.tsx:133 `lg:max-h-[max(14vh,7.5rem)]` gives about 85-126 px at 900 px height for 868 px of content, so one row shows, and the inline Filter panel replaces the list. Iteration 10 C9 asked for 5 rows; R1 counted 4. The section heading 'Needs you' (line 173) sits beside the row label 'Needs your answer' (roster-status.ts:15).
- Verification: V3-01 and R2-11-04 confirmed at apps/web/src/pages/ActivityList.tsx:133 and :173. V3-01 was reported P1; held at P2 because Activity is opt-in, not a core journey.
- Files:
  - apps/web/src/pages/ActivityList.tsx (raise the max height to about 40vh, move the filter to a popover, snap the roster scroller to row boundaries, rename the heading to match 'Needs your answer')
  - apps/web/src/pages/ActivityList.stories.tsx
- Reach: Everyone who turns Activity on.
- Acceptance criteria:
  - At 1440x900 Activity shows at least 5 rows and the filter does not hide them.
  - The roster below never cuts a heading in half.
  - One waiting label across heading and row.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C12 [P2] Inbox message dialog: the agent panel covers half the email, and returning from a reply scrolls the list away from the next mail
- Rank: 12. Effort: M. Reopens: iteration 10 C13
- Finding ids (found by): R2-11-03 (R2), J1-01 (J1), V2-14 (V2), J1-09 (J1)
- Root cause: Observed. At 1440 the Ask agent panel overlays the right half of the email so the body and To line are cut (InboxMessageDialog.tsx:124,557). After a reply and Esc, the row has moved to another group and focus() (Inbox.tsx:1098-1108, no preventScroll) scrolls the list about 600 px, hiding the To do card and the next Needs reply mail. Also: phone sender/recipient addresses are cut (V2-14), and after Send 'Sending...' lasts about 14 s with no 'Sent' confirmation (J1-09).
- Verification: J1-01 confirmed in code (focus without preventScroll at Inbox.tsx:1098-1108). Others observed.
- Files:
  - apps/web/src/components/inbox/InboxMessageDialog.tsx (widen or push the panel beside the email at 1200 px and up; let the To line wrap on phones)
  - apps/web/src/pages/Inbox.tsx:1098-1108 (focus({ preventScroll: true }) or focus the next row)
  - compose send queue (Sent toast when delivered)
- Reach: Everyone who triages mail on desktop.
- Acceptance criteria:
  - At 1440 with the agent panel open, the email body and the To line are fully visible.
  - After replying and closing, the list stays at the top or lands on the next mail; the To do card remains visible.
  - The send shows 'Sent' when it completes.
  - At 375 the sender address can be read in full.
- Needs product decision: false
- Depends on: none
- Conflicts with: C30 (Inbox.tsx), C27 (Inbox.tsx)

### C13 [P2] Empty Fundraising still shows grey ghost rows, and 'Draft reply' shows no work indicator
- Rank: 13. Effort: S. Reopens: iteration 10 C11
- Finding ids (found by): R2-11-01 (R2), R2-11-02 (R2)
- Root cause: Placeholders.tsx draws static grey rows in Round, Pipeline and SAFEs, which read as a loader that never ends (J2 saw the same on Investors 'Updates'). ActionItems.tsx:73 sets only `disabled={audit.drafting}` on Draft reply, so nothing visible changes while drafting.
- Verification: Observed by R2 (c11-fund.png); the Draft reply code read at apps/web/src/components/investors/ActionItems.tsx:66-76. A fresh-user empty Investors view was not tested.
- Files:
  - apps/web/src/components/Placeholders.tsx (one sentence and one button per empty section instead of ghost rows)
  - apps/web/src/components/investors/ActionItems.tsx (label 'Drafting...' with a spinner)
  - stories for both
- Reach: Investors and Fundraising users.
- Acceptance criteria:
  - Empty sections show a sentence and one action, no grey bars.
  - Draft reply shows 'Drafting...' within 100 ms of the click and returns to the label when done.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C14 [P2] SAFE holders and totals differ between Investors, the conversion block and Fundraising; 'Equity raised' is a dash
- Rank: 14. Effort: M. Reopens: iteration 10 C10
- Finding ids (found by): R1-07 (R1)
- Root cause: Observed. Investors lists four SAFEs ($350k), the conversion block and Fundraising list two ($300k); Equity raised shows a bare dash although SAFEs exist. The pages read different SAFE sources (Carta-derived versus Mercury-derived records); the iteration-10 fix is not visible.
- Verification: Observed by R1 (23-investors2.png, 25-fund.png) and noted by J2 (Equity raised dash with two SAFEs). Which source is authoritative was not traced.
- Files:
  - Investors and Fundraising SAFE queries in apps/api (grep safe in apps/api/src/investors*.ts and fundraising*.ts)
  - apps/web Investors conversion block and Equity raised tile
- Reach: Anyone preparing for a raise; wrong totals in a board context.
- Acceptance criteria:
  - One SAFE list feeds the table, the conversion block and Fundraising.
  - Equity raised shows the total of that list.
  - A test with two sources shows one list.
- Needs product decision: true. Which record is the source of truth for SAFEs when Carta and Mercury disagree? (Project memory says Mercury is the only SAFE record.)
- Depends on: none
- Conflicts with: none

### C15 [P2] Settings General: right column ends far above the left, Account sits below the fold, the notifications row is 20 px tall on touch, and the first focus lands on an avatar option
- Rank: 15. Effort: S. Reopens: none
- Finding ids (found by): V1-01 (V1), V1-10 (V1), V1-11 (V1)
- Root cause: Two-column grid with `items-start` (AccountSettingsOverlay.tsx:157) leaves the left column 874 px tall in a 683 px dialog and the right column ending 500 px early, so Account is hidden. NotificationSettings.tsx:69-78 gives the row 261x20 around a 32x18 switch; the owner rule is 44 px on coarse pointers. Initial focus is a content control.
- Verification: V1 observed and measured; row heights measured under pointer: coarse.
- Files:
  - apps/web/src/pages/AccountSettingsOverlay.tsx:157 (move Language/time zone and Notifications to the right column; initial focus on the dialog)
  - apps/web/src/components/NotificationSettings.tsx:69-78 (44 px row under coarse pointer)
- Reach: All users on desktop (layout) and phones (touch).
- Acceptance criteria:
  - At 1440x900 and 1280x800 Account (name, export, change password, delete) is visible without scrolling.
  - Under pointer: coarse the notifications row measures at least 44 px.
  - On open, no content control shows a focus ring.
- Needs product decision: false
- Depends on: none
- Conflicts with: C16 (Settings dialogs)

### C16 [P2] Settings Models: the hint points at the step the user is in, 'Connected: OpenRouter' contradicts 'Your bots use OpenAI', and the phone layout hides the current model
- Rank: 16. Effort: S. Reopens: iteration 10 C20
- Finding ids (found by): V1-02 (V1), V1-03 (V1), V1-23 (V1), R2-11-08 (R2)
- Root cause: ModelBackupsSettings.tsx:260 says 'Use your own model to add backups' while the user is in that step; the provider list shows OpenRouter Connected while the active model is OpenAI (the demo has no OpenRouter key, so this may be fixture data); on phones the current-model line sits below the list; the Providers heading moves 50 px between the Model and Voice tabs.
- Verification: Observed by V1 and R2. V1-03 and R2-11-08 may be demo-only, so check on a real account before changing the list.
- Files:
  - apps/web/src/pages/ModelBackupsSettings.tsx:260
  - apps/web/src/pages/ModelSettingsOverlay.tsx (current-model line first on phones; reserve description height; 'In use' label or Connected only with a stored key)
- Reach: Everyone who connects their own model.
- Acceptance criteria:
  - Backup models are hidden until a provider is connected, or the hint says 'Connect a provider to add backups'.
  - A provider shows Connected only with a stored key, and the active one reads 'In use'.
  - Providers heading does not move between tabs.
- Needs product decision: false
- Depends on: none
- Conflicts with: C15 (Settings dialogs)

### C17 [P2] Sign-up shows one error message away from the failing field
- Rank: 17. Effort: S. Reopens: iteration 10 C24 (partly)
- Finding ids (found by): V1-07 (V1), R3-11-04 (R3)
- Root cause: With a bad email and short password both fields turn red but one message ('Enter a valid email') appears under the password hint; on an empty submit Email and Password are outlined but not Name while 'Enter your name' sits under the password hint.
- Verification: Observed by V1 (375 and 1440) and R3.
- Files:
  - apps/web/src/pages/Auth.tsx (per-field message under its own field, password hint turns red when it fails)
- Reach: Every new user with a typo.
- Acceptance criteria:
  - Each invalid field shows its own message directly under it and is outlined; valid fields are not.
  - Test: empty submit marks Name, Email and Password.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C18 [P2] Command palette: no 'nothing matched' line, focus lost on close, phone placement under the keyboard, direct matches below 'Search mail for', matches without a reason
- Rank: 18. Effort: M. Reopens: iteration 10 C25
- Finding ids (found by): V3-08 (V3), V3-10 (V3), V3-09 (V3), R3-11-07 (R3)
- Root cause: Observed. A query with no matches shows only 'Search mail for ...' and after Escape focus lands on BODY (V3-08). The palette is centred on a phone so a keyboard will cover the results (suspected, no on-screen keyboard in the test browser). Direct matches render below the first highlighted row (R3-11-07, command-palette.tsx), and Documents/Artifacts/chat-by-name results show no snippet (V3-09).
- Verification: Observed by V3 and R3; V3-10 suspected.
- Files:
  - apps/web/src/pages/shell/command-palette.tsx (empty-match line, restore focus to the trigger, anchor to the top on phones, direct matches above 'Search mail for', snippet or reason for every text match)
- Reach: Everyone who searches; the palette is the one search surface.
- Acceptance criteria:
  - No-match query shows 'No matches in pages, documents, contacts' and keeps Search mail for.
  - After Escape focus returns to the Search button.
  - At 375 the palette is anchored to the top.
  - The first highlighted row is the first row on screen.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C19 [P2] Integrations page: search moves under the cursor, card buttons stop 32 px short of the edge, two card styles, jargon and a three-line intro on phones
- Rank: 19. Effort: M. Reopens: iteration 10 C21
- Finding ids (found by): V1-04 (V1), V1-05 (V1), V1-06 (V1), V1-21 (V1), V1-22 (V1), R3-11-01 (R3), R3-11-02 (R3), J2-10 (J2)
- Root cause: Search and chips sit below the Connected grid but also filter it, so typing shrinks the grid and the input jumps about 148 px (V1-04). A 32 px slot for a '...' menu is reserved on all cards though only Blockscout/Coinbase have one (V1-05, R3-11-01); Carta shows a letter tile (R3-11-02); 'MCP server URL' and 'No apps match.' use jargon or the old name (V1-06); the intro paragraph takes 60 px on a phone (V1-21); no shared page header (V1-22). First paint shows six empty cards for 3-5 s (J2-10).
- Verification: Observed by V1, R3, J2; menu inconsistency matches iteration 10 C21 criterion 1 not met.
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (search and chips above Connected; right-align buttons, collapse the menu slot or give every Connected card the same '...' with Disconnect; skeleton labels; shared page header)
  - apps/web/src/components/integrations/CustomConnectionDialog.tsx:530 and IntegrationsHome.tsx:832 (copy)
  - Carta logo asset
- Reach: Everyone who connects an app.
- Acceptance criteria:
  - Typing in search does not move the input (position changes by 0 px).
  - All Connected cards share one right edge and the same menu.
  - Copy: 'Paste the app's connection URL from its documentation.' and 'No integrations match.'
  - Intro line is hidden once anything is connected.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C20 [P2] First-run tour: on a phone the callout is about 600 px from its target, buttons and height change per step, the last stop hides the composer, and the tour never starts for a user who ignores the first card
- Rank: 20. Effort: M. Reopens: iteration 10 C23
- Finding ids (found by): V1-08 (V1), V1-09 (V1), R3-11-03 (R3), J1-10 (J1), V3-16 (V3), R3-11-08 (R3), V1-19 (V1)
- Root cause: TourPopover placement is pinned to the far edge on phones (step 1 at the bottom for a top target, step 8 at the top for a bottom target). On desktop the callout height changes per step so Next moves from y=110 to y=164 (V1-09); stop 9 swaps Skip for 'Ask Chief' and shifts Back (R3-11-03); stop 9 covers the composer (J1-10); stop 1 covers the Data room consent text (V3-16). The tour starts only after the first-question card is answered (Shell.tsx:2734-2740, by design) so a user who ignores it never gets it (V1-19, R3-11-08).
- Verification: Observed by V1, R3, J1, V3; the start condition read at apps/web/src/pages/Shell.tsx:2713-2740. Nine stops stays (owner decision).
- Files:
  - apps/web/src/components/tour/TourPopover.tsx (phone placement next to the target; fixed height; fixed Back/primary slots; 'Ask Chief' out of the button row)
  - apps/web/src/components/tour/FirstRunTour.tsx (stop 9 position)
  - apps/web/src/pages/Shell.tsx:2713-2740 (start condition, only if the owner agrees)
- Reach: Every new user on the first day.
- Acceptance criteria:
  - At 375 px the callout is within 120 px of its target at every stop.
  - Next/primary button x and y are identical on stops 1-9.
  - No stop covers the element it tells the user to use next.
  - Test: tour starts or is offered once the first-question card is answered or dismissed.
- Needs product decision: true. Should the tour start (or be offered) when the first-question card is dismissed or after about 20 s idle, instead of only after it is answered?
- Depends on: none
- Conflicts with: none

### C21 [P2] Data room files stay on a bare 'Reading' spinner for minutes with no words or way out, and grid view shows nothing
- Rank: 21. Effort: S. Reopens: iteration 10 C16
- Finding ids (found by): V3-04 (V3), R2-11-05 (R2)
- Root cause: A file whose text is already searchable still shows a spinner (title 'Reading text'); Stats says 'Reading 1'; in grid view the same file shows no state. There is no age text, no Retry, no 'taking longer'. The demo seeds this file and has no model that could finish it, so it may be demo-only, but a stuck file looks the same as a working one.
- Verification: Observed by V3 (13+ minutes) and R2; code in apps/web/src/components/data-room/ItemRows.tsx Marker. Iteration 9 and 10 deferred a seed fix; the move to treat stored text as Ready is not made.
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx (Marker: a file with stored text is Ready; 'Reading...' in words; stale state with Retry after a limit; same state in grid)
- Reach: Everyone who adds documents.
- Acceptance criteria:
  - A file with extracted text shows Ready, not a spinner.
  - A file reading longer than the limit says so and offers Retry.
  - Grid cards show the same state as list rows.
- Needs product decision: false
- Depends on: none
- Conflicts with: C23 (ItemRows.tsx)

### C22 [P2] Data room on a phone and in Stats: the date chart overflows its card, the card menu button sticks out of the thumbnail, and Stats shifts the layout
- Rank: 22. Effort: S. Reopens: none
- Finding ids (found by): V3-02 (V3), V3-03 (V3), V3-13 (V3)
- Root cause: At 375 the 'Documents by document date' bars reach 448 px in a card that ends at 363 px (V3-02, reported P1, held at P2: a secondary view). The reported cause (Tip wrapper as flex item) is doubtful: Tip uses TooltipTrigger render={children}, so the button itself is the flex item (apps/web/src/components/ListControls.tsx:23-37). Measure the real overflow source (bucket labels row with `ps-5 justify-between`, or the `top` label) before changing. The grid '...' button is a dark slab outside the thumbnail on touch (V3-03); Stats hides the consent banner and moves the tree 70 px (V3-13, DataRoom.tsx:711).
- Verification: Observed by V3 with measurements; V3-02 cause suspected and partly contradicted by code reading.
- Files:
  - apps/web/src/components/data-room/DataRoomStats.tsx:118-145
  - apps/web/src/components/data-room/ItemRows.tsx (grid card menu button)
  - apps/web/src/pages/DataRoom.tsx:711 (reserve the banner row)
- Reach: Data room users on phones.
- Acceptance criteria:
  - Failing check first: at 375 no bar right edge is beyond the card.
  - Grid menu button lies inside the thumbnail.
  - Switching to Stats does not move the folder tree.
- Needs product decision: false
- Depends on: none
- Conflicts with: C21, C23 (ItemRows.tsx)

### C23 [P2] Data room list and preview: viewer wastes 100 px while metadata is below the fold, 'Contract · date' is unlabeled, Parties is cut while Name has space, the From-email link is 20 px tall
- Rank: 23. Effort: M. Reopens: none
- Finding ids (found by): V3-05 (V3), V3-06 (V3), V3-07 (V3), J3-02 (J3)
- Root cause: Preview iframe fixed at 540 px for a 425 px page (Preview.tsx, `iframe.w-full.shrink-0`), metadata below the fold; compact row date is the added date but looks like the document date (V3-06); the Parties column is 130 px and truncates in folders while Name has room, and the Status header disappears in some folders (V3-07); the 'From email' link measures 71x20 under coarse pointer (J3-02, Preview.tsx:299-301; owner rule is 44 px).
- Verification: Observed by V3 and J3 with measurements.
- Files:
  - apps/web/src/components/data-room/Preview.tsx (aspect-ratio viewer, metadata above, loading spinner, `pointer-coarse:py-3` on the link)
  - apps/web/src/components/data-room/ItemRows.tsx (label 'Added', column template, reserve Status)
- Reach: Everyone who browses documents.
- Acceptance criteria:
  - Preview shows Type, Date, Parties and Folder without scrolling at 1440x900.
  - The compact row says 'Added Oct 22, 2026' or shows the document date.
  - The From email link is at least 44 px tall under pointer: coarse.
- Needs product decision: false
- Depends on: none
- Conflicts with: C21, C22 (ItemRows.tsx)

### C24 [P2] Data room upload sits at 0% for 35 s without a way out; its toast sits over list rows; the email import switch is on by default
- Rank: 24. Effort: M. Reopens: none
- Finding ids (found by): V3-15 (V3), J2-11 (J2), J2-09 (J2)
- Root cause: data-room.ts:118-153 uploads with an XHR that has no timeout or cancel, so a stall looks like progress (V3-15; the shared server may have been loaded). The 'Praci can now read your documents' toast sits bottom-left over rows while approval toasts sit bottom-right (J2-11, V3-15). 'Add new email attachments automatically' is on in a dialog whose button says Import (J2-09; seed state not checked), which changes ongoing behaviour without a separate consent.
- Verification: V3-15 code read at apps/web/src/lib/data-room.ts:118-153; others observed.
- Files:
  - apps/web/src/lib/data-room.ts (stall state with Retry/Cancel)
  - apps/web/src/components/data-room/ImportFromEmail.tsx and apps/web/src/components/AutoFileEmailSetting.tsx (default)
  - toast host used by Data room (shared bottom-right host)
- Reach: Anyone adding files.
- Acceptance criteria:
  - A stalled upload shows 'Taking longer than usual' with Cancel and Retry.
  - Notice toasts use the shared host.
  - The automatic import switch is off by default or states its consequence.
- Needs product decision: true. Should 'Add new email attachments automatically' be off by default in the import dialog?
- Depends on: none
- Conflicts with: none

### C25 [P2] Finance vendor page and Burn chart show numbers that disagree with the table or with the tile
- Rank: 25. Effort: S. Reopens: none
- Finding ids (found by): V2-04 (V2), V2-07 (V2), J1-06 (J1)
- Root cause: Vendor page: chart stops at Sep while the newest charge (Oct 16, $2,400) is 19% above Sep, so the +35% tile hides the latest spike (V2-04). Burn chart draws the partial month as a line falling to about $20k while the tile says $67,621, and the $250,000 financing marker sits at the top line above the axis (V2-07). With Hide amounts on, a '3-mo change' column appears with '•••%' because trendText compares the masked string to '0%' (J1-06, confirmed: changeText returns '•••%' when hidden at finance-format.ts:137 and trendText tests text === '0%' at :149).
- Verification: J1-06 confirmed in code at apps/web/src/lib/finance-format.ts:135-150. Others observed.
- Files:
  - apps/web/src/lib/finance-format.ts:144-150 (decide null/zero before masking)
  - vendor page chart range and Change calculation in apps/web/src/pages/ (Finance vendor view)
  - apps/web/src/components/finance/ Burn chart (partial month as a dot, financing marker axis)
- Reach: Every Finance user; the vendor spike is the main alarm number.
- Acceptance criteria:
  - Failing test first: trendText returns null for a 0% change with Hide amounts on.
  - Vendor chart includes the latest month, or the tile says 'through Sep'.
  - The partial month is not drawn as a falling line.
- Needs product decision: false
- Depends on: none
- Conflicts with: C26 (Finance.tsx)

### C26 [P2] Finance layout: Subscriptions rows spread across the page, uneven card heights, phone tile grid, truncated space name, Runway tiles clustered left
- Rank: 26. Effort: M. Reopens: iteration 10 C12
- Finding ids (found by): V2-05 (V2), V2-06 (V2), V2-08 (V2), J1-08 (J1), R2-11-06 (R2), J3-03 (J3)
- Root cause: Vendor name and amount are 640 px apart at 1440 (V2-05, Finance.tsx:940); Globex row is 72 px against 38 px (V2-06); Breakdown and Upcoming are 312 vs 338 px and the period bar is full width (R2-11-06); Treasury yield sits alone on a phone row and the space name truncates to 'Northwind Rob...' on Finance (V2-08, J3-03); Runway tiles are 170 px wide above a full-width chart (J1-08).
- Verification: Observed by V2, R2, J1, J3; geometry measured.
- Files:
  - apps/web/src/pages/Finance.tsx (SubscriptionsTable ~940; header; tile grid; equal-height row)
  - runway header (apps/web/src/pages/Finance*.tsx)
- Reach: Every Finance user.
- Acceptance criteria:
  - Vendor and amount are within 400 px of each other at 1440 and 1920.
  - Breakdown and Upcoming have equal heights.
  - At 375 the space name is readable and no tile sits alone.
  - Runway uses the same 4-up grid as Finance.
- Needs product decision: false
- Depends on: none
- Conflicts with: C25 (Finance.tsx)

### C27 [P2] After Allow on a new mailbox, the Inbox shows grey rows with no notice for about 25 s, then the unsorted mail only after 2.5 minutes
- Rank: 27. Effort: S. Reopens: iteration 10 C4
- Finding ids (found by): R1-05 (R1), J1-04 (J1)
- Root cause: Observed once by R1 (13 mails: skeletons at +25 s, no Retry notice, rows at about 2.5 min). J1 saw honest states on the same flow (rows readable, 'taking longer than usual' at about 2 min). The iteration-10 decision was to show unsorted rows after 15 s. The 15 s timer may start at page load, not at Allow (Inbox.tsx ~475-486, 664). R1 rated it P1; held at P2 because it was seen once and J1 saw the expected states.
- Verification: Observed once (R1) and partly contradicted (J1). Timer origin not verified.
- Files:
  - apps/web/src/pages/Inbox.tsx ~295-300, ~475-486, ~664 (start the 15 s timer when Allow is pressed; progress text)
- Reach: Every new mailbox.
- Acceptance criteria:
  - Within 15 s of Allow the unsorted mail is readable, with 'Sorting your mail...' above it.
  - Test with a fake clock: timer starts at Allow.
- Needs product decision: false
- Depends on: none
- Conflicts with: C3 (sort state), C12 (Inbox.tsx)

### C28 [P3] Chief's copy: internal wording, two destinations in one answer, an onboarding option that offers the wrong cards, an unclear chip
- Rank: 28. Effort: S. Reopens: iteration 10 C24
- Finding ids (found by): J1-07 (J1), R3-11-06 (R3), R3-11-05 (R3), V1-20 (V1)
- Root cause: J1-07: 'saved bank-only runway scope' is internal wording; R3-11-06: 'Connect one under Integrations first' followed by 'Open Finance'; R3-11-05: 'Run my company: Cash, cap table, investors and email' leads to Gmail and Calendar cards only; V1-20: the chip 'Ask Chief' in Chief's own composer does not say what it asks.
- Verification: Observed by J1, R3, V1; NOT_CONNECTED_GUIDANCE in packages/adapters/src/executor.ts; onboarding at apps/api/src/onboarding.ts and apps/web/src/components/tour/connect-cards.ts.
- Files:
  - packages/adapters/src/executor.ts (NOT_CONNECTED_GUIDANCE)
  - Finance agent prompt (runway wording)
  - apps/api/src/onboarding.ts and apps/web/src/components/tour/connect-cards.ts
  - Shell.tsx composer chip label
- Reach: New users.
- Acceptance criteria:
  - Runway answer says 'Based on your bank balances and the last 3 months of spending'.
  - A missing bank says 'Add a bank account in Finance' with one link.
  - The chip shows the sample question.
- Needs product decision: true. For the first-run option 'Run my company', show Mercury/Carta cards as well as Gmail/Calendar, or reword the option to match the cards?
- Depends on: none
- Conflicts with: C4

### C29 [P3] Routines panel is titled 'Computer is on' over an empty box for a bot that uses no computer
- Rank: 29. Effort: S. Reopens: iteration 10 C15
- Finding ids (found by): J2-07 (J2), R2-11-07 (R2)
- Root cause: Iteration 10 C15 renamed the button to 'Routines', but the open panel header still says 'Computer is on' with an empty '<bot>'s computer' heading (J2-07, R2-11-07).
- Verification: Observed by J2 and R2; header in apps/web/src/pages/Shell.tsx.
- Files:
  - apps/web/src/pages/Shell.tsx (panel header: 'Routines' until a computer is in use; hide the empty heading)
- Reach: Anyone using routines.
- Acceptance criteria:
  - Panel title 'Routines' and no empty computer heading when no computer is in use.
- Needs product decision: false
- Depends on: none
- Conflicts with: C20, C33 (Shell.tsx)

### C30 [P3] Inbox list: the To do card repeats mail listed below, piles have different headings, the To do card is tall on a phone, a filter tooltip stays
- Rank: 30. Effort: S. Reopens: none
- Finding ids (found by): FLOW-02 (FLOW), V2-11 (V2), V2-12 (V2), V2-13 (V2)
- Root cause: The To do card renders independently of the grouped rows (Inbox.tsx ~673-690) so 'Reply to Morgan ...' appears twice within 200 px (FLOW-02); Updates has no day headings (V2-11); the card is 220 px on a phone (V2-12); the Filter tooltip stays after Escape (V2-13).
- Verification: Observed by FLOW and V2; FLOW-02 location read in code.
- Files:
  - apps/web/src/pages/Inbox.tsx (~673-690 card; pile grouping)
  - filter button tooltip (Tip disabled while the menu is open, ListControls.tsx)
- Reach: Inbox users.
- Acceptance criteria:
  - A reply-type to-do whose thread is in Needs reply is marked on the row instead of repeated.
  - Every pile uses the same day grouping.
  - The Filter tooltip is gone after the menu closes.
- Needs product decision: false
- Depends on: none
- Conflicts with: C12, C27 (Inbox.tsx)

### C31 [P3] Legal Deadlines: an auto-renewing contract produces two rows
- Rank: 31. Effort: S. Reopens: none
- Finding ids (found by): J1-11 (J1)
- Root cause: Each auto-renewing contract yields a 'Send non-renewal notice' row and a 'Renews automatically' row, so 5 contracts give 10 rows with three buttons each (J1-11). V2-03 proposed removing Done from renewal rows; the owner decided the row actions Ask agent / Done / Dismiss stay, so only the duplicate rows are open.
- Verification: Observed by J1. V2-03 is dropped as an owner decision.
- Files:
  - Legal deadline generator in apps/api/src/legal.ts or the legal agent prompt (fold the renewal date into the notice row subtitle)
  - apps/web/src/pages/legal/LegalDeadlines.tsx
- Reach: Legal users with auto-renewing contracts.
- Acceptance criteria:
  - One row per contract notice; the renewal date shown in its subtitle.
- Needs product decision: true. Fold the 'Renews automatically' row into the notice row, or keep two rows? (Row actions stay as decided.)
- Depends on: none
- Conflicts with: C2 (LegalDeadlines.tsx)

### C32 [P3] Bot settings panel: empty Skills box for a second, three styles of secondary action, jargon in Advanced
- Rank: 32. Effort: S. Reopens: iteration 10 C19
- Finding ids (found by): V1-12 (V1), V1-13 (V1), V1-14 (V1)
- Root cause: Skills shows an empty 36 px box before 'Built-in skills (11)' appears (V1-12); Advanced row, underlined Export (23 px high) and red Clear conversation differ and Advanced fields are inset 13 px (V1-13); 'Computer: Team / Private' is jargon and 'Memory: Nothing remembered yet' repeats Settings (V1-14).
- Verification: Observed by V1.
- Files:
  - apps/web/src/pages/shell/bot-panel.tsx (incl. :105)
- Reach: Everyone who opens bot settings.
- Acceptance criteria:
  - Skills row renders immediately or as a skeleton.
  - Export and Clear conversation are the same ghost-button row.
  - Label 'Workspace: Shared with your other bots / Only this bot'; no empty Memory line.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C33 [P3] Shell accessibility polish: header focus ring, four tab stops per message, heading order, switch track contrast, drawer focus, faint '...' glyph
- Rank: 33. Effort: S. Reopens: none
- Finding ids (found by): V1-15 (V1), V1-16 (V1), V1-18 (V1), V2-18 (V2), J3-04 (J3)
- Root cause: Header buttons use the browser default ring (V1-15); each message adds four tab stops; the day label is an h3 under h1 and the composer has role combobox (V1-16); the off switch track is about 1.5:1 against the card (V1-18); drawer opens with focus on Activity (V2-18); the phone '...' glyph is faint inside its 44 px target (J3-04).
- Verification: Observed by V1, V2, J3 (axe and measurement).
- Files:
  - header buttons in apps/web/src/pages/Shell.tsx
  - message toolbar and day heading in the chat thread component
  - switch track token in packages/ui-web
  - mobile drawer open handler
- Reach: Keyboard and screen reader users.
- Acceptance criteria:
  - Header buttons use the shared 2px ring.
  - axe reports no heading-order or aria-allowed-role violation on the shell.
  - Switch off track at least 3:1 against the card.
  - Drawer opens with focus on Search.
- Needs product decision: false
- Depends on: none
- Conflicts with: C29 (Shell.tsx)

### C34 [P3] Artifacts, Contacts and wide tables: filter bar differs from sibling pages, selected row not scrolled into view, tables spread at 1920, no email on phones
- Rank: 34. Effort: S. Reopens: none
- Finding ids (found by): V3-11 (V3), V2-16 (V2), V3-12 (V3), V2-17 (V2), V3-14 (V3), V3-17 (V3)
- Root cause: Artifacts hides search behind 'Filters' and uses a plain select and relative dates (V3-11); the selected row is half cut off (V2-16); header edges misaligned (V3-12); header border differs (V2-17, possibly intentional for the two-pane layout); Contacts and Data room tables are not width-capped at 1920 (V3-14); Contacts hides email on a phone (V3-17).
- Verification: Observed by V2 and V3.
- Files:
  - apps/web/src/pages/Artifacts.tsx (reuse the Contacts search and pill filters; scrollIntoView; header edges)
  - Contacts table (second line under the name on phones; width cap)
- Reach: Artifacts and Contacts users.
- Acceptance criteria:
  - Artifacts uses the same search and filter components as Contacts.
  - Selected row is fully visible.
  - Email appears under the name at 375.
  - Name-to-email gap is under 300 px at 1920.
- Needs product decision: false
- Depends on: none
- Conflicts with: C23 (Data room column widths at 1920)

## Deferred items (not in a cluster)
- R1-09 Investors stayed on skeleton rows for 18 s once; load time on a shared stack, not reproduced. J2-10 second half (Data room 'Still opening' for 30 s), V1-17, V2-09 (Legal Graph skeleton 12 s once): same reason. Re-measure on an idle production build. If it repeats, V2-09 wants a 'Loading relationships...' line.
- V2-03 Done only on actionable Legal deadlines: dropped, owner decision (Ask agent / Done / Dismiss).
- J2-14 Hide amounts masks the '% vs Sep': intentional (changeText masks every figure while hidden); not raised.
- J2-15 Insurance deadline text says Dec 1 while the row says Dec 2: demo seed text, not product.
- V3-18 white artifact sheet in the dark app: expected for isolated content; no change.
- J2 Investors notes (grey 'Updates' skeleton rows, Equity raised dash, Draft reply ending in a sharing refusal): covered by C13, C14; the refusal link already goes to Settings.
- J1-04 first sort took 3.5 min on the demo: model latency; UNVERIFIED with a production model (partly in C27).
- J3 note: the drawer shows about 2.5 chats before scrolling because Pages uses eight 44 px rows: not filed.
- V1-17 and J3 tooling note (drawer click under coarse emulation): emulation artifact, not an app finding.
- FLOW-04 eight pages for a user with nothing connected: judgment call, current behavior acceptable; not raised.
- Catalog drift (update the catalog, not the app): STORY-DRM-019 now has bulk Download/Email/Send to agent; STORY-APP-353 no longer has a YAML editor; the Data room Add files menu is Upload files, From email, From Box (Drive hidden until connected); STORY-APP-309/319 mention Connect-your-apps and model steps the demo does not show.

## BLOCKED stories
- STORY-APP-309 / STORY-APP-319 model step and 'Connect your apps' (demo has a default model; /onboarding redirects to Chief). Real ChatGPT/OpenRouter/Google sign-in UNVERIFIED.
- Real OAuth: Gmail/Calendar/Slack Connect, Carta (STORY-CAP-017, STORY-CAP-106), Mercury/Brex add-account (STORY-FIN-019 partly), tour auto-start after Connect (R3 C23).
- Skipped for time, not blocked: STORY-DRM-121, STORY-CAP-018 (Investors agent blocked by sharing consent), STORY-FIN-020/021/022, STORY-INB-023/109, STORY-INB-040, STORY-APP-213/144, STORY-APP-024/210/212/214.
- Touch-target measurement by R1, R2 (partly), R3, FLOW and V2: agent-browser cannot set pointer: coarse; only J3, V1, V3 and a Playwright context measured it.
- Held 'Share with {name}?' cards, secret request card and Provide secret dialog, email agent panel, Audience setting, no-documents Legal state: not present in the demo data.

## Counts by severity
- Clusters: 34 (P0 0, P1 6, P2 21, P3 7)
- Distinct finding ids in clusters: 111
- Needs a product decision: C8, C14, C20, C24, C28, C31
- P1: C1, C2, C3, C4, C5, C6
