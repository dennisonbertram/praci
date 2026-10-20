# Topic: model-sign-in-first-run

Source: `apps/web/src/pages/Onboarding.tsx`, `lib/use-openrouter-signin.ts`, `lib/use-model-oauth-signin.ts`, `lib/mcp-connect.ts`, `pages/McpOAuthCallback.tsx`, `App.tsx` routes, `pages/ModelSettingsOverlay.tsx`, `apps/api/src/router.ts` (`modelSetup`), `apps/web/e2e/onboarding-model-auto-skip.spec.ts`.

Notes that apply to every story:
- The onboarding page is `/onboarding`. After sign-up, a signed-in user is redirected there (`App.tsx`). The step shown is decided by `me.needsModel`: true goes to "Connect a model", false skips it. After the model step the next step is "Connect your apps" (only if integration setup is needed), then the first bot "Chief" is created automatically.
- The two sign-in buttons only render if the model catalog contains that provider (`openai-codex` for ChatGPT, `openrouter` for OpenRouter). On a deployment without them only "Use an API key instead" is visible. UNVERIFIED which catalogs ship which provider on a given install.
- The same OpenRouter popup flow and the same ChatGPT card appear in Settings > Models (`ModelSettingsOverlay.tsx`), with different button labels, as noted per story.

## STORY-APP-301: Maya connects ChatGPT in one pass during onboarding

**Type**: medium
**Topic**: model-sign-in-first-run
**Persona**: Maya, first-time founder of Northwind Robotics, has a paid ChatGPT subscription and no API keys, using the web app
**Goal**: Get from sign-up to a working first bot using her ChatGPT subscription.
**Preconditions**: New account (`maya@northwind.example.test`), deployment has no default model (`needsModel` true), catalog includes ChatGPT (`openai-codex`), pop-ups allowed.
**Ideal path**: 3 — click Sign in with ChatGPT, finish at the provider, click Continue.
**Alternate paths**: Paste-code route if the final page does not load (STORY-APP-303); API key route (STORY-APP-306); Settings > Models later (STORY-APP-308).

### Steps
1. Finish sign-up → app redirects to `/onboarding`; a skeleton shows, then the heading "Connect a model". Maya thinks: "I expected a long form. Two buttons is fine."
2. Read the two buttons: "Sign in with ChatGPT" (filled) and "Sign in with OpenRouter" (outline); below them a collapsed "Use an API key instead". → Maya picks ChatGPT because she already pays for it.
3. Click "Sign in with ChatGPT" → the button disables; the app picks the default ChatGPT model, opens a sign-in tab at the provider, and the page shows a card.
4. Read the card. Two forms exist depending on the provider's mode. For the paste mode: "Finish signing in at {hostname}. The final page may not load; paste its URL or code here." with a field labelled "Authorization code or callback URL", a "Submit" button, and "Waiting for sign-in — the link expires in about N minutes." For the device-code mode: "A sign-in tab opened at {host}. Enter this code there — this window keeps waiting:" with a large code and a "Copy" button. → Maya hesitates at "The final page may not load"; it is unclear whether a broken page means failure.
5. In the provider tab, approve access → in device-code mode the window detects completion by itself.
6. Back on the page, the card is replaced by a green line "Signed in with ChatGPT" (role status). → "Continue" becomes enabled (it needed `signedIn` to match the provider).
7. Click "Continue" → the app saves the default model, then moves on ("Connect your apps" if integrations need setup, else the bot step with a skeleton).
8. The first bot "Chief" is created, onboarding starts in the thread, and Maya lands at `/app/{botId}` with a greeting.

### Variations
- Desktop app: the desktop shell opens the system browser and captures the loopback callback automatically (`onDesktopOAuthCallback`), so Maya never sees the paste field submit manually. UNVERIFIED end to end here; code path in `use-model-oauth-signin.ts`.
- Maya clicks ChatGPT, then changes her mind and clicks "Cancel" → card disappears and the two buttons return (STORY-APP-304).

### Edge Cases
- Continue stays disabled while the sign-in is pending or the model id is empty.
- If the final "Connected, but could not refresh" error shows, the credential was already stored; reloading `/onboarding` goes straight past the model step because `needsModel` is now false.

## STORY-APP-302: Solo founder signs in with OpenRouter through the popup

**Type**: medium
**Topic**: model-sign-in-first-run
**Persona**: Solo technical founder at Northwind Robotics, has an OpenRouter account, uses a desktop browser with pop-ups allowed
**Goal**: Connect OpenRouter without copying an API key.
**Preconditions**: `needsModel` true, catalog contains `openrouter`.
**Ideal path**: 3 — click "Sign in with OpenRouter", approve in the popup, click Continue.
**Alternate paths**: API key via "Use an API key instead" > Provider (STORY-APP-306); Settings > Models "Sign in with OpenRouter" (STORY-APP-308).

### Steps
1. On "Connect a model", click "Sign in with OpenRouter" → provider switches to OpenRouter; the API asks for an authorization URL with redirect `{origin}/models/openrouter/callback`; the button disables while pending.
2. A popup opens at OpenRouter. → The page behind it shows no card; it only waits (no text explains this).
3. Approve access in the popup → OpenRouter redirects the popup to `/models/openrouter/callback` (also accepted as `/models/openrouter/callback/:state`).
4. The popup shows "Finishing sign-in…" with "You can close this tab if it does not redirect automatically.", then "Connected" with "You can close this window." and closes itself.
5. The opener receives a broadcast that the connection completed → the model catalog is reloaded and the line "Signed in with OpenRouter" appears. The key is stored by the API and never reaches the browser.
6. Click "Continue" → proceeds as in STORY-APP-301.

### Variations
- The user is not signed in when OpenRouter returns (session expired): the callback routes redirect to `/sign-in` (App.tsx) and the exchange does not run. UNVERIFIED what the user sees after signing in again; the code does not resume the callback.
- The popup stays open and nothing happens for two minutes: the wait times out (2 minutes, `MCP_OAUTH_TIMEOUT_MS`), the popup is closed and the buttons stay as they were.

### Edge Cases
- The same OAuth broadcast channel is shared with MCP connect; an MCP sign-in finishing in another tab at the same moment could look like an OpenRouter success. UNVERIFIED whether this occurs in practice.
- The default model chosen after sign-in is the deployment default if the catalog has it, otherwise the first for that provider (`pickCatalogModelId`).

## STORY-APP-303: ChatGPT final page does not load, Maya pastes the callback URL

**Type**: short
**Topic**: model-sign-in-first-run
**Persona**: Maya, first-time founder of Northwind Robotics, on a hosted or remote install
**Goal**: Finish a ChatGPT sign-in when the browser cannot reach the loopback callback.
**Preconditions**: STORY-APP-301 step 4 in the paste (`auth-url`) mode; the provider redirects to a `http://localhost:…/callback?code=…` address that fails to load.
**Ideal path**: 4 — copy the URL, paste into the field, Submit, Continue.
**Alternate paths**: Paste only the code instead of the whole URL (the field accepts "Authorization code or callback URL").

### Steps
1. In the provider tab, approve → the tab ends on an error page for `localhost`. Maya thinks: "It broke." She re-reads the card: "The final page may not load; paste its URL or code here."
2. Copy the address bar contents of that tab.
3. Return to Praci, paste into "Authorization code or callback URL" (placeholder `http://localhost:53692/callback?code=…`) → "Submit" enables once the field is not blank.
4. Click "Submit" → the field clears while the code is sent; on success the card is replaced by "Signed in with ChatGPT".
5. Click "Continue".

### Variations
- The submit fails because the code was mistyped: the field is refilled with what she pasted and an error shows "Could not finish sign-in" or the server's message; she can edit and retry because the attempt is still open.
- The code was accepted but the final exchange failed: the field is not refilled, the attempt is cancelled and Maya must click "Sign in with ChatGPT" again.

### Edge Cases
- Whitespace-only input keeps Submit disabled.
- Double-clicking Submit sends one request (submitting guard).

## STORY-APP-304: Maya cancels the ChatGPT attempt and switches to OpenRouter

**Type**: short
**Topic**: model-sign-in-first-run
**Persona**: Maya, first-time founder of Northwind Robotics, realises mid-flow that she wants a different provider
**Goal**: Back out of a started sign-in without leaving a half-connected state.
**Preconditions**: STORY-APP-301 step 3 reached; card visible.
**Ideal path**: 2 — Cancel, then click the other button.
**Alternate paths**: Change the Provider inside "Use an API key instead" (this also cancels the attempt).

### Steps
1. With the ChatGPT card showing, click "Cancel" → the card closes, the pending attempt is cancelled on the API, the two sign-in buttons return enabled.
2. Click "Sign in with OpenRouter" → provider changes to OpenRouter and the popup flow starts (STORY-APP-302).

### Variations
- Instead of Cancel, Maya opens "Use an API key instead" and changes "Provider" → the running ChatGPT attempt is cancelled automatically (`selectProvider` calls cancel) and the fields reset.
- Changing the "Model" select while an attempt runs also cancels it.

### Edge Cases
- Cancel while the provider tab is still open: the app tries to cancel the desktop browser session; in a normal browser tab the tab simply stays open and its result is ignored.
- Leaving `/onboarding` also cancels the attempt (unmount cleanup).

## STORY-APP-305: Pop-up blocked on first sign-in

**Type**: short
**Topic**: model-sign-in-first-run
**Persona**: Solo technical founder using a browser that blocks pop-ups by default
**Goal**: Still complete sign-in when the pop-up cannot open.
**Preconditions**: `needsModel` true; pop-up blocker active.
**Ideal path**: 3 — click the link in the card, approve, Continue.
**Alternate paths**: Allow pop-ups for the site and retry.

### Steps
1. Click "Sign in with ChatGPT" → nothing opens; the card shows a link instead: "Open {hostname} to finish signing in." (paste mode) or "Open {host} and enter this code:" with the code and "Copy" (device mode).
2. Click the link → it opens in a new tab (`target=_blank`); approve there.
3. Paste mode: copy the callback URL and Submit (STORY-APP-303). Device mode: click "Copy", paste the code in the provider page.
4. "Signed in with ChatGPT" appears; click "Continue".

### Variations
- OpenRouter with a blocked pop-up behaves differently: the app navigates the whole tab to OpenRouter (`window.location.assign`) and the card never appears. After approval the callback page, not being a popup, shows "Connected" then goes to `/app?mcp_oauth=connected`. Maya skips the "Continue" button and lands in the app. UNVERIFIED whether a no-model first bot still gets created before she reaches the chat; `/onboarding` would show again if `needsModel` is false and no bot exists.
- On failure in a full-tab callback, the page shows "OAuth connection failed", the reason, and a "Return to Praci" button (hidden in a popup).

### Edge Cases
- The code is in a monospace 22px block with a "Copy" button that switches to "Copied".
- The same text copy appears in Settings > Models (STORY-APP-308).

## STORY-APP-306: Founder opens "Use an API key instead" and connects Anthropic with a key

**Type**: medium
**Topic**: model-sign-in-first-run
**Persona**: Solo technical founder who already has a provider API key and does not want OAuth
**Goal**: Connect a model with a pasted key and test it before continuing.
**Preconditions**: `needsModel` true.
**Ideal path**: 5 — expand the section, pick Provider, paste key, optionally Test, Continue.
**Alternate paths**: The two sign-in buttons; Settings > Models "Connect API key".

### Steps
1. On "Connect a model", click the muted summary "Use an API key instead" → a collapsed `<details>` opens showing "Provider" (a select) and "Model".
2. Open "Provider" and choose a provider, for example Anthropic → Model list narrows to that provider; a "Thinking" select appears only if the chosen model has effort levels, with default "Default (Medium)".
3. In "API key" (label shows "Or paste an API key" for providers that also support sign-in), paste a key → placeholder is `sk-…`, the field is a password field.
4. Click the outline button below the field (label comes from `modelPreflightTestingLabel`; UNVERIFIED exact text, shown only when the model has a catalog probe) and it is enabled once the key has 8 or more characters → feedback appears under it with success or a classified failure.
5. Click "Continue" → the key is saved via the connect call, then the next step opens. Maya hesitates: the Continue button is outside the collapsed section and was visible the whole time but disabled.

### Variations
- A subscription provider selected in this section shows its own sign-in button (label from the catalog, `Starting…` while pending) plus "Test connection"-style button; this duplicates the two top buttons for ChatGPT.
- Cloudflare AI Gateway adds "Account ID" and "Gateway ID" fields that must be filled before Continue enables.
- OpenAI-compatible provider: "Server URL" (placeholder `http://127.0.0.1:8000/v1`), "Find models" (shows "Finding…"), "Model" select with "Other model…", and an optional "API key" collapsible. Continue enables when the URL and model are valid; invalid numbers show "Enter a whole number from 1 to …".

### Edge Cases
- A key under 8 characters keeps the test button disabled but not necessarily Continue (Continue needs only a non-empty key).
- Save failure shows "Could not save model" or the server message in red above Continue.

## STORY-APP-307: Deployment owner on a server that already has a default model skips the step

**Type**: short
**Topic**: model-sign-in-first-run
**Persona**: Deployment owner who set a model for the whole deployment before inviting Maya
**Goal**: Confirm nobody is asked to connect a model when the deployment already has one.
**Preconditions**: Deployment model configured, or the account already has a default credential; `needsModel` false.
**Ideal path**: 0 — no model step; the first bot is created straight away.
**Alternate paths**: none found.

### Steps
1. Maya signs up → `/onboarding` shows a skeleton, not "Connect a model".
2. The app goes to "Connect your apps" if integrations need setup, otherwise straight to creating the first bot "Chief" and opens its chat (`Message Chief` composer).
3. Maya never sees "Create your first bot", Name, Title or Description fields.

### Variations
- Scripted agent runtime (`agentRuntime === "scripted"`) also reports `needsModel` false.
- If `me` or the lists fail to load the page falls back to the bot step rather than the model step.

### Edge Cases
- This is covered by `onboarding-model-auto-skip.spec.ts`.
- Settings > Models then shows "Configured by deployment" (or "Deployment default") instead of "None yet" under "Active model".

## STORY-APP-308: Skipped onboarding, then add OpenRouter later from Settings > Models

**Type**: medium
**Topic**: model-sign-in-first-run
**Persona**: Maya, first-time founder of Northwind Robotics, comes back after trying to chat with no model
**Goal**: Fix "no model" from Settings and see the effect on the thread.
**Preconditions**: `needsModel` true (for example the account was created while the deployment had none, or the credential was disconnected). She is inside the app.
**Ideal path**: 4 — open Models, pick OpenRouter, click Sign in with OpenRouter, approve.
**Alternate paths**: Chat error action "Add a model" or the model-error link opens the same overlay on the failing provider; Cap table card "Add a model" button opens Models too.

### Steps
1. Maya types a message to a bot and sends → the API rejects it with "Connect a model to start a run." Maya thinks: "Where do I add one?" She follows the in-app prompt to Settings (copy such as "Add a model in Settings to use this." exists in translations; exact English surface UNVERIFIED).
2. Settings opens on **Models**. Header "Models"; "Active model" reads "None yet" with "Pick a provider below and connect it."
3. In the provider list (search box "Search providers", groups "Connected" and "All providers"), choose OpenRouter. If nothing matches, "No providers found." shows.
4. The detail pane has a "Sign in with OpenRouter" button (outline, small). Click it → same popup flow as STORY-APP-302; the button disables while pending.
5. Popup finishes → the overlay refreshes the catalog, credentials and `me`, then shows "Connected and using {model label}."
6. "Active model" now shows the model name and provider; the provider row shows "Connected" in green.
7. Close with the X ("Close model settings"), resend the message → it runs.

### Variations
- ChatGPT in Settings uses the label from the catalog (default "Sign in", and "Sign in again" when already connected) plus a "Cancel" link and a second button for testing the stored credential; success text "A subscription credential is stored securely."
- Replacing a key later: the label changes to "Replace API key" and the placeholder to "Paste a replacement key".
- "Disconnected {provider}." appears after disconnect.

### Edge Cases
- Same information appears on three surfaces: the onboarding step, Settings > Models, and the Cap table "Add a model" prompt ("The Carta agent needs a model before it can read your cap table.").
- Unlike onboarding, Settings does not need a Continue; the credential is used immediately.

## STORY-APP-309: Long journey, Maya from sign-up to a first answer with a subscription model, with one false start

**Type**: long
**Topic**: model-sign-in-first-run
**Persona**: Maya, first-time founder of Northwind Robotics, wants to prepare an investor update and has never configured an AI tool
**Goal**: Go from an empty account to a working agent reply, recovering from a blocked pop-up, a cancelled attempt and a later switch of provider.
**Preconditions**: Fresh deployment, no default model, catalog has ChatGPT and OpenRouter, pop-ups blocked at first.
**Ideal path**: 6 — sign-up, one sign-in, Continue, apps step, wait for Chief, send first message.
**Alternate paths**: Skip the apps step via its Skip button (UNVERIFIED label, see topic onboarding-connect-apps-and-tour); API key route.

### Steps
1. Open the sign-up page, create `maya@northwind.example.test` → redirected to `/onboarding`.
2. Read "Connect a model" and the two buttons. Maya thinks: "Which one is cheaper? I only have a ChatGPT login." There is no price copy on the buttons; the hint under providers in Settings is the only place with billing notes. She hesitates but picks ChatGPT.
3. Click "Sign in with ChatGPT" → the browser blocks the pop-up; the card says "Open {hostname} to finish signing in."
4. Click "Cancel", allow pop-ups for the site in the browser, click "Sign in with ChatGPT" again → this time a tab opens and the card reads "Finish signing in at {hostname}. The final page may not load; paste its URL or code here."
5. Approve in the tab; the final page fails to load. Paste the URL into "Authorization code or callback URL" and click "Submit" (STORY-APP-303).
6. "Signed in with ChatGPT" appears. Maya notices an "Use an API key instead" line below and ignores it.
7. Click "Continue" → "Connect your apps" appears (integrations need setup on this server). She skips or connects (see the related topic).
8. A skeleton shows while Chief is created. She lands in the chat with the greeting and focus question from the onboarding conversation.
9. She answers the focus question and sends a short request about the investor update → the run starts with the ChatGPT model. UNVERIFIED actual reply content.
10. Later she wants to try OpenRouter. She opens Settings > Models, selects OpenRouter, clicks "Sign in with OpenRouter" (STORY-APP-308), sees "Connected and using {model}."
11. She selects a model and clicks "Use this model" (or "Save") → the notice "Now using {model label}." appears and "Active model" updates.
12. She checks the ChatGPT row still shows "Connected" and sends another message to confirm the new model runs.

### Variations
- At step 3 she accepts the popup block and clicks the link directly (STORY-APP-305).
- At step 7 integrations do not need setup: the app jumps from the model step directly to creating Chief.

### Edge Cases
- Browser Back from the apps step: whether it returns to "Connect a model" is not determined by code read here (the step is local state, not a route). UNVERIFIED.
- Reloading `/onboarding` after step 6 but before Continue: `needsModel` is already false because the credential is stored, so the model step is skipped (see STORY-APP-307).
- The first-bot creation is idempotent (`spawnKey` `onboarding:first`, Web Lock), so a double-opened tab does not create two Chiefs.

## STORY-APP-310: OpenRouter authorization is denied or the callback is opened without a code

**Type**: short
**Topic**: model-sign-in-first-run
**Persona**: Solo technical founder who clicks "Deny" at the provider by mistake
**Goal**: See a clear failure and retry.
**Preconditions**: OpenRouter popup flow started.
**Ideal path**: 3 — read failure, close popup, click the button again.
**Alternate paths**: none found.

### Steps
1. In the OpenRouter popup, deny access → OpenRouter redirects to `/models/openrouter/callback` without `code` and `state`.
2. The popup shows "OAuth connection failed" with the provider's `error_description` or "OAuth authorization was cancelled." and "You can close this window." No "Return to Praci" button because it is a popup.
3. The popup's failure broadcast reaches the opener: the wait ends as cancelled, the popup closes, and the onboarding button re-enables. No error line shows on the onboarding page for a cancel. Maya thinks: "Did it work?" Nothing says it did not; the only signal is that "Signed in with OpenRouter" never appears.
4. Click "Sign in with OpenRouter" again to retry.

### Variations
- Exchange failure (valid `code`, API rejects it): popup shows "OAuth connection failed" with "Could not complete OAuth" or the server's text.
- Opening the callback URL directly in a normal tab with no params: same failure page, plus "Return to Praci" which goes to `/app`.

### Edge Cases
- A reload of the callback page with the same `state` is handled once only per page load (`handledState` guard); a second use of the same code would fail at the API.
- If `/app` loads with no model, Maya is back to the Settings path (STORY-APP-308).
