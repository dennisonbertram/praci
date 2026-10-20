# UX Path Catalog: Praci Inbox

Generated: 2026-10-14
Total Stories: 62 (71 before deduplication; 9 merged)
Coverage: 90% of discovery.md features have at least one story (77% fully covered, 8 partial, 6 gaps), 62 features assessed
Branch: ux/inbox-email-audit
Sources: docs/ux-paths/discovery.md and 8 topic files in docs/ux-paths/topics/. Global IDs run STORY-001..062 in topic order. Cross-references inside stories were rewritten to global IDs.

Corrections applied (filter-and-narrow wins over discovery.md): a Gmail filter (Unread, Starred, Has attachment, Primary...) and search text DO combine and are AND-ed into one Gmail query. Picking a triage category or the Important toggle silently clears BOTH `filter` and `q` (and empties the search box). Typing a search or picking a Gmail filter clears only `view`/`category`. Also: Needs reply grouping and Archive survive in category and Important views; only filter/search lists lose them. "Clear filter" in the empty state does not clear `q`. The account tab is component state, not URL state.

## Summary

| Type | Count |
|---|---|
| short | 17 |
| medium | 34 |
| long | 11 |
| **Total** | **62** |

| Topic | short | medium | long | Total | Before dedupe |
|---|---|---|---|---|---|
| find-specific-email | 2 | 4 | 2 | 8 | 9 |
| search-gmail-syntax | 1 | 3 | 1 | 5 | 9 |
| filter-and-narrow | 4 | 4 | 1 | 9 | 9 |
| triage-long-list | 2 | 6 | 1 | 9 | 9 |
| read-with-context | 2 | 5 | 1 | 8 | 9 |
| act-on-email | 3 | 5 | 2 | 10 | 10 |
| keyboard-power-use | 2 | 3 | 1 | 6 | 8 |
| empty-error-sync-states | 1 | 4 | 2 | 7 | 8 |

Merged (kept story first): STORY-015 <- find-specific-email:4; STORY-015 <- search-gmail-syntax:4; STORY-002 <- search-gmail-syntax:1; STORY-007 <- search-gmail-syntax:5; STORY-052 <- search-gmail-syntax:7; STORY-011 <- keyboard-power-use:8; STORY-027 <- read-with-context:2; STORY-010 <- empty-error-sync-states:8; STORY-024 <- keyboard-power-use:1.

Merge rationale: the removed story had the same goal and path as the kept one. Unique details from each removed story are kept in a "Catalog note" under the kept story.

## Coverage Matrix

Coverage = features in discovery.md with at least one story: 56/62 = 90%. Fully covered: 48 (77%). Partial: 8. Gaps: 6.

| # | Feature (from discovery.md) | Status | Stories |
|---|---|---|---|
| 1 | Sidebar Inbox button + unread badge | Covered | 001, 023, 027, 029, 056 |
| 2 | Open message via `?mail=` deep link / Back | Covered | 008, 034, 051 |
| 3 | URL state for q / filter / view / category | Covered | 008, 015, 022 |
| 4 | Chat email cards open the message dialog | Covered | 006, 034, 046 |
| 5 | Inbox agent panel (create / collapse / show) | Covered | 006, 046, 047 |
| 6 | Connect mail -> Integrations overlay round trip | Covered | 056 |
| 7 | Grouped sections Needs reply / Today / Earlier | Covered | 001, 025, 030 |
| 8 | One row per thread vs single-message dialog | Covered | 032, 037 |
| 9 | Search box submit / Enter / empty draft | Covered | 002, 009, 010 |
| 10 | Search Esc / Clear X / `/` focus | Covered | 002, 010, 052 |
| 11 | Search Load more (50 per account) | Covered | 007 |
| 12 | Gmail operators in search | Covered | 007, 009, 013 |
| 13 | Gmail live filters Unread / Starred / Has attachment | Covered | 014, 020, 021 |
| 14 | Gmail tabs Primary / Promotions / Social / Updates | Covered | 016 |
| 15 | Triage category filters | Covered | 013, 017 |
| 16 | Important toggle vs Important filter item | Covered | 017, 018 |
| 17 | Filter + search combination rules | Covered | 015, 020, 021 |
| 18 | Account tabs (multi-account) | Covered | 005, 019, 043 |
| 19 | Filter Clear / empty-state clear buttons | Covered | 010, 014, 021 |
| 20 | 14-day window, 200-row cap, no Load more on default list | Covered | 003, 013, 020 |
| 21 | Mark read / unread (row, dialog, More menu) | Covered | 023, 027 |
| 22 | Archive (row button, dialog button, `e`, More menu) | Covered | 011, 023, 024, 033 |
| 23 | Mark important / Mark noise per sender + Undo toast | Covered | 026, 029 |
| 24 | To do card (expand, tick, due colours, 24 h) | Covered | 028 |
| 25 | Message dialog prev/next, neighbour after archive | Covered | 032, 033 |
| 26 | Dialog header fields (to / cc / date; Bcc absent) | Covered | 032, 038 |
| 27 | HTML body, sandboxed iframe, remote images, text fallback | Covered | 035 |
| 28 | Attachment chips and download (25 MB cap, failure alert) | Covered | 036 |
| 29 | Compose New message (icon, `c`, From picker) | Covered | 043, 049, 054 |
| 30 | Reply / Reply all / Forward | Covered | 040, 041, 042 |
| 31 | Composer attachments (limits, drag-drop, forward re-attach) | Covered | 042, 049 |
| 32 | Draft autosave, close, recall, Discard + Undo | Covered | 045 |
| 33 | Outbox: undo send, Sent, failure / unknown outcomes | Covered | 041, 044 |
| 34 | Inbox agent tools (search, grep, draft, modify with approval, show_emails) | Covered | 006, 046, 047 |
| 35 | Triage consent card (Allow) | Covered | 060 |
| 36 | Triage pending polling / reshuffle | Covered | 001, 025, 061 |
| 37 | Triage OFF (no model) menu differences | Covered | 016, 018 |
| 38 | Loading skeletons | Covered | 056, 057 |
| 39 | Empty states: no account / No mail / no results / no filter match | Covered | 010, 021, 056, 057 |
| 40 | Sync error banners (Couldn't reach / needs reconnect) + Try again | Covered | 058, 059 |
| 41 | Failed optimistic actions (archive / read / mark rollback) | Covered | 062 |
| 42 | List keyboard: j k arrows Enter o / c e ? | Covered | 024, 050, 051, 052, 053, 054 |
| 43 | Dialog keyboard: j k e r a f Esc | Covered | 033, 040, 050, 055 |
| 44 | Focus return to row after dialog close | Covered | 033, 051 |
| 45 | Touch / phone: More menu, full-screen dialog | Covered | 031, 039 |
| 46 | Narrow-container layout (@md/@xl/@3xl) and truncation | Covered | 019, 021, 031 |
| 47 | Noise rows muted; excluded from Needs reply and to-dos | Covered | 026 |
| 48 | Row badges Needs attention / Newsletter / Spam / Junk | Partial | 013, 025 |
| 49 | Suspicious-sender triangle on rows | GAP | - |
| 50 | Time formats (h:mm AM, Mon D, no year) | Partial | 002, 007, 013 |
| 51 | Sync on mount / syncedAt never shown | Partial | 029, 057, 058 |
| 52 | Settings: Ask before email actions / AI data sharing | Partial | 047, 060 |
| 53 | Remote-images preference setting | Partial | 035 |
| 54 | Compose recipient validation, Cc/Bcc reveal, quoted-text toggle | Covered | 040, 041, 049 |
| 55 | Account tab fallback to All on error / removed account | Partial | 019 |
| 56 | Sorting / saved searches / recent searches (absent features) | Partial | 006, 007, 022 |
| 57 | Mobile (Expo) inbox: sections, account picker, To do, Connect mail | GAP | - |
| 58 | Electron desktop host (same UI; shell, focus, deep links) | GAP | - |
| 59 | Accessibility: screen-reader names, focus trap, tab order, contrast | GAP | - |
| 60 | Window-resize transitions and dark/light themes | GAP | - |
| 61 | Concurrent edits (Gmail changed elsewhere; stale list on tab focus) | GAP | - |
| 62 | Chat email card actions (reply from card, no archive) end to end | Partial | 046 |

Gaps (no story): Suspicious-sender triangle on rows; Mobile (Expo) inbox: sections, account picker, To do, Connect mail; Electron desktop host (same UI; shell, focus, deep links); Accessibility: screen-reader names, focus trap, tab order, contrast; Window-resize transitions and dark/light themes; Concurrent edits (Gmail changed elsewhere; stale list on tab focus).

## Story Dependency Graph

Read top to bottom. A story should run after its parent. "MUTATES" stories archive, mark or send mail and should run on a reseeded test mailbox; "failure injection" stories need offline mode or a revoked token.

```
STORY-056  First visit, no Gmail, Connect mail round trip        [fixture: account connected]
  |
  +-- STORY-057  Empty mailbox vs still syncing
  +-- STORY-058  "Couldn't reach Gmail." with a blank list        [needs failure injection]
  +-- STORY-059  "Gmail needs to be reconnected."                  [needs revoked-token fixture]
  |
  +-- STORY-001  Spot an email in the default list                 [needs seeded mail, ~60 rows]
        |
        +-- Reading
        |     +-- STORY-032  Open latest reply, look for history
        |     +-- STORY-035  HTML body / remote images
        |     +-- STORY-036  Attachment download
        |     +-- STORY-038  Recipient truncation / Bcc
        |     +-- STORY-034  Deep link and Back
        |     +-- STORY-039  Phone-width cold read
        |     +-- STORY-033  j/k neighbour walk + Archive in the reader  (MUTATES)
        |           +-- STORY-051  Close dialog, keep place
        |           +-- STORY-050  Open/triage/reply inside dialog
        |
        +-- Search                                          [read-only, run before archive stories]
        |     +-- STORY-002  Search by sender, then clear
        |     |     +-- STORY-009  Gmail operators
        |     |     +-- STORY-010  No results, recover
        |     |     +-- STORY-011  Archive vanishes during search/filter
        |     |     +-- STORY-052  Keyboard + search box
        |     |     +-- STORY-007  Page through results (Load more)
        |     |           +-- STORY-012  Long hunt across accounts   [needs 2+ accounts]
        |     |           +-- STORY-013  Categories vs search for old mail  [needs triage ON]
        |     +-- STORY-003  14-day / 200-row wall
        |     +-- STORY-008  Deep link back after interruption
        |
        +-- Filtering
        |     +-- STORY-014  Unread filter and Clear
        |     |     +-- STORY-015  Filter + search, lose it to a category
        |     |     +-- STORY-021  Empty result, wrong clear button
        |     |     +-- STORY-022  Bookmarked filtered view
        |     |     +-- STORY-016  Gmail tabs                   [best with triage OFF]
        |     +-- STORY-019  One account at a time               [needs 2 accounts]
        |     +-- STORY-004 / 005  Keyboard scan; multi-account find
        |     +-- STORY-020  Long narrowing afternoon            [after N1, N2, F8]
        |
        +-- Triage and read state                            [MUTATES: run last on a reseeded mailbox]
              +-- STORY-023  Archive first newsletter
              |     +-- STORY-024  Keyboard sweep (j/k/e)
              |     +-- STORY-053  Discover shortcuts with ?
              |     +-- STORY-054  Compose with c
              +-- STORY-027  Reading state / mark read-unread
              +-- STORY-026  Mark noise per sender + Undo
              +-- STORY-028  To do card
              +-- STORY-031  Phone-width triage
              +-- STORY-029  Full triage pass of 200            [after T1, T2, T4, T5, T6]
              +-- STORY-055  Keyboard end-to-end                 [after T2, K3, K5]

Triage-dependent branch (requires consent and a usable model)
STORY-060  Consent card ("Let Praci sort your mail")
  +-- STORY-061  List reshuffles while triage runs
  +-- STORY-025  Which need a reply
  +-- STORY-030  Cold first look
  +-- STORY-017  Triage categories
  +-- STORY-018  Two different "Important"s        [also needs triage OFF -> ON switch]

Acting branch (sends real mail: use a test recipient)
STORY-040  Quick reply (keyboard)
  +-- STORY-041  Reply all + Undo send
  +-- STORY-042  Forward with attachment
  +-- STORY-043  Compose from second account         [needs 2 accounts]
  +-- STORY-044  Send fails / unknown outcome         [needs failure injection]
  +-- STORY-045  Close mid-sentence, recall draft
  +-- STORY-049 Bad recipient, oversize attachment
  +-- STORY-037  Reply while unsure about earlier thread
STORY-006  Ask the Inbox agent for a vague email
  +-- STORY-046  Agent finds urgent mail, show cards
        +-- STORY-047  Agent drafts reply, approval
STORY-048  Burn down Needs reply      [after A1, A2, A3, T6, E6]
STORY-062  Archive/mark read fails after row moved   [needs failure injection; run last]
```
Recommended run order: E1, E2, F1, F2, S2, S3, F8, N1, N2, N8, N9, F3, F9, read group (R1, R5, R6, R8, R4, R9), E5, E6, T3, T8, N4, N5, N3, N6, F5, F6, S8, S9, N7, K5, A-group, F7, A7, A8, then mutating T1 to T7, R3, K-group, A9, then failure-injection stories E3, E4, E7, A5 last.

## Recurring Defects

Ranked by number of stories that hit the defect (after dedupe). "Code-verified" means a topic agent cited the source line; "inferred" means it should be confirmed in the browser.

| Rank | Count | Defect | Stories | Evidence |
|---|---|---|---|---|
| 1 | 14 | Archive silently disabled under search or Gmail filter (row button, dialog button and `e`; Help still lists `e`) | 002, 011, 012, 014, 016, 020, 022, 024, 029, 033, 048, 052, 053, 055 | Code-verified (`Inbox.tsx:380,650,692-700`). Browser: confirm no tooltip or message, and that category/Important views DO allow Archive (filter-and-narrow says yes). |
| 2 | 13 | 14-day / 200-row cap on the default list and category views with no cue (no 'last 14 days', no end of list, no Load more) | 002, 003, 005, 006, 010, 012, 013, 014, 015, 017, 020, 029, 057 | Code-verified (`WINDOW_MS`, `MAX_ROWS`). The claim that 80 mails/day shrinks the window to 2-3 days is inferred; verify in browser. |
| 3 | 11 | Triage reshuffle is silent: rows jump between groups and under the cursor, no 'sorting' indicator, dialog next/prev order changes | 001, 012, 017, 024, 025, 029, 033, 046, 048, 055, 061 | Polling constants code-verified (5 s, 6 polls); visible row jumping is inferred; verify in browser with fresh unclassified mail. |
| 4 | 11 | No attachment indicator or account indicator on list rows (also dialog shows no account) | 001, 004, 005, 009, 012, 019, 020, 029, 036, 037, 043 | Code-verified (`InboxRow.tsx` has neither). |
| 5 | 10 | Keyboard Help is incomplete and undiscoverable (no `?` affordance; omits `o`, arrows, `?`; does not say r/a/f/j/k/e are dialog keys; no Esc-to-clear) | 002, 004, 011, 024, 033, 040, 050, 052, 053, 055 | Code-verified (`InboxShortcuts.tsx`). |
| 6 | 7 | Picking a triage category or the Important toggle silently clears BOTH filter and search (Gmail filter + search do combine); no chip or message says what is narrowing the list | 010, 012, 013, 015, 017, 020, 021 | Code-verified by filter-and-narrow (`setInboxListParam`); discovery text was wrong. Two topic files still hold the old claim (see Catalog notes). Confirm in browser, including whether the search box empties. |
| 7 | 7 | No bulk actions and no keyboard shortcuts for mark read/unread or mark important/noise (60 rows = 60 clicks; no select-all) | 011, 024, 027, 029, 050, 053, 055 | Code-verified. |
| 8 | 7 | Sync/list error banner is generic: no account named, no Reconnect action, Try again only re-syncs (not the failed action) | 005, 019, 023, 044, 058, 059, 062 | Code-verified (`inbox-sync-error.ts`). |
| 9 | 7 | No counts anywhere on the page: group headings, search/filter results, unread total (only the sidebar badge) | 007, 014, 023, 025, 027, 029, 030 | Code-verified. |
| 10 | 6 | No thread view: row is a thread but the dialog shows one message; no thread count; prev/next chevrons move between threads; read/unread asymmetry (thread vs message) | 012, 025, 027, 032, 036, 037 | Code-verified (`oneRowPerThread`, `inbox.get`). |
| 11 | 6 | Search discoverability: Gmail operators work but are never mentioned; submit-only; no suggestions on empty results | 002, 007, 009, 010, 013, 015 | Code-verified. |
| 12 | 6 | No undo and no confirmation for Archive (toast exists only for marks) | 023, 024, 029, 033, 048, 062 | Code-verified. |
| 13 | 6 | To do card is disconnected: items do not open their email, card hides under any filter/search, duplicates Needs reply | 017, 028, 029, 048, 060, 061 | Code-verified (`TodoCard.tsx` has no open handler). |
| 14 | 5 | Overlapping 'Important'/narrowing concepts (toggle vs Gmail filter vs sender mark vs Needs reply vs badge; Updates vs Notifications) | 016, 017, 018, 025, 030 | Code-verified. |
| 15 | 5 | Icon-only hover actions with no tooltip; mark important/noise are per SENDER but the UI does not say so | 018, 023, 026, 029, 030 | Code-verified (aria-labels only); tooltip absence to be confirmed in browser. |
| 16 | 5 | Triage `reason` and priority exist in data but are never shown (row or dialog) | 017, 025, 026, 030, 037 | Code-verified. |
| 17 | 5 | Account tabs: labels truncate at 160 px, active tab not in URL (lost on reload or shared link) | 005, 012, 019, 022, 043 | Code-verified. |
| 18 | 4 | Opening a message does not mark it read; unread dot and sidebar badge stay until an explicit click | 027, 029, 037, 050 | Code-verified by read-with-context (no `markRead` call on open). Browser check requested. |
| 19 | 4 | Dates show no year (search results can be years old) | 002, 007, 013, 020 | Code-verified (format 'Mon D'). |
| 20 | 4 | No Drafts or Sent view; agent draft cannot be opened in the composer; sent result is only a 3 s toast | 043, 044, 045, 047 | Code-verified. |
| 21 | 4 | Deep link / Back inconsistencies (Back leaves the app after close of a deep-linked message; sidebar Inbox drops search; account tab lost) | 008, 022, 034, 051 | Code-verified; verify in browser. |
| 22 | 4 | Dialog recipient line truncated to one line, Bcc never shown, tooltips unavailable on touch/keyboard | 037, 038, 041, 049 | Code-verified. |
| 23 | 4 | Composer replaces the reader (cannot consult the message while replying); no send-and-next/archive | 037, 040, 048, 054 | Code-verified (`composing && invisible`). |
| 24 | 3 | Focus stays in the search box after Enter so j/k type letters; Esc clears results instead of leaving the box | 012, 024, 052 | Code-verified (`inbox-keyboard.ts:27-28`, `Inbox.tsx:424-428`). |

Note: the original two topic files that said "search wipes a Gmail filter" (find-specific-email 004, search-gmail-syntax 004) are overridden by the correction above.

## To verify in browser

Items topic agents marked inferred, unverified, "verify in the walk", or that conflict between topics. The walker should check each and record the observed result.

1. [027 037 050 029] Opening a message does not mark it read; badge and dot unchanged after close. (Code-verified in one topic, flagged 'verify in the walk' in another and in discovery.)
2. [010] After 'Clear search', does the search box still show the old text? Agents disagree (inferred stale text vs `useEffect` resync).
3. [015 009] Confirm Gmail filter + search combine (Unread + 'harlow') and that picking a category or Important toggle empties both filter and search AND the search box. Two source stories contained the opposite claim.
4. [029 017] Archive in a category or Important view: `filtered` covers only filter/search, so row button and `e` should work; confirm.
5. [040 050 048] Is there a keyboard send shortcut (Cmd/Ctrl+Enter)? act-on-email says yes; keyboard-power-use says none exists.
6. [050] Do dialog shortcuts (j/k/r/a/f/e) stop working after the user clicks inside the sandboxed HTML iframe? (inferred)
7. [024] After `e`, where does DOM focus go (body vs neighbour row)? (inferred)
8. [011] Does the dialog hide Mark read while a filter/search is active (keyboard story) or show it (search story)? Does the row hover mark-read work in search?
9. [052 009] What happens to Esc when focus is on the list (not the box)? Confirm j/k typed into the box after Enter.
10. [043] Changing From after typing: does a stale draft stay in the first account's Drafts? (unverified, needs server check)
11. [041 048] Sending a second message while the first is in its 5 s hold fires the first immediately (Undo lost). Confirm.
12. [044] Closing the tab during the 5 s hold sends nothing (documented in `outbox.ts`); confirm no warning. Also confirm 'Not confirmed as sent' path is reachable offline.
13. [059] Wording mismatch: banner says 'reconnected' while plugin UI may say connect/reauthorize; and whether the list reloads after Integrations closes when opened outside the Inbox's own paused flow. (unverified)
14. [061 001 025] Triage polling: do rows visibly jump under the cursor; does polling stop after about 30 s with partly unsorted rows; does manual Try again restart polling?
15. [018] `?filter=important` in the URL with triage ON: Filter button label 'Important' with no matching radio and the toggle not pressed (code-inferred).
16. [021] `?category=bills` with triage OFF is silently ignored; no label shown (code-inferred).
17. [016] Gmail tab filters when the account has Gmail tabs disabled: empty or everything? (inferred)
18. [008 034] Sidebar Inbox click drops `q`/`mail`; browser Back after closing a deep-linked message leaves the app.
19. [003] With heavy mail the 200-row cap shortens the visible window to a few days (inferred arithmetic); count rows in a seeded mailbox.
20. [006] Agent `mail_search` covers all history while the list covers 14 days; confirm with an old seeded email. Also 'Create Inbox agent' failure text.
21. [004 007 012] Cross-account paging: All-tab Load more may show out-of-order dates (known caveat in code comment).
22. [023 031] Hover double-click archives two rows (row slides under cursor); touch toast covers last rows; More-menu target near time. (observed risks)
23. [026] Second Mark toast replaces the first (first no longer undoable); un-marking via pressed icon shows no toast.
24. [035] HTML mail with blocked remote images: no visible 'Load images' control; two scroll regions.
25. [051] Deep-linked message (no LIST_OPEN): Esc leaves selectedId unset; first `j` selects first row (observed gap).
26. [029] Step 13 of the full triage pass (Newsletters category then Archive) and 'archived mail still found in search' were flagged 'verify in walk'.
27. [039] Non-English locale fallback for 'Next message'/'Previous message' (not verified); cache eviction beyond 40 messages.
28. [046] Replies from a chat card reload the Inbox list behind the panel (silent re-sort); cards cap at 20.
29. [047] 'Always allow this tool' vs settings wording 'email actions'; approval card stale state ('No longer active').

## All Stories (grouped by topic)

Each story keeps its original fields. Headings were renumbered; "Catalog note" and "Related" lines were added by this consolidation.

### Topic: find-specific-email

#### STORY-001: Spot it in the default list (short)
**Type**: short
**Topic**: find-specific-email
**Persona**: Marcus, a property manager who got a "Lease renewal - Unit 4B" email from Harbor Realty this morning
**Goal**: Open that email from the list.
**Preconditions**: Gmail connected, triage ON, ~60 messages in the last 14 days, no filter/search.
**Ideal path**: 3 — scan the Today group, click the row, read it.
**Alternate paths**: Press `/`, type "Harbor", Enter (STORY-002); press `j` repeatedly then `Enter`/`o`.
##### Steps
1. Click sidebar "Inbox" → `/app/inbox`; 5 grey skeleton rows (no text) then list. Marcus sees a "To do" card first, pushing the list down.
2. Scan "Needs reply" then "Today" groups, one 44px line per mail: sender (truncated to ~96-180px), "subject - snippet" on one ellipsised line, time "9:12 AM" → he hesitates: "Harbor Realty" shows as "Harbor Re…" and the subject is cut so the snippet is hidden.
3. Click the row → modal dialog opens, URL gets `?mail=<id>`; subject as title, sender `<address>`, date-time.
##### Variations
- The mail appears twice in mind: it may sit in "Needs reply" (no "Needs attention" badge there by design) and not in "Today" at all; Marcus scrolls past Needs reply wondering if it is missing.
- Triage still pending: rows silently regroup after ~5 s, the row he was about to click jumps.
##### Edge Cases
- Same information (sender/subject) appears in the row and again in the dialog header, but the row carries no attachment icon, so he cannot tell which of two similar rows has the lease PDF.
- Mail arrived but sync hasn't finished: list shows cached rows only; no "last synced" display.


#### STORY-002: Search by sender, then clear (short)
**Type**: short
**Topic**: find-specific-email
**Persona**: Priya, a freelance designer looking for last month's invoice from Acme
**Goal**: Find Acme's invoice email (about 5 weeks old, i.e. outside the 14-day cache).
**Preconditions**: Gmail connected; default list shows only the last 14 days.
**Ideal path**: 4 — `/`, type, Enter, click result.
**Alternate paths**: Filter "Has attachment" then scan (still lists only a Gmail page); ask Inbox agent (STORY-006). Triage category "Receipts"/"Bills" does NOT help: category views use the 14-day cache.
##### Steps
1. Scan "Earlier" for Acme → nothing; list just ends after the last cached row with no "older mail" message. She wonders if the invoice was deleted.
2. Press `/` → search box "Search mail" focuses (no visible hint that `/` exists).
3. Type "Acme invoice", press Enter → URL gets `?q=Acme%20invoice`; search is submit-only, nothing updates while typing. Skeleton rows, then results grouped Today/Earlier (no Needs reply group while searching).
4. She sees an April-style date like "Sep 9" with no year → click the row; dialog opens.
5. Click "Clear" (X) or press Esc in the box → `q` cleared, back to the 14-day list.
##### Variations
- Type `from:acme` — works because the query goes to Gmail as `(query)`, but nothing in the UI says so; Priya only knows if she is a Gmail user.
- Typing then pressing Esc without Enter clears the draft only.
##### Edge Cases
- Observed gap: rows show no year, so an Acme invoice from last September looks identical to one from this September.
- Archive (`e`, row button, dialog button) is disabled during search: she wants to tidy the found mail and the shortcut silently does nothing.

**Catalog note**: Merged from search-gmail-syntax STORY-001 (plain-word invoice search). Added detail: Enter with an empty draft removes `q` and changes nothing; pressing Enter again on an unchanged query gives no feedback; results can be older than 14 days with only "Mon D" shown (no year); nothing says results come from all mail rather than the recent cache, so a later "no result" is ambiguous.
**Related**: STORY-007, STORY-012, STORY-052


#### STORY-003: Hit the 14-day / 200-row wall with no explanation (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Tomás, an operations lead who gets ~80 mails a day and needs the "Q3 vendor contract" thread from three weeks ago
**Goal**: Realise why it isn't in the list and reach it.
**Preconditions**: Heavy inbox; unfiltered view is capped at 200 rows and 14 days, no Load more.
**Ideal path**: 5 — give up scrolling quickly, search, open.
**Alternate paths**: Inbox agent; Gmail itself (outside the app). In-app no "load older" exists.
##### Steps
1. Open Inbox → list of up to 200 rows; at 80/day the cap means the visible window may be only ~2-3 days, not 14.
2. Scroll the "Earlier" group to the bottom (long flat list, only "Mon D" times) → list simply ends; no "Load more", no "showing last 14 days", no end-of-list text. Tomás thinks the app is broken or sync is stuck.
3. Scroll back up and check account tabs (if >1 account: tabs All + one per account) → tab switch re-lists the same capped window per account.
4. Try Filter (icon) → "Unread"/"Starred"/"Has attachment"/"Primary"… selecting one switches to live Gmail with "Load more" (50 per account per page). First inkling that filters reach further back than the plain list.
5. Click "Load more" repeatedly → each click appends 50 per account; rows de-duplicated by thread. He is paging by hand through year-old mail.
6. Instead types "contract Q3" into Search mail, Enter → picking search replaced the filter (mutually exclusive); results appear; opens the thread's latest message.
##### Variations
- Triage OFF (no model): filter menu lacks category radios; "Important" is a Gmail filter item.
- With the To-do card present the list is shoved below the fold, making the scroll even longer.
##### Edge Cases
- Cap is silent: rows 201+ of the last 14 days are also invisible with no signal.
- Observed gap: no date-range picker, no jump-to-date, no sort.
- Cross-account paging caveat in search merge (`inbox.ts` ~L196-200): All-tab pages may show out-of-order dates.

**Related**: STORY-006, STORY-013, STORY-017, STORY-020, STORY-057


#### STORY-004: Narrowing a crowded Earlier list by scanning with the keyboard (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Jun, an accountant with 150 rows who remembers only "a shipping notice with a tracking number, sometime last week"
**Goal**: Find it without a sender or subject.
**Preconditions**: Triage ON, no filter, list ~150 rows.
**Ideal path**: 5 — Filter > Notifications (or search "tracking"), scan, open.
**Alternate paths**: `j`/`k` scan; search "tracking number" or "shipped"; agent.
##### Steps
1. Press `j` → first row selected (left border + bg); `k` goes back. He holds `j` to scan, but the selection scrolls and each row is one cramped line.
2. Row subjects start with order-bot text "Your order has shipped - …" but sender "no-reply@…" truncates; five rows look identical. He hesitates, unsure which store.
3. Press `Enter` or `o` → dialog opens; `j`/`k` now mean next/previous message in the same list. He walks messages one by one.
4. Esc → dialog closes, selection stays.
5. Gives up, opens Filter > "Notifications" → cached category list (14 days) shrinks to ~20 rows, still all similar.
6. Types "tracking" in Search mail → Enter → results from live Gmail; picks one.
##### Variations
- Noise-marked senders render muted, so a legitimate store he marked noise earlier is hard to see.
##### Edge Cases
- Shortcuts are disabled while typing and while any dialog is open; `?` opens "Keyboard shortcuts" but no UI button shows it exists, and it omits `o` and arrow keys.
- Observed gap: no attachment, thread-count or account indicator on rows to tell near-duplicates apart.


#### STORY-005: Multi-account — the right mail in the wrong place (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Elena, a consultant with work@elenaco.example and personal@mailbox.example connected
**Goal**: Find a flight confirmation she forwarded to her personal account.
**Preconditions**: Two Gmail accounts connected; "All" tab selected.
**Ideal path**: 4 — search "flight confirmation" from All, open.
**Alternate paths**: Per-account tabs; agent (searches across accounts).
##### Steps
1. See tabs "All", "work@elenaco.example", "personal@mailbox.example" (labels truncate at ~160px) under the toolbar.
2. Scan All: rows don't show which account they belong to. Two near-identical "Itinerary" mails appear; she can't tell which is the original.
3. Click the personal tab → list narrows; the original's still nowhere (older than 14 days).
4. Search "flight confirmation" with the personal tab active → 50 per account per page; result appears.
5. Open it, dialog shows from/to/date but not which account it was delivered to.
6. She presses `r` to reply; composer From defaults to the current tab's account (`connectionId={tab}`). If she was in All, the default may not be the account she expects.
##### Variations
- One account needs reconnecting: global banner "Gmail needs to be reconnected." with Try again and no account named; she doesn't know that half her mail is missing from All.
##### Edge Cases
- Partial sync failure shows cached rows below the banner, so the list looks complete but isn't.
- Information duplicated: account name appears in the tab and the composer From picker, never on the row.

**Related**: STORY-012, STORY-019, STORY-043, STORY-059


#### STORY-006: Ask the Inbox agent for a vaguely-remembered email (long)
**Type**: long
**Topic**: find-specific-email
**Persona**: Ravi, a sales director who remembers "an email from a Berlin supplier about a price change, maybe spring" and has no sender name
**Goal**: Find and open the email through the Inbox agent, then act on it.
**Preconditions**: Inbox agent exists (otherwise "Create Inbox agent"); panel may be collapsed (default on phones; "Show Inbox agent" button).
**Ideal path**: 7 — ask once, open the email card, read.
**Alternate paths**: Search mail with guessed keywords ("price" "Berlin"), repeated; Gmail outside the app.
##### Steps
1. Ravi scrolls the list for a minute; nothing because the mail is months old and the plain list stops at 14 days. He doesn't know why.
2. Notices the right panel; if collapsed, clicks "Show Inbox agent". If no agent exists, clicks "Create Inbox agent" (error text "Could not create the Inbox agent" on failure).
3. Types in the agent chat: "Find the email from a Berlin supplier about a price increase around spring." → agent runs `mail_search` (Gmail-syntax queries, date-less queries cover all history) then `mail_grep` on the saved results.
4. Agent summarises candidates and calls `show_emails`, rendering email cards in chat (max 20, grouped by urgency; "later" as a compact list).
5. Ravi hesitates: three candidate cards with similar subjects; the cards, like list rows, carry only partial context.
6. Clicks a card → opens the same message dialog (no filters, no Archive/Mark read from chat cards).
7. Reads body in sandboxed iframe, spots the PDF attachment chip, downloads.
8. Back in list, the mail still isn't in the Inbox view; the URL `?mail=<id>` is the only handle. He copies the address bar to find it again.
9. Asks the agent "archive the other two Berlin ones" → `mail_modify` needs approval (setting "Ask before email actions"); no trash/delete possible.
##### Variations
- Agent is also reachable with the panel collapsed via the toolbar icon "Show Inbox agent"; "Collapse Inbox agent" hides it again.
- If the agent needs a model and none is configured, triage is off but the agent flow is separate.
##### Edge Cases
- The agent covers all history while the list covers 14 days; nothing in the list explains this split, so the best tool for old mail is the least discoverable.
- Same finding is represented in 3 surfaces (agent text, cards, dialog) with different context.
- Observed gap: no "save this search", no way to pin a found email, no starred indicator on rows.

**Related**: STORY-003, STORY-013, STORY-017, STORY-020, STORY-046, STORY-047, STORY-057


#### STORY-007: Page through search results to find the oldest match (long)
**Type**: long
**Topic**: find-specific-email
**Persona**: Grace, an HR manager gathering every email from "payroll-support" over the past 6 months for an audit
**Goal**: Locate a specific payroll correction email she remembers being sent in June.
**Preconditions**: Gmail connected; ~120 matching mails; two accounts.
**Ideal path**: 8 — refine the search with a date operator rather than paging.
**Alternate paths**: Agent `mail_grep` with `dateFrom`/`dateTo`; filter "Has attachment" if the email had one.
##### Steps
1. `/` → type "payroll-support" → Enter. Results appear newest-first, grouped Today/Earlier; no total count.
2. Scan "Earlier": rows show "Aug 27", "Aug 12"… with no year. She starts reading senders/subjects of near-identical "Payroll update" mails.
3. Scroll to the bottom, click "Load more" → 50 per account added.
4. Click "Load more" again; list grows to ~150 rows. The scroll bar position jumps; no indicator of how far back she is.
5. Row subject and snippet share one line; long subject "Payroll update - Action required: correction to your June statement" hides the snippet, so she opens rows one at a time.
6. In the dialog uses next arrow / `j` to walk the list rather than closing each one.
7. Realises she should add a date; edits search to `payroll-support after:2026/05/31 before:2026/07/01` and presses Enter (works through Gmail syntax; not documented in the UI). The prior pages are discarded and the page resets.
8. Finds the correction; opens it. Back (browser) returns to the list with the same `q` in the URL.
##### Variations
- Add `has:attachment` instead of dates.
- Switch tab to one account to cut the page size per click.
##### Edge Cases
- "Load more" disappears after the last page with no end marker; she can't tell if 120 is all.
- Cross-account merge order may be slightly off between pages.
- Search max length 500 chars.
- Observed gap: no date filter UI, no recent searches, no sort by oldest.

**Catalog note**: Merged from search-gmail-syntax STORY-005 (Load more on a broad query, 3 accounts). Added detail: Load more disables with no spinner or text change; newer-looking mail can appear below older rows (cross-account paging caveat, `inbox.ts:196-200`); a Load more failure shows the global banner and Try again re-lists instead of retrying the page; switching tab mid-load drops the response (keyRef guard); no total count and no end-of-results marker.
**Related**: STORY-002, STORY-012, STORY-052


#### STORY-008: Deep link back to the email after an interruption (medium)
**Type**: medium
**Topic**: find-specific-email
**Persona**: Hannah, a customer success lead pulled into a call midway through reading an email
**Goal**: Return to the exact email she was reading after a tab refresh / Back press.
**Preconditions**: Email opened via search (so it's not in the default list).
**Ideal path**: 2 — browser Back/refresh restores `?q=` and `?mail=`.
**Alternate paths**: Search again from scratch.
##### Steps
1. Search "board deck" → open an Aug email from results; URL contains both `q` and `mail`.
2. Interrupted; browser tab reloads (or she navigates elsewhere in the app via sidebar).
3. Returns by clicking the sidebar "Inbox" button → `/app/inbox` without params: the plain 14-day list, no sign of the search or the open email. She wonders where it went.
4. Presses browser Back → URL with `q` and `mail` returns; list and dialog restore.
##### Variations
- If she opens the dialog and picks a different filter, `mail` clears (list-param change drops it).
##### Edge Cases
- Archived or marked-read in the meantime: the row changes under her.
- Observed gap: no "recent / last viewed" list and no history of searches; only browser history helps.

**Related**: STORY-022, STORY-034, STORY-051



### Topic: search-gmail-syntax

#### STORY-009: Operators work, but nobody told her
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Tobias Lindqvist, ops manager at a small logistics firm, 20 vendor threads a day
**Goal**: Narrow to PDFs from one vendor since the start of the month.
**Preconditions**: Gmail connected; search box empty.
**Ideal path**: 4 — click, type one operator query, Enter, scan.
**Alternate paths**: Filter menu "Has attachment" (single-select, cannot combine with a sender); Inbox agent chat in natural language.
##### Steps
1. Click the "Search mail" box → caret, placeholder only. No hint, tooltip, example chips or help link; Tobias has used Gmail for years so he guesses.
2. Type `from:dockline has:attachment filename:pdf after:2026/10/01` → accepted (max 500 chars, `MAX_QUERY`).
3. Press Enter → server wraps as `(from:dockline has:attachment filename:pdf after:2026/10/01)` and sends it to Gmail (inbox.ts ~268). URL gets `?q=...`.
4. Results appear: rows are one-line, 44 px; sender, subject-plus-snippet, time. There is no attachment icon on rows, so he cannot tell at a glance which result carries the PDF he searched for (gap).
5. Opens first result with Enter/`o`... he must first arrow with `j`/`k` (selected row) then Enter → message dialog with attachment chip (filename, size).
6. Presses Esc in the dialog → closes; focus returns to the row (wasOpen effect).
##### Variations
- Misspelled operator (`form:dockline`) → Gmail treats it as text; likely `No results for "form:dockline"` with no "did you mean".
- Quotes and `OR`/`-` work the same as Gmail, again undocumented.
##### Edge Cases
- Query text is echoed in the empty state exactly as typed, including operators, so long queries make a long unwrapped sentence.
- Information on multiple surfaces: "Has attachment" exists as a Filter menu item AND as an operator; the two cannot be mixed because choosing one clears the other (setInboxListParam).

**Catalog note**: CORRECTION: the edge case claiming the Has attachment filter and the `has:attachment` operator cannot be mixed is wrong. A Gmail filter and search text DO combine (both kept in the URL and AND-ed). See the corrections in the filter-and-narrow group. The undiscoverable-operators finding stands.


#### STORY-010: No results, then recover
**Type**: short
**Topic**: search-gmail-syntax
**Persona**: Priya Raman, clinic office coordinator, stressed, in a hurry
**Goal**: Find an email from "Dr Okafor"; the search finds nothing and she needs a way back.
**Preconditions**: Search box empty.
**Ideal path**: 3 — Enter, read empty state, click "Clear search".
**Alternate paths**: Esc in the input; the "Clear" X button; sidebar Inbox button (probably keeps URL params, unverified); browser Back.
##### Steps
1. Type `subject:okafor referral` and Enter → skeleton, then centered text `No results for "subject:okafor referral"` and an outline "Clear search" button.
2. She thinks "did I misspell it?" Nothing suggests loosening the query or searching sender; no count, no "searched all mail" statement.
3. Click "Clear search" → `q` removed, the default last-14-days list returns, still grouped Needs reply / Today / Earlier. Her typed text vanishes from the box? draft is state; "Clear search" button only changes URL param, so the box may still show the old text (code: only the X and Esc call setDraft("")). Observed risk of stale text in the box.
##### Variations
- Press Esc inside the box instead: draft and `q` both cleared.
- Click the X (aria "Clear"): clears, and focus goes back to the input.
##### Edge Cases
- If Gmail fails for the account, the empty state is suppressed (`failed ? null`) and the red banner with "Try again" shows instead, so "no results" is never claimed falsely.

**Catalog note**: Merged from empty-error-sync-states STORY-008 (search/filter come up empty). Added detail: an empty category (e.g. Bills) shows "No mail matches this filter" + "Clear filter" (`clearFilters`); a network failure while searching suppresses the empty message and shows only the banner; "No mail matches this filter" also appears for the Important toggle although no menu item is chosen; category views cover only the cached 14 days and the message does not say so. VERIFY: the search-agent inferred that "Clear search" leaves the old text in the box; the filter-agent found the box re-syncs from the URL (`useEffect(() => setDraft(query), [query])`, Inbox.tsx:172), which implies it empties.
**Related**: STORY-013, STORY-015, STORY-020, STORY-021, STORY-057


#### STORY-011: Archive vanishes during search
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Daniel Okoye, sales director who clears mail by keyboard
**Goal**: Search for newsletters from one sender and archive them all.
**Preconditions**: Gmail connected.
**Ideal path**: n/a in search — Archive is unavailable; ideal would be 4 steps if allowed. Real route: search to find, then clear search and archive from the default list (only works for last 14 days).
**Alternate paths**: Inbox agent `mail_modify` (approval required; archives/labels); mark read via row hover button works in search.
##### Steps
1. Search `from:dailydigest.example` + Enter → results.
2. Hover a row → hover buttons: Mark read/unread present; Archive absent (`onArchive` undefined when filtered). No tooltip explains why.
3. Press `j` to select a row, then `e` → nothing happens, silently (archive: filtered ? undefined).
4. Opens the row with Enter → dialog actions: Reply, Reply all, Forward (and read toggle); no Archive button.
5. Presses `e` in the dialog → nothing.
6. Frustrated, clears with Esc in the search box; default list returns, but old digests older than 14 days are not there to archive. Gap: no bulk select, no "archive all results", no explanation text.
##### Variations
- With triage on, "Mark noise" per sender is available in search, partially replacing the need.
##### Edge Cases
- Rows read-marked in search update optimistically; if it fails, the banner shows and the list reloads.
- Same missing-archive behavior applies with any Filter menu choice (`filtered` includes filter).

**Catalog note**: Merged from keyboard-power-use STORY-008 (archive from the dialog while filtered). Added detail: the dialog opened from a filtered list shows Reply/Reply all/Forward but no Archive; `r` still works while `e` does not, so the user concludes only `e` is broken; the Help dialog still lists `e Archive` with no caveat; switching filter while reading closes the dialog (`mail` cleared). VERIFY: this story says mark-read works on the row in search, while the keyboard story says the dialog omits mark-read when filtered.
**Related**: STORY-014, STORY-024, STORY-033, STORY-052


#### STORY-012: Long hunt across accounts, tabs, dialog and back
**Type**: long
**Topic**: search-gmail-syntax
**Persona**: Rosalind Achebe, chief of staff, 2 work accounts plus a personal one, hundreds of unreads, overwhelmed by rows that all look alike
**Goal**: Locate a travel itinerary a colleague forwarded, confirm the date, reply, and return to where she was.
**Preconditions**: 3 accounts; "All" tab; triage on (Important toggle and category filter visible).
**Ideal path**: 12 — one operator search, open, reply, Esc back.
**Alternate paths**: Inbox agent chat (ask in plain language); chat email cards open the same dialog but with no archive; Filter menu "Has attachment".
##### Steps
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
##### Variations
- After step 10 the list reload may reorder rows, losing her place.
- Use the Important toggle mid-way: search is dropped silently.
##### Edge Cases
- Account tab labels truncate at 160 px; two work accounts with similar names look identical.
- Reply to a thread row replies to the opened message only; no thread view (gap).
- Same itinerary info appears on three surfaces: row snippet, dialog body, attachment chip; row never hints an attachment exists.

**Related**: STORY-002, STORY-005, STORY-007, STORY-019, STORY-043, STORY-052, STORY-059


#### STORY-013: Searching with the wrong tool — older mail, triage categories
**Type**: medium
**Topic**: search-gmail-syntax
**Persona**: Kwame Boateng, accountant at tax season, receives receipts constantly
**Goal**: Pull all receipts from vendor X of the last year.
**Preconditions**: Triage on; "Receipts" category in Filter menu.
**Ideal path**: 3 — search `from:vendorx receipt after:2025/10/14`.
**Alternate paths**: Filter menu category "Receipts" (cached 14 days only).
##### Steps
1. Open Filter, choose "Receipts" → only 14 days of cached, classified mail; Kwame thinks that is everything.
2. He asks himself why last year's receipts are missing; no copy says the category is limited to 14 days.
3. Types `vendorx receipt after:2025/10/14` in search, Enter → category dropped (setInboxListParam clears view/category when q is set); live Gmail results spanning a year; rows are unlabeled with "Mon D" only, so 2025 and 2026 dates look the same.
4. Clicks "Load more" twice to page back; looks for sorting by amount or date: none exists (newest first only).
##### Variations
- Searches with `category:` operator: Gmail's own tabs, not triage categories; names overlap ("Promotions"), confusing.
##### Edge Cases
- Triage labels (Newsletter, Needs attention, Spam/Junk) show on search rows only if the message is cached with classification; older ones show none, so rows look inconsistent.

**Related**: STORY-003, STORY-006, STORY-010, STORY-015, STORY-017, STORY-020, STORY-021, STORY-057



### Topic: filter-and-narrow

#### STORY-014: Show only unread after a long weekend
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Marisol Okafor, operations manager, one Gmail account, 140 messages since Friday, triage ON
**Goal**: See only the messages she has not read, then get back to everything.
**Preconditions**: Signed in, one account connected, triage enabled and consented, 14-day cache populated.
**Ideal path**: 3 — open Filter, pick Unread, (later) Clear.
**Alternate paths**: Sidebar "Inbox" badge count shows the unread number but is not clickable to filter (it opens the inbox, unfiltered). Deep link `/app/inbox?filter=unread` (`readInboxListState`). Agent panel: ask "show unread" (email cards, no list filter).
##### Steps
1. Click the icon-only Filter button (aria "Filter", `data-testid="inbox-filter"`) next to the "Important" toggle → radio menu opens with 3 groups of items; no group headings, only separators.
2. Click "Unread" (thinking: "Is this Gmail unread or Praci unread?") → menu closes (`closeOnClick`); `?filter=unread`; five skeleton rows while live Gmail query `is:unread` runs; then list; Needs reply group is gone, rows now just Today / Earlier. The button now reads "Unread" with a filled style.
3. Scan rows; notice no Archive hover button → Archive and the `e` key are disabled while a Gmail filter is on (`archive: filtered ? undefined`, Inbox.tsx:380,650).
4. Open Filter again, click "Clear" at the bottom (only present when active) → back to the default grouped list with To do card.
##### Variations
- Picking the already-selected "Unread" radio does not toggle it off; user must find "Clear" at the bottom of the menu (hesitation: "how do I turn this off?").
- Triage OFF: "Important" appears in the first group as a Gmail filter instead (see STORY-018).
##### Edge Cases
- Unread filter reads live Gmail, not the 14-day cache, so it can show mail older than 14 days that the default list does not show; no cue says so.
- Marking a row read while filtered patches it optimistically but the row stays in the Unread list until reload (`patchRows`, Inbox.tsx:216).
- Same information on multiple surfaces: sidebar badge count vs list Unread count; the list gives no count of results anywhere.

**Related**: STORY-011, STORY-024, STORY-033, STORY-052


#### STORY-015: Combine Unread with a sender search, then lose it to a category
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Tomasz Brandt, freelance bookkeeper, two accounts, triage ON
**Goal**: Find unread mail from one client, then peek at Bills, and return to the client mail.
**Preconditions**: Triage ON; client "Harlow Dental" has 3 unread and several read messages.
**Ideal path**: 6 — filter + search + category switch + redo; there is no single-step "back".
**Alternate paths**: Type `is:unread from:harlow` into Search mail alone (Gmail syntax works but is never hinted). Agent panel: "unread from Harlow".
##### Steps
1. Click Filter → "Unread" → list narrows (live Gmail `is:unread`).
2. Click the "Search mail" box, type `harlow`, press Enter → `?filter=unread&q=harlow`; list re-queries as `is:unread (harlow)`; the Unread filter stays selected. Good: both apply. (There is no visible text saying the two are combined.)
3. Thinking: "Show me their invoices too." Click Filter → "Bills" → URL becomes `?category=billing`; `filter` and `q` are deleted; the search box empties itself; list switches to the cached 14-day Bills view with Needs reply grouping back.
4. Hesitation: the user wanted "Bills from Harlow" but gets all Bills. No toast or message explains that the search text was dropped.
5. Press browser Back → returns to `?filter=unread&q=harlow` (history entry per change), search box refills with "harlow".
6. Instead retype `harlow` + Enter while in Bills → `q` set, `category` deleted; user ends in Harlow-only (all mail), Bills lost.
##### Variations
- Do 3 with the Important toggle instead of Bills: same clearing of `filter` and `q`.
- Start with search, then pick Bills: draft text vanishes the same way.
##### Edge Cases
- Gap: cannot combine a triage category with search or a Gmail filter; the API would reject it with BAD_REQUEST ("A view or category cannot be combined with a filter or search", `inbox.ts:~282`), so the UI avoids it by silently dropping the other side.
- Search clearing is invisible when the input was not focused; the user sees a changed list and an empty box.
- Gmail-syntax workaround (`category:` is not offered; `label:`/`from:` typed manually) is undiscoverable.

**Catalog note**: Merged from find-specific-email STORY-004 and search-gmail-syntax STORY-004. CORRECTION: both source stories first assumed search wipes a Gmail filter; the code shows a Gmail filter and search combine. The silent loss happens with the triage narrowers (category or Important toggle), which clear `filter` and `q`. Added detail: category views read the cached 14-day window while Unread is live Gmail (same menu, different reach, no label); the Needs reply group vanishes under filter/search; the "Clear filter" and "Clear search" buttons are different controls for the same escape. VERIFY: search-gmail-syntax inferred that the search box text may linger after a category is picked; this story says the box empties.
**Related**: STORY-010, STORY-013, STORY-020, STORY-021


#### STORY-016: Cut promotional noise with Gmail tabs
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Priya Venkataraman, product designer, newsletter-heavy inbox, triage OFF (no model connected)
**Goal**: Look at only Primary mail to see real people first.
**Preconditions**: One account; no usable model so `enabled=false`; no Important toggle, no categories.
**Ideal path**: 2 — Filter, then Primary.
**Alternate paths**: Search `category:primary` by hand.
##### Steps
1. Click Filter → menu shows Unread, Starred, Important, Has attachment | Primary, Promotions, Social, Updates (no categories, no consent card).
2. Click "Primary" → button label "Primary"; live Gmail `category:primary` list; Today/Earlier groups.
3. Hesitation: "Is 'Updates' here the same as the 'Notifications' category some people have?" With triage off this question never arises; with triage ON both "Updates" (Gmail tab) and "Notifications"/"Newsletters" (Praci category) sit in one menu with no hint of the different source.
##### Variations
- Switch to Promotions to bulk-glance at deals; Archive is unavailable there too, so cleanup must be done in Gmail (no bulk actions exist in the web inbox).
##### Edge Cases
- Gmail tab names depend on the user having Gmail tabs enabled; with tabs off, `category:primary` still runs and may return everything or nothing; no empty-state explanation beyond "No mail matches this filter" + "Clear filter".
- The label "Updates" is a shared msgid with Settings (`messages.po`: `src/pages/SettingsOverlay.tsx`), fine in English.


#### STORY-017: Triage categories on a Monday morning
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Jun Aoki, startup founder, 180 messages in the 14-day window, triage ON, one account
**Goal**: Clear Security and Bills items first, then see what truly needs attention.
**Preconditions**: Triage on; most rows classified; a few new rows unclassified (`triagePending`).
**Ideal path**: 5 — category, scan, switch category, Important, Clear.
**Alternate paths**: To do card on the unfiltered list surfaces due items; Needs reply group at the top of the default list; agent: "what's on my email".
##### Steps
1. Look at the default list: To do card, Needs reply, Today, Earlier (up to 200 rows, one dense line each). Thinking: "Too much; where are the bills?"
2. Click Filter (icon only) → scroll the 14-item menu; categories sit at the bottom under a separator, with no heading → click "Security".
3. List shows cached Security rows; Needs reply group still appears if rows qualify; hover actions Archive / Mark read / Mark important / Mark noise still work (not `filtered`). To do card is hidden (`narrowed`, Inbox.tsx:240).
4. Archive two phishing-looking rows with `e` after `j` selection → they vanish optimistically; `e` works here (it is disabled only for Gmail filter/search).
5. Filter → "Bills" → radio swaps to Bills; Security selection is replaced, no multi-select.
6. Click the "Important" toggle (outside the menu) → `?view=important`; `category` deleted; Filter button returns to outline (no label), toggle turns primary-coloured. Thinking: "Did Bills turn off? The Filter button looks empty now." Yes, it did.
7. Open Filter → "Clear" is NOT shown (no category/filter), so the way out is to unpress "Important".
##### Variations
- Press Important first then pick a category: `view` is deleted and the toggle unpresses.
- Triage still sorting: category counts change silently as the 5 s poll (max 6) lands (`TRIAGE_POLL_MS`), so a freshly arrived bill may not appear in "Bills" for ~30 s; nothing says "sorting".
##### Edge Cases
- Category views read the 14-day cache only (`WINDOW_MS`), cap 200; older bills require search.
- Two buttons that both mean "narrow" (toggle + dropdown) are mutually exclusive but look independent.
- Same classification appears as the row badge ("Needs attention", "Newsletter", "Spam"/"Junk") and as category filters, but a category such as Bills has no row chip, so the user cannot see why a row was in the list.

**Related**: STORY-003, STORY-006, STORY-013, STORY-018, STORY-020, STORY-025, STORY-030, STORY-057, STORY-060, STORY-061


#### STORY-018: The two different "Important"s
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Lena Morrow, consultant, one account; connects a model mid-week so triage turns ON
**Goal**: Show only important mail, and understand what "important" means.
**Preconditions**: Starts with triage OFF; consent given later.
**Ideal path**: 1 — click Important toggle (triage ON); 2 in triage OFF (Filter, Important).
**Alternate paths**: Search `is:important`. Starred filter as a manual stand-in.
##### Steps
1. Triage OFF: open Filter → click "Important" (first group) → `?filter=important`; live Gmail `is:important` (Google's own machine-learned importance); archive disabled; Needs reply gone.
2. Allow triage (consent card "Let Praci sort your mail" → Allow) → list refreshes; "Important" now appears as a toggle left of Filter, and is REMOVED from the Filter menu.
3. If `?filter=important` is still in the URL (reload/bookmark), `InboxFilterSchema` still parses it: the list is Gmail-important, the toggle is NOT pressed, the Filter button shows label "Important" (`filterLabels` has it) though the menu has no matching radio (value unmatched). Confusing: two "Important" indicators disagree.
4. Click the toggle → `?view=important`, `filter` removed; list = priority critical/important OR needs-reply (not handled) OR senders marked important, minus senders marked noise (`inbox.ts:340-362`). Archive works here.
5. Hover a row, click "Mark noise" on a newsletter sender → toast "Marked noise" + Undo; list reloads and that sender's rows leave the Important view.
##### Variations
- Mark important on a sender: their mail now always appears in the toggle view even with normal priority.
##### Edge Cases
- Gap: nothing in the UI states the definition of the Important toggle, nor that it differs from Gmail's "important" marker.
- Empty result: "No mail matches this filter" + "Clear filter" (clears view too).
- Toggle pressed state is only styling; no count.

**Related**: STORY-017, STORY-025, STORY-030, STORY-060, STORY-061


#### STORY-019: Check one account at a time
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Dev Raman, agency owner with work and personal Gmail (accounts labelled "dev@raman-agency.example" and "devraman.personal@example.com")
**Goal**: Look only at the personal account's unread mail without work noise, then return to All.
**Preconditions**: Two accounts connected, triage ON.
**Ideal path**: 3 — click account tab, Filter, Unread.
**Alternate paths**: Composer From picker is unrelated to viewing. Agent: "unread in my personal account".
##### Steps
1. Notice the pill tabs row beneath the header: "All", then one tab per account label (truncated at 160px; both emails start with "dev" and the work label ends in the same domain visually, `max-w-40` truncation hides the distinguishing end). Hesitation: which is which.
2. Click the second tab → `tab` state set; list reloads with `connectionId`; To do card swaps to that account's to-dos (`todosByTab`).
3. Click Filter → Unread → list shows only that account's Gmail unread. The tab stays selected, filter applies on top (key = tab+filter+q+view+category).
4. Click "All" → same filter, merged across both accounts, newest first. Rows do not show which account they came from, so the user cannot tell personal from work in All.
5. Reload the page → tab resets to All (not in URL) while the filter remains in the URL.
##### Variations
- Tab + search: query goes only to that account's Gmail.
- A removed or failed account: if the list request throws while a tab is selected the page silently falls back to All (Inbox.tsx:~160).
##### Edge Cases
- Tabs appear only with >1 account (`accounts.length > 1`); a disconnected account's tab vanishes.
- Gap: no per-account unread count on tabs; no indicator of which account failed to sync (global "Couldn't reach Gmail." banner).
- Filtered "All" paging merges accounts: "Load more" cross-account paging caveat (`inbox.ts` searchMail comment).

**Related**: STORY-005, STORY-012, STORY-043, STORY-059


#### STORY-020: Long afternoon of narrowing, searching and paging, then lost
**Type**: long
**Topic**: filter-and-narrow
**Persona**: Grace Whitfield, executive assistant managing a busy shared-style mailbox plus a second account, triage ON
**Goal**: Find the invoice thread a vendor says they sent two weeks ago, using narrowing tools, without losing her place in the day's triage.
**Preconditions**: Two accounts; 190 cached rows; the invoice is 17 days old (outside the cache window), has an attachment.
**Ideal path**: 7 — Has attachment filter + search the vendor name; the default list and categories cannot show it.
**Alternate paths**: Search `from:vendor has:attachment` alone; Inbox agent "find the invoice from Vendor" (mail_search); no date filter exists in the menu.
##### Steps
1. Open Inbox. Default list: To do, Needs reply (4), Today (22), Earlier (~160). Thinking: "It's here somewhere." Scroll the Earlier list: no "showing last 14 days" cue.
2. Click Filter → "Bills" → list of ~30 cached billing rows; vendor not there (too old for the 14-day cache). No message says why.
3. Click the "Important" toggle → `category` dropped; shorter list; not there either. Toggle off by clicking again (`view` deleted).
4. Click the second account tab → Bills? No: category and view are cleared by the toggle; but the tab persists with no filter; list is that account's cache. Not there.
5. Click "All" again. Click Filter → "Has attachment" → live Gmail `has:attachment`; Needs reply group gone; 50 rows per account; many results; "Load more" button appears at the bottom.
6. Type the vendor name "Brightwater" in Search mail, press Enter → `?filter=attachment&q=Brightwater`; still has the attachment filter on (good); results narrow to a handful; includes mail older than 14 days; time column shows only "Sep 29" style dates (no year), no attachment icon on rows.
7. Open the likely row (Enter or click) → dialog. The URL gains `?mail=`; close with Esc → returns to the same filtered list (Back goes to the list entry) and focus returns to the row.
8. Hesitation: she wants to archive the answered thread. Archive is missing in the dialog and the row; `e` does nothing. She must go to Gmail.
9. Click Filter → "Clear" → filter removed but the search text "Brightwater" and results stay (the Clear item removes only `filter`). Then click the X "Clear" in the search box → full default list returns.
10. Gap felt: she wants "Unread + Needs reply" or "Has attachment + Bills": impossible; only attachment/Gmail filters combine with text search.
##### Variations
- Press `/` first to focus search from the list, type, Enter, then add Filter: same URL result.
- If she picked Filter → "Starred" while Important toggle was on: toggle unpresses, `view` removed.
##### Edge Cases
- Load more may repeat a thread already shown; client de-dupes (`rows` memo, Inbox.tsx:~190).
- Changing tab or filter during paging discards the extra pages (`keyRef` guard) and shows loading skeletons.
- Esc in the search box clears the text but not the filter.

**Related**: STORY-003, STORY-006, STORY-010, STORY-013, STORY-015, STORY-017, STORY-021, STORY-029, STORY-048, STORY-055, STORY-057


#### STORY-021: Empty result, wrong clear button
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Hannah Cole, nurse practitioner reading mail on a phone-width browser window, triage ON
**Goal**: Recover from a filter + search combination that returns nothing.
**Preconditions**: Narrow window (`@md` layout puts search on its own line below the title row).
**Ideal path**: 2 — click the right clear control.
**Alternate paths**: Press Esc in the search box (clears query only); Back button; open Filter → Clear.
##### Steps
1. Choose Filter → "Starred", then search `payroll`, Enter → `?filter=starred&q=payroll` returns nothing: message `No results for "payroll"` with "Clear search".
2. Thinking: "Is Starred also limiting it?" The empty state mentions only the search; the active "Starred" filter is visible only on the Filter button label.
3. Click "Clear search" → `q` removed; Starred list returns. If instead she had no query, the message reads "No mail matches this filter" with "Clear filter".
4. If she picks Filter → "Unread" while the search is empty but the Important toggle was on, the toggle unpresses and results come from Gmail.
##### Variations
- Empty Personal category: "No mail matches this filter" + "Clear filter" (button sets filter/category/view/mail off).
##### Edge Cases
- Gap: with a filter AND a search that both yield nothing, there is no single "Clear all" control.
- Touch: Filter and toggles are 40px tall (`pointer-coarse:h-10`).
- `?category=bills` in the URL while triage OFF: category is ignored by the API (`enabled &&` guard), full unfiltered list is shown, yet "No mail matches this filter" text could appear only if empty; the Filter button shows no label (`triage && category`), so the deep link silently does nothing.

**Related**: STORY-010, STORY-013, STORY-015, STORY-020, STORY-031, STORY-039, STORY-048, STORY-057


#### STORY-022: Shared or bookmarked filtered view
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Ibrahim Saleh, accountant who bookmarks his weekly "unread with attachment" check
**Goal**: Return to a narrowed view in one click via bookmark or browser history.
**Preconditions**: Browser bookmark `/app/inbox?filter=attachment&q=invoice`.
**Ideal path**: 1 — open the bookmark.
**Alternate paths**: Browser Back/Forward after each filter change (each change is a history entry).
##### Steps
1. Open bookmark → page loads with filter and search restored; search box prefilled via `setDraft(query)`; Filter button shows "Has attachment".
2. Account tab is back to All (state, not URL), so a previously chosen account is lost.
3. Press Back → undoes the last param change, not leave the inbox.
##### Variations
- Add `&mail=<id>` deep link: dialog opens over the filtered list; Archive hidden because `filtered`.
##### Edge Cases
- Only one of the pair `category`/`view` can be in a URL; if both filter and category are present, filter wins (`readInboxListState`).
- Gap: nothing like saved filters exists in the app; the browser bookmark is the only way.

**Related**: STORY-008, STORY-034, STORY-051



### Topic: triage-long-list

#### STORY-023: Archive the first newsletter without losing my place
**Type**: short
**Topic**: triage-long-list
**Persona**: Priya Raman, product manager back from a week of leave
**Goal**: Clear one obvious junk email from the top of "Earlier" and keep scanning.
**Preconditions**: Gmail connected, triage on, no filter or search, desktop width with a mouse.
**Ideal path**: 3 — hover row, click Archive, keep scanning; no confirmation needed.
**Alternate paths**: Click row -> dialog -> "Archive" button (`InboxMessageDialog`) then dialog advances to the next message (`Inbox.tsx:692-700`); keyboard `j` to the row then `e`.
##### Steps
1. Open Inbox from the sidebar (`sidebar-inbox`, shows unread count badge) -> `/app/inbox` shows skeleton rows then Needs reply / Today / Earlier sections. Priya thinks: "How many is that? There is no count anywhere except the sidebar badge."
2. Move the mouse over a row from "Weekly Digest" in Earlier -> four icon-only buttons fade in over the right side of the row, left of the time. She hesitates: which icon is archive? No visible label; the first icon is the Archive box (aria-label "Archive").
3. Click the Archive icon -> row disappears at once (optimistic, `patchRows` filter), rows below slide up, sidebar badge refreshes via `onRefreshed`.
##### Variations
- Touch device or coarse pointer: hover buttons are hidden; a single "More" (...) button at the row end opens a menu with "Archive", "Mark read", "Mark important", "Mark noise" (labelled text, clearer than the icons).
##### Edge Cases
- Archive fails (offline): error banner appears and the list reloads, the row reappears; nothing says which row failed.
- No undo: Priya archived the wrong row by sliding the mouse; nothing in the UI brings it back (observed gap). The same info "archived" appears nowhere on screen; a toast exists only for marks.
- Row below slides under the cursor after removal, so a double click archives two rows (observed risk).

**Related**: STORY-044, STORY-058, STORY-059, STORY-062


#### STORY-024: Keyboard sweep through the Earlier pile
**Type**: medium
**Topic**: triage-long-list
**Persona**: Marcus Webb, operations lead who lives on the keyboard
**Goal**: Archive about 40 low-value messages quickly using j/k/e.
**Preconditions**: 200 rows loaded, unfiltered, no dialog open, focus not in an input.
**Ideal path**: 6 — one `j` to start, then `e` repeatedly (selection auto-advances); `o` only for ambiguous rows.
**Alternate paths**: Click each row's hover Archive icon (one mouse trip per row); open first message and use `e` in the dialog, which archives and moves to the next message.
##### Steps
1. Press `j` with nothing selected -> first row (top of Needs reply) gets the left primary border and focus (`inbox-keyboard.ts:42`). He thinks: "I wanted to start at Earlier; there is no jump-to-section key." Observed gap: no shortcut to skip a group.
2. Press `j` repeatedly through Needs reply (7 rows) into Today (3) -> selection crosses group headings seamlessly; the list scrolls to keep the row visible (`scrollIntoView block nearest`).
3. Press `j` to the first Earlier row "Your invoice is ready" -> selected; hover actions stay visible permanently on the selected row (`selected` skips opacity-0).
4. Press `e` -> row removed, selection moves to the next row (`neighbor = ids[index+1] ?? ids[index-1]`). 
5. Press `e` again 5 times -> five more rows gone, no feedback besides rows vanishing. He hesitates after the 5th: "Did that last one matter?" and cannot recall what it was; there is no undo and no "recently archived".
6. Press `o` on an unfamiliar sender -> message dialog opens; press `e` there -> archives, dialog shows next message; press `Esc` to close and return to list with the row focused (`Inbox.tsx:395-402`).
7. Press `?` -> "Keyboard shortcuts" dialog lists j, k, Enter, /, c, e, r, a, f, Esc. He notices `o`, arrows are missing and no read/unread or mark key exists.
##### Variations
- Last row archived: neighbor falls back to the previous row; with an empty list nothing is selected.
- Using ArrowDown instead of `j` behaves identically.
##### Edge Cases
- If a search/filter is active `e` silently does nothing (archive is undefined) - no message explains why.
- Shortcuts are ignored while any dialog is open or focus is in the search box; after typing a search and pressing Enter, focus stays in the input so `j` types a letter (observed friction).
- Holding `e` could archive many rows with no confirmation.

**Catalog note**: Merged from keyboard-power-use STORY-001 (blast through with j/k/e). Added detail: no row is pre-selected, `k` with nothing selected selects the first row; after `e` the removed row unmounts so DOM focus likely falls to body while keys keep working because the listener is on `window` (INFERRED, verify); archiving the last row falls back to the previous row; with an empty list `e` does nothing.
**Related**: STORY-011, STORY-014, STORY-029, STORY-033, STORY-052, STORY-055


#### STORY-025: Which of these actually need a reply?
**Type**: medium
**Topic**: triage-long-list
**Persona**: Dana Okafor, freelance designer with 200 unread after a week off
**Goal**: Work the Needs reply section first, in priority order, and know why each is there.
**Preconditions**: Triage on and consented; Needs reply contains 9 rows; triage finished.
**Ideal path**: 5 — top of the page already ordered by priority, open each, reply.
**Alternate paths**: Use the "Important" toggle beside the Filter menu (view=important: critical/important OR needs-reply OR sender marked important, minus noise) for a different slice; ask the Inbox agent ("what's on my email").
##### Steps
1. Land on Inbox -> To do card first (if any open to-dos), then "Needs reply" heading, then the rest. Dana thinks: "Nine things need me? Which first?"
2. Scan Needs reply rows -> sorted by priority then newest (`inbox-groups.ts:23-27`), but priority itself is NOT displayed on the row; the "Needs attention" badge is hidden inside this group (`hideAttention`). She cannot tell critical from low; only order carries information. Observed gap: the reason ("Client asked for revised quote by Friday") exists in data (`MailRow.reason`) but is not shown on the row or in the dialog.
3. Click the first row ("Contract renewal - please confirm") -> dialog opens with `?mail=` URL; shows only that one message though the row represents a whole thread.
4. Click "Reply" -> composer "Reply" opens; she writes and sends. After 5 s undo window the list reloads on `MAIL_SENT_EVENT`.
5. Back in the list, the thread's row leaves Needs reply (answered thread is `alreadyHandled`, `inbox.ts:155`) -> she gets a sense of progress but no counter.
##### Variations
- Row marked noise by an earlier session moves out of Needs reply.
- While triage is still pending (new mail), the list silently re-polls every 5 s up to 6 times and rows may jump into Needs reply under her cursor.
##### Edge Cases
- If triage is off or blocked, there is no Needs reply section at all; everything is Today/Earlier and the user is not told why.
- Under a filter/search the Needs reply group disappears (`needsReply: null`), so a person who filters to "Unread" loses their priority view.

**Related**: STORY-017, STORY-018, STORY-030, STORY-060, STORY-061


#### STORY-026: Teach the inbox that a sender is noise, then regret it
**Type**: medium
**Topic**: triage-long-list
**Persona**: Tomas Lindqvist, founder who gets daily promo mail from a SaaS vendor
**Goal**: Mark the vendor as noise so it stops appearing as urgent, then undo a wrong mark.
**Preconditions**: Triage on. Three messages from "Brightwave Deals" appear: one in Needs reply, two in Earlier.
**Ideal path**: 3 — hover, click Mark noise, done; undo within 6 s if mistaken.
**Alternate paths**: "More" menu on touch ("Mark noise" checkbox item); no dialog button for marks (dialog has Reply, Reply all, Forward, Archive, Mark read/unread only).
##### Steps
1. Hover the Brightwave row in Needs reply -> icons appear. He hovers the bell-with-slash (aria-label "Mark noise"); no tooltip. He thinks: "Is this just this email or the whole sender?" Nothing on screen says per-sender (observed gap).
2. Click it -> toast at bottom center "Marked noise" with "Undo"; the row text turns muted, icon fills (aria-pressed).
3. Wait for the reload -> row leaves Needs reply (needsReply false, priority low) and drops into Today/Earlier; the other two Brightwave rows also turn muted (mark is by sender address across all accounts, `inbox.ts:406-436`). He is surprised that rows he did not touch changed.
4. Realises the vendor also sends his invoice reminders; clicks "Undo" within 6 s -> mark removed (`mark(id, null)`), toast disappears, rows return to normal and Needs reply regains the row after reload.
5. If he missed the 6 s: he must find a Brightwave row (now muted), hover and click the filled "Mark noise" icon again to unmark -> no toast and no confirmation of removal (status set to null).
##### Variations
- "Mark important" on a boring sender lifts priority to at least "important" and may add it to Important view; still no priority text on the row.
- Marking noise on a sender removes their to-dos from the To do card (triage re-syncs to-dos, `inbox.ts` comment on feedback).
##### Edge Cases
- Toast is single: marking two senders in a row replaces the first toast, so the first is no longer undoable from the toast.
- Mark fails: icon reverts, error banner shown.
- Nothing is written to Gmail, so the same mail looks unchanged in Gmail itself.
- Noise rows are muted but not hidden, so the list is no shorter (observed gap for overload).


#### STORY-027: Reading state as a progress tracker
**Type**: medium
**Topic**: triage-long-list
**Persona**: Hannah Mbeki, consultant who uses unread as her to-do marker
**Goal**: Mark scanned-but-not-actioned emails read, and flip one back to unread.
**Preconditions**: 60 unread rows (bold sender with blue dot). Unfiltered view.
**Ideal path**: 4 — hover icon per row; there is no bulk "mark all read".
**Alternate paths**: Open message and use "Mark read/Mark unread" in the dialog; filter to "Unread" (Filter menu) to see only unread, but then archive is disabled.
##### Steps
1. Look at the list -> unread rows have a primary dot and a bold-coloured sender. Hannah thinks: "Opening a row should mark it read." 
2. Click a row to open it, then close -> the row stays unread (no auto-mark call found in `openMessage`/dialog; verify in the walk). She is annoyed: read state needs a separate click.
3. Hover that row and click the envelope icon (aria-label "Mark read") -> dot disappears immediately, sidebar badge updates. API marks the whole thread read.
4. Mark a different row she wants to revisit: hover the open-envelope icon (label now "Mark unread") -> dot returns; API marks only that one message unread (thread-level asymmetry).
##### Variations
- In the dialog the same "Mark read/unread" button toggles the list row behind it.
##### Edge Cases
- Select Filter "Unread", mark one read: it stays in the filtered list until reload, since only the flag patches.
- No "mark all read" and no shortcut: 60 rows = 60 hover clicks (observed gap).
- Unread count appears on sidebar badge only; the Inbox page itself has no unread total.

**Catalog note**: Merged from read-with-context STORY-002 (opening does not mark read). Added detail: sidebar badge only drops (12 to 11) after an explicit Mark read; reading a batch with `j` in the dialog leaves every message unread; a deep-linked message not in the list shows neither Archive nor Mark read; no setting for mark-read-on-open. The read-with-context agent code-verified that no `markRead` call exists on open; the triage agent and discovery asked for a browser check.
**Related**: STORY-037, STORY-050


#### STORY-028: The To do card as a map of the week
**Type**: medium
**Topic**: triage-long-list
**Persona**: Elena Petrova, office manager checking deadlines first
**Goal**: See what is due, tick items off, and trace one back to its email.
**Preconditions**: Triage on, 6 open to-dos from triage plus one done in the last 24 h; container narrower than @3xl.
**Ideal path**: 4 — read card, expand "N more", tick items; tracing to the source email is not possible from the card.
**Alternate paths**: Search the sender in "Search mail" (press `/`), or ask the Inbox agent.
##### Steps
1. Open Inbox -> "To do" card sits above Needs reply, showing the first 2 open items and a ghost button "4 more". Each shows text, a "from · reason" small line, and due label (Today red, weekday amber/plain, "Mon D").
2. Click "4 more" -> all items show; button becomes "Show less" (`aria-expanded`). On wide screens (@3xl) everything is shown and the button is hidden.
3. Tick the checkbox on "Send revised quote to Okafor Design" -> `todos.setDone`; item goes to the bottom, struck through, kept for 24 h.
4. She tries to click the item text to see the email -> nothing happens (no handler; `messageId` unused). She scans Needs reply for the matching row and cannot be sure which. Observed gap.
##### Variations
- Multi-account: To do list is per account tab; "All" merges.
- Unticking a done item restores it.
##### Edge Cases
- Card hidden under any search, filter, Important view, category, or while the consent prompt shows; so applying a filter makes her to-dos vanish.
- Same information appears twice: a Needs reply row and a to-do for the same email, with no link between them.
- Due labels use weekday names within 6 days, not dates; ambiguous when a week away.
- setDone failure shows an inline alert in the card.


#### STORY-029: A full triage pass on 200 emails
**Type**: long
**Topic**: triage-long-list
**Persona**: Jonas Weber, sales director back from a week off, 200 emails in 14-day window
**Goal**: Reduce the list to what matters, ending with replies sent and noise senders silenced.
**Preconditions**: Triage on and consented, two accounts (work and personal), triage finished.
**Ideal path**: 18 — Needs reply first, mark noise per sender, archive remaining Earlier rows by keyboard.
**Alternate paths**: Per-category filters (Newsletters, Receipts) to batch-handle; Important toggle for a tight slice; agent `mail_modify` with approval for bulk archive (agent only, not UI).
##### Steps
1. Open Inbox -> skeleton rows, then list. He thinks: "200 rows, no count, no way to select all."
2. Notice account tabs "All / work / personal" (shown with >1 account). Stay on All; rows show no account indicator.
3. Read To do card; expand with "N more"; note two due Today in red.
4. Work Needs reply: `j`, `o` to open the first; read; click "Reply"; send. Press `Esc`; row focus restored.
5. Repeat for 3 rows. Hesitation: after reply, can't tell which remaining rows still need work without re-reading all.
6. Scroll to Today (4 rows): read subjects; subject and snippet share one truncated line, so long subjects hide the snippet. He opens 2 to understand.
7. Reach Earlier: a long list. Identify the repeated "Brightwave Deals" sender; hover Mark noise on one -> toast "Marked noise" + Undo; all three rows mute.
8. Do the same for "ShopLine Receipts" and "Daily Digest" (each toast replaces the previous).
9. Use `j` to the first muted row and press `e`; repeat. Rows disappear; selection moves down.
10. Hit a row from "Dana Okafor" that looks personal; press `o`, read, press `e` in the dialog to archive and move to the next message.
11. Realise he archived a message he needed; looks for undo: none. Searches `/` -> types "Okafor", Enter (Gmail live search; archived mail still appears since not deleted, he finds it, but Archive is now disabled in search view).
12. Press Esc / click "Clear" to return; list shows the unfiltered view again (state of the earlier scrolling position lost).
13. Mark remaining 'Newsletter'-badged rows: filter "Newsletters" via Filter menu -> category view; Archive is... still available (category is not "filtered" - `filtered` covers search/filter only; verify in walk).
14. Use Filter "Clear" to return.
15. Check sidebar unread badge: down from 120 to 31. No in-page total, no "all caught up" copy; empty state would say only "No mail".
16. Finish by hovering "Mark read" on 10 stragglers one by one (no bulk).
17. Press `?` to recall keys; closes with Esc.
18. Leaves the page; on re-entry the list re-syncs on mount (no "last synced" display).
##### Variations
- Mobile/touch: "More" menu per row; no search/filter on the mobile screen.
- Single account removes tabs and a source of doubt.
##### Edge Cases
- Optimistic archive racing a reload could briefly restore a row if a sync returns stale data.
- 200-row cap: oldest rows beyond 200 simply do not appear and nothing tells him.
- Triage reshuffle mid-pass moves rows between groups under the cursor.

**Related**: STORY-020, STORY-024, STORY-048, STORY-055


#### STORY-030: Overwhelmed first look: reading the page cold
**Type**: short
**Topic**: triage-long-list
**Persona**: Grace Adeyemi, a first-time user returning after vacation, anxious about volume
**Goal**: Understand at a glance how bad it is and where to start.
**Preconditions**: Triage on, 200 rows, wide desktop window.
**Ideal path**: 2 — land, read the first heading, start; the UI offers no summary of its own.
**Alternate paths**: Open the Inbox agent panel and ask "what's on my email" (overview tool).
##### Steps
1. Open Inbox -> a wall of 44 px single-line rows under small grey 12 px headings "Needs reply", "Today", "Earlier"; no counts, no per-group collapse. Grace thinks: "Where do I even start? Is the top the worst?"
2. Look for a summary -> none; the sidebar badge is the only count; Inbox page header shows "Inbox", Search mail, Important toggle, Filter, Compose icon. She can't tell what the Important toggle does vs the "Needs reply" section (overlapping meanings shown on two surfaces).
##### Variations
- Inbox agent panel can summarise on request (not auto-shown, starts collapsed on phones).
##### Edge Cases
- Everything already read: unread dot and bold absent, and the page looks identical to "unread" at distance; time shows only "h:mm AM" or "Mon D", no weekday.
- Empty inbox says only "No mail" - no celebratory or guidance copy.

**Related**: STORY-017, STORY-018, STORY-025, STORY-060, STORY-061


#### STORY-031: Triage on a phone-width window with touch
**Type**: medium
**Topic**: triage-long-list
**Persona**: Luis Ortega, stuck in an airport on a phone browser
**Goal**: Archive and mark three senders from the long list using touch.
**Preconditions**: Coarse pointer, narrow container (96 px sender column, Inbox agent collapsed by default).
**Ideal path**: 3 per row — tap "More", tap action.
**Alternate paths**: Tap row to open full-screen dialog, use its Archive button.
##### Steps
1. Open Inbox -> the rows are 44 px with a very short sender column; subject mostly truncated to a few characters. He thinks: "I can't tell what any of these are."
2. Tap the "More" (...) on a row -> menu: "Archive", "Mark read", "Mark important", "Mark noise" (checkbox items). The row reserves extra end padding (pe-11).
3. Tap "Mark noise" -> toast "Marked noise" + Undo appears at bottom, 6 s.
4. Tap "More" -> "Archive" -> row gone instantly.
5. Tap row to open the dialog; swipe is not supported; use prev/next chevrons.
##### Variations
- The To do card shows only 2 items with "N more".
##### Edge Cases
- The small "More" target (icon-xs) sits near the time; mis-taps open the message.
- Toast overlays the bottom of the list, covering the last rows.
- No keyboard shortcuts on touch.

**Related**: STORY-021, STORY-039, STORY-048



### Topic: read-with-context

#### STORY-032: Open the latest reply and try to find what was said before
**Type**: medium
**Topic**: read-with-context
**Persona**: Marisol Vega, operations manager at a small catering firm, 40 unread, between meetings
**Goal**: Understand the earlier back-and-forth in a long vendor thread before answering the newest message
**Preconditions**: Gmail connected; thread "Re: Re: Re: Saturday delivery window" has 9 messages; the list row shows the newest one
**Ideal path**: 5 — open row, read, hunt for history, give up and open the thread elsewhere / ask agent; the app offers no in-dialog thread view so the ideal is bounded by that gap
**Alternate paths**: Ask the Inbox agent (right panel) to summarise/search the thread (tools `mail_search`, `mail_get`, per discovery); search the subject in "Search mail" and open each result (each thread still collapses to one row, so this does NOT list the 9 messages); Gmail itself outside the app. No in-app thread expansion found.
##### Steps
1. Click the row "Re: Re: Re: Saturday delivery window" → URL gets `?mail=<id>`, dialog opens with the subject as title (from the row) and a skeleton until `inbox.get` returns (instant if prefetched, `Inbox.tsx` prefetch effects).
2. Read the header: sender name and `<address>`, a date like "Oct 13, 2026, 4:12 PM", "to Marisol Vega" → she sees only this one message's fields.
3. Scroll the body → HTML in a sandboxed iframe, or plain text. Gmail's collapsed quoted text is whatever the sender's client included; the app adds no "show quoted" toggle in the reader.
4. She thinks "what did Dario say about the 7am slot?" and scans the dialog for "Thread", "Earlier messages", "Conversation" → nothing exists. Hesitation point: she looks at the chevrons "Previous message"/"Next message".
5. Click "Next message" (ChevronDown) → loads the next ROW in the list (a different thread), not the previous message of this thread. Subject changes entirely.
6. Click "Previous message" (ChevronUp) to return → back to the thread, same single message.
7. Scroll to the bottom of the body hoping for history → only attachments (if any) after the body.
8. Click "Reply" anyway → composer opens with quoted original (the one message), dialog hides behind it (`composing && "invisible"`).
##### Variations
- Sender's HTML includes the full quoted chain: she can scroll within the iframe and recover context from it.
- Plain-text-only mail: `whitespace-pre-wrap` text, quotes visible as ">" lines.
- She types the subject into "Search mail": result is again one row per thread, so still one message per open.
##### Edge Cases
- Observed gap: no thread view, no thread-count on the row, no "N earlier messages" hint, so she cannot even tell the thread is long until she opens it.
- Chevron labels say "Previous/Next message" but navigate across threads, which is easy to misread as thread navigation.
- Same information (subject/sender) appears on the row, the dialog title, and in the composer's Reply header.


#### STORY-033: Walk the neighbours with j/k and Archive from the reader
**Type**: medium
**Topic**: read-with-context
**Persona**: Priya Natarajan, product lead clearing 25 messages before standup
**Goal**: Read through the Today group top to bottom, archiving finished ones
**Preconditions**: Unfiltered list, triage on; groups Needs reply (3), Today (8), Earlier; no search/filter active
**Ideal path**: 12 — open first, then per message `e` or `j`
**Alternate paths**: Close and use list keys j/k/Enter/e (`lib/inbox-keyboard.ts`); chevron buttons instead of keys.
##### Steps
1. Press Enter on the top Needs reply row → dialog opens, `?mail=` set; the history entry is pushed (state `LIST_OPEN`).
2. Press `j` → next row in list order (Needs reply, then Today, then Earlier: `ids` order) opens; URL is replaced, not pushed (`goToMessage` replace).
3. Press `k` → previous. At the first row "Previous message" is disabled; at the last, "Next message" is disabled.
4. Finish a message, press `e` (or click "Archive") → row removed optimistically; dialog jumps to the neighbour (`ids[index+1] ?? ids[index-1]`).
5. Repeat `e` several times → she reaches the last row; archiving it with no neighbour calls `closeMessage` and returns to the list.
6. Press Escape → closes. Because the entry was list-opened, `navigate(-1)` is used, so one Back total returns to the list even after many j/k.
##### Variations
- With a search or filter active: "Archive" button is absent and `e` does nothing in the dialog (`onArchive` undefined when `filtered`).
- j at the last row does nothing, silently.
##### Edge Cases
- No undo for archive; an accidental `e` while reading is final in the UI.
- The Needs reply row sorted high may leave once triage updates; polling reshuffle (every 5 s up to 6 times) can change `ids` order under her, so "Next message" may not be what she expected.
- Shortcut help dialog "Keyboard shortcuts" lists j/k/e/r/a/f/Esc but does not say they apply in the dialog.

**Related**: STORY-011, STORY-014, STORY-024, STORY-052


#### STORY-034: Deep link and Back button behaviour
**Type**: medium
**Topic**: read-with-context
**Persona**: Gareth Olusanya, consultant who pastes URLs into his notes app
**Goal**: Return to a specific email from a saved link and navigate back to the list sensibly
**Preconditions**: Signed in; saved URL `/app/inbox?mail=<id>`; the message is older than 14 days
**Ideal path**: 3 — open link, read, close
**Alternate paths**: Chat email card from the bot opens the same dialog without prev/next/archive (`EmailCards.tsx`); search by subject.
##### Steps
1. Paste the URL into a new tab → Inbox page loads with dialog open; title blank until `inbox.get` returns (no row, so `subject` undefined), skeleton rows then fields.
2. Read the message. Chevrons are disabled (message not in the loaded list, `openIndex = -1`), and Archive and "Mark read" buttons are absent.
3. Click "Close" (X) → no `LIST_OPEN` state, so `mail` is deleted with replace; list is shown at `/app/inbox`.
4. Click Back in browser → leaves the app (replace removed the mail entry). He expected the email again.
##### Variations
- Same link, but the message is in the 14-day list: prev/next work, Archive and read buttons appear.
- Normal click-open then browser Back (instead of X): dialog closes and list remains, row gets focus.
- Open message A, press j to B, press browser Back → returns to list (one entry), not to A.
- A search typed after opening clears `mail` (`setInboxListParam`).
##### Edge Cases
- Message deleted/archived in Gmail or from another account: `inbox.get` errors, `role=alert` text with "Try again" button in the dialog.
- Link for an id not owned by this space: error text, same Try again button (which cannot succeed).
- Observed gap: no "Open in Gmail" or copy-link control; the user must copy the address bar.

**Related**: STORY-008, STORY-022, STORY-051


#### STORY-035: HTML newsletter that renders blank, and remote images
**Type**: short
**Topic**: read-with-context
**Persona**: Lena Fischer, travel coordinator reading a confirmation from an airline
**Goal**: Read the itinerary in a mail with heavy HTML
**Preconditions**: HTML mail with images; remote-image preference at default
**Ideal path**: 2 — open, read
**Alternate paths**: none found for plain-text alternative toggle; the dialog picks HTML when it has visible content else text.
##### Steps
1. Open the row "Your e-ticket for LH 2217" → HTML in a bordered, sandboxed frame (`SandboxedHtmlViewer ... email`); dialog height grows to min(85vh, 820px) on desktop (`has-[iframe]`).
2. Remote images may not load (preference in `lib/remote-images-preference.ts`) → she sees gaps and wonders if the mail is broken. Hesitation: she looks for a "Load images" button in the dialog.
3. Scrolls inside the frame, while the dialog area outside also scrolls (two scroll regions) → she scrolls the wrong one at times.
##### Variations
- HTML contains only styles/no text/no image: `hasVisibleContent` false, so the plain `text` part shows instead.
- Text-only mail: preformatted wrap, no frame.
##### Edge Cases
- Observed gap: no visible control in the reader for loading remote images or switching HTML/text.
- If both html and text are empty the body area is blank with no "no content" message.


#### STORY-036: Download an attachment from a long thread
**Type**: medium
**Topic**: read-with-context
**Persona**: Hana Kobayashi, paralegal who needs "Lease_Amendment_v3.pdf"
**Goal**: Get the right version of a file, not an older one in the same thread
**Preconditions**: Thread with three messages each carrying a different version of the PDF; row shows only the newest message; list has no attachment indicator
**Ideal path**: 3 — open, click chip
**Alternate paths**: Filter dropdown item "Has attachment" (Gmail live filter) to find mail; Inbox agent. No attachment icon on rows.
##### Steps
1. Scan the list: no paperclip on any row (InboxRow has none), so she opens the newest message of the thread by guess.
2. Look under the body → a chip list labelled "Attachments" with icon, `Lease_Amendment_v3.pdf` and size such as "412.3 kB" (narrow unit format).
3. Click the chip → authenticated fetch of `/api/inbox/messages/<id>/attachments/<attId>`; browser saves the file. It is not previewed.
4. She wonders whether v2 (older message, same thread) is the signed one; no way to see other messages' attachments from here → opens "Previous message" which goes to a different thread.
##### Variations
- Failure (over 25 MB cap or network): red "Download failed" alert below the chips; clicking again clears and retries.
- Image attachment gets FileImage icon, zip gets FileArchive, others FileText.
##### Edge Cases
- Inline images (signature logos) are filtered out of the chips (`!a.inline && a.id`), so a mail with only inline images shows no attachments section.
- Chip filename truncates at max-w-64; two similarly named files can look identical.
- Observed gap: no preview, no "download all", no attachment list across the thread.


#### STORY-037: Reply to a message while unsure what was asked earlier
**Type**: long
**Topic**: read-with-context
**Persona**: Dev Anand, startup founder triaging 60 emails after a flight
**Goal**: Reply to the investor's latest "Re: Term sheet follow-ups" and cover all open questions from the whole thread
**Preconditions**: 11-message thread over 6 days; triage on; thread sits in Needs reply; two accounts (tabs All / personal / work)
**Ideal path**: 14 — open, read, ask agent for summary, read again, reply, send
**Alternate paths**: Search + open each; Gmail outside the app; ask the Inbox agent first from the list.
##### Steps
1. Open the "Inbox" in sidebar → list loads, "Needs reply" group on top has the row; the badge "Needs attention" is hidden within that group.
2. Press `j` to the row, Enter → dialog opens.
3. Read the header: sender, date, "to Dev Anand <dev@...>", "cc" with 4 names truncated at one line. He hovers the cc text to see full tooltip (`title`).
4. Read the body: latest message says "see my points 2 and 4 below" → points are not visible; he cannot see the earlier message.
5. He thinks the reason triage flagged this ("why Needs reply?") but the reason is not shown (`MailRow.reason` is not rendered in the dialog).
6. Close with Escape; focus lands on the row.
7. Expand the right "Inbox agent" panel if collapsed ("Show Inbox agent") and type "summarise the term sheet thread" → agent answers using mail tools; he reads, with no link back to the exact message.
8. Reopens the row (Enter) → same single message.
9. Clicks "Reply all" → composer dialog "Reply all" opens, dialog hidden under it; To/Cc prefilled; quoted text collapsed behind "Show quoted text".
10. Types answers; autosave "Draft saved" appears.
11. Realises he needs to check point 4 again, but the composer covers the reader; he must close or send first. He clicks Discard? No: he keeps the draft and uses the browser to open the thread elsewhere.
12. Sends → outbox "Sending... Undo" for 5 s then "Sent".
13. List reloads (`MAIL_SENT_EVENT`).
14. Row still shows (thread latest is now his own reply, depends on sync); the unread dot on the original remains until he clicks "Mark read".
##### Variations
- Reply (not all) to avoid cc: he must choose before seeing the full cc, which is truncated.
- From the work tab vs All: the dialog shows no account; composer From picker handles it.
##### Edge Cases
- The reader cannot be viewed beside the composer on desktop; the composer replaces the view (`invisible`).
- Observed gaps: no thread view, no per-message jump, no summary in the dialog, no link from agent answer to message.
- The same sender/subject appear on row, dialog title, composer title and agent text, but the thread's earlier content appears nowhere in-app except possibly inside the quoted HTML.

**Related**: STORY-027, STORY-040, STORY-048, STORY-050


#### STORY-038: Recipient truncation and Bcc blind spot
**Type**: short
**Topic**: read-with-context
**Persona**: Ines Moreau, executive assistant checking who else saw a sensitive mail
**Goal**: Confirm the full recipient list
**Preconditions**: Mail with 14 recipients in To and 6 in Cc
**Ideal path**: 3 — open, hover, read tooltip
**Alternate paths**: none found (no expand control); Gmail "show details" outside the app.
##### Steps
1. Open the message → "to a@..., b@..., c@..." on one line, truncated with an ellipsis; "cc ..." beside it also truncated (the two spans share one line, `flex gap-x-3`).
2. Hover "to ..." → native `title` tooltip shows the full list (not available on touch or keyboard).
3. Looks for the Cc to see if the boss is included: the cc span may be squeezed to near zero width by a long To list.
4. She switches to Gmail to check.
##### Variations
- Phone full-screen dialog: tooltips unavailable, so the list stays truncated.
- Message with no cc: only "to ..." shown.
##### Edge Cases
- Bcc is never shown (also for sent items).
- Display names with commas or quotes are formatted `Name <addr>` by the server (`formatAddress`); many names make the line unreadable.
- Observed gap: no expand/"show details" control.


#### STORY-039: Cold-start read on a phone with slow loading
**Type**: medium
**Topic**: read-with-context
**Persona**: Obinna Eze, field technician reading mail on a phone between jobs
**Goal**: Read one urgent message and move to the next
**Preconditions**: Narrow viewport; weak connection; Inbox agent panel collapsed by default on phones
**Ideal path**: 4 — tap row, read, tap Next message, read
**Alternate paths**: Touch "More" menu on row for Mark read.
##### Steps
1. Tap the row → full-screen dialog (h-dvh), title from the row subject, header shows a grey skeleton, body skeleton.
2. Wait → header and body appear when `inbox.get` returns; if first 3 rows or neighbours were prefetched it is instant, otherwise a delay.
3. Tap "Next message" (ChevronDown) → next row; neighbours get prefetched so it often opens at once (cache of 40, FIFO).
4. A load error shows red text with "Try again" below the toolbar while the header skeleton stays.
5. Tap the "Close" X → returns via history to the list (or removes `mail`).
##### Variations
- No keyboard: `j/k/e/r/a/f` are unavailable, so chevrons and buttons are the only navigation.
- Rotate to a wide screen: becomes 768px centered dialog.
##### Edge Cases
- Once cache entries are evicted (over 40) a revisit re-fetches.
- Cached message bodies are never invalidated in the session, so a message edited upstream (rare) or one he marks read will not change; stale content is unlikely but the header "unread" state comes from the row, not the cache.
- While the error is shown the action buttons never appear (they require `message`).

**Related**: STORY-021, STORY-031, STORY-048



### Topic: act-on-email

#### STORY-040: Quick reply to one email with keyboard only
**Type**: short
**Topic**: act-on-email
**Persona**: Marisol Vega, operations lead at a 12-person logistics startup, 140 unread, clearing a morning backlog
**Goal**: Answer a vendor's yes/no question with two lines and move on.
**Preconditions**: One Gmail account connected; message list loaded; no filter/search active.
**Ideal path**: 5 — j to select, Enter to open, r, type, Cmd/Ctrl+Enter.
**Alternate paths**: Click row, then "Reply" button in the dialog (`InboxMessageDialog.tsx:251`); from a chat email card, open card then same "Reply" button.
##### Steps
1. Press `j` until the vendor row is highlighted (list keyboard, disabled while typing) → row gets selected styling.
2. Press `Enter` (or `o`) → message dialog opens, URL gets `?mail=<id>`.
3. Press `r` → composer dialog titled "Reply" opens; preview hides (`invisible`); quoted original is collapsed behind a "Show quoted text" toggle; focus lands at start of body (not To, because To is prefilled).
4. Type "Yes, Thursday works." → after 1.5 s of pause a small "Draft saved" notice appears (`AUTOSAVE_MS`).
5. Press Cmd/Ctrl+Enter → composer closes at once; bottom-center toast "Sending..." with an "Undo" button. After 5 s: "Sent" for 3 s, and the Inbox list reloads (`MAIL_SENT_EVENT`).
##### Variations
- Marisol hesitates at step 3: she cannot see the quoted text and wonders if the thread is included. It is sent (comment in code: "hides its quoted original until asked; it is still sent"), but nothing says so besides the "Show quoted text" label.
- Pressing `Send` with the mouse instead: same hold. The Send button is the only confirmation; no "Are you sure".
##### Edge Cases
- The dialog preview is hidden, not closed: after the composer closes the message dialog returns, so she must press Esc or `e` to get back to the list. She expects to land back on the list after sending (gap: no "send and archive / send and next").
- `r` works only inside the dialog; from the list it does nothing (help dialog does not say so).
- The "Draft saved" notice appears while she is typing and is visual only; it is not a status she checks, but it reassures her that closing is safe.

**Related**: STORY-037, STORY-048, STORY-050


#### STORY-041: Reply all to a team thread, then change her mind with Undo
**Type**: medium
**Topic**: act-on-email
**Persona**: Tomasz Kowal, project manager, replying to a 6-recipient scheduling thread
**Goal**: Reply all with a new time, but pull it back when he spots a mistake.
**Preconditions**: Open message has 5 To/Cc recipients.
**Ideal path**: 8 — open, `a`, edit, send, Undo, fix, send.
**Alternate paths**: "Reply all" button in the dialog; there is no way to switch Reply to Reply all inside the composer (observed gap: he must close and reopen).
##### Steps
1. Open the thread's row with `Enter` → dialog shows "to ..." and "cc ..." on one truncated line each.
2. Press `a` → composer "Reply all" opens; To/Cc prefilled. With more than 3 recipients (`COLLAPSE_OVER = 3`) the rows fold into one summary line ("Ana, Priya, Sam +3 more") until he focuses it.
3. He clicks the summary → rows expand into chips (To, Cc fields).
4. Types "Moving to 3pm Friday." and presses `Send` → toast "Sending..." + "Undo".
5. Two seconds later he notices he wrote Friday, not Thursday. Clicks "Undo" in the toast → the composer reopens exactly as it was (`undoSend` -> `restoring`), including recipients, body, attachments.
6. He edits the text and presses `Send` again → new 5 s hold with a new send; the earlier held send never ran.
7. Wait → "Sent".
##### Variations
- If he sends a second message while the first is still held, the first goes out immediately (`hold()` fires the previous one) - he loses its Undo window silently.
##### Edge Cases
- Undo window is 5 s and the toast is at the bottom center; if he is looking at the composer area he may miss it.
- After the hold ends the "Sending..." toast has no Undo (`undoable: false`) while the request is in flight; no way to cancel.
- Info appears twice: recipient summary in the composer and "to/cc" in the dialog, but Bcc is never shown in the dialog.


#### STORY-042: Forward an invoice with its attachment to the accountant
**Type**: medium
**Topic**: act-on-email
**Persona**: Hannah Berg, freelance designer, forwarding a client's invoice PDF to her bookkeeper
**Goal**: Forward the message including the original attachment and a one-line note.
**Preconditions**: Message has a 2.1 MB PDF attachment.
**Ideal path**: 6 — open, `f`, type recipient, note, Send, done.
**Alternate paths**: "Forward" button in the dialog; from a chat email card via the same dialog.
##### Steps
1. Open the invoice row → dialog shows an attachment chip with filename and size.
2. Press `f` → composer "Forward" opens. Focus starts in To (not body). Original attachment appears as a chip in the "Attachments" region (`forwarded`), no upload needed.
3. Types "books@" and chooses/enters the address, presses Enter or comma → address becomes a chip.
4. Tab down → caret lands above the forwarded block; types "Please book against March."
5. Presses `Attach files` (paperclip) to add her own timesheet.xlsx → chip added, counted toward the 10 MB total with the forwarded file.
6. Presses `Send` → "Sending..." + "Undo", then "Sent".
##### Variations
- If forwarded attachments exceed 10 MB: notice "Attachments can't be over 10 MB." (`attachmentsTooLarge`) at load time; she must remove the file with the chip's "Remove <filename>" button.
- Drag a file onto the composer: overlay "Drop files to attach".
##### Edge Cases
- Hesitation: she wonders whether the original PDF really goes (server re-attaches it via `forwardOf`); the chip is the only proof.
- Autosave drafts do not include attachments (`ComposeEmail.tsx` comment), so if she presses Close with her own attached file she gets "Discard attachments?" with "Keep editing" / "Discard".
- No scheduling or "send later", which she would want for the bookkeeper's morning (observed gap).


#### STORY-043: Compose from the second account (multi-account From)
**Type**: medium
**Topic**: act-on-email
**Persona**: Dev Anand, consultant with a personal Gmail and a "dev@anandlabs.example" work Gmail
**Goal**: Write a new message to a client from the work account while the Inbox shows All.
**Preconditions**: Two accounts connected; account tabs visible ("All", plus one per account).
**Ideal path**: 6 — click work tab, `c`, To, Subject, body, Send.
**Alternate paths**: Stay on "All", `c`, then change the "From" select. "Compose" icon button instead of `c`.
##### Steps
1. On the "All" tab he presses `c` → composer "New message" opens; the From select defaults to the first account (`accounts[0]`) because `connectionId={tab}` is empty on All.
2. He reads the "From" row and sees the personal address preselected - the wrong one. Hesitates: the row labels match tab labels that truncate at 160 px.
3. He picks the work address in the "From" select (NativeSelect, aria-label "From").
4. Types the client address in To, "Subject" line, body.
5. Presses `Send`; toast "Sending..." and Undo.
6. After "Sent", he checks the list: nothing says which account sent it (no Sent view in the app; observed gap - "Check Sent" is advice but there is no Sent folder UI).
##### Variations
- If he first clicks the work tab, From defaults to that account (`connectionId={tab}`) - discoverable only by accident.
- Single-account users never see the From row.
##### Edge Cases
- Changing From after typing: autosave rewrites the draft; a draft was already saved under the first account (the payload carries `connectionId`), so a stale draft can remain in the old account's Drafts (unverified; flag for server check).
- Replies keep the original recipient account and cannot be switched (no picker, `accounts={[]}`).

**Related**: STORY-005, STORY-012, STORY-019, STORY-059


#### STORY-044: Send fails, outcome unknown, and she must not duplicate it
**Type**: medium
**Topic**: act-on-email
**Persona**: Grace Okafor, office manager, on hotel Wi-Fi, sending a payment confirmation
**Goal**: Be sure the confirmation went exactly once.
**Preconditions**: Flaky network or server returns `status: unknown`/`failed`.
**Ideal path**: 7 — send, read banner, check Gmail Sent elsewhere, then discard or resend.
**Alternate paths**: Gmail reconnect/disabled outcomes show different text; none offer a direct fix link.
##### Steps
1. Grace composes the reply and presses `Send` → "Sending..." with Undo.
2. After 5 s the toast changes to "Sending..." without Undo; the request fails.
3. The composer reopens automatically (`restoring`) with a red notice: "Not sent. Couldn't send. Try again." (`notSent(problemText)`).
4. She presses `Send` again → same `clientId`, so the server keys it and never sends twice.
5. This time the server answers `unknown`: composer reopens with "Not confirmed as sent. Check Sent before trying again." (no "Not sent" prefix).
6. She switches to Gmail in another tab to check Sent (the app has no Sent view or link), finds it was sent.
7. She returns and presses Discard (trash icon, tooltip "Discard") → composer closes and "Draft discarded" + Undo appears for 5 s.
##### Variations
- `reconnect`: "Gmail needs to be reconnected." Fix is in the Integrations overlay, but the composer has no link there.
- `disabled`: "Sending is turned off."
- Draft autosave failing shows "Couldn't save the draft" in the same notice slot.
##### Edge Cases
- Closing the tab inside the 5 s hold sends nothing and loses the message (documented in `outbox.ts`); she may think "Sending..." means it is on its way.
- While sending the composer is locked (spinner on Send, `aria-busy`), and `close()` is ignored.
- Errors sit in the same place as "Draft saved", so a green/neutral reassurance and a red failure compete for attention.

**Related**: STORY-023, STORY-058, STORY-059, STORY-062


#### STORY-045: Close the composer mid-sentence and come back to the draft
**Type**: short
**Topic**: act-on-email
**Persona**: Luca Ferri, sales rep pulled into a call mid-reply
**Goal**: Leave a half-written reply and finish it later without losing text.
**Preconditions**: Reply composer open with three sentences typed.
**Ideal path**: 4 — close, reopen reply on same message, text is back.
**Alternate paths**: Discard (trash) and then Undo within 5 s to get it back.
##### Steps
1. Types a paragraph; "Draft saved" appears after a pause.
2. Presses the X close (aria "Close") or Esc → no prompt (no attachments); the draft is remembered (`rememberClosed`) and the dialog closes.
3. Later, opens the same message and presses `r` → composer reopens with his text (`recallClosed(seed)`), caret restored.
4. Finishes, presses `Send`.
##### Variations
- Presses Discard with text: composer closes and toast "Draft discarded" + "Undo"; after 5 s the Gmail draft is deleted.
- Attached a file: closing asks "Discard attachments?" - the choices are "Keep editing" and "Discard"; there is no "Save draft anyway" option, so he must choose between losing files and staying.
##### Edge Cases
- Untouched reply: closing discards silently (nothing to keep).
- Draft memory is per message seed; there is no "Drafts" list in the web Inbox, so a user who forgot the message has no way to find the draft except Gmail Drafts (observed gap).
- Same draft exists on two surfaces: in-app memory and Gmail Drafts folder; edits made in Gmail are not reflected.


#### STORY-046: Ask the Inbox agent to find urgent mail and show cards
**Type**: medium
**Topic**: act-on-email
**Persona**: Priya Natarajan, finance director with 300+ unread after vacation
**Goal**: Let the agent surface what needs an answer today, then reply to the top one.
**Preconditions**: Inbox agent created; panel expanded.
**Ideal path**: 7 — type request, read cards, open top card, `r`, write, Send.
**Alternate paths**: Collapse the panel and use "Needs reply" group in the list; scan the Today group; use search.
##### Steps
1. On `/app/inbox` she sees the right panel `data-testid="inbox-agent-panel"`. First time: a single "Create Inbox agent" button (error text if it fails: "Could not create the Inbox agent"). She clicks it.
2. Types in the chat: "What needs my reply today?" and sends.
3. The agent calls `mail_search`/`mail_grep`/`show_emails`; chat shows email cards grouped under "Today", "Within 3 days", "This week", "Later" (`EmailCards.tsx`). Each card: sender, relative time, subject, 2-line snippet, optional paperclip with count (aria "Attachments: N"). "Later" renders as a compact list.
4. She clicks the top card → the same message dialog opens (no Archive / Mark read: chat cards omit them).
5. Prev/next chevrons walk the cards in on-screen order (`ordered`).
6. Presses `r`, writes, `Send`.
7. After "Sent" she returns to the chat; the card still shows no replied/done state (observed gap).
##### Variations
- Panel collapsed: "Show Inbox agent" icon button in the header; on phones it starts collapsed. She may not notice the panel because the icon has no text.
- Compare to the list's "Needs reply" group - same triage output but different surfaces; the agent grouping is by urgency, the list's by reply need.
##### Edge Cases
- Cards cap at 20 per message (`contracts/events.ts:95`); older/extra mail requires another prompt.
- Mail text is plain text only in cards (untrusted).
- Replies sent from a chat card trigger `MAIL_SENT_EVENT`, which reloads the Inbox list behind the panel - the list can silently re-sort.

**Related**: STORY-006, STORY-047


#### STORY-047: Have the agent draft a reply and approve the action
**Type**: long
**Topic**: act-on-email
**Persona**: Jonas Lindqvist, founder who delegates routine answers; hates typing on his phone
**Goal**: Get a polite decline drafted, review it, and actually send it.
**Preconditions**: Inbox agent exists; approval rule "Ask before email actions" is in effect (default).
**Ideal path**: 14 — ask, approve, find draft, send (no in-app handoff makes this long).
**Alternate paths**: Write the reply himself (STORY-040); set "Allow email actions without asking" in settings to skip approvals.
##### Steps
1. In the Inbox agent chat, types "Decline the Acme meeting request politely, say we're full until March."
2. Agent searches (`mail_search`/`mail_get`) for the Acme thread; may show a card via `show_emails`.
3. Agent calls `mail_draft` with `replyToId`. An approval card (`AskCard.tsx`) appears with buttons "Allow once", "Always allow this tool", "Deny".
4. He hesitates on "Always allow this tool": does it cover mail_modify (archive) too? The label says "tool", the setting elsewhere says "email actions" - two vocabularies.
5. He clicks "Allow once" → card state reads "Allowed once". (Deny reads "Denied".)
6. Agent replies: the draft is saved in his Drafts folder (tool description tells it to say so).
7. He looks in the Inbox for the draft: nothing in the list; no Drafts view and no "Open draft" button in the composer entry points (observed gap).
8. He opens Gmail Drafts in another tab, edits, sends there.
9. Back in Praci, the sent mail is not reflected (no `MAIL_SENT_EVENT` since sent outside); list refreshes on next sync/mount.
10. He asks the agent: "Archive that thread." → `mail_modify` approval card again; he picks "Always allow this tool" this time, card reads "Always allowed".
11. Thread leaves the list on next refresh.
##### Variations
- Deny: agent has to answer without the draft; no retry button.
- Settings (`ApprovalRulesSettings.tsx`): rules shown as "Ask before email actions" or "Allow email actions without asking" - the place to undo an "Always allow".
- After an approval card is answered it is "No longer active" if stale (`AskCard.tsx:133`).
##### Edge Cases
- The agent cannot send; Jonas expects it can ("do it for me") and has to learn that from the agent's reply.
- Multi-account: `mail_draft` requires `account` address when more than one account; the agent must ask which.
- The agent writes plain text only; formatting is lost vs the rich composer.
- This is the longest path to the same goal "reply fast"; the manual Reply path (5 steps) beats it unless the answer needs thought.

**Related**: STORY-006, STORY-046


#### STORY-048: Burn down the "Needs reply" group, mixing replies, undo and a to-do
**Type**: long
**Topic**: act-on-email
**Persona**: Aisha Rahman, customer success manager clearing 18 "Needs reply" threads before a 10 am meeting
**Goal**: Reply to the six that matter, archive the rest, tick the follow-up task.
**Preconditions**: Triage on and consented; two accounts (support@ and personal); "All" tab; the To do card shows 3 items.
**Ideal path**: 30 — roughly 5 steps per reply for 4 replies plus archive/skip cycle.
**Alternate paths**: Agent panel: "Show me urgent mail" then act via cards (STORY-046); filter chips are not helpful for this.
##### Steps
1. Opens Inbox. List shows "Needs reply" at top ordered by priority then date (`inbox-groups.ts`), then Today, Earlier.
2. Presses `j` to the first row, `Enter`. Dialog shows sender, full date, to/cc.
3. Reads body (HTML iframe). Remote images are per preference.
4. Presses `r`, types two lines, Cmd/Ctrl+Enter → toast "Sending..." + Undo.
5. Esc (composer closed already) → dialog visible again; presses `j` to go to the next message in the list (dialog j/k walk the list).
6. Second message needs only a quick "Thanks!"; `r`, type, send. The first send is still inside its 5 s hold, so the new send forces the first to go out right away (`hold()` fires the held one). The Undo for message 1 is lost without warning.
7. Third message is a question for the support lead: `f`, type address, note, send.
8. Fourth: pure FYI; presses `e` to archive. Dialog moves to the neighbour. Optimistic; no undo for archive (gap).
9. Fifth: from a different account (support@). Reply opens with the right sender automatically (taken from the message), no picker.
10. Sixth needs an attachment: `r`, clicks `Attach files`, picks a PDF, writes, Send.
11. Closes the dialog with Esc. List reloaded by `MAIL_SENT_EVENT`; replied threads leave "Needs reply" only after triage re-runs (silent reshuffle; she cannot tell which ones were handled).
12. Ticks the checkbox of the To do "Send revised quote" in the "To do" card; item stays visible for 24 h.
13. She wants a visible "replied" marker on rows; none exists (observed gap). She re-scans the group by memory.
##### Variations
- On mobile width: hover actions replaced by a "More" menu; reply/forward still via dialog buttons ("Reply", "Reply all", "Forward") without the keys.
- If a filter is active, `e` does nothing and the Needs reply group disappears.
##### Edge Cases
- Interrupted (call): she closes a half-written reply; it is remembered (STORY-045).
- Tab closed during hold: the last send is lost with no warning.
- Sending to a recipient with a typo: "Fix or remove the highlighted addresses." blocks Send.
- The same state ("Sent") appears only as a 3 s toast; there is no persistent sent log in the app.

**Related**: STORY-020, STORY-021, STORY-029, STORY-031, STORY-037, STORY-039, STORY-040, STORY-050, STORY-055


#### STORY-049: Fix a bad recipient and a too-large attachment before sending
**Type**: short
**Topic**: act-on-email
**Persona**: Kenji Watanabe, procurement analyst, rushing a quote to two suppliers
**Goal**: Get a valid send out with a large file.
**Preconditions**: New message composer open.
**Ideal path**: 6 — fix address, shrink attachment, send.
**Alternate paths**: none found for compressing; the app offers no link-sharing alternative (observed gap).
##### Steps
1. Types "sales@acme" in To and presses `Send` → red notice "Add a recipient." if empty, or a message naming the invalid address (one) / "Fix or remove the highlighted addresses." (several); invalid chips are highlighted.
2. Fixes the address chip.
3. Clicks `Attach files` and picks a 12 MB deck → notice "Attachments can't be over 10 MB." (10 MB total, max 20 files); file not added.
4. Picks a 6 MB version → chip with filename; "Remove <filename>" X on the chip.
5. Presses `Send` → "Sending..." + Undo, then "Sent".
##### Variations
- Drag-and-drop shows "Drop files to attach".
##### Edge Cases
- The 10 MB limit is lower than Gmail's 25 MB; he may think the app is broken. The notice does not state the sum so far.
- Cc and Bcc rows are hidden until their "Cc" / "Bcc" reveal links are clicked.



### Topic: keyboard-power-use

#### STORY-050: Open, triage and reply inside the dialog
**Type**: medium
**Topic**: keyboard-power-use
**Persona**: Devon Okafor, support manager answering customer threads
**Goal**: Read three messages in a row and reply to the second
**Preconditions**: Unfiltered list, several rows
**Ideal path**: 5 — `j`, `Enter`, `j`, `r`, type+send (composer is a mouse/Tab path for Send)
**Alternate paths**: `o` instead of `Enter`; click a row; Reply button in dialog
##### Steps
1. Press `j` → row selected.
2. Press `Enter` (or `o`) → `?mail=<id>` pushed with LIST_OPEN state; dialog opens full-width; list keys are now disabled (`enabled: !openId`, and a `[role=dialog]` exists).
3. Press `j` in the dialog → next message loads (prefetched for neighbours), `goToMessage` replaces the URL entry, so Back still returns to the list in one step.
4. Press `r` → composer opens in Reply mode, preview becomes `invisible`; dialog key handler suspends (`composing`).
5. Types reply; there is no keyboard send shortcut listed anywhere (observed gap; Send must be reached by Tab/click).
##### Variations
- `a` reply all, `f` forward use the same path.
- Opening does not mark the message read; there is no key for mark read/unread (observed gap), so Devon must click "Mark read".
##### Edge Cases
- `r`/`a`/`f` before the message body finishes loading do nothing (`message &&` guard, line 169); he presses `r`, nothing happens, hesitates, presses again.
- Keys are ignored when focus is inside the sandboxed iframe? Focus starts on the dialog itself (`initialFocus={popupRef}`), so keys work initially; after clicking into the HTML body, keydown events inside an iframe do not reach the document handler (inferred, verify in browser).
- `j` on the last message and `k` on the first do nothing, no feedback.

**Related**: STORY-027, STORY-037, STORY-040, STORY-048


#### STORY-051: Close the dialog and keep your place
**Type**: short
**Topic**: keyboard-power-use
**Persona**: Priya Raman, finance controller scanning invoices
**Goal**: Read message 7, close it, and continue from message 8 by keyboard
**Preconditions**: List with 20 rows, opened row 7 with `Enter`
**Ideal path**: 2 — `Esc` then `j`
**Alternate paths**: Browser Back (same effect when opened from the list); dialog close via Esc is the only visible close since `showCloseButton={false}`
##### Steps
1. Press `Esc` → Radix closes the dialog; `closeMessage` calls `navigate(-1)` because the entry is LIST_OPEN; `?mail` removed.
2. Focus returns: effect at `Inbox.tsx:388-402` focuses the row of `selectedId` in the next animation frame → row 7 (or whichever row she navigated to with `j/k` in the dialog, since `goToMessage` sets selectedId).
3. Press `j` → row 8 selected.
##### Variations
- She navigated 7 -> 8 -> 9 with `j` in the dialog, then `Esc`: list lands on row 9, not 7. She finds that natural.
- Opened via deep link `?mail=` (no LIST_OPEN): Esc replaces the URL without Back; selectedId may be unset, so focus return does nothing and `j` selects the first row (observed gap).
##### Edge Cases
- Closing the composer (not the preview) returns to the preview; a second Esc is needed to close the preview.
- Fast `Esc` then `j` inside the same frame can fire before the rAF focus, but selection state is already correct so it still works.

**Related**: STORY-008, STORY-022, STORY-034


#### STORY-052: Searching then trying to keep driving by keyboard
**Type**: medium
**Topic**: keyboard-power-use
**Persona**: Tomasz Wrobel, recruiter hunting `from:greenhouse.io` replies
**Goal**: Search, walk results, archive the stale ones
**Preconditions**: List loaded, focus on body
**Ideal path**: 6 — `/`, type query, `Enter`, escape the input, `j`, `e` (the escape-the-input step is the missing piece)
**Alternate paths**: Click a result row (then j/k work because focus is on a button, not an input)
##### Steps
1. Press `/` → search input focused (`focusSearch`).
2. Type `from:greenhouse.io`, press `Enter` → q param set, results load (server-side Gmail). Focus stays in the input.
3. Press `j` → a "j" is typed into the search box; list handler returns early on `input` targets (`inbox-keyboard.ts:27-28`). Tomasz hesitates.
4. Press `Esc` → clears the draft and the query (`Inbox.tsx:424-428`), so the results vanish instead of just leaving the box. There is no key to blur the box and keep results (observed gap).
5. Instead he presses `Tab` to leave the input; focus lands on the next control (Filter), which is not a `role=menu` so keys work, but `Enter` on a button does not open a row.
6. Finally `j` selects a result. Then presses `e`.
##### Variations
- Selecting a Gmail filter (Unread, Starred...) behaves like search for step 6.
##### Edge Cases
- `e` does nothing while `filtered` (`archive: filtered ? undefined : archive`, `Inbox.tsx:380`) and the dialog hides Archive too. No message explains why; the Help dialog still lists `e Archive`. This is the key blocker for blasting through filtered views like Unread.
- Filter dropdown items are `role=menu`; keys are ignored while focus is in the menu; after choosing, focus returns to the trigger button, which is fine.
- Account tabs are `role=tablist`: after clicking an account tab, j/k are ignored until focus leaves it (arrow keys are used by the tablist).

**Catalog note**: Merged from search-gmail-syntax STORY-007 (Esc/Clear keyboard flow). Added detail: typing `/` to focus does not insert a slash; Esc with an empty box and no `q` does nothing; Esc inside the message dialog closes the dialog first and leaves the search; the native search cancel button is hidden by CSS leaving only the custom X; the Help dialog lists `/` but not Esc-to-clear.
**Related**: STORY-002, STORY-007, STORY-011, STORY-012, STORY-014, STORY-024, STORY-033


#### STORY-053: Discover the shortcuts with `?` and find the help incomplete
**Type**: short
**Topic**: keyboard-power-use
**Persona**: Hannah Cole, ex-Gmail power user new to Praci
**Goal**: Learn what keys exist
**Preconditions**: Inbox list, focus on body
**Ideal path**: 1 — `?`
**Alternate paths**: none found (no toolbar help button, no tooltip hint)
##### Steps
1. Hannah tries Gmail habits: `j` works, `x` (select) does nothing, `#` does nothing, `u`/`g i` do nothing. No bulk select exists.
2. She presses `?` → "Keyboard shortcuts" dialog (`InboxShortcuts.tsx`) with j, k, Enter, /, c, e, r, a, f, Esc. List keys are suspended while it is open (`!help`).
3. She reads it as one flat list: it implies `r`, `a`, `f` work from the list. She selects a row and presses `r` → nothing (they are dialog-only).
4. Presses `Esc` → help closes.
##### Variations
- Help omits `o`, ArrowUp/ArrowDown, `?` itself, and that j/k/e/r/a/f mean different things in list vs message view. `e` also silently disappears when filtered.
- Pressing `?` inside the open message dialog does nothing (dialog handler has no `?` case; list handler is disabled).
##### Edge Cases
- `?` needs Shift on most layouts; `event.key === "?"` works for that.
- The help dialog's presence is also a `[role=dialog]`, so even if `help` state were out of sync the DOM check would still block list keys.
- Strings `Next message`/`Previous message` are in `locales/en/messages.po`; non-English locales may fall back (not verified).


#### STORY-054: Compose with `c` and get back to the list
**Type**: medium
**Topic**: keyboard-power-use
**Persona**: Jonas Weber, founder firing off quick notes between meetings
**Goal**: Start a new message from the keyboard, discard it, and resume triage
**Preconditions**: At least one connected account (otherwise `c` is a no-op: `compose` is undefined)
**Ideal path**: 3 — `c`, type, `Esc`/Discard then `j`
**Alternate paths**: Compose icon button in header
##### Steps
1. Press `c` → composer opens (`composing` true disables list keys).
2. Types recipient and subject; typed letters like `e`, `c`, `j` go to inputs safely.
3. Closes/discards the composer → `composing` false. The Inbox does not restore focus to the compose trigger or a row (the row-focus effect only runs after the message dialog closes, `Inbox.tsx:388-402`), so focus is on body; `j` still works because the listener is on window.
##### Variations
- Sent mail triggers `MAIL_SENT_EVENT` list reload; selection is preserved by id if the row is still there.
- Reply composer opened from a message: closing it returns to the preview, not the list.
##### Edge Cases
- Whether the first Esc in the composer closes it or asks "Discard attachments?" depends on ComposeEmail (outside this topic's files).
- Pressing `c` while in the Integrations overlay (`paused`) does nothing.


#### STORY-055: Long run: clear a crowded inbox end to end by keyboard
**Type**: long
**Topic**: keyboard-power-use
**Persona**: Aisha Bello, chief of staff returning from a week off, 140 messages, two accounts, triage on, Needs reply group on top
**Goal**: Get to a handled inbox with minimal mouse use
**Preconditions**: Unfiltered "All" tab, rows grouped Needs reply / Today / Earlier
**Ideal path**: 12 — mix of `j`, `Enter`, `r`, `e`; mark read/important still needs the mouse
**Alternate paths**: Sender feedback via row hover buttons "Mark important"/"Mark noise" (mouse only); Important toggle and Filter dropdown by mouse/Tab
##### Steps
1. Press `?` to refresh memory, `Esc` to close.
2. Press `j` → first Needs reply row selected. `Enter` to read.
3. In the dialog press `r`, write a reply, send (mouse/Tab for Send). Back in the preview press `e` → archives and `goToMessage(next)` moves to the next row's message; she keeps reading without returning to the list (good flow).
4. Presses `j` in the dialog to skip a message she wants to deal with later; it stays unread and un-archived.
5. `Esc` → list, focus on the last-viewed row. She presses `j` to continue.
6. Wants the unread ones only: Filter dropdown (mouse). Now `e` is dead (archive is disabled while filtered) and she must clear the filter to archive. She hesitates, assumes a bug.
7. Back on the unfiltered list she notices archived rows jumped around because triage polling (every 5 s, up to 6 times) re-sorted groups.
8. Tries `Shift+J`, `x`, `#`, `u`: nothing. Ends with ~40 rows still needing a mouse for mark read.
##### Variations
- Archive last remaining message from the dialog: no neighbour, so `closeMessage()` is called and she lands on the list with nothing selected.
- Switching account tab with the mouse: keys ignored while the tablist has focus.
##### Edge Cases
- Held-down `j` moves one row per key repeat, scrolling `block: "nearest"`; there is no jump to top/bottom (`g`/`G`) and no page keys.
- Default list is a single page of up to 200 rows; filtered lists need the "Load more" button, which has no key.
- Archive and mark-read failures reload the list (`change()` catch), so a row may reappear under her cursor with only an error banner.

**Related**: STORY-020, STORY-024, STORY-029, STORY-048



### Topic: empty-error-sync-states

#### STORY-056: First visit with no Gmail connected, Connect mail round trip
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Priya Raman, new hire at a 12-person design studio, just joined her team's Praci space and clicked "Inbox" in the sidebar for the first time
**Goal**: Get her Gmail showing in the Inbox
**Preconditions**: Signed in, no mail account connected, Gmail plugin not yet set up.
**Ideal path**: 3 — Inbox button, "Connect mail", finish Gmail OAuth in the overlay, then close it.
**Alternate paths**: Open Integrations/plugins from elsewhere in the app and connect Gmail, then go to Inbox (not pre-filtered to "gmail").
##### Steps
1. Click "Inbox" in the sidebar → `/app/inbox`; page shows 5 grey skeleton rows (`aria-busy`, I:588-593) until the first `inbox.list` returns.
2. Think "Is this broken? Where's my mail?" Skeletons clear → body is only a centered "Connect mail" button, no explanation text (I:582-587; API returns `accounts: []`, API:~318).
3. Click "Connect mail" → Integrations overlay opens with query pre-filled to "gmail" (Shell:3826-3829); Inbox goes `paused` so it makes no calls while the overlay is open (I:150).
4. Complete the Gmail connection in the overlay, then close it → `paused` flips false, list reloads (I:170) and `inbox.refresh` runs (I:219-237).
5. Skeletons show again while the first sync runs (`!filtered && rows.length===0 && !synced`, I:274-277) → rows appear under Needs reply / Today / Earlier, sidebar unread badge refreshes via `onRefreshed`.
##### Variations
- User closes the overlay without finishing OAuth: page reloads back to the lone "Connect mail" button with no message that nothing changed.
- A big mailbox: step 5 skeleton lasts longer; there is no "Syncing your mail..." text, so she may think it is stuck.
##### Edge Cases
- Observed gap: the empty state has no heading or sentence about what Connect mail does or that only Gmail is supported.
- Observed gap: the page doesn't say which step is current (connect vs sync); both look identical to the skeleton.
- Keyboard `c` (compose) is inert with no account (see discovery), so pressing it does nothing visible.


#### STORY-057: Mailbox truly empty vs still syncing ("No mail")
**Type**: short
**Topic**: empty-error-sync-states
**Persona**: Marcus Oyelaran, freelance photographer who just connected a brand-new Gmail address he uses for bookings
**Goal**: Tell whether the Inbox is empty or broken
**Preconditions**: One Gmail account connected, zero messages in the last 14 days, sync succeeds.
**Ideal path**: 1 — open Inbox and read the empty state.
**Alternate paths**: none found.
##### Steps
1. Open Inbox → skeletons (I:588) until list plus first `refresh` complete.
2. After sync completes → plain centered "No mail" (I:615-619); no illustration, no "all caught up" copy, no last-synced time (`syncedAt` is returned but not shown).
3. Marcus thinks "Is that real, or did the sync fail?" → no banner is shown, which he must infer means success.
##### Variations
- Mail older than 14 days exists in Gmail: the cache window is 14 days (discovery), so "No mail" can be shown while Gmail has older messages; only search reaches them.
##### Edge Cases
- Observed gap: "No mail" is the same string whether the inbox is empty by choice or the window excluded older mail.
- If sync fails and there are zero rows, `failed ? null` (I:595) hides "No mail" entirely, so only the red banner shows over a blank body (see STORY-058).

**Related**: STORY-003, STORY-006, STORY-010, STORY-013, STORY-017, STORY-020, STORY-021


#### STORY-058: "Couldn't reach Gmail." with a blank list
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Dana Whitfield, ops manager on hotel Wi-Fi that drops intermittently
**Goal**: Get her mail to load
**Preconditions**: Account connected, first-ever sync fails with a network or Gmail error, so `lastErrorAt` is set and `needsReconnect` is false; no cached rows.
**Ideal path**: 2 — read the banner, click "Try again".
**Alternate paths**: Reload the page (re-runs sync on mount, I:219); leaving and re-entering Inbox does the same.
##### Steps
1. Open Inbox → skeletons, then `refresh` fails or reports the account failed; `setSynced(true)` still runs (I:228-232), so skeletons end.
2. Red `role="alert"` row: "Couldn't reach Gmail." with an outline "Try again" button (I:573-579, `syncErrorText`); below it nothing, since `failed` suppresses "No mail" (I:595). Dana thinks "Is my mail gone?"
3. Click "Try again" → `retry` clears error, bumps `attempt` (re-sync) and `reload` (I:262-266); skeletons or old state while retrying.
4. Network returns → sync succeeds, banner disappears (failedAccounts empty), rows render.
##### Variations
- Failure only on one of several accounts: banner still reads the same generic text and doesn't name the account; other accounts' cached rows render below it (see discovery).
- Retry fails again: banner reappears with the same text and no count or timestamp, so she can't tell whether the click did anything.
##### Edge Cases
- Observed gap: no indication of which account failed or when it last synced.
- Observed gap: while retrying there's no pressed/busy state on "Try again".
- The banner uses `text-destructive` only; no icon.

**Related**: STORY-023, STORY-044, STORY-059, STORY-062


#### STORY-059: "Gmail needs to be reconnected." and the missing Reconnect action
**Type**: long
**Topic**: empty-error-sync-states
**Persona**: Tomasz Kowalski, founder whose Google password change revoked Praci's token last week
**Goal**: Restore mail access
**Preconditions**: Gmail account connected earlier; Google refuses the refresh token, so `MailSyncState.needsReconnect` is true and `lastErrorAt` set; cached rows (14-day window) still present.
**Ideal path**: 4 — read banner, open Integrations (no direct link), reconnect Gmail, return and reload.
**Alternate paths**: "Try again" first (re-syncs, fails again); Inbox "Connect mail" button exists only when zero accounts, so it isn't offered here.
##### Steps
1. Open Inbox → cached rows appear under groups, plus red banner "Gmail needs to be reconnected." and a "Try again" button (`reconnectAccounts` nonempty, `syncErrorText`; API:395-399).
2. Tomasz thinks "Reconnect where? " and clicks "Try again" → sync re-runs; same banner returns because the token is still revoked.
3. He browses the cached rows (hover Archive etc.); actions may now fail since Gmail rejects them (see STORY-062).
4. He has to find Integrations on his own (sidebar or settings, no link from the banner) and reconnect Gmail; the "Connect mail" shortcut isn't available because accounts.length > 0 (I:582).
5. Back in Inbox, the page reloads on overlay close only if he opened the overlay via the Inbox's own paused flow; otherwise a navigation re-runs sync on mount → banner clears and fresh mail appears.
##### Variations
- Two accounts, only one needs reconnect: banner is identical to a single-account failure and doesn't say which one.
- Reconnect error text is "reconnected" while the plugin UI may say connect/reauthorize: wording mismatch not verified here.
##### Edge Cases
- Observed gap: the banner is text plus Try again only; no Reconnect button despite the app already having a gmail-filtered Integrations overlay (Shell:3826).
- If `failedAccounts` is non-empty but `reconnectAccounts` is empty the copy flips to "Couldn't reach Gmail." (`inbox-sync-error.ts:9-11`), so a mixed failure shows the reconnect message if any account needs it.
- Search/filter views re-use the same banner (`failed` is computed for any `shown`).

**Related**: STORY-005, STORY-012, STORY-019, STORY-023, STORY-043, STORY-044, STORY-058, STORY-062


#### STORY-060: "Let Praci sort your mail" consent card
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Elena Vasquez, privacy-conscious lawyer who just got a model configured for her workspace
**Goal**: Decide whether to let the AI see her mail metadata, and understand what happens next
**Preconditions**: Gmail connected, usable model, no AI consent for that recipient (`triageBlocked.reason="needs_consent"`).
**Ideal path**: 1 — click Allow on the card.
**Alternate paths**: Revoke or grant per-model via the "AI data sharing" switches in settings (`AiDataSharingSection`, A:57); ignore the card and use the Inbox untriaged.
##### Steps
1. Open Inbox → above the list a region card: "Let Praci sort your mail" / "Senders, recipients, subjects and short previews are sent to {model name}." with an "Allow" button (A:36-52). It replaces the To-do card position (I:624-632) and shows only on the unfiltered, unsearched view.
2. Elena thinks "Sent to whom, and does the body go?" The copy lists senders, recipients, subjects and previews but has no link to the settings or privacy page → she decides on that text alone.
3. Click "Allow" → button disables (`pending`), `allowRecipient(key)` runs, then `onAllowed` bumps `attempt` (re-sync, which queues triage) and `reload` (I:626-631).
4. List reloads; after sync the card is gone and the To-do card, labels and "Important"/category controls appear once triage finishes (STORY-061).
##### Variations
- Allow fails (network): inline `role="alert"` red error in the card, button re-enabled (A:42-46).
- Elena applies a search or filter first: the card is hidden (`filtered || narrowed`), so she may think it vanished.
##### Edge Cases
- Observed gap: no "Not now" or Dismiss; the card persists on every visit until allowed.
- Observed gap: no mention in the card that she can revoke later, nor where (settings "AI data sharing").
- No model configured at all: `no_model` reason shows no card and no explanation of why sorting is absent.

**Related**: STORY-017, STORY-018, STORY-025, STORY-030, STORY-061


#### STORY-061: After Allow, the list reshuffles while triage runs
**Type**: long
**Topic**: empty-error-sync-states
**Persona**: Hiro Tanaka, product manager with ~60 emails in the last two weeks who just clicked Allow
**Goal**: Work through his mail while triage is applied, without losing his place
**Preconditions**: Consent just granted, triage enabled, messages untriaged (`triagePending: true`, API:401).
**Ideal path**: 2 — wait for polling to settle, then act on the grouped list.
**Alternate paths**: Reload the page after triage completes; start archiving immediately from the plain list.
##### Steps
1. Allow clicked → list reloads and shows Today/Earlier only, no labels, no Needs reply group, and the unfiltered To-do card absent or empty.
2. Triage runs server-side after sync; the page re-fetches every 5 s up to 6 times while `triagePending` (`TRIAGE_POLL_MS`, `TRIAGE_MAX_POLLS`, I:208-216). Hiro thinks "Why did that row just move?"
3. Rows silently jump into Needs reply; badges ("Needs attention", "Newsletter") appear on rows. No "Sorting your mail..." message, no spinner.
4. He had selected row 4 with `j`; the list reorders under his selection (selection is by id, so the highlight follows the row to a new position and may scroll away).
5. After the final poll the To-do card loads (refetch when pending clears, I:198-206). If triage takes longer than ~30 s, polling stops and rows stay partly unsorted until the next visit/sync.
##### Variations
- He opens a message with `Enter` mid-reshuffle: the dialog's prev/next order (`ids`) changes as groups change.
- Triage never completes (model error): no error is surfaced here; the list just stays unlabeled.
##### Edge Cases
- Observed gap: no visible indication that triage is in progress or has stopped polling.
- Observed gap: `polls.current` resets on each sync, so a manual "Try again" can restart the 30 s polling.
- A new group "Needs reply" appearing above Today pushes the rest of the list down mid-scan.

**Related**: STORY-017, STORY-018, STORY-025, STORY-030, STORY-060


#### STORY-062: Archive or mark read fails after the row has already moved
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Sam Okafor, support lead clearing 40 messages quickly with hover buttons and `e`
**Goal**: Know whether each archive or read toggle actually stuck
**Preconditions**: Gmail account connected; the token has been revoked or the network drops mid-session.
**Ideal path**: 1 — each action is one click or keypress (optimistic).
**Alternate paths**: Dialog buttons, `e` in dialog, or the touch "More" menu for the same actions.
##### Steps
1. Press `e` on a row → row disappears at once and selection moves to the neighbour (I:301-309); the API call is in flight.
2. The call fails → red banner with the error text from `errorText(cause)` appears and the list reloads (I:288-294), so the row reappears. Sam thinks "Didn't I archive that?"
3. Banner shows a generic message plus a "Try again" button (I:573-579), which re-runs the sync, not the failed archive; he must archive the row again by hand.
4. He toggles "Mark read" on another row: the dot disappears at once; failure reverts through the same reload path.
5. "Mark important"/"Mark noise" differ: failure restores the previous mark specifically and clears the toast (I:311-324); the 6 s "Marked important" + Undo toast is cleared.
##### Variations
- Rapid-fire archives: one failure triggers a reload that can bring back several optimistic rows if the others also failed.
- Dialog open on the archived message: dialog moves to the neighbour first; on failure the list reloads but the dialog stays on the neighbour.
##### Edge Cases
- Observed gap: the banner doesn't say which message or action failed, and the row reappears silently where it was.
- Observed gap: archive success has no confirmation or undo, so Sam can't tell success from pending.
- Error banner clears on the next action (`setError("")`), possibly before he read it.

**Related**: STORY-023, STORY-044, STORY-058, STORY-059



## Redundancy Candidates

### Duplicate paths (same goal, several routes)
- Archive: row hover button, dialog button, `e` in list, `e` in dialog, touch More menu, agent `mail_modify`. All disabled or absent under search/filter except the agent. Candidate: keep `e` plus one visible control; explain when unavailable. (011, 023, 024, 033, 048)
- Mark read/unread: row hover button, dialog button, More menu; no keyboard. (027)
- Open a message: click, Enter, `o`, `?mail=` deep link, chat email card, prev/next chevrons, `j`/`k` in dialog. Chevrons and `j`/`k` do the same thing. (001, 033, 034, 050)
- Reply: `r`, Reply button, from a chat card; Reply all and Forward likewise. Reply vs Reply all cannot be switched inside the composer. (040, 041, 042)
- Compose: `c`, Compose icon, and Reply/Forward. From picker only on New message; account tabs also set the default From. (043, 054)
- Clear a narrowed list: Esc in the box, X "Clear", "Clear search", "Clear filter", Filter menu "Clear", un-pressing Important, browser Back. Six controls for one intent, and each clears a different set of params. (010, 014, 017, 021)
- Find an old email: Search mail (live Gmail), Inbox agent (`mail_search`/`mail_grep`), Gmail filters (live), triage categories (cache only). The discoverable tools are the weakest for old mail. (002, 003, 006, 013)
- Narrow by sender/attachment/unread: Filter menu items vs Gmail operators typed in search. (009, 014, 015)
- Ask "what needs me": Needs reply group, Important toggle, To do card, agent "what needs my reply today". (018, 025, 028, 046)
- Drafts: in-app remembered draft per message, Gmail Drafts, agent `mail_draft`. (045, 047)
- Dismiss junk: Archive vs Mark noise vs Newsletter badge vs Newsletters category. (017, 023, 026)

### Duplicate information (same fact on several surfaces)
- Unread: sidebar badge, bold sender/dot per row, Unread filter, Mark read button; none shows a page total. (014, 027, 030)
- Sender and subject: row, dialog title, composer title, agent text, email card. Earlier thread content appears nowhere in-app. (006, 032, 037)
- Account name: tab label, composer From picker, never on the row or in the dialog. (005, 019, 043)
- Classification: row badge (4 labels), category filters, Needs reply group, Important toggle, to-do reason; `reason` and priority are not shown. (017, 025, 028)
- Same email as a Needs reply row and as a to-do with no link. (028, 048)
- Sent state: 3 s toast only; "Draft saved" vs error compete in the same slot. (044, 048)
- Date: row time and dialog full date (row lacks year). (002, 007)

### Overlapping features
- "Important" toggle (triage, `view=important`) vs "Important" Gmail filter item (triage OFF, `is:important`) vs per-sender Mark important vs "Needs attention" badge. Same word, four meanings. (017, 018, 030)
- "Updates" (Gmail tab) vs "Notifications" and "Newsletters" categories vs "Promotions". (016)
- Search box vs Inbox agent `mail_search`: two search engines with different reach and result forms (rows vs cards). (002, 006, 046)
- "Has attachment" filter vs `has:attachment` operator. (009, 020)
- Archive on row vs dialog vs `e`; mark-important/noise only on row, not in dialog. (023, 026, 033)
- Inbox agent panel vs list for triage ("what needs reply today" vs Needs reply group). (025, 046)
- "Try again" on the banner (re-sync) vs per-action retry (absent). (058, 062)
- Consent card vs Settings "AI data sharing" switches. (060)

## Gaps & Recommendations

### Coverage gaps (no story yet)

- Suspicious-sender triangle on rows
- Mobile (Expo) inbox: sections, account picker, To do, Connect mail
- Electron desktop host (same UI; shell, focus, deep links)
- Accessibility: screen-reader names, focus trap, tab order, contrast
- Window-resize transitions and dark/light themes
- Concurrent edits (Gmail changed elsewhere; stale list on tab focus)

Recommended additional stories: (1) Mobile Expo inbox walk (sections, account picker, To do, Connect mail, no search/filter); (2) Electron desktop smoke of the same flows (do not run the Electron e2e on a maintainer machine); (3) accessibility pass (aria names for icon-only buttons, focus trap in dialog, tab order, `role=menu` key handling); (4) resize across @md/@xl/@3xl and dark/light; (5) suspicious-sender triangle and Spam/Junk badges with seeded fixtures; (6) stale list after returning to the tab or after Gmail changes elsewhere.

### Product recommendations from the stories (observations to triage, not decisions)

- Explain or hide the disabled Archive: either enable archive for filtered/searched lists or show a one-line reason. Fixes the top recurring defect.
- Show the scope of the default list once (e.g. an end-of-list row: older mail is reachable by search). Fixes the second defect without adding persistent chrome.
- Make narrowing visible and consistent: one source of truth for what narrows the list, and do not silently drop search when a category is chosen.
- Add a quiet 'sorting' indicator or stop regrouping while the user has a selection or open message.
- Add a paperclip and account hint on rows (or show account in All view), and a year when not current.
- Complete the Help list or remove it from the key path; add a visible way to find it.
- Auto-mark read on open (or a setting), plus a keyboard shortcut for read/unread.
- Give the sync banner a Reconnect action that opens the gmail-filtered Integrations overlay, and name the failing account.
- Link To do items to their source message.
- Per AGENTS.md, any new user-facing copy needs a PR justification; prefer removing duplicates (Clear controls, duplicate Important) over adding explainers.
