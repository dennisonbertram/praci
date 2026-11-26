# Voice stories: dictation, calls, read-aloud, voice settings, meeting recording

Source: SwiftUI code in `apps/ios/Sources/Praci` (`Voice/*`, `Settings/Voice/*`, `Meetings/Record*`, `Manage/BotSettingsScreen.swift`, `Thread/Composer/ComposerView.swift`) and `Packages/RakazoCore/Sources/RakazoCore/Voice/*`. Nothing was run on a device; "Expected" means what the code does. Names and data are invented.

Facts the stories rely on:

- Dictation is on-device only (`SFSpeechRecognizer`, `requiresOnDeviceRecognition`). Nothing goes to Apple's servers. If the device cannot recognise speech locally, the composer says "Dictation isn't available on this device."
- A call uses on-device recognition when it can. Otherwise it records clips and sends them to hosted transcription, which needs a hosted provider that transcribes.
- The audio session is shared. While a meeting records (`VoiceAudio.meetingActive`), dictation and calls do nothing.
- Findings worth a decision are marked **Gap** inside the stories and collected at the end.

## STORY-V01: Dictate a message into the composer

**Type**: short
**Topic**: Voice
**Persona**: Founder walking between meetings, phone in one hand
**Goal**: Say a request to the "Finance" agent instead of typing it
**Preconditions**: Signed in, thread open, composer empty, microphone and speech permissions not yet asked
**Ideal path**: 2 (tap the mic, speak; it stops on its own and the text is ready to send)
**Alternate paths**: Voice call (STORY-V03) for a spoken back-and-forth; no keyboard dictation shortcut is built into the app (the iOS keyboard's own mic still works in the text field)

### Steps
1. Open the thread → composer shows the text field, attach button, and a round mic button (label "Dictate") where Send would be.
2. Tap "Dictate" → iOS asks for microphone, then speech recognition access. Allow both.
3. Say "Draft a reminder to chase the Northwind invoice" → words appear in the field as they are recognised; the button becomes a stop square ("Stop dictation").
4. Stop talking → after 1.2 s of silence the session ends by itself and the button turns into the arrow "Send" because the field now has text.
5. Tap "Send" → message goes out as usual (outbox rules apply, see thread-send).

### Variations
- Tap "Stop dictation" before the pause ends: same result, the text stays.
- Text already in the field: dictation appends after it with a single space.
- Recognizer ends early (iOS limit or a breath): the session restarts quietly with backoff; after 5 restarts that hear nothing it stops.

### Edge Cases
- Field not empty and no dictation running: the button is Send, so there is no way to start dictation again until the text is cleared. Adding words by voice to a typed draft is not possible; use the keyboard's own mic.
- Dictation running while a run is in progress: the trailing control is Stop (stop the agent run), not the mic. Dictation cannot start then.
- App recording a meeting: the mic button is disabled with no explanation (`app.capture.isBusy`).

## STORY-V02: Dictation blocked by a denied permission

**Type**: short
**Topic**: Voice
**Persona**: User who tapped "Don't Allow" once by reflex
**Goal**: Understand why the mic does nothing and fix it
**Preconditions**: Microphone permission denied in iOS Settings
**Ideal path**: 2 (read the notice, tap Open Settings)
**Alternate paths**: Go to iOS Settings → Praci manually

### Steps
1. Tap "Dictate" → a red line under the composer: "Allow microphone access in Settings to talk to your agent." with an "Open Settings" link.
2. Tap "Open Settings" → the Praci page in the iOS Settings app opens.
3. Turn on Microphone, return to Praci → the notice is still on screen until the next attempt.
4. Tap "Dictate" again → the notice clears and listening starts.

### Variations
- Speech recognition denied but microphone allowed: "Allow speech recognition in Settings to dictate."
- Device cannot recognise speech on device: "Dictation isn't available on this device." No Open Settings fix helps, but the "Open Settings" link is still shown beside it.

### Edge Cases
- The microphone wording says "to talk to your agent" even when the user is dictating, not calling.
- The notice has no dismiss control and does not disappear after the permission is fixed until the user tries again.
- Simulator: dictation always reports the microphone message (the code refuses to start the audio engine there).

## STORY-V03: Start a voice call and hold a conversation

**Type**: medium
**Topic**: Voice
**Persona**: Founder driving, hands-free after the first tap
**Goal**: Ask the "Chief of staff" agent for a rundown and get it spoken back
**Preconditions**: Bot thread (not a group), permissions allowed, voice provider not configured (device voice), AI consent already given
**Ideal path**: 2 (tap Call, talk)
**Alternate paths**: Dictation plus reading the reply (STORY-V01); there is no read-aloud action on a message

### Steps
1. Open the thread → toolbar shows a phone icon labelled "Call" (bots only).
2. Tap "Call" → full-screen call view slides up: avatar, name, a spinner (`callConnecting`) while status and consent are checked.
3. If the AI data sharing consent sheet is needed, it appears first (see approvals-consent); accept it → the call continues.
4. Call is live → status line reads "Listening · 00:00" with a running timer; the buttons are Transcript, Mute, Hang up.
5. Say "What is blocking the board update?" → grey text under the status shows what is being heard; after a pause the status changes to "Thinking".
6. The agent replies → status "Speaking", reply spoken with the device voice; the transcript (if open) shows it.
7. Start talking over the reply → after the phrase holds for about 300 ms the audio stops and the status returns to "Listening".
8. Tap the red "Hang up" button → the call view closes and the thread is visible again. The spoken turns are in the thread as normal messages.

### Variations
- Agent says goodbye and ends the call itself: its goodbye is spoken, then the screen closes. If nothing finishes within 20 s it hangs up anyway.
- Work the agent finishes after hanging up goes to the thread only; it is not spoken.
- A message typed into the thread mid-call is answered on screen only.

### Edge Cases
- Call button is greyed out while a meeting records, with no reason shown.
- Three failed turns in a row (no microphone or server) hang up the call.
- Hosted voice reply not ready: it falls back to the device voice for that reply.
- **Gap**: the timer starts when the view is created (`@State started`), not when the call connects, so a slow connect shows time already elapsed.

## STORY-V04: Call with permission denied

**Type**: short
**Topic**: Voice
**Persona**: User who denied the microphone earlier
**Goal**: Get a call working
**Preconditions**: Microphone or speech permission denied
**Ideal path**: 2 (tap Open Settings in the call, allow, return)
**Alternate paths**: iOS Settings → Praci

### Steps
1. Tap "Call" → call view opens and reaches "Listening".
2. A red caption appears: "Allow microphone access in Settings to talk to your agent." with an "Open Settings" button.
3. Tap "Open Settings", allow, come back → the app was backgrounded, so the call was already hung up and the view closed.
4. Tap "Call" again → call works.

### Variations
- Speech recognition denied but no hosted transcription: caption "Allow the microphone and speech recognition in Settings to talk to your agent."
- Speech denied but hosted transcription is set up: the call silently uses recorded clips and does not show any caption.

### Edge Cases
- Leaving for Settings always ends the call (`scenePhase == .background`), so the user has to start the call again; the Open Settings button in the call view therefore cannot return to the same call.
- Permission prompts and Control Center do not hang up (only `.background` does).

## STORY-V05: Mute, read the transcript, and the live caption

**Type**: short
**Topic**: Voice
**Persona**: User in an open office who wants to silence the mic for a moment
**Goal**: Mute, read what was said, unmute
**Preconditions**: Call connected with at least one exchange
**Ideal path**: 3 (Mute, Transcript, Mute)
**Alternate paths**: Read the same exchanges later in the thread

### Steps
1. Tap "Mute" (mic icon) → icon becomes a slashed mic, status reads "Muted · mm:ss", the grey "heard" text clears, the mic stops.
2. Tap "Transcript" → the avatar area keeps its place and the lower half shows chat bubbles: user right, agent left; "Nothing said yet." if empty.
3. Tap "Transcript" again → bubbles hide.
4. Tap "Mute" → status returns to "Listening", the mic reopens.

### Variations
- A reply arriving while muted is still spoken.
- Consent declined during a call: the call goes muted with the refusal as a red caption; unmuting retries.

### Edge Cases
- Mute and Transcript buttons have icon-only labels; the Transcript button has no pressed or open state shown.
- The transcript lists only what was said on this call; it disappears when the call ends (the thread holds the messages).

## STORY-V06: Call interrupted by backgrounding or hang-up from the agent

**Type**: short
**Topic**: Voice
**Persona**: User who gets a text and switches app mid-call
**Goal**: Know what happened to the call
**Preconditions**: Call in progress
**Ideal path**: 1 (return and see the thread)
**Alternate paths**: none found

### Steps
1. Swipe home or open another app → the call ends immediately and the view is dismissed.
2. Return to Praci → the thread is on screen with no message that the call ended and no way to resume.
3. Tap "Call" → a new call starts from scratch (a new call id; earlier spoken context is kept only in the thread).

### Variations
- Screen lock: same as backgrounding. The `audio` background mode is used by meeting recording only.
- Phone call or Siri while in-app: not treated as backgrounding; no code ends the call or shows a notice.

### Edge Cases
- No "Call ended" message appears anywhere after an automatic hang-up.

## STORY-V07: Choose how the agent sounds (voice settings)

**Type**: medium
**Topic**: Voice
**Persona**: Power user who wants a nicer voice than the phone's
**Goal**: Connect a hosted voice, pick a voice, hear it
**Preconditions**: Signed in, a hosted provider key available (e.g. a Fish Audio key)
**Ideal path**: 6 (Settings, Voice, provider, paste key, Connect, pick voice)
**Alternate paths**: Meeting "Add speech to text" link (STORY-V09) reaches the same Voice screen; Home has no direct link

### Steps
1. Open Settings from the Home gear → tap "Voice".
2. Section "Speak with" shows "This device" (ticked, "Free, works offline") and "Hosted voice" with a summary ("Not set up").
3. Tap the toolbar "Hear sample" (only while "This device" is selected) → the phone says "Hi, this is how I'll sound when I read replies out loud."
4. Tap "Hosted voice settings" → providers list, each marked "Speak + transcribe" or "Speak only".
5. Pick "Fish Audio" → an API key field appears ("Paste your API key").
6. Paste a key, tap "Connect" (enabled at 8 characters) → a Voice list loads; tap one to tick it. Optional "Speech model" field for Fish Audio.
7. Back on Voice, tap "Hosted voice" → it becomes the selected row. Calls now use it.

### Variations
- "Replace key" replaces a stored key; "Disconnect" asks "Disconnect hosted voice?" and removes it.
- Sections "Sounds": "Call sounds" and "Waiting sound" toggles, both on by default.
- Pull to refresh reloads server state; a load failure shows a Retry view.

### Edge Cases
- There is no hosted sample button; "Hear sample" only speaks with the device voice.
- **Gap**: the "Speak with" choice is stored in `UserDefaults` as `voice.useDeviceVoice`. The screen's `@AppStorage` default is true (shows "This device" ticked), but `VoiceServer.useDeviceVoice` reads `bool(forKey:)`, which is false when the key was never written. A user who never opened this screen's toggle, but has a hosted provider, will hear the hosted voice while the screen would show the device voice as selected.
- **Gap**: "Call sounds" and "Waiting sound" are saved but no code reads them, so they have no effect.
- A wrong key shows the server's message in red under the field; nothing is stored.

## STORY-V08: Read-aloud setting on an agent

**Type**: short
**Topic**: Voice
**Persona**: User who wants replies spoken without calling
**Goal**: Turn on "Read replies aloud" for the "Chief of staff" agent
**Preconditions**: Bot exists
**Ideal path**: 3 (open bot settings, toggle, save)
**Alternate paths**: none found

### Steps
1. Thread toolbar menu → "Settings" (or row context menu → settings on Home) → bot settings form.
2. Section "Voice" → toggle "Read replies aloud".
3. Save → the setting is stored on the server as the bot's auto-speak flag. Leaving with changes asks to discard.
4. Return to the thread and wait for a reply → **nothing is spoken**: the iOS app has no code that reads thread replies aloud. It only sets the flag.

### Variations
- Group settings do not have this toggle.

### Edge Cases
- **Gap**: the toggle looks functional but has no effect on iOS. Other clients may honour the same flag. The Voice settings sample line ("when I read replies out loud") promises a feature that exists only on calls.
- There is no per-message "Speak" action in the long-press menu (copy, reply, reactions, mark unread).

## STORY-V09: Record a meeting when speech to text is not set up

**Type**: medium
**Topic**: Voice (meeting interplay)
**Persona**: Founder starting a customer call recording
**Goal**: Start recording, then find Voice settings are needed first
**Preconditions**: Space policy not "off"; no transcribing provider connected
**Ideal path**: 5 (Meetings, Record, set up speech to text, back, Start)
**Alternate paths**: none found

### Steps
1. Home → Meetings → tap "Record" (top right) → a small sheet opens.
2. Sheet shows only "Add speech to text" (a link), plus Cancel.
3. Tap it → Voice settings opens inside the sheet; follow STORY-V07 and connect a transcribing provider (a "Speak only" provider will not do).
4. Go back → the sheet reloads and now shows "Title" (placeholder "Meeting 3:40 PM"), the notice "Tell everyone you're recording.", and "Start".
5. Tap "Start" → the sheet closes and a bar appears above every screen: red dot, title, timer, "Stop".

### Variations
- Space policy "confirm": the sheet also shows a toggle "Everyone agreed to be recorded" and Start stays disabled until it is on.
- Policy "off": the "Record" button is not shown.
- Microphone denied: sheet shows "Allow microphone access in Settings to record meetings." (no Open Settings button here).

### Edge Cases
- While recording, the mic button in the composer, the thread "Call" button, and "Record" are all disabled with no explanation; the recording bar is the only hint.
- Starting a call is blocked when a meeting is active, and dictation silently returns.
- Phone call interruption: the current audio chunk closes and recording restarts when the interruption ends. Audio route changes restart the engine.
- Stop: the bar shows "Transcribing…" and then the meeting appears in the Meetings list.

## STORY-V10: Call while a meeting recording runs (conflict)

**Type**: short
**Topic**: Voice (meeting interplay)
**Persona**: User recording a meeting who wants to ask an agent a quick question
**Goal**: Voice-ask during the meeting
**Preconditions**: Recording in progress
**Ideal path**: 1 (type or dictate; here neither voice route works)
**Alternate paths**: type in the composer

### Steps
1. Open an agent thread under the recording bar → "Call" is greyed out; the composer mic is greyed out.
2. User types the question instead and sends → works.
3. Stop the recording → both buttons come back.

### Variations
- A user who tapped Call just before starting a recording is not possible: the recording sheet is on Meetings, behind the full-screen call.

### Edge Cases
- No tooltip or message explains the disabled state. The reason is only visible in the red recording bar.
- The microphone is shared by design: the meeting session records only (`.record` category) so it can run with the screen locked, which is incompatible with the call's play-and-record session.

## Gaps for the catalog

1. "Read replies aloud" (bot settings) has no effect on iOS (STORY-V08).
2. "Call sounds" and "Waiting sound" toggles do nothing (STORY-V07).
3. Device-versus-hosted voice default disagrees between the settings screen (device) and the call code (hosted when available) when the user never touched the choice (STORY-V07).
4. Disabled Call, Dictate and Record controls during a recording give no reason (STORY-V01, V03, V10).
5. Automatic hang-up on backgrounding leaves no message and cannot be resumed (STORY-V04, V06).
6. Dictate disappears once the field has text (STORY-V01).
7. The call timer includes connection time (STORY-V03).
