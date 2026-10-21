# Walk report: STORY-GS-2

Result: FAIL
Session: uxw-granola. Mockups opened via file:// in dark mode at 1280x900 (desktop) and 390x844 (spot-check).
Findings by severity: {'high': 1, 'medium': 3, 'low': 2}. By kind: plan 4, mockup 2.

## Steps

1. Entering (step-1-entering.png): masked field with a value, Connect enabled. Masking is a mockup choice (F-3). Geometry: clean.
2. Verifying (step-2-verifying.png): field disabled, button 'Connecting…'. Auto-advances after about 1.2 s to Connected in this mockup (the mockup auto-succeeds; it does not auto-reject).
3. Key rejected (step-3-rejected.png): red border, red role=alert line 'Granola rejected this key', Connect enabled. Contrast of the red line on the card is adequate. Field readonly (F-5). Geometry: clean.
4. Cause unknown: copy gives no cause (F-1).
5. Retry with a corrected key: not drawable because of readonly (F-5); clear-time of error undefined (F-4).
Extra state walked: Rate limited (edge-rate-limited.png), connected card with 'Granola is busy. Retrying.'; no first-connect variant (F-2).
Mobile 390x844 spot-check (mobile-390-rejected.png): card fits, no overflow. Pass.
Geometry results: Geometry audit: pageOverflowX 0, no overflow spills, no wrapped controls; only unevenRows hit is the mockup's own state-pill switcher (not product UI).
Flow Log: actual 5 steps vs ideal 3. Extra steps: leaving the app to inspect the key in Granola (the error gave no hint), then returning. Hesitation at step 4. No duplicated information.

## Findings

- F-GS-2-01 [high, plan, JF-4] The only rejection copy is 'Granola rejected this key', for a truncated key, an expired key, a wrong-scope key and a plan without API access alike. Tomas cannot tell what to fix.
- F-GS-2-02 [medium, plan, JF-25] Network failure, Granola 5xx or 429 while validating a first key have no copy; the only transient state drawn ('Granola is busy. Retrying.') exists only for an already-synced card. A failure at first Connect would read as a rejected key.
- F-GS-2-03 [medium, plan, NEW] The key field is masked, so after the rejection Tomas cannot see that his paste is cut off, which is the one thing he needs to check. The plan gives no masking rule.
- F-GS-2-04 [low, plan, NEW] Not stated when the error line clears: on typing or on the next Connect. The mockup clears it only through the Verifying state.
- F-GS-2-05 [medium, mockup] Rejected state draws the key field as readonly with the old value, so the story's ideal path (replace the key in the same field and press Connect) cannot be shown; Connect in this state submits the same rejected key.
- F-GS-2-06 [low, mockup] The sentence 'Rejected state also appears for a key that worked earlier and was revoked in Granola.' is a design note rendered in every card state; it reads as product copy.
