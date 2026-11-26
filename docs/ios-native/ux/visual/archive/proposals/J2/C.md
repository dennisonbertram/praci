# J2 / C (best-in-class): Apple Mail pattern, More menu plus "confirm only what cannot be undone"

Pattern name: Apple Mail's "..." menu for rare list actions, with Mail's rule that Archive runs at once with an Undo toast while Unsubscribe asks first in a native confirmation dialog (Messages and Things use the same split: reversible actions never prompt, irreversible ones use a destructive-role dialog).
- Entry: Cleanup in the "..." menu on every inbox board (PG-A strip gets the "..." circle in place of the capsule; PH-Inbox and Sheet draw the same menu frame as Split).
- Archive 101 emails: no confirm. It runs, shows "Archiving 40 of 101", then the Done frame with Undo.
- Unsubscribe: native confirmationDialog "Unsubscribe from 3 senders?" with message "Unsubscribing can't be undone.", a destructive "Unsubscribe" button and Cancel.
- After Archive, the Done frame also offers "Unsubscribe from 3 senders" so the sender list vanishing does not strand the second step.
- "Skip inbox for future mail" and its chevron are removed.
Cost for both actions: select, Archive, Unsubscribe, confirm = 3 actions after selecting. Weakness: Archive has no confirm, so the acceptance line "Archive and Unsubscribe have separate confirms" is only half met.
