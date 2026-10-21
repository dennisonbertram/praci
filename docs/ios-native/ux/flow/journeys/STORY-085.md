# STORY-085 journey critique: the four pages on Duo, inner display and laptop pose

Target: planned native SwiftUI iPhone app (epic #427; P12 #424, P7 #419). Boards are static; each step is judged against the board that draws it. Round 3. Boards read (screenshots opened): `PG-B-Finance`, `PG-B-Legal`, `PG-B-CapTable`, `PG-B-DataRoom`, `PG-B-Rules`, `Desk`, `Desk-Computer`, `Inner`, `Split`, `PG-A-Home`, `PG-B-Spaces`, `PG-A-ThreadStates`.

Previous round: acceptable (R2: 19 vs 19 steps, about 9 steps with no board, 1 dead end, 8 issues).

## What round 2 issues the new boards and rules closed

- R2-1 (fold with a thread open): Shared rules now say posture changes keep selection, scroll and thread; folding to outer shows the thread, Back returns to the page.
- R2-2 (partly): `Split` draws Finance at 1/3 + 2/3 and `Inner` draws Finance half-folded 1/2 + 1/2. Legal, Cap table and Data room are still undrawn on inner.
- R2-3: `Split` draws "Back to Finance" above the Finance agent thread; the Shared rule describes both postures.
- R2-5: `PG-B-Finance` frame caption: "remembered on this device and in every pose".
- R2-6: `Desk` puts the eye at the top right of the top half, beside the title.
- R2-7: Shared rule: a bot notification opens that bot's thread and Back goes to Home.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps actual vs ideal | 19 vs 19 on the happy path. Legal, Cap table and Data room from Home outer cost one extra scroll each (PAGES sits under 12 rows). Finance is visible without scrolling. |
| Needless decisions | 0. Finance opens on "latest month" with no period choice. |
| Re-entry | 0. |
| Dead ends | 0 stated. One unreachable control: Hide amounts in the half-folded Finance frame (see R3-1). |
| Steps with no board | Legal, Cap table, Data room at 1/3 + 2/3 and 1/2 + 1/2 (steps 7-12, template only); laptop poses for those three (deliberate, "No board on purpose"); Data room folder contents after tapping "Board materials" (step 12, outer); inner agent thread for those three (step 15, rule only). About 7 of 19, down from 9. Finance inner, half-folded, laptop, outer states, upload, sheets, space switching are drawn. |
| Board contradicting text | `PG-B-Rules` Finance says "no period control"; `Inner` half-folded Finance draws 30 days / 90 days / 12 months. Legal rule puts Scan now in the strip; board puts Scan in a content row. Cap table rule says "Add contact"; board toolbar and sheet say "Add holder". |

## 2. Take-away pass

- `PG-B-Finance`: one prominent action (bubble). Nothing removable. "Synced [TIME]" under the title is shown in every state; it is the only place freshness appears, keep.
- `Desk`: one pale send button. Eye in the top half beside the figures. Clean.
- `PG-B-Legal`: scan row ("Last scanned [TIME]" + Scan) is always present in Contracts and Deadlines. It repeats the Scan control that the rule card says lives in the strip. Keep one: the row (it carries the status), drop the strip mention.
- `PG-B-CapTable`: clean; "+" in the strip is the page's one write.
- `PG-B-DataRoom`: search, Recently added, Load more; "+" menu Files / Photos. Nothing removable.
- `Split`: glance values on sidebar rows (6 mo runway, 2 deadlines) are not repeated on pages. Fine.
- Facts stated twice: Legal "2 deadlines" (sidebar row, agent row "2 deadlines this week", Deadlines tab); acceptable, glance then detail.

## 3. Simpler version

Almost the same. Remaining cuts: make Finance's period control consistent (either none everywhere, or tabs everywhere); keep Hide amounts reachable in the half-folded pose; align the three rule cards with the boards; draw one inner List + detail frame for Legal (the other two follow) and the Data room folder frame.

## 4. Beauty check

- Outer pages: glass only on the side strip, solid inset lists, one pale bubble (or Save in sheets), SF icons, shipped Mercury/Brex marks, "Praci" not misused. Passes.
- `Split`: floating sidebar glass, right capsule, bubble: three glass groups, at the limit. Passes.
- `Desk` and `Desk-Computer`: concentric corners hold; one tinted action (send, or Release control / I'm done). Passes.
- `Inner` Finance half-folded: capsule holds doc and list icons only, no eye; see R3-1.

## 5. Verdict

acceptable. Steps equal the ideal, the round 2 behavior gaps are closed by rules, and Finance is drawn in every posture. What remains is one contradiction between boards (period tabs), one missing control (eye in half-folded), rule text that disagrees with three boards, and no inner frames for Legal, Cap table and Data room.

## 6. ISSUES

- STORY-085-R3-1 (medium): `Inner.dc.html` (Finance half-folded), step 5/18. The right capsule shows only the doc and list icons; the eye that hides amounts is absent, so a persona who half-folds cannot mask the figures on the left. Fix: add the eye as the first icon in the capsule of the Finance half-folded frame (same as `Split` and `Desk`).
- STORY-085-R3-2 (medium): `Inner.dc.html`, `PG-B-Finance.dc.html`, `Split.dc.html`, `PG-B-Rules.dc.html`, step 3/5. Half-folded Finance draws period tabs (30 days, 90 days, 12 months) and the chart title "Monthly burn"; outer, Split and Desk draw no period control and title "Monthly burn, 12 months"; the rule card says "no period control". Fix: remove the tabs from the `Inner` frame and title the chart "Monthly burn, 12 months".
- STORY-085-R3-3 (medium): no board, steps 7-12 and 15. Legal, Cap table, Data room at 1/3 + 2/3 and 1/2 + 1/2 are still template text only. Fix: add one `Split` frame, "Legal, 1/3 + 2/3", with Legal selected in the sidebar, contract list in the middle with Scan row, and the selected contract detail on the right; note the other two follow it.
- STORY-085-R3-4 (low): `PG-B-DataRoom.dc.html`, step 12. Tapping the folder "Board materials" has no drawn result (the board shows only the root list and an open file). Fix: add a frame "Folder: Board materials" with title, items list, Back to Data room, and "+" adding into that folder.
- STORY-085-R3-5 (low): `PG-B-Rules.dc.html`, `PG-B-Legal.dc.html`. The Legal card puts Scan now in the strip action group; the board shows Back only in the strip and a "Last scanned / Scan" row in the content. Fix: change the card to "Back, Ask Legal agent; scan status row in the content with Scan, Scan now, Cancel, Try again".
- STORY-085-R3-6 (low): `PG-B-Rules.dc.html`, `PG-B-CapTable.dc.html`. The Cap table card says "Add contact"; the board strip "+" opens a sheet titled "Add holder". Fix: use "Add holder" in the card (accessible name for "+", sheet title, Save).
- STORY-085-R3-7 (low): `PG-A-Home.dc.html`, steps 1, 7, 9, 11. In the default Home frame only Finance is fully visible; Legal is clipped and Cap table and Data room need a scroll past Activity, Inbox and four agents. Fix: collapse Activity to its two newest rows when more than two are Done, or keep PAGES pinned as a compact row above Personnel (one board frame to confirm).
- STORY-085-R3-8 (low): `catalog.md` STORY-085 steps 1, 3-5. Step 1 lists "period tabs"; Finance has none on outer or Split. Fix: rewrite step 1 as "Runway now and Cash today tiles, burn chart, Accounts, Upcoming only when it has rows" and step 3 to the one-pane design.
