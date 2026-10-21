# Walk W9: older APP and CAP stories (iteration 2)

Walker: uxl2-W9 (plus a fresh sign-up account, `walker-9@northwind.example.test`, used for first-run, empty-state and bot-creation stories so the shared demo account was not changed).
Target: mock demo stack, web 127.0.0.1:5381, 1440x900 (390x844 for phone checks). Screenshots: `/tmp/uxloop2/W9/`.

## Caveats (read first)

- The demo account `mock-founder` is shared by many walkers. During this walk the sidebar "Cap table" row and the Finance runway badge changed between screenshots because another walker changed Page options and approvals. The Chief thread also contains other walkers' messages. Nothing here treats that as an app defect.
- Machine load average was 22 to 33 during the walk. Cold page loads took 1 to 28 seconds ("Opening your Space..."). That is recorded as an environment problem, not a finding.
- The demo has a real model (Chief answered in about 15 s). Real sign-ins (Carta, Slack and others), email delivery, billing, SSO, browser notification permission and the microphone cannot be exercised. Mock "Connect" clicks finish instantly without any sign-in window.
- Many catalog steps are stale (the UI improved since the catalog was written). Where the UI is better than the story, the verdict is PASS and the drift is listed.
- Coverage: 109 stories in scope. Walked (PASS or FAIL, full or partial): 40. BLOCKED: 21. SKIPPED (not walked; time, load and shared-state risk): 48. See the per-story list.

## Verdicts (steps actual / ideal)

Format: story, verdict, steps actual/ideal, one line.

### APP: sign-up, sign-in, onboarding
- APP-001 PASS 4/5. Welcome, Sign up, form, Create account lands in Chief with the focus card in about 2 s. Clean.
- APP-002 PASS 2/2. Focus card now has four choices (A to D, no "Inbox and email"). The first-run tour popover (1/9) appears on top of Chief's connect cards right after the choice (W9-01).
- APP-003 PASS (partial) 3/4. Wrong password message, Forgot password, "Check your email" screen verified. The emailed link step is BLOCKED (no mail delivery).
- APP-004 BLOCKED. Billing is off on the demo; no paywall appears.
- APP-101 PASS 3/3. Native validation tooltip for a bad email; "User already exists. Use another email." for a taken one. The form shifts up about 16 px when the error appears (P3, W9-14).
- APP-102 BLOCKED. Server has email verification off (sign-up goes straight into the app).
- APP-103 PASS 2/2. `/reset-password?error=INVALID_TOKEN` shows the red message; "Reset password" is disabled, but the two password boxes still look usable (W9-07).
- APP-104 BLOCKED (no SSO configured). APP-105 SKIPPED (needs a failing options request).
- APP-106 PASS 3/3. Behavior is better than the story: a signed-out link to `/app/finance` goes to `/sign-in?next=/app/finance` and returns there after sign-in.
- APP-107 PASS 3/4. Log out is in the account menu; lands on `/sign-in`, not Welcome. Back button returns to sign-in with `next` kept.
- APP-110 SKIPPED. APP-113, APP-114, APP-115 BLOCKED (billing off).

### APP: shell, navigation, hide amounts
- APP-008 PASS 3/2. Cmd+K opens the palette. Pages now come first, then Bots. Typing "fin" finds Finance and two finance bots. The "Cap table" page is absent only when hidden in Page options.
- APP-009 PASS (partial). Phone drawer verified (see 121). Desktop hide/show sidebar not exercised.
- APP-121 PASS 2/2. Menu icon opens a 316 px drawer with a dark strip; Inbox closes it. Swipe not tested. No horizontal overflow on Inbox at 390 px.
- APP-123 PASS (partial). A skip link exists. Focus rings are visible (2 px solid). Each bot row has two tab stops (row plus "Actions for" button), so reaching the composer takes many Tabs (W9-12).
- APP-124 PASS 2/2. Activity block lists Needs you / Working / Finished (collapsed "Show 4 finished runs"). The bot list is squeezed to two rows below it.
- APP-125 FAIL (minor) 3/3. Once opened, the filter form cannot be closed and hides the "Activity / Filter" header (W9-02).
- APP-126 BLOCKED. Settings shows Browser notifications as "Blocked" in the headless browser.
- APP-128 PASS 2/2. Hide amounts is in the account menu only; the story's eye icon in the Finance and Cap table headers no longer exists (W9-13 drift). Finance masks amounts, shows "Chart hidden while amounts are hidden", and drops the sidebar runway badge.
- APP-130 PASS 3/3. Version menu, Download, Maximize all present. HTML preview not opened.
- APP-131 PASS (partial) 2/2. Trash icon appears on row hover; dialog text correct; confirmed only up to Cancel (shared data).
- APP-132 PASS 1/1. Empty state "No artifacts yet / Files your bots make ... Ask a bot to write one. [Open chat]" is excellent (better than the story).
- APP-133 SKIPPED. APP-134, APP-135, APP-136 SKIPPED.
- APP-139 BLOCKED (owner-only software update; the Updates tab shows "Praci keeps itself up to date.").
- APP-140 PASS 2/2. A 404 page ("Page not found ... Go to Praci") now covers `/app/financee`, `/app/inbox/extra`, `/pricing` and `/app/g/not-a-group` (story says silent redirect or blank page; outdated).
- APP-141, APP-142, APP-143 SKIPPED.
- APP-145 PASS (partial). Palette, Activity, Hide amounts and page sweep each exercised on their own; not as one 12-step run.

### APP: bots and chat
- APP-010 PASS 2/3. "+" then "New bot" opens Settings with the Name selected; rename, title, description save on blur. Space move not done.
- APP-011 SKIPPED. APP-159 SKIPPED. APP-160 PASS 3/3 (Avatar Studio is a modal; colors save and show in the sidebar).
- APP-161 PASS (partial). Advanced opens Computer (Team / Private), Open work, Memory, Model, Thinking, Disabled tools. Model change and Save not exercised.
- APP-163, APP-164, APP-165 SKIPPED. APP-166 PASS (partial): Clear conversation dialog verified; Export not run.
- APP-012 PASS (partial). Chief answered a priorities question with a numbered list in about 15 s. Attachment not tried.
- APP-013 PASS (partial) 2/4. React, Reply, Remember, More are 28x28 px (W9-10).
- APP-151, APP-156, APP-014, APP-015, APP-171, APP-168, APP-167, APP-169, APP-170 SKIPPED.
- APP-152 BLOCKED (microphone).
- APP-153 PASS 2/2. Typing "/" lists skills and actions (Open Settings, See usage). One raw slug "devin-sessions" among sentence-case names.
- APP-154 PASS 2/2. Up arrow in an empty composer restores the last message.

### APP: apps, settings
- APP-176 BLOCKED (sign-in window). Mock Connect finished at once and showed "Slack connected / Done". After that the search for "slack" showed "No apps match." (W9-04).
- APP-177, APP-018, APP-181, APP-182 SKIPPED. APP-178 BLOCKED (Carta already connected on the demo; real host needed). APP-179, APP-180 BLOCKED (sign-in callbacks).
- APP-183 PASS (partial): Backup models heading seen at the bottom of Models; not exercised.
- APP-186 PASS (partial). Panel opens; second "Delete account" button below it. Not executed. "Export my data" exists (story says no export).
- APP-187 PASS 1/1. Updates tab now says "Praci keeps itself up to date. If an update ever needs you, it shows here." (story says empty).
- APP-188 PASS 2/2. Memory copy is plain: "What your bots remember between chats, and where they keep it." Provider setup sits under "Advanced: connect an outside memory service".
- APP-189 BLOCKED (needs a voice provider key; provider list loads).
- APP-022 BLOCKED (partial). No Billing tab (billing off). Usage reads "25 tasks done by your bots; 637,358 tokens of AI text; Model spend uses your provider keys."
- APP-023 FAIL 0/3 (known gap). No Members or invite control anywhere in Settings.

### APP: cross-feature journeys
- APP-024 PASS (partial). Inbox, Finance, Cap table, Chief, Activity, Legal each opened. Opening a mail row opens a chat per thread, not a mail view (W9-05).
- APP-025, APP-210 SKIPPED (31 and 14 steps, would send mail on shared data).
- APP-200, APP-203, APP-204, APP-205, APP-206, APP-207, APP-208, APP-212, APP-213, APP-214 SKIPPED. APP-203 partial: the seeded Chief answer to the runway question is "For runway, ask the Finance agent here: Open Finance." (a redirect, not an answer).
- APP-201 PASS (partial). Hide amounts then Finance and Cap table: money masked, share counts and percentages visible on the page.
- APP-202 PASS (partial) with finding. Sweep of Cap table, Inbox, Data room, Legal, Contacts, Artifacts found no `$` amounts left in page text. Chat masks percentages too (W9-08).
- APP-211 PASS (partial). Inbox, Cap table, Carta agent "prepare me for the board" brief, Legal and Data room reached. The brief answered in one ask (about 25 s), but masked ownership percentages (W9-08).

### CAP
- CAP-001 PASS (partial) 1/1. The page is reached in one click; with the agent panel open the holders table starts below the fold (W9-06).
- CAP-002 PASS 1/1. Fresh account: "See who owns your company. Carta is the service many startups use ... [Connect Carta]" on an otherwise empty page. Clear and well written.
- CAP-003 BLOCKED (dialog "Connect Carta / Cancel / Sign in with Carta" reached; sign-in needs real Carta). CAP-004, CAP-005 BLOCKED. CAP-024, CAP-026, CAP-032 SKIPPED.
- CAP-007 PASS 2/2. Collapse Carta agent gives an "Ask" button and a much better layout (donut card goes wide and short).
- CAP-008 PASS 1/1. Carta agent opens full screen with a "Back to Cap table" link (better than the story).
- CAP-018, CAP-019 SKIPPED. CAP-020 PASS (partial) 1/1 (see APP-211).
- CAP-021 PASS 1/1 (via account menu; no eye icon). Percentages and share counts stay visible on the page.
- CAP-022, CAP-023 PASS (partial). Phone: no overflow; donut about 280 px tall, legend and holders far down (W9-06).
- CAP-025 PASS (partial). Refresh shows "Reading Carta..." and did not finish within 30 s under load.
- CAP-028 PASS (partial). The palette finds Cap table by "cap" or "equity" when the page is not hidden.
- CAP-033 SKIPPED (the agent panel with hidden amounts was seen once; see W9-08).

## Praise (observed)

- Fresh-account first run is short and clean: Welcome, sign-up, Chief greeting and a focus card in about 2 s (a001-4.png).
- Finance with hide amounts is thorough: masks every figure, the chart and the upcoming list, and keeps the shape (a128-1).
- Empty states for Artifacts and day-one Cap table say what the page is and give one action.
- The 404 page, the sign-in `next` target, and the Updates, Memory and Models copy all improved over what the catalog describes.
- Slash menu, Cmd+K palette and the Avatar Studio are fast and legible.

## Findings

| id | page or story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| W9-01 | APP-002, APP-001 | P2 | flow | Observed. Right after Maya answers the focus card, the tour popover "1/9 Chat with Chief here..." opens over the new Gmail connect card and Chief's reply, hiding the card title and "Authorize". Two guided things compete in the first minute. | a002-1.png | `apps/web/src/components/tour/TourPopover.tsx` | Start the tour only after the focus card is answered and its connect cards are acted on, or anchor the popover away from the thread. |
| W9-02 | APP-125 | P3 | flow | Observed. Clicking Filter opens a four-field form (search, status, two dates, about 230 px) that replaces the "Activity / Filter" header; there is no way to close it, and it pushes the run list below the fold of the 316 px sidebar. The "Failed" chip repeats the select value. | a125-1.png, a125-2.png | `apps/web/src/pages/ActivityList.tsx:135` (form shown while `showFilters \|\| filtersOn`, no close) | Keep the header with a toggle, and show only a status select by default with dates behind "More". |
| W9-03 | APP-010 and others | P3 | a11y | Observed. The create button has the accessible name "+" (snapshot: `button "+"`); "Create" exists only as a tooltip title. Screen readers and role queries get "+". | agent-browser snapshot, a010-1.png | `apps/web/src/pages/Shell.tsx:3933` (`title={t\`Create\`}`) | Add `aria-label={t\`Create\`}` to the trigger. |
| W9-04 | APP-176, APP-207 | P2 | flow | Observed. Searching Apps for an app that is already connected ("gmail", or "slack" just after connecting it) shows "No apps match." because connected apps are hidden while a search term is active. Maya cannot confirm a connection by searching, and the success dialog is followed by an apparent failure. | a176-3.png | `apps/web/src/components/integrations/IntegrationsHome.tsx:407` (connectedApps hidden when a query exists) and `:702` | Include connected apps in search results with their "Connected" tag. |
| W9-05 | APP-024, APP-212 | P1 | bug | Observed, probably mock-limited. A mail-thread chat ("[MOCK] Redlines on the Master Services Agreement") shows an "Email thread, 7 messages" chip, yet its bot answers "I don't see the email thread here, please paste it" and later "can't access the email thread or reply controls". Summarize-this-thread fails on the thread's own chat. Suspected: the demo Gmail mock lacks thread tools. | j-mail.png | not located (thread-bot tool wiring in apps/api) | Give thread bots the thread content they are attached to, or hide "Ask about this thread" when it cannot work. |
| W9-06 | CAP-001, CAP-022, CAP-023 | P2 | visual | Observed. With the agent panel open (default at 1440 px) the donut card is about 490 px tall with two legend rows and a 220 px empty lower half, so the holders table (Maya 40%) starts at y=860 and is below the fold. On a phone the donut is about 280 px and the legend sits near the bottom of the first screen. With the panel collapsed the card is wide and short and the table is visible. The donut shows share classes, not people. | a-cap-2.png vs j-cap2.png, m-cap.png | `apps/web/src/components/cap-table/OwnershipDonut.tsx:349` (layout switches at `@md`) | Use the compact horizontal donut layout at container widths under about 700 px and cap the donut size on phones, so the holders table is visible without scrolling. |
| W9-07 | APP-103 | P2 | flow | Observed. An expired reset link shows the full "Choose a new password" form with a red error, but the button is disabled, so Maya may type two passwords into a form that cannot submit. | a103.png | `apps/web/src/pages/Auth.tsx:354-356,416` | When the link is invalid, show only the message and "Request a new link", not the form. |
| W9-08 | APP-202, APP-211, CAP-033 | P2 | flow | Observed. With Hide amounts on, Carta agent chat masks ownership percentages ("Maya Chen •••%; River •••%"), while the Cap table page shows 40.00% and 30.00%. The brief Maya wants for the board call loses its main fact, and the two surfaces disagree. The tooltip names only currency amounts. | j-board.png, j-cap.png | chat text masker (not located; `apps/web/src/lib/hide-amounts-preference.ts` holds the setting) | Mask only currency in chat, matching the page, or say in the setting copy that percentages are hidden in chat too. |
| W9-09 | APP-128, APP-201 | P3 | flow | Observed. The story says Finance and Cap table headers have an eye icon. Neither has one; Hide amounts exists only in the account menu (bottom-left). For "before I share my screen" the toggle is two clicks and is not on the pages that show money. Catalog drift or lost affordance. | a128-0, a128-1 | `apps/web/src/components/finance/ui.tsx`, commit be283d08b ("Hide amounts entry points") | Decide on purpose; if the icon was removed deliberately, update catalog stories APP-128, CAP-021, APP-201. |
| W9-10 | APP-013 | P3 | a11y | Observed. Message actions (React, Reply, Remember, More) are 28x28 px and appear only on hover or focus. | measured: all four 28x28 | chat message action row (not located) | Make the targets at least 32 px, or 44 px on touch widths. |
| W9-11 | APP-160 | P3 | a11y | Observed. Avatar Studio colour swatches are 24 px; shape buttons are named by code words ("hex", "wedge", "tablet"). | dialog button list | `apps/web/src/pages/shell/avatar-studio-popover.tsx` | Enlarge swatches to 32 px and give shapes plain names. |
| W9-12 | APP-123 | P3 | a11y | Observed. Every bot row has two tab stops (row plus "Actions for X"). With about 15 bots, Tab reaches the composer only after about 30 presses unless the skip link is used. | tab trace | `apps/web/src/pages/Shell.tsx` bot row | Make the actions button reachable by arrow keys inside the row (roving focus), or only on row focus. |
| W9-13 | APP-008, APP-128, APP-140, APP-132, APP-187, APP-106, APP-006 (catalog drift) | P3 | copy | Observed. Catalog stories no longer match the UI: palette order (Pages first), focus card has four choices, 404 page exists, `next` is kept on sign-in, Artifacts and Updates have copy, Settings has "Export my data", the page is "Apps" not "Integrations". Walkers will report false failures. | this report | `docs/ux-paths/catalog.md` | Refresh those stories before the next walk. |
| W9-14 | APP-101 | P3 | visual | Observed. The sign-up form moves up about 16 px when the red error line appears (title and fields shift). | a101-1.png vs a101-2.png | `apps/web/src/pages/Auth.tsx:290` | Reserve space for the error line. |
| W9-15 | Apps page | P3 | visual | Observed. The Apps page title and subtitle are inline at the top (y=34), with no header bar; Finance, Artifacts and Cap table have a header bar at the same position. Coinbase's connected tile has "Replace key / Open" while others have "Open Finance"; "Open" alone is ambiguous. | a176-1.png | `apps/web/src/components/integrations/IntegrationsHome.tsx` | Use the shared page header; label the Coinbase action "Open Finance". |
| W9-16 | Legal page | P3 | visual | Observed. In the contracts table the Term column wraps date ranges mid-range ("Aug 22, 2026 - Aug 22, / 2027") and the stat cards "Open deadlines 13" and "Overdue 1" are flagged by the geometry audit as wrapped (by design: label over number). Header shows "Last scan failed: OpenRouter did not accept your key" (demo state) naming a vendor to a first-time user. | j-legal.png | `apps/web/src/pages/Legal.tsx` (Term cell) | Keep date ranges on one line (`whitespace-nowrap`) and say "Replace your AI key" without the vendor name. |
| W9-17 | Cap table (fresh load) | P3 | perf | Observed once (a load-average 22+ machine, so weak evidence). On a cold load the Cap table showed the contacts-only table (Name, Email, Kind, no ownership) for several seconds before the ownership view appeared, with no skeleton. | a202-cap-table.png | `apps/web/src/pages/CapTable.tsx:300-320,641` | Show a skeleton until the snapshot request resolves. |

Notes on the observation that did not become a finding: while typing into the Chief composer with `agent-browser keyboard type`, the draft grew thousands of newlines and the sent message rendered one character per line (a012-2.png). Using `fill` worked normally. This is treated as a harness artifact and not reported as a defect.

## Summary counts

Stories in scope 109. PASS (including partial): 40. FAIL: 2 (APP-023 known gap, APP-125 minor). BLOCKED: 21. SKIPPED: 46.
Findings: 17 total. P0 0, P1 1 (W9-05), P2 5 (W9-01, W9-04, W9-06, W9-07, W9-08), P3 11. All symptoms observed; the cause of W9-05 is suspected. Verdict counts are approximate (tallied by hand from the list above).
