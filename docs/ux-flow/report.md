# UX Flow Critique: Web Inbox (2026-10-14)

## Run summary

| Metric | Value |
|--------|-------|
| Journeys critiqued | 6 (plus one cross-cutting redundancy pass) |
| Evidence source | Live pass on a real Gmail account, read-only (no archive, mark, reply or compose was exercised). Screenshots were kept outside the repo. |
| Verdicts | 0 minimal · 3 acceptable (first look, hunt, filters) · 3 convoluted (triage pass, search + filter, reading with context) |

The "Couldn't reach Gmail." banners seen during the walk were most likely caused by the walk itself. Seven parallel sessions pushed the account into Google rate limits, partly because every j/k selection prefetches a message. They are not counted as app defects. The prefetch behaviour that made it worse is counted.

## Friction scorecard

| Journey | Steps (actual / ideal) | Main friction | Verdict |
|---------|------------------------|---------------|---------|
| J1 First look | n/a (orientation) | No counts. 94% of rows carry an unread dot. An empty agent panel takes 26% of the width at 1440px. The list starts below a To do card. | acceptable |
| J2 Triage 130+ rows | 2–3 decisions per row | No progress signal. The list ends silently. Archive has no undo. Why a row "needs reply" is never shown. | convoluted |
| J3 Search + filter | about 5 / 3 | A category or Important silently wipes the search and filter. There is no result count and no "which view am I in". Three clear controls clear three different things. "Load more" gives no feedback. | convoluted |
| J4 Hunt for older mail | 5 / 4 | The default list ends with no cue (139 threads, about 5 days back). Rows lack a year and an attachment marker. | acceptable |
| J5 Read with context | open/close 1 / 1; earlier messages: dead end | No thread view. Opening doesn't mark read. j sometimes jumped to a non-adjacent row (suspected, not reproduced). | convoluted |
| J6 Filters | 1 / 1 to apply, 3 / 1 to clear | The menu has 14 unlabeled options in three groups. "Important" is unexplained. Clearing needs the menu. | acceptable |

## Redundancy map (from redundancy.md)

- **Duplicate paths:** Archive via the row, the dialog or `e`, and open via click, Enter or `o`, are deliberate accelerators, so keep them. Search exists three times (sidebar Search, Search mail, the Inbox agent), which is drift; Search mail is the canonical one. Clearing a view has three controls with different scopes, also drift.
- **Duplicate information:** "Things that need me" appears in the To do card, the Needs reply group, the Important toggle and the "Needs attention" badge. Unread is shown by a dot, text weight and the sidebar count, and the sidebar count disagreed with the dots.
- **Naming drift:** "Mark noise" produces a "Junk" badge. The "Newsletter" badge and the "Newsletters" category use different words. "Updates" (a Gmail tab) and "Notifications" (a triage category) sit side by side.

## Simplification proposals (ranked)

Ranked by how central the journey is, multiplied by friction removed and divided by effort.

1. **Say where you are and how much there is.** Add counts to the group headings. When a search or filter is active, replace the group headings with one header showing the result count and a single Clear that resets search and filter together. Effort S. Helps J1, J2 and J3.
2. **Archive everywhere, with Undo.** Archive is disabled under any search or filter, although search results are the same cached rows. Enable it, and add an Undo toast backed by an unarchive call. Effort M. Helps J2, J3 and J5.
3. **Opening marks read.** This matches Gmail, gives the dot meaning again, and removes a manual step per email. Mark unread stays in the reader. Effort S. Helps J1, J2 and J5. Decided with the user.
4. **Give the list the width.** Start the Inbox agent panel collapsed until an agent exists. Effort S. Helps J1 and J4. Decided with the user.
5. **End the list honestly.** After the last row, show a quiet line that points to search for older mail. Show "No more results" when paging runs out, and a busy state on Load more. Effort S. Helps J2, J3 and J4.
6. **Label the filter menu.** Add group headings ("Gmail tabs" and the Praci categories) so the user knows which grouping does what. Effort S. Helps J6.
7. **Show why a row needs a reply.** `MailRow.reason` is already sent but never shown. Use it as the row's title tooltip on Needs reply rows. Effort S. Helps J2.
8. **Dates with a year** for mail from an earlier year. Effort S. Helps J4.
9. **Pace prefetching.** Debounce the j/k selection prefetch, and stop prefetching for a while after a failed load. Effort S. A real user holding j causes the same rate limits.
10. **Thread view in the reader.** Deferred to its own change, decided with the user. It needs a thread API and reader UI. Effort L.

Not taken in this pass:
- **Row attachment and account markers.** The cache has no attachment field, so this needs a schema and sync change.
- **Reducing the To do / Needs reply overlap.** This is a product call.
- **The sidebar Search overlap.** It belongs to the app shell.
- **Unifying the "Noise"/"Junk" wording.** It needs a naming decision across surfaces.

## Already minimal

- Plain search: type, Enter, results, Esc. It works and keeps the query in the URL.
- Opening and closing a message: Esc and Back each take one step, and focus returns to the row.
- Applying a filter takes one click, and the active filter is shown on the button.
