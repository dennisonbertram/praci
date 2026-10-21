# J2 (round 2, problem cluster C4) proposal C: Apple Mail convention

Pattern: Apple Mail compose. Send is the one prominent control at all times; Cancel asks only if the draft changed; the sheet offers Save Draft and Delete Draft, and tapping outside it keeps editing.
- Every frame draws Send; dimmed when no recipient or an address is invalid (Mail dims Send the same way).
- X on an unchanged draft closes with no sheet. X on a changed draft shows a two-action sheet: "Save draft", "Discard draft" (red). The "Keep editing" button is dropped; the scrim is the way back.
- Both existing sheets (frames 7 and 8) become this same two-action sheet.
Costs: on the 466 pt strip the scrim is a thin area, and VoiceOver and SwiftUI confirmationDialog always add a Cancel button, so the two-action sheet cannot ship natively as drawn. The board would draw something the app will not render.
