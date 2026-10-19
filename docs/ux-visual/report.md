# /ux-visual — new integration features

Scope: Integrations (Connect apps pill, Finance tiles, MCP and connected-app detail pages, Create agent, Allow changes), integration-agent chat and approval cards, Carta agent, and the Inbox Gmail sync notices. Mock demo stack only, at 1440x900, 768x1024 and 375x812. Screenshots are kept locally and not committed; the written findings are the record.

## Coverage

| Page | Findings | Notes |
|---|---|---|
| `pages/integrations/` | 32 (P1 2, P2 19, P3 11) | Demo database timeouts interrupted parts of the run. |
| `pages/agent-chat/` | 16 (P1 3, P2 10, P3 3) | Elio and Chief messaging an integration agent were not reached (demo outage). |
| `pages/inbox-sync/` | 13 (P1 1, P2 6, P3 6) | Cached-mail notice states were simulated by wrapping the list response. |

Each page folder has `findings.md`, `audit.json` (layout and geometry measurements) and `second-opinion.json` (meta/muse-wonder and google/gemini-4-argon critiques, each claim checked before it was accepted).

## Process note

`problems.md` groups the findings into 12 root causes. For the four clusters carried forward, the decision documents in `decisions/` were written by the orchestrator. The skill's three competing designs and three-judge panel per cluster were skipped, because these fixes were small and well defined.

## Fixed and verified

| Cluster | Decision | Verified on the demo |
|---|---|---|
| UXV-1 Raw tool names | One humanizer (`humanizeToolName`) splits camelCase; it is used by the working label, the approval title and the sidebar preview. | "Get recipients" working label; card title "Review before Request send money → 1200"; no `mcp__` in the title or preview. |
| UXV-2 Inbox retry | Try again stays focusable (`aria-disabled`); "Gmail is still limiting requests." after a failed retry; the notice no longer says to wait; rate limits use the warning colour. | Focus held during and after the retry; still-limited text in the alert; warning colour; button width unchanged (81.7 px). |
| UXV-3 Finance tiles | Same hover as the other tiles, a focus ring on the stretched link, status rows aligned. | Hover background matches; ring visible; badge y equal across each row. |
| UXV-4 Approval colours | Denied uses the destructive colour with an X; allowed answers are neutral with a check; other answers are muted; the Allow changes grant button is primary. | All states measured; grant button contrast 14.96:1. |
| #150 One approval per change | Integration and Carta agents no longer ask for their own confirmation before the approval card. | One card for a payment; Deny shows Denied and the agent confirms nothing was submitted. Existing agents keep their old instructions until recreated. |

## Deferred

Filed as issues: #168 (tablet sidebar; the unmerged `ux-visual/shell` branch covers it), #169 (detail page structure), #170 (touch targets), #171 (Gmail page permissions), #172 (thinking timer), #173 (empty Computer panel), #174 (reconnect and send errors). UXV-12 polish is listed in `problems.md`; much of it overlaps #160. Still open from the walk: #151 (raw JSON in the card body, and the amount in the title has no currency).

## Excellent as is

Plain intro copy and the Connected grid on Integrations; the Allow changes hint and its confirmation (Cancel focused, Escape returns focus); one shared detail-page structure; keyboard order and named switches; the Mercury answer's as-of date; a pending approval surviving a reload; the reconnect and rate-limit notices reading as siblings; cached mail staying visible when a sync fails.
