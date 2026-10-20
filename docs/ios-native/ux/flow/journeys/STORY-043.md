# STORY-043 journey critique: long founder session (attach, reply, fail, recover)

Boards judged: `DS-06-Chat` (composer, chips, failed bubble, reply line, working indicator), `PG-A-Thread` (outer phone, 466x678), `Inner` (inner display, 890x626). Screenshots viewed: `DS-06-Chat.png` (tall, downscaled, so small text was not legible), `PG-A-Thread.png`, `Inner.png`. The boards are static; steps were judged against the board that defines them.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Ideal path (catalog) | about 22 taps |
| Actual as designed | about 24 taps. Count: open thread 1; photo 3 (plus, Photo library, pick); three files 9; send 1; Expand and close 2; long-press and Reply 2; send 1; Retry 1; React 3 (long-press, React, thumbs up) |
| Extra steps | 2, both from the attach flow (below) |
| Needless decisions | The Attach menu is opened four times and asks "Photo library or File" each time. One document picker that allows multiple selection would replace three of the four trips. Step 6 lets the user open the menu at the limit and only then says "(max 4 attachments)". |
| Re-entry of known data | None. The composer text, chips and queue state must carry to the inner display (step 14); no board says they do. |
| Dead ends | Step 13 "Not sent / Retry" is a clear exit. Offline "Sending" (step 8) has no designed state beyond the caption, so a long outage has no visible next action. |
| Screens with no board | Attach menu, upload progress, offline/queued waiting, long-press menu (Reply, React), reaction picker, table Expand sheet, "max 4 attachments" message, composer carry-over on posture change. 8 of the 15 steps rely on at least one of these. |

What is drawn: composer empty, typing, agent working, attachment chips plus reply preview, failed bubble with Retry, reply line, working indicator (`DS-06-Chat`); thread with working indicator (`PG-A-Thread`); thread beside a list on the inner display (`Inner`).

Mismatch: step 14 says the inner display shows Personnel in the 1/3 pane. `Inner.png` shows an Inbox list in that pane instead, so the Finance-agent case is not drawn.

## 2. Take-away pass

- Composer (`PG-A-Thread.png`): plus, text field, mic. One element per job; nothing to remove. When text is typed, DS-06 swaps the mic for Send, which keeps one action. Good.
- Chips row (`DS-06-Chat`): needed. Each chip needs a remove control; keep it small.
- Failed bubble: "Not sent" plus Retry is stated once. Keep.
- Working indicator: "Inbox agent is working" text above the composer. The composer placeholder in DS-06 also changes to "Agent is working" with a stop control, so the working state is stated twice (indicator row and placeholder). Remove one; keep the indicator row because the placeholder disappears once the user types.
- Thread header capsule (`PG-A-Thread.png`): agent name stated once in the header and again in the placeholder ("Message Inbox agent"). Acceptable, since the placeholder is the standard prompt.
- Side toolbar with back, two page icons, and a "more" button at the bottom: three glass groups, which is the maximum. The two page icons are used by no step in this story; they are navigation to other things, so they stay, but they are the first thing to cut if the screen feels busy.
- Prominent action: in the thread there is no tinted prominent button; the cream Allow button in the approval card is the loudest element. That card does not occur in this story, so for this story the composer's Send is the single prominent action. Right.
- Same fact twice: the "max 4 attachments" limit is stated only after the fact; better to state it once by disabling the plus (see section 3).

## 3. Simpler version

1. Open "Finance agent" thread (1 tap). Unchanged.
2. Tap plus once. The menu offers "Photos" and "Files". Both pickers allow multiple selection. Select the HEIC screenshot in Photos (3 taps). Select the three PDFs in Files in one trip (about 5 taps: plus, Files, three checks, Done). This saves about 2 taps and 2 menu trips.
3. At 4 chips, disable plus (grey, no menu) instead of opening it and showing "(max 4 attachments)". Removes step 6 entirely (1 tap) and the error text.
4. Show upload progress as a thin ring on each chip. This needs a board.
5. Queued send: keep the bubble at 70% with "Sending"; add "Waiting for connection" in the caption only when offline. No extra control.
6. Reply: swipe right on a message to reply (alternate to long-press, saves 1 tap). React stays on long-press. Keep the long-press menu as the canonical route; swipe is an accelerator only.
7. Duo unfold: carry over composer text, chips, queue. Show the Personnel list in the 1/3 pane, as the story says.

Result: about 20 taps against the 22 ideal. Needs boards for: Attach menu, chip progress ring, disabled plus at the limit, offline caption, long-press menu with Reply and React, reaction picker.

## 4. Beauty check

- Glass only on floating bars: `PG-A-Thread.png` shows glass on the side toolbar capsules, the header name capsule and the composer. The bubbles, the approval card, the search-result line and its buttons are solid. Follows the rule.
- At most three glass groups: header capsule, side toolbar (back; page icons; more are separate capsules), composer. That is four items counting the more button on its own; it reads as three groups plus the composer. Borderline; the "more" circle at the bottom-left sits against the composer and could join the toolbar capsule group. I could not confirm the count from the downscaled DS-06.
- One tinted prominent action: on `PG-A-Thread.png` the cream Allow button is the only filled action; blue is used only for the "working" text. Pass.
- Concentric corners: the composer pill and the more circle share a baseline and height in `PG-A-Thread.png`; the card corners look consistent with the bubbles. No defect seen at this resolution.
- Spacing and type: consistent between `PG-A-Thread.png` and `Inner.png`. The Duo inner layout keeps the same bubble and card styles. Pass.
- Not checkable: DS-06 text and chip details, because the screenshot is downscaled.

## 5. Verdict

acceptable

The tap count is close to the ideal (about 24 vs 22) and the boards follow the design rules. The weaknesses are the repeated Attach menu, the late "max 4" error, a duplicated working-state statement, and eight steps with no board.
