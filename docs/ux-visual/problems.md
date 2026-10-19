# Problem register — new integration features

Sources: `pages/integrations/findings.md` (INT, 32), `pages/agent-chat/findings.md` (CHAT, 16), `pages/inbox-sync/findings.md` (INB, 13). Mock demo stack, three viewports.

Coverage gaps: Elio voice entry points and Chief messaging an integration agent were not reached (demo API outage). Gmail Create agent and a Create agent error state were not exercised. Settled 768 after-retry and idle 375 rate-limited Inbox shots are missing.

Ranking: severity × reach × centrality ÷ effort. Clusters 1–4 go forward this run; the rest are deferred.

## Carried forward

### UXV-1 Raw tool names reach the interface (P1)
- Root cause: the working label and the approval title use the tool's machine name (`Using Getaccounts`, `Review before mcp__finance-mercury__…`), and the sidebar previews that title.
- Findings: CHAT-1, CHAT-2; related open issue #151 (raw JSON on the card).
- Surfaces: every integration agent chat, sidebar rows. Sources: `apps/web/src/pages/Shell.tsx`, `packages/adapters/src/approval-ask.ts`, `packages/adapters/src/executor.ts`.
- Acceptance: no visible label, title or preview contains `mcp__`, an underscore-joined id, or a camelCase tool id; a tool call reads as a plain verb phrase (e.g. "Checking accounts"); unit test over the label function with MCP, connector and built-in tool names.

### UXV-2 Inbox retry loses focus and gives no result (P1)
- Root cause: Try again is `disabled` while busy, which drops keyboard focus to the body, and a retry that fails again leaves the page identical; the copy says "wait" over a live button.
- Findings: INB-1, INB-2, INB-3, INB-6; related open issue #161.
- Sources: `apps/web/src/pages/Inbox.tsx`, `apps/web/src/lib/inbox-sync-error.ts`.
- Acceptance: focus stays on Try again during and after a retry (measured `document.activeElement`); a retry that fails again changes something visible and announced; the notice copy doesn't contradict the button; no layout shift.

### UXV-3 Finance tiles hide their link (P1)
- Root cause: Finance tiles stretch the name into a link but have no hover or link styling, and their only visible button leaves the page; Coinbase lacks the Used by row so its status row is misaligned.
- Findings: INT-1, INT-2, INT-3.
- Sources: `apps/web/src/components/integrations/FinanceSection.tsx`, `IntegrationsHome.tsx`.
- Acceptance: finance tiles have the same hover and pointer affordance as other tiles; tile rows align (badge y within 2 px across a row); keyboard focus on the tile link is visible.

### UXV-4 Approval and status colours don't match meaning (P2, wide reach)
- Root cause: the approval card and notices pick colours by component, not by meaning. Answered cards are green for any non-deny answer; granting Allow changes uses the destructive button; a transient rate limit is red above cached mail but grey without it; the answered card keeps raw JSON as the main content and the outcome is a small coloured line; Allow once is the only filled button on a payment.
- Findings: CHAT-6, CHAT-7, CHAT-8, CHAT-9, INT-17, INB-5; related open issues #150, #151, #156.
- Sources: `apps/web/src/components/AskCard.tsx`, `ConfirmDialog` in `apps/web/src/components/integrations/AppDetail.tsx`, `apps/web/src/pages/Inbox.tsx`.
- Acceptance: success colour only for a completed action; destructive only for destroying or denying; transient problems use warning; an answered card shows its outcome with an icon and words first; the grant button in the Allow changes dialog meets 4.5:1.

## Deferred (filed as issues)

| id | title | findings | note |
|---|---|---|---|
| UXV-5 | Tablet shell: sidebar pinned at 316 px of 768 | INT-10, INB-12, CHAT-3, CHAT-11, INT-11 | Addressed by the unmerged `ux-visual/shell` branch (VIS-01, dock sidebar from 1024); rebase and land it rather than redo. |
| UXV-6 | Integration detail page structure | INT-12, 13, 14, 15, 16, 18, 19, 26, 28 | Overlaps #155, #157, #158. |
| UXV-7 | Touch targets below 44 px on phones | INT-25, INT-27, INB-7, CHAT-10 | Design-system button sizes on coarse pointers. |
| UXV-8 | Gmail page: every bot on, no write switch | INT-22, INT-21, INT-32 | Product question: Gmail writes already need a per-action approval. |
| UXV-9 | Thinking timer counts time waiting for the user | CHAT-5 | |
| UXV-10 | Computer panel is empty for integration agents | CHAT-4 | |
| UXV-11 | Reconnect "Retry now" doesn't recover; send errors are bare | INT-29, CHAT-15 | Seen during a demo database outage; needs a reproduction. |
| UXV-12 | Integrations copy and catalog polish | INT-4–9, INT-23, INT-24, INT-30, INT-31, INB-8–11, INB-13, CHAT-12–14, CHAT-16 | Mostly P3; some overlap #160. |
