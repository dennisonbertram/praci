# Visual findings, round 1: pages (14 boards)

Method: each board captured at its own size (Desk 626x890, others 466x678), looked at, layout and geometry audits saved in `audit.json`, second opinion in `second-opinion.json` (muse and argon findings; each checked against the screenshot). Shots are in `shots/` (scratch, not committed). Audit notes: off-scale spacing (3, 5, 6, 10, 14) appears on every board; "small target" hits on the text inputs are the inner input element inside a 44 pt-high row, so they are not counted. The Computer "Team" 1.02 contrast hit is a glass false positive (dark text on a light pill is legible).

Tags: [own] my reading, [muse]/[argon] second opinion, verified against the screenshot.

| id | level | board | element | problem | norm violated | evidence | severity | found by | verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-pages-R1-1 | screen | PG-A-AgentPage | Cash chart vs summary sentence | Orange line rises left to right with no axis or dates, while the text under it says "Cash fell in the last 30 days". The reader cannot tell which is true. | C2, C3, H5 | shots/PG-A-AgentPage.png | P0 | own, muse | yes |
| V-pages-R1-2 | screen | PG-A-Routine | whole page | A routine has no Run now, Pause, Edit schedule or Edit prompt. Rail holds only back and chat, so the user cannot act on what they read. | L7, C3, H1 | shots/PG-A-Routine.png; no "Run now"/"Pause" in board source | P1 | own, muse, argon | yes |
| V-pages-R1-3 | component | PG-B-Finance | "30 days" range vs Monthly burn chart | Range says 30 days but the chart shows 12 unlabeled bars (aria-label "12 months"), one white bar unexplained, no values. User cannot tell what spiked or whether the range applies. | C3, H4, C1 | shots/PG-B-Finance.png | P1 | own, muse, argon | yes |
| V-pages-R1-4 | component | PG-B-CapTable | "Reconnect" link | Shown beside "Carta is connected". Reconnect reads as a warning, is underlined web-style text about 14 pt tall. | C3, T1 (44 pt), iOS pattern | shots/PG-B-CapTable.png | P1 | own, muse, argon | yes |
| V-pages-R1-5 | group | PG-A-AgentPage, PG-A-AgentList, PG-A-Routine | top glass pill | Pill is the bot name above an H1 on AgentPage, but is the page title on Checklist and Routine. Same slot, three meanings. | H5, C1 | shots/PG-A-AgentPage.png, PG-A-AgentList.png, PG-A-Routine.png | P1 | argon, own | yes |
| V-pages-R1-6 | component | PG-B-BotSettings | "Could not save bot" | Red error sits under Advanced, far from the save check, with no cause and no Retry. Title and Description also read alike. | C3, L7, C1 | shots/PG-B-BotSettings.png | P1 | own, muse, argon | yes |
| V-pages-R1-7 | component | PG-A-Computer | bottom-left open-padlock button | The one primary action is an open padlock (aria "Release") beside "You have control". Padlock convention is lock/unlock, so it is unclear whether it takes, keeps or gives up control. | C1, H1, iOS pattern | shots/PG-A-Computer.png; aria-label "Release" | P1 | own, muse | yes |
| V-pages-R1-8 | screen | PG-A-Artifact vs PG-A-AgentPage | "Runway summary" | Same title, different content and chrome (3 tiles + chart vs 2 tiles + rows + version pager). User cannot tell it is one page. | H5, C2 | shots/PG-A-Artifact.png, PG-A-AgentPage.png | P2 | muse, argon, own | yes |
| V-pages-R1-9 | component | PG-A-Artifact | pill and card heading | "Runway summary" appears in the top pill and again as the card title. | C2 | shots/PG-A-Artifact.png | P2 | own, argon | yes |
| V-pages-R1-10 | component | PG-A-Artifact | layers icon and "v5 of 5" pager | Layers glyph has no clear meaning and overlaps the version pager. Pager chevrons are small and dim. | C1, T1 | shots/PG-A-Artifact.png | P2 | own, argon | yes |
| V-pages-R1-11 | group | PG-A-AgentList | chat access | Chat is in the rail pill here, but is the bottom-left light button on Finance, Cap table, AgentPage, Routine. Position memory breaks. | H5, L7 | shots/PG-A-AgentList.png vs PG-A-AgentPage.png | P2 | own, muse, argon | yes |
| V-pages-R1-12 | screen | PG-A-AgentList | checklist order and progress | Done items sit on top, open items below, no "2 of 5" count. The next task is not the first row. | L7, C3 | shots/PG-A-AgentList.png | P2 | own, muse | yes |
| V-pages-R1-13 | group | PG-B-CapTable | donut legend + Holders list | Same four names twice ([N]% then [N]). Legend grays for Option pool, Seed investors and Advisors are near identical. | C2, H4 | shots/PG-B-CapTable.png | P2 | own, muse, argon | yes |
| V-pages-R1-14 | component | PG-B-CapTable | "+" in rail | Unlabeled plus on a read-only Carta view; could mean add holder, round or share. | C1, C3 | shots/PG-B-CapTable.png | P2 | own, muse | yes |
| V-pages-R1-15 | component | PG-B-DataRoom | "Load more" | Underlined web link in the list; iOS uses pagination on scroll or a full-width button row. | iOS pattern, H5 | shots/PG-B-DataRoom.png | P2 | own | yes |
| V-pages-R1-16 | group | PG-A-Artifacts | row metadata | "Finance agent · Markdown · v5" and "HTML" are jargon for a founder; the type is already shown by the icon. | C1, D5 | shots/PG-A-Artifacts.png | P2 | own | yes |
| V-pages-R1-17 | screen | Desk vs PG-B-Finance | spend chart | Desk: "Monthly spend", 6 labeled bars, "Last 6 months". Phone board: "Monthly burn", 12 unlabeled bars. Same concept drawn two ways; Desk also drops Accounts and Upcoming. | H5, C1 | shots/Desk.png, PG-B-Finance.png | P2 | own | yes |
| V-pages-R1-18 | group | PG-B-Finance | Upcoming bills | Bills look static (no chevron, no due emphasis) though they are what needs action; accounts above have chevrons. | H2, H5 | shots/PG-B-Finance.png | P2 | own, argon | yes |
| V-pages-R1-19 | group | Legal, Data room, Artifacts vs Finance, Cap table | row chevrons | Tappable rows show a chevron on some pages and not on others. | H5 | shots/PG-B-Legal.png, PG-B-DataRoom.png, PG-A-Artifacts.png | P2 | own | yes |
| V-pages-R1-20 | component | PG-B-BotSettings | Color swatches | Dots about 34 pt, below 44 pt, packed left with an empty right third; nothing says what the color changes. | T1, D2 | shots/PG-B-BotSettings.png | P2 | own, muse | yes |
| V-pages-R1-21 | screen | PG-A-Computer | status and content | Segmented "Team" and the padlock button are both the brightest fills (two focal points); the shared screen has no window or app name so the user cannot say what they control. | H1, C3 | shots/PG-A-Computer.png | P2 | argon, own | yes |
| V-pages-R1-22 | component | PG-B-GroupSettings | check glyph | Same checkmark means "member selected" in rows and "save" in the bottom button. | C1, H5 | shots/PG-B-GroupSettings.png | P3 | own | yes |
| V-pages-R1-23 | component | PG-B-GroupSettings | "3 of 4 bots can post" | Footer repeats what the checkmarks show. Delete group sits about 12 pt under the list. | C2, D4 | shots/PG-B-GroupSettings.png | P3 | own | yes |
| V-pages-R1-24 | component | PG-A-Routine | "PROMPT" header | All caps, while every other section header is sentence case. | H5 | shots/PG-A-Routine.png | P3 | own, argon | yes |
| V-pages-R1-25 | group | PG-A-Computer | key bar | Arrow order is left, down, up, right; usual row order is left, up, down, right. No letters, Return or paste, so the bar only covers shortcuts. | iOS pattern, C3 | shots/PG-A-Computer.png | P3 | own, muse | yes |
| V-pages-R1-26 | screen | PG-A-Image | viewer | Gray backdrop where iOS photo viewers use black; image runs flush to the screen edge; the second rail icon (photo) has no clear meaning. | iOS pattern, C1 | shots/PG-A-Image.png | P3 | own | yes |
| V-pages-R1-27 | screen | PG-B-Finance | freshness | Refresh button but no "Updated" time (Legal shows "Last scan today"). | H5, C3 | shots/PG-B-Finance.png | P3 | own | yes |
| V-pages-R1-28 | screen | PG-B-DataRoom vs PG-A-Artifacts | search | Data room shows an inline search field; Artifacts hides search behind a rail icon. | H5 | shots/PG-B-DataRoom.png, PG-A-Artifacts.png | P3 | own | yes |
| V-pages-R1-29 | all | all 14 | spacing | Audits find off-scale values 3, 5, 6, 10, 14 on every board. | D3 | audit.json | P3 | own | yes |

## Rejected second-opinion claims

- Computer is P0 because the shared screen is unreadable: it is a skeleton placeholder in a mockup; kept only as the missing app name (V-21).
- Finance agent orange triangle reads as a hazard: it is the shipped avatar shape, so not changed.
- Bot settings save error as P0: it is an error state on a mockup with a visible form; P1.
- Key bar corner "pinch" and 26 pt vs 20 pt metric baseline mismatch: not confirmed at this scale.

## Excellent as is

- Legal contract rows: status dot plus word, color used only for meaning, clear two-line rows.
- Data room list: file type, owner and date legible, folders and files distinct, search first.
- Artifacts filter chips and rows: clear scan order, dates right-aligned.
- Group settings member list: shipped avatar shapes and colors, selection is easy to read.
- Rail structure: back at top, page actions in a second capsule, at most three glass groups, solid content.
- Desk: concentric glass pill, solid bubbles, composer reachable.

## Counts

P0 1, P1 6, P2 14, P3 8 (29 total).
