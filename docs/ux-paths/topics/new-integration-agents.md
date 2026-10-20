# Topic: Integration agents on MCP servers (Mercury, Brex)

Stories STORY-APP-383 to STORY-APP-390. Written from code and the plan only; nothing here was walked in a browser. "UNVERIFIED" marks behavior read from code or the plan that the walker must confirm.

Sources: `docs/integration-agents/README.md`, `apps/web/src/components/integrations/McpDetail.tsx`, `IntegrationAgentSection.tsx`, `apps/api/src/integration-agent.ts`, `packages/adapters/src/approval-ask.ts`, `apps/web/src/components/AskCard.tsx`, `packages/testkit/src/cli/demo/{seed,data}.ts`, `packages/adapters/src/finance-fake-tools.ts`.

## Demo preconditions (read first)

- **Mercury and Brex are seeded** in the mock demo (`seed.ts:203-228`): two connected MCP servers named "Mercury" and "Brex" with a fake stored login, plus the Finance agent. Neither has an agent yet, so the Integrations page shows **Create agent** for each.
- **Payment stories (STORY-APP-385, STORY-APP-386, STORY-APP-388 write part).** The demo's emulated Mercury serves `requestSendMoney` (`DEMO_FINANCE_TOOLS` in `data.ts`). It can also list recipients (`getRecipients`, one mock payee, "Acme (Mock)"), so a payment can name one. It records the call and returns a fake pending request (`fake-request-1`, status `pendingApproval`); no money moves. Brex has no write tool in the demo (its four demo tools are all reads), so there is no Brex write walk.
- **Chat model.** The agent answers through the demo's configured model. A scripted or mock model must be told to call `requestSendMoney` for the payment stories. UNVERIFIED: whether the demo model does so on request. If it only chats, STORY-APP-385/STORY-APP-386 stop at the dialog.
- **Other agents.** Chief and the Finance agent (created on first use) exist. The Finance agent already has read-only access to Mercury and Brex.
- **Reset note.** STORY-APP-387, STORY-APP-388 and STORY-APP-389 change shared server state (exclusive flag, archived agent). Re-seed between walks.
- **Not in scope.** Mobile has no controls for this (plan, "Mobile"). Connected apps (Notion) are a later task. Carta uses the same section but is covered by the Cap Table stories.

Persona for every story: **Maya**, founder of the mock company (Northwind Robotics). She knows what Mercury is, does not know "MCP", "agent" mechanics, or "approval".

---

## STORY-APP-383: Maya creates the Mercury agent
**Type**: short
**Topic**: Integration agents
**Persona**: Maya, wants one assistant that "just handles the bank".
**Goal**: A Mercury agent exists, its chat is open, and it is listed in the sidebar.
**Preconditions**: Mock demo as seeded. Mercury connected, no agent. Signed in.
**Ideal path**: 3 — Integrations → click the Mercury card → **Create agent**. The chat opens by itself.
**Alternate paths**: (1) Chat with Chief and ask it to "make a Mercury agent" (no known tool for that; UNVERIFIED, likely not possible). (2) Skip the agent and tick Mercury under **Used by** for an existing bot (STORY-APP-390).

### Steps
1. Opens Integrations from the sidebar. → The grid lists Mercury and Brex tiles among others.
2. Clicks the Mercury tile. → Detail page: logo, title "Mercury", status badge, "via MCP · {host}". Header buttons: **Reconnect**, **Disconnect sign-in**, **Create agent**, **Rename**. No "Agent" section yet. **Used by** lists her bots with switches. **Hesitation:** "Create agent" next to "Reconnect" does not say what the agent is for.
3. Clicks **Create agent**. → The button is disabled for a moment, then the app goes to `/app/{botId}`: the new bot's chat. Name "Mercury agent". UNVERIFIED: `route-bot.ts` holds the route for one refresh (`waiting`) when the bot list does not know the new id yet, so the thread may flash empty before the bot appears; it must not fall back to Chief.
4. Looks at the sidebar. → "Mercury agent" is in the bot list. UNVERIFIED: whether it is in the main list or a "page agents" area (the Finance, Inbox and Carta agents are special rows).
5. Goes back to Integrations → Mercury. → The **Create agent** button is gone. A section **Agent** shows a link "Mercury agent", the switch **Allow changes in Mercury** (off) with the hint "Off: the agent only reads. On: it can also make changes, and asks you before each one.", and the switch **Only this agent** (off) with "Other agents ask the Mercury agent instead of using Mercury themselves."

### Variations
- Brex: same steps, agent "Brex agent", labels say Brex.
- Phone width: the header buttons wrap; the switches stack under the link.
- Rename the server first (**Rename**, then Enter): the agent name stays "Mercury agent" (UNVERIFIED: the name is fixed at creation as "{service} agent").

### Edge Cases
- Double-click on **Create agent**: the button disables while busy; the create call is idempotent (spawn key `integration-agent:<serverId>`), so only one bot exists.
- Create fails: red text "Could not create agent" (or the server message) under the header; she stays on the page.
- Server is signed out ("needs sign-in"): Create agent is still shown; UNVERIFIED whether the agent's reads then fail with a visible error.

---

## STORY-APP-384: Maya asks the Mercury agent a read question
**Type**: short
**Topic**: Integration agents
**Persona**: Maya, wants a number without opening Mercury.
**Goal**: A correct answer from Mercury data, with no approval card.
**Preconditions**: STORY-APP-383 done. Writes off.
**Ideal path**: 2 — type the question, send.
**Alternate paths**: Ask the Finance agent the same question; it answers from the Finance data synced from Mercury (a different source, so figures may differ in freshness).

### Steps
1. In the Mercury agent chat, types "What's the balance in my checking account?" and sends. → A short wait, then a tool activity line for `getAccounts` (UNVERIFIED label), then an answer with the mock checking balance. No approval card (a read).
2. Asks "What did we spend on software last month?" → The agent calls `listTransactions` and sums. Figures should match the Finance page for the same period. **Hesitation:** none unless the answer says TBD for what it cannot find, which is by design ("write TBD where you do not have one").
3. Asks "Send $50 to Sam." with writes off. → The agent has no write tool. It says it cannot make changes and points to the Mercury page (UNVERIFIED wording). No card appears.

### Variations
- Ask Brex agent "What bills are unpaid?" (demo has one unpaid Brex bill and one pending charge).
- Ask something outside Mercury ("Summarize my inbox"). The agent has only its own server plus built-ins (no mail), so it says it cannot.

### Edge Cases
- Mock figures: the answer must carry the mock names with "(Mock)" (`data.test.ts:448`). Anything that looks like a real bank name is a defect.
- Very long transactions list: the Mercury server instructions say truncated results must be re-requested smaller; the agent may take several tool calls.

---

## STORY-APP-385: Maya turns on "Allow changes", asks for a payment, and denies it
**Type**: medium
**Topic**: Integration agents
**Persona**: Maya, wants to pay a bill by chatting but is afraid of the agent moving money.
**Goal**: See that a payment waits for her decision and that Deny stops it.
**Preconditions**: STORY-APP-383 done. Writes off.
**Ideal path**: 5 — Mercury page → turn on **Allow changes in Mercury** → **Allow changes** in the dialog → open chat → ask → **Deny**.
**Alternate paths**: (1) Ask for the payment first with writes off; the agent says it cannot (STORY-APP-384 step 3), then she turns the switch on. (2) Turn on from the Agent section of the chat's bot page (none; only the integration page has the switch).

### Steps
1. Opens Integrations → Mercury. → The Agent section shows **Allow changes in Mercury** off.
2. Clicks the switch. → A dialog titled "Allow changes in Mercury?" with the single bullet "The agent will be able to change your Mercury data. It asks before each change." and buttons **Cancel** and **Allow changes**. The switch does not move yet (it is controlled by the server state). **Hesitation:** "change your Mercury data" does not say "move money".
3. Clicks **Allow changes**. → The dialog closes and the switch is on after the page refreshes. A failure shows "Could not update changes".
4. Opens the Mercury agent chat and types "Pay Acme (Mock) $1,200 from checking." → The agent calls `requestSendMoney`. An approval card appears in the thread: text "Review before {action}" (UNVERIFIED exact summary for an MCP tool), a detail block with `tool: requestSendMoney` and the full JSON `arguments`, and buttons **Allow once** and **Deny**. There is **no "Always allow this tool"** button. **Hesitation:** the plan says the buttons are "Approve, Deny", but the code labels the first button "Allow once" (`approval-ask.ts`, `AskCard.tsx:38`). The detail is raw JSON, not a sentence with the amount.
5. Clicks **Deny**. → The card closes with a denied state. The agent replies that it did not send the payment. The fake Mercury records nothing (UNVERIFIED how to see: `sendMoneyRequests` is in memory only).

### Variations
- Leave the card pending and go to another page: the pending approval should show wherever other needs-you items show (UNVERIFIED).
- Cancel in the dialog: switch stays off, nothing changes.
- Switch on, then ask a read question: no card.

### Edge Cases
- Turn changes off while the card is pending (STORY-APP-387): Allow once afterwards should fail, because dispatch rechecks `writesEnabled` (plan, "Enforcement" 1). UNVERIFIED in the web UI.
- Saved approval rules or Auto Review for other bots must not auto-approve this call: mandatory approval skips them.
- Ask for a payment with a missing amount: the agent should ask her, not guess a figure.

---

## STORY-APP-386: Maya approves a payment
**Type**: short
**Topic**: Integration agents
**Persona**: Maya, has decided the payment is right.
**Goal**: The payment request is sent after her explicit approval and the result is clear.
**Preconditions**: STORY-APP-385 steps 1-4 done, card pending (or repeat the request after a denial).
**Ideal path**: 1 — click **Allow once**.
**Alternate paths**: Ask again after a denial; a new card appears each time (no "remember").

### Steps
1. Reads the card detail (tool `requestSendMoney`, arguments with account, recipient, amount) and clicks **Allow once**. → The card shows approved. The agent calls the fake Mercury, which returns `fake-request-1` with status `pendingApproval`. The agent tells her the request was created and is waiting (the real Mercury also needs its own approval, a second gate).
2. Asks "What is the status of that request?" → UNVERIFIED: `getTransferMoneyApprovalRequest` and `listSendMoneyApprovalRequests` are not in the demo tool list, so the agent can only repeat what it was told.
3. Asks for a second payment. → A new card appears. Approving the first did not approve the second.

### Variations
- Approve a write from Brex: not possible in the demo (no Brex write tool).
- Phone width: the card buttons wrap under the detail.

### Edge Cases
- The tool call errors after approval: the agent should say so; she has no way to retry except asking again.
- The detail block is long (a big JSON): UNVERIFIED if it scrolls; for integration writes the detail is not truncated (`fullDetail`), so a long card must still show the buttons.
- Nothing in the demo moves real money. Keep the "MOCK" label in the recipient so a screenshot can't be mistaken for a real payment.

---

## STORY-APP-387: Maya turns changes off again
**Type**: short
**Topic**: Integration agents
**Persona**: Maya, done paying bills, wants the agent read-only again.
**Goal**: Writes stop at once; no dialog needed.
**Preconditions**: STORY-APP-385 step 3 done (writes on).
**Ideal path**: 1 — click the switch.
**Alternate paths**: Remove or reconnect the server (does not reset the switch; UNVERIFIED).

### Steps
1. On the Mercury page, clicks **Allow changes in Mercury** (on). → No dialog. The switch turns off after the save. Failure: "Could not update changes". (Turning off applies at once; only turning on asks.)
2. In the agent chat asks for a payment again. → The agent says it cannot make changes. No card.
3. Reloads the Mercury page. → The switch is still off (stored on the server row).

### Variations
- Turn off while a card is pending (see STORY-APP-385 edge case).
- Turn on, off, on again: each "on" asks for confirmation again.

### Edge Cases
- Two tabs open: turning off in one leaves the other showing "on" until it refreshes (UNVERIFIED how fast).
- Slow save: the switch is disabled while `busy`, so a rapid second click is ignored.

---

## STORY-APP-388: Maya makes Mercury "Only this agent", and Chief asks the agent
**Type**: long
**Topic**: Integration agents
**Persona**: Maya, wants only one agent to touch the bank, but still wants her other assistants to be useful.
**Goal**: See that other agents lose direct Mercury access, can still get answers by messaging the Mercury agent, and that the Finance page still works.
**Preconditions**: STORY-APP-383 done. Writes can be on or off (the story works with off). The Finance agent exists and has Mercury assigned (seeded). Chief is the first bot. The write part uses the demo's `requestSendMoney`.
**Ideal path**: 3 — Mercury page → switch **Only this agent** → ask Chief a Mercury question.
**Alternate paths**: (1) Leave it shared: other agents keep read-only Mercury access (no writes, even with changes on). (2) Untick Mercury under **Used by** for each bot by hand (one bot at a time; same result for reads but writes are still not offered to non-agents).

### Steps
1. Opens Integrations → Mercury and sees **Used by** listing all her bots (Chief, helpers, Finance agent if made, Mercury agent), each with a switch. → Mercury is on for the bots that have it (Finance agent at least).
2. Clicks **Only this agent**. → It applies at once, no dialog. The switch is on. **Used by** now lists only "Mercury agent". The other rows are hidden, not deleted.
3. Asks Chief "What's our Mercury balance?" → Chief has no Mercury tools. It uses `message_bot` to the Mercury agent (UNVERIFIED that Chief knows to; the bot directory description says "Other agents: ask it with message_bot instead of using Mercury yourself"). A "child bot"/peer message card appears in Chief's chat (see STORY-APP peer messages). Chief then answers with the figure from the Mercury agent.
4. Opens the Mercury agent chat. → The peer request is in its thread. The agent answered with a read.
5. Asks Chief "Pay Acme (Mock) $1,200." (changes on). → Chief messages the Mercury agent. The Mercury agent calls `requestSendMoney`. The approval card must reach Maya: the plan says this is TBD ("confirm that a run started by `message_bot` shows its approval card to the user, not only in the agent's own thread"). **Record where the card actually appears** (Chief's thread, the Mercury agent's thread, a needs-you list, or nowhere). If it appears only in the Mercury agent's thread, Maya can't know a card is waiting. Treat that as a finding.
6. Asks the Finance agent "What's our runway?" → The Finance page and Finance agent keep working: they read synced data from Postgres, not Mercury bot access. Asking the Finance agent for a receipt or memo (needs direct Mercury tools) is denied and it asks the Mercury agent instead.
7. Opens the Finance page. → The dashboard and sync are unaffected (sync does not use bot assignments).
8. Back on the Mercury page, switches **Only this agent** off. → **Used by** lists all bots again with their previous switches. Chief can use Mercury (reads) directly again.

### Variations
- A message from Chief that tells the agent to pay with no user ask ("pay Acme now"): the agent treats it as a request, and the card still asks Maya.
- Brex: same flow; Chief asks the Brex agent about the unpaid bill.
- Duplicate the Chief bot while exclusive: the copy should not receive the Mercury assignment (plan, Authorization).

### Edge Cases
- **Hesitation:** the label "Only this agent" does not say "others stop using Mercury"; the hint under it does.
- If the Mercury agent is busy or the message fails, Chief shows an error or just says it couldn't reach it (UNVERIFIED).
- A bot that already has Mercury assigned and then the switch turns on: its row stays in the database but is denied at call time.

---

## STORY-APP-389: Maya archives the Mercury agent, then creates it again
**Type**: medium
**Topic**: Integration agents
**Persona**: Maya, cleans up her bot list, then changes her mind.
**Goal**: Archiving releases Mercury (shared, read-only); Create agent afterwards makes the same agent.
**Preconditions**: STORY-APP-383 done, ideally with writes on and Only this agent on (STORY-APP-385, STORY-APP-388) to see the reset.
**Ideal path**: 3 — archive the agent from the sidebar, open the Mercury page, click **Create agent**.
**Alternate paths**: (1) Delete the agent (from the archived list) rather than archive: the plan treats delete and archive the same (the link is cleared). (2) Remove Mercury entirely with **Remove Mercury**: the dialog says "Bots lose access to the tools of Mercury." and "Your data in Mercury is not deleted."; the agent bot is kept (it may hold history; plan TBD whether it is archived too).

### Steps
1. Finds "Mercury agent" in the sidebar and archives it (the bot's menu or settings; UNVERIFIED label and place, same as other bots). → The row leaves the list. It appears under **Archived** with **Restore** and **Delete**.
2. Opens Integrations → Mercury. → The **Agent** section is gone. **Create agent** is back. **Used by** lists all bots again (exclusive was reset to off).
3. Checks that changes are off: ask any bot for a payment. → No write tool offered. The release resets writes to off, so a new agent starts read-only. (Plan decision 8.) Nothing is left stranded behind a dead agent.
4. Clicks **Create agent**. → The app opens the new agent's chat. It is "Mercury agent" again, and the sidebar shows it once. Per the spawn key, creation is idempotent: it is the same agent identity as before (the key is `integration-agent:<serverId>`). UNVERIFIED: whether the archived bot is restored (same id and history) or a fresh bot is made; the code's second pass makes a fresh one when the old is archived. Record which one happens and whether the old chat history is visible.
5. Opens Archived in the sidebar. → The old "Mercury agent" is still there (if a fresh bot was made). If the walker sees two bots with the same name, record it.
6. Opens the Mercury page. → **Allow changes in Mercury** off, **Only this agent** off.

### Variations
- Restore the archived agent instead of Create agent: UNVERIFIED whether the server relinks. If it does not, the restored bot has the old chat but no server link; record.
- Archive while a payment card is pending: the pending call must not run (UNVERIFIED).
- Archive Brex agent, create it again: same.

### Edge Cases
- Click **Create agent** twice quickly after the release: one bot only.
- Open the Mercury page in a second tab during the archive: it still shows the old Agent section until refreshed; its switches then fail with "Could not update access" or a not-found error.
- Change the server's URL (editing the endpoint) also releases the agent and archives it (`router.ts:4736`). Not walkable from the UI unless the edit path is exposed.

---

## STORY-APP-390: Maya shares Mercury with a bot by hand instead of creating an agent
**Type**: short
**Topic**: Integration agents
**Persona**: Maya, doesn't want a new bot, just wants her Hiring helper to see transactions.
**Goal**: Know the difference between "Used by" and an agent.
**Preconditions**: Mock demo as seeded. Mercury has no agent.
**Ideal path**: 2 — Mercury page → switch Mercury on under **Used by** for the helper.
**Alternate paths**: Create the agent (STORY-APP-383) and keep it shared.

### Steps
1. Opens Integrations → Mercury, finds the helper under **Used by**, switches it on. → The switch toggles; the change saves (the page replaces the bot's whole list, keeping its other servers). Failure: "Could not update bot access".
2. Asks the helper a Mercury question. → It answers using all Mercury tools the server offers, including writes if the server has any. Without an agent there is no "Allow changes" switch and no mandatory approval card from this feature. UNVERIFIED: what normal approval the helper's writes follow (the bot's regular approval settings, including "Always allow"). **Hesitation:** this is the riskier path and nothing on the page says so.
3. Clicks **Create agent** afterwards. → The Agent section appears. Other bots (including the helper) are now read-only on Mercury because the shared mode limits non-agents to read tools (plan decision 5). UNVERIFIED: whether the helper's earlier write access ends right away.

### Variations
- Do this for Brex.
- Phone width: the Used by rows stack.

### Edge Cases
- With **Only this agent** on, the helper's row is hidden, so she can't assign Mercury to it. She needs to turn exclusive off first. There is no message saying why.
- A bot with Mercury assigned but the server later removed: the row disappears with the server.
