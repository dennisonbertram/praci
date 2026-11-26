# J4 proposal B (restructure): RECENT on Home, Agents become a page

## Idea
Home keeps only a short recents list and drops the word Personnel. The full roster moves to a new Agents page.
- The section label becomes RECENT and shows Chief plus the three most recent chats (agents or groups).
- PAGES gets one new row, "Agents" with the count "7" as its meta, using the same row recipe as Finance and Legal. It opens an Agents list screen: every agent and group, alphabetical, with a search field, plus New agent in the header.
- Empty space: RECENT is hidden; the Agents row stays and the empty Agents page carries "No agents yet" and "New agent".

## What changes
- PH-Home, PG-A-Home, Main: relabel to RECENT, cap at four rows, add the Agents row at the top of PAGES.
- New frame "Agents" in PH-Home and PG-A-Home (list, empty, search active).
- PG-B-NewGroup member picker lists all agents.
- Catalog and rule cards: add the Agents page, a new route and a new story set.

## Cost
Two nouns now exist (RECENT for chats, Agents for the page). Two entries lead to the same agent, one in RECENT and one in the page. An agent such as Legal agent needs two taps (Pages, Agents, Legal agent is three). New screen, new frames in two boards, new catalog stories and a new route in the SwiftUI app.

## Persona check
Home is short and Pages stay visible. Finding a quiet agent costs three taps and the person must know it lives under Pages.
