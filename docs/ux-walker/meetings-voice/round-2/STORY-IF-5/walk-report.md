# STORY-IF-5: AI consent is off (round 2)

**Result: PASS**

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Meeting source connected, consent off.** Inbox shows the existing consent prompt ('Let Praci sort your mail', 'Senders, recipients, subjects and short previews go to the AI service that runs your bots (Anthropic).', Allow / Not now) above 'Connect mail'. No To do card. Screenshot: `screenshots/inbox-consent.png`

- **2 Allow.** After consent the plan queues digests; the card shows 'Syncing' then 'No follow-ups from meetings yet' or the to-dos. Screenshot: `screenshots/inbox-syncing.png`, `screenshots/inbox-empty.png`

- **3 Not now.** What the Inbox shows after 'Not now' is not drawn (plan: prompt stays the only thing shown).

- **390 390 px spot-check.** Same layout rules; consent card not separately shot at 390 (same component as the cards shown there). Screenshot: `screenshots/m390-inbox.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 1 step (Allow) = Ideal 1. Hesitation: the prompt talks about mail only; a user whose only source is Granola is asked to let Praci 'sort your mail'.

## Round-1 findings

None for this story.

## New findings (round 2)

- **F2-IF-5-01** (medium, plan): The consent prompt text is about mail ('sort your mail', 'Senders, recipients, subjects') while for a meeting-only user the consent covers meeting transcripts and summaries. The plan lists this as an open question and keeps the existing text. Fix: Decide wording for the meeting-only case; the S5 PR must quote it under the AGENTS.md copy rule.
- **F2-IF-5-02** (low, plan): Plan text says with consent off 'the consent prompt is the only thing shown', but the mockup (and its comment) draws the prompt above 'Connect mail'. Fix: Align the plan sentence with FX-14 ('above Connect mail').
