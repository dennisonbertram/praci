# STORY-MB-6: Call Elio with Flow selected, on a phone that can recognize speech itself

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/wispr-flow/mockup.html#screen-mobile (Connected, AI data sharing off) and #screen-call (the web call card, the only drawn cap line)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- Steps 1 to 5: call routing, WAV capture and the call screen are not drawn on the phone (the mockup comment says call routing is not drawn). The plan defines them as backend/client behaviour; walked what the plan draws.

## Steps

- Step 1-5 [note]: no phone call frame. The Connected frame shows the Flow row "Transcribing" with "This device" still checked, which is the only visible precondition (step-connected.png).
- Step 6 [pass]: With AI data sharing off the Flow row reads "AI data sharing off" and links to the setting, so there is no prompt at call start (step-aioff.png).
- Step 7 [note]: The daily-limit caption is drawn only on the web call card (step-call-cap-web.png). The plan says the phone shows it once through the existing error caption, the call stays open for typing, and uploads stop until the next call or the reset.

## Geometry audit
Voice frame: see MB-5. Call card: pageOverflowX 0, no wrapped controls.

## 390x844 spot-check
Phone Voice frame fits 390x844 (see MB-5).

## Flow Log
Ideal 2 (tap Call Elio, talk). Actual: not drawable beyond the settings precondition. No extra choices in the plan.

## Round-3 findings
- F3-MB-6-1 (low): still-open. Still no phone call frame for the cap caption. The plan now states the phone path (the existing error caption, shown once, composer stays), so this stays a low mockup note.

## New findings
- None.
