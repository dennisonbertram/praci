# STORY-MB-5: Choose a transcription provider in Settings, Voice on the phone

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/wispr-flow/mockup.html#screen-mobile (Voice, Wispr Flow key, Verifying, Key rejected, Connected)

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- Step 1 and 2: the plan (D3) has no picker and no "Transcription" row. Flow is a "Transcribe only" row in the providers list, and the "API access required" state was removed. The story matches the plan on this.

## Steps

- Step 1 [pass]: Voice: "This device" group with the single checkmark, then a "Providers" group with ElevenLabs (Connected), OpenAI, Cartesia and Wispr Flow "Transcribe only" (step-list.png). Rows 62 to 63 pt.
- Step 2 [pass]: Tap Wispr Flow: a key field and a dimmed Connect appear below the list, with the footer "Sends your recordings and workspace names to Wispr Flow." (step-key.png). No row shows a selected state.
- Step 3 [pass]: Verifying: field disabled, spinner in the button, footer stays (step-verifying.png).
- Step 4 [pass]: Rejected: red "Could not connect this voice provider", Connect dimmed until edited (step-rejected.png).
- Step 5 [pass]: Connected: Flow row shows "Transcribing", "This device" keeps its checkmark and its subtitle drops "works offline" (step-connected.png).
- Step 6 [pass]: Disconnect row below the list returns to the list state (verified by click).

## Geometry audit
Phone measurements: back 44x44, rows 62 to 63 pt, Connect 48 pt, subtitle 14 pt rgb(142,142,147), trailing status 17 pt. Page audit: no overflow; two-line provider rows are not wrapped controls.

## 390x844 spot-check
Fits 390x844 with no horizontal scroll (mobile-check-390.png).

## Flow Log
Ideal 3 (open Voice, pick Flow, paste and confirm). Actual 3 to 4 (open Voice, tap Flow row, paste, Connect). Hesitation: after tapping the Flow row the key field appears under the whole list, not under the row.

## Round-2 findings
- F-MB-5-1 (high): obsolete. Picker removed by D3.
- F-MB-5-2 (medium): fixed. Flow row shows no status until connected; no check is moved (step-key.png, step-connected.png).
- F-MB-5-3 (medium): fixed. Real grouped rows of 52 pt or more.
- F-MB-5-4 (medium): fixed. Verifying has a spinner.
- F-MB-5-5 (medium): fixed. Footer sentence placement.
- F-MB-5-6 (medium): still-open. Disconnect is still a red row that acts at once; the plan is silent for Flow. Downgraded to low.
- F-MB-5-7 (medium): fixed. Rejected state drawn.
- F-MB-5-8 (low): fixed. Copy.
- F-MB-5-9 (low): fixed. Layout.
- F2-MB-5-1 (medium): fixed. "This device" keeps the single checkmark in list, key, verifying, rejected and connected; "works offline" drops only when connected; the Flow row never takes the check (all five screenshots).
- F2-MB-5-2 (low): still-open. See F-MB-5-6.
- F2-MB-5-3 (low): still-open. Back control is 44 pt now (fixed). Subtitles are 14 px (native secondary text is 15 pt) and the status bar is dots; frame chrome only.

## New findings
- F3-MB-5-1 (medium, mockup): When the Flow row is tapped, the key field, Connect and the footer appear below the entire providers list with no header, and the row itself shows no selected state. After connecting, the red Disconnect row sits below the list. ElevenLabs is also Connected, so it is not clear which provider Disconnect acts on. iOS convention is to push a detail screen titled "Wispr Flow" that holds the field, Connect, footer and Disconnect. Fix: Push a Flow detail screen (native NavigationLink) or put the key rows and Disconnect in a group with a "Wispr Flow" header directly under its row.
- F3-MB-5-2 (low, mockup): On the phone the trailing status words "Transcribing" and "Connected" both render grey rgb(142,142,147). A selector `.ir .tr` overrides the success colour, while the web pane shows "Transcribing" in green. The plan lists the success "Transcribing" text in its contrast acceptance. Fix: Raise specificity of `.ok-t` inside `.ir .tr`, or decide the phone uses secondary label for all status words and say so in the plan.
- F3-MB-5-3 (low, plan): The "This device" row is a checkmark row in its own group with no header. Next to "Free" the checkmark does not say what it selects (speech output). With Flow connected, a user may read the check as "this device transcribes". Fix: Low priority; consider a group header only if the existing screen has one.
