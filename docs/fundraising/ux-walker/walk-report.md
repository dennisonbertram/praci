# UX walk report: Investors and Fundraising mockup

Target: `docs/fundraising/mockup.html` (static, invented data), walked in agent-browser session `ux-walker-fundraising` on 2026-10-20.
Viewports: 1400 px desktop and 390 px phone. Dark mode (the system default in this browser) for most screens, light mode for two (`FR-051`).
Views were switched with the radio inputs and `#ed-open`. Plan: `docs/fundraising/README.md` (revised). Stories: `docs/fundraising/ux-paths/`.
Method: screenshot per step, each opened and inspected, `geometry-audit.js` at each distinct state. Report only: no edits to the mockup or plan, no issues filed.
Screenshot paths below are relative to `docs/fundraising/ux-walker/stories/<ID>/screenshots/`.

## Totals

37 findings: 2 blocker, 8 must-fix, 21 should-fix, 6 nice.

Geometry audit: no page overflow, no overflow spills, no wrapped controls on any state. It flagged `div.legend`, `div.tabs`, `div.r` (Reminder and New update) and `div.btns` as uneven widths. These are content-sized chips and buttons, so they are not defects. One real measured defect (Documents card gap, W-34) was found by hand because the script does not look at card-to-card spacing.

Not individually inspected, because they duplicate an inspected state: `FR-004/00`, `01`, `04`, `FR-010/03`, `FR-022/04`, `FR-051/03`.

Mockup limits: the mockup has 6 views plus the editor. Many journey steps end at an inert button. Those are logged as missing states, not as bugs in what is drawn.

## Journey FR-004 / 104: type the cap table in

Steps walked (4 of 9 possible): Empty view, click "Type it in" (nothing happens, `05-after-click-type-it-in.png`), then the finished Carta-sourced Investors page as a stand-in for the result (`03-investors-tall-dark.png`), then phone (`06`, `07`).
Plan path: Empty, "Type it in", table is editable in place (autosave on blur, one blank row, security defaults to Common, pool is one row); the source line shows the native source (its label is not specified in the plan). Steps needed: about 3 to the first saved row. Not measurable because the editor does not exist in the mockup.
Stale story steps (follow the plan): "Edit here" is now "Type it in"; a Save button is gone (autosave); security list in the story includes Pool and SAFE, the plan has Common, Preferred, Option, Other plus one fixed pool row and no SAFE; "Edit here toggles back into the editor" is gone (always editable); "Refresh hidden" becomes the source menu; "saving replaces the whole snapshot" is replaced by the stale-save reload rule.

- **W-01 blocker.** The typed-in table state does not exist. "Type it in" does nothing, and there is no editor, blank row, security default, pool row, autosave or "Reloaded: the table changed" notice to review. This is the page the no-Carta founder lives on. Evidence: `05-after-click-type-it-in.png`. Fix: add a `source: native` view (rows editable in place, trailing blank row, "Type it in" source line) and a stale-save state.
- **W-02 must-fix.** The source line "Carta · as of Sep 30 ▾" has no open menu and no states for Refresh, Change source, Undo, "Reading sheet…" or "Last read failed". The plan makes this the only source control. Evidence: `02-investors-carta-desktop.png`. Fix: add the open menu and the sheet states, or one extra view.
- **W-03 should-fix.** The Empty view has no Ask button (the plan says Ask also opens the agent in the empty view) and no Add contact. The Investors sidebar row is not highlighted there. Evidence: `01-empty-desktop.png`. Fix: show the header with Ask and highlight the row.
- **W-04 should-fix.** Empty view hierarchy: "Connect Carta" is the one filled button, but the persona for this journey has no Carta. Nothing says what each option does, and with minimal copy that may be right, but the primary should match the likely first choice or all three should be equal. Evidence: `01-empty-desktop.png`, `06-empty-mobile.png`. Fix: decide the primary deliberately and note it in the plan.
- **W-05 must-fix.** Numbers do not add up in the cap table. The "Fully diluted" column shows 33.5 + 28.7 + 14.6 + 6.3 + 10.5 + 6.4 = 100.0 for equity rows, then three SAFE rows add 3.1 + 2.5 + 0.6 = 6.2 more, so the column totals 106.2. The ownership bar and the 9,562,000 headline exclude SAFEs and nothing labels that. Evidence: `03-investors-tall-dark.png`. Fix: label SAFE percents as a separate "if converted at cap" group (subtotal row or sub-header), or keep them out of a column titled Fully diluted.
- **W-06 should-fix.** On a phone the Invested column is hidden, so the three SAFE rows show only "—" for shares and a percent: the dollar amount, their one real figure, disappears. "Post-money SAFE" and holder names wrap to 2 to 3 lines. Evidence: `07-investors-mobile.png`. Fix: on phones show the amount under the holder name, or put the amount in place of the "—".
- **W-07 should-fix.** The "Options granted" bar segment and legend swatch are nearly invisible. Measured: dark mode segment `rgb(42,42,42)` on a `rgb(31,31,31)` track; light mode `#e6e6e6` on `#f2f2f2`. Evidence: `03-investors-tall-dark.png`, `FR-051/02-investors-light.png`. Fix: give `.c2` a visibly distinct tone in both themes.
- **W-08 should-fix.** Row menus ("…") are plain table cells with no button role or focus, and the source line is a span with `role="button"` and no tabindex. Every row action in the plan lives behind them, so keyboard and screen-reader users cannot reach them. Evidence: snapshot (26 `.menu` cells, none focusable). Fix: real buttons with accessible names.
- **W-09 should-fix.** Below 900 px the sidebar is hidden with no replacement, so on narrow web there is no way to go from Investors to Fundraising or back. The plan says mobile has no screens, but this layout is what a narrow browser or phone shows. Evidence: `07-investors-mobile.png`. Fix: decide whether narrow web gets a menu or a redirect message; note it in the plan.
- **W-10 nice.** 28.76 is shown as 28.7 (plan: rounding is adjusted so the bar sums to 100). It is correct by the plan but looks like a rounding error to a reader checking by hand. Fix: none needed, or a test fixture note.

## Journey FR-010 / 201: review and send the monthly update

Steps walked: Investors page, Action items "October update" (Open), editor desktop and phone. Plan path: notification dot, Open on the action item, check or edit, Send (maybe one TBD prompt), return to Investors with the row sent. About 4 steps. Mockup supports 2 (Open, read). Editor Open works only through the `#ed-open` toggle.
Stale story steps: "Review" button is now "Open"; "Bcc to all 4 with a link footer" is now one email per recipient, each with that contact's own link; "no guard on TBD" is now the "1 TBD left. Send anyway?" prompt; the portal link in the footer for a recipient without access is now handled by share rows created on Send.

- **W-11 must-fix.** The To line is plain text. The plan says all recipients are ticked, can be unticked, and contacts without an email are greyed. There are no checkboxes, so the audience control the plan describes is missing. Evidence: `FR-010/01-editor-desktop.png`. Fix: render the recipients as ticked chips or rows, one greyed example.
- **W-12 must-fix.** Send handling differs from the plan. The button reads "Send · 1 TBD", while the plan has "Send" plus a one-time prompt "1 TBD left. Send anyway?" and a highlighted "TBD" in the body (a plain textarea cannot highlight). Missing states: the prompt, sending, a failed recipient with Retry, sent and return to Investors, and the no-Gmail variant (Share as the primary, Connect Gmail secondary). Evidence: `01-editor-desktop.png`. Fix: add those views or state frames.
- **W-13 should-fix.** The editor shows raw text headings (TL;DR, Numbers) in a textarea while the portal renders the same update with bold section headings. The plan stores markdown, so what the founder edits and what investors see differ with no preview. Evidence: `01-editor-desktop.png` vs `FR-022/05-home-desktop.png`. Fix: show how headings are written or add a preview.
- **W-14 nice.** Editor layout: Send sits next to "Saved" at the left edge of a 760 px column, the Draft tag is detached at the far right, and the editor covers the sidebar (the plan route is inside the app shell). Evidence: `01-editor-desktop.png`, `02-editor-mobile.png`. Fix: right-align Send with the field column.
- **W-15 nice.** Content contradicts itself: the October TL;DR says "First paid deployment outside pilots" while the September update says two pilots already converted to paid. Fix: edit the invented text.

## Journey FR-022 / 304: investor opens the link on a phone

Steps walked: Link view (landing with Open), Portal home, Dead link, on phone and desktop. Plan path: tap link, Open, read, tap Download. 4 taps; the story's ideal was 3 and assumed the old single-use token. The extra Open tap is the plan's accepted protection against link scanners, so it is not friction to remove.
Stale story steps: "single-use 15 minute link", "token exchanged on tap and redirect", "August update expands in place" and "mail scanner burns the token" are all superseded by the reusable 90-day link with a POST-only Open button.

- **W-16 must-fix.** Dead-link page has no result state. The plan always answers "If this address has access, a link is on its way. Check spam." (and throttles one send per 10 minutes). The mockup shows only the form. The `/portal` variant with "Use the email address where you got the link" is also missing. Evidence: `FR-022/03-dead-phone.png`, `06-dead-desktop.png`. Fix: add the submitted state and the `/portal` form.
- **W-17 should-fix.** Portal home shows the August update collapsed behind "Open ›". The plan says shared updates show newest first with full body. "Open ›" is plain text, not a button. Evidence: `02-home-phone.png`, `05-home-desktop.png`. Fix: show all bodies (or change the plan to collapse older ones) and make the control a button if kept.
- **W-18 should-fix.** Phone tap targets are small: Download and Open are 25 px tall, and "Sign out" and "Open ›" are bare small text. Evidence: `02-home-phone.png`; measured height 25 px. Fix: at least 44 px on phone.
- **W-19 should-fix.** Step 1 (the email itself) cannot be walked: the mockup has no email. The plan fixes only the subject ("<Company>: <Subject>"). The investor's first decision is made in that email. Fix: add a small email frame or state the body text in the plan.
- **W-20 should-fix.** Missing portal states: nothing shared yet, document download in progress or failed, expired cookie. On the dead-link page "Email me a link" is the only action but is styled as a secondary button. Evidence: `03-dead-phone.png`. Fix: add the empty state and make the dead-link button primary.

## Journey FR-028 / 401: audit request as an action item

Steps walked: Investors Action items on desktop and phone. Plan path: notification, open Investors, Open on the audit row (Gmail draft opens in a new tab), compare, send in Gmail, row closes by itself on the next sync. 3 steps by the founder. Mockup supports only the first.
Stale story steps: "Monday Audit season routine" is now intake on mail arrival; "Open draft" label is "Open"; "Mark done" after sending is now automatic close (Mark done stays in the row menu); "Auditors tab" contact creation is not in the plan.

- **W-21 must-fix.** The audit row lacks what the plan puts on it: no row menu (Mark done, Dismiss, Show done), no New state, no "Holdings as of today, not <date>" warning, no "Sender not in Auditors" flag. "Open" does not say it goes to a Gmail draft in a new tab, and the neighbouring "Open" on the update opens the in-app editor. Evidence: `FR-028/01-action-items-desktop.png`. Fix: add the menu and the two warnings; say where Open goes (for example "Open draft").
- **W-22 should-fix.** The two Open controls differ. One is a `<button>`, the other a `<label>`. On a phone the audit one is 246 px wide and centered, the update one is 276 px and left-aligned, and the chips "Draft ready" and "Draft" end at different x positions. Evidence: `02-action-items-phone.png`. Fix: one shared button component.
- **W-23 should-fix.** Dates do not fit together: "Holdings as of Dec 31 · due Mar 15" next to a Documents row "Audit request ... Jan 2026" and an update "Drafted Nov 1", with the cap table "as of Sep 30". The Carta data is as of Sep 30, so by the plan this row should carry the as-of warning but does not. Evidence: `FR-004/03-investors-tall-dark.png`. Fix: align the dates and show the warning.
- **W-24 nice.** The sidebar dot counts 1 unseen notification while 2 action items exist, and the page gives no feedback when a reply sent from Gmail closes the row. The dot rule is in the plan; the closing feedback is not. Fix: say so in the plan.

## Journey FR-039 / 503: Send SAFE from a committed prospect

Steps walked: Fundraising desktop, phone, light mode. Plan path: click Send SAFE on the Committed row, then either Mercury opens and a Draft row appears (Mercury connected) or a prefilled dialog, Save, cover summary. About 3 steps. The mockup is in the Mercury-connected state and the click does nothing, so 0 steps are walkable.
Stale story steps: "Create SAFE" is now "Send SAFE"; "New SAFE header button" does not exist; a separate Committed total of signed SAFEs is now resolved (Committed is prospects without a SAFE, matching the legend).

- **W-25 blocker.** "Send SAFE" leads nowhere. Missing: the Mercury hand-off and the Draft row it creates, the native dialog with "Different terms", Save, and the cover summary. The no-Mercury path (the story's persona) cannot be seen at all. Evidence: `FR-039/01-fundraising-desktop.png`. Fix: add the dialog, the cover summary and a no-Mercury header state.
- **W-26 must-fix.** Dana Whitfield's $100,000 Draft SAFE appears nowhere in the round. The SAFE rows total $600,000 but the bar and legend total $550,000 (Funded 450 + Signed 50 + Committed 50), and Dana has left the pipeline. A reader cannot reconcile the page. Evidence: `01-fundraising-desktop.png`. Fix: show a Draft amount in the legend or a short note, or state the rule on the row.
- **W-27 should-fix.** "Send SAFE" does not send: the native flow produces a cover summary and the founder sends it, and the Mercury flow opens Mercury. The button is a small secondary control while Ask is the loudest button on the page. Evidence: `01-fundraising-desktop.png`. Fix: a label that matches the outcome ("Create SAFE" was the old name; choose one) and give the row action more weight than Ask.
- **W-28 should-fix.** The Draft row says "Oct 18 · not in Mercury" with no next action (open Mercury, Link to Mercury SAFE). Evidence: `01-fundraising-desktop.png`. Fix: show the next action in the row or its menu.
- **W-29 should-fix.** Phone layout: the "…" menu wraps onto its own line under every prospect row, the round title wraps with "· MFN" alone on a line, and "Target $1M" sits alone under the legend. Evidence: `02-fundraising-phone.png`. Fix: keep the menu in the first row and shorten or stack the round header.
- **W-30 should-fix.** The same facts repeat: Harbor Angels $50,000 signed and awaiting deposit appears in the Attention strip, the SAFE row and the Signed legend entry, and "Funded $450k · Signed $50k" appears in both the round legend and the SAFEs card header. Evidence: `01-fundraising-desktop.png`. Fix: drop the SAFEs card header sum.

## Journey FR-051 / 604: a round end to end across both pages

Steps walked: Fundraising, Investors (light and dark), editor, portal. Plan path (about 20 steps over weeks): Start a round, add prospects, move stages, Send SAFE, Mercury sync, Attention, funded, Investors rows, update, portal links, Close round. The mockup shows one snapshot of the middle of this story, so the beginning and end cannot be walked.
Stale story steps (several): Action items on Investors for a signed SAFE (plan: SAFE items live on Fundraising); KPI "incl. $500k in SAFEs" (plan: Raised excludes SAFE money); manual change of kind to investor (plan: flips automatically on Signed); Bcc with a footer link and a "Send link" per contact (plan: one message each, link added by Send or Resend); Mercury server removal deleting SAFE rows (plan: rows stay, source becomes native); audit-season routine and Mark done (plan: intake on arrival, auto close). The story should be rewritten against the plan.

- **W-31 must-fix.** Round lifecycle states missing: Start a round (the empty Fundraising page), Add prospect with its Stage field, the stage-move menu, Close round with its confirm (Harbor is signed and unpaid, so the confirm applies in this exact data), the closed-round line, the expanded Passed group, Mark sent/signed/funded, Link to Mercury SAFE, and the Mercury Connect, Reconnect and Sync failed header states. Evidence: `FR-051/01-fundraising-light.png`. Fix: add the views, or say which are deferred to build.
- **W-32 should-fix.** The pages do not link to each other. "SAFEs on Fundraising" and the three SAFE rows on Investors are plain text, and Fundraising's Attention strip has no link back. Moving between them is the sidebar only. Evidence: `FR-051/02-investors-light.png`. Fix: make that line and the SAFE rows links to Fundraising.
- **W-33 should-fix.** Labels: Investors "Raised $1.0M · equity" and Fundraising "Target $1M, Funded $450k" are different measures with similar words, and a "Pre-seed SAFE round" is open while the cap table already holds Seed Preferred with a Feb 2026 Seed SPA. Evidence: `FR-051/02-investors-light.png`. Fix: label it "Equity raised" and rename the round in the invented data.
- **W-34 should-fix.** Spacing: the Documents card touches the Updates/Contacts row (measured gap 0 px; gap between other cards is 12 px), and the two side-by-side card headings differ by 4 px (Updates top 797, Contacts top 793). Evidence: `FR-051/03-investors-dark-gapcheck.png`. Fix: add the bottom margin to `.cols`; align the card headings.
- **W-35 nice.** Dates conflict across screens: an update "Drafted Nov 1" and an audit item next to "Oakline meeting Oct 24" and "Mercury · 5 min ago"; the August update reports "4 sent" while Priya Raman (who joined later) shows no portal status. Fix: align the invented dates.
- **W-36 nice.** The floating view switcher covers the last rows on a phone and at the bottom of short pages. Mock chrome only. Evidence: `FR-004/07-investors-mobile.png`. Fix: move it or make it collapsible.
- **W-37 should-fix.** Stale stories. Besides the per-journey lists above, `ux-paths/catalog.md` and the topic files still use ids and terms the plan replaced (Create SAFE, single-use link, Bcc, Mark done as a required step, audit-season routine, "Edit here"). Fix: regenerate the 6 affected stories (104, 201, 304, 401, 503, 604) from the plan before the next walk.

## Systemic notes

- One Open button style is needed (W-22) and one real menu button (W-08); both repeat across all pages.
- Dark mode works on every state walked; the one defect is the low-contrast bar segment (W-07), which also fails in light mode.
- The portal looks consistent on desktop and phone with no geometry defects.
- Recommended next run: after the mockup gains the native editor, Send SAFE dialog and cover summary, re-walk FR-004, FR-039 and FR-051.

## Round 1 resolution

Mockup views are named by the id in the view menu of `mockup.html` (also the URL hash). Screenshots: `ux-flow/screens/mock-<view>.png` and `-phone.png`.

| Id | Result | Note |
|---|---|---|
| W-01 | fixed | `inv-native`, `inv-stale`; plan: Cap table sources, slice 3 |
| W-02 | fixed | `inv-menu`, `inv-reading`, `inv-failed` |
| W-03 | fixed | `empty` has the header with Ask; sidebar row highlighted |
| W-04 | fixed | Decision: the three options are equal, none filled (plan, Investors page) |
| W-05 | fixed | Holdings sum to 100.0; SAFEs in a separate at-cap group with "holdings 95.0%" (plan, Cap table sources) |
| W-06 | fixed | Phone rows show amount under the holder |
| W-07 | fixed | Bar segment uses `--ink2`, segments separated by a gap |
| W-08 | fixed | Row menus and the source line are real buttons with names |
| W-09 | fixed | Menu button drawn on narrow layouts; plan says to confirm the shell behavior in slice 1 |
| W-10 | fixed | Invented shares now give whole-number percents |
| W-11 | fixed | Recipients are a ticked list; Marcus Webb greyed, "no email" |
| W-12 | fixed | `editor`, `ed-tbd`, `ed-sending`, `ed-failed`, `ed-nogmail`, `inv-sent` |
| W-13 | fixed | Body shows markdown with `## ` headings; plan states it |
| W-14 | fixed | Editor is a page in the shell; Send right-aligned |
| W-15 | fixed | Invented text edited |
| W-16 | fixed | `link-sent`, `portal-form` |
| W-17 | fixed | Newest update in full, earlier ones expand in place; plan changed |
| W-18 | fixed | Rows and buttons 36 px on phone, Open/Email/Sign out 44 px |
| W-19 | fixed | `portal-email`; body text stated in the plan |
| W-20 | fixed | `portal-empty`, filled dead-link button; download progress left to the browser; expired cookie goes to the dead-link page (plan) |
| W-21 | fixed | `inv-audit`: row menu, New, both warnings, "Open draft" |
| W-22 | fixed | All Open controls are the same button |
| W-23 | fixed | Dates aligned; audit row as-of matches the table |
| W-24 | fixed | Plan: the row closes silently on the next sync |
| W-25 | fixed | `safe-dialog`, `safe-terms`, `safe-mercury`, `safe-cover`, `fund-nomercury` |
| W-26 | fixed | Drafts are in no total; stated in the plan; muted amount on the row |
| W-27 | fixed | Label stays "Send SAFE" (decision in the plan); the row button is filled, Ask is outline |
| W-28 | fixed | Draft row offers "Link to Mercury SAFE" |
| W-29 | fixed | Menu inline, round cap under the title, two-column legend |
| W-30 | fixed | No sum in the SAFEs header; "awaiting deposit" only in Attention |
| W-31 | fixed | `fund-noround`, `fund-start`, `fund-stage` (Passed open), `fund-prospect`, `fund-roundmenu`, `fund-close`, `fund-closed`, `fund-safemenu`, `fund-reconnect`, `fund-sync` |
| W-32 | fixed | The at-cap group heading on Investors links to Fundraising; a link back from Fundraising skipped (sidebar is enough) |
| W-33 | fixed | "Equity raised"; round renamed "Bridge SAFE round" |
| W-34 | fixed | `.cols` bottom margin; card headings share a height |
| W-35 | fixed | Invented dates aligned |
| W-36 | fixed | View menu is in normal flow at the top |
| W-37 | skipped | The six stories (104, 201, 304, 401, 503, 604) need regenerating from the plan in a separate pass; they are walker inputs, not part of this fix |

Totals: 36 fixed, 1 skipped.
