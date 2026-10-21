# Mobile (Expo iOS) stories: Granola meetings and Wispr Flow voice

Scope: how the two planned features (`docs/plans/granola.md`, epic #444; `docs/plans/wispr-flow.md`, epic #452) would be used on the iPhone app in `apps/mobile`. Nothing here is built. Code facts were read from `apps/mobile` in this worktree on 2026-10-20. The Granola mockup (`docs/granola/mockup.html`, screen 8) was read; no Wispr Flow mockup exists yet.

Notation: [exists] is in code today. [planned: Sx #issue] is only in a plan. GAP means the plan does not define the step. Issue numbers known from the plans: Granola S1 #437, S2 #438, S3 #439, S4 #440, Flow S5 #450. Other slices are named by slice only.

## What the mobile code does today (facts the stories rely on)

- Integrations (`apps/mobile/app/(settings)/integrations.tsx`) lists the server's `connections/catalog` as tiles with an "Add" button. "Add" runs `connections/begin`, opens a browser authorization URL, then polls `connections/complete` up to 45 times. A connected tile opens a detail view with "Accounts" (label field, "Remove"), "Add another", and "Tools". The detail shows the connection's agent through `ConnectionAgent` only when the connection row has `agentBotId`. [exists]
- The mobile app has no reference to Granola or Wispr Flow anywhere (searched `apps/mobile` for both names: no match). The web-only list `FIRST_PARTY_MCP` (`apps/web/src/lib/integrations.ts`) is what makes the Granola and Wispr Flow tiles on web. Mobile has an "Advanced" section with "Add MCP server" (URL plus an optional bearer token), but nothing there does browser sign-in. [exists]
- The mobile Inbox (`apps/mobile/app/inbox.tsx`) already has a `TodoCard` titled "To do". It loads to-dos with `listMailTodos(connectionId?)` only when the pile is "Important", at least one mail account exists, and `enabled` (mail triage) is true. Otherwise it clears the list. Choosing an account tab passes that tab's `connectionId`; "All" passes none. With no mail account, the empty state is a single "Connect mail" button. Each row has a checkbox, the text, and one line of `from` and `detail`; only the checkbox is pressable. [exists]
- The to-do contract (`InboxTodoSchema`) has a required `connectionId` and a nullable `messageId`. [exists]
- Settings, Voice (`apps/mobile/app/(settings)/voice.tsx`) shows a "This device" row, then one provider list (ElevenLabs, OpenAI, Fish Audio, Cartesia; each shows "Connected", "Speak + transcribe" or "Speak only"), then an "API key" field with "Connect"/"Replace key"/"Disconnect", then "Hear a sample", "Call sounds", "Waiting sound". Picking "This device" hides the provider key area. There is no transcription row. [exists]
- Call routing (`apps/mobile/lib/voice-call-entry.ts`, `lib/call-session.ts`, `app/thread.tsx` `startVoiceCall`): if the "This device" preference is on and native recognition is available, the plan is `device` and `voice/status` is not even read for routing. Otherwise `voice/status` decides. In the call, `openMic` tries native recognition first whenever `onDevice !== false`, and falls back to `recordClip` (expo-audio, `HIGH_QUALITY` preset, `audio/m4a`, up to 30 seconds) and `POST /api/voice/transcribe` only if native recognition cannot start. [exists]
- AI-data consent on mobile is prompted from `speakUtterance` (speech output) in `apps/mobile/lib/voice.ts` through `promptAiConsent`, an `Alert` titled "Share data with {name}?" with "Not now", "Privacy policy", "Allow". The upload path `transcribeClip` does not prompt. [exists]
- Message field (`apps/mobile/components/thread-composer.tsx`): a React Native `TextInput`, `multiline`, controlled by `draft`, with `keyboardAppearance` only. No `keyboardType`, `secureTextEntry`, or autocorrect overrides. While the draft is empty and not on a call, the right-hand button is "Call Elio" (waveform); once there is text it becomes "Send". Typing `@word` at the end opens a mention list; a draft that is only `/text` opens a skill list. There is no dictate button. [exists]

## STORY-MB-1: Paste a Granola API key from the phone
**Type**: long
**Topic**: Granola S6 connect card on mobile
**Persona**: Maya Okafor, founder of Fernhill Labs (example.com), on Granola Business, on her iPhone between meetings.
**Goal**: Connect her Granola API key so her meetings sync, using only the phone.
**Preconditions**: Signed in to the mobile app. Granola API key created in the Granola desktop app earlier and saved in her password manager. Granola MCP tile not connected. Granola S6 is shipped.
**Ideal path**: 4 steps: open Settings, Integrations; open the Granola tile; paste the key into the field; tap "Connect". A key is a paste, so no other input is needed.
**Alternate paths**: (a) Web: Integrations, Granola tile detail, the "Granola API key" card [planned: Granola S6]. (b) On the phone, "Advanced", "Add MCP server" with `https://mcp.granola.ai/mcp` [exists] is the only Granola route the mobile code has today, and it offers only a bearer token or none, not Granola's browser sign-in. (c) Pick the key up on web and finish there: "Open web app" exists only in `integration-setup.tsx` for server provider setup, not for tiles.
**Plan status**: Open Settings, Integrations [exists]. Find the Granola tile: GAP (granola.md Surfaces says "the same RPCs back a field and status row on `apps/mobile/app/(settings)/integrations.tsx`" but mobile has no Granola tile, only server catalog tiles and Advanced; whether the new `granola-api` connector appears in `connections/catalog` is not stated). Secure field for the key [planned: Granola S6]. "Connect" [planned: Granola S6]. Status "Synced {n} meetings, {relative time}" [planned: Granola S6]. Agent appears in the bot list [planned: Granola S6, `ensureConnectedAppAgent`].
### Steps
1. Maya opens the app, Settings, Integrations → a catalog with a "Search apps" field, tiles with "Add" buttons, and "Advanced" at the bottom.
2. She types "Granola" in "Search apps" → expected by the plan: a Granola tile. GAP: today nothing in mobile code produces one. If the server catalog does list the `granola-api` connector, the tile would show the generic "Add" button, which starts the browser OAuth flow (`connections/begin`), not a key paste.
3. She taps "Add" anyway (she sees no other button) → a browser opens to an authorization URL, or nothing opens because an API-key connector has no URL. She returns to the app and waits through a spinner on the button labelled "Working…" for up to 45 polling attempts, then sees "Connection pending" and the message "Finish connecting in the browser, then refresh this page." (existing alert). She is confused: she was told to paste a key.
4. She opens "Advanced" → "Add MCP server" and pastes the Granola MCP address, leaves "Bearer authentication" on, and is asked for a bearer token → she pastes the Granola API key there out of habit. This is the wrong credential for the MCP address and it does not start the sync.
5. She backs out and tries the web app on her laptop instead → the web card works as in the plan; she later sees the sync on her phone only through the agent and Inbox.
### Variations
- If Granola S6 lands a dedicated mobile row (the mockup draws it as a "Sync" group with a secure "Granola API key" row, a "Connect" row, then a "Synced 42 meetings, 3 minutes ago" row and a red "Disconnect" row), steps 2 to 4 collapse to the ideal path.
- Key pasted with a trailing newline from the password manager: the field must trim it (the voice screen trims, `apiKey.trim()`; the plan does not say).
### Edge Cases
- Keyboard covers the status row after "Connect"; the screen uses `keyboardShouldPersistTaps="handled"` in `ScrollView`, so a first tap still reaches "Connect".
- The same text appears on web and on mobile: "Synced {n} meetings, {relative time}". Relative time must localize (mobile has `i18n`; plan strings are not yet in the locale files).
- The mockup's mobile screen shows a "Live questions / Signed in with Granola / Connected" group above the key group. Mobile has no Granola MCP tile, so that group has nothing to read from.

## STORY-MB-2: Granola rejects the key on the phone, and later needs a new one
**Type**: medium
**Topic**: Granola S3 and S6 error and recovery on mobile
**Persona**: Tomas Reyes, product lead at Brightwell Studio (example.org), on Granola Pro (no API access).
**Goal**: Find out why his key does not work and still get his meetings into Rakazo.
**Preconditions**: The Granola mobile row exists. Tomas is on a plan without API access, so Granola returns 401 or 403 for any key.
**Ideal path**: 3 steps: paste key, tap "Connect", read the error and know to use the live-questions tile instead.
**Alternate paths**: Web card shows the same line. The MCP tile (web only, [exists]) works for Pro users; the mobile app cannot add that tile.
**Plan status**: Paste and "Connect" [planned: Granola S6]. Error "Granola rejected this key" [planned: Granola S6]. Explanation that a plan is the cause: GAP, granola.md Surfaces says "Free plan: the card explains nothing". Status after later 401/403 (`needs_reconnect`): one line, no retries until a new key [planned: Granola S3]; whether field and "Connect" show then: GAP (granola.md Sync).
### Steps
1. Tomas pastes his key and taps "Connect" → button text changes while one list call validates the key (mockup draws "Connecting…"; the plan names no verifying state).
2. The red line "Granola rejected this key" appears under the field (mockup shows it with the pasted key still in the field) → nothing is stored, no agent is created.
3. He re-checks the key in his password manager, pastes it again, taps "Connect" → same line. He assumes he copied it wrong.
4. He tries a second key made in the Granola desktop app → same line. He concludes Rakazo is broken.
5. He goes back to Integrations and looks for another Granola route → on mobile there is none (see MB-1); on web there is a "Signed in with Granola" tile.
### Variations
- A Business user whose key was revoked later: the status row changes from "Synced 42 meetings, 3 minutes ago" to the same rejection line after the next sync; on the phone he sees this only if he opens Integrations. No push, no badge on the Inbox.
- Pasting a new key into the same field while connected: GAP, the plan does not say whether the field is shown while connected (granola.md ambiguity 6).
### Edge Cases
- A pasted key that has a leading space or a quote mark is rejected with the same line; the line gives no hint.
- Rate limited by Granola (429): the plan retries silently, so the phone shows the old sync time with no message.
- Offline: `rpc` fails; the plan defines no text for a network failure on the card, so the user would see either nothing or the generic error style used elsewhere ("Could not connect").

## STORY-MB-3: Meeting-only user opens the Inbox on the phone
**Type**: medium
**Topic**: Granola S5 meeting to-dos, user with no mail account
**Persona**: Priya Nair, solo founder of Kestrel Works (example.net). She uses Granola and has no Gmail account connected to Rakazo.
**Goal**: See the follow-ups she promised in her last meeting and tick one off.
**Preconditions**: Granola API key connected, one synced meeting with a digest, one to-do "Send Dana the revised pricing", detail "From: Pricing review, 12 Oct". AI-data consent on. Granola S5 shipped.
**Ideal path**: 2 steps: open Inbox, tap the checkbox. The list is already there.
**Alternate paths**: Web Inbox shows the same card [planned: Granola S5]. The Granola agent can answer "what did I promise" in chat [planned: Granola S4].
**Plan status**: Inbox opens [exists]. To-do list for a meeting-only user [planned: Granola S5, says the list shows "with no mail account"]. Where on the screen it sits: GAP (granola.md S5 gives no layout; the mockup draws a "To do" section with no mail UI). Checkbox completes without a connected source [planned: Granola S5].
### Steps
1. Priya opens Inbox from the app → the screen loads `inbox/list`. With zero accounts, the screen shows one button, "Connect mail". Today the to-do fetch is skipped because the code returns early when `list.accounts.length === 0` or `!list.enabled`.
2. She sees only "Connect mail" and no to-dos → by the plan's intent she should see "To do" with three items. Today's code gives nothing.
3. She taps "Connect mail" because it is the only control → Integrations opens. She does not want mail, so she goes back.
4. She tries the Important/Updates pile picker → it is hidden when there are no accounts (`pilePicker` is `null` for zero accounts), so there is no pile to switch to.
5. She gives up and asks the Granola agent in chat → the answer lists her commitments with the meeting title and date (planned S4).
### Variations
- If S5 shows the To do card above the "Connect mail" button, step 1 is the ideal path, and the button is still present beside a working list. The plan does not say whether it should remain.
- Empty state after connecting the source, before any digest: the mockup draws "No follow-ups from meetings yet". The plan gives no wording (granola.md S5: "an empty state for a connected meeting source").
### Edge Cases
- Consent off: no digest, no to-dos, no message. Priya sees "Connect mail" and has no clue why. The plan does not say whether a prompt appears (granola.md ambiguity 12).
- The mockup states "the mobile Inbox has no to-do component to copy today". That is not true: `TodoCard` exists in `apps/mobile/app/inbox.tsx`. The work is to feed it meeting rows, not to build a component.
- Version skew: `InboxTodoSchema` has a required `connectionId`. An older installed app that parses strictly would reject a to-do with `connectionId: null`. The mobile code uses plain `rpc` without that parse, so it would likely just render, but this was not confirmed.

## STORY-MB-4: Mail and meeting to-dos together, and the account tab that hides them
**Type**: long
**Topic**: Granola S5 fetch per `connectionId` on mobile
**Persona**: Jonas Weber, operations lead at Ashgrove Health (example.com), with two Gmail accounts ("Work" and "Personal") and Granola connected.
**Goal**: Work through every open to-do, mail and meeting, from the phone during a commute.
**Preconditions**: Two mail accounts, triage on, three mail to-dos, two meeting to-dos, Granola S5 shipped.
**Ideal path**: 2 steps plus one tick per item: open Inbox, tick items. All five show without choosing a tab.
**Alternate paths**: Web Inbox keys to-dos by account tab as well (`todosByTab`, per discovery); the meeting to-do tab is undefined there too.
**Plan status**: "All" tab, Important pile, To do card [exists]. Meeting to-dos in that card [planned: Granola S5]. Meeting to-dos under an account tab: GAP (granola.md S5 says to-dos are scoped by space and user "regardless of any connection's status" but mobile passes `connectionId` for a tab and the server filters on it today: `connectionId: input.connectionId ?? { in: ... }`).
### Steps
1. Jonas opens Inbox → "All" tab, "Important" pile. The To do card lists three mail to-dos and two meeting to-dos mixed in creation order (`orderBy createdAt asc`), if the server returns both for no `connectionId`.
2. He reads "Send Dana the revised pricing / From: Pricing review, 12 Oct" next to a mail to-do whose line reads "Dana Cho · Revised pricing" → the card does not mark which are meeting items; the detail line is the only clue.
3. He taps the "Work" account tab → `listMailTodos(workConnectionId)` runs. The two meeting to-dos disappear because they have no `connectionId`. The To do card shrinks to the work mail items.
4. He assumes the meeting items were completed and never goes back to "All" that day.
5. He taps a meeting to-do's text to see the meeting → nothing happens (only the checkbox is pressable). Mail to-dos behave the same on mobile today.
6. He taps the checkbox of a meeting to-do → the row leaves at once (optimistic), `inbox/todos/setDone` runs. If it fails, the row returns in place and `Alert` shows the error text.
7. He pulls to refresh → the list reloads. Completed items stay hidden.
### Variations
- Jonas disconnects Granola: his stored meeting to-dos remain and can still be completed (planned S5 behavior). The phone shows no sign that the source is gone.
- Triage turned off: `enabled` is false in today's API for meeting-only data; S5 changes `enabled` to be true when meeting to-dos or a meeting source exist [planned: Granola S5]. The mobile gate `!list.enabled` reads the mail inbox list's flag, not the to-do flag, so it must change too (the same `enabled` is in `inbox/list`).
### Edge Cases
- Updates, Newsletters and Spam piles never show the To do card (`pile === "important"` only). A user on Updates sees no to-dos at all.
- The same follow-up could exist twice: as a meeting to-do from the digest and as a mail to-do from the email Dana sends afterward. The plan does not de-duplicate across sources.
- Polling for triage (`pollTriage`) re-runs `fetchList`, which re-fetches to-dos on each poll while `triagePending`; meeting to-dos arriving during that time would just appear.

## STORY-MB-5: Choose a transcription provider in Settings, Voice on the phone
**Type**: medium
**Topic**: Flow S1b transcription row on mobile
**Persona**: Lena Fischer, head of design at Marlowe Studio (example.org). Her organization has Wispr Flow API access. She uses "This device" voice today.
**Goal**: Have her calls transcribed by Flow while replies keep using her existing voice.
**Preconditions**: Flow S1, S1b, S1c shipped. Wispr API access approved (blocked today, so S3a is not shipped; this story only covers the setting). "This device" is on in Settings, Voice.
**Ideal path**: 3 steps: open Settings, Voice; pick Wispr Flow as the transcription provider; paste the key and confirm.
**Alternate paths**: Web Settings, Voice has the same row [planned: Flow S1b]. Provider rows for ElevenLabs, OpenAI, Fish Audio also transcribe today ("Speak + transcribe") and could be the transcription provider with no new setting [exists].
**Plan status**: Open Settings, Voice [exists]. Transcription row, picker, key entry, verify, clear [planned: Flow S1b]; layout and states: GAP (wispr-flow.md S1b says only "reuses the provider-picker pattern already there"; the mobile screen has no picker, only a flat list, and picking "This device" hides the key area). Whether Flow appears for a user without access: GAP.
### Steps
1. Lena opens Settings, Voice → "This device" row shows "On · Free, works offline"; the provider list sits below it with the first item selected only when "This device" is off.
2. She looks for a place to choose how her speech is turned to text → today none exists. In the plan, a new row labelled by the plan (wording not given) appears. GAP: before or after "This device", under which heading, and whether it still shows when "This device" is on.
3. She picks "Wispr Flow" → a key field appears. If this reuses the existing `TextInput` with `secureTextEntry`, the label would be "API key", the same label as the voice provider's field directly above. The screen would then have two fields called "API key" on one page.
4. She pastes the key and taps "Connect" → `verify` runs; the plan names no busy text or error for a bad key (existing text on that screen is "Could not connect").
5. The row shows "Connected" → speech replies still use "This device" (the plan: speech output keeps using the existing voice provider).
6. Later she taps "Disconnect" for transcription → the secret is cleared and calls go back to "use my voice provider" (null selection).
### Variations
- Lena selects ElevenLabs as her voice provider after setting up Flow: the plan says the transcription selection is independent.
- A user without API access: S3a and S3b are blocked; the row should not offer Flow. GAP: how the app knows (no `voice/catalog` flag is in the plan).
### Edge Cases
- `voice.status` reports the selected transcription provider [planned: Flow S1b]. Mobile `VoiceStatus` today is `{ configured, ready, provider, voiceId }` and call code reads `{ ready, transcribe }`. Both need a new field; the plan does not name it.
- Android users see the same screen; Flow on Android is out of scope (wispr-flow.md "not built"), so the row would show for Android users with no benefit.
- The Voice settings subtitle on each row reads "Speak + transcribe" or "Speak only". A transcription-only provider fits neither phrase; GAP.

## STORY-MB-6: Call Elio with Flow selected, on a phone that can recognize speech itself
**Type**: long
**Topic**: Flow S3b call routing, S1c consent, mobile
**Persona**: Lena Fischer again, a week later, driving mode off, headphones in.
**Goal**: Talk to Elio and have Flow, not Apple's recognizer, transcribe her speech.
**Preconditions**: Flow selected as transcription provider (MB-5). Flow S3a and S3b shipped. iOS speech recognition permission granted. "This device" voice on. AI disclosure version bumped by S1c; Lena has not seen the new text.
**Ideal path**: 2 steps: tap "Call Elio"; talk. Routing and consent happen without extra choices, except one consent prompt the first time.
**Alternate paths**: Web `Shell.tsx` "Call Elio" with `webSpeechAvailable()` [planned: Flow S3b]. Without Flow selected the phone routes as today.
**Plan status**: "Call Elio" button [exists]. Server routing when a server provider needs WAV, even where native recognition is available [planned: Flow S3b]. 16 kHz mono WAV capture on iOS [planned: Flow S3b, "unverified until run on device"]. Consent re-prompt: wording [planned: Flow S1c]; where it appears on mobile: GAP (wispr-flow.md S1c).
### Steps
1. Lena taps the waveform "Call Elio" button in the message field → `startVoiceCall` runs `resolveVoiceCallPlan`.
2. Today: because "This device" is on and native recognition is available, the plan is `device` and `voice/status` is not read. Her Flow selection is never consulted. With S3b: the plan must read the new `voice.status` field first, and the call must use the recorder path. GAP: the plan does not say which wins when she has chosen both "This device" and a server transcription provider.
3. The call connects → `startCall` runs with `transcribe` true. In `openMic`, native recognition is tried first (`onDevice !== false`). S3b must reorder this so the recorder runs first; the plan says only "calls use the recorder and upload path even where ... native recognition is available".
4. She speaks → `recordClip` records with the `HIGH_QUALITY` preset to `audio/m4a`, stops after 1.2 seconds of quiet or 30 seconds, and uploads. Flow wants 16 kHz WAV, at most 6 minutes or 25 MB, so S3b changes the preset for this provider only [unverified on device].
5. The reply plays → the first spoken reply calls `ensureAiDataConsent` for `voice`. Because the disclosure version moved, an `Alert` titled "Share data with {name}?" appears mid-call with the extended voice sentence. The recipients named are the transcription provider's too [planned: Flow S1c].
6. She taps "Not now" → the call mutes and holds for an explicit retry (`consentBlocked`). Her audio was already sent to Flow in step 4 without a prompt, because only the speech path asks for consent on mobile. GAP: S1c says context fields are sent only under current-version consent, but the audio itself still goes.
7. She taps unmute and "Allow" → the call continues.
### Variations
- Native recognition denied in iOS Settings and Flow not selected: the existing alert "Calls need transcription" (text: "Allow speech recognition in Settings, or connect ElevenLabs, OpenAI, or Fish Audio.") still omits Flow.
- Call over cellular with a 6 minute uninterrupted turn: the mobile cap is 30 seconds per turn, so the Flow 6 minute limit is never reached from this path. The plan's "over 6 minutes is rejected" has no mobile trigger.
### Edge Cases
- Daily seconds cap reached [planned: Flow S3a]: a call turn fails. The mobile call shows `errorText(error)` as a caption ("Could not hear that." is the fallback), and after repeated failures `MAX_TURN_FAILURES` ends the call. The plan defines the message text but no reset time.
- Format rejection (non-WAV): mobile can only hit it if WAV capture silently falls back to m4a. The plan (ambiguity 17) lists this as unreachable by choice.
- The microphone is also in use by the Flow keyboard if she left it open in another app; the plan says S6 only records this.

## STORY-MB-7: Dictate a message with the Wispr Flow keyboard
**Type**: short
**Topic**: Flow S2 compatibility with the native message field
**Persona**: Devon Park, engineer at Cobalt Mill (example.com), with the Flow keyboard installed and Full Access on.
**Goal**: Speak a three-line message to a bot and send it.
**Preconditions**: Flow keyboard enabled in iOS Settings; Devon is in a bot thread.
**Ideal path**: 3 steps: tap the message field, switch to Flow with the globe key and speak, tap Send.
**Alternate paths**: Tap "Call Elio" and talk (a call, not a draft message, [exists]). Web composer with the Flow hotkey [planned: Flow S2].
**Plan status**: Message field accepts Flow input [exists, to be tested by Flow S2: "does not force a keyboard type, keeps autocorrect and content-type defaults, is not `secureTextEntry`"]. Send enabling after an insert [planned: Flow S2 test]. Caret position after a multi-line insert [planned: Flow S2 test].
### Steps
1. Devon taps the field (placeholder is the composer prompt) → iOS keyboard opens; right button is "Call Elio" because the draft is empty.
2. He holds the globe key and switches to Flow → Flow's keyboard shows a record control. Rakazo's field keeps focus.
3. He speaks three sentences with a line break → Flow inserts text through the text input; `onChangeText` receives the whole string once or in parts, and `updateDraft` runs on each.
4. The right button changes from "Call Elio" to "Send" → because `canSend` becomes true with text.
5. He taps Send → message goes out as typed text. Flow's text is handled as the user's own message.
### Variations
- Text that begins with `/`: `updateDraft` treats a draft that is only `/something` as a skill search and opens the skill list over the keyboard. Flow could produce this if he dictates a path.
- Text that ends in `@name` (Flow writes "at" as "@" for email-like words) opens the mention list and may insert a chip when he taps a row.
### Edge Cases
- Flow adds text while a skill or mention chip is selected; `serializeComposerPrompt` merges them. Not covered by the plan's test list.
- The field's maximum height is 132 points; a long dictation scrolls inside it.
- The Flow keyboard switches itself off for number, phone, and email fields (Flow help center, cited in the plan). The message field is none of these, so no switch.
- Not observable by tests: whether Flow's Live Activity and the call's audio session conflict (plan S6 records this only).

## STORY-MB-8: Flow keyboard in secure and credential fields
**Type**: short
**Topic**: Flow S2 and S6 observation, secure fields on mobile
**Persona**: Sam Whitfield, security-minded founder of Orchard Lane (example.net).
**Goal**: Confirm that dictating or pasting into a secret field does not send it to a third party.
**Preconditions**: Flow keyboard enabled. Sam is on mobile Integrations, Advanced, "Add MCP server", with the "Bearer token" field visible; the same applies to the "API key" field in Settings, Voice, the ask-a-secret field in a thread, and (planned) the "Granola API key" field.
**Ideal path**: 2 steps: tap the field, check which keyboard shows.
**Alternate paths**: The manual checklist (docs only) [planned: Flow S6].
**Plan status**: Rakazo keeps `secureTextEntry` on its secret fields [exists, by plan Design 2]. What Flow does in them: unknown. The Flow help-center article does not address password fields (wispr-flow.md facts table). The new "Granola API key" and transcription key fields [planned: Granola S6, Flow S1b] must also be secure.
### Steps
1. Sam taps the "Bearer token" field in Add MCP server (`secureTextEntry`) → the keyboard is whatever iOS gives for a secure field.
2. He tries the globe key → on iOS, third-party keyboards are normally not offered in secure text fields; this is platform behavior and was not tested against Flow here.
3. He pastes a token instead → field shows dots.
4. He opens the thread "ask" field for a secret (`secureTextEntry` when `secretInput`) → same behavior.
5. He opens a non-secure field with credentials in it, such as the Pipedream "Client ID" (`autoCorrect={false}`, no `secureTextEntry`) → Flow keyboard is available. A client ID is not a secret, but a Pipedream client secret on the same screen is secure.
### Variations
- Fish Audio "Speech model" field, "Account label" and "Display name": plain fields where Flow works.
### Edge Cases
- A web-view or custom password field is out of scope on mobile; mobile fields are native.
- The "Granola API key" row is drawn in the mockup as `type="password"`; the real mobile control must be `secureTextEntry`, with `autoComplete="off"`, `textContentType="none"`, as the Voice screen already does for its key field.

## STORY-MB-9: Ask the Granola agent from the phone and repair a missing agent
**Type**: medium
**Topic**: Granola agent provisioning, Flow S5 meetings, mobile degradation
**Persona**: Maya Okafor (MB-1) in a taxi, wanting a pre-meeting brief.
**Goal**: Ask "what did we agree with Dana last month" and get an answer that cites the meeting.
**Preconditions**: Granola API key connected on web; sync done; AI-data consent on. Maya also removed her MCP-tile Granola agent last week by mistake.
**Ideal path**: 3 steps: open the Granola agent, type the question, read the cited answer.
**Alternate paths**: Another agent asks the Granola agent through `message_bot` [planned: Granola S4]. Wispr Flow users ask the Flow agent after Flow S5, if that slice ships.
**Plan status**: Bot list on mobile [exists]. Granola agent for the API-key connection [planned: Granola S6]. Meeting tools and cited answer [planned: Granola S4]. "Create agent" repair [exists on web `McpDetail`; not found in mobile]. The mobile detail shows `ConnectionAgent` only when the connection has `agentBotId`.
### Steps
1. Maya opens the bot list → the Granola agent from the API-key connection is there, created once on connect (planned S6).
2. She also sees an older Granola agent if she had the MCP tile; the two are distinguished only by account label (granola.md open question).
3. She opens the agent and types the question → the agent answers from stored meetings, with the meeting title and date. Tapping the citation does nothing on mobile; the mockup's citation popover is a web design.
4. In another case her API-key agent was deleted → sync continues; there is no agent to ask. She looks for "Create agent". On mobile Integrations, the connection detail shows an agent only when `agentBotId` is set, so there is no create button. GAP: mobile has no repair path from the phone.
5. She asks a different bot about the meeting → that bot cannot read meetings; it may answer that it has no access or ask the meeting agent via `message_bot` if the user has one.
### Variations
- Flow-only user: the Flow tile is web-only on mobile, so the phone cannot connect Flow. After connecting on web, the Flow agent appears in the bot list and answers (planned Flow S5; may not ship if tool shapes cannot be mapped).
### Edge Cases
- Granola deletions are not mirrored; a note Maya deleted in Granola can still be cited on the phone with no indication (granola.md Sync).
- Stored meeting content never shows on the phone except through answers and to-dos.

## Mobile compared with web: what degrades

| Item | Web | Mobile today | Effect |
|---|---|---|---|
| Granola and Wispr Flow tiles | `FIRST_PARTY_MCP` entries | none | Cannot add the MCP tile or reach the key card from the phone unless S6 adds one |
| Key card with status and Disconnect | planned card on the tile detail | no tile to hang it on | S6 mobile row has no defined home |
| "Create agent" repair | `McpDetail` / `IntegrationAgentSection` | not found | Cannot recreate a removed meeting agent from the phone |
| Inbox to-dos with no mail account | planned | skipped when zero accounts or `!enabled` | Meeting-only users see only "Connect mail" |
| Meeting to-do under an account tab | undefined | filtered out by `connectionId` | Items vanish on tab change |
| Citation to a meeting | popover drawn in mockup | no equivalent | Citation is text only |
| Transcription provider row | planned | no row; "This device" hides key area | Layout undefined |
| Routing when native recognition exists | web: `webSpeechAvailable()` | native recognition first | Both must reorder for Flow |
| Consent re-prompt | `AiDataSharing` | `Alert` on first spoken reply only | Not shown when device voice only |
| Flow dictation | hotkey on desktop, composer is a rich editor | keyboard in a plain `TextInput` | Different risks: `@` and `/` triggers on mobile |

## Journey failures and gaps

1. No Granola tile or home for the API key field on mobile (MB-1). Plan section: granola.md Surfaces and S6 ("field and status row on `integrations.tsx`"). Severity: high. Today's mobile catalog is server tiles plus Advanced; an "Add" on a key-only connector would start OAuth.
2. Meeting-only users see only "Connect mail" on the mobile Inbox, so meeting to-dos never show (MB-3). Plan section: granola.md S5 "Retrieval and completion". Severity: high. The gate `list.accounts.length === 0 || !list.enabled` clears to-dos before any fetch.
3. Meeting to-dos disappear when the user selects a mail account tab (MB-4). Plan section: granola.md S5 (to-do fetch scoped by connection; meeting to-dos have no connection). Severity: high.
4. The call plan ignores a selected transcription provider when "This device" is on (MB-6). Plan section: wispr-flow.md S3b. Severity: high. Also the plan does not say which wins; sending audio to Flow after the user chose on-device-only voice would be a privacy surprise.
5. Native recognition is tried before the recorder in `openMic` (MB-6). Plan section: wispr-flow.md S3b. Severity: high; the slice must change order, not only add WAV.
6. Consent re-prompt on mobile appears only when a reply is spoken, not when audio is uploaded (MB-6). Plan section: wispr-flow.md S1c. Severity: med. Users on device voice never see the new disclosure; others see it mid-call after their audio already went out.
7. The mobile recorder uses `audio/m4a`, 30 second turns; Flow needs 16 kHz mono WAV (MB-6). Plan section: wispr-flow.md S3b ("unverified until run on device"). Severity: med.
8. Transcription row has no layout on mobile; two "API key" fields on one screen; "Speak + transcribe" wording does not fit a transcription-only provider (MB-5). Plan section: wispr-flow.md S1b and ambiguities 14 and 23. Severity: med.
9. No way to tell a user without Flow API access that Flow is unavailable (MB-5). Plan section: wispr-flow.md S1b, S3a. Severity: med.
10. The key rejection line gives no reason, and the plan does not say what mobile shows for `needs_reconnect`, a rate limit, or a network failure (MB-2). Plan section: granola.md Surfaces ("Free plan: the card explains nothing") and Sync. Severity: med.
11. No repair path for a deleted meeting agent on mobile (MB-9). Plan section: granola.md "Agent provisioning". Severity: med.
12. `/` or `@` in dictated text opens skill and mention pickers in the message field (MB-7). Plan section: wispr-flow.md S2 test list does not cover it. Severity: low.
13. A to-do row on mobile is not tappable, so "From: Pricing review, 12 Oct" cannot open anything (MB-4). Plan section: granola.md S5 (no navigation defined). Severity: low.
14. Meeting and mail to-dos are mixed in one "To do" card with no marker (MB-4). Plan section: granola.md S5. Severity: low.
15. Existing alert text "Allow speech recognition in Settings, or connect ElevenLabs, OpenAI, or Fish Audio." does not mention Flow (MB-6). Plan section: wispr-flow.md S3a. Severity: low.
16. Mockup claims the mobile Inbox has no to-do component. `TodoCard` exists in `apps/mobile/app/inbox.tsx`. Plan section: `docs/granola/mockup.html` screen 8. Severity: low (documentation error that could lead to a duplicate component).
17. Flow behavior in secure fields is unknown (MB-8). Plan section: wispr-flow.md facts table and S6. Severity: low until S6 is run on a device.
