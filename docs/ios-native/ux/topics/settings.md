# UX stories: Settings, models, voice and integrations

Status: planned native SwiftUI iPhone app (epic #427), phase 9 (#421) and phase 11 (#423). No Swift code exists, so every step is planned or inferred. All people and figures are invented.

Sources: `docs/ios-native/ux/discovery.md`, `docs/ios-native/README.md`, `docs/ios-native/plan.md`, boards `PG-B-Settings`, `PG-B-Models`, `PG-B-Voice`, `PG-B-Integrations` and the rule cards in `PG-B-Rules.dc.html`, the Expo pages in `apps/mobile/app/(settings)/`, and `packages/contracts/src/rpc.ts` (`models.*`, `voice.*`, `connections.*`, `integrationSetup.*`, `aiConsent.*`, `account.*`).

Board facts used throughout: the Settings board shows the profile row ("Sam Rivera"), then "Account", "Models" (value "Model A"), "Voice" (value "Device"), "Integrations" (count "[N]"), "AI data sharing", "Archived bots", "Change password". Its only toolbar control is "Done" (xmark). Settings and Models have no prominent action; Voice's is "Hear a sample"; Integrations' is "Continue" (in setup only).

---

## STORY-001: Open Settings and read the current state
**Type**: short
**Topic**: Settings, models, voice and integrations
**Persona**: Priya Nair, solo founder using a standard iPhone
**Goal**: Find out which model and voice her agents currently use.
**Preconditions**: Signed in, one space, a hosted model connected, voice on the device voice.
**Device**: standard iPhone
**Ideal path**: 3 — tap the profile in the sidebar, read the values on the list, tap "Done".
**Alternate paths**: Opening the Account row instead of the profile row (the board draws both "Sam Rivera" profile row and an "Account" row; see Design gaps). Deep link from the Legal page "Add your OpenRouter key", which opens Models directly (not Settings root).
**Design source**: PG-B-Settings, rule card "Settings" (steps 1-3). The sidebar profile entry point is described in the rule card text only; the Home board does not draw it as a labeled control.

### Steps
1. Tap the profile at the bottom of the sidebar → Settings opens as a sheet with large title "Settings", the profile row "Sam Rivera", then "Account", "Models", "Voice", "Integrations", "AI data sharing", "Archived bots", "Change password".
2. Read the row values → Models shows the default model name ("Model A"), Voice shows "Device", Integrations shows a connected count. Rows show no value until it loads, then the value appears without moving the row.
3. Tap "Done" → the sheet closes and Home is visible again.

### Variations
- Inner display (890x626 pt): the settings list sits in the 1/3 column with the selected row filled, the detail fills the 2/3 column. Half-folded: list left, detail right, each scrolls alone. Outer display: "Done" is in the left strip group.
- Laptop pose: not applicable, stays one full-height column.

### Edge Cases
- Values slow to load: rows render with no value first (rule card says so).
- Older self-hosted server returns 404 on a newer procedure: the value stays empty. No board shows how the row should look.
- Signed-out session ends while the sheet is open (401): the app returns to Sign in; the sheet is dismissed.

### Design gaps
- Entry point: "sidebar profile" is the only entry in the rule card, but the outer Home board (strip with Activity, Search, Artifacts) does not draw a profile control. The standard-iPhone entry is not drawn either.
- The Settings board has both a profile row and an "Account" row. The rule card says sign-out and delete account "live on the profile detail (Account)". It is unclear whether the two rows open the same page.
- Expo `account.tsx` also holds Language, Appearance, Avatar style, Hide amounts, Notifications, Phone notifications, Usage and Live update settings. None of these are on the Settings board or the Account description. Hide amounts is explicitly a device-only setting in the plan; its home in the native app is undefined.
- The "Integrations" count value "[N]" is a placeholder; what N counts (connected apps, accounts) is not stated.

---

## STORY-002: Change the default model and thinking level
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Persona**: Marcus Webb, founder of a three-person dev-tools startup
**Goal**: Switch all agents to a cheaper model and lower the thinking level.
**Preconditions**: A hosted provider is already connected ("Hosted provider" shows "Connected"); default model "Model A", thinking "Default (Medium)".
**Device**: standard iPhone
**Ideal path**: 6 — Settings, Models, tap Model, pick model, tap Thinking, pick level.
**Alternate paths**: Per-bot model and thinking level in bot settings (#415, `PG-B-BotSettings`) overrides the default for one bot. Entry from a thread's "Connect a model to start a run" message (no board).
**Design source**: PG-B-Settings (list), PG-B-Models rule card "Models" (Default model section: "Model", "Thinking"; picker as a menu per the Components line "Overlays (pickers as menus)").

### Steps
1. Open Settings and tap "Models" → Models pushes inside the sheet with sections "Default model", "Providers", "Add a server".
2. Tap the "Model" row under "Default model" → a menu lists models of connected providers with a check on "Model A".
3. Choose a different model ("Model B") → green line "Now using Model B." appears under the section (Expo text: "Model updated." / "Now using {label}."); the row value changes.
4. Tap the "Thinking" row, currently "Default (Medium)" → a menu lists levels valid for the chosen model (Expo: Minimal, Low, Medium, High, Extra high, Max, filtered per model).
5. Choose "Low" → the row shows "Low"; no save button is needed, each change is saved at once.
6. Tap Back (chevron.left) → Settings list shows the new Models value "Model B".

### Variations
- Choose a model that has no thinking support: the "Thinking" row is hidden or disabled (Expo clamps the level to the model's allowed levels). No board shows this.
- Inner display: Models renders in the 2/3 column while the list stays in the 1/3 column; the back button is not needed.

### Edge Cases
- Save fails (offline or server error): Expo shows "Could not change the default model". The red line exists in the error pattern but the Models board draws only the success and unreachable lines.
- Space switched while the page is open: Expo shows "Space changed. Reload Models before saving backups." for backups; the native equivalent for the default model is undefined.
- Deployment-fixed default: Expo labels "Deployment default" and "Configured by deployment"; no board shows a read-only default row.

### Design gaps
- Backup models ("Backup models", reorder, "Save backups", max 10) exist in Expo and the API (`models.backups`, `models.setBackups`) but not on the board. This is a whole feature without a native design.
- Embedding model and "auto file email" (`models.embeddingModel`, `models.setAutoFileEmail`) are in the API and not in either client list.
- The "Thinking" disabled/hidden state for non-reasoning models is not drawn.

---

## STORY-003: Connect a hosted model provider with an API key (first run)
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Persona**: Hana Ito, new founder who just signed in and has no model connected
**Goal**: Make her first agent run work by connecting a provider.
**Preconditions**: New account, `me.needsModel` is true, no provider connected.
**Device**: standard iPhone
**Ideal path**: 8 — Settings, Models, tap provider, enter key, Connect, check default.
**Alternate paths**: Subscription sign-in ("Subscription sign-in", Safari round trip with a code); OpenRouter OAuth (`models.beginOpenRouterOAuth`); a thread's blocker message "Connect a model to start a run" taking her straight to Models (no board); Legal page "Add your OpenRouter key" taking her to Models.
**Design source**: PG-B-Models rule card (Providers list rows "Hosted provider" Connected, "Local server", "Subscription sign-in" Not connected). The key-entry form: NO BOARD.

### Steps
1. Tap "Models" in Settings → Providers shows "Hosted provider", "Local server", "Subscription sign-in", each with a status ("Connected" or "Not connected"). Default model section has nothing to pick.
2. Tap "Hosted provider" → a provider detail with an "API key" field and a connect button appears (NO BOARD; Expo labels: "API key", "Connect API key", placeholder "sk-…").
3. Paste the key → the key is shown masked with a show/hide control.
4. Tap "Connect API key" → spinner, then "Connected and using Model A." (Expo text "Connected and using {label}.") and the row status becomes "Connected".
5. Go back to Models → "Model" row now shows "Model A" and "Thinking" shows "Default (Medium)".
6. Tap "Done" → Home loads; the thread blocker no longer appears.

### Variations
- Wrong key: Expo "Could not connect this provider" in red under the form; the field keeps the value.
- Provider can use the server's own credentials: Expo text "Uses this server's own {source} credentials to access {provider}." and an optional "Use your own key" action.

### Edge Cases
- App backgrounded while pasting from a password manager: the field must keep text (not stated).
- Key must never be logged or stored on the device beyond the request; the API stores it server side (`models.connect`).
- Disconnecting later: Expo alert "Disconnect {name}?" with "This removes the connection from every space." and actions Cancel/Disconnect. No board.

### Design gaps
- NO BOARD for the provider detail (API key form, show/hide, "Use your own key", "Replace API key", "Disconnect").
- NO BOARD for the subscription sign-in page ("Finish signing in in your browser:", code copy, "Paste its URL or code here", "Waiting for sign-in — the code expires in about {minutes} minutes.").
- The board shows three provider rows only; Expo has a featured list, "Show more" and "All providers" (many providers). The native provider list for more than three providers is undefined.
- The first-run route from `needsModel` to this page is not drawn (see also the sign-in topic).

---

## STORY-004: Add a local model server and find its models
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Persona**: Tomas Lindgren, privacy-minded founder running a model on his Mac mini
**Goal**: Point Praci at `http://192.0.2.10:8000/v1` and use one of its models as the default.
**Preconditions**: Signed in; his server is on the same network (or Tailscale) and allowed by the app's network rules; no local server saved.
**Device**: standard iPhone
**Ideal path**: 7 — Models, Add a server, type URL, Find models, pick model, confirm.
**Alternate paths**: Edit the existing "Local server" row (shows its URL, "http://127.0.0.1:8000/v1" on the board). Type the model name manually after "Server found. Enter a model name." when the server does not list models.
**Design source**: PG-B-Models rule card ("Add a server", "Find models" row with spinner, "Found 3 models.", "No matching models", red unreachable line, green "Now using Model A"). Fields beyond URL: NO BOARD.

### Steps
1. In Models tap "Add a server" → fields appear for the server URL (Expo label "OpenAI-compatible server URL", placeholder `http://127.0.0.1:8000/v1`) and a "Find models" row.
2. Type the URL → the row "Find models" becomes enabled.
3. Tap "Find models" → the row shows a spinner ("Finding…").
4. Result arrives → "Found 3 models." with a picker listing the models ("Use a found model").
5. Pick a model → it is selected as the connection's model.
6. Tap the save control → "Connected and using Model C." and "Local server" shows the URL under it.
7. Check "Default model" → "Model" row shows the local model.

### Variations
- Server listing returns no usable model: "Server found. Enter a model name." with a text field (Expo placeholder "exact-model-id", "Other model…").
- Advanced settings in Expo: "Supports thinking", "Supports images", "Context limit", "Maximum output tokens", "Maximum images per request", "Save limits". The board shows none of these.
- Search within a long result list: Expo shows "Search models" for more than 10 results; the board shows "No matching models" only.

### Edge Cases
- Server unreachable: red line "Could not reach this model server", the typed URL stays.
- Wrong scheme such as plain `http` to a public host: the app's scheme rule (https, or http only for loopback, `.local`, private and Tailscale) should refuse it; the message is undefined.
- On a real iPhone, `127.0.0.1` points at the phone itself, not his Mac. The board's example URL would fail on device unless the server runs elsewhere. The server also needs iOS local network permission (a system prompt); neither is designed.
- Does the phone or the Praci server call the model server? The Expo flow calls the Praci server (`models.probeOpenAiCompatible`), so a LAN address might be unreachable from a hosted Praci server. No explanation is drawn.

### Design gaps
- NO BOARD for the advanced limits fields, the model picker for found models, or the manual model name state.
- "Add a server" vs. the existing row "Local server" with a URL: when one is saved, whether "Add a server" is still shown and how a second server is added is not drawn.
- Local network permission prompt and the loopback caveat are undocumented.

---

## STORY-005: Turn on the device voice and play a sample
**Type**: short
**Topic**: Settings, models, voice and integrations
**Persona**: Aisha Karim, founder who dictates replies while walking
**Goal**: Make agents read replies aloud using the free on-device voice.
**Preconditions**: No voice provider connected.
**Device**: standard iPhone
**Ideal path**: 4 — Settings, Voice, switch on "Use this device voice", tap "Hear a sample".
**Alternate paths**: Per-bot "device voice" flag in bot settings (#415, `PG-B-BotSettings`; a "voice flag"). In a thread, the voice player reads one message (DS-06). Calls (DS-07 "Calls", NO BOARD for a call screen).
**Design source**: PG-B-Voice rule card (sections "This device", "Voice provider", "Sounds"; prominent "Hear a sample" play button).

### Steps
1. Tap "Voice" in Settings → Voice page with the sections "This device", "Voice provider", "Sounds"; the toolbar shows the prominent "Hear a sample" (play) button.
2. Switch on "Use this device voice" → the row reads "On · Free, works offline" and the helper "Your phone's built-in voice. Free, no account needed" appears (Expo text).
3. Tap "Hear a sample" → the phone speaks "Hi, this is how I'll sound when I read replies out loud."
4. Tap Back → Settings shows Voice value "Device".

### Variations
- Standard iPhone: the prominent button is in the trailing group of the top bar. Outer display: it is the last, prominent button in the strip and collapses last. Inner: the page sits in the 2/3 column.
- Silent switch on: playback should still be heard or the user should be told (not specified).

### Edge Cases
- Playback fails: red line "Could not play a sample".
- Switch change fails: Expo shows "Could not save that preference".
- Voice needs AI data consent for `voice` (see STORY-008) before a provider voice is used; the device voice needs none.

### Design gaps
- Dictation (the 1.2 s silence endpointer) needs microphone and speech-recognition permission prompts. No board shows the permission request or the denied state.
- The "Sounds" section ("Call sounds", "Waiting sound") is drawn without describing its control types or the sound choices.
- The device voice choice (which iOS voice) is not offered; Expo does not offer it either. Not found to be required.

---

## STORY-006: Connect a hosted voice provider and pick a speech model
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Persona**: Leo Fontaine, founder who wants better voices for investor-update calls
**Goal**: Replace the device voice with a hosted voice and choose a speech model.
**Preconditions**: A voice provider catalog is available; no voice credential saved; AI data consent for voice not yet given.
**Device**: standard iPhone
**Ideal path**: 7 — Voice, key field, Connect, speech model, voice, sample, back.
**Alternate paths**: Skip the speech model (it is "Optional"). Disconnect the provider later with "Disconnect".
**Design source**: PG-B-Voice rule card. Not-connected state: "provider group shows only the key field and Connect" (described, field itself not on the drawn board). Voice picker: NO BOARD.

### Steps
1. Open Settings > Voice → "Voice provider" group shows the hosted provider with only a key field and "Connect" (not connected state).
2. Paste the key in "Paste your API key" and tap "Connect" → spinner, then the group shows "Hosted voice", "Connected · Speak + transcribe".
3. Tap "Speech model" (value "Optional") → a picker of models; choose one → value updates (Expo error "Could not save that speech model").
4. Choose a voice for replies (Expo has a voice list from `voice.voices`) → saved at once.
5. Tap "Hear a sample" → the chosen voice speaks. If AI data consent for voice is missing, the call fails with "Review AI data sharing in Account settings before continuing." (see STORY-008).
6. Switch "Use this device voice" off → replies use the hosted voice.

### Variations
- Replace key: Expo shows "Replace key" and "Paste a replacement key".
- Disconnect: "Disconnect" with "Disconnecting…" then the group returns to the key field only.
- Providers that only speak ("Speak only") vs. speak and transcribe ("Speak + transcribe"): the second also handles dictation fallback upload.

### Edge Cases
- Wrong key: Expo "Could not connect".
- Pressing "Hear a sample" with nothing connected and the device voice off: Expo says "Connect a voice provider first." (not on the board).
- Load failure: Expo "Could not load voice settings".

### Design gaps
- NO BOARD for the voice picker, the voice-list state, or the speech model picker contents.
- The consent check before the first hosted voice use is not designed (the sample button simply errors on older servers). The client should check `aiDataUsesForProcedure` first (discovery notes).
- Where a bot's own "device voice" flag (bot settings) interacts with this global switch is not stated.

---

## STORY-007: Connect Calendar from the integrations catalog (Safari round trip)
**Type**: long
**Topic**: Settings, models, voice and integrations
**Persona**: Dana Okafor, founder who wants her Inbox agent to see her meetings
**Goal**: Add the Calendar connector so agents can read her schedule.
**Preconditions**: Signed in; the Mail connector is already "Added"; Calendar is under "Available"; the server has Composio or Direct MCP credentials configured.
**Device**: standard iPhone
**Ideal path**: 9 — Settings, Integrations, search or scroll, tap "Add", finish in Safari, return, confirm the row moves to Connected.
**Alternate paths**: Search apps to find Calendar; "Show more" to see the rest of the catalog; Add from the agent side: a chat card "app_connect" is flipped to connected after authorization (`mcp.oauth` and card flow, DS-06 partly); MCP OAuth is web only so MCP servers are not offered. Connect from the Calendar-aware agent page (NO BOARD).
**Design source**: PG-B-Integrations rule card "Integrations" (rows "Connected" and "Available", letter tiles "M", "C", "D", "B", "T", "Show more", "Advanced"; "Connect pending: alert to finish in browser, then refresh").

### Steps
1. Settings > "Integrations" → catalog shows search, "Connected" (Mail connector "Added", Calendar connector "Added" are drawn as the connected state; for this story assume Calendar is not yet added), "Available" (Documents connector, Banking connector, Tickets connector each with "Add"), "Show more", "Advanced".
2. Tap into the search field and type "calendar" → the list filters. If nothing matches the page shows "No apps match your search."
3. Tap "Add" next to "Calendar connector" → the row shows a working indicator ("Working…").
4. Safari opens at the provider's authorization page → the user signs in and approves access.
5. Return to Praci (by the app switcher or the redirect) → the app polls `connections.complete` every 2 s while Safari is open.
6. Poll sees "connected" → the Calendar row moves to "Connected" with "Added", the tool count appears (Expo "{count} tools"), and a notice is posted to the agent chat that the app was connected.
7. Tap the Calendar row → detail with accounts and tools (inner board: "app detail (accounts, tools) replaces catalog on tap").
8. Optionally tap "Add another Calendar connector" to connect a second account (Expo "Add another {name}") → the same Safari loop; the row name becomes "Calendar 2".
9. Tap Back → the Settings list shows the Integrations count increased by one.

### Variations
- Standard iPhone: Back is in the top bar. Inner display: the catalog is in the 2/3 column and the app detail replaces it. Half-folded: catalog left, selected app right.
- The user never completes Safari: after about 90 s of polling (45 tries) Expo shows an alert "Connection pending" with "Finish connecting in the browser, then refresh this page." The user can pull to refresh.
- Reconnect an expired account: Expo shows "Reconnect" (API: `connections.begin` with `reconnect`).
- Rename or remove an account: Expo has "Could not rename connection" and "Remove {name}" / "Could not revoke connection". No board for rename or remove.

### Edge Cases
- Catalog load failure: message with "Retry" (rule card).
- The Safari sign-in fails or is cancelled: the poll never succeeds; the pending alert is the only feedback. Whether the app returns via a universal link or the user switches back by hand is not specified.
- Revoking an account used by agents: `connections.effectiveAccess` shows which agents lose access; no confirmation is drawn.
- Writes are off by default for connected apps (`connections.setWrites`); no setting for it exists on the board.
- Older self-hosted server without `connections.*`: 404 means "not supported"; no board.

### Design gaps
- NO BOARD for the app detail page (accounts, tools, access per agent, writes toggle, remove). The inner rule card describes it in words only.
- NO BOARD for the "Connection pending" alert's wording or the in-row pending state; the polling stops after the app leaves the page (Expo aborts on blur), which the native app must decide.
- "Show more" and search: the board does not show the search field or the expanded list.
- Safari round trip: return path (callback scheme) is not described for connections; only sign in uses `rakazo://sign-in`.
- The same information (connected apps) appears on the Settings list value, the Integrations page, and in agent chats (app_connect card, DS-06). The rendering of the app_connect card is not defined.

---

## STORY-008: Review and withdraw AI data sharing, then recover a blocked run
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Persona**: Rosa Delgado, careful founder with customer data in her data room
**Goal**: See which AI services receive data, withdraw one, and understand a blocked action.
**Preconditions**: Some permissions granted earlier; the data room agent is in use.
**Device**: standard iPhone
**Ideal path**: 5 — Settings, AI data sharing, switch off one service, confirm, Back.
**Alternate paths**: Accept the prompt shown when an action needs consent (NO BOARD, #417); Data room and Legal pages call `consent` and `consentGrant` themselves (their own consent state in #424); "Withdraw all permissions" for a single reset.
**Design source**: Only the Settings row "AI data sharing" (PG-B-Settings). The page and the in-flow prompt: NO BOARD.

### Steps
1. Tap "AI data sharing" in Settings → page lists services that receive data (Expo groups: "AI models", "Memory", "Voice", and recipients such as "Praci"), each with an "Allow {name} on mobile" switch, plus "Privacy policies" and "Withdraw all permissions".
2. Switch off "Allow Voice on mobile" → the switch turns off at once (`aiConsent.revoke`).
3. Open Voice and tap "Hear a sample" (hosted voice) → fails with "Review AI data sharing in Account settings before continuing."
4. Return to AI data sharing and switch it back on → allowed (`aiConsent.allow`).
5. Tap "Withdraw all permissions" → alert "Withdraw all permissions?" with Cancel and "Withdraw"; Cancel leaves everything as is.

### Variations
- Native prompt before an AI data use (the discovery notes list this as required in phase 5): a card or sheet offering Allow or Not now, with the same recipient names. Not designed.
- Space-scoped vs. account-scoped consent is not stated.

### Edge Cases
- Load failure: Expo "Could not load permissions." with "Retry". Empty: "No AI services configured."
- Consent change in flight when the sheet is dismissed: unspecified.

### Design gaps
- NO BOARD for the AI data sharing page and for the consent prompt in the thread/composer; only a row exists.
- Error text uses "Account settings" while the row is under Settings > "AI data sharing"; the label mismatch (and the Account page not listing it in the board) may send a user to the wrong page.
- Expo `account.tsx` also carries an "AI data sharing" row, so the page is reachable from two places in Expo; the board shows only the root row.

---

## STORY-009: Change a password and restore an archived bot
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Persona**: Ben Achterberg, operator who archived a bot and now needs it back
**Goal**: Rotate his password, then bring back the archived "Ledger" bot.
**Preconditions**: Password sign-in account (not SSO only); one archived bot.
**Device**: standard iPhone
**Ideal path**: 10 — Change password (5 steps), then Archived bots (4 steps) and Back.
**Alternate paths**: Forgot password from Sign in (mail link) instead of changing it; SSO users use "Link SSO" (Expo account only); restore from bot settings (#415) while the bot is archived (NO BOARD for the archive state); restore from Home sections (archived bots do not appear there).
**Design source**: Rows only in PG-B-Settings ("Archived bots", "Change password"). Pages: NO BOARD.

### Steps
1. Tap "Change password" → form with "Current password", "New password", "Confirm password" (Expo labels), Save disabled until all are filled.
2. Fill the fields and mistype confirmation → inline "Passwords do not match".
3. Fix it and tap save → saved; the user stays signed in (other sessions are not described).
4. Return to Settings, tap "Archived bots" → list of archived bots (Expo loads `bots/listArchived`); empty state "No archived bots".
5. Tap "Ledger" → the bot detail opens (Expo opens the thread after `threads/get`); the restore action is offered.
6. Restore it → the bot returns to Personnel on Home.

### Variations
- Wrong current password: Expo "Could not change password" under the form.
- Restore fails: "Could not restore bot" with "Try again."; load fails: "Could not load bots".

### Edge Cases
- SSO-only account has no password: whether the row is hidden or disabled is not drawn.
- Restoring a bot while offline: not specified.
- Archived bot belongs to another space: not specified.

### Design gaps
- NO BOARD for Change password, Archived bots list, its empty state, or the restore confirmation.
- Password rules (Expo requires 8 characters at sign up) are not given for the change form.
- Where restore happens (list row action, swipe, or bot detail) is undefined.

---

## STORY-010: Sign out and delete the account
**Type**: long
**Topic**: Settings, models, voice and integrations
**Persona**: Carl Mbeki, founder shutting down his startup
**Goal**: Request his data export, then permanently delete his Praci account.
**Preconditions**: Signed in, owns a space with data; SSO is not linked (password account).
**Device**: standard iPhone
**Ideal path**: 12 — Account, check export, "Delete account", confirm with password, land on Sign in.
**Alternate paths**: "Sign out" only (steps 1-3 then 12); delete via emailed code ("Send deletion code", "Deletion code") or fresh SSO for SSO accounts; export through web Settings.
**Design source**: PG-B-Settings rule card: "Sign-out and delete account live on the profile detail (Account)". The Account page itself: NO BOARD.

### Steps
1. In Settings tap the profile row "Sam Rivera" (or "Account") → Account detail opens (NO BOARD).
2. Scroll to the bottom → rows "Sign out" and "Delete account" (Expo).
3. For a normal sign-out tap "Sign out" → token cleared from the Keychain, caches wiped, Sign in shown. (Stop here for the short path.)
4. For deletion tap "Delete account" → alert "Delete your account?" with Cancel and "Delete" (Expo).
5. Choose "Delete" → a field asks for the "Current password" (or "Send deletion code" for accounts without one).
6. Enter the password → confirm.
7. App shows a spinner while the server deletes the account.
8. Success → the app wipes local data and returns to Sign in.
9. Failure case: "Could not delete account" stays on the page, nothing is deleted.
10. Retry with the right password → success as step 8.
11. Sign in with the old email → fails (account gone).
12. Server field and token are cleared; the next launch starts at Sign in.

### Variations
- SSO account: "Send deletion code" emails a code; user enters "Deletion code". Fresh SSO is the third method (discovery notes).
- Sign out failure: Expo "Could not sign out" with the cause; "Sign in again" when the session expired.
- Inner display: the Account detail sits in the 2/3 column.

### Edge Cases
- Network drops after the delete request is sent: the user does not know if the account exists; no retry copy is defined.
- Deleting while owning a shared space or a paid seat: billing/ownership rules are not shown anywhere.
- Push token and Live Activities should be unregistered (`account.unregisterPush`) before sign out; not stated for the native client.

### Design gaps
- NO BOARD for Account (profile name, email, sign-out, delete flow, "Link SSO", notification toggles, appearance, language, usage). This is the largest missing screen of the topic.
- The destructive-action confirmation uses an alert in Expo; the native pattern (alert vs. sheet vs. typed confirmation) is not decided.
- Account export (`account.exportRequest`, `exportLatest`) is in the API but not mentioned in the board, Expo, or the brief's screen list.

---

## STORY-011: Set up server credentials for an integration provider (Advanced)
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Persona**: Ines Moreau, founder who runs her own Praci server
**Goal**: Give her server Composio credentials so the catalog can connect apps.
**Preconditions**: Self-hosted server with no provider credentials; Ines is the server owner.
**Device**: standard iPhone
**Ideal path**: 8 — Integrations, Advanced, choose method, credentials, Continue, back to catalog.
**Alternate paths**: Skip (xmark) to leave setup; the web app for Direct MCP OAuth (Expo "Finish MCP authorization in the web app." and "Open web app"); Executor setup is web only ("Set up Executor on your server in the web app.").
**Design source**: PG-B-Integrations rule card (setup: "Skip (xmark), Continue prominent", segmented method, "Get credentials", error "Could not verify or save these credentials").

### Steps
1. In Integrations scroll to the bottom and tap "Advanced" → a sheet "Server integrations" opens with a "Method" segmented control "Composio | Direct MCP".
2. Select "Composio" → a Credentials section appears with a key field and "Get credentials" (opens the provider site in Safari).
3. Tap "Get credentials" → Safari opens the provider's key page; user copies the key and returns.
4. Paste the key into the field.
5. Tap "Continue" (prominent) → spinner, the server verifies and saves (`integrationSetup.save`).
6. Success → sheet closes and the catalog loads with the apps.
7. Tap "Skip" next time to leave without saving.

### Variations
- Choose "Direct MCP": fields "Client ID", "Client secret", "Project ID" (Expo) and a note that authorization finishes in the web app.
- A non-owner member: Expo "Ask the server owner to configure this provider."

### Edge Cases
- Bad credentials: inline red "Could not verify or save these credentials"; the fields keep their values; "Continue" stays enabled.
- Secret values must never appear in logs or screenshots; the fields should be secure.
- Catalog failure afterwards: "Could not load integrations" with Retry.

### Design gaps
- The role check (owner vs. member) and its read-only state are not on the board.
- Direct MCP fields beyond the drawn "Credentials" section are not shown; the board draws one generic credentials field.
- It is not stated whether the setup sheet appears automatically the first time on a server with no provider, or only via "Advanced".
- Medium sheet vs. the rule card's "Advanced pushes setup as a sheet": the detent is not specified.
