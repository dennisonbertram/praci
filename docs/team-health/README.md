# Team health plan

## Goal

An optional Team health page that a user adds to the sidebar from a list of page
templates. It reads metadata from whatever tools are connected (Slack, Gmail, Google
Calendar, GitHub, Linear, Notion) and answers two questions: who may be overloaded,
and who sits on the direct line to revenue. The most important answer is the
overlap: revenue-critical people with sustained workload signals, so the owner knows
whom to take care of first. Approved design: [mockup.html](mockup.html). Evidence
behind the signal and privacy choices: [research.md](research.md).

Web and desktop ship first. Mobile gets the sidebar-page list in phase 1 and the page
itself as a follow-up; until then the template is not offered on mobile.

## Decisions

1. **Added pages live in Postgres, per user and space.** A new `SidebarPage` table
   (`id`, `spaceId`, `userId`, `templateKey`, `position`, `createdAt`, unique on
   space + user + template). RPC `sidebarPages.list`, `add`, `remove`. The template
   list is one constant in `packages/contracts` (`SIDEBAR_PAGE_TEMPLATES`: key, label,
   route, `available`); only `team-health` is available in v1. Inbox, Finance and
   Data room stay hard-coded; moving them into templates is a separate change.
2. **Metadata only, never content.** Sync stores timestamps, counts, participant
   email domains, PR authors and reviewers, ticket assignees and states. It never
   stores message bodies, subjects, or file text. The "What this reads" popover
   states this.
3. **The page reads Postgres, not the tools** (the Finance pattern). A sync writes one
   `TeamActivityDay` row per person, day and source with a small typed metrics JSON
   (after-hours events, weekend active, meeting minutes, reviews given, commits,
   open tickets, external threads by domain). Sync runs on demand from the page with
   a 15-minute throttle and a claim token on a `TeamHealthSyncState` row, backfills
   26 weeks, and re-reads the last 3 days each run. Everything is scoped to space and
   owner user; disconnecting a source deletes its rows.
4. **People are a roster, not inferred on every read.** `TeamMember` rows (display
   name, emails, GitHub login, Slack id, Linear id, time zone, working hours, hidden)
   are proposed by the first sync from internal-domain addresses and tool member
   lists, merged by email. The owner can hide a person from the "others" list. Time
   zone and working hours default from Slack or Calendar profile, else 9–18 in the
   owner's zone.
5. **Signals compare each person to their own baseline.** Pure functions in
   `packages/core` with unit tests on synthetic data. A signal shows only when the
   last 3+ weeks exceed that person's prior 12-week baseline by a set margin. v1
   signals (best evidence, cheapest): after-hours activity, weekend activity,
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
8. **Visibility: owner sees everyone, each person sees their own.** The space owner
   sees all cards. A space member whose login email matches a `TeamMember` sees only
   their own card. Every read is authorized against space and user on the server.
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
- **Small teams have no anonymity.** Aggregation minimums do not help a 4-person
  team, so transparency (metadata only, self-view, disclosure) is the protection.
- **EU teams need legal review** before enabling; the template stays available but
  this plan does not cover works-council or national employee-monitoring rules.

## Phases

1. **Sidebar pages.** Prisma model and migration, contracts, RPC, "Add page" row and
   template menu in `Shell.tsx`, remove from the row menu, stories, tests. Mobile
   lists added pages.
2. **Roster and sync.** `TeamMember`, `TeamActivityDay`, `TeamHealthSyncState`;
   source readers for GitHub, Linear, Slack, Google Calendar and Gmail through the
   existing connectors and `callRemoteMcpTool`, each with offline emulator tests.
3. **Signals and API.** Core calculations, `teamHealth.overview` and
   `teamHealth.feedback` RPCs with visibility checks, Postgres tests.
4. **Web page.** The mockup's states 2–5 built from `packages/ui-web` components,
   with stories using `mockRpc` and a web E2E that opens the page.
5. **Team health agent.** Reserved spawn key, read-only tools over the overview,
   approval-gated actions.
6. **Mobile page.** Native layout of the same overview.

## Not in v1

CRM or billing revenue amounts, pulse surveys, on-call paging data, response-latency
signals, Notion signals, any cross-tool composite score, automatic actions.

## Open questions

- Which space role counts as "owner" for the all-cards view (`SpaceMember.role`
  values need checking). TBD in phase 3.
- Whether Slack and Linear are connected through Composio, Pipedream or their MCP
  servers in the user's setup. TBD in phase 2.
