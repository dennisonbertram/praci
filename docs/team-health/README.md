# Team health plan

## Goal

An optional Team health page that a user adds to the sidebar from a list of page
templates. It reads metadata from whatever tools are connected (Slack, Gmail, Google
Calendar, GitHub, Linear, Notion) and answers two questions: who may be overloaded,
and who sits on the direct line to revenue. The most important answer is the
overlap: revenue-critical people with sustained workload signals, so the owner knows
whom to take care of first. Approved design: [mockup.html](mockup.html). Evidence
behind the signal and privacy choices: [research.md](research.md).

Web and desktop ship first. Mobile is a follow-up (phase 6). Until then mobile filters
`sidebarPages.list` to templates it supports, which in v1 is none, so a page added on
web never shows a mobile link to a screen that does not exist.

## Decisions

1. **Added pages live in Postgres, per user and space.** A new `SidebarPage` table
   (`id`, `spaceId`, `userId`, `templateKey`, `position`, `createdAt`, unique on
   space + user + template). RPC `sidebarPages.list`, `add`, `remove`. The template
   list is one constant in `packages/contracts` (`SIDEBAR_PAGE_TEMPLATES`: key, label,
   route, `available`, `platforms`); only `team-health` is available in v1, on web.
   Inbox and Finance (and Data room once it lands) stay hard-coded; moving them into
   templates is a separate change.
2. **Metadata only, never content.** Sync stores timestamps, counts, participant
   email domains, PR authors and reviewers, ticket assignees and states. It never
   stores message bodies, subjects, or file text. The "What this reads" popover
   states this.
3. **The page reads Postgres, not the tools** (the Finance pattern). A sync writes one
   `TeamActivityDay` row per person, day and source with a small typed metrics JSON
   (after-hours events, weekend active, meeting minutes, reviews given, commits,
   open tickets, external threads by domain). Sync runs on demand from the page with
   a 15-minute throttle and a claim token on a `TeamHealthSyncState` row, backfills
   26 weeks, and re-reads the last 3 days each run. Every row carries `spaceId` and
   `ownerUserId`: the user who added the page and whose connections were read. The
   server resolves the owner; clients never pass it. Disconnecting a source deletes
   its rows.
4. **People are a roster, not inferred on every read.** `TeamMember` rows (display
   name, emails, GitHub login, Slack id, Linear id, time zone, working hours, hidden)
   are proposed by the first sync from internal-domain addresses and tool member
   lists. Each row keeps the stable source ids (Slack, GitHub, Linear user ids), not
   only emails. Rows are merged by email only when exactly one candidate matches; the
   owner can split a wrong merge or hide a person from the "others" list. Time
   zone and working hours default from Slack or Calendar profile, else 9–18 in the
   owner's zone.
5. **Signals compare each person to their own baseline.** Pure functions in
   `packages/core` with unit tests on synthetic data. A signal shows only when the
   last 3+ weeks exceed that person's prior 12-week baseline by a set margin. v1
   A signal therefore needs at least 15 weeks of history; the 26-week backfill usually
   provides it at once, and the "not enough history" state shows weeks collected out
   of 15. v1 signals (best evidence, cheapest): after-hours activity, weekend activity,
   meeting hours, share of team PR reviews, open tickets owned. No composite score,
   no ranking; cards sort by most recent change.
6. **Revenue line is inferred and correctable.** v1 signals: sole internal owner of
   threads with an external business domain (personal domains excluded), share of
   changes to revenue services, and single contact on the customer's side. Revenue
   services are repos or paths whose names match billing, checkout, payments or
   pricing; the owner can mark a row "Not revenue". With no CRM connected the page
   says "inferred from email" and never ranks by money.
7. **Confidence is shown, not hidden.** Each signal carries Low or Medium plus the
   reason (for example "Slack only", "no PTO data"). High is reserved for when a
   calendar with PTO is connected.
8. **Visibility: the page owner sees everyone, each person sees only their own.**
   - The page owner is the user who added the page and must have
     `SpaceMember.role == "owner"` in that space (the existing check in
     `packages/db/src/spaces.ts`). They see all cards, evidence and feedback.
   - A teammate sees their own card only after the page owner links their space
     membership to a `TeamMember` row ("This is me" request, owner approves). Email
     matching only proposes the link, and only from a verified login email
     (`emailVerified`), because some deployments allow unverified emails.
   - The server checks the subject on every call: overview, evidence, feedback, and
     agent tools. A linked teammate can read their own card and add a note; they
     cannot read others or use the agent. Unlinked members get nothing.
9. **Feedback is stored.** `TeamHealthFeedback` (signal key, `not_an_issue` with an
   8-week snooze, `done`, optional note). Dismissed signals stay hidden until the
   snooze ends or the signal changes.
10. **Actions go through the agent with approval.** "Schedule 1:1", "Move 4 reviews
    to Sam" and "Add backup" open the Team health agent with that request drafted.
    The agent proposes the calendar event, reassignment or message and sends only
    after per-action approval. No direct writes from the page in v1.

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
  approved self-view links, metadata only, and the "What this reads" disclosure.
- **EU teams need legal review** before enabling; the template stays available but
  this plan does not cover works-council or national employee-monitoring rules.

## Phases

1. **Sidebar pages.** Prisma model and migration, contracts, RPC, "Add page" row and
   template menu in `Shell.tsx`, remove from the row menu, stories, tests. Mobile
   filters the list to supported templates (none in v1).
2. **Roster and sync.** `TeamMember`, `TeamActivityDay`, `TeamHealthSyncState`;
   source readers for GitHub, Linear, Slack, Google Calendar and Gmail through the
   existing connectors and `callRemoteMcpTool`, each with offline emulator tests.
3. **Signals and API.** Core calculations, `teamHealth.overview` and
   `teamHealth.feedback` RPCs with visibility checks, the "This is me" link request
   and owner approval, Postgres tests.
4. **Web page.** The mockup's states 2–5 built from `packages/ui-web` components,
   with stories using `mockRpc` and a web E2E that opens the page.
5. **Team health agent.** Reserved spawn key, read-only tools over the overview,
   approval-gated actions.
6. **Mobile page.** Native layout of the same overview.

## Not in v1

CRM or billing revenue amounts, pulse surveys, on-call paging data, response-latency
signals, Notion signals, any cross-tool composite score, automatic actions.

## Open questions

- Whether Slack and Linear are connected through Composio, Pipedream or their MCP
  servers in the user's setup. TBD in phase 2.
