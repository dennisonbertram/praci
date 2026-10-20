# Topic: keyboard-power-use

Code refs: list keys `apps/web/src/lib/inbox-keyboard.ts`, wiring `pages/Inbox.tsx:372-382`, focus return `Inbox.tsx:388-402`, dialog keys `components/inbox/InboxMessageDialog.tsx:157-173`, help `components/inbox/InboxShortcuts.tsx`, open/close `Inbox.tsx:326-348`.

## STORY-001: Blast through the inbox with j/k/e
**Type**: short
**Topic**: keyboard-power-use
**Persona**: Mara Lindqvist, ops lead, Superhuman veteran, 60 unread, one Gmail account, triage on
**Goal**: Archive 10 newsletters without touching the mouse
**Preconditions**: Unfiltered list, no search text, no dialog open, focus on page body
**Ideal path**: 3 — `j` (select), `e` (archive), repeat `e` since selection advances to the neighbour (`Inbox.tsx:301-309`)
**Alternate paths**: Hover row Archive button (mouse); open dialog with `Enter` then `e` (dialog moves to next message, `Inbox.tsx:692-700`)
### Steps
1. Press `j` → first row is selected and focused (index -1 + 1 = 0), scrolls into view (`inbox-keyboard.ts:36-44`). Mara has to know nothing is selected at first; no row is pre-selected.
2. Press `e` → row removed optimistically, selection moves to `ids[index+1] ?? ids[index-1]`; api archive fires.
3. Press `e` again → next row archived. She wonders whether focus really moved: archive patches rows but does not call focus on the neighbour, so the removed row's button unmounts and DOM focus likely falls to body; the keys still work because they listen on window.
4. Press `j`/`k` to skip a row she wants to keep → selection moves from the new selectedId.
### Variations
- `ArrowDown`/`ArrowUp` do the same as j/k.
- `k` with nothing selected selects the first row (not the last).
### Edge Cases
- There is no undo for archive and no toast; an accidental `e` on a held key is silent and permanent in the UI (observed gap).
- Archiving the last row: neighbor is `ids[index-1]`; with an empty list, selectedId becomes undefined and `e` does nothing.
- Triage polling may reorder rows into Needs reply while she is mid-run, so `j` can land on a different row than expected.

## STORY-002: Open, triage and reply inside the dialog
**Type**: medium
**Topic**: keyboard-power-use
**Persona**: Devon Okafor, support manager answering customer threads
**Goal**: Read three messages in a row and reply to the second
**Preconditions**: Unfiltered list, several rows
**Ideal path**: 5 — `j`, `Enter`, `j`, `r`, type+send (composer is a mouse/Tab path for Send)
**Alternate paths**: `o` instead of `Enter`; click a row; Reply button in dialog
### Steps
1. Press `j` → row selected.
2. Press `Enter` (or `o`) → `?mail=<id>` pushed with LIST_OPEN state; dialog opens full-width; list keys are now disabled (`enabled: !openId`, and a `[role=dialog]` exists).
3. Press `j` in the dialog → next message loads (prefetched for neighbours), `goToMessage` replaces the URL entry, so Back still returns to the list in one step.
4. Press `r` → composer opens in Reply mode, preview becomes `invisible`; dialog key handler suspends (`composing`).
5. Types reply; there is no keyboard send shortcut listed anywhere (observed gap; Send must be reached by Tab/click).
### Variations
- `a` reply all, `f` forward use the same path.
- Opening does not mark the message read; there is no key for mark read/unread (observed gap), so Devon must click "Mark read".
### Edge Cases
- `r`/`a`/`f` before the message body finishes loading do nothing (`message &&` guard, line 169); he presses `r`, nothing happens, hesitates, presses again.
- Keys are ignored when focus is inside the sandboxed iframe? Focus starts on the dialog itself (`initialFocus={popupRef}`), so keys work initially; after clicking into the HTML body, keydown events inside an iframe do not reach the document handler (inferred, verify in browser).
- `j` on the last message and `k` on the first do nothing, no feedback.

## STORY-003: Close the dialog and keep your place
**Type**: short
**Topic**: keyboard-power-use
**Persona**: Priya Raman, finance controller scanning invoices
**Goal**: Read message 7, close it, and continue from message 8 by keyboard
**Preconditions**: List with 20 rows, opened row 7 with `Enter`
**Ideal path**: 2 — `Esc` then `j`
**Alternate paths**: Browser Back (same effect when opened from the list); dialog close via Esc is the only visible close since `showCloseButton={false}`
### Steps
1. Press `Esc` → Radix closes the dialog; `closeMessage` calls `navigate(-1)` because the entry is LIST_OPEN; `?mail` removed.
2. Focus returns: effect at `Inbox.tsx:388-402` focuses the row of `selectedId` in the next animation frame → row 7 (or whichever row she navigated to with `j/k` in the dialog, since `goToMessage` sets selectedId).
3. Press `j` → row 8 selected.
### Variations
- She navigated 7 -> 8 -> 9 with `j` in the dialog, then `Esc`: list lands on row 9, not 7. She finds that natural.
- Opened via deep link `?mail=` (no LIST_OPEN): Esc replaces the URL without Back; selectedId may be unset, so focus return does nothing and `j` selects the first row (observed gap).
### Edge Cases
- Closing the composer (not the preview) returns to the preview; a second Esc is needed to close the preview.
- Fast `Esc` then `j` inside the same frame can fire before the rAF focus, but selection state is already correct so it still works.

## STORY-004: Searching then trying to keep driving by keyboard
**Type**: medium
**Topic**: keyboard-power-use
**Persona**: Tomasz Wrobel, recruiter hunting `from:greenhouse.io` replies
**Goal**: Search, walk results, archive the stale ones
**Preconditions**: List loaded, focus on body
**Ideal path**: 6 — `/`, type query, `Enter`, escape the input, `j`, `e` (the escape-the-input step is the missing piece)
**Alternate paths**: Click a result row (then j/k work because focus is on a button, not an input)
### Steps
1. Press `/` → search input focused (`focusSearch`).
2. Type `from:greenhouse.io`, press `Enter` → q param set, results load (server-side Gmail). Focus stays in the input.
3. Press `j` → a "j" is typed into the search box; list handler returns early on `input` targets (`inbox-keyboard.ts:27-28`). Tomasz hesitates.
4. Press `Esc` → clears the draft and the query (`Inbox.tsx:424-428`), so the results vanish instead of just leaving the box. There is no key to blur the box and keep results (observed gap).
5. Instead he presses `Tab` to leave the input; focus lands on the next control (Filter), which is not a `role=menu` so keys work, but `Enter` on a button does not open a row.
6. Finally `j` selects a result. Then presses `e`.
### Variations
- Selecting a Gmail filter (Unread, Starred...) behaves like search for step 6.
### Edge Cases
- `e` does nothing while `filtered` (`archive: filtered ? undefined : archive`, `Inbox.tsx:380`) and the dialog hides Archive too. No message explains why; the Help dialog still lists `e Archive`. This is the key blocker for blasting through filtered views like Unread.
- Filter dropdown items are `role=menu`; keys are ignored while focus is in the menu; after choosing, focus returns to the trigger button, which is fine.
- Account tabs are `role=tablist`: after clicking an account tab, j/k are ignored until focus leaves it (arrow keys are used by the tablist).

## STORY-005: Discover the shortcuts with `?` and find the help incomplete
**Type**: short
**Topic**: keyboard-power-use
**Persona**: Hannah Cole, ex-Gmail power user new to Praci
**Goal**: Learn what keys exist
**Preconditions**: Inbox list, focus on body
**Ideal path**: 1 — `?`
**Alternate paths**: none found (no toolbar help button, no tooltip hint)
### Steps
1. Hannah tries Gmail habits: `j` works, `x` (select) does nothing, `#` does nothing, `u`/`g i` do nothing. No bulk select exists.
2. She presses `?` → "Keyboard shortcuts" dialog (`InboxShortcuts.tsx`) with j, k, Enter, /, c, e, r, a, f, Esc. List keys are suspended while it is open (`!help`).
3. She reads it as one flat list: it implies `r`, `a`, `f` work from the list. She selects a row and presses `r` → nothing (they are dialog-only).
4. Presses `Esc` → help closes.
### Variations
- Help omits `o`, ArrowUp/ArrowDown, `?` itself, and that j/k/e/r/a/f mean different things in list vs message view. `e` also silently disappears when filtered.
- Pressing `?` inside the open message dialog does nothing (dialog handler has no `?` case; list handler is disabled).
### Edge Cases
- `?` needs Shift on most layouts; `event.key === "?"` works for that.
- The help dialog's presence is also a `[role=dialog]`, so even if `help` state were out of sync the DOM check would still block list keys.
- Strings `Next message`/`Previous message` are in `locales/en/messages.po`; non-English locales may fall back (not verified).

## STORY-006: Compose with `c` and get back to the list
**Type**: medium
**Topic**: keyboard-power-use
**Persona**: Jonas Weber, founder firing off quick notes between meetings
**Goal**: Start a new message from the keyboard, discard it, and resume triage
**Preconditions**: At least one connected account (otherwise `c` is a no-op: `compose` is undefined)
**Ideal path**: 3 — `c`, type, `Esc`/Discard then `j`
**Alternate paths**: Compose icon button in header
### Steps
1. Press `c` → composer opens (`composing` true disables list keys).
2. Types recipient and subject; typed letters like `e`, `c`, `j` go to inputs safely.
3. Closes/discards the composer → `composing` false. The Inbox does not restore focus to the compose trigger or a row (the row-focus effect only runs after the message dialog closes, `Inbox.tsx:388-402`), so focus is on body; `j` still works because the listener is on window.
### Variations
- Sent mail triggers `MAIL_SENT_EVENT` list reload; selection is preserved by id if the row is still there.
- Reply composer opened from a message: closing it returns to the preview, not the list.
### Edge Cases
- Whether the first Esc in the composer closes it or asks "Discard attachments?" depends on ComposeEmail (outside this topic's files).
- Pressing `c` while in the Integrations overlay (`paused`) does nothing.

## STORY-007: Long run: clear a crowded inbox end to end by keyboard
**Type**: long
**Topic**: keyboard-power-use
**Persona**: Aisha Bello, chief of staff returning from a week off, 140 messages, two accounts, triage on, Needs reply group on top
**Goal**: Get to a handled inbox with minimal mouse use
**Preconditions**: Unfiltered "All" tab, rows grouped Needs reply / Today / Earlier
**Ideal path**: 12 — mix of `j`, `Enter`, `r`, `e`; mark read/important still needs the mouse
**Alternate paths**: Sender feedback via row hover buttons "Mark important"/"Mark noise" (mouse only); Important toggle and Filter dropdown by mouse/Tab
### Steps
1. Press `?` to refresh memory, `Esc` to close.
2. Press `j` → first Needs reply row selected. `Enter` to read.
3. In the dialog press `r`, write a reply, send (mouse/Tab for Send). Back in the preview press `e` → archives and `goToMessage(next)` moves to the next row's message; she keeps reading without returning to the list (good flow).
4. Presses `j` in the dialog to skip a message she wants to deal with later; it stays unread and un-archived.
5. `Esc` → list, focus on the last-viewed row. She presses `j` to continue.
6. Wants the unread ones only: Filter dropdown (mouse). Now `e` is dead (archive is disabled while filtered) and she must clear the filter to archive. She hesitates, assumes a bug.
7. Back on the unfiltered list she notices archived rows jumped around because triage polling (every 5 s, up to 6 times) re-sorted groups.
8. Tries `Shift+J`, `x`, `#`, `u`: nothing. Ends with ~40 rows still needing a mouse for mark read.
### Variations
- Archive last remaining message from the dialog: no neighbour, so `closeMessage()` is called and she lands on the list with nothing selected.
- Switching account tab with the mouse: keys ignored while the tablist has focus.
### Edge Cases
- Held-down `j` moves one row per key repeat, scrolling `block: "nearest"`; there is no jump to top/bottom (`g`/`G`) and no page keys.
- Default list is a single page of up to 200 rows; filtered lists need the "Load more" button, which has no key.
- Archive and mark-read failures reload the list (`change()` catch), so a row may reappear under her cursor with only an error banner.

## STORY-008: Archive from the dialog during a filtered or searched view
**Type**: short
**Topic**: keyboard-power-use
**Persona**: Lucia Ferreira, assistant clearing "Has attachment" mail
**Goal**: Archive a message she is reading while the Filter is active
**Preconditions**: Filter "Has attachment" selected; message opened with `Enter`
**Ideal path**: 1 — `e`, but it does nothing; true path is clear filter (Filter menu > Clear), re-find the message, then `e`
**Alternate paths**: none found (Archive button also omitted, `Inbox.tsx:692-700`)
### Steps
1. Open a message from the filtered list → dialog shows Reply/Reply all/Forward but no Archive and no mark-read button.
2. Press `e` → no effect, no feedback.
3. Presses `r` → reply works, so she believes keys are alive and only `e` is broken.
4. Closes, clears filter, scrolls to find the message again, then archives.
### Variations
- Same behaviour under free-text search.
### Edge Cases
- Help dialog still lists `e Archive` with no caveat.
- Because opening a message with a different filter clears `mail` (`setInboxListParam`), switching filter while reading closes the dialog.
