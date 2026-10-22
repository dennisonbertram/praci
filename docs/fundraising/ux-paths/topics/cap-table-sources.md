# Topic: Cap table sources (Investors page)

Round 4. Updated against the plan after round 3 (`docs/fundraising/README.md`, "Cap table sources", slices 1, 3, 4, 9) and the 50-view mockup (`docs/fundraising/mockup.html`, view ids such as `#inv-native`, `#inv-notsaved`, `#inv-changed`, `#inv-nosnap`, `#inv-native-menu`). Planned feature; every label is from the plan or mockup. All names and figures are invented. Gap tags: `PG-nn` is a round-1 gap still open; `NG-nn` is a gap from round 2, 3 or 4 that is still open (see `../catalog.md`, "Plan gaps (round 4)"). Gaps that earlier rounds resolved carry no tag.

## STORY-101: Cap Table becomes Investors (rename, redirect, hidden page)
**Type**: short
**Topic**: Cap table sources
**Persona**: Dana, seed-stage founder who bookmarked the Cap Table page and hid two sidebar pages
**Goal**: Land on the renamed Investors page from an old bookmark, with sidebar preferences intact
**Preconditions**: Slice 1 shipped. Dana's `hiddenPages` contained `cap-table` before the migration. The Carta agent has an unseen notification.
**Ideal path**: 1 (open the bookmark; the redirect does the rest)
**Alternate paths**: Click "Investors" in the sidebar; command palette ("cap table", "equity", "ownership", "Carta" all match Investors); click the notification.
### Steps
1. Open the bookmark `/app/cap-table?kind=auditor` → `<Navigate>` lands on `/app/investors?kind=auditor`; the query is kept and the Auditors tab is selected.
2. Read the sidebar → the row says "Investors" (`sidebar-investors`) and is active. Because the migration turned the hidden key `cap-table` into `investors`, Dana's row is hidden, but the page still opened by URL.
3. Read the page → heading "Investors", the same data as before, nothing extra: the plan shows no notice about the rename.
4. Scroll to Documents → the section is the Data room folder Finance / Cap Table (folder name kept so old files stay), so Dana's old files are present.
5. Click the Carta agent's notification → lands on Investors.
### Variations
- `/app/cap-table?kind=shareholder` or `kind=options` → lands on Investors with no tab filter.
- `/app/cap-table/anything` → falls through the `/app/cap-table/*` redirect to Investors.
### Edge Cases
- Dana hid the old page, so "Fundraising" is not hidden: it shows in the sidebar below a hidden Investors row. [plan silent: whether Fundraising defaults to hidden for users who hid Cap Table (PG-04)]
- Old e2e and screenshot names change (`cap-table` to `investors`); not user-visible.

## STORY-102: Empty page, choose a source
**Type**: medium
**Topic**: Cap table sources
**Persona**: Priya, solo pre-seed founder who tracks ownership in a Google Sheet and has never used Carta
**Goal**: Get from a blank Investors page to a cap table by picking a source
**Preconditions**: New space; no Carta, no Drive connection; no snapshot; no contacts. Investors agent not yet created.
**Ideal path**: 3 (open Investors, click "Use a Google Sheet", pick the file; the read is automatic)
**Alternate paths**: "Type it in" (STORY-104); "Connect Carta"; the header Ask button to have the agent explain the choice.
### Steps
1. Click "Investors" in the sidebar → Empty view (mockup `#empty`): header with the title and an outline "Ask" button only (no Add contact, no Hide amounts), the sidebar row highlighted, then three equal buttons in this order: "Connect Carta", "Use a Google Sheet", "Type it in". None is filled. The first visit creates the Investors agent and a bot row "Investors agent" appears under Bots.
2. Read the three buttons → no helper copy under them; that is the decision, and Ask is the way to get an explanation.
3. Click "Use a Google Sheet" → no Drive connection, so the page shows "Connect Google Drive". [plan silent: whether sign-in happens in place or sends Priya to Integrations, and whether the picker reopens by itself after connecting (PG-25)]
4. Finish the Google sign-in → the Drive picker (from `ImportFromDrive`) lists her sheets.
5. Pick "Cap table 2026" → `investors.useSheet` queues one Investors agent run; the source line becomes the disabled button "Reading sheet…" (`#inv-reading`; the plan says this also holds for the very first read). [plan silent: what the body shows below the line while there is no snapshot; the three source buttons may still be clickable (PG-23, remainder)]
6. The run calls `cap_table_update` with source sheet → the source line reads "Sheet · as of Sep 30"; the two figures, ownership bar, holdings table, and the other sections appear; Hide amounts, Add contact and Ask are now in the header.
7. Open the source menu → Refresh, Change source. (No Undo: there was no earlier version.)
### Variations
- No model configured for the agent: the needs-model state is shown as it is for Carta today.
- Priya opens Ask first: the panel opens in the empty view and the agent explains Carta, Sheet and Type it in.
### Edge Cases
- Priya closes the picker without choosing → stays on the Empty view.
- The Investors agent is being created and Ask is slow to open. [plan silent: first-visit creation latency and suggestion chips (PG-10)]

## STORY-103: Sheet read fails, old table stays
**Type**: medium
**Topic**: Cap table sources
**Persona**: Marcus, founder whose cap table is on the second tab of a Google Sheet with merged header cells; he currently has a typed-in table
**Goal**: Understand why the sheet did not load and fix it
**Preconditions**: Typed-in snapshot "as of Sep 30"; Drive connected; the sheet "Foundry cap table" holds the holders on tab two (Drive exports the first tab only).
**Ideal path**: 5 (Change source, pick the sheet, see the failure, fix the tab, Refresh)
**Alternate paths**: Stay on the typed-in table; Ask the agent what it could not read; Undo the switch.
### Steps
1. Open the source menu (button "Typed in · as of Sep 30") → Refresh, Change source. Choose Change source, then Google Sheet, then pick "Foundry cap table". The snapshot's data is copied to `previous` before the read.
2. Read the header → "Reading sheet…" (disabled).
3. The run ends without a newer snapshot → the typed-in table underneath is unchanged and `source` stays Typed in, because it changes only after the first successful read. The line keeps the label of the data shown, "Typed in · as of Sep 30", in the warning color.
4. Open the source menu → its first item reads "Last read failed · Try again"; then Refresh, Change source, Undo. Marcus clicks Ask → the agent's chat says what it could not read ("I only saw the first tab"). The first-tab rule appears only here. [plan silent: any warning before the failure, and truncation, partial parse or a deleted sheet (PG-24, skipped in round 3: reported in chat)]
5. Marcus moves the table to the first tab in Sheets, returns, chooses Refresh → "Reading sheet…", then "Sheet · as of Dec 1" and the new rows.
### Variations
- First ever read fails with no snapshot at all: no source line, one sentence "The sheet could not be read." with Try again and Type it in under it (`#inv-nosnap`).
- Marcus chooses Undo instead → the typed-in table is the source again ("Typed in · as of Sep 30"); a read result that arrives after Undo is discarded.
### Edge Cases
- Refresh is disabled while the run is active, so two clicks start one run.
- The run ends but a newer snapshot exists from another writer: the failure flag is computed from the run's `createdAt` against the snapshot's `updatedAt`, so it clears.

## STORY-104: Type it in, build the cap table by hand
**Type**: long
**Topic**: Cap table sources
**Persona**: Tomas, two-founder pre-seed company with no Carta and no spreadsheet
**Goal**: Enter founders, an investor and an option pool, and see fully diluted percentages
**Preconditions**: Empty Investors page; slice 3 shipped.
**Ideal path**: 9 (Type it in, then one row of four cells each for four holders plus the pool)
**Alternate paths**: Start from the source menu, Change source, Typed in. The agent cannot type rows (`cap_table_update` only on a sheet-read run).
### Steps
1. Click "Type it in" on the Empty view → the page becomes the editor in place (`#inv-native`): source line "Typed in · as of Oct 20" (as-of is the last edit), company name defaults to the space name, a table of rows with Holder, Security, Shares, Invested, Fully diluted, and one blank row at the bottom with the placeholder "Add holder".
2. Type "Tomas Reyes" in Holder, leave Security on its default Common, type 4,000,000 in Shares and tab out → the row autosaves on blur as one per-row save (the row has a stable id and a `rev`); "Saved" shows in the Cap table card header; a new blank row stays at the bottom. [plan silent: whether a row with a name and no shares saves, and whether blur fires on each cell or on leaving the row (NG-50)]
3. Add "Alma Reyes", Common, 3,500,000 → second row saved.
4. Type 1,000,000 into the fixed row "Option pool (unallocated)" (Pool shares) → counted in fully diluted; the bar shows a hatched pool segment. The pool row has no "…" menu.
5. Add "Harbor Angels", Security Preferred, Shares 500,000, Invested $250,000 → no contact has that name, so the row's "…" menu offers Add as contact; choosing it asks for an email and creates an investor contact. Once a contact has that name, the holder links to it.
6. Open the Security dropdown → Common, Preferred, Option, Other, plus any name copied from a previous table (for example Seed Preferred). There is no SAFE choice; SAFEs are entered on Fundraising only.
7. Read the figures → "Fully diluted" is the holdings' share count; "Equity raised" is the sum of the Invested column ($250,000); percents add to exactly 100.0 and the bar matches.
8. Open the source menu (`#inv-native-menu`) → Change source (Refresh has nothing to read; Undo only after a switch).
9. Reload the page → rows persist and the editor is still in place (it is always editable, with no Edit toggle).
### Variations
- Type "12abc" or a negative number in Shares → the input is outlined and the value is not saved. A row left blank is ignored, and two holders may share a name.
- Typo row: open the row's "…" menu and choose Delete holder; deleting the last row leaves the blank "Add holder" row.
- On a 390 px phone each typed-in row is stacked as label and value pairs (Security, Shares, Invested), every value full width, the pool row only its shares; every tappable element is at least 44 px tall (`mock-inv-native-phone.png`).
### Edge Cases
- Leaving mid-row: nothing to confirm, because rows save on blur (a failed save is STORY-113).
- Hide amounts on: the Invested inputs are masked.
- A zero-money table (founders only): Equity raised shows no money. [plan silent: the figure and bar presentation (PG-18)]

## STORY-105: Switching source keeps one version back
**Type**: long
**Topic**: Cap table sources
**Persona**: Tomas (STORY-104), six months later, raising a seed and now paying for Carta
**Goal**: Replace the typed-in table with Carta's and be able to get it back
**Preconditions**: Typed-in snapshot with six rows. Carta account exists but is not connected.
**Ideal path**: 5 (menu, Change source, Carta, sign in, read finishes)
**Alternate paths**: Change source to a Google Sheet; Undo (STORY-110).
### Steps
1. Open the source menu on "Typed in · as of Oct 20" → Change source → Carta. Carta is not connected, so the sign-in dialog opens (the same in-place pattern as today's `ConnectCartaDialog`).
2. Sign in to Carta → dialog closes. There is no confirm dialog. The typed-in data is copied to `previous`. The line shows Carta's own state, "Reading Carta…", in the same slot as "Reading sheet…"; the typed-in table stays on screen and `source` is still Typed in.
3. The first Carta read succeeds → `source` becomes Carta; the typed-in editor is gone, Carta sync is the only writer, and the line reads "Carta · as of Sep 30" over Carta's holders. If the read fails, the old source and date stay on the line in the warning color and the menu starts with "Last read failed · Try again" (STORY-103).
4. Compare numbers → Carta's fully diluted count differs from the typed one. There is no diff view; the safety net is Undo.
5. Open the menu → Refresh, Change source, Undo.
6. Choose Undo → the typed-in table returns and the source is Typed in again. The menu no longer offers Undo.
7. Edit one row → autosaves; Carta no longer writes (`onMcpServerConnected` starts a read only when there is no snapshot or the source is Carta).
### Variations
- Carta already connected, founder picks Google Sheet: the Carta sync stops writing; only the sheet read does.
- Two switches in a row: the second copy overwrites `previous`, so only the middle version is recoverable.
- A switch to Typed in from Carta or a sheet starts from a copy of the table shown, so the founder edits it instead of retyping; securities keep the names copied from the source table (for example Seed Preferred).
### Edge Cases
- Cancel the Carta dialog → nothing changes and `previous` is untouched.
- Carta sign-in lapses later → the same line shows "Reconnect Carta"; a missing model shows the needs-model state.
- Rows from before slice 3 read as source carta, so a long-time Carta user sees "Carta · as of <date>" on day one.
- Undo pressed while a read is still running → the read carries the version it started from, so its late result is discarded and the restored table stays.

## STORY-106: The SAFEs, if converted at cap group
**Type**: medium
**Topic**: Cap table sources
**Persona**: Lena, founder raising on post-money SAFEs, cap table from Carta
**Goal**: See how much the SAFEs take if converted at the cap, next to current holders
**Preconditions**: Carta snapshot of 10,000,000 fully diluted shares (founders 61 percent, Seed preferred 20, options granted 11, pool 8). Fundraising SAFEs under a $10M post-money cap: Lakeside Capital $250,000 Funded, Priya Raman $200,000 Funded, Harbor Angels $50,000 Signed, Dana Whitfield $100,000 Draft.
**Ideal path**: 2 (open Investors, read the group row)
**Alternate paths**: Click the group heading to open Fundraising; ask the agent ("who owns what if the SAFEs convert?", `cap_table_read` returns SAFEs).
### Steps
1. Open Investors → the holdings table lists Maya Chen 33.0, Jonah Park 28.0, Northwind Ventures Fund II 14.0, Harbor Angels 6.0, Options granted 11.0 and "Option pool (unallocated)" 8.0, which sum to exactly 100.0.
2. Read the group row below the pool → "SAFEs, if converted at cap ›  5.0% · holdings 95.0%".
3. Read the three rows under it → Lakeside Capital $250,000 2.5%, Priya Raman $200,000 2.0%, Harbor Angels $50,000 0.5% (amount divided by cap), each with security "Post-money SAFE".
4. Look for Dana Whitfield → absent: a Draft SAFE is in no cap-table figure (not the group, not Equity raised); it shows in the Fundraising list and counts only in the round bar, as Pending.
5. Read the ownership bar → four tones plus the hatched pool, the SAFEs are not in it.
6. Click "SAFEs, if converted at cap ›" → navigates to Fundraising (`#fundraising`).
7. On a 390 px phone → each row is the holder name with its percent and a muted line such as "Post-money SAFE · $250,000"; the amount is not lost with the hidden Invested column.
### Variations
- Harbor Angels is also a Seed Preferred holder (STORY-111): both rows show, no second count, because the SAFE row is unconverted.
- A discount-only or MFN SAFE: the percent cell shows "—" and adds nothing to the 5.0%.
### Edge Cases
- Hide amounts on: the SAFE amounts mask, the percents stay.
- A SAFE that goes Expired or Canceled leaves the group (STORY-514).

## STORY-107: Hide amounts across sources and surfaces
**Type**: short
**Topic**: Cap table sources
**Persona**: Jonah, founder screen-sharing the Investors page on an investor call
**Goal**: Mask money figures but keep ownership readable
**Preconditions**: Cap table loaded from any source; an update draft and an audit row exist.
**Ideal path**: 1 (click Hide amounts)
**Alternate paths**: The same control on the Fundraising header.
### Steps
1. Click the eye button "Hide amounts" in the Investors header → Equity raised, the Invested column, the SAFE amounts, the 409A value, dollar amounts in Action items and the Invested inputs in the typed-in editor are masked; shares and percents stay.
2. Open the update editor → dollar figures in the draft text are masked too.
3. Open Fundraising → the same single browser setting is on there.
### Variations
- Empty view: no Hide amounts button (the header has Ask only).
### Edge Cases
- Dollar amounts typed inside the free-text body of an update. [plan silent: how a figure written in prose is recognized and masked (NG-24)]
- Reload: the setting is a browser preference and persists.

## STORY-108: Investors on a phone, with the sources
**Type**: medium
**Topic**: Cap table sources
**Persona**: Priya (STORY-102), checking ownership from her phone before a coffee meeting
**Goal**: Read who owns what and ask the agent a question on a small screen
**Preconditions**: Sheet-sourced cap table. A phone-width browser (390 px). The native mobile app has no Investors screen.
**Ideal path**: 3 (open the page, read the rows, tap Ask)
**Alternate paths**: Ask the Investors agent from the mobile app chat.
### Steps
1. Open `/app/investors` at 390 px → the sidebar is behind the menu button and the header stays one row: menu button, title "Investors", "+" (Add contact), icon-only Ask. The source line "Sheet · as of Sep 30" and Hide amounts sit under it. (The shell's narrow behavior is to be confirmed in slice 1.)
2. Read the figures → Fully diluted and Equity raised.
3. Read the holdings → each row shows the holder with its percent, and a muted line "Seed Preferred · 1,400,000 · $700,000"; a SAFE row shows its amount; in a read-only source Options and the pool have no "…" menu.
4. Tap the source line → the menu opens with Refresh and Change source.
5. Tap Ask → the Investors agent panel opens (collapsed by default on a narrow screen).
### Variations
- Empty view on a phone: the three equal buttons stack in the same order.
- Typed-in source on a phone (`#inv-native`, 390 px): stacked label and value rows, full-width values, 44 px tap targets; the pool row has only its shares.
### Edge Cases
- A long sheet name never appears in the source line (it reads "Sheet · as of <date>").
- Tooltips do not work on touch; every control has an accessible name.

## STORY-109: Carta-and-sheet household, one writer per source
**Type**: long
**Topic**: Cap table sources
**Persona**: Aisha, CEO of a Series A startup whose CFO keeps the sheet; Carta is also connected for audits
**Goal**: Keep the Investors figures current without a stray sync overwriting the sheet
**Preconditions**: The Google Sheet source was chosen three weeks ago; Carta is connected; Investors agent routine active.
**Ideal path**: 3 (open the page, Refresh, verify)
**Alternate paths**: Ask the agent to re-read; Change source to Carta.
### Steps
1. Open Investors → "Sheet · as of Sep 12". Carta being connected does not matter: the Carta sync writes only while the source is Carta.
2. The CFO changed the sheet yesterday and nothing shows it. Open the menu and choose Refresh → "Reading sheet…" (disabled), then "Sheet · as of Oct 20" with the new rows.
3. Ask the agent "re-read the sheet" in chat → the agent can write `cap_table_update` only during a sheet-read run started by the page, so it points to Refresh.
4. Open Ask and request "who owns what?" → the agent answers from the same snapshot (`cap_table_read`), consistent with the page.
5. Choose Change source, Carta → Carta reads; the sheet data is kept as `previous`; "Carta · as of Oct 20".
6. Open the menu and choose Undo → the sheet table is back and the source is Sheet.
### Variations
- Second member (the CFO) opens Investors → sees the empty view, because the snapshot is per space and user. [plan keeps this as an open question (PG-20)]
- The monthly routine fires while the snapshot is stale. The page shows only "as of" and not when the sheet was last read; round 2 skipped a separate "last read" time on purpose (PG-26, accepted), so Refresh is the remedy.
### Edge Cases
- Refresh while a Carta sync is running: the sheet read is the only writer while the source is Sheet, so the Carta run's result is not saved.
- The sheet is renamed in Drive: the source line never shows the file name, so nothing changes visibly.

## STORY-110: Undo a source switch you did not mean
**Type**: short
**Topic**: Cap table sources
**Persona**: Aisha (STORY-109)
**Goal**: Get the previous table back after picking the wrong sheet
**Preconditions**: Carta snapshot "as of Sep 30"; Aisha just changed source to a Google Sheet and picked the wrong file; the read finished.
**Ideal path**: 2 (open the menu, Undo)
**Alternate paths**: Change source back to Carta and re-read (slower and re-syncs).
### Steps
1. Read the header → "Sheet · as of Oct 20" and rows that look wrong.
2. Open the source menu → Refresh, Change source, Undo (`#inv-menu`).
3. Choose Undo → the Carta table returns, the line reads "Carta · as of Sep 30", Undo disappears from the menu. No dialog appears.
### Variations
- Undo is offered only while a previous version exists and until the next change; a typed edit, a Refresh that writes, or another switch ends it.
### Edge Cases
- Undo while a read is still "Reading sheet…" → the late result is discarded.
- Undo twice → the second time the menu has no Undo.

## STORY-111: Equity raised and the SAFEs group are different numbers
**Type**: short
**Topic**: Cap table sources
**Persona**: Lena (STORY-106)
**Goal**: Understand why Investors says $1.0M raised while Fundraising shows $450k funded
**Preconditions**: Carta snapshot; Seed preferred holders Northwind $700,000 and Harbor Angels $300,000 invested; SAFEs as in STORY-106.
**Ideal path**: 2 (read the two figures, read the group row)
**Alternate paths**: Ask the agent.
### Steps
1. Read the figure "Equity raised  $1.0M" → equity only, equal to the sum of the Invested column of the holdings ($700,000 + $300,000); no SAFE money.
2. Read the group row "SAFEs, if converted at cap  5.0% · holdings 95.0%" → SAFE money lives only here and on Fundraising; a native Draft SAFE (for example Dana Whitfield, $100,000, sent without Mercury) is in neither Investors figure, and counts only in the Fundraising round bar, as Pending.
3. Open Fundraising → the round bar reads Funded $450k, Signed $50k, Pending $150k, Target $1M: a different measure (the open round's SAFEs, plus committed prospects with no SAFE and Draft and Sent SAFEs at their amount).
### Variations
- Source Carta: Equity raised is still the sum of the Invested column; Carta's own `amountRaisedUsd` is not shown, so the figure can differ from what Carta reports.
### Edge Cases
- Hide amounts masks both figures.

## STORY-112: Two tabs edit the typed-in table
**Type**: medium
**Topic**: Cap table sources
**Persona**: Tomas, with the Investors page open in two browser tabs
**Goal**: Edit without silently overwriting a newer save
**Preconditions**: Typed-in table; two tabs loaded with every row at the same `rev`.
**Ideal path**: 2 (edit in tab A, edit a different row in tab B)
**Alternate paths**: A second member edits the same table (the table is per space and user, so the second member has their own).
### Steps
1. In tab A change Alma Reyes's shares to 3,600,000 and tab out → the row saves with `{ rowId, expectedRev, values }`; "Saved" in the card header.
2. In tab B (still on the old table) change Jonah's shares and tab out → the server applies it to the newest table, Jonah's row is at the expected `rev`, so it saves and Alma's 3,600,000 stays.
3. In tab B change Alma's shares too and tab out → that row's `rev` changed, so the save is refused: the row reloads with tab A's value and shows "Changed elsewhere" next to it (`#inv-changed`); nothing else moves.
4. Tomas types his value again → it saves at the new `rev`.
### Variations
- Both tabs add a row at the bottom at the same time: they are two separate new rows, so both save.
### Edge Cases
- A blur on a row that did not change sends no save.
- Tab A deletes a holder that tab B is editing, or tab B's other rows and percentages are out of date after tab A's save. [plan silent: a refused save for a deleted row, when "Changed elsewhere" clears, and whether figures recompute from the newest table (NG-50)]

## STORY-113: Autosave fails while offline
**Type**: short
**Topic**: Cap table sources
**Persona**: Tomas on a train with a flaky connection
**Goal**: Know that a typed row did not save, and save it later
**Preconditions**: Typed-in table loaded; the connection drops.
**Ideal path**: 3 (type a row, see Not saved, Retry after reconnecting)
**Alternate paths**: none found
### Steps
1. Type "Mira Santos", Common, 250,000 and tab out while offline → the save call fails.
2. Look at the card header → "Not saved" with a Retry button (`#inv-notsaved`); the row stays as typed. A network error, a stale save and a validation failure all show this one state.
3. Reconnect and click Retry → only the rows that were not saved are sent again, and the header returns to "Saved".
### Variations
- Server error instead of offline: the same "Not saved" state.
### Edge Cases
- Several rows typed offline: all stay in the table and Retry sends each unsaved row.
- Tomas closes the tab or navigates away while "Not saved" is showing → the browser's leave confirmation asks first.

## Gaps found
Open after round 5. Resolved in round 3 and no longer listed: PG-15 (blank, negative and duplicate-name rows), NG-34 (failed switch keeps the old label), NG-35 (per-row saves), NG-37 (names copied), NG-38 (leave confirmation).
- PG-04: Fundraising's default visibility for a user who hid Cap Table.
- PG-10: first-visit agent creation latency and suggestion chips.
- PG-18: presentation of a zero-money table.
- PG-20: two members in one space see different tables (plan open question, skipped with a reason).
- PG-23 (remainder): what the body shows during the very first sheet read.
- PG-24: first-tab rule, truncation, partial parse, deleted sheet (reported only in chat; skipped with a reason).
- PG-25: Drive sign-in in place or via Integrations; picker reopen.
- NG-24: Hide amounts for figures typed in prose.
- NG-50 (new, nice): per-row saves leave three cases open: a partly filled new row, a row deleted in another tab, and other rows and percentages that stay out of date.
