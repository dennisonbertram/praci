# Topic: First-party app tiles (Devin, Box, Granola, Wispr Flow, Zernio), iMessage setup, and notification toasts

Code read: `apps/web/src/components/integrations/{IntegrationsHome,CustomConnectionDialog,IMessageSection,McpDetail,IntegrationAgentSection}.tsx`, `apps/web/src/lib/integrations.ts` (`FIRST_PARTY_MCP`), `packages/contracts/src/{integration-agent,devin,box,granola,wispr-flow,messaging-setup}.ts`, `packages/core/src/mcp.ts` (`deriveMcpName`), `apps/web/src/components/{AppToaster,NotificationSettings}.tsx`, `apps/web/src/lib/notification-delivery.ts`, `packages/ui-web/src/components/ui/notification-toaster.tsx`, `apps/web/src/pages/{MessagingSettingsOverlay,AccountSettingsOverlay}.tsx`, `apps/web/src/pages/shell/transcript.tsx`.

Mercury, Brex, Carta, Notion agent creation and the "Allow changes" confirm are already covered in `new-integration-agents.md` and `new-connected-app-agents.md`, so they are not repeated. This file covers the tiles those files do not, the iMessage setup dialog, and the toast and run-status surfaces.

## Key facts from the code

- **Where the tiles are.** On `/app/integrations`, after the "Popular" grid and the "Finance" section, three sections list first-party tiles: "Social" (Zernio, X), "Equity" (Carta), "Tools" (Treg, Devin, Box, Granola, Wispr Flow). Then a "Chat" section holds two iMessage tiles. Last comes "Anything else" with "Add custom connection". While a search or category chip is active, the section titles disappear and all matches share one grid.
- **Tile copy.** Zernio "Post and schedule to social accounts"; Devin "Coding sessions and repo docs"; Box "Search and read files and folders"; Granola "Meeting notes and transcripts"; Wispr Flow "Notetaker meetings, notes and tasks". Each tile has a "Connect" button (accessible name "Connect {name}").
- **Four connect styles, one dialog.** Every first-party tile opens `CustomConnectionDialog` titled "Connect {name}" with the URL hidden (the address is known).
  - Zernio, Granola, Wispr Flow: no extra fields. The primary button reads "Sign in with {name}" and opens a browser sign-in window. These servers register their own client on the fly.
  - Devin: description line "An org-scoped Devin service-user key (starts with cog_)." One password field "API key". The button reads "Connect" and stays disabled until a key is typed. Enter in the field also submits. No browser sign-in ever opens.
  - Box (and X): the dialog opens with "Callback URL" (read-only, with Copy), the line "Create an app in Box's developer settings with this callback URL.", "Client ID" and "Client secret (optional)". The button reads "Sign in with Box" and stays disabled until a Client ID is typed. The line "Enter a Client ID to sign in." shows while it is empty.
- **After connecting.** Sign-in wait screen ("Sign in to {name} in the new window", "Step 1 of 3"), then a done screen titled "{serverName} connected" with "Done". The name comes from the web address, not from the tile: Devin, Box, Granola and Zernio come out as those words, but Wispr Flow's address (`api.wisprflow.ai`) gives "Wisprflow" with a lowercase f (UNVERIFIED: depends on `deriveMcpName`; the unit does not special-case it). Because the API creates an agent for each new server, the "which bots" step is skipped when the server has an agent (`afterSignIn`). If the agent could not be made, an agent-choice step appears instead (UNVERIFIED, no way found to force it in the demo).
- **The tile disappears once connected.** A first-party tile is hidden when a server or source with the same endpoint exists. The server then appears under "Connected" as a card (name, a one-line description, status badge "Connected" / "Needs reconnect" / "Failed" / "Connecting…", "Used by" avatars). The card links to `/app/integrations/mcp/{id}`.
- **Agent rules differ by service** (`INTEGRATION_PRESETS`). Devin requires its own agent (`requiresAgent: true`): no other bot can use Devin until the agent exists, and every Devin write (`devin_session_create`, `devin_session_interact`, playbooks, knowledge, schedules) is a forced write that asks on a card. Box allows other bots and forces writes (upload, move, copy, rename, sharing, collaborators, comments) to ask. Granola and Wispr Flow are read-only; Wispr Flow's tool names are guessed by a read-verb pattern (a code comment says to replace it after the first live connection).
- **Detail page** (`McpDetail`): status badge, "via MCP · {host}", buttons "Reconnect", "Disconnect sign-in" (only while the sign-in is live), "Create agent" (only when no agent), "Rename", an "Agent" section with a link to the agent, a writes switch and "Share with all agents", "Used by", and "Remove {name}" with "Removes the connection and bot access." Confirm dialog "Remove {name}?" says "Bots lose access to the tools of {name}." and "Your data in {name} is not deleted.". Allowing changes asks "Allow changes in {service}?" with "Allow changes" and the line "The agent will be able to change your {service} data. It asks before each change." (already walked in the Notion and Mercury stories).
- **iMessage tiles.** Shown only to the deployment owner (`messagingSetup.get().canConfigure`), only when category is "All" or "Chat", and only when the search text matches the tile name. Tiles: "iMessage (Photon)" ("Chat with your agents over iMessage") and "iMessage (BlueBubbles)" ("Chat with your agents over iMessage from your Mac"). Status text: nothing when not configured; "Needs a server restart" (warning color) when configured but not active; "Connected" plus a ghost button "Link a chat app" when active. Button reads "Connect" or "Edit" (accessible name "Connect iMessage (Photon)" etc.). A non-owner sees neither tile nor the "Chat" heading.
- **iMessage dialog** (`SetupDialog`, titled with the tile name). BlueBubbles fields: "Server URL" (required), "Server password" (secret), "Webhook token" (secret, optional). Photon fields: "Project ID", "Project secret" (secret), "Webhook signing secret" (secret), "Address" (optional). A saved secret shows "{label}: Saved" with a "Replace" button instead of an input. A value set by the server environment shows disabled with "Set by server". A read-only "Paste this into BlueBubbles" or "Paste this into Photon" field shows the webhook address with "Copy" (becomes "Copied"). Warning (BlueBubbles only, not for server-set URLs): "Anyone who can reach this address can talk to your Mac's server. Use a private network or a tunnel." when the URL is http(s) and not private (loopback, LAN, tailnet, single-label or `.local`). Buttons: "Cancel" (becomes "Done" after saving), "Test connection" (disabled until the provider is configured; shows "Testing…"; times out after 10 seconds with "No response from the server. Check the address."; success shows "Connected"), "Save". After Save: "Saved" and, in warning color, "Restart the Praci server to start using iMessage." The same restart line shows whenever the provider is configured but not active.
- **Where "Link a chat app" appears twice.** The tile's ghost button opens the Messaging overlay. The overlay has its own "Link a chat app" button next to a "Choose a bot…" select, and then shows a code: "Send {code} to the line from your chat app within 10 minutes. You'll get a confirmation reply once linked." The same name for two different controls. Settings > General also has a "Messaging" card ("Manage messaging settings") that reaches the same overlay (only when messaging is enabled).
- **Notifications.** A server notification reaches `AppToaster`. If the tab is visible and focused it shows a toast; otherwise it waits 1.5 seconds, asks the server whether another tab or device already showed it, and then sends an OS notification (only if the Browser switch is on and permission is granted). Toast: bot avatar, title, relative time, up to three lines of body, an X with the accessible name "Dismiss" on hover or focus. At most three toasts show as a stacked deck with a "+N" count for the rest; hover or focus fans them out. A toast fades after 6 seconds (the timer pauses on hover or focus) and fading does not mark it seen; clicking it opens its link and marks only that thread (or that one notification) seen. Failures for the bot whose chat is open are skipped, because the chat already shows the error. With "Hide amounts" on, money in the title and body is masked.
- **Notifications settings** (Settings > General, "Notifications"): switches "Browser" (disabled with "Blocked in browser settings" or "Not supported here"), "Phone" (only if a phone is registered), "iMessage" (only if an iMessage endpoint exists). Turning "Browser" on asks the browser for permission first.
- **Run status in chat.** While a bot waits on a tool, the working indicator can read "Still waiting on {service}". After a failed run: "Last run failed." / "Last run failed: {note}", or for a scheduled run "Scheduled run failed." / "Scheduled run failed: {note}".

---

## STORY-APP-365: Find the Tools tiles and read what each one does
**Type**: short
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, who runs meetings through Granola and wonders whether her bot can see them.
**Goal**: Locate Granola, Box, Devin and Wispr Flow on the Integrations page and tell them apart.
**Preconditions**: Signed in as the deployment owner on a stack where none of the first-party servers is connected. App catalog is set up.
**Ideal path**: 2 — open Integrations, type the app name in "Search apps"; scrolling to "Tools" is the same count if she knows where it is.
**Alternate paths**: `/app/integrations?connect=granola` opens the Granola sign-in directly (used by other pages). `/app/integrations?q=granola` fills the search box. The category chips "Docs & files" (Box, Granola, Wispr Flow) and "Developer" (Treg, Devin) narrow the list.
### Steps
1. Click "Connect apps" (or "Integrations") in the sidebar → the page headed "Integrations" loads; skeleton tiles show until everything has loaded.
2. Maya scrolls past "Popular" and "Finance" → section titles "Social", "Equity", "Tools" appear; "Tools" holds Treg, Devin, Box, Granola, Wispr Flow.
3. She reads each tile's second line → "Coding sessions and repo docs" (Devin), "Search and read files and folders" (Box), "Meeting notes and transcripts" (Granola), "Notetaker meetings, notes and tasks" (Wispr Flow). Maya hesitates between Granola and Wispr Flow because both say "meetings"; the tile text does not say which app records the meeting.
4. She clicks the "Docs & files" chip → only Box, Granola and Wispr Flow remain among first-party tiles, with the section titles removed; the "Popular" grid also filters to Docs and files apps.
### Variations
- Type "wispr" in "Search apps": a single tile shows with no section title.
- Type "imessage" while signed in as the owner: the two iMessage tiles show in the same flat grid.
### Edge Cases
- No logo is vendored for Devin, Granola or Wispr Flow: each tile shows a letter tile instead of a mark. Box shows its mark from the Simple Icons CDN, so a walk without internet shows "B".
- A member who is not the deployment owner sees every tile except iMessage.
- The same description appears again on the connected card after connecting (STORY-03).

---

## STORY-APP-366: Connect Granola with a browser sign-in
**Type**: medium
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, hoping Praci can summarize her investor calls.
**Goal**: Connect Granola and see it listed as connected.
**Preconditions**: Granola tile visible (not connected). Browser allows pop-ups for the app. The sign-in provider is reachable (UNVERIFIED on the mock stack: the walk can stop at the sign-in window).
**Ideal path**: 3 — click "Connect Granola", click "Sign in with Granola", finish the sign-in window; the done screen then needs one more click.
**Alternate paths**: The same dialog opens from `?connect=granola`. The "Add custom connection" button with the Granola address typed in reaches a sign-in too but names the server by its address and skips the tile's wording.
### Steps
1. In "Tools", click "Connect" on the Granola tile → dialog "Connect Granola" opens. There is no description line and no URL box. Maya wonders what she is signing in to, since nothing says Granola's address or what access Praci will have.
2. Click "Sign in with Granola" → the button reads "Connecting…" briefly, then the dialog shows "Step 1 of 3", "Sign in to Granola in the new window" and "Choose the account to connect, then come back here."; a new window opens.
3. Finish the sign-in in the new window → the window closes by itself and the dialog changes to the done screen "Granola connected" with a "Done" button. (No bot-choice step: the server already has its own agent.)
4. Click "Done" → the dialog closes; the page refreshes.
5. Scroll to the top → under "Connected" a card "Granola" shows "Meeting notes and transcripts", a badge "Connected", and avatars under "Used by". The Granola tile is gone from "Tools".
### Variations
- Pop-up blocked: the dialog says "Your browser blocked the sign-in window" and "Granola was not connected" with "Open sign-in" and "Try again"; "Allow pop-ups for this site, or open the sign-in page directly."
- Maya closes the sign-in window early: the wait screen adds "If you closed the sign-in window, try again." with "Try again"; "Didn't open? Open again" re-opens it.
- Sign-in is denied: "Sign-in was denied or failed." followed by "Granola was added and shows Needs reconnect until you sign in." The card then shows "Needs reconnect" with a "Reconnect" button.
### Edge Cases
- Maya clicks "Cancel" during the wait: the dialog closes and the list refreshes; if the server row was created before sign-in started, it may still appear as "Needs reconnect" (UNVERIFIED which of the two states remains for a cancelled first sign-in).
- The wait times out: "Sign-in did not finish in time." plus the same "was added and shows Needs reconnect" sentence.

---

## STORY-APP-367: Wispr Flow connects, but its connected name looks different from the tile
**Type**: short
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, who also tried Wispr Flow for notes.
**Goal**: Connect Wispr Flow and recognize it afterwards.
**Preconditions**: Wispr Flow tile visible; sign-in available.
**Ideal path**: 3 — "Connect", "Sign in with Wispr Flow", finish sign-in.
**Alternate paths**: none found.
### Steps
1. Click "Connect" on the "Wispr Flow" tile → dialog "Connect Wispr Flow", button "Sign in with Wispr Flow".
2. Click the button and finish sign-in in the new window → the done screen appears.
3. Read the done title → it is built from the web address, so it likely reads "Wisprflow connected" (UNVERIFIED; derived from `api.wisprflow.ai`). Maya sees a different spelling from the tile she clicked and wonders whether this is the same product.
4. Click "Done" → the connected card is named the same way (it is the server's saved name) with the description "Notetaker meetings, notes and tasks" in the one-line description (looked up by address, so it still shows).
5. Click the card → the detail page `/app/integrations/mcp/{id}` shows the same name, "via MCP · api.wisprflow.ai", and "Rename".
6. Click "Rename", type "Wispr Flow", press Enter → the heading changes everywhere (card, "Used by" labels).
### Variations
- Granola, Devin, Box and Zernio come out as "Granola", "Devin", "Box", "Zernio" because their addresses carry the name as one word.
### Edge Cases
- Rename to an empty name: UNVERIFIED (not tried; likely reverts or shows "Could not rename").
- Information appears on three surfaces with the name: dialog title, card and detail heading. Only the detail page can change it.

---

## STORY-APP-368: Connect Devin with a service-user key
**Type**: medium
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: A solo technical founder who already runs Devin for her team and has a service-user key from her Devin settings.
**Goal**: Connect Devin, then reach its agent.
**Preconditions**: Devin tile visible. A fake key such as `cog_northwind_demo_0001` (not a real key; the walk will fail at the first request unless Devin is emulated; UNVERIFIED on the mock stack).
**Ideal path**: 3 — "Connect", paste the key, "Connect".
**Alternate paths**: Under "Add custom connection" > Advanced > "Token", the Devin address can take a key, but then no key hint is shown and the server is not recognized as Devin until saved (UNVERIFIED).
### Steps
1. Click "Connect" on the Devin tile → dialog "Connect Devin" with the line "An org-scoped Devin service-user key (starts with cog_)." and one field "API key". The primary button is "Connect" and is disabled. She thinks: "Is this the key from my personal account or the org?" The hint says org-scoped.
2. Paste the key into "API key" → the button enables. Text in the field is hidden (password field).
3. Press Enter (or click "Connect") → button reads "Connecting…"; no browser window opens.
4. The dialog changes to "Devin connected" with "Done" → Devin needs its own agent, which the server creates, so no bot-choice step shows.
5. Click "Done" → under "Connected" there is a "Devin" card with "Coding sessions and repo docs".
6. Click the card → detail page with an "Agent" section: the agent name (a link), a writes switch, and "Share with all agents". Maya reads the hint "Off: the agent only reads. On: it can also make changes, and asks you before each one."
### Variations
- Wrong key: the dialog stays on the form with a red line "Could not add the connection" or the server's reason (UNVERIFIED which text; the add itself succeeds and the key is tried on first use).
- Empty key: "Connect" stays disabled; Enter does nothing.
### Edge Cases
- Devin has `requiresAgent`: if the agent is archived (see `new-integration-agents.md` STORY-APP-389), no bot can use Devin, and the detail page shows "Create agent".
- Information about writes appears on the Agent section and in the agent's own chat. Devin session start and message actions always ask for approval, even with the writes switch off? UNVERIFIED: the preset forces them to be writes; whether they are blocked with the switch off rather than asked is not settled by the UI code.

---

## STORY-APP-369: Connect Box using your own Box app
**Type**: medium
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, who keeps contracts in Box and has admin access to create a Box app.
**Goal**: Sign Praci in to Box.
**Preconditions**: Box tile visible. Maya has made a Box app (Client ID `northwind-box-demo-client`) and pasted the callback URL there. Fake values only.
**Ideal path**: 4 — "Connect", type Client ID, "Sign in with Box", finish sign-in. The callback URL has to be copied to Box first, which is outside Praci.
**Alternate paths**: The Data room "Import" menu also reaches Box (see the Data room topic); it needs this connection first.
### Steps
1. Click "Connect" on the Box tile → dialog "Connect Box" shows "Callback URL" (read-only box), "Copy", the line "Create an app in Box's developer settings with this callback URL.", "Client ID" and "Client secret (optional)". "Sign in with Box" is disabled and "Enter a Client ID to sign in." is shown. Maya hesitates: creating a Box app is a larger task than she expected, and the dialog does not link to Box's docs.
2. Click "Copy" under the callback URL → the button reads "Copied" for a moment.
3. (Outside Praci) She pastes the callback URL into her Box app.
4. Type `northwind-box-demo-client` into "Client ID" → "Sign in with Box" enables and the hint line disappears.
5. Leave "Client secret (optional)" empty or fill it → no validation either way.
6. Click "Sign in with Box" → wait screen "Sign in to Box in the new window" opens a window.
7. Approve in Box → "Box connected" with "Done".
8. Click "Done" → "Box" card under "Connected": "Search and read files and folders", badge "Connected".
### Variations
- A wrong Client ID: the sign-in window shows Box's error; the dialog reports "Sign-in was denied or failed." plus the "shows Needs reconnect" sentence. The detail page then offers "Reconnect", which asks for the client again.
- Box signed in with no secret: depends on the Box app type (UNVERIFIED).
### Edge Cases
- The callback URL is built from the address of the page Maya is on (`/mcp/oauth/callback`). If she opens Praci at a different address (for example `localhost` instead of her tunnel address) the URL changes; the one she pasted into Box then no longer matches.
- Box scope is fixed in code (`BOX_OAUTH_SCOPE`); the dialog does not show it.

---

## STORY-APP-370: Connect Zernio, then see the one name on several surfaces
**Type**: short
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: A solo technical founder who posts for her company on social media.
**Goal**: Connect Zernio and locate where its bot access is shown.
**Preconditions**: Zernio tile visible under "Social".
**Ideal path**: 3 — "Connect", "Sign in with Zernio", finish sign-in.
**Alternate paths**: none found.
### Steps
1. In "Social", click "Connect" on "Zernio" ("Post and schedule to social accounts") → dialog "Connect Zernio"; its mark loads from the app's own `/logos/zernio.svg`, so it shows even offline.
2. Click "Sign in with Zernio" and finish sign-in → "Zernio connected".
3. Click "Done" → the "Zernio" card shows under "Connected".
4. Open the card → detail page; "Used by" avatars show which bots can post.
### Variations
- Zernio is also named in the GTM plan docs; no GTM page exists in the app (see discovery), so only the connection is testable.
### Edge Cases
- X sits next to Zernio and asks for a Client ID like Box; Zernio does not. A founder connecting both meets two different dialogs in the same section.

---

## STORY-APP-371: Set up iMessage over BlueBubbles, end to end
**Type**: long
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: The deployment owner on the desktop app: Maya, who runs Praci on her office Mac and keeps an old MacBook running BlueBubbles at home.
**Goal**: Get her agents answering over iMessage, linked to her personal chat.
**Preconditions**: Signed in as the deployment owner. Messaging enabled on the server. BlueBubbles server running on a private address such as `http://192.168.1.20:1234` (fake). No iMessage provider configured yet.
**Ideal path**: 8 — "Connect", fill URL and password, "Save", copy the webhook address into BlueBubbles, restart the server, pick a bot and "Link a chat app", send the code. The restart and the BlueBubbles settings are outside the UI.
**Alternate paths**: Photon tile (STORY-08) as a hosted option. The Settings > General "Messaging" card reaches the link step but not the server setup.
### Steps
1. Open `/app/integrations` and scroll to the end of the grid → a "Chat" heading with two tiles, "iMessage (Photon)" and "iMessage (BlueBubbles)". Neither has a status. She picks BlueBubbles because her Mac is the one with Messages.
2. Click "Connect" on "iMessage (BlueBubbles)" → dialog titled "iMessage (BlueBubbles)". Fields "Server URL", "Server password", "Webhook token". Under them "Paste this into BlueBubbles" with the webhook address and "Copy".
3. Type `http://192.168.1.20:1234` into "Server URL" → no warning (private address).
4. Type the server password into "Server password" → hidden.
5. Click "Test connection" → it is disabled because nothing is saved yet; she notices this and does not know why. (She must "Save" first.)
6. Click "Save" → "Saved" appears in green and, in orange, "Restart the Praci server to start using iMessage." The "Cancel" button now says "Done". The secret fields change to "Server password: Saved" with "Replace".
7. Click "Copy" beside the webhook address → "Copied".
8. (Outside Praci) In BlueBubbles, paste the webhook address.
9. Click "Test connection" → "Testing…" then green "Connected" (or a red reason; STORY variations).
10. Click "Done" → back on the page; the BlueBubbles tile now reads "Needs a server restart" in orange.
11. (Outside Praci) Restart the Praci server. On the desktop app this means quitting and reopening it (UNVERIFIED: no in-app restart control was found).
12. Reload `/app/integrations` → the tile now reads "Connected" in green, with a "Link a chat app" button and an "Edit" button.
13. Click "Link a chat app" → the "Messaging" overlay opens with sections "Chat apps", "Channels", "Agent connections", "Team conversations".
14. In "Choose a bot…" pick the bot "Chief"; click "Link a chat app" → text: "Send {code} to the line from your chat app within 10 minutes. You'll get a confirmation reply once linked."
15. Send the code from her phone's Messages → within a minute she gets a confirmation reply; the overlay lists the linked chat with "Unlink". (UNVERIFIED on mock stack: needs a real BlueBubbles.)
16. Open Settings > General > "Notifications" → a new "iMessage" switch is present (it only shows once an iMessage endpoint exists), on by default.
### Variations
- A public address such as `https://bb.northwind.example.test`: an orange note appears while she types, "Anyone who can reach this address can talk to your Mac's server. Use a private network or a tunnel." She can still save.
- She skips the restart and links anyway: the tile still says "Needs a server restart", so "Link a chat app" is not offered on the tile.
- A server-set value (environment variable) shows "Set by server" with a disabled field in place of an input.
### Edge Cases
- The server URL is saved even when the password box is left empty; the password field is not required, so a first Save with no password is allowed (UNVERIFIED how the server answers).
- The restart notice is shown in three places: dialog after Save, dialog whenever configured but not active, and the tile status text.
- The same names "Link a chat app" appear on the tile (ghost button) and in the overlay (primary button).

---

## STORY-APP-372: Photon setup, Test connection failure, and Replace a secret
**Type**: medium
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: The deployment owner on the desktop app, a solo technical founder trying the hosted Photon option.
**Goal**: Save Photon credentials, find out the test fails, correct them.
**Preconditions**: Owner signed in. Fake values: Project ID `northwind-demo-project`, a placeholder secret.
**Ideal path**: 4 — "Connect", fill three required fields, "Save", "Test connection".
**Alternate paths**: none found for Photon.
### Steps
1. Click "Connect" on "iMessage (Photon)" ("Chat with your agents over iMessage") → dialog "iMessage (Photon)" with "Project ID", "Project secret", "Webhook signing secret", "Address" (optional), and "Paste this into Photon" with a webhook address and "Copy".
2. Fill "Project ID" with `northwind-demo-project`, a secret in "Project secret", a secret in "Webhook signing secret" → no checks yet.
3. Click "Save" → "Saved" and "Restart the Praci server to start using iMessage."
4. Click "Test connection" → "Testing…"; it fails with a red line (the real reason depends on the server; UNVERIFIED text), or after 10 seconds "No response from the server. Check the address."
5. Notice "Project secret: Saved" with a "Replace" button. Click "Replace Project secret" (accessible name) → the input appears empty.
6. Type a new secret and click "Save" → "Saved". Fields she did not touch keep their old values (empty inputs are not sent).
7. Click "Test connection" again → green "Connected" or the same red failure.
8. Click "Done" → tile says "Needs a server restart".
### Variations
- Close with "Done" without testing: nothing forces a test; only the tile status tells her it is not live.
- Pressing Enter in a field submits the form as "Save".
### Edge Cases
- "Test connection" is disabled while the dialog is busy (during Save or while testing) and for a provider that was never configured.
- On Save error a red line shows the server's message; the dialog stays open and fields keep their values.

---

## STORY-APP-373: A member looks for iMessage and does not find it
**Type**: short
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Jordan, a Northwind Robotics teammate (not the deployment owner) who wants iMessage alerts.
**Goal**: Turn on iMessage for himself.
**Preconditions**: Signed in as a member. Deployment owner has configured and restarted iMessage.
**Ideal path**: UNVERIFIED — he cannot start from the tiles; the only visible path is Settings > General.
**Alternate paths**: Settings > General > "Messaging" > "Manage messaging settings" (if messaging is enabled) lets him link his own chat.
### Steps
1. Open `/app/integrations` and search "imessage" → no iMessage tile and no "Chat" heading; the page shows "No apps match." or other matches.
2. Open Settings > General > "Messaging" → "Manage messaging settings" opens the overlay.
3. Choose a bot and click "Link a chat app" → a code appears with the 10 minute instruction.
4. After linking, open Settings > General > "Notifications" → the "iMessage" switch is now present and on.
### Variations
- Messaging disabled on the server: the "Messaging" card is missing.
### Edge Cases
- The tiles are the only place setup lives, so a member has no hint that the owner must set it up first.

---

## STORY-APP-374: Toasts stack, fan out, and open the right place
**Type**: medium
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, working in the Inbox while two agents finish background work.
**Goal**: Notice and open three attention notifications without losing the page she is on.
**Preconditions**: App tab visible and focused. Three notifications of kind "attention" arrive within a few seconds (a scheduled run finishes, an approval is needed, a message from a bot). UNVERIFIED how to trigger these on the mock stack.
**Ideal path**: 1 — click the front toast to open its link.
**Alternate paths**: The sidebar dot/glance for the same bot (STORY-11); the bot's chat page.
### Steps
1. Keep working in the Inbox → a toast slides up from the bottom right above the composer area: bot avatar, title, relative time ("now"), up to three lines of body.
2. Two more arrive → a stack of up to three sheets; the older ones peek out behind the front toast. If more than three exist, "+N" shows above the stack.
3. Hover the stack → sheets fan out into a column; the fade timer pauses.
4. Hover one toast → an X "Dismiss" shows on its top right.
5. Click the front toast body → the app goes to its link (the bot's chat or a card) and the toast closes; only that thread's notification is marked seen.
6. Leave the other toasts → after about 6 seconds each fades by itself; they are not marked seen, so the sidebar still shows them (STORY-11).
### Variations
- Phone width: the stack is centred at the bottom.
- With "Hide amounts" on, any dollar figure in the title or body shows masked.
- The Browser switch is on but the tab is hidden: after 1.5 seconds an OS notification shows instead, unless another device already showed it.
### Edge Cases
- A run fails for the bot whose chat Maya has open: no toast; the red error above the composer is the only signal.
- Clicking the "Dismiss" X closes the toast without opening the link (and without marking it seen: UNVERIFIED; code path of the X only closes).
- The same event can appear as toast, sidebar dot, glance value and Notifications settings channel; they are separate channels with separate switches.

---

## STORY-APP-375: Notification switches: Browser blocked, Phone and iMessage only when they exist
**Type**: short
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, who dismissed the browser's permission prompt once.
**Goal**: Understand why "Browser" is off and cannot be turned on.
**Preconditions**: Browser permission is "denied" for the app address; no phone registered; no iMessage endpoint.
**Ideal path**: 2 — open Settings > General; read the line beside "Browser".
**Alternate paths**: none found.
### Steps
1. Open Settings > General and scroll to "Notifications" → one row: a disabled switch "Browser" with "Blocked in browser settings". "Phone" and "iMessage" rows are absent.
2. She tries to click the switch → nothing happens (disabled). She thinks: "Where do I fix this?" The line points to the browser, not to Praci, and gives no steps.
3. (Outside Praci) She allows notifications for the site in the browser and reloads → the switch is enabled.
4. Click "Browser" → the browser asks for permission; allow → the switch turns on and the choice is saved.
### Variations
- Permission unsupported (some embedded views): the line reads "Not supported here".
- A phone is registered through the mobile app: a "Phone" row appears.
- After STORY-07, an "iMessage" row appears.
### Edge Cases
- Failure to save shows a red line under "Notifications" with the server's message and leaves the switch where it was.
- Turning "Browser" off needs no permission.

---

## STORY-APP-376: Chat run statuses: "Still waiting on {service}" and the failed-run line
**Type**: medium
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, asking her bot to pull her last Granola meeting while a scheduled routine fails in the background.
**Goal**: Know whether the bot is stuck, and why a scheduled run failed.
**Preconditions**: Granola connected (STORY-02) and assigned to the bot. A tool call to Granola is slow (UNVERIFIED how to cause this on a mock stack). A repeating schedule exists that will fail (for example its tool is disconnected).
**Ideal path**: 1 — open the bot's chat and read the status line.
**Alternate paths**: The sidebar glance and toasts (STORY-10) announce the failure without opening the chat.
### Steps
1. Open the bot's chat and send "What did we decide in last Tuesday's board call?" → the working indicator shows a tool phrase while the call runs.
2. The Granola call is slow → after a while the indicator adds "Still waiting on Granola". Maya hesitates: she cannot cancel the wait from this line; she can only wait or send a new message (UNVERIFIED whether a stop button is present in this state).
3. The answer arrives → the status line clears.
4. Open the bot whose scheduled run failed → under the last message, a red line "Scheduled run failed: {note}" (or "Scheduled run failed." with no note).
5. Open a different bot whose manual message failed → "Last run failed: {note}" or "Last run failed.".
### Variations
- The service name comes from the tool's service (Granola) or the run phase waiting on a service (for example Gmail).
### Edge Cases
- The failed line only shows when the bot is not running; a retry clears it.
- The same failure also reaches a toast unless that bot's chat is already open.

---

## STORY-APP-017: Remove a first-party connection and watch the tile return (folded into the existing story of this id, updated 2026-10-20)
**Type**: short
**Topic**: connections-first-party-tiles-and-imessage
**Persona**: Maya, first-time founder of Northwind Robotics, who decides she does not need Wispr Flow after all.
**Goal**: Remove it cleanly.
**Preconditions**: Wispr Flow connected (STORY-03).
**Ideal path**: 3 — open the card, "Remove {name}", confirm.
**Alternate paths**: "Disconnect sign-in" only removes the sign-in; the server stays and shows "Needs reconnect".
### Steps
1. Click the connected card → detail page.
2. Click "Remove Wisprflow" (the name as saved) → dialog "Remove Wisprflow?" with "Bots lose access to the tools of Wisprflow." and "Your data in Wisprflow is not deleted.".
3. Click "Remove Wisprflow" to confirm → back on Integrations; the card is gone.
4. Scroll to "Tools" → the "Wispr Flow" tile is back (matched by address, not by name).
### Variations
- Cancel keeps the connection.
### Edge Cases
- Removal fails: red line "Could not remove".
- The agent that was created for this server stays in the sidebar unless archived separately (UNVERIFIED; see `new-integration-agents.md`).
