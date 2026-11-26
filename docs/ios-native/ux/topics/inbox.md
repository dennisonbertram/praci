# Topic: Inbox triage

Status: rewritten from the built SwiftUI code in `apps/ios/Sources/Praci/Inbox` (list, message, compose, to-dos, cleanup) and `Shared/SafeHTMLView.swift`. The earlier version described a planned app; every old story was written against boards and the Expo app, so none was kept unchanged. Nothing was run on a device for this pass: steps say what the code does, not what was observed. All names, addresses and subjects below are invented.

Facts that shape several stories:

- **Piles are not in the iOS UI.** `InboxRow.pile` is decoded (`RakazoAPI/Models/Inbox.swift`) but no view reads it. The list groups only by Needs reply, Today and Earlier (`groupInbox`). There is no pile filter, header or badge.
- **No way to start a new message.** `ComposeSheet` is created in one place, `InboxMessageScreen`, for Reply, Reply all and Forward. `InboxScreen` has no compose button. The code path for a new message and the multi-account "From" picker exist in `ComposeModel` and `ComposeSheet`, but a reply loads only the one account the original arrived on, so the picker never shows today.
- **Account choice exists only as a list filter.** The "Account" toolbar menu (`inboxAccount`) appears only when the list reports more than one account. Choices are "All" and one entry per account label.
- **Search** is the system search field with prompt "Search mail". It runs only on submit, and it runs against the chosen account.
- **HTML mail** renders in `SafeHTMLView`: scripts off, no navigation, images only over `data:`/`https:` or the server image proxy, the web view's own scrolling off, height sized to content inside the message screen's vertical `ScrollView`. There is no horizontal pan and no pinch zoom. Whether wide fixed-width mail is clipped, or shrinks to fit, has not been observed (verify on device).
- Writes can be off per account ("Mail writes are off for ..."); archive, spam and unsubscribe then fail with an error alert.

## STORY-INB-01: Morning triage of Needs reply, Today and Earlier
**Type**: medium
**Topic**: Inbox triage
**Persona**: Maya Okafor, solo founder of a four-person logistics startup, one Gmail account
**Goal**: Find the mail that needs an answer, read it, and leave the list shorter.
**Preconditions**: Signed in. One Gmail account connected. Mail writes on. List holds 2 "Needs reply" rows, 3 from today, 20 older.
**Ideal path**: 3. Open Inbox from Home, tap the top Needs reply row, reply or archive from the message.
**Alternate paths**: Home "Inbox" row (`inboxRow`, shows unread count) is the main route. A push or `rakazo://open/inbox` link opens the same screen. A To do card row opens a message directly (STORY-INB-09). The toolbar "Ask" button opens the Inbox agent thread and skips the list altogether.

### Steps
1. On Home tap "Inbox" → large-title "Inbox" opens; spinner, then the grouped list. The mailbox syncs once in the background and the list reloads when it finishes.
2. Read the "Needs reply 2" header and rows → each row shows an unread dot, sender, a small label (Needs attention, Newsletter, Spam or Junk, only when the row has a category), time (clock time today, weekday this week, month and day older), subject and one summary line.
3. Tap the first row → the row loses its unread dot at once and the Message screen pushes.
4. Read the message, tap "Archive" in the toolbar → the bottom bar shows "Archived" with "Undo"; the message stays on screen.
5. Go Back → whether the archived row is gone without a pull is not guaranteed by the code (the list is only updated locally for list-side actions); verify.
6. Pull down → the list syncs and reloads.

### Variations
- A suspicious row: a red triangle (label "Suspicious") leads the sender name; no category label is shown (suspicious keeps only the icon).
- A row the user marked noise (`feedback == "noise"`) is drawn at 60% opacity.
- Scrolling to the last row loads the next page (`loadMoreIfNeeded`); no spinner is shown while it loads.

### Edge Cases
- Needs reply sorts newest first and ignores the date split, so an old thread can sit above today's mail.
- Message fails to load: the screen shows the error with a retry (`LoadableView`).
- Archive fails (writes off, Gmail needs reconnect): alert "Couldn't finish that" with OK; the message screen state is unchanged.
- Opening a message from the list marks it read on screen only; the server learns when the Message screen loads (see code comment in `InboxModel.didOpen`).
- Piles do not appear anywhere in this list although the server sends them.

## STORY-INB-02: Swipe and long-press actions with Undo
**Type**: short
**Topic**: Inbox triage
**Persona**: Idris Venter, operations lead who clears newsletters one-handed
**Goal**: Archive a newsletter, mark one thing as spam, and keep a message unread for later.
**Preconditions**: List loaded with a Newsletter row, a Junk row and an unread personal row.
**Ideal path**: 1 per message (one swipe).
**Alternate paths**: Swipe left (Archive, Spam). Swipe right (Read or Unread). Long-press context menu (Mark as read/unread, Archive, Spam). On the message screen the toolbar "Archive" button. Cleanup screen for bulk senders (STORY-INB-08). Archive is reachable in four places for the same action.

### Steps
1. Swipe the newsletter row left past the edge → full swipe commits "Archive"; the row leaves the list at once and a glass toast "Archived  Undo" shows for 5 seconds.
2. Swipe the Junk row left, tap "Spam" (orange) → row leaves; toast "Moved to spam  Undo".
3. Swipe the personal row right → "Read" or "Unread" button (blue) flips the dot immediately.
4. Tap "Undo" on the toast → the toast closes, the server restores the message, the list reloads and the row returns.

### Variations
- Long-press a row for the context menu with the same three actions, no swipe needed (also reachable with VoiceOver).
- A second action while a toast shows replaces the toast, so only the latest action can be undone.

### Edge Cases
- Spam is rejected for one message (`failed` in the result, reason `reconnect`): row returns to its position and the alert says "Reconnect Gmail to do that."
- Any other failed archive: row returns and the alert says "Couldn't move that message."
- Mark read fails: the dot reverts and the alert shows.
- Full swipe on Archive has no confirmation; the toast is the only safety net, and it disappears after 5 seconds.

## STORY-INB-03: Choose between two Gmail accounts
**Type**: short
**Topic**: Inbox triage
**Persona**: Priya Raman, founder with a company address and a personal address connected
**Goal**: See only the company mail, then go back to everything.
**Preconditions**: Two Gmail accounts connected, labeled "priya@brightloom.test" and "priya.raman@mailbox.test".
**Ideal path**: 3. Tap the account menu, pick the account, read the list.
**Alternate paths**: none found for filtering. Connecting or reconnecting an account is in Settings, Integrations (outside this topic).

### Steps
1. Open Inbox → because the list reports two accounts, a filter icon (label "Account") appears in the toolbar next to "Ask".
2. Tap it → a menu with a picker: "All", "priya@brightloom.test", "priya.raman@mailbox.test".
3. Choose the company address → the list reloads for that connection only. Rows do not show which account they belong to.
4. Choose "All" → the merged list returns.

### Variations
- A search typed while an account is selected searches that account only.
- With one account the menu is absent and there is no hint that the Inbox is account-scoped.

### Edge Cases
- Nothing on the list tells the user which account is active once the menu closes; the toolbar icon is the same for All and a single account.
- The chosen account is held in memory (`connectionID`), not saved. Leaving the Inbox and returning resets it to All.
- One account needs reconnecting while the other works: the banner "Gmail needs to reconnect" appears above the rows with a "Reconnect" button that opens Settings; the working account's rows still show.
- Replying never offers the other account; the reply is sent from the account the mail arrived on (From is a read-only row).

## STORY-INB-04: Search mail and act on a result
**Type**: short
**Topic**: Inbox triage
**Persona**: Tomas Lindqvist, finance lead looking for a vendor invoice
**Goal**: Find the October invoice from Harbor Supply and open it.
**Preconditions**: Inbox loaded.
**Ideal path**: 4. Tap the search field, type, tap Search on the keyboard, tap the result.
**Alternate paths**: "Ask" toolbar button lets the Inbox agent search in plain language (opens a thread, so it is a longer detour). No saved searches or filters.

### Steps
1. Tap "Search mail" under the title → keyboard opens.
2. Type "harbor supply invoice" and press Search → the list reloads with matches; the grouping (Needs reply / Today / Earlier) still applies to results.
3. Tap a result → Message opens as in STORY-INB-01.
4. Back, clear the field → the full list does not reload until the query is submitted empty (verify).

### Variations
- Swipe and context actions work on search results too.
- Searching while pulled to refresh runs the sync, then reloads with the same query.

### Edge Cases
- No match: `ContentUnavailableView.search` shows "No Results for '...'".
- Search while Gmail is unreachable: the empty state shows the problem view instead of "No Results" (problem is checked before the query).
- Typing alone does nothing; results change only on submit.

## STORY-INB-05: Read plain mail and long HTML mail
**Type**: medium
**Topic**: Inbox triage
**Persona**: Maya Okafor on a commute, reading a long customer newsletter and a plain-text note
**Goal**: Read each message to the end and reach the links and attachment.
**Preconditions**: One message with only a plain-text body. One with a 12-screen-long HTML body and a PDF attachment.
**Ideal path**: 2. Open the message, scroll.
**Alternate paths**: none found; there is no reader mode or "open in browser" for the body.

### Steps
1. Open the plain-text message → subject (title style), sender, "to Maya, ... · Nov 3, 9:14 AM", optional Cc line, then the body as selectable text.
2. Open the HTML message → same header, then the web view; it grows to full content height so the whole message scrolls in the one vertical scroll view.
3. Scroll to the end → "paperclip  Q3-report.pdf  1.2 MB" row appears under the body.
4. Tap the attachment row → the file downloads and Quick Look previews it.
5. Tap a link inside the HTML → it opens in Safari; the page never navigates in place.

### Variations
- A thread: a "N earlier" disclosure row above the body expands to short sender and snippet entries (3 lines each); they are not tappable.
- A message with no body: "No content".
- A message from the user: a "Sent" badge by the sender name; "More" and Unsubscribe are hidden.
- Subject empty: "(No subject)".

### Edge Cases
- Very long HTML: the web view's height equals the full content, so memory use grows with message length (verify on a 50-screen mail).
- Remote images arrive through the server's image proxy; blocked or failed images leave empty space; there is no "load images" control.
- Attachment download fails: alert "Couldn't finish that".
- Dark mode: the mail inherits `color-scheme: light dark`; mail with a hard-coded white background and dark text can be unreadable or fully bright (verify).

## STORY-INB-06: Wide HTML mail on a narrow phone
**Type**: short
**Topic**: Inbox triage
**Persona**: Tomas Lindqvist reading a 700 px wide pricing table from a vendor
**Goal**: See all columns of the table.
**Preconditions**: HTML message with a fixed-width 700 px table and an unbroken 60-character line.
**Ideal path**: 2. Open the message, pan or zoom to read the table.
**Alternate paths**: none found. The page-level vertical scroll is the only scrolling; inner scrolling is off and zoom is not enabled.

### Steps
1. Open the message → the document sets `viewport width=device-width, initial-scale=1`, `img` and `table` are capped at `max-width:100%`, and text wraps with `overflow-wrap: anywhere`.
2. Look at the table → fixed-width tables are squeezed by `max-width:100%` or clipped at the screen edge, depending on how the sender wrote the HTML (verify on device).
3. Try to pan sideways → the web view's scroll view is disabled and the outer `ScrollView` is vertical only, so nothing moves.
4. Try pinch zoom → no zoom is offered (not enabled in the configuration).

### Variations
- A mail built from nested layout tables with `width="600"` attributes behaves differently from a CSS-width one.
- An image wider than the screen is scaled down, so it stays whole.

### Edge Cases
- Content that overflows past `max-width` is unreachable; the user has no route to see it on the phone.
- On the Duo layout (not built yet) the width changes; this story should be rerun there.

## STORY-INB-07: Reply, Reply all and Forward
**Type**: long
**Topic**: Inbox triage
**Persona**: Maya Okafor answering a customer's pricing question while on the train
**Goal**: Reply with two sentences, then forward the same thread to a teammate.
**Preconditions**: A message from "Ana Costa <ana@northwind.test>", Cc to "Ben Ode <ben@northwind.test>", with one 200 KB attachment. Mail writes on. Network available.
**Ideal path**: 4. Tap the reply menu, tap Reply, type, tap Send.
**Alternate paths**: The "Ask Inbox agent" button at the bottom opens a thread where the Inbox agent can draft a reply (approval card with Send/Save/Discard, see approvals topic). The toolbar "Ask" on the list does the same without a message in context. There is no swipe or long-press reply on the list.

### Steps
1. In the message tap the reply icon (label "Reply") in the toolbar → a menu with "Reply", "Reply all" (only when the recipients differ), "Forward".
2. Tap "Reply all" → a sheet "Reply" slides up; prefilled To "ana@northwind.test", Cc "ben@northwind.test" (Cc fields already open), subject "Re: ..." and a quoted body. From is a read-only row with the account address.
3. Type two sentences above the quote → Send turns on as soon as To holds one valid address.
4. Tap the paper-plane "Send" → a spinner replaces it, the sheet closes, and "Sent" shows for 3 seconds at the bottom of the message.
5. Open the menu again, tap "Forward" → sheet "Forward"; subject "Fwd: ..."; the 200 KB attachment is listed with a remove button.
6. Type "ben@northwind.test, kofi@brightloom.test" in To → each address is validated; send.
7. Tap Cancel on a half-written forward → dialog "This draft has changes": "Save draft", "Discard draft", "Keep editing". Swipe-down dismissal is blocked while there are changes.

### Variations
- "Cc, Bcc" button reveals both fields and focuses Cc.
- "Save draft" keeps the draft on the server and closes; it is not shown anywhere in the iOS app afterward (no Drafts view).
- Forward with attachments over the size limit: a banner "Some files were left out: name.zip."
- Cancel when nothing was edited closes immediately.

### Edge Cases
- Invalid address: "Not a valid address" in red under the field; Send stays off.
- Timeout or dropped connection during send: banner "We couldn't confirm this sent. Check Sent before sending again." with "Close". Send stays off and the app never retries on its own.
- Server refusal: banner "Not sent. Try again." (or "Gmail is limiting requests" / "Gmail rejected the message. Check the addresses."), the sheet stays open.
- Gmail needs reconnecting: banner "Gmail needs to reconnect before it can send. Reconnect it in Settings." The sheet has no button to go there.
- Mail writes off: banner "Mail writes are off for the account."
- A new message cannot be started from the Inbox at all.

## STORY-INB-08: Clear out newsletters with Cleanup
**Type**: long
**Topic**: Inbox triage
**Persona**: Idris Venter, three weeks behind, 400 unread newsletters from twelve senders
**Goal**: Archive everything from the noisy senders and unsubscribe from the ones he never reads.
**Preconditions**: Inbox loaded. Cleanup list has 12 senders; some are preselected; one is "Looks like spam".
**Ideal path**: 4. Open the menu, open Cleanup, confirm the preselected senders, tap Archive.
**Alternate paths**: Per-message "More" > "Unsubscribe from ..." on the message screen (STORY-INB-10). Swipe Archive per row (STORY-INB-02). Cleanup is the only bulk route; it sits behind the "More" (ellipsis) menu in the Inbox toolbar.

### Steps
1. On the Inbox tap the ellipsis ("More") then "Cleanup" → Cleanup pushes; senders ranked, each row: circle or filled check, name, "42 emails · last Oct 29", optional "Looks like spam" in orange.
2. Tap rows to change the selection → the bar reads "5 senders selected"; the Archive button reads "Archive 213 emails".
3. Tap "Archive 213 emails" → alert "Archive 213 emails?" with message "Undo brings them back." Tap "Archive".
4. Wait → a spinner and "Archiving" with a Cancel button.
5. Done view → check mark, "213 emails archived", "Undo", and "Unsubscribe from 4 senders" (for those that can).
6. Tap "Unsubscribe from 4 senders" → alert "Unsubscribe from 4 senders?" with "Unsubscribing can't be undone." → confirm.
7. For a sender that only offers a mail link → alert "Send an unsubscribe email to unsubscribe@sender.test?" with Send/Cancel, one sender at a time.
8. Sender with a web-only link → Done view lists "Open unsubscribe link for sender.test"; the link opens Safari.
9. Tap "Done" → returns to the selection list, refreshed.

### Variations
- Unsubscribe alone from the bottom bar's "Unsubscribe" button (disabled with nothing eligible).
- "Undo" is offered once; after it the headline reads "Undone".
- Empty list: "Nothing to clean up — Senders that fill your inbox appear here."

### Edge Cases
- Some senders fail: the Done view lists "Couldn't update Harbor Supply" in red; the rest succeed.
- All of them fail: screen "Couldn't finish" with "Try again" (repeats the same choice) and "Back"; nothing moved.
- Cancel while running stops after the current sender; the Done view shows what completed.
- The Inbox list is not reloaded when Cleanup finishes, so archived mail may still show until a pull to refresh (verify).

## STORY-INB-09: Work the To do card
**Type**: short
**Topic**: Inbox triage
**Persona**: Maya Okafor checking what the Inbox agent pulled out of her mail
**Goal**: Tick off a to-do and open the message behind another.
**Preconditions**: Mail triage is on and 2 open to-dos exist: "Send W-9 to Harbor Supply" (from Harbor Supply, due Tomorrow) and "Confirm Thursday demo" (due Today).
**Ideal path**: 1 to complete, 2 to open the message.
**Alternate paths**: none found for editing or adding a to-do; Meetings detail also lists to-dos (separate topic).

### Steps
1. Open Inbox → a "To do" card sits above "Needs reply" (it shows only when triage is on and something is open).
2. Tap the circle (label "Mark done") on "Confirm Thursday demo" → the row leaves the card at once.
3. Tap the text of "Send W-9 to Harbor Supply" → the source message opens.

### Variations
- A to-do with no source message has a disabled text button (no tap response).
- A due date shows "Today", "Tomorrow", "Yesterday", or "Nov 14".

### Edge Cases
- Saving "done" fails: the row returns and an alert says "Couldn't save that. Try again."
- The card loads once per screen visit; pull to refresh does not reload it (verify).
- A failed load hides the card without any message.
- The card scrolls with the list; it is not pinned.

## STORY-INB-10: Unsubscribe from a sender while reading
**Type**: short
**Topic**: Inbox triage
**Persona**: Priya Raman reading a product-update email she no longer wants
**Goal**: Stop mail from this sender.
**Preconditions**: Open message from "Loomly Updates <news@loomly.test>".
**Ideal path**: 3. Tap "More", tap "Unsubscribe from Loomly Updates", confirm.
**Alternate paths**: Cleanup screen (STORY-INB-08) handles many senders at once. No unsubscribe from a list row.

### Steps
1. Tap the ellipsis ("More") in the message toolbar → one item, "Unsubscribe from Loomly Updates?".
2. Tap it → dialog "Unsubscribe from Loomly Updates?" / "This can't be undone." with Unsubscribe and Cancel.
3. Tap "Unsubscribe" → alert "Unsubscribed" (or one of the outcomes below).

### Variations
- Outcome "Unsubscribe email sent".
- Outcome "Finish in your browser" with "Open link" and "Close".
- Outcome "Send an unsubscribe email to news@loomly.test?" with Send/Cancel.

### Edge Cases
- "Couldn't confirm": "Check your Sent mail before trying again."
- "Can't unsubscribe from this sender": "This sender has no unsubscribe option."
- Failure messages: "Changing mail is turned off.", "The sender didn't accept that.", "Couldn't unsubscribe."
- The menu is hidden for mail the user sent and for mail with no parsable sender address.
- The menu is labeled "More" but holds only unsubscribe, and it appears even for personal mail.

## STORY-INB-11: Gmail problem states and empty states
**Type**: medium
**Topic**: Inbox triage
**Persona**: Maya Okafor, first thing after her Google password changed
**Goal**: Understand why mail has stopped arriving and fix it.
**Preconditions**: Gmail token revoked; server reports the account in `reconnectAccounts`.
**Ideal path**: 2. See the banner, tap Reconnect.
**Alternate paths**: Settings > Integrations also reconnects (the button routes there). The same "Connect Gmail" button appears in the no-account empty state.

### Steps
1. Open Inbox → rows already synced show, with a card at the top: "Gmail needs to reconnect" and a "Reconnect" button.
2. Tap "Reconnect" → the Settings sheet opens (the app does not deep link to the Gmail connection inside it).
3. Reconnect, close Settings → the Inbox is not reloaded by closing the sheet; pull to refresh (verify).

### Variations
- Rate limited: "Gmail is limiting requests" with "Try again".
- Unreachable: "Couldn't reach Gmail" with "Try again".
- No cached rows: the same problem fills the screen as a full empty state with a prominent button.
- No account at all: "No mail account — Connect Gmail to see your inbox here." with "Connect Gmail".
- First sync still running: spinner and "Syncing mail".
- Empty after sync: "Inbox zero" with "Synced 9:14 AM".

### Edge Cases
- Two problems at once: reconnect wins over rate limited, then unreachable (single banner).
- First load fails with no list: full error with retry; with a list on screen, a failed reload keeps the old rows silently.
- Offline pull to refresh: the sync result is ignored and the list reloads from the server; no offline banner on the Inbox (verify).
- Archive or spam while reconnect is needed: row returns and the alert says "Reconnect Gmail to do that."
