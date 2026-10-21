# STORY-043 journey critique: long founder session (attach, reply, fail, recover)

Previous round: acceptable (about 24 taps vs 22 ideal; Attach menu and long-press menu had no board).

Round 2 boards judged: `PH-Thread` (now has Plus menu, Message menu (long press), Chat menu, draft states), `PG-A-ThreadStates` (Offline nothing queued, Offline queued, Failed, Refused, Composer with an oversize file), `PG-A-Thread`, `PG-A-Compose`, `Inner`, `Inner-Message`, `DS-06-Chat` (tall and downscaled; chip, progress-ring and reply-line details checked against its source text). Boards are static; each step is judged against the board that draws it.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Ideal path (catalog) | about 22 taps |
| Actual as designed | about 24 taps (thread 1; photo 3; three PDFs 9; send 1; Expand and close 2; long-press Reply 2; send 1; Remove file 2; send 1; React 3). Unchanged from round 1 because the Attach menu is still opened once per file. |
| Needless decisions | Plus opens a Photos/Files menu four times. Each menu is now drawn, but one file per trip. At 4 chips the plus is still enabled; the limit message appears only after the menu opens. |
| Re-entry | The oversize recovery no longer re-enters anything: `PG-A-ThreadStates` "Composer with an oversize file" shows the text and both chips back in the composer, with the bad chip outlined and "pilot-deck.pdf is over 25 MB. Remove it to send." Good. |
| Dead ends | None found. Offline queued, Failed (Retry) and Refused (Remove file) each have one action. |
| Steps with no board | 4 of 15, down from 6: the table Expand sheet (10), the React action and reaction picker (15; the long-press menu is drawn but lists only Reply and Copy), the 4-chip limit state (5-6), posture carry-over with chips (14). Plus menu, upload progress ring (in `DS-06-Chat` source) and the oversize composer are now drawn. |

Mismatch kept: step 14 says Personnel in the 1/3 pane beside the Finance thread. `Inner` shows the Inbox list beside the Inbox agent thread, and the composer now holds a typed draft ("Also ask her for the agenda") but no chips. No board draws the Finance agent thread.

Mismatch new: the catalog says a refusal shows "Attachment is too large" with "Edit". The boards show "Not sent: File is over the 25 MB limit" with "Remove file". The boards are better; the catalog text is stale (catalog fix, not a design issue).

## 2. Take-away pass

- `PH-Thread` Thread: header (back, name, two page icons, more), the draft card and composer. Nothing in the story is missing. Keep.
- Offline: round 1's duplicate is fixed. Nothing queued shows the banner "Offline. Messages send when you reconnect."; queued shows only the caption "Waiting to send". Each fact appears once.
- Failed vs Refused: Failed offers Retry only, Refused offers Remove file only. One action each.
- Long-press menu (`PH-Thread`): Reply, Copy. Missing React that the story uses (step 15).
- Composer with an oversize file: send button is the only filled circle; the chip errors are outlined, not tinted. Exactly one prominent action. Pass.
- Prominent action in the thread: the draft card's cream Send is the only one in each frame. Pass.
- Working state: `PG-A-ThreadStates` Running draws an indicator row and the placeholder stays "Message Inbox agent". Round 1 duplicate is fixed.
- Facts stated twice: on Refused the failure shows as red outline, "Not sent" caption and reason line, and again as a reason line in the composer after Remove file. One fact at two stages; acceptable.

## 3. Simpler version

1. Open Finance agent thread (1).
2. One plus trip: Photos multi-select 3 taps; Files multi-select, three PDFs about 5. Saves about 2 taps.
3. At 4 chips, plus is greyed; no menu, no late error.
4. Progress ring on each chip while uploading (drawn in `DS-06-Chat`).
5. Offline: caption only (done).
6. Long-press menu: Reply, React, Copy, with the reaction row above.
7. Unfold: draft text, chips and queue carry over.

Result: about 20 taps against 22 ideal.

## 4. Beauty check

- Glass on floating controls only: `PH-Thread` back, name capsule, icon pair and composer are glass; bubbles, the draft card and menus are solid or standard menu material. Pass.
- At most three glass groups: `PH-Thread` has three. `PG-A-ThreadStates` side strip is one tall capsule plus name capsule plus composer: three. Pass. (Round 1's strip issue is fixed.)
- One tinted prominent action per view: pass.
- Concentric corners: composer pill and chips nest cleanly in the oversize frame. Pass.
- Error styling: destructive red only, no extra chrome. Pass.
- Names and avatars: "Inbox agent" with the shipped blue avatar, "Chief" with the teal one. Pass.

## 5. Verdict

acceptable

Offline, failed, refused, plus menu and long-press menu are drawn, and each failure has one clear action. What keeps it above minimal: the Attach menu is still one file per trip with the limit shown late, React is missing from the long-press menu, and unfold carry-over of chips and the Finance thread is not drawn.

## 6. Issues

- STORY-043-R2-1 (medium) `PH-Thread` (Plus menu), `DS-06-Chat`. Steps 3-6: the drawn Plus menu is opened once per file; at 4 chips nothing shows the plus is unavailable, so the user learns the limit after opening the menu. Fix: make Photos and Files multi-select (up to the remaining slots) and add a frame where the plus is dimmed at 4 chips with no menu.
- STORY-043-R2-2 (medium) `PH-Thread` (Message menu, long press). Step 15: the menu lists Reply and Copy only; the story needs React, and no reaction picker is drawn. Fix: add React to the menu with a row of five reactions above it, and draw the picked reaction under the bubble.
- STORY-043-R2-3 (medium) `Inner`, `Inner-Message`. Step 14: the inner display shows the Inbox list beside the Inbox agent thread, with a draft but no chips, so carry-over of chips and the queue is not shown and the Finance agent thread is never drawn. Fix: add a frame with the Finance agent thread, a draft and two chips in the composer, one queued bubble "Waiting to send", or rewrite the story to the Inbox thread.
- STORY-043-R2-4 (low) `PH-Thread`. Step 10: the Expand sheet for a table in a reply has no board. Fix: draw a full-height sheet titled with the table name and a Done button.
- STORY-043-R2-5 (low) catalog.md STORY-043 step 13. Text says "Attachment is too large" with "Edit"; boards draw "File is over the 25 MB limit" with "Remove file". Fix: update the catalog step to match the boards.
- STORY-043-R2-6 (low) `PG-A-ThreadStates`, `PH-Thread`. Step 1 and the whole story use Finance agent but all thread boards use Inbox agent. Fix: label one thread frame Finance agent with four chips (one uploading with the ring, one error), the same as the oversize frame.
