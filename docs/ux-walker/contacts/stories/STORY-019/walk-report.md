# STORY-019: Tell Chief to save a person

Status: pass
Session: walk-c (walk-c2 after the first browser session hung)

## Screens
- step-1/2: message typed in Chief and sent; thread shows Thinking, no approval card.
- step-3: Chief replies it saved Ada Example as a legal contact at the organization and says it is a new contact.
- step-4: Contacts search WalkC shows the row (Legal kind, organization with the tag).
- step-5: Edit contact dialog shows Notes 'Found in chat: user said Ada is their new lawyer.' and 'Added by Chief'.
- mobile-check: 390px Contacts list shows Name and Kind, no overflow.

Geometry audit: pageOverflowX 0, no wrapped controls; unevenRows hits were the sidebar name/time rows and overflowSpills the message hover action bar, both intentional and not logged.

## Flow Log
Actual 4 steps, ideal 2 (send, read reply); the optional Contacts check was the extra 2. The agent put the (WalkC) tag only in the organization, name stayed 'Ada Example'. No hesitation. A new-thread control does not exist (the + menu only starts a new bot/group/space; Chief's actions menu has no new thread), so Chief's single thread was used and is shared with other walkers. The 'Adding a contact' label was not observed on this run (reply arrived between polls).
