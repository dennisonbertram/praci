# iOS native app: UX planning index

This folder holds UX planning for the native iPhone app (epic #427, phases #412 to #426). No native code exists, so every check is made against the design boards in `docs/design-system/ios/boards/`, rendered locally with a preview shim and screenshotted. Boards are static, so each journey step is judged against the board that draws it.

## Files

- [discovery.md](discovery.md): what the app must cover, from the plan and the Expo app.
- [catalog.md](catalog.md): the journey stories, coverage matrix, redundancy candidates and design gaps by phase.
- [flow/journeys/](flow/journeys/) and [flow/redundancy.md](flow/redundancy.md): the latest `/ux-flow` critiques.
- [walker/](walker/): the latest `/ux-walker` findings per topic, with each earlier finding marked resolved or open.
- [visual/problems.md](visual/problems.md), [visual/pages/](visual/pages/), [visual/decisions/](visual/decisions/): the latest `/ux-visual` problem register, page critiques and judged design decisions.
- [flow/report.md](flow/report.md) and [walker/latest-report.md](walker/latest-report.md): the first run's reports, kept as the baseline.

## Rounds

The five largest gaps from the first run were designed, then `/ux-paths`, `/ux-flow`, `/ux-walker` and `/ux-visual` ran in rounds. Each round audited every board, judged the problems that had more than one reasonable design, and fixed the rest. Counts are open issues found at the start of each round, before that round's fixes.

| Round | Boards | Critical | High | Medium | Low |
| --- | --- | --- | --- | --- | --- |
| 1 | 54 | 2 | 40 | 150 | 90 |
| 2 | 58 | 0 | 21 | 100 | 100 |
| 3 | 59 | 0 | 9 | 62 | 120 |

Round 3's fixes have not been re-audited. Low findings are mostly polish and were fixed only when they were one-line changes.

## The five gaps from the first run

1. **Outer-display route to Finance, Legal, Cap table and Data room:** Home has a Pages section on the Duo outer display, the inner sidebar and standard iPhone (`PG-A-Home`, `Split`, `PH-Home`, `PH-Pages`).
2. **Standard iPhone:** `PH-Home`, `PH-Pages`, `PH-Spaces`, `PH-Thread`, `PH-GroupThread`, `PH-Inbox`, `PH-Computer`. Artifacts, Agent page, Routine and the form sheets use the Duo layout only (see the decisions below).
3. **No model connected:** Home shows one "Connect a model" action that opens a provider sheet, then "Message Chief" (`PG-A-HomeNoModel`, `PH-Home`).
4. **Mail approval card and send states:** one mail card everywhere; offline, failed (Retry) and refused (Edit) sends; the AI data consent sheet (`PG-A-Thread`, `PG-A-ThreadStates`, `PG-B-Consent`, `DS-06-Chat`).
5. **Missing screens:** space switcher and Space settings, sign-up, password reset, Account with sign out and delete account, Compose, Cleanup, Activity (`PG-B-Spaces`, `PH-Spaces`, `PG-B-SignUp`, `PG-B-ForgotPassword`, `PG-B-Account`, `PG-A-Compose`, `PG-A-Cleanup`, `PG-A-Activity`).

## Product decisions made with a default

The boards use these defaults. Each one can be changed by the owner.

- Standard iPhone coverage: Artifacts, Artifact, Image, Agent page, Routine and the form sheets are drawn for the Duo only.
- Reactions in chat: in v1, with the six-emoji picker specified in `DS-06-Chat` and drawn on `PH-Thread`.
- Sample signed-in person: Alex Morgan (AM) everywhere.
- Inner display: Compose sits in More while a message is open.
- Provider failure copy (contract scanning, Carta, Mercury): plain wording, no vendor names.
- Delete account for SSO users: re-authenticate with the provider, then confirm. The server must support this.
- Standing "Always allow" is offered only for read-only tools. Money and send tools always ask, in the thread and in Settings (`DS-06-Chat`, `PG-B-Settings`).
- Unsubscribe in Cleanup cannot be undone, and the confirmation says so before it runs.
- Inbox swipe actions: Archive and Spam only, matching the API.
- Routine actions: Pause and Edit; "Run now" waits for an API.
- Hosted voice, the banking connector and "Allow writes" confirmation are drawn as specified; their server behavior is still planned.

## Decisions listed in the first run (34, from the catalog's Design Gaps by Phase)

Several of these are now settled on the boards; the catalog's current Design Gaps by Phase section is the up-to-date list.

### #412 (Scaffold and tokens)
- Working-indicator color: three blue dots (Thread rule card) or neutral dots with a `statusWorking` ring (DS-06).

### #413 (Contracts export)
- What the UI does when the server lacks a procedure: hide, disable, or explain.

### #414 (Server selection and sign in)
- Product name in strings: resolved, Praci (boards updated to match Expo in this run).
- Which mode the app opens in on first launch: sign-up (Expo) or sign-in (board).
- Whether to confirm before a server change wipes a signed-in session.
- What happens to the outbox and unsent drafts after a forced sign-out.

### #415 (Home, spaces, bots and groups)
- Accessible names for Home controls: Expo "Account / Activity / Search / Artifacts / Create" or board "New".
- Where Create lands (thread or back to Home) for a new bot and a new group.
- Space switcher: control, current-space indicator, failure states, inline groups (Expo) or one flat list (boards).
- Space rename, delete, "default space", and member or invite flows.
- Onboarding choice cards and focus prompts: whether iOS gets a screen.

### #416 (Thread read)
- Paging: a "Load earlier messages" button (Expo) or a spinner only (rule card).
- Silent retry or a visible offline state in a thread.
- Suggestion chips: send immediately or only fill the composer.
- Interim behavior of approval cards in read-only phase 4 versus phase 5.

### #417 (Thread write, approvals and consent)
- Scope of mentions: agents only, or humans too.
- Send and Stop share one trailing slot: what shows when text is typed during a run, and the stopping and stop-failure states.
- Mail approval card: Deny/Allow or Save/Send, and which card title.
- Edit-and-send screen: build it, or edit by telling the agent.
- "Always allow" rules and auto review: whether iOS gets a screen.

### #418 (Inbox)
- Section names: "Other mail today" (board) or "Today" and "Earlier" (plan, Expo).
- Cleanup and unsubscribe flow: whole flow has no board; confirm it belongs to phase 6.
- Mail connection states: writes off, reconnect, rate limited, no mail account.

### #419 (Duo layouts)
- Posture change: relaunch or scene change, and what survives (drafts, scroll, selected row, reply target).

### #420 (Computer, artifacts, pages, routines)
- Artifact delete: dialog copy, whether it removes all versions, undo, multi-select.
- Agent page read-only or editable; tap targets on finding lines; cross-links between page, artifact, routine and Finance.
- Routines read-only or editable; history, list, failed or paused state, and which run "Open conversation" opens.

### #421 (Settings)
- Home for the Expo Account extras (Language, Appearance, Avatar style, Hide amounts, Notifications, Usage, Live update).
- Destructive confirmation pattern (alert, sheet or typed), SSO re-authentication, and what happens to the push token and outbox on sign-out.
- Server-credentials setup: owner versus member role, Direct MCP fields, whether the sheet auto-opens.
- Usage and billing screens, and in-app purchase versus "manage on web".

### #422 (Push), #423 (Voice), #425 (Platform extras), #426 (Release)
- None.

### #424 (Finance, Legal, Cap table, Data room)
- Scope of Hide amounts: agent text, push, Home previews, Live Activities.
- Data room chips "Shared / Only me / View only" versus the README's "no share links".
- Sidebar page rows and glance values: fixed or user-added, and the duplicate agent row and page row.
