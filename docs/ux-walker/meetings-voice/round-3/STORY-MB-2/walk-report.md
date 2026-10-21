# STORY-MB-2: Granola rejects the key on the phone, and later needs a new one

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/granola/mockup.html#screen-mobile (Key rejected, Reconnect needed, Offline, AI data sharing off)

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- Step 5 (look for another Granola route on mobile): the plan has none on the phone by design (no key link, no tile); the Business plan hint is the only cause clue.
- "Could not reach Granola" is now plan text (granola.md Surfaces), not a placeholder.

## Steps

- Step 1 [pass]: Paste and Connect: field disabled, spinner button (gm-connecting.png).
- Step 2 [pass]: Rejected: red line "Granola rejected this key" under the field; the field keeps the pasted dots; Connect dimmed; "Business plan" stays in the label (gm-rejected.png).
- Step 3 [pass]: Editing the field clears the line and enables Connect (verified by input event; gm-rejected-after-edit.png).
- Step 4 [note]: Second key: same line; no new information, as the plan decides (one line, no 401/403 branching).
- Step 5 [pass]: Reconnect needed: one group with a warning-dot "Reconnect needed" row, the key field, the red line, Connect, footer, Disconnect (gm-reconnect.png). No "Synced" text.
- Step 6 [pass]: Offline: "Could not reach Granola"; Connect stays active; the field keeps its value (gm-offline.png).

## Geometry audit
Phone measurements: rows 52 to 60 pt, Connect 48 pt, error text 13 pt rgb(229,100,90) on rgb(28,28,30) (about 5.6:1). No overflow.

## 390x844 spot-check
Frame fits 390x844 with no horizontal scroll.

## Flow Log
Ideal 3 (paste, Connect, read the error and know what to do). Actual 3 for the first two and the third stops at the line with no next step. A Pro user gets the "Business plan" label as the only hint. Hesitation: after rejection there is nowhere to go on the phone.

## Round-2 findings
- F-MB-2-1 (high): still-open. Downgraded to medium. The line still gives no cause and the phone has no route to live questions, but the plan now adds "Business plan" to the field label (gm-rejected.png) and decides the one line. The step the plan defines can be taken. Kept as a plan weakness.
- F-MB-2-2 (medium): fixed. Reconnect needed state is drawn.
- F-MB-2-3 (medium): fixed. Offline state drawn.
- F-MB-2-4 (low): still-open. The pasted key remains a row of dots, so truncation cannot be seen, and there is no clear control.
- F2-MB-2-1 (medium): fixed. "Business plan" now follows the field label in rejected, offline and reconnect states (gm-rejected.png).
- F2-MB-2-2 (medium): fixed. Reconnect needed is one group: warning dot, "Reconnect needed", no "Synced 42 meetings" (gm-reconnect.png).
- F2-MB-2-3 (low): fixed. "Could not reach Granola" is the plan wording and has its own Offline frame.

## New findings
- F3-MB-2-1 (medium, mockup): The empty Granola key field has no placeholder and no field chrome. On the phone it is a 13 pt stacked caption "Granola API key · Business plan" over blank space (59 pt row empty, 60 pt row in Reconnect needed), so it reads as a section caption rather than an input. iOS forms show a placeholder or an inline label with a trailing value. Fix: Draw the label inline at the left with a muted placeholder such as "Paste key" at the right (iOS LabeledContent/SecureField), or add a placeholder. The plan removed web placeholders; the phone needs its own decision.
