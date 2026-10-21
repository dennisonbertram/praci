# UX Flow Critique, Round 4: Investors and Fundraising (planned) — 2026-10-20

Evidence: `docs/fundraising/README.md` (Glossary lines 80 to 100, Data model line 199 to 209, Investors
sections 3 and 4, Update editor lines 424 to 462, Portal lines 542 to 560, Tenancy line 595), the 50 views in
`docs/fundraising/mockup.html` (`VIEWS`), and light-mode screenshots in `docs/fundraising/ux-flow/screens/`
(opened: `mock-fundraising`, `mock-investors`, `mock-inv-updmenu`, `mock-ed-nogmail`, `mock-portal`,
`mock-portal-phone`, `mock-portal-empty`, `mock-inv-sent`, `mock-inv-copylink`, `mock-inv-addcontact`).
Nothing is built or run.

## Round-3 verification

- R3-1 confirmed. `mockup.html` line 485 now reads "Funded $450k, Signed $50k, Pending $150k, Target $1M";
  `mock-fundraising` shows the pipeline stage "Committed 1" (Ravi, $50,000) and the legend "Pending
  $150k" (Ravi $50k plus Dana's Draft $100k). The word no longer carries two sums. README Glossary line 89,
  line 342, line 481 and slice 9 (line 990) use the same definition. Pending is a legend aggregate with no
  row labelled "Pending"; the SAFEs card says "Draft", which is the correct row-level word, so the
  founder can reconcile $150k without new copy.
- R3-2 confirmed. The `fund-safemenu` markup (line 529) holds Open, Mark sent, Link to Mercury SAFE, Cancel
  SAFE, Delete: only the next valid Mark verb for a Draft row.
- No round-3 item is unfixed.

## Friction scorecard with verdicts

| Journey | Steps (planned / ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|-------------------------|--------------------|----------|-----------|---------|
| Type the cap table in | 3 + 1 row per holder / same | 0 | 0 | 0 | minimal |
| Monthly update, review and send (Gmail) | 5 / 4 | 0 | 0 | 0 | acceptable (near minimal) |
| Monthly update, no Gmail (Post to portal) | 5 plus a link copy per contact / 4 | 1 (the To ticks, see R4-1) | 0 | 1 (nothing after Post, see R4-2) | acceptable |
| Investor opens portal on phone | 2 taps / 1 | 0 | 0 | 0 | acceptable (the extra tap is the decision 5 security cost) |
| Audit request | 3 to 4 / 3 | 0 | 0 | 0 | minimal |
| Send SAFE from a committed prospect | Mercury 1 click then Mercury; native 3 / 3 | 0 | 0 | 0 | minimal |
| Six-week round end to end | 2 clicks per stage move, no dead ends | 0 | 0 | 0 | acceptable |

Update model check (portal shows every investor update; Post to portal; Duplicate and Delete):

- Simpler than round 3. Updates are no longer shared per contact, so there is no per-update audience step
  and no "who can see this" screen. `mock-portal` shows the newest update in full and one "Earlier updates"
  row; `mock-portal-phone` is one column with no extra chrome. The portal has nothing a journey does not use.
- Post to portal replaces Send in the same footer slot (`mock-ed-nogmail`): one filled button, Connect Gmail
  as the secondary action. No new button, no new page. Good.
- Duplicate and Delete are drawn (`mock-inv-updmenu`, a two-item menu on a Sent row) and are behind the row
  "…". Delete is the one confirmation and it guards a destructive action (removes the portal copy). Fine.
  The Pending/Committed vocabulary is consistent between legend, glossary and chips (see verification above).
- Surface check on the views added since round 3 (50 views against 45): `inv-updmenu`, `inv-copylink`,
  `inv-addcontact`, `inv-sent`, `inv-partly` and similar are each a menu, dialog, toast or row state of a
  control a journey already uses. `mock-investors` and `mock-fundraising` have the same sections as round 3
  (Action items, stats, Cap table, Updates, Contacts, Documents; Attention, round bar, Pipeline, SAFEs). The
  five new views add no persistent element to a page. No surface was added beyond what the journeys need.

## New issues

Counts: 0 blocker, 0 must-fix, 1 should-fix, 1 nice.

### Should-fix

- **R4-1. The "To" list in the update editor implies audience control the portal does not have.**
  `mock-ed-nogmail` shows six contacts with ticks above a "Post to portal" button, but README line 440 says
  Post to portal emails nobody, and line 97 and line 595 say every sent or posted investors update is
  visible to every investor contact with portal access, whether or not they were ticked. So the ticks do
  nothing in the no-Gmail case, and with Gmail they only decide who gets an email: a founder who unticks an
  investor to keep a Lowlights section from them still exposes it on that investor's portal (Elena and Tom
  are "Opened" in `mock-investors`, so they read it). Nothing in the editor says so. Fix without new
  chrome: in the no-Gmail editor hide the To list (nothing is emailed, so it is a decision with no effect);
  with Gmail keep it, and show one line under the list only when a contact with portal access is unticked
  ("<name> can still read it on their portal"), so the copy appears only when it matters. Alternative:
  rename the label from "To" to "Email" so the ticks read as delivery only.

### Nice

- **R4-2. Post to portal has no ending.** After Send the plan defines a toast "Sent to <n>" (line 402, drawn
  in `mock-inv-sent`). After Post to portal no toast is defined and no view shows a Posted row in Updates
  (the word "Posted" appears in the README but not once in `mockup.html`), although the Glossary makes it a
  fifth status. A no-Gmail founder also still has to reach each investor: the only route is Resend link
  with its copy-link dialog (`mock-inv-copylink`), one contact at a time, and a contact with no email (Marcus
  Webb in `mock-investors`) has no link route at all (Resend is offered only with an email, line 406). Define
  the toast (for example "Posted") and draw one Posted row; the per-contact copy stays acceptable for a
  secondary path.

## Already minimal

- Update model: one list of updates, one portal view of them, no per-contact sharing step; Duplicate and
  Delete in a two-item row menu; Post to portal in the Send slot.
- Pending and Committed: legend, glossary and chips now agree; the bar total does not move when Send SAFE
  creates a Draft (`mock-fundraising` against `mock-safe-mercury`, unchanged since round 3).
- Type the cap table in, audit request, Send SAFE from a committed prospect: no removable step or element.
- Portal on a phone: `mock-portal-phone` is one column, a 44 px Download button, no cap table, contacts or
  agent; the empty state is one sentence (`mock-portal-empty`).
- Investors and Fundraising page structure and IA: the two pages and the portal each answer one question;
  no duplicated surface found; one filled button per view; one status word per row.
- Mock numbers still add up: Funded $450k + Signed $50k + Pending $150k = $650k against a $1M target.

## Round 4 resolution

| Id | Status | Change |
|----|--------|--------|
| R4-1 | fixed | The To list is hidden without Gmail. With Gmail, one line under the list ("Unticked investors still see this on the portal.") shows only when an unticked investor has portal access (`ed-unticked`). README "Update editor". |
| R4-2 | fixed | Post to portal sends each investor contact with an email a portal notice with a fresh link through `TransactionalEmailProvider`; with no provider it opens the copy-link dialog. Toast "Posted · 4 notified" and a Posted row in Updates (`inv-posted`). A contact with no email gets a link only through Copy link in the contact menu. |
