# Judge brief: J4 pending approval vs working indicator and the one tinted action

Product: Praci, a planned native SwiftUI iPhone app. Judge three proposals for a chat thread where an agent has drafted an email and awaits the user's approval. Rules: glass only on floating nav/controls; at most three glass groups; exactly one tinted prominent action per view; minimal copy; native SwiftUI components.

Problem: a finished draft still shows "Inbox agent is working"; composer Send and the card Send are both prominent; a scrolled-away approval has no cue; Stop and Send share one composer slot with no rule for typed text during a run.

Acceptance: (1) no working line while a card awaits approval; (2) one tinted action; (3) a tappable cue to a scrolled-away approval; (4) Stop, typing-while-running and Stopping composer states defined; (5) working indicator uses the shipped avatar colour.

Score each proposal 1-5 on: meets acceptance [x3], simplicity [x2], consistency [x2], usability [x2], visual quality [x2], effort and risk (5 = small and safe) [x1]. Return a winner, an optional graft, and a short defense.

## Proposal A

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

## Proposal B

## Idea
Treat a pending approval as a mode of the screen, not a message in the scroll. While a card awaits approval, the decision moves out of the scroll into a tray docked directly above the composer, and the composer changes role.

## Changes
1. The pending mail card is drawn in a docked tray above the composer, full width, card fill, with Save and Send. It cannot scroll away, which solves F-duo-006 by construction.
2. In the scroll the card is replaced by a one-line history row ("Re: Pilot timeline", Needs approval) that keeps the thread readable. When the user sends, the row flips to Sent and the tray closes.
3. The composer is dimmed to a single capsule with placeholder "Ask for changes" and no trailing Send while the tray is open. Only one prominent action exists: the tray's Send.
4. No working line while the tray is open. Stop is drawn as in proposal A.
5. Working indicator is the DS-06 avatar and dots, as in proposal A.

## Costs
- The tray plus composer take about 230 pt of the 678 pt strip, leaving about 330 pt for messages, and the 466 pt strip is already crowded by the 72 pt side bar.
- The same content (subject, status) appears twice, in the history row and the tray.
- A new component with its own states (long bodies, Cc rows, MCP tool approval and Ask cards, which also pause a run).
- DS-06 card spec says cards are content in the scroll; this moves one into the floating layer and implies the glass-group count changes.

## Risks
Several pending cards at once (two agents in a group) need a queue in the tray. SwiftUI: `safeAreaInset(edge: .bottom)` stack with a conditional tray, scroll anchoring, keyboard avoidance for the tray plus composer. Highest build risk of the three.

## Proposal C

## Pattern
Apple Messages shows a pill when the thing you need is off screen (scroll to latest, jump to unread), and Mail shows the same for new mail. Linear and Things show a count only where an action is waiting and clear it when you act. The rule that carries over: show the cue only while the item is off screen, name it with the words the item already uses, and let one tap take you there.

## Idea
Keep the card where it is in the thread. Make state honest, show a jump pill only when needed, and let exactly one thing be tinted.

## Changes
1. Working line hidden while a card awaits approval (run paused, nothing working). Applies to PG-A-Thread, PH-Thread, Inner (STORY-047-R1-2, V-iphone-R1-13).
2. The agent sentence "Here is a draft. I have not sent it." is removed when a card follows (STORY-047-R1-5).
3. Pending cue: a "Needs approval" pill appears centred above the composer only while the card is out of view (below or above the visible area). It is a content-layer control, not glass: card fill #252523, 1px border #2E2D2A, 36 pt tall with a 44 pt hit area, 8 pt warning dot, "Needs approval" 13 pt/600 (the same words as the card status, so no new copy), and chevron.down or chevron.up toward the card. One tap scrolls the card to the top of the visible area with the default animation. It disappears when the card is at least half visible. VoiceOver: "Needs approval, go to draft".
4. One tinted action rule, by thread state not by scroll position: while any approval card is pending, the card's Send is the only tinted action. The composer trailing control is neutral (fill rgba(241,240,235,0.12), ink glyph), including Send when text is typed and Stop when another agent runs (group thread). Without a pending card, Send (typed) and Stop (running) are the one tinted action in the same slot. Choosing by state avoids a button that changes colour as the user scrolls.
5. Working indicator: DS-06 avatar with ring plus neutral dots pill, no text, bot colour from the shipped avatar (Legal purple #9B5CF6 on the group board). One indicator per working agent. VoiceOver "<agent> is working".
6. Stop and typing: Stop keeps the trailing slot for the whole run; typed text stays as a draft, Send returns when the run ends or is stopped. Stopping state: spinner replaces stop.fill, control disabled for up to 3 s, then the composer returns to idle. If the stop fails the control returns to stop.fill and the working indicator stays, which is the signal; no new copy.
7. Composer and pill never overlap: the pill sits 8 pt above the composer capsule and the thread's bottom inset grows by 44 pt while it is shown.

## Glass count
The pill is solid, so the strip stays at its current glass groups and adds none.

## Boards touched
PG-A-Thread, PH-Thread, PG-A-GroupThread, PG-A-ThreadStates (new row of states), DS-06-Chat (composer states, new "Pending approval pill" spec, rule text), PG-A-Rules (working and one-prominent text), README (one sentence on the tinted action).

## Cost and risk
Moderate. SwiftUI: `.onScrollVisibilityChange` (iOS 18) on the card row to drive a bool, `ScrollViewReader.scrollTo` for the jump, a conditional overlay in `safeAreaInset`. Fallback on older OS is `onAppear/onDisappear` on the lazy row. Both are native.

