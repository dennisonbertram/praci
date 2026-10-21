# Walk W5: Cap table, Contacts, Legal, Finance

Target: mock-data demo stack (web :5381), 1440x900 unless noted. Signed in as the seeded mock founder. Screenshots are kept outside the repo and are not linked here.
Carta is already connected and read in the demo, so stories that start from "Carta off" or from an empty Contacts page could not be started as written.

## Story verdicts

| Story | Verdict | Steps actual/ideal | Note |
|---|---|---|---|
| STORY-LEG-020 | PASS | 1/1 | Legal row, /app/legal, Contracts / Deadlines / Graph tabs all present. Page reads well. |
| STORY-LEG-029 | SKIPPED | - | Needs deleting a Data room file (mutates shared demo data). |
| STORY-CAP-101 | BLOCKED | - | Needs Carta off and no snapshot; the demo has Carta connected. The "Add investor" dialog was exercised from the connected page instead. |
| STORY-CAP-102 | FAIL | 2/3 | Donut and hover work. Clicking a legend row does nothing, so the drill-down never opens (W5-02). |
| STORY-CAP-103 | PASS (partial) | 4/4 | Investors tab (`?kind=investor`), search (`q=`), Sort menu (`sort=`, `dir=`), "No matches" + "Clear filters" all work. "Save as contact" / "Add email" not reachable: every investor already matches a contact. |
| STORY-CAP-104 | PASS | 3/3 | Asked the Carta agent to save an investor; reply arrived and the new row appeared in the table without a reload. Test contact removed afterwards. |
| STORY-CAP-105 | SKIPPED | - | Needs editing seeded contacts' emails (mutates shared demo data). |
| STORY-CAP-106 | BLOCKED | - | Needs real Carta sign-in. Phone-width part of the read-then-donut result was seen (W5-03). |
| STORY-CAP-107 | BLOCKED | - | Needs a second signed-in user. |
| STORY-CAP-009 | PASS (partial) | 3/3 | Not empty, so the "No contacts yet" state was not seen. Add contact, fill, Save works; Kind shows "Other" on Contacts, which resolves the story's UNVERIFIED note (W5-07). |
| STORY-CAP-011 | PASS | 4/4 | On the Cap table dialog: "Another contact already has this email." plus "Open Priya Placeholder" button; the button opens Edit contact. |
| STORY-CAP-012 | PASS (partial) | 2/3 | Kind menu lists 8 kinds; the Contacts search input was not exercised (the Cap table search was). |
| STORY-CAP-013 | PASS (as documented) | 3/3 | Delete is immediate, no confirmation, no Undo, no notice (W5-06). |
| STORY-CAP-014 | PASS | 1/1 | Four figures, donut and holder rows all appear and add up (10,000,000 FD, 600,000 pool, 40/30/15/9/6 percent). |
| STORY-CAP-015, 016 | SKIPPED | - | Agent Q&A on SAFEs and contact matching; CAP-104 covers the agent contact tool. |
| STORY-CAP-029, 031 | SKIPPED | - | Need a holder with no contact / a failing save. |
| STORY-CAP-030 | PASS (partial) | 1/1 | Investors tab shows only the 3 investor rows. Options still have a tab ("Options") in this build. |
| STORY-CAP-010, 017 | SKIPPED | - | Superseded by the CAP-013 / CAP-103 walks above. |
| Finance (no story carried a 2026-10-20 note) | WALKED (one screen) | - | Dashboard loads with all cards, burn chart, Breakdown, Upcoming. Only the slow first load was a finding (W5-04). |

Phone width (390x844) was checked once for Cap table and Contacts: no horizontal scroll, header buttons fit, Contacts keeps Name and Kind only, Cap table holder rows stack name, kind, organization, email.

## Praise

- Legal: stat tiles, "Overdue by 5 days" in red, Done / Dismiss on every deadline row, and the Graph tab are clear and fit the page without clutter. Notes under derived deadlines explain where they came from.
- Duplicate email handling is the best moment in the area: a plain error plus a one-click "Open <name>".
- Filters, search and sort all live in the URL, so a view can be bookmarked.
- After the agent saved a contact, the table updated itself. No reload needed.
- Donut hover swaps the centre label to the slice name and shares.

## Findings

| ID | Sev | Cat | Page / story | Observed (O) or suspected (S) | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| W5-01 | P1 | visual | Every page, on full load (seen on Chief, Contacts, Cap table, Finance) | O: after the app loads, the sidebar is scrolled so the PAGES list (Inbox, Finance, Legal, Cap table, Contacts) is hidden above the fold; on /app/contacts even the active row "Contacts" is not visible, and Maya has to scroll the sidebar to find her pages. During loading the sidebar shows Pages fine, then the chat list arrives and it jumps. | /tmp/uxloop1/W5/00-home.png, 20-contacts.png | `apps/web/src/pages/Shell.tsx:1742` (scrollIntoView of the space header, runs on first load, not only on space switch). S: this is the cause. | Run the scroll only after an actual space switch, or scroll the sidebar to top when the route is a Pages row. |
| W5-02 | P1 | bug | STORY-CAP-102 | O: clicking "Common (Mock)" or "Option pool (Mock)" in the donut legend does nothing; the rows are focusable but not buttons (no "Show X breakdown" name). S: breakdown matches `holder.security === slice.name`; the demo's class names ("Common (Mock)") differ from holder securities ("Common"), and the Options slice is not recognised either. | /tmp/uxloop1/W5/12-donut-drill.png, 12b-hover.png | `apps/web/src/components/cap-table/OwnershipDonut.tsx:97-114` | Match holders to a class by share-class id (or normalised name), and make the demo data consistent. |
| W5-03 | P1 | flow | Cap table on first load (phone width seen) | O: for about 20 seconds the page showed the "Carta off" layout (investor contact list only, no Connect card, no skeleton) before the summary and donut appeared; a founder could think Carta data is missing. Desktop showed it within about 3 seconds in the same session, so load on the shared stack may contribute. | /tmp/uxloop1/W5/50-cap-mobile.png then 52-cap-mobile-later.png | S: `CapTable.tsx` renders the no-snapshot layout while the Carta connection check is pending. | Show a skeleton for the summary area until the connection check and snapshot load finish. |
| W5-04 | P2 | perf | Finance first load | O: skeleton for about 13 seconds on a cold load (polled once per second). Possibly the dev server and parallel walkers; cause not isolated. | /tmp/uxloop1/W5/40-finance.png | unknown | Measure on a production build; if still slow, find the slow RPC. |
| W5-05 | P2 | flow | STORY-CAP-103 / 030 | O: the summary cards and donut (about 520 px) stay above the tabs on every tab, so after picking Investors or searching, the table starts at y=690 of 900 and only 3 rows are visible at 1440x900 with the agent panel open. | /tmp/uxloop1/W5/13-investors.png | `CapTable.tsx:688-700` | Collapse or shrink the donut when a tab, search or security filter is active, or keep the filter bar sticky. |
| W5-06 | P2 | flow | STORY-CAP-009 / 013 (Contacts) | O: adding a contact gives no confirmation or row highlight; deleting is instant with no confirmation, no Undo and no notice. The Cap table shows "Saved X" with highlight and "Deleted X" with Undo for the same records. | /tmp/uxloop1/W5/23b.png, 24b.png | `Contacts` page passes `onDeleted={load}` only (per catalog) | Reuse the Cap table's saved / deleted notice with Undo on Contacts. |
| W5-07 | P3 | flow | STORY-CAP-009 | O: Add contact defaults Kind to "Other" on Contacts but "Investor" on the Cap table. Maya's likely first contact is an investor. | /tmp/uxloop1/W5/21-contacts-add.png vs 16-add-dialog.png | Contacts page prefill `kind: "other"` | Default to Investor, or do not pass a kind from Contacts. |
| W5-08 | P2 | visual | Cap table header at 1440 with agent panel open | O: company name truncates to "Northwind …" and "· Updated 25m ago" wraps to two lines, because of the five header controls. | /tmp/uxloop1/W5/10-cap.png | `CapTable.tsx` header | Move "Updated ..." under the title or into the refresh tooltip; keep the full company name. |
| W5-09 | P3 | copy | Legal header | O: "Allow access below first." sits right-aligned under the buttons, while the same fact is already stated in the caption ("Daily scans wait until you allow access.") and in the amber card. Three statements of one thing. | /tmp/uxloop1/W5/02-legal.png | `Legal.tsx:136-141` | Drop the line under the buttons; keep the card and the tooltip on the disabled Scan now. |
| W5-10 | P3 | a11y | Cap table sort | O: the direction button is named by its current state ("Ascending" / "Descending"), so a screen reader hears a state, not an action. | snapshot of Cap table | `CapTable.tsx` sort toggle | Name it "Sort ascending" / "Sort descending" as the action, or add aria-pressed. |
| W5-11 | P3 | visual | Donut card | O: with two slices the card keeps about 100 px of empty space under the legend. | /tmp/uxloop1/W5/10-cap.png | OwnershipDonut fixed legend height | Size the card to the legend rows. |
| W5-12 | P3 | flow | Ownership column | O: SAFE investors show "—" in Shares and Ownership and are missing from the donut, so Maya cannot see what the SAFEs would convert to. Known by design (catalog). | /tmp/uxloop1/W5/11-cap-table.png | n/a | Optional: show the SAFE amount in the Ownership column ("$250,000 SAFE"). |
| W5-13 | P3 | visual | Cap table Email column with panel open | O: long email truncates ("maya.test@fischer-capital.exampl…"). | /tmp/uxloop1/W5/31-after-agent.png | table column widths | Let the Email column take width from the Kind column or wrap. |
| W5-14 | P3 | copy | Demo data only | O: Chief's seeded replies say "$412,000 cash, $46,000 burn, 8.9 months", while Finance shows $1,633,221, $67,621 and 24.2 months. Matters only for the demo's credibility. | /tmp/uxloop1/W5/00-home.png vs 41-finance2.png | `apps/web/src/demo/fixture.json` | Align the seeded chat replies with the fixture numbers. |

Not seen: no console errors on Cap table, Contacts, Legal or Finance (only Vite debug lines). Geometry audit: no page overflow; the only "uneven row" hits were sidebar chat rows (intentional) and the phone header buttons (intentional).
