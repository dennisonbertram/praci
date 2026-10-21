# STORY-GS-7: Disconnect keeps the data (round 2)

**Result: PASS**

Outdated or changed by the plan: Step 1/5 changed by decisions D4 (owner can delete a stored meeting) and the plan's 'no confirmation dialog on Disconnect'.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Press Disconnect.** Single red outline 'Disconnect' beside the status line. No confirmation, as the plan decides (reconnecting restores everything). Screenshot: `screenshots/key-connected.png`

- **2 Card after Disconnect (screen 6).** Frame 1: muted line 'Your data in Granola is not deleted.', empty key field with 'Business plan' and the key link, dimmed Connect. Three labelled frames (Integrations card, Agent chat, Inbox). Screenshot: `screenshots/disc-after.png`

- **3 Agent still answers.** Frame 2: the earlier answer with chip 'Pricing review, 12 Oct'. Frame 3: the To do card with 'Send Dana the revised pricing'. Screenshot: `screenshots/disc-after-2.png`

- **4 Complete a to-do after disconnect.** Checkbox present in frame 3; tick behavior was verified on screen 4 (fade, row leaves). Screenshot: `screenshots/disc-after-2.png`

- **5 Delete a stored meeting.** Citation chip opens a popover: attendees 'Dana Reyes, you', 'Open in Granola ↗', red 'Delete'. Delete opens 'Delete this meeting and its to-dos?' with Cancel and Delete. Takeable, but per meeting only. Screenshot: `screenshots/cite-open.png`, `screenshots/cite-confirm.png`

- **6 Reconnect with a new key.** Pasting a key and pressing Connect runs the normal flow; the plan says stored meetings return. Screenshot: `screenshots/key-entering.png`

- **API card Disconnect on the key card (screen 2).** Verified live: Disconnect on the screen 2 card goes to the empty key card without the 'Your data in Granola is not deleted.' sentence that screen 6 shows. Screenshot: `screenshots/key-empty.png`

- **390 390 px spot-check.** Popover and Disconnect After frame fit; key link wraps its arrow (low). Screenshot: `screenshots/m390-cite-open.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 2 steps (open page, press Disconnect) = Ideal 2. Hesitation at the next step: the only sentence on the card is about Granola's data, not Rakazo's stored copy, so Ethan still has to discover by asking the agent that his meetings remain. Deleting 200 meetings means 200 popover deletes.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-GS-7-01 | still-open | A sentence is drawn ('Your data in Granola is not deleted.') but it describes Granola's copy; it does not say Rakazo keeps meetings and to-dos. The three frames show retention only through the layout. See F2-GS-7-01. |
| F-GS-7-02 | fixed | Per-meeting Delete exists in the citation popover with a confirmation (cite-open.png, cite-confirm.png; decision D4). Bulk removal remains absent, see F2-GS-7-02. |
| F-GS-7-03 | obsolete | Plan decides no confirmation: Disconnect is reversible and keeps all data, so one click is acceptable. |
| F-GS-7-04 | obsolete | Plan Deliberate choices: a to-do from a disconnected source looks like any other. |
| F-GS-7-05 | fixed | After state is three labelled frames with their own sidebars (disc-after.png, disc-after-2.png). |
| F-GS-7-06 | fixed | The annotation sentence is gone from the Inbox frame. |

## New findings (round 2)

- **F2-GS-7-01** (medium, plan): After Disconnect the only line says Granola's data is not deleted. Ethan's question is whether Rakazo keeps his meetings and to-dos. The plan reuses the existing sentence by choice, so the person who expects Disconnect to remove access is still surprised when the agent answers. Fix: Reword once, for example 'Your meetings and to-dos in Rakazo are kept.', and quote it in the S6 PR; or record the decision.
- **F2-GS-7-02** (medium, plan): Delete is available per meeting only and only through a citation in an agent answer. A user who wants all stored meetings gone must ask about each meeting and delete one by one. Fix: Record 'no bulk delete' as a decision in granola.md; revisit if users ask.
- **F2-GS-7-03** (low, mockup): Disconnect on the screen 2 key card returns to an empty card without the sentence 'Your data in Granola is not deleted.' that screen 6 shows after Disconnect. Fix: Add the sentence to the 'empty after disconnect' variant or share one state.
