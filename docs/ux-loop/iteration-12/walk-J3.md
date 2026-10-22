# Walk J3: phone width (375 x 812, touch emulation on)

Target: mock-data demo stack only (web :5381). Touch emulation was turned on through CDP (`pointer: coarse` and `hover: none` both true), so the touch-target numbers below are valid. Screenshots are in `/tmp/uxloop12/J3/` (outside the repo). No password was printed or stored.

## Story verdicts

| Story / journey | Verdict | Steps actual / ideal |
|---|---|---|
| Sign-in (landing, form, submit) | PASS | 4 / 3; all targets 44 px or more, no overflow |
| Sidebar drawer (open, pages, account menu) | PASS (one P3) | 2 / 2 |
| Inbox triage (list, More, Archive, Undo toast, open mail) | PASS (P2 list shift, P2 To-do checkbox) | 4 / 4 |
| Finance overview and subscription detail | FAIL (P1: vendor header overlap) | 2 / 2 |
| Data room browse and preview | PASS (P2 toolbar height, P2 checkbox look) | 2 / 2 |
| Agent chat with approval (per-email agent, Draft a reply, Send) | FAIL (P1: Send fails, no recovery) | 4 / 4 |
| Settings (General, Privacy and approvals) | PASS | 3 / 3 |
| Models and Memory tabs, first-run tour at phone width | SKIPPED (time) | |

Console: no page errors on any screen. Geometry audit: `pageOverflowX` was 0 on every screen.

Praise (observed): the sign-in screen is clean with 44-52 px controls; Inbox row "..." buttons, Send/Discard/Edit on the Mail card and the message dialog buttons are all 44 px high; the Mail approval card is clear on a phone; the PDF preview is a tidy sheet; the Undo toast sits clear of the list; Settings uses a native select and its switches have a 44 px hit area.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Inbox agent (per-email), Mail card | P1 | bug | OBSERVED: tapping Send on the drafted reply to Jamie ended with header "Not sent" and the red line "Message not found". The agent then said "I couldn't prepare the reply because the original message wasn't found", which is wrong (the draft existed; the send failed). No "Open in composer" button appeared, so Maya has no way forward. Cause on the demo (mock Gmail missing the message) is UNVERIFIED. | `/tmp/uxloop12/J3/22-failed.png`, `21-sent2.png` | `apps/web/src/components/MailApprovalCard.tsx:477` (button needs `onOpenComposer` and `mail.connectionId`; one is missing in the email agent panel) | Always show "Open in composer" after a failed send, falling back to the thread's account when `connectionId` is missing. |
| J3-02 | Finance vendor detail (Globex Cloud) | P1 | visual | OBSERVED: the "Northwind Robotics" space label runs under the Ask button and the two overlap (geometry audit: 62 px spill). Expected: the label truncates before the button. | `/tmp/uxloop12/J3/13-sub-detail.png` | `apps/web/src/components/finance/ui.tsx:385-409` (CompanyMenu `min-w-[min(100%,9rem)]` in the heading row that also holds `end`) | In the back-header row, let the company name take `min-w-0 flex-1` and truncate, as the non-back header does. |
| J3-03 | Inbox list | P2 | flow | OBSERVED: about 20 s after load the Needs reply section grew from 6 to 9 rows and the Other mail section vanished, so rows moved under the finger; the unread count also changed (5, 6, 5). Late classification is SUSPECTED. | `/tmp/uxloop12/J3/06-inbox.png` vs `07-inbox-more.png` | Inbox list sort/refetch (not traced) | Keep rows in place until the next pull or tap and show new sorting after that. |
| J3-04 | Inbox To do card | P2 | a11y | OBSERVED (measured with touch): the to-do checkbox is 20 x 20 px; the neighbouring title button opens the item, so a mis-tap opens it. Expected 44 px. | geometry eval; `/tmp/uxloop12/J3/25-settings.png` shows the card | To-do card in the Inbox page (not traced) | Wrap the checkbox in a 44 px target as the Data room rows do (`ItemRows.tsx:331-345`). |
| J3-05 | Data room list | P2 | visual | OBSERVED: on touch the always-visible row checkbox is drawn over the file-type icon with a translucent background, so it looks like a bordered icon, not a checkbox. | `/tmp/uxloop12/J3/14-dataroom.png`; checkbox 18 px at (29,335), marker 14 px at (31,337), bg alpha 0.3 | `apps/web/src/components/data-room/ItemRows.tsx:331-345` | Use an opaque background and a clear empty box (or hide the icon) while the checkbox shows on touch. |
| J3-06 | Data room header | P2 | visual | OBSERVED: the toolbar takes three stacked rows (search + Filters, folder + two icon buttons, view toggle), about 195 px of 812, before the first file. | `/tmp/uxloop12/J3/14-dataroom.png`; audit flagged `div.order-2 "View Add files Ask"` | `apps/web/src/pages/DataRoom.tsx` toolbar | Move the list/grid/chart view toggle into the Filters sheet on phone widths. |
| J3-07 | Drawer | P3 | flow | OBSERVED: opening the drawer puts focus in the Search box (focus ring visible, `activeElement` is the Search input). On a real phone this can raise the keyboard. SUSPECTED. | `/tmp/uxloop12/J3/05-drawer.png` | initial focus of the mobile sidebar dialog in `apps/web/src/pages/Shell.tsx` (not traced) | Set initial focus to the close button on touch devices. |
| J3-08 | Inbox rows | P3 | a11y | OBSERVED: every row "..." button is named just "More", so a screen reader lists many identical buttons. | snapshot output | `apps/web/src/components/inbox/InboxRow.tsx:249-259` | Name it "More actions for {sender}". |
| J3-09 | Finance header | P3 | copy | OBSERVED: the sync status truncates to "Mercury, Brex . synced ju..." on phone. | `/tmp/uxloop12/J3/11-finance.png` | Finance header status text (`finance/ui.tsx`) | Drop "Mercury, Brex" on phone so "synced just now" fits. |
| J3-10 | Data room list | P3 | copy | OBSERVED: "MOCK Board Minutes" shows "-- . Added Oct 22, 2026" with a bare dash for the missing type. | `/tmp/uxloop12/J3/14-dataroom.png` | `ItemRows.tsx` meta line | Omit the type and separator when the type is empty. |

Not reported: other walkers' activity in shared threads (a Mercury approval toast, a changed Chief preview, a `b.txt` import banner, a "New Bot" row). Settings did not appear within 3 s on two early attempts but opened in under 1 s on a clean retry; not reproduced, so not logged. A helper node process holding touch emulation (`/tmp/uxloop12/J3/touch.mjs`) may still be running; I could not kill it by pattern.
