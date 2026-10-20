# Topic: Inbox triage and compose

Status: planning stories for the planned native SwiftUI iPhone app (epic #427, phase 6 issue #418). No Swift code exists. Labels are quoted from the boards (`docs/design-system/ios/boards/`) and from the Expo app (`apps/mobile`). Where the Expo label differs from the board, the story uses the board label and the difference is listed under Design gaps.

Facts that apply to several stories:

- The Expo app has no Compose, Reply or Forward. `apps/mobile/app/inbox-message.tsx` offers only "Inbox agent" and "Ask agent". The API exists (`inbox.compose.prefill`, `draftSave`, `send`, `discard`), so every compose screen in these stories is a new screen with NO BOARD.
- The Inbox list is drawn on `Sheet.dc.html` (outer display), `Inner.dc.html` (inner display with the Inbox agent thread) and `Split.dc.html` (side strip). There is no board for the Inbox on a standard 393 pt iPhone. The rule card in `PG-A-Rules.dc.html` says the standard iPhone uses large titles with an inline search field.
- Filter specimen: `DS-04-Overlays.dc.html` ("Sort by": Newest first, Oldest first, Unread first; "Show": Needs reply, Newsletters, Read mail; "Select messages"). Swipe and mail row specimens: `DS-05-Lists.dc.html`.

## STORY-001: Morning triage with pull to refresh and swipe to archive
**Type**: short
**Topic**: Inbox triage and compose
**Persona**: Maya Okafor, solo founder of a 4-person logistics startup
**Goal**: Clear newsletters from the Inbox in one minute before standup.
**Preconditions**: One Gmail account connected. Inbox shows 3 "Needs reply" rows and a list of newer mail. Mail writes are on.
**Device**: standard iPhone
**Ideal path**: 3 — pull to refresh, swipe left on a row, release past the threshold (full swipe commits Archive).
**Alternate paths**: Long-press the row and choose "Archive" from the context menu (DS-05 says every swipe action has a long-press menu item). Open the message and tap Archive in its toolbar. VoiceOver custom action "Archive". In Expo today the only per-row action is the row menu (Archive, Spam, Trash) and the "Archive all" bulk button in the Newsletters digest.
**Design source**: Inbox list on a standard iPhone: NO BOARD (rule card in `PG-A-Rules.dc.html` "Inbox" gives only the outer layout). Row and swipe: `DS-05-Lists.dc.html` "Mail row" and "Swipe actions". Section header: `DS-05-Lists.dc.html` "Section headers".

### Steps
1. Open the app and tap the Inbox row on Home → Inbox opens with a 28 pt title "Inbox" and sections "Needs reply" (count 3), then the date sections. The list shows placeholder rows while loading, then mail from the cache.
2. Pull the list down → the list calls `inbox.refresh` (with `waitMs`) and then `inbox.list`; new mail appears at the top with a filled unread dot and semibold sender.
3. Swipe the row "Example Weekly / Five tools worth trying" left, past the threshold → "Archive" fills the row and commits (`inbox.archive`); the row leaves the list.

### Variations
- Swipe left only part way: three buttons appear in this order from the outside: "Archive", "Star", "Mute". Tap "Star" or "Mute" instead (see Design gaps).
- Swipe right on an unread row: "Mark read" (calls `inbox.markRead`). On a read row it reads "Mark unread".
- Several accounts connected: Expo shows an "Account" picker with "All"; the boards do not show one.

### Edge Cases
- Archive fails ("Changing mail is turned off." or a reconnect error): the row must return and the error must be visible. Expo shows an alert "Could not archive {count}". The board has no error state for a swipe.
- The user archives by mistake: `inbox.unarchive` and `inbox.actions.undo` exist, but no Undo control is drawn for a single swipe.
- Offline pull to refresh: the list keeps the cached rows; the board shows "Could not load mail." with retry only for a first load.

### Design gaps
- No standard iPhone Inbox board.
- "Star" has no write procedure in `rpc.ts` (`InboxFilter` has `starred` as a read filter only). "Mute" could map to `inbox.feedback` with mark `noise`, but the plan does not say so. Both appear on the swipe specimen.
- No Undo toast after Archive, though the API supports undo.
- Section names differ: board "Other mail today" (Sheet, Inner) versus plan and Expo "Today" and "Earlier". The "Earlier" header is drawn in DS-05 only.
- Expo row menu offers Spam and Trash; the swipe specimen and the row menu text on the board list only Archive, Star, Mute, Mark read.

---

## STORY-002: Read a message with attachments and ask the Inbox agent
**Type**: medium
**Topic**: Inbox triage and compose
**Persona**: Tomas Brandt, operations lead at a 12-person fintech
**Goal**: Read Ana's request to move the kickoff, check the attached timeline, and have the agent propose a reply.
**Preconditions**: Gmail connected. "Re: Pilot timeline" from Ana Ruiz is in "Needs reply". The Inbox agent exists (or will be created on first use). A model is connected.
**Device**: standard iPhone
**Ideal path**: 2 — tap the row, tap "Ask Inbox agent".
**Alternate paths**: From the Inbox list, tap the prominent "Ask Inbox agent" button (opens the general Inbox agent, no message context; `inbox.agent`). From Home, open "Inbox agent" in Personnel. Expo labels the same message action "Ask agent" and the general one "Inbox agent".
**Design source**: `PG-A-InboxMessage.dc.html` (message screen) and the "Inbox message" rule card in `PG-A-Rules.dc.html`. Attachment row: `DS-05-Lists.dc.html`. Agent thread: `PG-A-Thread.dc.html` ("Inbox agent is working"). Attachment preview screen: NO BOARD.

### Steps
1. In Inbox, tap the "Re: Pilot timeline" row from Ana Ruiz → the message opens (push). The title area shows a back button "Back"; the toolbar shows "Archive", "Reply" and the prominent "Ask Inbox agent". A spinner shows in the body while `inbox.get` loads. Opening marks the thread read.
2. Read the 22 pt subject "Re: Pilot timeline", the sender line "Ana Ruiz to me Oct 19, 10:30 AM", and the 15 pt body → the body renders in a no-network web view (scripts off, remote images only through the signed proxy).
3. Tap the attachment row "pilot-timeline.pdf 212 KB" → a preview opens (Expo: `inbox-attachment`; "Share" button; "No preview for this file type." for unknown types).
4. Close the preview and tap "kickoff-agenda.md 4 KB" → preview opens in the same way.
5. Tap "Ask Inbox agent" → `inbox.askAgent` for this message runs (idempotent per mail conversation) and the Inbox agent thread opens with the conversation as context.
6. Type "Draft a reply that accepts Thursday morning" in the composer and send → the thread shows the working indicator "Inbox agent is working" with a stop control; the agent answers and may show a mail approval card (covered in the Approvals topic).

### Variations
- Attachment over the size limit: the row shows the size and a disabled state (rule card).
- Sent mail (the user's own message in a thread): a "Sent" check shows beside the date.
- Plain-text mail: no web view, plain 15 pt text.

### Edge Cases
- `inbox.get` fails: centered "Could not load mail." (rule card). The card does not say whether a retry control exists on this screen; the list screen has one.
- `askAgent` fails, or no model is connected: Expo shows an alert with the error text. The board has no state for it.
- Message belongs to a thread with earlier messages: `InboxMessageSchema` carries `thread` and `later` arrays, but the board shows one message only.
- Tapping a link in the body: Expo opens `expo-web-browser`. The planned equivalent is not specified (Safari view or system browser).

### Design gaps
- Attachment preview screen has no board (PDFKit and Quick Look are named in the plan).
- Thread of several messages in one conversation has no layout.
- Unsubscribe from the message screen is not drawn, although `inbox.unsubscribe` exists.
- Label mismatch: board "Ask Inbox agent" versus Expo "Ask agent" (message) and "Inbox agent" (list).
- Sender avatar is listed in the rule card ("Domain (sender avatar)") and drawn as initials "AR" on the board, but the plan says nothing about where avatars come from.

---

## STORY-003: Reply to a customer and send
**Type**: medium
**Topic**: Inbox triage and compose
**Persona**: Priya Raman, founder of a developer-tools startup
**Goal**: Accept Ana's proposed Thursday kickoff by replying from her phone.
**Preconditions**: Gmail connected, mail writes on. "Re: Pilot timeline" is open.
**Device**: standard iPhone
**Ideal path**: 4 — tap "Reply", type the reply, tap Send; the sheet closes.
**Alternate paths**: Ask the Inbox agent to draft and send; approve the card "view draft", "Send" (Approvals topic). Reply-all and Forward are modes of the same screen (`ComposeMode`: reply, replyAll, forward), but the entry point for Reply all is not drawn.
**Design source**: Reply button: `PG-A-InboxMessage.dc.html`. Compose sheet, From line, Send, Discard: NO BOARD. Keyboard and sheet patterns: `DS-04-Overlays.dc.html` (sheets).

### Steps
1. On the message, tap "Reply" → a compose sheet opens. The app calls `inbox.compose.prefill` with mode `reply` and the device time zone and locale; To is Ana Ruiz, Subject is "Re: Pilot timeline", and the body holds the quote. A `clientId` is generated for idempotency.
2. Type "Thursday morning works. See you then." above the quote → text appears; the draft is held on the device.
3. Tap Send → `inbox.compose.send` runs and the sheet shows a progress state.
4. The result is `sent` → the sheet closes and the original message shows a confirmation (not designed).

### Variations
- Tap "Cancel" with typed text: ask to keep a draft (`draftSave` returns `saved`) or discard (`discard`).
- Add Cc or Bcc: the fields exist in `ComposeFields`; how they appear is not drawn.
- Add an attachment: up to 20 files, 10 MB together (base64 inside the request).

### Edge Cases
- Result `unknown`: the send may have gone out and must never be retried automatically. The user is told to check Sent. The copy and the screen are not designed.
- Result `failed` with reason `rejected` or `rate_limited`: nothing was sent; retry is safe.
- Result `reconnect`: the Gmail account lacks permission to send; the user needs a "Reconnect" path.
- Result `disabled`: the deployment has mail writes off; Reply should not be offered, or should explain.
- `quoteUnavailable` is true: To and Subject come from the cache and the quote is empty.
- App is backgrounded during Send, or the connection drops: no outbox for mail is described (threads have one; mail compose does not).
- Double tap on Send: the same `clientId` makes the second call idempotent.

### Design gaps
- Compose sheet has no board: fields, From account picker, Cc/Bcc reveal, attachment picker, formatting (the API takes `html`), sending state, error banner.
- Outcome copy for `saved`, `sent`, `unknown`, `reconnect`, `disabled`, `failed` is not defined.
- Whether the sheet is medium or large, and how it behaves on the outer display, is not stated.
- Reply is an "ordinary glass button" per the rule card, but the glass toolbar group on a standard iPhone has no board.
- Reply-all has no control.

---

## STORY-004: Forward a message with its attachments
**Type**: medium
**Topic**: Inbox triage and compose
**Persona**: Jonas Weber, head of sales at a seed-stage SaaS company
**Goal**: Forward the pilot timeline and agenda to a teammate.
**Preconditions**: "Re: Pilot timeline" open, two attachments (212 KB and 4 KB). A second Gmail account is connected.
**Device**: standard iPhone
**Ideal path**: 6 — find forward, choose forward, enter a recipient, check attachments, send (the entry point is not drawn, so the count is a best estimate).
**Alternate paths**: Ask the Inbox agent to forward it (agent tools). Long-press the row in the list (menu content not drawn for forward).
**Design source**: Forward entry point: NO BOARD. Compose sheet: NO BOARD. Attachment rows: `DS-05-Lists.dc.html`.

### Steps
1. On the open message, look for a way to forward → the toolbar shows only "Archive" and "Reply" on the board. Open the Reply control's menu if one exists (undefined).
2. Choose Forward → `inbox.compose.prefill` with mode `forward`; the sheet opens with Subject "Fwd: Re: Pilot timeline", the forwarded header in the body, and the two original files listed as attachments to be re-attached on the server (`forwardOf`).
3. Type a recipient in To (for example `sam@example.com`) → the field accepts a comma-separated list. Contact suggestions are not described.
4. Check the From line, which shows the account the original arrived on → switch it with the picker if needed.
5. Tap Send → `inbox.compose.send` with `forwardOf.attachmentIds`; files are attached by the server and do not travel from the phone.
6. Result `sent` → sheet closes.

### Variations
- Remove one attachment before sending (the list is editable in the API through `attachmentIds`).
- A forward of an HTML mail: `quotedHtml` is returned for display under the forwarded header.

### Edge Cases
- `attachmentsTooLarge` is true: the sheet should name the files in `attachmentsLeftOut` and send without them.
- Forward from a message whose body cannot be read from Gmail: `quoteUnavailable`.
- Recipient field empty: Send must stay disabled.
- Two accounts: the From account must default to the original's account, and the app must not send from the wrong one.

### Design gaps
- No Forward control on the message board.
- No compose screen, no attachment list, no From picker.
- No recipient autocomplete; `contacts.list` exists but is not tied to mail.
- No copy for "files left out".

---

## STORY-005: Find a message by search and filter on the outer display
**Type**: medium
**Topic**: Inbox triage and compose
**Persona**: Dana Kowalski, founder who uses an iPhone Duo folded shut
**Goal**: Find every unread message from Northwind and archive them.
**Preconditions**: Gmail connected, about 200 messages cached, mail writes on.
**Device**: iPhone Duo outer (466x678 pt)
**Ideal path**: 5 — "Search mail", type, open "Filter", pick an option, swipe or archive.
**Alternate paths**: Global Search (`DS-04-Overlays`, "Search across agents, mail and artifacts from anywhere") returns "Mail" results with a message jump, but `search.query` is not planned for this phase. Ask the Inbox agent "find unread mail from Northwind".
**Design source**: `Sheet.dc.html` (side strip: Back, "Search mail", "Filter", "Compose", prominent "Ask Inbox agent"). Filter content: `DS-04-Overlays.dc.html`. Search results state: `DS-05-Lists.dc.html` "Results 3". No-results text: `DS-04-Overlays.dc.html` ("No results for pilotx", "Try a sender, agent or file name.").

### Steps
1. From Home, tap the Inbox row → Inbox opens in the 2/3 content column starting at x=72 with the 28 pt title "Inbox". The side strip has "Back", then the group "Search mail", "Filter", "Compose", and the prominent "Ask Inbox agent".
2. Tap "Search mail" → a glass search field appears right of the strip and the keyboard rises from the bottom.
3. Type "Northwind" → results show as rows under a "Results 3" header (a Gmail-syntax `query`, read live, up to 50 per account).
4. Tap "Filter" → a medium-detent sheet opens (on the inner display this is a popover) with "Sort by": "Newest first", "Oldest first", "Unread first"; "Show": "Needs reply", "Newsletters", "Read mail"; and "Select messages".
5. Pick "Unread first" → the list reorders; results stay the same.
6. Swipe the top result left past the threshold → Archive commits.

### Variations
- Clear the search with Cancel → the normal sections return.
- Type a query with no matches → "No results for pilotx" and "Try a sender, agent or file name."
- Scroll to the end of a filtered or searched list with `nextPageToken` → the next page loads. No "loading more" row is drawn.
- Choose "Select messages" → the list enters a selection mode (an "empty list" specimen exists, but the mode itself is not drawn).

### Edge Cases
- Searching while Gmail is unreachable or rate limited (`rateLimitedAccounts`): no state is drawn.
- Keyboard covering results on a short height (466x420): the strip collapses into "More"; the prominent button collapses last.
- Search text includes Gmail operators (`from:`, `is:unread`): the API passes them through; the field gives no hint, which is fine.

### Design gaps
- "Filter" popover items ("Show in inbox": "Needs reply", "Newsletters", "Read mail") do not match the Expo categories (All, Important, Updates, Newsletters, Spam {count}, and the Senders/Digest switch under Newsletters). "Read mail" has no matching `InboxFilter` value.
- DS-04 says the Filter sheet is "Opened from More at the bottom of the side strip", but `Sheet.dc.html` puts "Filter" in the strip. These contradict each other.
- `Split.dc.html` has a star-shaped "Important only" button next to Filter. It is not in the rule card or in `Sheet.dc.html`.
- "Select messages" mode, bulk Archive, and its confirmation have no board.
- Search result rows for the user's own sent mail (`fromSelf`) have no distinct treatment.

---

## STORY-006: Check off a to-do from the Inbox
**Type**: short
**Topic**: Inbox triage and compose
**Persona**: Lena Fischer, founder of a design agency
**Goal**: Mark "Send Ana the revised budget" done after replying.
**Preconditions**: The triage model has extracted at least one to-do from mail. Triage is enabled (a model is connected and the recipient is allowed).
**Device**: standard iPhone
**Ideal path**: 2 — open Inbox, tap the checkbox.
**Alternate paths**: Open the to-do's message (the row links to its message when `messageId` is not null). Ask the Inbox agent to mark it done (no such agent tool is documented).
**Design source**: To do card: `DS-05-Lists.dc.html` ("To do card"). Inbox screen on a standard iPhone: NO BOARD.

### Steps
1. Open Inbox → a "To do" card sits on top of the list (card radius 14, title "To do"). Rows show the text, "sender · detail" and a due label on the right.
2. Tap the 22 pt circle checkbox (44 pt target) on "Send Ana the revised budget" → the circle fills, the row is saved with `inbox.todos.setDone` (done: true), and the row leaves the card.

### Variations
- Last to-do done: the card disappears (rule: "Do hide the card when there is nothing to do").
- Tap the to-do text: opens the source message.

### Edge Cases
- `messageId` is null because the message left the 14-day cache: the row cannot open anything. No state is drawn.
- `setDone` fails: the checkbox must revert. Expo's equivalent shows an alert.
- Triage blocked (`no_model` or `needs_consent`): no card appears and nothing says why. The API returns `triageBlocked`; Expo hides triage UI.

### Design gaps
- No undo for a completed to-do.
- No explanation or "turn on" path when triage is blocked (consent prompt has no board).
- The to-do due label ("Today" style) has a formatting rule only in Expo (`apps/mobile/lib/mail-inbox.ts`).
- Whether a done to-do can be seen again (history) is undefined.

---

## STORY-007: Bulk cleanup and unsubscribe from noisy senders
**Type**: long
**Topic**: Inbox triage and compose
**Persona**: Ravi Menon, founder with 6,000 unread messages after two years of use
**Goal**: Unsubscribe from five newsletter senders, archive their old mail and mark one as spam, then undo one choice.
**Preconditions**: Gmail connected, mail writes on, triage enabled. Cleanup list is populated by the server.
**Device**: standard iPhone
**Ideal path**: 18 — open Cleanup, then per sender select an action, confirm, review the history, undo.
**Alternate paths**: In Expo, the Newsletters filter has a "Senders" / "Digest" switch with "Archive all". The row menu offers "Archive", "Spam", "Trash" per message. Ask the Inbox agent to "archive newsletters older than a week" (DS-05 shows this as an Inbox agent preview).
**Design source**: NO BOARD for the Cleanup screen, its action bar, its confirmations or its history. Entry point: NO BOARD (Expo puts "Cleanup" in the "More" menu of `inbox.tsx`; the boards have no "More" menu in the Inbox strip).

### Steps
1. Open Inbox, then the "More" menu → Expo shows "Cleanup" with a checklist icon. The boards have no matching control (see gaps).
2. Tap "Cleanup" → the cleanup screen loads (`inbox.cleanup.list`) with a spinner, then a list of senders. Each row shows the sender name and "{count} messages · {percent}% read". Some rows show "Looks like spam".
3. Tap the first sender "Example Weekly" → the row is selected (checkbox).
4. Select four more senders → the selection count updates.
5. Open the action menu → options are "Archive", "Skip inbox", "Unsubscribe", "Spam", "Not spam", "Trash" (Expo labels).
6. Choose "Unsubscribe 5" → a confirmation alert lists the label and offers "Cancel" and the action.
7. Confirm → `inbox.unsubscribe` runs per sender and returns one of: `done`, `opened` (open a link), `sent`, `unknown`, `refused`, `disabled`, `unavailable`.
8. For a sender that returns `opened` → the row shows "Open link"; tap it to open the page in a browser; return to the app.
9. For a sender whose unsubscribe is by mail → an alert "Send an unsubscribe email to {address}?" with "Cancel" and "Send"; tap "Send".
10. For a sender that returns `refused` or `unavailable` → the row shows "Could not update {name}" and, where possible, "Open link".
11. Select two other senders and choose "Archive 2" → a confirmation, then `inbox.cleanup.archive`; the senders leave the list.
12. Select "Deals Daily" ("Looks like spam") and choose "Spam 1" → confirmation, then `inbox.moveMany` with `op: spam`; `batchId` is returned.
13. Scroll to "History" → rows list the past actions (`inbox.actions.list`).
14. Tap the "Spam" history row → an alert with "Cancel" and "Undo".
15. Tap "Undo" → `inbox.actions.undo` returns `restored` and `failed` counts; the sender returns to the Inbox.
16. Tap "Forget" on a sender with "Learned Newsletters" → `inbox.cleanup.forget` clears the learned pile.
17. See a sender with "Skipping" and a "Stop" link → tap "Stop" to stop skipping the Inbox.
18. Go back to Inbox → the list reflects the changes after the next `inbox.list`.

### Variations
- A sender marked with "Gmail filter limit reached" or "Couldn't add Gmail filter": the row shows the message and the action is not applied for future mail.
- "Nothing to clean up" when the list is empty.
- "Retry" after "Could not load senders".

### Edge Cases
- `unknown` result on an unsubscribe email: never retried automatically; the row must not say "Done".
- Partial failure of a bulk action (`failed` list): only the failed senders stay selected with an error.
- More than 50 messages in one move (`MAX_BULK_ARCHIVE`): the client must batch.
- Account needs reconnect: bulk actions fail with `reconnect`.
- Mail writes off: every action returns `disabled` ("Changing mail is turned off.").

### Design gaps
- The whole Cleanup flow has no board (the discovery doc already flagged this).
- No planned entry point from the Inbox on the outer display. The strip has "Search mail", "Filter", "Compose" and "Ask Inbox agent"; no "More".
- "Skip inbox", "Not spam", "Trash", "Learned" and "Forget" have no explanation in the design and no named iOS control (action sheet versus menu).
- The history and Undo flow is only an alert in Expo; the planned native pattern is not defined.
- Whether Cleanup is inside the phase 6 scope (#418 "implied") should be confirmed.

---

## STORY-008: Mail writes are turned off, or the Gmail account needs reconnecting
**Type**: medium
**Topic**: Inbox triage and compose
**Persona**: Hannah Berg, operations manager at a company whose admin disabled mail writes
**Goal**: Try to archive and reply, understand why it fails, and still read mail.
**Preconditions**: The deployment has mail writes off (a self-hosted server). One account in `reconnectAccounts` after Google asked for a new permission.
**Device**: standard iPhone
**Ideal path**: 3 — try Archive, read the error, leave. (For reconnect, the path depends on an undesigned control.)
**Alternate paths**: Integrations (`PG-B-Integrations.dc.html`, "Continue in setup") to reconnect Gmail. The Expo app surfaces `reconnectAccounts` only through the alert text.
**Design source**: NO BOARD for writes-off or reconnect states in the Inbox. Error line "Could not load mail." only: `PG-A-Rules.dc.html` "Inbox". Integrations screen: `PG-B-Integrations.dc.html`.

### Steps
1. Open Inbox → mail loads normally (reads work) and the list shows rows.
2. Swipe left on a row past the threshold → Archive is attempted; the server answers "Changing mail is turned off." The row returns.
3. Open a message and tap "Reply" → the compose sheet opens and the prefill works, or the control is hidden. The client does not know the setting until a write fails (`compose` returns `disabled` on send).
4. Tap Send → result `disabled`: a message says that mail changes are off, and the typed text is kept.

### Variations
- Reconnect case: sync returns the account in `reconnectAccounts`; the list shows older mail and needs a "Reconnect" banner with a path to Integrations.
- `failedAccounts` but not reconnect: a sync problem with a retry; `rateLimitedAccounts` means wait.
- No account connected (`accounts` empty): Expo shows "Connect mail" and "No mail".

### Edge Cases
- A bulk action where some succeed and some fail with `reconnect`.
- Self-hosted older server returns 404 for `inbox.actions.list` or `moveMany`: the client treats it as not supported and hides the feature.
- Mail writes off while a draft exists: the draft is kept on the device.

### Design gaps
- No banner or inline state for writes off, reconnect, rate limited, or "No mail account connected" (the board's empty state is "Inbox zero" and covers only a synced, empty Inbox).
- The client cannot learn "writes off" before the first failed write; whether a capability flag exists is not stated.
- "Inbox zero" with the last sync time versus never synced (`syncedAt` null) is not distinguished.

---

## STORY-009: A full triage session on the inner display, from list to reply and back
**Type**: long
**Topic**: Inbox triage and compose
**Persona**: Kenji Watanabe, founder who works mostly on an iPhone Duo opened as a book
**Goal**: Work through Needs reply, archive noise, reply to two messages, delegate one to the agent, and finish at Inbox zero.
**Preconditions**: Gmail connected, mail writes on, triage on. 3 "Needs reply" rows and 24 other messages today.
**Device**: inner flat (890x626 pt, 1/3 sidebar + 2/3 detail, side bar on the right edge)
**Ideal path**: 24 — one tap per list selection plus one tap per action; the steps below are the full session, not a shortcut.
**Alternate paths**: Half-folded 1/2 + 1/2 with the same content. Keyboard shortcuts are not planned. The Inbox agent thread can occupy the detail pane beside the list ("Left: list. Right: selected message or Inbox agent thread").
**Design source**: `Inner.dc.html` (inbox beside the Inbox agent thread), `Split.dc.html` (side strip: "Hide amounts", "Important only", "Filter", "Compose", "Ask Inbox agent"), rule cards "Inbox" and "Inbox message" in `PG-A-Rules.dc.html`. Reply composer in the detail pane: NO BOARD.

### Steps
1. Open the app on the inner display → Home shows Personnel with the Inbox row pinned in the third and Activity plus the last thread on the right.
2. Tap the Inbox row ("Inbox", count 42) → the third shows folders and sections, and the detail shows the message list (rule card). Which folders exist is not stated.
3. Tap the first row "Ana Ruiz, Re: Pilot timeline" → the list becomes the sidebar and the message opens in the detail pane; the row shows the selected fill.
4. Read the body → it renders in the web view in the detail pane; the fold zone x 435 to 455 stays empty.
5. Tap "Reply" → a composer opens under the message (half-folded) or as a sheet in the detail pane (flat), prefilled.
6. Type the reply and tap Send → result `sent`; the pane returns to the message.
7. Tap "Archive" in the strip → the message archives and the next row is selected (the rule is not stated; the list keeps the order).
8. Tap the second row "Jordan Lee, Intro: design partner" → the message opens.
9. Tap "Ask Inbox agent" → the detail pane switches to the Inbox agent thread with this conversation as context (`inbox.askAgent`).
10. Send "Reply yes and suggest Tuesday" → the thread shows "Inbox agent is working" with the stop control; the agent returns a draft with an approval card.
11. Tap "view draft", then "Send" on the card → the mail sends (Approvals topic); the card shows outcome `sent`.
12. Tap the list's third row "Northwind Support, Your ticket was updated" → the message opens.
13. Tap "Archive" → archived; "Needs reply" count goes from 3 to 0 and the header hides or shows 0.
14. Tap "Filter" in the strip → a popover opens under the Filter button in the trailing pane, no scrim ("Show in inbox": "Needs reply", "Newsletters", "Read mail").
15. Turn off "Read mail" → read mail leaves the list.
16. Tap "Important only" → only important rows remain (what this setting does is not specified).
17. Tap "Acme Payroll, Payment could not be scheduled" (label "Needs attention") → the message opens in the detail pane.
18. Read it and tap "Ask Inbox agent" → the agent thread opens.
19. Tap "Compose" → a new blank compose opens (new mail, no `replyToMessageId`).
20. Type a recipient, subject and body for the payroll provider → fields hold the text.
21. Tap Send → `sent`.
22. Swipe the remaining newsletters left past the threshold, one after another → each commits Archive. Three rows go.
23. Pull to refresh → `inbox.refresh`; no new mail.
24. The list is empty → the page shows "Inbox zero" with the last sync time.

### Variations
- Half-folded (1/2 + 1/2): left list, right message; Reply opens the composer under the message.
- Posture change mid-compose (unfold, fold): the typed text and selected message must survive.
- Hide a pane: the list can collapse the sidebar to a single column (not stated).

### Edge Cases
- Archive of the open message when it is the last row: the detail pane must show an empty state. Not drawn.
- The message arrives for the open thread during reading (`later` array): no live update is described.
- Inbox agent thread already shown in the detail pane and a message selected: which one wins is not specified.
- Sheets must not cross the fold (rule); a compose sheet in the detail pane must stay in x 455 to 890.
- A Send in progress when the user switches to another message: the compose state must not be lost or sent twice.

### Design gaps
- No board for the compose or reply surface on either posture.
- "Important only" appears only in `Split.dc.html` and is not mentioned in rule cards.
- The folders list in the 1/3 sidebar is named but not drawn; sections (Needs reply, Other mail today) are drawn.
- Selection behavior after Archive (next, previous, none) is not defined.
- "Inbox zero" empty state in the two-pane layout is not drawn (what the detail shows).
- Where "Cleanup", "Star" and "Mute" live in the two-pane layout is not defined.

---

## STORY-010: Compose a new message from scratch
**Type**: short
**Topic**: Inbox triage and compose
**Persona**: Elena Rossi, founder of a climate startup
**Goal**: Send a short intro email to a new advisor.
**Preconditions**: Two Gmail accounts connected. Mail writes on.
**Device**: iPhone Duo outer (466x678 pt)
**Ideal path**: 4 — tap "Compose", fill To, Subject and body, tap Send.
**Alternate paths**: Ask the Inbox agent "email sam@example.com about an intro" (mail approval card). A bot's own thread can draft mail.
**Design source**: "Compose" button: `Sheet.dc.html`. Compose sheet itself: NO BOARD.

### Steps
1. In Inbox, tap "Compose" in the strip group → a compose sheet opens in the content area beside the strip (sheets stay in the content area on the outer display). The From line defaults to one account; no `prefill` call is needed for a blank message.
2. Enter `sam@example.com` in To, "Intro" in Subject, and a short message in the body → the fields hold text and a `clientId` is created.
3. Tap the From line and choose the second account → `connectionId` changes.
4. Tap Send → `inbox.compose.send` with no `replyToMessageId`; result `sent`, the sheet closes.

### Variations
- Close with Cancel while there is text: choose to save as draft (`draftSave`, result `saved`) or discard.
- Keyboard rises from the bottom; on a short height (466x420) the body field scrolls.

### Edge Cases
- Invalid address: the API accepts text; validation and error copy are not defined.
- Subject empty: Gmail sends without a subject; whether the app warns is not defined.
- Body over 150,000 characters (`MAX_COMPOSE_BODY`).
- Saved drafts are not listed anywhere in the planned app (no Drafts view).

### Design gaps
- No compose sheet board; no way to open saved drafts (`draftSave` has no list procedure in `rpc.ts`).
- No contact autocomplete.
- No guidance for choosing the From account when several accounts exist.

---

## STORY-011: First open with no mail account, then the first sync
**Type**: short
**Topic**: Inbox triage and compose
**Persona**: Owen Fitzgerald, new user who has not connected Gmail
**Goal**: Reach a usable Inbox.
**Preconditions**: Signed in, no mail account connected, no Inbox agent yet.
**Device**: standard iPhone
**Ideal path**: 4 — open Inbox, connect mail, return, wait for the first sync.
**Alternate paths**: Connect Gmail from Settings > Integrations before opening the Inbox. Ask the Inbox agent to connect (Expo disables agent search until an account exists).
**Design source**: Connect mail state: NO BOARD. Integrations: `PG-B-Integrations.dc.html`. Empty "Inbox zero" and loading rows: `PG-A-Rules.dc.html` "Inbox".

### Steps
1. Tap the Inbox row on Home → Inbox opens; `inbox.list` returns `accounts: []`.
2. See the empty state → Expo shows "Connect mail" and "No mail". The board shows "Inbox zero" only for a synced inbox.
3. Tap "Connect mail" → the Integrations connect flow starts in `ASWebAuthenticationSession`; after approval the app returns and polls for the connection.
4. Return to the Inbox → placeholder rows show while the first sync runs (`triagePending` is true, so the client refetches a few times), then mail and sections appear.

### Variations
- Triage blocked: mail shows without "Needs reply", labels or to-dos, because `enabled` is false (`no_model` or `needs_consent`).
- Sync fails once: "Could not load mail." with retry.

### Edge Cases
- User cancels the Google sign-in: the Inbox returns to the empty state.
- Sync finishes with zero messages: "Inbox zero" with `syncedAt` null (the last sync time is unavailable).
- The user switches space: the Inbox is per space and user, so the empty state may return.

### Design gaps
- "Connect mail" empty state is not drawn; the "Inbox zero" text could mislead a user with no account.
- The first-sync loading state does not say that triage is still running.
- No board for triage blocked states, and the AI data consent prompt has no board.
