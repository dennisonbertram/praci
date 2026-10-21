# STORY-GS-2: Invalid key on a Business plan (round 2)

**Result: PASS**

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Paste a truncated key.** Field is a password field (dots), Connect enabled after typing (verified live). The hint '· Business plan' sits on the label. Screenshot: `screenshots/key-entering.png`

- **2 Press Connect.** Field disabled, button 'Connecting…'. Screenshot: `screenshots/key-connecting.png`

- **3 Rejection.** Field has a red border, the line 'Granola rejected this key' in red (role=alert) and an enabled Connect. Nothing else changes: no connection row, no agent link, no sidebar agent in the plan's flow. Screenshot: `screenshots/key-rejected.png`

- **5 Replace the key in the same field and retry.** Verified live: the field is editable (not read-only), typing hides the error line and Connect stays enabled. The red border and aria-invalid stay after the error line clears (new finding). Screenshot: `screenshots/key-rejected-edited.png`

- **Edge Network failure on first Connect (web).** Web draws no network or 5xx state; the mobile frame draws 'Could not reach Granola' as a placeholder (mob-key-offline.png). Plan: 'existing generic error style'.

- **390 390 px spot-check.** Card fits, error line and Connect visible, no overflow. Screenshot: `screenshots/m390-key-rejected.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 3 steps (paste, Connect, retry) = Ideal 3. Hesitation: after the rejection the masked field shows only dots, so Tomas cannot check for a truncated paste. The 'Get a key in Granola' link is hidden once the field has text, so the recovery link is not available at the moment of failure.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-GS-2-01 | still-open | Plan keeps a single line 'Granola rejected this key' for every cause and says it has not verified that Granola distinguishes 401 from 403. Mitigated by the 'Business plan' hint on the label. Kept at medium, see F2-GS-2-01. |
| F-GS-2-02 | still-open | Mobile draws 'Could not reach Granola' (placeholder per mockup comment). Web draws nothing and the plan only says 'existing generic error style'. Wording undecided. See F2-GS-2-02. |
| F-GS-2-03 | still-open | Field is still masked (plan requires type=password). See F2-GS-2-03. |
| F-GS-2-04 | fixed | Plan: 'the error line clears when the user edits the field'. Verified live in the mockup (alert hidden after typing). |
| F-GS-2-05 | fixed | Rejected field is editable (readOnly false) and Connect re-submits. |
| F-GS-2-06 | fixed | No design note is visible in any card state; notes are HTML comments now. |

## New findings (round 2)

- **F2-GS-2-01** (medium, plan): One rejection line for truncated, expired, wrong-scope and no-API-plan keys. The recovery link 'Get a key in Granola' disappears as soon as the field has text, so it is not offered after a rejection. Fix: Show the 'Get a key in Granola' link in the rejected state too (plan Surfaces says 'shown only while the field is empty'; change to 'empty or rejected').
- **F2-GS-2-02** (medium, plan): Web has no drawn state for 'could not reach Granola' on the first Connect; mobile draws a placeholder string. The two surfaces will diverge unless the plan fixes the wording once. Fix: Decide the string in granola.md and draw it in the web key card.
- **F2-GS-2-03** (low, plan): The secure field gives no way to reveal what was pasted, so a truncated paste cannot be seen. Fix: Optional: show-last-4 or a reveal control. If not wanted, record the decision in the plan.
- **F2-GS-2-04** (low, mockup): After the error line clears on edit, the field keeps its red border and aria-invalid=true. Fix: Clear the invalid style in the input handler.
