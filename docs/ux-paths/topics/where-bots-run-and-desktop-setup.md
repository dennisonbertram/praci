# Where bots run and desktop setup

Code read for this topic: `apps/desktop/src/setup.html`, `setup.js`, `local-stack.ts`, `main.ts` (setup save and probe), `apps/web/src/components/RunsOnPicker.tsx`, `apps/web/src/pages/shell/bot-panel.tsx`, `apps/web/src/pages/AccountSettingsOverlay.tsx`, `apps/web/src/pages/Shell.tsx`, `apps/web/src/components/ComputersUnavailableHint.tsx`, `apps/api/src/router.ts` (`deployment.get/update`, `bots.update`, `assertRunsOnAllowed`, `computerHostFor`), `apps/api/src/run-location.test.ts`.

Background that applies to every story:
- The old "Where should bots run?" modal (`HostComputerPrompt`) is gone. Nothing blocks first load now. The only controls are the per-bot "Runs on" and the owner-wide "Bots run on".
- Both controls appear only when all three are true: the person is the deployment owner, the server's sandbox provider is `docker`, and the page is hosted in the desktop app (`canOfferHostComputer` needs `canChooseHostComputer` and the desktop bridge). The server enforces the same rule (`assertRunsOnAllowed`).
- The two options are "Sandbox" and "This Mac" (on macOS) or "This computer" (other desktop platforms). Choosing the host option shows: "Runs commands without asking. Avoid on shared or public servers."
- Packaged desktop with sandbox provider `desktop` is a separate case: `computerHostFor` returns `this-mac` for it, and the pickers are hidden because `canChooseHostComputer` is false. Whether the packaged desktop app ever reports `desktop` as its provider is UNVERIFIED from the files read.

## STORY-APP-332: Maya installs the desktop app and starts a local Praci
**Type**: long
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, first-time founder of Northwind Robotics, on a MacBook, Docker Desktop already installed and running, no Praci server anywhere yet
**Goal**: Get from a fresh desktop install to a working local Praci without typing a server address.
**Preconditions**: First launch of the packaged desktop app (no saved setup). Docker Desktop is running. Internet access.
**Ideal path**: 3 — open the app, leave "This computer" selected, click Continue and wait.
**Alternate paths**: "Existing instance" (STORY-APP-335) if a server already exists. None found for skipping setup on first launch.
### Steps
1. Launch Praci. → A "Set up Praci" window opens with a title bar reading "Praci" and a "Quit" button, the heading "Welcome to Praci" and the line "Choose which server this app should use." Two radios: "This computer" (selected) and "Existing instance". Buttons "Continue" (focused) and nothing else; "Check connection" is hidden in this mode.
2. Maya reads the two radios and wonders whether "This computer" means her data stays on the laptop. Nothing on the screen says so, and no explainer text exists. She leaves the default. (Hesitation point: the only hint about what "This computer" does is the progress text after she clicks.)
3. Click "Continue". → The stack panel appears. Status line reads "Getting ready…" (phases `checking-docker` and `preparing` share this label). A progress bar (accessible name "Setup progress") starts near 6 percent. Both buttons are disabled while a phase is running.
4. Wait. → Status becomes "Downloading Praci…" and a line under it counts up, for example "640 MB downloaded". Docker reports bytes but no total, so the bar creeps forward and never reaches the next phase until the pull ends.
5. Wait. → "Starting Praci…", then "Almost ready…", then "Praci is ready." in the ok tone.
6. Do nothing. → The window saves "This computer" with the managed local address, checks that the server answers, opens the main window and closes the setup window. The status line briefly says "Connecting…".
7. Sign up in the main window. → Maya is now in the normal first-run flow (see the onboarding stories). She is the first user on this deployment, so she is the deployment owner.
8. Open a bot's settings later. → "Runs on" is available under Advanced (STORY-APP-336). Nothing about where bots run was asked during setup.
### Variations
- Maya clicks the small terminal icon (accessible name "Technical details") during the download. A monospace output box opens with the raw Docker lines. Clicking it again closes it.
- Maya quits mid-download with "Quit". On the next launch the app starts the stack again before showing the window, and the setup window opens already following that attempt, with "This computer" selected and the bar mid-way (from `init` in `setup.js`: it attaches to a running stack).
### Edge Cases
- Pull speed varies, so the bar can sit still for minutes on a slow connection. There is no cancel button other than "Quit".
- The same Continue button is used for every state; its label changes to "Check again" (Docker problems) or "Retry" (failure), see stories 02 and 03.

## STORY-APP-333: Docker is not installed or not running at first launch
**Type**: medium
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, first-time founder of Northwind Robotics, on a new laptop with no Docker
**Goal**: Recover from a missing or stopped Docker and finish local setup.
**Preconditions**: Desktop setup window open, "This computer" selected. Docker not installed (first pass), then installed but not started (second pass).
**Ideal path**: 7 — install Docker, start it, click "Check again" once.
**Alternate paths**: Choose "Existing instance" and point at a server that someone else runs (STORY-APP-335), which needs no Docker on this machine.
### Steps
1. Click "Continue". → The status turns to the error tone with "Docker is not installed on this computer." The progress bar is hidden. The button label becomes "Check again" and is enabled. A row of three link buttons appears: "Docker Desktop", "OrbStack", "Docker Engine".
2. Maya has never heard of OrbStack or Docker Engine and picks "Docker Desktop". → The link opens in her default browser (via `openLink`, the setup window itself does not navigate).
3. She installs Docker Desktop, but does not open it. She returns and clicks "Check again". → The message changes to "Docker is installed but not running. Start Docker, then check again." The same three links stay visible.
4. She starts Docker Desktop and waits for its whale icon to settle. (Hesitation: Praci does not poll for this; nothing happens until she clicks again.)
5. Click "Check again". → "Getting ready…" and the normal download starts (STORY-APP-332 from step 3).
### Variations
- Docker is installed but Compose is missing: message "Docker is installed, but Docker Compose is missing. Install Docker Desktop or the docker-compose-plugin." (phase `docker-missing`, so the same three links show).
- On Linux, when the user is not in the docker group: "This user cannot access Docker. Add it to the docker group (sudo usermod -aG docker $USER), sign out and back in, then check again."
### Edge Cases
- Docker output can contain paths and hostnames, so the user only sees these fixed messages. The "Technical details" icon only appears when there is output to show.
- Switching to "Existing instance" at any point hides the stack panel and re-enables the buttons; a follow in progress stops and will not save "This computer" afterwards.

## STORY-APP-334: The local stack fails to start and Maya retries
**Type**: medium
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, first-time founder of Northwind Robotics, with Docker running but a busy network
**Goal**: Understand why start failed and get to "Praci is ready."
**Preconditions**: Setup window open, Docker running.
**Ideal path**: 3 — read the message, fix the named cause, click "Retry".
**Alternate paths**: none found (Retry is the only recovery control).
### Steps
1. Click "Continue" with no internet. → The pull fails. The status shows "Could not reach the image registry. Check the internet connection, then retry." in the error tone. The button reads "Retry". The technical output opens by itself because a failure asks the person to read it.
2. Maya reads the output, which is a wall of Docker text she does not understand, and reconnects to Wi-Fi.
3. Click "Retry". → The output closes again (the app only auto-closes an expansion it opened itself), the bar restarts at the first phase, and the download begins.
4. Wait. → "Praci is ready." and the main window opens.
### Variations
- Other fixed messages by cause: "Could not bind a local port after retrying. Retry to choose another port."; "Docker has no free network address pools. Remove unused Docker networks or expand Docker’s address pools, then retry."; "Docker stopped answering. Start Docker, then retry."; "Images for <tag> are not published yet. Try again in a few minutes."; generic "Downloading Praci images failed. Check the output below, then retry." or "Praci services did not start. Check the output below, then retry."
- Maya clicks "Quit" while it is starting, then reopens. Message "The start was interrupted. Retry to continue." can appear; she clicks "Retry".
- If saving the finished stack fails, the status reads "The app-managed Praci services are not ready. Retry setup."
### Edge Cases
- If Maya opened "Technical details" herself before the failure, a retry leaves it open (`detailsOpenedByFailure` is only set when the failure opened it).
- "Could not prepare the local stack. Retry." appears if copying the bundled compose files fails; the path is not shown.

## STORY-APP-335: Joining an existing Praci server from the desktop app
**Type**: medium
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Dev, a teammate at Northwind Robotics (dev@northwind.example.test), told to use the team's server at https://praci.northwind.example.test
**Goal**: Point the desktop app at the team server and sign in.
**Preconditions**: Fresh desktop install. The server is up.
**Ideal path**: 5 — choose "Existing instance", type the address, "Check connection", "Continue".
**Alternate paths**: Using the same server from a normal browser needs no setup window at all.
### Steps
1. Select "Existing instance". → The stack panel hides, a "Server address" field with placeholder `https://rakazo.example.com` appears and gets focus. "Check connection" becomes visible.
2. Type `praci.northwind.example.test` and click "Check connection". → UNVERIFIED whether a missing scheme is auto-completed (`normalizeServerUrl` was not read). If the address is not valid, the status shows "Enter a valid http:// or https:// address." If the field is empty, "Enter a server address first."
3. Type the full `https://praci.northwind.example.test` and click "Check connection". → "Checking…", then "Praci answered at https://praci.northwind.example.test." in the ok tone, and the field is rewritten to the normalised address.
4. Click "Continue". → "Connecting…", the main window opens on the server's sign-in page and the setup window closes. The choice is saved for the next launch.
5. Sign in. → Dev sees the team's bots. He is not the deployment owner, so he never sees "Runs on" or "Bots run on" (STORY-APP-339).
### Variations
- Server unreachable: "Nothing is listening at that address yet.", "That host could not be found.", "Timed out reaching that address.", "The server's HTTPS certificate was rejected.", "The server answered with HTTP 502.", "That address redirects elsewhere. Enter the final Praci server address.", or "That address did not respond like a Praci server."
- Public addresses must use HTTPS; "Continue" with a plain http address on a public host returns "Enter a valid server address. Public servers require HTTPS; a new local instance must use localhost."
- If the window cannot open the server, the previous instance is kept: "Could not open that server. The previous instance was left unchanged."
### Edge Cases
- "Check connection" is optional; "Continue" runs the same probe and reports the same errors.
- While a save is in flight the two radios are locked so the choice cannot change under it.
- How a person later switches from one instance to another after setup is UNVERIFIED (not in the files read for this topic).

## STORY-APP-336: Maya makes one bot run on her Mac
**Type**: medium
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, first-time founder of Northwind Robotics and the deployment owner, desktop app on macOS, local Docker stack, bot named "Ops Helper"
**Goal**: Let "Ops Helper" work on files in her own Mac folders instead of the Docker sandbox.
**Preconditions**: STORY-APP-332 finished. At least one bot exists. Default deployment host is Sandbox.
**Ideal path**: 5 — open bot settings, expand Advanced, pick "This Mac" under "Runs on".
**Alternate paths**: Set "Bots run on" to "This Mac" in account Settings (STORY-APP-337) so every bot without its own choice uses the Mac. The per-bot choice overrides the default.
### Steps
1. Open "Ops Helper" and open its settings panel. → The panel shows name, description, notify toggle and skills. "Advanced" is a collapsed row at the bottom.
2. Click "Advanced". → It expands and scrolls into view. First item is "Computer" with two toggles, "Team" and "Private". Below it, a "Runs on" heading with two toggles: "Sandbox" (pressed) and "This Mac".
3. Maya hesitates at "Computer: Team / Private" versus "Runs on: Sandbox / This Mac". They sound alike. (The first chooses whose computer in the sandbox, shared or dedicated; the second chooses where commands execute. Neither explains itself in the UI.)
4. Click "This Mac". → The toggle becomes pressed and the line "Runs commands without asking. Avoid on shared or public servers." appears under the toggles. The bot setting saves immediately (no Save button; changes autosave).
5. Maya reads the warning, thinks about the Northwind laptop being only hers, and keeps it.
6. Ask the bot to list files in her Documents folder. → UNVERIFIED in this pass: what the bot's computer view shows when running on the host.
### Variations
- Maya clicks "Sandbox" again. → The warning hides and the bot returns to the sandbox. If its computer was relocated, UNVERIFIED how the user is told.
- Behind the scenes, if the bot's new place differs from the deployment default and it uses the Team computer, the server gives it its own dedicated computer (`relocateBotComputer` with `setBotComputer("dedicated")`).
### Edge Cases
- After choosing "This Mac", clicking "Team" under "Computer" fails on the server with "This bot runs somewhere other than the default, so it keeps its own computer". How the web UI shows that error is UNVERIFIED.
- On Windows or Linux the same option is labelled "This computer", not "This Mac".
- The label "This Mac" is chosen from the desktop platform (`darwin`), so it also depends on running inside the desktop app.

## STORY-APP-337: Setting the default for all bots with "Bots run on"
**Type**: short
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, deployment owner on the desktop app, local Docker stack, three bots
**Goal**: Make every bot run on the Mac unless it has its own choice.
**Preconditions**: Owner, desktop app, sandbox provider docker.
**Ideal path**: 3 — open Settings, find "Bots run on", click "This Mac".
**Alternate paths**: Per-bot "Runs on" (STORY-APP-336) for one bot at a time.
### Steps
1. Open Settings and stay on the "General" tab; scroll past the avatar style section. → A bordered section titled "Bots run on" sits just above "Server integrations", with "Sandbox" pressed and "This Mac" next to it. (The section only renders after the deployment settings load; before that it is absent, not a spinner.)
2. Click "This Mac". → The toggle presses at once (optimistic) and the warning "Runs commands without asking. Avoid on shared or public servers." appears. The setting is saved to the server in the background.
3. Open a bot that has no choice of its own and expand Advanced. → Its "Runs on" shows "This Mac" pressed, because the bot's displayed value falls back to the deployment default.
### Variations
- A bot with its own saved choice (for example "Sandbox") keeps it when the default changes.
### Edge Cases
- If the save fails, the toggle jumps back to the previous value and a red message shows the error text, or "Could not save".
- The server refuses "this-mac" unless the sandbox provider is docker, with "This Mac mode is only available when SANDBOX_PROVIDER=docker on a personal local app." Since the control is hidden otherwise, this only shows for a stale page.
- Same information appears in two places: this default and each bot's "Runs on". Neither screen mentions the other.

## STORY-APP-338: Opening the same account in a browser — the controls are absent
**Type**: short
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, deployment owner, now signed in from Chrome on the same laptop at the local address
**Goal**: Find where bots run from the browser.
**Preconditions**: Maya set "Bots run on" to "This Mac" in the desktop app (STORY-APP-337). Same server, same account.
**Ideal path**: 3 — she will not find it; the answer is to use the desktop app.
**Alternate paths**: none found.
### Steps
1. Open Settings, "General". → No "Bots run on" section (the component loads deployment settings but renders nothing unless the desktop bridge exists).
2. Open a bot's settings and expand Advanced. → "Computer: Team / Private" is visible; there is no "Runs on".
3. Maya wonders if the setting was lost. It was not; bots keep running on the Mac. Nothing in the browser says so. (Hesitation: she may think the feature was removed.)
### Variations
- None.
### Edge Cases
- A bot saved with "This Mac" is not shown as such in the browser, and saving other bot fields from the browser does not send `runsOn` (the field is only sent when `hostComputer` is offered and changed, in `bot-panel.tsx`).
- Whether commands from a "This Mac" bot still run when only the browser is open is UNVERIFIED.

## STORY-APP-339: A teammate on the shared server never sees where bots run
**Type**: short
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Dev, non-owner teammate on the Northwind Robotics server, using the desktop app against the existing instance
**Goal**: Check where a bot runs and change it.
**Preconditions**: Server uses Docker. Dev is signed in on the desktop app but is not the deployment owner.
**Ideal path**: 2 — not possible; ask the owner.
**Alternate paths**: none found.
### Steps
1. Open Settings, "General". → No "Bots run on" section (`isDeploymentOwner` is false).
2. Open a bot's settings, expand Advanced. → Only "Computer: Team / Private". No "Runs on" (`canChooseHostComputer` is false for non-owners).
### Variations
- Dev calls the API directly with `runsOn: "docker"` and succeeds; with `runsOn: "this-mac"` it returns forbidden (`assertRunsOnAllowed`). There is no UI for this.
### Edge Cases
- Dev has no way to see that one of the owner's bots runs on the owner's Mac.
- The restriction exists because host commands run without asking.

## STORY-APP-340: Computers are off on the server — the Computers panel
**Type**: medium
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, owner of a self-hosted Praci whose `.env` has no sandbox provider
**Goal**: Find out why bots have no computer and turn computers on.
**Preconditions**: Sandbox provider is `none` or empty (`computersAreUnavailable`). Owner is signed in, in a browser or desktop app.
**Ideal path**: 6 — read the hint, copy the `.env` example, restart the stack, click "Check again".
**Alternate paths**: The same hint appears inside the computer view when a bot's computer screen cannot load (Shell computer area). The desktop app with the bundled local stack does not normally reach this state (UNVERIFIED).
### Steps
1. Open Settings. → A "Computer" tab is in the left list only because computers are unavailable (it is hidden otherwise).
2. Click "Computer". → A card titled "Computers" with text: "Computers are off. Set SANDBOX_PROVIDER=docker with SANDBOX_SUPERVISOR_TOKEN, or set SANDBOX_PROVIDER to e2b, daytona, or box with its API key. Recreate the stack after changing .env." Buttons: "Check again", "Copy .env example".
3. Click "Copy .env example". → The button reads "Copied". The clipboard holds commented provider lines with placeholders such as `SANDBOX_PROVIDER=docker` and `SANDBOX_SUPERVISOR_TOKEN=<generate-a-secret>`.
4. Maya pastes the lines into her server `.env`, replaces the placeholder with her own secret, and recreates the stack. (This part happens outside Praci.)
5. Back in Settings, click "Check again". → "Checking computer setup…" then "Checking…" on the button while it runs.
6. On success the card shows "Computers are available. Reload or open a bot to continue." and clears itself after about four seconds. The "Computer" tab goes away on the next refresh of the provider value.
### Variations
- Provider is docker but not answering: "Docker is configured but computers are not responding. Confirm the sandbox supervisor is running, then recreate the stack after changing .env."
- The check itself fails: "Could not verify computer setup (<reason>). Fix the connection, then check again." in an alert region.
- The inline hint in the computer view can also carry "Open computer settings".
### Edge Cases
- This panel is about whether any computer exists. It is separate from "Runs on" and "Bots run on", which only appear once the provider is docker and the person is the owner on desktop.
- Once docker is on and Maya uses the desktop app, "Bots run on" appears in General without any other change.

## STORY-APP-341: Maya compares hosted and local behavior across surfaces
**Type**: long
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, owner at Northwind Robotics, with a desktop app on her Mac and the same account opened in Chrome; later she tries a hosted-sandbox server
**Goal**: Understand which screens show where bots run, and which do not.
**Preconditions**: Local Docker stack from STORY-APP-332. She has "Ops Helper" on This Mac (STORY-APP-336) and "Bots run on" left at Sandbox.
**Ideal path**: 8 — not a single path; this is a tour of the same information on different surfaces.
**Alternate paths**: none found.
### Steps
1. Desktop app, bot settings > Advanced. → "Runs on": "This Mac" pressed for Ops Helper.
2. Desktop app, Settings > "General". → "Bots run on": "Sandbox" pressed. The two screens disagree on purpose: the default is Sandbox, Ops Helper overrides it.
3. Maya thinks this is a contradiction because both say "run on". She searches for a list of which bots use which place and finds none. (Hesitation: the page for the default and the page for the bot do not link to each other.)
4. Desktop app, create a second bot "Research Helper" and open Advanced. → Its "Runs on" is "Sandbox" (inherits the default, nothing stored).
5. Change "Bots run on" to "This Mac". → Research Helper now shows "This Mac"; Ops Helper unchanged.
6. Change "Bots run on" back to "Sandbox". → Research Helper shows "Sandbox". Ops Helper still "This Mac".
7. Open the same account in Chrome. → Neither control is visible (STORY-APP-338).
8. Point the desktop app at a hosted server whose provider is not docker (STORY-APP-335). → Neither control is visible anywhere; selecting one via the API is refused with "Choosing where a bot runs needs the Docker sandbox." This follows from `assertRunsOnAllowed`; it is not a UI path.
### Variations
- Mobile: UNVERIFIED. No mobile control for "Runs on" was found in the files read.
### Edge Cases
- The warning text appears on both screens, keyed to the pressed state, not to the page.
- A bot's stored `runsOn` of null means "follow the default" and cannot be set back to null from the UI once a value was saved; Maya can only pick one of the two options (UNVERIFIED: the UI sends `runsOn` only when it differs from the displayed default).

## STORY-APP-342: Relaunching the desktop app with the stack stopped
**Type**: short
**Topic**: where-bots-run-and-desktop-setup
**Persona**: Maya, owner, desktop app on a local Docker stack, after restarting her laptop
**Goal**: Get back into Praci after a reboot when Docker has not started yet.
**Preconditions**: Setup previously completed with "This computer". Docker is not running at launch.
**Ideal path**: 3 — start Docker, click "Check again".
**Alternate paths**: none found.
### Steps
1. Launch Praci. → The app tries to start the stack before opening a window. A setup window opens showing the attempt, with "This computer" selected and the stack panel already visible (the window attaches to an attempt that is not idle).
2. Read the status. → "Docker is installed but not running. Start Docker, then check again." with the three Docker links and a "Check again" button.
3. Start Docker Desktop and click "Check again". → The stack comes up and the app opens straight into Praci with her existing data. No re-sign-in is described in the code; UNVERIFIED whether the session persists.
### Variations
- If Docker is already running, no setup window appears and the main window opens.
### Edge Cases
- If the saved setup was "Existing instance" and the server is down, UNVERIFIED which message shows; the probe errors in STORY-APP-335 are the likely ones.
