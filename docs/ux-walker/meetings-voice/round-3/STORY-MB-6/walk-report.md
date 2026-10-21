# STORY-MB-6: Call Elio with Flow selected, on a phone that can recognize speech itself

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/wispr-flow/mockup.html#screen-mobile (Connected). Call routing and the phone call screen are not drawn.

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- Step 5 and 6 and the variation about the consent prompt: consent is recorded at Connect (D3/S1c); there is no prompt at call start. Obsolete.
- Edge case "daily cap ends the call after repeated failures": plan S3a now says the cap error does not count toward MAX_TURN_FAILURES and the call stays open.

## Steps

- Step 1 [pass]: The only phone surface is Voice settings, Connected (step-connected.png). The call screen is unchanged by the plan (routing is internal), so no frame is needed for steps 1 to 5.
- Step 6 [note]: Consent off: existing prompt, not drawn.
- Step 7 [note]: Daily cap caption on the phone: the plan says one caption line "Daily voice limit reached. You can keep typing." once; only the web call card is drawn.

## Geometry audit
Same frame as MB-5: no overflow; 44 pt back, 52 pt or more rows.

## 390x844 spot-check
Frame fits 390x844 (MB-5 mobile-check-390.png).

## Flow Log
Ideal 2 (tap Call Elio, talk). Plan keeps it at 2. Nothing visible changes on the phone except the cap caption.

## Round-2 findings
- F-MB-6-1 (high): obsolete. Consent prompt at call start was removed (D3).
- F-MB-6-2 (high): fixed. Voice settings Connected frame shows the selection effect.
- F-MB-6-3 (low): fixed. Copy.
- F2-MB-6-1 (medium): fixed. Plan S3a: the cap error does not count toward MAX_TURN_FAILURES, the call stays open for typing, the caption shows once and uploads stop until the next call or the reset.

## New findings
- F3-MB-6-1 (low, mockup): The phone has no frame for the one new call surface: the cap caption. Only the web call card is drawn. A native reviewer cannot judge how the line and the composer sit on the phone call screen. Fix: Add a phone call frame only if the native call screen differs; otherwise state in the plan that the caption uses the existing error caption.
