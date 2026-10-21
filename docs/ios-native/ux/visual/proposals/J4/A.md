# J4 proposal A: minimal change

Persona at this step: a founder who asked the Inbox agent to reply to Ana, now looking at a finished draft on PG-A-Thread (466x678 strip) or PH-Thread (393x852).

## Idea
Fix the contradictions in place and add no new element. Remove the wrong line, demote the second prominent button, draw the missing Stop state, and give a scrolled-away approval a small cue that is already in the layout.

## Changes
1. Hide the working line while a card awaits approval. The run is paused for the user, so nothing is working. PG-A-Thread and PH-Thread lose "Inbox agent is working" (STORY-047-R1-2, V-iphone-R1-13, V-thread-R1-2).
2. Remove the agent sentence "Here is a draft. I have not sent it." when a card follows (STORY-047-R1-5). The tool label then sits directly above the card.
3. Working indicator is the DS-06 version everywhere: 28 pt bot avatar in its shipped colour with a ring, plus a pill of three neutral dots. No text. VoiceOver label "<agent> is working". PG-A-GroupThread uses the Legal avatar (purple #9B5CF6), not blue text (V-thread-R1-9, F-thread-015).
4. Composer trailing control while any card awaits approval: Send is drawn with a solid neutral fill (#33322F) and an ink arrow. The card Send is the only tinted action (V-thread-R1-18, RED-R1-16).
5. Stop: while an agent runs, the trailing slot is stop.fill in the prominent fill. Typed text stays in the field as a draft and Send returns when the run ends. A "Stopping" state shows a 20 pt spinner in the same slot (F-thread-014).
6. Scrolled-away cue: a 8 pt warning dot on the right edge of the title capsule while an approval is pending. Not tappable.

## What it does not do
Tapping the dot does nothing, so the jump to the card still needs a manual scroll. That leaves F-duo-006 (a cue that scrolls to the card) only half met.

## Boards touched
PG-A-Thread, PH-Thread, PG-A-GroupThread, PG-A-ThreadStates, DS-06-Chat (composer states plus rule), PG-A-Rules (working line text).

## Cost
Lowest. No new component. One new composer state (Stopping) and one badge on an existing capsule. SwiftUI: a conditional `Text`/`ProgressView` swap and a `.overlay` badge.

## Risks
The dot is an unlabeled signal by colour only (against the rule that colour is never the only signal), and a badge on a title capsule is not a pattern iOS users read as "tap to jump".
