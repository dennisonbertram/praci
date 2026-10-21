# STORY-WF-8: A user without Flow API access looks for Flow in Voice settings

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/wispr-flow/mockup.html#screen-settings-voice (Default, Wispr Flow no key, Key rejected)

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- The catalog mockup line names an "API access required" state. Plan decision D3 removed it: there is no blocked state, and a rejected key and an unapproved organization show the same existing line. The story step 3 text matches the plan. The story's Ideal path (a short message that Flow already works in the composer) is outdated: the plan adds no such copy, by design.

## Steps

- Step 1 [pass]: Settings, Voice shows the provider list (step-voice-default.png).
- Step 2 [pass]: Wispr Flow row, "Transcribe only", is present on deployments with the base URL setting; the app cannot know whether she has API access.
- Step 3 [pass]: Rejected key: red border, "Could not connect this voice provider", Connect disabled until edited, sentence stays (step-voice-rejected.png).
- Step 4-5 [note]: Tile versus Voice row and hotkey dictation are outside the mockup (hotkey is Flow-only).

## Geometry audit
Same page audit as WF-6: no overflow, no spills; the two-line provider rows are not defects.

## 390x844 spot-check
390x844 spot-check (WF-6 mobile-check-390.png) applies to the same screen: no horizontal scroll.

## Flow Log
Ideal 1 (learn from a short message). Actual 3 (open, tap row, paste and Connect) and the message never comes. Accepted by the plan; the product rule says no explanatory copy.

## Round-2 findings
- F-WF-8-1 (high): fixed. Round 1 high (misleading "API access required" state) is gone; the rejected line is the existing generic message (step-voice-rejected.png).
- F-WF-8-2 (medium): obsolete. Blocked state removed by D3.
- F-WF-8-3 (low): obsolete. Blocked state removed by D3.
- F2-WF-8-1 (medium): still-open. A user with a consumer Flow Pro account and no API access still meets the generic "Could not connect this voice provider" with no next step. The plan accepts this because the app cannot know. Not a blocker; a journey weakness.

## New findings
- None.
