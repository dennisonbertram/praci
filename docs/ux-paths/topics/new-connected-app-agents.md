# New: connected-app agents and Carta on the shared Agent controls

Code read only, from `AppDetail.tsx`, `IntegrationAgentSection.tsx`, `McpDetail.tsx`, `apps/api/src/carta-agent.ts`, `docs/integration-agents/README.md` ("Connected apps", "Carta"), `carta-manual-checklist.md`, and migration `20261028000000_carta_integration_agent`. No story was walked in a browser. Behavior marked UNVERIFIED comes from code, not from a running app.

## Walk preconditions (mock demo stack)

- **Notion is not seeded or emulated.** `seed.ts` and `data.ts` mention no Notion. The only connected apps (Composio) are two Gmail emulator accounts (`connections/begin` with `GMAIL`; a "sales" account is the second one). Coinbase is a Finance exchange connection, not an Integrations app. STORY-APP-391 to 4 are written for Notion. On the demo stack, walk them on the Gmail "Sales" app page, or add a Notion fixture to the Composio emulator first. Whether the Gmail row offers the same "Create agent" button is UNVERIFIED: the button shows for any connected account without an agent (`AppDetail.tsx`), and no Gmail exception was seen in the code.
- **Carta is seeded** as "Carta (MOCK DEMO)" on `CARTA_MCP_ENDPOINT`, signed in with a mock login, plus the Carta agent (`carta/agent`) and a mock cap table (unless `DEMO_NO_MODEL=1`). Its tools answer from the emulator, `demoCarta()`, which exposes only read tools. A write (`mutate` / `call_tool`) can be approved in the UI but the emulator's result is UNVERIFIED.
- The demo is built by calling the API, not by running the migration, so the migrated defaults (agent linked, Only this agent on, Allow changes off) are read from the code defaults. Check them on screen.
- Sending mail needs the Gmail emulator and a configured model. The Carta agent keeps the Gmail and Drive tools.

## Where the app page and the MCP page differ (redundancy and consistency signal)

| Concept | App page (Notion, `AppDetail`) | MCP page (Carta, `McpDetail`) |
|---|---|---|
| Create agent | Button inside each **account row**, beside Rename (per account) | Button in the top **action row**, beside Reconnect and Rename (per server) |
| Agent section | `IntegrationAgentSection` is nested inside the account row | Same component, but a top-level block under the action row |
| Heading order | Accounts (with Agent) then **Used by** is replaced by Agent for that account, then Tools | Agent, then **Used by** (always shown) |
| "Used by" when exclusive | Not shown for a linked account: the Agent section replaces it | Still shown, but listing only the agent (`usedBy` filters to `agentBotId`) |
| Tools list | Read / Write groups ("Never changes your account" / "Changes your account") | None on the MCP page |
| Remove | **Disconnect {app}** plus per-account **Remove account** | **Remove {server}** plus **Disconnect sign-in** |
| Service word | App name or account display name when there are several accounts | "Carta" for Carta, otherwise the server name |
| Confirm title | "Allow changes in {account name}?" | "Allow changes in {service}?" |
| Confirm body | "The agent will be able to change your {name} data. It asks before each change." | Carta: "The Carta agent will be able to change your Carta data. It asks before each change." |
| Extra | None | Carta only: **Open Cap table** button |

The Agent section text is identical on both pages: heading **Agent**, link to the agent, switch **Allow changes in {service}** ("Off: the agent only reads. On: it can also make changes, and asks you before each one."), switch **Only this agent** ("Other agents ask the {service} agent instead of using {service} themselves.").

---

## STORY-APP-391: Create a Notion agent and read its default state
**Type**: medium
**Topic**: Connected-app agents (Composio app page)
**Persona**: Maya, founder of the mock company, who connected Notion to keep company notes and wants one assistant that handles it.
**Goal**: Give Notion its own agent and understand what that agent can do before she turns anything on.
**Preconditions**: A connected Notion account on Integrations. NOT seeded on the demo stack (see top). Substitute the Gmail "Sales" account or add a Notion emulator fixture. The account status is connected with no "Signed out" note.
**Ideal path**: 4 steps. Open the app, click Create agent, land on the agent, read the defaults. Create agent also navigates to the agent, so there is no separate "open" step.
**Alternate paths**: Create the agent from the agent list instead (no known path, UNVERIFIED). Come back later through the app page: the Agent section now shows the link.

### Steps
1. Open Integrations, then the Notion card → the app page shows the Notion logo, a status badge, a description, **Accounts**, **Used by**, and **Tools · N**.
2. In the account row, find **Rename**, **Create agent** and (only with 2+ accounts) **Remove account** → three outline buttons. Hesitation: Maya has not met the word "agent" yet and the button has no hint of what it makes.
3. Click **Create agent** → the button is disabled while busy, then the app navigates to `/app/{botId}`, the new agent's chat. UNVERIFIED: the chat's greeting and name (the page falls back to "Notion agent").
4. Go back to Integrations → Notion → the account row now shows an **Agent** heading and card with the agent name as a link, switch **Allow changes in Notion** (off), switch **Only this agent** (hint: "Other agents ask the Notion agent instead of using Notion themselves."). The **Create agent** button is gone from the row.
5. Read the hint under the first switch: "Off: the agent only reads. On: it can also make changes, and asks you before each one." → the default is read-only.
6. Look for **Used by** → for this account it is replaced by the Agent section (the section only appears when no linked agent exists). Per the README, a new agent has changes off and shared access (Only this agent off) UNVERIFIED in the UI: check which state the switch shows.
7. Scroll to **Tools** → Read group ("Never changes your account") and Write group ("Changes your account"). Hesitation: these lists describe the Notion app, not the agent, so Maya cannot tell which tools the agent actually has.

### Variations
- Two Notion accounts: the **Allow changes in {account name}** label uses the account's display name, and each account gets its own agent and its own Create agent button.
- Click Create agent twice quickly: the button is disabled while busy and the spawn key `integration-agent:<connectionId>` makes it idempotent (README).
- Disconnected or signed-out account (`needsReconnect`): Create agent is hidden; the Agent switches are disabled.

### Edge Cases
- Create fails (server error): inline red text "Could not create agent" (or the server message).
- Archive the agent from its chat: per README, the link is released and the connection returns to shared, read-only defaults, so the app page shows **Used by** and **Create agent** again.
- On the MCP page the same step is a top-row button, not an account-row button (see table).

---

## STORY-APP-392: Allow changes in Notion and approve one write
**Type**: long
**Topic**: Connected-app agents, write approval
**Persona**: Maya, wants the agent to add a page for the weekly update.
**Goal**: Turn on changes safely and approve one single change.
**Preconditions**: STORY-APP-391 done; Notion agent exists with changes off. A model is configured.
**Ideal path**: 7 steps: switch, confirm, ask, read the card, approve, check the result, optionally switch off. The confirmation and the approval card are both required, so none can be dropped.
**Alternate paths**: Ask for a change first while changes are off; the agent should say it cannot write. Turn changes off while an approval is pending.

### Steps
1. On the Notion app page, in the Agent card, click the switch **Allow changes in Notion** → a dialog titled "Allow changes in {account name}?" opens (the account's display name, not "Notion", for a single account too) with one bullet: "The agent will be able to change your {account name} data. It asks before each change." and buttons Cancel / **Allow changes**.
2. Click **Allow changes** → the dialog closes and the switch is on. Hesitation: if the page title is "Notion" and the dialog says "work@acme.com" (the display name), Maya may think it is another service.
3. Open the Notion agent and ask "Add a page called Weekly update" → the agent proposes a write.
4. An approval card appears with the tool name and arguments → it waits for Maya. Per README it appears even if Auto Review or a saved "Always allow" rule would otherwise cover it.
5. Click the approve control (label UNVERIFIED) → the write runs and the agent reports the result.
6. Ask for a second change → a second approval card appears; the first approval did not carry over.
7. Back on the app page, turn **Allow changes in Notion** off → no confirmation is shown, the switch goes off at once, and a later write attempt is blocked.

### Variations
- Deny the card: nothing changes and the agent says so.
- Turn changes off while a card is pending, then approve: dispatch rechecks the connection and the call must fail (README), with an error shown in the chat (wording UNVERIFIED).
- Read-only request ("What is on my Roadmap page?") needs no approval and works with changes off.

### Edge Cases
- Tool with no read-only classification: treated as a write, so a harmless-looking lookup could still ask for approval. Maya sees an approval card for something that sounds like reading.
- Setting call fails: red text "Could not update changes"; the switch returns to its old value after refresh.
- Switches are disabled while another update runs (`busy`).

---

## STORY-APP-393: "Only this agent" versus the "Used by" list
**Type**: medium
**Topic**: Connected-app agents, sharing
**Persona**: Maya, who also has a general assistant and the Inbox agent.
**Goal**: Make Notion usable only through its own agent, then undo that.
**Preconditions**: A Notion account with an agent (STORY-APP-391), plus at least two other bots in Agents.
**Ideal path**: 3 steps for the exclusive switch round trip: on, check, off. Used by is not part of the linked-account page, so Maya cannot do this from Used by.
**Alternate paths**: Before creating the agent, use the **Used by** toggles to assign Notion to specific bots (the original flow).

### Steps
1. Before creating an agent, scroll to **Used by** on the Notion page → a list of agents with a toggle each (AgentToggleList). Switch one off; the change saves ("Could not update bot access" on failure).
2. Click **Create agent** (STORY-APP-391) → the row now shows the Agent card, and **Used by** disappears from that row (for the linked account). The other bots' access is kept but is ignored by the agent.
3. Turn on **Only this agent** → the switch is on; per README, access becomes `allAgents = false` plus one row for the agent. Ask the general assistant "What is in Notion?" → it should ask the Notion agent rather than reading Notion itself.
4. Turn **Only this agent** off → previous sharing is restored exactly (nothing was deleted). Open Used by in this state: there is none on this page for the linked account. Maya must find out who has access some other way. This is a gap.
5. Compare with the MCP page for Carta: **Used by** stays visible under the Agent section and, when exclusive, lists only the agent (`usedBy` filter).

### Variations
- A second, unlinked Notion account: its row keeps a **Used by** list while the first has the Agent card. Within one app page, two accounts use different controls for the same idea.
- With `hasAgentAccount` true and a connected row without an agent, the row shows **Used by** with a note-free list; the page-level Used by is hidden.

### Edge Cases
- Even when Only this agent is off, another bot may only use read tools (README rule 5). The UI does not say so; Maya may expect shared bots to write when they have access.
- Error text "Could not update access".
- Redundancy: **Only this agent** and the **Used by** toggles both control who can use the app. On the app page they replace each other; on the MCP page they coexist.

---

## STORY-CAP-006: Carta page Agent section and its defaults (folded into the existing story of this id, updated 2026-10-20)
**Type**: short
**Topic**: Carta on the shared Agent controls
**Persona**: Maya, who connected Carta for the Cap Table.
**Goal**: Find out who handles Carta and whether anyone can change anything.
**Preconditions**: Carta connected (seeded in the demo: "Carta (MOCK DEMO)") and the Carta agent exists. The migrated defaults are agent linked, **Only this agent** on, **Allow changes in Carta** off (migration and checklist step 3). On a fresh demo seed the same defaults should hold; verify on screen.
**Ideal path**: 2 steps. Open Integrations then Carta; the Agent card is visible without scrolling.
**Alternate paths**: Via the Cap table page link, or the agent's chat.

### Steps
1. Open Integrations → Carta (MOCK DEMO) → the header shows the Carta logo, a status badge (no "via MCP · host" text for Carta), and buttons **Open Cap table**, **Reconnect**, **Disconnect sign-in**, **Rename**. **Create agent** is absent because the agent is linked.
2. Read the **Agent** section → the link shows the Carta agent's name, **Allow changes in Carta** off ("Off: the agent only reads..."), **Only this agent** on.
3. Scroll to **Used by** → because the agent is exclusive, only the Carta agent is listed. Other agents are hidden, not switched off (rows preserved by the migration).
4. Click **Open Cap table** → the Cap Table page opens (the mock cap table in the demo).
5. Click the agent name link → `/app/{botId}`, the Carta agent chat.

### Variations
- With `DEMO_NO_MODEL=1` the cap table has never been read; the page may show an empty state.
- A Carta server with no linked agent (migration missed it): **Create agent** shows in the action row and creates the specialized Carta agent, not a generic one (README, checklist step 3).
- Edit the server's endpoint: the agent link is released and changes go off (router logic around `agentBotId: null`).

### Edge Cases
- Removing the server: the dialog says "The Carta agent loses access to Carta."
- Hesitation: a founder may not know why another agent is missing from Used by.
- Consistency: Used by is under the Agent card here but absent on app pages for the same state (see table).

---

## STORY-CAP-027: Turn on Carta changes and read the confirmation (folded into the existing story of this id, updated 2026-10-20)
**Type**: short
**Topic**: Carta writes, consent
**Persona**: Maya, who wants the agent to prepare an option grant.
**Goal**: Enable changes in Carta consciously.
**Preconditions**: STORY-CAP-006. Mock Carta emulator exposes read tools only, so writes are not testable end to end. UNVERIFIED.
**Ideal path**: 2 steps: click the switch, click **Allow changes**.
**Alternate paths**: Cancel; or ask the agent for a change first and let it tell her to use the switch.

### Steps
1. Click the **Allow changes in Carta** switch → dialog "Allow changes in Carta?" with one bullet: "The Carta agent will be able to change your Carta data. It asks before each change." and buttons Cancel / **Allow changes**.
2. Click **Allow changes** → the dialog closes; the switch is on. Failure shows "Could not update changes".
3. Open the Carta agent and ask for an option grant → the agent proposes a call via `mutate` or `call_tool` (the two write entry points). Each shows an approval card with the full tool name and arguments (checklist step 5).
4. Deny it → nothing changes in Carta. Approve a second one only if intended; each write asks again.
5. Turn the switch off → no dialog, effective at once.

### Variations
- Before turning it on, ask the agent for a change: the agent's prompt tells it to say changes are off and to point to "Allow changes in Carta" under Integrations, Carta.
- Re-running the cap table refresh leaves the switch unchanged (checklist step 7).

### Edge Cases
- Reconnecting or re-adding the server does not silently re-enable writes (checklist step 8).
- Copy difference: Carta's dialog says "Carta agent" and the generic one says "The agent"; titles use the same "Allow changes in {service}?" pattern, but on app pages {service} is the account's display name.
- A new tool that Carta advertises is not allowed automatically, even when marked read-only (checklist note).

---

## STORY-APP-394: The Carta agent sends an investor email, one approval per message
**Type**: long
**Topic**: Carta agent, outbound mail approval
**Persona**: Maya, wants to send the quarterly investor update.
**Goal**: Have the agent draft and send an investor update, and see exactly what will go out.
**Preconditions**: Carta connected with the agent; Gmail emulator connected; model configured. Changes in Carta can stay off (email is separate). The demo has the Safe/finance data for runway (`finance_*` tools) and an auditor confirmation request for the audit-response skill.
**Ideal path**: 6 steps: ask, review the draft, ask to send, read the approval card, approve, ask for a second email and approve again. Every message needs its own approval, so the second approval cannot be skipped.
**Alternate paths**: Ask for a draft only; Deny; edit then re-approve.

### Steps
1. In the Carta agent chat, type "Draft the Q3 investor update" → the agent reads the cap table and contacts, uses the carta-investor-update skill, and the `finance_*` tools for cash, burn and runway, and writes a draft. Anything it lacks is marked "TBD" (prompt rule).
2. Read the draft → a Gmail draft or message text in chat. A draft ID alone does not authorize sending (checklist step 6).
3. Type "Send it to the investors" → the agent issues a send call with full to, cc, bcc, subject and body; an approval card shows those exact fields.
4. Read the card → the recipients (including cc/bcc), subject and the complete body are visible. Hesitation: a long body may need scrolling.
5. Approve → the email goes through the Gmail emulator; the agent confirms. Check the Inbox's Sent view (UNVERIFIED).
6. Ask "Send the same note to our auditor" → a new approval card appears; the previous approval does not cover it.
7. Deny the second card → no mail is sent.

### Variations
- Audit request: the agent drafts a reply from the auditor's confirmation request; it never signs in DocuSign and tells Maya what needs her signature.
- Auto Review or a saved allow rule on: sending still asks (UNVERIFIED for mail; the README states it for app writes).
- Another agent messages the Carta agent about an investor: the Carta agent answers from Carta; it does not send mail on that agent's behalf without approval.

### Edge Cases
- Gmail not connected: the send fails; the agent's message wording is UNVERIFIED.
- Changes in Carta off does not block email, and email approval does not need that switch. This split may surprise Maya: "Allow changes in Carta" says nothing about sending mail.
- Edit the body after the card shows: the approval must be for the exact message; a changed body should produce a new card (UNVERIFIED).

---

## STORY-APP-395: Compare the two Agent pages for one concept
**Type**: short
**Topic**: Consistency across app page and MCP page
**Persona**: Maya, a founder who sees both a Carta page and a Notion page.
**Goal**: Do the same thing (give the app an agent, read its safety settings) on two pages and not be confused.
**Preconditions**: A connected app account (Gmail "Sales" account on the demo) and Carta (seeded).
**Ideal path**: 4 steps: open each page, find Create agent / Agent section, compare. Ideal is that the two pages place and name these things the same way.
**Alternate paths**: n/a

### Steps
1. Open the app page for the connected account → Create agent is in the account row; Agent section is inside the row.
2. Open Carta → the Agent section sits under the top action row; Create agent is in the action row.
3. Compare the Used by list → Carta keeps it under the Agent card (agent only when exclusive); the app page replaces it by the Agent card.
4. Compare the confirmation titles → "Allow changes in {account display name}?" versus "Allow changes in Carta?".

### Variations
- One app with 2+ accounts: labels use account names, so the Agent card heading is the same "Agent" for each, with no sign of which account (UNVERIFIED if the account name appears elsewhere in the row).

### Edge Cases
- The words "agent", "changes", and "Only this agent" are shared; "Used by" and "Tools" are not. A founder cannot learn one page and apply it to the other.
