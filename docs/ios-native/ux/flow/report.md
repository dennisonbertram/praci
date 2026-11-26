# UX Flow Report: native iPhone app, as built

Generated 2026-11-04 by `/ux-flow` against the built SwiftUI app (`apps/ios`). This replaces the plan-era run of 2026-10-20, now in `flow/archive/2026-10-20-plan-era/`.

## Run summary

| Metric | Value |
| --- | --- |
| Evidence source | Swift code in `apps/ios/Sources/Praci`, `catalog.md` (127 stories, 58 code findings) and the topic files. Nothing was run on a device or simulator. Steps are counted from the code. |
| Journey files | 8, covering about 35 stories (`flow/journeys/`) |
| Redundancy pass | `flow/redundancy.md`: 9 duplicate paths, 5 duplicate information, 6 overlapping features, 9 hierarchy and naming checks |
| Verdicts | minimal: Settings key replace (118), compose fix recipient (068), start/stop recording (077), to-do tick (080), Finance read (099). acceptable: approvals, morning triage, open-and-send, compose reply, business-page setup, settings model/rules. convoluted: install to first reply (001), reply then archive (076), find a finished meeting off the Meetings list (081), computer take control and takeover request (111, 112) |
| Device walk | Items marked "walk: y" below rest on code reading only and need confirming on a device. |

Ids in the journey files restart per file (JA, JB, JC, JD, R). This report uses its own ids (F1 to F25) and names the source file and id.

## Friction scorecard

| Journey | Steps actual / ideal | Verdict |
| --- | --- | --- |
| Install to first agent reply (001, 005-007, 013, 014) | about 26 to 30 / about 14 | Convoluted |
| Open app, attach, send, offline (012, 024, 031, 032) | 5 to 6 / 4 | Acceptable |
| Approvals (035, 040, 043, 045) | already one tap per decision | Acceptable |
| Morning triage (056, 057, 063, 064) | archive from a message needs an extra Back | Acceptable |
| Reply and send (067) | 4 / 3 | Acceptable |
| Reply then archive (076) | 7 per message / 4 to 5 | Convoluted |
| Record a meeting (077) | 3 to start, 1 to stop | Minimal |
| Find the finished meeting off the list (081) | 3 taps plus knowing to look / 1 | Convoluted |
| Business pages setup (102, 105, 108) | 6 to 7 / 3 to 5 | Acceptable |
| Computer take control, takeover (111, 112) | hidden controls, silent lease | Convoluted |
| Settings: default model, key, rule (117, 118, 121) | rule from scratch about 6 taps | Acceptable |

## Ranked proposals

Rank = (how central the journey is x steps or elements removed) / effort. Size: S = a few lines or one view, M = several views or a small model change, L = new flow. Risk is the chance of a regression or a product disagreement.

| # | Proposal | Problem and evidence | Saves | Risk | Size | Walk |
|---|---|---|---|---|---|---|
| F1 | Default release builds to a reachable server (hosted origin); keep loopback for debug | Default `http://127.0.0.1:3100` cannot work on a phone, so first launch is an error (001 JA-1; `ServerEndpoint.swift:24`, `AuthenticationView.swift:99-103`; finding 7) | 5 to 6 taps per fresh install | Needs a product decision on the origin | S | n |
| F2 | Open the connect sheet directly from the Home banner and from an empty thread that needs a model; reload Home and the thread when it closes | Banner leads to Models, whose only action is another "Connect a model"; closing the sheet leaves the banner (001 JA-4, JA-5, JA-9; `HomeScreen.swift:48,60-61`, `ModelsScreen.swift:24-29`, `ConnectModelSheet.swift:77-82`; STORY-014; finding 27) | 2 taps and a dead end on the most important first-run path | Low | S-M | y |
| F3 | Every "Connect" button (Finance, Cap table, Legal, Inbox) opens Settings at the right screen (Integrations or Models), and the page underneath reloads on dismiss | Sheet is a bare `SettingsScreen` at its root; pages load once in `.task` (099 JD-1, JD-2; redundancy R-2; `App/AppShell.swift`; findings 27, 50; STORY-102, 105, 108) | 2 taps per setup, removes stale "No accounts yet" | Low | M | y |
| F4 | Archive from the message screen returns to the list with the existing Undo toast; add "Send and archive" to a reply | `InboxMessageModel.archive()` sets a flag and never dismisses (`InboxMessageModel.swift:51-58`, `InboxMessageScreen.swift:26`); topic text says it pops (067 JC-3, JC-4; 056 JB-1; STORY-076, 056) | 1 to 2 taps per message, repeated all morning | Archiving a thread by mistake, covered by Undo | M | y |
| F5 | Reply is a tap, with Reply all and Forward on long press; focus the body when the compose sheet opens | Reply sits in a menu and the body is not focused (`InboxMessageScreen.swift:88-103`, `ComposeSheet.swift:127-132`; 067 JC-1, JC-2, JC-5) | 2 taps per reply; Reply becomes the prominent action over "Ask Inbox agent" | Reply all and Forward less visible | S | y |
| F6 | Tell the user when a recording is stored off the Meetings list: keep the glass bar a few seconds with "Meeting saved" and Open | `CaptureController.swift:112-115,318-320`; finding 11; STORY-081, 086 (077 JC-1) | 3 taps and the "where is it" hesitation | Bar must not stack with another bar | M | y |
| F7 | Computer: release control when the screen closes, focus the keyboard after Take control, show the takeover request and Skip / I'm done as soon as it exists, and add a push target and thread card | Closing keeps the lease; the request is found only after taking control (111 JD-1 to JD-4; `ComputerScreen.swift`, `ComputerKeyBar.swift`, `NotificationRouter.swift`; findings 13 to 15; STORY-111, 112) | 4 to 5 taps and removes a silent failure | Low | M | y |
| F8 | Add "Routines" to the thread menu so the built feature is reachable | Routines are built and routed but nothing opens them; the thread menu lists Computer, Artifacts, Agent page, Settings, Archive (redundancy R-1; `ThreadScreen.swift:208-222`) | New capability; no steps | Low | S | y |
| F9 | Approvals: put the reason above the buttons, let the clipped detail and the 10-line mail body expand in place, replace the bare word "Firewall" with a sentence, and offer a way to stop the repeated ask (iOS "Clear conversation") | Reason sits below the buttons; the well clips at 4 lines; finding 9 (035 JA-1, JA-2, JA-5, JA-6; `Thread/Approvals/*`; STORY-040, 043) | No steps, but removes approving blind and a repeating card | RPC for clearing needs checking | S-M | y |
| F10 | First-run form: ask only for the agent's Name (prefilled "Assistant"), hide Inbox and Pages until the first agent exists, skip the http alert for loopback or the default address | `NewBotSheet.swift:23-35`, `HomeScreen.swift:119-130,191-231`, `ServerView.swift:63-70,71` (001 JA-2, JA-3, JA-6, JA-7, JA-8, JA-10, JA-11) | 3 to 5 taps and 2 fields | Medium for hiding Home sections (deep links) | S-M | y |
| F11 | One shared Hide amounts value for Finance, Legal, Cap table and Settings | Each page model reads `me` once (099 JD-4; redundancy R-6; findings 29; STORY-103, 104) | Removes a stale-mask privacy gap | Low | M | y |
| F12 | Offline and send queue: show the offline line only on a thread with a queued message, clear it when the queue empties, add Edit to a refused bubble, keep drafts per thread | `ComposerView.swift:22-26`, `PendingSendsView.swift:59-79`, `SendQueue.swift:162-167` (012 JA-13 to JA-16; findings 38, 53) | 2 to 5 inputs per refusal or accidental Back | Draft files must not outlive sign-out | M | y |
| F13 | Settings: remove the duplicate Sign out row (keep Account's) and add a confirmation | Two rows, neither confirms (redundancy R-3; `SettingsScreen.swift`, `AccountScreen.swift`; finding 46; STORY-009, 126) | 1 duplicate path | Low | S | n |
| F14 | Cleanup: surface it instead of a one-item "More" menu, drop the Archive confirmation (its own text says Undo restores), keep the Unsubscribe confirmation | 056 JB-5, JB-6, JB-7, JB-10; STORY-063, 065 | 1 tap and one needless confirmation per bulk run | Low | S | y |
| F15 | Compose: a Settings button on the Reconnect and writes-off banners; replace Close on the "unknown" send state with Copy text; remove Save draft until a draft can be reopened | `ComposeSheet.swift:71,184-190`; findings 19, 20 (067 JC-7 to JC-9; STORY-071, 072) | 2 to 3 taps; stops data loss | Duplicate send if the user retries | S | y |
| F16 | Add a Compose button on the Inbox list, or delete the unreachable `.new` code | Finding 5; `InboxScreen.swift:29-51`, `InboxMessageScreen.swift:43-49` (067 JC-10) | New capability | Adds one control (AGENTS.md wants minimal UI) | M | y |
| F17 | Prefill an approval rule from the card's "Always allow"; default the rule action sensibly; choose the rule name from known tools | Rule from scratch is about 6 taps (117 JD-1 to JD-3; `ApprovalRulesScreen.swift:158-164`; STORY-121). Note: catalog finding 48 is wrong, the kind is a Picker and the free-text field is Name | about 5 taps | Medium | M | y |
| F18 | One name for the computer ("Computer"), drop the Home "Team computer" row that opens the first agent's computer | Four names; the row opens the first bot's computer (redundancy R-4; 111 JD-6; finding 56; STORY-115) | 1 duplicate path; fixes a wrong target | Low | S | y |
| F19 | Unify "Ask the agent": one control and label on every page, hidden when no agent exists | Three labels on three pages, missing on Finance, Data room and Meetings (redundancy R-7) | Consistency | Low | S-M | n |
| F20 | Hide or remove the "Read replies aloud" setting until something reads replies; drop the duplicate "Pinned" toggle in agent settings | Finding 36; redundancy R-8, R-11 | 2 controls | Low | S | n |
| F21 | Headers for the eleven headerless Settings rows; move "Archived agents" out of its own section; differentiate the two gear icons on Home; drop the redundant "Account" caption | redundancy R-5, R-12; finding 56 | Orientation, no steps | Low | S | y |
| F22 | Business pages polish: merge Allow and Scan on Legal into one button, use "Connect a model" instead of "OpenRouter key", Cap table shows sync status when Carta is connected but empty | 099 JD-3, JD-5, JD-6; finding 50 | 1 tap and clearer copy | Low | S-M | y |
| F23 | Settings detail: delete the "Connected" value and the Status section on provider rows, Save key as a toolbar button, one name for the rules screen, drop the rules footer, warn when disconnecting the provider of the default model | 117 JD-4 to JD-8 | 5 elements | Low | S | n |
| F24 | Meetings polish: whole to-do row tappable, to-dos above Decisions, one muted line when no summary arrives, spinner on "Summarizing", own alert title for a failed delete | 077 JC-2, JC-3, JC-5 to JC-7; finding 21 | Clarity | Low | S | y |
| F25 | Accept `praci://open/agent/...` as the primary link and keep `rakazo://` and `bot/` as aliases | redundancy R-10 | One name for one product | Needs a decision on the SSO callback scheme | M | y |

## Already minimal

- Reaching an agent from Home: one tap (012).
- Approval decisions: one tap, no re-entry, no confirmations (035).
- Starting and stopping a recording: 3 taps and 1 (077).
- Fixing a mistyped recipient (068).
- Replacing a provider key (118) and switching the default model (117).
- Reading Finance (099).
- Naming: no visible "bot" or "Apps" strings (redundancy.md).

## Decisions needed from the owner

- Hosted origin as the release default (F1).
- Whether Artifacts and Agent pages stay two surfaces (redundancy R-9, L if merged).
- Deep link scheme (F25).

## Limits

Everything is from code reading. Line numbers were checked by the critics but the app has not been run, so "walk: y" items are hypotheses about how the screens feel. The unreachable-code claims (F16) and the Routines claim (F8) are measured from code.
