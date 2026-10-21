# STORY-MB-5: Choose a transcription provider on the phone (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. Voice: "This device" (check, "Free, works offline"), Providers list with Flow as "Wispr Flow / Transcribe only" (step-list.png). Story steps 2-3 (picker, API access) are outdated.
2. Wispr Flow selected: key group under header "WISPR FLOW", Connect dimmed, consent footer (step-key.png).
3. Verifying: "Connecting..." (step-verifying.png), then Connected: Flow row says Connected, group shows only Disconnect (step-connected.png).
4. Key rejected: destructive "Could not connect this voice provider" above the consent footer (step-rejected.png).

## Geometry
Run on docs/wispr-flow/mockup.html#screen-mobile, phone frame 390 x 780 pt. Rows 44-63 pt, no overflow.

## Native iOS check (mobile frame)
Grouped inset lists, uppercase 13 pt headers and footers, 17 pt row titles, 14 px subtitles (iOS secondary text is usually 15), 44+ pt rows, destructive centered Disconnect, glass back: native. Gaps: status bar dots, back control 40 pt, no confirmation for Disconnect, no spinner on Connecting....

## Flow log
3 steps (open Voice, tap Flow, paste and Connect) equals ideal. Hesitation: the check mark moves between rows in a way the plan does not describe.

## Round-1 findings
- F-MB-5-1 (high): **obsolete**. No API-access state; Flow appears only where the deployment has a Flow base URL (plan S3a). Residual generic error is WF-8 N1.
- F-MB-5-2 (medium): **still-open**. The Flow row takes the check mark as soon as it is tapped, before any key is verified (step-key, step-verifying, step-rejected). See N1.
- F-MB-5-3 (medium): **fixed**. Header "WISPR FLOW" names the provider.
- F-MB-5-4 (medium): **fixed**. Verifying and Key rejected drawn.
- F-MB-5-5 (medium): **fixed**. Destructive color.
- F-MB-5-6 (medium): **still-open**. Disconnect has no confirmation; downgraded to low (N2).
- F-MB-5-7 (medium): **fixed**. Plan S3b states precedence; but the mockup draws it differently (N1).
- F-MB-5-8 (low): **fixed**. "Transcribe only" label.
- F-MB-5-9 (low): **fixed**. Inline list, glass back; remaining gaps in N3.

## New findings
- F2-MB-5-1 [mockup, medium] Mockup moves the check from "This device" to the Flow row in key, verifying and rejected states and drops it entirely when connected, and removes "works offline" before Flow is connected. Plan S3a/S3b says the Flow row does not take the check, "This device" stays on for speech and only loses "works offline" while Flow is connected. In the connected state no row shows the speech choice.
- F2-MB-5-2 [plan, low] Disconnect (red row) acts at once with no iOS confirmation.
- F2-MB-5-3 [mockup, low] Native fidelity: subtitle 14 px, 40 pt back, status bar dots.
