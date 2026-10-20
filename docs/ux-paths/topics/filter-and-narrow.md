# Topic: filter-and-narrow

Code facts verified 2026-10-14 (Inbox.tsx = `apps/web/src/pages/Inbox.tsx`, params = `apps/web/src/lib/inbox-list-input.ts`, API = `apps/api/src/inbox.ts`).

Corrections to discovery.md found while reading code:
- A Gmail filter (Unread, Starred, Has attachment, Primary...) and search text DO combine: both are kept in the URL and AND-ed into one Gmail query (`inbox-list-input.ts:setInboxListParam` only deletes `view`/`category` when `filter` or `q` is set; API `inbox.ts:~268-275`). The silent clearing happens with the *triage* narrowers: picking a category or the Important toggle deletes `filter` AND `q` (and the search box empties via `useEffect(() => setDraft(query), [query])`, Inbox.tsx:172). Typing a search or picking a Gmail filter deletes `view`/`category`.
- Needs reply grouping is dropped only for `filter`/`q` lists (`filtered`, Inbox.tsx:97). Category and Important views keep Needs reply / Today / Earlier and keep Archive.
- The empty-state "Clear filter" button (`clearFilters`, Inbox.tsx:366) removes filter/category/view but NOT `q`; when a search is also active the empty state shows only "No results for ..." with "Clear search".
- The account tab is component state (`useState`, Inbox.tsx:105), not in the URL: it survives filter changes but not a reload or shared link.

Menu order (Inbox.tsx:481-516): triage ON = Unread, Starred, Has attachment | Primary, Promotions, Social, Updates | Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal | (Clear). Triage OFF = Unread, Starred, Important, Has attachment | Primary... (no categories, no toggle). Trigger is an icon-only button (aria-label "Filter") until something is chosen, then shows the chosen label and turns "secondary".

---

## STORY-001: Show only unread after a long weekend
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Marisol Okafor, operations manager, one Gmail account, 140 messages since Friday, triage ON
**Goal**: See only the messages she has not read, then get back to everything.
**Preconditions**: Signed in, one account connected, triage enabled and consented, 14-day cache populated.
**Ideal path**: 3 — open Filter, pick Unread, (later) Clear.
**Alternate paths**: Sidebar "Inbox" badge count shows the unread number but is not clickable to filter (it opens the inbox, unfiltered). Deep link `/app/inbox?filter=unread` (`readInboxListState`). Agent panel: ask "show unread" (email cards, no list filter).
### Steps
1. Click the icon-only Filter button (aria "Filter", `data-testid="inbox-filter"`) next to the "Important" toggle → radio menu opens with 3 groups of items; no group headings, only separators.
2. Click "Unread" (thinking: "Is this Gmail unread or Praci unread?") → menu closes (`closeOnClick`); `?filter=unread`; five skeleton rows while live Gmail query `is:unread` runs; then list; Needs reply group is gone, rows now just Today / Earlier. The button now reads "Unread" with a filled style.
3. Scan rows; notice no Archive hover button → Archive and the `e` key are disabled while a Gmail filter is on (`archive: filtered ? undefined`, Inbox.tsx:380,650).
4. Open Filter again, click "Clear" at the bottom (only present when active) → back to the default grouped list with To do card.
### Variations
- Picking the already-selected "Unread" radio does not toggle it off; user must find "Clear" at the bottom of the menu (hesitation: "how do I turn this off?").
- Triage OFF: "Important" appears in the first group as a Gmail filter instead (see STORY-005).
### Edge Cases
- Unread filter reads live Gmail, not the 14-day cache, so it can show mail older than 14 days that the default list does not show; no cue says so.
- Marking a row read while filtered patches it optimistically but the row stays in the Unread list until reload (`patchRows`, Inbox.tsx:216).
- Same information on multiple surfaces: sidebar badge count vs list Unread count; the list gives no count of results anywhere.

---

## STORY-002: Combine Unread with a sender search, then lose it to a category
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Tomasz Brandt, freelance bookkeeper, two accounts, triage ON
**Goal**: Find unread mail from one client, then peek at Bills, and return to the client mail.
**Preconditions**: Triage ON; client "Harlow Dental" has 3 unread and several read messages.
**Ideal path**: 6 — filter + search + category switch + redo; there is no single-step "back".
**Alternate paths**: Type `is:unread from:harlow` into Search mail alone (Gmail syntax works but is never hinted). Agent panel: "unread from Harlow".
### Steps
1. Click Filter → "Unread" → list narrows (live Gmail `is:unread`).
2. Click the "Search mail" box, type `harlow`, press Enter → `?filter=unread&q=harlow`; list re-queries as `is:unread (harlow)`; the Unread filter stays selected. Good: both apply. (There is no visible text saying the two are combined.)
3. Thinking: "Show me their invoices too." Click Filter → "Bills" → URL becomes `?category=billing`; `filter` and `q` are deleted; the search box empties itself; list switches to the cached 14-day Bills view with Needs reply grouping back.
4. Hesitation: the user wanted "Bills from Harlow" but gets all Bills. No toast or message explains that the search text was dropped.
5. Press browser Back → returns to `?filter=unread&q=harlow` (history entry per change), search box refills with "harlow".
6. Instead retype `harlow` + Enter while in Bills → `q` set, `category` deleted; user ends in Harlow-only (all mail), Bills lost.
### Variations
- Do 3 with the Important toggle instead of Bills: same clearing of `filter` and `q`.
- Start with search, then pick Bills: draft text vanishes the same way.
### Edge Cases
- Gap: cannot combine a triage category with search or a Gmail filter; the API would reject it with BAD_REQUEST ("A view or category cannot be combined with a filter or search", `inbox.ts:~282`), so the UI avoids it by silently dropping the other side.
- Search clearing is invisible when the input was not focused; the user sees a changed list and an empty box.
- Gmail-syntax workaround (`category:` is not offered; `label:`/`from:` typed manually) is undiscoverable.

---

## STORY-003: Cut promotional noise with Gmail tabs
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Priya Venkataraman, product designer, newsletter-heavy inbox, triage OFF (no model connected)
**Goal**: Look at only Primary mail to see real people first.
**Preconditions**: One account; no usable model so `enabled=false`; no Important toggle, no categories.
**Ideal path**: 2 — Filter, then Primary.
**Alternate paths**: Search `category:primary` by hand.
### Steps
1. Click Filter → menu shows Unread, Starred, Important, Has attachment | Primary, Promotions, Social, Updates (no categories, no consent card).
2. Click "Primary" → button label "Primary"; live Gmail `category:primary` list; Today/Earlier groups.
3. Hesitation: "Is 'Updates' here the same as the 'Notifications' category some people have?" With triage off this question never arises; with triage ON both "Updates" (Gmail tab) and "Notifications"/"Newsletters" (Praci category) sit in one menu with no hint of the different source.
### Variations
- Switch to Promotions to bulk-glance at deals; Archive is unavailable there too, so cleanup must be done in Gmail (no bulk actions exist in the web inbox).
### Edge Cases
- Gmail tab names depend on the user having Gmail tabs enabled; with tabs off, `category:primary` still runs and may return everything or nothing; no empty-state explanation beyond "No mail matches this filter" + "Clear filter".
- The label "Updates" is a shared msgid with Settings (`messages.po`: `src/pages/SettingsOverlay.tsx`), fine in English.

---

## STORY-004: Triage categories on a Monday morning
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Jun Aoki, startup founder, 180 messages in the 14-day window, triage ON, one account
**Goal**: Clear Security and Bills items first, then see what truly needs attention.
**Preconditions**: Triage on; most rows classified; a few new rows unclassified (`triagePending`).
**Ideal path**: 5 — category, scan, switch category, Important, Clear.
**Alternate paths**: To do card on the unfiltered list surfaces due items; Needs reply group at the top of the default list; agent: "what's on my email".
### Steps
1. Look at the default list: To do card, Needs reply, Today, Earlier (up to 200 rows, one dense line each). Thinking: "Too much; where are the bills?"
2. Click Filter (icon only) → scroll the 14-item menu; categories sit at the bottom under a separator, with no heading → click "Security".
3. List shows cached Security rows; Needs reply group still appears if rows qualify; hover actions Archive / Mark read / Mark important / Mark noise still work (not `filtered`). To do card is hidden (`narrowed`, Inbox.tsx:240).
4. Archive two phishing-looking rows with `e` after `j` selection → they vanish optimistically; `e` works here (it is disabled only for Gmail filter/search).
5. Filter → "Bills" → radio swaps to Bills; Security selection is replaced, no multi-select.
6. Click the "Important" toggle (outside the menu) → `?view=important`; `category` deleted; Filter button returns to outline (no label), toggle turns primary-coloured. Thinking: "Did Bills turn off? The Filter button looks empty now." Yes, it did.
7. Open Filter → "Clear" is NOT shown (no category/filter), so the way out is to unpress "Important".
### Variations
- Press Important first then pick a category: `view` is deleted and the toggle unpresses.
- Triage still sorting: category counts change silently as the 5 s poll (max 6) lands (`TRIAGE_POLL_MS`), so a freshly arrived bill may not appear in "Bills" for ~30 s; nothing says "sorting".
### Edge Cases
- Category views read the 14-day cache only (`WINDOW_MS`), cap 200; older bills require search.
- Two buttons that both mean "narrow" (toggle + dropdown) are mutually exclusive but look independent.
- Same classification appears as the row badge ("Needs attention", "Newsletter", "Spam"/"Junk") and as category filters, but a category such as Bills has no row chip, so the user cannot see why a row was in the list.

---

## STORY-005: The two different "Important"s
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Lena Morrow, consultant, one account; connects a model mid-week so triage turns ON
**Goal**: Show only important mail, and understand what "important" means.
**Preconditions**: Starts with triage OFF; consent given later.
**Ideal path**: 1 — click Important toggle (triage ON); 2 in triage OFF (Filter, Important).
**Alternate paths**: Search `is:important`. Starred filter as a manual stand-in.
### Steps
1. Triage OFF: open Filter → click "Important" (first group) → `?filter=important`; live Gmail `is:important` (Google's own machine-learned importance); archive disabled; Needs reply gone.
2. Allow triage (consent card "Let Praci sort your mail" → Allow) → list refreshes; "Important" now appears as a toggle left of Filter, and is REMOVED from the Filter menu.
3. If `?filter=important` is still in the URL (reload/bookmark), `InboxFilterSchema` still parses it: the list is Gmail-important, the toggle is NOT pressed, the Filter button shows label "Important" (`filterLabels` has it) though the menu has no matching radio (value unmatched). Confusing: two "Important" indicators disagree.
4. Click the toggle → `?view=important`, `filter` removed; list = priority critical/important OR needs-reply (not handled) OR senders marked important, minus senders marked noise (`inbox.ts:340-362`). Archive works here.
5. Hover a row, click "Mark noise" on a newsletter sender → toast "Marked noise" + Undo; list reloads and that sender's rows leave the Important view.
### Variations
- Mark important on a sender: their mail now always appears in the toggle view even with normal priority.
### Edge Cases
- Gap: nothing in the UI states the definition of the Important toggle, nor that it differs from Gmail's "important" marker.
- Empty result: "No mail matches this filter" + "Clear filter" (clears view too).
- Toggle pressed state is only styling; no count.

---

## STORY-006: Check one account at a time
**Type**: medium
**Topic**: filter-and-narrow
**Persona**: Dev Raman, agency owner with work and personal Gmail (accounts labelled "dev@raman-agency.example" and "devraman.personal@example.com")
**Goal**: Look only at the personal account's unread mail without work noise, then return to All.
**Preconditions**: Two accounts connected, triage ON.
**Ideal path**: 3 — click account tab, Filter, Unread.
**Alternate paths**: Composer From picker is unrelated to viewing. Agent: "unread in my personal account".
### Steps
1. Notice the pill tabs row beneath the header: "All", then one tab per account label (truncated at 160px; both emails start with "dev" and the work label ends in the same domain visually, `max-w-40` truncation hides the distinguishing end). Hesitation: which is which.
2. Click the second tab → `tab` state set; list reloads with `connectionId`; To do card swaps to that account's to-dos (`todosByTab`).
3. Click Filter → Unread → list shows only that account's Gmail unread. The tab stays selected, filter applies on top (key = tab+filter+q+view+category).
4. Click "All" → same filter, merged across both accounts, newest first. Rows do not show which account they came from, so the user cannot tell personal from work in All.
5. Reload the page → tab resets to All (not in URL) while the filter remains in the URL.
### Variations
- Tab + search: query goes only to that account's Gmail.
- A removed or failed account: if the list request throws while a tab is selected the page silently falls back to All (Inbox.tsx:~160).
### Edge Cases
- Tabs appear only with >1 account (`accounts.length > 1`); a disconnected account's tab vanishes.
- Gap: no per-account unread count on tabs; no indicator of which account failed to sync (global "Couldn't reach Gmail." banner).
- Filtered "All" paging merges accounts: "Load more" cross-account paging caveat (`inbox.ts` searchMail comment).

---

## STORY-007: Long afternoon of narrowing, searching and paging, then lost
**Type**: long
**Topic**: filter-and-narrow
**Persona**: Grace Whitfield, executive assistant managing a busy shared-style mailbox plus a second account, triage ON
**Goal**: Find the invoice thread a vendor says they sent two weeks ago, using narrowing tools, without losing her place in the day's triage.
**Preconditions**: Two accounts; 190 cached rows; the invoice is 17 days old (outside the cache window), has an attachment.
**Ideal path**: 7 — Has attachment filter + search the vendor name; the default list and categories cannot show it.
**Alternate paths**: Search `from:vendor has:attachment` alone; Inbox agent "find the invoice from Vendor" (mail_search); no date filter exists in the menu.
### Steps
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
### Variations
- Press `/` first to focus search from the list, type, Enter, then add Filter: same URL result.
- If she picked Filter → "Starred" while Important toggle was on: toggle unpresses, `view` removed.
### Edge Cases
- Load more may repeat a thread already shown; client de-dupes (`rows` memo, Inbox.tsx:~190).
- Changing tab or filter during paging discards the extra pages (`keyRef` guard) and shows loading skeletons.
- Esc in the search box clears the text but not the filter.

---

## STORY-008: Empty result, wrong clear button
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Hannah Cole, nurse practitioner reading mail on a phone-width browser window, triage ON
**Goal**: Recover from a filter + search combination that returns nothing.
**Preconditions**: Narrow window (`@md` layout puts search on its own line below the title row).
**Ideal path**: 2 — click the right clear control.
**Alternate paths**: Press Esc in the search box (clears query only); Back button; open Filter → Clear.
### Steps
1. Choose Filter → "Starred", then search `payroll`, Enter → `?filter=starred&q=payroll` returns nothing: message `No results for "payroll"` with "Clear search".
2. Thinking: "Is Starred also limiting it?" The empty state mentions only the search; the active "Starred" filter is visible only on the Filter button label.
3. Click "Clear search" → `q` removed; Starred list returns. If instead she had no query, the message reads "No mail matches this filter" with "Clear filter".
4. If she picks Filter → "Unread" while the search is empty but the Important toggle was on, the toggle unpresses and results come from Gmail.
### Variations
- Empty Personal category: "No mail matches this filter" + "Clear filter" (button sets filter/category/view/mail off).
### Edge Cases
- Gap: with a filter AND a search that both yield nothing, there is no single "Clear all" control.
- Touch: Filter and toggles are 40px tall (`pointer-coarse:h-10`).
- `?category=bills` in the URL while triage OFF: category is ignored by the API (`enabled &&` guard), full unfiltered list is shown, yet "No mail matches this filter" text could appear only if empty; the Filter button shows no label (`triage && category`), so the deep link silently does nothing.

---

## STORY-009: Shared or bookmarked filtered view
**Type**: short
**Topic**: filter-and-narrow
**Persona**: Ibrahim Saleh, accountant who bookmarks his weekly "unread with attachment" check
**Goal**: Return to a narrowed view in one click via bookmark or browser history.
**Preconditions**: Browser bookmark `/app/inbox?filter=attachment&q=invoice`.
**Ideal path**: 1 — open the bookmark.
**Alternate paths**: Browser Back/Forward after each filter change (each change is a history entry).
### Steps
1. Open bookmark → page loads with filter and search restored; search box prefilled via `setDraft(query)`; Filter button shows "Has attachment".
2. Account tab is back to All (state, not URL), so a previously chosen account is lost.
3. Press Back → undoes the last param change, not leave the inbox.
### Variations
- Add `&mail=<id>` deep link: dialog opens over the filtered list; Archive hidden because `filtered`.
### Edge Cases
- Only one of the pair `category`/`view` can be in a URL; if both filter and category are present, filter wins (`readInboxListState`).
- Gap: nothing like saved filters exists in the app; the browser bookmark is the only way.
