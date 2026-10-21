# STORY-024: Duplicate returns already saved

Status: fail (one medium finding)
Session: walk-c (walk-c2 after the first browser session hung)

## Screens
- step-2: Chief shows Thinking, then labels Adding a contact and Saving a contact were observed.
- step-3: reply says Quinn was updated from auditor to advisor, not 'already saved'.
- step-5: Contacts dialog confirms Quinn is now Advisor, notes unchanged.
- step-6-own-contact: repeating the request for my own Ada contact gives 'Ada Example is already saved as a legal contact at Example & Partners (WalkC). Should I change her kind to investor?' with two buttons, the expected behavior and it names the kind.
- mobile-check: Contacts list at 390px shows Advisor.

Geometry audit: pageOverflowX 0, no wrapped controls; unevenRows hits were the sidebar name/time rows and overflowSpills the message hover action bar, both intentional and not logged.

## Flow Log
Actual 2 steps for the agent reply, ideal 2. The seeded contact was changed by the agent, not by me; I did not restore it. Quinn is now Advisor and anyone asking for the auditor may get a different answer.
