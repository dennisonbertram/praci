# Walk R3 (iteration 13): verify pass-12 clusters C21-C26

Target: demo stack web :5381, 1440x900 (1920x1080 for C23). Session uxl13-R3 (seeded Maya) and uxl13-R3b (fresh invented user walker-r3-*@northwind.example.test for first-run). Screenshots: /tmp/uxloop13/R3/.
Note: clusters.json holds C1-C26 only. C27-C31 do not exist, so nothing to verify for them.

## Verdicts (cluster acceptance criteria; the clusters have no step lists)

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C21 Activity panel labels | PASS (partial) | 2/2 | Status label now on its own line under the row title ("Needs your answer" amber, "Running"). Group heading is screen-reader only, so no heading/label mismatch. List ends on "Show 6 finished runs", not mid-row. The held-approval label ("Needs approval") was not exercised (no approval pending; payment flows avoided). See R3-13-01. |
| C22 Chief and agent answers | PASS (partial) | 3/3 | First-ask choices are distinct (A Run my company, B Day-to-day work, C Research and writing; "A bit of everything" gone). Choice A posts one sentence plus Gmail and Calendar cards. Finance agent answered in local time ("October 22, 2026 at 6:14:03 AM your local time (America/New_York)"). Not tried: stale "no bank" answer after bank connect (needs a connect flow; BLOCKED, mock bank is already connected for Maya). |
| C23 Wide tables, dead bands | PASS | 4/4 | At 1920: Contacts fills the page; Data room gives extra width to Name; Subscriptions sits full-width under Upcoming; Accounts page has no "Card balance owed" tile. See R3-13-02 for a remaining empty area. |
| C24 Integrations cards | PASS (one residual) | 2/2 | Blockscout and Coinbase "..." sits in the tile corner; every Connected card button ends at the same right edge as its row neighbours; gutters 28 px left and 28 px right. Carta still shows a letter tile (R3-13-03). |
| C25 Labels, menus, palette | PASS | 6/6 | "No folder" in Move to; Clear conversation only in Chief settings footer (not in the row menu); Add skill opens the New skill form directly with Name focused (Save, Cancel, Upload file, From URL inside); Settings > General has no "Notifications" card heading (bare "Browser notifications" switch card); Cmd+K "board deck" shows link text "MOCK Q3 Board Deck.md", no raw [text](url). Four-row-heights item not measured. |
| C26 Visual polish | PASS (partial) | n/a | Settings dialog and Privacy cards look consistent; Memory not opened. Not verified: primary hover opacity on dark, phone (375 px) card width, placeholder ellipsis for long names (code: placeholder cut at 32 chars, apps/web/src/pages/shell/composer.tsx ~527). Financing marker sits on the chart's top gridline area in Finance Burn chart. |
| Chat consent (pass-12 decision, shipped with this batch) | PASS | 3/3 | Fresh user's first chat message pauses on "Share your chats and mail with the AI model that runs your bots?" with Allow and Not now; composer says "Waiting for approval"; after Allow the card shows "Allowed" and Chief answers. |
| Storybook smoke | BLOCKED | n/a | The worktree has no node_modules, so `pnpm build-storybook` there fails ("storybook: command not found"). Building in the owner's main checkout (output to /tmp) was refused by the permission check, so I did not work around it. No story was rendered; 0 failing stories known. Needs a worktree with installed dependencies. |

Console: no page errors seen in either session. Geometry audit (Activity, Integrations): pageOverflowX 0, no wrapped controls; the only spills reported were chat bubbles (spill 124 px, benign, bubbles are w-fit in a scroll area).

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R3-13-01 | C21, sidebar row and composer | P3 | copy | Observed: a pending AI-consent card shows "Needs your answer" on the sidebar Chief row but "Waiting for approval" in the composer. The C21 goal was one label per state. | /tmp/uxloop13/R3/23-consent.png | apps/web/src/lib/roster-status.ts:14 (needsAnswerLabel used for every waiting_input row; Activity only says "Needs approval" when needsApproval is set, ActivityList.tsx:544) | Pass the needs-approval flag into the sidebar row label, or use the same word in the composer. |
| R3-13-02 | C23, Finance at 1920 | P3 | visual | Observed: Breakdown card stretches to the height of the Upcoming + Subscriptions column, leaving about 290 px of empty card below "Meals". | /tmp/uxloop13/R3/03-finance-1920.png | apps/web/src/pages/Finance.tsx (two-column grid, card stretch) | Align the Breakdown card to its content height (items-start) or move Subscriptions into the left column. |
| R3-13-03 | C24, Integrations | P3 | visual | Observed: Carta still renders a letter tile "C" while all other connected cards have logos. | /tmp/uxloop13/R3/05-integrations.png | apps/web/src/components/integrations/IntegrationsHome.tsx, logo assets | Add the Carta logo asset. |
| R3-13-04 | C9 (still open), Finance with docked agent | P3 | visual | Observed: the persistent approval toast sits over the Breakdown rows beside the open Finance agent panel (hides Servers..Software amounts). | /tmp/uxloop13/R3/22-finagent.png | toast host in apps/web/src/pages/Shell.tsx (suspected, not traced) | Anchor the toast to the bottom-right of the viewport, clear of the docked panel and page content (C9 fix). |
| R3-13-05 | Perf, cold load of /app/finance | P3 | perf | Observed once: a full reload of /app/finance showed "Opening Praci..." then "Still opening... Try again" for over 12 s before the page rendered. Machine load average was about 16 and the dev server serves hundreds of unbundled modules, so this is probably the demo environment, not the product (suspected, not reproduced under normal load). | /tmp/uxloop13/R3/03-finance-1920.png | n/a | Re-measure on a built (non-Vite-dev) stack before acting. |

## Praise
- The first-run thread is clear: three distinct choices, one sentence plus two cards after choosing, and a consent card with a plain "Not now".
- Integrations page is now evenly aligned; Connected cards all share one button position.
- Palette search results show readable snippets with the match underlined.
- Accounts page is clean without the empty tile.

## Not covered
Held-approval labels (needs a payment/approval flow, avoided to not collide with other walkers), bank-connect stale answer, phone widths (375 px) for C26, hover opacity, Storybook smoke (blocked above).
