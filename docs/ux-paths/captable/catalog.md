## Area: Cap Table (STORY-CAP-nnn)

Generated: 2026-10-17, refreshed 2026-10-20
Scope: Cap table page (`/app/cap-table`), the Carta connection (in-place sign-in and Integrations), the Carta agent side panel, contacts, the Refresh/Reading states, Hide amounts, phone width, and how the sidebar reaches the page.
Total Stories: 40 (short 21, medium 13, long 6) as of 2026-10-20

### Refresh 2026-10-20 (features merged since 2026-10-17)

- **Added** (7): CAP-101, CAP-102, CAP-103, CAP-104, CAP-105, CAP-106, CAP-107. They sit at the end of this area under "Stories: Added 2026-10-20".
- **Rewritten in place for the current UI** (same id, new text, marked "Updated 2026-10-20"): CAP-009, CAP-011, CAP-012, CAP-013.
- **Marked with a dated note** (the UI changed; the steps below the note are the old steps and were not rewritten): CAP-014, CAP-015, CAP-017, CAP-030, CAP-010, CAP-029, CAP-031, CAP-016.
- Contacts moved to their own page (sidebar row 'Contacts'). STORY-CAP-009, 011, 012 and 013 were rewritten for it. STORY-CAP-010, 029 and 031 still describe the old tab and carry a dated note.

### Changes since the 2026-10-16 catalog

The page was rebuilt on 2026-10-16/17 (commits 26af3c67, 942a011a, f336e9fa, 7a5a0b05, 37c9108b, 7524256c and others). It now shows a real cap table, and it no longer sends the founder away to connect Carta. Most 2026-10-16 steps were wrong and are rewritten.

- **Kept (id unchanged, steps rewritten to match the code):** 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020. Every one still applies in spirit; only these premises changed:
  - 001/002: the page is no longer "just a contact list". It has a "See who owns your company" card when Carta is off, and a summary, ownership bar and holdings table when Carta is on. Nav label is "Cap table" (sentence case). Tabs persist in the URL (`?kind=`).
  - 003/004/005: "Connect Carta" opens a sign-in dialog on top of the page (`ConnectCartaDialog`, `CapTable.tsx:186-210`); it no longer navigates to Integrations. Expired sign-in shows "Reconnect Carta" with its own headline.
  - 006/007/008: there is no "Create Carta agent" button. The agent is created automatically once Carta is connected (`lib/carta-agent.ts:37-70`, `Shell.tsx:2665-2671`). The panel never opens empty and only opens while Carta is connected. The collapsed choice is now remembered per user and the panel starts collapsed on a phone. The reopen button is the shared "Ask" button (`AskBotButton.tsx`), not a "Show Carta agent" icon.
  - 011: duplicate email no longer overwrites silently. It shows "Another contact already has this email." plus an "Open <name>" button (`CapTable.tsx:355-371`).
  - 012: kind tabs are in the URL; an empty tab says "No auditors yet" with an "Add auditor" button.
  - 013: Delete now has an 8 second "Deleted <name>" toast with Undo, and a failed Undo stays until retried or dismissed.
  - 014/015/016: the agent first reads what the page already shows (`cap_table_read`), saves figures with `cap_table_update`, and `contacts_add` needs no approval card. Only `contacts_save` (changing an existing contact) shows "Save contact “…”". The table now reloads by itself when a sync ends.
  - 017: rewritten around auto sync: connect, "Reading Carta…", then the table fills in.
  - 018/019/020: skills and Gmail flows unchanged; hide-amounts, Ask panel and approval wording updated.
- **Dropped:** none. (2026-10-16 premises "the page shows no cap table" and "Create Carta agent button" were removed from 001/006; the stories remain.)
- **Added:** 021 to 033, for behaviour that did not exist before:
  - 021 Hide amounts on Cap table; 022 phone width, Carta off; 023 phone width, Carta on; 024 first read cannot start (no model); 025 Refresh from Carta; 026 cap table load failure and servers-list failure; 027 "Allow changes in Carta" switch; 028 reaching the page by search, palette and the Integrations card; 029 "Add email" on a holder; 030 founders, options and investors in the table and tabs; 031 failed Undo; 032 a sync started elsewhere (another tab); 033 long board-prep sitting with Hide amounts.

### What actually exists (read before walking)

- **The page has two modes** (`CapTable.tsx:581-875`).
  - *Carta not connected:* heading "Cap table", icon buttons Hide amounts (eye), then "Add contact" (outline button); a card titled "See who owns your company" ("Sign in to Carta again to see who owns your company" when a Carta server exists but needs sign-in) with text "Ownership comes from Carta. Connect it to see holders, the option pool and SAFEs here. The Carta agent can answer questions about them only while Carta is connected." and a "Connect Carta" ("Reconnect Carta") button; kind tabs; the contacts table. No Refresh button, no Ask button, no side panel (`CapTable.tsx:621-643`, `Shell.tsx` `cartaPanelState`).
  - *Carta connected:* header gets a Refresh (circular arrows, label "Refresh from Carta"), "Add contact" turns to the primary button, and an "Ask" button appears when the panel is collapsed and an agent exists. After the agent has saved a snapshot: company name and "Updated <relative time>", four figure cards (Fully diluted shares, Option pool available, Latest 409A, Amount raised), an ownership bar with a legend per share class, and a table with Name, Email, Kind, Shares, Ownership.
- **The table joins two sources** (`joinRows`, `CapTable.tsx:77-108`): Carta holders (matched to a contact by email), an "Unallocated pool" row right after the granted options, then contacts with no holding. Holders with no contact are plain text (not clickable). Only contact names are buttons that open "Edit contact".
- **Kinds shown:** Investor, Auditor, Other (contacts) plus Shareholder and Options for holders with no contact. A holder with no contact is classed Options if the security contains "option", Investor if it looks like SAFE/preferred/series/note/convertible/warrant, else Shareholder (`rowKind`, `CapTable.tsx:69-75`).
- **Carta is connected in place.** "Connect Carta" opens a dialog over the page, titled for Carta, with only the sign-in step (step 1 of 2) and then "Carta connected / The Carta agent can now read your cap table. / Done" (`CustomConnectionDialog.tsx:787, 815`). Integrations has a Carta tile ("Cap table, equity and investors") and a connected Carta card shows "Open Cap table" (`IntegrationsHome.tsx:146`).
- **Sign-in starts a read by itself.** When a Carta server finishes OAuth the API creates the Carta agent and queues one run that reads Carta, saves the cap table, adds investor holders as contacts and searches mail (`carta-agent.ts:16, 135-193`). With no model set up it silently does nothing (returns `no_model`).
- **Refresh** calls `rpc.carta.refresh` (needs a connected Carta server, else "Connect Carta first"; with no model, "Add a model before refreshing") and the page polls every 3 s while the run is active, every 30 s when idle and on window focus (`CapTable.tsx:505-522`). Contacts reload when a run ends.
- **The agent** ("Carta agent", spawn key `carta-agent:<userId>`) has a fixed Carta tool list, read-only unless the Carta server's "Allow changes in Carta" switch is on (then `mutate` and `call_tool` are added and each call asks first; `contracts/src/carta.ts:30-46`, `McpDetail.tsx:175-197, 254-266`). It also has `cap_table_read`, `cap_table_update`, `contacts_list`, `contacts_add` (no approval) and `contacts_save` (approval card "Save contact “<name>”", `approval-ask.ts:138`; listed in `action-approval.ts:45`). Carta tools belong to this agent alone (other bots get "Carta is used only by the Carta agent.", `router.ts:548`).
- **The side panel** (`Shell.tsx:2615-2730, 4378-4440`): header has the agent name (opens the bot's own page) and "Collapse Carta agent". An empty chat shows "The Carta agent reads your cap table from Carta and answers questions about it. Try one:" with two suggestions: "Who are our investors?" and "Draft this month's investor update". If creation fails, the panel shows the error and a "Try again" button.
- **Sidebar:** "Cap table" is a fixed page row between "Finance" and "Data room" (`Shell.tsx:3501-3510`, test id `sidebar-cap-table`). It cannot be hidden or removed: the optional "sidebar pages" feature offers only a `team-health` template, which is unavailable (`contracts/src/sidebar-pages.ts:4-13`). The sidebar search box ("Search chats") also lists app pages by name, including "Cap table" (`Shell.tsx:1788-1803`).
- **Hide amounts** (eye button in the page header; also in the account menu; saved in the browser): masks Fully diluted shares, Option pool available, Latest 409A, Amount raised, Shares and Ownership columns, the legend percentages and any dollar amount in a holding label as `•••` / `$•••` / `•••%` (`finance-format.ts:185-204`). It does not mask names, emails, share class names, or the ownership bar's segment widths. Tooltip: "Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show."
- **Not built (do not walk as features):** a pie chart (the bar is the only graphic), a "last synced" error banner, contact search on the page, bulk import, any write to Carta without the switch, routine suggestions for audit season.

### Mock demo data (seed once for the whole catalog)

Company / space name: **Northwind Robotics**. Signed-in founder: "Maya Chen" (`maya@northwind-robotics.test`), onboarding complete, a model set up unless a story says otherwise.

| Seed set | Contents |
|---|---|
| `contacts-base` | Investors: "Priya Raman", priya@sequoia-mock.test, "Sequoia Mock Capital"; "Tom Okafor", tom@lighthouse-mock.test, "Lighthouse Mock Ventures"; "Lena Fischer" (angel), lena.fischer@mock.test, no organization. Auditor: "Daniel Ortiz", dortiz@kpmg-mock.test, "KPMG Mock (auditor for Lighthouse Mock Ventures)". Other: "Sam Lee", sam@cooley-mock.test, "Cooley Mock LLP", notes "Company counsel". |
| `contacts-empty` | No contacts. |
| `carta-none` | No MCP server with a Carta endpoint. |
| `carta-connected` | Enabled MCP server with endpoint `https://mcp.app.carta.com/mcp`, OAuth status `connected`. Carta is matched by host, so the walk needs a Carta sandbox account or a stub reachable at that host. |
| `carta-needs-auth` | Same server row, enabled, OAuth expired (status not `connected`). |
| `snapshot-none` | `carta-connected` but nothing saved yet (agent has not read Carta). |
| `snapshot-fixture` | Saved snapshot: "Northwind Robotics", as of 2026-09-30; fully diluted 10,000,000; amount raised $1,050,000; option pool available 900,000; latest 409A $0.42 (2026-06-30). Share classes: Common 70%, Preferred 10%, Options 15%, SAFEs 5% (display shape only). Holders: Maya Chen (Common, 4,000,000, 40%, maya@northwind-robotics.test), Arjun Patel (Common, 3,000,000, 30%, no email), four option grants totalling 600,000 (6%), Sequoia Mock Capital (Series Seed Preferred, 1,000,000, 10%, email priya@sequoia-mock.test), Lighthouse Mock Ventures (SAFE, $500,000, no shares, email tom@lighthouse-mock.test), Lena Fischer (SAFE, $50,000, email lena.fischer@mock.test). |
| `carta-fixture` (Carta side) | Same company in Carta, plus a second context "Northwind Labs (inactive)" for `list_contexts`/`set_context`; one deliberate vesting issue (grant past cliff with no vesting event). |
| `agent-none` / `agent-exists` | No Carta agent bot, or one already created. |
| `model-none` | No model set up. |
| `gmail-connected` | 2 sent "Northwind investor update" emails (July, August 2026); 1 audit confirmation request from dortiz@kpmg-mock.test for Lighthouse Mock Ventures as of 2025-12-31 listing "SAFE $500,000"; 1 DocuSign email "Please sign: Audit confirmation – Lighthouse Mock Ventures" with no figures. |
| `finance-connected` | Cash $2.4M, monthly burn $180k. |
| `phone` | Browser width 390 x 844, touch. |

### Summary

| Type | Count |
|---|---|
| Short | 21 |
| Medium | 7 |
| Long | 5 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find the page (sidebar, search, Integrations card) | 001, 028 | no way to hide it (by design) |
| First impression, empty and disconnected states | 001, 002, 022 | none |
| Carta connection, expiry, duplicates | 003, 004, 005, 024 | none |
| Reading Carta, Refresh, polling | 004, 024, 025, 026, 032 | no "last read failed" message when a run fails after starting |
| The table (holdings, kinds, columns) | 014, 029, 030 | none |
| Hide amounts | 021, 033 | chat replies are not fully masked (documented) |
| Phone width | 022, 023 | none |
| Carta agent panel (auto create, collapse, Ask, full screen) | 006, 007, 008, 023 | none |
| Contacts CRUD, filters, undo | 009, 010, 011, 012, 013, 029, 031 | no search on page (not built) |
| Ask about holders / SAFEs / pool | 014, 015, 016 | as-of-date holdings depend on Carta `fetch` |
| Writes switch and approval | 016, 027 | an actual Carta write is not walkable without a sandbox |
| Investor update / audit skills | 018, 019, 033 | routine suggestions not built |
| Errors | 002, 005, 011, 024, 026, 031 | none |

### Story Dependency Graph

```text
STORY-CAP-001 (find Cap table) ── STORY-CAP-028 (other routes in)
├── STORY-CAP-002/022 (empty, disconnected) ── STORY-CAP-009 (add first contact) ── 010/011/012/013/031
├── STORY-CAP-003 (connect in place) ── 004 (did it work) ── 005 (expired)
│   ├── STORY-CAP-024 (no model) ── 025 (refresh)
│   └── STORY-CAP-006 (auto agent) ── 007/008/023 (panel) ── 014/015/016 ── 018/019/033 (long)
│                       └── 027 (writes switch)
├── STORY-CAP-021 (hide amounts) ── 033
├── STORY-CAP-029/030 (table rows)
└── STORY-CAP-017 (long: first visit to working setup)
```

### Stories: Finding the page and first impression

#### STORY-CAP-001: "Where do I see who owns my company?"

**Type**: short
**Topic**: Navigation
**Persona**: Maya, just finished onboarding, has never opened Cap table.
**Goal**: Find where the product keeps ownership information.
**Preconditions**: `contacts-base`, `carta-none`, `agent-none`.
**Ideal path**: 1 — one sidebar click should land on an ownership view.
**Alternate paths**: Type "cap" in the sidebar search box (see STORY-CAP-028); typing `/app/cap-table` directly.

##### Steps
1. Scan the left sidebar for anything about ownership or equity → finds "Cap table" (pie icon) after "Finance" and before "Data room" (`Shell.tsx:3501-3510`).
2. Click "Cap table" → URL `/app/cap-table`; heading "Cap table"; header has an eye icon and an outline "Add contact" button; a card "See who owns your company"; tabs All / Investors / Auditors / Other; a table of 5 people (Name, Email; Kind on a wide window). No side panel.
3. Read the card → "Ownership comes from Carta. Connect it to see holders, the option pool and SAFEs here…" with a "Connect Carta" button. **Hesitation:** Maya does not know what Carta is or whether her company uses it; the text assumes she does. She also expects to see percentages and instead sees five names she did not type, if the account was seeded.
4. Look for share counts → none until Carta is connected. This now matches what the card says.

##### Variations
- Phone width: the sidebar is behind the menu button; see STORY-CAP-022.

##### Edge Cases
- Maya searches "Equity" → the sidebar search matches page names, so "equity" finds nothing.

#### STORY-CAP-002: Empty Cap table on day one

**Type**: short
**Topic**: Empty states
**Persona**: Maya with nothing set up.
**Goal**: Understand what to do on an empty page.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`.
**Ideal path**: 1 — click "Connect Carta" if she uses Carta, otherwise add a contact.
**Alternate paths**: none found.

##### Steps
1. Open Cap table → brief 3-row grey skeleton, then the "See who owns your company" card, the tabs, and below them centred grey text "Add your investors, auditors and counsel here. Contacts are your address book." There is no button in the empty text on the All tab; "Add contact" is in the header.
2. Decide what to click → two buttons, "Connect Carta" (primary, in the card) and "Add contact" (outline, header). **Hesitation:** "address book" is a new idea on a page called Cap table; she does not know contacts are not the cap table.

##### Edge Cases
- Contacts load fails → red "Could not load contacts" (or the server's text) with "Try again" (`CapTable.tsx:683-690`). The card above still shows.
- The empty text never says that nothing was imported from Carta, because Carta is not connected.

### Stories: Connecting Carta

#### STORY-CAP-003: Connect Carta for the first time

**Type**: medium
**Topic**: Carta connection
**Persona**: Maya, whose company is on Carta and who has a Carta login.
**Goal**: Link Carta so the product can show her cap table.
**Preconditions**: `carta-none`, `agent-none`, `contacts-base`, Carta sandbox/stub reachable at `mcp.app.carta.com`, a model set up.
**Ideal path**: 3 — click Connect Carta, approve in Carta's window, click Done.
**Alternate paths**: Integrations → "Carta" tile → same dialog; Integrations → "Add custom connection" with `https://mcp.app.carta.com/mcp` (counts as Carta by host).

##### Steps
1. On Cap table click "Connect Carta" in the card → a dialog opens over the page (no navigation). It waits for the server list first (`CapTable.tsx:200`), so there can be a short blank moment. **Hesitation:** if nothing appears for a second she may click again.
2. The dialog shows the Carta sign-in step ("step 1 of 2") and a Carta window/popup opens → she signs in to Carta and approves.
3. Dialog changes to "Carta connected" / "The Carta agent can now read your cap table." → click "Done".
4. Back on Cap table the "See who owns your company" card disappears; the Refresh icon appears; the header "Add contact" turns primary; skeleton figure cards and "Reading Carta…" show while the first read runs (see STORY-CAP-004).

##### Variations
- Popup blocked: the sign-in step offers an open-again link and a "Try again" (`CustomConnectionDialog.tsx:785-792`). Record the exact text.
- A Carta server already exists (expired): the dialog reuses it instead of adding a second one (comment at `CapTable.tsx:199`). See STORY-CAP-005.

##### Edge Cases
- The server list fails to load → dialog never shows; a toast with the error appears (`CapTable.tsx:833-836`).
- Maya closes the dialog before approving → page re-checks servers; the card stays.

#### STORY-CAP-004: Did the connection work?

**Type**: short
**Topic**: Carta connection / Reading
**Persona**: Maya just back from Carta's sign-in.
**Goal**: Confirm Carta is linked and see her data.
**Preconditions**: `carta-connected`, `snapshot-none`, `contacts-base`, `agent-none` then auto-created, `carta-fixture` on the Carta side.
**Ideal path**: 1 — wait while the page fills in.
**Alternate paths**: Integrations → Carta card shows "Open Cap table".

##### Steps
1. Right after Done, look at the page → card gone; four grey skeleton blocks where figures will be; "Reading Carta…" text; the Refresh icon spinning and disabled.
2. Wait (typically tens of seconds to minutes) → the page polls every 3 s; figures, ownership bar and holdings fill in; "Northwind Robotics · Updated just now" appears under the heading. The Carta agent panel opens on the right with the agent's summary of what it saved (new investors added, mail threads found).
3. **Hesitation:** between steps 1 and 2 nothing says how long it takes or that the right-hand panel is the agent working. If she leaves the page she sees nothing happening.

##### Edge Cases
- `rpc.mcp.servers.list` fails on load → the page keeps assuming Carta is connected, hides the card, and never loads the cap table (STORY-CAP-026).
- The run starts but the model fails later → spinner stops; no snapshot; no error line (suspected problem 4).

#### STORY-CAP-005: Carta sign-in expired

**Type**: short
**Topic**: Errors / Carta connection
**Persona**: Maya returning after weeks away.
**Goal**: See her cap table again.
**Preconditions**: `carta-needs-auth`, `agent-exists`, `contacts-base`, `snapshot-fixture`.
**Ideal path**: 2 — read the headline, click "Reconnect Carta".
**Alternate paths**: Integrations → the Carta card.

##### Steps
1. Open Cap table → headline "Sign in to Carta again to see who owns your company"; button "Reconnect Carta". The saved snapshot is not shown (`CapTable.tsx:532`), figures are gone, the Ask button and panel are gone. **Hesitation:** her data has disappeared; she may think it was deleted.
2. Click "Reconnect Carta" → same dialog as STORY-CAP-003, reusing the existing server → sign in → Done.
3. Page re-checks servers, snapshot returns; the agent panel returns with the earlier chat.

##### Edge Cases
- Maya asks the agent a question elsewhere (bot page) before reconnecting → the agent cannot read Carta; record the exact message.

### Stories: The Carta agent panel

#### STORY-CAP-006: The Carta agent appears by itself

> **Updated 2026-10-20**: detail added from a newer walk of the same goal, see the section "Added 2026-10-20" at the end of this story.

**Type**: short
**Topic**: Agent panel
**Persona**: Maya, first time, Carta just connected.
**Goal**: Get the assistant that answers equity questions.
**Preconditions**: `carta-connected`, `agent-none`, `contacts-base`.
**Ideal path**: 0 — no click; the panel appears. (Ideal 1 if she must open it.)
**Alternate paths**: none (`bots.create` rejects the reserved key).

##### Steps
1. Land on Cap table with Carta connected and no agent → a small spinner in the right panel ("Loading") while the agent is created (`Shell.tsx:2666`, `ensureCartaAgent`).
2. The panel shows the avatar and name "Carta agent", a "Collapse Carta agent" icon, the sentence "The Carta agent reads your cap table from Carta and answers questions about it. Try one:" and two suggestion buttons "Who are our investors?" and "Draft this month's investor update".
3. **Hesitation:** she does not know who "Carta agent" is or that it is the same thing that read her cap table.

##### Variations
- Creation fails → panel shows red text (e.g. "Could not create the Carta agent") and a "Try again" button (`Shell.tsx:2640`, `agentPanel.create`). Collapsing the panel leaves an "Ask" button so the error can be reached again (`lib/carta-agent.ts` `cartaPanelState`).
- Carta not connected → no panel at all and no Ask button; nothing says an agent exists.

##### Edge Cases
- The check runs again on window focus while the agent is missing, so connecting Carta in another window creates the agent when she returns.

##### Added 2026-10-20: Carta page Agent section and its defaults

**Type**: short
**Topic**: Carta on the shared Agent controls
**Persona**: Maya, who connected Carta for the Cap Table.
**Goal**: Find out who handles Carta and whether anyone can change anything.
**Preconditions**: Carta connected (seeded in the demo: "Carta (MOCK DEMO)") and the Carta agent exists. The migrated defaults are agent linked, **Only this agent** on, **Allow changes in Carta** off (migration and checklist step 3). On a fresh demo seed the same defaults should hold; verify on screen.
**Ideal path**: 2 steps. Open Integrations then Carta; the Agent card is visible without scrolling.
**Alternate paths**: Via the Cap table page link, or the agent's chat.

###### Steps
1. Open Integrations → Carta (MOCK DEMO) → the header shows the Carta logo, a status badge (no "via MCP · host" text for Carta), and buttons **Open Cap table**, **Reconnect**, **Disconnect sign-in**, **Rename**. **Create agent** is absent because the agent is linked.
2. Read the **Agent** section → the link shows the Carta agent's name, **Allow changes in Carta** off ("Off: the agent only reads..."), **Only this agent** on.
3. Scroll to **Used by** → because the agent is exclusive, only the Carta agent is listed. Other agents are hidden, not switched off (rows preserved by the migration).
4. Click **Open Cap table** → the Cap Table page opens (the mock cap table in the demo).
5. Click the agent name link → `/app/{botId}`, the Carta agent chat.

###### Variations
- With `DEMO_NO_MODEL=1` the cap table has never been read; the page may show an empty state.
- A Carta server with no linked agent (migration missed it): **Create agent** shows in the action row and creates the specialized Carta agent, not a generic one (README, checklist step 3).
- Edit the server's endpoint: the agent link is released and changes go off (router logic around `agentBotId: null`).

###### Edge Cases
- Removing the server: the dialog says "The Carta agent loses access to Carta."
- Hesitation: a founder may not know why another agent is missing from Used by.
- Consistency: Used by is under the Agent card here but absent on app pages for the same state (see table).

---

#### STORY-CAP-007: Hide and bring back the agent

**Type**: short
**Topic**: Agent panel
**Persona**: Maya wanting more room for the table.
**Goal**: Collapse the side panel and get it back.
**Preconditions**: `agent-exists`, `carta-connected`, `snapshot-fixture`.
**Ideal path**: 2 — collapse, "Ask".
**Alternate paths**: none.

##### Steps
1. Click the panel's "Collapse Carta agent" icon → panel closes; an outline "Ask" button (chat bubble icon, label "Ask Carta agent") appears at the end of the header.
2. The table gets wider: Shares and Kind columns show at wider container widths.
3. Click "Ask" → panel returns with the chat history.
4. Navigate to Inbox and back to Cap table → the panel stays collapsed or open as she left it; the choice is saved for her user in the browser (`bots-sidebar-pref.ts`). **Hesitation:** a different browser starts open again.

##### Variations
- A narrow window dragged below 768 px collapses the view only; the saved preference is kept (`Shell.tsx` `useOnPhoneWidth`).

#### STORY-CAP-008: Open the agent full screen

**Type**: short
**Topic**: Agent panel / navigation
**Persona**: Maya wanting a bigger chat for a long answer.
**Goal**: Chat with the Carta agent on its own page.
**Preconditions**: `agent-exists`, `carta-connected`.
**Ideal path**: 1.
**Alternate paths**: The "Carta agent" row in the bots list in the sidebar, if shown there.

##### Steps
1. Click the agent's name and avatar at the top of the panel (the button's accessible name is "Carta agent", `Shell.tsx:4378-4384`) → app navigates to the bot's own page; Cap table is gone.
2. Look for a way back to the table → only the sidebar "Cap table" row. **Hesitation:** the name button does not look like a link.

##### Edge Cases
- Same chat thread in two places (panel and bot page); see Redundancy Candidates.

### Stories: Contacts

#### STORY-CAP-009: Maya adds her first investor from the empty Contacts page

> **Updated 2026-10-20**: rewritten for the current UI; contacts moved from the Cap table to a Contacts page (sidebar row 'Contacts'). The earlier steps described a tab on the Cap table.

**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, first-time founder of Northwind Robotics, no Carta yet
**Goal**: Keep one investor's email somewhere she can find it again.
**Preconditions**: Signed in, no contacts saved.
**Ideal path**: 3 — open Contacts, Add contact, Save.
**Alternate paths**: Cap table page "Add contact" (same dialog, see STORY-CAP-101); ask an agent to save the contact (STORY-CAP-104).
##### Steps
1. Click the sidebar row "Contacts" → `/app/contacts` shows header "Contacts", an "Add contact" button, and the text "No contacts yet". There is no search or Kind filter yet (they appear only once one contact exists).
2. Click "Add contact" → dialog titled "Add contact" with Name, Email, Organization, Kind (select), Notes. Kind defaults to "Investor" in the dialog even though the page passes kind "other" in its prefill; the dialog's own default only applies when no kind is passed, so the select may show "Other". UNVERIFIED which one shows on the Contacts page: the page prefill sets `kind: "other"`, which wins over the "investor" fallback.
3. Type Name "Priya Raman", Email "priya@harbor-ventures.example.test", Organization "Harbor Ventures". Maya notices the line under Notes: "Contacts are your address book. They do not change Carta." She wonders if this will email Priya; it will not.
4. If Kind shows "Other", choose "Investor" in the Kind select → value changes.
5. Click "Save" → dialog closes, table appears with columns Name, Email, Organization, Kind and one row "Priya Raman".
##### Variations
- Leave Email empty: Save still works (email is optional); only Name is required, and Save stays disabled while Name is blank.
- Press Enter in a field: the form submits.
##### Edge Cases
- Invalid email like "priya@" → the browser's email validation or a server error shown in red inside the dialog (`role=alert`); dialog stays open.
- Notes over 5000 characters or Name over 200 → server rejects; error text is generic from `errorText`. UNVERIFIED exact wording.
- Email is stored lowercased, so "Priya@Harbor..." displays lowercase after saving.

#### STORY-CAP-010: Fix a contact's details

> **Updated 2026-10-20**: contacts now live on the Contacts page (sidebar row 'Contacts', /app/contacts), not on a tab in the Cap table; editing is described in STORY-CAP-013. The Cap table still opens the same dialog from a holder row (STORY-CAP-103).

**Type**: short
**Topic**: Contacts
**Persona**: Maya whose investor changed firms.
**Goal**: Change Tom Okafor's organization.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — click name, edit, save.
**Alternate paths**: Ask the agent (changes need an approval card; it matches by email only, `contact-tools.ts:90-110`).

##### Steps
1. Click "Tom Okafor" (only the name is a button; the row is not) → "Edit contact".
2. Change Organization → "Save" → toast "Contact saved", table updates.

##### Edge Cases
- Change email to priya@sequoia-mock.test → red "Another contact already has this email." plus an "Open Priya Raman" button (`CapTable.tsx:360-370`).
- Clear Organization → saved empty.

#### STORY-CAP-011: Duplicate email is refused and Maya jumps to the existing contact

> **Updated 2026-10-20**: rewritten for the current UI; contacts moved to the Contacts page.

**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, a few weeks in, with 6 contacts saved
**Goal**: Add an investor she believes is new, and learn she already saved them.
**Preconditions**: Contact "Priya Raman" with priya@harbor-ventures.example.test exists.
**Ideal path**: 4 — Add contact, fill, Save, "Open Priya Raman".
**Alternate paths**: Search "priya" before adding (STORY-CAP-012).
##### Steps
1. On Contacts click "Add contact" → empty dialog.
2. Type Name "P. Raman" and Email "PRIYA@harbor-ventures.example.test" → nothing happens yet; the dialog quietly compares the lowercased email to other contacts.
3. Click "Save" → the server refuses ("Another contact already has this email." is the database error text; the page shows the user-facing error through `errorText`, UNVERIFIED exact string). A red alert appears in the dialog.
4. Because the typed email matches another contact, a button "Open Priya Raman" appears next to the error. Maya thinks "oh, I did add her" and clicks it → the add dialog is replaced by "Edit contact" for Priya Raman (the dialog is re-keyed to that contact).
5. Click "Cancel" → back to the list, nothing changed.
##### Variations
- The same refusal happens when editing contact A and typing contact B's email.
- The "Open" button only appears after the failed save, not while typing.
##### Edge Cases
- Two contacts without emails and the same name are allowed by the screen (only email is unique).
- If the other contact is not in the loaded list (list failed to load), no "Open" button appears; only the error.

#### STORY-CAP-012: Find a contact by search and Kind filter

> **Updated 2026-10-20**: rewritten for the current UI; contacts moved to the Contacts page, and the tabs became a Kind filter.

**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, preparing an update for investors
**Goal**: See only her investors, then find one by company.
**Preconditions**: About 12 contacts of mixed kinds (Investor, Auditor, Advisor, Legal).
**Ideal path**: 3 — pick Kind "Investor", type in Search, click the name.
**Alternate paths**: Cap table page Investors tab (STORY-CAP-102).
##### Steps
1. Open Contacts → table sorted by name (the server returns name order).
2. Open the "Kind" filter and choose "Investor" → only investor rows remain.
3. Type "harbor" in "Search" → matches name, email or organization, case-insensitive. Rows for Harbor Ventures remain.
4. Type "zzz" → text "No matches" replaces the table.
5. Clear the search and click a name (it is a button) → "Edit contact" dialog.
##### Variations
- At narrow widths the Email column hides below the `@md` container width and Organization below `@lg`; Maya on a phone sees only Name and Kind and must open the contact to see the email.
- Filter state is local only; reloading the page resets Search and Kind (Contacts does not use URL params, unlike the Cap table).
##### Edge Cases
- If every contact is deleted while a filter is active, the page falls back to "No contacts yet" and the filter row disappears.

#### STORY-CAP-013: Edit and delete a contact (no confirmation, no undo on Contacts)

> **Updated 2026-10-20**: rewritten for the current UI; contacts moved to the Contacts page; read the steps for whether Undo exists there.

**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya
**Goal**: Fix a changed email and remove a stale vendor.
**Preconditions**: Contacts "Dan Osei" (advisor) and "Old Parts Co" (vendor).
**Ideal path**: 3 per change — open row, edit, Save.
**Alternate paths**: Delete from the Cap table page offers Undo (STORY-CAP-103).
##### Steps
1. Click "Dan Osei" → "Edit contact" dialog prefilled; footer has a red "Delete" at far left, then "Cancel" and "Save".
2. Change Email to dan@osei-advisory.example.test, add a note, click "Save" → dialog closes, list reloads with the new email.
3. Click "Old Parts Co" → "Delete" → the contact disappears immediately. Maya hesitates: there is no "Are you sure?" and, on this page, no "Undo" toast (the Contacts page passes `onDeleted={load}` only).
##### Variations
- Clearing Email to empty saves it as null.
- Setting Kind to another value moves the row under that Kind filter.
##### Edge Cases
- Delete of a contact already removed elsewhere (another tab or an agent run) → error alert in the dialog; "Contact not found" is the server message, UNVERIFIED how it is rendered.
- Buttons are disabled while saving, so a double click does not send two requests.

### Stories: Asking the agent about equity

#### STORY-CAP-014: "Who owns what?"

> **Updated 2026-10-20**: the first screen now shows a muted ownership donut by share class above the table; click a slice to drill in (STORY-CAP-102).

**Type**: medium
**Topic**: Ask agent — holders
**Persona**: Maya preparing for a board call.
**Goal**: See ownership by holder, and ask follow-up questions.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `carta-fixture`.
**Ideal path**: 1 — read the table; 2 if she asks.
**Alternate paths**: Panel suggestion "Who are our investors?"; the full-screen agent page.

##### Steps
1. Open Cap table → figures: Fully diluted shares 10,000,000; Option pool available 900,000; Latest 409A $0.42; Amount raised $1,050,000; a bar split by share class with a legend and percentages; rows Maya Chen 4,000,000 / 40%, Arjun Patel 3,000,000 / 30%, the four option grants, "Unallocated pool" 900,000 / 9%, Sequoia Mock Capital 1,000,000 / 10%, and the two SAFEs with a dollar label and "—" for shares.
2. In the panel type "Who owns my company and what percent each?" → the agent answers from `cap_table_read` first and uses Carta for anything missing.
3. Ask "Is that fully diluted?" → agent explains basis.
4. Check that no figure is invented; missing values should say TBD (`carta-agent.ts:14`).
5. **Hesitation:** the two sources can disagree if Carta changed after the last read; the agent is told to use Carta for "newer" data but the page does not say which it used.

##### Variations
- Two Carta companies → the agent should say which company it used.

##### Edge Cases
- Percentages in the table are the saved Carta figures; the Unallocated pool percent is computed by the page for display only (`CapTable.tsx:100-102`).

#### STORY-CAP-015: SAFEs and the option pool

> **Updated 2026-10-20**: SAFEs and the option pool also appear in the donut slices 'Options and pool' and 'Unallocated pool' (STORY-CAP-102).

**Type**: medium
**Topic**: Ask agent — securities, SAFEs, option pool
**Persona**: Maya planning a Series A.
**Goal**: Understand outstanding SAFEs and how much of the pool is left.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `carta-fixture`.
**Ideal path**: 2 questions.
**Alternate paths**: none.

##### Steps
1. Ask "What SAFEs haven't converted yet?" → Lighthouse Mock Ventures $500,000 and Lena Fischer $50,000, $10M post-money cap, dates (the page rows show only "SAFE, $500,000" and "SAFE, $50,000").
2. Ask "How many options can I still grant?" → 900,000 of 1,500,000 (card says 900,000).
3. Ask "What happens to ownership if the SAFEs convert at the cap?" → an estimate (post-money: $550k/$10M = 5.5%), labelled as one.
4. Ask "Grant 50,000 options to our new hire Jo" with writes off → agent says it cannot change Carta and tells her to do it in Carta. With writes on, see STORY-CAP-027.

##### Edge Cases
- "Anything wrong with my cap table?" → should surface the seeded vesting issue (healthcheck is no longer in the fixed tool list; the agent must find it through `discover`/`fetch`; record what it does).

#### STORY-CAP-016: Agent finds investors missing from contacts

> **Updated 2026-10-20**: agents now have contact tools (list, save); see STORY-CAP-104.

**Type**: medium
**Topic**: Ask agent + contacts
**Persona**: Maya who wants the contact list to match Carta.
**Goal**: Add Carta investors who are not in contacts.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base` minus Tom Okafor.
**Ideal path**: 2 — ask, read the confirmation. Adding new contacts needs no approval.
**Alternate paths**: Click "Add email" on the holder row (STORY-CAP-029); add by hand (STORY-CAP-009).

##### Steps
1. Look at the table first: "Lighthouse Mock Ventures" shows as a plain-text holder row (no contact), kind Investor, Email "—" or "Add email". **Hesitation:** she sees an investor but cannot tell whether it is saved as a contact.
2. Ask "Are all my Carta investors in my contacts?" → agent compares `contacts_list` with the saved cap table and says Lighthouse is missing.
3. Say "Add them" → the agent calls `contacts_add`; there is no approval card for new contacts (only `contacts_save` asks). The reply says what it saved.
4. Look at the table → contacts reload only when a read run ends (`CapTable.tsx:498-503`), not after a chat reply. **Hesitation:** the new contact may not show until she refreshes the page or runs Refresh.
5. Ask "Change Lena Fischer's organization to Lena Fischer Angels" → an approval card "Save contact “Lena Fischer”" with the fields; approve; saved.

##### Edge Cases
- The holder has no email → the agent may save without one or ask.
- Reject the card in step 5 → nothing saved.
- An email already in contacts → the tool returns "Another contact already has this email.".

### Stories: Long end-to-end stories

#### STORY-CAP-017: First visit to a working setup

> **Updated 2026-10-20**: the first working screen now includes the donut, search, a security filter and sorting (STORY-CAP-102, STORY-CAP-103).

**Type**: long
**Topic**: End-to-end onboarding
**Persona**: Maya, first day in the product, company on Carta.
**Goal**: Go from nothing to a populated cap table and an answered question.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`, `model` present, Carta sandbox/stub with `carta-fixture`.
**Ideal path**: 4 — open Cap table, Connect Carta, Done, read.
**Alternate paths**: Integrations first, then Cap table.

##### Steps
1. Sidebar → "Cap table" → the "See who owns your company" card and the grey empty text.
2. Read the card; she is unsure what Carta is. She clicks "Add contact" first, then cancels. **Hesitation:** two equal-looking actions.
3. Click "Connect Carta" → dialog over the page → Carta window → sign in → approve.
4. Dialog "Carta connected" → "Done".
5. Page: card disappears; skeleton cards; "Reading Carta…"; the agent panel appears with a spinner.
6. Wait while the page polls; the Carta agent writes a summary in the panel.
7. Figures fill in, the bar appears, the table shows Maya, Arjun, option grants, the pool row, Sequoia and the two SAFEs.
8. Investor holders were added as contacts by the run (Investors tab now has them; some need "Add email").
9. Click the "Investors" tab → URL `?kind=investor`; only investor rows.
10. Click "Add email" on "Lena Fischer" if she has no contact email → "Add investor" dialog prefilled; add lena.fischer@mock.test → Save → "Contact saved".
11. In the panel click "Who are our investors?" → the agent answers.
12. Collapse the agent → wider table; click "Ask" to bring it back.
13. Click the eye icon → every figure turns to `•••`.
14. Click the eye again to restore.
15. **Friction to record:** no time estimate while reading, the silent first read when no model exists, the table not refreshing after an agent chat save.

#### STORY-CAP-018: Monthly investor update

**Type**: long
**Topic**: Skill carta-investor-update
**Persona**: Maya who owes investors the September update.
**Goal**: Get a draft in Gmail addressed to all investors.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base`, `gmail-connected`, `finance-connected`.
**Ideal path**: 4 — click the suggestion, give highlights, review draft, approve.
**Alternate paths**: Composer skill selector "carta-investor-update"; plain "write my investor update".

##### Steps
1. Click the panel suggestion "Draft this month's investor update" (or type it) → agent picks the period and calls `finance_overview` / `finance_breakdown` → cash $2.4M, burn $180k, runway ~13 months.
2. Agent reads ownership from the saved cap table and recipients via `contacts_list` kind investor.
3. Agent flags any Carta investor not in contacts and adds them with `contacts_add` (no card).
4. Agent reads the July and August sent updates for tone.
5. Agent asks for highlights, lowlights, asks → Maya answers in chat.
6. Agent saves a Gmail draft to Maya with investors in Bcc; shows it; lists TBD items.
7. Maya opens Inbox/Gmail to check the draft (a draft needs approval, `mail_draft`).
8. **Hesitation:** whether it was sent — it is only a draft; the skill never sends.

##### Edge Cases
- Lena Fischer has no email in contacts → recipient missing; agent says so.
- Hide amounts on: the figures in the chat text are masked where they are written as currency; plain numbers may show.

#### STORY-CAP-019: Auditor confirmation request

**Type**: long
**Topic**: Skill carta-audit-response
**Persona**: Maya who got an audit email from Lighthouse's auditor.
**Goal**: Reply with correct holdings.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base` minus Daniel Ortiz, `gmail-connected`.
**Ideal path**: 4 — ask, review comparison, approve send.
**Alternate paths**: skill selector vs "do I have any audit requests?".

##### Steps
1. Ask "Any auditor requests I need to answer?" → `mail_search` + `mail_grep` find the KPMG Mock email and the DocuSign envelope.
2. Agent extracts fund (Lighthouse Mock Ventures), as-of 2025-12-31, items (SAFE $500,000).
3. Agent adds Daniel Ortiz as an auditor with `contacts_add` (no approval card).
4. Agent compares with Carta: SAFE dated 2026-03-01 — after the as-of date — so the holding as of 2025-12-31 should be $0; reports the difference exactly.
5. DocuSign email has no figures → agent gives the Carta numbers to check and does not say "sign it".
6. Agent drafts a reply; "still needed from you" list.
7. Maya asks to send → approval card shows full to/cc/bcc/subject/body → approve → sent.
8. Check Cap table → "Auditors" tab shows Daniel Ortiz after the table reloads.

##### Edge Cases
- Agent tries to send by draft id only → refused (`executor.ts:4415`).
- Carta cannot answer as-of-date holdings → agent must say so (`docs/carta/README.md`).

#### STORY-CAP-020: Board prep in one sitting

**Type**: long
**Topic**: Cross-area
**Persona**: Maya with a board meeting tomorrow.
**Goal**: Know the cap table, pool, SAFE exposure, and who to email.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base`.
**Ideal path**: 4 questions in one chat.
**Alternate paths**: Finance page agent for cash numbers.

##### Steps
1. Cap table → read the page → "Summarise my cap table for the board" in the panel → ownership table.
2. Click Refresh first if the "Updated" time is old → spinner, then new time.
3. "Anything wrong with it?" → healthcheck-style findings (agent must use Carta `fetch`; record).
4. "Option pool left?" → 900,000 (the card already says it).
5. "If we raise $3M at $15M pre, what's the dilution?" → estimate, labelled as such.
6. "Which board members are in my contacts?" → agent can only list contacts; there is no "board member" kind (Investor, Auditor, Other).
7. Collapse the panel, review the Investors tab, click "Sam Lee" to check notes "Company counsel".
8. Ask for cash and runway → the Carta agent has `finance_*` tools; compare with the Finance page agent; two agents can answer the same question.

### Stories: New since the 2026-10-16 catalog

#### STORY-CAP-021: Hide amounts on Cap table

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya working in a coffee shop, a stranger can see her screen.
**Goal**: Stop the share counts and dollars showing on screen.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 1 — click the eye.
**Alternate paths**: Account menu → "Hide amounts"; the same switch works on Finance.

##### Steps
1. Find the eye icon in the page header (label "Hide amounts", tooltip: "Hide amounts. Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show.") → click.
2. Check the page: the four figure cards show `•••`, `$•••`; legend percentages show `•••%`; Shares and Ownership columns show `•••` / `•••%`; the SAFE holding labels read "SAFE, $•••". The icon becomes crossed-out and the label "Show amounts".
3. Look for what is still visible → holder names, emails, kinds, share class names, the update time and the **ownership bar segment widths**. **Hesitation:** the bar still shows the proportions, so a stranger can read "about 40/30/10/15" without any number.
4. Reload → the choice is kept (saved in the browser). Click the eye again → numbers return live without a reload.

##### Edge Cases
- Open the agent's reply with "$550,000" while hidden → currency text is masked, but "900,000 options" is not (helper text says so).
- Storage blocked → the choice lasts only until reload.

#### STORY-CAP-022: Cap table on a phone, Carta off

**Type**: short
**Topic**: Phone width / disconnected
**Persona**: Maya on her phone in a taxi.
**Goal**: Check the page and connect Carta.
**Preconditions**: `phone`, `contacts-base`, `carta-none`.
**Ideal path**: 3 — menu, Cap table, Connect Carta.
**Alternate paths**: none.

##### Steps
1. Open the sidebar menu → tap "Cap table".
2. The header holds the title, eye icon and "Add contact"; the card stacks (icon, text, then a full "Connect Carta" button); the tabs sit below.
3. The table shows Name with the kind and organization lines under it, and Email; the Kind column is hidden (`@lg`).
4. Tap "Connect Carta" → dialog fits the screen; Carta sign-in opens in a new tab or window.
5. **Hesitation:** on a phone the return from the Carta window may leave the dialog waiting; record whether the dialog notices the sign-in finished.

##### Edge Cases
- Touch targets: the eye and Refresh buttons use a larger tap size on coarse pointers (`pointer-coarse:size-10`).
- Long names truncate with a hover title that a phone cannot show.

#### STORY-CAP-023: Cap table on a phone, Carta on

**Type**: medium
**Topic**: Phone width / table and Ask
**Persona**: Maya at the airport before a call.
**Goal**: Read her ownership and ask a question.
**Preconditions**: `phone`, `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 3 — open page, read cards, tap "Ask".
**Alternate paths**: none.

##### Steps
1. Open the page → the panel is collapsed by default on a phone (`Shell.tsx:499-511`); header shows eye, Refresh, "Add contact" and "Ask" (they may wrap or crowd the title). **Hesitation:** four controls in one row.
2. Under the heading: "Northwind Robotics · Updated 2 hours ago"; the company name truncates before the time does.
3. Figure cards form two columns.
4. The table has Name (with "Investor · Series Seed Preferred" lines), Email, and Ownership; Shares and Kind are hidden. A holder with no contact shows the name in plain text.
5. Tap "Ask" → the agent panel opens; check whether it covers the page and can be closed with "Collapse Carta agent".
6. Type "Who owns what?" → answer; collapse; the page is back.

##### Edge Cases
- Rotate or widen the window past 768 px with the panel open → the panel stays; narrow again → it collapses.
- Ownership bar legend wraps onto several lines.

#### STORY-CAP-024: Connected, but the first read cannot start (no model)

**Type**: medium
**Topic**: Errors / Reading Carta
**Persona**: Maya who connected Carta before choosing a model.
**Goal**: See her cap table.
**Preconditions**: `carta-connected`, `snapshot-none`, `model-none`, `agent-exists`.
**Ideal path**: 3 — see why nothing happened, add a model, Refresh.
**Alternate paths**: none.

##### Steps
1. Finish the Carta sign-in → Done. The first read was skipped silently (`startCartaSync` returns `no_model`).
2. On the page: no skeleton, no "Reading Carta…", no cards, no snapshot; the table shows only contacts; the Refresh icon is active. **Hesitation:** nothing says Carta is connected but empty, or that a model is needed.
3. Click Refresh → red "Add a model before refreshing" with "Try again" (`router.ts:6345`, `CapTable.tsx:674-681`).
4. Add a model in Settings, return, Refresh → "Reading Carta…" and the page fills in.

##### Edge Cases
- "Try again" repeats the same call; fine once a model exists.
- Disconnected Carta then Refresh is unreachable (button hidden), but the API says "Connect Carta first".

#### STORY-CAP-025: Refresh from Carta

**Type**: short
**Topic**: Refresh
**Persona**: Maya after a new SAFE was signed in Carta.
**Goal**: Bring the page up to date.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 1 — click the refresh icon.
**Alternate paths**: Ask the agent in chat to update the page (it can call `cap_table_update`).

##### Steps
1. Click the circular-arrows icon (label "Refresh from Carta", no visible text) → it spins and is disabled.
2. The page shows the old snapshot while "syncing"; the panel chat shows the agent working; the table is not replaced by skeletons (only when there is no snapshot).
3. When the run ends, "Updated just now" shows and contacts reload.
4. **Hesitation:** the icon has no text label; a first-timer may not guess it reads Carta again.

##### Edge Cases
- Click again while running → disabled; a second click cannot start a second run (server allows one at a time, `carta-agent.ts:143-148`).
- Failure → red "Could not refresh from Carta" (or server text) with "Try again".

#### STORY-CAP-026: The cap table cannot load, or the connection check fails

**Type**: short
**Topic**: Errors
**Persona**: Maya on a flaky connection.
**Goal**: Understand what failed and recover.
**Preconditions**: `carta-connected`, `snapshot-fixture`; API fails once for `carta.capTable`; second walk with `mcp.servers.list` failing.
**Ideal path**: 2 — read the error, click Try again.
**Alternate paths**: reload.

##### Steps
1. Open Cap table while `carta.capTable` fails → red "Could not load the cap table" with "Try again" above the table; polling stops while the error shows (`CapTable.tsx:505`).
2. Click "Try again" → the snapshot returns and polling resumes.
3. Second walk: make `mcp.servers.list` fail → no error is shown at all (`CapTable.tsx:494`). The "See who owns your company" card is hidden (the page assumes connected), no figures load, the Shell is told nothing so there is no Ask button and no panel. **Hesitation:** the page looks like a plain contact list with Carta apparently connected.

##### Edge Cases
- Contacts fail but the cap table loads → two separate error areas; each has its own Try again.

#### STORY-CAP-027: Turn on "Allow changes in Carta"

> **Updated 2026-10-20**: detail added from a newer walk of the same goal, see the section "Added 2026-10-20" at the end of this story.

**Type**: medium
**Topic**: Writes switch / approval
**Persona**: Maya who wants the agent to grant 50,000 options to Jo.
**Goal**: Let the agent change Carta, safely.
**Preconditions**: `carta-connected`, `agent-exists`.
**Ideal path**: 5 — Integrations, Carta card, switch, confirm, ask, approve.
**Alternate paths**: none (Cap table has no shortcut to the switch).

##### Steps
1. Ask the agent "Grant 50,000 options to Jo" → it says it cannot change Carta (writes off).
2. Sidebar → Integrations → the Carta card (shows "Open Cap table") → open it.
3. Find the switch "Allow changes in Carta" → turn on → a confirm dialog: "The Carta agent will be able to change your Carta data. It asks before each change." → confirm.
4. Back on Cap table, ask again → the agent calls Carta's change tool; an approval card shows what it will change; she approves or rejects.
5. **Hesitation:** the switch lives two pages away from the place she is asking; and the agent's answer in step 1 does not point to it.

##### Edge Cases
- Turning the switch off needs no confirmation.
- Another bot asked to use Carta → "Carta is used only by the Carta agent.".
- A non-Carta MCP server has no such switch.

##### Added 2026-10-20: Turn on Carta changes and read the confirmation

**Type**: short
**Topic**: Carta writes, consent
**Persona**: Maya, who wants the agent to prepare an option grant.
**Goal**: Enable changes in Carta consciously.
**Preconditions**: STORY-CAP-006. Mock Carta emulator exposes read tools only, so writes are not testable end to end. UNVERIFIED.
**Ideal path**: 2 steps: click the switch, click **Allow changes**.
**Alternate paths**: Cancel; or ask the agent for a change first and let it tell her to use the switch.

###### Steps
1. Click the **Allow changes in Carta** switch → dialog "Allow changes in Carta?" with one bullet: "The Carta agent will be able to change your Carta data. It asks before each change." and buttons Cancel / **Allow changes**.
2. Click **Allow changes** → the dialog closes; the switch is on. Failure shows "Could not update changes".
3. Open the Carta agent and ask for an option grant → the agent proposes a call via `mutate` or `call_tool` (the two write entry points). Each shows an approval card with the full tool name and arguments (checklist step 5).
4. Deny it → nothing changes in Carta. Approve a second one only if intended; each write asks again.
5. Turn the switch off → no dialog, effective at once.

###### Variations
- Before turning it on, ask the agent for a change: the agent's prompt tells it to say changes are off and to point to "Allow changes in Carta" under Integrations, Carta.
- Re-running the cap table refresh leaves the switch unchanged (checklist step 7).

###### Edge Cases
- Reconnecting or re-adding the server does not silently re-enable writes (checklist step 8).
- Copy difference: Carta's dialog says "Carta agent" and the generic one says "The agent"; titles use the same "Allow changes in {service}?" pattern, but on app pages {service} is the account's display name.
- A new tool that Carta advertises is not allowed automatically, even when marked read-only (checklist note).

---

#### STORY-CAP-028: Reaching Cap table by other routes

**Type**: short
**Topic**: Navigation / sidebar
**Persona**: Maya who cannot find the sidebar row on a small screen.
**Goal**: Open the page by search and from Integrations.
**Preconditions**: `carta-connected`.
**Ideal path**: 2 — type a few letters, click the result.
**Alternate paths**: Integrations → Carta card → "Open Cap table".

##### Steps
1. Click the sidebar search ("Search chats") and type "cap" → a result "Cap table" with the pie icon appears among the page results; click → page opens and the search clears.
2. In Integrations, open the Carta card → "Open Cap table" button → lands on the page.
3. Try to hide the "Cap table" sidebar row → there is no control; the sidebar-pages "Add page" menu offers only pages that are available, and none touches Cap table (`sidebar-pages.ts`). **Hesitation:** a founder who does not use Carta cannot remove the row.

##### Edge Cases
- The search placeholder says "Search chats", so Maya may not try it for a page name.

#### STORY-CAP-029: "Add email" on a holder

> **Updated 2026-10-20**: 'Add email' on a holder is covered with the new table in STORY-CAP-103.

**Type**: short
**Topic**: Table rows
**Persona**: Maya who wants to email Arjun's co-investor.
**Goal**: Make an investor holder a contact with an email.
**Preconditions**: `carta-connected`, `snapshot-fixture` with an investor holder who has no email in the snapshot and no contact; `contacts-base`.
**Ideal path**: 2 — click "Add email", fill, save.
**Alternate paths**: ask the agent.

##### Steps
1. Find the row (plain-text name, Email column shows a link-style "Add email"; only investor-type holders get it).
2. Click "Add email" → dialog "Add investor" prefilled with the holder's name, organization and Kind Investor.
3. Type the email → Save → toast "Contact saved"; the row now shows the email and the name becomes a clickable button (join is by email).
4. **Hesitation:** if the email she types differs from the one Carta has for the holder, the row stays plain text and a second row appears.

##### Edge Cases
- Founders and option holders (Common, Options) show "—", not "Add email".

#### STORY-CAP-030: Founders, options and investors in the table

> **Updated 2026-10-20**: the holders table can be filtered by security, searched and sorted (STORY-CAP-103).

**Type**: short
**Topic**: Table rows / filters
**Persona**: Maya who wants only her investors.
**Goal**: Read the Investors tab and know what it contains.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `contacts-base`.
**Ideal path**: 1 — click "Investors".
**Alternate paths**: none.

##### Steps
1. Click "Investors" → only investor-class rows: Sequoia Mock Capital, the two SAFE holders and investor contacts; founders and option grants are hidden. Their Kind column (wide windows) reads Investor with the security under it ("Series Seed Preferred", "SAFE, $500,000").
2. Click "Other" → Sam Lee plus any Shareholder rows (founders); "Options" rows have no tab of their own and show only on "All". **Hesitation:** "Other" holds both counsel and Arjun; Options can only be found on All.
3. On "Investors" the header button reads "Add investor".

##### Edge Cases
- A security the code does not recognise (e.g. "Common") is a Shareholder, even for an outside investor holding common.

#### STORY-CAP-031: Undo that fails

> **Updated 2026-10-20**: the contact delete flow changed on the Contacts page (STORY-CAP-013); re-read whether Undo still exists.

**Type**: short
**Topic**: Errors / contacts
**Persona**: Maya who deleted Sam Lee, then went offline.
**Goal**: Get Sam Lee back.
**Preconditions**: `contacts-base`; make the save call fail once.
**Ideal path**: 2 — Undo, retry.
**Alternate paths**: re-add by hand.

##### Steps
1. Delete "Sam Lee" → toast "Deleted Sam Lee · Undo".
2. Click "Undo" with the save failing → the toast changes to "Could not restore Sam Lee" (or the server text) with "Try again" and "Dismiss"; it no longer disappears by itself.
3. Click "Try again" after the network returns → restored; toast clears; list reloads.
4. **Hesitation:** "Dismiss" loses the contact for good; nothing warns.

##### Edge Cases
- Double-clicking Undo quickly does not create two contacts (guard at `CapTable.tsx:559-560`).
- Email was reused by a new contact meanwhile → the restore fails with "Another contact already has this email.".

#### STORY-CAP-032: A read started somewhere else

**Type**: short
**Topic**: Polling / multi-tab
**Persona**: Maya with Cap table open in two tabs, asking the agent to update in tab B.
**Goal**: See the update appear in tab A without reloading.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`.
**Ideal path**: 0 — it updates itself.
**Alternate paths**: none.

##### Steps
1. In tab B click Refresh; switch to tab A.
2. Tab A re-checks on focus/visibility → the spinner shows and "Updated" changes when the run ends; contacts reload then.
3. Leave tab A hidden for several minutes → the idle check runs every 30 s only while visible (`CapTable.tsx:508`); on return the focus check refreshes it.
4. **Hesitation:** while the run is going she gets no sign in tab A except the spinner.

##### Edge Cases
- Polling stops after a cap table load error and restarts only with "Try again".

#### STORY-CAP-033: Board prep with amounts hidden, shared screen

**Type**: long
**Topic**: Hide amounts / cross-area
**Persona**: Maya presenting her screen to a new advisor before the numbers are shared.
**Goal**: Walk the advisor through the structure without showing figures, then reveal them on purpose.
**Preconditions**: `carta-connected`, `snapshot-fixture`, `agent-exists`, `contacts-base`, `gmail-connected`, `finance-connected`.
**Ideal path**: 3 — hide, present, show.
**Alternate paths**: none.

##### Steps
1. Open Cap table; click the eye before sharing her screen.
2. Check the page: figure cards, columns and legend are masked; names, kinds and the ownership bar still show.
3. Click the "Investors" tab and show the SAFE holders by name only.
4. Ask the agent "How much did Lighthouse put in?" → the answer's dollar amount is masked in the chat (`$•••`); a plain number such as "1,000,000 shares" may still show.
5. Ask "Draft this month's investor update" → the draft summary masks currency amounts in the chat.
6. Collapse the agent panel before sharing again, in case a later reply shows plain numbers.
7. Navigate to Finance → amounts stay hidden (same switch).
8. Return to Cap table, click the eye to show amounts → all figures return at once with no reload.
9. Walk the advisor through the Series Seed row, then end.

##### Edge Cases
- Account menu → "Show amounts" gives the same result.
- A new browser profile starts with amounts shown.

---

### Stories: Added 2026-10-20, Contacts and cap table ownership

#### STORY-CAP-101: Cap table without Carta still works as an investor list

**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Solo technical founder who keeps his cap table in a spreadsheet, not Carta
**Goal**: Track investors and advisors on the Cap table page and ignore Carta.
**Preconditions**: Carta not connected; no snapshot.
**Ideal path**: 5 — add investor from the Investors tab, see it in the table.
**Alternate paths**: Contacts page (STORY-CAP-009); the same people show on both pages.
##### Steps
1. Open Cap table from the sidebar → header "Cap table", no donut, no summary figures. A card reads "See who owns your company" with "Carta is the service many startups use to record who owns shares, options and SAFEs. Connect it to see them here and to ask the Carta agent about them." and a second line "Not on Carta? You can still keep your investors and advisors below." Primary button "Connect Carta"; the header "Add contact" button is outlined (not primary) because Carta is not connected. He ignores the card.
2. Tabs show only "All", "Investors", "Auditors", "Other" (Shareholders and Options are hidden without a snapshot). Click "Investors" → URL gets `?kind=investor`; empty state "No investors yet" with a button "Add investor".
3. Click "Add investor" → dialog titled "Add investor", Kind preset to Investor.
4. Fill Name "Lena Fischer", Email "lena@fischer-capital.example.test", Organization "Fischer Capital", click "Save" → dialog closes; a notice "Saved Lena Fischer" appears at the bottom; the new row is scrolled to the centre and highlighted for 8 seconds.
5. Click "Auditors" tab → "No auditors yet" and "Add auditor"; header button now reads "Add auditor".
6. Click "All" → empty text only shows when nothing exists; with one contact the table shows Name, Email, Kind (no Shares or Ownership columns without Carta).
##### Variations
- Open `/app/contacts` → Lena is listed there too (same records).
- Table columns: the Email column takes the width Shares/Ownership would take.
##### Edge Cases
- If the connection check itself fails, the page shows "Could not check whether Carta is connected." with "Try again" instead of the Connect card.
- Reload with `?kind=options` and no snapshot → falls back to "All" and rewrites the URL.

#### STORY-CAP-102: Read the ownership donut and drill into a share class

**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, Northwind Robotics, Carta connected and read
**Goal**: Answer "who owns what" for a board slide.
**Preconditions**: Snapshot with Common, Series Seed Preferred, SAFE-style holdings, granted options and an unallocated pool.
**Ideal path**: 3 — open Cap table, click a legend row, read the breakdown.
**Alternate paths**: Table Ownership column; sorting by Ownership (STORY-CAP-103); ask the Carta agent (STORY-CAP-106).
##### Steps
1. Open Cap table → header shows "Northwind Robotics · Updated 3 hours ago", then four figures: "Fully diluted shares", "Option pool available", "Common share price" (hint "From the latest 409A valuation"), "Amount raised".
2. Look at the donut card → ring with at most six slices (largest classes, the rest merged as "Other") and a legend with percent and share count. The centre says the fully diluted total with "Fully diluted shares". Maya hovers a slice → the centre swaps to that slice's name and shares.
3. Click legend row "Show Common breakdown" (accessible name) → the ring shrinks aside, a second donut grows in with holders of Common, ordered biggest first; a beam links the two. Focus moves to a "Back" arrow.
4. Hover a holder row → that arc stays lit, others dim to 30 percent; the centre shows the holder's shares.
5. Press Escape or click "Back" → returns to the class view; focus returns to the row she opened.
6. Click "Show Options and pool breakdown" → options holders plus "Unallocated pool". Maya thinks "that matches my pool figure above" (same value appears in the summary and here).
##### Variations
- Narrow container: donuts stack vertically instead of side by side.
- Reduced-motion setting: no animation or beam.
- A hidden screen-reader table lists Name, Ownership, Shares.
##### Edge Cases
- The slice named "Other" (merged small classes) has no breakdown; its legend row is not a button.
- A class with no holder shares in the snapshot has no breakdown either.
- Slices under 2 percent are drawn at least 2 percent wide, but the printed numbers are the true ones.
- Amount-only holdings (SAFEs with dollars, no shares) are not in the donut drill-down because it sums shares; they appear in the table as "SAFE, $250,000".
- Hide amounts button (header) masks dollar figures but not share counts. UNVERIFIED exactly which fields it masks.

#### STORY-CAP-103: Filter, search and sort the holders table, then fix an investor's email

**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, with Carta connected
**Goal**: Find investors with no email on file and turn Carta holders into contacts.
**Preconditions**: Snapshot holds "Harbor Ventures Fund II" (SAFE, email on file in Carta), "Fischer Capital" (Series Seed Preferred, no Carta email), plus common holders, option grants. One contact "Priya Raman" matches a holder by email.
**Ideal path**: 4 — Investors tab, find row, "Save as contact"/"Add email", Save.
**Alternate paths**: Add the person on Contacts first; the Cap table row will match on email (STORY-CAP-105).
##### Steps
1. Open Cap table → tabs "All", "Shareholders", "Investors", "Options", "Auditors", "Other". Default sort is Ownership, descending.
2. Click "Investors" → holders whose security looks like SAFE, preferred, series, note, convertible or warrant, plus investor contacts. URL `?kind=investor`.
3. Open "Security" filter (appears only when two or more securities are among the rows) and pick "SAFE" → URL `security=...`; rows narrow.
4. Type "harbor" in "Search" → matches name, organization or email from the contact or Carta.
5. Open "Sort: Ownership", switch to "Name", then toggle "Ascending" → URL `sort=name&dir=asc`. Sort options present: Name, Kind, Ownership, plus Shares and Amount only when any row has them.
6. In the Email column of the Harbor row (no contact), see the Carta email in text and a link button "Save as contact" → click it.
7. Dialog titled "Save Harbor Ventures Fund II as a contact" opens with name, email, organization and Kind "Investor" filled. Click "Save" → notice "Saved Harbor Ventures Fund II"; the row now shows a clickable name and highlights.
8. On the Fischer Capital row (no Carta email) the button reads "Add email" → dialog titled "Add email for Fischer Capital". Maya types the email and saves.
##### Variations
- With no matches: text "No matches" and a "Clear filters" button (clears search and security, keeps the tab).
- Delete a contact from its dialog → notice "Deleted Priya Raman" with "Undo" and "Dismiss"; the notice stays until used (no auto-dismiss). "Undo" re-creates the contact and shows "Restored Priya Raman"; if that fails: "Could not restore ... If you dismiss this, ... stays deleted." with "Try again".
##### Edge Cases
- Shareholders and Options tabs filter by the Carta security even when a contact matches the holder.
- Rows for contacts with no holding sort last on Ownership/Shares/Amount.
- Non-investor holders (common, options) show no "Save as contact" link.
- The "Unallocated pool" row appears right after the option grants; it has no name button and no save action.
- Email matching is case-insensitive; a different spelling of the same person's email creates a duplicate row (one holder, one holdingless contact).
- A holder with a long name truncates, full text in the tooltip title.

#### STORY-CAP-104: Ask an agent to save an investor, then see the result without refreshing

**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, on the Cap table page with the Carta agent panel open
**Goal**: Say "save the Harbor Ventures partner from that email as an investor" and have it appear.
**Preconditions**: Maya started the run herself in a direct message (tools are offered only on owner-started runs); a model is set up.
**Ideal path**: 3 — type the request, wait, see the notice/row.
**Alternate paths**: Manual Add contact (STORY-CAP-009).
##### Steps
1. Click "Ask Carta agent" style button in the header (AskBotButton, bot "Carta agent") if the panel is closed → agent panel opens.
2. Type "Save Priya Raman, priya@harbor-ventures.example.test, Harbor Ventures, as an investor" and send → the agent uses `contacts_add`.
3. While the agent is working the page still shows the old list. When the answer finishes, the page reloads contacts and the cap table by itself (it watches the agent's busy state) → Priya's row appears.
4. Maya sends it again by accident → the tool returns `alreadySaved` with note "Already saved; nothing was changed." The agent tells her it already exists; no change is made, so edits she made by hand are not overwritten.
5. Maya asks "Change Priya's organization to Harbor Capital" → agent uses `contacts_save`, which finds the contact by email only; it never creates one and never updates by id.
##### Variations
- `contacts_list` lets any agent search by text or kind before answering questions like "who are my auditors?".
- Without an email the add tool matches an existing contact by name plus organization, case-insensitively.
##### Edge Cases
- `contacts_save` for an email nobody has returns "No contact with this email. Use contacts_add for new people."
- Scheduled or bot-triggered runs (not started by the owner) do not get the contact tools. UNVERIFIED how the agent words this to the user.
- `cap_table_read` and `cap_table_update` are offered only to the Carta agent; other agents can use contacts but not the cap table.
- Changing the email of a contact through `contacts_save` is not possible this way (email is the key).

#### STORY-CAP-105: Carta rows and contacts reconcile by email

**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya
**Goal**: Understand why Priya appears once in some places and twice in others.
**Preconditions**: Carta holder "Priya Raman" with priya@harbor-ventures.example.test; contact with the same email; another Carta holder "Dan Osei" and a contact "Daniel Osei" saved with a different email.
**Ideal path**: 3 — open Cap table, compare rows.
**Alternate paths**: Contacts page lists contacts only.
##### Steps
1. Open Cap table, tab "All" → Priya shows as one row: the contact's name (clickable), the holding in Kind ("Investor" plus the security under it), shares and ownership from Carta.
2. Find "Dan Osei" (holder, name not clickable, Kind from the security, e.g. "Shareholder") and a second row "Daniel Osei" (contact, no shares, "—" in Ownership). Maya thinks they are the same person; the page cannot know because the emails differ.
3. Click "Daniel Osei" → Edit contact. She changes Email to the one Carta holds and clicks "Save".
4. Return to the table → the two rows merge into one row with the contact's name "Daniel Osei" and Dan's holding.
5. Open `/app/contacts` → only one "Daniel Osei" (contacts never list Carta-only holders).
##### Variations
- The row name prefers the contact's name over Carta's name.
- Contact organization wins over Carta's organization when both exist.
##### Edge Cases
- Contacts with a holding show the Kind of the contact (investor/advisor), but Shareholders/Options tabs use the Carta security instead.
- The same info (name, email, organization) therefore appears on Contacts, the Cap table, the donut legends (holder names from Carta, not contacts) and chat answers, which can disagree on spelling.

#### STORY-CAP-106: Connect Carta from the Cap table and get to the first donut (long cross-feature journey)

**Type**: long
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, first-time founder of Northwind Robotics, who has 4 investors in Contacts already and is raising a seed extension
**Goal**: Connect Carta, have the Carta agent read the cap table, check the donut against Contacts, file the signed SAFE, and ask the agent a question.
**Preconditions**: Model set up; Carta account exists; 4 investor contacts saved by hand; Data room available.
**Ideal path**: 14 — connect, read, review, fix, file.
**Alternate paths**: Integrations page to connect Carta (the cap table opens the same dialog in place); onboarding "Connect your apps".
##### Steps
1. Open Cap table → card "See who owns your company"; the four hand-saved contacts already appear in the table without Shares/Ownership.
2. Click "Connect Carta" → a Carta sign-in dialog (custom connection dialog prefilled with Carta's address) opens on the same page.
3. Complete Carta sign-in in the dialog → dialog closes; the page re-checks servers.
4. The card changes to "Carta is connected" with "The Carta agent has not read your cap table yet." and a button "Read cap table" (if no model: "The Carta agent needs a model before it can read your cap table." with "Add a model", which opens Settings, Models).
5. Click "Read cap table" → header shows "Reading Carta…", the donut area shows skeleton rows while the table is empty; the page polls every 3 seconds during the read and every 30 seconds afterwards, and also on window focus.
6. The run finishes → summary figures, donut and holders table fill in; the header refresh button (aria-label "Refresh from Carta", tooltip "Refresh from Carta. The Carta agent reads your cap table again.") is enabled again. Contacts also reload when the read ends, because the agent may have added contacts.
7. Check the donut: click "Show Series Seed Preferred breakdown" and compare holders to her four contacts. Maya notices two investors appear twice (holder row and a holdingless contact) because their emails differ in Carta.
8. Click each duplicate contact, correct the email, "Save" → rows merge (see STORY-CAP-105).
9. On a SAFE holder with a Carta email but no contact click "Save as contact" → "Save ... as a contact" dialog → "Save".
10. Click the header "Add files" / Import menu on the Cap table (DataRoomImportMenu) → import the signed SAFE PDF from email or Drive; it files into the Data room folder Finance > Cap Table. A notice reports the result.
11. Scroll to the bottom documents area (FolderDocuments for Finance > Cap Table) → the SAFE is listed.
12. Click the header "Ask" button for the Carta agent → panel opens; ask "What percent do the four seed investors hold together?".
13. The agent answers from the stored snapshot (`cap_table_read`), without calling Carta again. When the answer ends the page reloads contacts and the cap table.
14. Maya changes the Search to the investor's name and Sort to "Ownership" to check the number herself.
15. Click "Hide amounts" in the header (HideAmountsButton) before sharing her screen on a call → dollar figures are masked.
16. Click the sidebar row "Contacts" → the same four investors plus the new SAFE holder contact; Carta-only holders (common, options) are absent. Maya hesitates: she expected everyone from Carta here, but Contacts is an address book, not a holder list.
17. Reload the Cap table with `?kind=investor&sort=name&dir=asc` in the URL → the same filtered, sorted view returns, so she can bookmark it.
##### Variations
- Carta sign-in ended: card title "Sign in to Carta again to see who owns your company", text "Your Carta sign-in ended. Sign in again to see holders here.", button "Reconnect Carta".
- Refresh fails: red text "Could not refresh from Carta" with "Try again" (or "Add a model" when no model).
- Snapshot load fails: "Could not load the cap table, so holdings are missing." with "Try again".
##### Edge Cases
- If the server list fails to load while the Carta dialog is opening, the dialog closes and a notice shows the error.
- Contacts are address book entries only; the dialog says they do not change Carta. Maya must still update Carta itself for ownership changes.
- The cap table agent's write tool `cap_table_update` changes the stored Cap table page snapshot, not Carta. UNVERIFIED whether the UI marks such edits differently from Carta reads.

#### STORY-CAP-107: Deployment owner on the desktop app checks cap table sharing across users

**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: The deployment owner on the desktop app, with a second user (a co-founder) on the same space
**Goal**: Confirm the co-founder's contacts and cap table are not shown in the owner's views.
**Preconditions**: Two users; each has saved a contact "Ravi Menon" with different data.
**Ideal path**: 4 — open Contacts as each user.
**Alternate paths**: none found.
##### Steps
1. As the owner open Contacts → only the owner's contacts; Ravi Menon with the owner's notes.
2. Sign in as the co-founder → Contacts shows their own "Ravi Menon" with different notes.
3. Each tries to save the same email → no conflict: the email uniqueness is per user in the space.
4. Owner opens Cap table → the owner's contacts joined with the snapshot.
##### Variations
- Agents see only the contacts of the bot owner who started the run.
##### Edge Cases
- Editing a contact id that belongs to someone else is refused as "Contact not found" (isolation error). UNVERIFIED whether the UI could ever construct such a request.
- Export my data (Settings) may include contacts. UNVERIFIED; not read for this topic.

### Redundancy Candidates (this area)

- **Agent panel and bot page show the same thread** (STORY-CAP-008). Two places to chat; the name button is the only link.
- **Two ways to add an investor contact:** "Add contact" dialog versus the agent's `contacts_add`; with Carta on, the read run already adds investor holders, so three paths create the same record.
- **Cash and runway are answerable in two places:** the Carta agent's `finance_*` tools and the Finance page agent (STORY-CAP-020).
- **"Connect Carta" exists in Cap table and in Integrations** with the same dialog; fine, but Integrations' copy ("Cap table, equity and investors") and the Cap table card use different words.
- **Pool figure twice:** "Option pool available" card and the "Unallocated pool" row show the same 900,000.

### Suspected problems (this area)

1. **Silent first read with no model.** Connecting Carta with no model set up makes `startCartaSync` return `no_model` and nothing is shown (`carta-agent.ts:140`, `onMcpServerConnected` swallows it). The page is connected and empty with no message; only Refresh reveals "Add a model before refreshing" (STORY-CAP-024).
2. **Connection check failure is invisible.** If `rpc.mcp.servers.list` fails, `.catch(() => undefined)` leaves `cartaConnected` true: the Connect card is hidden, no snapshot loads, and the Shell never learns Carta state, so no Ask button or panel appears (`CapTable.tsx:494`, STORY-CAP-026).
3. **Hide amounts leaks proportions.** The ownership bar widths come straight from `percent` and are not masked (`CapTable.tsx:143-150`); only the numbers are (STORY-CAP-021).
4. **A run that fails after starting leaves no trace on the page.** `syncing` just turns false; there is no "last read failed" line; the failure text is only in the agent's chat (STORY-CAP-004).
5. **Expired sign-in hides saved data.** `snapshot` is nulled when Carta is not connected (`CapTable.tsx:532`), so a returning founder sees the data vanish instead of a stale table with a "Sign in again" banner (STORY-CAP-005).
6. **Agent-added contacts need a refresh to show.** The contact list reloads only when a run ends (`CapTable.tsx:498-503`); a chat-driven `contacts_add` appears after a manual reload (STORY-CAP-016).
7. **Refresh is icon-only.** Label "Refresh from Carta" exists only as `aria-label`; no visible text or tooltip text beyond the icon (`CapTable.tsx:591-601`).
8. **"Other" tab mixes counsel and founders; "Options" has no tab** (STORY-CAP-030; `rowKind`).
9. **The writes switch is two pages away** and the agent's refusal does not point to it (STORY-CAP-027).
10. **Cap table row cannot be hidden** even for users who never use Carta (STORY-CAP-028).
11. **Undo is time-limited with no other recovery;** "Dismiss" on a failed Undo drops the data (STORY-CAP-031).
12. **Search placeholder says "Search chats"** though it also finds pages such as Cap table (STORY-CAP-028).


---
