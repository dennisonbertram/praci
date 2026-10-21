# STORY-043 journey critique: long founder session (attach, reply, fail, recover)

Previous round: acceptable (about 24 taps vs 22 ideal; offline, attach, menus had no board).

Round 1 boards judged: `PG-A-ThreadStates` (new: Offline, Failed, Refused), `PH-Thread` (new, standard iPhone), `PG-A-Thread` (Duo outer, edited), `Inner` (Duo inner), `DS-06-Chat` (composer, chips, failed bubble, reply line; tall and downscaled, details checked against its source text). All screenshots viewed. Boards are static; each step is judged against the board that draws it.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Ideal path (catalog) | about 22 taps |
| Actual as designed | about 24 taps (open thread 1; photo 3; three files 9; send 1; Expand and close 2; long-press Reply 2; send 1; Retry 1; React 3) |
| Needless decisions | The Attach menu is opened four times and asks "Photo library or File" each time. At 4 chips the plus still opens the menu and errors afterward. |
| Re-entry | None drawn. Composer text, chips and queue on posture change are not drawn (`Inner` composer is empty). |
| Dead ends | None now. `PG-A-ThreadStates` gives Offline ("Waiting to send"), Failed ("Not sent" + Retry) and Refused ("Not sent: Attachment is too large" + Edit). Open: after Edit, whether the chips return to the composer is not shown. |
| Steps with no board | Attach menu (2-6), upload progress (7), chips at the 4 limit (6), table Expand sheet (10), long-press menu with Reply/React (11, 15), reaction picker (15), posture-change carry-over (14). 6 of 15 steps. Down from 8 last round: steps 8, 9 (offline, queued, working) and 13 (failed, retry) are now drawn. |

Mismatch kept from last round: step 14 says Personnel in the 1/3 pane beside the Finance thread. `Inner` shows an Inbox list beside the Inbox agent thread. The Finance agent thread is not drawn on any board (all thread boards use Inbox agent).

## 2. Take-away pass

- `PH-Thread` / `PG-A-Thread`: header name capsule, two page icons, composer (plus, field, mic). Nothing the story needs is missing from these; nothing in them is unused except the two page icons, which this story does not use but are navigation. Keep.
- Offline (`PG-A-ThreadStates`): the banner "Offline. Messages send when you reconnect." and the caption "Waiting to send" both say the message is waiting. Keep the caption (per message), drop the banner text once the message exists, or keep the banner only when nothing is queued. Low.
- Working state: in `PH-Thread` the indicator row "Inbox agent is working" is the only statement and the placeholder stays "Message Inbox agent". Good. `DS-06-Chat` still draws both an indicator and an "Agent is working" placeholder; say which wins. Low.
- Failed vs Refused: Retry for a transient failure, Edit for an oversize refusal. Each has one action. Good; this fixes last round's "Retry on a refusal" ambiguity.
- Prominent action: the thread has no tinted button. In this story the composer send (on typing) is the one prominent action. `PH-Thread` shows the cream Send in the mail card, which does not occur here, and there is no competing second one. Pass.
- Facts stated twice: "max 4" appears only after the fact (see simpler version).

## 3. Simpler version

1. Open Finance agent thread (1).
2. Plus, once: menu "Photos" / "Files", both multi-select. Photo 3 taps, three PDFs in one trip about 5. Saves about 2 taps.
3. At 4 chips, plus is disabled; no menu, no error text. Removes step 6.
4. Progress ring on each chip while uploading.
5. Offline: caption "Waiting to send" is enough; banner only when nothing is queued.
6. Reply and React from one long-press menu (Reply, React, Copy); swipe-to-reply as accelerator only.
7. Unfold: composer text, chips and queue carry over; Finance thread in 2/3, Personnel in 1/3.

Result: about 20 taps against 22 ideal.

## 4. Beauty check

- Glass only on floating controls: `PH-Thread` and `PG-A-Thread` show glass on back, name capsule, page icons, composer and (Duo) the more button; bubbles and the mail card are solid. Pass.
- At most three glass groups: `PH-Thread` has back plus name, the page-icon pair, the composer (three). `PG-A-Thread` has back, page icons, name capsule, composer and more button; the side strip groups back and icons as separate capsules, so it reads as four to five. Borderline; join back, icons and more into one strip capsule (low).
- One tinted prominent action per view: pass in all four thread boards.
- Concentric corners: composer pill, more circle and capsules align on `PG-A-Thread` and `Inner`. Pass.
- Error styling: red outline on the bubble plus red caption in `PG-A-ThreadStates`; destructive token only, no extra chrome. Pass.
- Name: all boards use "Inbox agent" with the shipped blue bot avatar. Pass.

## 5. Verdict

acceptable

Offline, failed and refused recovery are now drawn and have one clear action each. The attach flow (four menu trips, late limit error), the long-press menu, and the Duo carry-over are still undrawn or repeated.

## 6. Issues

- STORY-043-R1-1 (medium) `PH-Thread`, `PG-A-Compose`, `DS-06-Chat`. Steps 2-6: the plus opens a Photo/File menu four times, and at 4 chips still opens then errors "(max 4 attachments)". No board draws the menu. Fix: draw a plus menu with "Photos" and "Files" (both multi-select); disable the plus at 4 chips (grey, no menu).
- STORY-043-R1-2 (medium) `DS-06-Chat`, `PH-Thread`. Steps 11, 15: Reply and React depend on a long-press menu that is drawn only for failed bubbles (Retry, Delete). Fix: draw one long-press menu on a reply bubble with Reply, React, Copy, and the reaction row.
- STORY-043-R1-3 (medium) `Inner`, `Split`. Step 14: the inner display shows Inbox list plus Inbox agent thread, not the Finance thread with Personnel; composer is empty so carry-over of text, chips and queue is not shown. Fix: add an inner-display variant with a draft and two chips in the composer, or change the story to match the Inbox board.
- STORY-043-R1-4 (low) `PG-A-ThreadStates` (Refused). After Edit on "Attachment is too large", it is not shown whether the chips and text return to the composer. Fix: add a fourth state with the composer holding the text and chips and the oversize chip marked.
- STORY-043-R1-5 (low) `PG-A-ThreadStates` (Offline). The banner and the "Waiting to send" caption both say the same thing. Fix: show the banner only while no message is queued, or drop its second sentence.
- STORY-043-R1-6 (low) `DS-06-Chat`. The working state is drawn as indicator row and as placeholder "Agent is working". Fix: keep the indicator row only, as in `PH-Thread`; the placeholder stays "Message <agent>".
- STORY-043-R1-7 (low) `PG-A-Thread`. Side strip has separate capsules for back, page icons and more; reads as more than three glass groups. Fix: one strip capsule holding back, the two icons and more.
- STORY-043-R1-8 (low) all thread boards. Step 1 and the whole story use the Finance agent, but no board shows a Finance agent thread or its attachment chips with upload progress. Fix: use "Finance agent" in one thread board with four chips and a progress ring.
