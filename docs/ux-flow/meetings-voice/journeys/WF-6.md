# WF-6: Choose Wispr Flow as the transcription provider

Variations covered: WF-8 (no API access) and MB-6 (mobile call routing). Mobile settings (MB-5) is used for the phone step count.

Evidence used: the story in `docs/ux-paths/meetings-voice/catalog.md`, `docs/plans/wispr-flow.md`, the mockup `docs/wispr-flow/mockup.html` (screenshots opened and inspected, listed below), and the code the plan extends: `apps/web/src/pages/VoiceSettingsOverlay.tsx` and `apps/mobile/app/(settings)/voice.tsx`. Nothing is built, so every "planned" count is read from the plan and the mockup, not observed in a running feature. "Measured" below means counted from today's code or seen in a screenshot. "Suspected" means inferred.

Screenshots (in `WF-6-screens/`): `1-default.png`, `2-nokey.png`, `3-connected.png`, `4-blocked.png` (web Settings, Voice), `5-consent.png`, `5b-consent-settings.png`, `6-call.png`, `6b-call-cap.png`, `7-m-list.png`, `8-m-picker.png`, `9-m-key.png`, `10-m-blocked.png`.

## 1. Friction scorecard

### Steps

Today, on web (measured from `VoiceSettingsOverlay.tsx`): open Settings, open Voice, click a provider row, paste the key, click Connect. That is 5 actions. It only works for ElevenLabs, OpenAI or Fish Audio, because those show "Speak + transcribe". There is no way to choose transcription separately from speech (the provider list is the only control; line 148 onward).

Today, on the phone (measured from `voice.tsx`): same 5 actions, and the key field only appears when "This device" is off (`selected && !deviceVoice`, around line 388). Choosing a provider turns "This device" off.

As planned, web (counted from the story and mockup `settings-voice`, `consent`, `call`):

| # | Action | Needed? |
|---|---|---|
| 1 | Open Settings | yes |
| 2 | Open Voice | yes |
| 3 | Open the "Transcription" select and pick Wispr Flow | partly: a second selector next to the Providers list |
| 4 | Paste key | yes |
| 5 | Click Connect | yes |
| 6 | Click Call Elio | yes |
| 7 | Click Allow on the changed-disclosure prompt | removable from here: see below |
| 8 | Speak | yes |

Planned: 8 actions. Ideal (below): 7 actions, with no interruption at call start. The story's own "ideal path" says 6, but it leaves out "pick provider" and "speak". Counted the same way as the plan, 6 is not reachable without hiding the key step.

Planned, phone (MB-5 plus MB-6): Settings, Voice, tap "Transcription" row, tap "Wispr Flow", (back to list), paste key, Connect, Call Elio, Allow in an alert mid-call, speak = 9 actions across 3 screens (list, picker, list again). Ideal: 7.

### Decisions a default could carry

- Which transcription provider: the default "Use my voice provider" is already right for everyone who is not choosing Flow. Good.
- Whether to consent: every existing user is asked again after the version bump (`wispr-flow.md`, S1c: "existing users see the disclosure once more; this cost is accepted"). Most of them will never choose Flow, so for them this is a decision with no benefit. Measured: stated in the plan. Suspected: that this would also affect users who never speak to Elio. The plan does not say.
- "This device" versus a server provider on the phone: the user has to understand that choosing Flow overrides "This device" for listening. The plan does not say which wins (MB-6 step 2 GAP).

### Re-entry and re-asking

- The user types the key once. No re-entry unless the key is rejected.
- The AI-data consent is asked in a place the user is not looking at (Inbox card in the mockup, an alert mid-call on the phone), after they have already pressed Connect. They are asked to consent to something they already chose to turn on.
- Phone: after the user accepts, the first audio was already sent to Flow before any prompt (MB-6 step 6, from the plan's own reading of `ensureAiDataConsent`: only the speech path asks on mobile). That is a trust problem, not just a friction one.

### Confirmations

- Connect is the only deliberate action. The consent prompt is a second confirmation of the same decision. One is enough if it is placed on the action that causes the sharing (Connect), with the sentence near the button.
- "Disconnect" on web is a second route to the same result as choosing "Use my voice provider" in the select (see screenshot `3-connected.png`: both present). The plan does not say whether the select change deletes the secret.

### Dead ends

- "API access required" (`4-blocked.png`, `10-m-blocked.png`): the user sees a red line and a Connect button that does the same thing again. Nothing says what to do. Measured in the screenshot. The same words also stand in for a wrong key per the mockup comment, so a typo and a missing entitlement may look identical (suspected: depends on Wispr's error response, the plan does not say).
- Daily limit (`6b-call-cap.png`): "Daily transcription limit reached" is on the call card, with Mute and End. No reset time and no "type instead" hint. Acceptable for a rare case. The user can still type (WF-7).

### Hesitation points

- Web: two fields labelled "API key" on one screen when the user later selects a normal provider below (`2-nokey.png` shows one; the Providers pane that follows has the other, per the existing code at `apiKeyId`). Two key fields for two different providers on one page is confusing. Suspected, not seen: the mockup's lower pane is a text note, not the real pane.
- Phone: the mockup draws "This device: On · Free, works offline" with "Transcription: Wispr Flow" directly below it (`9-m-key.png`). They contradict each other as written. "Works offline" is false for listening once Flow is chosen.
- Phone mockup draws "This device" as an iOS switch. The real row is a checkmark row that is exclusive with the provider list (`voice.tsx` around lines 336-380). The mockup misrepresents today's screen. Measured.
- A "Providers" heading and a "Transcription" heading both on one screen: the user has to learn which is speech and which is listening. The labels "Speak + transcribe" and "Speak only" on provider rows already mix both words in a single phrase.

## 2. Take-away pass, per screen

### Web: Settings, Voice (`1-default.png` to `4-blocked.png`)

| Element | Verdict | Reason |
|---|---|---|
| "Transcription" select with "Use my voice provider" and "Wispr Flow" | Remove until S3a ships | With S3a blocked on API access (plan section S3a) the select has one working choice. It adds a control to every Voice page that does nothing. Measured: the mockup select has exactly two options and one is the default. |
| "Use my voice provider" wording | Rename or drop | "Voice provider" is the name used for the whole provider list, but here it means "same as speaking". Suspected confusion. If the control stays, "Same as voice" is shorter. |
| Connected badge inside the card (`3-connected.png`) | Remove | "Connected" is already stated by the existing notice (`Connected {name}.` in `VoiceSettingsOverlay.tsx`) and by the provider list. Stated twice or three times. |
| "Replace key" disabled primary button | Keep as today | Same pattern as `VoiceSettingsOverlay.tsx`; only noted because it is visually the loudest element on a Connected screen. |
| "Disconnect" button | Keep only one clearing route | Either the select clears it or this button does. Not both. |
| "Providers" list below the select | Keep | Existing. |
| Mockup notes: "Provider pane unchanged: ..." and "Nothing changes for anyone who leaves the default." | Mockup only, not UI | Not product copy. |

One primary action per screen: Connect is dominant in `2-nokey.png` and `4-blocked.png`, but in `4-blocked.png` it is the same button as before the error, so retrying without changing the key repeats the failure. Minor.

### Consent (`5-consent.png`, `5b-consent-settings.png`)

- Heading "Voice sharing has changed" and the 3-sentence body: the heading is invented (mockup comment). The body repeats the old sentence plus one new clause. Only the new clause is new information. Suspected: a user who never chose Flow cannot tell why this card appeared.
- A card on the Inbox page is the wrong place: it is not near the action that causes the sharing (Connect), and it appears on a page unrelated to voice. Plan section S1c names no screen.
- `5b-consent-settings.png`: a per-recipient toggle "Wispr Flow" with detail "Voice · recordings, text near the cursor and workspace names". This is the right granularity: one switch per recipient, existing pattern. The re-prompt for everyone is not needed if the toggle is the consent.

### Call (`6-call.png`, `6b-call-cap.png`)

- Unchanged from today by design. The cap message in red is one line and enough.
- Mockup note "With Flow transcription the call looks the same as today" is a mockup note, not UI.

### Phone: Voice and picker (`7-m-list.png` to `10-m-blocked.png`)

- `8-m-picker.png`: a full screen whose only content is two rows. One screen and one back-navigation for a binary choice. AGENTS.md says to use native iOS menus and pickers where they exist; a native inline menu (context menu or `Picker`) on the "Transcription" row would remove the screen. Suspected saving: one screen, one tap.
- "Transcription" row shows its current value on the right ("Use my voice provider" in `7-m-list.png`): the value is long enough to be truncated on small phones (suspected, 390 px wide mockup fits).
- "API access required" caption under the key (`10-m-blocked.png`): same dead end as web.
- Key field and Connect as two rows: matches today's phone pattern. Fine.

## 3. The simpler version

### Ideal steps (web)

1. Open Settings, Voice.
2. Click Wispr Flow (a row in the same Providers list, marked "Transcribe only", only present when the deployment can use it).
3. Paste the key.
4. Click Connect. The sentence that says what Flow receives sits directly under the button, and pressing Connect records consent for this recipient. No later prompt.
5. Click Call Elio.
6. Speak.

That is 6 actions from Settings and 7 counting the first click to open Settings, against 8 as planned. The saving in actions is small. The saving in attention is larger: no select to learn, no Inbox card, and no mid-call prompt.

### Ideal steps (phone)

1. Settings, Voice.
2. Tap "Transcription", pick Wispr Flow in the native menu on the same screen (no picker screen).
3. Paste key, Connect (consent line under the button).
4. Call Elio, speak.

Seven actions against nine, three screens down to one.

### Concrete plan changes

1. `wispr-flow.md`, section S1c "Consent for the transcription recipient and context", and the shipping-order line at the end ("After S1: S1b, then S1c"): do not bump `AI_DISCLOSURE_VERSION` for everyone. Record consent per recipient when the user presses Connect for Flow (the AI data sharing page already lists one toggle per recipient, see `5b-consent-settings.png`). Existing users who never choose Flow see nothing. This removes the "accepted cost" in the plan, and removes MB-6 steps 5 to 7 (alert mid-call). Feasibility of per-recipient consent in the existing consent model is suspected, not checked; whoever takes S1c should confirm against `apps/api/src/ai-consent.ts`.
2. S1b "Transcription provider selection and credential", issue for the Settings, Voice row: split the backend (selection table, RPCs, `verify`) from the UI row, and ship the UI row with S3a. Today the row would list one real option, and S3a is blocked on API access (plan section S3a; ordering line 199). This also resolves WF-8: a user without access never sees a Flow option, so there is nothing to explain.
3. S1b, web layout: show Flow as a row in the existing Providers list, marked "Transcribe only", instead of a second select above it. The catalog already carries the speech/transcription flags (plan section 1, "The catalog marks entries as speech, transcription, or both"), so this reuses the existing pane, the existing key field and the existing Connect button. The mockup comment itself chose the opposite ("only in the select, so the list is unchanged"); that choice keeps the list unchanged but adds a second control, which costs more. Suspected tradeoff: a "Transcribe only" row can imply it replaces the speech provider, so the row needs a clear subtitle; "Transcribe only" mirrors the existing "Speak only".
4. S1b, mobile layout: native inline menu for "Transcription", not a picker screen. Same row, same key rows below.
5. S3b "WAV capture and server routing for Flow": state which wins when "This device" is on and a transcription provider is connected. Recommendation: the transcription provider wins for listening, and the "This device" subtitle stops saying "works offline" while a server transcription provider is set. This closes MB-6 step 2.
6. S1c: on mobile the audio is sent before any prompt (MB-6 step 6). With change 1, consent is given at Connect, so the first audio never precedes consent. If change 1 is not adopted, S1c needs a prompt before the first recording is uploaded.
7. Error text, S1b and S3a: if Wispr's response can tell "no API access" from "bad key", show two different messages, and for the first one name the next step in a few words (for example, "This key has no API access. Ask Wispr to enable it."). If it cannot, use the single existing "Could not connect this voice provider". Do not ship a message that is correct only half the time. Suspected whether the API response differs; the plan does not say.

## 4. Clarity issues

- "Use my voice provider": the same words "voice provider" name the whole Providers list. In this control they mean "the provider I already use for speaking". A user may read it as "use the provider selected below".
- "Transcription": a feature word. A founder asks "who types what I say", not "which transcription provider". Fine as a label; the first-time explanation comes from the row's subtitle ("Transcribe only"), not from added paragraphs.
- Two "Connected" words for different things on `3-connected.png`: Flow is connected (card) and ElevenLabs is connected (list). They look the same and are adjacent.
- Phone: "This device ... On · Free, works offline" next to "Transcription: Wispr Flow" (`9-m-key.png`) says two things at once about listening.
- Mockup copy to confirm or remove before it reaches the PR: "Voice sharing has changed" (invented), "API access required" (invented), "Daily transcription limit reached" (invented). AGENTS.md requires each visible phrase to be quoted and justified in the PR description. My view: keep only the cap message; the consent line becomes one sentence under Connect; "API access required" only if the response can distinguish it.

## Variations

### WF-8 (user without API access)

- As planned: the story's own conclusion is that nothing is user-visible (plan: "Flow API blocked on access: issues stay filed, nothing user-visible"). If the S1b select ships first, Elena sees a Flow option she cannot use, and the generic wrong-key text may lead her to buy an upgrade. Fix is change 2 above: ship the UI row with S3a so the dead end is not shipped. Verdict for WF-8 on the current plan: dead end (if S1b UI ships first), no friction if it ships with S3a.
- The Flow MCP tile and a Flow dictation row would be two Flow-related surfaces (WF-8 step 4). Not a duplication yet; keep an eye on it once S3a exists. No change proposed now.

### MB-6 (phone call routing)

- Steps, as planned: Call Elio, mid-call consent alert, unmute, Allow, speak. 3 extra actions from an interruption that the user did not start. With change 1 (consent at Connect), this is "Call Elio, speak": 2 steps, matching the story's own ideal path.
- Routing precedence between "This device" and the server provider is not decided in the plan (change 5).
- WAV capture on device is unverified in the plan itself ("Unverified until run on device"); not a UX finding.

## Verdict: convoluted

Three structural problems, each worth fixing before build:
1. A global consent re-prompt for a feature few users will choose, shown away from the action that causes the sharing, and on phone after audio is already sent.
2. A control (the Transcription select or picker screen) that ships before its only non-default option can work, which gives a dead end for WF-8.
3. A second selector placed beside the existing Providers list, which duplicates the provider concept and creates two "API key" fields and two "Connected" signs on one page; on the phone it costs a full picker screen for two rows.

Steps: planned 8 (web) and 9 (phone) versus ideal 7 and 7. The count is close; the weight is in the interruptions and extra surfaces, not the clicks.
