# Walk R3 (session uxl19-R3): verify pass-18 clusters C11-C20 + Storybook smoke

Scope note: iteration-18/clusters.json holds only 20 clusters (ids 1-20), so "C21-C31" does not exist. R3 verified the last ten (C11-C20), the share the earlier R3 walkers took. Demo stack web 5381, 1440x900 unless noted. Screenshots: /tmp/uxloop19/R3/. Touch-target checks not done (agent-browser "iPhone 14" device gave pointer: coarse = false, so they would be invalid).

## Storybook smoke
Built from the main checkout (03476a67a; the worktree has no node_modules) into /tmp, then `node .storybook/smoke.mjs`: 1789/1789 stories rendered cleanly. No failing stories.

## Verdicts
- C11 Legal agent / Ask agent: PASS (observed). Ask agent on a Deadlines row showed the user message plus a working row in under 1 s; the agent reply said "I can't send the notice; the Inbox agent can." and never claimed email is disconnected (one sample).
- C12 Mercury page: PASS (code-confirmed, not toggled on screen). Page says "asks you before each one"; with the shared switch on, code says "Changes still go through this agent and ask first" (IntegrationAgentSection.tsx:117-123). The per-agent approval enforcement test was not run.
- C13 Bot panel / Routines: FAIL (partial). New Bot Routines panel still shows a lone "New Bot's computer" label over an empty area (screenshot c13-newbot-routines.png). Schedule row remove X no longer overlaps the select (PASS). Run history rows not verifiable (Morning briefing had "No runs yet").
- C14 Toolbar / reply composer / Inbox alignment: PASS for what was reachable. Reply composer has one formatting control (T). "Show 19 more" aligns with the heading edge. Message toolbar fully visible with a panel open on a text message; a Mail card was not available in Chief, so that exact case is unverified.
- C15 Finance charts: PASS. Burn breakdown is a labelled bar list; Count crypto toggle moves nothing above the chart (layout rows unchanged; only chart data changes); Financing marker and Oct* ring are separate. Cash card shows "5 bank accounts" and the non-USD note sits in the header.
- C16 Cold-load bots/list: FAIL. 5 /rpc/bots/list calls on cold load of /app/gtm, /app/artifacts, /app/fundraising in dev (about 2.5 per load with StrictMode, AC is at most 2). Fundraising and Artifacts do go idle (no new requests between 5 s and 15 s): PASS.
- C17 Keyboard: FAIL (partial). Composer is 17 Tab stops from the header on the Chief chat (was 27; AC 10); each message's More button is a stop. Full-screen PDF preview closes on one Escape: PASS. Palette close returns focus to the Chief sidebar button: PASS.
- C18 Command palette: PASS. 36 px rows, all 11 Pages visible at 900 px, background selection, no "No matches" beside "Search mail for ...", GTM listed once.
- C19 Settings/Models/copy: PASS with one nit. Usage reads "4 tasks done by your bots"; Models shows the active provider with a check and "Included"; chevrons consistent. Memory empty state ("Nothing remembered yet") is outside a card.
- C20 Artifacts/phone PDF: PARTIAL. Artifact list and split rows both have a 41 px pitch (PASS). Phone PDF fallback still shows Open and Download twice (header icons and body buttons): FAIL.

## Other observations
- First cold load of /app/finance sat on "Opening Praci..." for about 10 s, then "Still opening... Try again", then loaded by itself about 12 s in. The retry card is good; the stall was probably server load from parallel walkers, not reproduced.
- Praise: the Legal table now wraps contract names with no cut-off; Finance Breakdown bars; Mercury page copy; palette.

## Findings
| id | sev | cat | what | evidence | suspected location | fix |
|---|---|---|---|---|---|---|
| R3-01 | P2 | perf | OBSERVED: 5 bots/list calls on cold load of GTM, Artifacts and Fundraising (target at most 2 with StrictMode counted once) | /tmp/uxloop19/R3/net-artifacts.txt | apps/web/src/components/AppToaster.tsx:67 (avatarFor calls rpc.bots.list per notification; SUSPECTED), useIntegrations.ts:111 | Read bots from the shared bootstrap/sidebar data instead of calling bots.list per notification. |
| R3-02 | P2 | visual | OBSERVED: new bot's Routines panel shows a lone "New Bot's computer" label over empty space | c13-newbot-routines.png | apps/web/src/pages/Shell.tsx:6446 | Hide the computer heading when there is no computer content. |
| R3-03 | P2 | visual | OBSERVED: phone PDF preview shows Open/Download twice (header icons and body buttons) | c20-phone-pdf.png | apps/web/src/components/data-room/PreviewActions.tsx (PdfPhoneFallback) | Drop either the header icons or the body buttons in the fallback. |
| R3-04 | P3 | a11y | OBSERVED: composer still 17 Tab stops from the header on the Chief chat (AC 10); each message More button is a stop | tab walk in session | apps/web/src/pages/Shell.tsx message action buttons | Make per-message actions a roving tabindex or add a skip-to-composer stop. |
| R3-05 | P3 | visual | OBSERVED: Memory empty state "Nothing remembered yet" sits outside the section card | c19-memory.png | apps/web/src/pages/MemorySettingsOverlay.tsx:~192 | Put the empty state inside the shared card. |
| R3-06 | P3 | flow | OBSERVED: list/grid toggle disappears when an artifact is open in split view | c20-art-split.png | apps/web/src/pages/Artifacts.tsx | Keep the toggle visible in split view. |
| R3-07 | P3 | perf | OBSERVED once: Finance cold load stalled about 12 s on the loading card; not reproduced, likely load from parallel walkers | c15-finance.png | n/a | Re-check on an idle stack. |
