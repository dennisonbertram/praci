# STORY-WF-6: Choose Flow as the transcription provider (user with API access)

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/wispr-flow/mockup.html: #screen-settings-voice (Default, Wispr Flow no key, Verifying, Connected, Key rejected), #screen-consent, #screen-call (During a call)

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- Step 1/2: the plan (D3) has no separate "Transcription" selector. Flow is a "Transcribe only" row in the existing providers list. The story already describes this and matches.
- Step 3 spinner: the plan says AI shimmer on the button text on web; the mockup draws "Connecting..." text with shimmer. Matches.
- Step 5: no consent prompt, because Connect is the consent act. Matches the plan (S1c/S3a) and the mockup (no prompt frame).

## Steps

- Step 1 [pass]: Settings, Voice lists the providers; Flow is the fifth row, "Transcribe only" (step-voice-default.png). Default pane is still the ElevenLabs pane, so users who ignore Flow see only one extra row.
- Step 2 [pass]: Tap Wispr Flow: pane switches to an empty API key field, disabled Connect, and the one sentence "Sends your recordings and workspace names to Wispr Flow." (step-voice-empty.png). Selected row has a 3 px bar.
- Step 3 [pass]: Verifying: field and button disabled, button text "Connecting..." (step-voice-verifying.png); sentence stays. Auto-advances to Connected after about 1.2 s.
- Step 4 [pass]: Connected: Flow row status word "Transcribing" in the success colour; ElevenLabs keeps "Connected"; pane shows "Replace key" and Disconnect; sentence is gone (step-voice-connected.png).
- Step 5 [pass]: AI data sharing lists "Wispr Flow" with its own toggle (step-consent.png). No prompt frame, as planned.
- Step 6 [pass]: Call card during a call looks like today's call (step-call-normal.png). Recorder switch to WAV is internal, not drawable.
- Step 7 [note]: Spelled names from vocabulary are not visible in any frame; the caption shows Elio's line only.
- Step 8 [pass]: Disconnect returns the pane to Default (verified by click); rejected path (step-voice-rejected.png): red border, "Could not connect this voice provider", Connect disabled until the field is edited.

## Geometry audit
geometry-audit.js on the page at 1280x900: pageOverflowX 0; no overflow spills. unevenRows are only the state-pill strips (intentional), the provider list vs pane (280 vs 460 intentional) and the Replace key/Disconnect pair (100 vs 91 px, label-driven). wrappedControls (8) are the two-line provider rows (title plus subtitle by design) and are not defects.

## 390x844 spot-check
390x844 spot-check of the Connected state (mobile-check-390.png): no horizontal scroll (scrollWidth 390), the pane stacks under the list, buttons stay on one line.

## Flow Log
Ideal 6 steps (open Voice, pick provider, paste key, Connect, accept disclosure, start call). Actual 5 (open Voice, tap Flow row, paste, Connect, Call Elio): the consent step collapsed into Connect, so the mockup is one step shorter than the ideal. No hesitations. The same fact appears twice on screen (status "Transcribing" in the row and the pane state) but this is the pattern for every provider.

## Round-2 findings
- F2-WF-6-1 (medium): fixed. Connected state shows "Transcribing" on the Flow row (green on web) while ElevenLabs keeps "Connected" (step-voice-connected.png); plan S3a states "After Connect, Flow is the transcriber and its status word is Transcribing".
- F2-WF-6-2 (low): still-open. The consent-off effect (existing consent prompt on the next call) has no frame; only the AI data sharing toggles are drawn (step-consent.png). The plan calls it the existing prompt, so this stays low.

## New findings
- F3-WF-6-1 (low, plan): Step 7 of the story (names from the workspace spelled correctly) has no visible frame. The call card shows only Elio's line, so the effect of vocabulary hints cannot be seen in the mockup or by a user. Fix: Optional: no change needed if the call card never shows the user's words today; keep as a note for the S4 manual checklist.
- F3-WF-6-2 (low, plan): With Flow connected, ElevenLabs still reads "Speak + transcribe" and "Connected" while Flow reads "Transcribing". Two rows describe transcription and only one does it. Fix: Low priority. The selected-row bar and "Transcribing" word already disambiguate.
