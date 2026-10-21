# STORY-IF-5: AI consent is off (round 3)

**Result: PASS**

Outdated or changed by the plan: Steps 1-2: a meeting-only user never sees the mail consent prompt, because Connect records consent (plan S5 Zero-account layout and S6 Consent). The prompt stays for users with a mail account.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 'Mail, consent off' frame: prompt 'Let Praci sort your mail' / 'Senders, recipients, subjects and short previews go to the AI service that runs your bots (Anthropic).' with Allow and Not now, above the To do card. g-d-inbox-consent.png
- 2 For a meeting-only user the Granola card carries the consent sentence 'Sends your meeting notes and transcripts to your AI model.' and Connect records it. g-d-api-key-empty.png
- Withdrawn consent after connecting: card status 'AI data sharing off' (amber dot, linked to Settings) with Disconnect and the agent link; mobile shows it as a row with a chevron. g-d-api-key-aioff.png, g-d-mobile0-aioff.png
- 3 'Not now' outcome: not drawn.

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

## Flow Log

Ideal 3 actions: see a clear prompt, allow, see items. For the mail user the prompt appears in the Inbox; for the meeting-only user the consent is part of Connect, so there is no prompt step.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-IF-5-01 | fixed | Plan decides Connect records consent and a meeting-only user never sees the mail prompt; the Granola card shows the consent sentence (g-d-api-key-empty.png). |
| F2-IF-5-02 | fixed | Plan now says the prompt stays for users with a mail account; the mockup draws it above the To do card, consistent. |

## New findings (round 3)

- **F3-IF-5-01** (low, plan): What the Inbox shows after 'Not now' is neither drawn nor defined: do the meeting to-dos stay, and does the prompt come back? Fix: Add one sentence to the plan (S5): after 'Not now' the To do card still shows existing meeting to-dos and the prompt is not shown again in that session.
