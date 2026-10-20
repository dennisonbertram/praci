# iOS native app: UX planning index

This folder holds UX planning for the native iPhone app (epic #427, phases #412 to #426). It was generated on 2026-10-20 by `/ux-paths`, `/ux-flow` and `/ux-walker`. No native code exists, so every check was made against the 40 design boards in `docs/design-system/ios/boards/` (rendered locally with a preview shim, then screenshotted). Boards are static, so steps were judged against the board that defines each screen, and a screen with no board is recorded as a finding.

## Files

- [discovery.md](discovery.md): what the app must cover, from the plan and the Expo app.
- [catalog.md](catalog.md): 105 user stories, coverage matrix, redundancy candidates, and "Design Gaps by Phase".
- [flow/report.md](flow/report.md): friction scorecard for six journeys and the top 10 simplifications.
- [flow/redundancy.md](flow/redundancy.md): duplicate paths, duplicate information, naming and cross-board consistency.
- [walker/latest-report.md](walker/latest-report.md): 156 walker findings, quick fixes applied to the boards, and design work needed per phase.

## Resolve these before Devin builds the matching phases

1. **#415 Home: a first-run "Connect a model" prompt.** Home shows nothing when no model is connected, so a new user fails at the first send. Needs a Home empty state, a first-run Models variant and a decision on where Create lands.
2. **#417 Thread write: one mail approval card.** The card has three label sets (Deny/Allow, Save/Send, Allow once/Always allow/Deny). Choose one, and decide whether edit-and-send ships at all (the composer route needs no new screen).
3. **#424 Pages: the outer-display route to Finance, Legal, Cap table and Data room.** No board draws it (the only critical walker finding), and the Legal, Cap table and Data room states are mostly undrawn.
4. **#419 Duo: posture-change behavior and the inner, half-folded and laptop boards.** Decide whether a fold relaunches the app and what survives (drafts, scroll, selection). Only Finance has a laptop board.
5. **#414 and #416: a standard-iPhone (393 pt) board.** Every board is the Duo outer display, but most stories name a standard iPhone. Also draw sign-up, forgot-password and offline states before the sign-in and thread phases.

## Decisions needed (34, from the catalog's Design Gaps by Phase)

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
