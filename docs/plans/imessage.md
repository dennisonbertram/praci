# iMessage through Photon and BlueBubbles

Status: approved plan; phases 1, 2, 3, 5, 6 and 7 done (notes at the end). Line numbers refer to `main` when written (2026-10-19). Vendor facts come from the official sources linked inline and were read on that date; they can change.

## Owner answers

| Question | Answer |
|---|---|
| Positioning | BlueBubbles is for the local, self-hosted install: one owner per install, configured per deployment (env) like Sendblue. Photon is for the hosted service. Both sit alongside Sendblue as messaging platforms; Photon does not replace it. |
| Address the owner texts | The Mac running BlueBubbles is signed in with a second Apple ID or number. The owner texts it like a contact. The Mac's own personal Apple ID is never used. |
| Agent tools (Goal C) | Yes, last. Agents may read and send iMessages, and every send needs an approval card. Because of the second-Apple-ID setup, these tools act only on that second account's conversations, not the owner's personal ones. |
| Photon config | Environment variables, like Sendblue. |
| SMS/RCS from linked addresses | Ignored. Only iMessage-transport messages trigger runs. |
| Photon disclosure | No extra "messages pass through Photon" line on the tile (the PR description and docs say it). |
| Finance and Legal agents | Blocked from Photon. |
| Approvals | Stay in the app; a short iMessage says an approval is waiting. No approve-by-reply. |
| Photon free tier | Documented as the self-host default. |

## Summary

Praci already has an external messaging surface, and one of its providers (Sendblue) is a hosted iMessage line. So this is not a new channel type. Add two providers to the existing `MessagingSurface`:

- **Photon**: a hosted iMessage line, through Photon's own MIT-licensed Chat SDK adapter, the same adapter family the surface already uses for Slack, Telegram, WhatsApp and Sendblue.
- **BlueBubbles**: the user's own Mac as the iMessage bridge, through a small Chat SDK adapter we write, because none exists on npm.

Inbound chat to an agent reuses the current identity, link-code, thread, nonce and outbox code unchanged. The new work is two adapters, per-provider webhook verification, a shared conformance suite, setup tiles, and (later) a notification channel and agent tools. Agent tools that read or send the owner's iMessages are not recommended for now (see "Goal C").

## What exists today

| Area | Fact |
|---|---|
| Interface | `MessagingSurface` (`packages/adapter-kit/src/interfaces.ts:504`): `platforms()`, `handleWebhook(provider, request)`, `onInbound(sink)`, `sendToThread`, `openDirectThread`, `sendTyping`. Conversations are opaque provider-prefixed thread ids such as `sendblue:...`, so orchestration never sees wire formats. |
| Implementation | `ChatSdkMessagingSurface` (`packages/adapters/src/chat-sdk-surface.ts:62`) wraps the Vercel Chat SDK (`chat`, pinned 4.40.0, `packages/adapters/package.json:34`). Each platform is a Chat SDK `Adapter` plus a few hooks (`directThreadId`, `participants`, `transport`, `peekStatus`). Webhook bodies are capped at 256 KiB (`chat-sdk-surface.ts:25`), and the 200 is only returned after the inbound sink finishes, so a sink failure becomes a 5xx and the vendor retries (`:243-262`). |
| Provider list | `messagingPlatformsFromEnv` (`packages/adapters/src/messaging-platforms.ts:83`). Sendblue is built at `:96-120` from `SENDBLUE_*` env vars (API key id and secret, signing secret, line number). Providers are deployment-wide and mounted only when their full credential set is present. Platform display names are in `packages/core/src/messaging-labels.ts:3`. |
| Inbound route | `/api/v1/messaging/webhook/:provider` (`apps/api/src/messaging-webhook.ts:14`). Verification happens inside each platform adapter. |
| Inbound routing | `createMessagingInboundHandler` (`apps/api/src/messaging-inbound.ts:68`), registered at `apps/api/src/app.ts:1004`. A 1:1 message looks up `MessagingIdentity` by `(provider, address)` (`schema.prisma:1475`, one `botId`, unique). Unknown senders are silent unless a link code redeems or `MESSAGING_OPEN_SIGNUP` is on (`messaging-inbound.ts:78-120`). Known senders reach `events.sendUserMessage` with `trigger: "messaging"` and `clientNonce: messaging:<provider>:<handle>` (`:150-160`), which is the replay protection. Group chats go through `handleChannelEvent` (`:484`). |
| Which agent answers | One agent per linked address. The user picks it with a short-lived link code (`MessagingLinkCode`, `tryRedeemLinkCode` `:307`) or `messaging.identities.setBot` (`apps/api/src/router.ts:6513`). |
| Outbound | Every text-bearing bot message of a messaging run is mirrored into the `MessagingOutbound` outbox (`messaging-delivery.ts:59`, unique `idempotencyKey = msg:<id>`), drained by the `messaging.deliver` worker job (`apps/worker/src/index.ts`), with 5 attempts and exponential backoff capped at 60 s (`messaging-delivery.ts:22`, `:466`). A cap of 140 consecutive outbound messages per identity (sendblue only) stops runaway sends (`:19`, `:377`). Delivery status arrives as webhooks (`peekStatus`). |
| Untrusted text | `trigger: "messaging"` is deliberately not in `OWNER_INITIATED_TRIGGERS` (`packages/adapters/src/mail-tools.ts:109`: user, follow_up, routine, skill, call_end). In `executor.ts:4250` `ownerOriginRun` is therefore false for messaging runs, and mail, calendar and Drive tools are off for them (`mailToolsAllowed`, `mail-tools.ts:118`). Group-name and sender labels are sanitized before reaching prompts (`packages/core/src/messaging-prompts.ts:36`). Approvals are decided and answered in the web app, not in the chat. |
| Notifications | `NotificationChannel { channel; describe(); send(envelope, endpoint, ctx) }` already exists (`interfaces.ts:447`), with `ExpoPushProvider` as its first implementation (`packages/adapters/src/expo-push.ts:85`). `docs/plans/notifications.md` puts `attention` deliveries through a Postgres outbox with per-channel `NotificationEndpoint` rows. |
| Config model | Messaging is env-only and deployment-wide. There is no per-user messaging configuration and no Integrations tile for it; Settings only shows link state (`apps/web/e2e/messaging-settings.spec.ts`). Per-user credentials live in `Secret` (`schema.prisma:1379`, encrypted `ciphertext`), referenced by `Connection.secretId` (`:937`). Deployment-owned credentials live in `IntegrationProviderConfig` (`:1671`). |
| Known gap | `ChatSdkMessagingSurface` uses `createMemoryState()` (`chat-sdk-surface.ts:71`). That is fine for stateless webhooks, but the new adapters must not rely on Chat SDK state across processes. |

## Research: Photon

**Which product.** "Photon" here is the company at photon.codes ("Bring Agents to the Interfaces Millions Already Use"), whose products are Spectrum (an SDK and platform that connects agents to iMessage, WhatsApp, Telegram and others), the managed iMessage lines behind it, and open-source kits ([photon.codes](https://photon.codes); GitHub org `photon-hq`). Other unrelated products share the name (for example a multiplayer game networking engine); I did not research them. Photon's own guide says Apple offers no public API for iMessage bots, so its lines run on Apple hardware Photon operates ([Photon, what is an iMessage API](https://photon.codes/blog/what-is-an-imessage-api-the-complete-guide-for-developers-and-businesses)). There is also a "Beta (2.0)" platform API at `api.photon.codes` ([docs index](https://photon.codes/docs/llms.txt)); this plan targets the Stable Spectrum product and flags the beta as a risk.

**Ways to integrate** (all from the [docs index](https://photon.codes/docs/llms.txt)):

1. `chat-adapter-imessage` 1.1.0, MIT, repo `photon-hq/vercel-chat-adapter-imessage`, peer `chat ^4.14.0` (npm metadata). Cloud mode takes a project id and secret plus a webhook secret; webhooks are recommended for serverless; self-hosted gRPC and local macOS modes exist ([Chat SDK integration page](https://photon.codes/docs/integrations/chat-sdk.md)). Supports DMs and file sending; reactions, edits and typing only in remote modes; plain text only (markdown stripped); a reply to a group works only if that group arrived over the gateway in the same session. Praci pins `chat` 4.40.0, so the peer range holds.
2. `spectrum-ts` 12.x, MIT: an in-process loop (`app.messages`) and `space.send`. It needs a long-running process, which suits a worker but not the stateless API process.
3. `@photon-ai/advanced-imessage` 2.3.0, MIT: low-level gRPC SDK with bearer token and `host:port`; covers messages, chats, groups, attachments, polls, reactions, edits, unsend, typing and read state, with streams (no webhooks) and event replay after a disconnect ([docs](https://photon.codes/docs/advanced-kits/imessage/getting-started.md)).

**Auth.** Project id and secret from the dashboard; REST project endpoints use `Authorization: Basic base64(projectId:projectSecret)` ([Spectrum OpenAPI](https://spectrum.photon.codes/openapi/json)). The OpenAPI spec I could read has no REST send-message endpoint; sending goes through the SDKs over gRPC (the part of the spec I could not read, characters 100000 onward, may differ). Cloud clients' tokens are renewed automatically by the SDK ([iMessage provider](https://photon.codes/docs/spectrum-ts/providers/imessage.md)).

**Webhooks.** One event today, `messages`; reactions arrive inside it. Body `{ event, space, message }`. Headers `X-Spectrum-Signature`, `X-Spectrum-Timestamp`, `X-Spectrum-Webhook-Id`. Signature is `v0=` plus the lowercase hex HMAC-SHA256 of `v0:<timestamp>:<raw body>` with the 64-character signing secret (shown once at registration), compared in constant time, with a 5-minute timestamp window. Delivery is at-least-once, up to 6 attempts with backoff, then dropped; dedupe on webhook id plus message id. HTTPS only, no private addresses, no redirects. Attachment bytes are not in the payload ([overview](https://photon.codes/docs/webhooks/overview.md), [verifying signatures](https://photon.codes/docs/webhooks/verifying-signatures.md)).

**Capabilities.** Cloud only: reactions (tapbacks), replies, edits, unsend, read receipts, typing, effects, group events; creating groups needs a dedicated line ([iMessage provider](https://photon.codes/docs/spectrum-ts/providers/imessage.md), [connection and routing](https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing.md)). SMS/RCS fallback is on all plans ([pricing](https://photon.codes/pricing)).

**Number, Mac, price.** No Mac needed for the cloud product. Free plan: shared-pool number, up to 10 users. Pro: $25/month, up to 100 users. Business: $250 per dedicated line per month. Enterprise: custom ([pricing](https://photon.codes/pricing); the page's comparison table was partly garbled, so confirm before relying on it). With a shared pool, each user is routed to a number that "may differ across recipients", and group chats and inbound group-change events are not supported on Free and Pro ([connection and routing](https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing.md)). The open-source option runs on your own Mac with your iCloud account.

**Rate limits.** REST API: 5 requests per second per project, HTTP 429 beyond that ([rate limit](https://photon.codes/docs/api-reference/rate-limit.md)). Messaging: 5,000 outbound per server per day (hard limit), 50 new conversations per line per day, and 100+ messages in a short burst can get a line flagged; automated-looking patterns are flagged regardless of content ([deliverability](https://photon.codes/docs/best-practices/imessage-deliverability.md)).

**Terms.** The Terms of Service (https://photon.codes/terms-of-services) require the customer to disclose that an end user is talking to an AI agent (3.6), keep consent and opt-in records and honor opt-outs (3.6), and not automate critical legal, health or financial advice without professional supervision (3.8(b)). Photon may suspend service over complaints (7), is not liable for provider bans or blocked messages (3.5, 9), and takes a broad license to Message Content for providing the service and for aggregated data used to improve its models (5.1, 5.2). Praci's Finance and Legal agents fall under 3.8(b), so those agents should not be reachable over Photon without review.

**MCP.** The Photon MCP server (`https://mcp.photon.codes/mcp`, local `@photon-ai/mcp`) manages the Photon account (projects, numbers, billing, listing received messages); it is not a message-send integration for Praci ([MCP page](https://photon.codes/docs/beta/ai-tools/mcp.md)). Not used here.

## Research: BlueBubbles

- **What.** An open-source macOS server (Apache-2.0, `BlueBubblesApp/bluebubbles-server`, about 1.1k stars) that reads the Messages database and exposes a REST API and socket.io for clients ([repo](https://github.com/BlueBubblesApp/bluebubbles-server)). It must run on macOS (Sierra or newer, with iMessage signed in); Linux hosts need a macOS VM ([server docs](https://docs.bluebubbles.app/server/)).
- **Stability.** Latest release v1.9.9 (16 May, year not shown on the page) is a maintenance update refreshing the proxy binaries; v1.9.8 (20 Nov) added a native Apple Silicon build and auto-restart. None of the five latest releases mention macOS 26 ([releases](https://github.com/BlueBubblesApp/bluebubbles-server/releases)). The Private API is documented as tested on macOS 10.13 through 13 only ([Private API](https://docs.bluebubbles.app/private-api/)). Treat compatibility with the newest macOS as unverified.
- **Auth.** The server password goes in the query string as `guid` (aliases `password`, `token`); headers are not read; the comparison is not constant-time and there is no rate limiting ([REST docs](https://docs.bluebubbles.app/server/developer-guides/rest-api-and-webhooks), `authMiddleware.ts` in the server repo). So the password appears in URLs, access logs and tunnel logs.
- **REST** (`httpRoutes.ts`, all under `/api/v1`): `POST /message/text` (`chatGuid`, `tempGuid`, `message`, `method` apple-script or private-api, `effectId`, `subject`, `selectedMessageGuid`, `partIndex`), `POST /message/attachment` (multipart file), `POST /message/react`, `POST /chat/query`, `POST|DELETE /chat/:guid/typing`, `POST /chat/:guid/read`, webhook CRUD at `/webhook`, `GET /ping`, `GET /server/info`. The official docs site points to a Postman collection for full detail; I read the source routes instead.
- **Webhooks.** The server POSTs `{ type, data }` as JSON to each registered URL for the event types the webhook subscribes to (or `*`), among them `new-message`, `updated-message`, `message-send-error`, `typing-indicator`, `chat-read-status-changed`, `participant-added/removed/left` and `group-name-change` ([`events.ts`](https://github.com/BlueBubblesApp/bluebubbles-server/blob/master/packages/server/src/server/events.ts), [REST and webhooks](https://docs.bluebubbles.app/server/developer-guides/rest-api-and-webhooks)). There is **no signature, no retry and no ordering guarantee** (`webhookService`, one POST attempt, failures logged only). A missed webhook is lost, so the adapter needs a catch-up poll (`POST /message/query` with an `after` timestamp, or `/chat/query`; confirm the exact query body in the Postman collection during phase 1).
- **Reaching a local server.** Built-in proxies are Cloudflare, ngrok and zrok (release notes); the docs also cover port forwarding with dynamic DNS, Caddy, Nginx, Cloudflare with a custom domain and Tailscale ([sitemap](https://docs.bluebubbles.app/server/sitemap.md)). Firebase (FCM) is how the BlueBubbles mobile app learns the server URL and gets push; it is not needed for a custom REST client. Browser clients need HTTPS.
- **Private API.** Optional. Typing, reactions, replies, edits, unsend, effects, mark read and group management need it, and it needs System Integrity Protection disabled, "at your own risk" ([installation](https://docs.bluebubbles.app/private-api/installation)). Without it, the server can send plain text and attachments through AppleScript and receive messages. Disabling SIP on the owner's personal Mac is a significant security trade-off; the plan must not require it.

## Goals

### A. Chat with agents over iMessage (build)

Reuse the existing flow. The owner texts the line (Photon) or their own Apple ID's conversation (BlueBubbles); a link code binds the address to an agent; each message wakes that agent's thread; the reply is mirrored back through the outbox. "Choosing which agent answers" already works through link codes and `identities.setBot`.

One BlueBubbles specific: the server runs on the owner's own Mac signed in as the owner's Apple ID. Messages the owner sends from their other devices to a contact are also visible there. The adapter must only treat an incoming message (`isFromMe = false`) from a handle on the owner's allowlist as a command, and must ignore everything else (including the owner's own outgoing messages). Without this, BlueBubbles would read the whole inbox as chat input. To talk to an agent the owner sends a message to a dedicated chat: either a second Apple ID or phone number the Mac is signed into, or the "message yourself" chat. The setup tile must say which one is used; phase 1 should support only the self-chat and an explicit allowlist of chat guids, nothing broader.

### B. Notification channel (build, after A)

`ImessageNotificationChannel implements NotificationChannel` (`channel: "imessage"`), sending `attention` notifications to the owner's linked address by calling `MessagingSurface.sendToThread` on the identity's DM thread. It needs no new transport. Constraints: only to an already-linked, verified identity; only inside an open conversation (the owner has texted in the last 24 hours, to avoid unsolicited first contact, which Photon's deliverability guide says gets lines flagged); text only, title plus body, no link unless it is a public URL; share the rate limits in `notifications.md` and count against the 140 consecutive-outbound cap.

### C. Agents reading or sending iMessages (build last, with approvals)

Approved by the owner, as the last phase. Scope, stated plainly: the tools act on the conversations of the **second Apple ID or number** the BlueBubbles Mac is signed into (or on the Photon line's conversations), never on the owner's personal Apple ID, because the Mac does not hold that account. The BlueBubbles tools must refuse any chat guid that is not on that account's allowlist.

- Read tools: list chats and read messages of allowed chats. All message text is untrusted data, wrapped as such, and never makes a run owner-originated.
- Send tool: every send needs an approval card showing the exact recipient and text, like `mail.send`. No "always allow" for sends.
- Not available to routine or messaging-triggered runs (the same exclusion mail tools have, `mail-tools.ts:118`), and off by default per agent.
- Third parties' texts are prompt-injection input and contain other people's personal data; Photon's terms (3.6) require AI disclosure and opt-in, so the Photon variant waits for owner review of that wording.

## Design

### One interface, no new one

Do not add `ImessageTransport`. The existing seam is `MessagingPlatform` (`chat-sdk-surface.ts:32`) over a Chat SDK `Adapter`, and that already abstracts the vendor. Adding a second abstraction for iMessage only would duplicate it and fork the outbox and inbound code. The two additions are:

| Provider id | Adapter | Source |
|---|---|---|
| `photon` | `chat-adapter-imessage` (cloud mode, webhook) | Photon's package, wrapped in `messaging-platforms.ts` the way `createSendblueAdapter` is. Vendor import stays in `packages/adapters`. |
| `bluebubbles` | `createBlueBubblesAdapter` in `packages/adapters/src/bluebubbles-adapter.ts` | Ours: about 300 lines implementing the Chat SDK `Adapter` (webhook parse and verify, `postMessage`, `decodeThreadId`/`encodeThreadId`, `isDM`) on `fetch` against the BlueBubbles REST API. No new dependency. |

Both register as `capabilities: { direct: true, groups: false, typing: <false for BlueBubbles without Private API> }`. Groups stay off in v1 for both (the existing group-channel flow was built around Sendblue's roster events; Photon's shared pool has no group support at all).

`providerLabel` (`messaging-labels.ts:3`) gets both ids; both display as "iMessage" so the product shows one name and the Settings list does not mention vendors. Where a user has two providers linked, the Settings row shows the provider only when it disambiguates.

### Shared offline conformance suite

Add `packages/testkit/src/messaging-platform-conformance.ts`, run against every platform in `packages/adapters` (Sendblue, Photon, BlueBubbles, and a fake). The suite takes a factory that returns `{ adapter, fakeVendor }` and checks:

1. A valid signed or authenticated inbound DM becomes exactly one `MessagingInboundMessage` with the expected `provider`, `handle`, `from` (normalized E.164 or email), `isDirect`, `content`, and `threadId` that round-trips through `decodeThreadId`.
2. A bad signature, wrong token, stale timestamp or oversize body is rejected (4xx) and produces no inbound event.
3. A replayed delivery (same handle) is accepted but resolves to one `clientNonce`.
4. The adapter's own outgoing messages and the owner's other-device messages produce no inbound event.
5. `post` sends one request with the expected body, returns the vendor handle, and surfaces vendor 429/5xx as a thrown error (so the outbox retries) and a permanent 4xx as a non-retryable one.
6. Long text is split into ordered chunks below the provider limit, and a chunk boundary never splits a surrogate pair.
7. An attachment-only message yields `mediaUrl` and empty `content`.

Fakes: a local HTTP stub for BlueBubbles; for Photon, signed payload fixtures built with the documented HMAC scheme and a stubbed gRPC client (the adapter's own tests already do this; the suite only needs the webhook and send boundary).

### Inbound

**Photon.** The adapter verifies `X-Spectrum-Signature` with the webhook signing secret and the 5-minute window (the adapter does this when `webhookSecret` is set; the conformance test proves it, and the platform factory refuses to mount without the secret, as Telegram does today at `messaging-platforms.ts:178`). Dedupe: the nonce `messaging:photon:<message id>` already makes redelivery harmless. Photon retries up to 6 times and then drops, so a long API outage loses messages; document that and rely on 5xx-on-failure semantics already in `dispatchWebhook`.

**BlueBubbles.** No signature exists, so authenticate the webhook ourselves:

- Register the webhook URL as `/api/v1/messaging/webhook/bluebubbles?token=<random 32 bytes>` (BlueBubbles stores the URL as given). The token is generated by Praci, shown once, stored hashed or encrypted, and compared in constant time. It is a different secret from the server password.
- The adapter then fetches the message by guid from the BlueBubbles server (`GET /message/:guid`, authenticated with the server password) instead of trusting the webhook body. A forged post then cannot inject content, only trigger a fetch of a message that really exists. This removes most of the weakness of an unsigned webhook at the cost of one request per message.
- Replay: nonce `messaging:bluebubbles:<message guid>`.
- Missed webhooks: a worker job polls for messages since a stored cursor every minute and feeds them to the same sink (idempotent through the nonce).
- Serve the webhook only over HTTPS, and rate-limit by token failures.

**Sender mapping and trust.**

- Normalize handles first: E.164 for phone numbers, lower-cased for email Apple IDs. Without it `+1 (555) 123-0001` and `+15551230001` become two identities.
- An address is linked to a user only by redeeming a link code issued in the web app (existing behavior). Unknown senders get no reply (existing behavior, no oracle). `MESSAGING_OPEN_SIGNUP` stays off for iMessage providers; refuse it for `bluebubbles` entirely, since that line is the owner's own Apple ID.
- A linked address is "the owner's handle" only for the purpose of choosing the user and agent. It does **not** make the run owner-originated: `messaging` stays out of `OWNER_INITIATED_TRIGGERS`, so mail, calendar and Drive tools stay off and every consequential tool still needs an approval card in the web app. This matches how Sendblue already behaves.
- iMessage sender ids are authenticated by Apple, but SMS and RCS fallback senders can be spoofed. Photon and Sendblue both report the transport (`transport`, `messaging-platforms.ts`). Only `iMessage` transport messages may trigger agent runs; SMS/RCS messages from a linked address are ignored with a one-time reply that the agent is reachable on iMessage only. (Open question 4.)
- All inbound text, filenames and attachment URLs are untrusted data. Inbound media is passed as a URL in text (existing, `messaging-inbound.ts:84`); no ingestion in v1. Photon attachment URLs may be short-lived and BlueBubbles attachments need the server password, so v1 passes only a note ("[attachment: image/jpeg]") and no fetchable URL. Never put the BlueBubbles server URL or password in a URL given to a model.
- Approvals: the agent run cannot answer approval cards from iMessage. A run that pauses for approval should send one short iMessage ("Needs your approval in Praci") through the existing outbox, and the approval stays in the web/desktop/mobile app. Approving by replying "yes" in iMessage is **not** proposed: it would make approval depend on a spoofable channel for SMS fallback and on text parsing.

### Outbound

- Everything goes through `MessagingOutbound` and the `messaging.deliver` job (existing): idempotency key `msg:<id>`, 5 attempts, backoff, claim-then-send. No change.
- Chunking: iMessage has no hard 160-character limit, but very long messages arrive poorly. Split at paragraph, then sentence boundaries into chunks of at most about 2,000 characters, sent in order, with the outbox row's idempotency key plus a chunk index so a retry resends only unsent chunks (store `chunksSent` on the outbox row, or one row per chunk). Plain text only (Photon strips markdown; BlueBubbles sends it literally), so run replies through a markdown-to-plain-text step for these providers.
- Rate limits: reuse the 140-consecutive-outbound cap for every iMessage provider (today it is `identity.provider === "sendblue"` at `messaging-delivery.ts:377`; generalize to an `iMessage` provider set). Add a per-provider send spacing (Photon: stay far below 5 requests per second per project and the 5,000/day/server hard limit; pace to at most one message per second per conversation). Only reply in conversations the owner started; never initiate (50 new conversations per line per day, and cold outreach flags lines).
- Typing: `capabilities.typing` true for Photon; true for BlueBubbles only when its server reports Private API enabled (`GET /server/info`). Cosmetic and best-effort, as today.
- Delivery status: Photon read receipts and BlueBubbles `updated-message` events can feed `peekStatus`; v1 skips them (the sendblue status path remains the only one).
- Idempotency at the vendor: BlueBubbles `tempGuid` = the outbox idempotency key (plus chunk index), so a retry after a timeout does not send twice if the server echoes the guid. Photon: confirm in phase 2 whether the SDK supports a client message id; if not, a timeout after a successful send can duplicate a message, which is the same risk Sendblue has today.

### Configuration and multi-tenancy

This is the main design decision, because the two providers differ:

- **Photon is a shared service**, like Sendblue: one deployment-owned project credential (project id, secret, webhook signing secret) serves many users, each with its own linked address. Config belongs in the environment for self-hosters (like `SENDBLUE_*`) and, for a hosted Praci, in `IntegrationProviderConfig` (`schema.prisma:1671`, encrypted). Phase 2 follows the Sendblue pattern: `PHOTON_PROJECT_ID`, `PHOTON_PROJECT_SECRET`, `PHOTON_WEBHOOK_SECRET` in `messagingEnvFromProcess`. The AGENTS.md rule against provider-specific env vars covers model connections; messaging platforms already use per-platform env vars, so this follows the existing messaging convention. Flag for owner confirmation (open question 1).
- **BlueBubbles is personal**: a server belongs to one person's Mac. A deployment-wide env var cannot be right for a multi-tenant service. It needs a per-user record: a `Connection` row (`connectorId: "bluebubbles"`, `secretId` pointing at an encrypted `Secret` holding server URL and password plus the webhook token, `metadata` holding the allowlisted chat guids and Private API flag). `ChatSdkMessagingSurface` today holds a fixed platform list built at startup, so a per-user BlueBubbles server needs a lookup: the webhook route becomes `/api/v1/messaging/webhook/bluebubbles/:connectionId?token=...`, and the adapter is created per connection on demand from a small cache keyed by connection id (invalidated on config change). Thread ids become `bluebubbles:<connectionId>:<chatGuid>` so `providerOfThreadId` (`chat-sdk-surface.ts:288`) and send routing still resolve the right server. This is a real change to the surface, which is why BlueBubbles lands first only for the single-user self-hosted case (env) and gains per-user connections in its own PR.

Everything stays optional: with no credentials set, neither provider mounts, exactly as Sendblue.

### Setup UX (Integrations)

Two tiles, "iMessage (Photon)" and "iMessage (BlueBubbles)", under the existing Integrations page, following the other integration tiles and the progressive-disclosure rule. No explainer paragraphs; one line of helper text only where a field would otherwise be ambiguous.

- **Photon** (deployment or owner admin): fields Project ID, Project secret. Praci generates the webhook URL and registers it through Photon's webhook API, then stores the returned signing secret (shown once by Photon) encrypted. "Test" sends the signed `hello` check and shows connected or the specific failure (bad credentials, webhook not reachable). Once connected, the tile shows the Photon number to text and a "Link this number" action that generates the link code and the agent picker (the existing Settings > Messaging flow, reused). Copy to add: field labels and one status string; to be quoted in the PR description per AGENTS.md.
- **BlueBubbles**: fields Server URL and Password, optional "Private API" toggle shown only after the server reports it is available. "Test" calls `/ping` and `/server/info`, then registers the webhook (with the generated token) and shows connected. The page shows one warning only when the URL is public HTTP or an unrecognized tunnel: "This server is reachable from the internet. Anyone who gets the password can read and send your messages." (necessary because the password travels in query strings and is not rate-limited; showing it only when the URL is not private keeps it from being persistent chrome). Recommended reachability, in order: Tailscale or another private network (the API must be on it, which a hosted Praci cannot be); Cloudflare Tunnel to a hostname with Cloudflare Access in front of everything except the webhook path; ngrok or zrok as the quick option. Never recommend port forwarding of the raw server port.
- Hosted Praci cannot reach a Mac behind NAT without a tunnel; self-hosted Praci on the same LAN or tailnet can use the local address directly. SSRF: validate the server URL like other user-supplied URLs (the existing private-host guard used for Supermemory/MCP; allow private ranges only when self-hosted, block link-local and metadata addresses always).
- Mobile and Electron: the tiles live in the shared web UI (Electron hosts it). Mobile only shows link state in Settings, as today; the BlueBubbles setup is desktop/web only, for an explicit reason (it needs a URL and password pasted from a Mac).

### Privacy and retention

- iMessage content is personal. Praci stores only what the existing flow stores: the inbound message as a thread `Message` (the user's conversation with their own agent, under the same retention as any thread), the outbox row (body, status), and `MessagingIdentity` (address, DM thread id, timestamps). Add nothing else.
- Do not store raw webhook bodies, vendor payloads, contact names beyond the sanitized `fromLabel`, or attachment bytes. Do not log message text or the BlueBubbles password or webhook token; logs may carry provider, handle id and status.
- `MessagingOutbound.body` currently persists after sending. For iMessage providers, blank the body when the row reaches `sent` and delete rows older than 7 days (a worker job, matching the delivery retention in `notifications.md`). Failed rows keep the body for 7 days so they can be retried or inspected.
- BlueBubbles credentials: password and webhook token live only in `Secret.ciphertext`; DTOs never return them. Unlinking an identity or deleting the connection deletes the secret and unregisters the webhook (`DELETE /webhook/:id`).
- With Photon, message content transits Photon, which takes a license to Message Content and may use aggregated data for model training (terms 5.1 and 5.2). With BlueBubbles it transits the owner's Mac and tunnel provider. Say so in the PR descriptions, and make the Photon tile's first-use text one line ("Messages pass through Photon.") only if the owner wants a visible disclosure (open question 5).
- Agent model providers still see message text as they do for any chat; no change.

## Phased PRs, smallest first

1. **Shared conformance suite and BlueBubbles adapter, single-owner.** Suite in `packages/testkit`, run against a fake platform, Sendblue and BlueBubbles; `createBlueBubblesAdapter`; env config (`BLUEBUBBLES_URL`, `BLUEBUBBLES_PASSWORD`, `BLUEBUBBLES_WEBHOOK_TOKEN`) with an SSRF-guarded URL; token-authenticated webhook with fetch-by-guid; catch-up poll; handle normalization; chunked plain-text sends with `tempGuid` idempotency; iMessage-transport gating.
2. **Photon adapter.** Wrap `chat-adapter-imessage` in cloud mode, `PHOTON_*` env, fixture-based signature tests, same suite; Finance and Legal agents blocked on this provider.
3. **Setup tiles.** Photon and BlueBubbles Integrations tiles, connection tests, webhook registration, link-code flow reuse, stories and a web test.
4. **iMessage notification channel (done).** Depends on notification PRs 1 and 3 in `notifications.md`.
5. **Privacy job (done).** Body blanking and 7-day cleanup for iMessage outbox rows (may move earlier).
6. **Per-user BlueBubbles connections**, only if a hosted multi-user BlueBubbles is ever wanted (not needed for the self-hosted one-owner-per-install positioning).
7. **Agent tools (Goal C), last:** read tools and an approval-gated send tool on the second account's allowlisted chats.

Verification for each PR: offline conformance and unit tests locally; a manual end-to-end run through the real UI. Live Photon and BlueBubbles checks need real accounts and a Mac and are listed as unverified until run.

## Risks

- **Apple's terms.** Photon's guide says there is no public Apple API for iMessage bots; both providers rely on unofficial routes (Apple hardware automation, or reading the Messages database). Apple can block lines or change the database and break BlueBubbles. Photon's terms disclaim liability for bans (3.5, 9).
- **Photon product churn.** The docs show a Stable (Spectrum) and a Beta (2.0) platform; the Chat SDK adapter is at 1.1.0 and the Spectrum SDK is at 12.x. Pin versions and re-read the docs before phase 2.
- **BlueBubbles security.** The password in query strings and the missing rate limit mean a public tunnel is a real exposure of the owner's whole iMessage history, not only the agent chat. A compromised server also receives every message. The plan mitigates with a separate webhook token, fetch-by-guid, an allowlist and a warning, but cannot make the server itself safe.
- **BlueBubbles compatibility.** Official macOS testing stops at 13; releases do not mention macOS 26; Private API needs SIP off. v1 avoids the Private API.
- **Spoofing and injection.** SMS fallback senders are spoofable; any text a linked address sends is untrusted input to an agent with tools. The plan keeps messaging runs out of `OWNER_INITIATED_TRIGGERS`.
- **Lost messages.** Photon drops after 6 attempts; BlueBubbles never retries. The catch-up poll covers BlueBubbles; Photon needs a replay path if the gateway-based adapter mode is used (`im.events` replay exists in the low-level SDK).
- **Chat SDK memory state** is per process (`chat-sdk-surface.ts:71`); the new adapters must stay stateless across requests.
- **Duplicate outbound** after a timeout where the vendor accepted the send, unless the vendor honors a client message id.
- **Terms on regulated advice.** Photon forbids automated legal, health or financial advice without professional supervision (3.8(b)). Finance and Legal agents should be blocked from Photon until reviewed.

## Open questions

All earlier questions are answered in "Owner answers". Remaining: confirm the exact approval-card wording for the send tool in phase 7, and whether the BlueBubbles Private API (SIP off) is ever wanted on the second-account Mac (the plan assumes not).

## Phase 2 (Photon): done

- **Integration.** `chat-adapter-imessage` was not used. It depends on `spectrum-ts`, which installs about 110 MB across 180 packages including a native `better-sqlite3` build, and its webhook path hands messages to the Chat SDK without waiting, so a failed inbound handler would still return 200 and Photon would not retry. Photon's HTTP SDK `@photon-ai/advanced-imessage` (MIT, pinned at 2.2.0, published 2026-09-20) is a `fetch` client with one pure JavaScript dependency (about 5 MB), so `photon-adapter.ts` is a thin Chat SDK adapter like the BlueBubbles one: it verifies the Spectrum signature itself, mints the line token from the project credentials, and sends through that client with `clientMessageId` as the vendor idempotency key.
- **Config.** `PHOTON_PROJECT_ID`, `PHOTON_PROJECT_SECRET`, `PHOTON_WEBHOOK_SECRET` (all required) and optional `PHOTON_IMESSAGE_ADDRESS`. A short signing secret or bad address disables only Photon.
- **Behavior.** Direct iMessage only (groups, SMS/RCS, reactions and non-text content other than attachments are ignored with a 200); the BlueBubbles chunking, five-chunk cap and plain-text conversion; Photon joins the 140-message consecutive-outbound cap.
- **Disclosure (terms 3.6).** The first outbound message to a Photon conversation is preceded by "You're messaging an AI assistant." The identity's `disclosedAt` records it. The wording still needs the owner's review.
- **Finance and Legal (terms 3.8(b)).** Refused when a Photon identity is pointed at either agent (`messaging.identities.setBot`), when a link code is issued while Photon is the only provider, and when a code for either agent is sent over Photon (the code is kept and a linked sender is told why).
- **Not verified live.** Everything above runs against an offline fake; see the PR notes for what needs a real Photon account (the HTTP endpoint address, the inbound payload's transport field, token minting, `clientMessageId` deduplication).

## Phases 5 and 6 (notification channel and privacy cleanup): done

- **Channel.** `ImessageNotificationChannel` (`channel: "imessage"`) queues a `MessagingOutbound` row (key `notification:<id>`, so one text per notification) and enqueues `messaging.deliver`. The existing drain sends it, so chunking, the 140-message cap, Photon's AI disclosure and retries are unchanged. The text is title, body and an absolute link built from `WEB_ORIGIN`. The channel resolves its own endpoint (new optional `NotificationChannel.endpoints`): the most recently active verified BlueBubbles or Photon identity, only while the owner texted within 24 hours and the cap is not reached; otherwise the delivery is skipped. Mounted only when a messaging surface exists.
- **Preference.** `channels.imessage` in `NotificationPreference` (missing means on); Settings shows an "iMessage" switch next to "Browser" and "Phone" once a verified identity is linked (`hasImessage`).
- **Not done: Hide amounts.** The setting lives only in the browser (`rakazo.hideAmounts` in local storage), so the server cannot mask agent-written notification text with `maskCurrencyWhenHidden`. Masking needs the switch stored per user; until then amounts in an `attention` notification go out as written.
- **Privacy.** The body of a DM row is blanked when it is sent through an iMessage provider; pending and failed rows keep it for retry. The new `messaging.retention` cron job (daily 03:23) deletes `MessagingOutbound` rows and `MessagingInboundClaim` rows older than 7 days in batches of 1000; it replaces the in-process hourly claim prune. Inbound text is stored only as thread messages (the user's chat history), so there is nothing else to clean. Credentials are deployment-wide (env or `IntegrationProviderConfig`), not per identity, so unlinking has nothing to delete; per-user credential deletion belongs to phase 6 of the PR list (per-user BlueBubbles connections), if built.

## Phase 7 (agent tools): done

- **Tools.** `imessage_list_conversations` and `imessage_read` (read, no card) and `imessage_send` (write). They act only on the deployment's own line: the second Apple ID on the BlueBubbles Mac, or the Photon line. Direct iMessage chats only; groups and SMS/RCS are never listed, read or sent to.
- **History.** `BlueBubblesAdapter` and `PhotonAdapter` implement `IMessageHistory` (`packages/adapter-kit/src/types.ts`) and the surface exposes it through `MessagingSurface.history(provider)`. BlueBubbles uses `/chat/query` and `/message/query`. Photon has no chat-list call, so conversations are built from the newest 500 messages (`messages.listRecent`), and a message page comes from `messages.listInChat`.
- **Approval.** `imessage_send` is in the explicit-approval set (`action-approval.ts`), so no saved rule or Auto Review can allow it and the card has no "Always allow" button. The card shows the recipient, the line and the full text.
- **Who gets the tools.** Same rule as mail (`mailToolsAllowed`): the owner's own direct run with an owner-initiated trigger. Not on messaging, group, `bot_message` or webhook runs. Photon is withheld from the Finance and Legal agents. Tool results are marked `untrusted` and the shared guidance names text messages as untrusted content.
- **Sending.** The send reuses the adapter path (plain-text conversion, 2000-character chunks, five-chunk cap) with the run's effect key as the send id, and the effect record makes an approved send run once. On Photon, the first message to a person with no history is preceded by the AI disclosure, and the card says so.
- **Not covered.** The 140-message consecutive cap and Photon's 50 new conversations per day are not applied to tool sends. BlueBubbles sending to a handle with no existing chat, the real `/chat/query` and `/message/query` response shapes, and Photon's list calls are checked only against offline emulators.
