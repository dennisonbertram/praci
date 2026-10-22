# Walk R1 (iteration 9): verify pass-8 clusters C1-C10

Target: mock demo stack (web 5381), 1440x900 plus 375x812 for phone checks. Screenshots are in /tmp/uxloop9/R1/. I used the seeded founder for most checks and one fresh invented sign-up (walker R1) for the first-run tour and document consent. Other walkers were using the same demo at the same time, so some cards and rows (Mercury payment approvals, email chats, "New Bot") changed under me. Touch emulation was not active at 375 (the emulated device was overridden by the viewport change), so no touch-target judgments are made; hit-testing was done with elementFromPoint.

## Verdict per cluster

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C1 Email agent draft | PASS | 4/4 | All six criteria met except the refusal unit test (not run); see R1-12 for a leftover "Working..." line |
| C2 Approval status | PARTLY | 3/3 | Mail approval and question rows meet it; a Mercury payment approval still reads "Working..." in the sidebar (R1-02, R1-07) |
| C3 Inbox on a phone | PASS | 2/2 | Sticky header 104 px, tab and hamburger hit-test correctly, no checkbox over the header |
| C4 Docked tables | PASS | 3/3 | Text columns 76-82 px, words wrap at word breaks, sideways scroll |
| C5 Chief and Mercury payments | FAIL | 3/2 | Chief says no bank is connected while Mercury is Connected (R1-01); button does not name the amount (R1-03); two setup controls (R1-04) |
| C6 Activity panel | PARTLY | 3/3 | Met at 1440, nav closes it, reload does not reopen it, clock times; not met at 375 (R1-05); squeezes Pages at 1440 (R1-06) |
| C7 Investors SAFEs | FAIL | 2/2 | Duplicates, bare dash, and Fundraising disagrees (R1-08); owner said another session owns this page |
| C8 Document consent | PASS (partly) | 4/3 | One Allow covers Legal and Data room, Legal panel has Allow; wording of the mail card not unified (R1-11) |
| C9 First-run tour | PASS | 9 stops | Sentences match highlights, tour waits for the Connect card, Skip keeps the route, chip stays; two popover overlaps at 1440 (R1-09) |
| C10 Computer panel | PARTLY | 1/1 | Header matches state; demo shows a black box because the fake sandbox reports "running" with a fake:// screen (R1-13) |

## Acceptance detail

C1
- Refusal never offered as a draft: now only a pending mail_send card produces "Reply with draft" (EmailAgentPanel.tsx:21 latestPendingDraft). MET by code, unit test not run.
- Draft inserted into the composer has no markdown: Reply opened with "Hi Jamie, ... Best, Maya" (em5.png). MET.
- 1440 dialog margins: left 144, right 144 (diff 0). MET.
- 375 header has "Back to email" (aria label) with an arrow (em6.png). MET.
- Offline send shows "Could not reach Praci. Try again." with Retry (em7.png). MET.
- Ask agent then Draft a reply produced a Mail "Needs approval" card (em3.png, em4.png). MET.

C2
- Mail approval pending: email chat row reads "Needs your answer" and the "Email chats" group shows the count (snapshot). MET. Discard cleared it within one refresh (row changed to "Waiting for the model..."). MET.
- Question card (Investor Relations): row said "Needs your answer"; answering cleared it. The row opened to an unanswered question. MET.
- Mercury payment approval pending (merc3.png): card shows Allow once / Deny while the Mercury agent row reads "Working..." for the 30 s I watched; the row said "needs your answer" in the accessibility name for one poll only. NOT MET. Activity does list it under Needs you with "Send $1,200.00 to Ac..." (m-act.png), so row and Activity disagree.
- One label: "Needs your answer" is defined four times (roster-status.ts:26, PageAgentsRow.tsx:49, sidebar-glance.tsx:63, ActivityList.tsx:478) and "Needs you" is still the Activity section heading and the group dot label. PARTLY.
- Activity preview shows the question or action text, not the generic fallback ("Review before sendin...", "Send $1,200.00 to Ac..."). MET.

C3: At 375, after scrolling the list 400 px, the sticky region is 104 px (limit 120). elementFromPoint over Important, Updates, Newsletters returns the tab buttons and over the hamburger returns its icon. First row (Sam Samplesworth) visible at rest (m-inbox.png, m-inbox2.png). MET.

C4: Finance agent table in the docked panel: Vendor 82, Category 76, Amount 87, Share 56 px; no mid-word breaks; the table scrolls sideways (ask2.png). MET.

C5
- Chief "Pay Bolt Freight 1200 dollars from Mercury": "I can't pay Bolt Freight because no bank is connected yet. Connect Mercury under Integrations first" (c5-a.png) while Integrations lists Mercury as Connected (int.png) and Finance shows "Mercury, Brex synced just now". NOT MET.
- Mercury page without an agent: "Allow changes in Mercury" switch plus a "Create agent" button (merc.png). NOT MET (two controls).
- Payment card primary button is "Allow once", not the amount (merc3.png). NOT MET. The headline names amount, payee and account ("Send $300.00 to Acme Servo Supply (Mock) from MOCK Checking ..1111?"), which is good.
- No raw id in agent-facing text: none seen. MET.

C6
- 1440 with Activity open: 5 chat rows visible (act5.png). MET. 375x812: 0 chat rows visible without scrolling (chat rows start at y=710, under the footer at 700; m-act.png). NOT MET.
- Navigating to Finance closed Activity; reload did not reopen it. MET.
- No heading without a row: seen only rows under each heading. MET (a "Needs you" region with no rows appeared once in the accessibility tree while a card was being answered; not reproduced visually).
- Times: Activity, rows and palette show clock times ("12:38 AM"). MET for Activity and rows; palette not checked.

C7 (judged as it is now): the four SAFE holders appear in the cap table and again in the "SAFEs and funds" list; "Equity raised" is a bare dash; the list's right column is a dash with no header; Fundraising lists Quill Capital $250,000 and Harbor Angels $50,000 from Mercury while Investors shows Priya $250,000, Lee $50,000, Sora $25,000, Tomas $25,000 from Carta, and "SAFEs, if converted at cap" lists Harbor Angels and Quill Capital ($300,000, 2.5%). NOT MET on all four criteria.

C8
- One Allow on Legal removed both the page card and the panel card and started the scan; Data room then showed no consent card (n6.png, n7.png). MET.
- Legal panel shows an Allow card above the disabled composer (n5.png). MET.
- Recipient name: document cards say "the AI model that runs your bots"; the mail card title is "Share your chats and mail with {model name}?" (approval-ask.ts:147). PARTLY (code only; mail not connectable in this walk).
- Confirmation: "Scanning..." and "Reading your Data room..." follow Allow; no explicit confirmation text. PARTLY.

C9
- Stops: Search, Create, Inbox, Finance, Legal ("Keep your contracts here and see which are due soon."), Data room ("Upload files for bots to use."), Chief, Integrations, account menu. Each sentence names only its highlight. MET.
- 375: popovers sit at the bottom or top in free space; no neighbouring row or composer covered (m-t4.png, m-t7.png). MET. At 1440, stops 5 and 7 cover part of a chat bubble beside the highlight (t5.png, t7.png) and stop 1 covers the page title on page routes (n3.png).
- Skip tour on /app/legal left the route unchanged (n4.png); "Ask Chief" chip appears above the composer on Chief (n9.png). MET.
- Tour started only after the "What do you want me on first?" card was dismissed (n1.png, n2.png). MET.

C10: A bot that never ran shows "Computer is on" over a black 214 px box (cp1.png). The iframe is `fake://screen/...`, so this is the demo's fake sandbox. Code at Shell.tsx:3801 hides the box only when there is no screen URL. Error and not-running states could not be produced. PARTLY.

## Findings

| id | story/page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C5 Chief payment | P1 | flow | Observed: Chief says no bank is connected and links Integrations, while Mercury shows Connected and Finance is synced. Expected a hand-off to the Mercury agent or Allow changes. | c5-a.png, int.png | packages/adapters/src/executor.ts:8210 (guidance relies on the model knowing which banks exist) | Tell Chief which finance integrations are connected and whether an agent exists, instead of asking it to infer. |
| R1-02 | C2 Mercury row | P1 | bug | Observed: payment approval waiting, sidebar row says "Working..." (flickers to needs-your-answer once); Activity says "Needs your answer". Mail approvals are correct. | merc3.png, m-act.png | apps/web/src/lib/roster-status.ts:20-27 (only waiting_input maps to the label); suspected: payment approval holds the run in another status | Map every run held on a tool approval to the same held state as a question. |
| R1-03 | C5 approval card | P2 | copy | Observed: primary button "Allow once", no amount. Expected the amount on the button. | merc3.png | apps/web/src/components/AskCard.tsx:65 | Use "Send $300.00" (from the card's amount) as the allow label for money cards. |
| R1-04 | C5 Mercury page | P2 | flow | Observed: live "Allow changes in Mercury" switch and a separate "Create agent" button before any agent exists. | merc.png | apps/web/src/components/integrations/IntegrationAgentSection.tsx:33 | Show one control until an agent exists. |
| R1-05 | C6 Activity at 375 | P2 | visual | Observed: with Activity open, no chat row is visible without scrolling the drawer (rows start at y=710, footer at 700). Expected at least 3. | m-act.png | apps/web/src/pages/Shell.tsx:4347 area (Pages block 430 px plus Activity) | Collapse the Pages block while Activity is open on a phone, or cap Activity at 3 rows. |
| R1-06 | C6 Activity at 1440 | P2 | visual | Observed: Pages block shrinks to about 130 px, so the Legal row is cut in half and five pages need inner scrolling. | act5.png | apps/web/src/pages/Shell.tsx:4347 | Keep all eight Pages rows visible and let Activity share the remaining height. |
| R1-07 | C2 labels | P2 | copy | Observed: "Needs you" remains as the Activity heading and group dot label; "Needs your answer" is defined in four files. Expected one label. | act3.png, grep | roster-status.ts:26, PageAgentsRow.tsx:49, sidebar-glance.tsx:63, ActivityList.tsx:478, Shell.tsx:6883 | Export one label function and use it in all places. |
| R1-08 | C7 Investors/Fundraising | P2 | flow | Observed: SAFE holders listed twice, "Equity raised" bare dash, list column dash with no header, and Fundraising shows different SAFE holders and total ($300,000) than the Investors rows ($350,000). Owner says another session owns this page. | inv1.png, inv2.png, fr1.png | apps/web/src/pages/Investors.tsx:131 | Decide which page owns SAFEs; show amount where a holder is listed, or label the dash. |
| R1-09 | C9 tour at 1440 | P3 | visual | Observed: popover covers chat text beside the highlighted row at stops 5 and 7, and the page title at stop 1 on a page route. | t5.png, t7.png, n3.png | apps/web/src/components/FirstRunTour.tsx placement | Place popovers beside the sidebar column, off the content area. |
| R1-10 | Solo space tag | P3 | flow | Observed: a single-space new user sees "PERSONAL" in the sidebar and "Personal" next to the Legal title. Owner decision: hidden until a second space or member exists. C25 is outside my scope, may not be merged. | n4.png | bot-picker.tsx:86 / Shell space header | Hide both until a second space or member exists. |
| R1-11 | C8 consent | P3 | copy | Observed: the same consent card shows twice at once (page and Legal panel); the mail card names the model, document cards say "the AI model". | n5.png | apps/web/src/components/legal/ConsentPrompt.tsx:19, packages/adapters/src/approval-ask.ts:147 | Show the card once per screen and use one recipient wording. |
| R1-12 | C1 email panel | P3 | visual | Observed: under a pending Mail card the transcript still shows "Working... 1 tool / Mail se..." and after Discard it still shows it; the approval toast covers the panel header at 1440. Toast is C12. | em3.png, em8.png | apps/web/src/components/inbox/EmailAgentPanel.tsx / transcript run row | Hide the working row while the run is held on an approval. |
| R1-13 | C10 demo | P3 | visual | Observed: "Computer is on" over a black box in the demo. Cause suspected: fake:// screen URL in the demo sandbox; real error and not-running states not exercised. | cp1.png | apps/web/src/pages/Shell.tsx:3801 | Treat a screen that sends no frame as "no screen"; verify against a real sandbox. |
| R1-14 | C11 (out of scope) | P3 | copy | Observed: raw tool names in the transcript: "Legal unreviewed documents 5.0s", "Request send money 3.5s". | n6.png, merc3.png | tool-call row label in Transcript | Map tool names to plain labels. |

## Praise
- Email agent panel: centred, clean draft, labelled Back at 375, plain offline message with Retry.
- Inbox on a phone: header is 104 px and tabs are tappable after scrolling.
- Docked tables are readable in the 263 px panel.
- First-run tour waits for the first card, names only the highlighted page, and Skip no longer moves the user.
- One Allow on Legal also covered Data room, with a visible "Scanning..." result.

## Not covered
Mail consent card wording (needs mail connected), real payment approval with Allow changes on (Mercury writes), network-failure states for C7 of pass 7, Storybook, unit tests (not run), touch emulation, console error review.
