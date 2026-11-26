# Native iOS build plan (waves for parallel implementers)

Written 2026-10-28 against `main` 4fb16c667 and issues #412–#427. It turns [plan.md](plan.md) into waves that several implementers can work in parallel, each in its own worktree, with one owner per file. The build brief is [README.md](README.md), the UX decisions are in [ux/](ux/), and the boards are in [../design-system/ios/](../design-system/ios/).

## 1. Current state

Checked against `main` at `ea0164eb7` on 2026-11-14 by reading the code. Nothing was built or run for this update, so "Done" means the code and its tests exist, not that a simulator walk passed. The only walk is [2026-11-04](ux/walker/latest-report.md), which covered about 35 of 127 stories. Counts: 552 Swift Testing `@Test` cases (296 in `RakazoCore`, 128 in `RakazoAPI`, 127 in `Tests/PraciTests`). What iOS still lacks against the web app is in [parity/plan.md](parity/plan.md).

| Phase | Status | Evidence |
|---|---|---|
| 0 Scaffold #412 | Done; the app has been built and walked on a simulator | `apps/ios/project.yml` (iOS 26.0, Swift 6, `ai.praci.mobile`, `.dev` for Debug, test target `ai.praci.mobile.tests`), `Packages/{RakazoAPI,RakazoCore,RakazoUI}`, `RakazoUI/Tokens.swift`, `scripts/test.sh` (default destination still "iPhone 17"), `apps/ios/maestro/{sign-in,smoke,thread-scroll,meetings-record}.yaml`; the 2026-11-04 walk ran a Debug build. Not rechecked: lint config (`.swiftformat`, `.swiftlint.yml`) against the code. |
| 1 Contracts export #413 | Done, but the generated client is still unused | `packages/contracts/src/openapi.ts`, `openapi.json` now has 566 paths (was 488). `openapi-generator-config.yaml` still filters to `rpc_health`. Every screen calls `app.call("<path>")` (`App/AppModel.swift:63-90`) with hand-written `Decodable` models in `RakazoAPI/Models/` (20 files). |
| 2 Connect and sign in #414 | Done | `AuthenticationModel.swift`, `AuthenticationView.swift`, `ServerView.swift`, `KeychainSessionStorage.swift`, `SSOBrowser.swift`; authenticated RPC with space header and 401 handling in `RakazoCore/{RPCClient,AuthClient,HTTPTransport}.swift`; Account screens (`Settings/Account/`) with sign-out confirmation (`AccountScreen.swift:36-39`). Sign-in was walked on 2026-11-04; SSO, reset and session expiry were not. |
| 3 Home, spaces, manage (3a, 3b) | Done | `Home/`, `Spaces/`, `Manage/` (new agent and group, settings, archive, undo toast). |
| 4 Thread (read) | Done | `Thread/`, `RakazoCore/Thread/*`, `RakazoCore/SSE/*` with tests (`ThreadSnapshotReducerTests`, `SSEEventStreamTests`, ...). |
| 5 Composer and approvals (5a, 5b) | Done | `Thread/Composer/` (outbox in `SendQueue.swift`, `RakazoCore/Outbox.swift`), `Thread/Approvals/` (mail, MCP, choice, ask, secret, connect cards), `Shared/ConsentSheet.swift`. Streaming and approval cards were not walked (the demo had no model). |
| 6 Inbox (6a, 6b) | Done | `Inbox/` list, message, compose (`Compose/`, New message button at `InboxScreen.swift:33`), cleanup, to-dos. Real Gmail was not walked. |
| 7 Duo layouts | Code exists; not verified on a device | `DuoLayout` and the two-pane `NavigationSplitView` in `App/AppShell.swift:32-137`, `Tests/PraciTests/DuoLayoutTests.swift`. Needs Xcode 27.1 for a real display check. |
| 8 Team computer, artifacts, agent pages, routines (8a, 8b) | Done | `Computer/`, `RakazoCore/Computer/`, `Artifacts/`, `AgentPages/`, `RakazoCore/Pages/`, `Routines/`. A real Docker computer was not walked. |
| 9 Settings (9a, 9b) | Done | `Settings/{Account,Archived,Preferences,Models,Integrations,AIData,Rules,Voice}/`, usage (`UsageScreen.swift`), notifications preferences. |
| 10 Push | Server done; app has routing only, no registration | Server: `packages/adapters/src/apns-push.ts`, `registerPush` takes `platform` (`packages/contracts/src/rpc.ts:1720`). App: `App/NotificationRouter.swift` opens a tapped push (`PushTargetTests`), and unregisters on sign-out; its comment says registration is not done (lines 51-56). No `registerForRemoteNotifications` and no push entitlement in `project.yml`. |
| 11 Voice | Done | `Voice/`, `RakazoCore/Voice/{CallSession,Dictation,CallText,VoiceSupport}.swift`, `Settings/Voice/`, with tests. Microphone and speech were not walked. |
| 12 Business pages | Partly | Done: Finance (`Finance/`), Legal (`Legal/`), Data room (`DataRoom/`, upload in `DataRoomTransfer.swift`), Scanner (`Route.scanner`), Cap table (`CapTable/`, 177 lines, read only). **Not started:** Contacts, Investors updates, Calendar, Fundraising, Brex, Board, GTM; see [parity/plan.md](parity/plan.md). |
| Meetings (not in the original phases) | Done | `Meetings/` list, detail, recording (`CaptureController.swift`, `RecordSheet.swift`, `RecordingBar.swift`), `RakazoCore/Meetings/`, `maestro/meetings-record.yaml`. Recording was not walked. |
| 13, 14 | Maintainer | Need a physical iPhone and signing. Decided (owner, 2026-10-30): the native app's bundle id is `ai.praci.mobile`, with extensions under it (for example `ai.praci.mobile.widget`); Debug builds use `ai.praci.mobile.dev`. The Expo app keeps `ai.praci.app`. |

## 2. Defaults implementers assume

1. Proceed past the `status:blocked` label (owner request). DTOs tolerate contract churn (see conventions).
2. Minimum iOS 26.0.
3. No billing UI on iOS; usage is read-only.
4. No UI for missing APIs (space members, data-room share links, mail labels).
5. Board nouns win ("agent", "New agent"). Native Maestro flows live in `apps/ios/maestro/` and use accessibility identifiers.
6. No new third-party dependencies: markdown via `AttributedString(markdown:)`, images via `AsyncImage` or `AppModel.data(url:)` for authorised URLs, PDF via PDFKit, charts as a placeholder.
7. Hand-written `Decodable` DTOs; the generator filter stays at `rpc_health`.
8. Product defaults: first launch opens sign-in; creating an agent or group lands in its thread; thread paging loads on first-row appear; suggestion chips only fill the composer; approval cards are read-only in phase 4; mail approval is Save/Send; Inbox sections are Needs reply, Today, Earlier; Stop holds the composer's trailing slot and keeps the draft; reactions use the six-emoji row (J3); archive pops to Home with an Undo toast; Settings is one grouped list (J5); Connect a model leads with "Sign in" (J1); no mentions in v1; routines offer Pause and Edit only; a procedure that returns 404 shows "Not available on this server." once and hides its entry point.
9. Phase 7 preparation: `NavigationStack` now (marked `ponytail:` for the later `NavigationSplitView`), every toolbar item a `Label(title, systemImage:)`, no `#available(iOS 27…)`, no `ArrangementView`.

## 3. Shared files and ownership

- Lead only: `apps/ios/project.yml` (and Info.plist keys), `openapi.json`, `openapi-generator-config.yaml`, every `Package.swift` (except W0-1's one edit to `RakazoCore/Package.swift`), `.swiftlint.yml`, `.swiftformat`, `scripts/test.sh`. Never run `pnpm contracts:generate` in a task branch.
- `Sources/Praci/PraciApp.swift`, `App/*`, `AuthenticationModel.swift`: W0-2, then the lead (W4-C owns `PraciApp.swift` in wave 4).
- `RakazoCore/AuthClient.swift` and `HTTPTransport.swift`: W0-1 (W2-D in wave 2).
- `RakazoAPI/Sources/RakazoAPI/Models/<Feature>.swift`: one file per task, tests in `RakazoAPITests/<Feature>DecodingTests.swift`, fixtures `Fixtures/<feature>-*.json` recorded from the demo with placeholder names and emails.
- Screen stubs: W0-2 creates every screen type others reference, with a fixed `init`; later owners replace the body and keep the signature.

## 4. Environment

Lead, once: `xcodegen generate --spec project.yml`; `xcodebuild -resolvePackageDependencies ... -clonedSourcePackagesDirPath ~/Library/Caches/praci-spm`; one simulator per implementer (`xcrun simctl create "Praci-A" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro com.apple.CoreSimulator.SimRuntime.iOS-26-3`, …); `DEMO_SLOT=1 pnpm demo:up` (API http://127.0.0.1:3301), and `DEMO_SLOT=2 DEMO_NO_MODEL=1 pnpm demo:up` only when no-model states are needed.

Implementers, inside their worktree:

```sh
cd apps/ios && xcodegen generate --spec project.yml
X="xcodebuild -project Praci.xcodeproj -scheme Praci -destination platform=iOS\ Simulator,id=$SIM_UDID \
   -derivedDataPath DerivedData -clonedSourcePackagesDirPath ~/Library/Caches/praci-spm \
   -skipPackagePluginValidation -skipMacroValidation"
$X build && $X test
swift test --package-path Packages/RakazoCore
xcrun simctl install $SIM_UDID DerivedData/Build/Products/Debug-iphonesimulator/Praci.app
xcrun simctl launch $SIM_UDID ai.praci.mobile.dev -serverOrigin $API
maestro --udid $SIM_UDID test maestro/sign-in.yaml -e EMAIL=… -e PASSWORD=…
xcrun simctl openurl $SIM_UDID "rakazo://open/inbox"
xcrun simctl ui $SIM_UDID appearance light|dark
xcrun simctl io $SIM_UDID screenshot ../../test-report/ios/<task>/<screen>-<dark|light>.png
```

Look up schemas with `jq '.paths["/rpc/<path>"]' Packages/RakazoAPI/Sources/RakazoAPI/openapi.json`. Boards are `.dc.html`: read them for structure, copy and SF Symbols. At most about four `xcodebuild` processes at once. Implementers never start or stop demo stacks, never erase or shut down all simulators.

## 5. Waves

### Wave 0 (sequential)

- **L0 (lead):** section 4; make lint pass by config only (`.swiftformat --indent 2 --commas always`; disable `trailing_comma` and `opening_brace` in `.swiftlint.yml`; lint changed files only); `test.sh` flags; Info.plist keys (`NSMicrophoneUsageDescription` "Talk to your agent.", `NSSpeechRecognitionUsageDescription` "Turn your speech into messages."); `apps/ios/maestro/sign-in.yaml` (identifiers `email`, `password`, `customServer`, `serverAddress`); full `xcodebuild test`; sign in and out against slot 1 with screenshots. Closes #412 and #414 acceptance.
- **W0-1 authenticated RPC core:** owns `RakazoCore/{AuthClient, HTTPTransport, RPCClient (new)}.swift`, `RakazoCore/Package.swift` (path dependency on `../RakazoAPI`), `RakazoAPI/RPCEnvelope.swift` (Encodable request wrapper), `RakazoCoreTests/{Fakes, RPCClientTests}.swift`, `RakazoAPITests/Fixture.swift`. Delivers `HTTPRequest.timeout`, `AuthClient.authorized(path:method:body:contentType:spaceID:)` (bearer, `origin: rakazo://`, content-type, `x-rakazo-space-id`; returns request, generation, hadSpace), `AuthClient.handleUnauthorized` (no space + same generation → invalidate and `.unauthorized`; with space → `.spaceRejected`; a stale generation never signs out a newer session), `RPCClient.call<O>(_:input:spaceID:timeout:)` (`{"json": input}` to `/rpc/<procedure>`, 16 MB cap, `RPCEnvelope<O>`), `RPCError` (`server(code:status:message:)`, `notSupported` for 404, `unauthorized`, `spaceRejected`, `decoding`). Acceptance: `swift test` for both packages with a test per rule.
- **W0-2 app shell, routes and stubs (after W0-1):** owns `PraciApp.swift`, `AuthenticationModel.swift`, `AuthenticationView.swift`, `App/{AppModel, RootView, AppShell, Route}.swift`, `Shared/{Loadable, BotAvatarView (stub), ConsentSheet (stub)}.swift`, `RakazoUI/DynamicColor.swift`, `PraciTests/RouteTests.swift`, and the stubs. `AppModel` is `@MainActor @Observable`, injected with `.environment`; holds `authentication`, `spaceID` (UserDefaults `spaceID.<origin>`, cleared on server change and sign-out), `path: [Route]`, `showingSettings`; `call` retries once without the space on `.spaceRejected` and returns to sign-in with "Your session ended." on `.unauthorized`; `data(url:)`; `open(_:)`. `Route` cases: `thread(ThreadTarget)`, `inbox`, `inboxMessage`, `computer(botID:)`, `artifacts(botID:)`, `artifact`, `agentPage(botID:)`, `routines(botID:)`, `routine`, `botSettings`, `groupSettings`, `finance`, `legal`, `capTable`, `dataRoom`; `init?(url:)` accepts only `rakazo://open/...`. `Color.token(_:)` dynamic colors. `Loadable<T>` and `LoadableView`. Stubs (body `Text("<name>")`): `HomeScreen()`, `ThreadScreen(target:)`, `InboxScreen()`, `InboxMessageScreen(messageID:)`, `ComposeSheet(replyTo:forward:)`, `NewBotSheet(onCreated:)`, `NewGroupSheet(onCreated:)`, `BotSettingsScreen(botID:)`, `GroupSettingsScreen(groupID:)`, `AgentRowMenu(target:onChange:)`, `SettingsScreen()` (Sign out, identifier `signOut`), `ModelsScreen()`, `IntegrationsScreen()`, `AIDataSharingScreen()`, `ApprovalRulesScreen()`, `VoiceSettingsScreen()`, `ComputerScreen(botID:)`, `ArtifactsScreen(botID:)`, `ArtifactScreen(artifactID:)`, `AgentPageScreen(botID:)`, `RoutinesScreen(botID:)`, `RoutineScreen(routineID:)`, `FinanceScreen()`, `LegalScreen()`, `CapTableScreen()`, `DataRoomScreen()`, `BotAvatarView(name:avatar:size:)`, `ConsentSheet(procedure:onDone:)`. Acceptance: build and test; sign in to the Home stub; every `rakazo://open/...` URL shows its stub; sign out returns to sign-in.

### Wave 1 (parallel)

- **W1-A Home and spaces (3a):** `Home/**`, `Spaces/**`, `Models/{Home,Bot}.swift`. Ops `rpc_bootstrap`, `rpc_me`, `rpc_spaces_{list,create,rename,remove}`, `rpc_inbox_unreadCount`. Boards PH-Home, PH-Spaces, PH-Pages, PG-A-Home, PG-A-HomeNoModel, PG-B-Spaces, PG-B-NewSpace, DS-05-Lists; `ux/topics/home-spaces.md`, J4, J1. Rows push `Route.thread` with a context menu; New menu; space selection; pull to refresh; loading, error and partial states. Screenshots dark/light, no-model Home from slot 2, decoding tests.
- **W1-B Bot avatars:** `Shared/BotAvatarView.swift`, `RakazoCore/BotAvatar.swift` + tests; port `packages/core/src/bot-avatar-shapes.ts`, `parseBotAvatarValue`, `bot-avatar-colors.ts` and their tests. DS-07.
- **W1-C Thread core logic:** `RakazoCore/Thread/**`, `Models/Thread.swift`, tests; port `thread-snapshot-reducer.ts`, the progress folding in `events.ts`, `thread-message-updates.ts`, and `apps/mobile/lib/thread-unread.ts`, keeping test names.
- **W1-D SSE stream:** `RakazoCore/SSE/**` + tests; `URLSession.bytes` with `AuthClient.authorized`; comment, `message`, `done`, `error` frames; heartbeat (seq 0) never advances the cursor; 45 s watchdog; backoff 250 ms → 5 s; `resync()` before resubscribing from the highest seq; 401 frame ends with `.unauthorized`; injected clock; generic over the procedure. Port `thread-subscription.test.ts`.
- **W1-E AI consent and outbox core:** `RakazoCore/{AIConsent, Outbox}.swift` + tests; port `packages/core/src/ai-consent.ts`, `apps/mobile/lib/ai-consent.ts`, `outbox-disk.ts`, the send classification in `thread-feedback.ts` (408/425/429 requeue; 20 entries, 50 MB).
- **W1-F Inbox list (6a):** `Inbox/InboxScreen.swift`, `Inbox/List/**`, `Models/Inbox.swift`. Ops `rpc_inbox_list`, `rpc_inbox_refresh`, `rpc_inbox_markRead`, `rpc_inbox_archive`, `rpc_inbox_unarchive`, `rpc_inbox_actions_undo`. PH-Inbox, DS-05, `ux/topics/inbox.md`, J2. States: writes off, reconnect, rate limited, no account, never synced vs inbox zero. Port grouping from `apps/mobile/lib/inbox.ts`, `mail-inbox.ts`.
- **W1-G APNs provider (10, server side):** `packages/adapters/src/apns-push.ts` + tests; `registerPush` input gains `platform: z.enum(["expo","apns"]).optional()` (default expo); handler and token store in `packages/db`; worker composition. `node:http2` and ES256 JWT via `node:crypto`, server env credentials, behind `NotificationChannel`, fake transport in tests. Old clients without `platform` still register as Expo. The lead regenerates `openapi.json`.

### Wave 2

- **W2-A Thread read UI (4):** `Thread/**` with stubs `Composer/ComposerView(model:)`, `Approvals/ApprovalCardView(block:messageID:model:)`, `MessageActions(message:model:)`. Ops `rpc_threads_{get,messages,subscribe,markRead,markUnread}`. Text, image, file, steps, progress, working indicator, unread divider, Jump to latest, neutral placeholder for unknown kinds; group threads; toolbar Agent actions menu (`botActions`). Live update screenshot via curl `threads/send`.
- **W2-B Create and manage (3b):** `Manage/**`. Ops `rpc_bots_{create,get,update,archive,restore}`, `rpc_groups_{create,get,update,archive,restore}`, `rpc_botSections_{create,update,remove,setCollapsed}`. Identifiers `newBot`, `botName`, `create`.
- **W2-C Inbox message, compose, cleanup (6b):** `Inbox/InboxMessageScreen.swift`, `Inbox/{Compose,Cleanup,Todos}/**`, `Shared/SafeHTMLView.swift` (WKWebView, JavaScript off, navigation blocked, CSP `script-src 'none'; img-src data: https:`). Ops `rpc_inbox_{get,todos_list,todos_setDone,cleanup_list,cleanup_archive,unsubscribe,askAgent}`, `rpc_inbox_compose_{prefill,draftSave,send,discard}`. Never retry a send whose result is unknown.
- **W2-D Settings and account (9a):** `Settings/SettingsScreen.swift`, `Settings/{Account,Archived,Preferences}/**`, `AuthClient.swift` (change password, delete account). Ops `rpc_me`, `rpc_preferences_update`, `rpc_{bots,groups}_listArchived`, `rpc_{bots,groups}_restore`, `rpc_notifications_{preferences,updatePreferences}`, `rpc_usage_summary`.
- **W2-E Models, integrations, AI data, rules (9b):** `Settings/{Models,Integrations,AIData,Rules}/**`, `Shared/ConsentSheet.swift`. Ops `rpc_models_*`, `rpc_connections_*` (Safari, then poll complete every 2 s), `rpc_aiConsent_*`, `rpc_approvalRules_*`, `rpc_autoReview_*`. Never offer stdio MCP.
- **W2-F Team Computer (8a):** `Computer/**`, `RakazoCore/Computer/**`. Ops `rpc_computer_{status,screenUrl,heartbeat,takeover,release,boot}`; WKWebView with a `ReactNativeWebView` shim; port `apps/mobile/lib/computer.ts`, `computer-keyboard.ts`.

### Wave 3

- **W3-A Composer and send (5a):** `Thread/Composer/**`, `Thread/MessageActions.swift`. `rpc_artifacts_create` (base64, 10 MB, at most 4, HEIC to JPEG), `rpc_threads_send` (`clientNonce`, `artifactIds`, `replyToMessageId`, `replyQuote`), `rpc_threads_stop`, `rpc_threads_react`; outbox; consent check before send. `apps/ios/maestro/smoke.yaml`: sign in, create agent, send.
- **W3-B Approvals (5b):** `Thread/Approvals/**`. `rpc_threads_answer`, `rpc_mcp_assignments_{approve,dismiss}`, `rpc_onboarding_{choose,dismissFocus}`; secret asks with `SecureField`, never logged or stored.
- **W3-C Artifacts, agent pages, routines (8b):** `Artifacts/**`, `AgentPages/**`, `Routines/**`. `rpc_artifacts_{list,listSpace,getById,listVersions,remove}`, `rpc_pages_get`, `rpc_routines_{list,history,update}`, `rpc_runs_list`.
- **W3-D Finance (12a):** `Finance/**`, `Models/Finance.swift`. `rpc_finance_*`; integer cents; non-USD outside totals; Hide amounts.
- **W3-E Legal and Cap table (12b):** `Legal/**`, `CapTable/**`. `rpc_legal_*`, `rpc_investors_capTable`, `rpc_carta_agent`.
- **W3-F Data room (12c):** `DataRoom/**`. `rpc_dataRoom_*`; streaming upload to `/api/data-room/upload`; content and thumbnail downloads; no share chips.

### Wave 4

- **W4-A Voice (11):** `Voice/**`, `RakazoCore/Voice/**`, and `Thread/ThreadScreen.swift` for the call button in this wave. Port `call-session.ts`, `dictation.ts`.
- **W4-B Voice settings:** `Settings/Voice/**`; `rpc_voice_*`.
- **W4-C Push tap routing (10, app side):** `App/NotificationRouter.swift`, `PraciApp.swift`; test with `xcrun simctl push`.
- **W4-D Offline snapshots (optional):** `RakazoCore/Cache/**`, snapshot stores; 100 messages, 40 chats, 20 MB; wipe on space, server or session change.

## 6. Conventions

- One `@MainActor @Observable final class <Feature>Model` per screen with `Loadable` state calling `app.call`. Pure logic in RakazoCore (`Sendable`, no UIKit). Swift 6 strict concurrency; no `@unchecked Sendable` or `nonisolated(unsafe)` without a one-line reason.
- DTOs: `Decodable, Sendable, Identifiable`; a comment with the operationId; non-required fields optional; dates as ISO strings; unknown enum values decode to `.unknown(String)`; never invent a field (check with `jq`).
- Errors: show the server message; `.notSupported` shows the default line; never auto-retry non-idempotent calls; pass `clientNonce`/`spawnKey`.
- The token lives only in the Keychain through `AuthClient`; never log tokens, secret answers or email bodies; no `print` in shipped code.
- System controls first (`List`, `Form`, toolbar `Label`s, sheets with detents, `confirmationDialog`, `alert`, `swipeActions`, `contextMenu`, `refreshable`, `searchable`, `ContentUnavailableView`). `Color.token(...)` only. Glass only on floating controls, one prominent action per screen. Dynamic Type styles.
- Accessibility: icon buttons use `Label`; camelCase `.accessibilityIdentifier`s; check large text.
- English literals as `LocalizedStringKey`; no fragment concatenation.
- Swift Testing, offline and deterministic; ported tests keep their names; fixtures from the demo with placeholders.
- Each task commits on its own branch in its own worktree; no push, no PR; never touch `apps/mobile`; never run `swiftformat` in write mode.

## 7. Risks and lead checks

- Edits outside owned paths (`git diff --name-only` against the ownership list).
- `contracts:generate` or `swiftformat` churn.
- Invented fields: every DTO has a recorded fixture; spot-check with `jq`.
- Simulator and demo contention: one simulator per task; only the lead runs demo stacks.
- iOS 27 / Duo APIs: `grep -rn "iOS 27\|ArrangementView" apps/ios`.
- Silenced concurrency: grep `@unchecked`, `nonisolated(unsafe)`.
- Secrets in logs: grep `print(`, `Logger`, `os_log`, `token` in the diff.
- Unseen screenshots: the lead opens every PNG (dark, light, large text).
- Colours and glass: grep `Color(red`, hex literals, `glassEffect`.
- Each wave merges into `ios/wave-N`: `xcodegen`, full `xcodebuild test`, `swift test` per package, lint changed files, install, sign in, walk every new screen, screenshots into `test-report/ios/wave-N/`; then one PR per wave to the fork, stating what could not be tested (Duo, push registration, real VNC, audio, signing).
