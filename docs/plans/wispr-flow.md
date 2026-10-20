# Wispr Flow

Status: plan; no code yet. Written 2026-10-20 against `origin/main` at c39eac258. File and line references were read at that commit. Research on Wispr Flow was read from its public pages on 2026-10-20; see "What is confirmed about Wispr Flow" for sources and what is not confirmed.

## Summary

Wispr Flow is a dictation app that works in any text field, so Rakazo does not need an integration for people to speak into it. It has no connection to Rakazo today and it does not need one to work in the composer. What Rakazo can do is (1) make its own text fields work well with Flow and get out of the way (Mac, Windows, the Electron app, the iOS keyboard), (2) offer Flow as an optional transcription provider behind a provider-neutral interface, if the maintainer's organization is approved for Flow's developer API, and (3) sync Flow Notetaker meetings, read through the Flow MCP connection that already exists, into the shared meetings store the Granola epic builds.

The plan does not pretend that a paid Flow plan unlocks more than it does. As far as the public pages show, the consumer plan (Free, Pro, Growth, Enterprise) covers the app and the MCP server; the developer API is a separate product that needs approval from Wispr and is billed by usage. Flow's MCP server explicitly cannot read dictation history, and no public page says the user's personal dictionary can be read. So "what I dictate enriches Rakazo" is already true for the plain reason that dictated text becomes the user's message in Rakazo, and "the vocabulary Flow learns" is not reachable. The plan instead goes the other way: Rakazo supplies its own vocabulary (bot, contact, project names) to the API provider.

## User story

- **Faster.** The founder speaks into the composer, an agent's panel, a note or a reply and gets accurate, cleaned-up text, on web, in the desktop app and on the phone, using the dictation tool they already prefer.
- **Simpler.** Nothing to set up for the common case. If they use Flow, Rakazo's own mic button can be turned off with one switch; if they do not, the built-in dictation stays as it is.
- **Trustworthy.** Nothing is sent to Wispr by Rakazo unless the user chose the Flow provider and agreed to the voice disclosure. Dictated text is the user's own message and is handled as any typed message; text read from Flow's MCP is untrusted data.

Shipped experience: a founder with Flow installed taps into the composer, presses Flow's hotkey (or switches to the Flow keyboard on iPhone), speaks, and the words appear and send as usual. In Settings, Voice, one switch "Use system dictation" removes Rakazo's own mic and hold-to-talk so the two do not fight over the microphone. A founder whose organization has Flow API access can pick "Wispr Flow" as the transcription provider and get Flow's cleanup in Rakazo's own mic button and calls, with names from their workspace passed as hints. A founder who connects Flow's MCP can ask an agent about a recent meeting.

## What is confirmed about Wispr Flow

Sources were read on 2026-10-20. "Confirmed" means the page says it. Everything else is under Open questions.

| Fact | Source |
|---|---|
| Flow is a system-wide dictation app on Mac, Windows, iOS and Android. Free plan: dictation on all four, 2,000 words per week on desktop, limited weekly use on mobile. Pro: unlimited dictation, shared dictionary and snippets. Growth and Enterprise add SSO, HIPAA/BAA, admin model-training control. Prices on the page: Pro $15 monthly or $12 annual per user; Growth $23 or $18; Enterprise custom. | https://wisprflow.ai/pricing |
| iPhone: Flow is a custom keyboard. It needs microphone access, Full Access for the keyboard, and Live Activities. The user switches to it with the globe key. It inserts text into the current field. For number pad, decimal pad, phone pad, email-address and numbers-and-punctuation fields Flow switches to the next keyboard. The article does not address password fields. Six Flow Shortcuts work with Action Button, Back Tap and Siri. | https://docs.wisprflow.ai/articles/1986921789-how-to-set-up-flow-shortcuts-for-iphone |
| Context Awareness (on by default, Mac and Windows) reads the active app category, the website in browsers, text before and after the cursor and selected text, and on screen text such as email recipients. It takes no screenshots. Password fields, numeric-only fields, URL bars and banking apps are excluded. Mac needs the Accessibility permission. On iOS it is limited to the focused text field and cannot be turned off. | https://docs.wisprflow.ai/articles/4678293671-feature-context-awareness |
| Data sharing: "Improve the model for everyone" and dictation cloud storage default to on; turning training off does not stop cloud processing, and Flow still uploads metadata (word count, duration, app, timestamp, edit statistics). Notetaker transcripts and summaries are always stored in Wispr's cloud. A signed BAA locks sharing off; Enterprise locks model training off. No retention period is given for dictation. | https://docs.wisprflow.ai/articles/9609615338-private-cloud-sync-and-data-sharing-preferences-in-wispr-flow |
| Remote MCP server at `https://api.wisprflow.ai/connect/mcp`, sign-in in the browser, no API key. Read-only. Readable: meeting summaries, notes, transcripts, attendees, tasks, scratchpad notes, calendar events and linked recordings. Not readable: dictation history, Notetaker chat history. The page does not name the OAuth variant, the tool names, or the dictionary. Needs Notetaker and MCP on the account (Mac and Windows). MCP is on by default and included on the Free plan per the pricing page. An active BAA blocks all MCP features. | https://docs.wisprflow.ai/articles/9551372685-connect-an-mcp-client-to-wispr-flow-remote-mcp-server, https://docs.wisprflow.ai/articles/4759919286-how-to-connect-wispr-flow-to-claude-chatgpt-and-other-ai-tools-mcp |
| A separate "Voice Interface API" turns speech into text. WebSocket (`/ws`, recommended) and REST (`/api`, slower). Auth is either an API key kept on the backend or short-lived client tokens minted by the backend. It is "only available by exclusive access": the organization must be approved by Wispr (contact address on the quickstart page), then keys are made in the developer platform. | https://api-docs.wisprflow.ai/introduction.md, https://api-docs.wisprflow.ai/quickstart.md |
| API request: `audio` is base64 16 kHz WAV, at most 25 MB or 6 minutes; optional `language` (ISO 639-1 list); optional `context` with `app` (`name`, `type` of `email`, `ai` or `other`), `dictionary_context` (words), `user_first_name`, `user_last_name`, `user_identifier`, `textbox_contents` (`before_text`, `selected_text`, `after_text`), `screenshot`, `content_text`, `content_html`, `conversation`. | https://api-docs.wisprflow.ai/request_schema.md |
| API billing is by usage tokens, charged after credits run out; the dashboard cannot set limits, so the caller must enforce them. Data retention for API audio is not stated. | https://api-docs.wisprflow.ai/usage_billing.md |

Not found on any official page: the API hostname, the WebSocket message schema in text form (the docs index lists the pages but this plan did not read them), an API rate limit, API data retention, whether Flow offers a way to import a dictionary, any "open in app" or URL scheme for Flow, any API for reading dictation history or the dictionary, and any statement that a consumer Pro plan includes API access. A third-party post (Scalekit) describes the same API and says the two surfaces (MCP, API) do not overlap; it was used only to cross-check, not as a source of facts.

## Integration route chosen, and why

Flow is two different things for Rakazo, so the plan has three small routes, each independent and each safe to skip:

1. **Compatibility (always).** The honest integration with the consumer Flow app is to be a good host for it: plain focusable text fields, no global shortcut that collides with Flow's, no competing microphone use, and a switch to hide Rakazo's own dictation. Flow needs nothing from Rakazo to work here, and Rakazo cannot know that Flow is installed, so the switch is manual. This is the part that serves the maintainer on day one.
2. **Provider (conditional).** The only programmatic way to get Flow's transcription into Rakazo's own mic button and calls is the Voice Interface API. It needs Wispr's approval and is billed separately from the consumer plan, so it ships as one provider behind a provider-neutral transcription interface, with the other existing providers on the same interface. If access is never granted, nothing else in the plan depends on it, and a future in-house dictation implements the same interface.
3. **Meetings (conditional, shared).** Flow's tile, private agent and a read-only preset already exist on `origin/main` (commit 9344d202a), so the remaining work is not a tile. It is to make Flow Notetaker meetings a second `MeetingSource` that fills the same `Meeting` table the Granola epic (#444) creates, so meetings from both tools are searchable and usable by one set of features.

Not chosen: a Flow SDK or plugin inside Rakazo (none is documented), scraping Flow's local history or dictionary files (undocumented, and would read private data), and importing Flow's dictation history (the MCP server excludes it).

## Current state in Rakazo (verified at c39eac258)

| Area | Fact |
|---|---|
| Web dictation | `apps/web/src/lib/dictation.ts` has two modes, `hold` and `endpoint`. It uses the browser's Web Speech API when `webSpeechAvailable()` is true (false in Electron, which has no speech key, `:48-60`), and otherwise records audio and posts it to `/api/voice/transcribe` (`:565`). |
| Server transcription | `transcribeVoice` in `apps/api/src/voice.ts:368` loads the user's default voice credential, requires the provider to implement the optional `VoiceProvider.transcribe` (`packages/adapter-kit/src/interfaces.ts:603`), caps the size, and calls it. The route is `/api/voice/transcribe` (`voice.ts:431`). Providers with transcription: ElevenLabs, OpenAI, Fish Audio; Cartesia has none (`packages/adapters/src/voice-factory.ts`, `transcribe` flag). `VoiceTranscribeRequest` is `{ audio, mimeType, apiKey, language, signal }` (`packages/adapter-kit/src/types.ts:666`). |
| Mobile dictation | `apps/mobile/lib/dictation.ts` uses `expo-speech-recognition` on device with the same 1.2 s silence endpointing; `apps/mobile/lib/call-session.ts:701` has the upload path to `/api/voice/transcribe`. |
| Elio | The voice agent has spawn key `voice-agent:<userId>` (`packages/contracts/src/voice-agent.ts`) and a call card (`apps/web/src/components/call/CallCard.tsx`, `apps/web/src/lib/call-session.ts`). A call is speech in, an ordinary agent chat out. |
| Consent | `AiDataUse` includes `voice`: "Your recordings are sent for transcription..." (`packages/contracts/src/ai-consent.ts`). Voice is gated by it already. |
| Settings | Voice settings exist (`voice.catalog`, `voice.status`, `voice.credentials`, `voice.setSpeechModel`, `packages/contracts/src/rpc.ts:1316`). Keys are stored per user as credentials. |
| MCP | The Flow tile already exists: `wisprflow` in `FIRST_PARTY_MCP` (`apps/web/src/lib/integrations.ts:176`), `packages/contracts/src/wispr-flow.ts` (endpoint, `isWisprFlowEndpoint`, `WISPR_FLOW_READ_NAME`), `INTEGRATION_PRESETS.wisprflow` in `packages/contracts/src/integration-agent.ts` with its tests (`integration-agent.test.ts:231`), and a private agent per connection. The preset counts a tool as a read by `readOnlyHint` or a read-verb name until the tool list is pinned (a TODO in `wispr-flow.ts`). Presets restrict tools per server (`packages/adapters/src/mcp-connector.ts`). |
| Memory | `MemoryDocument` is scoped by space, user and optional bot (`packages/db/prisma/schema.prisma:1055`). Nothing in this plan writes to it. |

## Design

### 1. A provider-neutral transcription interface

Today transcription is an optional method on a provider that also has to speak. A transcription-only provider like Flow cannot implement `VoiceProvider` (its `synthesize` is required). Add `TranscriptionProvider` to `packages/adapter-kit`: `describe()`, `verify(apiKey)`, `transcribe(request)`. `VoiceTranscribeRequest` gains an optional `context` with only provider-neutral fields: `appKind` (`email` | `ai` | `other`), `vocabulary` (string list, capped), `beforeText` (capped), `language`. Existing voice providers keep working: a small function adapts each `VoiceProvider` that has `transcribe` to `TranscriptionProvider` and ignores `context` fields it cannot use. `transcribeVoice` resolves the user's chosen transcription provider (default: the voice provider they already use), so nothing changes for anyone who does nothing. The catalog marks entries as speech, transcription, or both; the Flow entry is transcription-only.

A deterministic scripted transcription provider (like `scripted-voice.ts`) and one shared conformance test run against every provider with a fake HTTP server. The conformance test covers: empty audio rejected, oversize rejected, language passed, vocabulary capped, provider error becomes a user error with no key in the message, abort honored.

### 2. System dictation switch (compatibility)

A per-device preference "Use system dictation" (web and desktop in local storage; mobile in the existing local settings store) that hides the composer mic button and the hold-to-talk key, and stops `dictation.ts` from starting. The Call Elio button stays (calls are Rakazo's own audio loop; the switch label does not claim otherwise). It is per device because Flow is installed per device. It is not synced and not stored on the server. Why a switch and not detection: no page documents a way for another app to detect Flow, and an in-page guess would fail silently.

Other compatibility work, each checked in the slice:

- Composer fields stay ordinary editable elements with accessible names, because Flow inserts through the platform's text input and, on desktop, reads the field's surrounding text. Rakazo's rich composer is checked for an inserted multi-line, cleaned-up paragraph: it must keep the caret after the inserted text, keep the draft memory, and enable Send.
- No global shortcut in `apps/desktop` or the web app uses a key that Flow documents as its hotkey. The Flow hotkey list is read from the help center in the slice (open question below); until then the check is "no global shortcut registered by Rakazo that is not already documented in `apps/desktop`".
- On iOS the Flow keyboard is a system keyboard: the native composer must not set `keyboardType` to something that forces another keyboard except for number fields, must keep `autocorrect` and `contentType` defaults on the message field, and must allow third-party keyboards (no `secureTextEntry`).
- Password and one-time-code fields stay secure; Flow excludes them anyway.

### 3. Flow as a transcription provider (conditional on API access)

`packages/adapters/src/wispr-flow-transcription.ts` implements `TranscriptionProvider` over the REST endpoint first. REST is slower but one request per recording, matches the existing record-then-upload path and the 1.2 s endpointing, and needs no long-lived socket per user in a multi-process deployment. The WebSocket endpoint is deliberately not built (see not built).

- **Credential.** An API key per user in the existing voice credentials, entered in Settings, Voice like the other providers. The deployment hostname comes from a shared connection setting (the base URL is not on any public page we found), not from a Flow-specific environment variable. Client-side tokens are not used: the server proxies, so the key never reaches a browser.
- **Audio.** Flow takes base64 16 kHz WAV, at most 25 MB or 6 minutes; the browser records WebM. The web and mobile recorders get a 16 kHz mono WAV capture path used only when the Flow provider is selected; the server rejects other formats with a clear message rather than transcoding (the API server has no ffmpeg dependency and adding one is out of scope).
- **Context.** From `TranscriptionProvider` context: `appKind` maps to `context.app.type`, `vocabulary` to `dictionary_context`, `beforeText` to `textbox_contents.before_text`, `language` to `language`. No screenshot, `content_text`, `content_html` or conversation is ever sent.
- **Spend.** Flow's dashboard cannot cap spend, so the server enforces a per-user daily cap on recording seconds (a number in code, not environment), reusing the existing hosted pooled allowance if the hosted-service epic has landed, otherwise a simple counter row. This slice only needs the counter; it does not build billing.
- **Consent and disclosure.** The `voice` AI data use already says recordings are sent for transcription. The recipient list for that disclosure names the selected provider; Flow's entry says that text near the cursor is also sent when present. Nothing is sent before consent is given.

### 4. Vocabulary from Rakazo, not from Flow

`dictation.vocabulary` returns a capped, deduplicated list of names the user is likely to say: bot names, contact names the user can see, project and ticket titles, from tables already scoped by `spaceId` and `userId`. It is read per transcription request, not stored. It feeds `vocabulary` in the provider context. Private data stays on the user's own scope; another member's private contact or bot never appears. The same list can be offered to other providers that accept hints later. There is no promise that Flow's own dictionary is read or written: no public page documents either.

### 5. Untrusted text

- Text the user dictates into the composer is the user's own message and is treated like typing. No new trust level.
- Text read from Flow's MCP server (meeting notes, transcripts of other people speaking, calendar entries written by third parties) is untrusted data in agent prompts, the same as any MCP result. It is read-only by Flow's own design; the Rakazo preset also allows only read tools, with write tools absent from the allowlist.
- `beforeText` sent to a provider is capped and comes only from the field the user is dictating into; it is never stored by Rakazo with the transcription.

### 6. Flow meetings as a second `MeetingSource` (conditional)

The tile, preset and agent exist; this section adds only what is missing. Step 0 is to connect once on a dev stack, record `tools/list` and the OAuth registration method, and replace the `readOnlyHint` or read-verb heuristic in `INTEGRATION_PRESETS.wisprflow` with an exact allowlist of the real read tools. Then implement a `MeetingSource` (the neutral interface from Granola #437: list changed meetings, get one) over those MCP read tools, so Flow Notetaker meetings sync into the same `Meeting` table with `provider: "wisprflow"`. Vendor names appear only in the adapter and the composition root. The adapter calls the MCP server with the user's own connection, read-only. The offline test pattern is the emulator from Granola #438: a fake MCP server that answers the recorded `tools/list` and invented outputs. If the output shapes cannot be mapped deterministically (the help center documents capabilities, not fields), the slice stops after pinning the allowlist and files a follow-up; the existing tile and agent keep working either way.

## Shared meetings store (resolved)

The lead decided on one shared store. The Granola epic (#444) owns it: #437 adds the `Meeting` table and the provider-neutral `MeetingSource` interface, and #438 adds the emulator pattern for offline fixtures (see `docs/plans/granola.md` on branch `docs/granola-plan`). This plan defines nothing new for it and files no issue for it; S5 consumes it. Meetings stay private to the user who connected the source, with `spaceId` and `userId` on every row, as that plan specifies. A transcript store for dictation is deliberately not proposed: nothing here keeps what the user dictated beyond the message it becomes.

## Slices

Each is one PR from `origin/main` at c39eac258 or later. Waves are listed below the slices.

### S0. Commit this plan

Docs only. Owns `docs/plans/wispr-flow.md`. Done by this commit; no issue is filed for it.

### S1. Provider-neutral transcription interface

Story: Simpler, Trustworthy.

- Owns: `packages/adapter-kit/src/interfaces.ts` and `types.ts` (`TranscriptionProvider`, optional `context` on `VoiceTranscribeRequest`), `packages/adapters/src/voice-factory.ts` (adapter from existing voice providers, catalog `speech`/`transcription` flags), `packages/adapters/src/scripted-voice.ts` or a new scripted transcription file, `apps/api/src/voice.ts` (`transcribeVoice` resolves a `TranscriptionProvider`), `packages/contracts/src/domain.ts` (catalog entry shape, fields optional).
- Behaviour: existing ElevenLabs, OpenAI and Fish Audio transcription give identical results; a provider with no transcription still returns the current "does not transcribe" error; the context is accepted and ignored by providers that cannot use it; a shared conformance suite runs against every provider offline.
- Tests first: `packages/adapters/src/transcription-conformance.test.ts` (new), `packages/adapters/src/voice-factory.test.ts`, `apps/api/src/voice.test.ts` (or the existing voice tests).

### S2. System dictation switch and composer compatibility

Story: Faster, Simpler.

- Owns: a small preference module in `apps/web/src/lib` and `apps/mobile/lib`, the Settings, Voice row in web and mobile, `apps/web/src/lib/dictation.ts` (does not start when set), the composer in `apps/web/src/pages/Shell.tsx` and the native composer in `apps/mobile/app/thread.tsx` (hide mic and hold-to-talk), stories for the new row.
- Behaviour: with the switch on, no mic button, no hold-to-talk, no recognizer or recorder starts, Call Elio remains; with it off, behaviour is unchanged; an inserted multi-line paragraph keeps the caret after it, keeps the draft and enables Send; the preference is per device.
- Tests first: unit tests for the preference and for `dictation.ts` not starting; a web test that dispatches a text insertion (input event with a multi-paragraph string) into the composer and checks draft, caret and Send; mobile unit test for the control state.
- Copy: one switch label, "Use system dictation". The PR quotes it and says why it cannot be removed (no way to detect Flow) or revealed later (it is needed before the first conflict).

### S3a. Flow transcription provider (conditional on API access)

Story: Faster. Precondition: Wispr has approved an API key for the maintainer's organization and the hostname is known (open questions 1 and 2). If not, do not start this slice.

- Owns: `packages/adapters/src/wispr-flow-transcription.ts` and tests with a fake server, `voice-factory.ts` catalog entry, `apps/api/src/voice.ts` per-user daily seconds counter, the base URL connection setting.
- Behaviour: a recording is sent as base64 16 kHz WAV with the mapped context; over 25 MB or 6 minutes is rejected before sending; non-WAV is rejected with a clear message; the key is never in logs or errors; a provider error becomes a user error; the daily cap blocks with a message and does not call Wispr; calls are scoped to the actor's credential.
- Tests first: the shared conformance suite from S1 plus request-shape tests against a fake server written from the published request schema.

### S3b. WAV capture for Flow

Story: Faster. After S3a.

- Owns: web and mobile recorder paths that produce 16 kHz mono WAV when the selected transcription provider asks for it (`apps/web/src/lib/dictation.ts`, `apps/web/src/lib/call-session.ts`, `apps/mobile/lib/call-session.ts`), a small shared WAV encoder in `packages/core`.
- Behaviour: encoder output has a valid header and the right length for a known PCM buffer; the recorder switches format only for the Flow provider; other providers keep WebM.
- Tests first: encoder byte-level test in `packages/core`, recorder tests with a fake media stream.
- Unverified until run on device: mobile WAV capture quality and size.

### S4. Rakazo vocabulary as transcription hints

Story: Faster (names spelled right), Trustworthy (scoped, private).

- Owns: `apps/api/src/dictation-vocabulary.ts` (new), the RPC in `packages/contracts/src/rpc.ts` and `apps/api/src/router.ts`, passing `context` in `transcribeVoice`, the `beforeText` cap.
- Behaviour: the list contains the actor's visible bot, contact and project names only, deduplicated and capped; another user's or space's names never appear; `beforeText` is passed only when the provider's recipient disclosure was accepted; nothing is stored.
- Tests first: Postgres test for scoping (two spaces, two users) in the style of `inbox-agent.postgres.test.ts`; unit test for cap and dedupe.

### S5. Wispr Flow meetings as a second MeetingSource (conditional)

Story: Faster. Prerequisite: Granola #437 (the `Meeting` table and `MeetingSource`); follow #438's emulator pattern for fixtures. Step 0: connect once on a dev stack, record `tools/list` and the OAuth registration method, and pin `INTEGRATION_PRESETS.wisprflow` to the real read tools, replacing the `readOnlyHint` or read-verb heuristic. If the MCP output shapes cannot be mapped deterministically, stop after pinning the allowlist and file a follow-up.

- Owns: `packages/contracts/src/integration-agent.ts` and `packages/contracts/src/wispr-flow.ts` (exact allowlist, remove the heuristic and its TODO), `packages/contracts/src/integration-agent.test.ts` (the existing Flow cases), `packages/adapters/src/wispr-flow-meeting-source.ts` (new, a `MeetingSource` over the MCP read tools) and its test, a fake Flow MCP server for the conformance test beside the Granola emulator, and the sync registration that the Granola sync job (#437 follow-ups) exposes for a second provider. Does not touch the existing tile in `apps/web/src/lib/integrations.ts`.
- Behaviour: only allowlisted read tools are callable, even with all tools allowed; the source maps Flow meetings (summary, notes, attendees, transcript when readable) into the neutral shape and writes `Meeting` rows with `provider: "wisprflow"`, idempotent by external id; a mapping error is typed and writes no rows; transcripts the account may not read (sharing rules) sync as summary only; every query is scoped to `spaceId` and `userId`; meeting text stays untrusted data; Flow's server is read-only and cannot return dictation history, which the PR states rather than implies.
- Tests first: the shared `MeetingSource` conformance suite from #437 against the fake Flow MCP server; preset allow and deny cases for each pinned tool and a made-up name; an invented-fixture mapping test including a summary-only meeting.

### S6. Manual checklist for real Flow

Story: Trustworthy (do not claim what CI cannot see). Docs only. Owns `docs/wispr-flow/manual-checklist.md`: a script for a person with a Flow account to dictate into the web composer, the Electron composer, the iPhone composer and the Elio call surface; record Flow version, OS, result, and anything that fell back. No real figures.

## Waves and shared-file ordering

1. S0, then S1 and S2 in parallel (they share no file).
2. S4 after S1 (shares `apps/api/src/voice.ts`). S3a after S1, and only with API access. S5 independent of the dictation slices but after Granola #437 (and #438's emulator pattern).
3. S3b after S3a (shares `dictation.ts` and `call-session.ts` with S2, so after S2 too).
4. S6 last, run on real devices.

Shared files: `apps/api/src/voice.ts` (S1, S3a, S4 in that order), `packages/adapters/src/voice-factory.ts` (S1, S3a), `apps/web/src/lib/dictation.ts` (S2, then S3b), `apps/web/src/lib/call-session.ts` and `apps/mobile/lib/call-session.ts` (S3b only), `packages/contracts/src/integration-agent.ts` (S5; the Granola epic edits the same file for its own preset) and the `Meeting` table and sync job owned by Granola #437 (S5 consumes them).

## Tests and verification

All tests are offline and deterministic: fake HTTP servers for the API, `expo-speech-recognition` injected the way `apps/mobile/lib/dictation.ts` already allows, a scripted transcription provider. No test reaches Wispr or needs a Flow account. Real Flow behaviour (the hotkey, Context Awareness in the composer, the iOS keyboard, the API under load) is only checked by S6 and stays marked unverified until then. The desktop Playwright suite is not run locally (it steals focus on macOS); CI's virtual display runs it. Web UI changes follow the Storybook rule: the Settings row gets a story and `pnpm design-system` is rerun.

## Security and tenancy

Credentials are per user and encrypted like the other voice credentials. Recordings and surrounding text go to the selected provider only after the `voice` consent and only for that request; Rakazo stores no recording and no transcript except the message the user sends. Vocabulary is built from rows scoped to `spaceId` and `userId`. The Flow API key is never sent to a client. The per-user daily cap and the size caps bound spend and abuse in a multi-process deployment because the counter is in Postgres, not in process memory. Text from Flow's MCP is untrusted data, and the MCP preset is read-only.

## Deliberately not built

A WebSocket streaming client (the REST path matches the current record-then-upload design; add it only if latency is measured to matter), reading or writing Flow's personal dictionary or dictation history (no documented route, and the MCP excludes history), scraping Flow's local files, a Rakazo-side transcript archive of what the user dictates, screenshots, page text or conversation history sent to any provider, a Flow-specific environment variable, client-side Flow tokens, transcoding on the server, Android-specific work (Rakazo's Android path follows the mobile parity plan; Flow on Android needs nothing from Rakazo), and an in-house dictation engine (the interface in S1 is where it would plug in).

## Open questions for the maintainer

1. Will you request Flow API access from Wispr? S3a and S3b wait on it. A consumer Pro plan is not shown to include it.
2. The API hostname, rate limits and audio retention are not on any page read here. Ask Wispr when requesting access, and record the answers in the S3a PR.
3. Does Flow's MCP authorization work with Rakazo's MCP OAuth client? The pages say browser sign-in with no API key but do not name the registration method. S5 step 0 answers it.
4. Is "Use system dictation" acceptable as a manual switch, or should the desktop app try to detect a running Flow process (needs a process listing permission and is not documented as supported)?
5. Resolved: S5 builds on the shared meetings store owned by the Granola epic (#444); it waits for #437.
6. Which Flow hotkey does the maintainer use? S2 checks Rakazo's shortcuts against it; the help center's hotkey page (https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts) was listed but not read for this plan.
7. Does Flow Notetaker's weekly limit on the Free plan matter for S5? Pricing pages differ by date; re-check before telling users which plan they need.
