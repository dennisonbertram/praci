# Topic: Add a remote MCP server with OAuth

Stories STORY-017 to STORY-024. Code references are in `apps/web/src/` unless noted.
Steps that need a real third-party sign-in (Mercury or Brex login and consent screen)
are marked **[REAL SIGN-IN]**. Whether a given vendor server actually requests OAuth is
decided by the server at connect time; the stories mark where the code branches on that.

Key code facts used throughout:
- Entry A: Integrations overlay, button "Browse MCP servers" opens inline `IntegrationSetup`
  (heading "Add MCP server"). Entry B: Advanced, "Add MCP server" (opens card "Add remote MCP
  server", calls `capabilities.install`, NOT `mcp.servers.create`, and has no OAuth step).
  Entry C: Advanced, "Manage MCP servers" opens `McpServersOverlay` ("MCP servers", card
  "Add server").
- Only Entry A and the "Connect OAuth" button in Entry C run `connectMcpOauth`.
- Entry A assigns only the active bot (`botId={activeBotId}`) after sign-in. Entry C assigns
  the "Agents:" chips selected before "Add server", and chips can be toggled afterward.
- Popup is `window.open` with name `rakazo-mcp-oauth`, 560x720. Timeout is 2 minutes and
  returns "cancelled" with no message. Blocked popup navigates the whole tab.

---

## STORY-017: Connect Mercury from "Browse MCP servers" by pasting the URL
**Old ID**: STORY-300
**Type**: medium
**Topic**: Add a remote MCP server with OAuth
**Persona**: Priya, founder of a 6-person startup, wants her agent to answer "what is my runway?" from Mercury. She has the Mercury MCP URL from Mercury's docs and is a Mercury admin.
**Goal**: Mercury (https://mcp.mercury.com/mcp) is connected via OAuth and her active agent can use its tools.
**Preconditions**: Signed in to the web app (http://127.0.0.1:5273 or hosted). At least one active agent exists and is selected. Browser allows popups for the site. No Mercury server added yet.
**Ideal path**: 5 — click "Integrations", click "Browse MCP servers", expand "Add server URL", paste URL, click "Connect" (then sign in to Mercury in the popup, which is outside the count).
**Alternate paths**: (1) Advanced → "Manage MCP servers" → "Add server" then "Connect OAuth" (STORY-019). (2) "Search integrations.sh" then "Connect" on a Mercury result, if the public catalog lists it (STORY-018). (3) Advanced → "Add MCP server" does not do OAuth (STORY-021).
### Steps
1. Click "Integrations" at the bottom of the sidebar. Thought: "I don't know if Mercury will be in here as an app." → The "Integrations" overlay opens with "Search apps", featured grid (Gmail, Google Calendar, Google Drive, Slack, Notion) and catalog.
2. Type "mercury" in "Search apps". → The catalog filters. If Mercury is not a catalog app, nothing connects it. Thought: "No Mercury tile. Is there another way?" (Search here only filters the app catalog; it does not search MCP servers.)
3. Click "Browse MCP servers". Thought: "MCP server? The docs for Mercury said MCP, so maybe this." → Inline panel with heading "Add MCP server", a "Search apps" box, a "Search integrations.sh" button, and a collapsed "Add server URL".
4. Click "Add server URL". → Disclosure opens with a "Server URL" field (placeholder "https://example.com/mcp") and a "Connect" button, disabled while empty.
5. Paste `https://mcp.mercury.com/mcp`, click "Connect". Thought: "It did not ask me for a name or which agent. Fine." → All buttons disable while busy. The code looks up an existing server with the same endpoint; none exists, so it creates one named by `deriveMcpName` (host `mcp.mercury.com` becomes "Mercury"), slug `integration-<8 chars>`, transport streamable_http. Then `mcp.oauth.begin` runs (up to 15 s of server-side probing). No progress text appears (the "Connect" button on this URL form keeps its label).
6. A popup (560x720) opens to Mercury's authorization page. **[REAL SIGN-IN]** Sign in to Mercury and approve access. Thought: "Is this the real Mercury domain? I can't see an address bar in a small popup." → Mercury redirects to `/mcp/oauth/callback?code=…&state=…`.
7. Watch the popup. → It shows "Finishing MCP connection…" then "Connected" and closes itself (`window.close()`). The main tab receives the broadcast.
8. Return to the main tab. → The code calls `mcp.assignments.approve` for the active agent, the inline panel closes, and the overlay refreshes. A new row "Mercury" with subtitle `mcp.mercury.com` appears at the top. There is no success message; the new row is the only confirmation.
9. Open the "…" menu on the Mercury row. → Items: "Reconnect", "Rename", "Remove". Thought: "Which agents can use it? It doesn't say." → The row does not show agent access.
### Variations
- Priya instead types a different name later using "Rename" because "Mercury" is fine but she wants "Mercury (ops)".
- She is on the desktop (Electron) app: the same web UI hosts this; the popup behavior is the same code path. Whether the Electron window handles `window.open` the same way is not confirmed by the code read.
- She uses a second agent as the active one at the time: only that one gets access (see STORY-023).
### Edge Cases
- The server takes more than 15 s to answer: `mcp.oauth.begin` errors; the panel shows an error line from `errorText(err, "Could not connect")`.
- The Mercury server returns authorization in a way the app does not recognize: see STORY-022.
- She clicks "Connect" twice quickly: buttons are disabled while busy, so one attempt.

---

## STORY-018: Find Brex with "Search integrations.sh" and connect it
**Old ID**: STORY-301
**Type**: medium
**Topic**: Add a remote MCP server with OAuth
**Persona**: Marcus, finance lead at a seed-stage startup, does not have the Brex MCP URL and expects a directory to list it.
**Goal**: Brex (https://api.brex.com/mcp) connected from a search result.
**Preconditions**: Signed in; active agent selected; the public catalog (integrations.sh) reachable from the server and listing Brex with an https MCP source. Whether it lists Brex is unverified.
**Ideal path**: 5 — "Integrations", "Browse MCP servers", type "brex", "Search integrations.sh", "Connect" on the result.
**Alternate paths**: Paste `https://api.brex.com/mcp` under "Add server URL" (STORY-017, 5 steps and no catalog dependency); Manage MCP servers → "Add server" (STORY-019).
### Steps
1. Click "Integrations", then "Browse MCP servers". → Inline "Add MCP server" panel.
2. Type "brex" in the panel's "Search apps" box. Thought: "It doesn't filter as I type. Is anything happening?" → Nothing changes until submit; the box is a form field and "Search integrations.sh" is the submit button (disabled while empty).
3. Click "Search integrations.sh". Thought: "What is integrations.sh? Is it safe?" → `capabilities.catalogSearch` with `usePublicCatalog: true` runs. The panel lists only results that have an MCP surface whose source starts with `https://`, each with the name and a "Connect" button.
4. Find "Brex" and click "Connect". → Same flow as STORY-017 step 5, but the server name is the catalog name rather than the host-derived one, and the URL is the catalog's source, which Marcus never sees. Thought: "I'm trusting that this URL is really Brex."
5. A popup opens to Brex's authorization page. **[REAL SIGN-IN]** Log in to Brex (may include SSO or 2FA) and approve. → Callback shows "Finishing MCP connection…" then "Connected" and closes.
6. Back on the main tab. → The result's button changes to "Connected" briefly, then the panel closes (`onServerConnected`) and a "Brex" row appears with the endpoint host as subtitle.
### Variations
- Searching "mercury" returns several results; two entries point to the same endpoint: the panel de-duplicates by endpoint, so only one is shown.
- Marcus pastes the Brex URL instead after seeing no result.
### Edge Cases
- No result: the panel shows "No remote MCP servers found" with no suggestion to use "Add server URL" directly below it (it is, in fact, right below).
- Results with non-https sources are silently hidden.
- Search fails (catalog unreachable): error line "Could not connect" (generic fallback), which wrongly suggests a connection problem rather than a search problem.

---

## STORY-019: Add Mercury and choose which agents get access from "Manage MCP servers"
**Old ID**: STORY-302
**Type**: long
**Topic**: Add a remote MCP server with OAuth
**Persona**: Dana, operations lead who runs three agents: "Finance", "Support", "Research". She wants only "Finance" to see bank data.
**Goal**: Mercury connected via OAuth and available to "Finance" only.
**Preconditions**: Signed in; three active agents; popups allowed; the "Integrations" overlay is open.
**Ideal path**: 10 — this entry is the only one with explicit agent chips before saving and per-agent toggles afterward, at the cost of a separate OAuth click.
**Alternate paths**: STORY-017 (fewer steps but gives access to the active agent only, then Dana must visit Manage MCP servers to remove other agents). Advanced → "Add MCP server" cannot do OAuth.
### Steps
1. In "Integrations", scroll to the bottom and click "Advanced". → The section expands (jargon: "Tool sources", "Executor", "Treg"). Thought: "Which of these is MCP? There's 'Add MCP server' right here."
2. Click "Manage MCP servers" (small link at the bottom of the "Tool sources" list). Thought: "Why is this hidden under tool sources? And why are there two 'add MCP' things?" → The "MCP servers" dialog opens. Left card "Add server", right column "Configured servers" ("No MCP servers yet." if empty).
3. Type "Mercury" in "Server name" (placeholder "e.g. Mobbin"). → Slug will be `mercury`.
4. Leave the tab on "HTTP" (other tabs: "SSE", "STDIO"). Paste `https://mcp.mercury.com/mcp` in "Server URL". Thought: "HTTP or SSE? I don't know; HTTP is first, so HTTP."
5. Leave "Advanced" (Access token optional, Header name/value) closed. Thought: "I don't have a token, I expect OAuth."
6. Under "Agents:", click the "Finance" chip. → The chip fills with a check mark; pressed state.
7. Click "Add server". → Button reads "Adding…", then the server is created with no OAuth. The form clears. The new card appears under "Configured servers": name "Mercury", badge "HTTP" (uppercase), the URL, no status text, an "Agents:" chip row where "Finance" is checked, buttons "Connect OAuth" and "Delete".
8. Click "Connect OAuth". Thought: "So adding did not sign me in. I need this second click." → Button label becomes "Connecting…" and is disabled.
9. Popup opens to Mercury. **[REAL SIGN-IN]** Sign in and approve. → Popup shows "Connected" and closes; the dialog receives the broadcast and refreshes.
10. Check the card. → Status line "OAuth connected"; buttons now "Reconnect OAuth", "Disconnect", "Delete". Chips unchanged: only "Finance" is checked.
### Variations
- Dana skips the chips at step 6 and later clicks "Support" or "Finance" chips on the card; each click calls `assignments.replace` immediately and has no confirmation or error unless it fails ("Could not update agent access").
- Dana adds Brex the same way with name "Brex", URL `https://api.brex.com/mcp`; the slug becomes `brex`.
- She pastes a bearer token under Advanced because a vendor provides one: status shows "credential saved" and the server may not need OAuth.
### Edge Cases
- Empty name: "Add a server name."; empty URL: "Add an HTTPS server URL."
- She named two servers "Mercury": the second create hits the unique (space, user, slug) constraint. The user sees "Could not add MCP server" (or the server's text); the cause is not explained.
- She closes the dialog before step 8: the server stays configured with no OAuth; in the main overlay it appears as a row, but the row menu has no "Reconnect" (see STORY-020).
- Agents ("Agents:" chips) show only non-archived agents. With no agents the chips are hidden entirely.

---

## STORY-020: Cancelled or closed sign-in leaves a half-added server
**Old ID**: STORY-303
**Type**: medium
**Topic**: Add a remote MCP server with OAuth
**Persona**: Tom, founder, starts connecting Brex, sees Brex asking for admin approval, and closes the popup to ask his co-founder.
**Goal**: Understand whether Brex got added and finish it later.
**Preconditions**: Signed in; Brex not yet added.
**Ideal path**: 6 — after cancelling, the fast recovery is Integrations → Advanced → "Manage MCP servers" → "Connect OAuth" on the Brex card.
**Alternate paths**: Retry "Connect" with the same URL under "Add server URL" (the code reuses the existing server with that endpoint).
### Steps
1. "Integrations" → "Browse MCP servers" → "Add server URL" → paste `https://api.brex.com/mcp` → "Connect". → Server "Brex" is created; popup opens.
2. In the popup, Brex shows a login. **[REAL SIGN-IN]** Tom closes the popup window with the X. Thought: "OK, I'll do this later." → Closing the popup is not detected: the code cannot tell a closed popup from a COOP-severed one, so only the timeout or a failure message ends the attempt.
3. Look at the main tab. → The "Connect" button stays disabled for up to 2 minutes with no "Connecting…" label and no message. Thought: "Is it stuck?"
4. After 2 minutes. → The attempt resolves as "cancelled": buttons re-enable, no error, no message, panel stays open, nothing says Brex was added.
5. Close the panel and reopen "Integrations". → A "Brex" row now exists (the server was created before sign-in) with subtitle `api.brex.com`. It does not show "OAuth expired" because no token was ever stored (status "none").
6. Open its "…" menu. Thought: "Where's Reconnect?" → Only "Rename" and "Remove": "Reconnect" is shown only when `oauthStatus` is not "none". To sign in, Tom must open Advanced → "Manage MCP servers" and click "Connect OAuth" on the Brex card, or paste the URL again under "Add server URL" ("Connect" will reuse the server).
### Variations
- The user signs in but the callback page fails (wrong account lacking permission): see Edge Cases.
- The user clicks "Cancel"/denies on the provider's consent screen: the provider redirects to the callback without a code; the page shows "OAuth connection failed" with the provider's `error_description` or "OAuth authorization was cancelled.", broadcasts failure, and stays open; the main tab then treats it as "cancelled" (no message). In a popup the page text says "You can close this window."
- If the active agent was supposed to get access: it did not. Approval happens only after a "connected" result, so a cancelled attempt leaves Brex unassigned.
### Edge Cases
- Tom retries before the 2 minutes end: buttons are disabled, so he cannot.
- Two failed attempts leave one server row, not two (existing endpoint is reused).
- Many abandoned attempts: the API refuses with "Too many pending MCP authorization attempts; wait and try again" at 100 pending sessions (unlikely for a single founder).

---

## STORY-021: Add Mercury through Advanced → "Add MCP server" and hit a dead end
**Old ID**: STORY-304
**Type**: medium
**Topic**: Add a remote MCP server with OAuth
**Persona**: Lena, technical founder, opens Advanced first because "Add MCP server" sounds exactly right.
**Goal**: Connect Mercury (https://mcp.mercury.com/mcp).
**Preconditions**: Signed in; Mercury not added; Mercury's server requires OAuth (the persona's expectation).
**Ideal path**: 5 — this route can succeed only for servers that need no browser sign-in (open or token-based), not for OAuth servers.
**Alternate paths**: "Browse MCP servers" (STORY-017) or "Manage MCP servers" (STORY-019) for OAuth.
### Steps
1. "Integrations" → scroll → click "Advanced". → Expands. Thought: "Too much here: OpenAPI, GraphQL, Executor, Treg. I'll take MCP."
2. Click "Add MCP server". → Card titled "Add remote MCP server" with "Display name", a URL field (placeholder "https://example.com/mcp"), a select ("No authentication", "Bearer token", "API key header"), the note "Credentials are encrypted and never sent to the model.", "Verify and add" and a cancel-type button.
3. Type "Mercury" and paste the URL; leave "No authentication". Thought: "There's no option for OAuth. Maybe 'No authentication' means the server handles it?" → Nothing indicates OAuth is unsupported here.
4. Click "Verify and add". → Button reads "Verifying…". The API (`capabilities.install`, kind "mcp") tries to connect and list tools without any browser sign-in. For a server that needs OAuth, verification is expected to fail (inferred from the code: the install path has no OAuth provider; not observed against Mercury). An error appears: "Could not install connector" or the sanitized server error. If it succeeds (server needs no auth), the source appears under "Tool sources" and is not an MCP server row.
5. Lena is stuck. Thought: "I'll try 'Bearer token'; I don't have one." → Without a token there is no route from this card to OAuth. She must find "Manage MCP servers" (STORY-019) or "Browse MCP servers" (STORY-017).
### Variations
- With a token from the vendor: choose "Bearer token", enter the token under "Credential", click "Verify and add"; the source is added to "Tool sources" with its tools. No agent chips and no `McpServerRow` for it (inferred: it is a CapabilityInstall, not an McpServer).
- With "API key header": a "Header name" field appears (default `x-api-key`).
### Edge Cases
- Same name added twice here: no check was found in the UI code; not verified.
- "Remove" next to the source in "Tool sources" removes it ("Removing…") with no confirmation; "Could not remove connector" on failure.
- A server added here is not shown in "MCP servers" (Manage), so users may look in the wrong list later.

---

## STORY-022: Blocked popup sends the whole tab to the provider, agent access is lost
**Old ID**: STORY-305
**Type**: long
**Topic**: Add a remote MCP server with OAuth
**Persona**: Ravi, founder using Safari with popup blocking on, connecting Brex while an agent chat is open in another tab.
**Goal**: Connect Brex and have his active agent use it.
**Preconditions**: Browser blocks `window.open`. Signed in. Active agent selected.
**Ideal path**: 6 — the fix is to allow popups for the site, then run STORY-017 steps; after a tab-level sign-in the extra step is assigning the agent by hand.
**Alternate paths**: Manage MCP servers → "Connect OAuth" has the same blocked-popup fallback but assignments there are chips, so access is not lost.
### Steps
1. "Integrations" → "Browse MCP servers" → "Add server URL" → paste `https://api.brex.com/mcp` → "Connect". Thought: "I clicked once; why is the page doing nothing?" → Server "Brex" is created; the app asks the API for the authorization URL, then `window.open` returns null.
2. The page navigates. → The current tab leaves Rakazo for Brex's authorization page (`window.location.assign`). No message is shown first. Thought: "Did I just get kicked out? What happened to my chat?" Any unsent text in the app is lost.
3. Sign in at Brex. **[REAL SIGN-IN]** → Brex redirects to `/mcp/oauth/callback`. The page shows "Finishing MCP connection…".
4. Wait. → The code finishes `mcp.oauth.complete`, broadcasts "mcp-oauth-complete", and because this tab is not a popup, navigates to `/app?mcp_oauth=connected`. No toast is shown (the query parameter is not read by the code found). Thought: "Is Brex connected?"
5. Open "Integrations". → A "Brex" row exists with subtitle `api.brex.com`. The original code that assigns the active agent ran in the page that was navigated away, so `assignments.approve` never ran.
6. Ravi asks his agent about Brex expenses. → The agent has no Brex tools (access not granted; inferred from the control flow). He must open Advanced → "Manage MCP servers" and click his agent's chip on the Brex card.
### Variations
- If the callback fails in a non-popup tab, the page shows "OAuth connection failed", the error text, and a "Return to Rakazo" button (not shown in a popup).
- If Ravi allows popups and retries "Connect": the existing Brex server is reused, `begin` returns "already_connected" since the token is stored, and the app proceeds as success and assigns the agent. No explanation is shown.
### Edge Cases
- Other browser tabs of Rakazo open at the same time receive the BroadcastChannel message; the Manage MCP servers dialog refreshes if open.
- Some login pages sever the opener: the tab-scoped sessionStorage marker `rakazo-mcp-oauth-popup` keeps the popup window closing correctly.

---

## STORY-023: Two agents, one server: who can use Mercury, and what "OAuth expired" means
**Old ID**: STORY-306 + folded-in STORY-405
**Type**: long
**Topic**: Add a remote MCP server with OAuth
**Persona**: Nina, founder with "Finance" and "Support" agents. Three weeks after connecting Mercury she sees "OAuth expired" under the Mercury row and her agent stops reporting balances.
**Goal**: Restore Mercury and confirm exactly which agents can use it.
**Preconditions**: Mercury was connected via STORY-017 while "Finance" was the active agent. The stored sign-in can no longer be refreshed (the app marks status "reconnect").
**Ideal path**: 4 — "Integrations", "…" menu on the Mercury row, "Reconnect", sign in.
**Alternate paths**: Advanced → "Manage MCP servers" → "Reconnect OAuth" on the card (status text there also says "OAuth expired"); "Disconnect" then "Connect OAuth" (the manage dialog offers a "Disconnect" button; the row menu has none).
### Steps
1. Open "Integrations". → The Mercury row subtitle shows "OAuth expired" in warning color instead of the host. Thought: "Expired? I didn't do anything. Is my money data exposed?" No inline "Reconnect" button on the row.
2. Click the "…" button (accessible name "Manage Mercury"). → Menu: "Reconnect", "Rename", "Remove".
3. Click "Reconnect". → The subtitle becomes "Connecting…"; the app calls `mcp.oauth.begin` with `reauthorize: true` and opens the popup. The previous token is kept until the new one succeeds.
4. Sign in to Mercury again. **[REAL SIGN-IN]** → Popup shows "Connected" and closes; the row refreshes and shows the host again.
5. Ask: who can use it? Nina opens Advanced → "Manage MCP servers". → The Mercury card shows "Agents:" chips: "Finance" checked, "Support" not checked, and "OAuth connected" status. This is the only screen that shows agent access.
6. Click "Support" to grant it, then click "Finance"'s chip to test removing. Thought: "I hope this doesn't kill the connection." → Each click saves immediately; no confirmation. Removing access does not delete the server or its OAuth token.
### Variations
- Nina cancels Reconnect: the old stored sign-in stays and the row keeps showing its prior state (still "OAuth expired" if the refresh token was dead). No message is shown on cancel; after 2 minutes (or immediate failure message) the subtitle returns.
- Nina chooses "Remove" instead: dialog "Remove Mercury?" with "Bots lose access to its tools." and "Cancel"/"Remove"; the server and assignments are deleted.
- In the manage dialog she clicks "Delete": first click turns the button into "Confirm delete" (destructive); second click deletes. Clicking elsewhere does not reset the confirmation state.
### Edge Cases
- If the vendor server stops requesting authorization during Reconnect, the row shows "This server did not request browser authorization."
- In the manage dialog, "Connect OAuth" on an already-connected server returns "This server is already connected. Disconnect it first to authorize again." Reconnect in the row menu avoids this by using `reauthorize`.
- A "Reconnect" error shows as "Could not reconnect" under the row in red.
- Reconnect does not change which agents are assigned.

---

## STORY-024: Same URL twice, and a server that never asks for OAuth
**Old ID**: STORY-307
**Type**: short
**Topic**: Add a remote MCP server with OAuth
**Persona**: Jonas, founder, adds Mercury, forgets, then adds it again from another entry point; later adds an internal MCP server with no OAuth.
**Goal**: Know what happens when the same URL is added twice, and what a no-OAuth server looks like.
**Preconditions**: Mercury already connected (STORY-017).
**Ideal path**: 4 — repeat is safe from "Browse MCP servers", where it reuses the server.
**Alternate paths**: Manage MCP servers "Add server" creates a second card if the name differs.
### Steps
1. "Integrations" → "Browse MCP servers" → "Add server URL" → paste `https://mcp.mercury.com/mcp` → "Connect". Thought: "It'll tell me it's already there." → The code finds the existing server with that endpoint and reuses it; no second row. `oauth.begin` returns "already_connected" (token valid), which is treated as success: the active agent is assigned, the panel closes. No "already added" message and no popup. Thought: "Did anything happen?"
2. In Advanced → "Manage MCP servers", "Add server" → name "Mercury 2", same URL → "Add server". → A second card is created with a new slug. Two cards point to the same URL; nothing warns about the duplicate. Each needs its own "Connect OAuth".
3. Add an internal server `https://tools.example.com/mcp` that does not request OAuth via "Connect OAuth" in the manage dialog. → The error reads "This server did not request browser authorization." Via the row's "Reconnect": the same message under the row. Via "Add server URL": the code approves the agent and shows the row as if connected, since "authorization_not_requested" is not "cancelled"; the row subtitle shows the host and no OAuth status.
### Variations
- Same name "Mercury" reused in the manage dialog fails with "Could not add MCP server" (slug conflict).
### Edge Cases
- A server that needs only a token: use Manage → Advanced "Access token (optional)" or a header; status shows "credential saved".
