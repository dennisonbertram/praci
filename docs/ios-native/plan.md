# Native SwiftUI iOS app: incremental build plan

How to build the native app described in [README.md](README.md) in small, shippable steps. Each phase is one or more pull requests that leave `main` working and the Expo app untouched. Design source: [docs/design-system/ios](../design-system/ios/README.md).

## Principles

- The Expo app keeps shipping until the native app reaches parity on the core flows (sign-in, home, thread, inbox, settings). Android stays on Expo.
- The server and contracts change only where the native client needs it, and every server change keeps the Expo and web clients working.
- Shared logic is ported from `packages/core` with the same test cases, so both implementations agree.
- Each phase ends with unit tests, a simulator run of the real flow against a local server with a synthetic test account, and screenshots of the new screens.

## Phase 0: Scaffold

- `apps/ios/` with an XcodeGen `project.yml` (the generated `.xcodeproj` is not committed), Swift 6 language mode, iOS 26 minimum, bundle id `com.rakazo.app` with a separate development bundle id for local builds.
- SwiftPM packages: `RakazoAPI`, `RakazoCore`, `RakazoUI`. Unit test targets with Swift Testing.
- SwiftLint and SwiftFormat config; a `pnpm ios:test` script that runs `xcodebuild test` on a simulator.
- Design tokens: generate `RakazoUI/Tokens.swift` from `@rakazo/ui-tokens` so colors keep one source of truth.

Done when: an empty app builds and its tests pass on the simulator.

## Phase 1: Contracts export (server side)

- Add a script in `packages/contracts` that walks `appContract`, converts each input and output schema with `z.toJSONSchema()`, and writes an OpenAPI 3.1 document (`POST /rpc/<path>` with the `{json}` wrapper).
- A check that fails when the committed document is stale, like `pnpm design-system:check`.
- `swift-openapi-generator` runs as a build plugin in `RakazoAPI`. Hand-written decoders cover `ProductEvent` payloads and the `MessageBlock` union, keeping unknown kinds.

Done when: generated models decode recorded responses from a local server in a contract test.

## Phase 2: Connect and sign in

- Server selection (origin rules, `rpc/health` probe), `/api/auth/capabilities`, email sign-in and sign-up, token in the Keychain, the `origin: rakazo://` header, the session-generation guard, sign-out, 401 recovery.
- SSO through `ASWebAuthenticationSession` and the Expo authorization proxy, as in `apps/mobile/lib/sso.ts`.
- Port the tests in `apps/mobile/lib/{session,endpoint,sign-in,sso}.test.ts`.

Done when: a synthetic account signs in and out on the simulator against a local server.

## Phase 3: Home and spaces

- `bootstrap`, `me`, `spaces.list`, the space header, the Personnel list with sections, the Inbox summary row, bot avatars with the eight shipped shapes.
- Outer display layout with the side toolbar where available; on other iPhones the standard top bar.

## Phase 4: Thread, read only

- `threads/get`, paging with `threads/messages`, the SSE reader with cursor, heartbeat, 45 s watchdog and backoff.
- Port `reduceThreadSnapshot` and live progress folding from `packages/core` with their test cases.
- Render text (markdown through Textual), image and file blocks, tool steps, the working indicator, the unread divider. Unknown block kinds show a neutral placeholder.
- Saved-chat snapshot on open, replaced by the server snapshot.

## Phase 5: Thread, write

- Send with attachments (`artifacts/create`, then `threads/send`), the durable outbox and retry bubble, reactions, replies and quotes, stop.
- Approvals: ask cards (allow, always, deny), mail approval (approve and deny first, edit-and-send after), secret asks that are never stored, MCP approval, choice cards.
- AI data consent prompt, porting `aiDataUsesForProcedure`.

Done when: the Maestro smoke flow (sign in, create bot, send a message) passes on the native app with the same accessibility labels.

## Phase 6: Inbox

- List with Needs reply, Today and Earlier; filters and search; message view with HTML in a no-network web view; archive, mark read, compose, reply, forward; to-dos.
- Never retry a send that returns `unknown`.

## Phase 7: iPhone Duo and Liquid Glass layouts (needs Xcode 27.1)

- `NavigationSplitView` for the inner display (⅓ sidebar + ⅔ detail), vertical toolbars with icon and title on every item, the half-folded even split, nothing interactive in the fold.
- `ArrangementView` for leaf screens (Team Computer: screen plus controls), laptop pose layouts, Duo previews and Device Hub checks.

## Phase 8: Team Computer, artifacts, agent pages, routines

- `WKWebView` with the screen capability URL, status polling, heartbeat, URL renewal without reload, take control and release, the keyboard bridge.
- Artifact list and previews (sandboxed HTML, markdown, PDF, images), agent pages and lists, routine detail and history.

## Phase 9: Settings and integrations

- Account (notifications, appearance, delete account), models, voice, integrations (Safari plus polling `connections.complete`), AI data sharing, archived bots, change password.

## Phase 10: Push through APNs (server and app)

- Server: an APNs provider in `packages/adapters` behind the existing push interface, chosen by token type; `notifications/registerPush` accepts a platform field (`expo` or `apns`) while staying compatible with old clients; worker sends to both. Credentials come from server environment variables, never the repo.
- App: register the device token, route taps (group before bot, switch space first), suppress banners for the open thread.
- Offline tests with a fake APNs transport.

## Phase 11: Voice

- On-device dictation with the 1.2 s silence endpointer and the upload fallback, the call loop with barge-in, `threads/endCall`, voice settings. Port `call-session.ts` and `dictation.ts` behaviour with tests.

## Phase 12: Finance, Legal, Cap table, Data room

- The four pages from the design boards, with every provider-missing state (not connected, model blocker, no consent, reconnect). Hide amounts on device, including chat finance cards. Data room upload through `POST /api/data-room/upload`.

## Phase 13: Platform extras

- Live Activities for running agents (Dynamic Island, vertical on Duo), App Intents ("Ask an agent"), a share extension that sends to an agent or the data room, widgets. These need a physical device; the Duo simulator cannot run extensions.

## Phase 14: Release

- TestFlight through Xcode Cloud or local fastlane. iPhone Duo and standard iPhone screenshots.
- Switch the App Store record from the Expo build to the native build once phases 2 to 9 reach parity; keep the Expo app for Android.

## What this machine needs before and during the build

Checked on 2026-10-19:

| Item | Now | Needed | When |
| --- | --- | --- | --- |
| macOS | 15.7 (Sequoia) | macOS Tahoe 26.6 or later, required by Xcode 27.1 | Before phase 7; phases 0 to 6 can start on the current Xcode |
| Xcode | 26.3 (iOS 26.3 SDK, Swift 6.2) | Xcode 27.1 with the iOS 27.1 SDK and the iPhone Duo simulator | Before phase 7 |
| Simulator runtimes | iOS 26.3 | iOS 27.1 including iPhone Duo | With Xcode 27.1 |
| XcodeGen, SwiftLint, SwiftFormat, Maestro, gh | Installed | — | — |
| xcbeautify | Missing | Optional, for readable `xcodebuild` output | Phase 0 |
| fastlane | Missing | Only if not using Xcode Cloud | Phase 14 |
| Code signing | 2 identities present | An Apple Developer team that can sign `com.rakazo.app`, development provisioning for local device builds | Phase 0 for device builds; simulator builds need none |
| App Store Connect API key | Unknown | For TestFlight uploads; kept outside the repo | Phase 14 |
| APNs auth key | Unknown | For the server push provider; server environment only | Phase 10 |
| Physical iPhone (ideally iPhone Duo) | Unknown | For push, Live Activities, widgets, extensions and fold testing | Phases 10 and 13 |
| Local server | Dev stack on the usual local port | A synthetic test user and space with a connected model, separate from any real mailbox, so automated runs never touch live mail | Phase 2 onward |
| Disk space | 105 GB free | About 40 GB for Xcode 27.1 and runtimes | Before phase 7 |

For Claude to build and verify each phase without manual steps:
- Permission to run `xcodegen`, `xcodebuild` (build and test), `xcrun simctl` (boot, install, launch, screenshot) and `maestro`. Simulators can run headless through `simctl`; the Simulator app window is only needed for manual checks.
- Test credentials for the synthetic account in a local env file outside the repo.
- A decision on CI: GitHub Actions are off on the fork, so verification is local unless Xcode Cloud is set up.

## Open decisions carried from the brief

- Minimum iOS version (26 recommended).
- Billing on iOS: in-app purchase or "manage on web".
- Missing server APIs the designs assume: space member management, data-room share links, mail labels.
