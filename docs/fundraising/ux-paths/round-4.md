# UX paths, round 4

Round 4 compares the stories in `docs/fundraising/ux-paths/topics/` with the plan (`docs/fundraising/README.md`) and the mockup (`docs/fundraising/mockup.html`, 50 views) as they stand after round 3. It edits only files under `docs/fundraising/ux-paths/`. The authoritative gap list is the section "Plan gaps (round 4)" in `docs/fundraising/ux-paths/catalog.md`. The walk is on paper against the plan text and the mockup screenshots, not against running code.

## Result

Open gaps now: 0 blocker, 0 must-fix, 4 should-fix, 23 nice (27 in all). All 4 should-fix and 8 of the nice gaps are new in round 4; 15 nice gaps carry over. The loop's stop rule (no must-fix and no new should-fix) is not met, because of the 4 new should-fix gaps.

## Round-3 items re-checked

Of the 32 gaps open after round 3, 14 are resolved, PG-20 and PG-24 are skipped with a reason that holds, NG-40 is accepted, and 15 nice gaps remain open. Round 3's claim "fixed" is confirmed for NG-28 to NG-38 and PG-37, PG-15 and PG-30. One claim does not fully hold: PG-23 (first sheet read) is fixed for the source line only; what the page body shows with no snapshot is still not stated. PG-20 and PG-24 are no longer counted as open because their skip reasons hold (a shared company record changes the ownership of every table; a "partly read" cue is copy for a rare case). Seven resolved items expose a new gap each; they are listed in the catalog.

## New should-fix gaps

- NG-41: the To list governs email only; every investor contact with portal access can read an update the founder did not tick them for, and the editor does not say so.
- NG-42: Post to portal mints no link and sends no notice, so a founder without Gmail reaches only contacts who already hold a live link and must use Resend link on each other row.
- NG-43: a board update without Gmail offers "Post to portal", which can never show it to the board, and the row would read as delivered.
- NG-44: an unlinked Mercury Draft and its Mercury row both count in the Pending segment (a $50,000 SAFE reads $100,000 Pending); the mockup never draws the duplicate state.

## New nice gaps

NG-45 (Failed after a restart may have been delivered), NG-46 (a Sending row off the editor), NG-47 (Portal cell after Unblock), NG-48 (Resend link for board and auditor contacts), NG-49 (fixed 30-day portal session), NG-50 (per-row save edge cases), NG-51 (duplicate email in Add contact), NG-52 (emailing a Posted update after Gmail is connected).

## Stories changed (37)

Topic files keep their own ids. Reasons are the plan or mockup change that made the old steps wrong.

| Topic file | Stories changed | Main reasons |
|---|---|---|
| `topics/updates-and-board.md` | 201, 203, 204, 207, 208, 210, 211, 212 | No per-update shares and no share rows; background send job and its resume rules; Posted status and "Post to portal" without Gmail; sent updates read-only with Duplicate and Delete (`#inv-updmenu`); board updates never on the portal; email subject "<Company> · <Period> update"; Send disabled with no recipient |
| `topics/investor-portal.md` | 301, 302, 303, 304, 305, 308, 309, 310, 311 | `PortalSession` (random cookie token, 30 days) and its deletion on revoke, block and email change; Resend link for any investor contact with an email; the portal lists every sent update to every investor contact; Share dialog emails every newly ticked contact; copy-link dialog drawn (`#inv-copylink`); link email subject "<Company> · your link"; the "Nothing shared yet" precondition |
| `topics/cap-table-sources.md` | 102, 103, 104, 105, 106, 111, 112, 113 | Failed switch keeps the old label and the menu shows "Last read failed · Try again"; per-row saves with `rev` and "Changed elsewhere" (`#inv-changed`); blank, negative and duplicate-name rows; names copied from the source table; leave confirmation; Retry re-sends only unsaved rows; round bar segment renamed Pending |
| `topics/fundraising-safes.md` | 501, 502, 503, 504, 506, 509, 512, 514, 516 | Pending replaces Committed on the round bar (Draft and Sent SAFEs count); the row menu offers only the next valid mark; Mercury merge needs an email and a matching amount; Link to Mercury SAFE picker drawn (`#safe-link`); only a prospect flips to investor |
| `topics/first-run-and-cross-page.md` | 604, 609, 610 | Pending segment; merge needs an email; Add contact dialog drawn (`#inv-addcontact`) with a Kind choice; contact menu items; a board member who signs a SAFE keeps their kind |
| `topics/audit-requests.md` | none (header only) | Round 3 did not change audits |

Unchanged (43): the other stories in the six topic files. In the gap-tag footer of every topic file the resolved ids were removed and the new ids added.

## Views still not drawn

The Undo control after a Mark, the Mark sent date prompt, the Posted row on Updates, and the SAFEs list while a Draft and an unmerged Mercury row both show (the plan says both show; `mock-safe-link.png` shows only the Draft). These are mockup gaps, not plan gaps, except the last, which is part of NG-44.

## Round 4 resolution

| Id | Status | Change |
|----|--------|--------|
| NG-41 | fixed | To list hidden without Gmail; one line when an unticked investor has portal access (`ed-unticked`). |
| NG-42 | fixed | Post to portal sends portal notices with fresh links; copy-link dialog without a provider; toast and Posted row; Copy link in the contact menu for contacts with no email. |
| NG-43 | fixed | Board update without Gmail shows only "Connect Gmail to send" (`ed-boardnog`). |
| NG-44 | fixed | Every SAFE counts once: a hand-off Draft (`Safe.awaitingMercury`) counts until linked; an unlinked Mercury row of the same amount is held out. Both rows show with Link to Mercury SAFE; Pending reads $150k in `fundraising` and `safe-mercury`. |
| NG-45 | fixed | "Unknown — check Sent mail" with Retry asking once "May already be delivered. Send again?" (`ed-unknown`); never auto-resent. |
| NG-46 | fixed | Sending row in Updates (`inv-sending`). |
| NG-47 | fixed (text) | After Unblock the Portal cell reads "Unblocked · send a link". |
| NG-48 | fixed (text) | Resend link also for any contact kind with shared documents. |
| NG-49 | open | Fixed 30-day session, unchanged. |
| NG-50 | open | Per-row save edge cases, unchanged. |
| NG-51 | fixed (text) | Duplicate email in Add contact opens the existing contact. |
| NG-52 | fixed (text) | Plan says: Duplicate, Send, then Delete the Posted original. |
| PG-23 | fixed | First sheet read shows one line "Reading <sheet name>…" in the page body (`inv-reading`). |
