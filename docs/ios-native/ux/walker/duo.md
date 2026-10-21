# UX Walk: iPhone Duo and device adaptation (round 2)

Walker: walk-duo. Date: 2026-10-20. Target: the planned native SwiftUI iPhone app (epic #427, phase 7 is #419). No Swift code exists; the boards are the app.
Scope: catalog stories STORY-098 to STORY-108 (STORY-101 merged into STORY-064) and the standard iPhone (PH-*) adaptation.

Method: every board cited was viewed as a rendered screenshot. The geometry audit ran once per board (25 boards). Every finding in `duo-findings.json` was re-checked.

## Result

48 findings: 29 resolved, 19 open (0 critical, 0 high, 4 medium, 14 low, 1 suggestion). Four are new this round (F-duo-R2-001 to 004). Round 1 had 41 open; 24 closed this round. F-duo-001 dropped from high to medium.

Open medium findings:
- F-duo-001: Duo inner, half-folded and laptop layouts are still missing for thread beside Personnel, Computer 1/2 + 1/2, Artifacts, Image, Settings and the New bot / New space sheets.
- F-duo-R2-001: PH-GroupThread header spills 17 px past the right edge.
- F-duo-R2-002: agent and bot are used for the same thing (New agent menu, New bot sheet, Archived bots, Agent settings).
- F-duo-R2-004: no standard iPhone boards for Artifacts, Settings, Account, Finance or the form sheets.

## What changed since round 1

New or rebuilt boards: Main (now the real Home), PG-A-Home (eight frames), PG-A-Activity, Split (full sidebar), Inner-Message, Desk (tabs, accounts, thread), Desk-Computer (keyboard open), PG-A-Thread (chat menu, archive, replaced draft), PG-A-ThreadStates (24 states), PG-A-Computer and PH-Computer (eight states), PH-GroupThread, PG-A-Image (menus, delete, saved), PG-B-NewBot / NewSpace / NewGroup (dimmed Create, errors), PG-B-Settings (archived bots, AI data sharing), PG-B-Account, PG-B-Spaces, PG-B-Finance (three periods, hidden amounts), DS-03 (fold survival, collapse order for every page).

## Geometry audit (one run per board, 1990x1200 viewport)

| Board | Result |
| --- | --- |
| Main, PG-A-Home, PH-Home, Split, Inner, Inner-Message, Sheet, PH-Inbox, PH-Thread, PG-A-Thread, PG-A-ThreadStates, PG-A-Computer, PH-Computer, Desk-Computer, PG-A-Image, PG-B-Settings | Uneven-row and 'wrapped control' hits are icon/text pairs, unread dots and buttons whose label is on one line in the screenshot (AB, Edit, Send, Team, Take control, Restore): false positives. No page overflow. |
| PH-GroupThread | Header spills 17 px right; confirmed in the screenshot (F-duo-R2-001). |
| PG-A-Artifacts | Chip row runs past the column; last chip cut (F-duo-039). Wrapped flags on chips are false positives. |
| Desk, PG-A-Activity, PG-A-Artifact, PG-B-NewBot, NewSpace, NewGroup, PG-B-Finance | Clean. |

## Stories

### STORY-098: Open an agent from Home and approve a request
1. Tap Finance agent or the Activity row marked 'Needs you'. Board: PG-A-Home, Main, PH-Home, PG-A-Activity. PASS. Activity is on Home, with See all and the bell opening a drawn list. Ideal 3, designed 2 (row, Send).
2. Read the thread. Board: PG-A-Thread, PH-Thread. PASS. The 'working' line no longer sits under the approval.
3. Approve. Board: PG-A-Thread. WARN: the card drawn is the mail draft (Edit / Send); the Allow once / Always allow / Deny card is on DS-06 only (F-duo-R1-003). The scrolled-away cue is drawn (resolved F-duo-006). CONFLICT and failed Send are not drawn (F-duo-007).
Flow matches the ideal.

### STORY-099: Triage mail on the outer display, then ask the Inbox agent
1. Home to Inbox. PASS. 2. Strip. Board: Sheet, PH-Inbox. PASS: Back, Search / Filter / Compose, More, prominent chat button; same on both. 3. Message. Board: Inner-Message (inner), PG-A-InboxMessage. PASS. 4 to 6. Ask and Send. Board: Inner, PG-A-Thread. PASS; the Inbox states (zero, offline, reconnect, consent) are drawn on Sheet and PH-Inbox.
Flow: ideal 5, designed 5 on both outer and standard iPhone.

### STORY-100: Unfold mid-task and keep working
1. Unfold. Board: Split (Inbox beside the sidebar), Inner. WARN: no board shows an agent thread beside the Personnel sidebar (F-duo-001). The sidebar itself is now complete (title menu, New, Activity, pages, Personnel, profile).
2 to 3. Content and toolbar. Board: Inner. PASS for Inbox agent. 4. Tap another agent. NO BOARD for the pane change.
Survival of draft, scroll and stream is specified (DS-03 section 7, resolved F-duo-002). Flow: ideal 1, designed 1.

### STORY-102: Laptop pose, watch the Team Computer and take control
1. Open computer. Board: PG-A-Thread chat menu ('Open computer'), thread computer block ('Take control') in ThreadStates. PASS.
2 to 5. Laptop pose, watch, handoff, Take control. Board: Desk-Computer, PG-A-Computer (Watching, Agent waiting with I'm done / Skip, In control). PASS. WARN: Desk-Computer draws Release as a bare icon (F-duo-R2-003).
6. Keyboard. Board: Desk-Computer. PASS (keyboard open under key bar; resolved F-duo-014).
7 to 12. Team / Private, Fit, handoff, Release. Board: PG-A-Computer, PH-Computer. PASS (Control ended, Reconnecting, Control denied, Can't connect all drawn).
13 to 15. Composer, unfold, fold. Board: none for 1/2 + 1/2 or 1/3 + 2/3 Computer (F-duo-001).
Flow: ideal 4, designed 4.

### STORY-103: Review Finance in laptop pose
1. Open Finance. Board: Desk, PG-B-Finance. PASS: tabs, Runway / Cash, 12-month burn, Accounts, Upcoming.
2. Hide amounts. Board: PG-B-Finance (masked frame), Desk (eye beside the thread header). PASS.
3. Ask. Board: Desk. PASS. Chat button is the prominent action on the outer boards. Accounts rows run under the fold band on Desk; scroll is implied.
Flow: ideal 3, designed 3.

### STORY-104: Create a bot (outer and inner)
1. New. Board: PG-A-Home 'New menu' (New agent / New group / New space). PASS; WARN on wording (F-duo-R2-002).
2 to 4. Sheet, name, Create. Board: PG-B-NewBot (empty dimmed, filled, creating, error), NewSpace, NewGroup. PASS: Create dims while Name is empty, errors inline, selection marks and '2 to 6' hint on groups.
5 to 6. Inner flat and half-fold sheet. NO BOARD (F-duo-001). Split has '+ New'.
Standard iPhone: PH-Home has a prominent New; the sheet at 393 pt is NO BOARD (F-duo-R2-004).
Flow: ideal 4, designed 4.

### STORY-105: Short outer display, More menu
Board: DS-03 (collapse order now listed for Inbox, Thread, Computer, Finance), PG-A-Thread (chat menu, archive alert, Archived banner). PASS; the reduced-height thread itself is not drawn, only specified. Flow: ideal 2, designed 2.

### STORY-106: Tap a push notification
No board for the banner (phase 10). Landing: PG-A-Home / PG-B-Spaces ('Switching to Northwind' skeleton, title shows the space). PASS for landing; the notification is not drawn.

### STORY-107: Settings on the inner display
Board: PG-B-Settings (Settings, Archived bots, AI data sharing), PG-B-Account. PASS on outer; inner nested list + detail has NO BOARD (F-duo-001). Split now has the profile row, so the entry exists.

### STORY-108: Open an artifact image and share it
Board: PG-A-Artifacts, PG-A-Artifact, PG-A-Image (menus, versions, delete confirmation, Saved to Photos). PASS: Share is the prominent button, name appears once. WARN: chip row cut at the edge (F-duo-039). Inner and standard iPhone: NO BOARD (F-duo-R2-004).

## Standard iPhone adaptation
PH-Home, PH-Thread, PH-GroupThread, PH-Inbox, PH-Computer and PH-Spaces follow the same design rules as the outer boards: one prominent action (New, Send, chat button, Take control), top bar instead of strip, title menu for spaces. Gaps: F-duo-R2-001 (group header spill), F-duo-R2-004 (other pages). Thread More, Plus and long-press menus are drawn on PH-Thread.

## Design rules check
Glass stays on bars, menus and the prominent control; content is solid. No view draws more than three glass groups plus the prominent one. Avatars use the shipped shapes. One tinted prominent action per view holds except as noted. Product name is Praci (Account 'After delete' frame).
