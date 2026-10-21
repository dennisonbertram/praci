# STORY-MB-2: Granola rejects the key on the phone, and later needs a new one

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/granola/mockup.html#screen-mobile (Key rejected, Reconnect needed, Reconnect key rejected, Offline)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- Step 5 (look for another Granola route): the phone has none by decision; the plan keeps the MCP sign-in web-only.

## Steps

- Step 1 [pass]: Connect shows "Connecting..." with an indicator (see MB-1).
- Step 2 [pass]: "Granola rejected this key" in the destructive colour under the field; the pasted key stays; Connect is dimmed until the field is edited (step-rejected.png).
- Step 3-4 [pass]: Re-pasting and trying again gives the same line; the story's note that the line gives no cause is decided (D3, one line).
- Reconnect needed [pass]: passive: warning dot and "Reconnect needed", editable key row with placeholder, dimmed Connect, footer, Disconnect; no red line (step-reconnect.png). TX-2/TX-11 applied.
- Reconnect, key rejected [pass with a note]: the red line appears only after a failed Connect (step-reconnectbad.png), but the empty key row shows no placeholder, see F4-MB-2-1.
- Offline [pass]: "Could not reach Granola", the value kept, Connect enabled (step-offline.png).

## Geometry audit
geometry-audit.js per state at 1280x900 and 390x844: pageOverflowX 0, no overflow spills. Flagged wrappedControls are the 44 pt glass back glyph and the one-word Connect action (tall native button, not a wrapped label). Measured on the phone: back 44x44, action button 48 pt, rows 52 to 63 pt, check/to-do hit areas 44x44, subtitle and footer 13 to 14 px.

## 390x844 spot-check
390x844: Reconnect needed fits, no horizontal scroll (mobile-check-390.png).

## Flow Log
Ideal 3 (paste, Connect, read the error). Actual 3. The user cannot tell Business-plan failure from a mistyped key; accepted by the plan (one line), so the journey ends at the error with no route to live questions on the phone.

## Round-3 findings
- F-MB-2-1 (medium): still-open. The line still gives no cause and the phone has no route to live questions. The plan decides the one line (D3, M-11) and keeps the sign-in web-only; downgraded earlier, not a high finding.
- F-MB-2-4 (low): still-open. The pasted key is a row of dots, so truncation cannot be seen, and there is no clear control. Unchanged, native secure fields behave this way.
- F3-MB-2-1 (medium): fixed. The empty key field has the placeholder "API key" in Empty, Typing, Disconnected and Reconnect needed (step-reconnect.png). One state is missing it, see F4-MB-2-1.

## New findings
- F4-MB-2-1 (low, mockup): In "Reconnect, key rejected" the key row is empty and shows no placeholder, only the caption "Granola API key · Business plan" over blank space. Every other empty state shows "API key". Fix: Add placeholder="API key" to the reconnectbad input.
