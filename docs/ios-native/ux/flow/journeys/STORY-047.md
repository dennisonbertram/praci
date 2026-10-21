# STORY-047: Fix the recipient list, then edit and send

Previous round: convoluted (5 of 7 steps had no board; card had two label pairs).
Round 1 verdict: **acceptable** (label conflict fixed; one entry point to the editor is still undrawn).

Target: planned native SwiftUI iPhone app (epic #427; phases #417, #418, #419). Device: Duo outer display 466x678 pt; PH-Thread for the 393x852 phone.
Boards viewed (screenshots, all opened): PG-A-Thread, PH-Thread, Inner, PG-A-ThreadStates, PG-A-Compose, PG-A-InboxMessage, DS-06-Chat (tall, downscaled; card states and the "Add Jordan on Cc" composer state are visible but small).

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Ideal path (catalog) | 7 steps |
| Simplest path on current boards | 3 actions: open card, type "Add Jordan on Cc and make it 10:30" in the composer, tap Send on the new card |
| Direct-edit path | Card (PG-A-Thread, PH-Thread, Inner: drawn) -> entry to editor (NO BOARD) -> editor (PG-A-Compose draws To, Cc/Bcc, Subject, body, send, but for composing mail, not for a draft card) -> return to card (NO BOARD) -> Send. About 5 actions; 2 of the transitions have no board. |
| Steps with no board | Edit entry on the card; confirm/return from the editor; "Replaced" state of the old card; sent-confirmation check in the Inbox (step 7, should be dropped). |
| Needless decisions | Two ways to make the same change (composer or editor). Acceptable if the composer is the main route and editing is secondary. |
| Re-entry of known data | PG-A-Compose shows To as a contact chip ("Ana Ruiz"), so a known contact is not retyped. Cc/Bcc is one collapsed row; adding Jordan Lee means expanding it and picking the contact. No suggestion state is drawn. |
| Dead ends | Abandoned edit, invalid address, and removing the only recipient have no drawn outcome. After "Save" there is no drawn post-save state. |
| Board conflict | Resolved. PG-A-Thread, PH-Thread and Inner all show "Save" and "Send". |

## 2. Take-away pass

- PG-A-Thread and PH-Thread: the blue "Inbox agent is working" line sits under a card that is already waiting for approval. The agent has finished, so the line is stale and competes with the yellow "Needs approval" tag. Remove it while a card awaits approval. The sentence "Here is a draft. I have not sent it." repeats the "Needs approval" tag; drop the sentence. One prominent action: "Send" (light filled); "Save" is quiet. Correct.
- Inner: the Inbox list is useful context. Same card, same labels.
- PG-A-Thread card: shows To only. The Cc row appears only in DS-06's "Needs approval, with Cc" state, so the result of the edit is drawn; the way there is not.
- PG-A-Compose: the editor surface exists and is clean. It is a send-new-mail screen: its send arrow would send directly, which is wrong for editing an approval draft. It needs a "Done" that returns to the card.
- DS-06 card states (Needs approval with Cc, Sent, Not sent, light): nothing to remove.

## 3. Simpler version

1. Open the Inbox agent thread at the pending card ("Send" prominent).
2. In the composer type "Add Jordan on Cc and make it 10:30" and send. The agent posts a new card with the Cc row and the new time; the old card shows "Replaced".
3. Tap "Send" on the new card; it shows "Sent". This is the confirmation, so the story ends here.

Secondary route, only if exact wording must be typed: tapping the card body opens the PG-A-Compose layout as a sheet with To/Cc/Subject/body prefilled; its single prominent control reads "Done" (not send) and returns to the card; "Send" stays on the card.

## 4. Beauty check

- PG-A-Thread, PH-Thread, Inner: card and bubbles are solid; glass only on the title pill, side buttons and composer (within three groups). One prominent action; card and capsule corners look concentric. Two status colors (blue working line, yellow tag) in one area; removing the working line fixes it.
- PG-A-ThreadStates: Offline, Failed, Refused are consistent with the thread. They cover chat messages, not the mail card.
- PG-A-Compose: consistent with the rules; one prominent action; contact chip for Ana Ruiz.
- DS-06: radii and padding could not be read at this size; no claim made.

## 5. Verdict

**acceptable.** The composer route is drawn except the "Replaced" state; the direct-edit route lacks its entry and return.

## ISSUES

- STORY-047-R1-1 | high | PG-A-Thread.dc.html, PH-Thread.dc.html, PG-A-Compose.dc.html | Step 2-3 (edit the draft): the card has no edit entry and PG-A-Compose draws a send-new-mail screen, not a draft editor. Fix: tapping the card body opens the PG-A-Compose layout as a sheet prefilled with the draft; the arrow becomes "Done" (returns to the card); the card keeps "Send". Add a board.
- STORY-047-R1-2 | medium | PG-A-Thread.dc.html, PH-Thread.dc.html, Inner.dc.html | Step 1: "Inbox agent is working" shows under a card that already needs approval, beside the yellow "Needs approval" tag. Fix: hide the working line while a card awaits approval.
- STORY-047-R1-3 | medium | PG-A-Thread.dc.html, DS-06-Chat.dc.html | Step 2 (composer route): after "Add Jordan on Cc" the old card has no state. Fix: draw the old card with a "Replaced" tag and no buttons, above the new card.
- STORY-047-R1-4 | medium | PG-A-Compose.dc.html | Step 4: Cc/Bcc is a collapsed row and no contact suggestions or invalid-address error are drawn. Fix: draw the expanded Cc row with a suggestion list (Jordan Lee) and an inline error state.
- STORY-047-R1-5 | low | PG-A-Thread.dc.html, PH-Thread.dc.html | Step 1: "Here is a draft. I have not sent it." repeats the "Needs approval" tag. Fix: remove the sentence when a card follows.
- STORY-047-R1-6 | low | PG-A-Thread.dc.html | Steps 6-7: no drawn outcome for "Save" or for removing the only recipient. Fix: draw a "Saved to drafts" tag on the card and a card with an empty To row and Send hidden; drop catalog step 7 (check the Inbox).
