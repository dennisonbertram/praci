# J3 proposal C: the Apple Mail draft pattern (autosaved draft, explicit Edit, Done)

Pattern named: Apple Mail and Messages. A draft is always already saved (Mail autosaves). An explicit "Edit" opens the compose sheet; closing asks only if there are unsaved changes. Messages marks an edited message in place rather than adding a second one. Things and Linear edit in place on the object; here that is the card, which keeps its identity.

## Journey
1. Reads the card. Footer shows Edit (quiet) and Send (the one prominent action).
2. Taps Edit, or taps the card body (shortcut). Sheet opens with the PG-A-Compose layout, title "Edit draft".
3. Picks Jordan Lee from the Cc suggestions, edits the time, taps Done.
4. Returns to the same card, already updated. Taps Send. Card shows "Sent".
Fast path with no editing: Send. Words-only path: type to the agent; the old card collapses to "Replaced".
Taps: Edit, Cc contact, Done, Send = 4 plus typing; no separate Save step to remember.

## Changes
- Card footer: Save removed. The draft is saved on the server the moment the agent produces it and after each edit, so there is nothing to save. Footer is Edit (quiet capsule) and Send (prominent).
- Card body is also tappable and opens the same sheet; Edit exists so the affordance is visible.
- Edit sheet (new frames in PG-A-Compose, "Edit draft"): same fields; bottom-left slot shows a "Done" capsule instead of the send arrow; X in the side strip closes. X with changes shows an action sheet: "Discard changes" (destructive) / "Keep editing". Done keeps changes. Compose New message and Reply: X with typed text shows "Save draft" / "Discard draft"; both write the one Drafts list.
- Sheet states drawn: Cc expanded with a suggestion list (Jordan Lee), invalid address (chip in destructive color, one inline line "Not a valid address"), empty To (Done allowed, Send dimmed on the card with To row "Add a recipient").
- Replaced: when the agent posts a newer draft, the old card collapses to one muted row "Replaced by a newer draft", no buttons. Tapping Edit while the agent works on a rewrite is not drawn; the Edit capsule dims while "Inbox agent is working".
- Same draft everywhere: card edits, sheet edits and Compose X "Save draft" are the same draft record. No "Save" label anywhere on the card.
- DS-06-Chat: mail approval card spec says: footer Edit + Send; body tap opens the editor; no Save; states Needs approval, Needs approval with Cc, Edited (no tag, content simply updated), Replaced, Sent, Not sent, empty recipient.

## Fixes by issue
STORY-047-R1-1, 3, 4, 6; F-thread-012; V-thread-R1-5; V-iphone-R1-12; RED-R1-10; V-inbox-R1-10; F-inbox-computer-R1-002. All covered.

## Risk
Medium: one new sheet mode and dirty-state tracking in SwiftUI (`.sheet` with `.interactiveDismissDisabled(hasChanges)` plus `confirmationDialog`). Needs a server decision to save every agent draft as a draft record (not confirmed in this repo).
