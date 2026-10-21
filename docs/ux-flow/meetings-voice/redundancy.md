# Redundancy and information architecture: meetings and voice

Critic: redundancy and IA, using `simplification-heuristics.md` items 12 to 16. Nothing here is built. Evidence is the catalog's Redundancy Candidates and Alternate paths fields, `docs/plans/granola.md`, `docs/plans/wispr-flow.md`, and the two mockups.

Screenshots are in `redundancy-screens/`. Each mockup is one long page, so every per-screen file in a mockup shows the same full page; I opened `granola-integrations.png` and `wispr-settings-voice.png` and did not re-read the identical copies. Findings cite the numbered mockup panels (for example "Granola panel 1").

Counts: Duplicate paths 5, Duplicate information 4, Overlapping features 5, Hierarchy and IA 5.

## 1. Duplicate paths

**D1. Granola MCP sign-in and the API key on one page.** Both connect "Granola". The key gives stored meetings and Inbox to-dos; MCP gives only live answers. Granola panel 1 shows the tile with "Live questions" and "Sync" groups; those are system words, and the plan has no such labels. Recommendation: keep both, but mark the key canonical. Reason to keep MCP: it is the only route on the free plan and on a phone (plan, "Free plan"; GS-4). Reason for the key being canonical: the plan says MCP cannot back stored data, search or to-dos. Show one Granola status. Drop the two group labels and describe the key row by what it gives ("Sync meetings"), shown only when MCP is already connected or the plan is Business. The `meetings_*` tools should answer first and MCP be the fallback only when no key exists.

**D2. Two Granola agents once both routes are connected (GS-3, MX-1).** Both read the same stored meetings with the same tools, so the user sees two bots for one app. The plan makes sharing conditional on `isIntegrationAgentForServer`. Recommendation: merge. Make "one Granola agent per user" a requirement of S6: link the key connection to the existing MCP agent instead of creating a second one. Agent-per-connection can still apply to unrelated connections.

**D3. Three things users call "voice".** Call Elio (a call), Settings, Voice (speech provider and, later, transcription), and Flow's own hotkey or keyboard (outside Rakazo). WF-4 shows someone opening provider setup when they wanted dictation. Recommendation: keep all three, mark Call Elio as the only "Voice" feature. The Settings screen keeps its name, but the new row should say "Speech to text", not "Transcription" or "dictation" (the plan uses all three words). Add no Rakazo copy about Flow's hotkey (the plan agrees).

**D4. Two API key fields on mobile Voice (MB-5).** A provider key and a transcription key. Wispr panel 5 shows a "Transcription" row above the provider list. Recommendation: merge. Flow is one more row in the existing provider list labeled "Transcribe only", with its key in the same pane the other providers use. The "Transcription" picker then only appears when more than one provider can transcribe, and its default stays "Use my voice provider". This also fixes the missing label for Flow (catalog Overlap 3).

**D5. Two to-dos for one promise (MB-4, MX-8).** The same commitment can come from a meeting and a later email, or from Granola and Flow. Recommendation: keep both sources, mark one canonical per promise. The plan's dedupe key `(userId, meetingId, normalized text)` covers only one meeting. For two providers recording one calendar event, use the calendar event id and keep one row. A mail to-do that repeats a meeting to-do should link to it, not add a second row.

## 2. Duplicate information across surfaces

**I1. "What I owe" in four places (IF-1, MX-3).** The Inbox To do card, the agent answer, the stored digest and S7 memory entries. Only the Inbox card has a checkbox. Recommendation: mark the Inbox To do card canonical and remove S7 from this epic (see O5). The agent answer stays, because it answers a question; the digest is internal and is not a surface.

**I2. Sync health in three places (GS-1, GS-5).** The card status, the agent answer freshness and the existence of to-dos. After `needs_reconnect`, the agent keeps answering with no sign the data is old. Recommendation: mark the card canonical for health, and have the agent say "last synced {date}" only when sync is failing (reuses the card's data, adds no new screen).

**I3. Consent state in four places (IF-5).** Settings, AI data sharing; an Inbox consent card; the Call Elio prompt; and, per Wispr panel 2, the new voice re-prompt drawn as a card on the Inbox page. A voice disclosure on the Inbox is the wrong place, and a meeting-only user sees none when consent is off. Recommendation: mark Settings, AI data sharing canonical and show the re-prompt where the action happens (starting Call Elio, or saving a transcription provider), not on the Inbox.

**I4. Two statements about whose data stays.** The existing MCP remove dialog says "Your data in {name} is not deleted." The key's Disconnect is silent and keeps meetings permanently (GS-7). Recommendation: one rule, one wording. If permanent retention stays, reuse the existing sentence on Disconnect; do not add a second sentence. Per `AGENTS.md`, the PR must still justify the copy.

## 3. Overlapping features

**O1. Granola MCP tools versus `meetings_*`.** Same question answered from two sources with different citation formats (GS-3). Recommendation: mark `meetings_*` canonical when a key exists; MCP only fills in when the store is empty, and the answer cites in the stored format either way.

**O2. Granola versus Flow meetings.** Wispr panel 4 shows a Wispr Flow agent and a Granola agent side by side, and each "sees all of the user's meetings" (plan, Reading). Asking either gives the same answer. Recommendation: make this a decision before S5. Cheapest: each agent answers from its own provider by default, and `provider` is a filter only when the user asks across vendors. The alternative is one meetings agent, which breaks agent-per-connection, so do not do it unless the maintainer wants it. Either way, name the tile subtitle by vendor; both currently say "Meeting notes" (Granola panel 1, Wispr panel 4).

**O3. Flow MCP tools versus `meetings_*` for Flow meetings (MX-6).** Same overlap as O1, with a tighter Flow allowlist. Recommendation: same rule as O1. Do not ship S5 stored Flow meetings unless Flow API step 0 pins real tool names; until then the existing tile and agent are enough.

**O4. Providers that already transcribe versus a new transcription row.** ElevenLabs, OpenAI and Fish Audio say "Speak + transcribe" (Wispr panel 1). A second control that chooses among the same providers duplicates them. Recommendation: merge into D4. Also, native Web Speech or iOS recognition versus recorder upload (WF-6, MB-6): keep both, but only one routing rule. A server provider the user chose wins on every surface, and the Voice screen says so once. The mockup's "This device: On" toggle on mobile (Wispr panel 5) would otherwise silently override the Flow choice.

**O5. Weekly memory routine (S7) versus the digest and `remember`.** The routine writes up to five memory entries a week from digests that are already stored and searchable, while the user can also say "remember this" in other agents (MX-3, MX-4). Granola panel 7 shows a routine whose output is a bullet list of facts already in the digest. The plan also contradicts itself on "remember this" (JF-8). Recommendation: remove S7 and the "remember a decision" sentence in the user story. Memory is a third copy of the digest and adds a place to edit, delete and turn off (catalog GAP). Revisit only if agents that do not use `message_bot` need meeting facts.

## 4. Hierarchy and IA

**H1. One concept, one name: transcription.** The plans use "transcription", "dictation", "speech recognition" and "voice" for overlapping things. Recommendation: pick "Voice" for calls with Elio, "Speech to text" for the provider row, and avoid "dictation" in product copy. The Settings and mobile screens keep their current "Voice" title.

**H2. Meeting to-dos live on a mail page.** The To do card sits under Inbox, whose empty state today says "No mail connected" and takes the whole page (catalog contradiction 3). Granola panel 4 draws a mail-free Inbox. Recommendation: keep to-dos in Inbox (the plan adds no page and Inbox is where users look), but the Inbox needs one layout for the zero-account case, with "Connect mail" below the To do card. This is a decision for S5, not a new surface.

**H3. Meetings have no home.** Stored meetings are reachable only through an agent chat, citations are plain text (Granola panel 5), and sync state is on the Integrations detail page. This matches the plan's "no meetings page" and keeps the product small. Recommendation: keep it, and make sure the Granola agent is listed under the same name as the tile so users can find it from Integrations (Granola panel 1 shows "Granola agent" in the sidebar already).

**H4. Mobile key card has no home (GS-4, JF-3).** Mobile Integrations builds tiles from the server catalog and has no Granola tile. Granola panel 8 invents a "Signed in with Granola" group that mobile cannot show. Recommendation: remove the MCP group from the mobile mockup and either declare the key card web-only for now or enter the key from the agent's detail. Do not add a second set of controls on mobile.

**H5. Flow tile appears next to Granola with the same subtitle and two to-do sources, but no shared "meetings" level.** Both tiles say "Meeting notes", and nothing tells the user that the two feed one store. Recommendation: no new surface. Keep each tile as is, and name the shared tool in agent answers only when both providers returned a result.
