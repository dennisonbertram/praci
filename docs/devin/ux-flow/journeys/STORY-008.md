# STORY-008: Glance at the page and see what needs me

Verdict: **acceptable**. The core answer (dot, first tile, top two rows) is already fast. The extra weight comes from two tiles and one clock that the story never uses.

Evidence read: `docs/devin/ux-paths/catalog.md` (STORY-008, sections 7.1 and 7.2, GAP-05, 08, 15, 18, 34, 37), `docs/devin/mockup.html` lines 176-246, `mockup-v2-full.png` (Devin page region), and the existing Legal page screenshot `legal_page.png`. I did not re-render the mockup; the full-page screenshot already shows the page region at 1440 px and I relied on that plus the HTML.

## Friction Scorecard

| Measure | Result | Basis |
|---|---|---|
| Steps, actual vs Ideal | 2 vs 2 (click sidebar link, read tile and top rows). The catalog lists 5 steps, but steps 1 and 5 are "see the dot" and "decide", not actions. | Catalog STORY-008 Ideal path and Steps |
| Needless decisions | 0 forced. One optional reading choice: the user can stop at the dot, at the tile, or at the rows. | Mockup |
| Re-entry | 0. | Mockup |
| Confirmations | 0. | Mockup |
| Dead ends | 0 on the happy path. Two undrawn states: zero needs-you (GAP-15) and a hidden page that still raises a dot (GAP-37). | Catalog Variations |
| Hesitation points | 2. (1) "ACUs this week 41.6" has no definition and no window (GAP-18, suspected; the catalog says Maya hesitates, I cannot measure it). (2) Two clocks: header "Updated 1m ago" and a per-row "Updated" column (GAP-34). | Mockup `meta` span at line 181; `Updated` column header at line 197 |
| Needs-you signals for one fact | 6 surfaces in the mockup: sidebar dot, Needs you tile, two Needs you badges, two question subtitles, and the docked chat answer "Two sessions are waiting for you". | `mockup-v2-full.png` |

## Take-away Pass

The page is one screen at 1440 px. Everything is visible without scrolling, so removal is about attention, not space.

| Element | If removed, can the user still answer "what needs me?" | Verdict |
|---|---|---|
| Sidebar dot | Yes, but it is the only signal that works without opening the page. | Keep. It is the glance. |
| Needs you tile | Yes, the rows carry the same fact. It is the biggest number on the page and it matches the dot, so it works as a confirmation for 2 seconds. | Keep, and make it the only tile that carries emphasis. |
| Working tile | Yes. Nothing in STORY-008 or STORY-010 uses it. Working rows sit directly below the Needs you rows. | Removable. |
| PRs open tile | Yes. The Pull request column shows the same PRs, and the catalog already marks this duplicate (section 7.2, "Open PRs"). It also counts only the fetched rows (GAP-18, GAP-16). | Remove. |
| ACUs this week tile | Yes. It answers a cost question, not "what needs me?". It needs a window, a time zone and a definition (GAP-18), and its per-session source can miscount across weeks. | Remove from this page. Cost belongs to STORY-030 or Devin itself. |
| Header "Updated 1m ago" | Yes. | Remove unless the data is older than a few minutes (GAP-34). |
| Per-row "Updated" column | Yes for needs-you, since "12m ago" tells how long Devin has been waiting. That is the one useful time on the page. | Keep, but see Clarity Issues: the label should say what the time means. |
| "ACUs" column (per row) | Yes. Same jargon as the tile. | Remove with the tile, or collapse to a tooltip. |
| "From" column | Yes for this story. Useful for deciding who to ask (Slack vs Linear). | Keep; low weight already. |
| Docked chat | Yes. It repeats the table: the sample "What is Devin stuck on?" returns what the first two rows already show (catalog 7.1 and 7.3 say the same). | Keep as an optional panel, closed by default (GAP-29, decision 12). Do not use this question as the demo. |

Consistency note (suspected, not measured): `legal_page.png` shows the same 4-tile row, so a team might keep four tiles for visual consistency. That is a reason to keep the row of tiles, not a reason to keep tiles that do not help the story. A single-purpose row of two tiles (Needs you, Working) or one tile still matches the page family.

One primary action: the page has no primary action on the happy path, which is correct for a status page. The visually loudest element is the large "2" in the Needs you tile, which is the right one. However all four tiles share the same weight (measured from the screenshot: same size, same type, no accent), so the signal is not stronger than "PRs open 3" or "ACUs 41.6". That is emphasis spread evenly, so none stands out.

Information repeated: the question text appears in the row subtitle and again in the chat answer (only when the user asks). Needs-you count appears in the dot, tile and rows. The dot and tile agreeing is intentional; the risk is that they disagree (GAP-05, GAP-08).

## The Simpler Version

1. Keep the sidebar dot as the first glance. Drive it from the live needs-you count, not unseen notifications (GAP-05).
2. Page header: "Devin", the Ask button, and the Open Devin icon. Show "Updated" only when the data is stale (GAP-34).
3. One tile row of two: Needs you (emphasised) and Working. Drop PRs open and ACUs this week. If the team wants cost visible, put weekly ACUs behind a tooltip on the header or leave it to Devin.
4. Table sorted Needs you first, then Working, then the rest, then newest first (GAP-17). Keep the Needs you question on the row.
5. Zero state: Needs you tile reads 0 and no badges; the dot disappears (GAP-15).

Steps for the user stay at 2. What changes is that the page has fewer numbers to read and the one that matters is easier to find. Removing two tiles also removes GAP-18 and most of GAP-16's effect on tile accuracy.

Open point that a critic cannot settle: the group order in the mockup puts Error below Finished (rows 5-8). Someone glancing for "what needs me" may also want Error near the top, since it also needs a human. The catalog says only Needs you notifies (GAP-42), so the order is a product decision. I flag it, I do not recommend a change.

## Clarity Issues

| Issue | Evidence | Suggestion |
|---|---|---|
| "ACUs" is Devin's unit and means nothing to a founder | Tile at `mockup.html` line 192, column header line 197; catalog Edge Cases | Remove, or write "Devin credits" if it stays |
| "Updated" header and "Updated" column mean different clocks (Rakazo fetch time vs Devin session time) | `mockup.html` lines 181 and 197; GAP-34 | One clock. The column can read "Last activity" if it stays |
| "Pull request" column header, "PRs open" tile: two names for one thing in one view | `mockup.html` lines 191 and 197 | Moot if the tile goes |
| "Needs you" is clear and matches the dot title "2 need you" | `mockup.html` line 169 | Keep. Small mismatch: dot says "need you", tile says "Needs you"; that is grammar agreement, not a naming conflict |
| Page title "Devin" is also the sidebar label, the product name and the bot name ("Devin agent") | `mockup-v2-full.png` | Acceptable; the same pattern exists for other pages |
