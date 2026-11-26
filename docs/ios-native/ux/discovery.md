# App Discovery: Praci iOS (native SwiftUI, built)

Status: the app exists and was re-checked against the code in `apps/ios` for this pass (the earlier version of this file described a plan before any Swift code existed). Everything below was read from source. Nothing was run on a device or simulator for this pass, so behavior claims are "the code does X", not "observed". Paths are relative to `apps/ios/Sources/Praci` unless they start with `Packages/`.

Epic: #427 (phases #412 to #426). The design boards and earlier catalog stay in `docs/ios-native/ux/`.

## Application Type

- A native SwiftUI iPhone client (`TARGETED_DEVICE_FAMILY: 1`, iOS 26 minimum, `project.yml`) for one product, Praci (code and URL scheme still say Rakazo). A founder works with AI agents ("bots"), groups of bots, spaces (workspaces), an email Inbox, meetings, a data room, finance, legal and cap table pages, and a remote "Team computer".
- It is a thin client over one typed RPC API (`app.call("<procedure>")` in `App/AppModel.swift`, transport in `Packages/RakazoCore`). The server owns orchestration, approvals and retries. The client renders state and relays intent.
- Self-hostable. The user can point the app at their own server (`ServerView.swift`); a 404 on a newer procedure maps to `RPCError.notSupported`.
- Single window, single `NavigationStack`. The Duo layout (split view) is not built yet: `App/AppShell.swift` still has the comment "NavigationStack until the Duo phase moves this to NavigationSplitView", and no `#available(iOS 27.1)` or size-class code exists.

## Tech Stack

- SwiftUI, Swift 6 strict concurrency, `@Observable` models on the main actor, deployment target iOS 26 (Liquid Glass: `.glassEffect`, `.buttonStyle(.glass)` / `.glassProminent`, `GlassEffectContainer`).
- XcodeGen project (`project.yml`). Bundle id `ai.praci.mobile` (Release) and `ai.praci.mobile.dev` (Debug). URL scheme `rakazo`. Background mode: audio. Permissions: microphone, speech recognition, local network.
- Three local packages: `Packages/RakazoAPI` (generated OpenAPI models, `MessageBlock`, `RPCEnvelope`), `Packages/RakazoCore` (auth client, RPC client, SSE event stream, outbox, thread reducers, computer session and keyboard, meeting chunking/upload, call session, dictation, page blocks), `Packages/RakazoUI` (design tokens, dynamic colors).
- WebKit is used in three places: `Shared/SafeHTMLView.swift` (mail and HTML artifacts, scripts off), `Shared/SandboxedHTMLView.swift` (agent-authored HTML pages, scripts on, no network), `Computer/ScreenWebView.swift` (noVNC desktop). PDFKit is used in `Artifacts/ArtifactSupport.swift`.
- Auth: password, sign-up, reset, email verification and SSO through `ASWebAuthenticationSession` (`SSOBrowser.swift`). Session in the keychain (`KeychainSessionStorage.swift`).
- Tests: `Tests/PraciTests` (unit tests for models, routes, push targets, send queue, capture), Maestro flows in `maestro/` (`sign-in.yaml`, `smoke.yaml`, `meetings-record.yaml`; the last launches with `-captureFixture` and a bundled audio fixture that is excluded from Release builds).

## User Roles

- Signed-out visitor: sees only `AuthenticationView` (sign in, sign up, reset password, check email, SSO, custom server).
- Signed-in member of one or more spaces. There is no admin UI on iOS; the only role-like gates are server data:
  - `boot.me.hiddenPages` hides Finance, Legal, Cap table, Data room or Meetings rows on Home (`Home/HomeScreen.swift`, `pages(_:)`).
  - `boot.me.needsModel` shows the "connect a model" banner on Home.
  - Space meeting-recording policy (`remind`, `confirm`, `off`) controls the Record button (`Meetings/RecordSheet.swift`, `RecordModel`).
- The agents act as non-human actors (they ask for approvals, request a computer takeover, send push notifications).

## Feature Map

Entries marked "New" were not in the earlier planning-only discovery or catalog; all are verified from code.

### Entry and account

| Feature | Evidence | Notes |
| --- | --- | --- |
| Sign in / sign up / reset / verify email | `AuthenticationView.swift`, `AuthenticationModel.swift` | Pages switch in place; verification page has resend. Fields are inside a `ScrollView`. |
| SSO button | same, `SSOBrowser.swift` | Shown only when server capabilities include SSO; disabled when availability is not `.available`; Retry. |
| Custom server sheet | `ServerView.swift` | Normalizes the URL; `http` and "signed in" each trigger a confirmation alert; "Use default server". |
| Capabilities states | `AuthenticationView.authentication` | Connecting spinner, "Retry connection", "No sign-in method is available on this server". |
| Settings sheet | `Settings/SettingsScreen.swift` | Presented as a sheet over the stack from the gear on Home (`AppShell.sheet`). |
| Account, change password, delete account (password or emailed code) | `Settings/Account/*` | New. Sign-out is also here. |
| Models: providers list, API key, OAuth sign-in with code, local server, disconnect | `Settings/Models/*` | New. Also reachable from Home "Connect a model" (sheet). |
| Voice settings: speak-with provider, hosted voice, transcription on/off, call sounds | `Settings/Voice/*` | New. Needed before recording meetings (`RecordSheet` links to it). |
| Integrations: connected list, available catalog (6 then "Show more"), per-connection detail, reconnect, writes allowed toggle, remove | `Settings/Integrations/*` | New. |
| AI data sharing (consent list and revoke) | `Settings/AIData/AIDataSharingScreen.swift`, `Shared/ConsentSheet.swift` | Consent sheet appears before any AI request via `app.consent.ensure`. |
| Allowed without asking (approval rules, add rule, swipe remove) | `Settings/Rules/ApprovalRulesScreen.swift` | New. |
| Hide amounts, Appearance (system/light/dark), Notifications, Usage | `Settings/SettingsScreen.swift`, `Settings/Preferences/*` | `hideAmounts` is a server preference (`preferences/update`). |
| Archived agents (restore) | `Settings/Archived/ArchivedScreen.swift` | |

### Home and agents

| Feature | Evidence | Notes |
| --- | --- | --- |
| Home list: Inbox row with unread count, Pinned, Agents (collapsed to 4 with "Show N more"), custom sections (collapsible), Pages | `Home/HomeScreen.swift`, `HomeModel.swift` | Pull to refresh, quiet reload on reappear, `agentsChanged` notification reload. |
| Space picker (title menu), New space, Space settings (rename, delete) | `HomeScreen.spaceMenu`, `Spaces/*` | Space choice saved per server in `UserDefaults`. |
| New agent / New group sheets | `Manage/NewBotSheet.swift`, `NewGroupSheet.swift` | Name, role, color. Creating one opens its thread. |
| Row context menu: rename, settings, archive (with undo toast) | `Manage/AgentRowMenu.swift`, `UndoToast.swift` | Undo toast is a separate `UIWindow`. |
| Bot settings / Group settings | `Manage/BotSettingsScreen.swift`, `GroupSettingsScreen.swift` | Name, role, color, pinned, section, "Read replies aloud"; archive/restore/delete; discard-changes dialog on Back. |
| Pages: Finance, Legal, Cap table, Data room, Meetings, Team computer | `HomeScreen.pages` | Team computer opens the first bot's computer. New: Meetings row. |

### Thread (chat)

| Feature | Evidence | Notes |
| --- | --- | --- |
| Thread with bot or group, streaming runs, working indicator, run failure line, unread divider "New", jump to latest | `Thread/ThreadScreen.swift`, `ThreadModel.swift` | SSE updates through `RakazoCore/SSE`. |
| Message blocks: text/markdown, tool steps, subagents, images, files, tables | `Thread/ThreadMessageView.swift`, `ThreadBlocks.swift` | Unknown block kinds render `UnsupportedBlockView`. |
| Approval cards (New): ask (tool/mail/secret/plain), choice, MCP server approval, app connect, info card; resolved/expired/superseded read-only lines | `Thread/Approvals/*` | `MailApprovalCardView` has Send/Save/Discard; `SecretAskView` has username and secret fields; `ConnectCardView` opens Integrations in a sheet. |
| Message actions: copy, reply, six reactions, mark unread | `Thread/MessageActions.swift`, `ThreadReactions.swift` | In a long-press context menu. |
| Composer: text (1 to 5 lines), attach (Photos, Files), reply strip, attachment chips, stop, send, dictation | `Thread/Composer/*` | Offline banner and pending-sends queue (`SendQueue`, `PendingSendsView`). |
| Dictation (New) | `Voice/DictationControl.swift`, `DeviceSpeechRecognizer.swift` | Mic button replaces Send when the field is empty; notice for permission/failure. |
| Voice call (New) | `Voice/CallView.swift`, `CallCoordinator.swift` | Phone icon in toolbar for bots only; full-screen cover with mute, transcript toggle, hang up; hangs up when app backgrounds; disabled while a recording runs. |
| Toolbar menu: Open computer, Artifacts, Agent page, Settings, Archive agent | `ThreadScreen.toolbar` | Group threads only offer Settings. |

### Bot sub-screens

| Feature | Evidence |
| --- | --- |
| Team/Private computer: noVNC view, take control, release, "I'm done"/"Skip" on takeover request, key bar (Esc, Tab, Ctrl, arrows, keyboard), start/wake states | `Computer/*` |
| Artifacts list (search, swipe delete) and Artifact detail (HTML, Markdown, text, PDF, image; versions picker; share link; delete) | `Artifacts/*` |
| Agent page (New): Markdown blocks with live metrics/tables/charts, or full-screen sandboxed HTML; share link, stop sharing; "Open chat" button | `AgentPages/*` |
| Routines list (pause/resume swipe) and Routine detail (history with Load more, prompt) | `Routines/*` |

### Inbox (New, large)

| Feature | Evidence |
| --- | --- |
| Grouped mail list: Needs reply, Today, Earlier; row badges (Needs attention, Newsletter, Spam, Junk, Suspicious); swipe archive/spam/read; context menu; pull to refresh | `Inbox/InboxScreen.swift`, `List/*` |
| Search mail (submit), account filter menu, "Ask" Inbox agent button | `InboxScreen.swift` |
| To do card with mark-done circle and open-message tap | `Inbox/Todos/*` |
| Problem banner and empty states: reconnect Gmail, rate limited, unreachable, no account, Syncing, Inbox zero, search empty | `List/InboxListView.swift` |
| Message screen: archive, reply/reply all/forward, more (unsubscribe), earlier messages, attachments, "Ask Inbox agent", undo archive, sent confirmation | `Inbox/InboxMessageScreen.swift` |
| Compose sheet: From picker, To/Cc/Bcc validation, subject, body, attachments, save draft/discard/keep editing, delivery-unknown and write-off banners | `Inbox/Compose/*` |
| Cleanup (bulk sender archive/unsubscribe with undo and mailto confirmations) | `Inbox/Cleanup/*` |

### Meetings (New)

| Feature | Evidence |
| --- | --- |
| Meetings list with search, paging on last row, pull to refresh | `Meetings/MeetingsScreen.swift` |
| Record button (only when policy is not `off` and nothing is recording) and Record sheet: optional title, notice, "Everyone agreed" toggle when policy is `confirm`, or "Add speech to text" link when the server cannot transcribe | `Meetings/RecordSheet.swift` |
| Recording bar above every pushed screen: live timer, Stop, "Transcribing…", "Offline, saved here" | `Meetings/RecordingBar.swift`, `App/AppShell.swift` |
| Capture engine: chunked cut and upload, resume after relaunch, recovery, closed-recording alert | `Meetings/CaptureController.swift`, `Packages/RakazoCore/.../Meetings/*` |
| Meeting detail: summary, decisions, follow-ups, to-dos, transcription-failure and "Summarizing…" states with polling, delete (Granola note unchanged wording) | `Meetings/MeetingDetailScreen.swift` |

### Pages

- Finance: accounts, burn chart, upcoming, period picker, spend breakdown, transactions, transaction detail; Connect empty state (`Finance/*`).
- Legal: tabs for deadlines and contracts, scan now, consent, due soon/later/done, undo done, contract and deadline detail with Mark done / Dismiss / Keep (`Legal/*`).
- Cap table: share classes, holders, holder detail, Ask Carta agent, sync banners (`CapTable/*`).
- Data room: folders and files, search, failed-only filter, upload from Files/Photos with progress/cancel/retry, new folder, swipe delete, item detail with preview text and "Open", AI-reading consent sheet (`DataRoom/*`).

### System behaviors

- Push (payload fields `groupId`, `botId`, `spaceId`) routing in `App/NotificationRouter.swift`. Token registration is not wired yet (comment on `didRegister(token:)`); unregister on sign-out runs only if a token was stored. The notification permission prompt is requested at launch in `PraciApp.init`.
- Debug-only recorded meeting source: `Meetings/FileAudioSource.swift` (`#if DEBUG`).

## Navigation Structure

```
PraciApp -> RootView
  signed out -> AuthenticationView (own NavigationStack)
                 sheet: ServerView (Form in NavigationStack; alert "Use this server?")
  signed in  -> AppShell: NavigationStack(path: app.path)
                 root: HomeScreen (+ RecordingBar inset)
                 destinations (enum Route, App/Route.swift):
                   thread(bot|group), inbox, inboxMessage, computer, artifacts, artifact,
                   agentPage, routines, routine, botSettings, groupSettings,
                   finance, legal, capTable, dataRoom, meetings, meeting
                 sheet: Settings (NavigationStack { SettingsScreen }), via app.showingSettings
                 alert: capture.closedAlert
```

- Push navigation uses value links (`NavigationLink(value:)`) or `app.open(route)`, which also closes the Settings sheet. Some screens push untyped links that are not in `Route`: Settings rows, Data room folders (`DataRoomListView`), Finance transaction, Legal contract/deadline, Cap table holder, Integrations connection detail, Models credential.
- Sheets: Home (`HomeSheet`: new agent, new group, new space, space settings, connect model), Settings, Record sheet, Compose (new, reply, forward), Add rule, Delete account, Data room consent, Consent sheet (global, `.consentSheet`), share sheet (`ActivityView`), Connect card -> Integrations.
- Full-screen cover: voice call (`CallButton`).
- Deep links: `rakazo://open/...` only (`Route.init?(url:)`): `inbox`, `inbox/<id>`, `finance`, `legal`, `cap-table`, `data-room`, `meetings`, `meeting/<id>`, `bot/<id>`, `bot/<id>/{computer,artifacts,page,routines,settings}`, `group/<id>`, `group/<id>/settings`, `artifact/<id>`, `routine/<id>`. Any other URL, including `rakazo://sign-in`, is ignored. `RootView.onOpenURL` calls `app.open`, which appends to the path even when signed out; that path is cleared by `app.reset()` on sign-out and is not shown until sign-in, so a link tapped while signed out may open a screen right after sign-in (verify).
- Push taps: `NotificationRouter.open` sets the space, clears the path and opens the thread. A tap that arrives before the session is restored waits until `settle(startupDone:)`; a tap while signed out after startup is dropped. Banners are hidden only when the user is already viewing that exact thread.
- Back navigation: bot and group settings replace the back button with a "Back" that asks to discard changes.

## State Transitions

- Launch: `RootView` shows `AuthenticationView` until `authentication.start()` finishes restoring the keychain session (a "Connecting…" spinner appears when capabilities are not loaded), then `AppShell`. `PraciApp.task` then applies the stored appearance, resumes any capture, and settles a pending push.
- Foreground: on `scenePhase == .active` the app calls `authentication.revalidate()` and `capture.resume()`.
- Sign out (Settings or Account): runs `beforeSessionEnds` (push unregister), clears the keychain session, `RootView` calls `app.reset()` (path, Settings sheet, space, user) and the send queue unbinds. Unsent messages stay on disk under their owner.
- Session ended by the server (401): `AppModel.endSession`, then the sign-in screen shows "Your session ended. Sign in again."
- Server change: confirmation if http or signed in; signs out, resets the form, reloads capabilities; `RootView` reloads the saved space for the new endpoint.
- Account deletion: sheet with password or emailed code; success returns to sign-in with a notice.
- Onboarding: there is no onboarding flow. A new account lands on Home; the Home banner "cannot reply until a model is connected" and the "No agents yet" empty state are the only guidance.
- Space switch: `app.spaceID` change reloads Home (`task(id:)`); a rejected space is cleared and the call retried once without it.
- Recording: idle -> start (Record sheet) -> live bar -> Stop -> "Transcribing…" -> meeting stored -> list refresh. Relaunch resumes or recovers; an unrecoverable capture shows an alert.
- Call: begin -> connecting -> active (listening/thinking/speaking, muted) -> end; also ends on background or when the agent hangs up.
- Computer: status loads; stopped/asleep/booting/error placeholders; take control reloads the web view with native keys; backgrounding calls `model.stop()` and active restarts it.

## Data Entities

| Entity | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| Space | New space sheet (`spaces/create`) | Bootstrap | Space settings rename | `spaces/remove` |
| Bot (agent) | New agent (`bots/create`) | `bots/list`, `bots/get` | Settings, rename, pin, section | Archive / restore (`bots/archive`, `restore`, `listArchived`) |
| Group | New group | `groups/get` | Settings | Archive/restore, delete |
| Thread message | Composer send (queued via outbox), follow-up | `threads/get`, `threads/messages`, SSE | React, mark read/unread | none |
| Approval/ask block | Created by agents | Block payload | Answer (`threads/answer`) | none |
| Mail message | Compose send/draft | `inbox/list`, `inbox/get` | Archive/unarchive, spam, read, move many | Discard draft |
| Mail to-do | server-made | `inbox/todos/list` | Mark done | none |
| Meeting | Record (capture start/finish) | `meetings/list`, `meetings/get` | none | `meetings/delete` |
| Artifact | agent-made | `artifacts/getById` | version select | delete (all versions) |
| Routine | agent-made | list, detail, history | Pause/resume | none |
| Data room file/folder | Upload, new folder | `dataRoom/folders`, `dataRoom/item` | none | `dataRoom/itemDelete`, folder delete |
| Model credential | Connect (key, OAuth, local server) | `models/list`, `models/credentials` | Replace key | Disconnect |
| Integration connection | Add from catalog | `connections/list` | Writes toggle, reconnect | Remove |
| Approval rule | Add rule | `approvalRules/list` | none | Swipe remove |
| Legal deadline | scan | `legal/overview` | Done, dismiss, keep, reopen | none |
| Preferences | n/a | `me`, `notifications/preferences` | `preferences/update`, `notifications/updatePreferences` | none |
| AI consent | Allow in sheet | `aiConsent/status` | none | `aiConsent/revoke` |

Finance, cap table and Carta data are read-only on the phone.

## Integrations

- The app's own server (all data), Gmail (through the server; reconnect and rate-limit states are shown), Mercury/Brex (Finance connect), Carta (Cap table), Granola (meeting provider wording in the delete dialog), MCP servers (approval card; authorization finishes in the web app), any catalog app (Integrations), model providers (API key, OAuth, local OpenAI-compatible server), hosted voice and transcription providers, APNs push (routing built, registration not), Photos and Files pickers, microphone and speech recognition, Safari (OAuth code flow, mail links, unsubscribe links), the Share sheet.
- AI data consent gates AI requests (thread send, cleanup, data room reading, legal scan, transcription).

## Error, Empty and Loading States

- Generic: `Shared/Loadable.swift` `LoadableView` shows a centered spinner (idle/loading), or "Couldn't load" with "Try again". Used by Home, Thread, Settings, Artifacts, Agent page, Meetings, Meeting detail, Integrations, Inbox and others.
- Home: refresh error section with Try again; "No agents yet"; needs-model banner.
- Thread: empty text "Say hello to <name>." / "Message the group"; "Couldn't refresh. Showing the last loaded messages."; "Last run failed"; offline banner; composer notice; pending sends; archive failure alert.
- Inbox: seven problem and empty states (see Feature Map). Compose: invalid address, delivery unknown, writes off.
- Meetings: "No meetings", search-empty, transcription-failed note, summarizing note, delete failure alert.
- Computer: "Can't connect" with retry, starting, asleep, stopped, failed, "No live screen", screen load error.
- Data room: "No files yet", "No failed files", search-empty, per-upload failure with retry, consent sheet.
- Finance, Cap table, Legal: connect empty states, sync failed/synced lines, "No open deadlines", "Scanning needs a model".
- Artifacts "No artifacts yet" and "No preview for this file type"; Agent page "No page yet"; Routines "No routines yet"; Rules "No rules"; Archived "No archived agents".
- Auth: inline error text and notice under the form; busy spinners.

## Feature Flags and Conditional UI

- Server-driven: `me.hiddenPages` (page rows), `me.needsModel`, auth `capabilities` (`passwordAuth`, `sso`, `passwordReset` plus `resetURL`), space `meetingRecording` policy, voice status (`transcribe`, `transcriptionReady`, `transcriptionConsented`), inbox `agent` (Ask button), more than one mail account (account filter), triage on/off (To do card hides), mail write permission (compose banner), computer `mode` (Private vs Team), `takeoverRequested`, Integrations "Allow writes".
- Client-only: Debug-only `FileAudioSource` and `-captureFixture`; `useDeviceVoice` default (`Voice/VoiceServer.swift`); Appearance and agents-expanded state kept locally.
- The "Team computer" row appears only if the space has at least one bot.

## Recommended Story Topics

1. Sign-in and server: first launch, sign up with verification, reset, SSO, custom server (http and https), session-ended notice, sign out.
2. Home and spaces: agent roster, pinned and sections, collapse, space switch, new agent/group/space, context menu rename/archive/undo, needs-model banner, pull to refresh.
3. Agent thread: send, receive, stream, unread divider, jump to latest, scrolling a long history and loading older messages, reactions, reply, copy, offline queue, stop a run.
4. Approvals in a thread: ask, choice, mail send/save/discard, secret, MCP approval, connect-app, resolved and expired states.
5. Voice: dictation, call (permission denied, mute, transcript, hang up, backgrounding), read-replies-aloud, voice settings.
6. Inbox triage: grouped list, search, swipe actions, reading mail (plain and HTML), reply/forward, to-dos, cleanup, problem and empty states.
7. Compose and drafts: new mail, validation, attachments, discard or save draft, send outcomes.
8. Meetings: list and search, Record sheet (remind, confirm, speech-to-text missing), recording bar across screens, stop and transcribing, detail with to-dos, delete.
9. Data room and artifacts: browse, upload with progress, failed files, consent, item detail; artifact types (HTML, Markdown, PDF, image), versions, share, delete; agent page (Markdown and HTML).
10. Business pages: Finance, Legal, Cap table, Hide amounts, connect empty states.
11. Team computer: start or wake, take control, key bar and keyboard, takeover request, release, errors.
12. Settings and trust: models (key, OAuth, local), integrations, AI data sharing, approval rules, notifications, usage, appearance, account, delete account, archived agents; plus deep links and push taps.

## Known Risk Areas (walk these first)

Scrolling. The owner reports a place where they cannot scroll. None is confirmed from code alone; these are ranked by likelihood.

1. Thread auto-follow fights the user (`Thread/ThreadScreen.swift`, `onScrollGeometryChange`, about lines 92 to 103). When content height changes and `atBottom` is still true, the handler calls `scrollTo(bottom)` and does not update `atBottom` (that happens only in the `else` branch). During a streaming reply the height changes on every update, so a small upward drag is pulled back down. Check: scroll up while an agent is replying.
2. No keyboard dismissal on scroll in Thread (`ThreadScreen` has no `scrollDismissesKeyboard`; only Auth, Voice settings and Compose set it). With the composer focused the visible transcript is small and dragging does not close the keyboard. Check: tap the composer, then try to read earlier messages.
3. Thread paging at the top (`ThreadScreen.swift` line 63): a `ProgressView().onAppear` triggers `loadOlder` inside a bottom-anchored `LazyVStack` (`defaultScrollAnchor(.bottom)`). Prepending rows can jump the offset or retrigger. Check: scroll to the top of a long thread.
4. HTML with scrolling disabled and sized by content (`Shared/SafeHTMLView.swift`, `isScrollEnabled = false` at line 82, height copied from `contentSize` starting at 1 pt). Wide newsletters or HTML artifacts are clipped horizontally with no way to pan, and the view sits inside a SwiftUI `ScrollView` (`Inbox/InboxMessageScreen.swift` `MessageBody` line 218; `Artifacts/ArtifactScreen.swift` line 99). Check a wide table-based email and an HTML artifact.
5. Full-screen web page (`AgentPages/AgentPageScreen.swift`, lines 22 to 26): `SandboxedHTMLView` with `ignoresSafeArea(edges: .bottom)` under a bottom "Open chat" inset. Page HTML that sets `100vh` or `overflow: hidden` cannot scroll, and `.refreshable` on this screen cannot work with a web view. Check an HTML page taller than the screen.
6. Team computer cannot scroll by design (`Computer/ScreenWebView.swift` line 32 `isScrollEnabled = false`; `ComputerScreen.swift` `allowsHitTesting(model.hasControl)`), and the screen is a non-scrolling `VStack`, so with the keyboard open the desktop area shrinks. Check scrolling inside the remote desktop and with the keyboard up.
7. Sheets with a fixed detent and no scroll view: `Shared/ConsentSheet.swift` (VStack, `.presentationDetents([.medium])`, long disclosure above the Allow button), the Data room consent sheet in `DataRoom/DataRoomRows.swift`, `Meetings/RecordSheet.swift` (fixed `.height(230/280)`), `Spaces/*` sheets (`.medium`). At large Dynamic Type or with the keyboard up, the Allow or Start button can be clipped. Check with the largest text size.
8. Voice call transcript (`Voice/CallView.swift`, about lines 124 to 140): a `ScrollView` with no bottom anchor, so the latest line can sit below the fold during a long call.
9. Nested scrolling: horizontal `ScrollView`s inside the vertical thread (markdown tables in `Thread/ThreadBlocks.swift` line 60, composer chips in `Thread/Composer/ComposerView.swift` line 135, New agent color row, Computer key bar). Diagonal drags may stall.
10. Image artifact (`Artifacts/ArtifactScreen.swift`, two-axis `ScrollView` with `scaledToFit`, no zoom): large images cannot be inspected.

Other risks to walk early:

11. Recording bar: `AppShell` adds `RecordingBar` as a top inset on Home and again on each pushed destination. Check that two bars never stack, and that the bar is missing in the Settings sheet and over the call screen.
12. Settings sheet versus pushed stack: "Connect" on Finance and Cap table sets `showingSettings = true` while the user is deep in the stack; `app.open` closes the sheet silently.
13. Deep links and push taps while signed out (see Navigation). Push registration is not wired, so tap routing can only be tested with a synthetic notification.
14. Startup: the signed-out state is the sign-in screen, so a cold start with a valid session may show it briefly before restore finishes.
15. Duo and iPad layouts: only a single stack exists; the target is iPhone only.
16. Destructive actions to walk carefully: delete account, delete space, delete group, delete artifact (all versions), unsubscribe (cannot be undone), Disconnect model or voice, Remove integration.
17. Real-service dependencies that need a demo stack: Gmail (Inbox, Compose), transcription (Record), Mercury/Brex/Carta, push, SSO. Use invented data only when documenting.
