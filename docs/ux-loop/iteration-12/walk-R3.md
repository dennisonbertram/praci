# Walk R3 (verify pass-11 clusters C21-C31)

Stack: mock demo, web 5381, API 3308, 1440x900 (phone checks at 375/390 without touch emulation: agent-browser cannot set pointer: coarse, so 44 px touch targets were not measured). Screenshots: /tmp/uxloop12/R3/. Other walkers share the stack (extra files, a "z" folder, "New Bot" appeared); the API was slow under load (Inbox Updates tab took about 12 s to load).

## Verdicts

- C21 Data room Reading spinner: PASS in part. No bare spinner on any row in list or grid; the toolbar band says "Reading MOCK Board Minutes - October.pdf" in words; grid cards show Failed state like list. Stale-state Retry after the limit not observable (no stuck file on this demo; code has isStuck/Retry). Steps 3/3.
- C22 Data room phone and Stats: PASS. Stats chart fits at 375/390 (no overflow, scrollWidth = viewport); grid "..." button sits inside the card at 390; switching to Stats keeps the folder tree at the same y (189) and keeps the consent banner. Steps 3/3.
- C23 List and preview: PASS in part. Preview shows Type, Date, Parties, Folder, Source, Size without scrolling at 1440x900; column header and compact row say "Added Oct 22, 2026". From-email link 44 px rule: code has pointer-coarse:min-h-11, not measured (demo has no email-sourced file). Steps 2/2.
- C24 Upload stall, toast, import default: PASS in part. "Add new email attachments automatically" is off in the From email dialog. Stall state ("Taking longer than usual" with Cancel/Retry) exists in DropZone.tsx:183 but BLOCKED to reproduce (no way to stall an upload on the demo). Toast placement not exercised (Allow would change shared consent state).
- C25 Finance vendor and Burn chart: PASS. Vendor tile says "+35% Sep vs Jun" and the chart note says "Oct so far: $2,400"; Burn draws Oct as a dot labelled "Oct*" with "* So far"; financing marker is inside the plot. Hide-amounts trendText fix confirmed in finance-format.ts:144-150 only (not exercised in the UI).
- C26 Finance layout: PASS. Subscriptions vendor and amount are 570 px apart at the widest (table is now 672 px wide), rows are 38 px each, Breakdown and Upcoming cards are equal height, 5-tile row, at 375 the space name reads in full and tiles pair up.
- C27 New-mailbox Inbox timer: BLOCKED. Needs a new mailbox with first Allow; the demo mailbox is already allowed. Not verified.
- C28 Chief copy: BLOCKED for the runtime answers and onboarding option (needs a fresh user without a bank). Code check: NOT_CONNECTED_GUIDANCE now says "Add a bank account in Finance" with one link. The "Ask Chief" chip was not visible in Chief's composer after I skipped the tour, so I could not judge its label.
- C29 Routines panel: FAIL (partial). Title is now "Routines", but an empty "Chief's computer" heading remains with about 300 px of empty space below the routine list.
- C30 Inbox list: PARTIAL. Filter tooltip gone after Escape (observed). No duplicate To do/row seen in this data. Updates tab has no day headings while Important has Needs reply / Other mail today / Earlier (observed).
- C31 Legal Deadlines: PASS. 8 rows, one per notice; renewal date in the notice subtitle; no separate "Renews automatically" rows.
- Storybook smoke: PASS, 1721/1721 stories rendered cleanly after a fresh build-storybook; no failing story.

## Findings

| id | story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R3-12-01 | C29 | P3 | visual | Observed. Routines panel title is fixed, but an empty "Chief's computer" heading stays with a large blank area under the routine list; expected no computer heading when no computer is in use. | /tmp/uxloop12/R3/routines.png | apps/web/src/pages/Shell.tsx:6168 | Render the computer heading and blank area only while a computer session exists. |
| R3-12-02 | C30 | P3 | visual | Observed. Updates tab lists mail with no day headings, while Important groups under headings; expected the same grouping in every pile. | /tmp/uxloop12/R3/inbox-upd2.png | apps/web/src/pages/Inbox.tsx (pile grouping) | Apply the same day grouping to Updates and Newsletters. |
| R3-12-03 | C26 | P3 | visual | Observed. Subscriptions table is left-aligned in a 1070 px card, leaving about 380 px empty on the right at 1440. | /tmp/uxloop12/R3/fin3.png | apps/web/src/pages/Finance.tsx (SubscriptionsTable) | Cap the card width to the table or let the table fill with the vendor column. |
| R3-12-04 | Inbox | P2 | perf | Observed once under multi-walker load. Updates tab showed 5 grey skeleton rows for about 12 s before rows appeared. Likely shared-stack load, not verified. | inbox-upd.png | apps/web/src/pages/Inbox.tsx | Re-check on an idle stack. |
| R3-12-05 | Data room | P3 | copy | Observed. Stats says "Failed 2" and the sidebar badge shows 2 while the first visible list rows show a single Failed file; other files were added by parallel walkers, so a mismatch is not confirmed. | dr-stats.png | none | Verify counts agree on an idle stack. |

Praise: the Data room preview with all metadata above the fold, the "Added" label, the Burn chart's partial-month dot, and the one-row-per-notice Legal Deadlines are clean.

Counts: 11 stories + smoke; PASS 6 (C22, C25, C26, C31, smoke) + partial pass 3 (C21, C23, C24), FAIL 1 (C29), PARTIAL 1 (C30), BLOCKED 2 (C27, C28 runtime). Findings 5 (P2 1, P3 4).
