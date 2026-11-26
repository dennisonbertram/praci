# Agent thread: stories

Topic: the thread screen for one agent (and, where noted, a group). Covers streaming replies, the "New" divider, Jump to latest, scrolling and loading older messages, message actions, attachments, the offline queue, Stop and the keyboard.

Source read for this pass (paths under `apps/ios/Sources/Praci/Thread`): `ThreadScreen.swift`, `ThreadModel.swift`, `ThreadMessageView.swift`, `MessageActions.swift`, `ThreadReactions.swift`, `Composer/ComposerView.swift`, `Composer/ComposerModel.swift`, `Composer/PendingSendsView.swift`, `Composer/SendQueue.swift`. Nothing was run on a device or simulator. Every statement below is "the code does X", not "observed". All names, files and message text are invented.

Facts from the code that several stories rely on:

- The list is a `ScrollView` with a `LazyVStack`, `.defaultScrollAnchor(.bottom)`. The thread opens at the bottom, or at the "New" divider when one exists.
- `atBottom` is true when the visible area is within 48 pt of the content end. While true, new content and new messages re-scroll to the bottom and call `threads/markRead`. When false, nothing moves and a glass "Jump to latest" button appears at the bottom right, 80 pt above the bottom.
- Older history is requested when the spinner row at the top of the list appears (`onAppear` calls `loadOlder`, which asks `threads/messages` for a page before `olderCursor`). There is no "Load older" button.
- There is no `scrollDismissesKeyboard` on the thread list. Other screens (Compose, sign-in, Voice settings) have it; the thread does not.
- The message field has `submitLabel(.send)` and `onSubmit`, so the keyboard's Return key sends the message. The field allows 1 to 5 lines but the user cannot type a line break with Return.
- Long-press on a message opens a context menu: Copy (only if it has text), Reply, React (agent messages only, a submenu of six), Mark unread. Reply and React are hidden for messages that are not stored yet (progress rows).
- Right slot of the composer: Stop while any run is running, otherwise the dictation mic when the field and attachments are empty, otherwise Send.

---

## STORY-001: Open a busy thread and land on the newest reply

**Type**: short
**Topic**: Agent thread
**Persona**: Founder who checks an agent a few times a day
**Goal**: Read the newest reply from "Ledger" without scrolling
**Preconditions**: Signed in; the "Ledger" agent has 200 messages and nothing unread; no run is active
**Ideal path**: 1. Tapping the agent row on Home should land on the newest message.
**Alternate paths**: Push notification tap opens the same thread (`app.open`); Home search or pinned row. Same screen, same landing.

### Steps
1. Tap "Ledger" on Home → a spinner shows while `threads/get` loads, then the list appears already scrolled to the bottom (`defaultScrollAnchor(.bottom)`); the title is "Ledger"; the field placeholder is "Message Ledger".
2. Read the last reply → timestamp shows under the last message of each run of same-sender messages only.
3. Tap Back → Home.

### Variations
- Thread has no messages: centered "Say hello to Ledger." and the mic button in the composer.
- Group thread: the empty text is "Message the group"; each agent's first message in a run shows its avatar and name.

### Edge Cases
- First load fails: `LoadableView` shows the error with Retry (increments `attempt`, which restarts the task).
- Later refresh fails while messages are on screen: one footnote line at the top of the list, "Couldn’t refresh. Showing the last loaded messages." It scrolls away with the content and has no Retry button; the next stream resync or reopening the thread clears it.
- Title is blank until `bots/get` returns (the name comes from a separate call), so the title can appear a moment after the messages.

---

## STORY-002: Return to a thread with unread replies and the "New" divider

**Type**: medium
**Topic**: Agent thread
**Persona**: Founder who left a long research task running overnight
**Goal**: Start reading at the first reply they have not seen
**Preconditions**: "Researcher" posted 7 replies since the founder last read; the thread has 60 messages
**Ideal path**: 1. The thread opens at the first unread message with a clear marker; reaching the end marks it read automatically.
**Alternate paths**: The unread dot or count on the Home row leads here; no other path to the divider. "Mark unread" in the message menu recreates a divider later (see Variations).

### Steps
1. Tap "Researcher" on Home → thread loads; `task(id: divider)` waits 150 ms and scrolls so the "New" divider (two thin lines with the word "New") is at the top of the screen; the "Jump to latest" button appears because the reader is not at the bottom.
2. Scroll down through the seven replies by dragging → no change to the list position other than the drag; when the last reply is within 48 pt of the end, the button disappears and `threads/markRead` is called.
3. Leave and reopen the thread → no divider, the thread opens at the bottom.

### Variations
- Tap "Jump to latest" instead of scrolling: the list scrolls to the bottom three times, 350 ms apart (rows below the screen are only estimated, so the first jump can land short), then marks the thread read. The divider remains in the list for this visit.
- Long-press a message and tap "Mark unread": `threads/markUnread` is called, the model holds off auto-read (`readHeld`), refreshes, and a divider appears above that message. The founder is then still at the bottom, so nothing scrolls.
- Short thread that fits on one screen: the divider is not scrolled to and `atBottom` is restored after 350 ms from the measured position.

### Edge Cases
- The founder scrolls up during the 150 ms before the divider scroll: the scripted scroll still fires and moves the list.
- `markRead` runs only when the newest non-user message is newer than `lastReadSeq`; opening a thread whose last message is the founder's own does nothing.
- The divider shows only on the first visit of one screen instance (`scrolledToDivider`); after Back and reopen, the anchor is recomputed from the server read mark.

---

## STORY-003: Watch a reply stream in and follow it

**Type**: medium
**Topic**: Agent thread
**Persona**: Founder asking for a summary and waiting for it
**Goal**: See the answer appear without touching the screen
**Preconditions**: Thread open at the bottom; connection good
**Ideal path**: 2. Send the question; the screen stays pinned to the growing reply.
**Alternate paths**: none found (streaming is the only way a reply arrives; reopening the thread shows the finished message).

### Steps
1. Type "Summarize this week’s runway changes" and tap the arrow-up Send button → the text clears, a bubble appears at the right with caption "Sending" (opacity 70%), then switches to the stored message when the event stream delivers it.
2. Wait → "Ledger is working" with three pulsing dots appears below the last message (`WorkingIndicator`). The right slot of the composer changes from Send to a filled Stop square.
3. Tool steps and then the reply text start arriving → the working indicator disappears as soon as the reply text begins (any non-activity progress block with the run's id); the reply grows in place; new tool labels appear as rows with a running indicator.
4. The run finishes → Stop turns back into the mic (field is empty); the reply stays; the thread is marked read while the reader is at the bottom.

### Variations
- Reduce Motion on: the dots do not pulse (fixed opacity).
- Group thread: one working indicator per running agent, each with its own name and color.
- Run fails: a red footnote, "Last run failed: <reason>" (or "Last run failed." if no reason). It appears only while the failed run is the primary run and nothing is running.

### Edge Cases
- Content grows after each stream event; the list re-scrolls to the bottom on every height change only while `atBottom` is true. A very tall single block (a long table) can push the top of the reply off screen, so the reader sees the end of it first.
- Reply streams while the app is backgrounded: on return the stream resyncs through `threads/get` and the model merges the fresh newest page with older pages already loaded.

---

## STORY-004: Scroll up during a streaming reply without being pulled back

**Type**: medium
**Topic**: Agent thread (scrolling)
**Persona**: Founder who wants to re-read an earlier answer while the agent is still writing
**Goal**: Look at an older message while a reply keeps streaming, then return to the live edge
**Preconditions**: "Researcher" is mid-run and writing a long reply; the thread has 120 messages
**Ideal path**: 3. Drag up to the old message; the screen stays put and shows a way back to the live reply; one tap returns.
**Alternate paths**: Dragging back down by hand to the end also returns (and the button disappears). Tapping the status-bar area is not handled specially (iOS default scroll-to-top applies, which jumps to the oldest loaded message and triggers older-page loading).

### Steps
1. While the reply streams, drag the list down (finger moves down, content moves down) to reveal older messages → once the visible bottom is more than 48 pt from the end, `atBottom` becomes false.
2. Keep reading an old message → the list stays where it is as the stream continues to add content; no auto-scroll; the "Jump to latest" button (arrow-down icon and label) appears at the bottom right, above the composer.
3. Tap "Jump to latest" → the list scrolls down three times with animation; the button disappears; `markRead` is called.
4. The reply keeps streaming → the list follows again.

### Variations
- Founder scrolls up only slightly (under 48 pt): still treated as at bottom; the list keeps following and the button does not show. A founder who wants to stop the following with a small scroll cannot.
- Founder drags back down by hand to the end: the button disappears on its own, and following resumes.
- Founder taps Stop while scrolled up: Stop is in the composer and works regardless of position.

### Edge Cases
- While the list is scrolled up, new agent messages do not add a count or a "N new" label to the button. The button text is always "Jump to latest".
- A programmatic scroll by the code (jump or divider) does not change geometry on a short thread, so the code reads `edgeNearBottom` afterward.
- The button sits 80 pt above the bottom with a fixed offset, tuned for the one-line composer. With a reply strip, attachment chips or five-line text the composer is taller and the button can sit close to or under the composer glass. Not verified on a device.

---

## STORY-005: Scroll back through history and load older messages

**Type**: medium
**Topic**: Agent thread (scrolling, paging)
**Persona**: Founder looking for a number "Ledger" gave three weeks ago
**Goal**: Reach old messages by scrolling up
**Preconditions**: The thread has 900 messages; the first page holds the latest 50; `olderCursor` is set
**Ideal path**: 2. Drag up repeatedly; older pages appear without any extra tap and without the view jumping.
**Alternate paths**: none found in the thread (there is no in-thread search or date jump on iOS). The same facts may be in Artifacts or the Agent page from the toolbar menu.

### Steps
1. Open the thread → lands at the bottom with the newest 50 messages.
2. Drag down several times to the top of the loaded messages → a centered spinner row is the first row of the list; when it appears, `loadOlder` runs and calls `threads/messages` before the oldest cursor.
3. The page arrives → older messages (deduplicated by id) are inserted above; the spinner remains if `olderCursor` is still set, and disappears when the start of the thread is reached.
4. Keep dragging → the next page loads each time the spinner row becomes visible.

### Variations
- Fast flick to the top: only one page loads at a time (`loadingOlder` guard); the second flick waits.
- A message refresh while older pages are loaded: `merged` keeps the older messages and replaces only the newest page.

### Edge Cases
- `loadOlder` ignores errors (`try?`). If the request fails, the spinner stays visible and spinning with no message and no retry; scrolling away and back to it triggers another attempt only if the row leaves and re-enters the screen.
- Whether the visible position stays on the same message after prepended rows is not set by the code beyond SwiftUI's default; the code has no scroll position anchor for prepends. Not verified on a device.
- The spinner is the first row of a `LazyVStack`; at the very start the "Couldn’t refresh" footnote (if any) sits just under it.

---

## STORY-006: Dismiss the keyboard by dragging the list

**Type**: short
**Topic**: Agent thread (keyboard)
**Persona**: Founder who typed half a message and wants to read a reply behind the keyboard
**Goal**: Get the keyboard out of the way while reading
**Preconditions**: Thread open; the founder tapped the field; keyboard is up
**Ideal path**: 1. Drag the message list down and the keyboard follows the finger and dismisses.
**Alternate paths**: Tapping elsewhere does nothing (no tap-to-dismiss on the list). The Return key sends rather than dismisses. Swiping down on the keyboard itself is not available on iPhone. Leaving the screen with Back dismisses it.

### Steps
1. Tap "Message Ledger" → keyboard rises; the composer sits above it (`safeAreaInset(edge: .bottom)`).
2. Drag the thread list downward → the list scrolls, but the keyboard stays open (no `scrollDismissesKeyboard`).
3. To dismiss, the founder must navigate Back or send the message; there is no other control.

### Variations
- Same gesture on Compose (Inbox) and sign-in dismisses the keyboard interactively; the thread is the exception, which makes the same gesture behave differently across screens.
- With a hardware keyboard: Return sends; Shift-Return behavior is not set in the code.

### Edge Cases
- With five lines of text, the field is capped at 5 lines and scrolls inside itself.
- The user cannot add a paragraph break through Return, so a multi-paragraph prompt must be pasted in.
- The thread does not scroll to the bottom when the keyboard appears unless the reader was already at the bottom (the composer inset changes the geometry, and `atBottom` then keeps the bottom pinned).

---

## STORY-007: Copy, reply to and react to an agent message

**Type**: medium
**Topic**: Agent thread (message actions)
**Persona**: Founder acting on a finished answer
**Goal**: Copy a figure, ask a follow-up on one paragraph, and thumbs-up the answer
**Preconditions**: Thread open; "Ledger" posted a reply with text "Burn was 41k over plan; three vendors drive it."
**Ideal path**: 3. Long-press the reply and tap Copy; long-press and tap Reply; long-press, React, Like.
**Alternate paths**: React and Reply are only in the long-press menu; no swipe-to-reply and no double-tap. Reactions can also arrive from the web app and are shown the same way.

### Steps
1. Long-press the reply → context menu: Copy, Reply, React, Mark unread.
2. Tap Copy → the text of all text blocks, joined by blank lines, goes to the pasteboard. No toast confirms it.
3. Long-press, tap Reply → a strip above the field: "Replying to Ledger" with the first line of the quote (truncated at 200 chars), an X ("Cancel reply"). The keyboard is not raised automatically.
4. Type "Which three?" and tap Send → the sent bubble shows a small quote above it (max 2 lines); the strip clears.
5. Long-press the reply, tap React, tap "Like 👍" → a user message containing only 👍 is created (`threads/react`); the thread hides it and shows a small capsule "👍" under the reply.

### Variations
- Reacting twice with the same emoji: the capsule shows "👍 2". Reacting with a different emoji adds a second capsule.
- Long-press on the founder's own message: Copy, Reply and Mark unread appear; React does not.
- Long-press on an attachment-only message (no text): Copy is missing; Reply uses the quote "Attachment".
- Long-press on a live progress row (not stored yet): only Copy; no Reply, React, or Mark unread.
- First React before AI data consent: the consent sheet appears first (`consent.ensure`).

### Edge Cases
- React fails: the composer's red notice line reads "Couldn’t react. Try again." The notice shows in the composer, not near the message, and has no auto-dismiss.
- The reaction row is not tappable; the founder cannot remove a reaction in this screen.
- A reaction whose target message is not loaded (older than the loaded pages) stays visible as an ordinary one-emoji bubble.
- The emoji menu entries are text ("Like 👍") because a palette control showed placeholders for emoji.

---

## STORY-008: Attach files and photos, then send

**Type**: medium
**Topic**: Agent thread (attachments)
**Persona**: Founder sending a contract and a photo of a whiteboard
**Goal**: Send a PDF and a photo with one instruction
**Preconditions**: Thread open; no draft
**Ideal path**: 4. Plus, pick items, type, Send.
**Alternate paths**: Photos and Files are in the same "+" menu; no paste of images from the clipboard and no drag-and-drop. Camera capture is not offered from the "+" menu.

### Steps
1. Tap "+" (label "Attach") → menu: "Photo Library", "Files".
2. Choose "Files", pick `Vendor-agreement.pdf` → a capsule chip with a document icon, the name and an X appears above the field. The mic button switches to Send (arrow-up) because there is an attachment.
3. Tap "+", "Photo Library", pick `Whiteboard.jpg` → second chip with a photo icon (the photo is named "Photo.jpg" in the chip; the file's original name is not kept).
4. Type "Pull the payment terms from both" and tap Send → the pending bubble lists both file names and the text, caption "Sending"; chips and text clear.

### Variations
- Photo in HEIC: it is converted to JPEG at 85% quality and the name changes to `.jpg`.
- Remove a chip: tap the X ("Remove <name>").
- Send with only an attachment and no text: allowed (`canSend`).

### Edge Cases
- More than 4 files: "+" is disabled at 4. Picking more than the remaining slots at once keeps only the first ones silently (`prefix(slotsLeft)`), and the notice "4 files is the maximum" is not shown in that path.
- A file over 10 MB: notice "<name> is over 10 MB. Choose a smaller file." A type outside the allowed list (for example a video): "<name> can’t be attached".
- A photo that cannot be loaded: "That photo couldn’t be loaded." A file that cannot be read: "<name> couldn’t be read."
- Notices are one red footnote in the composer; the next successful add clears it.
- Chip names are cut at 140 pt; two files with similar long names look identical.
- A draft (text, chips, reply) lives only in the open screen's model. Going Back and reopening the thread loses the draft; the code does not persist it.

---

## STORY-009: Send while offline, then recover

**Type**: medium
**Topic**: Agent thread (offline queue)
**Persona**: Founder in a lift or on a train
**Goal**: Not lose a message written without signal
**Preconditions**: Thread open; the device has just lost its connection
**Ideal path**: 2. Type and send; the message waits and delivers on its own when the connection returns.
**Alternate paths**: Per-message "Retry" and "Delete" exist both as a visible button and in the long-press menu on a pending message; two ways to the same actions.

### Steps
1. Type "Move the Thursday review to 3pm" and tap Send → the message is saved to disk and shown as a pending bubble, caption "Waiting to send" (queued) or "Sending".
2. The first attempt fails as unreachable → the queue pauses; a footnote above the composer reads "Offline. Messages send when you reconnect."; the queue retries every 5 seconds.
3. Connection returns → the next retry succeeds, the bubble becomes a normal message when the stream delivers it, the offline line goes away.
4. Reply from the agent starts streaming (Story 003).

### Variations
- The server refuses the message (for example, a model is not connected): the bubble gets a red outline and "Not sent: <server message>" with a Delete button; no automatic retry. The founder edits by retyping; the text is not put back in the field.
- Delivery failed for another reason: "Not sent" with a Retry button (and Retry or Delete in the long-press menu).
- App is killed while offline: the queue is kept on disk and resumes when the app is opened and the user is confirmed.
- AI data consent missing: the failure text is the consent message, shown as "Not sent: …".

### Edge Cases
- At 20 unsent messages, Send is refused with "Too many unsent messages. Try again later." and the draft stays in the field.
- Disk problem: "Couldn’t save the message on this device." and the draft stays.
- Pending bubbles are not stored messages: no Reply, React, Mark unread. A pending bubble stays at the end of the list, below older stored messages, even if the agent’s earlier reply arrives after it.
- The "Offline" line is global to the queue, not to this thread, and shows even on a thread with nothing pending.
- While offline the agent’s stream is also down. Nothing in the thread says so until a refresh fails; the "Offline" line shows only after a send attempt fails.

---

## STORY-010: Stop a run and send a correction

**Type**: short
**Topic**: Agent thread (Stop)
**Persona**: Founder who just realized they asked about the wrong quarter
**Goal**: Halt the agent and redirect it
**Preconditions**: "Ledger" is running on the Q2 question; the founder sees "Ledger is working"
**Ideal path**: 2. Tap Stop, then type and send the correction.
**Alternate paths**: none found (no Stop in the toolbar menu). Voice call hang-up ends the call, not the run.

### Steps
1. Tap the filled square (label "Stop") → it becomes a spinner while `threads/stop` runs; the button is disabled during the call.
2. The run ends → the slot returns to the mic; the working indicator disappears.
3. Type "I meant Q3" and tap Send → pending bubble, then a new run (Story 003).

### Variations
- The founder types a draft while the run is active: the slot still shows Stop, not Send, so the draft cannot be sent until the run ends or is stopped. The Return key can still send it (the keyboard submit calls `send` when `canSend`).
- Group thread: Stop applies to the whole group thread; one button for all running agents.

### Edge Cases
- Stop fails: red notice "Couldn’t stop. Try again." and the button returns.
- The stopped run may leave a partial reply; it stays in the thread. No "stopped" label is shown, and `failureText` appears only for runs with a failed status.
- Tapping Stop twice is blocked while stopping.
- Two paths to send a follow-up while a run is active (Return on the keyboard, but not the button) are inconsistent.

---

## STORY-011: Long session: catch up, scroll back, attach, lose signal, stop, react

**Type**: long
**Topic**: Agent thread
**Persona**: Founder preparing a board update on a commute
**Goal**: Use the thread through a whole working session across the features above
**Preconditions**: "Ledger" has 400 messages and 5 unread; the connection is weak

### Steps
1. Tap "Ledger" on Home → thread opens at the "New" divider; "Jump to latest" shows.
2. Scroll down through the five unread replies → button disappears; marked read.
3. Drag up to find last month’s forecast → spinner row at the top loads older pages twice; a third load fails silently and the spinner keeps spinning; drag down and up again to trigger it.
4. Long-press the forecast message → Copy.
5. Scroll to the bottom with "Jump to latest" (which appeared when scrolling up).
6. Tap "+", Files, pick `Board-deck-v3.pdf` → chip appears.
7. Type "Compare slide 4 with the forecast I copied" and paste the figures; tap Send.
8. The train enters a tunnel → the bubble stays "Waiting to send", "Offline. Messages send when you reconnect." shows.
9. Signal returns → message delivers; "Ledger is working" appears.
10. The reply starts streaming; the founder scrolls up to check a figure → following stops; "Jump to latest" shows.
11. The reply goes the wrong way; the founder taps Jump to latest, then Stop.
12. Type "Use Q3 numbers only" and Send → new run.
13. Long-press the finished reply → React → Like 👍.
14. Back to Home → the thread’s unread count is zero.

### Variations
- Step 7 pasted text with many lines; the field grows up to five lines and scrolls inside.
- The founder dismissed the keyboard in step 10 by dragging: it does not dismiss (Story 006), so they scroll with the keyboard still covering a third of the screen.

### Edge Cases
- If the app goes to the background at step 8, the queue is persistent and resumes.
- A draft typed in step 7 is lost if the founder leaves the thread before sending (Story 008).

---

## Observations for the catalog (from the code, not yet seen on a device)

1. No scroll-to-dismiss keyboard in the thread; the same gesture works on Compose and sign-in.
2. "Jump to latest" has no count and a fixed 80 pt offset that may collide with a tall composer.
3. `loadOlder` has no error state or retry; a failed page leaves a permanently spinning row.
4. Return sends the message and no line break can be typed; Return also sends while Stop is shown, but the Send button is hidden.
5. The draft is not kept when leaving the thread.
6. "Offline" banner is global to the queue and appears only after a failed send.
7. Copy gives no confirmation; React and Stop failures use one shared red notice line in the composer.
8. Reaction capsules cannot be removed or tapped.
