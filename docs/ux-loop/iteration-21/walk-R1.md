# Walk R1 (iteration 21): verify pass-20 clusters C1-C29

Target: mock-data demo stack, desktop 1440x900 (phone check at iPhone 14 emulation, which did not report pointer: coarse, so no touch-target findings). Other walkers shared the demo, so threads and sidebar contents changed during the walk.

## Verdicts per cluster

| Cluster | Verdict | Evidence |
|---|---|---|
| C1 Money approval wording | SKIPPED | Chief thread was occupied by other walkers' pending approvals; no fresh thread for a payment run. |
| C2 Data room agent "missing" list | PASS (one part partly) | Seed-round answer lists Pitch Deck v1/v2, both Pilot Agreements, Cap Table Summary, budget, HR handbook and offer letters as present. Missing items have no "folder searched" note (partly). Deterministic test not checked. |
| C3 Storybook smoke | SKIPPED | Not run. |
| C4 Legal dismissed/scan | PARTLY | Dismiss then "Show closed" lists the row as Dismissed with Restore; Restore reopened it (Deadlines back to 9). Scan summary naming rows and failed-refresh state not exercised. |
| C5 Finance phone header / Breakdown | PASS (phone estimated) | Desktop: Breakdown stays 312 px tall after "Show all 16" on Upcoming. Phone: status line "synced just now" has no ellipsis, non-USD note on one line; header about 78 px by estimate from a 3x screenshot (limit 72; not measured in CSS px). "syncing..." shows an ellipsis while syncing. |
| C6 Sidebar clipping | PARTLY | 1280x720 and 1440x900: no half-cut row, "+N more" present. A bare "RECONNECT NEEDED" space header with no rows still renders (criterion "empty spaces do not render a bare header" not met), and with extra spaces on the demo several bare headers appear. |
| C7 Activity | PARTLY | "Show 20 finished runs" now shows the Finished heading and rows (met). Approval reads "Needs approval" (met). Activity opened with scrollTop 217 so the heading and first run were above the fold (not met). Pages list is hidden in Activity; only the highlighted clock icon returns (weak). |
| C8 Data room processing | PARTLY / NOT MET | Untagged file "MOCK Board Minutes" preview shows no reason or action (row says "Not tagged"). Strip states and row jump not exercised (no processing job). |
| C9 Light contrast | PASS | Script over sidebar text (excluding opacity) found nothing below 4.5:1 in light theme; "+" icon looks clear. |
| C10 Mercury state consistency | BLOCKED | Demo Mercury is connected; no needs_reconnect connection to compare. |
| C11 Inbox first sort | BLOCKED | Mailbox already sorted; no fresh sort to time. |
| C12 Legal agent | SKIPPED | |
| C13 Data room affordances | PARTLY | Failed tile is red with a pointer cursor (met). Folder search with no results shows a "Search all items" button (met). Failed row menu offers Send to agent, Share, Move, Rename, Delete and no Replace file (not met). Name column width while searching not measured. |
| C14 Investors agent | PASS | Thread answer uses page figures: founders 70% today, about 68.5% after the Quill SAFE at 2.1%. |
| C15 Finance charts | PASS (Rent title not checked) | Month view: partial month "Oct*" drawn as markers, no falling line. Year label "2026*" below the bars. All five stat cards carry sublabels. |
| C16 Routines panel caption | SKIPPED | |
| C17 Bot settings | SKIPPED | |
| C18 Legal contract rows | PASS | Rows measure 40 px at 1440. |
| C19 Settings polish | PARTLY | Chat display is a single disclosure row (no empty column). Memory page shows "Nothing remembered yet" before the "Outside memory service" disclosure. Usage card is shown with 24 tasks (non-zero). Phone sheet widths not checked. |
| C20 Header alignment | PASS | Title centre at y=28 on Inbox, GTM, Investors, Fundraising, Contacts, Data room, Integrations; chat title at about 27. No divider on Integrations. |
| C21 Integrations detail | SKIPPED | |
| C22 Toast poller | SKIPPED | |
| C23 Mail card | SKIPPED | |
| C24 Chat transcript copy | SKIPPED | |
| C25 First-run tour | PARTLY / NOT MET | Step 1 text starts "Search: Find any page, chat or email" (met) but the card sits at y about 640-780 while the Search box is at y 28, still about 600 px away. Phone stability not checked. |
| C26 GTM page | PASS | Agent panel opens closed; no empty "Written by" card on load. |
| C27 Artifacts | PARTLY | Grid titles do not truncate at 1440 (descriptions do). Delete dialog name not verified. |
| C28 Cmd+K | PARTLY | Documents section ends with "See all in Data room" (no count). Footer key names ("Enter", "Esc") are plain text, not key caps (not met). Match highlight is one style. |
| C29 Space header | PASS | Clicking "Reconnect needed" header switched to that space and showed "Select a bot"; no chat created. Create menu offers New space (demo has several spaces). |

## Findings

| id | page | sev | category | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R1-21-01 | C13 Data room | P2 | flow | Observed: failed file row menu has Send to agent and no Replace file. | menu on MOCK Signed NDA row (dr-menu.png) | Data room row menu component in apps/web/src/components/data-room | Show Replace file first for failed rows and drop Send to agent. |
| R1-21-02 | C6 Sidebar | P2 | visual | Observed: "RECONNECT NEEDED" space header renders with no rows below it. | s2.png, act.png | apps/web/src/pages/Shell.tsx space group render | Do not render a space group with no rows; fold into "+N more". |
| R1-21-03 | C7 Activity | P2 | bug | Observed: Activity opened with sidebar scrollTop 217, hiding the Activity heading and the approval row. | act.png vs act0.png | apps/web/src/pages/Shell.tsx:4931 | Set scrollTop to 0 when Activity opens. |
| R1-21-04 | C8 Data room | P2 | copy | Observed: untagged file preview gives no reason or action. (May be intended after pass-20 "show only after classification finished"; the file stays untagged on the demo.) | dr-prev.png | apps/web/src/components/data-room/Preview.tsx:234-237 | Show a reason with one action (Tag now or Allow) whenever a file stays untagged. |
| R1-21-05 | C25 Tour | P3 | visual | Observed: step 1 card is about 600 px below the Search box it names. | s0.png | tour card placement | Anchor step 1 card beside the Search box or point to it. |
| R1-21-06 | C28 Cmd+K | P3 | visual | Observed: footer key names are plain text; documents link reads "See all in Data room" without a count. | cmdk.png | Cmd+K palette component | Render kbd caps and "See all N documents". |
| R1-21-07 | Legal contracts | P2 | visual | Observed: contract table is 24 px wider than its container (scrollWidth 1148 vs 1124) and the "Next deadline" column is clipped at the right edge at 1440 with the sidebar open. | legal.png | apps/web/src/pages/LegalContracts.tsx table columns | Let the table shrink to the container (truncate Parties/Renewal) or scroll with a visible cue. |
| R1-21-08 | Finance chart | P3 | visual | Observed: the "Financing, Oct 1 - $250,000" annotation is cut in half at the top of the Burn chart in Month, Year and phone views. | fin.png, fin-year.png, m-fin.png | apps/web/src/pages/Finance.tsx chart plot top margin | Add top padding to the plot area so the annotation is fully visible. |
| R1-21-09 | GTM | P3 | visual | Observed: GTM title and cards start at x=366 while other pages start at x=344. | gtm.png | apps/web/src/pages/Gtm.tsx page padding | Use the shared page container padding. |
| R1-21-10 | Space switching | P2 | flow | Observed: clicking the empty "Reconnect needed" header made it the active space; Inbox then showed "No mail connected" with a Connect mail button and the other space's chats moved below. A first-time user can lose her mail view without a clear way back. | c29b.png, inbox.png | apps/web/src/pages/Shell.tsx space header click | Keep the current space active unless the header is expanded to rows, or show a clear "Back to Northwind" cue. |

Praise: Finance Upcoming no longer stretches Breakdown; Legal Show closed with Restore works; Investors agent answer cites the page and states its assumptions; Data room agent answer separates present and missing with an honest caveat; the Activity "Needs approval" label is clear.
