# Walker report: First run and Home topics (STORY-001 to STORY-020), round 2

Method: each step judged against the board that draws it (screenshots read, geometry audit run once per board). Boards are static multi-frame grids; every frame was judged. IDs refer to `first-run-home-findings.json` (F-NNN is F-first-run-home-NNN; R1-/R2- are round-1/round-2 findings).

## Status after round 2

38 findings in total: 28 resolved, 10 open. Open: 0 critical, 0 high, 6 medium, 4 low. All earlier high findings are resolved. Four new findings this round (R2-001 to R2-004).

Resolved this round: Sign in loading, load-failed, session-ended, SSO setup, cancel and failure frames (PG-B-SignIn); Server sheet states, detent and labeled actions (PG-B-Server); set-new-password and confirm-email (PG-B-ForgotPassword); SSO, code and wrong-password delete variants plus the after-delete screen (PG-B-Account); Home loading, error, offline, empty, pinned and unread frames and the New menu (PG-A-Home); Activity destination (PG-A-Activity); chat menu, archive and restore (PG-A-Thread, PH-Thread); NewBot, NewGroup, NewSpace, BotSettings and GroupSettings states with labeled Create and Save.

## Geometry audit

Run once on PG-B-SignIn, SignUp, ForgotPassword, Server, Account, PG-A-Home, HomeNoModel, PG-B-Spaces, NewBot, NewGroup, NewSpace, BotSettings, GroupSettings, Settings, PH-Home, PH-Spaces, PH-Thread, PG-A-Thread, PG-A-Activity, Split, Inner. Page overflow 436 or 144 px on the wide multi-frame boards came from the 1500 px test viewport, not a defect. "Uneven rows" are icon, label and trailing-value rows (intentional); "wrapped controls" are single-line pills flagged by line-height (screenshots show one line). No geometry defect confirmed.

## Visual pass

- PG-B-SignIn (8 frames): one ink Sign in pill per frame; error, loading and session frames read clearly. Long SSO name wraps to two lines inside the pill without clipping. Links are small grey text (F-026).
- PG-B-Server (7 frames): sheet at medium height; one prominent Save/Retry; alert for signed-in switch is clear.
- PG-B-ForgotPassword (6 frames): Open Mail is the one prominent action; clean.
- PG-B-Account (7 frames): clean; destructive row separated.
- PG-A-Home / PH-Home (8 frames): one prominent New; consistent order with Spaces. Wording agent vs bot differs from sheets (R2-001).
- PG-B-Spaces / PH-Spaces: title menu, switching skeleton, Personal without Delete, Delete confirm. Check-icon commit differs from Save elsewhere (R2-004).
- NewBot, NewGroup, NewSpace, BotSettings, GroupSettings: uniform, labeled actions, ticks and counts present.
- Split: space title, New, Activity and Personnel now present. Inner/Split have no Sign in (F-011).

## Per story

**001 Sign in.** PG-B-SignIn then PH-Home. Ideal 4, designed 4. Pass.
**002 Custom server.** Link, PG-B-Server states, confirm switch. Entry from Settings missing (R1-007).
**003 SSO.** Button, system prompt, cancel, failure: all drawn. Pass.
**004 Sign up.** PG-B-SignUp, Confirm your email, empty Home frame drawn. Launch mode still Sign in (R1-006). Ideal 8, designed about 6.
**005 Reset.** All four reset frames drawn. Pass.
**006 Unreachable server.** Loading and Could not load with Retry drawn. Pass.
**007 Sign out and delete.** Account, sign-out, all delete variants, After delete drawn. Pass.
**008 Session rejected.** Session ended with drafts kept drawn. Pass.
**009 Duo setup.** Outer drawn; inner and half-folded NO BOARD (F-011).
**010 Older API.** Password-only Sign in is the loaded frame minus SSO; degraded Home NO BOARD (minor).
**011 Needs me and approve.** PG-A-Home, PG-A-Activity, PH-Thread approval card drawn. Pass.
**012 First bot.** New menu, NewBot all states drawn; landing after Create not drawn. Wording agent/bot (R2-001).
**013 Home fails.** Drawn. Pass.
**014 Group.** New group all states, GroupThread drawn. Pass.
**015 Create space and switch.** Menu, NewSpace states, switching skeleton, settings drawn. Pass.
**016 Switch on inner display.** Split has the space title control; menu on inner not drawn (covered by F-011 family).
**017 Edit bot.** Thread chat menu, Bot settings states drawn. Wording (R2-001).
**018 Archive and restore.** Archive alert, banner, Restore, Archived bots drawn; Clear/Delete confirms NO BOARD (R2-002).
**019 No model.** HomeNoModel four frames clear; one prominent action each. Pass.
**020 Organize Personnel.** Pinned section drawn; organize sheet NO BOARD (F-022).

## Open critical, high and medium

- F-011 (PG-B-SignIn, PG-B-Server): no inner or half-folded frame.
- F-022 (PG-A-Home): no organize sheet or section creation.
- R1-006 (PG-B-SignIn, PG-B-SignUp): first-run lands on Sign in.
- R1-007 (PG-B-Settings): no Server row for signed-in switch.
- R2-001: agent vs bot wording.
- R2-002 (PG-A-Thread, PH-Thread): Clear and Delete chat confirms undrawn.
