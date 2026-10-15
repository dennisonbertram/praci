# Topic: search-gmail-syntax

Code refs: `apps/web/src/pages/Inbox.tsx` (search form 410-454, empty states ~598-620, Load more ~675, loadMore 325), `apps/web/src/lib/inbox-list-input.ts`, `apps/web/src/lib/inbox-keyboard.ts`, `apps/api/src/inbox.ts` (searchMail 198-262, inboxList query wrap ~268-282, SEARCH_PAGE_SIZE=50 at :42), copy in `apps/web/src/locales/en/messages.po`.
Copy used: placeholder/aria "Search mail"; button aria "Clear"; empty `No results for "{query}"` + "Clear search"; "Load more". There is NO hint text for operators anywhere.

## STORY-001: Find last month's invoice with a plain word
**Type**: short
**Topic**: search-gmail-syntax
**Persona**: Marisol Vega, freelance bookkeeper, 400+ unread, buried in client mail
**Goal**: Find the "Harbor Print Co" invoice she half-remembers from three weeks ago.
**Preconditions**: One Gmail account connected; list shows last 14 days only.
**Ideal path**: 3 — click box, type, Enter.
**Alternate paths**: Press `/` (inbox-keyboard.ts) to focus the box instead of clicking; ask the Inbox agent panel (mail_search tool) instead.
### Steps
1. Press `/` on the list → focus jumps to the "Search mail" input (focusSearch, Inbox.tsx:378). Marisol did not know this shortcut existed; she clicks the box.
2. Type `harbor print invoice` → text appears; an "X" (aria "Clear") appears at right. Nothing else happens; list does not change while typing (no search-as-you-type). She briefly wonders if it is broken.
3. Press Enter → form submit sets URL `?q=harbor print invoice`; skeleton rows show (5 grey bars, no text), then a flat grouped list (Today / Earlier; no "Needs reply") of Gmail matches, newest first.
### Variations
- She types nothing and presses Enter: `draft.trim()` is "" so `q` is removed; list stays as is.
- Presses Enter again unchanged: same URL, no visible feedback.
### Edge Cases
- Results can be older than 14 days (live Gmail), yet rows show only "Mon D" with no year; a 2023 invoice looks like this year's.
- Nothing tells her results came from all her mail rather than the recent cache, so she cannot tell whether "no result" later means "doesn't exist".

## STORY-002: Operators work, but nobody told her
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Tobias Lindqvist, ops manager at a small logistics firm, 20 vendor threads a day
**Goal**: Narrow to PDFs from one vendor since the start of the month.
**Preconditions**: Gmail connected; search box empty.
**Ideal path**: 4 — click, type one operator query, Enter, scan.
**Alternate paths**: Filter menu "Has attachment" (single-select, cannot combine with a sender); Inbox agent chat in natural language.
### Steps
1. Click the "Search mail" box → caret, placeholder only. No hint, tooltip, example chips or help link; Tobias has used Gmail for years so he guesses.
2. Type `from:dockline has:attachment filename:pdf after:2026/10/01` → accepted (max 500 chars, `MAX_QUERY`).
3. Press Enter → server wraps as `(from:dockline has:attachment filename:pdf after:2026/10/01)` and sends it to Gmail (inbox.ts ~268). URL gets `?q=...`.
4. Results appear: rows are one-line, 44 px; sender, subject-plus-snippet, time. There is no attachment icon on rows, so he cannot tell at a glance which result carries the PDF he searched for (gap).
5. Opens first result with Enter/`o`... he must first arrow with `j`/`k` (selected row) then Enter → message dialog with attachment chip (filename, size).
6. Presses Esc in the dialog → closes; focus returns to the row (wasOpen effect).
### Variations
- Misspelled operator (`form:dockline`) → Gmail treats it as text; likely `No results for "form:dockline"` with no "did you mean".
- Quotes and `OR`/`-` work the same as Gmail, again undocumented.
### Edge Cases
- Query text is echoed in the empty state exactly as typed, including operators, so long queries make a long unwrapped sentence.
- Information on multiple surfaces: "Has attachment" exists as a Filter menu item AND as an operator; the two cannot be mixed because choosing one clears the other (setInboxListParam).

## STORY-003: No results, then recover
**Type**: short
**Topic**: search-gmail-syntax
**Persona**: Priya Raman, clinic office coordinator, stressed, in a hurry
**Goal**: Find an email from "Dr Okafor"; the search finds nothing and she needs a way back.
**Preconditions**: Search box empty.
**Ideal path**: 3 — Enter, read empty state, click "Clear search".
**Alternate paths**: Esc in the input; the "Clear" X button; sidebar Inbox button (probably keeps URL params, unverified); browser Back.
### Steps
1. Type `subject:okafor referral` and Enter → skeleton, then centered text `No results for "subject:okafor referral"` and an outline "Clear search" button.
2. She thinks "did I misspell it?" Nothing suggests loosening the query or searching sender; no count, no "searched all mail" statement.
3. Click "Clear search" → `q` removed, the default last-14-days list returns, still grouped Needs reply / Today / Earlier. Her typed text vanishes from the box? draft is state; "Clear search" button only changes URL param, so the box may still show the old text (code: only the X and Esc call setDraft("")). Observed risk of stale text in the box.
### Variations
- Press Esc inside the box instead: draft and `q` both cleared.
- Click the X (aria "Clear"): clears, and focus goes back to the input.
### Edge Cases
- If Gmail fails for the account, the empty state is suppressed (`failed ? null`) and the red banner with "Try again" shows instead, so "no results" is never claimed falsely.

## STORY-004: Search wipes the filter, filter wipes the search
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Jun Watanabe, recruiter, wants unread mail from one agency
**Goal**: Combine "Unread" with a sender search.
**Preconditions**: Triage on or off, Gmail connected.
**Ideal path**: 3 — type `from:brightpath is:unread` in the search box (operators substitute for the filter).
**Alternate paths**: Filter menu "Unread" then search (code: loses the filter or search; setInboxListParam replaces); Important toggle (triage) cannot combine either.
### Steps
1. Open the Filter dropdown, choose "Unread" → list narrows (live Gmail `is:unread`); trigger shows the chosen label.
2. Type `brightpath` in the search box, Enter → URL now `?filter=unread&q=brightpath`? No: filter and q coexist (readInboxListState keeps both; API AND-s them). So they DO combine. Only view/category are cleared. Jun sees fewer rows and is pleased, but nothing in the UI shows both are active except the filter label and box text.
3. Select the Important toggle or a category (triage) → `filter` and `q` are deleted silently; the search box text may still be visible in the box (draft not reset by this path) while the list no longer reflects it. Observed mismatch risk.
4. Jun presses Clear on the filter menu → returns to default list.
### Variations
- Reverse order: category first, then search → category dropped, only search remains.
### Edge Cases
- API throws BAD_REQUEST "A view or category cannot be combined with a filter or search" if forced; UI normally prevents it.
- No chip/summary row shows "what is currently narrowing this list"; overload risk when several things are active.

## STORY-005: Load more on a broad query
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Eleni Papadakis, startup founder with 3 connected Gmail accounts, thousands of old threads
**Goal**: Scan everything from "stripe" to find one dispute email from last spring.
**Preconditions**: 3 accounts; "All" tab.
**Ideal path**: 6 — search, scan 1-2 pages, add `after:`/`before:` operators instead of paging.
**Alternate paths**: Refine with `before:2026/05/01 after:2026/03/01`; switch to one account tab to narrow; ask Inbox agent.
### Steps
1. Search `stripe` + Enter → up to 50 messages per account per page, de-duplicated by thread, merged newest-first (searchMail 198-262). List can be ~150 rows, long and visually flat (Today/Earlier only; no month headings).
2. Scrolls; reaches an outline "Load more" button at the bottom (only when `filtered && fresh && token`).
3. Clicks "Load more" → button disables (`busy`) with no spinner or text change; new rows append.
4. Notices newer-looking mail appears below older rows (known cross-account paging caveat, inbox.ts:196-200) and loses her place.
5. Gives up paging; refines to `stripe dispute after:2026/03/01 before:2026/05/01` and Enter → page resets (new list key), top of results shows only that window.
6. Opens a row; dialog prev/next walk the loaded list.
### Variations
- Clicks "Load more" repeatedly; no total count ever appears.
- No "Load more" appears when all pages fit (no "end of results" message either).
### Edge Cases
- Load more failure → global error banner "Try again"; retry re-lists rather than retrying the page.
- Changing tab mid-load: stale response ignored via keyRef check.

## STORY-006: Archive vanishes during search
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Daniel Okoye, sales director who clears mail by keyboard
**Goal**: Search for newsletters from one sender and archive them all.
**Preconditions**: Gmail connected.
**Ideal path**: n/a in search — Archive is unavailable; ideal would be 4 steps if allowed. Real route: search to find, then clear search and archive from the default list (only works for last 14 days).
**Alternate paths**: Inbox agent `mail_modify` (approval required; archives/labels); mark read via row hover button works in search.
### Steps
1. Search `from:dailydigest.example` + Enter → results.
2. Hover a row → hover buttons: Mark read/unread present; Archive absent (`onArchive` undefined when filtered). No tooltip explains why.
3. Press `j` to select a row, then `e` → nothing happens, silently (archive: filtered ? undefined).
4. Opens the row with Enter → dialog actions: Reply, Reply all, Forward (and read toggle); no Archive button.
5. Presses `e` in the dialog → nothing.
6. Frustrated, clears with Esc in the search box; default list returns, but old digests older than 14 days are not there to archive. Gap: no bulk select, no "archive all results", no explanation text.
### Variations
- With triage on, "Mark noise" per sender is available in search, partially replacing the need.
### Edge Cases
- Rows read-marked in search update optimistically; if it fails, the banner shows and the list reloads.
- Same missing-archive behavior applies with any Filter menu choice (`filtered` includes filter).

## STORY-007: Esc, Clear and keyboard flow in the search box
**Type**: short
**Topic**: search-gmail-syntax
**Persona**: Hannah Berg, keyboard-first project manager
**Goal**: Search, check a result, and return to the unsearched inbox without the mouse.
**Preconditions**: Focus on the list.
**Ideal path**: 5 — `/`, type, Enter, Esc... then Esc again.
**Alternate paths**: Click X "Clear"; "Clear search" in empty state.
### Steps
1. Press `/` → input focused; typing `/` itself is not inserted.
2. Type `kickoff`, press Enter → results; focus stays in the box, so `j`/`k` are typed text, not navigation (list shortcuts disabled when typing). She must Tab out or click a row before `j` works; not hinted.
3. Press Esc → Esc handler clears draft and removes `q`; full default list returns.
4. Press `/` again → focus search; `?` opens "Keyboard shortcuts" help from the list, which lists `/` but no mention of Esc-to-clear.
### Variations
- Esc when the box is empty and no `q`: nothing.
- Esc while the box is focused but only draft differs from `q`: just clears the text.
### Edge Cases
- Browser native type=search cancel button is hidden (CSS), leaving only the custom X.
- Esc in message dialog closes the dialog first; the search remains.

## STORY-008: Long hunt across accounts, tabs, dialog and back
**Type**: long
**Topic**: search-gmail-syntax
**Persona**: Rosalind Achebe, chief of staff, 2 work accounts plus a personal one, hundreds of unreads, overwhelmed by rows that all look alike
**Goal**: Locate a travel itinerary a colleague forwarded, confirm the date, reply, and return to where she was.
**Preconditions**: 3 accounts; "All" tab; triage on (Important toggle and category filter visible).
**Ideal path**: 12 — one operator search, open, reply, Esc back.
**Alternate paths**: Inbox agent chat (ask in plain language); chat email cards open the same dialog but with no archive; Filter menu "Has attachment".
### Steps
1. Scan default list: Needs reply, Today, Earlier — itinerary not there (older than 14 days). She scrolls to the end; no "end of list / only last 14 days" message.
2. Click "Search mail", type `itinerary`, Enter → results from all three accounts mixed; no row shows which account a message belongs to (gap).
3. Too many hits; refine by adding `from:mehta@clientco.example has:attachment` → Enter; list shrinks. URL `?q=` holds the query so Back/refresh keeps it.
4. Click the account tab of the work account → list refetches for that account only, query kept.
5. Press `j` (after clicking outside the box) to select first row; hover buttons appear (no Archive, since searching).
6. Press Enter → dialog opens with `?mail=<id>`; reads sender, full date, "to"/"cc" truncated, attachment chip "Itinerary.pdf".
7. Press `j` in the dialog → next message in the search list.
8. Press `k` → previous. She finds the right one: confirm date in body (sandboxed iframe).
9. Press `r` → Reply composer opens ("Reply"), dialog hidden behind it.
10. Type short confirmation, Send → 5 s "Sending... Undo" window, then "Sent"; MAIL_SENT_EVENT reloads the list.
11. Back in the list, the search is still applied; row focus returns to the replied row.
12. Press Esc? Esc in the list does nothing unless the box is focused; she clicks the box then Esc → full inbox returns. She hesitates because it is unclear how to get back to the "normal" view.
### Variations
- After step 10 the list reload may reorder rows, losing her place.
- Use the Important toggle mid-way: search is dropped silently.
### Edge Cases
- Account tab labels truncate at 160 px; two work accounts with similar names look identical.
- Reply to a thread row replies to the opened message only; no thread view (gap).
- Same itinerary info appears on three surfaces: row snippet, dialog body, attachment chip; row never hints an attachment exists.

## STORY-009: Searching with the wrong tool — older mail, triage categories
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Kwame Boateng, accountant at tax season, receives receipts constantly
**Goal**: Pull all receipts from vendor X of the last year.
**Preconditions**: Triage on; "Receipts" category in Filter menu.
**Ideal path**: 3 — search `from:vendorx receipt after:2025/10/14`.
**Alternate paths**: Filter menu category "Receipts" (cached 14 days only).
### Steps
1. Open Filter, choose "Receipts" → only 14 days of cached, classified mail; Kwame thinks that is everything.
2. He asks himself why last year's receipts are missing; no copy says the category is limited to 14 days.
3. Types `vendorx receipt after:2025/10/14` in search, Enter → category dropped (setInboxListParam clears view/category when q is set); live Gmail results spanning a year; rows are unlabeled with "Mon D" only, so 2025 and 2026 dates look the same.
4. Clicks "Load more" twice to page back; looks for sorting by amount or date: none exists (newest first only).
### Variations
- Searches with `category:` operator: Gmail's own tabs, not triage categories; names overlap ("Promotions"), confusing.
### Edge Cases
- Triage labels (Newsletter, Needs attention, Spam/Junk) show on search rows only if the message is cached with classification; older ones show none, so rows look inconsistent.
