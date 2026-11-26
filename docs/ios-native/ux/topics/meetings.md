# Topic: Meetings

Status: stories written from the built SwiftUI code in `apps/ios/Sources/Praci/Meetings` and `Packages/RakazoCore/.../Meetings`. Nothing was run on a device or simulator, so every "expected result" is what the code does, not something observed. All people and data are invented.

Facts that apply to several stories:

- Meetings is a Home page row ("Meetings", waveform icon, id `pageMeetings`). It is hidden when `boot.me.hiddenPages` contains `meetings`. Deep links: `rakazo://open/meetings` and `rakazo://open/meeting/<id>`.
- The list (`MeetingsScreen`) title is "Meetings", with a `.searchable` field. Each row shows the title and a footnote "Oct 29, 9:00 AM · 45 min · Granola". The source name is one of Praci, Hex, Granola, Omi, or the raw provider id. The minute count is hidden while the end time is unknown.
- The "Record" toolbar button appears only when the space policy is not `off` and nothing is recording or starting (`app.capture.isBusy`).
- Policies: `remind` shows the footer "Tell everyone you're recording."; `confirm` shows the toggle "Everyone agreed to be recorded" and disables Start until it is on; `off` hides Record.
- The Record sheet replaces its form with a single row "Add speech to text" (opens Voice settings) when the server cannot transcribe (no hosted provider, or no consent to transcription).
- The recording bar (`RecordingBar`) is an inset above the root and every pushed screen. It shows a red dot, the title (or "Recording"), a live timer and a "Stop" button. After Stop it shows "Transcribing…" and no timer or button. It adds the line "Offline, saved here" while chunk uploads fail. It is not part of sheets, so it is not visible over Settings or the Record sheet.
- While a recording runs, the dictation mic (composer) and the voice call phone button are disabled.
- A summary is produced by the server a little after the recording is stored. The detail screen polls every 5 seconds for up to 10 minutes after the end time.
- Server-side follow-ups (no iOS screen of their own): a fresh meeting is filed as a Markdown note in Data room > Recordings, and the agent that reads the meeting's source (the Hex agent for Praci recordings) is woken once and posts a server-written "Summarizing your new meeting" line, with a link to the Recordings item, in its thread. The iOS Data room and thread screens render these like any other item and message; whether the thread link opens the Data room item natively is not verified in code.
- Meeting detail has no share, rename or export action. Delete is the only toolbar action.

## STORY-001: Record a team call with the default reminder
**Type**: medium
**Topic**: Meetings
**Persona**: Priya Raman, founder of a 5-person freight-software startup
**Goal**: Record a vendor call and get a summary without leaving the app.
**Preconditions**: Signed in. A hosted voice provider with transcription is set up and consented to. The space policy is `remind`. Microphone permission not yet decided. No other recording.
**Ideal path**: 4. Tap Record, type nothing, tap Start (grant the mic once), later tap Stop. The title defaults, so no typing is required.
**Alternate paths**: none found. Record exists only on the Meetings list toolbar; Home has no Record shortcut, and there is no deep link that starts a recording. (The web twin has its own Record control.)

### Steps
1. On Home tap the "Meetings" row → the Meetings list opens, title "Meetings", with a "Record" button at top right.
2. Tap "Record" → a short sheet (about 230 pt) opens with a "Title" field (placeholder "Meeting 2:05 PM"), the footer "Tell everyone you're recording.", Cancel at left and Start at right.
3. Priya leaves the title empty and says "Hi everyone, I'm recording this call" aloud, then taps "Start" → the app asks for microphone access; she allows it. The sheet closes. The recording bar appears above the list with a red dot, "Meeting 2:05 PM" and a running timer.
4. She taps Back to Home and opens a bot thread to check a note → the bar stays visible above Home and the thread.
5. The call ends. She taps "Stop" on the bar → the dot dims and the bar reads "Transcribing…"; timer and Stop disappear.
6. After the server stores the meeting, the list reloads (it is on screen) and the new meeting opens by itself → Meeting detail shows the subtitle "Nov 3, 2:05 PM · 31 min · Praci" and "Summarizing…".
7. She waits; the screen reloads every 5 seconds → the summary text appears, then "Decisions", "Follow-ups" and "Your to-dos" sections as they arrive.

### Variations
- She starts Record while on a different screen than Meetings: not possible, the button is on the list only. Stop is the only control elsewhere.
- She types a title ("Vendor call, Harbor Freight") → the bar and list use it.
- When Stop finishes while she is on another screen, no meeting opens: the auto-open only happens when the Meetings list is the top screen (`app.path.last == .meetings`). She sees the bar vanish and nothing else (no toast or push).

### Edge Cases
- Mic denied at the prompt: Start fails and the sheet footer shows "Allow microphone access in Settings to record meetings." in red. The sheet stays open. There is no button to Settings in the sheet.
- Nothing recorded (Stop within a second): the meeting may still be stored or may not appear; unverified.
- Screen locked mid-recording: the app declares the audio background mode, so recording continues (not verified on a device).

## STORY-002: Record when the space requires everyone's agreement
**Type**: short
**Topic**: Meetings
**Persona**: Tomás Herrera, operations lead at a 12-person clinic-software company
**Goal**: Start a recording in a space whose policy is `confirm`.
**Preconditions**: Policy `confirm`. Transcription available. Mic allowed.
**Ideal path**: 3. Tap Record, switch on the agreement, tap Start.
**Alternate paths**: none found.

### Steps
1. On the Meetings list tap "Record" → the sheet is taller (280 pt) and shows "Title" and a switch "Everyone agreed to be recorded". There is no "Tell everyone" footer. Start is dimmed.
2. Tomás asks the room, then turns the switch on → Start becomes active.
3. Tap "Start" → recording begins; the bar appears. The app sends `consentConfirmed: true` to the server with the start call.

### Variations
- He taps Start with the switch off: cannot; the button is disabled and there is no message explaining why besides the visible switch.
- The space owner changes the policy to `off` while the list is open: the Record button stays until the list reloads options (options load on screen appear only). If he taps it and the server refuses, the sheet footer shows the server's error in red.

### Edge Cases
- The switch is not remembered. Each recording asks again.
- A server refusal ("A recording is already running." from another device or an earlier start) shows as the red footer; the sheet stays open.

## STORY-003: Record is offered but the server cannot transcribe
**Type**: medium
**Topic**: Meetings
**Persona**: Ines Duarte, new user who has connected a model but no voice provider
**Goal**: Record a meeting and find out why she cannot yet.
**Preconditions**: Policy `remind`. No hosted voice provider, or transcription not consented.
**Ideal path**: 6. Record, "Add speech to text", choose and consent to a provider, Back, Back to the sheet, Start. The setup cannot be shorter than this because it is a provider choice, but "Record" could say why it needs setup before opening a sheet.
**Alternate paths**: Settings gear on Home → Voice → the same provider screen, before ever tapping Record. Home "Connect a model" is a different (model) setup and does not fix this.

### Steps
1. Open Meetings and tap "Record" → the sheet shows a single list row "Add speech to text" with a disclosure arrow and a Cancel button. No title field, no Start.
2. Tap "Add speech to text" → Voice settings (`VoiceSettingsScreen`) open inside the sheet.
3. She picks a hosted voice provider and gives consent → the provider shows as ready.
4. Tap Back → the sheet reloads its options (`onAppear`) and shows the normal form with Title and Start.
5. Tap "Start" → recording begins.

### Variations
- She sets up the provider from Settings first: the sheet opens straight to the form.
- She turns "transcription" off again later: next Record shows "Add speech to text" again.

### Edge Cases
- Options still loading when she taps Record: the sheet body is empty for a moment (no spinner). If `bootstrap` fails, it stays empty and she must Cancel by swiping down (there is no toolbar in this state).
- The row text says what to add, but not that this is required for recording; a first-time user may not know what "speech to text" will be used for.

## STORY-004: Search the Meetings list and open an older meeting
**Type**: short
**Topic**: Meetings
**Persona**: Naledi Mokoena, chief of staff at a 20-person fintech
**Goal**: Find last month's investor call.
**Preconditions**: More than 20 meetings from Granola, Hex and Praci, so the list pages.
**Ideal path**: 3. Pull the search field, type a word, tap the row.
**Alternate paths**: Ask an agent in a thread (not a Meetings feature). Data room > Recordings holds the same meetings as Markdown notes with its own search, and the Data room search finds text there too. No search inside a single meeting's transcript.

### Steps
1. Open Meetings → the list loads; rows show the title and "Oct 12, 4:00 PM · 52 min · Granola".
2. Scroll to the bottom → the last row triggers `loadMore` and older meetings append without a spinner or end marker.
3. Tap the search field and type "board" → after 250 ms the list reloads (`meetings/list` with `q`); results replace the list.
4. Tap the row "Board prep with Rowan" → the meeting detail opens.

### Variations
- No match: the screen shows the system "No Results for "board"" view. There is no "Clear" button besides the search field's own cancel.
- No meetings at all: "No meetings" with a waveform icon. There is no hint that Record or connected sources create them.
- Offline on first load: the list shows a failure state with Retry (`LoadableView`). Offline after a first load: the old list stays and no message appears.

### Edge Cases
- Typing quickly: each keystroke cancels the earlier wait; an older slow response never replaces a newer one (generation check).
- Pull to refresh while a search is active reloads the search results, not the whole list.
- Whether search matches transcript text or only titles is decided by the server and not visible on the screen.

## STORY-005: Read a finished meeting and tick off a to-do
**Type**: medium
**Topic**: Meetings
**Persona**: Naledi Mokoena
**Goal**: Check what was decided and mark an action as done.
**Preconditions**: A stored meeting with a summary, two decisions, one follow-up, two to-dos (one with a due date) and a transcript.
**Ideal path**: 3. Open the meeting, scan, tap the circle on the to-do.
**Alternate paths**: The meeting to-do is saved through `inbox/todos/setDone`, the same call as Inbox to-dos, so it may also show in the Inbox "To do" card (not verified). Otherwise none found.

### Steps
1. Open the meeting from the list → title in the navigation bar; the first block shows "Oct 29, 9:00 AM · 45 min · Granola" and the summary paragraph.
2. Scroll → sections "Decisions", "Follow-ups" and "Your to-dos".
3. Tap the circle next to "Send revised term sheet to Rowan" (due label, for example "Fri") → the circle becomes a filled check and the text is struck through at once; the server call runs in the background.
4. Tap the circle again → it clears.
5. Scroll to the end and tap the "Transcript" disclosure row → the transcript expands as selectable footnote text.

### Variations
- A meeting with no summary yet and no decisions shows only the subtitle (stored but not summarized, older than 10 minutes): the screen looks empty, with no explanation.
- A Granola meeting detail is identical, plus a different delete message.
- A meeting with `partial` set shows "Part of this meeting could not be transcribed." in red above the summary.

### Edge Cases
- The save fails (offline): the circle flips back and an alert "Couldn’t save that" with the server message and "OK" appears.
- The circle is 44 pt with VoiceOver label equal to the to-do text and value "Done"/"Not done". Tapping the text itself does nothing; only the circle toggles.
- The transcript is hidden inside a disclosure and is not searchable or shareable except by text selection.
- Pull to refresh reloads the meeting. Unsaved state does not exist.

## STORY-006: Wait for a summary, then see it appear
**Type**: medium
**Topic**: Meetings
**Persona**: Priya Raman
**Goal**: Confirm that a just-recorded call turns into a summary and a Recordings note.
**Preconditions**: A Praci recording just stored (end time less than 10 minutes ago). The Hex agent exists and has a model.
**Ideal path**: 2. The meeting opens by itself after Stop, and the summary appears by itself. After that the user should be told in one place where the notes went.
**Alternate paths**: Open Home > the Hex agent thread to find the server-written "Summarizing your new meeting" line with a link to the Recordings item (see facts). Open Data room > Recordings to find the note directly. Reopen Meetings later.

### Steps
1. After Stop, the meeting detail opens (Meetings list was on top) → the subtitle row and "Summarizing…" in gray text.
2. She leaves the screen open for about a minute → polling reloads every 5 seconds; "Summarizing…" disappears when the summary, decisions, follow-ups or to-dos arrive.
3. She goes Back to Home and opens the Hex agent thread → the thread shows the server's "Summarizing your new meeting" line, then the agent's follow-up message when it has finished (the agent is woken once per meeting).
4. She opens Data room, then the folder "Recordings" → a Markdown note named after the meeting is there, with preview text and Open. It holds the summary, digest and transcript.

### Variations
- She leaves detail before the summary arrives: polling stops with the screen. Reopening the meeting loads the current state.
- The agent has no model set or is archived: no thread line appears; the Recordings note is still filed. She sees no explanation of why the thread stayed silent.
- She had already opened the meeting before the wake: the server skips waking the agent (the owner already read it), so no thread message appears.

### Edge Cases
- After 10 minutes with no summary the screen stops saying "Summarizing…" and polling stops; a failed summary looks the same as a meeting with no content.
- A meeting older than 24 hours that syncs in (backlog) is treated as not fresh: no Recordings note and no agent wake.
- Deleting the meeting later removes its Recordings note on the server for sources that mark it deleted; the Data room list in the app only updates on its own refresh.

## STORY-007: Stop and wait while the recording is being stored
**Type**: medium
**Topic**: Meetings
**Persona**: Tomás Herrera
**Goal**: Stop a recording on a weak connection and trust that it is saved.
**Preconditions**: Recording in progress, 40 minutes. The phone drops to no connection for a few minutes.
**Ideal path**: 1 action (Stop); the rest should be automatic.
**Alternate paths**: none found. The only controls for a recording are the bar's Stop and, before it starts, the Record sheet's Cancel. There is no Pause and no Discard.

### Steps
1. During the call the connection drops → chunk uploads fail; the bar adds "Offline, saved here" under the title. Recording continues.
2. The connection returns → the next upload pass succeeds; the extra line disappears.
3. The call ends. He taps "Stop" → bar becomes "Transcribing…"; remaining chunks upload; the app tells the server the recording ended.
4. The app asks the server every 2 seconds until the recording leaves the active list, then finds the meeting by start time and clears the local files.
5. The bar disappears. If he is on the Meetings list, the meeting detail opens.

### Variations
- He presses Stop while still offline: the bar stays on "Transcribing…" and the app keeps retrying every few seconds. The bar shows "Offline, saved here" only when not transcribing (`RecordingBar` checks `transcribing` first), so after Stop it never says it is waiting for the connection. Unverified on a device.
- He backgrounds the app after Stop: the finish runs inside a background task. If time runs out, work stops and the files stay on the phone; the next foreground or launch finishes it (`resume`).
- He force-quits mid-recording and opens the app again: `resume` picks up the leftover recording, drops the half-written chunk, and finishes it; the bar appears at once as "Transcribing…".

### Edge Cases
- The server closed the recording meanwhile (for example the session limit): the bar disappears and an alert "This recording was closed and could not be saved." appears with OK. The local files are deleted, so the audio is lost.
- Another recording is started by tapping Record while "Transcribing…" is showing: Record is hidden while the bar shows (isBusy).
- There is no visible progress for the upload, only the dimmed dot.

## STORY-008: A call or Siri interrupts the recording
**Type**: short
**Topic**: Meetings
**Persona**: Naledi Mokoena
**Goal**: Keep one recording going through a phone call and an AirPods disconnect.
**Preconditions**: Recording in progress for 10 minutes.
**Ideal path**: 0 extra actions. The recording resumes by itself.
**Alternate paths**: none found.

### Steps
1. A phone call comes in and she answers → the audio session is interrupted; the current audio chunk is closed and the gap is recorded. The bar keeps its timer running.
2. She hangs up → the recorder restarts the audio engine and continues in a new chunk.
3. Later her AirPods die → the old route disappears; the recorder restarts on the phone microphone.

### Variations
- The system resets media services: a new audio engine is started.
- Audio cannot restart: the recorder reports failure and the app stops and stores what it has (`onFailure` → `stop()`), so the bar changes to "Transcribing…" without her action.

### Edge Cases
- The timer on the bar counts wall-clock time from the start, so it includes the call time even though no audio was captured then. The meeting minutes in the list also come from start to end time.
- She is not told that a gap happened. The only notice anywhere is the transcript or a "Part of this meeting could not be transcribed." line, if the server marks the result partial.
- If she also starts a voice call to a bot (phone icon) during the recording: the button is disabled while recording.

## STORY-009: Delete a meeting
**Type**: short
**Topic**: Meetings
**Persona**: Tomás Herrera
**Goal**: Remove a recording made by mistake.
**Preconditions**: A stored meeting, either Praci or Granola.
**Ideal path**: 3. Open it, tap Delete, confirm.
**Alternate paths**: none found. The list has no swipe action or context menu for delete; it is available only inside the detail screen.

### Steps
1. Open the meeting from the list → detail with "Delete" (red text) in the top right.
2. Tap "Delete" → a confirmation dialog titled `Delete "Weekly sync"?` with the message "Removes this meeting and its to-dos from Praci." and a red "Delete" button.
3. Tap "Delete" → the meeting disappears and the detail pops off the stack back to the list. The list shows the row removed only after it reloads; the list does not reload by itself on return, so the row may still show until pull to refresh or the next load (unverified).

### Variations
- A Granola meeting: the message adds "Your note in Granola is not changed." The sentence appears only for Granola; Hex and Omi meetings use the short text even though they too are copies.
- He taps outside the dialog: nothing is deleted. There is no Cancel button label because the system dialog adds one.

### Edge Cases
- Delete fails: an alert "Couldn’t save that" with the server message and OK. "Couldn’t save that" is the same title used for failed to-do saves, so it does not say that a delete failed.
- The deleted meeting's Recordings note in the Data room is removed by the server for sources that mark it deleted; that is not mentioned in the confirmation text.
- Deleting is permanent; there is no undo toast (other screens like Archive have one).

## STORY-010: Open a meeting from a deep link and from the Hex agent thread
**Type**: short
**Topic**: Meetings
**Persona**: Priya Raman
**Goal**: Jump from a message about a meeting to its detail.
**Preconditions**: Signed in. A link `rakazo://open/meeting/<id>` or the thread line "Summarizing your new meeting".
**Ideal path**: 1. Tap the link.
**Alternate paths**: Home > Meetings > row. Data room > Recordings > the note (a copy of the content in Markdown, not the interactive detail).

### Steps
1. She taps the link in another app → Praci opens and `Route.meeting(id:)` is pushed onto the path; the detail loads.
2. She taps Back → she lands on the screen below in the stack, which is Home (the Meetings list is not inserted), so she must tap Home's Meetings row to see the list.

### Variations
- She taps the link while signed out: the route is queued in the path; after sign-in the meeting may open (the discovery doc flags this as unverified).
- The link points at a deleted meeting: the detail shows the failure state with Retry; Retry will fail again.
- She taps the server-written thread link: the thread renders the text; if the link is the Recordings item, it opens the Data room item (to verify).

### Edge Cases
- The same meeting content is shown on three surfaces: Meetings detail (structured), Data room > Recordings note (Markdown), and the source agent's thread message. Edits to the to-dos happen only in the detail.

## STORY-011: Recording while using the rest of the app
**Type**: long
**Topic**: Meetings
**Persona**: Priya Raman
**Goal**: Run a 45-minute call while reading mail, asking an agent a question and checking Settings.
**Preconditions**: Recording in progress (STORY-001). Inbox connected.
**Ideal path**: 0 extra actions for the recording. The bar should never be in the way.
**Alternate paths**: none found. Settings is a sheet, so the bar is not shown while it is open; the only way to Stop from there is to close it.

### Steps
1. From Meetings tap Back → Home shows the bar above the bottom edge; Home rows are unchanged.
2. Open Inbox → the bar stays above the mail list. She opens a message and archives it.
3. Open a bot thread and type a question; she taps the mic button → it is disabled during recording, so she types instead.
4. In the thread she taps the phone icon → it is disabled; no message says why.
5. She taps the gear → Settings opens as a sheet. The bar is not visible in the sheet. She closes it and sees the bar again.
6. She opens Compose in the Inbox and then closes it → the bar returns on the root.
7. A push notification arrives about an approval; she taps it → the app opens that thread, the path resets to it and the bar is still visible.
8. She taps "Stop" on the bar from the thread → "Transcribing…", then the bar disappears. The meeting does not open (she is not on the Meetings list), so she opens Meetings and taps the new row.

### Variations
- Many screens with their own bottom inset (Composer, Compose sheet) share space with the bar; whether the bar sits above the keyboard is not verified; check on a small phone.
- A Duo layout later: the bar must be placed in one spot over the split view (not built).

### Edge Cases
- Sign-out while recording (Settings > Account > Sign out): the recording is stopped and its files wiped. No warning that the audio will be lost is shown in the code path from Sign out; this deserves a confirmation.
- The server rejects the token during an upload: the recording ends and the files are wiped (treated as signing out).
- Battery and microphone indicators: the system shows the orange mic dot; the app shows only the bar.

## STORY-012: Start recording is refused because one already runs
**Type**: short
**Topic**: Meetings
**Persona**: Tomás Herrera
**Goal**: Understand why Record does nothing or errors.
**Preconditions**: Another device already has a recording in the same space, or this phone has a recording left over that is being finished.
**Ideal path**: 1. The user should see which recording is active and be able to stop it.
**Alternate paths**: none found.

### Steps
1. Tomás opens Meetings and taps "Record" → the sheet opens as usual (the button is shown because this phone is not busy).
2. He taps Start → the server refuses; the sheet footer shows the message in red. If the leftover recording on this phone is still being recovered, the footer reads "A recording is already running."
3. He taps Cancel → back to the list. The recovered recording shows "Transcribing…" in the bar and then opens or disappears.

### Variations
- A recording started on the web: the iOS app has no indicator and no way to stop it; the server error text is all that shows.

### Edge Cases
- The sheet's height is fixed. With a long error text the footer may be clipped at 230 pt (unverified).
