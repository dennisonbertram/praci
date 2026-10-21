# Stories: Wispr Flow voice (dictation without the API, and Flow as transcription provider)

Covers discovery topics 5 and 6. Plan: `docs/plans/wispr-flow.md`. Existing UI labels were read from `apps/web/src/pages/VoiceSettingsOverlay.tsx`, `apps/web/src/pages/Shell.tsx` and `apps/mobile/app/thread.tsx`. Rakazo has no composer dictation of its own; the composer mic is "Call Elio", a voice call. No Flow-specific string is defined in the plan, so planned steps use plan wording or are marked GAP. Everything about Flow's own app (hotkey, keyboard) is third-party behavior that the plan marks unverified until Flow S6.

## STORY-WF-1: Dictate a multi-line message into the web composer with the Flow hotkey
**Type**: short
**Topic**: Dictating into Rakazo with Flow, no API (web)
**Persona**: Maya, founder of Fernhill Labs (example.com), has Flow Pro on her Mac and no Wispr API access
**Goal**: Speak a three-sentence update to a bot and send it, without typing.
**Preconditions**: Flow installed with Accessibility permission; Rakazo open in Chrome on the thread with her bot; composer empty.
**Ideal path**: 3. Click the composer, hold Flow's hotkey and speak, press Send. Rakazo adds nothing.
**Alternate paths**: Click "Call Elio" and speak [exists]; Flow's own paste of the last transcript; typing.
**Plan status**: click composer [exists]; Flow hotkey and insertion [third-party, no Rakazo step]; draft kept, caret after text, Send enabled [planned: S2 (Flow epic #452)]; Send [exists].
### Steps
1. Maya opens the thread and clicks the message field → caret appears; Send is disabled for an empty draft.
2. She holds Flow's hotkey and says two sentences, a paragraph break, and a third sentence → Flow shows its own overlay and, on release, inserts cleaned text with a blank line in the middle.
3. She looks at the composer → text is in the field, caret sits after the last word, Send is enabled (S2 requires this; today it is untested).
4. She notices Flow wrote "Fernhill" correctly because it is in her Flow dictionary; she does not touch anything → no Rakazo vocabulary is involved (S4 feeds only the API provider).
5. She presses Send → message posts as one multi-paragraph message.
### Variations
- She types a first line, then dictates: Flow inserts at the caret, the typed line is kept.
- She dictates, then types "Fixing a word" in the middle and sends: draft memory still works.
- She switches to another bot mid-draft, comes back: draft is restored (S2 says "keeps the draft memory").
### Edge Cases
- Flow inserts through paste and the composer treats the multi-paragraph string as a single draft; if the rich composer drops the second paragraph Maya would see only the first and not know (hesitation: she re-dictates).
- She presses the hotkey while focus is in the sidebar search: the text lands there. Nothing in Rakazo prevents it.
- Flow Free plan hits its 2,000 words per week (desktop) mid-message: Flow's own message, not Rakazo's.
- Information appears on two surfaces: the composer text and Flow's own history. Rakazo stores only the sent message.

## STORY-WF-2: Dictate in the Electron app and find a hotkey clash
**Type**: medium
**Topic**: Dictating into Rakazo with Flow (Electron)
**Persona**: Tomas, operations lead at Brightwell Freight (example.com), uses the Rakazo desktop app and Flow on Windows
**Goal**: Use Flow's hotkey inside the Electron window without Rakazo's own shortcuts interfering.
**Preconditions**: Rakazo desktop installed; Flow running; Tomas has remapped nothing.
**Ideal path**: 3. Focus the composer, hold the hotkey and speak, Send.
**Alternate paths**: Use the web app in a browser instead of Electron [exists]; "Call Elio" [exists].
**Plan status**: composer focus [exists]; Flow hotkey [third-party]; "no global shortcut in `apps/desktop` collides with Flow's documented hotkey" [planned: S2]; the hotkey list is unread in the plan (open question 6, so the check is GAP until the list is read).
### Steps
1. Tomas clicks the Electron composer → caret shows.
2. He holds Flow's hotkey, speaks → Flow inserts text; Electron receives it like a keyboard insert.
3. He presses the Rakazo shortcut he normally uses to open quick switcher while Flow's overlay is open → expected (if S2 passes) nothing registers globally that Flow also uses.
4. He sends → message posts.
5. Later he changes Flow's hotkey to a key combination Rakazo's menu uses → GAP: plan checks only Flow's documented defaults; a user remap is outside S2.
### Variations
- Electron on macOS: Flow needs Accessibility; if Tomas never granted it, Flow does not insert. Flow shows its own prompt.
- Using Web Speech is not an option in Electron (`webSpeechAvailable()` is false), so "Call Elio" uses upload dictation there [exists].
### Edge Cases
- Tomas wonders why Rakazo has no mic icon next to Flow. The only mic-like control is "Call Elio", which starts a call, not dictation. He may click it expecting dictation and be taken to the call card (or to Settings, Voice if voice is not set up, see WF-4).
- Playwright e2e for Electron cannot cover real Flow; only the S6 manual checklist does.

## STORY-WF-3: Dictate on iPhone with the Flow keyboard
**Type**: medium
**Topic**: Dictating into Rakazo with Flow (iPhone)
**Persona**: Priya, designer at Fernhill Labs (example.com), iPhone with Flow keyboard installed and Full Access granted
**Goal**: Reply to a bot by voice from her phone.
**Preconditions**: Rakazo mobile open on a thread; Flow keyboard enabled in iOS Settings.
**Ideal path**: 4. Tap field, switch keyboard (globe), speak, Send.
**Alternate paths**: "Call Elio" on the mobile composer [exists, `startVoiceCall`]; iOS system dictation (microphone key on stock keyboard).
**Plan status**: tap field [exists]; switch to Flow keyboard [third-party]; native message field not forcing a keyboard type, autocorrect and content-type defaults kept, not `secureTextEntry` [planned: S2 props test]; Send [exists].
### Steps
1. Priya taps the message field → the stock keyboard appears.
2. She presses the globe key until the Flow keyboard shows → Flow takes over the keyboard area.
3. She taps Flow's mic and speaks a sentence → Flow inserts text into the field.
4. She checks the text, fixes one word by hand with the stock keyboard → both keyboards write into the same field.
5. She taps Send → message posts.
### Variations
- Flow switches itself to the next keyboard for number, decimal, phone, email-address fields (Flow documented). Rakazo's message field is a plain text field, so this should not happen there; if the field forced an email keyboard Flow would hide.
- Priya uses a Flow Shortcut from the Action Button: depends on Flow; Rakazo is not involved.
### Edge Cases
- Priya taps "Call Elio" (the mic-like control) while the Flow keyboard is up and Flow's Live Activity is running: GAP, the plan only says S6 "records what happens" (discovery ambiguity 18).
- Full Access off: Flow cannot insert; Flow's message, not Rakazo's.
- Native sheets and pickers: none of Rakazo's native alerts hold text input, so Flow is not tried there.

## STORY-WF-4: Mistaking "Call Elio" for dictation, then sharing the mic during a call
**Type**: medium
**Topic**: Call Elio and Flow share the microphone
**Persona**: Jonas, support lead at Brightwell Freight (example.com), new to Rakazo and a daily Flow user
**Goal**: Talk a long message into Rakazo, then understand why Flow behaves oddly during a call.
**Preconditions**: Flow installed; Rakazo voice provider not yet set up (no key); Jonas is on web.
**Ideal path**: 2. Dictate in the composer with Flow; do not use "Call Elio" for dictation.
**Alternate paths**: Set up a voice provider and use "Call Elio" [exists].
**Plan status**: composer "Call Elio" button [exists]; `openSettings("voice")` when voice is not ready [exists]; Voice settings overlay [exists]; Flow during a call [GAP: plan S2 and S6 say "records what happens; no code is planned"].
### Steps
1. Jonas looks for a mic in the composer, sees "Call Elio", clicks it → because `voiceStatus.ready` is false, the Voice settings overlay opens (no explanation of why).
2. He sees "Providers" with "Speak + transcribe" / "Speak only" labels, "API key", and "Connect" → he does not have a key and closes with "Close voice settings".
3. He remembers Flow, clicks the composer, uses the hotkey and dictates → text appears; works without any setup (see WF-1).
4. Later a colleague sets up a voice provider for him; he clicks "Call Elio" → the call card shows; Rakazo starts its own recording/dictation.
5. He presses Flow's hotkey during the call to dictate a note into a different field → GAP: both apps want the microphone. Plan does not say whether the call mutes, Flow fails, or both record. Expected result unknown until S6.
6. He ends the call and tries Flow again in the composer → expected to work; unverified.
### Variations
- Mobile: tapping the mic control with no provider shows an alert "Add a voice provider in Voice settings." with an "Open Voice" action [exists, `thread.tsx`].
### Edge Cases
- The same wording "voice" is used in three places: Call Elio, Settings, Voice, and Flow's dictation. Jonas assumes Voice settings is where he configures dictation; it is not.
- A call that ends abnormally because Flow grabbed the mic shows whatever the call card already shows for errors; nothing Flow-specific.

## STORY-WF-5: Flow near secret and password inputs
**Type**: short
**Topic**: Secure fields and Flow
**Persona**: Amara, security-conscious CTO at Halden Robotics (example.com)
**Goal**: Check that Flow does not read or type into a secret field in Rakazo.
**Preconditions**: Flow with Context Awareness on (default); Rakazo web open at Settings, Voice, "API key" field for a provider.
**Ideal path**: 2. Open the field and try Flow; see nothing is inserted or read.
**Alternate paths**: Paste the key from a password manager.
**Plan status**: Rakazo's secret inputs keep native secure input types and are not relied on to be skipped by Flow [planned: S2]; checking Flow's behavior in those fields [planned: S6 manual checklist].
### Steps
1. Amara opens Settings, Voice, selects a provider, clicks the "API key" field (placeholder "Paste your API key") → field is masked.
2. She holds Flow's hotkey and speaks a fake test string → expected: Flow does not insert into a native password input (macOS), but its own page warns that custom or web password fields may be read as normal text. Result: unverified.
3. She tries the same in the mobile secret field → Flow switches to the next keyboard for some field types; the Flow page does not address password fields. Unverified.
4. She records the result in the S6 checklist doc → a person with a Flow account does this, not CI.
### Variations
- Token and secret inputs on other pages (integration keys, MCP headers) are tried in the same session.
### Edge Cases
- If Flow does insert text, Rakazo has no warning or opt-out; nothing in the plan changes the UI (no copy, no setting). Amara has no in-app way to tell Flow to stay out.
- One-time codes (OTP): Flow page does not mention them.

## STORY-WF-6: Choose Flow as the transcription provider (user with API access)
**Type**: long
**Topic**: Flow as transcription provider (Flow S1b, S1c, S3a, S3b, S4)
**Persona**: Maya, founder of Fernhill Labs (example.com); Wispr approved her organization's API access and gave her a key and hostname
**Goal**: Have Call Elio transcribe her speech through Flow, with names from her workspace passed as hints, while Elio's voice stays on her current provider.
**Preconditions**: Voice provider (an OpenAI key, say) connected; S1, S1b, S1c, S3a, S3b have shipped (all except S1/S2 are blocked on API access today); AI-data consent recorded at the older disclosure version; base URL connection setting in place.
**Ideal path**: 6. Open Settings, Voice; pick transcription provider; paste key; Connect; accept the updated disclosure; start the call.
**Alternate paths**: none found (no other way to choose a provider; WebSocket is not built).
**Plan status**: Settings, Voice overlay [exists]; transcription row, picker, key entry, verify, clear [planned: S1b; layout GAP, see discovery ambiguity 14 and 23]; consent text and re-prompt [planned: S1c; wording GAP: the plan gives only the idea, not the sentence]; call routing to record-and-upload and WAV [planned: S3b]; Flow provider [planned: S3a]; vocabulary [planned: S4].
### Steps
1. Maya clicks the settings entry, then Voice → the overlay lists "Providers"; today there is a "Connected" mark and "Speak + transcribe" / "Speak only" labels per provider.
2. She looks for where to pick a transcription provider → GAP: S1b says "a Settings, Voice row ... picks the provider and takes the key", with no position or label. She scrolls past "Speech model" and "Hear a sample".
3. She chooses "Wispr Flow" in the row and pastes her key → a "verify" runs; button text unknown (GAP; existing pattern is "Connecting…" then "Connected {name}.").
4. The key is valid → row shows Flow selected; the speech provider row still says OpenAI is connected for speaking (the plan: speech output keeps the existing provider; `null` means "use my voice provider").
5. She clicks "Call Elio" → her consent is for the old disclosure version, so the AI data prompt appears once with the extended `voice` sentence (text near the cursor and workspace names may go to the transcription provider) [planned: S1c].
6. She accepts → the call starts; the call recorder switches to 16 kHz mono WAV and uploads each utterance, even though Web Speech is available in her browser (S3b routing).
7. She says "ask Brightwell about the Halden invoice" → transcript shows both names spelled as in her workspace (bot name, contact, ticket title came from S4 vocabulary).
8. She clears the selection later via the row → secret removed; transcription goes back to her voice provider; calls revert to the old routing.
### Variations
- Mobile: native picker and secure entry in `(settings)/voice.tsx` (assumption from AGENTS.md; plan says "web and mobile" only).
- She declines the updated disclosure: GAP: discovery ambiguity 15; assumption is voice is blocked as today.
- She selects Flow before accepting new consent: any attempt to use context before consent sends audio only.
### Edge Cases
- Wrong key: `verify` rejects; message text not defined (GAP). Nothing is stored.
- Wrong hostname/connection setting: error shows as a user error without the key; text GAP.
- Consent shown during a call start vs. app launch is undefined (S1c).
- Same fact in several places: provider selection (Voice row), consent recipients (AI data sharing page lists the Flow recipient), `voice.status` (hidden). Redundant status risk.
- Vocabulary has no visible effect on providers other than Flow, so a user on OpenAI cannot see what S4 did.

## STORY-WF-7: Daily cap, long utterance and a recorder that cannot make WAV
**Type**: medium
**Topic**: Flow provider limits (daily cap, WAV limits)
**Persona**: Tomas, operations lead at Brightwell Freight (example.com), heavy call user with Flow selected
**Goal**: Keep talking to Elio after hitting the limits, or understand why he cannot.
**Preconditions**: Flow selected as transcription provider (as in WF-6); his daily recording seconds are near the cap.
**Ideal path**: 2. See a clear message and a way to continue by voice or by typing.
**Alternate paths**: Type the message in the composer; clear the Flow selection to fall back to the voice provider; use the Flow hotkey for free dictation (WF-1).
**Plan status**: cap counter and block message [planned: S3a; text, reset time and number to user GAP, discovery ambiguity 16]; size/length reject before sending [planned: S3a]; non-WAV rejection with "a clear message" [planned: S3a; when a user can hit it is GAP, discovery ambiguity 17]; 6 minute and 25 MB limits [planned: S3a].
### Steps
1. Tomas is in a call and speaks for a long stretch with no pause → utterance exceeds 6 minutes or 25 MB; request rejected before reaching Wispr; he sees a message (GAP: text).
2. He tries again with a shorter sentence → works.
3. Later in the day he hits the per-user daily cap → the transcription call is blocked with a message; Wispr is not called (message GAP: no text, no reset time, no cap number).
4. He sees the call card has stopped hearing him; he does not know whether the call is dead or just transcription → GAP: where the message appears (call card, toast, transcript) is not defined.
5. He types in the composer to continue → works; typing is unaffected.
6. He opens Settings, Voice, clears the selection → calls use the old provider again.
7. Next day his counter resets → no visible reset notice.
### Variations
- Hosted deployment with pooled allowance: the cap reuses it if the hosted-service epic landed; otherwise a simple counter. Different users see different caps (not exposed).
- Self-hosted: simple counter; same message.
### Edge Cases
- A device whose recorder cannot produce WAV: the server rejects with a clear message; Tomas cannot change a format, so the message is not actionable (ambiguity 17).
- Two processes handle his uploads: counter lives in Postgres (plan), so the cap holds; he sees no sign of this.
- The Flow dashboard cannot cap spend, so Rakazo's cap is the only limit; nothing tells Tomas it exists before he hits it.

## STORY-WF-8: A user without Flow API access looks for Flow in Voice settings
**Type**: short
**Topic**: Blocked-on-access state (roles 3 and 5)
**Persona**: Elena, project manager at Brightwell Freight (example.com), Flow Pro subscriber, no API access; she read that Rakazo works with Flow
**Goal**: Use Flow with Rakazo's calls.
**Preconditions**: S1b shipped; S3a blocked on Wispr access so no Flow provider exists; Elena has a voice provider.
**Ideal path**: 1. Learn from a short message that Flow works in the composer already and that Flow as a call provider needs API access.
**Alternate paths**: Use the Flow hotkey in the composer (WF-1); request API access from Wispr (outside Rakazo).
**Plan status**: Settings, Voice transcription row [planned: S1b]; whether the picker lists Flow when S3a is unbuilt: GAP (discovery ambiguity 14); user-facing "blocked" message: none defined; plan says "Flow API blocked on access: issues stay filed, nothing user-visible."
### Steps
1. Elena opens Settings, Voice → sees the existing provider list.
2. She looks for Wispr Flow in the list or the new transcription row → either Flow is absent (S3a has not shipped) or it is present but unusable: plan does not choose.
3. If present, she pastes her Flow consumer account token or password as a key → rejected by `verify`; wrong-key text is generic (GAP: it does not say she needs API access).
4. She asks a bot "does Rakazo work with Flow?" → the Wispr Flow tile (MCP) exists for Flow meetings; it is not dictation, and may confuse her (two Flow-related surfaces: tile and Voice row).
5. She gives up and dictates in the composer with the hotkey → works.
### Variations
- Space member who connected nothing and never dictates: sees nothing and is unaffected.
- User with Flow BAA active: Flow MCP features are blocked; irrelevant to dictation.
### Edge Cases
- Consumer Pro does not include API access, but nothing in-app says so; Elena may pay for an upgrade expecting it to work.
- Product rule says to avoid explanatory copy; the plan adds none, so this dead end has no in-app answer.

## Journey failures and gaps

1. No state or layout for the Settings, Voice transcription row: picker, key entry, verifying, error, selected, clear (Flow S1b; discovery ambiguity 14 and 23). Severity: high.
2. Whether Wispr Flow appears in the picker for users without API access, and what they are told (Flow S3a/S1b "blocked", Plan "Current state"). Severity: high.
3. Consent re-prompt trigger and the declined-consent result mid-call or at launch; the extended sentence is not written (Flow S1c). Severity: high.
4. Daily-cap block message has no text, reset time, or location in the call UI; user cannot tell a dead call from a blocked transcription (Flow S3a). Severity: high.
5. Microphone sharing between Flow and Call Elio is undefined; the plan records but does not decide (Flow S2 and S6). Severity: med.
6. Format and length rejection messages are undefined, and a user cannot act on a "non-WAV" error (Flow S3a, S3b). Severity: med.
7. Tapping "Call Elio" with no provider opens Settings, Voice with no explanation; users looking for dictation reach a call setup instead (existing `Shell.tsx` flow, Flow Summary). Severity: med.
8. The word "Voice" covers calls, speech output, and (planned) transcription; dictation via Flow is a fourth thing outside Rakazo. Naming and placement of the Flow row is unspecified (S1b). Severity: med.
9. Secure-field behavior with Flow is unverified (Flow warns web/custom password fields may be read); Rakazo has no in-app mitigation or warning (Flow S2, S6). Severity: med.
10. Multi-line insert and caret/Send behavior in the rich composer is not tested today; a dropped paragraph would be silent (Flow S2). Severity: med.
11. Flow hotkey list unread, so the desktop collision check cannot be run yet; user remaps are out of scope (open question 6, Flow S2). Severity: med.
12. Vocabulary hints (S4) have no user-visible effect for non-Flow providers and no way to inspect what was sent; with `beforeText` unused, the privacy disclosure lists context that is not yet sent (Flow S4, S1c). Severity: low.
13. Bad key and wrong hostname error text for transcription verify is undefined (S1b, S3a). Severity: low.
14. Two Flow surfaces (the MCP tile and the transcription row) are not linked; users may confuse API access with the consumer plan (Flow Summary; S5 vs S3a). Severity: low.
