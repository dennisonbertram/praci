# Topic: read-with-context

Code refs (verified 2026-10-14): `apps/web/src/components/inbox/InboxMessageDialog.tsx` (dialog), `apps/web/src/pages/Inbox.tsx` (openMessage/closeMessage/goToMessage ~L344-363, dialog props ~L685-705), `apps/web/src/lib/inbox-message-cache.ts`, `apps/api/src/inbox.ts` (`oneRowPerThread` L126, `inboxGet` L510).

Cross-story observations (code facts):
- Rows are threads (newest message per thread, `inbox.ts:126`); the dialog loads exactly one message by id (`rpc.inbox.get({messageId})`). No thread view, no "earlier messages", no thread count anywhere.
- Opening (click, Enter, o, deep link, j/k in dialog) never calls `markRead`. Only the "Mark read"/"Mark unread" buttons do (`Inbox.tsx:setRead`). Mark read = whole thread, Mark unread = that one message.
- Dialog header shows: subject (title), sender name + `<address>`, date ("medium" date, short time), `to {to}`, `cc {cc}` (each one truncated line, full text only in a hover `title`). No Bcc, no labels, no account, no category/reason.
- Reply / Reply all / Forward quote the opened message only (ComposeEmail seed `{kind, messageId}`).

## STORY-001: Open the latest reply and try to find what was said before
**Type**: medium
**Topic**: read-with-context
**Persona**: Marisol Vega, operations manager at a small catering firm, 40 unread, between meetings
**Goal**: Understand the earlier back-and-forth in a long vendor thread before answering the newest message
**Preconditions**: Gmail connected; thread "Re: Re: Re: Saturday delivery window" has 9 messages; the list row shows the newest one
**Ideal path**: 5 — open row, read, hunt for history, give up and open the thread elsewhere / ask agent; the app offers no in-dialog thread view so the ideal is bounded by that gap
**Alternate paths**: Ask the Inbox agent (right panel) to summarise/search the thread (tools `mail_search`, `mail_get`, per discovery); search the subject in "Search mail" and open each result (each thread still collapses to one row, so this does NOT list the 9 messages); Gmail itself outside the app. No in-app thread expansion found.
### Steps
1. Click the row "Re: Re: Re: Saturday delivery window" → URL gets `?mail=<id>`, dialog opens with the subject as title (from the row) and a skeleton until `inbox.get` returns (instant if prefetched, `Inbox.tsx` prefetch effects).
2. Read the header: sender name and `<address>`, a date like "Oct 13, 2026, 4:12 PM", "to Marisol Vega" → she sees only this one message's fields.
3. Scroll the body → HTML in a sandboxed iframe, or plain text. Gmail's collapsed quoted text is whatever the sender's client included; the app adds no "show quoted" toggle in the reader.
4. She thinks "what did Dario say about the 7am slot?" and scans the dialog for "Thread", "Earlier messages", "Conversation" → nothing exists. Hesitation point: she looks at the chevrons "Previous message"/"Next message".
5. Click "Next message" (ChevronDown) → loads the next ROW in the list (a different thread), not the previous message of this thread. Subject changes entirely.
6. Click "Previous message" (ChevronUp) to return → back to the thread, same single message.
7. Scroll to the bottom of the body hoping for history → only attachments (if any) after the body.
8. Click "Reply" anyway → composer opens with quoted original (the one message), dialog hides behind it (`composing && "invisible"`).
### Variations
- Sender's HTML includes the full quoted chain: she can scroll within the iframe and recover context from it.
- Plain-text-only mail: `whitespace-pre-wrap` text, quotes visible as ">" lines.
- She types the subject into "Search mail": result is again one row per thread, so still one message per open.
### Edge Cases
- Observed gap: no thread view, no thread-count on the row, no "N earlier messages" hint, so she cannot even tell the thread is long until she opens it.
- Chevron labels say "Previous/Next message" but navigate across threads, which is easy to misread as thread navigation.
- Same information (subject/sender) appears on the row, the dialog title, and in the composer's Reply header.

## STORY-002: Does opening it mark it read? (it does not)
**Type**: short
**Topic**: read-with-context
**Persona**: Tomas Brandt, freelance bookkeeper who uses unread dots as his to-do list
**Goal**: Read an invoice question and have the unread count reflect it
**Preconditions**: Unread row (bold sender, unread dot); sidebar "Inbox" badge shows 12
**Ideal path**: 3 — open, read, click "Mark read"
**Alternate paths**: Row hover icon button "Mark read" without opening (`InboxRow`); touch "More" menu; no keyboard shortcut for read/unread (discovery 4).
### Steps
1. Press `j` until the row is selected, press Enter → dialog opens; row's unread dot remains (no read call on open).
2. Read the message, press Escape/click "Close" → focus returns to the row (`Inbox.tsx` wasOpen effect); the dot is still there, sidebar badge still 12.
3. Thinks "I just read this, why is it bold?" Reopens, sees a button "Mark read" in the action row (shown because `unread` true) → clicks it.
4. Row dot disappears optimistically; sidebar badge refreshes via `onRefreshed` → 11.
### Variations
- While in the dialog press `j` to go to next message: the message he left stays unread; reading a whole batch via j leaves all unread (he must click "Mark read" each time; no shortcut).
- Click "Mark unread" on an already-read message to re-flag: that applies to the single message, while "Mark read" marks the whole thread.
### Edge Cases
- Deep link `?mail=<id>` for a message not in the current list: `openRow` is undefined so neither Archive nor Mark read/unread buttons render (`onRead` needs `openRow`).
- Failure of markRead: error banner + list reload, dot comes back.
- Observed gap: no setting for "mark read when opened"; Gmail-native behaviour is not mirrored.

## STORY-003: Walk the neighbours with j/k and Archive from the reader
**Type**: medium
**Topic**: read-with-context
**Persona**: Priya Natarajan, product lead clearing 25 messages before standup
**Goal**: Read through the Today group top to bottom, archiving finished ones
**Preconditions**: Unfiltered list, triage on; groups Needs reply (3), Today (8), Earlier; no search/filter active
**Ideal path**: 12 — open first, then per message `e` or `j`
**Alternate paths**: Close and use list keys j/k/Enter/e (`lib/inbox-keyboard.ts`); chevron buttons instead of keys.
### Steps
1. Press Enter on the top Needs reply row → dialog opens, `?mail=` set; the history entry is pushed (state `LIST_OPEN`).
2. Press `j` → next row in list order (Needs reply, then Today, then Earlier: `ids` order) opens; URL is replaced, not pushed (`goToMessage` replace).
3. Press `k` → previous. At the first row "Previous message" is disabled; at the last, "Next message" is disabled.
4. Finish a message, press `e` (or click "Archive") → row removed optimistically; dialog jumps to the neighbour (`ids[index+1] ?? ids[index-1]`).
5. Repeat `e` several times → she reaches the last row; archiving it with no neighbour calls `closeMessage` and returns to the list.
6. Press Escape → closes. Because the entry was list-opened, `navigate(-1)` is used, so one Back total returns to the list even after many j/k.
### Variations
- With a search or filter active: "Archive" button is absent and `e` does nothing in the dialog (`onArchive` undefined when `filtered`).
- j at the last row does nothing, silently.
### Edge Cases
- No undo for archive; an accidental `e` while reading is final in the UI.
- The Needs reply row sorted high may leave once triage updates; polling reshuffle (every 5 s up to 6 times) can change `ids` order under her, so "Next message" may not be what she expected.
- Shortcut help dialog "Keyboard shortcuts" lists j/k/e/r/a/f/Esc but does not say they apply in the dialog.

## STORY-004: Deep link and Back button behaviour
**Type**: medium
**Topic**: read-with-context
**Persona**: Gareth Olusanya, consultant who pastes URLs into his notes app
**Goal**: Return to a specific email from a saved link and navigate back to the list sensibly
**Preconditions**: Signed in; saved URL `/app/inbox?mail=<id>`; the message is older than 14 days
**Ideal path**: 3 — open link, read, close
**Alternate paths**: Chat email card from the bot opens the same dialog without prev/next/archive (`EmailCards.tsx`); search by subject.
### Steps
1. Paste the URL into a new tab → Inbox page loads with dialog open; title blank until `inbox.get` returns (no row, so `subject` undefined), skeleton rows then fields.
2. Read the message. Chevrons are disabled (message not in the loaded list, `openIndex = -1`), and Archive and "Mark read" buttons are absent.
3. Click "Close" (X) → no `LIST_OPEN` state, so `mail` is deleted with replace; list is shown at `/app/inbox`.
4. Click Back in browser → leaves the app (replace removed the mail entry). He expected the email again.
### Variations
- Same link, but the message is in the 14-day list: prev/next work, Archive and read buttons appear.
- Normal click-open then browser Back (instead of X): dialog closes and list remains, row gets focus.
- Open message A, press j to B, press browser Back → returns to list (one entry), not to A.
- A search typed after opening clears `mail` (`setInboxListParam`).
### Edge Cases
- Message deleted/archived in Gmail or from another account: `inbox.get` errors, `role=alert` text with "Try again" button in the dialog.
- Link for an id not owned by this space: error text, same Try again button (which cannot succeed).
- Observed gap: no "Open in Gmail" or copy-link control; the user must copy the address bar.

## STORY-005: HTML newsletter that renders blank, and remote images
**Type**: short
**Topic**: read-with-context
**Persona**: Lena Fischer, travel coordinator reading a confirmation from an airline
**Goal**: Read the itinerary in a mail with heavy HTML
**Preconditions**: HTML mail with images; remote-image preference at default
**Ideal path**: 2 — open, read
**Alternate paths**: none found for plain-text alternative toggle; the dialog picks HTML when it has visible content else text.
### Steps
1. Open the row "Your e-ticket for LH 2217" → HTML in a bordered, sandboxed frame (`SandboxedHtmlViewer ... email`); dialog height grows to min(85vh, 820px) on desktop (`has-[iframe]`).
2. Remote images may not load (preference in `lib/remote-images-preference.ts`) → she sees gaps and wonders if the mail is broken. Hesitation: she looks for a "Load images" button in the dialog.
3. Scrolls inside the frame, while the dialog area outside also scrolls (two scroll regions) → she scrolls the wrong one at times.
### Variations
- HTML contains only styles/no text/no image: `hasVisibleContent` false, so the plain `text` part shows instead.
- Text-only mail: preformatted wrap, no frame.
### Edge Cases
- Observed gap: no visible control in the reader for loading remote images or switching HTML/text.
- If both html and text are empty the body area is blank with no "no content" message.

## STORY-006: Download an attachment from a long thread
**Type**: medium
**Topic**: read-with-context
**Persona**: Hana Kobayashi, paralegal who needs "Lease_Amendment_v3.pdf"
**Goal**: Get the right version of a file, not an older one in the same thread
**Preconditions**: Thread with three messages each carrying a different version of the PDF; row shows only the newest message; list has no attachment indicator
**Ideal path**: 3 — open, click chip
**Alternate paths**: Filter dropdown item "Has attachment" (Gmail live filter) to find mail; Inbox agent. No attachment icon on rows.
### Steps
1. Scan the list: no paperclip on any row (InboxRow has none), so she opens the newest message of the thread by guess.
2. Look under the body → a chip list labelled "Attachments" with icon, `Lease_Amendment_v3.pdf` and size such as "412.3 kB" (narrow unit format).
3. Click the chip → authenticated fetch of `/api/inbox/messages/<id>/attachments/<attId>`; browser saves the file. It is not previewed.
4. She wonders whether v2 (older message, same thread) is the signed one; no way to see other messages' attachments from here → opens "Previous message" which goes to a different thread.
### Variations
- Failure (over 25 MB cap or network): red "Download failed" alert below the chips; clicking again clears and retries.
- Image attachment gets FileImage icon, zip gets FileArchive, others FileText.
### Edge Cases
- Inline images (signature logos) are filtered out of the chips (`!a.inline && a.id`), so a mail with only inline images shows no attachments section.
- Chip filename truncates at max-w-64; two similarly named files can look identical.
- Observed gap: no preview, no "download all", no attachment list across the thread.

## STORY-007: Reply to a message while unsure what was asked earlier
**Type**: long
**Topic**: read-with-context
**Persona**: Dev Anand, startup founder triaging 60 emails after a flight
**Goal**: Reply to the investor's latest "Re: Term sheet follow-ups" and cover all open questions from the whole thread
**Preconditions**: 11-message thread over 6 days; triage on; thread sits in Needs reply; two accounts (tabs All / personal / work)
**Ideal path**: 14 — open, read, ask agent for summary, read again, reply, send
**Alternate paths**: Search + open each; Gmail outside the app; ask the Inbox agent first from the list.
### Steps
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
### Variations
- Reply (not all) to avoid cc: he must choose before seeing the full cc, which is truncated.
- From the work tab vs All: the dialog shows no account; composer From picker handles it.
### Edge Cases
- The reader cannot be viewed beside the composer on desktop; the composer replaces the view (`invisible`).
- Observed gaps: no thread view, no per-message jump, no summary in the dialog, no link from agent answer to message.
- The same sender/subject appear on row, dialog title, composer title and agent text, but the thread's earlier content appears nowhere in-app except possibly inside the quoted HTML.

## STORY-008: Recipient truncation and Bcc blind spot
**Type**: short
**Topic**: read-with-context
**Persona**: Ines Moreau, executive assistant checking who else saw a sensitive mail
**Goal**: Confirm the full recipient list
**Preconditions**: Mail with 14 recipients in To and 6 in Cc
**Ideal path**: 3 — open, hover, read tooltip
**Alternate paths**: none found (no expand control); Gmail "show details" outside the app.
### Steps
1. Open the message → "to a@..., b@..., c@..." on one line, truncated with an ellipsis; "cc ..." beside it also truncated (the two spans share one line, `flex gap-x-3`).
2. Hover "to ..." → native `title` tooltip shows the full list (not available on touch or keyboard).
3. Looks for the Cc to see if the boss is included: the cc span may be squeezed to near zero width by a long To list.
4. She switches to Gmail to check.
### Variations
- Phone full-screen dialog: tooltips unavailable, so the list stays truncated.
- Message with no cc: only "to ..." shown.
### Edge Cases
- Bcc is never shown (also for sent items).
- Display names with commas or quotes are formatted `Name <addr>` by the server (`formatAddress`); many names make the line unreadable.
- Observed gap: no expand/"show details" control.

## STORY-009: Cold-start read on a phone with slow loading
**Type**: medium
**Topic**: read-with-context
**Persona**: Obinna Eze, field technician reading mail on a phone between jobs
**Goal**: Read one urgent message and move to the next
**Preconditions**: Narrow viewport; weak connection; Inbox agent panel collapsed by default on phones
**Ideal path**: 4 — tap row, read, tap Next message, read
**Alternate paths**: Touch "More" menu on row for Mark read.
### Steps
1. Tap the row → full-screen dialog (h-dvh), title from the row subject, header shows a grey skeleton, body skeleton.
2. Wait → header and body appear when `inbox.get` returns; if first 3 rows or neighbours were prefetched it is instant, otherwise a delay.
3. Tap "Next message" (ChevronDown) → next row; neighbours get prefetched so it often opens at once (cache of 40, FIFO).
4. A load error shows red text with "Try again" below the toolbar while the header skeleton stays.
5. Tap the "Close" X → returns via history to the list (or removes `mail`).
### Variations
- No keyboard: `j/k/e/r/a/f` are unavailable, so chevrons and buttons are the only navigation.
- Rotate to a wide screen: becomes 768px centered dialog.
### Edge Cases
- Once cache entries are evicted (over 40) a revisit re-fetches.
- Cached message bodies are never invalidated in the session, so a message edited upstream (rare) or one he marks read will not change; stale content is unlikely but the header "unread" state comes from the row, not the cache.
- While the error is shown the action buttons never appear (they require `message`).
