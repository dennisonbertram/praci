# UX Flow Critique, Round 2: Investors and Fundraising (planned) — 2026-10-20

Evidence: the revised plan (`docs/fundraising/README.md`), `docs/fundraising/mockup.html` (36 views; the
list is `VIEWS` near the end of the file), screenshots in `docs/fundraising/ux-flow/screens/`, and round 1
(`report.md`, `redundancy.md`). Nothing is built or run. "Mock" means a screenshot or the mockup source.

## Verdicts

| Journey | Planned / ideal steps | Verdict |
|---------|-----------------------|---------|
| Type the cap table in | 3 + 1 input row per holder / same | minimal |
| Monthly update, review and send | 5 / 4 | acceptable (near minimal) |
| Investor opens portal on phone | 2 taps / 1 | acceptable (the extra tap is the security cost of decision 5) |
| Audit request | 3 to 4 / 3 | minimal |
| Send SAFE from a committed prospect | Mercury: 1 click, then Mercury; native: 3 (click, Save, Print/Close), then 3 manual status marks / 3 | acceptable |
| Six-week round end to end | no dead ends; 2 clicks per stage move | acceptable |

Round 1 had 0 minimal, 4 acceptable, 2 convoluted. Round 2 has 2 minimal, 4 acceptable, 0 convoluted.

New issues: **0 blocker, 2 must-fix, 5 should-fix, 14 nice.**

## 1. Round-1 proposals

| # | Proposal | Status | Evidence |
|---|----------|--------|----------|
| 1 | One SAFE vocabulary, one place to enter | Applied fully | Glossary: "Committed" is only the stage. No SAFE in the native security list (Data model). Header "New SAFE" is gone from the mock; Send SAFE appears only on a Committed row; a prospect with a SAFE leaves the pipeline. Mock numbers add up: shares 10.0M, percentages sum to 100.0, SAFE group 2.5+2.0+0.5 = 5.0%, Equity raised $1.0M = $700k+$300k, round bar $450k + $50k. |
| 2 | Portal access model | Applied fully | Decisions 5 and 6: reusable link, Open landing page (`mock-portal-open`), one message per recipient, `portalBlockedAt`, dead link with the email field inline (`mock-link-dead`), access only through sharing, Resend/Revoke only for contacts with a share. |
| 3 | Source as a line, not chips | Applied fully | Header is "Carta · as of Sep 30" with a menu (Refresh, Change source, Undo) in `mock-inv-menu`; one writer per source; one version back; autosave; "Type it in" in `mock-empty`. |
| 4 | Audit intake on arrival | Applied fully (different hook) | Plan "Audits": `enqueueAuditIntake` runs from the mail sync beside the attachment filing, not inside it. Rows close on a sent reply; Mark done and Dismiss are in the row menu (`mock-inv-audit`); one notification. |
| 5 | Smaller editor, one way in | Applied fully | `mock-editor`: Subject, To, Body, one primary Send; "Share" replaces it only without Gmail (`mock-ed-nogmail-phone`); "1 TBD left. Send anyway?" (`mock-ed-tbd`); autosave; a routine draft shows only in Action items. Board entry is "Message the board"; one Reminder menu. |
| 6 | Investors agent reads Fundraising | Applied fully | `fundraising_read` in the agent tool list; Ask opens the same agent on both pages. The Carta agent is still listed in Bots (see N14). |
| 7 | Mockup fixes | Applied fully | No stage chip on pipeline rows, no "Create SAFE" on SAFE rows, no editor footnote, no "SAFEs shown unconverted", row action verb is "Open". |

## 2. New issues from the revision

### Must-fix

- **N1. The round bar drops money while a SAFE is Draft or Sent.** Plan, Round: Funded and Signed come from SAFEs with those statuses, Committed counts only prospects with no SAFE, and "Draft SAFEs are in none". Sent is not mentioned in the bar at all, yet Sent is in the Investors at-cap group. So Ravi's $50,000 is in the bar as Committed, then vanishes when "Send SAFE" creates the Draft (compare `mock-fundraising` with `mock-safe-mercury`: the hatched segment disappears and nothing replaces it). The same happens for every SAFE between sending and signature, which is most of weeks 2 to 5. Fix: put Sent in the Signed segment's neighbour (a "Sent" tone) or count Draft and Sent in Committed until signed.
- **N2. A reviewed but unsent routine draft has no stated home.** Plan, Investors section 1: the routine's draft is in Action items "until it is opened (`reviewedAt`)". Section 3: Updates lists "Sent and Shared rows plus drafts the founder created". A routine draft that the founder opened, then left (back arrow) leaves Action items and, by this wording, may not be in Updates. That is the normal interrupted-review path. Fix: Updates lists every draft; Action items lists only unopened ones.

### Should-fix

- **N3. "Open" on the Attention row has no stated target.** `mock-fundraising`: "Harbor Angels · $50,000, Signed Oct 12 · awaiting deposit · Find in Finance" with a filled "Open". The plan says "each with Open" but not what opens (cover summary? Mercury?). The useful next action is the Finance link beside it. Make the filled button the useful action, or drop the button and keep the link.
- **N4. A prospect leaves the pipeline on any SAFE, with no way back.** Plan, Pipeline: "once the prospect has a SAFE the row leaves the pipeline". With Mercury, Send SAFE creates the Draft row before anything happens in Mercury; if the founder closes the tab, the prospect is gone and a Draft is left. Canceled, Expired and Deleted SAFEs have no stated return. Fix: the row returns when no non-canceled SAFE remains.
- **N5. The holder row "…" menu has no defined items.** Plan (Investors section 2): "the menu is in every row, disabled where nothing applies". For Carta and sheet sources the table is read-only, and the mock shows faint disabled "…" on the Options and Pool rows (`mock-investors`). Define the items (for example Add as contact) or remove the control.
- **N6. Controls the journeys need are not in the mock.** The mock source has no Reminder, Message the board, Revoke, Resend, Unblock or Duplicate (grep count 0). Reminder lives behind an unlabeled "…" beside New update (`mock-investors`), whose only item is Reminder. Add the views.
- **N7. The editor shows raw markdown to the founder.** `mock-editor`: "## TL;DR", "## Numbers", "- Second gripper batch…". The plan chose this deliberately, but it is the only place the founder edits prose, and the portal renders it differently. Render headings and bullets, or at least hide the `## `.

### Nice

- N8. Sent rows say "Sent" in a chip and "4 sent" in the sub-line (`mock-investors`, Updates). The draft Action item says "Draft" in a chip and "Drafted Oct 18" under the title. Drop one of each.
- N9. "Sending" appears in three places while sending: the title chip, the button, and each recipient (`mock-editor` source, lines for `ed-sending`); "Waiting" and "Sending…" are two words for in-flight. Use one.
- N10. Portal copy: "Investor updates and documents for Elena Ruiz." on the landing page (`mock-portal-open-phone`) repeats what the page is; the Open button needs only the company name. "Use the email address where you got the link." (`mock-portal-form`) is explained by the label "Email address".
- N11. `/portal` (`mock-portal-form`) and the dead link (`mock-link-dead`) are the same form on two routes. Keep one.
- N12. "Reconnect Mercury" and "Sync failed" are two labels for a broken connection (`mockup.html` lines 410 and 411). One label with Reconnect in its menu is enough.
- N13. The SAFE group row reads "5.0% · holdings 95.0%"; the 95.0% is the complement of the first figure.
- N14. The Carta agent is still beside the Investors agent in every sidebar mock, although the plan reduces it to a connector that tells the user to ask the Investors agent. Hide it when it has no recent history.
- N15. "Send SAFE" opens a dialog whose button is "Save", then a cover summary with Print and Close; nothing is sent (decision 3). After Print there is no "Mark sent"; the founder goes to the row menu for it. Either name the first button "Create SAFE" for the native path, or add Mark sent to the cover summary.
- N16. The plan says the one filled Fundraising button is Send SAFE; the mock shows two (Attention "Open" and Send SAFE, `mock-fundraising`).
- N17. The audit row shows "Holdings as of today, not Dec 31" while it is still New (`mock-inv-audit`); the plan computes that at draft time.
- N18. "Show done" is a list-wide action inside one audit row's menu.
- N19. The typed-in source menu lists Refresh and Undo (`mock-inv-menu` is the Carta one); the plan does not say what a typed-in source offers. Show only Change source (and Undo when a previous version exists).
- N20. Sample row "Q3 board update" (`mock-investors`) breaks the glossary rule "never 'board update' in the UI". Use "Q3 update" with the Board audience in the sub-line.
- N21. "Reloaded: the table changed" (`mock-inv-stale`) covers a two-tab edge case; a silent reload would remove the string and the view.

## 3. Surface check

The mockup now has 36 views (the fix pass reportedly added about 30). Every one maps to a plan state or an error path that exists; none adds a control to a journey. The ones with the least journey value: `inv-stale`, `fund-reconnect`/`fund-sync`, `link-sent` plus `portal-form` (N11, N12, N21). Menus added: source (3 items), audit row (3), round (2), SAFE row (6), stage (7), Updates "…" (1 item), contact row (3), holder row (undefined). Only the last two are weak (N5, N6).

## 4. Already minimal

- The Investors and Fundraising split, section order, and one Ask opening one agent.
- Typed-in cap table: autosave, defaults for security and company name, one blank row.
- Audit path once the notification arrives: open draft, review, send in Gmail, row closes itself.
- The editor's one primary button and the Close round confirm that appears only for a signed, unpaid SAFE.
- The portal home: newest update in full, earlier updates collapsed, documents, Sign out.
- Fundraising Attention block, which now holds the only "awaiting deposit" statement.
- Mock numbers: every figure on both pages reconciles.

## Round 2 resolution

All 21 items were fixed in `README.md` and `mockup.html` (45 views; screenshots in `screens/`). None skipped.

| Id | Result | How |
|----|--------|-----|
| N1 | fixed | Round bar: Committed also holds Draft and Sent SAFEs of the round at their amount; same rule on both pages; totals add up (Funded $450k + Signed $50k + Committed $150k). |
| N2 | fixed | Updates lists every draft; Action items lists only unopened routine drafts. |
| N3 | fixed | Attention button is Mark funded (Mark signed for sent-unsigned) beside the Finance link; no "Open". |
| N4 | fixed | The prospect row returns to the pipeline when no non-canceled SAFE remains. |
| N5 | fixed | Holder menu defined (Add as contact, Delete holder); the control is removed from Options and pool rows. |
| N6 | fixed | Drawn: Reminder menu, Contact row menus (Resend, Revoke, Unblock, Edit, Delete), Share dialog with Unshare. Not drawn: Duplicate and Delete on an Updates row. |
| N7 | fixed | Editor shows headings and bullets rendered; stored as markdown. |
| N8 | fixed | One status word per row; the duplicate "4 sent" and "Drafted" text removed. |
| N9 | fixed | Draft, Sending, Sent, Partly sent; recipients Sent, Sending, Failed. |
| N10 | fixed | Landing page has the company name and Open only; the form has only its label. |
| N11 | fixed | `/portal` and the dead link are one page; the `portal-form` view is removed. |
| N12 | fixed | One "Sync failed" label; Reconnect is in its menu; `fund-reconnect` view removed. |
| N13 | fixed | Group row reads "5.0%". |
| N14 | fixed | Carta agent leaves the sidebar mock; the plan lists it only while it has recent history. |
| N15 | fixed | Dialog button is "Send SAFE"; the cover summary has Mark sent. |
| N16 | fixed | At most one filled button per Fundraising view. |
| N17 | fixed | The as-of warning shows only once a draft exists. |
| N18 | fixed | Show done is a header button of the block. |
| N19 | fixed | Typed-in menu: Change source, plus Undo after a switch; Refresh only for Carta and sheet. |
| N20 | fixed | "Q3 update", Board in the sub-line. |
| N21 | fixed | "Reloaded" message and view removed; a refused save shows "Not saved" with Retry. |
