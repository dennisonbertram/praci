# STORY-WF-7: Daily cap, long utterance and a recorder that cannot make WAV

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/wispr-flow/mockup.html#screen-call (Daily limit reached) and #screen-settings-voice (Connected, for Disconnect)

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- Step 1 and 2 (long utterance rejected): the plan says over 25 MB or 6 minutes is rejected before sending but defines no user-facing text. Not drawn. Treated as a plan gap, not a story failure.
- Edge case "non-WAV rejection": the mockup comment says the recorder produces WAV itself, so the user never meets the message. Treated as obsolete.
- Step 7 (counter resets): the plan says no reset time and no notice. Matches the mockup.

## Steps

- Step 1-2 [note]: Long utterance: no frame (plan has no text for it).
- Step 3 [pass]: Daily limit reached: one red line "Daily voice limit reached. You can keep typing." in the call card (step-call-cap.png), role=alert, no reset time.
- Step 4 [pass]: Mute is disabled (button disabled, text greyed from 237 to 154 grey) and End stays; the card shows the composer "Ask Elio".
- Step 5 [pass]: Composer is visible in the card, so typing continues.
- Step 6 [pass]: Settings, Voice, Connected state has Disconnect on the Flow pane (see WF-6 step-voice-connected).
- Step 7 [pass]: No reset notice drawn, as planned.

## Geometry audit
Call screen: no overflow, no wrapped controls. The Mute/End pair is a deliberately different pair (End is destructive-styled).

## 390x844 spot-check
390x844 spot-check not re-run for the call card; the 390 check in WF-6 covers the same page (scrollWidth 390, no horizontal scroll).

## Flow Log
Ideal 2 steps (see message, continue by voice or typing). Actual 2: read the line, type in the composer. The line says both what happened and what to do. No hesitations.

## Round-2 findings
- F-WF-7-1 (medium): fixed. Cap state now draws the one-line message and the composer (step-call-cap.png).
- F-WF-7-2 (low): still-open. Length/size rejection has no drawn message and the plan defines no text; the non-WAV message was dropped by decision (recorder makes WAV).
- F-WF-7-3 (low): fixed. Plan and mockup agree on the cap line, no reset time.
- F2-WF-7-1 (low): fixed. Mute is a disabled button in the cap state (disabled=true, dimmer text) as S3a requires; confirmed in the DOM.

## New findings
- None.
