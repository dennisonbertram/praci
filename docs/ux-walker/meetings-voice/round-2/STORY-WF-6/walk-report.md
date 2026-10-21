# STORY-WF-6: Choose Flow as the transcription provider (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. Settings, Voice: Flow is a fifth row "Wispr Flow / Transcribe only" in the provider list (screenshots/step-1.png). Story steps 1-2 (hunt for a transcription picker) are outdated: D3 removed the picker.
2. Select the Flow row, no key: one API key field, Connect disabled until text, one sentence "Sends your recordings, text near the cursor and workspace names to Wispr Flow." (step-3.png). Typing enabled Connect.
3. Connect: Connecting... then Connected (step-3b-verifying.png, step-4.png). Row gets a Connected tag, pane shows Replace key and Disconnect. Consent is recorded by Connect (plan D3).
4. Story step 5 (consent re-prompt at Call Elio) is outdated: no prompt at call start. AI data sharing shows a "Wispr Flow" toggle row (step-5-consent.png).
5. Call screen looks the same as today (step-6-call.png). Steps 6-7 (WAV routing, vocabulary) are invisible by design.
6. Disconnect returns the pane to Default (ElevenLabs selected). Key rejected shows "Could not connect this voice provider" in destructive color with the consent sentence still under Connect (step-rejected.png).

## Geometry
Run on docs/wispr-flow/mockup.html at 1280 px. pageOverflowX 0, overflowSpills none. unevenRows hits are the state-pill rows (chrome), the provider list vs key pane columns (intentional) and Replace key / Disconnect (primary vs small button); wrappedControls hits are two-line provider rows (title plus subtitle), not wrapped labels. None confirmed as defects.

## Flow log
Actual 5 visible steps (open Voice, select Flow, paste, Connect, call) vs ideal 4 (the select and paste are one gesture). No hesitation points except which provider is active (N1). Information stated once: consent sentence appears only where Connect is.

## Round-1 findings
- F-WF-6-1 (high): **fixed**. Consent is asked at Connect (D3); the Inbox card and call-start trigger are gone. Rejected and declined paths: declining means not pressing Connect. Evidence step-3.png.
- F-WF-6-2 (medium): **fixed**. One provider list and one pane; one Connected tag per row (step-4.png). A related question remains as N1.
- F-WF-6-3 (low): **obsolete**. The Transcription select no longer exists; Disconnect goes back to the Default pane.
- F-WF-6-4 (low): **fixed**. Heading "Voice sharing has changed" removed; remaining new strings are quoted in the HTML comment for the PR.
- F-WF-6-5 (low): **fixed**. Author notes moved into HTML comments; none visible in step-1..4 screenshots.

## New findings
- F2-WF-6-1 [plan, medium] After Connect nothing says Flow is now the transcriber. ElevenLabs stays Connected and is also "Speak + transcribe", and the only cue for the active provider is a subtle highlight on the selected row. A user cannot tell which provider hears them, or how to switch back other than Disconnect.
- F2-WF-6-2 [plan, low] Plan-defined step "consent switched off later, next call shows the existing consent prompt" has no frame; AI data sharing toggle is drawn but not its effect.
