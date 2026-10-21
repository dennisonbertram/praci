# STORY-047: Fix the recipient list, then edit and send

Previous round: Round 2 verdict was minimal (three small gaps: Send enabled while updating, edited card not drawn, Done enabled with an invalid address).

Target: planned native SwiftUI iPhone app (epic #427; phases #417, #418, #419). Device: Duo outer display 466x678 pt; PH-Thread for the 393x852 phone.
Boards viewed (screenshots, all opened): PG-A-Thread, PH-Thread, PG-A-Compose (Edit draft, Cc suggestions, Invalid address, Edit draft discard prompt), PG-A-ThreadStates ("Approval pending, typing"), Inner-Message, PG-A-InboxMessage.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Ideal path (catalog) | 6 steps (Edit, Cc suggestion, fix body, finish, Send) |
| Composer route | 3 actions: type "Add Jordan on Cc" in the composer (PG-A-ThreadStates "Approval pending, typing"), send it, tap Send on the new card. PG-A-Thread "Draft replaced" now draws the new card with a "Cc Jordan Lee" row and the old one marked "Replaced by a newer draft". Its body still says 10am. |
| Edit route | Tap Edit -> "Edit draft" (PG-A-Compose) -> tap "Cc, Bcc" to expand (the Edit draft frame shows it collapsed; only the typing frame shows it open) -> type "Jor", pick Jordan Lee -> edit body -> tap the round up-arrow -> Send on the card. About 7 actions. |
| Steps with no board | The card after the edit is finished (no Cc row and edited body drawn on the card in the Edit route). Return from the editor to the card. |
| Needless decisions | Two routes to one change (acceptable). In the discard prompt, "Save draft" vs "Discard" for a draft the agent already autosaves. |
| Re-entry of known data | None. Contact chips and suggestions are used. |
| Dead ends | None. Empty recipient, invalid address (Send arrow dimmed), discard prompt, and "Agent editing the draft" (Edit and Send both dimmed) are drawn. |

## 2. Take-away pass

- PG-A-Thread, PH-Thread: one prominent action (Send); Edit is secondary. The "Updating" frame now dims both buttons (R2-1 fixed). Nothing to remove.
- PG-A-Compose "Edit draft": the finish control is a round up-arrow, the same icon as Send in New message. The catalog and earlier rounds expect a "Done" capsule; no board contains "Done". An agent-draft editor that looks like a send button can be read as "send the email now". "Cc, Bcc" row hides Cc although the story needs it.
- "Edit draft, changed: discard prompt": three choices, including "Save draft" for a draft that already autosaves.
- Facts stated twice: none.

## 3. Simpler version

Composer route (3 actions). For the Edit route: show Cc open in "Edit draft" and finish with a labelled "Done" capsule, so the route is Edit, type, Done, Send.

## 4. Beauty check

Solid content, glass limited to the title pill, side strip and composer; one prominent action per view; status colors limited to the yellow "Needs approval" tag and red errors; corners concentric. The up-arrow in Edit draft breaks "one prominent action per view" only in meaning (it looks like Send), not in count.

## 5. Verdict

**acceptable.** Both routes are drawn and earlier gaps are fixed, but the Edit route has an ambiguous finish control and a hidden Cc row, which makes it about 7 actions with one unclear step.

## ISSUES

- STORY-047-R3-1 | high | PG-A-Compose.dc.html | Step 6 (finish editing): the "Edit draft" frames end in a round up-arrow, identical to Send in "New message". Lena cannot tell whether it returns to the card or sends the email, and the catalog says "Done". Fix: in the Edit draft frames replace the up-arrow with a "Done" capsule (shared Done style), keep Send only on the card; dim "Done" while an address is invalid.
- STORY-047-R3-2 | medium | PG-A-Compose.dc.html | Step 3 (add Jordan on Cc): "Edit draft" shows "Cc, Bcc" collapsed, so adding Cc needs an extra tap to expand; the Cc suggestions frame shows Cc already open. Fix: draw Cc as an always-visible row in Edit draft (leave Bcc behind the chevron).
- STORY-047-R3-3 | low | PG-A-Thread.dc.html, PH-Thread.dc.html | Step 6 (result): the Edit route's result is not drawn; the "Draft replaced" card shows the Cc row but keeps "10am" in the body, so the 10:30 fix is not visible. Fix: show the replaced card with "10:30" in the body and add an "Edited" time on a card changed by hand.
- STORY-047-R3-4 | low | PG-A-Compose.dc.html | Abandon path (step 6): the discard prompt offers "Save draft / Discard / Keep editing" for a draft the mail account already autosaves. Fix: for Edit draft use "Discard changes" and "Keep editing" only; keep "Save draft" for New message.
