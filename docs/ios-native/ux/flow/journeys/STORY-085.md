# STORY-085 journey critique: the four pages on Duo, inner display and laptop pose

Target: planned native SwiftUI iPhone app (epic #427; P12 #424, P7 #419). Boards are static; each step is judged against the board that draws it. Round 1 of the gap-fix pass. Boards read (screenshots opened): `PG-B-Finance`, `PG-B-Legal`, `PG-B-CapTable`, `PG-B-DataRoom`, `PG-B-Rules`, `Desk`, `Inner`, `Split`, `PG-A-Home`, `PG-B-Spaces`.

Previous round: acceptable (20 vs 20 steps, 9 steps without a board, 1 dead end at step 16).

## What the gap-fix pass closed

- Where the four pages are reached: `Split` (inner sidebar) now lists Finance, Legal, Cap table, Data room as rows with glance values (`[N] mo`, 2), and `PG-A-Home` has a PAGES section with the same four rows. Steps 1, 7, 9, 11 and 17 now have an entry point on both displays.
- Switching space on the outer display: `PG-B-Spaces` draws the title menu. Step 20 is covered on outer only (see R1-4).

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps actual vs ideal | 20 vs 20. No extra screens. |
| Needless decisions | 0 on the happy path. Posture changes are physical. |
| Re-entry | 0. Hide amounts should persist (steps 4, 18), but no board shows where it lives (only the eye in the `PG-B-Finance` capsule and the `Desk` bottom capsule). |
| Dead ends | 1: step 16 (fold to outer with an agent thread open) still has no stated result. The rule card only says the fold area stays empty. |
| Steps with no board | Step 3 and 4 (Finance 1/3 + 2/3; `Inner` shows an Inbox thread, `Split` shows Inbox), step 5 (Finance 1/2 + 1/2), steps 7-12 (Legal, Cap table, Data room on inner and half-folded), laptop poses for Legal, Cap table, Data room (steps 8, 9, 11), steps 13-14 (file picker, upload row), step 19 (push landing), step 20 on inner. About 14 of 20 steps rest on rule-card text alone. |
| Board contradicting text | Step 6 and the Finance rule card say the laptop bottom half holds period tabs, accounts and "Ask Finance agent". `Desk` bottom half is the agent thread with a composer; there are no tabs or accounts. Top half says "Monthly spend / Last 6 months", outer says "Monthly burn" with 30 days / 90 days / 12 months. |

## 2. Take-away pass

- `PG-B-Finance`: one prominent action (pale bubble). Removable: the refresh button (refresh on open and pull to refresh). "Upcoming" is used by no step. "Accounts" source labels (Mercury agent, Brex agent) are useful, keep.
- `Desk`: no tinted prominent action; composer is plain. Two glass groups (back + agent pill, eye + "..."), within the limit. The "..." has no step that uses it. The Finance agent thread is the whole bottom half, so accounts and upcoming are not reachable in this pose.
- `PG-B-Legal`: the card "2 deadlines this week / Last scan today, 8:05 AM" repeats the Deadlines tab and the Legal agent's push text. Scan and refresh icons sit side by side and look alike.
- `PG-B-CapTable`: "Carta is connected / Reconnect" is permanent status; the rule card already defines Not connected and Expired states, so the connected line can go. The legend repeats the four holder names and percentages that the Holders list shows directly below. The plus button has no step.
- `PG-B-DataRoom`: search bar and filter button are used by no step. "Load more" is fine.
- `Split` (inner sidebar): the sidebar already shows Finance `[N] mo` and Legal 2; this is the glance, so facts are not repeated on the pages themselves.
- Facts stated twice: Legal deadline count (card, tab, agent row, sidebar badge); Cap table holders (legend and list); Finance runway (sidebar glance and KPI, acceptable since glance leads to page).

## 3. Simpler version

Same 20 steps. (1) One section list for Finance in every pose: Overview, Accounts, Burn, Upcoming; rename "Spend" and "Monthly spend" to "Burn". (2) Laptop pose for all four pages: content on top, page's agent thread with composer on the bottom (as `Desk` draws it), and move period tabs and accounts into the top half. (3) Hide the Carta connected line and the Legal scan card unless there is something to act on. (4) Drop refresh from the side capsule. (5) State once: on posture change keep the selected row and scroll; on fold to outer with a thread open, show the thread. (6) Remove Data room search and filter from the outer page until a step needs them, or keep search only.

## 4. Beauty check

- Outer pages (`PG-B-*`): glass only on the side strip, solid inset lists, one pale prominent bubble, SF-style icons, shipped bot colors on the Finance agent avatar. Passes.
- `Split`: floating sidebar glass, right capsule, bubble. Three glass groups, at the limit. Passes.
- `Desk`: glass controls sit mid-screen under the fold, which acts as a floating bar; no tinted prominent action, so the "exactly one" rule is not met. Mild.
- No board for Legal, Cap table, Data room on inner or laptop, so they cannot be checked.

## 5. Verdict

acceptable. Steps equal the ideal and the existing boards follow the rules, and the missing page entry points are now drawn. The journey still rests mostly on rule-card text, one board contradicts the rule, and one dead end remains. Nothing structural, so not convoluted.

## 6. ISSUES

- STORY-085-R1-1 (high): `Desk.dc.html`, `PG-B-Rules.dc.html`, step 6. The Finance rule card says period tabs, accounts and Ask controls are in the bottom half; `Desk` shows only the agent thread and composer, with top-half title "Monthly spend / Last 6 months" instead of "Monthly burn" with period tabs. Fix: change the rule card laptop line to "Content on top (KPIs, burn chart, period tabs), agent thread and composer below", and redraw `Desk` top half with the 30 days / 90 days / 12 months tabs and the title "Monthly burn".
- STORY-085-R1-2 (high): no board, steps 3-5 and 7-12. Finance, Legal, Cap table, Data room have no inner (1/3 + 2/3) or half-folded board, and `Inner`/`Split` show Inbox. Fix: add one inner board for Finance (sections list left, selected section right) and one for Legal (contracts left, contract detail right); the other two follow the same pattern by rule card.
- STORY-085-R1-3 (medium): no board, steps 8, 9, 11. Laptop pose for Legal, Cap table, Data room exists only as text. Fix: add a laptop board for Data room (file preview top, list and Add files below), since it is the one with an action; keep Legal and Cap table as text.
- STORY-085-R1-4 (medium): `Split.dc.html`, step 20. The inner sidebar has Search and plus at the top but no space title, so there is no way to switch space on the inner display; `PG-B-Spaces` only draws the outer menu. Fix: put the "Personal v" space title as the sidebar header on inner, opening the same menu.
- STORY-085-R1-5 (medium): `PG-B-DataRoom.dc.html`, steps 13-14. No board shows the file picker result or the upload row. Fix: draw one upload row in "Recently added" with a progress line and a failed state with "Try again".
- STORY-085-R1-6 (medium): `PG-B-Rules.dc.html`, step 16. Fold to outer with an agent thread open is still unspecified. Fix: add to Shared rules: "Fold to outer keeps the open thread; Back returns to the page you came from. Selection and scroll are kept across all posture changes."
- STORY-085-R1-7 (low): `PG-B-CapTable.dc.html`. "Carta is connected / Reconnect" is permanent chrome. Fix: show the line only when Not connected or Expired (already in the rule card).
- STORY-085-R1-8 (low): `PG-B-CapTable.dc.html`. Legend and Holders list state the same names and percentages. Fix: drop the legend text and color the holder rows with the ring swatch, or drop the percentage column from the list.
- STORY-085-R1-9 (low): `PG-B-Legal.dc.html`. The scan summary card repeats the Deadlines tab, and scan and refresh icons are near duplicates. Fix: show the card only when a scan failed or never ran; keep one "scan" icon and remove refresh.
- STORY-085-R1-10 (low): all four `PG-B-*` outer boards. The refresh icon in the side capsule is used by no step. Fix: refresh on open and pull to refresh; remove the button.
- STORY-085-R1-11 (low): `Desk.dc.html`. No tinted prominent action, and the "..." menu has no step. Fix: remove "..." (put its items, if any, in the agent header) and make the composer send button the single tinted control once text is entered.
- STORY-085-R1-12 (low): `PG-B-Finance.dc.html`, `PG-B-DataRoom.dc.html`. Upcoming (Finance) and search/filter (Data room) are used by no step. Fix: keep Upcoming only if it has rows; drop the Data room filter button.
