# STORY-WF-8: User without Flow API access looks for Flow (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. Open Voice: list shows Wispr Flow "Transcribe only" (only when the deployment has a Flow base URL, plan S3a). The "API access required" state no longer exists, so the story mockup line is outdated.
2. Elena pastes a consumer key and presses Connect: rejected state shows "Could not connect this voice provider" (STORY-WF-6 screenshots/step-rejected.png). No pointer to the composer hotkey or to API access, by plan (no explainer copy).
3. Step 4 (two Flow surfaces): the Integrations tile is labeled "Meeting notes" and the Voice row "Transcribe only", which differ enough.

## Geometry
Run on docs/wispr-flow/mockup.html at 1280 px. pageOverflowX 0, overflowSpills none. unevenRows hits are the state-pill rows (chrome), the provider list vs key pane columns (intentional) and Replace key / Disconnect (primary vs small button); wrappedControls hits are two-line provider rows (title plus subtitle), not wrapped labels. None confirmed as defects.

## Flow log
3 steps to learn that it does not work, no guidance after. Acceptable dead end only because the plan chose not to add copy; the hotkey path is not signposted.

## Round-1 findings
- F-WF-8-1 (high): **fixed**. Flow is no longer offered where the deployment lacks Flow (plan S3a), and the "API access required" state is removed. Residual dead end: a user in a Flow-enabled deployment without personal access gets the generic error (N1, medium).
- F-WF-8-2 (medium): **obsolete**. No "API access required" message exists; the hotkey pointer was dropped on purpose.
- F-WF-8-3 (low): **obsolete**. That copy is deleted.

## New findings
- F2-WF-8-1 [plan, medium] A user without Wispr API access in a deployment that has Flow configured meets a rejected key with the generic line and no next step. The plan accepts this ("the app cannot know").
