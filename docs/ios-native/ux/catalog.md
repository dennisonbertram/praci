# UX Path Catalog: Praci iOS (native, as built)

Generated: 2026-11-04
Total Stories: 127 unique (130 written in 12 topic files; 3 merged as duplicates, see "Merged stories")
Coverage: 44 of 50 feature areas fully covered (88%); 5 more partly covered (98% with at least one story); 1 has no story. Details are in the Coverage Matrix.

This catalog replaces the plan-era catalog written on 2026-10-20. That catalog described a design-board plan; no Swift code existed then. Every story here was written from the built SwiftUI code in `apps/ios`. Nothing was run on a device or simulator, so each step says what the code does, not what anyone observed. The first run on a device is the job of `/ux-walker`; the walker's checklist is the next section. All names and figures in the stories are invented. The earlier topic files that describe planned features are kept in `topics/archive/`.

Inputs: `docs/ios-native/ux/discovery.md` and the twelve topic files in `docs/ios-native/ux/topics/`. Each story keeps a **Source** line with its topic file and local ID. The full steps, edge cases and expected results are in the topic file; this catalog carries the goal, paths and cross-references.

## Summary

| Type | Count |
|------|-------|
| Short | 61 |
| Medium | 56 |
| Long | 10 |

| Topic | Stories |
| --- | --- |
| Sign-in and server | 11 |
| Home and spaces | 12 |
| Agent thread | 11 |
| Approvals | 11 |
| Voice | 10 |
| Inbox | 11 |
| Compose | 10 |
| Meetings | 11 |
| Data room and artifacts | 11 |
| Business pages | 10 |
| Team computer | 7 |
| Settings and trust | 12 |

## Code findings to verify

This is the walker's checklist. Each line is something a topic agent flagged from reading the code. None has been observed on a device. They are ranked by likely user impact: first the owner-reported problem, then things that block a task, then silent failures, then wrong or stale information, then polish. "Stories" names the stories that walk the behavior. Paths are under `apps/ios/Sources/Praci` unless they start with `Packages/`.

### Owner-reported

1. **Inbox or an email does not scroll.** Not confirmed from code alone; check these in order, on the Inbox list and on the message screen. (a) `Shared/SafeHTMLView.swift` turns the web view's own scrolling off (`isScrollEnabled = false`) and copies its height from `contentSize`, starting at 1 pt; if the height never updates, the body is clipped and cannot be reached. The web view sits inside the vertical `ScrollView` of `Inbox/InboxMessageScreen.swift` (`MessageBody`, near line 218). (b) Wide table-based newsletters overflow past `max-width` with no horizontal pan or pinch zoom, so part of the mail is unreachable. (b2) The web view height follows `contentSize`, which is never smaller than the current frame, so it can grow but may not shrink after a reflow, and it starts at 1 pt until the first content-size callback. (c) Very long HTML sizes the web view to the whole content, so scrolling may stall or memory may climb. (d) On the list (`Inbox/List/InboxListView.swift`), check scrolling with search active, with a problem banner showing, and with the To do card above the groups. Stories: STORY-060, STORY-061, STORY-056, STORY-059, STORY-066.

### Blocks a task

2. `Thread/ThreadScreen.swift` has no `scrollDismissesKeyboard`, so dragging the transcript does not close the keyboard and a third of the screen stays covered (Compose, sign-in and Voice settings do set it). Agent thread. Stories: STORY-029, STORY-028.
3. `Thread/ThreadScreen.swift` (`onScrollGeometryChange`, about lines 92 to 103): while `atBottom` is true and content grows, the handler re-scrolls to the bottom; a small upward drag during a streaming reply can be pulled back, and drags under 48 pt never stop the following. Agent thread. Stories: STORY-027, STORY-026.
4. `Thread/ThreadScreen.swift` (about line 63): `loadOlder` runs from a spinner row's `onAppear` in a bottom-anchored `LazyVStack`. It has no error or retry (a failed page leaves a permanently spinning row), and prepending rows may jump the scroll position. Agent thread. Stories: STORY-028, STORY-034.
5. `Inbox/InboxScreen.swift`: there is no way to start a new message. `ComposeSheet` is created only in `InboxMessageScreen` (Reply, Reply all, Forward), so `ComposeMode.new` and the multi-account From picker are unreachable. Compose and Inbox. Stories: STORY-067, STORY-075.
6. `Settings/SettingsScreen.swift`: a signed-in user cannot reach the server sheet, so the "Changing servers signs you out." warning is unreachable and the only way to change servers is to sign out first. Sign-in. Stories: STORY-011, STORY-005.
7. Default server is a loopback address, which does not work on a real phone, so a fresh install cannot sign in until the user finds "Use a custom server" (and that button never shows the current host). `Packages/RakazoCore` `ServerEndpoint.swift`, `ServerView.swift`. Sign-in. Stories: STORY-001, STORY-005, STORY-006, STORY-007.
8. Push token registration is not wired (`App/NotificationRouter.swift`, `didRegister(token:)` is unused), so a fresh install may get no pushes and the Notifications "Send to" section stays hidden. Settings and trust. Stories: STORY-122, STORY-123.
9. `Thread/Approvals/*`: an agent that asks again with the reason "This chat read a meeting, so it asks first." cannot be cleared on iOS (no "Clear conversation" on the card or in the thread menu), so the same approval repeats. "Firewall" is also shown with no explanation. Approvals. Stories: STORY-043, STORY-035.
10. `Thread/Approvals/*`: the OAuth MCP card tells the person to finish in the web app and has no button; an abandoned "Connect" card keeps saying Connect and the agent is not told. Approvals. Stories: STORY-042, STORY-044.
11. `Meetings/CaptureController.swift`, `Meetings/MeetingsScreen.swift`: when Stop finishes while the user is on another screen, no meeting opens (auto-open only if the Meetings list is on top) and there is no toast or push, so the finished meeting is easy to miss. Meetings. Stories: STORY-077, STORY-086.
12. `Meetings/RecordingBar.swift`: after Stop while offline the bar stays on "Transcribing..." and never says it is waiting for the connection (it checks `transcribing` before the offline state). Meetings. Stories: STORY-082.
13. `Computer/ComputerScreen.swift`: closing the screen while holding control does not release the lease; the user keeps control until the server times it out, with no warning. Team computer. Stories: STORY-113, STORY-112.
14. `Computer/ComputerScreen.swift`, `ComputerKeyBar.swift`: the keyboard does not show after Take control (the user must find a small icon in a scrolling row), and "Skip" and "I'm done" appear only once control is held and the request is flagged. Team computer. Stories: STORY-111, STORY-112.
15. `App/NotificationRouter.swift`: the push router has no computer target and the thread draws no takeover card, so a takeover request is found only by opening the thread menu. Team computer. Stories: STORY-112, STORY-114.

### Fails silently

16. `Manage/AgentRowMenu.swift` (`catch {}` and `try?`): a failed pin, rename or archive shows nothing; rename to the same name or spaces just closes the alert. Home and spaces. Stories: STORY-016.
17. `DataRoom/*`: folder create with an empty name does nothing, and a share request answered with no link (null) does nothing, both with no message. Data room. Stories: STORY-093, STORY-098.
18. `Thread/Composer/*`: Copy gives no confirmation; React and Stop failures use one red notice line in the composer, far from the message, with no auto-dismiss. Agent thread. Stories: STORY-030, STORY-033.
19. `Inbox/Compose/ComposeSheet.swift`: "Save draft" success has no visible confirmation, and "Reconnect" and "writes off" banners name the fix but give no button. Compose. Stories: STORY-071, STORY-072.
20. `Inbox/Compose/ComposeSheet.swift`: Remove on an attachment in Reply or Reply all has no effect (`attachmentIds` is sent only for Forward), and there is no way to add an attachment or reopen a saved draft. Compose. Stories: STORY-069, STORY-071.
21. `Meetings/MeetingDetailScreen.swift`: a failed delete shows the alert title "Couldn't save that", the same title as a failed to-do save, so it does not say a delete failed. Meetings. Stories: STORY-084, STORY-080.
22. `Meetings/CaptureController.swift`: a phone call or Siri interruption leaves a gap in the audio and the user is not told. Meetings. Stories: STORY-083.
23. `Voice/DictationControl.swift`, `Voice/CallView.swift`: disabled Call, Dictate and Record controls during a recording give no reason; automatic hang-up on backgrounding leaves no message and cannot be resumed. Voice. Stories: STORY-046, STORY-048, STORY-049, STORY-055.
24. `Settings/*` Models: a failed default-model save shows its error as a footer and the list does not visibly roll back; closing the sheet mid-flow leaves the Home banner. Settings and trust. Stories: STORY-117, STORY-014.
25. `Thread/Approvals/SecretAskView.swift`: on a failed save the fields were already cleared, so the person types the credential again, and the error text is fixed because the server text could echo the secret. Approvals. Stories: STORY-041.
26. Hidden pages (`me.hiddenPages`) leave no placeholder or explanation, so a user who expects Finance cannot learn why it is absent. `Home/HomeScreen.swift`. Home and spaces. Stories: STORY-023.

### Stale list or screen after an action

27. Closing the Settings sheet does not reload the screen underneath. Finance, Legal and Cap table keep "No accounts yet" or "Scanning needs a model" after the user connects or adds a key (their load runs once from `.task`); the Inbox is not reloaded after "Reconnect"; Home may keep the "connect a model" banner until a pull to refresh. Every "Connect" button also opens Settings at its top level, not at Integrations or Models. `Finance/*`, `Legal/*`, `CapTable/*`, `Inbox/List/InboxListView.swift`, `Home/HomeModel.swift`. Stories: STORY-102, STORY-105, STORY-108, STORY-066, STORY-014.
28. Lists do not reload by themselves after a destructive action in a pushed screen: an archived message, a Cleanup run, a deleted meeting and a deleted artifact may still show until a pull to refresh. `Inbox/InboxMessageScreen.swift`, `Inbox/Cleanup/*`, `Meetings/MeetingsScreen.swift`, `Artifacts/*`. Stories: STORY-056, STORY-063, STORY-084, STORY-096.
29. Hide amounts is read once per page load (`FinanceModel`, `LegalModel`, `CapTableModel`), so toggling it in Settings does not mask Legal values or Cap table amounts already on screen. Business pages. Stories: STORY-104, STORY-103.
30. Inbox To do card loads once per screen visit and pull to refresh does not reload it; searching then clearing the field does not reload the full list until the empty query is submitted. `Inbox/Todos/*`, `Inbox/InboxScreen.swift`. Stories: STORY-064, STORY-059.
31. The check-your-email page uses an email field that is no longer visible, so Resend can fail after a relaunch; nothing detects that verification or a reset finished, and the reset and verification links do not open the app. `AuthenticationModel.swift`. Sign-in. Stories: STORY-002, STORY-003.
32. Cold start shows the Sign in screen ("Connecting...", with "Use a custom server") for a user with a saved session until restore finishes (`App/RootView.swift`). Sign-in. Stories: STORY-010.
33. The Data room AI consent sheet is checked once per app run by a static flag; "Not now" never returns until relaunch and files then may stay in "Reading..." forever. `DataRoom/DataRoomRows.swift`. Data room. Stories: STORY-092, STORY-088.
34. Share link state is held in the screen model, so leaving and re-entering an artifact or agent page forgets the link and the menu no longer offers Stop sharing (the user cannot revoke it from the app). `Artifacts/*`, `AgentPages/*`. Data room. Stories: STORY-098.

### Wrong or misleading information

35. `Voice/VoiceServer.swift`: the "Speak with" default disagrees with the settings screen (`@AppStorage` shows "This device" ticked; `bool(forKey:)` reads false when never written), so a user with a hosted provider hears the hosted voice while the screen says device. Voice. Stories: STORY-052, STORY-048.
36. `Manage/BotSettingsScreen.swift`: "Read replies aloud" is saved but no iOS code reads thread replies aloud; "Call sounds" and "Waiting sound" are saved but never read. The Voice settings sample line promises read-aloud. Voice. Stories: STORY-053, STORY-052.
37. `Voice/CallView.swift`: the call timer starts when the view is created, not when the call connects. The transcript `ScrollView` (about lines 124 to 140) has no bottom anchor, so the latest line can sit below the fold. "Dictate" disappears once the field has text. Voice. Stories: STORY-048, STORY-050, STORY-046.
38. `Thread/ThreadScreen.swift`: the "Offline. Messages send when you reconnect." line is global to the send queue, shows even on a thread with nothing pending, and appears only after a failed send; the agent stream may be down with no sign of it. Agent thread. Stories: STORY-032.
39. Group rows on Home never show "Working" or "Needs you" (status is always idle), and archiving a member agent may not change the group row. `Home/HomeRows.swift`. Home and spaces. Stories: STORY-015.
40. `Inbox/List/InboxListView.swift`: the account filter icon is the same for All and a single account, so the active account is invisible once the menu closes; with Gmail unreachable the search empty state shows the problem view instead of "No Results". Inbox. Stories: STORY-058, STORY-059.
41. `Packages/RakazoAPI/.../Models/Inbox.swift`: `InboxRow.pile` is decoded but no view shows it, so there is no pile filter, header or badge. Inbox. Stories: STORY-056.
42. `Shared/SafeHTMLView.swift`: mail inherits `color-scheme: light dark`, so a mail with a hard-coded white background and dark text can be unreadable or fully bright in dark mode. Inbox. Stories: STORY-060.
43. `Artifacts/ArtifactScreen.swift`, `Shared/SandboxedHTMLView.swift`: HTML artifacts run with scripts off (CSP `default-src 'none'`), so interactive content degrades silently, and the same content behaves differently on the Agent page. Image artifacts have a two-axis scroll view but no pinch zoom. Data room. Stories: STORY-095, STORY-094.
44. `AgentPages/AgentPageScreen.swift` (lines 22 to 26): full-screen `SandboxedHTMLView` with `ignoresSafeArea(edges: .bottom)` under the "Open chat" inset; page HTML that sets `100vh` or `overflow: hidden` cannot scroll, and pull to refresh reloads the page, not its live sources. Data room. Stories: STORY-097.
45. `Settings/Preferences/NotificationPreferencesScreen.swift`: no row for the iOS permission state or a link to iOS Settings, the permission prompt is requested at launch, and a refused prompt is never mentioned. Settings and trust. Stories: STORY-122.
46. Sign out appears twice (Settings list and Account) and neither confirms. `Settings/SettingsScreen.swift`, `Settings/Account/AccountScreen.swift`. Sign-in and Settings. Stories: STORY-009, STORY-126.
47. Deep links: `rakazo://open/bot/<id>` opens a bot thread but does not switch space (only push payloads carry `spaceId`); a link tapped while signed out may show a screen after sign-in; a push for a space the user left sets `spaceID` anyway. `App/Route.swift`, `App/NotificationRouter.swift`. Settings and trust, Meetings. Stories: STORY-123, STORY-085.
48. `Settings/Rules/ApprovalRulesScreen.swift`: the rule kind is free text, so a typo makes a rule that never matches. Settings and trust. Stories: STORY-121.
49. `Settings/*`: disconnecting the default model's provider removes the Default model section and brings the Home banner back on next load (not verified). Account deletion unregisters push before the delete call, so a failed delete leaves the device without push. Settings and trust. Stories: STORY-118, STORY-127.
50. `Finance/*`, `CapTable/*`: the Cap table empty state looks the same when Carta is connected but nothing has synced, and still offers "Connect Carta"; pull to refresh re-reads the table but starts no sync; the contract detail has no link to its source document. Business pages. Stories: STORY-108, STORY-107.

### Layout and polish

51. Fixed-height sheets with no scroll view: `Shared/ConsentSheet.swift` (`.medium` detent), the Data room consent sheet, `Meetings/RecordSheet.swift` (`.height(230/280)`, long error text may clip), `Spaces/*` sheets. At the largest Dynamic Type or with the keyboard up, Allow or Start can be clipped. Stories: STORY-120, STORY-092, STORY-087, STORY-077, STORY-019.
52. Recording bar: `App/AppShell.swift` adds `RecordingBar` as a top inset on Home and on every pushed screen; check that two bars never stack, that the bar is missing in sheets (Stop is unreachable from Settings) and that it sits above the keyboard and Compose on a small phone. Stories: STORY-022, STORY-086, STORY-077.
53. `Thread/ThreadScreen.swift`: "Jump to latest" has no unread count and a fixed 80 pt offset tuned for a one-line composer, so it can sit under a tall composer; Return sends and no line break can be typed; a draft is lost on leaving the thread; reaction capsules cannot be removed. Stories: STORY-027, STORY-031, STORY-032.
54. Nested scrolling: horizontal `ScrollView`s inside the vertical thread (`Thread/ThreadBlocks.swift` line 60 tables, `Thread/Composer/ComposerView.swift` line 135 chips, the New agent color row, the Computer key bar) may stall on diagonal drags. Stories: STORY-026, STORY-031, STORY-013, STORY-111.
55. `Computer/ScreenWebView.swift` (line 32): the remote desktop cannot scroll by design, the screen is a non-scrolling `VStack` that shrinks with the keyboard, and there is no landscape layout. Team computer. Stories: STORY-111.
56. `Home/HomeScreen.swift`: the space title menu has no chevron, so the switch is hard to discover; the Team computer row opens the first bot's computer whichever it is, and a space with no bots has no row. Stories: STORY-018, STORY-115.
57. `Settings/Integrations/*`: no rename and no email address for an account; agent access is one "Allow writes" switch with no per-agent control. Stories: STORY-119.
58. `ServerView.swift`: the https case shows no confirmation alert when signed out; the "Change server" alert path is dead code. Stories: STORY-005, STORY-011.

## Coverage Matrix

Feature areas come from the Feature Map in `discovery.md`. "Covered" means at least one story walks the area end to end; "Partial" means some of it is walked; "None" means no story.

| # | Feature area | Stories | Status | Gaps |
| --- | --- | --- | --- | --- |
| 1 | Sign in, sign up, reset, verify email | STORY-001, STORY-002, STORY-003 | Covered | |
| 2 | SSO button | STORY-004 | Covered | |
| 3 | Custom server sheet (https, http, default) | STORY-005, STORY-006, STORY-007, STORY-011 | Covered | |
| 4 | Capabilities states (connecting, retry, no sign-in method) | STORY-010 | Partial | "Retry connection" and "No sign-in method is available on this server" have no story |
| 5 | Settings sheet shell | STORY-116 | Covered | |
| 6 | Account: change password, delete account, sign out | STORY-126, STORY-127, STORY-009 | Covered | |
| 7 | Models: key, OAuth with code, local server, disconnect | STORY-014, STORY-117, STORY-118 | Covered | |
| 8 | Voice settings | STORY-052, STORY-054 | Covered | |
| 9 | Integrations: catalog, detail, writes, reconnect, remove | STORY-119, STORY-044 | Covered | |
| 10 | AI data sharing and consent sheet | STORY-120, STORY-092 | Covered | |
| 11 | Allowed without asking (approval rules) | STORY-121 | Covered | |
| 12 | Hide amounts, Appearance, Notifications, Usage | STORY-122, STORY-124, STORY-103, STORY-104 | Covered | |
| 13 | Archived agents | STORY-125 | Covered | |
| 14 | Home list: Inbox row, Pinned, Agents, sections, Pages | STORY-012, STORY-017, STORY-021 | Covered | Custom sections are only changed from agent Settings; no story edits them |
| 15 | Space picker, New space, Space settings | STORY-018, STORY-019, STORY-020 | Covered | |
| 16 | New agent and New group sheets | STORY-013, STORY-015 | Covered | |
| 17 | Row context menu with undo toast | STORY-016 | Covered | |
| 18 | Bot settings and Group settings screens | STORY-016, STORY-053 | Partial | Section picker, color, role, delete group, and the discard-changes dialog on Back have no story |
| 19 | Pages rows and hidden pages | STORY-023 | Covered | |
| 20 | Thread: streaming, working line, failure line, New divider, Jump to latest | STORY-024, STORY-025, STORY-026, STORY-027, STORY-028, STORY-034 | Covered | |
| 21 | Message blocks: markdown, tool steps, subagents, images, files, tables, unsupported | STORY-026 | Partial | Only tool steps and text are walked; tables, images, files, subagent blocks and `UnsupportedBlockView` have no story |
| 22 | Approval cards (ask, choice, mail, secret, MCP, connect, info) | STORY-035, STORY-036, STORY-037, STORY-038, STORY-039, STORY-040, STORY-041, STORY-042, STORY-043, STORY-044, STORY-045 | Covered | |
| 23 | Message actions: copy, reply, reactions, mark unread | STORY-030, STORY-025 | Covered | |
| 24 | Composer: attach, offline queue, stop, send | STORY-031, STORY-032, STORY-033 | Covered | |
| 25 | Dictation | STORY-046, STORY-047 | Covered | |
| 26 | Voice call | STORY-048, STORY-049, STORY-050, STORY-051 | Covered | |
| 27 | Thread toolbar menu (computer, artifacts, page, settings, archive) | STORY-109, STORY-094, STORY-097, STORY-016 | Covered | |
| 28 | Team and Private computer | STORY-109, STORY-110, STORY-111, STORY-112, STORY-113, STORY-114, STORY-115 | Covered | |
| 29 | Artifacts list and detail, versions, share, delete | STORY-094, STORY-095, STORY-096 | Covered | |
| 30 | Agent page: Markdown and sandboxed HTML, share | STORY-097, STORY-098 | Covered | |
| 31 | Routines list and detail (pause, resume, history) | none | None | No topic covers Routines; see Gaps |
| 32 | Inbox grouped list, row badges, swipe and context actions | STORY-056, STORY-057 | Covered | |
| 33 | Inbox search, account filter, Ask Inbox agent | STORY-058, STORY-059 | Covered | Ask Inbox agent is named only as an alternate path |
| 34 | Inbox To do card | STORY-064 | Covered | |
| 35 | Inbox problem and empty states | STORY-066 | Covered | |
| 36 | Message screen: HTML, attachments, earlier messages, unsubscribe | STORY-060, STORY-061, STORY-065 | Covered | |
| 37 | Compose sheet: reply, forward, validation, draft, send outcomes | STORY-067, STORY-068, STORY-069, STORY-070, STORY-071, STORY-072, STORY-073, STORY-074, STORY-075, STORY-076, STORY-062 | Covered | |
| 38 | Cleanup (bulk archive and unsubscribe) | STORY-063 | Covered | |
| 39 | Meetings list and search | STORY-079 | Covered | |
| 40 | Record sheet (remind, confirm, no speech-to-text) | STORY-077, STORY-078, STORY-054, STORY-087 | Covered | |
| 41 | Recording bar across screens | STORY-082, STORY-086, STORY-022, STORY-055 | Covered | |
| 42 | Capture engine: resume after relaunch, recovery, closed-recording alert | STORY-083, STORY-082 | Partial | Relaunch resume, unrecoverable-capture alert and chunk-upload retry have no story |
| 43 | Meeting detail: summary, to-dos, polling, delete | STORY-080, STORY-081, STORY-084 | Covered | |
| 44 | Finance page | STORY-099, STORY-100, STORY-101, STORY-102, STORY-103 | Covered | |
| 45 | Legal page | STORY-105, STORY-106, STORY-107 | Covered | |
| 46 | Cap table | STORY-108 | Covered | Holder detail and "Ask Carta agent" are only touched briefly |
| 47 | Data room: browse, upload, search, failed files, folders, delete | STORY-088, STORY-089, STORY-090, STORY-091, STORY-093 | Covered | |
| 48 | Push routing | STORY-123 | Covered | Token registration is not wired, so only a synthetic notification can be tested |
| 49 | Deep links (`rakazo://open/...`) | STORY-085, STORY-123 | Partial | `inbox/<id>`, `finance`, `legal`, `cap-table`, `data-room`, `artifact/<id>`, `routine/<id>` and the `bot/<id>/...` links have no story |
| 50 | Session states: session ended notice, foreground revalidate, cold start | STORY-008, STORY-010 | Covered | |

Not counted: the debug-only recorded meeting source (`Meetings/FileAudioSource.swift`) and Duo or iPad layouts (the app has one stack, iPhone only).

## Story Dependency Graph

Every story needs a signed-in session (STORY-001) unless it is in the sign-in topic. An indented story builds on the one above it, or needs its state.

```text
STORY-001 Sign in
├── STORY-002 Sign up and verify email
├── STORY-003 Reset a forgotten password
├── STORY-004 Single sign-on
├── STORY-005 Company server (https)  ->  STORY-006 Local http server  ->  STORY-007 Back to default server
├── STORY-010 Cold start with a saved session
│   └── STORY-008 Session ended notice
├── STORY-012 Open the app and reach an agent
│   ├── STORY-013 First launch with no agents
│   │   └── STORY-014 Connect a model (gate for any agent reply and for Legal scans)
│   │       ├── STORY-024 Open a busy thread
│   │       │   ├── STORY-025 Unread divider
│   │       │   ├── STORY-026 Stream a reply  ->  STORY-027 Scroll up during a stream
│   │       │   ├── STORY-028 Load older messages  ->  STORY-029 Dismiss keyboard by dragging
│   │       │   ├── STORY-030 Copy, reply, react
│   │       │   ├── STORY-031 Attach and send  ->  STORY-032 Offline send  ->  STORY-033 Stop and correct  ->  STORY-034 Long session
│   │       │   ├── STORY-035 Allow a tool once  ->  STORY-036, STORY-037, STORY-038, STORY-039, STORY-040, STORY-041, STORY-042, STORY-043
│   │       │   │   └── STORY-044 Connect an app  ->  STORY-102 Finance Connect, STORY-108 Cap table Connect, STORY-066 Gmail reconnect
│   │       │   │       └── STORY-045 Two cards waiting
│   │       │   ├── STORY-046 Dictate  ->  STORY-047 Dictation denied
│   │       │   ├── STORY-048 Voice call  ->  STORY-049, STORY-050, STORY-051
│   │       │   ├── STORY-109 Watch the computer  ->  STORY-110 Wake  ->  STORY-111 Take control  ->  STORY-112 Takeover request  ->  STORY-113 Release  ->  STORY-114 Return
│   │       │   └── STORY-094 Artifacts  ->  STORY-095 HTML artifact  ->  STORY-096 Versions and delete;  STORY-097 Agent page  ->  STORY-098 Share
│   │       └── STORY-105 Legal scan  ->  STORY-106 Triage deadlines  ->  STORY-107 Read a contract
│   ├── STORY-015 Create a group
│   ├── STORY-016 Row menu: pin, rename, archive, undo  ->  STORY-125 Restore an archived agent
│   ├── STORY-017 Crowded roster
│   ├── STORY-018 Switch space  ->  STORY-019 Create a space  ->  STORY-020 Delete a space
│   ├── STORY-021 Pull to refresh offline
│   ├── STORY-023 Hidden pages  ->  STORY-099 Finance  ->  STORY-100, STORY-101, STORY-102, STORY-103  ->  STORY-104 Hide amounts in Settings
│   ├── STORY-023 Hidden pages  ->  STORY-115 Open the first computer from Home
│   ├── STORY-056 Inbox triage
│   │   ├── STORY-057 Swipe actions with Undo
│   │   ├── STORY-058 Two Gmail accounts  ->  STORY-059 Search
│   │   ├── STORY-060 Read plain and long HTML mail  ->  STORY-061 Wide HTML mail  ->  STORY-065 Unsubscribe
│   │   ├── STORY-062 Reply, Reply all, Forward  ->  STORY-067 Reply and send  ->  STORY-068, STORY-069, STORY-070, STORY-071, STORY-072, STORY-073, STORY-074, STORY-076
│   │   ├── STORY-063 Cleanup
│   │   ├── STORY-064 To do card
│   │   └── STORY-075 No mail account connected
│   ├── STORY-079 Meetings list and search
│   │   ├── STORY-054 Record with no speech to text  ->  STORY-052 Voice settings
│   │   ├── STORY-077 Record a team call  ->  STORY-078 Everyone-agreed policy  ->  STORY-082 Stop and wait  ->  STORY-081 Summary appears  ->  STORY-080 Read and tick off a to-do
│   │   │   └── STORY-083 Interruption, STORY-086 Record while using the app, STORY-087 Second recording refused, STORY-055 Call during a recording, STORY-022 Home during a recording
│   │   ├── STORY-084 Delete a meeting
│   │   └── STORY-085 Deep link and Hex thread link
│   ├── STORY-088 Data room  ->  STORY-089 Upload  ->  STORY-090 Search  ->  STORY-091 Failed files;  STORY-092 AI consent;  STORY-093 Folders
│   └── STORY-116 Open Settings
│       ├── STORY-117 Default model  ->  STORY-118 Replace and remove a key
│       ├── STORY-119 Connected account, writes, reconnect
│       ├── STORY-120 Withdraw AI data sharing
│       ├── STORY-121 Add an approval rule
│       ├── STORY-122 Alerts  ->  STORY-123 Tap a push
│       ├── STORY-124 Usage, hide amounts, appearance
│       ├── STORY-126 Change password, sign out  ->  STORY-009 Sign out
│       ├── STORY-127 Delete account
│       └── STORY-053 Read replies aloud (agent Settings)
└── STORY-011 Change server while signed in (needs a signed-out start; see finding 6)
```

## All Stories

Entries carry the goal, paths and cross-references. The full steps and expected results are in the source topic file.

### Sign-in and server

#### STORY-001: Sign in with email and password
**Type**: short | **Source**: `topics/sign-in-and-server.md STORY-001`
**Persona**: Maya Okafor, founder with an existing account, installing the app on a new phone
**Goal**: Reach Home with an existing account.
**Ideal path**: 4. Type Email, type Password, tap Sign in, land on Home.
**Alternate paths**: SSO button (STORY-004). Sign up first (STORY-002). No keyboard shortcut for submit is wired (no `onSubmit` on the fields), so the button is the only route.
**See also**: STORY-008, STORY-009

#### STORY-002: Sign up and verify email
**Type**: medium | **Source**: `topics/sign-in-and-server.md STORY-002`
**Persona**: Priya Nair, first-time user on a server that requires email verification
**Goal**: Create an account, confirm the email, and sign in.
**Ideal path**: 6. Sign up, fill Name, Email, Password, submit, confirm in mail, sign in.
**Alternate paths**: Continue with SSO creates an account without verification (STORY-004). If the server does not require verification, submitting Sign up signs in directly and the story ends at step 4.

#### STORY-003: Reset a forgotten password
**Type**: short | **Source**: `topics/sign-in-and-server.md STORY-003`
**Persona**: Tomas Berg, locked out after changing phones
**Goal**: Get a reset email.
**Ideal path**: 4. Forgot password, type email, send, read notice.
**Alternate paths**: None in this app for a signed-out user. A signed-in user changes the password in Settings, Account, "Change password" (out of scope here).

#### STORY-004: Continue with single sign-on
**Type**: medium | **Source**: `topics/sign-in-and-server.md STORY-004`
**Persona**: Dana Whitfield, team member whose company runs an SSO provider named "Acme ID"
**Goal**: Sign in without a password.
**Ideal path**: 2. Tap the SSO button, finish in the sheet.
**Alternate paths**: Password fields below the button when the server also allows them.

#### STORY-005: Point a fresh install at a company server (https)
**Type**: medium | **Source**: `topics/sign-in-and-server.md STORY-005`
**Persona**: Tomas Berg, CTO running his own server at `praci.example.test`
**Goal**: Sign in against the company server instead of the built-in default.
**Ideal path**: 7. Open the sheet, type the address, Save, then Email, Password, Sign in.
**Alternate paths**: None; the server sheet is reachable only from the sign-in screen (the Settings screens have no Server row, and a signed-in user has no sheet to open without signing out first).
**See also**: STORY-011

#### STORY-006: Use a server on the local network over http
**Type**: medium | **Source**: `topics/sign-in-and-server.md STORY-006`
**Persona**: Leo Marchetti, developer testing against a Mac on the same Wi-Fi
**Goal**: Connect over plain http to `http://local-server.example.test:3100`.
**Ideal path**: 5. Open sheet, type, Save, confirm, then sign in.
**Alternate paths**: None.
**See also**: STORY-011

#### STORY-007: Return to the default server
**Type**: short | **Source**: `topics/sign-in-and-server.md STORY-007`
**Persona**: Leo Marchetti, done testing
**Goal**: Go back to the built-in server.
**Ideal path**: 3. Open sheet, "Use default server", done.
**Alternate paths**: Type the default address by hand.

#### STORY-008: Session ended notice
**Type**: medium | **Source**: `topics/sign-in-and-server.md STORY-008`
**Persona**: Maya Okafor, signed in for weeks
**Goal**: Recover when the server stops accepting her session.
**Ideal path**: 3. See the notice, type the password, Sign in.
**Alternate paths**: SSO if the server offers it.
**See also**: STORY-001, STORY-010

#### STORY-009: Sign out
**Type**: short | **Source**: `topics/sign-in-and-server.md STORY-009`
**Persona**: Dana Whitfield, handing her phone back to IT
**Goal**: End the session on this device.
**Ideal path**: 3. Settings, Sign out, done (no confirmation).
**Alternate paths**: Settings, Account, "Sign out" (a second button on the Account screen; both call the same function).
**See also**: STORY-001, STORY-126, STORY-127

#### STORY-010: Cold start with a saved session
**Type**: short | **Source**: `topics/sign-in-and-server.md STORY-010`
**Persona**: Maya Okafor, opening the app after a day
**Goal**: Get straight to Home.
**Ideal path**: 1. Launch; Home appears with no sign-in.
**Alternate paths**: Notification tap (deep link) after launch, handled once startup finishes.
**See also**: STORY-008, STORY-123

#### STORY-011: Change server while signed in
**Type**: long | **Source**: `topics/sign-in-and-server.md STORY-011`
**Persona**: Tomas Berg, moving his team from a test server to the production server
**Goal**: Switch the app to `https://praci.example.test` and sign in there.
**Ideal path**: 6. Sign out, open sheet, type, Save, Change server, sign in. (The app has no switch from inside Settings.)
**Alternate paths**: The sheet can only be opened from the sign-in page, so a signed-in user must sign out first; `ServerView` still has code for the signed-in case ("Changing servers signs you out."), but no screen in the signed-in app reaches it.
**See also**: STORY-005, STORY-006

### Home and spaces

#### STORY-012: Open the app and get to the agent I need
**Type**: short | **Source**: `topics/home-and-spaces.md STORY-H01`
**Persona**: Maya Okafor, solo founder of a four-person logistics startup, three agents set up
**Goal**: See which agent has something for her and open it
**Ideal path**: 2. One look at Home shows which agent needs her (unread dot, status text), one tap opens the thread.
**Alternate paths**: Tap the Inbox row for mail instead of an agent. Open a thread from a push notification (`NotificationRouter.open`). Pin the agent so it sits at the top (see H05).

#### STORY-013: First launch with no agents
**Type**: short | **Source**: `topics/home-and-spaces.md STORY-H02`
**Persona**: Tomas Reyes, new user, just verified his email
**Goal**: Create the first agent from an empty Home
**Ideal path**: 3. Tap "New agent" on the empty state, type a name, tap "Create".
**Alternate paths**: "New" (plus) in the nav bar, then "New agent" (same sheet). No other route.
**See also**: STORY-024

#### STORY-014: Connect a model from the Home banner
**Type**: medium | **Source**: `topics/home-and-spaces.md STORY-H03`; `topics/settings-and-trust.md STORY-003`
**Persona**: Tomas Reyes
**Goal**: Make his agent able to answer
**Ideal path**: 4. Tap "Connect a model", pick a provider, finish the key or sign-in, return to Home with the banner gone.
**Alternate paths**: Settings (gear) then the Models screen reaches the same place. Opening the thread and trying to send does not offer a link (not verified in this pass; belongs to the thread-send topic).
**See also**: STORY-024, STORY-105, STORY-117

#### STORY-015: Create a group of agents
**Type**: medium | **Source**: `topics/home-and-spaces.md STORY-H04`
**Persona**: Maya Okafor
**Goal**: Put Finance and Ops in one chat to plan a quarter
**Ideal path**: 5. Plus, "New group", name, pick two members, Create.
**Alternate paths**: From the empty-state "New agent" button for agents only; groups have one route (nav-bar plus menu).
**See also**: STORY-024

#### STORY-016: Pin, rename and archive from the row menu, then undo
**Type**: medium | **Source**: `topics/home-and-spaces.md STORY-H05`
**Persona**: Maya Okafor
**Goal**: Tidy Home: pin Finance, rename "Inbox helper", archive an old agent by mistake and bring it back
**Ideal path**: 3 per action (long-press, choose, confirm if needed). Undo adds 1.
**Alternate paths**: The same actions exist in the agent's Settings screen (row menu "Settings"). Archive also reachable from agent Settings, which pops to Home and shows the same toast. Archived items are restored from Settings, Archived. Pin has no other route found.
**See also**: STORY-053, STORY-125

#### STORY-017: A crowded roster: show more, sections and collapse
**Type**: medium | **Source**: `topics/home-and-spaces.md STORY-H06`
**Persona**: Priya Nair, head of operations at a 30-person startup, 12 agents and groups
**Goal**: Reach an agent that is below the fold in a custom section
**Ideal path**: 3. Scroll, tap the section header to expand, tap the row.
**Alternate paths**: Pull to refresh does not change what is visible. Section assignment is only changed from an agent's Settings screen (a "Section" picker); no creation or editing of sections on Home was found in the code.

#### STORY-018: Switch to another space
**Type**: short | **Source**: `topics/home-and-spaces.md STORY-H07`
**Persona**: Priya Nair, owns "Brightwell Labs" and is also invited to "Brightwell Advisory"
**Goal**: See the other space's agents
**Ideal path**: 2. Tap the title, pick the space.
**Alternate paths**: Opening a push notification for another space switches `app.spaceID` automatically. Nothing else on Home switches space.

#### STORY-019: Create a space and rename it
**Type**: medium | **Source**: `topics/home-and-spaces.md STORY-H08`
**Persona**: Priya Nair
**Goal**: Start a clean workspace for a side project and fix a typo in its name
**Ideal path**: 4. Plus, "New space", name, Create (then 4 more for a rename).
**Alternate paths**: Title menu, "New space" reaches the same sheet. Rename only through title menu, "Space settings".

#### STORY-020: Delete a space
**Type**: short | **Source**: `topics/home-and-spaces.md STORY-H09`
**Persona**: Priya Nair
**Goal**: Remove the unused "Side project" space
**Ideal path**: 3. Title menu, Space settings, Delete space, confirm (4 with the confirm).
**Alternate paths**: none found

#### STORY-021: Pull to refresh with a flaky connection
**Type**: short | **Source**: `topics/home-and-spaces.md STORY-H10`
**Persona**: Maya Okafor on a train with weak signal
**Goal**: Check for new messages
**Ideal path**: 1. Pull down; if it fails, one tap on "Try again".
**Alternate paths**: Returning from any pushed screen reloads Home quietly; an agents-changed notification also reloads it.

#### STORY-022: Check Home while a recording is running
**Type**: medium | **Source**: `topics/home-and-spaces.md STORY-H11`
**Persona**: Maya Okafor, mid-meeting
**Goal**: Leave the recording running, look at an agent's reply, and stop the recording afterwards
**Ideal path**: 3. Tap back to Home, tap the agent, later tap "Stop" on the bar.
**Alternate paths**: Stop also from the recording screen or sheet in Meetings (not covered here).
**See also**: STORY-077, STORY-086

#### STORY-023: Find Finance and Legal pages when some are hidden
**Type**: short | **Source**: `topics/home-and-spaces.md STORY-H12`
**Persona**: Jordan Lee, an invited advisor with limited access
**Goal**: Open the Meetings page and see why Finance is missing
**Ideal path**: 2. Scroll to Pages, tap Meetings.
**Alternate paths**: none found for pages other than Meetings, which is also opened from a push or from meeting-related links.
**See also**: STORY-085, STORY-099, STORY-115

### Agent thread

#### STORY-024: Open a busy thread and land on the newest reply
**Type**: short | **Source**: `topics/agent-thread.md STORY-001`
**Persona**: Founder who checks an agent a few times a day
**Goal**: Read the newest reply from "Ledger" without scrolling
**Ideal path**: 1. Tapping the agent row on Home should land on the newest message.
**Alternate paths**: Push notification tap opens the same thread (`app.open`); Home search or pinned row. Same screen, same landing.
**See also**: STORY-013, STORY-014, STORY-015

#### STORY-025: Return to a thread with unread replies and the "New" divider
**Type**: medium | **Source**: `topics/agent-thread.md STORY-002`
**Persona**: Founder who left a long research task running overnight
**Goal**: Start reading at the first reply they have not seen
**Ideal path**: 1. The thread opens at the first unread message with a clear marker; reaching the end marks it read automatically.
**Alternate paths**: The unread dot or count on the Home row leads here; no other path to the divider. "Mark unread" in the message menu recreates a divider later (see Variations).
**See also**: STORY-123

#### STORY-026: Watch a reply stream in and follow it
**Type**: medium | **Source**: `topics/agent-thread.md STORY-003`
**Persona**: Founder asking for a summary and waiting for it
**Goal**: See the answer appear without touching the screen
**Ideal path**: 2. Send the question; the screen stays pinned to the growing reply.
**Alternate paths**: none found (streaming is the only way a reply arrives; reopening the thread shows the finished message).
**See also**: STORY-045

#### STORY-027: Scroll up during a streaming reply without being pulled back
**Type**: medium | **Source**: `topics/agent-thread.md STORY-004`
**Persona**: Founder who wants to re-read an earlier answer while the agent is still writing
**Goal**: Look at an older message while a reply keeps streaming, then return to the live edge
**Ideal path**: 3. Drag up to the old message; the screen stays put and shows a way back to the live reply; one tap returns.
**Alternate paths**: Dragging back down by hand to the end also returns (and the button disappears). Tapping the status-bar area is not handled specially (iOS default scroll-to-top applies, which jumps to the oldest loaded message and triggers older-page loading).

#### STORY-028: Scroll back through history and load older messages
**Type**: medium | **Source**: `topics/agent-thread.md STORY-005`
**Persona**: Founder looking for a number "Ledger" gave three weeks ago
**Goal**: Reach old messages by scrolling up
**Ideal path**: 2. Drag up repeatedly; older pages appear without any extra tap and without the view jumping.
**Alternate paths**: none found in the thread (there is no in-thread search or date jump on iOS). The same facts may be in Artifacts or the Agent page from the toolbar menu.

#### STORY-029: Dismiss the keyboard by dragging the list
**Type**: short | **Source**: `topics/agent-thread.md STORY-006`
**Persona**: Founder who typed half a message and wants to read a reply behind the keyboard
**Goal**: Get the keyboard out of the way while reading
**Ideal path**: 1. Drag the message list down and the keyboard follows the finger and dismisses.
**Alternate paths**: Tapping elsewhere does nothing (no tap-to-dismiss on the list). The Return key sends rather than dismisses. Swiping down on the keyboard itself is not available on iPhone. Leaving the screen with Back dismisses it.

#### STORY-030: Copy, reply to and react to an agent message
**Type**: medium | **Source**: `topics/agent-thread.md STORY-007`
**Persona**: Founder acting on a finished answer
**Goal**: Copy a figure, ask a follow-up on one paragraph, and thumbs-up the answer
**Ideal path**: 3. Long-press the reply and tap Copy; long-press and tap Reply; long-press, React, Like.
**Alternate paths**: React and Reply are only in the long-press menu; no swipe-to-reply and no double-tap. Reactions can also arrive from the web app and are shown the same way.
**See also**: STORY-038

#### STORY-031: Attach files and photos, then send
**Type**: medium | **Source**: `topics/agent-thread.md STORY-008`
**Persona**: Founder sending a contract and a photo of a whiteboard
**Goal**: Send a PDF and a photo with one instruction
**Ideal path**: 4. Plus, pick items, type, Send.
**Alternate paths**: Photos and Files are in the same "+" menu; no paste of images from the clipboard and no drag-and-drop. Camera capture is not offered from the "+" menu.

#### STORY-032: Send while offline, then recover
**Type**: medium | **Source**: `topics/agent-thread.md STORY-009`
**Persona**: Founder in a lift or on a train
**Goal**: Not lose a message written without signal
**Ideal path**: 2. Type and send; the message waits and delivers on its own when the connection returns.
**Alternate paths**: Per-message "Retry" and "Delete" exist both as a visible button and in the long-press menu on a pending message; two ways to the same actions.
**See also**: STORY-038, STORY-073

#### STORY-033: Stop a run and send a correction
**Type**: short | **Source**: `topics/agent-thread.md STORY-010`
**Persona**: Founder who just realized they asked about the wrong quarter
**Goal**: Halt the agent and redirect it
**Ideal path**: 2. Tap Stop, then type and send the correction.
**Alternate paths**: none found (no Stop in the toolbar menu). Voice call hang-up ends the call, not the run.
**See also**: STORY-035

#### STORY-034: Long session: catch up, scroll back, attach, lose signal, stop, react
**Type**: long | **Source**: `topics/agent-thread.md STORY-011`
**Persona**: Founder preparing a board update on a commute
**Goal**: Use the thread through a whole working session across the features above
**Ideal path**: 
**Alternate paths**: none recorded

### Approvals

#### STORY-035: Allow a payment tool once
**Type**: short | **Source**: `topics/approvals.md STORY-001`
**Persona**: Priya Nandakumar, founder of a 6-person logistics startup, Mercury agent connected
**Goal**: Let the agent send a pilot invoice payment after reading what it will do
**Ideal path**: 2. Read the card, tap the one prominent button. The payment label already says the amount, so no second confirmation is needed.
**Alternate paths**: Answer the same card from the web app or Expo app; the iOS card changes to the resolved line after the next thread refresh. Settings > "Allowed without asking" can pre-approve the tool so the card never appears.
**See also**: STORY-033, STORY-121

#### STORY-036: Deny a tool call and see the resolved line
**Type**: short | **Source**: `topics/approvals.md STORY-002`
**Persona**: Marcus Oyelaran, operations lead
**Goal**: Stop an agent from running a tool he does not recognise
**Ideal path**: 1. Tap "Deny".
**Alternate paths**: Do not answer and instead type a new message; the run continues and the old card later shows "Replaced by a newer request" or "Stopped".

#### STORY-037: A card that is no longer active
**Type**: short | **Source**: `topics/approvals.md STORY-003`
**Persona**: Hana Kobayashi, returns to a thread after lunch
**Goal**: Understand what happened to a request she did not answer
**Ideal path**: 1. Open the thread and read the resolved line.
**Alternate paths**: none found

#### STORY-038: Answer a free-text question from the agent
**Type**: short | **Source**: `topics/approvals.md STORY-004`
**Persona**: Devon Whitfield, founder
**Goal**: Tell the agent which Mercury account to pay from
**Ideal path**: 2. Type the answer, tap "Send answer".
**Alternate paths**: Reply in the normal composer. This sends a new message instead of answering the card, so the card ends as "Replaced by a newer request" or stays pending depending on the run.
**See also**: STORY-030, STORY-032

#### STORY-039: Pick an option on a choice card, or dismiss it
**Type**: short | **Source**: `topics/approvals.md STORY-005`
**Persona**: Aisha Rahman, new user in first-run onboarding
**Goal**: Choose what the agent should help with first
**Ideal path**: 2. Tap an option row, tap "Continue".
**Alternate paths**: Tap the small close (xmark, label "Dismiss") at the top right to skip.

#### STORY-040: Send, save or discard a drafted email
**Type**: medium | **Source**: `topics/approvals.md STORY-006`
**Persona**: Tomasz Wrona, founder, Gmail agent connected
**Goal**: Review an email the agent wrote to an investor, then send it
**Ideal path**: 2. Read the card, tap "Send".
**Alternate paths**: Tell the agent in the composer what to change; the agent then asks again with a new card. There is no edit screen on iOS. The Inbox draft view is a separate route to the same email.
**See also**: STORY-062, STORY-067

#### STORY-041: Give the agent a password or API key
**Type**: medium | **Source**: `topics/approvals.md STORY-007`
**Persona**: Lena Fischer, founder
**Goal**: Give the agent an API key for a vendor so it can continue
**Ideal path**: 3. Paste into the secure field, tap "Save"; a password manager fill counts as the paste.
**Alternate paths**: Settings > Integrations holds connected apps, but not agent-requested keys; no other route.

#### STORY-042: Approve an agent-created MCP server
**Type**: short | **Source**: `topics/approvals.md STORY-008`
**Persona**: Ravi Subramanian, founder
**Goal**: Let the agent connect a docs search server it created
**Ideal path**: 1. Tap "Approve".
**Alternate paths**: Settings > Integrations lists connections after they exist but has no approval for a pending agent-created server.

#### STORY-043: See why a call asks, including Firewall and meeting reasons
**Type**: medium | **Source**: `topics/approvals.md STORY-009`
**Persona**: Joanna Mbeki, founder who recently asked an agent to summarise a recorded meeting
**Goal**: Understand why an agent that normally sends mail on its own is now asking
**Ideal path**: 3. Read the reason, decide, and answer. To stop the asking she would need to clear the conversation, which iOS cannot do.
**Alternate paths**: Web app: the meeting reason has a "Clear conversation" link beside it and the bot context menu offers "Clear conversation". iOS has no equivalent on the card or in the thread menu.
**See also**: STORY-121

#### STORY-044: Connect an app the agent needs
**Type**: medium | **Source**: `topics/approvals.md STORY-010`; `topics/settings-and-trust.md STORY-005`
**Persona**: Marta Delgado, founder
**Goal**: Connect Mercury so the agent can read balances
**Ideal path**: 3. Tap "Connect", finish in the browser, close the sheet.
**Alternate paths**: Home > Settings > Integrations (the same screen, opened without leaving the thread).
**See also**: STORY-102, STORY-108, STORY-119

#### STORY-045: Two cards waiting, answer the right one
**Type**: long | **Source**: `topics/approvals.md STORY-011`
**Persona**: Priya Nandakumar, back after a meeting
**Goal**: Clear a backlog of requests from one agent without approving the wrong one
**Ideal path**: 4. Scroll to the latest card, answer it, then answer the next.
**Alternate paths**: none found
**See also**: STORY-026

### Voice

#### STORY-046: Dictate a message into the composer
**Type**: short | **Source**: `topics/voice.md STORY-V01`
**Persona**: Founder walking between meetings, phone in one hand
**Goal**: Say a request to the "Finance" agent instead of typing it
**Ideal path**: 2 (tap the mic, speak; it stops on its own and the text is ready to send)
**Alternate paths**: Voice call (STORY-V03) for a spoken back-and-forth; no keyboard dictation shortcut is built into the app (the iOS keyboard's own mic still works in the text field)
**See also**: STORY-047

#### STORY-047: Dictation blocked by a denied permission
**Type**: short | **Source**: `topics/voice.md STORY-V02`
**Persona**: User who tapped "Don't Allow" once by reflex
**Goal**: Understand why the mic does nothing and fix it
**Ideal path**: 2 (read the notice, tap Open Settings)
**Alternate paths**: Go to iOS Settings → Praci manually
**See also**: STORY-046

#### STORY-048: Start a voice call and hold a conversation
**Type**: medium | **Source**: `topics/voice.md STORY-V03`
**Persona**: Founder driving, hands-free after the first tap
**Goal**: Ask the "Chief of staff" agent for a rundown and get it spoken back
**Ideal path**: 2 (tap Call, talk)
**Alternate paths**: Dictation plus reading the reply (STORY-V01); there is no read-aloud action on a message
**See also**: STORY-049, STORY-051

#### STORY-049: Call with permission denied
**Type**: short | **Source**: `topics/voice.md STORY-V04`
**Persona**: User who denied the microphone earlier
**Goal**: Get a call working
**Ideal path**: 2 (tap Open Settings in the call, allow, return)
**Alternate paths**: iOS Settings → Praci
**See also**: STORY-048

#### STORY-050: Mute, read the transcript, and the live caption
**Type**: short | **Source**: `topics/voice.md STORY-V05`
**Persona**: User in an open office who wants to silence the mic for a moment
**Goal**: Mute, read what was said, unmute
**Ideal path**: 3 (Mute, Transcript, Mute)
**Alternate paths**: Read the same exchanges later in the thread

#### STORY-051: Call interrupted by backgrounding or hang-up from the agent
**Type**: short | **Source**: `topics/voice.md STORY-V06`
**Persona**: User who gets a text and switches app mid-call
**Goal**: Know what happened to the call
**Ideal path**: 1 (return and see the thread)
**Alternate paths**: none found
**See also**: STORY-048

#### STORY-052: Choose how the agent sounds (voice settings)
**Type**: medium | **Source**: `topics/voice.md STORY-V07`
**Persona**: Power user who wants a nicer voice than the phone's
**Goal**: Connect a hosted voice, pick a voice, hear it
**Ideal path**: 6 (Settings, Voice, provider, paste key, Connect, pick voice)
**Alternate paths**: Meeting "Add speech to text" link (STORY-V09) reaches the same Voice screen; Home has no direct link
**See also**: STORY-054

#### STORY-053: Read-aloud setting on an agent
**Type**: short | **Source**: `topics/voice.md STORY-V08`
**Persona**: User who wants replies spoken without calling
**Goal**: Turn on "Read replies aloud" for the "Chief of staff" agent
**Ideal path**: 3 (open bot settings, toggle, save)
**Alternate paths**: none found
**See also**: STORY-016

#### STORY-054: Record a meeting when speech to text is not set up
**Type**: medium | **Source**: `topics/voice.md STORY-V09`; `topics/meetings.md STORY-003`
**Persona**: Founder starting a customer call recording
**Goal**: Start recording, then find Voice settings are needed first
**Ideal path**: 5 (Meetings, Record, set up speech to text, back, Start)
**Alternate paths**: none found
**See also**: STORY-052, STORY-077

#### STORY-055: Call while a meeting recording runs (conflict)
**Type**: short | **Source**: `topics/voice.md STORY-V10`
**Persona**: User recording a meeting who wants to ask an agent a quick question
**Goal**: Voice-ask during the meeting
**Ideal path**: 1 (type or dictate; here neither voice route works)
**Alternate paths**: type in the composer
**See also**: STORY-083, STORY-086, STORY-087

### Inbox

#### STORY-056: Morning triage of Needs reply, Today and Earlier
**Type**: medium | **Source**: `topics/inbox.md STORY-INB-01`
**Persona**: Maya Okafor, solo founder of a four-person logistics startup, one Gmail account
**Goal**: Find the mail that needs an answer, read it, and leave the list shorter.
**Ideal path**: 3. Open Inbox from Home, tap the top Needs reply row, reply or archive from the message.
**Alternate paths**: Home "Inbox" row (`inboxRow`, shows unread count) is the main route. A push or `rakazo://open/inbox` link opens the same screen. A To do card row opens a message directly (STORY-INB-09). The toolbar "Ask" button opens the Inbox agent thread and skips the list altogether.
**See also**: STORY-057, STORY-064, STORY-076

#### STORY-057: Swipe and long-press actions with Undo
**Type**: short | **Source**: `topics/inbox.md STORY-INB-02`
**Persona**: Idris Venter, operations lead who clears newsletters one-handed
**Goal**: Archive a newsletter, mark one thing as spam, and keep a message unread for later.
**Ideal path**: 1 per message (one swipe).
**Alternate paths**: Swipe left (Archive, Spam). Swipe right (Read or Unread). Long-press context menu (Mark as read/unread, Archive, Spam). On the message screen the toolbar "Archive" button. Cleanup screen for bulk senders (STORY-INB-08). Archive is reachable in four places for the same action.
**See also**: STORY-056, STORY-063, STORY-076

#### STORY-058: Choose between two Gmail accounts
**Type**: short | **Source**: `topics/inbox.md STORY-INB-03`
**Persona**: Priya Raman, founder with a company address and a personal address connected
**Goal**: See only the company mail, then go back to everything.
**Ideal path**: 3. Tap the account menu, pick the account, read the list.
**Alternate paths**: none found for filtering. Connecting or reconnecting an account is in Settings, Integrations (outside this topic).
**See also**: STORY-119

#### STORY-059: Search mail and act on a result
**Type**: short | **Source**: `topics/inbox.md STORY-INB-04`
**Persona**: Tomas Lindqvist, finance lead looking for a vendor invoice
**Goal**: Find the October invoice from Harbor Supply and open it.
**Ideal path**: 4. Tap the search field, type, tap Search on the keyboard, tap the result.
**Alternate paths**: "Ask" toolbar button lets the Inbox agent search in plain language (opens a thread, so it is a longer detour). No saved searches or filters.

#### STORY-060: Read plain mail and long HTML mail
**Type**: medium | **Source**: `topics/inbox.md STORY-INB-05`
**Persona**: Maya Okafor on a commute, reading a long customer newsletter and a plain-text note
**Goal**: Read each message to the end and reach the links and attachment.
**Ideal path**: 2. Open the message, scroll.
**Alternate paths**: none found; there is no reader mode or "open in browser" for the body.
**See also**: STORY-061, STORY-065

#### STORY-061: Wide HTML mail on a narrow phone
**Type**: short | **Source**: `topics/inbox.md STORY-INB-06`
**Persona**: Tomas Lindqvist reading a 700 px wide pricing table from a vendor
**Goal**: See all columns of the table.
**Ideal path**: 2. Open the message, pan or zoom to read the table.
**Alternate paths**: none found. The page-level vertical scroll is the only scrolling; inner scrolling is off and zoom is not enabled.
**See also**: STORY-060

#### STORY-062: Reply, Reply all and Forward
**Type**: long | **Source**: `topics/inbox.md STORY-INB-07`
**Persona**: Maya Okafor answering a customer's pricing question while on the train
**Goal**: Reply with two sentences, then forward the same thread to a teammate.
**Ideal path**: 4. Tap the reply menu, tap Reply, type, tap Send.
**Alternate paths**: The "Ask Inbox agent" button at the bottom opens a thread where the Inbox agent can draft a reply (approval card with Send/Save/Discard, see approvals topic). The toolbar "Ask" on the list does the same without a message in context. There is no swipe or long-press reply on the list.
**See also**: STORY-040, STORY-067, STORY-069

#### STORY-063: Clear out newsletters with Cleanup
**Type**: long | **Source**: `topics/inbox.md STORY-INB-08`
**Persona**: Idris Venter, three weeks behind, 400 unread newsletters from twelve senders
**Goal**: Archive everything from the noisy senders and unsubscribe from the ones he never reads.
**Ideal path**: 4. Open the menu, open Cleanup, confirm the preselected senders, tap Archive.
**Alternate paths**: Per-message "More" > "Unsubscribe from ..." on the message screen (STORY-INB-10). Swipe Archive per row (STORY-INB-02). Cleanup is the only bulk route; it sits behind the "More" (ellipsis) menu in the Inbox toolbar.
**See also**: STORY-057, STORY-065

#### STORY-064: Work the To do card
**Type**: short | **Source**: `topics/inbox.md STORY-INB-09`
**Persona**: Maya Okafor checking what the Inbox agent pulled out of her mail
**Goal**: Tick off a to-do and open the message behind another.
**Ideal path**: 1 to complete, 2 to open the message.
**Alternate paths**: none found for editing or adding a to-do; Meetings detail also lists to-dos (separate topic).
**See also**: STORY-056, STORY-080

#### STORY-065: Unsubscribe from a sender while reading
**Type**: short | **Source**: `topics/inbox.md STORY-INB-10`
**Persona**: Priya Raman reading a product-update email she no longer wants
**Goal**: Stop mail from this sender.
**Ideal path**: 3. Tap "More", tap "Unsubscribe from Loomly Updates", confirm.
**Alternate paths**: Cleanup screen (STORY-INB-08) handles many senders at once. No unsubscribe from a list row.
**See also**: STORY-060, STORY-063

#### STORY-066: Gmail problem states and empty states
**Type**: medium | **Source**: `topics/inbox.md STORY-INB-11`
**Persona**: Maya Okafor, first thing after her Google password changed
**Goal**: Understand why mail has stopped arriving and fix it.
**Ideal path**: 2. See the banner, tap Reconnect.
**Alternate paths**: Settings > Integrations also reconnects (the button routes there). The same "Connect Gmail" button appears in the no-account empty state.
**See also**: STORY-075, STORY-119

### Compose

#### STORY-067: Reply to a customer and send
**Type**: short | **Source**: `topics/compose.md STORY-001`
**Persona**: Maya Okafor, solo founder of a 4-person logistics startup
**Goal**: Answer Ana Ruiz's question about the pilot start date in one line.
**Ideal path**: 3 — open the reply, type the answer, tap Send (recipient, subject and quote are already filled).
**Alternate paths**: "Ask Inbox agent" on the same screen asks the agent to draft a reply instead (different feature, `inbox.agent`). No swipe or row-menu reply exists on the Inbox list in the code.
**See also**: STORY-040, STORY-062

#### STORY-068: Fix a mistyped recipient before sending
**Type**: short | **Source**: `topics/compose.md STORY-002`
**Persona**: Tomas Brandt, operations lead at a 12-person fintech
**Goal**: Forward-reply to two people and catch a typo in one address.
**Ideal path**: 3 — type the second address, see the inline error, correct it.
**Alternate paths**: none found. There is no contact suggestion list in the compose sheet.

#### STORY-069: Forward a message with its attachments
**Type**: medium | **Source**: `topics/compose.md STORY-003`
**Persona**: Priya Natarajan, finance lead at a 20-person startup
**Goal**: Forward a vendor invoice and its PDF to her accountant.
**Ideal path**: 4 — Forward, type the address, check the attachment is included, Send.
**Alternate paths**: none found. The agent can forward through approval cards (`MailApprovalCardView`), which is a separate route.
**See also**: STORY-062

#### STORY-070: Discard changes with the Cancel dialog
**Type**: short | **Source**: `topics/compose.md STORY-004`
**Persona**: Tomas Brandt
**Goal**: Back out of a half-written reply he no longer needs.
**Ideal path**: 2 — Cancel, Discard draft.
**Alternate paths**: Swipe down on the sheet does nothing while there are changes (`interactiveDismissDisabled`); with no changes it closes the sheet at once.

#### STORY-071: Save a draft and come back to it
**Type**: medium | **Source**: `topics/compose.md STORY-005`
**Persona**: Maya Okafor
**Goal**: Park a reply to an investor while she checks the numbers, then finish it.
**Ideal path**: 3 — Cancel, Save draft, then reopen and find the same text.
**Alternate paths**: none found for resuming. Tapping Reply again on the same message calls the prefill again and opens a new sheet with a new `clientId`; no draft list or "Drafts" folder exists in the app.

#### STORY-072: Send fails because Gmail rejects the message
**Type**: medium | **Source**: `topics/compose.md STORY-006`
**Persona**: Tomas Brandt
**Goal**: Send a reply, recover from a rejection, and send again.
**Ideal path**: 3 — Send, read the reason, fix the address and Send.
**Alternate paths**: none found.
**See also**: STORY-073

#### STORY-073: The connection drops while sending
**Type**: medium | **Source**: `topics/compose.md STORY-007`
**Persona**: Priya Natarajan, on a train with patchy signal
**Goal**: Send a payment confirmation without sending it twice.
**Ideal path**: 2 — Send, then confirm in Sent that it went out.
**Alternate paths**: Reading the Sent folder is done outside the app (Gmail); the app has no "Sent" view in the message screen.
**See also**: STORY-032, STORY-072

#### STORY-074: Write while the keyboard is open (long reply on a small phone)
**Type**: short | **Source**: `topics/compose.md STORY-008`
**Persona**: Maya Okafor, using the iPhone one-handed
**Goal**: Type a long reply and still reach Subject and the quote.
**Ideal path**: 2 — scroll down to dismiss the keyboard, tap Send.
**Alternate paths**: none found. There is no keyboard toolbar with a Done button.

#### STORY-075: Compose with no mail account connected
**Type**: short | **Source**: `topics/compose.md STORY-009`
**Persona**: Rui Tanaka, new user who has not connected Gmail
**Goal**: Understand why he cannot write mail.
**Ideal path**: 2 — see the message and go to the connect screen.
**Alternate paths**: Settings, Integrations lists Gmail to connect.
**See also**: STORY-066, STORY-119

#### STORY-076: Reply, then archive the thread in one pass
**Type**: long | **Source**: `topics/compose.md STORY-010`
**Persona**: Maya Okafor
**Goal**: Clear three "Needs reply" messages with short answers.
**Ideal path**: 9 — open, reply, send for each (3 steps each); archive is automatic or one tap.
**Alternate paths**: Ask Inbox agent to draft each reply (STORY-002 in `inbox.md`).
**See also**: STORY-056, STORY-057

### Meetings

#### STORY-077: Record a team call with the default reminder
**Type**: medium | **Source**: `topics/meetings.md STORY-001`
**Persona**: Priya Raman, founder of a 5-person freight-software startup
**Goal**: Record a vendor call and get a summary without leaving the app.
**Ideal path**: 4. Tap Record, type nothing, tap Start (grant the mic once), later tap Stop. The title defaults, so no typing is required.
**Alternate paths**: none found. Record exists only on the Meetings list toolbar; Home has no Record shortcut, and there is no deep link that starts a recording. (The web twin has its own Record control.)
**See also**: STORY-022, STORY-054, STORY-078, STORY-082

#### STORY-078: Record when the space requires everyone's agreement
**Type**: short | **Source**: `topics/meetings.md STORY-002`
**Persona**: Tomás Herrera, operations lead at a 12-person clinic-software company
**Goal**: Start a recording in a space whose policy is `confirm`.
**Ideal path**: 3. Tap Record, switch on the agreement, tap Start.
**Alternate paths**: none found.
**See also**: STORY-077

#### STORY-079: Search the Meetings list and open an older meeting
**Type**: short | **Source**: `topics/meetings.md STORY-004`
**Persona**: Naledi Mokoena, chief of staff at a 20-person fintech
**Goal**: Find last month's investor call.
**Ideal path**: 3. Pull the search field, type a word, tap the row.
**Alternate paths**: Ask an agent in a thread (not a Meetings feature). Data room > Recordings holds the same meetings as Markdown notes with its own search, and the Data room search finds text there too. No search inside a single meeting's transcript.

#### STORY-080: Read a finished meeting and tick off a to-do
**Type**: medium | **Source**: `topics/meetings.md STORY-005`
**Persona**: Naledi Mokoena
**Goal**: Check what was decided and mark an action as done.
**Ideal path**: 3. Open the meeting, scan, tap the circle on the to-do.
**Alternate paths**: The meeting to-do is saved through `inbox/todos/setDone`, the same call as Inbox to-dos, so it may also show in the Inbox "To do" card (not verified). Otherwise none found.
**See also**: STORY-064

#### STORY-081: Wait for a summary, then see it appear
**Type**: medium | **Source**: `topics/meetings.md STORY-006`
**Persona**: Priya Raman
**Goal**: Confirm that a just-recorded call turns into a summary and a Recordings note.
**Ideal path**: 2. The meeting opens by itself after Stop, and the summary appears by itself. After that the user should be told in one place where the notes went.
**Alternate paths**: Open Home > the Hex agent thread to find the server-written "Summarizing your new meeting" line with a link to the Recordings item (see facts). Open Data room > Recordings to find the note directly. Reopen Meetings later.
**See also**: STORY-085

#### STORY-082: Stop and wait while the recording is being stored
**Type**: medium | **Source**: `topics/meetings.md STORY-007`
**Persona**: Tomás Herrera
**Goal**: Stop a recording on a weak connection and trust that it is saved.
**Ideal path**: 1 action (Stop); the rest should be automatic.
**Alternate paths**: none found. The only controls for a recording are the bar's Stop and, before it starts, the Record sheet's Cancel. There is no Pause and no Discard.
**See also**: STORY-077

#### STORY-083: A call or Siri interrupts the recording
**Type**: short | **Source**: `topics/meetings.md STORY-008`
**Persona**: Naledi Mokoena
**Goal**: Keep one recording going through a phone call and an AirPods disconnect.
**Ideal path**: 0 extra actions. The recording resumes by itself.
**Alternate paths**: none found.
**See also**: STORY-055

#### STORY-084: Delete a meeting
**Type**: short | **Source**: `topics/meetings.md STORY-009`
**Persona**: Tomás Herrera
**Goal**: Remove a recording made by mistake.
**Ideal path**: 3. Open it, tap Delete, confirm.
**Alternate paths**: none found. The list has no swipe action or context menu for delete; it is available only inside the detail screen.
**See also**: STORY-085

#### STORY-085: Open a meeting from a deep link and from the Hex agent thread
**Type**: short | **Source**: `topics/meetings.md STORY-010`
**Persona**: Priya Raman
**Goal**: Jump from a message about a meeting to its detail.
**Ideal path**: 1. Tap the link.
**Alternate paths**: Home > Meetings > row. Data room > Recordings > the note (a copy of the content in Markdown, not the interactive detail).
**See also**: STORY-023, STORY-081, STORY-084, STORY-088, STORY-123

#### STORY-086: Recording while using the rest of the app
**Type**: long | **Source**: `topics/meetings.md STORY-011`
**Persona**: Priya Raman
**Goal**: Run a 45-minute call while reading mail, asking an agent a question and checking Settings.
**Ideal path**: 0 extra actions for the recording. The bar should never be in the way.
**Alternate paths**: none found. Settings is a sheet, so the bar is not shown while it is open; the only way to Stop from there is to close it.
**See also**: STORY-022, STORY-055

#### STORY-087: Start recording is refused because one already runs
**Type**: short | **Source**: `topics/meetings.md STORY-012`
**Persona**: Tomás Herrera
**Goal**: Understand why Record does nothing or errors.
**Ideal path**: 1. The user should see which recording is active and be able to stop it.
**Alternate paths**: none found.
**See also**: STORY-055

### Data room and artifacts

#### STORY-088: Browse the data room and open a PDF
**Type**: short | **Source**: `topics/data-room-and-artifacts.md STORY-001`
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Find the signed lease and read it.
**Ideal path**: 3 — Data room, Contracts, file (a preview should open from the row).
**Alternate paths**: (a) Search at the top of the list, then tap the hit (skips the folder). (b) Deep link `rakazo://open/data-room` lands on the root. No other route to a single file.
**See also**: STORY-085

#### STORY-089: Upload files and a photo, one fails and is retried
**Type**: medium | **Source**: `topics/data-room-and-artifacts.md STORY-002`
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Add a signed contract from Files and a photo of a receipt, and recover from a dropped upload.
**Ideal path**: 4 — Add, Files, pick, done (progress and result in place).
**Alternate paths**: (a) Empty folder: "Add files" button opens the same Files picker (Files only; no Photos or folder option). (b) Photos and Files are both under the same Add (+) menu. No drag and drop or share-sheet entry.

#### STORY-090: Search the data room and open a hit
**Type**: short | **Source**: `topics/data-room-and-artifacts.md STORY-003`
**Persona**: Priya Raman, finance lead at a seed-stage startup
**Goal**: Find the paragraph about the notice period across all files.
**Ideal path**: 3 — type in search, read the snippet, tap the hit.
**Alternate paths**: (a) Failed-files filter shows only files that failed (no text search). (b) Search is per folder when started inside a subfolder (filters on that folder), so the same query gives different results at the root.

#### STORY-091: Fix failed files with the Failed files filter
**Type**: medium | **Source**: `topics/data-room-and-artifacts.md STORY-004`
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: See which uploads the server could not read and remove them.
**Ideal path**: 4 — Filter, Failed files, open or delete a row.
**Alternate paths**: (a) Browse and scan each row for the red line without the filter. (b) Open the file and read the error on the item screen.

#### STORY-092: Allow AI to read the data room on first visit
**Type**: short | **Source**: `topics/data-room-and-artifacts.md STORY-005`
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Open the data room for the first time and decide whether AI may read the files.
**Ideal path**: 2 — open the data room, Allow.
**Alternate paths**: (a) Settings, AI data sharing lists and revokes consent. (b) Dismiss with Not now and the sheet does not return until the app restarts.
**See also**: STORY-120

#### STORY-093: Create folders and delete one
**Type**: short | **Source**: `topics/data-room-and-artifacts.md STORY-006`
**Persona**: Priya Raman, finance lead at a seed-stage startup
**Goal**: Make a folder "Tax 2026" at the root and remove an empty old folder.
**Ideal path**: 3 — Add, New folder, name, Create.
**Alternate paths**: (a) New folder is only in the Add menu (not in the empty state). (b) Folder delete is swipe-only; there is no folder screen menu.

#### STORY-094: Read an agent's artifacts: list, image and PDF
**Type**: medium | **Source**: `topics/data-room-and-artifacts.md STORY-007`
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Look at the charts and PDF the Ops agent made for the board update.
**Ideal path**: 4 — Ops thread, More, Artifacts, tap one.
**Alternate paths**: (a) Deep link `rakazo://open/bot/<id>/artifacts` or `rakazo://open/artifact/<id>`. (b) An artifact attachment in the thread. Group threads have no Artifacts entry.
**See also**: STORY-095, STORY-096

#### STORY-095: Read an HTML artifact and see why it looks static
**Type**: medium | **Source**: `topics/data-room-and-artifacts.md STORY-008`
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Open an interactive dashboard the agent built as an HTML artifact and use its tabs.
**Ideal path**: 3 — open the artifact, interact.
**Alternate paths**: (a) Same HTML as an Agent page runs scripts (SandboxedHTMLView). (b) The share sheet to open it in Safari.
**See also**: STORY-094, STORY-097

#### STORY-096: Move between artifact versions and delete all of them
**Type**: medium | **Source**: `topics/data-room-and-artifacts.md STORY-009`
**Persona**: Priya Raman, finance lead at a seed-stage startup
**Goal**: Compare version 2 of the "Hiring plan" artifact with the latest, then delete the artifact.
**Ideal path**: 5 — open, More, pick v2, read, Delete, confirm.
**Alternate paths**: (a) Delete from the list: swipe left or long press, Delete. (b) Open from the list at v3; older versions are only reachable through the More menu.
**See also**: STORY-094

#### STORY-097: Open an agent page, refresh a failed source and chat
**Type**: medium | **Source**: `topics/data-room-and-artifacts.md STORY-010`
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Check the Finance agent's page, notice a source warning, retry, and ask a follow-up in chat.
**Ideal path**: 4 — agent menu, Agent page, tap the warning, Retry.
**Alternate paths**: (a) Deep link `rakazo://open/bot/<id>/page`. (b) The "Open chat" button on the page returns to the thread. (c) Pages from Home: none; it is only in the thread's ellipsis menu.
**See also**: STORY-095, STORY-098, STORY-109

#### STORY-098: Share an agent page as a link and stop sharing
**Type**: short | **Source**: `topics/data-room-and-artifacts.md STORY-011`
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Send a read-only link of the Ops page to an advisor, then turn it off.
**Ideal path**: 4 — More, Share, send, More, Stop sharing, confirm.
**Alternate paths**: (a) Share an artifact file instead (artifact screen share icon): sends the file, not a link. (b) No Settings entry that lists active page links.
**See also**: STORY-097

### Business pages

#### STORY-099: Check runway, cash and burn on Finance
**Type**: short | **Source**: `topics/business-pages.md STORY-001`
**Persona**: Priya Anand, founder of a 4-person seed company, glancing at money before a board call
**Goal**: Read runway, cash and monthly burn.
**Ideal path**: 2 — Home "Finance" row, read the top card.
**Alternate paths**: Ask the Finance agent in a thread (answer arrives as a message, not on this page). Push notification routing to this page is not confirmed in the code read for this pass.
**See also**: STORY-023, STORY-103

#### STORY-100: Browse spend by period and open a transaction
**Type**: medium | **Source**: `topics/business-pages.md STORY-002`
**Persona**: Marcus Webb, operations lead reconciling a card charge
**Goal**: Find a specific charge and see its detail.
**Ideal path**: 4 — open Finance, pick period, tap the row, read detail.
**Alternate paths**: none found (no search, filter or sort on the transaction list).

#### STORY-101: Pull to refresh Finance and recover from a failed sync
**Type**: medium | **Source**: `topics/business-pages.md STORY-003`
**Persona**: Priya Anand, who just paid a vendor and wants it reflected
**Goal**: Pull fresh numbers from Mercury or Brex.
**Ideal path**: 1 — pull down.
**Alternate paths**: leaving and re-entering the page reloads without syncing providers (only `load`, not `finance/refresh`).

#### STORY-102: Finance empty state, then Connect
**Type**: medium | **Source**: `topics/business-pages.md STORY-004`
**Persona**: New founder, Dana Okafor, exploring before connecting banks
**Goal**: Connect Mercury so Finance shows data.
**Ideal path**: 3 — tap Connect, land on the Mercury connection, finish authorization.
**Alternate paths**: Home gear > Integrations > Mercury; asking the Finance agent in a thread may surface a connect card (`ConnectCardView` opens Integrations in a sheet).
**See also**: STORY-044

#### STORY-103: Hide amounts from the Finance toolbar
**Type**: short | **Source**: `topics/business-pages.md STORY-005`
**Persona**: Marcus Webb, reviewing numbers on a train
**Goal**: Mask money on screen quickly.
**Ideal path**: 1 — tap the eye in the toolbar.
**Alternate paths**: Settings sheet > "Hide amounts" toggle (same server preference). Legal and Cap table have no toggle of their own.
**See also**: STORY-099, STORY-104

#### STORY-104: Turn on Hide amounts in Settings and check the other pages
**Type**: medium | **Source**: `topics/business-pages.md STORY-006`
**Persona**: Dana Okafor, about to share her screen in a meeting
**Goal**: Make sure no dollar figure is visible on any business page.
**Ideal path**: 2 — toggle in Settings, reopen each page.
**Alternate paths**: Finance toolbar eye (Finance only).
**See also**: STORY-103, STORY-124

#### STORY-105: Legal first scan needs a model and consent
**Type**: long | **Source**: `topics/business-pages.md STORY-007`
**Persona**: Priya Anand, who wants contracts and deadlines pulled from the Data room
**Goal**: Run the first Legal scan.
**Ideal path**: 5 — open Legal, add a model key, allow reading, tap Scan now, wait.
**Alternate paths**: ask the Legal agent through "Ask Legal agent" in the toolbar (the agent then raises its own approval or connect card); Models can also be reached from Home "Connect a model" banner when `needsModel` is true.
**See also**: STORY-014, STORY-118, STORY-120

#### STORY-106: Triage deadlines: Done, Undo, Dismiss, Reopen, Keep
**Type**: long | **Source**: `topics/business-pages.md STORY-008`
**Persona**: Marcus Webb, clearing legal deadlines on Monday
**Goal**: Close the deadlines that are handled and keep the ones the scanner wants removed.
**Ideal path**: 2 per deadline — swipe Done on the row.
**Alternate paths**: open the deadline > "Mark done"; open the contract > Deadlines section > deadline > "Mark done". "Dismiss" and "Keep this deadline" exist only on the deadline detail.
**See also**: STORY-107

#### STORY-107: Read a contract and its deadlines
**Type**: short | **Source**: `topics/business-pages.md STORY-009`
**Persona**: Dana Okafor, checking when a vendor agreement renews
**Goal**: See renewal terms for one contract.
**Ideal path**: 3 — Legal, tap contract, read.
**Alternate paths**: ask the Legal agent through "Ask Legal agent" (opens a bot thread).
**See also**: STORY-106

#### STORY-108: Cap table with Carta not connected, then connected
**Type**: medium | **Source**: `topics/business-pages.md STORY-010`
**Persona**: Priya Anand, preparing for a financing
**Goal**: See ownership by holder.
**Ideal path**: 3 — Cap table row, tap Connect Carta, finish connection (then the table shows).
**Alternate paths**: Settings > Integrations > Carta; ask the Carta agent via the toolbar button.
**See also**: STORY-044

### Team computer

#### STORY-109: Watch the Finance agent work from the thread
**Type**: short | **Source**: `topics/team-computer.md STORY-001`
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: See what the Finance agent is doing on its desktop without touching it.
**Ideal path**: 3 - open the menu, choose Open computer, read the screen.
**Alternate paths**: (a) Home, "Team computer" row (always the first bot's computer, which may not be Finance); (b) a push or thread card is not available for this; (c) none other found.
**See also**: STORY-097, STORY-115

#### STORY-110: Wake a stopped computer
**Type**: medium | **Source**: `topics/team-computer.md STORY-002`
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Open a computer that is stopped and see the desktop.
**Ideal path**: 2 - open computer (it starts by itself), read the screen.
**Alternate paths**: (a) tap "Start computer" in the placeholder if the auto start is not wanted to be waited on (it does the same call); (b) "Take control" on a suspended computer wakes it and takes control in one step; (c) none other.

#### STORY-111: Take control and type a one-time code
**Type**: medium | **Source**: `topics/team-computer.md STORY-003`
**Persona**: Priya Raman, founder
**Goal**: Fill a login code into a vendor page on the agent's desktop.
**Ideal path**: 5 - Take control, tap the field, Show keyboard, type, Release control.
**Alternate paths**: none found.
**See also**: STORY-112, STORY-114

#### STORY-112: Answer a takeover request from the agent
**Type**: medium | **Source**: `topics/team-computer.md STORY-004`
**Persona**: Jordan Reyes, investor-relations lead
**Goal**: The agent needs the user to log in by hand; do it and hand back.
**Ideal path**: 4 - notice the request, Open computer, log in, "I'm done".
**Alternate paths**: (a) open from the thread menu "Open computer"; (b) Home "Team computer" row (only if this is the first bot); (c) tapping a notification does not open the computer (no computer target in the notification router).
**See also**: STORY-111, STORY-113

#### STORY-113: Release control without finishing
**Type**: short | **Source**: `topics/team-computer.md STORY-005`
**Persona**: Tomas Lindqvist
**Goal**: Hand the computer back to the agent after poking at something.
**Ideal path**: 1 - "Release control".
**Alternate paths**: (a) "Close" without releasing keeps the lease; the server expires it (the app does not release on close, only stops polling); (b) none other.
**See also**: STORY-112

#### STORY-114: Come back after leaving the app
**Type**: short | **Source**: `topics/team-computer.md STORY-006`
**Persona**: Maya Okafor
**Goal**: Resume watching after a phone call.
**Ideal path**: 1 - return to the app.
**Alternate paths**: none found.
**See also**: STORY-111

#### STORY-115: Open the first computer from Home
**Type**: short | **Source**: `topics/team-computer.md STORY-007`
**Persona**: New user with three agents
**Goal**: Find "the Team computer" from Home.
**Ideal path**: 2 - tap Team computer, read the screen.
**Alternate paths**: thread menu "Open computer" (per agent).
**See also**: STORY-023, STORY-109

### Settings and trust

#### STORY-116: Check what Settings currently says and close it
**Type**: short | **Source**: `topics/settings-and-trust.md STORY-001`
**Persona**: Priya Nair, solo founder with a hosted model connected
**Goal**: See her name, then get back to Home.
**Ideal path**: 2 (open Settings, read, Done). The gear opens it and "Done" closes it.
**Alternate paths**: The thread toolbar menu has "Settings", but for a bot it opens the bot's settings, not this sheet (see Manage/BotSettingsScreen). The Integrations screen can also be reached from an agent's "Connect" card (STORY-005). Account is reachable from the profile row only.

#### STORY-117: Switch the default model and its thinking level
**Type**: medium | **Source**: `topics/settings-and-trust.md STORY-002`
**Persona**: Marcus Webb, founder who cares about cost
**Goal**: Move agents to a cheaper model and lower the thinking level.
**Ideal path**: 4 (Models, Model row, pick a model, optional Thinking menu).
**Alternate paths**: none found. The model chooser lists only models of connected providers; connecting another provider is a separate path (STORY-003).
**See also**: STORY-014

#### STORY-118: Replace and remove a provider key
**Type**: short | **Source**: `topics/settings-and-trust.md STORY-004`
**Persona**: Marcus Webb
**Goal**: Rotate an API key, then disconnect an unused provider.
**Ideal path**: 3 for rotating (provider row, paste key, Save key); 2 for removing (provider row, Disconnect, confirm = 3).
**Alternate paths**: none found.
**See also**: STORY-105

#### STORY-119: Review a connected account, allow writes, then reconnect it
**Type**: medium | **Source**: `topics/settings-and-trust.md STORY-006`
**Persona**: Priya Nair
**Goal**: Let bots send mail from her work Gmail, knowing each send still needs her approval.
**Ideal path**: 3 (Integrations, the account row, Allow writes plus confirm = 4).
**Alternate paths**: Writes can be gated per tool through "Allowed without asking" (STORY-008). An agent's mail approval card also controls single sends.
**See also**: STORY-044, STORY-058, STORY-066, STORY-075

#### STORY-120: Withdraw AI data sharing, then recover a paused agent
**Type**: long | **Source**: `topics/settings-and-trust.md STORY-007`
**Persona**: Marcus Webb, privacy-conscious
**Goal**: Stop sending recordings to a voice provider, and understand why agents stopped when he switched model sharing off.
**Ideal path**: 3 (AI data sharing, switch off, done). Re-allowing is 3 (switch on, Allow in sheet).
**Alternate paths**: The same consent sheet appears the first time an agent run needs a recipient (`app.consent.ensure`), so granting is available inside the thread flow and in Settings.
**See also**: STORY-092, STORY-105

#### STORY-121: Add an approval rule and stop asking for a trusted action
**Type**: medium | **Source**: `topics/settings-and-trust.md STORY-008`
**Persona**: Marcus Webb
**Goal**: Let agents archive mail without asking, but block posting to social sites.
**Ideal path**: 4 (Allowed without asking, add, name and action, Save).
**Alternate paths**: Approving a card in the thread covers one case; "Always allow" style choices on cards may create rules (see the approvals topic). Rules can be edited here by changing a row's menu.
**See also**: STORY-035, STORY-043

#### STORY-122: Choose which alerts reach the phone
**Type**: short | **Source**: `topics/settings-and-trust.md STORY-009`
**Persona**: Priya Nair
**Goal**: Get told when an agent needs her, not when it finishes.
**Ideal path**: 3 (Settings, Notifications, switch off Finishes).
**Alternate paths**: iOS system settings for the app. There is no link to it from this screen and no row showing whether iOS permission was granted.
**See also**: STORY-123

#### STORY-123: Tap a push and land in the right thread
**Type**: medium | **Source**: `topics/settings-and-trust.md STORY-010`
**Persona**: Marcus Webb
**Goal**: Open the thread an agent pinged him from, in the correct space.
**Ideal path**: 1 (tap the notification).
**Alternate paths**: `rakazo://open/bot/<id>` opens a bot thread but does not switch space; only push payloads carry `spaceId`.
**See also**: STORY-010, STORY-025, STORY-085, STORY-122

#### STORY-124: Look at usage, hide amounts and set the look
**Type**: short | **Source**: `topics/settings-and-trust.md STORY-011`
**Persona**: Priya Nair, about to share her screen
**Goal**: Hide dollar amounts and use dark mode.
**Ideal path**: 3 (Hide amounts switch, Appearance menu, choose Dark).
**Alternate paths**: none found for the switch. Usage is read only.
**See also**: STORY-104

#### STORY-125: Restore an archived agent
**Type**: short | **Source**: `topics/settings-and-trust.md STORY-012`
**Persona**: Priya Nair
**Goal**: Bring back the Research agent she archived last week.
**Ideal path**: 2 (Archived agents, Restore).
**Alternate paths**: Bot settings has an archive/restore action (Manage/BotSettingsScreen). The Home row menu and thread menu only archive, with an undo toast.
**See also**: STORY-016

#### STORY-126: Change the password, then sign out
**Type**: medium | **Source**: `topics/settings-and-trust.md STORY-013`
**Persona**: Marcus Webb
**Goal**: Change the account password and sign out of a shared iPad-style handoff.
**Ideal path**: 4 for the password (profile row, Change password, three fields, Save password); 1 for sign out.
**Alternate paths**: "Sign out" is both on the Settings list and on Account.
**See also**: STORY-009

#### STORY-127: Delete the account
**Type**: medium | **Source**: `topics/settings-and-trust.md STORY-014`
**Persona**: Marcus Webb, closing the account
**Goal**: Permanently delete the account.
**Ideal path**: 4 (Account, Delete account, enter proof, Delete).
**Alternate paths**: none found.
**See also**: STORY-009


## ID Map

Topic files reuse local IDs such as STORY-001, so each local ID is mapped to its catalog ID here. Local IDs are the number after the topic's own prefix (`H` for Home and spaces, `V` for Voice, `INB-` for Inbox).

| Topic file | Local ID | Catalog ID |
| --- | --- | --- |
| `sign-in-and-server` | 001 | STORY-001 |
| `sign-in-and-server` | 002 | STORY-002 |
| `sign-in-and-server` | 003 | STORY-003 |
| `sign-in-and-server` | 004 | STORY-004 |
| `sign-in-and-server` | 005 | STORY-005 |
| `sign-in-and-server` | 006 | STORY-006 |
| `sign-in-and-server` | 007 | STORY-007 |
| `sign-in-and-server` | 008 | STORY-008 |
| `sign-in-and-server` | 009 | STORY-009 |
| `sign-in-and-server` | 010 | STORY-010 |
| `sign-in-and-server` | 011 | STORY-011 |
| `home-and-spaces` | H01 | STORY-012 |
| `home-and-spaces` | H02 | STORY-013 |
| `home-and-spaces` | H03 | STORY-014 |
| `home-and-spaces` | H04 | STORY-015 |
| `home-and-spaces` | H05 | STORY-016 |
| `home-and-spaces` | H06 | STORY-017 |
| `home-and-spaces` | H07 | STORY-018 |
| `home-and-spaces` | H08 | STORY-019 |
| `home-and-spaces` | H09 | STORY-020 |
| `home-and-spaces` | H10 | STORY-021 |
| `home-and-spaces` | H11 | STORY-022 |
| `home-and-spaces` | H12 | STORY-023 |
| `agent-thread` | 001 | STORY-024 |
| `agent-thread` | 002 | STORY-025 |
| `agent-thread` | 003 | STORY-026 |
| `agent-thread` | 004 | STORY-027 |
| `agent-thread` | 005 | STORY-028 |
| `agent-thread` | 006 | STORY-029 |
| `agent-thread` | 007 | STORY-030 |
| `agent-thread` | 008 | STORY-031 |
| `agent-thread` | 009 | STORY-032 |
| `agent-thread` | 010 | STORY-033 |
| `agent-thread` | 011 | STORY-034 |
| `approvals` | 001 | STORY-035 |
| `approvals` | 002 | STORY-036 |
| `approvals` | 003 | STORY-037 |
| `approvals` | 004 | STORY-038 |
| `approvals` | 005 | STORY-039 |
| `approvals` | 006 | STORY-040 |
| `approvals` | 007 | STORY-041 |
| `approvals` | 008 | STORY-042 |
| `approvals` | 009 | STORY-043 |
| `approvals` | 010 | STORY-044 |
| `approvals` | 011 | STORY-045 |
| `voice` | V01 | STORY-046 |
| `voice` | V02 | STORY-047 |
| `voice` | V03 | STORY-048 |
| `voice` | V04 | STORY-049 |
| `voice` | V05 | STORY-050 |
| `voice` | V06 | STORY-051 |
| `voice` | V07 | STORY-052 |
| `voice` | V08 | STORY-053 |
| `voice` | V09 | STORY-054 |
| `voice` | V10 | STORY-055 |
| `inbox` | INB-01 | STORY-056 |
| `inbox` | INB-02 | STORY-057 |
| `inbox` | INB-03 | STORY-058 |
| `inbox` | INB-04 | STORY-059 |
| `inbox` | INB-05 | STORY-060 |
| `inbox` | INB-06 | STORY-061 |
| `inbox` | INB-07 | STORY-062 |
| `inbox` | INB-08 | STORY-063 |
| `inbox` | INB-09 | STORY-064 |
| `inbox` | INB-10 | STORY-065 |
| `inbox` | INB-11 | STORY-066 |
| `compose` | 001 | STORY-067 |
| `compose` | 002 | STORY-068 |
| `compose` | 003 | STORY-069 |
| `compose` | 004 | STORY-070 |
| `compose` | 005 | STORY-071 |
| `compose` | 006 | STORY-072 |
| `compose` | 007 | STORY-073 |
| `compose` | 008 | STORY-074 |
| `compose` | 009 | STORY-075 |
| `compose` | 010 | STORY-076 |
| `meetings` | 001 | STORY-077 |
| `meetings` | 002 | STORY-078 |
| `meetings` | 003 | STORY-054 (merged duplicate) |
| `meetings` | 004 | STORY-079 |
| `meetings` | 005 | STORY-080 |
| `meetings` | 006 | STORY-081 |
| `meetings` | 007 | STORY-082 |
| `meetings` | 008 | STORY-083 |
| `meetings` | 009 | STORY-084 |
| `meetings` | 010 | STORY-085 |
| `meetings` | 011 | STORY-086 |
| `meetings` | 012 | STORY-087 |
| `data-room-and-artifacts` | 001 | STORY-088 |
| `data-room-and-artifacts` | 002 | STORY-089 |
| `data-room-and-artifacts` | 003 | STORY-090 |
| `data-room-and-artifacts` | 004 | STORY-091 |
| `data-room-and-artifacts` | 005 | STORY-092 |
| `data-room-and-artifacts` | 006 | STORY-093 |
| `data-room-and-artifacts` | 007 | STORY-094 |
| `data-room-and-artifacts` | 008 | STORY-095 |
| `data-room-and-artifacts` | 009 | STORY-096 |
| `data-room-and-artifacts` | 010 | STORY-097 |
| `data-room-and-artifacts` | 011 | STORY-098 |
| `business-pages` | 001 | STORY-099 |
| `business-pages` | 002 | STORY-100 |
| `business-pages` | 003 | STORY-101 |
| `business-pages` | 004 | STORY-102 |
| `business-pages` | 005 | STORY-103 |
| `business-pages` | 006 | STORY-104 |
| `business-pages` | 007 | STORY-105 |
| `business-pages` | 008 | STORY-106 |
| `business-pages` | 009 | STORY-107 |
| `business-pages` | 010 | STORY-108 |
| `team-computer` | 001 | STORY-109 |
| `team-computer` | 002 | STORY-110 |
| `team-computer` | 003 | STORY-111 |
| `team-computer` | 004 | STORY-112 |
| `team-computer` | 005 | STORY-113 |
| `team-computer` | 006 | STORY-114 |
| `team-computer` | 007 | STORY-115 |
| `settings-and-trust` | 001 | STORY-116 |
| `settings-and-trust` | 002 | STORY-117 |
| `settings-and-trust` | 003 | STORY-014 (merged duplicate) |
| `settings-and-trust` | 004 | STORY-118 |
| `settings-and-trust` | 005 | STORY-044 (merged duplicate) |
| `settings-and-trust` | 006 | STORY-119 |
| `settings-and-trust` | 007 | STORY-120 |
| `settings-and-trust` | 008 | STORY-121 |
| `settings-and-trust` | 009 | STORY-122 |
| `settings-and-trust` | 010 | STORY-123 |
| `settings-and-trust` | 011 | STORY-124 |
| `settings-and-trust` | 012 | STORY-125 |
| `settings-and-trust` | 013 | STORY-126 |
| `settings-and-trust` | 014 | STORY-127 |

## Merged stories

- STORY-014 (Connect a model from the Home banner) absorbs the Settings and trust story of the same name (`settings-and-trust.md` STORY-003). Both used the same sheet and goal; the Settings version's failure cases (local server on another network, closing the sheet mid-flow) are kept in the Settings topic file and findings 24 and 27.
- STORY-054 (Record a meeting when speech to text is not set up) absorbs `meetings.md` STORY-003, which describes the same sheet row "Add speech to text" and the same route to Voice settings.
- STORY-044 (Connect an app the agent needs) absorbs `settings-and-trust.md` STORY-005 (Connect Calendar when an agent asks). The card, its sheet and the Integrations flow are the same; only the app differs.

Stories that overlap but were kept because they test different outcomes: STORY-062 with STORY-067 and STORY-069 (the Inbox story goes through the message screen and archive; the Compose stories cover the sheet's fields and failures), STORY-104 with STORY-124 (the first checks the other pages, the second covers usage and appearance too), STORY-120 with STORY-092 (withdrawing consent versus first-visit consent), and STORY-009 with STORY-126 (sign out versus change password first).

## Cross-references between topics

| Link | Why they connect |
| --- | --- |
| Sign-in and server -> Settings and trust | Sign out and server change meet in STORY-009, STORY-011 and STORY-126. |
| Home and spaces -> Settings and trust | The model banner and Archived agents meet in STORY-014 and STORY-125; the gear opens Settings. |
| Home and spaces -> Meetings | The recording bar shows on Home (STORY-022) and on pushed screens (STORY-086). |
| Agent thread -> Approvals | Approval cards live in the thread; STORY-045 depends on thread behavior in STORY-026. |
| Agent thread -> Voice | The mic and the phone button are in the composer and toolbar (STORY-046, STORY-048). |
| Approvals -> Settings and trust | "Allowed without asking" removes cards (STORY-121); connect cards open Integrations (STORY-044, STORY-119). |
| Approvals -> Compose | The mail approval card sends mail the agent drafted (STORY-040) while Compose sends mail the person wrote (STORY-067). |
| Inbox -> Compose | Reply and Forward are reached only from the message screen (STORY-062, STORY-067). |
| Inbox -> Meetings | Meeting to-dos use the Inbox to-do call (STORY-080, STORY-064). |
| Voice -> Meetings | One audio session: dictation and calls stop while a meeting records (STORY-055, STORY-087). |
| Meetings -> Data room | A meeting is filed as a Markdown note in Data room > Recordings (STORY-085, STORY-088). |
| Data room -> Settings and trust | AI consent in the Data room and in Settings (STORY-092, STORY-120). |
| Data room (agent page) -> Team computer | The Finance agent's page, computer and artifacts are all reached from the same thread menu (STORY-097, STORY-109). |
| Business pages -> Settings and trust | Hide amounts and every Connect button end in Settings (STORY-104, STORY-124, STORY-102). |
| Business pages -> Approvals | A Connect empty state and the connect card lead to the same Integrations screen (STORY-102, STORY-044). |

## Redundancy Candidates

Input for `/ux-flow`. Each line comes from a story's Alternate paths or from a topic's note on information shown more than once.

### Duplicate paths (same goal, multiple routes)

- Archive a mail message: swipe in the list, long-press menu, the message toolbar "Archive", and Cleanup for bulk senders (STORY-057, STORY-063) - same result; only Cleanup also unsubscribes.
- Connect a model: Home banner "Connect a model", Settings > Models, and the Legal "Add your OpenRouter key" button (STORY-014, STORY-105). The Legal button opens Settings at the top level, not at Models, so it is a different and longer path.
- Connect an app: the in-thread connect card (sheet) and Settings > Integrations (pushed) are the same screen shown twice (STORY-044, STORY-119). Finance and Cap table "Connect" buttons also open Settings at the top level (STORY-102, STORY-108).
- Fix missing speech to text: Record sheet "Add speech to text" and Settings > Voice reach the same screen (STORY-054, STORY-052); Home "Connect a model" is a different setup that does not fix it.
- Answer an agent's question: the card field and the composer (STORY-038) - divergent: the composer sends a new message and does not mention the open question.
- Answer an approval: the iOS card, the web app and the Expo app; or pre-approve in "Allowed without asking" (STORY-035, STORY-121).
- Open a computer: Home "Team computer" row (the first bot's computer) and the thread menu "Open computer" (that bot's own) (STORY-115, STORY-109) - divergent targets.
- Open a meeting: Home > Meetings row, deep link, the Hex agent's thread link, and the Data room Recordings note, which is a Markdown copy, not the meeting detail (STORY-085, STORY-079, STORY-088).
- Start a recording: only the Meetings list toolbar; Home has no shortcut (STORY-077) - no duplicate, but see Gaps.
- Hide amounts: Finance toolbar and Settings toggle, one server preference (STORY-103, STORY-104); Legal and Cap table have no toggle of their own and do not reload.
- Sign out: the Settings list row and Account > Sign out, neither with a confirmation (STORY-009, STORY-126).
- Rename or archive an agent: the row long-press menu and the agent's Settings screen (STORY-016); Archive also appears in the thread menu.
- Delete a data room file: swipe in the list, the item screen toolbar and a search-result swipe (STORY-088, STORY-090).
- Delete an artifact: swipe, context menu and the More menu on the detail screen (STORY-096).
- Share a link: artifact share and agent page share are separate controls with different behavior (STORY-096, STORY-098).
- Ask the Inbox agent: the list toolbar "Ask", "Ask Inbox agent" on a message, and To do rows (STORY-056, STORY-064).
- Mark a deadline done: swipe on the row, "Mark done" on the deadline detail, and on the contract's Deadlines section; Dismiss and Keep exist only on the detail (STORY-106).
- Open the Inbox: Home row, push, `rakazo://open/inbox`, and the To do card row (STORY-056).
- Open Settings > AI data sharing consent: Settings, the Data room consent sheet, and the global consent sheet before any AI request (STORY-120, STORY-092).
- Restore an archived agent: only Settings > Archived (STORY-125); the undo toast is the only other way and it expires (STORY-016).

### Duplicate information (same fact, multiple surfaces)

- Unread count: on the Home Inbox row and again on the Inbox screen (STORY-012, STORY-056).
- An agent's name and unread state: Home row, thread header, and Settings > Archived (STORY-012, STORY-125).
- The current space name: the Home nav title and the title menu picker (STORY-018).
- A data room file's name, type and date: list row, search-result row and item screen; failed-file errors in the row and on the item screen (STORY-088, STORY-090, STORY-091).
- An artifact: Artifacts list (title, kind, "v2 of 3"), its own screen (a "v2 of 3" strip and the Versions picker), and a thread attachment (STORY-094, STORY-096).
- Meeting content: the Meetings detail and the Recordings note in the Data room; a "Summarizing your new meeting" line in the agent's thread (STORY-080, STORY-085).
- Recording state: the bar on every pushed screen, and the Meetings list toolbar hides Record while busy (STORY-082, STORY-086).
- Offline state: the thread "Offline" line (global to the queue), the Inbox (none), and the recording bar "Offline, saved here" (STORY-032, STORY-066, STORY-082).
- Money figures: Finance page, Legal values, Cap table amounts and the Finance agent's page and artifacts all show them, with Hide amounts applied separately on each (STORY-099, STORY-104, STORY-097).
- Approval reasons: the footnote under each card, the mail card hiding it after the answer, and the web card's "Clear conversation" link that iOS lacks (STORY-043).
- A to-do: Inbox To do card and meeting to-dos share one call, so a meeting to-do may appear in both (STORY-064, STORY-080).
- Account name and sign-in method: Settings profile row and Account (STORY-126).

### Overlapping features/tools

- Artifacts and Agent pages both show agent-made content. Artifact HTML runs with scripts off; an Agent page runs sandboxed HTML. The same content can behave differently (STORY-095, STORY-097) - distinct enough to keep both only if the difference is explained.
- The Finance page and the Finance agent's page both show runway and spend (STORY-099, STORY-097).
- Data room Recordings notes and Meetings detail (STORY-085, STORY-088).
- Legal deadlines, Inbox To do and meeting to-dos are three to-do lists (STORY-106, STORY-064, STORY-080).
- Cleanup and swipe Archive plus message Unsubscribe do the same bulk action in smaller steps (STORY-063, STORY-057, STORY-065).
- Dictation and Voice call both turn speech into a message; they use one audio session and both stop during a recording (STORY-046, STORY-048).
- Mail approval card and the Compose sheet both send mail; one the agent drafted, one the person wrote (STORY-040, STORY-067).
- Compose "Save draft" and the agent's drafts: drafts save to the server but there is no drafts list (STORY-071).
- Models settings and Voice settings both take provider keys; the Home banner fixes only models (STORY-014, STORY-052).
- Team computer and Private computer are one screen with two titles (STORY-109).
- Settings Integrations and the in-thread connect card (STORY-044, STORY-119).
- Archived agents (Settings) and the archive undo toast (STORY-125, STORY-016).

## Gaps & Recommendations

- **Routines** (list, detail, pause and resume, history) are built (`Routines/*`) and in the discovery Feature Map but no topic has a story. The old plan-era `computer-artifacts.md` described them from design boards; its text was not carried over because it describes planned screens. Suggested: two stories (pause a routine from the list; read a routine's history and Load more).
- **New message from the Inbox** cannot be walked because no UI path exists (finding 5). Suggested: a story to add after a Compose button exists; until then keep STORY-075 as the only no-account case.
- **Message block types** other than text and tool steps (tables, images, files, subagent steps, unsupported blocks) have no story. Suggested: one thread story with a table, an image and an unknown block, including horizontal scrolling inside the vertical thread (finding 54).
- **Bot and Group settings** screens: section picker, color, role, delete group and the discard-changes dialog on Back. Suggested: one medium story.
- **Deep links** other than meetings and bot threads (`inbox/<id>`, `finance`, `legal`, `cap-table`, `data-room`, `artifact/<id>`, `routine/<id>`, the `bot/<id>/...` family) and deep links while signed out. Suggested: one short story per link family, run from the command line with `xcrun simctl openurl`.
- **Capture recovery**: resume after relaunch, an unrecoverable capture alert and chunk-upload retry. Suggested: one long story with the app killed mid-recording.
- **Sign-in capability states**: "Retry connection" and "No sign-in method is available on this server". Suggested: one short story against a server that reports no methods.
- **Accessibility and Dynamic Type**: only the fixed-height sheets (finding 51) mention large text. Suggested: a pass at the largest text size and with VoiceOver on Home, Thread and Inbox, as stories with the same persona.
- **Real-service stories** need a demo stack and cannot be walked offline: Gmail (Inbox, Compose), transcription (Record), Mercury, Brex and Carta, SSO, and push. Push registration is not wired, so only synthetic notifications work.
- **Cross-topic long stories** worth adding: morning routine (open app, approve a tool, triage mail, check Finance, start a meeting recording); first day on a new phone (sign in, connect model, create agent, send a message, connect Gmail, first Cleanup); a day with a recording (record, read mail, answer an approval, stop, read the summary).
- **Walk order**: finding 1 first (Inbox and an email do not scroll), then findings 2 to 4 (thread scrolling), then 5 to 15, then the stale-list cluster (27 to 34).
