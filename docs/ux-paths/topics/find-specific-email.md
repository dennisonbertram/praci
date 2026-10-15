# Topic: find-specific-email

Locating a known email by scanning the list, Search mail, filters, or the Inbox agent. Key code: `apps/web/src/pages/Inbox.tsx` (search form ~L410-454, empty states ~L605-630, Load more ~L675), `apps/api/src/inbox.ts` (`WINDOW_MS` 14 days L36, `MAX_ROWS` 200 L37, `SEARCH_PAGE_SIZE` 50 L42), `components/inbox/InboxRow.tsx`, `lib/inbox-list-input.ts`, agent tools in `packages/adapters/src/builtin-tools.ts:565-700`.

## STORY-001: Spot it in the default list (short)
**Type**: short
**Topic**: find-specific-email
**Persona**: Marcus, a property manager who got a "Lease renewal - Unit 4B" email from Harbor Realty this morning
**Goal**: Open that email from the list.
**Preconditions**: Gmail connected, triage ON, ~60 messages in the last 14 days, no filter/search.
**Ideal path**: 3 — scan the Today group, click the row, read it.
**Alternate paths**: Press `/`, type "Harbor", Enter (STORY-002); press `j` repeatedly then `Enter`/`o`.
### Steps
1. Click sidebar "Inbox" → `/app/inbox`; 5 grey skeleton rows (no text) then list. Marcus sees a "To do" card first, pushing the list down.
2. Scan "Needs reply" then "Today" groups, one 44px line per mail: sender (truncated to ~96-180px), "subject - snippet" on one ellipsised line, time "9:12 AM" → he hesitates: "Harbor Realty" shows as "Harbor Re…" and the subject is cut so the snippet is hidden.
3. Click the row → modal dialog opens, URL gets `?mail=<id>`; subject as title, sender `<address>`, date-time.
### Variations
- The mail appears twice in mind: it may sit in "Needs reply" (no "Needs attention" badge there by design) and not in "Today" at all; Marcus scrolls past Needs reply wondering if it is missing.
- Triage still pending: rows silently regroup after ~5 s, the row he was about to click jumps.
### Edge Cases
- Same information (sender/subject) appears in the row and again in the dialog header, but the row carries no attachment icon, so he cannot tell which of two similar rows has the lease PDF.
- Mail arrived but sync hasn't finished: list shows cached rows only; no "last synced" display.

## STORY-002: Search by sender, then clear (short)
**Type**: short
**Topic**: find-specific-email
**Persona**: Priya, a freelance designer looking for last month's invoice from Acme
**Goal**: Find Acme's invoice email (about 5 weeks old, i.e. outside the 14-day cache).
**Preconditions**: Gmail connected; default list shows only the last 14 days.
**Ideal path**: 4 — `/`, type, Enter, click result.
**Alternate paths**: Filter "Has attachment" then scan (still lists only a Gmail page); ask Inbox agent (STORY-007). Triage category "Receipts"/"Bills" does NOT help: category views use the 14-day cache.
### Steps
1. Scan "Earlier" for Acme → nothing; list just ends after the last cached row with no "older mail" message. She wonders if the invoice was deleted.
2. Press `/` → search box "Search mail" focuses (no visible hint that `/` exists).
3. Type "Acme invoice", press Enter → URL gets `?q=Acme%20invoice`; search is submit-only, nothing updates while typing. Skeleton rows, then results grouped Today/Earlier (no Needs reply group while searching).
4. She sees an April-style date like "Sep 9" with no year → click the row; dialog opens.
5. Click "Clear" (X) or press Esc in the box → `q` cleared, back to the 14-day list.
### Variations
- Type `from:acme` — works because the query goes to Gmail as `(query)`, but nothing in the UI says so; Priya only knows if she is a Gmail user.
- Typing then pressing Esc without Enter clears the draft only.
### Edge Cases
- Observed gap: rows show no year, so an Acme invoice from last September looks identical to one from this September.
- Archive (`e`, row button, dialog button) is disabled during search: she wants to tidy the found mail and the shortcut silently does nothing.

## STORY-003: Hit the 14-day / 200-row wall with no explanation (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Tomás, an operations lead who gets ~80 mails a day and needs the "Q3 vendor contract" thread from three weeks ago
**Goal**: Realise why it isn't in the list and reach it.
**Preconditions**: Heavy inbox; unfiltered view is capped at 200 rows and 14 days, no Load more.
**Ideal path**: 5 — give up scrolling quickly, search, open.
**Alternate paths**: Inbox agent; Gmail itself (outside the app). In-app no "load older" exists.
### Steps
1. Open Inbox → list of up to 200 rows; at 80/day the cap means the visible window may be only ~2-3 days, not 14.
2. Scroll the "Earlier" group to the bottom (long flat list, only "Mon D" times) → list simply ends; no "Load more", no "showing last 14 days", no end-of-list text. Tomás thinks the app is broken or sync is stuck.
3. Scroll back up and check account tabs (if >1 account: tabs All + one per account) → tab switch re-lists the same capped window per account.
4. Try Filter (icon) → "Unread"/"Starred"/"Has attachment"/"Primary"… selecting one switches to live Gmail with "Load more" (50 per account per page). First inkling that filters reach further back than the plain list.
5. Click "Load more" repeatedly → each click appends 50 per account; rows de-duplicated by thread. He is paging by hand through year-old mail.
6. Instead types "contract Q3" into Search mail, Enter → picking search replaced the filter (mutually exclusive); results appear; opens the thread's latest message.
### Variations
- Triage OFF (no model): filter menu lacks category radios; "Important" is a Gmail filter item.
- With the To-do card present the list is shoved below the fold, making the scroll even longer.
### Edge Cases
- Cap is silent: rows 201+ of the last 14 days are also invisible with no signal.
- Observed gap: no date-range picker, no jump-to-date, no sort.
- Cross-account paging caveat in search merge (`inbox.ts` ~L196-200): All-tab pages may show out-of-order dates.

## STORY-004: Filter-then-search collision (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Aisha, a recruiter looking for an unread email from a candidate named "Dana" about a scheduling change
**Goal**: Combine "Unread" with the name "Dana".
**Preconditions**: Triage ON.
**Ideal path**: 4 — search `Dana is:unread` (Gmail syntax) in one box.
**Alternate paths**: Filter "Unread" and scan visually; category "Scheduling" then scan.
### Steps
1. Open Filter dropdown → single-select radios: Unread, Starred, Has attachment, Primary, Promotions, Social, Updates, plus categories Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal. She picks "Unread"; the trigger now shows the chosen label.
2. Types "Dana" in Search mail, Enter → `setInboxListParam` replaces the filter: Unread is dropped, trigger returns to plain "Filter". She loses the narrowing silently and gets Dana's read and unread mail mixed.
3. Re-picks "Unread" → search text "Dana" is cleared. Frustration: she cannot hold both.
4. Tries the "Important" toggle (triage) → also replaces the filter/search.
5. Finally recalls Gmail syntax and types `Dana is:unread` in the box, Enter → works (query is AND-ed and wrapped), but only by luck.
### Variations
- Pick category "Scheduling": uses the cached 14-day list, so a 3-week-old Dana mail won't appear, unlike "Unread" which is live Gmail. Same menu, different reach, no label saying which.
### Edge Cases
- Empty result → "No mail matches this filter" + "Clear filter" (or `No results for "Dana is:unread"` + "Clear search"); different button names for the same escape.
- Needs reply group disappears under filters; the email she wanted may have been grouped there before.

## STORY-005: Narrowing a crowded Earlier list by scanning with the keyboard (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Jun, an accountant with 150 rows who remembers only "a shipping notice with a tracking number, sometime last week"
**Goal**: Find it without a sender or subject.
**Preconditions**: Triage ON, no filter, list ~150 rows.
**Ideal path**: 5 — Filter > Notifications (or search "tracking"), scan, open.
**Alternate paths**: `j`/`k` scan; search "tracking number" or "shipped"; agent.
### Steps
1. Press `j` → first row selected (left border + bg); `k` goes back. He holds `j` to scan, but the selection scrolls and each row is one cramped line.
2. Row subjects start with order-bot text "Your order has shipped - …" but sender "no-reply@…" truncates; five rows look identical. He hesitates, unsure which store.
3. Press `Enter` or `o` → dialog opens; `j`/`k` now mean next/previous message in the same list. He walks messages one by one.
4. Esc → dialog closes, selection stays.
5. Gives up, opens Filter > "Notifications" → cached category list (14 days) shrinks to ~20 rows, still all similar.
6. Types "tracking" in Search mail → Enter → results from live Gmail; picks one.
### Variations
- Noise-marked senders render muted, so a legitimate store he marked noise earlier is hard to see.
### Edge Cases
- Shortcuts are disabled while typing and while any dialog is open; `?` opens "Keyboard shortcuts" but no UI button shows it exists, and it omits `o` and arrow keys.
- Observed gap: no attachment, thread-count or account indicator on rows to tell near-duplicates apart.

## STORY-006: Multi-account — the right mail in the wrong place (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Elena, a consultant with work@elenaco.example and personal@mailbox.example connected
**Goal**: Find a flight confirmation she forwarded to her personal account.
**Preconditions**: Two Gmail accounts connected; "All" tab selected.
**Ideal path**: 4 — search "flight confirmation" from All, open.
**Alternate paths**: Per-account tabs; agent (searches across accounts).
### Steps
1. See tabs "All", "work@elenaco.example", "personal@mailbox.example" (labels truncate at ~160px) under the toolbar.
2. Scan All: rows don't show which account they belong to. Two near-identical "Itinerary" mails appear; she can't tell which is the original.
3. Click the personal tab → list narrows; the original's still nowhere (older than 14 days).
4. Search "flight confirmation" with the personal tab active → 50 per account per page; result appears.
5. Open it, dialog shows from/to/date but not which account it was delivered to.
6. She presses `r` to reply; composer From defaults to the current tab's account (`connectionId={tab}`). If she was in All, the default may not be the account she expects.
### Variations
- One account needs reconnecting: global banner "Gmail needs to be reconnected." with Try again and no account named; she doesn't know that half her mail is missing from All.
### Edge Cases
- Partial sync failure shows cached rows below the banner, so the list looks complete but isn't.
- Information duplicated: account name appears in the tab and the composer From picker, never on the row.

## STORY-007: Ask the Inbox agent for a vaguely-remembered email (long)
**Type**: long
**Topic**: find-specific-email
**Persona**: Ravi, a sales director who remembers "an email from a Berlin supplier about a price change, maybe spring" and has no sender name
**Goal**: Find and open the email through the Inbox agent, then act on it.
**Preconditions**: Inbox agent exists (otherwise "Create Inbox agent"); panel may be collapsed (default on phones; "Show Inbox agent" button).
**Ideal path**: 7 — ask once, open the email card, read.
**Alternate paths**: Search mail with guessed keywords ("price" "Berlin"), repeated; Gmail outside the app.
### Steps
1. Ravi scrolls the list for a minute; nothing because the mail is months old and the plain list stops at 14 days. He doesn't know why.
2. Notices the right panel; if collapsed, clicks "Show Inbox agent". If no agent exists, clicks "Create Inbox agent" (error text "Could not create the Inbox agent" on failure).
3. Types in the agent chat: "Find the email from a Berlin supplier about a price increase around spring." → agent runs `mail_search` (Gmail-syntax queries, date-less queries cover all history) then `mail_grep` on the saved results.
4. Agent summarises candidates and calls `show_emails`, rendering email cards in chat (max 20, grouped by urgency; "later" as a compact list).
5. Ravi hesitates: three candidate cards with similar subjects; the cards, like list rows, carry only partial context.
6. Clicks a card → opens the same message dialog (no filters, no Archive/Mark read from chat cards).
7. Reads body in sandboxed iframe, spots the PDF attachment chip, downloads.
8. Back in list, the mail still isn't in the Inbox view; the URL `?mail=<id>` is the only handle. He copies the address bar to find it again.
9. Asks the agent "archive the other two Berlin ones" → `mail_modify` needs approval (setting "Ask before email actions"); no trash/delete possible.
### Variations
- Agent is also reachable with the panel collapsed via the toolbar icon "Show Inbox agent"; "Collapse Inbox agent" hides it again.
- If the agent needs a model and none is configured, triage is off but the agent flow is separate.
### Edge Cases
- The agent covers all history while the list covers 14 days; nothing in the list explains this split, so the best tool for old mail is the least discoverable.
- Same finding is represented in 3 surfaces (agent text, cards, dialog) with different context.
- Observed gap: no "save this search", no way to pin a found email, no starred indicator on rows.

## STORY-008: Page through search results to find the oldest match (long)
**Type**: long
**Topic**: find-specific-email
**Persona**: Grace, an HR manager gathering every email from "payroll-support" over the past 6 months for an audit
**Goal**: Locate a specific payroll correction email she remembers being sent in June.
**Preconditions**: Gmail connected; ~120 matching mails; two accounts.
**Ideal path**: 8 — refine the search with a date operator rather than paging.
**Alternate paths**: Agent `mail_grep` with `dateFrom`/`dateTo`; filter "Has attachment" if the email had one.
### Steps
1. `/` → type "payroll-support" → Enter. Results appear newest-first, grouped Today/Earlier; no total count.
2. Scan "Earlier": rows show "Aug 27", "Aug 12"… with no year. She starts reading senders/subjects of near-identical "Payroll update" mails.
3. Scroll to the bottom, click "Load more" → 50 per account added.
4. Click "Load more" again; list grows to ~150 rows. The scroll bar position jumps; no indicator of how far back she is.
5. Row subject and snippet share one line; long subject "Payroll update - Action required: correction to your June statement" hides the snippet, so she opens rows one at a time.
6. In the dialog uses next arrow / `j` to walk the list rather than closing each one.
7. Realises she should add a date; edits search to `payroll-support after:2026/05/31 before:2026/07/01` and presses Enter (works through Gmail syntax; not documented in the UI). The prior pages are discarded and the page resets.
8. Finds the correction; opens it. Back (browser) returns to the list with the same `q` in the URL.
### Variations
- Add `has:attachment` instead of dates.
- Switch tab to one account to cut the page size per click.
### Edge Cases
- "Load more" disappears after the last page with no end marker; she can't tell if 120 is all.
- Cross-account merge order may be slightly off between pages.
- Search max length 500 chars.
- Observed gap: no date filter UI, no recent searches, no sort by oldest.

## STORY-009: Deep link back to the email after an interruption (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Hannah, a customer success lead pulled into a call midway through reading an email
**Goal**: Return to the exact email she was reading after a tab refresh / Back press.
**Preconditions**: Email opened via search (so it's not in the default list).
**Ideal path**: 2 — browser Back/refresh restores `?q=` and `?mail=`.
**Alternate paths**: Search again from scratch.
### Steps
1. Search "board deck" → open an Aug email from results; URL contains both `q` and `mail`.
2. Interrupted; browser tab reloads (or she navigates elsewhere in the app via sidebar).
3. Returns by clicking the sidebar "Inbox" button → `/app/inbox` without params: the plain 14-day list, no sign of the search or the open email. She wonders where it went.
4. Presses browser Back → URL with `q` and `mail` returns; list and dialog restore.
### Variations
- If she opens the dialog and picks a different filter, `mail` clears (list-param change drops it).
### Edge Cases
- Archived or marked-read in the meantime: the row changes under her.
- Observed gap: no "recent / last viewed" list and no history of searches; only browser history helps.
