# Walk report: STORY-WF-7

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **pass (medium findings only)**.

## Steps

1-2. Over-long utterance and retry: no surface (JF-42; hard to reach in practice). Journey breaks: step 1 has no surface for the 6 minute / 25 MB message.
3. Daily cap (screenshots/step-3.png, Wispr#screen-call, Daily limit reached): the call card replaces the transcript line with red text "Daily transcription limit reached", Mute and End stay. This defines the text and places it in the call card, which answers the catalog's 'where does the message appear' gap (JF-14). The alert is exposed (role alert). No reset time or number, as the catalog fix recommends.
4. Dead call or blocked transcription: the card says which. But nothing says what to do next, and Mute and End are the only controls.
5. Type in the composer: the composer is not on this screen, so how to continue is not drawn.
6-7. Clear selection, counter reset: no surface (reset not shown, by design).
LOOK: centered card, red caption legible (contrast good on dark). Geometry: pageOverflowX 0; only state-pill hit. Mobile spot-check (mobile-check.png): card fits, no wrap.

## Flow Log

Ideal 2 (see a clear message, continue by voice or typing). Mockup supplies the message but no continuation: the user reads the message, then must leave the call UI to find the composer or Settings. 1 step missing.

## Findings (3)

- F-WF-7-1 [plan, medium, flow] The cap message is clear but the call card offers only Mute and End; continuing by typing or switching provider is not signposted. (ref: JF-14 (partly resolved by the mockup))
- F-WF-7-2 [plan, low, error-handling] Length and size rejection (6 min, 25 MB) and non-WAV rejection have no drawn message or location. (ref: JF-42)
- F-WF-7-3 [mockup, low, visual] Footnote 'With Flow transcription the call looks the same as today...' inside the frame. (ref: NEW)

## Screenshots

- screenshots/mobile-check.png
- screenshots/step-3.png
