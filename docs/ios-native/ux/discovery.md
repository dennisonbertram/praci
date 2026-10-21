# App Discovery: Praci iOS (native, planned)

Status: planning only. No Swift code exists. This map is built from the build brief, the phased plan, the design boards and the existing Expo app, so every behavior here is planned or inferred, not observed. Epic: #427. Phase issues: #412 to #426 (phase N is issue 412+N).

Sources read: `docs/ios-native/README.md` (brief), `docs/ios-native/plan.md`, `docs/design-system/ios/README.md`, the boards in `docs/design-system/ios/boards/` (including the rule cards in `PG-A-Rules.dc.html` and `PG-B-Rules.dc.html`), `apps/mobile/app/` and `apps/mobile/lib/`, `packages/contracts/src/rpc.ts`.

## Application Type

- A native SwiftUI iPhone client for one product (Praci, still called Rakazo in code and the sign-in board). A founder works with AI agents ("bots"), groups of 2 to 6 bots, spaces (workspaces), an email Inbox, a Team Computer (a remote desktop the agent uses), artifacts, routines, and finance, legal, cap table and data room pages.
- It is a thin client over one typed RPC API. The backend owns orchestration, authorization, retries and provider translation. The client renders state and sends intent. Approvals are message blocks the client relays.
- It replaces the Expo iPhone app after feature parity (phases 2 to 11). Android stays on Expo. Web and Electron are separate clients.
- Primary device target is iPhone Duo (outer display 466x678 pt, inner display held as a book 890x626 pt, laptop pose 626x890 pt), plus ordinary iPhones with a standard top bar. Duo APIs sit behind `if #available(iOS 27.1, *)`.
- Self-hostable: the user can point the app at their own server, so the client must tolerate older servers (404 on a newer procedure means "not supported").

## Tech Stack

- SwiftUI, Swift 6 language mode, `@Observable` view models on the main actor, networking in actors. iOS 26 minimum is proposed, not decided. Xcode 27.1 is needed from phase 7.
- Project layout: `apps/ios/` with XcodeGen `project.yml`; SwiftPM packages `RakazoAPI` (RPC client, SSE, auth, generated models), `RakazoCore` (ported reducer, outbox, consent map, mentions, unread logic), `RakazoUI` (design system and generated `Tokens.swift`), feature modules, later extension targets sharing an App Group and Keychain access group.
- Transport: `POST {base}/rpc/<namespace>/<procedure>` with `{"json": input}`. Headers: bearer token, `x-rakazo-space-id`, `origin: rakazo://`. Realtime is SSE (`threads/subscribe`, `boards/subscribe`, `notifications/subscribe`) read with `URLSession.bytes`. Plain HTTP routes for data-room upload/content/thumbnail, voice speak/transcribe and mail attachments.
- Models: OpenAPI 3.1 export from `appContract` (phase 1, #413) fed to `swift-openapi-generator`; hand-written decoders for `ProductEvent` and the `MessageBlock` union (unknown kinds kept).
- Auth: Better Auth bearer token in the Keychain; SSO through `ASWebAuthenticationSession` and the Expo authorization proxy.
- Libraries named in the brief: Textual (markdown), Swift Charts (or a web view) for `chart` blocks, `WKWebView` (HTML artifacts, mail bodies, Team Computer noVNC), PDFKit, Nuke (images), `SFSpeechRecognizer` (dictation).
- Push: server gains an APNs provider that accepts raw device tokens alongside Expo tokens (decided).
- Testing and release: Swift Testing; ports of the TypeScript tests in `apps/mobile/lib` and `packages/core`; Maestro smoke flow reusing existing accessibility labels; simulator runs against a local server with a synthetic account; TestFlight through Xcode Cloud or fastlane (GitHub Actions are off).
- Design: Liquid Glass. Glass only for the floating navigation and control layer. Lists, cards and bubbles are solid content. Colors come from `@rakazo/ui-tokens`; bots carry the only identity color; one prominent (ink) action per view.

## User Roles

No role model appears in the brief, the boards or the Expo app. The planned app has these actors:

- Signed-out visitor: server selection, sign in, sign up, SSO, password reset, custom server.
- Signed-in space user: the only role the client distinguishes. The server checks space membership on every call (`x-rakazo-space-id`). A user can belong to several spaces.
- User without a connected model (`me.needsModel`): can sign in and browse but cannot start a run ("Connect a model to start a run").
- User without AI data consent: some procedures fail until the user reviews AI data sharing; data room and legal have separate consent procedures.
- User on a deployment with switches off: mail writes off, boards flag off, billing off, password or SSO off. The UI must degrade per switch.
- Agents ("bots", integration agents shown with a letter tile) act on the user's behalf and wait for approval on writes. Space member management, invites and per-member roles are not planned (see the gap section).

## Feature Map

Phase issue numbers are 412 plus the phase number. "Board" lists the design boards in `docs/design-system/ios/boards/` that show the feature.

| Area | What the user can do | Phase issue | Boards |
| --- | --- | --- | --- |
| Scaffold, tokens | Empty app builds, tokens generated | #412 (P0) | DS-01-Foundations |
| Contracts export | Generated Swift models decode real responses | #413 (P1) | none (no UI) |
| Server selection | Enter server address, "Use default server", unreachable error | #414 (P2) | PG-B-Server |
| Sign in | Email and password, sign up, forgot password, "Continue with Example SSO", "Use a custom server" | #414 (P2) | PG-B-SignIn |
| Home | Inbox summary row ("3 need reply", unread count), ACTIVITY card (Working, Approve, Done), PERSONNEL list with bots and integration agents, bottom fade | #415 (P3) | PG-A-Home, Main |
| Spaces | List and switch spaces, create a space (name only) | #415 (P3) | PG-B-NewSpace (sheet); the switcher itself has no board |
| Create bot, group | New bot (name, title, description), New group (name, members) | #415 (P3) | PG-B-NewBot, PG-B-NewGroup |
| Bot and group settings | Edit name, title, description, color, voice flag, device voice, model and thinking level; group rename, members, delete group; archive and restore; sections and pinning | #415 (P3) | PG-B-BotSettings, PG-B-GroupSettings, DS-04 (organize and member pickers), DS-05 |
| Thread read | Message history with paging, markdown, image and file blocks, tool-call labels, working indicator, unread divider, unknown-block placeholder, saved-chat snapshot | #416 (P4) | PG-A-Thread, PG-A-GroupThread, DS-06-Chat |
| Thread write | Composer, attachments (up to 4, 10 MB, HEIC converted to JPEG), outbox with retry, reactions (six fixed), replies and quotes, stop | #417 (P5) | DS-06-Chat |
| Approvals | Tool and write ask (Deny, Allow, always), mail approval (view draft, Save, Send, edit-and-send), secret asks (never stored), MCP approval, choice cards | #417 (P5) | PG-A-Thread, Inner, DS-06-Chat |
| AI data consent prompt | Prompt before an AI data use is sent | #417 (P5) | Only the settings row "AI data sharing" (PG-B-Settings); the prompt has no board |
| Inbox list | Needs reply, Today and Earlier sections, filters, search, mail row with unread dot and label (Needs attention, Newsletter, Spam, Junk), swipe actions, "Inbox zero" empty state | #418 (P6) | Sheet, Split, DS-05-Lists, DS-04 (search overlay, filter chips "Needs reply", "Newsletters", "Read mail") |
| Inbox message | Read subject, sender, body (HTML in a no-network web view), attachments; Archive, Reply, Ask Inbox agent | #418 (P6) | PG-A-InboxMessage |
| Compose, to-dos | Compose, reply, forward; to-do card on top of the list | #418 (P6) | DS-05 (To do card); compose has no dedicated board |
| Inbox cleanup | Bulk cleanup and unsubscribe (exists in Expo as `inbox-cleanup`) | #418 (P6) implied | none |
| Duo layouts | 1/3 + 2/3 split, half-folded 1/2 + 1/2, laptop pose, side toolbar, vertical toolbars | #419 (P7) | Main, Sheet, Split, Inner, Desk, DS-03-Navigation, both Rules boards |
| Team Computer | Watch the screen, Take control, Release, Keyboard, Fit to screen, Team/Private picker, key bar, handoff Skip or "I'm done", "Booting [name]" | #420 (P8) | PG-A-Computer, DS-07 |
| Artifacts | Browse (bot filter chips), preview by type, versions, share, delete, full-screen image with Share and Save to Photos | #420 (P8) | PG-A-Artifacts, PG-A-Artifact, PG-A-Image |
| Agent pages and lists | Pinned page document with figure tiles and chart; checklist with Add item | #420 (P8) | PG-A-AgentPage, PG-A-AgentList |
| Routines | View one routine (schedule, last and next run, prompt), Open conversation | #420 (P8) | PG-A-Routine |
| Settings | Account (profile, sign out, delete account), Models, Voice, Integrations, AI data sharing, Archived bots, Change password | #421 (P9) | PG-B-Settings, PG-B-Models, PG-B-Voice, PG-B-Integrations; no board for Account, AI data sharing, Archived bots, Change password |
| Integrations | Catalog (Connected, Available, Show more, Advanced), connect in Safari then poll `connections.complete`, server credentials setup (method Composio or Direct MCP) | #421 (P9) | PG-B-Integrations |
| Push | Register device token, tap routing (group before bot, switch space first), suppress banner for open thread, Activity dot | #422 (P10) | none; Activity dot in Home rules |
| Voice | Dictation with 1.2 s silence endpointer, call loop with barge-in, `threads/endCall`, voice settings, voice player | #423 (P11) | PG-B-Voice, DS-06 (voice player), DS-07 (Calls) |
| Finance | Runway, cash, burn, accounts (Mercury, Brex), upcoming, period tabs (30 days, 90 days, 12 months), hide amounts, Ask Finance agent | #424 (P12) | PG-B-Finance, Desk |
| Legal | Contracts and Deadlines tabs, scan now, status rows, Ask Legal agent | #424 (P12) | PG-B-Legal |
| Cap table | Carta connection state, ownership ring, holders, add contact, Ask Carta agent | #424 (P12) | PG-B-CapTable |
| Data room | Search, Recently added, folders, upload (system file picker), Load more, Ask Data room agent | #424 (P12) | PG-B-DataRoom |
| Platform extras | Live Activities (Dynamic Island), App Intents ("Ask an agent"), share extension (to an agent or the data room), widgets | #425 (P13) | none |
| Release | TestFlight, Duo and standard screenshots, App Store switch from Expo build | #426 (P14) | none |

Global search (`search.query`, jump with `threads.messages({around})`) and notification list/preferences are in the brief's API table; only the mail search overlay and search field appear on boards.

## Navigation Structure

Planned containers: `NavigationSplitView` (sidebar, list, detail) with a `NavigationStack` inside; `ArrangementView` only on leaf screens (Team Computer). No tab bar ("not adopted" in DS-03). Every toolbar item needs an icon and a title so it can move into the Duo vertical bar. Settings opens as a sheet from the sidebar profile, each row pushes inside it. Home is the root after sign in; sign in is the root when signed out.

Every page keeps the same features and state on every display. The inner display adds one hierarchy level (usually the parent list).

Standard iPhone (393 pt): horizontal toolbar with Back, a centered glass title capsule, and a trailing group. Large titles on list pages with an inline search field (Inbox). Composer floats as one glass capsule 12 pt above the bottom.

Outer display (466x678 pt): 60 pt left strip with the Dynamic Island, time, a Back or Close group, one action group (max 3 icon-only buttons), spacer, a More group, then the single prominent button last. At most three glass groups plus the prominent one. Content column starts at x=72 with a 28 pt large title for list pages or a glass title capsule for object pages. On short heights (466x420) items collapse bottom to top into More; the prominent action collapses last. Clear glass (35% dim) only over live media: Team Computer and Image.

Inner display, book (890x626 pt, flat): 1/3 sidebar (277 pt) + 2/3 detail. The side bar moves to the right edge. Fold zone x 435 to 455 stays empty, nothing interactive there.

Half-folded: snaps to 1/2 + 1/2 (435 pt each) with the same content.

Laptop pose (626x890 pt, fold at y 435 to 455): view on the top half, controls (composer, key bar, actions) as horizontal bars on the bottom half. Applies to Agent thread, Group thread, Agent page, Agent list, Team Computer (the main use), Image, Finance, Legal, Cap table, Data room. Marked not applicable (stay one full-height column): Home, Inbox, Inbox message, Routine, Artifacts, and all form pages (settings, creation sheets, sign in, server).

Per-page inner layout (from rule cards): Home has Personnel with the Inbox row pinned in the third and Activity plus last thread on the right. Inbox has folders and sections in the third and the list beside the open message. A thread has Personnel in the third. Agent page has the thread in the third. Team Computer has the thread in the third and the screen in the two thirds. Artifacts has the bot filter as a vertical list. Settings has the settings list in the third and the selected detail beside it. Finance has sections (Overview, Accounts, Burn, Spend) in the third.

Prominent action per page: Home New (menu: New bot, New group, New space); Inbox and Inbox message Ask Inbox agent; Agent thread Allow in the approval card, otherwise send; Group thread Send; Agent page Open chat; Agent list Add item; Team Computer Take control then Release; Routine Open conversation; Artifacts none; Artifact Share; Image none; Bot and group settings Save; New bot Create; New group Create group; New space Create space; Server Save; Sign in Sign in (full-width ink pill, the only in-content primary button); Settings and Models none; Voice Hear a sample; Integrations Continue in setup; Finance, Legal, Cap table, Data room Ask [page] agent.

Presentation: New bot is a large sheet; New space and Server are medium sheets; New group and the settings pages push; sheets stay in the content area beside the strip on the outer display and never cross the fold on inner.

## State Transitions

- First launch: Server (default host or custom) -> `POST /rpc/health` probe (must return `ok: true`) -> `GET /api/auth/capabilities` (sso, passwordAuth, passwordReset, billing; legacy shape treated as password-only) -> Sign in.
- Server selection: allowed schemes are `https`, or `http` only for loopback, `.local`, private and Tailscale ranges. Changing the server wipes token, space and caches. Boards show the sheet from Sign in or Settings.
- Sign in: email and password (10 attempts per 15 minutes), sign up (may return "verification required" with no session, min password 8), forgot password (title becomes "Check your email"), SSO (browser session, callback `rakazo://sign-in`, confirm with `get-session`). On success: clear selected space, save token to the Keychain, bootstrap (`bootstrap`, `me`, `spaces.list`), land on Home. `me.needsModel` routes the user toward connecting a model.
- Session end: a 401 on an authenticated call without a space header signs the user out. A session-generation counter stops a stale 401 from signing out a newer session. A 401 with a space header re-probes without it to recover from a stale space. An `error` frame with status 401 on the SSE stream means the session ended or the user left the space: sign out or re-select the space, do not reconnect.
- Sign out and account deletion: from Settings > profile (Account). Deletion uses password, emailed code or fresh SSO.
- Space switch: set `x-rakazo-space-id`, then wipe or re-key every cache and reload Home. The server checks membership each call.
- Thread lifecycle: open (show saved snapshot) -> `threads/get` replaces it -> subscribe from highest `seq` -> events fold into the reducer. Heartbeat after 20 s idle; reconnect after 45 s silence; backoff 250 ms doubling to 5 s; on every drop refetch the snapshot, then resubscribe. Mark read via `threads/markRead`; unread divider computed only from the snapshot.
- Send: upload attachments, `threads/send` with `clientNonce`. Outbox states: queued, failed, refused (unreachable or 429 returns to queued; other 4xx except 408, 425, 429 refused). Caps 20 entries and 50 MB.
- Run states: `run.started`, `run.waiting_input` (approval pending), `run.completed`, `run.failed`, `run.cancelled`. A second answer to the same ask returns CONFLICT.
- Consent: a call fails with "Review AI data sharing in Account settings before continuing." The client should check `aiDataUsesForProcedure` and prompt before sending. Data room and legal call `consent` and `consentGrant`. Voice needs consent for `voice`.
- Connect an integration: open `authorizationUrl` in Safari, return to the app, poll `connections.complete` every 2 s. Board shows "Connect pending: alert to finish in browser, then refresh." MCP OAuth is web-only.
- Team Computer: `computer/screenUrl` (one-hour capability URL, view-only unless the user holds the control lease) -> poll status ~2 s -> Take control (`takeover`, lease expiry, default 15 minutes) -> Release (`done` or `skipped`) -> re-read the URL on each control change; heartbeat every 60 s; renew at 50 minutes without reload.
- Push: register token -> notification arrives -> tap -> switch space first, group wins over bot, ignore when signed out. Banner suppressed for the open thread. Foreground and background behavior beyond that is not specified. No notification categories or actions exist yet.
- Voice call: dictation -> silence endpoint at 1.2 s -> `threads/send` -> wait for run to settle -> speak reply (server mp3 or on-device speech) -> barge-in stops speech -> `threads/endCall` files the summary.
- Duo posture changes: outer display <-> inner display (app relaunch or scene change behavior is not specified in the docs read), flat <-> half-folded (1/3+2/3 snaps to 1/2+1/2), portrait <-> laptop pose. Not specified: how selection and scroll position survive these changes.

## Data Entities

From the contracts and brief: Server (origin), Session (token), User (`me`), Space, Bot (avatar shape and color, title, description, voice settings, model, thinking level, archived flag), Group (2 to 6 member bots), Section (Personnel grouping and pins), Integration agent (letter tile), Thread, Message, MessageBlock (about 25 kinds including text, image, file, ask, choice, card, computer, voice_call, steps, subagent, chart, mcp_approval, emails, finance, handoff), ProductEvent (about 45 types), Run, Approval/Ask, Reaction, Outbox entry, Activity item, Notification and push token, Inbox thread/message/attachment/to-do/draft, Mail category and label, Artifact and version, Agent page (blocks), Agent list item, Routine and run history, Computer session (screen URL, control lease), Connection and MCP assignment, Model and provider, Voice settings, AI consent, Finance (overview, accounts, burn, runway, upcoming, recurring), Legal (contracts, deadlines, scan), Cap table (snapshot, holders, contacts), Data room (folders, items, imports, search hits), Usage and billing.

Money is integer cents (finance, non-USD left out of totals) or decimal strings of minor units (legal); legal dates are `YYYY-MM-DD`. Local state: Keychain (token, origin, space, preferences), saved chats (last 100 messages per chat, 40 chats, 20 MB, secret asks redacted), saved Home snapshot, integrations and artifact caches, outbox. Hide amounts is device-only, including chat finance cards.

## Integrations

- Email: Gmail-style mail connector for the Inbox (list, compose, archive, mark read, unsubscribe, cleanup). Attachments through `GET /api/inbox/messages/:id/attachments/:attachmentId`, remote images through a signed proxy. Mail writes can be turned off by the deployment.
- Calendar, documents, tickets and similar apps through the Integrations catalog (`connections.*`, `integrationSetup.*`, Composio or Direct MCP). MCP servers (`mcp.*`); `stdio` MCP is never offered on iOS.
- Finance providers: Mercury and Brex (via MCP OAuth), each with an integration agent. Carta for the cap table (`snapshot: null` until connected; "Reconnect" state). Data room imports from email, Drive and Box (server side; the mobile UI shows files, folders and upload).
- Legal runs only with the user's own OpenRouter key; the blocker is shown as `modelBlocker`.
- Models: hosted provider, local server (for example `http://127.0.0.1:8000/v1`), subscription sign-in.
- Voice: hosted voice provider (speak and transcribe), on-device speech and dictation.
- Apple platform: Keychain, APNs, `ASWebAuthenticationSession`, `WKWebView`, PDFKit, Speech, Photos (Save to Photos), system file picker, Live Activities, App Intents, share extension, widgets.
- Billing: shown only when `me.billingEnabled`; checkout opens in the browser. In-app purchase vs "manage on web" is undecided.
- Optional SSO (one OIDC provider, labeled "Example SSO" on the board).

## Error, Empty and Loading States

States shown on boards (quoted):

- Home: empty "Tap + to create a bot"; loading three placeholder rows; error "Could not load bots" with "Try again"; Activity hides when nothing is running.
- Inbox: empty "Inbox zero" with last sync time; loading placeholder rows (DS-05 skeleton, status region "Loading"); error "Could not load mail." with retry; no results state in the search overlay (DS-05 `Results 3` specimen).
- Inbox message: loading spinner; error "Could not load mail."; Sent check; oversize attachment row with size and disabled state.
- Thread: empty agent greeting and suggestions; small spinner when loading earlier messages; inline "Failed to send message" with retry; working indicator "Inbox agent is working" with stop control; group thread shows one line per working agent; a removed member's bubbles keep the name.
- Agent page: "No page yet."; "Could not load this page." (keeps an already loaded page); "Chart could not be drawn."
- Agent list: "Add item" placeholder when empty; "Could not load this list."; alert "Could not save this list." and the row reverts.
- Team Computer: "Booting [name]" with progress bar; "Could not open computer" with retry; "Could not load the desktop."; handoff asks Skip / "I'm done".
- Routine: "Could not load routine"; "This routine no longer exists"; "Routine link is incomplete".
- Artifacts: "No artifacts yet"; "No matching artifacts"; "Could not load artifacts." with "Try again"; delete confirm on long press. Artifact: "Loading..." title; "Could not load this artifact."; "No preview for this file type."; delete confirms version count. Image: "Could not load this image." with Close still available.
- Bot settings: skeleton rows, red error line above the toolbar action, saving spinner; sheet "Could not save bot". Group settings: "Group not found", delete alert (Cancel, Delete), inline save error. New bot: Create disabled until Name has text, "Creating"; dirty form asks before discard. New group: "No bots" muted line pointing to New bot. New space: "Could not create space"; created-but-not-opened alert with Try again.
- Sign in: "Loading" for options, message with Retry when options fail, red auth error "Could not continue", reset sent "Check your email". Server: "Could not reach this server", checking spinner, "Use default server".
- Settings: values load after the list renders. Models: finding spinner, "Found 3 models.", "No matching models", unreachable red line, success "Now using Model A". Voice: not connected shows only key field and Connect; "Could not play a sample". Integrations: "Could not verify or save these credentials", catalog Retry, "No apps match your search".
- Finance: "No accounts yet" with Add account; skeleton KPIs; red banner with Refresh; mask when amounts hidden. Legal: "Not scanned yet" with Scan now; scan-failed warning row; "Add your OpenRouter key" opens Models. Cap table: "See who owns your company" with Connect Carta; "Reconnect Carta"; "Try again". Data room: empty with Choose files button; "No results" with Clear filters; skeleton rows.

States required by the brief that have no board: offline (saved snapshots and outbox "queued"); no connected model ("Connect a model to start a run"); AI data consent blocked ("Review AI data sharing in Account settings before continuing."); mail writes off (compose `disabled`, "Changing mail is turned off."); compose result `unknown` (never auto-retry); unsupported procedure on an older server; session expired; user removed from space mid-stream; reconnecting SSE; attachment type not allowed or over 10 MB; payload too large and rate limit (429) errors; secret ask; unknown message block placeholder; billing hard stop.

## Planned but not designed, designed but not planned

Planned in the brief or plan with no board:

- AI data consent prompt (#417) and the AI data sharing detail page (#421). Only the Settings row exists.
- Account detail (profile, sign out, delete account), Change password, Archived bots (#421). Only the rows exist.
- Space switcher UI (#415). Only the New space sheet is drawn; where the current space is shown and how to switch is not shown.
- Inbox compose, reply and forward sheets, mail approval edit-and-send, inbox cleanup and unsubscribe (#418). Mail approval view-only is on Inner and DS-06.
- Push notification settings, permission prompt and notification list (#422). Notification preferences appear only as a "Notifications" settings specimen in DS-05.
- Voice call screen: DS-07 lists "Calls" and DS-06 a voice player, but there is no PG page for an active call (#423).
- Global search results across threads (`search.query`) and message jump.
- Live Activities, App Intents, share extension and widgets (#425).
- Onboarding choice cards and focus prompts (`onboarding/*`), MCP approval card, secret-ask input, skill draft, chart, emails, handoff and other message block kinds beyond text/approval cards (partly in DS-06).
- Usage and billing screens and the billing decision.
- Routines list (the board shows one routine and a "routines list" in the inner sidebar, but no list page for outer display) and routine history.
- Sidebar items for Finance, Legal, Cap table and Data room: the rules say "Push from sidebar Finance row", but the outer Home board shows no pages entry other than Activity, Search and Artifacts in the side strip. How a user reaches these pages on the outer display is not drawn.
- Data room: folder navigation, item detail and preview, upload progress, duplicate and zip-import (202) outcomes, processing state.
- Finance and Legal depth beyond the first screens: account detail, transaction, contract detail, deadline edit; Cap table contact add form.
- Light mode layouts are claimed to use the same layout but only dark boards were read.
- Accessibility and Dynamic Type behavior are only partly specified.

Designed but not planned (no API or phase work covers it, per the brief's "missing APIs the designs assume"):

- Space member management: `spaces` exposes only list, create, rename and remove. I did not find a board that draws space member management; the brief still lists it as an assumed API, so confirm what design assumes it. Group member pickers (bots in a group) are different and are supported.
- Data-room share links: the brief says "no share links". I did not find a share-link control on the data room board.
- Mail labels: boards show label chips (Needs attention, Newsletter, Spam, Junk) and filter chips; `inbox` has `feedback`, `moveMany` and categories as client groupings, but no label create or assign procedure.
- Artifact Share, Save to Photos and Fit to screen are drawn; Share uses the system share sheet and needs no API.
- Cap table "add contact" uses `contacts.save`, which exists, but no contact form is drawn.
- Settings > Voice "Hear a sample" and "Optional" speech model exist in the API (`voice.*`).
- Hide amounts is a device-only setting with no server support needed.

## Recommended Story Topics

1. First run: server, sign in and recovery. Covers server selection and unreachable errors, capabilities, email sign in and sign up, forgot password, SSO, custom server, token storage, 401 recovery, sign out and delete account (#414, PG-B-SignIn, PG-B-Server).
2. Home, Personnel and space switching. Covers bootstrap, Inbox summary, Activity card, Personnel list, create bot, group and space, sections and pins, bot and group settings, archive and restore, `needsModel` (#415, PG-A-Home, PG-B-New*, PG-B-*Settings).
3. Talking to an agent: read and live thread. Covers history, paging, SSE reconnect and heartbeat, streaming and tool steps, unread divider, group threads, saved-chat snapshot, unknown blocks (#416, PG-A-Thread, PG-A-GroupThread, DS-06).
4. Sending, attachments and offline. Covers composer, attachments and HEIC conversion, outbox states and retry, reactions, replies, quotes, stop, mentions, no-model and rate-limit errors (#417).
5. Approvals and AI data consent. Covers tool Allow, always and Deny, mail draft approval and edit-and-send, secret asks, MCP approval, choice cards, CONFLICT on a second answer, consent prompt and revoke, connector writes off by default (#417, #421).
6. Inbox triage and compose. Covers sections, filters, search, swipe actions, message view, attachments, archive, reply, forward, to-dos, cleanup, Ask Inbox agent, mail writes off, `unknown` send result (#418, Sheet, Split, PG-A-Inbox*).
7. Team Computer, artifacts, agent pages and routines. Covers watch, take control, release, keyboard bar, handoff, artifact browse and versions, image viewer, agent page, checklist, routine detail (#420, PG-A-Computer, PG-A-Artifact*, PG-A-Routine).
8. Finance, Legal, Cap table and Data room. Covers connected vs not-connected states, hide amounts, scan now, Reconnect Carta, upload and search, model blocker, Ask [page] agent (#424, PG-B-Finance, Legal, CapTable, DataRoom, Desk).
9. Settings, models, voice and integrations. Covers account rows, default model and thinking level, local server, provider connect, voice provider and device voice, integration catalog and Safari round trip with polling, advanced server credentials, archived bots, change password (#421, #423, PG-B-Settings, Models, Voice, Integrations).
10. iPhone Duo and device adaptation. Covers outer side toolbar and collapse, inner 1/3 + 2/3, half-folded 1/2 + 1/2, laptop pose, fold-safe sheets, parity of actions across displays, standard iPhone top bar, push taps, Live Activities and share extension where they interact with posture (#419, #422, #425, DS-03, Main, Split, Inner, Desk, Rules boards).
