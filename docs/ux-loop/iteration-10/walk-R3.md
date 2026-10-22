# Walk R3 (iteration 10): verify pass-9 clusters C21-C31

Target: mock demo stack (web :5381, served from the main checkout at e9f20fed9). Desktop 1440x900; phone checks used the iPhone 16 device profile. Screenshots: /tmp/uxloop10/R3/.

Limits: agent-browser device emulation did not set `pointer: coarse` (measured false), so no touch-target number is valid and the burn-bar 44 px criterion is UNVERIFIED. The demo has no payment approval card and no fresh "can now read" Allow state.

## Verdicts (steps actual / ideal)

- C21 Finance header, phone header, Runway chart: PASS (3/3). Header stays at y=20 after scrolling 413 px; at 390 px the space name shows in full and "Per month" is nowrap; Runway x axis runs to Nov 2028, run-out Oct 26, 2028. Burn-bar tap target UNVERIFIED.
- C22 Payment button 'Send $300.00': BLOCKED (no payment card in the demo). Code confirmed: AskCard.tsx:66-68 keeps a "Send ..." label, otherwise "Allow once"; Details uses `detail.trim()` (:185, :190).
- C23 Storybook smoke: PASS. Built from the main checkout; 1705/1705 stories rendered cleanly, 0 failing.
- C24 Settings: PASS (4/4). Nav is General, Privacy and approvals, Models, Advanced (collapsed group). General has no Integration sign-in card. Models shows one line ("Your bots use OpenAI: GPT-6 Luna.") and one "Use my own model" button; Voice is a tab inside Models; chevron glyphs only. Phone section padding not measured.
- C25 Integrations: PASS with notes (2/2). Chips All, Finance, Social, Tools are all section headings; card action buttons share a right edge (635/636, 985/985, 1336/1337). Carta still a letter tile. Phone page height not measured.
- C26 Tour: PASS with notes (9 stops). All popovers sit inside the sidebar column (x 8-308), none over the page title, chat text or composer. Stops 7-9 sit at the top of the sidebar and cover Search and the Pages header; stop 9's target (account row) is at the bottom. Stop 8 text no longer names Gmail.
- C27 Focus styles: PASS. Chat actions (React, Reply, Remember, More), in-message links, "Forgot password?" and "Sign up" all show a 2px solid outline. Action buttons use the ink at 50% alpha, links full ink.
- C28 Sidebar: PASS with one UNVERIFIED. Page agents collapsed with a count (6); phone drawer header is Search, History, +, X (X last). The green flag glyph beside Chief's time was seen only while Chief was "Working..." (first two screenshots) and not on later loads; cause not traced.
- C29 Data room: PARTIAL (5/4). Breadcrumb buttons 24 px (PASS). Status column 80 px and only where rows need it (PASS). Share shows toast "Shared SAFE-Acme-signed.pdf" (PASS) but the preview has no "Shared with N" line. Auto-sort still opens with nothing ticked, but a visible Select all exists (twice). Allow-banner layout shift UNVERIFIED (no fresh state).
- C30 Inbox: PASS with notes. Digest heading reads "Last 7 days" (8 messages, 5 senders). Cleanup now shows "Nothing to clean up. People you have written to or saved as contacts are left out." with an Open Newsletters button. "Sent" confirmation not exercised (would send mail); no "Sent" string found in Inbox.tsx.
- C31 Rail mode: PASS. Investors title top y=20 with the full sidebar and with the rail; the toggle is inside the rail.

## Findings

| id | story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R3-10-01 | C29 | P3 | flow | Observed: share closes with a toast but the preview shows no "Shared with N" line, so Maya cannot later see who has the file. | c29-shared.png; preview text has no "Shared with" | apps/web/src/components/data-room/ItemDialogs.tsx and the preview panel | Add a "Shared with N" line to the preview metadata. |
| R3-10-02 | C29 | P3 | copy | Observed: toast reads "Shared SAFE-Acme-signed.pdf" without the recipient; it also covers the bottom list row. | c29-shared.png | ItemDialogs.tsx (share toast) | Say "Shared with Priya Placeholder". |
| R3-10-03 | C29 | P3 | visual | Observed: the Auto-sort dialog shows "Select all" as a checkbox at the top and again as a footer button. | c29-auto2.png | apps/web/src/components/data-room/AutoSortDialog.tsx | Keep one Select all. |
| R3-10-04 | C26 | P3 | visual | Observed: tour stops 7-9 put the popover at the top of the sidebar, covering Search and the Pages header (and clipping the Inbox row at stop 7); stop 9 highlights the account row at the bottom, far from its popover. | t7.png, t9.png; popover rect y16-118 | apps/web/src/components/tour/TourPopover.tsx | Anchor to the bottom for the account stop and keep stops clear of the sidebar header. |
| R3-10-05 | C24 | P3 | copy | Observed: Models says "Your bots use OpenAI: GPT-6 Luna." but, after Use my own model, "Your bots already use OpenRouter." | c24-models.png, c24-own.png | apps/web/src/pages/ModelBackupsSettings.tsx | Use one provider name for the system model in both places. |
| R3-10-06 | C21 | P3 | visual | Observed: on the Runway page the space name truncates to "Northwi..." at 1440 although the header has free space. | c21-runway.png | apps/web/src/pages/Finance.tsx runway header | Let the space name take available width before truncating. |
| R3-10-07 | C25 | P3 | visual | Observed: the Chat section has no filter chip, and Carta still uses a letter tile. | c25.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Add a Chat chip or drop the heading; use a Carta mark. |
| R3-10-08 | C27 | P3 | a11y | Observed: chat action buttons focus ring is ink at 50% alpha, links use full ink. | computed outline colors | chat message action button component in apps/web/src/pages/shell/ | Use the same ring colour as links and sidebar. |
| R3-10-09 | C28 | P3 | visual | Suspected: a small green flag glyph appears next to Chief's time while Chief is "Working..." with no label; not reproduced afterwards. | c21-top.png (235,481) | apps/web/src/pages/Shell.tsx sidebar row | Give the working indicator an accessible name or remove it. |

Praise: Finance header stays put on desktop and phone; Runway chart reaches the run-out date; Models tab is a single line plus one button; Cleanup empty state explains itself; Storybook 1705/1705.

Console: no errors seen in agent-browser console output during the walk.
