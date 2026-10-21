# STORY-MB-5: Choose a transcription provider in Settings, Voice on the phone

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/wispr-flow/mockup.html#screen-mobile (Voice, Wispr Flow key, Verifying, Key rejected, Connected, AI data sharing off)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- Steps 1 and 2: plan D3 has no picker and no "Transcription" row; Flow is a "Transcribe only" row in the providers list. Followed the plan.

## Steps

- Step 1 [pass]: Voice: large title, a "This device" group with the single checkmark, a "Providers" group with ElevenLabs (Connected), OpenAI, Fish Audio, Cartesia and Wispr Flow "Transcribe only". Rows 62 to 63 pt (step-list.png). TX-18 added Fish Audio.
- Step 2 [pass]: Tap Wispr Flow: a "Wispr Flow" group header, a secure row with the placeholder "API key", a dimmed full-width Connect, and the footer sentence (step-key.png). The key group appears below the whole providers list, not as a pushed screen, but the header says what it belongs to.
- Step 3 [pass]: Verifying: field disabled, "Connecting..." with an indicator, footer stays (step-verifying.png); typing in the field enables Connect and tapping it enters Verifying then Connected (verified by click).
- Step 4 [pass]: Rejected: red "Could not connect this voice provider", Connect dimmed until edited (step-rejected.png).
- Step 5 [pass]: Connected: Flow row reads "Transcribing" in the success colour (rgb 79,179,127, same as web); "This device" keeps its checkmark and drops "works offline" (step-connected.png).
- Step 6 [pass]: Disconnect is a red row under the "Wispr Flow" header and returns to the list state (verified).
- Step 7 [pass]: AI data sharing off: the Flow row reads "AI data sharing off" in amber with a chevron (63 pt row, links to the AI data sharing screen) and the Disconnect group stays (step-aioff.png). TX-4/TX-20 applied.

## Geometry audit
geometry-audit.js per state at 1280x900 and 390x844: pageOverflowX 0, no overflow spills. Flagged wrappedControls are the 44 pt glass back glyph and the one-word Connect action (tall native button, not a wrapped label). Measured on the phone: back 44x44, action button 48 pt, rows 52 to 63 pt, check/to-do hit areas 44x44, subtitle and footer 13 to 14 px.

## 390x844 spot-check
390x844: the phone frame fits, no horizontal scroll (mobile-check-390.png). The body scrolls inside the frame (scrollHeight 653 vs 593 in the key state).

## Flow Log
Ideal 3 (open Voice, pick Flow, paste and confirm). Actual 3 to 4 (open Voice, tap Flow row, paste, Connect). Hesitation is small now: the key group has its own "Wispr Flow" header, so Disconnect clearly belongs to Flow.

## Round-3 findings
- F3-MB-5-1 (medium): fixed. The key group and the Disconnect row now sit under a "Wispr Flow" group header (step-key.png, step-connected.png), per TX-16. The pushed-detail alternative was not adopted; decided.
- F3-MB-5-2 (low): fixed. "Transcribing" and "Connected" both render rgb(79,179,127) on the phone (measured), matching web (TX-18).
- F3-MB-5-3 (low): obsolete. The reading of the phone checkmark is decided (RX-59).
- F-MB-5-6 (low): still-open. Disconnect is a red row that acts at once; decided (FX-63).

## New findings
- F4-MB-5-1 (low, mockup): In the Wispr Flow, key and Key rejected states the consent sentence (the footer under Connect) is below the bottom edge of the frame; the user has to scroll to read it. The mockup has no Typing state for this screen (Granola's phone frame got one in TX-13), so with the keyboard open the footer and possibly Connect would be hidden. Fix: Add a Typing state as on the Granola phone frame, or scroll the frame so the key group is in view.
