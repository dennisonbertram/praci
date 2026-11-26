# STORY-043 journey critique: long founder session (attach, reply, fail, recover)

Previous round: acceptable (round 2: about 24 taps vs 22 ideal; React missing from the long-press menu; Finance thread and chip carry-over not drawn on the inner display).

Round 3 boards judged: `PH-Thread` (Thread, Plus menu, Message menu long press, Finance agent four files limit, Table Expand sheet), `PG-A-ThreadStates` (Offline nothing queued, Offline queued, Failed, Refused, Composer with an oversize file, Finance agent two files limit, Running), `PG-A-Thread`, `PG-A-Compose` (checked, not part of this story), `Inner` (Finance half-folded 1/2 + 1/2), `Inner-Message`, `DS-06-Chat`. Boards are static; each step is judged against the board that draws it.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Ideal path (catalog) | about 22 taps |
| Actual as designed | about 24 taps (thread 1; photo 3; three PDFs 9; send 1; Expand and close 2; long-press Reply 2; send 1; Remove file 2; send 1; React 2 with the reaction row). Same as round 2: the Plus menu offers "Photos" and "Files", and nothing says either takes several files, so each file is one trip. |
| Needless decisions | Plus menu opened up to four times. The four-file frame in `PH-Thread` shows the plus dimmed, so the limit is now learned before opening the menu (round 2 issue fixed). |
| Re-entry | None. The oversize frame keeps the text and both chips; the bad chip is outlined with "pilot-deck.pdf is over 25 MB. Remove it to send." |
| Dead ends | None. Offline queued, Failed (Retry), Refused (Remove file) and the upload-error chip ("chart.png did not upload. Remove it to send.") each have one action. |
| Steps with no board | 2 of 15, down from 4: attachment chips carried to the inner display (14), and a multi-file pick in Photos or Files (3-5). Drawn since round 2: Expand sheet "Vendor payments" with Done (10), React with a five-emoji row and the reaction under the bubble (15), the four-file limit with upload ring, error chip and dimmed plus (5-6), Finance agent thread, a draft and a queued bubble on the inner display (14). |

Mismatches (catalog, not design): step 6 says the plus menu still opens at the limit, but the board dims it. Step 11 says the menu lists Reply and Copy only; it now lists Reply, React, Copy. Step 14 says Personnel in the 1/3 pane; `Inner` draws Finance in the left half (1/2 + 1/2) beside the Finance agent thread. Step 15 says "the board menu has no React"; it does.

## 2. Take-away pass

- `PH-Thread` Thread: back, name capsule, two page icons, more, draft card, composer. Everything is used elsewhere in the story. Keep.
- Plus menu: two rows, Photos and Files. Minimal.
- Message menu: reaction row above, then Reply, React, Copy. React appears twice (the row and the menu item). This is the iOS pattern, but the "React" item is redundant when the emoji row is visible. Removable (see R3-3).
- Four-file frame: chips, one 60% ring, one error chip with the reason line, grey send. Plus dimmed. One prominent action (send) and it is grey while a chip is in error, which is correct.
- Offline: banner when nothing is queued, only "Waiting to send" when a message is queued. Each fact once.
- Failed vs Refused: one action each.
- `Inner` Finance half-folded: the thread shows "Compare runway with August" with "Waiting to send", two chips "Runway" and "Operating", a composer draft with a filled send, and a separate round "more" button. The chips look like suggestion or context chips, not attachments, so they do not show that files carried over. The separate more button next to the composer is a fourth floating control group next to the side strip, name capsule and composer.
- Facts stated twice: on Refused the reason shows under the bubble and again in the composer after Remove file, which are two stages of one fact. Acceptable.

## 3. Simpler version

1. Open Finance agent thread (1).
2. Plus once: Photos multi-select 3 taps; Files multi-select, three PDFs about 5. Saves about 2 taps.
3. At four chips the plus is dimmed (drawn).
4. Ring on each chip while uploading (drawn).
5. Offline: caption only (drawn).
6. Long-press: emoji row, Reply, Copy (React is the row; drop the duplicate item).
7. Unfold: draft, attachment chips and queue carry over.

Result: about 20 taps against 22 ideal.

## 4. Beauty check

- Glass on floating controls only: `PH-Thread` header and composer are glass, bubbles, card, table sheet and menus are solid or standard menu material. Pass.
- At most three glass groups: `PH-Thread` three. `PG-A-ThreadStates` side strip, name capsule, composer: three. `Inner` Finance half-folded: side strip, name capsule, composer and a separate more button: four. Fails.
- One tinted prominent action per view: `PH-Thread` has the draft card Send as the only cream button; the message menu frame has none. Pass.
- Concentric corners: chips nest in the composer in the limit and oversize frames. Pass.
- Error styling: destructive red outline and text only. Pass.
- Names and avatars: Inbox agent blue, Finance agent orange warning-triangle avatar, Chief teal. Pass.

## 5. Verdict

acceptable

Close to minimal: every failure state in the story is drawn and has one action, React and the Expand sheet exist, and the limit is shown before the menu opens. It stays acceptable because attaching is still one file per Plus trip, the inner display does not show attachment chips, and its extra more button breaks the three-glass-group rule.

## 6. Issues

- STORY-043-R3-1 (medium) `PH-Thread` (Plus menu, Finance four files), `PG-A-ThreadStates`. Steps 2-5: Photos and Files rows do not say they take several items, so the founder makes up to four trips with the plus (about 2 extra taps). Fix: draw Photos and Files as multi-select pickers limited to the remaining slots, with a "Add 3" confirm button in the picker.
- STORY-043-R3-2 (medium) `Inner` (Finance half-folded). Step 14: the composer shows a draft and the thread shows "Waiting to send", but the chips under the thread are "Runway" and "Operating", which read as suggestions, and no attachment chips are in the composer. Carry-over of files is unproven, and the extra round more button beside the composer makes a fourth glass group. Fix: put two attachment chips (file icon, name) inside the composer above "Also compare with September", move the Runway and Operating chips out of that area, and merge the more button into the side strip or name capsule menu so the view has three glass groups.
- STORY-043-R3-3 (low) `PH-Thread` (Message menu, long press). Step 15: the emoji row and the "React" menu item do the same thing. Fix: delete the "React" item; keep the row, Reply and Copy, and let the "+" at the end of the row open the full emoji picker.
- STORY-043-R3-4 (low) catalog.md STORY-043 steps 6, 11, 14 and 15 and its Design gaps. The text predates the boards: the plus is dimmed at four files, the menu lists Reply, React, Copy, the inner pane is Finance at 1/2 + 1/2, upload progress and the Expand sheet are drawn. Fix: update those steps and remove the "NO BOARD" note for progress, reaction picker and Expand sheet.
- STORY-043-R3-5 (low) `PH-Thread` (Finance four files), `PG-A-ThreadStates`. The story's files are three PDFs and a HEIC screenshot; the frames show terms.pdf, chart.png, q3.csv, notes.pdf. Fix: use board-deck.pdf, q3-summary.pdf, cap-notes.pdf and a screenshot name so the board matches the story (names are invented either way).
