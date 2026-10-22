# Walk R1: verify pass-11 clusters C1-C10

Target: mock demo stack, web :5381, 1440x900 (375x812 for C9). Screenshots in /tmp/uxloop12/R1/.
Console: no errors during the walk. Payment flows ran on my own fresh "New Bot" thread (Mercury "Allow changes" was off at the start; I turned it on and gave New Bot access to run C1/C6/C9).

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C1 one card per payment request | PARTLY | 6 / 4 | Reload mid-run with a short prompt: exactly one live card, final message names the approved outcome. With a longer prompt the bot messaged the Mercury agent twice, producing two cards; see R1-01. |
| C2 Legal Undo | PASS | 3 / 3 | Done and Dismiss both show "Marked/Dismissed ... Undo" in place of the row (65 px, same as the row, no jump). Undo restores the row at its position. The line is gone after 30 s. |
| C3 Chief sorting counts | BLOCKED (partly checked) | n/a | The demo mailbox is already sorted, so the "still sorting" state cannot be produced. After the sort, "needs a reply" matches Inbox (17), but "open to-dos" does not (R1-02). Two bubbles for one delegated answer (R1-03). |
| C4 money requests via Chief | PARTLY | 5 / 3 | Missing recipient is now reported as such, with no wrong "Allow changes" sentence. "Allow changes" is named only while the switch was off (met). Not met: two outcome messages per request (R1-03), and an "Open Integrations" link on a user-denied outcome (R1-07). |
| C5 routine Test run | PARTLY | 8 / 6 | Met: prompt stored without the schedule sentence, approval card leads with "Every Monday at 9:00 AM, posts here" with the prompt under Details, Test run posts the real figures in chat. Not met: forced skill not shown in "Add a skill" (R1-04). History shows "Done / View chat", not the output (R1-05, P3). |
| C6 approval toast | PASS | 3 / 3 | After a reload with an unanswered approval, exactly one toast; it opens the Mercury chat; it is gone once the card is answered. A toast also appeared while I was on the Inbox page. Not tested with Chief as the requester (Chief has no Mercury access on this demo; a New Bot request routed to the Mercury agent behaved the same). |
| C7 Legal Scan now | PASS | 4 / 4 | Without consent the Scan now button is not rendered at all (hidden, not disabled) and the card offers Allow. After a scan the line reads "Scan finished: 2 contracts and 0 deadlines added or updated." (the contract count went 10 to 12). Not tested: reviewed values being overwritten, and the "no row changed" line. |
| C8 consent cards | PASS (partly observed) | 5 / 5 | Legal and Data room use the same component (DocumentsConsentCard) with Allow / Not now; Legal showed it. With consent off, granting by RPC and dispatching window focus removed the card within 2 s and Scan now appeared. Settings switch, Legal, Data room and Inbox agreed (all allowed) at the end. Before my walk, a Legal card stayed up while the server already said allowed, which is what C8 describes, but I cannot tell how long it had been stale. A fresh signed-up user has no mail/model so no card to compare. |
| C9 approval card | PASS | 4 / 4 | At 375 px the question wraps fully and Details has no nested scroll (no element with scroll overflow). Approved payment reads "Approved here. Waiting for Mercury". Approved and Denied cards collapse the same way and show the request time (4:35 AM, 4:37 AM). |
| C10 Legal contracts table | PASS (1 residual) | 2 / 2 | Longest name (50 chars) wraps to two lines, none cut. Row heights 56-57 px (within 1 px). Status column absent with 10 rows and no status; it appears only after the scan added Draft/Unknown rows. Residual: the Renewal column is cut (R1-06). |

## Findings

| id | page / cluster | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C1, Mercury chat | P1 | bug | Observed. One request to pay $75 (long note) made New Bot call the Mercury agent twice, giving two cards. The older read "No longer active". I denied the newer card; the older card then showed live Send/Deny buttons again (also after reload). I pressed Send on it: "Approved here. Waiting for Mercury" and New Bot got "Submitted: Mercury is holding the $75 payment". So the thread said "you denied" and then "Submitted" for one request. Expected: a denied request cannot be approved later, and one outcome. The first request ($250) had one card and one outcome. Caveat: other walkers use the same user, but the notes in both cards were mine. | /tmp/uxloop12/R1/c9-375b.png, c9-deny.png, c1-reload.png, c1-stale-click.png | packages/adapters/src/executor.ts (pauseForAsk / resume), apps/web/src/components/AskCard.tsx (superseded state computed from "a newer live card exists") | Mark the older card superseded in the database when a newer card is created, and reject its approval server-side. |
| R1-02 | C3, Chief / Inbox | P1 | bug | Observed. Chief answered "0 open to-dos" (twice) while the Inbox To do card lists 5 items (2 shown, "3 more"). "17 emails need a reply" matches the Needs reply group. | /tmp/uxloop12/R1/inbox.png and New Bot chat text | Chief/Inbox agent count tool (grep the to-do count in apps/api/src/inbox-agent.ts or the Chief tools); suspected | Make the count use the same to-do source the Inbox card reads. |
| R1-03 | C3/C4, delegated replies | P2 | flow | Observed. Two bubbles for one delegated answer: for the Cobalt payment, "Mercury doesn't have a payment agent enabled yet..." and "Not submitted: Chief doesn't have a Mercury agent..." both end in "Turn on Allow changes ... then ask again. Open Integrations". For the count question the interim bubble and the final both say "0 open to-dos". Expected one bubble per request. | /tmp/uxloop12/R1/pay2.png, c5-create.png | executor relay / Chief relay prompt (packages/adapters/src/executor.ts); suspected | Replace the interim relay message with the final one. |
| R1-04 | C5, Routine editor | P1 | bug | Observed. A routine created from "/investor-update every Friday at 4pm..." stores "@investor-update Use the investor-update skill ..." in Instruction while "Add a skill" stays empty. Expected the skill in the picker and a plain instruction. | /tmp/uxloop12/R1/c5-editor2.png | packages/adapters/src/schedule-tools.ts; suspected | Save the forced skill on the routine record and strip the "@skill" prefix from the instruction. |
| R1-05 | C5, Run history | P3 | flow | Observed. History shows "Oct 22, 4:40 AM, Done, 31s, View chat" and not the produced note. Acceptance said the entry shows the output; "View chat" links to it, so this is a judgment call. | /tmp/uxloop12/R1/c5-test.png | routine history row in the routines panel | Show the first line of the result under the entry. |
| R1-06 | C10, Legal Contracts | P3 | visual | Observed. The Renewal column cuts "Auto-renews, 30 days no..." (also 62 and 90 days) while the Status column, empty for most rows, keeps its width. The full text is only in a hover title. Same kind of cut C10 fixed for names. | /tmp/uxloop12/R1/c7-scan-done.png | apps/web/src/pages/legal/LegalContracts.tsx:218 (truncate) | Let the Renewal cell wrap to two lines like the Contract cell. |
| R1-07 | C4, denied payment | P3 | copy | Observed. After the user denies, the message ends with "Open Integrations": "Not submitted - you denied the approval request ... Open Integrations". The link has no purpose here. | New Bot chat text (4:37 AM) | apps/api/src/integration-agent.ts / finance-agent.ts reply wording; suspected | Drop the link on a user denial. |
| R1-08 | C1/C6, New Bot | P2 | flow | Observed once. After a reload while the run waited for approval, the composer showed a red "This agent could not finish. Try again. Retry" next to the "needs approval" toast. The run was waiting, not failed. The banner was gone after approval. | /tmp/uxloop12/R1/pay3.png | chat run-status banner in apps/web (run state after reload); suspected | Treat a run paused on an approval as "waiting for approval", not failed. |
| R1-09 | sidebar | P3 | copy | Observed. The Legal agent's preview shows a raw ISO date: "Overdue 2026-10-17 - Q3 board conse...". | /tmp/uxloop12/R1/c7-scan-done.png | Legal agent notification text (apps/api/src/legal*.ts); suspected | Format the date like the Legal page ("Oct 17"). |

## Praise

- C2: the Undo line replaces the row at the same height, restores on click and expires at 30 s.
- C9: the collapsed card ("Approved here. Waiting for Mercury", "Denied", with times) is clear and short at 375 px.
- C7: the scan result line states exact counts.
- C4: a missing recipient is stated plainly ("has no matching recipient in Mercury. The recipient must be added at the bank first.").

## Not verified

C3's still-sorting state (needs a fresh mailbox); C6 with Chief as the requester; C7 reviewed-value protection; C8 on a clean user with a mailbox and model.

## State changes I made on the demo

Mercury "Allow changes" turned on and New Bot given access; New Bot created two routines; one Legal deadline ("Refresh the 409A valuation") dismissed; one scan run; AI consent toggled off then back on; a fresh user (walker-r1-*@northwind.example.test) signed up.
