# NEW-6: Starting a first voice call with Elio

Stories: EL-1 to EL-5 (docs/ux-paths/topics/new-elio-voice.md). Only EL-5 Case A was walked. EL-1 to EL-4 and EL-5 Case B were blocked: the demo stack does not offer the Scripted provider and rejects it with 400 "Unknown voice provider" (STORY-EL-5/findings.json, F-EL-5-4). Everything about the call card, hang-up, the Elio chat and delegation is therefore SUSPECTED, read from the story text and code references, not seen.
Evidence: docs/ux-walker/stories/STORY-EL-1 to EL-5 (walk-reports, findings.json; every screenshot in STORY-EL-5 opened, the other four stories have none). Issue #153 covers the first-run explanation; this report notes where it overlaps.

## Friction Scorecard

Seen path (EL-5 Case A, no voice provider connected):

| Measure | Result | Evidence |
|---|---|---|
| Steps, ideal vs actual | Ideal for a first-time user with no provider: press Call Elio, connect a provider, and land in a call (about 3 actions, story EL-5 ideal path). Actual: press Call Elio, Settings opens; Connect needs a provider choice and key; after closing Settings the user is back in the chat with no call. The user must press Call Elio a second time. Walker count: 1 click to reach the form, then the flow stops. | EL-5 walk-report items 2-3; step-1.png, step-2.png |
| Decisions a default could carry | (1) Which of four providers (ElevenLabs, OpenAI, Cartesia, Fish Audio). No default is selected, and the key field and a disabled Connect button show with no provider chosen. (2) After connecting, whether to start the call: the user has to press Call Elio again. | step-1.png; F-EL-5-2 |
| Re-entry | The user presses the same button twice. The walker did not run the connect step, so whether the call starts on its own after Connect is unknown (suspected: it does not, per the story). | EL-5 story steps 1-2 |
| Needless confirmations | None seen. | - |
| Dead ends | Yes. Closing the Voice dialog returns to an unchanged chat: no call, no message saying a provider is needed or what to do next. | step-2.png; F-EL-5-1 |
| Hesitations | (1) The mic button sits in Chief's composer and is named only "Call Elio"; it reads as calling Chief or as dictation. (2) Who Elio is is never said. (3) The Voice dialog asks for an API key with no sentence tying it to the call. (4) Hover showed no tooltip. | step-0.png, step-0b-hover.png, step-1.png; F-EL-5-1, F-EL-5-3 |

Not seen (suspected, from the story): after a provider is connected, one click starts the call and Elio is created on first use (EL-1 ideal path of 2). If true, the connected path is minimal and all the cost sits in the first-run provider setup.

## Take-away Pass

Screen: Chief chat with the mic button (step-0.png; mobile-0.png).
- Mic button: the only voice entry. Keep. Its icon is the same filled mic used for dictation; walker suggests a phone icon (F-EL-5-3). The button is 32x32 px on both widths (walker measurement).
- The mic sits beside a disabled Send arrow on an empty draft, which is normal.
- Nothing in the composer tells the user the call goes to Elio and not to Chief. That is missing, not removable.

Screen: Settings, Voice dialog opened from Call Elio (step-1.png; mobile-1.png).
- Left settings nav (General, Models, Memory, Voice, Usage, Updates): unrelated to the task of making a call. It is the normal Settings frame. Removing it would mean a dedicated first-run surface; do not do that for this issue, see changes below.
- Provider list: needed, but it shows four options with no default. Suspected cost is the choice itself.
- API key field and disabled Connect shown before a provider is chosen: take-away candidate. Without a selected provider they cannot be used (F-EL-5-2). On desktop about 70 percent of the dialog is empty.
- Close X: needed.
- Missing, not removable: one line saying a provider is needed to call Elio (F-EL-5-1).

Screen: chat after closing (step-2.png). Unchanged chat; nothing to remove, but nothing to act on.

Call card, Transcript, Mute, Hang up, Voice chat card, Elio chat, "Messaged Finance" marker (EL-1 to EL-4): not seen. No take-away judgment is made.

## The Simpler Version

For a user with no provider:
1. Maya presses Call Elio in any chat.
2. The Voice dialog opens with one line at the top, shown only in this case: "Connect a voice provider to call Elio." One provider is preselected (or the key field appears only after one is chosen).
3. She pastes a key and presses Connect.
4. The dialog closes and the call starts without a second press. (Suspected that today it does not; needs verification.)

For a user with a provider (suspected, not walked): press Call Elio and the call starts; this is already 1 step.

Concrete changes:
1. In the Voice dialog, only when it was opened from Call Elio, show the single line above (F-EL-5-1). This overlaps issue #153. Per the repo copy rule, the PR must quote the line, say it appears only in this moment, and explain why it cannot be dropped: without it the user gets an API-key form after asking for a call.
2. Show the key field and Connect only after a provider is chosen, or preselect the first provider (F-EL-5-2). Removes empty chrome and the unanswerable "key for which provider" question.
3. After a successful Connect that began from Call Elio, start the call automatically. Removes the second press and the dead end after closing. Needs confirmation that this is not already the behaviour.
4. Name Elio at the entry point only where needed: the call card already shows the name, which is the first moment it matters (suspected, not seen). Do not add explainer text to the composer. If the label alone must change, keep "Call Elio" and change the icon to a phone (F-EL-5-3). Opening the first call is the moment to learn who Elio is, and the card is the place; this stays unverified until the call can be walked.
5. Demo stack: enable the Scripted provider so EL-1 to EL-4 can be walked (F-EL-5-4). This is a test-tooling gap, not a product change.

## Clarity Issues

1. A request for a call returns a settings form with no explanation (F-EL-5-1, step-1.png). High confidence.
2. "Elio" is unexplained and sits inside Chief's chat, so it reads as calling Chief (EL-5 walk-report, Hesitations; story EL-1 edge case). High confidence for the entry point; the call card name is the suspected fix.
3. The mic icon is also the dictation icon, and the tooltip did not appear in the walker's 1 s hover (F-EL-5-3). The tooltip may need a longer delay; the walker did not confirm either way.
4. "API key" with no chosen provider is ambiguous (F-EL-5-2).
5. After closing Settings there is no cue that a call still has not started (step-2.png).
6. Suspected, not seen: the error text "Could not start the call" (Case B), the "Voice chat" card with a duration, the "Messaged {peer}" marker meaning delivery only, and that the user cannot tell which chats Elio read for a history answer (stories EL-2 to EL-4). Judge after the Scripted provider is available.

## Verdict: acceptable (provisional)

The seen path has two removable or fixable items (empty key field, no explanation or follow-through after the Voice dialog) and one dead end, so it is not minimal. It is not convoluted: the structural flow (one button, one settings stop) is short. The verdict is provisional because EL-1 to EL-4 and EL-5 Case B were not walked.
