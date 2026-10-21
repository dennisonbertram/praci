# Walk R3: verify pass-2 clusters C23-C32

Target: mock-data demo stack (web :5381), Maya Chen, 1440x900 unless noted. Screenshots in /tmp/uxloop3/R3/ (outside the repo).
Method note: acceptance lines from docs/ux-loop/iteration-2/clusters.json were checked one by one. Steps are "actual/ideal" for the check path.

## Storybook smoke
`pnpm --filter @rakazo/web build-storybook` then `node .storybook/smoke.mjs`: 1498/1498 stories rendered cleanly. Failing stories: none.

## Cluster verdicts

| Cluster | Verdict | Steps | Notes |
|---|---|---|---|
| C23 Inbox chrome | PARTIAL PASS | 4/4 | PASS: header stays one row with Ask panel open (the Ask button is replaced by the panel's own toggle); digest is now "Cleanup" with `?cleanup=1`, a Back arrow, and Back returns to the list. NOT OBSERVABLE on the demo: Archive all count/Undo (digest shows "Nothing to clean up"), banner gap, attachment chip and too-large state (no mail with attachments), quoted-original preview (seed reply has no "On ... wrote:"; preview ends at the signature). |
| C24 Hide amounts rule | FAIL | 6/4 | Cap table percentages are now consistent (shown on the page and in chat). Runway is not: see R3-01. Data room preview cannot be judged: the 659-byte stub PDF renders blank both hidden and shown at first, then renders once loaded; the old "Hidden while amounts are hidden" text no longer appears and no per-file Show control was seen. |
| C25 Legal | PARTIAL PASS | 5/4 | PASS: 3 tiles (Active dropped), no wrapped Term/Renewal cells, Value to Next deadline gap 36 px, 375 px first contract title at y=404, header caption wraps with Ask open. FAIL: unchecked-documents link opens the unfiltered Data room (R3-02). Not observable: Overdue colour (value is 0), failed-load header, Dismiss tooltip, Legal agent starter questions (agent already has history). |
| C26 Finance overview | PASS with nits | 3/3 | Treasury yield is in the KPI row, one sync status control, header one row with Ask open, no duplicate Cash/Runway strip. Height 1343 px (target under 1300): R3-08. |
| C27 Apps page | PARTIAL PASS | 6/5 | PASS: searching "gmail" lists the connected card; category chip resets on re-entry; sidebar and title say Apps; Coinbase action reads "Open Finance"; no broken image elements. Not fully met: card anatomy and header bar (R3-06). iMessage cards are not on this demo. |
| C28 Setup in shell / Elio reason | PASS with nits | 4/3 | /app/integrations/setup renders inside the shell; the legacy URL redirected on the second try. Voice settings shows "Connect a voice provider to call Elio." at the top. Nits R3-04, R3-05. |
| C29 Settings polish | PARTIAL PASS | 6/5 | PASS: three action-confirmation switches have equal 32 px gaps; Appearance and Sidebar density use the same segmented control; Models never showed "No providers found." (3 s observer, 0 hits) and showed one loading line. FAIL: Delete account expansion scrolls the dialog chrome away (R3-03). Not checked: mobile tab-strip fade. |
| C30 Artifacts | PASS with nits | 3/3 | CSV shows header row, thousands separators; viewer title has no extension; no author on cards (single bot). Nit R3-07. |
| C31 Routine editor | PASS (partly unobserved) | 5/4 | Time zone is now a select inside Advanced next to Model. Save is disabled while Instruction is empty, so a blank instruction can no longer be saved. "Saved for 2 s" not observed (did not save a routine on the demo). |
| C32 Data room tidy | PARTIAL / BLOCKED | 5/4 | BLOCKED: Auto-sort ran about 3 minutes over 50 files and ended with "The model could not sort your files." (demo has a placeholder model key), so grouping, "Apply N moves" and no-folder copy could not be seen (R3-09). PASS: no Base UI uncontrolled warnings in the console after opening the date filter, Rename and Move. Send to agent: see R3-10. Sources card not found on the demo. |

## Findings

| ID | Sev | Cat | Cluster | What happened vs expected | Evidence | Suspected location | Fix |
|---|---|---|---|---|---|---|---|
| R3-01 | P2 | bug | C24 | Observed. With Hide amounts on, the Finance Runway card shows "24.2 mo" but "Until •••"; Finance and Chief chat text still say "October 2028" and "24.2 months"; the sidebar Finance badge "24 mo" disappears. Expected one rule: either months and date are both shown or both masked, on every surface. | c24-fin.png; sidebar row text read from DOM | packages/chat-ui/src/mask-currency.ts:64-90; apps/web/src/lib/hide-amounts-preference.ts (maskPinFigures) | Decide runway months and run-out date are not amounts (show both) and make the card, pin and chat text use that one constant. |
| R3-02 | P2 | flow | C25 | Observed. "6 Data room documents not yet checked by Legal" opens /app/data-room with all 50 items. Expected a view filtered to those files. | c25-unchecked.png | apps/web/src/pages/Legal.tsx:279 (links to DATA_ROOM_PATH) | Link to a Data room URL with a "not checked by Legal" filter, or open a list of the 6 files. |
| R3-03 | P2 | visual | C29 | Observed. Clicking Delete account scrolls the whole Account dialog: left nav and title go blank, the form ends at y=527 and the rest of the dialog is empty. Expected the form to scroll into view while nav and title stay. One Delete button remains (good). | c29-delete.png | apps/web/src/components/AccountAccess.tsx:87,205 (scrollIntoView on the wrong ancestor) | Scroll only the content pane (block: "nearest" on the pane) instead of the dialog. |
| R3-04 | P3 | visual | C28 | Observed. The Voice notice "Connect a voice provider to call Elio." starts at x=380, flush against the nav divider, while the heading and content start at x=412. | c28-elio.png | apps/web/src/pages/AccountSettingsOverlay.tsx (notice rendered outside the padded pane) | Render the notice inside the pane padding. |
| R3-05 | P3 | perf | C28 | Observed once, not reproduced. Opening /integrations/setup stayed on plain "Loading…" for over 14 s with no redirect; a second load redirected at once. Suspected slow session lookup; outside /app the gate shows bare text, not the shell skeleton. | c28-setup.png | apps/web/src/App.tsx:118-128 | Use the shell skeleton for /integrations/* while the session loads. |
| R3-06 | P3 | visual | C27 | Observed. "Apps" title sits inline at y=20-48 with a description, not on the shared 56 px header bar. Connected cards still differ: Coinbase has no "Used by" row, only Blockscout has an overflow menu. Linear/Carta show a single letter instead of a logo. | c27-apps.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Use the shared page header; give every connected card the same footer and overflow. |
| R3-07 | P3 | visual | C30 | Observed. MD and CSV cards still share one document icon (only the badge differs); CSV header reads "Value usd". | c30-artifacts.png, c30-csv.png | apps/web/src/components/ArtifactFileCard.tsx; CSV viewer | Distinct table icon for CSV; humanise "usd" as "Value (USD)". |
| R3-08 | P3 | visual | C26 | Observed. Overview scrolls to 1343 px (target under 1300). With Ask open the five KPI tiles wrap 2+2+1 and Treasury yield is a lone tile again. | c26-finance-top.png, c26-ask.png | apps/web/src/pages/Finance.tsx KPI grid | Trim card padding or let the KPI grid use 3 columns at narrow pane widths. |
| R3-09 | P2 | flow | C32 | Observed. Auto-sort takes about 3 minutes for 50 files, then shows only "The model could not sort your files." with Retry; no reason (the demo key is rejected) and no link to Models. The disabled "Apply 0 changes" stays visible on the error. | c32-autosort3.png, c32-autosort-fail.png | apps/web/src/components/data-room/AutoSortDialog.tsx | Show the provider reason with an "Open Models settings" action; hide Apply on error; consider failing fast on an auth error. |
| R3-10 | P3 | flow | C32 | Observed. Send to agent lists 10 agents flat; Data room agent is absent and an email thread agent ("[MOCK] Redlines...") sits among page agents. Page agents are first only partly (Legal, Chief, Finance, then Mercury). | c32-send.png | apps/web/src/components/data-room/SendToAgent.tsx | Put Data room, Legal, Finance, Chief first, then a divider and the rest; hide thread agents. |
| R3-11 | P3 | copy | C29 | Observed. Privacy and approvals shows two toggles both labelled "Bots, mail, files and contracts", distinguished only by model id (gpt-6-luna, muse-spark-1.2). | c29-privacy.png | apps/web/src/components/ApprovalRulesSettings.tsx | Label each row with the model name as the title. |

## Praise
- Legal contracts table is clean at 1440 and 375; the third tile row is gone.
- Finance header with Ask open is one row; the status is one control.
- Apps search now keeps connected apps visible with their Connected tag.
- Appearance and Sidebar density now use the same segmented control.
- Digest/Cleanup has a URL and a visible Back.

## Not covered
Mobile tab-strip fade (C29), Inbox attachments, consent banner gap, Archive all Undo (C23), Overdue tile colour, failed-load Legal header (C25), routine "Saved" confirmation (C31), Sources card (C32): no demo data or time.

Setup note: `pnpm install --offline` and `build-storybook` were run in this worktree (gitignored output only).
