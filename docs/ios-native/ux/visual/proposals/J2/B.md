# J2 (round 2, problem cluster C4) proposal B: restructure (autosave, no close sheet)

Idea: remove the close prompt completely. Compose autosaves, as Things and Linear do. Send is the one tinted action in every frame (Done removed, dimmed for no recipient or invalid address).
- X always closes. The draft is kept in Drafts (new message, reply) or on the thread card (edited agent draft).
- After closing, the previous screen shows a short toast "Draft saved" with "Delete". Delete is the only discard route; it is also undoable for a few seconds.
- Frames 7 and 8 become "Closed" frames showing the toast instead of a sheet. No sheet remains on the board.
Costs: needs server autosave on every pause in typing (more writes, conflict handling with the agent replacing a draft), a new toast frame on three boards that return from Compose, and abandoned experiments pile up in Drafts. Discard is less discoverable. Edit-from-card discard (reverting to the agent version) has no obvious home.
