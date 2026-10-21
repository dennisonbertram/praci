# UX walk, round 2: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (static, invented data, 37 views chosen by URL hash or the view menu). Plan: `docs/fundraising/README.md`. Browser session `ux-walker-fundraising-r2`, agent-browser, 1400 px desktop and 390 px phone. Dark mode for the cap-table and round journeys, light mode for the others. Date used in the mockup is Oct 20.
Screenshots: `docs/fundraising/ux-walker/round-2/<journey>/NN-<view>-d.png` (desktop) and `-p.png` (phone). Every screenshot named in a finding was opened and read. Geometry audit output for every state is in `round-2/geometry.txt`. Report only: no edits to the mockup or plan, no issues filed.

View ids (37): investors, inv-menu, inv-reading, inv-failed, inv-native, inv-stale, inv-audit, inv-sent, empty, editor, ed-tbd, ed-sending, ed-failed, ed-nogmail, fundraising, fund-roundmenu, fund-stage, fund-prospect, fund-safemenu, fund-close, safe-dialog, safe-terms, safe-mercury, safe-cover, fund-nomercury, fund-reconnect, fund-sync, fund-noround, fund-start, fund-closed, portal, portal-empty, portal-email, portal-open, link-dead, link-sent, portal-form. All 37 exist and render. Every view named in the brief exists.

Journeys walked (screenshot folders): `cap-table` (investors, inv-menu, inv-reading, inv-failed, inv-native, inv-stale, empty), `monthly-update` (investors, editor, ed-tbd, ed-sending, ed-failed, inv-sent, ed-nogmail), `portal` (portal-email, portal-open, portal, portal-empty, link-dead, link-sent, portal-form), `audit` (investors, inv-audit), `send-safe` (fundraising, safe-dialog, safe-terms, safe-mercury, safe-cover), `round` (fund-noround, fund-start, fund-prospect, fund-stage, fundraising, fund-roundmenu, fund-safemenu, fund-close, fund-closed, fund-nomercury, fund-reconnect, fund-sync).

Geometry audit summary: no horizontal page overflow on any state. Real defect found: on a phone the dialog scrim spills 46 px (N-01). Hits that are not defects: `legend`, `tabs`, `btns` (content-sized chips and buttons), `div.cols` (Updates and Contacts cards of different height, see N-22), and "wrapped" `button.src` and `button.ib "..."` (single line in every screenshot).

Numbers checked across views and found consistent: holdings 61.0 + 20.0 + 11.0 + 8.0 = 100.0 and 10,000,000 shares; Equity raised $1.0M = $700k + $300k; the three SAFEs are $250k, $200k, $50k = 5.0% at the $10M cap, "holdings 95.0%"; round bar Funded $450k = $250k + $200k, Signed $50k, Committed $50k = Ravi Mehta; Dana Whitfield's $100k Draft is in no total; Investors and Fundraising SAFE rows match; Oct update numbers (cash $1.13M / burn $89k = 12.7, shown as 13 months) and Sept update numbers (14 months, +22%) are internally consistent; portal dates match the Updates list. The one number conflict is N-09.

## Round 1 fix verification

37 items. 35 confirmed fixed in the mockup, 1 partly fixed (W-18), 1 skipped by design (W-37). Two caveats noted under W-09 and W-31.

| Id | Result | Evidence |
|---|---|---|
| W-01 | Confirmed | `cap-table/05-inv-native-d.png` (editable rows, blank "Add holder" row, Common default, Saved), `06-inv-stale-d.png` ("Reloaded: the table changed"). See N-06, N-07 for gaps inside these views. |
| W-02 | Confirmed | `02-inv-menu-d.png`, `03-inv-reading-d.png` ("Reading sheet..."), `04-inv-failed-d.png` ("Last read failed . Sheet as of Sep 30"). See N-08. |
| W-03 | Confirmed | `07-empty-d.png`: header with Ask, Investors row highlighted, no Add contact. |
| W-04 | Confirmed | Three equal unfilled buttons in the plan's order. |
| W-05 | Confirmed | Sums above; SAFEs sit in a separate group row. |
| W-06 | Confirmed | `01-investors-p.png`: SAFE rows show "Post-money SAFE . $250,000" under the holder. |
| W-07 | Confirmed | Segments are distinct in dark (`01-investors-d.png`) and light (`audit/02-inv-audit-d.png`) with gaps between them. |
| W-08 | Confirmed | Row menus are `button` with name "Row actions"; source line is a `button`; no unlabeled buttons. |
| W-09 | Confirmed with caveat | The menu button is drawn on narrow layouts, but clicking it does nothing in the mockup (sidebar stays hidden). Plan still defers the shell behavior to slice 1. Not a plan violation; see N-19. |
| W-10 | Confirmed | Whole-number percents. |
| W-11 | Confirmed | `monthly-update/02-editor-d.png`: ticked list, Marcus Webb greyed "no email". |
| W-12 | Confirmed | `ed-tbd` ("1 TBD left. Send anyway?", Back, Send anyway), `ed-sending` (Sent, Sending..., Waiting, disabled "Sending..."), `ed-failed` (Failed + Retry), `ed-nogmail` (Connect Gmail secondary, Share primary), `inv-sent`. Send label has no count. See N-15. |
| W-13 | Confirmed | Body shows `## ` headings. |
| W-14 | Confirmed | Editor is inside the shell, Send right-aligned. |
| W-15 | Confirmed | Oct text says "Third pilot converted to paid", consistent with Sept "two pilots". |
| W-16 | Confirmed | `portal/06-link-sent-p.png`, `07-portal-form-p.png`. See N-12. |
| W-17 | Confirmed | `portal/03-portal-d.png`: newest update in full, "Earlier updates" row expands. |
| W-18 | **Not fully fixed** | Portal Download button is 78 x 36 px on a 390 px viewport (measured). Plan requires portal controls at least 44 px on a phone. Open, Sign out, the Earlier-updates row and "Email me a link" are 44 px. Fix: make Download 44 px (see N-05). |
| W-19 | Confirmed | `portal/01-portal-email-p.png` exists. See N-03. |
| W-20 | Confirmed | `portal/04-portal-empty-p.png` ("Nothing shared yet."), filled "Email me a link". |
| W-21 | Confirmed | `audit/02-inv-audit-d.png`: New and Draft ready chips, "Open" and "Open draft", row menu (Mark done, Dismiss, Show done), "Sender not in Auditors", "Holdings as of today, not Dec 31". |
| W-22 | Confirmed | All Open controls are `button`, 36 px tall on phone and 28 px on desktop; widths 52 px, "Open draft" 86 px. |
| W-23 | Confirmed | Audit row "Holdings as of Sep 30" matches "Carta . as of Sep 30". |
| W-24 | Confirmed | Plan text states silent close. |
| W-25 | Confirmed | `send-safe/02` to `05` all exist and follow the plan (prefilled dialog, "Different terms", Mercury hand-off with Draft row, cover summary with YC link and Print). |
| W-26 | Confirmed | Dana's Draft has a muted amount and is in no total. |
| W-27 | Confirmed | Send SAFE is filled; Ask is outline. |
| W-28 | Confirmed | Draft rows show "Link to Mercury SAFE" with Mercury connected, not without. |
| W-29 | Confirmed | `round/05-fundraising-p.png`: menu inline, cap under the title, two-column legend. |
| W-30 | Confirmed | No sum in the SAFEs header; "awaiting deposit" only in Attention. |
| W-31 | Confirmed with caveat | All listed views exist and match the plan's labels. The caveat is N-02 (no-round and closed states hide the pipeline and SAFEs). |
| W-32 | Confirmed | "SAFEs, if converted at cap" is a link (`#fundraising`). |
| W-33 | Confirmed | "Equity raised", "Bridge SAFE round". N-18 notes the Start dialog default name brings the problem back. |
| W-34 | Confirmed | 14 px gap above Documents; card headings level. |
| W-35 | Confirmed with caveat | Earlier dates align. New conflict: N-09. |
| W-36 | Confirmed | View menu is in normal flow. |
| W-37 | Skipped by design | Stories not regenerated; not re-checked. |

## New findings

Totals: 0 blocker, 2 must-fix, 11 should-fix, 9 nice (22).

### Must-fix

- **N-01 must-fix. Phone dialogs are wider than the screen and hide the primary button.** Every dialog (`fund-start`, `fund-prospect`, `fund-close`, `safe-dialog`, `safe-terms`, `safe-cover`) is 420 px wide at left 16 px on a 390 px viewport, so the right 46 px is clipped: Start, Save, Close round and Print are cut off and amount fields are truncated. Measured: dialog rect 16 to 436, viewport 390; the geometry audit reports a 46 px scrim spill. Evidence: `round/03-fund-prospect-p.png`, `round/08-fund-close-p.png`, `send-safe/03-safe-terms-p.png`, `geometry.txt` (round 02, 03, 08 phone). Fix: `max-width: calc(100vw - 32px)` on the dialog; stack the buttons if needed.
- **N-02 must-fix. With no open round the page shows nothing but "Start a round", which hides the pipeline and SAFEs the plan still shows.** In `fund-noround` and `fund-closed` the 7 prospects and 4 SAFEs vanish, although Add prospect stays in the header and the plan's Pipeline and SAFEs sections do not depend on a round ("a SAFE needs no round"; slice 8: "empty page offers Start a round and Add prospect"). After Close round, Harbor Angels' signed, unpaid $50,000 SAFE (the exact thing the close confirm warns about) has no Attention row and no "Mark funded" menu anywhere on Fundraising. A prospect added in these states has nowhere to appear. Evidence: `round/09-fund-closed-d.png`, `round/01-fund-noround-d.png`. Fix: decide in the plan whether Pipeline and SAFEs stay visible without an open round (recommended: they stay, and Attention stays while a SAFE needs it); then draw the closed state with them, or say in the plan that a closed round hides them and where Mark funded lives.

### Should-fix

- **N-03 should-fix. The update email omits sections the portal shows for the same update.** The September email lists TL;DR, Numbers, Asks; the portal's September update also has Highlights and Lowlights. The plan says the email is the update body plus one link line. Evidence: `portal/01-portal-email-p.png` vs `portal/03-portal-p.png`. Fix: make the email show the same body (or shorten the portal body).
- **N-04 should-fix. Audit rows are not in due-date order.** Birch Audit LLP (due Nov 30) is listed above Northwind Ventures Fund II (due Nov 15). The plan orders due date first, then newest; the filled button (most urgent) correctly sits on Northwind, which makes the order look wrong. Evidence: `audit/02-inv-audit-d.png`. Fix: swap the rows.
- **N-05 should-fix. Portal Download is 36 px on a phone.** See W-18. Evidence: `portal/03-portal-p.png`, measured 78 x 36. Fix: 44 px.
- **N-06 should-fix. The typed-in table drops the SAFE rows.** In `inv-native` and `inv-stale` the group heading says "5.0% . holdings 95.0%" but no SAFE rows follow, on desktop and phone. The plan makes SAFE rows independent of the cap-table source (they come from Safe rows). Evidence: `cap-table/05-inv-native-d.png`, `05-inv-native-p.png`. Fix: show the three SAFE rows as in the other sources.
- **N-07 should-fix. The typed-in editor has no way to remove a holder.** Rows have no "..." menu in edit mode, while the plan puts a menu in every row, and the blank "Add holder" row is the only trailing control. Evidence: `cap-table/05-inv-native-d.png`. Fix: keep a Row actions button in each editable row (Delete holder).
- **N-08 should-fix. The source menu does not match the plan's rules and there is no menu for the typed-in source.** Carta menu always shows Refresh, Change source and Undo; the plan shows Undo only when a previous version exists, and Refresh applies only to Carta and sheet sources. No view shows the menu while the source is "Typed in", or the Undo state right after switching source. This is the "Undo" step of the type-the-cap-table-in journey. Evidence: `cap-table/02-inv-menu-d.png`, `05-inv-native-d.png`. Fix: add a typed-in menu view (Change source, Undo) and drop the inapplicable items.
- **N-09 should-fix. The closed-round line disagrees with the rest of the data.** "Closed Oct 25 . funded $500k" is dated after the mockup's today (Oct 20) and says $500k although the open round shows Funded $450k with $50k signed and unpaid (the close confirm names that SAFE). Evidence: `round/09-fund-closed-d.png` vs `round/05-fundraising-d.png`. Fix: "Closed Oct 20 . funded $450k" (or fund the Harbor SAFE first).
- **N-10 should-fix. Contacts do not change after the update is sent.** In `inv-sent`, Sam Lind and Priya Raman still show "Invited Oct 2" though each was just sent a link renewed on Oct 20 (plan: Send sets `portalLinkSentAt`; column shows "Invited <date>"). Evidence: `monthly-update/06-inv-sent-d.png`. Fix: show "Invited Oct 20" for contacts not yet opened.
- **N-11 should-fix. Phone action items are cramped.** The audit title wraps to four lines beside the chip and button, and "Holdings as of Sep 30 . due Nov 15" wraps to three. Evidence: `audit/02-inv-audit-p.png`, `cap-table/01-investors-p.png`. Fix: on a phone put the chip and button on their own line under the title.
- **N-12 should-fix. `/portal` shows a company name it cannot know.** `portal-form` and the sent state on `/portal` are drawn with "Example Robotics", but `/portal` has no token, and the plan says one email address can have links at several companies. The same applies to a dead link from an unknown token. Evidence: `portal/07-portal-form-p.png`. Fix: no company header on `/portal` and unknown-token pages; keep it only for expired or revoked links where the token identifies the contact.
- **N-16 should-fix. Several plan states have no view.** Reminder menu (Monthly, Quarterly, Off) behind the Updates "..."; the Contacts row menu (Resend link, Revoke, Unblock); the document Share dialog; "Show done" audit history; Mark sent/signed/funded with a date; Edit round. Revoke is how the founder reaches the `link-dead` page, and Share or Resend is how the portal email in the portal journey is issued, so that journey starts with no founder-side step. Fix: draw them or list them as deferred in the plan.

### Nice

- **N-13 nice. Extra copy on the link landing page.** "Investor updates and documents for Elena Ruiz." is not in the plan (company name and Open only). Evidence: `portal/02-portal-open-p.png`. Per the project copy rule, remove it or add it to the plan with a reason.
- **N-14 nice. Round bar, Attention row and SAFE row all carry the Harbor $50,000 Signed fact.** Plan accepts Attention plus the row; the legend adds a third. Evidence: `round/05-fundraising-d.png`.
- **N-15 nice. Failed-recipient state has no footer.** `ed-failed` shows the header chip "Sending" and Retry on the row but no footer text or disabled button, unlike `ed-sending`. Evidence: `monthly-update/05-ed-failed-d.png`.
- **N-17 nice. "Drafted Oct 18" does not fit the routine.** The plan's routine drafts on the 1st; an October update drafted Oct 18 (and a Sept update sent Oct 2) conflicts. Evidence: `cap-table/01-investors-d.png`.
- **N-18 nice. Start a round defaults to "Seed SAFE round"** while the cap table already holds Seed Preferred (the W-33 confusion). Evidence: `round/02-fund-start-d.png`. Fix: "Bridge SAFE round" or a blank name.
- **N-19 nice. Almost every button is inert.** Only the view menu and the two "SAFEs, if converted at cap" links navigate; "Type it in", "Open", "Send SAFE", the narrow-layout Menu button and others do nothing, so a journey can be walked only through the view menu. Fix: wire the primary journey buttons with `data-go` if the mockup is to be walked by clicking.
- **N-20 nice. "Sync failed" has no reason or open menu view.** Plan: header line with Refresh; a count of unreadable rows may appear. Evidence: `round/12-fund-sync-d.png`.
- **N-21 nice. SAFE row order in the hand-off view.** The new Ravi Mehta Draft is listed first while other rows are ordered Funded, Funded, Signed, Draft. Evidence: `send-safe/04-safe-mercury-d.png`.
- **N-22 nice. Small layout details.** The source-line chevron renders as a small dot ("Carta . as of Sep 30 .") so it does not read as a menu; the Updates card is much shorter than Contacts, leaving an empty block to its left bottom (`cap-table/01-investors-d.png`); the Birch audit request (New) has no filed document in Documents although intake files it.

## Plan versus mockup checks

- Labels match the plan in every drawn view: Open draft, Open, Send, Send anyway, Back, Share, Connect Gmail, Retry, Different terms, Link to Mercury SAFE, Start a round, Close this round?, Closed ... funded, "1 TBD left. Send anyway?", "This link no longer works.", "Use the email address where you got the link", "If this address has access, a link is on its way. Check spam.", "Nothing shared yet.", "Reloaded: the table changed", "Reading sheet...", "Last read failed".
- Visible but not called for by the plan: N-13 (landing sentence). Nothing else found.
- Dark mode (cap-table and round journeys) renders correctly on every state; contrast is adequate, including the amber "Last read failed" and "Sync failed" lines and the Draft chips.
- Stories under `docs/fundraising/ux-paths/topics/` were not used, as instructed.

## Round 2 resolution

22 new findings plus W-18: 19 fixed, 3 skipped, 1 partly fixed. Mockup now has 45 views.

| Id | Result | How or why |
|----|--------|-----------|
| N-01 | fixed | Dialogs are `min(420px,100%)` and at most the viewport minus 32 px; scrim column is `minmax(0,1fr)`; checked at 390. |
| N-02 | fixed | Pipeline, SAFEs and Attention show with no round and after Close; Reopen in the round menu; Add prospect and Send SAFE work with no round. |
| N-03 | fixed | Email shows the same body as the portal. |
| N-04 | fixed | Northwind (Nov 15) above Birch (Nov 30). |
| N-05, W-18 | fixed | Download is 44 px on a phone. |
| N-06 | fixed | SAFE rows shown under the typed-in editor. |
| N-07 | fixed | Row menu with Delete holder in every holder row. |
| N-08 | fixed | Menus per source; new views `inv-native-menu` (after a switch). |
| N-09 | fixed | "Closed Oct 20 · funded $450k". |
| N-10 | fixed | Sam and Priya read "Invited Oct 20" after the send; plan says the date moves on every send. |
| N-11 | fixed | Action rows stack on a phone: text, then chip, button and menu. |
| N-12 | fixed | No company on `/portal` or dead links; the landing page gets it from a preview call. |
| N-13 | fixed | Landing sentence removed. |
| N-14 | skipped | The plan accepts Attention plus the row; the legend is the bar's key. |
| N-15 | fixed | Partly sent chip, "3 of 4 sent" and Done. |
| N-16 | fixed | Drawn: Reminder, contact menus, Share, Show done, mark date dialog, Edit round. |
| N-17 | fixed | "Drafted Oct 1". |
| N-18 | fixed | Start dialog has a placeholder name, no default. |
| N-19 | skipped | The mock is walked through the view menu; wiring every button adds no plan information. |
| N-20 | fixed | `fund-sync` opens its menu (Refresh, Reconnect). |
| N-21 | fixed | SAFEs ordered by status, then date. |
| N-22 | partly fixed | Chevron now a CSS caret; the shorter Updates card and the unfiled Birch document are left as they are. |
| W-09 caveat | skipped | Narrow-layout menu behavior stays a slice 1 task. |
