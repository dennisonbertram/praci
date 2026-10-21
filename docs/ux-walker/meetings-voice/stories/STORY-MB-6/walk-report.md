# Walk report: STORY-MB-6

Verdict: FAIL (static iPhone-frame mockup, judged against native iOS conventions; 390px spot-check not applicable).

Findings: 3 total. Severity {'high': 2, 'low': 1}. Kind {'plan': 3}.

## Steps

### Step 1
Only mocked surface: Connected state of Voice settings (same as MB-5 step 5): Transcription 'Wispr Flow', Connected, Disconnect. Geometry audit: clean. Call Elio, the call itself, the mid-call consent alert and the recorder are not drawn on the phone (web draws a call and a consent card, not an iPhone alert).
Screenshot: screenshots/step-1.png

## Flow Log

Ideal 2 steps (tap Call Elio; talk). Mockup draws 0 of them. Steps 1-7 of the story have no mobile surface.

## Findings

- F-MB-6-1 [high, plan, JF-12] Journey breaks: steps 1-7 (Call Elio, routing, recording, consent alert mid-call, Not now / Allow) have no mobile surface. Plan sections: wispr-flow.md S3b call routing and S1c consent.
- F-MB-6-2 [high, plan, JF-11] Audio goes to Flow before any consent prompt; mobile asks only when a reply is spoken, and with This device on the plan would not use Flow at all.
- F-MB-6-3 [low, plan, JF-35] Existing alert 'Calls need transcription' still names ElevenLabs, OpenAI, Fish Audio and omits Flow.
