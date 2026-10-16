# Project management bot plan

## Goal

A Projects page with a Kanban board and a Waterfall (timeline with dependencies)
view of projects and tasks, plus a Project bot in a side panel that can create,
update, triage, plan and report on work. The task source is pluggable: Linear,
Notion, GitHub (Issues and Projects), another tracker, or nothing at all, in which
case tasks live natively in Rakazo's Postgres. A mockup will be built from the user
stories below at [mockup.html](mockup.html).

Web and desktop (Electron hosts the web UI) ship first. Mobile is a follow-up; until
then mobile shows nothing new, which is safe because no existing workflow changes.

Everything in this document is a proposal until the maintainer answers the open
questions at the end. Names and numbers in stories are invented.

## What exists in Rakazo today

The plan reuses these instead of adding new primitives:

- Remote MCP over OAuth: models `McpServer`, `McpOAuthSession`, `BotMcpServer`
  (`allowAllTools`, `allowedTools`) in `packages/db/prisma/schema.prisma`; client in
  `packages/adapters/src/remote-mcp.ts` (`listRemoteMcpTools`, `callRemoteMcpTool`,
  SSRF-safe fetch). Finance already connects Mercury and Brex this way
  (`docs/finance/README.md`).
- Approvals for writes: `packages/core/src/action-approval.ts`
  (`connectorToolRequiresApproval`: a connector tool whose declared effect is not
  read-only needs approval), `ActionApprovalRule` and `ActionAutoReviewPreference`
  in the schema.
- A bot per feature in a side panel: the Inbox agent (`docs/inbox/06-agent-panel.md`,
  `ShellPage` mode with a resizable panel) and the Finance agent (`spawnKey =
  "finance-agent:<userId>"`, created idempotently, read-only tool list, built-in
  tools that show preview cards). The Project bot copies this.
- Sync state with a claim token: `MailSyncState` (schema line ~1745), copied by the
  Finance sync.
- Catalog entries: `packages/core/src/app-directory.ts` already lists `linear`
  ("Search, create and update issues"), `github` ("Read repos, issues and pull
  requests, and comment") and `notion`; `packages/core/src/featured-connectors.ts`
  features Notion. These are Composio/Pipedream-style app entries, so all three are
  already connectable as managed apps; no code treats them as a project source yet.
- Bot identity colors and avatar helpers: `packages/core/src/bot-avatar-colors.ts`.
- UI rules: shadcn on Base UI in `packages/ui-web`, Storybook stories for every
  component, `apps/web/src/components/ai/` for AI moments (AGENTS.md).

## Backend research

### Official remote MCP servers

| Backend | Endpoint | Auth | Read / write | Source |
| --- | --- | --- | --- | --- |
| Linear | `https://mcp.linear.app/mcp` (read-only: `https://mcp.linear.app/mcp/readonly`) | OAuth 2.1 with dynamic client registration, or bearer API key/token | Find, create and update issues, projects and comments. The page does not list tool names, so cycles and relations tools are TBD. | https://linear.app/docs/mcp |
| Notion | `https://mcp.notion.com/mcp` | OAuth with dynamic client registration; access limited to what the signed-in user shares | Search, fetch, query data sources, create and update pages (database rows are pages), update data-source properties, create and update views, comments. Workspace admins can restrict clients (Enterprise). | https://developers.notion.com/guides/mcp/mcp-supported-tools , https://developers.notion.com/docs/mcp , endpoint and OAuth: https://developers.notion.com/guides/mcp/get-started-with-mcp (via search result) |
| GitHub | `https://api.githubcopilot.com/mcp/` | OAuth (needs a registered GitHub App or OAuth App per host) or personal access token | `issues` toolset is on by default; `projects` toolset must be enabled explicitly. Sub-issues: `issue_read` and `sub_issue_write`. Dependencies: `issue_dependency_read` and `issue_dependency_write`. Read-only flag documented for the local server; remote support TBD. | https://github.com/github/github-mcp-server |

Not verified: Notion MCP rate limits, Linear MCP tool names, how GitHub's remote
server enables the dependency tools, and whether Projects v2 field edits (status,
dates, iterations) are covered by the `projects` toolset. TBD before the adapter PRs.

### What each backend can and cannot model

- **Linear.** Issue relations: blocked by, blocking, related, duplicate
  (https://Linear.app/docs/issue-relations). The Timeline view shows projects, their
  dates, milestones and project dependencies, but not issues
  (https://linear.app/docs/timeline). So issue-level Waterfall needs dates the issue
  may not have; Linear issues carry a due date, and cycles give a sprint window
  (cycle fields: TBD, not confirmed in the pages read). Agents are delegated work by
  setting a "delegate" while the human stays assignee
  (https://linear.app/developers/agents).
- **Notion.** Timeline view supports dependencies between database items, stored as
  two relation properties (for example "Blocked by" and "Blocking"), and warns when a
  dependent item is dated earlier; sources are third-party tutorials, so check the
  help center before relying on details
  (https://www.landmarklabs.co/notion-tutorials/notion-timeline-dependencies ,
  https://ones.com/blog/?p=9944). A Notion database has no fixed schema, so status,
  assignee and dates are whichever properties the user named. The adapter must ask the
  user to map properties once.
- **GitHub.** Issues have assignees, labels, milestones, sub-issues and dependencies
  ("blocked by" / "blocking"); availability by plan is not stated on the page
  (https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies).
  Projects have custom date fields and a roadmap layout built on date and iteration
  fields (https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-date-fields ,
  https://github.blog/changelog/2023-03-23-roadmaps-in-projects-are-now-generally-available).
  Status is a Project field, not an issue field. Estimates are a custom Project field
  if the user has one. Date fields have no default values, so many issues will be
  undated.

### Capability matrix

"Native" is Rakazo's own Postgres store. "Map" means the user maps an existing
property once; "Fallback" says what Rakazo does when the backend lacks the field.

| Field | Native | Linear | Notion | GitHub |
| --- | --- | --- | --- | --- |
| Status (Kanban column) | Yes, configurable columns | Yes, workflow states | Map a status/select property | Project single-select field (issue open/closed only if no Project) |
| Owner (accountable person) | Yes | Project lead only (issue owner: no field confirmed, TBD); fall back to Rakazo-side | Map an optional person property | No owner field on issues (TBD for Project fields); fall back to Rakazo-side |
| Assignee | Yes | Yes (plus agent delegate) | Map a person property | Yes (issue assignees) |
| Start / due dates | Yes | Due date on issues; start and target dates on projects (issue start date: TBD) | Map a date or date-range property | Project date fields, optional |
| Dependencies | Yes (blocked by) | Yes (blocks / blocked by) | Only if relation properties exist; Rakazo can create them | Yes (blocked by / blocking), plan availability TBD |
| Milestones | Yes | Project milestones | Fallback: items flagged as milestone via a checkbox or zero-length date | Issue milestones (have a due date) |
| Estimates | Yes (points or days) | Yes (estimate field) | Map a number property | Map a Project number field |
| Comments | Yes | Yes | Yes | Yes |
| Write support through MCP (used for the user's own drags and edits; the bot uses it only for status changes, with approval) | n/a | Yes (read-only endpoint exists) | Yes | Yes (PAT or OAuth scopes) |
| Fallback when a date is missing | Required for Waterfall bars | Use cycle or project dates, else unscheduled | Unscheduled | Use milestone due date, else unscheduled |

Items without dates appear in an "Unscheduled" lane on the Waterfall instead of being
dropped or given invented dates.

### What AI project managers do today

Competitors show which jobs users hand to a bot:

- **Triage:** Linear Triage Intelligence suggests duplicates, related issues, labels
  and assignees with a short reason, and takes natural-language guidance per team
  (https://linear.app/docs/triage-intelligence).
- **Break an epic into tasks:** Jira's "Break down with Rovo" and "Suggest child work
  items" produce suggestions that the user accepts one by one or all at once
  (https://jimiwikman.se/atlassian/atlassian-resources/atlassian-app-updates/break-down-work-items-with-rovo-in-list-view-r1265/).
  Reported failure: required custom fields block creation
  (https://jira.atlassian.com/browse/ROVO-256 , summary from search; verify).
- **Standups and status reports:** ClickUp Brain writes a StandUp from recent
  activity and can run it on a schedule
  (https://help.clickup.com/hc/en-us/articles/20011540694551). Asana advises starting
  AI automations with low-risk summaries and status updates
  (https://www.gend.co/en-ca/blog/asana-latest-features-2026).
- **Do the work:** GitHub Copilot coding agent takes an assigned issue and opens a
  draft pull request (https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/).
  Out of scope here.
- Estimating, rescheduling slips and stale-task nudges: no source read for these;
  treat as our own proposals, TBD against competitor docs.

### What users expect from the views

General guidance (vendor blogs, not authoritative):
https://creately.com/guides/gantt-chart-vs-kanban/ ,
https://www.launchnotes.com/blog/gantt-chart-vs-kanban-a-comparative-analysis .

- Kanban: columns by status, drag a card to change status, optional WIP limit per
  column, optional swimlanes (by assignee, priority or project).
- Waterfall: bars on a timeline, dependency arrows, milestones, the critical path
  (the chain of tasks that sets the end date), drag to reschedule, and dependents
  that move when a predecessor slips. Gantt charts can give false confidence when
  estimates slip, so the bot's "at risk" flags matter.

V1 keeps: columns, drag to change status, assignee swimlanes; bars, arrows, milestones, drag to move, cascade preview, critical path
highlight. V1 leaves out: WIP limits (S11, later), resource leveling, baselines, custom
calendars.

## User stories

Each story ends with v1 or later. "Source" means the task tracker behind the page.

### Connecting a source

**S1. Start with no tracker.** As a founder with no tracker, I want to open Projects
and create my first project and tasks inside Rakazo, so that I get a working board
without signing up for anything.
- The empty state offers "New project" and the three connectors; no account is needed
  for the first. "New project" asks for a name and opens an empty board with "Add task".
- Native tasks have title, status, assignee, dates, estimate, blocked-by and comments, and
  every field is editable in the task detail.
- Data is stored in Postgres, scoped to my space; everyone in the space can see it.
- v1.

**S2. Connect Linear.** As a team lead who uses Linear, I want to connect it with
OAuth, so that my teams, projects and issues appear without re-entering them.
- "Connect Linear" creates an `McpServer` and starts OAuth; I see my teams and pick
  which to show.
- First sync shows a count and a progress state; failures show a retry action.
- I can choose read-only (the read-only endpoint) or read and write.
- v1.

**S3. Connect GitHub.** As a developer, I want to connect a GitHub repo or Project,
so that issues, sub-issues, milestones and Project fields appear on the board.
- I pick a repo or Project after OAuth or token entry.
- If a repo has no Project, status is derived from open/closed and labels, and the
  board says which rule it uses.
- v1.

**S4. Connect Notion.** As someone who plans in a Notion database, I want to point to
the database and map its properties, so that the board and timeline use my columns.
- After OAuth I pick a database, then map status, assignee, start, end and optional
  owner, blocked-by and estimate (Assignee never defaults to the Owner property). Unmapped fields are hidden, not guessed. Pages have no id, so
  chips and bars show the page title.
- If no dependency relation exists, Waterfall shows no arrows and offers to add the
  relation property (a write, needs approval).
- v1.

**S5. Another tracker.** As a user of Jira, Asana or similar, I want to add its MCP
server, so that I can use the board even though Rakazo has no built-in adapter.
- Not in v1; the adapter interface (Decisions) is what makes this possible.
- later.

**S6. Switch or combine sources.** As a user who starts native and later adopts
Linear, I want to move my native tasks to the tracker, so that I do not retype them.
- "Move to Linear" shows a preview of what will be created; nothing is written until
  I approve.
- Native tasks keep a link to the created issue; the native copy becomes read-only.
- One project can combine tasks from several sources (for example GitHub issues, Linear
  issues, Notion pages and native tasks); each task keeps its own source. v1.
- Moving native tasks to a tracker is later.

**S7. Disconnect.** As a user, I want to disconnect a source and choose to delete its
synced data, so that I stay in control of what Rakazo stores.
- Removing the `McpServer` deletes the synced tasks of that source in my space.
- Native tasks are not touched.
- Disconnect asks whether to keep or delete the synced tasks; kept tasks stay visible and
  read-only.
- "Add source" in the Sources menu opens the same connect form on a populated page.
- v1.

### Kanban

**S8. See the board.** As a team lead, I want a board with columns by status and
cards showing title, assignee, due date and a blocked marker, so that I see the state
of work at a glance.
- Columns come from the source's statuses (or native columns).
- A card blocked by an open task shows a blocked marker with the blocker's name on
  hover.
- Empty board and sync-error states exist.
- v1.

**S9. Move a card.** As a team member, I want to drag a card to another column, so
that status stays current.
- Dropping updates Rakazo's copy immediately and writes to the source; if the write
  fails, the card returns and an inline error appears. The confirmation has Undo.
- Status can also be changed without dragging: a Status select in the task detail and a
  "Move to" menu on the card, using the same write.
- Moving a blocked task to In progress or Done is allowed and shows "still blocked by
  <task>".
- Dropping a card on another assignee lane reassigns it (a bot lane stores the bot on
  Rakazo's row only).
- For external sources, the write goes through the source adapter. This is the user's
  own action; the bot never makes it.
- v1.

**S10. Filter and group.** As a lead, I want to filter by owner, assignee, label and
project and group rows by assignee, so that I can review one person's load.
- Swimlanes by assignee are v1; other groupings are later.
- Bots get their own lanes after people, headed by the bot's avatar, name and task count.
- Owner and Assignee are separate filters; the assignee list includes bots. A task held by
  a bot still shows under its tracker assignee, marked "with <bot>".
- A filter with no matches shows "No tasks" and a way to clear it. Column counts always
  cover the whole column, not the filter.
- At 600px or narrower the board shows one column at a time with a status picker; column
  headers stay visible while scrolling swimlanes.
- v1.

**S11. WIP limit.** As a lead, I want a limit per column, so that I notice overload.
- Exceeding the limit tints the column header and shows the count; it never blocks a
  drop.
- Limits are stored in Rakazo, not written to the source.
- The mockup shows the limit only behind a "Later: WIP limit" state; a fresh project has none.
- later.

### Waterfall

**S12. See the timeline.** As a project manager, I want tasks as bars on a timeline
grouped by project or phase, with dependency arrows and milestones, so that I see
sequence and dates.
- Bars come from start and end dates; undated tasks sit in an Unscheduled lane. Dragging a
  chip onto the grid, or setting Dates in the task detail, schedules it.
- Filters never hide milestones; a bar whose blocker is filtered out shows "1 hidden
  blocker".
- Arrows run from blocker to dependent; milestones show as diamonds.
- Zoom: week, month, quarter.
- v1.

**S13. Reschedule by dragging.** As a project manager, I want to drag a bar or its
edge, so that I can change dates without opening the task.
- While dragging, a preview lists the tasks that would start before the new end (conflicts).
  Dependents do not move; cascading is S15 (later).
- Releasing writes through the adapter, with Undo; failures revert the bar.
- Bars are keyboard-operable (Enter opens, arrow keys move one day). At 600px or narrower
  the timeline is view-only.
- v1.

**S14. Critical path and slips.** As a project manager, I want the critical path
highlighted and a flag on tasks that now finish after their dependents start, so that
I know what threatens the end date.
- Critical path is computed in `packages/core` from dependencies and durations.
- A dependent starting before its blocker ends shows a conflict marker (Notion shows
  a similar warning in its timeline).
- v1.

**S15. Cascade a slip.** As a project manager, I want to shift all downstream tasks
when one slips, so that I do not edit each one.
- "Shift dependents" appears on the conflict marker and opens the preview; the shift
  is one approval.
- later (v1 shows the conflict and preview only).

### The bot

**S16. Ask about the project.** As a user, I want to ask the bot "what is blocked
this week?" in the side panel, so that I get an answer without hunting.
- Every claim in an answer cites its source item as a chip (source icon and source id)
  that opens the task detail.
- The bot reads synced rows only; read tools need no approval.
- v1.

**S17. Create tasks from a description.** As a user, I want to paste an epic or a
meeting note and get proposed tasks, so that planning is faster.
- The bot shows a proposal card with titles, estimates and blocked-by links; I accept
  all, accept some, or edit. The card title says where the tasks are created, for
  example "Create 4 tasks in Product launch".
- The bot creates native tasks only, after one approval for the batch. For a tracker
  project it shows the list as a suggestion with "Open in <source>" so I create the
  issues there.
- v1.

**S18. Triage.** As a lead, I want the bot to review new or unassigned tasks and
suggest assignee, status, labels and duplicates with a one-line reason, so that
intake is quick.
- Suggestions are a list; each can be accepted or dismissed. For a tracker task, accepting
  opens the task in the source; Rakazo picks up the change on the next sync.
- Reason text is shown on the suggestion, as Linear does, and uses the real state (for
  example the blocker's actual status). One suggestion is one record: dismissing it in the
  task detail or in the panel dismisses both. No assignee suggestion for a bot-held task.
- On a native task, Accept is the approval and applies the change, naming it; approval
  cards are for writes the bot starts in the thread.
- Every bot card shows a one-line result once acted on, so it cannot be repeated.
- v1.

**S19. Reschedule and re-plan.** As a project manager, I want to say "the API work
slips two weeks" and see the effect on the timeline, so that I can decide.
- The bot applies the change as a preview on the Waterfall, showing the new end date
  and the milestones that move.
- Native tasks: writing it requires approval. Tracker tasks: the bot links to the source
  items to change; it never writes them. (Status is the one tracker field the bot can
  change, with approval; see S23.)
- later.

**S20. Status report and standup.** As a founder, I want a weekly summary of done,
in progress, blocked and at risk, so that I can send updates without writing them.
- The report is generated from synced rows; every line cites its source item.
- It can be saved as a message in the thread; sending it elsewhere is later.
- v1 for on-demand; scheduled is later.

**S21. Stale-task nudge.** As a lead, I want the bot to flag tasks with no update for
a set time, so that nothing rots.
- A routine posts one digest to the panel, not one message per task.
- Reuses Rakazo routines; the time threshold is one setting.
- later.

**S22. Estimate.** As a lead, I want the bot to suggest estimates for unestimated
tasks based on similar finished tasks, so that the timeline has durations.
- Shown as a suggestion with the similar tasks listed.
- later.

### Cross-cutting

**S23. The bot is read-only for trackers, except status.** As a user, I want trackers to
stay the source of truth, so that the bot cannot change my data in GitHub, Linear or
Notion unseen.
- The bot reads synced rows. For any field except status (dates, assignee, title, labels,
  estimate) it shows a suggestion with an "Open in <source>" link; I make the change in the
  source and Rakazo picks it up on the next sync.
- The bot may change a tracker task's status (for example close GitHub #142, or move
  Linear ENG-42 to In review) only through an approval card: the task with its source
  icon and id, the target tracker, old status and new status, Approve or Reject.
- The bot may write native tasks (any field), through an approval card that names the
  project and what is created or changed.
- "Always allow this kind" is an `ActionApprovalRule`.
- Drag-and-drop and edits by me are my own actions and write to the source without asking.
- v1.

**S24. Read-only mode.** As a cautious user, I want to connect a tracker read-only,
so that Rakazo can never change it.
- Linear offers a read-only endpoint; for others the bot's `allowedTools` lists only
  read tools. A read-only connection also removes the bot's status change.
- Access is per source: a read-only Linear connection locks only Linear tasks (lock icon
  on the card and on its Sources row). The access choice resets for each connect form.
- Dragging or changing a locked task shows why in a visible message, not only a tooltip.
- The bot makes no status change for a read-only or disconnected source; it suggests with
  "Open in <source>".
- v1.

**S25. Space and user scoping.** As a member of a shared space, I want my connected
tracker and its tasks visible only to me and my bots, so that another member's
connection never exposes data to me.
- Every row has `spaceId` and `userId`; every query uses one actor-based helper.
- Native projects are the exception: every member of the space can see and edit
  them, and a member who leaves the space loses access.
- v1.

**S26. Sync and conflicts.** As a user, I want the page to refresh when I open it
and to tell me when someone else changed a task I was editing, so that I do not
overwrite their change.
- Sync is on demand with a throttle; the last sync time is visible only when stale.
- A failed sync names the reason and the last successful sync, with Retry, or Reconnect
  when sign-in expired. The Sources menu marks the failing source.
- A write sends the version the user saw; if the source changed, the user sees both
  values and chooses.
- v1 for refresh and stale-write detection; webhooks are later.

**S27. Task detail.** As a user, I want to open a task and see its fields,
dependencies, comments and the bot's suggestions, so that I do not leave Rakazo.
- Edits go through the same write path as drag-and-drop.
- A link opens the task in the source tracker.
- Status is a select; dates are date fields; native tasks also edit title and assignee.
  Comments can be added.
- Closing the detail returns focus to the card or bar that opened it.
- v1.

**S29. Owner.** As a lead, I want each task to have an owner, the person accountable,
separate from the assignee who does the work, so that someone answers for it.
- Task detail shows Owner above Assignee, both with avatars; the board can filter by owner.
- Owner comes from the tracker where it has one (Notion: a mapped person property); where it
  has none (GitHub issues, Linear issues, TBD), it is a Rakazo-side field on our row and is
  never written to the tracker.
- v1.

**S30. Send a task to a bot.** As a user, I want to send one task to a bot (Project bot,
Research, Writer), so that it works on the task in its own thread.
- "Send to bot" in the task detail lists the space's bots. Choosing one starts a thread with
  that bot containing the task and its source link. The bot becomes the task's assignee
  (the person who sent it stays Owner): the detail shows "<bot> · working on it" in the
  Assignee row with a link to the thread, the card and timeline row show the bot's avatar,
  and the task moves to that bot's swimlane.
- Rakazo stores the bot assignee on its own row; the tracker's assignee is unchanged and
  shown in the detail.
- "Unassign bot" in the same menu returns the task; the current bot is marked.
- The bot's thread is a task thread (task and source link, status line); when the bot
  finishes, the thread and the card show "Done". A bot switcher in the panel header and the
  bot rows in the sidebar open each bot's panel.
- Single task only; no multi-select on the board.
- Writes back to trackers follow S23: status only, with approval. The bot does not open pull
  requests in v1.
- v1.

**S28. See where each task comes from.** As a user, I want each task to show its source,
so that I know which system holds the truth.
- Cards, timeline rows and the detail show a source icon and the source's own id (GitHub
  `#142`, Linear `ENG-42`, a Notion page icon; native tasks show a Rakazo id).
- The detail starts with a source row: kind and location, last synced, and "Open in
  <source>". Its fields mirror the source.
- A Sources filter shows or hides each source on the board and timeline; the menu doubles
  as the legend for the icons.
- v1.

## Decisions (proposals)

1. **Name.** "Projects" in the UI and `projects` in code. "Project bot" for the
   agent.
2. **One normalized model in `packages/core`.** `Project`, `Task` (title, status,
   statusCategory, `ownerId`, assignee (a person, or a bot: `assigneeKind: user|bot`, `assigneeBotId`; when the tracker cannot represent a bot assignee, Rakazo keeps the bot assignment on its own row, leaves the tracker assignee unchanged and does not write it back), startDate, dueDate, estimate, labels, parentId,
   isMilestone, url, `sourceVersion`), `TaskDependency` (blockerId, dependentId).
   `statusCategory` (`todo`, `doing`, `done`) lets reports work across backends whose
   status names differ. Contracts in `packages/contracts`.
3. **One adapter interface per backend**, `ProjectSource`: `listProjects`,
   `listTasks(since)`, `createTask`, `updateTask`, `setDependency`, `addComment`,
   `capabilities()` (which of the matrix rows it supports). Adapters in
   `packages/adapters`: `native` (Postgres), `linear`, `github`, `notion`. Linear,
   GitHub and Notion adapters call the vendors' official MCP servers through
   `callRemoteMcpTool`, with a zod-validated mapper per tool response (the Finance
   approach, since all three servers can change). Vendor names and tool names stay in
   the adapters. A generic "MCP tracker" adapter is later (S5).
4. **Rakazo reads from Postgres, not the vendor.** Sync stores normalized rows keyed
   by `mcpServerId` and the vendor's id, scoped to space and user, using the
   `MailSyncState` claim-token pattern and a throttle. Removing the server deletes
   its rows. The native source is the same tables with no sync.
5. **One write path.** Drag and task detail call `updateTask` in the API,
   which checks authorization, sends `sourceVersion`, writes to the adapter, then
   updates the row. Frontends express intent; the backend owns retries and recovery
   (AGENTS.md). A user's own drag or edit writes immediately, with no approval step.
6. **The bot is read-only for external trackers, except status.** The Project bot's
   `BotMcpServer` rows list read tools plus one status-update tool per backend
   (classified non-read-only so `connectorToolRequiresApproval` asks); no other vendor
   write tool is allowed for the bot. Trackers stay the source of truth. The user's own drags and
   edits use the adapter's write path (decision 5). Bot writes to the native store go
   through built-in tools behind the approval gate that render an approval card.
7. **Project bot** follows the Finance pattern: `spawnKey = "projects-agent:<userId>"`,
   panel closed by default, opened with "Ask bot" in the page header. Built-in
   read-only tools: `projects_overview`, `projects_tasks`, `projects_timeline`
   (reusing core calculations), plus native-only write tools `projects_create_tasks` and
   `projects_update_tasks`, and `projects_set_status` for tracker tasks; all produce an
   approval card, and the update tool refuses tracker tasks. Answers cite the source item for each fact. Skills in
   `packages/adapters/src/builtin-skills.ts`: `projects-triage`, `projects-breakdown`,
   `projects-weekly-report`.
8. **Pure scheduling code in `packages/core`.** Critical path, conflict detection,
   cascade preview and blocked state, with unit tests on synthetic data. No chart or
   Gantt dependency; board and timeline are built from shadcn components and inline
   SVG, with Storybook stories (AGENTS.md).
9. **Native projects are shared within the space.** This is a maintainer decision.
   Every native project and task row stores `spaceId` and `createdByUserId`, and every
   read and write is authorized by the actor's membership in that space through one
   actor-scoped helper (AGENTS.md). Tracker-synced rows additionally stay scoped to the
   user who connected the tracker (S25).
10. **Routes** `/app/projects` (board/timeline toggle as a segmented control),
   `/app/projects/:projectId`, `/app/projects/tasks/:taskId`.
11. **Not in v1.** Webhooks, a generic MCP tracker, scheduled reports, nudges,
    estimates, cascade shift, WIP limits, moving native tasks to a tracker,
    mobile screens.

## Phases

1. **Contracts and scheduling core.** Normalized types, critical path, conflict
   detection, blocked state, tests. No UI.
2. **Native store and API.** Tables, actor-scoped query helper, create/update/list
   routes, authorization tests across spaces and users.
3. **Projects page: Kanban + task detail** on native data, with Storybook stories and
   a CI E2E screenshot.
4. **Waterfall view** on native data: bars, arrows, milestones, drag, preview of
   dependents.
5. **Project bot and panel**, native tools, approval cards, triage, breakdown and
   report skills.
6. **GitHub adapter and connect flow** (Issues, sub-issues, dependencies, one
   Project), sync, write path, read-only mode. GitHub is first because most users
   are likely to have it.
7. **Linear adapter.**
8. **Notion adapter** with property mapping.
9. **Later:** cascade shift, WIP limits, nudges, estimates, scheduled reports,
   webhooks, mobile.

Each phase is PR-sized except phases 6 to 8, which may each split into connect/sync
and write PRs.

## Decided

- Native projects ship first (phases 1 to 5); trackers come after.
- GitHub is the first external tracker, then Linear, then Notion.
- Native projects are shared within the space.
- Only bot writes need approval (native tasks, and status changes on tracker tasks); the user's own drags and edits write immediately.
- The bot is read-only for external trackers except status, which it can change with approval; trackers stay the source of truth.
- One project can combine several sources; each task shows its source.

## Open questions

0. Not in the mockup, still planned: zoom and bar edge-resize (S12, S13), multi-team select
   (S2), a triage list (S18), a second-member view (S25), "Always allow" (S23), and real
   input in the bot composer.

1. GitHub auth: OAuth needs a registered GitHub App for Rakazo; is a personal access
   token acceptable for the first release?
2. Notion: is a required one-time property mapping acceptable, or should Rakazo create
   its own database template?
3. Should the Project bot be allowed to post to other tools (Slack, email) in the
   weekly report, or stay inside the thread?
4. TBD facts to confirm before building: Linear MCP tool list (relations, cycles,
   milestones), GitHub remote server Projects field coverage and read-only support,
   Notion MCP rate limits, GitHub dependency plan availability.

## Mockup

`docs/project-management/mockup.html` must show, with invented data, in light and
dark:

1. **Kanban board:** columns, cards with source icon and source id, assignee, due date,
   blocked marker, an assignee swimlane toggle, a column over its WIP limit (later state).
2. **Waterfall timeline:** grouped bars, dependency arrows, milestones, critical path
   highlight, a conflict marker with the "dependents that move" preview, and an
   Unscheduled lane.
3. **Mixed sources:** one project combining GitHub, Linear, Notion and native tasks; a
   header source list with counts and a Sources filter.
4. **Task detail:** source row (kind, location, last synced, "Open in <source>"), Owner and
   Assignee, a "Send to bot" menu (Project bot, Research, Writer) and the resulting "working on
   it" row, fields,
   blocked-by list, comments, a bot suggestion.
5. **Connect-source empty state:** "New project" plus GitHub, Linear, Notion; the Notion
   property-mapping step; a read-only choice.
6. **Bot side panel:** closed by default, "Ask bot" in the header; answers and a weekly
   report whose every claim cites a source item; a suggestion for a tracker task with
   "Open in <source>"; a proposal card "Create 4 tasks in <project>" with approval for
   native tasks and one status-change approval card for a tracker task (old and new status,
   target tracker). Any other change to a tracker task is a suggestion with "Open in <source>".
7. **States:** sync error with retry, stale-write conflict showing both values,
   read-only drag disabled.

Keep copy minimal: headings and control names only, no explainer text.
