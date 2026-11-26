# Local desktop control

Let a bot read and operate apps on the owner's own computer, through the Praci
desktop app. The owner turns it on per bot, picks the apps it may use, and
approves the first action in each app on every run. macOS first; Windows and
Linux later.

The engine is [agent-desktop](https://github.com/vercel-labs/agent-desktop)
(Apache-2.0, npm `agent-desktop`). It reads the OS accessibility tree:
`snapshot` returns JSON with refs such as `@s8f3k2p9:e5`, and ref actions
(`click`, `type`, `set-value`, `press`, ...) are headless by default: they do
not take focus or move the pointer. `--headed` sends real pointer and keyboard
input. agent-desktop is optional and lives only in an adapter and the Electron
composition root, behind a provider-neutral contract.

## Why

Bots can already use a cloud or Docker computer, and on "This Mac" they can run
shell commands and edit files. They cannot see or use the owner's real apps:
the local `desktop` sandbox returns a placeholder screen, and desktop-kind
computers are never offered `computer_observe` or `computer_act`. Many tasks
live in native apps (Music, Notes, Calendar, a vendor app with no API). An
accessibility tree is cheaper and more precise than screenshots, needs no
vision model, and lets ref actions run without stealing the owner's focus.

## What we found in the code

- The packaged desktop app does not run the API on the Mac. It runs
  `infra/compose/docker-compose.images.yml`, so the API and worker are Linux
  containers. A host process must run agent-desktop. When the API runs
  directly on the Mac (`pnpm dev`, `pnpm demo:up`), the API can run it itself.
- `DesktopSandboxProvider` (`packages/adapters/src/desktop-sandbox.ts`) has real
  files and commands, but `observe`/`act` are placeholders, and
  `executor.ts` never treats a desktop-kind computer as graphical.
- The `computer_act` contract is pixel based (pointer x/y, keys). Ref-based
  control is a different shape, closer to the `browser_snapshot` /
  `browser_act` tools.
- "Runs on: This Mac" (`Bot.runsOn`, `assertRunsOnAllowed`) is the precedent
  for a host-level, deployment-owner-only setting.
- Approval cards (`buildApprovalAskBlock`, `ExternalEffect`) already support
  "allow once" without "always allow" (`noAlwaysAllow`). Site gating asks once
  per new site; nothing asks once per run per target yet.
- Every tool result outside a small own-state list already taints the run
  (`toolResultTaintsRun`). There is no fence that tells the model a snapshot
  is untrusted; iMessage results use `{ untrusted: true, note }`.

## User stories

1. As the owner, I turn on "Use apps on this Mac" for one bot, add Music, and
   ask it to find a genre and tell me what is shown. The first action in Music
   asks me once; the bot then works in Music without moving my pointer.
2. As the owner, I can see which apps each bot may use and remove one.
   Removing the last app, or turning the switch off, takes the tools away.
3. As the owner, the app tools never touch an app I did not add, System
   Settings, Keychain, password managers, terminals, browsers, code editors,
   Finder, sign-in or password prompts, or Praci itself, whatever the model or
   an app's content says.
4. As the owner, only a run I started myself in chat gets these tools. A run
   started by anyone else, another bot, a webhook, a schedule, a routine, or a
   message from outside never does.
5. As the owner, I can let one bot use the real mouse and keyboard for apps
   whose accessibility actions do not work. It is off by default.
6. As the owner on a hosted or shared server, I never see this setting.

## UX

All UI is in the existing bot settings Advanced section and the existing
approval card. See [mockup.html](mockup.html).

Bot settings, Advanced (shown only to the deployment owner, only in the desktop
app, only when the server reports app control as available, and not for a bot
that runs on this Mac):

- Switch: **Use apps on this Mac** ("this computer" on other platforms). Off by
  default.
- When on, a list of allowed apps (name, remove button with accessible name
  "Remove <app>"), and an **Add app** menu listing the apps running now, minus
  the apps that can never be used.
- Switch: **Use real mouse and keyboard**, off by default, with one line under
  it shown only when it is on: "Moves your pointer and takes focus."
- When macOS has not granted Accessibility to the process that runs
  agent-desktop, one line is added above the list and Add app is hidden: "Allow
  Praci in System Settings > Privacy & Security > Accessibility." The allowed
  apps and their Remove buttons stay, because removing does not need
  Accessibility and a vanished list looks like data loss. The line is needed
  because nothing works without it and the owner cannot discover it otherwise.
  The status is read again when the window regains focus, so granting takes
  effect on return.
- When the agent-desktop binary is known to be missing (the desktop app's
  provider is always configured), only the switch shows, disabled unless it is
  already on, with one line: "Needs agent-desktop: `npm install -g
  agent-desktop`". Only the deployment owner sees it.
- "Use real mouse and keyboard" shows only when apps are allowed or it is
  already on. If listing open apps fails, the Add app menu shows a disabled
  "Could not list apps"; reopening retries.

Approval card (existing `AskCard`): title "Use Music on this Mac", actions
"Allow for this run" and "Deny". No "Always allow". The label differs from
"Allow once" because one approval covers the rest of the run in that app.

Mobile: the settings are desktop-app only, because only the desktop app can
control the computer. Approval cards for these tools render through the
existing generic ask block on web and native, so the owner can answer from the
phone.

New copy (each string is necessary because the control has no other label or
the consequence is not visible): "Use apps on this Mac" / "Use apps on this
computer", "Add app", "Remove {app}", "Use real mouse and keyboard", "Moves
your pointer and takes focus.", "Allow Praci in System Settings > Privacy &
Security > Accessibility.", "Use {app} on this Mac", "Allow for this run".

## Architecture

```text
Pi agent (API/worker) -> desktop_app_* tools -> AppControlProvider (adapter-kit)
                                                  |
                         AgentDesktopAppControl (packages/adapters, policy + translation)
                                                  |
                              AgentDesktopRunner (argv in, JSON envelope out)
                               |                                   |
                  local spawn (API on the Mac:              HTTP bridge (packaged app:
                  dev, demo, tests use a fake)              Electron main, loopback + token)
                                                                   |
                                                           agent-desktop CLI on the Mac
```

- **Contract** (`@rakazo/adapter-kit`): `AppControlProvider` with
  `describe()`, `status()` (available, permission state), `listApps()`,
  `listWindows({ app })`, `launch({ app })`, `snapshot({ app, windowId?,
  surface?, root? })`, and `act({ app, ref, action, text?, key?, direction?,
  amount? }, { headed })`. Every call carries a scope (space, user, bot, run)
  that the adapter uses for ref ownership. Provider-neutral types: apps are
  `{ id, name }` where `id` is the bundle id (macOS) or executable identity.
  Not part of `SandboxProvider`: it controls the host, not a computer
  workspace, and it must not ride the pixel `computer_act` contract.
- **Adapter** (`packages/adapters/src/app-control/`): the only place that knows
  agent-desktop argv, envelopes, refs, and error codes. It builds argv from a
  fixed command set, parses the envelope, and applies the policy below.
- **Runners**: `spawnAgentDesktopRunner` runs the binary with `shell: false`,
  a timeout, an output cap, and a minimal environment. `bridgeAgentDesktopRunner`
  posts argv to the Electron bridge. A fake runner drives the offline tests.
- **Composition**: `APP_CONTROL_PROVIDER=agent-desktop|fake` (unset means
  none). The API uses the bridge when `APP_CONTROL_BRIDGE_URL` and
  `APP_CONTROL_BRIDGE_TOKEN` are set, otherwise local spawn, which is allowed
  only where `assertHostCommandsAllowed` passes (development, test, Electron).
- **Electron bridge** (`apps/desktop/src/app-control-bridge.ts`): started with
  the managed local stack only ("This computer" setup, never "Existing
  instance"). Binds `127.0.0.1` on a random port with a random 32-byte bearer
  token, passes both to Compose as the env above (URL via
  `host.docker.internal`, which Docker Desktop and OrbStack forward to host
  loopback). It re-checks argv against its own fixed command allowlist and the
  hard app denylist, refuses `--force`, `--screenshot`, `--trace`, `--debug`,
  clipboard, session, permissions and skills commands, and runs the binary
  with a timeout and output cap. macOS attributes Accessibility to Praci.app.
  The bridge sets `AGENT_DESKTOP_HOME` to a private folder under Praci's user
  data and passes `--session <run>` so runs do not share snapshot namespaces.
  agent-desktop keeps a per-user command host alive for 15 idle minutes. The
  bridge stops the command host processes it started when the stack stops.
- **Tools** (`builtin-tools.ts`): `desktop_app_list` (allowed apps, whether
  each is running, and its windows), `desktop_app_snapshot` (read one window
  or surface, or drill into a ref), `desktop_app_act` (one ref action, a key
  from a short list, or `launch`). Results are text JSON; no images.
- **Settings**: `Bot.appControlEnabled Boolean @default(false)`,
  `Bot.appControlApps Json @default("[]")` (`[{ id, name }]`, max 20),
  `Bot.appControlHeaded Boolean @default(false)`. RPC: `bots.update` fields
  plus `appControl.status` and `appControl.apps` (running apps for the picker).

## Security model

Each rule is enforced in code, not only in the prompt.

1. **Who and when.** Only the deployment owner can change the settings (same
   check as `this-mac`). The tools are offered only when all hold: a provider
   is configured on this server; the bot's switch is on with at least one
   app; the run's user is the deployment owner; the run trigger is `user`, or
   `resume` of a run whose trigger was `user`; the run is not unattended, not
   externally tainted, and its thread is not meeting tainted; and the bot's
   own computer does not run on this Mac (see rule 13). Every other trigger
   (`bot_message`, `spawn`, `routine`, `skill`, `webhook`, `messaging`, `mcp`,
   `follow_up`, `reaction`, `call_end`, `cloud_agent`, `created`, `tickets`)
   is denied, so a prompt-injected bot cannot delegate to another enabled bot.
   The executor re-checks this at call time.
2. **Allowlist.** Every call names an app. The adapter resolves it through
   `list-apps` and requires the running app's bundle id and name to match an
   allowed entry. `launch` passes the allowed bundle id, then verifies the
   resulting process the same way before anything else runs. Windows are
   listed with `list-windows --app` and a `windowId` is accepted only when its
   pid belongs to the verified process.
3. **Hard denylist** (adapter and bridge): System Settings / Preferences,
   Keychain Access, Passwords, SecurityAgent, loginwindow, LocalAuthentication
   and CoreServices UI agents, UserNotificationCenter, Installer, Disk Utility,
   Software Update, App Store; Terminal, iTerm2, Warp, Ghostty, Alacritty,
   kitty, Script Editor, Automator, Shortcuts; Finder (it opens scripts);
   general-purpose browsers (Safari, Chrome and Chromium builds, Firefox,
   Edge, Arc, Brave, Opera, Vivaldi, Orion, Dia) because the owner's signed-in
   Praci web UI can be open in them; code editors and IDEs (VS Code, Cursor,
   Windsurf, Zed, Xcode, JetBrains IDEs, Sublime Text, Nova) because they have
   terminals; password managers (1Password, Bitwarden, LastPass, Dashlane,
   Keeper, and any name containing "password"); and Praci itself (its bundle
   ids and Electron in development). These cannot be added, listed, read, or
   acted on. Web tasks use the existing browser tools on the bot's computer.
4. **Ref ownership.** The adapter records, per scope (space, user, bot, run),
   the snapshot ids it produced with their app, window, and sensitivity, in
   Postgres (`app_control_snapshots`, behind an `AppControlStore` interface),
   because a run can pause for approval and resume in another API or worker
   process. An
   action ref and a snapshot `root` must both come from the latest snapshot of
   that app in the same scope; anything else is refused before agent-desktop
   sees it. A drill-down inherits the parent's sensitivity.
5. **Sign-in and secrets.** Secure text fields and elements whose role, name,
   or identifier reads like a password, passcode, PIN, one-time code, or token
   have their value replaced with `[redacted]` and cannot be typed into, set,
   or cleared. A snapshot whose surface is a sheet, alert, or window that
   contains such a field or reads like a sign-in, password, purchase, or
   authorization prompt is marked `sensitive`; no ref from it is actionable.
   Snapshot text is scrubbed with the run's secrets (`redactSecrets`, saved
   logins, command credentials), like browser results.
6. **Keys and clipboard.** There is no free `press`. `desktop_app_act` accepts
   one key from `return`, `escape`, `tab`, `space`, arrows, `pageup`,
   `pagedown`, `home`, `end`, with no modifiers, so no paste or shortcut.
   Before sending it the adapter takes a fresh snapshot of the app's focused
   surface and refuses if it is sensitive or a sheet or alert is open.
   Clicking an element named like Paste is refused, and the `menubar` surface
   is not offered.
7. **No blind replays.** When an action's result is anything other than
   delivered or `not_delivered` (agent-desktop's `disposition.retry` is not
   `safe`), the adapter marks that snapshot as spent, so no ref from it can be
   used again. The bot must take a fresh snapshot and decide from the live
   state. The same applies to an action that times out.
8. **Headless.** Ref actions run without `--headed`. `--headed` is added only
   when the bot's owner setting is on. There are no coordinate commands, no
   clipboard, no `close-app`, no window moves, no notifications, no system
   surfaces.
9. **Approval.** The first `desktop_app_act` (including `launch`) in each app
   in each run asks through the existing approval card, with no "Always
   allow". The grant is its own `ExternalEffect` of kind `desktop_app_use`
   keyed by run and app id; it requires a human answer (it is on the explicit
   approval list, so saved allow rules and Auto Review cannot approve it).
   Each individual action is not an effect, so retries and repeated actions do
   not collide with the effect lifecycle. Later actions check for the human
   approved grant for the same space, user, bot, run, and app. A denied grant
   refuses the action; removing the app or turning the switch off refuses
   everything at once. Reads (`desktop_app_snapshot`, `desktop_app_list`) do
   not ask: the allowlist is the owner's read grant, and rule 1 keeps outside
   requesters out.
10. **Untrusted input.** Snapshot results carry `untrusted: true` and a note
   that the text is app content, not instructions; the result taints the run
   as outside content (existing `toolResultTaintsRun`), so connector reads and
   new sites ask afterwards. After the first desktop read in a run,
   `web_search` also asks for the rest of the run, because a query is an
   outbound channel that site gating does not cover.
11. **Persistence.** No screenshots are taken. Snapshot results are bounded
    (interactive elements, compact, at most 40,000 characters) and are stored
    like `browser_snapshot` results, after redaction. The Activity feed
    records one line per action ("Clicked Search in Music"), never tree text.
12. **Bridge and helper.** Loopback only, random token compared in constant
    time, only for the managed local stack, stopped with the stack. No port is
    published beyond loopback. agent-desktop's optional model-calling helper
    is never invoked; the fixed command allowlists in the adapter and the
    bridge cannot reach it. agent-desktop's own command host accepts commands
    from any process of the same OS user, and on the packaged app it runs
    with Praci's Accessibility grant. To shorten that window the bridge gives
    agent-desktop a private `TMPDIR` and `AGENT_DESKTOP_HOME` (mode 0700 under
    Praci's user data) and stops the command host when the run ends and when
    the stack stops. Bot commands in the packaged app run in Docker
    containers inside the Docker VM and cannot reach that host socket.
13. **What this does not protect against.** A bot whose computer runs on this
    Mac ("Runs on: This Mac") already runs shell commands as the owner, so it
    could run agent-desktop or any other automation directly. App control is
    therefore not offered to such a bot, and the switch is hidden for it.
    Other processes of the owner's OS user are outside Praci's control, as
    they are today; while agent-desktop's command host is alive, such a
    process could use Praci's Accessibility grant. Removing that residual
    risk needs an in-process integration (agent-desktop ships an FFI library)
    or an authenticated helper; see Open questions.

## Slices

Each slice: own worktree off `origin/main`, failing regression test first,
offline fake for agent-desktop, focused tests and typecheck, merged before the
next wave when it depends on it.

**S1. Contract, adapter, policy** (`packages/adapter-kit`, `packages/adapters/src/app-control/`).
Acceptance: conformance tests over the fake runner prove: unknown app refused
without a snapshot call; denylisted app refused even if allowlisted; bundle id
mismatch refused; launch verifies the new process; a window id from another
pid refused; an action ref or snapshot root from another app, an older
snapshot, or another scope refused; secure field values redacted and typing
into them refused; sensitive snapshot refs and their drill-downs refused; a
key outside the list or with a modifier refused, and a key refused when the
focused surface is sensitive; Paste-named elements refused; `--headed`
present only when requested; argv never contains a command outside the
allowlist; spawn runner timeout and output cap; bridge runner client sends the
token and handles errors.

**S2. Electron bridge** (`apps/desktop`). Acceptance: unit tests that the
bridge rejects a missing or wrong token, a disallowed command, `--force`, a
denylisted `--app`; binds loopback only; env is written only for the managed
stack; stops with the stack. Hand check with Calculator through the bridge.

**S3. Settings and store** (`packages/db`, `packages/contracts`, `apps/api`, `apps/web`).
Acceptance: migration and DTO; `app_control_snapshots` table and the Postgres
`AppControlStore` (scoped by space, user, bot, run; rows deleted when the run
ends); `bots.update` refuses the fields for a
non-owner, on hosted mode, or without a provider; app list refuses denylisted
ids; `appControl.status` / `appControl.apps`; Advanced section with stories
(off, on with apps, headed on, permission missing, unavailable hidden) and
tests.

**S4. Tools, approval, executor** (`packages/adapters/src/executor.ts`,
`builtin-tools.ts`, `approval-ask.ts`, contracts tool names, docs). Acceptance:
tools absent unless every rule-1 condition holds (one test per condition,
including `bot_message` and `spawn` from an eligible owner run); a desktop read makes a later `web_search` ask; an uncertain action spends its
snapshot; ref ownership survives a pause and resume in another process; first act
per app per run asks, a second act in the same app does not, a different app
asks again, a new run asks again, a denied grant refuses, a saved allow rule
or Auto Review cannot approve the grant; card has no "Always allow";
snapshot result is fenced and redacted and taints the run; Activity line has
no tree text; `docs/computer-runtime.md` documents the feature.

Waves: S1 and S2 in parallel; then S3; then S4. Then a UX review round, a
hand test with a harmless app (Music, read-only), and a walkthrough video.

## Assumed decisions

- A separate `AppControlProvider` contract instead of filling
  `SandboxProvider.observe/act`: the existing contract is pixel based, and the
  owner's host is not a sandbox workspace. The placeholder screen stays.
- No screenshots in v1: the accessibility tree covers the target apps, needs no
  vision model, and keeps images of the owner's screen out of model context.
- One approval per app per run, no "Always allow", so every run starts
  without standing permission to act. Reads do not ask.
- Tools only in runs the deployment owner started in chat. Unattended,
  delegated, and externally triggered runs are out of scope for v1.
- Browsers, code editors, terminals, and Finder are denied in v1 because they
  can reach Praci's own signed-in UI or run code; web tasks use the existing
  browser tools on the bot's computer.
- No free key presses in v1; a short list of unmodified navigation keys only.
- Not offered to bots that run on this Mac, because their shell already has
  the owner's full user rights.
- The Electron bridge uses loopback TCP with a bearer token, because bind
  mounting a Unix socket into Docker Desktop containers on macOS is not
  reliable. Linux Docker Engine cannot reach host loopback this way; Linux and
  Windows support is deferred.
- agent-desktop is installed by the owner (`npm install -g agent-desktop`); the
  app looks for it on the usual binary paths and reports it as unavailable
  otherwise. Bundling it is deferred.

## Open questions for the owner

- **agent-desktop command host.** It accepts commands from any process of the
  owner's OS user for up to 15 idle minutes. Options: (a) ship v1 with the
  mitigations in rule 12 and document the residual risk (recommended: same-user
  malware already has the owner's files and sessions); (b) block the feature
  until it runs agent-desktop's FFI library inside the Electron main process
  with no shared socket; (c) ask upstream for a per-host token.

## Out of scope

Windows and Linux; bundling agent-desktop; screenshots and vision; physical
coordinate actions; unattended use; teaching (recording the owner's own
actions); takeover UI.
