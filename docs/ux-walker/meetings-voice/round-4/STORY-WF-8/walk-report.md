# STORY-WF-8: A user without Flow API access looks for Flow in Voice settings

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/wispr-flow/mockup.html#screen-settings-voice (Default, Wispr Flow no key, Key rejected)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- The story's Ideal path (a short message that Flow works in the composer) and the catalog's blocked state are outdated: plan D3 removed the blocked state and adds no such copy. Followed the plan.

## Steps

- Step 1 [pass]: Settings, Voice shows the provider list (step-voice-default.png).
- Step 2 [pass]: The "Transcribe only" Wispr Flow row is present; the app cannot tell whether she has API access (plan decision).
- Step 3 [pass]: A rejected key shows the red border and "Could not connect this voice provider"; Connect is disabled until the field is edited; the consent sentence stays (step-voice-rejected.png).
- Step 4-5 [note]: Tile versus Voice row and hotkey dictation are outside the mockup.

## Geometry audit
geometry-audit.js per state at 1280x900 and 390x844: pageOverflowX 0 in every state; no overflow spills. unevenRows are only the state-pill strips and the Replace key/Disconnect pair (label-driven widths). wrappedControls are the two-line provider rows (title plus subtitle by design), not defects.

## 390x844 spot-check
Same screen as WF-6: no horizontal scroll at 390x844.

## Flow Log
Ideal 1 (learn from a short message). Actual 3 (open, tap row, paste and Connect) and no message comes. Accepted by the plan and by the minimal-copy rule.

## Round-3 findings
- F2-WF-8-1 (medium): still-open. A consumer Flow Pro user with no API access still meets the generic "Could not connect this voice provider" with no next step (step-voice-rejected.png). Decided in D3 and the fix lists (M-11, one error line); kept as a known journey weakness, not re-raised and not a high finding.

## New findings
- None.
