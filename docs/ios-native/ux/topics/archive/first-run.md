# First run: server, sign in and recovery

Planned native SwiftUI app (epic #427), phase 2 issue #414. Boards: `docs/design-system/ios/boards/PG-B-SignIn.dc.html`, `PG-B-Server.dc.html`, rule cards in `PG-B-Rules.dc.html` (Sign in, Server, Settings). Current behavior comes from the Expo app (`apps/mobile/app/sign-in.tsx`, `server.tsx`, `(settings)/account.tsx`, `lib/endpoint.ts`, `lib/session.ts`, `lib/sso.ts`, `lib/api.ts`). Persona names and figures are invented.

Notes that apply to every story:
- The sign-in board shows one state only: the SSO button, the "or" divider, grouped Email and Password, one error line ("Could not continue"), "Sign in", "Forgot password?", "Don’t have an account? Sign up" and "Use a custom server". Sign-up, forgot-password and loading/retry states are described in the rule card text but not drawn.
- The board title reads "Sign in to Rakazo" and the wordmark "Rakazo". The Expo app says "Sign in to Praci" (the product is being renamed to Praci). The native app needs one decision.
- Expo opens the screen in sign-up mode by default (`initialAuthMode` returns `"up"` unless `mode=in`). The board and the rule card show the Sign in state as the root screen.

## STORY-001: Sign in with email and password on the default server
**Type**: short
**Topic**: First run: server, sign in and recovery
**Persona**: Maya Okafor, founder of a 4-person seed-stage startup, returning to the app on a new phone
**Goal**: Get from a fresh install to the signed-in home screen with an existing account.
**Preconditions**: Fresh install, no token in the Keychain. The default server is reachable and `GET /api/auth/capabilities` reports password auth, no SSO.
**Device**: standard iPhone
**Ideal path**: 4 — type Email, type Password, tap Sign in, land on Home.
**Alternate paths**: Press the keyboard Go key (`returnKeyType="go"` in Expo) in the Password field instead of tapping Sign in. Continue with SSO (STORY-003). Sign up first (STORY-004).
**Design source**: Sign in screen: `PG-B-SignIn.dc.html`, rule card "Sign in" (prominent action: "Sign in", full-width ink pill). Home after sign-in: `PG-A-Home.dc.html` (out of scope here).

### Steps
1. Launch the app → The root screen shows the wordmark, the title "Sign in to Rakazo" and grouped fields. No Back control. Capabilities load first ("Loading…" per the rule card).
2. Tap the "Email" field and type `maya@example.com` → Keyboard opens, field shows text.
3. Tap the "Password" field and type the password → Text is masked.
4. Tap "Sign in" → Button shows a working state, `POST /api/auth/sign-in/email` succeeds, the token goes to the Keychain, the selected space is cleared first, and the app replaces the root with Home.

### Variations
- Wrong password: a red line above the button reads "Could not continue" or the server message (board shows "Could not continue"). Fields keep their values.
- Email field empty or password shorter than 8: `credentialIssue` returns a local message before any request (Expo `credentialIssueText`). The board does not show these texts.

### Edge Cases
- Rate limit (10 attempts per 15 minutes on auth routes) returns an error; the board shows only the generic red line.
- Token arrives only in the `better-auth.session_token` cookie: the client must fall back to it (README section 4).
- Double tap on Sign in: the Expo app ignores a second submit while pending.

### Design gaps
- Title mismatch: board "Sign in to Rakazo" vs Expo "Sign in to Praci".
- No board for the button's pending label (Expo: "Working…") or for local validation messages.
- No board for the Password field Go key behavior or focus order.
- Which mode (sign in or sign up) the app opens in for a first launch is not decided; Expo opens sign-up, the board shows sign-in.

## STORY-002: Switch to a self-hosted server before signing in
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Persona**: Tomas Berg, CTO of a 6-person startup that runs its own Praci server on a private network
**Goal**: Point the app at the company server (`https://praci.example.test`) and sign in.
**Preconditions**: Fresh install, signed out. The company server answers `POST /rpc/health` with `json.ok === true`. His phone is on the office network.
**Device**: standard iPhone
**Ideal path**: 7 — open the sheet, type the address, Save, then email, password, Sign in.
**Alternate paths**: Open the same Server sheet later from Settings (rule card: "Sheet, medium detent, from Sign in or Settings"; the Settings board has no visible Server row). Type the address without a scheme; the Expo app adds `https://`.
**Design source**: `PG-B-SignIn.dc.html` ("Use a custom server" link); `PG-B-Server.dc.html`, rule card "Server" (Cancel xmark, Save prominent checkmark, one sentence, URL field, "Use default server").

### Steps
1. On the sign-in screen tap "Use a custom server" → The Server sheet opens at a medium detent.
2. Read "Enter your Rakazo server address." → The URL field (placeholder `https://app.example.com`, accessibility label "Server address") shows the default host as its placeholder.
3. Type `praci.example.test` → Field accepts input; any earlier error clears. "Use default server" appears once the text differs from the current address.
4. Tap Save → Save shows a spinner while the app probes `POST /rpc/health`; the address is normalized to origin only (scheme, host, port).
5. The sheet closes → Sign in shows the new host. The link now reads "Custom server praci.example.test" (Expo accessibility label "Custom server {host}").
6. Capabilities reload for the new host → SSO button and reset link appear or disappear to match the new server.
7. Enter Email and Password, tap "Sign in" → Signed in against the company server.

### Variations
- Choose "Use default server" later from the same sheet to go back; the placeholder host returns.
- Plain `http://` is accepted only for loopback, `.local`, private ranges and Tailscale (README section 4). Expo shows "Public servers need https://. HTTP only works on your local network." under the field.

### Edge Cases
- Unreachable or timed out (8 s): red line under the field ("Could not reach this server" on the board; Expo text is "Could not reach that server"), the typed address is kept.
- Reachable but not a Praci server: Expo says "That URL did not look like a Praci server". The board has no such line.
- Not a URL, empty, or missing host: Expo shows "Enter a server URL", "That doesn’t look like a URL", "That URL is missing a host", "Use an http or https URL". None are on the board.
- Changing servers while signed in wipes token, selected space and caches (README section 4); see STORY-008.
- Tap Cancel (xmark) with an unsaved address: no change.

### Design gaps
- Label mismatch: board "Could not reach this server" vs Expo "Could not reach that server"; board "Rakazo server" vs Expo "Praci server".
- The other validation errors and the http warning line have no board.
- No Server row on the Settings board even though the rule card says the sheet opens from Settings.
- No design for a confirmation before a server change wipes a signed-in session.
- The same server host is shown on the sign-in link and (planned) Settings; its exact format is only defined in Expo (`displayApiHost`).

## STORY-003: Continue with SSO from the sign-in screen
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Persona**: Priya Natarajan, head of operations at a 15-person company whose server has one OIDC provider
**Goal**: Sign in through the company identity provider without typing a password.
**Preconditions**: Server capabilities report `sso: { name: "Example SSO" }`. Fresh install.
**Device**: standard iPhone
**Ideal path**: 3 — tap "Continue with Example SSO", complete the provider page, land on Home.
**Alternate paths**: Email and password if the server also allows password auth (STORY-001). On a server with SSO only, SSO is the only route.
**Design source**: `PG-B-SignIn.dc.html` (SSO button at the top of the card, "or" divider), rule card "Sign in". The provider page and consent sheet are system UI (`ASWebAuthenticationSession`): NO BOARD.

### Steps
1. Open the app → Sign in shows the button "Continue with Example SSO", then "or", then the email fields.
2. Tap "Continue with Example SSO" → The app calls `POST /api/auth/sign-in/social` with `disableRedirect`, reads the `better-auth.oauth_state` cookie, and opens the Expo authorization proxy in `ASWebAuthenticationSession` with callback scheme `rakazo`. iOS shows its standard sign-in consent prompt.
3. Sign in at the provider page → The session closes on the `rakazo://sign-in` callback, the token is parsed from the callback `cookie` parameter, confirmed with `GET /api/auth/get-session`, saved to the Keychain, and the app replaces the root with Home.

### Variations
- Expo places the SSO button below the form as a quiet button in one layout path and above as a prominent button in another; the board puts it first. Native should follow the board.
- Account created for the first time through SSO may need integration setup (see Design gaps).

### Edge Cases
- User cancels the system sheet: the red line shows "Could not continue" or nothing; pending state ends. The board does not say which.
- Provider returns without a token or `get-session` fails: red line "Could not continue".
- Server drops SSO between launches: capabilities no longer include `sso`, so the button disappears.

### Design gaps
- Cancel and failure handling after the web sheet is not specified.
- The provider name is dynamic; the board shows only "Example SSO". Long provider names are not designed.
- First-time SSO users: Expo routes sign-up to `/integration-setup` when `integrationSetup/get` says `needsSetup`; the plan (phase 3 and 9) and boards have no screen for it. NO BOARD.
- The system consent prompt is outside the app; nothing documents it for review.

## STORY-004: Create an account on a server that requires email verification
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Persona**: Jamal Reyes, solo founder trying a hosted private beta
**Goal**: Sign up, verify the email address, and sign in.
**Preconditions**: Fresh install, hosted server with sign-up enabled and email verification on.
**Device**: standard iPhone
**Ideal path**: 8 — switch to sign up, name, email, password, Sign up, read "Check your email", open the mail link, return and Sign in.
**Alternate paths**: A server that does not require verification returns a session directly and Jamal lands on Home after step 5. SSO sign-up (STORY-003).
**Design source**: `PG-B-SignIn.dc.html` ("Don’t have an account? Sign up" link only). Sign-up form with the "Name" field: NO BOARD. "Check your email" state: described in the rule card ("Reset sent: title becomes Check your email") but not drawn, and described for reset only. Mail app and link: system UI.

### Steps
1. On Sign in tap "Sign up" in "Don’t have an account? Sign up" → The screen switches to sign-up mode: title becomes "Sign up for Praci" (Expo), a "Name" field appears above Email, the button reads "Sign up", the link reads "Already have an account? Sign in".
2. Type name "Jamal Reyes", email and an 8-or-more character password → Fields accept input. Name is optional; Expo falls back to the part of the email before `@`.
3. Tap "Sign up" → `POST /api/auth/sign-up/email` runs.
4. Server answers with verification required and no session → Title becomes "Check your email" and VoiceOver announces it.
5. Open the Mail app, tap the verification link → The link verifies the account in the browser.
6. Return to Praci → The screen still shows "Check your email" with a "Back to sign in" link.
7. Tap "Back to sign in", enter Email and Password, tap "Sign in" → Signed in.
8. Home loads → New account, empty Personnel list (`PG-A-Home` empty state "Tap + to create a bot").

### Variations
- Password under 8 characters: local message before the request.
- Email already registered: server error shows in the red line.

### Edge Cases
- App is killed between steps 4 and 6: it reopens at the default root mode; the user must re-enter the email.
- The verification link opens in Safari, not the app; no `rakazo://` deep link is defined for verification in the plan.
- Rate limit (10 per 15 minutes) applies to sign-up too.

### Design gaps
- No board for sign-up mode (Name field, button, switch links).
- The "Check your email" variant is described only for password reset; verification reuse is a Expo behavior not in the plan.
- No design for returning to the app after verification, or resending the email.
- Default launch mode (sign-up in Expo, sign-in on the board) is undecided.

## STORY-005: Reset a forgotten password
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Persona**: Lena Fischer, operations lead who changed phones and forgot her password
**Goal**: Request a reset link, set a new password in the browser, and sign in.
**Preconditions**: Server capabilities report `passwordReset: true` and a `resetUrl`.
**Device**: standard iPhone
**Ideal path**: 7 — Forgot password?, type Email, Send reset link, read confirmation, open mail link and set password, Back to sign in, Sign in.
**Alternate paths**: SSO if the account is linked (STORY-003). Change password from Settings once signed in (STORY-007 mentions it; no screen).
**Design source**: "Forgot password?" link on `PG-B-SignIn.dc.html`. Forgot-password form: NO BOARD (rule card only says "Reset sent: title becomes Check your email"). Web reset page: not part of the app.

### Steps
1. On Sign in tap "Forgot password?" → The screen changes to forgot mode: title "Reset your password" (Expo), only the Email field remains, the button reads "Send reset link", the bottom link reads "Back to sign in".
2. Type the email address → Field accepts input.
3. Tap "Send reset link" → The app calls the server password-reset request with the server's `resetUrl`.
4. Request succeeds → Title becomes "Check your email"; VoiceOver announces it.
5. In Mail, open the reset link → The browser shows the server's web reset page. Lena sets a new password there.
6. Return to Praci and tap "Back to sign in" → Sign-in mode returns with the error line cleared.
7. Enter Email and the new password and tap "Sign in" → Signed in.

### Variations
- Same flow from an inner display or half-folded pose: the card is centered at 380 pt on the 2/3 side or the left half (rule card).

### Edge Cases
- Server has no reset: the link is not shown. If reached anyway, Expo throws "Password recovery is not configured for this server".
- Capabilities request fails: Expo shows "Could not load sign-in options" with "Retry" in place of the form; the rule card names this state ("Options failed: message with Retry") but the board does not draw it.
- Unknown email: the server's behavior is not stated in the plan; the screen would show the same confirmation or an error.

### Design gaps
- No board for forgot mode, "Check your email", "Back to sign in", or "Retry".
- The confirmation gives no way to resend or to open the Mail app.
- The reset page is in a browser outside the app; returning to the app is manual.

## STORY-006: Server is unreachable or capabilities fail on first launch
**Type**: short
**Topic**: First run: server, sign in and recovery
**Persona**: Dev Anand, founder on a train with patchy signal
**Goal**: Recover from a failed first load and reach the sign-in form.
**Preconditions**: Fresh install, no connectivity to the default server at first.
**Device**: standard iPhone
**Ideal path**: 3 — see the error, tap Retry, form appears once the network returns.
**Alternate paths**: Open "Use a custom server" and pick another address (STORY-002). Wait for the network and relaunch.
**Design source**: Rule card "Sign in" ("Loading options: Loading text. Options failed: message with Retry"). The states are not drawn on `PG-B-SignIn.dc.html`: NO BOARD for the visible layout of loading and failed options.

### Steps
1. Launch the app with no signal → Sign in shows "Loading…" while `GET /api/auth/capabilities` runs (8 s timeout in the Expo client).
2. The request fails → Message "Could not load sign-in options" and a "Retry" button replace the form. The "Use a custom server" link stays reachable.
3. Signal returns, tap "Retry" → Capabilities load and the form appears with the right SSO and reset options.

### Variations
- An old server returns the legacy capabilities shape: the client treats it as password only; the SSO button and "Forgot password?" do not appear.

### Edge Cases
- Failure repeats: the same message stays; no count or detail is shown.
- Server reachable but returns non-JSON: treated as failure.
- Airplane mode: the only action that does not need the network is opening the Server sheet.

### Design gaps
- No drawn layout for loading or the failed-options message; unclear whether the email fields are hidden or disabled.
- No board for the "sign-in screen when offline" in general; no distinction between "no network" and "server wrong".
- "Retry" vs the "Try again" used on Home and Artifacts boards.

## STORY-007: Sign out, then delete the account
**Type**: long
**Topic**: First run: server, sign in and recovery
**Persona**: Grace Whitfield, founder who is shutting down her test workspace and removing her data
**Goal**: Sign out of the app, sign back in, and permanently delete the account.
**Preconditions**: Signed in with email and password on the default server. Two bots, several saved chats, push enabled.
**Device**: standard iPhone
**Ideal path**: 12 — Settings, profile, Sign out, sign in, Settings, profile, Delete account, confirm with password, land on Sign in.
**Alternate paths**: Delete an SSO-only account with "Sign in again" (re-authenticate) or "Send deletion code" and the emailed code (steps 9 to 10 variations). Sign out from Duo inner display Settings (detail in the 2/3 pane).
**Design source**: `PG-B-Settings.dc.html` rule card (profile row "Account"; "Sign-out and delete account live on the profile detail (Account)"). The Account detail screen itself, the delete confirmation and the re-authentication dialog: NO BOARD. `DS-04-Overlays.dc.html` holds the generic alert pattern (confirm with Cancel / Delete, as used in group delete).

### Steps
1. On Home open the account entry in the sidebar or top bar → The Settings sheet opens (rule card: "Opened as a sheet from the sidebar profile").
2. Tap the profile row showing the user name and "Account" → The Account detail pushes.
3. Tap "Sign out" → The app calls sign-out, clears the Keychain token, selected space, saved chats, outbox and caches, and bumps the session generation.
4. App replaces everything with Sign in → The settings sheet closes at any depth; Sign in is the only screen. Push notification registration for this device should end (not specified).
5. Enter Email and Password, tap "Sign in" → Home loads, caches are empty and refetched.
6. Reopen Settings → profile row → Account.
7. Tap "Delete account" → For a password account the app asks for the current password in a native prompt titled "Delete your account?" with the text "This permanently deletes your account, bots, conversations, memories, files, and saved connections. This cannot be undone." and buttons "Cancel" and "Delete".
8. Type the current password → The password field is secured.
9. Tap "Delete" → `/api/auth/delete-user` runs with the password.
10. Deletion succeeds → The app clears local state and replaces everything with Sign in.
11. Try the old email and password → Sign in shows a red error line.
12. Confirm Home is not reachable → Only Sign in is available; no cached data appears.

### Variations
- Account without a password (SSO): the dialog offers "Sign in again" (fresh SSO) or "Send deletion code" and a "Deletion code" field instead of "Current password". The delete button stays disabled until one route is complete.
- Sign-out fails (offline): Expo shows "Could not sign out" and keeps the session.
- Wrong password: "Could not delete account" shows in the dialog.

### Edge Cases
- Another device deletes the account first: the next call returns 401 and the session is rejected (STORY-008).
- A queued outbox message exists at sign-out: the outbox is wiped with the session; the user is not warned.
- Delete during a running agent: the plan does not say what happens to runs.
- App Store rule 5.1.1(v) requires in-app deletion; this path satisfies it only if the entry point is visible from the app.

### Design gaps
- No board for the Account detail screen, which carries both Sign out and Delete account.
- No board for the delete confirmation or the SSO re-authentication and email-code variants.
- The settings board shows "Change password" but the destination screen (and its token replacement) has no board.
- The plan does not state whether sign-out unregisters the push token, or warns about unsent outbox messages.
- The settings board lists "Account" under the profile; the Expo screen also has appearance, language, notifications. These are not on the iOS Settings board.

## STORY-008: Session rejected by the server while using the app
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Persona**: Owen Castillo, operator who is signed in on two phones
**Goal**: Understand and recover when the server stops accepting his session, without losing a newer sign-in.
**Preconditions**: Signed in on the default server. An admin revokes his session, or the session expires after inactivity (default lifetime is an inference, not confirmed).
**Device**: standard iPhone
**Ideal path**: 4 — open the app, a call returns 401, the app returns to Sign in, sign in again.
**Alternate paths**: Opening a thread mid-stream: an SSE `error` frame with status 401 ends the stream and signs out or re-selects the space (README section 4). Changing servers in Settings also returns to Sign in (steps below, variation).
**Design source**: `PG-B-SignIn.dc.html` (destination). The rejection moment itself, any message such as "session ended", and the stale-space recovery: NO BOARD.

### Steps
1. Open the app from the background and tap a bot → An RPC call returns 401 without a space header.
2. The app treats the session as rejected → It clears the Keychain token and caches and replaces the whole stack with Sign in (Expo `replaceWithSignIn`, explicit mode "in").
3. Sign in shows no explanation → Owen sees the normal form.
4. Enter Email and Password, tap "Sign in" → New token saved, space cleared, Home loads.

### Variations
- 401 with a space header (the user left the space or it was deleted): the app re-probes without the header. If the session is still valid it drops the stale space and reselects; otherwise it signs out.
- Server changed from the Server sheet while signed in: token, space and caches are wiped and the user lands on Sign in for the new server.

### Edge Cases
- A 401 from before a newer sign-in arrives late (for example, user signed in again, or switched space A to B to A): the session-generation counter must ignore it so it does not sign out the new session.
- Password change on another device returns a replacement token in the same flow; only the changing device gets it.
- 401 during an upload or send: the outbox item is not resent after sign-in unless the same session returns; behavior is not specified.
- 5xx or offline is not 401: no sign-out; each screen shows its own error.

### Design gaps
- No message tells the user why they were signed out (Sign in looks the same as a first run).
- No board for recovery from a stale space (space picker or empty state after the space is removed).
- The outbox and unsent drafts after a forced sign-out are undefined.
- Offline-first launch with a saved-chat snapshot while the token is invalid: the plan shows snapshot first, but not what happens before the 401.

## STORY-009: Set up the app on iPhone Duo with a custom server
**Type**: long
**Topic**: First run: server, sign in and recovery
**Persona**: Sofia Marin, founder using an iPhone Duo as her main phone, new to Praci
**Goal**: On the outer display, set a custom server and sign in, then unfold to the inner display and continue.
**Preconditions**: Fresh install, signed out, iPhone Duo closed (outer display). Server `https://praci.example.test` is reachable. SSO is not configured.
**Device**: iPhone Duo outer
**Ideal path**: 10 — outer: open the server sheet, Save, sign in; then unfold and see Home.
**Alternate paths**: Start the setup with the Duo already open on the inner display (steps 6 to 8). Half-folded pose (steps 9 to 10 in a variation).
**Design source**: `PG-B-SignIn.dc.html` and `PG-B-Server.dc.html` for the outer layout ("Island and time only, no toolbars"). Inner display: rule cards in `PG-B-Rules.dc.html` (SignIn: "Centered 380pt card on the 2/3 side; 1/3 shows the wordmark only"; Server: "Form sheet centered on the 2/3 side"). Half-folded: SignIn "Card centered on the left half; right half stays background"; Server "Form sheet in the right half". Laptop pose: "Not applicable". Boards for these inner and half-folded states are not drawn on the canvas for sign-in: NO BOARD for the unfolding transition.

### Steps
1. Hold the Duo closed and launch Praci → Outer-display Sign in: wordmark, title, grouped Email and Password, ink "Sign in" pill, text links.
2. Tap "Use a custom server" → Server sheet at medium detent. The Cancel and Save controls are in the sheet header.
3. Type `praci.example.test` and tap Save → Spinner in Save, the host is probed, sheet closes.
4. Back on Sign in the link shows "Custom server praci.example.test" → Capabilities reload (password only).
5. Type Email, Password, tap "Sign in" → Signed in. Home shows on the outer display.
6. Unfold the Duo to the inner display → Home becomes the 1/3 sidebar plus 2/3 detail layout with Personnel in the sidebar.
7. The Keychain token and server are shared → No second sign-in is needed.
8. (If unfolding happens on the Sign in screen) the card is centered at 380 pt on the 2/3 side and the 1/3 side shows only the wordmark → The typed Email and Password keep their text.
9. Half-fold the device while the Server sheet is open → The sheet moves to the right half; the Sign in card is on the left half.
10. Tap Save in the sheet → The sheet closes; the Sign in card remains in the left half.

### Variations
- Server sheet from Settings on the inner display shows as a form sheet centered on the 2/3 side.
- Keyboard use with the fold: nothing interactive crosses the fold (plan phase 7).

### Edge Cases
- Typed text or an in-flight request must survive a posture change (layout change, not a new screen).
- In the half-folded pose the keyboard may cover the right half sheet; the board does not say where the keyboard appears.
- Laptop pose is "Not applicable"; if the Duo enters it on Sign in, the layout must stay a single column.

### Design gaps
- The sign-in and server rule cards describe inner and half-folded layouts, but the sign-in board has only the outer-display canvas; inner and half-folded versions need drawings.
- No guidance on state kept across posture changes while typing.
- Sheet and keyboard placement in the half-folded pose.
- The Duo simulator cannot run extensions; first-run needs only the app, so this is not a blocker.

## STORY-010: First run on a server with an older API
**Type**: short
**Topic**: First run: server, sign in and recovery
**Persona**: Kenji Watanabe, platform engineer testing a self-hosted server that lags the current release
**Goal**: Sign in against an older server and see only the features it supports.
**Preconditions**: Server returns the legacy capabilities shape (no `sso`, `passwordReset` or `billing` fields). `rpc/health` returns ok.
**Device**: standard iPhone
**Ideal path**: 4 — set the server, see password-only sign in, sign in, land on Home.
**Alternate paths**: None found; no upgrade guidance exists in the plan.
**Design source**: `PG-B-Server.dc.html` and `PG-B-SignIn.dc.html`. Behavior for a missing optional field or a 404 on a newer procedure: NO BOARD.

### Steps
1. Open "Use a custom server", type the address and Save → Probe succeeds.
2. Sign in loads capabilities → Legacy shape is treated as password-only: no SSO button, no "Forgot password?" link.
3. Enter Email and Password, tap "Sign in" → Signed in.
4. Home loads and a newer procedure returns 404 → The client treats it as "not supported" and tolerates missing optional fields (README section 2), so Home renders without those parts.

### Variations
- Billing field absent: no billing UI appears (hosted-service features are separate).

### Edge Cases
- `health` returns a fixed version, so the client cannot detect an old server up front and must handle failures per call.
- Mixed state: SSO missing but user previously signed in with SSO on another server; the account must use a password.

### Design gaps
- No board or copy for a feature the server does not support (hidden vs disabled vs explained).
- No minimum-version message: the plan says there is no API versioning.
- Contract export (phase 1) generates models for the current server only, so the decoders must tolerate missing optional fields; no board shows which screens degrade.
