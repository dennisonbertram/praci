# Topic: act-on-email

Code refs: `apps/web/src/pages/Inbox.tsx`, `components/ComposeEmail.tsx`, `components/MailOutbox.tsx`, `lib/outbox.ts`, `components/EmailCards.tsx`, `components/inbox/InboxMessageDialog.tsx`, `components/AskCard.tsx`, `pages/Shell.tsx:3854-3900`.

Cross-cutting observations (apply to several stories):
- Reply/Reply all/Forward from the dialog open `<ComposeEmail seed=... accounts={[]}>` (`InboxMessageDialog.tsx:276`), so there is NO From picker on replies; the account comes from the prefill (`next.connectionId`). The picker shows only for New message with >1 account (`ComposeEmail.tsx` "From" NativeSelect).
- The Inbox compose button is icon-only, aria-label "Compose" (`Inbox.tsx:529-537`); keyboard `c` does the same.
- The agent can only DRAFT (`mail_draft`: "you cannot send mail", needs approval); the user must still open Gmail Drafts. There is no "open this draft in the composer" link in the web UI (observed gap).
- Same info on several surfaces: "Sending..." / "Sent" / "Undo" live in one global `MailOutbox` portal, regardless of origin (Inbox, dialog, chat email card).

## STORY-001: Quick reply to one email with keyboard only
**Type**: short
**Topic**: act-on-email
**Persona**: Marisol Vega, operations lead at a 12-person logistics startup, 140 unread, clearing a morning backlog
**Goal**: Answer a vendor's yes/no question with two lines and move on.
**Preconditions**: One Gmail account connected; message list loaded; no filter/search active.
**Ideal path**: 5 — j to select, Enter to open, r, type, Cmd/Ctrl+Enter.
**Alternate paths**: Click row, then "Reply" button in the dialog (`InboxMessageDialog.tsx:251`); from a chat email card, open card then same "Reply" button.
### Steps
1. Press `j` until the vendor row is highlighted (list keyboard, disabled while typing) → row gets selected styling.
2. Press `Enter` (or `o`) → message dialog opens, URL gets `?mail=<id>`.
3. Press `r` → composer dialog titled "Reply" opens; preview hides (`invisible`); quoted original is collapsed behind a "Show quoted text" toggle; focus lands at start of body (not To, because To is prefilled).
4. Type "Yes, Thursday works." → after 1.5 s of pause a small "Draft saved" notice appears (`AUTOSAVE_MS`).
5. Press Cmd/Ctrl+Enter → composer closes at once; bottom-center toast "Sending..." with an "Undo" button. After 5 s: "Sent" for 3 s, and the Inbox list reloads (`MAIL_SENT_EVENT`).
### Variations
- Marisol hesitates at step 3: she cannot see the quoted text and wonders if the thread is included. It is sent (comment in code: "hides its quoted original until asked; it is still sent"), but nothing says so besides the "Show quoted text" label.
- Pressing `Send` with the mouse instead: same hold. The Send button is the only confirmation; no "Are you sure".
### Edge Cases
- The dialog preview is hidden, not closed: after the composer closes the message dialog returns, so she must press Esc or `e` to get back to the list. She expects to land back on the list after sending (gap: no "send and archive / send and next").
- `r` works only inside the dialog; from the list it does nothing (help dialog does not say so).
- The "Draft saved" notice appears while she is typing and is visual only; it is not a status she checks, but it reassures her that closing is safe.

## STORY-002: Reply all to a team thread, then change her mind with Undo
**Type**: medium
**Topic**: act-on-email
**Persona**: Tomasz Kowal, project manager, replying to a 6-recipient scheduling thread
**Goal**: Reply all with a new time, but pull it back when he spots a mistake.
**Preconditions**: Open message has 5 To/Cc recipients.
**Ideal path**: 8 — open, `a`, edit, send, Undo, fix, send.
**Alternate paths**: "Reply all" button in the dialog; there is no way to switch Reply to Reply all inside the composer (observed gap: he must close and reopen).
### Steps
1. Open the thread's row with `Enter` → dialog shows "to ..." and "cc ..." on one truncated line each.
2. Press `a` → composer "Reply all" opens; To/Cc prefilled. With more than 3 recipients (`COLLAPSE_OVER = 3`) the rows fold into one summary line ("Ana, Priya, Sam +3 more") until he focuses it.
3. He clicks the summary → rows expand into chips (To, Cc fields).
4. Types "Moving to 3pm Friday." and presses `Send` → toast "Sending..." + "Undo".
5. Two seconds later he notices he wrote Friday, not Thursday. Clicks "Undo" in the toast → the composer reopens exactly as it was (`undoSend` -> `restoring`), including recipients, body, attachments.
6. He edits the text and presses `Send` again → new 5 s hold with a new send; the earlier held send never ran.
7. Wait → "Sent".
### Variations
- If he sends a second message while the first is still held, the first goes out immediately (`hold()` fires the previous one) - he loses its Undo window silently.
### Edge Cases
- Undo window is 5 s and the toast is at the bottom center; if he is looking at the composer area he may miss it.
- After the hold ends the "Sending..." toast has no Undo (`undoable: false`) while the request is in flight; no way to cancel.
- Info appears twice: recipient summary in the composer and "to/cc" in the dialog, but Bcc is never shown in the dialog.

## STORY-003: Forward an invoice with its attachment to the accountant
**Type**: medium
**Topic**: act-on-email
**Persona**: Hannah Berg, freelance designer, forwarding a client's invoice PDF to her bookkeeper
**Goal**: Forward the message including the original attachment and a one-line note.
**Preconditions**: Message has a 2.1 MB PDF attachment.
**Ideal path**: 6 — open, `f`, type recipient, note, Send, done.
**Alternate paths**: "Forward" button in the dialog; from a chat email card via the same dialog.
### Steps
1. Open the invoice row → dialog shows an attachment chip with filename and size.
2. Press `f` → composer "Forward" opens. Focus starts in To (not body). Original attachment appears as a chip in the "Attachments" region (`forwarded`), no upload needed.
3. Types "books@" and chooses/enters the address, presses Enter or comma → address becomes a chip.
4. Tab down → caret lands above the forwarded block; types "Please book against March."
5. Presses `Attach files` (paperclip) to add her own timesheet.xlsx → chip added, counted toward the 10 MB total with the forwarded file.
6. Presses `Send` → "Sending..." + "Undo", then "Sent".
### Variations
- If forwarded attachments exceed 10 MB: notice "Attachments can't be over 10 MB." (`attachmentsTooLarge`) at load time; she must remove the file with the chip's "Remove <filename>" button.
- Drag a file onto the composer: overlay "Drop files to attach".
### Edge Cases
- Hesitation: she wonders whether the original PDF really goes (server re-attaches it via `forwardOf`); the chip is the only proof.
- Autosave drafts do not include attachments (`ComposeEmail.tsx` comment), so if she presses Close with her own attached file she gets "Discard attachments?" with "Keep editing" / "Discard".
- No scheduling or "send later", which she would want for the bookkeeper's morning (observed gap).

## STORY-004: Compose from the second account (multi-account From)
**Type**: medium
**Topic**: act-on-email
**Persona**: Dev Anand, consultant with a personal Gmail and a "dev@anandlabs.example" work Gmail
**Goal**: Write a new message to a client from the work account while the Inbox shows All.
**Preconditions**: Two accounts connected; account tabs visible ("All", plus one per account).
**Ideal path**: 6 — click work tab, `c`, To, Subject, body, Send.
**Alternate paths**: Stay on "All", `c`, then change the "From" select. "Compose" icon button instead of `c`.
### Steps
1. On the "All" tab he presses `c` → composer "New message" opens; the From select defaults to the first account (`accounts[0]`) because `connectionId={tab}` is empty on All.
2. He reads the "From" row and sees the personal address preselected - the wrong one. Hesitates: the row labels match tab labels that truncate at 160 px.
3. He picks the work address in the "From" select (NativeSelect, aria-label "From").
4. Types the client address in To, "Subject" line, body.
5. Presses `Send`; toast "Sending..." and Undo.
6. After "Sent", he checks the list: nothing says which account sent it (no Sent view in the app; observed gap - "Check Sent" is advice but there is no Sent folder UI).
### Variations
- If he first clicks the work tab, From defaults to that account (`connectionId={tab}`) - discoverable only by accident.
- Single-account users never see the From row.
### Edge Cases
- Changing From after typing: autosave rewrites the draft; a draft was already saved under the first account (the payload carries `connectionId`), so a stale draft can remain in the old account's Drafts (unverified; flag for server check).
- Replies keep the original recipient account and cannot be switched (no picker, `accounts={[]}`).

## STORY-005: Send fails, outcome unknown, and she must not duplicate it
**Type**: medium
**Topic**: act-on-email
**Persona**: Grace Okafor, office manager, on hotel Wi-Fi, sending a payment confirmation
**Goal**: Be sure the confirmation went exactly once.
**Preconditions**: Flaky network or server returns `status: unknown`/`failed`.
**Ideal path**: 7 — send, read banner, check Gmail Sent elsewhere, then discard or resend.
**Alternate paths**: Gmail reconnect/disabled outcomes show different text; none offer a direct fix link.
### Steps
1. Grace composes the reply and presses `Send` → "Sending..." with Undo.
2. After 5 s the toast changes to "Sending..." without Undo; the request fails.
3. The composer reopens automatically (`restoring`) with a red notice: "Not sent. Couldn't send. Try again." (`notSent(problemText)`).
4. She presses `Send` again → same `clientId`, so the server keys it and never sends twice.
5. This time the server answers `unknown`: composer reopens with "Not confirmed as sent. Check Sent before trying again." (no "Not sent" prefix).
6. She switches to Gmail in another tab to check Sent (the app has no Sent view or link), finds it was sent.
7. She returns and presses Discard (trash icon, tooltip "Discard") → composer closes and "Draft discarded" + Undo appears for 5 s.
### Variations
- `reconnect`: "Gmail needs to be reconnected." Fix is in the Integrations overlay, but the composer has no link there.
- `disabled`: "Sending is turned off."
- Draft autosave failing shows "Couldn't save the draft" in the same notice slot.
### Edge Cases
- Closing the tab inside the 5 s hold sends nothing and loses the message (documented in `outbox.ts`); she may think "Sending..." means it is on its way.
- While sending the composer is locked (spinner on Send, `aria-busy`), and `close()` is ignored.
- Errors sit in the same place as "Draft saved", so a green/neutral reassurance and a red failure compete for attention.

## STORY-006: Close the composer mid-sentence and come back to the draft
**Type**: short
**Topic**: act-on-email
**Persona**: Luca Ferri, sales rep pulled into a call mid-reply
**Goal**: Leave a half-written reply and finish it later without losing text.
**Preconditions**: Reply composer open with three sentences typed.
**Ideal path**: 4 — close, reopen reply on same message, text is back.
**Alternate paths**: Discard (trash) and then Undo within 5 s to get it back.
### Steps
1. Types a paragraph; "Draft saved" appears after a pause.
2. Presses the X close (aria "Close") or Esc → no prompt (no attachments); the draft is remembered (`rememberClosed`) and the dialog closes.
3. Later, opens the same message and presses `r` → composer reopens with his text (`recallClosed(seed)`), caret restored.
4. Finishes, presses `Send`.
### Variations
- Presses Discard with text: composer closes and toast "Draft discarded" + "Undo"; after 5 s the Gmail draft is deleted.
- Attached a file: closing asks "Discard attachments?" - the choices are "Keep editing" and "Discard"; there is no "Save draft anyway" option, so he must choose between losing files and staying.
### Edge Cases
- Untouched reply: closing discards silently (nothing to keep).
- Draft memory is per message seed; there is no "Drafts" list in the web Inbox, so a user who forgot the message has no way to find the draft except Gmail Drafts (observed gap).
- Same draft exists on two surfaces: in-app memory and Gmail Drafts folder; edits made in Gmail are not reflected.

## STORY-007: Ask the Inbox agent to find urgent mail and show cards
**Type**: medium
**Topic**: act-on-email
**Persona**: Priya Natarajan, finance director with 300+ unread after vacation
**Goal**: Let the agent surface what needs an answer today, then reply to the top one.
**Preconditions**: Inbox agent created; panel expanded.
**Ideal path**: 7 — type request, read cards, open top card, `r`, write, Send.
**Alternate paths**: Collapse the panel and use "Needs reply" group in the list; scan the Today group; use search.
### Steps
1. On `/app/inbox` she sees the right panel `data-testid="inbox-agent-panel"`. First time: a single "Create Inbox agent" button (error text if it fails: "Could not create the Inbox agent"). She clicks it.
2. Types in the chat: "What needs my reply today?" and sends.
3. The agent calls `mail_search`/`mail_grep`/`show_emails`; chat shows email cards grouped under "Today", "Within 3 days", "This week", "Later" (`EmailCards.tsx`). Each card: sender, relative time, subject, 2-line snippet, optional paperclip with count (aria "Attachments: N"). "Later" renders as a compact list.
4. She clicks the top card → the same message dialog opens (no Archive / Mark read: chat cards omit them).
5. Prev/next chevrons walk the cards in on-screen order (`ordered`).
6. Presses `r`, writes, `Send`.
7. After "Sent" she returns to the chat; the card still shows no replied/done state (observed gap).
### Variations
- Panel collapsed: "Show Inbox agent" icon button in the header; on phones it starts collapsed. She may not notice the panel because the icon has no text.
- Compare to the list's "Needs reply" group - same triage output but different surfaces; the agent grouping is by urgency, the list's by reply need.
### Edge Cases
- Cards cap at 20 per message (`contracts/events.ts:95`); older/extra mail requires another prompt.
- Mail text is plain text only in cards (untrusted).
- Replies sent from a chat card trigger `MAIL_SENT_EVENT`, which reloads the Inbox list behind the panel - the list can silently re-sort.

## STORY-008: Have the agent draft a reply and approve the action
**Type**: long
**Topic**: act-on-email
**Persona**: Jonas Lindqvist, founder who delegates routine answers; hates typing on his phone
**Goal**: Get a polite decline drafted, review it, and actually send it.
**Preconditions**: Inbox agent exists; approval rule "Ask before email actions" is in effect (default).
**Ideal path**: 14 — ask, approve, find draft, send (no in-app handoff makes this long).
**Alternate paths**: Write the reply himself (STORY-001); set "Allow email actions without asking" in settings to skip approvals.
### Steps
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
### Variations
- Deny: agent has to answer without the draft; no retry button.
- Settings (`ApprovalRulesSettings.tsx`): rules shown as "Ask before email actions" or "Allow email actions without asking" - the place to undo an "Always allow".
- After an approval card is answered it is "No longer active" if stale (`AskCard.tsx:133`).
### Edge Cases
- The agent cannot send; Jonas expects it can ("do it for me") and has to learn that from the agent's reply.
- Multi-account: `mail_draft` requires `account` address when more than one account; the agent must ask which.
- The agent writes plain text only; formatting is lost vs the rich composer.
- This is the longest path to the same goal "reply fast"; the manual Reply path (5 steps) beats it unless the answer needs thought.

## STORY-009: Burn down the "Needs reply" group, mixing replies, undo and a to-do
**Type**: long
**Topic**: act-on-email
**Persona**: Aisha Rahman, customer success manager clearing 18 "Needs reply" threads before a 10 am meeting
**Goal**: Reply to the six that matter, archive the rest, tick the follow-up task.
**Preconditions**: Triage on and consented; two accounts (support@ and personal); "All" tab; the To do card shows 3 items.
**Ideal path**: 30 — roughly 5 steps per reply for 4 replies plus archive/skip cycle.
**Alternate paths**: Agent panel: "Show me urgent mail" then act via cards (STORY-007); filter chips are not helpful for this.
### Steps
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
### Variations
- On mobile width: hover actions replaced by a "More" menu; reply/forward still via dialog buttons ("Reply", "Reply all", "Forward") without the keys.
- If a filter is active, `e` does nothing and the Needs reply group disappears.
### Edge Cases
- Interrupted (call): she closes a half-written reply; it is remembered (STORY-006).
- Tab closed during hold: the last send is lost with no warning.
- Sending to a recipient with a typo: "Fix or remove the highlighted addresses." blocks Send.
- The same state ("Sent") appears only as a 3 s toast; there is no persistent sent log in the app.

## STORY-010: Fix a bad recipient and a too-large attachment before sending
**Type**: short
**Topic**: act-on-email
**Persona**: Kenji Watanabe, procurement analyst, rushing a quote to two suppliers
**Goal**: Get a valid send out with a large file.
**Preconditions**: New message composer open.
**Ideal path**: 6 — fix address, shrink attachment, send.
**Alternate paths**: none found for compressing; the app offers no link-sharing alternative (observed gap).
### Steps
1. Types "sales@acme" in To and presses `Send` → red notice "Add a recipient." if empty, or a message naming the invalid address (one) / "Fix or remove the highlighted addresses." (several); invalid chips are highlighted.
2. Fixes the address chip.
3. Clicks `Attach files` and picks a 12 MB deck → notice "Attachments can't be over 10 MB." (10 MB total, max 20 files); file not added.
4. Picks a 6 MB version → chip with filename; "Remove <filename>" X on the chip.
5. Presses `Send` → "Sending..." + Undo, then "Sent".
### Variations
- Drag-and-drop shows "Drop files to attach".
### Edge Cases
- The 10 MB limit is lower than Gmail's 25 MB; he may think the app is broken. The notice does not state the sum so far.
- Cc and Bcc rows are hidden until their "Cc" / "Bcc" reveal links are clicked.
