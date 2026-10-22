# Walk R3 (iteration 11): verify pass-10 clusters C21-C31

Session uxl11-R3 (and uxl11-R3f for a fresh sign-up user), demo stack web :5381, 1440x900 plus 1024x768 and 375x812. Screenshots in /tmp/uxloop11/R3/.
Scope note: docs/ux-loop/iteration-10/clusters.json has only clusters C1-C26. C27-C31 do not exist, so C21-C26 are the whole scope.
Touch emulation: agent-browser (0.38.1) cannot set `pointer: coarse` (verified `matchMedia("(pointer: coarse)")` stayed false with `set device`), so no touch-target findings are made. Layout at 375 was checked with a plain 375 viewport.
Fresh user: walker-r3-<timestamp>@northwind.example.test (invented), created on the demo sign-up page. The mock founder login was used for the other clusters; the password was never printed.

## Story verdicts

| Cluster | Verdict | Steps (actual/ideal) | Notes |
|---|---|---|---|
| C21 Integrations: same menu, same button edge, mailbox address, no vendor | PARTIAL | 3/3 | Open buttons share one left edge (x=200, width 120) at 375: PASS. Gmail page has no vendor name and no empty Tools block: PASS. Accounts rows show the label (Founder mail, Sales mail) and no address: demo emulator, unverified. Only Blockscout and Coinbase have a "..." menu, Gmail, Carta, Mercury and Brex have none: criterion 1 NOT met. Carta still uses a letter tile. |
| C22 Data room toolbar and share | PASS | 6/5 | 1024x768: search, folder, Auto-sort, Sort on row 1, filter chips on row 2 (two rows). 375: title, search + Filters, folder row with list/grid toggle (no lone toggle row). Share dialog opens with nobody ticked and "Email them a link" unticked. Toast reads "Shared MOCK-q3-board-deck.pdf with Priya Placeholder". Preview shows "Shared / With 1 investor". Auto-sort dialog has exactly one "Select all". Row menu says "Share". |
| C23 First-run tour | PARTIAL | 11/9 | Ring-to-popover distance is under 120 px at every stop checked (1, 4, 7, 8, 9). Stops 7-9 no longer cover Search or the Pages header. Skip tour (x=328), Back (489), Next (550) keep the same x on stops 1-8. Stop 9 swaps buttons (see R3-11-03). Auto-start after connecting Gmail in Chief is BLOCKED: Connect is real OAuth. Observed only that the tour does not start while the Connect cards are open. |
| C24 Chief and onboarding links | PASS | 3/3 | Fresh user: first reply is one sentence before the cards. "What is our runway?" with no bank ends with an "Open Finance" link. Empty sign-up shows an inline red "Enter your name" (no browser bubble). |
| C25 Command palette | PASS | 3/3 | Typing "Priya" highlights the contact Priya Placeholder, Enter opens /app/contacts?q=Priya Placeholder. At 375, "Halcyon" shows "...t of Work - Halcyon Logistics.pdf" and "...Agreement - Halcyon Logistics.pdf": middle truncation keeps the match visible. |
| C26 Page agents hidden until used | PASS | 4/4 | Fresh user opened Inbox, Finance, Data room, Investors, Legal, Contacts: the sidebar shows only Pages and Chief, no "Page agents" row. |
| Storybook smoke | PASS | 2/2 | Built Storybook from the main checkout into /tmp/uxloop11/R3/sb-static (the worktree has no node_modules), then `node .storybook/smoke.mjs`: 1714/1714 stories rendered cleanly. No failing stories. |

Praise: the share flow (named recipient in the toast, "Shared With" in the preview, no pre-ticked email) is now clear. The tour popover sits next to what it describes. The palette middle-truncation is a good fix.

## Findings

| id | page or story | sev | category | what happened vs expected | evidence | suspected code | proposed fix | status |
|---|---|---|---|---|---|---|---|---|
| R3-11-01 | C21 Integrations | P3 | visual | Only key-based cards (Blockscout, Coinbase) show "..."; Gmail, Carta, Mercury, Brex have none, so card right edges differ. Expected the same menu on every Connected card. | 02-integrations.png, 04-int-phone.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Give every Connected card the same "..." menu (Disconnect at minimum), or drop it from the key-based cards. | observed |
| R3-11-02 | C21 Integrations | P3 | visual | Carta shows a letter "C" tile while the others show logos. | 02-integrations.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Add a Carta logo or use the same neutral tile for every logo-less app. | observed |
| R3-11-03 | C23 Tour stop 9 | P3 | visual | On the last stop "Skip tour" disappears, "Ask Chief" appears and Back moves from x=489 to 398, Done sits at 547. Expected the Next slot to keep its place. Stops 8-9 also cover the composer's left edge. | tour-8.png, tour-9.png, button x positions | apps/web/src/components/tour/TourPopover.tsx | Keep Back and the primary button in fixed slots on the last stop; move "Ask Chief" out of the button row. | observed |
| R3-11-04 | C24 sign-up | P3 | visual | Empty submit outlines Email and Password in red but not Name, and the red "Enter your name" sits under the password hint. | 16-signup-empty.png | sign-up form (apps/web, noValidate form) | Mark the invalid field and place the message under it. | observed |
| R3-11-05 | C24 Chief onboarding | P3 | copy | "Run my company: Cash, cap table, investors and email" leads to Connect cards for Gmail and Google Calendar only; no bank or cap table card. | 18-cards.png | apps/api/src/onboarding.ts, apps/web/src/components/tour/connect-cards.ts | Offer the cards that match the chosen option (Mercury/Carta for option A), or reword the option. | observed |
| R3-11-06 | C24 Chief runway reply | P3 | copy | Reply says "Connect one under Integrations first" and then links "Open Finance"; two destinations in one answer. | 21-runway.png | packages/adapters/src/executor.ts (NOT_CONNECTED_GUIDANCE) | Say "Add a bank account in Finance" to match the link. | observed |
| R3-11-07 | C25 palette | P3 | visual | With "Priya" the highlight starts on the Contacts row, below the "Search mail for" row. Enter is right, but ArrowUp lands on the row above the first highlight. | 13-palette-priya.png | apps/web/src/pages/shell/command-palette.tsx | Render the direct matches above "Search mail for" so the first highlighted row is first on screen. | observed |
| R3-11-08 | C23 tour start | P3 | flow | A fresh user who answers the first question and stays on the Connect cards gets no tour; it starts only from Account > Take the tour. Auto-start after Connect not verifiable (OAuth). | 18-cards.png | apps/web/src/pages/Shell.tsx:2713-2722 | Start the tour when the cards are answered or dismissed, not only after Connect. | observed (wait), start-after-connect BLOCKED |

Counts: 6 clusters verified (C22, C24, C25, C26 PASS; C21, C23 PARTIAL), 0 P0, 0 P1, 0 P2, 8 P3; Storybook smoke 1714/1714, 0 failing.
