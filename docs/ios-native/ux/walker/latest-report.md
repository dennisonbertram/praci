# UX Walker Report: planned native iPhone app, 2026-10-20

## Run Summary

| Metric | Value |
| --- | --- |
| Target | Planned native SwiftUI iPhone app (epic #427). No native code exists. |
| Evidence source | The 40 design boards in `docs/design-system/ios/boards/`, rendered locally with a preview shim (not the real canvas runtime) and screenshotted. Boards are static, so steps were judged against the board that defines each screen. A screen with no board is a happy-path finding. |
| Run mode | Full, five walkers in parallel |
| Stories in catalog | 105 |
| Stories walked | 105 (first-run-home 20, thread 34, inbox-computer 22, finance-settings 19, duo 10) |
| Stories skipped / re-verified | 0 / 0 |
| Pass rate | Not computed. Walkers rated steps (pass, warn, fail), not stories, and every story has at least one step with no board or a conflict. |
| Geometry audit | Run live on each board at its own size; false positives noted in the walker files |

## Findings Summary

### By Severity

| Severity | Count | Quick Fixed | Issue Filed | Deferred |
| --- | --- | --- | --- | --- |
| Critical | 1 | 0 | 0 | 1 |
| High | 38 | 0 | 0 | 38 |
| Medium | 76 | 2 (1 partial) | 0 | 74 |
| Low | 36 | 9 (2 partial) | 0 | 27 |
| Suggestion | 5 | n/a | n/a | 5 |
| **Total** | **156** | **11 (3 partial)** | **0** | **145** |

No separate GitHub issues were filed. Each phase issue (#412 to #426) has a comment listing the design work needed before it is built.

### By Category

| Category | Count | Examples |
| --- | --- | --- |
| Happy path (undrawn step) | 53 | Sign-up mode, Compose, Cleanup, Account detail have no board |
| Consistency | 37 | Mail approval card drawn three ways; Inbox agent has three avatar identities |
| Flow | 14 | Fold or unfold has no stated outcome for drafts and selection |
| Error handling | 14 | No offline, queued, stale or refused-send state |
| Visual | 9 | Agent page tiles 116, 151 and 85 px wide; invisible Cancel label in search overlay |
| Simplicity | 8 | Artifact title shown twice; Title and Description fields hold one sentence |
| Accessibility | 8 | Icon-only commit buttons; field aria-label set to the example value |
| Layout | 5 | Four icons in one Inbox capsule; chip row cut off at the edge |
| Hierarchy | 5 | Share is not prominent on the Artifact board; unlabeled "42" count |
| Disclosure | 3 | Error lines drawn in the default state of several boards |

## Critical and High Findings (33 rows, from 39 findings)

Same defect found by more than one walker is one row with every id.

| Ids | Sev | Phase | Defect |
| --- | --- | --- | --- |
| F-finance-settings-001 | Critical | #424 | No board draws how a user reaches Finance, Legal, Cap table or Data room; Home has no page rows or glance values. |
| F-thread-001, F-first-run-home-013, F-inbox-computer-002, F-inbox-computer-026 | High | #416, #415, #418, #420 | No standard-iPhone (393 pt) board. Every board is the Duo outer display (466 x 678) or inner/laptop pose; 27 thread stories, Home, Inbox, Computer and Artifacts all name a standard iPhone. |
| F-duo-001 | High | #419 | Inner, half-folded and laptop layouts for thread, Computer, Artifacts, Image, Settings and the New bot/space sheets exist only as rule-card text. |
| F-duo-002 | High | #419 | No rule says whether a fold relaunches the app or what survives (draft, scroll, selection, open sheet, stream, Computer session). |
| F-duo-003 | High | #418 | Inbox action set defined five ways (Search/Filter/Compose; eye/star/Filter/Compose; reduced menu). Related: F-inbox-computer-007. |
| F-duo-013, F-inbox-computer-015 | High | #420 | Computer draws only "in control". Missing: watching state with "Take control", Skip / I'm done handoff, booting, lease expiry, reconnecting, takeover denied, desktop load errors. |
| F-duo-015, F-finance-settings-007 | High | #424, #419 | `Desk` (laptop) drops accounts, upcoming, period tabs and Ask Finance agent that `PG-B-Finance` and the rule card place on the bottom half; Legal, Cap table and Data room have no laptop board. |
| F-finance-settings-002 | High | #424 | Legal blocker ("Add your OpenRouter key") is not drawn; no copy says why that key is needed; scan states undrawn. |
| F-finance-settings-003 | High | #424 | Cap table not-connected, pending, syncing, expired and error screens, contact form and holder detail are not drawn. |
| F-finance-settings-005 | High | #424 | Data room upload progress, search results, empty room, failed upload, preview and folder contents are not drawn; no way to attach a Data room file to a message. |
| F-finance-settings-010, F-first-run-home-004 | High | #421, #414 | Account detail (sign out, delete account), delete confirmation, SSO re-authentication, AI data sharing, Archived bots and Change password pages are not drawn. An in-app account-deletion path is an App Store requirement. |
| F-finance-settings-012 | High | #421 | Provider detail (API key, Replace, Disconnect) and subscription sign-in page are not drawn. |
| F-first-run-home-001 | High | #414 | Sign-up mode has no board. |
| F-first-run-home-002 | High | #414 | Forgot-password mode and "Check your email" state have no board. |
| F-first-run-home-003 | High | #414 | Capabilities loading and "Could not load sign-in options" have no layout; no offline versus wrong-server distinction. |
| F-first-run-home-014 | High | #415 | No space switcher on any board: no current-space name, no list, no failure state. |
| F-first-run-home-015 | High | #415 | Home loading, error, stale-snapshot and partial-failure states exist only as rule-card text. |
| F-first-run-home-016 | High | #415 | The no-model handoff has no screen; a new user fails at first send. Related: F-thread-021. |
| F-first-run-home-021 | High | #415 | Entry points and confirmations for bot settings, archive, restore, delete, discard-changes and group settings are not drawn. |
| F-inbox-computer-001 | High | #418 | Reply, Reply all, Forward and New message all end in a compose surface no board draws. |
| F-inbox-computer-003 | High | #418 | Cleanup flow and its entry point are not drawn; the outer strip has no place for it. |
| F-inbox-computer-004 | High | #418 | No Inbox state for mail writes off, reconnect, rate limited, no mail account or consent needed; "Inbox zero" would mislead. |
| F-thread-002 | High | #417 | Only DS-06 has the Attach circle; the composer on the thread boards has capsule and mic only. |
| F-thread-003 | High | #417 | Attach source menu, upload progress, chip errors, HEIC converting, skipped-file notice and photo-permission denied are not drawn. |
| F-thread-004 | High | #417 | No offline, reconnecting, queued or stale state; a message waiting for hours looks like "Sending". |
| F-thread-005 | High | #417 | The "Message not sent" banner asks for a manual Retry, but the plan resends automatically when the network returns. |
| F-thread-006 | High | #417 | Refused, failed and queued sends all show the same "Not sent / Retry", though a refused send can never succeed on retry. |
| F-thread-007 | High | #417 | The AI data sharing prompt has no board and does not fit the DS-04 alert shape. |
| F-thread-008 | High | #417 | Mail approval card drawn two ways: "Send reply" with Deny/Allow versus "Re: Pilot timeline" with Save/Send. Related: F-duo-005, F-inbox-computer-009. |
| F-thread-009 | High | #417 | The login/API-key ask card (secure field, Saved, error, retry) has no board. |
| F-thread-010 | High | #421 | No screen to see or remove an "Always allow" rule or turn auto review on or off. |
| F-thread-011 | High | #421 | Turning connector writes on (money tools) has no board; no connector detail page; "writes are off" reply undrawn. |
| F-thread-012 | High | #417 | "Body is tappable to edit" has no affordance; the edit-and-send screen has no board on any display. |

## Quick Fixes Applied

Applied to the boards in `docs/design-system/ios/boards/` in this run (11 findings, 10 fixes; thread-030 and inbox-computer-020 are the same tile-width defect). PG-A-AgentPage, PG-B-NewGroup and PG-B-SignIn were re-rendered and checked after the edits; the DS-03 fixes were not re-checked by eye.

| Finding | Story | What was wrong | Fix | Board |
| --- | --- | --- | --- | --- |
| F-first-run-home-007 | All 20 first-run and Home stories | Boards said Rakazo while the product is Praci; wordmark and title repeated the name | Rakazo to Praci in visible copy; sign-in title is now "Sign in" | PG-B-SignIn, PG-B-Server, DS-01 to DS-04, DS-07, canvas.json |
| F-thread-030, F-inbox-computer-020 | STORY-029 and Agent page stories | Three figure tiles 116, 151 and 85 px wide | Equal-width tiles; "/mo" moved into the label ("Burn / mo") so the value fits | PG-A-AgentPage |
| F-duo-023 | STORY-104, 106 | Inbox and Finance agent avatars swapped on New group; toast used a different avatar | Shared avatar shapes and colors (the DS-04 toast avatar is not changed) | PG-B-NewGroup, PG-B-GroupSettings |
| F-duo-024 | STORY-104 | Field aria-labels were the example text | Label equals the visible field name | PG-B-NewSpace, PG-B-NewBot |
| F-first-run-home-024 | STORY-017 and others | Page titled "Chat settings" but the object is "Bot settings" | Retitled | PG-B-BotSettings |
| F-first-run-home-027 | First-run stories | "Retry" versus "Try again" | "Try again" for load failures; "Retry" kept only for failed sends | PG-B-Rules, DS-06-Chat, DS-07-Domain |
| F-thread-033 | STORY-034, 036 | PDF chip used an envelope icon; reply strip bar was blue instead of muted | Document glyph (the reply strip bar color is not changed) | DS-06-Chat |
| F-finance-settings-020 | Finance stories | "Due Oct 24" next to "Oct 31" | Consistent "Due" wording | PG-B-Finance |
| F-duo-034 | STORY-104, 105 | Text overran a caption in DS-03; annotation label overprinted a row in DS-04 | Taller spec grid in DS-03 (the DS-04 annotation overlap is not changed) | DS-03-Navigation |
| F-duo-035 | STORY-105 | Title capsule touched the trailing group (0 px, spec 8 pt) | 8 pt gap | DS-03-Navigation |

Three fixes are partial and stay open for the parts listed as not changed: F-duo-023 (DS-04 toast avatar), F-thread-033 (reply strip bar color) and F-duo-034 (DS-04 annotation overlap).

### Quick-fix candidates not applied

These need a decision or are design changes.

| Finding | Sev | Phase | Why not applied |
| --- | --- | --- | --- |
| F-duo-027 | Low | #419 | Sheet inset 8 pt versus 6 pt: choose which value is right. |
| F-duo-030 | Low | #419 | Strip width 60 versus 62 pt and sidebar 277 versus 297: confirm the spec. |
| F-duo-033 | Low | #421 | Three invented names for the signed-in user and the Account versus Settings label: pick one. |
| F-finance-settings-009 | Medium | #421 | Settings dismiss is X on the board but "Done" in the catalog: decide, then fix the catalog or the board. |
| F-finance-settings-013 | Medium | #421 | Local server URL placeholder: needs an invented LAN address and a layout change. |
| F-finance-settings-018 | Medium | #424 | The unlabeled chat bubble needs an accessible name per page in PG-B-Rules. |
| F-finance-settings-021 | Low | #424 | Remove "Reconnect" from the connected state: design change tied to the Cap table states. |
| F-first-run-home-008 | Medium | #414 | Server sheet is about 75 percent tall versus the medium detent: needs the validation lines first. |
| F-first-run-home-020 | Medium | #415 | New group shows no selected members: needs a decision on the group row and Personnel placement. |
| F-first-run-home-025 | Low | #415 | The "42" count: label it or drop it. |

## Issues Filed

No new issues. The design work for each phase is posted as a comment on that phase's issue (#412 to #426).

## UX Audit Summary

### Common Patterns

- **Only the Duo outer display is drawn.** Affects at least 40 stories that name a standard iPhone (F-thread-001, F-first-run-home-013, F-inbox-computer-002, -026). Recommendation: add one standard-iPhone variant for Home, Thread, Inbox, Computer and Artifacts before phases #415 to #420.
- **Happy-path steps with no board (53 findings).** Compose, Cleanup, sign-up, forgot password, Account detail, provider detail and most Cap table, Legal and Data room states. Recommendation: draw these before the phase that depends on them.
- **One component drawn several ways (37 consistency findings).** Mail approval card, bot avatars, Inbox action set, mail row, metric tiles, sidebar. Recommendation: one definition per component in the design system, then fix the boards.
- **Error, offline and loading states live only in rule-card text (14 findings).** Recommendation: one banner pattern and one "retry versus auto-resend" rule before #416 and #417.

### Systemic Issues

1. **Rule cards promise behavior the boards do not show** (laptop pose, collapse order, fold behavior). Affects #419 and #424.
2. **Names differ between boards, plan and Expo** (Praci/Rakazo, agent/bot, Inbox section names). Affects most phases.
3. **Boards and catalog disagree** about what is drawn (F-thread-038): some catalog "NO BOARD" notes are stale.

## Top 5 Recommendations

1. **Draw the standard-iPhone variant** of Home, Thread, Inbox and Computer. It unblocks the most stories.
2. **Settle the mail approval card and the send, offline and refused states** in one pass (F-thread-004 to -008).
3. **Draw the Home route to a model and to the four pages** (F-first-run-home-016, F-finance-settings-001).
4. **Decide fold behavior and draw inner, half-folded and laptop layouts** for the thread, Computer and the four pages (F-duo-001, -002).
5. **Draw Account detail, sign-up, forgot-password and provider detail** so #414 and #421 can start.

## Still Failing

Not graded per story (see Run Summary). The critical finding and 38 high findings above are all open.

## Story Results Detail

| Walker | Stories | Findings (critical/high/medium/low/suggestion) | Report |
| --- | --- | --- | --- |
| first-run-home | 20 (STORY-001 to 020) | 28 (0/9/13/5/1) | `docs/ios-native/ux/walker/first-run-home.md` |
| thread | 34 (STORY-021 to 055, 049 merged) | 39 (0/12/16/9/2) | `docs/ios-native/ux/walker/thread.md` |
| inbox-computer | 22 (STORY-056 to 077) | 28 (0/6/16/5/1) | `docs/ios-native/ux/walker/inbox-computer.md` |
| finance-settings | 19 (STORY-078 to 097) | 22 (1/6/11/4/0) | `docs/ios-native/ux/walker/finance-settings.md` |
| duo | 10 (STORY-098 to 108, 101 merged) | 39 (0/5/20/13/1) | `docs/ios-native/ux/walker/duo.md` |


## Design work needed before each phase

"High+critical" counts raw findings by their `phase_issue` before de-duplication. "Catalog gaps" counts bullets under each phase in `docs/ios-native/ux/catalog.md` (Design Gaps by Phase).

| Phase | High+critical | Catalog gaps | Most important missing boards or states |
| --- | --- | --- | --- |
| #412 P0 Scaffold and tokens | 0 | 3 | Light-mode layouts; Dynamic Type behavior for markdown, tables, cards; one bot identity (shape and color) source; working-indicator color decision |
| #413 P1 Contracts export | 0 | 2 | "Not supported by this server" behavior and copy; which screens degrade on older servers |
| #414 P2 Server and sign in | 4 | 13 | Sign-up mode; forgot-password and "Check your email"; capabilities loading and failure; Server sheet validation errors; forced sign-out message; SSO cancel, failure and first setup |
| #415 P3 Home, spaces, bots, groups | 5 | 20 | Home empty state with "Connect a model"; space switcher; Home loading, error and stale states; standard-iPhone Home; bot management entries (archive, restore, delete, discard); Activity screen |
| #416 P4 Thread read | 1 | 17 | Standard-iPhone thread chrome; loading, failed-refresh and archived states; "New" divider and jump to latest; empty thread greeting and chips; unknown-block placeholder; group members pane |
| #417 P5 Thread write, approvals, consent | 9 | 25 | One mail approval card; Attach menu, chips, progress and errors; offline, queued and stale states; refused versus failed send; consent prompt; secret ask card |
| #418 P6 Inbox | 5 | 14 | Standard-iPhone Inbox list and message; Compose; Cleanup; mail connection states; one Inbox action set; inner "Inbox zero" and detail pane |
| #419 P7 Duo layouts | 3 | 10 | Fold behavior rule; inner, half-folded and laptop layouts for thread, Computer, Artifacts, Settings; sign-in and Server on inner; Legal, Cap table and Data room laptop poses; keyboard in laptop pose; collapse order beyond Inbox |
| #420 P8 Computer, artifacts, pages, routines | 3 | 10 | Computer states (take control, handoff, lease, reconnect); standard-iPhone Computer and Artifacts; Versions menu, delete confirm, Save to Photos feedback; Routines list and history; retry states on Page, List, Routine |
| #421 P9 Settings | 4 | 16 | Account detail with sign out and delete; AI data sharing page; Archived bots and Change password; provider detail and subscription sign-in; "Always allow" rules screen; connector writes and app detail |
| #422 P10 Push | 0 | 3 | Permission prompt; notification settings; in-app presentation after tap; space name on a cross-space push |
| #423 P11 Voice | 0 | 3 | Microphone and speech permission and denied state; active call screen and call control on the thread; Sounds controls; consent mid-call |
| #424 P12 Finance, Legal, Cap table, Data room | 5 | 11 | Outer-display route to the four pages; Legal blocker and scan states; Cap table not-connected, expired and error states; Data room upload, preview, empty and failed states; laptop poses for all four; Hide amounts hidden state |
| #425 P13 Platform extras | 0 | 2 | Live Activity, App Intents, share extension, widgets (none drawn); share-extension picker on Duo; no story covers this phase |
| #426 P14 Release | 0 | 1 | No UX gaps; screenshot sets depend on the #415 and #419 boards |

## Run History

| Run | Date | Walked | Passed | Failed | Fixes | Issues |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-10-20 | 105 | not graded | not graded | 11 findings (10 fixes) | 0 |

*Generated by `/ux-walker` on 2026-10-20.*
