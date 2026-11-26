# Topic: Compose and drafts

Status: written from the SwiftUI code in `apps/ios/Sources/Praci/Inbox/Compose/` (`ComposeSheet.swift`, `ComposeModel.swift`, `ComposeClient.swift`), the entry point in `Inbox/InboxMessageScreen.swift`, address parsing in `Packages/RakazoAPI/.../Models/Mail.swift` (`MailAddresses`) and `Tests/PraciTests/MailComposeTests.swift`. Nothing was run on a device or simulator; "the code does X" is not "observed". This replaces the earlier planning-only version of the file; stories about the Inbox list and reading mail live in `inbox.md`.

Facts that apply to several stories:

- The sheet is titled "New message", "Reply" (also for Reply all) or "Forward". Toolbar: "Cancel" (left) and a paper-plane "Send" (right, replaced by a spinner while sending).
- Fields: From (a picker only when more than one account is loaded, otherwise a read-only row), To, a "Cc, Bcc" button that reveals Cc and Bcc, Subject, a body text editor. Attachments appear as a list section only when the prefill has some.
- Reply, Reply all and Forward are reachable only from the "Reply" menu in the message toolbar. Reply all appears only when the server says the recipients differ (`replyAllDiffers`).
- Code gaps found while reading (see "Gaps in the code" at the end): no entry point for a new message, no way to add an attachment, no list of saved drafts.
- A "Sent" glass pill shows at the bottom of the message screen for 3 seconds after a successful send. There is no Undo for a send.

## STORY-001: Reply to a customer and send
**Type**: short
**Topic**: Compose and drafts
**Persona**: Maya Okafor, solo founder of a 4-person logistics startup
**Goal**: Answer Ana Ruiz's question about the pilot start date in one line.
**Preconditions**: One Gmail account connected with mail writes on. "Re: Pilot timeline" from ana.ruiz@example.test is open in the message screen.
**Ideal path**: 3 — open the reply, type the answer, tap Send (recipient, subject and quote are already filled).
**Alternate paths**: "Ask Inbox agent" on the same screen asks the agent to draft a reply instead (different feature, `inbox.agent`). No swipe or row-menu reply exists on the Inbox list in the code.

### Steps
1. Tap the "Reply" button (arrow icon) in the message toolbar → a menu opens with "Reply" and "Forward" ("Reply all" only if recipients differ).
2. Tap "Reply" → the "Reply" sheet opens with a spinner while the prefill loads, then the form: From shows ana.ruiz's thread account, To holds "Ana Ruiz <ana.ruiz@example.test>", Subject "Re: Pilot timeline", and the body holds the quoted earlier message.
3. Tap the body, type "Yes, we can start on Nov 4. I'll send the checklist today." → the Send button is enabled because To has one valid address.
4. Tap "Send" → the keyboard closes, the toolbar shows a spinner, the sheet closes on success, and the message screen shows a "Sent" pill for about 3 seconds.

### Variations
- Reply all: the menu shows "Reply all" when `replyAllDiffers`; the sheet title is still "Reply", Cc is pre-filled and the "Cc, Bcc" button is replaced by open Cc and Bcc fields.
- Several accounts: From becomes a Picker. In reply modes the prefill returns one account, so the picker never offers a second one in practice (`accounts = prefill.account.map { [$0] }`).

### Edge Cases
- Send is disabled until To has at least one address and no field has an invalid one.
- The app sends one `clientId` per sheet; sending twice with the same id is treated by the server as the same message.

---

## STORY-002: Fix a mistyped recipient before sending
**Type**: short
**Topic**: Compose and drafts
**Persona**: Tomas Brandt, operations lead at a 12-person fintech
**Goal**: Forward-reply to two people and catch a typo in one address.
**Preconditions**: A reply sheet is open with To "ana.ruiz@example.test".
**Ideal path**: 3 — type the second address, see the inline error, correct it.
**Alternate paths**: none found. There is no contact suggestion list in the compose sheet.

### Steps
1. Tap the end of the To field and type ", li.wen@example" → the field keeps the text; under it appears "Not a valid address" in the destructive color, and Send turns disabled.
2. Add ".test" → the error disappears and Send enables. Commas and semicolons both separate addresses; "Name <a@x.test>" is accepted.

### Variations
- Tap "Cc, Bcc" → Cc and Bcc rows appear and Cc takes focus. The same inline check applies to each.
- A name containing a comma works only when quoted ("Okafor, Maya" <maya@example.test>).

### Edge Cases
- The check is local and structural: one "@", a dotted domain, no spaces. "li.wen@example" fails; "typo@gmial.test" passes and goes out.
- An invalid address in Cc or Bcc disables Send, but the error line shows under that row only, so with the Cc/Bcc rows collapsed it cannot happen (the rows are open once Cc has content).
- Keyboard: To, Cc and Bcc use the email keyboard with no auto-capitalization or autocorrect. The Subject and body use the default keyboard.

---

## STORY-003: Forward a message with its attachments
**Type**: medium
**Topic**: Compose and drafts
**Persona**: Priya Natarajan, finance lead at a 20-person startup
**Goal**: Forward a vendor invoice and its PDF to her accountant.
**Preconditions**: Message "Invoice 2041" from billing@example.test has the attachment "invoice-2041.pdf" (212 KB). Mail writes on.
**Ideal path**: 4 — Forward, type the address, check the attachment is included, Send.
**Alternate paths**: none found. The agent can forward through approval cards (`MailApprovalCardView`), which is a separate route.

### Steps
1. Tap "Reply" in the toolbar, then "Forward" → the "Forward" sheet opens; Subject is "Fwd: Invoice 2041", the body holds the forwarded text, and an attachments section lists "invoice-2041.pdf" with its size and a "Remove" button.
2. Type the accountant's address in To → Send enables.
3. Tap "Send" → the draft goes out with `forwardOf` carrying the message id and the attachment ids that are still listed.

### Variations
- Tap "Remove" on a file → the row disappears and that id is dropped from `forwardOf.attachmentIds`.
- Reply and Reply all also list the original attachments and offer Remove, but `attachmentIds` is only sent for Forward, so removing a file in a reply does nothing on the server (see Gaps).

### Edge Cases
- Files over the size limit: the prefill sets `attachmentsTooLarge`, and the banner reads "Some files were left out: big-deck.pdf." The user can still send.
- If the original message body cannot be quoted (`quoteUnavailable`), nothing is shown to the user; the field is decoded but not displayed in the sheet.

---

## STORY-004: Discard changes with the Cancel dialog
**Type**: short
**Topic**: Compose and drafts
**Persona**: Tomas Brandt
**Goal**: Back out of a half-written reply he no longer needs.
**Preconditions**: A reply sheet is open and the body has been edited.
**Ideal path**: 2 — Cancel, Discard draft.
**Alternate paths**: Swipe down on the sheet does nothing while there are changes (`interactiveDismissDisabled`); with no changes it closes the sheet at once.

### Steps
1. Tap "Cancel" → a confirmation dialog titled "This draft has changes" shows "Save draft", "Discard draft" and "Keep editing".
2. Tap "Discard draft" → the sheet closes. Nothing is deleted on the server unless a draft was saved earlier in this sheet.

### Variations
- Tap "Keep editing" → the dialog closes and the typed text stays.
- Tap Cancel on an untouched sheet → it closes with no dialog.

### Edge Cases
- Swipe-down on a changed sheet gives no feedback at all: the sheet just resists. The user must find Cancel.
- "Has changes" compares To, Cc, Bcc, Subject, body, From and attachment ids with what the prefill returned, so typing and deleting the same text counts as no change.

---

## STORY-005: Save a draft and come back to it
**Type**: medium
**Topic**: Compose and drafts
**Persona**: Maya Okafor
**Goal**: Park a reply to an investor while she checks the numbers, then finish it.
**Preconditions**: A reply sheet to "Re: Q3 update" is open with two paragraphs typed.
**Ideal path**: 3 — Cancel, Save draft, then reopen and find the same text.
**Alternate paths**: none found for resuming. Tapping Reply again on the same message calls the prefill again and opens a new sheet with a new `clientId`; no draft list or "Drafts" folder exists in the app.

### Steps
1. Tap "Cancel", then "Save draft" → `inbox/compose/draftSave` runs; on success the sheet closes. There is no toast or confirmation that it saved.
2. Later, open the same message and tap "Reply" → "Reply" → a fresh prefill loads (quote only). The saved text is not restored by the app.
3. Maya has to open Gmail or another client to find the saved draft in Drafts.

### Variations
- Edit again after a save inside the same sheet (the sheet stays open when the save fails): the next "Save draft" reuses the `clientId`, so the server updates the same draft.
- Save draft, then reopen and Discard in the same sheet: `discard` runs only for a draft saved in this sheet (`savedDraft`).

### Edge Cases
- Save fails with a network error: the banner shows the error text at the top of the form and the sheet stays open. Cancel would show the dialog again.
- Save reports reconnect or writes off: the same banners as in send (STORY-007), the sheet stays open.
- Cancel while a send is in flight is possible; the dialog's Save draft would then race the send.

---

## STORY-006: Send fails because Gmail rejects the message
**Type**: medium
**Topic**: Compose and drafts
**Persona**: Tomas Brandt
**Goal**: Send a reply, recover from a rejection, and send again.
**Preconditions**: A reply sheet with a body typed. The address "ops@example.test" bounces at the provider check.
**Ideal path**: 3 — Send, read the reason, fix the address and Send.
**Alternate paths**: none found.

### Steps
1. Tap "Send" → spinner in the toolbar, the sheet cannot be swiped away.
2. The server answers `failed` with reason `rejected` → a banner at the top of the form reads "Not sent. Gmail rejected the message. Check the addresses." The spinner is replaced by Send again.
3. Fix the To address → Send is enabled because the banner is `notSent`, not `unknown`.
4. Tap "Send" → on success the sheet closes and "Sent" appears on the message screen.

### Variations
- Reason `rate_limited`: "Not sent. Gmail is limiting requests. Try again in a moment."
- Any other reason: "Not sent. Try again."
- A server error (`RPCError`) means the request was refused, so it shows the server's message as "not sent".

### Edge Cases
- The banner is plain text and stays until the next send clears it; it has no Dismiss button.
- Gmail needs reconnect: "Gmail needs to reconnect before it can send. Reconnect it in Settings." There is no button to open Settings from the banner; the user must close the sheet first.
- Mail writes off for the account: "Mail writes are off for maya@example.test." Same: text only, and the draft would be lost if the user cancels without saving (Save draft hits the same writes-off answer).

---

## STORY-007: The connection drops while sending
**Type**: medium
**Topic**: Compose and drafts
**Persona**: Priya Natarajan, on a train with patchy signal
**Goal**: Send a payment confirmation without sending it twice.
**Preconditions**: A reply sheet is ready to send. The connection drops after the request leaves the phone.
**Ideal path**: 2 — Send, then confirm in Sent that it went out.
**Alternate paths**: Reading the Sent folder is done outside the app (Gmail); the app has no "Sent" view in the message screen.

### Steps
1. Tap "Send" → spinner; the request times out after 60 seconds or fails with a transport error.
2. The banner reads "We couldn’t confirm this sent. Check Sent before sending again." with a "Close" button. Send is disabled for the rest of this sheet so the same message cannot go out twice.
3. Tap "Close" → the sheet closes; the draft text is gone. She checks Sent in Gmail.

### Variations
- The server itself answers `unknown`: same banner.
- If the user reconnects and wants to resend, she must reopen Reply and retype or copy the text before closing. The Close button gives no chance to copy it except by selecting text in the body first.

### Edge Cases
- Cancel at this point: the dialog appears (the form still has changes) and "Save draft" would try the server again.
- Because the same `clientId` is used, even a second attempt from the same sheet would be deduplicated, but the app blocks it anyway.

---

## STORY-008: Write while the keyboard is open (long reply on a small phone)
**Type**: short
**Topic**: Compose and drafts
**Persona**: Maya Okafor, using the iPhone one-handed
**Goal**: Type a long reply and still reach Subject and the quote.
**Preconditions**: A reply sheet is open; the on-screen keyboard is showing.
**Ideal path**: 2 — scroll down to dismiss the keyboard, tap Send.
**Alternate paths**: none found. There is no keyboard toolbar with a Done button.

### Steps
1. Tap the body and type several paragraphs → the form is a `Form` in a scroll view; the body editor is at least 220 pt tall.
2. Drag the form down → `scrollDismissesKeyboard(.interactively)` pulls the keyboard away with the finger.
3. Tap "Send" → focus is cleared before the request so the keyboard is gone while the spinner shows.

### Variations
- Tap "Cc, Bcc" → Cc takes focus immediately and the keyboard changes to the email keyboard.
- The toolbar (Cancel, Send) stays at the top, so it is never hidden by the keyboard.

### Edge Cases
- The sheet shows both the outer form scroll and the body editor's own scroll; with a long body, the inner and outer scrolling compete (not checked on a device).
- Dynamic Type at the largest sizes: the Subject and recipient rows are an `HStack` with a fixed label and field (not checked on a device).

---

## STORY-009: Compose with no mail account connected
**Type**: short
**Topic**: Compose and drafts
**Persona**: Rui Tanaka, new user who has not connected Gmail
**Goal**: Understand why he cannot write mail.
**Preconditions**: No mail account is connected. Mail cannot be opened from the message screen without one, so this state is reachable only through a stale message or a new-mode sheet.
**Ideal path**: 2 — see the message and go to the connect screen.
**Alternate paths**: Settings, Integrations lists Gmail to connect.

### Steps
1. The sheet opens in `.new` mode → `inbox/list` returns no accounts and `connectionID` stays empty.
2. The sheet shows the failed state "Connect a mail account to write a message." with Retry. There is no button to open Integrations.

### Variations
- Reply with a prefill error (message was deleted): the failed state shows the server text with Retry; Cancel closes the sheet.

### Edge Cases
- Retry with the account still missing returns the same state.

---

## STORY-010: Reply, then archive the thread in one pass
**Type**: long
**Topic**: Compose and drafts
**Persona**: Maya Okafor
**Goal**: Clear three "Needs reply" messages with short answers.
**Preconditions**: Three messages in "Needs reply": a scheduling question, an invoice question and a thank-you.
**Ideal path**: 9 — open, reply, send for each (3 steps each); archive is automatic or one tap.
**Alternate paths**: Ask Inbox agent to draft each reply (STORY-002 in `inbox.md`).

### Steps
1. Open the scheduling message and tap Reply → Reply → type "Thursday at 2 pm works." → Send. The sheet closes and "Sent" shows for 3 seconds.
2. The message stays open; tap "Archive" in the toolbar → "Archived" and "Undo" appear at the bottom, and she goes back to the Inbox list.
3. Open the invoice question; Reply, answer, Send, Archive.
4. Open the thank-you; Reply, type "Glad to help.", Send, Archive.

### Variations
- She forgets to archive: the thread stays in "Needs reply" until the server's triage reclassifies it (not checked in the code).
- She uses Reply all on the invoice question because finance is on Cc.

### Edge Cases
- Sending does not archive or mark the thread answered on the client; the screen after Send is the same open message.
- Two sends in quick succession from different messages are independent sheets with different client ids.

---

## Gaps in the code (for the consolidation step)

- No entry point for a new message. `ComposeSheet` is created only in `InboxMessageScreen`; `ComposeMode.new` and the accounts path in `ComposeModel.load()` are unreachable from the UI. The Inbox list has no Compose button.
- No way to add an attachment. The sheet can only remove files that the prefill returned; there is no Photos or Files picker.
- No drafts list and no way to resume a saved draft. Save draft only writes to the server; reopening Reply starts from a fresh prefill.
- Remove on an attachment in Reply or Reply all has no effect, since `attachmentIds` is only sent for Forward.
- "Reconnect" and "writes off" banners name the fix but give no button.
- The unknown-result banner offers "Close", which discards the text.
- "Save draft" success has no visible confirmation.
