# UX Walk: iPhone Duo and device adaptation (round 1 re-walk)

Walker: walk-duo. Date: 2026-10-20. Target: the planned native SwiftUI iPhone app (epic #427, phase 7 is #419). No Swift code exists; the boards are the app.
Scope: catalog stories STORY-098 to STORY-108 (STORY-101 was merged into STORY-064). Standard iPhone adaptation uses the new PH-* boards.

Method: each step was judged against the board that draws it. Every board cited here was viewed as a rendered screenshot (round 1 screenshots), and the geometry audit was run live once per board at the board's own size. Every earlier finding in `duo-findings.json` was re-checked and now carries a status and note.

## Result

44 findings: 3 resolved, 41 open (4 high, 21 medium, 15 low, 1 suggestion). 5 findings are new in this round (F-duo-R1-001 to 005). F-duo-013 was downgraded from high to medium.

Resolved this round: F-duo-005 (one mail draft card, Save / Send, on every thread board), F-duo-024 (field aria-labels), F-duo-031 (space name and switcher on Home).

What the gap-fix pass changed for this topic: PG-A-Home (Pages and Activity sections, space title with menu), PG-A-Thread (Save / Send mail card), and new PH-Home, PH-Thread, PH-Inbox, PH-Computer, PH-Spaces, PG-B-Spaces, PG-A-ThreadStates, PG-A-Compose, PG-B-Account. The Duo inner, half-folded and laptop boards (Split, Inner, Desk) and DS-03 / DS-04 were not touched, so most inner-display findings stand.

## Boards by pose

| Pose | Boards that draw it |
| --- | --- |
| Outer 466x678 | Main (stale), Sheet, PG-A-*, PG-B-* |
| Standard iPhone 393x852 | PH-Home, PH-Thread, PH-Inbox, PH-Computer (810 wide, two states), PH-Spaces |
| Inner flat 890x626 | Split (Inbox only) |
| Half-folded | Inner (Inbox + Inbox agent only) |
| Laptop 626x890 | Desk (Finance only) |

Every other page has inner, half-folded and laptop layouts only as rule-card text (F-duo-001).

## Geometry audit (one run per board)

| Board | Result |
| --- | --- |
| Main, PG-A-Home, PG-B-Spaces, PH-Home, PH-Spaces | Hits are text/time pairs, unread dots, the avatar and Pages rows with chevrons: deliberate. No overflow. |
| Sheet, PH-Inbox | Unread dot beside text flagged: deliberate. |
| Split | Sidebar rows and 8 px unread dot flagged: deliberate. 'Connect apps' wrapped flag is a false positive (one line in the screenshot). Create button 30 px wide (F-duo-032). |
| Inner | Dot rows flagged; Save / Send 'wrapped' is a false positive. |
| Desk | Gap 8 / 279 is Back + pill, spacer, group: deliberate. |
| PG-A-Thread, PH-Thread, PG-A-ThreadStates | Clean (Save / Send wrapped flag is a false positive). |
| PG-A-Computer, PH-Computer | Segments and key bar flagged as 'wrapped': false positives (single-line labels). |
| PG-A-Artifacts | Chip row is 456 px in a 390 px column; last chip cut off, confirmed in screenshot (F-duo-039). |
| PG-A-Artifact, PG-A-Image, PG-B-Finance | Clean. |
| PG-B-NewBot, NewGroup, NewSpace, Settings | Clean. |
| PG-B-Account | Profile row heights flagged (avatar 48 vs text 22): deliberate, aligned centers. |
| PG-A-Compose, PG-A-HomeNoModel | Clean. |

## STORY-098: Open an agent from Home on the outer display and approve a request

1. Tap the Finance agent row. Board: PG-A-Home. PASS: Home now shows Inbox, ACTIVITY (Finance agent Working, Inbox agent Approve, Weekly runway Done), PAGES, PERSONNEL. The Activity row marked Approve is a 2-tap shortcut (row, then Allow), which is better than the 3-tap ideal. WARN: Main.dc.html still draws an older Home (F-duo-R1-001), and Activity is stated twice (bell with dot, and the section; F-duo-008).
2. Read the thread. Board: PG-A-Thread, PH-Thread. WARN: 'Inbox agent is working' sits under 'Needs approval' (F-duo-009).
3. Tap Allow. Board: PG-A-Thread. WARN: the only approval card drawn is the mail draft (Save / Send, Send prominent). The Finance Allow once / Always allow / Deny card is on DS-06 only (F-duo-R1-003). Resolved, CONFLICT and failed states: only DS-06 shows Resolved (F-duo-007).
Also: no pinned cue if the card scrolls away (F-duo-006). Activity list page: NO BOARD (F-duo-008). Standard iPhone: PH-Thread has the same card; PH-Thread has no More, so the thread actions menu has no home (F-duo-028).
Flow: ideal 3, designed 2 to 3. Matches.

## STORY-099: Triage mail on the outer display, then ask the Inbox agent

1. Tap Inbox. Board: PG-A-Home. PASS.
2. Strip. Board: Sheet. PASS: Back, Search / Filter / Compose, prominent 'Ask Inbox agent'. WARN: Split and DS-03 define a different action set (F-duo-003, F-duo-004). Standard iPhone (PH-Inbox) has Search, Filter and a prominent Compose, with no 'Ask Inbox agent' (F-duo-R1-002). PH-Inbox also draws one row mid-swipe, which reads as a bug (F-duo-R1-005).
3. Open the message. Board: PG-A-InboxMessage (not re-viewed this round).
4-6. Ask the agent and Send. Board: PG-A-Thread / Inner. PASS: same card on both. Compose and Reply: PG-A-Compose now draws New message, Reply and the Reply / Reply all / Forward title menu, which fills the earlier NO BOARD for alternate (b).
Flow: ideal 5. Designed 5 on Duo outer, 7 on standard iPhone because the agent is not reachable from the Inbox page.

## STORY-100: Unfold to the inner display mid-task

1-2. Board: Split shows the sidebar plus Inbox, not a thread. NO BOARD for a thread beside the sidebar (F-duo-001). WARN: sidebar differs between Split, DS-03, DS-04 (F-duo-010).
3. Strip moves right. Board: Split / Inner. PASS for Inbox.
4. Tap Finance agent. NO BOARD.
Rules for draft, scroll, stream, sheet after a posture change: none (F-duo-002).

## STORY-102: Laptop pose, watch the Computer and take control

1. More, Open computer. NO BOARD for the menu (F-duo-028).
2. Laptop pose. NO BOARD (Desk is Finance only; F-duo-001).
3. Overlays. Board: PG-A-Computer PASS (Team / Private, 'You have control').
4. Handoff card Skip / I'm done. NO BOARD on any board (F-duo-013).
5. Take control. Board: PH-Computer PASS on standard iPhone: Watching state has one prominent 'Take control'; In control swaps it for 'Release', with key bar. Duo outer (PG-A-Computer) still draws only the in-control state and an unlabeled lock glyph for Release (F-duo-013).
6. Keyboard in laptop pose: no layout with the keyboard open (F-duo-014).
13-14. Ask in the bottom composer, unfold: NO BOARD; session continuity unstated (F-duo-002).
Flow: ideal 4. Designed unclear on Duo.

## STORY-103: Finance in laptop pose

Board: Desk. WARN: the chart is 'Monthly spend, 6 bars' while PG-B-Finance is 'Monthly burn, 12 bars' (F-duo-016); period tabs, Accounts, Upcoming and Refresh are missing and the prominent 'Ask Finance agent' is replaced by a composer, while PG-B-Rules says they sit in the bottom half (F-duo-015). Eye icon is in the bar here and the strip group elsewhere. Chat reply under the chart reads clearly.

## STORY-104: Create a bot (outer and inner)

1. Tap New. Board: PG-A-Home / PH-Home draw the + button. NO BOARD for the New menu (F-duo-025).
2. New bot sheet. Board: PG-B-NewBot. WARN: X plus check in the strip (F-duo-019); Title and Description overlap (F-duo-020); large empty area (F-duo-021); Create not drawn disabled (F-duo-022).
3. New group. Board: PG-B-NewGroup. PASS for shipped avatar shapes (F-duo-023 partly fixed). No selection marks (F-duo-022).
4. New space. Board: PG-B-NewSpace. Error state drawn with an enabled-looking check (F-duo-022).
5-6. Inner and half-folded sheet: NO BOARD (F-duo-001, F-duo-026).

## STORY-105: Short outer display

Board: DS-03 reduced height (Inbox only). NO BOARD for a thread at 420 pt or for the collapsed prominent action (F-duo-029). The thread More menu is not drawn (F-duo-028).

## STORY-106: Tap a push notification

1-2. Banner: DS-04 toast (Finance as teal circle F, F-duo-023). Space switch: Home and PH-Home now name the space; PG-B-Spaces and PH-Spaces draw the space menu (Personal, Northwind, Side project, New space, Space settings). RESOLVED (F-duo-031).
3. Thread pushes over Home. Board: PG-A-Thread PASS.
4. Fold and unfold: NO BOARD (F-duo-002).
Space settings page (PG-B-Spaces): one confirm check, Delete space in red. Clear. Space settings confirm uses Back + check, not X + check (F-duo-019).

## STORY-107: Settings on the inner display

1. Tap the profile row. NO TARGET on Split (F-duo-011). Outer path: Home avatar (labelled Account) opens Settings (F-duo-033).
2. Nested list + detail sheet: NO BOARD (F-duo-001). Outer: PG-B-Settings PASS. The profile row says Sam Rivera, the Home avatar says AB.
Account detail: PG-B-Account now draws Account, Sign out confirmation, Delete confirmation (earlier NO BOARD filled). Models and Voice: PG-B-Models, PG-B-Voice not re-walked this round.

## STORY-108: Open an artifact image and share it

1. Artifacts list. Board: PG-A-Artifacts. WARN: chip row cut off (F-duo-039). Reached from Home by the third unlabeled strip icon (F-duo-038, F-duo-R1-004).
2. Image. Board: PG-A-Image PASS: Close, Share, Save, name pill, dimmed.
3. Share. System sheet.
Artifact page (PG-A-Artifact): Share is not prominent (F-duo-017); title repeated (F-duo-018). Inner and laptop variants: NO BOARD (F-duo-001).

## Ideal versus designed

| Story | Ideal | Designed | Note |
| --- | --- | --- | --- |
| 098 | 3 | 2 to 3 | Activity shortcut |
| 099 | 5 | 5 outer, 7 standard iPhone | F-duo-R1-002 |
| 100 | 1 | unknown | no posture rules |
| 102 | 4 | unknown on Duo | handoff card, laptop pose not drawn |
| 104 | 4 | 4 | New menu not drawn |
| 107 | 4 | unknown on inner | no profile target |

## Open findings

See `duo-findings.json` (status and status_note on every finding). High: F-duo-001, 002, 003, 015.
