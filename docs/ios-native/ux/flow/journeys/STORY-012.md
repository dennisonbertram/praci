# Journey: open the app, reach an agent, send with an attachment, recover offline

Stories merged: STORY-012 (open the app and reach an agent; source `home-and-spaces.md` STORY-H01), STORY-024 (open a busy thread; source `agent-thread.md` STORY-001), STORY-031 (attach and send; source `agent-thread.md` STORY-008), STORY-032 (send while offline; source `agent-thread.md` STORY-009).

Evidence: Swift code in `apps/ios/Sources/Praci` and the topic files named above. No device walk was done. Each claim is tagged "measured from code" (M) or "suspected - needs device walk" (S). Persona: Maya, three agents, a contract PDF to send, a weak signal.

Verdict: **acceptable**. Reaching an agent is already minimal (one tap). Sending is close to the ideal. The friction is in the edges: a global offline line that can mislead, a refused message that cannot be edited, a few controls that cost nothing to cut, and no draft kept.

## 1. Friction scorecard

| Phase | Actual | Story ideal | Evidence |
|---|---|---|---|
| Open app to agent (STORY-012, STORY-024) | 1 tap on the agent row after Home loads; thread lands on the newest message with no scroll | 2 | M `HomeScreen.swift:179-188`, `ThreadScreen.swift:90` (`defaultScrollAnchor(.bottom)`). Already minimal. |
| Attach a file and send (STORY-031) | 5 to 6: "+", "Files" (or "Photo Library"), pick in the system picker, tap field, type, Send | 4 | M `ComposerView.swift:72-84,36-43,103-111`. One extra tap is the source menu; the field tap is implicit in the story. |
| Send offline (STORY-032) | 2: type, Send. Recovery needs 0 taps. | 2 | M `ComposerModel.swift:88-108`, `SendQueue.swift:162-167` (retries every 5 seconds). Already minimal. |

Decisions: choosing the source (Photo Library vs Files) is the only forced one. Everything else is optional. The source choice cannot be defaulted: it depends on the file.

Re-entry: none on the happy path. After an offline refusal the user retypes the message (M `PendingSendsView.swift:73-79`, STORY-009 variation: "the text is not put back in the field"). A draft is lost on leaving the thread (M catalog finding 53; `ComposerModel` is owned by the thread model). Photos are all named "Photo.<ext>", so two attached photos look identical in the chip row (M `ComposerView.swift:167`, chip name cut at 140 pt, line 140).

Confirmations guarding nothing destructive: none in this journey. "Delete" on a pending bubble acts at once with no dialog (M `PendingSendsView.swift:30,77`), which is correct. The thread's "Archive agent" confirmation (M `ThreadScreen.swift:35-39`) is out of scope.

Dead ends:
1. A refused send (for example, no model connected) shows a red bubble with "Not sent: <message>" and only a Delete button (M `PendingSendsView.swift:73-79`). There is no Edit or Retry, and the cause is not actionable from the bubble.
2. The offline banner has no action and no detail; it only explains (M `ComposerView.swift:22-26`).
3. After an upload failure on a large attachment, the bubble reads "Not sent" with Retry; nothing says which part failed (M `PendingSendsView.swift:63-72`; S whether the message is useful).

Hesitations (S, device walk needed unless noted):
- "Sending" is the caption for the whole upload plus send, with a 60 second timeout per file (M `SendQueue.swift:180-181`). With a 10 MB PDF on a weak connection the user sees one word for a long time and no progress.
- The mic button turns into Send only when text or an attachment exists (M `ComposerView.swift:100-111`); a user who attached a file may not notice the swap. Not a problem with a normal chip row.
- The Return key sends (M `ComposerView.swift:39-40`), so a multi-line message cannot be typed (catalog finding 53).
- The "Offline. Messages send when you reconnect." line appears only after a send attempt fails (M `SendQueue.swift:165`), so a user who opens a thread offline sees nothing wrong until they send. Meanwhile the thread's live stream is down with no sign (STORY-009 edge cases; catalog finding 38).
- The same line is global to the queue, not to the thread, and can show on a thread with nothing pending (M `ComposerView.swift:22` reads `SendQueue.shared.offline`).
- Stuck banner (S): `offline` is set only at the end of each delivery try (M `SendQueue.swift:165`). If the user deletes the only pending message while offline, the loop ends without clearing the flag, so the banner may stay until the next successful send.

## 2. Take-away pass per screen

1. Home (`HomeScreen.swift`).
   - For a returning user the first thing on screen is the Inbox row (M lines 119-130), then Pinned, then Agents. The question for this journey is "which agent needs me", and the agent rows carry the answer (unread dot, "Needs you", "Working"; M `HomeRows.swift:27,38-44`). Inbox first is reasonable for a mail product; do not move it.
   - Pages section (M lines 191-231) is useful but sits below the fold on a full agent list; leave as is.
   - Info repeated: the row shows the time and the unread dot on the same line (M `HomeRows.swift:24-30`). Fine.
2. Thread (`ThreadScreen.swift`).
   - Toolbar: a Call button plus an ellipsis menu with five entries (M lines 198-233). "Open computer", "Artifacts", "Agent page" and "Settings" are secondary destinations; they are correctly hidden in the menu. Nothing removable.
   - "Jump to latest" overlay uses a fixed 80 pt offset (M line 135), so it can sit under a tall composer (catalog finding 53).
3. Composer (`ComposerView.swift`).
   - One primary action: the round Send button. OK.
   - Chips: remove "x" is a 44 pt target; fine.
   - Removable: the "Cancel reply" strip is only present when replying; OK.
   - The "+" menu has two entries and a Camera entry is absent (STORY-008 alternate paths); not needed to cut anything.
4. Pending bubble (`PendingSendsView.swift`).
   - States shown: "Waiting to send", "Sending", "Not sent" with Retry, "Not sent: <reason>" with Delete (lines 57-80). The Retry/Delete actions also exist in a long-press menu (lines 24-33): two routes to the same action. Keep the visible button; the menu is the accelerator.
   - Once and only once: while offline the user sees "Waiting to send" under the message and also "Offline. Messages send when you reconnect." above the composer. The second line says what the first already says for this message.

## 3. The simpler version

Journey as it should be (open to offline recovery), counting from a warm launch:

1. Launch. Home appears with the agent that needs Maya at the top ("Needs you" or unread).
2. Tap the agent. The thread lands on the newest reply.
3. Tap "+", pick Files, pick the PDF in the system sheet. A chip appears.
4. Type the instruction and tap Send. The bubble shows a progress state for the upload ("Sending 1 of 1") and then becomes a normal message.
5. If there is no signal: the bubble shows "Waiting to send". No banner is needed. It sends by itself.
6. If the server refuses it: the bubble shows the reason and an "Edit" action that puts the text and files back into the composer.

Changes to get there:
- Drop the global offline line in favor of the per-message caption, or scope it to threads that have pending messages (JA-13).
- Clear the offline flag when the queue is empty (JA-14).
- Offer "Edit" on a refused bubble, and restore the text and files to the composer (JA-15).
- Keep the draft per thread across Back (JA-16).
- Name photos by date so chips differ (JA-17).
- Show upload progress in the caption for large files (JA-18).
- Let the user type a line break (JA-19).

## 4. Clarity issues

- "Offline. Messages send when you reconnect." is clear, but it speaks about the device rather than the thread, and appears after a failure only. A user who is offline and has not sent anything sees no sign.
- "Waiting to send" vs "Sending" vs "Not sent": three words for three states, all clear. "Not sent" with only Retry gives no cause; "Not sent: <server message>" depends on server wording and may be technical (S).
- "Photo.jpg" is a poor label for a user's chosen photo (M `ComposerView.swift:167`).
- "Attach" is the accessibility label; the visible control is "+", which matches iOS Messages. Fine.
- Home row subtitle "Needs you" vs "Working": clear. "Needs you" is the one phrase that tells the user which agent to open (M `HomeRows.swift:40`).
- "Agents" vs "Pinned" vs custom sections: consistent with the rest of the app.

## Proposals

| Id | Problem and evidence | Proposal | Steps saved | Risk | Size | Device walk |
|---|---|---|---|---|---|---|
| JA-13 | The offline line is global to the send queue, appears after a failed try only, and repeats the per-message "Waiting to send" caption (M `ComposerView.swift:22-26`, `PendingSendsView.swift:59-60`, `SendQueue.swift:165`; catalog finding 38). | Show it only on a thread that has a queued message, or drop it and keep the caption. | 0 (removes a repeated line) | Low; some users like a connectivity cue | S | y |
| JA-14 | `offline` is not cleared when the queue empties by deletion, so the banner can stay (M `SendQueue.swift:162-167`; S behavior). | Set `offline = false` when the drain loop exits with no queued attempts. | 0 (removes a false state) | Low | S | y |
| JA-15 | A refused bubble offers only Delete, so the user retypes the text and reattaches files (M `PendingSendsView.swift:73-79`). | Add "Edit" that moves the payload back into the composer and removes the bubble. | 2 to 4 per refused message | Low; the attachments must stay on disk until sent | M | y |
| JA-16 | A draft is lost when the user leaves the thread (M catalog finding 53; STORY-008 edge case). | Keep the draft per thread in memory (or on disk) and restore it on reopen. | up to 5 after an accidental Back | Low; draft files must not outlive a sign-out | M | y |
| JA-17 | Photos are all named "Photo.<ext>", so chips are indistinguishable (M `ComposerView.swift:167`). | Use the asset's date and time (for example "Photo 14-32.jpg"). | 0 (clarity) | Low | S | n |
| JA-18 | The whole upload and send shows "Sending" with a 60 second per-file timeout (M `SendQueue.swift:180-181`, `PendingSendsView.swift:62`). | Show "Uploading 1 of 2" for attachment sends. | 0 (clarity) | Low | M | y |
| JA-19 | Return sends, so no line break can be typed (M `ComposerView.swift:39-40`; catalog finding 53). | Remove `onSubmit` send for multi-line text, or send on a hardware Return only. | 0 (removes a limit) | Medium; behavior change for existing users | S | y |
| JA-20 | Attachment needs a separate source choice, one extra tap (M `ComposerView.swift:72-84`). | Leave as is; the choice cannot be defaulted. Listed so the count is on record. | 0 | None | n/a | n |
