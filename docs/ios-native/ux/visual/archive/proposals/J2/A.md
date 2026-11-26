# J2 / A (minimal change): Cleanup in More everywhere, two confirms

Evidence read: r3/PG-A-Cleanup.png, r3/PH-Inbox.png, r3/Split.png, r3/Inner-Message.png (Sheet source checked for text; no Cleanup entry drawn).

Idea: keep everything the Cleanup screen draws today, change only the entry and the confirm.
- Entry: Cleanup lives in the "..." (More) menu on every inbox board. PG-A-Cleanup frame 1 swaps the labeled "Cleanup" capsule for the same 44 pt "..." circle used by Split and Inner-Message, and shows the popover.
- Confirm: delete the combined "Archive and unsubscribe" sheet. Archive 101 emails opens a sheet "Archive 101 emails?" with Archive and Cancel. Unsubscribe opens "Unsubscribe from 3 senders?" with Unsubscribe and Cancel, noting it can't be undone.
- Remove the chevron and the "Skip inbox for future mail" menu (frame 4 deleted); nothing in the app explains it.
- Done frame: "101 emails archived" with Undo.
Cost for a user who wants both: select, Archive, confirm, Unsubscribe, confirm = 5 actions after selecting.
Weakness: the Archive confirm duplicates the Undo that already exists, so a reversible action gets a speed bump.
