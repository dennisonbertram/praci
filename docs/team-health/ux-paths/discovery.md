# App discovery: Praci Team health

## Scope
The Team health feature only. Sources:
- Design: `docs/team-health/mockup.html` (states 1–5, cards/table, filter, sort) and plan `docs/team-health/README.md` on branch `docs/team-health-plan`. Research: `docs/team-health/research.md`.
- Built code (phase 1 only, not yet merged): branch `feat/sidebar-pages`: `packages/contracts/src/sidebar-pages.ts`, `packages/db/src/sidebar-pages.ts`, `apps/api/src/router.ts` (`sidebarPages.*`), `apps/web/src/components/{SidebarPages,AddSidebarPage,SidebarPageLink}.tsx`, `apps/web/src/lib/sidebar-page-copy.ts`, `apps/web/src/pages/Shell.tsx`.
- Phases 2–6 (sync, signals API, page, agent, mobile) exist only as plan + mockup. Stories for them describe the planned behaviour and must cite the README decision or mockup state they rely on.

## Application type
Praci: one product across web, Electron desktop (hosts the web UI) and Expo mobile. Multi-tenant: organizations → spaces → members (`SpaceMember.role`, "owner" or "member").

## User roles (for this feature)
- Space owner: adds/removes Team health (owner-only template), sees all cards, takes actions, approves self-view links, uses the Team health agent.
- Linked teammate (space member whose membership the owner linked to a TeamMember row; verified email only proposes the link): sees only their own card, can add a note, no agent, cannot see others.
- Unlinked space member: cannot add the page (not offered), sees nothing of Team health.
- Teammates who are not Praci users: appear as people in the data, never see the page.

## Feature map
- Sidebar pages: "+ Add page" row (hidden until list loaded and something is addable), template menu, added row with "…" → "Remove from sidebar", redirect to /app if removing the open page, inline error on failure.
- Team health page (planned): header (Updated time, refresh, range 4w/12w/6m, Ask agent), coverage chips (connected sources with dot; not-connected dashed chips go to Integrations), (i) "What this reads" popover, one-line summary, toolbar (Filter popover: Group/Signal/Source; Sort: Recent change, Name, Group, Signals, Last after-hours; Cards|Table), Card view sections (Take care of first, Workload signals, Revenue line table, "N others · no sustained change"), Table view (15 rows; columns Person, Group, Revenue line, Signals, Trend, Confidence, Changed, …; header sort; row expands evidence), empty "No one matches these filters.", per-card actions (Schedule 1:1, Add second owner, Move N reviews to X, Block focus time, Move N tickets, Add backup) routed via agent with per-action approval, "Not an issue" (8-week snooze), "Done", "Not revenue" correction, roster hide/split.
- States: nothing connected ("Connect tools"), not enough history (weeks collected out of 15), partial coverage (confidence tags), sync throttle 15 min.

## Navigation
Sidebar row → /app/team-health; chips → Integrations; Ask agent → side panel; actions → agent with drafted request.

## Data entities
SidebarPage (C/R/D), TeamMember (R, hide, split, link), TeamActivityDay (system), TeamHealthFeedback (C: not_an_issue/done/note), sync state.

## Integrations
Slack, Gmail (owner mailbox only), Google Calendar, GitHub, Linear (Notion, CRM not in v1), via existing connectors / remote MCP.

## Story topics
1. Add, open and remove the page (sidebar pages) — built code + mockup state 1.
2. First run and data states — nothing connected, partial sources, not enough history, refresh/sync, coverage chips, What this reads.
3. Reading and triage — summary, cards vs table, filter, sort, range, evidence, others list.
4. Acting on signals — actions via agent, Not an issue / Done, Add backup, Ask agent, Not revenue, roster corrections.
5. Teammates, permissions and mobile — self-view link, non-owner, unverified email, multiple spaces, desktop/mobile.
