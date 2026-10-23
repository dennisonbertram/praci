P0: 0, P1: 1, P2: 15, P3: 9

# Iteration 23 problems: fix clusters

Sources: R1-R3 (verify the iteration-22 clusters), J1-J3 (long journeys, 375 px sweep), FLOW, V1-V3 (visual), all on the mock demo stack shared by about ten walkers (load average up to 57). Iterations 1-22, docs/ux-flow/report.md and docs/ux-visual/problems.md were read for decisions. A cluster that reopens an earlier one names it in Reopens. Rank: P0, then severity, then reach divided by effort.

Owner decisions respected and not re-raised: nine-stop tour with a fixed card spot (FLOW-01, V1-09, J1-04 dead band and covered roster rows dropped); the page is called Integrations; Integrations keeps its sidebar row; Breakdown and Upcoming keep natural heights; consent is asked once per area; the Important tab lists all mail before sorting (V2-19, pass 9); the landing Sign up opens the form; the payment-reply link stops at the integration detail view (pass 22).

Severity calls: one P1 (C1). Lowered from the walker rating: J3-01 drawer P1 to P2 (the collapse is the pass-22 design; only warnings hidden); J3-02 and V2-01 Legal tabs P1 to P2 (labels collide but every tab is tappable); J1-01 Message not found P1 to P2 (demo emulator, Open in composer recovers); J2-01 Mercury wording P1 to P2 (flow works with the switch on, and the cause of the switch being off is unknown); J2-02 Legal values P1 to P2 (demo model is scripted; raise if a real model reproduces); R1-23-01 Settings P1 to P2 (menu route works, race suspected). Environment: cold-load durations are filed for the missing retry only.

## Pass-22 cluster verification (R1-R3)
- Met: C2 Inbox first load, C7 Ask agent scroll, C10 sidebar status, C12 phone drawer and tour, C14 Data room list, C15 Investors phone, C16 Settings General, C18 slow loads (partly unobserved), C19 space switcher heading, C20 Artifacts cards, C23 in code, C24 Assign to contact, C26 auth screens, C27 Activity colours, default bot names, Discard draft dialog, FLOW-01/02 of pass 22 (Legal one scan button, Equity raised reconciles at $250,000).
- Not met, reopened here: C4 /app/settings (now C2), C5 untagged reason (now C11), C13 phone '...' (now C1), C21 Accounts range control and Subscriptions width (now C15), C22 card order (now C21), C25 inactive empty space sidebar (now C16), C3 cold load retry (now C9), C11 To do card height (now C13), C12 hidden warnings (now C3).
- Partly or not observed: C1 failed send (no live failure possible, now C7 with the real cause), C3 20 s state, C6 Contracts update timing within 3 s, C8 agent holder lists, C9 phone toast, C17 waiting or failed delegate state, C27 chip focus ring and suggestion alignment.

## Fix clusters, ranked

### C1 [P1] Phone chat: the per-message '...' button sits on top of card controls and user bubbles, so a first-run user cannot dismiss the first-question card
- Rank: 1. Effort: S. Reopens: iteration-22 C13 (the lone-row part was fixed, this is the regression it left).
- Finding ids (found by): R2-23-01 (R2), V1-01 (V1), V2-02 (V2), V2-15 (V2)
- Root cause: On coarse pointers the message action button (44x44, aria-label 'More') is positioned by MessageHoverMetadata and the 'hover:none' classes in the transcript. It is drawn for every block, including cards that have their own controls (first-question card, Email thread card) and it overlaps the corner of user bubbles. R2 measured the card's Dismiss X (x 265, y 334) under the '...' (x 274, y 317), so tapping the visible X opens React/Reply/Copy/Remember. The tour starts only after that card is dismissed.
- Verification: OBSERVED by R2 with measured rects (touch emulation), V2 (button over bubble text, stray '...' under a card with no message), V1 (own row per message, older state). CONFIRMED in code that one action row is rendered per message with the [@media(hover:none)] variants (apps/web/src/pages/shell/transcript.tsx:832-913, :1170-1290); which blocks get the button was not traced.
- Files to change:
  - apps/web/src/pages/shell/transcript.tsx (do not render the action row for rows that are only a card, and place it on the timestamp line, not over bubble content, at touch widths)
  - apps/web/src/components/MessageHoverMetadata.tsx
  - first-question card component (find with grep 'What should I work on first') so its Dismiss X keeps a clear 44 px target
  - apps/web/src/pages/shell/transcript.test.tsx (touch layout: no overlap between '...' and the card's Dismiss)
- Reach: Every new phone user (first-run card blocks the tour) and every phone chat with cards.
- Acceptance criteria:
  - At 375 px with pointer: coarse, the first-question card's Dismiss X rect does not intersect any 'More' button rect, and a tap on the X dismisses the card (script, measured).
  - No 'More' button rect intersects a user bubble's text box; no 'More' button exists for a row with no message.
  - Thread height does not grow by an extra row per message compared with the fine-pointer layout.
- Needs product decision: false
- Depends on / conflicts: Conflicts: none (C6 and C7 touch other files).

### C2 [P2] Settings deep link still fails on a slow roster: /app/settings and /app?settings=privacy ended on the chat with no dialog in most loads for R1
- Rank: 2. Effort: S. Reopens: iteration-22 C4, iteration-21 C16.
- Finding ids (found by): R1-23-01 (R1)
- Root cause: Shell consumes the 'settings' query in an effect (Shell.tsx:2585-2594: openSettings, then delete the param with a replace). Another effect closes Settings on any pathname change while useNavigationType() is POP (Shell.tsx:896-899). On a slow roster the first-thread redirect changes the pathname after the dialog opened, so the open state is lost while the query is already gone. The pass-22 fix carried the query through the redirects but did not cover this ordering.
- Verification: OBSERVED by R1: dialog opened in 2 of 4 and 0 of 3 loads on /app/settings, 1 of 3 on /app?settings=privacy, with loads of 6 to 14 s on a loaded machine. R2/R3/V1/FLOW saw it open on an idle stack. Mechanism SUSPECTED (the two effects are CONFIRMED in code, the order of events was not traced). Kept at P2: Settings is reachable from the account menu.
- Files to change:
  - apps/web/src/pages/Shell.tsx (hold the requested settings section in a ref until the first-thread redirect has settled; do not let the POP-close effect at :896 act on the redirect's pathname change)
  - apps/web/src/pages/Shell.test.tsx (load /app?settings=privacy with the roster delayed 3 s: dialog open on Privacy and approvals, URL ends on a chat without the query)
- Reach: Anyone following an agent's Settings link (missing AI consent links use it).
- Acceptance criteria:
  - With the bots list delayed 3 s, /app?settings=privacy ends with Settings open on Privacy and approvals and a chat URL without the query (unit test).
  - /app/settings opens General in 5 of 5 scripted cold loads on a throttled stack.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C16 and C19 edit Shell.tsx in other regions.

### C3 [P2] Phone drawer hides the warnings that matter: Pages start collapsed, and unread, overdue and failed counts do not keep their row visible
- Rank: 3. Effort: S. Reopens: iteration-22 C12 (the collapse was the pass-22 design; this asks only that warnings survive it).
- Finding ids (found by): J3-01 (J3)
- Root cause: On a phone Pages starts collapsed (Shell.tsx:482-497). A collapsed row stays visible only when 'notified' (SidebarPageLink.tsx:58), and sidebar-glance.tsx sets notified only for unseen items (:33, :46). Inbox with 14 unread, Legal with 1 overdue and Data room with a red failed-file badge are therefore hidden, and Inbox takes 3 taps instead of 2.
- Verification: OBSERVED by J3 on a fresh phone user. CONFIRMED in code at the three locations. R2 passed C12 on the design as decided; the new part is only the hidden warnings.
- Files to change:
  - apps/web/src/components/sidebar-glance.tsx (notified also when failed > 0 or overdue > 0; consider unread > 0 for Inbox)
  - apps/web/src/components/SidebarPageLink.tsx:58 (no change if notified covers it)
  - apps/web/src/components/sidebar-glance.test.tsx
- Reach: Every phone user with a failed file, an overdue deadline or unread mail.
- Acceptance criteria:
  - With a failed Data room file and an overdue Legal deadline, a fresh phone drawer shows those two page rows without expanding Pages.
  - Inbox is reachable in 2 taps when it has unread mail.
- Needs product decision: false
- Depends on / conflicts: Conflicts: none.

### C4 [P2] Legal on a phone: tab labels collide, contract titles are cut without an ellipsis, deadline rows lay out differently
- Rank: 4. Effort: S. Reopens: none (new on touch emulation).
- Finding ids (found by): J3-02 (J3), V2-01 (V2), J3-03 (J3), V2-08 (V2), V2-10 (V2)
- Root cause: Three causes. (1) The Legal tab strip (Legal.tsx:499-518, overflow-x-auto, px-2 triggers, the overdue span inline in the Deadlines trigger) is wider than 337 px under pointer: coarse, where every [role=tab] gets min-height 44 and min-width 44 (apps/web/src/styles.css:85-96); J3 measured about 108 px per tab, not traced. (2) Contract titles use 'rk-tap min-w-0 truncate' (LegalContracts.tsx:69) and .rk-tap is display:inline-flex under coarse pointers (styles.css:101-106), which disables text-overflow. (3) Deadline rows show the date in different slots.
- Verification: OBSERVED by J3 and V2 independently at 375 px with touch emulation (labels drawn over each other, Deadlines content 131 px in a 111 px tab). Cause (2) CONFIRMED in code (inline-flex plus truncate). Cause (1) SUSPECTED (tab width not traced). Rated P2, not P1: all three tabs stay tappable and the page works.
- Files to change:
  - apps/web/src/pages/Legal.tsx:499-518 (let triggers shrink; show a red dot plus count for overdue on phones; no horizontal scroll)
  - apps/web/src/pages/legal/LegalContracts.tsx:69 (truncate on an inner block span, or wrap to two lines on phones)
  - apps/web/src/pages/legal/LegalDeadlines.tsx (date once, same slot for every row)
  - apps/web/src/styles.css:94-96 only if the tab min-width rule is the cause
- Reach: Phone users of Legal.
- Acceptance criteria:
  - At 375 px with pointer: coarse, no two tab labels intersect and the strip has no horizontal scroll.
  - A contract title longer than the row ends in an ellipsis or wraps; no mid-letter cut.
  - Every deadline row shows its date once, in the same place.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C5 and C9 (LegalDeadlines.tsx, Legal.tsx).

### C5 [P2] Legal Deadlines after a scan: 'Replaced by ... Keep' is unclear, the same obligation shows as up to three rows, and closed rows do not say Done or Dismissed
- Rank: 5. Effort: M. Reopens: iteration-22 C6 (scan control part met).
- Finding ids (found by): J2-03 (J2), V2-09 (V2), J2-14 (J2)
- Root cause: A scan proposes removal of a hand-added deadline when a derived one replaces it, and shows 'Replaced by ... on <date>.' with a bare 'Keep' button (LegalDeadlines.tsx:269-281). The only way to resolve the pair is to Dismiss each row. Ask agent, Done and Dismiss have equal weight. Closed rows (Show closed) show only title, date and Reopen.
- Verification: OBSERVED by J2 (9 to 19 deadlines, three rows for one insurance renewal) and V2 (375 and 1440). CONFIRMED the 'Replaced by' and 'Keep' text in code (LegalDeadlines.tsx:269,281). The scan itself behaves as designed in pass 22.
- Files to change:
  - apps/web/src/pages/legal/LegalDeadlines.tsx (wording 'Keep this deadline' next to 'Remove this one'; one click leaves one row; the proposal on its own line so Done/Dismiss do not compete; closed rows show Done or Dismissed and the date)
  - apps/web/src/pages/legal/LegalDeadlines.test.tsx
  - packages/db/src/legal.ts and apps/api router only if the Remove action needs a new mutation (it can reuse the dismiss mutation)
- Reach: Founders who add a deadline by hand and then scan (common on the first Legal use).
- Acceptance criteria:
  - A row with 'Replaced by' offers 'Keep this deadline' and 'Remove this one'; Remove closes the row in one click and leaves one row for the obligation.
  - Show closed lists each row with Done or Dismissed and the date.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C4 (LegalDeadlines.tsx).

### C6 [P2] Legal re-scan can silently replace extracted contract values (Office lease $90,000 became $9,000)
- Rank: 6. Effort: M. Reopens: none.
- Finding ids (found by): J2-02 (J2)
- Root cause: LegalRepos.upsertContract keeps stored fields only when the new extraction is empty; 'A different value still replaces it, since a document can be amended' (packages/db/src/legal.ts:191-210). It does not compare the item's revision with the stored analyzedRevision, so a re-scan of an unchanged file with a different (model-noisy) extraction overwrites money values and dates with no notice.
- Verification: OBSERVED by J2 once (before/after screenshots: $90,000 to $9,000, $30,000 to $3,000, titles lost the MOCK prefix, a start date moved). Overwrite rule CONFIRMED in code (db/legal.ts:191-210, legal-tools.ts:353-395). The demo model is scripted and non-deterministic, so real-model behaviour is UNVERIFIED. Rated P2 for that reason; raise to P1 if a real-model run reproduces it.
- Files to change:
  - packages/db/src/legal.ts (when input.revision equals stored.analyzedRevision and a stored value differs, keep the stored value and return the proposed one as a change; replace only when the revision is newer)
  - packages/adapters/src/legal-tools.ts:353-395 (surface 'proposed change' in the tool result so the agent tells the user)
  - packages/db/src/legal.test.ts (same revision with a different value keeps the stored value; newer revision replaces it)
- Reach: Everyone who re-scans Legal; the numbers are money on a contract list.
- Acceptance criteria:
  - Same-revision upsert with a different valueCents keeps the stored value (unit test).
  - A newer revision with a different value replaces it and the agent's result lists the change.
- Needs product decision: false
- Depends on / conflicts: Conflicts: none. Depends on nothing.

### C7 [P2] Mail approval card: a failed send says only 'Message not found', stays failed after the same draft is sent from the composer, and the '...' button orphans onto a third line on a phone
- Rank: 7. Effort: M. Reopens: iteration-22 C1 (default reason line met; this is the live cause and the stale card).
- Finding ids (found by): J1-01 (J1), J1-02 (J1), J3-06 (J3), R1-23-06 / R2-23-05 are in C8
- Root cause: mapStatus turns every 404 into MailProviderError('not_found', 'Message not found') (packages/adapters/src/gmail-mail-provider.ts:934), which the card prints as bare red text. Why the approval-card send hits 404 while the composer send works is not traced (J1 suspects the emulator at composio-emulator.ts:599 does not know the reply-to message id for a freshly connected account). The card never listens for the thread gaining the outgoing message, so after 'Open in composer' sent it, the card still shows failed and the agent's 'wasn't sent' message stays.
- Verification: OBSERVED by J1 (demo only; real Gmail UNVERIFIED) and J3 (orphan '...' at 375). Wording mapping CONFIRMED in code. The 404 cause is SUSPECTED. Rated P2: 'Open in composer' recovers.
- Files to change:
  - packages/adapters/src/gmail-mail-provider.ts:934 and the reply path in packages/adapters/src/mail-tools.ts (find why the approved-draft send resolves the reply target differently from the composer; fix, or map not_found on a send to 'Could not send. Open it in the composer.')
  - apps/web/src/components/MailApprovalCard.tsx (mark the card Sent, or hide 'Open in composer', when the thread gains the outgoing message; keep '...' on the Send/Discard line at 375 px)
  - apps/web/src/components/MailApprovalCard.test.tsx
- Reach: Everyone who approves an agent email.
- Acceptance criteria:
  - A 404 on an approved send shows a sentence with the next step, not the bare provider text (unit test with a mocked 404).
  - After the same draft is sent from the composer, the card shows Sent and the failed line is gone.
  - At 375 px the '...' stays on the same line as Send/Discard.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C1 only if it edits MailApprovalCard (it does not).

### C8 [P2] An agent says 'Sent to Priya' for an external email with no approval card, no tool record and no mail evidence in the thread
- Rank: 8. Effort: S. Reopens: iteration-6 decision (ask before sending external email defaults on).
- Finding ids (found by): R1-23-06 (R1), R2-23-05 (R2)
- Root cause: Two walkers saw delegated Inbox-agent replies say 'Sent to Priya' with no approval card. Either the demo founder has 'Ask before sending external email' off, or the reply is scripted mock-model text, or the agent reports a send before a send result exists. Not traced.
- Verification: OBSERVED twice on shared threads; cause UNCONFIRMED. Investigate first, change only if a real path reports 'sent' without a send result.
- Files to change:
  - First: read the demo founder's setting and the thread's tool records; check the tool-result path in packages/adapters/src/executor.ts that feeds 'Sent' wording (find the delegate/relay reply)
  - Only if the agent reports sent without a result: the relay prompt in executor.ts (say 'sent' only after a send result, else 'waiting for your approval')
- Reach: Anyone delegating a mail send; trust in the main write action.
- Acceptance criteria:
  - With the setting on, a delegated external send produces an approval card and no 'Sent' text before approval (mocked executor test).
  - If the cause is the demo's scripted model, the cluster closes with a note and no code change.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C7 (mail wording), C10 (executor.ts).

### C9 [P2] Cold load: the workspace skeleton can sit for 20 to 30 s with no 'Try again', and /sign-in first paints a plain 'Loading...'
- Rank: 9. Effort: S. Reopens: iteration-22 C3.
- Finding ids (found by): V3-01 (V3), J2-07 (J2), R1-23-04 (R1), R1-23-03 (R1)
- Root cause: Pass-22 added a slow state to ShellSkeleton (ShellSkeleton.tsx:65-95 now contains OpeningSpace). V3 (2 of 7 direct loads, 24 s) and J2 (30 s, once in 25) still saw skeletons with no retry past 20 s, and R1 saw 8 to 25 s. R1 could not delay the bootstrap request to see the 20 s state. Separately the /sign-in route's lazy-load fallback is 'Loading...' (App.tsx:159).
- Verification: OBSERVED by V3, J2, R1 on a stack shared by about 10 walkers (load average up to 57), so durations are environment-inflated; the missing retry past 20 s is the defect. R1 'unobserved' means the pass-22 criterion is only PARTLY verified. Fix is not proven to be missing: first reproduce with the bootstrap request blocked.
- Files to change:
  - apps/web/src/components/ShellSkeleton.tsx and apps/web/src/App.tsx (reproduce with a blocked /bootstrap call in a test; make sure the 20 s line and Try again appear on every skeleton route, including /app/contacts and /app/artifacts)
  - apps/web/src/App.tsx:159 (make the sign-in fallback the form frame, or import the sign-in route eagerly)
  - apps/web/src/components/ShellSkeleton.test.tsx
- Reach: Any user on a slow connection; first impression.
- Acceptance criteria:
  - With the bootstrap request blocked, every /app route shows a still-loading sentence and Try again within 20 s (test with fake timers).
  - /sign-in paints the form frame in the first paint.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C2 (App.tsx and Shell.tsx are near, different regions).

### C10 [P2] Mercury and Brex agents: replies after a denial or with changes off tell the person to ask the agent they are already talking to; a raw code value ('pendingApproval') shows in prose
- Rank: 10. Effort: S. Reopens: iteration-22 C23, iteration-15 refusal-without-direction item.
- Finding ids (found by): J2-01 (J2), J2-05 (J2)
- Root cause: The Finance peer prompt ends 'If you cannot message it, say so and tell the user to ask the Mercury or Brex agent directly' (packages/adapters/src/executor.ts:8703). DENIED_ACTION_MESSAGE (approval-effect.ts:364) tells the model not to retry but not to avoid redirecting the person. J2 saw this text in the Mercury agent's own chat after a denial, and 'I couldn't message the Mercury agent ... Open Integrations' with the switch off. The fake tool returns status 'pendingApproval' (finance-fake-tools.ts:132) and the approved-payment note tells the model to quote the status exactly.
- Verification: OBSERVED by J2 (m10-m15). The prompt text and the status string are CONFIRMED in code; that the peer text reaches the Mercury agent's own prompt is SUSPECTED. What turned 'Allow changes in Mercury' off while J2 worked is unknown (R3 saw the same off switch with a pending $1,200 approval); another walker may have. Rated P2, not P1: with the switch on, the flow worked.
- Files to change:
  - packages/adapters/src/executor.ts:8703 (peer text only for agents that are not the Mercury or Brex agent; give those agents their own failure wording: changes are off with a link to the Allow changes switch at /app/integrations/mcp/{id}, no matching recipient, denied)
  - packages/adapters/src/approval-effect.ts:364 and the approvedPaymentResult note (paraphrase status codes in words: 'waiting for approval in Mercury')
  - packages/adapters/src/executor-approval-replay.test.ts (new cases)
- Reach: Anyone paying a bill through an agent; writes are off by default, so the writes-off reply is the first one a new user meets.
- Acceptance criteria:
  - With writes off, the Mercury agent's reply says changes are off and links to the Allow changes switch; it never says 'ask the Mercury agent'.
  - After a denial the reply says it was not submitted and offers no redirect.
  - No reply contains the literal 'pendingApproval'.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C8 (executor.ts, different regions).

### C11 [P2] Data room failures leave no record: the upload error toast disappears after 8 s, an untagged file's preview gives no reason, a stuck read gives no hint
- Rank: 11. Effort: S. Reopens: iteration-22 C5 (failed row met; untagged reason not met).
- Finding ids (found by): J2-04 (J2), R1-23-02 (R1), V3-04 (V3), J2-11 (J2)
- Root cause: Error toasts go through dismissLater with FAILED_TOAST_MS = 8_000 (upload-toasts.ts:71, 164, 200), so a looked-away user never learns a zip was rejected. UntaggedNote (Preview.tsx:197-235) says nothing for a settled file with no type (R1: row says Not tagged; the status value was not read). Processing strip stays 'Reading X' for about 12 minutes before 'Reading took too long'.
- Verification: OBSERVED: J2 (toast gone at 10 s, measured), R1 and V3 (untagged preview), J2 (12 minutes). Toast timing and the UntaggedNote path CONFIRMED in code; the untagged status value is SUSPECTED.
- Files to change:
  - apps/web/src/components/data-room/upload-toasts.ts (error toasts stay until dismissed; success keeps auto-dismiss)
  - apps/web/src/components/data-room/Preview.tsx:197-235 and :381 (show 'Type: Not tagged' with a one-line reason and one action for any settled file with no type)
  - apps/web/src/components/data-room/ProcessingStrip.tsx ('Taking longer than usual' after about 1 minute)
  - apps/web/src/components/data-room/upload-toasts.test.ts
- Reach: Anyone uploading to the Data room.
- Acceptance criteria:
  - A rejected upload's toast is still visible after 60 s and goes only with its X.
  - An untagged settled file's preview states why it has no type and offers one action, whatever the consent state.
  - A read running over 60 s shows 'Taking longer than usual'.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C12 (Data room components).

### C12 [P3] Data room polish: Type column too narrow, duplicate waiting text, strip count off the gutter, blank PDF tile, empty folder after Auto-sort
- Rank: 12. Effort: S. Reopens: iteration-22 C14 (name column part met).
- Finding ids (found by): R2-23-04 (R2), V3-02 (V3), V3-03 (V3), J2-10 (J2), V3-05 (V3), J2-12 (J2)
- Root cause: Type column width in ItemRows.tsx truncates 'Investor docume...' while Name has spare width. While the consent card shows, the processing strip adds 'Waiting for permission to read' (same fact) and moves content 36 px between views. ProcessingStrip.tsx:51 count is at x=1424 against a 1412 gutter. A PDF with a blank thumbnail gets a white tile with no icon. Auto-sort leaves its emptied folder.
- Verification: OBSERVED by R2, V3, J2 (screens named in their files). Code locations other than ProcessingStrip.tsx:51 are suspected.
- Files to change:
  - apps/web/src/components/data-room/ItemRows.tsx (Type about w-36)
  - apps/web/src/components/data-room/ProcessingStrip.tsx (hide while the consent card shows; align count to the gutter)
  - grid tile component (file icon when the thumbnail has no content)
  - Auto-sort apply (remove or offer to remove emptied folders)
- Reach: Data room users; cosmetic.
- Acceptance criteria:
  - Type shows 'Investor document' in full at 1440 and 1280.
  - No strip text repeats the consent card, and list/grid/stats content starts at the same y.
  - A blank thumbnail shows the file icon.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C11 (same folder).

### C13 [P2] Inbox: hover toolbar covers the subject, Ask agent panel moves the dialog off centre and drops Archive, unread dot floats off the row on touch, collapsed To do card is 56 px, Cleanup note reads as advice to archive
- Rank: 13. Effort: M. Reopens: iteration-22 C11 (3 of 4 met), iteration-10 C13.
- Finding ids (found by): V2-12 (V2), V2-03 (V2), J3-05 (J3), V2-14 (V2), R2-23-02 (R2), J1-07 (J1)
- Root cause: InboxRow draws four 16 px action icons over the subject on hover or focus (V2 saw 'draft for your re'). InboxMessageDialog widens to 8 px from the window edge with the Ask agent panel and drops Archive from the toolbar. The unread dot uses pointer-coarse:translate-x-2.5 pointer-coarse:-translate-y-3 (InboxRow.tsx:320). The collapsed To do card is 56 px at 375 (criterion was 48). CleanupSenderRow.tsx:36-40 prints 'You read most of these' under an Archive button.
- Verification: OBSERVED by V2, J3, R2, J1. InboxRow.tsx:320 and CleanupSenderRow.tsx:36-40 CONFIRMED in code; the dialog and hover-toolbar locations are suspected.
- Files to change:
  - apps/web/src/components/inbox/InboxRow.tsx (reserve space for the toolbar; dot inline before the sender on touch)
  - apps/web/src/components/inbox/InboxMessageDialog.tsx (stay centred, keep the toolbar, Archive in '...' only when narrow)
  - apps/web/src/pages/Inbox.tsx (collapsed To do padding at phone width)
  - apps/web/src/components/inbox/CleanupSenderRow.tsx:36-40 (neutral wording: 'You read most of these, so keep them unless you are sure')
- Reach: Daily Inbox users.
- Acceptance criteria:
  - Hover toolbar never overlaps subject text at 1440 with and without the agent panel.
  - Opening Ask agent keeps equal side gutters and the same toolbar buttons.
  - Collapsed To do card is at most 48 px at 375.
  - Cleanup read-heavy rows do not read as a reason to archive.
- Needs product decision: false
- Depends on / conflicts: Conflicts: none.

### C14 [P2] Finance on a phone: Spend rows squeeze the name, Category bar labels collide, Burn has no y scale, Crypto rows break mid-label, sub-page headers waste a row
- Rank: 14. Effort: M. Reopens: none.
- Finding ids (found by): V2-04 (V2), V2-05 (V2), V2-06 (V2), V2-07 (V2), V2-13 (V2)
- Root cause: Layouts keep desktop column structure at 375 px: Date takes 70 px beside Counterparty in the Spend list; seven '$7,500' bar labels touch; the Burn chart hides its y axis under a width breakpoint while Accounts and Runway keep theirs; wallet rows break 'Safe . 2 of 3' and 'Self-custody'; the space picker pushes 'Ask' and 'Add account' to a second row.
- Verification: OBSERVED by V2 at 375 with touch emulation. Component files suspected (apps/web/src/pages/finance/).
- Files to change:
  - apps/web/src/pages/finance/FinanceSpend.tsx (date under the counterparty on phones)
  - Finance Category chart (abbreviate to $7.5k or label the selected bar only)
  - Finance Burn chart (keep a two-tick y axis on phones)
  - Finance Crypto rows (type on its own line, shared amount and menu columns)
  - Finance sub-page header (space picker out of the title row on phones)
- Reach: Phone users of Finance (a core page).
- Acceptance criteria:
  - At 375 px no counterparty wraps beyond two lines; bar labels do not touch; Burn shows a y scale; crypto rows share one amount column; Ask stays on the title line.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C15 (Finance files).

### C15 [P3] Finance 1440 polish: Accounts range control unframed, Subscriptions table spans 1040 px, two money-out figures on the first screen, uneven cards, legend marker
- Rank: 15. Effort: S. Reopens: iteration-22 C21 (two items not met), iteration-11 C26, iteration-12 C23.
- Finding ids (found by): R3-23-01 (R3), R3-23-02 (R3), FLOW-07 (FLOW), V2-18 (V2)
- Root cause: FinanceAccounts.tsx:327 uses PeriodTabs in the card action instead of the overview's framed range bar; the subscription table spans the whole card (vendor to amount about 880 px apart; capped width was a pass-11 and pass-22 criterion). Overview shows 'Monthly burn $67,621' and 'Spent so far $20,484' 120 px apart with the period row looking like a section title. Breakdown and Upcoming heights differ (owner decided natural heights in pass 22, so only the legend marker is raised).
- Verification: OBSERVED by R3, FLOW, V2. FinanceAccounts.tsx:327 per R3 (not re-read). Breakdown/Upcoming height difference is a recorded decision and is excluded.
- Files to change:
  - apps/web/src/pages/finance/FinanceAccounts.tsx:327
  - apps/web/src/pages/Finance.tsx and apps/web/src/pages/finance/FinanceSpend.tsx (max-w-3xl subscription table)
  - Finance overview period row (label it as a filter or move it into the chart header)
  - Burn legend marker (triangle for Financing)
- Reach: Finance users; cosmetic.
- Acceptance criteria:
  - Accounts and overview use the same framed range control.
  - Subscriptions vendor to amount distance is under 500 px at 1440.
  - The burn legend uses the same marker as the chart.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C14 (Finance files).

### C16 [P2] Sidebar: a new bot's row is below the fold, an inactive space holding only page agents is listed as a section, page-agent counts change by page, the list ends short of the footer
- Rank: 16. Effort: M. Reopens: iteration-22 C25, iteration-21 C11.
- Finding ids (found by): J2-06 (J2), R3-23-04 (R3), V3-07 (V3), J1-08 (J1), V2-17 (V2)
- Root cause: (1) After Create > New bot the list scrolls inside a 345 px box and the active row stays under '+11 more'; no scroll-into-view; only a top fade exists (Shell.tsx:5038-5042). (2) space-sidebar.ts builds sections from 'root' bots that include page agents, then 'if (sections.length > 0) return sections' (space-sidebar.ts:185-189) before the empty-space check at :190, so an inactive space with only auto-created Legal and Investors agents is shown, against the pass-22 decision. (3) The Page agents count read 2, 1, 1, 1 by page. (4) The scroller ends 40 to 90 px above the footer.
- Verification: OBSERVED by J2, R3, V3 (suspected on a shared stack), J1, V2. (2) CONFIRMED in code. Others suspected.
- Files to change:
  - apps/web/src/pages/shell/space-sidebar.ts:185-190 (page agents do not count toward a non-empty inactive space)
  - apps/web/src/pages/Shell.tsx:5038 (scroll the active row into view on create/navigate; bottom fade; fill remaining height; start at scrollTop 0)
  - page-agent count (count agents that have a chat, on every page)
  - apps/web/src/pages/shell/space-sidebar.test.ts
- Reach: Everyone who creates bots; spaces with page agents.
- Acceptance criteria:
  - After creating a bot its row is visible without scrolling.
  - An inactive space whose only bots are untouched page agents is absent from the sidebar and present in the switcher (unit test).
  - The Page agents count is the same on every page.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C2 (Shell.tsx, other regions).

### C17 [P2] First-run tour opens at an unpredictable moment: not on landing, then over the Gmail card the person just clicked
- Rank: 17. Effort: S. Reopens: iteration-11 C-tour trigger decision, iteration-13 C4.
- Finding ids (found by): J1-03 (J1)
- Root cause: On two fresh sign-ups the tour did not open for 24 s with the first-question card untouched, did not open after 'Run my company', and opened about 20 s after landing only when Gmail Connect was clicked. After Dismiss it opened within 3 s. The open condition treats 'card answered' differently from 'card dismissed' (FirstRunTour.tsx and its caller in Shell.tsx; condition not read).
- Verification: OBSERVED by J1 twice; R2 saw the dismiss path work. Code location suspected.
- Files to change:
  - apps/web/src/components/tour/FirstRunTour.tsx and its caller in apps/web/src/pages/Shell.tsx
- Reach: Every new user.
- Acceptance criteria:
  - The tour opens within 3 s of the first-question card being answered or dismissed, and never on an unrelated click.
- Needs product decision: true - Should the tour open as soon as the first-question card is answered ('Run my company'), or only after Dismiss or an idle period? (Passes 11, 13 and 14 held it until connect cards were answered.)
- Depends on / conflicts: Conflicts: C1 (the card must be dismissible on phones first).

### C18 [P3] Settings, auth and Create menu polish
- Rank: 18. Effort: S. Reopens: none.
- Finding ids (found by): V1-05 (V1), V1-06 (V1), V1-07 (V1), V1-08 (V1), V1-13 (V1), V1-12 (V1), R2-23-06 (R2), V1-10 (V1), V1-11 (V1), J2-13 (J2)
- Root cause: Small, separate defects in single files: reserved error row makes 'Forgot password?' float 54 px under the field (Auth.tsx about 345-365); Models and Voice tabs use different list widths and disabled styles (ModelSettingsOverlay.tsx); 'Your bots use OpenAI' while OpenRouter shows the check; Kraken dialog help link has no underline and 'Connect' is enabled with empty fields (ExchangeConnectDialog.tsx about 30-34); 'Delete account' is as prominent as the primary; the Create popover is a listbox named 'Suggestions'; off-switch contrast not measured; Integrations search is narrower than the grid; a connected card moves 188 px with no cue; the routine skill select loses its label.
- Verification: OBSERVED by V1, R2, J2; locations from the walkers, not re-read.
- Files to change:
  - apps/web/src/pages/Auth.tsx
  - apps/web/src/pages/ModelSettingsOverlay.tsx
  - apps/web/src/components/integrations/ExchangeConnectDialog.tsx
  - Settings General account card
  - Create popover in apps/web/src/pages/Shell.tsx (role=menu)
  - apps/web/src/pages/RoutineEditor.tsx (Skill label)
  - packages/ui-web switch (3:1 off-state border if below)
- Reach: All users; cosmetic.
- Acceptance criteria:
  - Each listed item matches its proposed fix; the Kraken Connect button is disabled until both fields have text; the Create popover exposes role=menu.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C16 and C2 (Shell.tsx).

### C19 [P3] Bot header and bot settings: a long name is clipped without an ellipsis, rename changes the sidebar time, 'Saved' shows with no change
- Rank: 19. Effort: S. Reopens: none.
- Finding ids (found by): V1-02 (V1), V1-03 (V1), V1-04 (V1)
- Root cause: Header title lacks truncate and the Name field has no length limit; the sidebar time uses the bot's update time, so a rename reads as activity; the settings panel saves on blur even when the value equals the stored one.
- Verification: OBSERVED by V1; causes suspected.
- Files to change:
  - apps/web/src/pages/Shell.tsx (header title truncate with title attribute; sidebar time from the last message)
  - bot settings panel (skip save and the Saved badge when unchanged; cap the name at about 60 characters)
- Reach: Bot owners; cosmetic.
- Acceptance criteria:
  - A 90-character name ends in an ellipsis in the header.
  - Rename does not change the sidebar time.
  - Focus leaving an untouched Name field shows no Saved badge.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C16, C18 (Shell.tsx).

### C20 [P2] Phone text fields under 16 px: the chat composer is 15.5 px and the Settings section select is 14 px
- Rank: 20. Effort: S. Reopens: none.
- Finding ids (found by): J3-04 (J3)
- Root cause: iOS Safari zooms the page when a focused field has a font size under 16 px. composer.tsx:1128 uses text-[15.5px]; SettingsOverlay.tsx:260-282 uses a NativeSelect at 14 px.
- Verification: Sizes CONFIRMED in code (composer.tsx:1128). The zoom itself is not observed on a real iPhone (J3 used Chromium).
- Files to change:
  - apps/web/src/pages/shell/composer.tsx:1128 (16 px on coarse pointers)
  - apps/web/src/pages/SettingsOverlay.tsx:260,282 (16 px on coarse pointers)
- Reach: Every iPhone Safari user of chat.
- Acceptance criteria:
  - Computed font size is at least 16 px for the composer textarea and the Settings select under pointer: coarse (test or measured).
- Needs product decision: false
- Depends on / conflicts: Conflicts: none.

### C21 [P3] Integrations connected cards use two layouts; Popular cards a third
- Rank: 21. Effort: S. Reopens: iteration-22 C22 (not met).
- Finding ids (found by): R3-23-03 (R3), J2-09 (J2), FLOW-05 (FLOW)
- Root cause: IntegrationsHome.tsx renders 'Used by' (line 108) above the action on Gmail and Carta but below it on Mercury, Brex and Blockscout; Coinbase has no 'Used by'; Popular puts the action at the bottom (action tops measured 15, 65 and 81 px). Only some connected cards have a '...' menu.
- Verification: OBSERVED by R3, J2, FLOW; the pass-22 criterion (same place) is not met. Line 108 CONFIRMED.
- Files to change:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (one body: title, description, footer row with 'Used by' left and the action right, for both groups)
- Reach: Integrations visitors; cosmetic.
- Acceptance criteria:
  - The action button's top offset inside the card is identical for every connected and popular card at 1440.
- Needs product decision: false
- Depends on / conflicts: Conflicts: none.

### C22 [P3] Investors and Fundraising: a dash-only Invested column, two empty cards above the only card with data, SAFEs not linked to the matching contact
- Rank: 22. Effort: S. Reopens: iteration-21 V3-06 (deferred 'product look').
- Finding ids (found by): FLOW-02 (FLOW), FLOW-04 (FLOW), FLOW-03 (FLOW)
- Root cause: HoldingsTable.tsx:61 always renders the Invested column; Fundraising shows 'Start a round' and 'No prospects yet' before the SAFEs card; SafeList.tsx:259,311 offers 'Assign to contact' whenever no contact is stored, with no name match. Another session owns the Investors and Fundraising redesign.
- Verification: OBSERVED by FLOW (9 dashes; 240 px of empty cards). Suggestions, not defects blocking a task.
- Files to change:
  - apps/web/src/components/cap-table/HoldingsTable.tsx:61
  - apps/web/src/components/fundraising/SafeList.tsx
  - Fundraising page order
- Reach: Fundraising users.
- Acceptance criteria:
  - Invested column hidden when no holder has an amount.
  - SAFEs card first when there are no prospects and no round.
  - A SAFE holder matching exactly one contact's organisation shows that contact.
- Needs product decision: true - Should a SAFE be linked to a contact automatically when exactly one contact's organisation equals the holder's name? Is the other session's redesign finished so these files can change?
- Depends on / conflicts: Conflicts: another session's Investors and Fundraising work.

### C23 [P3] Empty space home: the 'No bots yet' heading and the New bot button sit 450 px apart
- Rank: 23. Effort: S. Reopens: iteration-22 C25.
- Finding ids (found by): R3-23-06 (R3)
- Root cause: The empty-space pane in Shell.tsx puts a small heading top-left and the button alone near the vertical middle.
- Verification: OBSERVED by R3 (33-empty-home.png); location suspected.
- Files to change:
  - empty-space pane in apps/web/src/pages/Shell.tsx
- Reach: Users with an empty space.
- Acceptance criteria:
  - Heading and New bot button sit together in one centred empty state.
- Needs product decision: false
- Depends on / conflicts: Conflicts: C16, C19 (Shell.tsx).

### C24 [P3] Artifacts: versioned card title is cut beside the badge, list columns far apart, split panes stop 130 px short of the window bottom
- Rank: 24. Effort: S. Reopens: iteration-22 C20.
- Finding ids (found by): R2-23-03 (R2), V3-06 (V3), V2-11 (V2)
- Root cause: Card title line-clamp-1 sits beside the v2 chip (touch has no hover title); list Name is about 800 px from Type and Added; the split pane has a fixed or content height (ends at y=767 of 900).
- Verification: OBSERVED by R2, V3, V2 (artifact-ui-1440.png).
- Files to change:
  - apps/web/src/pages/Artifacts.tsx
- Reach: Artifacts users.
- Acceptance criteria:
  - Version chip on the description row or title wraps to two lines at 72 px card height.
  - Split panes fill the viewport height.
- Needs product decision: false
- Depends on / conflicts: Conflicts: none.

### C25 [P3] Storybook smoke fails on one story: shell-delegate-wait-notice--first-minute renders nothing
- Rank: 25. Effort: XS. Reopens: none.
- Finding ids (found by): R3-23-05 (R3)
- Root cause: FirstMinute renders null by design, and the smoke test treats an empty render as a failure (1812 of 1813).
- Verification: OBSERVED by R3 with a local build; CONFIRMED in code (DelegateWaitNotice.stories.tsx:25 has no visible-root decorator).
- Files to change:
  - apps/web/src/pages/shell/DelegateWaitNotice.stories.tsx:25 (decorators: [withVisibleRoot('No notice in the first minute')] from apps/web/src/stories/decorators.tsx)
- Reach: Repository gate (design-system smoke), no user effect.
- Acceptance criteria:
  - node .storybook/smoke.mjs in apps/web renders 1813 of 1813 stories.
- Needs product decision: false
- Depends on / conflicts: Conflicts: none. Smallest change, do first.

## Deferred items (not in a cluster)
- R1-23-05 and J2-08: with one toast, the main area keeps 114 px free across the full width while the toast covers 480 px. The pass-22 C9 criterion is met (list ends exactly at the toast top); reopen only if the owner wants the space reserved under the toast column only.
- J1-05 Inbox first sync 16 to 36 s then 'Sorting your mail': demo emulator timing; pass-22 C2 shows the loading line and readable rows. Stream the first batch only if real Gmail is slow.
- J1-04 and V1-09 tour dead band, FLOW-01 tour card over the roster: owner decision (fixed card spot).
- J1-06 Finance agent answer omits the 24.6 months: scripted demo model; check with a real model.
- V2-19 'Important' tab lists every message before sorting: pass-9 decision.
- V3-04 mobile preview thumbnail vs desktop: different files, suspected.
- FLOW-06 four 'Open Finance' buttons and two iMessage tiles: owner question - show the page button once per group and merge the iMessage tiles into one detail view with a transport choice?
- R3 note: Mercury detail showed 'Allow changes' off with a pending approval and an agent present; cause unknown, possibly another walker. If it reproduces from a clean demo, file a cluster (see C10).
- R3 note: Auto-sort on the demo reports 'Already tidy.' after a long wait; the change-list criterion needs seeded misplaced files.
- J2 note: Investors 'SAFEs and funds' contact list shows non-holders and omits Harbor Angels; owned by another session, not filed.
- R1 timing note: demo machine was loaded, so all timings are upper bounds.

## BLOCKED stories
- STORY-APP-309 and APP-319 model sign-in and 'Connect your apps' (demo has a default model); STORY-APP-209 Mercury connect partly (one-click mock); STORY-CAP-017/106 Carta sign-in (already connected, real provider); STORY-FIN-022 reconnect chip (J2 skipped).
- STORY-DRM-109 1.2 GB and 600 MB files and the 'Already in Investors' duplicate card (no matching file); Box and email import; DRM-018 drag and drop.
- Pass-22 C1 live failed send beyond J1's case, C3 delayed bootstrap, C9 phone Routine panel toast, C17 waiting or failed delegate state, C27 chip focus ring and empty-chat suggestion alignment (no empty chat with chips), Auto-sort change list (demo ends 'Already tidy.').
- STORY-APP-212 contract renewal email to Legal to approved reply (J2 skipped); STORY-INB-040 and STORY-APP-213 remainder on a phone (J3 skipped Send, Hide amounts, bell, Cap table agent); STORY-APP-009 laptop sidebar toggle.
- Not run: OAuth connects (Google, Slack, Notion, GitHub, Linear, OpenRouter), real-iPhone zoom check (C20), 200% zoom, reduced motion, 13-chat drawer, light theme at 375, 'Messaged Inbox agent' waiting/failed states.

## Counts by severity
- Clusters: P0 0, P1 1, P2 15, P3 9 (25 total).
- Raw findings: R1 6, R2 6, R3 6, J1 8, J2 14, J3 6, FLOW 7, V1 13, V2 19, V3 7 = 92. Walkers rated P1: R1-23-01, R2-23-01, J1-01, J2-01, J2-02, J3-01, J3-02, V2-01 (8). After clustering and the calls above: one P1 cluster. Every finding is in a cluster or in Deferred.
- Needs an owner decision: C17 (tour trigger), C22 (SAFE-contact link, redesign ownership); FLOW-06 in Deferred.
- Suggested order: C25 (minutes), C1, C20, C3, C2, C9, C4, C10, C11, C7, C16, C13, C5, C6, C14, then P3 clusters; C8 starts as an investigation.
