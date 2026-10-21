# Walker report: First run and Home topics (STORY-001 to STORY-020, 109 to 111, 112, 113, 118, 126), round 3

Method: each step judged against the board that draws it (screenshots read, geometry audit run once per board). Boards are static multi-frame grids; every frame was judged. IDs refer to `first-run-home-findings.json` (F-NNN is F-first-run-home-NNN; R1-/R2-/R3- are findings from rounds 1 to 3).

## Status after round 3

51 findings in total: 39 resolved, 12 open. Open: 0 critical, 0 high, 2 medium, 10 low. Nine of the ten round-2 open findings are resolved or reduced; nine new findings this round (R3-001 to R3-009).

Resolved this round: inner and half-folded Sign in (F-011); Home organize sheet, Pinned and collapsed section (F-022); launch mode decided, Sign up is a visible secondary button (R1-006); Server row in Settings and Account (R1-007); Clear and Delete chat confirmations (R2-002); stale "Tap +" rule text (R2-003); labeled Save on Space settings (R2-004).

## Geometry audit

Run once on PG-B-SignIn, SignUp, ForgotPassword, Server, Account, PG-A-Home, PH-Home, PG-A-HomeNoModel, PG-B-Spaces, PH-Spaces, PG-A-Activity, Split, Inner, PG-B-NewSpace, NewBot, NewGroup, BotSettings, GroupSettings, Settings, PH-Thread, PG-A-Thread. Page overflow (436, 352, 304, 144 px) on wide multi-frame boards comes from the 1500 px test viewport. "Uneven rows" are icon, label and trailing-value rows (intentional); "wrapped controls" are single-line pills flagged by line-height (screenshots show one line). No spill or clipping confirmed.

## Visual pass

- PG-B-SignIn (10 frames): one ink Sign in per frame; Sign up is a secondary button; loading, error, session ended, SSO prompt, typing and inner frames all clear. Small grey links remain (F-026).
- PG-B-SignUp (6 frames): Create account is the one prominent action; field errors name the field; terms line wraps to two lines (fine).
- PG-B-ForgotPassword (12 frames): one prominent action each; expired link, mismatch, cooldown and Password updated drawn.
- PG-B-Server (8 frames): all states drawn; Switch alert has a red Switch. Inner is text only.
- PG-B-Account (15 frames): delete variants, Change password states drawn; clean.
- PG-A-Home (10 frames): New menu, loading, error, offline, empty, pinned, collapsed section, organize sheet. Empty space has two New controls (R3-004).
- PH-Home: Connected and No model; one prominent action each.
- PG-A-HomeNoModel (9 frames): Connect sheet, wrong key, local, subscription, connecting, connected, sharing off.
- PG-B-Spaces / PH-Spaces: title menu, switching skeleton, settings, delete confirm. No failure frame (R3-003).
- Split/Inner: space title and New present, no open menus (R3-002).
- NewSpace sheet half empty (R3-008). NewBot, BotSettings, GroupSettings: uniform labeled Save/Create/Retry.

## Per story

**001 Sign in.** PG-B-SignIn then PH-Home. Ideal 4, designed 4. Pass.
**002 Custom server.** Small link, PG-B-Server states. Pass; link small (F-026).
**003 SSO.** Pass.
**004 Sign up.** SignUp, field errors, Confirm email, no-model Home. Ideal 8, designed 7. Back chevron inconsistency (R3-006).
**005, 113 Reset and resend.** All frames incl. expired link and Password updated. Pass.
**006 Unreachable server.** Pass. **007, 112 Sign out and delete.** Pass; After delete wording (R3-005).
**008 Session rejected.** Drawn; drafts rule conflicts with the server switch alert (R3-001).
**009 Duo setup.** Outer and inner Sign in drawn; Server inner is text only. **010 Older API.** No degraded Home board (minor).
**011 Needs me and approve.** Pass. **012 First bot.** New menu on outer only (R3-002); sheet and Home wording now "agent".
**013 Home fails.** Pass. **014 Group.** Pass.
**015 Create space and switch.** Pass; switch failure not drawn (R3-003).
**016 Switch on inner display.** NO open menu on inner (R3-002).
**017 Edit agent.** Agent settings states, Discard alert drawn. Pass.
**018 Archive and restore.** Archive Undo, banner, Restore, Clear and Delete confirms drawn. Pass.
**019, 111 No model.** Pass.
**020 Organize Personnel.** Organize sheet, Pinned, collapsed section drawn; name field and rename not (R3-009).
**109, 110 Switch spaces.** Standard menu and outer menu drawn; inner and standard Space settings pages not.
**118 Activity.** Five frames drawn. Pass.
**126 Switch server signed in.** Settings Server row now drawn; alert silent on unsent messages (R3-001); two entries (R3-007).

## Open critical, high and medium

- R3-001 (PG-B-Server, PG-B-SignIn): Switch alert silent about unsent messages; drafts rule differs from Session ended.
- R3-002 (Split, Inner, PH-Home): space menu and New menu not drawn on inner or standard Home.
