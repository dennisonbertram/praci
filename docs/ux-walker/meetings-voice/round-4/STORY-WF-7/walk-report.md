# STORY-WF-7: Daily cap, long utterance and a recorder that cannot make WAV

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/wispr-flow/mockup.html#screen-call (Daily limit reached) and #screen-settings-voice (Connected, for Disconnect)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- Steps 1 and 2 (long utterance rejected): the plan rejects over 25 MB or 6 minutes before sending but defines no user-facing text, so nothing is drawn. Plan gap, not a story failure.
- Edge case non-WAV rejection: the recorder produces WAV itself (mockup comment), so the user never meets it. Obsolete.
- Step 7: no reset notice, as the plan decides.

## Steps

- Step 1-2 [note]: no frame for the length/size rejection; the plan has no text for it.
- Step 3 [pass]: Daily limit reached: one red line in the call card, "Daily voice limit reached. You can keep typing.", no reset time (step-call-cap.png).
- Step 4 [pass]: Mute is a disabled button in the cap state (disabled=true in the DOM), End stays active; the call card has no input.
- Step 5 [pass]: The "Ask Elio" composer sits below the call card, outside it, matching TX-5/TX-20 and the plan ("the thread composer stays available below the call card"). Round 3 drew it inside the card; that is fixed.
- Step 6 [pass]: Settings, Voice, Connected shows Disconnect on the Flow pane; clicking it returns the overlay to Default (verified) (step-voice-connected.png).
- Step 7 [pass]: No reset notice, as planned.

## Geometry audit
geometry-audit.js per state at 1280x900 and 390x844: pageOverflowX 0 in every state; no overflow spills. unevenRows are only the state-pill strips and the Replace key/Disconnect pair (label-driven widths). wrappedControls are the two-line provider rows (title plus subtitle by design), not defects.

## 390x844 spot-check
390x844 call-cap state: no horizontal scroll (mobile-check-390.png).

## Flow Log
Ideal 2 (see the message, continue by voice or typing). Actual 2: read the line, type in the composer. The line says what happened and what to do. No hesitation.

## Round-3 findings
- F-WF-7-2 (low): still-open. No drawn message and no plan text for the length/size rejection; the non-WAV message is dropped by decision. Unchanged and decided, not re-raised.

## New findings
- None.
