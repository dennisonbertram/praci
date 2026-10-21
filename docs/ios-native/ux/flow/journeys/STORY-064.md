# STORY-064 flow critique (round 2): a full triage session on the inner display

Previous round: round 1 verdict acceptable (24 steps as designed, 19 ideal; open message, Archive, Reply, Compose, Cleanup and Inbox zero had no inner-display board).

Target: planned native SwiftUI iPhone app (epic #427, phases #418 and #419). Persona: Kenji Watanabe, iPhone Duo opened as a book (inner flat 890x626, list in the left third, detail on the right, side strip on the right edge). Re-traced on the current boards: `Inner.dc.html`, `Split.dc.html`, `Inner-Message.dc.html` (new since round 1), `PG-A-InboxMessage.dc.html`, `PG-A-Compose.dc.html`, `PG-A-Cleanup.dc.html`, `PH-Inbox.dc.html`, `PG-A-Home.dc.html` (screenshots `Inner.png`, `Split.png`, `Inner-Message.png`, `PG-A-InboxMessage.png`, `PG-A-Compose.png`, `PG-A-Cleanup.png`, `PH-Inbox.png`, `PG-A-Home.png`; all opened). The boards are static; nothing was clicked.

Changes since round 1 that affect this story:
- `Inner-Message.png` now draws the open message beside the list on the inner display, with an Archive and Reply group in the strip, More, and the one prominent Ask Inbox agent circle. Steps 4, 5 (the tap), 7 and 13 (the tap) now have an inner board.
- `Inner.png` now shows context chips under the agent draft ("Re: Pilot timeline", "Ana Ruiz"), so the agent thread says which message it is about (round 1 issue 8 resolved).
- `Split.png` has one search field only and the strip is Filter and Compose plus More and the agent circle; the "Hide amounts" eye is gone (round 1 issues 3 and 4 resolved).
- `PH-Inbox.png` and `PG-A-InboxMessage.png` draw Inbox zero (phone), "Archived, Undo" and "Archive failed" states, and `PG-A-InboxMessage.png` draws "After Archive: next message opens" (outer).

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as written | 24 |
| Ideal on current boards | 19 |
| Extra steps | 5, all chosen by the story: 14, 15, 16 (Filter, hide read mail, Important only; none moves the list toward empty), 18 (open the agent on the payroll mail, then abandon it), 23 (pull to refresh with nothing new). The design forces none of them. |
| Needless decisions | Step 18 vs 19: agent or Compose for the same payroll reply. The Reply board prefills recipient and subject (`PG-A-Compose.png`, "Reply"), so blank Compose is not needed. |
| Re-entry of known data | Steps 19-20 retype the recipient and subject of a mail the user is reading. Use Reply (the strip's Reply in `Inner-Message.png`), not Compose. |
| Dead ends | Last row archived on the inner display: the detail pane has no drawn state (steps 13, 24). Inbox zero exists only on the phone (`PH-Inbox.png`). |
| Steps with no board | 5-6 (reply composer in the inner detail pane or under the message when half-folded; `PG-A-Compose.png` is outer only), 7 and 13 result (Archived with Undo, next row selected, on the inner display; outer has it in `PG-A-InboxMessage.png`), 22 (Cleanup or swipe on the inner display; More is in the strip but its menu is drawn only on the outer display in `PG-A-Cleanup.png`), 24 (Inbox zero on the inner display), 2 ("folders" are not drawn anywhere; the pages list in `Split.png` has only an Inbox row). |
| Steps with a board | 1 (`PG-A-Home.png` Inbox row "3 need reply", outer display; the inner Home is not re-checked here), 3, 4, 8, 12, 17 (`Inner-Message.png`, `Split.png`), 9-11 (`Inner.png`: Edit secondary, Send the one prominent, context chips), 14 (Filter button in `Split.png`; popover not drawn), 5 tap and 7 tap (`Inner-Message.png`), 22 phone swipe (`PH-Inbox.png`). |

Taps are one per row plus one per action, the minimum for list-and-detail. The inner display itself adds none.

## 2. Take-away pass per screen

**Inbox with sidebar (`Split.png`).**
- One search field, no longer two. Pass.
- Strip is Filter and Compose, then More and the agent circle. Nothing to remove.
- Row chips "Newsletter" and "Junk" label rows the user is about to clear. "Junk" is yellow, a second accent in a monochrome app; `PH-Inbox.png` draws the same chip neutral. Keep "Needs attention" only, or make Junk neutral.
- "Other mail today 24" is a count nobody acts on; minor.
- One prominent action: the Ask Inbox agent circle. Right.

**Open message beside the list (`Inner-Message.png`).**
- Strip: Archive, Reply, More, Ask Inbox agent. Exactly one prominent action. Nothing to remove.
- Message header, body and two attachment rows carry no repeated facts.
- Missing here: what happens after Archive (see issues).

**Inbox beside agent thread (`Inner.png`).**
- Send is the one prominent action, Edit secondary. The "Needs approval" badge and the user bubble do not repeat each other (the bubble is the user's instruction).
- Context chips name the message. Pass.
- The strip shows agent-page controls (Page, List), fine for a thread.

**Reply and Compose (`PG-A-Compose.png`, outer).**
- Reply prefilled, title menu (Reply, Reply all, Forward), one prominent send arrow. "From" shows one address that never changes with one account; could hide until a second account exists. Minor.

**Cleanup (`PG-A-Cleanup.png`, outer).** One prominent "Archive 101 emails", Undo on Done and in History. Fastest route for step 22; not drawn on the inner display.

## 3. Simpler version

1. Home: tap Inbox; the first Needs reply row is already open.
2. Reply (prefilled), type, Send; the next row opens.
3. Jordan Lee: Ask Inbox agent, one line, Send on the card.
4. Northwind Support: Archive; "Archived, Undo" shows; the next row opens.
5. Acme Payroll: Reply, type, Send.
6. Newsletters: More, Cleanup, tick, Archive (or swipe).
7. Inbox zero in the detail pane.

About 19 steps (drops 14-16, 18, 23). Nothing is sent or archived without a tap, and Archive has Undo.

## 4. Beauty check against the iOS rules

- Glass only on floating controls: rows, bubbles, message body and approval card are solid in `Inner.png`, `Inner-Message.png`, `Split.png`; glass is the strip, title pill, composer, sidebar panel. Pass.
- At most three glass groups: `Inner-Message.png` has the strip group, More circle and agent circle; `Inner.png` has the agent pill, strip, composer plus More. At the limit, none over. Pass.
- Exactly one prominent action: Ask Inbox agent circle (`Inner-Message.png`, `Split.png`), Send (`Inner.png`), send arrow (`PG-A-Compose.png`), "Archive 101 emails" (`PG-A-Cleanup.png`). Pass.
- Concentric corners: approval card and its buttons nest correctly in `Inner.png`; judged visually, not measured.
- Bot avatars: Chief teal hexagon, Finance orange wedge, Legal purple teardrop, Carta letter tile in `Split.png`; Inbox agent uses the blue pill mark on `Inner.png` and `PG-A-Home.png`. Consistent.
- Fold zone x 435 to 455 empty in `Inner.png` and `Inner-Message.png`. Pass.
- Single accent color: fails on `Split.png` (yellow "Junk"; the yellow "Needs approval" badge in `Inner.png` is a status color and acceptable).

## 5. Verdict: acceptable

Not convoluted: the five extra steps are the story's own choices. Closer to minimal than round 1 because the open message, Archive and Reply are drawn on the inner display. Not minimal: the reply composer, the outcome of Archive (Undo, next row, Inbox zero) and Cleanup are still drawn only for the outer display or the phone.

## ISSUES

- STORY-064-R2-1 (high): Reply composer on the inner display has no board. Steps 5-6. `Inner-Message.dc.html` (Reply button drawn), `PG-A-Compose.dc.html` (outer only). Fix: add a frame "Reply, inner flat" where the detail pane (x 455 to 890) becomes the Reply form (To, Subject prefilled, body focused, one prominent send arrow, Close at top left), list stays in the left third; and a half-folded frame with the composer under the message. Keep it out of x 435 to 455.
- STORY-064-R2-2 (medium): Result of Archive and Inbox zero are not drawn on the inner display. Steps 7, 13, 24. `Inner-Message.dc.html`; drawn only in `PG-A-InboxMessage.dc.html` (outer, "After Archive: next message opens", "Archived, Undo") and `PH-Inbox.dc.html` (Inbox zero). Fix: add frames "After Archive" (next row selected, detail shows it, a bottom snackbar "Archived" with Undo in the detail pane) and "Inbox zero" (detail pane centered check, "Inbox zero", "Synced [TIME]"; list pane empty).
- STORY-064-R2-3 (medium): Cleanup is not shown on the inner display. Step 22. `Inner-Message.dc.html` and `Split.dc.html` strips have More, but its menu is drawn only in `PG-A-Cleanup.dc.html` (outer). Fix: draw the More popover with "Cleanup" in the inner strip and the Cleanup list in the detail pane with "Archive 101 emails" as the prominent action; keep swipe Archive as the single-row path.
- STORY-064-R2-4 (low): Yellow "Junk" chip and "Newsletter" chip on rows the user clears. Step 22. `Split.dc.html` (`PH-Inbox.dc.html` already draws it neutral). Fix: draw "Junk" neutral like "Newsletter", or show only "Needs attention".
- STORY-064-R2-5 (low): The story says folders appear in the left third; no board draws folders. Step 2. `Split.dc.html`, `Inner-Message.dc.html`. Fix: remove "folders" from step 2 and the Inbox rule text (Inbox is one page with Needs reply and Other mail sections), or draw the folder list.
- STORY-064-R2-6 (low): Story steps 18-21 still route the payroll mail through the agent and blank Compose. Steps 18-21 (story text). Fix: replace with "Tap Reply in the strip; recipient and subject are prefilled; type; Send"; keep Compose for new mail only.
