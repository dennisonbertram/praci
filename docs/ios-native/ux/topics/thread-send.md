# Stories: Sending, attachments and offline

Status: planning only. These stories describe the planned native SwiftUI iPhone app (epic #427, phase 5 = issue #417). No Swift code exists, so every step is planned or inferred, not observed.

Design sources used: `docs/design-system/ios/boards/DS-06-Chat.dc.html` (composer, attachment chips, mention popover, reply preview, failed send bubble, caption states, working indicator), `PG-A-Thread.dc.html`, `PG-A-GroupThread.dc.html`, and the "Agent thread" and "Group thread" rule cards in `PG-A-Rules.dc.html`. Behavior sources: `docs/ios-native/README.md` section 5 (sending, outbox, reactions), `docs/ios-native/plan.md` phase 5, `apps/mobile/app/thread.tsx`, `apps/mobile/lib/pick-attachments-filter.ts`, `apps/mobile/lib/thread-feedback.ts`, `packages/contracts/src/rpc.ts` (`threads.send`, `threads.react`, `threads.stop`), `packages/contracts/src/attachments.ts`, `packages/contracts/src/reactions.ts`.

Facts the stories rely on:
- Up to 4 attachments, 10 MiB each. Allowed types: jpeg, png, webp, gif, pdf, plain text, markdown, csv, html, json, zip, two spreadsheet types, tsv. HEIC is not allowed, so the client converts it to JPEG.
- Send is `artifacts/create` per file (base64), then `threads/send` with `clientNonce`. Outbox states: queued, failed, refused. Unreachable or 429 returns to queued. 4xx other than 408, 425, 429 is refused. Caps 20 entries and 50 MB.
- Six reactions: thumbs up, thumbs down, heart, laugh, party, surprised.
- The DS-06 caption reads "Sending" or "Delivered". The failed row reads "Not sent" with "Retry"; long-press gives "Retry" and "Delete".

---

## STORY-001: Send a plain text message to one agent
**Type**: short
**Topic**: Sending, attachments and offline
**Persona**: Maya Okafor, solo founder of a 3-person logistics startup
**Goal**: Ask the Inbox agent to draft a reply to a customer and see it accepted.
**Preconditions**: Signed in, a model is connected, the thread with "Inbox agent" is open on a standard iPhone, network is up.
**Device**: standard iPhone
**Ideal path**: 3 — type, tap Send, read the reply.
**Alternate paths**: Dictate with the mic in the empty composer (mic becomes Send once text appears); voice call from the thread (see the voice topic); reply to an existing message (STORY-004).
**Design source**: `DS-06-Chat.dc.html` Composer (Empty, Typing states) and "User bubble and agent message"; `PG-A-Thread.dc.html`; `PG-A-Rules.dc.html` Agent thread card ("With nothing pending, send in the composer").

### Steps
1. Tap the glass capsule labelled "Message Inbox agent" → keyboard rises, composer lifts above the keyboard and home indicator inset. Trailing control is the bare mic (Dictate). Send is not shown yet.
2. Type "Reply to Ana: Thursday works, 10am." → the mic is replaced by the prominent Send arrow (SF `arrow.up`, ink arrow on light fill). The capsule grows up to 6 lines, then scrolls.
3. Tap Send → the bubble appears right-aligned at 70% opacity with caption "Sending"; the composer clears; the working indicator appears ("Inbox agent is working") and the trailing control becomes Stop. When the server echo arrives the bubble goes to full opacity with the caption "Delivered" or a sent time such as "9:41 AM".

### Variations
- Text longer than 6 lines: capsule stops growing and scrolls inside.
- Empty or whitespace-only text: Send stays disabled (board: "Send is disabled with no text and no attachment").
- The same exchange on iPhone Duo outer display, inner display and half-folded renders the same composer; only the column width changes (see the Duo topic).

### Edge Cases
- Double tap on Send must not create two messages. The plan uses `clientNonce`, which suggests the server de-duplicates a retry, but the double-tap guard in the UI is not stated.
- Send while the keyboard is dismissing mid-animation: not specified.

### Design gaps
- The "Sending" caption is described only on the last bubble of a run. What the caption shows when two of my own messages are in flight at once is not defined.
- The rule card says working shows "three blue dots"; DS-06 says the dots are neutral (card fill pill, 6pt dots) and the ring uses `statusWorking`. Rule card and component board disagree on color.

---

## STORY-002: Attach a photo and a PDF, then send
**Type**: medium
**Topic**: Sending, attachments and offline
**Persona**: Tomas Reyes, founder of a seed-stage hardware company
**Goal**: Send a photographed receipt and a PDF contract to the Finance agent and ask for a summary.
**Preconditions**: Thread with "Finance agent" open, photo library permission already granted, a 2 MB JPEG and a 3 MB PDF available.
**Device**: standard iPhone
**Ideal path**: 7 — Attach, pick photo, Attach, pick file, type, Send, wait.
**Alternate paths**: Take a photo via the Camera source instead of the library; attach an existing artifact or Data room item (the contract has `artifactIds` and `dataRoomItemIds` on `threads/send`, but the plan names no picker for them); share a file into the app from another app (share extension, phase 11, #425, no board).
**Design source**: `DS-06-Chat.dc.html` Composer and "Attachment chips and reply preview" specimen (chips "terms.pdf" and "chart.png", message "Check the attached"). The Attach menu itself: NO BOARD.

### Steps
1. Tap the 44pt glass circle with `plus` (Attach) at the left of the composer → a source menu opens. Expo labels: "Photo library", "Camera", "File". The native menu is NO BOARD.
2. Choose "Photo library" and pick one photo → a 32pt chip appears inside the capsule above the text, showing the thumbnail and a remove control.
3. Tap `plus` again, choose "File", pick the PDF → a second chip appears with the file name (for example "terms.pdf").
4. Type "Check the attached" → the trailing control becomes Send.
5. Tap Send → the client uploads each file with `artifacts/create` (60 s allowed per upload), then calls `threads/send` with the returned `artifactIds`. The bubble shows the image thumbnail and a file row, caption "Sending".
6. Wait → caption changes to "Delivered"; the Finance agent shows "Finance agent is working".

### Variations
- Attachment only, no text: Send is enabled ("Send is disabled with no text and no attachment"), so a lone attachment is valid.
- Remove a chip before sending with the chip remove control (Expo accessibility label "Remove {name}").
- Same flow in a group thread: chips and composer are identical; the bubble is not tinted by bot color.

### Edge Cases
- Upload of the first file succeeds and the second fails: whether the first artifact is reused on retry is not specified (the outbox keeps the attachment payload, per the 50 MB cap, which implies bytes are stored).
- Photo permission denied: Expo shows a skipped notice "{name} (permission denied)". The native equivalent and the Settings deep link are NO BOARD.
- Large file while on cellular: no progress indicator is designed.

### Design gaps
- NO BOARD for the Attach source menu, a per-chip upload progress state, or a chip error state.
- The chip row has no board state for 4 chips at once (it can need to scroll or wrap inside a capsule that grows to 6 lines).
- No picker for artifacts or Data room items even though `threads/send` accepts them.
- Expo reads "Photo library / Camera / File"; the board shows only the `plus` button and no labels.

---

## STORY-003: Attach a HEIC photo, a too-large video and a fifth file
**Type**: medium
**Topic**: Sending, attachments and offline
**Persona**: Priya Natarajan, founder of a two-person legal-tech startup
**Goal**: Attach several files and understand which were accepted.
**Preconditions**: Thread open; the library contains one HEIC photo, a 40 MB screen recording, and four small PNG screenshots.
**Device**: standard iPhone
**Ideal path**: 4 — Attach, pick items, read the notice, send what was accepted.
**Alternate paths**: Attach in two batches; pick via Files instead of the library.
**Design source**: Chips and Composer in `DS-06-Chat.dc.html`. Rejection notice: NO BOARD. Plan: README section 5 ("convert HEIC photos to JPEG first").

### Steps
1. Tap `plus`, choose "Photo library", select the HEIC photo and the screen recording → the HEIC is converted to JPEG on the device and shows as a chip. The recording is rejected as over 10 MiB or as an unsupported type.
2. Read the notice → Expo shows "Skipped {items}" with reasons such as "(over 10 MiB)" or "(unsupported type)". In the native app the place and style of this notice are undefined.
3. Tap `plus` again, choose "Photo library", select the four PNG screenshots → three are added (total 4); the fourth is skipped with "(max 4 attachments)".
4. Type a message and tap Send → four attachments upload, then the message is sent.

### Variations
- Remove one chip, then add the skipped screenshot.
- Share extension path (phase 11): not designed.

### Edge Cases
- A Live Photo or a HEIC larger than 10 MiB after conversion: the size check order (before or after conversion) is not specified.
- Animated GIF over 10 MiB or a zip with unsupported contents: only the declared MIME list is validated.

### Design gaps
- NO BOARD for the "Skipped" notice. Expo shows it as plain text under the composer; no style, position or auto-dismiss rule exists in the native design.
- The spec says HEIC is converted, but no user-visible state ("Converting") is defined for slow conversions.
- Copy for reasons is built by string match in Expo ("over 10 MiB", "unsupported type", "max N attachments", "permission denied"); the boards give none, and the brief says "MB" while Expo says "MiB".

---

## STORY-004: Reply to one message with a quoted snippet
**Type**: short
**Topic**: Sending, attachments and offline
**Persona**: Jordan Lee, operations lead at a 6-person services startup
**Goal**: Answer one specific message in a long thread so the agent knows which one.
**Preconditions**: A thread with an incoming agent message "Thursday 10am is booked. I will send the invite."
**Device**: standard iPhone
**Ideal path**: 4 — long-press, Reply, type, Send.
**Alternate paths**: Quote a selected part of a message (the contract has `replyQuote`; the Select-text sheet in `DS-04-Overlays.dc.html` lets someone select part of a message but no board connects it to Reply); no swipe-to-reply gesture is planned or designed.
**Design source**: `DS-06-Chat.dc.html` "Failed send bubble and reply line" (Reply line) and Composer "Replying to Ana Ruiz" preview; long-press menu: `DS-04-Overlays.dc.html` context menu (Reply, Copy, Select text, Pin, Delete); React is not drawn (Expo uses native menu items "Reply", "React", "Copy").

### Steps
1. Long-press the agent bubble → a native context menu appears with "Reply", "React", "Copy" (Expo labels; board says only "Selection and Copy for whole message are in the long-press context menu (native)").
2. Tap "Reply" → a glass strip appears above the capsule: 2pt bar, author name, one-line snippet, optional 28pt thumbnail, and a dismiss control (`xmark.circle.fill`, 44pt target).
3. Type "Great, please send it." and tap Send → the new user bubble shows a reply line above it with the quoted author and snippet. `threads/send` carries `replyToMessageId` and `replyQuote`.
4. Tap the reply line later → the thread scrolls to the original message.

### Variations
- Dismiss the strip with `xmark.circle.fill` and send as a normal message.
- Reply to an image message: the strip and reply line show a 28pt thumbnail.
- Typing "@" while the reply strip is open: the mention popover replaces the strip position until closed (board rule: "Do not stack the popover and reply preview").

### Edge Cases
- The original message is far above the loaded page: scroll-to-original needs paging; not specified.
- The quoted message was from a member who has since left: the bubble keeps the name (discovery map).

### Design gaps
- NO BOARD for the message long-press menu, for part-message quote, or for the unavailable-original case.
- Whether the reply target survives an app relaunch or posture change is not specified.

---

## STORY-005: Mention a teammate-agent in a group thread
**Type**: medium
**Topic**: Sending, attachments and offline
**Persona**: Aisha Bello, founder of a 4-person climate-data startup
**Goal**: Ask only the Legal agent a question inside the "Funding room" group thread.
**Preconditions**: Group "Funding room" with Finance agent, Legal agent and a human teammate Jordan Lee.
**Device**: iPhone Duo outer
**Ideal path**: 5 — type @, pick member, finish text, Send.
**Alternate paths**: Send without mention so all agents may answer (the group thread shows one working line per agent); open "Members" in the side strip to see who is in the group.
**Design source**: `DS-06-Chat.dc.html` "Mention suggestions" (rows "Finance agent", "Legal agent", "Jordan Lee", typed "@Fi"); `PG-A-GroupThread.dc.html`; `PG-A-Rules.dc.html` Group thread card; Duo outer side strip in `Main.dc.html`.

### Steps
1. Tap "Message Funding room" and type "@" → a glass popover opens above the composer with 44pt rows: 28pt letter tile, name, role ("Agent", "Teammate"). The first row is selected.
2. Type "Le" → the list filters to "Legal agent".
3. Tap "Legal agent" (or press return on the selected row) → the composer inserts the mention and the popover closes.
4. Type " which filings are due this week?" and tap Send → `threads/send` carries `mentions`. The user bubble shows the mention.
5. Observe the response → only a "Legal agent is working" line appears, not one for Finance agent.

### Variations
- Dismiss the popover with Escape (hardware keyboard), a tap away, or by deleting the "@".
- Mention a human teammate (`person.fill` circle); whether that sends them a notification is not defined.
- Mention in a one-to-one thread: the popover behavior in a thread with one agent is not specified.

### Edge Cases
- No match for the typed text: the empty popover state is not designed.
- Mention then edit the name text by hand: how the tag is invalidated is not specified.

### Design gaps
- NO BOARD for the empty popover and for how a mention token looks inside the capsule and inside the sent bubble.
- The scope of `mentions` (agents only, or humans too) is not stated in the brief; "Teammate" appears on the board.

---

## STORY-006: Send fails offline, message waits, then delivers
**Type**: medium
**Topic**: Sending, attachments and offline
**Persona**: Luis Ferreira, founder of a food-supply startup, on a train with patchy signal
**Goal**: Send an instruction while offline and have it go out once the signal returns.
**Preconditions**: Thread with "Ops agent" open; saved chat snapshot exists; device goes into a tunnel.
**Device**: standard iPhone
**Ideal path**: 3 — type, Send, wait for reconnection.
**Alternate paths**: Retry by hand with the "Retry" control; background the app and return.
**Design source**: `DS-06-Chat.dc.html` "Failed send bubble and reply line" and caption states (sending 70% opacity). Offline and queued states: NO BOARD (the discovery map lists "offline (saved snapshots and outbox 'queued')" as a state the brief requires and no board shows).

### Steps
1. Open the thread with no network → the saved chat snapshot shows (last 100 messages). An offline indicator is NO BOARD.
2. Type "Order 40 crates of oats for Friday." and tap Send → the bubble appears at 70% opacity with caption "Sending". The send is stored in the outbox as queued because the server is unreachable.
3. The network returns → the app resends the queued message (the unreachable case "goes back to queued" and is retried automatically; the exact trigger is the reachability subscription seen in `apps/mobile/lib/unsent-sends.ts`).
4. Delivery succeeds → caption changes to "Delivered" and the working indicator for the Ops agent appears.

### Variations
- Rate limit (429): the entry returns to queued rather than failing; the user sees "Sending" until it passes.
- Kill the app while queued: on relaunch the outbox is restored from disk and the send continues.
- Send three messages offline: all three queue in order.

### Edge Cases
- Outbox holds 20 entries and 50 MB. At the cap Expo throws "Too many unsent messages"; how the native composer shows this is NO BOARD.
- The outbox lives in the OS cache directory, which the system may evict; a queued message can silently disappear. No warning is designed.
- The user switches space or signs out with queued messages: Expo scopes entries by server, space and user; the user-visible behavior is not designed.

### Design gaps
- NO BOARD for offline: no banner, no "queued" caption (the board offers only "Sending", "Delivered" and "Not sent"), no stale snapshot marker.
- Treating a message that waits for hours as "Sending" at 70% opacity is misleading; a distinct "Waiting for connection" state is needed.
- Eviction of the cache directory loses queued sends without notice.

---

## STORY-007: A send is refused and the user edits and retries
**Type**: long
**Topic**: Sending, attachments and offline
**Persona**: Nadia Karimi, founder of a 5-person compliance startup
**Goal**: Recover from a failed send of a message with an attachment, then send successfully.
**Preconditions**: Thread with "Legal agent" open; a 9 MiB PDF is attached; the server returns a 4xx (for example payload too large) on the first try.
**Device**: standard iPhone
**Ideal path**: 6 — Send, see Not sent, long-press, edit, Retry, delivered.
**Alternate paths**: Tap "Retry" directly without editing; long-press then "Delete" to discard; reduce the attachment and send a new message.
**Design source**: `DS-06-Chat.dc.html` "Failed send bubble and reply line" (border `#F46262`, row `exclamationmark.circle` "Not sent", "Retry" `arrow.counterclockwise`, long-press "Retry, Delete"). `PG-A-Rules.dc.html` Agent thread card: "Error: inline 'Failed to send message' with retry". Refused-state copy: NO BOARD.

### Steps
1. Attach the PDF, type "Please review the contract.", tap Send → bubble at 70% opacity, caption "Sending".
2. The server rejects with a 4xx other than 408, 425, 429 → the outbox entry becomes refused; the bubble gets a 1px destructive border and a right-aligned row "Not sent" with "Retry" below it. Message text is not red.
3. Tap "Retry" immediately → row shows "Sending", then "Not sent" again because the cause is unchanged.
4. Long-press the bubble → a menu with "Retry" and "Delete". The board says failed text stays editable "on Retry via long-press", but no "Edit" item is listed in the menu.
5. Choose "Delete" → the failed bubble and its stored attachment leave the thread and the outbox.
6. Attach a smaller PDF, retype and tap Send → delivered.

### Variations
- A failed (not refused) send, for example a 500: stored as failed, same bubble and row, Retry allowed.
- Failure that Expo reports as an alert: Expo shows `Alert` "Failed to send message" plus error text, and also saves the entry; the rule card describes an inline message instead. The native app must pick one.
- Refused for "Connect a model to start a run" (no model): see STORY-008.

### Edge Cases
- Refused entries count toward the 20-entry cap until deleted; a thread full of refused entries blocks new sends ("Too many unsent messages").
- A refused send with an attachment: whether Retry re-uploads the artifacts or reuses ids is not specified.
- The "AI data sharing" consent block ("Review AI data sharing in Account settings before continuing.") is also a 4xx and would land here as refused with no way to fix it from the bubble.

### Design gaps
- The refused state looks identical to failed, so the user cannot tell that Retry will never work. The brief defines three outbox states but the board has one "Not sent" row.
- The long-press menu on the failed bubble shows "Retry, Delete" but the text says the message is editable via long-press; the edit action is not in the menu.
- Copy mismatch: rule card says "Failed to send message", component board says "Not sent"; Expo uses "Failed to send message" in an alert.
- NO BOARD for the error reason text (where "payload too large" is shown).

---

## STORY-008: Send with no model connected, then connect one and resend
**Type**: long
**Topic**: Sending, attachments and offline
**Persona**: Ben Adeyemi, a founder trying the self-hosted server for the first time
**Goal**: Understand why the agent is not answering and fix it.
**Preconditions**: New space on a self-hosted server; no model provider connected; thread with "Chief" open.
**Device**: standard iPhone
**Ideal path**: 7 — Send, read error, open settings, connect model, return, Retry.
**Alternate paths**: Connect the model first from Settings, "Models", then open the thread; use a subscription sign-in instead of an API key (see the settings topic).
**Design source**: `DS-06-Chat.dc.html` failed bubble and reply line. The no-model message: NO BOARD. Models setup: `PG-B-Models.dc.html` (settings topic).

### Steps
1. Open "Chief" thread → empty state: agent greeting and suggestions (Agent thread rule card).
2. Type "Draft my weekly update." and tap Send → the server returns "Connect a model to start a run" (README). The README names the string; the server source (`packages/adapters/src/executor.ts`) uses "Connect a model in Settings before running bots." The strings differ, so the exact wording the app shows is TBD.
3. The bubble goes to "Not sent" with "Retry" (or the message is accepted and a run error appears; which of the two happens is not stated).
4. Open Settings from the Home account control → find "Models" (see the settings topic for the route).
5. Connect a provider key or sign in → return to the thread.
6. Tap "Retry" on the bubble → status "Sending", then the working indicator.
7. The reply arrives and the caption reads "Delivered".

### Variations
- Server older than the app (404 on `threads/send` fields): "not supported" handling, no board.
- A message sent while a run is already waiting for an approval: the run state `run.waiting_input` is a different flow (approvals topic).

### Edge Cases
- Model is disconnected while a message is queued offline: the retry later fails with the same error.
- Expo also renders "Waiting for this bot's response." in the thread (line 4257 of `thread.tsx`); its native equivalent is undefined.

### Design gaps
- NO BOARD for the no-model block or any deep link from the error to "Models".
- Message text conflict between README ("Connect a model to start a run") and server ("Connect a model in Settings before running bots.").
- It is unclear whether this is a refused send (Not sent bubble) or a run error (`run.failed`) with no bubble change.

---

## STORY-009: Stop a running agent and send a correction
**Type**: short
**Topic**: Sending, attachments and offline
**Persona**: Emi Tanaka, founder of an e-commerce analytics startup
**Goal**: Interrupt a long agent run that is going the wrong way and redirect it.
**Preconditions**: "Research agent" is working on a task started a minute ago.
**Device**: standard iPhone
**Ideal path**: 3 — tap Stop, type a correction, Send.
**Alternate paths**: Stop from the Live Activity or notification (phase 11, no board); type the correction without stopping and send (queued behind the run: behavior not defined).
**Design source**: `DS-06-Chat.dc.html` Composer "Agent running (Stop)" and "Working indicator and agent event label"; `PG-A-Rules.dc.html` Agent thread card ("a stop control in the composer").

### Steps
1. The composer's trailing slot shows Stop (`stop.fill`) in the same prominent position as Send → tap it.
2. The client calls `threads/stop`; the working indicator disappears, the trailing slot returns to the mic, and an event note may appear (cancelled run).
3. Type "Focus on EU competitors only." and tap Send → bubble "Sending" then "Delivered"; the agent starts a new run.

### Variations
- In a group thread, several agents work at once; one Stop control ends the thread's runs (the contract takes a thread target; per-agent stop is not designed).
- Stop fails: Expo shows an alert "Failed to stop work" with "Try again."; the native version must keep that.

### Edge Cases
- The run finishes while the user taps Stop: the button turns back into the mic first; the tap may land on Dictate.
- If text is already typed, the slot must show Send or Stop, not both; the board says "Stop in the same prominent slot" while the user has text. Which wins is undefined.

### Design gaps
- Conflict: with text typed and an agent running, the one trailing slot cannot be both Send and Stop.
- NO BOARD for the "stopping" intermediate state and for a stop failure.
- No board for "Work stopped, but the thread could not refresh" (Expo message).

---

## STORY-010: React to an agent message
**Type**: short
**Topic**: Sending, attachments and offline
**Persona**: Carlos Mendez, founder of a pet-supplies startup
**Goal**: Mark an agent's answer as useful with a thumbs up, then change it.
**Preconditions**: Agent message present in an open thread.
**Device**: standard iPhone
**Ideal path**: 3 — long-press, React, pick emoji.
**Alternate paths**: none found (no double-tap shortcut is planned).
**Design source**: NO BOARD. Long-press menu and reaction picker are not in `DS-06-Chat.dc.html`. Behavior from `packages/contracts/src/reactions.ts` and `threads.react`.

### Steps
1. Long-press the agent bubble → native context menu with "Reply", "React", "Copy".
2. Tap "React" → a picker with the six fixed reactions (thumbs up, thumbs down, heart, laugh, party, surprised). Picker design is NO BOARD.
3. Tap thumbs up → the reaction shows under the bubble after `threads/react` returns and `thread.message.reaction` arrives by SSE.

### Variations
- Tap the same reaction again to remove it (assumed from Expo; not confirmed in the brief).
- Another member reacts: the event updates the thread live.
- Offline: reactions are not in the outbox (README says nothing works offline except the outbox), so the tap fails.

### Edge Cases
- Failure shows Expo's alert "Could not update reaction" with "Try again."; native copy is not defined.
- Reactions on a message from a removed member: not specified.

### Design gaps
- NO BOARD for reaction picker, the reaction display under a bubble, or the "mine vs others" state.
- No optimistic or offline behavior is specified.

---

## STORY-011: Long founder session across attachment, reply, failure and recovery
**Type**: long
**Topic**: Sending, attachments and offline
**Persona**: Sofia Marin, founder of a 3-person fintech startup, prepping a board update
**Goal**: In one session, gather documents for the Finance agent, ask questions, survive a connection drop, and end with a reply she trusts.
**Preconditions**: Signed in, model connected, thread with "Finance agent" open, three PDFs and one HEIC screenshot ready.
**Device**: standard iPhone, later moved to iPhone Duo inner display (flat)
**Ideal path**: 22 — about 22 taps for a complete session.
**Alternate paths**: Put the files in the Data room first and ask the agent to read them (Data room topic); send each file as its own message.
**Design source**: `DS-06-Chat.dc.html` (Composer, chips, failed bubble, reply line, working indicator); `PG-A-Thread.dc.html`; inner layouts in `Inner.dc.html` and the Agent thread rule card; offline, notices and menus: NO BOARD.

### Steps
1. Open the "Finance agent" thread → saved snapshot shows, then the latest page replaces it.
2. Tap `plus` → "Photo library" → pick the HEIC screenshot → converted to JPEG, chip appears.
3. Tap `plus` → "File" → pick `board-deck.pdf` → second chip.
4. Tap `plus` → "File" → pick `q3-summary.pdf` → third chip.
5. Tap `plus` → "File" → pick `cap-notes.pdf` → fourth chip (the limit).
6. Tap `plus` again → the menu still opens; picking any file shows "(max 4 attachments)".
7. Type "Summarize runway risks from these." and tap Send → four uploads then the send; bubble at 70%, caption "Sending".
8. Signal drops during step 7 → the entry is queued; the user keeps reading.
9. Signal returns → delivered; "Finance agent is working" appears with Stop.
10. The reply arrives with a table; tap Expand on the table → full-height sheet opens.
11. Close the sheet; long-press the reply → "Reply".
12. Type "What if hiring slips two months?" and tap Send → reply line quoted above the new bubble.
13. The send is refused (rate or size) → "Not sent" with "Retry"; tap "Retry" → delivered.
14. Open the inner display (unfold) → the thread appears in the 2/3 pane with Personnel in the 1/3 pane; the composer text, chips and queue state must carry over.
15. Long-press the final reply → "React" → thumbs up.

### Variations
- App backgrounded during upload: whether uploads continue in the background is not specified (60 s upload timeout in the brief).
- Hide amounts device setting on: finance cards in chat respect it; plain agent text does not.

### Edge Cases
- Posture change while chips and an unsent draft are in the composer: not specified (discovery map: "how selection and scroll position survive these changes").
- Cache eviction of the outbox during the long session.

### Design gaps
- NO BOARD for offline, queued waiting, upload progress, the Attach menu, the long-press menu, reaction picker, or posture-change continuity of the composer.
- Attachment total (4 files, up to 40 MiB of base64) against the 50 MB outbox cap leaves room for about one such message; no warning is designed.

---

## STORY-012: First message to an agent from the empty thread with a suggestion
**Type**: short
**Topic**: Sending, attachments and offline
**Persona**: Hannah Cole, a founder who just created her first bot "Chief"
**Goal**: Start a conversation using a suggested prompt.
**Preconditions**: New bot, thread has no messages.
**Device**: standard iPhone
**Ideal path**: 2 — tap a suggestion, then Send (assuming a suggestion fills the composer; if it sends directly the path is 1, but the board does not say).
**Alternate paths**: Type your own first message; tap the mic and dictate.
**Design source**: `PG-A-Rules.dc.html` Agent thread card ("Empty: agent greeting and suggestions"). The suggestion chips themselves: NO BOARD.

### Steps
1. Open the new thread → agent greeting and suggestions show above the composer.
2. Tap a suggestion → either the text fills the composer or it sends at once; not defined.
3. Tap Send if needed → the bubble appears, working indicator follows.

### Variations
- Dictation: tap the mic, speak, tap the mic again; text appears in the capsule (Listening state in DS-06).
- Speech permission denied: Expo shows "Allow speech recognition in Settings, or connect ElevenLabs, OpenAI, or Fish Audio."

### Edge Cases
- No model connected: see STORY-008.

### Design gaps
- NO BOARD for the suggestion chips and no rule for tap behavior (fill versus send).
- The empty thread is described only in the rule card text.
