# Walk R1 (iteration 20): verify pass-19 clusters C1-C10

Target: mock demo stack (web :5381). 1440x900 unless noted. Screenshots under /tmp/uxloop20/R1/. Shared stack: other walkers used the same Mercury thread and Legal page. The stack went down once mid-walk and came back reseeded; I re-logged in and redid the Legal scans.

## Verdicts

| Cluster | Verdict | Steps actual/ideal |
|---|---|---|
| C1 money approval wording | PARTLY | 6/4 |
| C2 Legal scan | PARTLY | 5/4 |
| C3 Legal unchecked line and rows | PARTLY | 3/3 |
| C4 Data room preview | PASS | 6/6 |
| C5 Finance phone header | PARTLY | 2/2 |
| C6 toast vs chat bar and Activity wording | PARTLY | 5/4 |
| C7 phone drawer Bot settings | PASS (tour card not testable) | 4/3 |
| C8 GTM first view | PASS (brief empty card flash) | 2/2 |
| C9 bot notifications off | PASS | 3/3 |
| C10 sidebar short screens | PARTLY | 4/3 |

## Acceptance criteria detail

C1
- After Approve neither chat says "waiting for your approval": MET in the Mercury chat ("Mercury returned pendingApproval ... finish approving it in the Mercury app"), NOT MET in the requesting bot. Chief, after I approved in the Mercury chat, replied at 4:11 PM "The $75 payment ... is waiting for your approval in the Mercury agent chat." (c1-chief-after.png)
- After Deny the reply says "you denied": PARTLY. The second card's Deny produced "You denied the $450 payment to Acme, so it was not submitted." But the first Deny produced no text; a second identical $450 card appeared at once with no new request from me (c1-denied.png). Decision pass 14 says a new card only on a new owner request.
- Open bar disappears once answered: MET (Open Mercury agent bar shown while pending, gone after Approve; c1-chief.png, c1-chief-after.png).
- Writes off points to Allow changes: NOT MET on the demo. With writes off the agent said "I couldn't submit the $20 payment because I can't reach the Mercury payment agent from this chat ... ask the Mercury agent directly" (c1-writesoff.png), in the Mercury agent's own chat. The prompt text (apps/api/src/integration-agent.ts:27) is right, so this is likely the scripted model ignoring it (suspected). Writes switch restored to on afterwards.

C2
- Scan twice on unchanged docs keeps 9 deadlines and values: MET (3 scans: "Scan finished: nothing changed." and "1 contract and 0 deadlines added or updated"; deadlines stayed 9; the new contract is the unchecked "MOCK Term Sheet Draft - Quill Capital").
- "Scan changed N items" with Undo: not triggerable (nothing changed); per pass-19 decision scans no longer dismiss, so N/A.
- Show done lists dismissed rows with Restore: NOT MET. I dismissed "Q3 board consent signature"; Dismiss shows an inline "Dismissed ... Undo" line, but Show done says "No deadlines marked done" and the row is unreachable once the line is gone (c2-showdone.png).
- Scan never dismisses: MET in observation (no dismissals).

C3
- Unchecked line is a button: MET ("1 Data room document not yet checked by Legal" + "Check now", c3-unchecked.png).
- During scan one progress statement: MET ("Reading 0 of 1", then "Saving results...").
- Contract rows single-line about 36-40 px: NOT MET. Rows are 57 px (8 of 10) at 1440; Term no longer wraps, but Contract name, Renewal ("Auto-renews, 30 days notice") and Parties wrap (c3-legal.png).

C4
- Open and Download once: MET (one icon pair in the pane header; the other pair is 0x0 hidden).
- ArrowDown + Enter keeps preview, Escape closes: MET.
- Unreadable PDF offers Replace file and Delete, no Try again: MET (c4-failed-preview.png).
- Type cell "Not read": MET.
- Phone preview not walked.

C5 (375x812)
- Header at most 72 px and not sticky: NOT MET on height. Not sticky (MET), but the title plus status block is about 108 px tall (cards start at y=124).
- No ellipsis in status row: NOT MET. "Northwind Robotics" and "synced just now" are both cut with an ellipsis, and the non-USD note wraps to 3 lines and still starts with a stray bullet (c5-finance375.png).
- "Spent so far this month": MET.

C6
- With the routine panel open, Jump to latest and Open agent bar clickable while a toast shows: MET (toast 666-720, Jump 734-766, bar 772-804 px; no overlap).
- Bar width matches composer: MET (344-1028 both).
- Activity says "Needs approval": NOT MET. Activity shows "Needs your answer" for the pending "Review before sending email" approval, while the toast says "needs approval".

C7 (375 wide)
- Bot settings shows the panel with the drawer closed: MET (c7-botsettings.png).
- Tour card inside the drawer width: not verified (the tour card did not show at phone width on this account).

C8
- Only goal card and Connect Zernio: MET after load; during the first second an empty "Written by GTM agent" card shows (c8-gtm.png) and then disappears.
- "Up to date" once: MET. Email destinations wrapping: not testable (no goal).

C9
- Bot settings Notifications shows "Off in Settings" with browser notifications off: MET (underlined link; the switch itself still looks on).

C10
- 1280x800, Activity closed: 4 chat rows plus "+5 more": MET.
- 720 high: "+6 more" present: MET.
- Activity open at 1440x900: 3 chat rows visible: MET (Chief, Investor Relations, Leadership sync), but see finding R1-20-03.
- No row half-hidden by the fade at rest: NOT MET. At 1280x720 the Finance helper row is cut under the fade (c10-720.png); at 1440x900 the "RECONNECT NEEDED" row is cut above "+2 more" (c8-gtm.png).

## Findings

| id | page or cluster | sev | cat | what happened vs expected | evidence | suspected location | fix |
|---|---|---|---|---|---|---|---|
| R1-20-01 | C1 | P1 | bug | Observed: Chief says the delegated $75 payment "is waiting for your approval in the Mercury agent chat" after I approved it in the Mercury chat (which reported pendingApproval). Expected no approval-pending claim after Approve. Scripted demo model may contribute. | c1-chief-after.png | delegation result text sent back to the requesting bot (apps/api integration agent message path; Shell.tsx delegated chat) | Have the delegate's final result (the bank's reply) replace the "waiting for approval" text the requester received, or give it as the requester's tool result. |
| R1-20-02 | C1 | P1 | bug | Observed once: after the first Deny on a $450 request a second identical card appeared immediately with no text; only the second Deny ended with "You denied...". Expected a plain "you denied" and no new card without a new request (pass-14 decision). Suspected scripted model retrying the tool. | c1-denied.png, c1-denied2.png | integration-agent tool-result text after deny (apps/api/src/integration-agent.ts) | Return "The user denied this payment; do not call it again unless asked" as the deny result. |
| R1-20-03 | C10 | P2 | visual | Observed: rows are half-hidden by the sidebar fade at rest (Finance helper at 1280x720; "RECONNECT NEEDED" at 1440x900). With Activity open the list starts scrolled so the Activity header and a Working row are cut at the top. | c10-720.png, c8-gtm.png, c10-activity4.png | sidebar list fade/scroll container (apps/web/src/components/Sidebar*) | Snap the visible list to whole rows (or end the list above the "+N more" row) and start Activity open at scrollTop 0. |
| R1-20-04 | C6 | P2 | copy | Observed: Activity labels a pending approval "Needs your answer"; toast says "needs approval". Expected "Needs approval". | Activity panel text | activity row label in sidebar Activity | Use "Needs approval" when the item is an approval. |
| R1-20-05 | C3 | P2 | visual | Observed: contract rows 57 px (8 of 10) at 1440 wide, not 36-40; Renewal and Contract name wrap. | c3-legal.png; row heights 57,57,...,48,48 | apps/web/src/pages/LegalContracts.tsx:162-169 | Make Renewal short ("Auto-renews, 30 d") or nowrap and widen Contract; give Parties a truncating cell. |
| R1-20-06 | C5 | P2 | visual | Observed at 375 px: status header is about 108 px; company name and "synced just now" end in ellipses; non-USD note wraps to 3 lines with a leading bullet. Expected at most 72 px and no ellipsis. | c5-finance375.png | apps/web/src/pages/Finance.tsx:396-470 | Put the sync time on one line under the title, move the non-USD note into the sync popover, drop the leading bullet. |
| R1-20-07 | C2 | P2 | flow | Observed: a founder-dismissed deadline is not listed under Show done ("No deadlines marked done"); only an inline Undo line right after the click. Expected Dismissed rows with Restore. Given the pass-19 decision (scans never dismiss) this only affects manual Dismiss. | c2-dismissed.png, c2-showdone.png | apps/web/src/pages/Legal.tsx deadlines Show done filter | Include dismissed rows under Show done with a Restore action. |
| R1-20-08 | C1 | P2 | copy | Observed: with writes off the Mercury agent said it "can't reach the Mercury payment agent from this chat" and to ask the Mercury agent, in the Mercury agent's own chat; no mention of Allow changes. The prompt (integration-agent.ts:27) is correct, so the scripted model is the probable cause. Unverified with a real model. | c1-writesoff.png | apps/api/src/integration-agent.ts:27 and the writes-off tool reply | Return the Allow changes page link in the writes-off tool reply so any model can quote it. |
| R1-20-09 | C8 | P3 | visual | Observed: an empty "Written by GTM agent" card shows for about a second on first load, then disappears. | c8-gtm.png | GTM page sections before data loads | Render the section only after the data has loaded and has rows. |
| R1-20-10 | Integrations | P3 | perf | Observed: after a direct URL load of /app/integrations the app showed "Still opening... Try again" for about 20 s (stack was under load from other walkers). Unconfirmed on an idle stack. | int.png | app shell boot | Re-measure on an idle stack. |
| R1-20-11 | C9 | P3 | visual | Observed: with "Off in Settings" the Notifications switch still renders on, which reads as active. | c7-botsettings.png | bot settings Notifications row | Show the switch disabled or off while browser notifications are off. |

## Praise
- Legal scan is now stable (nothing changed on repeat scans), shows a plain result line, and the unchecked line has "Check now".
- Data room preview is clean: one Open/Download pair, Enter keeps it, Escape closes, a failed file offers Replace file and Delete with "Not read" in the Type cell.
- Approval toast, Jump to latest and Open agent bar no longer collide with the routine panel open; the bar matches the composer width.
- Mercury chat reports the bank's actual result (pendingApproval) with where to finish it.
- Phone Bot settings opens straight into the panel with the drawer closed.
