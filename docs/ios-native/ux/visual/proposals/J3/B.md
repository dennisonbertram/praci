# J3 proposal B: restructure (tap the card opens a prefilled editor sheet)

Idea: the card body becomes a button. Tapping it opens the PG-A-Compose layout as a sheet prefilled with To, Cc, Subject and body. A "Done" control returns to the card. The card keeps Save draft and Send.

## Journey
1. Reads the card (PG-A-Thread).
2. Taps the card body (pencil glyph in the card header signals it). Sheet opens, prefilled. Title "Edit draft".
3. Adds Jordan under Cc (suggestion list), fixes "10am" to "10:30" in the body, taps Done.
4. Card updates in place; no second card, no "Replaced" tag.
5. Taps Send.
Taps: open, add Cc contact, Done, Send = 4 plus typing.

## Changes
- Card: header gets a pencil glyph; the whole body is one tap target. Footer stays Save draft (quiet) and Send (prominent).
- New board PG-A-DraftEdit (or three extra frames in PG-A-Compose): Edit draft with prefilled fields, Cc expanded with suggestions, invalid-address inline error.
- The up-arrow in the Compose layout becomes a "Done" capsule in the same bottom-left slot. X on the side strip asks "Save changes / Discard changes" when the text changed.
- Composer route still exists; the old card shows "Replaced" with no buttons.
- Save draft writes the same draft the sheet edits; Compose X "Save draft" writes the same record.
- Edits made in the sheet replace the agent's draft body in place and are sent to the agent as the new truth.

## Fixes by issue
All of STORY-047-R1-1, 3, 4, 6; F-thread-012; V-thread-R1-5; V-iphone-R1-12; V-inbox-R1-10; F-inbox-computer-R1-002; RED-R1-10.

## Cost
The card now has three controls (tap body, Save draft, Send); "Save draft" survives as a second save concept next to "Done". A tappable body has weak discoverability on the narrow 393 pt card even with the pencil.
