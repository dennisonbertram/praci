# J4: Hunting for an old email (STORY-012, 003, 007, 013)

Walked at 1440x900 on the live app, read-only, one connected account, no Inbox agent. Screenshots (outside the repo): `J4-01-default.png` to `J4-09-after-close.png` in the scratchpad `ux-flow-screens/`.
Target used: "an email with an attachment from more than 3 weeks ago". Query typed: `has:attachment older_than:21d`.

Scope limits: only one account was connected, so account tabs never appeared (STORY-012 account steps not exercised; the tab code is at `apps/web/src/pages/Inbox.tsx` ~L560-570). Triage categories were on, but Filter > category was not walked (STORY-013 category path from the catalog only). Reply/archive not exercised (read-only).

## Friction Scorecard

| Measure | Actual | Ideal | Evidence |
|---|---|---|---|
| Steps to find a 3-week-old attachment mail | 5 (focus search, type operator query, Enter, scroll, click row) plus knowing Gmail syntax | 3 (search, pick Has-attachment, open) | J4-04 |
| Decisions | Choose: scroll vs search vs Filter vs operator syntax | Search box only | J4-02 |
| Re-entry | None: `?q=` stays in the URL after opening a result | none | measured: URL kept `q` with `&mail=` added, and again after Esc |
| Confirmations | 0 | 0 | |
| Dead ends | 2 (below) | 0 | |
| Hesitations | 4 (below) | 0 | |

Measured facts
- Default list ended with no footer, no "Load more", no end text (J4-02). 139 rows, oldest "Oct 9", 5 days before today. Sections: To do, Needs reply, Today, Earlier. Nothing says the list is a recent window. This is a dead end: scrolling to the bottom answers nothing about older mail.
- The cap code is 14 days and 200 rows (`apps/api/src/inbox.ts:36-37`, used at L93, L371-375). In this walk the list stopped at 139 rows, so the 200-row cap was not what ended it (cause of the 5-day span not determined; suspected: only unarchived mail is listed).
- Search results (J4-04, J4-05): first page ran from "Sep 23" to "Sep 14" (about 9 days). One "Load more" extended it to "Sep 8" (J4-07). Scroll position stayed put after Load more (scrollTop 935 before and after).
- Rows show only "Mon D" or time (`InboxRow.tsx:17-24`). With `older_than:21d` all dates were September 2026 so the missing year did not mislead here, but the catalog's cross-year concern stands (suspected, not reproduced: no result older than 12 months was reached).
- The row has no attachment mark and no account label, even though the query was `has:attachment` and every row matched (J4-04, J4-05, J4-07). The paperclip information only appears in the opened dialog (J4-08: two attachment chips, full date with year, sender address, recipient).
- Search rows show no signal of whether the search covers all mail or only the cache; the visible results did go past 14 days, which tells the user only after the fact.
- Opening a result with a click, then Esc, returned to the same list and scroll (scrollTop 2600 before and after; URL `q` preserved; focus returned to a button). Good.
- A red "Couldn't reach Gmail. Try again" banner was shown above results that had loaded fine (J4-04). Cause unknown (possibly the earlier skeleton request failing, or a second request). Suspected: it makes the user distrust that the list is complete. Code: `Inbox.tsx:571-579`, shows `failed` independent of whether rows exist.
- First search took about 4 seconds on a skeleton before rows appeared (J4-03). The skeleton had no text.
- Opening a message in the dialog may mark it read (not verified, no unread count compared).

Dead ends
1. Bottom of the default list (J4-02): nothing offers "older mail".
2. Wrong-tool trap: Needs reply and Today groups sit above Earlier, so the first screen is a mix of mail dated Oct 11-13 under "Needs reply" before "Today" (J4-01). A user hunting by date reads dates out of order.

Hesitations
1. Which tool: scroll, Filter, search, or Inbox agent.
2. Operator syntax is undiscoverable in the UI (placeholder is "Search mail", J4-01).
3. Whether the red error banner means results are missing.
4. Whether "Load more" reaches the end, since it gives no result count or end marker (`Inbox.tsx:674-680` hides it silently when no token remains).

## Take-away Pass

Default list (J4-01, J4-02)
- To do card (about 180 px tall, J4-01): pushes the list down; not used in any hunt step. Collapse it when scrolling or when search is focused.
- Needs reply as a separate top group: duplicates rows that would otherwise appear by date; fine for triage, wrong for a date hunt. Hide whenever a query or filter is active (already is; keep).
- Per-row hover icons: not needed during a hunt, and archive-class actions are one slip away from a search result. Keep them hover-only.
- "Important" button next to search: unrelated to finding; swaps list contents (catalog says it drops the search silently). Candidate to move into the Filter menu.
- "Create Inbox agent" floating button at the middle right (J4-01): visible on every screen of the hunt and unrelated to it.

Search results (J4-04 to J4-07)
- The "Earlier" heading above a list that is entirely earlier adds nothing; a month heading would help instead.
- "Try again" banner: remove when rows are present, or explain what failed.

Dialog (J4-08)
- Reply / Reply all / Forward / Mark read: valid, not needed to locate mail. Not removed from the scope of this journey.
- Attachment chips and full date: required for the hunt and are the best information on the screen; they are in the wrong place (dialog, not row).

## The Simpler Version

Ideal path (3 to 4 steps)
1. Click Search mail. Below it, a short chip row appears: Has attachment, Date range, From.
2. Pick "Has attachment" (becomes `has:attachment` in the box) and a date range ("Older than 3 weeks"). Results load.
3. Rows show month and year for anything not in the current year, plus a paperclip when there is an attachment, plus an account label only when more than one account exists.
4. Click a row; Esc returns to the same spot (already works).

Concrete changes
1. Say what the default list covers. Add a one-line end-of-list row at the bottom of Earlier ("Showing mail from the last 14 days. Search to find older mail.") that is a button focusing the search box. Place in `apps/web/src/pages/Inbox.tsx` after the Earlier `InboxGroup` (~L666-672, before the Load more block at L674). It fixes dead end 1 and the STORY-003 "app is broken" feeling.
2. Add a paperclip and, when more than one account, an account chip to the row. In `apps/web/src/components/inbox/InboxRow.tsx` (row layout near L17-24 and the row body) and expose `hasAttachments` from the list payload. Fixes the biggest hesitation: the row never confirms why it matched.
3. Show the year for dates older than the current year: change `formatMailTime` at `InboxRow.tsx:17-24` to add `year: "numeric"` when `date.getFullYear() !== new Date().getFullYear()`. One line, no new copy.
4. Surface search affordances once, when the search box is focused and empty: chips for Has attachment, Last 30 days, From (inserting operators). In `Inbox.tsx` near the search box. This removes the need to know Gmail operators (STORY-007 step 7, STORY-013 step 3). New copy is three short chip labels; they replace a hidden syntax, so removing them would bring back the dead end.
5. Hide the red "Couldn't reach Gmail" row when rows are already showing, or add a plain reason (`Inbox.tsx:571-579`).
6. After the last page, replace the vanishing "Load more" with a quiet end marker ("End of results") so 100 rows can be told apart from all rows (`Inbox.tsx:674-680`).

## Clarity Issues

1. The cap is invisible (J4-02). Truncation without a message reads as sync failure. Measured: list ended at Oct 9 with no footer.
2. Row identity vs. match reason (J4-04): a `has:attachment` search returns rows with no attachment hint. Information that the user searched for is not shown.
3. Date format: "Sep 8" and "Oct 9" cannot be told from a year earlier (J4-07). Suspected hazard, not reproduced.
4. Group order: Needs reply (Oct 11-13) above Today above Earlier (J4-01) breaks the date order a hunter scans by.
5. Error banner coexisting with good results (J4-04) gives conflicting signals.
6. Skeleton with no wording for a roughly 4 second wait (J4-03). Not measured over repeat runs, one observation.
7. Dialog is clear: title, sender, full date with year, recipient, attachment chips with sizes (J4-08). Nothing to change except pulling the date/attachment facts into the row.

## Verdict

acceptable. The hunt works in about 5 steps and returns to the same place cleanly, but the end of the default list, the search syntax, and the row contents each force the user to guess; no single fix is structural.
