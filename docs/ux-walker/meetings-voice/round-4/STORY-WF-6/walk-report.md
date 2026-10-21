# STORY-WF-6: Choose Flow as the transcription provider (user with API access)

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/wispr-flow/mockup.html: #screen-settings-voice (Default, Wispr Flow no key, Verifying, Connected, AI data sharing off, Key rejected), #screen-consent (Wispr Flow off), #screen-call (During a call)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- Step 1 and 2: plan D3 has no separate selector. Flow is a "Transcribe only" row in the providers list; the story matches.
- Step 4: the web Voice pane has no "This device" row and no checkmark (that is the phone, see MB-5); the speech provider row is ElevenLabs, which keeps "Connected".

## Steps

- Step 1 [pass]: Settings, Voice: five provider rows, Wispr Flow last with "Transcribe only"; the pane still shows ElevenLabs, so users who ignore Flow see one extra row (step-voice-default.png).
- Step 2 [pass]: Tap Wispr Flow: 3 px selected bar, pane headed "Wispr Flow", empty API key field, dimmed Connect, and the one sentence "Sends your recordings and workspace names to Wispr Flow." (step-voice-empty.png).
- Step 3 [pass]: Verifying: field and button disabled, "Connecting...", the sentence stays (step-voice-verifying.png); auto-advances after about 1.2 s.
- Step 4 [pass]: Connected: row status "Transcribing" in the success colour (rgb 79,179,127), pane shows Replace key and Disconnect, sentence gone (step-voice-connected.png).
- Step 5 [pass]: Consent is not asked at call start. AI data sharing lists "Wispr Flow" with its own toggle; clicking the "AI data sharing off" status on the row (44 px high) opens that screen with the Wispr Flow off state selected (step-voice-aioff.png, step-consent-off.png). New since round 3: TX-4/TX-20 drew the consent-off row.
- Step 6 [pass]: Call card looks like today's call (step-call-normal.png). The recorder switch to WAV is internal and cannot be drawn.
- Step 7 [note]: Spelled workspace names have no frame; the caption shows only Elio's line.
- Step 8 [pass]: Disconnect returns to Default (verified by click); rejected path shows the red border and "Could not connect this voice provider" (step-voice-rejected.png).

## Geometry audit
geometry-audit.js per state at 1280x900 and 390x844: pageOverflowX 0 in every state; no overflow spills. unevenRows are only the state-pill strips and the Replace key/Disconnect pair (label-driven widths). wrappedControls are the two-line provider rows (title plus subtitle by design), not defects.

## 390x844 spot-check
390x844: the Connected state fits with no horizontal scroll and the pane stacks under the list with a small gap (mobile-check-390.png). The list is 280 px wide and the pane 332 px, see F4-WF-6-1.

## Flow Log
Ideal 5 (open Voice, tap Flow row, paste key, Connect, call). Actual 5. No hesitation. The same status appears in the row and in the pane header, which is the pattern for every provider.

## Round-3 findings
- F3-WF-6-1 (low): still-open. Workspace names are still not visible in any frame (step-call-normal.png); the call card shows only Elio's line. Kept as a note for the S4 manual checklist.
- F3-WF-6-2 (low): still-open. ElevenLabs still reads "Speak + transcribe" and "Connected" while Flow reads "Transcribing" (step-voice-connected.png). The selected bar and the word disambiguate; not re-raised.
- F2-WF-6-2 (low): fixed. The consent-off effect is now drawn: the Flow row reads "AI data sharing off" and links to the AI data sharing screen (step-voice-aioff.png, step-consent-off.png).

## New findings
- F4-WF-6-1 (low, mockup): At 390 px wide the provider list is 280 px wide and the Wispr Flow pane below it is 332 px wide, so the two stacked blocks have different widths and edges. Fix: Make the list fill the container width at 560 px and below, as the pane does.
