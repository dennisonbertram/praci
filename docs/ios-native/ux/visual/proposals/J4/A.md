# J4 proposal A (minimal change): rename to AGENTS and list every agent

## Idea
Rename the section label PERSONNEL to AGENTS on every Home surface. List every agent and group in it, sorted by recency as decided before. Finance agent and Legal agent get a row in AGENTS even while they also appear in Activity (Activity is a copy of rows that need attention). The empty state "No agents yet" and the "New agent" button already match the new noun. No new row, screen or control.

## What changes
- PH-Home, PG-A-Home, Main, PG-A-HomeNoModel, PH-Spaces, PG-B-Spaces, Split, DS-03, DS-04, PG-A-Rules: label text PERSONNEL becomes AGENTS.
- PH-Home Connected and PG-A-Home Home, New menu, Offline: add Brex agent, Finance agent and Legal agent rows after Inbox agent (7 agent rows).
- PG-B-NewGroup: member picker lists the same agents as Home.

## Cost
Seven rows of 54 pt each push PAGES below the fold on PH-Home (393x852) and push Pages further down on the Duo outer display (466x678). The Home list gets about 160 pt longer. Groups still sit in a section named for agents.

## Persona check
Someone looking for the Finance agent finds it in the list. Chat stays the primary path. Reaching Pages (Finance, Legal, Cap table) now needs a scroll past every agent, which is the secondary path.
