# STORY-GS-1: Founder pastes a key and gets a first answer (round 4)

**Result: PASS**

Walked: Granola mockup (integrations, api-key, agent, inbox) at 1280x900 dark, plus 390x844. Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Step 2: the MCP sign-in is the main block above the key card while neither route is connected (plan, Surfaces, Page order). Step 5: the agent link sits on the connected card. Step 9: the to-do detail is "Pricing review, 12 Oct" with no "From:" prefix.

## Steps

- Step 1: Integrations list, Granola tile (Not connected). (g-d-integrations-new.png)
- Step 2: Detail page: "Sign in with Granola" block, then the key card "Granola API key - Business plan", key link, empty field, dim Connect, consent sentence "Sends your meeting notes and transcripts to your AI model.". (g-d-integrations-detail.png)
- Step 3: Driven live on the api-key screen: Connect is disabled while empty, enables when a value is typed, then reads "Connecting…" (disabled). (g-d-api-key-empty.png, g-d-api-key-entering.png, g-d-api-key-verifying.png)
- Step 4: Live: after Connecting the card shows "Synced 42 meetings" with Disconnect (the Syncing shimmer state is drawn separately). (g-d-api-key-syncing.png, g-d-api-key-connected.png)
- Step 5: "Granola agent" link under the status line; the sidebar gains the Granola agent; chat does not open. (g-d-api-key-connected.png)
- Step 6: Same connected card; no separate surface needed. (g-d-api-key-connected.png)
- Step 7-8: Agent chat: question, "Searched meetings" chip, answer with one citation chip. (g-d-agent-answer.png)
- Step 9-10: Inbox, meeting-only: To do card above "Connect Gmail..." with three items shown as title plus "Pricing review, 12 Oct". Ticking a row removes it (live). (g-d-inbox-todos.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-api-key-empty.png: one column, link on its own line, no horizontal overflow.

## Flow Log

Actual 4 actions (open tile, paste, Connect, ask) plus an Inbox visit equals the ideal path of 4. No hesitation. The consent act sits under the button, so there is no separate consent step.

## Round-3 findings

The round-3 findings file for this story had no findings.

## New findings (round 4)

None.
