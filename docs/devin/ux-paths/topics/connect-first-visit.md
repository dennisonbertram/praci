# Topic: Connect and first visit

Evidence: [exists] = read in code. [planned] = shown in `docs/devin/mockup.html` or described in `docs/devin/ux-paths/discovery.md`. Rakazo is read-only toward Devin: no launch, reply or stop in any story. Data is invented (org acme, repos acme/web, acme/api, acme/mobile).

## STORY-101: Connect Devin from the Integrations tile
**Type**: medium
**Topic**: Connect and first visit
**Persona**: Priya, a founder whose engineers use Devin through Slack and Linear. She has a service-user key.
**Goal**: Connect Devin to Rakazo so she can see what Devin is working on.
**Preconditions**: Signed in, a model configured, no Devin connection in this space, a valid org-scoped key starting with `cog_`.
**Ideal path**: 5 — Integrations, Devin tile, paste key, Connect, Done. The planned sidebar entry would make this 3 steps (see STORY-102).
**Alternate paths**: (a) Sidebar "Devin" link then "Connect Devin" button [planned] (STORY-102). (b) "Add a custom connection" with the URL `https://mcp.devin.ai/mcp` and a bearer token [exists]; reaches the same server but skips the Devin preset hint. (c) Search or command palette "Devin" [planned]. (d) Asking any bot to connect Devin: none found.
### Steps
1. Click "Integrations" in the sidebar [exists] → the catalog opens with app tiles. Priya is thinking "where is Devin?"; she scans or filters.
2. Find the Devin tile, subtitle "Coding sessions and repo docs" [exists], and click its "Connect" button (aria-label "Connect Devin") → the connection dialog opens. The tile has no logo, only a letter. She hesitates briefly: the letter tile looks less official than the others.
3. Read the dialog: title "Connect Devin", hint "An org-scoped Devin service-user key (starts with cog_)." and one field labelled "API key" [exists] → "Connect" is disabled while the field is empty. She hesitates here because she may not know where to create a service-user key. GAP: the hint says what the key is but not where to create it in Devin, and there is no link.
4. Paste the key and click "Connect" [exists] → the button shows "Connecting…" while the API lists Devin's tools to check the key, then creates the "Devin agent" bot (description "Your Devin account") with writes off [exists].
5. The dialog switches to the done view "Devin connected" with a "Done" button [exists]. The Carta equivalent adds the sentence "The Carta agent can now read your cap table."; Devin shows no such sentence. GAP: the done view does not say the Devin page now exists or link to it ("Open Devin" like Carta's "Open Cap table" is only proposed). She clicks "Done" and is back in the catalog wondering where to look. The Devin card now appears under "Connected".
### Variations
- Priya connects, then opens the connected Devin card: today it goes to `/app/integrations/mcp/<id>` (detail page) [exists], not to the Devin page.
- Planned: the connected card gets an "Open Devin" link [planned, discovery nav item 4]. GAP: no decision on whether "Done" should land on the Devin page automatically.
### Edge Cases
- Key with trailing spaces: the dialog trims it [exists].
- She pastes a Linear or GitHub token by mistake: handled as a rejected key (STORY-103).
- Information appears twice: the key description is on the tile hint and in the dialog; the "Connected" section repeats the status in a badge.

## STORY-102: First visit through the sidebar link, not connected
**Type**: short
**Topic**: Connect and first visit
**Persona**: Marcus, a CTO who heard from a teammate that Rakazo has a Devin page.
**Goal**: Reach the Devin page and connect from there.
**Preconditions**: No Devin connection. The planned `devin` entry is in the sidebar Pages group.
**Ideal path**: 3 — sidebar "Devin", "Connect Devin", key and Connect. It is shorter than going through Integrations (5).
**Alternate paths**: Integrations tile (STORY-101); command palette or search entry "Devin" [planned]; a Devin notification link [planned, can only exist after connecting]; mobile: none found.
### Steps
1. Click "Devin" in the sidebar Pages group, between Data room and Artifacts [planned] → the page opens at `/app/devin` with only the header "Devin" and one "Connect Devin" button (the "Not connected" frame in the mockup). He is thinking "what does this page do?".
2. Read the page → there is no sentence about what Devin shows once connected, no tiles and no table. GAP: the Not connected state is a bare button; a first-time user sees no preview of the value. This is deliberate under the minimal-copy rule, but the mockup does not say what a visitor who has never heard of the page should learn.
3. Click "Connect Devin" [planned] → the existing dialog opens with title "Connect Devin", hint "An org-scoped Devin service-user key (starts with cog_)." and the field "API key" [exists]. The same copy appears on this surface and in the Integrations dialog (one component, so no drift).
4. Paste the key, click "Connect" → "Connecting…", then the page itself loads (STORY-104). GAP: today the dialog ends on "Devin connected" and "Done"; whether it should close straight onto the page or still show that screen when opened from the page is undecided.
### Variations
- Marcus hides "Devin" from the Pages group with the group's "..." menu [exists for other pages], then cannot find it. GAP: no way back is described except the palette or Integrations.
- The sidebar link when not connected: GAP: discovery open question 13 (shown always, like Cap table, or hidden until connected) is undecided, and there is no dot while not connected.
### Edge Cases
- A teammate in the same space already connected: Marcus still sees Not connected, because connections are per user [exists in code]. GAP: nothing on the page says a colleague has connected, or that his own key is needed.
- Space switch: the page reloads with that space's connection state.

## STORY-103: Wrong or rejected key
**Type**: medium
**Topic**: Connect and first visit
**Persona**: Dana, an engineering manager who pastes a personal Devin token instead of the service-user key.
**Goal**: Recover from the error and connect with the right key.
**Preconditions**: Not connected. The dialog is open (from the tile or the page).
**Ideal path**: 4 — paste, Connect, read the error, replace the key and Connect again.
**Alternate paths**: Cancel and ask a teammate for the right key, then reopen from either entry; "Back" does not apply to the key-only form. No alternative to create the key inside Rakazo.
### Steps
1. Paste a wrong token and click "Connect" [exists] → the button reads "Connecting…". She expects an instant answer.
2. The API lists Devin's tools with the key; it fails, so the server and secret are removed [exists] and the dialog shows an inline error: "Could not connect to Devin. Check the API key and try again." → she knows it is the key, but not whether the key is wrong, expired, or lacks permission. GAP: one message covers a bad key, a key without session-read permission, a network failure and a Devin outage.
3. The field keeps its value (assumed from the form state; not verified) and she edits it, then clicks "Connect" again [exists] → success view as in STORY-101. Nothing was left behind by the failed attempt, so no stale card appears under "Connected".
4. Hesitation: after two failures she wonders whether Rakazo stored the bad key. GAP: the dialog does not say the key was not saved. The generic text "Credentials are encrypted and never sent to the model." exists on another view (the source form), not on this one.
### Variations
- Empty field: "Connect" stays disabled, no error [exists].
- Key valid for a different org than expected (acme vs another org): it connects without complaint. GAP: the dialog and page never show which org the key belongs to, so Dana cannot confirm it is acme.
- Key valid but read-only on sessions is unverified; connect may succeed and the page may then fail (STORY-107).
### Edge Cases
- Closing the dialog during "Connecting…": GAP, behavior not specified; the createdHere ref suggests cleanup but it was not verified.
- Network offline: the same error text as a rejected key.
- Error text is shown only inside the dialog; if opened from the Devin page, the page behind stays Not connected [planned].

## STORY-104: First load after connecting
**Type**: medium
**Topic**: Connect and first visit
**Persona**: Priya (from STORY-101), now on the Devin page for the first time.
**Goal**: See her acme sessions and trust the page is current.
**Preconditions**: Connected, agent created, acme has about 8 sessions in Devin.
**Ideal path**: 2 — open the page, read the table. No further action needed.
**Alternate paths**: Arrive from the sidebar link, the palette [planned], or a notification [planned]; "Ask" opens the agent instead of reading the table.
### Steps
1. Open the Devin page [planned] → loading state. GAP: the mockup has no loading skeleton; discovery says Legal uses `Skeleton`, but whether the four tiles and the table both skeleton is undecided. She is thinking "is it stuck?".
2. The page renders the header "Devin" with "Updated 1m ago", an external-link icon button "Open Devin" and an "Ask" button [planned] → the four tiles read Needs you 2, Working 2, PRs open 3, ACUs this week 41.6. "ACUs" is Devin jargon; she hesitates and wonders what it counts. GAP: no explanation of ACUs (discovery open question 12).
3. Read the table: columns Session, Status, Pull request, From, ACUs, Updated [planned]. Rows such as "Add CSV export for invoices" (Needs you, Slack, 3.4 ACUs, 12m ago) and "Upgrade Prisma to 6.x" (Needs you, acme/api#212 open, Linear). → she sees acme repos only through PR numbers. GAP: no repo column; repos can only be inferred from PR URLs.
4. The docked "Devin agent" panel: the mockup shows it open with a conversation; discovery open question 9 says default open or closed is undecided. GAP: first-visit state of the panel (open or closed, empty-thread intro, suggested questions) is not designed.
5. Click "Ask" [planned] → the panel opens or focuses.
### Variations
- Information duplicated: counts for Needs you appear in the tiles, in the status badges, in the row subtitles, in the sidebar dot ("2 need you") and later in notifications.
- Click "Open Devin" [planned] → leaves Rakazo. GAP: the destination (Devin home or org) is not defined (open question 8).
- Large org: more than 100 sessions. GAP: no paging or "showing 100" indicator.
### Edge Cases
- The page does not prove which org it shows. GAP (see STORY-103).
- Sessions started by colleagues in Slack or Linear appear without a person name; "From" shows the origin only.
- The page fetch must not use the blocking gather tool; slow Devin responses have no designed state.

## STORY-105: Connected but nothing to show (empty list)
**Type**: short
**Topic**: Connect and first visit
**Persona**: Tomas, a founder at a young startup who just got a Devin key and has run no sessions yet.
**Goal**: Understand that the connection works even though the table is empty.
**Preconditions**: Connected, zero Devin sessions in the org.
**Ideal path**: 1 — open the page and read an empty state that confirms the connection.
**Alternate paths**: Ask the Devin agent "What is Devin working on?" [planned] and read the answer; open Integrations and see the "Connected" badge [exists]. Both are indirect.
### Steps
1. Open the Devin page right after connecting [planned] → the tiles would read 0 and the table has no rows. Tomas thinks "did this break, or is there nothing?".
2. GAP: the mockup has no empty state. Needed: a one-line statement that no sessions exist, ideally revealing that he can start them in Devin (a link to Devin), without any launch control in Rakazo. Any added text needs the copy justification in the PR.
3. He clicks "Ask" and types a question; the agent answers from an empty search → the answer is the only confirmation the key works.
### Variations
- Sessions exist but all are older than the "this week" window: tiles show 0 for ACUs this week while the table lists rows. GAP: the window for "this week" is undefined (open question 6).
- Only Finished and Suspended sessions: Needs you 0 and Working 0; the page should still read as healthy. No design.
### Edge Cases
- Zero tiles next to a table of old rows can look like a bug; no copy explains the window.
- Org that has Devin but whose key cannot list sessions gives an error instead of an empty list (STORY-107).

## STORY-106: Returning later when the Devin agent is missing
**Type**: long
**Topic**: Connect and first visit
**Persona**: Hana, an operations lead who connected Devin two weeks ago and later cleaned up her bots.
**Goal**: Use the Devin page and agent again after archiving the "Devin agent" bot.
**Preconditions**: A connected Devin server whose `agentBotId` was cleared by archiving the bot. The session list can still be read.
**Ideal path**: 3 — open the page, click the repair button, continue.
**Alternate paths**: Disconnect and reconnect from Integrations (more steps, deletes the server); open the Integrations card and reconnect; call the connect flow again — `ensureIntegrationAgent` is idempotent and makes a fresh agent, but no UI exposes that call directly [exists in API].
### Steps
1. Hana opens the Devin page from the sidebar [planned]. The table loads normally from the server connection (assuming the page reads through its own endpoint; open question 2).
2. She clicks "Ask" [planned] → the agent is gone. Legal and Carta show a panel with a "Create agent" button and a "Try again" button (`Shell.tsx` ~3066-3100) [exists for them]. GAP: the Devin page has no equivalent designed state, and the mockup does not show one.
3. If she clicks a repair action [planned], `ensureIntegrationAgent` creates a new "Devin agent" bot with description "Your Devin account", links it with all tools allowed, makes the server exclusive to it and keeps writes off [exists]. → the panel works again.
4. She asks "What is Devin stuck on?" and gets the planned answer with "Open in Devin" links [planned].
5. If no model is configured, the panel shows "Add a model" instead of suggestions (`pageAgentNeedsModel`) [exists for other pages]. GAP: not drawn for Devin.
### Variations
- Archiving the agent in the middle of a repair: the link step locks the bot row and a second pass creates a fresh bot [exists in `ensureIntegrationAgent`], so the user sees a retry rather than a broken link.
- Hana is in a different space: her connection and agent differ there, so she sees Not connected (STORY-102).
### Edge Cases
- Archived agent while the page keeps showing session data: the page and panel disagree about connection state.
- A duplicate "Devin agent" appears in bot lists if a repair runs twice; the spawn key `integration-agent:<serverId>` is intended to prevent it, but this was not verified.
- Writes stay off for the new agent; forced-write tools still show a card on every call. In scope only as a reminder: Rakazo never launches or replies.

## STORY-107: Key revoked after connecting
**Type**: long
**Topic**: Connect and first visit
**Persona**: Leo, a developer who rotated the Devin service-user key last week; the stored key now fails.
**Goal**: Notice the connection is broken and restore it.
**Preconditions**: A connected Devin server whose key no longer works.
**Ideal path**: 3 — open the page, read the error, click reconnect, paste the new key.
**Alternate paths**: Integrations tile "Reconnect" button [exists for cards in a reconnect state]; delete and re-add the connection; the detail page `/app/integrations/mcp/<id>` [exists]. There are several paths for one repair, a redundancy signal.
### Steps
1. Leo clicks "Devin" in the sidebar [planned]. He expects the table; he sees a failure instead.
2. GAP: the page has no designed error state for a failed fetch or a revoked key. Discovery proposes the `ErrorNotice` pattern with stale rows kept visible, but nothing says what the message or action is. The "Updated Nm ago" label would show an old time with no explanation.
3. He goes to Integrations. The Devin card shows a status badge (connected, reconnect or failed) and a "Reconnect" action [exists] → he clicks it. GAP: for an API-key connection, whether "Reconnect" opens the key dialog (no browser sign-in exists for Devin) is not shown in the code read for this topic.
4. He pastes the new key and clicks "Connect" → the same check as STORY-101; success restores the page.
5. Back on the Devin page the table is current again and "Updated 1m ago" resets [planned].
### Variations
- Key still valid but without session-read permission: the connect-time check lists tools and passes; the first session search then fails. Unverified; maps to the same GAP as step 2.
- Revoked while the page is open: GAP, refresh behavior not specified.
- Sidebar dot for needs-you stays stale during the outage. GAP: no signal that notifications have stopped.
### Edge Cases
- Several members connected with the same key: when one revokes it, all pages break at once.
- The Integrations badge, the page error and an eventual notification are three surfaces describing the same problem with no shared wording.
