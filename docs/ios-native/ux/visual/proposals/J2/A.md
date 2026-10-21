# J2 (round 2, problem cluster C4) proposal A: minimal change

Board: PG-A-Compose. Frames 4 to 7 (Edit draft, Cc suggestions, Invalid address, Discard prompt) swap the Send arrow for a "Done" capsule.

Idea: delete Done. Every compose frame draws the same Send arrow (bottom of the side strip, the one tinted action). The X stays the only way out.
- Send is dimmed (opacity 0.35, aria-disabled) when there is no recipient or any address is invalid. This answers STORY-047-R2-3 because Done no longer exists to dim.
- Edit draft opened from a thread card: Send sends the edited draft. One tap fewer than Done then Send on the card.
- Merge the two close-with-edits sheets into one: "Save draft", "Discard" (red), "Keep editing". It appears on X only when the text differs from what was last saved. Frame 7 (Discard prompt) and frame 8 (Close with typed text) both show this sheet.
- Edit-draft attach button uses the paperclip like every other frame (frames 4 to 7 draw a page icon labelled "Attach file").
Cost: five small markup edits; no new frames.
