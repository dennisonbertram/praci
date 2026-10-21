# Walk report: STORY-MX-5

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **pass (1 medium plan finding; case not drawn)**.

## Steps

1-2. Agent answer from a summary: only the generic Flow agent answer is drawn (screenshots/step-2.png, Wispr#screen-flow-meetings, Agent answer). Both lines carry full citation chips, i.e. the mockup shows transcript-backed answers, not a summary-only one. The summary-only case is not drawn.
3. "Quote her": no surface. Journey breaks: step 3 has no surface (wispr-flow.md S5 Behaviour; the wording for a missing transcript is undefined).
4. Why Granola calls give quotes and this one does not: no surface, no explanation by design (AGENTS.md copy rule), so the plan must pick the literal "no transcript" wording (JF-26).
LOOK: the answer is clean; the muted footnote about providers is author notes. Geometry: only state-pill group hit (false positive). Mobile spot-check: wraps correctly, no overflow.

## Flow Log

Ideal 2 steps (ask, get answer plus note that only a summary exists). Mockup shows step 1 only; the note is missing, so the user needs a third turn ('Quote her') to find out. Extra steps: 1 plus a hesitation.

## Findings (2)

- F-MX-5-1 [plan, medium, error-handling] A summary-only meeting yields no stated wording: the user finds out only by asking for a quote, and a to-do from a summary looks like one from a transcript. (ref: JF-26)
- F-MX-5-2 [mockup, low, visual] Author note rendered inside the frame under the answer. (ref: NEW)

## Screenshots

- screenshots/mobile-check.png
- screenshots/step-2.png
