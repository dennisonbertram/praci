# J4 proposal B: restructure, Pages become a compact chip strip above Personnel

## Idea
Replace the six-row Pages card with a wrapping strip of chips placed between Activity and Personnel. Each chip is an icon, a name and, when there is something to say, a count. Inbox is the first chip with "3". All six pages occupy about two chip rows (about 100 px instead of 264 px), so Personnel stays on screen.

## Edits
- PH-Home, PG-A-Home, Main: remove the PAGES label and card. Add a chip strip (44 px tall chips, 8 px gap, 16 px radius, solid #252523) directly under Activity. Chip text: "Inbox 3", "Finance", "Legal 2", "Cap table", "Data room", "Team computer".
- Split: the sidebar keeps rows (it is persistent navigation); order becomes Activity, Pages, Personnel as today.

## What the persona sees
Everything fits on one screen on both PH-Home and the Duo outer display. Inbox is the first chip, left aligned.

## Trade-offs
- Loses the row subtitles that carry information: "3 need reply" becomes "3", "6 mo runway", "2 deadlines" and the Team computer "Online" dot drop to a bare count or nothing.
- Chips wrap unpredictably with long names or large Dynamic Type sizes; a wrapping flow layout in SwiftUI is custom (Layout protocol), not a native List.
- Phone and Split no longer share one pattern, and the AGENTS.md rule to prefer native iOS controls is not met by a custom chip strip.
