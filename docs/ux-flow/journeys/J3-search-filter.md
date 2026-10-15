# J3: Search, filter, page, recover (STORY-020, 015, 010, 021)

Walked live at 1440x900, one Gmail account, triage on, read-only. Screenshots are in the session scratchpad as `J3-*.png` (not in the repo). "Measured" means observed in the browser; "suspected" means from code only. Line numbers are in `apps/web/src/pages/Inbox.tsx` unless noted. No mail content is quoted.

Environment note: several runs of Gmail-backed lists (Unread alone, Unread + search) showed the red "Couldn't reach Gmail. Try again" banner (`J3-10`, `J3-12`, `J3-14`) and then worked on retry (`J3-15`). Other critics were using the same account at the time, so this is probably load or rate limiting, not a defect in the flow. It did show that the banner can sit above a full list of old rows (139 rows with the banner, `J3-14`).

## Friction Scorecard

| Story | Ideal steps | Actual steps | Decisions | Re-entry | Confirmations | Dead ends / hesitations |
|---|---|---|---|---|---|---|
| 010 No results, recover | 3 (type, Enter, recover) | 3 | 1 (X vs "Clear search" vs Esc) | 0 | 0 | Two Clear controls on one screen (`J3-06b`); the empty state names only the query, never the active filter (`J3-22`). |
| 021 Filter + search empty | 2 | 2 if she guesses right | 2 (clear search or filter?) | 0 | 0 | No "clear all"; to drop both she needs two controls (menu Clear, then X/Clear search). |
| 015 Unread + sender search, peek at a category, come back | 4 | 6 (filter, search, category, retype search, re-pick filter, Back) | 3 | 2 (search text and filter both lost) | 0 | Category pick silently wipes the search and filter (`J3-11`). No message. Back restores both (`J3-12`), which is the only way back. |
| 020 Long narrowing afternoon | 5 (Has attachment + search, open row, Esc) | 9-10 in the story; 5 when the user knows to type `has:attachment` | 4-5 | Re-typing after every category or Important click | 0 | Cannot tell what window a view covers (14 days vs all mail). "Load more" gives no count or end signal. |

Measured step counts for what I did: default list to a filtered, searched list took 3 actions (menu, pick, type + Enter). Leaving it by Esc, X, "Clear search" is 1 action each.

## Take-away Pass

Search header (one row: title, search, Important, Filter, Compose, agent toggle):
- The Filter button label turns into the chosen filter name (good, `J3-20`). The Important toggle shows pressed state (good).
- "Clear" X inside the box and "Clear search" button in the empty state do the same thing and both appear at once (`J3-06b`). The X plus Esc already cover this, so the "Clear search" button is the first copy to remove (or it becomes the single clear-all control, see change 3).
- Compose and the agent toggle sit in the same row as search filters. Not part of this journey; leave.

Filter menu (14 items, one radio group, `J3-08`):
- Three groups with no group labels: Gmail-side (Unread, Starred, Has attachment), Gmail tabs (Primary, Promotions, Social, Updates), triage categories (Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal). Measured: no headings, only thin separators. "Updates" and "Notifications" overlap; "Promotions" and "Newsletters" overlap.
- The menu is 128 px wide, so "Has attachment" wraps to two lines (`J3-08`).
- It opens over the list, so the user cannot see the effect until it closes. Acceptable for a menu.
- Because triage categories and Gmail filters cannot combine, the menu is effectively two different features in one control.

Result list:
- Group headings "Needs reply / Today / Earlier" are shown for search results too (`J3-03` shows "Earlier"; `J3-20` shows "Earlier"). For a search, "Earlier" says nothing and is the only chrome above the rows. Removal candidate when a query or Gmail filter is active.
- Row date shows "Oct 13" style with no year. In a search spanning years, rows read "Jun 11", "Apr 24", "Oct 11", "Dec 6" in one list (`J3-20`), so year and order are unreadable. The order is not date-descending in that result (measured from the column).
- No result count anywhere. Not on the page, not in the list heading.

Empty and end states:
- "No results for "..."" + "Clear search" (`J3-06b`). Short, correct, but no hint about scope (all mail vs 14 days) or active filter.
- "Load more" is the only paging cue. No "end of results" text.

## The Simpler Version

Ideal steps for the long journey (find an old thing with narrowing):
1. Type words in Search mail, press Enter. Results replace the list, with a one-line heading such as the query and a result count (or "50+").
2. If needed, pick a filter. It combines with the query, and the box keeps its text.
3. Open the row, press Esc, and land on the same list.
4. One control clears everything ("Clear" in the box, which also removes filter).

Concrete changes (ranked by value per line of change):
1. Keep the search text and filter when the user picks a triage category or Important. Today `setInboxListParam` deletes `filter` and `q` for `category` and `view` (`lib/inbox-list-input.ts`, the `replaced` loop, lines ~46-52), and `useEffect(() => setDraft(query), [query])` at Inbox.tsx:172 empties the box. Decision needed: the API rejects category + search (`inbox.ts` BAD_REQUEST). So either (a) apply the category as a client filter over the search rows, or (b) when the user picks a category with a query typed, convert the pick to a Gmail query term (`label:`) or (c) at minimum, leave the box text so one Enter re-runs it and show the dropped state. Cheapest honest fix is (c): do not clear `draft` on category change, so the text stays and Enter retries it.
2. Show the active view above the rows when `filtered` is true: replace the "Earlier" heading with `"<query>" in <filter label>` and a result count, and add a single "Clear" there that removes `q` and `filter` together (Inbox.tsx:645-666 headings; `rows.length` is already available). This answers "what am I looking at, how many" and removes the "wrong clear button" problem in STORY-021.
3. Make the empty state name every active constraint and clear them together. At Inbox.tsx:598-603, when `query` and `filter` are both set, say `No results for "<query>" in <filter>` and have the one button remove both. Drop the separate X/"Clear search" duplication by keeping only the button.
4. Add the year to the row date when the message is not from the current year (InboxRow.tsx date format). Do the same sort fix for search: sort by date, or label the sort.
5. Load more: show a busy label ("Loading...") and an end message ("No more results") instead of letting the button vanish silently (Inbox.tsx:677-678, `more.busy` is already tracked).
6. Group the Filter menu with labels, or remove categories that Gmail tabs duplicate (Updates vs Notifications, Promotions vs Newsletters). Smallest step: add `DropdownMenuLabel` headings and widen to the longest item (Inbox.tsx:495-523).

## Clarity Issues

- What view am I in? URL carries it (`?filter=starred&q=...`), the screen shows only the box text plus the Filter button label. No count, no scope. Measured at `J3-20`, `J3-22`.
- What window does a view cover? Triage categories and Important look only at about 14 days of cached mail, while search and Gmail filters read all of Gmail. Nothing in the UI says so (suspected from code and catalog; `J3-11` shows a 9-row Bills list with no scope text).
- Are filter and search combined? Yes for Gmail filters (`J3-10`, `J3-15`: URL `?filter=unread&q=meeting`), but nothing says so, and the user can lose the combination by picking a category with no warning.
- Empty state hides the second constraint (`J3-22`).
- Loading: while a new query loads, the page shows 5 grey skeleton bars and the Important toggle disappears from the header, then reappears (measured, `J3-06` vs `J3-06b`; cause `triage = Boolean(shown?.enabled)` at line 270 while `shown` is null). The header shifts left and back. Small, but it makes the header look unstable during every search. A no-results search took longer than 3 seconds before the empty state appeared.
- "Load more" gives no progress text and no total (see Observed answers).
- Label clash: "Important" (toggle, triage-defined) vs the Gmail "Important" filter that appears in the menu only when triage is off (line ~490). Different meaning, same word. Suspected from code, not exercised.

## Observed answers

Catalog disagreements resolved by observation:

1. Does "Clear search" leave old text in the box? No. Measured at `J3-07-after-clear-search-button`: after the button the URL returned to `/app/inbox` and the box value was empty. The reason is `useEffect(() => setDraft(query), [query])` at Inbox.tsx:172, which refills the draft from the URL on every change. The catalog's "risk of stale text" is wrong.
2. Does picking a category or the Important toggle empty the search box? Yes, in both cases. Measured: with `?filter=unread&q=meeting` and then Bills, URL became `?category=billing` and box value was empty (`J3-11`). With `?view=important`, box empty (`J3-16`). The search text and the Unread filter are both gone; no message. Back restored `?filter=unread&q=meeting` with the box refilled (`J3-12`), so history works as a one-step undo. The "Unread + meeting" search keeps the filter when only the query changes (`J3-15`).
3. Does "Load more" show progress? Barely. Measured by sampling every 40 ms on a 42-row result: the button went disabled (greyed, same label, no spinner) and then re-enabled with 83 rows (42 to 83) with no count, no "added N", no scroll change message. Another time (query with 39 rows, `J3-04`, `J3-04b`) the click produced no new rows and the button disappeared, with no "end of results" text, so "finished" looks identical to "nothing happened".

Other observations:
- Esc in the box clears the text and the query, but keeps the filter (`J3-21`: filter button still read the filter name, 38 rows). Filter menu "Clear" while a query exists removes the filter only and keeps the query (`J3-23`, URL `?q=meeting`). Neither is a "clear all".
- Typing without Enter changes nothing: URL stayed `/app/inbox` (`J3-02`). The box holds uncommitted text and there is no hint that Enter is needed (the placeholder is "Search mail").
- Gmail syntax typed into the same box works (`has:attachment`, `older_than:30d`) and produced 43 and 42 rows (`J3-17`, `J3-18`). Nothing in the UI hints that operators exist.
- Back button: each filter or search is one history entry (`J3-12` to `J3-14`). Good.
- Rows of an older-than-30-days search end with "Sep 13"-style dates without a year (`J3-19b`, measured).

## Verdict: convoluted

Mostly because of three structural issues in one journey: a category or Important pick silently deletes the search and filter (STORY-015), the screen never states what view or how many results (STORY-020), and the clear controls do different things (box X and Esc clear the query, menu "Clear" clears the filter, empty-state button clears only the query; STORY-010/021). Per the heuristic scale this is 3+ extra steps and a screen failing several heuristics. The core search itself (type, Enter, results, Esc) is minimal and works well.

Top 3 changes:
1. Show the active view and count above the rows (replace the "Earlier" heading when filtered) with one "Clear" that removes query and filter together.
2. Do not wipe the search text or filter when picking a category or Important; at minimum keep the box text, and say when a combination is not possible.
3. Make the empty state and "Load more" explicit: name every active constraint in the empty state, show "Loading..." and "No more results" for paging, and add the year to dates older than this year.
