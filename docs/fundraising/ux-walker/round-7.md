# UX walk, round 7: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (55 views, invented data). Session `ux-walker-fundraising-r7` (agent-browser), 1400 px and 390 px, full-page screenshots, 110 files in `docs/fundraising/ux-walker/round-7/<journey>/<view>-<d|p>-<theme>.png`. Light: monthly-update (19 views), portal (6), audit (2). Dark: cap-table (10), send-safe (6), round (12). Report only; nothing edited, committed or filed.

Method: geometry audit (`geometry-audit.js`) and a tap-target scan (every visible a, button, select, input, textarea under 44 px) plus text extraction for all 110 states. I opened by eye all 12 Send SAFE screenshots and all 38 monthly-update screenshots except the contact-menu pair at phone and the add-contact/unblock desktop shots (add-contact and unblock phone, contact menu desktop were opened). From other journeys I opened portal-email and portal (phone), inv-auditdone (phone), fund-closed (phone), fund-sync (desktop) and inv-nosnap (phone). The rest were checked by measurement and text only. Desktop full-page captures stop at the 900 px viewport because the app scrolls inside its own container, so menus that open low on the page (reminder menu, updates row menu) are visible only in the phone captures.

## Result

Round-6 items not actually fixed: none. W6-1 is confirmed fixed.
New findings: 0 blocker, 0 must-fix, 0 should-fix, 0 nice.

## Round 6 resolution check

| Id | Result | Evidence |
|---|---|---|
| W6-1 (update email portal link 16 px on phone) | Confirmed | `portal-email` shows "View online and past updates" as a bordered button, about 220 x 44 px, on its own row (`portal/portal-email-p-light.png`). The scan lists no `a.pe` under 44 px. |

## Tap targets (390 px, all 55 views)

Nothing under 44 px except the mock view switcher (not product) and 18 x 18 checkbox inputs. Each of those sits inside a label row measured at 44 px high (To list in the editor views, Share dialog, Send SAFE terms, Edit round, Start a round), so the whole row is the target. The 279 "wrapped" hits on `button.ib` ("...") and the hits on Open, Send SAFE, Mark funded, Passed and the source chip are one line in the screenshots; they are the false positives already judged benign in round 6.

## Geometry

No horizontal page overflow in any of the 110 states (scrollWidth equals viewport). Remaining hits are the types judged benign before: `div.tabs`, `div.legend`, `div.cols`, `div.btns.end`, and `span.meta`/`span.rel` spills when the source or Mercury menu is open.

## Numbers and labels (55 views)

- Round bar "Funded $450k, Signed $50k, Pending $150k, Target $1M" is identical in all 15 views that draw it, including `fund-sync`, `fund-closed` and the Send SAFE views. Pending $150k is Ravi $50k plus Dana $100k, before and after the hand-off (Ravi is a prospect in `safe-dialog`, a Draft SAFE in `safe-mercury` and `safe-cover`, never both). Prospects read 7 before the hand-off and 6 after.
- The Mercury row "D. Whitfield, Oct 19, Not counted until linked" has a struck-through $100,000 and stays out of the bar in `fundraising`, `fund-safemenu`, `safe-link`, `fund-sync` and `fund-closed`. The Link dialog shows "D. Whitfield $100,000 . Oct 19".
- Notify counts agree: "Notifies 4 investors" (`ed-nogmail`), "Sent to 4" toast (`inv-sent`), "Posted . 4 notified" toast (`inv-posted`), "3 of 4 sent" (`ed-failed`), and 4 ticked recipients in the editor. Sam Lind and Priya Raman read "Invited Oct 20" after send or post, "Invited Oct 2" before.
- Unknown wording: the editor row says "Unknown - check Sent mail" with Retry and the footer "May already be delivered. Send again?" with Mark delivered, Cancel, Send again. The Updates row says "Tom Okafor unknown" with "Partly sent" and Retry, and its menu offers Mark delivered, Duplicate, Delete. Same outcome, same actions; the lowercase "unknown" in the row is the only wording difference and not worth a change.
- Cap table: 33.0 + 28.0 + 14.0 + 6.0 + 11.0 + 8.0 = 100%; legend 61.0 / 20.0 / 11.0 / 8.0; SAFEs 2.5 + 2.0 + 0.5 = 5.0%; fully diluted 10,000,000; equity raised $1.0M in every view that draws it. Contact tabs read Investors 6, Board 3, Auditors 1.
- Send SAFE views (menu, link, dialog, different terms, hand-off, cover) agree on $50,000, Oct 20, $10M post-money cap, MFN, Delaware. Each has one filled primary button (Send SAFE, Link, Mark sent) and Cancel/primary sit on one row at 390 px.
- Each monthly-update view has one filled primary (Send, Send anyway, Sending (disabled), Done, Post to portal, Send again, Connect Gmail to send).

## Journey notes

- Cap table first read failure still offers Try again and Type it in (`cap-table/inv-nosnap-p-dark.png`).
- Monthly update on phone: Retry and Mark delivered/Cancel/Send again stack without clipping (`ed-unknown-p-light.png`); the sending row, partly sent row with its menu (`inv-partly-p-light.png`) and posted row read correctly.
- Portal on phone: home and email fit 390 px, Download and Sign out are at least 44 px.
- Audit: Show done and Hide done list Done and Dismissed rows without clipping (`audit/inv-auditdone-p-light.png`).
- Round: closed round keeps Pipeline, SAFEs and Send SAFE, as decided in earlier rounds (round-2 N-02, round-4).

## Round 7 verdict

Zero blocker, zero must-fix, zero new should-fix, zero nice. By the stop rule the round is clean.

## Round 7 resolution

No findings were open. The founder decision of 2026-10-21 changed the Send SAFE journey: the mockup now shows "Waiting for Mercury" on the prospect (`safe-mercury`), no Draft or held-out row, and an "Assign to prospect" dialog on an unmatched Mercury SAFE (`safe-assign`, Pending $250k because the unmatched SAFE and the waiting prospect both count). Base views keep Pending $150k; the Committed stage has 2 prospects and the pipeline reads 8 with Mercury connected (7 without).
