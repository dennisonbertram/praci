# Native SwiftUI iOS app: build brief

What a native SwiftUI client for Rakazo needs, gathered from the current code (API, contracts, Expo app) and Apple's iOS 27.1 and iPhone Duo documentation. The design reference is [docs/design-system/ios](../design-system/ios/README.md).

Status: research only. Nothing here is built. Items marked *(inference)* were read from code but not run.

## 1. Recommendation

Build a native SwiftUI app under the same bundle id and App Store record as the Expo app, with an iOS 26 minimum and the Xcode 27.1 SDK. Gate iPhone Duo APIs behind `if #available(iOS 27.1, *)`.

Why native rather than more Expo:
- The Expo app is already a thin client over one typed RPC API. It has one small Swift module and no widgets, share extension, Live Activities or App Intents, so there is little native code to migrate.
- Liquid Glass and iPhone Duo work best with system containers. Apple's Duo guidance says custom bars are not moved to the vertical side bar; React Native draws its own bars *(Expo Router native headers may work; not tested)*.
- The hard part is porting the shared TypeScript logic in `packages/core`, not the screens. That logic has tests that can serve as the spec.

Cost of going native: losing over-the-air JS updates (`eas update`), a second client to keep in parity with web, and a new signing and release pipeline. The cheaper alternative is to keep Expo and add native SwiftUI modules for the thread screen, Live Activities and widgets.

## 2. Server and transport

- Server: `apps/api` (Hono + oRPC), handlers in `apps/api/src/router.ts`. A separate worker (`apps/worker`) runs jobs, agent runs and push. Postgres, with LISTEN/NOTIFY for realtime fan-out across API processes. Caddy proxies `/api/*` and `/rpc/*` to the API.
- Every call is `POST {base}/rpc/<namespace>/<procedure>` with body `{"json": input}` and response `{"json": output}`. Nested procedures use `/` (`inbox/compose/send`).
- Errors: non-2xx with `{"json": {"code", "status", "message"}}`. Show `message`. Codes in use: BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND, UNAUTHORIZED, SERVICE_UNAVAILABLE, BAD_GATEWAY, NOT_IMPLEMENTED.
- Headers on every call: `authorization: Bearer <token>`, `x-rakazo-space-id: <space>` (when chosen), `origin: rakazo://` (required by Better Auth's origin check), `content-type: application/json`.
- Limits: 16 MB request body on `/rpc/*`, 64 KB on `/api/auth/*`. Mobile uses an 8 s timeout and a 16 MB response cap.
- No API versioning. `health` returns a fixed version. Servers are self-hosted and can lag, so the client must treat a 404 on a newer procedure as "not supported" and tolerate missing optional fields.
- Idempotency is per procedure through a client nonce: `threads.send`, `threads.react`, `threads.answer`, `artifacts.create`, `routines.testRun` take `clientNonce`; `bots.create` takes `spawnKey`; compose uses `clientId`.
- Pagination differs per procedure (`threads.messages` by `before`/`around` seq, `inbox.list` by `pageToken`, data room and artifacts by `cursor`, notifications oldest-first by `since`/`cursor`).

## 3. Contracts and Swift models

- The contract is `appContract` in `packages/contracts/src/rpc.ts`, built with `@orpc/contract` and zod 4 schemas in sibling files (`domain.ts`, `events.ts`, `inbox.ts`, `finance.ts`, `legal.ts`, `carta.ts`, `data-room-api.ts`, `notification.ts`, `attachments.ts`, and others).
- There is no OpenAPI or JSON Schema export today.
- Proposed codegen: a small Node script walks `appContract`, runs `z.toJSONSchema()` on each procedure's input and output schema, and emits an OpenAPI 3.1 document describing `POST /rpc/<path>` with the `{json}` wrapper. Feed it to Apple's `swift-openapi-generator` as a SwiftPM build plugin. Add one contract test that decodes recorded real responses.
- Write by hand: the `{json}` envelope, the SSE reader, the `ProductEvent` payload decoding (payload is keyed by `type`), and the `MessageBlock` union (discriminated on `kind`) with a tolerant decoder that keeps unknown kinds.
- Awkward mappings: discriminated unions, "exactly one of `botId` or `groupId`" targets, ISO date strings, nullable vs optional, money as integer cents (finance) or decimal strings of minor units (legal), legal dates as `YYYY-MM-DD`.

## 4. Authentication and connection

Better Auth under `/api/auth/*` (`packages/auth/src/index.ts`), bearer plugin.

- Before sign-in: `GET /api/auth/capabilities` returns `{sso, passwordAuth, passwordReset, resetUrl, billing}`. Old servers return a legacy shape; treat it as password-only.
- Email and password: `POST /api/auth/sign-in/email`, `POST /api/auth/sign-up/email`. Sign-up can return "verification required" with no session. Minimum password length 8. Rate limit 10 per 15 minutes.
- Token: read `token` or `session.token` from the JSON body; fall back to the `better-auth.session_token` cookie. Store it in the Keychain only. Clear the selected space before saving a new token.
- SSO (one optional OIDC provider): `POST /api/auth/sign-in/social` with `{provider:"oidc", callbackURL:"rakazo://sign-in", disableRedirect:true}` and header `x-skip-oauth-proxy: true`; read the `better-auth.oauth_state` cookie; open `/api/auth/expo-authorization-proxy?authorizationURL=…&oauthState=…` in `ASWebAuthenticationSession` with callback scheme `rakazo`; parse the token from the callback's `cookie` parameter; confirm with `GET /api/auth/get-session`. Follow `apps/mobile/lib/sso.ts` exactly.
- No refresh tokens. Sessions use Better Auth defaults *(inference: 7 days, extended on use)*. A 401 on an authenticated call without a space header signs the user out; a session-generation counter must stop stale 401s from signing out a newer session.
- Change password returns a replacement token that must be saved. Account deletion (`/api/auth/delete-user`, password or emailed code or fresh SSO) already meets App Store rule 5.1.1(v).
- Custom server: origin only (scheme, host, port). `http` only for loopback, `.local`, private and Tailscale ranges. Probe with `POST /rpc/health` and require `json.ok === true`. Changing servers wipes the token, space and caches.
- Space selection: `x-rakazo-space-id`; the server checks membership on every call. On a 401 with a space header, re-probe without it to recover from a stale space.
- AI data consent: some procedures fail with "Review AI data sharing in Account settings before continuing." The procedure-to-data-use map is `aiDataUsesForProcedure` in `packages/core/src/ai-consent.ts`; port it and prompt before sending. Data room and legal have their own consent procedures.

## 5. Realtime and the thread

- Transport is SSE over oRPC, not WebSocket. `POST /rpc/threads/subscribe` with `accept: text/event-stream` and `{botId|groupId, cursor}`. Frames are `data: {"json": ProductEvent}` separated by blank lines; ignore `[DONE]`.
- `ProductEvent` is `{id, spaceId, threadId, botId, seq, type, runId?, createdAt, payload}`. About 45 types: `thread.message.created/updated/reaction`, `thread.progress`, `thread.ask`, `thread.choice`, `thread.computer`, `run.started/waiting_input/completed/failed/cancelled`, `computer.takeover.*`, `pins.updated`, `heartbeat`, and more (`packages/contracts/src/events.ts`).
- Heartbeat every 20 s with `seq: 0`; never advance the cursor on it. Reconnect after 45 s of silence. On every drop: fetch `threads/get`, then resubscribe from the highest `seq` seen, with backoff 250 ms doubling to 5 s. In Swift: `URLSession.bytes(for:)` plus a frame splitter and a watchdog.
- Snapshot: `threads/get` returns `{threadId, cursor, messages, olderCursor, lastReadSeq, run, activeRuns, computer, members}`. Older pages through `threads/messages`.
- Port target: `reduceThreadSnapshot` in `packages/core/src/thread-snapshot-reducer.ts` (shared by web and mobile), plus `events.ts` (live progress folding) and `thread-subscription.ts`.
- Streaming text: `thread.progress` events carry `delta` or `text` and build a synthetic `progress:<runId>` message that the final `thread.message.created` replaces. Mobile hides streamed text by default (a "Response streaming" preference) and shows tool steps.
- Message blocks (`kind`): text (markdown), image, file, ask, choice, card, app_connect, connect, computer, voice_call, meta, progress, steps, subagent, child_bot, cloud_agent, skill_draft, chart (Observable Plot spec), mcp_approval, emails, finance, handoff, channel and bot messages.
- Sending: upload each attachment with `artifacts/create` (base64, 10 MB, up to 4), then `threads/send {target, text, artifactIds, dataRoomItemIds, mentions, replyToMessageId, replyQuote, clientNonce}`. Without a connected model the server returns "Connect a model to start a run".
- Durable outbox (port `apps/mobile/lib/outbox-disk.ts` and `thread-feedback.ts`): states queued, pending, failed, refused; unreachable or 429 re-queues; other 4xx refuse; keep the accepted `seq` until the echo arrives.
- Reactions: six fixed reactions through `threads/react`. Replies and quotes: `replyToMessageId` and `replyQuote`. Messages are not editable. Read state: `lastReadSeq`, `threads/markRead`, `threads/markUnread`.

## 6. Approvals

All approvals are message blocks answered through RPC; the run waits in `waiting_input`. The client renders and relays and makes no policy decisions.

- Tool and write approval: an `ask` block with `approvalEffectId` and actions `allow`, `always`, `deny`. Answer with `threads/answer {target, runId, messageId, answer, clientNonce}`. A second answer returns CONFLICT.
- Mail approval: `ask.mail` (`mail_draft` or `mail_send`, recipients, subject, body, outcome). Edit-and-send uses `answer: "allow"` plus `mail: {to, cc, bcc, subject, body}`. Outcomes: sent, saved, unknown, failed.
- Secret asks (`input: "secret"`): never log, cache or persist the value. Login secrets also send `username`.
- MCP approval: `mcp/assignments/approve` or `dismiss`. If OAuth is needed, send the user to the web app.
- Choice cards (onboarding): `onboarding/choose` and `onboarding/dismissFocus`.
- Rules: `approvalRules.*`, `autoReview.*`. Connector writes are off by default (`connections.setWrites`, `mcp.servers.setWrites`), and each write still asks.

## 7. Features and their APIs

| Area | Procedures | Notes for the client |
| --- | --- | --- |
| Bootstrap | `bootstrap`, `me`, `spaces.list` | `me.needsModel` means the user must connect a model first |
| Bots, groups, sections | `bots.*`, `groups.*` (2-6 bots), `botSections.*` | Avatar `color` is hex, `#hex::shape_N`, or a data URL; parse like `parseBotAvatarValue` |
| Inbox | `inbox.list/get/refresh/markRead/archive/unarchive/feedback`, `inbox.compose.*`, `inbox.todos.*` | Needs reply, Important and categories are client groupings over row fields. Never auto-retry a send that returns `unknown`. `MAIL_WRITES_DISABLED` turns writes off |
| Mail attachments | `GET /api/inbox/messages/:id/attachments/:attachmentId` | Remote images go through a signed proxy; render HTML in a no-network web view |
| Finance | `finance.*` | Integer cents, USD only. Mercury and Brex connect through MCP OAuth. Hide amounts is client-only; mask chat finance cards too |
| Legal | `legal.*` | Runs only with the user's own OpenRouter key; show `modelBlocker` |
| Cap table | `carta.*` | `snapshot: null` until Carta is connected |
| Data room | `dataRoom.*`, `POST /api/data-room/upload`, `GET …/content`, `GET …/thumbnail` | Upload raw bytes up to 50 MB; items process asynchronously; search highlights use U+0001/U+0002 as plain-text markers; no share links |
| Artifacts | `artifacts.*` | Preview by MIME type: sandboxed HTML, markdown, PDF, images; others download or share |
| Integrations, MCP | `connections.*`, `mcp.*`, `integrationSetup.*`, `capabilities.*` | Connect: open `authorizationUrl` in Safari, then poll `connections.complete` every 2 s. MCP OAuth is web-only. Never offer `stdio` MCP on iOS |
| Routines | `routines.*`, `runs.list` | New routines start inactive and need a trigger |
| Team Computer | `computer.*` | See section 8 |
| Voice | `voice.*`, `POST /api/voice/speak`, `POST /api/voice/transcribe` | See section 8 |
| Notifications | `notifications.*` | `glance` feeds sidebar badges; `subscribe` is SSE |
| Search | `search.query` | Jump with `threads.messages({around})` |
| Usage, billing | `usage.*`, `billing.*` | Billing only when `me.billingEnabled`; checkout opens in the browser |

When a provider is missing, the client must still work: no model, no consent, no connector (empty catalog, `not_connected`, SERVICE_UNAVAILABLE), reconnect needed, and deployment switches (mail writes off, boards flag, billing, password or SSO off).

Not available to a native client: desktop-only settings RPC, Electron features, server-to-server webhooks, the screen-target endpoint, and dev-only routes.

## 8. Voice and Team Computer

- Voice has no WebRTC. A call is a turn loop: on-device dictation (`SFSpeechRecognizer`, with the app's own 1.2 s silence endpointer and an upload-and-transcribe fallback), then `threads/send`, then wait for the run to settle, then speak the reply (`/api/voice/speak` mp3, or on-device speech when the user prefers). Barge-in stops speech. `threads/endCall` files the summary. Port `apps/mobile/lib/call-session.ts` and `dictation.ts`. Voice needs AI consent for `voice`.
- Team Computer is a noVNC page. `computer/screenUrl` returns a one-hour capability URL; load it in `WKWebView`. Poll `computer/status` about every 2 s, call `computer/heartbeat` every 60 s, and renew the URL at 50 minutes without reloading the view. Take control with `computer/takeover` (15-minute lease) and give it back with `computer/release {reason: done|skipped}`. The keyboard bar diffs text into commands and runs them with `evaluateJavaScript("window.rakazoComputerKeyboard?.run(…)")`; listen for the ready message with `WKScriptMessageHandler`. Do not reimplement VNC.

## 9. Push notifications (needs a server change)

The server sends only through Expo's push service and stores Expo push tokens (`notifications/registerPush`, worker `ExpoPushProvider`). A native app either embeds the Expo notifications SDK or the server gains an APNs provider that accepts raw device tokens. Payload `data` carries `{kind, botId, threadId, groupId?, spaceId, deliveryId}` or `{kind:"notification", notificationId, surface, link}`. Tap routing: group wins over bot; switch space first; ignore when signed out. No notification categories or actions exist yet.

## 10. Local storage and caching

- Keychain: session token, server origin, selected space, preferences. Wipe every cache when the session, server or space changes.
- Saved chats: show the last saved snapshot instantly (last 100 messages per chat, 40 chats, 20 MB total), redact secret asks, and replace it with `threads/get` as soon as it arrives. The server always wins.
- Outbox for unsent messages (section 5). Nothing else works offline.

## 11. App structure

- SwiftPM packages: `RakazoAPI` (RPC client, SSE, auth, generated models), `RakazoCore` (ported reducer, outbox, consent map, mentions, unread logic), `RakazoUI` (design system from the boards), feature modules, then the app target and later extension targets sharing an App Group and Keychain access group.
- Swift 6 language mode, `@Observable` view models on the main actor, networking in actors.
- Navigation: `NavigationSplitView` for sidebar, list and detail (it adapts to the Duo inner display), `NavigationStack` inside. Use `ArrangementView` only on leaf screens such as the Team Computer (screen plus controls); Apple forbids nesting it with navigation containers.
- Toolbars: system `toolbar` with `ToolbarItemGroup`; every item needs an icon and a title so it can appear in the Duo's vertical bar. `.buttonStyle(.glass)` and `.glassProminent`, `GlassEffectContainer` for grouped custom controls, standard sheet detents.
- Markdown: Textual (successor to MarkdownUI, iOS 18+) for tables, code and selection; check performance on long streamed messages. Charts: Swift Charts from the Plot spec, or a web view. HTML artifacts: `WKWebView` with navigation blocked. Images: Nuke. PDF: PDFKit.
- Avatars: the eight shipped shapes from `packages/core/src/bot-avatar-shapes.ts` and the face and mood logic in `packages/core/src/avatar-face.ts`.

## 12. Build, test and release

- Xcode 27.1 needs macOS Tahoe 26.6 or later. GitHub Actions are off on the fork, so use Xcode Cloud or local fastlane for TestFlight.
- The Duo simulator cannot run widgets, Live Activities or StandBy; test those on hardware.
- App Store: iPhone Duo screenshots (outer 1398×2034, inner 2007×2853) become required from April 2027 for apps built with the 27.1 SDK.
- Tests: port the behaviours covered by `apps/mobile/lib/*.test.ts` and `packages/core` tests (session-generation safety, 401 recovery, SSE reconnect, outbox, unread divider, consent). Keep the accessibility labels used by the Maestro smoke flow (`apps/mobile/.maestro/smoke.yaml`) so it can drive the native app. Use `docs/mobile-parity/inventory.md` as the feature checklist.

## 13. Decisions

Decided:
- Build a native SwiftUI rewrite (not Expo plus native modules).
- Push: add an APNs provider to the server that accepts raw device tokens alongside Expo tokens.

Open:
3. Minimum iOS version (26 recommended; Textual needs 18+).
4. Whether to add the OpenAPI export to `packages/contracts` (needed for generated Swift models).
5. Billing on iOS: in-app purchase or "manage on web".
6. Whether to add missing APIs the designs assume: space member management, data-room share links, mail labels.
