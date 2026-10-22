# Walk R2 (uxl19-R2): verify pass-18 clusters C11-C20

Demo stack 127.0.0.1:5381, 1440x900, mock-founder login. Host load was 55-85, so screenshots lagged 2-4 s and some pages showed skeletons for 7+ s (not reported as findings). Screenshots: /tmp/uxloop19/R2/. No touch-emulation checks were done (phone items not covered).

## Verdicts

- C11 Legal agent email wording and Ask agent cue: PASS (4 steps / 3 ideal). Ask agent on "Send non-renewal notice" showed the sent question and "Thinking 0.2s" within 0.3 s; the answer said "I can't send the notice; the Inbox agent can." Answer took about 45 s (scripted demo model, not a UI issue).
- C12 Mercury second switch: PASS (3 / 3). After Allow changes, "Let other agents use Mercury directly" is Off, and copy reads "Off: other agents reach Mercury only through this agent" and "asks you before each one". Approval enforcement for other agents not verified in code. I toggled Allow changes on, then clicked it off again (final state not confirmed).
- C13 Bot panel and Routines: FAIL (partial). The lone "Investor Relations (mock)'s computer" label still sits under an empty area in the Routines panel (Shell.tsx:6443-6447). Schedule row remove x does not overlap the select (monthly rule only; weekly select not opened). Run history not exercised (No runs yet; Test run not run). Panel header no longer cuts text.
- C14 Chat toolbar, composer, Inbox counts: PASS with one UNVERIFIED. Reply composer has one formatting control (T) and no second toolbar. "Show 19 more" left edge is x=345 vs heading x=344. Unread filter says 13 results and the badge says 13. Mail-card More button next to the settings panel: UNVERIFIED, no Mail card exists in any demo chat.
- C15 Finance charts: FAIL (partial). Burn "Where it went" is now single-encoding bars with labels (PASS). Count crypto toggle moves the chart by 0 px and repeats "1 unpriced" (PASS). Quarter view still draws an unlabeled Financing ring (FAIL). Burn header card is still a 170 px card with an empty band beside it (not fixed). Oct* rings no longer overlap.
- C16 Cold load bots/list: FAIL. /app/gtm and /app/artifacts each made 5 POST /rpc/bots/list calls (target 2). Another walker's approval toast was restored on load, which may add AppToaster calls (AppToaster.tsx:67 reads bots.list per notification). Fundraising idle: SKIPPED.
- C17 Keyboard: PARTIAL. Composer needs 17 Tab stops after the Routines header button on a 14-message Chief chat (FAIL; each message adds a More button, no skip link; target <=10 on 30 messages). Full-screen PDF preview closes on one Escape (PASS). Closing Cmd+K by Escape or outside click returns focus to the header "Chief" button, not "Skip to content" (PASS). Contacts dialog focus: SKIPPED.
- C18 Command palette: PASS (2 / 2). Rows are 36 px, all 11 Pages end at y=768 (fit in 900). Selection is a background fill. Search "zzqx" shows only "Search mail for ..." with no "No matches". "gtm" shows only the GTM page (per owner decision the agent row is not listed).
- C19 Settings polish: PARTIAL. Usage reads "26 tasks done by your bots" (PASS). Models marks the active provider ("Included" with a check) and uses chevron disclosures (PASS). General holds Theme only; density and avatars are under Chat display (PASS, owner decision). Memory: the "Outside memory service" disclosure is carded but "Nothing remembered yet" and the intro line are bare text (partial).
- C20 Artifacts and density: PARTIAL. Artifact list rows are 41 px in list view and 41 px in split view (PASS); content is width-capped. Grid cards are still about 150 px tall for one line. The grid/list toggle disappears in split view. Legal graph, phone PDF fallback, phone Data room filters, Investors lists: SKIPPED (phone or other owner).

## Findings

| id | sev | cat | status | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-19-01 | P3 | visual | observed | Routines panel still shows "<bot>'s computer" caption under an empty preview (C13 not fixed) | /tmp/uxloop19/R2/c13-routines-ir.png | apps/web/src/pages/Shell.tsx:6443 | Render the caption only when a computer preview or state exists. |
| R2-19-02 | P3 | visual | observed | Quarter view draws an unlabeled Financing ring (Month view labels it) | /tmp/uxloop19/R2/c15-quarter.png | apps/web/src/pages/finance chart component | Add the same "Financing, Q4 $250,000" label to the Quarter and Year views. |
| R2-19-03 | P3 | visual | observed | Burn page summary card is 170 px wide with an empty band to its right | /tmp/uxloop19/R2/c15-burn.png | apps/web/src/pages/finance sub-page header | Put the figure in the header row or widen the card to the chart. |
| R2-19-04 | P3 | perf | observed | 5 bots/list calls on cold load of gtm and artifacts (target 2); may be inflated by restored approval toasts | network log in session uxl19-R2 | apps/web/src/components/AppToaster.tsx:67, useIntegrations.ts:111 | Read bots from the shared sidebar data in AppToaster instead of calling rpc.bots.list per toast. |
| R2-19-05 | P3 | a11y | observed | Composer is 17 Tab stops after the chat header on a 14-message chat (More button per message, no skip link) | Tab walk log | apps/web/src/pages/shell/transcript.tsx (message action buttons) | Make message actions one roving tab stop, or add a skip-to-composer control. |
| R2-19-06 | P3 | visual | observed | Settings Memory: only the disclosure is in a card; "Nothing remembered yet" is bare text | /tmp/uxloop19/R2/c19-memory.png | apps/web/src/pages/MemorySettingsOverlay.tsx | Wrap the whole body in the shared card. |
| R2-19-07 | P3 | visual | observed | Artifacts split view hides the list/grid toggle; grid cards about 150 px for one line | /tmp/uxloop19/R2/c20-split.png, c20-art.png | apps/web/src/pages/Artifacts.tsx | Keep the toggle visible; reduce grid card height. |
| R2-19-08 | P3 | flow | unverified | Mail-card More button clipped by the settings panel cannot be checked: no demo chat has a Mail card | n/a | apps/web/src/pages/shell/transcript.tsx | Seed a Mail card in the demo Inbox agent chat so this can be tested. |

No P0 or P1 found. Praise: palette rows and selection, Legal agent cue and wording, Mercury safe defaults and copy, Burn breakdown bars, Count crypto layout stability, single-Escape PDF preview, Inbox "Show more" alignment and count match.

Not reported: slow loads (host load 55-85), 2-4 s screenshot lag.
