# STORY-027: What the chat shows while a contact tool runs

Status: pass
Session: walk-c (walk-c2 after the first browser session hung)

## Screens
- step-2: Thinking, then 'Reading your contacts' then 'Saving a contact' observed (the 'Adding a contact' label was too brief to catch).
- step-3: one reply lists four investors, then 'Added Sam Walker (WalkC) as a customer at Walker Co (WalkC)' and 'Changed Ada Example ... from investor to advisor'.
- step-5/6: Contacts shows Sam Walker (Customer) and Ada Example (Advisor); Sam's dialog shows 'Added by Chief' and empty Email.
- mobile-check: 390px list is clean.

Geometry audit: pageOverflowX 0, no wrapped controls; unevenRows hits were the sidebar name/time rows and overflowSpills the message hover action bar, both intentional and not logged.

## Flow Log
Actual 1 message, ideal 3 steps including approval; there was no approval card (see F-025-01). The reply summarized all three actions.
