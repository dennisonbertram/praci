# UX paths, round 3

Round 3 compares the stories in `docs/fundraising/ux-paths/topics/` with the plan (`docs/fundraising/README.md`) and the mockup (`docs/fundraising/mockup.html`, 45 views) as they stand after round 2. It edits only files under `docs/fundraising/ux-paths/`. The authoritative gap list is the section "Plan gaps (round 3)" in `docs/fundraising/ux-paths/catalog.md`.

## Result

Open gaps now: 0 blocker, 0 must-fix, 11 should-fix, 21 nice (32 in all). Of the 59 gaps open after round 2, 42 are resolved or accepted and 17 are still open. Round 3 adds 13 new gaps: 8 should-fix and 5 nice. The loop's stop rule (no must-fix and no new should-fix) is not met, because of the 8 new should-fix gaps.

## New should-fix gaps

- NG-28: the plan calls a sent update read-only (Updates section) and also editable and re-sendable (Update editor section). A Share without Gmail is labelled Sent although nobody was emailed.
- NG-29: a send interrupted by a restart leaves the update at Sending with a disabled button and no Failed recipient.
- NG-30: with Gmail connected there is no control to share a board update to the portal, and the plan disagrees on whether Send creates board shares.
- NG-31: a contact added after the last update has no share, so Resend link is absent and she cannot see earlier updates.
- NG-32: the portal cookie is a signed contact id, not a token. An email change deletes tokens but the old holder's cookie lasts up to 30 days, and a cookie from before a Revoke works again after Unblock.
- NG-33: the Mercury hand-off merges by investor email and amount, but Add prospect leaves the email optional and the check size can be unknown.
- NG-34: after a failed switch from Typed in to a sheet, the line either says Sheet over the typed-in table or hides the failure.
- NG-35: Retry after a refused stale save may send the whole table and silently revert the other tab's change.

New nice gaps: NG-36 (no notice for a new document to a contact with a live link), NG-37 (Carta share classes versus the four typed-in securities), NG-38 (leaving with "Not saved"), NG-39 (a done audit row reopens on a courtesy reply), NG-40 (10-minute link limit counts from any send).

## Round-2 fixes confirmed in the plan text

Checked against the plan text and the mockup views, not against running code. All round-2 "fixed" claims hold, with these qualifications: PG-32, PG-42 and PG-47 are fixed but each exposes a new gap (NG-28, NG-30, NG-32); NG-04 is fixed but its failure wording is open (NG-34); NG-05 and NG-06 are fixed but Retry needs a definition (NG-35). PG-26 and PG-45 stay skipped and the skip reasons hold.

## Stories changed (56)

Topic files keep their own ids. Reasons are the plan or mockup change that made the old steps wrong.

| Topic file | Stories changed | Main reasons |
|---|---|---|
| `topics/cap-table-sources.md` | 102, 103, 104, 105, 106, 108, 109, 110, 111, 112, 113 | `#inv-stale` removed: stale save is now "Not saved" with Retry (`#inv-notsaved`); failed autosave has a state; Delete holder and Add as contact in the row menu; source changes only after the first successful read; Carta states in the same line; late reads discarded after Undo; `#inv-nosnap`; Equity raised is the Invested sum; Draft SAFEs count in the round bar |
| `topics/updates-and-board.md` | 201, 202, 203, 204, 206, 207, 208, 210, 211, 212, 213 | Status words Draft, Sending, Sent, Partly sent (no Shared); `#inv-partly` and Retry on the Updates row; "Keep editing" button; revoked contacts greyed and not emailed; routine skips a space with no emailable investor; Reminder menu drawn (`#inv-reminder`); board draft sources |
| `topics/investor-portal.md` | 301, 302, 303, 304, 305, 306, 307, 308, 309, 310 | Token in the URL fragment (`/portal/open#<token>`), a new token per send or Resend; `#portal-form` removed and the dead-link page names no company; Share dialog with Unshare (`#inv-share`); contact menus (`#inv-contactmenu`, `#inv-unblock`); Unblock does not restore old links; no revoke confirm |
| `topics/audit-requests.md` | 401, 402, 403, 404, 405, 410, 411 | Intake match rule and 10-a-day cap; Open on a New row opens the thread; text-only drafts; no thread or no Gmail cases; Show done is a header button listing done and dismissed rows (`#inv-auditdone`); any sent reply closes a row |
| `topics/fundraising-safes.md` | 501, 503, 504, 506, 507, 508, 511, 512, 513, 514, 515, 516 | `#fund-reconnect` removed (Sync failed menu has Refresh and Reconnect); closed round keeps Pipeline, SAFEs and Reopen; Draft SAFEs count in the round bar as Committed; Cancel SAFE; Edit round dialog (`#fund-editround`) and Mark dialog (`#fund-mark`); abandoned hand-off returns the prospect; manual date wins; Committed $150k in the mockup data |
| `topics/first-run-and-cross-page.md` | 601, 604, 609, 610, 611 | Add prospect with no round works; closed round view; contact Edit and Delete with cascades; one kind per contact; `contacts_add` never changes the kind |

Unchanged (24): 101, 107, 205, 209, 311, 406 to 409, 412, 502, 505, 509, 510, 517, 602, 603, 605 to 608, 612 to 614. In the gap-tag footer of every topic file the resolved ids were removed and the new ids added.

## Stories that still have a view the mockup does not draw

Add contact dialog (609), Link to Mercury SAFE picker (516), Updates row menu with Duplicate and Delete (207, 211), copy-link dialog without an email provider (309), the Undo control after a Mark (504), the Mark sent date prompt (504). These are mockup gaps, not plan gaps.

## Round 3 resolution

| Id | Status | Change |
|----|--------|--------|
| NG-28 | fixed | A sent, partly sent or posted update is read-only (Duplicate, Delete). Without Gmail the action is "Post to portal" and the status "Posted". Statuses: Draft, Sending, Sent, Partly sent, Posted. |
| NG-29 | fixed | Send is a background job with per-recipient idempotency keys; a send left in sending is resumed by the job retry; an attempt with no recorded result is marked Failed, never resent; Retry covers failed recipients only. |
| NG-30 | fixed | Board updates never appear on the portal; every sent or posted investors update is visible to every investor contact with portal access. `InvestorShare.updateId` and the update Share control are removed. |
| NG-31 | fixed | Resend link works on any investor contact with an email, and a contact added later sees earlier updates. |
| NG-32 | fixed | New `PortalSession` table (hashed random token, 30 days); the cookie holds the session token. Revoke, block and an email change delete tokens and sessions; Unblock restores nothing. Tests added to slice 6. |
| NG-33 | fixed | Mercury auto-merge only when the native SAFE has an email and the amount matches; otherwise Link to Mercury SAFE. New view `safe-link`. |
| NG-34 | fixed | A failed read keeps the previous source label (warning color); the menu shows "Last read failed · Try again". |
| NG-35 | fixed | Saves are per row with a `rev`; a conflicting row reloads and shows "Changed elsewhere". New view `inv-changed`. |
| NG-36 | fixed | The Share dialog's option is "Email them a link" for every newly ticked contact. |
| NG-37 | fixed | Typed-in securities keep names copied from the source table. |
| NG-38 | fixed | Leaving with "Not saved" asks the browser's leave confirmation. |
| NG-39 | skipped | Needs a product decision; recorded under Open questions. |
| NG-40 | accepted | The answer "a link is on its way" is true when an update just sent one. Stated in Rate limits. |
| PG-20 | skipped | Open question reworded with the reason (changes ownership of every table). |
| PG-24 | skipped | Open question with the reason (copy for a rare case). |
| PG-37 | fixed | Signed SAFE flips only a prospect contact to investor. |
| PG-15, PG-23, PG-30 | fixed | Blank rows ignored, negative values outlined, duplicate names allowed; first read shows "Reading sheet…"; Send disabled with no recipient ticked. |
| Views | added | `safe-link`, `inv-updmenu`, `inv-copylink`, `inv-addcontact`, `inv-changed` (mockup now 50 views). |
