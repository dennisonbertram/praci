# Iteration 16 - FLOW critic

Target: mock demo (web :5381), session uxl16-FLOW, 1440x900, existing mock founder account, read-only. Screenshots in /tmp/uxloop16/flow/. Not measured: first-run sign-up/model/tour (would create an account; iteration 14 measured 8 actions and nothing in the code path changed), bot creation and approvals (create data), phone width, OAuth (BLOCKED). The demo account is shared with parallel walkers: an AI-consent card showed on Inbox, Data room and Legal during my first visit and was gone on a later reload while Settings showed every consent on, so I treat it as another walker's change, not a finding.

## Findings

### FLOW-01 GTM is the one page Maya cannot hide, and Cmd+K does not list it as a page
- Page: sidebar, "Show in sidebar" menu, Cmd+K. P2, flow. Observed; code confirmed.
- Happened: the sidebar shows nine pages, but the "..." menu next to PAGES lists only eight (no GTM), so GTM cannot be turned off (`pages-menu` capture `pageopts.png`). The empty Cmd+K lists the same eight (`cmdk.png`). Typing "gtm" gives no Pages result; the GTM agent appears twice, once as the top result and once under Chats (`cmdk-gtm.png`). Inbox, Finance, Legal and the other pages each appear under Pages and their agent under Bots.
- Expected: every sidebar page can be hidden and is found in Cmd+K as a page; the agent shows once.
- Code: `apps/web/src/pages/Shell.tsx:4607-4618` (the `pages` array has no `gtm`, although the row checks `hiddenPages.includes("gtm")` at 4679); the palette's `visiblePages` is built from the same list.
- Fix: add `{ key: "gtm", label: t`GTM` }` to that array so the menu and Cmd+K both see it. Better, hide GTM until a goal is set, as Devin and Task board are hidden until relevant (`p-GTM.png` shows a goal-less page that needs Connect Zernio before it does anything).

### FLOW-02 Opening the GTM page adds a "GTM agent" chat to the sidebar, while every other page agent stays folded
- Page: GTM, sidebar. P2, flow. Observed (`p-GTM.png`, `p-Contacts.png`: a new "GTM agent 10:23 AM" row with no message, listed beside Chief and Investor Relations); code confirmed.
- Happened: the page creates its agent on open (`Shell.tsx:3385-3396`). The sidebar then hides unused page agents inside "Page agents" (`Shell.tsx:4885-4906`) but only for kinds that `pageAgentKind` knows, and that list omits GTM (`apps/web/src/components/PageAgentIntro.tsx:9-16`). The result is an empty top-level chat that Maya did not create.
- Expected: same treatment as Inbox, Finance, Legal: not listed until it has a message or run, then under "Page agents".
- Fix: treat the GTM spawn key as a page agent in `pageAgentKind` (or make `isPageAgent` use the shared key check).

### FLOW-03 Four pages show four different answers to "how much have I raised?"
- Page: Finance, Legal, Investors, Fundraising (raise journey). P2, flow. Observed; cause suspected (the demo's Mercury SAFE list is empty now; iteration 14 had one Funded SAFE).
- Happened: Finance chart callout reads "Financing, Oct $250,000" (`p-Finance.png`); Legal lists "MOCK SAFE - Quill Capital $250,000" as a contract (`p-Legal.png`); Investors shows "Equity raised -" (`p-Investors.png`); Fundraising shows "No SAFEs yet" (`p-Fundraising.png`). Under the pass-13 and pass-12 decisions Equity raised counts only Funded Mercury SAFEs, so Investors and Fundraising are consistent with each other; the other two are not explained.
- Expected: when money arrived and a SAFE contract exists but no SAFE is on record, one line says so ("1 SAFE document, not recorded yet") instead of leaving Maya to reconcile four numbers.
- Fix: on Fundraising's empty SAFEs card, show "1 SAFE found in Legal" with a link when a Legal contract is a SAFE and Mercury has none.

### FLOW-04 Finance chart still has a stray "8" mark above "Oct*"
- Page: Finance. P3, visual. Observed with amounts shown (`p-Finance.png`, near x=1328, y=427). Carried from iteration 15 FLOW-05 (which saw it with Hide amounts on, so it is not caused by hiding).
- Fix: identify the marker (probably the current-month point with no data) and hide it until the month has a value.

### FLOW-05 GTM page: an empty "Written by GTM agent" card and an unpadded Channels table
- Page: GTM. P3, visual. Observed (`p-GTM.png`).
- Happened: below the Zernio card, a bordered box holds only the caption "Written by GTM agent" and nothing else; the Channels table header and rows sit flush against the card's left edge with no inset, and "Channels" is jammed against the top border.
- Fix: hide the empty box until the plan has text; give the Channels table the same cell padding as the Legal and Contacts tables.

### FLOW-06 Failed Data room file: Delete is the only action
- Page: Data room. P3, flow. Observed (`p-Dataroom.png`: "MOCK Signed NDA - Bolt Freight.pdf", Failed, only "Delete"). Carried from iteration 15 FLOW-02 (the sidebar part was decided and is fixed: the row now opens All items, the red badge is separate).
- Fix: add "Try again" (or "Replace file") beside Delete on a failed row.

### FLOW-07 Legal contract names truncate while the Renewal column has spare width
- Page: Legal, Contracts tab. P3, visual. Observed (`p-Legal.png`: "MOCK Insurance Policy - S...", "Shieldwell Insur...", about 90 px unused between Term and Renewal).
- Fix: give the Contract and Parties columns the spare width (or min-width) so names show in full.

## Fixed since iteration 15 / 14 (observed)
- Data room sidebar row opens All items; failed files only via the badge (`p-Dataroom.png`). Closes iteration 15 FLOW-02.
- Inbox To do items that are also rows now carry a "To do" mark on the row ("To do", "To do - Today") (`inbox3.png`). Closes iteration 14 FLOW-01.
- Email modal has Reply, Archive, Ask agent and "..." in one row (`mail.png`): opening a mail and acting on it is 1 click.
- Inbox's "Needs reply" group shows five rows then "Show 13 more"; other urgent mail shows its reason word ("Urgent", "Important").
- Cmd+K and Settings (Appearance, time zone, notifications only in General; consent one switch plus "Per model and documents"): no duplicate controls found.

## Journey scorecard (this pass)
| Journey | Actual / ideal | Verdict |
|---|---|---|
| Daily: inbox triage | Inbox 1 click, To do card + Needs reply visible, open a mail 1 click, act 1 click | minimal |
| Money: runway check | Finance 1 click, Runway "24.2 mo" in the second tile of the first row | minimal |
| Raise: data room, cap table | Each page 1 click; the money-raised answer needs four pages (FLOW-03) | good, one gap |
| First run | not re-measured (iteration 14: 8 actions) | n/a |
| Agents: create/skill/approval | not re-measured (creates data); Create menu is New bot / New group / New space (`create.png`) | unchanged |

## Not re-raised (decided)
Integrations in both the sidebar footer and account menu; Settings tabs (General, Privacy and approvals, Models, Advanced); five "Needs reply" rows with Show N more; Hide amounts masking "$•••" in subjects and the Chief preview.

## Praise (observed)
- Finance first screen: five tiles, "Mercury, Brex - synced just now", Burn chart, Upcoming 30 days with total.
- Integrations: Connected group with "Open Inbox/Finance" and "Used by" avatars.
- Contacts and Artifacts: one search, one filter, no extra chrome.
- Activity panel: "Needs your answer", Working, and "Show N finished runs" in one scan.
