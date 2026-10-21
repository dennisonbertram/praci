# Wispr Flow

Status: plan; no code yet. Written 2026-10-20; revised after review against `origin/main` at b78a1c5b. File and line references were read at that commit unless a section says otherwise. Research on Wispr Flow was read from its public pages on 2026-10-20; see "What is confirmed about Wispr Flow" for sources and what is not confirmed.

## Summary

Wispr Flow is a dictation app that works in any text field, so Rakazo does not need an integration for people to speak into it. It has no connection to Rakazo today and it does not need one to work in the composer. What Rakazo can do is (1) make its own text fields work well with Flow (Mac, Windows, the Electron app, the iOS keyboard), (2) offer Flow as an optional transcription provider behind a provider-neutral interface, if the maintainer's organization is approved for Flow's developer API, and (3) sync Flow Notetaker meetings, read through the Flow MCP connection that already exists, into the shared meetings store the Granola epic builds.

The plan does not pretend that a paid Flow plan unlocks more than it does. As far as the public pages show, the consumer plan (Free, Pro, Growth, Enterprise) covers the app and the MCP server; the developer API is a separate product that needs approval from Wispr and is billed by usage. Flow's MCP server explicitly cannot read dictation history, and no public page says the user's personal dictionary can be read. So "what I dictate enriches Rakazo" is already true for the plain reason that dictated text becomes the user's message in Rakazo, and "the vocabulary Flow learns" is not reachable. The plan instead goes the other way: Rakazo supplies its own vocabulary (bot names, contact names and ticket titles the user is allowed to see) to the API provider.

One fact shapes the whole plan: Rakazo has no dictate-into-the-composer button today. On web and mobile, the composer mic is "Call Elio" (a voice call), and Rakazo's own dictation runs only inside calls (`apps/web/src/lib/call-session.ts` is the only web caller of `dictation.ts`; `apps/mobile/app/thread.tsx` has no composer mic or hold-to-talk). So Flow does not compete with any Rakazo control in the composer, and it fills a real gap there.

## User story

- **Faster.** The founder speaks into the composer, an agent's panel, a note or a reply and gets accurate, cleaned-up text, on web, in the desktop app and on the phone, using the dictation tool they already prefer.
- **Simpler.** Nothing to set up for the common case: Flow types into the composer like a keyboard, and Rakazo adds no switch or copy for it.
- **Trustworthy.** Nothing is sent to Wispr by Rakazo unless the user chose the Flow provider and accepted the updated voice disclosure (S1c). Dictated text is the user's own message and is handled as any typed message; text read from Flow's MCP is untrusted data.

Shipped experience: a founder with Flow installed taps into the composer, presses Flow's hotkey (or switches to the Flow keyboard on iPhone), speaks, and the words appear and send as usual. A founder whose organization has Flow API access can pick "Wispr Flow" as the transcription provider in Settings, Voice and get Flow's cleanup in Call Elio, with names from their workspace passed as hints; speech output keeps using their existing voice provider. A founder who connects Flow's MCP gets Flow meetings in the same meetings store as Granola.

## What is confirmed about Wispr Flow

Sources were read on 2026-10-20. "Confirmed" means the page says it. Everything else is under Open questions.

| Fact | Source |
|---|---|
| Flow is a system-wide dictation app on Mac, Windows, iOS and Android. Free plan: dictation on all four, 2,000 words per week on desktop, limited weekly use on mobile. Pro: unlimited dictation, shared dictionary and snippets. Growth and Enterprise add SSO, HIPAA/BAA, admin model-training control. Prices on the page: Pro $15 monthly or $12 annual per user; Growth $23 or $18; Enterprise custom. | https://wisprflow.ai/pricing |
| iPhone: Flow is a custom keyboard. It needs microphone access, Full Access for the keyboard, and Live Activities. The user switches to it with the globe key. It inserts text into the current field. For number pad, decimal pad, phone pad, email-address and numbers-and-punctuation fields Flow switches to the next keyboard. The article does not address password fields. Six Flow Shortcuts work with Action Button, Back Tap and Siri. | https://docs.wisprflow.ai/articles/1986921789-how-to-set-up-flow-shortcuts-for-iphone |
| Context Awareness (on by default, Mac and Windows) reads the active app category, the website in browsers, text before and after the cursor and selected text, and on screen text such as email recipients. It takes no screenshots. Flow says password field contents are never read, standard macOS password fields are excluded, and it excludes sensitive and numeric-only fields, URL bars and banking apps, but it also warns that "custom or web-based password fields may be read like normal text fields". It does not mention one-time codes. Mac needs the Accessibility permission. On iOS it is limited to the focused text field and cannot be turned off. | https://docs.wisprflow.ai/articles/4678293671-feature-context-awareness |
| Data sharing: "Improve the model for everyone" and dictation cloud storage default to on; turning training off does not stop cloud processing, and Flow still uploads metadata (word count, duration, app, timestamp, edit statistics). Notetaker transcripts and summaries are always stored in Wispr's cloud. A signed BAA locks sharing off; Enterprise locks model training off. No retention period is given for dictation. | https://docs.wisprflow.ai/articles/9609615338-private-cloud-sync-and-data-sharing-preferences-in-wispr-flow |
| Remote MCP server at `https://api.wisprflow.ai/connect/mcp`, sign-in in the browser, no API key. Read-only. Readable: meeting summaries, notes, transcripts, attendees, tasks, scratchpad notes, calendar events and linked recordings. Not readable: dictation history, Notetaker chat history. The page does not name the OAuth variant, the tool names, or the dictionary. Needs Notetaker and MCP on the account (Mac and Windows). MCP is on by default and included on the Free plan per the pricing page. An active BAA blocks all MCP features. | https://docs.wisprflow.ai/articles/9551372685-connect-an-mcp-client-to-wispr-flow-remote-mcp-server, https://docs.wisprflow.ai/articles/4759919286-how-to-connect-wispr-flow-to-claude-chatgpt-and-other-ai-tools-mcp |
| A separate "Voice Interface API" turns speech into text. WebSocket (`/ws`, recommended) and REST (`/api`, slower). Auth is either an API key kept on the backend or short-lived client tokens minted by the backend. It is "only available by exclusive access": the organization must be approved by Wispr (contact address on the quickstart page), then keys are made in the developer platform. | https://api-docs.wisprflow.ai/introduction.md, https://api-docs.wisprflow.ai/quickstart.md |
| API request: `audio` is base64 16 kHz WAV, at most 25 MB or 6 minutes; optional `language` (ISO 639-1 list); optional `context` with `app` (`name`, `type` of `email`, `ai` or `other`), `dictionary_context` (words), `user_first_name`, `user_last_name`, `user_identifier`, `textbox_contents` (`before_text`, `selected_text`, `after_text`), `screenshot`, `content_text`, `content_html`, `conversation`. | https://api-docs.wisprflow.ai/request_schema.md |
| API billing is by usage tokens, charged after credits run out; the dashboard cannot set limits, so the caller must enforce them. Data retention for API audio is not stated. | https://api-docs.wisprflow.ai/usage_billing.md |

Not found on any official page: the API hostname, the WebSocket message schema in text form (the docs index lists the pages but this plan did not read them), an API rate limit, API data retention, whether Flow offers a way to import a dictionary, any "open in app" or URL scheme for Flow, any API for reading dictation history or the dictionary, and any statement that a consumer Pro plan includes API access. A third-party post (Scalekit) describes the same API and says the two surfaces (MCP, API) do not overlap; it was used only to cross-check, not as a source of facts.

## Integration route chosen, and why

Flow is two different things for Rakazo, so the plan has three small routes, each independent and each safe to skip:

1. **Compatibility (always).** The honest integration with the consumer Flow app is to be a good host for it: plain focusable text fields that accept inserted multi-line text, no global shortcut that collides with Flow's, and iOS fields that allow the Flow keyboard. Flow needs nothing from Rakazo to work here. There is no composer dictation in Rakazo to hide, so there is no switch. This is the part that serves the maintainer on day one.
2. **Provider (conditional).** The only programmatic way to get Flow's transcription into Rakazo's own calls is the Voice Interface API. It needs Wispr's approval and is billed separately from the consumer plan, so it ships as one provider behind a provider-neutral transcription interface, with the other existing providers on the same interface. If access is never granted, nothing else in the plan depends on it, and a future in-house dictation implements the same interface.
3. **Meetings (conditional, shared).** Flow's tile, private agent and a read-only preset already exist on `origin/main` (commit 9344d202a), so the remaining work is not a tile. It is to make Flow Notetaker meetings a second `MeetingSource` that fills the same `Meeting` table the Granola epic (#444) creates, so meetings from both tools are searchable and usable by one set of features.

Not chosen: a Flow SDK or plugin inside Rakazo (none is documented), scraping Flow's local history or dictionary files (undocumented, and would read private data), and importing Flow's dictation history (the MCP server excludes it).

## Current state in Rakazo (verified at c39eac258)

| Area | Fact |
|---|---|
| Web dictation | `apps/web/src/lib/dictation.ts` has two modes, `hold` and `endpoint`, but its only caller is the call session (`apps/web/src/lib/call-session.ts`); the composer has no dictation button, only "Call Elio" (`Shell.tsx`, `onVoice`). `listen` records and uploads to `/api/voice/transcribe` only when `prefersServerDictation()` is true (`:69`, `:258`); otherwise it prefers the browser's Web Speech API when `webSpeechAvailable()` (false in Electron, `:48-60`). |
| Server transcription | `transcribeVoice` in `apps/api/src/voice.ts:368` loads the user's default voice credential (`loadDefaultVoiceCredential`), which is created by `createVoiceProvider(...).verify` and then `listVoices` (`voice.ts` ~151-159), so a provider without speech cannot be set up this way. It requires the provider to implement the optional `VoiceProvider.transcribe` (`packages/adapter-kit/src/interfaces.ts:603`), caps the size, and calls it. The route is `/api/voice/transcribe` (`voice.ts:431`). Providers with transcription: ElevenLabs, OpenAI, Fish Audio; Cartesia has none (`packages/adapters/src/voice-factory.ts`, `transcribe` flag). `VoiceTranscribeRequest` is `{ audio, mimeType, apiKey, language, signal }` (`packages/adapter-kit/src/types.ts:666`). |
| Mobile dictation | `apps/mobile/lib/dictation.ts` uses `expo-speech-recognition` on device with 1.2 s silence endpointing, and is used by calls (`apps/mobile/lib/call-session.ts` prefers it, `onDevice !== false`, `:315`); the upload path to `/api/voice/transcribe` is `call-session.ts:701`. The mobile composer (`apps/mobile/app/thread.tsx`) has no mic or hold-to-talk. |
| Elio | The voice agent has spawn key `voice-agent:<userId>` (`packages/contracts/src/voice-agent.ts`) and a call card (`apps/web/src/components/call/CallCard.tsx`, `apps/web/src/lib/call-session.ts`). A call is speech in, an ordinary agent chat out. |
| Consent | `AiDataUse` includes `voice`: "Your recordings are sent for transcription, and text you play is sent to generate speech." (`packages/contracts/src/ai-consent.ts` ~8-14, `AI_DISCLOSURE_VERSION`). It does not mention text near the cursor or vocabulary. Recipient discovery for `voice` comes from the user's voice preferences or default voice credential (`apps/api/src/ai-consent.ts` ~88-97, 221-222), so a separate transcription provider would not be listed. |
| Settings | Voice settings exist (`voice.catalog`, `voice.status`, `voice.credentials`, `voice.setSpeechModel`, `packages/contracts/src/rpc.ts:1316`). Keys are stored per user as credentials. |
| MCP | The Flow tile already exists: `wisprflow` in `FIRST_PARTY_MCP` (`apps/web/src/lib/integrations.ts:176`), `packages/contracts/src/wispr-flow.ts` (endpoint, `isWisprFlowEndpoint`, `WISPR_FLOW_READ_NAME`), `INTEGRATION_PRESETS.wisprflow` in `packages/contracts/src/integration-agent.ts` with its tests (`integration-agent.test.ts:231`), and a private agent per connection. The preset counts a tool as a read by `readOnlyHint` or a read-verb name until the tool list is pinned (a TODO in `wispr-flow.ts`). Presets restrict tools per server (`packages/adapters/src/mcp-connector.ts`). |
| Memory | `MemoryDocument` is scoped by space, user and optional bot (`packages/db/prisma/schema.prisma:1055`). Nothing in this plan writes to it. |

## Design

### 1. A provider-neutral transcription interface

Today transcription is an optional method on a provider that also has to speak. A transcription-only provider like Flow cannot implement `VoiceProvider` (its `synthesize` is required). Add `TranscriptionProvider` to `packages/adapter-kit`: `describe()`, `verify(apiKey)`, `transcribe(request)`. `VoiceTranscribeRequest` gains an optional `context` with only provider-neutral fields: `appKind` (`email` | `ai` | `other`), `vocabulary` (string list, capped), `beforeText` (capped), `language`. Existing voice providers keep working: a small function adapts each `VoiceProvider` that has `transcribe` to `TranscriptionProvider` and ignores `context` fields it cannot use. `transcribeVoice` resolves the user's chosen transcription provider (default: the voice provider they already use), so nothing changes for anyone who does nothing. The catalog marks entries as speech, transcription, or both; the Flow entry is transcription-only.

Selection and credential (S1b). A transcription-only provider cannot go through the voice credential path, which needs `listVoices`. S1b adds a separately persisted transcription selection: one additive table (user-scoped, nullable provider, secret id in the existing `SecretStore`) and RPCs to set, clear and read it. `verify` runs on `TranscriptionProvider`, never `listVoices`. Null means "use my voice provider", so speech and existing transcription keep working on the existing provider. A Settings, Voice row on web and mobile picks the provider and takes the key. `voice.status` reports the selected transcription provider so clients can route (see S3b).

A deterministic scripted transcription provider (like `scripted-voice.ts`) and one shared conformance test run against every provider with a fake HTTP server. The conformance test covers: empty audio rejected, oversize rejected, language passed, vocabulary capped, provider error becomes a user error with no key in the message, abort honored.

### 2. Composer compatibility with system dictation

Because Rakazo has no composer dictation, there is nothing to switch off and no new setting or copy. The slice checks and tests what Flow needs from Rakazo's fields:

- Composer fields stay ordinary editable elements with accessible names, because Flow inserts through the platform's text input and, on desktop, reads the field's surrounding text. Rakazo's rich composer is checked for an inserted multi-line, cleaned-up paragraph: it must keep the caret after the inserted text, keep the draft memory, and enable Send.
- No global shortcut in `apps/desktop` or the web app uses a key that Flow documents as its hotkey. The Flow hotkey list is read from the help center in the slice (open question below); until then the check is "no global shortcut registered by Rakazo that is not already documented in `apps/desktop`".
- On iOS the Flow keyboard is a system keyboard: the native message field must not force another keyboard type, must keep `autocorrect` and content-type defaults, and must not be `secureTextEntry`. Mobile has no Rakazo mic in the composer, so this is a props test only.
- Rakazo keeps its own secure-field controls. Flow's page says custom or web password fields may be read like ordinary text, so Rakazo's password, token and secret inputs keep their native secure input types and are not relied on to be skipped by Flow; the manual checklist (S6) tries Flow in them and records what it does.
- During a Call Elio, Flow and the call share the microphone. S6 records what happens; no code is planned for it.

### 3. Flow as a transcription provider (conditional on API access)

`packages/adapters/src/wispr-flow-transcription.ts` implements `TranscriptionProvider` over the REST endpoint first. REST is slower but one request per recording, matches the existing record-then-upload path and the 1.2 s endpointing, and needs no long-lived socket per user in a multi-process deployment. The WebSocket endpoint is deliberately not built (see not built).

- **Credential.** An API key per user in the S1b transcription credential, entered in the Settings, Voice row. The deployment hostname comes from a shared connection setting (the base URL is not on any public page we found), not from a Flow-specific environment variable. Client-side tokens are not used: the server proxies, so the key never reaches a browser.
- **Audio.** Flow takes base64 16 kHz WAV, at most 25 MB or 6 minutes; the browser records WebM. The call recorders on web and mobile get a 16 kHz mono WAV capture path used only when the Flow provider is selected, and selecting a server transcription provider routes calls through the recorder and upload path instead of Web Speech or native recognition (S3b); the server rejects other formats with a clear message rather than transcoding (the API server has no ffmpeg dependency and adding one is out of scope).
- **Context.** From `TranscriptionProvider` context: `appKind` maps to `context.app.type`, `vocabulary` to `dictionary_context`, `beforeText` to `textbox_contents.before_text`, `language` to `language`. No screenshot, `content_text`, `content_html` or conversation is ever sent.
- **Spend.** Flow's dashboard cannot cap spend, so the server enforces a per-user daily cap on recording seconds (a number in code, not environment), reusing the existing hosted pooled allowance if the hosted-service epic has landed, otherwise a simple counter row. This slice only needs the counter; it does not build billing.
- **Consent and disclosure (S1c).** The `voice` disclosure text is extended to say that text near the cursor and names from the workspace may be sent as hints to the selected transcription provider, `AI_DISCLOSURE_VERSION` is bumped (existing users see the disclosure once more; this cost is accepted), and recipient discovery includes the selected transcription provider. `transcribeVoice` sends `vocabulary` and `beforeText` only to a provider that declares it uses them and only when the current-version consent is on record; otherwise it sends the audio alone.

### 4. Vocabulary from Rakazo, not from Flow

`dictation.vocabulary` returns a capped, deduplicated list of names the user is likely to say, built per request and never stored. There is no `Project` model, and the sources have different scoping, so each is listed with its rule:

- Bot names: the bots in the actor's roster, using the query the roster itself uses.
- Contact names: `Contact` rows where `spaceId` and `userId` both match the actor (the model has both).
- Ticket titles: `Ticket` is space-scoped with no `userId` and is authorized through the space's board (`tickets.list` resolves the board, `apps/api/src/router.ts` ~4413-4420). Only tickets that call would return for the actor, only the title, capped.

Nothing from another space ever appears; contacts of another member never appear. The list feeds `vocabulary` in the neutral context. The same list can be offered to other providers that accept hints later. There is no promise that Flow's own dictionary is read or written: no public page documents either.

### 5. Untrusted text

- Text the user dictates into the composer is the user's own message and is treated like typing. No new trust level.
- Text read from Flow's MCP server (meeting notes, transcripts of other people speaking, calendar entries written by third parties) is untrusted data in agent prompts, the same as any MCP result. It is read-only by Flow's own design; the Rakazo preset also allows only read tools, with write tools absent from the allowlist.
- `beforeText` sent to a provider is capped and comes only from the field the user is dictating into; it is never stored by Rakazo with the transcription. In the current design calls have no text field, so `beforeText` is unused until a composer dictation exists; S4 and S3a carry it as an optional field and send nothing for it today.

### 6. Flow meetings as a second `MeetingSource` (conditional)

The tile, preset and agent exist; this section adds only what is missing. Step 0 is to connect once on a dev stack, record `tools/list` and the OAuth registration method, and replace the `readOnlyHint` or read-verb heuristic in `INTEGRATION_PRESETS.wisprflow` with an exact allowlist of the real read tools. Then implement a `MeetingSource` (the neutral interface from Granola #437: list changed meetings, get one) over those MCP read tools, bound to the user's `McpServer` row (the Granola plan binds a `Meeting` to either a `Connection` or an `McpServer` through a nullable `mcpServerId`; a Flow meeting uses the latter), and register it with the sync job from Granola S3 (#439), so Flow Notetaker meetings sync into the same `Meeting` table with `provider: "wisprflow"`. Granola's meetings tools are also offered to the Wispr Flow agent, so Flow meetings are queryable through the same tools once synced. Vendor names appear only in the adapter and the composition root. The adapter calls the MCP server with the user's own connection, read-only. The offline test pattern is the emulator from Granola #438: a fake MCP server that answers the recorded `tools/list` and invented outputs. If the output shapes cannot be mapped deterministically (the help center documents capabilities, not fields), the slice stops after pinning the allowlist and files a follow-up; the existing tile and agent keep working either way.

## Shared meetings store (resolved)

The lead decided on one shared store. The Granola epic (#444) owns it: #437 adds the `Meeting` table and the provider-neutral `MeetingSource` interface, and #438 adds the emulator pattern for offline fixtures (see `docs/plans/granola.md` on branch `docs/granola-plan`). S3 (#439) adds the sync job and its provider registration. This plan defines nothing new for the store and files no issue for it; S5 consumes it. Meetings stay private to the user who connected the source, with `spaceId` and `userId` on every row, as that plan specifies. A transcript store for dictation is deliberately not proposed: nothing here keeps what the user dictated beyond the message it becomes.

## Slices

Each is one PR from `origin/main` at b78a1c5b or later. Waves are listed below the slices.

### S0. Commit this plan

Docs only. Owns `docs/plans/wispr-flow.md`. Done by this commit; no issue is filed for it.

### S1. Provider-neutral transcription interface

Story: Simpler, Trustworthy.

- Owns: `packages/adapter-kit/src/interfaces.ts` and `types.ts` (`TranscriptionProvider`, optional `context` on `VoiceTranscribeRequest`), `packages/adapters/src/voice-factory.ts` (adapter from existing voice providers, catalog `speech`/`transcription` flags), `packages/adapters/src/scripted-voice.ts` or a new scripted transcription file, `apps/api/src/voice.ts` (`transcribeVoice` resolves a `TranscriptionProvider`; selection and consent are S1b and S1c), `packages/contracts/src/domain.ts` (catalog entry shape, fields optional).
- Behaviour: existing ElevenLabs, OpenAI and Fish Audio transcription give identical results; a provider with no transcription still returns the current "does not transcribe" error; the context is accepted and ignored by providers that cannot use it; a shared conformance suite runs against every provider offline.
- Tests first: `packages/adapters/src/transcription-conformance.test.ts` (new), `packages/adapters/src/voice-factory.test.ts`, `apps/api/src/voice.test.ts` (or the existing voice tests).

### S1b. Transcription provider selection and credential

Story: Simpler, Trustworthy.

- Owns: `packages/db/prisma/schema.prisma` and a new migration (user-scoped transcription selection: nullable provider, secret id), `apps/api/src/voice.ts` (set, clear, read; `verify` through `TranscriptionProvider`, never `listVoices`; `voice.status` field for the selected transcription provider), `packages/contracts/src/rpc.ts` and `apps/api/src/router.ts` (the RPCs), the Settings, Voice row on web and mobile with a story.
- Behaviour: with no selection, speech and transcription behave exactly as before; selecting a provider stores its key in the secret store and never returns it; clearing removes the secret; a bad key is rejected by `verify`; speech output keeps using the existing voice provider; every query is scoped to the actor.
- Tests first: a Postgres test for set, clear and scoping, an API test that selecting a transcription-only provider leaves speech untouched, a settings-row component test.
- Copy: the Settings, Voice row reuses the provider-picker pattern already there; the PR quotes any new strings.

### S1c. Consent for the transcription recipient and context

Story: Trustworthy.

- Owns: `packages/contracts/src/ai-consent.ts` (extend the `voice` disclosure, bump `AI_DISCLOSURE_VERSION`), `apps/api/src/ai-consent.ts` (recipient discovery includes the selected transcription provider), the `transcribeVoice` gate in `apps/api/src/voice.ts` (send `vocabulary` and `beforeText` only to a provider that uses them and only under current-version consent), and the mobile and web consent clients where they hold the version.
- Behaviour: the disclosure text names text near the cursor and workspace names; the recipient list shows the selected transcription provider; without current consent no context field reaches any provider; an existing voice provider that ignores context receives nothing extra; the new version re-prompts once.
- Tests first: contracts test for the text and version, API tests for discovery with a selected transcription provider and for the gate, a mobile consent test.
- Copy: the extended `voice` sentence only; the PR quotes it, says why the existing sentence cannot cover it, and notes the one-time re-prompt.

### S2. Composer compatibility with system dictation

Story: Faster, Simpler.

- Owns: tests, and any small fix they require, for the composer on web (`apps/web/src/pages/Shell.tsx` message field) and the native message field (`apps/mobile/app/thread.tsx`); `apps/desktop` shortcut review. No setting, no new copy, no new UI.
- Behaviour: an inserted multi-line paragraph keeps the caret after it, keeps the draft and enables Send; no global shortcut in `apps/desktop` collides with Flow's documented hotkey (once read); the native message field does not force a keyboard type, keeps `autocorrect` and content-type defaults, and is not `secureTextEntry`.
- Tests first: a web test that dispatches a text insertion (input event with a multi-paragraph string) into the composer and checks draft, caret and Send; a mobile props test for the message field; a unit test listing desktop global shortcuts.

### S3a. Flow transcription provider (conditional on API access; blocked)

Story: Faster. Blocked on API access: the issue stays filed but must not start until Wispr has approved an API key for the maintainer's organization and the hostname is known (open questions 1 and 2).

- Prerequisites: S1, S1b, S1c, and API access. S4 is independent: when it lands, S3a consumes its `vocabulary` through the neutral context.
- Owns: `packages/adapters/src/wispr-flow-transcription.ts` and tests with a fake server, `voice-factory.ts` catalog entry, `apps/api/src/voice.ts` per-user daily seconds counter, the base URL connection setting.
- Behaviour: a recording is sent as base64 16 kHz WAV with the mapped context; over 25 MB or 6 minutes is rejected before sending; non-WAV is rejected with a clear message; the key is never in logs or errors; a provider error becomes a user error; the daily cap blocks with a message and does not call Wispr; calls are scoped to the actor's credential.
- Tests first: the shared conformance suite from S1 plus request-shape tests against a fake server written from the published request schema.

### S3b. WAV capture and server routing for Flow (blocked with S3a)

Story: Faster. After S3a; blocked on API access with it.

- Owns: web and mobile call recorder paths that produce 16 kHz mono WAV when the selected transcription provider asks for it (`apps/web/src/lib/dictation.ts`, `apps/web/src/lib/call-session.ts`, `apps/mobile/lib/call-session.ts`), a small shared WAV encoder in `packages/core`.
- Behaviour: when `voice.status` reports a server transcription provider that needs WAV, calls use the recorder and upload path even where Web Speech (web) or native recognition (mobile) is available, because those never reach the selected provider; with no selection, routing is unchanged; encoder output has a valid header and the right length for a known PCM buffer; the recorder switches format only for the Flow provider; other providers keep WebM.
- Tests first: encoder byte-level test in `packages/core`; web tests where `webSpeechAvailable()` is true and false, each with and without a selection; mobile tests where native recognition is available and not, each with and without a selection; recorder tests with a fake media stream.
- Unverified until run on device: mobile WAV capture quality and size.

### S4. Rakazo vocabulary as transcription hints

Story: Faster (names spelled right), Trustworthy (scoped, private). Independent of S3a: the vocabulary goes into the neutral context and S3a consumes it when it lands. After S1 and S1c.

- Owns: `apps/api/src/dictation-vocabulary.ts` (new), the RPC in `packages/contracts/src/rpc.ts` and `apps/api/src/router.ts`, passing `context` in `transcribeVoice`, the `beforeText` cap.
- Behaviour: the list contains the actor's roster bot names, their own contacts' names (space and user match) and titles of tickets the actor's board access returns (title only), deduplicated and capped; no `Project` source; another space's names and another member's contacts never appear; context is passed only under S1c's consent gate and only to a provider that uses it; nothing is stored.
- Tests first: Postgres test for scoping (two spaces, two users, a ticket the actor cannot see) in the style of `inbox-agent.postgres.test.ts`; unit test for cap and dedupe.

### S5. Wispr Flow meetings as a second MeetingSource (conditional)

Story: Faster. Prerequisites: Granola #437 (the `Meeting` table and `MeetingSource`) and Granola S3 #439 (the sync job and provider registration); follow #438's emulator pattern for fixtures. Step 0: connect once on a dev stack, record `tools/list` and the OAuth registration method, and pin `INTEGRATION_PRESETS.wisprflow` to the real read tools, replacing the `readOnlyHint` or read-verb heuristic. If the MCP output shapes cannot be mapped deterministically, stop after pinning the allowlist and file a follow-up.

- Owns: `packages/contracts/src/integration-agent.ts` and `packages/contracts/src/wispr-flow.ts` (exact allowlist, remove the heuristic and its TODO), `packages/contracts/src/integration-agent.test.ts` (the existing Flow cases), `packages/adapters/src/wispr-flow-meeting-source.ts` (new, a `MeetingSource` over the MCP read tools) and its test, a fake Flow MCP server for the conformance test beside the Granola emulator, and the registration of a second provider with the Granola sync job (#439). The meeting binds to the user's `McpServer` row (nullable `mcpServerId` on `Meeting`, as the Granola plan will define), not a `Connection`, and the Granola meetings tools are offered to the Wispr Flow agent as well (the agent-tool selection stays in Granola's S4, #440; this slice adds only the Flow agent to its allow condition if that slice has not). Does not touch the existing tile in `apps/web/src/lib/integrations.ts`.
- Behaviour: only allowlisted read tools are callable, even with all tools allowed; the source maps Flow meetings (summary, notes, attendees, transcript when readable) into the neutral shape and writes `Meeting` rows with `provider: "wisprflow"`, idempotent by external id; a mapping error is typed and writes no rows; transcripts the account may not read (sharing rules) sync as summary only; every query is scoped to `spaceId` and `userId`; meeting text stays untrusted data; Flow's server is read-only and cannot return dictation history, which the PR states rather than implies.
- Tests first: the shared `MeetingSource` conformance suite from #437 against the fake Flow MCP server; preset allow and deny cases for each pinned tool and a made-up name; an invented-fixture mapping test including a summary-only meeting.

### S6. Manual checklist for real Flow

Story: Trustworthy (do not claim what CI cannot see). Docs only. Owns `docs/wispr-flow/manual-checklist.md`: a script for a person with a Flow account to dictate into the web composer, the Electron composer, the iPhone composer and the Elio call surface; to try Flow in Rakazo's password, token and secret inputs and record whether it read them; to dictate during an active call; record Flow version, OS, result, and anything that fell back. No real figures.

## Waves and shared-file ordering

1. S0, then S1 and S2 in parallel (they share no file).
2. After S1: S1b, then S1c (S1c needs the selection from S1b); S4 after S1c, independent of S3a and of API access; S5 independent of the dictation slices but after Granola #437 and #439.
3. S3a after S1b and S1c, and only with Wispr API access (blocked; the issue stays filed). S3b after S3a (shares `dictation.ts` and `call-session.ts`).
4. S6 last, run on real devices.

Shared files: `apps/api/src/voice.ts` (S1, S1b, S1c, S4, then S3a), `packages/adapter-kit/src/interfaces.ts` and `types.ts` (S1; the Granola epic's S1 adds `MeetingSource` to the same files, so whichever lands second rebases), `apps/api/src/router.ts` and `packages/contracts/src/rpc.ts` (S1b, S4; Granola S6 touches them too), `packages/contracts/src/ai-consent.ts` and `apps/api/src/ai-consent.ts` (S1c only), `packages/adapters/src/voice-factory.ts` (S1, S3a), `apps/web/src/lib/dictation.ts` (S3b only now), `apps/web/src/lib/call-session.ts` and `apps/mobile/lib/call-session.ts` (S3b only), `packages/db/prisma/schema.prisma` (S1b, and Granola S1/S5), `packages/contracts/src/integration-agent.ts` (S5; the Granola epic edits the same file for its own preset) and the `Meeting` table and sync job owned by Granola #437 and #439 (S5 consumes them).

## Tests and verification

All tests are offline and deterministic: fake HTTP servers for the API, `expo-speech-recognition` injected the way `apps/mobile/lib/dictation.ts` already allows, a scripted transcription provider. No test reaches Wispr or needs a Flow account. Real Flow behaviour (the hotkey, Context Awareness in the composer, the iOS keyboard, the API under load) is only checked by S6 and stays marked unverified until then. The desktop Playwright suite is not run locally (it steals focus on macOS); CI's virtual display runs it. Web UI changes follow the Storybook rule: the S1b Settings row gets a story and `pnpm design-system` is rerun.

## Security and tenancy

Credentials are per user and kept in the secret store like the other voice credentials. Recordings, and context fields when the provider uses them, go to the selected provider only under the current-version `voice` consent and only for that request; Rakazo stores no recording and no transcript except the message the user sends. Vocabulary sources are scoped as listed in Design 4: contacts by `spaceId` and `userId`, bots by the actor's roster, tickets by the actor's board access within the space. Not every source is user-private. The Flow API key is never sent to a client. The per-user daily cap and the size caps bound spend and abuse in a multi-process deployment because the counter is in Postgres, not in process memory. Text from Flow's MCP is untrusted data, and the MCP preset is read-only.

## Deliberately not built

A WebSocket streaming client (the REST path matches the current record-then-upload design; add it only if latency is measured to matter), reading or writing Flow's personal dictionary or dictation history (no documented route, and the MCP excludes history), scraping Flow's local files, a Rakazo-side transcript archive of what the user dictates, screenshots, page text or conversation history sent to any provider, a Flow-specific environment variable, client-side Flow tokens, transcoding on the server, Android-specific work (Rakazo's Android path follows the mobile parity plan; Flow on Android needs nothing from Rakazo), and an in-house dictation engine (the interface in S1 is where it would plug in).

## Open questions for the maintainer

1. Will you request Flow API access from Wispr? S3a and S3b are filed and blocked on it. A consumer Pro plan is not shown to include it.
2. The API hostname, rate limits and audio retention are not on any page read here. Ask Wispr when requesting access, and record the answers in the S3a PR. By maintainer decision S3a and S3b stay filed but blocked until access is granted.
3. Does Flow's MCP authorization work with Rakazo's MCP OAuth client? The pages say browser sign-in with no API key but do not name the registration method. S5 step 0 answers it. (The existing tile uses the generic MCP flow; this is unverified.)
4. Resolved by review: Rakazo has no composer dictation, so there is no switch and no detection.
5. Resolved: S5 builds on the shared meetings store owned by the Granola epic (#444); it waits for #437 and #439.
6. Which Flow hotkey does the maintainer use? S2 checks Rakazo's shortcuts against it; the help center's hotkey page (https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts) was listed but not read for this plan.
7. Does Flow Notetaker's weekly limit on the Free plan matter for S5? Pricing pages differ by date; re-check before telling users which plan they need.
