# J4 proposal B: restructure (docked approval tray)

## Idea
Treat a pending approval as a mode of the screen, not a message in the scroll. While a card awaits approval, the decision moves out of the scroll into a tray docked directly above the composer, and the composer changes role.

## Changes
1. The pending mail card is drawn in a docked tray above the composer, full width, card fill, with Save and Send. It cannot scroll away, which solves F-duo-006 by construction.
2. In the scroll the card is replaced by a one-line history row ("Re: Pilot timeline", Needs approval) that keeps the thread readable. When the user sends, the row flips to Sent and the tray closes.
3. The composer is dimmed to a single capsule with placeholder "Ask for changes" and no trailing Send while the tray is open. Only one prominent action exists: the tray's Send.
4. No working line while the tray is open. Stop is drawn as in proposal A.
5. Working indicator is the DS-06 avatar and dots, as in proposal A.

## Costs
- The tray plus composer take about 230 pt of the 678 pt strip, leaving about 330 pt for messages, and the 466 pt strip is already crowded by the 72 pt side bar.
- The same content (subject, status) appears twice, in the history row and the tray.
- A new component with its own states (long bodies, Cc rows, MCP tool approval and Ask cards, which also pause a run).
- DS-06 card spec says cards are content in the scroll; this moves one into the floating layer and implies the glass-group count changes.

## Risks
Several pending cards at once (two agents in a group) need a queue in the tray. SwiftUI: `safeAreaInset(edge: .bottom)` stack with a conditional tray, scroll anchoring, keyboard avoidance for the tray plus composer. Highest build risk of the three.
