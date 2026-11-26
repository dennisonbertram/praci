# Stories: Finance, Legal, Cap table and Data room

Status: planned native SwiftUI app (epic #427, phase 12 is issue #424). No Swift code exists. Every step is planned or inferred from boards, plan and contracts.

Sources: `docs/design-system/ios/boards/PG-B-Finance.dc.html`, `PG-B-Legal.dc.html`, `PG-B-CapTable.dc.html`, `PG-B-DataRoom.dc.html`, rule cards in `PG-B-Rules.dc.html`, domain components in `DS-07-Domain.dc.html`, `Desk.dc.html`, `Main.dc.html`, `PG-A-Home.dc.html`, `docs/ios-native/README.md`, `docs/ios-native/plan.md` (Phase 12), `packages/contracts/src/rpc.ts` (`finance`, `legal`, `carta`, `contacts`, `dataRoom`, `notifications.glance`).

Facts that apply to all stories:

- The Expo app (`apps/mobile`) has no Finance, Legal, Cap table or Data room screen. It only renders finance message cards as plain text (`financeCardText` in `apps/mobile/lib/api.ts`) and shows data room file names in message captions ("the app has no Data room screen to open them in"). All four pages are new in the native app; no Expo labels exist to compare.
- Board data is placeholder (`[N]`, `[AMOUNT]`). Figures in these stories are invented.
- The rule cards say each page is "Push from sidebar [Finance|Legal|Cap table|Data room] row". The Home boards show no such rows (see Design gaps).

---

## STORY-001: Check runway and cash, then ask the Finance agent why spend jumped
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Priya Anand, solo founder of a 4-person seed-stage company, checking money before a board call
**Goal**: See current runway and cash, look at the 90-day view, and ask the Finance agent why spend rose.
**Preconditions**: Signed in, space selected, Mercury and Brex connected, Finance agent exists, AI data sharing consent granted.
**Device**: standard iPhone
**Ideal path**: 6 — open Finance, switch period, read KPIs, tap Ask Finance agent, type question, send.
**Alternate paths**: (a) Home > "Finance agent" row in Personnel > ask in the thread directly, which answers with an inline finance card (no Finance page needed). (b) Tap a push notification whose `surface` is "finance" (Expo already routes `/finance` taps; native must too). (c) Ask from the Desk laptop-pose composer "Message Finance agent". (d) Voice: dictate the question into the Finance agent thread.
**Design source**: Steps 1-2 NO BOARD for the entry point (rule card says "Push from sidebar Finance row", no board draws the row). Steps 3-5 `PG-B-Finance.dc.html`, `PG-B-Rules.dc.html` Finance card. Step 6 `PG-A-Thread.dc.html`, `Desk.dc.html` (reply wording "Why did spend jump last month?").

### Steps
1. From Home, reach the Finance page (entry point undefined; see gaps) → Finance page pushes with a Back chevron. Skeleton KPIs show while `finance.overview` loads.
2. Wait for load → "Runway [N] mo", "Cash [AMOUNT]", "Monthly burn", then "Accounts" with "Operating" (Mercury agent) and "Cards" (Brex agent), and "Upcoming" with "Northwind invoice, Due Oct 24" and "Acme Payroll, Oct 31".
3. Tap "90 days" in the period tabs (30 days, 90 days, 12 months) → burn chart and burn figure change to the 90-day range.
4. Read the burn bars; tap the highlighted bar → selection announces "Sep, [AMOUNT]" to VoiceOver and highlights the bar (DS-07 Spend bar chart).
5. Tap "Ask Finance agent" (prominent bubble in the top bar) → Finance agent thread opens with a composer, labeled "Message Finance agent" on the laptop board.
6. Type "Why did spend jump last month?" and send → run starts; reply streams in as text plus an optional finance card ("Two annual renewals landed in the same month...").

### Variations
- Tap "12 months" and compare Runway to the 30 day figure; runway uses current burn so it may not change with the tab (not specified).
- Same data in chat: the Finance agent can post a `finance` card (overview, breakdown, transactions). The native card must show the same numbers as the page and honor Hide amounts (see STORY-002).
- Pull to refresh versus the top-bar refresh button (`finance.refresh`): two ways to refresh. Pull-to-refresh is not drawn.
- Light mode (not drawn; boards are dark only).

### Edge Cases
- User has no connected model: send fails with "Connect a model to start a run".
- AI consent not granted: send fails with "Review AI data sharing in Account settings before continuing."; client should prompt first.
- Offline: saved snapshot behavior for Finance is not specified; chat message is queued in the outbox.
- Runway is null (no burn data): board shows `[N] mo` only; a null state is not drawn. `finance.runway` can return no figure.
- Non-USD transactions are left out of totals; no indicator is drawn.

### Design gaps
- Entry point to the page on the outer display (no sidebar row drawn).
- Runway/Cash/Burn when value is unavailable (null runway).
- Pull to refresh and refresh progress (top-bar refresh icon has no loading state).
- Tapping an account row, an Upcoming row, or a burn bar for detail: no screen (account detail, transaction detail have API `finance.account`, `finance.transaction` but no board).
- The inner-book rule lists sections "Overview, Accounts, Burn, Spend", but the outer page shows Overview, Accounts and Upcoming; "Spend" and "Upcoming" naming differ and "Spend" has no outer layout.

---

## STORY-002: Hide amounts before screen sharing, including chat finance cards
**Type**: short
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Marcus Webb, founder who often shows his phone to an advisor over coffee
**Goal**: Mask every dollar figure on the phone, then confirm that chat cards are masked too.
**Preconditions**: Finance connected; the Finance agent thread has an earlier `overview` finance card.
**Device**: standard iPhone
**Ideal path**: 2 — tap the eye in the top bar, open the thread.
**Alternate paths**: none found for toggling (the toggle is only drawn on the Finance page). Reveal by tapping the same button.
**Design source**: `PG-B-Finance.dc.html` and rule card (action group "eye: hide amounts, refresh"), `DS-07-Domain.dc.html` "Hidden amounts" and "amounts hidden" specimen. Chat card masking: NO BOARD.

### Steps
1. On Finance, tap the eye button in the action group → every amount becomes "•••" and the label reads "amounts hidden"; layout does not shift; the icon changes to eye.slash.
2. Go back and open the Finance agent thread → the finance card in the thread shows masked amounts (README: "Hide amounts is client-only; mask chat finance cards too").

### Variations
- Toggle back with the same button; the setting is device-only, stored locally (Keychain preferences), not synced.
- Transaction rows show "••••" for amounts (DS-07 hidden row).
- Mercury agent text replies ("Balance as of this morning: [AMOUNT]") are plain agent text; masking those is not specified.

### Edge Cases
- Relaunch the app: persistence of the setting is implied (device preference) but not stated for restart.
- Another surface: Legal figures (decimal strings of minor units) and Cap table share counts are not covered by "amounts".
- VoiceOver on a hidden amount should not read the real value (not specified).

### Design gaps
- Whether Hide amounts also masks agent-written text, push notification text ("Balance as of..."), the Home Personnel preview line, and Live Activities.
- The toggle exists only on Finance; no setting in Settings.
- Hidden-state card for chat is not drawn.

---

## STORY-003: Run Scan now on Legal and review contracts and deadlines
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Dana Ortiz, operator at a 12-person startup who handles contracts
**Goal**: Trigger a fresh scan, see which contracts are expired or awaiting signature, and see this week's deadlines.
**Preconditions**: Legal agent exists, user's own OpenRouter key is set (`modelBlocker` is clear), Legal consent granted, Data room has documents.
**Device**: standard iPhone
**Ideal path**: 5 — open Legal, tap scan, wait, read Contracts, switch to Deadlines.
**Alternate paths**: (a) Home > "Legal agent" row ("2 deadlines due this week") > ask the agent in chat instead of using the page. (b) Push notification that taps through to Legal. (c) Ask Legal agent in the page to explain a specific contract.
**Design source**: `PG-B-Legal.dc.html`, `PG-B-Rules.dc.html` Legal card, `DS-07-Domain.dc.html` Deadline row and Document card. Scan progress and result toast: NO BOARD.

### Steps
1. Open Legal (entry point undefined) → Back chevron, scan icon, "Ask Legal agent"; segmented "Contracts" and "Deadlines"; summary "Last scan today, 8:05 AM" and "2 deadlines this week".
2. Tap the scan icon in the top bar ("scan now") → `legal.scanNow` starts a run; progress state (not drawn).
3. Read the contract rows → "Northwind services agreement, Ends Dec 31, Signed"; "Design partner NDA, Sent to Jordan Lee, Awaiting"; "Office lease renewal, Expired Sep 30, Expired"; "Acme Payroll terms, Updated Oct 12".
4. Tap "Deadlines" → deadline rows with a calendar tile, status chip with clock icon and words: "Due in 3 days" (warning), "Overdue" (destructive), "On track".
5. Tap "File annual report" → deadline edit/detail (`legal.updateDeadline` exists). Screen NO BOARD.

### Variations
- Tap a contract row → contract detail (parties, dates, deadlines). Drawn only for the inner display (2/3 pane); no outer-display push page.
- Use `legal.itemLinks` to open the source Data room file from a contract; no link control drawn.
- After a successful scan, the "Last scan" line updates and unreviewed documents may remain (`unreviewedDocuments`); the count is not displayed on any board.

### Edge Cases
- Never scanned: "Not scanned yet" with "Scan now".
- Scan failed: warning row with "Scan now".
- No OpenRouter key: "Add your OpenRouter key" opens Models (see STORY-004).
- Legal consent missing: `legal.consent` / `consentGrant` prompt; screen NO BOARD.
- Scan already running when the user taps again (`lastScanRun.status` "running"): not specified.
- Daily scan routine off (`dailyScanActive` false): no indicator drawn.

### Design gaps
- Scan running, completed and cancelled states; the scan icon has no loading state.
- Contract detail and deadline edit on the outer display.
- Legal consent prompt.
- Status text colors for Signed, Awaiting, Expired: only text is drawn, mapping to chips (DS-07) is not stated for contract rows.
- "Never scanned" and "Scan failed" are described in the rule card only, not drawn.

---

## STORY-004: Legal is blocked until the user adds their own OpenRouter key
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Tomas Berg, founder on a hosted plan who has never added a model key
**Goal**: Understand why Legal will not scan, add a key, and return to scan.
**Preconditions**: Legal page opened for the first time; user has no OpenRouter key; Legal agent exists.
**Device**: standard iPhone
**Ideal path**: 7 — open Legal, see blocker, open Models, add key, go back, scan.
**Alternate paths**: (a) Go to Settings > Models first and add the key before visiting Legal. (b) Ask the Legal agent in chat; the run would fail with the model blocker. (c) On the inner display, the Settings list in the third and Models beside it avoid leaving Legal.
**Design source**: `PG-B-Legal.dc.html` rule card ("No key: Add your OpenRouter key opens Models"), `PG-B-Models.dc.html` (key entry; read its rule card in the Models story). The blocker row itself: NO BOARD (text only in the rule card).

### Steps
1. Open Legal → page shows the blocker row "Add your OpenRouter key" instead of contracts, from `modelBlocker`.
2. Tap "Add your OpenRouter key" → Models page opens (push).
3. Enter the key in the provider connect field and save → "Now using Model A"-style success from the Models states.
4. Tap Back to Legal → page should refresh and drop the blocker (refresh trigger is not specified).
5. Observe "Not scanned yet" with "Scan now" → tap it.
6. Wait for the scan → contract rows appear.
7. Read "Last scan today, ..." line → confirms success.

### Variations
- Key is invalid: Models shows its own error ("Could not verify or save these credentials" belongs to Integrations; Models shows an unreachable red line).
- User with a subscription sign-in model instead of an OpenRouter key: Legal still requires OpenRouter; wording does not explain this.

### Edge Cases
- Returning from Models via swipe-back versus the Back chevron: both must re-read `legal.overview`.
- The key is removed later: the page returns to the blocker.
- Self-hosted server older than the Legal procedures: 404 means "not supported"; no state drawn.

### Design gaps
- The blocker row is not drawn (copy and layout appear only in the rule card). The page offers no explanation of why an OpenRouter key specifically is needed.
- Whether Legal consent (`legal.consentGrant`) is asked before or after the key.
- A way back from Models into Legal besides Back (a "Continue" return) is not designed.

---

## STORY-005: Connect Carta, read ownership, and add a contact
**Type**: long
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Lena Fischer, CEO preparing a seed extension who needs to see who owns what
**Goal**: Connect Carta from the phone, read the ownership ring and holders, add an advisor as a contact, and ask the Carta agent about the option pool.
**Preconditions**: Carta not yet connected (`carta.capTable` returns `snapshot: null`); Carta agent exists; web OAuth for Carta is available through the Integrations flow.
**Device**: standard iPhone
**Ideal path**: 14 — open Cap table, tap Connect Carta, finish in Safari, return, read the ring, open Holders, tap plus, fill contact, save, tap Ask Carta agent.
**Alternate paths**: (a) Settings > Integrations > Carta, then open Cap table. (b) Home > "Carta agent" row, which may carry an `app_connect` card inside the thread ("Connect" prominent ink button) and connects without visiting the page. (c) Ask the Carta agent: "The option pool draft is ready" is the Home preview text.
**Design source**: `PG-B-CapTable.dc.html`, `PG-B-Rules.dc.html` Cap table card, `DS-07-Domain.dc.html` Ownership summary and Holder row, `PG-B-Integrations.dc.html` (connect pending alert), `DS-07-Domain.dc.html` AppConnectCard. Not-connected screen is described in the rule card only. Contact form: NO BOARD.

### Steps
1. Open Cap table (entry point undefined) → not-connected state: "See who owns your company" with "Connect Carta".
2. Tap "Connect Carta" → app opens `authorizationUrl` in Safari (`ASWebAuthenticationSession`).
3. Sign in to Carta and approve in Safari → returns to the app.
4. App shows "Connect pending: alert to finish in browser, then refresh." until `connections.complete` polling (every 2 s) succeeds.
5. Page loads and shows "Carta is connected" (with "Reconnect" available), a syncing state while `syncing` is true.
6. Read the ownership ring: "Shares [N]", "Founders [N]%", "Option pool", "Seed investors", "Advisors", with a legend. Ring uses monochrome segments, not bot colors.
7. Scroll to "Holders" → holder rows with initials avatar, name, class and share count, percent right-aligned.
8. Tap a holder, for example "Ana Ruiz, Common" → holder detail (shares, contact). Outer-display screen: NO BOARD (drawn only as the 2/3 pane).
9. Go back and tap the plus (add contact) in the top bar → contact form. NO BOARD.
10. Enter name "Sam Okafor", role "Advisor", email → fields.
11. Save → `contacts.save`; the contact appears (location of contacts list is not drawn).
12. Tap the refresh icon → `carta.refresh`; syncing indicator, then updated figures.
13. Tap "Ask Carta agent" → Carta agent thread opens.
14. Send "How big is the option pool if we add 2% for hires?" → agent replies; writes (draft changes) wait for approval, and writes are off by default.

### Variations
- Safari returns an error or the user cancels: connect state stays "See who owns your company".
- Connect from the Carta agent thread's AppConnectCard instead (alternate b).
- On the inner display: holder list 1/3 and holder detail 2/3, with the ring above on a laptop pose (ring top half; holders bottom half).

### Edge Cases
- Token expired: "Reconnect Carta" in place of "Carta is connected"; "Reconnect" button on the connected row.
- Load error: "Try again".
- Safari returns but polling never completes (user abandoned): keep showing pending with a way to retry; timeout not specified.
- Percent rounding: ring legend shows Founders, Option pool, Seed investors and Advisors; DS-07 specimen shows Founders, Investors, Pool, Other, a label mismatch between board and specimen.
- MCP OAuth is web-only; Carta is a direct integration, so this should be fine, but the plan does not say which.

### Design gaps
- Not-connected, expired, error and syncing screens are described but not drawn.
- Contact add form and contact list; holder detail on the outer display.
- Label mismatch: page board uses "Founders / Option pool / Seed investors / Advisors"; DS-07 uses "Founders / Investors / Pool / Other".
- Plan phase 12 does not mention the Safari return-and-poll step for Carta explicitly.
- Whether `contacts.save` for an advisor also links to a holder is unspecified.

---

## STORY-006: Upload a term sheet to the Data room and find it by search
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Hiro Tanaka, founder who just received a signed PDF by email and wants it kept with deal documents
**Goal**: Add a PDF from the Files app to the Data room and confirm it is searchable.
**Preconditions**: Data room has folders ("Board materials", "Diligence"); AI consent for Data room granted; a PDF exists in the Files app.
**Device**: standard iPhone
**Ideal path**: 6 — open Data room, tap plus, pick file, watch upload, search by name, open result.
**Alternate paths**: (a) Share extension from Files or Mail to "Data room" (phase 13, #425, needs a physical device; no board). (b) Attach to an agent message through the composer (`artifacts/create`, 10 MB limit; not the Data room). (c) Ask the Data room agent to import from email, Drive or Box (server side imports). (d) On the Mac or web (not this app).
**Design source**: `PG-B-DataRoom.dc.html`, `PG-B-Rules.dc.html` Data room card, `DS-07-Domain.dc.html` Folder and file rows, Upload progress. Search result row, file preview: NO BOARD.

### Steps
1. Open Data room (entry point undefined) → search field, "Recently added" rows ("Cap table export.csv, CSV · Ana Ruiz", "Northwind agreement.pdf", "Pitch deck v3.pdf"), folders ("Board materials, [N] items"; "Diligence"), and "Load more".
2. Tap the plus (add files) in the top bar → system file picker opens.
3. Choose "Term sheet.pdf" → picker closes; upload row appears: file tile, name, 4 pt progress bar and percent ("62%"), cancel (x).
4. Wait for completion → row becomes a normal file row; upload response is 201 (new). Item processing continues asynchronously.
5. Type "term sheet" in the search field → results with highlighted match text (U+0001/U+0002 markers rendered as emphasis).
6. Tap the result → file preview/detail. NO BOARD (README lists `GET …/content` and `…/thumbnail`).

### Variations
- Upload a ZIP: response 202 with `importId`; the zip is unpacked in the background. The outcome is not drawn.
- Upload the same file again: 200 with `duplicate`; no duplicate message is drawn.
- Upload multiple files at once from the picker.
- Tap "Load more" to page (cursor-based).
- Filter (funnel icon) by facet; "No results" with "Clear filters" if empty.

### Edge Cases
- Upload fails: row shows destructive "Upload failed" with "Retry"; "Cap table.xlsx" specimen.
- User taps cancel (x) mid-upload.
- Large file on cellular: no size limit; streamed body; no warning drawn.
- App is backgrounded during upload: background URLSession behavior not specified.
- Empty room: "Choose files" button replaces "Drop files here".
- Consent missing: `dataRoom.consent` / `consentGrant`, no screen.

### Design gaps
- Folder navigation (tapping "Board materials"), item detail and preview, rename, move, delete, retry processing (`dataRoom.itemRetry`), and processing status for newly uploaded items (`dataRoom.processing`).
- Duplicate and zip-import outcomes.
- Search result row layout and search loading state.
- Upload progress in the background and after leaving the page.
- The "Shared / Only me / View only" permission chips are drawn in DS-07 but the README says "no share links" and no sharing API is planned; confirm what the chips mean.

---

## STORY-007: Share a file from the Data room into a conversation with an agent
**Type**: short
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Nadia Rahman, operations lead who needs the Legal agent to review a lease
**Goal**: Get a Data room file in front of the Legal agent.
**Preconditions**: "Office lease renewal.pdf" is already in the Data room and processed.
**Device**: standard iPhone
**Ideal path**: 4 — open Data room, find file, tap Ask Data room agent, mention the file in chat.
**Alternate paths**: (a) Open the Legal agent thread and attach a Data room item (`threads/send` accepts `dataRoomItemIds`; no picker is drawn). (b) From Legal, tap a contract and "Ask Legal agent" with the contract's Data room link. (c) Ask in Data room agent chat to forward the file.
**Design source**: `PG-B-DataRoom.dc.html`, `PG-B-Rules.dc.html` Data room card. Attaching a Data room item in the composer: NO BOARD.

### Steps
1. Open Data room and search "lease" → matching file row.
2. Tap "Ask Data room agent" → Data room agent thread opens.
3. Type "Ask the Legal agent to check the renewal terms in the Office lease renewal file" and send → message goes out with `dataRoomItemIds`; the agent hands off.
4. Message caption lists the file by name (as the Expo app already does through `splitDataRoomReferences`).

### Variations
- Tap the file name in the caption: in Expo nothing opens; native should open the Data room item, not designed.

### Edge Cases
- File still processing: whether the item can be referenced is not specified.
- User lacks access to another owner's item: chips never show other owners' items.

### Design gaps
- No way to select a Data room file from a row (long-press, checkmark, or "Ask about this file").
- Composer attachment picker for Data room items does not exist on any board.
- Tapping a Data room reference inside a message has no destination.

---

## STORY-008: See the four pages on Duo, inner display and laptop pose
**Type**: long
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Isabel Moreno, founder with an iPhone Duo who reviews numbers in a half-open "laptop" posture
**Goal**: Use Finance, Legal, Cap table and Data room across the outer display, book view, half-folded and laptop pose without losing her place.
**Preconditions**: All four integrations connected; Duo device or simulator running the native app; iOS 27.1 Duo APIs available.
**Device**: iPhone Duo outer, inner flat, half-folded, laptop pose
**Ideal path**: 20 — outer-display check, unfold, use 1/3 + 2/3, half-fold, laptop pose.
**Alternate paths**: (a) Stay on one pose. (b) Standard iPhone: top bar only, same pages in a single column (STORY-001 to STORY-006).
**Design source**: `PG-B-Rules.dc.html` rule cards for the four pages (Inner book, Half-folded, Laptop pose), `Inner.dc.html`, `Split.dc.html`, `Desk.dc.html` (Finance laptop desk pose), `PG-B-*.dc.html`. Inner/half-folded layouts for Legal, Cap table, Data room beyond the rule text: NO BOARD (only Finance has a laptop board).

### Steps
1. On the outer display (466x678 pt), open Finance → single column with period tabs, KPIs, burn chart, Accounts, Upcoming.
2. Tap the eye to hide amounts → masked.
3. Unfold to the inner display held as a book (890x626 pt) → page becomes 1/3 + 2/3: the left third shows Finance sections "Overview, Accounts, Burn, Spend", the right two thirds shows the selected section.
4. Tap "Burn" in the left list → right pane shows the burn chart; Hide amounts is still on.
5. Fold halfway (flat to half-folded) → 1/3 + 2/3 snaps to 1/2 + 1/2: Overview on the left, chart and detail on the right.
6. Rotate to laptop pose (626x890 pt, fold at y 435 to 455) → burn chart on the top half; period tabs, accounts and "Ask Finance agent" on the bottom half. Desk board shows the Finance agent composer "Message Finance agent" below the fold.
7. Open Legal → inner: contract list 1/3, contract detail (parties, dates, deadlines) 2/3.
8. Tap "Office lease renewal" → detail pane shows the lease; laptop pose puts a document preview on top and status and actions on bottom.
9. Open Cap table → holder list 1/3, holder detail (shares, contact) 2/3; laptop pose puts the ownership ring on top and holders list below.
10. Tap "Ana Ruiz" → holder detail.
11. Open Data room → folder tree 1/3, folder contents 2/3; laptop pose puts a file preview on top and the list and Add files below.
12. Tap "Board materials" → contents in the right pane.
13. Tap the plus → system file picker; sheets stay in the content area and never cross the fold.
14. Pick a file → upload row appears in the contents pane.
15. Tap "Ask Data room agent" → Data room agent thread; on inner, the thread opens in the third column (Personnel in the third).
16. Fold back to the outer display with the agent thread open → state restoration (see gaps).
17. Return to the Home outer display via Back.
18. Reopen Finance → hidden-amounts setting persists.
19. Tap a push notification for the Legal agent ("2 deadlines due this week") → opens the agent thread (bot wins), not the Legal page.
20. Switch spaces → all four pages reload for the new space.

### Variations
- Marked applicable for laptop pose: Finance, Legal, Cap table, Data room (all four).
- Half-folded for Cap table is not stated in the rule card text I read (the line was cut); treat as undefined.

### Edge Cases
- Selection and scroll position across posture changes: README says not specified.
- Fold crossing a sheet or file picker mid-upload.
- Duo APIs sit behind `if #available(iOS 27.1, *)`; older iPhones get the standard column.
- Left list "Spend" section name versus the outer page "Upcoming" (see STORY-001).

### Design gaps
- Only Finance has a laptop board (`Desk.dc.html`). Legal, Cap table and Data room inner/half/laptop layouts exist only as rule-card text, with no mockups.
- Selection and scroll preservation across posture changes.
- Finance "Spend" and "Burn" sections are listed for the inner view but the outer page has a single scroll with no equivalent split.
- Where Ask [page] agent lives in the inner and laptop layouts (outer: prominent bubble in the top bar).
- Where the four pages are reached on the inner display; the inner sidebar board would need rows for them.

---

## STORY-009: Sidebar glance and badges lead to the right page
**Type**: short
**Topic**: Finance, Legal, Cap table and Data room
**Persona**: Colm Brady, founder who checks the app a few times a day
**Goal**: Notice from Home that a legal deadline is near and runway has changed, then open the page.
**Preconditions**: `notifications.glance` returns `financeRunwayMonths`, `legalDueSoon` (2), `dataRoomWaiting`.
**Device**: standard iPhone
**Ideal path**: 3 — open Home, spot the Legal glance, tap through to Legal.
**Alternate paths**: (a) Tap the "Legal agent" Personnel row ("2 deadlines due this week") to land in the chat instead. (b) Tap the push notification. (c) Open Legal from a sidebar row (the rule card says this, but no row is drawn).
**Design source**: `PG-A-Home.dc.html`, `Main.dc.html` (Personnel rows), `PG-B-Rules.dc.html` (Presentation). Glance badges and the sidebar rows for the four pages: NO BOARD.

### Steps
1. Open the app to Home → Personnel list shows "Finance agent: Runway summary for the last 30 days", "Legal agent: 2 deadlines due this week", "Carta agent", "Mercury agent", "Brex agent: 4 card expenses need receipts".
2. Look for the glance (runway months, deadlines due, items waiting) → NO BOARD shows these beside page rows.
3. Tap the Legal entry → either the Legal agent chat or the Legal page, depending on which entry exists.

### Variations
- Data room "waiting" count after an upload (`dataRoomWaiting`) points at items still processing.

### Edge Cases
- `glance` values null: nothing shown.
- Two entries for one concept (a Personnel agent row and a page row) could duplicate each other for Finance, Legal and Cap table.

### Design gaps
- The page rows and glance values the API provides (`notifications.glance`) have no drawn home. This is the biggest gap in the topic.
- Whether the rows are always visible or added by the user (`sidebarPages` add/remove exists but only the "team-health" template is defined, and it is `available: false` and web/desktop only).
- Duplication between the agent row and the page row for the same capability.
