# Walk R1: verify iteration-10 clusters C1-C10 (demo stack 5381, 1440x900, no touch emulation)

Caveat: the demo account (mock-founder) is shared with other walkers running at the same time, so some state
(approval cards, consent switch, chat contents) changed under this walk. Items affected are marked.
Screenshots: /tmp/uxloop11/R1/. Not tried: 375 px / touch emulation, email agent panel, mobile tabs, Hide amounts.

## Cluster verdicts

| Cluster | Verdict | Steps (actual/ideal) | Notes |
|---|---|---|---|
| C1 money approval | FAIL | 6/4 | Mercury chat showed two cards for one $1,250 request. One was live, one Approved; later the older was Denied and the agent's final message said "not submitted: the approval was denied" while the other card read Approved (19-mercury-chat.png, 21-mercury-reload.png). Shared account may have caused the Deny; the duplicate live card and mismatched message are still observed. Chief's relay text did not approve anything (Chief said "pending approval"). |
| C2 approval toast | PARTLY | n/a | Met: a "Legal agent needs an answer" toast opens the right chat in one tap and clears (14-toastclick.png); Dismiss is in the a11y tree. Not met: no toast for the live Mercury approval after Chief raised it, and none after reload (20-finance-toast.png). Not tried: email-agent chat, 1 s disabled buttons. |
| C3 consent consistency | PARTLY | 5/3 | Met: Settings has separate Documents line (03-adv.png); with switch on, Inbox and Legal show no consent card; unknown-recipient failure says "Open Settings", not Integrations. Not clean: first view had switch off while Inbox sorted and Legal scanned with no consent prompt; switch turned on later with no click from me (other walker, or auto-grant). |
| C4 first Inbox sort | PARTLY | 3/3 | Northwind: rows appeared about 10-15 s after load (05-inbox-t10.png). Empty space after Allow (13 mails): skeletons only at about +25 s with no Retry notice (30b-allow.png); rows took about 2.5 min. Space switch and back: rows at once, no "First sync" sentence (met). |
| C5 Connect Gmail | PASS | 2 clicks (Connect mail, Done) / 2 | Dialog never showed first question; went to "Gmail connected", Done returned to /app/inbox (28-connect.png, 29-after.png). |
| C6 Legal consent/banner | PARTLY | 3/3 | Met: no red banner with consent; counterparty visible; Term and Renewal wrap fully (07-scan-done.png). Scan now was enabled while the switch read off (code: scanDisabled = running only, Legal.tsx:210). Not tried: no-documents state, 390 px tabs. |
| C7 Legal re-scan | PARTLY | 3/3 | Met: contract values and 13 deadlines unchanged after Scan now; a new Draft contract row appeared. Not met: no "N rows changed" statement and no Undo (07-scan-done.png). |
| C8 toast placement | PARTLY | n/a | Dismiss button exposed. At 1440 the toast covered part of the last chat bubble but not the composer (13-pay6.png). Not tried: 375 touch, menus, drawer, time label updates. |
| C9 Activity panel | FAIL | 2/2 | Activity open showed 4 full chat rows, not 5; the roster ends through the "Page agents" heading (09-activity.png). No Needs-you entries existed to check. |
| C10 SAFE consistency | FAIL | 3/3 | Three different lists: Investors table (Priya $250k, Lee $50k, Sora $25k, Tomas $25k), conversion block and Fundraising (Quill $250k, Harbor Angels $50k). Equity raised is still a dash (23-investors2.png, 25-fund.png). |

## Findings

| id | page/cluster | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C1 | P0 | bug | Observed (shared account): one $1,250 request left two cards, older one live, later Denied; the agent said "denied, not submitted" while the other card read Approved. Expected one live card, older "No longer active", message matching the real outcome. | 19-mercury-chat.png, 21-mercury-reload.png | packages/adapters/src/executor.ts ~3990-4010 | Reuse the pending card on resume, mark older cards unusable, derive the final message from the approved card. |
| R1-02 | C2 | P1 | bug | Observed: Chief-raised Mercury approval gave no toast, and no toast after reload with a live card. | 16-pay8.png, 20-finance-toast.png | apps/web/src/lib/approval-toasts.ts:70 | Rebuild toasts from unanswered approvals on load; pass the holding bot and thread in notifyRun. |
| R1-03 | C7 | P2 | flow | Observed: Scan now changed rows (added a Draft contract) with no count or Undo. | 07-scan-done.png | apps/web/src/pages/Legal.tsx scan() ~178 | Show "N rows changed" with Undo after a scan. |
| R1-04 | C6 | P2 | flow | Suspected: Scan now is disabled only while running, not when consent is missing. | code Legal.tsx:210 | apps/web/src/pages/Legal.tsx:210 | Disable Scan now when needsConsent and show Allow in the banner. |
| R1-05 | C4 | P1 | bug | Observed once: after Allow on a 13-mail mailbox, skeleton rows with no Retry notice at +25 s; rows after about 2.5 min. | 30b-allow.png | apps/web/src/pages/Inbox.tsx ~475-486, 664 | Show unsorted rows after 15 s as decided; confirm the 15 s timer starts at Allow. |
| R1-06 | C9 | P2 | visual | Observed: Activity open leaves 4 chat rows and the roster cuts through the "Page agents" heading. | 09-activity.png | apps/web/src/components/ (sidebar roster scroller) | Snap the roster scroller to row boundaries and cap Activity height. |
| R1-07 | C10 | P2 | bug | Observed: SAFE holders and totals differ across Investors ($350k, 4 holders), conversion block and Fundraising ($300k, 2 holders); Equity raised is a dash. | 23-investors2.png, 25-fund.png | Investors and Fundraising SAFE queries | Use one SAFE source and show its total in Equity raised. |
| R1-08 | C3 | P2 | flow | Observed: switch read off while Inbox sorted and Legal scanned with no consent prompt; the Settings state may have been changed by another walker. | 02-privacy.png, 04-inbox-off.png | apps/web/src/components/AiDataSharing.tsx | Recheck on a clean user; make Inbox/Legal gates read the same list as the switch. |
| R1-09 | Investors | P1 | perf | Observed once: client-side navigation to Investors stayed on skeleton rows for over 18 s; a hard reload loaded in under 8 s. | 22b-investors.png | apps/web Investors page loading | Find why the first load did not settle. Not reproduced. |
| R1-10 | C3/C1 | P3 | copy | Mercury "no recipient" reply ends with "Open Settings", which cannot add a recipient. | 16-pay8.png | packages/adapters/src/executor.ts ~8358 | Drop the link or point to Contacts. |

Praise: Legal table at 1440 now shows counterparty and full Term and Renewal text; Connect mail to Inbox works in two clicks; toast for an ask opens the right chat.
