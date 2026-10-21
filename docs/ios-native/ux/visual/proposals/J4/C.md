# J4 proposal C: contextual jump pill (Messages and Mail pattern)

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
