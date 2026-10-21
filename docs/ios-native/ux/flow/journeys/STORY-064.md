# STORY-064 flow critique (round 1): a full triage session on the inner display

Previous round: acceptable (24 steps as designed, 24 ideal; reply composer, compose, Archive control and Inbox zero had no board).

Target: planned native SwiftUI iPhone app (epic #427, phases #418 and #419). Persona: Kenji Watanabe, working on an iPhone Duo opened as a book (inner flat 890x626, list in the left third, detail on the right, side strip on the right edge). Re-traced on the current boards: `Inner.dc.html`, `Split.dc.html`, `PG-A-InboxMessage.dc.html`, `PG-A-Compose.dc.html`, `PG-A-Cleanup.dc.html`, `PH-Inbox.dc.html`, `PG-A-Home.dc.html`, `PG-A-Rules.dc.html` (screenshots `Inner.png`, `Split.png`, `PG-A-InboxMessage.png`, `PG-A-Compose.png`, `PG-A-Cleanup.png`, `PH-Inbox.png`, `PG-A-Home.png`, `Main.png`; all opened). The boards are static; nothing was clicked.

What the gap-fix pass changed for this story: the reply and compose surface now exists (`PG-A-Compose.png`, outer display, with a Reply / Reply all / Forward title menu), the message screen with Archive and Reply exists (`PG-A-InboxMessage.png`, outer display), Cleanup exists (`PG-A-Cleanup.png`), and the phone Inbox draws a swipe Archive (`PH-Inbox.png`). Still undrawn on the inner display: the open message with its controls, the Compose and Reply surface, Archive, folders, and Inbox zero.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as written | 24 |
| Ideal on current boards | 19 |
| Extra steps | 5: steps 14, 15, 16 (Filter, hide read mail, Important only: view settings that do not move the list toward empty), 18 (open the agent, then abandon it), 23 (pull to refresh when nothing is new). None is forced by the design; they are choices the story makes. |
| Needless decisions | Step 18 vs 19: two routes to answer the payroll mail (agent or Compose). Replying to the open message already prefills recipient and subject (`PG-A-Compose.png`, "Reply" board), so the manual blank Compose of steps 19-20 is not needed. |
| Re-entry of known data | Steps 19-20 retype the recipient and subject of a mail the user is reading. The Reply board prefills both; the story should use Reply, not Compose. |
| Dead ends | After Archive of the last row the detail pane has no state (step 13, step 24). Inbox zero is only described in `PG-A-Rules.dc.html` copy; no board draws it (searched all boards, no "Inbox zero" text). |
| Steps with no board | 2 (folders in the left third; `Split.png` shows the main sidebar, not a folder list), 4 and 5 (open message with Reply beside the list on the inner display), 7 and 13 (Archive on the inner display), 19-21 (compose on the inner display), 24 (Inbox zero). Outer-display versions exist for 4, 5, 7, 13 (`PG-A-InboxMessage.png`) and 19-21 (`PG-A-Compose.png`). |
| Steps with a board | 1 (`PG-A-Home.png` shows the Inbox row "Inbox, 3 need reply, 42"; `Main.png` matches), 3 and 8 and 12 and 17 (list rows, `Inner.png`, `Split.png`), 9-11 (agent thread with approval card, `Inner.png`: Save secondary, Send the one prominent), 14 (Filter button in `Split.png`, popover not drawn here), 22 (swipe Archive, phone only: `PH-Inbox.png`). |

The count is mostly one tap per row plus one per action, which is the minimum for list-and-detail. The inner display itself adds no steps.

## 2. Take-away pass per screen

**Inbox list, inner (`Split.png`).**
- Two search fields: "Search" in the sidebar and "Search mail" beside the title. Remove the one beside the title; the rule card puts Search mail in the strip.
- The strip has four icons (Hide amounts eye, star "Important only", Filter, Compose). The design rule allows at most three per action group, and "Hide amounts" has no use in mail. Remove the eye; fold "Important only" into the Filter popover.
- Row chips "Newsletter" and "Junk" (the latter in yellow) label rows the user is about to swipe away. Keep "Needs attention" only. The yellow chip is a second accent in a monochrome app.
- Section count "Other mail today 24" is not acted on; minor.
- One prominent action: the light "Ask Inbox agent" circle. Correct, but for triage Archive is the frequent action; here it is not on the screen at all.

**Inbox beside agent thread (`Inner.png`).**
- One prominent action: Send on the approval card, Save secondary. Correct.
- The user cannot see which message the agent is working on except by the highlighted Ana row. There is no context cue in the thread (step 9).
- "Needs approval" badge and the bubble "I have not sent it" both say the draft is unsent. Keep the badge.
- The strip shows Page and List, which are agent-page controls (`PG-A-Rules` Agent thread), not mail controls; fine for a thread, but the user in the middle of triage has no Archive or Reply here.

**Open message, outer (`PG-A-InboxMessage.png`).** Back, Archive, Reply and the one prominent Ask Inbox agent. Clear and minimal. No inner-display version exists.

**Reply and Compose (`PG-A-Compose.png`).** Reply is prefilled (To, Subject, quoted text collapsed behind the dots chip), one prominent Send arrow. The title menu (Reply, Reply all, Forward) is the right single place. "From" shows an address that never changes for a single account; it could be hidden until the user has two. Minor.

**Cleanup (`PG-A-Cleanup.png`).** Three senders archived in one action with Undo, one prominent "Archive 3". This is the fastest route for step 22. It is only reachable from the Inbox More menu on the outer display; the inner strip has no More.

## 3. Simpler version

1. Home: tap Inbox (opens the list with the first Needs reply row already selected; removes step 3).
2. Read; tap Reply, type, Send. The next row opens.
3. Jordan Lee: Ask Inbox agent, one line, Send on the card. The thread shows the message title as context.
4. Northwind Support: Archive. The next row opens.
5. Acme Payroll: Reply (recipient and subject prefilled), type, Send. Drops steps 18 and the typing in 19-20.
6. Newsletters: Cleanup from More, tick three senders, "Archive 3" with Undo (or swipe).
7. Inbox zero is shown in the detail pane.

About 19 steps (drops 14-16, 18, 23). Nothing is sent or archived without a tap, and Archive offers Undo.

## 4. Beauty check against the iOS rules

- Glass only on floating controls: `Inner.png` and `Split.png` keep rows, bubbles and the approval card solid; glass is the strip, the title pill, the composer and the sidebar panel. Pass.
- At most three glass groups: `Inner.png` has the Inbox agent pill, the strip, and composer plus More circle (three). `Split.png` has the sidebar panel, the strip and the prominent circle. At the limit in both; no room for a fourth.
- Exactly one prominent action: `Inner.png` Send; `Split.png` the Ask Inbox agent circle; `PG-A-Compose.png` the send arrow; `PG-A-Cleanup.png` "Archive 3". Pass.
- Concentric corners: approval card and its buttons look nested and consistent in `Inner.png`; row selection radius is not nested. Judged visually only, not measured.
- Shipped bot avatars: Chief teal hexagon, Finance orange wedge, Legal purple teardrop, Carta as a letter tile in `Split.png` and `PG-A-Home.png`. Pass.
- Fold zone: x 435 to 455 is empty in `Inner.png`. Pass.
- Strip parity (rule 11): `Split.png` strip (Hide amounts, Important only, Filter, Compose) differs from the Inbox rule card (Search mail, Filter, Compose) and from the outer Inbox screen. Fails.

## 5. Verdict: acceptable

Not convoluted: five extra steps, all from story choices and none forced by the design. Not minimal: the central triage actions (Archive, Reply, open message, Inbox zero) are drawn only on the outer display, and the inner Inbox strip carries controls the rule card does not list.

## ISSUES

- STORY-064-R1-1 (high): Archive, Reply and the open message are not drawn on the inner display. Steps 4, 5, 7, 13. `Inner.dc.html`, `Split.dc.html` (`PG-A-InboxMessage.dc.html` has them on the outer display only). Fix: add an inner board "Inbox, message open": list in the left third with the row selected, message in the detail, strip with Back, Archive, Reply, spacer, More, and the prominent "Ask Inbox agent". Reply opens the composer under the message (half-folded) or in the detail pane (flat), x 455 to 890 only.
- STORY-064-R1-2 (high): No Inbox zero state and no selection rule after Archive. Steps 7, 13, 24. All boards (rule card text only in `PG-A-Rules.dc.html`). Fix: draw the detail pane with the centered line "Inbox zero" and "Synced [TIME]"; state that Archive opens the next row down; draw an "Archived" snackbar with Undo (the Cleanup "Done" board has Undo; the phone swipe on `PH-Inbox.dc.html` has none).
- STORY-064-R1-3 (medium): The inner Inbox strip does not match the outer Inbox rule. Steps 14, 16. `Split.dc.html`. Fix: replace the four icons (Hide amounts, Important only, Filter, Compose) with Search mail, Filter, Compose, then a More group holding Cleanup; delete "Hide amounts" from the Inbox; move "Important only" into the Filter popover as a row.
- STORY-064-R1-4 (medium): Two search fields on one screen. Steps 2, 3. `Split.dc.html`. Fix: remove the "Search mail" field beside the "Inbox" title and use the strip's Search mail button.
- STORY-064-R1-5 (medium): The payroll mail is answered through blank Compose, retyping known data. Steps 18-21. Story text; boards `PG-A-Compose.dc.html`, `PG-A-InboxMessage.dc.html`. Fix: use Reply on the open message (recipient and subject prefilled) or the agent's prefilled draft card; drop "Tap Compose... type a recipient, subject" from the story. Keep Compose for new mail only.
- STORY-064-R1-6 (medium): Cleanup is not reachable on the inner display. Step 22. `PG-A-Cleanup.dc.html` (outer only), `Split.dc.html` has no More. Fix: show More with "Cleanup" in the inner Inbox strip (see R1-3) and draw Cleanup in the detail pane; swipe Archive stays as the single-row path.
- STORY-064-R1-7 (low): "Junk" (yellow) and "Newsletter" chips on rows the user will swipe or clean up. Step 22. `Split.dc.html`, `PH-Inbox.dc.html`. Fix: show only "Needs attention"; remove the other two chips and the second accent color.
- STORY-064-R1-8 (low): The agent thread gives no cue which message it is about. Step 9. `Inner.dc.html`. Fix: add a one-line "Re: Pilot timeline" context chip above the composer.
- STORY-064-R1-9 (low): The folders list is still undrawn. Step 2. `Split.dc.html`. Fix: draw the folder list in the left third, or remove "folders" from the rule card and the story.
