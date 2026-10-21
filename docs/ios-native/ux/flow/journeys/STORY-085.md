# STORY-085 journey critique: the four pages on Duo, inner display and laptop pose

Target: planned native SwiftUI iPhone app (epic #427; P12 #424, P7 #419). Boards are static; each step is judged against the board that draws it. Round 2. Boards read (screenshots opened): `PG-B-Finance`, `PG-B-Legal`, `PG-B-CapTable`, `PG-B-DataRoom`, `PG-B-Rules`, `Desk`, `Inner`, `Split`, `PG-A-Home`, `PG-B-Spaces`.

Previous round: acceptable (R1: 20 vs 20 steps, about 14 steps resting on rule text, 1 dead end at step 16, 12 issues).

## What round 1 issues the new boards closed

- R1-1: `Desk` now draws period tabs, Runway/Cash, "Monthly burn" on top and the agent thread with composer below. The Finance rule card says the same.
- R1-4: `Split` has the "Personal v" space title as the sidebar header.
- R1-5: `PG-B-DataRoom` draws Uploading (progress, cancel) and Upload failed (Try again).
- R1-7/8/9/10/11/12: Cap table connected line and legend gone (status only when Expired or Not connected); Legal scan card only when Scanning, Not scanned or Failed; refresh icon gone from all four; Desk "..." gone; Data room filter gone; Finance omits Upcoming when empty.
- R1-3 (partly): Legal, Cap table, Data room laptop poses now state "No board on purpose" with a template and an empty-selection line.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps actual vs ideal | 19 vs 19. Step 4 (tap "Burn" in a left section list) no longer exists: the Finance rule card puts the whole page in the 2/3 pane and scrolls. Catalog steps 3-4 are stale. |
| Needless decisions | 0 on the happy path. Period tabs default to 30 days. |
| Re-entry | 0. Hide amounts persistence (steps 4, 18) is still stated nowhere. |
| Dead ends | 1: step 16, fold to outer with an agent thread open, still has no stated result (Shared rules have no state-restoration line). |
| Steps with no board | Finance 1/3 + 2/3 and 1/2 + 1/2 (steps 3, 5); Legal, Cap table, Data room inner and half-folded (steps 7-12, covered only by the `Inner`/`Split` List + detail template and rule text); laptop poses for Legal, Cap table, Data room (steps 8, 9, 11, deliberate); inner agent thread for List + detail pages (step 15); push landing (step 19). About 9 of 19, down from 14. Outer states for all four pages, upload (13-14), space switching (20, outer and `Split` header) are drawn. |
| Board contradicting text | `PG-B-Rules` Cap table card still lists "plus, refresh" and "ownership ring with legend"; board has neither. Legal card says "scan summary" always; board shows it only on scan states. Data room card says "Empty: Drop files here" (a web phrase). |

## 2. Take-away pass

- `PG-B-Finance`: one prominent action (bubble). Nothing else removable; Upcoming appears only with rows. Source labels (Mercury agent, Brex agent) earn their place. Eye shows once, in the strip.
- `Desk`: one pale send button is the only prominent control. Two glass groups (back + agent pill, eye). The eye sits in the bottom half while the figures it masks are in the top half.
- `PG-B-Legal`: scan card only when it has something to say. The strip scan icon and the "Scan now" button in the Not scanned card do the same thing; acceptable as one control plus its empty-state prompt.
- `PG-B-CapTable`: clean. "Add contact" row and sheet are used by no step but are the page's one write; keep.
- `PG-B-DataRoom`: search stays; it is the way to find a file without browsing. "Load more" is fine.
- `Split`: glance values (6 mo runway, 2 deadlines) sit on the sidebar rows only, not repeated on the pages.
- Facts stated twice: Legal deadline count (sidebar row, agent row "2 deadlines this week", Deadlines tab); acceptable, glance then detail.

## 3. Simpler version

Almost there. Remaining cuts: (1) add one Shared rules line for posture changes (keep selection, scroll, open thread; fold to outer shows the thread, Back returns to the page); (2) correct the Cap table, Legal and Data room rule cards to match the boards; (3) put the eye in the top half in laptop pose so the control sits with the figures; (4) rewrite catalog steps 3-5 to the one-pane Finance design.

## 4. Beauty check

- Outer pages: glass only on the side strip, solid inset lists, exactly one pale bubble (or Save/Add contact in sheets), SF icons, shipped Mercury/Brex marks, "Praci" not misused. Passes.
- `Split`: floating sidebar glass, right capsule, bubble: three glass groups, at the limit. Passes.
- `Desk`: concentric corners hold, one tinted action. The mid-screen glass pill and eye read as a floating bar over the fold. Passes.
- Open file frame in `PG-B-DataRoom` uses a full-width pale "Ask about this file" in place of the bubble: still one prominent action.

## 5. Verdict

acceptable. Steps equal the ideal, the outer boards are complete in every state, and most round 1 issues are closed. What remains is unspecified behavior (fold with a thread open, remembered hide-amounts, push landing) and no drawn inner Finance board. Nothing structural.

## 6. ISSUES

- STORY-085-R2-1 (medium): `PG-B-Rules.dc.html`, step 16. Fold to outer with the Data room agent thread open still has no stated result, so the persona may land on an unknown screen. Fix: add to Shared rules: "Posture changes keep selection, scroll position and the open thread. Folding to outer shows the open thread; Back returns to the page it came from."
- STORY-085-R2-2 (medium): no board, steps 3, 5, 7-12. Finance 1/3 + 2/3 and 1/2 + 1/2 are not drawn (`Split` and `Inner` show Inbox). Fix: add one frame to `Split` or a new `Inner-Finance` board: sidebar with Finance selected, 2/3 pane with tabs, tiles, chart, Accounts; Legal and the others follow the List + detail template.
- STORY-085-R2-3 (medium): `Split.dc.html`, `PG-B-Rules.dc.html`, step 15. Where "Ask Data room agent" opens on inner and half-folded is not stated for List + detail pages (`Split` has the bubble but no destination). Fix: rule line "Ask [page] agent opens the thread in the right half (half-folded) or replaces the detail pane with Back to detail (inner)".
- STORY-085-R2-4 (low): `PG-B-Rules.dc.html`. The Cap table card says "plus, refresh" and "ownership ring with legend"; Legal says "scan summary"; Data room says "Drop files here". Boards differ. Fix: Cap table "Back, Ask Carta agent; Add contact is a list row"; Legal "scan card only while scanning, failed or never scanned"; Data room "Empty: No files yet with Add files".
- STORY-085-R2-5 (low): `PG-B-Finance.dc.html`, `Desk.dc.html`, step 18. Nothing says Hide amounts persists. Fix: Finance rule line "Hide amounts is remembered on this device and in every pose".
- STORY-085-R2-6 (low): `Desk.dc.html`, step 6. The eye button sits beside the Finance agent header in the bottom half while the figures are in the top half. Fix: float the eye at the top-right of the top half.
- STORY-085-R2-7 (low): no board, step 19. Notification tap for the Legal agent has no stated landing in the boards. Fix: Shared rules line "A bot notification opens that bot's thread; Back goes to Home, not the page".
- STORY-085-R2-8 (low): `catalog.md` STORY-085 steps 3-5. Text says the left third lists "Overview, Accounts, Burn, Spend"; the rule card now has the one sidebar and a scrolling page. Fix: rewrite steps 3-5 and drop the "Spend/Upcoming" edge case.
