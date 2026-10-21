# UX Flow Critique, Round 5: Investors and Fundraising (planned) — 2026-10-20

Evidence: `docs/fundraising/README.md` (Update editor lines 424 to 490, Round bar lines 510 to 520, SAFEs and Send SAFE
lines 543 to 566, Safe model lines 190 to 195), the 55 views in `docs/fundraising/mockup.html` (`VIEWS`, line 675),
and light-mode screenshots in `docs/fundraising/ux-flow/screens/` (opened: `mock-ed-nogmail`, `mock-ed-unknown`,
`mock-ed-unticked`, `mock-inv-posted`, `mock-safe-mercury`, `mock-safe-link`). Nothing is built or run.

## Round-4 verification

- R4-1 confirmed. `mock-ed-nogmail` has no To list: Subject, Body, "Saved", Connect Gmail (secondary) and one
  filled "Post to portal". `mock-ed-unticked` shows the To list with Sam unticked and the single line "Unticked
  investors still see this on the portal." The line appears only in that view.
- R4-2 confirmed. `mock-inv-posted` shows the toast "Posted · 4 notified" and a Posted row at the top of Updates.
  The count matches Contacts: Elena, Tom, Sam and Priya have an email and access; Marcus has no email and Nate is
  revoked. The Portal column reads "Invited Oct 20" for Sam and Priya.
- No round-4 item is unfixed.

## Friction scorecard with verdicts

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | 3 + 1 row per holder / same | 0 | 0 | 0 | minimal |
| Monthly update, review and send (Gmail) | 5 / 4 | 0 | 0 | 0 | acceptable (near minimal) |
| Monthly update, no Gmail (Post to portal) | 4 / 4 | 0 | 0 | 0 | acceptable (see R5-3) |
| Investor opens portal on phone | 2 taps / 1 | 0 | 0 | 0 | acceptable (decision 5 security cost) |
| Audit request | 3 to 4 / 3 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect | Mercury: 1 click, then Mercury, then Link only if no email; native 3 / 3 | 0 | 0 | 1 (R5-1, Link with no candidate) | acceptable |
| Six-week round end to end | 2 clicks per stage move | 0 | 0 | 0 | acceptable |

Checks you asked for:

- Editor without Gmail: simpler than with Gmail. No audience choice remains, one button, no count or explainer. The
  only gap is that the button emails people and nothing before the click says so (R5-3).
- Mercury hand-off with a muted unlinked Mercury row beside the Draft: confusing as drawn (R5-1). In
  `mock-safe-mercury` D. Whitfield (Sent, $100,000) and Dana Whitfield (Draft, $100,000) both read "Link to Mercury
  SAFE" in the sub-line and both amounts use the same muted style, so the pair cannot be told apart except by the chip.
  Pending ($150k) correctly omits the Mercury row, but a founder looking at a Sent $100k row that is not in Pending
  has no way to know it is the held-out duplicate.
- Unknown delivery state: the Retry then "May already be delivered. Send again?" sequence in `mock-ed-unknown` is the
  right guard (it protects against a duplicate email, which is irreversible). The state's place in the update's
  lifecycle is undefined (R5-2).
- Surface from round 4's new views (`ed-unticked`, `inv-posted`, `ed-unknown`, `safe-link`, `fund-nomercury` and the
  Posted row): each is a state, toast, dialog or line of a control a journey already uses. `mock-inv-posted` has the
  same six sections as before. No persistent element was added; no view is unneeded.

## New issues

Counts: 0 blocker, 0 must-fix, 3 should-fix, 1 nice.

### Should-fix

- **R5-1. "Link to Mercury SAFE" on both rows of an unlinked pair, and a Draft with nothing to link.**
  README line 545 puts the link on the Draft and on the unlinked Mercury row; line 551 says the menu item is only for
  "a row with no Mercury link", which the Mercury row does not meet; and the dialog (line 551, `mock-safe-link`) is
  defined only from the Draft ("Link to Mercury SAFE · Dana Whitfield", a list of Mercury rows to pick). Clicking
  the link on the Mercury row has no defined dialog: it would list Mercury rows to link a Mercury row to. Second
  gap: `mock-safe-mercury` shows Ravi's Draft with the link immediately after hand-off, when no Mercury row exists yet
  (the dialog list would be empty), so the first thing the founder sees after Send SAFE is an action that cannot
  succeed. Fix without new copy: keep the link only on the Draft row, and only while an unmerged Mercury row exists;
  the Mercury row gets no link (it shows its chip and the muted amount). Until a candidate exists the Draft shows
  no link and the sync is the next step.
- **R5-2. An Unknown recipient has no defined place in the update's status.** Lines 480 to 484 say Partly sent
  appears "when every recipient has resolved with a failure among them", and Unknown is a recipient attempted with no
  recorded result. Whether that counts as resolved is not stated. `mock-ed-unknown` draws the header chip as
  "Partly sent". If Unknown is not resolved, the update stays Sending forever (the Sending row has a disabled menu,
  no Delete and no Retry on its Updates row, line 415), and the only Retry is inside the editor. State that an
  Unknown recipient ends the job as resolved, so the update reads Partly sent, has Retry on its Updates row, and the
  Sent mail check is the founder's decision. The footer confirm should name nobody extra but the plan should say
  Retry on the Updates row opens the same "May already be delivered" question.
- **R5-3. Post to portal emails every investor with an address, and nothing before the click says so.** Without Gmail
  the To list is hidden (R4-1 fix), so the editor in `mock-ed-nogmail` shows no recipients. The label "Post to
  portal" reads as a silent publish; the notice emails go out through `TransactionalEmailProvider` and the count
  ("4 notified") appears only in the toast after the fact (`mock-inv-posted`). With Gmail the founder sees who gets
  mail; without it the founder loses that preview, cannot exclude anyone, and has no way to take the emails back
  (Delete removes only the portal copy). Fix with data rather than explanation: in the existing footer slot
  left of the button, replace "Saved" while saved with "Notifies 4 investors" (the same count the toast later
  reports), or show it only when the count is above zero. With no provider the line is absent, since the copy-link
  dialog opens instead.

### Nice

- **R5-4. The unticked hint sits flush under the last row.** In `mock-ed-unticked` "Unticked investors still see this
  on the portal." follows the greyed "Nate Cho revoked" row with no gap and reads as a note about Nate. A few pixels
  of top margin, or placing it above the list, removes the misreading.

## Already minimal

- Type the cap table in, audit request: no removable step or element.
- Update model: one list of updates, one portal view of them, Post to portal in the Send slot, Posted row and toast
  now drawn.
- Portal on a phone, Pending/Committed vocabulary and round-bar arithmetic (Funded $450k + Signed $50k + Pending
  $150k = $650k against $1M), one filled button per view, one status word per row: unchanged and consistent.
- Investors and Fundraising page structure: no duplicated surface, no new persistent element since round 4.

## Round 5 resolution

| Id | Resolution | Where |
|----|------------|-------|
| R5-1 | Fixed. Hand-off Drafts count in Pending; unlinked Mercury rows auto-merge by investor email and are held out only while any Draft awaits Mercury. Link to Mercury SAFE only on an awaiting Draft while an unlinked Mercury row exists; the Mercury row has no link; a fresh Draft shows none. | README Glossary, Data model, Round, SAFEs, Send SAFE, Mercury SAFEs, slice 10 tests; `safe-mercury`, `fundraising` |
| R5-2 | Fixed. Unknown counts as resolved; Failed or Unknown makes Partly sent; Retry on the Updates row asks the resend question for Unknown recipients only. | README Update editor, Updates, slice 6 tests |
| R5-3 | Fixed. Footer reads "Notifies 4 investors" without Gmail, same n as the toast; only investor contacts with email and portal access (not revoked) are notified. | README Update editor, Glossary; `ed-nogmail` |
| R5-4 | Fixed. 8px gap above the unticked hint. | `ed-unticked` |
