# Wispr Flow manual checklist (S6)

Plan: `docs/plans/wispr-flow.md`. Issue: #451. For a person with a Wispr Flow account.

Flow is a separate app. Praci does not ship dictation, so these checks show how Praci behaves as a host for Flow. Nothing here is assumed to work. Leave a result as TBD until you run the row. A row not run stays "not run", never "pass".

Do not put account names, emails, local paths or real transcripts in the results. Dictate invented sentences only.

## Setup

Record once per session, then repeat the rows on each surface.

| Item | Value |
|---|---|
| Flow version (desktop) | TBD |
| Flow version (iPhone) | TBD |
| Desktop OS and version | TBD |
| iPhone model and iOS version | TBD |
| Praci build or commit | TBD |
| Browser and version | TBD |

Result values: pass, fail, partial, not run. Put anything unexpected, and any fallback you used, in Notes.

Test sentences (invented):

- Short: "Please schedule a review for next week."
- Paragraphs: dictate three sentences, say "new paragraph", then dictate three more.
- Slash: say "slash summarize" so the text begins with `/`.
- Mention: say "at" followed by a teammate's first name so the text begins with `@`.

## 1. Composer dictation

Open a thread. Put the cursor in the message field, start Flow, dictate, stop Flow.

| # | Surface | Steps | Expected | Flow version | OS / device | Result | Notes |
|---|---|---|---|---|---|---|---|
| 1.1 | Web composer | Dictate the short sentence. | Text appears in the field, draft is kept, Send is enabled. | TBD | TBD | TBD | TBD |
| 1.2 | Web composer | Dictate the paragraphs sentence. | All paragraphs inserted, line breaks kept, caret ends after the inserted text, draft kept, Send enabled. | TBD | TBD | TBD | TBD |
| 1.3 | Web composer | Dictate the slash sentence into an empty field. | Record what opens (skill picker or nothing) and whether the text stays editable. | TBD | TBD | TBD | TBD |
| 1.4 | Web composer | Dictate the mention sentence into an empty field. | Record what opens (mention picker or nothing) and whether the text stays editable. | TBD | TBD | TBD | TBD |
| 1.5 | Web composer | Dictate, reload the page before sending. | Record whether the draft survives. | TBD | TBD | TBD | TBD |
| 1.6 | Electron composer | Repeat 1.1 to 1.4 in the desktop app. | Same as the web rows. | TBD | TBD | TBD | TBD |
| 1.7 | iPhone composer | Tap the message field, hold the globe key, switch to the Flow keyboard, dictate the short sentence. | Text appears, Send enabled. | TBD | TBD | TBD | TBD |
| 1.8 | iPhone composer | Dictate the paragraphs sentence with the Flow keyboard. | Line breaks kept, caret after the text, field grows, Send enabled. | TBD | TBD | TBD | TBD |
| 1.9 | iPhone composer | Dictate the slash and mention sentences. | Record whether the skill and mention pickers open. | TBD | TBD | TBD | TBD |
| 1.10 | iPhone composer | Switch away from the Flow keyboard and back. | Draft kept, keyboard returns to the normal one. | TBD | TBD | TBD | TBD |

## 2. Call Elio and the microphone

No expectation is set. Record what happens. Do this on web and on the phone.

| # | Surface | Steps | Record | Flow version | OS / device | Result | Notes |
|---|---|---|---|---|---|---|---|
| 2.1 | Web | Start Call Elio, then start Flow dictation in another field or app. | Does the call keep hearing you, does Flow get audio, does either one stop or show an error? | TBD | TBD | TBD | TBD |
| 2.2 | Web | Start Flow dictation first, then start Call Elio. | Same as 2.1. Does the browser ask for the microphone again? | TBD | TBD | TBD | TBD |
| 2.3 | Phone | Start Call Elio, then try the Flow keyboard in the composer. | Same as 2.1. Does the call end, mute or continue? | TBD | TBD | TBD | TBD |
| 2.4 | Phone | Use the Flow keyboard first, then start Call Elio. | Same as 2.1. | TBD | TBD | TBD | TBD |
| 2.5 | Web, phone | Open Call Elio with no voice provider connected. | Quote exactly what Call Elio shows. | TBD | TBD | TBD | TBD |

## 3. Password, token and secret inputs

Flow's page says its Context Awareness may read custom or web-based password fields like ordinary text. Praci keeps the native secure input types and does not rely on Flow skipping them. Use a fake value such as `test-key-0000`. Never use a real key.

For each field, focus it, start Flow, dictate "test key zero zero zero zero", and record: did Flow insert text, and did Flow appear to read the field (for example a Context Awareness indicator, or changed output that depends on nearby text).

| # | Field | Surface | Flow inserted text? | Flow read the field? | Flow version | OS / device | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| 3.1 | API key field in Settings | Web | TBD | TBD | TBD | TBD | TBD | TBD |
| 3.2 | API key field in Settings | Electron | TBD | TBD | TBD | TBD | TBD | TBD |
| 3.3 | Integration key or token field (for example a connected app key) | Web | TBD | TBD | TBD | TBD | TBD | TBD |
| 3.4 | Integration key or token field | Electron | TBD | TBD | TBD | TBD | TBD | TBD |
| 3.5 | Voice provider key field | Phone | TBD | TBD | TBD | TBD | TBD | TBD |
| 3.6 | Integration key or token field | Phone | TBD | TBD | TBD | TBD | TBD | TBD |
| 3.7 | Sign-in password field | Web | TBD | TBD | TBD | TBD | TBD | TBD |
| 3.8 | Sign-in password field | Phone | TBD | TBD | TBD | TBD | TBD | TBD |

Also record, for each iPhone row, whether iOS switches away from the Flow keyboard in that field by itself.

## 4. Flow hotkey and Praci shortcuts

| # | Steps | Expected | Flow version | OS / device | Result | Notes |
|---|---|---|---|---|---|---|
| 4.1 | Write down your Flow hotkey here (a key combination, not an account detail): TBD. | n/a | TBD | TBD | TBD | TBD |
| 4.2 | In the Electron app, press the Flow hotkey with the composer focused. | Flow starts. Praci does not also act on the key. | TBD | TBD | TBD | TBD |
| 4.3 | Press each Praci desktop shortcut (global and in-window). | None of them is the Flow hotkey. List any collision. | TBD | TBD | TBD | TBD |
| 4.4 | Press the Flow hotkey on the web app in a browser. | Flow starts. Praci does not also act on the key. | TBD | TBD | TBD | TBD |

## 5. Secure-field requirements for a future Flow key field

Applies only once a Flow key field exists (slice S3a). Until then these rows stay not run. The Flow key field must match every other secret input.

| # | Requirement | How to check | Result | Notes |
|---|---|---|---|---|
| 5.1 | `secureTextEntry` is set on the phone field. | Characters are masked while typing. | not run | TBD |
| 5.2 | `autoComplete="off"` | No password manager or autofill prompt appears. | not run | TBD |
| 5.3 | `textContentType="none"` | iOS offers no password or one-time code suggestion. | not run | TBD |
| 5.4 | Web field is a password-type input. | Masked; the value is not shown in the page. | not run | TBD |

## 6. Blocked until API access

These need Wispr's Voice Interface API, which is available only by exclusive access, and slices S3a and S3b. Do not run them yet. Mark them unverified.

| # | Check | Expected | Status | Result |
|---|---|---|---|---|
| 6.1 | A "Transcribe only" row appears in the Voice providers list only after the readiness check is on. | Hidden before, visible after. | blocked, not runnable yet | not run |
| 6.2 | Connect with a rejected key. | The existing "Could not connect this voice provider" message; Connect disabled until the field is edited. | blocked, not runnable yet | not run |
| 6.3 | The sentence under Connect. | Reads exactly: "Sends your recordings and workspace names to Wispr Flow." Hidden once connected. | blocked, not runnable yet | not run |
| 6.4 | Connect with a valid key. | Row status reads "Transcribing". Speech provider unchanged. | blocked, not runnable yet | not run |
| 6.5 | A call after Connect. | Speech is transcribed by Flow; no consent prompt. | blocked, not runnable yet | not run |
| 6.6 | Turn off AI data sharing for Flow. | Row reads "AI data sharing off"; calls fall back to the voice provider. | blocked, not runnable yet | not run |
| 6.7 | Daily cap reached. | Line reads exactly: "Daily voice limit reached. You can keep typing." | blocked, not runnable yet | not run |
| 6.8 | Disconnect. | Transcription returns to the voice provider. | blocked, not runnable yet | not run |

## After a run

List every row still "not run" and why, in the PR or issue that records the run.
