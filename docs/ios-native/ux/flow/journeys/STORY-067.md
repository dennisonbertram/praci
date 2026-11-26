# Journey critique: compose (STORY-067, STORY-076, STORY-068, STORY-072)

Scope: reply to a customer and send (STORY-067), reply then archive in one pass (STORY-076), fix a recipient (STORY-068), send failure (STORY-072). Evidence is Swift code and `docs/ios-native/ux/topics/compose.md`; no device walk was done. Paths are under `apps/ios/Sources/Praci/`. "Measured" means counted or read from code. "Suspected" means it needs a device walk.

Verdict: **STORY-067 acceptable**, **STORY-076 convoluted**, **STORY-068 minimal**, **STORY-072 acceptable**.

## 1. Friction scorecard

### STORY-067 Reply and send (ideal 3: open the reply, type, Send)

| Measure | Result | Evidence |
|---|---|---|
| Steps from the open message | 4 taps/inputs: Reply toolbar menu, "Reply" item, tap body and type, Send. Ideal is 3. Measured from code. | Menu `Inbox/InboxMessageScreen.swift:88-103`; sheet `:43-49`; body never auto-focused (`Inbox/Compose/ComposeSheet.swift:127-132`, `focus` is set only at `:99` and `:167`) |
| Decisions | 2 that 90% of users do not need: pick Reply from a menu that also holds Forward and Reply all; decide whether to touch From/Subject/Cc. Measured. | `InboxMessageScreen.swift:89-98` |
| Re-entry of known data | None. To, Subject, quote and account come from the prefill. Measured. | `Inbox/Compose/ComposeModel.swift:73-81` |
| Confirmations | None on Send. Cancel with changes asks 3 ways, which guards a real loss. Measured. | `ComposeSheet.swift:70-76` |
| Dead ends | After Send the sheet closes onto the same message with a 3-second "Sent" pill and no onward action. Measured. | `InboxMessageScreen.swift:130-135`, `:46-50`; `ComposeSheet.swift:166-172` |
| Hesitations | (a) Reply is a menu, so a first-time user taps once and sees three verbs; (b) the cursor start position inside the quoted body is unknown (suspected, needs device walk); (c) a spinner shows while the prefill loads before any field appears (`ComposeSheet.swift:48`, suspected feel). | |

### STORY-076 Reply then archive, three messages (ideal 9, 3 each, archive automatic or one tap)

Per message the code needs: open row, Reply menu, "Reply", tap body + type, Send, Archive icon, Back = 7 taps plus typing. Three messages = 21 taps. The ideal of 9 is not reachable without changes. Measured from code.

- Archive does not return to the list. `InboxMessageModel.archive()` only sets `archived = true` (`Inbox/InboxMessageModel.swift:51-58`), the screen shows "Archived / Undo" (`InboxMessageScreen.swift:121-127`), and `dismiss` is declared but never called (`:26`). The topic file says "she goes back to the Inbox list" (`topics/compose.md` STORY-010 step 2); the code does not. Treat the topic text as wrong. Measured.
- Sending does not archive or mark the thread answered on the client (`ComposeSheet.swift:166-172`). Whether the server removes it from "Needs reply" is unknown (suspected, needs device walk).
- The list already has full-swipe Archive with an Undo toast (`Inbox/List/InboxListView.swift:59-63`), but it cannot be reached after a reply without going back first.
- Decisions per message: Reply vs Reply all vs Forward, then archive or not. The archive decision is the one a default could carry.
- Dead end: after the last of three messages the user lands on a read message with no "next". Measured.

### STORY-068 Fix a mistyped recipient (ideal 3)

Type a second address; "Not a valid address" shows under the field as you type; Send is disabled until it is fixed. That is 2 inputs. Measured: `ComposeSheet.swift:94`, `:148-152`; `ComposeModel.swift:114-120`. No confirmation, no re-entry, no dead end. The only gap is that a disabled Send gives no hint when the error is in Cc/Bcc that has scrolled off, which cannot happen because the rows open once Cc has content (`ComposeSheet.swift:81`, `ComposeModel.swift:81`). Already minimal. No contact suggestions exist (`topics/compose.md` STORY-002); that is a feature gap, not friction.

### STORY-072 Send fails (ideal 3: Send, read the reason, fix and Send)

Actual: Send, read banner, fix the field, Send = 3. Measured. The banner copy is clear for the three known reasons (`ComposeModel.swift:175-180`) and keeps Send enabled (`canSend`, `:117-120`). Friction is only in the less common banners:

- `.reconnect` and `.disabled` name a fix ("Reconnect it in Settings", "Mail writes are off for ...") but give no button, so the user must Cancel (a three-way dialog with Save draft hitting the same wall) and find Settings (`ComposeSheet.swift:187-190`). Measured; this is catalog finding 19.
- `.unknown` says "Check Sent before sending again" and offers Close, which discards the text (`ComposeSheet.swift:184-186`, `topics/compose.md` Gaps). Send stays disabled (`ComposeModel.swift:118`), so the user cannot retry from here and cannot copy their text. Measured.
- The banner sits in the top Form section, scrolled away if the user was typing in the body of a long reply (suspected, needs device walk).

### Finding 5: no way to start a new message

`ComposeSheet` is created only in `InboxMessageScreen` (`InboxMessageScreen.swift:43-49`). `ComposeMode.new`, the From picker for several accounts (`ComposeSheet.swift:84-87`) and the accounts load (`ComposeModel.swift:87-91`) are unreachable. Measured. The nearest alternate path is "Ask Inbox agent" (`InboxScreen.swift:44-49`, `InboxMessageScreen.swift:138-151`), which is a different feature. This is a missing entry, not a friction in the reply path, but it also means about a third of `ComposeSheet` is dead code in the shipped app.

## 2. Take-away pass

**Message screen toolbar and bottom bar** (`InboxMessageScreen.swift:82-152`)
- Archive icon, Reply menu, More menu (only for non-self senders). Three controls, none loud; fine.
- The full-width "Ask Inbox agent" `borderedProminent` button is the only visually dominant control, yet it is not the usual next step for a person who wants to answer. Reply is a small icon. Hierarchy points at the wrong action for this journey. Measured.
- The "Sent" and "Archived/Undo" pills are good progressive feedback; keep.

**Compose sheet** (`ComposeSheet.swift:80-135`)
- From row: read-only text when there is one account (`:88-93`). It states a fact the user already knows and cannot change. Removable for one account. Measured.
- Subject: editable but a reply almost never changes it. Keep, but it need not be a full row for replies if space is short (suspected, low value).
- "Cc, Bcc" button: correct progressive disclosure. Keep.
- Quoted text sits in the editable body; fine.
- Toolbar: Cancel left, Send right, Send is the one primary. Good. `Label("Send", systemImage: "paperplane.fill")` in a toolbar shows icon only on iOS, so the word is not visible (suspected, needs device walk).
- Cancel dialog: three buttons. "Save draft" success shows nothing, and there is no drafts list (catalog finding 19; `topics/compose.md` Gaps), so Save draft writes something the user can never open from the app. Offering it is a dead end. Measured.

**Banner** (`ComposeSheet.swift:175-196`): text only, no buttons except Close on one case.

## 3. The simpler version

Reply and send, STORY-067 (2 taps plus typing):
1. On the open message, tap Reply (single tap opens the reply). Keyboard is already up with the cursor above the quote.
2. Type, tap Send. The sheet closes and "Sent" shows.

Reply and clear, STORY-076 (per message, 3 taps plus typing; 9 for three):
1. Tap the row in "Needs reply".
2. Tap Reply, type, tap Send (Send offers "Send and archive").
3. The app returns to the list with "Sent" and Undo; the next message is one tap away.

Changes to get there are in the Proposals below.

## 4. Clarity issues
- "Ask Inbox agent" (`InboxMessageScreen.swift:141`) beside "Reply": a first-time user cannot tell that one writes the mail for them and the other opens a blank reply. Suspected, needs device walk.
- "Cc, Bcc" is a button that looks like a label; it reads as a field title (`ComposeSheet.swift:99-100`, muted foreground). Suspected.
- "This draft has changes" (`ComposeSheet.swift:70`) is a statement, not a question; the three options are clear but the title does not say what is at stake. Suspected.
- Banner "We couldn’t confirm this sent. Check Sent before sending again." (`:185`) does not say where "Sent" is; the app has no Sent view (`topics/compose.md` STORY-007 alternate paths). Measured.
- Banner "Reconnect it in Settings" names a place but offers no way to get there (`:188`). Measured.
- The sheet title is "Reply" for both Reply and Reply all (`ComposeModel.swift:61`); Reply all adds Cc people silently, but the open Cc row shows them. Acceptable.

## Proposals

| id | Problem and evidence | Proposal | Steps saved | Risk | Size | Device walk |
|---|---|---|---|---|---|---|
| JC-1 | STORY-067: Reply is a menu; the common verb costs 2 taps (`InboxMessageScreen.swift:88-103`). | Use `Menu` with `primaryAction` so a tap opens Reply and a long press shows Reply all and Forward. Keep Forward discoverable through the long press and the standard menu hint. | 1 per reply | Reply all and Forward are less visible | S | y |
| JC-2 | STORY-067/076: body is not focused on open, the user must tap it (`ComposeSheet.swift:127-132`, no `focus = .body` outside Cc and send). | After the prefill loads, set `focus = .body` for Reply and Reply all (To for New). Place the cursor above the quote. | 1 per reply | Keyboard covers the quote; cursor position needs checking | S | y |
| JC-3 | STORY-076: archive is a separate trip and does not return to the list (`InboxMessageModel.swift:51-58`, `dismiss` unused `InboxMessageScreen.swift:26`); 7 taps per message. | Add "Send and archive" as the long-press action on Send (or a toggle remembered per space) and return to the list with the existing Undo toast pattern (`InboxScreen.swift:57-59`). | 2 per message (Archive, Back) | Archiving a thread the user meant to keep; mitigated by Undo | M | y |
| JC-4 | STORY-076 and `topics/compose.md` STORY-010 disagree with the code: the topic says Archive returns to the list; code stays on the message. | Either fix the topic text, or make Archive pop to the list (matches the list swipe behavior). Prefer popping, so after-archive lands on the next message of "Needs reply". | 1 per message | None | S | n |
| JC-5 | STORY-067: Ask Inbox agent is the one prominent control on the message screen; Reply is a small icon (`InboxMessageScreen.swift:138-151`). | Make Reply the prominent bottom action and move "Ask Inbox agent" to a quieter style, or let one control hold both ("Reply" with agent draft as an option). | 0 steps; fewer wrong turns | Lowers visibility of the agent | S | y |
| JC-6 | STORY-067: From row states a fixed fact for one account (`ComposeSheet.swift:88-93`). | Show From only when there is more than one account to choose (the picker case). | 0 steps, one less row | None | S | n |
| JC-7 | STORY-072: Reconnect and writes-off banners name a fix without a button (`ComposeSheet.swift:187-190`). | Add a "Settings" button on those two banners that closes the sheet and opens Settings (reuse `app.showingSettings`). Keep the draft by saving first only if writes are on. | 2 to 3 (Cancel, dialog, find Settings) | Losing the typed text on close | S | y |
| JC-8 | STORY-072: `.unknown` shows Close, which discards, and Send stays off (`ComposeSheet.swift:184-186`, `ComposeModel.swift:118`). | Replace Close with "Copy text" (or keep the text and allow Send as a new message after the user confirms). | 0 steps; avoids data loss | Duplicate send if the user retries | S | n |
| JC-9 | STORY-071/067: "Save draft" is offered but no draft can be opened and success is silent (`ComposeSheet.swift:71`, catalog finding 19). | Either remove Save draft from the Cancel dialog until a way to resume exists, or add the resume path. Removing is the smaller change. | 1 decision removed | Loses a safety net for long replies | S | n |
| JC-10 | Finding 5: no entry for a new message; `ComposeMode.new` and the From picker are dead code (`InboxMessageScreen.swift:43-49` only). | Add a Compose toolbar button on the Inbox list (`InboxScreen.swift:29-51`) that opens `ComposeSheet(replyTo: nil, forward: nil)`. If not wanted, delete the dead `.new` branches. | New capability (0 to 3 steps) | Adds a control; `AGENTS.md` asks for minimal UI | M | y |
| JC-11 | STORY-072: the send-failure banner is in the top Form section and can be scrolled out of sight while the body has focus (`ComposeSheet.swift:82`). | Scroll to the banner on failure or show it above the keyboard as a toolbar-level alert. | 0; fewer missed errors | Small layout work | S | y |
