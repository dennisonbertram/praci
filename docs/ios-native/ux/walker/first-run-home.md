# Walker report: First run and Home topics (STORY-001 to STORY-020), round 1

Method: each step judged against the board that draws it (screenshots read, geometry audit run once per board used). Boards are static. IDs refer to `first-run-home-findings.json` (F-NNN is F-first-run-home-NNN; R1-NNN is F-first-run-home-R1-NNN).

## Status after round 1

28 earlier findings: 8 resolved (001, 002, 004, 007, 013, 014, 016, 024), 20 open. 10 new findings (R1-001 to R1-010). Open totals: 0 critical, 3 high (003, 015, 021), 19 medium, 7 low, 1 suggestion.

Fixed by the gap pass: Sign up (PG-B-SignUp), reset password and Check your email (PG-B-ForgotPassword), Account, sign-out confirm and delete confirm (PG-B-Account), space switcher (PG-B-Spaces, PH-Spaces), no-model Home (PG-A-HomeNoModel), standard iPhone Home and Thread (PH-Home, PH-Thread), product name now "Praci".

## Geometry audit

Run on PG-B-SignIn, SignUp, ForgotPassword, Server, Account, PG-A-Home, HomeNoModel, PG-B-Spaces, NewBot, NewGroup, NewSpace, BotSettings, GroupSettings, Settings, PH-Home, PH-Spaces, PH-Thread, Split, Inner, PG-A-ThreadStates. No page overflow or spills. "Uneven rows" on Home, Split, Inner and Account are icon plus label rows and a trailing time (intentional); "wrapped controls" are single-line pill buttons flagged by line-height (screenshots show one line). No geometry defect confirmed. All findings below come from the visual pass.

## Visual pass

- PG-B-SignIn: one ink Sign in pill; SSO is quieter; error "Could not continue" shown before any input (F-006); links small and grey (F-026).
- PG-B-SignUp: uniform three-row field group, one prominent Create account; clean.
- PG-B-ForgotPassword: two states side by side; Open Mail is the one prominent action, Resend quieter; clean. No link-return screen (R1-008).
- PG-B-Server: sheet about 75% tall, lower half empty (F-008); error pre-shown (F-006); icon-only Save (F-010); host "rakazo" (R1-005).
- PG-B-Account: three states; clean, destructive row separated. Only the password delete variant (R1-001).
- PG-A-Home / PH-Home: one prominent New; section order differs between them (R1-003); "42" with "3 need reply" unclear (F-025).
- PG-B-Spaces / PH-Spaces: title menu clear; Delete space on Personal (R1-009).
- PG-A-HomeNoModel: three states read well; one prominent action each (R1-010).
- NewBot, NewGroup, BotSettings, GroupSettings, NewSpace: icon-only commit, permanent error lines, no ticks on NewGroup (F-006, F-010, F-020); BotSettings selects teal for Inbox agent (F-019).
- Split / Inner: Home sidebar has no Activity or space control (F-023).

## Per story

**001 Sign in.** Launch, Email, Password, Sign in: PG-B-SignIn, pass except pre-shown error. Ideal 4, designed 4. Home standard: PH-Home drawn.
**002 Custom server.** Link then PG-B-Server, pass; filled state only as error (F-009); link text after save, capabilities reload: NO BOARD. Ideal 7, designed 3.
**003 SSO.** SSO button drawn; provider sheet is system UI; first-time setup and failure: NO BOARD (F-012).
**004 Sign up.** PG-B-SignUp drawn; verify state reuses reset copy (R1-008); launch mode undecided (R1-006); empty Home: no zero-bot board (F-017). Ideal 8, designed about 5.
**005 Reset.** Forgot mode, Check your email, Back to sign in drawn; link return and set-new-password NO BOARD (R1-008).
**006 Unreachable server.** Loading and failed options: NO BOARD (F-003).
**007 Sign out and delete.** Settings, profile row, PG-B-Account, sign-out confirm, delete confirm drawn; SSO/code variants and result NO BOARD (R1-001). Ideal 12, designed about 8. Change password shown twice (R1-002).
**008 Session rejected.** Sign in without message (F-005).
**009 Duo setup.** Outer Sign in and Server drawn; inner and half-folded NO BOARD (F-011).
**010 Older API.** Password-only Sign in and degraded Home NO BOARD.
**011 Needs me and approve.** PG-A-Home, PH-Home Activity rows read well; PH-Thread approval card with Save and Send drawn; See all and bell NO BOARD (F-018).
**012 First bot.** New button drawn, menu NO BOARD (R1-004); PG-B-NewBot drawn; Create states NO BOARD. Ideal 4, designed 2.
**013 Home fails.** NO BOARD (F-015).
**014 Group.** Menu NO BOARD; PG-B-NewGroup without ticks (F-020); PG-A-GroupThread drawn.
**015 Create space and switch.** Menu NO BOARD; PG-B-NewSpace drawn; switcher drawn on PG-B-Spaces and PH-Spaces; space-switch loading NO BOARD (R1-009).
**016 Switch on inner display.** Control NO BOARD on Split (F-023).
**017 Edit bot.** Thread entry NO BOARD (F-021); PG-B-BotSettings drawn, icon-only Save and pre-shown error.
**018 Archive and restore.** Action, confirm, banner, restore NO BOARD; Archived bots row on Settings drawn (F-021).
**019 No model.** PG-A-HomeNoModel gives a clear path: Connect a model, sheet, Model connected. Ideal 14, designed about 9. Minor in R1-010.
**020 Organize Personnel.** NO BOARD (F-022); GroupSettings drawn with ticks and Delete group; Delete alert NO BOARD.

## Open critical, high and medium

See `first-run-home-findings.json` (status "open").
