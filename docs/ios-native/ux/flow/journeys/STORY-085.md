# STORY-085 journey critique: the four pages on Duo, inner display and laptop pose

Target: planned native SwiftUI iPhone app (epic #427; P12 #424, P7 #419). Boards are static, so each step is judged against the board that defines it. Boards read: `Desk`, `Inner`, `Split`, `PG-B-Finance`, `PG-B-Legal`, `PG-B-CapTable`, `PG-B-DataRoom`, `PG-B-Rules` (screenshots in the run scratchpad). Live browser use was not needed.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps actual vs ideal | 20 vs 20 (the story lists 20 steps and the ideal says 20). No extra screens. |
| Needless decisions | 0 on the happy path. Posture changes are physical, not choices. |
| Re-entry of known data | 0. Hide-amounts is meant to persist across poses (steps 4, 18); no board shows where that state lives. |
| Dead ends | 1: step 16 (fold back to outer with the agent thread open) has no defined result. Selection and scroll preservation across posture changes is "not specified" in the README. |
| Steps with no board | Steps 7-15 for Legal, Cap table, Data room on inner, half-folded and laptop pose (9 steps). Only the outer layouts exist (`PG-B-Legal/CapTable/DataRoom`) plus rule-card text. Step 5 (Finance half-folded 1/2 + 1/2) has no mockup either; `Split` shows Inbox, not Finance. Step 3 (Finance 1/3 + 2/3) has no Finance board; `Inner` shows Inbox. Steps 13-14 (file picker, upload row) and 19 (push) have no board. |
| Board that contradicts the text | Step 6 says laptop bottom half holds period tabs, accounts and "Ask Finance agent". `Desk` bottom half is the agent thread with a "Message Finance agent" composer; no tabs or accounts are visible. Top half shows "Monthly spend / Last 6 months", while outer `PG-B-Finance` shows "Monthly burn" with 30 days / 90 days / 12 months tabs. |

Verdict on steps: the design is not long-winded; it is under-specified. Most friction risk sits in the missing boards, not in the screens that exist.

## 2. Take-away pass

- Finance outer (`PG-B-Finance`): primary action is the bottom bubble (Ask Finance agent), which matches the rule card. Removable: the refresh button in the side capsule (data should refresh on open and pull-to-refresh); the 12 bars and "[AMOUNT]" label in the chart header duplicate the KPI row's cash/runway story only partly, so keep. Account rows repeat "Mercury agent", "Brex agent" under the name; this is a useful source label, keep. "Upcoming" is the only section with no use in any story step.
- Finance laptop (`Desk`): one tinted action is not obvious. The composer mic and the Finance agent pill both look like controls; no prominent button. The eye and ellipsis in a glass capsule sit inside content flow at y 492, not on a floating bar; the "Finance agent" pill and back button are also glass. That is three glass groups on a screen that otherwise follows the rules. Removable: the "..." menu if it only holds items shown elsewhere.
- Legal outer (`PG-B-Legal`): the "2 deadlines this week / Last scan today, 8:05 AM" card repeats the Deadlines tab and the Legal agent's push text ("2 deadlines due this week"). Scan and refresh both sit in the capsule; two near-identical icons (scan, refresh) are a candidate to merge. Status words are colored text with dots, which is fine.
- Cap table outer (`PG-B-CapTable`): "Carta is connected / Reconnect" is permanent status chrome. Show it only when disconnected or expired (rule card already defines the Expired state). The legend repeats holder names that appear again in the Holders list directly below; holders list percentages appear twice (legend and rows show [N]% and [N]).
- Data room outer (`PG-B-DataRoom`): "Load more" text link is acceptable. Filter button in the capsule is not used in any step. Search bar is used by no step in this story.
- Inner (`Inner`, Inbox shown as the pattern): the sidebar lists all pages and Personnel; the right capsule shows four icons (eye, star, filter, compose) with a chat bubble below as the prominent action. Four icons in one capsule is the upper end.
- Cross-surface duplicate fact: the left list section "Spend" (story step 3) vs outer "Upcoming" vs Desk "Monthly spend" vs outer "Monthly burn". One concept has three names.

## 3. Simpler version

Same 20 steps, fewer undefined moments:
1. Define one section list for Finance across all poses: Overview, Accounts, Burn, Upcoming. Rename "Spend" to match the outer page and drop "Monthly spend" in favor of "Burn" on Desk.
2. Make the laptop bottom half the same for all four pages: the page's agent thread with its composer (as `Desk` already does). Move period tabs into the top half next to the chart. This removes the contradiction between rule text and board and removes a separate set of "controls" per page.
3. Hide the Carta connection line unless it is not connected; hide the Legal scan card unless there are deadlines or a failed scan.
4. Drop the refresh button from the side capsule on all four pages; refresh on open and pull to refresh.
5. State once, for all pages: on posture change, keep the selected row and scroll position; on fold to outer with an agent thread open, show that thread (the bot wins, same as the push rule in step 19).
6. Keep the eye (hide amounts) only on Finance and Cap table, where amounts appear; Legal and Data room never need it in this story.

## 4. Beauty check

- `PG-B-Finance`, `PG-B-Legal`, `PG-B-CapTable`, `PG-B-DataRoom`: glass is limited to the side strip (back group, action group, bubble). Content is solid inset lists with consistent radius and spacing. One prominent action: the pale bubble. Follows the rules.
- `Inner`: floating sidebar is a rounded glass panel and the right strip is a capsule; the list rows are solid. The corner radius of the sidebar looks concentric with the screen. Passes.
- `Split` (Inbox, half-folded): the approval card sits as solid content, with Send as the one bright button; but the right strip capsule plus a separate round "..." button and the "Inbox agent" pill make three glass groups near the limit. Passes at the limit.
- `Desk` (Finance laptop): glass controls appear mid-screen below the fold (back, agent pill, eye and "..." capsule), which the README allows only for floating navigation; this works as a bar, but there is no tinted prominent action (composer is plain). Mild deviation from "one tinted prominent action per view".
- No board shows Legal, Cap table or Data room in inner, half-folded or laptop pose, so those cannot be checked.

## 5. Verdict

acceptable

Reason: steps equal the ideal (20/20) and the existing boards follow the glass rules, but the journey relies on 9+ steps with no board, one dead end (step 16), a rule-text/board mismatch on the laptop pose, and a few removable elements (refresh, Carta connected line, Legal scan card, Spend/Burn/Upcoming naming). Nothing structural, so not convoluted.
