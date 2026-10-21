# STORY-064 flow critique (round 3): a full triage session on the inner display

Previous round: round 2 verdict acceptable (open message, reply composer, Archive result, Inbox zero and Cleanup had no inner-display board).

Target: planned native SwiftUI iPhone app (epic #427, phases #418 and #419). Persona: Kenji Watanabe, iPhone Duo opened as a book. Re-traced on the current boards: `Inner-Message.dc.html` (now six frames: Message selected, Reply inner flat, Reply half-folded, After Archive, Inbox zero, Cleanup), `Inner.dc.html`, `Split.dc.html` (frames Inbox, Inbox More menu, Finance, Ask Finance agent opened), `PG-A-InboxMessage.dc.html`, `PG-A-Compose.dc.html`, `PG-A-Cleanup.dc.html`, `PH-Inbox.dc.html`, `PG-A-Home.dc.html`. All screenshots opened. Boards are static.

Round 2 issues now resolved on the boards: R2-1 (Reply inner flat and half-folded frames), R2-2 (After Archive with "Archived, Undo", next row selected, Inbox zero), R2-3 (Cleanup in the inner detail pane, More menu with Cleanup in `Split.dc.html`), R2-4 (Junk chip is neutral), R2-5 (the boards show PAGES, not folders).

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as written | 24 |
| Ideal on current boards | 19 |
| Extra steps | 5, all chosen by the story: 14-16 (Filter and hide read mail move nothing toward empty), 18 (agent opened on the payroll mail, then abandoned), 23 (refresh with nothing new). |
| Needless decisions | Step 18 vs 19: agent or blank Compose for a reply. Reply is prefilled and drawn (`Inner-Message.png`, Reply inner flat). |
| Re-entry of known data | Steps 19-20 retype recipient and subject. Reply already holds both. |
| Dead ends | None on the boards. Last-row archive ends at Inbox zero (`Inner-Message.png`). Cleanup on the inner display has no way back except tapping a list row (low, R3-4). |
| Steps with no board | 14 Filter popover (button drawn, popover not), 19 Compose while a message is open (strip has no Compose in that state), 22 swipe-to-archive on the inner display (phone only in `PH-Inbox.png`; Cleanup covers the same goal), 6 result after Send (pane state after "sent"). |
| Steps with a board | 1-4 (`Split.png`, `Inner-Message.png`), 5-6 (Reply frames), 7 and 13 (After Archive), 8-12 (`Inner.png`), 16 and 22 (More menu, Cleanup frame), 17, 24 (Inbox zero). |

Taps are one per row plus one per action, the minimum for list and detail.

## 2. Take-away pass per screen

- Message selected (`Inner-Message.png`): strip is Archive and Reply, More, agent circle. Nothing to remove. Missing the "Draft ready / Review draft" banner that the same message has on the outer display (R3-1).
- Reply inner flat and half-folded: close, To, Subject, body, one prominent send arrow. Nothing to remove; From and Cc/Bcc are hidden. Pass.
- After Archive: next message open, snackbar "Archived, Undo". The Needs reply count and the selected row each appear once. Pass.
- Inbox zero: check, title, "Synced 9:41 AM" once. Filter and Compose return in the strip. Pass.
- Cleanup (inner): the floating "Cleanup" pill above "Archive 101 emails" repeats the page title and the More menu item that opened it (R3-3). Remove.
- Split Inbox: one search field, no repeated facts. "Other mail today 24" in `Inner.png` vs "Today" in `Inner-Message.png` and `Split.png` names the same section two ways (R3-5).
- Prominent action count: agent circle (Message selected, Inbox zero, After Archive), send arrow (Reply), "Archive 101 emails" (Cleanup), Send (`Inner.png`). Exactly one each.

## 3. Simpler version

1. Open Inbox; first Needs reply message is open with its "Review draft" banner when a draft exists.
2. Review draft, Send (or Reply, type, Send). Next row opens.
3. Jordan Lee: agent circle, one line, Send on the card.
4. Northwind Support: Archive; Undo snackbar; next row opens.
5. Acme Payroll: Reply, type, Send.
6. More, Cleanup, Archive 101 emails.
7. Inbox zero.

About 19 steps, no blank Compose, no Filter detour.

## 4. Beauty check against the iOS rules

- Glass only on floating controls: rows, message body, reply form, Cleanup list are solid. Pass.
- At most three glass groups: Message selected has strip group, More, agent circle (three). After Archive adds the snackbar capsule as a fourth floating glass element (R3-2).
- Exactly one prominent action: pass in every frame.
- Concentric corners: Reply half-folded card and its send arrow nest correctly; judged visually.
- Bot avatars and accent: Inbox agent blue pill, Finance orange wedge, shipped shapes. "Needs approval" and "1 needs you" use the status yellow only. Pass.
- Fold zone x 435 to 455 empty in all inner frames. Pass.

## 5. Verdict: acceptable

The journey is drawn end to end on the inner display. What remains are missing small states and one inconsistency, not design drift. Not minimal because the story's own 5 extra steps and the missing draft banner keep the fastest path (Review draft, Send) off the inner display.

## ISSUES

- STORY-064-R3-1 (medium): Opening Ana Ruiz's message (row chip "Draft ready") shows no draft on the inner display. Steps 3-6. `Inner-Message.dc.html` "Message selected" (outer `PG-A-InboxMessage.dc.html` "Message" draws "Draft ready, Reply to Ana Ruiz, Review draft"). Fix: add the same banner above the body in the inner detail pane, "Review draft" as the only light pill; the agent circle stays dark in that frame so there is still one prominent action.
- STORY-064-R3-2 (low): After Archive adds a fourth floating glass element (snackbar capsule) beside the strip group, More and the agent circle. Step 7. `Inner-Message.dc.html` "After Archive". Fix: draw the "Archived, Undo" bar as a solid card at the bottom of the detail pane, or keep glass and drop the strip group while it shows.
- STORY-064-R3-3 (low): A "Cleanup" pill floats above "Archive 101 emails" in the inner Cleanup frame; it duplicates the title and the menu item. Step 22. `Inner-Message.dc.html` "Cleanup". Fix: remove the pill.
- STORY-064-R3-4 (low): Inner Cleanup has no back, History or Unsubscribe; the outer display has all three. Step 22. `Inner-Message.dc.html` "Cleanup" vs `PG-A-Cleanup.dc.html`. Fix: add a close control in the pane's top left (like Reply's X), Unsubscribe beside "Archive 101 emails" once a newsletter sender is ticked, and History in More.
- STORY-064-R3-5 (low): The Inbox list names its second section "Other mail today 24" in `Inner.dc.html` and "Today" in `Inner-Message.dc.html`, `Split.dc.html`, `PH-Inbox.dc.html`. Fix: use "Today" everywhere (the count is not acted on); also `Inner.dc.html` marks Needs reply rows with unread dots but no "Draft ready" chip, unlike the other boards.
- STORY-064-R3-6 (low): No inner board for the Filter popover (step 14) or for Compose while a message is open; the message-selected strip has no Compose or Filter (step 19). `Inner-Message.dc.html`, `Split.dc.html`. Fix: draw the Filter popover under the button on `Split.dc.html`; for new mail while reading, put Compose in More on the message-selected strip.
- STORY-064-R3-7 (low, story text): Steps 14-16, 18-21 in the catalog still route the payroll reply through the agent and blank Compose. Fix: replace with "Tap Reply; recipient and subject are prefilled; type; Send", keep Compose for new mail.
