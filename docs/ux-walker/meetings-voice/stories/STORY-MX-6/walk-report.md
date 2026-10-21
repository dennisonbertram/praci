# Walk report: STORY-MX-6

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **fail (1 high plan finding; stopped-S5 case not drawn)**.

## Steps

1. Asking the Flow agent a live-MCP question: not drawn.
2. Tool vanishes after the pin: not drawn.
3-4. "No synced meetings" and Granola agent returns nothing: not drawn.
5. Tile status: the Integrations page (screenshots/step-5.png, Wispr#screen-flow-meetings, Tile) shows two identical cards, "Wispr Flow / Meeting notes / Connected" and "Granola / Meeting notes / Connected". The Granola detail page (separate mockup) has a "Synced N meetings" status row; the Flow tile shows no sync line and no way to tell whether Flow meetings are stored. Journey breaks: steps 1-4 have no surface; step 5 has a surface that says Connected only (JF-15).
LOOK: two cards 266 and 268 px wide (sub-3 px, noise); equal heights; grid is clean. Geometry: only the state-pill group hit. Mobile spot-check: cards stack, no overflow.

## Flow Log

Ideal 2 steps. With S5 stopped the user can only ask the Flow agent live; actual path in the mockup: 1 step to see the tile, which says Connected and nothing else, so the user cannot tell why 'ask across all my meetings' fails for Flow. Duplicated information: both tiles are described 'Meeting notes', which says nothing about the difference (stored vs live).

## Findings (2)

- F-MX-6-1 [plan, high, error-handling] If S5 stops after pinning, the tile reads Connected, the Flow agent has a tighter tool list and no stored meetings, and nothing tells the user. Cross-meeting questions fail for Flow with no explanation. (ref: JF-15)
- F-MX-6-2 [plan, low, consistency] Tile subtitle 'Meeting notes' is identical for Flow and Granola, so the tile does not hint at the difference (stored vs live) between the two. (ref: NEW)

## Screenshots

- screenshots/mobile-check.png
- screenshots/step-5.png
