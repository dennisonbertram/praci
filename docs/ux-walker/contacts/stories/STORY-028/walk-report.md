# STORY-028: Non-owner runs get no contact tools

Status: not walkable in the UI
Session: walk-c (walk-c2 after the first browser session hung)

## Screens
- No screens: a webhook or another account's bot cannot be triggered from the UI.

Geometry audit: pageOverflowX 0, no wrapped controls; unevenRows hits were the sidebar name/time rows and overflowSpills the message hover action bar, both intentional and not logged.

## Flow Log
Marked not walkable in the UI as instructed.
