# GS-1: Founder pastes a Granola key and gets a first answer

Critic session: uxf-gs1. Evidence: story STORY-GS-1 and STORY-GS-3 in `docs/ux-paths/meetings-voice/catalog.md`, `docs/plans/granola.md`, and the mockup `docs/granola/mockup.html`, opened in a browser. Nothing is built, so every step count is "as planned". Labels: **measured** (read from the plan, mockup DOM or screenshot) and **suspected** (my inference, not observed).

Screenshots (all opened and viewed) are in `docs/ux-flow/meetings-voice/journeys/GS-1-screens/`:
`1-tile.png`, `2-detail.png`, `3-key-verifying.png`, `3-key-connected.png`, `3-key-rejected.png`, `3-key-limited.png`, `4-agent.png`, `5-inbox-todos.png`, `6-citation.png`. In `4-agent.png`, `5-inbox-todos.png` and `6-citation.png` the mockup page shows several screens stacked; the screen named in the file is the one in the middle.

## 1. Friction scorecard

| Measure | Planned (measured, from catalog steps 1-10 and plan Surfaces) | Ideal |
|---|---|---|
| Actions from "I have a key" to first answer | 7: open Integrations, click Granola tile, paste, Connect, reopen detail to see whether sync finished (step 6), find the Granola agent in the bot list, type the question | 3: paste, Connect, ask (in the agent chat that Connect opens) |
| Actions to the Inbox to-do | 8 (adds opening Inbox) | 4 with the Ideal path in the catalog: paste, Connect, ask, open Inbox |
| Screens visited | 4 (Integrations list, Granola detail, agent chat, Inbox) plus a re-visit of the detail page | 2 to first answer (detail, chat) |
| Decisions the user makes | Which of two Granola routes ("Live questions" vs "Sync"); which agent to ask if two exist (GS-3); whether 41 meetings is complete | 0 beyond pasting the key |
| Defaults that could carry decisions | The key route is the only one a Business user needs; the agent is created automatically already (plan, Agent provisioning) | Route choice and agent choice should be removed |
| Re-entry | Maya re-opens the detail page to see sync progress (catalog step 6). Suspected: she may also paste the key twice if "Connecting..." feels stuck | none |
| Confirmations | None on connect. Disconnect has no confirm (plan S6), which is correct because data is kept | no change |
| Dead ends | Connected card ends with "Synced 42 meetings, 3 minutes ago" and "Disconnect" only (`3-key-connected.png`): no link to the agent, no next step. Citation opens a popover with one external link; to-do "From:" line is plain text (mockup comment, `5-inbox-todos.png`) | Connected state should lead to the agent |
| Hesitation points | (a) Two sections with two unlike controls on one page (`2-detail.png`): "Signed in with Granola / Connected / Disconnect" above an empty key field; a user who is already connected via MCP may think they are done. (b) "Synced 42 meetings" with no sign of whether the backfill is finished. (c) Asking before sync ends gives an undefined message (catalog GS-1 variation) | none |

Where the extra steps come from (measured): steps 5 and 6 of the catalog, "Nothing on the card says the agent now exists" and "Maya cannot tell whether 41 is everything". Both are caused by the card not connecting to the agent and the count not saying whether sync is finished.

## 2. Take-away pass per screen

**Integrations tile (`1-tile.png`)**
- Remove the two-row structure "Live questions / Connected" plus "Sync / Business plan / Add key". The tile now has three rows of text and a button for one product. A user with no MCP connection sees only "Add key" for a Business-only feature (measured: mockup comment on the tile). Show one state line per tile: the route that is connected, or "Connect".
- "Business plan" on the tile is shown to every user, including Business users who do not need it. It is a gate message shown before the failure. Suspected: removing it costs little, because the rejected-key line already handles Free users; keep it only if the free-plan fallback (GS-4) turns out common.
- One primary action: "Add key" is the only button; fine.

**Granola detail page (`2-detail.png`)**
- Two stacked sections named "Live questions" and "Sync" are internal terms. "Sync" is a mechanism, not what the user wants. Suspected: a user wants "my meetings", not a route choice.
- "Signed in with Granola" and its green Connected badge sit above the key field and make the screen look finished. Collapse the MCP section to one line once the key is connected, or hide the key card behind "Add stored meetings" until the user asks.
- "Granola API key" label and the placeholder "Paste your API key" say the same thing twice. Keep the label, drop the placeholder, or the reverse (AGENTS.md: every visible word is UI).
- The disabled grey Connect button is visually weak next to the bright "Disconnect" red outline above it. The destructive action is louder than the primary one (measured, `2-detail.png`).
- Missing: a way to find the key. The plan names the path (Granola Settings, Connectors, API keys) only in the catalog preconditions. A one-line "Get a key in Granola Settings" link might be the one piece of copy worth adding. Mark as suspected: depends on whether Business users already know where it is.

**Key card states (`3-key-*.png`)**
- Connecting state: button reads "Connecting..." only; acceptable and minimal.
- Connected: "Synced 42 meetings, 3 minutes ago" plus "Disconnect". The relative time ("3 minutes ago") is the only changing fact and invites a question ("is it syncing right now?"). Replace the count with a state sentence: "Reading your meetings" while the backfill runs, then "Synced 42 meetings". The plan's wording "Synced {n} meetings, {relative time}" does not define the in-progress state (catalog GS-1 step 4 GAP).
- Rate limited (`3-key-limited.png`): the second line "Granola is busy. Retrying." is drawn in the mockup only so the review could delete it (mockup comment). Delete it. The plan already backs off silently. A message the user can do nothing about is noise. Measured.
- Rejected: red border, "Granola rejected this key", Connect. Good: one line, one action. The mockup note under the card ("Rejected state also appears for a key that worked earlier...") is a design comment and must not ship.
- Disconnect on the card is red-outlined, the loudest element on the connected card. It guards nothing destructive (data kept), so it could be a quiet text button.

**Agent chat (`4-agent.png`)**
- "Searched meetings" tool chip: this is the existing step display. Keep, it supports trust.
- Citation chips "Pricing review, 12 Oct" appear after both sentences. Two chips with the same label in one answer is the same fact twice (measured in screenshot). Citing once per meeting per answer is enough.
- The page has no first-question prompt. A user arriving from Connect sees an empty chat. Suspected friction, not measured.

**Inbox (`5-inbox-todos.png`)**
- To do card with three items. Good: one primary action per row (the checkbox).
- The "From: Pricing review, 12 Oct" detail line is plain text and not linked (mockup comment). This repeats the citation popover's content, and the popover (`6-citation.png`) shows only the title, date, attendees and one external link. That means the "From:" line cannot be checked from inside the app. It is acceptable for first release but is a dead end.
- Note under the card, "Tick a to-do to complete it. It strikes through, then fades out of the list.", is a design note. It must not ship.

**Citation popover (`6-citation.png`)**
- Contains title, "12 Oct · Dana Reyes, you", and "Open in Granola". The title repeats the chip text that opened it; the date repeats too. The only new facts are attendees and the link. Remove the title row or the date row; keep attendees and the link.
- Wispr Flow meetings have no known URL, so the popover will sometimes have no link (mockup comment). Then it contains only repeated facts: remove it for those and show nothing.

## 3. The simpler version

Ideal steps, tied to plan sections:

1. Open Integrations, click Granola (existing). One tile, one state line. **Plan: Surfaces; S6.**
2. Paste the key in the single field and press Connect (one list call validates it). **Plan: S6 behaviour.**
3. Connect succeeds and opens the Granola agent's chat with the cursor in the message box and the agent greeting "Reading your meetings. Ask me anything." The first question can be asked immediately; if sync is still running, the agent says so in plain words and answers from what it has (and from MCP if connected). **Plan: Agent provisioning and S4 skill fallback.**
4. The first to-do appears in Inbox on its own. A sidebar badge on Inbox, not a notification, shows it. **Plan: S5.**

Concrete plan changes:
- **Plan "Surfaces" and S6**: after the key connects, route to the agent chat instead of staying on the card. Cost: one navigation call. Removes catalog steps 5, 6 and the bot-list search (about 3 actions). Alternative if routing is too abrupt: a single "Ask Granola agent" button on the connected card. Either fixes the connected-card dead end.
- **Plan "Surfaces"**: define the in-progress state ("Reading your meetings") and the sync-complete state. Answers catalog GS-1 step 4 and step 6 GAPs.
- **Plan "Surfaces" / S6 copy list**: do not ship the rate-limited line "Granola is busy. Retrying." or the "Business plan" label on the tile. Keep the five plan strings only, plus one in-progress string.
- **Plan "Agent provisioning" and GS-3 variation**: for the two-agent case, make the one-agent option the default. Priya is a user who already has a Granola agent, then pastes a key. Two agents with the same tools and no distinguishing label (catalog GS-3 steps 3 to 5) is a decision with no value for her. Suggested default: if an MCP-linked Granola agent exists, attach the key connection to it (the plan's own open question: "If S6 finds `isIntegrationAgentForServer` lets one bot serve both, it links"). Only create a second agent when linking is impossible, and then name them by route only in the Agents list. This is the single largest simplification for GS-3. I did not measure whether linking is possible; the plan says it is unverified.
- **Plan "Digest and Inbox follow-ups"**: make the Inbox to-do "From:" line open the same citation popover as the chat chip, so it is one component. The plan states it is plain text; that leaves a dead end that a shared component removes.
- **Mockup, not plan**: delete the design notes under screens 2, 4 and 5 before the screens become stories.

## 4. Clarity issues

- "Live questions" and "Sync" are internal labels (placeholders the mockup author chose, per the PLAN-GAP comment). A founder would say "ask about meetings" and "keep my meetings". Measured: they appear only in the mockup, not the plan.
- "Synced 42 meetings" is ambiguous about completeness (catalog step 6). Suspected, not observed.
- "Connected" on the MCP row next to an empty key field suggests Granola is already working, so a user may not paste the key at all. Suspected.
- The GS-3 state of two agents named alike has no defined label text (catalog GS-3 step 3). Measured as a plan gap.
- Consent off: the card says "Synced 41 meetings" but the agent answers from nothing (catalog GS-1 variation). No message exists. Suggested minimal fix: the connect result is unchanged, but the first chat message from the agent says that AI data sharing is off. This is the one case where extra copy is justified, because without it the user sees a working card and a broken agent. Measured gap; the fix is my proposal.

## GS-3 variation (two Granola agents), summary

Planned: about 3 actions to connect (open detail, paste, Connect) and then a decision about which of two agents to ask, then possibly a delete (catalog GS-3 steps 3 to 6). Ideal: 3 actions and no agent choice. The simplification is the same one given above: reuse the existing Granola agent for the key connection. If the plan keeps two agents, label them by source in the Agents list and in the directory text that `message_bot` sees, so other agents do not pick one at random (catalog GS-3 edge case).

## Verdict

**acceptable.** Planned 7 actions to the first answer against an ideal of 3, and 8 to the Inbox to-do against 4. The extra steps are all after Connect: no route to the agent, no sync state. The tile and detail page also fail "once and only once" and "take-away" in a few places (two route sections, repeated chip text, design notes in the mockup). Nothing is structural, so it is not convoluted, but the connect-to-agent gap should be fixed in S6 before it is built.
