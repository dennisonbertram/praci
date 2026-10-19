# Integrations — findings

Surfaces: Integrations home (Connect apps pill, Connected grid, Finance tiles, catalog), MCP detail pages (Mercury, Brex, Carta, Blockscout) with Agent section, Allow changes and its confirmation, Gmail connected-app page, Create agent busy state and landing. Viewports 1440x900, 768x1024, 375x812. Mock demo stack only. Screenshot paths are relative to this folder.

Totals: 32 findings — P0 0, P1 2, P2 19, P3 11. Component 17, group 6, page 4, layout 2, flow 1, state 2.

Limits: the demo API's Postgres connection timed out repeatedly, so the app sat on "Reconnecting" or the sign-in form for stretches (INT-29). Other inspectors changed the same demo data. A Brex agent was created and Allow changes in Brex turned on (fake data). Not exercised: Gmail Create agent; a Create agent error state. Not captured at 768 and 375: the post-create Agent section and the Brex confirmation dialog (the Carta dialog stands in).

## Verdict per viewport and state

**1440x900**
- home (`shots/1440-home.png`, `-end`, `shots/1440-home-hover-mercury-tile.png`): calm, well grouped, fast to scan; Connected grid above the fold. Short of excellent on tile affordance (INT-1), Coinbase misalignment (INT-3), avatar stack capped at 5 (INT-4).
- mercury-agent / brex-agent: structure right and identical across servers; content weak (duplicate agent, "Only this agent", "via MCP", the risky switch looks ordinary).
- brex-create (`shots/1440-brex-create.png`, `-focus.png`): four equal outline buttons, no primary; Create agent third. Focus order and ring good.
- create-agent busy / landing (`shots/1440-create-agent-busy.png`, `shots/1440-after-create-agent-chat.png`): almost no feedback, then a blank chat.
- allow-changes dialog / on (`shots/1440-allow-changes-dialog.png`, `shots/1440-allow-changes-on.png`): right friction, Cancel focused, Escape returns focus to the switch; button styling and the on-state are the problems.
- carta, blockscout: Carta hides the MCP host (good), but its Used by list collapses to one row that repeats the Agent card.
- gmail (`shots/1440-gmail.png`, `-end`): a different pattern from the MCP pages and the least safe-looking page.
- connect-apps pill (`shots/1440-connect-apps-pill.png`): tiny "G G S" badges; label changes to "Integrations" when active.

**768x1024**: sidebar stays 316 px (41%), so the Connected tiles become one long column and the catalog is out of view (INT-10); Gmail Tools descriptions squeezed to about 130 px (INT-11); detail header logo stacks over the title on Blockscout but not Brex or Mercury (INT-24).

**375x812**: no horizontal overflow anywhere; touch targets 26–34 px (INT-25); dialog title centred but its bullet left-aligned; "Opening your Space…" is a blank skeleton; "Reconnecting … Retry now" didn't recover the session (only a reload did).

## Findings

| id | level | element | problem | norm | evidence | sev | found by | verified |
|---|---|---|---|---|---|---|---|---|
| INT-1 | component | Finance tile names | Name is a stretched link to the MCP page but looks like plain bold text; finance tiles have no hover (generic tiles do); the only visible button leaves the page. | I1, I8, H5 | `shots/1440-home-hover-mercury-tile.png`; source | P1 | own, muse, argon | observed + source |
| INT-2 | group | Tile action buttons | "Open Inbox", "Open Cap table", "Open Finance" ×3, "Replace key" + "Open", bare "…" mean different things in one slot; none is the main job (choose bots). | C1, H5, H1 | `shots/1440-home.png` | P2 | own, muse, argon | observed |
| INT-3 | group | Coinbase tile | No Used by row, so its status row sits about 30 px lower than neighbours; two different buttons. | L4, H6, D4 | `shots/1440-home.png` | P2 | own, muse, argon | observed |
| INT-4 | component | Used by avatar stack | Max five 20 px avatars, no "+N"; Gmail has 8 bots on but 5 show. | C3, C2, A2 | `1440-home.png` vs `1440-gmail.png`; `parts.tsx` | P2 | own, muse, argon | observed + source |
| INT-5 | component | "Connected" pill | Outlined chip like the adjacent buttons but not interactive. | I1 | `1440-home.png` | P3 | argon | observed |
| INT-6 | page | Naming | "Connect apps" vs "Integrations"; copy mixes "bots" and "agent". | C1, H5 | `1440-connect-apps-pill.png`, `1440-home.png` | P2 | own, muse | observed |
| INT-7 | component | Connect apps pill badges | Three 16 px badges "G G S", two identical. | C4, A2 | `1440-connect-apps-pill.png` | P3 | own | observed |
| INT-8 | group | Find an app | Filter chips don't match the sections; sparse sections leave rows two-thirds empty; two Search fields on screen. | H5, D2, P2 | `1440-home.png`, `1440-home-end.png` | P3 | own, muse | observed |
| INT-9 | component | Add a custom connection tile | Title and text 16 px (other tiles 14/12); title repeated in its button. | H3, C2 | `375-home-end.png` | P3 | own | observed |
| INT-10 | layout | Tablet shell | Sidebar pinned at 316 of 768 px; Connected tiles fill a 1024 px column, catalog out of view. | L6, L7 | `768-home.png`; audit.json 768/home | P2 | own, muse, argon | observed |
| INT-11 | component | Gmail Tools rows at 768 | Viewport breakpoint (`sm:grid-cols-[13rem_1fr]`) inside a 452 px panel; descriptions wrap to four lines. | L6, D1 | `768-gmail-end.png`; `AppDetail.tsx` | P2 | own | observed + source |
| INT-12 | component | Detail header logo | `McpDetail` renders `AppLogo` without the known logo: real logos on home tiles, letters on detail pages. | H5, P1 | `1440-home.png` vs `1440-mercury-agent.png`; `McpDetail.tsx` | P2 | own, muse, argon | observed + source |
| INT-13 | group | Header action row | Reconnect, Disconnect sign-in, Create agent, Rename are equal outline buttons; Reconnect shown on a healthy connection; Create agent third and unexplained. | H1, I5, C1 | `1440-brex-create.png`, `375-brex-create.png` | P2 | own, muse, argon | observed |
| INT-14 | group | Agent card + Used by | Agent appears twice (Agent card and a Used by switch that removes its own access); with Only this agent on, Used by shrinks to that row. | C2, I3 | `1440-brex-agent.png`, `1440-carta.png` | P2 | own, muse, argon | observed (#157 related) |
| INT-15 | component | "Only this agent" switch | Unfinished label; hint introduces bot-to-bot delegation; hints don't state the current state. | C1, C4 | `1440-mercury-agent.png`; `IntegrationAgentSection.tsx` | P2 | own, muse, argon | observed |
| INT-16 | component | Allow changes switch when on | Looks like the harmless Used by switches; nothing says it can now change data (asking first). | H2, C3 | `1440-allow-changes-on.png` | P2 | own, muse | observed |
| INT-17 | component | Allow changes confirm dialog | Grant uses the destructive button (red text on 20% red tint, about 3.7:1); one sentence as a one-item bullet; no concrete changes named; title centred, bullet left at 375. | A1, H4, C4, L4 | `1440-allow-changes-dialog.png`, `375-allow-changes-dialog-carta.png`; `ConfirmDialog` in `AppDetail.tsx` | P2 | own, muse, argon | measured |
| INT-18 | component | Create agent busy state | Only Create agent and Disconnect dim; Reconnect and Rename stay active; no spinner. | I2, I8 | `1440-create-agent-busy.png`; `McpDetail.tsx` | P2 | own | observed |
| INT-19 | flow | After Create agent | Lands on an empty chat with only "Message Brex agent": nothing on what it can read or that changes are off. | I6, C3, D2 | `1440-after-create-agent-chat.png` | P2 | own | observed (#158 related) |
| INT-20 | component | Used by rows | Bot name isn't clickable; the only target is the 32x18 switch about 960 px away at 1440. | I1, I4, I7 | `1440-brex-agent.png`; `parts.tsx`, `switch.tsx` | P2 | own | click test + source |
| INT-21 | group | Gmail account rows | Rename, Create agent, Remove account as three equal buttons per account. | I3, H1, C1 | `1440-gmail.png`, `375-gmail.png` | P2 | own, muse, argon | observed |
| INT-22 | page | Gmail permissions | All 8 bots on (including Carta, Legal and the Mercury agent) and no Allow changes switch although write tools exist; the MCP pages gate writes. Whether the default is intended is unknown. | P1, I3 | `1440-gmail.png`, `1440-gmail-end.png` | P1 | own, muse, argon | observed (default suspected) |
| INT-23 | component | Remove row | Gmail remove text 16 px, MCP pages 14 px; text drops under the button at 768/375. | H3, H5 | `1440-gmail-end.png` vs `1440-brex-agent.png` | P3 | own, muse | observed + source |
| INT-24 | layout | Detail header wrap | Logo stacks above the title when the host line is long, inline otherwise. | L5, H5 | `375-mercury-agent.png` vs `375-brex-create.png` | P3 | own, argon | observed |
| INT-25 | component | Touch targets at 375 | Header buttons 32, tile buttons 28, chips 26, switch hit area about 34, back link 20 px; all below 44. | I4 | audit.json 375/mercury-agent | P2 | own, muse, argon | measured |
| INT-26 | component | "via MCP · host" | Protocol jargon for a founder; Carta already hides it. | C1 | `1440-mercury-agent.png` | P2 | own, muse, argon | observed |
| INT-27 | component | Back link | 20 px tall; browser-default focus outline while other controls use the 3 px ring. | I4, I7 | DOM measure; `1440-brex-create-focus.png` | P3 | own | measured |
| INT-28 | page | Tools section only on Gmail | The only statement of what a bot can do (Read/Write) is on Gmail, below the fold; MCP pages have none. | H5, P1 | `1440-gmail-end.png` | P3 | muse | observed |
| INT-29 | state | App shell on API failure | "Reconnecting … Retry now" didn't recover (a reload did); a failed session lookup showed the sign-in form with no explanation (cause: database timeouts). | I3, I2 | `375-server-unreachable.png`, `375-loading-space.png` | P2 | own | observed (cause suspected) |
| INT-30 | state | Coinbase tile arrival | Right after reload the Coinbase tile was missing, then appeared in the same row. | L5 | `1440-home-hover-mercury-tile.png` vs `1440-home.png` | P3 | own | suspected (single sighting) |
| INT-31 | page | Type and spacing scale | Home uses 8 font sizes and off-scale gaps (counts include the sidebar). | H3, D3 | audit.json 1440/home | P3 | own | measured |
| INT-32 | component | Gmail account identity | Only a nickname and connect date; the mailbox address isn't visible. | C3 | `1440-gmail.png` | P3 | muse | suspected |

`layout-audit.js` reports text contrast of 1.2–1.4 almost everywhere; that's an artifact (it can't resolve oklch/color-mix backgrounds), so no finding relies on it. INT-17 uses the real button colours.

Likely sources (verified): `FinanceSection.tsx`, `IntegrationsHome.tsx` (INT-1–3, 8, 9, 30, 31); `parts.tsx`, `packages/ui-web/src/components/ui/switch.tsx` (INT-4, 5, 14, 20); `ConnectAppsButton.tsx`, `pages/Shell.tsx` (INT-6, 7, 10); `AppDetail.tsx` (INT-11, 17, 21–23, 28, 32); `McpDetail.tsx`, `AppLogo.tsx` (INT-12, 13, 18, 19, 24, 26, 27); `IntegrationAgentSection.tsx` (INT-15, 16); `button.tsx` (INT-25); `App.tsx` (INT-29). All under `apps/web/src/components/integrations/` unless a package path is given.

## Second opinions rejected or downgraded

- [argon] "switches have no distinct on fill" — rejected; on and off are visibly different. Valid parts are in INT-16 and INT-25.
- [argon] "dialog buttons should be right-aligned" — rejected; they are.
- [muse] "Remove falls below the fold at 375" — rejected; the panel scrolls.
- [muse] "no way to manage an integration from a tile, P0" — downgraded to INT-1 (P1).
- [muse] "Allow changes scoped only to the agent while Used by grants others direct access, P0" — not verified; the switch is server-level (`setWrites`) but the copy says "the agent". Folded into INT-15/16 as a wording risk; needs a product answer.
- [argon] "sidebar clipped mid-row, P0" — merged into INT-10 (P2).

## Excellent as is

- Home intro sentence and Connected grid: plain language, status, destination and users in one tile, above the fold at 1440.
- The Allow changes hint ("Off: the agent only reads. On: it can also make changes, and asks you before each one.") answers the founder's real worry.
- Enabling writes needs a confirmation; Cancel is the default focus; Escape returns focus to the switch.
- Detail pages share one structure (Agent, Used by, Remove).
- Gmail's tool list grouped by risk with a right-aligned guarantee — worth copying to the MCP pages.
- Keyboard: logical tab order, 3 px focus ring, every switch has an accessible name.
- No horizontal overflow at any viewport; the panel scrolls, the page doesn't.
- Carta hides the MCP host.
