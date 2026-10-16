# UX Paths catalog: Rakazo Projects (mockup)

> Walked against the mockup before the fixes in this change; findings are kept as the record of what was fixed. See the Status column in the consolidated findings of catalog.md.

Generated 2026-10-16 by the Consolidation agent from `discovery.md` and five topic files in `topics/`. Scope: the planned Projects page and Project bot, walked against `docs/project-management/mockup.html`.

- Total stories: **41** (43 written across five topics; 2 near-duplicates merged, see "All stories").
- By type: short 17, medium 19, long 5.
- README story coverage: **26 of 30 (87%)** exercised by at least one journey. Not exercised: S5, S21, S22, S25. Of the covered ones, S15 and S19 are touched only as "the feature is missing" probes (both are "later" in the README).
- Walk ratings used in the Walk result lines: OK, MISSING (README requires, mockup has no UI), CONFUSING, CONTRADICTS-PLAN.
- Raw mockup state: every journey starts from the same seeded board. The mockup keeps no state between journeys (reload resets) and "Connect" does not change data, so the dependency graph below describes the real product, not the prototype.

## 1. Summary by type

| Type | Count | Story ids |
|---|---|---|
| short | 17 | 001, 002, 006, 008, 009, 010, 011, 018, 019, 026, 027, 028, 032, 034, 036, 037, 041 |
| medium | 19 | 003, 004, 005, 012, 013, 014, 015, 017, 020, 021, 022, 023, 024, 029, 030, 031, 033, 038, 039 |
| long | 5 | 007, 016, 025, 035, 040 |

By topic: connect-sources-first-run 001-008 (8), board-work 009-017 (9, includes merged delegate-04 and delegate-06 as variations), timeline-planning 018-026 (9), bot-conversation-approvals 027-035 (9), delegate-to-bots-ownership 036-041 (6 after merges). Id mapping from the old topic ids is shown under each story title.

## 2. Coverage matrix: README story to journeys

| Story | Title | Journeys | Gaps |
|---|---|---|---|
| S1 | Start with no tracker | STORY-001, STORY-007 | No walkable create-task or empty-board flow; "New project" shows another project (A3). |
| S2 | Connect Linear | STORY-002, STORY-005, STORY-007 | No OAuth, first-sync count/progress, multi-team pick, or first-sync retry; only the access toggle is walked. |
| S3 | Connect GitHub | STORY-003, STORY-007 | No sign-in/token step; board never names its status rule; no repo-without-Project validation. |
| S4 | Connect Notion | STORY-004, STORY-007, STORY-008, STORY-023 | No Owner mapping row, Database change does not refresh properties, "Add relation" has no approval card. |
| S5 | Another tracker (later) | **none** | Not walked (later). Check only that no UI implies Jira/Asana support. |
| S6 | Switch or combine sources | STORY-007 | "Combine" has no entry point on a populated page; "Move to Linear" is later and unwalked. |
| S7 | Disconnect | STORY-006 | No journey can succeed: no Disconnect or Delete synced data control exists. |
| S8 | See the board | STORY-001, STORY-003, STORY-005, STORY-007, STORY-009, STORY-012, STORY-016, STORY-017, STORY-036 | Empty board and empty column states not walked (do not exist in the mockup). |
| S9 | Move a card | STORY-003, STORY-010, STORY-011, STORY-012, STORY-015, STORY-016, STORY-017 | Failed-write revert not walkable; no non-drag way to move; no undo. |
| S10 | Filter and group | STORY-013, STORY-014, STORY-016, STORY-025, STORY-040 | Label and project filters and a distinct owner filter not walked (do not exist). |
| S11 | WIP limit (later) | STORY-010, STORY-016 | Later in README; only the over-limit display is seen. No journey for setting a limit. |
| S12 | See the timeline | STORY-004, STORY-018, STORY-019, STORY-022, STORY-023, STORY-025, STORY-026, STORY-040 | Zoom (week/month/quarter) and project-or-phase grouping not walked (absent). |
| S13 | Reschedule by dragging | STORY-020, STORY-021, STORY-024, STORY-025 | Edge-resize and save/cancel preview not walked (absent); only whole-bar drag. |
| S14 | Critical path and slips | STORY-018, STORY-020, STORY-021, STORY-022, STORY-023, STORY-025 | Critical path is hardcoded; no journey where it recomputes. |
| S15 | Cascade a slip (later) | STORY-021 | Only probed as a missing hint on the conflict marker. No journey for the preview-only v1 behaviour. |
| S16 | Ask about the project | STORY-027, STORY-031, STORY-034, STORY-035 | Free-text asking not walkable (composer inert); only canned answers and citations. |
| S17 | Create tasks from a description | STORY-029, STORY-035 | Tracker-project variant (suggestion with "Open in <source>") not walkable; "Edit" is a no-op; pasted-text input not walkable. |
| S18 | Triage | STORY-030, STORY-032, STORY-035 | Triage list, duplicate and label suggestions not walked; only per-task suggestion cards. |
| S19 | Reschedule and re-plan (later) | STORY-030 | Only a canned tracker suggestion; no timeline preview of a slip. |
| S20 | Status report and standup | STORY-031, STORY-035 | No on-demand generate control; only the canned report. Scheduled is later. |
| S21 | Stale-task nudge (later) | **none** | No journey (later). |
| S22 | Estimate (later) | **none** | No journey (later). |
| S23 | Bot read-only for trackers except status | STORY-012, STORY-015, STORY-016, STORY-028, STORY-029, STORY-030, STORY-032, STORY-033, STORY-035, STORY-038 | "Always allow this kind" rule not walkable; approved/rejected states do not exist; native approval card absent for drawer Accept. |
| S24 | Read-only mode | STORY-002, STORY-007, STORY-015, STORY-025, STORY-033 | Per-tracker access not walkable (one global flag); tooltip explanation absent. |
| S25 | Space and user scoping | **none** | NO JOURNEY. Needs a two-member journey: shared native project, private tracker data, member leaves. |
| S26 | Sync and conflicts | STORY-005, STORY-024 | Stale-only sync indicator and refresh-on-open not walked; conflict modal reachable only by toggle. |
| S27 | Task detail | STORY-011, STORY-016, STORY-019, STORY-027, STORY-035 | Editing fields, comments, and links to a per-task URL not walkable; drawer is read-only. |
| S28 | See where each task comes from | STORY-009, STORY-012, STORY-016, STORY-027, STORY-038, STORY-040 | Legend/consistent ids for Notion not available; Sources filter walked, source row walked. |
| S29 | Owner | STORY-013, STORY-014, STORY-016, STORY-036, STORY-040 | No Owner filter, no editing Owner, Owner not on cards. |
| S30 | Send a task to a bot | STORY-013, STORY-014, STORY-015, STORY-016, STORY-032, STORY-036, STORY-037, STORY-038, STORY-039, STORY-040, STORY-041 | No unassign or reassign to a person; Project bot thread is generic; bot never finishes. |

## 3. Dependency graph

The mockup does not carry state between journeys (reload resets everything), so nothing here is a hard prerequisite in the prototype. The tree shows what each journey would need to have happened first in the shipped product, and where the topic authors reused another journey's persona or state.

```
First run (no state)
  STORY-001 Start with no tracker, native project
  |   +-- creates the native project used by: 009-017 (board), 018-026 (timeline), 027-035 (bot), 036-041 (delegate)
  |   +-- STORY-029 Create tasks from a description (needs a native project to create into)
  STORY-002 Connect Linear read-only ----> STORY-015 Read-only drag lock, STORY-033 Read-only bot card
  STORY-003 Connect GitHub ------------> STORY-012 Move GitHub card to Done, STORY-028 Approve closing #142, STORY-020/021 drag writes to GitHub
  STORY-004 Connect and map Notion ----> STORY-023 Notion no dependency relation, STORY-025 (part)
  STORY-007 Mixed workspace (long) = 001 + 002 + 003 + 004 + 005
      +-- STORY-005 Sync fails and retry (needs any connected source)
      +-- STORY-006 Disconnect (needs a connected source; no UI exists)
Any populated board
  STORY-009 Read a card / Blocked ---> STORY-011 Keyboard open, STORY-012 move + unblock
  STORY-010 Native drag, WIP -------> STORY-016 Clear WIP overload (long)
  STORY-013 Group by assignee ------> STORY-036 Hand task to Research, STORY-040 Plan week by lane (long)
  STORY-014 Filter owner/assignee (merged from delegate-04)
  STORY-018 Timeline first look ----> STORY-020 Fix a conflict, STORY-021 Slip a blocker, STORY-025 Weekly plan (long)
  STORY-019 Unscheduled lane
  STORY-022 Critical path and milestone
  STORY-024 Update conflict (needs a drag/write to a tracker in the real product)
Bot panel
  STORY-027 Ask what is blocked -----> STORY-035 Friday wrap-up (long) = 027 + 029 + 028 + 030 + 031
  STORY-032 Drawer suggestion ------> STORY-038 Send to Project bot (shared suggestion state)
Delegation
  STORY-036 Send to Research -------> STORY-037 Check on Writer thread, STORY-039 Take task back, STORY-040
Narrow-width variants (independent): 008, 017, 026, 034, 041
```

Long journeys and what they compose: 007 = connect journeys 001-005; 016 = 009 + 010 + 013 + 032 + 036; 025 = 018 + 020 + 021 (and filter/Sources checks); 035 = 027 + 028 + 029 + 030 + 031; 040 = 013 + 036 + 018 + 037.

## 4. All stories

Stories keep their original text and Walk result lines; headings use the new STORY-nnn ids with the old id under the title. Merges: DELEGATE-TO-BOTS-OWNERSHIP-04 (owner vs assignee filter) was merged into STORY-014 (filter), and DELEGATE-TO-BOTS-OWNERSHIP-06 (delegating in read-only) into STORY-015 (read-only lock); both keep their steps and Walk results under "Merged in". Cross references inside story text to old numbers (for example "story 04") refer to the old id of the same topic.

## STORY-001: Founder starts with no tracker  
*(was CONNECT-SOURCES-FIRST-RUN-01)*
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

## STORY-002: Team lead connects Linear, read only  
*(was CONNECT-SOURCES-FIRST-RUN-02)*
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

## STORY-003: Developer connects a GitHub repo and reads the status rule  
*(was CONNECT-SOURCES-FIRST-RUN-03)*
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

## STORY-004: Product manager maps a Notion database  
*(was CONNECT-SOURCES-FIRST-RUN-04)*
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

## STORY-005: Sync fails and the user retries  
*(was CONNECT-SOURCES-FIRST-RUN-05)*
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

## STORY-006: User wants to disconnect Notion and delete its data  
*(was CONNECT-SOURCES-FIRST-RUN-06)*
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

## STORY-007: Team lead builds a mixed workspace in one afternoon  
*(was CONNECT-SOURCES-FIRST-RUN-07)*
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

## STORY-008: Reviewer connects Notion from a phone-width window  
*(was CONNECT-SOURCES-FIRST-RUN-08)*
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

## STORY-009: Read a card and find out why it is Blocked  
*(was BOARD-WORK-01)*
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup, opening Projects for the first time this week
**Goal**: Understand what a card says and which task blocks "Load testing".
**Preconditions**: Default mockup state (all four sources connected, board view).
**README stories**: S8, S28
**Ideal path**: 2 steps (hover the Blocked marker, read the tooltip). Hover is the cheapest way to see the blocker name.
**Alternate paths**: Click the card, read "Blocked by" in the drawer (3 steps, also shows blocker status). Timeline view shows the dependency arrow (not walked here).

### Steps
1. Open "Projects" in the left nav, look at the Board. → Five columns Backlog, Todo, In progress, In review, Done with counts. Mara is thinking: "What are these little icons next to the numbers?"
2. Read the "Load testing" card in Todo. → Title, `#151` with a GitHub icon, `backend` tag, red `Blocked`, avatar "D", "Due Nov 20".
3. Hover the red "Blocked" marker. → Tooltip "Blocked by Billing integration". Mara is thinking: "Is that the whole list? Is it blocked right now or just has a dependency?"
4. Click the card. → Task drawer opens with "BLOCKED BY" listing `#145 Billing integration Todo`.

### Walk result
1. OK: board renders with counts (`Backlog 5`, `Todo 3`, ...), no console errors.
2. OK for GitHub and Linear (icon + id). CONFUSING: Notion cards (Pricing model, Docs site, Press kit, Post-launch survey) show only a page icon and no id, and native cards show `PL-n` with no icon, so the id column looks inconsistent (matches S28 but needs a legend). The source icons have no label other than a hover title.
3. OK but weak: the blocker list is a native `title` tooltip, so it does not work on touch or with the keyboard, and shows names only, not status. Verified: `Blocked by Billing integration`.
4. OK: drawer lists `#145 Billing integration Todo`. The drawer then shows a "Suggestion" whose reason reads "Blocker is still in progress" while the blocker is in Todo (CONFUSING copy).

### Variations / Edge cases
- A card with two blockers (Go/no-go review) shows "Blocked by Load testing, Support runbook" in one comma list.
- Moving the blocker to Done removes the marker from its dependents (walked in BOARD-WORK-04).
- Turning on "Notion: no relation" removes the Blocked marker on any card with a Notion blocker or dependent without saying so (the board silently under-reports blocking).

---

## STORY-010: Drag a native card to In progress  
*(was BOARD-WORK-02)*
**Type**: short  **Persona**: Teo, solo founder using Rakazo with no tracker
**Goal**: Mark "Support runbook" (PL-12) as started.
**Preconditions**: Default mockup state.
**README stories**: S9, S11
**Ideal path**: 1 drag. Nothing shorter exists.
**Alternate paths**: none found (the drawer Status field is plain text, see BOARD-WORK-03).

### Steps
1. Press and drag "Support runbook" from Todo toward In progress. → Card dims, target column gets a dashed outline.
2. Drop it in the "In progress" column. → Card appears there; toast "PL-12 moved to In progress". Teo is thinking: "The header turned amber. Did I do something wrong?"
3. Look at the "In progress" header. → "4 / 2" with a warning icon.
4. Hover the header. → Tooltip "Over the limit of 2".

### Walk result
1. OK: native HTML5 drag works in Chromium; `.drag` opacity applied.
2. OK: toast "PL-12 moved to In progress", no "written to" suffix for native tasks (correct per mockup).
3. CONFUSING: Teo never set a limit and the board has no control to set or change one ("No UI to set limits"). The number "4 / 2" has no explanation until hover. CONTRADICTS-PLAN: README Decision 11 and S11 mark WIP limits "later", yet the mockup shows one by default.
4. OK: tooltip text verified (`title="Over the limit of 2"`). Not available on touch or keyboard.

### Variations / Edge cases
- Dropping on a column the card is already in re-renders with no toast.
- Dropping onto another card (not the empty cell area) works because the card sits inside the cell.
- Reload resets all moves (mockup has no persistence; fine for a mockup).

---

## STORY-011: Open a card from the keyboard and try to change its status  
*(was BOARD-WORK-03)*
**Type**: short  **Persona**: Ines, power user who avoids the mouse
**Goal**: Move "Billing integration" to In review without dragging.
**Preconditions**: Default mockup state.
**README stories**: S27, S9
**Ideal path**: 3 steps (Tab to the card, Enter, change Status in the drawer). The mockup cannot do the last step.
**Alternate paths**: none found.

### Steps
1. Tab to the "Billing integration" card. → Visible focus ring. Ines is thinking: "Is this card a button? How do I move it?"
2. Press Enter. → Task drawer slides in with the title, "Send to bot", the source row "GitHub issue #145 · acme/web", "Synced 2 min ago", "Open in GitHub".
3. Look for a way to change Status. → The Status row shows "Todo" as text.
4. Press Escape. → Drawer closes.

### Walk result
1. OK: cards have `tabindex=0` and a focus-visible outline. CONFUSING for screen readers: the card has no `role` or accessible name beyond its text.
2. OK: Enter opens the drawer; verified fields Status, Owner, Assignee, Dates, Label, Estimate.
3. MISSING: the drawer has no select, input or editable control (0 found). S27 says edits go "through the same write path as drag-and-drop", and S9 offers no other way to change status. A keyboard-only or touch user has no way to change status at all. Real design problem, see Findings.
4. OK: Escape closes. CONFUSING: focus is not returned to the card (activeElement is `BODY`), so Ines must Tab from the top again.

### Variations / Edge cases
- Clicking the scrim also closes the drawer.
- There is no keyboard equivalent to drag (no "Move to" menu on a card).

---

## STORY-012: Move a GitHub card to Done and see what it unblocks  
*(was BOARD-WORK-04)*
**Type**: medium  **Persona**: Dev, backend engineer on a 12-person team
**Goal**: Close "Signup API" (#142) and confirm the work waiting on it is now free.
**Preconditions**: Default mockup state, Read and write access.
**README stories**: S9, S8, S23, S28
**Ideal path**: 2 steps (drag, read the toast). The unblocked check is passive.
**Alternate paths**: Ask the bot "Signup API is done" and approve the "Change status" card in the panel (Ask bot, scroll to Change status, Approve; 4+ steps). This is the bot path; the user's own drag needs no approval per README.

### Steps
1. Find "Signup API" in In progress: `#142`, `backend`, avatar D, "Due Oct 26". → Visible. Dev is thinking: "It is a GitHub issue. Will this change the issue itself?"
2. Drag it to Done. → Card moves; toast "#142 moved to Done and written to GitHub".
3. Look at the "In progress" header. → "2 / 2", amber tint gone.
4. Scan for "Blocked" markers. → "Billing integration" and "Docs site" lose their red marker (blocker finished). "Load testing" is still Blocked (by Billing integration).
5. Hover the "Blocked" marker on Load testing. → "Blocked by Billing integration" (changed from before).
6. Try moving "Load testing" straight to Done (it is still blocked). → Moves with toast "#151 moved to Done and written to GitHub". Dev is thinking: "Nothing warned me that its blocker is still open."

### Walk result
1. OK: id and icon visible. CONFUSING: nothing on the card says the move will write to GitHub until after the drop.
2. OK, verified toast text. The toast stays about 2 seconds, which is the only confirmation. MISSING (S9): no failure path (card returning plus inline error) and no pending state, so a slow GitHub write looks identical to a native one.
3. OK: header re-evaluates to `2 / 2` and no `over` class.
4. OK: derived marker updates (before: 7 blocked cards; after: `Security review, Press kit, Go/no-go review, Load testing, Onboarding emails`). Moving the blocker did not change the dependents' status, which is correct.
5. OK.
6. MISSING: no check or warning when a blocked card is moved to In progress or Done. Not required by README, but a reviewer would expect at least the existing red marker to say it conflicts with the new column.

### Variations / Edge cases
- Notion card: "Docs site moved to In review and written to Notion".
- Linear card: "ENG-31 moved to Done and written to Linear".
- The same toast text is used with and without the bot: "written to" never says who wrote it.
- "Sync error" state does not change drag behavior (no organic trigger, mockup-only).

---

## STORY-013: Find what the bots are working on with Group by assignee  
*(was BOARD-WORK-05)*
**Type**: medium  **Persona**: Nadia, ops lead who delegates drafts to Writer and Research
**Goal**: See each person's and each bot's load, then check where "Landing page design" went.
**Preconditions**: Default mockup state.
**README stories**: S10, S30, S29
**Ideal path**: 2 steps (click "Group by assignee", scroll to the bot lanes).
**Alternate paths**: "Filter by person or bot" set to Research (1 step) shows only Research's cards but without lane context.

### Steps
1. Click "Group by assignee" in the header. → Button turns black; the board splits into lanes.
2. Read the lane headings. → "Ada Park 2", "Bo Reyes 3", "Cy Novak 2", "Di Okafor 2", "Eli Brandt 1", then "Research 1", "Writer 2", then "Unassigned 1". Nadia is thinking: "Good, bots come after people."
3. Look for "Landing page design" (ENG-31). → It is in the Research lane, not Cy Novak's (Cy is its Linear assignee). Nadia is thinking: "Why is Cy not on this one?"
4. Open the card and read the Assignee row. → "Research · working on it" with an "Open thread" button.
5. Drag "Landing page design" from the Research lane into the Writer lane's Done cell. → Toast "ENG-31 moved to Done and written to Linear". The card stays in the Research lane, in Done.
6. Click "Group by assignee" again. → Back to the flat board.

### Walk result
1. OK: toggle works and shows `aria-pressed`. Header counts (In review 3, Done 1) do not change with grouping. (Counts are per column, OK.)
2. OK: lane order verified. Empty lanes are omitted. The lane count badge is small (`.sub`) but legible.
3. CONFUSING: the card shows avatar "R" only; nothing says Cy is still the Linear assignee (S30: "the tracker's assignee is unchanged"). A user who knew Cy owned the design will think it was reassigned in Linear.
4. OK: Assignee row verified ("Research · working on it", "Open thread"). CONFUSING: Owner is Ada Park, who is not visible anywhere on the card.
5. CONFUSING: a cross-lane drop silently changes status only; a lane drop does not reassign. Standard swimlane boards reassign on cross-lane drops, so the card jumping back to its old lane looks like a bug.
6. OK.

### Variations / Edge cases
- The "Unassigned" lane disappears once its only card is sent to a bot.
- With 8 lanes the page is long and the column headers scroll away (headers are not sticky); at 860px height the lower lanes are below the fold.
- The "Mockup states" button overlaps the lower lanes (mockup-only).

---

## STORY-014: Filter to one person or bot and read the result  
*(was BOARD-WORK-06)*
**Type**: medium  **Persona**: Omar, team lead reviewing Ada's and Cy's load
**Goal**: See only Ada's work, then Cy's, then the Research bot's.
**Preconditions**: Default mockup state, Group by assignee off.
**README stories**: S10, S29
**Ideal path**: 1 step per person (pick from "Filter by person or bot").
**Alternate paths**: Group by assignee shows everyone at once (1 step), but no filtering.

### Steps
1. Open "Filter by person or bot" (shows "Everyone"). → Options grouped People (Ada Park, Bo Reyes, Cy Novak, Di Okafor, Eli Brandt) and Bots (Project bot, Research, Writer).
2. Choose "Ada Park". → Board narrows to cards she owns or is assigned: Docs site, Scope brief, Pricing model, Press kit, Post-launch survey, Partner outreach list, Landing page design, Onboarding emails. Omar is thinking: "Ada is only assigned to two of these. Why do I see Pricing model with Bo's avatar?"
3. Check the "In progress" header. → "1 / 2", no tint.
4. Choose "Cy Novak". → Onboarding emails and Support runbook (both In progress) appear; "In progress 2 / 2".
5. Notice Landing page design is missing. → It is assigned to Cy in Linear, but its bot assignee is Research, so it is excluded.
6. Choose "Research". → One card, Landing page design, with In review 1, all other columns 0.
7. Choose "Project bot". → Board shows five empty columns with 0 and no message.
8. Choose "Everyone". → Full board returns.

### Walk result
1. OK: grouped select verified.
2. CONFUSING: the filter matches owner OR assignee, with no label saying so. CONTRADICTS-PLAN: README S29 says the board can "filter by owner" as a distinct filter; the mockup has one mixed filter (`fOk` matches owner or assignee). Verified: with Ada selected, Bo's card "Pricing model" shows because Ada owns it.
3. CONFUSING: WIP counts follow the filter, so Ada's "1 / 2" hides that the whole column is "3 / 2". A WIP limit is a column property, so a filter should not make the warning disappear. The seed board's "3 / 2" is replaced by "1 / 2" with no hint.
4. OK: verified counts.
5. CONFUSING: a bot-assigned card is hidden from the human assignee's filter, with no indicator. Cy's load looks lighter than it is.
6. OK.
7. MISSING: no empty state or "No tasks" text; just empty columns. The mockup notes that empty columns have no text.
8. OK.

### Variations / Edge cases
- Group by assignee combined with a person filter still shows lanes for other people (Ada filter shows Bo's lane because Ada owns Pricing model), which defeats the point of grouping.
- The filter does not persist across reload (mockup).
- Label and project filters named in S10 do not exist (MISSING, listed in discovery).

#### Merged in from DELEGATE-TO-BOTS-OWNERSHIP-04: DELEGATE-TO-BOTS-OWNERSHIP-04: Who is accountable vs who is doing it
**Type**: medium  **Persona**: Priya, ops lead, reviews her team's load before a Monday check-in  **Goal**: Tell the Owner (accountable) from the Assignee (working) for bot-held tasks, and filter each way  
**Preconditions**: Default state, Board view  
**README stories**: S29, S30, S10  
**Ideal path**: 6 steps. There is no separate Owner filter, so this is the shortest route that surfaces both.  
**Alternate paths**: "Group by assignee" shows assignees only (bot lanes) and does not show owners.

##### Steps
1. Click "Press kit" → drawer shows Owner "Ada Park" above Assignee "Writer · working on it". Priya understands: Ada answers for it, Writer does it.
2. Close the drawer (Escape).
3. Open the select "Filter by person or bot" → groups "People" (Ada Park ... Eli Brandt) and "Bots" (Project bot, Research, Writer).
4. Pick "Ada Park" → board shows 8 cards, including bot-held ones (Press kit, Post-launch survey, Landing page design).
5. Pick "Cy Novak" → only "Onboarding emails". Priya expected ENG-31 "Landing page design" too (Cy is its Linear assignee).
6. Pick "Writer" → "Press kit", "Post-launch survey".

##### Walk result
1. OK: Owner is above Assignee with avatars, matching S29.
2. OK: Escape closes the drawer.
3. OK: select and optgroups exist.
4. CONFUSING: the filter matches owner or assignee, so Ada's list mixes tasks she owns with tasks she is doing; the card shows only the assignee. A reader cannot tell why a card with a W avatar appears under Ada. S29 asks for an owner filter.
5. CONFUSING: ENG-31 is hidden from Cy because the bot holds it (`fOk` ignores a person's assignee when a bot is set). Cy's real Linear assignment disappears from his own view.
6. OK: the bot filter matches only bot-held tasks.

##### Variations / Edge cases
- Owner is never visible on cards or in the timeline, only in the drawer.
- Owner and Assignee are plain text, not editable; there is no way to change owner.

*(Merged near-duplicate: DELEGATE-TO-BOTS-OWNERSHIP-04 is now covered here. Its README stories: S29, S30, S10.)*

---

## STORY-015: Connect read-only and try to move a card  
*(was BOARD-WORK-07)*
**Type**: medium  **Persona**: Kit, cautious engineer who wants Rakazo to never touch the tracker
**Goal**: Confirm that tracker cards cannot be moved while native cards still can.
**Preconditions**: Mockup states menu: "Read-only" checked (equivalent of connecting with Access "Read only").
**README stories**: S24, S9, S23
**Ideal path**: 2 steps (read the badge, try a drag and read the reason).
**Alternate paths**: none found.

### Steps
1. Open "Mockup states" and check "Read-only". → A "Read-only" badge with a lock appears next to the filter.
2. Drag "Billing integration" (GitHub) to Done. → Nothing moves; no toast, no message. Kit is thinking: "Is the board broken or is this the lock?"
3. Hover the card. → Cursor is a pointer, not a grab hand. No tooltip.
4. Drag native "Support runbook" to Done. → Moves; toast "PL-12 moved to Done".
5. Click "Billing integration". → Drawer opens as normal, with "Open in GitHub" and a Status row that is text.
6. Click "Ask bot". → Panel opens and still shows the "Change status" approval card for GitHub #142 with "Approve" and "Reject".

### Walk result
1. OK: badge verified ("Read-only"). The badge says nothing about which source is read-only (one lock for all).
2. CONTRADICTS-PLAN: S24 says "Drag and drop is disabled with an explanation in the tooltip"; the mockup disables drag silently. Verified: `draggable` false on all non-native cards, card stays in Todo, the previous toast is still on screen from an earlier action (no new message).
3. CONFUSING: the cursor change is the only signal and there is no tooltip (the mockup's own state list says "no tooltip explanation").
4. OK: native tasks remain draggable, which matches the plan's "native is not read-only". CONFUSING: with a mix of draggable and non-draggable cards on one board and no marker, users cannot tell which will move.
5. OK.
6. CONTRADICTS-PLAN: S24 says a read-only connection also removes the bot's status change; the mockup still shows the approval card.

### Variations / Edge cases
- A read-only Linear plus read-write GitHub is not representable (one global switch).
- Group by assignee in read-only works unchanged; cross-lane drops are blocked for tracker cards.

#### Merged in from DELEGATE-TO-BOTS-OWNERSHIP-06: DELEGATE-TO-BOTS-OWNERSHIP-06: Delegating in a read-only connection
**Type**: medium  **Persona**: Hana, cautious CTO, connected GitHub as "Read only"  **Goal**: Understand what she can and cannot do with bots when the tracker is read-only  
**Preconditions**: Mockup states menu: toggle "Read-only" on  
**README stories**: S24, S30, S23  
**Ideal path**: 6 steps.  
**Alternate paths**: Connect flow "Access: Read only" sets the same mode (needs the "Connect source" state).

##### Steps
1. Open "Mockup states", tick "Read-only" → header badge "Read-only" with a lock.
2. Try to drag "Signup API" (#142) to another column → the card does not move (draggable is off); no tooltip explains it.
3. Click "Signup API" → drawer opens; click "Send to bot", then "Research".
4. Toast "Sent to Research"; Assignee row "Research · working on it". Hana thinks: "I said read only; did it write to GitHub?"
5. Click "Open thread" → thread shows "Signup API", "Working on it", "Open in GitHub".
6. Close, click "Ask bot" → the Project bot thread still shows the "Change status" card for #142 with "Approve" and "Reject".

##### Walk result
1. OK: badge text `Read-only`.
2. CONFUSING: GitHub card `draggable` is null, native cards remain true. No explanation (README S24 requires a tooltip).
3. OK: Send to bot works and is not blocked.
4. OK in behaviour (bot assignment is Rakazo-side per S30), but MISSING reassurance. This is a fine design if the row says it stays in Rakazo; today it does not.
5. OK: thread text `Signup API Working on it Signup API #142 Open in GitHub`.
6. CONTRADICTS-PLAN: `Change status ... Approve` is shown (count 1 each) in read-only mode; S24 removes the bot's status change.

##### Variations / Edge cases
- A bot working a read-only task can never write status back; the thread would need to say so.
- Hover over the lock badge: nothing.

*(Merged near-duplicate: DELEGATE-TO-BOTS-OWNERSHIP-06 is now covered here. Its README stories: S24, S30, S23.)*

---

## STORY-016: Clear the WIP overload before standup (long)  
*(was BOARD-WORK-08)*
**Type**: long  **Persona**: Priya, eng manager at a 12-person startup, 10 minutes before standup
**Goal**: Get "In progress" back under its limit of 2, make sure nothing blocked is being worked on, and hand the unassigned task to a bot.
**Preconditions**: Default mockup state.
**README stories**: S8, S9, S10, S11, S27, S28, S29, S30, S23
**Ideal path**: 6 (see the amber header, hover for the limit, open the blocked card to confirm it is blocked, drag it back to Todo, check the header, send the unassigned task to a bot). Group by assignee is optional.
**Alternate paths**: Ask the bot "What is blocked this week?" (Ask bot, read "3 blocked tasks"); that answer is canned and omits Docs site.

### Steps
1. Open "Projects" and read the board header row. → "In progress" has an amber tint, warning icon and "3 / 2".
2. Hover the "In progress" header. → Tooltip "Over the limit of 2". Priya is thinking: "Who is overloaded?"
3. Click "Group by assignee". → Lanes by person, then Research, Writer, Unassigned.
4. Find the In progress cards: "Docs site" (Ada), "Onboarding emails" (Cy), "Signup API" (Di). → Each in its person's lane. Priya is thinking: "Docs site has a red Blocked marker. Why is it in progress?"
5. Hover the Blocked marker on "Docs site". → "Blocked by Signup API".
6. Click "Docs site". → Drawer: "Notion page · Launch tasks", "Synced 12 min ago", "Open in Notion", Owner Ada Park, Assignee Ada Park, Status In progress, "BLOCKED BY #142 Signup API In progress".
7. Click the "Signup API" chip in the drawer. → Drawer switches to Signup API (GitHub issue #142).
8. Press Escape. → Drawer closes.
9. Drag "Docs site" from In progress to Todo inside Ada Park's lane. → Toast "Docs site moved to Todo and written to Notion".
10. Look at the "In progress" header. → "2 / 2", tint gone. Todo now shows 4.
11. Find "Partner outreach list" in the Unassigned lane. → `PL-16`, `growth`, avatar "?", "No date".
12. Click it. → Drawer shows Assignee "Unassigned", Dates "Unscheduled", Estimate "None", and a "Suggestion: Assign to Cy Novak, Lowest open load this week" with "Accept" and "Dismiss".
13. Click "Accept". → Toast "Sent for approval". Priya is thinking: "Where is the approval? Did it assign?"
14. Look at the Assignee row. → Still "Unassigned".
15. Click "Send to bot" in the drawer header. → Menu: Project bot, Research, Writer.
16. Choose "Writer". → Toast "Sent to Writer"; Assignee becomes "Writer · working on it" with "Open thread".
17. Press Escape. → Drawer closes; the card moves to the Writer lane (Writer now 3), the Unassigned lane disappears.
18. Click the card, then "Open thread". → Drawer closes, the bot panel opens with a thread titled "Writer": the task as a message and a "Working on it" card with "Open in" absent (native task).
19. Click the panel's close button. → Panel closes, board returns to full width.
20. Click "Group by assignee" again. → Flat board.

### Walk result
1. OK: verified `In progress3 / 2 [OVER]`.
2. OK: tooltip verified. Native `title`, delayed, not on touch.
3. OK.
4. OK: Docs site, Onboarding emails and Signup API sit in Ada, Cy and Di lanes. CONFUSING: In group mode the column headers are at the top of the page and scroll away, so the amber "In progress" header from step 1 is not visible while Priya moves cards in lower lanes.
5. OK: verified.
6. OK. CONFUSING: Notion cards have no id in the drawer chips (the Notion blocker shows "Page" or blank), though Signup API shows `#142`.
7. OK: blocker chip navigates to the blocker's drawer (verified title "Signup API"). There is no "back" to the previous task.
8. OK. CONFUSING: focus is lost to `BODY`, not returned to the card.
9. OK: toast verified ("Docs site moved to Todo and written to Notion"). MISSING: no undo, and Priya has just written to Notion with a single gesture. README says the user's drag writes immediately, so this is plan-consistent, but there is no undo toast action.
10. OK: verified `Todo4`, `In progress2 / 2`. The 3 / 2 to 2 / 2 transition is the only feedback that the limit is satisfied; it is not stated.
11. OK.
12. OK: suggestion present. CONFUSING: the reason line for tasks with an assignee and an open blocker reads "Blocker is still in progress" even when the blocker is in Todo (seen on Load testing).
13. CONFUSING / CONTRADICTS-PLAN: README S23 says bot writes to native tasks go through an approval card that names the project and what changes. Here "Accept" shows a toast "Sent for approval" and no approval card exists on the board or in the panel.
14. CONFUSING: verified the Assignee stays "Unassigned" and the card still shows "?", so Accept does nothing visible.
15. OK.
16. OK: row verified (`Research · working on it` seen for Research; Writer equivalent). Status stays Backlog while the row says "working on it" (CONFUSING).
17. OK: lanes after: Ada 2, Bo 3, Cy 2, Di 2, Eli 1, Research 1, Writer 3.
18. OK for Research and Writer. CONFUSING: the panel opens and the board shrinks to 684px of a 990px grid, so the Done column needs horizontal scroll.
19. OK.
20. OK.

### Variations / Edge cases
- If Priya picks Project bot in step 16, "Open thread" opens the generic Project bot conversation, not a task thread (S30 mismatch, from discovery).
- Dragging "Signup API" to Done instead of moving Docs site would also clear the limit and unblock Docs site, a faster route that Priya may not think of.
- Moving to "Backlog" instead of Todo has the same effect on the limit.
- With a person filter on in step 3, the header count changes and the amber tint can disappear (BOARD-WORK-06).

---

## STORY-017: Triage on a phone  
*(was BOARD-WORK-09)*
**Type**: medium  **Persona**: Sol, designer checking the board from a phone between meetings (390px width)
**Goal**: See what is blocked and move "Press kit" to Todo.
**Preconditions**: Browser width 390px (README says mobile screens are not in v1; this walks the web UI at phone width, since the mockup has a 900px breakpoint).
**README stories**: S8, S9
**Ideal path**: 3 steps (scroll sideways to the column, open the card, change status). Step 3 does not exist.
**Alternate paths**: none found.

### Steps
1. Open the Projects page. → Header stacks over three rows: project menu + Board/Timeline, Sources + "Everyone" filter, "Group by assignee" + "Ask bot". Left nav hidden.
2. Look at the board. → Backlog and a slice of Todo are visible; the rest is off-screen. Sol is thinking: "Is there more to the right?"
3. Scroll the board sideways. → Remaining columns appear; "In progress 3 / 2" is visible only after scrolling.
4. Tap "Press kit". → The drawer opens full width.
5. Look for a way to change status. → Status is text.
6. Touch-drag "Press kit" to Todo. → Nothing moves.

### Walk result
1. OK: no page-level horizontal overflow (`scrollWidth` 390 = `clientWidth` 390). The header takes 120px of a 844px screen.
2. CONFUSING: the board scrolls inside its own container (990px content, 358px visible), with no scroll cue or snap; the "Todo 3" count is cut off by the edge.
3. OK: horizontal scroll works.
4. OK: drawer width 390 (full width), readable.
5. MISSING: no status control (see BOARD-WORK-03).
6. MISSING: HTML5 drag and drop does not fire for touch in mobile browsers, so S9 "drag a card" has no mobile path. Not tested with real touch hardware; this follows from the mockup using `dragstart` events (not pointer events as on the Timeline).

### Variations / Edge cases
- Group by assignee at 390px multiplies the horizontal scroll per lane and is very long (see 13-mobile-group.png).
- README says mobile screens are not in v1; a responsive web board still needs a non-drag way to change status.

---

## STORY-018: Spot what is late on first look  
*(was TIMELINE-PLANNING-01)*
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup, opens Projects on Monday  **Goal**: Find out which task is scheduled wrong and why.
**Preconditions**: Default mockup state, Product launch project, Timeline tab not yet selected.
**README stories**: S12, S14
**Ideal path**: 3 (click Timeline, hover the red warning, click the row label to see the blocker). Reasoning: nothing else is needed to understand the problem.
**Alternate paths**: Board view shows a "Blocked" marker on the same card, but not the date clash. Bot panel "What is blocked this week?" (not walked here, see bot topic).

### Steps
1. Click "Timeline" in the Board/Timeline switch → Phase groups Plan, Build, Launch prep, Launch appear, with a red "Today" pill and line, bars, arrows, two diamonds, and an "Unscheduled" lane.
2. Look for trouble. Mara thinks: "Which of these red things is the problem?" Her eye goes to a red dashed arrow and a small warning triangle at the start of the "Security review" bar, repeated as a triangle in the row label. → She hovers the triangle on the bar.
3. Hover the triangle → Tooltip "Starts before Docs site ends".
4. Click the row label "Security review" → Task drawer opens: Linear issue ENG-47, Dates "Nov 7 to Nov 16", "Blocked by" shows "Docs site, In progress", plus a "Suggestion" card "Move due date to Nov 23".

### Walk result
1. OK. Tab switches, no console errors; Today line at Oct 16 (`a-default.png`).
2. OK. Triangle and row-label triangle both render (`a-default.png`). CONFUSING: the legend entry "Starts before blocker ends" is visually separate from the bars; only one conflict exists so it is easy to find, but with many it would be a wall of red.
3. OK. Title is `Starts before Docs site ends`. CONFUSING: the tooltip is hover-only; the triangle is not focusable and clicking it does nothing (walked: click opens no drawer).
4. OK for the drawer. CONTRADICTS-PLAN (mild): the suggestion says move the due date later by a week; the timeline fix is to move the start later. Also clicking the triangle or the arrow is a dead click; only the bar or row label opens the drawer.

### Variations / Edge cases
- Clicking a phase header ("Build") does nothing. Fine, but no collapse either.
- Keyboard: tab to a bar and press Enter does nothing (walked), so keyboard users cannot open a task from the timeline. Row labels open the drawer by click only.

---

## STORY-019: Check the Unscheduled lane and try to date a task  
*(was TIMELINE-PLANNING-02)*
**Type**: short  **Persona**: Teo, product manager at a 30-person SaaS company  **Goal**: Give "Partner outreach list" a date so it shows on the timeline.
**Preconditions**: Default state, Timeline tab.
**README stories**: S12, S27
**Ideal path**: 3 (scroll to lane, click chip, set dates in drawer). Reasoning: dating a task needs one field edit.
**Alternate paths**: Drag the chip onto the grid (a natural guess, not supported). Board card "No date" opens the same drawer.

### Steps
1. In Timeline, scroll to the bottom → "Unscheduled" lane with two chips: "Post-launch survey" (Writer avatar, Notion icon) and "Partner outreach list PL-16" (? avatar).
2. Teo thinks: "I'll drag this chip onto the week I want." → Drag the "Partner outreach list" chip onto the grid.
3. Nothing moves. He clicks the chip → Task drawer opens: Dates "Unscheduled", Estimate "None", Assignee "Unassigned", Suggestion "Assign to Cy Novak" with "Accept" and "Dismiss".
4. He looks for a date field in the drawer → Dates is plain text.

### Walk result
1. OK. Two chips render (`i-unsched.png`). CONFUSING: the lane label column is empty beside the chips; the lane header reads only "Unscheduled".
2. MISSING. Chip drag does nothing (count stayed at 2).
3. OK for opening the drawer. Suggestion card is about assignee, not dates.
4. MISSING. There is no way to set start or end. README S12 says undated tasks "sit in an Unscheduled lane" but gives no path out of it; S27 drawer fields are read-only in the mockup.

### Variations / Edge cases
- Chips of Notion tasks (Post-launch survey) show no id, Native/GitHub chips do. Inconsistent (S28).
- "Accept" on the assign suggestion only toasts "Sent for approval" (mockup shortcut).

---

## STORY-020: Fix a schedule conflict by dragging  
*(was TIMELINE-PLANNING-03)*
**Type**: medium  **Persona**: Mara, eng lead at a 12-person startup  **Goal**: Make "Security review" start after "Docs site" ends, without opening it.
**Preconditions**: Default state, Timeline tab. Security review is a Linear task, read and write connection.
**README stories**: S13, S14
**Ideal path**: 1 drag. Reasoning: one pointer gesture, ending the conflict, is the minimum.
**Alternate paths**: Drawer suggestion "Open in Linear" to change the date in Linear (leaves Rakazo). "Shift dependents" from the conflict marker is README S15 (later), not in mockup.

### Steps
1. Open Timeline; identify the "Security review" bar (ENG-47) with a warning triangle at its left edge → Warning visible.
2. Press and hold the ENG-47 bar and move right → Bar follows the pointer in whole days. A dark tooltip near the pointer says "0 dependents move · +3d" at 3 days.
3. Mara thinks: "Is +3 enough? How do I know where Docs site ends?" She aims for the left edge to be right of the Docs site bar's right end (Nov 9).
4. Release → Bar settles; toast "ENG-47 moved +3d and written to Linear". The warning triangle in the bar and row label disappears and the red dashed arrow turns grey.
5. She wonders whether it really saved. → Clicks the bar to open the drawer: Dates read "Nov 10 to Nov 19".

### Walk result
1. OK (`a-default.png`).
2. OK. Tooltip text matches the README preview idea, but it shows only a day offset, no new start/end dates and no hint that the conflict will clear (observed tooltip `0 dependents move · +3d`).
3. CONFUSING. Nothing lines the bar up with the blocker's end; no snap, no guide.
4. OK, conflict count went from 1 to 0 and the toast named the source (observed after +3d). CONTRADICTS-PLAN: README S13 says a preview, then save, and a failed write reverts the bar. The mockup writes on release with no save step and no failure path. Also the toast has no Undo.
5. OK. Dates update. (Note: a pure click, not drag, opens the drawer, so Mara can mis-click a 3px wobble into a drawer, and a 4px wobble into a reschedule.)

### Variations / Edge cases
- Dragging +2d leaves the conflict (start Nov 9 < Docs site end Nov 9?). Docs site ends day 35 and Security starts day 33: +2 gives day 35, which clears the conflict exactly; +1 does not. No on-screen cue tells the user which.
- Drag a Notion task ("Docs site") instead: tooltip "1 dependent moves · +5d", toast "Docs site moved +5d and written to Notion", but the conflict on Security review remains and gets worse (walked). The user pushed the blocker later, which is the wrong direction.

---

## STORY-021: Slip a blocker and see what it breaks  
*(was TIMELINE-PLANNING-04)*
**Type**: medium  **Persona**: Di, backend developer on the Signup API  **Goal**: Move "Signup API" a week later because of a delayed dependency and know who is affected.
**Preconditions**: Default state, Timeline tab.
**README stories**: S13, S14, S15
**Ideal path**: 2 (drag bar, review the list of affected tasks and confirm). Reasoning: the plan promises a preview listing dependents and a save step.
**Alternate paths**: Edit the date in GitHub (not available in mockup drawer). Bot re-plan (S19, later).

### Steps
1. Open Timeline, locate "Signup API" (#142, black = critical path) in the Build group.
2. Drag the #142 bar right by 7 days → Tooltip "7 dependents move · +7d". Dashed outlines appear around #145, Docs site, ENG-47, #151, PL-13 and the diamonds.
3. Di thinks: "Seven move? Good, they will shift with it." → Releases the bar.
4. Bar lands at Oct 19 to Nov 2; toast "#142 moved +7d and written to GitHub".
5. Di looks at the result and sees nothing else moved. Billing integration and Docs site now show warning triangles and red dashed arrows; Security review is still red.
6. He wants the others to follow → looks for a "Shift dependents" control and clicks the triangle.

### Walk result
1. OK.
2. OK visually (`b-drag-preview.png`). The count 7 is every transitive dependent, including ones that would not need to move.
3. CONFUSING. The tooltip says "dependents move" but they will not. Observed: after release only #142 changed.
4. CONTRADICTS-PLAN. README S13: "a preview lists dependents that would move" before saving. The mockup writes to GitHub with the preview only as a transient tooltip.
5. OK for the red markers (`b-after.png`): conflicts went from 1 to 3 (`Starts before #142 ends` twice). CONFUSING: the critical path stays drawn through the now-broken chain, and no message says "you created 2 conflicts".
6. MISSING. The triangle is a non-clickable icon, so S15 "Shift dependents" has no hint, even as a later feature.

### Variations / Edge cases
- Drag a Done task (Scope brief PL-1) +3d: tooltip "11 dependents move", release gives 2 new conflicts, no warning that the task is Done (walked).
- Drag earlier (Support runbook -5d): tooltip "2 dependents move · -5d" although moving earlier cannot force dependents to move.
- Read-only tracker: a GitHub bar does not drag; a click opens the drawer; no tooltip says why (walked).

---

## STORY-022: Read the critical path and move a milestone  
*(was TIMELINE-PLANNING-05)*
**Type**: medium  **Persona**: Priya, operations lead who owns the launch date  **Goal**: Understand which tasks decide the Launch day date, and see what happens if "Beta ready" moves.
**Preconditions**: Default state, Timeline tab.
**README stories**: S12, S14
**Ideal path**: 3 (read legend, trace heavy line, drag diamond). Reasoning: legend plus one gesture.
**Alternate paths**: Ask the bot (not in this topic).

### Steps
1. Open Timeline; look at the legend under the chart: "Critical path", "Task", "Starts before blocker ends", "Today".
2. Trace the heavy black bars and arrows: #142 Signup API, #145 Billing integration, #151 Load testing, PL-13 Go/no-go review, then the black diamond "Launch day". Priya thinks: "Good, that is the chain that decides launch."
3. Notice "Beta ready" diamond is grey and sits beside #145's end, with an arrow from #145.
4. Drag "Beta ready" 10 days right → Tooltip "0 dependents move · +10d".
5. Release → Toast "PL-8 moved +10d" (no "written to", it is native).
6. Click "Launch day" diamond → Drawer opens: Native task, Dates show the single date Nov 24 (day 50).

### Walk result
1. OK. CONFUSING: no explanation of what "critical" means; legend order puts "Task" between, and the swatches differ only in thickness/colour (`a-default.png`).
2. OK. Black marks match the hardcoded `c` flag. Not computed (known plan gap, S14): moving tasks never changes which are black. Verified: after the +7d drag in story 04 the black chain is unchanged.
3. CONFUSING. Arrows into the diamonds route awkwardly, with the arrowhead and diamond overlapping (see Launch day in `a-default.png`).
4. OK. Milestone drags like a bar.
5. OK. But Beta ready sat after #145 (Nov 10); +10d puts it on Nov 20 with no conflict shown, since nothing depends on it.
6. OK. Click without drag opens the drawer.

### Variations / Edge cases
- Dragging Launch day earlier than PL-13's end creates a conflict marker on the diamond only after release.
- Milestone has no "Estimate"; drawer shows "None". Fine.

---

## STORY-023: Notion has no dependency relation  
*(was TIMELINE-PLANNING-06)*
**Type**: medium  **Persona**: Jonas, founder who tracks marketing work in Notion  **Goal**: Understand why Notion tasks have no arrows, and ask Rakazo to add a relation.
**Preconditions**: "Mockup states" menu: check "Notion: no relation". Timeline tab.
**README stories**: S4, S12, S14
**Ideal path**: 2 (read the note row, click "Add relation"). Reasoning: the note row is the control.
**Alternate paths**: Notion property mapping at connect time ("Blocked by", optional), which only exists in the connect form.

### Steps
1. Open Timeline with the mock toggle on → A banner row above the chart: warning icon, "Notion has no dependency relation", button "Add relation".
2. Look at the chart. Jonas thinks: "Where did my arrows go?" → "Docs site" (and Pricing model, Press kit) bars have no arrows in or out. The red conflict on Security review is gone.
3. Click "Add relation" → Toast "Sent for approval".
4. He waits for an approval card → None appears. Click the "Security review" row label; the drawer's "Blocked by" still lists "Docs site, In progress".

### Walk result
1. OK (`g-norel.png`). CONFUSING: the note does not say what Add relation does, to which database, or what will be written.
2. OK. Arrows involving Notion tasks vanish (13 arrows down to 9, conflicts 0).
3. CONTRADICTS-PLAN. README S4 says "Add relation" is a write needing approval; the mockup shows only a toast, no approval card.
4. CONTRADICTS-PLAN. Drawer for the Linear task still lists the Notion blocker while the chart hides the dependency; the board and bot answer still use it (discovery item 19). The Notion tasks' own drawers say "No relation property".

### Variations / Edge cases
- Notion bars have no label on them (no id); with no arrows the bars are nearly anonymous (`g-norel.png`). Row labels still carry the name.
- After "Add relation" the banner stays, with no pending state.

---

## STORY-024: Resolve an "Update conflict" on a due date  
*(was TIMELINE-PLANNING-07)*
**Type**: medium  **Persona**: Sam, delivery manager moving dates in a standup  **Goal**: Resolve a stale-write clash on "Billing integration" and see the correct date.
**Preconditions**: "Mockup states": check "Conflict". Timeline tab. Billing integration is GitHub #145, bar shows Oct 26 to Nov 10.
**README stories**: S26, S13
**Ideal path**: 1 (pick one button). Reasoning: the modal already has both values.
**Alternate paths**: none found. The modal cannot be reached any other way in the mockup.

### Steps
1. Mock toggle "Conflict" on → A modal "Update conflict" opens over the timeline: "#145 Billing integration · Due date", two boxes "Yours: Nov 13" and "GitHub, 4 min ago: Nov 6", buttons "Keep mine" and "Use GitHub".
2. Sam thinks: "Which of these did I just change? The bar says Nov 10, not either of these." He reads the boxes.
3. He tries Escape, then clicks outside the modal → Nothing closes.
4. Click "Keep mine" → Toast "Kept your value"; modal closes.
5. He checks the bar for #145 → Still Oct 26 to Nov 10.

### Walk result
1. OK (`h-conflict.png`). The modal does appear on both Board and Timeline.
2. CONFUSING. Neither value matches the bar (Nov 10), and it is "Due date" while the timeline shows start and end.
3. CONFUSING. Escape and scrim click do nothing (walked); only the two buttons close it. No "Cancel / decide later".
4. OK. Toast matches the choice.
5. MISSING. The chart does not change after either "Keep mine" or "Use GitHub" (the second walked separately: toast "Used GitHub value", bar still Nov 10). The user cannot see the outcome.

### Variations / Edge cases
- "Keep mine" overwrites GitHub; the button does not say so. Suggested label "Keep my date (Nov 13)".
- In production the modal should follow a drag (story 03/04), not a toggle; the trigger is mockup-only.

---

## STORY-025: Weekly plan review across sources (long)  
*(was TIMELINE-PLANNING-08)*
**Type**: long  **Persona**: Mara, eng lead at a 12-person startup, preparing a Friday launch review  **Goal**: Review the whole schedule, fix the one real conflict, and check only her own team's work.
**Preconditions**: Default state, 1360 wide.
**README stories**: S10, S12, S13, S14, S24
**Ideal path**: 9. Reasoning: open timeline, find conflict, drag to fix, filter, restore.
**Alternate paths**: Board with Group by assignee for load (other topic).

### Steps
1. Click "Timeline" → full chart shows.
2. Scroll the chart sideways → The task-name column stays fixed while weeks scroll; the week header stays at top.
3. Read the legend → Four entries.
4. Hover the triangle on "Security review" → "Starts before Docs site ends".
5. Click the "Docs site" row label → Drawer: Notion page, "Synced 12 min ago", Dates Oct 26 to Nov 9, "Blocked by" #142 Signup API.
6. Click the "#142" blocker chip → The drawer swaps to Signup API (GitHub issue #142).
7. Press Escape → Drawer closes.
8. Drag the ENG-47 bar +3 days → Tooltip "0 dependents move · +3d".
9. Release → Toast "ENG-47 moved +3d and written to Linear"; conflict gone.
10. Open "Filter by person or bot" and pick "Di Okafor" → Only Build/Launch prep rows with Di remain (Signup API, Load testing); arrows disappear.
11. Mara thinks: "Where did the dependency lines go?" She looks at the Launch day milestone → It is not visible.
12. Reset the filter to "Everyone" → Full chart returns.
13. Open "Sources" and uncheck Notion → Docs site, Pricing model, Press kit rows disappear; arrows into them disappear.
14. Look for the conflict marker she fixed earlier, then drag Signup API +7d → tooltip "7 dependents move", release gives toast "#142 moved +7d and written to GitHub".
15. She hovers the new triangle on "Billing integration" → "Starts before #142 ends".
16. She wants to undo → No Undo in toast; drag #142 back -7d → Toast "#142 moved -7d and written to GitHub".
17. Re-check "Notion" in Sources → Rows return.

### Walk result
1. OK.
2. OK. Observed horizontal scroll (1082px wide chart in a 1062px viewport, label column sticky).
3. OK. CONFUSING: "Critical path" meaning not explained.
4. OK.
5. OK. (Notion tasks appearing as blockers elsewhere show a "Page" chip with no id, S28.)
6. OK. Drawer navigation works but there is no back button.
7. OK.
8. OK.
9. OK (see story 03 for save/undo gaps).
10. CONFUSING. With a person filter, blockers owned by others vanish and so do their arrows (`j-filter.png`: 0 arrows, 0 conflicts), so the conflict warning is lost.
11. CONFUSING. Milestones owned by others disappear; the Launch day diamond cannot be seen under a filter.
12. OK.
13. CONFUSING. Hiding Notion hides the Security review conflict marker silently (observed 0 conflicts), so a hidden-source schedule problem disappears. No indicator such as "1 hidden blocker".
14. CONTRADICTS-PLAN. Tooltip says dependents move; they do not (story 04).
15. OK for the marker (one new conflict with Notion hidden, not walked as a hover). MISSING: no summary count of conflicts.
16. MISSING. No Undo; the only recovery is re-dragging by hand, which writes to GitHub twice.
17. OK.

### Variations / Edge cases
- Read-only GitHub connection: step 14's drag does nothing, click opens the drawer, no explanation.
- At 390 width the same journey needs horizontal scrolling for every step (see story 09).

---

## STORY-026: Check the schedule on a phone  
*(was TIMELINE-PLANNING-09)*
**Type**: short  **Persona**: Lena, designer checking dates on the train  **Goal**: See when "Launch day" is.
**Preconditions**: 390x800 viewport, default state.
**README stories**: S12
**Ideal path**: 2 (open Timeline, scroll right to Launch day). Reasoning: the date is at the far right.
**Alternate paths**: Tap the "Launch day" row label to see the date in the drawer (faster than scrolling).

### Steps
1. Tap "Timeline" → Header controls wrap onto several rows; "Ask bot" sits on its own row.
2. Look at the chart → Label column (about 215px wide) leaves about 175px for bars.
3. Swipe the chart sideways → It scrolls inside its box to see later weeks.
4. Tap "Launch day" row label → Drawer shows the date.

### Walk result
1. OK but tall: the controls wrap onto several rows (`l-mobile.png`).
2. CONFUSING. At 390 wide only 2 weeks of bars show; the Today pill is clipped.
3. OK. Chart scrollWidth 1082 vs clientWidth 356; no page-level horizontal scroll (390 = 390). Bars use `touch-action: pan-y`, so a horizontal finger drag reschedules instead of scrolling when it starts on a bar.
4. OK. Not walked: touch drag precision at 14px per day.

### Variations / Edge cases
- Dragging at this width is risky: a swipe that begins on a bar moves it and writes to the tracker.

---

## STORY-027: Ask what is blocked and check a claim  
*(was BOT-CONVERSATION-APPROVALS-01)*
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup  **Goal**: Get an answer to "what is blocked this week?" and verify one claim by opening the task behind it.
**Preconditions**: Default mockup state (all four sources connected, Board view).
**README stories**: S16, S27, S28
**Ideal path**: 3 steps. "Ask bot", read the answer, tap a citation chip.
**Alternate paths**: The board already shows a red "Blocked" marker on cards, so Mara can scan the Backlog and Todo columns without the bot (see Finding 3).

### Steps
1. Open Projects, click "Ask bot" → The right panel opens (380 px), the "Ask bot" button disappears, the header reads "Project bot".
2. Read the top of the thread: "What is blocked this week?" then "3 blocked tasks" with three lines, each with chips (#145 #142, #151 #145, ENG-47 Page). Mara thinks: "Three? The board has more red Blocked tags than that."
3. Click the chip "#142" in the first line → The task drawer "Signup API" opens: "GitHub issue #142 · acme/web", "Synced 2 min ago", "Open in GitHub", Blocked by "PL-1 Scope brief Done".
4. Press Escape → Drawer closes, bot panel is still open at the same place.

### Walk result
1. OK: panel opened, `#askBot` hidden afterwards.
2. CONFUSING: the answer says 3 blocked tasks, but the board shows seven cards with "Blocked" (Security review, Press kit, Go/no-go review, Billing integration, Load testing, Onboarding emails, Docs site). Screenshot 02 shows the board behind the drawer.
3. OK for the click. CONFUSING for layout: the drawer is 440 px wide and the panel 380 px, so the drawer completely covers the panel (element at a panel point is `.db`). The conversation vanishes while the task is open. The scrim looks like it leaves the panel alone but the drawer sits on top of it.
4. OK: Escape closes only the drawer.

### Variations / Edge cases
- The chip "Page" (Notion, Docs site) has no id; its meaning shows only in the hover title "Docs site". A keyboard or touch user gets no label.
- Chip order: the first chip in each line is the subject task and the second is the blocker, but nothing says so ("#145 #142" reads as two equal items).

---

## STORY-028: Approve the bot closing a GitHub issue  
*(was BOT-CONVERSATION-APPROVALS-02)*
**Type**: short  **Persona**: Diego, solo developer who tracks work in GitHub  **Goal**: Let the bot mark #142 Signup API as Done in GitHub.
**Preconditions**: Default state. GitHub connected "Read and write".
**README stories**: S23
**Ideal path**: 2 steps. Open the panel, click "Approve" on the "Change status" card.
**Alternate paths**: Drag the "Signup API" card to the Done column. That is the user's own action, it writes straight to GitHub with no approval and shows the toast "#142 moved to Done and written to GitHub". It is shorter and does not need the bot.

### Steps
1. Click "Ask bot" and scroll to the message "Signup API is done" → A card "Change status" appears: Task "#142 Signup API", Target "GitHub", Status "In progress" struck through, then "Done". Buttons "Approve" and "Reject".
2. Click "Approve" → Toast "Status written to GitHub".
3. Diego thinks: "Did it work?" He clicks "Approve" again to be sure, then closes the panel and looks for Signup API in the Done column.

### Walk result
1. OK: card content matches S23 (task, target, old and new status). CONFUSING: the card has no title naming the action's consequence for a person who joined the thread late ("Signup API is done" is a user message that nothing in the panel lets Diego type).
2. OK for the toast, but MISSING: no approved state. The card still shows live "Approve" and "Reject" after the click.
3. MISSING: clicking "Approve" a second time works and shows the same toast, so a double approval is possible. The #142 card on the board stays in "In progress" (the mockup does not move it). Mockup-only gap, but the shipped card needs an "Approved" or "Done in GitHub" state.

### Variations / Edge cases
- "Reject" shows the toast "Rejected" and leaves the card as is.
- "Always allow this kind" (README S23) is absent.
- If GitHub is unchecked under "Connected", the status card for #142 still appears (observed). The shipped bot should not offer a card for a disconnected source.

---

## STORY-029: Create tasks from a planning request, keep only some  
*(was BOT-CONVERSATION-APPROVALS-03)*
**Type**: medium  **Persona**: Priya, founder planning a product launch  **Goal**: Turn the bot's breakdown of the launch announcement into native tasks, without the video task.
**Preconditions**: Default state. Native source connected.
**README stories**: S17, S23
**Ideal path**: 4 steps. Open the panel, untick one row, click "Accept selected", check the board.
**Alternate paths**: "Accept all" creates all four at once. No other path (the "New task" control does not exist, see S1/S27 gap).

### Steps
1. Click "Ask bot" → Panel opens. The second message "Break down the launch announcement" is below the first answer.
2. Read the card "Create 4 tasks in Product launch": four ticked rows, "Draft announcement 2 pts, No blockers", "Prepare demo video 3 pts, Blocked by Draft announcement", "Schedule social posts 2 pts, Blocked by Draft announcement", "Brief support team 1 pt, No blockers". Priya thinks: "I do not need a demo video yet."
3. Untick "Prepare demo video" → Row unchecks. "Schedule social posts" still says "Blocked by Draft announcement", which is fine. If she had unticked "Draft announcement", the two dependents would point at a task that will not exist.
4. Click "Accept selected" → Toast "Selected tasks created".
5. Click "Edit" first (she wants to change an estimate) → nothing happens.
6. Close the panel and look for "Draft announcement" on the Board → Not there.

### Walk result
1. OK.
2. OK: card title names the destination as S17 requires. The mockup has no hint that this is a proposal the bot will only apply after approval (S23 says approval is the gate), which is acceptable because the buttons say "Accept".
3. OK for the checkbox. MISSING: no rule or warning for untick of a task that others depend on.
4. CONFUSING: the toast does not say how many tasks ("Selected tasks created"; "Accept all" says "4 native tasks created"). The card stays unchanged with live buttons, so she can click again and create duplicates.
5. MISSING: "Edit" is a no-op (no toast, no form). Priya cannot change the 2 pts figure.
6. MISSING: the board still has 14 cards and no "Draft announcement" (mockup gap; the toast is the only evidence).

### Variations / Edge cases
- Untick all four, click "Accept selected": no guard, same toast.
- For a tracker-only project README says the card becomes a suggestion with "Open in <source>". The mockup always shows the native version, so that variant cannot be walked.

---

## STORY-030: The bot cannot edit Linear; follow its due-date suggestion  
*(was BOT-CONVERSATION-APPROVALS-04)*
**Type**: medium  **Persona**: Sam, product manager who keeps the roadmap in Linear  **Goal**: Act on "Onboarding emails will slip a week" without Rakazo changing Linear on its own.
**Preconditions**: Default state. Linear connected.
**README stories**: S19 (later, partly), S23, S18
**Ideal path**: 3 steps. Read the suggestion, click "Open in Linear", change the date in Linear.
**Alternate paths**: Open ENG-42 from the board, the drawer has its own "Suggestion" card with the same action (due date to Nov 3) and the same "Open in Linear" button.

### Steps
1. Click "Ask bot" and scroll to "Onboarding emails will slip a week" → Card "Suggestion": "Move due date from Oct 27 to Nov 3" with chip "ENG-42", buttons "Open in Linear" and "Dismiss".
2. Click the chip "ENG-42" → Drawer "Onboarding emails": Linear issue ENG-42 · Growth, Dates "Oct 16 to Oct 27", Blocked by ENG-31, plus its own "Suggestion" card "Move due date to Nov 3 / Blocker is still in progress".
3. Close the drawer, click "Open in Linear" → Nothing visible happens (the mockup link does nothing; in the product it would open Linear).
4. Click "Dismiss" → Toast "Dismissed". The card stays in the thread.

### Walk result
1. CONFUSING: the panel card has no reason line, only the move, while the drawer version adds "Blocker is still in progress".
2. OK: dates and suggestion are consistent with the card (Oct 27 to Nov 3).
3. OK for a mockup (external link). Real design: the card does not say that the change is made in Linear and that Rakazo picks it up on the next sync. Sam may think the click already changed the date.
4. MISSING: dismissed card is not removed or greyed. Dismissing the bot card does not dismiss the drawer's duplicate Suggestion, and the other way round.

### Variations / Edge cases
- Two places show the same suggestion (panel card and drawer card) with independent Dismiss buttons.
- Notion task suggestion: drawer shows "Open in Notion". Same flow.

---

## STORY-031: Save the weekly report  
*(was BOT-CONVERSATION-APPROVALS-05)*
**Type**: medium  **Persona**: Lena, founder who sends a Friday update to investors  **Goal**: Get the weekly summary and keep it.
**Preconditions**: Default state.
**README stories**: S20, S16
**Ideal path**: 3 steps. Open the panel, scroll to the report, "Save to thread".
**Alternate paths**: none found. There is no button to generate a report on demand; the report is already in the thread.

### Steps
1. Click "Ask bot", scroll to the end of the thread (about 1600 px) → A card "Weekly report · Oct 12 to 16" with sections Done, In progress, Blocked, At risk.
2. Read "Done": Scope brief (PL-1), Pricing model (Page). Lena thinks: "Which page?"
3. Read "Blocked": Billing integration (#145), Security review (ENG-47). Then recall the first answer in the same panel said three blocked tasks including Load testing.
4. Click a chip to verify, for example ENG-47 → Drawer opens over the panel.
5. Close it and click "Save to thread" → Toast "Saved to thread".

### Walk result
1. CONFUSING: Lena asked for nothing, she scrolls to find the report. A real thread would open at the newest message.
2. CONFUSING: chip "Page" is used for every Notion task (Pricing model, Docs site), so the two cannot be told apart.
3. CONTRADICTS-PLAN: the report lists 2 blocked tasks, the "what is blocked" answer lists 3 (Load testing #151 is missing in the report). Both come from the same data in the real product.
4. OK, the chip works (drawer covers the panel).
5. OK for the toast. MISSING: no visible saved state; the button stays, can be saved twice. README says the report is saved as a message in the thread, so the card should then appear as a message.

### Variations / Edge cases
- "At risk" repeats the Security review line already under "Blocked", with a different reason.
- The report is hardcoded to "Oct 12 to 16" (the mockup's current week).

---

## STORY-032: Accept or dismiss a bot suggestion in the task drawer  
*(was BOT-CONVERSATION-APPROVALS-06)*
**Type**: short  **Persona**: Noor, ops manager triaging the backlog  **Goal**: Give "Partner outreach list" an assignee, then check a tracker task's suggestion.
**Preconditions**: Default state, Board view.
**README stories**: S18, S23, S30
**Ideal path**: 2 steps. Open the card, click "Accept".
**Alternate paths**: Drawer does not offer an assignee control, so this card is the only route in the mockup.

### Steps
1. Click the card "Partner outreach list" (PL-16, unassigned) → Drawer: "Native task · Product launch", "Saved in Rakazo", Assignee "Unassigned", and a "Suggestion" card: "Assign to Cy Novak / Lowest open load this week", "Accept", "Dismiss".
2. Click "Accept" → Toast "Sent for approval".
3. Noor thinks: "Approval by whom? I am the user." She looks at the Assignee row: still "Unassigned".
4. Click "Dismiss" → Toast "Dismissed"; the Suggestion card stays.
5. Close, open "Billing integration" (#145, tracker) → Suggestion "Move due date to Nov 17 / Blocker is still in progress", buttons "Open in GitHub" and "Dismiss".

### Walk result
1. OK: reason text is visible, as README S18 asks.
2. CONTRADICTS-PLAN: README S23 says a native change by the bot goes through an approval card naming the project and the change. Here "Accept" only says "Sent for approval" and there is no card anywhere in the panel.
3. CONFUSING: the user's own Accept is described as needing approval. README says the user's own edits need none.
4. MISSING: nothing changes after Dismiss.
5. OK: matches S23 and S18 (tracker task opens the source).

### Variations / Edge cases
- Send "Partner outreach list" to "Project bot" (Send to bot menu): Assignee becomes "Project bot · working on it", but the Suggestion "Assign to Cy Novak" is still shown (observed). CONFUSING: it proposes a human assignee for a task the bot now owns.
- "Open thread" for Project bot reopens the generic five-message conversation, not a task thread (known, S30).
- Suggestions appear on any task with an open blocker, including Docs site, which looks unrelated to "assign".

---

## STORY-033: Read-only tracker and a status-change card  
*(was BOT-CONVERSATION-APPROVALS-07)*
**Type**: medium  **Persona**: Owen, cautious CTO who connected GitHub read-only  **Goal**: Be sure Rakazo cannot change GitHub.
**Preconditions**: Mockup states: "Read-only" ticked.
**README stories**: S24, S23
**Ideal path**: 3 steps. Look for the read-only signal, open the bot, confirm no write is offered.
**Alternate paths**: Drag a GitHub card (drag is disabled with only a cursor change).

### Steps
1. Tick "Read-only" in Mockup states → "Read-only" badge with lock appears in the header.
2. Try dragging "Signup API" → The card does not move, no message explains why.
3. Click "Ask bot", scroll to "Signup API is done" → The "Change status" card with "Approve" and "Reject" is still there.
4. Owen thinks: "I said read-only. Why is the bot offering to write?" He does not click Approve.

### Walk result
1. OK: badge present (screenshot 10).
2. MISSING: README S24 wants an explanation in the tooltip. Cursor changes only.
3. CONTRADICTS-PLAN: S24 says a read-only connection also removes the bot's status change. The card is shown and Approve is clickable, with the toast "Status written to GitHub" if clicked.
4. This is the high-trust failure: the UI says both read-only and "will write".

### Variations / Edge cases
- The badge is global, but native tasks stay writable. The mockup does not show which sources are read-only.

---

## STORY-034: Check a citation on a phone  
*(was BOT-CONVERSATION-APPROVALS-08)*
**Type**: short  **Persona**: Jun, designer reading updates on the train  **Goal**: Tap a citation in the bot answer to see the task.
**Preconditions**: Viewport 390x844, default state.
**README stories**: S16 (mobile is later, but the mockup defines the narrow layout)
**Ideal path**: 3 steps. Tap "Ask bot", tap a chip, read the task.
**Alternate paths**: none found.

### Steps
1. Tap "Ask bot" → The panel fills the screen. The "Mockup states" control is hidden.
2. Tap the chip "#145" → Expect the Billing integration drawer.
3. Jun sees the panel unchanged, thinks the tap failed, and taps again.
4. Close the panel with the X → Now the drawer is visible behind it.

### Walk result
1. OK: panel is 390x844 full screen (screenshot 13).
2. CONFUSING: the drawer does open, but its z-index (20) is below the full-screen panel (22), so it opens behind the panel (screenshot 14 shows only the panel).
3. CONFUSING: no feedback at all.
4. OK: Escape and the scrim also close the hidden drawer, but a user cannot know it is there.

### Variations / Edge cases
- Chips are 11 px text with small hit areas; the chips on one row wrap but stay tappable.
- The "Approve" and "Accept all" buttons are 12 px high-density controls, small for touch.

---

## STORY-035: Friday wrap-up with the bot, start to finish  
*(was BOT-CONVERSATION-APPROVALS-09)*
**Type**: long  **Persona**: Mara, eng lead at a 12-person startup, 20 minutes before the Friday update  **Goal**: Review what is blocked, create the tasks for next week, close #142, deal with the slip, and save the report.
**Preconditions**: Default state, desktop.
**README stories**: S16, S17, S18, S20, S23, S27
**Ideal path**: 14 steps. Each action is one click in the panel and no step needs the board.
**Alternate paths**: Closing #142 by dragging its card is one step shorter (see story 02). The report has no other route.

### Steps
1. Click "Ask bot" → Panel opens with "What is blocked this week?" and the "3 blocked tasks" answer.
2. Click chip "#145" → Drawer for Billing integration opens and covers the panel.
3. Read its "Suggestion" card ("Move due date to Nov 17 / Blocker is still in progress", "Open in GitHub", "Dismiss") → Mara thinks: "Fine, later."
4. Press Escape → Back to the panel.
5. Scroll to "Create 4 tasks in Product launch" → Four ticked rows.
6. Untick "Brief support team", click "Accept selected" → Toast "Selected tasks created". She thinks: "Did that create three?"
7. Scroll to "Change status" and click "Approve" → Toast "Status written to GitHub". She expects the card to change.
8. Scroll to "Move due date from Oct 27 to Nov 3" (ENG-42), click "Open in Linear" → Nothing in the mockup. She clicks "Dismiss" → Toast "Dismissed".
9. Scroll to "Weekly report · Oct 12 to 16" → Done, In progress, Blocked, At risk.
10. Notice "Blocked" has two lines while the first answer said three → she looks for Load testing (#151) in the report, does not find it, and opens "ENG-47" → Drawer.
11. Press Escape.
12. Click "Save to thread" → Toast "Saved to thread".
13. Click the composer "Ask about this project" and try to type a follow-up ("what slipped?") → Nothing.
14. Click the X in the panel header → Panel closes, "Ask bot" returns. Board unchanged: #142 is still in "In progress", no new tasks exist.

### Walk result
1. OK.
2. OK, but CONFUSING: drawer hides the panel (story 01).
3. OK: reason line present.
4. OK.
5. CONFUSING: she scrolls past a fixed conversation she did not write; older messages first.
6. CONFUSING: toast has no count; card stays live.
7. MISSING: no approved state; a second click is accepted.
8. OK for the mockup link; CONFUSING because the dismissed card remains.
9. OK content; position forces scrolling 1600 px.
10. CONTRADICTS-PLAN: blocked list differs between answer and report (story 05).
11. OK.
12. MISSING: no visible saved state.
13. MISSING: composer is inert, so a follow-up question cannot be asked (S16 needs it).
14. CONFUSING: after about 8 actions the board shows none of them.

### Variations / Edge cases
- Do the same on the Timeline view: the panel and drawer behave the same, and no timeline preview of "slips a week" appears (S19, later).
- Do it with "Notion: no relation" ticked: the board hides Blocked markers and arrows, but the bot still says "Security review waits on Docs site" (Notion task).

---

## STORY-036: Hand an unassigned task to Research  
*(was DELEGATE-TO-BOTS-OWNERSHIP-01)*
**Type**: short  **Persona**: Mara, eng lead at a 12-person startup, has a native task nobody picked up  **Goal**: Give "Partner outreach list" to the Research bot and confirm it is being worked on  
**Preconditions**: Default mockup state, Board view, bot panel closed  
**README stories**: S30, S29, S8  
**Ideal path**: 4 steps. Card, Send to bot, Research, done; the drawer confirms in place.  
**Alternate paths**: Timeline Unscheduled chip "Partner outreach list" opens the same drawer (same Send to bot). Nav rows "Research" and "Writer" are inert, so there is no path from the left nav.

### Steps
1. Click the card "Partner outreach list" (Backlog column) → drawer opens: Owner "Ada Park", Assignee "? Unassigned". Mara thinks: "Nobody has it; can I just give it to a bot?"
2. Click "Send to bot" → menu lists "Project bot", "Research", "Writer", each with an avatar. She hesitates: which bot does what? Nothing in the menu says.
3. Click "Research" → toast "Sent to Research"; Assignee row becomes "R Research · working on it" with an "Open thread" button; Owner stays "Ada Park".
4. Press Escape or the X → board card now shows the blue R avatar and "No date".

### Walk result
1. OK: drawer showed `Owner A Ada Park Assignee ? Unassigned`.
2. CONFUSING: menu is three bare names; no role or one-line capability, and no marker for a current bot.
3. OK for the row. CONTRADICTS-PLAN / CONFUSING: the drawer still shows the "Suggestion: Assign to Cy Novak" card right under "Research · working on it" (screenshot s1-after). Accepting would assign a human to a task a bot is working on.
4. OK: card avatar title is "Research", column unchanged (Backlog).

### Variations / Edge cases
- Send to a task that already has a bot (ENG-31): replaces the bot silently; see story 05.
- The toast disappears after about 2 seconds; the drawer row is the only lasting confirmation.
- Mara leaves the drawer open and sends to a second bot: no confirmation that the first thread is abandoned.

---

## STORY-037: Check on what Writer is doing with the Press kit  
*(was DELEGATE-TO-BOTS-OWNERSHIP-02)*
**Type**: short  **Persona**: Ravi, founder, wants to see how far Writer got  **Goal**: Open the Writer thread for "Press kit"  
**Preconditions**: Default state, Board view  
**README stories**: S30  
**Ideal path**: 3 steps. Card, Open thread, read.  
**Alternate paths**: Timeline row label "Press kit" or its W avatar then Open thread (same drawer). The nav row "Writer" does nothing, so it is not an alternate. Filter by "Writer" finds the card quickly but is not a thread path.

### Steps
1. Click the card "Press kit" (purple W avatar) → drawer: Owner "Ada Park", Assignee "W Writer · working on it", button "Open thread".
2. Click "Open thread" → drawer closes, right panel opens headed "W Writer". The thread shows "Press kit" as a user message and a card "Working on it" with a "Page" citation chip and "Open in Notion".
3. Ravi looks for progress, a draft, or a result → there is none. He closes with the X.

### Walk result
1. OK: drawer text `Assignee W Writer · working on it Open thread`.
2. OK: thread text `Press kit Working on it Press kit Page Open in Notion`. The "Page" label is the Notion no-id chip.
3. MISSING: no progress, no output, no reply from Writer, no way to send a follow-up (composer "Ask about this project" is static and is not in the Writer thread context). "Working on it" never becomes done.

### Variations / Edge cases
- "Ask bot" is hidden while the panel is open, so to get to the Project bot from the Writer thread Ravi must close and reopen the panel.
- The Writer thread says "Open in Notion" but the Notion chip shows "Page" with no id; users with several Notion pages cannot tell which.

---

## STORY-038: Send a GitHub task to the Project bot and follow the thread  
*(was DELEGATE-TO-BOTS-OWNERSHIP-03)*
**Type**: medium  **Persona**: Joon, developer, wants the Project bot to take #151 Load testing  **Goal**: Delegate a tracker task to the Project bot and see its own thread  
**Preconditions**: Default state; Joon is not read-only  
**README stories**: S30, S23, S28  
**Ideal path**: 5 steps (card, Send to bot, Project bot, Open thread, read).  
**Alternate paths**: "Ask bot" in the header and typing a request: not possible, the composer is inert.

### Steps
1. Click the card "Load testing" (GitHub #151, Assignee D, Owner Bo Reyes) → drawer opens with "Open in GitHub".
2. Click "Send to bot" → "Project bot".
3. Toast "Sent to Project bot"; Assignee row "P Project bot · working on it". Joon thinks: "Did this change the GitHub assignee?" Nothing says it did not.
4. Click "Open thread" → panel opens "P Project bot". Joon expects a thread about #151.
5. He reads the thread.

### Walk result
1. OK: drawer shows source row "GitHub issue #151 · acme/web", Owner "Bo Reyes".
2. OK: menu opens with three bots.
3. OK for row; CONFUSING: no sign that GitHub's assignee (Di Okafor) is unchanged (README S30 says the tracker assignee stays; card hides it).
4. OK: panel opens.
5. CONTRADICTS-PLAN: the panel shows the generic canned conversation ("What is blocked this week?", "3 blocked tasks", "Create 4 tasks in Product launch", ...), not a thread about #151 (screenshot s3-thread). README S30: "starts a thread with that bot containing the task and its source link". Only Research and Writer get a task thread.

### Variations / Edge cases
- Because Project bot is also the general assistant, a delegated task would mix with the project chat; the real design needs a rule (separate thread per task, as for Research/Writer).
- The #151 card now shows a P avatar; in the timeline the bar gets a P avatar after the bar end.

---

## STORY-039: Take a task back from a bot  
*(was DELEGATE-TO-BOTS-OWNERSHIP-05)*
**Type**: medium  **Persona**: Tomas, PM, sent the wrong task to Research and wants it back  **Goal**: Undo a bot assignment (or hand it to a person)  
**Preconditions**: Default state; ENG-31 "Landing page design" is already with Research  
**README stories**: S30  
**Ideal path**: 4 steps if an "Unassign" item existed in the "Send to bot" menu. Today: none found.  
**Alternate paths**: none found. The "Suggestion" card cannot do it, and the Assignee row is text.

### Steps
1. Click "Landing page design" → Assignee "Research · working on it", Owner "Ada Park".
2. Tomas looks for "Unassign" or a person dropdown on the Assignee row → none.
3. Click "Send to bot" → menu shows only the three bots.
4. Click "Writer" → Assignee becomes Writer; toast "Sent to Writer". Click Send to bot, Writer again → toast "Sent to Writer" again, no change.

### Walk result
1. OK: drawer shows the bot row.
2. MISSING: drawer buttons are `Send to bot | Project bot | Research | Writer | Open in Linear | Open thread | blockers` only. Assignee is not editable.
3. MISSING: no "Unassign", "Cancel", or "Assign to <person>" entry; the current bot is not marked.
4. CONFUSING: only a swap to another bot is possible; re-sending to the same bot reports success with no change. The tracker's own assignee (Cy Novak) is never shown again, so Tomas cannot tell who the task goes back to.

### Variations / Edge cases
- Dragging a card between columns does not change the bot (status only).
- No "done" state: a bot task never leaves "working on it".

---

## STORY-040: Plan the week by lane and timeline, delegating as you go  
*(was DELEGATE-TO-BOTS-OWNERSHIP-07)*
**Type**: long  **Persona**: Lena, project manager at a 30-person agency, planning the launch  **Goal**: See who (human or bot) holds what on Board and Timeline, hand off the support runbook, and verify the effect in every view  
**Preconditions**: Default state, 1360x860, nothing connected-off  
**README stories**: S10, S12, S29, S30, S28  
**Ideal path**: 14 steps. Delegation is only possible via the drawer; views update immediately.  
**Alternate paths**: "Filter by person or bot" can replace "Group by assignee" for one bot's tasks.

### Steps
1. Click "Group by assignee" → lanes: Ada Park 2, Bo Reyes 3, Cy Novak 2, Di Okafor 2, Eli Brandt 1, Research 1, Writer 2, Unassigned 1 (bots after people, with avatars).
2. Scan the Writer lane → "Press kit", "Post-launch survey". Lena thinks: "Writer already has two; fine."
3. Click the card "Support runbook" (PL-12, native, assignee C) → drawer.
4. Click "Send to bot", choose "Writer" → toast "Sent to Writer".
5. Click the scrim → board returns.
6. Check lanes → Cy Novak 1, Writer 3; the card moved lane. 
7. Pick "Writer" in "Filter by person or bot" → "Press kit", "Post-launch survey", "Support runbook" (group lanes with only the Writer lane).
8. Click "Timeline" → rows: "Press kit" with a W avatar in the label and at the end of the bar; "Post-launch survey" in the Unscheduled lane as a chip with a W avatar.
9. Reset the filter to "Everyone". Click the row label "Support runbook" → drawer opens.
10. Click "Send to bot" → "Research" → toast "Sent to Research"; the row now shows an R avatar and an R at the bar end.
11. Click the scrim. Click the chip "Post-launch survey" → drawer: Assignee "Writer · working on it", Dates "Unscheduled".
12. Click "Open thread" → panel opens on Writer's thread.
13. Click the X, then "Ask bot" → Project bot thread.
14. Click the citation chip "ENG-31" or "#145" → task drawer opens on top of the panel; Owner/Assignee visible.
15. Press Escape, then "Board", then "Group by assignee" off → back to the board with bot avatars on cards.

### Walk result
1. OK: lane text `A Ada Park 2 | B Bo Reyes 3 | C Cy Novak 2 | D Di Okafor 2 | E Eli Brandt 1 | R Research 1 | W Writer 2 | ? Unassigned 1`.
2. OK: Writer lane has the 2 seed tasks.
3. OK: drawer opens.
4. OK: toast shown.
5. OK: scrim click closes.
6. OK: lanes become `C Cy Novak 1` and `W Writer 3`. CONFUSING: Eli's lane has 1 only because "Post-launch survey" (Eli's) is in Writer's lane; nothing tells Lena that Eli's task is hidden behind a bot.
7. OK: Writer filter returns Press kit and Post-launch survey (Support runbook once sent).
8. OK: screenshot s8-timeline-writer shows the W avatar on the row, the bar end and the chip. CONFUSING: the avatar appears twice per row (label right and bar end); redundant.
9. OK: row labels are clickable (`.tl-l[data-open]`).
10. OK: row avatar count 1, bar-end avatars 3 after the send (screenshot s8-timeline-research). Note a bot avatar at a bar end overlaps nothing but sits where the dependency arrow leaves the bar for "Press kit".
11. OK: drawer text `Assignee W Writer · working on it ... Dates Unscheduled`.
12. OK: opens the Writer thread.
13. CONFUSING: "Ask bot" is hidden while any thread is open, so the user must close the panel first; no way to switch between Project bot, Research and Writer threads inside the panel (nav bot rows are inert).
14. Not exercised in this walk; discovery.md records that citation chips open the drawer over the open panel.
15. Not exercised; board and group toggles were exercised in steps 1 to 7. No console errors in any walk.

### Variations / Edge cases
- Send a task that is blocked: the "Blocked" marker remains; a bot works on a blocked task and nothing warns.
- Over the WIP limit of "In progress" 3 / 2: bots do not count differently; no signal.
- Dragging the bar of a bot-held task moves dates with no "ask the bot first" step.

---

## STORY-041: Delegate from a phone-width screen  
*(was DELEGATE-TO-BOTS-OWNERSHIP-08)*
**Type**: short  **Persona**: Sam, designer, triaging on a narrow window  **Goal**: Send a task to Writer and open its thread at 390 px  
**Preconditions**: 390x844 viewport, default state  
**README stories**: S30  
**Ideal path**: 4 steps.  
**Alternate paths**: none found.

### Steps
1. Tap "Partner outreach list" → drawer fills the screen.
2. Tap "Send to bot", choose "Writer" → toast "Sent to Writer"; row "Writer · working on it" with "Open thread" wrapping to two lines.
3. Tap "Open thread" → full-screen "Writer" panel, task as user message, "Working on it" card with "PL-16".
4. Tap the X → back to the board.

### Walk result
1. OK: screenshot m1-drawer.
2. CONFUSING (minor): "Open thread" wraps and "working on it" wraps (screenshot m3-sent); the drawer's "Suggestion: Assign to Cy Novak" remains below.
3. OK: panel is full screen (screenshot m4-thread); the toast overlaps the composer.
4. OK: `#closeBot` is visible and works.

### Variations / Edge cases
- The left nav is hidden under 900 px, so there is no bot row to fall back to.

## 5. Redundancy candidates

Each row is a place where the design offers two paths or shows the same information twice. "Keep" is a recommendation, not a decision.

| # | Overlap | Where seen | Recommendation |
|---|---|---|---|
| R1 | Drawer "Suggestion" card vs bot-panel suggestion card (same move-due-date or assign suggestion in two places, independent Dismiss, the panel card has no reason line) | 030, 032, 038 | One suggestion record rendered in both places; dismissing or accepting in either clears both. Keep the reason line on both. Consider showing suggestions only in the drawer plus a count in the panel. |
| R2 | "Send to bot" menu entry "Project bot" vs header "Ask bot" (both reach the Project bot; Open thread for Project bot lands in the generic chat) | 036, 038, 040 | Keep "Ask bot" as the only entry for the Project bot. Send to bot lists only bots that take a task (Research, Writer) unless Project bot gets a real per-task thread. |
| R3 | Sources filter (dropdown with checkboxes) vs "Mockup states / Connected" toggles | 006, 007, 005 | The mock toggles are test scaffolding. In the product the Sources dropdown is the one place for per-source state: filter checkbox, access lock, sync status dot, Disconnect, Add source. Do not add a separate Integrations path for the same actions. |
| R4 | "Filter by person or bot" vs "Group by assignee" (both answer "whose work is this"; combining them leaves other people's lanes) | 013, 014, 040 | Keep both; when a person filter is on, group lanes should show only the matching lanes. Offer Owner and Assignee as explicit modes. |
| R5 | "Blocked" shown as card marker, drawer "Blocked by", timeline arrow, conflict marker, bot answer and weekly report (three different counts) | 009, 025, 027, 031 | One definition computed in core. The bot answer and report must be reproducible from the board marker. |
| R6 | Weekly report "At risk" repeats the "Blocked" line with a different reason | 031 | Merge into one line per task with a reason tag. |
| R7 | Changing status by drag vs bot "Change status" card vs (missing) drawer Status control | 012, 028, 011 | Keep drag (user's own action, no approval) and the bot card (approval). Add the drawer Status select as the keyboard and touch path; do not add a third mechanism. |
| R8 | Bot avatar on the timeline row label and again at the bar end; bot avatar on card, lane header and drawer | 040, 013 | Row label only on the timeline; one avatar on cards. |
| R9 | Conflict signal drawn four ways (warning icon on bar, icon in row label, red dashed arrow, legend entry) and "Blocked" marker on the same task in Board | 018, 025 | Keep the red dashed arrow and one icon; drop the duplicate row-label icon. |
| R10 | Two "New project" entries (empty-state button and Project menu item) that both do nothing different, plus connect buttons at the same level as "New project" | 001, 007 | Keep the empty-state button for first run; Project menu "New project" stays for later. Put "Add source" in Sources, not beside "New project". |
| R11 | Drawer source row "Synced N min ago" always shown vs README "last sync time visible only when stale"; sync banner and Sources red dot both signal failure | 005, 009 | Hide Synced time unless stale; keep banner, make the dot point at the failing source row. |
| R12 | "Open in <source>" in the drawer source row, in suggestion cards, and in the Working-on-it thread card | 030, 037 | Keep; they serve different moments. No change, but use one label and component. |
| R13 | Four routes into the same task detail (card, bar, row label, chip, citation) with different behaviour (keyboard works only on cards) | 011, 018 | Same component and keyboard contract for all. |
| R14 | Narrow-width variants of five topics each rediscover that drag and the drawer do not work on touch | 008, 017, 026, 034, 041 | Fix once: non-drag status control, drawer z-order, view-only timeline at narrow width. Then keep a single phone journey. |
| R15 | Read-only signalled by global badge, silent cursor change and nothing else; delegation in read-only (merged into 015) and bot card test the same defect | 002, 007, 015, 033 | Fix once per source (see A1); keep 015 and 033 as the two regression journeys, drop the rest to variations. |

## 6. Consolidated findings

Merged from the Findings sections of the five topics (about 80 raw items). Severity: High = blocks a README v1 story or breaks trust; Med = real friction a user would hit; Low = polish. Story ids are the new STORY-nnn ids. "Fix" names the concrete change. Rule used for grouping: a canned answer, a no-op button, a toast instead of a backend, or hardcoded data is group C. Something a user of the shipped design would hit is group A.

### A. Real design problems that would ship (fix in plan and mockup)

| # | Sev | Problem | Journeys | README | Fix | Status |
|---|---|---|---|---|---|---|
| A1 | High | Read-only is one global flag, and its enforcement is partial: locking one tracker locks all; drag lock is silent (no tooltip); the bot still offers a working "Change status" Approve card on a read-only tracker, and other bot cards for disconnected sources remain. High-trust failure: UI says read-only and "will write". | 002, 007, 015, 033 | S24, S23 | Store access per source. Lock only that source's cards, with a tooltip ("GitHub is connected read-only") and accessible description. Never create a Change status card for a read-only or disconnected source; show a suggestion with "Open in <source>" instead. Show the badge per source in the Sources row. | Fixed |
| A2 | High | No way to add a second source or disconnect from a populated page; the Sources dropdown only filters, and unticking looks like removal. | 006, 007 | S6, S7 | Add "Add source" at the bottom of the Sources dropdown (opens the connect panel) and a per-source "Disconnect" with a confirm that offers "Delete synced data" (native tasks untouched). | Fixed |
| A3 | High | "New project" shows another project's board; no native task can be created or edited, no empty board, no "Add task". The first-run story cannot succeed. | 001, 007, 019 | S1, S8, S27 | "New project" asks for a name, opens an empty board with an empty-state line and "Add task"; drawer fields become editable for native tasks. | Fixed |
| A4 | High | No non-drag way to change status or any field: drawer Status/Owner/Assignee/Dates are text; cards have no "Move to" action; HTML5 drag does not fire on touch. Keyboard, screen-reader and phone users cannot do the main board action. | 011, 016, 017, 019 | S9, S27 | Drawer Status becomes a select using the same write as drag; add a "Move to" item in a card menu; fields in the drawer go through the same write path (S27). | Fixed |
| A5 | High | Timeline drag says "N dependents move" but dependents do not; release writes to the tracker immediately, creates new red conflicts, has no preview list, Save/Cancel, undo or failure revert; the count is every transitive dependent (even when moving earlier). | 020, 021, 025 | S13, S9 | Show a preview listing tasks that would conflict with their new dates and Save/Cancel (or write on release with an Undo toast); revert the bar on write failure; count only tasks whose start falls before the new end. Add snap to blocker end. | Fixed (snap to blocker deferred) |
| A6 | High | Unscheduled tasks cannot be dated: chip drag does nothing and drawer dates are text. | 019 | S12, S27 | Drag the chip onto the grid to set dates, plus a Dates control in the drawer. | Fixed |
| A7 | High | "Update conflict" modal values (Nov 13 / Nov 6, "Due date") match neither the bar nor the seed; choosing Keep mine or Use GitHub changes nothing on screen; Escape and scrim do not close it; "Keep mine" does not say it overwrites GitHub. | 024 | S26 | Show the task's start/end in both columns, apply the choice to the bar, add "Decide later" and Esc, label the buttons "Keep my date (Nov 13)" and "Use GitHub's (Nov 6)". Trigger it from a drag, not a toggle. | Fixed |
| A8 | High | The bot's "blocked" count differs between the answer (3), the board (7 Blocked cards) and the weekly report (2). Users will stop trusting the bot. | 027, 031, 035 | S16, S20 | One rule ("has a blocker that is not Done") computed in core and used by board, timeline, answer and report; the answer must show a count the board reproduces. | Fixed |
| A9 | High | Delegation dead ends: no Unassign or assign-to-person; the current bot is not marked; the tracker's own assignee vanishes (ENG-31 Cy Novak); "Open thread" for Project bot opens the generic chat; a bot task never shows progress or "done"; a task sent to a bot stays in Backlog while saying "working on it". | 036, 037, 038, 039, 016 | S30 | Add Unassign and Assign to person in the Send to bot menu; mark the current bot; show "Linear assignee: Cy Novak" on the bot row; give Project bot sends their own task thread; thread shows a status line (Working / Needs you / Done) with a reply box; define the task status when a bot starts. README S30 must state the unassign path. | Fixed (reply box deferred) |
| A10 | High | On narrow screens the task drawer (z-index 20) opens behind the full-screen bot panel (22), so tapping a citation chip looks broken; on desktop the 440px drawer fully covers the 380px panel and hides the conversation. | 027, 034 | S16, S28 | Raise the drawer above the panel; keep the drawer narrower than viewport minus panel on desktop, or close the panel while a task is open and restore the thread on close. | Fixed |
| A11 | Med | Bot action cards have no resolved state: after Approve, Accept all/selected, Dismiss, Save to thread the same buttons stay and a second click repeats the action (duplicate tasks, double approval). Toast gives no count. | 028, 029, 030, 031, 035 | S23, S17, S20 | Replace the buttons with a one-line result ("Done in GitHub", "3 tasks created", "Dismissed", "Saved"), disable the card, show counts; disable Accept selected at zero ticked and warn when unticking a task that others depend on. | Fixed |
| A12 | Med | Suggestion logic bugs a user would hit: assignee suggestion still shown when a bot already holds the task; reason text says "Blocker is still in progress" when the blocker is in Todo; same suggestion lives in two places with independent Dismiss; due-date suggestion moves the end later when the conflict is fixed by starting later. | 009, 018, 030, 032, 036, 038 | S18 | Suppress assignee suggestions for bot-held tasks; build the reason from the blocker's real status; one record per suggestion shared by drawer and panel; for conflicts suggest a later start. | Fixed |
| A13 | Med | Person/bot filter matches owner OR assignee with no label, hides bot-held cards from the human assignee's filter (ENG-31 vanishes from Cy), mixes with Group by assignee (other lanes still show), WIP "1 / 2" hides that the whole column is over, and label/project filters do not exist. | 014, 016, 040 | S10, S29, S11 | Separate Owner and Assignee modes; show a small "with Research" marker or count under a person's filter; compute the WIP count over source-visible cards, or show "1 of 3 / 2"; add label and project filters. | Fixed |
| A14 | Med | Filters hide schedule risk silently: person filter and Sources filter remove blockers, arrows, conflict markers and milestones (Launch day disappears). | 025 | S12, S14 | Show "1 hidden blocker" on bars whose blocker is filtered; never hide milestones. | Fixed |
| A15 | Med | Notion tasks have no id or title on bars and chips ("Page" chip for every Notion task); two Notion lines in one bot answer cannot be told apart. | 004, 009, 019, 023, 027, 031, 037 | S28 | Show the task title on bars and in chips when no id exists (and a short title in citation chips). | Fixed |
| A16 | Med | Notion "no dependency relation" note appears only on Timeline (Board users silently lose Blocked markers); "Add relation" does not say it writes a property into the user's Notion database; the Linear drawer still lists a Notion blocker while arrows are hidden; Add relation is offered in read-only. | 004, 023 | S4, S24 | Show the note on first Board load and in the Notion Sources row; label the button with what it writes; keep the dependency source consistent across board, chart, drawer and bot; hide Add relation when Notion is read-only. | Fixed |
| A17 | Med | Sync failure gives no reason or age, the red dot is not repeated in the dropdown row, first-sync progress and count are absent, no Reconnect path for expired tokens, banner persists for a source filtered off. | 002, 003, 005, 007 | S2, S26 | Banner: "GitHub sync failed. Last synced 2h ago" with Retry and Reconnect when auth failed; red dot on the GitHub row; "Syncing 42 issues" then "Synced 14 tasks" after connect. | Fixed (sync progress is a toast) |
| A18 | Med | Keyboard and screen-reader gaps: timeline bars and the conflict triangle are not focusable or operable; hover-only `title` tooltips for Blocked and WIP; focus is lost when the drawer closes; cards have no role or name; bot-card buttons are 12px high. | 009, 010, 011, 016, 018 | S8, S27 | Bars become buttons (Enter opens, arrows move a day); Blocked becomes a focusable popover; return focus to the opener; give cards role and accessible name with status, id and Blocked. | Fixed |
| A19 | Med | Cross-lane drop in Group by assignee silently changes status only; the card jumps back to its old lane. | 013 | S10 | Highlight only the card's own lane as a valid drop, or reassign on cross-lane drop with a toast naming the new assignee (bot assignment stays Rakazo-side). | Fixed |
| A20 | Med | Conflict marker is a dead icon: not clickable, no conflict count, no hint toward Shift dependents. | 021, 025 | S14, S15 | Make the marker focusable and open the preview; add a conflict count; show a disabled "Shift dependents" (labelled Later). | Fixed |
| A21 | Med | Bot panel navigation: "Ask bot" is hidden while any thread is open and there is no switch between Project bot, Research and Writer threads. Nav bot rows look clickable but do nothing. | 037, 038, 040 | S30, S16 | Bot switcher in the panel header, or wire nav rows to open that bot's latest thread. | Fixed |
| A22 | Med | Narrow-width behaviour: swipe that starts on a timeline bar reschedules and writes to the tracker; board is a 990px sideways scroll with no cue; header takes 120px. | 017, 026 | S12, S9 | Timeline view-only (or long-press to drag) at narrow widths; board shows one column with a picker. Mobile is out of v1, so decide the narrow-window policy. | Fixed |
| A23 | Low | No warning when a blocked card moves to In progress/Done, and no Undo on tracker writes ("written to Notion" with a single gesture). | 012, 016, 025 | S9 | Keep the move; add Undo to the toast and a suffix "still blocked by <task>". Lock or confirm dragging Done bars. | Fixed |
| A24 | Low | Ids and icons inconsistent (native cards have id, no icon; Notion icon, no id); icons have no text label. | 009 | S28 | One legend in the Sources dropdown (already holds icons and names). | Fixed |
| A25 | Low | Column headers are not sticky in Group by assignee, so the amber WIP header scrolls away; "Mockup states" overlaps lower lanes. | 013, 016 | S10 | Make the header row sticky. | Fixed |
| A26 | Low | Critical-path legend never defines "critical"; arrows into milestones overlap the diamond. | 022 | S14 | Tooltip on the legend entry; route arrows to the diamond's left edge. | Fixed |
| A27 | Low | Bot avatar duplicated on timeline row label and bar end; sits on the dependency arrow exit. | 040 | S30 | Keep the row-label avatar only. | Fixed |
| A28 | Low | "Open in Linear" does not say the change appears after the next sync; "Send to bot" menu lists bots with no role. | 030, 036 | S18, S30 | Toast "Opened in Linear. Rakazo updates on next sync."; role line on hover only (copy rule). | Fixed (bot role line deferred) |
| A29 | Low | Empty states: filtering to a bot with no cards gives five empty columns; unticking every source gives a blank board; no empty-column text. | 014, 007 | S8 | "No tasks" line; "No sources selected" with Select all. | Fixed |
| A30 | Low | Access toggle has no explanation; access state is sticky across connect forms; duplicate headings "Connect Notion" / "Map properties"; locked-card tooltip absent. | 002, 003, 004, 008 | S2, S3, S4 | Reset the toggle per form (or store per source); one helper line only when Read and write is chosen (quote in PR per copy rule); drop the second heading. | Fixed |

### B. Plan gaps and contradictions (README says one thing, mockup another)

| # | Sev | README vs mockup | Journeys | Which side changes | Fix | Status |
|---|---|---|---|---|---|---|
| B1 | High | S13 says the preview "lists dependents that would move" in v1, but S15 (cascade) is later, so v1 has no way for dependents to move. The mockup's tooltip inherits this contradiction (A5). | 020, 021 | README | Reword S13: preview lists the tasks that would start before the new end (conflicts), not tasks that "move". Cascade stays S15. | Fixed |
| B2 | High | S4 lists mapped fields without Owner, while S29 and the capability matrix say Owner is an optional mapped person property for Notion. The mockup's Assignee defaults to the Owner property and has no Owner row. | 004 | README (S4) first, then mockup | Add optional Owner to the S4 mapping list; mockup adds an Owner row and defaults Assignee to a property named Assignee or None. | Fixed |
| B3 | High | S1 promises "New project" with no account and native task fields; mockup shows a populated project and no create or edit controls. | 001 | Mockup | Build the create flow (A3). README fine. | Fixed |
| B4 | High | S7 (v1, disconnect and delete) and S6 (v1 combine) have no UI. | 006, 007 | Mockup | Add Add source and Disconnect to Sources (A2). | Fixed |
| B5 | Med | S11 (WIP) and Decision 11 are "later", yet the mockup shows an over-limit column by default with no way to set a limit. | 010, 016 | Mockup | Hide WIP until a limit exists, or promote S11 to v1 and add "Set limit" in a column menu. Recommend hide. | Fixed |
| B6 | Med | S23 requires an approval card for any native write by the bot; S18 says suggestions are accepted or dismissed. The mockup's drawer "Accept" toasts "Sent for approval" with no card, and the user's own click is described as needing approval (S23 also says the user's own edits need none). README never says whether Accept on a suggestion is the approval. | 016, 032 | README (S18/S23), then mockup | State: clicking Accept on a suggestion is the approval and applies the change, naming it ("Assigned to Cy Novak"); the approval card is for bot-initiated writes in the thread. Mockup Accept applies the change. | Fixed |
| B7 | Med | S26: last sync time visible only when stale and refresh on open. Mockup drawer always shows "Synced N min ago". | 005, 009 | Mockup | Hide unless stale. | Fixed |
| B8 | Med | S28 says Notion shows a page icon only (no id), which makes bars and chips anonymous. README does not define a Notion label. | 004, 019, 023, 027 | README | Add: tasks without a source id show their title in chips and on bars (supports A15). | Fixed |
| B9 | Med | S10 lists label and project filters and S29 says the board can filter by owner; mockup has one mixed filter and none of those. | 014 | Mockup | Add Owner mode, label, project filters (A13). | Fixed |
| B10 | Med | S2 says pick which teams to show (plural); mockup Team is a single select. S3 says the board names its status rule; mockup never does. S12 says zoom week/month/quarter and project-or-phase grouping; S13 says edge resize; none exist. | 002, 003, 018, 025 | Mockup | Multi-select teams; one quiet rule line in the GitHub Sources row; add zoom and edge resize or mark them out of the mockup. | Deferred (zoom, edge-resize) |
| B11 | Med | S24 requires a tooltip on locked drag and removing the bot status change; mockup does neither. (Same defect as A1; listed here because the README is clear and the mockup is wrong.) | 015, 033 | Mockup | See A1. | Fixed |
| B12 | Med | S30 says the bot thread contains the task and source link and the task moves to the bot's swimlane; it never says how to take a task back or what "working on it" ends as. | 039 | README | Add unassign and finished states to S30 (A9). | Fixed |
| B13 | Med | S18 describes triage as a list; the mockup has a per-task Suggestion card only. S20 says on-demand report; the mockup has a canned thread message with no generate control. S17 says paste an epic; the composer is inert. | 029, 031, 032 | Mockup (or mark README "mockup canned") | Add a triage list and an on-demand "Generate report" in the mockup, or state in the mockup notes that these are canned. | Deferred |
| B14 | Med | S25 (space and user scoping, shared native vs private tracker) has no representation in the mockup and no journey. | none | Mockup + new journey | Add a second-member switch in Mockup states and a journey for it. | Deferred |
| B15 | Low | Decision 7 says the bot opens via "Ask bot" only, while nav rows for Project bot, Research and Writer look clickable. | 037, 040 | Mockup | Remove the nav bot rows or wire them (A21). | Fixed |
| B16 | Low | S23 requires "Always allow this kind"; absent from approval cards. | 028 | Mockup | Add the checkbox on approval cards (hidden until second approval of the same kind). | Deferred |
| B17 | Low | S14 says the critical path is computed in core; mockup hardcodes `c:1`. Mockup shortcut that keeps the README promise open: tests must recompute after a drag. | 022 | Mockup note | Compute from the dependency graph in the mockup JS, or label as a stub. | Fixed |
| B18 | Low | Projects menu "Docs refresh" shows the same tasks; Sources counts ignore the active project and filter. | 001, 007 | Mockup | Give Docs refresh its own data or hide the menu until built. | Fixed |

### C. Mockup-only shortcuts (fine, no action)

- Empty state reachable only through "Mockup states / Connect source"; "Connect" does not add data; every source's data is always present (001, 002, 007).
- No OAuth or token step, static property options when Database changes (003, 004).
- Retry always succeeds; sync error and conflict states are set by toggles; error banner names GitHub only even when GitHub is unticked (005, 024).
- Composer ("Ask about this project") is a plain div; the proposal's "Edit" button does nothing; all bot answers are canned and the thread opens at the oldest message; weekly report hardcoded to "Oct 12 to 16" (027-035).
- "Open in Linear/GitHub/Notion" links do nothing; "Accept"/"Approve"/"Dismiss" only toast (but see A11 and B6 for the shipped design questions).
- "Reload resets everything"; no persistence; "Mockup states" panel overlaps lower lanes (010, 013).
- Status card still appears for a disconnected source because toggles are independent (028).
- Re-sending a task to the same bot toasts success with no change (039); on the shipped design disable the current bot item (covered in A9).
- Left-nav rows, Search and Integrations inert (but see B15).
- Critical path hardcoded (022, see B17).

## 7. Gaps and recommendations

README stories with no journey: **S5, S21, S22** (all "later"; no journey needed now) and **S25** (v1, scoping; the one real gap).

README stories touched only as "feature missing" probes: S15 (only as a dead conflict marker, 021), S19 (a canned suggestion, 030), S6 (combine; no way to do it, 007), S11 (display only, 010).

Journeys to add (priority order):
1. **S25 two-member space**: member A connects GitHub, member B sees only the native project; member leaves and loses native access. Needs a user switch in Mockup states.
2. **S9/S13 failed write**: a tracker write fails after a drag or bar move; the card or bar reverts with an inline error and a retry.
3. **S1/S27 native task lifecycle**: create a project, add tasks, set status, owner, assignee, dates and blocked-by, comment (depends on A3, A4).
4. **S7 disconnect**: connect, disconnect with Delete synced data, confirm native tasks remain and the bot no longer offers cards for it (depends on A2).
5. **S2 first-sync failure and reconnect**: expired token, retry, reconnect (A17).
6. **S17 tracker-project proposal**: paste text into a Linear project, get a suggestion with "Open in Linear" and no create button; plus the native approval path with real input.
7. **S18 triage list**: new unassigned tasks, duplicate and label suggestions, accept and dismiss each.
8. **S12/S13 zoom and edge-resize**: week/month/quarter, resize a bar from its edge.
9. **S29 owner**: change owner in the drawer, filter by owner, see owner on cards.
10. **S23 Always allow**: approve a status change twice and see the rule offered; later actions skip the card.
11. **S26 stale refresh**: open Projects with a stale source; sync indicator appears only then.
12. **S6 combine after first project**: add a second source from Sources on a populated page (the real version of the long STORY-007).

Recommendations for the plan and mockup, in order:
- Fix A1 to A10 in the mockup before any build; they are High and each blocks a v1 story or breaks trust.
- Change README for B1, B2, B6, B8 and B12 so the build matches an unambiguous plan.
- Consolidate R1, R2, R3, R7 (suggestion record, bot entry points, Sources surface, status change paths) before adding more journeys; they remove the most duplicated surface.
- Keep 007, 016, 025, 035 and 040 as the five long regression journeys; fold 015 and 033 into one read-only journey once A1 is fixed.
