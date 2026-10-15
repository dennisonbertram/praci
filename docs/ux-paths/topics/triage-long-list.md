# Topic: triage-long-list

Persona thread: people returning to a long Inbox list. Code refs: `apps/web/src/pages/Inbox.tsx`, `components/inbox/InboxRow.tsx`, `TodoCard.tsx`, `lib/inbox-keyboard.ts`, `packages/core/src/inbox-groups.ts`, `apps/api/src/inbox.ts`.

Facts the stories rely on (verified):
- Group headings are plain text "Needs reply" / "Today" / "Earlier" with NO counts (`InboxRow.tsx:52`); empty groups render nothing (`:47`).
- Unfiltered list: 14-day cache, max 200 rows, no Load more (`Inbox.tsx:675` shows Load more only when `filtered`).
- Hover actions order: Archive, Mark read/unread, Mark important, Mark noise (`InboxRow.tsx:176-224`); icon-only with aria-label, no visible tooltip/text. On coarse pointers a single "More" menu holds the same four.
- Mark toast "Marked important"/"Marked noise" + "Undo", 6 s (`STATUS_MS`, `Inbox.tsx:51,143-147`); toast only for a new mark; un-marking via the pressed icon shows nothing (`Inbox.tsx:315`).
- Noise mark => needsReply false, priority low (`core/inbox-triage.ts:190`): row leaves Needs reply after the post-save reload and renders muted.
- Archive has no undo, no toast; disabled while search/filter active (`Inbox.tsx:380,650`). `e` archives the selected row and selection moves to the next row (`Inbox.tsx:301-309`).
- No bulk select, no "mark all read", no keyboard shortcut for read/unread or marks.

## STORY-001: Archive the first newsletter without losing my place
**Type**: short
**Topic**: triage-long-list
**Persona**: Priya Raman, product manager back from a week of leave
**Goal**: Clear one obvious junk email from the top of "Earlier" and keep scanning.
**Preconditions**: Gmail connected, triage on, no filter or search, desktop width with a mouse.
**Ideal path**: 3 — hover row, click Archive, keep scanning; no confirmation needed.
**Alternate paths**: Click row -> dialog -> "Archive" button (`InboxMessageDialog`) then dialog advances to the next message (`Inbox.tsx:692-700`); keyboard `j` to the row then `e`.
### Steps
1. Open Inbox from the sidebar (`sidebar-inbox`, shows unread count badge) -> `/app/inbox` shows skeleton rows then Needs reply / Today / Earlier sections. Priya thinks: "How many is that? There is no count anywhere except the sidebar badge."
2. Move the mouse over a row from "Weekly Digest" in Earlier -> four icon-only buttons fade in over the right side of the row, left of the time. She hesitates: which icon is archive? No visible label; the first icon is the Archive box (aria-label "Archive").
3. Click the Archive icon -> row disappears at once (optimistic, `patchRows` filter), rows below slide up, sidebar badge refreshes via `onRefreshed`.
### Variations
- Touch device or coarse pointer: hover buttons are hidden; a single "More" (...) button at the row end opens a menu with "Archive", "Mark read", "Mark important", "Mark noise" (labelled text, clearer than the icons).
### Edge Cases
- Archive fails (offline): error banner appears and the list reloads, the row reappears; nothing says which row failed.
- No undo: Priya archived the wrong row by sliding the mouse; nothing in the UI brings it back (observed gap). The same info "archived" appears nowhere on screen; a toast exists only for marks.
- Row below slides under the cursor after removal, so a double click archives two rows (observed risk).

## STORY-002: Keyboard sweep through the Earlier pile
**Type**: medium
**Topic**: triage-long-list
**Persona**: Marcus Webb, operations lead who lives on the keyboard
**Goal**: Archive about 40 low-value messages quickly using j/k/e.
**Preconditions**: 200 rows loaded, unfiltered, no dialog open, focus not in an input.
**Ideal path**: 6 — one `j` to start, then `e` repeatedly (selection auto-advances); `o` only for ambiguous rows.
**Alternate paths**: Click each row's hover Archive icon (one mouse trip per row); open first message and use `e` in the dialog, which archives and moves to the next message.
### Steps
1. Press `j` with nothing selected -> first row (top of Needs reply) gets the left primary border and focus (`inbox-keyboard.ts:42`). He thinks: "I wanted to start at Earlier; there is no jump-to-section key." Observed gap: no shortcut to skip a group.
2. Press `j` repeatedly through Needs reply (7 rows) into Today (3) -> selection crosses group headings seamlessly; the list scrolls to keep the row visible (`scrollIntoView block nearest`).
3. Press `j` to the first Earlier row "Your invoice is ready" -> selected; hover actions stay visible permanently on the selected row (`selected` skips opacity-0).
4. Press `e` -> row removed, selection moves to the next row (`neighbor = ids[index+1] ?? ids[index-1]`). 
5. Press `e` again 5 times -> five more rows gone, no feedback besides rows vanishing. He hesitates after the 5th: "Did that last one matter?" and cannot recall what it was; there is no undo and no "recently archived".
6. Press `o` on an unfamiliar sender -> message dialog opens; press `e` there -> archives, dialog shows next message; press `Esc` to close and return to list with the row focused (`Inbox.tsx:395-402`).
7. Press `?` -> "Keyboard shortcuts" dialog lists j, k, Enter, /, c, e, r, a, f, Esc. He notices `o`, arrows are missing and no read/unread or mark key exists.
### Variations
- Last row archived: neighbor falls back to the previous row; with an empty list nothing is selected.
- Using ArrowDown instead of `j` behaves identically.
### Edge Cases
- If a search/filter is active `e` silently does nothing (archive is undefined) - no message explains why.
- Shortcuts are ignored while any dialog is open or focus is in the search box; after typing a search and pressing Enter, focus stays in the input so `j` types a letter (observed friction).
- Holding `e` could archive many rows with no confirmation.

## STORY-003: Which of these actually need a reply?
**Type**: medium
**Topic**: triage-long-list
**Persona**: Dana Okafor, freelance designer with 200 unread after a week off
**Goal**: Work the Needs reply section first, in priority order, and know why each is there.
**Preconditions**: Triage on and consented; Needs reply contains 9 rows; triage finished.
**Ideal path**: 5 — top of the page already ordered by priority, open each, reply.
**Alternate paths**: Use the "Important" toggle beside the Filter menu (view=important: critical/important OR needs-reply OR sender marked important, minus noise) for a different slice; ask the Inbox agent ("what's on my email").
### Steps
1. Land on Inbox -> To do card first (if any open to-dos), then "Needs reply" heading, then the rest. Dana thinks: "Nine things need me? Which first?"
2. Scan Needs reply rows -> sorted by priority then newest (`inbox-groups.ts:23-27`), but priority itself is NOT displayed on the row; the "Needs attention" badge is hidden inside this group (`hideAttention`). She cannot tell critical from low; only order carries information. Observed gap: the reason ("Client asked for revised quote by Friday") exists in data (`MailRow.reason`) but is not shown on the row or in the dialog.
3. Click the first row ("Contract renewal - please confirm") -> dialog opens with `?mail=` URL; shows only that one message though the row represents a whole thread.
4. Click "Reply" -> composer "Reply" opens; she writes and sends. After 5 s undo window the list reloads on `MAIL_SENT_EVENT`.
5. Back in the list, the thread's row leaves Needs reply (answered thread is `alreadyHandled`, `inbox.ts:155`) -> she gets a sense of progress but no counter.
### Variations
- Row marked noise by an earlier session moves out of Needs reply.
- While triage is still pending (new mail), the list silently re-polls every 5 s up to 6 times and rows may jump into Needs reply under her cursor.
### Edge Cases
- If triage is off or blocked, there is no Needs reply section at all; everything is Today/Earlier and the user is not told why.
- Under a filter/search the Needs reply group disappears (`needsReply: null`), so a person who filters to "Unread" loses their priority view.

## STORY-004: Teach the inbox that a sender is noise, then regret it
**Type**: medium
**Topic**: triage-long-list
**Persona**: Tomas Lindqvist, founder who gets daily promo mail from a SaaS vendor
**Goal**: Mark the vendor as noise so it stops appearing as urgent, then undo a wrong mark.
**Preconditions**: Triage on. Three messages from "Brightwave Deals" appear: one in Needs reply, two in Earlier.
**Ideal path**: 3 — hover, click Mark noise, done; undo within 6 s if mistaken.
**Alternate paths**: "More" menu on touch ("Mark noise" checkbox item); no dialog button for marks (dialog has Reply, Reply all, Forward, Archive, Mark read/unread only).
### Steps
1. Hover the Brightwave row in Needs reply -> icons appear. He hovers the bell-with-slash (aria-label "Mark noise"); no tooltip. He thinks: "Is this just this email or the whole sender?" Nothing on screen says per-sender (observed gap).
2. Click it -> toast at bottom center "Marked noise" with "Undo"; the row text turns muted, icon fills (aria-pressed).
3. Wait for the reload -> row leaves Needs reply (needsReply false, priority low) and drops into Today/Earlier; the other two Brightwave rows also turn muted (mark is by sender address across all accounts, `inbox.ts:406-436`). He is surprised that rows he did not touch changed.
4. Realises the vendor also sends his invoice reminders; clicks "Undo" within 6 s -> mark removed (`mark(id, null)`), toast disappears, rows return to normal and Needs reply regains the row after reload.
5. If he missed the 6 s: he must find a Brightwave row (now muted), hover and click the filled "Mark noise" icon again to unmark -> no toast and no confirmation of removal (status set to null).
### Variations
- "Mark important" on a boring sender lifts priority to at least "important" and may add it to Important view; still no priority text on the row.
- Marking noise on a sender removes their to-dos from the To do card (triage re-syncs to-dos, `inbox.ts` comment on feedback).
### Edge Cases
- Toast is single: marking two senders in a row replaces the first toast, so the first is no longer undoable from the toast.
- Mark fails: icon reverts, error banner shown.
- Nothing is written to Gmail, so the same mail looks unchanged in Gmail itself.
- Noise rows are muted but not hidden, so the list is no shorter (observed gap for overload).

## STORY-005: Reading state as a progress tracker
**Type**: medium
**Topic**: triage-long-list
**Persona**: Hannah Mbeki, consultant who uses unread as her to-do marker
**Goal**: Mark scanned-but-not-actioned emails read, and flip one back to unread.
**Preconditions**: 60 unread rows (bold sender with blue dot). Unfiltered view.
**Ideal path**: 4 — hover icon per row; there is no bulk "mark all read".
**Alternate paths**: Open message and use "Mark read/Mark unread" in the dialog; filter to "Unread" (Filter menu) to see only unread, but then archive is disabled.
### Steps
1. Look at the list -> unread rows have a primary dot and a bold-coloured sender. Hannah thinks: "Opening a row should mark it read." 
2. Click a row to open it, then close -> the row stays unread (no auto-mark call found in `openMessage`/dialog; verify in the walk). She is annoyed: read state needs a separate click.
3. Hover that row and click the envelope icon (aria-label "Mark read") -> dot disappears immediately, sidebar badge updates. API marks the whole thread read.
4. Mark a different row she wants to revisit: hover the open-envelope icon (label now "Mark unread") -> dot returns; API marks only that one message unread (thread-level asymmetry).
### Variations
- In the dialog the same "Mark read/unread" button toggles the list row behind it.
### Edge Cases
- Select Filter "Unread", mark one read: it stays in the filtered list until reload, since only the flag patches.
- No "mark all read" and no shortcut: 60 rows = 60 hover clicks (observed gap).
- Unread count appears on sidebar badge only; the Inbox page itself has no unread total.

## STORY-006: The To do card as a map of the week
**Type**: medium
**Topic**: triage-long-list
**Persona**: Elena Petrova, office manager checking deadlines first
**Goal**: See what is due, tick items off, and trace one back to its email.
**Preconditions**: Triage on, 6 open to-dos from triage plus one done in the last 24 h; container narrower than @3xl.
**Ideal path**: 4 — read card, expand "N more", tick items; tracing to the source email is not possible from the card.
**Alternate paths**: Search the sender in "Search mail" (press `/`), or ask the Inbox agent.
### Steps
1. Open Inbox -> "To do" card sits above Needs reply, showing the first 2 open items and a ghost button "4 more". Each shows text, a "from · reason" small line, and due label (Today red, weekday amber/plain, "Mon D").
2. Click "4 more" -> all items show; button becomes "Show less" (`aria-expanded`). On wide screens (@3xl) everything is shown and the button is hidden.
3. Tick the checkbox on "Send revised quote to Okafor Design" -> `todos.setDone`; item goes to the bottom, struck through, kept for 24 h.
4. She tries to click the item text to see the email -> nothing happens (no handler; `messageId` unused). She scans Needs reply for the matching row and cannot be sure which. Observed gap.
### Variations
- Multi-account: To do list is per account tab; "All" merges.
- Unticking a done item restores it.
### Edge Cases
- Card hidden under any search, filter, Important view, category, or while the consent prompt shows; so applying a filter makes her to-dos vanish.
- Same information appears twice: a Needs reply row and a to-do for the same email, with no link between them.
- Due labels use weekday names within 6 days, not dates; ambiguous when a week away.
- setDone failure shows an inline alert in the card.

## STORY-007: A full triage pass on 200 emails
**Type**: long
**Topic**: triage-long-list
**Persona**: Jonas Weber, sales director back from a week off, 200 emails in 14-day window
**Goal**: Reduce the list to what matters, ending with replies sent and noise senders silenced.
**Preconditions**: Triage on and consented, two accounts (work and personal), triage finished.
**Ideal path**: 18 — Needs reply first, mark noise per sender, archive remaining Earlier rows by keyboard.
**Alternate paths**: Per-category filters (Newsletters, Receipts) to batch-handle; Important toggle for a tight slice; agent `mail_modify` with approval for bulk archive (agent only, not UI).
### Steps
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
### Variations
- Mobile/touch: "More" menu per row; no search/filter on the mobile screen.
- Single account removes tabs and a source of doubt.
### Edge Cases
- Optimistic archive racing a reload could briefly restore a row if a sync returns stale data.
- 200-row cap: oldest rows beyond 200 simply do not appear and nothing tells him.
- Triage reshuffle mid-pass moves rows between groups under the cursor.

## STORY-008: Overwhelmed first look: reading the page cold
**Type**: short
**Topic**: triage-long-list
**Persona**: Grace Adeyemi, a first-time user returning after vacation, anxious about volume
**Goal**: Understand at a glance how bad it is and where to start.
**Preconditions**: Triage on, 200 rows, wide desktop window.
**Ideal path**: 2 — land, read the first heading, start; the UI offers no summary of its own.
**Alternate paths**: Open the Inbox agent panel and ask "what's on my email" (overview tool).
### Steps
1. Open Inbox -> a wall of 44 px single-line rows under small grey 12 px headings "Needs reply", "Today", "Earlier"; no counts, no per-group collapse. Grace thinks: "Where do I even start? Is the top the worst?"
2. Look for a summary -> none; the sidebar badge is the only count; Inbox page header shows "Inbox", Search mail, Important toggle, Filter, Compose icon. She can't tell what the Important toggle does vs the "Needs reply" section (overlapping meanings shown on two surfaces).
### Variations
- Inbox agent panel can summarise on request (not auto-shown, starts collapsed on phones).
### Edge Cases
- Everything already read: unread dot and bold absent, and the page looks identical to "unread" at distance; time shows only "h:mm AM" or "Mon D", no weekday.
- Empty inbox says only "No mail" - no celebratory or guidance copy.

## STORY-009: Triage on a phone-width window with touch
**Type**: medium
**Topic**: triage-long-list
**Persona**: Luis Ortega, stuck in an airport on a phone browser
**Goal**: Archive and mark three senders from the long list using touch.
**Preconditions**: Coarse pointer, narrow container (96 px sender column, Inbox agent collapsed by default).
**Ideal path**: 3 per row — tap "More", tap action.
**Alternate paths**: Tap row to open full-screen dialog, use its Archive button.
### Steps
1. Open Inbox -> the rows are 44 px with a very short sender column; subject mostly truncated to a few characters. He thinks: "I can't tell what any of these are."
2. Tap the "More" (...) on a row -> menu: "Archive", "Mark read", "Mark important", "Mark noise" (checkbox items). The row reserves extra end padding (pe-11).
3. Tap "Mark noise" -> toast "Marked noise" + Undo appears at bottom, 6 s.
4. Tap "More" -> "Archive" -> row gone instantly.
5. Tap row to open the dialog; swipe is not supported; use prev/next chevrons.
### Variations
- The To do card shows only 2 items with "N more".
### Edge Cases
- The small "More" target (icon-xs) sits near the time; mis-taps open the message.
- Toast overlays the bottom of the list, covering the last rows.
- No keyboard shortcuts on touch.
