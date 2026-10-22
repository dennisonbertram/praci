# Walk R3 (session uxl18-R3): verify pass-17 clusters C21-C24 + Storybook smoke

Target: mock demo stack http://127.0.0.1:5381 (served from the main checkout at 3f850cdf2, which contains the pass-17 merges #763-#767), 1440x900, logged in as the demo founder. Screenshots: /tmp/uxloop18/R3/.
Scope note: clusters.json for iteration 17 holds 24 clusters (C1-C24). C25-C31 do not exist, so only C21-C24 were verified.
Environment note: the machine load average was 55-215 during the walk (many parallel walkers plus Storybook build), so timings are upper bounds. A first cold load of /app/artifacts stayed on "Still opening..." for about 25 s at load 56, then loaded; at load 180 it took 0.9 s. Other walkers were creating bots and approvals on the same stack, so sidebar rows and toasts changed during the walk.
Fresh user created for the first-run check: walker-r3@northwind.example.test (random password, not recorded).

## Story verdicts

- C21 Integrations, "every connected card has the same actions row": FAIL (observed). Gmail, Carta, Mercury and Brex have no "..." menu; Blockscout and Coinbase do. Steps 1/1 (open page). Evidence 21-int.png.
- C21 Integrations, "grid still loading after 2 s says Loading integrations...": PASS (observed with fetch delayed 5 s; skeleton plus "Loading integrations..." at 3 s). 21-slow-3s.png.
- C21 Integrations, "after Done, focus lands on the new card": BLOCKED (needs a real Connect flow; code at IntegrationsHome.tsx:552-560 does focus the card, not observed live).
- C21 Carta letter tile: still a plain "C" tile (observed, P3, no acceptance criterion). 21-int.png.
- C22 Cold load duplicate calls: FAIL (observed). /app/gtm cold load: bots/list x5, routines/list x1, bootstrap x2 (the dev build uses React StrictMode, which doubles effects, so bootstrap 2 = 1 real call; bots/list is still about 2.5 real calls). /app/artifacts: bots/list x5, bootstrap x2.
- C22 Re-measure /app/gtm and /app/artifacts: PASS under load (1.2 s and 0.9 s to heading with no skeleton at load 180). The earlier 12-25 s runs coincided with a load of 55 and are not a product measurement. "Still opening..." and "Opening Praci..." messages show on slow first frames (22-artifacts.png, 24-signup1.png).
- C23 Composer reachable in at most 10 Tabs on a 30-message chat: FAIL (observed). From the Chief header it takes 27 Tab presses (was 59); every message has its own "More" button as a tab stop, and there is no skip-to-composer.
- C23 One Escape closes the PDF preview: FAIL (observed, reproduced twice) for the Full screen preview dialog: the first Escape does nothing, the second closes it. Initial focus is "Open in new tab", not Close. The side preview pane closes with one Escape. 23-esc-after.png.
- C23 Reason/unread dot has an accessible name: PASS (inbox rows are named "Priya Placeholder (unread) ...", sidebar rows "(unread)").
- C24 Loading card uses theme tokens on dark theme: PASS by code (InboxMessageDialog.tsx:603 now bg-card); the loading state was too fast to catch on screen. The HTML body canvas at line 613 is still bg-white (intended email canvas).
- C24 "Show more" does not shrink the To do card: PASS (observed; card grows 181 to 334 px, top stays at 124; collapsing shrinks it, as expected). 24-todo-open.png.
- C24 First-run question reads "What should I work on first?": PASS (observed on a fresh sign-up; options A/B/C present, close X). 24-signup2.png.
- C24 Finance numbers vs agent answer: PASS (Chief says $1,633,221 cash, $67,621 monthly net burn, about 24 months; Finance page shows $1,633,221, $67,621, 24.2 mo). 24-finance.png.
- C24 Data room preview/grid/stats and Cmd+K palette: PASS for what was seen (list, grid, stats render cleanly, no overflow; palette lists pages). 24-dr-grid.png, 24-dr-stats.png, 24-palette.png.
- Storybook smoke (`cd apps/web && node .storybook/smoke.mjs storybook-static` after `pnpm build-storybook`): PASS, 1779/1779 stories rendered cleanly, no failing stories. (Needed `pnpm install --offline` in this worktree first because node_modules was missing.)

Geometry audit on /app/integrations: no page overflow, no overflow spills, no wrapped controls. Console on Integrations: no errors.

## Findings

| id | sev | cat | status | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| R3-01 | P2 | flow | observed | Connected cards are not uniform: Blockscout and Coinbase show a "..." menu, Gmail, Carta, Mercury and Brex show none. Cluster C21 asked for the same actions row on every connected card. | 21-int.png | apps/web/src/components/integrations/FinanceSection.tsx:122,167,242 (TileMenu only on those tiles); IntegrationsHome.tsx tiles | Give every connected card the same "..." menu (open, disconnect or manage), or remove it from all and keep it on the detail page. |
| R3-02 | P3 | visual | observed | Carta tile still shows a plain letter "C" while every other connected app shows a logo. | 21-int.png | apps/web/src/components/integrations/AppLogo.tsx (BUNDLED set has no carta; no vendored mark) | Vendor a Carta mark in public/logos and pass it from the Carta tile. |
| R3-03 | P3 | a11y | observed | From the Chief header the composer is 27 Tab presses away on a 30-message chat (acceptance: at most 10). Each message adds a "More" tab stop. | Tab trace in session | Shell message toolbar (apps/web/src/pages/Shell.tsx message action buttons) | Use roving tabindex for per-message actions, or add a skip-to-composer link. |
| R3-04 | P3 | a11y | observed | Data room Full screen PDF preview needs two Escape presses; first Escape is ignored. Initial focus lands on "Open in new tab" instead of Close. | 23-esc-after.png | apps/web/src/components/data-room/PreviewActions.tsx and the full-screen dialog in the Preview component | Make the full-screen dialog's Escape handler close on the first press (check the iframe and initial-focus handling) and focus Close first. |
| R3-05 | P3 | perf | observed count, suspected cause | Cold load of /app/gtm and /app/artifacts calls bots/list 5 times (about 2-3 real calls after halving for dev StrictMode); acceptance is at most 2. | network request log, same session | apps/web/src/components/AppToaster.tsx:57 (bots.list per notification), apps/web/src/components/integrations/useIntegrations.ts:111, Shell.tsx sidebar data | Read bots from the shared bootstrap/sidebar query in AppToaster instead of calling bots.list per notification. |

Praise: the first-run question, the slow-load messages ("Loading integrations...", "Opening Praci...", "Still opening... Try again"), Inbox row accessible names, the Integrations detail page (Mercury: agent, write toggle, Used by list), and Finance numbers matching the agent's answer are all clear and correct.
