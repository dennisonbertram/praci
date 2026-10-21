# Walk report: STORY-MX-8

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **fail (1 high plan finding)**.

## Steps

1. Granola key card, Connected (screenshots/step-1.png, Granola#screen-api-key): "Synced 42 meetings, 3 minutes ago" with a red Disconnect button; the key field disappears once connected, so a user cannot replace a key without disconnecting (the Flow Voice mockup does offer "Replace key"). No link to the Granola agent on the card (JF-18). The story's first-sync state (backfill) is not drawn (JF-6). A note "Rejected state also appears for a key that worked earlier..." is rendered below the card in the Connected state: leaked author note.
2. Flow tile Connected (step-2.png): no sync line (JF-15).
3. Ask the Granola agent: see MX-1; not repeated.
4. Inbox with no mail account (step-5.png, Granola#screen-inbox, With to-dos): the mockup draws only a To do card, no "Connect mail" empty state. This resolves the story's concern in the mockup but contradicts today's page (JF-1) and the plan text; the AI-data consent card (JF-16) is not drawn for this view.
5. To-do detail line "From: Pricing review, 12 Oct": provider not shown; same line style in the Flow Inbox state (step-5b.png) which explains the provider only in a footnote outside the product. Cannot tell the tool a meeting came from (JF-21/JF-22).
6. Complete a to-do: checkboxes named by their text (accessible, snapshot confirmed); a note "Tick a to-do to complete it..." is an author note shown as UI.
7. Disconnect later: screen-disconnect is outside this story's assigned mockup list; covered by the GS-7 walker.
Geometry: only state-pill groups hit (false positives). Mobile spot-check (mobile-check.png, Inbox): card fits, due labels right-aligned, no overflow.

## Flow Log

Ideal 6 steps (connect Granola, connect Flow, ask, open Inbox, see follow-ups, complete one). Mockup supports all six at least as static screens; actual friction points: no 'syncing' state after Connect, no agent link after connect, and Inbox only works in the mockup because it omits the 'Connect mail' state. Duplicated information: the same commitment would show in the agent answer and the to-do; the same meeting could be listed twice if recorded in both tools (JF-19), undrawn.

## Findings (6)

- F-MX-8-1 [plan, high, flow] For a meeting-only user the Inbox shows 'Connect mail' today; the mockup draws the To do card alone, but the plan does not say how or where it appears. The plan must adopt the mockup. (ref: JF-1)
- F-MX-8-2 [plan, medium, flow] With AI-data consent off, a meeting-only user sees no card at all and the consent prompt is not drawn in this view. (ref: JF-16)
- F-MX-8-3 [plan, medium, happy-path] After 'Connect' there is no in-progress sync state; the mockup jumps to 'Synced 42 meetings'. (ref: JF-6)
- F-MX-8-4 [plan, low, consistency] Granola card has no Replace key once connected, while the Voice key card offers Replace key. (ref: NEW)
- F-MX-8-5 [plan, medium, happy-path] To-do detail line does not name the provider; a meeting recorded in both tools gives two to-dos for one commitment. (ref: JF-21 / JF-19)
- F-MX-8-6 [mockup, low, visual] Author notes shown as UI: 'Rejected state also appears...' (Connected state), 'Tick a to-do to complete it...', provider footnote. (ref: NEW)

## Screenshots

- screenshots/mobile-check.png
- screenshots/step-1.png
- screenshots/step-2.png
- screenshots/step-5.png
- screenshots/step-5b.png
