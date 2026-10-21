# Walk report: STORY-WF-8

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **fail (1 high plan finding)**.

## Steps

1. Settings, Voice: the Transcription select is present and Wispr Flow is selectable (screenshots/step-2.png, Wispr#screen-settings-voice, API access required).
2. Choose Wispr Flow: the mockup lists Flow even though S3a may not exist, so the plan's open choice (JF-13) is resolved as 'present but unusable'.
3. Paste a key and press Connect: red field border and a line "API access required" under the field; the Connect button stays enabled, the pasted key stays in the field. The user learns about API access only after pasting a consumer token or password into a key field, which is also a security smell. The line says what is wrong but not what to do next (use the hotkey in the composer; ask Wispr for access).
4-5. Two Flow surfaces (MCP tile vs Voice row), then hotkey dictation: not drawn.
LOOK: red text and border consistent with the rejected state; a11y: textbox "API key", combobox "Transcription", alert role present. Geometry: pageOverflowX 0; only state-pill hit. Mobile spot-check (mobile-check.png): stacks, no overflow.

## Flow Log

Ideal 1 step (learn from a short message that Flow works in the composer already and API access is needed for call transcription). Actual: select Flow, paste a key, press Connect, read 'API access required', no next step: 3 extra steps and a dead end. Data re-entry: the pasted key cannot be reused.

## Findings (3)

- F-WF-8-1 [plan, high, flow] A user without API access is shown Flow as selectable, must paste a consumer key to find out, and ends on 'API access required' with no next step. (ref: JF-13)
- F-WF-8-2 [plan, medium, error-handling] The error says what is missing but nothing about the composer hotkey, which already works for dictation. (ref: JF-13)
- F-WF-8-3 [plan, low, happy-path] 'API access required' is new copy beyond the plan. (ref: JF-33)

## Screenshots

- screenshots/mobile-check.png
- screenshots/step-2.png
