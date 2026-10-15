# Topic: Manage and disconnect

Code read: `apps/web/src/pages/PluginsOverlay.tsx` (detail view `renderDetail`, `revokeAccount`, `uninstall`, `renameAccount`, `removeSource`, `activeAccounts`), `apps/web/src/components/integrations/McpServerRow.tsx`, `apps/web/src/pages/McpServersOverlay.tsx`, `apps/web/src/lib/mcp-connect.ts`, and in `apps/api/src/router.ts` the handlers `connections.list/rename/revoke`, `mcp.servers.rename/remove`, `mcp.assignments.replace`, `mcp.oauth.disconnect`.

Facts the stories rely on:
- `connections.list` returns every row (pending, connected, revoked, error), but the overlay's `activeAccounts` keeps only `connected` and `pending`. A `revoked` or `error` row never appears.
- `connections.revoke` marks the row `revoked` and also deletes that connection's mail data (`deleteMailConnectionData`). It asks the provider to delete the remote account when this is the last active account for the app.
- The main overlay lists only MCP servers with `enabled = true`. `McpServersOverlay` lists all of them.
- `mcp.assignments.replace` overwrites a bot's whole list. Removing a server from a bot reverts that bot's pending "connected" approval cards.
- `mcp.servers.remove` deletes the server, cascades its agent assignments and deletes its stored credential.

## STORY-025: Rename a connected account so two Slack workspaces are distinguishable
**Old ID**: STORY-400
**Type**: short
**Topic**: Manage and disconnect
**Persona**: Priya, a consultant who connected one Slack workspace for her own company and wants to tell it apart from a client workspace she adds later.
**Goal**: Give the existing Slack account a clear label.
**Preconditions**: Slack shows "Added" in the featured grid. Priya is signed in on web. One connected Slack account exists with the default label "Slack".
**Ideal path**: 3 — open the "Added" tile, edit the label, press Enter.
**Alternate paths**: none found. Rename exists only in the detail view's "Accounts" card (`connections.rename`). The "Add another" flow suggests a name like "Slack 2" (`nextAccountLabel`) but does not ask for one.
### Steps
1. Click Integrations in the sidebar, then click the "Added" Slack tile → the detail view opens (data-testid `connection-detail`) with a "Back" arrow, "Uninstall", an "Accounts" card and a collapsed tools card.
2. In "Accounts", click the text field (aria-label "Account label") showing "Slack" and replace the text with "Slack – Acme Inc" → the draft is held locally. Nothing is saved yet. Priya wonders whether she needs to find a Save button, and there is none.
3. Press Enter → the field blurs, `onBlur` calls `renameAccount`, and `connections.rename` runs. The new label stays in the field. There is no toast or saved indicator.
### Variations
- Priya clicks elsewhere in the dialog instead of pressing Enter. Blur saves it the same way.
- She clears the field and leaves it. `renameAccount` returns early because the name is empty, and the field keeps showing blank text until the view reloads. The server still holds the old name.
- She types the same name. Nothing is sent.
### Edge Cases
- If `connections.rename` fails, the red text "Could not rename connection" (or the server message) appears at the top of the overlay, away from the field she edited. The field still shows her unsaved text, so it looks as if it saved.
- Priya presses Escape while editing, expecting to cancel the edit. The field has no Escape handler, so Escape most likely closes the whole dialog (unverified in a browser) and her draft is lost.
- The label appears nowhere else in the overlay (the grid tile still reads "Slack"), so she cannot confirm the change from the main view.
- Multi-surface: the same label is stored per connection in the database, so desktop (Electron hosts the same overlay) shows it too. Mobile has no equivalent screen in the code read.

## STORY-026: Add a second account, then remove just one
**Old ID**: STORY-401 + folded-in STORY-205
**Type**: medium
**Topic**: Manage and disconnect
**Persona**: Marcus, a founder who connected his personal Gmail through Composio and now wants his work mailbox added and the personal one dropped.
**Goal**: End with only the work account connected.
**Preconditions**: Gmail shows "Added" with one connected account labeled "Gmail". Marcus can complete the provider sign-in popup.
**Ideal path**: 6 — open detail, Add another, finish sign-in, rename, Remove the old row, check.
**Alternate paths**: (a) Uninstall then "Add" again reaches the same end state but removes both and has no confirmation (see STORY-027). (b) For native Google, the same "Add another" button is used, and sign-in opens in the system browser on desktop or at `/integrations/google/callback` on web.
### Steps
1. Click Integrations, then the "Added" Gmail tile → detail view opens, "Accounts" lists one row with a field showing "Gmail" and a "Remove" button.
2. Click "Add another" → the button reads "Adding…" and a provider popup opens (`connections.begin` with the label "Gmail 2" from `nextAccountLabel`). Marcus thinks about whether this will replace the first account. The screen does not say.
3. Sign in with the work mailbox in the popup and approve → the overlay polls `connections.complete` about every 2 seconds. When it finishes, the button returns to "Add another" and "Accounts" shows two rows ("Gmail", "Gmail 2"). No success message.
4. Rename the second row to "Gmail work" and press Enter → saved on blur (see STORY-025).
5. Click "Remove" on the first row, "Gmail" → the button reads "Removing…" and `connections.revoke` runs for that row only. There is no confirmation. The row disappears and the tools list reloads.
6. Check that "Accounts" shows only "Gmail work" and that the tile in the grid still says "Added" → both hold, because one connected account remains.
### Variations
- Marcus removes the work account by mistake. Re-adding means "Add another" and a full sign-in again. There is no undo.
- He leaves the popup open. After about 90 seconds the error "Connection to Gmail is still pending. You can close this and check again." appears. A pending row may already be listed under "Accounts", looking like a connected one.
- He opens the Inbox "connect mail" prompt instead. That opens the same overlay with the search set to "gmail", then he clicks the tile.
### Edge Cases
- Removing a Gmail account also deletes the mail data synced for that connection (server `deleteMailConnectionData`). The button gives no warning, so Marcus may expect only access to be cut off, not synced mail to disappear from the Inbox.
- If the first "Remove" fails, the top-of-overlay message reads "Could not revoke connection". The same text is used when the user pressed "Uninstall", so it is not clear what was being removed.
- If Marcus removes the last connected row, `setItemConnected(item, false)` flips the tile back to "Add" but the detail view stays open with an empty "Accounts" list and only "Add another".
- A pending (unfinished) second account shows as a normal row and `Remove` works on it, which is the only way to clear a stuck attempt.

## STORY-027: Uninstall Slack and discover it removes every account at once
**Old ID**: STORY-402
**Type**: medium
**Topic**: Manage and disconnect
**Persona**: Dana, an operations lead who connected two Slack workspaces (company and a partner) and wants to stop using the partner one but taps the wrong button.
**Goal**: Remove only the partner workspace.
**Preconditions**: Slack "Added" with two accounts, "Slack" and "Slack partner".
**Ideal path**: 3 — open detail, click "Remove" on the partner row. The user who clicks the top button instead ends on the wrong path.
**Alternate paths**: "Uninstall" (top right) revokes every active row in one loop (`uninstall`). Removing rows one by one with "Remove" reaches the same end state for a one-account app.
### Steps
1. Click Integrations, then the "Added" Slack tile → detail opens with "Uninstall" at top right and two account rows, each with a ghost-style "Remove".
2. Dana hesitates over "Uninstall" versus "Remove". She guesses "Uninstall" means "this account" and clicks it → the label becomes "Removing…" and the code revokes both accounts one after another. No confirmation dialog appears, unlike MCP servers.
3. The detail view closes and she is back in the grid → the Slack tile no longer shows "Added". The company workspace is gone as well.
4. She clicks "Add" on Slack, signs in again to the company workspace → the tile returns to "Added". Agents' use of Slack resumes. The partner workspace stays gone.
### Variations
- If revocation of the second account fails after the first succeeded, the message "Could not revoke connection" appears and the code refreshes. The detail view stays open and shows the account that remains.
- Dana reads the button label first and removes the partner account with the row's "Remove". Only that row goes.
### Edge Cases
- "Uninstall" is a secondary-style button and "Remove" a ghost text button. The weaker-looking "Remove" is the safe one, and the stronger-looking "Uninstall" is the destructive one.
- During uninstall, every "Remove" and "Add another" button is disabled, so she cannot stop it partway.
- Nothing on this screen shows which agents were using Slack, so she cannot judge the impact before clicking.
- Revoked rows are hidden by `activeAccounts`, so there is no way to see what was removed.

## STORY-028: Find out which agents can use an MCP server and take access away from one
**Old ID**: STORY-403
**Type**: medium
**Topic**: Manage and disconnect
**Persona**: Jonas, who runs three agents ("Research", "Finance", "Support") and has just connected a payments MCP server. He wants only "Finance" to use it.
**Goal**: See which agents currently have access and leave only "Finance" assigned.
**Preconditions**: One MCP server "Mercury" is connected with OAuth. When it was added, the active agent "Research" was assigned automatically (the inline Connect flow assigns the active bot).
**Ideal path**: 5 — Integrations, Advanced, Manage MCP servers, toggle chips, done.
**Alternate paths**: (a) For a new server, the "Agents:" chips in the "Add server" form of the same overlay set assignment at creation. (b) Removing the server (STORY-029) removes access for all agents at once.
### Steps
1. Click Integrations and look at the main view → "Mercury" appears as a row (avatar, name, host subtitle) in the connected MCP area. The row shows no agents. Jonas cannot tell who has access from here.
2. Scroll to the collapsed "Advanced" section and open it → "Search by domain", "Add MCP server", "Add OpenAPI", "Add GraphQL", "Add Executor", "Add Treg", "Tool sources" and a "Manage MCP servers" link appear. He is unsure which entry shows agent access, and picks "Manage MCP servers".
3. Click "Manage MCP servers" → the "MCP servers" overlay opens with an "Add server" card on the left and "Configured servers" on the right. Under "Mercury" there is a line "Agents:" followed by round chips for "Research", "Finance" and "Support". "Research" has a check mark and a filled style (pressed).
4. Click the "Research" chip → `mcp.assignments.replace` removes Mercury from Research's list. The chip becomes outlined. Then click the "Finance" chip → it turns filled with a check mark. Each click saves immediately. No toast.
5. Close the overlay with "Close MCP servers" → he is back at the Integrations overlay. Mercury is still listed. He cannot confirm there that only Finance has it.
### Variations
- Jonas has no active agents. The "Agents:" row shows only the label and no chips, with no hint to create one.
- Archived agents are filtered out and never appear as chips.
- He uses the "Reconnect" row menu on the main view first, thinking it would manage agent access. It only restarts sign-in.
### Edge Cases
- If the update fails, the red box at the top of the overlay says "Could not update agent access". The chip stays in its previous state.
- Assignment is per tool-set: new chips are saved with `allowAllTools: true`. Which tools an agent can use is never shown (the stored tool allowlist has no UI).
- Removing an agent's access reverts any pending "connected" approval card in that agent's thread (server side), which may surprise a user who was about to approve it.
- Managed apps from the grid (Slack, Gmail) have no "Agents:" chips anywhere. Whether agents can use them is not shown in the UI code read.
- Multi-surface: the chips exist only in this web/Electron overlay.

## STORY-029: Remove an MCP server from the main list (confirm dialog)
**Old ID**: STORY-404
**Type**: short
**Topic**: Manage and disconnect
**Persona**: Leila, a designer who tried a Brex MCP server and no longer needs it.
**Goal**: Delete the Brex server and its saved sign-in.
**Preconditions**: "Brex" appears as a server row in the Integrations overlay.
**Ideal path**: 3 — "…" menu, Remove, confirm.
**Alternate paths**: In the "MCP servers" overlay (Advanced, "Manage MCP servers"), the server card has "Delete" then "Confirm delete". Same server removal, different wording and a different confirmation style (a second click on the same button instead of a dialog).
### Steps
1. Click the "…" button on the Brex row (aria-label "Manage Brex") → a menu shows "Reconnect", "Rename" and "Remove" (in red).
2. Click "Remove" → a dialog opens with the title "Remove Brex?" and the text "Bots lose access to its tools." with "Cancel" and "Remove".
3. Click "Remove" → `mcp.servers.remove` deletes the server, its agent assignments and the stored credential. The list refreshes and the row is gone.
### Variations
- Leila clicks "Cancel" or presses Escape in the dialog. Nothing changes.
- She chooses "Rename" instead. The name becomes an input (aria-label "Name"); Enter saves, Escape cancels the edit (the input has an Escape handler).
- For a server the user wants to keep but pause: no pause or disable control exists in the UI code read.
### Edge Cases
- The dialog does not list which agents will lose access or say that the saved sign-in is deleted. She would have to reopen the "MCP servers" overlay beforehand to see the chips.
- On failure the row shows "Could not remove" in red under it.
- A server with `enabled = false` never appears in this list, so it can only be removed from "MCP servers" overlay.
- Wording split: "Remove" with a dialog here, "Delete" with "Confirm delete" in the other overlay, and "Uninstall" without any confirmation for managed apps.

## STORY-023 [folded-in, was STORY-405]: Recover an MCP server whose sign-in shows "OAuth expired"
**Folded into**: STORY-023 (see catalog.md). Original steps kept here for reference.
**Type**: medium
**Topic**: Manage and disconnect
**Persona**: Tomasz, a developer whose Brex tools stopped working in chat. Two weeks ago he connected Brex through the MCP flow.
**Goal**: Get Brex working again without losing its agent assignments.
**Preconditions**: The Brex server has `oauthStatus = "reconnect"`. He opens Integrations without knowing why chat tools fail.
**Ideal path**: 4 — Integrations, "…" menu, Reconnect, approve in popup.
**Alternate paths**: (a) "MCP servers" overlay: "Reconnect OAuth" button on the server card (the card also shows "OAuth expired"). (b) "Disconnect" then "Connect OAuth" clears the stored sign-in first, then reconnects, which is more steps and loses nothing else. (c) Remove and re-add the server, which also drops assignments and is the worst option.
### Steps
1. Click Integrations → the Brex row's subtitle reads "OAuth expired" in the warning color instead of the host. The row has no inline button. He guesses the "…" menu is next.
2. Click the "…" button (aria-label "Manage Brex") → the menu shows "Reconnect", "Rename", "Remove".
3. Click "Reconnect" → the subtitle changes to "Connecting…", the menu is disabled, and a provider popup opens (`connectMcpOauth` with `reauthorize: true`).
4. Approve access in the popup → the callback page shows "Finishing MCP connection…" then "Connected" and closes. The overlay refreshes and the row subtitle returns to the host name. Agent assignments are unchanged.
### Variations
- Tomasz closes the popup or does nothing for about 2 minutes. This is treated as a cancel with no message. The subtitle goes back to "OAuth expired" and the old stored sign-in stays as it was.
- His browser blocks the popup. The whole tab navigates to the provider and returns to `/app` afterward, which loses his place in the overlay. The code returns "cancelled" and shows nothing.
- The server answers that it did not request authorization. The row shows "This server did not request browser authorization."
### Edge Cases
- The only warning that a sign-in expired is a small colored subtitle in the Integrations overlay. A chat user whose tool call failed gets no pointer to this screen in the code read.
- If the popup callback fails, the page shows "OAuth connection failed" in the popup, and the main overlay shows nothing.
- "Reconnect" appears only for OAuth servers (`oauthStatus` not "none"). A server that uses a pasted token has nothing to reconnect and must be edited by remove and re-add.
- In "MCP servers" overlay, a connected server has "Reconnect OAuth" and pressing it when the server is already connected can return "This server is already connected. Disconnect it first to authorize again." The row-menu "Reconnect" avoids this by forcing reauthorization.

## STORY-030: Disconnect OAuth on a server but keep the server and its agents
**Old ID**: STORY-406
**Type**: medium
**Topic**: Manage and disconnect
**Persona**: Hana, a security-minded admin who wants Mercury signed out (so tokens are not stored) while she keeps the server entry for later.
**Goal**: Clear the stored sign-in but keep the server and agent assignments.
**Preconditions**: Mercury is connected with OAuth, the card shows "OAuth connected". Agents "Finance" and "Support" are assigned.
**Ideal path**: 4 — Advanced, Manage MCP servers, Disconnect, check.
**Alternate paths**: The main Integrations overlay has no Disconnect. Its row menu offers only Reconnect, Rename and Remove. Remove is the only route there, and it deletes the server.
### Steps
1. Click Integrations, open "Advanced", click "Manage MCP servers" → "MCP servers" overlay opens. She sees the Mercury card with the badge "HTTP", the endpoint, "OAuth connected", "Agents:" chips, and the buttons "Reconnect OAuth", "Disconnect" and "Delete".
2. Hana wonders what "Disconnect" does to the agents. The card does not say. She clicks "Disconnect" → there is no confirmation. The button group is disabled while `mcp.oauth.disconnect` runs.
3. The card refreshes → the status line "OAuth connected" disappears and the main button now reads "Connect OAuth" (OAuth status "none"). The "Disconnect" button is gone. The "Finance" and "Support" chips remain filled.
4. She closes with "Close MCP servers" and returns to Integrations → the Mercury row is still listed, and its subtitle shows the host. The row looks the same as a connected server, even though tool calls will fail until she signs in again.
### Variations
- To sign in again, Hana clicks "Connect OAuth" and completes the popup. The agent chips need no change.
- If the user closes the overlay during "Connecting…", the pending state is cleared when the BroadcastChannel message `mcp-oauth-complete` arrives or on a later refresh.
### Edge Cases
- The failure message is "Could not disconnect OAuth".
- After Disconnect, no row in the main overlay shows a "disconnected" state, so a teammate looking at that screen cannot tell the server is signed out.
- "Disconnect" and "Delete" sit on the same row, but only Delete asks for confirmation.
- Stdio servers show neither "Connect OAuth" nor "Disconnect".

## STORY-031: Delete an MCP server from the "MCP servers" overlay with the two-click confirm
**Old ID**: STORY-407
**Type**: short
**Topic**: Manage and disconnect
**Persona**: Ravi, cleaning up four test servers he added while trying "Add server" with different URLs.
**Goal**: Delete two of the four.
**Preconditions**: "MCP servers" overlay is open with four cards.
**Ideal path**: 2 — click "Delete", click "Confirm delete".
**Alternate paths**: Row menu "Remove" in the main Integrations overlay (a dialog, see STORY-029).
### Steps
1. Click "Delete" on the card "Test A" → the button turns red and reads "Confirm delete". Nothing is deleted yet.
2. Click "Confirm delete" → `mcp.servers.remove` runs, the list refreshes and "Test A" is gone along with its saved credential and assignments.
### Variations
- Ravi clicks "Delete" on "Test B" after arming "Test A". `confirmingDelete` holds one id, so "Test A" reverts to "Delete" and "Test B" is armed. Only one card is armed at a time.
- After deleting all servers, the list shows "No MCP servers yet."
### Edge Cases
- The armed state has no timeout. Ravi can leave the card red, scroll away, and later click it thinking it is a normal button. Nothing else on the card changes (no text about what will be lost).
- Clicking elsewhere does not disarm it. Only a different card's "Delete" does.
- The failure message is "Could not delete MCP server" at the top of the overlay.
- If the card was enabled=false (not shown in the main overlay), this is the only place to find it.

## STORY-032: Audit what is connected, spot a connection that is broken, and clear out "Tool sources"
**Old ID**: STORY-408
**Type**: long
**Topic**: Manage and disconnect
**Persona**: Elena, an operations manager returning after a month. Gmail stopped syncing in her Inbox, an MCP server shows a warning, and she wants to clean up everything she no longer uses.
**Goal**: Know what is connected, repair or remove what is broken, and remove unused tool sources.
**Preconditions**: Web app. Gmail has a connection whose server status is `error` (for example the provider revoked access). One more Slack account is connected. Mercury shows "OAuth expired". Two entries exist under "Tool sources" (one MCP, one OpenAPI).
**Ideal path**: 11 — open overlay, read the main list, check each tile, repair Gmail, reconnect Mercury, remove sources.
**Alternate paths**: (a) The Inbox "connect mail" prompt opens the same overlay filtered to "gmail". (b) Sources can be removed only in Advanced, but MCP servers can also be managed through "Manage MCP servers". (c) Reconnect for Mercury in the other overlay via "Reconnect OAuth".
### Steps
1. Click Integrations in the sidebar → the overlay opens with the title "Integrations" and the "Search apps" field. At the top, MCP server rows appear (Mercury with the warning subtitle "OAuth expired"). Below, the featured grid shows Gmail, Slack and others with "Added" or "Add". Elena notes that "Added" is the only sign of connection.
2. Look at the Gmail tile → it may show "Add" rather than "Added" even though a row exists, because `error` rows are not counted in `activeAccounts` (the tile can still read "Added" if the catalog's own `connected` flag is true; not verified). She cannot tell that a connection exists and failed, and no message explains why Inbox sync stopped.
3. Click the Gmail tile if it shows "Add" → this starts a new connection (`connections.begin`) and opens the provider popup. The server reuses an existing row for the same app when one exists (`pickReusableConnection`), so no duplicate row is made. She signs in again. The tile shows "Added".
4. Click the "Added" Slack tile → detail shows two accounts with their labels, "Remove" for each, "Add another", and a collapsed tools card reading "# tools" (for example "12 tools").
5. Open the tools card → the list shows tool names only, in plain form. If tools failed to load, the card shows "No tools available." with no reason, which looks the same as a Slack connection with nothing to offer.
6. Click "Remove" on the old Slack account she no longer uses → no confirmation, the row disappears.
7. Click "Back" (aria-label "Back") → the grid returns.
8. On Mercury's row, click the "…" button and choose "Reconnect" → popup, approval, subtitle returns to the host (see STORY-023).
9. Scroll to "Advanced" and open it → "Tool sources" lists two entries with an avatar letter ("M" for MCP, "A" for API), a name, a line like "MCP · {source} · credential saved" or "no auth", and a "Remove" button each. If none exist, the text reads "No MCP or API tool sources installed yet." Elena does not know what a tool source is or whether Mercury is also one.
10. Click "Remove" on the unused OpenAPI source → the button reads "Removing…", `capabilities.remove` runs, and the entry disappears. No confirmation.
11. Close the overlay → back in the app, she reopens the Inbox to check whether Gmail syncs.
### Variations
- Elena opens "Manage MCP servers" to see all servers, including disabled ones, with agent chips (STORY-028).
- A fresh connection still pending (never finished) appears as a normal connected account in step 4. She may remove it to clear it.
- If the Gmail row had become `revoked` (for example after a failed remote revoke), it is hidden too, so the "Add" tile is the only visible state.
### Edge Cases
- Tool source removal failure shows "Could not remove connector" (the code calls it "connector", the UI heading says "Tool sources").
- The same item can be in three lists with three names: a server row, a "Tool sources" entry (if added through Advanced) and a "Configured servers" card. It is unclear which "Remove" affects which.
- The "Tool sources" list is only reachable through a collapsed "Advanced" section and shows no relation to the agents that use it.
- Pending and error states are never labeled, so there is no way to learn from this overlay why a connected app is not working.
- Multi-surface: this overlay is identical in the Electron app. On desktop with native Google, "Add another" opens the system browser. Mobile has no integrations overlay in the code read.
