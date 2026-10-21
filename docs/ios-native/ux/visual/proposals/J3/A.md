# J3 proposal A: minimal change (composer is the only editor)

Idea: do not add an editing surface. The chat composer stays the one way to change a draft ("Add Jordan on Cc"). Fix only the words and the missing states.

## Journey
Persona: a founder with a pending reply to Ana who must add Jordan on Cc and move the start to 10:30.
1. Reads the card in the thread (PG-A-Thread, PH-Thread, Inner).
2. Types "Add Jordan on Cc and make it 10:30" in the composer, taps the composer send.
3. The agent posts a new card. The old card shrinks to a one-line "Replaced" row.
4. Taps Send on the new card. Card shows "Sent".
Taps: 2 plus typing a sentence. To fix one word, the founder must describe the change in words.

## Changes
- Card buttons: rename "Save" to "Save draft". Send unchanged (the one prominent action).
- After Save draft: the card header tag changes from "Needs approval" to "Saved" (drawn state).
- Replaced state: old card collapses to one muted line "Replaced by a newer draft", no buttons.
- Empty To: Send dimmed, To row reads "Add a recipient" in the warning color.
- DS-06-Chat: delete the phrase "Body is tappable to edit" so the spec stops promising an affordance that does not exist.
- PG-A-Compose: X with typed text opens an action sheet "Save draft / Discard draft / Cancel". Same draft record as the card's Save draft; one Drafts list.
- Not added: edit button, edit sheet, Cc suggestion states.

## Fixes by issue
STORY-047-R1-3 yes; R1-6 yes; V-thread-R1-5 partly (label only, no edit); V-iphone-R1-12 partly; RED-R1-10 yes; V-inbox-R1-10 yes; F-inbox-computer-R1-002 partly; STORY-047-R1-1 and F-thread-012 no (no edit entry); STORY-047-R1-4 no.

## Risk
Smallest SwiftUI work (text changes, one action sheet). Leaves the founder unable to fix a single word without a round trip to the agent.
