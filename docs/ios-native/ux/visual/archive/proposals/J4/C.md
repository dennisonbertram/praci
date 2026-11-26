# J4 proposal C (best-in-class pattern): bounded list with an inline "Show N more" row

## Pattern
Things and Apple Mail both keep a long, complete list short with an in-place disclosure row ("Show N more", Mail's "Show More" under Mailboxes), and Messages never hides a conversation that has an unread dot. The list is complete, ordered by recency, bounded by default, and expands in the same place without opening a new screen.

## Idea
- Section label: AGENTS (matches the New agent menu item, the New agent sheet title and the "No agents yet" empty state). Groups stay in the list because a group is a chat with agents; the row already shows two avatars.
- The list is every agent and group, sorted by recency. Collapsed it shows the four most recent rows plus any row with an unread dot. Chief, Carta, Mercury and Inbox agent are the four on the current boards.
- One extra row follows the last visible agent: "Show 3 more" in secondary text (#9C9A93), aligned to the name column, with a chevron.down at the right. Tap expands in place; the row becomes "Show less" with chevron.up.
- Finance agent and Legal agent appear in the expanded list even if they have never had a task. Activity stays a copy of rows needing attention.
- When there are four agents or fewer, no extra row appears. The empty space keeps "No agents yet" and "New agent".
- PG-B-NewGroup member picker lists every agent (same order), scrolling inside the sheet.

## Persona check
The first four rows are the same as today, so Pages stay about where they are (one 44 pt row lower). Any agent is one tap away, in the place the person already looks, with no new screen.

## Cost
One new row style (a copy of the See all affordance, plain row). In SwiftUI this is a `List` section with a state flag and a `ForEach` over a prefix, or a `DisclosureGroup` for the remaining rows.
