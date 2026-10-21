# Discovery: Granola meetings and Wispr Flow voice (planned features)

Scope: two plans that are not built yet: `docs/plans/granola.md` (epic #444) and `docs/plans/wispr-flow.md` (epic #452). Both plans cite `origin/main` at b78a1c5b. Existing-code references were re-read in this worktree on 2026-10-20. Items marked "Assumption" are my reading, not a statement in a plan.

Notation: [exists] is in the code today. [planned: Sx #issue] is only in a plan. Issue numbers known from the plans: #437 (Granola S1), #438 (Granola S2, emulator), #439 (Granola S3), #440 (Granola S4), #450 (Flow S5), epic #444 and epic #452. The other slice issue numbers are not given in the plans, so they are written as slice names only (for example "Granola S5").

## Application type and stack

- Rakazo: one multi-bot workspace across web (React SPA, react-router, Lingui), Electron (hosts the same web UI) and Expo mobile (Expo Router, native controls). API is oRPC (`packages/contracts/src/rpc.ts`, `apps/api/src/router.ts`) on Postgres/Prisma, with background jobs in `packages/adapter-kit` and `packages/adapters`.
- Both plans add no new page. The only new visible surfaces are: one card on the Granola integration page (Granola S6), new rows in Inbox to-dos (Granola S5), and one row in Settings, Voice (Flow S1b) plus an extended consent sentence (Flow S1c). Meetings themselves are reached only through agent chat.
- Providers sit behind neutral interfaces: `MeetingSource` (new, `packages/adapter-kit`), `TranscriptionProvider` (new), existing `VoiceProvider`.

## User roles

1. Founder on Granola Business with an API key. Can use both the MCP tile [exists] and the API-key sync [planned: Granola S2/S3/S6].
2. Granola free or Pro user, MCP only. Granola's API needs Business or Enterprise (granola.md, "What is confirmed", key rows). The MCP tile works for them [exists]; the card exists on their page but Granola rejects their key (granola.md, Surfaces, "Free plan").
3. Wispr Flow user without API access. Dictates into any field with Flow's own app [no Rakazo work except compatibility, Flow S2]. May connect Flow MCP [exists] and get Flow meetings [planned: Flow S5 #450].
4. Wispr Flow user with API access (organization approved by Wispr). Can pick Flow as the transcription provider [planned: Flow S1b, S3a, S3b; S3a and S3b blocked on access].
5. Space member who connected nothing. Sees no meeting data (meetings are private to the connector, granola.md "Security and tenancy"). Still gets the extended voice consent sentence if they use voice (Flow S1c). Their Inbox is unchanged.

State variants inside roles: user has a mail account or not; AI-data consent on or off (and old disclosure version); Granola MCP tile connected before or after the API key; Granola MCP agent removed; API-key agent removed.

## Feature map

### Existing surfaces these plans extend

- Integrations page and tiles: `apps/web/src/components/integrations/` (`IntegrationsHome`, `AppDetail`, `McpDetail`, `IntegrationAgentSection`), `apps/web/src/lib/integrations.ts` `FIRST_PARTY_MCP` entries `granola` and `wisprflow` [exists]. Mobile: `apps/mobile/app/(settings)/integrations.tsx` and `integration-setup.tsx` [exists].
- Granola MCP tile with private agent, `meeting-notes` skill, read-only preset, `switch_workspace` and `sign_out` blocked [exists] (`packages/contracts/src/granola.ts`, `integration-agent.ts`).
- Wispr Flow MCP tile with private agent, read-only preset by read-verb name heuristic (TODO to pin) [exists] (`packages/contracts/src/wispr-flow.ts`).
- "Create agent" button on the MCP detail, and `IntegrationAgentSection` for an existing agent [exists] (`McpDetail.tsx:237,246`).
- Inbox (`apps/web/src/pages/Inbox.tsx`, `TodoCard.tsx`, mobile `apps/mobile/app/inbox.tsx`) with a "To do" card of mail-derived to-dos [exists]. Today to-dos need a connected mail connection and enabled triage (`inboxTodosList`, `apps/api/src/inbox.ts:765`); the web card is shown only when `triage && pile === "important"` and consent is not pending (`Inbox.tsx:548`); marking done needs `connection.status: "connected"` (`inbox.ts:789`).
- Voice: Settings, Voice (`VoiceSettingsOverlay`, mobile `(settings)/voice.tsx`) with providers ElevenLabs, OpenAI, Fish Audio, Cartesia [exists]; dictation only inside Call Elio (web `call-session.ts`, `dictation.ts`; mobile `call-session.ts`, `thread.tsx` `startVoiceCall`) [exists]; composer has a "Call Elio" button (`Shell.tsx` `onVoice`, `startElioCall`) and no dictate button [exists].
- AI data consent with `model`, `voice`, `memory` uses and `AI_DISCLOSURE_VERSION` [exists] (`packages/contracts/src/ai-consent.ts`; web `components/AiDataSharing.tsx`, mobile `(settings)/ai-data-sharing.tsx`).

### Granola epic #444

- `MeetingSource` interface, `Meeting` and `MeetingSyncState` tables, repository, fake source, `meetings.json` account-export collector [planned: Granola S1 #437].
- Granola public-API source adapter and emulator (API key, cursor paging, 429 backoff, 413 transcript fallback) [planned: Granola S2 #438].
- Read-only agent tools `meetings_list`, `meetings_search`, `meetings_get`; fixed built-in tool allowlist for meeting-source agents; untrusted-text wrapper; consent gate [planned: Granola S4 #440].
- `meetings.sync` job: 90-day backfill by `created_after`, then incremental `updated_after`, 5-minute schedule, throttle, refresh when an agent is asked and the last sync is old, `needs_reconnect` on 401/403 [planned: Granola S3 #439].
- `meetings.digest` job and Inbox to-dos from the user's own commitments; identity from verified emails; `InboxTodo.meetingId`; meeting-only users see and complete to-dos; web, Electron and mobile Inbox changes [planned: Granola S5].
- Connect card on the Granola integration page: "Granola API key" field, "Connect" button, status "Synced {n} meetings, {relative time}", error "Granola rejected this key", "Disconnect"; RPCs `meetings.connect/status/disconnect/refresh`; agent provisioning for the `granola-api` connection (`ensureConnectedAppAgent`); mobile field and status row [planned: Granola S6].
- Weekly memory routine on the meeting-source agent: at most 5 bot-memory writes per run, bot scope only [planned: Granola S7].
- Cross-agent access: any agent asks a meeting-source agent with `message_bot` [planned: Granola S4; rule already exists in `docs/plans/agent-per-connection.md`].

### Wispr Flow epic #452

- Compatibility checks and small fixes so system dictation (Flow hotkey on Mac/Windows/Electron, Flow keyboard on iPhone) works in the web composer, the native message field and desktop shortcuts. No setting, no copy [planned: Flow S2].
- `TranscriptionProvider` interface with a conformance suite; existing providers adapted [planned: Flow S1].
- Transcription provider selection and credential: Settings, Voice row on web and mobile; `null` means "use my voice provider"; `voice.status` reports the selected provider [planned: Flow S1b].
- Consent re-prompt: extended `voice` disclosure (text near the cursor and workspace names may go to the transcription provider), `AI_DISCLOSURE_VERSION` bump, recipient list includes the transcription provider [planned: Flow S1c].
- Vocabulary hints from Rakazo (bot names, own contacts, ticket titles the actor can see), per request, never stored [planned: Flow S4]. Note: `beforeText` is carried but unused until a composer dictation exists (wispr-flow.md Design 5).
- Flow API transcription provider over REST with per-user daily seconds cap [planned: Flow S3a, blocked on Wispr access].
- 16 kHz WAV capture and routing so calls use record-and-upload when a server provider is selected [planned: Flow S3b, blocked with S3a].
- Flow Notetaker meetings as `provider: "wisprflow"` in the shared `Meeting` table; exact tool allowlist replaces the heuristic; Granola's meetings tools offered to the Flow agent [planned: Flow S5 #450, after #437 and #439].
- Manual checklist for real Flow on real devices [planned: Flow S6, docs only].

## Navigation: how a user reaches each planned surface

No planned surface has its own route. Paths from today's app (Assumption where marked):

| Planned surface | Path from today's app |
|---|---|
| Granola API key card (Granola S6) | Sidebar/Settings entry to Integrations, then the Granola tile (`IntegrationsHome` to `McpDetail`/detail). Plan says "shown on the Granola tile's detail". Assumption: the card shows on the detail even when the MCP tile is not yet connected, since the key path is independent; the plan does not say. Mobile: Settings, Integrations (`(settings)/integrations.tsx`). |
| Asking the Granola or Flow agent about meetings | The agent appears in the bot list after connect. Today via `IntegrationAgentSection` / "Create agent" in the tile detail. Then the normal thread composer. Another agent reaches it with `message_bot` (no UI). |
| Meeting to-dos (Granola S5) | Sidebar "Inbox" (web `/app/inbox`, mobile `inbox.tsx`). Web: the "To do" card on the Important pile. Meeting-only users: plan says the list shows with no mail account (Granola S5), but the current Inbox empty state is "Connect mail"; the plan does not say where the card sits for them. |
| Transcription provider row (Flow S1b) | Settings, Voice (`SettingsOverlay` section `voice`; mobile `(settings)/voice.tsx`). |
| Consent re-prompt (Flow S1c) | Appears on the next voice use, on the existing AI data prompt (`AiDataSharing`); also visible in Settings, AI data sharing. Assumption: the trigger point is the next Call Elio start; plan says only "existing users see the disclosure once more". |
| Flow-through-Rakazo dictation (Flow S2) | None in Rakazo. User presses Flow's hotkey in the composer (web, Electron) or switches to the Flow keyboard (iPhone). Rakazo's own mic in the composer is "Call Elio", which is a call, not dictation. |
| Flow transcription in calls (Flow S3a/S3b) | Composer "Call Elio" (web `Shell.tsx`; mobile `thread.tsx` `startVoiceCall`). No visible change except routing and transcripts. |
| Flow meetings (Flow S5) | Same as Granola agent path: Integrations, Wispr Flow tile, agent. No new UI; "does not touch the existing tile". |

## State transitions

### Granola API-key source (Granola S3, S6)

- Not connected -> paste key -> `meetings.connect` validates with one list call. Valid: secret stored, `Connection` (`granola-api`) created, agent created once, sync queued, status shown. Invalid: error line "Granola rejected this key", nothing stored, no connection, no agent.
- Connected -> syncing: first run backfills 90 days in batches across jobs, then every 5 minutes with `updated_after` plus overlap; a refresh also runs when an agent is asked and the last sync is old.
- Connected -> `needs_reconnect`: Granola returns 401/403; one line on the card; no retries until a new key is pasted. Assumption: pasting a new key on the same card moves it back to connected; the plan says "until the user pastes a new key" only.
- Sync error (other): short reason in `MeetingSyncState.error`, never a vendor payload. 429: back off, no user-visible state. Mapping error: typed, sync error, no rows written.
- Connected -> disconnect: secret deleted, sync stops, connection row kept as `disconnected`, meetings and to-dos stay, no confirm about data.
- Agent states: four cases in granola.md "Agent provisioning" (API key first or MCP first; MCP agent removed; API-key agent removed; "Create agent" is the repair).

### Meeting to-dos (Granola S5)

- Meeting stored -> digest job (consent required) -> `digestStatus` valid, or failed and retried to a limit then silent -> commitments matched to the user's verified emails -> `InboxTodo` rows. No identity or no match: no to-dos, digest still stored.
- To-do: open -> done (works with no connected source) -> reopened. Edited or completed to-dos are never replaced (`touchedAt`).

### Transcription provider and consent (Flow S1b, S1c, S3a)

- No selection (default) -> user opens Settings, Voice, picks a transcription provider and enters a key -> `verify` -> selected. Bad key: rejected. Clear: secret removed, back to "use my voice provider".
- Consent: current version on record -> version bump ships -> next use shows the updated voice disclosure once -> accepted: context (vocabulary, `beforeText`) may be sent; not accepted: audio only, or nothing, depending on the existing gate. Assumption: declining blocks voice as it does today.
- Flow API: blocked on access -> access granted and hostname known -> S3a/S3b can start -> daily seconds cap reached: call transcription blocked with a message, Wispr not called.

### Flow meetings (Flow S5)

- Flow MCP tile connected (exists) -> step 0 pins tool allowlist -> source registered -> sync into `Meeting` with `provider: "wisprflow"`. If shapes cannot be mapped: slice stops after pinning, follow-up filed; tile and agent keep working.
- Transcript not readable: meeting syncs as summary only.

## Data entities

- `Meeting` (new): space, user, source binding (`connectionId` xor `mcpServerId`), `provider` (`granola` | `wisprflow`), `externalId`, title, times, attendees, organizer, `sourceUrl`, folders, summary, `privateNotes`, `transcript`, `transcriptIndexed`, `digest`, `digestStatus`, `sourceUpdatedAt`, `deletedAt` (never set by Granola), generated full-text column. Private to the connecting user; kept permanently.
- `MeetingSyncState` (new): cursor/`syncedThrough`, claim, `lastSyncedAt`, `error`.
- `InboxTodo` [exists] gains `meetingId`; `connectionId` becomes nullable.
- `Connection` [exists] with `connectorId: "granola-api"` (new connector); `McpServer`/`McpOAuthSession` [exist] for Flow and Granola MCP.
- Secret store entry for the Granola key and for the transcription key.
- User-scoped transcription selection (new table, nullable provider, secret id) (Flow S1b).
- Per-user daily transcription seconds counter (Flow S3a).
- Dictation vocabulary: derived per request from bots, `Contact`, `Ticket`; not stored.
- Spawn keys `integration-agent:<connectionId>` [exists], `voice-agent:<userId>` [exists].

## Integrations

- Granola public API `https://public-api.granola.ai/v1` (bearer key, Business/Enterprise) [planned]; Granola MCP `https://mcp.granola.ai/mcp` [exists].
- Wispr Flow remote MCP `https://api.wisprflow.ai/connect/mcp` [exists]; Wispr Voice Interface API (REST first; hostname unknown; exclusive access) [planned, blocked]; Flow desktop app and iOS keyboard (user-installed, not integrated).
- Existing voice providers ElevenLabs, OpenAI, Fish Audio (can transcribe), Cartesia (cannot) [exist].
- Unconfirmed per the plans: Granola data-use terms, Granola webhook schema, Flow API hostname/rate limit/retention, Flow MCP tool names and OAuth registration method.

## Error, empty and loading states

### Defined by the plans

- Granola key rejected: one line "Granola rejected this key"; connection `needs_reconnect` on later 401/403.
- Free-plan Granola user: card shows no explanation; rejection appears as the error line.
- Meeting-source connected, no to-dos: empty state in the Inbox (Granola S5; text not given).
- Search with no sync: tool returns "no synced meetings", skill falls back to MCP tools.
- Transcript too large: 413 fallback to paged transcript (no user state). Transcript capped with a truncation marker in `meetings_get`.
- Missing transcript: stored as "no transcript"; summary-only for Flow.
- Digest invalid/oversized: `failed`, retried, then silent.
- Agent removed: sync continues; "Create agent" repair path.
- No identity email or no attendee match: no to-dos, silently.
- Consent off: no digest, no meeting tools; Flow context not sent.
- Flow: over 25 MB or 6 minutes rejected before sending; non-WAV rejected with "a clear message"; daily cap "blocks with a message"; provider error becomes a user error with no key; "does not transcribe" error for providers with no transcription [exists].
- Flow API blocked on access: issues stay filed, nothing user-visible.

### Left undefined (see ambiguities)

Loading and progress for backfill; empty state before first sync completes; sync error text other than rejection; all strings for the digest and consent re-prompt; error text for WAV and cap messages; loading state while verifying a transcription key.

## Feature flags and conditions

No feature flags are named in either plan. Conditions that gate behavior:

- Granola plan tier: Business/Enterprise for the API key; Enterprise admin must enable member scopes; Enterprise "Meeting transcripts" setting blocks AI transcripts.
- AI-data consent (same gate as mail tools): required for meeting tools, digest, and Flow context.
- Mail triage enabled: today gates the whole to-do list; Granola S5 changes `enabled` to also true with meeting to-dos or a meeting source.
- Meeting-source agent exists: required for any agent to read meetings; owner-initiated, owner's bot message, or S7 routine triggers only.
- Wispr API access granted and hostname known: gates S3a/S3b.
- Active BAA on the Flow account blocks all Flow MCP features (wispr-flow.md facts table).
- Flow Notetaker/MCP on the account, Mac and Windows only; free-plan Notetaker weekly limit unknown (open question 7).
- `MEETINGS_BACKFILL_DAYS` = 90, sync every 5 minutes, 4 requests/second (constants in code, not flags).
- Hosted pooled allowance (hosted-service epic) used for the daily cap if landed.
- Electron: Web Speech not available; server dictation path used (`webSpeechAvailable()` false).

## Recommended Story Topics

1. First-time Granola setup (founder on Business). Integrations to Granola tile, paste key, see "Synced N meetings", ask the Granola agent a question with citations, see the first to-do appear; includes invalid key and the MCP-tile-first order (two agents). Covers Granola S2, S3, S4, S6.
2. Meeting follow-ups in the Inbox. Meeting-only user and mail user; complete a to-do; disconnect Granola and still see and complete them; no identity match gives none; consent off. Web, Electron. Covers Granola S5.
3. Granola error, recovery and non-Business paths. Free/Pro user pastes a key and is rejected, falls back to the MCP tile; later 401 sets `needs_reconnect`; paste new key; remove an agent and "Create agent"; disconnect keeps data. Covers Granola S3, S6 and the agent-provisioning cases.
4. Granola plus Flow meetings together (cross-feature). A user with both sources asks one agent about a meeting, asks across providers (`provider` filter), another agent uses `message_bot`, weekly routine writes bot memory; Flow summary-only meetings; Flow-only user. Covers Flow S5 with Granola S1, S3, S4, S7.
5. Dictating into Rakazo with Flow, no API (roles 3 and 5). Hotkey in web and Electron composer, Flow keyboard in the iPhone message field, multi-line insert keeps draft and enables Send, secure inputs, Call Elio shares the mic. Covers Flow S2 and S6 checklist.
6. Choose Flow as the transcription provider, with consent and spend limits (role 4). Settings, Voice row, key verify and clear, speech output unchanged, consent re-prompt after version bump, Call Elio uses Flow, vocabulary hints, daily cap reached, over-length audio. Show the blocked-on-access state for role 3 and 5. Covers Flow S1, S1b, S1c, S3a, S3b, S4.
7. Mobile pass for both plans. Settings, Integrations Granola field and status row with native controls; mobile Inbox to-dos (currently per-connection); Settings, Voice transcription row; call routing to upload path when a server provider is selected; native message field props for the Flow keyboard. Covers Granola S5/S6 and Flow S1b, S2, S3b on mobile.

Coverage: both epics, cross-feature (4), error and recovery (3, parts of 2 and 6), mobile (7), first-time setup (1).

## Plan ambiguities

Each is a place where a journey step cannot be written yet.

1. Where the meeting-only Inbox to-do list appears. granola.md "Retrieval and completion" and S5 say the list shows with no mail account, but today's Inbox shows the "To do" card only on the Important pile with triage on (`Inbox.tsx:548`), and with no mail account the page prompts "Connect mail". The plan gives no layout, pile, or entry point. Mobile fetches to-dos per `connectionId` (`inbox.tsx` `listMailTodos(connectionId)`); a meeting to-do has no connection.
2. Which Inbox account tab holds meeting to-dos. Web keys to-dos by tab (`todosByTab`); meeting to-dos belong to no mail account. Not stated (granola.md S5).
3. Empty state wording and trigger for "source connected, no to-dos" (granola.md S5 "empty state for a connected meeting source"). No text, no position.
4. Backfill progress and first-sync waiting. The card shows "Synced {n} meetings, {relative time}" (granola.md Surfaces), but nothing for "syncing now", "0 meetings yet", or a backfill in batches over several jobs. "Within a minute the agent can answer" (User story) is the only timing.
5. Non-rejection sync errors. Only "Granola rejected this key" has copy. `MeetingSyncState.error` holds short reasons (Data) but the card text for network failure, rate limit, mapping error is undefined.
6. Recovery from `needs_reconnect`. The plan says the card shows one line and no retry until a new key is pasted (Sync). Whether the field, "Connect" button, and "Disconnect" are all shown in that state is not stated. Same for the connected state: can the user replace a key without disconnecting?
7. Card visibility conditions. "Shown on the Granola tile's detail" (S6). Not stated: whether it shows before the MCP tile is connected, whether the Granola tile is findable by someone who wants only the API key, and whether the card appears for Granola on mobile in `integration-setup.tsx` or only in `integrations.tsx`.
8. "Refresh" (`meetings.refresh`) has an RPC (S6) but no UI control is listed. Unclear whether a user can trigger it.
9. Two Granola agents. Open question in granola.md; the Agents list shows each "with its account label". Which agent the user is told to ask, and how they are distinguished in the thread picker, is undefined until S6 decides whether to link one bot to both.
10. How a user learns to ask for meeting memory. "The user can ask the Granola agent to remember a decision" (User story) conflicts with the S4 allowlist, which removes memory writes; granola.md Contacts/memory says a "remember this" run "is not given meeting tools". The journey for "remember this decision from the Pricing review" cannot be written without knowing what the agent can recall in that run.
11. Weekly routine visibility (S7). Notify is off and writes at most 5 entries. Where the user sees, edits, or deletes these memories is not stated; also how the user turns the routine off.
12. Digest consent copy and the one-line Granola consent note. Open question: "Add a one-line consent note on the card, or is the existing AI data sharing setting enough?" Journey for consent on the card is undefined. Also what a meeting-only user sees when AI-data consent is off (silent no-digest, or a prompt) is not stated.
13. To-do detail and navigation. "From: Pricing review, 12 Oct" is the only detail. Whether tapping a to-do opens the meeting or the agent is not stated (and today's mail to-dos are not clickable either, per the existing inbox discovery notes).
14. Settings, Voice transcription row layout (Flow S1b). "Reuses the provider-picker pattern"; the plan gives no states for: picker open, key entry, verifying, verify failure message, selected, clear. It also does not say whether Flow appears in the picker for users who lack API access (it is "blocked on access"), or how a user without access is told.
15. Consent re-prompt trigger and wording flow (Flow S1c). Says "existing users see the disclosure once more" and "re-prompts once", not where (call start, Settings, or app launch) or what happens if the user declines mid-call.
16. Daily cap messaging (Flow S3a). "Blocks with a message" with no text, no reset time, and no indication of the cap number to the user.
17. Format rejection message (Flow S3a/S3b). "Rejects other formats with a clear message" but the user cannot choose a format; unclear when a user could ever hit it (e.g. recorder fallback when WAV capture fails on a device).
18. Mic sharing during a call (Flow S2). Plan says S6 "records what happens; no code is planned". The expected user result is unknown, so the journey is an observation, not a pass/fail path.
19. Flow Notetaker availability. MCP needs Notetaker on the account and Mac/Windows; a BAA blocks MCP; free-plan weekly limit unknown (wispr-flow.md facts, open question 7). What the Rakazo user sees when the tile is connected but no meetings can be read is not defined; the S5 "stop after pinning" branch means the Flow-meetings journey may not exist at all.
20. Cross-provider answers. Meetings tools may filter by `provider` (granola.md Reading), but the plan does not say how answers distinguish a Granola and a Flow meeting for the same call, or how duplicates (same meeting recorded by both tools) are shown.
21. Disclosure that Granola deletions are not mirrored (Sync). A note deleted in Granola stays in Rakazo and may be cited by the agent; the user is not told. No journey step for "I deleted this in Granola, why is it still here" and no deletion control in Rakazo.
22. Dictation vocabulary in practice (Flow S4). `beforeText` is "unused until a composer dictation exists", and vocabulary only reaches the Flow provider, which is blocked. For users without API access, S4 has no visible effect on any journey; the plan does not name a verifiable user-visible outcome for other providers.
23. Mobile settings for transcription. Flow S1b says "web and mobile", but there is no native pattern described (picker, secure field). Assumption: native picker plus secure text entry, per AGENTS.md mobile rules.
