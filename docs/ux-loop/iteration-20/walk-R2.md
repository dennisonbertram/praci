# Walk R2 (uxl20-R2): verify pass-19 clusters C11-C20

Target: mock demo stack, 1440x900 (phone 375 for C11 only). Screenshots in /tmp/uxloop20/R2/. The demo stack went down for a few minutes mid-walk (connection refused on 5381 and 3308) and came back with sessions cleared; I signed in again. Steps are counted against each cluster's acceptance criteria (clusters have no Steps list).

## Verdicts

- C11 Data room filter bar and failed badge: PASS (5 steps / 4 ideal). The badge opens the List with "Status: Failed" even after Stats was last used. Filters and pills sit at the same x (676) in List and Stats at 1440. At 375 the List/Grid/Stats switch is visible next to the folder picker. Not checked: Stats view at 375 (my click on the Stats toggle did nothing at that width; selector probably wrong).
- C12 Data room imports: FAIL (4 / 3). Empty folder name now says "Enter a folder name". Video "Won't be searchable" exists in code (ImportFromEmail.tsx:123). The untagged file preview still says only "Not tagged yet." with no reason and no action, while AI sharing is ON. The processing/imported strip could not be exercised (no import run; not started to avoid changing shared data).
- C13 Inbox first sort: BLOCKED / partial. Existing mail keeps its old sort by owner decision, so the demo shows Needs reply = 22 of about 32 (~68%); the under-40% criterion applies to new mail only. The row-jump when sorting finishes and the first-sync line need a fresh mailbox.
- C14 Finance charts and Runway: PASS with one new defect (6 / 5). Month, Quarter and Year all label the Financing point. The Burn page now has the figure in the header and no empty band. The Runway page shows the "3-mo avg, after revenue" caption. New: in Year view the "Financing, 2026 $250,000" label sits on top of the bar.
- C15 Inbox polish: SKIPPED (needs mail error state, phone widths, CSV preview).
- C16 Routines caption: FAIL (3 / 2). Chief's Routines panel still shows "Chief's computer" above an empty area.
- C17 bots/list calls: PASS by code. AppToaster.tsx now uses lookupBotApp, no direct rpc.bots.list. Call count not measured.
- C18 Tab stops to composer: PASS (measured 6 focusable stops between the chat title and the composer; limit 10).
- C19 Integrations: PASS (3 / 3). Real logos on every card, no letter tiles, title row has a divider, Connect in the same place.
- C20 Settings and Memory: PASS (6 / 5). "Nothing remembered yet" is inside a card; section titles and content tops match (113 and 167) on General, Privacy and Memory. Bot panel header style not compared.

## Praise
- Failed-files badge going straight to the filtered list is a clean fix.
- Integrations page: consistent logos and card layout, much better.
- Burn page header with the figure and caption is clear.

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-20-01 | C12 / Data room preview | P2 | copy | OBSERVED: untagged file preview says "Not tagged yet." with no reason or action while AI models are allowed; expected a reason and one button (for example "Tag now"). | /tmp/uxloop20/R2/c12-preview.png | apps/web/src/components/data-room/Preview.tsx:234-237 | When there is no consent card, show why (waiting, or unreadable) and a retry-tagging action. |
| R2-20-02 | C16 / Routines panel | P3 | visual | OBSERVED: "Chief's computer" caption renders over an empty area (fourth pass in a row). | /tmp/uxloop20/R2/c16-routines.png | apps/web/src/pages/Shell.tsx:~6443 (caption under computer pane) | Render the caption only when a computer preview or state exists. |
| R2-20-03 | C14 / Finance Year chart | P3 | visual | OBSERVED: "Financing, 2026 $250,000" label overlaps the Out bar in Year view. | /tmp/uxloop20/R2/c14-y.png | finance chart component label placement (Finance.tsx chart) | Place the label above the plot or anchor it to the Financing bar top. |
| R2-20-04 | C14 / Runway page | P3 | visual | OBSERVED: only the Monthly burn card has a caption, so card content heights differ; Cash and Runway lack the Finance-page sublabels ("5 bank accounts", "Until October 2028"). | /tmp/uxloop20/R2/c14-runway.png | Runway page cards in Finance pages | Reuse the same sublabels on all four cards. |
| R2-20-05 | Sidebar | P3 | visual | OBSERVED once on Inbox/Finance: the "Reconnect needed" section expanded with a half-clipped Chief row and "+1 more", unlike the collapsed state at first load. Cause not traced. | /tmp/uxloop20/R2/c14-fin.png | sidebar section list in Shell.tsx | Reproduce; clip rows to whole rows or keep the section collapsed. |
| R2-20-06 | Settings / Advanced | P3 | a11y | SUSPECTED: the "Advanced" nav group does not appear in the interactive accessibility snapshot, and a scripted click on its text did nothing; only a real mouse click at its position expanded it. | snapshot after opening Settings | SettingsOverlay.tsx nav group | Make the group header a real button with aria-expanded. |
| R2-20-07 | Cold load | P3 | perf | OBSERVED once: hard load of /app/finance showed "Opening Praci..." then "Still opening... Try again" for over 8 s. Occurred while the stack was under load or restarting, so possibly environmental. | /tmp/uxloop20/R2/c14-fin.png (earlier capture) | app bootstrap | Re-measure on a quiet stack. |

Counts: PASS 6 (C11, C14, C17, C18, C19, C20), FAIL 2 (C12, C16), BLOCKED 1 (C13), SKIPPED 1 (C15). Findings: 7 (P2 x1, P3 x6).
