# Team health plan

## Goal

An optional Team health page that a space owner adds to the sidebar from a list of
page templates. It reads metadata from whatever tools are connected (Slack, Gmail,
Google Calendar, GitHub, Linear) and answers two questions: who may be overloaded,
and who sits on the direct line to revenue. The most important answer is the
overlap: revenue-critical people with sustained workload signals, so the owner knows
whom to take care of first. Approved design: [mockup.html](mockup.html). Evidence
behind the signal and privacy choices: [research.md](research.md). User journeys
and the findings that shaped this plan: [ux-paths/catalog.md](ux-paths/catalog.md).

Web and desktop (Electron hosts the web UI) ship first. Mobile is a follow-up
(phase 6). Until then mobile does not show the page or its row; a page added on web
never shows a mobile link to a screen that does not exist. The Team health agent
declines Team health questions outside web and desktop with one line: "Team health
is on web and desktop."

## Decisions

1. **Added pages live in Postgres, per user and space.** A `SidebarPage` table
   (`id`, `spaceId`, `userId`, `templateKey`, `position`, `createdAt`, unique on
   space + user + template). RPC `sidebarPages.list`, `add`, `remove`; each returns
   `{ pages, addable }`. The template list is one constant in `packages/contracts`
   (`SIDEBAR_PAGE_TEMPLATES`: key, route, `platforms`, `available`, `ownerOnly`);
   labels and descriptions are translated in the web app. `team-health` is
   owner-only, on web and desktop. The list drops owner-only pages for a caller who
   is no longer the owner. Adding a page opens it. "Remove from sidebar" only hides
   the page: synced data, roster, links and feedback are kept, and re-adding shows
   them again. Inbox and Finance (and Data room once it lands) stay hard-coded.
   `/app/team-health` gets its own route, registered in the same change that makes
   the template available, because `/app/:botId` would otherwise catch it. A space
   switch from a sidebar-page route, or a refused visit, goes to `/app` without
   confirming the page exists.
2. **Metadata only, never content.** Sync stores timestamps, counts, participant
   email domains, PR authors and reviewers, ticket assignees and states. It never
   stores message bodies, subjects, or file text. The "What this reads" popover
   states this.
3. **The page reads Postgres, not the tools** (the Finance pattern).
   - A sync writes one `TeamActivityDay` row per person, day and source with a small
     typed metrics JSON (after-hours events, weekend active, meeting minutes, reviews
     given, commits, open tickets, external threads by domain).
   - Sync runs on demand from the page with a 15-minute throttle and a claim token on
     a `TeamHealthSyncState` row, backfills 26 weeks, and re-reads the last 3 days
     each run. Connecting a new source runs one sync regardless of the throttle. A
     failed sync does not start the throttle.
   - States: while the first sync runs the page shows "Reading your tools…" with a
     progress bar; a throttled Refresh is disabled with "Next refresh at HH:MM"; a
     source whose connection is not connected shows a "Reconnect" chip that opens
     Integrations, and "Sync failed" appears next to "Updated" until a sync succeeds.
     "Connect tools" opens Integrations filtered to the five sources and returns to
     the page.
   - Every row carries `spaceId` and `ownerUserId`: the owner who added the page and
     whose connections were read. The server resolves the owner; clients never pass
     it. Disconnecting a source deletes its activity rows; roster and feedback are
     kept. If the owner is demoted or leaves the space, that owner's Team health rows
     for the space are deleted and the row disappears.
4. **People are a roster, not inferred on every read.** `TeamMember` rows (display
   name, emails, GitHub login, Slack id, Linear id, time zone, working hours, hidden,
   excluded), keyed by space and owner, are proposed by the first sync from
   internal-domain addresses and tool member lists. Each row keeps the stable source
   ids, not only emails. Rows are merged by email only when exactly one candidate
   matches. The owner can, from the row's "…" menu:
   - **Hide** a person from the page (restorable from "Hidden (N)");
   - **Split** a wrong merge;
   - **Exclude** a person, which stops collection and deletes their rows (the
     opt-out and erasure path).
   Time zone and working hours default from Slack or Calendar profile, else 9–18 in
   the owner's zone; assumed hours are shown in that person's evidence.
5. **Signals compare each person to their own baseline.** Pure functions in
   `packages/core` with unit tests on synthetic data. A signal shows only when the
   last 3+ weeks exceed that person's prior 12-week baseline by a set margin, so a
   signal needs at least 15 weeks of history. The 26-week backfill usually provides
   it at once; otherwise the page shows the shortest history among sources that feed
   signals, out of 15 weeks, and still shows the Revenue line, which needs no
   baseline. v1 signals (best evidence, cheapest): after-hours activity, weekend
   activity, meeting hours, share of team PR reviews, open tickets owned. No
   composite score. Every signal has evidence (counts and dates only), and its
   sparkline draws the baseline as the person's usual range.
6. **Cards or table, with the same filter and sort.**
   - A Cards | Table toggle shows the same people. Filter by group (Take care of
     first, Workload, Revenue line, No change), signal type and source; a source
     matches when it supplied a shown signal or evidence line.
   - Sort by recent change (default), name, or signal count; Table also sorts by
     group and by column header. There is no score to sort by. Table groups rows
     with dividers. "Flagged" is the time since a signal first showed.
   - The range buttons (12w, 6m) change only how much history sparklines and
     evidence show; they do not change detection.
   - View, filter, sort and range are kept in the URL.
   - The summary line is generated: up to three names and the reason, for example
     "Take care of Maya and Jonah first: revenue owners with rising workload." With
     Gmail as the only source it reads "Based on your mailbox only."
7. **Revenue line is inferred and correctable.** v1 signals: sole internal owner of
   threads with an external business domain (personal domains excluded), share of
   changes to revenue services, and single contact on the customer's side. Revenue
   services are repos or paths whose names match billing, checkout, payments or
   pricing. Each revenue row and card block has "Not revenue", "Not an issue" and
   "Add note". With no CRM connected the page says "inferred from email" and never
   ranks by money.
8. **Confidence is shown, not hidden.** Each signal carries Low, Medium or High
   plus one coverage reason (for example "Slack only", "no PTO calendar"). High
   needs two or more sources for that signal and a calendar with PTO. Caveats about
   interpretation go in the signal sentence, not the tag. Table shows a person's
   lowest confidence.
9. **Visibility: the page owner sees everyone, each person sees only their own.**
   - The page owner is the user who added the page and has `SpaceMember.role ==
     "owner"` in that space (the existing check in `packages/db/src/spaces.ts`).
     They see all cards, evidence and feedback.
   - A space member who opens `/app/team-health` without a link sees one button,
     "Request my card". The owner sees the request at the top of the page (Approve /
     Decline) and in Inbox. A request needs a verified login email
     (`emailVerified`); otherwise the member sees "Verify your email to request
     access". Email matching only proposes which roster person the request links to.
   - Once approved, a "My workload" row appears in that member's sidebar. It opens a
     separate layout built on the server from that person's data only: no summary
     naming others, no counts of others, no coverage chips, no other people's
     customers, no agent. The only action is "Add a note", marked as visible to the
     owner.
   - The server checks the current owner role and a live link on every call:
     overview, evidence, feedback, and agent tools. Unlinked members get nothing.
10. **Feedback is stored, per signal.** `TeamHealthFeedback` (space, owner, person,
    signal key; `not_an_issue` with an 8-week snooze, `done`, optional note).
    "Not an issue" shows an Undo toast; snoozed signals are listed under
    "Snoozed (N)" with Restore. `done` hides a signal until it worsens; if it
    returns the card shows "Marked done <date>". "Done" is on every action card.
11. **Actions go through the agent with approval.** Card actions open the Team
    health side panel with the request drafted; the agent shows the full content
    (event, invitees, PRs, message) and acts only after per-action approval. No
    direct writes from the page in v1.
    - "Schedule 1:1" drafts a calendar invite with a neutral title that never names
      the signal.
    - "Invite Priya to a focus block" sends an invitation she can decline; it does
      not write to her calendar.
    - "Move N reviews to X" picks someone without a workload signal and shows their
      current review load, or says why there is no one else.
    - "Add backup" and "Add second owner" draft a message to the owner only; no
      repo or CRM write.
    - After approval the button is replaced by the result, for example "1:1 booked
      Thu 2 PM". Approvals also appear in the mobile approval list.

## Known limits

- **Gmail covers only the owner's mailbox.** Without Google Workspace domain-wide
  access, email signals see only threads the owner is on. "Sole owner of threads
  with X" is therefore a lower bound and is tagged Low confidence when email is the
  only source.
- **Slack sees what the connected token sees**, normally public channels plus the
  owner's DMs.
- **Named individuals is a deliberate choice.** Viva Insights hides insights for
  groups below its minimum size; this page instead names people, because the owner
  asked "whom do I take care of first". The protections are owner-only access,
  approved self-view, Exclude, metadata only, and the "What this reads" disclosure.
- **Teammates who are not Rakazo users** appear in the roster marked "Not a Rakazo
  user"; telling them is the owner's responsibility.
- **EU teams need legal review** before enabling; this plan does not cover
  works-council or national employee-monitoring rules.

## Phases

1. **Sidebar pages.** Prisma model and migration, contracts, RPC, "Add page" row and
   template menu, remove from the row menu, stories, tests (PR #108).
2. **Roster and sync.** `TeamMember`, `TeamActivityDay`, `TeamHealthSyncState`;
   source readers for GitHub, Linear, Slack, Google Calendar and Gmail through the
   existing connectors and `callRemoteMcpTool`, each with offline emulator tests;
   Hide, Split and Exclude.
3. **Signals and API.** Core calculations, `teamHealth.overview` and
   `teamHealth.feedback` RPCs with visibility checks, the "Request my card" flow and
   owner approval, the teammate's own-data overview, Postgres tests.
4. **Web page.** The mockup's owner, teammate, syncing, reconnect, empty and
   not-enough-history states built from `packages/ui-web` components, with stories
   using `mockRpc` and a web E2E that opens the page; the `/app/team-health` route;
   then the template is made available.
5. **Team health agent.** Reserved spawn key, read-only tools over the overview,
   approval-gated actions.
6. **Mobile page.** Native layout of the same overview.

## Not in v1

CRM or billing revenue amounts, pulse surveys, on-call paging data, response-latency
signals, Notion signals, any cross-tool composite score, automatic actions.

## Open questions

- Whether Slack and Linear are connected through Composio, Pipedream or their MCP
  servers in the user's setup. TBD in phase 2.
- Whether the Calendar connector can read free/busy for internal teammates, which
  "Schedule 1:1" needs. TBD in phase 5.
