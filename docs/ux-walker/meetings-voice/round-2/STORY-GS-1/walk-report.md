# STORY-GS-1: Founder pastes a key and gets a first answer (round 2)

**Result: PASS**

Outdated or changed by the plan: Step 2/3 wording: the detail page now shows only the key card; no 'Live questions' or 'Sync' groups (plan Surfaces, FX-54).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Integrations, Granola tile (Not connected).** Tile reads 'Granola / Meeting notes' with a 'Not connected' badge on one line. Sidebar has no Granola agent yet (first-time state). Geometry: no overflow, no wrapped controls. Screenshot: `screenshots/int-new.png`

- **2 Click the tile, detail page.** Detail page opens with one card: 'Granola API key · Business plan', 'Get a key in Granola ↗', password field, dimmed 'Connect'. The audit flags the key link as a wrapped control, but on screen it is one line at 1280 px (false positive); at 390 px it wraps before the arrow (see new finding). Screenshot: `screenshots/int-detail.png`

- **3 Paste key, press Connect.** Typing enabled Connect (verified live: disabled before, enabled after fill). Pressing it shows the field disabled and the button 'Connecting…'. Feedback exists, no dead button. Screenshot: `screenshots/key-connecting.png`

- **4 First sync running.** Status row reads '● Syncing' with Disconnect and the 'Granola agent' link. After about 1.2 s it becomes 'Synced 42 meetings' (key-connected.png). The first-sync state R1 asked for is drawn. Screenshot: `screenshots/key-syncing.png`

- **5 Agent link on the card.** 'Granola agent' link sits under the status line (IntegrationAgentSection pattern). The chat does not open by itself, as the plan says. Screenshot: `screenshots/key-connected.png`

- **7-8 Ask the agent.** Question, a 'Searched meetings' tool chip, answer with one chip 'Pricing review, 12 Oct'. Composer 'Ask Granola agent' present. Geometry: citation chip 136x21 px (below 32 px; low). Screenshot: `screenshots/agent-answer.png`

- **9 Inbox with mail connected.** 'Mail connected' state: All / account tabs, To do card with three meeting items ('From: Pricing review, 12 Oct'), then the mail rows. This is the mail plus meetings layout R1 said was missing. Screenshot: `screenshots/inbox-mail.png`

- **10 Tick a to-do.** Verified live: tick adds fade, row height goes to 0 after the fade, two rows remain. No undo (same as mail to-dos today). Screenshot: `screenshots/inbox-todos.png`

- **390 390 px spot-check.** Layout reflows to one column, no horizontal overflow (pageOverflowX 0). Inbox card also fits (m390-inbox.png). Screenshot: `screenshots/m390-int-detail.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 4 actions (open tile, paste, Connect, ask) plus Inbox visit = same as Ideal path of 4. No hesitation points found. Sync count, agent answer and Inbox to-do each show data of different freshness, but the card says 'Syncing' until the first sync completes, which removes the 'is 42 everything?' doubt.

## Round-1 findings

| Round-1 id | Status | Evidence |
|---|---|---|
| F-GS-1-01 | fixed | Step 4 'Syncing' state drawn, then 'Synced 42 meetings' (key-syncing.png, key-connected.png). Plan Surfaces: 'Syncing' until syncedThrough is set. |
| F-GS-1-02 | fixed | 'Granola agent' link on the Syncing and Connected card; plan: IntegrationAgentSection. |
| F-GS-1-03 | obsolete | Two Disconnect buttons no longer exist: the detail page has one key card (plan FX-54). |
| F-GS-1-04 | obsolete | 'Live questions' and 'Sync' labels removed from tile and detail page. |
| F-GS-1-05 | fixed | 'Not connected' tile and a sidebar without the Granola agent are drawn (int-new.png). |
| F-GS-1-06 | fixed | Inbox 'Mail connected' state draws mail rows plus the To do card (inbox-mail.png). |
| F-GS-1-07 | fixed | Disabled Connect is now a dim outline button (int-detail.png), clearly different from the enabled white button (key-entering.png). |
| F-GS-1-08 | fixed | Tile badge sits on one line (int-new.png, int-key.png). |
| F-GS-1-09 | still-open | Checkboxes now have a 32 px hit area (geometry: no small targets for checkboxes). Citation chips are still 21-24 px tall; narrowed to low, see F2-GS-1-01. |

## New findings (round 2)

- **F2-GS-1-01** (low, mockup): Citation chips are 21 to 24 px tall in agent answers, below the 32 px target. Fix: Add vertical padding or a transparent hit area to .cite.
- **F2-GS-1-02** (low, mockup): 'Get a key in Granola ↗' wraps its arrow onto a second line at 390 px (and the geometry audit flags it at 1280 px). Fix: white-space:nowrap on the link or let the label drop its arrow.
- **F2-GS-1-03** (low, plan): While the first sync is still 'Syncing' the agent may not find a meeting from 80 days ago. The plan's list of literal 'nothing found' reasons has no 'still syncing' reason, so Maya may conclude Granola data is missing. Fix: Add 'first sync still running' to the literal reasons in granola.md (Reading). No UI.
