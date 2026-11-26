# Sign-in and server

Native iOS app (`apps/ios`), re-read from source for this pass: `AuthenticationView.swift`, `AuthenticationModel.swift`, `ServerView.swift`, `SSOBrowser.swift`, `App/RootView.swift`, `PraciApp.swift`, `Settings/SettingsScreen.swift`, `Settings/Account/AccountScreen.swift`, and in `Packages/RakazoCore` `ServerEndpoint.swift` and `AuthClient.swift`. Nothing was run on a device; steps describe what the code does. Persona names and addresses are invented.

Facts that apply to every story:
- `RootView` shows `AuthenticationView` whenever `isSignedIn` is false, otherwise `AppShell`. There is no separate launch screen.
- The screen shows "Praci", a large title (Sign in, Sign up, Reset password or Check your email), the form, an error or notice line, and a "Use a custom server" button at the bottom of every page.
- The built-in default server is `http://127.0.0.1:3100` (a local development address), so a fresh install on a real phone needs the custom server sheet before anything works.
- Sign-in methods come from the server (`/api/auth/capabilities`): an SSO button ("Continue with {provider name}"), password fields, and "Forgot password?" (only if the server allows reset and gives a reset URL).

## STORY-001: Sign in with email and password
**Type**: short
**Topic**: Sign-in and server
**Persona**: Maya Okafor, founder with an existing account, installing the app on a new phone
**Goal**: Reach Home with an existing account.
**Preconditions**: Server already reachable (a custom server was saved earlier or the default works); password sign-in enabled; no session in the Keychain.
**Ideal path**: 4. Type Email, type Password, tap Sign in, land on Home.
**Alternate paths**: SSO button (STORY-004). Sign up first (STORY-002). No keyboard shortcut for submit is wired (no `onSubmit` on the fields), so the button is the only route.

### Steps
1. Launch the app → "Connecting…" spinner, then the Sign in page with Email and Password fields in one rounded card and a bordered "Sign up" button below the prominent "Sign in" button.
2. Tap "Email" and type `maya@example.com` → Keyboard is the email type, no capitals or autocorrect.
3. Tap "Password" and type the password → Text is masked; the eye button ("Show password") reveals it.
4. Tap "Sign in" → The button disables, "Working…" appears, the password clears, and `RootView` swaps to Home.

### Variations
- Reveal the password with the eye button, then tap "Hide password". The reveal resets to hidden whenever the page changes.
- Wrong password: a red line shows the server's message, or "Couldn’t continue. Try again." if there is none. The password field is emptied; the email is kept.

### Edge Cases
- Empty or malformed email or password: the client returns "Enter a valid email." or "Enter a valid password." without a request.
- Double tap on "Sign in": `submit()` ignores a second call while busy, and every control on the page is disabled.
- Password manager autofill: the fields declare `.emailAddress` and `.password` content types, so iOS offers saved logins.

## STORY-002: Sign up and verify email
**Type**: medium
**Topic**: Sign-in and server
**Persona**: Priya Nair, first-time user on a server that requires email verification
**Goal**: Create an account, confirm the email, and sign in.
**Preconditions**: Reachable server with password auth; email verification required; Priya has her mail app.
**Ideal path**: 6. Sign up, fill Name, Email, Password, submit, confirm in mail, sign in.
**Alternate paths**: Continue with SSO creates an account without verification (STORY-004). If the server does not require verification, submitting Sign up signs in directly and the story ends at step 4.

### Steps
1. On Sign in tap "Sign up" → Title becomes "Sign up"; a Name field appears above Email; Password gets the new-password autofill type.
2. Fill "Name", "Email" and "Password" → Fields accept input.
3. Tap "Sign up" → "Working…", then the page changes to "Check your email" with "Verify your email, then sign in."
4. Switch to the mail app, open the verification link, return to Praci → The app is still on "Check your email".
5. Tap "Back to sign in" → Sign in page (email is kept, password was cleared).
6. Type the password and tap "Sign in" → Home.

### Variations
- Tap "Resend verification email" on the check page → Notice "Verification email sent." in grey under the buttons.
- Tap "Back to sign in" in the sign-up page before submitting → Returns to Sign in; the password is cleared and any message is dismissed.

### Edge Cases
- Name empty: "Enter your name." appears without a request.
- App is backgrounded while Priya reads mail: on return `revalidate()` runs only when signed in, so the check page stays as it was; nothing detects the verification, and she must go back and sign in by hand.
- "Resend verification email" depends on the email field, which is not shown on the check page; it reuses the typed value. If the app was relaunched, the field is empty and the resend fails with "Enter a valid email." (the user cannot see or fix the field there).

## STORY-003: Reset a forgotten password
**Type**: short
**Topic**: Sign-in and server
**Persona**: Tomas Berg, locked out after changing phones
**Goal**: Get a reset email.
**Preconditions**: Server allows password reset and returns a reset URL.
**Ideal path**: 4. Forgot password, type email, send, read notice.
**Alternate paths**: None in this app for a signed-out user. A signed-in user changes the password in Settings, Account, "Change password" (out of scope here).

### Steps
1. On Sign in tap "Forgot password?" → Title becomes "Reset password"; only the Email field remains; the SSO button is hidden.
2. Type the email → Field accepts input.
3. Tap "Send reset link" → "Working…", then notice "If an account exists, you’ll receive a reset link." (same text whether or not the account exists).
4. Open the emailed link in mail → The reset happens in Safari on the web; the app is not involved.
5. Return to the app and tap "Back to sign in" → Sign in page.

### Variations
- Server without reset: "Forgot password?" is not shown at all.

### Edge Cases
- The reset link does not open the app (no handler is wired for it); the user must come back manually.
- Tapping "Send reset link" twice: the second tap is ignored while busy; the notice is not repeated.

## STORY-004: Continue with single sign-on
**Type**: medium
**Topic**: Sign-in and server
**Persona**: Dana Whitfield, team member whose company runs an SSO provider named "Acme ID"
**Goal**: Sign in without a password.
**Preconditions**: Server capabilities include an SSO provider with availability `available`.
**Ideal path**: 2. Tap the SSO button, finish in the sheet.
**Alternate paths**: Password fields below the button when the server also allows them.

### Steps
1. Open the app → Sign in page shows a bordered "Continue with Acme ID" button, then "or", then the password fields.
2. Tap "Continue with Acme ID" → App asks the server for a challenge and opens a system web sign-in sheet (private session, so no saved cookies).
3. Complete the provider's login in the sheet → Sheet closes on the `rakazo://` callback; the app exchanges the callback and `RootView` swaps to Home.

### Variations
- Provider availability is checking: the button is disabled and "Checking SSO…" shows with a "Retry" button.
- Provider unavailable: button disabled, "SSO is unavailable." and "Retry".
- Server offers SSO only: no "or" line and no password fields.

### Edge Cases
- Dana taps Cancel in the sheet: no error appears; the page returns to normal.
- The sheet cannot open (for example no foreground window) or fails: "Couldn’t open sign-in. Try again."
- Callback invalid or expired: "Couldn’t continue sign-in."; the pending challenge is cancelled.
- A second tap while the first is running is ignored; the button is disabled while busy.

## STORY-005: Point a fresh install at a company server (https)
**Type**: medium
**Topic**: Sign-in and server
**Persona**: Tomas Berg, CTO running his own server at `praci.example.test`
**Goal**: Sign in against the company server instead of the built-in default.
**Preconditions**: Fresh install, signed out; the company server is reachable over https.
**Ideal path**: 7. Open the sheet, type the address, Save, then Email, Password, Sign in.
**Alternate paths**: A valid external server link (`rakazo://connect?server=<origin>`, printed as a QR code by `pnpm connect`) opens the same sheet at any authentication state; the sheet's "Scan QR code" button (real devices only) reads the same link; otherwise the sheet is opened from Sign in.

### Steps
1. On Sign in tap "Use a custom server" → A sheet titled "Server" opens with the field already filled with `http://127.0.0.1:3100`.
2. Select the text and type `praci.example.test` → No scheme needed.
3. Tap "Save" (or the keyboard return key) → The address becomes `https://praci.example.test`; the page shows "Checking server…" while the app confirms it is a Praci server.
4. Sheet closes → Sign in page is empty (email, password and name cleared) and capabilities reload for the new host.
5. Type Email and Password → Fields fill.
6. Tap "Sign in" → Home.

### Variations
- Include a port (`praci.example.test:8443`) or a path (`/app`): the path, query and login details are stripped; only scheme, host and port are kept. Default ports 443/80 are dropped.
- On a device with a camera scanner the sheet starts with a "Scan QR code" button. It opens a "Scan QR code" screen with Cancel. A scanned `pnpm connect` code fills the address and shows the same "Use this server?" confirmation. If the camera is denied the screen shows "Camera is unavailable." with "Open Settings". The button is hidden in the simulator. Not run on a device.
- A different SSO or reset setup on the new server changes which buttons appear.

### Edge Cases
- Empty field: Save is disabled.
- `ftp://x`: "Use an http or https URL." Garbage text: "That doesn’t look like a URL." `host:` with a non-number port: "Use an http or https URL."
- Server unreachable: "Couldn’t reach the server. Try again." stays in the sheet and the old server remains.
- Reachable but not Praci: "That URL did not look like a Praci server."
- Saving the same address as the current one just closes the sheet.
- Cancel is disabled and swipe-down dismiss is blocked while "Checking server…" runs.

## STORY-006: Use a server on the local network over http
**Type**: medium
**Topic**: Sign-in and server
**Persona**: Leo Marchetti, developer testing against a Mac on the same Wi-Fi
**Goal**: Connect over plain http to `http://local-server.example.test:3100`.
**Preconditions**: Signed out; the server is on a private address; local network permission may be asked by iOS.
**Ideal path**: 5. Open sheet, type, Save, confirm, then sign in.
**Alternate paths**: None.

### Steps
1. Tap "Use a custom server" → Server sheet opens.
2. Type `http://local-server.example.test:3100` and tap "Save" → Alert "Use this server?" says "This connection is unencrypted. Only continue on a trusted network."
3. Tap "Use anyway" → Same check and reset as STORY-005; sheet closes.
4. Sign in with email and password → Home.

### Variations
- Tap "Cancel" in the alert: nothing changes, the sheet stays open with the typed text.
- Allowed private hosts: `localhost`, `127.0.0.1`, `::1`, names ending in `.local`, 10.x, 172.16-31.x, 192.168.x, 100.64-127.x (Tailscale range).

### Edge Cases
- `http://praci.example.test` (public name): rejected before any alert with "Public servers need https://."
- iOS shows its own local network permission prompt the first time the app reaches a LAN host; denial surfaces as "Couldn’t reach the server. Try again."
- A manually entered https address has no alert when signed out. A valid external link always asks for confirmation, including https or the current address, and names its host; it includes the existing HTTP and signed-in warnings only when applicable. Cancel leaves the server and session unchanged.

## STORY-007: Return to the default server
**Type**: short
**Topic**: Sign-in and server
**Persona**: Leo Marchetti, done testing
**Goal**: Go back to the built-in server.
**Preconditions**: Signed out, custom server saved.
**Ideal path**: 3. Open sheet, "Use default server", done.
**Alternate paths**: Type the default address by hand.

### Steps
1. Tap "Custom server" button (label is always "Use a custom server", it does not show the current host) → Sheet opens showing the current address.
2. Tap "Use default server" → Field is set to `http://127.0.0.1:3100` and saving starts at once; because it is http, the "Use this server?" alert appears.
3. Tap "Use anyway" → Sheet closes; the sign-in page reloads capabilities.

### Variations
- Already on the default: the button saves the same address and the sheet closes with no alert.

### Edge Cases
- The default is a loopback address, so on a real phone capabilities fail: the page shows the error and a "Retry connection" button.

## STORY-008: Session ended notice
**Type**: medium
**Topic**: Sign-in and server
**Persona**: Maya Okafor, signed in for weeks
**Goal**: Recover when the server stops accepting her session.
**Preconditions**: Signed in; the server has revoked the session (for example she changed her password elsewhere).
**Ideal path**: 3. See the notice, type the password, Sign in.
**Alternate paths**: SSO if the server offers it.

### Steps
1. Maya opens the app or taps something that calls the server → The server answers 401; `endSession()` clears the stack, space and user, and `RootView` swaps to the sign-in page.
2. Read the grey line "Your session ended. Sign in again." → Page is Sign in with the email empty or kept as it was typed earlier in this launch.
3. Enter email and password, tap "Sign in" → Home. She lands at the Home root, not the screen she was on.

### Variations
- Coming to the foreground: `revalidate()` runs when the app becomes active and ends the session the same way if the server says it is invalid. It also shows the message "Your session is no longer valid." in red if the check fails with that error, next to the notice.
- A network failure during revalidation shows "Couldn’t reach the server. Try again." and keeps her signed in.

### Edge Cases
- Unsent messages stay on disk under her account scope and appear again after she signs in as the same user.
- The notice shows once per ended session; navigating to Sign up and back clears it.
- A 401 from a stale request after signing in again is ignored and does not sign her out.

## STORY-009: Sign out
**Type**: short
**Topic**: Sign-in and server
**Persona**: Dana Whitfield, handing her phone back to IT
**Goal**: End the session on this device.
**Preconditions**: Signed in; Home visible.
**Ideal path**: 3. Settings, Sign out, done (no confirmation).
**Alternate paths**: Settings, Account, "Sign out" (a second button on the Account screen; both call the same function).

### Steps
1. Tap the gear on Home → Settings sheet opens.
2. Scroll to the bottom and tap the red "Sign out" → Push registration is removed first, then the session is deleted on the server and in the Keychain.
3. The sheet disappears with the signed-in UI → Sign in page, with the saved server unchanged.

### Variations
- From Settings, Account, tap "Sign out" (not red) instead.

### Edge Cases
- No confirmation dialog: one tap signs out. Anything typed in a composer draft is in memory only and goes with the app state.
- Server cannot be reached while signing out: an error is shown, the local session is still cleared and the sign-in page appears.
- Maestro `sign-in.yaml` expects the Settings button after signing in; it taps the second "Sign in" because the title is also "Sign in".

## STORY-010: Cold start with a saved session
**Type**: short
**Topic**: Sign-in and server
**Persona**: Maya Okafor, opening the app after a day
**Goal**: Get straight to Home.
**Preconditions**: A session for the saved server is in the Keychain.
**Ideal path**: 1. Launch; Home appears with no sign-in.
**Alternate paths**: Notification tap (deep link) after launch, handled once startup finishes.

### Steps
1. Launch → `start()` restores the token, checks it with the server, then loads capabilities. During this the user sees the Sign in screen with a "Connecting…" spinner for a moment (there is no splash and no Home skeleton).
2. Check succeeds → `RootView` swaps to Home; unsent messages and a running meeting capture resume.

### Variations
- Offline launch: the check fails with "Couldn’t reach the server. Try again." The page stays on Sign in with "Retry connection"; the saved session is not deleted, so retrying later works.
- Saved session belongs to a different server than the saved address: it is discarded and the user signs in again.
- Keychain read fails: "Couldn’t update the local session." and the user must sign in.

### Edge Cases
- A signed-in user briefly sees the Sign in page and "Use a custom server" before Home appears; tapping it is possible and, if they save a new address in that moment, the sheet warns "Changing servers signs you out." only once the restore has finished.
- If the saved session is invalid, STORY-008's notice does not appear on cold start unless the server rejected a live session; the user just sees plain Sign in.

## STORY-011: Change server while signed in
**Type**: long
**Topic**: Sign-in and server
**Persona**: Tomas Berg, moving his team from a test server to the production server
**Goal**: Switch the app to `https://praci.example.test` and sign in there.
**Preconditions**: Signed in on the old server.
**Ideal path**: 6. Open a valid server link, review its named host and the sign-out warning, confirm the change, then sign in on the new server.
**Alternate paths**: Sign out and open the sheet from Sign in to enter the address manually; that signed-out path does not show the sign-out warning.

### Steps
1. Open a valid server link while signed in → A confirmation names its host and shows the existing sign-out warning.
2. Confirm the change → The app checks the new server and returns to Sign in with the old session cleared.
3. Sign in with the new account → Home of the new server.
4. Open the space title menu → The previous server's space choice is not applied; each server keeps its own saved space.

### Variations
- Sign out and enter the address manually from the server sheet; signed-out manual entry does not show the sign-out warning.

### Edge Cases
- The saved address survives relaunch (stored in app preferences), so the next cold start tries the new server.
- Deleting and reinstalling the app resets to the default server; the Keychain session may remain but is discarded because it belongs to a different server address.

## Design gaps and findings
- A signed-in user has no in-app Server row; an external server link can open the server sheet, where changing servers warns that it signs them out.
- Cold start shows the Sign in screen with "Connecting…" for a signed-in user. A splash or Home skeleton would avoid the flash and the exposed "Use a custom server" button.
- The check-your-email page uses the email field that is no longer visible; resend can fail after a relaunch.
- Sign out has no confirmation and the server button does not show the current host.
- The default server is a loopback address, which does not work on a real phone.
- Verification and reset links open in the browser; the app does not pick up completion on its own.
