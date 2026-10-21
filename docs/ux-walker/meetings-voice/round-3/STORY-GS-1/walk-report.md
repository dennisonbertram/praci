# STORY-GS-1: Founder pastes a key and gets a first answer (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 2 now has a defined surface (detail page: MCP sign-in card above the key card, no 'Live questions' or 'Sync' groups). Step 9 To-do detail is 'Pricing review, 12 Oct' without a 'From:' prefix (plan, Digest and Inbox follow-ups). Step 5 is the 'Granola agent' link on the card (plan, Connected key card).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Integrations, Granola tile (Not connected): tile reads 'Granola / Meeting notes / Not connected'; sidebar has no Granola agent yet. g-d-integrations-new.png
- 2 Click the tile: detail page shows 'Sign in with Granola' card, then the 'Granola API key - Business plan' card with 'Get a key in Granola', an empty field, a dim Connect and 'Sends your meeting notes and transcripts to your AI model.' g-d-integrations-detail.png
- 3 Paste and Connect, driven live on screen-api-key: typing enabled Connect (disabled before), pressing it showed 'Connecting…' with the button disabled. g-d-live-entering.png, g-d-api-key-verifying.png
- 4 First sync: status row '● Syncing' with Disconnect, then after about 1.2 s '● Synced 42 meetings' (observed live). g-d-api-key-syncing.png, g-d-live-after.png, g-d-api-key-connected.png
- 5 'Granola agent' link sits under the status line (IntegrationAgentSection pattern); the chat does not open by itself, as the plan says. g-d-api-key-connected.png
- 7-8 Ask the agent: question, 'Searched meetings' chip, answer with one citation chip 'Pricing review, 12 Oct' (149x32 px). g-d-agent-answer.png
- 9 Inbox, 'Mail connected' frame (Maya has mail in this story): All / account tab, To do card with three meeting items and one mail item, then mail rows. g-d-inbox-mail.png
- 10 Tick a to-do: the web checkbox target is 32x32 and the row fades out. g-d-inbox-todos.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: detail page and key card reflow to one column, no horizontal overflow. g-m-integrations-detail.png

## Flow Log

Actual 4 actions (open tile, paste, Connect, ask) plus an Inbox visit equals the ideal path of 4. No hesitation points. The card says 'Syncing' until the first sync completes, so the 'is 42 everything?' doubt does not arise. Sync count, answer and to-do show data of different freshness, which the plan handles by the 'still syncing' literal reason.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-GS-1-01 | fixed | Citation chips measure 149x32 px in agent-answer and citation states (live probe). |
| F2-GS-1-02 | fixed | g-m-api-key-empty.png: link on its own line at 390 px with its arrow intact. The 1280 px wrappedControls flag is a false positive (one line in g-d-api-key-empty.png). |
| F2-GS-1-03 | fixed | Plan Reading: 'Still syncing' is returned as a literal reason while the first sync has no syncedThrough, and the skill relays it. |

## New findings (round 3)

None.
