# STORY-047: Fix the recipient list, then edit and send

Previous round: Round 1 verdict was acceptable (edit entry and return undrawn; working line and repeated sentence on the card). Round 0 was convoluted.

Target: planned native SwiftUI iPhone app (epic #427; phases #417, #418, #419). Device: Duo outer display 466x678 pt; PH-Thread for the 393x852 phone.
Boards viewed (screenshots, all opened): PG-A-Thread, PH-Thread, PG-A-Compose (Edit draft, Cc suggestions, Invalid address, Discard prompt frames), PG-A-ThreadStates ("Approval pending, typing" frame), Inner-Message, PG-A-InboxMessage, DS-06-Chat (tall, downscaled; card states small).

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Ideal path (catalog) | 7 steps |
| Composer route | 3 actions: open card, type "Add Jordan on Cc" in the composer (PG-A-ThreadStates "Approval pending, typing" draws this), tap Send on the new card. "Draft replaced" frame draws the old card as "Replaced by a newer draft". |
| Edit route | Card with Edit and Send (PG-A-Thread, PH-Thread) -> tap Edit -> "Edit draft" sheet (PG-A-Compose: To, always-visible Cc, Subject, body, "Done") -> type "Jor", pick Jordan Lee (Cc suggestions frame) -> change body -> Done -> Send. About 6 actions, every screen drawn. |
| Steps with no board | Only the card after Done (Cc row and edited time shown on the card). Catalog step 7 (check the Inbox) is unneeded; the thread shows "Sent." |
| Needless decisions | Two routes to one change, but Edit is a quiet secondary button and the composer is the natural one. Acceptable. |
| Re-entry of known data | None: contact chip for Ana, Cc suggestions from contacts. |
| Dead ends | None found. Empty recipient (Add a recipient, Send dimmed), invalid address (inline error), abandoning (Discard changes / Keep editing) are drawn. |

## 2. Take-away pass

- PG-A-Thread, PH-Thread: the stale "working" line and the "Here is a draft" sentence are gone. The card has one prominent action (Send); Edit is quiet. Nothing more to remove.
- PG-A-Compose Edit draft: Cc is always shown, so no expand step; one prominent control ("Done"). Nothing to remove.
- "Agent editing the draft" frame: the tag says "Updating" and Edit is dimmed, but Send stays fully enabled (see R2-1).
- Facts stated twice: none on these screens.

## 3. Simpler version

Already drawn: type "Add Jordan on Cc and make it 10:30" in the composer, then tap Send on the new card (3 actions). Edit stays as the exact-wording route.

## 4. Beauty check

Cards and bubbles are solid; glass only on the title pill, side buttons and composer; one prominent action per view; status colors limited to the yellow "Needs approval" tag and red error text; corners concentric. Edit draft uses the shared Done capsule. No violations seen.

## 5. Verdict

**minimal.** Both routes are fully drawn; three small gaps remain below.

## ISSUES

- STORY-047-R2-1 | medium | PG-A-Thread.dc.html, PH-Thread.dc.html | "Agent editing the draft" frame (step 2, composer route): the card shows "Updating" and Edit is dimmed, but Send is still enabled, so Lena could approve the old draft while the agent is replacing it. Fix: dim Send (and keep Edit dimmed) while the tag reads "Updating".
- STORY-047-R2-2 | low | PG-A-Thread.dc.html, PH-Thread.dc.html | Step 3 (result of either route): the card after "Done" or after the agent replaces it is not drawn with the change. "Draft replaced" shows a new card with different wording, no "Cc Jordan Lee" row and no "10:30". Fix: draw the new card with a Cc row ("Cc  Jordan Lee") and "10:30" in the body so the result of the edit is visible beside the "Replaced by a newer draft" strip.
- STORY-047-R2-3 | low | PG-A-Compose.dc.html | "Invalid address" frame (step 4): "Done" is fully enabled while the To field shows "Not a valid address", so Done can return a card that cannot be sent. Fix: dim "Done" while any address is invalid (same treatment as Send disabled in "no recipient").
