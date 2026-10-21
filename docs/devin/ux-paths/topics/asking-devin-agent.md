# Topic: Asking the Devin agent

Labels: [exists] means read in this repo. [planned] means only in `docs/devin/mockup.html` or the discovery doc. [unverified] means nobody has observed it. All names, repos and numbers are invented (mockup data).

Scope rule: Rakazo is read-only toward Devin. Only the Devin agent talks to Devin. The agent is created with `writesEnabled: false`; Devin write tools stay hidden from it until the user turns on "Allow changes in Devin" on the Integrations detail page (`apps/web/src/components/integrations/IntegrationAgentSection.tsx`) [exists]. When changes are on, `devin_session_create` and `devin_session_interact` (and the three manage tools) always show an approval card [exists, `packages/contracts/src/devin.ts`, `packages/adapters/src/executor.ts` ~3062].

Evidence note for STORY-303: the filter that hides write tools when `writesEnabled` is false is at `executor.ts` ~1683 (`readOnly === true || current.writesEnabled`) and `mcp-connector.ts` ~143 (`"writes-off"`). That `devin_session_interact` is classified a write today (even for get/get_messages) is in `devin.ts`. What the agent says in reply is [unverified]: nobody has run it.

## STORY-301: Ask what Devin is stuck on from the page

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Maya, a founder who connected Devin last week and sees "2 need you" on the sidebar dot.
**Goal**: Find out in plain words what Devin is waiting for, without opening Devin.
**Preconditions**: Devin connected, Devin agent exists, a model is configured, the Devin page shows two Needs you rows (Add CSV export for invoices, Upgrade Prisma to 6.x). Panel closed, window 1440px wide.
**Ideal path**: 3 — click Ask (panel opens), type or pick the question, read the answer. The table already shows the question text under each Needs you row, so the true minimum for this goal is 0 clicks (read the table); the agent path is for people who want the answer in a sentence.
**Alternate paths**:
- A. Read the question text under the title in the Needs you rows of the table (0 clicks, [planned]; depends on the open question that `get_messages` is a forced write today, so this subtitle may not exist).
- B. Click the row title, which opens the session in Devin (external).
- C. Click the "Needs you" tile [planned; whether the tile filters the table is not drawn].
- D. Open the Devin agent as a normal bot thread from the bot list, then ask there (full screen, no table beside it) [exists once the bot exists].
- E. Use the "Open in Devin" link in the agent's answer.
Duplicated information: the same question text appears in the table subtitle and in the agent's reply; the session list appears in the table and in the agent's search step.
### Steps
1. Maya sees "Devin" in the sidebar with a dot and thinks "2 need me, but what do they want?" She clicks it → the page loads with tiles (Needs you 2, Working 2, PRs open 3, ACUs this week 41.6) and the table. [planned]
2. She glances at the two Needs you rows. The subtitle under "Add CSV export for invoices" reads "Should the export keep the legacy CSV column order?" She hesitates: is that the whole question, or cut off? → no way to expand in the table. [planned] GAP: the mockup subtitle is single-line with ellipsis; there is no designed way to see the full message besides opening Devin or asking the agent.
3. She clicks "Ask" in the page header → the docked "Devin agent" panel opens at 384px on the right. [planned button; the docked-panel pattern exists for Legal and Cap table in `Shell.tsx`]
4. The panel shows the composer "Message Devin agent" (and, per the open question, maybe suggestions). She types "What is Devin stuck on?" and sends → the thread shows her message with a timestamp. [exists: thread; planned: Devin copy]
5. While the agent works she sees a collapsed activity line, then "Done · 2 tools · 4s" with "Searched Devin sessions" and "Read Devin messages ×2". → read-only tool steps render. [planned in mockup; the step labels come from `humanizeToolName`, exact Devin labels unverified]
6. The reply lists both sessions with one sentence each and an "Open in Devin" link per session. She thinks "good, that matches the table" and clicks the link for Prisma → the session opens in Devin in the system browser (Electron: via the app opener). [planned]
7. She closes the panel (collapse button) → table returns to full width; the sidebar dot is unchanged because the session still needs her answer in Devin. [exists: collapse; dot behavior planned]
### Variations
- Asking the same thing by a suggestion chip instead of typing (if the Devin panel gets suggestions; [unverified] — the Carta and Data room panels pass `suggestions`, Legal does not).
- Window narrower than 1280px: the panel overlays the page instead of docking (see STORY-304).
- Panel already open: the Ask button is hidden (Legal passes `onAskAgent` only when the panel is closed). [exists as a pattern]
### Edge Cases
- Reading Devin's last message needs `devin_session_interact` get_messages, a forced write today. With changes off the agent cannot call it, so the reply may say it can see titles and status but not the question text. GAP: no designed fallback wording or UI for "I can see the session needs you but cannot read what it asks".
- With changes on, each message read would show an approval card (see STORY-303), turning a read question into two approvals. GAP: unresolved until the gate is split into read and write paths.
- Devin returns more than 100 sessions: the agent sees only the first page. GAP: no statement of how the agent says "I only looked at the latest 100".

## STORY-302: Ask about history across a repo and a week

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Jonas, an engineering lead who wants a Friday summary.
**Goal**: Learn what Devin did on acme/api this week and what was merged today.
**Preconditions**: Same as STORY-301; sessions with PRs `acme/api#212` (open), `acme/api#215` (open), `acme/web#418` (merged), `acme/mobile#97` (open).
**Ideal path**: 3 — Ask, type the question, read the answer; the page table cannot be filtered by repo, so the agent is the only direct route.
**Alternate paths**:
- A. Scan the table's "Pull request" column by eye for "acme/api#" (the table has no repo filter or search field in the mockup). Works only if the list is short.
- B. Ask "Anything merged today?" instead; the table shows "merged" next to acme/web#418 so a user can also spot it by eye.
- C. Use the "PRs open" tile for the open count only; it says nothing about merged.
- D. Open Devin itself and use its own filters (external).
Duplicated information: PR state appears in the table's Pull request column, in the "PRs open" tile, and in the agent's answer.
### Steps
1. Jonas has the page open and opens the panel with Ask → panel docks. [planned]
2. He types "What did Devin do on acme/api this week?" He wonders if "this week" means the last seven days or since Monday. → the agent decides; the page and the agent may use different windows from the "ACUs this week" tile. GAP: "this week" has no single definition (open question 6 in discovery), so the tile and the agent can disagree.
3. The agent runs "Searched Devin sessions" (read) → the step line shows the tool and a duration. The search tool has no repo field, so repo is inferred from PR URLs. [exists as research fact; agent behavior unverified]
4. The reply lists sessions that have an `acme/api` PR (Upgrade Prisma to 6.x, `acme/api#212` open; Add pagination to the audit log API, `acme/api#215` open) and says sessions without a PR cannot be matched to a repo. → Jonas thinks "what about sessions with no PR yet?" and asks a follow-up. GAP: no designed way for the agent to flag "could not tell the repo".
5. He asks "Anything merged today?" → one step "Searched Devin sessions", reply "One pull request: acme/web#418, the flaky invoice export test fix." [planned, from the mockup]
6. He compares with the table: Fix flaky invoice export test shows "merged" and "2h ago" → consistent. He is mildly annoyed that he could have read it there. Note for design: the second question duplicates what the table shows.
### Variations
- Same question after a refresh with new data: the agent searches again; the table shows "Updated 1m ago" and the answer may be newer than the table. GAP: no sign in the thread of how fresh its data is.
- Ask by session title ("What is the state of Bump Expo SDK?"): agent matches by title; same read steps.
### Edge Cases
- Zero matches ("What did Devin do on acme/billing this week?"): the agent says it found no sessions. [unverified wording]
- Merged state comes from the PR list text `url[state]` in the search result [exists as research]; if state is missing the agent cannot say merged.
- Question names a person ("What did Priya ask Devin?"): research found only an opaque `user_id`, no names. GAP: the agent cannot answer by person and has no designed way to say so.

## STORY-303: Ask the agent to tell Devin something (write request)

**Type**: long
**Topic**: Asking the Devin agent
**Persona**: Maya again, answering the CSV question without leaving Rakazo.
**Goal**: Tell the "Add CSV export for invoices" session to keep the legacy CSV column order.
**Preconditions**: Devin connected, agent exists, model set. Case A: "Allow changes in Devin" is off (the default, `writesEnabled: false`). Case B: the user turned it on.
**Ideal path**: Case B: 5 — Ask, type request, read the approval card, click "Allow once", read the confirmation. Case A: not achievable in Rakazo; the right path is the Open in Devin link (2 clicks: Ask answer link, answer in Devin).
**Alternate paths**:
- A. Click the session title or "Open in Devin" and answer in Devin directly (works in all cases and is the scope-consistent route: the page itself never sends).
- B. Answer in Slack where the session was started (origin "Slack" in the From column) [outside Rakazo].
- C. Another bot asks the Devin agent to send it (see STORY-305); still lands on the same approval card.
Duplicated information: the approval card repeats the session id and the message text the user typed; the agent's reply repeats the card outcome.
### Steps
1. Maya reads the question under the session in the table, decides "yes, keep legacy order", and opens the panel with Ask. [planned]
2. She types "Tell Devin to keep the CSV order" and hesitates over wording: should she name the session? She does not. → the agent has to pick the session; it likely searches and finds "Add CSV export for invoices". [unverified]
3. Case A (changes off): the write tool is not offered to the agent (filtered when `writesEnabled` is false). The agent can only explain. The `devin-sessions` skill tells it to say she can turn on "Allow changes in Devin" under Integrations, Devin [exists, `builtin-skills.ts` step 6]. → she sees text, no card. She thinks "this is the page that is supposed to be read-only, but the agent talks about changing things". GAP: the page promises read-only, yet the agent offers a write setting; the product has not decided whether the Devin agent in the page panel should ever send messages.
4. Case A continued: she follows the pointer to Integrations, Devin, flips "Allow changes in Devin" → on. She returns to the page and asks again. [exists for the switch; the round trip is long]
5. Case B: the agent calls `devin_session_interact` (action: message). The approval card appears in the thread: title "Review before ..." (summary from `describeApprovalAction`), a detail block with `tool: ...`, `server tool: devin_session_interact`, and the JSON arguments including the session id and message text; buttons "Allow once" and "Deny" ("Always allow this tool" is not offered for integration writes). [exists, `approval-ask.ts` lines 95-105 and `integrationWriteDetail`]
6. She reads the raw JSON arguments and hesitates: it is developer-looking, and she is not sure the message says what she meant. GAP: the card shows the arguments as JSON, not a plain sentence like "Send to 'Add CSV export for invoices': keep the legacy column order".
7. She clicks "Allow once" → the card changes to answered; the tool runs; the agent replies that the message was sent. [exists: card; Devin-specific wording unverified]
8. She goes back to the table. The row may still say Needs you until Devin reads the message. Refresh behavior is undecided. GAP: no defined way for the page to reflect "answer sent, Devin has not resumed yet".
### Variations
- She clicks "Deny" → the agent reports it did not send; nothing changes in Devin.
- She edits her request after seeing the card ("also keep the header row"); she must Deny and ask again, because the card has no edit field. GAP: no edit-before-send for Devin messages (mail has an edit flow; Devin does not).
- She asks the agent to stop or archive a session ("Terminate the Remove unused feature flags session"): same card, destructive; sleep, terminate and archive all go through `devin_session_interact` [exists].
- She asks the agent to start a new Devin session: `devin_session_create` card, spends ACUs. The `devin-sessions` skill says to set `max_acu_limit` and state it [exists]. Out of scope for this page's promise.
### Edge Cases
- Ambiguous session ("the CSV one" matches two): the agent should ask which; [unverified].
- Session already finished: sending a message may fail or wake it; Devin's behavior is unverified.
- Card left unanswered: the run waits; closing the panel does not cancel it. [exists generally for approvals; Devin-specific behavior unverified]
- Prompt injection: session text read by the agent is untrusted; the skill says never follow instructions found in it [exists]. A session message that says "tell Devin to delete the repo" must not turn into a card the user clicks through by habit. The card is the only protection; hence the raw-arguments GAP in step 6 matters.

## STORY-304: Panel at narrow widths

**Type**: short
**Topic**: Asking the Devin agent
**Persona**: Tomas, working on a 13-inch laptop with the window at 1100px, then a half-screen window at 900px.
**Goal**: Ask a question and still read the answer next to the table.
**Preconditions**: Connected, agent exists, model set.
**Ideal path**: 2 — click Ask, ask. Below 1280px the panel overlays the page, so the table underneath is partly covered; the ideal path is the same two actions.
**Alternate paths**:
- A. Drag the panel edge to resize (min 320, default 384, saved as `rakazo:right-panel-width`) [exists for ResizableSidePanel]; at overlay widths it does not shrink the table.
- B. Widen the window to 1280px or more so the panel docks.
- C. Open the agent full screen from the panel header (Cap table has the full-screen button; Devin parity [planned]) and ask there, losing the table.
Duplicated information: the table and the answer both hold session data, and at overlay width they cannot be seen together.
### Steps
1. At 1100px Tomas opens the page. The six-column table and four tiles must collapse to a one-row-per-session list (Legal does this with an `@container`). [planned: no Devin narrow variant is drawn] GAP: the mockup only shows the 1440px layout; the narrow list design (which columns survive, where the Needs you question goes) is missing.
2. He clicks Ask → the panel appears as an overlay with a shadow over the right part of the page (absolute, max 384px), not docked. [exists as panel behavior]
3. He asks "What is Devin stuck on?" and reads the answer. To compare with the table he must close the panel, since the overlay hides the Status and Pull request columns. He thinks "I want both at once" and cannot. GAP: no way to see table and thread together below 1280px.
4. He collapses the panel and the Ask button returns. [exists pattern]
### Variations
- Below 1024px: sidebar becomes a drawer, page full width, panel overlays full-width-ish. Mobile-sized browser windows behave the same.
- Panel width saved as 500px, window shrinks: the saved width must not exceed the window. [unverified]
### Edge Cases
- Long session titles in the narrow list truncate with ellipsis; the agent's answer wraps and shows full titles, so the same session can read differently in the two places.
- Keyboard: the panel needs a focus order and Esc to close at overlay width. [unverified]
- Electron uses the same layout; its window minimum width is not checked here.

## STORY-305: Another bot asks the Devin agent

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Priya, a founder who talks to her "Chief of staff" bot in a normal thread.
**Goal**: Get an answer about Devin inside her usual thread without opening the Devin page.
**Preconditions**: Devin connected; the Devin agent bot exists; Priya also has a general bot named "Chief of staff". The Devin server is exclusive to the Devin agent (`agentExclusive`), so Chief of staff cannot call Devin tools itself [exists, `mcp-connector.ts` "belongs-to-agent"].
**Ideal path**: 2 — ask the Chief of staff in her thread, read the reply. The Chief of staff uses `message_bot` to the Devin agent and relays the answer.
**Alternate paths**:
- A. Open the Devin page and use its panel (STORY-301); same facts, different surface.
- B. Open the Devin agent as its own thread and ask directly.
- C. Ask Chief of staff in a thread and let it say it cannot reach Devin (if the bot cannot find or message the agent).
Duplicated information: the same sessions appear in the page table, in the Devin agent's panel, and in the relayed answer in the Chief of staff thread.
### Steps
1. Priya types in the Chief of staff thread: "Is Devin blocked on anything? Tell me before my 10am." She hesitates over whether the bot can see Devin at all. → the thread shows her message.
2. The Chief of staff decides to ask the Devin agent and calls `message_bot` [exists: `packages/core/src/bot-messages.ts`; delivery is async, the sender continues]. The thread shows a tool step for sending the message. Exact label [unverified]. 
3. The Devin agent receives a request, runs read-only steps (search, read messages) and writes a final response, which is returned automatically to the sender (the system text says the final written response goes back to the requester) [exists, `bot-messages.ts` ~186].
4. The Chief of staff relays: "Two sessions need you: ..." → Priya reads it in her thread. She would like the "Open in Devin" links; whether the relayed answer keeps them depends on the bot. [unverified]
5. She thinks "was that fresh?" She cannot tell; the Devin agent's own panel on the Devin page shows no record of this exchange unless bot-to-bot messages appear in its thread. GAP: it is not specified whether a peer-bot request shows up in the Devin agent's thread or panel, or who sees the read steps.
6. If the request asks for a write ("tell Devin to keep the CSV order"), the Devin agent's approval card goes to the owner (Priya), not the requesting bot. For an owner agent, writes on a peer's request never pass on saved rules or Auto Review [exists: `OWNER_PEER_WRITE_TOOLS` in `executor.ts`, partly; confirm for Devin]. GAP: where Priya sees that card (the Devin panel, the Chief of staff thread, or a notification) is not designed.
### Variations
- Chief of staff asks at a scheduled time (a morning briefing) and includes Devin status; same path but unattended, so any write request stalls waiting for approval.
- Devin agent archived: the message cannot be delivered (see STORY-306).
### Edge Cases
- Devin agent is mid-run on another question: the message queues; reply time is longer. [unverified]
- The requesting bot pastes Devin output into other channels (email): session text is untrusted and private. GAP: no rule stated that Devin session content must not be forwarded to third parties.
- Loop risk: Devin agent replies via `message_bot` rather than its final response; the skill text says send only useful updates. [exists]

## STORY-306: No model configured, agent missing, or key problem

**Type**: medium
**Topic**: Asking the Devin agent
**Persona**: Sam, who just joined a space, connected Devin, and has not set up an AI model.
**Goal**: Understand why Ask does nothing useful and fix it.
**Preconditions**: Devin key valid. Variants: (A) no model configured (`needsModel` true); (B) Devin agent was archived or deleted so `agentBotId` is null; (C) agent creation failed; (D) the key was revoked after connecting.
**Ideal path**: 3 — click Ask, see the repair action in the panel, take it (Add a model, or Create agent / Try again). One step more for returning to the page.
**Alternate paths**:
- A. Open Settings, Models directly from the user menu instead of the panel button.
- B. Open Integrations, Devin and use the card there (reconnect).
- C. Recreate the agent by reconnecting Devin (the connect flow calls the idempotent `ensureIntegrationAgent`).
Duplicated information: the model prompt appears in the panel, in Settings, and may also appear in onboarding.
### Steps
1. Sam opens the Devin page. The table loads (reading sessions needs the Devin tools, not a model). He is told nothing is wrong. [planned]
2. He clicks Ask → the panel opens. Variant A: it shows "Add a model" in place of suggestions and the composer is disabled; the button opens Settings, Models [exists for Legal, Data room and Carta via `pageAgentNeedsModel` in `Shell.tsx`; Devin needs its own branch, planned]. He thinks "I only wanted to see what Devin is stuck on" and adds a model. GAP: table works without a model, but nothing explains that the table is live while the agent is off.
3. Variant B/C: the panel shows an error and a "Create agent" or "Try again" button (Legal "Create Legal agent", Carta "Try again") [exists as a pattern; Devin helper like `findLegalAgent` is planned]. Sam clicks → the agent is created and the panel shows the composer. If it fails again, the error text stays. GAP: the Devin panel copy for these states is not drawn in the mockup.
4. Variant D: the table's refresh fails and the agent's tool step fails with an auth error. The Integrations card shows reconnect or failed [exists]. The page has no designed state. GAP: no inline "Reconnect Devin" action on the page or in the panel.
5. After the fix he asks his question and gets an answer (STORY-301). He may try the disabled composer first and wonder why typing is blocked; the disabled state needs an accessible reason.
### Variations
- Space switch: Sam changes to another space where Devin is not connected; the page shows "Connect Devin" and the panel is absent. [planned]
- Reconnect with a new key: the agent should survive; the connection row is replaced. [unverified]
### Edge Cases
- Model configured but quota exhausted or provider error: the thread shows a run failure like any bot. [exists generally]
- Agent exists but its server link was removed: tool steps fail with "belongs-to-agent" or unknown tool. GAP: no specific user-facing message.
- Two Devin connections in one space (two users): each has its own agent; a teammate's panel shows their own agent. [exists by spawn key per server]

## STORY-307: Read-only tool steps, in detail

**Type**: short
**Topic**: Asking the Devin agent
**Persona**: Ana, a careful operator who wants to trust what the agent says.
**Goal**: See what the agent actually did to get its answer.
**Preconditions**: A completed answer from STORY-301 in the panel.
**Ideal path**: 2 — click the "Done · 2 tools · 4s" line to expand, read step labels.
**Alternate paths**:
- A. Cross-check against the table (0 clicks).
- B. Click "Open in Devin" and compare in Devin (external).
- C. Open the Devin agent full-screen thread; steps render the same.
Duplicated information: the step list repeats facts the answer text already states; the table repeats the same facts a third time.
### Steps
1. Ana sees a collapsed "Done · 2 tools · 4s" above the answer. She wonders if it touched anything. → she expands it. [planned in mockup, from the existing thread activity component]
2. She reads "Searched Devin sessions" and "Read Devin messages ×2" → both are read tools (`devin_session_search`, `devin_session_events`; `get_messages` via `devin_session_interact` if used). If the second step was `devin_session_interact`, today's gate would show a card, not a quiet step. GAP: the mockup shows a quiet "Read Devin messages", which only happens once the gate is split; until then this step would stop at an approval card.
3. She wants the raw arguments or output to verify. [unverified] whether expanding a step shows arguments for read tools.
4. Satisfied, she collapses it. No approval was requested, so she concludes nothing was changed in Devin. 
### Variations
- A long run (`devin_session_gather` blocks up to 590s): the thread would sit on a running step for minutes. The page must not use it, and the agent should avoid it for quick questions. [exists as a research fact] GAP: no designed wording for long-running steps.
- A step fails (rate limit): the line shows an error and the agent explains. [unverified]
### Edge Cases
- Step labels use human names; unknown Devin tools fall back to a humanized raw name. [exists via `humanizeToolName`]
- Screen readers: the collapsed summary needs a name that states tool count. [unverified]
