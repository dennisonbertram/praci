# App Discovery: Praci Projects (mockup)

Scope: the planned Projects page and Project bot only. Sources read in full: `docs/project-management/README.md` (stories S1-S30, decisions, capability matrix) and `docs/project-management/mockup.html` (593 lines, vanilla JS). Tags: [mockup] = built in the mockup, [plan only] = README requires it but the mockup has no UI for it, [both] = both agree. All data is invented. The mockup's "today" is Oct 16 (seed day 11 from Oct 5).

## Application Type

Projects page inside the Praci app shell: a Kanban board and a Waterfall timeline of projects/tasks, plus a Project bot in a right-hand side panel. Task source is pluggable (GitHub, Linear, Notion, or native Praci tasks). Web and Electron first; mobile is a later follow-up.

## Tech Stack

- Mockup: single static HTML file, vanilla JS, inline CSS and inline SVG, HTML5 drag and drop for cards, pointer events for timeline bars, no build, no network. Light/dark by `prefers-color-scheme` plus a manual override. Under 900px the left nav is hidden and the bot panel goes full screen.
- Planned (README): web + Electron (Electron hosts the web UI), shadcn on Base UI in `packages/ui-web`, inline SVG for the timeline (no Gantt library), normalized model and scheduling code in `packages/core`, `ProjectSource` adapters in `packages/adapters` (native/Postgres, linear, github, notion) calling vendor remote MCP servers over OAuth, sync into Postgres scoped to space and user, bot with `spawnKey = "projects-agent:<userId>"`, approval cards via `connectorToolRequiresApproval` and `ActionApprovalRule`. Routes `/app/projects`, `/app/projects/:projectId`, `/app/projects/tasks/:taskId`.

## User Roles

- Space member: sees and edits native projects (shared across the space, S25/Decision 9); sees only the tracker data they connected themselves. [plan only] for the sharing rule; the mockup has no user switch.
- Owner of a task: the accountable person, separate from the assignee (S29). Shown in task detail only. [both]
- Connector (the member who connected a tracker): chooses access "Read only" or "Read and write" at connect time. [both]
- Read-only tracker user: tracker connected read-only; drag disabled, bot status change removed (S24). [both, bot part plan only]
- Bots as actors: Project bot (answers, proposes, asks approval), Research and Writer (receive a task via "Send to bot", become assignee with "working on it"), Inbox agent (in sidebar only, no Projects behavior). Bots have their own swimlane and avatar and appear in the people filter. [both]
- Approver: the human who clicks Approve/Accept on bot cards. The user's own drags and edits need no approval. [both]

## Feature Map

Shell and header
- Left nav: Search, Inbox (12), Finance, Projects (active), Bots (Inbox agent, Project bot, Research, Writer), Integrations. Static, not clickable. [mockup]
- Project menu (button with project name): "Product launch", "Docs refresh", "New project". Switching only changes the label; data does not change. [mockup, partial]
- View switch (segmented): "Board" / "Timeline". [both]
- "Sources" button with per-source icon + count (GitHub, Linear, Notion, "Native"), error dot when sync fails; dropdown with a checkbox per source and count = Sources filter. [both]
- "Filter by person or bot" select: "Everyone", People (Ada Park, Bo Reyes, Cy Novak, Di Okafor, Eli Brandt), Bots (Project bot, Research, Writer). Matches owner or assignee. [both, but see mismatches]
- "Read-only" badge with lock when read-only. [mockup]
- "Group by assignee" toggle (board only). [both]
- "Ask bot" button (hidden while panel is open). [both]
- Filter by label, by project filter chips, filter by owner as its own control. [plan only] (S10, S29)

Connect / first run
- Empty state "Projects" with "New project" and "GitHub", "Linear", "Notion" buttons. [both]
- "Connect GitHub": Repository (acme/launch-site, acme/api), "Status from" (Project field "Status" / Open / closed and labels), Access "Read only" / "Read and write", "Back", "Connect". [both]
- "Connect Linear": Team (Growth, Platform, Design), Access, Back, Connect. [both] (README says pick which teams to show, plural)
- "Connect Notion": "Map properties": Database (Launch tasks, Roadmap), Status, Assignee, Start, End, Blocked by (optional), Estimate (optional), Access, Back, Connect. [both]
- OAuth redirect, first-sync progress and count, retry on failed first sync, token entry for GitHub. [plan only] (S2, S3)
- Another tracker via MCP (Jira, Asana). [plan only, later] (S5)
- Move native tasks to a tracker with preview ("Move to Linear"). [plan only, later] (S6)
- Combine several sources in one project: seed data mixes all four. [both]
- Disconnect a source and delete its synced data. [plan only] (S7); no control exists.
- Create a native task, edit a task, add a comment. [plan only] (S1, S27); no control exists.

Board
- Columns Backlog, Todo, In progress, In review, Done with counts. [both]
- Card: title, source icon + source id (GitHub #142, Linear ENG-42, native PL-n, Notion icon only), label tag, "Blocked" marker (hover lists blockers), assignee avatar (person or bot), "Due <date>" or "No date". [both]
- Drag card to column: updates status; toast "<id> moved to <col>" plus " and written to <GitHub|Linear|Notion>" for non-native tasks. [both]
- Failure path: card returns plus inline error. [plan only] (S9)
- "Group by assignee": a lane per person, then per bot (avatar, name, count), then Unassigned. [both]
- WIP limit: "In progress" shows "3 / 2", warning tint, icon, tooltip "Over the limit of 2"; never blocks a drop. [both] (README marks it later, mockup shows it). No UI to set limits.
- Card click or Enter opens the task drawer. [mockup]
- Milestones are not shown on the board. [mockup]

Timeline (Waterfall)
- Phase groups Plan, Build, Launch prep, Launch; one bar per task labelled with source id; done tasks faded; sticky label column and week header; "Today" pill and line. [both] (README says "grouped by project or phase")
- Dependency arrows (blocker to dependent), critical path in heavy ink, violating arrows red dashed. [both]
- Milestones as diamonds with labels ("Beta ready", "Launch day"). [both]
- Conflict marker (warning icon at bar start, also in row label, tooltip "Starts before <id> ends") for "Security review". [both]
- Drag a bar (or milestone) to reschedule: tooltip "N dependent(s) move(s) · +Nd", dependents get a dashed outline; on release the bar moves, dependents do not, toast "<id> moved +Nd and written to <source>". [both, partial]
- Drag a bar edge to resize. [plan only] (S13)
- "Unscheduled" lane of chips (assignee, source icon, title, id). [both]
- Legend: Critical path, Task, "Starts before blocker ends", Today. [mockup]
- Zoom week/month/quarter. [plan only] (S12)
- "Shift dependents" on the conflict marker. [plan only, later] (S15)
- Notion no-relation note row: "Notion has no dependency relation" with "Add relation" (toast "Sent for approval"). [both]

Task drawer (opens from card, bar, row label, chip, blocker, citation chip)
- Header: title, "Send to bot" menu (Project bot, Research, Writer), close. [both]
- Source row: kind and location (e.g. "GitHub issue #142 · acme/web", "Native task · Product launch"), "Synced 2 min ago" or "Saved in Praci", "Open in <source>". [both]
- Fields: Status, Owner, Assignee (or "<bot> · working on it" with "Open thread"), Dates, Label, Estimate (derived "N pts"). Read-only text, not editable. [mockup]
- "Blocked by" chips with source icon, id, title, status; "None"; "No relation property" in Notion no-relation mode. [both]
- Bot "Suggestion" card (reason line, "Accept" for native / "Open in <source>" for tracker, "Dismiss"); appears only when task has no assignee or has an open blocker. [both]
- "Comments" (two canned). Escape or scrim closes. [both]

Bot panel (opened by "Ask bot", close X; composer "Ask about this project" is static)
- Q&A "What is blocked this week?" answer "3 blocked tasks" with citation chips that open the task. [both]
- Proposal card "Create 4 tasks in Product launch": checkboxes, estimates, blocker notes, "Accept all", "Accept selected", "Edit" (no-op). [both]
- Approval card "Change status": Task chip, Target GitHub, "In progress" struck through to "Done", "Approve", "Reject". [both]
- Tracker suggestion "Move due date from Oct 27 to Nov 3" for ENG-42 with "Open in Linear", "Dismiss". [both]
- "Weekly report · Oct 12 to 16": Done, In progress, Blocked, At risk, every line with a citation chip, "Save to thread". [both]
- Bot thread for a sent task (Research or Writer): the task as user message and a "Working on it" card with citation chip and "Open in <source>". [both]
- "Always allow this kind" rule on approvals. [plan only] (S23)
- Triage list of unassigned/new tasks with accept/dismiss and duplicate/label suggestions. [plan only] (S18); only a per-task suggestion exists.
- Re-plan with timeline preview ("the API work slips two weeks"). [plan only, later] (S19); mockup answers with a tracker suggestion instead.
- Stale-task nudge digest, estimate suggestions, scheduled reports. [plan only, later] (S21, S22, S20)
- Free-text input actually sending messages. [plan only]

Mockup states panel (bottom-left "Mockup states", dashed, mockup only)
- Connected: GitHub, Linear, Notion, Native checkboxes; toggles "Connect source", "Sync error", "Conflict", "Read-only", "Notion: no relation"; Theme auto/light/dark.

Cross-cutting
- Sync error banner "GitHub sync failed" with "Retry" (shows "Syncing...", then toast "Synced"). [both]
- Stale-write conflict modal "Update conflict": "#145 Billing integration · Due date", "Yours" vs "GitHub, 4 min ago", "Keep mine" / "Use GitHub". [both]
- Last sync time visible only when stale, refresh on open, throttle. [plan only] (S26)
- Space/user scoping, member leaving loses native access. [plan only] (S25)
- Read-only mode: drag and bar-drag disabled for non-native tasks (cursor changes only). [both]

## Navigation Structure

- Entry: left nav "Projects" (only item wired as active; other nav rows, bot rows, Search and Integrations do nothing).
- Header controls swap the main area without leaving the page: Project menu, "Board"/"Timeline" tabs, Sources dropdown, person/bot filter, "Group by assignee".
- Board card or Timeline bar/row label/Unscheduled chip/blocker chip/citation chip -> task drawer (right overlay, scrim). Close with X, scrim, or Escape.
- Drawer "Send to bot" -> pick bot -> drawer stays open, toast "Sent to <bot>", Assignee row becomes "<bot> · working on it" with "Open thread".
- Drawer "Open thread" -> drawer closes, bot panel opens on that bot's task thread (for Project bot it shows the canned Project bot conversation, not a task thread).
- Header "Ask bot" -> right panel (380px, Project bot). X closes. Citation chips and "Open in <source>" link out to drawer / (no-op) source.
- Citation chip in bot panel -> task drawer opens on top of the page while the panel stays open.
- Empty/connect: only reachable via the Mockup states toggle "Connect source" (in the real product, first run). Empty -> "New project" (goes straight to a populated board) or a connector button -> connect form (Back / Connect) -> board.
- Sync error and conflict states are set from the Mockup states panel only; there is no organic trigger.
- "New project" in the Project menu behaves like the empty state's "New project": no form, no new project is created.
- No navigation to /app/projects/:projectId or per-task URLs is shown.

## Data Entities

- Project: name (Product launch, Docs refresh), phases (Plan, Build, Launch prep, Launch). Plan: `Project` in `packages/core`; one project may combine sources.
- Task: id, title, status (+ plan `statusCategory` todo/doing/done), label, start/end dates, milestone flag, unscheduled flag, estimate, blocked-by list, source, source id, `sourceVersion` (plan). 16 seed tasks.
- Task sources: `gh` GitHub issue (acme/web; ids #142, #145, #151), `lin` Linear issue (Growth; ENG-31, ENG-42, ENG-47), `no` Notion page (Launch tasks; no id), `nat` Native (Product launch; PL-n ids).
- Owner: person accountable (Ada, Bo, Eli among seeds). Praci-side field for GitHub/Linear; mapped property for Notion.
- Assignee: person (Ada Park, Bo Reyes, Cy Novak, Di Okafor, Eli Brandt) or bot (Research on ENG-31, Writer on Press kit and Post-launch survey), or none (Partner outreach list). Bot assignment lives on Praci's row only.
- Dependency: blocker -> dependent (`TaskDependency`); drives Blocked marker, arrows, critical path, conflict.
- Milestone: Beta ready (PL-8), Launch day (PL-14).
- Source connection: `McpServer` (+ OAuth session) with access mode ro/rw, per-source selection (team, repository, Notion database and property map), counts, last synced.
- Bot thread: Project bot conversation; per-task thread with Research or Writer.
- Suggestion: reason-bearing item with Accept / "Open in <source>" / Dismiss (drawer card and bot panel card).
- Approval card: proposal (batch of native tasks) or status change (task, target tracker, old -> new, Approve/Reject); backed by `ActionApprovalRule` for "always allow".
- Column WIP limit: Praci-side only.

## Integrations

- GitHub: issues, sub-issues, milestones, Project fields, dependencies; repo or Project picker; "Status from" Project field or open/closed + labels; first external tracker in the plan; PAT vs OAuth app is an open question.
- Linear: official MCP (`mcp.linear.app/mcp`, read-only variant); team picker; due dates on issues; owner has no confirmed issue field.
- Notion: official MCP; database + property mapping (status, assignee, start, end, optional blocked-by and estimate); dependencies only if relation properties exist; "Add relation" is a write needing approval.
- Native: Praci Postgres, shared in the space, no sync, no account needed.
- All three trackers are written only by (a) the user's own drag/edit (immediate, via adapter, with source version check) and (b) the bot's status-change tool behind an approval card. The bot never writes other tracker fields.

## States

- Empty / connect: "Connect source" toggle shows Projects empty state, connect forms, Notion mapping.
- Sync error: banner "GitHub sync failed" + "Retry" and red dot on the Sources button. Only GitHub is named.
- Conflict: modal "Update conflict" with Yours vs GitHub values, "Keep mine" / "Use GitHub".
- Read-only: "Read-only" badge; non-native cards not draggable; bars not draggable; cursor becomes pointer; no tooltip explanation.
- Notion no-relation: no arrows or Blocked markers or conflicts for any pair involving a Notion task; note row "Notion has no dependency relation" + "Add relation"; drawer "No relation property".
- WIP over limit: "In progress" 3 / 2 tinted with warning icon.
- Unscheduled: "Unscheduled" lane in timeline; "No date" on cards; "Unscheduled" and "None" estimate in drawer.
- Schedule conflict: warning marker on "Security review"; red dashed arrow.
- Bot working: "<bot> · working on it" assignee row; bot avatar on card/row/bar end.
- Sources hidden: unchecking a source hides its tasks everywhere (all unchecked gives a blank board, not the empty state).
- Not shown in mockup: loading/first sync, stale indicator, failed drag with revert, failed write on timeline, empty column text, empty project, bot errors, approval pending/approved state (only toasts).

## Recommended Story Topics

1. `connect-sources-first-run` - First run: empty state, "New project", connect GitHub / Linear / Notion with access mode and Notion property mapping, mixed-source header and Sources filter, sync error with Retry, disconnect gap.
2. `board-work` - Board: reading cards, source ids, Blocked marker, drag to change status (native vs tracker writes), group by assignee with bot lanes, person/bot filter, WIP over limit, read-only drag lock, task drawer (source row, Owner/Assignee, comments).
3. `timeline-planning` - Timeline: phases, arrows, critical path, milestones, conflict marker, drag-reschedule with dependents preview, Unscheduled lane, Notion no-relation and "Add relation", stale-write "Update conflict" (Keep mine / Use GitHub).
4. `bot-conversation-approvals` - Project bot panel: "Ask bot", blocked-work answer with citation chips, "Create 4 tasks in Product launch" proposal (Accept all / selected), status-change approval (Approve / Reject), tracker suggestion with "Open in <source>", weekly report and "Save to thread", drawer suggestion Accept/Dismiss.
5. `delegate-to-bots-ownership` - Delegating and ownership: "Send to bot" (Project bot, Research, Writer), "working on it" assignee row, "Open thread", bot lane and avatar on board/timeline, Owner vs Assignee, people-and-bots filter, bot assignment stays Praci-side, read-only effects on delegation.

## Plan vs mockup mismatches noticed

Missing from the mockup (README promises):
1. S7 Disconnect: no disconnect or "delete synced data" control anywhere; the Sources dropdown only filters. Same for connecting a second source from a populated page (S6 "combine"): the only connect UI is the empty state, reachable by the "Connect source" mock toggle.
2. S1/S27: no way to create a native task, edit any field, or post a comment; drawer fields are static text. "New project" (empty state and Project menu) just reveals the pre-filled board; no project name or empty-board state. "Docs refresh" shows the same tasks.
3. S2: no OAuth step, no first-sync count/progress, no multi-team selection ("Team" is one select). S3: board never states which status rule is in use (only the "Status from" field at connect).
4. S9: no failed-write path (card returning plus inline error); the sync-error toggle is independent of drags. Timeline drag likewise has no failure revert.
5. S10/S29: no Label filter and no project filter; "Filter by person or bot" mixes owner and assignee, so there is no real owner filter; cards show assignee only, Owner appears only in the drawer.
6. S12: no zoom (week/month/quarter); only phases, not "project or phase" grouping. S13: no edge-resize; the "dependents that move" preview is a transient tooltip during drag, not a list with a save step, and on release dependents do not move while the toast says it was written to the source.
7. S14: critical path is a hardcoded flag (`c:1`) rather than computed; only one conflict (Security review) exists.
8. S15 is correctly absent, but the conflict marker is a non-clickable icon, so there is no path toward "Shift dependents" even as a disabled hint.
9. S18: no triage list in the bot panel and no duplicate/label suggestions; only a per-task "Suggestion" card in the drawer. S16/S17: composer is static, so no free-text asking; answers are canned and the proposal's "Edit" button does nothing.
10. S23: the approval cards lack the "Always allow this kind" option. Drawer "Accept" on a native suggestion only toasts "Sent for approval" with no approval card; "Add relation" in the Notion note also only toasts "Sent for approval" (S4 says it needs approval).
11. S24: read-only disables drag but shows no tooltip explanation; the bot's "Change status" approval card (for GitHub #142) still appears in read-only mode, contradicting "a read-only connection also removes the bot's status change". "Open in Linear" and similar remain fine.
12. S26: no "last synced only when stale" behavior; the drawer always shows "Synced N min ago". The conflict modal appears only from the Mockup states toggle and shows values (Nov 13 vs Nov 6) that do not match the seed due date of #145 (Nov 10).
13. S28: Notion tasks have no source id (card shows only the icon; timeline bar label is blank; drawer chips show "Page" or empty), where the plan says a Notion page icon; native ids "PL-n" match "Praci id". Sources button counts are for all tasks across projects, ignoring the filter state beyond dimming.
14. S30: "Open thread" for a task sent to Project bot opens the generic canned Project bot conversation, not a task thread. Nothing shows that the tracker's own assignee is unchanged (e.g. ENG-31 is assigned to Research, with the Linear-side assignee Cy Novak hidden). A bot-assigned task can be re-sent but there is no way to unassign or see it finish.
15. S25: no representation of shared native vs per-user tracker scope, or of any role difference between members.
16. Left nav Project bot / Research / Writer rows and Integrations are inert; the README says the bot opens via "Ask bot" (Decision 7) so this is consistent, but bot rows in the nav look clickable.

Mockup contradicts or goes beyond README:
17. WIP limit (S11) is "later" in the README, yet the mockup shows it (README's Mockup section does ask for it as a "later state"; there is no UI to set a limit).
18. S19 (re-plan, later): the mockup includes a message "Onboarding emails will slip a week" answered with a tracker suggestion; this fits S23 but there is no timeline preview of the effect.
19. Notion no-relation mode hides Blocked markers on the board and arrows on the timeline, but the bot's canned answer and report still say "Security review waits on Docs site" (a Notion task), so mock states disagree with each other.
20. S20: weekly report is a canned message with a hard-coded "Oct 12 to 16"; there is no on-demand "generate report" control (only typing, which is inert).
21. Unchecking every source in "Connected" yields a blank board instead of the empty/connect state.
