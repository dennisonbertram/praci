# STORY-IF-5: AI consent is off (round 4)

**Result: PASS**

Walked: Granola mockup, inbox (Mail, consent off), api-key and integrations "AI data sharing off". Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Step 1 is now explained: a meeting-only user never sees the mail consent prompt, so the prompt frame belongs to the Gmail variation.

## Steps

- Step 1: Mail, consent off: the mail consent card "Let Praci sort your mail" with Allow and Not now sits above the To do card; stored meeting to-dos stay visible. (g-d-inbox-consent.png)
- Step 1: Pressing Not now in the mockup does nothing (static frame); the plan text says the Inbox behaves as today and stored to-dos stay. (g-d-inbox-consent-notnow.png)
- Step 2: Key card status "AI data sharing off" (underlined link) in place of "Synced"; tile shows the same state. (g-d-api-key-aioff.png, g-d-integrations-aioff.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-inbox-consent.png: tabs scroll inside the pane; no page overflow.

## Flow Log

Actual 3 steps matches ideal 3 for the Gmail variation; the meeting-only user has no prompt and no step.

## Round-3 findings

| Round-3 id | Status | Evidence |
|---|---|---|
| F3-IF-5-01 | fixed | The plan (Digest and Inbox follow-ups, Empty and in-progress states) now says that after "Not now" the Inbox behaves as today and stored meeting to-dos stay visible and completable. |

## New findings (round 4)

- F4-IF-5-01 (low, mockup): The consent card heading reads "Let Praci sort your mail". Every other string in the two mockups and plans says Rakazo.
