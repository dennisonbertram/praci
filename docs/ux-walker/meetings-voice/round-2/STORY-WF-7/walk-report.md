# STORY-WF-7: Daily cap, long utterance, recorder without WAV (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. During a call: card with Elio, last heard text, Mute and End (step-6-call is in STORY-WF-6 screenshots).
2. Daily limit reached: one destructive line "Daily transcription limit reached" replaces the heard text, no reset time (screenshots/step-3-cap.png). Matches plan S3a.
3. Typing in the composer, Settings clearing, the 6 minute / 25 MB and non-WAV rejections have no frame: the plan makes typing a test in S3a, the recorder produces WAV itself, and mobile turns cap at 30 s. Stories steps 1, 2, 5-7 are outdated or not drawable.

## Geometry
Run on docs/wispr-flow/mockup.html at 1280 px. pageOverflowX 0, overflowSpills none. unevenRows hits are the state-pill rows (chrome), the provider list vs key pane columns (intentional) and Replace key / Disconnect (primary vs small button); wrappedControls hits are two-line provider rows (title plus subtitle), not wrapped labels. None confirmed as defects.

## Flow log
2 drawn steps of the 7 in the story; the others are invisible or plan-tested. No duplicated info. The call card gives no way forward except End, but the composer is outside the frame.

## Round-1 findings
- F-WF-7-1 (medium): **fixed**. Plan S3a now requires a test that typing works while the call is blocked and defines one caption line (FX-45). Frame still shows only Mute/End, accepted.
- F-WF-7-2 (low): **still-open**. Length/size rejection still has no drawn caption. Reachability is low (web turns only), plan says reject before sending. Reuse the caption path.
- F-WF-7-3 (low): **fixed**. Footnote removed from the frame; comment holds it.

## New findings
- F2-WF-7-1 [mockup, low] Mute stays enabled in the blocked state although nothing is being heard; a muted blocked call looks identical.
