# Connecting sources and first run

> Walked against the mockup before the fixes in this change; findings are kept as the record of what was fixed. See the Status column in the consolidated findings of catalog.md.

Topic: connect-sources-first-run. Walked in headless Chromium against `mockup.html` at 1360x860 (stories 01-07) and 390x844 (story 08). Zero console errors or page errors in any walk. Screenshots and scripts: a local scratch folder (not committed) (`walk.js`, `walk2.js`, `w*.png`, `m*.png`).

How the mockup behaves, found by walking (this matters for every story):

- The page opens already populated (Product launch, all four sources connected). A real first-time user never sees this. The empty state exists only after opening the dashed "Mockup states" details (closed by default) and ticking "Connect source".
- "Connect" on any form does not add that source's data. All 14 tasks from all four sources already exist and show after any connect. Connecting Linear alone yields a board with GitHub, Notion and Native cards too.
- "Read only" is one global flag. Connecting any source with Read only locks every non-native card on the board and shows one "Read-only" badge.
- There is no UI to reach the connect forms again once a project exists. The only entry is the empty state.
- "Retry" works: it shows "Syncing..." for about 0.7 s, clears the banner and toasts "Synced".

Ratings used in Walk result: OK, MISSING, CONFUSING, CONTRADICTS-PLAN. "Mockup-only" is noted where the gap is a prototype shortcut.

---

## CONNECT-SOURCES-FIRST-RUN-01: Founder starts with no tracker
**Type**: short  **Persona**: Priya, solo founder of a 3-person design studio, no task tracker  **Goal**: get a working board without signing up for anything
**Preconditions**: first visit to Projects, nothing connected (mockup: tick "Connect source" in "Mockup states")
**README stories**: S1, S8
**Ideal path**: 1. A single click on "New project" should land on a board she can use; the README says no account is needed.
**Alternate paths**: none found (the Project menu has "New project" too but is only visible once a project exists).

### Steps
1. Open Projects. Sees heading "Projects" with "New project", "GitHub", "Linear", "Notion". She thinks: "I do not use any of these; the purple button must be mine." → empty state shown.
2. Click "New project" → expects a name prompt or an empty board with a way to add the first task.
3. Look at the result → expects "Add task" and empty columns. Instead sees a full board.

### Walk result
1. OK: empty state renders "Projects New project GitHub Linear Notion"; "New project" is the only filled button (w2-empty.png). Hint of friction: nothing says "New project" needs no account.
2. CONTRADICTS-PLAN: no name prompt. S1 says native tasks are created by the user, but the click reveals the pre-filled "Product launch" board (14 cards, header name unchanged).
3. MISSING: no empty-board state, no "Add task" control, no editable fields. Mockup shows Backlog 5 / Todo 3 / In progress 3 / In review 1 / Done 2, all of it other people's data.

### Variations / Edge cases
- Priya opens the Project menu (button "Product launch") and picks "New project": nothing changes, project name stays "Product launch" (walked).
- She picks "Docs refresh": the name changes; the data is the same as "Product launch" per discovery (not re-walked on Board).

---

## CONNECT-SOURCES-FIRST-RUN-02: Team lead connects Linear, read only
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup that uses Linear  **Goal**: see her Linear issues on the board without any risk of changing them
**Preconditions**: empty state shown
**README stories**: S2, S24
**Ideal path**: 3. "Linear" → "Read only" → "Connect". Team defaults to Growth, so no field edit is required.
**Alternate paths**: none found.

### Steps
1. Click "Linear" → panel "Connect Linear" with a "Team" select (Growth, Platform, Design), "Access" toggle, "Back", "Connect". She thinks: "I want Platform and Growth; it only lets me pick one."
2. Click "Read only" in "Access" → it highlights. She wonders: "Does Read only mean Rakazo cannot touch Linear at all, including the bot?"
3. Click "Connect" → board appears with "Read-only" badge.
4. Try to drag a Linear card (for example "Onboarding emails" ENG-42) → expects a refusal she understands.

### Walk result
1. CONTRADICTS-PLAN: S2 says "pick which to show" (teams, plural); "Team" is a single select (W5 text: "Team Growth Platform Design"). Also no OAuth step, so she never sees what Rakazo is asking Linear for.
2. OK: toggle works; default is "Read and write", so choosing Read only is deliberate. CONFUSING: no copy says what each option allows, and the plan says Read only uses a different endpoint, which she cannot know.
3. CONTRADICTS-PLAN: no first-sync count or progress (S2). Board shows 14 cards at once, including GitHub, Notion and Native (w5-after-linear-ro.png); Sources button shows 3 3 4 Native 6 although she connected only Linear.
4. CONFUSING: the 10 non-native cards are not draggable (walk: 4 of 14 draggable) but there is no tooltip. The badge "Read-only" has no title attribute explaining it.

### Variations / Edge cases
- She hits "Back" after choosing Read only, then opens Notion: the toggle still reads "Read only" (state is sticky across steps; walked). Mildly useful, but a later "Connect GitHub" inherits a decision she made for Linear.
- Read only is global: the badge appears for the whole board though only Linear was set read only.

---

## CONNECT-SOURCES-FIRST-RUN-03: Developer connects a GitHub repo and reads the status rule
**Type**: medium  **Persona**: Jonas, backend developer at a 6-person agency, repo has issues and labels but no GitHub Project  **Goal**: connect `acme/api` and understand how issue state maps to columns
**Preconditions**: empty state shown
**README stories**: S3, S8, S9
**Ideal path**: 4. "GitHub" → pick repository → pick "Open / closed and labels" → "Connect".
**Alternate paths**: none found.

### Steps
1. Click "GitHub" → "Connect GitHub" with "Repository", "Status from", "Access", "Back", "Connect".
2. Open "Repository" → options "acme/launch-site", "acme/api". Picks "acme/api". He thinks: "Is this the repo list from my account? I never logged in."
3. Open "Status from" → "Project field "Status"" and "Open / closed and labels". Picks the second because he has no Project.
4. Leave "Access" on "Read and write" (default) → he hesitates: "Will it close issues when I drag?"
5. Click "Connect" → board.
6. Look for a statement of which rule is in use → expects text like "Columns come from open/closed and labels".
7. Drag "Signup API" (#142) from In progress to In review → toast.

### Walk result
1. OK: form matches S3 (w3-github.png).
2. CONTRADICTS-PLAN: S3 says pick after OAuth or token entry; there is no sign-in or token step, so the list appears without authorization. Mockup-only shortcut, but the real flow adds a step before this one.
3. OK: both options exist. CONFUSING: "Project field "Status"" has nested quotes and no hint of whether it needs a Project to exist.
4. CONFUSING: "Read and write" gives no explanation of what a drag will do. The plan says user drags write to the source and bot status changes need approval; none of that is shown.
5. MISSING: no first-sync progress, no count ("14 issues"), no toast. Board shows all four sources (see intro).
6. CONTRADICTS-PLAN: S3 says the board says which rule is used. Nothing on the board names the rule (walked, text search of header and board).
7. OK: drop toasts "#142 moved to In review and written to GitHub". CONTRADICTS-PLAN for S9: no failure path exists to test.

### Variations / Edge cases
- Choosing "Project field "Status"" for a repo without a Project: no validation or error.
- The ids on cards (#142) tell him it is GitHub, but Notion cards carry no id (see story 04).

---

## CONNECT-SOURCES-FIRST-RUN-04: Product manager maps a Notion database
**Type**: medium  **Persona**: Lena, product manager who plans launches in a Notion database named "Launch tasks"  **Goal**: connect it, map properties, and get dependency arrows on the Timeline
**Preconditions**: empty state shown; her database has "Status", "Owner", "Start", "Due" but no dependency relation
**README stories**: S4, S12
**Ideal path**: 3. "Notion" → "Connect" accepting the defaults. Mapping is the one place where defaults must be right.
**Alternate paths**: none found.

### Steps
1. Click "Notion" → "Connect Notion" with heading "Map properties" inside it.
2. Choose "Database" "Launch tasks" (default) → fields below should refresh for that database.
3. Review "Status", "Assignee", "Start", "End". Sees "Assignee" defaulting to "Owner". She thinks: "In my database Owner means who is accountable. Rakazo has an Owner and an Assignee. Which one am I mapping?"
4. Leave "Blocked by" (optional) at "None" although the dropdown lists "Blocked by" and "Depends on" → she assumes it is off for a reason.
5. Click "Connect" with "Read and write" (default).
6. Open "Timeline" → expects arrows. Gets the note "Notion has no dependency relation" with "Add relation" (after "Notion: no relation" is ticked in the mockup).
7. Click "Add relation" → toast "Sent for approval".

### Walk result
1. CONFUSING: panel has "Connect Notion" h2 and a second h2 "Map properties" directly beneath (w4-notion.png). Two headings for one screen.
2. MISSING: changing "Database" does not change the property options (the options are static). Mockup-only; the real adapter must repopulate.
3. CONFUSING: "Assignee" preselects "Owner". README S29 makes Owner and Assignee separate Rakazo fields; there is no "Owner" mapping row at all, though S4 lists "optional" mapping only for blocked-by and estimate and the capability matrix says Owner is an optional mapped person property. CONTRADICTS-PLAN.
4. OK for the two optionals. CONFUSING: both options are real relations yet default is "None"; the user cannot tell whether "None" means "ignore" or "create one" (S4 says Rakazo offers to create the relation).
5. MISSING: no confirmation, no sync progress.
6. OK: note and button exist on Timeline (h-norel-timeline.png). On Board with no relation there is no note (walk: 0 note rows), so the user who never opens Timeline never learns why "Blocked" markers vanished.
7. CONTRADICTS-PLAN: toast only; S4 requires an approval card. The label "Add relation" does not say it writes a new property into her Notion database.

### Variations / Edge cases
- Notion cards show only a page icon and no id (cards for "Press kit", "Docs site"), so after connecting, a Notion task cannot be told apart by id; this was already flagged in discovery item 13.
- Choosing "Read only" with no "Blocked by": "Add relation" would still be offered although it needs write access.

---

## CONNECT-SOURCES-FIRST-RUN-05: Sync fails and the user retries
**Type**: medium  **Persona**: Tomas, operations manager at a 20-person logistics firm, checks the board before standup  **Goal**: understand why the data may be stale and recover
**Preconditions**: populated board, sync error state (mockup: tick "Sync error")
**README stories**: S2 (retry), S8 (sync-error state), S26
**Ideal path**: 1. Click "Retry" on the banner.
**Alternate paths**: none found (the Sources button has a red dot but is not a retry path).

### Steps
1. Open Projects. Sees red banner "GitHub sync failed" with "Retry", and a red dot on the Sources button.
2. He thinks: "Is the board wrong? How old is it?" He scans the 14 cards, which look normal.
3. Click "Sources" (the button with icons) → dropdown with four checkboxes and counts, no status.
4. Close it. Click "Retry" → button shows "Syncing...".
5. After about a second the banner disappears and a toast says "Synced".

### Walk result
1. OK: `role="alert"` banner and the dot (w7-error.png). Dot is the only sign on the Sources button; the button has no visible name, only icons and counts.
2. MISSING: the banner gives no reason (token expired, rate limit?), no "last synced" time, and GitHub cards are not marked stale. Plan S26 asks for freshness only when stale.
3. CONFUSING: the dropdown lists "GitHub 3" without any error marker, so the red dot has no explanation inside the list that the user opens to find it.
4. OK: "Syncing..." replaces the label (walked). The icon is dropped during the busy state, minor.
5. OK: banner cleared, "Synced" toast. CONTRADICTS-PLAN for nothing, but there is no failed-retry result to test (always succeeds).

### Variations / Edge cases
- Retry fails again: not representable; no second error state or "Reconnect" (token expiry) path.
- Banner reads "GitHub sync failed" even when GitHub is unticked in "Connected" (walk A: banner shown with GitHub removed). Mockup-only since the toggles are independent.
- Sync error while in empty state: banner hidden (walk: 0 banners), correct, since the first-sync failure case from S2 ("retry on failed first sync") has no UI at all.

---

## CONNECT-SOURCES-FIRST-RUN-06: User wants to disconnect Notion and delete its data
**Type**: short  **Persona**: Dev, designer who tried Notion for a month and now wants Rakazo to forget it  **Goal**: remove the Notion source and its synced tasks
**Preconditions**: populated board with all four sources
**README stories**: S7
**Ideal path**: 3. Sources button → "Notion" row action "Disconnect" → confirm "Delete synced data". (The mockup has none of these.)
**Alternate paths**: none found.

### Steps
1. Click "Sources" (icons with counts) → dropdown lists "GitHub 3", "Linear 3", "Notion 4", "Native 6" with checkboxes.
2. Untick "Notion" → expects removal or a menu. Cards disappear from the board.
3. Looks for "Disconnect", "Remove" or a settings link → finds none. Tries "Integrations" in the left nav → inert.

### Walk result
1. OK: dropdown opens (w5-sources.png).
2. CONFUSING: the checkbox is a filter, not a disconnect, but its row sits in a list headed only "Sources". Notion cards vanish and the count text dims; the user concludes the data is gone.
3. MISSING: text search for "disconnect|remove|delete" returned 0 matches in the whole page. README S7 requires disconnect with a choice to delete synced data. Left-nav "Integrations" is static (discovery: not clickable).

### Variations / Edge cases
- The only "disconnect" in the mockup is the "Connected" checkboxes inside "Mockup states". Untick "Linear" there and the Linear count leaves the Sources button. Mockup-only; real users cannot do this.
- Native tasks must survive disconnect (S7): nothing to test.

---

## CONNECT-SOURCES-FIRST-RUN-07: Team lead builds a mixed workspace in one afternoon
**Type**: long  **Persona**: Mara (story 02), now setting up Projects for her 12-person startup: engineering in GitHub, product in Linear, marketing in Notion  **Goal**: connect all three plus native tasks into one project, check the header, filter by source, survive a sync failure, and check read-only behavior
**Preconditions**: first visit; empty state (mockup: tick "Connect source")
**README stories**: S1, S2, S3, S4, S6, S8, S24
**Ideal path**: 9. Connect GitHub (3 clicks), then Linear and Notion from a populated page (about 6 clicks if a "Connect source" control existed), then open Sources.
**Alternate paths**: connect order is free, but only through repeated "Connect source" toggling in mock states.

### Steps
1. Open Projects → empty state with four buttons.
2. Click "GitHub" → "Connect GitHub". She thinks: "I will start with engineering."
3. Pick "acme/api", "Open / closed and labels", leave "Read and write", click "Connect" → board.
4. She wants to add Linear now. Looks for "Add source" in the header → no such control. Opens the Project menu → "Product launch", "Docs refresh", "New project" only.
5. (Mockup workaround) Ticks "Connect source" again → empty state returns. Click "Linear" → "Connect Linear".
6. Pick "Growth", choose "Read only" because the product team shares this workspace, click "Connect".
7. Header now shows a "Read-only" badge. She thinks: "GitHub was supposed to be read and write."
8. Try to drag a GitHub card ("Signup API" #142) → does not move.
9. Repeat the workaround for "Notion": pick "Launch tasks", accept defaults, click "Connect".
10. Read the header → Sources button shows icons with counts "3", "3", "4", "Native 6".
11. Open "Sources" → four rows with checkboxes and counts.
12. Untick "Linear" and "Notion" → board narrows to the GitHub and Native cards (walked with only GitHub ticked: 3 cards); counts for unticked sources dim.
13. Untick all four → blank board, columns with counts of 0.
14. Re-tick all. A sync error appears (mockup: "Sync error"): banner "GitHub sync failed", red dot on Sources.
15. Click "Retry" → "Syncing..." then "Synced".
16. Ask the Project bot to summarize ("Ask bot" button) → panel opens. (Out of scope for this topic, noted.)
17. Switch to "Timeline" and check that all four sources appear as bars → bars appear.

### Walk result
1. OK: empty state as in story 01.
2. OK: form as in story 03.
3. MISSING: no sync count, progress or toast; board shows all four sources immediately (CONTRADICTS-PLAN for S2/S3).
4. MISSING: S6 says one project can combine several sources and v1 includes it, but there is no connect entry on a populated page. Real design gap, not a mockup shortcut.
5. CONFUSING: the empty-state "Connect source" is a mock toggle; a real user would be sent to an empty page again with a wizard for "New project" at the same level as connectors, even though she already has a project.
6. OK for the form. CONFUSING: "Read only" sits next to a prior "Read and write" choice with no per-source memory.
7. CONTRADICTS-PLAN: access is a single `S.ro` flag, so the badge says "Read-only" for the whole board. In the plan it is per tracker (S24).
8. OK that the card is locked (walk: 4 of 14 draggable). CONFUSING: no tooltip explains why.
9. OK for form, same sync gaps as step 3.
10. OK: icons and counts match (GitHub 3, Linear 3, Notion 4, Native 6). Counts ignore the active project and person filter (discovery item 13).
11. OK: dropdown matches (w5-sources.png).
12. OK: filter works. CONFUSING: the same control cannot disconnect (see story 06).
13. CONFUSING: blank board with zero-count columns instead of a "No sources selected" or the connect state (discovery item 21; walked, w9-all-off.png).
14. OK: banner plus dot. MISSING: no reason or last-synced.
15. OK: retry clears. Always succeeds.
16. n/a for this topic.
17. OK: Timeline renders (c-timeline.png). Notion bar labels are blank per discovery item 13 (not re-checked here).

### Variations / Edge cases
- Connect Notion before Linear: no ordering rule; stays valid.
- Disconnect Linear while a bot task is assigned from it: not representable.
- Sync error on a source she disabled via the filter: banner still shows (walked).

---

## CONNECT-SOURCES-FIRST-RUN-08: Reviewer connects Notion from a phone-width window
**Type**: short  **Persona**: Hana, product designer who opens the web app in a narrow browser window on her laptop  **Goal**: finish connecting Notion at 390 px width
**Preconditions**: empty state; viewport 390x844
**README stories**: S4 (README: mobile is a follow-up, so this tests the under-900px responsive shell only)
**Ideal path**: 2. "Notion" → "Connect".
**Alternate paths**: none found.

### Steps
1. Open Projects at 390 px → left nav hidden, heading "Projects" and four buttons.
2. Tap "Notion" → "Connect Notion" form.
3. Scroll to "Connect" → tap.
4. Look at the header → controls.

### Walk result
1. OK: no horizontal scroll (scrollWidth 390, walked; m1-empty.png).
2. OK: form fits, selects are readable, labels wrap ("Blocked by optional" on two lines; m2-notion.png). The "Mockup states" box sits under the form, mockup only.
3. OK: Connect and Back are visible without scrolling in the screenshot.
4. CONFUSING: after connect the header shows project name, view switch, sources, person select, and "Ask bot" (m3-board.png); with the sync error ticked, the banner fits (m4-err.png). Left nav is hidden so the only way back to the connect forms is gone. README says mobile shows nothing new until a follow-up, so a phone-width page showing Projects is arguably CONTRADICTS-PLAN for actual mobile apps; for a narrow desktop window it is fine.

### Variations / Edge cases
- Rotating to landscape or resizing above 900 px restores the nav; not walked.

---

## Findings

Ranked. "Ships" = a real design problem that would ship if the mockup were built as drawn. "Mockup-only" = acceptable prototype shortcut.

1. **High, story 07 (and 06): No way to disconnect, and no way to add a second source from a populated page. Ships.** S6 (combine sources) and S7 (disconnect) are v1 in the README, but the only connect UI is the empty state and the Sources dropdown only filters. Fix: add an "Add source" row (or "Connect another source") at the bottom of the Sources dropdown, opening the same connect panel, and a per-source "Disconnect" action with a confirmation that offers "Delete synced data".
2. **High, stories 02, 07: Access mode is one global flag. Ships if copied.** Choosing Read only for Linear locks GitHub and Notion cards and shows one "Read-only" badge. S24 is per tracker. Fix: store access per source; show a lock only on that source's cards and in its Sources row; show the badge only if all connected trackers are read only.
3. **High, story 01: "New project" shows another project's board. Ships.** S1 promises a working board from nothing. Fix: on "New project", prompt for a name (or use "Untitled project"), show empty columns with an "Add task" control, and give native tasks title, status, assignee, dates.
4. **Medium, stories 03, 04: Mapping defaults and copy collide with Owner vs Assignee.** The Notion form preselects Owner for "Assignee" while Rakazo has its own Owner (S29, capability matrix has an optional Owner mapping). Fix: add an optional "Owner" row and default Assignee to a property named like "Assignee" or "Assigned to", or to "None" if unsure.
5. **Medium, stories 02, 03, 04, 07: No sign-in, first-sync progress or count (S2, S3, S4). Partly mockup-only.** Everything appears instantly and all sources appear after one connect. Fix for the real build: after "Connect" show a sync state with "Syncing 42 issues" and a "Retry" on failure; the mockup could add one toast "Synced 14 tasks" and show only the connected source's cards.
6. **Medium, stories 03: The board never names its status rule (S3).** Fix: show a quiet line in the Sources dropdown row ("Status: open/closed and labels") or in the source drawer chip; no persistent banner (copy budget).
7. **Medium, story 05: Sync error banner lacks reason and age.** "GitHub sync failed" plus "Retry" gives no cause or "last synced" time, and the dot is the only marker on the Sources button, with no matching mark inside the dropdown. Fix: add "Last synced 2h ago" to the banner and a red dot beside the GitHub row in the dropdown; keep "Retry". Add a "Reconnect" variant for expired tokens.
8. **Medium, story 04: "Notion has no dependency relation" appears only on Timeline.** A user who stays on Board loses "Blocked" markers silently. Fix: show the same note once on first Board load after connect, or inside the Notion Sources row.
9. **Medium, story 02: Single-select "Team".** S2 says teams, plural. Fix: multi-select checkboxes with default "All teams".
10. **Low, stories 02, 03, 04: Access toggle has no explanation.** The words "Read only" and "Read and write" are ambiguous to a user who does not know the bot needs approval. Fix: add a tooltip or one short helper line under the toggle only when "Read and write" is chosen ("Moves you make are saved to GitHub"). Watch the copy rule in AGENTS.md: quote and justify the copy in the PR.
11. **Low, story 04: Duplicate headings.** "Connect Notion" then "Map properties". Fix: drop the second heading or make it a section label.
12. **Low, stories 02, 07: Locked cards have no explanation.** Read-only drag does nothing silently. Fix: tooltip on hover of a locked card ("Read only. Change access in Sources").
13. **Low, story 07 step 13: Unticking every source gives a blank board.** Fix: show the empty or "No sources selected" state with "Select all".
14. **Low, story 05: Banner persists for a source that is filtered off or disconnected.** Mockup-only (toggles are independent).
15. **Low, stories 01, 02, 03, 04: Mockup shortcuts, fine for a mockup.** Empty state is reachable only via the "Mockup states" box; connect forms don't change data; "Docs refresh" shows the same tasks; "Add relation" only toasts; Retry always succeeds; no OAuth.
16. **Low, story 08: Access state is sticky across connect forms.** Back from GitHub with "Read only" leaves "Read only" on Linear. Fix: reset the toggle to the default per form, or store access per source.
