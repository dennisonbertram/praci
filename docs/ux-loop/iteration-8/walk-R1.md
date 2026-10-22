# Walk R1 (iteration 8): verify pass-7 clusters C1-C10

Target: mock demo stack (web 5381), 1440x900, dark theme, one first-run session plus one fresh invented sign-up for the consent flow. Screenshots are under /tmp/uxloop8/R1/. The demo stack restarted once during the walk and re-seeded the user, and other walkers were sending messages to the same Chief thread, so some state changed under me.

## Verdict per cluster

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C1 Chief hand-off and approval | PARTLY | 2/2 | Link and row label met; toast criterion not exercised |
| C2 Email agent draft | PARTLY | 4/4 | Chip, spinner and button exist; panel not centred; button shows on a refusal |
| C3 Cap table renamed to Investors | PASS | 1/1 | Tour stop 5, Chief greeting, palette alias all correct |
| C4 Money card headline | PASS (code only) | n/a | Needs a live payment tool; fix and test at approval-ask.ts:315 and approval-ask.test.ts:385 |
| C5 Burn chart label | PARTLY | 1/1 | Label inside card at 1440 and 375; no 'Projected' label |
| C6 Ask panel scroll | PASS (partial) | 1/1 | Finance Ask opens with 0 px to bottom; Chief divider and 375 pill not tested |
| C7 Raw server text | PASS (code only) | n/a | userMessage and 'Retrying' mapping in code; no way to inject a failure on the demo |
| C8 Consent | PARTLY | 2/2 | Legal single Allow and 'No contracts or deadlines found on Oct 22, 2026' met; partial-allow state not reachable |
| C9 Investors | PARTLY | 2/2 | Total row met; read-only holding card and All-tab SAFE caption do not exist (owner decision replaced them) |
| C10 Chief links | PARTLY | 1/1 | Hand-off link works; payment refusal links Integrations and contradicts the Finance page |

## Acceptance detail

C1
- Chief reply "I've asked the Inbox agent to email Sam ... Open Inbox agent" is a link; one tap shows the Mail approval card (13-inbox-agent.png). MET.
- Inbox agent row reads 'Needs your answer' while the card is pending (12, 14 screenshots). MET.
- No toast over an open email panel: could not trigger. Code: notification-delivery.ts:23 suppresses only for the open chat. NOT VERIFIED.
- Unit tests: not run.

C2
- Plain-text answer shows 'Reply with draft' (17-draft.png). MET, but see R1-01.
- Empty panel has a 'Draft a reply' chip (16-email-panel.png) and it sends the request. MET.
- Ask agent shows a spinner at 26 ms after click (measured by sampling). MET.
- Dialog stays centred when the panel opens: left margin 336 px, right margin 29 px (was 336/336). NOT MET.

C3
- Tour stop 5: "Keep contracts here, and see who owns what in Investors." Fresh user greeting: "keep an eye on cash and your investors". Integrations catalog string in code reads "Investors, equity and cap table". MET.
- Palette 'cap table' returns Investors. MET.
- Remaining 'cap table' strings I found (PageAgentIntro, Investors card title 'Cap table') name the ownership concept, which is allowed.

C5
- Financing label right edge 1396 against card edge 1412 at 1440; 343 against a 375 viewport at 375. MET.
- Breakdown is now a list of 7 rows with 'Show all 9', not a segmented bar. MET in effect.
- Dashed projection has no 'Projected' label (string absent from source). NOT MET.

C6
- Finance Ask panel opens with the last message at the bottom (distance 0 px), no 'N new messages' pill. MET (the demo thread did not have 14 unread).
- Chief at unread divider and the 375 pill overlap: NOT TESTED.

C8
- Fresh user on Legal sees one 'Let Praci read your contracts' card with Allow; after Allow the scan starts ("Reading your Data room...") without another click. MET.
- Empty Data room result: "No contracts or deadlines found on Oct 22, 2026." MET.
- Master switch 'Allow AI models' is on after Allow. The 'only some areas allowed' state cannot be reached from the UI, and Advanced contains only Memory. NOT VERIFIED (see R1-08).
- Chief's mail consent card says 'OpenRouter' and 'Settings under Privacy and approvals'; Settings > Models also says OpenRouter and the section name matches. MET.

C9
- Clicking a holder name (only holders with a matching contact are buttons) opens the 'Edit contact' dialog, an editable form for an existing contact. This matches the owner decision that rows link to Contacts, not the read-only holding card in the cluster. SAFE cap and date are not shown anywhere. PARTLY.
- The All tab no longer exists, so the SAFE caption criterion is void.
- At 1920 the table is capped at 996 px, but Name to Security is 508 px (Name to Fully diluted about 950 px). Email column no longer exists. PARTLY.
- Total row shows 100.0%. MET.

C10
- Chief's hand-off reply names the delegate and links it. MET.
- "Pay Acme Ventures $1,200 from my Mercury checking account" gets "I can't submit the payment because no Mercury or Brex payment connection is available here. Open Integrations to connect one." while Finance says "Mercury, Brex . synced just now". PARTLY (links to Integrations, contradicts the page).
- R1-11 solo repro on a clean slot: not reproduced; I could not set Allow changes on a clean slot.

## Findings

| id | page/cluster | sev | category | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C2 Inbox email agent | P1 | bug | Any plain agent reply after 'Draft a reply' gets a 'Reply with draft' button, including a refusal ("I can't create the reply approval card ... Open Integrations"). Clicking it puts that sentence, with raw markdown "[Open Integrations](/app/integrations)", into the Reply composer with Send enabled. Expected: the button appears only for an actual draft. Observed. | 17-draft.png, 18-reply-draft.png | apps/web/src/components/inbox/EmailAgentPanel.tsx:59-70 (latestTextDraft accepts any non-question text) | Skip answers that contain a link or refusal wording, or have the agent mark real drafts, and strip markdown before inserting. |
| R1-02 | C2 Inbox dialog | P2 | visual | Opening the email agent panel grows the dialog to the right only: margins 336 px left, 29 px right (768 px to 1075 px wide). Criterion was within 8 px. Observed. | 16-email-panel.png, getBoundingClientRect | apps/web/src/components/inbox/InboxMessageDialog.tsx | Grow the dialog from its centre or keep a fixed centred max width. |
| R1-03 | C10 Chief payment reply | P2 | flow | Chief says no Mercury or Brex payment connection exists and links Integrations, while the Finance header shows Mercury and Brex synced. Expected: no contradiction, or a link to the specific Mercury page. Observed (likely a demo seed gap, suspected). | 36-chief-pay.png, 21-finance.png | packages/adapters/src/executor.ts:8099 (prompt text); connected-agent lookup | Check the connection state the reply uses against what Finance shows, and name the missing piece (writes off, no agent) in the reply. |
| R1-04 | C5 Finance burn chart | P3 | visual | Dashed runway projection still has no 'Projected' label. Observed. | 21-finance.png | apps/web/src/components/finance/charts.tsx (burn chart) | Add a 'Projected' text near the dashed segment or in the legend. |
| R1-05 | C9 Investors | P3 | flow | Holder name opens an editable 'Edit contact' dialog; SAFE terms (cap, date) appear nowhere on the page. Cluster asked for a read-only holding card. Owner decision (rows link to Contacts) explains the link, but the missing terms remain. Observed. | 05-holding-row.png | apps/web/src/components/cap-table/HoldingsTable.tsx:79-90 | Decide whether SAFE cap and date belong on the row or in the contact card. |
| R1-06 | C9 Investors at 1920 | P3 | visual | Table is capped at 996 px but Holder to Security is 508 px; page Add contact and Ask buttons sit at the far right edge, detached from the capped content. Observed. | 06-inv-1920.png | HoldingsTable.tsx (w-40 and w-24 fixed columns, table-fixed) | Cap the page content width at the same value as the table, or narrow the Holder column. |
| R1-07 | Settings Privacy | P2 | perf | The Privacy and approvals panel showed an empty 'AI data sharing' card and 'Loading rules...' for about 10 s on first open before the master switch appeared. Observed once; the API was busy and the stack had just restarted, so treat as unconfirmed. | 26-privacy.png, 28-privacy2.png | Settings privacy panel data load | Show a skeleton row in the card and load the rules with the panel. |
| R1-08 | C8 Settings | P2 | flow | Advanced holds only Memory. There is no view of which areas are allowed, so the 'partly allowed' state in the cluster cannot be seen or tested. Observed. | 29-adv.png | apps/web settings Privacy and Advanced panels | Either show per-area state under Advanced or drop that clause from the acceptance. |
| R1-09 | First load | P2 | perf | First load after sign-up showed 'Opening Praci...' then 'Still opening... Try again' for about 20 s; cold Legal page skeleton lasted more than 8 s. Observed on a dev stack that had just restarted; may not reflect production. | 30-new-user.png, 32-legal-new.png | n/a | Re-measure on a warmed build before acting. |
| R1-10 | Tour | P3 | flow | Clicking Skip tour while on Legal moved me to the Chief page (the Ask Chief chip is there, per the owner decision), leaving the page I was on. Observed once. | 33-legal-allow.png | apps/web/src/components/tour/FirstRunTour.tsx | Skip the tour without navigating; show the chip wherever the user is. |
| R1-11 | Sidebar | P3 | visual | After opening the Inbox agent from Chief's link, the sidebar was scrolled so a row's 'Needs your answer' text was cut under the Pages divider. Observed. | 13-inbox-agent.png, 14-inbox.png | apps/web/src/pages/Shell.tsx (sidebar scroller) | Reset or clamp the sidebar scroll when the section list changes. |
| R1-12 | Inbox agent chat | P3 | copy | Chat opens with an Investors-agent message showing a raw record id ("Unable to read mock-demo-29: mail access is not permitted ... No draft was created"). Observed. | 13-inbox-agent.png | demo seed or agent reply sanitising | Replace ids in agent text with the item's name. |

## Excellent

- Chief hand-off now ends in a working 'Open Inbox agent' link and the Mail approval card is one tap away (C1).
- Ask agent gives feedback in under 30 ms; the empty panel's 'Draft a reply' chip is clear (C2).
- Legal first-run is now one Allow that starts the scan, and the empty result states a date (C8).
- Investors total row reads 100.0% and the page reads cleanly at 1440.

## Not covered

C4 live (needs a payments connection), C6 Chief unread divider and 375 pill, C7 live failure injection, C1 toast, tour stops other than 1/5/9.
