# STORY-MB-6: Call Elio with Flow selected on a phone with native recognition (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. No call frame exists; plan says the call looks as today (only the cap caption changes). Story steps 1-7 are therefore outdated or non-visual.
2. Consent happens at Connect (screenshots in STORY-MB-5), so the mid-call "Share data" alert and Not now path are gone.
3. Routing precedence is stated in plan S3b (Flow wins for listening, "This device" stays for speech).

## Geometry
No frames to measure for the call; Voice frame measured in MB-5.

## Native iOS check (mobile frame)
Call UI not drawn; Voice settings frame judged in MB-5.

## Flow log
Ideal 2 steps (tap Call Elio, talk) is preserved: no extra choices. Nothing to hesitate on visually.

## Round-1 findings
- F-MB-6-1 (high): **obsolete**. Consent prompt mid-call removed by D3; remaining call UI is existing.
- F-MB-6-2 (high): **fixed**. Audio cannot precede consent: Connect records it (plan S3a). Precedence in S3b. Mockup contradiction is MB-5 N1.
- F-MB-6-3 (low): **fixed**. Plan: alert names Flow only when the row is selectable.

## New findings
- F2-MB-6-1 [plan, medium] On mobile the daily cap surfaces as a failed turn; after repeated failures the call ends with the generic caption. The plan defines one caption line, not what happens to the call.
