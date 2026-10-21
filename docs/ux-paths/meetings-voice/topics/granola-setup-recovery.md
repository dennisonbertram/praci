# Granola first-time setup, error and recovery (stories GS-1 to GS-8)

Covers discovery topics 1 and 3. Source plans: `docs/plans/granola.md` (epic #444). Slice issues known: S1 #437, S2 #438, S3 #439, S4 #440. S5, S6 and S7 have no issue numbers in the plan, so they are written as slice names. No mockup existed when this was written. Existing labels come from `apps/web/src/components/integrations/McpDetail.tsx`: "Reconnect", "Disconnect sign-in", "Create agent", "Creating agent", "Rename", "Used by", "Remove {name}", "Your data in {name} is not deleted." Planned labels come from granola.md "Surfaces": field "Granola API key", button "Connect", status "Synced {n} meetings, {relative time}", error "Granola rejected this key", action "Disconnect".

All people, companies and meetings below are invented.

## STORY-GS-1: Founder pastes a key and gets a first answer
**Type**: long
**Topic**: Granola first-time setup (API-key sync)
**Persona**: Maya Okafor, founder of Fernhill Labs (example.com), Granola Business plan, never connected Granola to Rakazo.
**Goal**: Have her meetings available to a Rakazo agent and see what she promised in them.
**Preconditions**: Rakazo signed in; AI data sharing consent given; mail connected with triage on; Granola desktop app shows a personal API key she has already created (Settings, Connectors, API keys).
**Ideal path**: 4. Paste key, press Connect, ask the agent, open Inbox. The sync and the to-do should need no further input.
**Alternate paths**: Connect the MCP tile instead [exists]: sign in with Granola OAuth, then ask the Granola agent. It answers only through live MCP calls, with no stored meetings and no Inbox to-dos.
**Plan status**: Integrations page [exists]; Granola tile detail [exists]; key card [planned: Granola S6]; `meetings.connect` validation [planned: Granola S6]; 90-day backfill [planned: Granola S3 #439]; agent created on connect [planned: Granola S6]; `meetings_*` tools [planned: Granola S4 #440]; digest and Inbox to-do [planned: Granola S5].
### Steps
1. Maya opens Integrations from the sidebar and sees the Granola tile → tile is listed with the AppLogo letter fallback (no brand mark exists). [exists]
2. She clicks the Granola tile → detail page opens. She expects to see a key field. The plan says only "shown on the Granola tile's detail". GAP: granola.md Surfaces does not say whether the card is visible before the MCP tile is connected; discovery assumed it is.
3. She finds the field "Granola API key", pastes the key and presses "Connect" → [planned: Granola S6] the app checks the key with one list call. No loading text is defined. GAP: granola.md Surfaces gives no "checking" state, so a slow check looks like a dead button.
4. The key is valid → status reads "Synced 0 meetings, just now" or similar. GAP: granola.md Surfaces defines only "Synced {n} meetings, {relative time}", with nothing for "first sync running" or "0 meetings so far"; the 90-day backfill runs in batches across several jobs.
5. Behind the card, the Granola agent is created once (spawn key `integration-agent:<connectionId>`), private to Maya, writes off. [planned: Granola S6] Nothing on the card says the agent now exists. GAP: granola.md "Agent provisioning" does not say how Maya is told or sent to it. After MCP connect today, `McpDetail` shows `IntegrationAgentSection` with an agent link [exists]; the plan does not say the card shows the same link for the key connection.
6. About a minute later she reopens the Granola detail → status now reads "Synced 41 meetings, 2 minutes ago". Maya cannot tell whether 41 is "everything" or "a first batch".
7. She opens the Granola agent from the bot list and types "What did I promise Dana in the pricing review?" → [planned: Granola S4] the agent calls `meetings_search`, then `meetings_get`, and answers with "Pricing review, 12 Oct" cited by title and date.
8. She asks a follow-up, "Who else was on that call?" → the agent answers from the stored attendees. If the answer is wrong she has no way to see the stored meeting; there is no meetings screen by design.
9. Several minutes later she opens Inbox from the sidebar → the "To do" card on the Important pile now shows "Send Dana the revised pricing" with "From: Pricing review, 12 Oct". [planned: Granola S5] Today the card shows only when `triage && pile === "important"` [exists, `Inbox.tsx:548`], which is true for Maya because she has mail.
10. She marks the to-do done → it moves to done. For a mail user this works as today. [exists for mail; planned: Granola S5 for meeting to-dos]
### Variations
- Maya has AI data sharing off: the card connects and syncs, but the digest does not run and `meetings_*` tools are withheld. The plan says "silent". She sees "Synced 41 meetings" and an agent that answers from nothing. GAP: granola.md "Digest and Inbox follow-ups" and the open consent question define no prompt on the card.
- Maya uses mobile: Settings, Integrations has a field and status row with native controls. [planned: Granola S6]
- Maya asks within the first minute: the agent calls `meetings_search`, sees nothing synced, falls back to MCP tools if the MCP tile is connected; if not, it says "no synced meetings". GAP: the wording the user sees is not defined.
### Edge Cases
- The key is pasted with surrounding spaces or a line break. The plan does not say whether it is trimmed.
- Maya presses "Connect" twice. The plan requires one agent and one connection ("connecting twice yields one agent").
- The first agent answer arrives before the backfill finishes, so a meeting from 80 days ago is "not found". She concludes Granola data is missing.
- Same fact on several surfaces: sync count on the card, the agent's answer, and the Inbox to-do each reflect meeting data with different freshness.

## STORY-GS-2: Invalid key on a Business plan
**Type**: short
**Topic**: Granola first-time setup, error
**Persona**: Tomas Reyes, founder of Brightwell Robotics (example.org), Business plan; copies the key from a Slack message and pastes a truncated copy.
**Goal**: Connect Granola with a working key.
**Preconditions**: As GS-1, step 3; the pasted key is cut off by one character.
**Ideal path**: 3. Paste, Connect, see exactly what is wrong and retry in the same field.
**Alternate paths**: Create the key again in Granola and paste it; or use the MCP tile.
**Plan status**: error line [planned: Granola S6]; nothing stored, no connection, no agent [planned: Granola S6].
### Steps
1. Tomas opens Integrations, Granola, and pastes the truncated key into "Granola API key" → field shows the text. Whether it is masked is not stated. GAP: granola.md Surfaces gives no masking rule.
2. He presses "Connect" → [planned: Granola S6] Granola rejects the key (401).
3. The card shows "Granola rejected this key" → nothing is stored, no connection row, no agent. [planned: Granola S6]
4. Tomas does not know why. The text does not say whether the key is mistyped, expired, wrong scope, or on a plan without API access. GAP: granola.md Surfaces fixes a single line for every rejection.
5. He checks the Granola app, sees the key looks different, copies the full key, replaces the field and presses "Connect" → success path from GS-1 step 4. The old error line clears. GAP: the plan does not say when the error line clears (on typing or on the next Connect).
### Variations
- A workspace key (admin-made) is pasted instead of a personal key: it is valid but cannot read private notes. Tomas sees "Synced 12 meetings" and the agent says it cannot find his own private notes. The plan does not tell him why.
- Enterprise member scopes are off: Granola rejects the key. Tomas sees the same line as a typo.
### Edge Cases
- Granola is down (5xx or network failure). The plan defines only rejection. GAP: no text for "could not reach Granola"; Tomas may read a failure as a rejected key.
- Rate limit (429) while validating: back off, nothing visible.

## STORY-GS-3: MCP tile first, then the key (two Granola agents)
**Type**: long
**Topic**: Granola setup, agent provisioning
**Persona**: Priya Natarajan, head of ops at Lakeside Freight (example.net), Granola Business.
**Goal**: Keep her existing Granola agent and add stored meetings.
**Preconditions**: Granola MCP tile connected three weeks ago; its private agent "Granola agent" exists and has answered questions. Priya now has a Business API key.
**Ideal path**: 3. Paste key, Connect, keep asking the same agent. One agent should serve both sources.
**Alternate paths**: Remove the MCP tile and start over (loses the existing agent's thread history context); keep only the MCP tile.
**Plan status**: MCP tile and agent [exists]; key card [planned: Granola S6]; second agent [planned: Granola S6, plan says "two Granola agents ... unless `isIntegrationAgentForServer` lets one bot serve both"]; shared `meetings_*` tools on both [planned: Granola S4].
### Steps
1. Priya opens Integrations, Granola → the detail shows "via MCP · mcp.granola.ai", `IntegrationAgentSection` and "Reconnect" if the sign-in expired. [exists] The key card appears too. [planned: Granola S6]
2. She pastes the key and presses "Connect" → connection `granola-api` is created and its own agent is created. [planned: Granola S6]
3. She opens the bot list → two agents are listed, each with an account label. GAP: granola.md "Agent provisioning" and Open questions say the Agents list shows "each with its account label" but give no label text. She does not know which to ask.
4. Priya asks the old agent "What did we decide about the Q4 route changes?" → the old agent now also reads synced meetings ("both are meeting-source agents with the same meetings tools"). It answers from stored data with citations.
5. She asks the new agent the same question → same answer. The two agents are interchangeable for her. She wonders why there are two.
6. Priya tries to delete the extra one → the bot delete path [exists] works, but the plan says "Create agent" repairs it; she may delete the wrong one. See GS-6.
### Variations
- If S6 finds one bot can serve both connections, it links instead of creating a second. The plan does not depend on that, so both outcomes must be written; this story shows the two-agent case.
- Reverse order (key first, then MCP tile): the tile gets its own agent as today. Same two-agent outcome.
### Edge Cases
- Another agent asking via `message_bot` ("Granola agent") finds two bots with the same name and picks one by directory text. The plan does not say how names are disambiguated.
- The MCP session expires: the old agent still answers from stored meetings but says live MCP fallback failed. The user may think Granola is down overall.
- The same meeting appears in both sources only if both were synced. The plan stores meetings from the key connection only for the stored table; MCP gives live results. Citations could differ in format between the two paths.

## STORY-GS-4: Free or Pro user pastes a key, is rejected, falls back to MCP
**Type**: medium
**Topic**: Non-Business Granola paths
**Persona**: Jonas Weber, solo founder of Quillpoint (example.com), Granola free plan, last 30 days of notes only.
**Goal**: Ask Rakazo about recent Granola meetings.
**Preconditions**: Jonas has no API key option in his Granola app because the free plan has no API access.
**Ideal path**: 2. See that the key path needs Business, then connect through the MCP tile and ask the agent.
**Alternate paths**: MCP tile directly [exists]; skip Granola.
**Plan status**: key card shows to all users [planned: Granola S6, "Free plan: the card explains nothing"]; MCP tile [exists]; MCP agent [exists].
### Steps
1. Jonas opens Integrations, Granola. The page shows the key card and the existing MCP controls. [planned: Granola S6] He assumes the key card is required.
2. He looks for a key in Granola's app → there is no Connectors, API keys entry for the free plan. He pastes a random token or an old OpenAI key by mistake into "Granola API key".
3. He presses "Connect" → "Granola rejected this key". [planned: Granola S6]
4. He is stuck. The card says nothing about plans. GAP: granola.md Surfaces says the card "explains nothing" for the free plan; the user cannot tell the key path is not for him.
5. He notices the detail also offers the MCP sign-in. He presses the existing MCP connect control → browser OAuth with Granola opens. [exists]
6. After sign-in, the MCP tile is connected and the Granola agent is created. [exists]
7. He asks the agent "What did I discuss yesterday?" → live MCP tools return recent notes. On free plan, folder, search and transcript tools are paid-only, so some questions fail. [exists]
8. He asks "What did I promise last week?" → the agent answers from MCP only. No Inbox to-do is created. GAP: the plan never tells a free user that to-dos need the key path.
### Variations
- Pro (non-Business) user: same as free; Pro is not named in the plan's tier table beyond "Business or Enterprise for the API key". Rejection looks the same.
- Jonas upgrades to Business later, creates a key and pastes it: becomes GS-3 (two agents).
### Edge Cases
- The key card is placed above the MCP section, so Jonas never reaches the MCP control. Page order is not specified (discovery ambiguity 6/7).
- A free user who sees the key field and does not own a key gives up at step 4.
- Two visible ways to connect Granola on one page, with no stated difference. Redundancy point.

## STORY-GS-5: The key stops working (needs_reconnect)
**Type**: medium
**Topic**: Granola error and recovery
**Persona**: Amara Singh, COO of Harbor Street Studio (example.org), Business plan; she regenerates her Granola API key during a security review.
**Goal**: Get her meetings syncing again.
**Preconditions**: Connected and syncing; Granola key revoked; the next 5-minute sync gets 401.
**Ideal path**: 3. Open the Granola page, paste the new key, Connect.
**Alternate paths**: Disconnect, then connect again; MCP tile as a stopgap.
**Plan status**: `needs_reconnect` on 401/403 with one line on the card and no retries until a new key is pasted [planned: Granola S3 #439, S6].
### Steps
1. Amara asks the Granola agent about a meeting held today → it answers from stored meetings up to the last good sync, with nothing marking the data as stale. GAP: the plan does not tell the agent or the user that sync has stopped.
2. She notices today's meeting is missing and opens Integrations, Granola. The card shows a one-line state. GAP: granola.md Sync says "one line on the card" but gives no text; only "Granola rejected this key" has copy, and it may or may not be reused for a revoked key.
3. She looks for "Reconnect". The existing MCP detail has a "Reconnect" button [exists, McpDetail.tsx:203]. GAP: the plan does not say whether the key card shows a similar action, whether "Connect" and "Disconnect" are both visible, or whether a key can be replaced without disconnecting (discovery ambiguity 6).
4. She pastes the new key and presses "Connect" → [planned: Granola S6] the key validates, status returns to connected. The plan assumes this works ("until the user pastes a new key"); it does not state that the same connection and agent are reused.
5. The next sync runs → status reads "Synced 58 meetings, just now". Meetings edited in the gap are caught by `updated_after` with overlap. [planned: Granola S3]
6. Amara asks the same question → the agent now cites today's meeting.
### Variations
- Mobile: Settings, Integrations row shows the state; she pastes into the native field. [planned: Granola S6]
- Amara ignores the line for a month. Backfill covers only the 90-day window from the original start; if the checkpoint is older than the window, meetings in between may be missed. GAP: granola.md Sync does not state what a long gap does.
### Edge Cases
- The new key belongs to a different Granola account. The plan keys sync state to the connection; meetings from the old account remain, mixed with the new one. The plan does not define this case.
- 403 because Enterprise disabled member scopes: same line as a revoked key.
- She pastes the old key again; she is told "Granola rejected this key" and nothing changes, which is correct.
- No in-app notification: she finds out only by noticing missing data. The plan defines no push or Inbox message for `needs_reconnect`.

## STORY-GS-6: The agent is removed and recreated
**Type**: medium
**Topic**: Agent provisioning repair
**Persona**: Leila Haddad, ops lead at Cobalt Grove (example.net), cleaning up her bot list.
**Goal**: Remove an unused bot, then realise she needs the Granola agent back.
**Preconditions**: Granola key connected and syncing; Granola agent exists; MCP tile may or may not be connected (two variations).
**Ideal path**: 2. Open the Granola page, press "Create agent".
**Alternate paths**: Disconnect and reconnect the key (recreates the agent but also re-validates the key).
**Plan status**: removing an agent keeps sync [planned: Granola S3/S6]; "Create agent" repair [exists for MCP at McpDetail.tsx:221; planned for the key connection]; idempotent creation [planned: Granola S6].
### Steps
1. Leila deletes the "Granola agent" from the bot list, believing it only held old chats → bot is removed. [exists] Sync continues. [planned: Granola S3]
2. A week later she asks a teammate bot about a meeting via `message_bot` → no meeting-source agent exists, so nothing answers. GAP: granola.md Agent provisioning says "meetings reach no one until one exists" and defines no message to the user or caller.
3. She remembers Granola and opens Integrations, Granola. The card still shows "Synced 60 meetings, 4 minutes ago". The sync status says everything is fine. [planned: Granola S6]
4. She looks for the agent. For the MCP connection the detail would show "Create agent" because `hasAgent` is false [exists]. For the key connection, GAP: granola.md names "Create agent" as the repair but does not say where it appears on the key card or whether it shares the MCP button.
5. She presses "Create agent" → label changes to "Creating agent", then the app navigates to the new agent thread (`/app/{botId}`). [exists for MCP; planned for key connection]
6. She asks her question → the new agent answers from stored meetings. Nothing was lost because meetings never depended on the agent.
7. Inbox to-dos from the whole period are present, and she completes one. [planned: Granola S5]
### Variations
- Both agents existed and she removed the MCP-linked one: the key-connection agent still works with no action. She sees no problem.
- Both removed: she must press "Create agent" twice (once per connection) or choose one. GAP: not defined whether the page shows one button or two.
### Edge Cases
- She presses "Create agent" twice quickly: idempotent by spawn key, one bot.
- She removes the MCP server itself (`Remove Granola`). The existing note says "Your data in Granola is not deleted." The plan says the key connection and stored meetings are untouched. The sentence on that dialog could read as covering stored meetings; it was written for MCP only.
- The old agent's chat history is gone with the bot; the new agent starts empty.

## STORY-GS-7: Disconnect keeps the data
**Type**: medium
**Topic**: Granola disconnect and retention
**Persona**: Ethan Cole, founder of Redwood Mill (example.com), leaving Granola for another notetaker.
**Goal**: Stop Rakazo syncing from Granola but keep what he has.
**Preconditions**: Key connected; 200 meetings stored; 3 open Inbox to-dos from meetings.
**Ideal path**: 2. Open the page, press Disconnect, with a clear line saying what happens to stored data.
**Alternate paths**: Revoke the key in Granola (leads to GS-5 `needs_reconnect`, not a clean disconnect); remove the MCP tile (does not touch the key sync).
**Plan status**: Disconnect deletes the secret, stops sync, keeps the connection row as `disconnected`, keeps meetings and to-dos, "no confirm about data" [planned: Granola S6].
### Steps
1. Ethan opens Integrations, Granola and presses "Disconnect" → [planned: Granola S6] the secret is deleted and sync stops. No confirmation about data. GAP: granola.md S6 says "no confirm about data" and does not say whether any confirmation appears at all.
2. The card returns to a blank "Granola API key" field with "Connect". The status line is gone. GAP: granola.md does not say whether it shows "Disconnected" or whether the user is told the meetings remain.
3. He opens the Granola agent and asks "What did we agree with Dana?" → the agent still answers from stored meetings. Ethan expected disconnect to remove access. This is the mismatch: the existing app text "Your data in {name} is not deleted." [exists] refers to the vendor's data, while here Rakazo keeps its own copy.
4. He opens Inbox and completes a meeting to-do → works with no connected source. [planned: Granola S5]
5. He wants the meetings gone. GAP: granola.md has no deletion control (discovery ambiguity 21). The account export includes meetings (`meetings.json`) [planned: Granola S1], but there is no delete.
6. He pastes a new key later → connection becomes connected again; his stored meetings are still there plus new ones.
### Variations
- Ethan disconnects the key but keeps the MCP tile: the MCP agent still reads stored meetings and live data.
- Disconnect while a sync is running: the job loads the source, finds no secret, and stops with an error. The plan does not say whether a half-written batch is kept.
### Edge Cases
- Another user in the same space connected Granola: their meetings stay private and unaffected.
- The to-do text can name attendees who never agreed to AI processing. Disconnect does not purge it.
- Ethan is never told that the meetings are kept permanently (privacy policy decision in granola.md Decisions), so he may assume deletion.

## STORY-GS-8: Meeting-only user, no mail, first answer and first to-do
**Type**: medium
**Topic**: Granola first-time setup without a mail account
**Persona**: Sofia Marin, founder of Tidewater Print (example.org), uses Rakazo for chat and agents, never connected Gmail, Granola Business.
**Goal**: See her commitments from meetings in one place.
**Preconditions**: Key connected as in GS-1; AI consent on; no mail account; Inbox currently shows the "Connect mail" prompt.
**Ideal path**: 3. Connect key, ask agent, open Inbox and see the to-do.
**Alternate paths**: Ask the Granola agent for her commitments instead of using Inbox.
**Plan status**: meeting-only to-dos [planned: Granola S5]; today's Inbox empty state is "Connect mail" [exists].
### Steps
1. Sofia completes GS-1 steps 1 to 8 → works the same, since sync does not depend on mail.
2. She opens Inbox from the sidebar → today the page prompts her to connect mail. [exists] GAP: granola.md S5 says the list shows with no mail account, but the plan gives no pile, tab or entry point (discovery ambiguities 1, 2).
3. If the card appears, it shows "Send Dana the revised pricing" under "From: Pricing review, 12 Oct". She marks it done. [planned: Granola S5, `InboxTodo.connectionId` becomes nullable]
4. She expects to tap the to-do and open the meeting. Mail to-dos are not tappable today and the plan does not add that (discovery ambiguity 13).
### Variations
- She connects Granola before AI consent: no to-dos appear; nothing says why.
- Her Granola identity email does not match any attendee email: no to-dos, silently. [planned: Granola S5]
### Edge Cases
- Mobile Inbox fetches to-dos per `connectionId`; a meeting to-do has none.
- Connected source with no to-dos yet: empty-state text is not given.

## Journey failures and gaps
1. Key card has no loading state while "Connect" validates (granola.md Surfaces, S6). Severity: med.
2. No status for "first sync running", "0 meetings yet" or backfill progress; user cannot tell when the agent is ready (granola.md Surfaces, Sync). Severity: high.
3. A single error line "Granola rejected this key" for every cause, including free or Pro plan, typo, revoked key and Enterprise scope off (granola.md Surfaces, "Free plan"). Severity: high.
4. Free and Pro users see a key field they cannot use, with no pointer to the MCP sign-in on the same page (granola.md Surfaces; discovery ambiguity 7). Severity: high.
5. No text for network or Granola 5xx failures, which can read as a rejected key (granola.md Sync, discovery ambiguity 5). Severity: med.
6. `needs_reconnect` has no copy, no notification, and unclear controls (Connect, Disconnect, replace key); the agent keeps answering from stale data without saying so (granola.md Sync; ambiguity 6). Severity: high.
7. Two Granola agents appear with no stated names or labels; unclear which to ask, and `message_bot` may pick the wrong one (granola.md Agent provisioning; ambiguity 9). Severity: med.
8. After connecting the key, nothing links the user to the new agent (granola.md Agent provisioning, S6). Severity: med.
9. "Create agent" repair is defined for the key connection but not placed on the card; with two connections the page may need one or two buttons (granola.md Agent provisioning). Severity: med.
10. With the agent removed, sync status still says healthy and `message_bot` has no recipient and no message (granola.md Agent provisioning). Severity: med.
11. Disconnect keeps data with no on-screen statement, and there is no deletion control; the existing "Your data in {name} is not deleted." reads as the opposite (granola.md Surfaces, Security and tenancy; ambiguity 21). Severity: high.
12. New key from a different Granola account mixes two accounts' meetings under one connection (granola.md Sync). Severity: med.
13. Long outage beyond the 90-day window may leave a gap that is never backfilled (granola.md Sync). Severity: low.
14. Meeting-only user: Inbox entry point, pile and empty state are undefined, and today's page says "Connect mail" (granola.md S5; ambiguities 1 to 3). Severity: high.
15. Consent off gives silent no-digest and no tools; the card gives no prompt (granola.md Digest and Inbox follow-ups; ambiguity 12). Severity: med.
16. Early-answer case: "no synced meetings" wording is undefined when MCP is not connected (granola.md Reading). Severity: low.
17. Key trimming and masking behaviour are undefined for the "Granola API key" field (granola.md Surfaces). Severity: low.
