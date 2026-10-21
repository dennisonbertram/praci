# Devin page: UX-path catalog

Scope: one PLANNED read-only Devin page in Rakazo (mockup `docs/devin/mockup.html`) with a docked Devin agent. Rakazo never launches, replies to or stops a Devin session. A session that needs the user produces a normal Rakazo notification. All names and numbers are invented (org acme; repos acme/web, acme/api, acme/mobile).

This catalog consolidates the five topic files in `docs/devin/ux-paths/topics/` against `docs/devin/ux-paths/discovery.md`. Evidence labels used in story bodies: `[exists]` read in code, `[planned]` only in the mockup or discovery, `[unverified]` nobody has observed it. Story bodies are copied unchanged except for renumbered story IDs; older IDs are listed in the mapping table. A `Gap IDs` line was added to each story and points to the register in section 8.

**Round 2 (mockup v3).** The mockup was revised after round 1 and the requester decided: Rakazo is read-only; one Devin connection per space; the needs-you notification goes to whoever connected; a notification links straight to the Devin session; mobile gets push only (no native screen); no Devin write option. These override older story text. Story bodies below are kept; each story affected by v3 or a decision has a `Round 2 update` block that supersedes the steps it names. Two stories are new (STORY-034, STORY-035). Section 6 (coverage matrix) and section 7 were not re-run. Round-2 evidence: `docs/devin/ux-walker/round-2/report.md`.

**Round 4 (mockup v5).** Decisions in force: read-only; one shared connection per space (space owners connect and reconnect; members see a notice without buttons); the needs-you notification goes to whoever connected and opens the Devin session; mobile push only; the agent has only read tools (Session search) and questions are shown on the page only; the sidebar shows a count; the page header is the title only; Error rows count in Needs you. Each affected story has a `Round 4 update` block. Four stories are new (STORY-039 to STORY-042). The gap register has a Round 4 column. Round-4 evidence: `docs/devin/ux-walker/round-4/findings.json`, `docs/devin/ux-flow/round-4.md`.

**Round 5 (mockup v6, confirmation pass).** No new decisions. v6 fixes: toast radius, glance weight, unknown status under Earlier and not counted, member reconnect notice, inset row focus ring, hamburger needs-you badge below 1024px, 32px collapse button, "Waiting Nm" on needs-you rows, the adopt dialog ("Use it"), connector-gone owner and member frames, "(opens in Devin)" in row names. Two stories are new (STORY-043, STORY-044). The gap register has a Round 5 column. Evidence: `docs/devin/ux-final/`.

Contents: 1 Summary, 2 ID mapping, 3 Merged stories, 4 Dependency graph, 5 Cross-topic overlaps, 6 Coverage matrix, 7 Redundancy candidates, 8 Gap register and decisions, 9 Stories.

## 1. Summary

| Topic | Short | Medium | Long | Total |
|---|---|---|---|---|
| Connect and first visit | 2 | 3 | 2 | 7 |
| Monitoring sessions and needs-you | 2 | 5 | 2 | 9 |
| Asking the Devin agent | 1 | 2 | 1 | 4 |
| Notifications and re-entry | 1 | 4 | 1 | 6 |
| Errors, permissions and surfaces | 1 | 4 | 2 | 7 |
| **All topics** | **7** | **18** | **8** | **33** |

| Measure | Value |
|---|---|
| Stories in the five topic files | 38 |
| Stories after merging duplicates | 33 (5 merges) |
| Feature coverage, any story touches the feature | 49 of 50 features (98%) |
| Feature coverage, a story walks the feature (Full only) | 38 of 50 features (76%) |
| Uncovered features | 1 (see section 6) |
| `GAP:` lines in the topic files | 155 lines, merged into 47 distinct gaps |
| Gaps by severity | 10 blocker, 18 major, 19 minor |
| Decisions needed from the requester | 13 (section 8) |

### Round 2 delta

| Measure | Round 1 | Round 2 |
|---|---|---|
| Stories | 33 | 35 (STORY-034, STORY-035 added) |
| Stories with a Round 2 update block | 0 | 17 |
| Gaps | 47 | 53 (6 new) |
| Gaps resolved by v3 mockup or decision | 0 | 18 |
| Gaps open | 47 | 35 |
| Decisions open | 13 | 5 (5, 6, 7, 8, 11) |

## 2. ID mapping (old to new)

| New ID | Old ID(s) | Title | Type | Topic file |
|---|---|---|---|---|
| STORY-001 | STORY-101 | Connect Devin from the Integrations tile | medium | Connect and first visit |
| STORY-002 | STORY-102 | First visit through the sidebar link, not connected | short | Connect and first visit |
| STORY-003 | STORY-103 | Wrong or rejected key | medium | Connect and first visit |
| STORY-004 | STORY-104 | First load after connecting | medium | Connect and first visit |
| STORY-005 | STORY-105 | Connected but nothing to show (empty list) | short | Connect and first visit |
| STORY-006 | STORY-106, STORY-306 | Returning when the Devin agent is missing, no model is set, or setup failed | long | Connect and first visit |
| STORY-007 | STORY-107, STORY-501 | Key revoked or rejected after connecting (the page goes quiet) | long | Connect and first visit |
| STORY-008 | STORY-201 | Glance at the page and see what needs me | short | Monitoring sessions and needs-you |
| STORY-009 | STORY-202 | Read the status of every session | medium | Monitoring sessions and needs-you |
| STORY-010 | STORY-203 | Decide what to do about a needs-you session | long | Monitoring sessions and needs-you |
| STORY-011 | STORY-204 | Stale data and refresh | medium | Monitoring sessions and needs-you |
| STORY-012 | STORY-205, STORY-301 | Ask the agent what Devin is stuck on | medium | Monitoring sessions and needs-you |
| STORY-013 | STORY-206 | Follow the PRs | medium | Monitoring sessions and needs-you |
| STORY-014 | STORY-207 | Many sessions and a long list | long | Monitoring sessions and needs-you |
| STORY-015 | STORY-208 | Teammate sessions and "who started this" | medium | Monitoring sessions and needs-you |
| STORY-016 | STORY-209, STORY-403 | Dot and notification stay in step with the table (clearing the dot) | short | Monitoring sessions and needs-you |
| STORY-017 | STORY-302 | Ask about history across a repo and a week | medium | Asking the Devin agent |
| STORY-018 | STORY-303 | Ask the agent to tell Devin something (write request) | long | Asking the Devin agent |
| STORY-019 | STORY-305 | Another bot asks the Devin agent | medium | Asking the Devin agent |
| STORY-020 | STORY-307 | Read-only tool steps, in detail | short | Asking the Devin agent |
| STORY-021 | STORY-401 | Devin asks a question while the founder is working in Rakazo | medium | Notifications and re-entry |
| STORY-022 | STORY-402 | Away from the keyboard: OS notification and phone push | medium | Notifications and re-entry |
| STORY-023 | STORY-404 | Weekend away, many sessions blocked | long | Notifications and re-entry |
| STORY-024 | STORY-405 | Same session asks twice (dedupe) | short | Notifications and re-entry |
| STORY-025 | STORY-406 | How Rakazo notices (no webhooks) and when it can be late | medium | Notifications and re-entry |
| STORY-026 | STORY-407 | Finding Devin again by search, and a hidden or unconnected page | medium | Notifications and re-entry |
| STORY-027 | STORY-502 | Devin's MCP server is down or slow | medium | Errors, permissions and surfaces |
| STORY-028 | STORY-503 | Devin answers 429 (rate limited) | short | Errors, permissions and surfaces |
| STORY-029 | STORY-504 | Tool output cannot be parsed (partial data) | medium | Errors, permissions and surfaces |
| STORY-030 | STORY-505 | Out of ACUs, sessions suspend | medium | Errors, permissions and surfaces |
| STORY-031 | STORY-506 | A teammate in the same space opens the Devin page | long | Errors, permissions and surfaces |
| STORY-032 | STORY-507 | Disconnecting Devin from Integrations | medium | Errors, permissions and surfaces |
| STORY-033 | STORY-304, STORY-508 | Narrow windows, Electron links and the phone | long | Errors, permissions and surfaces |
| STORY-034 | (new, round 2) | Open the agent panel for the first time from the closed first-visit page | short | Asking the Devin agent |
| STORY-035 | (new, round 2) | Needs-you alerts after the connector leaves or someone reconnects | medium | Notifications and re-entry |

## 3. Merged stories (deduplication)

Five groups of substantially similar stories were merged. The body of the primary story is kept in full; the body of each merged story follows it as a labeled variant, so nothing was dropped.

| New ID | Merged IDs | Why they are the same journey |
|---|---|---|
| STORY-006 | STORY-106 + STORY-306 | Both: the user presses Ask or opens the page and finds the Devin agent missing, no model set, or agent creation failed; same panel, same repair buttons. |
| STORY-007 | STORY-107 + STORY-501 | Both: the stored key stops working and the user must find out and reconnect; 107 walks the Integrations repair, 501 walks the page-side symptoms. |
| STORY-012 | STORY-205 + STORY-301 | Both: the user asks the docked agent 'What is Devin stuck on?' instead of reading the table. |
| STORY-016 | STORY-209 + STORY-403 | Both: what the sidebar dot means, when it clears, and why it can disagree with the table. |
| STORY-033 | STORY-304 + STORY-508 | Both: the page and panel below 1280px; 508 adds Electron links and the phone. |

Considered and kept separate (cross-referenced in section 5): STORY-001 and STORY-002 (different entry points), STORY-015 and STORY-031 (connector vs non-connector), STORY-027 and STORY-028 (outage vs rate limit; different recovery), STORY-009 and STORY-030 (reading statuses vs one specific cause), STORY-010 and STORY-018 (supported journey vs a conflicting write journey).

## 4. Dependency graph

An arrow `->` means the child story assumes the parent has happened. Stories at the same depth are independent.

```text
STORY-001 Connect from Integrations
|- STORY-003 Wrong or rejected key (retry loop of the connect dialog)
|- STORY-002 First visit via sidebar, not connected (alternate entry to connect)
|   `- STORY-031 Teammate who has not connected
`- STORY-004 First load after connecting
    |- STORY-005 Empty list
    |- STORY-006 Agent missing / no model / setup failed
    |- STORY-008 Glance: what needs me
    |   |- STORY-009 Read every status
    |   |   |- STORY-030 Out of ACUs, sessions suspend
    |   |   `- STORY-029 Unparsable output, unknown status
    |   |- STORY-010 Decide what to do about a needs-you session
    |   |- STORY-013 Follow the PRs
    |   |- STORY-014 Many sessions, long list
    |   |- STORY-015 Teammate sessions, who started this
    |   `- STORY-011 Stale data and refresh
    |- STORY-012 Ask the agent what Devin is stuck on
    |   |- STORY-017 History questions across a repo and week
    |   |- STORY-020 Read-only tool steps
    |   |- STORY-019 Another bot asks the Devin agent
    |   `- STORY-018 Ask the agent to tell Devin something (conflicts with read-only scope)
    |- STORY-025 How Rakazo notices a Needs-you session (detection)
    |   |- STORY-021 Alert while working in Rakazo (toast)
    |   |   `- STORY-016 Dot and notification stay in step with the table
    |   |- STORY-022 Away: OS notification and phone push
    |   |- STORY-024 Same session asks twice (dedupe)
    |   `- STORY-023 Weekend away, many blocked
    |- STORY-026 Find the page again by search; hidden or unconnected page
    |- Failure branches (any time after STORY-004)
    |   |- STORY-007 Key revoked or rejected later
    |   |- STORY-027 Devin MCP down or slow
    |   |- STORY-028 Devin answers 429
    |   `- STORY-033 Narrow windows, Electron links, phone
    `- STORY-032 Disconnect Devin (ends the chain; returns to the Not connected state of STORY-002)
```

Critical path for the core promise: STORY-001 -> STORY-004 -> STORY-025 -> STORY-021 or STORY-022 -> STORY-010. STORY-025 (detection) has no design and gates every notification story.

## 5. Cross-topic overlaps

| Stories | Overlap |
|---|---|
| STORY-001, STORY-002 | Two entry points to the same connect dialog (Integrations tile vs the page's Connect Devin button). |
| STORY-003, STORY-007 | Bad key at connect time vs key rejected later; same dialog and same error text. |
| STORY-004, STORY-008 | Same page render: first load vs the daily glance at the tiles. |
| STORY-004, STORY-005 | First load when the table is populated vs empty. |
| STORY-006, STORY-012 | Agent missing or model unset is found by pressing Ask; both use the same panel. |
| STORY-007, STORY-027, STORY-028 | Three causes of a failed fetch (key, outage, rate limit) with one shared error component. |
| STORY-007, STORY-032 | Revoke then remove or reconnect: the same repair paths. |
| STORY-008, STORY-016, STORY-021, STORY-026 | Needs-you signals: dot, toast, and re-entry through the sidebar or search. |
| STORY-009, STORY-030 | Error and Suspended badges and their missing reasons. |
| STORY-009, STORY-029 | Unknown status values and unparsable rows. |
| STORY-010, STORY-012, STORY-018 | Acting on a needs-you session: row link, agent answer link, or (conflicting) agent write. |
| STORY-010, STORY-021 | Notification to page to Devin: the same journey seen from the monitoring side and the alert side. |
| STORY-011, STORY-025 | How often the page refreshes vs how often Rakazo looks for new needs-you sessions. |
| STORY-011, STORY-027 | Stale rows during a failed refresh. |
| STORY-012, STORY-017, STORY-020 | Asking the agent: the first question, history questions, and checking its tool steps. |
| STORY-013, STORY-017 | PR facts from the table column vs the agent's answer. |
| STORY-014, STORY-029 | More than 100 sessions: tiles and table undercount. |
| STORY-015, STORY-031 | Org-wide visibility seen by a connector (15) and by a teammate who has not connected (31). |
| STORY-015, STORY-023 | Who gets notified when a teammate's session needs the user. |
| STORY-016, STORY-021, STORY-023 | The dot's meaning when alerts arrive or pile up. |
| STORY-018, STORY-019 | Write requests via the agent: direct (18) and via another bot (19). |
| STORY-021, STORY-022, STORY-023 | Alert delivery for a present user, an away user and a long absence. |
| STORY-022, STORY-033 | Phone push tap and the missing mobile Devin screen. |
| STORY-023, STORY-024 | Rate limit and dedupe decide which alerts exist at all. |
| STORY-026, STORY-002 | Hidden or unconnected page reached by search. |
| STORY-031, STORY-032 | Teammate connections and disconnecting: per-user rows are independent. |
| STORY-012, STORY-033 | The agent panel at narrow widths (the former narrow-width story is merged into 33). |
| STORY-005, STORY-028 | Both leave the user without rows; empty and rate-limited states must read differently. |

## 6. Coverage matrix against the discovery feature map

Full = at least one story walks the feature step by step. Partial = mentioned only in a variation, edge case or gap. None = no story. Features come from the 'Exists today' and 'Planned (mockup)' lists in `discovery.md`, plus the states listed under 'Error, empty and loading states needed'.

| # | Feature | Exists / planned | Coverage | Stories |
|---|---|---|---|---|
| E01 | Devin tile in Integrations (letter fallback, subtitle) | exists | Full | STORY-001 |
| E02 | API-key connect dialog | exists | Full | STORY-001, STORY-002, STORY-003 |
| E03 | Connect-time key check and rollback on rejection | exists | Full | STORY-003 |
| E04 | Auto-created Devin agent (writes off, exclusive to the agent) | exists | Full | STORY-001, STORY-006, STORY-019 |
| E05 | Connection card statuses (connected, reconnect, failed) | exists | Full | STORY-007 |
| E06 | Remove Devin on the detail page | exists | Full | STORY-032 |
| E07 | Tool gating: reads vs forced writes | exists | Full | STORY-012, STORY-018, STORY-020 |
| E08 | 'Allow changes in Devin' switch | exists | Full | STORY-018 |
| E09 | Docked ResizableSidePanel and full-screen button | exists | Full | STORY-012, STORY-033 |
| E10 | Sidebar page link and hide menu | exists | Full | STORY-002, STORY-008, STORY-026 |
| E11 | Search and command palette | exists | Full | STORY-026 |
| E12 | Generic notification pipeline (surface, dedupe, limits, delivery) | exists | Full | STORY-021, STORY-022, STORY-023, STORY-024, STORY-025 |
| E13 | Mobile push tap routing | exists | Full | STORY-022, STORY-033 |
| E14 | Mobile generic `agent-page.tsx` | exists | Partial | STORY-033 |
| E15 | Bot-to-bot `message_bot` | exists | Full | STORY-019 |
| E16 | Electron external-link opener | exists | Full | STORY-010, STORY-033 |
| E17 | No-model state (`pageAgentNeedsModel`) | exists | Full | STORY-006 |
| E18 | Agent-missing repair panel (Create agent, Try again) | exists | Full | STORY-006 |
| P01 | Sidebar Devin link with needs-you dot | planned | Full | STORY-008, STORY-016, STORY-021 |
| P02 | Header title and 'Updated' clock | planned | Full | STORY-004, STORY-011 |
| P03 | Header 'Open Devin' button | planned | Partial | STORY-004, STORY-027 |
| P04 | Header 'Ask' button | planned | Full | STORY-012 |
| P05 | Tile: Needs you | planned | Full | STORY-008, STORY-016 |
| P06 | Tile: Working | planned | Partial | STORY-009, STORY-030 |
| P07 | Tile: PRs open | planned | Full | STORY-013 |
| P08 | Tile: ACUs this week | planned | Partial | STORY-008, STORY-014 |
| P09 | Session column and question subtitle | planned | Full | STORY-010, STORY-012 |
| P10 | Status badges (five values) | planned | Full | STORY-009, STORY-030 |
| P11 | Pull request column | planned | Full | STORY-013 |
| P12 | From column | planned | Full | STORY-015 |
| P13 | ACUs and Updated columns | planned | Partial | STORY-011 |
| P14 | Agent example thread with 'Open in Devin' links | planned | Full | STORY-012, STORY-017, STORY-020 |
| P15 | Not connected state | planned | Full | STORY-002 |
| P16 | Retitled 'Connect Devin' dialog | planned | Full | STORY-001, STORY-002 |
| P17 | Needs-you notification | planned | Full | STORY-021, STORY-022, STORY-023, STORY-024 |
| P18 | Loading state (skeleton) | planned | Partial | STORY-004, STORY-027 |
| P19 | Empty state | planned | Full | STORY-005 |
| P20 | Fetch error with stale rows | planned | Full | STORY-027, STORY-028 |
| P21 | Truncated or over-100 list | planned | Full | STORY-014 |
| P22 | Narrow-width layouts (under 1280px, under 1024px) | planned | Full | STORY-033 |
| P23 | Mobile intent | planned | Full | STORY-022, STORY-033 |
| P24 | 'Open Devin' link on the Integrations card | planned | Partial | STORY-001, STORY-026 |
| P25 | Needs-you detection and polling | planned | Full | STORY-025 |
| P26 | Question text unavailable fallback | planned | Partial | STORY-010, STORY-012 |
| P27 | Org-wide visibility and teammates | planned | Full | STORY-015, STORY-031 |
| P28 | Unparsable rows and unknown status | planned | Full | STORY-029 |
| U01 | Repo docs and wiki read tools (`read_wiki_*`, `ask_question`, `list_available_repos`, `devin_list_integrations`; the tile subtitle promises 'repo docs') | exists | None | none |
| U02 | Session with no title, no PR or origin 'other' | planned | Partial | STORY-009, STORY-013, STORY-029 |
| U03 | Long titles and dark theme | planned | Partial | STORY-014, STORY-033 |
| U04 | Agent full-screen thread with a way back to the page | planned | Partial | STORY-012, STORY-033 |

Result: 50 features, 38 Full, 11 Partial, 1 None. Coverage counting Partial = 98%; counting Full only = 76%.

Uncovered or thinly covered features:

- U01 Repo docs and wiki tools: no story. The Integrations tile subtitle says 'Coding sessions and repo docs', and the agent has `read_wiki_*`, `ask_question`, `list_available_repos` and `devin_list_integrations`, but every story is about sessions. Decide whether the Devin agent is also a docs assistant; if so, add one story.
- Partial: E14, P03, P06, P08, P13, P18, P24, P26, U02, U03, U04. Each appears only in a variation or gap line. The most consequential are P18 (loading) and P26 (question text unavailable), because both depend on open gaps (GAP-14, GAP-01).
- Not features of the plan, so not counted, but missing from every story: a table filter or sort control, a refresh control, a notification history, and a credit-balance warning.

## 7. Redundancy candidates

Source for the 'same fact' lists: topic files, plus the table at the top of `topics/monitoring-needs-you.md`.

### 7.1 Duplicate paths (same goal, several routes)

| Goal | Routes found | Stories | Suggestion |
|---|---|---|---|
| Know whether Devin needs me | Sidebar dot; Needs you tile; row badge and subtitle; agent chat; toast; OS notification; phone push; opening Devin | 8, 12, 16, 21, 22 | Keep dot, table and the alert. Do not use the chat example 'What is Devin stuck on?' as the headline demo, since the table already answers it. |
| Open the session in Devin | Row title; 'Open in Devin' in an agent answer; header 'Open Devin' (home only); PR link; Integrations 'Open Devin' link | 10, 12, 13, 27 | Keep the row link and PR link; drop the Integrations link if the sidebar link exists, or keep only that one. |
| Connect Devin | Integrations tile; page 'Connect Devin' button; custom connection with the MCP URL; palette to the page | 1, 2, 26 | Keep the first two; they share one dialog. |
| Repair a bad key | Page notice (planned); Integrations card 'Reconnect' (unreachable for Devin today); detail page; remove then add | 7, 32 | One path: the page notice opens the key dialog. |
| Repair a missing agent | Panel 'Create agent'; reconnect Devin; remove and reconnect | 6, 32 | Keep the panel button only. |
| Ask about Devin | Page panel; full-screen agent thread; agent in the bot list; another bot via `message_bot`; two 'Devin' search results | 12, 19, 26, 33 | Keep the page panel; the thread and bot-list routes come free from the existing pattern. |
| Find the page | Sidebar link; sidebar search; palette; notification; Integrations link | 2, 21, 26 | No change; all reuse existing mechanisms. |
| Answer Devin's question | In Devin's web app; in Slack or Linear; through the Rakazo agent when 'Allow changes in Devin' is on | 10, 18 | Keep only the first two (see 7.3). |
| Catch up after being away | Toast; OS notification; phone push; dot; opening the page; agent | 21, 22, 23 | The page is the source of truth; alerts only point to it. |

### 7.2 Duplicate information (same fact in several places)

| Fact | Places it appears | Stories | Suggestion |
|---|---|---|---|
| Count of sessions that need the user | Tile; 'Needs you' badges in the table; sidebar dot (title '2 need you'); toast; OS notification; phone push; agent answer; question subtitle | 8, 12, 16, 21, 22, 23, 33 | One computed value (GAP-08). Drop the dot's number if the tile is one click away. |
| Question Devin asked | Row subtitle; notification body; agent answer | 10, 12, 21 | Show it in the row; keep alerts short ('Devin needs you: <title>'). |
| Open PRs | 'PRs open' tile; Pull request column; agent answer | 13, 17 | Consider dropping the tile; the column carries it. |
| Freshness | Header 'Updated 1m ago'; per-row 'Updated'; sidebar glance; the agent reads live | 8, 11, 12 | Keep per-row 'Updated' only, and show the header clock only when the data is old (GAP-34). |
| Connection health | Integrations badge; page notice; agent tool error | 7, 27, 28 | Same two messages everywhere (GAP-44). |
| Session list | Table; agent search step; notification title | 12, 17, 21 | Acceptable: different jobs. |
| Key description | Tile hint; dialog text | 1 | One component; no drift. |
| 'Add a model' prompt | Panel; Settings; onboarding | 6 | Existing behavior. |

### 7.3 Overlapping features

| Feature A | Feature B | Overlap | Suggestion |
|---|---|---|---|
| Devin page (read-only list) | Devin agent chat | Both answer 'what is Devin doing'; the agent reads live, the table is cached; wording differs. | Page for glance and links, agent for history and narrative. Replace the mockup's sample question with one the table cannot answer (for example, history by repo). |
| Integrations 'Allow changes in Devin' | Read-only Devin page | The setting lets the agent send, stop and create sessions with an approval card. | Remove the option for Devin (GAP-10). |
| Integrations Devin card (status) | Devin page (status) | Two places to learn the connection works; the card says Connected for a revoked key. | Make the card reflect fetch failures, or point the card to the page. |
| Toast | Sidebar dot | Same event, same moment, for a user who is present. | Keep both (existing); suppress the toast on the page itself. |
| Notification | Page | For an away user, the page already lists everything. | Treat the page as the record; do not add a notification history. |
| Page panel | Devin agent in the bot list | Same bot, two entry points. | No change. |
| Header 'Open Devin' | Row links | Both go to Devin; the header has no defined target. | Keep one meaning: Devin home. |

## 8. Gap register

The topic files contain 155 lines with `GAP:`. They collapse to 47 distinct gaps. Categories: data/API, state not designed, copy, notification, permissions/teams, layout/surface, scope conflict. Severity: blocker = a core journey fails or misleads; major = confusing or extra steps; minor = polish. Proposed fixes favor removing or simplifying over adding UI, per the minimal-UI rule in `AGENTS.md`.

| ID | Gap | Stories | Category | Severity | Proposed fix | Round 2 | Round 3 | Round 4 | Round 5 |
|---|---|---|---|---|---|---|---|---|---|
| GAP-01 | The question text of a Needs-you row (and the notification body and the agent's answer) needs `devin_session_interact` get_messages, which is a forced write today, so reading it shows approval cards or is blocked. | 010, 012, 020, 021 | data/API | blocker | Split get/get_messages into a read path in `packages/contracts/src/devin.ts`; if that is refused, drop the row subtitle and notify with the session title only. | Open | Open: not observable in the mockup; v4 still draws the question in rows, toast and agent. F-STORY-012-09 shows the frame contradicts itself if the agent cannot read it. | Open: build item, covered by plan slice S1, S2, S6 (docs/plans/devin.md design 3: question text read server-side; the agent loses the tool). v5 removes the contradicting frame (F-STORY-012-09 resolved); the agent never quotes a question. | Open (unchanged) |
| GAP-02 | Nothing detects a session turning Needs you: no poller, no store of the last-seen status, page-open polling cannot reach a user who is away, and the first poll after connecting could burst-notify old sessions. | 011, 021, 022, 023, 024, 025 | notification | blocker | One server-side poll per connected server; keep last status per session in Postgres; the first poll sets a silent baseline. | Open | Open: build work (poller). | Open: build item, covered by plan slice S6 (poller and last-seen status). | Open (unchanged) |
| GAP-03 | The mapping from Devin `status` / `status_detail` to the five badges is unverified, ambiguous pairs and unknown values have no rule, and a wrong mapping would notify on the wrong sessions. | 008, 009, 025, 029, 030 | data/API | blocker | Capture the real status values from a live key, write the mapping table in code, and show an unknown value as its raw text in the neutral badge, excluded from tiles. | Open | Open: build work (status mapping). | Open: build item, covered by plan slice S2 (status mapping, raw fallback). v5 draws the unknown-status badge; F-STORY-008-07 notes the tile count in that frame. | Open (unchanged) |
| GAP-04 | A revoked or unauthorised key has no designed state: the page keeps stale rows, the Integrations card still reads Connected (`mcpStatus` cannot see a bad bearer key), and needs-you alerts stop silently. | 007, 027 | state not designed | blocker | One `ErrorNotice` on the page with a Reconnect action that opens the existing key dialog; on 401/403 mark the server failed so the card says so too. | Resolved (round 2): Mockup draws the stale frame with 'Devin rejected the key.' and Reconnect. The silent alert stop and card health move to GAP-49. | Resolved (round 2); v4 confirms: stale frame dims badges, links and tile, hides the dot. | Resolved (round 2); v5 adds the member variant (no Reconnect button). | Resolved (unchanged) |
| GAP-05 | The sidebar dot counts unseen notifications and clears when the page is opened, so it goes out while sessions still need the user and disagrees with the Needs you tile. | 008, 016, 021, 022, 023 | notification | blocker | Drive the dot from the live needs-you count (like the other pages' glance counts), not from unseen notifications. | Open: Mockup dot has no number; the clearing rule is still undecided (decision 8). | Open: dot clearing rule still undecided (decision 8); no dot under 1024px (F-STORY-033-06). | Open: build item, covered by plan slice S4 (glance) and S8a. Decision in force: the sidebar shows a count; v5 draws it on every frame (matches the tile). | Open (unchanged) |
| GAP-06 | Dedupe and rate limits can swallow or drop real alerts: a session-only key hides a second question, the default key (surface + title) merges different sessions, the 2-per-hour attention limit drops the rest for good, and a 24-hour repeat looks like a new event. | 010, 021, 023, 024, 025 | notification | blocker | Explicit key = session id + latest message id, unique title per session, and send overflow as a low-importance notification instead of dropping it. | Open | Open: build work (dedupe, rate limit). | Open: build item, covered by plan slice S6 (dedupe key, overflow as low-importance). | Open (unchanged) |
| GAP-07 | Mobile has no Devin screen; the push link `/app/devin` opens nothing or is misread as a bot id, and the phone behavior is undecided. | 012, 016, 022, 033 | layout/surface | blocker | Put the Devin agent bot id in the push data so a tap opens its thread, and state in the PR that the page is web and desktop only. | Resolved (round 2): Decision: mobile gets push only, no native screen. The push tap target moves to GAP-48. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-08 | No Devin RPC or read path exists for the page; how it reads sessions as the connector, how that is authorised, and that tiles, table, dot count and agent come from one result are undecided. | 004, 008, 011, 014, 016, 027 | data/API | blocker | One space- and user-scoped server call that runs the search and caches the result; tiles, table and dot all read that one result. | Open | Open: build work (RPC and read path). | Open: build item, covered by plan slice S4 (devin.sessions RPC). | Open (unchanged) |
| GAP-09 | The org-scoped key shows every org session, including confidential titles, to every member who connects, with no owner name and no label saying which org. | 003, 004, 015, 031 | permissions/teams | blocker | Decide scope before build; minimum is to name the org in the page header and keep titles visible only to connectors. | Resolved (round 2): Decision: one connection per space; mockup header names the org ('acme'). Who may connect moves to GAP-50. | Resolved (round 2). | Resolved (round 2); v5 drops the org name from the header by decision (title-only header). The sharing statement stays in the connect dialog. | Resolved (unchanged) |
| GAP-10 | The page is read-only, but the Devin agent offers the 'Allow changes in Devin' setting, approval cards for send, stop and create, and a skill that points users to that setting, which contradicts 'Rakazo never launches, replies or stops'. | 010, 012, 018, 019, 020 | scope conflict | blocker | Remove the write option for Devin: keep `writesEnabled` false, hide the Devin write tools from the agent, and drop the skill pointer. | Resolved (round 2): Decision: no Devin write option. Build work: hide the write tools and the skill pointer. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-11 | Clicking an OS notification only focuses the window and does not open the notification link, so the away user lands on whatever page they left. | 021, 022 | notification | major | Navigate to the link in the OS notification click handler (`notification-delivery.ts`). | Resolved (round 2): Decision: a needs-you notification links straight to the Devin session, so the click must open it. Build work in `notification-delivery.ts`. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-12 | Only the user whose key detected a session is notified, even when the session belongs to someone else; teammates who did not connect get nothing. | 015, 023, 031 | permissions/teams | major | Keep connector-only for the first release and say so in the PR. | Resolved (round 2): Decision: the needs-you notification goes to whoever connected. A connector who leaves is GAP-53. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-13 | There is no refresh model: no refresh control, no auto-refresh cadence, no rule for the header clock, the page wakes stale, and the page lags after the user answers in Devin. | 010, 011, 016, 023, 025, 027 | data/API | major | Refetch on window focus and every N seconds while visible; no refresh button. | Open: Mockup shows 'Updated Nm ago' only when stale; no refresh cue is drawn. | Open: refetch is planned behaviour, not observable; no refresh cue drawn. | Open (unchanged) | Open (unchanged) |
| GAP-14 | Loading and slow states are not drawn: first-load skeleton, refresh with data on screen, the connector timeout, and the 590-second gather tool must never be used for a page load. | 004, 011, 020, 027 | state not designed | major | Skeleton on first load only; keep rows during refresh; the page uses search with a short timeout. | Resolved (round 2): Mockup draws the loading skeleton (frame 'Loading'). The short-timeout and no-gather-tool rule is build work. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-15 | There is no empty state: zero sessions, an all-old list, and an empty tool response all look broken or like an outage. | 005, 008, 027 | state not designed | major | One short 'No sessions' row inside the table frame; tiles stay at 0. | Resolved (round 2): Mockup draws 'No Devin sessions yet.' (frame 'Empty'). | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-16 | Only the latest 100 sessions load, so tiles undercount, an older Needs-you session is invisible, and the agent can know more than the page. | 012, 013, 014, 029 | data/API | major | Page through results until all non-finished sessions are read, or label the table 'latest 100'. | Open | Open: build work. | Open (unchanged) | Open (unchanged) |
| GAP-17 | The sort rule, sticky header, filter and search are undefined, so there is no way to narrow to Error or to a repo. | 009, 014, 017 | layout/surface | major | State one sort (Needs you first, then newest); add no filters, since the agent is the search. | Open: Mockup groups Needs you, Working, Earlier; the order inside a group is not stated. | Open: order inside a group still unstated. | Open (unchanged) | Open (unchanged) |
| GAP-18 | Tile definitions are open: 'ACUs' is jargon, 'this week' has no window or timezone, per-session `acus_consumed` can miscount across weeks, and 'PRs open' counts only the fetched rows. | 004, 005, 008, 013, 014, 017 | copy | major | Define a rolling 7-day window in the viewer's timezone; consider dropping the ACUs tile. | Resolved (round 2): Mockup keeps only the Needs you and Working tiles; ACUs and PRs open are gone, so no window is needed. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-19 | The session link target is unverified (`url` comes only from the gated get call), the header 'Open Devin' has no target, and there is no row highlight, copy link or Slack-thread link. | 004, 010, 012, 021, 027 | data/API | major | Build the link from the session id after the URL shape is checked; point 'Open Devin' at Devin home; no highlight or copy control. | Open: All links are '#'; the session URL shape is still unverified (the header icon is gone). | Open: links still '#', session URL shape unverified. | Open (unchanged) | Open (unchanged) |
| GAP-20 | Nothing tells the user that a Needs-you question is answered in Devin, so they look for a reply box that does not exist. | 010, 012 | copy | major | Label the row link 'Answer in Devin' instead of adding explanatory text. | Resolved (round 2): Needs-you rows carry the link 'Answer in Devin' with an external icon. | Resolved by v4: the 'Answer in Devin' link is gone; the whole row opens the session and the title carries the external glyph (one target per row). | Resolved by v4; unchanged in v5. | Resolved (unchanged) |
| GAP-21 | After Connect the dialog ends on 'Devin connected' and Done in the catalog, with no path to the new page. | 001, 002 | layout/surface | major | Close the dialog and go to `/app/devin`; add the 'Open Devin' link on the card. | Resolved (round 2): Caption under the dialog: Connect closes the dialog and opens /app/devin. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-22 | The connect check lists tools only, so a key without session-read permission connects and then fails on the page. | 003, 007 | data/API | major | Add one session search to the connect-time check. | Open | Open: build work (connect-time check). | Open (unchanged) | Open (unchanged) |
| GAP-23 | Panel states for a missing agent (Create agent, Try again), no model, and failed creation are not drawn for Devin, and the table works without a model with no hint. | 006, 012 | state not designed | major | Reuse the Legal and Carta panel branch. | Open: Ask is drawn on Not connected, Loading and Empty frames with no agent state (F-STORY-002-04). | Resolved by v4: Ask is hidden on Not connected, Loading and Load error; the agent-missing frame shows 'Create Devin agent'. No-model and failed-creation variants reuse the Legal and Carta branch (build). | Resolved by v4; unchanged in v5. | Resolved (unchanged) |
| GAP-24 | Connections are per user: a teammate sees a bare Connect Devin with no hint that a colleague connected, a shared key may be pasted into chat, and one revoked shared key breaks every page using it. | 002, 007, 031 | permissions/teams | major | Keep per-user connections; link the dialog hint to where a service-user key is created; revisit a shared connection later. | Resolved (round 2): Decision: one Devin connection per space. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-25 | Narrow layouts are not drawn: six-column table and four tiles under 1280px, the overlay panel hiding the table, the drawer hiding the dot, and long titles. | 012, 014, 021, 033 | layout/surface | major | Reuse Legal's container-query list layout; the overlay panel stays as is. | Resolved (round 2): Width switcher draws 1100, 900 and 390 (list layout, top bar, overlay panel). Residuals: F-STORY-033-03 and -06. | Resolved (round 2); v4 residual is F-STORY-033-06 (no dot under 1024px). | Resolved (round 2); residual F-STORY-033-06 (no needs-you signal under 1024px) still present in v5. | Resolved (round 2); v6: the hamburger carries the needs-you count under 1024px, closing residual F-STORY-033-06. |
| GAP-26 | Error and Suspended rows give no reason (`status_detail`), Suspended can mean out of credits or a manual pause, and a row cannot show two statuses. | 009, 030 | data/API | major | Show the reason as a tooltip from `status_detail` and define which status wins. | Open | Open: no reason drawn on the Error row. | Open (narrowed): the Error row now shows a one-line reason ("Tests failed on acme/api"). Suspended has no reason and the precedence rule between statuses is not drawn. | Open (unchanged) |
| GAP-27 | Tool output is free text; rows or fields that fail to parse are dropped silently, so tiles can be wrong and 'no PR' looks the same as 'PR unreadable'. | 027, 029 | data/API | major | Parse defensively against real output, and show a dash for an unreadable field and a count of skipped rows. | Open | Open: build work (defensive parsing). | Open (narrowed): the partial-results note "Some sessions could not be read." is drawn. A dash for an unreadable field and a count of skipped rows are not. | Open (unchanged) |
| GAP-28 | HTTP 429 is not handled: the user sees a raw error, 'Try again' keeps the limit exhausted, the key is shared across the org, and the agent may retry in a loop. | 025, 028 | data/API | major | Map 429 to one plain message, disable 'Try again' for the cooldown, and add jitter to the poller. | Open: Load-error frame has 'Try again'; the 429 cooldown rule is not drawn. | Open: 429 cooldown not drawn. | Open (unchanged) | Open (unchanged) |
| GAP-29 | First-visit state of the agent panel (open or closed, intro, suggestions) is not designed. | 004, 012 | state not designed | minor | Closed by default; Ask opens it; reuse the existing suggestions pattern. | Resolved (round 2): Mockup draws first visit with the panel closed. The first Ask is STORY-034. | Resolved (round 2); v4 draws the first-Ask intro. | Resolved (round 2); v5 draws the first Ask opening the intro. | Resolved (unchanged) |
| GAP-30 | The agent reads live while the table is cached, so counts and wording of the same question can differ, and answers show no freshness. | 011, 012, 014, 017, 020 | data/API | minor | Accept the difference; have the page and the agent use the same session read so wording of status matches. | Open | Open: accepted difference. | Open (unchanged) | Open (unchanged) |
| GAP-31 | There is no standard wording for what the agent cannot do: read the question, answer by person, see the credit balance, match a repo without a PR, or look past 100 sessions. | 012, 015, 017, 030 | copy | minor | One line in the agent's skill: state the limit in a sentence and point to Devin; no UI. | Open | Open (narrowed): v4 draws the wording for an unreadable question; credit balance, person, repo and 100-session limits are still undefined. | Open (narrowed): v5 removes the unreadable-question frame (decision: the agent has read tools only, questions are shown on the page only). Credit balance, person, repo and 100-session limits are still undefined. | Open (unchanged) |
| GAP-32 | If writes are kept, the approval card shows raw JSON, has no edit step, and is the only protection against prompt injection from session text. | 018 | permissions/teams | minor | Moot if the write option is removed; otherwise render a plain-sentence summary. | Resolved (round 2): Decision: no write path, so no approval card for Devin. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-33 | Requests from another bot to the Devin agent have undefined visibility (is it in the Devin thread), approval-card location, and no rule against forwarding Devin content to third parties. | 019 | permissions/teams | minor | With writes removed, only the forwarding rule remains: one line in the agent's skill. | Open: Narrowed: with writes removed only the 'do not forward Devin content' rule remains. | Open: one skill line. | Open (unchanged) | Open (unchanged) |
| GAP-34 | The header 'Updated Nm ago' (Rakazo fetch time), the per-row 'Updated' (Devin time) and the sidebar glance are three different clocks, and the under-one-minute wording is undefined. | 008, 011 | copy | minor | Drop the header clock unless the data is more than a few minutes old. | Resolved (round 2): Header shows the org name; 'Updated 4m ago' appears only on the stale frame. | Resolved (round 2). | Resolved (round 2); v5: header is the title only, "Updated 4m ago" appears only on the stale frames. | Resolved (unchanged) |
| GAP-35 | The PR column has one slot: several PRs per session, closed-unmerged PRs, and sessions with no PR (so no repo at all) are undefined. | 013, 017 | data/API | minor | Show the first PR plus a count; add a 'closed' state; leave the repo blank without a PR. | Open | Open: one PR slot. | Resolved by v5: the two-PR frame stacks both PRs in the cell and rows with none show a dash. A closed-unmerged state is not drawn (build, S7). | Resolved (unchanged) |
| GAP-36 | Devin `origin` values beyond Slack, Linear, Web and API (jira, teams, automation, cli, code_scan, other) and sessions without a title have no label. | 009, 015 | data/API | minor | Map unknown origins to 'Other' and an empty title to 'Untitled session'. | Open | Open: origin mapping. | Open: origin mapping. v5 draws an unknown status as its raw text in the neutral badge (see GAP-03). | Open: origin mapping. v6 files an unknown status under Earlier and leaves it out of the tiles (F-STORY-008-07 closed). |
| GAP-37 | It is undecided whether the sidebar link shows before connecting, and a hidden page loses its dot with no hint that it still notifies. | 002, 008, 026 | state not designed | minor | Show the link always (like Cap table); hidden pages still toast, so add no UI. | Resolved (round 2): Not connected frame shows the sidebar link, with no dot. | Resolved (round 2). | Resolved (unchanged) | Resolved (unchanged) |
| GAP-38 | The connect dialog does not say where to create a key, one error covers a bad key, missing permission, network and outage, nothing says the failed key was not saved, and closing during 'Connecting' is unspecified. | 001, 003 | copy | minor | Add one link to the key hint; split the error into 'rejected' and 'could not reach'. | Open: Narrowed: the help link 'Where to find your key' is now drawn; the error split and failed-key wording are not. | Open (narrowed): v4 draws empty, connecting and refused dialog states; 'could not reach Devin' and 'failed key not saved' are not drawn. The connecting frame has no visible 'Connecting' cue (F-STORY-001-06). | Open (narrowed): "Connecting…" is drawn on the disabled button (F-STORY-001-06 resolved). "Could not reach Devin" and "failed key not saved" are not drawn. | Open (unchanged) |
| GAP-39 | Toast, dot and tile announce the same fact, a toast can appear for a page the user is already on, and the drawer hides the dot under 1024px. | 021 | notification | minor | Suppress the toast while on `/app/devin`. | Open: Toast frame is drawn on the Devin page itself (F-STORY-021-04). | Resolved by v4: the toast is drawn over Inbox, not the Devin page. Suppression on /app/devin is build work. | Resolved by v4; v5 adds the unreadable-question toast body ("is waiting for your answer"). Suppression on /app/devin is build work. | Resolved (unchanged) |
| GAP-40 | The phone push still fires when a laptop OS banner was shown, so both devices buzz. | 022 | notification | minor | Leave as is; it is existing behavior across all notifications. | Open | Open: existing behaviour. | Open (unchanged) | Open (unchanged) |
| GAP-41 | Missed alerts cannot be reviewed: a rate-limited one is gone, none replays on open, there is no history, and another space's unseen state is not shown. | 016, 023 | notification | minor | Treat the page as the source of truth; add no bell or history. | Open | Open: page is the record. | Open (unchanged) | Open (unchanged) |
| GAP-42 | Only Needs you notifies; a broken key, out-of-credits suspensions and Error sessions produce no alert. | 007, 030 | notification | minor | Keep needs-you only for the first release; show the others on the page. | Open | Open: needs-you only. | Open (unchanged) | Open (unchanged) |
| GAP-43 | The Remove dialog does not say Devin sessions are untouched or that the agent is archived, an open page tab goes stale, old notification links land on Connect Devin, and reconnecting orphans agent history. | 032 | copy | minor | Add one clause to the dialog; leave the rest. | Open: Now also: Remove ends the connection for every member of the space. | Open: Remove dialog is not in the v4 mockup. | Open (unchanged) | Open (unchanged) |
| GAP-44 | Connection trouble is worded differently in the Integrations badge, the page notice and the chat tool error, and the raw message ('401') means nothing to the user. | 007, 027, 028 | copy | minor | Two shared messages ('Devin rejected the key', 'Devin is not responding') used in all three places. | Open: Page uses 'Devin rejected the key.' and 'Could not load Devin sessions.'; the Integrations card and chat error wording are unverified. | Open: page wording consistent; Integrations card and chat error wording unverified. | Open (unchanged) | Open (unchanged) |
| GAP-45 | A long or truncated question shows on one line with an ellipsis and no way to read it in full. | 010, 012, 029 | layout/surface | minor | Clamp to two lines; the link to Devin is the way to read more. | Resolved (round 2): Mockup clamps the question to two lines and adds 'Answer in Devin'. | Resolved (round 2); v4 supersedes: the question wraps in full, no clamp (decision V4). | Resolved (round 2), v4 supersedes; unchanged in v5. | Resolved (unchanged) |
| GAP-46 | Searching 'Devin' returns the page and the 'Devin agent' bot, and no keywords or order are defined. | 026 | layout/surface | minor | Page first, with a keywords string like Cap table has. | Open | Open: search keywords. | Open (unchanged) | Open (unchanged) |
| GAP-47 | Accessibility details are open: dot label, reason on a disabled composer, overlay focus order and Esc, and tool-step summary names. | 006, 020, 033 | layout/surface | minor | Follow the existing page-agent patterns; no new design. | Open: Dot has no role (F-STORY-008-04); 'Answer in Devin' is 18px high (F-STORY-010-04). | Open (narrowed): dot is aria-hidden with screen-reader text (matches the real shell) and the 18px link is gone; keyboard focus ring wraps only the title (F-STORY-010-06); overlay focus order not checked. | Open (narrowed): focus ring is now row-wide (F-STORY-010-06 resolved; cosmetic F-STORY-010-07); collapse icon 28x28 (F-STORY-012-05); overlay focus order not checked. | Open (narrowed): v6 insets the row focus ring so it no longer touches the title or question; the dot role is still unspecified. |
| GAP-48 | A needs-you notification now links to the Devin session (https). The phone push has no handler for an external link: the mobile parser reads app paths only, so a tap may open nothing or the app home. | 022, 033 | notification | major | Mobile notification-open opens an https link in the system browser; keep the thread route for other notifications. | Open (new) | Open: build work (mobile https link); not observable. | Open (unchanged) | Open (unchanged) |
| GAP-49 | With the key rejected, the page keeps the tile, badges, 'Answer in Devin' links and the sidebar dot looking live; nothing says needs-you alerts have stopped; the Integrations card can still read Connected; it is not said who can press Reconnect on a shared connection. | 007, 027, 031 | state not designed | major | Dim tile and dot while stale or add a short clause to the notice; mark the server failed on 401/403; allow any member who may connect to Reconnect. | Open (new) | Resolved by v4 for the page: stale frame dims tile, badges and links, hides the dot, and the notice reads 'Alerts are paused'. Left: member variant of Reconnect (GAP-54) and Integrations card health (build). | Resolved by v4; v5 confirms both roles. Left: Integrations card health (build). | Resolved (unchanged) |
| GAP-50 | One connection per space is decided, but not who may connect, replace or remove it, what the dialog says about sharing (every member sees every org session), or what a member who may not connect sees. | 001, 002, 031, 032 | permissions/teams | major | Decide the role rule, then add one short clause to the connect and remove dialogs and one 'ask whoever connected it' variant of Not connected. | Open (new) | Open: v4 adds the sharing clause ('Connects Devin for everyone in this space. Read-only.') and the member frame ('Ask a space owner to connect Devin.'). The role rule (who may connect, replace, remove) is still undecided; the Remove dialog clause is not drawn. | Resolved by decision (round 4): space owners connect, replace and remove; members see "Ask a space owner to connect Devin." or the key-rejected notice without buttons. Left: the Remove dialog clause (GAP-43). | Resolved by decision (round 4); v6 draws the owner dialog with "Use the Devin connection you already added." and "Use it". |
| GAP-51 | Clicking Ask on the closed-panel first-visit frame hides the button and shows no panel, so the first-open state (empty thread, intro, suggestion chips) and the closed-to-open transition are not drawn; Ask also shows where there is no agent (Not connected, Loading, Empty). | 004, 012, 034 | state not designed | minor | Draw the first-open intro once; hide Ask until an agent exists. | Open (new) | Resolved by v4: first-Ask intro drawn; Ask hidden where no agent exists. Left: clicking Ask on the 'First visit, panel closed' frame shows no panel (F-STORY-034-01). | Resolved by v5: Ask on "First visit, panel closed" opens the intro dock at 1440 and 900 (F-STORY-034-01 resolved). | Resolved (unchanged) |
| GAP-52 | A notification link points at a Devin session URL, but the URL shape is unverified (GAP-19). If it cannot be built, the notification has no target. | 021, 022 | notification | minor | Fall back to `/app/devin` when no session URL can be built. | Open (new) | Open: URL shape unverified. | Open (unchanged) | Open (unchanged) |
| GAP-53 | Needs-you alerts go to whoever connected. If that person leaves the space, is deactivated or reconnects as someone else, nobody (or the wrong person) is alerted, and nothing on the page says who receives them. | 023, 031, 035 | permissions/teams | minor | On reconnect, the new connector becomes the recipient; when the connector is removed, notify an owner once. | Open (new) | Open: not drawn. | Open (unchanged) | Resolved for the page by v6: connector-gone frames for a space owner (Reconnect) and a member (notice only). The Integrations card state and re-homing stay build items (plan S3a, S3b, S5). |
| GAP-54 | The key-rejected frame offers Ask (the agent cannot read Devin with a rejected key) and a Reconnect button to every member, including one who may not connect or replace the shared connection. | 007, 027, 031 | state not designed | minor | Hide Ask while the key is rejected; show a member variant that says who can reconnect and has no button. | Open (new in round 3) | Open (new) | Resolved by v5: Ask hidden on the key-rejected frames; owner frame has Reconnect, member frame has none. Residual suggestion: F-STORY-007-05. | Resolved (unchanged) |

Story numbers in the table are `STORY-` numbers without the prefix.

### Gap counts

| Severity | Round 1 | Resolved (round 2) | Open after round 2 (incl. 6 new) |
|---|---|---|---|
| Blocker | 10 | 4 | 6 |
| Major | 18 | 9 | 12 (9 old + 3 new) |
| Minor | 19 | 5 | 17 (14 old + 3 new) |
| Total | 47 | 18 | 35 |

Resolved here means the design question is settled by the v3 mockup or by a requester decision; several still need build work, which the Round 2 column says. Counts are from the Round 2 column above.

### Gap counts after round 3

| Severity | Total | Resolved (rounds 2 and 3) | Open |
|---|---|---|---|
| Blocker | 10 | 4 | 6 |
| Major | 21 | 11 | 10 |
| Minor | 23 | 7 | 16 |
| Total | 54 (1 new in round 3: GAP-54) | 22 | 32 |

Round 3 moved 4 gaps from open to resolved (GAP-23, GAP-39, GAP-49, GAP-51), on top of round 2's 18, and reopened none. GAP-20 and GAP-45 stay resolved but by a different mechanism in v4 (whole-row link and full question). GAP-54 is new. Open blockers (GAP-01, 02, 03, 05, 06, 08) are build or decision items that the static mockup cannot show; none is caused by the v4 design.

### Gap counts after round 4

| Severity | Total | Resolved (rounds 2 to 4) | Open | Of the open: build item, covered by a plan slice |
|---|---|---|---|---|
| Blocker | 10 | 4 | 6 | 6 (GAP-01, 02, 03, 05, 06, 08) |
| Major | 21 | 12 | 9 | 0 |
| Minor | 23 | 9 | 14 | 0 |
| Total | 54 (none new in round 4) | 25 | 29 | 6 |

Round 4 moved 3 gaps from open to resolved (GAP-35 by the two-PR frame, GAP-50 by the owner and member decision, GAP-54 by the key-rejected owner and member frames) and reopened none. GAP-51 was already counted resolved in round 3; v5 closes its last residual. Every open blocker has a slice in `docs/plans/devin.md` (section Gap register coverage): GAP-01 S1, S2, S6; GAP-02 S6; GAP-03 S2; GAP-05 S4 and S8a; GAP-06 S6; GAP-08 S4. They are build items; the static mockup cannot show them. The 23 other open gaps are major or minor items that are narrowed, unobservable in a static mockup, or deliberately out of the epic.

### Gap counts after round 5

| Severity | Total | Resolved (rounds 2 to 5) | Open |
|---|---|---|---|
| Blocker | 10 | 4 | 6 |
| Major | 21 | 12 | 9 |
| Minor | 23 | 10 | 13 |
| Total | 54 (none new in round 5) | 26 | 28 |

Round 5 (mockup v6) moved one gap to resolved: GAP-53 (connector-gone frames for owner and member). It narrowed GAP-36 (unknown status under Earlier, not counted) and GAP-47 (focus ring inset) and reopened none. The six open blockers are unchanged and remain build items covered by plan slices.

### Decisions needed from the requester

Round 2 marks which of these are now decided or settled by the v3 mockup. Decisions 5, 6, 7, 8 and 11 are still open.

1. **Org-wide visibility.** The org key shows every Devin session to every member who connects, with no names. Choose: show all org sessions with the org named in the header (recommended minimum), filter somehow, or restrict who can connect. Closes: GAP-09, GAP-24. **Decided (round 2): one shared connection per space, org named in the header; who may connect is GAP-50.**
2. **Who gets notified.** Only the connector (recommended for the first release), or every member, or the session owner (not possible today: `user_id` is opaque). Closes: GAP-12. **Decided (round 2): whoever connected.**
3. **Mobile scope.** Recommended: the page is web and desktop only; the push opens the Devin agent thread. Alternative: a native session list. Closes: GAP-07. **Decided (round 2): push only, no native screen; the push opens the Devin session link, not the agent thread.**
4. **Remove 'Allow changes in Devin' for Devin?.** Recommended: yes. The page promises read-only, and the setting, the approval cards and the skill text all invite writes. Closes: GAP-10, GAP-32, GAP-33. **Decided (round 2): yes, no Devin write option.**
5. **Refresh and poll model.** Recommended: refetch on focus and every N seconds while visible, plus one server-side poll for alerts. Alternative: page-open polling only, which cannot notify an away user. Closes: GAP-13, GAP-02.
6. **Split `devin_session_interact` read actions.** Recommended: yes, so question text can be read without an approval card. Alternative: ship without question text on rows and in alerts. Closes: GAP-01.
7. **Page read path.** A new Devin RPC that reads as the connector (recommended) vs reading through the agent's server connection. Closes: GAP-08.
8. **Dot meaning.** Live needs-you count (recommended) vs unseen notifications (current mechanism). Closes: GAP-05.
9. **Tile definitions.** 'This week' window and timezone, and whether to keep the ACUs tile at all. Closes: GAP-18. **Settled by mockup (round 2): ACUs tile dropped.**
10. **Sidebar link before connecting.** Always show (recommended, like Cap table) vs hide until connected. Closes: GAP-37. **Settled by mockup (round 2): link always shown.**
11. **Alerts beyond Needs you.** Whether a broken key or out-of-credits suspensions should notify. Recommended: no, for the first release. Closes: GAP-42.
12. **Agent panel default.** Closed with Ask (recommended) vs open on first visit, as the mockup draws it. Closes: GAP-29. **Settled by mockup (round 2): closed with Ask.**
13. **Shared connection.** Per-user key (current, recommended) vs a shared connection for a space. Closes: GAP-24. **Decided (round 2): one connection per space (the recommendation in this list is superseded).**

## 9. Stories

Stories are grouped by their topic file, in the new numbering.

## Topic: Connect and first visit

### STORY-001: Connect Devin from the Integrations tile
**Old ID**: STORY-101  
**Gap IDs**: GAP-21, GAP-38  
**Related**: STORY-002

**Type**: medium
**Topic**: Connect and first visit
**Persona**: Priya, a founder whose engineers use Devin through Slack and Linear. She has a service-user key.
**Goal**: Connect Devin to Rakazo so she can see what Devin is working on.
**Preconditions**: Signed in, a model configured, no Devin connection in this space, a valid org-scoped key starting with `cog_`.
**Ideal path**: 5 — Integrations, Devin tile, paste key, Connect, Done. The planned sidebar entry would make this 3 steps (see STORY-002).
**Alternate paths**: (a) Sidebar "Devin" link then "Connect Devin" button [planned] (STORY-002). (b) "Add a custom connection" with the URL `https://mcp.devin.ai/mcp` and a bearer token [exists]; reaches the same server but skips the Devin preset hint. (c) Search or command palette "Devin" [planned]. (d) Asking any bot to connect Devin: none found.
#### Steps
1. Click "Integrations" in the sidebar [exists] → the catalog opens with app tiles. Priya is thinking "where is Devin?"; she scans or filters.
2. Find the Devin tile, subtitle "Coding sessions and repo docs" [exists], and click its "Connect" button (aria-label "Connect Devin") → the connection dialog opens. The tile has no logo, only a letter. She hesitates briefly: the letter tile looks less official than the others.
3. Read the dialog: title "Connect Devin", hint "An org-scoped Devin service-user key (starts with cog_)." and one field labelled "API key" [exists] → "Connect" is disabled while the field is empty. She hesitates here because she may not know where to create a service-user key. GAP: the hint says what the key is but not where to create it in Devin, and there is no link.
4. Paste the key and click "Connect" [exists] → the button shows "Connecting…" while the API lists Devin's tools to check the key, then creates the "Devin agent" bot (description "Your Devin account") with writes off [exists].
5. The dialog switches to the done view "Devin connected" with a "Done" button [exists]. The Carta equivalent adds the sentence "The Carta agent can now read your cap table."; Devin shows no such sentence. GAP: the done view does not say the Devin page now exists or link to it ("Open Devin" like Carta's "Open Cap table" is only proposed). She clicks "Done" and is back in the catalog wondering where to look. The Devin card now appears under "Connected".
#### Variations
- Priya connects, then opens the connected Devin card: today it goes to `/app/integrations/mcp/<id>` (detail page) [exists], not to the Devin page.
- Planned: the connected card gets an "Open Devin" link [planned, discovery nav item 4]. GAP: no decision on whether "Done" should land on the Devin page automatically.
#### Edge Cases
- Key with trailing spaces: the dialog trims it [exists].
- She pastes a Linear or GitHub token by mistake: handled as a rejected key (STORY-003).
- Information appears twice: the key description is on the tile hint and in the dialog; the "Connected" section repeats the status in a badge.

#### Round 2 update (mockup v3, decisions)
- **Dialog** [mockup frame 'Connect dialog']: hint unchanged ("An org-scoped Devin service-user key (starts with cog_)."), one field, and a new grey link "Where to find your key" under the field (target not observable). GAP-38 is half closed.
- **Step 5 is gone.** The caption under the frame says Connect closes the dialog and opens `/app/devin` [mockup caption; planned]. The "Devin connected" / "Done" screen is dropped from the planned path. GAP-21 resolved.
- **Ideal path: 4** (Integrations, Devin tile, paste key, Connect, then the page is open). Was 5.
- **Not drawn:** Connect disabled on an empty field, "Connecting…", rejected key, could not reach Devin. The frame shows an enabled Connect with a prefilled key.
- **New (decision: one connection per space):** the dialog does not say the connection is shared with every member or that every member will see all org sessions, and 'org-scoped' is still in the hint (GAP-50, F-STORY-001-05). If the space already has a connection, what the Devin tile and its dialog show is not drawn.
- Gap IDs now: GAP-21 resolved, GAP-38 narrowed, GAP-50 new.

#### Round 3 update (mockup v4)
- **Dialog** [frames 'Connect dialog over the page', 'connecting and refused']: 40px letter tile, title, description 'Connects Devin for everyone in this space. Read-only.', one field, the visible link 'Where to find your key', tinted footer with Cancel and Connect. 'Org-scoped' is gone and the sharing clause is in (F-STORY-001-05 resolved). The dialog is drawn over the not-connected shell.
- **States drawn:** empty (Connect disabled), connecting (field filled, Connect disabled), refused ('The key was refused' under the field, Connect enabled). The connecting frame shows no 'Connecting' label or spinner, so it reads like the empty state with a key typed (F-STORY-001-06).
- **Caption:** Connect closes the dialog and opens /app/devin [planned].
- **At a 390px browser width** the dialogs now fit (358px wide); round 2's 440px overflow is gone.

#### Round 4 update (mockup v5)
- **F-STORY-001-06 resolved:** the connecting frame labels the disabled button 'Connecting…' (no spinner drawn). 'Read-only' uses a non-breaking hyphen, so at 390px the description wraps after 'space.' and never inside the word.
- **Decision applied:** only a space owner reaches Connect; a member sees the Not connected member frame (STORY-002, STORY-031).
- Gap IDs now: GAP-38 narrowed (could-not-reach and failed-key-not-saved still undrawn), GAP-50 resolved.

### STORY-002: First visit through the sidebar link, not connected
**Old ID**: STORY-102  
**Gap IDs**: GAP-21, GAP-24, GAP-37  
**Related**: STORY-001, STORY-026

**Type**: short
**Topic**: Connect and first visit
**Persona**: Marcus, a CTO who heard from a teammate that Rakazo has a Devin page.
**Goal**: Reach the Devin page and connect from there.
**Preconditions**: No Devin connection. The planned `devin` entry is in the sidebar Pages group.
**Ideal path**: 3 — sidebar "Devin", "Connect Devin", key and Connect. It is shorter than going through Integrations (5).
**Alternate paths**: Integrations tile (STORY-001); command palette or search entry "Devin" [planned]; a Devin notification link [planned, can only exist after connecting]; mobile: none found.
#### Steps
1. Click "Devin" in the sidebar Pages group, between Data room and Artifacts [planned] → the page opens at `/app/devin` with only the header "Devin" and one "Connect Devin" button (the "Not connected" frame in the mockup). He is thinking "what does this page do?".
2. Read the page → there is no sentence about what Devin shows once connected, no tiles and no table. GAP: the Not connected state is a bare button; a first-time user sees no preview of the value. This is deliberate under the minimal-copy rule, but the mockup does not say what a visitor who has never heard of the page should learn.
3. Click "Connect Devin" [planned] → the existing dialog opens with title "Connect Devin", hint "An org-scoped Devin service-user key (starts with cog_)." and the field "API key" [exists]. The same copy appears on this surface and in the Integrations dialog (one component, so no drift).
4. Paste the key, click "Connect" → "Connecting…", then the page itself loads (STORY-004). GAP: today the dialog ends on "Devin connected" and "Done"; whether it should close straight onto the page or still show that screen when opened from the page is undecided.
#### Variations
- Marcus hides "Devin" from the Pages group with the group's "..." menu [exists for other pages], then cannot find it. GAP: no way back is described except the palette or Integrations.
- The sidebar link when not connected: GAP: discovery open question 13 (shown always, like Cap table, or hidden until connected) is undecided, and there is no dot while not connected.
#### Edge Cases
- A teammate in the same space already connected: Marcus still sees Not connected, because connections are per user [exists in code]. GAP: nothing on the page says a colleague has connected, or that his own key is needed.
- Space switch: the page reloads with that space's connection state.

#### Round 2 update (mockup v3, decisions)
- **Not connected frame** [mockup frame 'Not connected']: inside the shell, sidebar link "Devin" selected with no dot, title "Devin" with no org meta, one line "Connect Devin to see its sessions here." and one black "Connect Devin" button. Step 2's gap (a bare button) is resolved by that line. GAP-37 resolved (the link is always shown).
- An Ask button is also drawn on this frame, although no Devin agent exists before connecting (GAP-51, F-STORY-002-04).
- **Step 4 changes:** Connect closes the dialog and opens the page; no "Devin connected" screen (caption). Ideal path stays 3 for the first connector (Devin, Connect Devin, key and Connect).
- **Decision (one connection per space) supersedes the per-user edge case:** a member of a space that is already connected never sees this frame; opening "Devin" lands on the table (ideal path 1). A member who is not allowed to connect or replace the shared connection has no drawn state (GAP-50).

#### Round 3 update (mockup v4)
- **Two variants of the page:** 'a member who may connect' (one line 'Connect Devin to see its sessions here.' and the primary 'Connect Devin') and 'a member who may not connect' ('Ask a space owner to connect Devin.', no button). Ask is hidden in both. Sidebar link shown without a dot.
- **Open:** who counts as 'a space owner' and who may connect, replace or remove is undecided (GAP-50); the 'may not' frame implies owners only.
- **Step change:** the member who may not connect has no action; the path ends after reading one line (1 step).

#### Round 4 update (mockup v5)
- **Owner vs member:** 'Not connected, a member who may connect' shows the sentence and Connect Devin; 'a member who may not connect' shows 'Ask a space owner to connect Devin.' and no button. Neither frame has Ask or a sidebar number. Unchanged from v4; GAP-50 is now settled by the owner decision.

### STORY-003: Wrong or rejected key
**Old ID**: STORY-103  
**Gap IDs**: GAP-09, GAP-22, GAP-38  
**Related**: STORY-007

**Type**: medium
**Topic**: Connect and first visit
**Persona**: Dana, an engineering manager who pastes a personal Devin token instead of the service-user key.
**Goal**: Recover from the error and connect with the right key.
**Preconditions**: Not connected. The dialog is open (from the tile or the page).
**Ideal path**: 4 — paste, Connect, read the error, replace the key and Connect again.
**Alternate paths**: Cancel and ask a teammate for the right key, then reopen from either entry; "Back" does not apply to the key-only form. No alternative to create the key inside Rakazo.
#### Steps
1. Paste a wrong token and click "Connect" [exists] → the button reads "Connecting…". She expects an instant answer.
2. The API lists Devin's tools with the key; it fails, so the server and secret are removed [exists] and the dialog shows an inline error: "Could not connect to Devin. Check the API key and try again." → she knows it is the key, but not whether the key is wrong, expired, or lacks permission. GAP: one message covers a bad key, a key without session-read permission, a network failure and a Devin outage.
3. The field keeps its value (assumed from the form state; not verified) and she edits it, then clicks "Connect" again [exists] → success view as in STORY-001. Nothing was left behind by the failed attempt, so no stale card appears under "Connected".
4. Hesitation: after two failures she wonders whether Rakazo stored the bad key. GAP: the dialog does not say the key was not saved. The generic text "Credentials are encrypted and never sent to the model." exists on another view (the source form), not on this one.
#### Variations
- Empty field: "Connect" stays disabled, no error [exists].
- Key valid for a different org than expected (acme vs another org): it connects without complaint. GAP: the dialog and page never show which org the key belongs to, so Dana cannot confirm it is acme.
- Key valid but read-only on sessions is unverified; connect may succeed and the page may then fail (STORY-007).
#### Edge Cases
- Closing the dialog during "Connecting…": GAP, behavior not specified; the createdHere ref suggests cleanup but it was not verified.
- Network offline: the same error text as a rejected key.
- Error text is shown only inside the dialog; if opened from the Devin page, the page behind stays Not connected [planned].

#### Round 3 update (mockup v4)
- **Refused state drawn:** 'The key was refused' in destructive text under the field, Connect enabled so she can paste another key. The rejected-key message does not say the key was not saved, and 'could not reach Devin' is not drawn (GAP-38).
- Closing during 'connecting' is still unspecified.

#### Round 4 update (mockup v5)
- **Refused state:** 'The key was refused.' under the field with Connect enabled, drawn next to the connecting frame (390px: both dialogs 358px wide). A key refused after connecting is STORY-007.

### STORY-004: First load after connecting
**Old ID**: STORY-104  
**Gap IDs**: GAP-08, GAP-09, GAP-14, GAP-18, GAP-19, GAP-29  
**Related**: STORY-005, STORY-008

**Type**: medium
**Topic**: Connect and first visit
**Persona**: Priya (from STORY-001), now on the Devin page for the first time.
**Goal**: See her acme sessions and trust the page is current.
**Preconditions**: Connected, agent created, acme has about 8 sessions in Devin.
**Ideal path**: 2 — open the page, read the table. No further action needed.
**Alternate paths**: Arrive from the sidebar link, the palette [planned], or a notification [planned]; "Ask" opens the agent instead of reading the table.
#### Steps
1. Open the Devin page [planned] → loading state. GAP: the mockup has no loading skeleton; discovery says Legal uses `Skeleton`, but whether the four tiles and the table both skeleton is undecided. She is thinking "is it stuck?".
2. The page renders the header "Devin" with "Updated 1m ago", an external-link icon button "Open Devin" and an "Ask" button [planned] → the four tiles read Needs you 2, Working 2, PRs open 3, ACUs this week 41.6. "ACUs" is Devin jargon; she hesitates and wonders what it counts. GAP: no explanation of ACUs (discovery open question 12).
3. Read the table: columns Session, Status, Pull request, From, ACUs, Updated [planned]. Rows such as "Add CSV export for invoices" (Needs you, Slack, 3.4 ACUs, 12m ago) and "Upgrade Prisma to 6.x" (Needs you, acme/api#212 open, Linear). → she sees acme repos only through PR numbers. GAP: no repo column; repos can only be inferred from PR URLs.
4. The docked "Devin agent" panel: the mockup shows it open with a conversation; discovery open question 9 says default open or closed is undecided. GAP: first-visit state of the panel (open or closed, empty-thread intro, suggested questions) is not designed.
5. Click "Ask" [planned] → the panel opens or focuses.
#### Variations
- Information duplicated: counts for Needs you appear in the tiles, in the status badges, in the row subtitles, in the sidebar dot ("2 need you") and later in notifications.
- Click "Open Devin" [planned] → leaves Rakazo. GAP: the destination (Devin home or org) is not defined (open question 8).
- Large org: more than 100 sessions. GAP: no paging or "showing 100" indicator.
#### Edge Cases
- The page does not prove which org it shows. GAP (see STORY-003).
- Sessions started by colleagues in Slack or Linear appear without a person name; "From" shows the origin only.
- The page fetch must not use the blocking gather tool; slow Devin responses have no designed state.

#### Round 2 update (mockup v3)
- **States now drawn:** 'First visit, panel closed' (header "Devin" with org meta "acme"; tiles Needs you 2 and Working 2; five columns Session, Status, Pull request, Source, Updated; Needs you rows show the question and "Answer in Devin"), 'Loading' (skeleton: header line, two tiles, table block, no dot), and 'Load error' ("Could not load Devin sessions." with "Try again").
- **Tiles changed:** ACUs this week and PRs open are gone (GAP-18 resolved). The ACUs column is gone.
- **The panel is closed on first visit** (GAP-29 resolved); the steps that read the open panel thread no longer apply. Ideal path: 2 (connect lands on the page, read the Needs you group). Opening the panel is STORY-034.
- Titles wrap instead of clipping; the question clamps at two lines (F-STORY-004-06).
- Loading shows no sidebar dot, so the dot appears only after data loads.

#### Round 3 update (mockup v4)
- **Frames:** 'First visit, panel closed' (Ask top right, two tiles split the full row, grouped table), 'Loading' (skeleton mirrors the final layout), 'Load error' ('Could not load Devin sessions.' with Try again; Ask hidden, no dot), 'Empty'.
- **Rows:** the whole row opens the session in Devin; the title carries an external glyph; the question wraps in full under the title (no clamp). At 390px a row shows title, badge, question and time only.
- **Steps unchanged (2):** land on the page, read Needs you. Refetch and loading duration are planned and not observable.

#### Round 4 update (mockup v5)
- **No org meta:** the header is the title only ('Devin'); the org name no longer appears, so the first load changes nothing in the header between skeleton and data (skeleton shows a small placeholder next to the title).
- **First visit:** frame 'First visit, panel closed' has the intro dock behind Ask; clicking Ask opens it (F-STORY-034-01 resolved).

### STORY-005: Connected but nothing to show (empty list)
**Old ID**: STORY-105  
**Gap IDs**: GAP-15, GAP-18  
**Related**: STORY-004, STORY-028

**Type**: short
**Topic**: Connect and first visit
**Persona**: Tomas, a founder at a young startup who just got a Devin key and has run no sessions yet.
**Goal**: Understand that the connection works even though the table is empty.
**Preconditions**: Connected, zero Devin sessions in the org.
**Ideal path**: 1 — open the page and read an empty state that confirms the connection.
**Alternate paths**: Ask the Devin agent "What is Devin working on?" [planned] and read the answer; open Integrations and see the "Connected" badge [exists]. Both are indirect.
#### Steps
1. Open the Devin page right after connecting [planned] → the tiles would read 0 and the table has no rows. Tomas thinks "did this break, or is there nothing?".
2. GAP: the mockup has no empty state. Needed: a one-line statement that no sessions exist, ideally revealing that he can start them in Devin (a link to Devin), without any launch control in Rakazo. Any added text needs the copy justification in the PR.
3. He clicks "Ask" and types a question; the agent answers from an empty search → the answer is the only confirmation the key works.
#### Variations
- Sessions exist but all are older than the "this week" window: tiles show 0 for ACUs this week while the table lists rows. GAP: the window for "this week" is undefined (open question 6).
- Only Finished and Suspended sessions: Needs you 0 and Working 0; the page should still read as healthy. No design.
#### Edge Cases
- Zero tiles next to a table of old rows can look like a bug; no copy explains the window.
- Org that has Devin but whose key cannot list sessions gives an error instead of an empty list (STORY-007).

#### Round 2 update (mockup v3)
- **Empty frame** [mockup frame 'Empty']: header "Devin" with meta "acme", one centred line "No Devin sessions yet.", no tiles, no group headings, no dot, Ask visible. GAP-15 resolved.
- Not drawn: a list with only old sessions (only the Earlier group), and tiles with a zero Needs you count while other sessions exist (F-STORY-008-05).

#### Round 3 update (mockup v4)
- **Empty frame:** 'No Devin sessions yet.' with an 'Open Devin' link (external glyph); no tiles drawn. Ask stays visible because the agent exists. 'Needs you 0' with other sessions present is still not drawn (F-STORY-008-05).

#### Round 4 update (mockup v5)
- **Related state now drawn:** 'Needs you 0, other sessions present' (Needs you 0, Working 2, no Needs you group, no sidebar number). New story: STORY-039. The zero-sessions Empty frame is unchanged ('No Devin sessions yet.' and 'Open Devin'; Ask stays because the agent exists).

### STORY-006: Returning when the Devin agent is missing, no model is set, or setup failed
**Merged from**: STORY-106, STORY-306 (primary body first, merged variant below)  
**Gap IDs**: GAP-23, GAP-47  
**Related**: STORY-012

**Type**: long
**Topic**: Connect and first visit
**Persona**: Hana, an operations lead who connected Devin two weeks ago and later cleaned up her bots.
**Goal**: Use the Devin page and agent again after archiving the "Devin agent" bot.
**Preconditions**: A connected Devin server whose `agentBotId` was cleared by archiving the bot. The session list can still be read.
**Ideal path**: 3 — open the page, click the repair button, continue.
**Alternate paths**: Disconnect and reconnect from Integrations (more steps, deletes the server); open the Integrations card and reconnect; call the connect flow again — `ensureIntegrationAgent` is idempotent and makes a fresh agent, but no UI exposes that call directly [exists in API].
#### Steps
1. Hana opens the Devin page from the sidebar [planned]. The table loads normally from the server connection (assuming the page reads through its own endpoint; open question 2).
2. She clicks "Ask" [planned] → the agent is gone. Legal and Carta show a panel with a "Create agent" button and a "Try again" button (`Shell.tsx` ~3066-3100) [exists for them]. GAP: the Devin page has no equivalent designed state, and the mockup does not show one.
3. If she clicks a repair action [planned], `ensureIntegrationAgent` creates a new "Devin agent" bot with description "Your Devin account", links it with all tools allowed, makes the server exclusive to it and keeps writes off [exists]. → the panel works again.
4. She asks "What is Devin stuck on?" and gets the planned answer with "Open in Devin" links [planned].
5. If no model is configured, the panel shows "Add a model" instead of suggestions (`pageAgentNeedsModel`) [exists for other pages]. GAP: not drawn for Devin.
#### Variations
- Archiving the agent in the middle of a repair: the link step locks the bot row and a second pass creates a fresh bot [exists in `ensureIntegrationAgent`], so the user sees a retry rather than a broken link.
- Hana is in a different space: her connection and agent differ there, so she sees Not connected (STORY-002).
#### Edge Cases
- Archived agent while the page keeps showing session data: the page and panel disagree about connection state.
- A duplicate "Devin agent" appears in bot lists if a repair runs twice; the spawn key `integration-agent:<serverId>` is intended to prevent it, but this was not verified.
- Writes stay off for the new agent; forced-write tools still show a card on every call. In scope only as a reminder: Rakazo never launches or replies.

#### Merged variant from STORY-306: No model configured, agent missing, or key problem

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Sam, who just joined a space, connected Devin, and has not set up an AI model.
**Goal**: Understand why Ask does nothing useful and fix it.
**Preconditions**: Devin key valid. Variants: (A) no model configured (`needsModel` true); (B) Devin agent was archived or deleted so `agentBotId` is null; (C) agent creation failed; (D) the key was revoked after connecting.
**Ideal path**: 3 — click Ask, see the repair action in the panel, take it (Add a model, or Create agent / Try again). One step more for returning to the page.
**Alternate paths**:
- A. Open Settings, Models directly from the user menu instead of the panel button.
- B. Open Integrations, Devin and use the card there (reconnect).
- C. Recreate the agent by reconnecting Devin (the connect flow calls the idempotent `ensureIntegrationAgent`).
Duplicated information: the model prompt appears in the panel, in Settings, and may also appear in onboarding.
##### Steps
1. Sam opens the Devin page. The table loads (reading sessions needs the Devin tools, not a model). He is told nothing is wrong. [planned]
2. He clicks Ask → the panel opens. Variant A: it shows "Add a model" in place of suggestions and the composer is disabled; the button opens Settings, Models [exists for Legal, Data room and Carta via `pageAgentNeedsModel` in `Shell.tsx`; Devin needs its own branch, planned]. He thinks "I only wanted to see what Devin is stuck on" and adds a model. GAP: table works without a model, but nothing explains that the table is live while the agent is off.
3. Variant B/C: the panel shows an error and a "Create agent" or "Try again" button (Legal "Create Legal agent", Carta "Try again") [exists as a pattern; Devin helper like `findLegalAgent` is planned]. Sam clicks → the agent is created and the panel shows the composer. If it fails again, the error text stays. GAP: the Devin panel copy for these states is not drawn in the mockup.
4. Variant D: the table's refresh fails and the agent's tool step fails with an auth error. The Integrations card shows reconnect or failed [exists]. The page has no designed state. GAP: no inline "Reconnect Devin" action on the page or in the panel.
5. After the fix he asks his question and gets an answer (STORY-012). He may try the disabled composer first and wonder why typing is blocked; the disabled state needs an accessible reason.
##### Variations
- Space switch: Sam changes to another space where Devin is not connected; the page shows "Connect Devin" and the panel is absent. [planned]
- Reconnect with a new key: the agent should survive; the connection row is replaced. [unverified]
##### Edge Cases
- Model configured but quota exhausted or provider error: the thread shows a run failure like any bot. [exists generally]
- Agent exists but its server link was removed: tool steps fail with "belongs-to-agent" or unknown tool. GAP: no specific user-facing message.
- Two Devin connections in one space (two users): each has its own agent; a teammate's panel shows their own agent. [exists by spawn key per server]

#### Round 3 update (mockup v4)
- **Agent-missing frame:** page populated, panel open with only a collapse icon and a centred 'Create Devin agent' button; no composer. Ask is hidden in Not connected, Loading and Load error, so the old 'Ask with no agent' path is gone except through this panel. The no-model and failed-creation variants are not drawn (reuse the Legal and Carta branch).

### STORY-007: Key revoked or rejected after connecting (the page goes quiet)
**Merged from**: STORY-107, STORY-501 (primary body first, merged variant below)  
**Gap IDs**: GAP-04, GAP-22, GAP-24, GAP-42, GAP-44  
**Related**: STORY-003, STORY-027, STORY-028, STORY-032

**Type**: long
**Topic**: Connect and first visit
**Persona**: Leo, a developer who rotated the Devin service-user key last week; the stored key now fails.
**Goal**: Notice the connection is broken and restore it.
**Preconditions**: A connected Devin server whose key no longer works.
**Ideal path**: 3 — open the page, read the error, click reconnect, paste the new key.
**Alternate paths**: Integrations tile "Reconnect" button [exists for cards in a reconnect state]; delete and re-add the connection; the detail page `/app/integrations/mcp/<id>` [exists]. There are several paths for one repair, a redundancy signal.
#### Steps
1. Leo clicks "Devin" in the sidebar [planned]. He expects the table; he sees a failure instead.
2. GAP: the page has no designed error state for a failed fetch or a revoked key. Discovery proposes the `ErrorNotice` pattern with stale rows kept visible, but nothing says what the message or action is. The "Updated Nm ago" label would show an old time with no explanation.
3. He goes to Integrations. The Devin card shows a status badge (connected, reconnect or failed) and a "Reconnect" action [exists] → he clicks it. GAP: for an API-key connection, whether "Reconnect" opens the key dialog (no browser sign-in exists for Devin) is not shown in the code read for this topic.
4. He pastes the new key and clicks "Connect" → the same check as STORY-001; success restores the page.
5. Back on the Devin page the table is current again and "Updated 1m ago" resets [planned].
#### Variations
- Key still valid but without session-read permission: the connect-time check lists tools and passes; the first session search then fails. Unverified; maps to the same GAP as step 2.
- Revoked while the page is open: GAP, refresh behavior not specified.
- Sidebar dot for needs-you stays stale during the outage. GAP: no signal that notifications have stopped.
#### Edge Cases
- Several members connected with the same key: when one revokes it, all pages break at once.
- The Integrations badge, the page error and an eventual notification are three surfaces describing the same problem with no shared wording.

#### Merged variant from STORY-501: The Devin key was revoked and the page goes quiet

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Maya, a founder who connected Devin three weeks ago and checks the Devin page every morning.
**Goal**: Find out why the page stopped updating and get it working again.
**Preconditions**: Devin connected in the current space. A workspace admin in Devin revoked the service-user key overnight. [planned] The Devin page exists.
**Ideal path**: 6 — the page names the problem and offers Reconnect, then Reconnect leads to the key dialog.

##### Steps
1. Maya opens the sidebar link "Devin" [planned] → The page header shows "Devin" and "Updated 14h ago" [planned]. The table still shows last night's rows. She wonders whether Devin has had a quiet night.
2. She sees no new "Needs you" count and no sidebar dot [planned] → Nothing says the data is old except the small "Updated 14h ago". She almost closes the tab. GAP: the discovery file lists "key rejected or revoked" as a state the page has no design for, and the mockup has no stale-data banner.
3. She clicks "Ask" and types "What is Devin stuck on?" [planned] → The agent's search tool fails. The chat shows the tool error text from the connector, for example "Could not reach mcp.devin.ai: 401" with secrets removed [exists as connector behavior, shown in agent chat form planned]. She does not know whether "401" is her problem or Devin's.
4. Ideal: the page shows a red `ErrorNotice` line above the table, "Devin rejected the key. Reconnect to keep sessions up to date." with the button "Try again" [exists as a component; this copy is planned] → Stale rows stay visible under the notice.
5. She opens Integrations from the sidebar [exists] → The Devin card shows the badge "Connected" and no Reconnect button, because `mcpStatus` cannot see a bad bearer key. GAP: the card contradicts the page. A revoked Devin key never produces "Needs reconnect" today, so the existing Reconnect button is unreachable for Devin.
6. She clicks the Devin card, then pastes a new key in the dialog titled "Connect Devin" [exists via the card detail and `CustomConnectionDialog`] and presses "Connect" → Rakazo lists tools with the new key. On success the page refreshes and the notice clears.

##### Variations
- She opens the Devin card first (from an email from her admin) and sees "Connected", then trusts it and stops. The page and the card disagree until a fix exists.
- She removes Devin and connects again (see STORY-032). This works today but throws away the agent thread history in the Devin agent.
- The new key is also invalid → the dialog shows "Could not connect to Devin. Check the API key and try again." [exists, covered by tests]. The old, bad row is not deleted, so the page keeps showing the notice.

##### Edge Cases
- Key valid but lacks permission to read sessions: Devin may answer 403 on search while the tool list still loads. Unverified. Same GAP as step 2: the connect check lists tools, it does not read sessions, so connect succeeds and the page fails later.
- Key expires while the page is open: the next refresh turns the notice on without a reload. GAP: whether a refresh is automatic is undecided (open question 5).
- Maya is away: she gets no notification that the key broke. GAP: needs-you pushes silently stop, which looks like "nothing needs me".

#### Round 2 update (mockup v3, decisions)
- **Stale frame** [mockup frame 'Key rejected, stale data']: header "acme · Updated 4m ago" (the clock appears only because the data is stale), red "Devin rejected the key." with a "Reconnect" button, and the full table below, including the Needs input badges, "Answer in Devin" links and the sidebar dot. GAP-04 resolved for the page.
- **Still open (GAP-49):** nothing says needs-you alerts have stopped; the rows look live; what Reconnect opens is not drawn (planned: the Connect dialog); with one connection per space, who may press Reconnect is not defined. 'Could not reach Devin' uses the load-error frame.

#### Round 3 update (mockup v4)
- **Stale frame:** header 'acme · Updated 4m ago'; the notice 'Devin rejected the key. Alerts are paused.' with Reconnect takes the place of the tiles; badges, titles and links are muted; the sidebar dot is hidden; row times are at least as old as the header (14m, 9m, 12m).
- **Still drawn for everyone:** the Reconnect button and the Ask button. A member who may not replace the shared connection would see a button they cannot use, and Ask cannot read Devin (GAP-54, F-STORY-007-03, F-STORY-007-04).

#### Round 4 update (mockup v5)
- **Owner vs member (new in v5):** the owner frame shows 'Devin rejected the key. Alerts are paused.' with Reconnect; the member frame shows the same sentence and no button. Both hide Ask, mute badges and titles, show 'Updated 4m ago' beside the title and show no sidebar number (F-STORY-007-03 and -04 resolved, GAP-54 resolved).
- **Left:** the member frame does not say who can reconnect (F-STORY-007-05, suggestion). Integrations card health is build work (GAP-49).

## Topic: Monitoring sessions and needs-you

### STORY-008: Glance at the page and see what needs me
**Old ID**: STORY-201  
**Gap IDs**: GAP-03, GAP-05, GAP-08, GAP-15, GAP-18, GAP-34, GAP-37  
**Related**: STORY-004, STORY-016, STORY-021, STORY-026

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya, founder of acme, connected Devin last week
**Goal**: Learn in under 10 seconds whether any Devin session is waiting on her.
**Preconditions**: Devin connected. Two sessions in Needs you, two Working, one Error, one Suspended, two Finished.
**Ideal path**: 2 — click the sidebar "Devin" link, read the first tile and the top rows. The sidebar dot already told her before the click.
**Alternate paths**:
- Read only the sidebar dot ("2 need you") and never open the page.
- Command palette or search: type "Devin" [planned entry in `appPages`], Enter.
- Click the Rakazo notification for a needs-you session [planned], lands on the page.
- Ask the agent "What is Devin stuck on?" from the docked panel (see STORY-012).

#### Steps
1. Maya sees the dot next to "Devin" in the sidebar Pages group, between Data room and Artifacts → [exists] pages group and glance dots (`use-sidebar-glance.ts`); [planned] the Devin entry and its dot. She thinks: "Two things need me."
2. Click "Devin" → [planned] page opens at `/app/devin`. Header "Devin", "Updated 1m ago", "Open Devin" icon, "Ask" button. Skeleton first, then the table.
3. Read the tiles: Needs you 2, Working 2, PRs open 3, ACUs this week 41.6 → [planned]. The first tile matches the dot.
4. Scan the Status column: two "Needs you" badges are the top two rows → [planned]. Each shows a one-line question under the title ("Should the export keep the legacy CSV column order?").
5. She decides whether to deal with it now → continues in STORY-010.

#### Variations
- Nothing needs her: Needs you tile shows 0 and no badges. GAP: the mockup does not show the zero state of the tile or whether the sidebar dot disappears or shows a number elsewhere.
- She hides the Devin page via the Pages "..." menu [exists, `hiddenPages`]. The dot disappears with the link. GAP: does a hidden page still raise a notification? Not decided.

#### Edge Cases
- The dot count and the tile can disagree if they are computed from different fetches. GAP: the design does not say whether both come from one cached result.
- "ACUs" is Devin jargon. Maya hesitates at "ACUs this week" and does not know if 41.6 is good. GAP: no tooltip or definition, and "this week" has no defined window (rolling 7 days vs calendar week; open question 6).

#### Round 2 update (mockup v3)
- **Glance** [mockup frame 'First visit, panel closed']: the Needs you tile is the only amber element (border and value 2), the Needs you group is first, the sidebar dot has no number, and the group headings carry no count. Ideal path stays 2.
- **Naming:** group and tile say "Needs you", the row badge says "Needs input", the toast says "Devin has a question" (F-STORY-008-06).
- Not drawn: Needs you 0 with other sessions present. GAP-18 resolved (two tiles only).

#### Round 3 update (mockup v4)
- **Failed sessions are under 'Needs you'** with the destructive 'Error' badge and are counted in the tile (3 = 2 Needs input + 1 Error). One vocabulary: group and tile 'Needs you', badge 'Needs input' or 'Error', toast 'Devin needs input'. The group heading carries no number; the tile is the only count.
- The Error row has no reason (GAP-26) and, per GAP-42, no notification.
- Glance cost unchanged at 2 steps; the amber tile and dot lead.

#### Round 4 update (mockup v5)
- **Count glance:** the sidebar Devin link shows the live needs-you number (3 on the populated frame, 2 on 'Partial results', none on frames with 0, on loading and on key rejected); it always equals the Needs you tile (Error rows count). The link name is 'Devin 3 need you'.
- **No org meta:** the header is the title only.
- **New frames:** 'Needs you 0' (F-STORY-008-05 resolved; STORY-039), 'Unknown status' (STORY-040; F-STORY-008-07: tile says Working 2 while one row is Working), 'Partial results' (STORY-041), 'A session with two pull requests' (STORY-042).

### STORY-009: Read the status of every session
**Old ID**: STORY-202  
**Gap IDs**: GAP-03, GAP-17, GAP-26, GAP-36  
**Related**: STORY-029, STORY-030

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Theo, engineering lead at acme
**Goal**: Understand what each of the 8 sessions is doing and which ones are healthy.
**Preconditions**: The mockup dataset: 2 Needs you, 2 Working, 2 Finished, 1 Error, 1 Suspended.
**Ideal path**: 1 — read the table top to bottom; the Status badge is the only thing he needs.
**Alternate paths**:
- Ask the agent "Which sessions failed?" (Error rows) and read its answer.
- Open each session in Devin to see the real state (slow, defeats the page).
- GAP: no sort or filter control exists on the table in the mockup, so there is no alternate "filter to Error".

#### Steps
1. Open the page → [planned] table, newest activity first in the mockup (1m ago, 3m ago, 12m ago... but not strictly: the Needs you rows at 12m and 1h are above the Working rows at 1m and 3m). He notices the order is by status group, then time. GAP: the sort rule is not stated.
2. Read badges: "Needs you", "Working", "Finished", "Error", "Suspended" → [planned]. Colors are monochrome with warning/success/destructive tones.
3. He checks "Migrate billing webhooks to the new queue" with "Error" and "Yesterday" → [planned]. He thinks: "Error from what? Did a deploy break?" The row has no reason text. GAP: Devin's `status_detail` may carry a reason, but the mockup shows none and the status mapping is unverified.
4. He checks "Rewrite onboarding copy" "Suspended", 2d ago → [planned]. He wonders: "Suspended because of a limit, or because nobody replied?" GAP: no explanation of Suspended and no indication whether it is recoverable.
5. He checks "Finished" rows with PRs: "Fix flaky invoice export test" acme/web#418 merged; "Bump Expo SDK" acme/mobile#97 open → [planned]. Finished with an open PR means a human still has to review it; the table does not call that out.

#### Variations
- A session Devin marks finished but with a status_detail suggesting it is waiting for approval: the mapping to Needs you vs Finished is unverified. GAP: the design has no rule for ambiguous status/status_detail pairs.
- Status values the mapping does not know (new Devin status): GAP: no fallback badge is defined. Showing a raw string would break the five-badge vocabulary.

#### Edge Cases
- Badge text alone carries meaning on small screens; color-blind users rely on the words, which is fine.
- Session with no title: GAP: fallback label not defined (discovery lists this as a state).
- Origin "other", "jira", "teams", "cli" and others do not appear in the mockup's From values (Slack, Linear, Web, API). GAP: mapping from Devin `origin` (webapp, slack, teams, api, linear, jira, automation, cli, desktop, code_scan, other) to the labels shown.

### STORY-010: Decide what to do about a needs-you session
**Old ID**: STORY-203  
**Gap IDs**: GAP-01, GAP-06, GAP-10, GAP-13, GAP-19, GAP-20, GAP-45  
**Related**: STORY-012, STORY-018, STORY-021

**Type**: long
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya, founder, not an engineer; teammate Jorge is the tech lead
**Goal**: Get Devin unblocked on "Add CSV export for invoices" without Rakazo being able to reply.
**Preconditions**: Row says "Needs you", question "Should the export keep the legacy CSV column order?", origin Slack, 12m ago, no PR.
**Ideal path**: 3 — read the question on the row, click the title to open the session in Devin, answer there. The question is on the row, so she does not need the agent.
**Alternate paths**:
- Click "Open in Devin" in the agent's answer instead of the row title.
- Click the header "Open Devin" icon, then find the session in Devin's own list (more steps, no deep link).
- Forward the question to Jorge (copy the question text, send in Slack/email by hand). GAP: there is no "share" or "copy link" control on the row.
- Open the Slack thread where the session started (origin is Slack) and answer there. Rakazo has no link to that thread. GAP: Devin's Slack origin thread link is not in the MCP fields.
- Ignore it. The row stays "Needs you" and the dot stays lit.

#### Steps
1. Maya opens the page from the notification [planned notification; notification path exists] → [planned] page, with the top row highlighted by position only. GAP: no row highlight or scroll-to for the session named in the notification.
2. She reads the row: "Add CSV export for invoices", Needs you, "Should the export keep the legacy CSV column order?" → [planned]. She thinks: "I do not know what legacy order means. Jorge would."
3. She hesitates: the page has no reply box. She looks for one and finds only the "Ask" button → [planned]. She learns that asking the agent only explains; it cannot answer Devin. GAP: nothing on the page says "answer this in Devin". The only cue is the missing control. The AGENTS.md copy rule discourages explainer text, so the design needs to decide whether the link label (e.g. "Open in Devin") carries that meaning.
4. She clicks the session title → [planned] opens Devin session in the system browser (Electron: via `app-opener.ts` [exists]). GAP: the session URL shape is unverified (open question 7); the `url` field comes only from the gated `get` call.
5. In Devin she may need to sign in again. She types "Keep the legacy order for now" and sends → happens outside Rakazo.
6. She returns to Rakazo. The row still says Needs you → [planned]. She thinks: "Did it go through?" The header says "Updated 1m ago". She hesitates about whether to wait.
7. After the next refresh the status becomes Working, the tile drops from 2 to 1, and the sidebar dot count changes → [planned]. GAP: refresh cadence is undecided (open question 5), so the delay between answering and the page changing is unknown. She cannot force a refresh in the mockup. GAP: no refresh control.

#### Variations
- She does not know the answer. She forwards to Jorge and leaves the row. Next morning it is still Needs you. GAP: no age cue beyond "Updated 12m ago", no reminder or escalation.
- The question needs context (a long thread). The row shows one line. GAP: truncation behavior and whether the full question is readable on the page are not defined; the MCP returns truncated bodies.
- Question text could not be fetched (message read gated or failed): the row shows a title and "Needs you" without a subtitle. This matches the unresolved gate on `devin_session_interact` get_messages (`packages/contracts/src/devin.ts` lines 32-34).

#### Edge Cases
- Session answered in Slack, not Devin: status leaves Needs you on the next refresh with no Rakazo-side record.
- Two people open the same session; one answers, the other still sees Needs you until the refresh.
- Devin asks a second question after the first answer: the row returns to Needs you with new text. A "needs you" notification for the same session needs a dedupe key per question, otherwise the second ask could be swallowed by the 24h dedupe (discovery, Data Entities).

#### Round 2 update (mockup v3, decisions)
- **The row now has an explicit action:** under the question (two-line clamp) a link "Answer in Devin" with an external icon, plus the title link. Target not observable (both are '#'). GAP-20 and GAP-45 resolved.
- **Ideal path: 2** (spot the row in the Needs you group, click "Answer in Devin"; Devin opens in the system browser, STORY-033 step 4). Was 3.
- **Read-only decision:** there is no reply control and no write option anywhere; the answer is given in Devin only.
- Not drawn: any sign on the page that the answer landed (refetch rule, GAP-13). Row hover highlights the whole row though only the links are clickable (F-STORY-010-05).

#### Round 3 update (mockup v4)
- **Step 2 changed:** there is no 'Answer in Devin' link. The whole row is the one link (every cell of the row resolves to the title anchor; one tab stop per row; row height 38px or more). The title carries an external glyph and the question shows in full under it.
- **Keyboard:** the focus ring wraps only the title (about 159x18px) while the click target is the whole row (F-STORY-010-06).
- Planned and not observable: the click opens the session in Devin; the page draws no sign that the answer landed (refetch rule, GAP-13).

#### Round 4 update (mockup v5)
- **Keyboard focus** now rings the whole row (F-STORY-010-06 resolved); the ring touches the first letters of the title and question (F-STORY-010-07, suggestion).
- **Still true:** the whole row is one anchor (linksPerRow 1; every cell resolves to it); wait time is only the Updated column (F-STORY-010-03).

### STORY-011: Stale data and refresh
**Old ID**: STORY-204  
**Gap IDs**: GAP-02, GAP-08, GAP-13, GAP-14, GAP-30, GAP-34  
**Related**: STORY-025, STORY-027

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Theo
**Goal**: Know if the page is current before he tells the team "nothing is blocked".
**Preconditions**: Page open in a tab for 45 minutes; the header still reads an old time.
**Ideal path**: 2 — look at "Updated Nm ago"; if old, reload the page. There is no refresh button.
**Alternate paths**:
- Wait for automatic refresh (cadence undecided).
- Switch to another sidebar page and back (remount triggers a fetch, probably).
- Ask the agent "What is Devin stuck on?", which reads Devin live and may contradict the table.
- Open Devin directly.

#### Steps
1. Theo returns to the tab and reads "Updated 46m ago" next to the title → [planned]. He thinks: "So Needs you 0 may be old."
2. He looks for a refresh control. None in the mockup → [planned]. GAP: no refresh button, pull-to-refresh, or auto-refresh indicator defined.
3. He reloads the browser tab → [exists] browser reload; [planned] page refetches; header returns to "Updated 1m ago" or "Updated just now". GAP: copy for under one minute is not defined.
4. Counts change: Needs you 0 to 1 → [planned]. The sidebar dot, which updates on its own schedule, may have shown the new count earlier than the page did. Two clocks (header vs sidebar glance) can disagree.

#### Variations
- Fetch fails on refresh: previous rows stay with an `ErrorNotice` [pattern exists in `components/finance/ui`]. GAP: does "Updated Nm ago" keep counting up (honest) while the error shows? Not defined.
- The per-row "Updated" column shows Devin's `updated_at` (e.g. "12m ago") while the header shows Rakazo's fetch time. A user may confuse them. GAP: no label explains the difference.
- Agent says one thing, table another: the agent reads live, the table is cached (tool calls in the chat show "Searched Devin sessions"). GAP: no rule for which wins.

#### Edge Cases
- Laptop sleeps overnight; the page wakes with stale rows and no automatic refetch.
- Rate limit from Devin on refresh: behavior unknown (discovery: "Rate limit / slow response from Devin: unknown").
- The tool `devin_session_gather` blocks up to 590s and must not be used for page loads (Research); a slow list call must not freeze the page. GAP: loading state for a slow refresh with data already shown.

#### Round 2 update (mockup v3)
- The header shows "Updated Nm ago" only on the stale frame; normal frames show only the org name. GAP-34 resolved. No refresh control or cue is drawn (GAP-13 stays open).

### STORY-012: Ask the agent what Devin is stuck on
**Merged from**: STORY-301, STORY-205 (primary body first, merged variant below)  
**Gap IDs**: GAP-01, GAP-07, GAP-10, GAP-16, GAP-19, GAP-20, GAP-23, GAP-25, GAP-29, GAP-30, GAP-31, GAP-45  
**Related**: STORY-006, STORY-010, STORY-017, STORY-018, STORY-020, STORY-033

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Maya, a founder who connected Devin last week and sees "2 need you" on the sidebar dot.
**Goal**: Find out in plain words what Devin is waiting for, without opening Devin.
**Preconditions**: Devin connected, Devin agent exists, a model is configured, the Devin page shows two Needs you rows (Add CSV export for invoices, Upgrade Prisma to 6.x). Panel closed, window 1440px wide.
**Ideal path**: 3 — click Ask (panel opens), type or pick the question, read the answer. The table already shows the question text under each Needs you row, so the true minimum for this goal is 0 clicks (read the table); the agent path is for people who want the answer in a sentence.
**Alternate paths**:
- A. Read the question text under the title in the Needs you rows of the table (0 clicks, [planned]; depends on the open question that `get_messages` is a forced write today, so this subtitle may not exist).
- B. Click the row title, which opens the session in Devin (external).
- C. Click the "Needs you" tile [planned; whether the tile filters the table is not drawn].
- D. Open the Devin agent as a normal bot thread from the bot list, then ask there (full screen, no table beside it) [exists once the bot exists].
- E. Use the "Open in Devin" link in the agent's answer.
Duplicated information: the same question text appears in the table subtitle and in the agent's reply; the session list appears in the table and in the agent's search step.
#### Steps
1. Maya sees "Devin" in the sidebar with a dot and thinks "2 need me, but what do they want?" She clicks it → the page loads with tiles (Needs you 2, Working 2, PRs open 3, ACUs this week 41.6) and the table. [planned]
2. She glances at the two Needs you rows. The subtitle under "Add CSV export for invoices" reads "Should the export keep the legacy CSV column order?" She hesitates: is that the whole question, or cut off? → no way to expand in the table. [planned] GAP: the mockup subtitle is single-line with ellipsis; there is no designed way to see the full message besides opening Devin or asking the agent.
3. She clicks "Ask" in the page header → the docked "Devin agent" panel opens at 384px on the right. [planned button; the docked-panel pattern exists for Legal and Cap table in `Shell.tsx`]
4. The panel shows the composer "Message Devin agent" (and, per the open question, maybe suggestions). She types "What is Devin stuck on?" and sends → the thread shows her message with a timestamp. [exists: thread; planned: Devin copy]
5. While the agent works she sees a collapsed activity line, then "Done · 2 tools · 4s" with "Searched Devin sessions" and "Read Devin messages ×2". → read-only tool steps render. [planned in mockup; the step labels come from `humanizeToolName`, exact Devin labels unverified]
6. The reply lists both sessions with one sentence each and an "Open in Devin" link per session. She thinks "good, that matches the table" and clicks the link for Prisma → the session opens in Devin in the system browser (Electron: via the app opener). [planned]
7. She closes the panel (collapse button) → table returns to full width; the sidebar dot is unchanged because the session still needs her answer in Devin. [exists: collapse; dot behavior planned]
#### Variations
- Asking the same thing by a suggestion chip instead of typing (if the Devin panel gets suggestions; [unverified] — the Carta and Data room panels pass `suggestions`, Legal does not).
- Window narrower than 1280px: the panel overlays the page instead of docking (see STORY-033).
- Panel already open: the Ask button is hidden (Legal passes `onAskAgent` only when the panel is closed). [exists as a pattern]
#### Edge Cases
- Reading Devin's last message needs `devin_session_interact` get_messages, a forced write today. With changes off the agent cannot call it, so the reply may say it can see titles and status but not the question text. GAP: no designed fallback wording or UI for "I can see the session needs you but cannot read what it asks".
- With changes on, each message read would show an approval card (see STORY-018), turning a read question into two approvals. GAP: unresolved until the gate is split into read and write paths.
- Devin returns more than 100 sessions: the agent sees only the first page. GAP: no statement of how the agent says "I only looked at the latest 100".

#### Merged variant from STORY-205: Ask the agent instead of reading the table

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya on her phone browser at a narrow width (under 1024px)
**Goal**: Get a plain-language summary of what is blocked.
**Preconditions**: Devin connected; a model configured.
**Ideal path**: 3 — open the page, tap "Ask", type or pick a question. The panel overlays the page below 1280px.
**Alternate paths**:
- Open the Devin agent as a normal bot thread from the bot list [exists] (no page needed).
- Read the table directly (STORY-008).
- Use the dock's open-full-screen button (icon in the panel header, Cap table pattern).

##### Steps
1. Tap "Ask" → [planned] panel opens (docked at 1280px and wider, overlay below) [exists as a pattern for Legal and Cap table].
2. Type "What is Devin stuck on?" → [planned] the agent runs "Searched Devin sessions" and "Read Devin messages ×2". Tool disclosure reads "Done · 2 tools · 4s".
3. Answer lists the two sessions with their questions and an "Open in Devin" link each → [planned].
4. She compares the answer to the table: same two sessions, same question text. Match reassures her.
5. She taps "Open in Devin" → leaves Rakazo, same as STORY-010 step 4.

##### Variations
- Without a model configured, the panel says "Add a model" instead of suggestions [exists for page agents, `pageAgentNeedsModel`].
- The gate for message reads: if `get_messages` stays a forced write, an approval card appears in the chat each time. GAP: Maya sees an approval card for a read-only question. Open question 1.
- Maya asks "Reply yes to Devin": the agent has no write path (writes off by default, forced-write tools need approval). GAP: what the agent says is not designed. It should point to Devin without apologizing at length.

##### Edge Cases
- The agent's wording of a question can differ from the row subtitle. Same information, two phrasings.
- Mobile app: no native Devin screen is planned. GAP: open question 11, the phone behavior for this story is undefined.

#### Round 2 update (mockup v3)
- The panel is closed on first visit and opens from Ask: docked at 1280px and wider, overlay below. Ask is hidden while the panel is open at every width tested (1440, 1100, 900, 390).
- Because the question text is now in the Needs you rows with "Answer in Devin", asking "What is Devin stuck on?" is no longer needed to read a question. The agent stays for what the table cannot show ("Anything merged today?", one repo's week). Ideal path to see what needs me: 0 asks.
- Tool rows read "Session search" and "Session get messages ×2". No suggestion chips are drawn and the first-open state is not drawn (GAP-51).

#### Round 3 update (mockup v4)
- **Panel states drawn:** first Ask (intro 'Answers questions about what Devin is working on.' with two suggestions), running turn ('Working... · 1 tool' with a stop button), populated thread, 'cannot read the question' ('I can't read that question. Open Add CSV export in Devin'), and agent missing.
- **Agent links** name the session ('Open Add pagination in Devin') and carry the external glyph.
- **New:** the 'cannot read' frame sits beside a table that displays that same question, so the two disagree (F-STORY-012-09).

#### Round 4 update (mockup v5)
- **Removed frame:** the 'agent cannot read the question' panel is gone. Decision: the agent has read tools only (Session search) and questions are shown on the page only, so the agent never quotes a question; its answers name sessions and link to them ('Open Upgrade Prisma in Devin'). F-STORY-012-09 resolved.
- **First visit:** Ask on the closed first-visit frame opens the intro with two suggestions (STORY-034).
- **Still open:** collapse icon 28x28 (F-STORY-012-05).

### STORY-013: Follow the PRs
**Old ID**: STORY-206  
**Gap IDs**: GAP-16, GAP-18, GAP-35  
**Related**: STORY-017

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Theo
**Goal**: Find which Devin PRs await review.
**Preconditions**: Rows with acme/api#212 open (Needs you), acme/api#215 open (Working), acme/mobile#97 open (Finished), acme/web#418 merged.
**Ideal path**: 2 — read the "Pull request" column and the "PRs open" tile (3), then click the PR link.
**Alternate paths**:
- Go to GitHub's PR list and filter by author (not through Rakazo).
- Ask the agent "Anything merged today?" and click the PR in the answer.
- Open the session in Devin and use its PR link.

#### Steps
1. Read tile "PRs open 3" → [planned]. He counts the open PRs in the column: 212, 215, 97, which matches.
2. Click "acme/api#215" → [planned] opens GitHub in the system browser (Electron via `app-opener.ts` [exists]).
3. He notices #212 belongs to a Needs you session: the PR exists but Devin is stuck on migrations. He wants both facts together and finds them in the same row → [planned].
4. He notices #97 is open on a Finished session: Devin considers itself done; review is on him → [planned]. No cue distinguishes Finished-with-open-PR from Finished-and-merged beyond the small "open"/"merged" text.

#### Variations
- A session with multiple PRs: Devin returns a `url[state]` list. GAP: the row shows one PR slot; how several PRs display is undefined.
- A PR was closed without merging: states other than open and merged. GAP: only "open" and "merged" appear in the mockup.
- PR for a repo other than acme/web, acme/api, acme/mobile: repo is inferred from the PR URL only; no repo field exists (Research). GAP: sessions without PRs show "—" and no repo at all, so a user cannot tell which repo a Working session touches.

#### Edge Cases
- "PRs open" counts only what the fetched page includes. With over 100 sessions the tile can undercount (open question 6).
- A PR merged after the last refresh still shows "open" until the next fetch.

### STORY-014: Many sessions and a long list
**Old ID**: STORY-207  
**Gap IDs**: GAP-08, GAP-16, GAP-17, GAP-18, GAP-25, GAP-30  
**Related**: STORY-029

**Type**: long
**Topic**: Monitoring sessions and needs-you
**Persona**: Priya, CTO at a bigger acme, 140 sessions in the last month, 7 Needs you
**Goal**: Find the sessions that need her without scrolling past hundreds of old ones.
**Preconditions**: Devin returns up to 100 sessions per call with a cursor; no status filter in the search tool.
**Ideal path**: 2 — rely on the Needs you rows being grouped at the top and read the tile. GAP: this depends on a sort rule that is not specified.
**Alternate paths**:
- Ask the agent "List everything that needs me" (agent can page).
- Scroll the table and read badges.
- Use Devin's own list.
- GAP: no search, filter, or "load more" control in the mockup, so there is no on-page way to narrow.

#### Steps
1. Open the page → [planned] first request fetches the newest 100 sessions only. Tiles are computed from them. Priya sees "Needs you 7".
2. She scrolls. The table is long; the header does not stay in view in the mockup → [planned]. GAP: sticky header and pagination or virtualization are undefined.
3. A session needing her started 5 weeks ago and sits beyond the first 100 → it appears in neither the table nor the tile. She thinks the page is complete. GAP: no "showing 100 of N" signal; discovery lists "Truncated or over-100 session list" as a needed state.
4. She asks the agent, which searches again with a different filter and finds the old session → [planned]. The agent knows more than the page. Mismatch between tile (7) and agent (8).

#### Variations
- Needs-you detection by `tags` or `origins` filters, which exist in the search tool, is an option for the backend. GAP: not part of the page design.
- ACUs this week across 140 sessions: sessions that began last week and consumed ACUs this week may be miscounted if the tile sums `acus_consumed` of the whole session.
- Dozens of Finished sessions bury Working ones if sorted purely by time. GAP: sort rule.

#### Edge Cases
- Cursor expires between pages.
- Very long titles: fixed column widths (31% for Session) truncate or wrap; the mockup tests only short titles.
- Narrow widths (1024-1279px, below 1024px): 6 columns and 4 tiles need a collapsed list layout (Legal pattern `@container`).

### STORY-015: Teammate sessions and "who started this"
**Old ID**: STORY-208  
**Gap IDs**: GAP-09, GAP-12, GAP-31, GAP-36  
**Related**: STORY-023, STORY-031

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya (connector); Jorge and Amara are teammates who start Devin sessions in Slack and Linear
**Goal**: Know whether a Needs you row is her responsibility or Jorge's.
**Preconditions**: Org-scoped key, so the page lists every org session. The `user_id` returned by Devin is opaque, with no name or email.
**Ideal path**: 3 — read the "From" column (Slack, Linear), then ask Jorge in person. The page cannot name him.
**Alternate paths**:
- Open the session in Devin, which shows who started it (outside Rakazo, if Devin shows it).
- Ask the agent "Whose session is Prisma upgrade?". The agent only has the opaque id. GAP: no way to resolve it.
- Teammate connects their own key and sees the same org list [per user connection].

#### Steps
1. Maya sees "Upgrade Prisma to 6.x", Needs you, From "Linear" → [planned]. She hesitates: "Did I start this? The question is for whoever owns the migrations."
2. The "From" column says where it started, not who → [planned]. She thinks of Jorge from context ("Linear, probably Jorge").
3. She opens the session in Devin and sees the real owner there → outside Rakazo.
4. She pings Jorge → outside Rakazo.

#### Variations
- A teammate who does not have a Devin connection: sees "Not connected" with "Connect Devin" (per-user connection [exists in code: `McpServer` scoped to space and user]). Their page does not show the Needs you rows, and they receive no notification.
- Maya is the only connector, so only Maya gets the "needs you" notification, even for sessions started by Jorge. GAP: open question 5 (who is notified).
- Privacy: a session title like "Fire the contractor" is visible to every connector in the org. GAP: open question 3 (scope label or filter).

#### Edge Cases
- Automation or code_scan origins have no human behind them; "From" would show an unmapped value. GAP: label for those origins.
- A teammate leaves acme; their sessions still appear with an id no one recognizes.

### STORY-016: Dot and notification stay in step with the table (clearing the dot)
**Merged from**: STORY-209, STORY-403 (primary body first, merged variant below)  
**Gap IDs**: GAP-05, GAP-07, GAP-08, GAP-13, GAP-41  
**Related**: STORY-008, STORY-021, STORY-023, STORY-026

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya
**Goal**: Trust that the dot means something, and that it clears once she has answered.
**Preconditions**: Two sessions Needs you; she answers one in Devin.
**Ideal path**: 2 — answer in Devin, return, see the dot and tile drop to 1.
**Alternate paths**:
- Open the notification and dismiss it without answering (dot stays).
- Mark the notification read from the notifications list [exists]; the Devin dot stays lit because it counts sessions, not notifications. GAP: the design does not say if the dot counts sessions or unseen notifications. The existing glance dots count unseen notifications by surface (`surfaceOfPath` regex), which would clear on viewing even when the session still needs her.

#### Steps
1. A session turns Needs you → [planned] notification with link to `/app/devin` and a dot on "Devin" [exists as a mechanism; needs the Devin surface entry in `defaultNotificationSurface` and `surfaceOfPath`].
2. She opens the page → [planned]. If the dot counts unseen notifications, it clears on open although the session still waits. Opening the page and leaving makes her think she handled it.
3. She answers one in Devin and returns → [planned] after refresh, tile 1, badge gone for that row.
4. The second session stays Needs you. The dot (if tied to sessions) stays lit with "1 needs you".

#### Variations
- The same session asks a second question: new notification only if the dedupe key includes the question.
- Mobile: the push arrives but the link target is undefined (open question 11).

#### Edge Cases
- Notification for a session that is already Working again by the time she taps it: page shows no Needs you row. GAP: the notification has no "already answered" state.

#### Merged variant from STORY-403: Clearing the dot (and the dot that clears too early)

**Type**: short
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, glancing at the sidebar.
**Goal**: Understand when the Devin dot goes away and trust it.
**Preconditions**: One unseen `devin` notification; the row in Devin is still "Needs you".
**Ideal path**: 2 — open the Devin page; dot clears. This is the only designed behavior.
**Alternate paths**:
- A. Open the Devin agent thread instead of the page: clears every unseen notification from that bot (`markSeen({ botId })`), 3 steps.
- B. Visit the page in a background tab: nothing clears until the tab is visible and focused (`useAttended`).
- C. Answer in Devin without opening Rakazo: the dot stays (no clearing on resolution).
##### Steps
1. [planned] She sees a dot on "Devin" (title "2 need you" in the mockup) → she reads it as "something needs me".
2. [exists] She clicks the row → on route change `unseenCounts` refreshes and, with the tab attended, `markSeen({ surface: "devin" })` runs and the dot goes out [planned: needs `devin` in `surfaceOfPath`].
3. [planned] She sees the table. The dot is gone but the "Needs you" tile still reads 2. She thinks the dot and the tile should agree. They do not: the dot means "unseen notification", the tile means "sessions currently blocked".
4. She leaves the page without answering. The sidebar now shows no dot while two sessions still need her. GAP: no persistent indicator of "still needs you" after the first visit; the design has only the unseen dot, and the plan says nothing about a glance value for Devin (other pages have counts like Inbox unread, Legal due soon). Candidate: a glance count for Devin, not designed.
5. She answers one session in Devin. The tile and row update only when the page next loads or refreshes (see STORY-025). Nothing clears because the dot is already gone.
##### Variations
- Dot with count: mockup shows a dot only, not a number; the title text "2 need you" is a hover label. Whether the dot title is generated from the live count is unspecified. GAP.
- Rail (collapsed sidebar, >= 1024 px): dot remains on the icon.
##### Edge Cases
- She clicks the toast for session A, which marks only that notification seen; the sidebar dot for session B (a second notification, same surface) clears too, because surface-level `markSeen` clears all `devin` notifications. She never saw B's question. GAP: opening the page marks every Devin notification seen, even for sessions she did not read.
- Dot appears after a refresh while she is on the page: attended + on surface, so it is cleared on the same render. She sees a flicker at most.

## Topic: Asking the Devin agent

### STORY-017: Ask about history across a repo and a week
**Old ID**: STORY-302  
**Gap IDs**: GAP-17, GAP-18, GAP-30, GAP-31, GAP-35  
**Related**: STORY-012, STORY-013, STORY-020

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Jonas, an engineering lead who wants a Friday summary.
**Goal**: Learn what Devin did on acme/api this week and what was merged today.
**Preconditions**: Same as STORY-012; sessions with PRs `acme/api#212` (open), `acme/api#215` (open), `acme/web#418` (merged), `acme/mobile#97` (open).
**Ideal path**: 3 — Ask, type the question, read the answer; the page table cannot be filtered by repo, so the agent is the only direct route.
**Alternate paths**:
- A. Scan the table's "Pull request" column by eye for "acme/api#" (the table has no repo filter or search field in the mockup). Works only if the list is short.
- B. Ask "Anything merged today?" instead; the table shows "merged" next to acme/web#418 so a user can also spot it by eye.
- C. Use the "PRs open" tile for the open count only; it says nothing about merged.
- D. Open Devin itself and use its own filters (external).
Duplicated information: PR state appears in the table's Pull request column, in the "PRs open" tile, and in the agent's answer.
#### Steps
1. Jonas has the page open and opens the panel with Ask → panel docks. [planned]
2. He types "What did Devin do on acme/api this week?" He wonders if "this week" means the last seven days or since Monday. → the agent decides; the page and the agent may use different windows from the "ACUs this week" tile. GAP: "this week" has no single definition (open question 6 in discovery), so the tile and the agent can disagree.
3. The agent runs "Searched Devin sessions" (read) → the step line shows the tool and a duration. The search tool has no repo field, so repo is inferred from PR URLs. [exists as research fact; agent behavior unverified]
4. The reply lists sessions that have an `acme/api` PR (Upgrade Prisma to 6.x, `acme/api#212` open; Add pagination to the audit log API, `acme/api#215` open) and says sessions without a PR cannot be matched to a repo. → Jonas thinks "what about sessions with no PR yet?" and asks a follow-up. GAP: no designed way for the agent to flag "could not tell the repo".
5. He asks "Anything merged today?" → one step "Searched Devin sessions", reply "One pull request: acme/web#418, the flaky invoice export test fix." [planned, from the mockup]
6. He compares with the table: Fix flaky invoice export test shows "merged" and "2h ago" → consistent. He is mildly annoyed that he could have read it there. Note for design: the second question duplicates what the table shows.
#### Variations
- Same question after a refresh with new data: the agent searches again; the table shows "Updated 1m ago" and the answer may be newer than the table. GAP: no sign in the thread of how fresh its data is.
- Ask by session title ("What is the state of Bump Expo SDK?"): agent matches by title; same read steps.
#### Edge Cases
- Zero matches ("What did Devin do on acme/billing this week?"): the agent says it found no sessions. [unverified wording]
- Merged state comes from the PR list text `url[state]` in the search result [exists as research]; if state is missing the agent cannot say merged.
- Question names a person ("What did Priya ask Devin?"): research found only an opaque `user_id`, no names. GAP: the agent cannot answer by person and has no designed way to say so.

### STORY-018: Ask the agent to tell Devin something (write request)
**Old ID**: STORY-303  
**Gap IDs**: GAP-10, GAP-32  
**Related**: STORY-010, STORY-012, STORY-019

**Type**: long
**Topic**: Asking the Devin agent
**Persona**: Maya again, answering the CSV question without leaving Rakazo.
**Goal**: Tell the "Add CSV export for invoices" session to keep the legacy CSV column order.
**Preconditions**: Devin connected, agent exists, model set. Case A: "Allow changes in Devin" is off (the default, `writesEnabled: false`). Case B: the user turned it on.
**Ideal path**: Case B: 5 — Ask, type request, read the approval card, click "Allow once", read the confirmation. Case A: not achievable in Rakazo; the right path is the Open in Devin link (2 clicks: Ask answer link, answer in Devin).
**Alternate paths**:
- A. Click the session title or "Open in Devin" and answer in Devin directly (works in all cases and is the scope-consistent route: the page itself never sends).
- B. Answer in Slack where the session was started (origin "Slack" in the From column) [outside Rakazo].
- C. Another bot asks the Devin agent to send it (see STORY-019); still lands on the same approval card.
Duplicated information: the approval card repeats the session id and the message text the user typed; the agent's reply repeats the card outcome.
#### Steps
1. Maya reads the question under the session in the table, decides "yes, keep legacy order", and opens the panel with Ask. [planned]
2. She types "Tell Devin to keep the CSV order" and hesitates over wording: should she name the session? She does not. → the agent has to pick the session; it likely searches and finds "Add CSV export for invoices". [unverified]
3. Case A (changes off): the write tool is not offered to the agent (filtered when `writesEnabled` is false). The agent can only explain. The `devin-sessions` skill tells it to say she can turn on "Allow changes in Devin" under Integrations, Devin [exists, `builtin-skills.ts` step 6]. → she sees text, no card. She thinks "this is the page that is supposed to be read-only, but the agent talks about changing things". GAP: the page promises read-only, yet the agent offers a write setting; the product has not decided whether the Devin agent in the page panel should ever send messages.
4. Case A continued: she follows the pointer to Integrations, Devin, flips "Allow changes in Devin" → on. She returns to the page and asks again. [exists for the switch; the round trip is long]
5. Case B: the agent calls `devin_session_interact` (action: message). The approval card appears in the thread: title "Review before ..." (summary from `describeApprovalAction`), a detail block with `tool: ...`, `server tool: devin_session_interact`, and the JSON arguments including the session id and message text; buttons "Allow once" and "Deny" ("Always allow this tool" is not offered for integration writes). [exists, `approval-ask.ts` lines 95-105 and `integrationWriteDetail`]
6. She reads the raw JSON arguments and hesitates: it is developer-looking, and she is not sure the message says what she meant. GAP: the card shows the arguments as JSON, not a plain sentence like "Send to 'Add CSV export for invoices': keep the legacy column order".
7. She clicks "Allow once" → the card changes to answered; the tool runs; the agent replies that the message was sent. [exists: card; Devin-specific wording unverified]
8. She goes back to the table. The row may still say Needs you until Devin reads the message. Refresh behavior is undecided. GAP: no defined way for the page to reflect "answer sent, Devin has not resumed yet".
#### Variations
- She clicks "Deny" → the agent reports it did not send; nothing changes in Devin.
- She edits her request after seeing the card ("also keep the header row"); she must Deny and ask again, because the card has no edit field. GAP: no edit-before-send for Devin messages (mail has an edit flow; Devin does not).
- She asks the agent to stop or archive a session ("Terminate the Remove unused feature flags session"): same card, destructive; sleep, terminate and archive all go through `devin_session_interact` [exists].
- She asks the agent to start a new Devin session: `devin_session_create` card, spends ACUs. The `devin-sessions` skill says to set `max_acu_limit` and state it [exists]. Out of scope for this page's promise.
#### Edge Cases
- Ambiguous session ("the CSV one" matches two): the agent should ask which; [unverified].
- Session already finished: sending a message may fail or wake it; Devin's behavior is unverified.
- Card left unanswered: the run waits; closing the panel does not cancel it. [exists generally for approvals; Devin-specific behavior unverified]
- Prompt injection: session text read by the agent is untrusted; the skill says never follow instructions found in it [exists]. A session message that says "tell Devin to delete the repo" must not turn into a card the user clicks through by habit. The card is the only protection; hence the raw-arguments GAP in step 6 matters.

#### Round 2 update (decision: no Devin write option)
- This story changes from "offer a write with an approval card" to "the agent declines". The user asks the agent to tell or stop a Devin session; the agent says Rakazo is read-only and links the session ("Open in Devin"). There is no approval card, no "Allow changes in Devin" setting and no write tool. GAP-10 and GAP-32 resolved. Expected path: 2 (ask, read the reply and link).
- Not drawn: the wording of the refusal (GAP-31).

### STORY-019: Another bot asks the Devin agent
**Old ID**: STORY-305  
**Gap IDs**: GAP-10, GAP-33  
**Related**: STORY-018

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Priya, a founder who talks to her "Chief of staff" bot in a normal thread.
**Goal**: Get an answer about Devin inside her usual thread without opening the Devin page.
**Preconditions**: Devin connected; the Devin agent bot exists; Priya also has a general bot named "Chief of staff". The Devin server is exclusive to the Devin agent (`agentExclusive`), so Chief of staff cannot call Devin tools itself [exists, `mcp-connector.ts` "belongs-to-agent"].
**Ideal path**: 2 — ask the Chief of staff in her thread, read the reply. The Chief of staff uses `message_bot` to the Devin agent and relays the answer.
**Alternate paths**:
- A. Open the Devin page and use its panel (STORY-012); same facts, different surface.
- B. Open the Devin agent as its own thread and ask directly.
- C. Ask Chief of staff in a thread and let it say it cannot reach Devin (if the bot cannot find or message the agent).
Duplicated information: the same sessions appear in the page table, in the Devin agent's panel, and in the relayed answer in the Chief of staff thread.
#### Steps
1. Priya types in the Chief of staff thread: "Is Devin blocked on anything? Tell me before my 10am." She hesitates over whether the bot can see Devin at all. → the thread shows her message.
2. The Chief of staff decides to ask the Devin agent and calls `message_bot` [exists: `packages/core/src/bot-messages.ts`; delivery is async, the sender continues]. The thread shows a tool step for sending the message. Exact label [unverified]. 
3. The Devin agent receives a request, runs read-only steps (search, read messages) and writes a final response, which is returned automatically to the sender (the system text says the final written response goes back to the requester) [exists, `bot-messages.ts` ~186].
4. The Chief of staff relays: "Two sessions need you: ..." → Priya reads it in her thread. She would like the "Open in Devin" links; whether the relayed answer keeps them depends on the bot. [unverified]
5. She thinks "was that fresh?" She cannot tell; the Devin agent's own panel on the Devin page shows no record of this exchange unless bot-to-bot messages appear in its thread. GAP: it is not specified whether a peer-bot request shows up in the Devin agent's thread or panel, or who sees the read steps.
6. If the request asks for a write ("tell Devin to keep the CSV order"), the Devin agent's approval card goes to the owner (Priya), not the requesting bot. For an owner agent, writes on a peer's request never pass on saved rules or Auto Review [exists: `OWNER_PEER_WRITE_TOOLS` in `executor.ts`, partly; confirm for Devin]. GAP: where Priya sees that card (the Devin panel, the Chief of staff thread, or a notification) is not designed.
#### Variations
- Chief of staff asks at a scheduled time (a morning briefing) and includes Devin status; same path but unattended, so any write request stalls waiting for approval.
- Devin agent archived: the message cannot be delivered (see STORY-006).
#### Edge Cases
- Devin agent is mid-run on another question: the message queues; reply time is longer. [unverified]
- The requesting bot pastes Devin output into other channels (email): session text is untrusted and private. GAP: no rule stated that Devin session content must not be forwarded to third parties.
- Loop risk: Devin agent replies via `message_bot` rather than its final response; the skill text says send only useful updates. [exists]

### STORY-020: Read-only tool steps, in detail
**Old ID**: STORY-307  
**Gap IDs**: GAP-01, GAP-10, GAP-14, GAP-30, GAP-47  
**Related**: STORY-012, STORY-017

**Type**: short
**Topic**: Asking the Devin agent
**Persona**: Ana, a careful operator who wants to trust what the agent says.
**Goal**: See what the agent actually did to get its answer.
**Preconditions**: A completed answer from STORY-012 in the panel.
**Ideal path**: 2 — click the "Done · 2 tools · 4s" line to expand, read step labels.
**Alternate paths**:
- A. Cross-check against the table (0 clicks).
- B. Click "Open in Devin" and compare in Devin (external).
- C. Open the Devin agent full-screen thread; steps render the same.
Duplicated information: the step list repeats facts the answer text already states; the table repeats the same facts a third time.
#### Steps
1. Ana sees a collapsed "Done · 2 tools · 4s" above the answer. She wonders if it touched anything. → she expands it. [planned in mockup, from the existing thread activity component]
2. She reads "Searched Devin sessions" and "Read Devin messages ×2" → both are read tools (`devin_session_search`, `devin_session_events`; `get_messages` via `devin_session_interact` if used). If the second step was `devin_session_interact`, today's gate would show a card, not a quiet step. GAP: the mockup shows a quiet "Read Devin messages", which only happens once the gate is split; until then this step would stop at an approval card.
3. She wants the raw arguments or output to verify. [unverified] whether expanding a step shows arguments for read tools.
4. Satisfied, she collapses it. No approval was requested, so she concludes nothing was changed in Devin. 
#### Variations
- A long run (`devin_session_gather` blocks up to 590s): the thread would sit on a running step for minutes. The page must not use it, and the agent should avoid it for quick questions. [exists as a research fact] GAP: no designed wording for long-running steps.
- A step fails (rate limit): the line shows an error and the agent explains. [unverified]
#### Edge Cases
- Step labels use human names; unknown Devin tools fall back to a humanized raw name. [exists via `humanizeToolName`]
- Screen readers: the collapsed summary needs a name that states tool count. [unverified]

## Topic: Notifications and re-entry

### STORY-021: Devin asks a question while the founder is working in Rakazo
**Old ID**: STORY-401  
**Gap IDs**: GAP-01, GAP-02, GAP-05, GAP-06, GAP-11, GAP-19, GAP-25, GAP-39  
**Related**: STORY-008, STORY-010, STORY-016, STORY-022, STORY-023, STORY-026

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, founder of Acme Robotics, connected Devin yesterday, has the Inbox open on a laptop.
**Goal**: See that a Devin session is blocked on her, and reach the question.
**Preconditions**: Devin connected, Devin agent exists, writes off. Session "Fix flaky checkout test" moves to waiting_for_user in Devin. Rakazo has detected it (see STORY-025 for how). Browser tab is focused.
**Ideal path**: 3 — toast click lands on the Devin page, then the row's question text and "Open in Devin". A toast makes the dot unnecessary for a present user.
**Alternate paths**:
- A. Ignore the toast, click the sidebar "Devin" link (dot) instead: 3 steps.
- B. Press the palette hotkey, type "Devin", Enter: 4 steps, no dot knowledge needed.
- C. Click the toast, then "Ask" to ask the Devin agent "What is Devin stuck on?" instead of reading the row: 5 steps.
- D. Toast fades after 6 s untouched; she later notices the dot (alternate A).
#### Steps
1. [planned] A notification with importance `attention`, title like "Devin needs you" and body "Fix flaky checkout test: which branch should I rebase onto?" is created with a `link` to the Devin page → [exists] the realtime event fires, the app root refreshes counts, and a toast appears bottom-right. Maya is reading mail and thinks "Devin? That was the thing I connected yesterday."
2. [planned] The sidebar "Devin" row (Pages group) shows a dot at the same moment (`unseenCounts` for surface `devin`) → duplicated info: toast and dot say the same thing. She does not need both, and hesitates over which to trust.
3. [exists] She clicks the toast → the toast marks the notification seen and navigates to `link`. [planned] That is `/app/devin`.
4. [planned] The page loads. The tile "Needs you" shows 1 and the table row has badge "Needs you" with the question under the title (12m ago style "Updated" column) → this is the third place the same fact appears (toast, dot, tile, row). She now knows which session, and the question text.
5. [planned] The dot disappears: she is on the surface, the tab is attended, so `markSeen({ surface: "devin" })` runs → dot cleared even though she has not answered the question. She wonders: "Did it clear because I answered?" No. The row still says "Needs you".
6. [planned] She clicks the session title or "Open in Devin" → the session opens in Devin in the system browser (Electron: `app-opener`). She answers there. Rakazo does nothing.
#### Variations
- Electron desktop window focused: same as above; the toast is in-window.
- Window narrower than 1024 px: sidebar is a drawer, so the dot is hidden behind the hamburger; the toast is the only visible signal. [exists] drawer; no dot on the menu button is documented. GAP: the plan does not say whether the drawer button shows an aggregate dot.
#### Edge Cases
- The question text can only come from `devin_session_interact` get_messages, which is a forced write today (discovery Open question 1). If it stays gated, the toast body and the row show no question. GAP: what the notification body says when the question text is unavailable.
- Toast is on screen and she is already on `/app/devin`: the surface is attended, so the notification is marked seen at once. GAP: whether a toast still shows for a page she is already viewing (the code toasts any attended arrival; nothing says it is suppressed on its own surface).

#### Round 2 update (mockup v3, decisions)
- **Toast** [mockup frame 'Needs-you notification toast']: title "Devin has a question", "now", body "<session title>: <question>" (two lines), close X. Caption: clicking opens that session in Devin (external) and marks the notification seen [mockup caption; planned, not clickable in the mockup].
- **Steps 3 to 6 are replaced:** she clicks the toast, the system browser opens the Devin session (Electron: `shell.openExternal`), she answers there. The Rakazo page is not involved. **Ideal path: 2** (toast, click). Was 3.
- **Recipient:** whoever connected (decision). A member who did not connect gets no toast.
- The sidebar dot is still drawn for someone who ignores the toast; whether it is a live count or an unseen-notification flag is open (GAP-05).
- The frame draws the toast on the Devin page itself (GAP-39). A fallback to `/app/devin` when no session URL can be built is GAP-52.

#### Round 3 update (mockup v4)
- **Toast frame is drawn over Inbox,** not over the Devin page: avatar, 'Devin needs input', time '2m ago', body 'Add CSV export for invoices: Should the export keep the legacy CSV column order?', hint 'Opens Devin'; X appears on hover or focus. A second frame shows the '+1' stack.
- **Planned and not observable:** the click opens the session in Devin and marks it seen; the toast body when the question cannot be read is not drawn (F-STORY-021-02).

#### Round 4 update (mockup v5)
- **Unreadable question:** the frame 'Toast when the question cannot be read' shows 'Devin needs input', 'Add CSV export for invoices is waiting for your answer.', '2m ago' and 'Opens Devin' (F-STORY-021-02 resolved). The sidebar Devin link on that frame shows the count 3.

### STORY-022: Away from the keyboard: OS notification and phone push
**Old ID**: STORY-402  
**Gap IDs**: GAP-02, GAP-05, GAP-07, GAP-11, GAP-40  
**Related**: STORY-021, STORY-023, STORY-033

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, in a meeting; Rakazo desktop app in the background, phone in her pocket with the Rakazo app installed.
**Goal**: Find out a session is blocked without having Rakazo open, and get back to it.
**Preconditions**: Browser notification permission granted earlier; Expo push endpoint registered; the `attention` notification is created at 14:02.
**Ideal path**: 2 — tap the OS notification on the laptop, land on the Devin page. Phone is the fallback, not the first path.
**Alternate paths**:
- A. Desktop/web OS notification clicked: window focuses (`shown.onclick = window.focus()`); she is on whatever page she left, not necessarily Devin. 3 steps: click, click the dotted "Devin" row, read.
- B. Phone push tapped: opens the Devin agent thread (notification carries `botId`); 3 steps to reach the Devin session list is not possible on mobile.
- C. Neither device checked until later: STORY-023.
#### Steps
1. [exists] The web tab is not focused, so `deliverNotification` waits 1.5 s, finds nothing shown, and calls `new Notification(title, { body, tag: id })` → an OS banner "Devin needs you" appears. Expectation she has: it is from Rakazo, not Devin.
2. [exists] A phone delivery is queued 30 s out. Because the OS banner is not a "shown" toast, the notification is not marked shown. 30 s later the worker sends the Expo push → both laptop and phone buzz. Duplicate info across devices. GAP: the plan skips the phone push only when the notification was shown as a toast or seen; an OS banner on the laptop does not suppress the phone push.
3. [exists] She taps the laptop banner → the window comes to the front but stays on its old route (`window.focus()` only). The OS notification does not navigate to `link`. GAP: the OS notification click does not open the Devin page; the notification `link` is used by the toast, not by `shown.onclick`.
4. [planned] She sees the dot on the "Devin" row and clicks it → page opens, dot clears (attended), row says "Needs you".
5. [exists] Alternatively she taps the phone push: `openNotificationResponse` routes to `/thread` for the `botId` → the Devin agent chat opens, empty or with the prior thread. She sees no list of sessions. She thinks "where is the thing Devin asked?"; she can type "What is Devin stuck on?" and the agent answers with "Open in Devin" links (reads only).
#### Variations
- Browser switch off in Settings ("Browser"): no OS banner; the phone push still goes. Dot waits.
- Permission denied or never asked: `requestPermission` returns not granted, result "skipped". The dot is the only web signal.
- Electron: web Notification API is used (permission already granted by `session-permissions.ts`); behaves like the browser.
#### Edge Cases
- Mobile link bug: if the notification `link` is `/app/devin` and no `botId` is in the push data, the mobile parser `^/app/(?:(g)/)?([^/]+)/?$` reads "devin" as a bot id and opens `/thread` with `botId: "devin"`. GAP: needs a `botId` in push data or a mobile rule for the `devin` path; mobile has no Devin page (`apps/mobile`, parity inventory).
- Hide money on: `attentionFromDto` masks currency in the toast and OS text. Devin text rarely has amounts; an ACU figure is not currency. No issue found.

#### Round 2 update (decisions)
- **Laptop:** the OS banner click opens the session link in Devin (step 3 and alternate A are replaced; the "window focus only" gap is a build item under GAP-11, resolved as design). **Ideal path: 2** (banner, click) and she is in Devin.
- **Phone:** mobile gets push only. A tap opens the same https session link in the phone browser [planned]; no Devin agent thread and no sidebar dot are involved, so steps 4 and 5 and the `/app/devin` bot-id misparse no longer apply. The mobile handler for an external link is GAP-48.
- Both devices still buzz (GAP-40).

### STORY-023: Weekend away, many sessions blocked
**Old ID**: STORY-404  
**Gap IDs**: GAP-02, GAP-05, GAP-06, GAP-12, GAP-13, GAP-41  
**Related**: STORY-015, STORY-016, STORY-021, STORY-022, STORY-024

**Type**: long
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, offline Friday 18:00 to Monday 08:30; four Devin sessions go to waiting_for_user over the weekend.
**Goal**: On Monday, know which sessions are blocked and which are stale, without reading four pings.
**Preconditions**: Detection is working (STORY-025). Devin agent writes off. All four are in one space.
**Ideal path**: 3 — open the Devin page, read "Needs you 4", open each in Devin. The page is the reliable summary; the notifications are not.
**Alternate paths**:
- A. Start from the phone lock screen on Saturday: see push banners; do nothing (opening Devin would be a weekend act); Monday uses the page.
- B. Start from the Devin agent: "What is Devin stuck on?" returns a list with "Open in Devin" links, 4 steps.
- C. Start from Slack/Linear where Devin posts directly (outside Rakazo).
#### Steps
1. [exists] Friday 20:10: first `attention` notification for session A. Web is closed; phone push goes after 30 s. The 2-per-hour `attention` limit is per (space, user, bot).
2. [exists] Friday 20:40 to Sunday: sessions B, C, D go to waiting_for_user. B and C are within the same hour as A: the third and later `attention` notifications within an hour return "Rate limited, do not retry." and are dropped (no row is created). GAP: a notification dropped by the rate limit is never retried; if detection runs once per transition, that session never produces a dot or push. The dot-only `info` path is not used as a fallback.
3. Saturday: Maya sees two phone banners. She hesitates: "Do I deal with this now?" She decides it can wait.
4. Monday 08:30 she opens Rakazo on the laptop. [exists] Unseen counts load on mount. [planned] The "Devin" row shows a dot. Toasts for old notifications do not replay: `notifications.list({since})` is used for reconnects, and toasts are for new arrivals. GAP: whether a notification that arrived while the app was closed produces a toast on open. The plan says only that reconnecting clients fetch by `since`.
5. She opens the page. [planned] Tile "Needs you 4" (computed from the live session list, not from notifications), four "Needs you" rows with ages "2d ago", "1d ago", "19h ago", "1h ago" → she sees all four even though only two pings reached her. The page is the source of truth.
6. She opens the oldest one in Devin first. It may have timed out or been suspended while waiting. [planned] Its row shows "Suspended" after refresh. GAP: Devin's behavior for a session left waiting for days is not documented (research did not capture status_detail values); the mapping of such sessions to "Needs you" vs "Suspended" is unverified.
7. After answering, she returns to Rakazo. The tile still shows 4 until refresh. She presses the browser reload (no refresh control is drawn in the mockup; the header meta is "Updated 1m ago").
#### Variations
- Notifications retained 30 days: all four are listable later. There is no bell/history in v1, so no surface shows them. GAP: a missed notification cannot be reviewed, only its dot.
- Several spaces: notifications and Devin connection are per space; the dot is on the Devin row of the space she is in. A Devin block in space B shows nothing while she is in space A. GAP: no cross-space unseen indicator documented for page dots.
#### Edge Cases
- Phone offline Saturday: deliveries retry up to 5 times with backoff; after that status `failed`. No later nudge.
- A teammate in the same Devin org also connected: they are not notified for Maya's sessions unless the session is theirs; the org key shows all sessions (discovery Open questions 3 to 5). GAP: who is the recipient per session; the plan implies only the user whose key detected it.

#### Round 2 update (decisions)
- Alerts go to whoever connected, and each one links to its own session. A user with many blocked sessions gets one link per session, and the page remains the only list (GAP-41). If the connector is away and someone else uses the page, no alert reaches that person (GAP-53, STORY-035).

### STORY-024: Same session asks twice (dedupe)
**Old ID**: STORY-405  
**Gap IDs**: GAP-02, GAP-06  
**Related**: STORY-023

**Type**: short
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz.
**Goal**: Not be pinged repeatedly, but not miss a second, different question.
**Preconditions**: Session "Migrate billing tables" asked about the schema at 10:00, Maya answered in Devin at 10:20, and Devin asks something else at 14:00.
**Ideal path**: 2 — one new notification per distinct question; the same question only once. This depends on the dedupe key chosen at design time.
**Alternate paths**: none found for the user. The two designs for the key (session id only vs session id plus question/event id) give different results, below.
#### Steps
1. [exists] The first notification is created at 10:00 with dedupe key K. [planned] Key choice is open (discovery: "stable dedupe key, probably per session and per question").
2. If the key is the session id: the 14:00 attempt is within 24 hours, so `createNotification` returns "deduped" and nothing is sent. Maya is never told about the second question. Dot and push do not fire. She finds out only if she opens the page. GAP: a session that asks a second, different question the same day is silent under a session-only key.
3. If the key includes the question/event id: the 14:00 notification is created, toast or push fires, dot appears. She sees "Needs you" for a session she thought was resolved, and may think it is the old one. Row text is the new question.
4. If the same question is re-detected on every poll (state unchanged) and the key is stable, the 24-hour window blocks repeats. After 24 hours with the session still waiting, the key can notify again. She gets a reminder, which is useful, but nothing says it is a reminder. GAP: whether a day-old unresolved question should re-notify at all.
5. [exists] Default key when none is given is a hash of surface and title. With a title like "Devin needs you" for every session, two different sessions in one day dedupe against each other: the second session never notifies. GAP: the title must be unique per session or an explicit key must be passed.
#### Variations
- Session answered and finished between polls: no notification; a stale dot cannot arise because none was sent.
#### Edge Cases
- Dedupe returns the earlier notification; the dot reflects the first one's seen state. If she has already seen it, a deduped repeat will not re-light the dot.

### STORY-025: How Rakazo notices (no webhooks) and when it can be late
**Old ID**: STORY-406  
**Gap IDs**: GAP-02, GAP-03, GAP-06, GAP-13, GAP-28  
**Related**: STORY-011

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Dev Patel, the Rakazo engineer who must make the notification real; also Maya, who sees its effects.
**Goal**: Understand who looks at Devin and how often, to set expectations for the notification timing.
**Preconditions**: Devin MCP only; no webhook source (discovery: "Polling or event source for needs-you detection is not decided"). The existing cloud-agent poller is Cursor-specific.
**Ideal path**: not applicable (design question). The stories below name the options.
**Alternate paths**:
- A. Page-open polling: the Devin page fetches the session list when it opens or on an interval, and a change to "Needs you" calls a Rakazo endpoint that runs `notify_user`. Nothing happens when the page is closed.
- B. Server-side scheduled poll (a worker job per connected Devin server, like the Cursor poller). Notifications arrive with the page closed.
- C. A routine on the Devin agent that checks every N minutes and calls `notify_user` (the agent runs `devin_session_search`, so it can). Reuses routines; the run's own `notify` flag and the rate limits apply.
#### Steps
1. [planned] A session moves to waiting_for_user in Devin. Rakazo is not told. → Time passes with no signal.
2. Under A: nothing until Maya opens the Devin page. Her first signal is the table itself. The toast and push the plan describes would not fire in her absence. GAP: with page-open polling only, the "30 s unseen then push/OS" promise cannot hold.
3. Under B or C: the detection runs on a cadence. The delay from the status change to her toast is up to one interval. GAP: no cadence is chosen, and no design says who owns the job, the key it uses, or what happens when the key is revoked (the job must stop; the Integrations card shows reconnect).
4. The detection must compare status against the last known value to know a transition occurred. GAP: where the last-seen status per session is stored. Durable state must live in Postgres (AGENTS.md); no table exists for it.
5. A first poll after connecting sees sessions that were already blocked. GAP: whether those notify (a burst, hitting the rate limit in STORY-023) or are only shown in the table.
6. Under B, the cost is one MCP call per connected user per interval on Devin's API, with unknown rate limits (discovery lists Devin rate-limit behavior as unknown).
#### Variations
- "Updated 1m ago" in the mockup implies a refresh cadence of the page itself. Whether the page auto-refreshes while open is not stated. GAP.
- Multiple API processes: a poller must avoid duplicate notifications from two processes; the dedupe advisory lock in `createNotification` covers the notification, not the polling.
#### Edge Cases
- The status mapping from Devin's `status` / `status_detail` to "Needs you" is unverified (discovery). A wrong mapping notifies on the wrong sessions.
- Key valid but lacking session-read permission: poll fails silently; no notification and no error state is designed.

### STORY-026: Finding Devin again by search, and a hidden or unconnected page
**Old ID**: STORY-407  
**Gap IDs**: GAP-37, GAP-46  
**Related**: STORY-002, STORY-008, STORY-016, STORY-021

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, who last used Devin two weeks ago. A second persona, Sam Lee, hid the Devin page from the sidebar ("Page options" menu) and has not looked since.
**Goal**: Get back to the Devin page, and for Sam, still learn when Devin needs him.
**Preconditions**: Maya: Devin connected, page visible. Sam: Devin connected, `hiddenPages` includes `devin`.
**Ideal path**: 2 for Maya — palette hotkey, type "Devin", Enter. For Sam, 3 — notification, then page.
**Alternate paths**:
- A. Sidebar search box (not the palette): type "Devin"; `searchPages` matches by label and keywords.
- B. Integrations: the connected Devin card has no "Open Devin" link today (Carta has "Open Cap table") [planned to add].
- C. Devin agent chat from the sidebar agent list; no session table.
- D. For Sam, "Page options", tick "Devin" to show it again.
#### Steps
1. [planned] Maya opens the palette (`isCommandPaletteHotkey`) and types "Devin" → one result "Devin" with an icon, from `appPages` [planned: not in the list today]. She might also type "coding" or "agent": GAP: no keywords string is defined for Devin (Cap table has one).
2. She presses Enter → `openAppPage("devin")` navigates to `/app/devin`. The page loads; no unseen dot.
3. Sam: Devin is hidden, so there is no sidebar row. A notification arrives. [exists] `markSeen` is by surface; the sidebar row is not rendered, so no dot is visible anywhere. GAP: dots for a hidden page. The sidebar hides the whole row (`hiddenPages.includes(...) ? null`), and the plan says a rail shows dots on page items. A blocked session could be invisible to a user who hid the page.
4. Sam's toast and push still fire (importance `attention`), so he sees them. He clicks the toast → lands on the Devin page though it is hidden from the sidebar. Hidden pages remain reachable by URL and search. [planned] The page loads with no sidebar highlight.
5. Sam wonders whether to unhide. The dot never appears for him unless he does. GAP: no prompt to unhide, and no indication that a hidden page still notifies.
6. If Devin is not connected for a space member, "Devin" still appears in search (like Cap table) and opens a page with only "Connect Devin". Discovery Open question 13 decides if the row is shown at all. GAP.
#### Variations
- Mobile search: no Devin page. Search would show nothing for Devin; the Devin agent bot appears in the agent list by name.
- Electron: palette hotkey is the same.
#### Edge Cases
- Typing "Devin" also matches the "Devin agent" bot in space search, and the "Devin" page: two results with the same word. Which one is first is not specified. GAP: result order and labels to tell the page from the agent chat.
- Toast arrives for a space she is not currently in: not designed.

## Topic: Errors, permissions and surfaces

### STORY-027: Devin's MCP server is down or slow
**Old ID**: STORY-502  
**Gap IDs**: GAP-04, GAP-08, GAP-13, GAP-14, GAP-15, GAP-19, GAP-27, GAP-44  
**Related**: STORY-007, STORY-011, STORY-028

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Ravi, a CTO opening the Devin page during a Devin incident.
**Goal**: See whatever is still known and judge whether to wait.
**Preconditions**: Devin connected. Devin's MCP endpoint is timing out. [planned] The Devin page exists.
**Ideal path**: 4 — open the page, see the old rows with a clear notice, retry once, leave.

#### Steps
1. Ravi opens "Devin" in the sidebar [planned] → Rows from the last good load appear with "Updated 9m ago" [planned]. For a first load with no earlier data, a skeleton shows [planned, Legal uses `Skeleton`].
2. The refresh runs and waits for the single connector timeout [exists as `MCP_TIMEOUT_MS`] → He watches a skeleton or spinner. GAP: the timeout value is not stated in the design, and nothing says how long a page load may wait. The discovery file warns that `devin_session_gather` can block up to 590 seconds and must not be used for page loads.
3. The call fails → An `ErrorNotice` appears with the sanitized message, for example "Could not reach mcp.devin.ai" and the button "Try again" [exists as component and message, placement planned]. Old rows stay visible.
4. He clicks "Try again" [exists] → The fetch runs again. It fails again, the notice stays. He decides to check Devin's own status page. The "Open Devin" icon button in the header [planned] is his shortcut. GAP: its target is undefined (open question 8).

#### Variations
- First ever load fails: no stale rows exist, so the page shows only the notice and an empty table area. GAP: no empty-versus-error wording is defined.
- Slow but successful: the page shows data after 20 seconds. "Updated 1m ago" is true only after the call completes, so it should not move early. GAP: the refresh indicator is not designed.
- He asks the agent instead of waiting. The agent tool fails the same way, so the chat shows the same error. He sees the problem in two places (page notice and chat) with possibly different wording. GAP: no rule that the two messages match.

#### Edge Cases
- The connector drops its session on a thrown call and reconnects on the next call [exists], so "Try again" does a fresh connection, not a retry on a dead one.
- Partial network: the call succeeds but returns an empty string. Treated as "no sessions", which would wrongly show the empty state during an incident. GAP.
- The Devin agent is working on a user request while the page refreshes. Both use the same server connection. Unverified.

#### Round 2 update (mockup v3)
- **Load error frame:** "Could not load Devin sessions." with "Try again", no tiles or table, Ask visible. Loading shows the skeleton. GAP-14 resolved for the drawn states. A rate-limit message and cooldown are not drawn (GAP-28).

### STORY-028: Devin answers 429 (rate limited)
**Old ID**: STORY-503  
**Gap IDs**: GAP-28, GAP-44  
**Related**: STORY-005, STORY-007, STORY-027

**Type**: short
**Topic**: Errors, permissions and surfaces
**Persona**: Ravi, who refreshes the page repeatedly while waiting for a pull request.
**Goal**: Understand why the page stopped refreshing and when to try again.
**Preconditions**: Devin connected. Ravi (or other tools using the same org key) has exhausted Devin's request limit. [planned] The Devin page exists.
**Ideal path**: 3 — see a plain "try later" notice, wait, retry once.

#### Steps
1. Ravi clicks the page's refresh action, or reopens the page several times in a minute [planned; there is no refresh button in the mockup] → The call returns 429. GAP: code has no 429 or "Retry-After" handling. The user would see the raw sanitized error string, for example "Streamable HTTP error: 429", which means nothing to him.
2. He sees an `ErrorNotice` with that text and "Try again" [exists as component] → He clicks "Try again" immediately, which sends another request and keeps the limit exhausted.
3. Ideal: the page waits and shows older rows with "Updated 6m ago". "Try again" is disabled until the wait ends [planned]. GAP: no cooldown behavior is designed.

#### Variations
- The limit is shared by the whole org key. Another teammate's connection or a Devin Slack bot may be using it, so Ravi has done nothing wrong. GAP: no copy explains this.
- The agent hits the limit mid-answer: the chat shows a failed tool row and a short apology from the model. The model may retry in a loop. GAP: no retry cap for the Devin read tools is stated here.
- Background polling for needs-you hits 429 for many users at once. GAP: no poller design exists (open question 5).

#### Edge Cases
- A 429 on only the message-read call: the "Needs you" rows lose their question subtitles but keep the status badge. Matches the "question text unavailable" state in the discovery file [planned].
- The user closes and reopens the page to "fix" it, doubling the requests.

### STORY-029: Tool output cannot be parsed (partial data)
**Old ID**: STORY-504  
**Gap IDs**: GAP-03, GAP-16, GAP-27, GAP-45  
**Related**: STORY-009, STORY-014

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Hana, a founder who just connected Devin and opens the page for the first time after Devin changed its tool output wording.
**Goal**: See as much as possible, and know what is missing.
**Preconditions**: Devin connected. All Devin MCP tools return one text string. The parser fails on some rows or some fields. [planned] The Devin page exists.
**Ideal path**: 3 — the page shows the rows it could read, marks the rest, and offers the agent for the missing detail.

#### Steps
1. Hana opens "Devin" [planned] → The page parses the text from `devin_session_search`. Eight rows parse. Two do not.
2. She sees eight rows and a header count that says "Needs you 1" [planned] → She assumes this is complete. GAP: nothing tells her that two sessions were skipped, so the tiles can be wrong without any warning. The discovery file marks the output format as Unverified.
3. Ideal: a one-line notice under the tiles, "2 sessions could not be read." with "Ask" to open the agent [planned, new copy that needs the AGENTS.md copy justification] → She clicks "Ask" and types "List all sessions". The model reads the raw text itself, which is more tolerant than the table parser.

#### Variations
- A single field fails (the PR list). The row shows "—" in Pull request, which already means "no PR" in the mockup. GAP: the page cannot tell "no PR" from "PR unreadable".
- The status text does not match any known value. The badge should not claim "Working". GAP: no "Unknown" badge exists in the mockup list (Needs you, Working, Finished, Error, Suspended).
- The ACU number is unreadable. The "ACUs this week" tile would undercount. GAP: no rule to show a dash or a plus sign on a partial total.
- Over 100 sessions: the first page shows 100 and the tiles cover only those. GAP: no "showing the latest 100" wording is designed (discovery lists "truncated or over-100 session list").

#### Edge Cases
- The question text of a Needs-you row is cut off by Devin ("truncated body"). The subtitle should end cleanly. [planned]
- The response contains text that looks like an instruction. The page renders it as plain text, not as a command. The agent receives it as tool output, which is untrusted.
- A row has no title: the row needs a fallback label. GAP.

### STORY-030: Out of ACUs, sessions suspend
**Old ID**: STORY-505  
**Gap IDs**: GAP-03, GAP-26, GAP-31, GAP-42  
**Related**: STORY-009

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Maya, a founder who sees several sessions marked "Suspended" and one "Needs you".
**Goal**: Learn that Devin stopped because the credit balance ran out, and know where to fix it.
**Preconditions**: Devin connected. The org ran out of ACUs, so Devin suspended running sessions (status detail "out_of_credits"). The status mapping is Unverified. [planned] The Devin page exists.
**Ideal path**: 5 — see Suspended rows, ask the agent why, follow the link to Devin to add credits, return, see Working.

#### Steps
1. Maya opens "Devin" [planned] → Three rows show the grey badge "Suspended" and "Working 0" [planned]. She thinks "did someone pause these on purpose?" because "Suspended" can also mean a user pause, and the mockup's "Rewrite onboarding copy" row has the same badge.
2. She hovers the badge → GAP: no tooltip or detail text is designed, so the page cannot say "out of credits".
3. She clicks "Ask" and types "Why are my sessions suspended?" [planned] → The agent searches sessions [exists tool `devin_session_search`], reads the status detail, and answers "Three sessions are suspended because the organization is out of ACUs." with an "Open in Devin" link [planned]. This is the only place the reason can be learned.
4. She clicks "Open in Devin" → It opens in a new tab on the web, or in the system browser in Electron (STORY-033). She adds credits on Devin's billing page. Rakazo does not change anything in Devin (read-only scope).
5. She returns and refreshes the page [planned] → The rows go back to "Working" as Devin resumes them, or stay "Suspended" until someone resumes them in Devin. GAP: whether Devin resumes sessions automatically after credits return is not known.

#### Variations
- Two weeks later, "ACUs this week" shows a number but gives no hint that the balance is low. GAP: balance is not a field the search tool returns, so the page cannot warn before the cliff.
- A "Needs you" row is also suspended. The row can show only one status. Which badge wins is undefined. GAP.
- Maya asks "How many ACUs do we have left?". The agent has no tool for balance (the read tools are `devin_session_search`, `devin_session_events`, `devin_session_gather`, `ask_question`, `read_wiki_*`, `list_available_repos`, `devin_list_integrations`). It should say it cannot see the balance. Unverified how Devin answers.

#### Edge Cases
- Sessions that suspended for other reasons (idle, user pause) look identical. The mapping from `status_detail` is not confirmed.
- No notification fires when sessions suspend, because only "needs you" produces one. GAP: out-of-credits is a state a founder wants to hear about, and no one has decided whether it pushes.

### STORY-031: A teammate in the same space opens the Devin page
**Old ID**: STORY-506  
**Gap IDs**: GAP-09, GAP-12, GAP-24  
**Related**: STORY-015, STORY-032

**Type**: long
**Topic**: Errors, permissions and surfaces
**Persona**: Tom, a cofounder in the same Rakazo space as Maya. Maya connected Devin. Tom has not.
**Goal**: See what Devin is doing for the company.
**Preconditions**: Maya's `McpServer` for Devin exists, scoped to her user and the space. Tom has no Devin server row. Tom's Devin account is in the same Devin org as Maya's.
**Ideal path**: 5 — Tom sees "Connect Devin", asks Maya for a key or creates one, connects, sees the same org sessions.

#### Steps
1. Tom sees "Devin" in his sidebar [planned] → The link is there because Pages are the same for every member. GAP: whether it shows before connection is open question 13.
2. He clicks it → The page shows the title "Devin" and one button, "Connect Devin" [planned, in the mockup]. He assumes it is broken, because Maya told him "Devin is set up". GAP: nothing says that a teammate already connected it; Rakazo connections are per user (`McpServer` is scoped by space and user).
3. He opens Integrations [exists] → The Devin tile shows "Coding sessions and repo docs" and no "Connected" badge for him. He cannot see Maya's connection. This is consistent with private-by-user, but it surprises him.
4. He clicks the tile → The dialog "Connect Devin" asks for an "API key" with the hint "An org-scoped Devin service-user key (starts with cog_)." [exists]. He does not have one. He messages Maya.
5. Maya sends the key through chat → The key is pasted into the dialog. Pasting a shared key into a chat is a leak risk. GAP: no guidance on creating a separate service-user key per person, and no mention of a shared-connection option (open question 4).
6. Tom presses "Connect" [exists] → Rakazo lists tools. On success, Tom's own "Devin agent" bot is created ("Your Devin account"), and his page opens [exists for the bot, page planned].
7. Tom sees the table → It shows sessions from the whole org, including ones Maya started in Slack and ones other people started. GAP: "From" shows only the origin (Slack, Linear, Web, API). There is no name, and no label that says "all sessions in your Devin org". Tom cannot tell which are his.

#### Variations
- Tom never connects. He still gets no "needs you" notification, since the connector is the recipient. Only Maya hears about a session that waits on him. GAP: open question 5.
- A third teammate, Priya, belongs to the space but not to the Devin org. A key from outside the org shows nothing, and nothing in the product tells her why.
- Maya disconnects (STORY-032). Tom's page and agent are unaffected, because they are separate rows.
- Tom is a member of two spaces and connected only in one. The other space shows "Connect Devin" again.

#### Edge Cases
- An outside collaborator (a contractor, a shared bot) can read Maya's agent thread if the thread is shared. Whether the Devin agent thread can be shared is not defined. GAP.
- Session titles may expose confidential work, such as "Prepare layoffs spreadsheet export", to any member who connects with any org key. The privacy question is open question 3.
- Maya connects the key of a different Devin org than Tom's. Both see their own org. No label names the org. GAP.

#### Round 2 update (decision: one connection per space)
Steps 1 to 7 above describe the per-user model and are superseded. Current path:
1. Tom clicks "Devin" in the sidebar [planned] → the page opens on the table with the org name "acme" in the header, because the space already has Maya's connection. No Connect step, no key.
2. He reads the Needs you group and clicks "Answer in Devin" if a session waits on him.
**Ideal path: 2.** Was 5 to 7. GAP-24 and GAP-09 resolved.
- **Notifications:** Tom gets none; they go to Maya, the connector (decision). If Maya leaves, nobody does (GAP-53).
- **Visibility:** every member sees every org session title; the header names the org. Nothing in the dialog warned Maya of this (GAP-50).
- **Key rejected:** Tom sees "Devin rejected the key." with Reconnect; whether he may press it is undefined (GAP-49, GAP-50).
- **Not drawn:** Not connected for a member who may not connect.

#### Round 3 update (mockup v4)
- **Two outcomes drawn:** a member sees the populated page with 'acme' in the header (2 steps), or, if she may not connect and nothing is connected yet, 'Ask a space owner to connect Devin.' (1 step, no action). The key-rejected page has no member variant (GAP-54).

#### Round 4 update (mockup v5)
- **No org meta:** a member of a connected space sees the title-only header with the tiles and table; nothing names the org.
- **Key rejected:** a member who may not reconnect sees the notice without a button (STORY-036).

### STORY-032: Disconnecting Devin from Integrations
**Old ID**: STORY-507  
**Gap IDs**: GAP-43  
**Related**: STORY-007, STORY-031

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Maya, ending the Devin contract.
**Goal**: Remove Devin and understand what happens to the page, the agent and her data.
**Preconditions**: Devin connected, the Devin page used for weeks, the Devin agent has chat history.
**Ideal path**: 5 — open the card, Remove, confirm, land on Integrations, check that the page shows Connect Devin.

#### Steps
1. Maya opens Integrations and clicks the Devin card [exists] → The detail page at `/app/integrations/mcp/<id>` opens.
2. She scrolls to the red button "Remove Devin" next to the note "Removes the connection and bot access." [exists] → She clicks it.
3. A confirm dialog titled "Remove Devin?" appears with the line "Bots lose access to the tools of Devin." [exists] → She reads it. She wonders whether sessions in Devin are deleted (they are not; Rakazo only reads). GAP: the dialog does not say the Devin account and its sessions are untouched, nor that the Devin agent is archived.
4. She presses "Remove Devin" [exists] → The server row and the stored key are deleted, the Devin agent is archived and unpinned, and she lands on `/app/integrations` [exists in `mcp.servers.remove`].
5. She goes back to the Devin sidebar link [planned] → The page shows "Connect Devin" only [planned]. GAP: the sidebar link and the docked agent panel are not defined for this state. If the page was open in another tab, it keeps showing old rows until a refresh or its next call fails.

#### Variations
- She removes the key in Devin first, then in Rakazo: same result as STORY-007 followed by this story.
- She wants only to pause: there is no disable toggle in the flow described here. GAP: the row has an `enabled` field but no Devin-specific control is designed.
- She reconnects later with a new key: a new Devin agent is created. The earlier chat history belongs to the archived agent. GAP: archived Devin agent threads are not linked from the new one.
- A pending "needs you" notification remains in the notifications list. Its link goes to `/app/devin`, which now shows "Connect Devin". GAP.

#### Edge Cases
- Remove fails (network): the dialog shows the "Could not remove" error text [exists].
- The page is open in Electron and mobile at once. Mobile has no Devin page, so only the push stops [see STORY-033].
- Teammates' connections (STORY-031) are not affected.

#### Round 2 update (decision: one connection per space)
- Remove now ends the connection for every member of the space, not one person. The dialog should say so, and who may remove it is undefined (GAP-43, GAP-50). Every member's Devin page returns to Not connected.

### STORY-033: Narrow windows, Electron links and the phone
**Merged from**: STORY-508, STORY-304 (primary body first, merged variant below)  
**Gap IDs**: GAP-07, GAP-25, GAP-47  
**Related**: STORY-012, STORY-022

**Type**: long
**Topic**: Errors, permissions and surfaces
**Persona**: Ravi, who uses the Electron desktop app on a small laptop window, then the phone.
**Goal**: Work with the Devin page at a smaller width, open sessions in Devin, and react to a "needs you" alert away from his desk.
**Preconditions**: Devin connected. Two sessions need a decision. [planned] The Devin page and a "needs you" notification exist.
**Ideal path**: 7 — notification on phone, open the Devin agent thread, read the question, open it in Devin from the phone browser, answer there.

#### Steps
1. Ravi's laptop window is 1180px wide. He opens "Devin" [planned] → The agent panel does not dock; below 1280px it is an overlay up to 384px wide (`ResizableSidePanel`). The table and four tiles use the full width. GAP: the six-column table needs a narrow layout. Legal collapses to one list item per row; the Devin mockup is drawn only for 1280px and wider.
2. He clicks "Ask" [planned] → The panel slides over the right side of the table and covers the "ACUs" and "Updated" columns. He cannot see both the table and the answer. He closes it with the panel's close control to see the rows again.
3. At 900px the sidebar becomes a drawer [exists in Shell]. He opens the drawer, clicks "Devin" → The page is full width. GAP: the table must become a list, and the two-line Needs-you row (title plus question) must wrap without cutting off text.
4. He clicks the session title or "Open in Devin" [planned] in the Electron app → The link has target="_blank" and an https address. Electron's window-open handler sends it to the system browser through `shell.openExternal`, and denies a new Electron window [exists]. The app stays on the Devin page.
5. Devin's page asks him to sign in, since Electron's own session is separate from his default browser. This is normal for the system browser. Unverified: the exact Devin URL shape (open question 7).
6. Later he is away. His phone shows a push, "needs you" [planned]. He taps it → Mobile reads `botId`, `threadId` or `link`. If the payload carries the Devin agent's bot id, the Devin agent thread opens [exists as the generic thread route]. If it carries only `/app/devin`, nothing opens: mobile has no Devin screen, and the tap only marks the "devin" surface as seen [exists, `notificationOpenTarget` returns null for this link]. GAP: the design must say that the push carries the bot id, or it dead-ends.
7. In the thread he types "What is Devin stuck on?" [planned] → The agent replies with the question text and an "Open in Devin" link. He taps it and the phone browser opens Devin. He answers there. The page on mobile does not exist: no table, no tiles, no sidebar dot. `agent-page.tsx` shows only blocks a bot publishes, and the Devin agent publishes none. GAP: nothing says whether mobile is "web only for now" or gets a native list (open question 11; `docs/mobile-parity/inventory.md` lists Legal and Cap table as MISSING).

#### Variations
- Web in a normal browser: the same link opens a new tab. In Electron the link goes to the system browser, not an Electron tab. A user who expected a tab inside the app may think nothing happened if the browser opens behind the app.
- A non-http link (for example `mailto:` in session text) is dropped by `safeExternalUrl` in Electron and does nothing. [exists]
- The panel is already open at 1300px (docked) and Ravi shrinks the window to 1100px. The panel turns into an overlay on top of the table. His saved width (`rakazo:right-panel-width`) is ignored under 1280px.
- Ravi's phone is in another space. The mobile tap switches space first only for page links, not for threads; threads switch space themselves [exists].
- He turns the phone push off for the Devin agent in the bot's notification setting [exists, "silence notifications"] and gets no more alerts at all. GAP: that setting silences the agent, and the page sidebar dot (web only) still shows.

#### Edge Cases
- Duplicate information: the "needs you" count appears in the sidebar dot, the Needs you tile, the notification and the agent's answer. If they are computed at different times, they can disagree for a minute. GAP: no single source of truth is named.
- A very long session title wraps three lines in a narrow list and pushes the status badge off the row.
- Dark mode: all of this must work in both themes (the mockup has the toggle).
- Screen reader: the dot has the label "2 need you" in the mockup. The overlay panel needs focus handling when it opens over the page. [planned]

#### Merged variant from STORY-304: Panel at narrow widths

**Type**: short
**Topic**: Asking the Devin agent
**Persona**: Tomas, working on a 13-inch laptop with the window at 1100px, then a half-screen window at 900px.
**Goal**: Ask a question and still read the answer next to the table.
**Preconditions**: Connected, agent exists, model set.
**Ideal path**: 2 — click Ask, ask. Below 1280px the panel overlays the page, so the table underneath is partly covered; the ideal path is the same two actions.
**Alternate paths**:
- A. Drag the panel edge to resize (min 320, default 384, saved as `rakazo:right-panel-width`) [exists for ResizableSidePanel]; at overlay widths it does not shrink the table.
- B. Widen the window to 1280px or more so the panel docks.
- C. Open the agent full screen from the panel header (Cap table has the full-screen button; Devin parity [planned]) and ask there, losing the table.
Duplicated information: the table and the answer both hold session data, and at overlay width they cannot be seen together.
##### Steps
1. At 1100px Tomas opens the page. The six-column table and four tiles must collapse to a one-row-per-session list (Legal does this with an `@container`). [planned: no Devin narrow variant is drawn] GAP: the mockup only shows the 1440px layout; the narrow list design (which columns survive, where the Needs you question goes) is missing.
2. He clicks Ask → the panel appears as an overlay with a shadow over the right part of the page (absolute, max 384px), not docked. [exists as panel behavior]
3. He asks "What is Devin stuck on?" and reads the answer. To compare with the table he must close the panel, since the overlay hides the Status and Pull request columns. He thinks "I want both at once" and cannot. GAP: no way to see table and thread together below 1280px.
4. He collapses the panel and the Ask button returns. [exists pattern]
##### Variations
- Below 1024px: sidebar becomes a drawer, page full width, panel overlays full-width-ish. Mobile-sized browser windows behave the same.
- Panel width saved as 500px, window shrinks: the saved width must not exceed the window. [unverified]
##### Edge Cases
- Long session titles in the narrow list truncate with ellipsis; the agent's answer wraps and shows full titles, so the same session can read differently in the two places.
- Keyboard: the panel needs a focus order and Esc to close at overlay width. [unverified]
- Electron uses the same layout; its window minimum width is not checked here.

#### Round 2 update (mockup v3, decisions)
- **Width switcher** [mockup frames at 1100, 900, 390]: at 1100 the sidebar stays and the overlay panel (384px) covers Pull request, Source and Updated; at 900 and 390 the sidebar becomes a top bar (menu icon and "Devin agent") and the sidebar dot is not visible anywhere (F-STORY-033-06); at 390 the table becomes a list with the badge at top right, "Answer in Devin" inside the row, and a Pull request, Source, Updated block. Step 1 and step 3 gaps are resolved; step 2 (overlay covers columns) remains.
- **Mobile is push only** (decision). Steps 6 and 7 change: the push tap opens the Devin session link in the phone browser [planned]; there is no Devin agent thread to open and no mobile page. **Ideal path: 3** (push, tap, answer in Devin). Was 7. The handler for an external link is GAP-48. GAP-07 resolved.
- Real browser widths 1100, 900, 390 do not change the frames (each is fixed 1440px and scrolls); only the Width switcher does. At a 390px browser the dialog frame is 440px and overflows by 66px (mockup artifact, F-STORY-033-04).

#### Round 3 update (mockup v4)
- **Widths:** 1440 docked panel; 1100 sidebar kept, five columns, overlay panel; 900 hamburger-only top bar (no 'Devin agent' label), overlay panel; 390 list rows (title, badge, question, time), drawer fixed at 390 with the Devin link and dot.
- **Still open:** no needs-you signal in the top bar under 1024px (F-STORY-033-06); the overlay covers Pull request, Source and Updated (decided in V9 to match the real shell).

#### Round 4 update (mockup v5)
- **Unchanged from v4:** 1100 five columns and overlay panel; 900 hamburger-only top bar; 390 list rows; drawer fixed at 390 and shows the count (3) in the Devin link. At a real 390px viewport scrollWidth is 390 and the dialogs are 358px wide. Still open: F-STORY-033-06 (no needs-you signal outside the drawer). The new frames (Needs you 0, unknown, partial, two PRs, key rejected) fit at 390 with no overflow; two PRs read 'acme/api#220 open, acme/web#431 open · 6m ago' in one line.

### STORY-034: Open the agent panel for the first time from the closed first-visit page
**Old ID**: (new, round 2)  
**Gap IDs**: GAP-29, GAP-51  
**Related**: STORY-004, STORY-012

**Type**: short
**Topic**: Asking the Devin agent
**Persona**: Maya Ortiz, connected Devin yesterday, opens the page for the first time.
**Goal**: Ask the Devin agent a question about history ("Anything merged today?") from the page.
**Preconditions**: Devin connected, Devin agent exists, a model is set, the panel is closed (first visit).
**Ideal path**: 2 — click Ask, type the question.
**Alternate paths**: Click a suggestion chip if one exists [not drawn]; press the keyboard shortcut for the page agent [unverified].
#### Steps
1. [mockup v3] Maya sees the page with the panel closed and an Ask button at the top right → she is not distracted by a thread that does not exist yet.
2. She clicks Ask [planned] → the panel opens: docked at 1280px and wider, overlay below, and Ask disappears. In the mockup the first-visit frame hides Ask but draws no panel (only the first frame builds one), so the first-open state is not drawn. GAP: whether a new user sees an empty thread or an intro with suggestion chips (the Legal and Carta intro pattern) is not drawn.
3. She types the question and sends it [planned] → the agent answers with read-only tool steps ("Session search") and links ("Open in Devin"). She is on a model that is set, per the precondition.
#### Variations
- Window under 1280px: the panel overlays the table and covers Pull request, Source and Updated (STORY-033).
- She closes the panel with the collapse icon (28x28) and Ask returns.
#### Edge Cases
- No Devin agent or no model yet: Ask is drawn on the Not connected, Loading and Empty frames, but what it does there is not drawn (GAP-23, GAP-51).

#### Round 3 update (mockup v4)
- **Step 2 now has a drawn result:** frame 'Panel: first Ask' shows the intro line and two suggestions ('Anything merged today?', 'What did Devin do this week?') with the composer.
- **Artifact:** clicking Ask on the 'First visit, panel closed' frame hides the button but draws no panel (F-STORY-034-01).

#### Round 4 update (mockup v5)
- **F-STORY-034-01 resolved:** the 'First visit, panel closed' frame now contains the intro dock; clicking Ask adds the open state, hides Ask and shows the intro with 'Anything merged today?' and 'What did Devin do this week?' (1440 docked 384px; 900 overlay). Step 2 now has a drawn result.

### STORY-035: Needs-you alerts after the connector leaves or someone reconnects
**Old ID**: (new, round 2)  
**Gap IDs**: GAP-12, GAP-53  
**Related**: STORY-007, STORY-021, STORY-031, STORY-032

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Tom, a cofounder. Maya connected Devin for the space. Later Maya leaves the company and her account is removed from the space.
**Goal**: Keep getting a needs-you alert when a Devin session waits on him.
**Preconditions**: One Devin connection per space, created by Maya. Needs-you notifications go to whoever connected (decision).
**Ideal path**: 3 — the page shows who receives alerts or says none do, Tom reconnects, alerts resume to him.
**Alternate paths**: Another member reconnects first; an owner is notified once that the connector is gone.
#### Steps
1. Maya's account is removed → the shared connection stays (it belongs to the space), but its alert recipient is gone. GAP: nothing is defined for who receives alerts now.
2. A session turns Needs you → no notification reaches Tom. He sees it only if he opens the page, where the row still shows "Answer in Devin". He assumes alerts still work.
3. The Devin key is also rejected later → the page shows "Devin rejected the key." and Reconnect (STORY-007). He presses Reconnect and pastes a new key [planned]. Whether he may, and whether he becomes the alert recipient, is undefined.
#### Variations
- Tom reconnects deliberately while Maya is still in the space: alerts move from Maya to Tom. Maya is not told.
- Two members reconnect in turn: the last one receives alerts.
#### Edge Cases
- The page does not show who receives alerts, so no member can tell whether they will be alerted (GAP-53).

## Topic: Round 3 additions

### STORY-036: A member who did not connect Devin sees the key-rejected page
**Old ID**: (new, round 3)  
**Gap IDs**: GAP-49, GAP-50, GAP-54  
**Related**: STORY-007, STORY-031

**Type**: short
**Topic**: Errors, permissions and surfaces
**Persona**: Tom, a cofounder who may not replace the shared Devin connection. Maya connected it; its key was later rejected.
**Goal**: Understand why the Devin page looks stale and who can fix it.
**Preconditions**: One shared connection, key rejected, Tom is a member without connection rights.
**Ideal path**: 1 — read the notice that names who can reconnect.
**Alternate paths**: Tell Maya in chat; open Devin from a row to check the session.
#### Steps
1. [mockup v4, partly] Tom opens Devin → muted rows, header 'acme · Updated 4m ago', notice 'Devin rejected the key. Alerts are paused.' with a Reconnect button and an Ask button. GAP: the frame is drawn for a connector; a member who may not reconnect should see no button and a line saying who can (GAP-54).
2. He presses Reconnect [planned] → the dialog opens; whether it lets him replace the key is undefined (GAP-50).
#### Edge Cases
- Ask is offered, but the agent cannot read Devin with a rejected key (F-STORY-007-03).

#### Round 4 update (mockup v5)
- **Step 1 now drawn:** the member frame shows the notice 'Devin rejected the key. Alerts are paused.' with no Reconnect and no Ask, muted rows and 'Updated 4m ago' (GAP-54 resolved). Step 2 does not exist for a member (decision: members see no buttons).
- **Left:** the notice names nobody to ask (F-STORY-007-05, suggestion).

### STORY-037: A session in Error is listed under Needs you
**Old ID**: (new, round 3)  
**Gap IDs**: GAP-26, GAP-42  
**Related**: STORY-008, STORY-010

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Priya, checking the page before standup.
**Goal**: See that a session failed, and open it.
**Preconditions**: Connected; one session has status Error, two wait for input.
**Ideal path**: 2 — read the Needs you tile (3), click the Error row.
**Alternate paths**: None; a failed session does not notify (GAP-42).
#### Steps
1. [mockup v4] Priya sees Needs you 3 and the group with two 'Needs input' rows and one 'Error' row (destructive badge) → one group and one count for everything that needs her.
2. She clicks the Error row [planned: opens the session in Devin] → the row has no question and no reason, so she learns why only in Devin (GAP-26).
#### Edge Cases
- The tile counts Error sessions but the toast and push only fire for Needs input, so the page can show 3 while she was alerted about 2.

#### Round 4 update (mockup v5)
- **Unchanged and consistent in v5:** Needs you 3 on the tile and in the sidebar; the Error row carries its one-line reason ('Tests failed on acme/api') and a destructive badge. The toast and push fire for Needs input only (GAP-42).

### STORY-038: Two Devin notifications arrive while working
**Old ID**: (new, round 3)  
**Gap IDs**: GAP-06, GAP-39  
**Related**: STORY-021

**Type**: short
**Topic**: Notifications and re-entry
**Persona**: Maya, working in Inbox.
**Goal**: Act on both questions without losing either.
**Preconditions**: Connector; two sessions turn Needs input within seconds.
**Ideal path**: 2 per notification — click the toast, answer in Devin.
**Alternate paths**: Dismiss and use the page.
#### Steps
1. [mockup v4] The first toast shows over Inbox; a second arrives and the frame 'Two notifications stacked' shows a '+1' chip and the second card behind the first.
2. She clicks the front toast [planned] → Devin opens on that session; the next toast comes forward. The stacked card is not readable, so she cannot tell which session is behind it until she dismisses the first.
#### Edge Cases
- Both cards in the mockup carry the same text; the stack does not show a count of two different sessions.
#### Round 4 update (mockup v5)
- **Unchanged:** the stack still shows '+1' and the second card is not readable. A sibling toast frame now covers the unreadable-question body (STORY-021).

## Topic: Round 4 additions

### STORY-039: Nothing needs me, but sessions are running
**Old ID**: (new, round 4)  
**Gap IDs**: GAP-17  
**Related**: STORY-008, STORY-005

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Priya, checking the page after lunch.
**Goal**: Confirm that nothing is waiting on her.
**Preconditions**: Connected; two sessions Working, three earlier; none waiting.
**Ideal path**: 1 — read the Needs you tile (0).
**Alternate paths**: Open a Working session in Devin.
#### Steps
1. [mockup v5] Priya opens Devin → tile 'Needs you 0' (neutral, no amber border), 'Working 2'; no Needs you group; the sidebar link has no number.
2. She is done [drawn] → the table starts at the Working group.
#### Edge Cases
- A zero tile and a missing group say the same thing; that is acceptable because the tile gives the answer and the group's absence is not announced.

### STORY-040: A status Rakazo does not recognise
**Old ID**: (new, round 4)  
**Gap IDs**: GAP-03, GAP-36  
**Related**: STORY-009, STORY-008

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Tom, reading the table.
**Goal**: Understand a session whose status is new to Rakazo.
**Preconditions**: One session has the Devin status 'pending_review', which the mapping does not know.
**Ideal path**: 1 — read the raw text in the badge.
**Alternate paths**: Open the session in Devin.
#### Steps
1. [mockup v5] Tom sees the badge 'pending_review' in the neutral outline style, in the Working group, no alert.
#### Edge Cases
- The tile reads Working 2 while one row is Working; the frame counts the unknown row or is wrong (F-STORY-008-07). GAP-03's fix excludes unknown values from the tiles.
- The row sits under the heading 'Working', which asserts a state the badge says nobody knows.

#### Round 5 update (mockup v6)
- Resolved: the unknown row now sits under 'Earlier' and no tile counts it (Working 1, Needs you 0).

### STORY-041: Partial results
**Old ID**: (new, round 4)  
**Gap IDs**: GAP-27, GAP-16  
**Related**: STORY-029, STORY-008

**Type**: short
**Topic**: Errors, permissions and surfaces
**Persona**: Maya, after Devin returned some sessions that could not be parsed.
**Goal**: Know the list may be incomplete.
**Preconditions**: Connected; some rows failed to parse.
**Ideal path**: 1 — read the note under the tiles.
**Alternate paths**: Open Devin to see all sessions.
#### Steps
1. [mockup v5] Maya sees tiles 2 and 2, the line 'Some sessions could not be read.' in muted text between the tiles and the table, and the readable rows; the sidebar shows 2.
#### Edge Cases
- The note does not say the counts may be low, and offers no action; the table still looks complete. The count of skipped rows is not drawn (GAP-27).

### STORY-042: A session with two pull requests
**Old ID**: (new, round 4)  
**Gap IDs**: GAP-35  
**Related**: STORY-013

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Priya, checking what a session produced.
**Goal**: See every pull request a session opened.
**Preconditions**: One session has two open pull requests in different repos.
**Ideal path**: 1 — read the Pull request cell.
**Alternate paths**: Open the session in Devin.
#### Steps
1. [mockup v5] Priya sees 'acme/api#220 open' above 'acme/web#431 open' in the cell; the row grows to 59px; at 390px both appear on the meta line separated by a comma.
#### Edge Cases
- A closed-unmerged pull request has no label yet; the PR text is not itself a link (the whole row opens the session).

## Topic: Round 5 additions

### STORY-043: An owner adopts a Devin connection they already added
**Old ID**: (new, round 5)  
**Gap IDs**: GAP-24, GAP-50  
**Related**: STORY-001, STORY-031

**Type**: short
**Topic**: Connect and first visit
**Persona**: Priya, a space owner who added Devin on the Integrations page before the page existed.
**Goal**: Share her existing Devin connection with the space without pasting the key again.
**Preconditions**: The space has no shared Devin connection; Priya has a private Devin connection row.
**Ideal path**: 1 - choose "Use it".
**Alternate paths**: Paste a different key (creates a new connection); Cancel.
#### Steps
1. [mockup v6] Priya opens Connect Devin from the Not connected page -> the dialog shows "Connects Devin for everyone in this space. Read-only.", then "Use the Devin connection you already added." with the button "Use it", then the key field and "Where to find your key".
2. She chooses "Use it" [planned] -> the dialog closes and /app/devin opens with sessions.
#### Edge Cases
- The caption under the frame says pasting a key creates a new connection; the dialog itself does not say so. Acceptable: it is the less likely path.
- Connect stays disabled until a key is typed; "Use it" is the only enabled primary action.

### STORY-044: The member who connected Devin leaves the space
**Old ID**: (new, round 5)  
**Gap IDs**: GAP-53, GAP-49  
**Related**: STORY-007, STORY-031

**Type**: short
**Topic**: Errors, permissions and surfaces
**Persona**: Priya (space owner) and Tom (member).
**Goal**: Understand why alerts stopped and, for the owner, fix it.
**Preconditions**: The connecting member left; rows are cached from 4 minutes ago.
**Ideal path**: Owner: 1 - choose "Reconnect". Member: 0 - read the notice.
**Alternate paths**: Owner closes the page and does nothing.
#### Steps
1. [mockup v6] Priya opens Devin -> header "Updated 4m ago", the notice "The member who connected Devin left this space. Alerts are paused." with "Reconnect", muted rows, no tiles, no Ask, no sidebar count.
2. She chooses "Reconnect" [planned] -> the connect dialog opens.
3. [mockup v6] Tom opens Devin -> the same notice plus "Ask a space owner to reconnect.", no button, muted rows, no Ask, no sidebar count.
#### Edge Cases
- The Integrations card "Needs reconnect" state is a build item (plan S3b).

