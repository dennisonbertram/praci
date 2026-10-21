# UX walk W7: Finance and Legal (older stories)

Session uxl2-W7. Target: mock-data demo stack (web 5381, API 3308), 1440x900 unless noted, dark theme.
Screenshots: /tmp/uxloop2/W7/. Account: the seeded mock founder (Maya Chen).
Method: stories followed through the real UI; most steps reached by clicking, some by direct URL.

## Conditions that limit this walk

- The demo is not empty (NW-BASE style data, Mercury and Brex already connected, Legal already scanned). Stories that need an empty space or a real OAuth sign-in are BLOCKED.
- The demo's OpenRouter key is rejected by the Legal scan (401 "User not found"), so every Legal story that needs a successful scan is BLOCKED. The Finance agent answered fine on the same stack, see W7-07.
- Host load average was 20 to 73 (about 20 parallel walkers on one machine). Load times (10 to 50 s on some Finance pages) are not reliable measurements.
- Stack state I changed and restored: Count crypto (set, then back to Don't count), a statement account renamed and renamed back, Hide amounts toggled (left Off), and I clicked Allow on the Legal consent card (not undoable, no revoke control). Two failed Legal agent runs now sit in the Legal agent thread. Two dummy files were uploaded to the statement dialog and dismissed (nothing imported).
- The catalog is stale for Hide amounts: the header eye icon was removed on purpose (commit be283d08b, "Hide amounts lives only in the account menu"). FIN-024/030/031/036 step 1 as written cannot be followed. Also stale: LEG-007 step 2 (KPI tiles are now links), LEG-001..006 preconditions, FIN-029 (share counts and percentages are intentionally not masked, shareCount/percentFigure in finance-format.ts).

## Story verdicts

Steps are actual/ideal. PARTIAL means some steps were run; the line says which.

### Finance (36 stories: 24 PASS, 1 FAIL, 7 PARTIAL, 3 BLOCKED, 1 SKIPPED)

- FIN-001 BLOCKED: needs an empty space and Mercury OAuth.
- FIN-002 PASS 1/1: Cash card readable ($1,633,221, "5 bank accounts"); Cash opens Accounts, total and list reconcile (5 accounts sum to the card).
- FIN-003 PASS 1/1: refresh icon shows "Syncing..." then "Updated just now" in about 2 s. Opening Finance also syncs on every visit.
- FIN-004 PASS 2/2: Burn page KPI, chart, "Where it went", By account, By month (Oct row shows +$257,016 net because of $250,000 financing).
- FIN-005 PASS 2/2: By month row opens August; page title and breadcrumb both say Aug 2026. `/month/2026-8` gives "Not found" with a Finance back button.
- FIN-006 PASS 1/1: Runway page is clear (Run-out date, "Financing: In cash, not counted as burn" is clearer than the catalog).
- FIN-007 PASS 3/2: Quarter tab and category chip work and update the total. In October Quarter equals Month (Q4 starts Oct 1), so the tab change looks like nothing happened. No search or export, as the story expects.
- FIN-008 PASS 2/2: Breakdown to Software category page.
- FIN-009 PASS 3/2: Breakdown, Vendor toggle, Globex Cloud vendor page.
- FIN-010 PASS 1/1: Subscriptions table with "overlaps" pill; no cancel control (story notes this).
- FIN-011 PASS 2/1: bill row opens a popover (amount, due, status) in place.
- FIN-012 PARTIAL: Brex charge page reached (vendor to row); the demo charge has no receipt, so the receipt thumbnail and receipt page were not reached. Page says "No receipt" with no next step (W7-20).
- FIN-013 PASS 2/2: Mercury spend charge, "Check for receipt" then "No receipt". Inbound revenue charge correctly has no receipt section.
- FIN-032 PASS 1/1: By vendor works; the choice persisted across pages.
- FIN-014 PASS 2/2: Accounts, then Mercury Treasury page (balance, 4.2% yield). "Card balance owed: Brex does not share it".
- FIN-033 PASS 2/2: Brex chip opens source-filtered Accounts, "Brex spend" opens Spend with a Brex badge. `?source=chase` shows the "Unknown source" badge.
- FIN-015 PASS 3/2: Count crypto saves "all crypto" at once (Cash goes from $1,633,221 to $1,738,471, runway 24.2 to 25.7 mo, arithmetic checked), then Stablecoins only ($1,710,221, 25.3 mo). Button stays disabled with no progress text while saving (W7-19).
- FIN-016 PARTIAL: Add wallet dialog checked: duplicate shows "That wallet is already added", unknown ENS shows "That ENS name was not found". Add, edit, remove and Kraken connect not run (would change shared demo data and need exchange stubs).
- FIN-035 PARTIAL: Crypto page loads with no key; the "Add Blockscout API key" note from the story was not shown on this demo (a key may exist). Integrations tile not checked.
- FIN-017 SKIPPED: no statement-due banner in the demo (the statement account is up to date). The Upload statement dialog opens from the account page and lists the earlier import.
- FIN-018 PARTIAL: dropped a `.docx` and an invented CSV. The `.docx` shows "Upload a PDF, CSV, OFX or QFX file" with Dismiss. The CSV gives only "Could not read this file" (W7-24). Oversize file and the "$12.40 off" review path not run (no fixtures in the repo).
- FIN-034 PASS 2/2: Rename on the statement account; title and Accounts list update. Reverted.
- FIN-023 PASS 1/1: transaction, `/budget`, and `/month/2026-8` all show "Not found" with a Finance button; unknown source shows the badge.
- FIN-024 PASS (changed) 2/1: no header eye any more; Hide amounts is a checkbox row in the account menu. Masks Cash, burn, spend total, breakdown, upcoming, subscriptions footer, and now replaces the burn chart with "Chart hidden while amounts are hidden". Nothing on the page says amounts are hidden or offers a way back (W7-02).
- FIN-025 PASS 2/2: account menu row "Hide amounts / Hides money amounts in finance, chat and email."
- FIN-026 PASS 2/2: reload keeps it masked from first paint (localStorage key `rakazo.hideAmounts`). Other device, second tab, sign-out parts not run.
- FIN-027 PASS 4/4: Burn, month, vendor, runway, accounts, crypto all masked, charts replaced. Exception: runway months and run-out date (W7-01). Memo-with-dollar case not testable (no such memo in demo data).
- FIN-028 PASS 2/2: Accounts and Crypto masked, symbols and addresses visible.
- FIN-029 FAIL: Cap table masks money ($ values) but shows share counts and percentages by design. In chat, card shows "24.2 mo", text says "••• months", and "October 25, 2028" shows (W7-01).
- FIN-030 PASS 1/1 (layout only): phone width dashboard is clean, no overflow. Hide amounts on phone not exercised.
- FIN-031 PASS 4/2: Tab reaches the account menu items; Enter on "Hide amounts" toggles it and focus returns to the account button. ArrowDown did not move between menu items in agent-browser (W7-21).
- FIN-019 BLOCKED: needs empty space and bank OAuth. Steps 6 to 16 (read KPIs, runway, breakdown, vendor, transaction, accounts, refresh, Ask) were exercised elsewhere in this walk and work.
- FIN-020 PARTIAL: Crypto KPI, Count crypto, Stablecoins only, Ask panel and answer (card, then text) run. The "Draft an investor update" prompt, Ask about this and the move-money refusal not run (the sidebar thread shows another walker already got the refusal: "I can't initiate payments or move money").
- FIN-021 BLOCKED: needs an empty space and three statement files.
- FIN-022 PARTIAL: Finance agent opened from the sidebar shows pins (Cash, Runway, masked correctly when hidden, so the old catalog problem 1 is fixed) and the "Month-end close" checklist. No reconnect state in the demo (Mercury chip green).
- FIN-036 PARTIAL: steps 1 to 6 and 8 run (mask, reload, Cap table, detail pages, Ask, agent pins masked, Show amounts). Data room invoice image preview not checked. See W7-01 and W7-09.

### Legal (29 stories: 15 PASS, 9 BLOCKED, 5 SKIPPED)

- LEG-001 BLOCKED: demo is already scanned; Allow works but Scan now fails with a 401 key error.
- LEG-002 BLOCKED: no no-key state. The key-failure variant shows "Replace OpenRouter key" (header) and "Open Models settings" (panel), both land on the right Settings screen with the replacement field focused. Good.
- LEG-003 BLOCKED: cannot add a working key.
- LEG-004 PASS 1/1: card "Let Praci read your contracts. The text is sent to the AI model that runs your bots." with Allow. Much shorter than the catalog's card; no Not now, no folder list, no revoke. Allow clears the card with no confirmation line, caption becomes "Last scan 3h ago. Scans daily."
- LEG-005 BLOCKED: Scan now shows "Scanning..." then fails after about 5 s because of the key, so progress and summary cannot be judged.
- LEG-006 PASS 1/1: caption "Last scan 3h ago. Scans daily." answers the "why not every day" question. A failed scan reads "Last scan failed: OpenRouter did not accept your key." with a button to fix it.
- LEG-007 PASS 4/3: opens on Contracts; Overdue tile is a link to `?view=deadlines&due=overdue` ("Showing 1 overdue deadline. Show all 13 open deadlines"). Clear.
- LEG-008 PASS 2/2: lease link opens the Data room preview; browser Back returns to Legal. With Hide amounts on the preview is blocked (W7-09).
- LEG-009 PASS 1/1: "4 Data room documents not yet checked by Legal" is now an underlined line, not a tile. It links to the unfiltered Data room (W7-08).
- LEG-010 SKIPPED: needs rows recorded as not legal.
- LEG-011 PASS 2/1: Deadlines tab, "Due in N days" within 30 days.
- LEG-012 PASS 2/1: Dismiss shows "Dismissed ... Undo", Undo restores the row. Buttons are named "Mark <title> done" and "Dismiss <title>". No hint on what Dismiss means (W7-12).
- LEG-013 BLOCKED: needs a new lease upload and a working scan.
- LEG-014 PASS 2/1: Graph, click Halcyon, relations and "Open document" links show under the diagram.
- LEG-015 SKIPPED: only 10 contracts; the 120-node cap is not reachable. No search in Graph or Contracts.
- LEG-016 BLOCKED: asking before consent gives a failure (W7-06); after Allow the agent run would hit the key failure.
- LEG-017 BLOCKED: needs time simulation and scans.
- LEG-018 BLOCKED: scan fails; Gmail path not available.
- LEG-019 PASS 1/1: this roster has one legal bot, "Legal agent". No "Legal Desk (mock)" bot exists, so the two-bot confusion does not occur.
- LEG-020 PASS 1/1: Legal row in sidebar, route and the three tabs exist.
- LEG-021 SKIPPED: not an empty state.
- LEG-022 PASS 2/2: failed scan caption plus "Replace OpenRouter key" leads straight to the fix. There is no Retry button; Scan now serves. The toast is raw JSON (W7-05).
- LEG-023 SKIPPED: scan fails in 5 s, so the running state across navigation cannot be held.
- LEG-024 PASS 3/3: phone width shows two tiles per row, contract cards with labels, a "Scroll sideways to see the whole graph" hint, no page overflow.
- LEG-025 PASS 2/1: with `/rpc/legal` blocked the page shows "Could not reach the server" and Try again; after unblocking, Try again reloads the page. The error replaces the whole page including the header (W7-22).
- LEG-026 PASS 1/1: Value column masked as "•••" (no "$", unlike Finance "$•••").
- LEG-027 PASS (partial): tabs are real tabs, buttons have row-specific names. Graph keyboard selection not run.
- LEG-028 SKIPPED: would delete a shared demo document.
- LEG-029 BLOCKED: needs the Legal agent to run.

## Findings

| id | story / page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix | status |
|---|---|---|---|---|---|---|---|---|
| W7-01 | FIN-024, 027, 029, 036 | P2 | bug | With Hide amounts on, runway is masked on some surfaces and not others. "24.2 mo" shows on the Finance card, Runway page and chat card; the pin shows "••• mo"; the agent text says "••• months" but still prints "October 25, 2028". The dashboard masks the run-out ("Until •••") while the Runway page shows "Oct 25, 2028". One rule is expected. | fin-hidden.png, fin-chat2.png, fin-agent-hidden.png; Runway page text | packages/chat-ui/src/mask-currency.ts:66-90 (runwayMatches), apps/web/src/lib/hide-amounts-preference.ts:124 (maskPinFigures), apps/web/src/pages/finance/FinanceBurn.tsx | Pick one policy for runway months and run-out date and apply it in the cards, pins, text masker and Runway page | observed |
| W7-02 | FIN-024, 036 | P3 | flow | The header eye is gone (be283d08b). After hiding, the page shows dots but no indicator and no control; to show numbers for the board Maya must open the account menu. | fin-hidden.png | apps/web/src/components/finance/ui.tsx DetailHead, pages/Finance.tsx header | Show a small "Amounts hidden" chip with a Show button in the Finance header while it is on | observed |
| W7-03 | Finance dashboard, Burn | P2 | visual | The dotted Financing line climbs diagonally from $0 in Sep to a point above the $150k axis labelled "↑ $250,000", crossing the spend lines, though the raise was one event on Oct 13. The legend shows a hatched bar swatch for Financing but the chart draws lines. | fin-dash.png, fin-burn.png | apps/web/src/components/finance/charts.tsx (burn line chart) | Draw financing as a marker at its date (not an interpolated ramp) and use a matching legend swatch | observed |
| W7-04 | Crypto page chart | P3 | visual | Last x-axis label "Oct 21" is clipped to "Oct 2": text right edge 1403 px, svg right edge 1398 px. | fin-crypto.png; measured via eval | apps/web/src/components/finance/charts.tsx:229 (textAnchor middle, no end clamp; the bar chart at :587 has one) | Anchor the last label to "end" as the bar chart does | observed |
| W7-05 | LEG-022 | P1 | copy | A failed Legal run raises a toast "Legal agent failed: 401: {"message":"User not found.","code":401}" while the panel shows the plain "The model provider did not accept your API key". Raw JSON is shown to a founder. | leg-scan1.png | run-failure toast path (apps/web AppToaster / notification text for failed runs) | Map provider errors to the same plain message in the toast, never show raw JSON | observed |
| W7-06 | LEG-016 | P2 | flow | Asking the Legal agent before allowing access ends in a chat reply, a red card and a toast all saying "Data Room consent is required for OpenRouter before the Legal agent can run. Allow it on the Legal page." The Allow card is on the same page but the message has no Allow button and uses terms Maya does not know. | leg-ask.png | apps/api executor consent check message; apps/web/src/pages/Legal.tsx consent card | Put an Allow button in the failure reply and drop "OpenRouter" and "Data Room consent" wording | observed |
| W7-07 | LEG-005, 022 | P2 | bug | The Legal scan says "OpenRouter did not accept your key" (401 User not found) although Settings > Models shows OpenRouter Connected with 386 models and the Finance agent answered on the same stack minutes earlier. A user may replace a working key. Cause not verified; may be the demo's key for the Muse Spark route only. | leg-scan2.png, leg-keysettings.png | apps/api/src/legal.ts (model resolution), Legal.tsx caption | Check which key the Legal route uses and word the message by the route that failed | suspected |
| W7-08 | LEG-009 | P2 | flow | "4 Data room documents not yet checked by Legal" opens the full Data room unfiltered; nothing marks which files are unchecked. | leg-unreviewed.png | apps/web/src/pages/Legal.tsx:253 (Link to DATA_ROOM_PATH) | Link to a Data room view filtered to unchecked files, or list them in place | observed |
| W7-09 | LEG-008, FIN-036 | P2 | flow | With Hide amounts on, the lease link from Legal opens a Data room preview that says only "Hidden while amounts are hidden"; Maya cannot read the renewal clause and the preview has no way to show it. | leg-lease.png | apps/web/src/components/data-room/ItemDialogs.tsx (preview masking) | Show a "Show amounts" action in the blocked preview, or only block images, not text PDFs | observed |
| W7-10 | LEG-004 | P3 | copy | Scan now is greyed while the consent card is shown but nothing next to it says why (the old "Allow access below first" text is gone). The card also has no Not now. | leg-home.png | apps/web/src/pages/Legal.tsx header | Add a title or one short reason on the disabled button | observed |
| W7-11 | LEG-007 | P3 | visual | Contracts table rows have uneven heights: Term and Renewal wrap to two lines on some rows and not others; Value header sits tight against Next deadline. | leg-home.png | apps/web/src/pages/legal/LegalContracts.tsx | Give Term a fixed min width or allow no-wrap; add column gap | observed |
| W7-12 | LEG-012 | P3 | copy | Done and Dismiss look similar and have no hint on what Dismiss does (it removes the item from every list, with 8 s Undo). | leg-deadlines.png | apps/web/src/pages/legal/LegalDeadlines.tsx | Tooltip "Dismiss: not relevant, remove it" | observed |
| W7-13 | LEG-022 | P3 | visual | With the Legal panel open the header caption is cut ("Last scan failed: OpenRouter did not accep…") and the company name ("Northwind Ro…"), with no full text on hover. | leg-scan2.png | apps/web/src/pages/Legal.tsx header | Wrap the caption onto a second line or add a title attribute | observed |
| W7-14 | FIN panel | P3 | visual | With the Ask panel open, "1 non-USD not counted" wraps to two lines and the Accounts button is squeezed against the chips. | fin-ask-hidden.png | apps/web/src/pages/Finance.tsx header | Hide or collapse this note when the panel is open | observed |
| W7-15 | Finance dashboard | P3 | copy | Three "monthly" figures for one vendor: Subscriptions "Per month" $2,016 (3-month average), vendor "Monthly avg" $1,728 (6 months), latest charge $2,400. Windows are not labelled in the table. | Globex rows on dashboard and vendor page | packages/core/src/finance/metrics.ts:705-710 | Label the window ("3-mo avg") in the Subscriptions header | observed |
| W7-16 | Finance dashboard | P3 | copy | Crypto card shows $105,250 (all crypto) with the subtitle "Stablecoins in runway · 1 unpriced" when only stablecoins ($77,000) count. The headline and subtitle describe different amounts. | fin-dash-stable text | apps/web/src/pages/Finance.tsx:803 | Show the counted amount, or reword the subtitle | observed |
| W7-17 | Finance detail pages | P3 | visual | The page name appears twice: breadcrumb then H1 ("Finance / Breakdown / Software" then "Software"; "Aug 2026" then "August 2026"). | fin-cat.png, fin-aug.png | apps/web/src/components/finance/ui.tsx DetailHead | Drop the last crumb when it repeats the title | observed |
| W7-18 | Finance (load) | P3 | perf | Under host load 20-73: month page 10 s, Treasury account page about 50 s of "Loading...", sidebar blank on direct loads, and the Count crypto button disabled about 30 s with no progress text. Dev server also fetches about 60 unbundled modules per page. Load-confounded, not proof of a product slowdown. | fin-aug.png, fin-treasury loads | n/a | Re-measure on an idle host; add a "Saving..." label to Count crypto | observed, unreliable |
| W7-19 | FIN-012, 013 | P3 | flow | A charge with no receipt ends at "No receipt" with no way to attach one or ask the agent, though the goal is "my accountant needs this receipt". | fin-receipt.png | apps/web/src/pages/finance/FinanceTransaction.tsx | Add "Ask about this" or an upload on the empty receipt state | observed |
| W7-20 | FIN-031 | P3 | a11y | In the account menu, ArrowDown did not move focus between items (Tab did). Menu roles expect arrow keys. May be a test-tool effect. | focus checks in session | apps/web/src/pages/Shell.tsx account menu | Verify with a real keyboard; add arrow-key roving | suspected |
| W7-21 | LEG-025 | P3 | visual | A failed load replaces the whole Legal page with a bare red strip at top left: no title, header or Ask button. | leg-neterr.png | apps/web/src/pages/Legal.tsx (ErrorNotice early return) | Keep the page header and show the error under it | observed |
| W7-22 | FIN-018 | P3 | copy | A plain bank-style CSV (Date, Description, Amount, Balance) gives only "Could not read this file", with no hint of what format is expected. My CSV was invented, so the reader may need other columns. | session output | apps/web/src/components/finance/StatementImport.tsx | Say what is missing ("needs an opening balance") | suspected |

## Excellent (keep)

- Legal KPI tiles are links with URL state (`?view=deadlines&due=overdue`) and a clear "Showing 1 overdue deadline. Show all 13" line.
- Legal failure caption pairs the reason with a fix button, and "Replace OpenRouter key" lands on the right Settings field, focused.
- Legal at 390 px: cards instead of a wide table, a scroll hint on the graph, no overflow.
- Hide amounts now replaces every chart with a message, masks pins, and survives reload from first paint.
- Finance Runway page lists exactly what counts and why (Financing, Treasury yield, Card balance owed).
- Finance phone layout is clean with no overflow.
