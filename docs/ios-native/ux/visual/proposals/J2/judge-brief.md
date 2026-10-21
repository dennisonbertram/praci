# Judge brief: J2 Cleanup entry and archive-versus-unsubscribe confirm

Context: Praci's planned native SwiftUI iPhone app, design boards only. Cleanup lets a user tick bulk-mail senders and Archive their emails or Unsubscribe. Today it is a labeled capsule in the Duo outer-display strip (PG-A-Cleanup) but sits in the "..." More menu on iPhone (PH-Inbox), Split, Sheet and Inner-Message. The only confirm says "Archive and unsubscribe" and combines a reversible action with an irreversible one. A "Skip inbox for future mail" menu item is unexplained.
Rules: glass only on floating controls, at most three glass groups, exactly one tinted prominent action per view, minimal copy.
Acceptance: Archive and Unsubscribe have separate confirms; Undo offered once; "Skip inbox" explained or removed; one entry location on every board.

Proposals:
A: Cleanup in More everywhere. Archive has a confirm sheet, Unsubscribe has a separate confirm sheet. Remove Skip inbox.
B: Labeled Cleanup capsule everywhere (strip and added to iPhone/Inner/Split/Sheet bars). Separate confirms. Remove Skip inbox.
C: Apple Mail pattern. Cleanup in More everywhere. Archive runs at once with an Undo toast and no confirm; Unsubscribe uses a native confirmation dialog (irreversible). After Archive the Done view offers "Unsubscribe from 3 senders". Remove Skip inbox.

Score each 1-5 on: meets criteria x3, simplicity x2, consistency x2, usability x2, visual quality x2, effort/risk x1 (5 = small and safe). Return a winner, optional graft, and a short defense. Note: the acceptance text says "separate confirms"; judge whether C meets it.
