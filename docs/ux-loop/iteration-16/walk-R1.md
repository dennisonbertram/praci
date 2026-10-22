# Walk R1: verification of pass-15 clusters C1-C25

Session uxl16-R1, demo stack (web :5381), 1440x900 unless noted. Screenshots in /tmp/uxloop16/R1/.
Caveats: the demo user is shared with other walkers (Hide amounts, deadline done state and the Legal check changed under me), the demo has no model, and `set device "iPhone 12"` did not enable `pointer: coarse` (measured `matchMedia('(pointer: coarse)')` = false), so no coarse-pointer hit areas could be measured.

## Verdicts (steps actual/ideal)

- C1 Hide amounts in result card: PARTLY (2/2). Chat reply bubble is masked ($•••), no digit-grouped dollar amount in the DOM. The demo model produced no "card" block, so the card path (transcript.tsx:1759) was not exercised. Unit test not run.
- C2 Ask agent covers mail: PASS (3/3). At 1440 dialog widens 768 to 1096 px; left edge 336 and first text line (x 352, y 201) unchanged; text fully readable; prev/next/close at x 932-1004 stay in view. At 390 each address is on one line, date on its own line (c2-ask.png, c2-phone3.png).
- C3 Data room row vs badge: PASS (2/2) for the row (opens /app/data-room, all files) and badge (opens ?status=failed with removable "Status: Failed" chip). Badge is a separate button with label "1 file failed". 44 px coarse hit area UNVERIFIED (fine pointer 19x25).
- C4 Inbox To do / Needs reply: PARTLY (2/3). No To do item shares a visible Needs reply row; rows now carry a "To do" tag. Send/undo toast and replied-row tag not exercised (would send mock mail).
- C5 Data room checkbox 44 px on touch: UNVERIFIED (BLOCKED by emulation). Code has pointer-coarse:size-11 (ItemRows.tsx:349) and a unit test asserts it.
- C6 Settings: PARTLY. Opens 5/5 on the Chief thread, 3/3 on Finance, 4/4 on an agent chat once loaded. It does nothing while an agent chat/GTM page is still loading (see R1-03). Safety switches showed their final value on the first sample after the tab opened (no off-to-on flip seen); slow-rules case not forced.
- C7 Tour: PASS (9/9 stops on phone). Next button y = 788 on all nine stops at 390x844; highlight visible and Search/Create/Close not covered (checked stops 1 and 6). Desktop step 9 ring NOT checked (tour was completed once without a screenshot).
- C8 Integrations: PARTLY. Logos visible in dark theme (Slack, Notion, GitHub, Linear, Airtable, Google). Revisit: 18 skeleton nodes in first frame and no search box or chips for about 1.2 s (R1-01). The 0-skeleton revisit criterion conflicts with the pass-15 owner decision (no cache), so not reported.
- C9 Data room list: PARTLY. 1440: Name column about 360 px, "MOCK Term Sheet Draft - Quill Capital.pdf" on one line (met). 390: first row top about 141 px, view toggles not in the main bar (met). Failed row 56 px at 1440 (met) but 76 px on phone and shows red icon plus red text plus Delete. Auto-sort plan title could not be checked: the demo model fails ("The model could not sort your files"); dialog title is "Sort files". Right-edge alignment not measured.
- C10 Finance chart: FAIL (R1-02). Overlapping marker pair still reads as "8"; Quarter starts at Q1 '25 with 5 empty quarters; Year uses left third and clips "$800k"/"$300k" labels. No ".." % strings with Hide amounts on (met; change percentage is hidden entirely). Overview and Accounts show the same four ranges.
- C11 Legal contracts: PARTLY. 1440 rows are 48 px; baseline spread 1 px on 10 rows, 3 px on the Draft/Unknown pill rows. Phone: 8 contracts per screen, no repeated labels, no Value line. Show done lists a done deadline with Reopen; Reopen moved it back (Deadlines 8 to 9).
- C12 Activity: PASS (2/2). With the sidebar list scrolled to the bottom, pressing Activity shows the panel at the top in view. Needs-you (Investor Relations) and Working (Finance agent, Finance helper) are not repeated in the list below. First-result-within-1 s not timed.
- C13 Legal scan: PARTLY. Banner has a "Check now" action; after it ran contracts stayed 13 and handbooks/offer letters are not listed (met). Progress/"Saving results" phase not observed (demo scan is instant).
- C14 Bot asks Mercury to pay: UNVERIFIED. No live delegated payment possible without a model. In the Mercury chat, a missing-recipient failure shows "Open Integrations" (R1-05). "Approved here. Waiting for Mercury" and the Send/Deny card ($55, Denied) are present.
- C15 Toast vs docked chat: UNVERIFIED. A Legal "needs an answer" toast showed while Chief was open (correct); could not trigger a new one with Legal docked.
- C16 Equity raised vs update draft: PASS. Investors "Equity raised" $250,000 ($50,000 committed); the October update draft says "Capital raised to date: $250,000".
- C17 Empty Investors/Fundraising: SKIPPED (needs an empty snapshot; switching space would change the shared user).
- C18 Inbox first sort: PASS. Skeleton rows about 56 px against 57 px real rows; only the tab is named "Important" (row control is "Mark important"). Sorting-wait shift not observed.
- C19 Request counts: FAIL (R1-04). One Finance reload issued 18 routines/list and 5 bots/list; bootstrap 3x.
- C20 Phone/touch polish: PARTLY. Eight page rows are `<a href>`; GTM is a `<button>` (R1-06). Sticky hover, tool tally, space-name treatment not checked.
- C21 Palette/focus: PARTLY. Empty state reads "No matches" with a Mail fallback and no source list; Enter/Esc footer styled alike. Search shows a focus ring after login landing and when the tour highlights it (first screenshot 00-home.png); not seen on page loads. Page agents open state not checked.
- C22 Accessibility: PARTLY. Composer textarea has no role=combobox; sign-in and sign-up each have one main landmark. Contrast not measured (no axe).
- C23 Settings hierarchy: UNVERIFIED (Advanced check failed twice because of the timing in R1-03; General shows the Account title above rows).
- C24 Routines/Mercury copy: SKIPPED.
- C25 Contacts 1920: PASS (Name x 344, Email x 590, 246 px apart). Empty-contacts duplicate button not checkable.

## Findings

| id | story/page | sev | cat | what happened vs expected | evidence | suspected location | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C8 Integrations | P2 | perf | Observed: on revisit the first frame has 18 skeleton nodes and no search box or chips for about 1.2 s; criterion says search/chips are visible in the first frame. | MutationObserver samples: t0 skeleton 18, search false; t+1.2 s search true. c8-first.png | Integrations page header rendered after data query | Render search and chips outside the data-dependent branch. |
| R1-02 | C10 Finance | P2 | visual | Observed: Month chart Oct* shows two touching 6 px circles (y 420 and 426) that read as "8"; Quarter chart starts at Q1 '25 (5 empty quarters); Year chart uses the left third of the width and clips the "$" of y labels ("$800k"). Cluster C10 not met. | c10-finance.png, c10-q.png, c10-y.png; circles at x 1325 y 420/426 | Finance burn chart component (apps/web finance chart) | Draw the partial month as one connected point, trim leading empty periods, give the y axis left padding. |
| R1-03 | C6 Settings | P3 | bug | Observed: account menu > Settings does nothing while an agent chat or GTM page is still loading (0 of 3 on Legal during load, 0 of 4 on Investor Relations chat during load, 1 of 3 on GTM); works once loaded. | agent chat took over 9 s to load (c6-agent.png skeleton) | Settings open handler / Shell route readiness | Open the dialog independent of route data. |
| R1-04 | C19 | P3 | perf | Observed: one Finance reload issued 18 routines/list, 5 bots/list, 3 bootstrap, 3 pendingApprovals. Criterion is at most 1 each. | `agent-browser network requests` counts | routines/list and bots/list callers in Shell/sidebar | Share one query per key in the shell. |
| R1-05 | C14 Mercury | P2 | copy | Observed: Mercury chat tells the founder to add a missing recipient "at the bank first" and ends with an "Open Integrations" link, which cannot add a bank recipient. | c24-mercury.png | Mercury agent failure text | Drop the Integrations link; name the Mercury app step only. |
| R1-06 | C20 | P3 | a11y | Observed: sidebar GTM row is a `<button>`, not an `<a href>`, so it cannot open in a new tab; other page rows are links. | DOM scan | Shell.tsx SidebarPageLink for GTM | Render GTM as a link to its route. |
| R1-07 | GTM page | P2 | visual | Observed: Channels table text (X, LinkedIn, headers) touches the card's left border with no padding; "Written by GTM agent" box is empty. | screenshot of GTM page (c23-adv.png) | GTM page Channels table | Add cell padding to match the card; hide the empty box. |
| R1-08 | C9 | P3 | visual | Observed: failed row on phone is 76 px and carries red icon, red message and Delete (criterion at most 64 px, one signal). | c5-phone.png | data-room/ItemRows.tsx | Keep only the message on phone. |
| R1-09 | C11 | P3 | visual | Observed: pill rows (Draft/Unknown) have a 3 px baseline spread; criterion is 1 px. Contract names truncate ("MOCK Insurance Poli...") while Renewal has spare width. | row measurement; c13-check.png | Legal contracts table column widths | Widen the Contract column, vertically center pills. |
| R1-10 | Investor update | P3 | flow | Observed: opening the update draft shows a blank main area for about 6 s, then "Saving..." appears with no edit made. | c16-draft.png, c16-draft2.png | investors/updates page | Show a skeleton and save only after an edit. |

Praise: the Data room row/badge split, Reopen on done deadlines, Activity panel placement, phone tour card stability, Ask agent layout at 1440 and the phone mail header all behave as specified.
