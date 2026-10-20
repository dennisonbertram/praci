# Walker report: First run and Home topics (STORY-001 to STORY-020)

Method: each step judged against the board that defines it (screenshots read, live geometry audit run). Boards are static, so nothing navigates. Finding IDs refer to `first-run-home-findings.json` (F-first-run-home-NNN, shortened to F-NNN).

## Geometry audit (live, board-sized viewport)

Clean (no page overflow, uneven rows, spills or wrapped controls): PG-B-SignIn, PG-B-Server, PG-A-Home, PG-B-NewBot, PG-B-NewGroup, PG-B-NewSpace, PG-B-BotSettings, PG-B-GroupSettings, PG-B-Settings, PG-B-Models, Main, Split, Inner, PG-A-GroupThread. All defects below come from the visual pass, not the script.

## Visual pass per board

- PG-B-SignIn: wordmark and title both say Rakazo (F-007); error line shown in default state (F-006); links small and grey (F-026). One ink pill is the single prominent action: pass. SSO pill is a quieter dark fill: pass.
- PG-B-Server: sheet about 75% tall and mostly empty (F-008); only one error drawn (F-009); icon-only checkmark (F-010).
- PG-A-Home: three glass groups (account, bell/search/artifacts, plus) meet the limit; one prominent New. Avatars differ from other boards (F-019). "42" vs "3 need reply" (F-025).
- PG-B-NewBot / NewGroup / NewSpace / BotSettings / GroupSettings: icon-only commit button, disabled and pending states not drawn (F-010); New group has no ticked members (F-020); BotSettings title "Chat settings" and permanent error line (F-006, F-024).
- Main / Split: Home outer without Activity (correct per rule); inner Home sidebar has no space control or Activity (F-023).

## First run, server, sign in and recovery

**STORY-001 Sign in with email and password.** 1 launch: PG-B-SignIn, warn (error line pre-shown, title duplication). 2 Email, 3 Password: PG-B-SignIn, pass. 4 Sign in: PG-B-SignIn, warn (pending label and local validation not drawn; Home standard layout NO BOARD). Flow log: 4 ideal steps, 4 designed. Hesitation: none. Duplicate: product name twice.

**STORY-002 Self-hosted server.** 1 open sheet: PG-B-SignIn link then PG-B-Server, pass. 2 read sentence and field: PG-B-Server, pass. 3 type: warn (field and Use default server drawn, filled state only as error). 4 Save: warn (icon-only, spinner not drawn). 5 sheet closes, link reads "Custom server host": NO BOARD, fail. 6 capabilities reload: NO BOARD. 7 Sign in: pass. Flow log: ideal 7, designed 3 of 7. Duplicate: host shown on link, sheet and Settings with no defined format.

**STORY-003 SSO.** 1 SSO button: PG-B-SignIn, pass. 2 system sheet: system UI, NO BOARD (acceptable, undocumented). 3 return to Home: warn; first-time setup screen NO BOARD, cancel and failure copy NO BOARD (F-012).

**STORY-004 Sign up with verification.** 1 switch to sign up: link only; sign-up mode NO BOARD, fail (F-001). 2 to 3 fields and Sign up: NO BOARD. 4 Check your email: NO BOARD (F-002). 5 to 6 return to app: NO BOARD. 7 Back to sign in: NO BOARD. 8 empty Home: PG-A-Home empty copy not drawn (F-017). Flow log: ideal 8, 1 designed. Hesitation: user returns from Mail with no cue.

**STORY-005 Reset password.** 1 Forgot password link: PG-B-SignIn, pass. 2 to 6 forgot mode, confirmation, return: NO BOARD, fail (F-002). 7 Sign in: pass.

**STORY-006 Unreachable server.** 1 Loading, 2 failed options with Retry, 3 retry: NO BOARD, fail (F-003). Flow log: retry label differs (F-027).

**STORY-007 Sign out then delete account.** 1 open Settings: Settings board drawn as sheet with Done (xmark), pass; account entry on Home is the AB avatar, pass. 2 profile row: PG-B-Settings, pass. 3 Sign out, 7 to 9 delete, confirm, 10 to 12: Account detail and alerts NO BOARD, fail (F-004). 4 to 5 Sign in: pass. Flow log: ideal 12, designed 3. Duplicate: profile row and Account icon name the same page two ways.

**STORY-008 Session rejected.** 1 to 2: no UI. 3 Sign in without explanation: PG-B-SignIn, warn (F-005). 4 Sign in: pass.

**STORY-009 iPhone Duo setup.** 1 outer Sign in: PG-B-SignIn, pass. 2 to 5 Server sheet and sign in: pass as in 002. 6 unfold to Home: Split, pass for the 1/3 + 2/3 sidebar. 7 token shared: no UI. 8 inner Sign in: NO BOARD. 9 to 10 half-folded Server sheet: NO BOARD (F-011).

**STORY-010 Older server API.** 1 Server sheet: pass. 2 password-only sign-in: PG-B-SignIn with SSO and Forgot hidden: not drawn, warn. 3 Sign in: pass. 4 degraded Home: NO BOARD (what is hidden, disabled or explained is undecided).

## Home, Personnel and space switching

**STORY-011 Check what needs me and approve.** 1 Home with snapshot: PG-A-Home (outer only), warn (stale marker F-015; standard iPhone NO BOARD F-013). 2 Activity card: PG-A-Home, pass (Working, Approve, Done rows, readable). 3 tap row to thread: PG-A-Thread exists, pass; Activity dot clearing is not drawn. 4 Allow: thread board, out of scope. "See all" and bell destinations NO BOARD (F-018). Flow log: 3 ideal, 3 designed. Duplicate: pending approval appears in Activity and thread.

**STORY-012 First bot from empty Home.** 1 empty Home: NO BOARD (text only). 2 New menu: PG-A-Home shows button, menu NOT drawn, fail. 3 New bot sheet: PG-B-NewBot, pass (fields Name, Title, Description). 4 to 5 Create enabled and Creating: not drawn, warn (F-010). Landing after Create undecided (F-024). Flow log: 4 ideal, 2 drawn.

**STORY-013 Home fails to load.** 1 placeholders: not drawn but placeholder rows appear behind Server and New space sheets, warn. 2 error and Try again: NO BOARD (F-015). 3 retry: NO BOARD.

**STORY-014 Create a group (Duo outer).** 1 New menu: NO BOARD. 2 New group: PG-B-NewGroup, warn (no ticked members, avatars differ from Home, F-019, F-020). 3 name: pass. 4 tick members: not drawn, fail. 5 Create group: icon-only, warn. 6 group row in Personnel and thread: row NO BOARD; PG-A-GroupThread drawn, pass. 7 Back: pass.

**STORY-015 Create a space and switch.** 1 New menu: NO BOARD. 2 to 3 PG-B-NewSpace: medium sheet matches the rule, pass; error pre-shown (F-006). 4 Create: not drawn. 5 new space Home: NO BOARD; no current-space name anywhere (F-014). Flow log: switcher missing entirely.

**STORY-016 Switch spaces on inner display.** 1 space control: NO BOARD, fail. 2 Personal loads: NO BOARD. 3 tap Finance agent: Split sidebar rows drawn, but no detail pane for Home (F-023).

**STORY-017 Edit bot profile and save.** 1 thread: PG-A-Thread. 2 menu to settings: entry NO BOARD (F-021). 3 Name, 4 colors, 5 voice switch, 6 Advanced row: PG-B-BotSettings, pass (7 swatches vs Expo 8 plus custom, warn). 7 Thinking: Advanced detail NO BOARD (Models board has Thinking row, close). 8 Save: icon-only, error line crowds the toolbar button, warn.

**STORY-018 Archive and restore.** Archive action, confirmation, archived banner: NO BOARD. Archived bots row: PG-B-Settings, pass. Archived list and restore: NO BOARD (F-021).

**STORY-019 First run, no model.** 1 empty Home: NO BOARD. 2 needsModel prompt: NO BOARD, fail (F-016). 3 Account sheet and 4 Models: PG-B-Settings, PG-B-Models, pass. 5 key entry: Models rows only (Not connected row is drawn; key field not). 6 to 9 create bot: see 012. 10 to 14 thread: other topic. Flow log: ideal 14, designed about 6; a dead end before the first send.

**STORY-020 Organize Personnel.** 1 to 8 long-press organize, Pinned and section headings: NO BOARD (F-022). 9 to 12 group thread and settings: PG-A-GroupThread, PG-B-GroupSettings pass (ticks, count, Delete group row drawn). 13 Delete alert: rule card text only. 15 to 16 Delete: row drawn, alert NO BOARD.

## Flow log summary

- Designed vs ideal: sign-in 001 fully designed; 002, 009 partial; 004, 005, 006, 007, 013, 015, 016, 018, 019, 020 have most steps undrawn.
- Hesitation points: return from Mail or Safari after verification or reset; empty Home with a non-tappable hint and an unlabeled plus; missing model discovered only at first send; no way to see or change the current space.
- Duplicated information: product name on Sign in; Inbox "42" vs "3 need reply"; Finance/Legal as sidebar rows and as agents (Split); host in link, sheet and Settings; one approval in Activity and thread.
- Consistency: bot avatar shape and color differ between Home, New group, Group settings and Bot settings (F-019).
