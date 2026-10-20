# Topic: mail-attachments-ask-agent-auto-file

Source files read: `apps/web/src/components/inbox/MailAttachments.tsx`, `InboxMessageDialog.tsx`, `apps/web/src/components/MailThreadCard.tsx`, `apps/web/src/pages/ModelSettingsOverlay.tsx` (`AutoFileEmailField`), `apps/web/src/pages/Shell.tsx` (`onOpenAgent`), `apps/api/src/inbox-attachment.ts`, `inbox-thread-agent.ts`, `packages/adapters/src/mail-attachment-filing.ts`, `packages/core/src/attachments.ts`, commits 3ae235b67 and 1794d55be.

Facts that apply to several stories:
- Attachments appear as chips under the email body (list labelled "Attachments"). Each chip shows a type icon (or a small thumbnail for images up to 512 KB), the filename and the size. A separate "More actions for {filename}" button (three dots) opens a menu with "Download" and "Add to Data room".
- Previews open for image, PDF, spreadsheet, HTML, Markdown and plain text, only up to 10 MB. Larger files say "Too large to preview". Other types say "Preview isn't available for this file type — download it to view it."
- Automatic filing queues only mail stored for the first time that arrived within the last 2 days, at most 20 messages per sync. It files PDF, Word, Excel, CSV, PowerPoint and zip files of at least 10 KB that are not inline. It skips spam, newsletters pile, bulk, promotional/social/forum mail, anything with a List-Unsubscribe header and no-reply senders. Mail the owner sent to others is included; mail sent only to themselves is skipped.
- The setting "Add email attachments to the Data room" is on by default (no stored row means on).

## STORY-INB-015: Preview a PDF attachment from an email, then download it (folded into the existing story of this id, updated 2026-10-20)
**Type**: short
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Read a supplier quote that arrived as a PDF without leaving the Inbox, then keep a copy on her laptop.
**Preconditions**: Gmail connected. Inbox contains "Quote NR-2041" from `sales@vendor.example.test` with `quote-nr-2041.pdf` (180 KB) attached.
**Ideal path**: 3 — click the chip, read, click Download.
**Alternate paths**: Chip three-dot menu then "Download" (skips the preview and shows "Downloaded quote-nr-2041.pdf" under the chips).
### Steps
1. In Inbox, click the "Quote NR-2041" row → the email dialog opens; below the body is an "Attachments" list with a chip `quote-nr-2041.pdf 180 KB` (exact size text from `formatBytes`, UNVERIFIED format).
2. Click the chip → a large preview dialog opens titled with the filename; a grey pulsing block shows while the file loads, then the PDF renders. Maya thinks: "Good, it did not mark anything or leave the app." The fetch does not mark the message read (code comment says nothing is marked read).
3. Click "Download" in the preview toolbar → the browser saves `quote-nr-2041.pdf`. In the preview dialog no confirmation text is shown (the status line is in the email dialog behind).
4. Press Escape → returns to the email; the line under the chips reads "Downloaded quote-nr-2041.pdf".
### Variations
- Narrow phone-width window: the buttons show only icons ("Download", "Add to Data room" are still the accessible names).
- Maya uses the three-dot menu instead and never sees the preview.
### Edge Cases
- Hesitation: the "Downloaded" line appears only after closing the preview, so she may wonder if the click worked. UNVERIFIED whether the browser's own download bar covers this.
- If the download fails the line reads "Couldn't download quote-nr-2041.pdf" in red with an alert role.

## STORY-INB-111: Step through several attachments with the arrows and keyboard
**Type**: short
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Review three attachments (invoice PDF, cost spreadsheet, site photo) of one email in a row.
**Preconditions**: Email "Pilot order paperwork" from `ops@customer.example.test` has `invoice.pdf`, `costs.xlsx`, `site.jpg` (90 KB).
**Ideal path**: 4 — open the first chip, press the right arrow twice, Escape.
**Alternate paths**: "Next attachment" and "Previous attachment" buttons in the preview toolbar do the same as ArrowRight/ArrowLeft.
### Steps
1. Click the `invoice.pdf` chip → preview opens on index 0; "Previous attachment" is disabled.
2. Press ArrowRight → `costs.xlsx` loads in the spreadsheet preview (rendered by the server-backed sheet viewer).
3. Press ArrowRight → `site.jpg` shows as an image. "Next attachment" is now disabled.
4. Press the letter `e` or `r` → nothing happens: the preview stops key events so the email's Archive and Reply shortcuts do not fire.
5. Press Escape → back to the email, still open.
### Variations
- The image chip shows a 20 px thumbnail instead of a generic icon because the file is under 512 KB.
- Large photo (over 10 MB): preview says "Too large to preview" but Download still works.
### Edge Cases
- A `.docx` in the set shows "Preview isn't available for this file type — download it to view it."
- With "hide amounts" turned on, PDF, image, HTML and sheet previews show "Hidden while amounts are hidden"; text and Markdown still show. Maya may think the file is broken.

## STORY-INB-016: File one attachment to the Data room by hand and see "Added" (replaces the earlier story of this id, updated 2026-10-20)
**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Keep the signed NDA from an email in the Data room so her agents can find it, then confirm it is there.
**Preconditions**: Auto-filing is turned off (see STORY-INB-114) or the mail is older than 2 days. Email "Signed NDA" from `legal@partner.example.test` with `nda-signed.pdf` (240 KB).
**Ideal path**: 3 — open the email, open the chip menu, click "Add to Data room".
**Alternate paths**: Preview toolbar button "Add to Data room"; the Data room page's Import menu → Email (covered by the data-room topic, not repeated here); an agent calling `add_to_data_room`.
### Steps
1. Open the "Signed NDA" email → chips shown.
2. Click the three-dot button "More actions for nda-signed.pdf" → menu with "Download" and "Add to Data room".
3. Click "Add to Data room" → the item is disabled while it files; then the menu item reads "Added" and is disabled. The Data room's import-progress watcher is told an import started.
4. Click the chip to preview → toolbar button also reads "Added" (disabled), matching the menu. Same state on two surfaces.
5. Open Data room in the sidebar → the file `nda-signed.pdf` is present; it may show processing first (see the Data room uploads topic).
### Variations
- Close the email and reopen it later: the page asks the server which attachments of this message are already imported (`emailImported`), so the buttons still read "Added".
- File a second attachment of the same email: each is tracked separately.
### Edge Cases
- Double-click: only one request is sent because the id is recorded synchronously.
- Same file previously filed (for example by auto-filing): the server reports a duplicate and the button still goes to "Added" because imported + duplicates is not zero.
- Failure (for example a Data room error): the button returns to "Add to Data room" and a red alert line shows under the chips, with the error text from the server. Which folder the file lands in is UNVERIFIED from this code.

## STORY-INB-112: Ask agent about an email thread for the first time
**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Get a summary of a long thread with a contract manufacturer and a draft reply.
**Preconditions**: Gmail connected, inbox page open. Thread "Re: Fwd: Pilot build schedule" with 6 messages from `priya@factory.example.test`. Mail AI data sharing already allowed for the model.
**Ideal path**: 4 — open the email, click "Ask agent", type the question, send.
**Alternate paths**: Mobile message screen has the same action in its header (UNVERIFIED label). Ask the Inbox agent instead (less focused; no thread seeded).
### Steps
1. Open the thread's newest message → toolbar shows "Reply", "Reply all", "Forward", "Archive", "Mark read"/"Mark unread" and "Ask agent" (Bot icon).
2. Click "Ask agent" → the button disables while the agent is created, then the dialog closes into a new chat. The agent is named from the subject with "Re:" and "Fwd:" removed: "Pilot build schedule". Composer is focused.
3. Look at the transcript → the first item is a collapsed card "Email thread · 6 messages". Maya thinks: "Is it going to read all this without asking me?" Nothing has run yet.
4. Click the card → it expands to the messages (sender, date, text, and a paperclip line with attachment filenames).
5. Type "Summarize where the schedule stands and draft a reply asking for a revised date" and send → the agent answers from the thread. The agent can only draft: a reply uses `mail_send` and shows an approval card to approve, edit or discard.
6. The sidebar lists the new agent; it notifies on finish.
### Variations
- Thread longer than 30 messages: only the newest 30 are seeded (older ones are readable by the agent through `mail_get`).
- A message that fails to load from Gmail falls back to its cached preview, unless it is the one Maya opened, which must load or the click shows an error.
### Edge Cases
- Attachments appear as filenames only; the agent does not receive their content. UNVERIFIED whether it can open them with other tools.
- The agent cannot archive or change mail (stated in its instructions).

## STORY-INB-113: Ask agent when mail AI data sharing is not yet allowed
**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Find out why the thread agent says it cannot see the email, and fix it.
**Preconditions**: New account; mail AI data sharing for the chosen model not allowed yet. Email "Term sheet draft" from `partner@fund.example.test`.
**Ideal path**: 5 — Ask agent, send, see consent card, Allow, resend.
**Alternate paths**: AI data sharing switches in account Settings (covered by the account-data topic).
### Steps
1. Open the email, click "Ask agent" → new chat "Term sheet draft" with collapsed "Email thread · 3 messages" card.
2. Maya sends "What are the key terms?" → the agent's history holds only a placeholder instead of the thread (text says the thread is not shared yet and to allow AI data sharing in Settings). The agent tells her to allow it and does not ask her to paste the email.
3. When the agent tries to read mail, the existing consent card appears with "Allow" and "Not now" (exact wording from the AskCard topic). She hesitates: "I only wanted this one email."
4. Click "Allow" → the thread now reaches the model on the next run.
5. Send the question again → the agent answers using the thread.
### Variations
- "Not now" → the agent keeps the placeholder; denying does not loop.
- Mail consent is per model, and the thread agent runs on the Inbox agent's model override if one exists, so allowing it on the Inbox card already covers this chat.
### Edge Cases
- The seeded card in the transcript is visible to Maya even though the model has not seen it. Same information in two states, which can confuse. UNVERIFIED whether any extra UI explains this.

## STORY-INB-114: Turn automatic filing off and on in Model settings
**Type**: short
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Solo technical founder who keeps client contracts out of shared storage
**Goal**: Stop new attachments from being filed without asking.
**Preconditions**: Signed in; never touched the setting (so it is on).
**Ideal path**: 3 — open Model settings, clear the checkbox, check the result.
**Alternate paths**: none found (no setting on the Data room page itself in the code read).
### Steps
1. Open the Model settings overlay → near the top, under the model row and the "Data room search model" disclosure, a checkbox "Add email attachments to the Data room" is checked. It is disabled for a moment until the saved value loads.
2. Clear the checkbox → saved immediately on change; no Save button, no toast.
3. Close and reopen the overlay → checkbox is still cleared.
4. Check it again → saved the same way.
### Variations
- A new account with no stored row sees it checked (default on).
### Edge Cases
- Save fails: red alert "Could not save the setting" (or the server's message) appears below, and the checkbox keeps the old value. UNVERIFIED because `setEnabled` only runs after success.
- Turning it on later does not file mail already in the cache (code comment).
- The setting is per member, not per workspace.

## STORY-INB-115: An invoice arrives and lands in the Data room automatically
**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: See that a customer's purchase order filed itself without a click.
**Preconditions**: Setting on. Gmail synced. A new email from `buyer@customer.example.test` arrives with `PO-8812.pdf` (95 KB), no unsubscribe header.
**Ideal path**: 3 — wait for sync, open the email, see "Added".
**Alternate paths**: Open the Data room and look for the file.
### Steps
1. The mail sync stores the new message; because it is new and recent, a `mail.attachments` job is queued.
2. Maya opens the email from the Inbox → chip `PO-8812.pdf` appears. Opening the chip menu shows "Added" (disabled) rather than "Add to Data room", because the dialog asks the server which files are already imported.
3. Click the chip, then the preview toolbar → "Added" there too.
4. Open Data room → the file is listed, going through the normal processing steps. She thinks: "I never asked for that. Where do I turn it off?" (see STORY-INB-114). Which folder it lands in is UNVERIFIED.
### Variations
- The email is from yourself to a client with an attached Excel file: filed too, since mail the owner sent to others counts.
- Zip attachments are filed and then unpacked by the zip import.
### Edge Cases
- No consent is needed for storing the file; sending content to a model still needs consent.
- Race: if Maya opens the email within seconds, the chip may still say "Add to Data room". Clicking it is safe: the server reports a duplicate and the button goes to "Added".

## STORY-INB-116: Mail that does not get auto-filed
**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Solo technical founder
**Goal**: Understand why a few attachments never reached the Data room.
**Preconditions**: Setting on. Inbox holds (a) newsletter PDF from `news@digest.example.test` with unsubscribe link, (b) `logo.png` 4 KB in a signature, (c) `.docx` from `noreply@billing.example.test`, (d) a 4-day-old email with `contract.pdf` that arrived during first sync.
**Ideal path**: 4 — inspect each email's chips and menus.
**Alternate paths**: Add each wanted file by hand (STORY-INB-016).
### Steps
1. Open (a) → chip is present; menu shows "Add to Data room" (not "Added") because bulk and List-Unsubscribe mail is skipped.
2. Open (b) → image inline in signature is not a chip as an attachment, or if it is, it shows "Add to Data room" because it is under 10 KB and not a document type.
3. Open (c) → no-reply senders are skipped; "Add to Data room" is still available.
4. Open (d) → older than 2 days at sync time; not filed.
5. Click "Add to Data room" on (d) → "Added".
### Variations
- A PDF sent by an unusual client labelled `application/octet-stream` is still filed when its extension is pdf, doc, docx, xls, xlsx, csv, pptx or zip.
### Edge Cases
- There is no visible reason on screen for a skipped file. Maya must infer it. The manual button is the only recovery.
- Manual add accepts files the auto rules skip, but the Data room may still refuse non-documents. UNVERIFIED which messages appear for a refused type.

## STORY-INB-117: Reopen the same thread agent and handle an unsent reply and a missing email
**Type**: medium
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Come back to the same thread agent the next day, and see how the dialog behaves when the email has gone.
**Preconditions**: STORY-INB-112 completed. Maya started a reply earlier and closed the composer without sending.
**Ideal path**: 4 — open the email, read the banner, click "Ask agent" again.
**Alternate paths**: Find the agent in the sidebar by its name.
### Steps
1. Open the same email → toolbar appears; below it a status line "You have an unsent reply to this email." with a "Continue draft" link.
2. Click "Continue draft" → the composer opens (the email dialog hides behind it) with the saved reply.
3. Close the composer → the banner returns, because the draft is kept.
4. Click "Ask agent" → no new agent: the same chat opens (one agent per account and thread), with the earlier conversation. Maya thinks: "Good, it didn't start over." A newer message in the thread is not added to the seeded card. UNVERIFIED whether the card refreshes.
5. Later, delete the email in Gmail and open a stale link to it → the dialog title is "Email not found", with "This email isn't in your mail any more. It may have been deleted or moved." and a "Back to Inbox" button.
### Variations
- While loading, the dialog shows the sender, date and snippet from the list row, a skeleton toolbar and a white skeleton body.
- Load error shows red text and "Try again" instead.
### Edge Cases
- If Ask agent fails (Gmail error on the opened message), a red alert line appears under the toolbar and the button re-enables.
- Archived agents are ignored and a new one is created. UNVERIFIED in the UI.

## STORY-INB-118: From a vendor email to a filed document and an agent answer
**Type**: long
**Topic**: mail-attachments-ask-agent-auto-file
**Persona**: Maya, first-time founder of Northwind Robotics, new to Praci
**Goal**: Receive a contract revision, check it, file it, and have an agent compare it with what she asked for, end to end.
**Preconditions**: Gmail connected; Model settings reachable; auto-filing off (she turned it off in STORY-INB-114); mail AI data sharing not yet allowed; email "Supply agreement v3" from `priya@factory.example.test` with `supply-agreement-v3.pdf` (1.2 MB) and `pricing.xlsx` (60 KB); thread has 4 earlier messages.
**Ideal path**: 12 — open email, preview both, file the PDF, ask agent, allow sharing, ask question, read result, check Data room.
**Alternate paths**: Skip the manual filing and let auto-filing do it (setting on); ask the Inbox agent instead of a thread agent.
### Steps
1. Sidebar → Inbox; click the "Supply agreement v3" row → dialog opens with the loading skeleton, then the body; the thread above shows "4 earlier messages" as a collapsed list.
2. Click one earlier row in the thread list ("You" rows have a Sent mark) → its text expands under the row.
3. Scroll to the attachment chips; click `supply-agreement-v3.pdf` → PDF preview.
4. Press ArrowRight → `pricing.xlsx` shows in the sheet viewer with tabs.
5. Press ArrowLeft, then click "Add to Data room" in the toolbar → button disables, then reads "Added".
6. Escape back to the email. Maya thinks: "Do I also want the spreadsheet in there?" Opens the three-dot menu for `pricing.xlsx` → "Add to Data room" → "Added".
7. Click "Ask agent" → chat "Supply agreement v3" opens; the card "Email thread · 5 messages" is collapsed.
8. Send "Did Priya change the payment terms from v2?" → the agent replies it cannot see the thread because AI data sharing is not allowed for mail, and points at Settings.
9. The consent card appears when it reads mail; click "Allow".
10. Send the question again → the agent summarizes the changes, naming the attachment files from the thread card (names only).
11. Ask "Draft a reply asking for net 45" → a reply approval card appears; Maya edits and approves, or discards. Nothing is sent without her.
12. Open Data room in the sidebar → both files are present. Optionally use the Data room agent ("Ask", covered in the Data room topics) to ask about the PDF contents, which the thread agent could not read.
### Variations
- With auto-filing on, step 5 and 6 are unnecessary and both buttons already read "Added" on opening.
- On phone: the same actions are on the mobile message screen (UNVERIFIED layout).
### Edge Cases
- Two surfaces say the same thing: "Added" in the chip menu and in the preview toolbar; the filename list in the thread card and the chips.
- Hesitation points: whether Ask agent reads attachments (it does not, by name only), whether Allow covers all mail (it is per model), and whether the filed document is searchable yet (processing may still be running).
- If the email is deleted mid-journey, step 7 returns an error line under the toolbar.
