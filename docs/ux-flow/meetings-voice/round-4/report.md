# UX Flow Critique, round 4: Granola and Wispr Flow (2026-10-20)

**Evidence:** the current plans, the refreshed story steps in `catalog.md`, and both mockups driven in a browser at desktop width, plus 375 px for the citation sheet and the Voice pane. Every count is as planned or as mocked; nothing is built or user-tested.

## Verdict

- **Round-3 defects:** R3-1 to R3-4 and the Fish Audio drift are fixed.
- **R3-5:** unchanged, because the maintainer decided it.
- **Journeys:** none gained a step, a decision, a confirmation or a dead end.
- **New findings:** three low-severity ones remain.

## Scorecard (actual / ideal)

| Journey | Round 3 | Round 4 |
|---|---|---|
| GS-1 (to the first answer; to the to-do) | 6/5; 7/6 | 6/5; 7/6. The gap is the agent-link click; opening the chat automatically was rejected |
| GS-3 | not scored | 6/5 |
| GS-5 | not scored | 4/4 |
| IF-1 | 2/2 | 2/2 |
| IF-2 | 1/1 | 1/1 |
| IF-5 | not scored | 4/4 |
| MX-8 | 13/12; 10/9 | 13/12; 10/9 |
| WF-6 | 7/7; 7/7 | 7/7; 7/7 |
| WF-7 | 1/1 | 1/1 |
| MB-1 | 4/4 | 4/4 |
| MB-2 | not scored | 3/3 for a rejected key; 2/2 for a revoked key |
| MB-5 | 5/5 | 5/5 |

No journey has a needless decision. Delete is the only confirmation, because it cannot be undone.

## Round-3 items

| Item | Status |
|---|---|
| R3-1: two status rows on the phone | Fixed. Only "AI data sharing off" shows. |
| R3-2: passive Reconnect stated twice | Fixed. The red line shows only after a failed Connect. |
| R3-3: composer drawn inside the cap card | Fixed. The "Ask Elio" composer sits below the card. |
| R3-4: Both connected not drawn | Fixed. Each route has its own Disconnect. |
| R3-5: Disconnect keeps data | Unchanged, by decision. |
| Fish Audio missing from the phone list | Fixed. |

## New findings (all low)

- **N4-1: the "Both connected" route labels differ between the plan and the mockup.**
  - The plan and GS-3 say "via MCP" and "Granola API key"; the mockup says "Sign-in" and "API key".
  - Fix: use "Sign-in" and "API key" in the plan and in GS-3, and list them as copy for the S6 PR to quote.
- **N4-2: the Sign-in only state has no agent link on the page, which drops an existing `McpDetail` control.**
  - Fix: one plan sentence saying the compact sign-in row keeps the agent link while no key route is connected. Draw it in the mockup.
- **N4-3: the Flow phone "key" frame cuts off the consent sentence.**
  - This affects the mockup only.
  - Fix: make the footer visible.
