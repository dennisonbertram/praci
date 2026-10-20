# Errors, permissions and surfaces

Topic stories for the planned read-only Devin page. Scope: Rakazo only reads from Devin. Every step is marked [exists] (read in this repo) or [planned] (mockup or discovery only). A line starting "GAP:" means the design has no answer yet.

Evidence used: `docs/devin/ux-paths/discovery.md`, `docs/devin/mockup.html`, `apps/web/src/lib/integrations.ts` (`mcpStatus`), `apps/web/src/components/integrations/IntegrationsHome.tsx` (`McpCard`), `apps/web/src/components/integrations/McpDetail.tsx`, `apps/web/src/components/finance/ui.tsx` (`ErrorNotice`), `packages/adapters/src/remote-mcp.ts`, `packages/adapters/src/connector-safety.ts`, `apps/api/src/router.ts` (`mcp.servers.remove`), `apps/web/src/pages/ResizableSidePanel.tsx`, `apps/desktop/src/main.ts`, `apps/mobile/lib/notification-open.ts`, `docs/mobile-parity/inventory.md`.

Facts that shape these stories:

- `mcpStatus(server)` returns "reconnect" only when `oauthStatus` is "reconnect", or "none" with an unfinished sign-in. A Devin server stores a bearer key, so it has no sign-in state and always reads as "connected" on its card.
- A failed MCP call is reported as an error string with secrets removed (`sanitizeConnectorError`, for example "Could not reach mcp.devin.ai: ..."). The session is dropped so the next call reconnects. All calls have one timeout (`MCP_TIMEOUT_MS`). No code handles HTTP 429 or "Retry-After" specially.
- `ErrorNotice` shows one red line plus a "Try again" button. It has no second action.
- Removing a server (button "Remove Devin", note "Removes the connection and bot access.", confirm title "Remove Devin?") deletes the row and the stored key and archives the Devin agent.
- The agent panel docks only at 1280px and wider (`xl:`). Below that it is an overlay up to 384px wide.
- Electron sends every `window.open` and off-origin navigation with an http or https URL to the system browser (`shell.openExternal`) and drops other schemes.
- Mobile opens a notification only to the Inbox, a thread or a group thread. A link of `/app/devin` with no bot id opens nothing.

---

## STORY-501: The Devin key was revoked and the page goes quiet

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Maya, a founder who connected Devin three weeks ago and checks the Devin page every morning.
**Goal**: Find out why the page stopped updating and get it working again.
**Preconditions**: Devin connected in the current space. A workspace admin in Devin revoked the service-user key overnight. [planned] The Devin page exists.
**Ideal path**: 6 — the page names the problem and offers Reconnect, then Reconnect leads to the key dialog.

### Steps
1. Maya opens the sidebar link "Devin" [planned] → The page header shows "Devin" and "Updated 14h ago" [planned]. The table still shows last night's rows. She wonders whether Devin has had a quiet night.
2. She sees no new "Needs you" count and no sidebar dot [planned] → Nothing says the data is old except the small "Updated 14h ago". She almost closes the tab. GAP: the discovery file lists "key rejected or revoked" as a state the page has no design for, and the mockup has no stale-data banner.
3. She clicks "Ask" and types "What is Devin stuck on?" [planned] → The agent's search tool fails. The chat shows the tool error text from the connector, for example "Could not reach mcp.devin.ai: 401" with secrets removed [exists as connector behavior, shown in agent chat form planned]. She does not know whether "401" is her problem or Devin's.
4. Ideal: the page shows a red `ErrorNotice` line above the table, "Devin rejected the key. Reconnect to keep sessions up to date." with the button "Try again" [exists as a component; this copy is planned] → Stale rows stay visible under the notice.
5. She opens Integrations from the sidebar [exists] → The Devin card shows the badge "Connected" and no Reconnect button, because `mcpStatus` cannot see a bad bearer key. GAP: the card contradicts the page. A revoked Devin key never produces "Needs reconnect" today, so the existing Reconnect button is unreachable for Devin.
6. She clicks the Devin card, then pastes a new key in the dialog titled "Connect Devin" [exists via the card detail and `CustomConnectionDialog`] and presses "Connect" → Rakazo lists tools with the new key. On success the page refreshes and the notice clears.

### Variations
- She opens the Devin card first (from an email from her admin) and sees "Connected", then trusts it and stops. The page and the card disagree until a fix exists.
- She removes Devin and connects again (see STORY-507). This works today but throws away the agent thread history in the Devin agent.
- The new key is also invalid → the dialog shows "Could not connect to Devin. Check the API key and try again." [exists, covered by tests]. The old, bad row is not deleted, so the page keeps showing the notice.

### Edge Cases
- Key valid but lacks permission to read sessions: Devin may answer 403 on search while the tool list still loads. Unverified. Same GAP as step 2: the connect check lists tools, it does not read sessions, so connect succeeds and the page fails later.
- Key expires while the page is open: the next refresh turns the notice on without a reload. GAP: whether a refresh is automatic is undecided (open question 5).
- Maya is away: she gets no notification that the key broke. GAP: needs-you pushes silently stop, which looks like "nothing needs me".

---

## STORY-502: Devin's MCP server is down or slow

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Ravi, a CTO opening the Devin page during a Devin incident.
**Goal**: See whatever is still known and judge whether to wait.
**Preconditions**: Devin connected. Devin's MCP endpoint is timing out. [planned] The Devin page exists.
**Ideal path**: 4 — open the page, see the old rows with a clear notice, retry once, leave.

### Steps
1. Ravi opens "Devin" in the sidebar [planned] → Rows from the last good load appear with "Updated 9m ago" [planned]. For a first load with no earlier data, a skeleton shows [planned, Legal uses `Skeleton`].
2. The refresh runs and waits for the single connector timeout [exists as `MCP_TIMEOUT_MS`] → He watches a skeleton or spinner. GAP: the timeout value is not stated in the design, and nothing says how long a page load may wait. The discovery file warns that `devin_session_gather` can block up to 590 seconds and must not be used for page loads.
3. The call fails → An `ErrorNotice` appears with the sanitized message, for example "Could not reach mcp.devin.ai" and the button "Try again" [exists as component and message, placement planned]. Old rows stay visible.
4. He clicks "Try again" [exists] → The fetch runs again. It fails again, the notice stays. He decides to check Devin's own status page. The "Open Devin" icon button in the header [planned] is his shortcut. GAP: its target is undefined (open question 8).

### Variations
- First ever load fails: no stale rows exist, so the page shows only the notice and an empty table area. GAP: no empty-versus-error wording is defined.
- Slow but successful: the page shows data after 20 seconds. "Updated 1m ago" is true only after the call completes, so it should not move early. GAP: the refresh indicator is not designed.
- He asks the agent instead of waiting. The agent tool fails the same way, so the chat shows the same error. He sees the problem in two places (page notice and chat) with possibly different wording. GAP: no rule that the two messages match.

### Edge Cases
- The connector drops its session on a thrown call and reconnects on the next call [exists], so "Try again" does a fresh connection, not a retry on a dead one.
- Partial network: the call succeeds but returns an empty string. Treated as "no sessions", which would wrongly show the empty state during an incident. GAP.
- The Devin agent is working on a user request while the page refreshes. Both use the same server connection. Unverified.

---

## STORY-503: Devin answers 429 (rate limited)

**Type**: short
**Topic**: Errors, permissions and surfaces
**Persona**: Ravi, who refreshes the page repeatedly while waiting for a pull request.
**Goal**: Understand why the page stopped refreshing and when to try again.
**Preconditions**: Devin connected. Ravi (or other tools using the same org key) has exhausted Devin's request limit. [planned] The Devin page exists.
**Ideal path**: 3 — see a plain "try later" notice, wait, retry once.

### Steps
1. Ravi clicks the page's refresh action, or reopens the page several times in a minute [planned; there is no refresh button in the mockup] → The call returns 429. GAP: code has no 429 or "Retry-After" handling. The user would see the raw sanitized error string, for example "Streamable HTTP error: 429", which means nothing to him.
2. He sees an `ErrorNotice` with that text and "Try again" [exists as component] → He clicks "Try again" immediately, which sends another request and keeps the limit exhausted.
3. Ideal: the page waits and shows older rows with "Updated 6m ago". "Try again" is disabled until the wait ends [planned]. GAP: no cooldown behavior is designed.

### Variations
- The limit is shared by the whole org key. Another teammate's connection or a Devin Slack bot may be using it, so Ravi has done nothing wrong. GAP: no copy explains this.
- The agent hits the limit mid-answer: the chat shows a failed tool row and a short apology from the model. The model may retry in a loop. GAP: no retry cap for the Devin read tools is stated here.
- Background polling for needs-you hits 429 for many users at once. GAP: no poller design exists (open question 5).

### Edge Cases
- A 429 on only the message-read call: the "Needs you" rows lose their question subtitles but keep the status badge. Matches the "question text unavailable" state in the discovery file [planned].
- The user closes and reopens the page to "fix" it, doubling the requests.

---

## STORY-504: Tool output cannot be parsed (partial data)

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Hana, a founder who just connected Devin and opens the page for the first time after Devin changed its tool output wording.
**Goal**: See as much as possible, and know what is missing.
**Preconditions**: Devin connected. All Devin MCP tools return one text string. The parser fails on some rows or some fields. [planned] The Devin page exists.
**Ideal path**: 3 — the page shows the rows it could read, marks the rest, and offers the agent for the missing detail.

### Steps
1. Hana opens "Devin" [planned] → The page parses the text from `devin_session_search`. Eight rows parse. Two do not.
2. She sees eight rows and a header count that says "Needs you 1" [planned] → She assumes this is complete. GAP: nothing tells her that two sessions were skipped, so the tiles can be wrong without any warning. The discovery file marks the output format as Unverified.
3. Ideal: a one-line notice under the tiles, "2 sessions could not be read." with "Ask" to open the agent [planned, new copy that needs the AGENTS.md copy justification] → She clicks "Ask" and types "List all sessions". The model reads the raw text itself, which is more tolerant than the table parser.

### Variations
- A single field fails (the PR list). The row shows "—" in Pull request, which already means "no PR" in the mockup. GAP: the page cannot tell "no PR" from "PR unreadable".
- The status text does not match any known value. The badge should not claim "Working". GAP: no "Unknown" badge exists in the mockup list (Needs you, Working, Finished, Error, Suspended).
- The ACU number is unreadable. The "ACUs this week" tile would undercount. GAP: no rule to show a dash or a plus sign on a partial total.
- Over 100 sessions: the first page shows 100 and the tiles cover only those. GAP: no "showing the latest 100" wording is designed (discovery lists "truncated or over-100 session list").

### Edge Cases
- The question text of a Needs-you row is cut off by Devin ("truncated body"). The subtitle should end cleanly. [planned]
- The response contains text that looks like an instruction. The page renders it as plain text, not as a command. The agent receives it as tool output, which is untrusted.
- A row has no title: the row needs a fallback label. GAP.

---

## STORY-505: Out of ACUs, sessions suspend

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Maya, a founder who sees several sessions marked "Suspended" and one "Needs you".
**Goal**: Learn that Devin stopped because the credit balance ran out, and know where to fix it.
**Preconditions**: Devin connected. The org ran out of ACUs, so Devin suspended running sessions (status detail "out_of_credits"). The status mapping is Unverified. [planned] The Devin page exists.
**Ideal path**: 5 — see Suspended rows, ask the agent why, follow the link to Devin to add credits, return, see Working.

### Steps
1. Maya opens "Devin" [planned] → Three rows show the grey badge "Suspended" and "Working 0" [planned]. She thinks "did someone pause these on purpose?" because "Suspended" can also mean a user pause, and the mockup's "Rewrite onboarding copy" row has the same badge.
2. She hovers the badge → GAP: no tooltip or detail text is designed, so the page cannot say "out of credits".
3. She clicks "Ask" and types "Why are my sessions suspended?" [planned] → The agent searches sessions [exists tool `devin_session_search`], reads the status detail, and answers "Three sessions are suspended because the organization is out of ACUs." with an "Open in Devin" link [planned]. This is the only place the reason can be learned.
4. She clicks "Open in Devin" → It opens in a new tab on the web, or in the system browser in Electron (STORY-508). She adds credits on Devin's billing page. Rakazo does not change anything in Devin (read-only scope).
5. She returns and refreshes the page [planned] → The rows go back to "Working" as Devin resumes them, or stay "Suspended" until someone resumes them in Devin. GAP: whether Devin resumes sessions automatically after credits return is not known.

### Variations
- Two weeks later, "ACUs this week" shows a number but gives no hint that the balance is low. GAP: balance is not a field the search tool returns, so the page cannot warn before the cliff.
- A "Needs you" row is also suspended. The row can show only one status. Which badge wins is undefined. GAP.
- Maya asks "How many ACUs do we have left?". The agent has no tool for balance (the read tools are `devin_session_search`, `devin_session_events`, `devin_session_gather`, `ask_question`, `read_wiki_*`, `list_available_repos`, `devin_list_integrations`). It should say it cannot see the balance. Unverified how Devin answers.

### Edge Cases
- Sessions that suspended for other reasons (idle, user pause) look identical. The mapping from `status_detail` is not confirmed.
- No notification fires when sessions suspend, because only "needs you" produces one. GAP: out-of-credits is a state a founder wants to hear about, and no one has decided whether it pushes.

---

## STORY-506: A teammate in the same space opens the Devin page

**Type**: long
**Topic**: Errors, permissions and surfaces
**Persona**: Tom, a cofounder in the same Rakazo space as Maya. Maya connected Devin. Tom has not.
**Goal**: See what Devin is doing for the company.
**Preconditions**: Maya's `McpServer` for Devin exists, scoped to her user and the space. Tom has no Devin server row. Tom's Devin account is in the same Devin org as Maya's.
**Ideal path**: 5 — Tom sees "Connect Devin", asks Maya for a key or creates one, connects, sees the same org sessions.

### Steps
1. Tom sees "Devin" in his sidebar [planned] → The link is there because Pages are the same for every member. GAP: whether it shows before connection is open question 13.
2. He clicks it → The page shows the title "Devin" and one button, "Connect Devin" [planned, in the mockup]. He assumes it is broken, because Maya told him "Devin is set up". GAP: nothing says that a teammate already connected it; Rakazo connections are per user (`McpServer` is scoped by space and user).
3. He opens Integrations [exists] → The Devin tile shows "Coding sessions and repo docs" and no "Connected" badge for him. He cannot see Maya's connection. This is consistent with private-by-user, but it surprises him.
4. He clicks the tile → The dialog "Connect Devin" asks for an "API key" with the hint "An org-scoped Devin service-user key (starts with cog_)." [exists]. He does not have one. He messages Maya.
5. Maya sends the key through chat → The key is pasted into the dialog. Pasting a shared key into a chat is a leak risk. GAP: no guidance on creating a separate service-user key per person, and no mention of a shared-connection option (open question 4).
6. Tom presses "Connect" [exists] → Rakazo lists tools. On success, Tom's own "Devin agent" bot is created ("Your Devin account"), and his page opens [exists for the bot, page planned].
7. Tom sees the table → It shows sessions from the whole org, including ones Maya started in Slack and ones other people started. GAP: "From" shows only the origin (Slack, Linear, Web, API). There is no name, and no label that says "all sessions in your Devin org". Tom cannot tell which are his.

### Variations
- Tom never connects. He still gets no "needs you" notification, since the connector is the recipient. Only Maya hears about a session that waits on him. GAP: open question 5.
- A third teammate, Priya, belongs to the space but not to the Devin org. A key from outside the org shows nothing, and nothing in the product tells her why.
- Maya disconnects (STORY-507). Tom's page and agent are unaffected, because they are separate rows.
- Tom is a member of two spaces and connected only in one. The other space shows "Connect Devin" again.

### Edge Cases
- An outside collaborator (a contractor, a shared bot) can read Maya's agent thread if the thread is shared. Whether the Devin agent thread can be shared is not defined. GAP.
- Session titles may expose confidential work, such as "Prepare layoffs spreadsheet export", to any member who connects with any org key. The privacy question is open question 3.
- Maya connects the key of a different Devin org than Tom's. Both see their own org. No label names the org. GAP.

---

## STORY-507: Disconnecting Devin from Integrations

**Type**: medium
**Topic**: Errors, permissions and surfaces
**Persona**: Maya, ending the Devin contract.
**Goal**: Remove Devin and understand what happens to the page, the agent and her data.
**Preconditions**: Devin connected, the Devin page used for weeks, the Devin agent has chat history.
**Ideal path**: 5 — open the card, Remove, confirm, land on Integrations, check that the page shows Connect Devin.

### Steps
1. Maya opens Integrations and clicks the Devin card [exists] → The detail page at `/app/integrations/mcp/<id>` opens.
2. She scrolls to the red button "Remove Devin" next to the note "Removes the connection and bot access." [exists] → She clicks it.
3. A confirm dialog titled "Remove Devin?" appears with the line "Bots lose access to the tools of Devin." [exists] → She reads it. She wonders whether sessions in Devin are deleted (they are not; Rakazo only reads). GAP: the dialog does not say the Devin account and its sessions are untouched, nor that the Devin agent is archived.
4. She presses "Remove Devin" [exists] → The server row and the stored key are deleted, the Devin agent is archived and unpinned, and she lands on `/app/integrations` [exists in `mcp.servers.remove`].
5. She goes back to the Devin sidebar link [planned] → The page shows "Connect Devin" only [planned]. GAP: the sidebar link and the docked agent panel are not defined for this state. If the page was open in another tab, it keeps showing old rows until a refresh or its next call fails.

### Variations
- She removes the key in Devin first, then in Rakazo: same result as STORY-501 followed by this story.
- She wants only to pause: there is no disable toggle in the flow described here. GAP: the row has an `enabled` field but no Devin-specific control is designed.
- She reconnects later with a new key: a new Devin agent is created. The earlier chat history belongs to the archived agent. GAP: archived Devin agent threads are not linked from the new one.
- A pending "needs you" notification remains in the notifications list. Its link goes to `/app/devin`, which now shows "Connect Devin". GAP.

### Edge Cases
- Remove fails (network): the dialog shows the "Could not remove" error text [exists].
- The page is open in Electron and mobile at once. Mobile has no Devin page, so only the push stops [see STORY-508].
- Teammates' connections (STORY-506) are not affected.

---

## STORY-508: Narrow windows, Electron links and the phone

**Type**: long
**Topic**: Errors, permissions and surfaces
**Persona**: Ravi, who uses the Electron desktop app on a small laptop window, then the phone.
**Goal**: Work with the Devin page at a smaller width, open sessions in Devin, and react to a "needs you" alert away from his desk.
**Preconditions**: Devin connected. Two sessions need a decision. [planned] The Devin page and a "needs you" notification exist.
**Ideal path**: 7 — notification on phone, open the Devin agent thread, read the question, open it in Devin from the phone browser, answer there.

### Steps
1. Ravi's laptop window is 1180px wide. He opens "Devin" [planned] → The agent panel does not dock; below 1280px it is an overlay up to 384px wide (`ResizableSidePanel`). The table and four tiles use the full width. GAP: the six-column table needs a narrow layout. Legal collapses to one list item per row; the Devin mockup is drawn only for 1280px and wider.
2. He clicks "Ask" [planned] → The panel slides over the right side of the table and covers the "ACUs" and "Updated" columns. He cannot see both the table and the answer. He closes it with the panel's close control to see the rows again.
3. At 900px the sidebar becomes a drawer [exists in Shell]. He opens the drawer, clicks "Devin" → The page is full width. GAP: the table must become a list, and the two-line Needs-you row (title plus question) must wrap without cutting off text.
4. He clicks the session title or "Open in Devin" [planned] in the Electron app → The link has target="_blank" and an https address. Electron's window-open handler sends it to the system browser through `shell.openExternal`, and denies a new Electron window [exists]. The app stays on the Devin page.
5. Devin's page asks him to sign in, since Electron's own session is separate from his default browser. This is normal for the system browser. Unverified: the exact Devin URL shape (open question 7).
6. Later he is away. His phone shows a push, "needs you" [planned]. He taps it → Mobile reads `botId`, `threadId` or `link`. If the payload carries the Devin agent's bot id, the Devin agent thread opens [exists as the generic thread route]. If it carries only `/app/devin`, nothing opens: mobile has no Devin screen, and the tap only marks the "devin" surface as seen [exists, `notificationOpenTarget` returns null for this link]. GAP: the design must say that the push carries the bot id, or it dead-ends.
7. In the thread he types "What is Devin stuck on?" [planned] → The agent replies with the question text and an "Open in Devin" link. He taps it and the phone browser opens Devin. He answers there. The page on mobile does not exist: no table, no tiles, no sidebar dot. `agent-page.tsx` shows only blocks a bot publishes, and the Devin agent publishes none. GAP: nothing says whether mobile is "web only for now" or gets a native list (open question 11; `docs/mobile-parity/inventory.md` lists Legal and Cap table as MISSING).

### Variations
- Web in a normal browser: the same link opens a new tab. In Electron the link goes to the system browser, not an Electron tab. A user who expected a tab inside the app may think nothing happened if the browser opens behind the app.
- A non-http link (for example `mailto:` in session text) is dropped by `safeExternalUrl` in Electron and does nothing. [exists]
- The panel is already open at 1300px (docked) and Ravi shrinks the window to 1100px. The panel turns into an overlay on top of the table. His saved width (`rakazo:right-panel-width`) is ignored under 1280px.
- Ravi's phone is in another space. The mobile tap switches space first only for page links, not for threads; threads switch space themselves [exists].
- He turns the phone push off for the Devin agent in the bot's notification setting [exists, "silence notifications"] and gets no more alerts at all. GAP: that setting silences the agent, and the page sidebar dot (web only) still shows.

### Edge Cases
- Duplicate information: the "needs you" count appears in the sidebar dot, the Needs you tile, the notification and the agent's answer. If they are computed at different times, they can disagree for a minute. GAP: no single source of truth is named.
- A very long session title wraps three lines in a narrow list and pushes the status badge off the row.
- Dark mode: all of this must work in both themes (the mockup has the toggle).
- Screen reader: the dot has the label "2 need you" in the mockup. The overlay panel needs focus handling when it opens over the page. [planned]
